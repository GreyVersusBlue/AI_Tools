// smoke-bank-editor.mjs — the Review Game Board's question-bank editor (Path
// 12 P2, "030's editor"): choices and tags on a question, editing a question
// where it stands in the list, and a preview before a file is imported.
//
//   node Tools/review-game-board/test/smoke-bank-editor.mjs        (port 8509)
//   node Tools/review-game-board/test/smoke-bank-editor.mjs --print
//
// What's worth holding still:
//   1. a bank saved before this (030's old key alone, and the shared key as
//      v265 to v273 wrote it) loads, lists, pulls into a board and plays as
//      it did: the hashes in PINS were made with --print against the v273
//      page, before the page was edited;
//   2. the add card takes choices (add, remove, reorder, mark the right one)
//      and tags (typed, or picked from the bank's own), and a question with
//      no choices is stored with none;
//   3. Edit opens a question where it stands; Save keeps its id, its place,
//      its first date and every field the form does not show; Cancel and
//      Escape change nothing; focus goes back to the row; a seed-set row has
//      no Edit and still has Copy to my bank;
//   4. a file (bank file, workbook, CSV) is SHOWN before it is stored: what
//      would be added, changed, is already there and is refused and why;
//      nothing is stored until Add, and Don't import stores nothing;
//   5. a choice, a tag, a unit and a standard that are markup are text in
//      the editor, the list and the preview;
//   6. the editor is usable from the keyboard and clean under axe.
// The pure half is smoke-bank-editor-core.mjs. Every question is made up.
// Exits 1 on any failure.

import crypto from 'node:crypto';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8509;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const OLD_KEY = 'gvb-review-board-bank:entries', KEY = 'gvb-question-bank';
const PRINT = process.argv.includes('--print');
const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
/* The same fields whatever order they were written in. */
const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
/* confirm() is answered with `dialogAnswer`, and each one is kept. */
const dialogs = [];
let dialogAnswer = true;
page.on('dialog', d => { dialogs.push(d.message()); return dialogAnswer ? d.accept() : d.dismiss(); });

console.log('Review Game Board — the question-bank editor');

