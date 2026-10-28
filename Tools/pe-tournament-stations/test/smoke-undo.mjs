// smoke-undo.mjs — the PE Tournament & Stations Undo on _shared/undo.js (Path 14 P5).
//
//   node Tools/pe-tournament-stations/test/smoke-undo.mjs
//
// Undo used to hold one snapshot of the unit, taken before Reset or New unit.
// It keeps a stack now. What this holds down:
//
//   Undo is grey until a Reset; one Reset, one Undo puts the rotation back
//   and the button goes grey again, as the single snapshot behaved.
//   Two Resets undo in reverse order, each landing on the rotation that was
//   showing before it, with the button live until the stack is empty.
//   Switching to another unit starts a new stack.
//   No console errors; nothing leaves the site.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8565;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/021-pe-tournament-stations.html';

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

const sub = () => page.evaluate(() => document.getElementById('stageSub').textContent.trim());
const undoDisabled = () => page.evaluate(() => document.getElementById('undoBtn').disabled);
const click = async (id) => { await page.click('#' + id); await settle(page, 200); };

console.log('PE Tournament & Stations — multi-step undo');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => { window.confirm = () => true; window.prompt = () => 'Second unit'; });
await settle(page, 300);

/* ── 1. Undo is grey; one Reset, one Undo ─────────────────────────────────── */
ok(await undoDisabled(), 'Undo is grey before any Reset');
await click('startBtn');
await click('rotateNowBtn');
eq(await sub(), 'Rotation 2', 'Rotate now moves to rotation 2');
await click('resetRotationBtn');
eq(await sub(), 'Rotation 1', 'Reset goes back to rotation 1');
ok(!(await undoDisabled()), 'Undo is live after a Reset');
await click('undoBtn');
eq(await sub(), 'Rotation 2', 'one Undo puts rotation 2 back');
ok(await undoDisabled(), 'and Undo is grey again');

/* ── 2. two Resets undo in reverse order ──────────────────────────────────── */
await click('resetRotationBtn');                       // snapshot: rotation 2
await click('startBtn');
await click('rotateNowBtn'); await click('rotateNowBtn');
eq(await sub(), 'Rotation 3', 'two Rotate nows reach rotation 3');
await click('resetRotationBtn');                       // snapshot: rotation 3
await click('undoBtn');
eq(await sub(), 'Rotation 3', 'first Undo lands on rotation 3');
ok(!(await undoDisabled()), 'Undo is live: one step left');
await click('undoBtn');
eq(await sub(), 'Rotation 2', 'second Undo lands on rotation 2');
ok(await undoDisabled(), 'and Undo is grey once the stack is empty');

/* ── 3. another unit starts a new stack ───────────────────────────────────── */
await click('resetRotationBtn'); await click('resetRotationBtn');
ok(!(await undoDisabled()), 'two Resets leave Undo live');
await click('newProjectBtn');
ok(!(await undoDisabled()), 'New unit adds its own step');
await page.selectOption('#projectSwitch', { index: 0 });
await settle(page, 300);
ok(await undoDisabled(), 'switching unit clears the Undo stack');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
