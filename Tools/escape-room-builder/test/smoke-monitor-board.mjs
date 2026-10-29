// smoke-monitor-board.mjs — the teacher monitor's teams, clock and leaderboard (Path 18 P3).
//
//   node Tools/escape-room-builder/test/smoke-monitor-board.mjs      (or: npm run test:er-monitor-board)
//
// Devices are added through the page's own message path (window.__monitor and ErBoard.applyMessage)
// because a WebRTC pairing needs two peers; the pairing itself is smoke-pairing-qr's. Cases: no device,
// no board; devices appear ranked (finished first, the earlier finish first, then stations reached);
// a team name typed in the roster reaches the board and keeps the cursor when a message redraws the
// roster; the clock: a finish before Start has no time, Start then a finish gives one, Reset clears;
// a disconnected device is marked; a restarted room drops out of Finished; a name with markup is
// text. No console errors. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8573;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/escape-room-builder/monitor.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);

const add = (id, connected = true) => page.evaluate(([i, c]) => {
  window.__monitor.devices.push({ id: i, station: 0, total: 0, done: false, connected: c, score: null });
  window.__monitor.render();
}, [id, connected]);
const feed = (id, msg) => page.evaluate(([i, m]) => {
  const d = window.__monitor.devices.filter(x => x.id === i)[0];
  window.ErBoard.applyMessage(d, m, Date.now());
  window.__monitor.render();
}, [id, msg]);
const board = () => page.locator('#boardBody tr').evaluateAll(rs => rs.map(r => Array.from(r.cells).map(c => c.textContent.trim())));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

console.log('monitor — nothing connected');
ok(await page.locator('#boardTable').isHidden(), 'no board table with no device');
ok(await page.locator('#boardEmpty').isVisible(), 'and a line saying it will fill in');
eq(await page.locator('#clockBtn').textContent(), 'Start the clock', 'the clock is not running');

console.log('monitor — devices rank themselves');
await add(1); await add(2); await add(3);
await feed(1, { station: 1, total: 4, done: false, score: 5 });
await wait(20);
await feed(3, { station: 3, total: 4, done: true });
await wait(20);
await feed(2, { station: 2, total: 4, done: false });
let rows = await board();
eq(rows.map(r => r[1]), ['Team 3', 'Team 2', 'Team 1'], 'the finished team first, then the one further along');
eq(rows[0][2], '🏁 Finished', 'finished shows as such');
eq(rows[1][2], '2 of 4', 'others show stations passed');
eq(rows[2][3], '5', 'a score is shown beside the rank');
eq(rows[0][4], 'Start the clock', 'a finish with no clock started asks for it');

console.log('monitor — a team name typed in the roster');
const nameBox = page.locator('#rosterBody input.team-name[data-device="2"]');
await nameBox.fill('Owls');
rows = await board();
eq(rows.map(r => r[1]), ['Team 3', 'Owls', 'Team 1'], 'the board shows the typed name');
await nameBox.focus();
await nameBox.pressSequentially('!');
await feed(1, { station: 1, total: 4, done: false });
ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('team-name') && document.activeElement.getAttribute('data-device') === '2'), 'a message redrawing the roster keeps the cursor in the name');
eq(await nameBox.inputValue(), 'Owls!', 'and what was typed');
await nameBox.fill('<b>Owls</b>');
ok(!(await page.locator('#boardBody b').count()), 'markup in a name is text on the board');
await nameBox.fill('Owls');

console.log('monitor — the clock');
await page.locator('#clockBtn').click();
eq(await page.locator('#clockBtn').textContent(), 'Reset the clock', 'Start becomes Reset');
await add(4); await feed(4, { station: 3, total: 4, done: true });
rows = await board();
const t4 = rows.filter(r => r[1] === 'Team 4')[0];
ok(/^0:0\d$/.test(t4[4]), 'a team finishing after Start gets a time: ' + t4[4]);
eq(rows.filter(r => r[1] === 'Team 3')[0][4], '—', 'a team that finished before Start has none');
eq(rows[0][1], 'Team 3', 'and still ranks above a later finisher');
await page.locator('#clockBtn').click();
eq(await page.locator('#clockBtn').textContent(), 'Start the clock', 'Reset stops it');
eq((await board()).filter(r => r[1] === 'Team 4')[0][4], 'Start the clock', 'and the time goes');

console.log('monitor — disconnect and restart');
await page.evaluate(() => { window.__monitor.devices[0].connected = false; window.__monitor.render(); });
ok((await board()).some(r => r[1] === 'Team 1 (disconnected)'), 'a disconnected device is marked on the board');
await feed(3, { station: 0, total: 4, done: false });
rows = await board();
ok(rows.filter(r => r[1] === 'Team 3')[0][2] === '0 of 4', 'a restarted room is not Finished');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`monitor board: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
