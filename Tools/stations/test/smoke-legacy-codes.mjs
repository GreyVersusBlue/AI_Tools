// smoke-legacy-codes.mjs — the player reads every code ever printed, and keys progress by id (Path 18 P2).
//
//   node Tools/stations/test/smoke-legacy-codes.mjs      (or: npm run test:stations-legacy)
//
// lock.html now decodes through Stations.playRead(). A v2 code carries the playable stations'
// ids and progress is saved keyed by them; a v1 code (a whole room from before #320, or a #320
// station code) has no ids and keeps the index keys it always had. Cases (the design's C1-C3,
// G1, G2 and R4):
//   C1/C2  a v1 code plays and saves progress keyed by index, no `by`
//   C3     a v2 code plays and saves progress keyed by id (`by: 'id'`, `current` an id)
//   G1     progress saved with index keys, opened by a v2 code: played on, saved again keyed by id
//   G2     progress already keyed by id, opened by a v1 code: the generic sentence, nothing advances,
//          nothing is rewritten
//   R4     "End here" ends the room in a v2 code; a v1 code (which cannot say it) goes to the next station
//   a moved/reprinted room: the same progress resumes at the same station when the ids are the same
//   019: moving a station keeps its go-to link (the link follows the station, not the position)
//   018: moving a station keeps its check-ins (marks follow the station's id)
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8569;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
page.on('dialog', d => d.accept());

const ROOM = { name: 'Legacy room', roomId: 'legacyroom1', stations: [
  { id: 'aaaa', clue: 'First clue', answers: 'alpha', hint: '', next: null },
  { id: 'bbbb', clue: 'Second clue', answers: 'beta', hint: '', next: 'end' },
  { id: 'cccc', clue: 'Third clue', answers: 'gamma', hint: '', next: null },
], cardsPerPage: '4', ecLevel: 'Q', showNumber: true };
const KEY = 'escape-room-progress:legacyroom1';

// a code's URL path, built in the page with the module itself; v1 drops v and ids (what #320 printed)
async function codeFor(kind, n) {
  await page.goto(BASE + '/Tools/escape-room-builder/lock.html', { waitUntil: 'load' });
  return page.evaluate(([room, kind, n]) => {
    const set = Stations.read(JSON.parse(JSON.stringify(room)));
    const url = Stations.playUrl(set, n, { base: location.origin + '/Tools/019-escape-room-builder.html' });
    const u = new URL(url);
    let r = JSON.parse(decodeURIComponent(escape(atob(u.searchParams.get('r')))));
    if (kind === 'v1') { delete r.v; delete r.ids; r.stations.forEach(st => { if (st.next === 'end') st.next = null; }); }   // what #320 printed: no version, no ids, no 'end'
    u.searchParams.set('r', btoa(unescape(encodeURIComponent(JSON.stringify(r)))));
    return { path: u.pathname + u.search, ids: r.ids || null };
  }, [ROOM, kind, n]);
}
const open = async (path, progress) => {
  await page.goto(BASE + '/Tools/escape-room-builder/lock.html', { waitUntil: 'load' });
  await page.evaluate(([k, p]) => { localStorage.clear(); if (p) localStorage.setItem(k, JSON.stringify(p)); }, [KEY, progress]);
  await page.goto(BASE + path, { waitUntil: 'load' }); await settle(page, 300);
};
const answer = async (text) => { await page.fill('#answerInput', text); await page.click('#answerForm button[type=submit]'); await settle(page, 900); };
const saved = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const text = () => page.evaluate(() => document.getElementById('card').innerText);

console.log('C3 — a v2 code keys progress by id');
let v2 = await codeFor('v2', null);
ok(!!v2.path, 'v2 code built');
const ids = await page.evaluate((room) => Stations.playable(Stations.read(JSON.parse(JSON.stringify(room)))).map(s => s.id), ROOM);
await open(v2.path, null);
ok((await text()).includes('First clue'), 'C3: the first clue shows');
await answer('alpha');
let p = await saved();
eq(p.by, 'id', 'C3: progress is marked as id-keyed');
ok(typeof p.current === 'string' && p.current.length === 4, 'C3: current is a station id (' + p.current + ')');
ok(Object.keys(p.solved).length === 1 && Object.keys(p.solved).every(k => /^[a-z0-9]{4}$/.test(k)), 'C3: solved is keyed by id');
ok((await text()).includes('Second clue'), 'C3: the second clue shows');

console.log("R4 — 'End here' ends the room in a v2 code");
await answer('beta');
ok((await text()).includes('escaped'), "R4: station 2 is set to End here, so the room is done (third clue never shown)");
eq((await saved()).current, 'done', "R4: current is 'done'");

console.log('C1/C2 — a v1 code keeps index keys');
const v1 = await codeFor('v1', null);
await open(v1.path, null);
await answer('alpha');
p = await saved();
eq(p.by, undefined, 'C1: a v1 code writes no `by`');
eq(p.current, 1, 'C1: current is an index');
eq(Object.keys(p.solved), ['0'], 'C1: solved is keyed by index');
await answer('beta');
ok((await text()).includes('Third clue'), "R4: a v1 code cannot say 'end': it goes on to the next station");
const v1station = await codeFor('v1', 1);
await open(v1station.path, null);
ok((await text()).length > 0, 'C2: a #320 station code opens');

console.log('G1 — index-keyed progress opened by a v2 code is upgraded');
await open(v2.path, { current: 1, misses: {}, solved: { 0: true }, hintsUsed: {}, letters: {}, lockUntil: {} });
ok((await text()).includes('Second clue'), 'G1: the old progress puts the player on station 2');
await answer('wrong'); 
p = await saved();
eq(p.by, 'id', 'G1: saved again, id-keyed');
eq(p.current, ids[1], 'G1: current is the id of station 2');
eq(Object.keys(p.solved), [ids[0]], 'G1: station 1 is solved under its id');
eq(Object.keys(p.misses), [ids[1]], 'G1: the miss is under station 2\'s id');

