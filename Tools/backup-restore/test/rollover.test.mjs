// rollover.test.mjs — the year rollover's archive check and its journal
// (Tools/backup-restore/br-rollover.js, Path 3 P6 increment 1). Pure Node:
// the module, RestoreKit and BrCrypto run in a vm with an in-memory storage.
//
//   node Tools/backup-restore/test/rollover.test.mjs
//
// What it holds: an archive passes its check only as the exact bytes that
// were built, and each way a file can be wrong is refused with its own
// reason; a clear removes a key only while it holds what the archive holds;
// a clear that fails at any step leaves the journal at that step, and
// finishing from there gives the storage an uninterrupted clear gives; the
// journal never holds a name or a value.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FIX, RAW } from './_rollover-fixtures.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function memStorage(init, { failChangeAt = -1, failJournalAt = -1, keepChangeAt = -1 } = {}) {
  const m = new Map(Object.entries(init || {}));
  let changes = 0, journalWrites = 0;
  /* A change is a write or a removal of anything but the journal. failChangeAt
     throws on that change; keepChangeAt says yes and keeps the old value. */
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (k === 'br_rollover_v1') { if (journalWrites++ === failJournalAt) throw new Error('QuotaExceededError'); m.set(k, String(v)); return; }
      const n = changes++;
      if (n === failChangeAt) throw new Error('QuotaExceededError');
      if (n !== keepChangeAt) m.set(k, String(v));
    },
    removeItem: k => {
      const n = changes++;
      if (n === failChangeAt) throw new Error('refused');
      if (n !== keepChangeAt) m.delete(k);
    },
    map: m,
    snapshot: () => Object.fromEntries([...m.entries()].filter(([k]) => k !== 'br_rollover_v1').sort()),
  };
}

const window = { crypto: globalThis.crypto, TextEncoder };
const ctx = { window, document: { currentScript: null }, TextEncoder, setTimeout, clearTimeout, globalThis: {} };
vm.createContext(ctx);
for (const f of ['_shared/tool-registry.js', '_shared/restore-kit.js', '_shared/backup-crypto.js', 'Tools/backup-restore/br-rollover.js']) {
  vm.runInContext(readFileSync(path.join(SITE, f), 'utf8'), ctx);
}
const RO = window.BrRollover;
const deps = { read: window.RestoreKit.read, isEncrypted: p => window.BrCrypto.isEncrypted(p) };

console.log('BrRollover — the year archive, its check and the journal');

/* Made-up students; nobody real. */
const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund'];
const LOCAL = {
  np_rosters: JSON.stringify({ 'Period 3': NAMES }),
  np_history: JSON.stringify([{ name: 'Avery Stone', at: 1 }]),
  'hall-pass-log-sections': JSON.stringify({ current: 'Period 3', sets: { 'Period 3': { name: 'Period 3', namesText: NAMES.join('\n'),
    destinations: [{ id: 'lib', label: 'Library annex' }], log: [{ name: 'Blake Rivers' }] } } }),
  'subPlanBuilder.standingDetails.v1': JSON.stringify({ teacherName: 'Ms. Teacher', medicalAlerts: 'Casey Lund: inhaler' }),
  np_prompts: JSON.stringify(['Avery Stone goes first', 'Pair and share']),
  'gvb-rubric-builder:data:Essay': JSON.stringify({ title: 'Essay', rows: 4 }),
  'gvb-a11y-prefs': '{"theme":"dark"}',
};
const PNG = Buffer.from('a tiny picture, eleven bytes long'.slice(0, 11)).toString('base64');
function envelopeOf(local) {
  return {
    source: 'AsPerMyLessonPlan.com backup', format: 'aspermylessonplan-backup', formatVersion: 2,
    exportedAt: '2027-06-18T15:00:00.000Z', label: '2026-27',
    meta: { groups: [], itemCount: Object.keys(local).length, byteCount: 0 },
    data: { ...local },
    indexedDB: {
      'gvb-media': { version: 1, stores: [{ name: 'media', keyPath: 'id', records: [
        { v: { id: 'seating/a1', blob: { __t: 'blob', mime: 'image/png', v: PNG } } },
        { v: { id: 'rgb/b2', blob: { __t: 'blob', mime: 'image/png', v: PNG } } },
      ] }] },
    },
  };
}

