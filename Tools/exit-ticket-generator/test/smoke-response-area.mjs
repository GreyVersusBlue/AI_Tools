// smoke-response-area.mjs — the exit ticket's sized response area.
//
//   node Tools/exit-ticket-generator/test/smoke-response-area.mjs
//
// One slip layout used to serve every prompt: four rules at the bottom,
// whether the question was "name one cause" or "explain why the compromise
// failed". Worse, those four rules were spaced by a .28rem flex gap — about
// 1.2mm once printed, a hairline pattern rather than something a 7th grader
// can write between. This suite pins both halves of the fix:
//
//   1. A row is a real, measurable size, and the print stylesheet states it
//      in inches rather than inheriting a preview-scale rem.
//   2. Style and amount are the teacher's choice, with an Auto that reads the
//      prompt — and Auto is a first guess, so an explicit size must win.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8194;
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
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

/** Types a prompt into the tool's own prompt field and re-renders. */
const setPrompt = async (p, text) => {
  await p.evaluate(t => {
    const input = document.getElementById('customPrompt');
    input.value = t;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('useCustomBtn').click();
  }, text);
  await settle(p, 250);
};

const firstSlip = (p) => p.evaluate(() => {
  const slip = document.querySelector('#handoutPreview .slip');
  const lines = slip.querySelectorAll('.slip-answer-line');
  const box = slip.querySelector('.slip-answer-box');
  return {
    lines: lines.length,
    lineHeight: lines.length ? Math.round(lines[0].getBoundingClientRect().height * 10) / 10 : 0,
    hasBox: !!box,
    boxGrid: box ? box.classList.contains('grid') : false,
    boxRows: box ? box.style.getPropertyValue('--resp-rows') : '',
    boxHeight: box ? Math.round(box.getBoundingClientRect().height) : 0,
  };
});

console.log('Exit Ticket / Bell Ringer Generator — sized response area');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('[data-tab="handout"]');
await settle(page, 400);

/* ── 1. a writing line is a writing line, not a hairline ───────────────── */
await page.selectOption('#responseSizeSelect', 'medium');
await settle(page, 250);
const medium = await firstSlip(page);
eq(medium.lines, 4, 'medium gives four writing lines');
ok(medium.lineHeight >= 8, `each one is a real row, not a 4px gap (${medium.lineHeight}px in the preview)`);

const printRow = await page.evaluate(() => {
  // What the print stylesheet actually declares, read straight out of the CSS
  // rather than inferred — this is the number that reaches paper.
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.media && rule.media.mediaText.includes('print')) {
        for (const inner of rule.cssRules) {
          if (inner.selectorText && inner.selectorText.includes('.slip-page')) {
            const v = inner.style.getPropertyValue('--resp-row').trim();
            if (v) return v;
          }
        }
      }
    }
  }
  return null;
});
eq(printRow, '0.3in', 'and print states the row height in inches, near wide-ruled');

/* ── 2. the three explicit sizes really differ ─────────────────────────── */
await page.selectOption('#responseSizeSelect', 'short');
await settle(page, 250);
eq((await firstSlip(page)).lines, 2, 'short gives two lines');
await page.selectOption('#responseSizeSelect', 'tall');
await settle(page, 250);
eq((await firstSlip(page)).lines, 7, 'tall gives seven');

/* ── 3. Auto reads the prompt, and an explicit size overrides it ───────── */
await page.selectOption('#responseSizeSelect', 'auto');
await setPrompt(page, 'List two causes.');
eq((await firstSlip(page)).lines, 2, 'Auto gives a listing prompt a sentence of room');
ok(/sentence/.test(await page.textContent('#responseHint')), 'and says so in the hint');

await setPrompt(page, 'Explain why the compromise failed, using evidence from the reading.');
eq((await firstSlip(page)).lines, 7, 'Auto gives an "explain … evidence" prompt a paragraph');
ok(/paragraph/.test(await page.textContent('#responseHint')), 'and says so');

await setPrompt(page, 'What surprised you about the reading today?');
eq((await firstSlip(page)).lines, 4, 'and an ordinary open question lands in the middle');

