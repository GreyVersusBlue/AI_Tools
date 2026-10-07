// _old-game.mjs — a board from before every-team-answers, played the way it
// has always been played. smoke-play-modes.mjs runs this and compares each
// capture with a hash made with `--print` against the v279 page, before the
// page was edited. Nothing here turns the new mode on.
//
// Every name and question is made up.

import crypto from 'node:crypto';
import { settle, downloadText } from '../../board-check/harness.mjs';

export const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 16);

const clue = (points, question, answer, used) => ({ points, question, answer, used: !!used, dailyDouble: false });

/* A board as v279 and every page before it saved one: no field this
   increment adds. Three teams, a clue already played, a score already made. */
export const OLD_BOARD = {
  name: 'Rivers',
  categories: [
    { name: 'Rivers', clues: [clue(100, 'Longest river?', 'The Nile', true), clue(200, 'Widest river?', 'The Amazon'), clue(300, 'A <b>bold</b> & "quoted" river?', '<i>None</i>')] },
    { name: 'Deltas', clues: [clue(100, 'Which delta?', 'The Mekong'), clue(200, 'Why deltas form', 'Silt settles')] },
  ],
  teams: [{ name: 'Otters', score: 100 }, { name: 'Herons', score: 0 }, { name: 'Finches', score: -10 }],
  dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};

/* One unused clue, and it is the Daily Double: the only board on which the
   wager is not a matter of chance. */
export const DD_BOARD = {
  name: 'Wager',
  categories: [{ name: 'Lakes', clues: [clue(100, 'Deepest lake?', 'Baikal', true), { points: 200, question: 'Largest lake?', answer: 'The Caspian', used: false, dailyDouble: true }] }],
  teams: [{ name: 'Otters', score: 300 }, { name: 'Herons', score: 150 }],
  dailyDoubleEnabled: true, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};

/* A file as "Export JSON" wrote it before today (the board, pretty-printed). */
export const OLD_EXPORT = JSON.stringify(Object.assign({}, OLD_BOARD, { name: 'From a file' }), null, 2);

export const storageOf = board => ({
  'gvb-review-board:list': JSON.stringify([board.name]),
  'gvb-review-board:current': board.name,
  ['gvb-review-board:data:' + board.name]: JSON.stringify(board),
});

/* Only this tool's keys: the a11y prefs and the storage probe are not the game. */
export const boardStorage = page => page.evaluate(() => JSON.stringify(Object.keys(localStorage)
  .filter(k => k.indexOf('gvb-review-board:') === 0).sort().map(k => [k, localStorage.getItem(k)])));

export async function openWith(page, url, storage) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(s => { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }, storage);
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
}

/* What the room sees while a clue is open. */
const overlayNow = page => page.evaluate(() => {
  const id = x => document.getElementById(x);
  const shown = x => getComputedStyle(id(x)).display !== 'none';
  return JSON.stringify({
    open: id('overlay').classList.contains('show'),
    head: id('overlayCatPoints').textContent, question: id('overlayQuestion').textContent,
    answer: id('overlayAnswer').textContent, answerShown: shown('overlayAnswer'),
    showAnswer: shown('showAnswerBtn'), closeNoAsk: shown('closeNoAskBtn'), closeUsed: shown('closeUsedRow'),
    wager: shown('wagerPanel'), wagerTeams: id('wagerTeamSelect').innerHTML, wagerAmount: id('wagerAmount').value,
    awardShown: shown('awardRow'), award: id('awardRow').innerHTML,
  });
});
const boardNow = page => page.evaluate(() => document.getElementById('boardTitle').textContent + '\n' +
  document.getElementById('scoreboard').innerHTML + '\n' + document.getElementById('boardCols').outerHTML + '\n' +
  document.getElementById('undoScoreBtn').textContent + '|' + document.getElementById('undoScoreBtn').disabled);

/** Plays the old board through every path the one-team game has and returns
    { name: text } captures, in order. */