async function buildArchive(local, id = 'ro-test-1') {
  const env = envelopeOf(local);
  const manifest = await RO.manifest(env);
  env.rollover = RO.stamp({ id, label: '2026-27', manifest, plannedAt: '2027-06-18T15:00:00.000Z' });
  const text = JSON.stringify(env, null, 2);
  return { id, text, hash: await RO.hash(text), manifest, env };
}

/* ── hash, base64 ─────────────────────────────────────────────────────── */
{
  const h = await RO.hash('abc');
  eq(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'hash: SHA-256 of "abc", hex');
  eq(RO.hashKind(h), 'SHA-256', 'hash: says which hash it is');
  ok((await RO.hash('Avery Stone ✓')) !== (await RO.hash('Avery Stone ✓ ')), 'hash: one byte more is another hash');
  eq(RO.base64Bytes(PNG), 11, 'base64Bytes: the decoded size');
  eq(RO.base64Bytes(PNG.slice(0, -1)), -1, 'base64Bytes: a string cut short is not base64');
}

/* ── manifest ─────────────────────────────────────────────────────────── */
const A = await buildArchive(LOCAL);
{
  eq(Object.keys(A.manifest.local), Object.keys(LOCAL).sort(), 'manifest: every key, sorted');
  eq(A.manifest.local.np_rosters[0], LOCAL.np_rosters.length, 'manifest: a key\'s length');
  eq(A.manifest.databases, { 'gvb-media': { media: 2 } }, 'manifest: records per store');
  eq(A.manifest.blobs, { 'gvb-media': [2, 22] }, 'manifest: blobs and their decoded bytes');
  eq(A.env.formatVersion, 2, 'stamp: the envelope stays format 2, so an older reader still restores it');
  eq(RO.compareLocal(A.manifest.local, A.manifest.local), [], 'compareLocal: a manifest equals itself');
  const later = await RO.localManifest({ ...LOCAL, np_history: '[]', 'new-key': 'x' });
  eq(RO.compareLocal(A.manifest.local, later), ['new-key', 'np_history'], 'compareLocal: a changed key and an added key');
}

/* ── verify: the one file that passes, and each way a file is wrong ───── */
{
  const codes = async (text, expect = A) => (await RO.verify(text, expect, deps)).reasons.map(r => r.code);
  const good = await RO.verify(A.text, A, deps);
  ok(good.ok && good.reasons.length === 0, 'verify: the built text passes');

  eq(await codes(''), ['empty'], 'verify: a 0-byte file says so');
  eq((await codes(A.text.slice(0, Math.floor(A.text.length * 0.6))))[1], 'truncated', 'verify: a file cut short is changed and does not parse');

  const edited = JSON.parse(A.text);
  edited.data.np_history = '[]';
  eq(await codes(JSON.stringify(edited, null, 2)), ['changed', 'changed-key'], 'verify: an edited value is named');

  const dropped = JSON.parse(A.text);
  delete dropped.data.np_history;
  dropped.meta.itemCount = Object.keys(dropped.data).length;
  eq(await codes(JSON.stringify(dropped, null, 2)), ['changed', 'missing-key'], 'verify: a removed key is named');

  const B = await buildArchive(LOCAL, 'ro-other-run');
  eq(await codes(B.text), ['changed', 'other-run'], 'verify: another run\'s archive is refused');

  const plain = JSON.parse(A.text);
  delete plain.rollover;
  eq(await codes(JSON.stringify(plain, null, 2)), ['changed', 'not-archive'], 'verify: an ordinary backup is not the archive');

  const locked = { source: 'x', format: 'aspermylessonplan-backup', formatVersion: 2, encrypted: { v: 1 }, ciphertext: 'abc' };
  eq(await codes(JSON.stringify(locked)), ['changed', 'locked'], 'verify: a locked file is refused');

  const noDb = JSON.parse(A.text);
  delete noDb.indexedDB;
  eq(await codes(JSON.stringify(noDb, null, 2)), ['changed', 'missing-db'], 'verify: a missing database is named');

  const fewer = JSON.parse(A.text);
  fewer.indexedDB['gvb-media'].stores[0].records.pop();
  eq((await codes(JSON.stringify(fewer, null, 2))).slice(0, 2), ['changed', 'db-count'], 'verify: a database short of a record is named');

  const shortBlob = JSON.parse(A.text);
  shortBlob.indexedDB['gvb-media'].stores[0].records[0].v.blob.v = Buffer.from('ten bytes!').toString('base64');
  eq(await codes(JSON.stringify(shortBlob, null, 2)), ['changed', 'blob-size'], 'verify: a picture one byte short is named');

  /* The byte check is not the only guard: the same content re-serialised
     (another indent) fails on its bytes and passes on everything else. */
  eq(await codes(JSON.stringify(JSON.parse(A.text))), ['changed'], 'verify: the same content in other bytes fails on the hash alone');
}

