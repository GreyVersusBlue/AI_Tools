// smoke-consumers-trips-grades.mjs — the next two readers of 032's school-year spine
// (Path 9 P3): 001 Hall Pass Log's Period column and by-period report, and 036 Final
// Grade Checker's grading window, each reading 032's calendar through
// _shared/school-day.js and never writing it.
//
//   node Tools/school-calendar/test/smoke-consumers-trips-grades.mjs
//   (or: npm run test:school-day-trips-grades)
//
// What is held. 001: with no calendar saved there is no Period column in the history,
// the printed log or the range export, no period beside a trip in today's log, and no
// "By period" table (the page is what it was). With one, each trip is named by the period
// its time fell in, worked out at display time from 032's schedule for that date: the
// B-day and A-day schedules give one time two answers, a half day reads its own schedule
// over its letter, a passing time, before and after school are named, and a closed day or
// a trip with no time is "—". The long-range report groups the trips by period (periods
// first, most passes first) on screen, on paper and in the CSV, whose detail rows carry a
// Period column. A calendar saved by another tab brings the column in without a reload.
// 036: with no calendar the need tab is what it was (Quarter 4 open, no note); on
// 2026-12-01 it says Quarter 2 runs Nov 5 to Jan 22 with the school days left, counted
// off the seed here and not by school-day.js, half days named, and marks Quarter 2 open,
// which the teacher can still change; before and after the year it says so and marks
// nothing; a year of six grading periods is not read as quarters. Neither page writes
// scv_calendar_v1, and axe finds nothing serious in the new parts. Then the deliberate
// breaks: a page or school-day.js is altered on the wire, and each must fail.
//
// The clock is pinned per page (local time, the zone the run is in); dates in words come
// from the browser's own toLocaleDateString, so the locale is not under test. Exits 1 on
// any failure.

import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';

const PORT = 8547;
const BASE = `http://127.0.0.1:${PORT}`;
const HALL = BASE + '/Tools/001-hall-pass-log.html';
const GRADE = BASE + '/Tools/036-final_grade_checker.html';
const KEY = 'scv_calendar_v1';

let passed = 0, failed = 0;
const fails = [];
let quiet = false;
let breakFails = 0;
const ok = (cond, label) => {
  if (quiet) { if (!cond) breakFails++; return !!cond; }
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── dates off the seed, without school-day.js ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const LETTER = Object.fromEntries(SCHOOL.map((d, i) => [d, i % 2 ? 'B' : 'A']));
const HALF = '2026-09-18';
const CLOSED = '2026-09-07';
const tags = (d) => SEED.days[d]?.types || [];
const isHalf = (d) => tags(d).includes('halfday');
const B_DAY = SCHOOL.find((d) => LETTER[d] === 'B' && !tags(d).length);
const A_DAY = SCHOOL.find((d) => LETTER[d] === 'A' && !tags(d).length);
const MP = Object.keys(SEED.days).filter((d) => tags(d).includes('mpend')).sort();
if (SEED.days[CLOSED]?.label !== 'Labor Day' || !isHalf(HALF) || SCHOOL.includes(CLOSED)
  || JSON.stringify(MP) !== JSON.stringify(['2026-11-04', '2027-01-22', '2027-04-07'])) {
  console.log('FAIL the seed is not the one this suite was written against'); process.exit(1);
}
const Q2 = { start: '2026-11-05', end: '2027-01-22' };
const DEC1 = '2026-12-01';
const Q2_LEFT = SCHOOL.filter((d) => d >= DEC1 && d <= Q2.end);
const Q2_HALF = Q2_LEFT.filter(isHalf).length;
if (Q2_HALF < 2) { console.log('FAIL the suite needs two half days left in Quarter 2'); process.exit(1); }

const P = (label, start, end) => ({ label, start, end });
const BELL = {
  v: 1,
  schedules: [
    { id: 'sa', name: 'Long A', periods: [P('Period 1', '07:30', '08:20'), P('Period 2', '08:25', '09:15'), P('Period 3', '09:20', '10:10'), P('Period 4', '10:15', '11:05')] },
    { id: 'sb', name: 'Long B', periods: [P('Period 1', '07:45', '08:40'), P('Period 2', '08:45', '09:40'), P('Period 3', '09:45', '10:40')] },
    { id: 'sh', name: 'Early release', periods: [P('Period 1', '07:30', '08:05'), P('Period 2', '08:10', '08:45'), P('Period 3', '08:50', '09:25')] },
  ],
  regular: null, letters: { A: 'sa', B: 'sb' }, types: { halfday: 'sh' },
};
function calendar({ extraMp = [] } = {}) {
  const cal = seedCalendar2026();
  cal.abCycle = { enabled: true, anchorDate: SCHOOL[0], anchorLetter: 'A' };
  cal.bell = JSON.parse(JSON.stringify(BELL));
  for (const d of extraMp) cal.days[d] = { ...(cal.days[d] || {}), types: [...(cal.days[d]?.types || []), 'mpend'] };
  return JSON.stringify(cal);
}
const at = (date, hm) => new Date(`${date}T${hm}:00`);

const server = await serve(PORT);
const browser = await launch();

let edits = {};
async function openAt(url, when, store) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(when);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  for (const [pat, fn] of Object.entries(edits)) {
    await page.route(pat, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: fn(await res.text()), headers: { ...res.headers() } });
    });
  }
  await page.goto(BASE + '/index.html');
  await page.evaluate((kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, store || {});
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const raw = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
const done = async (page, label) => {
  eq(page.__errs, [], `${label}: no page error`);
  await page.context().close();
};
const dateWords = (page, iso) => page.evaluate((d) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString([], { month: 'short', day: 'numeric' });
}, iso);

