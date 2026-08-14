// smoke-comparison.mjs — the two-article comparison guide.
//
//   node Tools/current-events-discussion-guide-generator/test/smoke-comparison.mjs
//
// The tool used to handle exactly one article. This suite covers the new
// optional Article B: its fields ride on the same named-guide object and
// survive a reload, the shared vocabulary list flags words that show up in
// BOTH articles (the event's "core" vocabulary) rather than either article
// alone, the printed guide switches to a side-by-side layout with the
// bias/framing question set once Article B has real text, and a guide can
// travel to another tab as a share link the same way a single-article guide
// already could.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8172;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/054-current-events-discussion-guide-generator.html';

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
page.on('dialog', (d) => d.accept()); // confirm()s from Remove Article B / Clear & start over

const ARTICLE_A = 'The town council voted to approve the new skateboarding facility after a long committee review. Skateboarding has grown popular with teenagers downtown.';
const ARTICLE_B = 'The town council voted to approve the skateboarding facility, but several businesses worry about lost parking. Skateboarding fans have been asking for the change for months.';

console.log('Current Events Discussion Guide Generator — two-article comparison');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. Article B is opt-in, and its fields persist ─────────────────────── */
ok(!(await page.isVisible('#articleBCard')), 'Article B starts hidden');
await page.click('#addArticleBBtn');
ok(await page.isVisible('#articleBCard'), '"+ Add Article B" reveals the second article card');

await page.fill('#articleTitle', 'Council Approves Skateboarding Facility');
await page.fill('#articleSource', 'Town Herald');
await page.fill('#articleText', ARTICLE_A);
await page.dispatchEvent('#articleText', 'input');
await page.fill('#articleTitleB', 'Business Owners Raise Parking Concerns');
await page.fill('#articleSourceB', 'Town Herald, second edition');
await page.fill('#articleTextB', ARTICLE_B);
await page.dispatchEvent('#articleTextB', 'input');
await settle(page, 300);

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#articleTitleB'), 'Business Owners Raise Parking Concerns', 'Article B headline survives a reload');
eq(await page.inputValue('#articleSourceB'), 'Town Herald, second edition', 'Article B source survives a reload');
eq(await page.inputValue('#articleTextB'), ARTICLE_B, 'Article B body survives a reload');
ok(await page.isVisible('#articleBCard'), 'and the card stays open on reload since Article B has content');

/* ── 2. analyzing merges suggestions and flags shared vocabulary ────────── */
await page.click('#analyzeBtn');
await settle(page, 300);

