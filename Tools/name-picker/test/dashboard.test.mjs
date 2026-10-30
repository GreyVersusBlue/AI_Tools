// dashboard.test.mjs — Name Picker: np-dashboard.js, the equity dashboard's numbers (Path 15 P3). Pure Node.
//
//   node Tools/name-picker/test/dashboard.test.mjs
//
// Verification line of Path 15: a fixture of 600 picks across three weeks gives the same weekly counts through the
// rollup and the dashboard as counting all 600 by hand; a period is a saved roster; the 21-day line is exact; a
// pick stored under a name before an id existed is still found; weeks before the first record are named, not zeroed.

import * as R from '../np-rollup.js';
import * as D from '../np-dashboard.js';
import { createStore, memoryStorage, MAX_HISTORY } from '../np-store.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 400) + '\n    want ' + JSON.stringify(b).slice(0, 400)); }
};
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };

/* ---- weekStart / weekList / dayLabel ---- */
eq(D.weekStart('2026-10-05'), '2026-10-05', 'a Monday starts its own week');
eq(D.weekStart('2026-10-11'), '2026-10-05', 'a Sunday belongs to the week before it');
eq(D.weekStart('2026-10-29'), '2026-10-26', 'Thursday 29 Oct is in the week of Monday 26 Oct');
eq(D.weekStart('2026-11-01'), '2026-10-26', 'the week crosses a month end');
eq(D.weekStart('2027-01-01'), '2026-12-28', 'the week crosses a year end');
eq(D.weekList('2026-10-29', 3), ['2026-10-12', '2026-10-19', '2026-10-26'], 'weekList ends with the week that holds today, oldest first');
eq(D.dayLabel('2026-10-05'), 'Oct 5', 'a day label has no locale in it');
eq(D.dayLabel('nope'), 'nope', 'a bad day is shown as it came');

/* ---- the fixture: three school weeks, 600 picks, 12 students, run through the page's own save step ---- */
const STUDENTS = Array.from({ length: 12 }, (_, i) => 'Student ' + String.fromCharCode(65 + i));
const IDS = Object.fromEntries(STUDENTS.map((n, i) => [n, 'id' + (i + 1)]));
const idOf = (n) => IDS[n] || null;
let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const DAYS = []; for (let w = 0; w < 3; w++) for (let d = 0; d < 5; d++) DAYS.push(`2026-10-${String(5 + w * 7 + d).padStart(2, '0')}`);
const PICKS = Array.from({ length: 600 }, (_, i) => ({ name: STUDENTS[Math.floor(rnd() * 12)], time: '09:00 AM', date: DAYS[Math.floor(i / 40)] }));
const store = createStore({ storage: memoryStorage() });
let history = [], rolledUp = 0;
for (const p of PICKS) {
  history.push(p);
  const r = R.foldOverflow(store.get('daily'), history, rolledUp, MAX_HISTORY, idOf);
  if (r.rolledUp !== rolledUp) { store.set('daily', r.doc); rolledUp = r.rolledUp; }
  store.set('history', history);
}
const view = R.view(store.get('daily'), store.get('history'), idOf);
const TODAY = '2026-10-23';          /* the Friday of the third week */
const ROSTERS = { 'Period 1': STUDENTS.slice(0, 7), 'Period 2': STUDENTS.slice(5) };   /* C..: F and G (5,6) are in both */

