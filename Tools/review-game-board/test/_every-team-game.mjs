// _every-team-game.mjs — a board played with every team answering, the way
// the v281 page played it. smoke-play-rounds.mjs runs this and compares each
// capture with a hash made with `--print` against the v282 page (030 as v281
// left it), before the final wager round and quiz-bowl were written. Nothing
// here turns either of those on.
//
// Every name and question is made up.

import { settle, downloadText } from '../../board-check/harness.mjs';
import { OLD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';

const panelNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  const shown = x => getComputedStyle(id(x)).display !== 'none';
  return JSON.stringify({
    open: id('overlay').classList.contains('show'), head: id('overlayCatPoints').textContent,
    answerShown: shown('overlayAnswer'), award: id('awardRow').innerHTML, awardShown: shown('awardRow'),
    eta: shown('etaPanel'), rule: id('etaRule').textContent, teams: id('etaTeams').innerHTML,
    marks: Array.from(id('etaTeams').querySelectorAll('input:checked')).map(i => i.value).join(''),
    status: id('etaStatus').textContent, closeUsed: shown('closeUsedRow'),
  });
});
const boardNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  return [id('boardTitle').textContent, id('scoreboard').innerHTML, id('boardCols').outerHTML,
    id('undoScoreBtn').textContent + '|' + id('undoScoreBtn').disabled, id('boardStatus').textContent,
    id('everyTeamToggle').checked + '|' + id('everyTeamRule').hidden + '|' + id('everyTeamRule').textContent].join('\n');
});

/** Plays OLD_BOARD with the mode ticked through every path the mode has and
    returns { name: text } captures, in order. */
export async function playEveryTeamGame(page, url) {
  const got = {};
  page.on('dialog', d => d.accept());
  await openWith(page, url, storageOf(OLD_BOARD));
  await page.check('#everyTeamToggle');
  await settle(page, 150);
  got.tickedBoard = await boardNow(page);
  got.tickedStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');          // Deltas 100
  await settle(page, 150);
  await page.keyboard.press('Space');
  await settle(page, 150);
  got.panel = await panelNow(page);
  await page.keyboard.press('1');                                        // Otters right
  await page.keyboard.press('3');
  await page.keyboard.press('3');                                        // Finches wrong
  await settle(page, 100);
  got.panelMarked = await panelNow(page);
  await page.keyboard.press('Enter');
  await settle(page, 200);
  got.scoredBoard = await boardNow(page);
  got.scoredStorage = await boardStorage(page);

  await page.click('#undoScoreBtn');
  await settle(page, 150);
  got.undoneBoard = await boardNow(page);
  got.undoneStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 100);
  await page.click('#showAnswerBtn');
  await settle(page, 100);
  await page.click('#etaTeams fieldset:nth-of-type(2) input[value="r"]');  // Herons right, by the mouse
  await page.click('#etaScoreBtn');
  await settle(page, 200);
  got.mouseBoard = await boardNow(page);
  got.mouseStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 100);
  await page.click('#showAnswerBtn');
  await settle(page, 100);
  await page.keyboard.press('Escape');                                   // used, no points, no marks
  await settle(page, 150);
  got.usedNoMarksStorage = await boardStorage(page);

  got.exported = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });

  await page.click('#editBoardBtn');
  await settle(page, 200);
  await page.click('#buildFromManualBtn');
  await settle(page, 300);
  got.editedBoard = await boardNow(page);
  got.editedStorage = await boardStorage(page);

  await page.click('#scoreboard .team-chip:nth-child(3) button.danger');   // Finches leave
  await settle(page, 150);
  got.droppedBoard = await boardNow(page);
  got.droppedStorage = await boardStorage(page);

  await page.uncheck('#everyTeamToggle');
  await settle(page, 150);
  got.offBoard = await boardNow(page);
  got.offStorage = await boardStorage(page);
  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 100);
  await page.keyboard.press('Space');
  await settle(page, 100);
  got.offPanel = await panelNow(page);
  await page.keyboard.press('Escape');
  await settle(page, 100);
  await page.check('#everyTeamToggle');
  await settle(page, 150);

  await page.click('#resetGameBtn');
  await settle(page, 200);
  got.resetBoard = await boardNow(page);
  got.resetStorage = await boardStorage(page);

  await page.setInputFiles('#importBoardFile', { name: 'every-team.json', mimeType: 'application/json', buffer: Buffer.from(got.exported) });
  await settle(page, 500);
  got.importedStorage = await page.evaluate(() => localStorage.getItem('gvb-review-board:data:Rivers (2)'));
  got.importedBoard = await boardNow(page);
  page.removeAllListeners('dialog');
  return got;
}