/* ── the rules: one for every student entry, an entry for every rule ── */
const REG = window.ToolRegistry;
const TOOLS = Array.isArray(REG.tools) ? REG.tools : REG.tools();
{
  const declared = new Set(), student = [];
  for (const t of TOOLS) {
    for (const k of t.keys || []) { declared.add('k:' + k.k); if (k.student) student.push({ key: k.k }); }
    for (const p of t.prefixes || []) { declared.add('p:' + p.p); if (p.student) student.push({ prefix: p.p }); }
  }
  const missing = student.filter(e => {
    if (e.key) return !RO.RULES.some(r => r.key === e.key);
    return !RO.RULES.some(r => r.prefix === e.prefix);
  }).map(e => e.key || e.prefix + '*');
  eq(missing, [], 'rules: every student key and prefix in the registry has a rule');
  const undeclared = RO.RULES.filter(r => !declared.has(r.key ? 'k:' + r.key : 'p:' + r.prefix)).map(r => r.key || r.prefix + '*');
  eq(undeclared, [], 'rules: every rule names a key or prefix the registry declares');
  ok(RO.RULES.every(r => ['delete', 'reduce', 'roster', 'ask', 'index', 'keep'].includes(r.kind)), 'rules: every rule has a known kind');
  ok(RO.RULES.every(r => r.kind === 'delete' || r.kind === 'keep' || typeof r.reduce === 'function'), 'rules: every reducing rule has a reducer');
  ok(Object.isFrozen(RO.RULES) && Object.isFrozen(RO.RULES[0]), 'rules: the list is frozen');
  eq(RO.ruleFor('gtg:data:Period 3').prefix, 'gtg:data:', 'ruleFor: the longest prefix wins over a legacy family');
  eq(RO.ruleFor('gtg:list').kind, 'index', 'ruleFor: an exact key wins over a prefix');
  eq(RO.ruleFor('gvb-a11y-prefs'), null, 'ruleFor: a settings key has no rule');
}

/* ── scanNames ───────────────────────────────────────────────────────── */
{
  const N = ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Jo'];
  eq(RO.scanNames('Avery Stone left early. avery stone came back.', N), [{ name: 'Avery Stone', count: 2 }], 'scanNames: a full name, in other case too');
  eq(RO.scanNames('Seat Blake\nRivers by the door', N), [{ name: 'Blake Rivers', count: 1 }], 'scanNames: a name across a line break');
  eq(RO.scanNames('Avery is here; Stone Age unit', N), [], 'scanNames: no hit on a first name or a last name alone');
  eq(RO.scanNames('Casey Lundgren', N), [], 'scanNames: no hit on a name inside a longer word');
  eq(RO.scanNames('Jo went home', N), [], 'scanNames: a one-word roster name is never searched');
  eq(RO.scanValue({ 'Casey Lund': 'x' }, N), [{ name: 'Casey Lund', count: 1 }], 'scanValue: a name used as an object key is found');
  eq(RO.scanValue(['line one', 'Blake\nRivers'], N), [{ name: 'Blake Rivers', count: 1 }], 'scanValue: the text a teacher typed, not JSON\'s escapes of it');
  eq(RO.rosterNames({
    np_rosters: JSON.stringify({ 'Period 3': ['Avery Stone', 'Blake Rivers'], 'Period 4': ['avery  stone', 'Jo'] }),
    crh_students_v1: JSON.stringify({ version: 1, rosters: { 'Period 3': { meta: {}, students: [{ id: 's1', name: 'Casey Lund', preferred: 'Case' }], orphans: [] } } }),
  }), ['Avery Stone', 'Blake Rivers', 'Casey Lund'], 'rosterNames: both roster keys, each name once, full names only');
}

