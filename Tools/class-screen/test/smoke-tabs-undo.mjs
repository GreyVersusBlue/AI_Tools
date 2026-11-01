// smoke-tabs-undo.mjs — 087 Class Screen, Path 22 P10 (two tabs and memory).
//
//   node Tools/class-screen/test/smoke-tabs-undo.mjs
//
// Three things. A save from another tab raises a bar here instead of silently
// losing to whoever wrote last (load theirs, or keep this tab's). The name
// picker's "no repeats" list lives for the browser tab (sessionStorage), not
// for ever and not only until a reload. Moves and resizes undo, as removals
// already did, from the toast and from Ctrl+Z. Rosters here are made up.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8651;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const pageA = await prepPage(browser, BASE, { width: 1400, height: 900 });
let page = pageA;

console.log('Class Screen — two tabs, memory, undo');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const types = async () => (await cur()).widgets.map((w) => w.type);
const add = async (type) => { await page.click(`#dock button[data-add="${type}"]`); await settle(page, 450); };
const banner = () => page.locator('#tabBanner');

// ── another tab saved ────────────────────────────────────────────────
console.log(' two tabs');
await add('text');
await add('timer');
const pageB = await pageA.context().newPage();
pageB.__errs = [];
pageB.on('pageerror', (e) => pageB.__errs.push(String(e)));
await pageB.goto(URL_PAGE);
await settle(pageB);
ok(await banner().isHidden(), 'no bar while nothing else has saved');
ok(await banner().isHidden(), 'and this tab\'s own saves do not raise it');

page = pageB;
await add('dice');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'a save from another tab raises the bar here');
ok((await banner().textContent()).includes('changed in another tab'), 'and says what happened');
eq(await types(), ['text', 'timer'], 'this tab\'s board is untouched until the teacher chooses');
const v = await a11yScan(page);
eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations with the bar showing');
await page.click('#tabLoad');
eq(await types(), ['text', 'timer', 'dice'], 'Load their changes brings the other tab\'s board in');
ok(await banner().isHidden(), 'and the bar goes');
ok(await page.locator('#toast').isVisible(), 'with a word that it happened');

page = pageB;
await add('clock');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'a second save raises it again');
await page.click('#tabKeep');
ok(await banner().isHidden(), 'Keep what is here closes it');
await settle(page, 300);
eq((await st()).screens[0].widgets.map((w) => w.type), ['text', 'timer', 'dice'], 'and this tab\'s board is what is stored now (theirs was replaced)');
eq(await pageA.evaluate(([k]) => JSON.parse(localStorage.getItem(k)).data.screens[0].widgets.map((w) => w.type), [KEY]), ['text', 'timer', 'dice'], 'in storage too');

// present mode: the bar waits
page = pageB;
await add('traffic');
page = pageA;
await settle(page, 300);
ok(await banner().isVisible(), 'raised again');
await page.click('#presentBtn');
ok(!(await banner().isVisible()), 'present mode keeps it off the projector');
await page.click('#presentExit');
ok(await banner().isVisible(), 'and it is still there when present mode ends');
await page.click('#tabLoad');

