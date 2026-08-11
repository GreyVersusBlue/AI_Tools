// smoke-strip.mjs — the Classroom Timer's ambient period strip.
//
//   node Tools/classroom-timer/test/smoke-strip.mjs
//
// The tool takes the whole screen, which is wrong for the case a teacher hits
// most days: slides are up, and all that is wanted is a thin bar saying how
// much of the period is left. A browser tab cannot be drawn on top of
// PowerPoint, so the honest version is a second window of this page in strip
// mode, resized thin and parked at the top of the screen.
//
// Two things make that work and both are checked here: strip mode really does
// collapse to one line (nothing else on screen, at any window height), and it
// follows the main window — the timer is started in one browser context and
// the strip in another has to show the same countdown, pause with it, and go
// quiet when it is reset.
//
// The follow channel is ct_running_v1, the key the timer already wrote so a
// reload could pick a countdown back up. Two Playwright contexts do not share
// localStorage, so the strip is driven in the SAME context as the main window,
// in a second page — which is exactly the real arrangement anyway.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8164;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/004-Classroom%20Timer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

console.log('Classroom Timer — ambient period strip');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. the button is there, and opens a strip window ──────────────────── */
ok(await page.$('#stripBtn'), 'the header offers an ambient strip');

/* ── 2. start a real countdown in the main window ──────────────────────── */
await page.fill('#cdMinutes', '5');
await page.fill('#cdSeconds', '0');
await page.click('#startBtn');
await settle(page, 900);
const running = await page.evaluate(() => JSON.parse(localStorage.getItem('ct_running_v1') || 'null'));
ok(running && running.phase.status === 'running', 'the countdown is running and persisted');
eq(running.mode, 'countdown', 'in countdown mode');

/* ── 3. the strip, in a second page of the same browser profile ────────── */
const strip = await page.context().newPage();
strip.__errs = [];
strip.on('pageerror', e => strip.__errs.push(String(e)));
strip.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) strip.__errs.push(m.text()); });
await strip.setViewportSize({ width: 1100, height: 170 });
await strip.goto(URL_PAGE + '?strip=1', { waitUntil: 'networkidle' });
await settle(strip, 900);

eq(await strip.evaluate(() => document.body.classList.contains('strip-mode')), true,
   'the ?strip=1 window is in strip mode');
eq(await strip.evaluate(() => document.getElementById('ambientStrip').hidden), false, 'the strip itself is shown');

/* Everything else has to be gone — the whole point is a window with nothing
   in it but the bar. */
const hidden = await strip.evaluate(() => {
  const gone = sel => {
    const el = document.querySelector(sel);
    if (!el) return true;
    const cs = getComputedStyle(el);
    return cs.display === 'none' || el.offsetParent === null;
  };
  return {
    header: gone('.app-header'), tabs: gone('.mode-tabs'),
    stage: gone('.timer-stage'), settings: gone('#modeSettings'),
  };
});
eq(hidden.header, true, 'the header is gone in strip mode');
eq(hidden.tabs, true, 'the mode tabs are gone');
eq(hidden.stage, true, 'the big ring and digits are gone');
eq(hidden.settings, true, 'and every settings panel');

/* ── 4. it shows the same countdown as the main window ─────────────────── */
const stripTime = await strip.textContent('#ambientTime');
ok(/^0[0-4]:\d\d$/.test(stripTime), `the strip is counting the same five minutes down (got ${stripTime})`);
eq(await strip.evaluate(() => document.getElementById('ambientStrip').classList.contains('live')), true,
   'and marks itself live');
const fill = await strip.evaluate(() => parseFloat(document.getElementById('ambientFill').style.width));
ok(fill > 80 && fill <= 100, `the bar is nearly full near the start of the period (got ${fill}%)`);

/* it keeps counting on its own */
const before = await strip.textContent('#ambientTime');
await settle(strip, 2200);
const after = await strip.textContent('#ambientTime');
ok(before !== after, `the strip ticks by itself (${before} -> ${after})`);

/* ── 5. it follows a pause, and a reset ────────────────────────────────── */
await page.click('#pauseBtn');
await settle(page, 300);
await strip.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ct_running_v1' })));
await settle(strip, 500);
ok(/Paused/.test(await strip.textContent('#ambientLabel')), 'a pause in the main window reaches the strip');
const pausedAt = await strip.textContent('#ambientTime');
await settle(strip, 1500);
eq(await strip.textContent('#ambientTime'), pausedAt, 'and the strip stops counting with it');

await page.click('#resetBtn');
await settle(page, 300);
await strip.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ct_running_v1' })));
await settle(strip, 500);
eq(await strip.textContent('#ambientTime'), '--:--', 'a reset leaves the strip blank rather than frozen');
eq(await strip.evaluate(() => document.getElementById('ambientStrip').classList.contains('live')), false,
   'and it drops out of live mode');
ok(await strip.isVisible('#ambientIdle'), 'with a line saying what to do next');

/* ── 6. an agenda names the segment on the strip ───────────────────────── */
await page.click('.mode-tab[data-mode="agenda"]');
await settle(page, 300);
const segInputs = await page.$$('.agenda-seg-row input[type="text"]');
if (segInputs.length) {
  await segInputs[0].fill('Do Now');
  await settle(page, 200);
}
await page.click('#startBtn');
await settle(page, 800);
await strip.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'ct_running_v1' })));
await settle(strip, 600);
const label = await strip.textContent('#ambientLabel');
ok(label && label.trim().length > 0, `the strip names what is running (got ${JSON.stringify(label)})`);
await page.click('#resetBtn');
await settle(page, 300);

/* ── 7. the strip is sized in vh, so a thin window still reads ─────────── */
await strip.setViewportSize({ width: 1100, height: 90 });
await settle(strip, 400);
const fits = await strip.evaluate(() => {
  const el = document.getElementById('ambientStrip');
  return { h: Math.round(el.getBoundingClientRect().height), overflow: document.body.scrollHeight - window.innerHeight };
});
ok(fits.h <= 90, `the whole strip fits a 90px-tall window (${fits.h}px)`);
ok(fits.overflow <= 1, `and nothing scrolls off it (${fits.overflow}px over)`);

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no errors in the main window: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(strip.__errs.length, 0, 'none in the strip window: ' + JSON.stringify(strip.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
