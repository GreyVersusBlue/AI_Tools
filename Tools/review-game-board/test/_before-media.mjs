// _before-media.mjs — what 030 did with a bank and a board file BEFORE a
// question could carry a picture (Path 12 P4), as steps a suite can replay.
// Not a suite (the underscore keeps it off the list): smoke-bank-media.mjs
// runs it and compares each capture with golden-before-media.json, which was
// made by `--print` against the v287 page before that page was edited.
// Every question, name and picture here is made up.

import { createHash } from 'node:crypto';
import { settle, downloadText } from '../../board-check/harness.mjs';

export const sha = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

export const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
export const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';

const KEY = 'gvb-question-bank';
const DATA = 'gvb-review-board:data:';

/* A bank as v265 to v287 stored it: no question has a picture. One has
   choices and tags, one a field 030 does not know, one a `media` of a shape
   no page ever read (it must be carried as it is). */
export const OLD_BANK = { v: 1, data: { schema: 1, legacy: { 'gvb-review-board-bank:entries': [] }, questions: [
  { id: 'q-old-1', prompt: 'Capital of Peru?', answer: 'Lima', choices: ['Lima', 'Quito', 'Cusco'], unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', tags: ['capitals', 'south america'], points: 100, createdAt: '2026-08-20T14:00:00.000Z' },
  { id: 'q-old-2', prompt: 'A comma, a "quote" and a <b>tag</b>', answer: '=1+1', unit: 'Unit 1', standard: '', difficulty: 'Medium', tags: [], points: 200, createdAt: '2026-08-21T14:00:00.000Z', hint: 'made up' },
  { id: 'q-old-3', prompt: 'Longest river?', answer: 'The Nile', media: { kind: 'image', ref: 'idb:rgb/made-up', alt: 'A river' }, unit: 'Unit 2', standard: '', difficulty: '', tags: ['rivers'], points: 300, createdAt: '2026-08-22T14:00:00.000Z' },
] } };

/* A bank file as "Save bank file" wrote it before today, with one question
   the bank has (changed), one it has (the same) and one new. */
export const OLD_FILE = JSON.stringify({ format: 'aplp-question-bank', version: 1, title: 'Question bank', exported: '2026-10-01T12:00:00.000Z', questions: [
  { id: 'q-old-1', prompt: 'Capital of Peru?', answer: 'Lima', choices: ['Lima', 'Quito', 'Cusco'], unit: 'Unit 1', standard: '6.G.1', difficulty: 'Hard', tags: ['capitals', 'south america'], points: 100, createdAt: '2026-08-20T14:00:00.000Z' },
  { id: 'q-old-3', prompt: 'Longest river?', answer: 'The Nile', media: { kind: 'image', ref: 'idb:rgb/made-up', alt: 'A river' }, unit: 'Unit 2', standard: '', difficulty: '', tags: ['rivers'], points: 300, createdAt: '2026-08-22T14:00:00.000Z' },
  { id: 'q-file-9', prompt: 'Smallest prime?', answer: '2', unit: 'Unit 3', standard: '', difficulty: 'Easy', tags: [], points: 100, createdAt: '2026-09-02T14:00:00.000Z' },
  { id: 'q-file-10', prompt: 'No answer here', answer: '', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-09-02T14:00:00.000Z' },
] }, null, 2);

const clue = (points, question, image) => {
  const c = { points, question, answer: question + ' answer', used: false, dailyDouble: false };
  if (image !== undefined) c.image = image;
  return c;
};
export const OLD_BOARD = {
  name: 'Rivers', categories: [{ name: 'Maps', clues: [clue(100, 'Which river?', RED), clue(200, 'Which sea?', BLUE), clue(300, 'Name a delta')] }],
  teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};
/* A board file from before today: two real pictures, another browser's
   reference, and a value that only looks like a picture. */
export const OLD_BOARD_FILE = JSON.stringify({
  name: 'Deltas', categories: [{ name: 'Maps', clues: [
    clue(100, 'Which delta?', RED), clue(200, 'Why deltas form', BLUE),
    clue(300, 'From another browser', 'idb:h0000000000000000000000000000dead'),
    clue(400, 'Not a picture', 'https://example.invalid/x.png'),
  ] }],
  teams: [{ name: 'Otters', score: 0 }, { name: 'Herons', score: 0 }],
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
}, null, 2);

const SEED = {
  'gvb-review-board:list': ['Rivers'],
  'gvb-review-board:current': 'Rivers',
  [DATA + 'Rivers']: OLD_BOARD,
  [KEY]: OLD_BANK,
};

/** Plays the old page through and returns { name: text } of what it showed
    and stored. `page` is a prepPage() page with dialogs accepted. */
export async function playBefore(page, urlPage) {
  const out = {};
  const load = async () => {
    await page.goto(urlPage, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__clueImagesSettled === true, null, { timeout: 8000 });
    await settle(page, 250);
  };
  await page.goto(urlPage, { waitUntil: 'load' });
  await page.evaluate(s => {
    localStorage.clear();
    Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
  }, SEED);
  await load();

  out.bankKeyAfterLoad = await page.evaluate(k => localStorage.getItem(k), KEY);
  await page.click('.top-tab-btn[data-top="bank"]');
  await settle(page, 200);
  out.bankRows = await page.$eval('#bankList', el => el.innerHTML);
  out.bankFile = (await downloadText(page, '#bankExportBtn', { what: 'the bank file' })).replace(/"exported": "[^"]*"/, '"exported": "X"');
  out.bankFileStatus = await page.$eval('#bankFileStatus', el => el.className + '|' + el.textContent);

  // The old bank file: shown, then stored.
  await page.setInputFiles('#bankImportFile', { name: 'old-bank.json', mimeType: 'application/json', buffer: Buffer.from(OLD_FILE, 'utf8') });
  await page.waitForFunction(() => { const t = document.getElementById('bankFileStatus').textContent; return t && !/^Reading /.test(t); }, null, { timeout: 15000 });
  await settle(page, 200);
  out.previewList = await page.$eval('#bankImportList', el => el.innerHTML);
  out.previewSummary = await page.$eval('#bankImportSummary', el => el.textContent);
  out.previewButton = await page.$eval('#bankImportAddBtn', el => el.textContent);
  await page.click('#bankImportAddBtn');
  await settle(page, 200);
  out.importStatus = await page.$eval('#bankFileStatus', el => el.className + '|' + el.textContent);
  out.bankAfterImport = await page.evaluate(() => JSON.stringify(window.QuestionBank.list().map(q => { const c = Object.assign({}, q); delete c.updatedAt; return c; })));
  out.bankRowsAfterImport = await page.$eval('#bankList', el => el.innerHTML);

  // A bank question pulled into the open board's editor.
  await page.click('#bankList .bank-entry:nth-child(1) input[type="checkbox"]');
  await page.fill('#bankPullCategory', 'Pulled');
  await page.click('#bankPullBtn');
  await settle(page, 300);
  out.pulledRow = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll('#categoriesEditor .category-block'));
    const block = blocks.filter(b => b.querySelector('.cat-name-input').value === 'Pulled')[0];
    return Array.from(block.querySelectorAll('.clue-row')).map(r => [
      r.querySelector('.clue-points').value, r.querySelector('.clue-question').value, r.querySelector('.clue-answer').value,
      String(r.__clueImage || ''), String(r.__clueAudioId || ''),
    ].join('|')).join('\n');
  });

  // The board with pictures, saved before today: stored, exported, imported.
  await load();
  out.boardStored = await page.evaluate(k => localStorage.getItem(k), DATA + 'Rivers');
  out.boardExport = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
  await page.setInputFiles('#importBoardFile', { name: 'deltas.json', mimeType: 'application/json', buffer: Buffer.from(OLD_BOARD_FILE, 'utf8') });
  await page.waitForFunction(() => localStorage.getItem('gvb-review-board:current') === 'Deltas', null, { timeout: 8000 });
  await settle(page, 300);
  out.boardImported = await page.evaluate(k => localStorage.getItem(k), DATA + 'Deltas');
  out.boardImportedGrid = await page.$eval('#boardCols', el => el.innerHTML);
  out.imageNote = await page.$eval('#imageNote', el => String(el.hidden) + '|' + el.textContent);
  out.mediaRecords = await page.evaluate(() => window.MediaDB.store({ ns: 'rgb' }).list().then(l => l.map(r => r.id + ':' + r.size + ':' + r.type).sort().join(',')));
  return out;
}
