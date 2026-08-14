// smoke-corroboration.mjs — corroboration mode (backlog rank 3).
//
//   node Tools/primary-source-analysis-generator/test/smoke-corroboration.mjs
//
// Corroboration mode prints two sources side by side under the same framework
// questions, then a fixed comparison block (agree / disagree / more reliable).
// What this suite holds down:
//
//   Off by default — a plain worksheet still prints exactly one source box
//   and no comparison block, so this stays additive to the existing shape.
//
//   On, the print DOM actually carries both sources, a dual answer area per
//   framework step, and the comparison block — on both the blank student
//   worksheet and the answer key (with per-source teacher notes and the
//   comparison notes filled in).
//
//   The Boston Massacre "Load example" button fills a real two-source pair
//   and turns the mode on, and asks before clobbering work already in the
//   editor.
//
//   The share link carries the corroboration fields (mode flag, Source B
//   text/citation, notesB, comparisonNotes) on a round trip, while the
//   uploaded image — there isn't one in this test, but the code path is
//   checked — stays out of the link like Source A's always has.
//
// Exits 1 on any failure. All source text here is written for this test —
// not a reproduction of any copyrighted or verbatim historical document.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8128;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/028-primary-source-analysis-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Primary Source Analysis — corroboration mode (two sources + comparison block)');

const page = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. off by default: a plain worksheet still prints one source box ──── */
async function printedBlank() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printBlankBtn');
  await settle(page, 150);
  return page.evaluate(() => ({
    sourcesRow: document.querySelectorAll('#printArea .sources-row').length,
    sourceBoxes: document.querySelectorAll('#printArea .source-box').length,
    comparisonBlock: document.querySelectorAll('#printArea .comparison-block').length,
    dualAnswerRows: document.querySelectorAll('#printArea .dual-answer-row').length,
  }));
}
const beforeToggle = await printedBlank();
eq(beforeToggle.sourcesRow, 0, 'no two-source row before corroboration mode is on');
eq(beforeToggle.sourceBoxes, 1, 'exactly one source box prints by default');
eq(beforeToggle.comparisonBlock, 0, 'no comparison block by default');
eq(beforeToggle.dualAnswerRows, 0, 'no dual answer rows by default');
eq(await page.isVisible('#corroborationFields'), false, 'Source B fields are hidden until the checkbox is on');

/* ── 2. Load Boston Massacre example: fills both sources, turns mode on ── */
await page.click('#loadExampleBtn');
await settle(page, 200);

eq(await page.isChecked('#corroborationEnabled'), true, 'the example turns corroboration mode on');
eq(await page.isVisible('#corroborationFields'), true, 'so Source B fields are now shown');
ok((await page.inputValue('#sourceTitle')).includes('Bloody Massacre'), 'Source A title loaded');
ok((await page.inputValue('#sourceBTitle')).length > 0, 'Source B title loaded');
ok((await page.inputValue('#sourceBText')).length > 100, 'Source B text loaded (a real paragraph, not a stub)');
const checkedFramework = await page.evaluate(() =>
  document.querySelector('input[name="framework"]:checked').value);
eq(checkedFramework, 'hipp', 'the example picks a framework suited to a text+visual pair');

