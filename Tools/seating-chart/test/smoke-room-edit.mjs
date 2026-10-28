// smoke-room-edit.mjs — a mark edited in place, and a zone rule that remembers its mark (Path 14 P4 increment 3).
//
//   node Tools/seating-chart/test/smoke-room-edit.mjs
//
// A mark is resized by its corner (pointer) or Shift+arrows (keyboard), turned by R or a Turn button,
// relabelled and sized from its row in the Room card; each is one undo step and is saved to the room.
// The a11y scan of the page with a room open stays clean.
import { ROOM } from '../seating.mjs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8561;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
console.log('Seating Chart Generator — marks edited in place');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 500);
await page.click('button[onclick="makeGrid()"]');
await page.fill('#newRoomName', 'Room 12');
await page.click('button[onclick="makeRoom()"]');
await settle(page, 300);
await page.selectOption('#markKind', 'door');
await page.fill('#markLabel', 'Hall door');
await page.click('button[onclick="addMark()"]');
await settle(page, 300);

const saved = async () => { await settle(page, 1300); return (await page.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1')))).rooms[0].marks[0]; };
const mark = page.locator('#deskLayer .room-mark');
const size = () => page.evaluate(() => { const n = document.querySelector('#deskLayer .room-mark'); return [parseFloat(n.style.width), parseFloat(n.style.height)]; });
const w0 = await size();

// pointer: drag the corner
const grip = page.locator('#deskLayer .room-mark .mark-grip');
ok(await grip.count() === 1, 'the mark on the floor has a corner to pull');
const gb = await grip.boundingBox();
const gx = gb.x + gb.width * 0.8, gy = gb.y + gb.height * 0.8;   // the grip is a corner triangle: aim inside it
await page.mouse.move(gx, gy);
await page.mouse.down();
await page.mouse.move(gx + 60, gy + 40, { steps: 5 });
await page.mouse.up();
await settle(page, 300);
const w1 = await size();
ok(w1[0] > w0[0] && w1[1] > w0[1], `pulling the corner makes it bigger (${w0} -> ${w1})`);
ok(w1[0] % ROOM.grid === 0 && w1[1] % ROOM.grid === 0, 'and the size lands on the snap grid');
let m = await saved();
eq([m.w, m.h], w1, 'the room saves the new size');
await page.evaluate(() => window.undo());
await settle(page, 300);
eq(await size(), w0, 'undo puts the size back');
eq([(await saved()).x, (await saved()).y], [0, 110], 'pulling the corner did not move the mark');

// keyboard: Shift+arrows resize, plain arrows still move
await mark.focus();
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowDown');
await settle(page, 200);
eq(await size(), [w0[0] + ROOM.grid, w0[1] + ROOM.grid], 'Shift+arrows resize by one grid step');
ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('room-mark')), 'and focus stays on the mark');
await page.keyboard.press('Shift+ArrowLeft');
await page.keyboard.press('Shift+ArrowUp');
await settle(page, 200);
eq(await size(), w0, 'Shift+arrows back again');
await page.keyboard.press('Shift+ArrowLeft');
for (let i = 0; i < 40; i++) await page.keyboard.press('Shift+ArrowLeft');
await settle(page, 200);
ok((await size())[0] >= 10, 'a mark cannot be made smaller than ten');

// turn: R and the Turn button
await mark.focus();
await page.keyboard.press('r');
await settle(page, 200);
m = await saved();
eq(m.rot, 90, 'R turns it a quarter');
ok(/rotate\(90deg\)/.test(await mark.getAttribute('style')), 'and the picture turns');
await page.click('#markList button[aria-label^="Turn"]');
await settle(page, 200);
eq((await saved()).rot, 180, 'the Turn button turns it a quarter more');
await page.click('#markList button[aria-label^="Turn"]');
await page.click('#markList button[aria-label^="Turn"]');
await page.click('#markList button[aria-label^="Turn"]');
await settle(page, 200);
eq((await saved()).rot, 90, 'turning wraps round (three more from 180 gives 90)');
await page.evaluate(() => window.undo());
await settle(page, 200);
eq((await saved()).rot, 0, 'undo steps back one turn (90 back to 0)');

// relabel and size from the row
const label = page.locator('#markList input[type=text]');
await label.fill('Back door');
await label.press('Tab');
await settle(page, 300);
eq((await saved()).label, 'Back door', 'the label box renames it');
ok(/Back door/.test(await mark.getAttribute('aria-label')), 'and the floor says the new name');
const wbox = page.locator('#markList input[type=number]').first();
await wbox.fill('200');
await wbox.press('Tab');
await settle(page, 300);
eq((await saved()).w, 200, 'the width box sizes it');
await wbox.fill('99999');
await wbox.press('Tab');
await settle(page, 300);
ok((await saved()).w + (await saved()).x <= ROOM.width, 'a huge width is kept on the floor');
ok(await page.locator('#markList input[aria-label^="Label of"]').count() === 1 && await page.locator('#markList input[aria-label^="Width of"]').count() === 1, 'the row\'s boxes each have a name for a screen reader');

// mirrored: no pulling
await page.click('#mirrorBtn');
await settle(page, 200);
ok(await page.locator('#deskLayer .room-mark .mark-grip').count() === 0, 'mirrored: no corner to pull');
await page.click('#mirrorBtn');
await settle(page, 200);

// a11y with a room and a mark open
// (the desks' own contrast findings are 005's allowlisted ones: scan the parts this step added)
for (const include of ['#markList', '#deskLayer .room-mark']) {
  const viol = await a11yScan(page, { impact: 'serious', include });
  eq(viol.map(v => v.id), [], `${include}: no serious a11y violations`);
}

const errs = page.__errs.filter(e => !/favicon/.test(e));
eq(errs.length, 0, 'no page/console errors: ' + JSON.stringify(errs));
eq(page.__blocked.length, 0, 'nothing went offsite: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
