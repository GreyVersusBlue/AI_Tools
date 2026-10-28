// smoke-undo.mjs — the Group / Team Generator's Undo on _shared/undo.js (Path 14 P5).
//
//   node Tools/group-team-generator/test/smoke-undo.mjs
//
// Undo used to hold one snapshot: one step back, then nothing. It keeps a
// stack now. What this holds down:
//
//   The first Make Groups has nothing behind it, so Undo stays grey.
//   One reshuffle, one undo returns to the earlier grouping and the button
//   goes grey again, exactly as the single snapshot behaved.
//   Three reshuffles undo in reverse order, each landing on the grouping that
//   was on screen before the next one, with the button live until the stack
//   is empty.
//   Switching to another class starts a new stack.
//   No console errors; nothing leaves the site.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8564;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

const CLASS = Array.from({ length: 24 }, (_, i) => `Student ${String(i + 1).padStart(2, '0')}`);

const shown = () => page.evaluate(() => document.getElementById('results').innerText.replace(/\s+/g, ' ').trim());
const undoDisabled = () => page.evaluate(() => document.getElementById('undo-btn').disabled);
const make = async () => { await page.click('#generate-btn'); await settle(page, 300); };
const reshuffle = async () => { await page.click('#regenerate-btn'); await settle(page, 300); };
const undo = async () => { await page.click('#undo-btn'); await settle(page, 300); };

console.log('Group / Team Generator — multi-step undo');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#names-input', CLASS.join('\n'));
await page.dispatchEvent('#names-input', 'input');
await page.fill('#split-value', '4');
await settle(page, 300);

/* ── 1. the first grouping has nothing behind it; one reshuffle, one undo ── */
ok(await undoDisabled(), 'Undo is grey before any grouping');
await make();
const g0 = await shown();
ok(g0.includes('Student'), 'Make Groups shows groups');
ok(await undoDisabled(), 'Undo is still grey after the first grouping');
await reshuffle();
ok(!(await undoDisabled()), 'Undo is live after a reshuffle');
await undo();
eq(await shown(), g0, 'one undo goes back to the first grouping');
ok(await undoDisabled(), 'and Undo is grey again');

/* ── 2. three reshuffles undo in reverse order ──────────────────────────── */
await reshuffle(); const s1 = await shown();
await reshuffle(); const s2 = await shown();
await reshuffle(); const s3 = await shown();
ok(new Set([g0, s1, s2, s3]).size === 4, 'the groupings are all different');
await undo();
eq(await shown(), s2, 'first undo lands on the second reshuffle');
ok(!(await undoDisabled()), 'Undo is live with two steps behind');
await undo();
eq(await shown(), s1, 'second undo lands on the first reshuffle');
ok(!(await undoDisabled()), 'Undo is live: one step left');
await undo();
eq(await shown(), g0, 'third undo lands on the first grouping');
ok(await undoDisabled(), 'and Undo is grey once the stack is empty');

/* ── 3. another class starts a new stack ────────────────────────────────── */
await reshuffle(); await reshuffle();
ok(!(await undoDisabled()), 'two reshuffles leave Undo live');
page.once('dialog', d => d.accept('Second period'));
await page.click('#new-config-btn');
await settle(page, 400);
ok(await undoDisabled(), 'a new class clears the Undo stack');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
