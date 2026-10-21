// smoke-named-sets.mjs — named sets on the Review Game Board's question bank
// (Path 12 P2, v300; Devon, 2026-10-07: "B", an ordered list saved with the
// bank). The storage is _shared/question-bank.js's NAMED SETS; its pure half
// is Tools/question-bank/test/question-bank-sets.test.mjs.
//
//   node Tools/review-game-board/test/smoke-named-sets.mjs        (port 8533)
//
// What's worth holding still:
//   1. ticked questions make a set, in the list's order, and more are added
//      at its end, a question twice and a built-in question among them, with
//      nothing copied into the bank;
//   2. "Questions from" lists the set after the bank; chosen, the list shows
//      it numbered, in order, with Up, Down and Remove from set, the focus
//      staying with the row that moved; Rename and Delete this set work, and
//      deleting the set keeps its questions;
//   3. the set is pulled into a board whole and in order, and printed in order;
//   4. an edit to a question shows in the set, and deleting it in the bank
//      takes it out of the set;
//   5. the bank file carries the sets; importing it into another bank shows
//      the set first, adds it beside one of the same name (never over it),
//      and the same file again adds nothing;
//   6. a set name that is markup is text, and the set view is clean under axe.
// A bank with no set is unchanged: smoke-bank-editor.mjs's sixteen pins hold
// that. Every question is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8533;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const KEY = 'gvb-question-bank';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
const dialogs = [];
let dialogAnswer = true;
page.on('dialog', d => { dialogs.push(d.message()); return dialogAnswer ? d.accept() : d.dismiss(); });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

console.log('Review Game Board — named sets');

const BANK = { v: 1, data: { schema: 1, questions: [
  { id: 'q-a', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 3', standard: '', difficulty: 'Easy', tags: [], points: 100, createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'q-b', prompt: 'Longest river?', answer: 'The Nile', unit: 'Unit 3', standard: '', difficulty: 'Hard', tags: [], points: 200, createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'q-c', prompt: '3 x 4?', answer: '12', unit: 'Unit 1', standard: '', difficulty: '', tags: [], points: 300, createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'q-d', prompt: 'Opposite of up?', answer: 'Down', unit: 'Unit 1', standard: '', difficulty: '', tags: [], points: 400, createdAt: '2026-10-01T10:00:00.000Z' },
], legacy: {} } };

async function open(storage) {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, storage);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.click('.top-tab-btn[data-top="bank"]');
  await settle(page, 200);
}
const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const sets = async () => ((await stored()).data.sets || []);
const rowsShown = () => page.$$eval('#bankList .bank-entry .bank-q', n => n.map(x => x.textContent));
const status = () => page.textContent('#bankSetStatus');
async function tick(prompts) {
  for (const row of await page.$$('#bankList .bank-entry')) {
    const q = await row.$eval('.bank-q', n => n.textContent);
    if (prompts.includes(q)) await (await row.$('input[type="checkbox"]')).check();
  }
}
async function choose(source) { await page.selectOption('#bankSource', source); await settle(page, 150); }

