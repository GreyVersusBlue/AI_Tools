// smoke-station-names.mjs — a room's station names (Path 18 P4 leftover).
//
//   node Tools/escape-room-builder/test/smoke-station-names.mjs      (or: npm run test:er-station-names)
//
// A station may carry a name the teacher types in 019 ("The library"); it is for the debrief sheet and
// nothing else. What is asserted:
//   1. The builder shows a saved name in its box, and typing one saves it with the room, on a field of the
//      station's own record (no new storage key).
//   2. A room saved before names (no label anywhere) opens with the box empty and saves with no label field.
//   3. The student link, and the link of one station, carry no name: decoded, and as lock.html draws them
//      (the whole page's text and markup, and everything lock.html puts in storage) the name is nowhere.
//   4. The teacher monitor's debrief sheet prints the name beside the station's number, in the path and in
//      "Still open", and "Station n" alone for an unnamed one.
// No console errors. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8676;
const BASE = `http://127.0.0.1:${PORT}`;
const BUILDER = BASE + '/Tools/019-escape-room-builder.html';
const MONITOR = BASE + '/Tools/escape-room-builder/monitor.html';
const ROOMS = 'escape-room-builder:rooms', REC = 'escape-room-builder:monitor-record';
const NAME = 'Zzq Reading Nook', NAME2 = 'Zzq Boiler Room';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const st = (o) => Object.assign({ clue: '', answers: '', hint: '', next: null, image: '', type: 'text', hintCost: 0, awardLetter: '',
  cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null }, o);
const room = (name, stations) => ({ name, roomId: 'r-' + name.replace(/\W/g, ''), cardsPerPage: '4', ecLevel: 'Q', showNumber: true, randomizeStart: false,
  countdownEnabled: false, countdownMinutes: 20, storyIntro: '', packetCardsPerPage: '2', stations });
const OLD = room('Old room', [st({ id: 'aaaa', clue: 'First clue', answers: 'one' }), st({ id: 'bbbb', clue: 'Second clue', answers: 'two' })]);
const NAMED = room('Named room', [st({ id: 'cccc', clue: 'Clue A', answers: 'a', next: 2 }), st({ id: 'dddd', clue: 'Clue B', answers: 'b', label: NAME }),
  st({ id: 'eeee', clue: 'Clue C', answers: 'c', label: NAME2 })]);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
const seed = (rooms, current, extra) => page.evaluate(([rk, rooms, current, ek, ev]) => {
  localStorage.clear();
  localStorage.setItem(rk, JSON.stringify({ v: 1, data: { current, sets: rooms } }));
  if (ek) localStorage.setItem(ek, JSON.stringify({ v: 1, data: ev }));
}, [ROOMS, rooms, current, extra && extra[0], extra && extra[1]]);
const open = async (url, rooms, current, extra) => { await page.goto(url, { waitUntil: 'load' }); await seed(rooms, current, extra); await page.reload({ waitUntil: 'load' }); await settle(page, 400); };
const savedRoom = (n) => page.evaluate(([k, n]) => JSON.parse(localStorage.getItem(k)).data.sets[n], [ROOMS, n]);
const labels = () => page.$$eval('#stationsList .f-label', is => is.map(i => i.value));

console.log('019 builder — a saved name shows, a typed one saves');
await open(BUILDER, { [NAMED.name]: NAMED }, NAMED.name);
eq(await labels(), ['', NAME, NAME2], 'the boxes hold the saved names');
await page.locator('#stationsList .f-label').first().fill('Zzq Front Door');
await settle(page, 600);
eq((await savedRoom(NAMED.name)).stations.map(s => s.label), ['Zzq Front Door', NAME, NAME2], 'a typed name is saved on the station, in the room\'s own record');
ok(await page.locator('#stationsList .f-label').first().evaluate(i => i.getAttribute('aria-label') === 'Name for station 1'), 'the box is labelled for a screen reader');
await page.locator('#stationsList .f-label').nth(1).fill('');
await settle(page, 600);
ok(!('label' in (await savedRoom(NAMED.name)).stations[1]), 'clearing a name removes the field');

console.log('019 builder — a room saved before names');
await open(BUILDER, { [OLD.name]: OLD }, OLD.name);
eq(await labels(), ['', ''], 'the boxes are empty');
await page.locator('#stationsList .f-clue').first().fill('First clue, edited');
await settle(page, 600);
ok(!JSON.stringify(await savedRoom(OLD.name)).includes('"label"'), 'and saving it writes no label field');

