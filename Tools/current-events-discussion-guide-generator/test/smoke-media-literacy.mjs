// smoke-media-literacy.mjs — the media literacy kit and the three class levels.
//
//   node Tools/current-events-discussion-guide-generator/test/smoke-media-literacy.mjs
//
// Round 1 turned this tool into a two-article comparison guide (covered by
// smoke-comparison.mjs, which stays the regression net for that). Round 2
// added three optional printable kit pages — a SIFT source-evaluation
// checklist, a headline rewrite exercise, and a claim vs. evidence organizer —
// plus the site-wide Academic / Honors / Honors GT differentiation spec.
//
// What this suite pins down:
//   * with nothing toggled the printed guide is still the round-1 guide, so a
//     teacher who never touches the kit sees no change;
//   * each kit page renders only when its own checkbox is on;
//   * SIFT splits into two labelled columns once Article B has real text;
//   * the level genuinely changes the printed output (Academic scaffolds,
//     Honors is the baseline, Honors GT extends) and "Print all three levels"
//     emits three level-tagged sets in one pass;
//   * the new fields ride the existing guide object through a reload and a
//     share link, and a link built before this round still opens at the
//     pre-round defaults instead of breaking.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8173;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/054-current-events-discussion-guide-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ARTICLE_A = 'The town council voted to approve the new skateboarding facility after a long committee review. Skateboarding has grown popular with teenagers downtown.';
const ARTICLE_B = 'The town council voted to approve the skateboarding facility, but several businesses worry about lost parking. Skateboarding fans have been asking for the change for months.';

/** Renders the print sheet without opening a real print dialog, then reports
 *  on what actually landed in #printArea. */
const printAndRead = (page, buttonId = 'printBtn') => page.evaluate((id) => {
  window.print = function () {};
  document.getElementById(id).click();
  const area = document.getElementById('printArea');
  const text = area.textContent;
  return {
    text,
    sections: Array.from(area.querySelectorAll('.guide-section h3')).map((h) => h.textContent.trim()),
    siftMoves: area.querySelectorAll('.sift-move').length,
    siftColLabels: Array.from(area.querySelectorAll('.sift-cols .sift-col h5')).map((h) => h.textContent),
    hasSift: /Checking the Source/.test(text),
    hasHeadline: /Rewriting the Headline/.test(text),
    hasClaims: /Claim vs\. Evidence/.test(text),
    headlineQuotes: Array.from(area.querySelectorAll('.headline-quote')).map((q) => q.textContent),
    matchRows: area.querySelectorAll('.match-table tbody tr').length,
    claimHeaders: Array.from(area.querySelectorAll('.claim-table thead th')).map((h) => h.textContent.trim()),
    claimCells: Array.from(area.querySelectorAll('.claim-table tbody tr')).map(
      (tr) => Array.from(tr.children).map((td) => td.textContent.trim())),
    claimBlanks: area.querySelectorAll('.claim-table td.blank-cell').length,
    starters: area.querySelectorAll('.starter').length,
    steps: area.querySelectorAll('.sift-steps').length,
    glossary: area.querySelectorAll('.glossary-box').length,
    fillLines: area.querySelectorAll('.fill-line').length,
    levelSets: area.querySelectorAll('.level-set').length,
    levelBanners: Array.from(area.querySelectorAll('.level-banner')).map((b) => b.textContent),
    levelFooters: Array.from(area.querySelectorAll('.level-footer')).map((f) => f.textContent),
    levelChips: Array.from(area.querySelectorAll('.level-chip')).map((c) => c.textContent),
  };
}, buttonId);

const setLevel = (page, level) => page.evaluate((v) => {
  const sel = document.getElementById('levelSelect');
  sel.value = v;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}, level);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
page.on('dialog', (d) => d.accept());

console.log('Current Events Discussion Guide Generator — media literacy kit + class levels');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. defaults: Honors, kit off, printed guide unchanged from round 1 ─── */
eq(await page.inputValue('#levelSelect'), 'honors', 'the level defaults to Honors (the baseline)');
eq(await page.isChecked('#kitSift'), false, 'the SIFT checklist starts off');
eq(await page.isChecked('#kitHeadline'), false, 'the headline exercise starts off');
eq(await page.isChecked('#kitClaims'), false, 'the claim organizer starts off');
ok(!(await page.isVisible('#claimEditor')), 'the claim-row editor is hidden until the organizer is on');

