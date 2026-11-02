// smoke-term-core.mjs — the term / year view's arithmetic, in pure Node.
//
//   node Tools/behavior-points-tracker/test/smoke-term-core.mjs
//
// term.js adds archived days up over a date range, across one section or all of
// them. It must count every day once, put it in the right week or month, keep
// a student in two sections as two lines, use the target in force on the day,
// and leave a day it cannot date out of any ranged view. TERM_FILE points the
// suite at another copy of the module (the deliberate-break runs use it).
// Every name is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.TERM_FILE || path.join(here, '..', 'term.js');
await import(pathToFileURL(file).href);
const T = globalThis.BPTerm;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

console.log('Term view — ranges, buckets, sections');

const row = (name, points, pos, neg, goal) => ({ name, points, pos, neg, goal: goal === undefined ? null : goal, notes: [] });
// newest first, as the page stores it
const p3 = {
  goals: { Ann: 3 },
  history: [
    { date: 'Oct 14, 2026', iso: '2026-10-14', rows: [row('Ann', 4, 4, 0, 3), row('Bo', -1, 0, 1)] },
    { date: 'Oct 8, 2026', iso: '2026-10-08', rows: [row('Ann', 2, 2, 0, 3), row('Bo', 3, 3, 0)] },
    { date: 'Oct 7, 2026', iso: '2026-10-07', rows: [row('Ann', 1, 1, 0, 3), row('Bo', 0, 0, 0)] },
    { date: 'Sep 30, 2026', iso: '2026-09-30', rows: [row('Ann', 5, 5, 0, 3)] },
  ]
};
const p5 = { goals: {}, history: [{ date: 'Oct 8, 2026', iso: '2026-10-08', rows: [row('Ann', 9, 9, 0), row('Cy', 2, 2, 0)] }] };
const sets = { 'Period 3': p3, 'Period 5': p5 };

/* dates */
eq(T.isoOf({ iso: '2026-10-14', date: 'x' }), '2026-10-14', 'iso is read as stored');
eq(T.isoOf({ date: 'Oct 7, 2026' }), '2026-10-07', 'a day with no iso is read from its date');
eq(T.isoOf({ date: 'not a date' }), '', 'an unreadable day has no date');
eq(T.isoOf({ iso: '2026-02-31', date: 'nope' }), '', 'an impossible iso is not trusted');
eq(T.mondayOf('2026-10-14'), '2026-10-12', 'a Wednesday goes back to its Monday');
eq(T.mondayOf('2026-10-11'), '2026-10-05', 'a Sunday belongs to the week before');
eq(T.mondayOf('2026-10-12'), '2026-10-12', 'a Monday is its own week');
eq(T.mondayOf('2027-01-01'), '2026-12-28', 'a week can cross the year');
same(T.schoolYear('2026-10-14'), { from: '2026-08-01', to: '2027-07-31' }, 'October is in the year that began that August');
same(T.schoolYear('2027-03-02'), { from: '2026-08-01', to: '2027-07-31' }, 'March is in the year that began the August before');
same(T.schoolYear('2026-08-01'), { from: '2026-08-01', to: '2027-07-31' }, 'Aug 1 starts the year');
same(T.schoolYear('2026-07-31'), { from: '2025-08-01', to: '2026-07-31' }, 'Jul 31 ends the one before');
eq(T.lastDays('2026-10-14', 30), '2026-09-15', 'last 30 days counts the end date');

/* one section, all days, by week */
let r = T.summarize(sets, { sections: ['Period 3'], by: 'week' });
eq(r.days, 4, 'four days');
eq(r.points, 14, 'points 4-1+2+3+1+0+5');
eq(r.pos, 15, 'positive taps');
eq(r.neg, 1, 'negative taps');
same(r.buckets.map(b => b.key), ['2026-09-28', '2026-10-05', '2026-10-12'], 'weeks, oldest first');
same(r.buckets.map(b => b.days), [1, 2, 1], 'days per week');
same(r.buckets.map(b => b.points), [5, 6, 3], 'points per week');
eq(r.buckets[1].label, 'Week of Oct 5, 2026', 'week label');
same(r.students.map(s => s.name), ['Ann', 'Bo'], 'students, most points first');
const ann = r.students[0];
same([ann.days, ann.points, ann.pos, ann.neg, ann.goalDays, ann.met], [4, 12, 12, 0, 4, 2], 'Ann: target 3 met on 4 and 5 only');

