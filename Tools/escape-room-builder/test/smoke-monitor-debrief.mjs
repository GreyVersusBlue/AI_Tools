// smoke-monitor-debrief.mjs — 019's Print/Preview Debrief on the teacher monitor (Path 18 P4, step 2).
//
//   node Tools/escape-room-builder/test/smoke-monitor-debrief.mjs      (or: npm run test:er-monitor-debrief)
//
// The sheet is _shared/stations-debrief.js (018's too), drawn from the record the monitor kept
// (smoke-monitor-record.mjs) against a saved room. Cases: the path is the order the team left the
// stations, numbered as the room is, with times from the teacher's clock; the columns for wrong tries
// and hints are not there and the sheet says why, rather than print a 0; the room that holds the record's
// stations is chosen for the teacher and another can be picked; two pages a team (path, then a reflection
// page with the room's wording); a start that was never pressed gives dashes, not guessed times; a team
// name with markup is text; the record card passes axe; a room that does not hold the record's stations says so and lists them as
// they are; no saved room, or no record, turns the buttons off; Preview opens the kit's dialog and does
// not print; Print calls print() once. No console errors. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8576;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/escape-room-builder/monitor.html';
const ROOMS = 'escape-room-builder:rooms', REC = 'escape-room-builder:monitor-record';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const T0 = Date.UTC(2026, 9, 28, 14, 0, 0);
const st = (id, clue, extra) => ({ id, clue: 'Clue for ' + clue, answers: ['a'], hint: '', hintCost: 0, next: null, ...extra });
const room = (name, stations) => ({ name, roomId: 'r-' + name, storyIntro: '', stations });
const REAL = room('Library escape', [st('aaaa', 'Card catalog'), st('bbbb', 'Locked drawer'), st('cccc', 'Final door')]);
const OTHER = room('Science lab', [st('zzzz', 'Beaker')]);
const rec = (teams, raceStartAt = T0) => ({ v: 1, at: T0 + 3600000, raceStartAt, teams });
const team = (name, marks) => ({ name, code: '', marks, attempts: {}, hintsUsed: {}, penaltyMs: 0 });
const RECORD = rec([
  team('Owls', { bbbb: { at: T0 + 120000 }, aaaa: { at: T0 + 300000 }, cccc: { at: T0 + 500000 } }),
  team('<b>Hawks</b>', { aaaa: { at: T0 + 90000 } }),
]);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
const seed = (rooms, record) => page.evaluate(([rk, rv, kk, kv]) => {
  localStorage.clear();
  if (rv) localStorage.setItem(rk, JSON.stringify({ v: 1, data: { current: Object.keys(rv)[0], sets: rv } }));
  if (kv) localStorage.setItem(kk, JSON.stringify({ v: 1, data: kv }));
}, [ROOMS, rooms, REC, record]);
const open = async (rooms, record) => {
  await page.goto(URL_PAGE, { waitUntil: 'load' }); await seed(rooms, record);
  await page.reload({ waitUntil: 'load' }); await settle(page, 300);
};
const cards = () => page.evaluate(() => [...document.querySelectorAll('#printDebriefGrid .p-card')].map(c => ({
  num: c.querySelector('.p-num').textContent, label: c.querySelector('.p-label').textContent,
  sum: (c.querySelector('.p-debrief-sum') || {}).textContent || '', open: [...c.querySelectorAll('.p-debrief-open')].map(x => x.textContent),
  head: [...c.querySelectorAll('table.p-debrief thead th')].map(x => x.textContent),
  rows: [...c.querySelectorAll('table.p-debrief tbody tr')].map(r => [...r.children].map(x => x.textContent)),
  qs: [...c.querySelectorAll('.p-reflect-q')].map(x => x.textContent), html: c.innerHTML
})));
const print = async () => { await page.locator('#printDebriefBtn').click(); await settle(page, 250); return cards(); };

