// smoke-triage.mjs — the Final Grade Checker's missing-work triage report, in
// a browser.
//
//   node Tools/final-grade-checker/test/smoke-triage.mjs
//
// grade-math.test.mjs proves missingWork()/letterAbove()/requiredScoreForQuarter()/
// triageStudent() against hand-worked cases. This is the half a pure test
// cannot see: that the page reads the same paste, shows the right students in
// the right lists, and the printable catch-up slip carries the same numbers.
//
// No real student appears here. Every name is invented.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8166;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/036-final_grade_checker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1200 });

/* Four students chosen to hit every branch of triageStudent(), matching the
   hand-worked cases in grade-math.test.mjs so the two suites cross-check:
     Ada    Q1 a recorded zero, Q2-4 strong  -> final B, one quarter (Q1,
            raised to 79.50) from an A
     Marco  Q3 genuinely blank               -> no final yet; missing work,
            not a one-away case
     Nellie four A's                         -> nothing to flag; already an A
     Zheng  four flat 50s                    -> final F, one quarter (Q1,
            raised to 69.50) from a D
   Layout matches parsePastedData's documented columns: id, name, section,
   grade, Q1..Q4. */
const PASTE = [
  '20001\tLovelace, Ada\t03\t07\tF(0.00)\tB(85.00)\tA(90.00)\tA(95.00)\t67.50',
  '20002\tPolo, Marco\t03\t07\tC(70.00)\tB(80.00)\t\tA(90.00)',
  '20003\tBly, Nellie\t03\t07\tA(95.00)\tA(96.00)\tA(97.00)\tA(98.00)\t96.50',
  '20004\tHe, Zheng\t03\t07\tF(50.00)\tF(50.00)\tF(50.00)\tF(50.00)\t50.00',
].join('\n');

const triageState = () => page.evaluate(() => ({
  cardVisible: getComputedStyle(document.getElementById('triage-card')).display !== 'none',
  count: (document.getElementById('triage-count') || {}).textContent || '',
  missingHtml: (document.getElementById('triage-missing-list') || {}).innerHTML || '',
  missingText: (document.getElementById('triage-missing-list') || {}).textContent.replace(/\s+/g, ' ').trim(),
  oneAwayText: (document.getElementById('triage-oneaway-list') || {}).textContent.replace(/\s+/g, ' ').trim(),
}));

console.log('Final Grade Checker — missing-work triage');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. hidden until there is a class to triage ─────────────────────────── */
eq(await page.isVisible('#triage-card'), false, 'the triage card is hidden before anything is imported');

await page.fill('#import-area', PASTE);
await page.click('#import-btn').catch(async () => {
  await page.dispatchEvent('#import-area', 'input');
});
await settle(page, 600);

/* ── 2. it appears with the class, and counts correctly ─────────────────── */
let s = await triageState();
ok(s.cardVisible, 'and the triage card appears with them');
ok(/2 of 4 with missing work/.test(s.count), 'two of four have missing work: ' + JSON.stringify(s.count));
ok(/2 one quarter from a letter change/.test(s.count), 'two of four are one quarter from a letter change: ' + JSON.stringify(s.count));

/* ── 3. missing work — who, and which kind ───────────────────────────────── */
ok(/Lovelace, Ada/.test(s.missingText), 'Ada (a recorded zero) is in the missing-work list');
ok(/zero/.test(s.missingHtml) && /Q1/.test(s.missingText), 'flagged specifically as a zero on Q1');
ok(/Polo, Marco/.test(s.missingText), 'Marco (a blank quarter) is in the missing-work list');
ok(/not entered/.test(s.missingHtml) && /Q3/.test(s.missingText), 'flagged specifically as not entered, on Q3');
ok(!/Bly, Nellie/.test(s.missingText), 'Nellie (four real scores) is not in the missing-work list');
ok(!/He, Zheng/.test(s.missingText), 'Zheng (four real, if weak, scores) is not in the missing-work list either');