await page.fill('#articleTitle', 'Council Approves Skateboarding Facility');
await page.fill('#articleSource', 'Town Herald');
await page.fill('#articleText', ARTICLE_A);
await page.dispatchEvent('#articleText', 'input');
await settle(page, 200);

let printed = await printAndRead(page);
ok(!printed.hasSift && !printed.hasHeadline && !printed.hasClaims,
  'with nothing ticked, no kit page prints: ' + JSON.stringify(printed.sections));
eq(printed.starters, 0, 'and Honors prints no sentence starters');
eq(printed.glossary, 0, 'and no word-gloss box');
ok(/Level: Honors/.test(printed.text), 'the sheet is still footer-tagged with its level');

/* ── 2. each kit page appears only when its own box is ticked ───────────── */
await page.check('#kitSift');
await settle(page, 150);
printed = await printAndRead(page);
ok(printed.hasSift, 'ticking the SIFT box prints the source evaluation checklist');
ok(!printed.hasHeadline && !printed.hasClaims, 'and only that one');
eq(printed.siftMoves, 4, 'all four SIFT moves print');
['Stop', 'Investigate the source', 'Find better coverage', 'Trace the claim'].forEach((move) => {
  ok(printed.text.indexOf(move) !== -1, `the "${move}" move is on the sheet`);
});
ok(/cannot look/.test(printed.text) || /nothing on this page can look/.test(printed.text),
  'the sheet says plainly that it cannot look up other coverage for you');
eq(printed.siftColLabels.length, 0, 'with one article, SIFT prints as a single column');

await page.check('#kitHeadline');
await settle(page, 150);
printed = await printAndRead(page);
ok(printed.hasHeadline, 'ticking the headline box prints the rewrite exercise');
eq(printed.headlineQuotes.length, 1, 'the real headline is quoted back once');
ok(printed.headlineQuotes[0].indexOf('Council Approves Skateboarding Facility') !== -1,
  'and it is the headline the teacher actually typed: ' + printed.headlineQuotes[0]);
ok(/neutrally as you can/.test(printed.text), 'task 1 asks for a neutral rewrite');
ok(/slanted the other way/.test(printed.text), 'task 2 asks for a rewrite slanted the other way');
ok(/What did you have to change/.test(printed.text), 'and task 3 is the reflection line');
eq(printed.matchRows, 0, 'the headline-matching block stays off a single-article sheet');

await page.check('#kitClaims');
await settle(page, 200);
ok(await page.isVisible('#claimEditor'), 'ticking the organizer reveals the claim-row editor');
eq(await page.locator('#claimRows .claim-row').count(), 3, 'and seeds three blank rows to show the shape');

printed = await printAndRead(page);
ok(printed.hasClaims, 'the claim vs. evidence organizer prints');
eq(printed.claimHeaders.length, 3, 'three columns on a single-article sheet');
ok(/Fact, opinion, or spin/.test(printed.claimHeaders[2]), 'the third column is the fact/opinion/spin tag');
ok(/no evidence given/.test(printed.text), 'the sheet tells students "no evidence given" is a real answer');
eq(printed.claimCells.length, 3, 'three rows print');
eq(printed.claimBlanks, 9, 'and every cell of an unfilled table prints as writing space');