/* ── each reducer, on its tool's own shape with made-up students ─────── */
const CTX = { names: NAMES, nextTerm: '2027-28', choices: {} };
const J = JSON.stringify;

for (const [key, [fixture, checks]] of Object.entries(FIX)) {
  const rule = RO.ruleFor(key);
  if (!ok(rule && rule.reduce, `${key}: has a reducing rule`)) continue;
  const text = J(fixture);
  const r = RO.reduceKey(rule, key, text, CTX);
  ok(!r.unreadable && (r.action === 'write' || r.action === 'delete'), `${key}: changes the key (got ${r.action}${r.unreadable ? ', unreadable' : ''})`);
  const after = r.action === 'delete' ? null : JSON.parse(r.after);
  for (const [cond, label] of checks(after)) ok(cond, `${key}: ${label}`);
  const out = r.after || '';
  ok(!NAMES.some(n => out.includes(n)), `${key}: no fixture student is left in it`);
  ok(r.after === null || r.after.length <= text.length, `${key}: what it writes is no longer than what it replaces`);
  ok(r.removed.length > 0 && r.removed.every(x => x.count > 0), `${key}: says what it removed`);
  if (r.after) {
    const again = RO.reduceKey(rule, key, r.after, CTX);
    eq(again.action, 'keep', `${key}: idempotent — reducing the result changes nothing`);
  }
  for (const bad of ['null', '42', '"text"', '{not json']) {
    let res;
    try { res = RO.reduceKey(rule, key, bad, CTX); } catch (e) { res = { threw: e.message }; }
    ok(!res.threw && res.action !== 'write' && res.action !== 'delete', `${key}: ${bad} is left alone, no throw (${res.threw || res.action})`);
  }
}
{
  const key = 'gvb-sub-binder:today-lesson';
  const r = RO.reduceKey(RO.ruleFor(key), key, RAW[key], CTX);
  eq([r.action, r.hits.map(h => h.name)], ['delete', ['Avery Stone']], `${key}: a plain-text note naming a student is cleared`);
  eq(RO.reduceKey(RO.ruleFor(key), key, 'Worksheets on the cart', CTX).action, 'keep', `${key}: one naming nobody is not touched`);
}
/* Every reducing rule has a fixture, so a new rule cannot ship untested. */
{
  const tested = RO.RULES.filter(r => r.reduce && r.kind !== 'index').filter(r =>
    !Object.keys(FIX).concat(Object.keys(RAW)).some(k => RO.ruleFor(k) === r)).map(r => r.key || r.prefix + '*');
  eq(tested, ['gvb-certificate-maker:last'], 'fixtures: every reducing rule has one (the legacy certificate key shares the preset\'s reducer)');
}
/* A kind E key with no student in it is not touched or shown. */
eq(RO.reduceKey(RO.ruleFor('np_prompts'), 'np_prompts', J(['Pair and share']), CTX).action, 'keep', 'ask: a key naming nobody is kept and not shown');
eq(RO.reduceKey(RO.ruleFor('np_prompts'), 'np_prompts', J(['Avery Stone first']), { ...CTX, choices: { np_prompts: 'keep' } }).action, 'choose', 'ask: Keep chosen is kept and still listed');

/* ── plan and run ─────────────────────────────────────────────────────── */
async function startRun(storage, id = A.id) {
  RO.recordRun(storage, { id, label: '2026-27', state: 'archived', archiveName: 'a.json', archiveHash: A.hash });
}
const STUDENT = ['hall-pass-log-sections', 'np_history', 'np_rosters'];
const ARCH = A.env.data;
const SEATING = ['seating/a1'];
/* The photos and the share slot, faked: each clear can be made to fail. */
function fakeIo(storage, { mediaFails = false, shareFails = false } = {}) {
  const io = { storage, photos: [...SEATING], shared: true };
  io.media = { clear: async ns => { if (mediaFails) throw new Error('blocked'); if (ns === 'seating') io.photos = []; return io.photos.length === 0; } };
  io.share = { remove: async () => { if (shareFails) return false; io.shared = false; return true; } };
  return io;
}
const planOf = (s, extra = {}) => RO.plan(A.id, s.snapshot(), ARCH, { studentKeys: STUDENT, nextTerm: '2027-28',
  media: { seating: { ids: SEATING, bytes: 11 } }, archiveMedia: ['seating/a1', 'rgb/b2'], share: true, ...extra });