console.log('lock.html — the name is never a student\'s');
await open(BUILDER, { [NAMED.name]: NAMED }, NAMED.name);
const link = await page.inputValue('#playerLink');
ok(link.includes('lock.html?r='), 'the builder shows the student link');
const payload = (u) => Buffer.from(new URL(u).searchParams.get('r'), 'base64').toString('utf8');
ok(!payload(link).includes('Zzq') && !payload(link).includes('label'), 'the link decodes to no name');
const student = await browser.newPage();
const errs = []; student.on('pageerror', e => errs.push(String(e)));
const reqs = []; student.on('request', r => reqs.push(r.url()));
for (const [what, u] of [['the whole room', link], ['station 2\'s code', link.replace(/&?s=\d+/, '') + '&s=1'], ['station 3\'s code', link.replace(/&?s=\d+/, '') + '&s=2']]) {
  await student.goto(u, { waitUntil: 'load' }); await settle(student, 300);
  const seen = await student.evaluate(() => document.documentElement.outerHTML + '\n' + JSON.stringify(Object.assign({}, localStorage)) + '\n' + JSON.stringify(Object.assign({}, sessionStorage)));
  ok(!seen.includes('Zzq'), `${what}: no name in lock.html's page, its markup or its storage`);
  ok(!reqs.some(r => r.includes('Zzq') && !r.includes('lock.html?r=')), `${what}: and none in a request`);
}
ok(errs.length === 0, 'lock.html: no page errors' + errs.join(' | '));
await student.close();

console.log('teacher monitor — the debrief names stations');
const T0 = Date.UTC(2026, 9, 28, 14, 0, 0);
const rec = { v: 1, at: T0 + 3600000, raceStartAt: T0, teams: [
  { name: 'Owls', code: '', marks: { cccc: { at: T0 + 60000 }, eeee: { at: T0 + 180000 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 },
  { name: 'Hawks', code: '', marks: { cccc: { at: T0 + 90000 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }] };
await page.addInitScript(() => { window.print = () => {}; });
await open(MONITOR, { [NAMED.name]: NAMED }, NAMED.name, [REC, rec]);
await page.locator('#printDebriefBtn').click(); await settle(page, 300);
const cards = await page.evaluate(() => [...document.querySelectorAll('#printDebriefGrid .p-card')].map(c => ({
  rows: [...c.querySelectorAll('table.p-debrief tbody tr')].map(r => [...r.children].map(x => x.textContent)),
  open: [...c.querySelectorAll('.p-debrief-open')].map(x => x.textContent) })));
eq(cards[0].rows.map(r => r[1]), ['Station 1', 'Station 3 — ' + NAME2], 'the path: an unnamed station is its number, a named one has its name beside it');
// "Sent on to" is empty here by design: the monitor's record keeps no branch, and the shared sheet names that station from stations.js's debrief (held in stations.test.mjs)
ok(cards[2].open.some(t => t.includes('Still open: Station 2 — ' + NAME + ', Station 3 — ' + NAME2 + '.')), 'Still open names them: ' + cards[2].open.join(' | '));
const sent = await page.evaluate((nm) => {   // a branch is not kept by the monitor, so 018's shape is fed in directly: "Sent on to" names its target too
  const d = (sentTo) => ({ name: 'T', reached: 1, total: 3, requiredTotal: 3, requiredDone: 1, totalMs: 1000, misses: 0, hints: 0, penaltyMs: 0, unreached: [],
    path: [{ order: 1, n: 0, label: 'Station 1', sinceStartMs: 1, legMs: 1, misses: 0, hint: null, sentTo }] });
  const host = document.createElement('div'); document.body.appendChild(host);
  window.StationsDebrief.render(host, [d({ n: 2, label: nm }), d({ n: 1, label: 'Station 2' }), d({ end: true })], { grid: { cols: 1, perPage: 1 } });
  const out = [...host.querySelectorAll('table.p-debrief tbody tr')].map(r => r.lastElementChild.textContent); host.remove(); return out;
}, NAME2);
eq(sent, ['Station 3 \u2014 ' + NAME2, 'Station 2', 'The end'], 'Sent on to names its target, and says only the number for an unnamed one');
ok(cards[0].rows.map(r => r[1]).every(t => !/undefined|null/.test(t)), 'no stray undefined');

ok(page.__errs.length === 0, 'no console errors' + (page.__errs.length ? ': ' + page.__errs.join(' | ') : ''));
await browser.close(); server.close();
console.log(`station names: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
