// smoke-room-marks.mjs — marks on the floor and on paper (Path 14 P4 increment 2).
//
//   node Tools/seating-chart/test/smoke-room-marks.mjs
//
// A mark is dragged with the pointer and moved with the arrow keys (focus kept), both undoable and
// both saved to the room; a mirrored floor does not drag (the desks' own guard); the room's marks
// print on the live page, on every page of Print all and of the whole-day sub packet, and the page
// grows to hold a mark that sits outside the desks; a period outside a room, and a chart with no
// room at all, print exactly as before.
import { ROOM } from '../seating.mjs';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const GRID = ROOM.grid;
const PORT = 8560;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
console.log('Seating Chart Generator — marks dragged and printed');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.click('button[onclick="makeGrid()"]');
await settle(page, 300);
const saved = async () => { await settle(page, 1300); return page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1'))); };
const runPrint = async fn => {
  await page.evaluate(f => { window.print = () => {}; window[f](); }, fn);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
};
const endPrint = () => page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
const markPos = () => page.evaluate(() => { const n = document.querySelector('#deskLayer .room-mark'); return n ? [parseFloat(n.style.left), parseFloat(n.style.top)] : null; });

// before any room: print-all has no marks
await runPrint('printAllSections');
eq(await page.locator('#printAllWrap .room-mark').count(), 0, 'no room: Print all carries no marks');
await endPrint();

await page.fill('#newRoomName', 'Room 12');
await page.click('button[onclick="makeRoom()"]');
await settle(page, 300);
await page.selectOption('#markKind', 'door');
await page.fill('#markLabel', 'Hall door');
await page.click('button[onclick="addMark()"]');
await settle(page, 300);
const mark = page.locator('#deskLayer .room-mark');
ok(await mark.evaluate(n => n.classList.contains('movable') && n.tabIndex === 0), 'the mark on the floor can be picked up and focused');
ok(/Arrow keys/.test(await mark.getAttribute('aria-label')), 'and says the arrow keys move it');
const p0 = await markPos();

// drag it
const box = await mark.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 6 });
await page.mouse.up();
await settle(page, 300);
const p1 = await markPos();
ok(p1[0] > p0[0] + 60 && p1[1] > p0[1] + 40, `dragging moves the mark (${p0} -> ${p1})`);
ok(p1[0] % GRID === 0 && p1[1] % GRID === 0, 'and it lands on the snap grid');
let st = await saved();
eq([st.rooms[0].marks[0].x, st.rooms[0].marks[0].y], p1, 'the room saves the new place');
await page.evaluate(() => window.undo());
await settle(page, 300);
eq(await markPos(), p0, 'undo puts it back');

// a click that does not move leaves the chart as it was (no undo step, no change)

const box2 = await mark.boundingBox();
await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2);
await settle(page, 200);
eq(await markPos(), p0, 'a plain click does not move it');

// keyboard
await mark.focus();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
await settle(page, 200);
const p2 = await markPos();
ok(p2[0] > p0[0] && p2[1] > p0[1], `arrow keys move it (${p0} -> ${p2})`);
ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('room-mark')), 'and focus stays on the mark');

// mirrored: no drag
await page.click('#mirrorBtn');
await settle(page, 200);
ok(await page.locator('#deskLayer .room-mark.movable').count() === 0, 'mirrored: the mark is not a drag target');
await page.click('#mirrorBtn');
await settle(page, 200);

// a mark outside the desks grows the printed page
await page.selectOption('#markKind', 'projector');
await page.click('button[onclick="addMark()"]');
await settle(page, 200);
const floorW = async () => { await runPrint('printChart'); const w = await page.evaluate(() => parseFloat(document.getElementById('floor').style.width)); await endPrint(); return w; };
await page.evaluate(() => document.querySelectorAll('#markList button[aria-label^="Remove projector"]').forEach(b => b.click()));
await settle(page, 200);
const wWith = await floorW();
// a bench far right of the grid
await page.selectOption('#markKind', 'bench');
await page.click('button[onclick="addMark()"]');
await settle(page, 200);
const wFar = await floorW();
ok(wFar >= wWith, `the printed floor is as wide as the desks and marks need (${wWith} -> ${wFar})`);

// the live print shows the marks
await runPrint('printChart');
ok(await page.locator('#deskLayer .room-mark').count() === 2, 'the live print draws the room\'s marks');
await endPrint();

// a second period in the room, and one outside it
await page.fill('#newSectionName', 'Period 2');
await page.click('button[onclick="addSection()"]');
await settle(page, 300);
const rid = await page.evaluate(() => [...document.querySelectorAll('#roomSelect option')].find(o => o.textContent === 'Room 12').value);
await page.selectOption('#roomSelect', rid);
await settle(page, 300);
await page.fill('#newSectionName', 'Period 3');
await page.click('button[onclick="addSection()"]');
await settle(page, 300);
await page.click('button[onclick="makeGrid()"]');
await settle(page, 300);

const perPage = () => page.evaluate(() => [...document.querySelectorAll('#printAllWrap .print-page')].map(p => ({
  title: p.querySelector('.print-head h2') ? p.querySelector('.print-head h2').textContent : '',
  marks: [...p.querySelectorAll('.room-mark')].map(m => m.textContent),
  contents: !!p.querySelector('.print-contents'),
})));
await runPrint('printAllSections');
let pages = await perPage();
const byName = n => pages.find(p => p.title === n);
eq(['Honors GT', 'Period 2', 'Period 3'].map(n => byName(n).marks.length), [2, 2, 0], 'Print all: the two periods in the room carry its marks, the one outside none');
eq(byName('Honors GT').marks.slice().sort(), ['Hall door', 'bench'], 'with their labels');
await endPrint();
await runPrint('printSubExportAll');
pages = (await perPage()).filter(p => !p.contents);
eq(['Honors GT', 'Period 2', 'Period 3'].map(n => byName(n).marks.length), [2, 2, 0], 'the whole-day sub packet carries them too');
await endPrint();
ok(await page.locator('#printAllWrap').evaluate(w => w.children.length === 0), 'and the print wrap is emptied afterwards');

const errs = page.__errs.filter(e => !/favicon/.test(e));
eq(errs.length, 0, 'no page/console errors: ' + JSON.stringify(errs));
eq(page.__blocked.length, 0, 'nothing went offsite: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