/* ── the two banks from before ──────────────────────────────────────────── */
/* 030's old key, as it was written until v264. */
const OLD_BANK = [
  { id: 'bank-m1abc-aaaaaaa', question: 'Capital of Peru?', answer: 'Lima', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', createdAt: '2026-08-20T14:00:00.000Z' },
  { id: 'bank-m1abd-bbbbbbb', question: 'A comma, a "quote" and a <b>tag</b>', answer: '=1+1', points: 200, unit: 'Unit 1', standard: '6.G.2', difficulty: 'Medium', createdAt: '2026-08-21T14:00:00.000Z' },
  { id: 'bank-m1abe-ccccccc', question: 'Agent number?', answer: '007', points: 300, unit: 'Unit 2', standard: '', difficulty: '', createdAt: '2026-08-22T14:00:00.000Z' },
];
/* The shared key, as v265 to v273 wrote it: the same three taken from the old
   key, and one made on the page since. No question has choices or tags, since
   no page before this one could give it any. */
const SHARED = { v: 1, data: { schema: 1, questions: [
  { id: 'bank-m1abc-aaaaaaa', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', tags: [], points: 100, createdAt: '2026-08-20T14:00:00.000Z' },
  { id: 'bank-m1abd-bbbbbbb', prompt: 'A comma, a "quote" and a <b>tag</b>', answer: '=1+1', unit: 'Unit 1', standard: '6.G.2', difficulty: 'Medium', tags: [], points: 200, createdAt: '2026-08-21T14:00:00.000Z' },
  { id: 'bank-m1abe-ccccccc', prompt: 'Agent number?', answer: '007', unit: 'Unit 2', standard: '', difficulty: '', tags: [], points: 300, createdAt: '2026-08-22T14:00:00.000Z' },
  { id: 'q-mg1x2y3-abcdefg', prompt: 'Longest river?', answer: 'The Nile', unit: 'Unit 2', standard: '', difficulty: 'Hard', tags: [], points: 400, createdAt: '2026-10-06T15:00:00.000Z' },
], legacy: { [OLD_KEY]: OLD_BANK.map(e => e.id) } } };
const STATES = {
  old: { [OLD_KEY]: JSON.stringify(OLD_BANK) },
  shared: { [OLD_KEY]: JSON.stringify(OLD_BANK), [KEY]: JSON.stringify(SHARED) },
};

async function open(storage, { tab = true } = {}) {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  if (storage) {
    await page.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, storage);
    await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  }
  await settle(page, 300);
  if (tab) { await page.click('.top-tab-btn[data-top="bank"]'); await settle(page, 200); }
}
const storageNow = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const bank = () => page.evaluate(() => window.QuestionBank.list());

/* What a bank from before gives: storage after the bank tab opens, each row
   as the list shows it, the board pulled from it, and the board as played. */
async function capture(name) {
  const got = {};
  await open(STATES[name]);
  got.storage = await storageNow();
  got.rows = await page.$$eval('#bankList .bank-entry', rows => JSON.stringify(rows.map(r => {
    const body = r.querySelector('.bank-q').parentElement;
    return [r.querySelector('input[type="checkbox"]').getAttribute('aria-label'), body.innerHTML];
  })));
  got.filters = await page.$$eval('#bankFilterUnit option, #bankFilterStandard option, #bankSource option', o => JSON.stringify(o.map(x => [x.value, x.textContent])));
  for (const cb of await page.$$('#bankList .bank-entry input[type="checkbox"]')) await cb.check();
  await page.fill('#bankPullCategory', 'Review');
  await page.click('#bankPullBtn');
  await settle(page, 300);
  got.editor = await page.$$eval('#categoriesEditor .category-block', blocks => JSON.stringify(blocks.map(b => [b.querySelector('.cat-name-input').value,
    Array.from(b.querySelectorAll('.clue-row')).map(r => Array.from(r.querySelectorAll('input, textarea')).map(i => i.value))])));
  await page.fill('#boardName', 'Pinned board');
  await page.click('#buildFromManualBtn');
  await settle(page, 400);
  got.board = await page.evaluate(() => localStorage.getItem('gvb-review-board:data:Pinned board'));
  got.played = await page.evaluate(() => document.getElementById('boardCols').innerHTML + '\n' + document.getElementById('scoreboard').innerHTML + '\n' + document.getElementById('boardTitle').textContent);
  await page.click('#boardCols .cell');
  await settle(page, 200);
  await page.click('#showAnswerBtn');
  await settle(page, 150);
  got.clue = await page.evaluate(() => ['overlayCatPoints', 'overlayQuestion', 'overlayAnswer'].map(id => document.getElementById(id).textContent).join('\n'));
  got.after = await storageNow();
  return got;
}

/* Made with --print against the v273 page, before it was edited. */
const PINS = {
  old: {"storage":"a89530f82cefd48c","rows":"2a8acefccb038532","filters":"591f7db17cc7d1fb","editor":"73c0f415f1f8404e","board":"13596fdea78de20d","played":"ebd0120a52aa0028","clue":"a968c6c947e0f3f3","after":"85a6c21a9c8bde6e"},
  shared: {"storage":"b6758f8d13fbb623","rows":"6b94da9fa3dc9aaf","filters":"70fad58936fb4a9f","editor":"77c3dfc4ddf06d1c","board":"debfdec8ae80731e","played":"33a7258fd48b820e","clue":"a968c6c947e0f3f3","after":"8bfde3cd957a3f10"},
};

console.log('1. a bank saved before this loads, lists, pulls and plays the same');
for (const name of Object.keys(STATES)) {
  const got = await capture(name);
  const hashes = Object.fromEntries(Object.keys(got).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(`  ${name}: ${JSON.stringify(hashes)},`); continue; }
  for (const k of Object.keys(PINS[name])) eq(hashes[k], PINS[name][k], `${name} bank: ${k} is what the v273 page gave`);
  eq(Object.keys(got).sort(), Object.keys(PINS[name]).sort(), `${name} bank: every capture has a pin`);
}
if (PRINT) { await browser.close(); server.close(); process.exit(0); }

/* ── helpers for the rest ───────────────────────────────────────────────── */
const X = tag => `${tag}"'><img src=x onerror="window.__pwned=(window.__pwned||0)+1"><a href="javascript:window.__pwned=99">go</a>&amp;`;
async function inert(where, label) {
  const got = await page.evaluate(sel => {
    const roots = Array.from(document.querySelectorAll(sel));
    const made = roots.reduce((n, r) => n + r.querySelectorAll('img[src="x"], a[href^="javascript"], [onerror]').length, 0);
    return { pwned: window.__pwned === undefined ? null : window.__pwned, made, roots: roots.length };
  }, where);
  ok(got.roots > 0, `${label}: ${where} is on the page`);
  eq([got.pwned, got.made], [null, 0], `${label}: nothing ran and no element was made from a text`);
}
const rowsShown = () => page.$$eval('#bankList .bank-entry', rows => rows.map(r => r.classList.contains('editing') ? '(open)' : r.querySelector('.bank-q').textContent));
const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('aria-label') || a.tagName) : null; });
const text = sel => page.$eval(sel, n => n.textContent);
const choiceRows = base => page.$$eval(`${base} .bank-choice-row`, rows => rows.map(r => [r.querySelector('input[type="text"]').value, r.querySelector('input[type="radio"]').checked]));
const tokens = base => page.$$eval(`${base} .bank-token-text`, ns => ns.map(n => n.textContent));
const editBtn = n => `#bankList .bank-entry:nth-child(${n}) .bank-edit-open`;

/* ── 2. the add card: choices and tags ──────────────────────────────────── */
console.log('2. the add card takes choices and tags');
await open(STATES.shared);
eq([await page.$$eval('#bankAddChoices .bank-choice-row', r => r.length), await page.isVisible('#bankAddChoiceAdd'), await page.isVisible('#bankAddTagInput')], [0, true, true],
  'the add card has a choices editor with no rows yet and a tags field');