/* ── 3. a teacher can pre-fill rows; pre-filled text prints as-is ───────── */
await page.evaluate(() => {
  const rows = document.querySelectorAll('#claimRows .claim-row');
  const set = (row, cls, value) => {
    const el = row.querySelector(cls);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(rows[0], '.claim-claim', 'Skateboarding has grown popular with teenagers downtown.');
  set(rows[1], '.claim-claim', 'The committee review took a long time.');
});
await settle(page, 200);
printed = await printAndRead(page);
eq(printed.claimCells[0][0], 'Skateboarding has grown popular with teenagers downtown.',
  'a pre-filled claim prints in the table');
eq(printed.claimCells[0][1], '', 'while the evidence column stays blank for the student');
eq(printed.claimCells[2][0], '', 'and a row the teacher left alone prints entirely blank');

/* ── 4. levels change the printed output ───────────────────────────────── */
const honors = await printAndRead(page);

await setLevel(page, 'academic');
await settle(page, 150);
const academic = await printAndRead(page);
ok(academic.starters > 0, `Academic adds sentence starters (${academic.starters})`);
ok(academic.steps >= 4, `Academic chunks the long prompts into numbered steps (${academic.steps})`);
eq(academic.glossary, 1, 'Academic prints one plain-language gloss of the kit vocabulary');
ok(/spin:/.test(academic.text), 'and the gloss defines the words the kit itself introduces');
ok(academic.fillLines > honors.fillLines,
  `Academic gets more writing space, not less (${academic.fillLines} vs ${honors.fillLines})`);
ok(academic.text.indexOf('Stop') !== -1 && academic.text.indexOf('Trace the claim') !== -1,
  'Academic still gets all four SIFT moves — more scaffolding, not fewer questions');
ok(/Level: Academic/.test(academic.text), 'the Academic sheet is tagged Academic');

await setLevel(page, 'gt');
await settle(page, 150);
const gt = await printAndRead(page);
eq(gt.starters, 0, 'Honors GT drops the sentence starters');
eq(gt.glossary, 0, 'and the word-gloss box');
ok(/find a third report/.test(gt.text), 'Honors GT adds the third-source extension prompt');
ok(gt.sections.indexOf('So What?') !== -1, 'and a closing synthesis question: ' + JSON.stringify(gt.sections));
ok(honors.sections.indexOf('So What?') === -1, 'which Honors does not get');
ok(academic.sections.indexOf('So What?') === -1, 'and Academic does not get either');
ok(/Level: Honors GT/.test(gt.text), 'the GT sheet is tagged Honors GT');

/* ── 5. "Print all three levels" emits three tagged sets ────────────────── */
const all = await printAndRead(page, 'printAllLevelsBtn');
eq(all.levelSets, 3, 'three class sets print in one pass');
eq(all.levelBanners.length, 3, 'each set opens with a level banner');
ok(/Academic/.test(all.levelBanners[0]), 'Academic first: ' + all.levelBanners[0]);
ok(/Honors/.test(all.levelBanners[1]) && !/GT/.test(all.levelBanners[1]), 'then Honors: ' + all.levelBanners[1]);
ok(/Honors GT/.test(all.levelBanners[2]), 'then Honors GT: ' + all.levelBanners[2]);
eq(all.levelFooters.length, 3, 'each set closes with its own level footer');
ok(/Level: Academic/.test(all.levelFooters[0]) && /Level: Honors GT/.test(all.levelFooters[2]),
  'and the footers name the level so the piles can be sorted');
ok(all.levelChips.length >= 9, `every section head carries a level chip too (${all.levelChips.length})`);
ok(all.levelChips.indexOf('Academic') !== -1 && all.levelChips.indexOf('Honors GT') !== -1,
  'chips name all three levels: ' + JSON.stringify(Array.from(new Set(all.levelChips))));
ok(all.text.split('Checking the Source').length - 1 === 3, 'the SIFT page prints once per level');

/* ── 6. level + kit ride the guide object through a reload ──────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#levelSelect'), 'gt', 'the chosen level survives a reload');
eq(await page.isChecked('#kitSift'), true, 'and the SIFT toggle');
eq(await page.isChecked('#kitClaims'), true, 'and the claim organizer toggle');
eq(await page.locator('#claimRows .claim-row').count(), 3, 'and the claim rows');
eq(await page.locator('#claimRows .claim-row').first().locator('.claim-claim').inputValue(),
  'Skateboarding has grown popular with teenagers downtown.', 'with the teacher\'s text intact');

/* ── 7. SIFT goes two-column once there is a second article ─────────────── */
await page.click('#addArticleBBtn');
await page.fill('#articleTitleB', 'Business Owners Raise Parking Concerns');
await page.fill('#articleSourceB', 'Town Herald, second edition');
await page.fill('#articleTextB', ARTICLE_B);
await page.dispatchEvent('#articleTextB', 'input');
await settle(page, 300);

const compared = await printAndRead(page);
eq(compared.siftColLabels.length, 8, 'each of the four SIFT moves gets a column per article');
ok(compared.siftColLabels[0].indexOf('Council Approves Skateboarding Facility') !== -1,
  'the left column is labelled with Article A\'s headline: ' + compared.siftColLabels[0]);
ok(compared.siftColLabels[1].indexOf('Business Owners Raise Parking Concerns') !== -1,
  'the right column with Article B\'s: ' + compared.siftColLabels[1]);
eq(compared.headlineQuotes.length, 2, 'both real headlines are quoted on the rewrite page');
eq(compared.matchRows, 5, 'and the headline-to-framing matching block appears');
ok(/A, B, both, or neither/.test(compared.text), 'with a clear instruction for how to answer it');
eq(compared.claimHeaders.length, 4, 'the claim organizer gains an "Article" column when comparing');
eq(compared.claimHeaders[0], 'Article', 'named plainly: ' + compared.claimHeaders[0]);
eq(await page.locator('#claimRows .claim-row .claim-article').count(), 3,
  'and the editor grows an A/B picker per row');

/* ── 8. a share link carries the new fields; the old link shape still works ─ */
const shareUrl = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareLinkBtn').click();
  return new Promise((r) => setTimeout(() => r(captured), 80));
});
ok(shareUrl && shareUrl.indexOf('guide=') !== -1, 'Copy link still produces a ?guide= link');

