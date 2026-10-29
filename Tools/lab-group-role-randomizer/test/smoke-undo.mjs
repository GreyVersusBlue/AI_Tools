// smoke-undo.mjs — "Undo last shuffle" on _shared/undo.js (Path 14 P5).
//
//   node Tools/lab-group-role-randomizer/test/smoke-undo.mjs
//
// The button used to hold one snapshot: one undo, then nothing. It now keeps a
// stack, so three shuffles can be walked back in order. What this holds down:
//
//   One shuffle, one undo restores what was there before and the button goes
//   grey again, exactly as the single snapshot behaved.
//
//   Three shuffles undo in reverse order, each landing on the groups that were
//   on screen before the next shuffle, and the button stays live until the
//   stack is empty.
//
//   Loading a different roster starts a new stack, so Undo never reaches back
//   across it.
//
//   No console errors.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8562;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/022-lab-group-role-randomizer.html';

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

/** What is on screen: each group's members in order, as one string. */
const shown = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#resultsArea .group-card')).map(
    g => Array.from(g.querySelectorAll('ul > li')).map(li => li.textContent.trim()).join(',')).join('|'));
const undoDisabled = () => page.evaluate(() => document.getElementById('undoBtn').disabled);
const shuffle = async () => { await page.click('#shuffleBtn'); await settle(page, 300); };
const undo = async () => { await page.click('#undoBtn'); await settle(page, 300); };

console.log('Lab Group & Role Randomizer — multi-step undo');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.fill('#namesInput', CLASS.join('\n'));
await settle(page, 300);

/* ── 1. one shuffle, one undo: the single-snapshot behaviour ─────────────── */
ok(await undoDisabled(), 'Undo is grey before any shuffle');
await shuffle();
const a = await shown();
ok(a.length > 0, 'the first shuffle shows groups');
ok(!(await undoDisabled()), 'Undo is live after a shuffle');
await undo();
eq(await shown(), '', 'one undo goes back to no groups');
ok(await undoDisabled(), 'and Undo is grey again');

/* ── 2. three shuffles undo in reverse order ─────────────────────────────── */
await shuffle(); const s1 = await shown();
await shuffle(); const s2 = await shown();
await shuffle(); const s3 = await shown();
ok(s1 !== s2 && s2 !== s3 && s1 !== s3, 'three shuffles gave three different groupings');
await undo();
eq(await shown(), s2, 'first undo lands on the second grouping');
ok(!(await undoDisabled()), 'Undo is still live with two steps behind');
await undo();
eq(await shown(), s1, 'second undo lands on the first grouping');
ok(!(await undoDisabled()), 'Undo is still live: one step left');
await undo();
eq(await shown(), '', 'third undo lands on no groups');
ok(await undoDisabled(), 'and Undo is grey once the stack is empty');

/* ── 3. a different roster starts a new stack ───────────────────────────── */
await shuffle(); await shuffle();
ok(!(await undoDisabled()), 'two shuffles leave Undo live');
page.once('dialog', d => d.accept('Second period'));
await page.click('#newRosterBtn');
await settle(page, 300);
ok(await undoDisabled(), 'a new roster clears the Undo stack');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