console.log('G2 — id-keyed progress opened by a v1 code');
const g2 = { by: 'id', current: ids[1], misses: {}, solved: { [ids[0]]: true }, hintsUsed: {}, letters: {}, lockUntil: {} };
await open(v1.path, g2);
ok((await text()).includes('another station'), 'G2: the generic sentence shows');
eq(await saved(), g2, 'G2: nothing was rewritten');

console.log('resume — the same ids, a different order: the same station');
await open(v2.path, { by: 'id', current: ids[2], misses: {}, solved: { [ids[0]]: true, [ids[1]]: true }, hintsUsed: {}, letters: {}, lockUntil: {} });
ok((await text()).includes('Third clue'), 'a phone with an id-keyed current resumes on that station');

console.log('019 — moving a station keeps its go-to link');
await page.goto(BASE + '/Tools/019-escape-room-builder.html', { waitUntil: 'load' });
await page.evaluate(([room]) => {
  const r = JSON.parse(JSON.stringify(room)); r.stations[0].next = 2; r.stations[1].next = null;
  const store = { current: r.name, sets: { [r.name]: r } };
  localStorage.setItem('escape-room-builder:rooms', JSON.stringify({ v: 1, data: store }));
}, [ROOM]);
await page.goto(BASE + '/Tools/019-escape-room-builder.html', { waitUntil: 'load' }); await settle(page, 600);
const rd = () => page.evaluate(() => { const v = JSON.parse(localStorage.getItem('escape-room-builder:rooms')); const d = v.data || v; const r = d.sets['Legacy room']; return r.stations.map(s => ({ clue: s.clue, next: (typeof s.next === 'string' && s.next !== 'end') ? r.stations.findIndex(t => t.id === s.next) : s.next })); });   // v385: a go-to is stored as an id; read it back as a position
eq((await rd()).map(s => s.next), [2, null, null], '019: before the move, station 1 goes to station 3');
await page.click('#stationsList .station-card[data-idx="1"] [data-move="-1"]'); await settle(page, 500);
const after = await rd();
eq(after.map(s => s.clue), ['Second clue', 'First clue', 'Third clue'], '019: stations 1 and 2 swapped');
eq(after.map(s => s.next), [null, 2, null], "019: 'First clue' still goes to 'Third clue'");
await page.click('#stationsList .station-card[data-idx="2"] [data-remove]'); await settle(page, 500);
eq((await rd()).map(s => s.next), [null, null], '019: deleting the target clears the link');

console.log('018 — moving a station keeps its check-ins');
await page.goto(BASE + '/Tools/018-qr-scavenger-hunt-builder.html', { waitUntil: 'load' });
await page.evaluate(() => {
  const st = (c) => ({ label: '', content: c, note: '', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '' });
  const h = { name: 'Move hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true, stations: [st('https://a.example'), st('https://b.example'), st('https://c.example')],
    run: { teams: [{ name: 'T', code: 'ABCD', marks: { 1: { at: 5, correct: true } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }], timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 1 } };
  localStorage.setItem('qr-scavenger-hunt-sets', JSON.stringify({ current: h.name, sets: { [h.name]: h } }));
});
await page.goto(BASE + '/Tools/018-qr-scavenger-hunt-builder.html', { waitUntil: 'load' }); await settle(page, 600);
const hunt = () => page.evaluate(() => { const h = JSON.parse(localStorage.getItem('qr-scavenger-hunt-sets')).sets['Move hunt']; return { ids: h.stations.map(s => s.id), contents: h.stations.map(s => s.content), marks: Object.keys(h.run.teams[0].marks), ci: h.run.checkinStation }; });
let h = await hunt();
eq(h.marks, [h.ids[1]], '018: the old index-1 mark is keyed by station 2\'s id');
eq(h.ci, h.ids[1], '018: the check-in station is station 2\'s id');
await page.click('#stations-body tr[data-idx="1"] [data-move="-1"]'); await settle(page, 500);
const h2 = await hunt();
eq(h2.contents[0], 'https://b.example', '018: station 2 moved to the top');
eq(h2.marks, [h.ids[1]], '018: its check-in moved with it (still on the same id)');
eq(h2.ci, h.ids[1], '018: the helper stays on the same station');

console.log('019 — the payload budget refuses a code too dense to scan');
await page.goto(BASE + '/Tools/019-escape-room-builder.html', { waitUntil: 'load' });
await page.evaluate(([room]) => {
  const r = JSON.parse(JSON.stringify(room)); r.stations[1].clue = 'x'.repeat(700);
  localStorage.setItem('escape-room-builder:rooms', JSON.stringify({ v: 1, data: { current: r.name, sets: { [r.name]: r } } }));
}, [ROOM]);
await page.goto(BASE + '/Tools/019-escape-room-builder.html', { waitUntil: 'load' }); await settle(page, 800);
const msgText = await page.evaluate(() => document.getElementById('msg').textContent);
ok(/Station 2\u2019s code is \d+ bytes, \d+ modules across/.test(msgText) && /Shorten its clue/.test(msgText), '019: the message names station 2, its size and what to shorten (' + msgText.slice(0, 80) + ')');
ok(await page.evaluate(() => document.getElementById('printCodesBtn').disabled), '019: Print codes is disabled while a code is over budget');

await browser.close(); server.close();
console.log(`stations legacy codes: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
