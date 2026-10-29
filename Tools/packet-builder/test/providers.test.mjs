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
const SEATREAD = rd('_shared/seating-read.js');
const REGISTRY = rd('_shared/tool-registry.js');

function load(providersSrc) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(SECTIONS, ctx);
  vm.runInContext(SCHOOLDAY, ctx);
  vm.runInContext(SEATREAD, ctx);
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

const CHART = {
  active: 's1', mirror: false, numbered: true,
  sections: [
    { id: 's1', name: 'Period 1', students: [{ id: 'a', name: 'Ann Lee', note: 'SECRET NOTE', flag: 'x' }, { id: 'b', name: 'Bo Ray' }],
      desks: [{ id: 'd1', x: 100, y: 100, rot: 0 }, { id: 'd2', x: 300, y: 100, rot: 0 }, { id: 'd3', x: 500, y: 100, rot: 90 }], assign: { d1: 'a', d2: 'b' } },
    { id: 's2', name: 'Empty room', students: [], desks: [], assign: {} },
    { id: 's3', name: 'Period 3', students: [], desks: [{ id: 'e1', x: 0, y: 0, rot: 0 }], assign: {} }
  ]
};

const BEHAVIOR = { sets: { 'Period 1': { tags: [{ label: 'On task', delta: 1 }, { label: 'Calling out', delta: -1 }] } } };
const PROMPTS = Array.from({ length: 14 }, (_, i) => ({ text: 'Prompt ' + (i + 1) }));
const LAST = { dates: ['2026-10-29', '2026-10-30'] };
const HISTORY = [{ date: '2026-10-29', lessonTitle: 'Fall of Rome', overviewText: 'Watch the video', scheduleText: '', materialsNote: 'Worksheet A' }, { date: '2026-10-30', lessonTitle: '', overviewText: '' }, { date: '2026-09-01', lessonTitle: 'Old' }];

const SLIP = { v: 2, currentId: 'b', sets: [{ id: 'a', name: 'General', prompts: [{ id: '1', text: 'What worked?' }] }, { id: 'b', name: 'Lab day', prompts: [{ id: '2', text: 'Did the lab run?' }, { id: '3', text: '  ' }, { id: '4', text: 'Who stayed late?' }] }] };

const plain = v => JSON.parse(JSON.stringify(v));
const ctxOf = (W, data) => ({ read: k => (k in data ? plain(data[k]) : undefined), todayISO: '2026-10-29', SchoolDay: W.SchoolDay, SeatingRead: W.SeatingRead });

