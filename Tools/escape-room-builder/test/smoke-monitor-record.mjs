// smoke-monitor-record.mjs — the teacher monitor's record of a room's play (Path 18 P4, step 1).
//
//   node Tools/escape-room-builder/test/smoke-monitor-record.mjs      (or: npm run test:er-monitor-record)
//
// Devices are fed through the page's own message path (ErBoard.applyMessage, then the page's save, which the
// real message handler calls) because a WebRTC pairing needs two peers. Cases: nothing kept at first;
// a team moving off a station is kept, on this device, under its typed name and the teacher's clock, in the
// shape Stations.debrief reads; it is still there after a reload and the page says so; a name typed later
// and the clock reaching the record; a device that has moved nobody does not overwrite what is kept; Clear
// removes it (and answers No when the teacher declines); a stored value that is not a record is ignored
// and left alone. Nothing about wrong tries or hints is kept (a device does not report them), and nothing
// is requested from outside the page. No console errors. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8575;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/escape-room-builder/monitor.html';
const KEY = 'escape-room-builder:monitor-record';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);

const stored = () => page.evaluate(k => { const r = localStorage.getItem(k); return r === null ? null : JSON.parse(r); }, KEY);
const line = () => page.locator('#recordLine').textContent();
const add = (id) => page.evaluate(i => { window.__monitor.devices.push({ id: i, station: 0, total: 0, done: false, connected: true, score: null }); window.__monitor.render(); }, id);
const feed = (id, msg, now) => page.evaluate(([i, m, n]) => {
  const d = window.__monitor.devices.filter(x => x.id === i)[0];
  window.ErBoard.applyMessage(d, m, n);
  window.__monitor.render(); window.__monitor.save();
}, [id, msg, now]);

console.log('record — nothing kept');
ok(/Nothing kept yet/.test(await line()), 'the page says nothing is kept');
ok(await page.locator('#clearRecordBtn').isDisabled(), 'and Clear is not offered');
eq(await stored(), null, 'and nothing is on disk');

console.log('record — a team moves on');
await add(1);
await feed(1, { station: 0, id: 'aaaa', total: 3 }, 1000);
eq(await stored(), null, 'arriving at a station keeps nothing');
await feed(1, { station: 1, id: 'bbbb', total: 3 }, 2000);
let s = await stored();
eq(s && s.v, 1, 'moving on is kept in the Store envelope');
eq(s && s.data.teams, [{ name: 'Team 1', code: '', marks: { aaaa: { at: 2000 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }], 'the record is the run shape, with no tries or hints, under the monitor\'s clock');
eq(s && s.data.raceStartAt, null, 'no clock was started');
ok(/1 team, 1 station passed, no clock started/.test(await line()), 'the page says what it kept: ' + (await line()));
ok(await page.locator('#clearRecordBtn').isEnabled(), 'and Clear is offered');

console.log('record — a name and the clock reach it');
await page.locator('#rosterBody input.team-name[data-device="1"]').fill('Owls');
eq((await stored()).data.teams[0].name, 'Owls', 'a name typed later is kept');
await page.locator('#clockBtn').click();
ok(typeof (await stored()).data.raceStartAt === 'number', 'starting the clock is kept');

console.log('record — after a reload');
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
ok(/Kept on this device.*1 team, 1 station passed/.test(await line()), 'the record is there and said so: ' + (await line()));
eq(await page.evaluate(() => window.__monitor.kept().teams[0].name), 'Owls', 'with the name');
await add(7);
await page.evaluate(() => window.__monitor.save());
eq((await stored()).data.teams.length, 1, 'a new device that has moved nobody does not overwrite it');

console.log('record — clear');
page.once('dialog', d => d.dismiss());
await page.locator('#clearRecordBtn').click();
ok((await stored()) !== null, 'declining the question keeps it');
page.once('dialog', d => d.accept());
await page.locator('#clearRecordBtn').click();
eq(await stored(), null, 'accepting removes it');
ok(/Nothing kept yet/.test(await line()), 'and the page says so');

console.log('record — something that is not a record');
await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, data: { v: 9, teams: 'no' } })), KEY);
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
ok(/Nothing kept yet/.test(await line()), 'it is ignored');
ok((await stored()) !== null, 'and left on disk');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`monitor record: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
