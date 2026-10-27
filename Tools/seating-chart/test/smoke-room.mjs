// smoke-room.mjs — the room layer on the page (Path 14 P4 step 2).
//
//   node Tools/seating-chart/test/smoke-room.mjs
//
// One room drawn once and shared by two periods: moving or adding a desk in one moves it in the other,
// each keeps its own seats; a mark shows on the floor; the chart on disk keeps section.desks as the
// mirror (what 010, 008, 045, 007 and 002 read); leaving the room keeps the desks; undo restores.
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8559;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
console.log('Seating Chart Generator — the room layer');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.click('button[onclick="makeGrid()"]');
await settle(page, 300);
const saved = async () => { await settle(page, 1300); return page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1'))); };
const deskCount = () => page.locator('#deskLayer .desk').count();
const n0 = await deskCount();
ok(n0 > 0, `a grid is on the floor (${n0})`);
ok(await page.locator('#roomIn').isHidden(), 'no room yet: the room controls are hidden');

// a chart that never makes a room stays without the fields
let st = await saved();
ok(!('rooms' in st) && st.sections.every(s => !('room' in s)), 'before any room: no rooms or room field is saved');

// make the room from this period, add a door
await page.fill('#newRoomName', 'Room 12');
await page.click('button[onclick="makeRoom()"]');
await settle(page, 300);
ok(await page.locator('#roomIn').isVisible(), 'the room controls show');
eq(await page.locator('#roomSelect option:checked').textContent(), 'Room 12', 'the period sits in Room 12');
await page.selectOption('#markKind', 'door');
await page.fill('#markLabel', 'Hall door');
await page.click('button[onclick="addMark()"]');
await settle(page, 300);
eq(await page.locator('#deskLayer .room-mark').count(), 1, 'the door is drawn on the floor');
eq(await page.locator('#deskLayer .room-mark').textContent(), 'Hall door', 'with its label');

// a second period joins the room: same desks, no seats
await page.fill('#newSectionName', 'Period 2');
await page.click('button[onclick="addSection()"]');
await settle(page, 300);
ok(await page.locator('#roomIn').isHidden(), 'a new period starts outside any room');
const rid = await page.evaluate(() => [...document.querySelectorAll('#roomSelect option')].find(o => o.textContent === 'Room 12').value);
await page.selectOption('#roomSelect', rid);
await settle(page, 300);
eq(await deskCount(), n0, 'Period 2 has the same desks');
eq(await page.locator('#deskLayer .room-mark').count(), 1, 'and the same door');
ok(/Shared by 2 periods/.test(await page.locator('#roomPeriods').textContent()), 'the room says two periods share it');

// add a desk in Period 2: Period 1 gets it too
await page.click('button[onclick="addDesk()"]');
await settle(page, 300);
eq(await deskCount(), n0 + 1, 'Period 2 has a new desk');
st = await saved();
const sizes = c => ['Honors GT', 'Period 2'].map(nm => c.sections.find(s => s.name === nm).desks.length);
eq(sizes(st), [n0 + 1, n0 + 1], 'both periods saved with the new desk (section.desks mirrors the room)');
eq(st.rooms[0].desks.length, n0 + 1, 'the room holds it');
const by = nm => st.sections.find(s => s.name === nm);
eq(by('Honors GT').desks.map(d => d.id), by('Period 2').desks.map(d => d.id), 'the same desk ids in both periods');

// undo takes it back everywhere
await page.evaluate(() => window.undo());
await settle(page, 300);
st = await saved();
eq(sizes(st), [n0, n0], 'undo restores both periods');

// leaving the room keeps the desks
await page.selectOption('#roomSelect', '');
await settle(page, 300);
eq(await deskCount(), n0, 'leaving the room keeps the desks');
eq(await page.locator('#deskLayer .room-mark').count(), 0, 'and the door is not drawn outside it');
st = await saved();
ok(!('room' in st.sections.find(s => s.name === 'Period 2')) && st.rooms.length === 1, 'the period no longer names the room; the room is kept');

const errs = page.__errs.filter(e => !/favicon/.test(e));
eq(errs.length, 0, 'no page/console errors: ' + JSON.stringify(errs));
eq(page.__blocked.length, 0, 'nothing went offsite: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
