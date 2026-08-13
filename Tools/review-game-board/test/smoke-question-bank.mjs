// smoke-question-bank.mjs — the reusable, tagged Question Bank on the
// Review Game Board, separate from any one board (rgb-bank-store.js).
//
//   node Tools/review-game-board/test/smoke-question-bank.mjs
//
// What's worth holding still:
//   1. it really is separate storage from a board (its own localStorage key
//      prefix), not shoehorned into the boards list;
//   2. entries are browsable/filterable by unit, standard AND difficulty,
//      each independently, plus free-text search;
//   3. "pull into board" COPIES selected entries into the currently-edited
//      board's categories/clues — editing or deleting the bank entry
//      afterward must never change a board that already pulled it in
//      (same one-way relationship as a JSON import already has with the
//      file it read);
//   4. the "Question Bank" panel is a genuinely separate top-level area, not
//      one more tab bolted onto a single board's edit form.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8175;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';

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
page.on('dialog', d => d.accept());

console.log('Review Game Board — the reusable question bank');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── it's its own top-level area, not nested in a board's edit form ────── */
ok(await page.isVisible('#topTabs'), 'a top-level Game Boards / Question Bank switch exists');
ok(await page.isHidden('#bankSection'), 'the bank panel starts hidden behind Game Boards');
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 200);
ok(await page.isVisible('#bankSection'), 'clicking it shows the bank panel');
ok(await page.isHidden('#boardsSection'), 'and hides the board editor/toolbar — a separate area, not a nested tab');

/* ── add a handful of tagged entries ────────────────────────────────────── */
async function addBankEntry({ question, answer, points, unit, standard, difficulty }) {
  await page.fill('#bankQuestion', question);
  await page.fill('#bankAnswer', answer);
  await page.fill('#bankPoints', String(points));
  await page.fill('#bankUnit', unit || '');
  await page.fill('#bankStandard', standard || '');
  await page.selectOption('#bankDifficulty', difficulty || '');
  await page.click('#bankAddBtn');
  await settle(page, 150);
}

await addBankEntry({ question: 'Capital of France?', answer: 'Paris', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy' });
await addBankEntry({ question: 'Capital of Peru?', answer: 'Lima', points: 200, unit: 'Unit 1', standard: '6.G.2', difficulty: 'Medium' });
await addBankEntry({ question: 'Longest river in the world?', answer: 'The Nile', points: 300, unit: 'Unit 2', standard: '6.G.1', difficulty: 'Hard' });

const stored = await page.evaluate(() => window.ReviewBankStore.listEntries());
eq(stored.length, 3, 'three entries persisted to the bank store');
const bankKeyOnly = await page.evaluate(() => Object.keys(localStorage).some(k => k === 'gvb-review-board-bank:entries'));
ok(bankKeyOnly, 'the bank lives under its own localStorage key, separate from gvb-review-board:*');

let rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 3, 'all three entries render in the list');

/* ── filtering: unit, standard, difficulty, free text — independently ──── */
await page.selectOption('#bankFilterUnit', 'Unit 1');
await settle(page, 150);
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 2, 'filtering by unit narrows to that unit’s entries');

await page.selectOption('#bankFilterDifficulty', 'Medium');
await settle(page, 150);
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 1, 'ANDed with difficulty narrows further');
ok((await page.textContent('#bankList')).includes('Lima'), 'and it’s the expected entry');

await page.click('#bankClearFiltersBtn');
await settle(page, 150);
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 3, 'Clear filters restores the full list');

await page.fill('#bankFilterQuery', 'river');
await settle(page, 200);
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 1, 'free-text search matches question/answer text');
await page.fill('#bankFilterQuery', '');
await settle(page, 150);

await page.selectOption('#bankFilterStandard', '6.G.1');
await settle(page, 150);
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 2, 'filtering by standard works independently of unit/difficulty');
await page.click('#bankClearFiltersBtn');
await settle(page, 150);

/* ── delete an entry (the France one — first in insertion order) ───────── */
const beforeDelete = await page.evaluate(() => window.ReviewBankStore.listEntries().length);
await page.click('#bankList .bank-entry button.danger');
await settle(page, 200);
const afterDelete = await page.evaluate(() => window.ReviewBankStore.listEntries());
eq(afterDelete.length, beforeDelete - 1, 'Delete removes just that one entry from the bank');
ok(!afterDelete.some(e => e.question.includes('France')), 'specifically the one whose Delete button was clicked');
rows = await page.$$('#bankList .bank-entry');
eq(rows.length, 2, 'and the list re-renders without it');

/* ── pull selected entries into a board ─────────────────────────────────── */
const checkboxes = await page.$$('#bankList .bank-entry input[type="checkbox"]');
eq(checkboxes.length, 2, 'two entries remain to select from');
for (const cb of checkboxes) await cb.check();
await page.fill('#bankPullCategory', 'World Capitals');
await page.click('#bankPullBtn');
await settle(page, 300);

ok(await page.isVisible('#boardsSection'), 'pulling switches the view back to Game Boards');
ok(await page.isVisible('#setupCard'), 'and opens the board editor (no board existed yet, so a fresh one)');
const catNames = await page.$$eval('#categoriesEditor .cat-name-input', els => els.map(e => e.value));
ok(catNames.includes('World Capitals'), 'the target category was created: ' + JSON.stringify(catNames));

const pulledRows = await page.$$('#categoriesEditor .category-block:has(.cat-name-input[value="World Capitals"]) .clue-row');
// Playwright's :has()/[value=] combo can be finicky across engines; fall back to a plain evaluate if it found nothing.
let pulledQuestions;
if (pulledRows.length) {
  pulledQuestions = await Promise.all(pulledRows.map(r => r.$eval('.clue-question', el => el.value)));
} else {
  pulledQuestions = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll('#categoriesEditor .category-block'));
    const block = blocks.find(b => b.querySelector('.cat-name-input').value === 'World Capitals');
    return block ? Array.from(block.querySelectorAll('.clue-question')).map(el => el.value) : [];
  });
}
eq(pulledQuestions.length, 2, 'both selected bank questions were pulled in as clue rows');
ok(pulledQuestions.some(q => q.includes('Capital of Peru')), 'including the Peru question: ' + JSON.stringify(pulledQuestions));

await page.fill('#boardName', 'Geography Review');
await page.click('#buildFromManualBtn');
await settle(page, 400);

const savedBoard = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Geography Review')));
const worldCapitals = savedBoard.categories.find(c => c.name === 'World Capitals');
ok(!!worldCapitals, 'the board was saved with the pulled category');
eq(worldCapitals.clues.length, 2, 'and both pulled clues are on it');
const limaClue = worldCapitals.clues.find(c => c.answer === 'Lima');
ok(!!limaClue && limaClue.points === 200, 'points/question/answer copied through correctly: ' + JSON.stringify(limaClue));

/* ── a COPY, not a live reference: deleting the bank entry afterward doesn't touch the board ── */
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 200);
const bankNow = await page.evaluate(() => window.ReviewBankStore.listEntries());
eq(bankNow.length, 2, 'the two pulled entries are still independently sitting in the bank');
for (const entry of bankNow) {
  await page.evaluate(id => window.ReviewBankStore.deleteEntry(id), entry.id);
}
await settle(page, 150);
const boardAfterBankWipe = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gvb-review-board:data:Geography Review')));
const stillThere = boardAfterBankWipe.categories.find(c => c.name === 'World Capitals');
eq(stillThere.clues.length, 2, 'wiping the bank entirely leaves the already-saved board completely unaffected');

/* ── no console noise, nothing left the site ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
