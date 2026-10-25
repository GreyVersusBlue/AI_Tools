// school-day.test.mjs — pure-logic tests for _shared/school-day.js (Path 9 P1):
// how a date resolves to a kind of day and a bell schedule, where a time falls in
// that schedule, the A/B letter, grading periods and the days left in one, the
// bell field's cleaning, the import of 035 Schedule Visualizer's times, grading
// deadlines and the next school day, and today's lesson read off 032's stamped pacing
// (held to scv-plan.js's own placer and dayValue()).
//
//   node Tools/school-calendar/test/school-day.test.mjs   (or: npm run test:school-day)
//
// school-day.js is a classic script ending in `})(window or globalThis)`, so it
// runs here in a vm context. The calendar is the shipped 2026-27 seed
// (scv-seed.js), and the A/B letters and the school-day rule are held to the ES
// modules 032 itself uses (scv-weeks.js, scv-pacing.js). The same checks are then
// run against deliberate breaks of the module (MUTANTS below): each break must
// turn at least one check red, or the suite fails. Nothing reads the real clock:
// today() is always given a fixed Date. The file runs itself a second time under
// Pacific/Kiritimati (UTC+14), where a UTC slip moves every date. Exits 1 on any failure.

if (!process.env.TZ) process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { seedCalendar2026 } from '../scv-seed.js';
import { abLetters as weeksLetters } from '../scv-weeks.js';
import { isTeachableDay, parseLessonList } from '../scv-pacing.js';
import { newCourse, newUnit, placePlan, stamp, dayValue, syncUnits } from '../scv-plan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const SRC = fs.readFileSync(path.join(site, '_shared/school-day.js'), 'utf8');

const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const clone = v => JSON.parse(JSON.stringify(v));

function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'school-day.js' });
  return ctx.window.SchoolDay;
}

function eachDate(lo, hi, fn) {
  for (let ms = Date.UTC(+lo.slice(0, 4), +lo.slice(5, 7) - 1, +lo.slice(8)); ; ms += 86400000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (d > hi) break;
    fn(d);
  }
}

const P = (label, start, end) => ({ label, start, end });
const REG = { id: 'reg', name: 'Regular', periods: [
  P('Period 1', '07:30', '08:20'), P('Period 2', '08:25', '09:15'), P('Period 3', '09:20', '10:10'),
  P('Period 4', '10:15', '11:05'), P('Lunch', '11:05', '11:35'), P('Period 5', '11:40', '12:30'),
] };
const HALF = { id: 'half', name: 'Early dismissal', periods: [
  P('Period 1', '07:30', '08:05'), P('Period 2', '08:10', '08:45'), P('Period 3', '08:50', '09:25'),
] };
const ADAY = { id: 'aday', name: 'A day', periods: [P('Block 1', '07:30', '09:00'), P('Block 2', '09:05', '10:35')] };
const BDAY = { id: 'bday', name: 'B day', periods: [P('Block 3', '07:30', '09:00'), P('Block 4', '09:05', '10:35')] };

function bellCal({ cycle = true, letters = true, regular = true, types = { halfday: 'half' } } = {}) {
  const cal = seedCalendar2026();
  if (cycle) cal.abCycle = { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'A' };
  cal.bell = {
    v: 1, schedules: clone([REG, HALF, ADAY, BDAY]),
    regular: regular ? 'reg' : null,
    letters: letters ? { A: 'aday', B: 'bday' } : { A: null, B: null },
    types: clone(types),
  };
  return cal;
}

function fakeStorage(map, throws) {
  return { getItem(k) { if (throws) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; } };
}