/* ── 001: one archived day holding trips across the year, and one trip today ── */
const TRIPS = [
  ['Ada', B_DAY, '09:17', 5, 'Period 2'],        // B schedule: Period 2 runs 08:45-09:40
  ['Ben', A_DAY, '09:17', 6, 'Passing time'],    // A schedule: 09:15-09:20 is passing time
  ['Cy', HALF, '09:00', 7, 'Period 3'],          // the half-day schedule over the letter
  ['Di', CLOSED, '10:00', 8, '—'],          // Labor Day
  ['Ed', B_DAY, '07:00', 9, 'Before school'],
  ['Fay', null, null, 10, '—'],             // an old row with no time
  ['Gus', B_DAY, '15:00', 11, 'After school'],
  ['Hal', B_DAY, '09:00', 4, 'Period 2'],
];
const NOW = at(B_DAY, '10:00');
const TODAY_TRIP = ['Ivy', B_DAY, '08:10', 3, 'Period 1'];
async function seedHall(page) {
  await page.evaluate(({ trips, today, histMs }) => {
    const KEY = 'hall-pass-log-sections';
    const store = JSON.parse(localStorage.getItem(KEY));
    const cur = store.sets[store.current];
    const ms = (d, t) => (d ? new Date(`${d}T${t}:00`).getTime() : undefined);
    const row = ([name, d, t, mins]) => {
      const r = { name, destLabel: 'Restroom', outStr: t || '9:00 AM', inStr: 'later', durationMin: mins, note: '' };
      if (d) r.outMs = ms(d, t);
      return r;
    };
    cur.history = [{ date: 'the archived day', dateMs: histMs, rows: trips.map(row) }];
    cur.log = [Object.assign({ id: 'i1', inMs: ms(today[1], today[2]) + 180000 }, row(today))];
    cur.outNow = [];
    localStorage.setItem(KEY, JSON.stringify(store));
  }, { trips: TRIPS, today: TODAY_TRIP, histMs: at(B_DAY, '00:00').getTime() });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
}
const historyHead = (p) => p.$$eval('#historyWrap thead th', (ths) => ths.map((t) => t.textContent));
const historyPeriods = (p) => p.$$eval('#historyWrap tbody tr', (trs) => trs.map((tr) => [tr.cells[0].textContent, tr.cells[2].textContent]));
async function buildRange(p) {
  await p.fill('#rangeFrom', SEED.meta.start);
  await p.fill('#rangeTo', SEED.meta.end);
  await p.click('#buildRangeBtn');
  await settle(p, 150);
}