eq(await page.$eval('label[for="bankAddTagInput"]', n => n.textContent), 'Tags', 'the tags field has a label');

await page.fill('#bankQuestion', 'Plain question?');
await page.fill('#bankAnswer', 'Plain answer');
await page.click('#bankAddBtn');
await settle(page, 150);
const plainQ = (await bank()).at(-1);
eq([plainQ.prompt, 'choices' in plainQ, plainQ.tags, plainQ.points], ['Plain question?', false, [], 100], 'a question added with no choices and no tags is stored with no `choices` field and no tags');

await page.fill('#bankQuestion', 'Capital of Ecuador?');
await page.fill('#bankAnswer', 'Quito');
for (const c of ['Lima', 'Quito', 'Bogotá']) {
  await page.click('#bankAddChoiceAdd');
  eq(await focused(), `Choice ${(await choiceRows('#bankAddChoices')).length}`, 'Add a choice puts the cursor in the new row');
  await page.keyboard.type(c);
}
eq(await choiceRows('#bankAddChoices'), [['Lima', false], ['Quito', true], ['Bogotá', false]], 'three choices; the one that is the answer is marked without a press');
await page.click('#bankAddChoices .bank-choice-row:nth-child(1) input[type="radio"]');
eq(await page.inputValue('#bankAnswer'), 'Lima', 'marking another choice makes it the answer');
await page.fill('#bankAddChoices .bank-choice-row:nth-child(1) input[type="text"]', 'Lima, Peru');
eq([await page.inputValue('#bankAnswer'), (await choiceRows('#bankAddChoices'))[0]], ['Lima, Peru', ['Lima, Peru', true]], 'typing in the marked choice types the answer too, and it stays marked');
await page.click('#bankAddChoices .bank-choice-row:nth-child(2) input[type="radio"]');
eq(await page.inputValue('#bankAnswer'), 'Quito', 'and marking the second sets the answer back');
await page.click('#bankAddChoices .bank-choice-row:nth-child(3) .bank-choice-up');
eq(await choiceRows('#bankAddChoices'), [['Lima, Peru', false], ['Bogotá', false], ['Quito', true]], 'Up moves a choice one place, and the mark goes with the answer');
eq([await focused(), await text('#bankAddChoices .bank-choice-status')], ['Move choice 2 up', 'Choice moved to place 2 of 3.'], 'focus stays on the moved choice and the move is said');
await page.click('#bankAddChoices .bank-choice-row:nth-child(1) .bank-choice-down');
eq((await choiceRows('#bankAddChoices')).map(r => r[0]), ['Bogotá', 'Lima, Peru', 'Quito'], 'Down moves one a place down');
await page.click('#bankAddChoices .bank-choice-row:nth-child(2) .bank-choice-remove');
eq(await choiceRows('#bankAddChoices'), [['Bogotá', false], ['Quito', true]], 'Remove takes that choice out');
eq(await page.$$eval('#bankAddChoices .bank-choice-row', rows => [rows[0].querySelector('.bank-choice-up').disabled, rows[0].querySelector('.bank-choice-down').disabled, rows[1].querySelector('.bank-choice-up').disabled, rows[1].querySelector('.bank-choice-down').disabled]),
  [true, false, false, true], 'the first cannot move up and the last cannot move down');
await page.fill('#bankAnswer', 'Paris');
eq([(await choiceRows('#bankAddChoices')).map(r => r[1]), /None of the choices is the answer/.test(await text('#bankAddChoices .bank-choice-status'))], [[false, false], true], 'an answer that is none of the choices leaves none marked, and the form says so');
await page.fill('#bankAnswer', 'Quito');
eq(await text('#bankAddChoices .bank-choice-status'), '', 'and the note goes when the answer is a choice again');