/** Every check, against one copy of the module. Returns the failed labels. */
function checks(S) {
  const fails = [];
  const ok = (c, label) => { checks.count++; if (!c) fails.push(label); };
  const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const pick = (d) => d && { school: d.school, why: d.why, half: d.half, letter: d.letter, schedule: d.schedule && d.schedule.id, source: d.source };

  eq(S.KEY, 'scv_calendar_v1', 'KEY is 032\'s key');

  // ---- no bell field: the calendar as every teacher has it today ----
  const seed = seedCalendar2026();
  eq(pick(S.dayOf(seed, '2026-09-01')), { school: true, why: null, half: false, letter: null, schedule: null, source: null },
    'a school day with no bell field has no schedule');
  eq(S.dayOf(seed, '2026-09-07').why, 'closed', 'Labor Day is closed');
  eq(S.dayOf(seed, '2026-09-07').closedBy, 'holiday', 'closed by the holiday type');
  eq(S.dayOf(seed, '2026-09-05').why, 'weekend', 'a Saturday is a weekend');
  eq(S.dayOf(seed, '2026-07-01').why, 'outside', 'July 1 is before the year');
  eq(S.dayOf(seed, '2027-06-14').why, 'outside', 'after the last day is outside');
  eq(S.dayOf(seed, '2026-02-30').why, 'invalid', 'Feb 30 is invalid');
  eq(S.dayOf(seed, '2026-9-1').why, 'invalid', 'an unpadded date is invalid');
  eq(S.dayOf(null, '2026-09-01').why, 'invalid', 'no calendar is invalid');
  eq(S.dayOf(seed, '2027-01-22').why, 'closed', 'a workday that ends a marking period is closed');
  const half = S.dayOf(seed, '2026-09-18');
  ok(half.school && half.half, 'Sep 18 (early dismissal) is a school day marked half');
  ok(S.dayOf(seed, '2027-06-11').half, 'the last day (firstlast + halfday) is half');
  ok(!S.dayOf(seed, '2026-11-04').closedBy && S.dayOf(seed, '2026-11-04').types.join() === 'halfday,mpend',
    'Nov 4 carries both its types, in legend order');
  eq(S.periodAt(seed, '2026-09-01', '09:00').state, 'noschedule', 'periodAt on a school day with no schedule');

  // ---- resolution order: type, then letter, then regular ----
  const cal = bellCal();
  eq(pick(S.dayOf(cal, '2026-08-31')), { school: true, why: null, half: false, letter: 'A', schedule: 'aday', source: 'letter' },
    'the anchor day is an A day on the A schedule');
  eq(pick(S.dayOf(cal, '2026-09-01')), { school: true, why: null, half: false, letter: 'B', schedule: 'bday', source: 'letter' },
    'the next day is a B day on the B schedule');
  eq(pick(S.dayOf(cal, '2026-09-18')), { school: true, why: null, half: true, letter: S.dayOf(cal, '2026-09-18').letter, schedule: 'half', source: 'type' },
    'a half day uses the half-day schedule, over its letter');
  ok(S.dayOf(cal, '2026-09-18').letter !== null, 'a half day still has its letter');
  eq(S.dayOf(cal, '2026-09-07').schedule, null, 'a closed day has no schedule even with schedules set');
  eq(S.dayOf(cal, '2026-09-05').schedule, null, 'a weekend has no schedule');
  eq(S.scheduleFor(cal, '2026-09-18').name, 'Early dismissal', 'scheduleFor names the schedule');
  const noLetters = bellCal({ letters: false });
  eq(pick(S.dayOf(noLetters, '2026-08-31')).schedule, 'reg', 'letters unassigned: the ordinary day\'s schedule');
  eq(S.dayOf(noLetters, '2026-08-31').source, 'regular', '...from "regular"');
  const noCycle = bellCal({ cycle: false });
  eq(S.dayOf(noCycle, '2026-08-31').letter, null, 'cycle off: no letter');
  eq(S.dayOf(noCycle, '2026-08-31').schedule.id, 'reg', 'cycle off: letter schedules are not used');
  const onlyLetters = bellCal({ regular: false, cycle: false });
  eq(S.dayOf(onlyLetters, '2026-09-01').schedule, null, 'no cycle and no ordinary schedule: none');
  const both = bellCal({ types: { halfday: 'half', mpend: 'reg' } });
  eq(S.dayOf(both, '2026-11-04').schedule.id, 'half', 'two types with schedules: the first in the legend wins');
  eq(S.dayOf(both, '2026-11-04').conflict, ['mpend'], '...and the other is listed in conflict');
  const reordered = bellCal({ types: { halfday: 'half', mpend: 'reg' } });
  reordered.dayTypes.reverse();
  eq(S.dayOf(reordered, '2026-11-04').schedule.id, 'reg', 'legend order, not tag order, decides');
  const ghost = bellCal({ types: { halfday: 'nope' } });
  eq(S.dayOf(ghost, '2026-09-18').source, 'letter', 'a type pointing at no schedule falls through');

  // ---- periodAt ----
  const at = (t, c = noLetters, d = '2026-09-01') => S.periodAt(c, d, t);
  eq(at('07:00').state, 'before', 'before the first bell');
  eq(at('07:00').next.label, 'Period 1', '...next is Period 1');
  eq(at('07:00').minutesUntil, 30, '...in 30 minutes');
  eq(at('07:30').state, 'in', 'a period starts at its start time');
  eq(at('07:30').period.label, 'Period 1', '...Period 1');
  eq(at('07:30').minutesLeft, 50, '...50 minutes left');
  eq(at('08:20').state, 'between', 'a period has ended at its end time');
  eq(at('08:20').next.label, 'Period 2', '...Period 2 next');
  eq(at('08:20').minutesUntil, 5, '...in 5 minutes');
  eq(at('09:16').index, -1, 'a passing time is no period');
  eq(at('11:05').period.label, 'Lunch', 'back-to-back: the second starts as the first ends');
  eq(at('11:04').next.label, 'Lunch', 'in a period, next is the one after it');
  eq(at('12:30').state, 'after', 'after the last bell');
  eq(at('12:30').next, null, '...nothing next');
  eq(at('09:00', noLetters, '2026-09-18').period.label, 'Period 3', 'a half day reads its own schedule');
  eq(at('11:00', noLetters, '2026-09-18').state, 'after', '...which ends early');
  eq(at('09:00', noLetters, '2026-09-07').state, 'noschool', 'a closed day');
  eq(at('9:00').state, 'invalid', 'an unpadded time is invalid');
  eq(at('24:00').state, 'invalid', '24:00 is invalid');
  eq(at('09:00').day.date, '2026-09-01', 'periodAt carries the day');

  // ---- today(): the local clock ----
  const t1 = S.today(noLetters, new Date(2026, 8, 1, 9, 5));
  eq([t1.date, t1.time, t1.at.state, t1.at.period && t1.at.period.label], ['2026-09-01', '09:05', 'in', 'Period 2'], 'today() at 9:05 on Sep 1');
  const t2 = S.today(noLetters, new Date(2026, 8, 1, 23, 30));
  eq([t2.date, t2.time], ['2026-09-01', '23:30'], 'today() late at night is still that local day');
  eq(S.localISO(new Date(2027, 0, 5)), '2027-01-05', 'localISO pads');

  // ---- the A/B letter, held to 032's own ----
  const ab = bellCal();
  const L = S.abLetters(ab);
  eq(L, weeksLetters(ab), 'abLetters is scv-weeks.js abLetters on the seed');
  const vals = Object.values(L);
  eq([vals.filter(x => x === 'A').length, vals.filter(x => x === 'B').length], [92, 92], '92 A and 92 B days');
  for (const [anchorDate, anchorLetter] of [['2026-07-15', 'B'], ['2026-12-02', 'B'], ['2027-08-02', 'A'], ['2026-09-07', 'A'], ['2026-09-05', 'B']]) {
    const c = clone(ab); c.abCycle = { enabled: true, anchorDate, anchorLetter };
    eq(S.abLetters(c), weeksLetters(c), `abLetters matches 032 with the anchor at ${anchorDate} ${anchorLetter}`);
  }
  eq(S.abLetters(bellCal({ cycle: false })), {}, 'cycle off: no letters');
  const snow = clone(ab);
  snow.days['2027-01-12'] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' };
  const L2 = S.abLetters(snow);
  const later = Object.keys(L).filter(d => d > '2027-01-12');
  ok(later.length > 90 && later.every(d => L2[d] && L2[d] !== L[d]), `a snow day flips the letter of every later school day (${later.length})`);
  eq(L2['2027-01-12'], undefined, 'the snow day itself has no letter');
  eq(S.dayOf(snow, later[0]).schedule.id, L[later[0]] === 'A' ? 'bday' : 'aday', 'and the next day takes the other letter\'s schedule');

  // ---- school days: the same rule as 032's isTeachableDay ----
  let same = true;
  eachDate('2026-08-01', '2027-07-01', d => { if (S.isSchoolDay(seed, d) !== isTeachableDay(d, seed.days, seed.dayTypes)) same = false; });
  ok(same, 'isSchoolDay is isTeachableDay on every date of the seed year');

  // ---- grading periods ----
  const gp = S.gradingPeriods(seed);
  eq(gp.map(p => [p.n, p.start, p.end, p.days]), [
    [1, '2026-08-31', '2026-11-04', 45], [2, '2026-11-05', '2027-01-22', 46],
    [3, '2027-01-23', '2027-04-07', 47], [4, '2027-04-08', '2027-06-11', 46]], 'the seed\'s four marking periods');
  eq(gp.reduce((n, p) => n + p.half, 0), 13, 'their half days add to the seed\'s 13');
  eq(S.gradingPeriodOf(seed, '2026-11-04').n, 1, 'the boundary day ends its period');
  eq(S.gradingPeriodOf(seed, '2026-11-05').n, 2, 'the day after starts the next');
  eq(S.gradingPeriodOf(seed, '2027-06-11').n, 4, 'the last day is in the last period');
  eq(S.gradingPeriodOf(seed, '2026-07-01'), null, 'before the year: none');
  eq(S.gradingPeriodOf(seed, 'nope'), null, 'not a date: none');
  const noTags = clone(seed); noTags.dayTypes = noTags.dayTypes.filter(t => t.id !== 'mpend');
  eq(S.gradingPeriods(noTags).length, 1, 'no boundary tags: the year is one period');
  const own = clone(seed); own.dayTypes.push({ id: 't9', label: 'End of Grading Period', color: '#000', pattern: 'solid', abbr: 'G' });
  own.days['2026-09-30'] = { types: ['t9'], label: '', note: '', lesson: '' };
  eq(S.gradingPeriods(own).length, 5, 'a teacher\'s own "grading period" type is a boundary');

  // ---- days remaining (P9-1: a half day is a whole day, counted beside) ----
  const p1 = gp[0];
  eq(S.daysRemaining(seed, p1, '2026-10-30'), { days: 3, half: 1 }, 'Oct 30 to Nov 4: Oct 30, Nov 2, Nov 4 (half); Nov 3 is closed');
  eq(S.daysRemaining(seed, p1, '2026-11-04'), { days: 1, half: 1 }, 'on the last day, that day');
  eq(S.daysRemaining(seed, p1, '2026-11-05'), { days: 0, half: 0 }, 'after the period: 0');
  eq(S.daysRemaining(seed, p1, '2026-01-01'), { days: 45, half: p1.half }, 'before the period: all of it');
  eq(S.daysRemaining(seed, p1, '2026-10-31'), S.daysRemaining(seed, p1, '2026-11-02'), 'from a Saturday is from the Monday');
  eq(S.daysRemaining(seed, null, '2026-10-30'), { days: 0, half: 0 }, 'no period: 0');

  // ---- the bell field ----
  eq(S.cleanBell(undefined).state, 'none', 'no field: none');
  eq(S.cleanBell(undefined).bell, S.emptyBell(), '...and an empty bell');
  eq(S.cleanBell('x').state, 'broken', 'a string: broken');
  eq(S.cleanBell({ schedules: 'x' }).state, 'broken', 'schedules not a list: broken');
  eq(S.cleanBell({ v: 2, schedules: [REG] }).state, 'newer', 'a later version: newer');
  eq(S.cleanBell({ v: 2, schedules: [REG], regular: 'reg' }).bell.schedules, [], '...and nothing resolved from it');
  const messy = S.cleanBell({ v: 1, regular: 'b', letters: { A: 'gone', B: 'a' }, types: { halfday: 'a', x: 'nope' }, schedules: [
    { id: 'a', name: '  Odd  ', periods: [P('Two', '09:00', '09:40'), P('One', '08:00', '08:40'), P('Bad', '10:00', '09:00'),
      P('', '11:00', '11:30'), P('Typo', '1:00', '1:30'), null, P('Same', '12:00', '12:00')] },
    { id: 'a', name: 'duplicate id', periods: [] },
    { id: 'b', name: '', periods: 'x' },
    'junk',
  ] });
  eq(messy.state, 'ok', 'a messy bell is ok');
  eq(messy.bell.schedules.map(s => s.id), ['a', 'b'], 'duplicate ids and junk dropped');
  eq(messy.bell.schedules[0].periods.map(p => p.label), ['One', 'Two', 'Period 3'], 'bad periods dropped, the rest sorted by start, a blank label named');
  eq(messy.bell.schedules[0].name, 'Odd', 'names trimmed');
  eq(messy.bell.schedules[1].name, 'Schedule 3', 'a blank name is named by position');
  eq(messy.dropped, 6, 'six things dropped: three bad periods, a null, a duplicate, junk');
  eq([messy.bell.regular, messy.bell.letters, messy.bell.types], ['b', { A: null, B: 'a' }, { halfday: 'a' }], 'references to no schedule are null');
  const input = bellCal().bell; const before = clone(input); S.cleanBell(input);
  eq(input, before, 'cleanBell does not change its input');
  const big = { v: 1, schedules: Array.from({ length: 50 }, (_, i) => ({ id: 's' + i, name: 'x', periods: [] })) };
  eq(S.cleanBell(big).bell.schedules.length, 40, 'at most 40 schedules');

  // ---- read ----
  eq(S.read(fakeStorage({}, true)), null, 'storage that throws: null');
  eq(S.read(fakeStorage({})), null, 'nothing saved: null');
  eq(S.read(fakeStorage({ scv_calendar_v1: '{"meta":' })), null, 'truncated JSON: null');
  eq(S.read(fakeStorage({ scv_calendar_v1: '{"meta":{},"dayTypes":[],"days":{}}' })), null, 'no dates in meta: null');
  eq(S.read(fakeStorage({ scv_calendar_v1: JSON.stringify(cal) })), plain(cal), 'a saved calendar reads back');
  eq(S.read(null), null, 'no storage: null');

  // ---- 035's times ----
  const sameAsA = { modCount: 4, modLabel: 'period', bellSchedule: { A: [{ start: '08:00', end: '08:50' }, { start: '', end: '' }, { start: '10:00', end: '' }, { start: '11:00', end: '11:50' }], B: null } };
  const imp1 = S.fromScheduleVisualizer(sameAsA);
  eq(imp1.schedules.map(s => s.name), ['Regular day (from the Schedule Visualizer)'], 'B "same as A": one schedule');
  eq(imp1.schedules[0].periods, [P('Period 1', '08:00', '08:50'), P('Period 4', '11:00', '11:50')], 'blank rows left out, labels as 035 names them');
  eq([imp1.letters, imp1.skipped], [{ A: 0, B: 0 }, 1], 'both letters share it; the half-typed row is counted');
  const ab2 = { modCount: 2, modLabel: 'block', bellSchedule: { A: [{ start: '08:00', end: '09:30' }, { start: '09:35', end: '11:00' }], B: [{ start: '08:00', end: '09:00' }, null] } };
  const imp2 = S.fromScheduleVisualizer(ab2);
  eq(imp2.schedules.map(s => s.periods.map(p => p.label)), [['Block A', 'Block B'], ['Block A']], 'A and B: two schedules');
  eq(imp2.letters, { A: 0, B: 1 }, '...one a letter');
  eq(S.fromScheduleVisualizer({ modCount: 3, bellSchedule: { A: [{ start: '08:00', end: '08:50' }], B: null } }).schedules[0].periods[0].label, 'Mod 1', 'the default label is Mod');
  eq(S.fromScheduleVisualizer({ modCount: 8, bellSchedule: { A: null, B: null } }).schedules, [], '035 with no times: nothing');
  eq(S.fromScheduleVisualizer(null).schedules, [], 'no settings: nothing');
  eq(S.fromScheduleVisualizer({ modCount: 2, bellSchedule: { A: [null, null], B: [{ start: '08:00', end: '09:00' }] } }).letters, { A: null, B: 0 }, 'B only: B only');

  let n = 0; const mk = () => 'imp' + (++n);
  const into = S.addImported(undefined, imp1, mk);
  eq([into.v, into.schedules.map(s => s.id), into.regular, into.letters], [1, ['imp1'], 'imp1', { A: 'imp1', B: 'imp1' }], 'into nothing: the schedule, both letters and the ordinary day');
  const kept = bellCal().bell; const keptBefore = clone(kept);
  const into2 = S.addImported(kept, imp2, mk);
  eq(kept, keptBefore, 'addImported does not change its input');
  eq(into2.schedules.length, 6, 'added after the four already there');
  eq([into2.regular, into2.letters], ['reg', { A: 'aday', B: 'bday' }], 'assignments already made are kept');
  const into3 = S.addImported({ v: 1, schedules: [], regular: null, letters: { A: null, B: 'x' }, types: {} }, imp2, mk);
  eq(into3.letters.A, into3.schedules[0].id, 'an unassigned letter takes the import\'s');
  eq(into3.regular, null, 'two different letter schedules leave the ordinary day alone');
  eq(S.cleanBell(into2).state, 'ok', 'what addImported writes cleans as ok');

  // ---- 032's schedules back into 035 (rank 12) ----
  const out1 = S.forScheduleVisualizer(bellCal(), 3);
  eq([out1.state, out1.pick], ['ok', { A: 'aday', B: 'bday' }], 'to 035: A and B from the letters');
  eq(out1.choices.map(c => [c.id, c.periods]), [['reg', 6], ['half', 3], ['aday', 2], ['bday', 2]], '...every schedule offered, with its count');
  eq(out1.bellSchedule.A, [{ start: '07:30', end: '09:00' }, { start: '09:05', end: '10:35' }, null], '...by position, padded to the mod count');
  eq(out1.bellSchedule.B[0], { start: '07:30', end: '09:00' }, '...B its own');
  const reg = S.forScheduleVisualizer(bellCal({ letters: false }), 4);
  eq([reg.pick, reg.bellSchedule.B, reg.extra.A], [{ A: 'reg', B: null }, null, 2], 'no letters: the ordinary day, B same as A, two periods past mod 4 counted');
  eq(reg.bellSchedule.A.length, 4, '...cut at the mod count');
  const picked = S.forScheduleVisualizer(bellCal(), 8, { A: 'half', B: 'half' });
  eq([picked.pick, picked.bellSchedule.B], [{ A: 'half', B: null }, null], 'a teacher\'s pick holds, and B = A is "same as A"');
  eq(S.forScheduleVisualizer(bellCal(), 8, { A: 'gone', B: null }).pick, { A: 'aday', B: null }, 'a pick 032 no longer has falls back; B null holds');
  const only = bellCal({ letters: false, regular: false });
  eq(S.forScheduleVisualizer(only, 8).pick, { A: 'reg', B: null }, 'nothing assigned: the first schedule');
  const none = seedCalendar2026();
  eq(S.forScheduleVisualizer(none, 8).state, 'none', 'a calendar without schedules: none');
  eq(S.forScheduleVisualizer(null, 8).state, 'nocalendar', 'no calendar');
  eq(S.forScheduleVisualizer(Object.assign(seedCalendar2026(), { bell: { v: 2, schedules: [] } }), 8).state, 'newer', 'a newer bell field is not read');
  eq(S.forScheduleVisualizer(Object.assign(seedCalendar2026(), { bell: 'x' }), 8).state, 'broken', 'a broken bell field');
  const calIn = bellCal(); const calBefore = clone(calIn);
  S.forScheduleVisualizer(calIn, 2, { A: 'reg', B: 'half' });
  eq(calIn, calBefore, 'to 035 changes nothing it is given');

  // ---- the day in words (Path 9 P3: 004 and 010 show it) ----
  const W = (c, d) => S.describe(c, S.dayOf(c, d));
  eq(S.typeLabel(seed, 'halfday'), 'Half Day / Early Dismissal', 'typeLabel reads the legend');
  eq(S.typeLabel(seed, 'nope'), '', 'typeLabel of an unknown id is empty');
  eq(S.typeLabel(null, 'halfday'), '', 'typeLabel with no calendar is empty');
  eq(W(seed, '2026-09-07'), 'No school: Labor Day', 'a closed day is named by its own label');
  const unnamed = clone(seed); unnamed.days['2026-09-07'].label = '';
  eq(W(unnamed, '2026-09-07'), 'No school: Holiday / No School', '...else by its type');
  eq(W(seed, '2026-09-05'), 'No school (weekend)', 'a weekend in words');
  eq(W(seed, '2026-07-01'), 'Outside the school year', 'summer in words');
  eq(W(seed, '2026-09-01'), 'A school day', 'an untagged day with the cycle off');
  eq(W(cal, '2026-09-01'), 'B day', 'an untagged B day');
  eq(W(cal, '2026-11-20'), S.dayOf(cal, '2026-11-20').letter + ' day \u00b7 Half Day / Early Dismissal \u00b7 Early Dismissal \u2014 Professional Learning',
    'a half day: letter, type, then the day\'s name');
  eq(S.describe(seed, S.dayOf(seed, '2026-02-30')), '', 'an invalid date has no words');
  eq(S.describe(null, S.dayOf(seed, '2026-09-01')), '', 'no calendar has no words');
  eq(S.describe(seed, null), '', 'no day has no words');

  // ---- grading deadlines and the next school day (Path 9 P3: 044/045) ----
  eq(S.nextSchoolDay(seed, '2026-09-04'), '2026-09-08', 'the next school day skips a weekend and Labor Day');
  eq(S.nextSchoolDay(seed, '2026-09-01'), '2026-09-02', 'the next school day of a Tuesday is Wednesday');
  eq(S.nextSchoolDay(seed, '2026-07-01'), seed.meta.start, 'before the year, the next school day is its first');
  eq(S.nextSchoolDay(seed, seed.meta.end), null, 'after the last day there is none');
  eq(S.nextSchoolDay(null, '2026-09-01'), null, 'no calendar, no next day');
  eq(S.nextSchoolDay(seed, '2026-02-30'), null, 'an invalid date has no next day');
  const gps = S.gradingPeriods(seed);
  const deadlines = [];
  eachDate(seed.meta.start, seed.meta.end, d => { const g = S.gradingDeadline(seed, d); if (g) deadlines.push([d, g.n]); });
  eq(deadlines, [['2026-11-04', 1], ['2027-01-21', 2], ['2027-04-07', 3], [gps[3] && (() => { let last = null; eachDate(gps[3].start, gps[3].end, d => { if (isTeachableDay(d, seed.days, seed.dayTypes)) last = d; }); return last; })(), 4]],
    'one deadline a grading period, on its last school day (Q2 ends on a workday, so Jan 21)');
  ok(deadlines.every(([d, n]) => { const nx = S.nextSchoolDay(seed, d); return nx === null || S.gradingPeriodOf(seed, nx).n === n + 1; }),
    'the school day after each deadline is in the next period');
  eq(S.gradingDeadline(seed, '2027-01-22'), null, 'the workday the tag sits on is not a deadline');
  eq(S.gradingDeadline(seed, '2026-11-03'), null, 'the day before a deadline is not one');
  eq(S.gradingDeadline(null, '2026-11-04'), null, 'no calendar, no deadline');
  eq(S.gradingPeriodName(seed, gps[1]), 'Quarter 2', 'a year of four names quarters');
  const three = clone(seed); delete three.days['2027-04-07'];
  eq(S.gradingPeriodName(three, S.gradingPeriods(three)[2]), 'grading period 3 of 3', 'any other year names grading periods');
  eq(S.gradingPeriodName(seed, null), '', 'no period, no name');

  // ---- today's lesson from 032's stamped pacing (Path 9 P3: 044/045) ----
  // Held to scv-plan.js itself: the plan is placed and stamped by 032's own module, and
  // lessonsOn() must give back, for every date of the year, what that placement put there.
  const pcal = clone(cal);
  const les = parseLessonList(Array.from({ length: 40 }, (_, i) =>
    `U${1 + Math.floor(i / 12)}-${i % 12 === 11 ? 'BUF1' : String(i % 12 + 1).padStart(2, '0')}-${i % 2 ? 'B' : 'A'}-Lesson ${i + 1} - part`).join('\n')).lessons;
  const cA = Object.assign(newCourse('Civics', { id: 'c_a', meets: 'A' }), { lessons: les,
    adjustments: [{ id: 'adj_1', beforeLessonId: les[4].id, reason: 'Ran long', createdOn: '2026-09-01' }],
    lost: [{ id: 'lost_1', date: '2026-09-29', reason: 'Assembly' }] });
  const cB = Object.assign(newCourse('Lab', { id: 'c_b', start: '2026-09-14' }), { pace: { halfday: 'skip' },
    units: [newUnit('Cells', 15, { id: 'u_1' }), Object.assign(newUnit('Energy', 12, { id: 'u_2' }), { pin: '2026-11-02' }), newUnit('Genetics', 30, { id: 'u_3' })],
    lost: [{ id: 'lost_2', date: '2026-09-22', reason: '' }] });
  const cC = Object.assign(newCourse('Art', { id: 'c_c', meets: 'B' }), { units: [newUnit('Color', 20, { id: 'u_c' })] });
  pcal.plan = { v: 1, active: 'c_a', algo: 1, courses: [syncUnits(cA), cB, cC] };
  const placed = placePlan(pcal);
  const stamped = stamp(pcal, placed);
  const pA = placed.c_a, pB = placed.c_b;
  const lesById = Object.fromEntries(les.map(l => [l.id, l]));
  let lessonMiss = 0, gapMiss = 0, unitMiss = 0, meetMiss = 0, lostMiss = 0, lessonSeen = 0, unitSeen = 0;
  const lettersP = weeksLetters(pcal);
  eachDate('2026-08-01', '2027-07-01', d => {
    const got = plain(S.lessonsOn(stamped, d));
    const a = got.filter(x => x.courseId === 'c_a'), b = got.filter(x => x.courseId === 'c_b');
    const slot = pA.slots[d];
    const wantA = slot && slot.kind === 'lesson' ? [{ kind: 'lesson', code: `U${lesById[slot.lessonId].unit}-${lesById[slot.lessonId].num}-${lesById[slot.lessonId].letter}`, title: lesById[slot.lessonId].title }] : [];
    const gapA = slot && slot.kind === 'gap' ? [{ kind: 'gap', reason: slot.reason }] : [];
    if (!isDeepStrictEqual(a.filter(x => x.kind === 'lesson').map(x => ({ kind: x.kind, code: x.code, title: x.title })), wantA)) lessonMiss++;
    if (!isDeepStrictEqual(a.filter(x => x.kind === 'gap').map(x => ({ kind: x.kind, reason: x.reason })), gapA)) gapMiss++;
    if (a.some(x => x.kind === 'unit')) unitMiss++;
    if (wantA.length) lessonSeen++;
    const sb = pB.slots[d];
    const wantB = sb && sb.kind === 'day' ? [{ unit: cB.units.find(u => u.id === sb.unitId).name, n: sb.n, of: sb.of }] : [];
    if (!isDeepStrictEqual(b.filter(x => x.kind === 'unit').map(x => ({ unit: x.unit, n: x.n, of: x.of })), wantB)) unitMiss++;
    if (wantB.length) unitSeen++;
    // The unit test and dayValue() agree on every date inside a unit's span.
    const inSpan = stamped.plan.courses[1].units.some(u => u.start && d >= u.start && d <= u.end);
    if (inSpan && dayValue(pcal, cB, d, lettersP).meets !== (b.some(x => x.kind === 'unit'))) meetMiss++;
    const sc = placed.c_c.slots[d], c = got.filter(x => x.courseId === 'c_c');
    if (!isDeepStrictEqual(c.map(x => [x.kind, x.n]), sc ? [['unit', sc.n]] : [])) unitMiss++;
    const lostWant = (d === '2026-09-29' ? ['c_a'] : []).concat(d === '2026-09-22' ? ['c_b'] : []);
    if (!isDeepStrictEqual(got.filter(x => x.kind === 'lost').map(x => x.courseId), lostWant)) lostMiss++;
  });
  ok(lessonSeen > 30 && unitSeen > 50, `the fixture places lessons and unit days (${lessonSeen}, ${unitSeen})`);
  eq(lessonMiss, 0, 'every stamped lesson is read back on its date, with its code and title, and nowhere else');
  eq(gapMiss, 0, 'every stamped bump is read back on its date, with its reason');
  eq(unitMiss, 0, 'every typed unit day is read back with its name and day n of m, as the placement numbers it');
  eq(meetMiss, 0, 'inside a unit, a class day is exactly what scv-plan.js dayValue() says');
  eq(lostMiss, 0, 'a lost date is read back for its course only');
  ok(Object.values(pB.slots).some(x => x.half === false) && pcal.days['2026-11-20'] && !S.lessonsOn(stamped, '2026-11-20').some(x => x.courseId === 'c_b'),
    'a day type the course skips holds no unit day');
  const gapDate = pA.adjDates.adj_1;
  eq(S.lessonsOn(stamped, gapDate).find(x => x.kind === 'gap'), { courseId: 'c_a', course: 'Civics', kind: 'gap', code: 'U1-05-A', title: 'Lesson 5 - part', unit: '', n: 0, of: 0, reason: 'Ran long' },
    'a bump names the lesson it was for');
  eq(S.lessonsOn(stamped, pA.dateByLessonId[les[0].id]).map(x => [x.course, x.code]), [['Civics', 'U1-01-A']].concat(
    pB.slots[pA.dateByLessonId[les[0].id]] ? [['Lab', '']] : []), 'courses come back in the plan\'s order');
  eq(S.lessonsOn(pcal, pA.dateByLessonId[les[0].id]), [], 'an unstamped plan reads as nothing (lessonsOn never places)');
  eq(S.lessonsOn(Object.assign(clone(stamped), { plan: Object.assign(clone(stamped.plan), { v: 2 }) }), pA.dateByLessonId[les[0].id]), [], 'a newer plan is not read');
  eq(S.lessonsOn(Object.assign(clone(stamped), { plan: 'x' }), pA.dateByLessonId[les[0].id]), [], 'a broken plan is not read');
  eq(S.lessonsOn(seed, '2026-09-01'), [], 'a calendar with no plan has no lessons');
  eq(S.lessonsOn(null, '2026-09-01'), [], 'no calendar, no lessons');
  const odd = clone(stamped); odd.plan.courses[0].lessons[0].num = '<b>'; odd.plan.courses.push(null, { id: 'c_x', lessons: 'no' });
  eq(S.lessonsOn(odd, pA.dateByLessonId[les[0].id]).filter(x => x.courseId !== 'c_b').map(x => x.code), [''], 'a code that is not a lesson code is left out, and a bad course is skipped');
  const DL = (x) => S.describeLesson(x);
  eq(DL({ kind: 'lesson', code: 'U3-06-A', title: 'Fractions review' }), 'U3-06-A Fractions review', 'a lesson in words');
  eq(DL({ kind: 'lesson', code: '', title: 'Fractions review' }), 'Fractions review', 'a lesson with no code');
  eq(DL({ kind: 'lesson', code: '', title: '' }), 'A lesson', 'a lesson with nothing to say');
  eq(DL(plain(S.lessonsOn(stamped, gapDate)).find(x => x.kind === 'gap')), 'Catch-up day: Ran long (U1-05-A is next)', 'a bump in words');
  eq(DL({ kind: 'gap', code: '', reason: '' }), 'Catch-up day', 'a bare bump');
  eq(DL({ kind: 'lost', reason: 'Assembly' }), 'Does not meet: Assembly', 'a lost day in words');
  eq(DL({ kind: 'lost', reason: '' }), 'Does not meet', 'a lost day with no reason');
  eq(DL({ kind: 'unit', unit: 'Cells', n: 3, of: 15 }), 'Cells, day 3 of 15', 'a unit day in words');
  eq(DL(null), '', 'nothing in words');
  eq(DL({ kind: 'what' }), '', 'an unknown kind in words');
  const stampedBytes = JSON.stringify(stamped); S.lessonsOn(stamped, gapDate);
  eq(JSON.stringify(stamped), stampedBytes, 'lessonsOn changes nothing it is given');


  return fails;
}