let EXPECTED;
{
  const s = memStorage(LOCAL);
  await startRun(s);
  const p = await planOf(s);
  eq(p.items.filter(i => i.action !== 'keep').map(i => i.phase + ':' + i.action + ':' + i.key), [
    '1:write:hall-pass-log-sections', '1:write:np_prompts', '1:write:subPlanBuilder.standingDetails.v1',
    '2:delete:np_history', '3:write:np_rosters'], 'plan: reductions, then deletions, then the roster last');
  eq(p.problems, [], 'plan: nothing outside the archive');
  eq([p.totals.write, p.totals.delete, p.totals.media, p.totals.share], [4, 1, 1, 1], 'plan: totals, the photos and the share slot');
  const pr = p.items.find(i => i.key === 'np_prompts');
  eq([pr.kind, pr.choice, pr.hits.map(h => h.name)], ['ask', 'clear', ['Avery Stone']], 'plan: free text naming a student is shown with its names, pre-set to Clear');
  ok(!p.items.some(i => i.key === 'gvb-rubric-builder:data:Essay' || i.key === 'gvb-a11y-prefs'), 'plan: setup keys are not in it');
  const io = fakeIo(s);
  const res = await RO.run(p, io);
  ok(res.done && res.removed === 7, 'run: five keys, the photos and the share slot');
  EXPECTED = s.snapshot();
  const hp = JSON.parse(EXPECTED['hall-pass-log-sections']).sets['Period 3'];
  ok(hp.destinations[0].label === 'Library annex' && hp.namesText === '' && hp.log.length === 0, 'run: the hall pass keeps its destination and loses its names');
  eq(EXPECTED.np_rosters, '{"Period 3":[]}', 'run: the class is kept, empty');
  eq(JSON.parse(EXPECTED['subPlanBuilder.standingDetails.v1']), { teacherName: 'Ms. Teacher', medicalAlerts: '' }, 'run: the medical alerts are gone, the sub plan stays');
  eq(EXPECTED.np_prompts, '["Pair and share"]', 'run: the chosen Clear took only the prompt naming a student');
  ok(!('np_history' in EXPECTED), 'run: kind A deleted');
  eq([EXPECTED['gvb-rubric-builder:data:Essay'], EXPECTED['gvb-a11y-prefs']], [LOCAL['gvb-rubric-builder:data:Essay'], LOCAL['gvb-a11y-prefs']], 'run: setup untouched');
  ok(!NAMES.some(n => Object.values(EXPECTED).some(v => v.includes(n))), 'run: no fixture student anywhere in storage');
  eq([io.photos, io.shared], [[], false], 'run: the photos and the parked roster file are cleared');
  const j = RO.getRun(s, A.id);
  eq([j.state, j.done, j.steps], ['done', 7, 7], 'run: the journal says done, 7 of 7');
  const journal = s.getItem('br_rollover_v1');
  ok(!NAMES.some(n => journal.includes(n)) && !journal.includes('Period 3') && !journal.includes('inhaler'), 'journal: no name and no value in br_rollover_v1');
  eq(res.receipt.keys.length, 5, 'receipt: the keys it changed');
  ok(!NAMES.some(n => JSON.stringify(res.receipt).includes(n)), 'receipt: no student name on it');
  eq(await RO.writtenBack(s), [], 'writtenBack: nothing has come back');
  s.setItem('hall-pass-log-sections', LOCAL['hall-pass-log-sections']);
  s.setItem('np_history', LOCAL.np_history);
  s.setItem('np_rosters', JSON.stringify({ 'Period 3': ['Dana New'] }));
  eq(await RO.writtenBack(s), ['hall-pass-log-sections', 'np_history'], 'writtenBack: last year\'s exact values are found, a reduced key\'s too; this year\'s roster is not');
  /* Clearing them again plans from the value now (it is the archive's). */
  const now = s.snapshot();
  const again = await RO.plan(A.id, now, now, { only: ['hall-pass-log-sections', 'np_history'], studentKeys: STUDENT });
  await RO.run(again, { storage: s });
  eq([s.getItem('hall-pass-log-sections'), s.getItem('np_history'), s.getItem('np_rosters')],
     [EXPECTED['hall-pass-log-sections'], null, '{"Period 3":["Dana New"]}'], 'clear again: reduces and deletes those two, leaves this year\'s roster');
}
{
  /* Keep, chosen for the free text: listed, never written. */
  const s = memStorage(LOCAL);
  const p = await planOf(s, { choices: { np_prompts: 'keep' } });
  eq(p.items.find(i => i.key === 'np_prompts').action, 'choose', 'plan: Keep chosen leaves the key out of the clear');
  await RO.run(p, fakeIo(s));
  eq(s.getItem('np_prompts'), LOCAL.np_prompts, 'run: ...and it is untouched');
}
{
  /* A key the archive does not hold, or holds another value of, stops the
     plan: it would be cleared without being in the archive. So does a
     photo saved since the archive. */
  const s = memStorage({ ...LOCAL, np_absent: '["Casey Lund"]', np_history: '[]' });
  const p = await planOf(s, { studentKeys: [...STUDENT, 'np_absent'], media: { seating: { ids: ['seating/a1', 'seating/new'], bytes: 22 } } });
  eq(p.problems.map(x => x.code + ':' + x.key).sort(), ['changed-since:np_history', 'not-archived:gvb-media:seating', 'not-archived:np_absent'],
     'plan: a key not in the archive, a key changed since and a photo saved since are problems');
  const res = await RO.run(p, fakeIo(s));
  ok(!res.done && res.removed === 0, 'run: a plan with problems writes nothing');
  eq(s.getItem('np_rosters'), LOCAL.np_rosters, 'run: ...not even the keys that were fine');
}
{
  /* A key saved between the plan and the run stops it with nothing written. */
  const s = memStorage(LOCAL);
  await startRun(s);
  const p = await planOf(s);
  s.setItem('hall-pass-log-sections', LOCAL['hall-pass-log-sections'].replace('Library', 'Office'));
  const res = await RO.run(p, fakeIo(s));
  eq([res.done, res.stale, res.removed], [false, ['hall-pass-log-sections'], 0], 'run: a key changed after the plan stops the run');
  eq(s.getItem('np_history'), LOCAL.np_history, 'run: ...with nothing removed');
  eq(RO.getRun(s, A.id).state, 'archived', 'run: ...and the journal still at archived');
}
{
  /* A key that will not parse is left as it is and named. */
  const s = memStorage({ ...LOCAL, 'hall-pass-log-sections': '{"sets": oops' });
  const local = s.snapshot();
  const p = await RO.plan(A.id, local, local, { studentKeys: STUDENT });
  eq([p.items.find(i => i.key === 'hall-pass-log-sections').action, p.notes.map(n => n.code + ':' + n.key)],
     ['keep', ['unreadable:hall-pass-log-sections']], 'plan: an unreadable key is kept and noted, not deleted');
}
/* A change refused at step k, for every k, leaves the journal at
   'clearing' with k done; planning again from the archive and finishing
   gives the same storage as a run that never failed. */
