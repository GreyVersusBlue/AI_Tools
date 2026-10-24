// plan.test.mjs — pure-logic tests for Tools/school-calendar/scv-plan.js (Path 9 P2,
// increment 1, the module half): the plan record's reader, the migration from
// `cal.pacing`, what counts as a class day for a course, the placer for lessons and for
// typed unit lengths with pins and open days, stamping, the diff that says what a change
// moved, turning dated units into a course, and the baseline with slip(), whose `behind`
// must equal the sum of its causes over 500 random edit sequences (increment 3), and
// buffers, the A/B split and carryForward() for a new year (increment 4).
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
function checks(M, full = true) {
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

  // ---- pins and open days (increment 2) ----
  const pinned = (pin3, pin2) => {
    const c = clone(flow);
    c.units[2].pin = pin3 || null;
    if (pin2) c.units[1].pin = pin2;
    return M.placeCourse(seed, c);
  };
  const po = pinned('2026-10-01');
  eq([po.units[2].start, po.units[2].open, po.units[2].pinShift, po.units[1].short], ['2026-10-01', 4, false, 0], 'unit 3 pinned at Oct 1 leaves 4 open days');
  eq(po.slots['2026-09-28'], undefined, '...which hold nothing');
  const ps = pinned('2026-09-21');
  eq([ps.units[1].placed, ps.units[1].short, ps.units[1].end, ps.units[2].start, ps.units[2].short], [4, 4, '2026-09-18', '2026-09-21', 0], 'pinned at Sep 21: unit 2 is short 4 and keeps its first days');
  okk(ps.problems.some(p => p.code === 'short' && p.unitId === 'u2'), '...and the placer says so');
  const sat = pinned('2026-10-03');
  eq([sat.units[2].start, sat.units[2].pinShift], ['2026-10-05', true], 'a pin on a Saturday starts on the next class day, and says so');
  const early = pinned('2026-09-15');
  eq([early.units[2].pinIgnored, early.units[2].start, early.problems.map(p => p.code)], [true, '2026-09-25', ['pin-before-previous']], 'a pin on the start of the unit before it is not honoured');
  const late = pinned('2027-07-01');
  eq([late.units[2].placed, late.units[2].short, late.problems.map(p => p.code).sort()], [0, 12, ['pin-after-year', 'short']], 'a pin after the year: the whole unit is short');
  const twin = pinned('2026-10-01', '2026-10-01');
  eq([twin.units[1].start, twin.units[2].pinIgnored, twin.units[1].open], ['2026-10-01', true, 12], 'two units pinned to one date: the second is not honoured');
  eq(pinned(null).units, fp.units.map(u => ({ ...u })), 'no pin: the flow is unchanged');
  const pinJan = clone(jan); pinJan.units[1].pin = '2027-02-03';
  const pj0 = M.placeCourse(seed, pinJan), pj1 = M.placeCourse(snow, pinJan);
  eq([pj0.units[0].short, pj0.units[1].start], [0, '2027-02-03'], 'back-to-back pinned windows fit');
  eq([pj1.units[0].short, pj1.units[0].end, pj1.units[1].start], [1, '2027-02-02', '2027-02-03'], 'a snow day inside the first: it is short 1 and the pinned one does not move');
  const flowJan = M.unpinAfterFirst(pinJan);
  eq([flowJan.units[1].pin, M.placeCourse(snow, flowJan).units[1].start, pinJan.units[1].pin], [null, '2027-02-04', '2027-02-03'], 'letting them flow: the next unit moves, and the input is untouched');
  const firstPinned = { ...clone(flow), units: clone(flow.units) };
  firstPinned.units[0].pin = '2026-09-08'; firstPinned.units[2].pin = '2026-10-20';
  eq(M.unpinAfterFirst(firstPinned).units.map(u => u.pin), ['2026-09-08', null, null], 'the first unit keeps its pin');
  const fpp = M.placeCourse(seed, firstPinned);
  eq([fpp.units[0].start, fpp.units[0].open], ['2026-09-08', 5], 'a pinned first unit leaves the days before it open');
  const lpin = clone(lessonCourse); lpin.units[1].pin = '2026-09-21';
  const lpp = M.placeCourse(seed, lpin);
  const firstOf2 = lessons.find(l => l.unit === '2');
  eq([lpp.adjDates.adj1 < lpp.dateByLessonId[firstOf2.id] ? 'gap' : 'lesson', lpp.units[1].start, lpp.units[1].open], ['lesson', '2026-09-21', 9], 'lesson mode: unit 2 pinned at Sep 21 starts there, its first lesson first, after 9 open days');
  okk(Object.keys(lpp.byDate).every(d => d < '2026-09-14' || d >= '2026-09-21'), '...and the open days hold no lesson');
  const lshort = clone(lessonCourse); lshort.units[1].pin = '2026-09-03';
  const lsp = M.placeCourse(seed, lshort);
  eq([lsp.overflow.map(l => l.unit), lsp.units[0].short, lsp.units[0].end], [['1', '1'], 2, '2026-09-02'], 'lesson mode: a pin inside unit 1 makes its last lessons overflow');
  // the diff of a typed course reports short units
  const tStamp = clone(seed); tStamp.plan = { ...M.emptyPlan(), active: 'tj', courses: [{ ...clone(pinJan), id: 'tj' }] };
  const tS = M.stamp(tStamp, M.placePlan(tStamp));
  const tSnow = clone(tS); tSnow.days['2027-01-12'] = snow.days['2027-01-12'];
  const td = M.diffPlacement(M.stored(tSnow.plan.courses[0]), M.placeCourse(tSnow, tSnow.plan.courses[0]), '2027-01-05', []);
  eq(td.shortUnits.map(u => [u.label, u.from, u.to]), [['Twenty', 0, 1]], 'a typed unit that became short is in the diff');
  okk(/Twenty is now 1 day short/.test(M.describeDiff(td)), 'the sentence: ' + M.describeDiff(td));

  // ---- converting dated units ----
  const dated = clone(seed);
  const tdays = d => isTeachableDay(d, seed.days, seed.dayTypes);
  let convBad = 0, convN = 0;
  // The sweep runs against the real module only; the mutants get the cases below it.
  for (let s0 = 0; full && s0 < 290; s0 += 7) {
    const st = addDays('2026-08-24', s0);
    for (const len of [0, 4, 20, 61]) {
      const en = addDays(st, len);
      const lo = st < seed.meta.start ? seed.meta.start : st, hi = en > seed.meta.end ? seed.meta.end : en;
      const want = allDates.filter(d => d >= lo && d <= hi && tdays(d));
      dated.units = [{ id: 'd1', name: 'W', start: st, end: en, color: '#000000' }];
      const cv = M.convertDatedUnits(dated, ['d1']);
      if (!want.length) { if (!(cv.refused.length === 1 && cv.refused[0].why === 'no-school-day')) convBad++; continue; }
      convN++;
      const pc = M.placeCourse(dated, cv.course);
      const got = Object.keys(pc.slots).sort();
      if (!isDeepStrictEqual(got, want) || cv.refused.length || pc.units[0].short) convBad++;
    }
  }
  if (full) eq(convBad, 0, `a converted unit covers the same school days it did (${convN} start/end pairs across the year, and every empty one refused)`);
  if (full) okk(convN > 100, '...over enough pairs');
  dated.units = [
    { id: 'b', name: 'Second', start: '2026-10-01', end: '2026-10-30', color: '#222222' },
    { id: 'a', name: 'First', start: '2026-09-01', end: '2026-09-30', color: '#111111' },
    { id: 'c', name: 'Left alone', start: '2026-11-02', end: '2026-11-20', color: '#333333' },
  ];
  const two = M.convertDatedUnits(dated, ['b', 'a'], { name: 'Science', taken: ['course_1'] });
  eq([two.course.id, two.course.name, two.course.units.map(u => [u.name, u.pin, u.days, u.color]), two.removeIds, two.refused],
    ['course_2', 'Science', [['First', '2026-09-01', 21, '#111111'], ['Second', '2026-10-01', 21, '#222222']], ['a', 'b'], []],
    'two dated units become a course, sorted by start, pinned, with their counted days and colours');
  const twoP = M.placeCourse(dated, two.course);
  eq(twoP.units.map(u => [u.start, u.end, u.short, u.open]), [['2026-09-01', '2026-09-30', 0, 1], ['2026-10-01', '2026-10-30', 0, 0]], '...and each lands on its old span');
  eq(dated.units.length, 3, 'convertDatedUnits writes nothing');
  dated.units[1].end = '2026-10-02';
  const ov = M.convertDatedUnits(dated, ['a', 'b']);
  eq([ov.refused, ov.removeIds], [[{ a: 'a', b: 'b', why: 'overlap' }], []], 'overlapping units are refused, the pair named');
  dated.units.push({ id: 'e', name: 'Weekend', start: '2026-11-28', end: '2026-11-29', color: '#444444' }, { id: 'f', name: 'No dates', start: '', end: '', color: '#555555' });
  eq(M.convertDatedUnits(dated, ['e', 'f', 'c']).refused, [{ a: 'e', b: null, why: 'no-school-day' }, { a: 'f', b: null, why: 'no-dates' }], 'a window with no school day, and one with no dates, are refused');

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

  // ---- the baseline and "behind" (increment 3) ----
  {
  const snowOn = (cal, d) => { const c = clone(cal); c.days[d] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' }; return c; };
  const lessonCourse = (n, units) => M.syncUnits({ ...M.newCourse('World History', { id: 'wh' }), lessons: codes(n, units) });
  const based = (cal, c, today) => { const p = M.placeCourse(cal, c, abLetters(cal)); return M.setBaseline(cal, c, p, today); };
  const slipOf = (cal, c, today) => M.slip(cal, c, M.placeCourse(cal, c, abLetters(cal)), today);
  const total = s => s.causes.reduce((a, cz) => a + cz.n, 0);
  const wh0 = lessonCourse(120, [20, 20, 20]);
  const P0 = M.placeCourse(seed, wh0, L);
  const D = P0.classDates;
  const wh = M.setBaseline(seed, wh0, P0, '2026-08-20');
  eq([wh.baseline.setOn, wh.baseline.start, wh.baseline.seq.length, wh.baseline.units.map(u => u.days)], ['2026-08-20', '2026-08-31', 120, [20, 20, 20, 20, 20, 20]], 'the baseline keeps the slot order and each unit\'s count');
  const rb = M.baselinePlacement(wh.baseline);
  eq([rb.classDates, rb.order.map(o => o.date)], [D, P0.order.map(o => o.date)], 'the baseline\'s placement is rebuilt exactly from its mask and order');
  okk(JSON.stringify(M.setBaseline(seed, lessonCourse(184), M.placeCourse(seed, lessonCourse(184), L), '2026-08-20').baseline).length < 4096, 'a 184-lesson baseline is under 4 KB');
  eq(M.slip(seed, wh0, P0, '2026-10-01'), null, 'no baseline: no slip');
  const today = D[30];
  const s0 = slipOf(seed, wh, today);
  eq([s0.behind, s0.causes, s0.about, s0.nowOn, s0.plannedOn], [0, [], false, today, today], 'no change: 0 behind, no causes');
  eq(slipOf(seed, wh, '2026-08-20').key, null, 'before the course starts: nothing to measure, 0');
  const sLost = slipOf(snowOn(seed, D[12]), wh, today);
  eq([sLost.behind, sLost.causes.map(c => [c.kind, c.n]), sLost.causes[0].items[0]], [1, [['lost', 1]], { date: D[12], why: 'closed:holiday' }], 'a closure before today: 1 behind, its cause the snow day');
  okk(/^World History: 1 class day behind the plan of Aug 20\. U2-11-A-Lesson 31 was planned for today and is now [A-Z][a-z]+ \d+\. Lost: [A-Z][a-z]+ \d+ \(Holiday \/ No School\)\.$/.test(M.describeSlip(seed, wh, sLost, 'World History')), 'the sentence names the item, its two dates and the lost day');
  const sTwo = slipOf(snowOn(snowOn(seed, D[12]), D[13]), wh, today);
  okk(sTwo.behind === 2 && /Lost: [A-Z][a-z]+ \d+ and \d+ \(Holiday/.test(M.describeSlip(seed, wh, sTwo)), 'two days in one month are "Jan 12 and 13"');
  const tMid = D[25];
  const later = snowOn(seed, D[35]);
  const sAfter = slipOf(later, wh, tMid);
  eq([sAfter.behind, sAfter.causes, sAfter.unit.id, sAfter.unit.endWas, sAfter.unit.endNow], [0, [], wh.units[1].id, D[39], D[40]], 'a closure after today: 0 today, and X\'s unit ends a class day later');
  const whGap = { ...wh, adjustments: [{ id: 'adj_1', beforeLessonId: wh.lessons[10].id, reason: 'ran long', createdOn: '2026-09-10' }] };
  const sGap = slipOf(seed, whGap, today);
  eq([sGap.behind, sGap.causes.map(c => [c.kind, c.n]), sGap.causes[0].items[0].lesson], [1, [['gap-added', 1]], { code: 'U1-11-A', reason: 'ran long' }], 'a bump before X: 1 behind, the bump is the cause');
  okk(/Added: one day for U1-11-A \(ran long\)\./.test(M.describeSlip(seed, whGap, sGap)), '...and the sentence says "Added: one day for U1-11-A (ran long)"');
  const whGapB = based(seed, whGap, '2026-08-20');
  const back = { ...whGapB, adjustments: [] };
  const sBack = slipOf(seed, back, today);
  eq([sBack.behind, sBack.causes.map(c => [c.kind, c.n])], [-1, [['gap-removed', -1]]], 'a bump given back: 1 ahead');
  okk(/^1 class day ahead of the plan of Aug 20\./.test(M.describeSlip(seed, back, sBack)), '...and the sentence says ahead');
  const onGap = M.placeCourse(seed, whGapB, L).adjDates.adj_1;
  const sOnGap = slipOf(seed, whGapB, onGap);
  eq([sOnGap.behind, sOnGap.about, sOnGap.key.startsWith('U')], [0, false, true], 'today on a planned bump: X is the lesson before it, nothing is about');
  const sOnGapSnow = slipOf(snowOn(seed, D[3]), whGapB, onGap);
  eq(sOnGapSnow.behind, 1, '...and a closure before it is 1 behind, not 0');
  const snowBase = based(snowOn(seed, D[12]), wh0, '2026-08-20');
  const sGain = slipOf(seed, snowBase, today);
  eq([sGain.behind, sGain.causes.map(c => [c.kind, c.n])], [-1, [['gained', -1]]], 'a closure taken away again: a class day gained, 1 ahead');
  const ins = clone(wh); ins.lessons.splice(4, 0, { id: 'les_new', raw: 'U1-99-A-Extra', unit: '1', num: '99', letter: 'A', title: 'Extra' });
  const sIns = slipOf(seed, M.syncUnits(ins), today);
  eq([sIns.behind, sIns.causes.map(c => [c.kind, c.n]), sIns.causes[0].items[0].label], [1, [['added', 1]], 'U1-99-A-Extra'], 'a lesson inserted before X: 1 behind');
  const xKey = s0.key;
  const rem = clone(wh); rem.lessons = rem.lessons.filter(l => 'U' + l.unit + '-' + l.num + '-' + l.letter !== xKey);
  const sRem = slipOf(seed, M.syncUnits(rem), today);
  eq([sRem.about, sRem.behind, total(sRem), sRem.plannedOn], [true, 0, 0, D[29]], 'X taken out: the lesson before it stands in, "about"');
  okk(/^about on the plan of Aug 20\.$/.test(M.describeSlip(seed, rem, sRem)), '...and the sentence says about');
  // typed units: open days before a pin take a loss
  const ty0 = { ...M.newCourse('Science', { id: 'sci' }), units: [M.newUnit('Cells', 10, { id: 'u1' }), { ...M.newUnit('Energy', 10, { id: 'u2' }), pin: D[14] }] };
  const ty = based(seed, ty0, '2026-08-20');
  eq(M.baselinePlacement(ty.baseline).order.map(o => o.date), M.placeCourse(seed, ty0, L).order.map(o => o.date), 'a pinned course\'s baseline is rebuilt exactly');
  const sOpen = slipOf(snowOn(seed, D[3]), ty, D[17]);
  eq([sOpen.behind, sOpen.causes.map(c => [c.kind, c.n]), sOpen.item], [0, [['lost', 1], ['open', -1]], 'Energy, day 4'], 'open days before a pin take a loss: 0 behind');
  okk(/Open days used: 1\./.test(M.describeSlip(seed, ty, sOpen)), '...and the sentence says an open day was used');
  const tyLong = clone(ty); tyLong.units[0].days = 16;
  const sLong = slipOf(seed, tyLong, D[17]);
  eq([sLong.behind, sLong.causes.map(c => [c.kind, c.n])], [0, [['added', 4], ['open', -4]]], 'a unit run up to the next pin: its open days take the new days, and the pin holds');
  const tyEarly = clone(ty); tyEarly.units[1].pin = D[8];
  const sCut = slipOf(seed, tyEarly, D[17]);
  eq([sCut.behind, sCut.causes.map(c => [c.kind, c.n])], [-6, [['unplaced', -2], ['open', -4]]], 'a pin moved earlier: the unit before it loses its last 2 days and the open 4, 6 ahead');
  okk(/No longer fitting before it: Cells, day 9, Cells, day 10\./.test(M.describeSlip(seed, tyEarly, sCut)), '...and the sentence names the days that no longer fit');
  // when the baseline is set
  eq([M.wantsBaseline(wh0, P0, '2026-08-20'), M.wantsBaseline(wh, P0, '2026-08-20'), M.wantsBaseline(wh, P0, '2026-08-31'), M.wantsBaseline(wh, P0, '2026-10-01')], [true, true, false, false], 'a baseline is set when a course has none, and again while today is before its first class day');
  const emptyBased = based(seed, M.newCourse('E'), '2026-08-20');
  eq([emptyBased.baseline.seq, M.wantsBaseline(emptyBased, P0, '2026-10-01')], [[], true], 'a baseline with nothing planned in it is set again when the lessons come');
  const ab = based(seed, { ...lessonCourse(60), meets: 'A' }, '2026-08-20');
  const abCal = { ...seed, abCycle: { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'A' } };
  const abBased = based(abCal, { ...lessonCourse(60), meets: 'A' }, '2026-08-20');
  const abD = M.placeCourse(abCal, abBased, abLetters(abCal)).classDates;
  const sAB = slipOf(snowOn(abCal, abD[5]), abBased, abD[20]);
  okk(ab.baseline && sAB.behind === 1 && sAB.causes[0].items[0].date === abD[5], 'an A course is behind in A days');
  // the identity, over random edit sequences
  if (full) {
    const r = rng(9);
    let bad = 0, oracleBad = 0, runs = 0;
    for (let t = 0; t < 500; t++) {
      let c = lessonCourse(60 + Math.floor(r() * 120), [5 + Math.floor(r() * 20), 8, 12]);
      let cal = clone(seed);
      if (r() < 0.3) cal = snowOn(cal, D[Math.floor(r() * 100)]);
      const typed = r() < 0.3;
      if (typed) c = { ...M.newCourse('T', { id: 't' }), units: [10, 12, 8, 15].map((n, k) => ({ ...M.newUnit('U' + k, n + Math.floor(r() * 5), { id: 'u' + k }), pin: r() < 0.4 ? D[Math.floor(r() * 80)] : null })) };
      c = based(cal, c, '2026-08-20');
      let listEdited = false, pinned = typed && c.units.some(u => u.pin);
      for (let e = 0, n = 1 + Math.floor(r() * 6); e < n; e++) {
        const kind = Math.floor(r() * 6);
        const d = D[Math.floor(r() * D.length)];
        if (kind === 0) cal = snowOn(cal, d);
        else if (kind === 1) { const ks = Object.keys(cal.days).filter(k => (cal.days[k].types || []).includes('holiday')); if (ks.length) delete cal.days[ks[Math.floor(r() * ks.length)]]; }
        else if (kind === 2) c = { ...c, lost: [...c.lost, { id: 'l' + e, date: d, reason: 'Assembly' }] };
        else if (kind === 3 && !typed) { c = { ...c, adjustments: [...c.adjustments, { id: 'a' + t + '_' + e, beforeLessonId: c.lessons[Math.floor(r() * c.lessons.length)].id, reason: 'ran long' }] }; listEdited = true; }
        else if (kind === 4 && !typed && c.lessons.length > 10) { const cc = clone(c); cc.lessons.splice(Math.floor(r() * cc.lessons.length), 1); c = M.syncUnits(cc); listEdited = true; }
        else if (kind === 5 && typed) { const cc = clone(c); cc.units[Math.floor(r() * cc.units.length)].days += r() < 0.5 ? 1 : -1; c = cc; listEdited = true; }
      }
      const td = D[Math.floor(r() * D.length)];
      const p = M.placeCourse(cal, c, abLetters(cal));
      const s = M.slip(cal, c, p, td);
      runs++;
      if (s.behind !== total(s)) bad++;
      if (!listEdited && !pinned && s.key && !s.about) {
        const base = M.baselinePlacement(c.baseline).classDates;
        const now = new Set(p.classDates), was = new Set(base);
        const oracle = base.filter(x => x <= td && !now.has(x)).length - p.classDates.filter(x => x <= td && !was.has(x)).length;
        if (oracle !== s.behind) oracleBad++;
      }
    }
    eq([runs, bad, oracleBad], [500, 0, 0], '500 random edit sequences: behind is the sum of its causes, and with only days changed it is the class days lost less those gained up to today');
  }
  }

  // ---- buffers, the A/B split and the new year (increment 4) ----
  {
  const snowOn = (cal, ...ds) => { const c = clone(cal); ds.forEach(d => { c.days[d] = { types: ['holiday'], label: 'Snow Day', note: '', lesson: '' }; }); return c; };
  const based = (cal, c, today) => M.setBaseline(cal, c, M.placeCourse(cal, c, abLetters(cal)), today);
  const total = s => s.causes.reduce((a, cz) => a + cz.n, 0);
  const D = M.classDays(seed, M.newCourse('x')).days.map(d => d.date);
  // typed: Cells 10 days, the last 2 buffer; Energy 10
  const ty0 = { ...M.newCourse('Science', { id: 'sci' }), units: [{ ...M.newUnit('Cells', 10, { id: 'u1' }), flex: 2 }, M.newUnit('Energy', 10, { id: 'u2' })] };
  const tyB = based(seed, ty0, '2026-08-20');
  const ends = (cal, c) => M.placeCourse(cal, c, abLetters(cal)).units.map(u => [u.end, u.buffered]);
  eq(ends(seed, tyB), [[D[9], 0], [D[19], 0]], 'buffers: nothing lost, nothing used');
  eq(ends(snowOn(seed, D[3]), tyB), [[D[10], 0], [D[20], 0]], 'buffers off (the default, P9-5): a snow day inside the unit moves its end and the next unit');
  const tyOn = { ...tyB, absorb: true };
  const p1 = M.placeCourse(snowOn(seed, D[3]), tyOn, L);
  eq([p1.units.map(u => [u.end, u.short, u.buffered, u.flex]), p1.buffers], [[[D[9], 0, 1, 2], [D[19], 0, 0, 0]], [{ unitId: 'u1', key: 'D:u1#10', lessonId: null, for: { date: D[3] } }]], 'buffers on: the unit\'s last buffer day takes the snow day, and its end holds');
  eq(ends(snowOn(seed, D[3], D[5]), tyOn).map(e => e[1]), [2, 0], 'two lost days: both buffer days');
  const three = M.placeCourse(snowOn(seed, D[3], D[5], D[7]), tyOn, L).units;
  eq([three[0].buffered, three[0].end, three[1].start], [2, D[10], D[11]], 'three lost days and two buffer days: the unit ends one class day later');
  eq(ends(snowOn(seed, D[14]), tyOn)[0][1], 0, 'a loss outside the unit\'s baseline span takes none of its buffer');
  eq(M.placeCourse(snowOn(seed, D[3]), { ...ty0, absorb: true }, L).buffers, [], 'with no baseline, no buffer is used');
  const tiny = based(seed, { ...M.newCourse('T', { id: 't' }), absorb: true, units: [{ ...M.newUnit('Tiny', 2, { id: 'u1' }), flex: 2 }] }, '2026-08-20');
  eq(M.placeCourse(snowOn(seed, D[0], D[1], D[2]), tiny, L).units[0].buffered, 1, 'a unit never gives up its every day to buffers');
  // lesson mode: BUF lessons are the buffer days
  const raw = [];
  for (let k = 1; k <= 8; k++) raw.push(`U1-${String(k).padStart(2, '0')}-${k % 2 ? 'A' : 'B'}-L${k}`);
  raw.push('U1-BUF1-A-Review', 'U1-BUF2-B-Review');
  for (let k = 1; k <= 10; k++) raw.push(`U2-${String(k).padStart(2, '0')}-${k % 2 ? 'A' : 'B'}-M${k}`);
  const les = parseLessonList(raw.join('\n')).lessons;
  const lc0 = { ...M.syncUnits({ ...M.newCourse('History', { id: 'h' }), lessons: les }), absorb: true };
  const lcB = based(seed, lc0, '2026-08-20');
  const lcStamped = M.stamp({ ...seed, plan: { v: 1, active: 'h', algo: 1, courses: [lcB] } }, { h: M.placeCourse(seed, lcB, L) }).plan.courses[0];
  const bump = { ...lcStamped, adjustments: [{ id: 'adj_1', beforeLessonId: les[2].id, reason: 'ran long', createdOn: '2026-09-02' }] };
  const pb = M.placeCourse(seed, bump, L);
  eq([pb.buffers.map(b => [b.lessonId, b.for]), pb.dateByLessonId[les[9].id], pb.dateByLessonId[les[10].id], pb.overflow.length], [[[les[9].id, { gap: 'adj_1' }]], undefined, D[10], 0], 'a bump added in a unit: its last BUF lesson takes it, and the next unit starts on time');
  const bumpStamped = M.stamp({ ...seed, plan: { v: 1, active: 'h', algo: 1, courses: [bump] } }, { h: pb }).plan.courses[0];
  const st = M.stored(bumpStamped);
  eq([bumpStamped.lessons[9].on, bumpStamped.units[0].buffered, st.bufferIds, st.overflowIds], [null, 1, [les[9].id], []], 'stamped: the buffer lesson has no date, its unit says 1 used, and stored() tells it from overflow');
  const d1 = M.diffPlacement(M.stored(lcStamped), pb, '2026-08-20', les);
  eq([d1.bufferUnits, d1.newlyShort], [[{ id: lcB.units[0].id, label: 'Unit 1', from: 0, to: 1 }], []], 'the diff says a buffer day was used, and no lesson is short');
  okk(/Unit 1 used 1 buffer day/.test(M.describeDiff(d1)), '...and the sentence says so');
  const d2 = M.diffPlacement(M.stored(bumpStamped), M.placeCourse(seed, { ...bumpStamped, adjustments: [] }, L), '2026-08-20', les);
  eq([d2.nowFits, d2.bufferUnits.map(u => [u.from, u.to])], [[], [[1, 0]]], 'the bump taken away: the buffer is back, not a lesson that "fits again"');
  okk(/Unit 1 has 1 buffer day back/.test(M.describeDiff(d2)), '...and the sentence says the buffer day is back');
  const sB = M.slip(snowOn(seed, D[3]), tyOn, p1, D[12]);
  eq([sB.behind, sB.causes.map(c => [c.kind, c.n]), total(sB)], [0, [['lost', 1], ['buffer', -1]], 0], 'slip: a loss a buffer took leaves the course on the plan, and the ledger names both');
  okk(/Buffer days used: 1 day\./.test(M.describeSlip(seed, tyOn, sB)), '...and the sentence names the buffer');
  eq(M.absorbLegacy({ ...seed, pacing: { ...emptyPacing(), lessons: les } }).cal.plan.courses[0].absorb, false, 'a migrated course never absorbs');
  if (full) {
    const r = rng(41);
    let bad = 0;
    for (let t = 0; t < 200; t++) {
      let cal = clone(seed);
      let c = { ...M.newCourse('T', { id: 't' }), absorb: true, units: [10, 12, 8].map((n, k) => ({ ...M.newUnit('U' + k, n, { id: 'u' + k }), flex: Math.floor(r() * 4), pin: k && r() < 0.3 ? D[10 + Math.floor(r() * 30)] : null })) };
      c = based(cal, c, '2026-08-20');
      for (let e = 0, n = 1 + Math.floor(r() * 5); e < n; e++) {
        if (r() < 0.7) cal = snowOn(cal, D[Math.floor(r() * 40)]);
        else c = { ...c, lost: [...c.lost, { id: 'l' + e, date: D[Math.floor(r() * 40)], reason: 'Assembly' }] };
      }
      const s = M.slip(cal, c, M.placeCourse(cal, c, abLetters(cal)), D[Math.floor(r() * 45)]);
      if (s.behind !== total(s)) bad++;
    }
    eq(bad, 0, '200 random losses with buffers on: behind is still the sum of its causes');
  }

  // the A/B split
  const abCal = { ...seed, abCycle: { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'A' } };
  const AL = abLetters(abCal);
  const joint = M.syncUnits({ ...M.newCourse('World History', { id: 'wh' }), lessons: codes(184, [20, 20, 20]) });
  joint.units[1].name = 'Empires';
  const sp = M.splitPreview(abCal, based(abCal, joint, '2026-08-20'), { taken: ['wh'], todayISO: '2026-08-20' });
  eq([sp.refused, sp.courses.map(c => [c.id, c.name, c.meets, c.lessons.length, c.baseline]), sp.diff.moved.length, sp.diff.newlyShort.length, sp.text], [null, [['wh', 'World History (A)', 'A', 92, null], ['course_1', 'World History (B)', 'B', 92, null]], 0, 0, ''], 'split with no bumps: two courses of 92, the A half keeps the id, and no date moves');
  eq(sp.courses[1].units.map(u => u.name).slice(0, 2), ['Unit 1', 'Empires'], '...each keeps its units\' names');
  const mismatch = (cal, c) => { const p = M.placeCourse(cal, c, abLetters(cal)); return c.lessons.filter(l => p.dateByLessonId[l.id] && abLetters(cal)[p.dateByLessonId[l.id]] !== l.letter).length; };
  const jb = { ...joint, adjustments: [{ id: 'adj_1', beforeLessonId: joint.lessons[40].id, reason: 'ran long' }] };
  eq(mismatch(abCal, jb), 143, 'one bump on the joined list puts 143 lessons on the other letter\'s day');
  const split = M.splitByLetter(jb, { taken: ['wh'] });
  eq([split.courses.map(c => c.adjustments.map(a => a.id)), split.courses.map(c => mismatch(abCal, c))], [[['adj_1'], []], [0, 0]], '...split, the bump goes with its lesson and no lesson is on the wrong letter');
  const bP = M.placeCourse(abCal, split.courses[1], AL), bP0 = M.placeCourse(abCal, M.splitByLetter(joint, { taken: ['wh'] }).courses[1], AL);
  eq(bP.dateByLessonId, bP0.dateByLessonId, '...and the bump moves the A track only');
  eq([M.splitByLetter({ ...joint, meets: 'A' }).refused, M.splitByLetter(M.newCourse('E')).refused, M.splitByLetter({ ...joint, lessons: joint.lessons.filter(l => l.letter === 'A') }).refused], ['already-split', 'no-lessons', 'one-letter'], 'split refuses an A course, an empty one and a one-letter list');
  eq(M.splitByLetter({ ...joint, adjustments: [{ id: 'gone', beforeLessonId: 'les_999' }] }).orphans, ['gone'], 'a bump with no lesson is named, and neither half keeps it');

  // the new year
  const old = clone(lcB);
  old.start = '2026-09-08'; old.lost = [{ id: 'l1', date: D[4], reason: 'Assembly' }];
  old.adjustments = [{ id: 'adj_1', beforeLessonId: les[2].id, reason: 'ran long' }];
  old.units[0].pin = '2026-09-08'; old.pace = { halfday: 'skip' }; old.color = '#123456';
  const oldStamped = M.stamp({ ...seed, plan: { v: 1, active: 'sci', algo: 1, courses: [old, tyB] } }, { h: M.placeCourse(seed, old, L), sci: M.placeCourse(seed, tyB, L) }).plan;
  const cf = M.carryForward(oldStamped);
  eq(cf.dropped, { pins: 1, lost: 1, bumps: 1, baselines: 2, starts: 1 }, 'carryForward counts what it drops');
  const [nh, ns] = cf.plan.courses;
  eq([cf.plan.active, nh.name, nh.color, nh.meets, nh.pace, nh.absorb, nh.lessons.length, nh.lessons.some(l => 'on' in l), nh.adjustments, nh.lost, nh.baseline, nh.start],
    ['sci', 'History', '#123456', 'all', { halfday: 'skip' }, true, 20, false, [], [], null, null], 'a lesson course keeps its name, colour, meets, pace, absorb and lessons, and loses its dates');
  eq([nh.units.map(u => [u.name, u.days, u.pin, u.start, u.end, u.placed, 'buffered' in u])[0], ns.units.map(u => [u.name, u.days, u.flex, u.pin])], [['Unit 1', 10, null, null, null, 0, false], [['Cells', 10, 2, null], ['Energy', 10, 0, null]]], '...units keep names, days and flex, and lose pins and dates');
  eq(M.carryForward('nope').plan.courses, [], 'a broken plan carries nothing');
  }

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
  ['pins ignored', "    if (u && typeof u.pin === \"string\"", "    if (false && u && typeof u.pin === \"string\""],
  ['open days not counted', "        if (j > i) st.open += j - i;\n", "        if (j > i) st.open += 0;\n"],
  ['no take-back', "        else for (let k = 0; k < s; k++) if (dayOf[k] >= j) dayOf[k] = -1;\n        i = j;", "        else j = i;\n        i = j;"],
  ['earlier pin honoured', "      } else if (j <= prevStart) {", "      } else if (j < 0) {"],
  ['pin shift silent', "if (dates[j] !== u.pin) st.pinShift = true;", ""],
  ['convert counts weekdays', "unitInstructionalStats(from, to, cal.days, cal.dayTypes).instructionalDays", "unitInstructionalStats(from, to, cal.days, cal.dayTypes).weekdays"],
  ['overlap allowed', "if (ranged[m].u.end >= ranged[k].u.start) refused.push", "if (false) refused.push"],
  ['convert unsorted', "  ranged.sort((x, y) => (x.u.start < y.u.start ? -1 : x.u.start > y.u.start ? 1 : 0));\n", ""],
  ['unpin clears the first', "if (k > 0) u.pin = null;", "u.pin = null;"],
  ['short units unreported', "if (typed && b && (b.short || 0) !== (u.short || 0))", "if (false)"],
  ['lost days not in the ledger', 'if (d <= todayISO && !nowSet.has(d)) add("lost"', 'if (false) add("lost"'],
  ['open days not in the ledger', 'if (dOpen) causes.open', 'if (false) causes.open'],
  ['X may be a bump', 'if (o.date && o.date <= todayISO && o.kind !== "G") { xi = k; break; }', 'if (o.date && o.date <= todayISO) { xi = k; break; }'],
  ['mask of every day', 'mask += on.has(msToIso(ms)) ? "1" : "0";', 'mask += "1";'],
  ['baseline set once only', 'return !!(first && todayISO && todayISO < first);', 'return false;'],
  ['ahead said as behind', '(s.behind > 0 ? "behind" : "ahead of")', '"behind"'],
  ['baseline rebuilt without pins', 'b.units.forEach((u) => { unitById[u.id] = u;', 'b.units.forEach((u) => { unitById[u.id] = { ...u, pin: null };'],
  ['unfitting days called removed', 'add(buffered.has(key) ? "buffer" : inNow.has(key) ? "unplaced"', 'add(buffered.has(key) ? "buffer" : inNow.has(key) ? "removed"'],
  ['buffers when off', 'if (!course.absorb) return [];', ''],
  ['buffers take every day', 'reasons.length, idx.length - 1);', 'reasons.length, idx.length);'],
  ['buffers first not last', 'const k = flex[flex.length - 1 - m];', 'const k = flex[m];'],
  ['buffer counted short', 'if (isBuf.has(k)) { if (st) st.buffered++; return; }', 'if (isBuf.has(k)) { if (st) st.short++; return; }'],
  ['buffer lessons stored as overflow', '    else if (buf.has(l.id)) out.bufferIds.push(l.id);\n', ''],
  ['buffer not in the ledger', 'add(buffered.has(key) ? "buffer" :', 'add(false ? "buffer" :'],
  ['split drops bumps', 'c.adjustments = c.adjustments.filter((a) => mine.has(a.beforeLessonId));', 'c.adjustments = [];'],
  ['split keeps the baseline', '    c.baseline = null;\n    c.lessons = c.lessons.filter', '    c.lessons = c.lessons.filter'],
  ['carry keeps pins', '...u, pin: null, start: null,', '...u, start: null,'],
  ['carry keeps bumps', '    n.absorb = !!c.absorb;\n', '    n.absorb = !!c.absorb;\n    n.adjustments = c.adjustments;\n'],
  ['behind ignores the baseline', '- (upTo(baseDates, X.date) - upTo(baseDates, todayISO));', ';'],
];

let caught = 0;
// A mutant is imported from a data: URL, its neighbours by absolute file URL, so no file
// is written anywhere.
const abs = f => JSON.stringify(pathToFileURL(path.join(here, '..', f)).href);
for (const [name, from, to] of process.env.PLAN_CHILD ? [] : MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  FAIL mutant "${name}": its text is not in the module any more`); failed++; continue; }
  const src = SRC.replace(from, to).replace('"./scv-pacing.js"', abs('scv-pacing.js')).replace('"./scv-weeks.js"', abs('scv-weeks.js'));
  let red;
  try { red = checks(await import('data:text/javascript,' + encodeURIComponent(src)), false).length > 0; } catch (e) { red = true; }
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
