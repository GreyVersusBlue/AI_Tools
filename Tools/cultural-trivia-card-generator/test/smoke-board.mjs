// smoke-board.mjs — 053's "Review game board" tab, and 030 taking its file
// (BACKLOG rank 86).
//
//   node Tools/cultural-trivia-card-generator/test/smoke-board.mjs   (port 8679)
//
// What's worth holding still:
//   1. the tab previews three categories across and five clues down, 100 to
//      500, the questions ctcg-board.js picks, each with its tier;
//   2. "Save board file" saves exactly CulturalTriviaBoard.build() of what the
//      page shows, and says so; nothing in storage changes;
//   3. hiding a built-in and adding one's own change the board as the rule
//      says, and a question that is markup is shown as text;
//   4. with every question hidden there is no board and the button is off;
//   5. 030's Import JSON, unchanged, opens the file as a board named
//      "Cultural Trivia": the three categories, the fifteen clues word for
//      word and their points, two teams;
//   6. the tab is clean under axe.
// The rule itself is board.test.mjs. Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8679;
const BASE = `http://127.0.0.1:${PORT}`;
const P053 = BASE + '/Tools/053-cultural-trivia-card-generator.html';
const P030 = BASE + '/Tools/030-review-game-board.html';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
page.on('dialog', d => d.accept());
page.on('crash', () => console.log('  (the page crashed)'));

console.log('Cultural Trivia (053) — the ready-made Review Game Board');

async function open053({ clear = false, set = null } = {}) {
  await page.goto(P053, { waitUntil: 'networkidle' });
  if (clear || set) {
    await page.evaluate(({ clear, set }) => {
      if (clear) localStorage.clear();
      if (set) Object.keys(set).forEach(k => localStorage.setItem(k, set[k]));
    }, { clear, set });
    await page.goto(P053, { waitUntil: 'networkidle' });
  }
  await settle(page, 200);
  await page.click('.tab-btn[data-stage="board"]');
  await settle(page, 150);
}
const preview = () => page.$$eval('#boardPreview table', ts => ts.map(t => ({
  heads: [...t.querySelectorAll('thead th')].map(th => th.textContent),
  rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => {
    const pts = td.querySelector('.pts');
    return pts ? [pts.textContent, td.querySelector('.tier').textContent] : null;
  })),
}))[0] || null);
const expected = () => page.evaluate(() => window.CulturalTriviaBoard.build({
  items: window.CulturalTriviaBank.items(), labels: window.CulturalTriviaBank.CAT_LABELS,
  tierOf: window.CulturalTriviaBank.tierOf, name: 'Cultural Trivia',
}));
const storage = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));

/* 1. preview */
await open053({ clear: true });
const view = await preview();
eq(view && view.heads, ['Hispanic World', 'Francophone World', 'Global Culture'], 'three categories across');
eq(view && view.rows.map(r => r.map(c => c && c[0])), [100, 200, 300, 400, 500].map(p => [String(p), String(p), String(p)]), 'five clues down, 100 to 500');
eq(view && view.rows[0].map(c => c[1]), ['easy', 'easy', 'easy'], 'the 100s are easy');
eq(view && view.rows[4].map(c => c[1]), ['hard', 'hard', 'hard'], 'the 500s are hard');
const want = await expected();
eq(await page.$$eval('#boardPreview tbody tr:first-child td div:not(.ans)', ds => ds.map(d => d.textContent)), want.columns.map(c => c.clues[0].question), 'the 100s are the questions the rule picks');
eq(await page.isEnabled('#saveBoardBtn'), true, 'the button is on');

/* 2. the file */
const before = await storage();
const text = await downloadText(page, '#saveBoardBtn', { what: 'the board file' });
eq(JSON.parse(text), want.board, 'the file is build() of what the page shows');
eq(text, JSON.stringify(want.board, null, 2), 'written as indented JSON');
ok(/^Saved cultural-trivia-board\.json: 3 categories, 15 clues\./.test(await page.textContent('#boardNote')), 'the note says what was saved');
eq(await storage(), before, 'saving changes nothing in storage');