console.log('019 monitor — the debrief for a room');
await open({ [REAL.name]: REAL, [OTHER.name]: OTHER }, RECORD);
eq(await page.locator('#debriefRoom').inputValue(), 'Library escape', 'the room that holds the record\'s stations is chosen');
ok(await page.locator('#printDebriefBtn').isEnabled() && await page.locator('#previewDebriefBtn').isEnabled(), 'Print and Preview are on');
let c = await print();
eq(c.map(x => x.label), ['Owls', 'Owls', '<b>Hawks</b>', '<b>Hawks</b>'], 'two pages a team, a team\'s together; a name with markup is text');
ok(!c[2].html.includes('<b>Hawks'), 'markup in a name is not markup on the sheet');
eq(c[0].num, 'Room debrief', 'the first page is the path');
eq(c[0].rows.map(r => r[1]), ['Station 2', 'Station 1', 'Station 3'], 'the path is the order the team left the stations, numbered as the room is (a room\'s stations have no names)');
eq(c[0].rows.map(r => r[2]), ['2:00', '5:00', '8:20'], 'time since the clock was started');
eq(c[0].rows.map(r => r[3]), ['2:00', '3:00', '3:20'], 'time on each leg');
eq(c[0].head, ['#', 'Station', 'Reached at', 'Time on leg', 'Sent on to'], 'no wrong-tries or hint column, because nobody counted them');
ok(/3 of 3 stations reached/.test(c[0].sum) && /finish time 8:20/.test(c[0].sum) && !/wrong tr|hint/.test(c[0].sum), 'the summary has no count of tries or hints: ' + c[0].sum);
ok(c[0].open.some(t => /not on this sheet/.test(t)), 'and the sheet says why: ' + c[0].open.join(' | '));
ok(c[2].open.some(t => /Still open: Station 2, Station 3\./.test(t)), 'a team part-way lists the stations still open: ' + c[2].open.join(' | '));
eq(c[1].num, 'Room debrief — reflection', 'the second page is the reflection');
eq(c[1].qs.length, 4, 'four prompts');
ok(c[1].qs[0].includes('puzzle') && !c[1].qs.some(q => /hunt/.test(q)), 'worded for a room, not a hunt');

console.log('019 monitor — the room is the teacher\'s to choose');
await page.locator('#debriefRoom').selectOption('Science lab');
eq(await page.locator('#debriefRoom').inputValue(), 'Science lab', 'another room can be picked');
c = await print();
eq(c[0].rows, [['No stations reached yet.']], 'a room that holds none of the stations shows none reached, not invented ones');

console.log('019 monitor — no clock start: dashes, not guesses');
await open({ [REAL.name]: REAL }, rec(RECORD.teams, null));
c = await print();
eq(c[0].rows.map(r => r[2]), ['—', '—', '—'], 'no time since the start');
eq(c[0].rows.map(r => r[3]), ['—', '3:00', '3:20'], 'the first leg has no start to count from, the others do');
ok(/finish time —/.test(c[0].sum), 'no finish time');

console.log('019 monitor — the record card is accessible');
await open({ [REAL.name]: REAL }, RECORD);
eq((await a11yScan(page, { impact: 'serious', include: '#recordLine' })).map(v => v.id), [], 'axe finds nothing serious in the record card (the room has a label)');
const cardViolations = await a11yScan(page, { impact: 'serious', include: '#debriefRoom' });
eq(cardViolations.map(v => v.id), [], 'nor on the room choice');

console.log('019 monitor — Preview and Print');
await open({ [REAL.name]: REAL }, RECORD);
await page.evaluate(() => { window.__printCalls = 0; });
await page.locator('#previewDebriefBtn').click(); await settle(page, 400);
ok(await page.locator('dialog.pk-preview[open]').count() === 1, 'Preview opens the kit\'s dialog');
eq(await page.evaluate(() => window.__printCalls), 0, 'and does not print');
await page.keyboard.press('Escape'); await settle(page, 200);
await page.locator('#printDebriefBtn').click(); await settle(page, 200);
eq(await page.evaluate(() => window.__printCalls), 1, 'Print calls print() once');

console.log('019 monitor — nothing to print');
await open({ [REAL.name]: REAL }, null);
ok(await page.locator('#printDebriefBtn').isDisabled() && await page.locator('#previewDebriefBtn').isDisabled(), 'no record: both buttons are off');
await open(null, RECORD);
ok(await page.locator('#printDebriefBtn').isDisabled() && await page.locator('#previewDebriefBtn').isDisabled(), 'no saved room: both buttons are off');
ok(/Save the room in the Escape Room Builder/.test(await page.locator('#debriefNote').textContent()), 'and it says what to do');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`monitor debrief: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
