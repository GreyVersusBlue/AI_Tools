// smoke-term.mjs — 008's Term & year view, driven in a real page.
//
//   node Tools/behavior-points-tracker/test/smoke-term.mjs
//
// Two sections with archived days across a school year. The card must add them
// up the way term.js's own suite says (this suite only checks the page reads
// the right data and draws it): this section by default, every section on ask,
// a range from the date boxes and from the three presets (the page clock is
// pinned to 2026-10-20), by week and by month, a CSV that matches the table,
// names escaped, nothing written to storage, and the card at 360 px and clean
// under axe. Every name here is invented.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8642;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE_URL = BASE + '/Tools/008-behavior-points-tracker.html';
const KEY = 'behavior-points-tracker-sections';
void path; void fileURLToPath;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const row = (name, points, pos, neg, goal) => ({ name, points, pos, neg, goal: goal === undefined ? null : goal, notes: [] });
const day = (iso, rows) => ({ date: iso, iso, rows });
const section = (name, names, history, goals) => ({
  name, namesText: names.join('\n'), tags: [{ id: 't1', label: 'On Task', delta: 1, cat: 'effort' }],
  armedTagId: 'm+1', points: {}, posCount: {}, negCount: {}, log: [], history, goals: goals || {}, sortMode: 'name'
});
const SEED = {
  current: 'Period 3',
  sets: {
    'Period 3': section('Period 3', ['Ann Lee', 'Bo <b>Park</b>'], [
      day('2026-10-14', [row('Ann Lee', 4, 4, 0, 3), row('Bo <b>Park</b>', -1, 0, 1)]),
      day('2026-10-08', [row('Ann Lee', 2, 2, 0, 3), row('Bo <b>Park</b>', 3, 3, 0)]),
      day('2026-09-30', [row('Ann Lee', 5, 5, 0, 3)]),
      day('2026-05-12', [row('Ann Lee', 7, 7, 0, 3)]),
    ], { 'Ann Lee': 3 }),
    'Period 5': section('Period 5', ['Ann Lee', 'Cy Ode'], [
      day('2026-10-08', [row('Ann Lee', 9, 9, 0), row('Cy Ode', 2, 2, 0)]),
    ]),
  }
};

const server = await serve(PORT);
const browser = await launch();
console.log('Behavior & Points Tracker — term & year view');

async function open(width = 1300) {
  const page = await prepPage(browser, BASE, { width, height: 1000 });
  page.__errs = [];
  page.on('pageerror', e => page.__errs.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00-04:00'));
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, SEED]);
  await page.goto(PAGE_URL);
  await page.waitForSelector('#termWrap');
  await page.waitForTimeout(300);
  return page;
}
const tables = page => page.$$eval('#termWrap table', ts => ts.map(t => [...t.rows].map(r => [...r.cells].map(c => c.textContent))));
const summary = page => page.$eval('#termWrap p', p => p.textContent);