await page.selectOption('#responseSizeSelect', 'short');
await settle(page, 250);
eq((await firstSlip(page)).lines, 2, 'an explicit size wins over Auto — Auto is a first guess, not a verdict');
ok(/same amount of room/.test(await page.textContent('#responseHint')), 'and the hint stops claiming to read the prompt');

/* ── 4. blank and grid are boxes, sized by the same rows ───────────────── */
await page.selectOption('#responseStyleSelect', 'blank');
await page.selectOption('#responseSizeSelect', 'tall');
await settle(page, 300);
const blank = await firstSlip(page);
eq(blank.lines, 0, 'a blank box has no rules');
eq(blank.hasBox, true, 'it is a box');
eq(blank.boxRows, '7', 'sized by the same row count as the lines would have been');
eq(blank.boxGrid, false, 'and is not gridded');

await page.selectOption('#responseSizeSelect', 'short');
await settle(page, 300);
const shortBox = await firstSlip(page);
ok(shortBox.boxHeight < blank.boxHeight, `a short box is genuinely shorter (${shortBox.boxHeight}px vs ${blank.boxHeight}px)`);

await page.selectOption('#responseStyleSelect', 'grid');
await settle(page, 300);
eq((await firstSlip(page)).boxGrid, true, 'the grid style adds the grid class');
eq(await page.evaluate(() => getComputedStyle(document.querySelector('#handoutPreview .slip-answer-box')).printColorAdjust), 'exact',
   'with print-color-adjust:exact, or the grid never reaches paper');

/* ── 5. prompt-only leaves nothing to write on ─────────────────────────── */
await page.selectOption('#responseStyleSelect', 'none');
await settle(page, 300);
const none = await firstSlip(page);
eq(none.lines, 0, 'prompt-only prints no lines');
eq(none.hasBox, false, 'and no box');
eq(await page.evaluate(() => document.getElementById('responseSizeSelect').disabled), true,
   'and the size control is disabled, since there is nothing to size');
ok(/notebook/.test(await page.textContent('#responseHint')), 'the hint explains what it is for');

/* ── 6. the choice persists, and the print area matches the preview ────── */
await page.selectOption('#responseStyleSelect', 'grid');
await page.selectOption('#responseSizeSelect', 'medium');
await settle(page, 300);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.click('[data-tab="handout"]');
await settle(page, 400);
eq(await page.inputValue('#responseStyleSelect'), 'grid', 'the style survives a reload');
eq(await page.inputValue('#responseSizeSelect'), 'medium', 'so does the size');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .slip-answer-box.grid').length),
   await page.evaluate(() => document.querySelectorAll('#handoutPreview .slip-answer-box.grid').length),
   'and the print area carries the same response areas as the preview');

/* ── 7. a class set gets it too ────────────────────────────────────────── */
await page.check('#batchModeCheck');
await settle(page, 300);
await page.fill('#batchNamesInput', 'Ada Lovelace\nMarco Polo\nNellie Bly');
await page.dispatchEvent('#batchNamesInput', 'input');
await settle(page, 400);
eq(await page.evaluate(() => document.querySelectorAll('#handoutPreview .slip-answer-box.grid').length), 3,
   'every student in a class set gets the chosen response area');

/* ── 8. settings saved before this round still open ────────────────────── */
const legacy = await prepPage(browser, BASE, { width: 1300, height: 900 });
await legacy.goto(URL_PAGE, { waitUntil: 'networkidle' });
await legacy.evaluate(() => {
  const k = Object.keys(localStorage).find(x => /exit/i.test(x) && /setting/i.test(x));
  localStorage.setItem(k, JSON.stringify({ category: 'all', perPage: 2, showName: true, showDate: true }));
});
await legacy.reload({ waitUntil: 'networkidle' });
await settle(legacy, 400);
await legacy.click('[data-tab="handout"]');
await settle(legacy, 400);
eq(await legacy.inputValue('#responseStyleSelect'), 'lines', 'a settings blob from before this round falls back to lines');
eq(await legacy.inputValue('#responseSizeSelect'), 'auto', 'and Auto');
ok((await firstSlip(legacy)).lines > 0, 'and still renders a usable slip');

/* ── 9. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['legacy', legacy]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
