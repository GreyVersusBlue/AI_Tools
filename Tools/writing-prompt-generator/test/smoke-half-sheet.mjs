// smoke-half-sheet.mjs — the writing prompt's lined half-sheet handout.
//
//   node Tools/writing-prompt-generator/test/smoke-half-sheet.mjs
//
// The poster puts one prompt on a wall. This puts the same prompt on a desk,
// twice per page, with lines to write on — which is what a bell-ringer needs
// and what the tool made teachers hand-rule until now.
//
// The checks that matter are geometric, and they are done under
// emulateMedia('print') because the whole feature only exists in print CSS:
// two halves must fit one page, the ruled lines must be the physical pitch the
// menu claims, and a long prompt must cost lines rather than overflow the
// sheet.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8177;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/025-writing-prompt-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Writing Prompt — lined half-sheet handout');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── nothing to hand out until there is a prompt ───────────────────────── */
eq(await page.isDisabled('#printHandoutBtn'), true, 'the half-sheet button starts disabled');

await page.click('#generateBtn');
await settle(page, 300);
eq(await page.isDisabled('#printHandoutBtn'), false, 'and enables once a prompt is on the stage');

/** Renders the handout without opening the print dialog, then measures it in
    print media — the only media where the layout exists at all. */
async function renderHandout() {
  await page.evaluate(() => {
    // Call the same two steps the button does, minus window.print(), which
    // would block a headless run on the print dialog.
    const btn = document.getElementById('printHandoutBtn');
    const orig = window.print;
    window.print = () => {};
    btn.click();
    window.print = orig;
  });
  await page.emulateMedia({ media: 'print' });
  await settle(page, 200);
}

async function measure() {
  return page.evaluate(() => {
    const halves = Array.from(document.querySelectorAll('#handoutPrintArea .half-sheet'));
    const px = 96; // CSS inches
    return {
      count: halves.length,
      heightIn: halves.length ? halves[0].getBoundingClientRect().height / px : 0,
      totalIn: halves.reduce((s, h) => s + h.getBoundingClientRect().height, 0) / px,
      lines: halves.length ? halves[0].querySelectorAll('.hs-line').length : 0,
      lineIn: halves.length && halves[0].querySelector('.hs-line')
        ? halves[0].querySelector('.hs-line').getBoundingClientRect().height / px : 0,
      promptText: halves.length ? halves[0].querySelector('.hs-prompt').textContent : '',
      hasName: halves.length ? !!halves[0].querySelector('.hs-namerow') : false,
      meta: halves.length ? halves[0].querySelector('.hs-meta').textContent : '',
      // Do the lines actually stay inside the sheet, or spill past its edge?
      overflow: halves.length
        ? Math.max(0, halves[0].querySelector('.hs-lines').getBoundingClientRect().bottom
                    - halves[0].getBoundingClientRect().bottom) / px
        : 0,
    };
  });
}

await renderHandout();
let m = await measure();
eq(m.count, 2, 'one page carries two identical half-sheets');
near(m.heightIn, 4.9, 0.05, 'each half is 4.9in tall');
ok(m.totalIn <= 10.01, `both halves fit the 10in printable height (${m.totalIn.toFixed(2)}in)`);
ok(m.lines >= 5, `normal spacing leaves a usable number of lines (${m.lines})`);
near(m.lineIn, 0.34, 0.02, 'a normal-spaced line is 0.34in');
ok(m.overflow === 0, 'the ruled lines stay inside the half sheet');
ok(m.hasName, 'the name/date line is on by default');
ok(/Middle School|High School/.test(m.meta), 'the meta line names the band: ' + m.meta);

const normalLines = m.lines;

/* ── spacing changes the physical pitch, and the line count with it ────── */
await page.emulateMedia({ media: 'screen' });
await page.selectOption('#handoutSpacingSelect', 'wide');
await renderHandout();
m = await measure();
near(m.lineIn, 0.42, 0.02, 'wide ruling is 0.42in');
ok(m.lines < normalLines, `and fits fewer lines (${m.lines} vs ${normalLines})`);
ok(m.overflow === 0, 'wide lines still stay inside the sheet');

await page.emulateMedia({ media: 'screen' });
await page.selectOption('#handoutSpacingSelect', 'narrow');
await renderHandout();
m = await measure();
near(m.lineIn, 0.28, 0.02, 'narrow ruling is 0.28in');
ok(m.lines > normalLines, `and fits more lines (${m.lines} vs ${normalLines})`);

await page.emulateMedia({ media: 'screen' });
await page.selectOption('#handoutSpacingSelect', 'blank');
await renderHandout();
m = await measure();
eq(m.lines, 0, 'the blank option draws no lines at all');

/* ── the name line is optional ─────────────────────────────────────────── */
await page.emulateMedia({ media: 'screen' });
await page.selectOption('#handoutSpacingSelect', 'normal');
await page.uncheck('#handoutNameLineCheck');
await renderHandout();
m = await measure();
eq(m.hasName, false, 'unticking the name line drops it');

/* ── a long prompt costs lines rather than overflowing the sheet ───────── */
// Rather than hand-feeding one long string, walk a run of the tool's own
// built-in prompts: the bank contains some genuinely long ones, and the
// geometry has to hold for every one of them.
await page.emulateMedia({ media: 'screen' });
await page.check('#handoutNameLineCheck');
let longest = 0, worstOverflow = 0, worstTotal = 0, minLines = 99;
for (let i = 0; i < 12; i++) {
  await page.emulateMedia({ media: 'screen' });
  await page.click('#generateBtn');
  await settle(page, 120);
  await renderHandout();
  const r = await measure();
  longest = Math.max(longest, r.promptText.length);
  worstOverflow = Math.max(worstOverflow, r.overflow);
  worstTotal = Math.max(worstTotal, r.totalIn);
  minLines = Math.min(minLines, r.lines);
}
ok(longest > 60, `the sample covered a real spread of prompts (longest ${longest} chars)`);
ok(worstOverflow === 0, `no prompt spilled its lines past the sheet (worst ${worstOverflow.toFixed(2)}in)`);
ok(worstTotal <= 10.01, `every page still held both halves (worst ${worstTotal.toFixed(2)}in)`);
ok(minLines >= 1, `even the longest prompt left a line to write on (fewest ${minLines})`);

/* ── the setting survives a reload ─────────────────────────────────────── */
await page.emulateMedia({ media: 'screen' });
await page.selectOption('#handoutSpacingSelect', 'wide');
await settle(page, 200);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#handoutSpacingSelect'), 'wide', 'the line-spacing choice persists');

/* ── the floating a11y button must not print on the handout ────────────── */
await page.emulateMedia({ media: 'print' });
await settle(page, 150);
ok(await page.evaluate(() => {
  const w = document.querySelector('.a11y-widget');
  return !w || getComputedStyle(w).display === 'none';
}), 'the accessibility button is hidden in print (fixed in _shared/a11y.css)');
await page.emulateMedia({ media: 'screen' });

/* ── the poster path is untouched ──────────────────────────────────────── */
await page.click('#generateBtn');
await settle(page, 300);
await page.evaluate(() => {
  const orig = window.print; window.print = () => {};
  document.getElementById('printPosterBtn').click();
  window.print = orig;
});
await settle(page, 200);
ok(await page.evaluate(() => document.querySelectorAll('#posterPrintArea .poster-text').length === 1),
   'the wall poster still renders as before');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
