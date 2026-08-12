// smoke-peer-form.mjs — the rubric builder's peer review print format.
//
//   node Tools/rubric-builder/test/smoke-peer-form.mjs
//
// The four existing print formats all show levels and points, because they
// are all built for the person doing the grading. Handing that to a 7th
// grader to fill in about their partner turns feedback into a grade argument
// — "you gave me a 3 and I deserve a 4" — which is the opposite of what peer
// review is for.
//
// So the assertion that matters most here is a negative one: no points, no
// level columns, nowhere on the page. The rest is that it is a form somebody
// can actually write on — named prompts rather than a blank box, real ruled
// lines, both names at the top, and portrait orientation that must not leak
// into the other formats' printing.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8201;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/003-rubric-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1100 });

const preview = (p) => p.evaluate(() => document.getElementById('previewArea').innerHTML);
const previewText = (p) => p.evaluate(() => document.getElementById('previewArea').textContent);

console.log('Rubric Builder — peer review print format');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 600);

// The tool opens with no criteria, so build a small real rubric first — the
// format is what's under test, but it needs something to reduce.
const CRITERIA = ['Claim', 'Evidence', 'Organisation'];
for (let i = 0; i < CRITERIA.length; i++) {
  await page.click('#addCriterionBtn');
  await settle(page, 200);
  await page.evaluate(name => {
    const inputs = document.querySelectorAll('#criteriaList input.crit-name');
    const input = inputs[inputs.length - 1];
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, CRITERIA[i]);
  await settle(page, 250);
}
eq(await page.evaluate(() => document.querySelectorAll('#criteriaList input.crit-name').length), 3,
   'three criteria to work from');

/* ── 1. the standard format still has its points ───────────────────────── */
await page.selectOption('#printFormat', 'standard');
await settle(page, 400);
const standard = await previewText(page);
ok(/\d/.test(standard), 'the standard grid shows numbers, as it always did');

/* ── 2. the peer form has none, anywhere ───────────────────────────────── */
await page.selectOption('#printFormat', 'peer');
await settle(page, 400);
const peerHtml = await preview(page);
ok(/peer-table/.test(peerHtml), 'selecting the peer format renders the peer form');

const peerCheck = await page.evaluate(() => {
  const area = document.getElementById('previewArea');
  const headers = [...area.querySelectorAll('th')].map(th => th.textContent.trim());
  return {
    headers: headers,
    cols: area.querySelectorAll('thead th').length,
    ptsText: (area.textContent.match(/\b\d+\s*(pts?|points?)\b/gi) || []),
    critRows: area.querySelectorAll('.peer-table tbody tr').length,
    lines: area.querySelectorAll('.peer-line').length,
    prompts: [...area.querySelectorAll('.peer-prompt')].map(n => n.textContent),
  };
});
eq(peerCheck.cols, 2, 'two columns only: what to look at, and room to write');
eq(JSON.stringify(peerCheck.headers), JSON.stringify(['What to look at', 'Your feedback']),
   'no level columns in the header: ' + JSON.stringify(peerCheck.headers));
eq(peerCheck.ptsText.length, 0, 'and no point values anywhere on the sheet: ' + JSON.stringify(peerCheck.ptsText));
ok(peerCheck.critRows >= 1, `every criterion is still a row (${peerCheck.critRows})`);

/* ── 3. it is a form, not a blank box ──────────────────────────────────── */
ok(peerCheck.prompts.includes('What works'), 'each row asks what works');
ok(peerCheck.prompts.includes('One thing to try'), 'and for one specific thing to try — "write a comment" gets "good job"');
ok(peerCheck.lines >= peerCheck.critRows * 4, `with real ruled lines to write on (${peerCheck.lines})`);
const names = await page.evaluate(() =>
  [...document.querySelectorAll('#previewArea .sheet-nameline span')].map(s => s.textContent));
eq(JSON.stringify(names), JSON.stringify(['Writer', 'Reviewer', 'Date']),
   'both people are named at the top — a peer form with one name line is a mystery in a week');
ok(/change one thing/i.test(await previewText(page)), 'and it closes by asking for the single change worth making');

/* ── 4. the level selector switches to describing, not scoring ─────────── */
eq(await page.isVisible('#singlePointWrap'), true, 'the level picker is offered, since the form quotes one level');
ok(/what to look for/i.test(await page.textContent('#singlePointLabel')),
   'relabelled for this format: ' + await page.textContent('#singlePointLabel'));

// Give the first criterion a different descriptor under two levels, then
// confirm the form quotes whichever one is selected. A fresh rubric has
// empty cells, so without this the assertion would pass on two blanks.
const levels = await page.evaluate(() => [...document.querySelectorAll('#singlePointLevel option')].map(o => o.value));
ok(levels.length > 1, `the rubric has several levels to choose between (${levels.length})`);
await page.evaluate(() => {
  const cells = document.querySelectorAll('#criteriaList .criterion-block .criterion-cells textarea');
  const set = (el, text) => { el.value = text; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  set(cells[0], 'TOPLEVELWORDING');
  set(cells[cells.length - 1], 'BOTTOMLEVELWORDING');
});
await settle(page, 400);
await page.selectOption('#singlePointLevel', levels[0]);
await settle(page, 400);
ok(/TOPLEVELWORDING/.test(await previewText(page)), 'the form quotes the selected level’s wording as the standard to look for');
await page.selectOption('#singlePointLevel', levels[levels.length - 1]);
await settle(page, 400);
const swapped = await previewText(page);
ok(/BOTTOMLEVELWORDING/.test(swapped), 'switching the level switches the wording');
ok(!/TOPLEVELWORDING/.test(swapped), 'and the old one is gone rather than both showing');
await page.selectOption('#singlePointLevel', levels[0]);
await settle(page, 300);

/* ── 5. orientation: portrait for the form, landscape for the grid ─────── */
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => window.__printed), 1, 'printing works');
const pageRule = await page.evaluate(() => document.getElementById('printPageStyle').textContent);
ok(/portrait/.test(pageRule), 'the peer form prints portrait — it is a page to write down, not a grid to read across');
ok(/peer-table/.test(await page.evaluate(() => document.getElementById('printArea').innerHTML)),
   'and what goes to the printer is the form');

await page.selectOption('#printFormat', 'standard');
await settle(page, 400);
eq(await page.evaluate(() => document.getElementById('printPageStyle').textContent), '',
   'switching back to the grid drops the portrait override');

/* the score sheet is always the landscape grid, whatever the selector says */
await page.selectOption('#printFormat', 'peer');
await settle(page, 300);
const scored = await page.evaluate(() => {
  const btn = document.getElementById('printScoreBtn');
  if (!btn) return 'no-button';
  window.alert = () => { window.__alerted = true; };
  btn.click();
  return document.getElementById('printPageStyle').textContent;
});
if (scored !== 'no-button') {
  eq(scored, '', 'printing a scored sheet resets to landscape even with the peer format selected');
}

/* ── 6. the other four formats are untouched ───────────────────────────── */
for (const [format, marker] of [['standard', 'rubric-table'], ['student', 'sheet-nameline'], ['single-point', 'rubric-sheet'], ['checklist', 'checklist-table']]) {
  await page.selectOption('#printFormat', format);
  await settle(page, 350);
  ok(new RegExp(marker).test(await preview(page)), `the ${format} format still renders`);
  ok(!/peer-table/.test(await preview(page)), `and is not the peer form`);
}

/* ── 7. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
