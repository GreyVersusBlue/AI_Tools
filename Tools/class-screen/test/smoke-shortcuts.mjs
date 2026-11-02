// smoke-shortcuts.mjs — 087 Class Screen, Path 22 P7 (keyboard and clicker shortcuts).
//
//   node Tools/class-screen/test/smoke-shortcuts.mjs
//
// Space starts and pauses the timer on top, N picks a name, Right/PageDown and
// Left/PageUp (a presentation clicker) change screen, and ? shows the list.
// None of it may fire while someone types in a box, on a focused button's own
// Space, with Ctrl/Alt/Cmd held, on a held key, or behind an open dialog. The
// roster is invented.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8648;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const ROSTER = { 'Period 4': ['Wren Abbot', 'Odell Ferris', 'Mina Castellan'] };

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
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.__promptAnswer ?? d.defaultValue()) : undefined));

console.log('Class Screen — keyboard and clicker shortcuts');

await page.goto(URL_PAGE);
await page.evaluate(([r]) => { localStorage.clear(); localStorage.setItem('np_rosters', JSON.stringify(r)); }, [ROSTER]);
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const curIndex = async () => { const s = await st(); return s.screens.findIndex((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const timerData = async () => (await cur()).widgets.find((w) => w.type === 'timer').data;
const body = () => page.evaluate(() => document.activeElement.blur());
const toastText = () => page.locator('#toast').isVisible().then(async (v) => (v ? page.locator('#toastText').textContent() : ''));

// Screen 1 has a timer, a name picker and a text box; screens 2 and 3 are empty.
for (const t of ['text', 'timer', 'names']) await page.click(`#dock button[data-add="${t}"]`);
for (const name of ['Second', 'Third']) {
  page.__promptAnswer = name;
  await page.click('#newScreenBtn');
}
await page.selectOption('#screenSelect', { index: 0 });
await settle(page, 400);
eq((await st()).screens.length, 3, 'three screens');
eq(await curIndex(), 0, 'back on the first screen');

// ── Space: the timer on top ──────────────────────────────────────────
await body();
eq((await timerData()).endsAt, 0, 'the timer starts stopped');
await page.keyboard.press(' ');
await settle(page, 400);
ok((await timerData()).endsAt > 0, 'Space starts the timer');
await page.keyboard.press(' ');
await settle(page, 400);
eq((await timerData()).endsAt, 0, 'Space again pauses it');
await page.keyboard.down(' '); await page.keyboard.down(' '); await page.keyboard.down(' '); await page.keyboard.up(' ');
await settle(page, 400);
ok((await timerData()).endsAt > 0, 'a held Space counts once (one toggle, so it runs)');
await page.keyboard.press(' ');
await settle(page, 300);

// typing keeps its keys
const ta = widget('text').locator('textarea');
await ta.click();
await page.keyboard.type('a n ? b');
eq(await ta.inputValue(), 'a n ? b', 'a text box takes Space, n and ? as typing');
eq((await timerData()).endsAt, 0, 'and the timer did not move');
eq(await widget('names').locator('.big-name').textContent(), '', 'and no name was picked');
const custom = widget('timer').getByLabel('Set time, minutes or m:ss');
await custom.click();
await page.keyboard.type('n 5');
eq(await custom.inputValue(), 'n 5', 'a small field takes them too');
await custom.fill('');
await page.keyboard.press('ArrowRight');
eq(await curIndex(), 0, 'arrows in a field never change screen');

// Space on a focused button is the button's, not a second press
await widget('timer').getByRole('button', { name: '1 min' }).focus();
await page.keyboard.press(' ');
await settle(page, 300);
eq((await timerData()).duration, 60, 'Space on the 1 min button presses it');
eq((await timerData()).endsAt, 0, 'and does not also start the timer');

// ── N: pick a name ───────────────────────────────────────────────────
await body();
const seen = [];
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('n');
  seen.push(await widget('names').locator('.big-name').textContent());
}
eq([...seen].sort(), [...ROSTER['Period 4']].sort(), 'three N presses pick the whole class once each (no repeats is on)');
await page.keyboard.press('Shift+N');
ok(ROSTER['Period 4'].includes(await widget('names').locator('.big-name').textContent()), 'capital N picks too');

// ── screens: arrows and a clicker ────────────────────────────────────
await body();
await page.keyboard.press('ArrowRight');
eq(await curIndex(), 1, 'Right is the next screen');
ok((await toastText()).startsWith('Screen 2 of 3'), 'and says which');
await page.keyboard.press('PageDown');
eq(await curIndex(), 2, 'PageDown is the next screen');
await page.keyboard.press('PageDown');
eq(await curIndex(), 2, 'it does not wrap past the last screen');
eq(await toastText(), 'This is the last screen.', 'and says so');
await page.keyboard.press('ArrowLeft');
eq(await curIndex(), 1, 'Left is the previous screen');
await page.keyboard.press('PageUp');
eq(await curIndex(), 0, 'PageUp is the previous screen');
await page.keyboard.press('PageUp');
eq(await curIndex(), 0, 'it does not wrap before the first');
eq(await toastText(), 'This is the first screen.', 'and says so');
await page.keyboard.press('Control+ArrowRight');
await page.keyboard.press('Alt+ArrowRight');
eq(await curIndex(), 0, 'Ctrl+Right and Alt+Right stay the browser\'s');
eq(await page.locator('#board .w').count(), 3, 'the first screen\'s widgets are back');

// a focused title bar keeps its arrows for moving the widget
const grip = widget('text').locator('.w-grip');
const x0 = (await cur()).widgets.find((w) => w.type === 'text').x;
await grip.focus();
await page.keyboard.press('ArrowRight');
await settle(page, 400);
eq(await curIndex(), 0, 'Right on a title bar does not change screen');
ok((await cur()).widgets.find((w) => w.type === 'text').x > x0, 'it moves the widget');

// a screen with no timer or name picker says what is missing
await body();
await page.keyboard.press('ArrowRight');
await page.keyboard.press(' ');
eq(await toastText(), 'Add a timer to run it with Space.', 'Space with no timer says so');
await page.keyboard.press('n');
eq(await toastText(), 'Add a name picker to pick with N.', 'N with no name picker says so');
await page.keyboard.press('ArrowLeft');

// ── ? : the list ─────────────────────────────────────────────────────
await ta.click();
await page.keyboard.type('?');
ok(await page.locator('#keysDialog').evaluate((d) => !d.open), '? typed in a box does not open the list');
await body();
await page.keyboard.press('?');
ok(await page.locator('#keysDialog').evaluate((d) => d.open), '? opens the list');
const rows = await page.locator('#keysDialog tbody tr').allTextContents();
ok(['Space', 'N', 'Page Down', 'Page Up', 'Esc'].every((k) => rows.some((r) => r.includes(k))), 'the list names every key');
const t0 = (await timerData()).endsAt;
await body();   // the dialog put focus on its Close button, whose own Space would close it
await page.keyboard.press(' ');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('n');
eq([(await timerData()).endsAt, await curIndex()], [t0, 0], 'behind the open list, Space, Right and N do nothing');
const v = await a11yScan(page);
eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations with the list open');
await page.keyboard.press('Escape');
ok(await page.locator('#keysDialog').evaluate((d) => !d.open), 'Esc closes the list');
ok(await page.evaluate(() => document.activeElement.id === 'keysBtn'), 'focus returns to the Keys button');
await page.click('#keysBtn');
await page.click('#keysClose');
ok(await page.locator('#keysDialog').evaluate((d) => !d.open), 'the Close button closes it');

// the phone remote's dialog owns the keys while it is open
await page.click('#remoteBtn');
await page.keyboard.press('ArrowRight');
eq(await curIndex(), 0, 'with the phone remote open, Right does nothing');
await page.keyboard.press('Escape');

// ── present mode runs on the same keys ───────────────────────────────
await page.click('#presentBtn');
await page.keyboard.press(' ');
await settle(page, 400);
ok((await timerData()).endsAt > 0, 'presenting: Space still runs the timer');
await page.keyboard.press(' ');
await page.keyboard.press('ArrowRight');
eq(await curIndex(), 1, 'presenting: Right still changes screen');
await page.keyboard.press('Escape');

// ── width ────────────────────────────────────────────────────────────
for (const width of [375, 360]) {
  await page.setViewportSize({ width, height: 740 });
  await settle(page, 200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
  await page.click('#keysBtn');
  const box = await page.locator('#keysDialog').boundingBox();
  ok(box && box.x >= 0 && box.x + box.width <= width, `the list fits at ${width}px`);
  await page.keyboard.press('Escape');
}

eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