export async function playOldGame(page, url) {
  const got = {};
  page.on('dialog', d => d.accept());

  await openWith(page, url, storageOf(OLD_BOARD));
  got.loadStorage = await boardStorage(page);
  got.loadBoard = await boardNow(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');          // Deltas 100 (row order)
  await settle(page, 150);
  got.clueOpen = await overlayNow(page);
  await page.keyboard.press('Space');
  await settle(page, 150);
  got.clueRevealed = await overlayNow(page);
  await page.keyboard.press('2');                                        // + to Herons
  await settle(page, 150);
  got.awardedOverlay = await overlayNow(page);
  got.awardedBoard = await boardNow(page);
  got.awardedStorage = await boardStorage(page);

  await page.click('#undoScoreBtn');
  await settle(page, 150);
  got.undoneBoard = await boardNow(page);
  got.undoneStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 100);
  await page.keyboard.press('Escape');                                   // closed, not asked
  await settle(page, 100);
  got.notAskedStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');
  await settle(page, 100);
  await page.click('#showAnswerBtn');
  await settle(page, 100);
  await page.keyboard.press('Escape');                                   // used, no points
  await settle(page, 150);
  got.usedNoPointsBoard = await boardNow(page);
  got.usedNoPointsStorage = await boardStorage(page);

  await page.click('#boardCols .cell:not(.used):not(.blank)');          // by the mouse this time
  await settle(page, 100);
  await page.click('#showAnswerBtn');
  await settle(page, 100);
  await page.click('#awardRow button:nth-child(3)');                     // + to Finches
  await settle(page, 150);
  got.mouseAwardBoard = await boardNow(page);

  await page.click('#scoreboard .team-chip:nth-child(1) button:nth-of-type(2)');   // + 10
  await page.click('#scoreboard .team-chip:nth-child(2) button:nth-of-type(1)');   // − 10
  await settle(page, 100);
  got.nudgedBoard = await boardNow(page);
  got.nudgedStorage = await boardStorage(page);

  await page.click('#printAnswerKeyBtn');
  await settle(page, 200);
  got.answerKey = await page.evaluate(() => document.getElementById('printArea').innerHTML + '|' + window.__printed + '|' + document.body.className);
  await page.click('#printQuizBtn');
  await settle(page, 200);
  got.practiceQuiz = await page.evaluate(() => document.getElementById('printArea').innerHTML + '|' + window.__printed + '|' + document.body.className);

  got.exported = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });

  await page.click('#editBoardBtn');
  await settle(page, 200);
  await page.click('#buildFromManualBtn');                               // saved as it stands
  await settle(page, 300);
  got.editedBoard = await boardNow(page);
  got.editedStorage = await boardStorage(page);

  await page.click('#resetGameBtn');
  await settle(page, 200);
  got.resetBoard = await boardNow(page);
  got.resetStorage = await boardStorage(page);

  await page.setInputFiles('#importBoardFile', { name: 'from-a-file.json', mimeType: 'application/json', buffer: Buffer.from(OLD_EXPORT) });
  await settle(page, 500);
  got.importedBoard = await boardNow(page);
  got.importedStorage = await page.evaluate(() => localStorage.getItem('gvb-review-board:data:From a file'));

  /* The Daily Double: a wager by one team, right and then (again) wrong. */
  for (const verdict of ['right', 'wrong']) {
    await openWith(page, url, storageOf(DD_BOARD));
    await page.click('#boardCols .cell:not(.used):not(.blank)');
    await settle(page, 150);
    got['wagerPanel_' + verdict] = await overlayNow(page);
    await page.selectOption('#wagerTeamSelect', '1');
    await page.fill('#wagerAmount', '50');
    await page.click('#wagerStartBtn');
    await settle(page, 100);
    await page.keyboard.press('Space');
    await settle(page, 100);
    got['wagerRevealed_' + verdict] = await overlayNow(page);
    await page.keyboard.press(verdict === 'right' ? '1' : '2');
    await settle(page, 150);
    got['wagerBoard_' + verdict] = await boardNow(page);
    got['wagerStorage_' + verdict] = await boardStorage(page);
  }
  page.removeAllListeners('dialog');
  return got;
}
