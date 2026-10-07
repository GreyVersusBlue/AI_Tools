// _rounds-game.mjs — a board played through the final wager round and
// quiz-bowl, the way the v284 page played them. smoke-play-wheel.mjs runs
// this and compares each capture with a hash made with `--print` against the
// v284 page, before the wheel was written. Nothing here turns the wheel on.
//
// Every name and question is made up.

import { settle, downloadText } from '../../board-check/harness.mjs';
import { OLD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';

const q = (id, prompt, answer) => ({ id, prompt, answer, choices: [], media: null, unit: '', standard: '', difficulty: '', tags: [], points: 100, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
export const ROUNDS_BANK = { v: 1, data: { schema: 1, questions: [
  q('q-a', 'Capital of Peru?', 'Lima'), q('q-b', 'Longest river?', 'The Nile'), q('q-skip', 'No answer here?', ''),
  q('q-c', 'Largest lake?', 'The Caspian'), q('q-d', 'Highest peak?', 'Everest'),
], legacy: {} } };

const roundNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  return JSON.stringify({
    open: id('roundOverlay').classList.contains('show'), head: id('roundHead').textContent,
    question: id('roundQuestion').textContent + '|' + id('roundQuestion').hidden,
    answer: id('roundAnswer').textContent + '|' + getComputedStyle(id('roundAnswer')).display,
    body: id('roundBody').innerHTML, actions: id('roundActions').innerHTML, status: id('roundStatus').textContent,
  });
});
const boardNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  return [id('scoreboard').innerHTML, id('boardCols').outerHTML, id('boardStatus').textContent,
    id('finalSetup').hidden + '|' + id('finalSetup').innerHTML, id('finalQuestion').value + '|' + id('finalAnswer').value,
    id('quizBowlSetup').hidden + '|' + id('quizBowlSetup').innerHTML,
    [id('qbTossup').value, id('qbBonus').value, id('qbPenalty').value, id('qbTossup').disabled].join('|'),
    id('finalStatus').textContent, id('quizBowlStatus').textContent, id('quizBowlProgress').textContent,
    document.activeElement.id].join('\n');
});

/** Plays OLD_BOARD through both rounds and returns { name: text } captures. */
export async function playRoundsGame(page, url) {
  const got = {};
  const cap = async name => { got[name + 'Round'] = await roundNow(page); got[name + 'Board'] = await boardNow(page); got[name + 'Storage'] = await boardStorage(page); };
  const press = async k => { await page.keyboard.press(k); await settle(page, 120); };
  const click = async sel => { await page.click(sel); await settle(page, 150); };
  const act = async label => click(`#roundActions button:has-text("${label}")`);
  page.on('dialog', d => d.accept());
  await openWith(page, url, Object.assign(storageOf(OLD_BOARD), { 'gvb-question-bank': JSON.stringify(ROUNDS_BANK) }));

  /* the final wager round */
  await page.check('#finalToggle');
  await settle(page, 150);
  await cap('finalTicked');
  await page.selectOption('#finalPick', 'q-c');
  await click('#finalUseBtn');
  await click('#finalStartBtn');
  await cap('finalWagers');
  await page.fill('#fw-0', '101');
  await act('All wagers are in');
  await cap('finalRefused');
  for (const [i, w] of [[0, '100'], [1, '0'], [2, '40']]) await page.fill('#fw-' + i, w);
  await page.focus('#fw-2');
  await press('Enter');
  await cap('finalQuestion');
  await page.evaluate(() => document.activeElement.blur());
  await press('Space');
  await press('1');
  await press('3');
  await press('3');
  await press('Enter');
  await cap('finalUnmarked');
  await page.check('input[name="fm-1"][value="w"]');
  await act('Score the final round');
  await cap('finalScored');
  await press('Escape');
  await cap('finalClosed');
  got.finalExport = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
  await click('#finalUndoBtn');
  await cap('finalTakenBack');

  /* quiz-bowl */
  await page.check('#quizBowlToggle');
  await settle(page, 150);
  await page.fill('#qbPenalty', '5');
  await page.dispatchEvent('#qbPenalty', 'change');
  await cap('qbTicked');
  await click('#quizBowlStartBtn');
  await cap('qbTossup');
  await press('2');
  await cap('qbBuzzed');
  await press('w');
  await cap('qbLocked');
  await click('#roundBody .award-row button:nth-child(3)');
  await press('r');
  await cap('qbRight');
  await act('Bonus question for Finches');
  await page.evaluate(() => document.activeElement.blur());
  await press('Space');
  await press('r');
  await cap('qbBonus');
  await act('Next toss-up');
  await act('Nobody got it');
  await cap('qbDead');
  await act('End the round');
  await cap('qbSummary');
  await press('Escape');
  await cap('qbClosed');
  got.qbExport = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
  await click('#quizBowlUndoBtn');
  await cap('qbUndone');

  await click('#editBoardBtn');
  await click('#buildFromManualBtn');
  await settle(page, 300);
  await cap('edited');
  await click('#resetGameBtn');
  await settle(page, 200);
  await cap('reset');
  await page.setInputFiles('#importBoardFile', { name: 'rounds.json', mimeType: 'application/json', buffer: Buffer.from(got.qbExport) });
  await settle(page, 500);
  await cap('imported');
  page.removeAllListeners('dialog');
  return got;
}