/* ── 4. one quarter from a letter change — who, and the exact numbers ───── */
ok(/Lovelace, Ada/.test(s.oneAwayText), 'Ada is one quarter from a letter change');
ok(/B/.test(s.oneAwayText) && /A/.test(s.oneAwayText), 'named as a B -> A move');
ok(/Quarter 1/.test(s.oneAwayText) && /79\.50/.test(s.oneAwayText),
  'and gives the exact lever: Quarter 1 to 79.50 — ' + JSON.stringify(s.oneAwayText));
ok(/He, Zheng/.test(s.oneAwayText), 'Zheng is one quarter from a letter change too');
ok(/69\.50/.test(s.oneAwayText), 'Zheng needs Quarter 1 at 69.50 (F -> D) — ' + JSON.stringify(s.oneAwayText));
ok(!/Bly, Nellie/.test(s.oneAwayText), 'Nellie is already an A — nothing above it to move to');
ok(!/Polo, Marco/.test(s.oneAwayText), 'Marco has no final grade yet — not a "one quarter away" case');

/* ── 5. the settings panel's rounding rule feeds the SAME calculation ───── */
// Switching to strict rounding changes both the target letter (Ada's actual
// final drops from a B to a C — no credit for her 89.5-equivalent boundary
// anywhere in the chain) and the cost of reaching it. If the triage numbers
// came from a second, simpler calculation, this is exactly where the two
// would quietly disagree instead of moving together.
await page.click('#settings-toggle-btn');
await settle(page, 250);
await page.check('input[name="round-boundary"][value="strict"]');
await settle(page, 500);
const strict = await triageState();
ok(/Lovelace, Ada.*?C.*?B/.test(strict.oneAwayText), 'strict rounding: Ada is now a C moving to a B — ' + JSON.stringify(strict.oneAwayText));
ok(/50\.00/.test(strict.oneAwayText), 'and needs 50.00 on Quarter 1 to get there — ' + JSON.stringify(strict.oneAwayText));
ok(!/79\.50/.test(strict.oneAwayText), 'not the half-point-mode 79.50');
ok(/90\.00/.test(strict.oneAwayText), "Zheng's target also moves, to 90.00 under strict rounding — " + JSON.stringify(strict.oneAwayText));
ok(!/69\.50/.test(strict.oneAwayText), 'not the half-point-mode 69.50');
await page.check('input[name="round-boundary"][value="half"]');
await settle(page, 400);
await page.click('#settings-toggle-btn');
await settle(page, 250);

/* ── 6. Print Catch-Up Slips builds one slip per FLAGGED student only ───── */
const slipHtml = await (async () => {
  await page.click('#print-catchup-btn');
  await settle(page, 400);
  return page.evaluate(() => document.getElementById('slip-print-container').innerHTML);
})();
const slipCount = (slipHtml.match(/class="slip"/g) || []).length;
eq(slipCount, 3, 'three flagged students get a catch-up slip (Ada, Marco, Zheng — not Nellie)');
ok(/Lovelace, Ada/.test(slipHtml), 'Ada is on a slip');
ok(/Zero recorded: Quarter 1/.test(slipHtml), "and it names Q1's zero");
ok(/79\.50/.test(slipHtml), 'and the same 79.50 target as the summary');
ok(/Polo, Marco/.test(slipHtml), 'Marco is on a slip');
ok(/Not yet entered: Quarter 3/.test(slipHtml), "and it names Q3 as not yet entered");
ok(/He, Zheng/.test(slipHtml), 'Zheng is on a slip');
ok(!/Bly, Nellie/.test(slipHtml), 'Nellie — nothing flagged — gets no catch-up slip');
ok(await page.evaluate(() => document.body.classList.contains('printing-slips')),
  'the printing-slips class is applied for the print pass');
await page.evaluate(() => document.body.classList.remove('printing-slips'));

/* ── 7. switching back to manual entry puts the triage card away ────────── */
await page.click('#clear-all-btn');
await settle(page, 300);
eq(await page.isVisible('#triage-card'), false, 'manual mode has nothing to triage, so the card is hidden again');

/* ── 8. no console noise ──────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
