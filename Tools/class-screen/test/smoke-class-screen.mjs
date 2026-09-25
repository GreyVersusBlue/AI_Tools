// smoke-class-screen.mjs — 087 Class Screen in a real browser.
//
//   node Tools/class-screen/test/smoke-class-screen.mjs
//
// Adds every widget from the dock, moves and resizes them by mouse and by
// keyboard, reloads to prove the screen was saved (as fractions of the board,
// so the same screen lands in the same place at another window size), runs a
// short timer to zero, loads a YouTube link and a bad one, goes offline,
// picks names from a seeded roster without repeats, removes a widget and
// undoes it, manages screens, and runs axe on a full board. Offsite requests
// are aborted by the harness, so the YouTube frame never actually loads; what
// is asserted is the src it was given. Every name here is invented.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8442;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/087-class-screen.html';
const KEY = 'cls-screen:state';
const ROSTER = { 'Period 3': ['Avery Quill', 'Bram Tolliver', 'Cass Mendoza'] };
const ID = 'dQw4w9WgXcQ';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ± ${tol})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });
page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.__promptAnswer ?? d.defaultValue()) : undefined));

console.log('Class Screen — smoke');

await page.goto(URL_PAGE);
await page.evaluate(([r]) => { localStorage.clear(); localStorage.setItem('np_rosters', JSON.stringify(r)); }, [ROSTER]);
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);

// ── empty start ──────────────────────────────────────────────────────
ok(await page.locator('#boardEmpty').isVisible(), 'empty board shows the hint');
eq((await st()).screens.length, 1, 'one screen to start');
eq(await page.locator('#dock button[data-add]').count(), 14, 'dock offers fourteen widgets');

// ── add every widget ─────────────────────────────────────────────────
for (const t of ['text', 'timer', 'stopwatch', 'clock', 'youtube', 'traffic', 'names', 'dice']) {
  await page.click(`#dock button[data-add="${t}"]`);
}
await settle(page, 400);
eq(await page.locator('#board .w').count(), 8, 'eight widgets on the board');
ok(await page.locator('#boardEmpty').isHidden(), 'hint hides once a widget exists');
eq((await cur()).widgets.length, 8, 'all eight saved');
ok(await page.evaluate(() => document.activeElement.closest('.w')?.dataset.type === 'dice'), 'a new widget takes focus');

// ── text ─────────────────────────────────────────────────────────────
await widget('text').locator('textarea').fill('Warm-up: page 42 <b>not bold</b>');
await widget('text').getByRole('button', { name: 'Larger text' }).click();
await settle(page, 450);
const textData = (await cur()).widgets.find((w) => w.type === 'text').data;
eq(textData, { text: 'Warm-up: page 42 <b>not bold</b>', size: 3 }, 'text and size saved');

// ── keyboard move and resize ─────────────────────────────────────────
const before = (await cur()).widgets.find((w) => w.type === 'clock');
const grip = widget('clock').locator('.w-grip');
await grip.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Shift+ArrowDown');
await page.keyboard.press('Shift+ArrowDown');
await settle(page, 450);
const afterKeys = (await cur()).widgets.find((w) => w.type === 'clock');
near(afterKeys.x, before.x + 0.05, 0.001, 'five right arrows move 5% of the board');
near(afterKeys.h, before.h + 0.02, 0.001, 'two Shift+Down grow the height 2%');

// ── mouse drag and resize ────────────────────────────────────────────
const boardBox = await page.locator('#board').boundingBox();
const gBox = await grip.boundingBox();
await page.mouse.move(gBox.x + 20, gBox.y + gBox.height / 2);
await page.mouse.down();
await page.mouse.move(gBox.x + 20 + 140, gBox.y + gBox.height / 2 + 90, { steps: 6 });
await page.mouse.up();
await settle(page, 450);
const afterDrag = (await cur()).widgets.find((w) => w.type === 'clock');
near(afterDrag.x, afterKeys.x + 140 / boardBox.width, 0.003, 'drag moves by the pointer distance (x)');
near(afterDrag.y, afterKeys.y + 90 / boardBox.height, 0.003, 'drag moves by the pointer distance (y)');

const rBox = await widget('clock').locator('.w-resize').boundingBox();
await page.mouse.move(rBox.x + 9, rBox.y + 9);
await page.mouse.down();
await page.mouse.move(rBox.x + 9 + 70, rBox.y + 9 + 35, { steps: 5 });
await page.mouse.up();
await settle(page, 450);
const afterResize = (await cur()).widgets.find((w) => w.type === 'clock');
near(afterResize.w, afterDrag.w + 70 / boardBox.width, 0.003, 'corner drag resizes width');
near(afterResize.h, afterDrag.h + 35 / boardBox.height, 0.003, 'corner drag resizes height');

// dragging far off the board is clamped back on
await grip.focus();
for (let i = 0; i < 150; i++) await page.keyboard.press('ArrowLeft');
await settle(page, 450);
eq((await cur()).widgets.find((w) => w.type === 'clock').x, 0, 'cannot leave the board');

