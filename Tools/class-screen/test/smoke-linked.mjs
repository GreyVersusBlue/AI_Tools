// smoke-linked.mjs — 087 Class Screen, Path 22 P8 (linked widgets).
//
//   node Tools/class-screen/test/smoke-linked.mjs
//
// A timer can also flash the board, set the traffic light and tick the next
// agenda item when it runs out, chosen in its foot ("When it ends"). A timer
// with no link does nothing extra; a timer that ran out while the page was
// closed does not fire late; reduced motion gets a still ring, not a blink.
// There is no agenda widget yet (Path 22 P9), so its checkbox is absent and
// the flag is only kept. Nothing here uses a real name.
//
// Exits 1 on any failure.

/* global __classScreen -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8649;
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
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

console.log('Class Screen — linked widgets');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __classScreen.state());
const cur = async () => { const s = await st(); return s.screens.find((x) => x.id === s.current); };
const widget = (type) => page.locator(`#board .w[data-type="${type}"]`);
const timerData = async () => (await cur()).widgets.find((w) => w.type === 'timer').data;
const lightNow = async () => (await cur()).widgets.find((w) => w.type === 'traffic').data.light;
const flashing = () => page.evaluate(() => document.getElementById('board').classList.contains('flash'));
const flashWaitStart = () => page.waitForFunction(() => document.getElementById('board').classList.contains('flash'), null, { timeout: 6000 }).then(() => true, () => false);
const flashWaitEnd = () => page.waitForFunction(() => !document.getElementById('board').classList.contains('flash'), null, { timeout: 8000 }).then(() => true, () => false);
const ring = () => page.evaluate(() => { const c = getComputedStyle(document.getElementById('board'), '::after'); return { w: c.borderTopWidth, anim: c.animationName }; });
async function runTimer(seconds) {
  const t = widget('timer');
  await t.getByLabel('Set time, minutes or m:ss').fill(seconds + 's');
  await t.getByRole('button', { name: 'Set', exact: true }).click();
  await t.getByRole('button', { name: 'Start', exact: true }).click();
}

await page.click('#dock button[data-add="timer"]');
await page.click('#dock button[data-add="traffic"]');
await settle(page, 300);
eq(await lightNow(), 'green', 'the light starts green');

// ── the controls ─────────────────────────────────────────────────────
const t = widget('timer');
const summary = t.locator('.w-link summary');
eq(await summary.textContent(), 'When it ends', 'the foot offers "When it ends"');
await summary.click();
ok(await t.getByLabel('Set the traffic light when time is up').isVisible(), 'its choices open');
ok(await t.getByLabel('Flash the board').isVisible(), 'with a flash choice');
eq(await t.getByText('Tick the next agenda item').count(), 0, 'and no agenda choice while there is no agenda widget (P9)');
const v = await a11yScan(page);
eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], 'axe: no serious violations with the choices open');

// ── an unlinked timer does nothing extra ─────────────────────────────
await runTimer(2);
await page.waitForFunction(() => document.querySelector('.w[data-type="timer"]').classList.contains('timer-done'), null, { timeout: 6000 }).catch(() => {});
ok(await t.evaluate((n) => n.classList.contains('timer-done')), 'the timer itself still flags done');
ok(!(await flashing()), 'no board flash without a link');
eq(await lightNow(), 'green', 'and the light is left alone');
ok(!('link' in (await timerData())), 'and the saved timer has no link field');

// ── flash ────────────────────────────────────────────────────────────
await t.getByLabel('Flash the board').check();
eq(await summary.textContent(), 'When it ends: flash', 'the summary says what is on');
await settle(page, 400);
eq((await timerData()).link, { flash: true, light: '', agenda: false }, 'the choice is saved on the timer');
await runTimer(2);
ok(await flashWaitStart(), 'the board flashes when the timer runs out');
eq((await ring()).w, '14px', 'as a ring round the board');
ok((await ring()).anim !== 'none', 'that blinks');
eq(await lightNow(), 'green', 'the light is still left alone');
ok(await flashWaitEnd(), 'and the flash ends by itself');

// ── reduced motion: a still ring ─────────────────────────────────────
await page.emulateMedia({ reducedMotion: 'reduce' });
await runTimer(2);
ok(await flashWaitStart(), 'reduced motion: the board still shows the flash');
eq(await ring(), { w: '14px', anim: 'none' }, 'as a ring that holds still');
ok(await flashWaitEnd(), 'and goes away');
await page.emulateMedia({ reducedMotion: 'no-preference' });

// ── the light ────────────────────────────────────────────────────────
await t.getByLabel('Flash the board').uncheck();
await t.getByLabel('Set the traffic light when time is up').selectOption('red');
eq(await summary.textContent(), 'When it ends: light', 'the summary follows');
await runTimer(2);
await page.waitForFunction(() => document.querySelector('.w[data-type="timer"]').classList.contains('timer-done'), null, { timeout: 6000 }).catch(() => {});
await settle(page, 400);
eq(await lightNow(), 'red', 'the traffic light turns red when the timer ends');
ok(!(await flashing()), 'with no flash, since flash is off');
eq(await widget('traffic').locator('.light.red').getAttribute('aria-pressed'), 'true', 'and the widget shows it');

// pausing does not fire; running out does, again, after a restart
await widget('traffic').getByRole('button', { name: /^Green/ }).click();
eq(await lightNow(), 'green', 'back to green by hand');
await t.getByLabel('Set time, minutes or m:ss').fill('30s');
await t.getByRole('button', { name: 'Set', exact: true }).click();
await t.getByRole('button', { name: 'Start', exact: true }).click();
await t.getByRole('button', { name: 'Pause', exact: true }).click();
await settle(page, 400);
eq(await lightNow(), 'green', 'pausing a linked timer fires nothing');

// ── survives a reload, and a timer that ran out while closed stays quiet ──
await page.reload();
await settle(page, 400);
eq((await timerData()).link, { flash: false, light: 'red', agenda: false }, 'the link is still on after a reload');
await page.locator('.w[data-type="timer"] .w-link summary').click();
eq(await page.locator('.w[data-type="timer"]').getByLabel('Set the traffic light when time is up').inputValue(), 'red', 'and the control shows it');
await page.evaluate(([k]) => {
  const s = JSON.parse(localStorage.getItem(k));
  const w = s.data.screens[0].widgets.find((x) => x.type === 'timer');
  w.data.endsAt = Date.now() - 60000; w.data.link = { flash: true, light: 'red', agenda: false };
  localStorage.setItem(k, JSON.stringify(s));
}, [KEY]);
await page.reload();
await settle(page, 1200);
ok(!(await flashing()), 'a timer that ran out while the page was closed does not flash late');
eq(await lightNow(), 'green', 'and does not move the light');

// ── a link with no target is quiet ───────────────────────────────────
await page.locator('.w[data-type="traffic"] .w-close').click();
await runTimer(2);
await page.waitForFunction(() => document.querySelector('.w[data-type="timer"]').classList.contains('timer-done'), null, { timeout: 6000 }).catch(() => {});
ok(await flashWaitStart(), 'with no traffic light on the screen the flash still happens');

// ── the agenda flag is kept for P9 ───────────────────────────────────
await settle(page, 600);   // let the page's own save land first, or its pagehide save would overwrite the edit below
await page.evaluate(([k]) => {
  const s = JSON.parse(localStorage.getItem(k));
  s.data.screens[0].widgets.find((x) => x.type === 'timer').data.link = { flash: false, light: '', agenda: true };
  localStorage.setItem(k, JSON.stringify(s));
}, [KEY]);
await page.reload();
await settle(page, 400);
await runTimer(2);
await settle(page, 600);
await page.click('#presentBtn');
ok(!(await page.locator('.w-link').first().isVisible()), 'present mode hides the link choices');
await page.click('#presentExit');
eq((await timerData()).link, { flash: false, light: '', agenda: true }, 'an agenda link survives a reload on a page with no agenda widget');

// ── width ────────────────────────────────────────────────────────────
for (const width of [375, 360]) {
  await page.setViewportSize({ width, height: 740 });
  await settle(page, 200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no horizontal scroll at ${width}px`);
}

eq(page.__errs, [], 'no page or console errors');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