await page.focus('#bankAddTagInput');
await page.keyboard.type('capitals');
await page.keyboard.press('Enter');
eq([await tokens('#bankAddTags'), await page.inputValue('#bankAddTagInput'), (await bank()).length], [['capitals'], '', 5], 'Enter makes what is typed a tag and adds no question');
await page.keyboard.type('andes, south america;');
eq(await tokens('#bankAddTags'), ['capitals', 'andes', 'south america'], 'a comma or a semicolon ends a tag');
await page.keyboard.type('ANDES');
await page.keyboard.press('Enter');
eq([await tokens('#bankAddTags'), await text('#bankAddTags .bank-tag-status')], [['capitals', 'andes', 'south america'], 'That tag is already on this question.'], 'a tag already there is not added twice, and that is said');
await page.keyboard.press('Backspace');
eq(await tokens('#bankAddTags'), ['capitals', 'andes'], 'Backspace in the empty field takes the last tag off');
await page.click('#bankAddTags .bank-token:nth-child(1) .bank-token-remove');
eq([await tokens('#bankAddTags'), await focused()], [['andes'], 'bankAddTagInput'], 'a tag\'s Remove button takes it off and puts the cursor back in the field');
eq(await page.$eval('#bankAddTags .bank-token-remove', b => b.getAttribute('aria-label')), 'Remove tag: andes', 'and is named for its tag');
await page.fill('#bankAddTagInput', 'still typed');
await page.click('#bankAddBtn');
await settle(page, 150);
const rich = (await bank()).at(-1);
eq([rich.prompt, rich.answer, rich.choices, rich.tags, rich.id.slice(0, 2)], ['Capital of Ecuador?', 'Quito', ['Bogotá', 'Quito'], ['andes', 'still typed'], 'q-'], 'Add stores the choices in their order and the tags, the one still in the field among them');
eq([await choiceRows('#bankAddChoices'), await tokens('#bankAddTags'), await page.inputValue('#bankQuestion')], [[], [], ''], 'and the form is clear for the next question');
const richRow = await page.$eval('#bankList .bank-entry:last-child', r => ({ tags: Array.from(r.querySelectorAll('.bank-tag.is-tag')).map(n => n.textContent), choices: r.querySelector('.bank-choices').textContent, right: r.querySelector('.bank-choices b').textContent }));
eq(richRow, { tags: ['andes', 'still typed'], choices: 'Choices: Bogotá · Quito (answer)', right: 'Quito' }, 'its row in the list shows its tags and its choices, the right one marked');
eq(await page.$$eval('#bankList .bank-entry:nth-child(1) .bank-choices, #bankList .bank-entry:nth-child(1) .is-tag', n => n.length), 0, 'a question with neither shows neither');
eq(await page.$$eval('#bankAddTagOptions option', o => o.map(x => x.value)), ['andes', 'still typed'], 'the tags field now offers the tags the bank uses');
await page.fill('#bankAddTagInput', 'andes');
await page.keyboard.press('Enter');
eq(await page.$$eval('#bankAddTagOptions option', o => o.map(x => x.value)), ['still typed'], 'less the ones already on the question');
await page.click('#bankAddTags .bank-token-remove');

/* ── 3. edit in place ───────────────────────────────────────────────────── */
console.log('3. a question opens for editing where it stands');
await open(STATES.shared);
const startRows = await rowsShown();
eq(await page.$$eval('#bankList .bank-edit-open', b => b.map(x => x.getAttribute('aria-label'))), startRows.map(q => 'Edit: ' + q), 'every row of the teacher\'s bank has an Edit button named for its question');
let stored = await storageNow();
await page.focus(editBtn(2));
await page.keyboard.press('Enter');
await settle(page, 100);
eq(await rowsShown(), [startRows[0], '(open)', startRows[2], startRows[3]], 'Edit opens the question in its own place in the list, the others round it');
eq([await focused(), await page.inputValue('#bankEditQuestion'), await page.inputValue('#bankEditAnswer'), await page.inputValue('#bankEditPoints'), await page.inputValue('#bankEditUnit'), await page.inputValue('#bankEditStandard'), await page.inputValue('#bankEditDifficulty')],
  ['bankEditQuestion', 'A comma, a "quote" and a <b>tag</b>', '=1+1', '200', 'Unit 1', '6.G.2', 'Medium'], 'the cursor is in the form, which holds the question as stored');
eq(await page.$eval('#bankList .bank-edit', n => [n.getAttribute('role'), n.getAttribute('aria-label')]), ['group', 'Edit question: A comma, a "quote" and a <b>tag</b>'], 'the form is a named group');
await page.fill('#bankEditAnswer', 'typed and thrown away');
await page.keyboard.press('Escape');
await settle(page, 100);
eq([await rowsShown(), await storageNow() === stored, await focused()], [startRows, true, 'Edit: ' + startRows[1]], 'Escape closes the form, stores nothing and puts focus back on the row\'s Edit button');
await page.click(editBtn(2));
await page.fill('#bankEditQuestion', 'also thrown away');
await page.click('#bankList .bank-edit-cancel');
await settle(page, 100);
eq([await rowsShown(), await storageNow() === stored, await focused(), await text('#bankListStatus')], [startRows, true, 'Edit: ' + startRows[1], 'Nothing was changed.'], 'Cancel does the same, and says nothing was changed');
await page.click(editBtn(2));
await page.click('#bankList .bank-edit-save');
await settle(page, 100);
eq([await storageNow() === stored, await text('#bankListStatus'), await focused()], [true, 'Nothing was changed.', 'Edit: ' + startRows[1]], 'Save with nothing changed writes nothing: no new date on the question');

const beforeEdit = await bank();
await page.click(editBtn(2));
await page.fill('#bankEditQuestion', 'What is 1 + 1?');
await page.fill('#bankEditAnswer', '2');
await page.fill('#bankEditPoints', '250');
await page.selectOption('#bankEditDifficulty', 'Easy');
for (const c of ['1', '2', '3']) { await page.click('#bankEditChoiceAdd'); await page.keyboard.type(c); }
await page.focus('#bankEditTagInput');
await page.keyboard.type('sums');
await page.keyboard.press('Enter');
eq([await rowsShown(), (await bank()).length], [[startRows[0], '(open)', startRows[2], startRows[3]], 4], 'Enter in the tags field adds a tag and neither saves nor closes the form');
await page.click('#bankList .bank-edit-save');
await settle(page, 100);
const afterEdit = await bank();
eq(afterEdit.map(q => q.id), beforeEdit.map(q => q.id), 'Save keeps every id and the order of the bank');
const { updatedAt, ...editedQ } = afterEdit[1];
eq(sorted(editedQ), sorted({ ...beforeEdit[1], prompt: 'What is 1 + 1?', answer: '2', choices: ['1', '2', '3'], difficulty: 'Easy', tags: ['sums'], points: 250 }),
  'the question has its id, its first date and its place, and the fields that were edited');
