// plan.test.mjs — pure-logic tests for Tools/school-calendar/scv-plan.js (Path 9 P2,
// increment 1, the module half): the plan record's reader, the migration from
// `cal.pacing`, what counts as a class day for a course, the placer for lessons and for
// typed unit lengths, stamping, and the diff that says what a change moved.
//
//   node Tools/school-calendar/test/plan.test.mjs   (or: npm run test:school-calendar-plan)
//
// The calendar is the shipped 2026-27 seed. The placer is held to scv-pacing.js's
// placeLessons() on 500 seeded random lists, bumps, closures and start dates (the
// "every lesson lands on the date it had" promise of the migration), and to the figures
// the design measured. Then the checks are run against deliberate breaks of the module
// (MUTANTS): each must turn a check red. Nothing reads the clock. The file runs itself
// again under Pacific/Kiritimati (UTC+14). Exits 1 on any failure.

if (!process.env.TZ) process.env.TZ = 'America/New_York';

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { seedCalendar2026 } from '../scv-seed.js';
import { placeLessons, isTeachableDay, parseLessonList, emptyPacing } from '../scv-pacing.js';
import { isValid } from '../scv-store.js';
import { abLetters } from '../scv-weeks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.join(here, '..', 'scv-plan.js');
const SRC = fs.readFileSync(MODULE, 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
const plain = v => (v === undefined ? undefined : clone(v));

/** A seeded generator, so the random cases are the same on every run (this is pure
    logic that takes no rng from the page; CLAUDE.md allows seeding here). */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function codes(n, units = [5, 4, 6, 3]) {
  const out = [];
  let u = 0, k = 0;
  for (let i = 0; i < n; i++) {
    if (k >= units[u % units.length]) { u++; k = 0; }
    k++;
    out.push(`U${u + 1}-${String(k).padStart(2, '0')}-${i % 2 ? 'B' : 'A'}-Lesson ${i + 1}`);
  }
  return parseLessonList(out.join('\n')).lessons;
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

/** Every check, against one copy of the module. Returns the failed labels. */
function checks(M) {
  const fails = [];
  let count = 0;
  const eq = (a, b, label) => { count++; if (!isDeepStrictEqual(plain(a), plain(b))) fails.push(`${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); };
  const okk = (c, label) => eq(!!c, true, label);

  const seed = seedCalendar2026();
  const L = abLetters(seed);

  // ---- the record ----
  eq(M.readPlan(seed).state, 'none', 'no plan: none');
  eq(M.readPlan({ ...seed, plan: 'x' }).state, 'broken', 'a string: broken');
  eq(M.readPlan({ ...seed, plan: { v: 1, courses: [{ name: 'no id' }] } }).state, 'broken', 'a course with no id: broken');
  eq(M.readPlan({ ...seed, plan: { v: 1, courses: [{ id: 'a' }, { id: 'a' }] } }).state, 'broken', 'two courses with one id: broken');
  eq(M.readPlan({ ...seed, plan: { v: 2, courses: [] } }).state, 'newer', 'v 2: newer');
  const thin = M.readPlan({ ...seed, plan: { v: 1, active: 'gone', courses: [{ id: 'c1', name: 'History' }] } });
  eq([thin.state, thin.plan.active, thin.plan.courses[0].lessons, thin.plan.courses[0].meets], ['ok', 'c1', [], 'all'], 'a thin course is filled out and a dangling active falls back');
  eq(M.newCourse('X', { taken: ['course_1', 'course_3'] }).id, 'course_2', 'ids are the next free number');

  // ---- class days ----
  const all = M.newCourse('All');
  const why = (c, d, cal = seed) => M.dayValue(cal, c, d, abLetters(cal)).why;
  eq(why(all, '2026-08-28'), 'outside', 'before the year: outside');
  eq(why(all, '2026-09-05'), 'weekend', 'a Saturday: weekend');
  eq(why(all, '2026-09-07'), 'closed:holiday', 'Labor Day: closed');
  eq(M.dayValue(seed, all, '2026-09-18', L), { meets: true, why: null, half: true, letter: null }, 'a half day is a whole class day, marked (P9-1)');
  const skipHalf = { ...M.newCourse('S'), pace: { halfday: 'skip' } };
  eq(why(skipHalf, '2026-09-18'), 'skip:halfday', 'a course can skip a type');
  eq(why(skipHalf, '2026-11-26'), 'closed:holiday', '...a closure still names itself');
  const typed = clone(seed);
  typed.dayTypes.find(t => t.id === 'testing').pace = 'skip';
  typed.days['2026-10-05'] = { types: ['testing'], label: 'Test', note: '', lesson: '' };
  eq(why(all, '2026-10-05', typed), 'skip:testing', 'a type paced as skip');
  eq(why({ ...all, pace: { testing: 'count' } }, '2026-10-05', typed), null, 'the course overrides the type');
  typed.days['2026-10-06'] = { types: ['testing', 'holiday'], label: '', note: '', lesson: '' };
  eq(why(all, '2026-10-06', typed), 'closed:holiday', 'closing wins over skipping on one day');
  eq(why(all, '2026-10-05', seed), null, 'testing days count by default (P9-2)');
  const lostC = { ...M.newCourse('L'), lost: [{ id: 'l1', date: '2026-09-09', reason: 'Assembly' }] };
  eq(why(lostC, '2026-09-09'), 'lost:l1', 'a lost date');
  eq(why({ ...all, start: '2026-09-10' }, '2026-09-09'), 'outside', 'before the course starts: outside');

  const ab = clone(seed);
  ab.abCycle = { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'A' };
  const aCourse = M.newCourse('A', { meets: 'A' });
  const bCourse = M.newCourse('B', { meets: 'B' });
  const aDays = M.classDays(ab, aCourse).days.length, bDays = M.classDays(ab, bCourse).days.length;
  eq([aDays, bDays, M.classDays(ab, all).days.length], [92, 92, 184], '184 school days, 92 A and 92 B');
  eq(M.classDays(seed, all).days.filter(d => d.half).length, 13, '13 half days');
  okk(M.placeCourse(seed, aCourse).problems.some(p => p.code === 'no-rotation'), 'an A course with the cycle off: no-rotation');
  eq(M.classDays(seed, aCourse).days.length, 184, '...and it meets every day');
  const allDates = [];
  for (let d = '2026-08-31'; d <= '2027-06-11'; d = addDays(d, 1)) allDates.push(d);
  eq(allDates.filter(d => M.dayValue(seed, all, d, L).meets), allDates.filter(d => d <= seed.meta.end && isTeachableDay(d, seed.days, seed.dayTypes)),
    'with no settings a class day is exactly a teachable day');

  // ---- flow (the design's figures) ----
  const flow = { ...M.newCourse('Typed'), units: [M.newUnit('One', 10, { id: 'u1' }), M.newUnit('Two', 8, { id: 'u2' }), M.newUnit('Three', 12, { id: 'u3' })] };
  const fp = M.placeCourse(seed, flow);
  eq(fp.units.map(u => [u.start, u.end]), [['2026-08-31', '2026-09-14'], ['2026-09-15', '2026-09-24'], ['2026-09-25', '2026-10-12']], 'units of 10, 8 and 12 days flow');
  eq(fp.units[0].half, 0, '...with no half day in the first');
  eq(fp.units[1].half, 1, '...and Sep 18 in the second');
  eq(fp.slots['2026-09-15'], { kind: 'day', unitId: 'u2', lessonId: null, n: 1, of: 8, half: false, reason: null }, 'a typed day says which of how many');
  const aFlow = { ...flow, meets: 'A', units: [M.newUnit('One', 10, { id: 'u1' })] };
  const afp = M.placeCourse(ab, aFlow);
  eq([afp.units[0].start, afp.units[0].end], ['2026-08-31', '2026-09-25'], 'an A course\'s 10-day unit is Aug 31 to Sep 25');
  eq(M.placeCourse(seed, { ...flow, units: [M.newUnit('Zero', 0, { id: 'z' })] }).problems.map(p => p.code), ['empty-unit'], 'a unit of 0 days places nothing');
  const tooLong = M.placeCourse(seed, { ...flow, units: [M.newUnit('All year', 190, { id: 'big' })] });
  eq([tooLong.units[0].placed, tooLong.units[0].short, tooLong.problems.map(p => p.code)], [184, 6, ['short']], 'more days than the year: short, never cut');

  // ---- the snow day ----
  const jan = { ...M.newCourse('Jan', { start: '2027-01-04' }), units: [M.newUnit('Twenty', 20, { id: 'u20' }), M.newUnit('Next', 5, { id: 'n5' })] };
  const before = M.placeCourse(seed, jan);
  eq(before.units[0].end, '2027-02-02', 'a 20-day unit from Jan 4 ends Feb 2');
  const snow = clone(seed);
  snow.days['2027-01-12'] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' };
  const after = M.placeCourse(snow, jan);
  eq(after.units[0].end, '2027-02-03', '...and Feb 3 after a snow day on Jan 12');
  eq(after.units[1].start, M.classDays(snow, jan).days[20].date, 'the next unit starts the class day after');
  okk(after.units[1].start > before.units[1].start, '...a class day later than before');
  const abSnow = clone(ab); abSnow.days['2027-01-12'] = snow.days['2027-01-12'];
  const LB = abLetters(ab), LA = abLetters(abSnow);
  const later = Object.keys(LA).filter(d => d > '2027-01-12' && LB[d]);
  eq([later.length, later.filter(d => LA[d] !== LB[d]).length], [99, 99], 'the snow day flips all 99 later letters (the cycle slides)');
  const aj = { ...jan, meets: 'A' };
  okk(M.placeCourse(abSnow, aj).classDates.every(d => LA[d] === 'A'), 'the A course follows the slid letters');

  // ---- lost dates ----
  const lc = { ...jan, lost: [] };
  const base = M.placeCourse(seed, lc);
  const lost1 = { ...lc, lost: [{ id: 'x', date: '2027-01-12', reason: 'Assembly' }] };
  const pl = M.placeCourse(seed, lost1);
  eq(pl.units[0].end, '2027-02-03', 'a lost date moves the unit as a closure would');
  eq(pl.excluded.find(e => e.date === '2027-01-12').why, 'lost:x', '...and is listed');
  eq(M.placeCourse(snow, lost1).units[0].end, '2027-02-03', 'a closure on a lost date: no second shift');
  eq(M.placeCourse(snow, lc).units[0].end, '2027-02-03', '...and removing the lost entry then: no shift');
  eq(M.placeCourse(seed, { ...lc, lost: [{ id: 'w', date: '2027-01-09', reason: '' }] }).units, base.units, 'a lost Saturday is inert');

  // ---- lesson mode and units ----
  const lessons = codes(12, [5, 4, 3]);
  const lessonCourse = M.syncUnits({ ...M.newCourse('Lessons'), lessons, adjustments: [{ id: 'adj1', beforeLessonId: lessons[6].id, reason: 'Ran long', createdOn: '2026-09-01' }] });
  eq(lessonCourse.units.map(u => [u.code, u.days, u.name]), [['1', 5, 'Unit 1'], ['2', 5, 'Unit 2'], ['3', 3, 'Unit 3']], 'runs of U<n> are units; a bump counts in its unit');
  const renamed = clone(lessonCourse); renamed.units[1].name = 'Rivers'; renamed.units[1].color = '#123456';
  const again = M.syncUnits({ ...renamed, lessons: codes(14, [5, 6, 3]) });
  eq([again.units[1].name, again.units[1].color, again.units[1].days, again.units[1].id], ['Rivers', '#123456', 7, renamed.units[1].id], 'a re-import keeps the unit record by code and run');
  const back = M.syncUnits({ ...M.newCourse('R'), lessons: parseLessonList('U1-01-A-a\nU2-01-A-b\nU1-02-A-c').lessons });
  eq(back.units.map(u => u.code), ['1', '2', '1'], 'a code that comes back is a second unit');
  const lp = M.placeCourse(seed, lessonCourse);
  eq(lp.slots[lp.dateByLessonId[lessons[0].id]].n, 1, 'a lesson slot is numbered in its unit');
  eq(Object.values(lp.adjDates), ['2026-09-09'], 'the bump takes the class day before its lesson');
  eq(lp.slots['2026-09-09'], { kind: 'gap', unitId: lessonCourse.units[1].id, lessonId: lessons[6].id, n: 2, of: 5, half: false, reason: 'Ran long' }, '...shown as a gap in its unit');

  // ---- equivalence with placeLessons ----
  const r = rng(20261023);
  let mismatch = 0, cases = 0;
  for (let t = 0; t < 500; t++) {
    const cal = clone(seed);
    const n = 1 + Math.floor(r() * 200);
    const ls = codes(n, [1 + Math.floor(r() * 8), 1 + Math.floor(r() * 8)]);
    const adjs = [];
    const nb = Math.floor(r() * 6);
    for (let k = 0; k < nb; k++) adjs.push({ id: 'adj_' + k, beforeLessonId: r() < 0.1 ? 'les_gone' : ls[Math.floor(r() * n)].id, reason: 'r' + k, createdOn: '2026-09-01' });
    const nc = Math.floor(r() * 5);
    for (let k = 0; k < nc; k++) {
      const d = addDays('2026-08-31', Math.floor(r() * 280));
      cal.days[d] = { types: [r() < 0.5 ? 'holiday' : 'workday'], label: 'c', note: '', lesson: '' };
    }
    const startDate = r() < 0.5 ? null : addDays('2026-08-20', Math.floor(r() * 320));
    cal.pacing = { startDate, lessons: ls, adjustments: adjs };
    const ref = placeLessons({ lessons: ls, adjustments: adjs, startISO: startDate || cal.meta.start, endISO: cal.meta.end, isTeachable: d => isTeachableDay(d, cal.days, cal.dayTypes) });
    const { cal: absorbed } = M.absorbLegacy(cal);
    const course = absorbed.plan.courses[0];
    const mine = M.placeCourse(absorbed, course);
    cases++;
    const same = isDeepStrictEqual(clone(mine.byDate), clone(ref.byDate))
      && isDeepStrictEqual(mine.dateByLessonId, ref.dateByLessonId)
      && isDeepStrictEqual(mine.vacated, ref.vacated)
      && isDeepStrictEqual(mine.overflow.map(l => l.id), ref.overflow.map(l => l.id))
      && isDeepStrictEqual(mine.orphanedAdjustmentIds, ref.orphanedAdjustmentIds);
    if (!same) mismatch++;
  }
  eq([cases, mismatch], [500, 0], 'a migrated course places every lesson, bump, overflow and orphan as placeLessons() did (500 seeded cases)');

  // ---- the migration ----
  const v2 = clone(seed);
  v2.pacing = { startDate: '2026-09-08', lessons: codes(30), adjustments: [{ id: 'a1', beforeLessonId: 'les_3', reason: 'Fire drill', createdOn: '2026-09-09' }] };
  v2.units = [{ id: 'du1', name: 'Fractions', start: '2026-09-01', end: '2026-09-30', color: '#aa0000' }];
  const unitsBefore = clone(v2.units);
  const ab1 = M.absorbLegacy(v2);
  eq([ab1.report.made, ab1.report.lessons, ab1.report.bumps, ab1.report.second], ['course_1', 30, 1, false], 'lessons and a bump become course 1');
  eq([ab1.cal.plan.active, ab1.cal.plan.courses[0].start, ab1.cal.plan.courses[0].name], ['course_1', '2026-09-08', 'Course 1'], '...active, with the old start date');
  eq(ab1.cal.pacing, emptyPacing(), '...and cal.pacing is emptied');
  eq(ab1.cal.units, unitsBefore, 'dated units are not touched (P9-8)');
  eq(v2.pacing.lessons.length, 30, 'absorbLegacy does not change its input');
  eq(M.absorbLegacy(ab1.cal).cal, ab1.cal, 'twice gives the same blob');
  okk(isValid(ab1.cal) && ab1.cal.__v === 2, 'the shipped isValid() still passes the result, __v 2');
  const older = clone(ab1.cal); older.pacing = { startDate: null, lessons: codes(3), adjustments: [] };
  const ab2 = M.absorbLegacy(older);
  eq([ab2.cal.plan.courses.map(c => c.id), ab2.report.second, ab2.cal.plan.active], [['course_1', 'course_2'], true, 'course_1'], 'an older page\'s second write makes a second course');
  const v1 = clone(seed); delete v1.pacing; v1.__v = 1;
  eq(M.absorbLegacy(v1).cal.plan, M.emptyPlan(), 'a v1 blob gets an empty plan');
  const unitsOnly = clone(seed); unitsOnly.units = unitsBefore;
  const ab3 = M.absorbLegacy(unitsOnly);
  eq([ab3.report.made, ab3.cal.units], [null, unitsBefore], 'dated units only: no course, units kept');
  const broken = { ...clone(v2), plan: 'garbage' };
  const ab4 = M.absorbLegacy(broken);
  eq([ab4.cal.planBroken, ab4.report.broken, ab4.cal.plan.courses.length], ['garbage', true, 1], 'a broken plan is kept in planBroken');
  const newer = { ...clone(v2), plan: { v: 2, courses: [], whatever: 1 } };
  const ab5 = M.absorbLegacy(newer);
  eq([ab5.cal.plan, ab5.cal.pacing.lessons.length], [newer.plan, 30], 'a newer plan: nothing touched');

  // ---- stamp, stored and the diff ----
  const stampedCal = M.stamp(ab1.cal, M.placePlan(ab1.cal));
  const sc = stampedCal.plan.courses[0];
  const p0 = M.placeCourse(stampedCal, sc);
  eq(sc.lessons.map(l => l.on), sc.lessons.map(l => p0.dateByLessonId[l.id]), 'stamp writes every lesson\'s date');
  eq(sc.adjustments[0].on, p0.adjDates.a1, '...and the bump\'s');
  eq(sc.units.map(u => [u.start, u.end, u.placed, u.short]), p0.units.map(u => [u.start, u.end, u.placed, u.short]), '...and each unit\'s span');
  eq(ab1.cal.plan.courses[0].lessons[0].on, undefined, 'stamp does not change its input');
  const none = M.diffPlacement(M.stored(sc), p0, '2026-10-01', sc.lessons);
  eq([none.moved, M.describeDiff(none)], [[], ''], 'nothing changed: an empty diff');
  const snowCal = clone(stampedCal);
  snowCal.days['2026-09-21'] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' };
  const p1 = M.placeCourse(snowCal, snowCal.plan.courses[0]);
  const d1 = M.diffPlacement(M.stored(snowCal.plan.courses[0]), p1, '2026-10-01', sc.lessons);
  const movedL = d1.moved.filter(m => m.kind === 'lesson');
  const expectMoved = sc.lessons.filter(l => l.on >= '2026-09-21').length;
  eq([movedL.length, new Set(movedL.map(m => m.by)).size, movedL[0].by], [expectMoved, 1, 1], 'a closure moves every later lesson one class day');
  eq(d1.past, movedL.filter(m => m.from < '2026-10-01').length, 'moved lessons already past are counted');
  okk(d1.past > 0, '...and there are some');
  okk(M.describeDiff(d1).startsWith(`Moved ${expectMoved} lessons one class day later;`), 'the sentence: ' + M.describeDiff(d1));
  okk(/Unit \d+ now ends [A-Z][a-z]{2} \d+, was [A-Z][a-z]{2} \d+/.test(M.describeDiff(d1)), '...names a unit\'s new end');
  okk(/already past\.$/.test(M.describeDiff(d1)), '...and says how many were past');
  const fullCal = clone(stampedCal);
  fullCal.plan.courses[0].lessons = codes(184);
  const fullSync = M.syncUnits(fullCal.plan.courses[0]);
  fullCal.plan.courses[0] = fullSync;
  const fullStamped = M.stamp(fullCal, M.placePlan(fullCal));
  const fullSnow = clone(fullStamped); fullSnow.days['2027-01-12'] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' };
  const d2 = M.diffPlacement(M.stored(fullSnow.plan.courses[0]), M.placeCourse(fullSnow, fullSnow.plan.courses[0]), '2027-01-13', fullSync.lessons);
  eq([M.placeCourse(fullStamped, fullSync).overflow.length, d2.newlyShort.length], [6, 1], '184 lessons and a bump from Sep 8 leave 6 over (five class days are before it); a snow day pushes one more past the end');
  okk(/lessons? no longer fits? before the year ends/.test(M.describeDiff(d2)), '...and the sentence says so');
  const d3 = M.diffPlacement(M.stored(M.stamp(fullSnow, M.placePlan(fullSnow)).plan.courses[0]), M.placeCourse(fullStamped, fullStamped.plan.courses[0]), '2027-01-13', fullSync.lessons);
  eq(d3.nowFits.length, 1, 'removing the snow day: that lesson fits again');
  eq(M.shortDate('2027-02-03'), 'Feb 3', 'dates are written "Feb 3"');

  checks.count = count;
  return fails;
}

const failsMain = checks(await import(pathToFileURL(MODULE).href + '?main'));
const ran = checks.count;
let failed = failsMain.length;
failsMain.forEach(f => console.log('  FAIL ' + f));

const MUTANTS = [
  ['skip before closed', "  const closing = types.find((t) => t.noSchool);\n  if (closing) { out.why = \"closed:\" + closing.id; return out; }\n", ''],
  ['course pace ignored', "(pace[t.id] || t.pace || \"count\")", "(t.pace || \"count\")"],
  ['rotation ignored', "&& out.letter !== course.meets", "&& false"],
  ['lost ignored', "if (lost) { out.why = \"lost:\" + lost.id; return out; }", ''],
  ['half not marked', "out.half = types.some(isHalfType);", ''],
  ['bump after its lesson', "      (before.get(l.id) || []).forEach((a) => slots.push({ kind: \"gap\", unitId: unitOf[l.id], adj: a, lessonId: l.id }));\n      slots.push({ kind: \"lesson\", unitId: unitOf[l.id], lesson: l });",
    "      slots.push({ kind: \"lesson\", unitId: unitOf[l.id], lesson: l });\n      (before.get(l.id) || []).forEach((a) => slots.push({ kind: \"gap\", unitId: unitOf[l.id], adj: a, lessonId: l.id }));"],
  ['orphans placed', "if (!Object.prototype.hasOwnProperty.call(unitOf, a.beforeLessonId)) { orphans.push(a.id); return; }", "if (!Object.prototype.hasOwnProperty.call(unitOf, a.beforeLessonId)) { return; }"],
  ['units touched', "  out.plan = plan;\n  return { cal: out, report };", "  out.plan = plan;\n  out.units = [];\n  return { cal: out, report };"],
  ['pacing kept', "    out.pacing = emptyPacing();\n", ''],
  ['broken thrown away', "if (read.state === \"broken\") { out.planBroken = out.plan; report.broken = true; }", "if (read.state === \"broken\") { report.broken = true; }"],
  ['runs merged by code', "if (last && last.code === l.unit) last.lessonIds.push(l.id);", "const same = runs.find((x) => x.code === l.unit); if (same) same.lessonIds.push(l.id);"],
  ['re-import loses the name', "    if (prev) return { ...prev, days };", "    if (prev) return { ...prev, days, name: \"Unit \" + run.code };"],
  ['diff counts by calendar day', "const countIn = (lo, hi) => dates.filter((d) => d > lo && d <= hi).length;", "const countIn = (lo, hi) => Math.round((Date.parse(hi) - Date.parse(lo)) / 86400000);"],
  ['past not counted', "lessonsMoved.filter((m) => m.from < todayISO).length", "0"],
  ['stamp mutates', "  const out = clone(cal);\n  if (!isObj(out.plan)", "  const out = cal;\n  if (!isObj(out.plan)"],
  ['dates walked in local time', "return d.getUTCFullYear() + \"-\" + String(d.getUTCMonth() + 1).padStart(2, \"0\") + \"-\" + String(d.getUTCDate()).padStart(2, \"0\");",
    "return d.getFullYear() + \"-\" + String(d.getMonth() + 1).padStart(2, \"0\") + \"-\" + String(d.getDate()).padStart(2, \"0\");"],
];

let caught = 0;
// A mutant is imported from a data: URL, its neighbours by absolute file URL, so no file
// is written anywhere.
const abs = f => JSON.stringify(pathToFileURL(path.join(here, '..', f)).href);
for (const [name, from, to] of process.env.PLAN_CHILD ? [] : MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  const src = SRC.replace(from, to).replace('"./scv-pacing.js"', abs('scv-pacing.js')).replace('"./scv-weeks.js"', abs('scv-weeks.js'));
  let red;
  try { red = checks(await import('data:text/javascript,' + encodeURIComponent(src))).length > 0; } catch (e) { red = true; }
  if (red) caught++;
  else { console.log(`  FAIL mutant "${name}" passed every check`); failed++; }
}

const zone = process.env.TZ;
console.log(`plan (TZ=${zone}): ${ran - failsMain.length}/${ran} checks passed` + (process.env.PLAN_CHILD ? '' : `; ${caught}/${MUTANTS.length} deliberate breaks caught`));

if (!process.env.PLAN_CHILD) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, TZ: 'Pacific/Kiritimati', PLAN_CHILD: '1' }, encoding: 'utf8' });
  process.stdout.write(child.stdout || '');
  process.stderr.write(child.stderr || '');
  if (child.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