const MUTANTS = [
  ['describeLesson drops the code', "return [item.code, item.title].filter(Boolean).join(' ')", "return [item.title].filter(Boolean).join(' ')"],
  ['describeLesson drops the reason', "var why = item.reason ? ': ' + item.reason : '';", "var why = '';"],
  ['describeLesson drops the day number', "return item.unit + ', day ' + item.n + ' of ' + item.of;", "return item.unit;"],
  ['next school day includes the day itself', "var from = iso < cal.meta.start ? isoToMs(cal.meta.start) : isoToMs(iso) + DAY_MS;", "var from = iso < cal.meta.start ? isoToMs(cal.meta.start) : isoToMs(iso);"],
  ['deadline on the tag, not the last school day', "if (!isCalendar(cal) || !isSchoolDay(cal, iso)) return null;\n    var gp = gradingPeriodOf(cal, iso);\n    if (!gp) return null;\n    for", "if (!isCalendar(cal)) return null;\n    var gp = gradingPeriodOf(cal, iso);\n    if (!gp) return null;\n    if (gp.end === iso) return gp;\n    for"],
  ['every school day a deadline', "      if (isSchoolDay(cal, msToIso(ms))) return null;\n    }\n    return gp;", "    }\n    return gp;"],
  ['quarters in any year', "return of === 4 ? 'Quarter '", "return of ? 'Quarter '"],
  ['lessonsOn reads a newer plan', "plan.v !== PLAN_VERSION ||", ''],
  ['lessonsOn ignores the rotation', "if ((course.meets === 'A' || course.meets === 'B') && cycle && letters[iso] !== course.meets) return false;", ''],
  ['lessonsOn ignores a skipped day type', "if ((pace[types[i].id] || types[i].pace || 'count') === 'skip') return false;", ''],
  ['lessonsOn ignores lost dates for units', "for (var j = 0; j < lost.length; j++) if (isObj(lost[j]) && lost[j].date === iso) return false;", ''],
  ['unit day counted from the year', "for (var ms = isoToMs(u.start), end = isoToMs(iso); ms <= end; ms += DAY_MS) {", "for (var ms = isoToMs(cal.meta.start), end = isoToMs(iso); ms <= end; ms += DAY_MS) {"],
  ['units shown beside lessons', "      if (lessons.length) return;\n", ''],
  ['bumps not read', "if (!isObj(a) || a.on !== iso) return;", "return;"],
  ['lost dates not read', "if (isObj(x) && x.date === iso) push({ kind: 'lost'", "if (false) push({ kind: 'lost'"],
  ['any code accepted', "/^[A-Za-z0-9]+$/.test(String(l.num))", 'true'],
  ['describe drops the letter', "    if (day.letter) parts.push(day.letter + ' day');\n", ''],
  ['describe ignores the day\'s own name', "'No school: ' + (name || typeLabel", "'No school: ' + (typeLabel"],
  ['describe calls a weekend closed', "if (day.why === 'weekend') return 'No school (weekend)';", ''],
  ['typeLabel takes the first type', "if (isObj(t) && t.id === id) return text(t.label);", "if (isObj(t)) return text(t.label);"],
  ['outside not tested', "if (iso < cal.meta.start || iso > cal.meta.end) { out.why = 'outside'; return out; }", ''],
  ['weekend not tested', "if (!isWeekday(iso)) { out.why = 'weekend'; return out; }", ''],
  ['closure not tested', "if (types[i].noSchool) { out.why = 'closed'; out.closedBy = types[i].id; return out; }", ''],
  ['letter before type', "if (!out.schedule && out.letter && bell.letters[out.letter]) {", "if (out.letter && bell.letters[out.letter]) {"],
  ['last type wins', "if (out.schedule) { out.conflict.push(t.id); return; }", ''],
  ['tag order, not legend order', "cal.dayTypes.forEach(function (t) {\n      if (isObj(t) && entry.types.indexOf(t.id) !== -1) out.push(t);\n    });",
    "entry.types.forEach(function (id) {\n      cal.dayTypes.forEach(function (t) { if (isObj(t) && t.id === id) out.push(t); });\n    });"],
  ['period end inclusive', "if (t >= a && t < b && !out.period)", "if (t >= a && t <= b && !out.period)"],
  ['period start exclusive', "if (t >= a && t < b && !out.period)", "if (t > a && t < b && !out.period)"],
  ['times not padded', "var TIME_RE = /^([01]\\d|2[0-3]):([0-5]\\d)$/;", "var TIME_RE = /^(\\d{1,2}):([0-5]\\d)$/;"],
  ['periods not sorted', "periods.sort(function (x, y) { return toMinutes(x.start) - toMinutes(y.start); });", ''],
  ['zero-length period kept', "if (a === null || b === null || b <= a) { dropped++; return; }", "if (a === null || b === null || b < a) { dropped++; return; }"],
  ['newer version edited', "if (typeof bell.v === 'number' && bell.v > BELL_VERSION) return { bell: emptyBell(), state: 'newer', dropped: 0 };", ''],
  ['dangling reference kept', "function ref(id) { return typeof id === 'string' && own(ids, id) ? id : null; }", "function ref(id) { return typeof id === 'string' ? id : null; }"],
  ['duplicate ids kept', " || own(ids, s.id)) { dropped++; return; }", ") { dropped++; return; }"],
  ['today in UTC', "function localISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }",
    "function localISO(d) { return d.toISOString().slice(0, 10); }"],
  ['dates walked in local time', "function msToIso(ms) {\n    var d = new Date(ms);\n    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());",
    "function msToIso(ms) {\n    var d = new Date(ms);\n    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());"],
  ['letter does not slide over a closure', "      if (isSchoolDay(cal, iso)) {\n        map[iso] = letter;", "      if (isWeekday(iso)) {\n        map[iso] = letter;"],
  ['anchor parity flipped', "% 2 === 0 ? anchorLetter : other;", "% 2 === 1 ? anchorLetter : other;"],
  ['half day counted as half', "      out.days++;\n      if (typesOn(cal, iso).some(isHalfType)) out.half++;",
    "      out.days += typesOn(cal, iso).some(isHalfType) ? 0.5 : 1;\n      if (typesOn(cal, iso).some(isHalfType)) out.half++;"],
  ['boundary day starts the next period', "        start = msToIso(ms + DAY_MS); days = 0; half = 0;", "        start = iso; days = 0; half = 0;"],
  ['own boundary types ignored', "return t.id === 'mpend' || /marking period|grading period/i.test(String(t.label || ''));", "return t.id === 'mpend';"],
  ['read lets a throw out', "try { raw = storage && storage.getItem(KEY); } catch (e) { return null; }", "raw = storage && storage.getItem(KEY);"],
  ['035 blank rows imported', "if (!isObj(e) || (!e.start && !e.end)) continue;", "if (!isObj(e)) continue;"],
  ['035 labels off by one', "periods.push({ label: modLabel(i + 1, style), start: e.start, end: e.end });", "periods.push({ label: modLabel(i, style), start: e.start, end: e.end });"],
  ['import overwrites a letter', "if (!next.letters[k] && typeof L[k] === 'number'", "if (typeof L[k] === 'number'"],
  ['today ignores the time it is given', "var d = now && typeof now.getFullYear === 'function' ? now : new Date();", 'var d = new Date();'],
  ['to 035: B never "same as A"', "    if (b === a) b = null;\n    out.pick", "    out.pick"],
  ['to 035: letter ignored', "      : has(bell.letters.A) ? bell.letters.A\n", "\n"],
  ['to 035: no padding', "        r.push(q ? { start: q.start, end: q.end } : null);", "        if (q) r.push({ start: q.start, end: q.end });"],
  ['to 035: extra not counted', "      out.extra[letter] = Math.max(0, periods.length - n);", ''],
  ['import mutates its input', "var next = base.state === 'ok' ? JSON.parse(JSON.stringify(bell)) : emptyBell();", "var next = base.state === 'ok' ? bell : emptyBell();"],
];

let failed = 0;
checks.count = 0;
const fails = checks(load(SRC));
const ran = checks.count;
fails.forEach(f => console.log('  FAIL ' + f));
failed += fails.length;

// The breaks are judged in the first zone only: some (dates walked in local time) are
// harmless at UTC+14 by nature, and the second run is there to hold the checks.
let caught = 0;
for (const [name, from, to] of process.env.SCHOOL_DAY_CHILD ? [] : MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  let red;
  try { red = checks(load(SRC.replace(from, to))).length > 0; } catch (e) { red = true; }
  if (red) caught++;
  else { console.log(`  FAIL mutant "${name}" passed every check`); failed++; }
}

console.log(`school-day (TZ=${process.env.TZ}): ${ran - fails.length}/${ran} checks passed; ${process.env.SCHOOL_DAY_CHILD ? 'breaks judged in the first zone' : caught + '/' + MUTANTS.length + ' deliberate breaks caught'}`);

if (!process.env.SCHOOL_DAY_CHILD) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: 'Pacific/Kiritimati', SCHOOL_DAY_CHILD: '1' }, encoding: 'utf8',
  });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