// clicking a widget brings it to the front
await widget('text').locator('textarea').click();
const zs = (await cur()).widgets;
const textZ = zs.find((w) => w.type === 'text').z;
ok(zs.every((w) => w.type === 'text' || w.z < textZ), 'clicked widget is on top');

// ── timer to zero ────────────────────────────────────────────────────
const timer = widget('timer');
eq(await timer.locator('.big-text').textContent(), '5:00', 'timer defaults to 5:00');
await timer.getByRole('button', { name: '1 min' }).click();
eq(await timer.locator('.big-text').textContent(), '1:00', 'preset sets 1:00');
await timer.getByLabel('Set time, minutes or m:ss').fill('nonsense');
await timer.getByRole('button', { name: 'Set', exact: true }).click();
ok(await timer.locator('.err-note').isVisible(), 'bad custom time explains itself');
await timer.getByLabel('Set time, minutes or m:ss').fill('2s');
await timer.getByRole('button', { name: 'Set', exact: true }).click();
ok(await timer.locator('.err-note').isHidden(), 'error clears on a good time');
eq(await timer.locator('.big-text').textContent(), '0:02', 'custom 2s');
await timer.getByRole('button', { name: 'Start', exact: true }).click();
await settle(page, 300);
ok((await cur()).widgets.find((w) => w.type === 'timer').data.endsAt > 0, 'running timer saves its end time');
await page.waitForFunction(() => document.querySelector('.w[data-type="timer"]').classList.contains('timer-done'), null, { timeout: 5000 }).catch(() => {});
ok(await timer.evaluate((n) => n.classList.contains('timer-done')), 'timer flags done at zero');
eq(await timer.locator('.big-text').textContent(), '0:00', 'timer shows 0:00');
eq(await timer.locator('[aria-live="assertive"]').textContent(), 'Time is up.', 'time-up is announced');
ok(await timer.getByRole('button', { name: 'Restart' }).isVisible(), 'button offers Restart');

// ── stopwatch ────────────────────────────────────────────────────────
const sw = widget('stopwatch');
await sw.getByRole('button', { name: 'Start', exact: true }).click();
await settle(page, 700);
await sw.getByRole('button', { name: 'Pause', exact: true }).click();
const swText = await sw.locator('.big-text').textContent();
ok(/^0:00\.[5-9]$|^0:01\.\d$/.test(swText), `stopwatch counted about 0.7 s (${swText})`);
await settle(page, 400);
eq(await sw.locator('.big-text').textContent(), swText, 'paused stopwatch holds');

// ── clock ────────────────────────────────────────────────────────────
ok(/\d:\d\d/.test(await widget('clock').locator('.big-text').textContent()), 'clock shows a time');
await widget('clock').getByLabel('Date').uncheck();
ok(await widget('clock').locator('.big-date').isHidden(), 'date can be hidden');

// ── YouTube ──────────────────────────────────────────────────────────
const yt = widget('youtube');
await yt.getByLabel('YouTube link').fill('https://vimeo.com/12345');
await yt.getByRole('button', { name: 'Show video' }).click();
ok(await yt.locator('.err-note').isVisible(), 'non-YouTube link refused');
eq(await yt.locator('iframe').count(), 0, 'no frame for a refused link');
await yt.getByLabel('YouTube link').fill(`https://youtu.be/${ID}?t=1m5s`);
await yt.getByLabel('YouTube link').press('Enter');
const src = await yt.locator('iframe').getAttribute('src');
eq(src, `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1&start=65`, 'frame points at youtube-nocookie with the start time');
eq(await yt.locator('iframe').getAttribute('title'), 'YouTube video', 'frame has a title');
// The frame's request goes out a beat after it is inserted; poll for it.
for (let i = 0; i < 30 && !page.__blocked.some((u) => u.includes('youtube-nocookie.com')); i++) await settle(page, 100);
ok(page.__blocked.some((u) => u.includes('youtube-nocookie.com')), 'the only offsite request is the video (and the harness blocked it)');
ok(page.__blocked.every((u) => /youtube-nocookie\.com|youtube\.com|ytimg|google/.test(u)), `nothing else went offsite: ${page.__blocked.filter((u) => !/youtube/.test(u)).join(', ')}`);

await page.context().setOffline(true);
await settle(page, 300);
ok(await yt.getByText('This video needs the internet').isVisible(), 'offline shows a needs-internet card');
eq(await yt.locator('iframe').count(), 0, 'no broken frame offline');
await page.context().setOffline(false);
await settle(page, 300);
eq(await yt.locator('iframe').count(), 1, 'frame returns when back online');

// ── traffic light ────────────────────────────────────────────────────
await widget('traffic').getByRole('button', { name: /^Red/ }).click();
eq(await widget('traffic').getByRole('button', { name: /^Red/ }).getAttribute('aria-pressed'), 'true', 'red pressed');
eq(await widget('traffic').locator('.light-label').textContent(), 'Stop', 'label says Stop');

