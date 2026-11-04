// smoke-monitor-hostile.mjs — what a student device sends cannot run on the teacher's monitor (review H3), and the
// monitor's kept record survives a Reset, a reload and a re-paired team (review M7).
//
//   node Tools/escape-room-builder/test/smoke-monitor-hostile.mjs      (or: npm run test:er-monitor-hostile)
//
// A WebRTC pairing needs two peers, so window.WebRTCPair is replaced on each page by a stand-in whose channel is
// an EventTarget: the monitor's own Add device / Connect buttons and its own message handler run, and the suite
// dispatches the messages a device would send. On lock.html the stand-in records what the page sends.
//
// H3: a station or total that is not a number (markup, a script-shaped string, a numeric string with markup on
// the end) is refused whole: nothing reaches the roster's or the board's markup, no script runs, and the device
// keeps what it had. A good message afterwards still counts.
// M7: Reset stops the readout and keeps the start in the record; after a reload the first save keeps the teams
// from before it; a team the teacher pairs again as itself ("Who is connecting?") is its first device again (one
// row, one sheet), before and after a reload, and its old channel closing late does not mark it disconnected or
// speak for it. A record older than two hours is last class's and is replaced, as before. lock.html is not
// changed: the teacher, not the device, says who is reconnecting. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8684;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/escape-room-builder/monitor.html';
const KEY = 'escape-room-builder:monitor-record';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });

async function open() {
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(() => {
    window.__chans = [];
    window.WebRTCPair.createOffer = function () {
      const ch = new EventTarget();
      ch.readyState = 'connecting'; ch.send = function () {};
      ch.close = function () { ch.readyState = 'closed'; ch.dispatchEvent(new Event('close')); };
      window.__chans.push(ch);
      return Promise.resolve({ pc: { close: function () {} }, channel: ch, offerPayload: 'stand-in offer' });
    };
    window.WebRTCPair.applyAnswer = function () { return Promise.resolve(); };
  });
}
/** Pairs one device through the page's buttons, as `choice` ("Who is connecting?") when given; returns its channel's index. */
async function pair(choice) {
  await page.click('#addDeviceBtn');
  await page.waitForFunction(() => document.getElementById('offerText').value === 'stand-in offer');
  if (choice) await page.selectOption('#rejoinSelect', choice);
  await page.fill('#answerInput', 'stand-in reply');
  await page.click('#connectDeviceBtn');
  await settle(page, 100);
  return page.evaluate(() => {
    const i = window.__chans.length - 1, ch = window.__chans[i];
    ch.readyState = 'open'; ch.dispatchEvent(new Event('open'));
    return i;
  });
}
const send = (i, msg) => page.evaluate(([n, m]) => {
  window.__chans[n].dispatchEvent(new MessageEvent('message', { data: typeof m === 'string' ? m : JSON.stringify(m) }));
}, [i, msg]);
const drop = (i) => page.evaluate(n => window.__chans[n].close(), i);
const stored = () => page.evaluate(k => { const r = localStorage.getItem(k); return r === null ? null : JSON.parse(r).data; }, KEY);
const devices = () => page.evaluate(() => window.__monitor.devices.map(d => ({ id: d.id, station: d.station, total: d.total, connected: d.connected })));
const rows = (sel) => page.$$eval(sel + ' tr', trs => trs.length);

const choices = () => page.$$eval('#rejoinSelect option', os => os.map(o => [o.value, o.textContent]));