/* counting all 600 by hand: student -> week -> n */
const hand = {};
for (const p of PICKS) { const w = D.weekStart(p.date); (hand[p.name] = hand[p.name] || {})[w] = ((hand[p.name] || {})[w] || 0) + 1; }
const dash = D.build(view, ROSTERS, { today: TODAY, weeks: 4, idOf });
eq(dash.weeks, ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'], 'four weeks ending in the week of today');
ok(dash.periods.length === 2, 'one period per saved roster');
ok(MAX_HISTORY < 600 && Object.keys(store.get('daily').days).length > 0, 'the fixture really went through the rollup');
const p1 = dash.periods[0];
let bad = 0;
for (const r of p1.rows) dash.weeks.forEach((w, i) => { if (r.cells[i] !== ((hand[r.name] || {})[w] || 0)) bad++; });
eq(bad, 0, 'every student-by-week cell in Period 1 equals counting the 600 picks by hand');
const p2 = dash.periods[1];
bad = 0;
for (const r of p2.rows) dash.weeks.forEach((w, i) => { if (r.cells[i] !== ((hand[r.name] || {})[w] || 0)) bad++; });
eq(bad, 0, 'and in Period 2');
const handWeekly = dash.weeks.map(w => p1.rows.reduce((a, r) => a + ((hand[r.name] || {})[w] || 0), 0));
eq(p1.weekly, handWeekly, 'the weekly series is the column sums');
eq(p1.stats.picks, handWeekly.reduce((a, b) => a + b, 0), 'stats.picks is the grid total');
ok(p1.rows.length === 7 && p2.rows.length === 7, 'seven students on each roster');

/* a student on two rosters is on both, and once in All */
const f = n => p => p.rows.find(r => r.name === n);
eq(f('Student F')(p1).cells, f('Student F')(p2).cells, 'a student on two rosters has the same counts on both');
ok(dash.all.rows.length === 12, 'All has every student once (12, not 14)');
eq(dash.all.stats.picks, dash.all.rows.reduce((a, r) => a + r.total, 0), 'All counts a shared student once');
eq(D.compare(dash).map(c => c.name), ['Period 1', 'Period 2'], 'compare lists the periods in saved order');
eq(D.compare(dash)[0].students, 7, 'compare carries the students');

/* ---- the 21-day line is exact, never-called first ---- */
{
  const v = { days: { '2026-10-01': { id1: 1 }, '2026-10-02': { id2: 1 }, '2026-10-03': { id3: 1 } }, who: {} };
  const d = D.build(v, { P: ['Student A', 'Student B', 'Student C', 'Student D'] }, { today: '2026-10-22', weeks: 4, idOf });
  const q = d.periods[0].quiet.map(r => [r.name, r.daysSince]);
  /* A: 21 days ago (quiet), B: 20 (not), C: 19 (not), D: never */
  eq(q, [['Student D', null], ['Student A', 21]], 'quiet is exactly 21 days or more; never-called comes first');
  const d2 = D.build(v, { P: ['Student A', 'Student B'] }, { today: '2026-10-22', weeks: 4, idOf, threshold: 20 });
  eq(d2.periods[0].quiet.map(r => r.name), ['Student A', 'Student B'], 'the line moves with the threshold');
}

/* ---- keys: an id, a name stored before the id existed, and both together ---- */
{
  const v = { days: { '2026-10-20': { id1: 2, 'n:student a': 3 }, '2026-10-21': { 'n:student b': 1 } }, who: {} };
  const d = D.build(v, { P: ['Student A', 'Student B', '  student b  '] }, { today: '2026-10-22', weeks: 2, idOf });
  const rows = d.periods[0].rows;
  eq(rows.map(r => [r.name, r.total]), [['Student A', 5], ['Student B', 1]], 'an id count and a name count add; the same name twice is one student');
  const d2 = D.build(v, { P: ['Student A'] }, { today: '2026-10-22', weeks: 2 });
  eq(d2.periods[0].rows[0].total, 3, 'with no ids, only the name key counts');
  eq(D.keysFor('  Ada  Lovelace ', 'P', () => null), ['n:ada lovelace'], 'a name with no id is keyed on its normalised name');
  eq(D.keysFor('', 'P', idOf), [], 'a blank name has no key');
}

/* ---- the edges: before the record, undated, empty, bad input ---- */
{
  const v = { days: { '2026-10-20': { id1: 1 }, '': { id1: 4 } }, who: {} };
  const d = D.build(v, { P: ['Student A'] }, { today: '2026-10-22', weeks: 4, idOf });
  eq([d.since, d.truncated, d.undated], ['2026-10-20', true, 4], 'records start 20 Oct: the weeks before are named, and 4 undated picks are counted apart');
  eq(d.periods[0].rows[0].total, 1, 'an undated pick is in no week');
  const full = D.build(v, { P: ['Student A'] }, { today: '2026-10-22', weeks: 1, idOf });
  eq(full.truncated, false, 'a window that starts inside the record is not truncated');
  const none = D.build({ days: {}, who: {} }, { P: ['Student A'] }, { today: '2026-10-22', weeks: 2, idOf });
  eq([none.since, none.truncated, none.periods[0].stats.coverage, none.periods[0].quiet.length], [null, false, 0, 1], 'an empty record: nothing truncated, nobody covered, everyone quiet');
  eq(D.build(null, null, { today: '2026-10-22' }).periods, [], 'no rosters, no periods');
  eq(D.build(view, { P: 'nope', Q: ['Student A'] }, { today: TODAY, idOf }).periods.map(p => p.name), ['Q'], 'a roster that is not a list is skipped');
  let threw = false; try { D.build(view, ROSTERS, {}); } catch { threw = true; }
  ok(threw, 'no today is an error, not the real clock');
  eq(D.build(view, ROSTERS, { today: TODAY, weeks: 999, idOf }).weeks.length, 52, 'weeks are capped at 52');
  eq(D.build(view, ROSTERS, { today: TODAY, weeks: 0, idOf }).weeks.length, 8, 'weeks falls back to the default 8');
  eq(D.build(view, { P: [] }, { today: TODAY, idOf }).periods[0].stats, { students: 0, picks: 0, called: 0, coverage: 0, least: 0, most: 0, spread: 0, quiet: 0 }, 'an empty roster has zero stats');
}

/* ---- chart data and the sentences ---- */
{
  const cd = D.chartData(dash, p1);
  eq(cd.categories, ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19'], 'chart categories are the week labels');
  eq(cd.series[0].values, p1.weekly, 'chart values are the weekly series');
  const ls = D.lines(dash, p1);
  ok(/^\d+ picks across 7 students in the last 4 weeks \(Sep 28 to Oct 23\)\.$/.test(ls[0]), 'first sentence: ' + ls[0]);
  ok(ls.some(l => /were called on at least once/.test(l)), 'a coverage sentence');
  const v = { days: { '2026-10-20': { id1: 1 }, '': { id1: 2 } }, who: {} };
  const d = D.build(v, { P: STUDENTS.slice(0, 9) }, { today: '2026-10-22', weeks: 4, idOf });
  const l = D.lines(d, d.periods[0]);
  ok(l.some(x => /8 students not called on in 21 days/.test(x) && /and 2 more\.$/.test(x)), 'a long quiet list is cut at six names with "and N more": ' + l.join(' | '));
  ok(l.some(x => /Records start Oct 20/.test(x)), 'the record-start sentence');
  ok(l.some(x => /2 older picks carry no date/.test(x)), 'the undated sentence');
  eq(D.lines(dash, D.build(view, { P: [] }, { today: TODAY }).periods[0]), ['No students on this roster.'], 'an empty roster says so');
  const all = { days: { '2026-10-22': { id1: 1 } }, who: {} };
  const da = D.build(all, { P: ['Student A'] }, { today: '2026-10-22', weeks: 2, idOf });
  ok(D.lines(da, da.periods[0]).some(x => /Everyone was called on within the last 21 days/.test(x)), 'when no one is quiet the sentence says so');
}

console.log(`dashboard: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