const STEPS = 7;
async function finishFrom(s, io) {
  const p = await planOf(s);
  eq(p.problems, [], '  finishing: the half-cleared storage plans with no problem');
  return RO.run(p, io);
}
for (let k = 0; k < 5; k++) {
  for (const mode of ['fail', 'keep']) {
    const s = memStorage(LOCAL, mode === 'fail' ? { failChangeAt: k } : { keepChangeAt: k });
    await startRun(s);
    const io = fakeIo(s);
    const res = await RO.run(await planOf(s), io);
    eq([res.done, res.removed], [false, k], `${mode} at change ${k}: stops with ${k} done`);
    const r = RO.resume(s);
    eq(r && [r.state, r.doneSteps, r.totalSteps], ['clearing', k, STEPS], `${mode} at change ${k}: the journal says clearing, ${k} of ${STEPS}`);
    const finish = await finishFrom(s, io);
    ok(finish.done, `${mode} at change ${k}: finishing completes`);
    eq(s.snapshot(), EXPECTED, `${mode} at change ${k}: finishing gives the uninterrupted result`);
    eq(RO.getRun(s, A.id).done, STEPS, `${mode} at change ${k}: the journal counts every step once`);
  }
}
for (const which of ['media', 'share']) {
  const s = memStorage(LOCAL);
  await startRun(s);
  const io = fakeIo(s, which === 'media' ? { mediaFails: true } : { shareFails: true });
  const res = await RO.run(await planOf(s), io);
  eq([res.done, res.failed], [false, which === 'media' ? 'media:seating' : 'share'], `${which}: a clear that fails stops the run there`);
  const io2 = fakeIo(s);
  if (which === 'share') io2.photos = [];
  const finish = await finishFrom(s, io2);
  ok(finish.done, `${which}: finishing completes`);
  eq(s.snapshot(), EXPECTED, `${which}: and gives the uninterrupted result`);
}
/* The journal refusing a write (a full disk) at step k stops the run there
   too, and never claims a step the storage does not show. */
