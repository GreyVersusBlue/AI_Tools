// smoke-presentation.mjs — 035's presentation-mode wiring after initPresentationMode() moved out of
// the page into schedule-visualizer/sv-presentation.js (Path 11 P2, rank 140, tenth increment).
//
//   node Tools/schedule-visualizer/test/smoke-presentation.mjs
//   (or: npm run test:layout-presentation)
//
// Holds the wiring that moved: the export is on window and is the page's; the Present button
// enters and the exit button leaves (body.presentation-mode); P toggles on the Visualize tab only,
// never from a field and never with Ctrl; Escape leaves; the play button starts and stops the
// auto-cycle timer and changing the interval while it runs restarts it; the mirrored legend
// follows #viz-legend-list through the observer. Exits 1 on any failure.

/* global PresentationMode, switchTab -- 035's page globals, read inside page.evaluate() */

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8704;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch { /* none */ } });
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 600);

const on = () => page.evaluate(() => document.body.classList.contains('presentation-mode'));
const timer = () => page.evaluate(() => PresentationMode._cycleTimer !== null);
const tab = (t) => page.evaluate((x) => { switchTab(x); }, t);

console.log('School Layout Visualizer: presentation mode (sv-presentation.js)');

console.log('1. the module is on window');
eq(await page.evaluate(() => [typeof window.initPresentationMode, typeof window.SVPresentation,
  window.SVPresentation.initPresentationMode === window.initPresentationMode]),
['function', 'object', true], 'initPresentationMode exported and copied onto window');

console.log('2. buttons');
await tab('visualize'); await settle(page, 200);
ok(!(await on()), 'at rest, presentation mode is off');
await page.click('#viz-present-btn');
ok(await on(), 'Present enters');
await page.click('#pres-exit');
ok(!(await on()), 'the exit button leaves');

console.log('3. keys');
await page.keyboard.press('p');
ok(await on(), 'P enters on the Visualize tab');
await page.keyboard.press('P');
ok(!(await on()), 'P again leaves');
await page.keyboard.press('Control+p').catch(() => {});
ok(!(await on()), 'Ctrl+P does not toggle');
await page.keyboard.press('p');
await page.keyboard.press('Escape');
ok(!(await on()), 'Escape leaves');
await page.keyboard.press('Escape');
ok(!(await on()), 'Escape when off does nothing');
// A press from a field is typing, not a toggle.
const fieldFocused = await page.evaluate(() => {
  const f = [...document.querySelectorAll('#panel-visualize select, #panel-visualize input')].find(e => e.offsetParent !== null && !e.disabled);
  if (f) f.focus();
  return !!f && document.activeElement === f;
});
ok(fieldFocused, 'a visible field on the Visualize tab took focus');
await page.keyboard.press('p');
ok(!(await on()), 'P from a field does not toggle');
await page.evaluate(() => document.activeElement.blur());
await tab('blueprint'); await settle(page, 150);
await page.keyboard.press('p');
ok(!(await on()), 'P on another tab does not toggle');
await tab('visualize'); await settle(page, 150);

console.log('4. auto-cycle controls');
await page.click('#viz-present-btn');
eq(await timer(), false, 'no timer at rest');
await page.click('#pres-cycle-play');
eq(await timer(), true, 'play starts the timer');
const t1 = await page.evaluate(() => PresentationMode._cycleTimer);
await page.evaluate(() => { const s = document.getElementById('pres-cycle-interval'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('change')); });
const t2 = await page.evaluate(() => PresentationMode._cycleTimer);
ok(t2 !== null && t2 !== t1, 'changing the interval while cycling restarts the timer');
await page.click('#pres-cycle-play');
eq(await timer(), false, 'play again stops it');
await page.evaluate(() => { const s = document.getElementById('pres-cycle-interval'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('change')); });
eq(await timer(), false, 'changing the interval while stopped starts nothing');

console.log('5. the mirrored legend');
await page.evaluate(() => { document.getElementById('viz-legend-list').innerHTML = '<span id="probe-legend">probe</span>'; });
await settle(page, 150);
eq(await page.evaluate(() => document.getElementById('pres-legend-list').innerHTML), '<span id="probe-legend">probe</span>', 'the observer mirrors a legend rewrite');
await page.click('#pres-exit');
ok(!(await on()), 'leaves');
await page.evaluate(() => { document.getElementById('viz-legend-list').innerHTML = '<span>later</span>'; });
await settle(page, 150);
ok(!(await page.evaluate(() => document.getElementById('pres-legend-list').innerHTML.includes('later'))), 'while off, the mirror is not touched');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
