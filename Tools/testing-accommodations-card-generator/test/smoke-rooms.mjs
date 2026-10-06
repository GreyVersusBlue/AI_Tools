// smoke-rooms.mjs — 077's room-assignment view: rooms and proctors, the route,
// hand moves and their warnings, and the proctor lists on paper.
//
//   node Tools/testing-accommodations-card-generator/test/smoke-rooms.mjs
//
// Which room a student may go to is rooms.js's (smoke-rooms-core.mjs pins it in
// pure Node). This drives the page: that a save from before loads and is written
// back as it was, that the editor saves the shape it should, that the route says
// plainly who it could not place and why, that a hand move to a room that lacks
// something is kept and warned about, that the proctor list of a room has that
// room's students and nobody else's and paginates, that the preview agrees with
// Chromium's PDF, and that no room, proctor or placement goes into a share link.
// print() is stubbed. Every name is invented. Nothing here has been printed.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8504;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/077-testing-accommodations-card-generator.html';
const KEY = 'tacg_cards_v1';
const SCRATCH = path.join(os.homedir(), '.cache', 'selector-scratch', 'AI-31-077');
fs.mkdirSync(SCRATCH, { recursive: true });

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const TYPES = [['x1', 'Extended time'], ['x2', 'Separate setting'], ['x3', 'Read-aloud'], ['x4', 'Breaks as needed']].map(([id, name]) => ({ id, name }));
const ROSTER = ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz', 'Nadia Okonjo', 'Zheng He', 'Imani Clarke'];
const TICKS = { 'Ada Lovelace': ['x1'], 'Beckett Hale': ['x1', 'x3'], 'Marisol Ruiz': ['x2'], 'Nadia Okonjo': ['x3'], 'Zheng He': ['x4'] };
const assignmentsOf = ticks => { const a = {}; Object.keys(ticks).forEach(n => ticks[n].forEach(t => { a[n + '|' + t] = true; })); return a; };
const base = (extra = {}) => ({ roster: ROSTER, types: TYPES, assignments: assignmentsOf(TICKS), notes: { 'Beckett Hale': 'Reader may repeat items' }, ...extra });
const ROOMS = [
  { id: 'r1', name: 'Room 101', capacity: 2, proctor: 'Ms. Reyes', provides: ['x1', 'x2'] },
  { id: 'r2', name: 'Library', capacity: 2, proctor: 'Mr. Osei', provides: ['x1', 'x3'] },
  { id: 'r3', name: 'Annex', capacity: 1, proctor: '', provides: ['x2'] },
];
const withRooms = (extra = {}) => base({ rooms: ROOMS, ...extra });

const server = await serve(PORT);
const browser = await launch();