/* ── 1. making a set ────────────────────────────────────────────────────── */
console.log('1. ticked questions make a set; more go on its end');
await open({ [KEY]: JSON.stringify(BANK) });
eq([await page.isVisible('#bankSetAddRow'), await page.isVisible('#bankSetEditRow'), await page.inputValue('#bankSetTarget')], [true, false, ''], 'the bank shows "Add the ticked questions to", a new set by default');
await page.click('#bankSetAddBtn');
eq(await status(), 'Tick at least one question first.', 'with nothing ticked it says so');
await tick(['Longest river?', 'Capital of Peru?']);
await page.click('#bankSetAddBtn');
eq(await status(), 'Name the new set first.', 'with no name it says so');
eq(await page.evaluate(() => document.activeElement.id), 'bankSetName', 'and puts the focus on the name');
await page.fill('#bankSetName', 'Unit 3 review');
await page.click('#bankSetAddBtn');
await settle(page, 150);
let s = await sets();
eq([s.length, s[0].name, s[0].items, (await stored()).data.schema], [1, 'Unit 3 review', ['q-a', 'q-b'], 2], 'a set is stored with the bank, in the order the list shows, at schema 2');
ok((await status()).startsWith('Made “Unit 3 review” with 2 questions.'), 'the status says what was made');
eq(await page.$$eval('#bankList input[type="checkbox"]:checked', n => n.length), 0, 'the ticks are cleared');
eq(await page.inputValue('#bankSetTarget'), s[0].id, 'and the new set is chosen as the next target');
const SET = 'named:' + s[0].id;
eq(await page.$eval(`#bankSource option[value="${SET}"]`, o => o.textContent), 'Unit 3 review (named set, 2 questions)', '"Questions from" lists it, after the bank');
eq(await page.$$eval('#bankSource option', o => o.map(x => x.value).slice(0, 2)), ['', SET], 'right after the bank');
await tick(['Capital of Peru?', '3 x 4?']);
await page.click('#bankSetAddBtn');
await settle(page, 150);
eq((await sets())[0].items, ['q-a', 'q-b', 'q-a', 'q-c'], 'adding to it puts the ticked ones at its end, a question twice');
await choose('053');
ok(await page.isVisible('#bankSetAddRow'), 'a built-in set can add to a set too');
const seedFirst = await page.$eval('#bankList .bank-entry .bank-q', n => n.textContent);
await (await page.$('#bankList .bank-entry input[type="checkbox"]')).check();
await page.selectOption('#bankSetTarget', s[0].id);
await page.click('#bankSetAddBtn');
await settle(page, 150);
s = await sets();
eq([s[0].items.length, /^seed:053:/.test(s[0].items[4]), (await stored()).data.questions.length], [5, true, 4], 'a built-in question is added by its seed id, and nothing is copied into the bank');

/* ── 2. the set view ────────────────────────────────────────────────────── */
console.log('2. the set, chosen: numbered, in order, Up, Down, Remove, Rename, Delete');
await choose(SET);
eq(await rowsShown(), ['Capital of Peru?', 'Longest river?', 'Capital of Peru?', '3 x 4?', seedFirst], 'the list is the set, in its order, the repeat repeated');
eq(await page.$$eval('#bankList .bank-set-pos', n => n.map(x => x.textContent)), ['1.', '2.', '3.', '4.', '5.'], 'numbered');
eq([await page.isVisible('#bankFilterRow'), await page.isVisible('#bankSetAddRow'), await page.isVisible('#bankSetEditRow'), await page.isVisible('#bankPullBtn'), await page.isVisible('#bankPullSetBtn')],
  [false, false, true, false, true], 'the filters and the add row are hidden; rename, delete and "Pull the whole set" are shown');
eq(await page.inputValue('#bankSetRename'), 'Unit 3 review', 'the rename field holds the name');
ok((await page.textContent('#bankSourceNote')).startsWith('A named set is your own list'), 'and a note says what a set is');
eq(await page.$$eval('#bankList .bank-entry', rows => [rows[0].querySelector('.bank-set-up').disabled, rows[4].querySelector('.bank-set-down').disabled, rows[1].querySelector('.bank-set-up').disabled]), [true, true, false], 'the first row has no Up and the last no Down');
eq(await page.$eval('#bankList .bank-entry:nth-child(2) .bank-set-up', b => b.getAttribute('aria-label')), 'Up: 2. Longest river?', 'a button says which row it moves');
await page.click('#bankList .bank-entry:nth-child(2) .bank-set-up');
await settle(page, 150);
eq(await rowsShown(), ['Longest river?', 'Capital of Peru?', 'Capital of Peru?', '3 x 4?', seedFirst], 'Up moves it one place');
eq((await sets())[0].items.slice(0, 2), ['q-b', 'q-a'], 'and is stored');
eq(await page.evaluate(() => [document.activeElement.className.includes('bank-set') , document.activeElement.closest('.bank-entry') === document.querySelector('#bankList .bank-entry')]), [true, true], 'the focus stays with the row that moved');
eq(await page.textContent('#bankListStatus'), 'Moved to number 1 of 5.', 'and the move is said');
await page.click('#bankList .bank-entry:nth-child(3) .bank-set-down');
await settle(page, 150);
eq(await rowsShown(), ['Longest river?', 'Capital of Peru?', '3 x 4?', 'Capital of Peru?', seedFirst], 'Down moves it one place');
await page.keyboard.press('Enter');                      // the focus is on the moved row's Down: once more
await settle(page, 150);
eq(await rowsShown(), ['Longest river?', 'Capital of Peru?', '3 x 4?', seedFirst, 'Capital of Peru?'], 'and works from the keyboard, the focus still on it');
await page.click('#bankList .bank-entry:nth-child(5) .bank-set-remove');
await settle(page, 150);
eq([await rowsShown(), (await stored()).data.questions.length], [['Longest river?', 'Capital of Peru?', '3 x 4?', seedFirst], 4], 'Remove from set takes it out of the set and not the bank');
await page.fill('#bankSetRename', '  ');
await page.click('#bankSetRenameBtn');
eq(await status(), 'Give the set a name first.', 'a blank name is refused');
await page.fill('#bankSetRename', 'Unit 3, final review');
await page.click('#bankSetRenameBtn');
await settle(page, 150);
eq([(await sets())[0].name, await page.$eval(`#bankSource option[value="${SET}"]`, o => o.textContent), await page.inputValue('#bankSource')],
  ['Unit 3, final review', 'Unit 3, final review (named set, 4 questions)', SET], 'Rename renames it, and the list stays on the set');