const recipient = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await recipient.goto(shareUrl, { waitUntil: 'networkidle' });
await settle(recipient, 300);
eq(await recipient.inputValue('#levelSelect'), 'gt', 'the recipient gets the sender\'s level');
eq(await recipient.isChecked('#kitSift'), true, 'and the SIFT toggle');
eq(await recipient.isChecked('#kitHeadline'), true, 'and the headline toggle');
eq(await recipient.isChecked('#kitClaims'), true, 'and the claim organizer toggle');
eq(await recipient.locator('#claimRows .claim-row').count(), 3, 'and the pre-filled claim rows');
eq(await recipient.locator('#claimRows .claim-row').first().locator('.claim-claim').inputValue(),
  'Skateboarding has grown popular with teenagers downtown.', 'with their text intact');
const recipientPrint = await printAndRead(recipient);
ok(recipientPrint.hasSift && recipientPrint.hasHeadline && recipientPrint.hasClaims,
  'and the whole kit prints on the recipient\'s side');

/* A link built before this round has none of the new keys on it at all. */
const legacyUrl = await page.evaluate(() => window.StateLink.buildShareUrl('guide', {
  name: 'Pre-round Guide',
  title: 'An Older Shared Guide',
  source: 'Town Herald',
  articleText: 'A guide shared before the media literacy kit existed.',
  summary: 'Still readable.',
  vocab: [{ id: 'v1', term: 'council', def: '' }],
  presetChecked: {},
  customQuestions: [],
}));
const legacy = await prepPage(browser, BASE, { width: 1280, height: 1000 });
await legacy.goto(legacyUrl, { waitUntil: 'networkidle' });
await settle(legacy, 300);
eq(await legacy.inputValue('#articleTitle'), 'An Older Shared Guide', 'a pre-round share link still opens');
eq(await legacy.inputValue('#levelSelect'), 'honors', 'and falls back to the Honors baseline');
eq(await legacy.isChecked('#kitSift'), false, 'with the kit off, exactly as it printed before this round');
const legacyPrint = await printAndRead(legacy);
ok(!legacyPrint.hasSift && !legacyPrint.hasHeadline && !legacyPrint.hasClaims,
  'so an old guide prints the same sheet it always did');

/* ── 9. Load example brings up the whole kit in one click ───────────────── */
const demo = await prepPage(browser, BASE, { width: 1280, height: 1000 });
demo.on('dialog', (d) => d.accept());
await demo.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(demo, 300);
await demo.click('#loadExampleBtn');
await settle(demo, 400);

eq(await demo.isChecked('#kitSift'), true, 'the example turns on the SIFT checklist');
eq(await demo.isChecked('#kitHeadline'), true, 'and the headline exercise');
eq(await demo.isChecked('#kitClaims'), true, 'and the claim organizer');
eq(await demo.locator('#claimRows .claim-row').count(), 3, 'and pre-fills three claims from the two articles');
const demoPrint = await printAndRead(demo);
ok(demoPrint.hasSift && demoPrint.hasHeadline && demoPrint.hasClaims,
  'so one click demos the entire kit');
ok(/mostly empty/.test(demoPrint.text) && /full on weekends/.test(demoPrint.text),
  'including the two example claims that contradict each other, which is the lesson');
eq(demoPrint.siftColLabels.length, 8, 'and the example lands in two-column comparison mode');
ok(/Skate Park/i.test(demoPrint.headlineQuotes[0]), 'with the real example headlines quoted back: ' + demoPrint.headlineQuotes[0]);

/* ── 10. no console noise, nothing left the site ────────────────────────── */
for (const [label, p] of [['main', page], ['recipient', recipient], ['legacy', legacy], ['demo', demo]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