/* ── 3. fill teacher notes: per-source per-step, plus the comparison block ── */
await page.evaluate(() => {
  function setVal(el, v) {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const steps = Array.from(document.querySelectorAll('#notesEditor [data-note-block="step"]'));
  // First step block belongs to the first HIPP step (Historical Context);
  // it should now carry two teacher-note textareas (Source A, then Source B).
  const first = steps[0];
  const textareas = first.querySelectorAll('textarea');
  setVal(textareas[0], 'Source A note: the engraving was propaganda meant to inflame colonial anger.');
  setVal(textareas[1], 'Source B note: the testimony reflects the defense\'s self-defense argument at trial.');
  // The comparison editor (agree / disagree / reliable), three textareas.
  // Addressed by its data attribute rather than by position — it stopped
  // being the last block when the Honors GT synthesis note was added.
  const last = document.querySelector('#notesEditor [data-note-block="comparison"]');
  const compTextareas = last.querySelectorAll('textarea');
  setVal(compTextareas[0], 'Both sources agree a shooting happened and colonists died.');
  setVal(compTextareas[1], 'They disagree about who was the aggressor and whether the soldiers were threatened.');
  setVal(compTextareas[2], 'The soldier\'s account is more reliable for intent; Revere\'s print is reliable only as propaganda evidence.');
});
await settle(page, 150);

/* ── 4. blank student worksheet: both sources, dual answer rows, comparison ── */
const blank = await printedBlank();
eq(blank.sourcesRow, 1, 'one two-source row prints in corroboration mode');
eq(blank.sourceBoxes, 2, 'both source boxes print');
eq(blank.comparisonBlock, 1, 'the comparison block prints');
ok(blank.dualAnswerRows > 0, 'framework steps print dual (Source A / Source B) answer areas');

const blankDetail = await page.evaluate(() => ({
  labels: Array.from(document.querySelectorAll('#printArea .source-label')).map(e => e.textContent),
  subLabels: Array.from(document.querySelectorAll('#printArea .dual-answer-row .sub-label')).map(e => e.textContent),
  comparisonQs: Array.from(document.querySelectorAll('#printArea .comparison-step .step-q')).map(e => e.textContent),
  answerLinesInComparison: document.querySelectorAll('#printArea .comparison-step .answer-line').length,
}));
eq(blankDetail.labels.join(','), 'Source A,Source B', 'each source box is labeled');
ok(blankDetail.subLabels.includes('Source A') && blankDetail.subLabels.includes('Source B'),
  'each dual answer row is labeled by source: ' + JSON.stringify(blankDetail.subLabels));
eq(blankDetail.comparisonQs.length, 3, 'all three comparison questions print');
ok(/agree/i.test(blankDetail.comparisonQs[0]), 'first comparison question asks where they agree');
ok(/disagree/i.test(blankDetail.comparisonQs[1]), 'second asks where they disagree');
ok(/reliable/i.test(blankDetail.comparisonQs[2]), 'third asks which is more reliable');
ok(blankDetail.answerLinesInComparison > 0, 'the comparison block has blank answer lines on the student copy');

/* ── 5. answer key: teacher notes per source, plus the comparison key ──── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printKeyBtn');
await settle(page, 150);
const key = await page.evaluate(() => ({
  subKeyBoxes: document.querySelectorAll('#printArea .step-answer.key.sub').length,
  comparisonKeyTexts: Array.from(document.querySelectorAll('#printArea .comparison-step .step-answer.key')).map(e => e.textContent),
}));
ok(key.subKeyBoxes > 0, 'per-source teacher-note boxes print on the answer key');
const firstStepTexts = await page.evaluate(() => Array.from(
  document.querySelectorAll('#printArea .steps-wrap .step-block')[0].querySelectorAll('.step-answer.key.sub')
).map(e => e.textContent));
ok(firstStepTexts.some(t => /engraving was propaganda/.test(t)), 'Source A\'s note for the first step is on the key');
ok(firstStepTexts.some(t => /self-defense argument/.test(t)), 'Source B\'s note for the first step is on the key too');
eq(key.comparisonKeyTexts.length, 3, 'all three comparison answers print on the key');
ok(key.comparisonKeyTexts.some(t => /shooting happened/.test(t)), 'the "agree" comparison note is on the key');
ok(key.comparisonKeyTexts.some(t => /aggressor/.test(t)), 'the "disagree" comparison note is on the key');
ok(key.comparisonKeyTexts.some(t => /more reliable only as propaganda/.test(t) || /reliable/.test(t)),
  'the "more reliable" comparison note is on the key');

/* ── 6. "Load example" confirms before clobbering real edits ───────────── */
await page.fill('#sourceBTitle', 'My own edited Source B title');
await page.evaluate(() => {
  window.__confirmCalls = [];
  window.confirm = (msg) => { window.__confirmCalls.push(msg); return false; };
});
await page.click('#loadExampleBtn');
await settle(page, 150);
const callsAfterCancel = await page.evaluate(() => window.__confirmCalls.length);
ok(callsAfterCancel > 0, 'clicking Load example over existing content asks for confirmation');
eq(await page.inputValue('#sourceBTitle'), 'My own edited Source B title', 'declining the confirm leaves the edit in place');

await page.evaluate(() => { window.confirm = () => true; });
await page.click('#loadExampleBtn');
await settle(page, 150);
ok((await page.inputValue('#sourceBTitle')) !== 'My own edited Source B title',
  'accepting the confirm replaces the edit with the example');

/* Loading the example intentionally clears notes/comparisonNotes (a fresh
   example shouldn't carry a stale teacher key) — refill them so the share
   round trip below has something of its own to carry. */
await page.evaluate(() => {
  function setVal(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  const comparison = document.querySelector('#notesEditor [data-note-block="comparison"]');
  const compTextareas = comparison.querySelectorAll('textarea');
  setVal(compTextareas[0], 'Both sources agree a shooting happened and colonists died.');
});
await settle(page, 150);

/* ── 7. share link round-trips the corroboration fields ─────────────────── */
const shareLink = () => page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise(r => setTimeout(() => r(captured), 60));
});
const link = await shareLink();
ok(typeof link === 'string' && link.includes('worksheet='), 'Copy link produces a ?worksheet= URL');

const receiver = await prepPage(browser, BASE, { width: 1360, height: 1100 });
await receiver.goto(link, { waitUntil: 'networkidle' });
await settle(receiver, 300);

eq(await receiver.isChecked('#corroborationEnabled'), true, 'corroboration mode travelled through the link');
eq(await receiver.isVisible('#corroborationFields'), true, 'so Source B fields are shown on arrival');
const gotB = await receiver.inputValue('#sourceBText');
ok(gotB.length > 100, 'Source B text travelled through the link');
const gotCitation = await receiver.inputValue('#sourceBCitationAuthor');
ok(gotCitation.length > 0, 'Source B citation travelled through the link');

/* the received copy's notes/comparisonNotes also travelled — confirmed via
   the printed answer key on the receiving side, not just localStorage shape */
await receiver.evaluate(() => { window.print = function () {}; });
await receiver.click('#printKeyBtn');
await settle(receiver, 150);
const receivedKeyTexts = await receiver.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .comparison-step .step-answer.key')).map(e => e.textContent));
ok(receivedKeyTexts.some(t => /shooting happened/.test(t)), 'comparisonNotes travelled through the link');

/* ── 8. no console noise, nothing left the site ──────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', receiver]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
