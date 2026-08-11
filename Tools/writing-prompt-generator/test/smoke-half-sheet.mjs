// smoke-half-sheet.mjs — the writing prompt's lined half-sheet handout.
//
//   node Tools/writing-prompt-generator/test/smoke-half-sheet.mjs
//
// The tool could print one prompt at 60pt for taping to a wall. What it could
// not print was the thing students write on. "Print half-sheets" puts the
// same prompt twice on one page — name line, whatever the word goal and paired
// rubric say, and ruled space — so one sheet through the printer covers two
// students.
//
// The part worth pinning is how the lines are drawn. They are a repeating
// background gradient on a flex:1 block, not a fixed number of divs, for two
// reasons: the ruling fills exactly whatever room a long prompt leaves instead
// of overflowing, and nothing is ever clipped. The cost is that browsers drop
// background images from print by default, so print-color-adjust:exact is
// load-bearing — without it the handout prints with nothing to write on.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8195;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/025-writing-prompt-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Writing Prompt Generator — lined half-sheet handout');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

/* ── 1. it is unavailable until there is a prompt, like the poster ─────── */
eq(await page.evaluate(() => document.getElementById('printHalfSheetBtn').disabled), true,
   'the button starts disabled — there is nothing to hand out yet');
await page.click('#generateBtn');
await settle(page, 500);
eq(await page.evaluate(() => document.getElementById('printHalfSheetBtn').disabled), false,
   'and enables with the first prompt, in step with Print poster');
eq(await page.evaluate(() => document.getElementById('printPosterBtn').disabled), false,
   'which is still there — this is a second output, not a replacement');

/* ── 2. two sheets, both the prompt on the stage ───────────────────────── */
await page.click('#printHalfSheetBtn');
await settle(page, 400);
eq(await page.evaluate(() => window.__printed), 1, 'clicking it prints');
const sheets = await page.evaluate(() => {
  const el = document.getElementById('halfSheetPrintArea');
  const halves = [...el.querySelectorAll('.half-sheet')];
  return {
    active: el.classList.contains('active'),
    count: halves.length,
    prompts: halves.map(h => h.querySelector('.hs-prompt').textContent),
    names: halves.map(h => (h.querySelector('.hs-nameline') || {}).textContent || ''),
    lines: halves.map(h => !!h.querySelector('.hs-lines')),
    stage: (document.querySelector('#stagePrompt .prompt-text') || {}).textContent || '',
  };
});
eq(sheets.active, true, 'the half-sheet print area is the one switched on');
eq(sheets.count, 2, 'a page holds two half sheets');
eq(sheets.prompts[0], sheets.stage, 'carrying the prompt currently on the stage');
eq(sheets.prompts[1], sheets.prompts[0], 'twice — cut the page, two students');
ok(/Name:/.test(sheets.names[0]) && /Date:/.test(sheets.names[0]), 'each half has a name and date line');
ok(sheets.lines[0] && sheets.lines[1], 'and ruled space to write in');

eq(await page.evaluate(() => document.getElementById('posterPrintArea').classList.contains('active')), false,
   'the poster area is not also switched on, so one print job is one thing');

/* ── 3. the ruling is real on paper ────────────────────────────────────── */
await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const printed = await page.evaluate(() => {
  const half = document.querySelector('#halfSheetPrintArea .half-sheet');
  const lines = half.querySelector('.hs-lines');
  const cs = getComputedStyle(lines);
  return {
    halfH: Math.round(half.getBoundingClientRect().height),
    linesH: Math.round(lines.getBoundingClientRect().height),
    overflow: Math.round(lines.getBoundingClientRect().bottom - half.getBoundingClientRect().bottom),
    adjust: cs.printColorAdjust,
    image: cs.backgroundImage,
  };
});
ok(printed.halfH >= 460 && printed.halfH <= 490, `a half sheet is 4.9in tall, so two fit a page (${printed.halfH}px)`);
ok(printed.linesH > 150, `most of which is room to write (${printed.linesH}px)`);
ok(printed.overflow <= 0, `and the ruling never runs past the half it belongs to (${printed.overflow}px)`);
eq(printed.adjust, 'exact', 'print-color-adjust:exact — without it the lines never reach paper');
ok(/repeating-linear-gradient/.test(printed.image), 'the lines are a repeating rule, so they fill the space exactly');
ok(/0\.3in|28\.8px/.test(printed.image), 'at a 0.3in pitch, near wide-ruled: ' + printed.image.slice(0, 90));

/* A long prompt has to eat into the writing space, not overflow the half.
   Asserted against the layout directly — this is a CSS property of the sheet,
   and driving the bank's random draw until it happens to hand back a long
   prompt would test the shuffle rather than the handout. */
const longSheet = await page.evaluate(() => {
  const half = document.querySelector('#halfSheetPrintArea .half-sheet');
  half.querySelector('.hs-prompt').textContent =
    'Think about a time you changed your mind about something important. ' +
    'Explain what you used to believe, what happened to change it, and what you believe now. ' +
    'Use at least two specific details from your own experience to support your explanation.';
  const lines = half.querySelector('.hs-lines');
  return {
    overflow: Math.round(lines.getBoundingClientRect().bottom - half.getBoundingClientRect().bottom),
    linesH: Math.round(lines.getBoundingClientRect().height),
    halfH: Math.round(half.getBoundingClientRect().height),
  };
});
ok(longSheet.overflow <= 0, `a long prompt does not push the ruling off the half (${longSheet.overflow}px)`);
ok(longSheet.linesH < printed.linesH, `it takes its room from the writing space (${longSheet.linesH}px vs ${printed.linesH}px)`);
ok(longSheet.linesH >= 57, `but never below the 0.6in floor, so there is always somewhere to write (${longSheet.linesH}px)`);
await page.emulateMedia({ media: 'screen' });

/* ── 4. the word goal and a paired rubric travel with it ───────────────── */
await page.fill('#wordGoalInput', '150');
await page.dispatchEvent('#wordGoalInput', 'input');
await settle(page, 300);
await page.click('#printHalfSheetBtn');
await settle(page, 300);
const extras = await page.evaluate(() =>
  [...document.querySelectorAll('#halfSheetPrintArea .hs-extra')].map(e => e.textContent));
eq(extras.length, 2, 'both halves carry the extras line');
ok(/150\+ words/.test(extras[0]), 'including the word goal the teacher set: ' + extras[0]);

const meta = await page.evaluate(() => document.querySelector('#halfSheetPrintArea .hs-meta').textContent);
ok(/Middle School|High School/.test(meta), 'and the band/genre line the poster shows: ' + meta);

/* ── 5. afterprint puts the page back ──────────────────────────────────── */
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await settle(page, 200);
eq(await page.evaluate(() => document.getElementById('halfSheetPrintArea').classList.contains('active')), false,
   'the print area is switched off again afterwards');

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