async function scenario() {
  /* ═══ 001 Hall Pass Log ═══ */
  {
    const p = await openAt(HALL, NOW);
    await seedHall(p);
    eq(await historyHead(p), ['Student', 'Destination', 'Out', 'In', 'Duration', 'Note'], '001 with no calendar: the history table has no Period column');
    eq(await p.$('#activityFeed .a-period') === null, true, '...and today\'s log names no period');
    await buildRange(p);
    eq(await p.$('#rangeReportWrap .range-periods') === null, true, '...and the range report has no By period table');
    const csv = await downloadText(p, '#csvRangeBtn', { what: 'the range CSV' });
    ok(!/Period/.test(csv), '...nor the CSV a Period column');
    eq(await raw(p, KEY), null, '001 wrote no calendar');
    await done(p, '001 no calendar');
  }
  {
    const cal = calendar();
    const p = await openAt(HALL, NOW, { [KEY]: cal });
    await seedHall(p);
    eq(await historyHead(p), ['Student', 'Destination', 'Period', 'Out', 'In', 'Duration', 'Note'], '001 with a calendar: the history table has a Period column');
    eq(await historyPeriods(p), TRIPS.map((t) => [t[0], t[4]]),
      '...each trip named by the period its time fell in (B and A schedules, the half day, passing, before/after, closed, no time)');
    eq(await text(p, '#activityFeed .a-period'), 'Period 1', 'today\'s log names the period beside the time');
    const v = await a11yScan(p, { include: ['#historyWrap'] });
    eq(v.map((x) => x.id), [], '001\'s history table has no serious or critical axe finding');

    await p.evaluate(() => { window.print = () => {}; });
    await p.selectOption('#printSelect', '0');
    await p.click('#printBtn');
    eq((await p.$$eval('#printHead th', (ths) => ths.map((t) => t.textContent)))[2], 'Period', 'the printed day has a Period column');
    eq(await p.$$eval('#printBody tr', (trs) => trs.map((tr) => tr.cells[2].textContent)), TRIPS.map((t) => t[4]), '...with the same periods');

    await buildRange(p);
    const want = [['Period 2', '2', '9 min'], ['Period 1', '1', '3 min'], ['Period 3', '1', '7 min'],
      ['—', '2', '18 min'], ['After school', '1', '11 min'], ['Before school', '1', '9 min'], ['Passing time', '1', '6 min']];
    const table = await p.$$eval('#rangeReportWrap .range-periods tbody tr', (trs) => trs.map((tr) => Array.from(tr.cells, (c) => c.textContent)));
    eq(table, want, 'the range report groups the trips by period, periods first and most passes first');
    await p.click('#printRangeBtn');
    eq(await p.$$eval('#rangePrintPeriods tbody tr', (trs) => trs.length), want.length, '...and prints the same table');
    const csv = (await downloadText(p, '#csvRangeBtn', { what: 'the range CSV' })).replace(/^﻿/, '');
    const lines = csv.split(/\r?\n/);
    ok(lines.includes('Period,Passes,Total minutes'), 'the CSV carries the By period table');
    ok(lines.some((l) => /^Date,Student,Destination,Period,Out,Back,Minutes,Note$/.test(l)), '...and a Period column in its detail');
    ok(lines.some((l) => /,Ben,Restroom,Passing time,/.test(l)), '...filled in per trip');
    eq(await raw(p, KEY), cal, '001 left the calendar as it found it');
    await done(p, '001 calendar');
  }
  {
    const p = await openAt(HALL, NOW);
    await seedHall(p);
    const other = await p.context().newPage();
    await other.goto(BASE + '/index.html');
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, calendar()]);
    await settle(p, 300);
    eq((await historyHead(p))[2], 'Period', '001 picks up a calendar another tab saved, without a reload');
    await other.close();
    await done(p, '001 another tab');
  }

  /* ═══ 036 Final Grade Checker ═══ */
  const checked = (p) => p.$eval('input[name="need-solve"]:checked', (r) => r.value);
  {
    const p = await openAt(GRADE, at(DEC1, '10:00'));
    eq(await p.$eval('#need-calendar', (e) => e.hidden), true, '036 with no calendar: no note');
    eq(await checked(p), '3', '...and Quarter 4 is the open one, as before');
    await done(p, '036 no calendar');
  }
  {
    const cal = calendar();
    const p = await openAt(GRADE, at(DEC1, '10:00'), { [KEY]: cal });
    await p.click('#tab-need-btn');
    const n = Q2_LEFT.length;
    eq(await text(p, '#need-calendar'),
      `From the School Calendar: today is in Quarter 2 (${await dateWords(p, Q2.start)} to ${await dateWords(p, Q2.end)}), ` +
      `${n} school days left, ${Q2_HALF} of them half days. Quarter 2 is marked as the open one; choose another if you need to.`,
      '036 on Dec 1 names Quarter 2, its dates and the school days left, half days named');
    eq(await checked(p), '1', '...and marks Quarter 2 as the open one');
    eq(await p.$eval('#need-q2', (e) => e.disabled), true, '...whose box is the one solved for');
    const v = await a11yScan(p, { include: ['#need-section'] });
    eq(v.map((x) => x.id), [], '036\'s need tab has no serious or critical axe finding (the page sweep never opens it)');
    await p.check('input[name="need-solve"][value="3"]');
    eq([await p.$eval('#need-q2', (e) => e.disabled), await p.$eval('#need-q4', (e) => e.disabled)], [false, true], 'the teacher can still choose another quarter');
    eq(await raw(p, KEY), cal, '036 left the calendar as it found it');
    await done(p, '036 Dec 1');
  }
  {
    const p = await openAt(GRADE, at('2026-07-01', '10:00'), { [KEY]: calendar() });
    eq(await text(p, '#need-calendar'), `From the School Calendar: the school year starts ${await dateWords(p, SEED.meta.start)}.`, '036 before the year says when it starts');
    eq(await checked(p), '3', '...and marks nothing');
    await done(p, '036 before');
  }
  {
    const p = await openAt(GRADE, at('2027-07-01', '10:00'), { [KEY]: calendar() });
    eq(await text(p, '#need-calendar'), `From the School Calendar: the school year ended ${await dateWords(p, SEED.meta.end)}.`, '036 after the year says it ended');
    await done(p, '036 after');
  }
  {
    const p = await openAt(GRADE, at(DEC1, '10:00'), { [KEY]: calendar({ extraMp: ['2026-09-30', '2027-03-01'] }) });
    ok(/^From the School Calendar: today is in grading period 3 of 6 \(/.test(await text(p, '#need-calendar') || ''), '036 does not read six grading periods as quarters');
    ok(!/marked as the open one/.test(await text(p, '#need-calendar') || ''), '...says nothing is marked');
    eq(await checked(p), '3', '...and marks nothing');
    await done(p, '036 six periods');
  }
  {
    const p = await openAt(GRADE, at(DEC1, '10:00'));
    const other = await p.context().newPage();
    await other.goto(BASE + '/index.html');
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, calendar()]);
    await settle(p, 300);
    ok(/Quarter 2/.test(await text(p, '#need-calendar') || ''), '036 picks up a calendar another tab saved');
    eq(await checked(p), '3', '...without moving the teacher\'s choice');
    await other.close();
    await done(p, '036 another tab');
  }
}

