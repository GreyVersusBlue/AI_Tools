// smoke-present.mjs — 087 Class Screen, Path 22 P6 (present mode and spotlight).
//
//   node Tools/class-screen/test/smoke-present.mjs
//
// Present locks the layout for the projector: no header, dock, title bars,
// close buttons or resize corners, and nothing a pointer or key can move.
// Double-clicking a widget fills the board with it, Esc steps back (the
// spotlight first, then present mode). Neither is saved. Every name here is
// invented; the suite uses the page's own dock and no roster.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8647;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

console.log('Class Screen — present mode and spotlight');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const rectOf = (loc) => loc.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const visible = (sel) => page.locator(sel).first().isVisible();

for (const t of ['text', 'timer', 'traffic']) await page.click(`#dock button[data-add="${t}"]`);
await settle(page, 400);
const saved0 = JSON.stringify((await cur()).widgets.map((w) => [w.id, w.x, w.y, w.w, w.h, w.z]));

// ── the editor keeps its controls ────────────────────────────────────
ok(await visible('.app-header'), 'editor shows the header');
ok(await visible('#dock'), 'editor shows the dock');
ok(await visible('.w-close'), 'editor shows close buttons');
ok(await page.locator('#presentExit').isHidden(), 'no exit button in the editor');
eq(await page.getAttribute('#presentBtn', 'aria-pressed'), 'false', 'Present starts unpressed');

// ── present mode ─────────────────────────────────────────────────────
const boardBefore = await rectOf(page.locator('#board'));
await page.click('#presentBtn');
ok(await page.evaluate(() => document.body.classList.contains('present')), 'Present sets body.present');
ok(!(await visible('.app-header')), 'present hides the header');
ok(!(await visible('#dock')), 'present hides the dock');
ok(!(await visible('.w-bar')), 'present hides the title bars');
ok(!(await visible('.w-close')), 'present hides close buttons');
ok(!(await visible('.w-resize')), 'present hides resize corners');
ok(await visible('#presentExit'), 'present shows a way back');
ok(await page.evaluate(() => document.activeElement === document.body), 'focus is left on the page, so Space still reaches the timer instead of pressing the exit button');
const boardIn = await rectOf(page.locator('#board'));
ok(boardIn.h > boardBefore.h, 'the board grows into the freed room');
eq(JSON.stringify((await cur()).widgets.map((w) => [w.id, w.x, w.y, w.w, w.h, w.z])), saved0, 'widgets keep their saved fractions');

// nothing can move a widget: synthetic pointer and key events on the (hidden) grip and resize handle
const before = await rectOf(widget('timer'));
// a synthetic pointer has no real id to capture; let it through so only the page's own guard can stop the drag
await page.evaluate(() => { Element.prototype.setPointerCapture = function () {}; });
await widget('timer').evaluate((n) => {
  const g = n.querySelector('.w-grip'), r = n.querySelector('.w-resize');
  for (const h of [g, r]) {
    h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 300, clientY: 300, pointerId: 7 }));
    h.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 420, clientY: 380, pointerId: 7 }));
    h.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 420, clientY: 380, pointerId: 7 }));
  }
  for (const k of ['ArrowRight', 'ArrowDown']) {
    g.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    g.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: true, bubbles: true, cancelable: true }));
  }
});
await settle(page, 450);
eq(await rectOf(widget('timer')), before, 'pointer and keys do not move or resize a widget while presenting');
eq(JSON.stringify((await cur()).widgets.map((w) => [w.id, w.x, w.y, w.w, w.h, w.z])), saved0, 'and nothing was saved');

// ── spotlight by double-click ────────────────────────────────────────
await widget('timer').locator('.big-text').dblclick();
ok(await widget('timer').evaluate((n) => n.classList.contains('spot')), 'double-click on the clock face spotlights the timer');
const boardNow = await rectOf(page.locator('#board'));
eq(await rectOf(widget('timer')), boardNow, 'the spotlit widget fills the board');
ok(await widget('text').evaluate((n) => getComputedStyle(n).visibility === 'hidden'), 'the others are hidden (and out of the tab order)');
eq(JSON.stringify((await cur()).widgets.map((w) => [w.id, w.x, w.y, w.w, w.h, w.z])), saved0, 'the spotlight saves no geometry');
await page.keyboard.press('Escape');
ok(await widget('timer').evaluate((n) => !n.classList.contains('spot')), 'Esc ends the spotlight first');
ok(await page.evaluate(() => document.body.classList.contains('present')), 'and stays in present mode');
eq(await rectOf(widget('timer')), before, 'the widget returns to where it was');