// ── the name picker remembers who it has called, for the tab ─────────
console.log(' no repeats for the browser session');
await pageA.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Test Group': ['Pupil 1', 'Pupil 2', 'Pupil 3'], 'Other Group': ['Pupil 7', 'Pupil 8'] }));
});
await pageA.reload();
await settle(pageA, 400);
await add('names');
const np = widget('names');
await np.getByLabel('Class roster').selectOption('Test Group');
await settle(pageA, 300);
const noteNow = () => np.locator('.note').textContent();
const pickOnce = async () => { await np.getByRole('button', { name: 'Pick', exact: true }).click(); return np.locator('.big-name').textContent(); };
const usedRaw = () => pageA.evaluate(() => sessionStorage.getItem('cls-screen:used'));
eq(await noteNow(), '3 of 3 left', 'a fresh picker has everyone left');
const first = await pickOnce(), second = await pickOnce();
ok(first !== second, 'two picks in a row are two different names');
eq(await noteNow(), '1 of 3 left', 'one left');
const raw = await usedRaw();
ok(raw && !/Pupil/.test(raw), 'what is kept for the tab holds positions, no name');
eq(Object.values(JSON.parse(raw))[0].at.length, 2, 'two positions');
ok(!/Pupil/.test(await pageA.evaluate(([k]) => localStorage.getItem(k), [KEY])), 'and the saved board holds no name either');
await pageA.reload();
await settle(pageA, 400);
eq(await noteNow(), '1 of 3 left', 'a reload keeps the count');
const third = await pickOnce();
ok(![first, second].includes(third), 'and the next pick is the one not yet called');
eq(await noteNow(), '0 of 3 left', 'none left');
await pageA.reload();
await settle(pageA, 400);
eq(await noteNow(), '0 of 3 left', 'still none after another reload');
const fourth = await pickOnce();
ok(['Pupil 1', 'Pupil 2', 'Pupil 3'].includes(fourth), 'the next pick starts a new round');
eq(await noteNow(), '2 of 3 left', 'with the count to match');
await np.getByLabel('No repeats').uncheck();
eq(await usedRaw(), null, 'turning no-repeats off forgets the list');
await np.getByLabel('No repeats').check();
await pickOnce();
await np.getByLabel('Class roster').selectOption('Other Group');
eq(await noteNow(), '2 of 2 left', 'another roster starts clean');
eq(await usedRaw(), null, 'and the kept list is gone');
await np.getByLabel('Class roster').selectOption('Test Group');
await pickOnce();
// the list belongs to the tab
const pageC = await pageA.context().newPage();
await pageC.goto(URL_PAGE);
await settle(pageC, 400);
eq(await pageC.locator('#board .w[data-type="names"] .note').textContent(), '3 of 3 left', 'a second tab on the same board has its own list (sessionStorage is per tab)');
await pageC.close();
// a roster that changed since starts afresh
await pageA.evaluate(() => localStorage.setItem('np_rosters', JSON.stringify({ 'Test Group': ['Pupil 1', 'Pupil 2', 'Pupil 9'], 'Other Group': ['Pupil 7', 'Pupil 8'] })));
await pageA.reload();
await settle(pageA, 400);
eq(await noteNow(), '3 of 3 left', 'a roster edited since the list was kept starts the list again');
await pickOnce();
await np.getByRole('button', { name: 'Remove Name picker' }).click();
eq(await usedRaw(), null, 'removing the picker forgets its list');