for (let k = 1; k <= STEPS + 1; k++) {
  const s = memStorage(LOCAL, { failJournalAt: k });
  await startRun(s);   // journal write 0
  const io = fakeIo(s);
  const res = await RO.run(await planOf(s), io);
  ok(!res.done, `journal refused at write ${k}: the run stops`);
  const j = RO.getRun(s, A.id);
  const changed = Object.keys(LOCAL).filter(key => s.getItem(key) !== LOCAL[key]).length + (io.photos.length ? 0 : 1) + (io.shared ? 0 : 1);
  ok((j.done || 0) <= changed, `journal refused at write ${k}: the journal claims ${j.done || 0}, storage shows ${changed}`);
  const finish = await finishFrom(s, io);
  ok(finish.done, `journal refused at write ${k}: finishing completes`);
  eq(s.snapshot(), EXPECTED, `journal refused at write ${k}: and gives the uninterrupted result`);
}
/* A Keep choice survives an interruption: the journal names the key (and
   nothing else), and finishing with resume()'s choices keeps it. */
{
  const s = memStorage(LOCAL, { failChangeAt: 1 });
  await startRun(s);
  const choices = { np_prompts: 'keep' };
  await RO.run(await planOf(s, { choices }), fakeIo(s));
  const r = RO.resume(s);
  eq(r.choices, choices, 'interrupted: resume() gives back the Keep choice');
  ok(!s.getItem('br_rollover_v1').includes('Pair and share'), 'interrupted: ...as a key name, with no value');
  const finish = await RO.run(await planOf(s, { choices: r.choices }), fakeIo(s));
  ok(finish.done && s.getItem('np_prompts') === LOCAL.np_prompts, 'interrupted: finishing keeps what the teacher chose to keep');
}
/* The indexes are planned against what the steps before them leave. */
{
  const local = {
    'gvb-bracket:list': JSON.stringify(['Spelling', 'Gone']), 'gvb-bracket:current': 'Spelling',
    'gvb-bracket:data:Spelling': JSON.stringify({ name: 'Spelling', slots: [['Avery Stone']] }),
    'gtg:list': JSON.stringify(['P3', 'Old']), 'gtg:data:P3': JSON.stringify({ name: 'P3', names: 'Avery Stone' }), 'gtg:current': 'P3',
  };
  const p = await RO.plan('ro-ix', local, local, { studentKeys: Object.keys(local) });
  const after = Object.fromEntries(p.items.filter(i => i.action === 'write').map(i => [i.key, i.after]));
  eq(after['gvb-bracket:list'], '[]', 'index: a bracket list drops the bracket that goes and the one already gone');
  eq(p.items.find(i => i.key === 'gvb-bracket:current').action, 'delete', 'index: the open bracket, which is gone, is forgotten');
  eq(after['gtg:list'], '["P3"]', 'index: a class list keeps the reduced class and drops a dangling entry');
  ok(!p.items.some(i => i.key === 'gtg:current'), 'index: the open class, still there, is not touched');
  eq(p.items[p.items.length - 1].phase, 6, 'index: the indexes are the last steps');
}

