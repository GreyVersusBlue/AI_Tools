// smoke-bank-file.mjs — the Review Game Board's bank on the site's shared
// question bank (_shared/question-bank.js, Path 12 P1): a bank made before
// v265 opens whole on the page, and the bank saves to a file and comes back.
//
//   node Tools/review-game-board/test/smoke-bank-file.mjs        (port 8498)
//
// What's worth holding still:
//   1. a browser that has only the OLD key ('gvb-review-board-bank:entries')
//      shows every entry, in order, the first time the page loads, and the old
//      key is left byte for byte as it was;
//   2. Add, filter and Delete on the page write the shared key and never the
//      old one;
//   3. "Save bank file" is every question with every field, and importing it
//      into an empty browser gives the same bank, ids and all; importing it a
//      second time changes nothing;
//   4. "Save as spreadsheet" is a workbook with no formula cell, where an
//      answer of 007 or =1+1 is text; importing it back changes nothing, and
//      a question's choices and media, which 030 does not show, survive;
//   5. a hand-made CSV is merged, and its bad row is named by its number;
//   6. a file that is not a bank is refused in words and the bank is untouched;
//   7. the new controls are clean under axe.
// The module's own logic is Tools/question-bank/test/question-bank.test.mjs.
// Every question here is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8498;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const OLD_KEY = 'gvb-review-board-bank:entries', KEY = 'gvb-question-bank';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
page.on('dialog', d => d.accept());

console.log('Review Game Board — the shared question bank, and the bank as a file');

/* The old key as 030 wrote it before v265: a bare list of eight-field entries. */
const OLD_BANK = [
  { id: 'bank-m1abc-aaaaaaa', question: 'Capital of Peru?', answer: 'Lima', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', createdAt: '2026-08-20T14:00:00.000Z' },
  { id: 'bank-m1abd-bbbbbbb', question: 'A comma, a "quote" and a <b>tag</b>', answer: '=1+1', points: 200, unit: 'Unit 1', standard: '6.G.2', difficulty: 'Medium', createdAt: '2026-08-21T14:00:00.000Z' },
  { id: 'bank-m1abe-ccccccc', question: 'Agent number?', answer: '007', points: 300, unit: 'Unit 2', standard: '', difficulty: '', createdAt: '2026-08-22T14:00:00.000Z' },
];
const OLD_RAW = JSON.stringify(OLD_BANK);

async function open({ clear = false, seedOld = false } = {}) {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  if (clear || seedOld) {
    await page.evaluate(({ clear, seedOld, OLD_KEY, OLD_RAW }) => {
      if (clear) localStorage.clear();
      if (seedOld) localStorage.setItem(OLD_KEY, OLD_RAW);
    }, { clear, seedOld, OLD_KEY, OLD_RAW });
    await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  }
  await settle(page, 300);
  await page.click('.top-tab-btn[data-top="bank"]');
  await settle(page, 200);
}
const shown = () => page.$$eval('#bankList .bank-entry', rows => rows.map(r => r.querySelector('.bank-q').textContent + ' / ' + r.querySelector('.bank-a').textContent));
const bank = () => page.evaluate(() => window.QuestionBank.list());
const status = () => page.$eval('#bankFileStatus', el => [el.textContent, el.className]);
async function importFile(name, mimeType, body) {
  await page.setInputFiles('#bankImportFile', { name, mimeType, buffer: Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8') });
  await page.waitForFunction(() => { const t = document.getElementById('bankFileStatus').textContent; return t && !/^Reading /.test(t); }, null, { timeout: 15000 });
  await settle(page, 150);
  // Since v276 a file is shown before it is stored (smoke-bank-editor.mjs
  // holds the preview itself). This suite is about what an import stores, so
  // it presses Add when there is something to add; with nothing to add the
  // status line already says the outcome.
  if (await page.isVisible('#bankImportAddBtn')) {
    await page.click('#bankImportAddBtn');
    await settle(page, 150);
  }
}

/* ── 1. a bank from before v265 ─────────────────────────────────────────── */
await open({ clear: true, seedOld: true });
eq(await shown(), ['Capital of Peru? / Lima', 'A comma, a "quote" and a <b>tag</b> / =1+1', 'Agent number? / 007'], 'a bank saved before v265 shows every entry, in order, as text');
eq(await page.evaluate(() => window.ReviewBankStore.listEntries()), OLD_BANK, 'and the page reads each one field for field as it was stored');
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD_RAW, 'the old key is byte for byte what it was');
const env = JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY));
eq([env.v, env.data.schema, env.data.questions.map(q => q.id), env.data.questions[0].prompt], [1, 1, OLD_BANK.map(e => e.id), 'Capital of Peru?'], 'the shared key holds them in a version 1 envelope, ids kept, `question` now `prompt`');