ok(/^\d{4}-\d\d-\d\dT/.test(updatedAt || ''), 'and `updatedAt`, as the bank stamps it');
eq([afterEdit[0], afterEdit[2], afterEdit[3]], [beforeEdit[0], beforeEdit[2], beforeEdit[3]], 'no other question is touched');
eq([await focused(), await text('#bankListStatus'), (await rowsShown())[1]], ['Edit: What is 1 + 1?', 'Saved the question.', 'What is 1 + 1?'], 'focus is back on the row, the save is said and the row shows the new words');
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), STATES.shared[OLD_KEY], '030\'s old key is not written by an edit');

/* What the form does not show stays as it is. */
const MEDIA = { kind: 'image', ref: 'idb:rgb/made-up', alt: 'A river on a map' };
await page.evaluate(media => { const q = window.QuestionBank.list()[3]; window.QuestionBank.saveQuestion({ id: q.id, media, hint: 'Flows north', copiedFrom: 'seed:062:bi3' }); }, MEDIA);
await page.click('.top-tab-btn[data-top="bank"]');
const hidden0 = (await bank())[3];
await page.click(editBtn(4));
await page.fill('#bankEditUnit', 'Unit 7');
await page.click('#bankList .bank-edit-save');
await settle(page, 100);
const hidden1 = (await bank())[3];
eq([hidden1.unit, hidden1.media, hidden1.hint, hidden1.copiedFrom, hidden1.createdAt, hidden1.id], ['Unit 7', MEDIA, 'Flows north', 'seed:062:bi3', hidden0.createdAt, hidden0.id],
  'an edit keeps a question\'s picture, where it was copied from and a field this page does not know');

/* Refused in the form. */
stored = await storageNow();
await page.click(editBtn(1));
await page.fill('#bankEditAnswer', '   ');
await page.click('#bankList .bank-edit-save');
await settle(page, 100);
eq([await text('#bankList .bank-edit-status'), await page.$eval('#bankList .bank-edit-status', n => n.getAttribute('role')), (await rowsShown())[0], await storageNow() === stored],
  ['Add both a question and an answer.', 'alert', '(open)', true], 'a question with no answer is refused in the form, which stays open, and nothing is stored');

/* What is typed survives the list being drawn again, and the open row stays. */
await page.fill('#bankEditAnswer', 'Lima, still');
await page.fill('#bankFilterQuery', 'river');
await settle(page, 150);
eq([await rowsShown(), await page.evaluate(() => { const n = document.getElementById('bankEditAnswer'); return n ? n.value : null; })], [['(open)', 'Longest river?'], 'Lima, still'], 'a filter typed while a form is open keeps the form, where it stands, with what was typed in it');
await page.fill('#bankFilterQuery', '');
await settle(page, 150);

/* Another Edit while this one has changes asks first. */
dialogs.length = 0; dialogAnswer = false;
await page.click(editBtn(3));
await settle(page, 100);
eq([dialogs.length, (await rowsShown())[0], await page.inputValue('#bankEditAnswer')], [1, '(open)', 'Lima, still'], 'Edit on another row asks before leaving unsaved changes, and No keeps the form');
dialogAnswer = true;
await page.click(editBtn(3));
await settle(page, 100);
eq([dialogs.length, await rowsShown(), await page.$$eval('#bankList .bank-edit', n => n.length), await storageNow() === stored], [2, ['Capital of Peru?', 'What is 1 + 1?', '(open)', 'Longest river?'], 1, true], 'Yes opens the other; there is one form at a time and nothing was stored');
await page.keyboard.press('Escape');

/* An edit that takes the row out of the filtered list. */
await page.selectOption('#bankFilterUnit', 'Unit 1');
await settle(page, 100);
await page.click(editBtn(1));
await page.fill('#bankEditUnit', 'Unit 5');
await page.click('#bankList .bank-edit-save');
await settle(page, 100);
eq([await rowsShown(), await focused(), await text('#bankListStatus')], [['What is 1 + 1?'], 'bankList', 'Saved the question. It no longer matches the filters above, so it is not in this list.'],
  'a saved question that no longer matches the filters leaves the list, focus goes to the list and the reason is said');
await page.click('#bankClearFiltersBtn');

/* A seed set is read-only. */
await page.selectOption('#bankSource', '053');
await settle(page, 150);
eq(await page.$$eval('#bankList .bank-entry button', b => [...new Set(b.map(x => x.textContent))]), ['Copy to my bank'], 'a seed set\'s rows have Copy to my bank and no Edit and no Delete');
await page.selectOption('#bankSource', '062');
await settle(page, 150);
ok(await page.$$eval('#bankList .bank-tag.is-tag', n => n.length) > 0, 'and a set\'s own tags show on its rows');
await page.selectOption('#bankSource', '');
await settle(page, 150);

