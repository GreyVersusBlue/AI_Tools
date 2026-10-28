// smoke-debrief.mjs — 018's debrief print (Path 18 P4, v394).
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-debrief.mjs      (or: npm run test:scavenger-hunt-debrief)
//
// Print Debrief (and Preview Debrief in front of it) builds two pages per team from the run the page
// already holds: the path in the order the team reached the stations, the time since the clock started
// and on each leg, wrong tries, the hint taken, where a branch sent the team, then a reflection page
// with room to write. Cases: the path page for a team that finished (order reached, not station order;
// times; misses; hint; branch), a team part-way (the open stations listed), a team that has done nothing
// (an empty table, no crash), no clock start (a dash, not a guessed time), the reflection page (four
// prompts, blank lines), two pages per team, nothing printed with no teams, an older hunt (marks as bare
// numbers) still prints. No console errors. Exits 1 on failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import * as F from '../../stations/test/_fixtures.mjs';

const PORT = 8574;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/018-qr-scavenger-hunt-builder.html';
const KEY = 'qr-scavenger-hunt-sets';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const T0 = Date.UTC(2026, 9, 28, 14, 0, 0);
const hunt = (raceStartAt = T0) => ({
  name: 'Debrief hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true, id: 'dbr1',
  stations: [
    { id: 'a1xx', ...F.hSt('Gate', 'Walk to the gate', { hint: 'Look up', hintPenalty: '2' }) },
    { id: 'b2xx', ...F.hSt('Fork', 'Which way?', { qType: 'choice', choices: ['Left', 'Right'], correctChoice: 0, codeWord: 'FORK' }) },
    { id: 'c3xx', ...F.hSt('Bridge', 'Cross the bridge') },
  ],
  run: { by: 'id', timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt, checkinStation: 'a1xx', teams: [
    F.hTeam('Reds', 'K7Q', { marks: { b2xx: { at: T0 + 120000, correct: true, attempts: 2, branch: 'a1xx' }, a1xx: { at: T0 + 300000, correct: true, attempts: 0 }, c3xx: { at: T0 + 500000, correct: true } },
      attempts: { b2xx: 2 }, hintsUsed: { a1xx: { at: T0 + 250000, penaltyMin: 2 } }, penaltyMs: 120000 }),
    F.hTeam('Blues', 'M3X', { marks: { c3xx: { at: T0 + 90000, correct: true } }, attempts: { a1xx: 1 } }),
    F.hTeam('Greens', 'R9T'),
  ] }
});

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());
const seed = (h) => page.evaluate(([k, x]) => { localStorage.setItem(k, JSON.stringify({ current: x.name, sets: { [x.name]: x } })); }, [KEY, h]);
const open = async () => { await page.goto(URL_PAGE, { waitUntil: 'load' }); await settle(page, 400); await page.locator('#tab-run').click(); await settle(page, 200); };
const cards = () => page.evaluate(() => [...document.querySelectorAll('#print-debrief-grid .p-card')].map(c => ({
  num: c.querySelector('.p-num').textContent, label: c.querySelector('.p-label').textContent,
  sum: (c.querySelector('.p-debrief-sum') || {}).textContent || '', open: (c.querySelector('.p-debrief-open') || {}).textContent || '',
  rows: [...c.querySelectorAll('table.p-debrief tbody tr')].map(r => [...r.children].map(x => x.textContent)),
  qs: [...c.querySelectorAll('.p-reflect-q')].map(x => x.textContent), lines: c.querySelectorAll('.p-reflect-lines').length
})));
const print = async () => { await page.locator('#print-debrief-btn').click(); await settle(page, 250); return cards(); };

console.log('018 — the debrief for a finished team');
await page.goto(URL_PAGE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await seed(hunt()); await open();
let c = await print();
eq(c.length, 6, 'two pages per team, three teams');
eq(c.map(x => x.label), ['Reds', 'Reds', 'Blues', 'Blues', 'Greens', 'Greens'], 'a team\'s pages are together');
eq(c[0].rows.map(r => r[1]), ['Station 2 — Fork', 'Station 1 — Gate', 'Station 3 — Bridge'], 'the path is the order reached, not the station order');
eq(c[0].rows.map(r => r[2]), ['2:00', '5:00', '8:20'], 'time since the clock started');
eq(c[0].rows.map(r => r[3]), ['2:00', '3:00', '3:20'], 'time on each leg');
eq(c[0].rows.map(r => r[4]), ['2', '0', '0'], 'wrong tries before each stop');
eq(c[0].rows.map(r => r[5]), ['—', 'Used (−2 min)', '—'], 'the hint is shown at the station it was taken');
eq(c[0].rows.map(r => r[6]), ['Station 1', '—', '—'], 'a branch shows where the team was sent');
ok(/3 of 3 stations reached/.test(c[0].sum) && /finish time 8:20/.test(c[0].sum) && /2 wrong tries/.test(c[0].sum) && /1 hint/.test(c[0].sum) && /\+2 min penalty/.test(c[0].sum), 'the summary line: ' + c[0].sum);
eq(c[0].open, '', 'nothing is still open for a team that finished');

console.log('018 — a team part-way, and a team that has done nothing');
eq(c[2].rows.map(r => r[1]), ['Station 3 — Bridge'], 'Blues reached one station');
ok(/Still open: Station 1 \(1 wrong try\), Station 2\./.test(c[2].open), 'the stations still open, with their wrong tries: ' + c[2].open);
eq(c[4].rows, [['No stations reached yet.']], 'a team with no marks has an empty table');
ok(/0 of 3 stations reached/.test(c[4].sum) && /finish time —/.test(c[4].sum), 'and a dash for a finish time');

console.log('018 — the reflection page');
eq(c[1].num, 'Hunt debrief — reflection', 'the second page is the reflection');
eq(c[1].qs.length, 4, 'four prompts');
eq(c[1].lines, 8, 'two ruled lines under each');

console.log('018 — no clock start: a dash, not a guess');
await seed(hunt(null)); await open();
c = await print();
eq(c[0].rows.map(r => r[2]), ['—', '—', '—'], 'no time since the start');
eq(c[0].rows.map(r => r[3]), ['—', '3:00', '3:20'], 'the first leg has no start to count from, the others do');
ok(/finish time —/.test(c[0].sum), 'no finish time');

console.log('018 — an older hunt (bare-number marks, index keys) still prints');
await page.evaluate(() => localStorage.clear());
await seed({ name: 'Old', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
  stations: [F.hSt('One', 'First'), F.hSt('Two', 'Second')],
  run: { teams: [F.hTeam('Team 1', 'AAA', { marks: { 0: T0 } })], timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 0 } });
await open();
c = await print();
eq(c.length, 2, 'one team, two pages');
eq(c[0].rows.map(r => r[1]), ['Station 1 — One'], 'the old mark is read');

console.log('018 — no teams, nothing printed');
await seed({ name: 'Bare', cardsPerPage: '4', ecLevel: 'Q', showNumber: true, stations: [F.hSt('One', 'First')],
  run: { teams: [], timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 0 } });
await open();
await page.evaluate(() => { document.getElementById('print-debrief-grid').innerHTML = ''; });
c = await print();
eq(c.length, 0, 'no teams, no pages');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`scavenger hunt debrief: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
