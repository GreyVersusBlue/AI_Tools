// smoke-response-area.mjs — the exit ticket's sized response area.
//
//   node Tools/exit-ticket-generator/test/smoke-response-area.mjs
//
// One fixed slip layout asked every question the same way. "Name one thing you
// learned" and "Explain why the Nile mattered to Egypt, with evidence" need
// different amounts of paper, and a diagram question needs no ruled lines at
// all.
//
// The assertions that matter: the automatic size follows the prompt's own
// wording (not just its length), an explicit choice overrides it, the response
// box really is a fraction of the slip rather than a relabelled constant, and
// the four styles render what they say they do — including the quarter-inch
// grid, whose whole point is a measurement that survives the printer.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8175;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/023-exit-ticket-generator.html';

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

console.log('Exit Ticket — response area sized to the prompt');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/** Sets the projected prompt through the tool's own custom-prompt control. */
async function usePrompt(text) {
  await page.click('.tab-btn[data-tab="bank"]');
  await settle(page, 150);
  await page.fill('#customPrompt', text);
  await page.click('#useCustomBtn');
  await settle(page, 250);
  await page.click('.tab-btn[data-tab="handout"]');
  await settle(page, 250);
}

/** Geometry of the first previewed slip.
 *
 *  Two different ratios, because they answer different questions and only one
 *  of them is a claim the tool makes.
 *
 *  `share` is the box against the writing area — the box plus the spacer
 *  under it — which is exactly what the flex weights in `answerAreaHtml()`
 *  divide up. "Full" means all of it, "short" means a third of it. That is
 *  resolution-independent and is what the setting promises.
 *
 *  `frac` is the box against the whole slip, prompt and name line included.
 *  It is useful for "did the box actually get bigger", but it is NOT a number
 *  the tool controls: a two-line prompt in a 200px preview slip eats a third
 *  of the paper before the writing area starts. An earlier version of this
 *  file asserted `frac > 0.5` for an explanation prompt, which measured the
 *  length of the question rather than the size of the answer box and failed
 *  on any prompt that wrapped.
 */
const slipShape = () => page.evaluate(() => {
  const slip = document.querySelector('#handoutPreview .slip');
  const box = slip.querySelector('.slip-answer-box');
  const spacer = slip.querySelector('.slip-answer-spacer');
  const boxH = box.getBoundingClientRect().height;
  const spacerH = spacer ? spacer.getBoundingClientRect().height : 0;
  return {
    frac: boxH / slip.getBoundingClientRect().height,
    share: boxH / (boxH + spacerH),
    lines: box.querySelectorAll('.slip-answer-line').length,
    cls: box.className,
    note: document.getElementById('answerSpaceNote').textContent,
  };
});

/* ── automatic sizing follows the prompt's wording ─────────────────────── */
await usePrompt('Explain why the Nile mattered to ancient Egypt, using evidence from today’s reading.');
const long = await slipShape();
ok(/explanation/.test(long.note), 'an "explain … evidence" prompt reads as an explanation: ' + long.note);

await usePrompt('List three things you learned today.');
const short = await slipShape();
ok(/quick answer/.test(short.note), 'a "list three" prompt reads as a quick answer: ' + short.note);

await usePrompt('What surprised you today?');
const mid = await slipShape();
ok(/sentence or two/.test(mid.note), 'a neutral prompt lands in the middle: ' + mid.note);

ok(long.frac > mid.frac && mid.frac > short.frac,
   `the box really shrinks: full ${long.frac.toFixed(2)} > medium ${mid.frac.toFixed(2)} > short ${short.frac.toFixed(2)}`);
ok(long.share > 0.95,
   `an explanation prompt gets all the room under the question (${(long.share * 100).toFixed(0)}% of it)`);
ok(short.share < 0.4,
   `a quick-answer prompt gets about a third of it (${(short.share * 100).toFixed(0)}%)`);
ok(Math.abs(mid.share - 0.5) < 0.05,
   `and a middling one gets about half (${(mid.share * 100).toFixed(0)}%)`);
ok(long.lines > short.lines, `line count follows the box (${long.lines} vs ${short.lines}), not a constant`);
ok(short.lines >= 1, 'even the shortest box still has a line to write on');

/* ── an explicit choice overrides the automatic one ────────────────────── */
await page.selectOption('#answerSpaceSelect', 'full');
await settle(page, 250);
const forcedFull = await slipShape();
ok(forcedFull.frac > short.frac, 'choosing Full overrides the prompt-based guess');
ok(forcedFull.note === '' || !/reads as/.test(forcedFull.note), 'and the automatic explanation goes quiet');

await page.selectOption('#answerSpaceSelect', 'short');
await settle(page, 250);
const forcedShort = await slipShape();
ok(forcedShort.frac < forcedFull.frac, 'and choosing Short shrinks it back');