/* ── H3: a hostile message ─────────────────────────────────────────────── */
console.log('H3 — a station or total that is not a number');
await open();
await page.evaluate(() => { window.__pwned = 0; });
const d1 = await pair();
await send(d1, { station: 1, id: 'bbbb', total: 4, done: false });
eq(await devices(), [{ id: 1, station: 1, total: 4, connected: true }], 'a good message counts');
const HOSTILE = [
  { station: '<img src=x onerror="window.__pwned=1">', total: 5, done: false },
  { station: '"><script>window.__pwned=2</script>', total: 5, done: false },
  { station: 1, total: '5<img src=x onerror="window.__pwned=3">', done: false },
  { station: '1<img src=x onerror="window.__pwned=4">', total: 5, done: true },
  { station: { toString: 1 }, total: 5 },
  '{"station":2,"total":1e999}',
  { station: 2, total: null },
  { station: 2 },
  { station: -3, total: 5 },
  '{"station":"<svg onload=window.__pwned=5>","total":5}'
];
for (const m of HOSTILE) await send(d1, m);
await settle(page, 200);
eq(await page.evaluate(() => window.__pwned), 0, 'no script a device sent ran on the monitor');
eq(await page.$$eval('#rosterBody img, #rosterBody script, #rosterBody svg, #boardBody img, #boardBody script, #boardBody svg', e => e.length), 0,
  'and no element it sent is in the roster or the board');
eq(await devices(), [{ id: 1, station: 1, total: 4, connected: true }], 'the device keeps what it had');
ok(/Station 2 of 4/.test(await page.textContent('#rosterBody')), 'and the roster still says so: ' + (await page.textContent('#rosterBody')).trim());
await send(d1, { station: 2, id: 'cccc', total: 4, done: false });
eq((await devices())[0].station, 2, 'a good message after them still counts');

/* ── M7: Reset keeps the start ─────────────────────────────────────────── */
console.log('M7 — Reset keeps the start in the record');
await page.evaluate(k => localStorage.removeItem(k), KEY);
await open();
await page.click('#clockBtn');
const startAt = await page.evaluate(() => JSON.parse(localStorage.getItem('escape-room-builder:monitor-record') || 'null'));
const a = await pair();
await send(a, { station: 0, id: 'aaaa', total: 3 });
await send(a, { station: 1, id: 'bbbb', total: 3 });
const started = (await stored()).raceStartAt;
ok(typeof started === 'number', 'the started clock is in the record');
eq(startAt, null, '(nothing was kept before a team moved on)');
await page.click('#clockBtn');
eq(await page.textContent('#clockBtn'), 'Start the clock', 'Reset stopped the clock');
eq((await stored()).raceStartAt, started, 'and the record still has the start');
await send(a, { station: 2, id: 'cccc', total: 3 });
eq((await stored()).raceStartAt, started, 'and keeps it through a later solve');
ok(!/no clock started/.test(await page.textContent('#recordLine')), 'the page does not say no clock was started');
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
await page.evaluate(() => window.__monitor.save());
eq((await stored()).raceStartAt, started, 'a reload keeps the start too');

/* ── M7: a reload keeps the earlier solves ─────────────────────────────── */
console.log('M7 — a reload does not lose the earlier solves');
await page.evaluate(k => localStorage.removeItem(k), KEY);
await open();
const p1 = await pair();
ok(await page.locator('#rejoinRow').isHidden(), 'the first pairing offers no one to rejoin as');
const p2 = await pair();
await send(p1, { station: 0, id: 'aaaa', total: 3 });
await send(p1, { station: 1, id: 'bbbb', total: 3 });
await send(p2, { station: 0, id: 'aaaa', total: 3 });
await send(p2, { station: 1, id: 'bbbb', total: 3 });
await page.fill('#rosterBody input.team-name[data-device="1"]', 'Owls');
await page.fill('#rosterBody input.team-name[data-device="2"]', 'Foxes');
eq((await stored()).teams.map(t => t.name), ['Owls', 'Foxes'], 'two teams are kept');
await open();   // the teacher's tab reloads mid-game
const p3 = await pair();
await send(p3, { station: 0, id: 'aaaa', total: 3 });
await send(p3, { station: 1, id: 'bbbb', total: 3 });
let rec = await stored();
eq(rec.teams.map(t => t.name), ['Owls', 'Foxes', 'Team 1'], 'the first save after the reload keeps the teams from before it');
eq(Object.keys(rec.teams[0].marks), ['aaaa'], 'with their solves');
ok(/3 teams, 3 stations passed/.test(await page.textContent('#recordLine')), 'and the page counts them: ' + await page.textContent('#recordLine'));

