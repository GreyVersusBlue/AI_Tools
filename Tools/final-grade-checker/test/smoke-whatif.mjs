// smoke-whatif.mjs — the Final Grade Checker's class-wide what-if, in a browser.
//
//   node Tools/final-grade-checker/test/smoke-whatif.mjs
//
// grade-math.test.mjs proves the arithmetic of curveScores() against hand-worked
// cases. This is the half a pure test cannot see: that the page asks the
// question without answering a different one.
//
// Two properties, and they are the whole feature:
//
//   1. A curve is a QUESTION, not an edit. The pasted quarter grades on screen,
//      and the real final letter beside them, must be untouched while a what-if
//      is on — a teacher reading a curved number as the reported grade is the
//      way this feature hurts somebody.
//   2. The what-if goes back through the same calculation. Turning on the
//      strict-boundary rounding rule has to change the what-if answer too, or
//      the second result is coming from a second, simpler calculation.
//
// No real student appears here. Every name is invented.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8165;
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
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });

/* Four students chosen so a +1 curve moves exactly two of them:
     Ada    four 89s        -> B, and +1 takes every quarter to 90 => A
     Marco  four 79s        -> C, +1 => B
     Nellie four 95s        -> A either way
     Zheng  Q4 missing      -> no final, and must still have none after a curve
   The tab-separated layout is the one parsePastedData documents:
   id, name, section, grade, Q1..Q4. */
const PASTE = [
  '10001\tLovelace, Ada\t03\t07\tB(89.00)\tB(89.00)\tB(89.00)\tB(89.00)\t89.00',
  '10002\tPolo, Marco\t03\t07\tC(79.00)\tC(79.00)\tC(79.00)\tC(79.00)\t79.00',
  '10003\tBly, Nellie\t03\t07\tA(95.00)\tA(95.00)\tA(95.00)\tA(95.00)\t95.00',
  '10004\tHe, Zheng\t03\t07\tB(88.00)\tB(85.00)\tB(84.00)\t\t',
].join('\n');

const cards = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#students-container .student-card')).map(c => ({
    name: (c.querySelector('.name-readonly') || {}).textContent || '',
    quarters: Array.from(c.querySelectorAll('.grade-readonly')).map(n => n.textContent),
    final: (c.querySelector('.final-letter') || {}).textContent || '',
    whatIf: c.querySelector('.whatif-line') ? c.querySelector('.whatif-line').textContent.replace(/\s+/g, ' ').trim() : null,
    whatIfLetter: (c.querySelector('.whatif-letter') || {}).textContent || null,
    dir: c.querySelector('.whatif-line')
      ? (c.querySelector('.whatif-line').classList.contains('up') ? 'up'
        : c.querySelector('.whatif-line').classList.contains('down') ? 'down' : 'flat')
      : null,
  })));

const summary = () => page.evaluate(() => document.getElementById('whatif-summary').textContent.replace(/\s+/g, ' ').trim());

console.log('Final Grade Checker — class-wide what-if');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. hidden until there is a class to ask about ─────────────────────── */
eq(await page.isVisible('#whatif-card'), false, 'the what-if is hidden before anything is imported');

await page.fill('#import-area', PASTE);
await page.click('#import-btn').catch(async () => {
  // Some builds import on paste/input rather than on a button.
  await page.dispatchEvent('#import-area', 'input');
});
await settle(page, 600);

const base = await cards();
eq(base.length, 4, 'four students imported');
eq(await page.isVisible('#whatif-card'), true, 'and the what-if appears with them');
eq(base[0].final, 'B', 'Ada starts on a B');
eq(base[1].final, 'C', 'Marco starts on a C');
eq(base[2].final, 'A', 'Nellie starts on an A');
ok(/no grade/.test(base[3].final), 'Zheng has no final — a quarter is missing');
ok(base.every(c => c.whatIf === null), 'and no card shows a what-if line until one is asked for');

/* ── 2. +1 point, and exactly the right two letters move ───────────────── */
await page.fill('#whatif-plus', '1');
await page.dispatchEvent('#whatif-plus', 'input');
await settle(page, 400);