/* ── 3. pulled and printed ──────────────────────────────────────────────── */
console.log('3. the set pulled into a board whole, and printed, in order');
await page.click('#bankPrintGuideBtn');
await settle(page, 200);
const printed = await page.textContent('#printArea');
const at = q => printed.indexOf(q);
ok(at('Longest river?') !== -1 && at('Longest river?') < at('Capital of Peru?') && at('Capital of Peru?') < at('3 x 4?') && at('3 x 4?') < at(seedFirst), 'the study guide has the set in its order');
ok(!printed.includes('Opposite of up?'), 'and nothing outside it');
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 150);
await page.fill('#bankPullCategory', 'Review');
await page.click('#bankPullSetBtn');
await settle(page, 300);
const pulled = await page.$$eval('#categoriesEditor .category-block', blocks => blocks.map(b => [b.querySelector('.cat-name-input').value,
  Array.from(b.querySelectorAll('.clue-row')).map(r => r.querySelector('.clue-question').value)]).filter(b => b[0] === 'Review'));
eq(pulled, [['Review', ['Longest river?', 'Capital of Peru?', '3 x 4?', seedFirst]]], 'the whole set is pulled into the category, in its order');
ok((await page.textContent('#bankPullStatus')).startsWith('Pulled 4 questions into "Review".'), 'and the pull is said');

/* ── 4. edits and deletes in the bank ───────────────────────────────────── */
console.log('4. an edit shows in the set; a delete takes it out');
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 150);
await choose('');
await page.evaluate(() => window.QuestionBank.saveQuestion({ id: 'q-c', prompt: '3 x 4 = ?' }));
dialogAnswer = true;
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('#bankList .bank-entry')).find(r => r.getAttribute('data-id') === 'q-b');
  row.querySelector('.danger').click();
});
await settle(page, 150);
await choose(SET);
eq(await rowsShown(), ['Capital of Peru?', '3 x 4 = ?', seedFirst], 'the set shows the edited words, and the deleted question is gone from it');
eq((await sets())[0].items.includes('q-b'), false, 'and from the stored set');

