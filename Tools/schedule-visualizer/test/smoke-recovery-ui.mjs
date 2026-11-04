// smoke-recovery-ui.mjs — 035's recovery manager after it moved out of the page into
// schedule-visualizer/sv-recovery-ui.js (Path 11 P2, rank 140, eighth increment).
//
//   node Tools/schedule-visualizer/test/smoke-recovery-ui.mjs
//   (or: npm run test:layout-recovery-ui)
//
// smoke-recovery.mjs holds the ring and the two banners that offer a point. This holds the wiring
// that moved: the module's exports are on window beside SVRecovery, and init() ran from the page
// (the session marker is set, the Settings list is drawn); markDirty() is what lets an unforced
// capture through, and a capture already under way refuses a second; a capture that cannot
// serialize returns null and breaks nothing; pagehide captures as 'leaving' and clears the session
// marker; the five-minute timer captures only when something changed; an unreadable save with an
// empty ring gets the banner with no Restore button, and Dismiss hides it; a point that cannot be
// read says so; the Settings list's Restore asks first, does nothing on Cancel and restores on OK;
// formatRecoveryTime() gives a time today and a date before that. Exits 1 on any failure.

/* global applyFullProject, roomRegistry -- 035's globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8697;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const onboarded = () => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } };
const waitReady = (page) => page.waitForFunction(() => !!(window.SVRecovery && window.RecoveryManager), null, { timeout: 10000 });
const points = (page) => page.evaluate(() => window.SVRecovery.listPointHeaders());
const bannerShown = (page) => page.evaluate(() => {
  const el = document.getElementById('stviz-recovery-offer');
  return el && el.style.display !== 'none' ? el.textContent : null;
});
/** The Settings tab is not open, so press the list's newest Restore button from the page. */
const pressRestore = (page) => page.evaluate(() => document.querySelector('#recovery-list [data-recovery-restore]').click());
/** Polls from Node, so it works under the page's fake clock too. */
async function until(page, fn, arg, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(fn, arg)) return true;
    await settle(page, 100);
  }
  return false;
}

const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.context().addInitScript(onboarded);
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await waitReady(page);
await settle(page, 500);
console.log('School Layout Visualizer: the recovery manager (sv-recovery-ui.js)');

console.log('1. the module is on window and init() ran');
eq(await page.evaluate(() => [typeof window.SVRecoveryUI, window.SVRecoveryUI.RecoveryManager === window.RecoveryManager,
  typeof window.formatRecoveryTime, window.RECOVERY_INTERVAL_MS, window.RecoveryManager.api === window.SVRecovery]),
['object', true, 'function', 300000, true], 'RecoveryManager, formatRecoveryTime and the interval are the module\'s, and api is the ring');
ok(await page.evaluate(() => !!localStorage.getItem(window.SVRecovery.SESSION_KEY)), 'init() marked the session open');
ok(await page.evaluate(() => window.RecoveryManager._timer !== null), 'init() started the periodic timer');
ok(/No recovery points yet/.test(await page.textContent('#recovery-list')), 'init() drew the Settings list');

console.log('2. markDirty, the dirty check and the one-at-a-time guard');
await page.evaluate((p) => { applyFullProject(p); }, fixtureProject());
await settle(page, 300);
const rooms = await page.evaluate(() => roomRegistry.length);
await page.evaluate(() => { window.RecoveryManager._dirty = false; });
eq(await page.evaluate(() => window.RecoveryManager.capture('periodic').then(r => !!r)), false, 'an unforced capture with nothing changed writes nothing');
eq((await points(page)).length, 0, 'and the ring is still empty');
await page.evaluate(() => window.RecoveryManager.markDirty());
eq(await page.evaluate(() => window.RecoveryManager.capture('periodic').then(r => !!r)), true, 'after markDirty() an unforced capture writes a point');
const p1 = await points(page);
eq([p1.length, p1[0] && p1[0].reason, p1[0] && p1[0].rooms], [1, 'periodic', rooms], 'one point, its reason and its room count');
eq(await page.evaluate(() => window.RecoveryManager._dirty), false, 'the capture clears the dirty flag');
eq(await page.evaluate(() => Promise.all([window.RecoveryManager.capture('a', true), window.RecoveryManager.capture('b', true)])
  .then(rs => rs.map(r => !!r))), [true, false], 'a second capture while one is under way is refused');
ok(/room/.test(await page.textContent('#recovery-list')), 'a capture redraws the Settings list');

console.log('3. a capture that cannot serialize');
const broken = await page.evaluate(() => {
  const real = window.serializeFullProject;
  window.serializeFullProject = () => { throw new Error('boom'); };
  return window.RecoveryManager.capture('x', true).then(r => { window.serializeFullProject = real; return [r, window.RecoveryManager._capturing]; });
});
eq(broken, [null, false], 'it returns null and leaves the guard open');