/* ── the journal keeps three runs ─────────────────────────────────────── */
{
  const s = memStorage();
  for (let i = 1; i <= 5; i++) RO.recordRun(s, { id: 'ro-' + i, state: 'done' });
  eq(RO.readJournal(s).runs.map(r => r.id), ['ro-3', 'ro-4', 'ro-5'], 'journal: the last three runs');
  s.setItem('br_rollover_v1', '{not json');
  eq(RO.readJournal(s).runs, [], 'journal: an unreadable journal reads as empty, not a throw');
}

/* ── the other tabs (increment 3): the CLIENTS question and the names ── */
{
  const reply = (clients, type = 'CLIENTS') => ({ postMessage(msg, ports) {
    if (msg && msg.type === 'CLIENTS' && ports && ports[0]) ports[0].postMessage({ type, clients });
  } });
  const silent = { postMessage() {} };
  const T = { timeoutMs: 80, MessageChannel };
  eq(await RO.otherTabs(null, T), { seen: false, urls: [] }, 'tabs: no service worker container is "cannot see", never "none open"');
  eq(await RO.otherTabs({ controller: reply([{ url: 'http://x/Tools/a.html' }]) }, T), { seen: true, urls: ['http://x/Tools/a.html'] },
    'tabs: the controlling worker answers with the other windows');
  eq(await RO.otherTabs({ controller: reply([]) }, T), { seen: true, urls: [] }, 'tabs: an answer with no window is "none open"');
  eq(await RO.otherTabs({ controller: null, ready: Promise.resolve({ active: reply([{ url: 'http://x/index.html' }]) }) }, T),
    { seen: true, urls: ['http://x/index.html'] }, 'tabs: an uncontrolled page (a hard reload) asks the active worker');
  eq(await RO.otherTabs({ controller: silent }, T), { seen: false, urls: [] }, 'tabs: a worker from before v302 never answers, and that is "cannot see"');
  eq(await RO.otherTabs({ controller: reply([], 'PRECACHE_PROGRESS') }, T), { seen: false, urls: [] }, 'tabs: another message on the port is not an answer');
  eq(await RO.otherTabs({ controller: reply('nope') }, T), { seen: false, urls: [] }, 'tabs: an answer without a list is not an answer');
  eq(await RO.otherTabs({ controller: null, ready: Promise.reject(new Error('blocked')) }, T), { seen: false, urls: [] }, 'tabs: a refused registration is "cannot see"');
  eq(await RO.otherTabs({ controller: null, ready: Promise.resolve({ active: null }) }, T), { seen: false, urls: [] }, 'tabs: no active worker is "cannot see"');
  eq(await RO.otherTabs({ controller: null, ready: new Promise(() => {}) }, T), { seen: false, urls: [] }, 'tabs: a registration that never settles times out as "cannot see"');

  const root = 'https://aspermylessonplan.com/';
  const tools = window.ToolRegistry.tools;
  const named = RO.nameTabs([
    root + 'Tools/007-Name%20Picker.html',
    root + 'Tools/007-Name%20Picker.html?roster=1#top',
    root + 'Tools/009-backup-restore.html',
    root,
    root + 'index.html',
    root + 'Tools/old-page.html',
  ], root, tools);
  eq(named, [
    { title: 'Backup & Restore', count: 1 },
    { title: 'Name Picker', count: 2 },
    { title: 'The landing page', count: 2 },
    { title: 'Tools/old-page.html', count: 1 },
  ], 'tabs: windows named by the registry, counted per page, query and hash ignored, an unknown page by its path');
  eq(RO.nameTabs([], root, tools), [], 'tabs: no window, no row');
  const sub = RO.nameTabs(['http://127.0.0.1:8534/site/Tools/007-Name%20Picker.html'], 'http://127.0.0.1:8534/site/', tools);
  eq(sub, [{ title: 'Name Picker', count: 1 }], 'tabs: a site served under a folder is named from its own root');
  ok(tools.every(t => !t.file || RO.nameTabs([root + t.file], root, tools)[0].title === t.title), 'tabs: every registry page is named by its own title');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