// ── name picker ──────────────────────────────────────────────────────
const np = widget('names');
eq(await np.getByLabel('Class roster').inputValue(), 'Period 3', 'roster picked up from np_rosters');
const picks = [];
for (let i = 0; i < 3; i++) {
  await np.getByRole('button', { name: 'Pick', exact: true }).click();
  picks.push(await np.locator('.big-name').textContent());
}
eq([...picks].sort(), [...ROSTER['Period 3']].sort(), 'three picks, no repeats');
eq(await np.locator('.note').textContent(), '0 of 3 left', 'counts down');
const savedNames = JSON.stringify((await cur()).widgets.find((w) => w.type === 'names').data);
eq(savedNames, '{"roster":"Period 3"}', 'picks are not saved, only the roster name');

// ── dice ─────────────────────────────────────────────────────────────
await widget('dice').getByLabel('Number of dice').selectOption('3');
eq(await widget('dice').locator('.die').count(), 3, 'three dice');
await widget('dice').getByRole('button', { name: 'Roll', exact: true }).click();
const faces = (await cur()).widgets.find((w) => w.type === 'dice').data.values;
ok(faces.length === 3 && faces.every((v) => v >= 1 && v <= 6), `rolled three faces ${faces}`);
ok(/^Rolled /.test(await widget('dice').locator('.note').textContent()), 'roll announced');
eq(await widget('dice').locator('.pip').count(), faces.reduce((a, b) => a + b, 0), 'one pip per point');
const pipBox = await widget('dice').locator('.pip').first().boundingBox();
ok(pipBox && pipBox.width > 3 && pipBox.height > 3, 'pips are drawn at a visible size');

// ── accessibility of a full board ────────────────────────────────────
const violations = await a11yScan(page);
ok(violations.length === 0, 'axe: no serious/critical violations: ' + violations.map((v) => `${v.id} ${v.nodes.slice(0, 3).join(' ')}`).join('; '));

// ── reload restores everything, at another window size ───────────────
await settle(page, 450);
const savedBefore = await st();
await page.setViewportSize({ width: 1000, height: 700 });
await page.reload();
await settle(page, 300);
eq(await page.locator('#board .w').count(), 8, 'eight widgets after reload');
eq(await st(), savedBefore, 'state identical after reload');
const clockEl = await widget('clock').boundingBox();
const b2 = await page.locator('#board').boundingBox();
const clockSaved = savedBefore.screens[0].widgets.find((w) => w.type === 'clock');
near((clockEl.x - b2.x) / b2.width, clockSaved.x, 0.005, 'position is a fraction of the board at a new size');
eq(await widget('text').locator('textarea').inputValue(), 'Warm-up: page 42 <b>not bold</b>', 'text restored as text');
eq(await widget('youtube').locator('iframe').count(), 1, 'video restored');
eq(await widget('traffic').getByRole('button', { name: /^Red/ }).getAttribute('aria-pressed'), 'true', 'light restored');

// ── remove and undo ──────────────────────────────────────────────────
await widget('dice').getByRole('button', { name: 'Remove Dice' }).click();
eq(await page.locator('#board .w').count(), 7, 'removed');
ok(await page.locator('#toast').isVisible(), 'toast offers undo');
await page.click('#toastUndo');
eq(await page.locator('#board .w').count(), 8, 'undo brings it back');
eq((await cur()).widgets.find((w) => w.type === 'dice').data.count, 3, 'with its settings');

// ── screens ──────────────────────────────────────────────────────────
page.__promptAnswer = 'Period 5';
await page.click('#newScreenBtn');
eq(await page.locator('#board .w').count(), 0, 'new screen is empty');
eq(await page.locator('#screenSelect option:checked').textContent(), 'Period 5', 'new screen named and selected');
await page.click('#dock button[data-add="clock"]');
const s1 = (await st()).screens[0].id;
await page.selectOption('#screenSelect', s1);
eq(await page.locator('#board .w').count(), 8, 'switching back shows the first screen');
page.__promptAnswer = undefined;
await page.click('#dupScreenBtn');
eq((await st()).screens.length, 3, 'duplicate adds a screen');
eq(await page.locator('#board .w').count(), 8, 'the copy has every widget');
const ids = (await st()).screens.flatMap((s) => s.widgets.map((w) => w.id));
eq(new Set(ids).size, ids.length, 'the copy has fresh widget ids');
await page.click('#deleteScreenBtn');
eq((await st()).screens.length, 2, 'delete removes the current screen');
await page.click('#clearScreenBtn');
eq(await page.locator('#board .w').count(), 0, 'clear empties the screen');
await page.click('#toastUndo');
eq(await page.locator('#board .w').count(), 8, 'clear can be undone');

// ── bad storage never breaks the page ─────────────────────────────────
await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"data":{"screens":[{"widgets":[{"type":"text","x":"a","data":{"text":5}}]}]}}'), KEY);
await page.reload();
await settle(page, 300);
eq(await page.locator('#board .w').count(), 1, 'a malformed save still loads what it can');
await page.evaluate((k) => localStorage.setItem(k, 'not json'), KEY);
await page.reload();
await settle(page, 300);
ok(await page.locator('#boardEmpty').isVisible(), 'an unreadable save gives an empty board');

// ── phone width: no sideways scroll ──────────────────────────────────
await page.setViewportSize({ width: 375, height: 740 });
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 375px');

eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
