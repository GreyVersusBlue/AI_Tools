// smoke-pacing.mjs — Node test for the School Calendar Visualizer's lesson
// pacing logic and store migration. No browser, no DOM, no SheetJS (the xlsx
// path is tested through parsePacingRows with plain array fixtures).
//
//   node Tools/school-calendar/test/smoke-pacing.mjs
//
// Exits 1 on any failure.

import {
  parseLessonCode, parseLessonList, excelSerialToISO, addDaysISO, isWeekdayISO,
  classifySchoolNote, isTeachableDay, listTeachableDays, placeLessons,
  parsePacingRows, rebindAdjustments, emptyPacing,
} from '../scv-pacing.js';
import { isValid, migrate, VERSION } from '../scv-store.js';
import { seedCalendar2026, blankCalendar, DEFAULT_DAY_TYPES } from '../scv-seed.js';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { passed++; return true; }
  failed++; fails.push(label);
  console.log('  FAIL ' + label);
  return false;
}
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const deep = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}\n       got  ${JSON.stringify(a)}\n       want ${JSON.stringify(b)}`);

/* ---------- fixture: the September 2026 window from the CCPS seed ----------
   Mon 8/31 first day … Mon 9/7 Labor Day (closed) … Fri 9/18 early dismissal. */
const FIX_TYPES = [
  { id: 'holiday', label: 'Holiday / No School', noSchool: true },
  { id: 'halfday', label: 'Half Day / Early Dismissal' },
  { id: 'workday', label: 'Teacher Workday (No Students)', noSchool: true },
];
const FIX_DAYS = {
  '2026-09-07': { types: ['holiday'], label: 'Labor Day', note: '', lesson: '' },
  '2026-09-18': { types: ['halfday'], label: 'Early Dismissal', note: '', lesson: '' },
};
const teachable = d => isTeachableDay(d, FIX_DAYS, FIX_TYPES);
const codes = n => Array.from({ length: n }, (_, i) =>
  `U1-${String(i + 1).padStart(2, '0')}-${i % 2 ? 'B' : 'A'}-Lesson ${i + 1}`).join('\n');

/* ---------- 1. parseLessonCode ---------- */
console.log('parseLessonCode');
{
  const p = parseLessonCode('U1-03-A-Urbanization & Trade Networks + Regional Variations in Islamic Cultural Diffusion');
  ok(p && p.unit === '1' && p.num === '03' && p.letter === 'A', 'numeric lesson parses');
  eq(p.title, 'Urbanization & Trade Networks + Regional Variations in Islamic Cultural Diffusion', 'title keeps punctuation');
  const buf = parseLessonCode('U2-BUF1-B-Buffer / Review Day');
  ok(buf && buf.num === 'BUF1' && buf.letter === 'B', 'BUF1 buffer token parses');
  eq(parseLessonCode('u1-01-a-x'), null, 'lowercase U prefix rejected');
  eq(parseLessonCode('U1-01-a-Lower letter').letter, 'A', 'lowercase a/b normalized to upper');
  const hyph = parseLessonCode('U3-12-B-Jim Crow - Segregation - and Resistance');
  eq(hyph && hyph.title, 'Jim Crow - Segregation - and Resistance', 'title may contain hyphens');
  eq(parseLessonCode('U1-01-C-Bad letter'), null, 'letter other than A/B rejected');
  eq(parseLessonCode('U1-01-A-'), null, 'missing title rejected');
  eq(parseLessonCode('X1-01-A-Nope'), null, 'non-U prefix rejected');
  eq(parseLessonCode(''), null, 'empty string rejected');
  eq(parseLessonCode('  U1-01-A-Trimmed  ').title, 'Trimmed', 'surrounding whitespace trimmed');
}

/* ---------- 2. parseLessonList ---------- */
console.log('parseLessonList');
{
  const { lessons, errors } = parseLessonList('U1-01-A-One\n\n  \nU1-01-B-One\nnot a code\nU1-02-A-Two');
  eq(lessons.length, 3, 'blank lines skipped, valid lines kept');
  deep(lessons.map(l => l.id), ['les_1', 'les_2', 'les_3'], 'sequential ids');
  deep(lessons.map(l => l.raw), ['U1-01-A-One', 'U1-01-B-One', 'U1-02-A-Two'], 'order preserved');
  eq(errors.length, 1, 'one bad line reported');
  eq(errors[0].line, 5, 'error line number is 1-based against the pasted text');
}

/* ---------- 3. excelSerialToISO ---------- */
console.log('excelSerialToISO');
{
  eq(excelSerialToISO(46265), '2026-08-31', 'first day serial');
  eq(excelSerialToISO(46272), '2026-09-07', 'Labor Day serial');
  eq(excelSerialToISO(46387), '2026-12-31', 'month/year boundary (Dec 31)');
  eq(excelSerialToISO(46388), '2027-01-01', 'month/year boundary (Jan 1)');
  eq(excelSerialToISO('46265'), '2026-08-31', 'numeric string accepted');
  eq(excelSerialToISO('nope'), null, 'non-number rejected');
  ok(isWeekdayISO('2026-09-04') && !isWeekdayISO('2026-09-05'), 'weekday check is TZ-independent');
  eq(addDaysISO('2026-08-31', 4), '2026-09-04', 'addDaysISO crosses month');
}

/* ---------- 4. classifySchoolNote ---------- */
console.log('classifySchoolNote');
{
  eq(classifySchoolNote('Winter Break'), 'closure-holiday', 'break → closure');
  eq(classifySchoolNote('Schools/Offices Closed - Labor Day'), 'closure-holiday', 'closed → closure');
  eq(classifySchoolNote("Presidents' Day"), 'closure-holiday', 'novel weekday holiday hits fallback');
  eq(classifySchoolNote('Early Dismissal - Professional Learning'), 'halfday', 'early dismissal wins over PL');
  eq(classifySchoolNote('End of Marking Period - Early Dismissal', { hasLesson: true }), 'halfday', 'MP-end early dismissal is a halfday');
  eq(classifySchoolNote('Schools Closed for Students - Professional Learning/Meeting Day'), 'closure-workday', 'PL day → workday closure');
  eq(classifySchoolNote('Schools Closed for Students - Professional Development Day'), 'closure-workday', 'PD day → workday closure');
  eq(classifySchoolNote('Schools/Offices Reopen', { hasLesson: true }), 'info', 'reopen day with a lesson stays info');
  eq(classifySchoolNote('First Day for Students', { hasLesson: true }), 'info', 'first day with a lesson stays info');
  eq(classifySchoolNote('Winter Break', { isWeekday: false }), 'closure-holiday', 'weekend break rows still classify');
  eq(classifySchoolNote(''), null, 'empty note → null');
}

/* ---------- 5. isTeachableDay ---------- */
console.log('isTeachableDay');
{
  ok(!teachable('2026-09-05'), 'Saturday not teachable');
  ok(!teachable('2026-09-07'), 'Labor Day (holiday type) not teachable');
  ok(teachable('2026-09-18'), 'early dismissal IS teachable');
  ok(teachable('2026-09-01'), 'plain weekday teachable');
  const multi = { '2026-09-10': { types: ['halfday', 'workday'] } };
  ok(!isTeachableDay('2026-09-10', multi, FIX_TYPES), 'any noSchool type wins on a multi-type day');
  deep(listTeachableDays('2026-09-04', '2026-09-08', teachable), ['2026-09-04', '2026-09-08'],
    'teachable list skips weekend + Labor Day');
}

/* ---------- 6. distribution ---------- */
console.log('placeLessons — distribution');
{
  const { lessons } = parseLessonList(codes(6));
  const p = placeLessons({ lessons, adjustments: [], startISO: '2026-08-31', endISO: '2027-06-11', isTeachable: teachable });
  deep(Object.keys(p.byDate).sort(), ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-08'],
    'six lessons land Mon-Fri then Tue after Labor Day');
  eq(p.overflow.length, 0, 'no overflow');
  const many = parseLessonList(codes(15)).lessons;
  const p2 = placeLessons({ lessons: many, adjustments: [], startISO: '2026-08-31', endISO: '2027-06-11', isTeachable: teachable });
  eq(p2.byDate['2026-09-18'] && p2.byDate['2026-09-18'].raw, many[13].raw, 'halfday 9/18 receives a lesson');
}

/* ---------- 7. bump ripple ---------- */
console.log('placeLessons — bump');
{
  const { lessons } = parseLessonList(codes(8));
  const friLesson = lessons[4]; // would land Fri 9/4
  const adj = [{ id: 'adj_1', beforeLessonId: friLesson.id, reason: 'Ran long', createdOn: '2026-09-04' }];
  const p = placeLessons({ lessons, adjustments: adj, startISO: '2026-08-31', endISO: '2027-06-11', isTeachable: teachable });
  deep(p.vacated['2026-09-04'], [{ id: 'adj_1', reason: 'Ran long' }], 'vacated Friday carries the reason');
  eq(p.dateByLessonId[friLesson.id], '2026-09-08', 'bumped lesson lands Tue 9/8 over weekend + Labor Day');
  eq(p.dateByLessonId[lessons[5].id], '2026-09-09', 'subsequent lessons shift exactly one slot');
  const twice = [...adj, { id: 'adj_2', beforeLessonId: friLesson.id, reason: 'Assembly' }];
  const p2 = placeLessons({ lessons, adjustments: twice, startISO: '2026-08-31', endISO: '2027-06-11', isTeachable: teachable });
  eq(p2.dateByLessonId[friLesson.id], '2026-09-09', 'two gaps shift two slots');
  eq((p2.vacated['2026-09-08'] || []).length, 1, 'second gap vacates the next teachable day');
}

/* ---------- 8. no double-shift when a closure is added later ---------- */
console.log('placeLessons — bump + later closure');
{
  const { lessons } = parseLessonList(codes(8));
  const friLesson = lessons[4];
  const adj = [{ id: 'adj_1', beforeLessonId: friLesson.id, reason: 'Ran long' }];
  const daysWithSnow = { ...FIX_DAYS, '2026-09-02': { types: ['holiday'], label: 'Snow Day' } };
  const snowTeachable = d => isTeachableDay(d, daysWithSnow, FIX_TYPES);
  const p = placeLessons({ lessons, adjustments: adj, startISO: '2026-08-31', endISO: '2027-06-11', isTeachable: snowTeachable });
  // Closure shifts everything by one; the single gap still adds exactly one more.
  eq(p.dateByLessonId[friLesson.id], '2026-09-09', 'closure + one gap = two-slot shift, not three');
  deep(p.vacated['2026-09-08'], [{ id: 'adj_1', reason: 'Ran long' }], 'gap traveled with its lesson to the new slot');
  ok(!p.byDate['2026-09-02'] && !p.vacated['2026-09-02'], 'nothing placed on the snow day');
}

/* ---------- 9. overflow ---------- */
console.log('placeLessons — overflow');
{
  const { lessons } = parseLessonList(codes(6));
  const p = placeLessons({ lessons, adjustments: [], startISO: '2026-08-31', endISO: '2026-09-04', isTeachable: teachable });
  eq(Object.keys(p.byDate).length, 5, 'five teachable days filled');
  deep(p.overflow.map(l => l.raw), [lessons[5].raw], 'sixth lesson overflows');
  const adj = [{ id: 'adj_1', beforeLessonId: lessons[4].id, reason: 'x' }];
  const p2 = placeLessons({ lessons, adjustments: adj, startISO: '2026-08-31', endISO: '2026-09-04', isTeachable: teachable });
  deep(p2.overflow.map(l => l.raw), [lessons[4].raw, lessons[5].raw], 'bump on last placeable lesson pushes it into overflow');
}

/* ---------- 10. orphaned adjustments ---------- */
console.log('placeLessons — orphaned adjustments');
{
  const { lessons } = parseLessonList(codes(3));
  const adj = [{ id: 'adj_gone', beforeLessonId: 'les_999', reason: 'x' }];
  const p = placeLessons({ lessons, adjustments: adj, startISO: '2026-08-31', endISO: '2026-09-04', isTeachable: teachable });
  deep(p.orphanedAdjustmentIds, ['adj_gone'], 'orphan reported');
  eq(Object.keys(p.byDate).length, 3, 'orphan does not consume a slot');
}

/* ---------- 11. rebindAdjustments ---------- */
console.log('rebindAdjustments');
{
  const oldL = parseLessonList('U1-01-A-One\nU1-02-A-Two').lessons;
  const newL = parseLessonList('U1-00-A-Zero\nU1-02-A-Two').lessons; // "Two" kept, "One" gone
  const adj = [
    { id: 'a1', beforeLessonId: oldL[1].id, reason: 'keep me' },
    { id: 'a2', beforeLessonId: oldL[0].id, reason: 'drop me' },
  ];
  const { kept, dropped } = rebindAdjustments(adj, oldL, newL);
  eq(kept.length, 1, 'matching code kept');
  eq(kept[0].beforeLessonId, newL[1].id, 'kept adjustment re-anchored to new id');
  eq(kept[0].reason, 'keep me', 'kept adjustment retains its fields');
  deep(dropped.map(a => a.id), ['a2'], 'vanished code dropped and reported');
}

/* ---------- 12. parsePacingRows ---------- */
console.log('parsePacingRows');
{
  const rows = [
    ['Date', 'Lesson', 'School Notes'],
    [46266, 'U1-01-B-One', ''],                                  // Tue 9/1
    [46265, 'U1-01-A-One', 'First Day for Students'],            // Mon 8/31 (out of order)
    [46272, '', 'Schools/Offices Closed - Labor Day'],           // Mon 9/7
    [46270, '', ''],                                             // Sat 9/5, blank
    ['2026-09-18', 'U1-02-A-Two', 'Early Dismissal - Professional Learning'],
    [46268, 'garbage-code', ''],                                 // bad lesson code
    ['not a date', 'U1-03-A-Three', ''],
    [null, null, null],
  ];
  const { lessonRows, dayTags, errors } = parsePacingRows(rows);
  deep(lessonRows.map(r => r.date), ['2026-08-31', '2026-09-01', '2026-09-18'], 'lessons sorted by date');
  deep(lessonRows.map(r => r.lesson.id), ['les_1', 'les_2', 'les_3'], 'ids assigned in date order');
  deep(dayTags.map(t => [t.date, t.kind]),
    [['2026-08-31', 'info'], ['2026-09-07', 'closure-holiday'], ['2026-09-18', 'halfday']],
    'day tags classified');
  eq(errors.length, 2, 'bad code + bad date reported');
}

/* ---------- 13. store migration + seeds ---------- */
console.log('store migration + seeds');
{
  eq(VERSION, 2, 'store VERSION is 2');
  const v1 = {
    __v: 1,
    meta: { yearLabel: 'Y', start: '2026-08-31', end: '2027-06-11' },
    dayTypes: DEFAULT_DAY_TYPES.map(t => ({ ...t })),
    days: { '2026-09-07': { types: ['holiday'], label: 'Labor Day', note: '', lesson: '' } },
  };
  ok(isValid(v1), 'v1 blob still validates (old backups import)');
  const m = migrate(v1);
  eq(m.__v, 2, 'migrate upgrades to v2');
  deep(m.pacing, emptyPacing(), 'migrated blob gains empty pacing');
  deep(m.days, v1.days, 'migration leaves days untouched');
  ok(isValid(m), 'migrated blob validates as v2');
  ok(!isValid({ ...m, pacing: 'nope' }), 'v2 with bogus pacing rejected');
  ok(!isValid(null) && !isValid({}), 'junk rejected');
  const seed = seedCalendar2026();
  ok(isValid(seed) && seed.__v === 2 && Array.isArray(seed.pacing.lessons), 'seedCalendar2026 is valid v2');
  const blank = blankCalendar('X', '2026-08-31', '2027-06-11');
  ok(isValid(blank) && blank.pacing.adjustments.length === 0, 'blankCalendar is valid v2');
  deep(migrate(seed), seed, 'migrate is a no-op on v2');
}

/* ---------- summary ---------- */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failed:\n  ' + fails.join('\n  ')); process.exit(1); }