/* ── 2. the page's own buttons write the shared key ─────────────────────── */
await page.fill('#bankQuestion', 'Longest river?');
await page.fill('#bankAnswer', 'The Nile');
await page.fill('#bankPoints', '400');
await page.fill('#bankUnit', 'Unit 2');
await page.selectOption('#bankDifficulty', 'Hard');
await page.click('#bankAddBtn');
await settle(page, 150);
eq((await shown()).length, 4, 'Add puts a fourth question in the list');
await page.selectOption('#bankFilterUnit', 'Unit 2');
await settle(page, 150);
eq(await shown(), ['Agent number? / 007', 'Longest river? / The Nile'], 'the unit filter still filters');
await page.click('#bankClearFiltersBtn');
await settle(page, 150);
await page.click('#bankList .bank-entry:nth-child(1) button.danger');
await settle(page, 150);
eq((await shown())[0], 'A comma, a "quote" and a <b>tag</b> / =1+1', 'Delete takes the first one out');
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD_RAW, 'and none of that touched the old key');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 200);
eq((await shown()).length, 3, 'after a reload the deleted entry has not come back from the old key');

/* A question another tool will have given more than 030 shows (P2). */
const MEDIA = { kind: 'image', ref: 'idb:rgb/made-up', alt: 'A river on a map' };
await page.evaluate((media) => {
  const q = window.QuestionBank.list().find(x => x.prompt === 'Longest river?');
  window.QuestionBank.saveQuestion({ id: q.id, choices: ['The Nile', 'The Amazon | maybe'], tags: ['rivers', 'africa'], media, hint: 'Flows north' });
}, MEDIA);
const before = await bank();

/* ── 3. the bank file ───────────────────────────────────────────────────── */
ok(await page.isVisible('#bankExportBtn') && await page.isVisible('#bankExportSheetBtn') && await page.isVisible('#bankImportFile'), 'the bank tab has Save bank file, Save as spreadsheet and an import picker');
const jsonText = await downloadText(page, '#bankExportBtn', { what: 'the bank file' });
const file = JSON.parse(jsonText);
eq([file.format, file.version, file.questions.length], ['aplp-question-bank', 1, 3], 'Save bank file writes the format, its version and all three questions');
eq(file.questions, before, 'each exactly as stored: ids, choices, tags, media and a field 030 does not know');
eq((await status())[1], 'import-status ok', 'and says so');

// Captures the workbook the page saves, read back by the page's own SheetJS.
async function saveSheet() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const real = URL.createObjectURL;
    const timer = setTimeout(() => { URL.createObjectURL = real; reject(new Error('no workbook was saved')); }, 15000);
    URL.createObjectURL = function (blob) {
      URL.createObjectURL = real;
      clearTimeout(timer);
      blob.arrayBuffer().then(buf => {
        const bytes = new Uint8Array(buf);
        const wb = window.XLSX.read(bytes, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const cells = {};
        Object.keys(ws).filter(k => k[0] !== '!').forEach(k => { cells[k] = { t: ws[k].t, v: ws[k].v, f: ws[k].f || null }; });
        resolve({ name: wb.SheetNames[0], cells, bytes: Array.from(bytes) });
      }, reject);
      return real.call(URL, blob);
    };
    document.getElementById('bankExportSheetBtn').click();
  }));
}
const sheet = await saveSheet();
eq(Object.values(sheet.cells).filter(c => c.f).length, 0, 'Save as spreadsheet writes a workbook with no formula cell');
eq([sheet.name, sheet.cells.A1.v, sheet.cells.I1.v], ['Questions', 'Question', 'ID (leave as it is)'], 'one sheet, a header row, the id in the last column');
eq([sheet.cells.B2, sheet.cells.B3, sheet.cells.C2.t], [{ t: 's', v: '=1+1', f: null }, { t: 's', v: '007', f: null }, 'n'], 'an answer of =1+1 or 007 is a string cell; points is a number');
eq(sheet.cells.H4.v, 'The Nile\nThe Amazon | maybe', 'choices are in one cell, a line each when one has a bar in it');