/* ── 5. the bank file ───────────────────────────────────────────────────── */
console.log('5. the bank file carries the sets; an import adds beside, never over');
await choose('');
const file = await downloadText(page, '#bankExportBtn', { what: 'the bank file' });
const parsed = JSON.parse(file);
eq([parsed.version, parsed.sets.length, parsed.sets[0].name, parsed.sets[0].items.length], [1, 1, 'Unit 3, final review', 3], 'the bank file keeps version 1 and carries the set');
ok((await page.textContent('#bankFileStatus')).includes('3 questions and 1 named set'), 'and its status names the set');
// another bank: one question with the same words, and a set of the same name
const OTHER = { v: 1, data: { schema: 2, questions: [
  { id: 'q-z', prompt: 'Capital of Peru?', answer: 'Lima', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-10-02T10:00:00.000Z' },
], legacy: {}, sets: [{ id: 'set-mine', name: 'Unit 3, final review', items: ['q-z'], createdAt: '2026-10-02T10:00:00.000Z' }] } };
await open({ [KEY]: JSON.stringify(OTHER) });
const before = JSON.stringify(await stored());
await page.setInputFiles('#bankImportFile', { name: 'question-bank.json', mimeType: 'application/json', buffer: Buffer.from(file, 'utf8') });
await settle(page, 400);
const summary = await page.textContent('#bankImportSummary');
ok(summary.includes('1 named set would be added (“Unit 3, final review (2)”)') && summary.includes('A set already here is never changed by a file.'), `the preview names the set it would add, under a name of its own (${summary})`);
ok((await page.textContent('#bankImportAddBtn')).endsWith(', with 1 named set'), 'the Add button says so');
eq(JSON.stringify(await stored()), before, 'nothing is stored before Add');
await page.click('#bankImportAddBtn');
await settle(page, 300);
s = await sets();
eq(s.map(x => x.name), ['Unit 3, final review', 'Unit 3, final review (2)'], 'Add puts the file\'s set beside the one of the same name');
eq(s[0].items, ['q-z'], 'the set that was here is unchanged');
ok((await page.textContent('#bankFileStatus')).includes('1 named set added'), 'and the result says so');
await choose('named:' + s[1].id);
eq(await rowsShown(), ['Capital of Peru?', '3 x 4 = ?', seedFirst], 'the imported set reads as it did, its Peru the question already here');
await page.setInputFiles('#bankImportFile', { name: 'question-bank.json', mimeType: 'application/json', buffer: Buffer.from(file, 'utf8') });
await settle(page, 400);
eq([await page.isVisible('#bankImportAddBtn'), (await sets()).length], [false, 2], 'the same file again has nothing to add');
ok((await page.textContent('#bankFileStatus')).includes('1 named set already here'), 'and says the set is already here');

/* ── 6. deleting a set, markup, keys, axe ───────────────────────────────── */
console.log('6. Delete this set; a name that is markup; axe');
await choose('named:' + s[1].id);
dialogs.length = 0; dialogAnswer = false;
await page.click('#bankSetDeleteBtn');
eq([dialogs.length, (await sets()).length], [1, 2], 'Delete this set asks first, and No keeps it');
dialogAnswer = true;
await page.click('#bankSetDeleteBtn');
await settle(page, 150);
eq([(await sets()).map(x => x.id), (await stored()).data.questions.length, await page.inputValue('#bankSource'), await page.evaluate(() => document.activeElement.id)],
  [['set-mine'], 3, '', 'bankSource'], 'Yes deletes that set only; its questions stay; the list goes back to the bank, focus on the chooser');
const X = '<img src=x onerror="window.__pwned=1">&amp;';
await tick(['3 x 4 = ?']);
await page.fill('#bankSetName', X);
await page.click('#bankSetAddBtn');
await settle(page, 150);
const named = (await sets()).find(x => x.name === X);
ok(!!named, 'a name that is markup is stored as typed');
eq([await page.$eval(`#bankSource option[value="named:${named.id}"]`, o => o.textContent), await page.evaluate(() => window.__pwned || 0)], [X + ' (named set, 1 question)', 0], 'and shown as text');
await choose('named:' + named.id);
eq(await page.inputValue('#bankSetRename'), X, 'in the rename field too');
eq((await a11yScan(page, { include: '#bankSection' })).map(v => v.id + ' ' + v.nodes.join(' ')), [], 'the set view has no serious or critical axe violation');
await choose('');
eq((await a11yScan(page, { include: '#bankSection' })).map(v => v.id + ' ' + v.nodes.join(' ')), [], 'nor the bank with the set row');
// the last sets deleted: the bank is back to schema 1 and no `sets`
await page.evaluate(() => window.QuestionBank.namedSets().forEach(x => window.QuestionBank.deleteSet(x.id)));
eq([(await stored()).data.schema, 'sets' in (await stored()).data], [1, false], 'with no set left the bank is stored as it was before sets');
eq(pageErrors, [], 'no page error');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