// ── undo: moves and resizes, with removals ───────────────────────────
console.log(' undo');
await pageA.evaluate(() => localStorage.clear());
await pageA.reload();
await settle(pageA, 400);
await add('text');
const rect = async () => { const w = (await cur()).widgets.find((x) => x.type === 'text'); return { x: w.x, y: w.y, w: w.w, h: w.h }; };
const r0 = await rect();
const grip = widget('text').locator('.w-grip');
const gb = await grip.boundingBox();
await page.mouse.move(gb.x + 20, gb.y + 8); await page.mouse.down(); await page.mouse.move(gb.x + 220, gb.y + 120, { steps: 6 }); await page.mouse.up();
await settle(page, 450);
const r1 = await rect();
ok(r1.x > r0.x && r1.y > r0.y, 'dragging by the title bar moves it');
eq(await page.locator('#toastText').textContent(), 'Text moved.', 'and says so, with an Undo');
ok(await page.locator('#toastUndo').isVisible(), 'the Undo button is there');
await page.click('#toastUndo');
await settle(page, 450);
eq(await rect(), r0, 'Undo puts it back exactly where it was');
const cb = await widget('text').locator('.w-resize').boundingBox();
await page.mouse.move(cb.x + 8, cb.y + 8); await page.mouse.down(); await page.mouse.move(cb.x + 160, cb.y + 100, { steps: 6 }); await page.mouse.up();
await settle(page, 450);
const r2 = await rect();
ok(r2.w > r0.w && r2.h > r0.h && r2.x === r0.x, 'dragging the corner resizes it');
eq(await page.locator('#toastText').textContent(), 'Text resized.', 'and says so');
await page.keyboard.press('Control+z');
await settle(page, 450);
eq(await rect(), r0, 'Ctrl+Z undoes a resize');
// a burst of arrow presses is one move
await grip.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
await settle(page, 450);
const r3 = await rect();
ok(r3.x > r0.x, 'arrow keys move it');
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press('Control+z');
await settle(page, 450);
eq(await rect(), r0, 'five arrow presses undo as one move');
await page.keyboard.press('Control+z');
eq(await page.locator('#toastText').textContent(), 'Nothing to undo.', 'with nothing left it says so');
// typing keeps the browser's own undo
await widget('text').locator('textarea').fill('hello');
await grip.focus();
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
await settle(page, 450);
const r4 = await rect();
await widget('text').locator('textarea').focus();
await page.keyboard.press('Control+z');
await settle(page, 450);
eq(await rect(), r4, 'Ctrl+Z inside a text box does not undo the board');
// order: a move after a removal is undone first, then the removal
await widget('text').getByRole('button', { name: 'Remove Text' }).click();
eq(await types(), [], 'removed');
await add('timer');
const tg = await widget('timer').locator('.w-grip').boundingBox();
await page.mouse.move(tg.x + 20, tg.y + 8); await page.mouse.down(); await page.mouse.move(tg.x + 200, tg.y + 100, { steps: 6 }); await page.mouse.up();
await settle(page, 450);
await page.evaluate(() => document.activeElement && document.activeElement.blur());   // a new timer starts with its time box focused, which keeps its own undo
await page.keyboard.press('Control+z');
await settle(page, 450);
eq(await types(), ['timer'], 'the first Ctrl+Z undoes the move, not the removal');
eq(await page.locator('#toastText').textContent(), 'Undone: Timer move.', 'and says which');
await page.keyboard.press('Control+z');
await settle(page, 450);
eq((await types()).sort(), ['text', 'timer'], 'the second brings the removed widget back');
// a removal is undoable for seven seconds, no longer
await widget('text').getByRole('button', { name: 'Remove Text' }).click();
await settle(page, 7400);
await page.keyboard.press('Control+z');
await settle(page, 300);
eq(await types(), ['timer'], 'after the toast has gone a removal is final (its pictures are cleaned up then)');
// present mode: no undo
const tr = (await cur()).widgets[0];
await page.click('#presentBtn');
await page.keyboard.press('Control+z');
ok(await page.evaluate(() => document.body.classList.contains('present')), 'Ctrl+Z in present mode does nothing');
await page.click('#presentExit');
// across screens
const tgb = await widget('timer').locator('.w-grip').boundingBox();
const before = (await cur()).widgets[0];
await page.mouse.move(tgb.x + 20, tgb.y + 8); await page.mouse.down(); await page.mouse.move(tgb.x + 120, tgb.y + 60, { steps: 6 }); await page.mouse.up();
await settle(page, 450);
const moved = (await cur()).widgets[0];
ok(moved.x !== before.x, 'moved on screen one');
page.once('dialog', (d) => d.accept('Second'));
await page.click('#newScreenBtn');
await settle(page, 400);
eq((await cur()).widgets.length, 0, 'now on an empty second screen');
await page.keyboard.press('Control+z');
await settle(page, 500);
const back = await cur();
eq(back.widgets.length, 1, 'Ctrl+Z goes back to the screen the move was on');
eq({ x: back.widgets[0].x, y: back.widgets[0].y }, { x: before.x, y: before.y }, 'and puts the widget back');
void tr;
const keysRow = await page.evaluate(() => document.getElementById('keysDialog').textContent);
ok(/Undo the last removal, move or resize/.test(keysRow), 'the shortcut list names Ctrl+Z');

for (const width of [375, 360]) {
  page = pageB;
  await pageA.setViewportSize({ width, height: 740 });
  await settle(pageA, 200);
  page = pageA;
  ok(await pageA.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
}
await pageA.setViewportSize({ width: 1400, height: 900 });

eq(pageA.__errs, [], 'no page or console errors in tab A');
eq(pageB.__errs, [], 'no page or console errors in tab B');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