console.log('4. pagehide');
const before = (await points(page)).length;
await page.evaluate(() => { window.RecoveryManager.markDirty(); window.dispatchEvent(new Event('pagehide')); });
ok(await until(page, (n) => window.SVRecovery.listPointHeaders().then(ps => ps.length > n && ps[0].reason === 'leaving'), before), 'pagehide captures a point as "leaving"');
eq(await page.evaluate(() => localStorage.getItem(window.SVRecovery.SESSION_KEY)), null, 'and clears the session marker');

console.log('5. a point that cannot be read, and the list\'s Restore');
const toasts = await page.evaluate(() => {
  window.__toasts = [];
  const real = window.showToast;
  window.showToast = function (m, t) { window.__toasts.push([t, m]); return real.apply(this, arguments); };
  return window.RecoveryManager.restore('no-such-point').then(r => [r, window.__toasts.slice()]);
});
eq(toasts[0], false, 'restoring a missing point returns false');
ok(toasts[1].some(([t, m]) => t === 'error' && /could not be read/.test(m)), 'and says the point could not be read');
await page.evaluate(() => { applyFullProject({ blueprint: { floors: [{ id: 'floor_0', label: 'Floor 1', gridCols: 5, gridRows: 5, cells: [] }], crossFloorPairs: [] }, groups: [] }); });
await settle(page, 300);
eq(await page.evaluate(() => roomRegistry.length), 0, 'the plan on screen is now empty');
await page.evaluate(() => window.RecoveryManager.renderList());
await settle(page, 300);
// first press: Cancel
await page.evaluate(() => { window.__answer = false; window.confirm = (m) => { window.__asked = m; return window.__answer; }; });
const nBefore = (await points(page)).length;
await pressRestore(page);
await settle(page, 400);
ok(await page.evaluate(() => /captured as a recovery point first/.test(window.__asked || '')), 'Restore asks first, and says the current project is captured');
eq([await page.evaluate(() => roomRegistry.length), (await points(page)).length], [0, nBefore], 'Cancel restores nothing and captures nothing');
// second press: OK, on the newest point (the fixture, captured on pagehide)
await page.evaluate(() => { window.__answer = true; });
await pressRestore(page);
ok(await until(page, (n) => roomRegistry.length === n, rooms), 'OK restores the point: the rooms are back');
ok(await page.evaluate(() => window.__toasts.some(([t, m]) => t === 'success' && /^Recovered the project from /.test(m))), 'and says so');
ok((await points(page)).some(p => p.reason === 'before restore'), 'the project being replaced was captured first');

console.log('6. formatRecoveryTime');
const fmt = await page.evaluate(() => {
  const now = new Date(); const old = new Date(now.getTime() - 3 * 86400000);
  return [window.formatRecoveryTime(now.toISOString()), window.formatRecoveryTime(old.toISOString()),
    now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    old.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })];
});
eq(fmt[0], fmt[2], 'today is the time alone');
ok(fmt[1].startsWith(fmt[3] + ' '), `an older point leads with its date (${fmt[1]})`);
eq(page.__errs.length, 0, 'no page errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
await page.context().close();

console.log('7. an unreadable save with an empty ring');
const p2 = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await p2.context().addInitScript(() => {
  try { localStorage.setItem('stviz_onboarded', '1'); localStorage.setItem('stviz_blueprint', '{"cells":[{'); } catch (e) { /* blocked */ }
});
await p2.goto(URL_PAGE, { waitUntil: 'networkidle' });
await waitReady(p2);
await settle(p2, 800);
const b = await bannerShown(p2);
ok(b && /no recovery point to fall back on/.test(b), 'the banner says there is nothing to fall back on: ' + JSON.stringify(b));
eq(await p2.evaluate(() => [!!document.getElementById('stviz-recovery-restore'), !!document.getElementById('stviz-recovery-dismiss'),
  document.getElementById('stviz-recovery-offer').getAttribute('role')]), [false, true, 'alert'], 'no Restore button, a Dismiss button, role alert');
await p2.click('#stviz-recovery-dismiss');
eq(await bannerShown(p2), null, 'Dismiss hides it');
await p2.context().close();

console.log('8. the five-minute timer');
const p3 = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await p3.context().addInitScript(onboarded);
await p3.clock.install();
await p3.goto(URL_PAGE, { waitUntil: 'load' });
await waitReady(p3);
await p3.clock.runFor(2000);
await p3.evaluate((p) => { applyFullProject(p); }, fixtureProject());
await p3.clock.runFor(2000);
await p3.evaluate(() => { window.RecoveryManager._dirty = false; window.SVRecovery.clearPoints(); });
await p3.clock.runFor(5 * 60 * 1000);
await settle(p3, 400);
eq((await points(p3)).length, 0, 'five minutes with nothing changed takes no point');
await p3.evaluate(() => window.RecoveryManager.markDirty());
await p3.clock.runFor(4 * 60 * 1000);
await settle(p3, 400);
eq((await points(p3)).length, 0, 'a change, four minutes later: not yet');
await p3.clock.runFor(60 * 1000 + 100);
ok(await until(p3, () => window.SVRecovery.listPointHeaders().then(ps => ps.length === 1 && ps[0].reason === 'periodic')), 'at five minutes the timer takes a periodic point');
await p3.context().close();

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