function checks(W, REG) {
  const PS = W.PacketSections;
  const out = [];
  const t = (name, fn) => { let ok = false, msg = ''; try { ok = fn() === true; } catch (e) { msg = e.message; } out.push({ name, ok, msg }); };
  const html = (id, data) => { const b = PS.build([id], ctxOf(W, data)); return PS.toHtml(b.sections); };
  const ev = (id, data) => PS.evaluate(ctxOf(W, data)).find(e => e.id === id);

  t('the ten sections are registered, in this order', () => PS.ids().join() === 'sub-plan,emergency-info,hall-pass-log,school-calendar,class-rosters,seating,behavior-plan,exit-ticket,sub-plan-days,sub-feedback');
  t('nothing saved: every section is unavailable', () => PS.evaluate(ctxOf(W, {})).every(e => !e.available && e.status.length > 0));
  t('a broken value reads as nothing saved', () => PS.evaluate(ctxOf(W, {
    'subPlanBuilder.standingDetails.v1': 'x', 'hall-pass-log-sections': [], 'scv_calendar_v1': { meta: 1 }, 'np_rosters': 7, 'crh_students_v1': 'x',
    'behavior-points-tracker-sections': 'x', 'gvb-exit-ticket:customPrompts': 7, 'subPlanBuilder.lastAbsence.v1': 'x', 'subPlanBuilder.history.v1': 'x', 'seating-chart-v1': 'x', snfs_slip_v1: 'x'
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

  // seating
  t('seating: a chart with desks is available and the status counts classes with desks', () => { const e = ev('seating', { 'seating-chart-v1': CHART }); return e.available && e.status.includes('2 classes'); });
  t('seating: no chart, no sections and a broken chart are unavailable', () => [undefined, {}, { sections: [] }, { sections: [{ desks: [] }] }, 'x', { sections: 4 }].every(v => !ev('seating', v === undefined ? {} : { 'seating-chart-v1': v }).available));
  t('seating: without the reader the section is unavailable', () => !PS.evaluate({ read: k => (k === 'seating-chart-v1' ? plain(CHART) : undefined), todayISO: '2026-10-29' }).find(e => e.id === 'seating').available);
  t('seating: one page per class that has a desk, named for the class', () => {
    const pages = PS.build(['seating'], ctxOf(W, { 'seating-chart-v1': CHART })).sections[0].pages;
    return pages.length === 2 && pages[0].title === 'Seating: Period 1' && pages[1].title === 'Seating: Period 3';
  });
  t('seating: the page draws every desk, the seated names and FRONT OF ROOM', () => {
    const h = html('seating', { 'seating-chart-v1': CHART });
    return (h.match(/<rect [^>]*rx="6"/g) || []).length === 4 && h.includes('>Ann Lee<') && h.includes('>Bo Ray<') && h.includes('FRONT OF ROOM') && h.includes('viewBox="');
  });
  t('seating: a turned desk is rotated about its centre', () => html('seating', { 'seating-chart-v1': CHART }).includes('rotate(90 553 135)'));
  t('seating: the count line says how many are seated', () => html('seating', { 'seating-chart-v1': CHART }).includes('2 of 2 students seated'));
  t("seating: a student's note and flag are never printed", () => !/SECRET NOTE/.test(html('seating', { 'seating-chart-v1': CHART })));
  t('seating: numbered desks show their number, unnumbered do not', () => {
    const off = html('seating', { 'seating-chart-v1': { ...CHART, numbered: false } });
    return html('seating', { 'seating-chart-v1': CHART }).includes('font-size="11">3<') && !off.includes('font-size="11">3<');
  });
  t('seating: mirroring moves Ann (left) to the right of Bo', () => {
    const xOf = (h, n) => +h.match(new RegExp('<text x="([\\d.]+)"[^>]*>' + n + '<'))[1];
    const at = h => xOf(h, 'Ann Lee') < xOf(h, 'Bo Ray');
    return at(html('seating', { 'seating-chart-v1': CHART })) && !at(html('seating', { 'seating-chart-v1': { ...CHART, mirror: true } }));
  });
  t('seating: a long name is made smaller, not cut', () => {
    const long = { ...CHART, sections: [{ ...CHART.sections[0], students: [{ id: 'a', name: 'Maximiliano Bartholomew Smith' }], assign: { d1: 'a' } }] };
    const h = html('seating', { 'seating-chart-v1': long });
    const m = h.match(/font-size="(\d+)">Maximiliano/);
    return !!m && +m[1] < 15 && +m[1] >= 8;
  });
  t('seating: a name with markup is text, in the drawing too', () => {
    const bad = { ...CHART, sections: [{ ...CHART.sections[0], name: '<b>x</b>', students: [{ id: 'a', name: '<img src=x onerror=1>' }] }] };
    return !/<img|<b>/i.test(html('seating', { 'seating-chart-v1': bad }));
  });
  t('seating: the drawing is ink-safe (black on white, no colour)', () => !/#[0-9a-f]{3,6}/i.test(html('seating', { 'seating-chart-v1': CHART }).replace(/#(000|fff)\b/gi, '')));

  // behavior plan
  t('behavior: the chip list prints with signed points', () => {
    const h = html('behavior-plan', { 'behavior-points-tracker-sections': BEHAVIOR });
    return h.includes('On task') && h.includes('+1') && h.includes('Calling out') && h.includes('>-1<');
  });
  t('behavior: no sections is unavailable; two sections name themselves', () => {
    const two = { sets: { A: BEHAVIOR.sets['Period 1'], B: BEHAVIOR.sets['Period 1'] } };
    return !ev('behavior-plan', { 'behavior-points-tracker-sections': { sets: {} } }).available && html('behavior-plan', { 'behavior-points-tracker-sections': two }).includes('<h3 class="pb-h">A</h3>');
  });
  t('behavior: a section with no behaviors says so', () => html('behavior-plan', { 'behavior-points-tracker-sections': { sets: { A: { tags: [] } } } }).includes('No behaviors configured.'));

  // exit ticket prompts
  t('exit ticket: the first twelve prompts print and the rest do not', () => {
    const h = html('exit-ticket', { 'gvb-exit-ticket:customPrompts': PROMPTS });
    return h.includes('Prompt 12<') && !h.includes('Prompt 13') && h.includes('does not remember which');
  });
  t('exit ticket: blank prompts do not count', () => !ev('exit-ticket', { 'gvb-exit-ticket:customPrompts': [{ text: ' ' }] }).available && !ev('exit-ticket', { 'gvb-exit-ticket:customPrompts': [{}] }).available && ev('exit-ticket', { 'gvb-exit-ticket:customPrompts': [{ text: 'x' }] }).status.includes('1 custom prompt)'));

  // lessons for the last absence
  t('lessons: one page per absence day that has a plan with something in it', () => {
    const b = PS.build(['sub-plan-days'], ctxOf(W, { 'subPlanBuilder.lastAbsence.v1': LAST, 'subPlanBuilder.history.v1': HISTORY }));
    const h = PS.toHtml(b.sections);
    return b.sections[0].pages.length === 1 && h.includes('Lesson: 2026-10-29') && h.includes('Fall of Rome') && h.includes('Worksheet A') && !h.includes('Old');
  });
  t('lessons: no absence, or no plan for its days, is unavailable', () =>
    !ev('sub-plan-days', { 'subPlanBuilder.history.v1': HISTORY }).available && !ev('sub-plan-days', { 'subPlanBuilder.lastAbsence.v1': { dates: ['2027-01-01'] }, 'subPlanBuilder.history.v1': HISTORY }).available);
  t('lessons: the status counts days with a plan', () => ev('sub-plan-days', { 'subPlanBuilder.lastAbsence.v1': LAST, 'subPlanBuilder.history.v1': HISTORY }).status.includes('1 of 2 days'));

  // the substitute's feedback page
  t('feedback: the slip in use supplies the questions, blanks skipped', () => {
    const f = PS.load('sub-feedback', ctxOf(W, { snfs_slip_v1: SLIP }));
    return f.name === 'Lab day' && f.prompts.join('|') === 'Did the lab run?|Who stayed late?';
  });
  t('feedback: an unknown currentId falls back to the first slip', () => PS.load('sub-feedback', ctxOf(W, { snfs_slip_v1: { ...SLIP, currentId: 'zz' } })).name === 'General');
  t('feedback: the older bare slip is read', () => PS.load('sub-feedback', ctxOf(W, { snfs_slip_v1: { prompts: [{ text: 'Old?' }, 'plain'] } })).prompts.join() === 'Old?,plain');
  t('feedback: nothing saved, no questions or a broken slip is unavailable', () => [undefined, { v: 2, sets: [] }, { v: 2, sets: [{ id: 'a', prompts: [{ text: ' ' }] }] }, { prompts: [] }, { v: 2, sets: 'x' }, 'x'].every(v => !ev('sub-feedback', v === undefined ? {} : { snfs_slip_v1: v }).available));
  t('feedback: at most twelve questions of at most 200 characters', () => {
    const many = { prompts: Array.from({ length: 20 }, (_, i) => ({ text: i === 0 ? 'x'.repeat(300) : 'q' + i })) };
    const f = PS.load('sub-feedback', ctxOf(W, { snfs_slip_v1: many }));
    return f.prompts.length === 12 && f.prompts[0].length === 200;
  });
  t('feedback: the page prints each question over a write-in box, as text', () => {
    const h = html('sub-feedback', { snfs_slip_v1: { prompts: [{ text: '<img src=x onerror=1>' }, { text: 'Fine?' }] } });
    return (h.match(/class="pb-fb-box"/g) || []).length === 2 && h.includes('Fine?') && !/<img/i.test(h) && h.includes('How did today go?');
  });
  t('feedback: status counts the questions', () => ev('sub-feedback', { snfs_slip_v1: SLIP }).status.includes('2 questions'));

  // load(): what 045 prints from
  t('load: each provider with a load returns the saved data, or null for nothing or a broken value', () => {
    const none = ctxOf(W, {}), bad = ctxOf(W, { 'subPlanBuilder.standingDetails.v1': 'x', 'hall-pass-log-sections': [], 'seating-chart-v1': { sections: 4 }, 'behavior-points-tracker-sections': { sets: 3 }, scv_calendar_v1: { meta: 1 } });
    const ids = ['sub-plan', 'emergency-info', 'hall-pass-log', 'school-calendar', 'seating', 'behavior-plan'];
    return ids.every(id => PS.load(id, none) === null && PS.load(id, bad) === null);
  });
  t('load: whole values come back as saved', () => {
    const c = ctxOf(W, { 'subPlanBuilder.standingDetails.v1': STANDING, 'hall-pass-log-sections': HALL, 'seating-chart-v1': CHART, 'behavior-points-tracker-sections': BEHAVIOR, scv_calendar_v1: CAL, 'gvb-exit-ticket:customPrompts': PROMPTS, 'subPlanBuilder.lastAbsence.v1': LAST, 'subPlanBuilder.history.v1': HISTORY });
    return PS.load('sub-plan', c).teacherName === 'Ms. Example' && PS.load('hall-pass-log', c).sets['Period 1'].weeklyBudget === 4 && PS.load('seating', c).sections.length === 3 &&
      PS.load('behavior-plan', c).sets['Period 1'].tags.length === 2 && PS.load('school-calendar', c).meta.yearLabel === '2026-27' && PS.load('exit-ticket', c).length === 14 &&
      PS.load('sub-plan-days', c).dates.length === 2 && PS.load('sub-plan-days', c).history.length === 3;
  });
  t('load: an empty seating list is still a chart (045 says "no chart" for it itself)', () => PS.load('seating', ctxOf(W, { 'seating-chart-v1': { sections: [] } })).sections.length === 0);
  t('load: the absence has no dates when the key is missing, empty or broken', () =>
    [undefined, { dates: [] }, { dates: 'x' }, 'x'].every(v => PS.load('sub-plan-days', ctxOf(W, v === undefined ? {} : { 'subPlanBuilder.lastAbsence.v1': v })).dates === null));
  t('load: a prompts bank that is not a list is an empty list', () => PS.load('exit-ticket', ctxOf(W, { 'gvb-exit-ticket:customPrompts': 7 })).length === 0);

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
  ['seating prints a student note', s => s.replace("deskText(d.student ? d.student.name : '', d.x, d.y)", "deskText(d.student ? d.student.name + ' ' + d.student.note : '', d.x, d.y)")],
  ['seating draws no desk numbers', s => s.replace('(numbered ?', '(false ?')],
  ['seating ignores the mirror flag', s => s.replace('chart.mirror === true', 'false')],
  ['seating does not escape a name', s => s.replace("PS.esc(shown)", 'shown')],
  ['seating does not escape the class name', s => s.replace("PS.esc('Seating chart, ' + title)", "'Seating chart, ' + title")],
  ['seating never shrinks a name', s => s.replace('Math.min(NAME_PX, Math.floor((DESK_W - 8) / (shown.length * 0.56)))', 'NAME_PX')],
  ['seating keeps classes with no desks', s => s.replace('Array.isArray(s.desks) && s.desks.length;', 'true;')],
  ['seating drops the turn of a desk', s => s.replace("rotate(' + num(d.rot)", "rotate(' + 0")],
  ['seating reads the reader-less chart as available', s => s.replace("if (!ctx.SeatingRead) return { available: false, status: 'The seating reader did not load.' };", '')],
  ['behavior drops the plus sign', s => s.replace("(t.delta > 0 ? '+' : '') + t.delta", 't.delta')],
  ['behavior reads the tracker\'s points too', s => s.replace('storageKeys: [BEHAVIOR_KEY],', "storageKeys: [BEHAVIOR_KEY, 'behavior-points-tracker-points'],")],
  ['exit ticket shows every prompt', s => s.replace('.slice(0, PROMPTS_SHOWN)', '')],
  ['exit ticket counts blank prompts', s => s.replace("filter(function (p) { return isObj(p) && has(p.text); })", 'filter(function (p) { return true; })')],
  ['lessons include a day with an empty plan', s => s.replace('return h && (has(h.lessonTitle) || has(h.overviewText) || has(h.scheduleText) || has(h.materialsNote));', 'return !!h;')],
  ['lessons include days outside the absence', s => s.replace('return (a.dates || []).map', 'return (a.dates || [""]).concat(a.history.map(function (x) { return x && x.date; })).map')],
  ['absence keeps an empty date list', s => s.replace('Array.isArray(last.dates) && last.dates.length ? last.dates : null', 'Array.isArray(last.dates) ? last.dates : null')],
  ['seating load demands a section to exist', s => s.replace('isObj(c) && Array.isArray(c.sections) ? c : null; },', 'isObj(c) && Array.isArray(c.sections) && c.sections.length ? c : null; },')],
  ['hall pass load returns the raw value', s => s.replace('return isObj(raw) && isObj(raw.sets) ? raw : null; },', 'return raw || null; },')],
  ['calendar load skips the SchoolDay check', s => s.replace('load: calendar,', 'load: function (ctx) { return ctx.read(CAL_KEY) || null; },')],
  ['standing load returns anything', s => s.replace('load: standing,\n    evaluate: function (ctx) {\n      var s = standing(ctx);\n      if (!s) return { available: false, status: \'No standing details saved yet.\' };\n      if (!standingBlocks', "load: function (ctx) { return ctx.read(STANDING_KEY) || null; },\n    evaluate: function (ctx) {\n      var s = standing(ctx);\n      if (!s) return { available: false, status: 'No standing details saved yet.' };\n      if (!standingBlocks")],
  ['feedback keeps blank questions', s => s.replace('.filter(has)\n      .map(function (t) { return t.trim().slice(0, SLIP_TEXT); })', '.map(function (t) { return String(t).trim().slice(0, SLIP_TEXT); })')],
  ['feedback ignores the slip in use', s => s.replace('if (sets[i].id === d.currentId) set = sets[i];', 'if (i === 0) set = sets[i];')],
  ['feedback has no cap', s => s.replace('.slice(0, SLIP_MAX);', ';')],
  ['feedback does not escape a question', s => s.replace("PS.esc(t) + '</div><div class=\"pb-fb-box\">", "t + '</div><div class=\"pb-fb-box\">")],
  ['feedback cannot read the older slip', s => s.replace('var set = d;', 'var set = null;')],
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