{
  const page = await open();
  const before = await page.evaluate(k => localStorage.getItem(k), KEY);

  let [weeks, studs] = await tables(page);
  eq(await summary(page), '4 archived days, 2 students, +20 points.', 'this section, all days: the summary line');
  eq(weeks[0], ['Week', 'Days', 'Points', '+', '−'], 'by week by default');
  eq(weeks.slice(1).map(r => r[0]), ['Week of May 11, 2026', 'Week of Sep 28, 2026', 'Week of Oct 5, 2026', 'Week of Oct 12, 2026'], 'weeks, oldest first');
  eq(studs[0], ['Student', 'Days', 'Points', '+', '−', 'Target met'], 'one section: no Section column');
  eq(studs[1], ['Ann Lee', '4', '+18', '18', '0', '3 of 4'], "Ann Lee's line (only this section's days)");
  eq(await page.$$eval('#termWrap td b', e => e.length), 0, 'a name with markup in it is text, not markup');
  ok((await page.$eval('#termWrap', e => e.textContent)).includes('Bo <b>Park</b>'), '...and is shown as typed');

  await page.selectOption('#termBy', 'month');
  [weeks] = await tables(page);
  eq(weeks[0][0], 'Month', 'by month');
  eq(weeks.slice(1).map(r => r[0]), ['May 2026', 'Sep 2026', 'Oct 2026'], 'months');

  await page.fill('#termFrom', '2026-09-01');
  await page.fill('#termTo', '2026-10-10');
  await page.dispatchEvent('#termTo', 'change');
  await page.dispatchEvent('#termFrom', 'change');
  eq(await summary(page), '2 archived days, 2 students, +10 points.', 'a typed range: Sep 30 and Oct 8');

  await page.selectOption('#termScope', 'all');
  [, studs] = await tables(page);
  eq(studs[0], ['Student', 'Section', 'Days', 'Points', '+', '−', 'Target met'], 'every section adds a Section column');
  eq(studs.slice(1).filter(r => r[0] === 'Ann Lee').map(r => r[1]).sort(), ['Period 3', 'Period 5'], 'the same name in two sections is two lines');
  eq(await summary(page), '3 archived days, 4 students, +21 points.', 'Oct 8 in both sections is two days');

  await page.click('#termAll');
  eq([await page.inputValue('#termFrom'), await page.inputValue('#termTo')], ['', ''], 'All recorded days clears the range');
  eq((await summary(page)).split(',')[0], '5 archived days', '...and takes every section-day');

  await page.click('#termThisYear');
  eq([await page.inputValue('#termFrom'), await page.inputValue('#termTo')], ['2026-08-01', '2027-07-31'], 'This school year (clock is Oct 2026)');
  eq((await summary(page)).split(',')[0], '4 archived days', '...leaves out May 2026');
  await page.click('#termLast30');
  eq([await page.inputValue('#termFrom'), await page.inputValue('#termTo')], ['2026-09-21', '2026-10-20'], 'Last 30 days ends today');
  eq((await summary(page)).split(',')[0], '4 archived days', '...Sep 30, Oct 8 (x2), Oct 14');

  await page.fill('#termFrom', '2027-01-01');
  await page.dispatchEvent('#termFrom', 'change');
  await page.fill('#termTo', '');
  await page.dispatchEvent('#termTo', 'change');
  ok(/No archived days fall in that range/.test(await page.$eval('#termWrap', e => e.textContent)), 'an empty range says so');

  // CSV matches the table
  await page.click('#termAll');
  const csv = await downloadText(page, '#termCsvBtn', { what: 'the term CSV' });
  const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
  eq(lines[0], 'Student,Section,Days,Points,Positive taps,Negative taps,Target days met,Days with a target', 'CSV header');
  eq(lines.length, 1 + 4, 'CSV has a line per student-section');
  ok(lines.includes('Ann Lee,Period 3,4,18,18,0,3,4'), 'CSV carries Ann Lee in Period 3');
  ok(lines.includes('"Bo <b>Park</b>",Period 3,2,2,3,1,0,0'.replace('"Bo <b>Park</b>"', 'Bo <b>Park</b>')), 'CSV carries the odd name as typed');

  // nothing stored
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), before, 'viewing and downloading wrote nothing to storage');

  await page.selectOption('#termScope', 'this');
  eq(page.__errs, [], 'no page errors');
  const scan = await a11yScan(page);
  eq(scan.map ? scan.map(v => v.id) : scan, [], 'no serious axe violations');
  await page.context().close();
}

/* 360 px: the card and its tables stay inside the screen */
{
  const page = await open(360);
  const over = await page.evaluate(() => {
    const c = document.getElementById('termCard');
    return { card: c.scrollWidth - c.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth };
  });
  ok(over.card <= 1, 'the card has no sideways overflow at 360 px (' + over.card + ')');
  ok(over.doc <= 1, 'the page has no sideways overflow at 360 px (' + over.doc + ')');
  await page.context().close();
}

/* A section with no archived days */
{
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  await page.goto(PAGE_URL);
  await page.waitForTimeout(300);
  ok(/Archive at least one day/.test(await page.$eval('#termWrap', e => e.textContent)), 'a fresh page invites the first archive');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
