// providers.test.mjs — the sections 090 Packet Builder starts with (Path 10 P1 step 3):
// each provider against saved-state fixtures (nothing, broken, whole), what it prints, and the
// registry contract: the keys the providers read are 090's `reads` in _shared/tool-registry.js, each
// is a key its source tool's row declares, and each source tool is a page that exists.
// Then the same checks against deliberate breaks of providers.js (MUTANTS): each must turn a check red.
//
//   node Tools/packet-builder/test/providers.test.mjs   (or: npm run test:packet-providers)
//
// Pure: the three scripts run in a vm context, and nothing reads storage or the clock.

if (!process.env.TZ) process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const rd = f => fs.readFileSync(path.join(site, f), 'utf8');
const SECTIONS = rd('Tools/packet-builder/sections.js');
const PROVIDERS = rd('Tools/packet-builder/providers.js');
const SCHOOLDAY = rd('_shared/school-day.js');
const REGISTRY = rd('_shared/tool-registry.js');

function load(providersSrc) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(SECTIONS, ctx);
  vm.runInContext(SCHOOLDAY, ctx);
  vm.runInContext(providersSrc, ctx);
  return ctx.window;
}
function loadRegistry() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(REGISTRY, ctx);
  return ctx.window.ToolRegistry;
}

const STANDING = {
  teacherName: 'Ms. Example', roomNumber: '214', rosterLocation: 'Blue folder', periods: [{ label: '1', time: '8:00-8:50' }],
  fireRoute: 'East door', lockdownProcedure: 'Lights off', medicalAlerts: 'None', phoneNurse: '555-0100', behaviorCustom: 'Be kind.'
};
const HALL = { sets: { 'Period 1': { destinations: [{ label: 'Restroom', overtimeMin: 5, requiresNote: false }, { label: 'Office', overtimeMin: 10, requiresNote: true }], oneOutAtATime: true, weeklyBudget: 4 } } };
const CAL = {
  __v: 2, meta: { start: '2026-08-17', end: '2027-06-04', yearLabel: '2026-27' },
  dayTypes: [{ id: 'nosc', label: 'No school', noSchool: true }, { id: 'half', label: 'Half day', half: true }],
  days: { '2026-10-30': { types: ['nosc'], label: 'Staff day' }, '2026-11-04': { types: ['half'] } }
};
const ROSTERS = { 'Period 1': ['Ann Lee', 'Bo Ray', ''], 'Period 2': ['Cy Day'], 'Bad': 'x' };
const RECORDS = { version: 1, rosters: { 'Period 1': { students: [{ name: 'Ann Lee', preferred: 'Annie' }, { name: 'Bo Ray', preferred: '' }] } } };

const plain = v => JSON.parse(JSON.stringify(v));
const ctxOf = (W, data) => ({ read: k => (k in data ? plain(data[k]) : undefined), todayISO: '2026-10-29', SchoolDay: W.SchoolDay });