// a double-click in a text box fills the board only while presenting
await widget('text').locator('textarea').dblclick();
ok(await widget('text').evaluate((n) => n.classList.contains('spot')), 'presenting: double-click on a text box spotlights it');
await page.keyboard.press('Escape');

// double-click on a spotlit widget goes back too
await widget('timer').locator('.big-text').dblclick();
await widget('timer').locator('.big-text').dblclick();
ok(await widget('timer').evaluate((n) => !n.classList.contains('spot')), 'a second double-click puts it back');

// ── leave present mode ───────────────────────────────────────────────
await page.keyboard.press('Escape');
ok(await page.evaluate(() => !document.body.classList.contains('present')), 'Esc leaves present mode');
ok(await visible('.app-header') && await visible('#dock') && await visible('.w-close'), 'the editor is back');
ok(await page.evaluate(() => document.activeElement.id === 'presentBtn'), 'focus returns to the Present button');
await page.click('#presentBtn');
await page.click('#presentExit');
ok(await page.evaluate(() => !document.body.classList.contains('present')), 'the exit button leaves present mode');

// ── the editor: text boxes keep their double-click, the fill button works by keyboard ──
await widget('text').locator('textarea').dblclick();
ok(await widget('text').evaluate((n) => !n.classList.contains('spot')), 'editing: double-click in a text box only selects a word');
const fill = widget('timer').getByRole('button', { name: 'Fill the board with Timer' });
await fill.focus();
await page.keyboard.press('Enter');
ok(await widget('timer').evaluate((n) => n.classList.contains('spot')), 'the fill button spotlights the timer by keyboard');
eq(await fill.getAttribute('aria-pressed'), 'true', 'and reports it pressed');
const before2 = await rectOf(widget('timer'));
await widget('timer').locator('.w-grip').evaluate((g) => {
  g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 300, clientY: 300, pointerId: 8 }));
  g.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 360, clientY: 340, pointerId: 8 }));
  g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 360, clientY: 340, pointerId: 8 }));
});
eq(await rectOf(widget('timer')), before2, 'a spotlit widget cannot be dragged away');
await page.keyboard.press('Escape');
ok(await widget('timer').evaluate((n) => !n.classList.contains('spot')), 'Esc ends the spotlight in the editor');
eq(await fill.getAttribute('aria-pressed'), 'false', 'and the button is released');

// a screen change or reload drops both; neither is saved
await page.click('#presentBtn');
await widget('timer').locator('.big-text').dblclick();
await page.reload();
await settle(page, 300);
ok(await page.evaluate(() => !document.body.classList.contains('present')), 'a reload comes back to the editor');
eq(await page.locator('#board .w.spot').count(), 0, 'with no spotlight');

// ── a11y and width ───────────────────────────────────────────────────
await page.click('#presentBtn');
const vPresent = await a11yScan(page);
eq(vPresent.map((v) => v.id + ' ' + v.nodes.join('|')), [], 'axe: no serious violations while presenting');
await widget('timer').locator('.big-text').dblclick();
const vSpot = await a11yScan(page);
eq(vSpot.map((v) => v.id + ' ' + v.nodes.join('|')), [], 'axe: no serious violations in the spotlight');
await page.evaluate(() => document.activeElement.blur());
for (let i = 0; i < 12 && !(await page.evaluate(() => document.activeElement.id === 'presentExit')); i++) await page.keyboard.press('Shift+Tab');
const focusRing = await page.evaluate(() => { const e = document.activeElement; const c = getComputedStyle(e); return e.id === 'presentExit' ? c.outlineStyle + ' ' + c.outlineWidth : 'not-on-exit:' + (e.id || e.tagName); });
ok(/^(solid|auto) [1-9]/.test(focusRing), `keyboard focus on the exit button is visible (${focusRing})`);
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
for (const width of [375, 360]) {
  await page.setViewportSize({ width, height: 740 });
  await settle(page, 200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
  await page.click('#presentBtn');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `and none while presenting at ${width}px`);
  ok(await visible('#presentExit'), `the way back is on screen at ${width}px`);
  await page.click('#presentExit');
}

eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