/* by month */
r = T.summarize(sets, { sections: ['Period 3'], by: 'month' });
same(r.buckets.map(b => b.key), ['2026-09', '2026-10'], 'months');
eq(r.buckets[1].label, 'Oct 2026', 'month label');
same(r.buckets.map(b => b.days), [1, 3], 'days per month');

/* a range, inclusive both ends */
r = T.summarize(sets, { sections: ['Period 3'], from: '2026-10-07', to: '2026-10-08', by: 'week' });
eq(r.days, 2, 'both ends of a range are in');
eq(r.points, 6, 'points in the range');
eq(T.summarize(sets, { sections: ['Period 3'], from: '2026-10-09', by: 'week' }).days, 1, 'only a start date');
eq(T.summarize(sets, { sections: ['Period 3'], to: '2026-10-06', by: 'week' }).days, 1, 'only an end date');
eq(T.summarize(sets, { sections: ['Period 3'], from: '2027-01-01', by: 'week' }).days, 0, 'a range with nothing in it');
eq(T.summarize(sets, { sections: ['Period 3'], from: '2027-01-01', by: 'week' }).students.length, 0, '...has no students');

/* every section: two lines for the same name; a shared date is two days */
r = T.summarize(sets, { sections: null, by: 'week' });
eq(r.days, 5, 'five section-days across both sections (Oct 8 is two)');
eq(r.students.filter(s => s.name === 'Ann').length, 2, 'Ann in two sections is two lines');
const ann5 = r.students.filter(s => s.name === 'Ann' && s.section === 'Period 5')[0];
same([ann5.days, ann5.points, ann5.goalDays], [1, 9, 0], 'the other Ann has her own total and no target');
eq(r.students[0].name + '/' + r.students[0].section, 'Ann/Period 3', 'sorted by points across sections');
eq(r.buckets.filter(b => b.key === '2026-10-05')[0].days, 3, 'a week counts each section-day');
eq(T.summarize(sets, { sections: ['Period 5'], by: 'week' }).days, 1, 'a named section only');
eq(T.summarize(sets, { sections: ['Nope'], by: 'week' }).days, 0, 'an unknown section is empty, not an error');

/* the target on the day, then the current target as a fallback */
const g = { goals: { Dee: 2 }, history: [
  { iso: '2026-10-02', date: 'Oct 2, 2026', rows: [row('Dee', 3, 3, 0, 5), row('Eli', 1, 1, 0)] },   // target 5 that day: missed
  { iso: '2026-10-01', date: 'Oct 1, 2026', rows: [row('Dee', 3, 3, 0)] }                              // no target recorded: today's 2: met
] };
r = T.summarize({ G: g }, { by: 'week' });
const dee = r.students.filter(s => s.name === 'Dee')[0];
same([dee.goalDays, dee.met], [2, 1], 'the recorded target wins; a day without one uses the current target');
same([r.students.filter(s => s.name === 'Eli')[0].goalDays], [0], 'no target at all means no target days');

/* exactly on target is met */
r = T.summarize({ E: { goals: { Hal: 4 }, history: [{ iso: '2026-10-01', date: 'Oct 1, 2026', rows: [row('Hal', 4, 4, 0, 4)] }] } }, { by: 'week' });
same([r.students[0].goalDays, r.students[0].met], [1, 1], 'points equal to the target meet it');

/* undated days */
const odd = { history: [{ date: 'sometime in October', rows: [row('Fay', 1, 1, 0)] }, { iso: '2026-10-01', date: 'Oct 1, 2026', rows: [row('Fay', 2, 2, 0)] }] };
r = T.summarize({ O: odd }, { by: 'week' });
same([r.days, r.undated, r.points], [2, 1, 3], 'with no range an undated day counts and is named');
same(r.buckets.map(b => b.points), [2], '...but is in no week');
r = T.summarize({ O: odd }, { from: '2026-09-01', by: 'week' });
same([r.days, r.undated, r.points], [1, 0, 2], 'with a range an undated day is left out');

/* damaged storage is survived */
r = T.summarize({ X: { history: [null, { rows: 'x' }, { iso: '2026-10-01', rows: [null, { points: 1 }, row('Gus', 1, 1, 0)] }] }, Y: null, Z: {} }, { by: 'week' });
same([r.days, r.studentCount], [1, 1], 'junk is skipped');
eq(T.summarize(null, {}).days, 0, 'no sets');
eq(T.summarize({}, undefined).days, 0, 'no options');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
