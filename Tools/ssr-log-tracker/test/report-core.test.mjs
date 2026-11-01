// report-core.test.mjs — the numbers on 033's parent reading report, pure Node.
//   node Tools/ssr-log-tracker/test/report-core.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(here, '..', 'ssr-report.js'), 'utf8'), ctx);
const R = ctx.SsrReport;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('SSR Log Tracker — parent report numbers');

// dates and weeks (2026-10-12 is a Monday)
eq(R.mondayOf('2026-10-12'), '2026-10-12', 'a Monday is its own Monday');
eq(R.mondayOf('2026-10-18'), '2026-10-12', 'Sunday belongs to the week before');
eq(R.mondayOf('2026-10-14'), '2026-10-12', 'midweek');
eq(R.mondayOf('2026-03-08'), '2026-03-02', 'across the March clock change');
eq(R.mondayOf('2026-11-01'), '2026-10-26', 'across the November clock change');
eq(R.mondayOf('2027-01-01'), '2026-12-28', 'across a year');
eq(R.short('2026-10-05'), 'Oct 5', 'short dates');
eq(R.weekStarts('2026-10-12', '2026-10-18'), ['2026-10-12'], 'one whole week');
eq(R.weekStarts('2026-10-14', '2026-10-20'), ['2026-10-12', '2026-10-19'], 'a period starting midweek touches two weeks');
eq(R.weekStarts('2026-10-20', '2026-10-12'), [], 'a backwards period has no weeks');
eq(R.weekStarts('x', '2026-10-12'), [], 'a bad date has none');
ok(R.validDate('2026-10-12') && !R.validDate('2026-02-30') && !R.validDate(''), 'validDate');
eq(R.build({ from: '2026-10-20', to: '2026-10-12', entries: [] }), null, 'an unusable period builds nothing');

// build
const E = (date, book, pages, minutes) => ({ date, book, pages, minutes });
const entries = [
  E('2026-10-12', 'Hatchet', 20, 15), E('2026-10-13', 'Hatchet', 25, 20), E('2026-10-14', 'Hatchet', 10, 10),
  E('2026-10-16', 'hatchet ', 5, 0), E('2026-10-21', 'The Giver', 30, 25),
  E('2026-10-30', 'Out of range', 99, 99), E('2026-10-01', 'Too early', 99, 99)
];
const r = R.build({ from: '2026-10-12', to: '2026-10-25', entries, goalPages: 50, goalMinutes: 0 });
eq([r.daysRead, r.weeksInPeriod, r.weeksWithReading], [5, 2, 2], 'five days over two weeks, reading in both');
eq([r.pages, r.minutes], [90, 70], 'only the period counts toward pages and minutes');
eq(r.avgDaysPerWeek, 2.5, 'days a week to one place');
eq(r.longestRun, 3, 'three days in a row at best');
eq(r.avgMinutesPerDayRead, 14, 'minutes per day read, rounded');
eq(r.books.map(b => [b.title, b.pages, b.days]), [['Hatchet', 60, 4], ['The Giver', 30, 1]], 'books grouped ignoring case and spaces, in first-read order');
eq(r.weeks[0].flags, [true, true, true, false, true, false, false], 'week one: Mon Tue Wed and Fri');
eq(r.weeks[1].flags, [false, false, true, false, false, false, false], 'week two: Wednesday');
eq(r.weeks.map(w => [w.days, w.pages, w.minutes]), [[4, 60, 45], [1, 30, 25]], 'per-week days, pages and minutes');
eq([r.goalPages, r.goalMinutes, r.weeksMetPages, r.weeksMetMinutes], [50, 0, 1, 0], 'a goal is met in the weeks that reach it; no goal, no count');
eq(R.build({ from: '2026-10-12', to: '2026-10-25', entries: [], goalPages: 50 }).weeksMetPages, 0, 'no reading meets no goal');

// the first and last day of the period are both in it
const edge = R.build({ from: '2026-10-12', to: '2026-10-18', entries: [E('2026-10-12', 'A', 3, 3), E('2026-10-18', 'A', 4, 4), E('2026-10-11', 'A', 50, 50), E('2026-10-19', 'A', 50, 50)] });
eq([edge.daysRead, edge.pages, edge.minutes], [2, 7, 7], 'both end days count and the days either side do not');

// partial first and last weeks
const p = R.build({ from: '2026-10-14', to: '2026-10-20', entries: [E('2026-10-14', 'A', 1, 1), E('2026-10-19', 'A', 1, 1)] });
eq(p.weeks[0].flags, [null, null, true, false, false, false, false], 'days before the period are marked outside it');
eq(p.weeks[1].flags, [true, false, null, null, null, null, null], 'and days after it');

// empty, junk
const empty = R.build({ from: '2026-10-12', to: '2026-10-18', entries: [] });
eq([empty.daysRead, empty.pages, empty.minutes, empty.longestRun, empty.avgMinutesPerDayRead, empty.books], [0, 0, 0, 0, 0, []], 'a student with no reading has zeros, not NaN');
const junk = R.build({ from: '2026-10-12', to: '2026-10-18', entries: [null, {}, E('bad', 'x', 1, 1), E('2026-10-13', '', -5, 'abc'), E('2026-10-13', 'B', 3.9, 2.9)] });
eq([junk.daysRead, junk.pages, junk.minutes, junk.books.length], [1, 3, 2, 1], 'junk rows are skipped; negatives and text count as zero; fractions are floored');

// long periods keep the last 14 weeks and say how many were left off
const long = R.build({ from: '2026-01-05', to: '2026-06-28', entries: [E('2026-01-06', 'A', 5, 5), E('2026-06-24', 'A', 5, 5)] });
eq([long.weeksInPeriod, long.weeks.length, long.earlierWeeks], [25, 10, 15], 'a 25-week period shows the last 10 weeks');
eq([long.daysRead, long.pages], [2, 10], 'and still counts every week in the totals');
eq(R.build({ from: '2026-10-12', to: '2026-10-18', entries: [] }).earlierWeeks, 0, 'a short period leaves nothing off');

// consecutive days across a month end and a clock change
const run = R.build({ from: '2026-10-28', to: '2026-11-04', entries: ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map(d => E(d, 'A', 1, 1)) });
eq(run.longestRun, 4, 'a run crosses the month end and the November clock change');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
