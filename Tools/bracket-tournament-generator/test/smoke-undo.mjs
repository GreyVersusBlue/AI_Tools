// smoke-undo.mjs — "Undo last pick" on _shared/undo.js (Path 14 P5).
//
//   node Tools/bracket-tournament-generator/test/smoke-undo.mjs
//
// The button used to hold one snapshot. It now walks back every pick, newest
// first. What this holds down:
//
//   One pick, one undo: the pick comes back out and the button goes away,
//   as the single snapshot behaved.
//
//   Three picks undo in reverse order, the button staying until the stack is
//   empty, and each step lands on the bracket as it was before that pick.
//
//   Undo never reaches across a reset: after "Clear picks" there is nothing
//   to undo.
//
//   No console errors.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8563;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/020-bracket-tournament-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1500 });
page.on('dialog', (d) => d.accept());

const NAMES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
const ROUND = '#bracketView > .bracket > .round';
const slotTexts = (ri) => page.evaluate(([sel, ri]) =>
  Array.from(document.querySelectorAll(sel)[ri].querySelectorAll('.slot')).map((s) => s.textContent.trim()), [ROUND, ri]);
const pick = async (mi, si) => {
  await page.evaluate(([sel, mi, si]) => document.querySelectorAll(sel)[0].querySelectorAll('.match')[mi].querySelectorAll('.slot')[si].click(), [ROUND, mi, si]);
  await settle(page, 150);
};
const undoShown = () => page.isVisible('#undoBtn');
const undo = async () => { await page.click('#undoBtn'); await settle(page, 150); };
const round1Names = async () => (await slotTexts(1)).filter((t) => NAMES.includes(t));

console.log('020 Bracket Tournament Generator — multi-step undo');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);
await page.fill('#contestants', NAMES.join('\n'));
await page.selectOption('#bracketType', 'single');
await page.selectOption('#seedMode', 'asEntered');
await page.fill('#bracketName', 'Undo Cup');
await page.click('#generateBtn');
await settle(page, 300);

/* ── 1. one pick, one undo ───────────────────────────────────────────── */
ok(!(await undoShown()), 'no Undo button before any pick');
await pick(0, 0);
eq((await round1Names()).length, 1, 'a pick advances one team');
ok(await undoShown(), 'Undo appears after a pick');
await undo();
eq((await round1Names()).length, 0, 'one undo takes the pick back');
ok(!(await undoShown()), 'and the button goes away');

/* ── 2. three picks undo in reverse order ────────────────────────────── */
await pick(0, 0); await pick(1, 0); await pick(2, 0);
eq((await round1Names()).join(','), 'T1,T3,T5', 'three picks advance three teams');
await undo();
eq((await round1Names()).join(','), 'T1,T3', 'first undo takes back the third pick');
ok(await undoShown(), 'the button stays with two picks behind');
await undo();
eq((await round1Names()).join(','), 'T1', 'second undo takes back the second pick');
ok(await undoShown(), 'the button stays with one pick behind');
await undo();
eq((await round1Names()).length, 0, 'third undo takes back the first pick');
ok(!(await undoShown()), 'and the button goes away once the stack is empty');

/* ── 3. a reset clears the history ───────────────────────────────────── */
await pick(0, 0); await pick(1, 0);
ok(await undoShown(), 'two picks leave Undo available');
await page.click('#resetPicksBtn');
await settle(page, 200);
ok(!(await undoShown()), 'Clear picks leaves nothing to undo');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