/* Add one word that appears in BOTH articles and one that appears in only one. */
await page.click('#addVocabBtn');
await page.click('#addVocabBtn');
const rows = await page.$$('#vocabWrap .vocab-row');
eq(rows.length, 2, 'two blank vocab rows were added');
await rows[0].$eval('input.term', (el) => { el.value = 'skateboarding'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await rows[1].$eval('input.term', (el) => { el.value = 'committee'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await settle(page, 200);
/* The "both" badge is computed at render time (add/delete/analyze), not on
   every keystroke, so trigger a re-render the same way adding a word does. */
await page.click('#addVocabBtn');
await page.locator('#vocabWrap .vocab-row').last().locator('[data-del]').click();
await settle(page, 200);

const vocabState = await page.evaluate(() => Array.from(document.querySelectorAll('#vocabWrap .vocab-row')).map((row) => ({
  term: row.querySelector('input.term').value,
  both: row.classList.contains('both'),
})));
const shared = vocabState.find((v) => v.term === 'skateboarding');
const onlyOne = vocabState.find((v) => v.term === 'committee');
ok(shared && shared.both, '"skateboarding" (in both articles) is flagged as shared');
ok(onlyOne && !onlyOne.both, '"committee" (only in Article A) is not flagged as shared');

/* ── 3. the comparison question set shows up, print renders both articles ─ */
ok(await page.isVisible('#comparisonQuestionsWrap'), 'the bias/framing question set appears once Article B has text');
const compQCount = await page.locator('#comparisonQuestions .q-row').count();
ok(compQCount >= 4, `there are several comparison-only questions (${compQCount})`);

await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page, 300);
const printed = await page.evaluate(() => ({
  hasCompareCols: !!document.querySelector('#printArea .compare-cols'),
  colHeads: Array.from(document.querySelectorAll('#printArea .compare-col h3')).map((h) => h.textContent),
  hasCoreTag: !!document.querySelector('#printArea .core-tag'),
  hasComparisonSection: /Comparing These Two Articles/.test(document.getElementById('printArea').textContent),
}));
ok(printed.hasCompareCols, 'the printed guide uses the side-by-side comparison layout');
eq(printed.colHeads.length, 2, 'two article columns printed');
ok(printed.colHeads[0].indexOf('Council Approves Skateboarding Facility') !== -1, 'Article A headline printed: ' + printed.colHeads[0]);
ok(printed.colHeads[1].indexOf('Business Owners Raise Parking Concerns') !== -1, 'Article B headline printed: ' + printed.colHeads[1]);
ok(printed.hasCoreTag, 'the shared ("core") vocabulary is marked in the printed table');
ok(printed.hasComparisonSection, 'the bias/framing questions print under their own section');

/* ── 4. removing Article B clears it back to a single-article guide ─────── */
await page.click('#removeArticleBBtn');
await settle(page, 200);
ok(!(await page.isVisible('#articleBCard')), 'Remove Article B collapses the card');
eq(await page.inputValue('#articleTitleB'), '', 'and clears its fields');

/* ── 5. a shared link round-trips a comparison guide to a fresh tab ─────── */
await page.click('#addArticleBBtn');
await page.fill('#articleTitleB', 'Business Owners Raise Parking Concerns');
await page.fill('#articleSourceB', 'Town Herald, second edition');
await page.fill('#articleTextB', ARTICLE_B);
await page.dispatchEvent('#articleTextB', 'input');
await settle(page, 300);

const shareUrl = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise((r) => setTimeout(() => r(captured), 80));
});
ok(shareUrl && shareUrl.indexOf('guide=') !== -1, 'Copy link produces a ?guide= link');

const other = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await other.goto(shareUrl, { waitUntil: 'networkidle' });
await settle(other, 300);
eq(await other.inputValue('#articleTitle'), 'Council Approves Skateboarding Facility', 'the recipient sees Article A');
eq(await other.inputValue('#articleTextB'), ARTICLE_B, 'and Article B, imported intact');
ok(await other.isVisible('#articleBCard'), 'with the comparison card already open');
const names = await page.evaluate(() => JSON.parse(localStorage.getItem('cedg_guides_v1') || '[]'));
const otherNames = await other.evaluate(() => JSON.parse(localStorage.getItem('cedg_guides_v1') || '[]'));
ok(otherNames.length >= 1, 'the shared link saved as a guide on the recipient side');
ok(names.length >= 1, 'and the sender kept their own guide (a shared link does not overwrite the sender)');

/* ── 6. Load example — the demo centerpiece: one click, both articles ──── */
const demo = await prepPage(browser, BASE, { width: 1280, height: 1000 });
demo.on('dialog', (d) => d.accept());
await demo.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(demo, 300);
await demo.click('#loadExampleBtn');
await settle(demo, 300);

const example = await demo.evaluate(() => ({
  titleA: document.getElementById('articleTitle').value,
  titleB: document.getElementById('articleTitleB').value,
  bodyBFilled: document.getElementById('articleTextB').value.length > 100,
  summaryA: document.getElementById('summaryText').value,
  summaryB: document.getElementById('summaryTextB').value,
  cardOpen: document.getElementById('articleBCard').style.display !== 'none',
  bothChips: Array.from(document.querySelectorAll('.word-chip.both')).map((c) => c.textContent.trim()),
}));
ok(/Skate Park/i.test(example.titleA), 'Load example fills Article A (skate park framing): ' + example.titleA);
ok(/Parking Lot/i.test(example.titleB), 'and Article B (parking-loss framing): ' + example.titleB);
ok(example.bodyBFilled, 'Article B body is a real article, not a stub');
ok(example.summaryA.length > 0, 'the analyzer auto-seeds a summary for Article A');
ok(example.summaryB.length > 0, 'and for Article B');
ok(example.cardOpen, 'the Article B card is open after loading the example');
ok(example.bothChips.length > 0, 'at least one suggested word is flagged as shared between the two example articles: ' + JSON.stringify(example.bothChips));

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
for (const [label, p] of [['main', page], ['recipient', other], ['demo', demo]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
