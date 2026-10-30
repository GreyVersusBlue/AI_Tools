// binder-stale.test.mjs — the emergency binder's staleness reminder (Path 10 P3).
//   node Tools/packet-builder/test/binder-stale.test.mjs   (or: npm run test:binder-stale)
//
// _shared/binder-stale.js against fixtures (never printed, fresh, a changed key, an old print, a broken
// record), the stamp 044 puts on its standing details and the providers print, and the contract that
// the watched keys are the Emergency binder's own date-independent keys. Then the same checks against
// deliberate breaks of both files (MUTANTS): each must turn a check red. Pure: vm contexts, a fake
// storage and a fixed clock; nothing reads the real clock.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = f => fs.readFileSync(path.join(site, f), 'utf8');
const STALE = rd('_shared/binder-stale.js');
const SECTIONS = rd('Tools/packet-builder/sections.js');
const PROVIDERS = rd('Tools/packet-builder/providers.js');
const REGISTRY = rd('_shared/tool-registry.js');
const PAGE = rd('Tools/090-packet-builder.html');

const STANDING = 'subPlanBuilder.standingDetails.v1', HALL = 'hall-pass-log-sections', ROSTERS = 'np_rosters';
const T0 = '2026-10-01T12:00:00.000Z';
const days = n => new Date(Date.parse(T0) + n * 86400000).toISOString();
const store = seed => { const m = { ...seed }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
const FULL = { [STANDING]: JSON.stringify({ roomNumber: '214', fireRoute: 'East door', savedOn: '2026-09-02' }), [HALL]: '{"sets":{}}', [ROSTERS]: '{"A":["Ann"]}' };

function loadStale(src) { const c = { window: {} }; vm.createContext(c); vm.runInContext(src, c); return c.BinderStale || c.window.BinderStale; }
function loadProviders(src) {
  const c = { window: {} }; vm.createContext(c);
  vm.runInContext(SECTIONS, c); vm.runInContext(src, c);
  return c.window.PacketSections || c.PacketSections;
}

function checks(B, PS) {
  const out = [];
  const t = (label, cond) => out.push({ label, ok: !!cond });
  const eq = (label, a, b) => t(`${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b));

  eq('nothing saved, never printed: none', B.check(store({}), T0).state, 'none');
  eq('details saved, never printed: never', B.check(store(FULL), T0).state, 'never');
  eq('one watched key alone is enough for never', B.check(store({ [HALL]: '{}' }), T0).state, 'never');
  eq('a key outside the watch list is not details', B.check(store({ unrelated: 'x' }), T0).state, 'none');

  const s = store(FULL);
  const rec = B.record(s, T0);
  eq('record stores version 1 and the time', [rec.v, rec.at], [1, T0]);
  eq('record stores one fingerprint per watched key', Object.keys(rec.sums).sort(), [HALL, ROSTERS, STANDING].sort());
  t('record stores no part of the data itself', !s.m[B.KEY].includes('East door') && !s.m[B.KEY].includes('Ann') && !s.m[B.KEY].includes('214'));
  eq('just printed: fresh', B.check(s, T0).state, 'fresh');
  eq('printed 179 days ago: still fresh', B.check(s, days(179)).state, 'fresh');
  eq('printed 180 days ago: old', B.check(s, days(180)).state, 'old');
  eq('old reports the days', B.check(s, days(200)).days, 200);

  const changed = store(FULL); B.record(changed, T0);
  changed.setItem(STANDING, JSON.stringify({ roomNumber: '305', fireRoute: 'East door', savedOn: '2026-10-20' }));
  const r = B.check(changed, days(20));
  eq('a room change after printing: changed', r.state, 'changed');
  eq('changed names the key', r.changed, [STANDING]);
  eq('changed wins over old', B.check(changed, days(400)).state, 'changed');
  const gone = store(FULL); B.record(gone, T0); delete gone.m[ROSTERS];
  eq('a watched key removed since printing: changed', B.check(gone, T0).state, 'changed');
  const added = store({ [STANDING]: FULL[STANDING] }); B.record(added, T0); added.setItem(HALL, '{}');
  eq('a watched key added since printing: changed', B.check(added, T0).state, 'changed');

  const partial = store({ [STANDING]: FULL[STANDING], [B.KEY]: JSON.stringify({ v: 1, at: T0, sums: { [STANDING]: B.fingerprint(FULL[STANDING]) } }) });
  eq('a record that predates a watched key does not call that absent key a change', B.check(partial, T0).state, 'fresh');
  eq('a broken record reads as never printed', B.check(store({ ...FULL, [B.KEY]: '{not json' }), T0).state, 'never');
  eq('a record of another version reads as never printed', B.check(store({ ...FULL, [B.KEY]: JSON.stringify({ v: 2, at: T0, sums: {} }) }), T0).state, 'never');
  eq('a record with a bad time reads as never printed', B.check(store({ ...FULL, [B.KEY]: JSON.stringify({ v: 1, at: 'soon', sums: {} }) }), T0).state, 'never');
  eq('a clock before the print counts as 0 days', B.check(s, days(-5)).days, 0);
  eq('record fails quietly when storage refuses', B.record({ getItem: () => null, setItem() { throw new Error('full'); } }, T0), null);
  t('fingerprints differ for different text and agree for the same', B.fingerprint('a') !== B.fingerprint('b') && B.fingerprint('a') === B.fingerprint('a'));

  eq('fresh says nothing', B.message({ state: 'fresh' }), '');
  eq('none says nothing', B.message({ state: 'none' }), '');
  t('never, changed and old each say something different', new Set([B.message({ state: 'never' }), B.message({ state: 'changed' }), B.message({ state: 'old', days: 200 })]).size === 3);
  t('old names the days', B.message({ state: 'old', days: 200 }).includes('200'));
  t('no message names a student or a detail', ['never', 'changed', 'old'].every(k => !/Ann|214|East/.test(B.message({ state: k, days: 200 }))));

  const el = { hidden: true, textContent: '', href: '' };
  B.mount(el, s, T0, '../');
  t('mount hides the link when fresh', el.hidden === true);
  B.mount(el, changed, days(20), '../');
  t('mount shows the link when changed', el.hidden === false && /changed/.test(el.textContent));
  eq('mount points the link at the Emergency binder preset', el.href, '../Tools/090-packet-builder.html?preset=emergency');
  B.mount(el, s, T0, '../');
  t('mount hides it again once printed', el.hidden === true);
  t('mount with no element does not throw', B.mount(null, s, T0, '') === null);

  // The watch list is the Emergency binder's own, less the records key that moves on every student note.
  const m = PAGE.match(/name: 'Emergency binder', ids: \[([^\]]*)\]/);
  const ids = m ? m[1].split(',').map(x => x.trim().replace(/'/g, '')) : [];
  const keys = new Set();
  ids.forEach(id => (PS.get(id)?.storageKeys || []).forEach(k => keys.add(k)));
  keys.delete('crh_students_v1');
  eq('the watched keys are the Emergency binder\'s providers\' keys (less crh_students_v1)', [...B.WATCHED].sort(), [...keys].sort());
  t('the Emergency binder lists only date-independent sections', ids.length > 0 && ids.every(id => !['school-calendar', 'seating', 'sub-plan-days'].includes(id)));
  t('the registry declares the record key on packet-builder', /gvb-packet:evergreen\.v1/.test(REGISTRY) && B.KEY === 'gvb-packet:evergreen.v1');

  // the stamp
  const ctx = day => ({ read: k => (k === STANDING ? { roomNumber: '214', fireRoute: 'East door', savedOn: day } : undefined), todayISO: '2026-10-29' });
  const html = id => PS.toHtml(PS.build([id], ctx('2026-09-02')).sections);
  t('the sub plan prints when its details were saved', html('sub-plan').includes('Details last saved 2026-09-02.'));
  t('the emergency page prints when its details were saved', html('emergency-info').includes('Details last saved 2026-09-02.'));
  t('a details record with no stamp prints no stamp', !PS.toHtml(PS.build(['sub-plan'], { read: k => (k === STANDING ? { roomNumber: '214' } : undefined), todayISO: '2026-10-29' }).sections).includes('last saved'));
  t('a malformed stamp prints nothing', !PS.toHtml(PS.build(['sub-plan'], ctx('<b>soon</b>')).sections).includes('last saved'));

  // the pages
  const idx = rd('index.html'), cc = rd('Tools/010-command-center-dashboard.html'), p44 = rd('Tools/044-Sub Plan Builder.html');
  t('index.html loads the module before the script that mounts it', idx.indexOf('_shared/binder-stale.js') > 0 && idx.indexOf('_shared/binder-stale.js') < idx.indexOf('BinderStale.mount'));
  t('index.html and 010 mount the reminder', /BinderStale\.mount/.test(idx) && /BinderStale\.mount/.test(cc));
  t('044 stamps the details on every save', (p44.match(/stampSettings\(\);/g) || []).length >= 2);
  t('090 records only when the packet is the Emergency binder', /!isEmergency\(\)\) return;[^]*BinderStale\.entry\(localStorage/.test(PAGE));
  return out;
}

let bad = 0, n = 0;
const B0 = loadStale(STALE), PS0 = loadProviders(PROVIDERS);
for (const c of checks(B0, PS0)) { n++; if (!c.ok) { bad++; console.log('FAIL ' + c.label); } }

const MUT = [
  ['stale', 'never printed counts as none', STALE, s => s.replace("held.length ? 'never' : 'none'", "'none'")],
  ['stale', 'old comes at 181 days', STALE, s => s.replace('var MAX_DAYS = 180;', 'var MAX_DAYS = 181;')],
  ['stale', 'old never fires', STALE, s => s.replace("changed.length ? 'changed' : days >= MAX_DAYS ? 'old' : 'fresh'", "changed.length ? 'changed' : 'fresh'")],
  ['stale', 'old wins over changed', STALE, s => s.replace("changed.length ? 'changed' : days >= MAX_DAYS ? 'old' : 'fresh'", "days >= MAX_DAYS ? 'old' : changed.length ? 'changed' : 'fresh'")],
  ['stale', 'a removed key is not a change', STALE, s => s.replace("(rec.sums[k] === undefined ? fingerprint('') : rec.sums[k])", 'rec.sums[k]')],
  ['stale', 'the record keeps the data', STALE, s => s.replace('sums[k] = fingerprint(raw(storage, k));', 'sums[k] = raw(storage, k);')],
  ['stale', 'fingerprint ignores the text', STALE, s => s.replace('h ^= s.charCodeAt(i);', 'h ^= 1;')],
  ['stale', 'a bad record is trusted', STALE, s => s.replace('r.v !== 1', 'false')],
  ['stale', 'a bad time is trusted', STALE, s => s.replace("typeof r.at !== 'string' || isNaN(new Date(r.at).getTime())", 'false')],
  ['stale', 'a failed save throws', STALE, s => s.replace("try { storage.setItem('gvb-packet:evergreen.v1', JSON.stringify(rec)); return rec; } catch (e) { return null; }", "storage.setItem('gvb-packet:evergreen.v1', JSON.stringify(rec)); return rec;")],
  ['stale', 'mount never hides', STALE, s => s.replace('el.hidden = true; return res;', 'return res;')],
  ['stale', 'mount links the wrong page', STALE, s => s.replace('?preset=emergency', '')],
  ['stale', 'a watched key dropped', STALE, s => s.replace("'hall-pass-log-sections', ", '')],
  ['stale', 'a negative age counts', STALE, s => s.replace('days < 0', 'false')],
  ['stale', 'the message names a count of nothing', STALE, s => s.replace("'Your emergency binder was printed ' + res.days", "'Your emergency binder was printed long'")],
  ['prov', 'the sub plan prints no stamp', PROVIDERS, s => s.replace('standingBlocks(s).concat(stampNote(s))', 'standingBlocks(s)')],
  ['prov', 'the emergency page prints no stamp', PROVIDERS, s => s.replace("[{ type: 'kv', rows: emergencyRows(s) }].concat(stampNote(s))", "[{ type: 'kv', rows: emergencyRows(s) }]")],
  ['prov', 'any stamp is printed', PROVIDERS, s => s.replace('/^\\d{4}-\\d{2}-\\d{2}$/.test(s.savedOn)', 'true')],
];
for (const [kind, name, base, mutate] of MUT) {
  const src = mutate(base);
  if (src === base) { bad++; n++; console.log('FAIL mutant "' + name + '" did not change the source (its pattern is stale)'); continue; }
  let red = false;
  try { red = checks(kind === 'stale' ? loadStale(src) : B0, kind === 'prov' ? loadProviders(src) : PS0).some(c => !c.ok); } catch (e) { red = true; }
  n++;
  if (!red) { bad++; console.log('FAIL mutant survived: ' + name); }
}
console.log(bad ? `${bad} failed` : `ok — ${n} checks and mutants`);
process.exit(bad ? 1 : 0);