/** Opens the page with `state` saved (or nothing); records dialogs; print() counted. */
async function open(state, { dark = false, raw = null } = {}) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });
  page.__dialogs = []; page.__answer = true;
  page.on('dialog', d => { page.__dialogs.push({ type: d.type(), message: d.message() }); (page.__answer ? d.accept() : d.dismiss()); });
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  await page.addInitScript(([key, saved, isDark]) => {
    window.__printCalls = 0; window.print = () => { window.__printCalls++; };
    if (saved && !sessionStorage.getItem('seeded')) { localStorage.setItem(key, saved); sessionStorage.setItem('seeded', '1'); }
    if (isDark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [KEY, raw != null ? raw : state ? JSON.stringify(state) : null, dark]);
  await page.goto(PAGE, { waitUntil: 'load' });
  await settle(page, 250);
  return page;
}
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const text = (page, sel) => page.evaluate(s => document.querySelector(s).innerText.replace(/\s+/g, ' ').trim(), sel);
const placedOf = async page => (await stored(page)).roomOf || {};
const pick = async (page, name, roomLabel) => { await page.selectOption(`select[data-room-pick="${name}"]`, { label: roomLabel }); await settle(page, 120); };
const roomOption = async (page, name) => page.$$eval(`select[data-room-pick="${name}"] option`, o => o.map(x => x.textContent));

console.log('077 — rooms, proctors and the route');

/* ---- 1. a save from before: loaded, written back as it was ------------------ */
{
  const raw = JSON.stringify(base());
  const page = await open(null, { raw });
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), raw, 'a save from before is not rewritten by loading the page');
  eq(await page.evaluate(() => document.querySelectorAll('[data-room]').length), 0, 'no rooms');
  ok(/No rooms yet/.test(await text(page, '#roomsWrap')), 'the editor says there are no rooms');
  await page.click('#routeAllBtn');
  ok(/Add a room first/.test(await text(page, '#routeStatus')), 'routing with no rooms says to add one');
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), raw, 'and still does not write');
  await page.check('input[data-student="Imani Clarke"][data-type-check="x1"]');
  await settle(page, 100);
  const s = await stored(page);
  ok(!('rooms' in s) && !('roomOf' in s), 'ticking a box with no rooms adds neither a rooms nor a roomOf field');
  same(Object.keys(s).sort(), ['assignments', 'notes', 'roster', 'types'], 'the document keeps the shape it had');
  eq(await page.evaluate(() => document.querySelectorAll('select[data-room-pick]').length), 6, 'the grid lists the students who have an accommodation (Imani now too)');
  ok(/Not placed/.test(await text(page, '#roomTable')), 'they are not placed');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 2. the editor ---------------------------------------------------------- */
{
  const page = await open(base());
  await page.click('#addRoomBtn');
  await page.click('#addRoomBtn');
  let s = await stored(page);
  eq(s.rooms.length, 2, 'two rooms saved');
  same([s.rooms[0].name, s.rooms[0].capacity, s.rooms[0].proctor, s.rooms[0].provides], ['Room 1', 10, '', []], 'a new room: name, ten seats, no proctor, provides nothing');
  eq(await page.evaluate(() => document.activeElement.getAttribute('data-room-field')), 'name', 'focus lands on the new room\'s name');
  eq(s.rooms[0].id === s.rooms[1].id, false, 'room ids differ');
  const first = '[data-room]:nth-of-type(1)';
  await page.fill(`${first} input[data-room-field="name"]`, 'Room 101');
  await page.fill(`${first} input[data-room-field="capacity"]`, '7');
  await page.fill(`${first} input[data-room-field="proctor"]`, 'Ms. Reyes');
  await page.check(`${first} input[data-room-type="x1"]`);
  await page.check(`${first} input[data-room-type="x3"]`);
  s = await stored(page);
  same([s.rooms[0].name, s.rooms[0].capacity, s.rooms[0].proctor], ['Room 101', 7, 'Ms. Reyes'], 'name, seats and proctor are saved as typed');
  same([...s.rooms[0].provides].sort(), ['x1', 'x3'], 'what the room provides is the types\' ids');
  await page.uncheck(`${first} input[data-room-type="x1"]`);
  same((await stored(page)).rooms[0].provides, ['x3'], 'unticking removes it');
  await page.fill(`${first} input[data-room-field="capacity"]`, '');
  eq((await stored(page)).rooms[0].capacity, 0, 'a blank seat count is saved as 0, not an empty string');
  eq(await page.evaluate(() => document.activeElement.getAttribute('data-room-field')), 'capacity', 'typing in a room field keeps the focus there');
  same(await page.$$eval('[data-room] input[data-room-type="x1"] + span', e => e.map(x => x.textContent)), ['Extended time', 'Extended time'], 'the room\'s checklist uses the tool\'s own accommodation names');
  const groups = await page.$$eval('[data-room]', e => e.map(x => [x.getAttribute('role'), document.getElementById(x.getAttribute('aria-labelledby')).value]));
  same(groups, [['group', 'Room 101'], ['group', 'Room 2']], 'each room is a group named by its own name field');
  // renaming a type follows into the rooms; deleting one removes its checkbox
  await page.fill('#typesWrap input[data-type="x1"]', 'Extra time');
  eq(await page.$eval('[data-room] input[data-room-type="x1"] + span', e => e.textContent), 'Extra time', 'a renamed accommodation is renamed in the room checklist');
  await page.click('button[data-del-type="x2"]');
  eq(await page.evaluate(() => document.querySelectorAll('[data-room] input[data-room-type="x2"]').length), 0, 'a deleted accommodation leaves the room checklist');
  await page.click('#addTypeBtn');
  eq(await page.evaluate(() => document.querySelectorAll('[data-room]:first-of-type input[data-room-type]').length), 4, 'a new accommodation appears in each room');
  // delete the second room: nobody placed, no confirm
  page.__dialogs.length = 0;
  await page.click('[data-room]:nth-of-type(2) button[data-del-room]');
  eq(page.__dialogs.length, 0, 'deleting an empty room asks nothing');
  eq((await stored(page)).rooms.length, 1, 'and removes it');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 3. the route ------------------------------------------------------------ */
{
  const page = await open(withRooms());
  await page.click('#routeAllBtn');
  await settle(page, 150);
  const placed = await placedOf(page);
  same(Object.fromEntries(Object.keys(placed).sort().map(k => [k, placed[k]])), { 'Ada Lovelace': 'r1', 'Beckett Hale': 'r2', 'Marisol Ruiz': 'r3', 'Nadia Okonjo': 'r2' }, 'each student is in a room that provides all they have; the fewest-extras room first');
  const status = await text(page, '#routeStatus');
  ok(status.startsWith('Placed 4 of 5 students who have accommodations.'), 'the status counts the placed: ' + status);
  ok(/1 student was not placed:/.test(status) && /Zheng He \(Breaks as needed\): no room provides Breaks as needed\./.test(status), 'the one left over is named with the reason: ' + status);
  same(await page.$$eval('#roomGlance li', e => e.map(x => x.textContent)), [
    'Room 101 — proctor Ms. Reyes — 1 of 2 seats', 'Library — proctor Mr. Osei — 2 of 2 seats', 'Annex — no proctor yet — 1 of 1 seat'], 'rooms at a glance: proctor and seats used');
  eq(await text(page, '#routeSummary'), '4 of 5 students who have accommodations are in a room.', 'the summary counts');
  same(await page.$$eval('select[data-room-pick]', e => e.map(x => [x.getAttribute('data-room-pick'), x.selectedOptions[0].textContent])), [
    ['Ada Lovelace', 'Room 101 (1 of 2)'], ['Beckett Hale', 'Library (2 of 2)'], ['Marisol Ruiz', 'Annex (1 of 1)'], ['Nadia Okonjo', 'Library (2 of 2)'], ['Zheng He', 'Not placed']], 'the grid shows each student\'s room');
  same(await roomOption(page, 'Zheng He'), ['Not placed', 'Room 101 (1 of 2)', 'Library (2 of 2)', 'Annex (1 of 1)'], 'every room is a choice, with its count');
  ok(/Not placed: no room provides Breaks as needed\./.test(await text(page, 'tr[data-room-student="Zheng He"]')), 'the unplaced row says why');
  eq(await text(page, 'tr[data-room-student="Ada Lovelace"] td:last-child'), 'OK', 'a good placement says OK');
  ok(!('Imani Clarke' in placed), 'a student with no accommodation is not placed');
  ok(!(await page.$('tr[data-room-student="Imani Clarke"]')), 'and is not in the grid');
  // same input, same answer
  const again = JSON.stringify(placed);
  await page.click('#routeAllBtn');
  eq(page.__dialogs.slice(-1)[0].type, 'confirm', 'routing again asks first');
  ok(/replaces the 4 placements you have now/.test(page.__dialogs.slice(-1)[0].message), 'and says how many it replaces: ' + page.__dialogs.slice(-1)[0].message);
  eq(JSON.stringify(await placedOf(page)), again, 'a second route gives the same placements');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 3b. the other reasons ---------------------------------------------------- */
{
  // no single room has both of Beckett's
  let page = await open(base({ rooms: [ROOMS[0], { id: 'r4', name: 'Library', capacity: 2, proctor: '', provides: ['x3'] }] }));
  await page.click('#routeAllBtn');
  let status = await text(page, '#routeStatus');
  ok(/Beckett Hale \(Extended time and Read-aloud\): no single room provides all of Extended time and Read-aloud together\./.test(status), 'a combination no room has: ' + status);
  ok(/Nadia Okonjo/.test(await text(page, '#roomGlance')) === false, 'the glance does not list students');
  ok(/Not placed: no single room provides all of them\./.test(await text(page, 'tr[data-room-student="Beckett Hale"]')), 'the row says the same');
  await page.close();
  // two students who need the one separate-setting seat
  page = await open(base({ roster: ['Ada Lovelace', 'Marisol Ruiz', 'Zheng He'], assignments: assignmentsOf({ 'Ada Lovelace': ['x2'], 'Marisol Ruiz': ['x2'] }), rooms: [ROOMS[2]] }));
  await page.click('#routeAllBtn');
  status = await text(page, '#routeStatus');
  same(await placedOf(page), { 'Ada Lovelace': 'r3' }, 'the one seat goes to the first');
  ok(/Marisol Ruiz \(Separate setting\): the rooms that provide all of them are full: Annex\./.test(status), 'the other is told the room is full: ' + status);
  // nobody has an accommodation
  await page.close();
  page = await open(base({ assignments: {}, rooms: ROOMS }));
  await page.click('#routeAllBtn');
  ok(/No student has an accommodation ticked yet/.test(await text(page, '#routeStatus')), 'routing a class with nothing ticked says so');
  await page.close();
}

/* ---- 4. a hand move, its warnings, and what a second route keeps ---------------- */
{
  const page = await open(withRooms());
  await page.click('#routeAllBtn');
  await pick(page, 'Nadia Okonjo', 'Room 101 (1 of 2)');
  eq((await placedOf(page))['Nadia Okonjo'], 'r1', 'the move is kept although Room 101 lacks read-aloud');
  let status = await text(page, '#routeStatus');
  ok(/Warning: Nadia Okonjo is now in Room 101, which does not provide Read-aloud\./.test(status), 'the status warns: ' + status);
  ok(/Warning: Room 101 does not provide Read-aloud\./.test(await text(page, 'tr[data-room-student="Nadia Okonjo"]')), 'and so does her row');
  eq(await page.evaluate(() => document.activeElement.getAttribute('data-room-pick')), 'Nadia Okonjo', 'the focus stays on the select that was changed');
  await pick(page, 'Ada Lovelace', 'Annex (1 of 1)');
  status = await text(page, '#routeStatus');
  ok(/Annex is over capacity \(2 students, 1 seat\)/.test(status), 'a move into a full room warns it is over: ' + status);
  ok(/Annex — no proctor yet — 2 of 1 seat — over capacity by 1/.test(await text(page, '#roomGlance')), 'the glance says over capacity');
  await pick(page, 'Ada Lovelace', 'Not placed');
  ok(/Ada Lovelace is not placed/.test(await text(page, '#routeStatus')), 'moving to Not placed says so');
  ok(!('Ada Lovelace' in (await placedOf(page))), 'and removes the placement');
  // a reload keeps it all, warning included
  await page.reload({ waitUntil: 'load' });
  await settle(page, 250);
  eq((await placedOf(page))['Nadia Okonjo'], 'r1', 'the placements survive a reload');
  ok(/Warning: Room 101 does not provide Read-aloud\./.test(await text(page, 'tr[data-room-student="Nadia Okonjo"]')), 'and so does the warning');
  // route only the unplaced: keeps Nadia where she is, places Ada
  page.__dialogs.length = 0;
  await page.click('#routeRestBtn');
  eq(page.__dialogs.length, 0, 'routing only the unplaced asks nothing');
  const after = await placedOf(page);
  eq(after['Nadia Okonjo'], 'r1', 'the hand move is left alone');
  ok(after['Ada Lovelace'] === 'r1' || after['Ada Lovelace'] === 'r2', 'Ada is placed in a room with space that provides extended time (' + after['Ada Lovelace'] + ')');
  // route all, then say no
  page.__answer = false;
  await page.click('#routeAllBtn');
  eq((await placedOf(page))['Nadia Okonjo'], 'r1', 'saying no to Route all changes nothing');
  page.__answer = true;
  await page.click('#routeAllBtn');
  eq((await placedOf(page))['Nadia Okonjo'], 'r2', 'saying yes starts over: Nadia goes to the Library');
  // clear
  page.__dialogs.length = 0;
  await page.click('#clearRoomsBtn');
  ok(/Clear all 4 placements\?/.test(page.__dialogs[0].message), 'clearing asks with the count: ' + page.__dialogs[0].message);
  same(await placedOf(page), {}, 'and clears');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 5. deleting a room that holds students --------------------------------------- */
{
  const page = await open(withRooms());
  await page.click('#routeAllBtn');
  page.__answer = false; page.__dialogs.length = 0;
  await page.click('[data-room="r2"] button[data-del-room]');
  ok(/Delete Library\? The 2 students placed there will be unplaced\./.test(page.__dialogs[0].message), 'asks first, naming the count: ' + page.__dialogs[0].message);
  eq((await stored(page)).rooms.length, 3, 'saying no keeps the room');
  page.__answer = true;
  await page.click('[data-room="r2"] button[data-del-room]');
  const s = await stored(page);
  same(s.rooms.map(r => r.id), ['r1', 'r3'], 'saying yes removes it');
  same(s.roomOf, { 'Ada Lovelace': 'r1', 'Marisol Ruiz': 'r3' }, 'and unplaces exactly the students who were in it');
  eq(await page.evaluate(() => document.activeElement.id), 'addRoomBtn', 'the focus goes to Add room');
  await page.close();
}

/* ---- 6. the proctor lists ------------------------------------------------------------ */
{
  const page = await open(withRooms());
  page.__answer = true;
  await page.click('#printRoomsBtn');
  ok(/no student is placed in a room yet/.test(page.__dialogs.slice(-1)[0].message), 'with nobody placed: says so (' + page.__dialogs.slice(-1)[0].message + ')');
  eq(await page.evaluate(() => window.__printCalls), 0, 'and does not print');
  await page.click('#routeAllBtn');
  await pick(page, 'Nadia Okonjo', 'Room 101 (1 of 2)');
  await page.click('#printRoomsBtn');
  await settle(page, 120);
  eq(await page.evaluate(() => window.__printCalls), 1, 'Print proctor lists calls print()');
  const sheets = await page.evaluate(() => [...document.querySelectorAll('#printArea > .proctor-sheet')].map(s => ({
    cls: s.className,
    h: s.querySelector('h2').textContent,
    meta: s.querySelector('.meta').textContent.replace(/\s+/g, ' '),
    rows: [...s.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent)),
    keep: [...s.querySelectorAll('tbody tr')].every(r => r.classList.contains('pk-keep')),
    tally: s.querySelector('.tally').textContent,
    head: [...s.querySelectorAll('thead th')].map(t => t.textContent),
    flag: [...s.querySelectorAll('.flag')].map(f => f.textContent),
  })));
  eq(sheets.length, 3, 'one sheet for each room that has students');
  ok(sheets.every(s => s.cls === 'proctor-sheet pk-page'), 'each is a kit page');
  same(sheets.map(s => s.h), ['Proctor list — Room 101', 'Proctor list — Library', 'Proctor list — Annex'], 'in room order');
  ok(/^Proctor: Ms\. Reyes/.test(sheets[0].meta) && /Students: 2 of 2 seats/.test(sheets[0].meta), 'the proctor and the count: ' + sheets[0].meta);
  ok(/^Proctor: _+/.test(sheets[2].meta), 'a room with no proctor has a write-in line');
  same(sheets[0].rows.map(r => r[0]), ['Ada Lovelace', 'Nadia Okonjo'], 'Room 101 lists its own two');
  same(sheets[1].rows.map(r => r[0]), ['Beckett Hale'], 'the Library lists Beckett only');
  same(sheets[2].rows.map(r => r[0]), ['Marisol Ruiz'], 'the Annex lists Marisol only');
  const all = JSON.stringify(sheets.map(s => s.rows.map(r => r[0])));
  ok(sheets.every((s, i) => s.rows.every(r => all.split(r[0]).length === 2)), 'no student is on two sheets');
  eq(sheets[1].rows[0][1], 'Extended time and Read-aloud', 'a student\'s accommodations are listed for the proctor');
  eq(sheets[1].rows[0][2], 'Reader may repeat items', 'with their note');
  same(sheets[0].flag, ['Not provided in this room: Read-aloud'], 'a student in a room that lacks something is flagged on that room\'s list');
  same(sheets[1].flag, [], 'and nobody else is');
  same(sheets[0].head, ['Student', 'Accommodations', 'Note', 'Present'], 'columns');
  ok(sheets.every(s => s.keep), 'every row is kept whole across a page break (.pk-keep)');
  eq(sheets[0].tally, 'Total: 2 students. Extended time × 1, Read-aloud × 1.', 'the total and the tally');
  eq(sheets[1].tally, 'Total: 1 student. Extended time × 1, Read-aloud × 1.', 'a total of one');
  // one room
  await page.selectOption('#printRoomSelect', 'r2');
  await page.click('#printRoomsBtn');
  same(await page.$$eval('#printArea > .proctor-sheet h2', e => e.map(x => x.textContent)), ['Proctor list — Library'], 'one room picked, one sheet');
  await page.selectOption('#printRoomSelect', 'r3');
  await pick(page, 'Marisol Ruiz', 'Not placed');
  page.__dialogs.length = 0;
  await page.click('#printRoomsBtn');
  ok(/no student is placed in that room yet/.test(page.__dialogs[0].message), 'a room with nobody says so');
  // the old cards still print, and replace the lists
  await page.click('#printBtn');
  eq(await page.evaluate(() => document.querySelectorAll('#printArea .accom-card').length + '/' + document.querySelectorAll('#printArea .proctor-sheet').length), '6/0', 'Print cards still prints the cards and replaces the lists');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 7. paper: the PDF, the preview and a long room ------------------------------------ */
{
  const NAMES = Array.from({ length: 46 }, (_, i) => `Pupil Number${String(i + 1).padStart(2, '0')}`);
  const long = base({
    roster: [...NAMES, 'Other Roomer'],
    assignments: assignmentsOf({ ...Object.fromEntries(NAMES.map(n => [n, ['x1', 'x2']])), 'Other Roomer': ['x3'] }),
    rooms: [{ id: 'big', name: 'Gym', capacity: 60, proctor: 'Coach Vale', provides: ['x1', 'x2'] }, { id: 'small', name: 'Reading Room', capacity: 4, proctor: 'Ms. Ng', provides: ['x3'] }],
    notes: {},
  });
  const page = await open(long);
  await page.click('#routeAllBtn');
  const placed = await placedOf(page);
  eq(Object.keys(placed).length, 47, 'all 47 are placed');
  // the long room alone
  await page.selectOption('#printRoomSelect', 'big');
  await page.click('#previewRoomsBtn');
  await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 30000 });
  await settle(page, 150);
  const previewPages = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
  eq(await page.evaluate(() => window.__printCalls), 0, 'Preview opens no print dialog');
  await page.keyboard.press('Escape');
  await settle(page, 100);
  eq(await page.evaluate(() => document.activeElement.id), 'previewRoomsBtn', 'Escape closes the preview and the focus is back on the button');
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  await page.emulateMedia({ media: null });
  const pdfPages = pdfPageCount(buf);
  ok(pdfPages >= 2, `a 46-student room runs over ${pdfPages} pages`);
  eq(previewPages, pdfPages, 'the preview\'s page count is Chromium\'s PDF');
  const f = path.join(SCRATCH, 'big.pdf'); fs.writeFileSync(f, buf);
  const txt = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' });
  const perPage = txt.split('\f').filter(s => s.trim());
  eq(perPage.length, pdfPages, 'pdftotext sees the same pages');
  ok(perPage.every(p => /Accommodations/.test(p)), 'the table head repeats on every page');
  eq((txt.match(/Pupil Number\d\d/g) || []).length, 46, 'every student is on a page exactly once');
  ok(!/Other Roomer/.test(txt), 'the other room\'s student is not on this room\'s list');
  ok(/Total: 46 students\./.test(txt) && /Extended time × 46/.test(txt), 'the total is at the end');
  // both rooms: one page-break between rooms, no other room's names on a page
  await page.selectOption('#printRoomSelect', '');
  await page.click('#previewRoomsBtn');
  await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 30000 });
  const both = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
  await page.click('.pk-preview-print');
  await settle(page, 200);
  eq(await page.evaluate(() => window.__printCalls), 1, 'the preview\'s Print button prints');
  await page.emulateMedia({ media: 'print' });
  const buf2 = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  await page.emulateMedia({ media: null });
  eq(both, pdfPageCount(buf2), 'two rooms: the preview and the PDF agree on ' + both);
  fs.writeFileSync(f, buf2);
  const pages2 = execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).split('\f').filter(s => s.trim());
  const roomPage = pages2.filter(p => /Reading Room/.test(p));
  eq(roomPage.length, 1, 'the small room has one page');
  ok(!/Pupil Number/.test(roomPage[0]) && /Other Roomer/.test(roomPage[0]), 'and it has only its own student');
  ok(pages2.filter(p => /Gym/.test(p)).every(p => !/Other Roomer/.test(p)), 'no Gym page has the other room\'s student');
  eq(page.__errors.length, 0, 'no page errors');
  await page.close();
}