/* ── the response styles ───────────────────────────────────────────────── */
await page.selectOption('#answerSpaceSelect', 'medium');
await page.selectOption('#answerStyleSelect', 'boxed');
await settle(page, 250);
const boxed = await slipShape();
ok(/boxed/.test(boxed.cls), 'blank-box style applies the boxed class');
eq(boxed.lines, 0, 'a blank box has no ruled lines');
ok(await page.evaluate(() => {
  const b = document.querySelector('#handoutPreview .slip-answer-box');
  return getComputedStyle(b).borderBottomWidth !== '0px';
}), 'and it draws a visible border to write inside');

await page.selectOption('#answerStyleSelect', 'plain');
await settle(page, 250);
const plain = await slipShape();
eq(plain.lines, 0, 'plain space has no lines');
ok(await page.evaluate(() => {
  const b = document.querySelector('#handoutPreview .slip-answer-box');
  return getComputedStyle(b).borderBottomWidth === '0px';
}), 'and no border either');

await page.selectOption('#answerStyleSelect', 'lines');
await settle(page, 250);
ok((await slipShape()).lines > 0, 'ruled lines come back');

/* ── the quarter-inch grid ─────────────────────────────────────────────────
   The only response style that makes a promise about physical size, which
   gives it two failure modes the others do not have. A grid drawn at "some
   small spacing" is just decoration — the reason to pick it over the blank
   box is that a square is a real quarter inch — and a background browsers
   strip from the print output is worse than no grid at all, because it is
   invisible until the copies are already made. */
await page.selectOption('#answerStyleSelect', 'grid');
await settle(page, 250);
const grid = await slipShape();
ok(/grid/.test(grid.cls), 'the grid style applies the grid class');
eq(grid.lines, 0, 'and draws no ruled lines — the squares are the ruling');

const gridCss = await page.evaluate(() => {
  const b = document.querySelector('#handoutPreview .slip-answer-box');
  const cs = getComputedStyle(b);
  return {
    image: cs.backgroundImage,
    adjust: cs.printColorAdjust || cs.webkitPrintColorAdjust || '',
    border: cs.borderBottomWidth,
  };
});
ok(/repeating-linear-gradient/.test(gridCss.image), 'the squares are drawn in CSS, not fetched as an image');
eq((gridCss.image.match(/repeating-linear-gradient/g) || []).length, 2,
   'two gradients — one set of lines each way, or it is ruled paper with extra steps');
ok(/0\.25in|24px/.test(gridCss.image),
   'ruled at a quarter inch, in inches, so a square is a quarter inch on paper: ' + gridCss.image.slice(0, 120));
eq(gridCss.adjust, 'exact',
   'print-color-adjust is exact — browsers drop background images from print by default, and here the background is the feature');
ok(gridCss.border !== '0px', 'the writing area is bounded, like the blank box');

/* Whatever the preview shows has to be what the print copy shows. */
eq(await page.evaluate(() => document.querySelectorAll('#printArea .slip-answer-box.grid').length),
   await page.evaluate(() => document.querySelectorAll('#handoutPreview .slip-answer-box.grid').length),
   'the print copy gets the grid too, slip for slip');
ok(await page.evaluate(() => {
  const b = document.querySelector('#printArea .slip-answer-box.grid');
  return !!b && /repeating-linear-gradient/.test(getComputedStyle(b).backgroundImage);
}), 'and it is still a grid there rather than an empty box');

ok(/100%/.test(await page.textContent('#answerStyleNote')),
   'the page warns that "fit to page" breaks the promise: ' + await page.textContent('#answerStyleNote'));
await page.selectOption('#answerStyleSelect', 'boxed');
await settle(page, 200);
eq(await page.textContent('#answerStyleNote'), '', 'and the warning goes away for the styles it does not apply to');
await page.selectOption('#answerStyleSelect', 'lines');
await settle(page, 200);

/* ── the print area gets the same slips as the preview ─────────────────── */
eq(await page.evaluate(() => document.querySelectorAll('#printArea .slip-answer-box').length),
   await page.evaluate(() => document.querySelectorAll('#handoutPreview .slip-answer-box').length),
   'the print copy matches the preview slip for slip');

/* ── the choice survives a reload ──────────────────────────────────────── */
await page.selectOption('#answerStyleSelect', 'grid');
await page.selectOption('#answerSpaceSelect', 'full');
await settle(page, 250);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#answerStyleSelect'), 'grid', 'the style setting persists');
ok(/100%/.test(await page.textContent('#answerStyleNote')), 'and the print-scale warning comes back with it');
eq(await page.inputValue('#answerSpaceSelect'), 'full', 'the space setting persists');

/* ── a class set uses the same sizing ──────────────────────────────────── */
await page.click('.tab-btn[data-tab="handout"]');
await settle(page, 200);
await page.check('#batchModeCheck');
await page.fill('#batchNamesInput', 'Amir\nBrianna\nDevon');
await page.dispatchEvent('#batchNamesInput', 'input');
await settle(page, 400);
const batchBoxes = await page.evaluate(() =>
  document.querySelectorAll('#handoutPreview .slip .slip-answer-box.grid').length);
ok(batchBoxes >= 3, `every class-set slip gets the chosen response area (${batchBoxes} found)`);

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
