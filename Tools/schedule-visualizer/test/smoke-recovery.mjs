// smoke-recovery.mjs — automatic recovery points for the School Layout
// Visualizer.
//
//   node Tools/schedule-visualizer/test/smoke-recovery.mjs
//
// The blueprint is the largest and most laboriously built artifact on the
// site, and until this feature the only thing standing between a teacher and
// losing it was one localStorage key that the loader gave up on with a console
// warning. What this suite holds down is exactly the paths that only fail on
// the day something has already gone wrong:
//
//   - a recovery point is really written to IndexedDB, with a readable header
//   - three generations are kept and the fourth evicts the oldest
//   - a session that never reached pagehide is detected on the next open and
//     offered the newest point
//   - an unreadable autosave is detected, quarantined instead of overwritten,
//     and recovered from the ring
//   - restoring actually puts the rooms and groups back
//
// It reuses the schedule suite's Northwind fixture rather than inventing a
// second fake school. Exits 1 on any failure.

/* global applyFullProject, roomRegistry -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from '../../schedule/test/fixture-northwind.mjs';

const PORT = 8154;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

// A real crash leaves the session-open marker behind because pagehide never
// ran. Playwright can't kill a tab without also losing the IndexedDB this
// suite has to read afterwards, so the marker is planted at document start
// instead — before the app's boot code reads it, and after the previous
// page's pagehide handler has already cleared the real one. Armed by the
// test with a one-shot key so it only fires for the navigation that wants it.
await page.context().addInitScript(() => {
  try {
    // Skip the first-run onboarding modal — it's modal, so it would sit on top
    // of the recovery banner this suite has to click. A real first run has no
    // recovery points to be offered, so the two never collide in practice.
    localStorage.setItem('stviz_onboarded', '1');
    if (localStorage.getItem('__test_arm_crash') === '1') {
      localStorage.removeItem('__test_arm_crash');
      localStorage.setItem('STVIZ_SESSION_OPEN_v1',
        JSON.stringify({ at: new Date(Date.now() - 60000).toISOString() }));
    }
  } catch (e) { /* storage blocked */ }
});

/** Waits until the page's recovery module has been wired up. */
const waitReady = () => page.waitForFunction(() => !!(window.SVRecovery && window.RecoveryManager), null, { timeout: 10000 });

/** Recovery-point headers straight out of the page's own API. */
const points = () => page.evaluate(() => window.SVRecovery.listPointHeaders());

const bannerText = () => page.evaluate(() => {
  const el = document.getElementById('stviz-recovery-offer');
  return el && el.style.display !== 'none' ? el.textContent : null;
});

console.log('School Layout Visualizer — automatic recovery points');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await waitReady();
await settle(page, 600);

/* ── 1. a clean first run offers nothing and holds nothing ──────────────── */
eq((await points()).length, 0, 'a fresh browser has no recovery points');
eq(await bannerText(), null, 'no recovery banner on a clean first run');
ok(/No recovery points yet/.test(await page.textContent('#recovery-list')), 'the Settings list says so in words');

/* ── 2. load a real project and capture a point ─────────────────────────── */
await page.evaluate(project => { applyFullProject(project); }, fixtureProject());
await settle(page, 300);
const roomsNow = await page.evaluate(() => roomRegistry.length);
ok(roomsNow >= 10, `the fixture loaded (${roomsNow} rooms)`);

await page.evaluate(() => window.RecoveryManager.capture('periodic', true).then(r => !!r));
await settle(page, 400);
const p1 = await points();
eq(p1.length, 1, 'a forced capture writes one recovery point');
eq(p1[0].rooms, roomsNow, 'the point header records the room count');
ok(p1[0].sizeBytes > 1000, `the point carries a real payload (${p1[0].sizeBytes} bytes)`);
ok(/room/.test(await page.textContent('#recovery-list')), 'the Settings list renders the point');

/* ── 3. the ring is capped at three, oldest evicted ─────────────────────── */
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.RecoveryManager.capture('periodic', true).then(r => !!r));
  await settle(page, 250);
}
const p2 = await points();
eq(p2.length, 3, 'the ring holds three generations, not four');
ok(p2[0].savedAt >= p2[2].savedAt, 'newest first');

/* ── 4. an unchanged project does not spend a generation ────────────────── */
const beforeIds = (await points()).map(p => p.id).join(',');
await page.evaluate(() => window.RecoveryManager.capture('periodic').then(r => !!r));   // not forced, nothing dirty
await settle(page, 250);
eq((await points()).map(p => p.id).join(','), beforeIds, 'a periodic capture with no changes is skipped');

/* ── 5. a session that never closed cleanly is caught on the next open ─── */
await page.evaluate(() => { localStorage.setItem('__test_arm_crash', '1'); });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await waitReady();
await settle(page, 800);
const crashBanner = await bannerText();
ok(crashBanner && /wasn.t closed cleanly/.test(crashBanner), 'the crash banner explains what happened: ' + JSON.stringify(crashBanner));
ok(crashBanner && /room/.test(crashBanner), 'and says what the recovery point contains');

/* ── 6. restoring from the banner puts the project back ─────────────────── */
await page.evaluate(() => { window.confirm = () => true; });
await page.click('#stviz-recovery-restore');
await settle(page, 600);
eq(await page.evaluate(() => roomRegistry.length), roomsNow, 'restoring from the banner brings the rooms back');
eq(await bannerText(), null, 'the banner closes once the restore lands');

/* ── 7. an unreadable autosave is detected, quarantined, and recoverable ── */
await page.evaluate(() => {
  localStorage.setItem('stviz_blueprint', '{"cells":[{"col":0,'); // truncated mid-write
  localStorage.removeItem('STVIZ_SESSION_OPEN_v1');               // a clean close, so only corruption is in play
});
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await waitReady();
await settle(page, 800);
const corruptBanner = await bannerText();
ok(corruptBanner && /could not be read/.test(corruptBanner), 'the corrupt-autosave banner says the layout could not be read: ' + JSON.stringify(corruptBanner));
eq(await page.evaluate(() => localStorage.getItem('stviz_blueprint_unreadable')), '{"cells":[{"col":0,',
   'the unreadable payload is set aside instead of being overwritten');
await page.evaluate(() => { window.confirm = () => true; });
await page.click('#stviz-recovery-restore');
await settle(page, 600);
eq(await page.evaluate(() => roomRegistry.length), roomsNow, 'the project is recovered from the ring after a corrupt autosave');

/* ── 8. a restore is itself undoable ───────────────────────────────────── */
ok((await points()).some(p => p.reason === 'before restore'),
   'the state being replaced is captured first, so a restore can be undone');

/* ── 9. no console noise, nothing offsite ──────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