function checks(W, REG) {
  const PS = W.PacketSections;
  const out = [];
  const t = (name, fn) => { let ok = false, msg = ''; try { ok = fn() === true; } catch (e) { msg = e.message; } out.push({ name, ok, msg }); };
  const html = (id, data) => { const b = PS.build([id], ctxOf(W, data)); return PS.toHtml(b.sections); };
  const ev = (id, data) => PS.evaluate(ctxOf(W, data)).find(e => e.id === id);

  t('the five sections are registered, in this order', () => PS.ids().join() === 'sub-plan,emergency-info,hall-pass-log,school-calendar,class-rosters');
  t('nothing saved: every section is unavailable', () => PS.evaluate(ctxOf(W, {})).every(e => !e.available && e.status.length > 0));
  t('a broken value reads as nothing saved', () => PS.evaluate(ctxOf(W, {
    'subPlanBuilder.standingDetails.v1': 'x', 'hall-pass-log-sections': [], 'scv_calendar_v1': { meta: 1 }, 'np_rosters': 7, 'crh_students_v1': 'x'
  })).every(e => !e.available));

  // the registry contract
  const reads = new Set(REG.bySlug('packet-builder').reads);
  const keys = new Set(PS.storageKeys());
  t("the providers' keys are exactly packet-builder's `reads` in the tool registry", () => [...keys].sort().join() === [...reads].sort().join());
  t("each provider's keys are declared by its source tool's row", () => PS.list().every(p => {
    const row = REG.bySlug(p.sourceSlug);
    if (!row) return false;
    const have = new Set([].concat((row.keys || []).map(k => k.k), row.writes || [], row.reads || []));
    return p.storageKeys.every(k => have.has(k));
  }));
  t("each provider's source tool is a page that exists", () => PS.list().every(p => {
    const row = REG.bySlug(p.sourceSlug);
    return !!row && fs.existsSync(path.join(site, decodeURIComponent(row.file)));
  }));
  t('every provider has a setup hint', () => PS.list().every(p => p.setupHint.length > 10));
  t("the layout and presets keys are declared on packet-builder's row", () => {
    const k = REG.bySlug('packet-builder').keys.map(x => x.k);
    return k.includes(PS.LAYOUT_KEY) && k.includes(PS.PRESETS_KEY);
  });
  t("packet-builder's layout and presets are not student data", () => REG.bySlug('packet-builder').keys.every(k => !k.student));

  // sub plan and emergency
  t('sub plan: whole details are available and print the fields', () => {
    const d = { 'subPlanBuilder.standingDetails.v1': STANDING };
    const h = html('sub-plan', d);
    return ev('sub-plan', d).available && h.includes('Ms. Example') && h.includes('214') && h.includes('8:00-8:50') && h.includes('Be kind.') && h.includes('555-0100');
  });
  t('sub plan: empty details are unavailable, not a blank page', () => !ev('sub-plan', { 'subPlanBuilder.standingDetails.v1': {} }).available);
  t('sub plan: a blank field is left out', () => !html('sub-plan', { 'subPlanBuilder.standingDetails.v1': { teacherName: 'X', roomNumber: '  ' } }).includes('Room'));
  t('emergency: fire route, lockdown and medical alerts print', () => {
    const h = html('emergency-info', { 'subPlanBuilder.standingDetails.v1': STANDING });
    return h.includes('East door') && h.includes('Lights off') && h.includes('None') && !h.includes('Ms. Example');
  });
  t('emergency: details with no emergency fields are unavailable', () => !ev('emergency-info', { 'subPlanBuilder.standingDetails.v1': { teacherName: 'X' } }).available);

  // hall pass
  t('hall pass: destinations, limits and rules print', () => {
    const h = html('hall-pass-log', { 'hall-pass-log-sections': HALL });
    return h.includes('Restroom') && h.includes('5 min') && h.includes('Yes') && h.includes('Only one student out') && h.includes('Weekly pass budget: 4');
  });
  t('hall pass: a section name shows only with more than one', () => {
    const two = { sets: { A: HALL.sets['Period 1'], B: HALL.sets['Period 1'] } };
    return html('hall-pass-log', { 'hall-pass-log-sections': two }).includes('<h3 class="pb-h">A</h3>') && !html('hall-pass-log', { 'hall-pass-log-sections': HALL }).includes('Period 1');
  });
  t('hall pass: the pass log itself is never read', () => PS.list().find(p => p.id === 'hall-pass-log').storageKeys.join() === 'hall-pass-log-sections');
  t('hall pass: no sections is unavailable', () => !ev('hall-pass-log', { 'hall-pass-log-sections': { sets: {} } }).available);

  // calendar
  t('calendar: needs the calendar and SchoolDay', () => ev('school-calendar', { scv_calendar_v1: CAL }).available && !PS.build(['school-calendar'], { read: k => (k === 'scv_calendar_v1' ? CAL : undefined), todayISO: '2026-10-29', SchoolDay: null }).sections.length);
  t('calendar: today is described by SchoolDay', () => html('school-calendar', { scv_calendar_v1: CAL }).includes('2026-10-29: A school day'));
  t('calendar: a no-school day and a half day in the next four weeks are listed, an ordinary one is not', () => {
    const h = html('school-calendar', { scv_calendar_v1: CAL });
    return h.includes('2026-10-30') && h.includes('Staff day') && h.includes('2026-11-04') && h.includes('Half day') && !h.includes('2026-11-02');
  });
  t('calendar: a day three weeks ahead is listed', () => html('school-calendar', { scv_calendar_v1: { ...CAL, days: { ...CAL.days, '2026-11-19': { types: ['nosc'] } } } }).includes('2026-11-19'));
  t('calendar: a day past four weeks is not listed', () => !html('school-calendar', { scv_calendar_v1: { ...CAL, days: { ...CAL.days, '2026-12-01': { types: ['nosc'] } } } }).includes('2026-12-01'));
  t('calendar: the status names the year', () => ev('school-calendar', { scv_calendar_v1: CAL }).status.includes('2026-27'));

  // rosters
  t('rosters: one page per class, preferred names win, blanks go', () => {
    const b = PS.build(['class-rosters'], ctxOf(W, { np_rosters: ROSTERS, crh_students_v1: RECORDS }));
    const pages = b.sections[0].pages;
    const h = PS.toHtml(b.sections);
    return pages.length === 2 && h.includes('Annie') && !h.includes('Ann Lee') && h.includes('Bo Ray') && h.includes('Cy Day') && !h.includes('Bad');
  });
  t('rosters: a class of 90 runs over three pages and numbers straight through', () => {
    const big = { C: Array.from({ length: 90 }, (_, i) => 'S' + i) };
    const pages = PS.build(['class-rosters'], ctxOf(W, { np_rosters: big })).sections[0].pages;
    return pages.length === 3 && pages[2].blocks[0].rows[0][0] === '81' && pages[0].title === 'C (1)';
  });
  t('rosters: works without the preferred-name sidecar', () => html('class-rosters', { np_rosters: ROSTERS }).includes('Ann Lee'));
  t('rosters: all-empty rosters are unavailable', () => !ev('class-rosters', { np_rosters: { A: [], B: ['  '] } }).available);

  // text, never markup
  t('a saved field with markup is printed as text', () => {
    const bad = '<img src=x onerror=1>';
    const d = { 'subPlanBuilder.standingDetails.v1': { ...STANDING, teacherName: bad }, 'hall-pass-log-sections': { sets: { A: { destinations: [{ label: bad }] } } }, np_rosters: { [bad]: [bad] } };
    return ['sub-plan', 'hall-pass-log', 'class-rosters'].every(id => !/<img/i.test(html(id, d)));
  });
  return out;
}

