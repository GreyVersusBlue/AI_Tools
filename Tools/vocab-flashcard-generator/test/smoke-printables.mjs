// smoke-printables.mjs — the four "more printables" formats (word search,
// crossword, bingo, matching quiz) built from the same saved word list.
//
//   node Tools/vocab-flashcard-generator/test/smoke-printables.mjs
//
// The generation math itself (every word search term really is at its
// reported grid position, every crossword answer really fills its numbered
// slot, every bingo cell really comes from the caller's list, every matching
// answer key really points at the right definition) is checked without a
// browser in printables-logic.test.mjs, next to this file. This suite is
// the browser-level half: the four new mode tabs are reachable, each one's
// Print button produces the right page shape in #printArea, the too-few
// case for a short list shows a message instead of window.print()-ing
// garbage, and none of it throws a console error or reaches offsite.
//
// Exits 1 on any failure. Every word here is invented or public-domain.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8172;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Vocabulary Flashcards — word search / crossword / bingo / matching quiz printables');

const page = await prepPage(browser, BASE, { width: 1360, height: 980 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── a real-sized, definition-bearing list so all four formats have enough
   to work with (crossword especially needs shared letters) ────────────── */
const WORDS = [
  'Photosynthesis: process plants use to make food from sunlight',
  'Mitosis: a kind of cell division',
  'Osmosis: movement of water across a membrane',
  'Ecosystem: a community of living things and their surroundings',
  'Enzyme: a protein that speeds up a reaction',
  'Chlorophyll: the green pigment that captures light energy',
  'Nucleus: the control center of a cell',
  'Habitat: the natural home of a plant or animal',
  'Organism: any individual living thing',
].join('\n'); // 9 terms — exactly the bingo minimum (3x3), plenty for the other three

await page.fill('#listName', 'Cell & Ecology Vocab');
await page.fill('#wordInput', WORDS);
await page.dispatchEvent('#wordInput', 'input');
await settle(page, 300);

/** Click a mode tab by its data-mode, wait for the preview to settle. */
async function selectMode(mode) {
  await page.click(`.mode-tab[data-mode="${mode}"]`);
  await settle(page, 250);
}

/** Click Print, capture what #printArea ended up holding, without ever
    letting the OS print dialog actually appear (window.print is stubbed). */
async function captureCounts(selector) {
  return page.evaluate((sel) => {
    window.print = () => {}; // never actually open a print dialog in CI
    document.getElementById('printBtn').click();
    const area = document.getElementById('printArea');
    return {
      pages: area.querySelectorAll(':scope > .page').length,
      matches: area.querySelectorAll(sel).length,
      printAreaHtml: area.innerHTML.length,
    };
  }, selector);
}

/* ── word search ─────────────────────────────────────────────────────── */
await selectMode('wordsearch');
ok(await page.isVisible('#wsOptions'), 'word-search options panel shows for the word-search tab');
const wsCounts = await captureCounts('.ws-grid');
eq(wsCounts.pages, 2, 'word search prints 2 pages (puzzle + answer key)');
eq(wsCounts.matches, 2, 'both pages carry a letter grid');
const wsPreviewHasWordlist = await page.$$eval('#previewArea .ws-wordlist li', (e) => e.length);
ok(wsPreviewHasWordlist >= 3, 'the live preview shows a word list to find');

/* ── crossword ────────────────────────────────────────────────────────── */
await selectMode('crossword');
ok(await page.isVisible('#cwOptions'), 'crossword options panel shows for the crossword tab');
const cwCounts = await captureCounts('.cw-grid');
eq(cwCounts.pages, 2, 'crossword prints 2 pages (clues + answer key)');
eq(cwCounts.matches, 2, 'both pages carry a crossword grid');
const cwClueCount = await page.$$eval('#previewArea .cw-clue-list li', (e) => e.length);
ok(cwClueCount >= 2, 'the live preview lists at least two numbered clues');

/* ── bingo ────────────────────────────────────────────────────────────── */
await selectMode('bingo');
ok(await page.isVisible('#bingoOptions'), 'bingo options panel shows for the bingo tab');
await page.fill('#bingoCount', '3');
await page.dispatchEvent('#bingoCount', 'input');
await settle(page, 250);
const bgCounts = await captureCounts('.bingo-grid, .bingo-caller-list');
eq(bgCounts.pages, 4, '3 requested cards print as 3 card pages + 1 caller-list page');
const bgGridCount = await page.evaluate(() => document.querySelectorAll('#printArea .bingo-grid').length);
eq(bgGridCount, 3, 'exactly 3 bingo-card grids were printed');
const bgCallerItems = await page.evaluate(() => {
  const list = document.querySelector('#printArea .bingo-caller-list');
  return list ? list.querySelectorAll('li').length : 0;
});
eq(bgCallerItems, 9, "the caller's master list has all 9 words");

/* ── matching quiz ────────────────────────────────────────────────────── */
await selectMode('matching');
ok(await page.isVisible('#matchOptions'), 'matching-quiz options panel shows for the matching tab');
const mqCounts = await captureCounts('.match-columns, .match-answer-list');
eq(mqCounts.pages, 2, 'matching quiz prints 2 pages (quiz + answer key)');
const mqLeftRows = await page.$$eval('#previewArea .match-row', (e) => e.length);
ok(mqLeftRows > 0, 'the live preview shows matching rows');

/* ── a short list gets an honest message, not a garbage puzzle ───────────
   One term is below every generator's minimum (word search/crossword need
   3+, bingo needs 9+, matching needs 2+), so this exercises the too-few
   path in all four at once. */
page.on('dialog', (d) => d.accept());
await page.fill('#wordInput', 'Ox: a large animal');
await page.dispatchEvent('#wordInput', 'input');
await settle(page, 250);
for (const mode of ['wordsearch', 'crossword', 'bingo', 'matching']) {
  await selectMode(mode);
  const msg = await page.textContent('#previewArea');
  ok(/needs at least|Bingo cards need/.test(msg), `${mode}: a too-short list explains why instead of showing a puzzle`);
  let dialogMsg = null;
  page.once('dialog', (d) => { dialogMsg = d.message(); });
  await page.click('#printBtn');
  await settle(page, 200);
  ok(dialogMsg && /needs at least|Bingo cards need/.test(dialogMsg), `${mode}: Print button also refuses with the same explanation`);
}

/* ── no console noise, nothing left the site ─────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 5)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 5)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