console.log('Path 9 P3: 001 and 036 read the school-year spine');
await scenario();

/* ═══ deliberate breaks: each altered file must fail the scenario ═══ */
const H = '**/001-hall-pass-log.html', G = '**/036-final_grade_checker.html', S = '**/_shared/school-day.js';
const BREAKS = [
  ['001: a column with no calendar', { [H]: (s) => s.replace('if (!ctx) return null;', "if (!ctx) return '-';") }],
  ['001: passing time unnamed', { [H]: (s) => s.replace("between: 'Passing time', ", '') }],
  ['001: the letters forgotten', { [H]: (s) => s.replace('opts: { letters: SchoolDay.abLetters(cal),', 'opts: { letters: {},') }],
  ['001: periods not first', { [H]: (s) => s.replace('return (notPeriod(a.period) - notPeriod(b.period)) || ', 'return ') }],
  ['001: no Period in the CSV', { [H]: (s) => s.replace('var withPeriod = !!lastRangeReport.periods;', 'var withPeriod = false;') }],
  ['001: another tab ignored', { [H]: (s) => s.replace('if (!state || (e.key !== null && !(window.SchoolDay && e.key === SchoolDay.KEY))) return;', 'return;') }],
  ['036: the quarter not marked', { [G]: (s) => s.replace('if (radio) radio.checked = true;', '') }],
  ['036: half days not named', { [G]: (s) => s.replace("(!left.half ? '' :", "(true ? '' :") }],
  ['036: any year read as quarters', { [G]: (s) => s.replace('const quarters = periods.length === QUARTERS;', 'const quarters = true;') }],
  ['school-day: closures counted as days left', { [S]: (s) => s.replace('      if (!isSchoolDay(cal, iso)) continue;\n      out.days++;', '      if (!isWeekday(iso)) continue;\n      out.days++;') }],
];
let caught = 0;
for (const [name, e] of BREAKS) {
  edits = e;
  quiet = true; breakFails = 0;
  try { await scenario(); } catch (err) { breakFails++; }
  quiet = false;
  for (const c of browser.contexts()) await c.close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}
edits = {};

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