/* ── 4. a preview before an import ──────────────────────────────────────── */
console.log('4. a file is shown before it is stored');
await open(STATES.shared);
const base4 = await bank();
const FILE = { format: 'aplp-question-bank', version: 1, questions: [
  { prompt: 'Smallest prime?', answer: '2', unit: 'Unit 3', tags: ['primes'], choices: ['1', '2', '3'] },
  { ...base4[0], unit: 'Unit 1b' },
  base4[1],
  { prompt: 'agent NUMBER?', answer: '007' },
  { prompt: 'No answer on this row', answer: '' },
  { prompt: X('fq'), answer: X('fa'), unit: X('unit'), standard: X('std'), tags: [X('tag')], choices: [X('c1'), X('fa')] },
] };
async function chooseFile(name, mimeType, body) {
  await page.setInputFiles('#bankImportFile', { name, mimeType, buffer: Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8') });
  await page.waitForFunction(() => { const t = document.getElementById('bankFileStatus').textContent; return t && !/^Reading /.test(t); }, null, { timeout: 15000 });
  await settle(page, 150);
}
const preview = () => page.evaluate(() => ({
  shown: !document.getElementById('bankImportPreview').hidden,
  summary: document.getElementById('bankImportSummary').textContent,
  rows: Array.from(document.querySelectorAll('#bankImportList li')).map(li => [li.querySelector('.bank-q').textContent, li.querySelector('.is-status').textContent]),
  add: document.getElementById('bankImportAddBtn').hidden ? null : document.getElementById('bankImportAddBtn').textContent,
  cancel: document.getElementById('bankImportCancelBtn').textContent,
}));
const fileStatus = () => page.$eval('#bankFileStatus', n => [n.textContent, n.className]);

eq((await preview()).shown, false, 'no preview before a file is chosen');
stored = await storageNow();
await chooseFile('colleague.json', 'application/json', JSON.stringify(FILE));
let pv = await preview();
eq(await storageNow() === stored, true, 'choosing a bank file stores nothing');
eq([pv.shown, pv.summary], [true, 'colleague.json holds 6 questions. 2 would be added, 1 would change a question already in your bank, 2 are already in your bank, 1 would be left out (no question or no answer). Nothing is stored until you press the button, and an import never deletes.'],
  'it is shown first, with what it would add, change, leave and refuse');
eq(pv.rows.map(r => r[1]), ['row 1: new', 'row 2: changes a question in your bank: unit', 'row 3: already in your bank', 'row 4: already in your bank', 'row 5: left out: no answer', 'row 6: new'],
  'each question says what would happen to it, and a refused one why');
eq([pv.add, pv.cancel], ['Add 2 and change 1 in my bank', 'Don’t import'], 'the button says what it will do');
eq(await fileStatus(), ['Read colleague.json. Nothing is stored yet: check the list below, then press Add.', 'import-status'], 'and the status line says nothing is stored yet');
eq(await page.$eval('#bankImportList li:nth-child(1)', li => [Array.from(li.querySelectorAll('.is-tag')).map(n => n.textContent), li.querySelector('.bank-choices').textContent]), [['primes'], 'Choices: 1 · 2 (answer) · 3'], 'a previewed question shows its tags and its choices');
await inert('#bankImportList', 'the preview, with a choice, tag, unit and standard that are markup');
eq(await page.$eval('#bankImportList li:nth-child(6)', li => Array.from(li.querySelectorAll('.bank-tag, .bank-choice')).map(n => n.textContent).slice(0, 5)), [X('unit'), X('std'), X('tag'), 'row 6: new', X('c1')], 'which are there, as text');
eq((await a11yScan(page, { include: '#bankSection' })).map(v => v.id + ' ' + v.nodes.join(' ')), [], 'the bank tab with a preview up has no serious or critical axe violation');

await page.click('#bankImportCancelBtn');
eq([await storageNow() === stored, (await preview()).shown, await fileStatus(), await focused()], [true, false, ['Nothing was imported.', 'import-status'], 'bankImportFile'], 'Don\'t import stores nothing, closes the preview, says so and puts focus on the file picker');

/* The bank changes between the preview and the press. */
await chooseFile('colleague.json', 'application/json', JSON.stringify(FILE));
await page.evaluate(() => { window.QuestionBank.saveQuestion({ prompt: 'Smallest prime?', answer: '2' }); });
stored = await storageNow();
await page.click('#bankImportAddBtn');
await settle(page, 100);
pv = await preview();
eq([await storageNow() === stored, pv.shown, (pv.rows[0] || [])[1], pv.add, (await fileStatus())[1]], [true, true, 'row 1: already in your bank', 'Add 1 and change 1 in my bank', 'import-status error'],
  'if the bank changed since the list was drawn, Add stores nothing that press, draws the list again and says why');
await page.click('#bankImportAddBtn');
await settle(page, 150);
const after4 = await bank();
eq([await fileStatus(), (await preview()).shown, await focused()], [['1 question added, 1 updated, 3 already in the bank. Left out: row 5 (no answer).', 'import-status ok'], false, 'bankImportFile'],
  'the second press stores what is now shown, and the outcome is said as it always was');
eq([after4.length, after4[0].unit, after4[0].id, after4.at(-1).prompt, after4.at(-1).choices, after4.at(-1).tags], [base4.length + 2, 'Unit 1b', base4[0].id, X('fq'), [X('c1'), X('fa')], [X('tag')]], 'the bank holds the added and the changed questions');
await inert('#bankList', 'the list, with a choice, tag, unit and standard that are markup');
eq(await page.$eval('#bankList .bank-entry:last-child', r => [r.querySelector('.is-tag').textContent, r.querySelector('.bank-choices b').textContent]), [X('tag'), X('fa')], 'shown as text, the right choice marked');
ok((await page.$$eval('#bankFilterUnit option, #bankFilterStandard option', o => o.map(x => x.value))).includes(X('unit')), 'and offered in the filters as text');

/* The same file again: nothing to add. */
stored = await storageNow();
await chooseFile('colleague.json', 'application/json', JSON.stringify(FILE));
pv = await preview();
eq([pv.shown, pv.add, pv.cancel, await fileStatus(), await storageNow() === stored], [true, null, 'Close', ['0 questions added, 5 already in the bank. Left out: row 5 (no answer).', 'import-status error'], true],
  'the same file again is shown with nothing to add: no Add button, the outcome said at once, nothing stored');
ok(/There is nothing to add/.test(pv.summary), 'and its summary says there is nothing to add');
await page.click('#bankImportCancelBtn');
eq([(await preview()).shown, (await fileStatus())[0]], [false, '0 questions added, 5 already in the bank. Left out: row 5 (no answer).'], 'Close closes it and leaves the outcome on the status line');

/* A CSV and a workbook go through the same preview. */
const CSV = 'Question,Answer,Unit,Tags,Choices\r\n"Largest planet?",Jupiter,Unit 4,"space, planets",Mars | Jupiter\r\nNo answer here,,Unit 4,,\r\n';
stored = await storageNow();
await chooseFile('more.csv', 'text/csv', CSV);
pv = await preview();
eq([await storageNow() === stored, pv.rows.map(r => r[1]), pv.add], [true, ['row 2: new', 'row 3: left out: no answer'], 'Add 1 question to my bank'], 'a CSV is shown first too, each row under its sheet row number');
await page.click('#bankImportAddBtn');
await settle(page, 150);
eq([await fileStatus(), (await bank()).at(-1).choices, (await bank()).at(-1).tags], [['1 question added. Left out: row 3 (no answer).', 'import-status ok'], ['Mars', 'Jupiter'], ['space', 'planets']], 'and Add stores it, choices and tags read from their cells');
await page.addScriptTag({ url: BASE + '/_shared/vendor/xlsx/xlsx.full.min.js' });
const xlsxBytes = await page.evaluate(() => {
  const ws = window.XLSX.utils.aoa_to_sheet([['Question', 'Answer', 'Unit'], ['Nearest star?', 'The Sun', 'Unit 4'], ['Largest planet?', 'Jupiter', 'Unit 4']]);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  return Array.from(new Uint8Array(window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })));
});
stored = await storageNow();
await chooseFile('more.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from(xlsxBytes));
pv = await preview();
eq([await storageNow() === stored, pv.rows, pv.add], [true, [['Nearest star?', 'row 2: new'], ['Largest planet?', 'row 3: already in your bank']], 'Add 1 question to my bank'], 'and so is a workbook');
await page.click('#bankImportAddBtn');
await settle(page, 150);
eq([(await fileStatus())[0], (await bank()).at(-1).prompt], ['1 question added, 1 already in the bank.', 'Nearest star?'], 'which Add stores');

/* A file that is not a bank is refused with no preview. */
await chooseFile('roster.csv', 'text/csv', 'Name,Period\r\nAvery Example,3\r\n');
eq([await fileStatus(), (await preview()).shown], [['No header row with a "Question" and an "Answer" column was found.', 'import-status error'], false], 'a file that is not a bank is refused in words, with no preview');
/* A new file replaces a preview that is up. */
await chooseFile('colleague.json', 'application/json', JSON.stringify({ questions: [{ prompt: 'Only one?', answer: 'Yes' }] }));
await chooseFile('broken.json', 'application/json', '{"questions": ');
eq([await fileStatus(), (await preview()).shown], [['That file is not readable JSON.', 'import-status error'], false], 'a second file replaces the first one\'s preview, and a broken one leaves none up');
ok(!(await bank()).some(q => q.prompt === 'Only one?'), 'so the first file, never added, is not in the bank');

/* ── 5. markup in a choice, a tag, a unit and a standard: the editor ────── */
console.log('5. hostile text in the editor');
const hostileAt = (await rowsShown()).indexOf(X('fq')) + 1;
await page.click(editBtn(hostileAt));
await settle(page, 100);
await inert('#bankList .bank-edit', 'the open form');
eq([await page.inputValue('#bankEditUnit'), await page.inputValue('#bankEditStandard'), await tokens('#bankList .bank-edit'), (await choiceRows('#bankList .bank-edit'))],
  [X('unit'), X('std'), [X('tag')], [[X('c1'), false], [X('fa'), true]]], 'the form holds the unit, standard, tag and choices as the text they are');
eq(await page.$eval('#bankList .bank-token-remove', b => b.getAttribute('aria-label')), 'Remove tag: ' + X('tag'), 'and a tag\'s Remove button is named with it, as text');
await page.focus('#bankAddTagInput');
ok((await page.$$eval('#bankAddTagOptions option', o => o.map(x => x.value))).includes(X('tag')), 'the tag is offered in the add card\'s tags list as a value, though the bank gained it after the page loaded');
ok(!(await page.$$eval('#bankEditTagOptions option', o => o.map(x => x.value))).includes(X('tag')), 'and not in the open form\'s, whose question has it already');
await inert('#bankSection', 'the whole bank tab with the form open');
await page.keyboard.press('Escape');
await page.fill('#bankQuestion', X('aq'));
await page.fill('#bankAnswer', X('aa'));
await page.fill('#bankUnit', X('au'));
await page.fill('#bankStandard', X('as'));
await page.click('#bankAddChoiceAdd');
await page.keyboard.type(X('ac'));
await page.fill('#bankAddTagInput', '<img src=x onerror=window.__pwned=5>');
await page.keyboard.press('Enter');
await inert('#bankAddChoices, #bankAddTags', 'the add card with markup typed in a choice and a tag');
await page.click('#bankAddBtn');
await settle(page, 150);
await inert('#bankSection', 'the bank tab after adding it');
eq([(await bank()).at(-1).tags, (await bank()).at(-1).choices], [['<img src=x onerror=window.__pwned=5>'], [X('ac')]], 'which is stored as typed');

/* ── 6. keyboard and axe ────────────────────────────────────────────────── */
console.log('6. keyboard and axe');
for (const dark of [false, true]) {
  await open(STATES.shared);
  if (dark) {
    await page.evaluate(() => localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' })));
    await page.reload({ waitUntil: 'networkidle' });
    await settle(page, 300);
    await page.click('.top-tab-btn[data-top="bank"]');
  }
  const mode = dark ? 'dark' : 'light';
  eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'), dark, `the page is in ${mode}`);
  for (const c of ['One', 'Two']) { await page.click('#bankAddChoiceAdd'); await page.keyboard.type(c); }
  await page.fill('#bankAddTagInput', 'a tag');
  await page.keyboard.press('Enter');
  await page.focus(editBtn(1));
  await page.keyboard.press('Enter');
  await settle(page, 100);
  for (const c of ['Lima', 'Quito']) { await page.click('#bankEditChoiceAdd'); await page.keyboard.type(c); }
  await page.fill('#bankEditTagInput', 'capitals');
  await page.keyboard.press('Enter');
  eq((await a11yScan(page, { include: '#bankSection' })).map(v => v.id + ' ' + v.nodes.join(' ')), [], `the bank tab with a form open, choices and tags in both, has no serious or critical axe violation (${mode})`);
  ok(await page.evaluate(() => Array.from(document.querySelectorAll('#bankSection input, #bankSection select, #bankSection textarea, #bankSection button')).every(e => (e.labels && e.labels.length) || e.getAttribute('aria-label') || e.textContent.trim())),
    `every control on the bank tab has a name (${mode})`);
  if (dark) continue;
  /* The form by keys alone: Tab from the question to the answer, Space on a
     choice's mark, the arrows' buttons by Enter, Escape out. */
  await page.focus('#bankEditQuestion');
  await page.keyboard.press('Tab');
  eq(await focused(), 'bankEditAnswer', 'Tab goes from the question to the answer');
  await page.focus('#bankList .bank-choice-row:nth-child(2) input[type="radio"]');
  await page.keyboard.press('Space');
  eq(await page.inputValue('#bankEditAnswer'), 'Quito', 'Space on a choice\'s mark makes it the answer');
  await page.focus('#bankList .bank-choice-row:nth-child(2) .bank-choice-up');
  await page.keyboard.press('Enter');
  eq([(await choiceRows('#bankList .bank-edit')), await focused()], [[['Quito', true], ['Lima', false]], 'Choice 1'], 'Enter on Up moves the choice; focus goes to its text when it can go no higher');
  await page.focus('#bankList .bank-edit-save');
  await page.keyboard.press('Enter');
  await settle(page, 100);
  const kq = (await bank())[0];
  eq([kq.answer, kq.choices, kq.tags, await focused()], ['Quito', ['Quito', 'Lima'], ['capitals'], 'Edit: Capital of Peru?'], 'and Enter on Save stores it all, focus back on the row');
}

/* ── the old key was never written, in any of it ────────────────────────── */
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), STATES.shared[OLD_KEY], '030\'s old key is byte for byte what it was');

/* ── no console noise, nothing left the site ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