const MUTANTS = [
  ['sub plan ignores a blank field check', s => s.replace("return pairs.filter(function (p) { return has(p[1]); })", 'return pairs')],
  ['emergency leaves out the lockdown line', s => s.replace("['Lockdown', s.lockdownProcedure], ", '')],
  ['hall pass reads the whole pass log', s => s.replace("storageKeys: [HALL_KEY],", "storageKeys: [HALL_KEY, 'hall-pass-log-log'],")],
  ['hall pass drops the time limit', s => s.replace("d.overtimeMin ? d.overtimeMin + ' min' : ''", "''")],
  ['hall pass shows the name always', s => s.replace('if (sets.length > 1) blocks.push', 'if (true) blocks.push')],
  ['calendar skips the SchoolDay check', s => s.replace('return ctx.SchoolDay && ctx.SchoolDay.isCalendar(cal) ? cal : null;', 'return cal || null;')],
  ['calendar looks 7 days ahead, not 28', s => s.replace('var AHEAD_DAYS = 28;', 'var AHEAD_DAYS = 7;')],
  ['calendar lists ordinary days too', s => s.replace("if (words !== 'A school day' && words !== (day.letter ? day.letter + ' day' : '')) rows.push", 'rows.push')],
  ['rosters ignore preferred names', s => s.replace("pref[x.trim().toLowerCase()] || x.trim()", 'x.trim()')],
  ['rosters keep blank names', s => s.replace("raw[n].filter(has).map", 'raw[n].map')],
  ['rosters never split a page', s => s.replace('var PER_PAGE = 40;', 'var PER_PAGE = 4000;')],
  ['rosters number each page from 1', s => s.replace('String(i + k + 1)', 'String(k + 1)')],
  ['rosters drop a bad entry badly', s => s.replace("filter(function (n) { return Array.isArray(raw[n]); })", 'filter(function () { return true; })')],
  ['a provider is registered twice', s => s.replace("id: 'class-rosters',", "id: 'sub-plan',")],
  ['sub plan needs no details at all', s => s.replace("if (!standingBlocks(s).length) return { available: false, status: 'Standing details exist but are empty.' };", '')]
];

const REG = loadRegistry();
let failed = 0;
const base = checks(load(PROVIDERS), REG);
for (const c of base) if (!c.ok) { failed++; console.log('FAIL ' + c.name + (c.msg ? ' -- ' + c.msg : '')); }
console.log(`${base.length - failed}/${base.length} checks pass on providers.js`);

let survived = 0;
for (const [name, mutate] of MUTANTS) {
  const src = mutate(PROVIDERS);
  if (src === PROVIDERS) { survived++; console.log('FAIL mutant "' + name + '" did not change the source (its pattern is stale)'); continue; }
  let red = false;
  try { red = checks(load(src), REG).some(c => !c.ok); } catch (e) { red = true; }
  if (!red) { survived++; console.log('FAIL mutant survived: ' + name); }
}
console.log(`${MUTANTS.length - survived}/${MUTANTS.length} deliberate breaks caught`);
if (failed || survived) process.exit(1);
console.log('PASS providers.js');