/* ── importing into an empty browser ────────────────────────────────────── */
await open({ clear: true });
eq(await shown(), [], 'a cleared browser has an empty bank');
await importFile('question-bank.json', 'application/json', jsonText);
eq(await status(), ['3 questions added.', 'import-status ok'], 'importing the bank file adds its three questions');
eq(await bank(), before, 'and the bank is the one that was saved, field for field, in order');
eq((await shown()).length, 3, 'the list shows them without a reload');
ok(await page.evaluate(k => localStorage.getItem(k), OLD_KEY) === null, 'the old key is not created');
await importFile('question-bank.json', 'application/json', jsonText);
eq(await status(), ['0 questions added, 3 already in the bank.', 'import-status ok'], 'importing it again adds nothing and says why');
eq(await bank(), before, 'and changes nothing');

/* ── 4. the workbook back in ────────────────────────────────────────────── */
await importFile('question-bank.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from(sheet.bytes));
eq(await status(), ['0 questions added, 3 already in the bank.', 'import-status ok'], 'the spreadsheet, imported over the bank it was saved from, changes nothing');
eq(await bank(), before, 'not the media and the unknown field it cannot carry, not the choice with a bar in it');
await open({ clear: true });
await importFile('question-bank.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from(sheet.bytes));
const fromSheet = await bank();
const columns = q => [q.id, q.prompt, q.answer, q.points, q.unit, q.standard, q.difficulty, q.tags, q.choices || null];
eq([(await status())[0], fromSheet.map(columns)], ['3 questions added.', before.map(columns)], 'into an empty browser the spreadsheet brings every column back: =1+1 and 007 as text, ids, tags, choices');

/* ── 5. a hand-made CSV ─────────────────────────────────────────────────── */
const CSV = 'Question,Answer,Points,Unit,Difficulty\r\n' +
  '"Smallest prime?",2,100,Unit 3,easy\r\n' +
  'agent NUMBER?,007,,,\r\n' +                       // already in the bank, in other letters
  'No answer on this row,,100,Unit 3,\r\n' +
  '"\'=SUM(A1:A2)",\'-4,200,Unit 3,Hard\r\n';        // a formula guard's apostrophes
await importFile('more.csv', 'text/csv', CSV);
eq(await status(), ['2 questions added, 1 already in the bank. Left out: row 4 (no answer).', 'import-status ok'], 'a CSV adds its new rows, skips the one already here and names the bad row by its number');
const after = await bank();
eq(after.slice(3).map(q => [q.prompt, q.answer, q.points, q.unit, q.difficulty]), [['Smallest prime?', '2', 100, 'Unit 3', 'Easy'], ['=SUM(A1:A2)', '-4', 200, 'Unit 3', 'Hard']],
  'the answers are text, the difficulty is read whatever its case, and the guard apostrophes are gone');
eq((await shown()).slice(3), ['Smallest prime? / 2', '=SUM(A1:A2) / -4'], 'and the page shows them');

/* ── 6. files that are not a bank ───────────────────────────────────────── */
for (const [name, type, body, want] of [
  ['roster.csv', 'text/csv', 'Name,Period\r\nAvery Example,3\r\n', 'No header row with a "Question" and an "Answer" column was found.'],
  ['broken.json', 'application/json', '{"format": "aplp-question-bank", ', 'That file is not readable JSON.'],
  ['other.json', 'application/json', '{"boards": []}', 'That file has no list of questions in it.'],
  ['newer.json', 'application/json', JSON.stringify({ format: 'aplp-question-bank', version: 2, questions: [{ prompt: 'p', answer: 'a' }] }), 'That bank was saved by a newer version of this site. Update this page, then import it again.'],
]) {
  await importFile(name, type, body);
  eq(await status(), [want, 'import-status error'], `${name} is refused in words`);
}
await importFile('empty.csv', 'text/csv', 'Question,Answer\r\n,only an answer\r\n');
eq(await status(), ['0 questions added. Left out: row 2 (no question).', 'import-status error'], 'a sheet with nothing usable in it is an error that names the row');
eq(await bank(), after, 'and after all five the bank is untouched');

/* ── an empty bank has nothing to save ──────────────────────────────────── */
/* ── 7. axe, on the bank tab with the new card showing ──────────────────── */
const violations = await a11yScan(page, { include: '#bankSection' });
eq(violations.map(v => v.id + ' ' + v.nodes.join(' ')), [], 'the bank tab has no serious or critical axe violation');
await open({ clear: true });
await page.click('#bankExportBtn');
eq(await status(), ['The bank is empty, so there is nothing to save yet.', 'import-status error'], 'Save bank file on an empty bank says there is nothing to save');

/* ── no console noise, nothing left the site ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