/* ---- 8. nothing leaves the device ---------------------------------------------------------- */
{
  const link = async page => {
    await page.click('#shareBtn');
    await settle(page, 250);
    return page.evaluate(() => {
      let captured = null;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
      document.querySelector('.share-sheet button[data-share="copy"]').click();
      return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
    });
  };
  const a = await open(base());
  const b = await open(withRooms({ roomOf: { 'Ada Lovelace': 'r1', 'Beckett Hale': 'r2' } }));
  const la = await link(a), lb = await link(b);
  ok(typeof la === 'string' && la.length > 20, 'a share link is produced');
  eq(lb, la, 'the link is the same with rooms, proctors and placements saved as without: they are not in it');
  ok(!/Reyes|Osei|Room%20101|Library/.test(decodeURIComponent(lb)), 'no proctor or room name is in the link');
  await a.close(); await b.close();
}

/* ---- 9. a damaged save, and text that looks like markup ------------------------------------ */
{
  let page = await open(null, { raw: JSON.stringify({ ...base(), rooms: 'junk', roomOf: [1, 2] }) });
  eq(page.__errors.length, 0, 'a save whose rooms are a string and whose placements are a list loads without an error');
  eq(await page.evaluate(() => document.querySelectorAll('[data-room]').length), 0, 'and has no rooms');
  await page.click('#addRoomBtn');
  eq((await stored(page)).rooms.length, 1, 'a room can be added to it');
  await page.close();
  page = await open(null, { raw: JSON.stringify({ ...base(), rooms: [null, 5, { name: 'no id' }, ...ROOMS], roomOf: { 'Ada Lovelace': 'nowhere' } }) });
  eq(page.__errors.length, 0, 'rooms with junk in the list load without an error');
  eq(await page.evaluate(() => document.querySelectorAll('[data-room]').length), 3, 'only the real rooms are shown');
  eq(await page.$eval('select[data-room-pick="Ada Lovelace"]', e => e.value), '', 'a placement in a room that does not exist is Not placed');
  await page.close();
  const evil = '<img src=x onerror="window.__pwned=1"> Dr. <b>X</b>';
  page = await open(withRooms({ rooms: [{ ...ROOMS[0], proctor: evil, name: '<i>Room</i>' }, ROOMS[1], ROOMS[2]] }));
  await page.click('#routeAllBtn');
  await page.click('#printRoomsBtn');
  const probe = await page.evaluate(() => ({ pwned: window.__pwned || 0, imgs: document.querySelectorAll('img').length, glance: document.getElementById('roomGlance').textContent, sheet: document.querySelector('#printArea .proctor-sheet .meta').textContent, h: document.querySelector('#printArea .proctor-sheet h2').textContent }));
  eq(probe.pwned + probe.imgs, 0, 'a proctor or room name that looks like markup makes no element');
  ok(probe.glance.includes(evil) && probe.sheet.includes(evil), 'it shows as typed on the page and on the sheet');
  ok(probe.h.includes('<i>Room</i>'), 'a room name too');
  await page.close();
}

/* ---- 10. accessibility, light and dark, with rooms on screen ----------------------------------- */
for (const dark of [false, true]) {
  const page = await open(withRooms({ roomOf: { 'Ada Lovelace': 'r1', 'Nadia Okonjo': 'r1' } }), { dark });
  await page.click('#routeRestBtn');
  const bad = await a11yScan(page, { impact: 'serious' });
  same(bad, [], `axe finds nothing serious with rooms and the grid showing (${dark ? 'dark' : 'light'})`);
  ok(await page.evaluate(() => [...document.querySelectorAll('#roomsWrap input, #roomsWrap select, #roomTable select, #printRoomSelect')].every(e => e.labels && e.labels.length || e.getAttribute('aria-label'))), `every room control has a name (${dark ? 'dark' : 'light'})`);
  await page.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