console.log('M7 — a kept team paired again after the reload');
await page.click('#addDeviceBtn');
await page.waitForFunction(() => document.getElementById('offerText').value === 'stand-in offer');
ok(await page.locator('#rejoinRow').isVisible(), 'the pairing box asks who is connecting');
eq(await choices(), [['', 'A new team'], ['d:1', 'Team 1 (still connected)'], ['k:0', 'Owls (kept before this page was opened)'], ['k:1', 'Foxes (kept before this page was opened)']],
  'a new team by default, then the teams on the page and the kept ones');
eq(await page.inputValue('#rejoinSelect'), '', 'and "A new team" is picked');
await page.click('#cancelPairingBtn');
const p4 = await pair('k:0');
ok(/Owls/.test(await page.inputValue('#rosterBody input.team-name[data-device="2"]')), 'its roster row has the kept name');
await send(p4, { station: 1, id: 'bbbb', total: 3 });
await send(p4, { station: 2, id: 'cccc', total: 3 });
rec = await stored();
eq(rec.teams.map(t => t.name), ['Owls', 'Foxes', 'Team 1'], 'it adds no team to the record');
eq(Object.keys(rec.teams[0].marks), ['aaaa', 'bbbb'], 'its new solve is on its kept sheet');
await page.click('#addDeviceBtn');
await page.waitForFunction(() => document.getElementById('offerText').value === 'stand-in offer');
ok(!(await choices()).some(c => c[0] === 'k:0'), 'a kept team that has been taken is not offered again');
await page.click('#cancelPairingBtn');

console.log('M7 — an old record is last class\'s');
await page.evaluate(k => { const r = JSON.parse(localStorage.getItem(k)); r.data.at -= 3 * 60 * 60 * 1000; localStorage.setItem(k, JSON.stringify(r)); }, KEY);
await open();
const o1 = await pair();
await send(o1, { station: 0, id: 'aaaa', total: 3 });
await send(o1, { station: 1, id: 'bbbb', total: 3 });
eq((await stored()).teams.map(t => t.name), ['Team 1'], 'the first solve replaces a record three hours old, as before');

/* ── M7: re-pair in the same page session ──────────────────────────────── */
console.log('M7 — a team paired again in the same session is its first device');
await page.evaluate(k => localStorage.removeItem(k), KEY);
await open();
const r1 = await pair();
await send(r1, { station: 0, id: 'aaaa', total: 3 });
await send(r1, { station: 1, id: 'bbbb', total: 3 });
await page.fill('#rosterBody input.team-name[data-device="1"]', 'Owls');
const r2 = await pair('d:1');   // the phone reloaded; its old channel has not noticed yet
eq(await devices(), [{ id: 1, station: 1, total: 3, connected: true }], 'it is the first device, on the new connection');
eq(await rows('#rosterBody'), 1, 'one roster row');
eq(await rows('#boardBody'), 1, 'one leaderboard row');
eq(await page.inputValue('#rosterBody input.team-name[data-device="1"]'), 'Owls', 'with its name');
await drop(r1);   // the old channel closes late
eq((await devices())[0].connected, true, 'the old channel closing does not mark it disconnected');
await send(r1, { station: 0, id: 'aaaa', total: 3 });
eq((await devices())[0].station, 1, 'and a message on the old channel is not heard');
await send(r2, { station: 2, id: 'cccc', total: 3 });
rec = await stored();
eq(rec.teams.length, 1, 'one sheet in the record');
eq(rec.teams[0].name, 'Owls', 'under the name typed for the first device');
eq(Object.keys(rec.teams[0].marks), ['aaaa', 'bbbb'], 'with both solves');
await drop(r2);
eq((await devices())[0].connected, false, 'its current channel closing does mark it disconnected');
await page.click('#addDeviceBtn');
await page.waitForFunction(() => document.getElementById('offerText').value === 'stand-in offer');
eq((await choices())[1], ['d:1', 'Owls (disconnected)'], 'a disconnected team is offered first, by its name');
await page.click('#cancelPairingBtn');
await pair();
eq((await devices()).length, 2, 'a new team is still a new row');

ok(page.__errs.length === 0, 'monitor: no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`monitor hostile + record: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