/* 3. hidden and own */
await page.click('.tab-btn[data-stage="bank"]');
for (const id of ['b0', 'b8', 'b9']) await page.click(`#bankList [data-hide="${id}"]`);
await page.fill('#newQ', '<img src=x onerror="window.__pwned=1">');
await page.fill('#newA', 'Mine');
await page.selectOption('#newCategory', 'hispanic');
// With b0, b8 and b9 hidden Hispanic World has seven built-ins; mine is a
// medium, last of its tier (easy b5 b6; medium b1 b3 mine; hard b2 b4 b7): eight, so places 0, 2, 4, 5, 7 and mine is the 300.
await page.click('#addQBtn');
await page.click('.tab-btn[data-stage="board"]');
await settle(page, 150);
const firstCol = await page.$$eval('#boardPreview tbody tr', trs => trs.map(tr => {
  const td = tr.children[0];
  return [td.querySelector('.tier').textContent, td.querySelector('div').textContent];
}));
const after = await page.evaluate(() => window.CulturalTriviaBoard.build({
  items: window.CulturalTriviaBank.items().filter(i => ['b0', 'b8', 'b9'].indexOf(i.id) === -1).concat([{ id: 'x', category: 'hispanic', q: '<img src=x onerror="window.__pwned=1">', a: 'Mine', custom: true }]),
  labels: window.CulturalTriviaBank.CAT_LABELS, tierOf: window.CulturalTriviaBank.tierOf,
}));
eq(firstCol, after.columns[0].clues.map(c => [c.tier + (c.custom ? ', yours' : ''), c.question]), 'with three hidden and one of my own, Hispanic World is the rule’s pick');
eq(firstCol[2], ['medium, yours', '<img src=x onerror="window.__pwned=1">'], 'my own question is the 300, marked as mine and medium');
eq([await page.$$eval('#boardPreview img', i => i.length), await page.evaluate(() => window.__pwned || 0)], [0, 0], 'a question that is markup is shown as text');

/* 4. everything hidden */
const allIds = await page.evaluate(() => window.CulturalTriviaBank.items().map(i => i.id));
await open053({ clear: true, set: { ctcg_hidden_v1: JSON.stringify(allIds) } });
eq([await preview(), await page.isEnabled('#saveBoardBtn')], [null, false], 'with every question hidden there is no board and the button is off');
ok(/nothing to put on a board/.test(await page.textContent('#boardPreview')), 'and it says why');

/* 6. axe, on the full board */
await open053({ clear: true });
const scan = await a11yScan(page, { include: '#stage-board' });
eq(scan.map(v => v.id), [], 'the tab is clean under axe');

/* 5. 030 */
await page.goto(P030, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(P030, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.setInputFiles('#importBoardFile', { name: 'cultural-trivia-board.json', mimeType: 'application/json', buffer: Buffer.from(text) });
await page.waitForFunction(() => document.getElementById('boardTitle').textContent === 'Cultural Trivia', null, { timeout: 15000 }).catch(() => {});
eq(await page.textContent('#boardTitle'), 'Cultural Trivia', '030 opens it as a board named Cultural Trivia');
eq(await page.$$eval('.cat-header', hs => hs.map(h => h.textContent.trim())), ['Hispanic World', 'Francophone World', 'Global Culture'], 'with the three categories');
const stored = await page.evaluate(() => window.ReviewBoardStore.loadBoard('Cultural Trivia'));
eq(stored && stored.categories.map(c => [c.name, c.clues.map(cl => [cl.points, cl.question, cl.answer])]),
  want.board.categories.map(c => [c.name, c.clues.map(cl => [cl.points, cl.question, cl.answer])]), 'and the fifteen clues word for word, at their points');
eq(stored && stored.teams.map(t => t.name), ['Team 1', 'Team 2'], 'and two teams');
eq(await page.$$eval('.cell:not(.blank)', cs => cs.length), 15, 'fifteen clue cells to play');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