const curved = await cards();
eq(curved[0].whatIfLetter, 'A', 'a +1 curve moves Ada to an A');
eq(curved[0].dir, 'up', 'flagged as a move up');
eq(curved[1].whatIfLetter, 'B', 'and Marco to a B');
eq(curved[2].whatIfLetter, 'A', 'Nellie stays an A');
eq(curved[2].dir, 'flat', 'with no move flagged');
ok(/no change/.test(curved[2].whatIf), 'and says so in words');
eq(curved[3].whatIf, null, 'a student without four quarters still has no what-if final');

/* ── 3. the pasted data and the real final are untouched ───────────────── */
eq(curved[0].quarters.join(','), base[0].quarters.join(','),
   'the quarter grades on screen are exactly as pasted');
eq(curved[0].quarters[0], '89.00', 'still 89.00, not 90.00');
eq(curved[0].final, 'B', 'and the real final letter beside them is still a B');
eq(await page.inputValue('#import-area'), PASTE, 'the pasted text itself is unchanged');

/* ── 4. the summary counts the movement ────────────────────────────────── */
const sum = await summary();
ok(/2 of 4/.test(sum), 'the summary counts how many letters move: ' + JSON.stringify(sum));
ok(/Lovelace, Ada: B → A/.test(sum), 'and names them, from and to');
ok(/1 still without a final/.test(sum), 'and separates out who still has no final at all');
ok(/\+1 points on every quarter/.test(sum), 'and states the question it answered');

/* ── 5. drop the lowest quarter ────────────────────────────────────────── */
await page.fill('#whatif-plus', '0');
await page.dispatchEvent('#whatif-plus', 'input');
await page.check('#whatif-drop');
await settle(page, 400);
const dropped = await cards();
eq(dropped[0].whatIfLetter, 'B', 'four identical quarters are unmoved by a drop');
ok(/lowest quarter dropped/.test(await summary()), 'the summary names the drop');

/* a student with one genuinely bad quarter is the case the drop is for */
await page.fill('#import-area', [
  '10005\tHopper, Grace\t03\t07\tA(95.00)\tA(95.00)\tA(95.00)\tF(40.00)\t81.25',
].join('\n'));
await page.click('#import-btn').catch(() => {});
await settle(page, 600);
const one = await cards();
eq(one.length, 1, 'a single-student class re-imported');
eq(one[0].final, 'B', 'with one failing quarter she lands on a B');
eq(one[0].whatIfLetter, 'A', 'dropping that quarter moves her to an A');
eq(one[0].dir, 'up', 'flagged as a move up');
eq(one[0].quarters[3], '40.00', 'and the 40 is still printed on her card');

/* ── 6. the what-if obeys the grading settings, not its own rules ──────── */
await page.fill('#import-area', PASTE);
await page.click('#import-btn').catch(() => {});
await settle(page, 600);
await page.uncheck('#whatif-drop');
await page.fill('#whatif-plus', '0.5');
await page.dispatchEvent('#whatif-plus', 'input');
await settle(page, 400);
const halfMode = await cards();
eq(halfMode[0].whatIfLetter, 'A', 'under the county half-point rule, 89.5 is an A');

await page.click('#settings-toggle-btn');   // the rounding rule lives in the Grading Settings panel
await settle(page, 250);
await page.check('input[name="round-boundary"][value="strict"]');
await settle(page, 500);
const strictMode = await cards();
eq(strictMode[0].whatIfLetter, 'B', 'switching to strict rounding changes the what-if answer too');
ok(strictMode[0].final === 'B', 'and the real final stays a B in both modes');
await page.check('input[name="round-boundary"][value="half"]');
await settle(page, 400);
await page.click('#settings-toggle-btn');

/* ── 7. Clear puts it away ─────────────────────────────────────────────── */
await page.click('#whatif-reset');
await settle(page, 400);
const cleared = await cards();
ok(cleared.every(c => c.whatIf === null), 'Clear removes every what-if line');
eq(await summary(), '', 'and the summary with it');
eq(await page.inputValue('#whatif-plus'), '0', 'the field is back to zero');

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
