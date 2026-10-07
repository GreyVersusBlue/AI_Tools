// smoke-play-modes.mjs — the Review Game Board's first two play modes (Path
// 12 P3, increment 1): every-team-answers on a board, and the printed
// practice quiz with its answer key and the study guide, from a board or
// from the question bank.
//
//   node Tools/review-game-board/test/smoke-play-modes.mjs         (port 8515)
//   node Tools/review-game-board/test/smoke-play-modes.mjs --print
//
// What's worth holding still:
//   1. a board from before plays the one-team game as it did: the hashes in
//      PINS were made with --print against the v279 page, before the page
//      was edited (_old-game.mjs is the game played);
//   2. every-team-answers is off until ticked and adds nothing to a board
//      until then; on, every team is marked right, wrong or no answer and
//      one press scores the clue by the rule the page states; one Undo takes
//      the clue back; the marks work from the keyboard;
//   3. the mode and the marks are saved with the board, survive a reload,
//      Edit questions, an export and an import, and are cleaned on import;
//   4. the quiz has room to answer and its key starts a new page; the study
//      guide has each answer beside its question; both run over pages with
//      nothing clipped and no blank page after them, from the board and from
//      the bank tab, and printing stores nothing;
//   5. every text on the panel and the sheets is text, never markup;
//   6. the panel is clean under axe.
// The pure half is smoke-play-core.mjs. Every name and question is made up.
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { playOldGame, sha, OLD_BOARD, DD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';

const PORT = 8515;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const KEY = 'gvb-question-bank';
const PRINT = process.argv.includes('--print');

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

console.log('Review Game Board — every team answers, and the printed quiz and study guide');

/* ── 1. the one-team game, as it was ────────────────────────────────────── */
/* Made with --print against the v279 page, before it was edited. */
const PINS = {"loadStorage":"787a3cf760342cf5","loadBoard":"077ad8fc03c27dca","clueOpen":"bebaa24baf99d1f1","clueRevealed":"ff42e9468d793e94","awardedOverlay":"512d2c8cc06a89b2","awardedBoard":"45ce9f14b1ff9b4e","awardedStorage":"afed84865114d13f","undoneBoard":"b18a949b594a3a2e","undoneStorage":"787a3cf760342cf5","notAskedStorage":"787a3cf760342cf5","usedNoPointsBoard":"db8635ff006d619d","usedNoPointsStorage":"8057a0b2a4712ea0","mouseAwardBoard":"b1b65d4ce1dd6111","nudgedBoard":"b84e68dbde52c4c1","nudgedStorage":"83986ccc8e725b7b","answerKey":"728f202ea59c3e19","practiceQuiz":"5db8744d0d4f643b","exported":"56e318b76cd00500","editedBoard":"c18e460ffa81c666","editedStorage":"83986ccc8e725b7b","resetBoard":"7d7c9669306b0511","resetStorage":"0258af2e8ed76531","importedBoard":"ff80d04649624181","importedStorage":"1ba1b6844b177964","wagerPanel_right":"3ef80e2f1960bf62","wagerRevealed_right":"9a5ada2e1d9429f0","wagerBoard_right":"1fc5f953dda68c57","wagerStorage_right":"9546f1796e4313ab","wagerPanel_wrong":"3ef80e2f1960bf62","wagerRevealed_wrong":"9a5ada2e1d9429f0","wagerBoard_wrong":"94390eb5bc041f65","wagerStorage_wrong":"fc5526bf6fda8c77"};

console.log('1. a board from before plays the one-team game as it did');
{
  const got = await playOldGame(page, URL_PAGE);
  const hashes = Object.fromEntries(Object.keys(got).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(JSON.stringify(hashes)); await browser.close(); server.close(); process.exit(0); }
  for (const k of Object.keys(PINS)) eq(hashes[k], PINS[k], `the old game: ${k} is what the v279 page gave`);
  eq(Object.keys(got).sort(), Object.keys(PINS).sort(), 'every capture has a pin');
  ok(!/everyTeam|marks/.test(got.resetStorage + got.editedStorage + got.importedStorage + got.exported + got.wagerStorage_right), 'and no board, file or import of the old game holds either new field');
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const board = name => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-review-board:data:' + n)), name);
const scores = async name => (await board(name)).teams.map(t => t.score);
const marksOf = async name => (await board(name)).categories.map(c => c.clues.map(cl => (cl.marks ? cl.marks.join('') : null)));
const usedOf = async name => (await board(name)).categories.map(c => c.clues.map(cl => cl.used));
const shown = id => page.evaluate(x => getComputedStyle(document.getElementById(x)).display !== 'none', id);
const text = id => page.evaluate(x => document.getElementById(x).textContent, id);
const panelMarks = () => page.$$eval('#etaTeams fieldset', sets => sets.map(f => f.querySelector('input:checked').value).join(''));
const openCell = async () => { await page.click('#boardCols .cell:not(.used):not(.blank)'); await settle(page, 150); };
const X = tag => `${tag}"'><img src=x onerror="window.__pwned=(window.__pwned||0)+1">&amp;`;
page.on('dialog', d => d.accept());

/* ── 2. off until ticked ────────────────────────────────────────────────── */
console.log('2. every team answers: off until ticked, and then every team is marked');
await openWith(page, URL_PAGE, storageOf(OLD_BOARD));
eq(await page.isChecked('#everyTeamToggle'), false, 'a board from before has the mode off');
eq(await page.isVisible('#everyTeamRule'), false, 'and no rule on the page');
eq(await page.locator('#scoreboard .team-tally').count(), 0, 'and no count under a team');
ok(!('everyTeam' in await board('Rivers')), 'and no field for it in storage');
eq(await page.getAttribute('#everyTeamToggle', 'aria-describedby'), 'everyTeamRule', 'the tick box is described by the rule');

await page.check('#everyTeamToggle');
await settle(page, 150);
eq((await board('Rivers')).everyTeam, true, 'ticking it is saved on the board');
{
  const rest = await board('Rivers');
  delete rest.everyTeam;
  eq(rest, OLD_BOARD, 'and is the only thing the board gains');
}
eq(await page.isVisible('#everyTeamRule'), true, 'the rule is shown');
ok(/right answer scores the clue’s points/.test(await text('everyTeamRule')) && /wrong\s+answer or no answer scores nothing/.test(await text('everyTeamRule')), 'and says what right, wrong and no answer score');
ok(/Daily Double is still one team’s wager/.test(await text('everyTeamRule')), 'and that a Daily Double is still a wager');
eq(await page.$$eval('#scoreboard .team-tally', n => n.map(x => x.textContent)), Array(3).fill('0 right · 0 wrong · 0 no answer'), 'each team shows its count');
ok(/Every team answers each clue from now on/.test(await text('boardStatus')), 'the change is said in the status line');
eq(await marksOf('Rivers'), [[null, null, null], [null, null]], 'no clue has marks yet, the one already played included');

await openCell();                                                          // Deltas 100
eq([await shown('etaPanel'), await shown('awardRow')], [false, false], 'an open clue shows neither the marks nor the award buttons before the answer');
await page.keyboard.press('Space');
await settle(page, 150);
eq([await shown('etaPanel'), await shown('awardRow'), await shown('overlayAnswer'), await shown('closeUsedRow')], [true, false, true, true], 'Space shows the answer and the marks, not one team’s buttons');
eq(await page.locator('#awardRow button').count(), 0, 'no award button is made');
eq(await page.$$eval('#etaTeams fieldset', sets => sets.map(f => [f.querySelector('legend').textContent, Array.from(f.querySelectorAll('label')).map(l => l.textContent).join('/')])),
  [['1. Otters', 'Right/Wrong/No answer'], ['2. Herons', 'Right/Wrong/No answer'], ['3. Finches', 'Right/Wrong/No answer']], 'a group a team, named and numbered, with the three marks');
eq(await page.$$eval('#etaTeams fieldset', sets => sets.map(f => Array.from(f.querySelectorAll('input')).map(i => [i.type, i.name]).join('|'))),
  [0, 1, 2].map(i => Array(3).fill('radio,eta-team-' + i).join('|')), 'three radio buttons a team, one group each');
eq(await panelMarks(), 'nnn', 'every team starts at no answer');
eq(await text('etaRule'), 'Mark every team, then score the clue. Right scores 100; wrong and no answer score nothing.', 'the panel says the rule with this clue’s points');
eq(await page.evaluate(() => [document.activeElement.name, document.activeElement.value]), ['eta-team-0', 'n'], 'focus is on the first team’s mark');
eq(await page.getAttribute('#etaStatus', 'role'), 'status', 'the panel has a status line');

await page.keyboard.press('1');
eq([await panelMarks(), await text('etaStatus')], ['rnn', 'Otters: right.'], 'the 1 key marks team 1 right, and says so');
eq(await page.evaluate(() => [document.activeElement.name, document.activeElement.value]), ['eta-team-0', 'r'], 'and focus follows the mark');
await page.keyboard.press('3');
await page.keyboard.press('3');
eq([await panelMarks(), await text('etaStatus')], ['rnw', 'Finches: wrong.'], 'a second press moves a team to wrong');
await page.keyboard.press('3');
await page.keyboard.press('3');
await page.keyboard.press('3');
eq(await panelMarks(), 'rnw', 'and three more bring it round to wrong again (no answer, right, wrong)');
await page.keyboard.press('7');
eq(await panelMarks(), 'rnw', 'a number with no team changes nothing');
eq(await scores('Rivers'), [100, 0, -10], 'nothing is scored while the marks are being made');
await page.keyboard.press('ArrowLeft');                                    // a radio group's own key: wrong back to right
eq(await panelMarks(), 'rnr', 'the arrow keys move a mark as a radio group’s do');
await page.keyboard.press('ArrowRight');
eq(await panelMarks(), 'rnw', 'and back');
await page.keyboard.press('Enter');
await settle(page, 200);
eq(await scores('Rivers'), [200, 0, -10], 'Enter scores the clue: the right team gains its points, a wrong team and a silent team nothing');
eq(await marksOf('Rivers'), [[null, null, null], ['rnw', null]], 'the marks are kept on the clue');
eq((await usedOf('Rivers'))[1], [true, false], 'the clue is used');
eq(await shown('overlay'), false, 'and closed');
eq(await text('boardStatus'), 'Deltas 100. Right, +100: Otters. Wrong: Finches. No answer: Herons.', 'what was scored is said in the status line');
eq(await page.$$eval('#scoreboard .team-tally', n => n.map(x => x.textContent)), ['1 right · 0 wrong · 0 no answer', '0 right · 0 wrong · 1 no answer', '0 right · 1 wrong · 0 no answer'], 'each team’s count moves');
eq(await page.$eval('#undoScoreBtn', b => [b.textContent, b.disabled]), ['Undo: Deltas 100 (every team)', false], 'Undo names the clue');
eq(await page.evaluate(() => document.activeElement.className), 'cell', 'focus is on the next clue');

const afterFirst = await boardStorage(page);
await openCell();                                                          // Rivers 200
await page.click('#showAnswerBtn');
await settle(page, 150);
eq(await text('etaRule'), 'Mark every team, then score the clue. Right scores 200; wrong and no answer score nothing.', 'the next clue’s panel has its own points');
eq(await panelMarks(), 'nnn', 'and starts every team at no answer again');
await page.check('input[name="eta-team-0"][value="r"]');
await page.check('input[name="eta-team-1"][value="r"]');
await page.check('input[name="eta-team-2"][value="r"]');
await page.click('#etaScoreBtn');
await settle(page, 200);
eq(await scores('Rivers'), [400, 200, 190], 'marked with the mouse: every team right, every team scores');
eq((await marksOf('Rivers'))[0][1], 'rrr', 'and the marks are kept');

await page.click('#undoScoreBtn');
await settle(page, 200);
eq(await boardStorage(page), afterFirst, 'one Undo takes the whole clue back: scores, used and marks, as storage was');
ok(/Took back Rivers 200/.test(await text('boardStatus')), 'and says so');
eq(await page.$eval('#undoScoreBtn', b => b.textContent), 'Undo: Deltas 100 (every team)', 'the clue before it is next');
await page.click('#undoScoreBtn');
await settle(page, 200);
eq(await scores('Rivers'), [100, 0, -10], 'a second Undo takes the first clue back');
eq(await marksOf('Rivers'), [[null, null, null], [null, null]], 'and its marks');
ok(!JSON.stringify(await board('Rivers')).includes('"marks"'), 'no clue is left with a marks field');
eq(await page.$eval('#undoScoreBtn', b => b.disabled), true, 'and there is nothing more to undo');

await openCell();
await page.keyboard.press('Space');
await settle(page, 100);
await page.keyboard.press('2');
await page.keyboard.press('Escape');
await settle(page, 150);
eq([await scores('Rivers'), (await usedOf('Rivers'))[1], await marksOf('Rivers')], [[100, 0, -10], [true, false], [[null, null, null], [null, null]]], 'Escape with the marks showing uses the clue and scores nothing, whatever was marked');
await openCell();
eq(await shown('etaPanel'), false, 'the next clue opens without the marks of the last');
await page.keyboard.press('Escape');
await settle(page, 100);

/* Enter on a button is the button's own press, not a second one. */
await openCell();                                                          // Rivers 200
await page.keyboard.press('Space');
await settle(page, 100);
await page.keyboard.press('2');
await page.focus('#etaScoreBtn');
await page.keyboard.press('Enter');
await settle(page, 200);
eq(await scores('Rivers'), [100, 200, -10], 'Enter on Score this clue scores it once');

/* ── a team that leaves, and one that joins ─────────────────────────────── */
await page.click('#scoreboard .team-chip:nth-child(1) button.danger');     // Otters go
await settle(page, 150);
eq(await marksOf('Rivers'), [[null, 'rn', null], [null, null]], 'a team removed takes its mark off the scored clue, so the marks still line up');
eq(await page.$$eval('#scoreboard .team-tally', n => n.map(x => x.textContent)), ['1 right · 0 wrong · 0 no answer', '0 right · 0 wrong · 1 no answer'], 'and the counts are the two teams’');
await page.click('#scoreboard > button');                                  // + Add team
await settle(page, 150);
eq((await page.$$eval('#scoreboard .team-tally', n => n.map(x => x.textContent)))[2], '0 right · 0 wrong · 1 no answer', 'a team that joins gave no answer to the clue already scored');

/* ── 3. saved with the board ────────────────────────────────────────────── */
console.log('3. the mode and the marks are saved with the board');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
eq([await page.isChecked('#everyTeamToggle'), await page.isVisible('#everyTeamRule'), await marksOf('Rivers')], [true, true, [[null, 'rn', null], [null, null]]], 'after a reload the mode is on and the marks are there');

await page.click('#editBoardBtn');
await settle(page, 200);
await page.click('#buildFromManualBtn');
await settle(page, 300);
eq([(await board('Rivers')).everyTeam, await marksOf('Rivers'), await page.isChecked('#everyTeamToggle')], [true, [[null, 'rn', null], [null, null]], true], 'Edit questions and Save board keep the mode and the marks');

const exported = JSON.parse(await downloadText(page, '#exportBoardBtn', { what: 'the board file' }));
eq([exported.everyTeam, exported.categories[0].clues[1].marks], [true, ['r', 'n']], 'Export JSON carries both');

await page.uncheck('#everyTeamToggle');
await settle(page, 150);
eq([(await board('Rivers')).everyTeam, await marksOf('Rivers')], [false, [[null, 'rn', null], [null, null]]], 'turned off, the board says so and keeps the marks already made');
eq([await page.isVisible('#everyTeamRule'), await page.locator('#scoreboard .team-tally').count()], [false, 0], 'the rule and the counts leave the page');
await openCell();
await page.keyboard.press('Space');
await settle(page, 100);
eq([await shown('etaPanel'), await shown('awardRow'), await page.$$eval('#awardRow button', b => b.map(x => x.textContent))], [false, true, ['+200 Herons', '+200 Finches', '+200 Team 3']], 'and a clue is one team’s again, with the buttons it always had');
await page.keyboard.press('1');
await settle(page, 150);
eq(await scores('Rivers'), [400, -10, 0], 'the number key awards one team, as before');
await page.check('#everyTeamToggle');
await settle(page, 100);

await page.click('#resetGameBtn');
await settle(page, 200);
eq([(await board('Rivers')).everyTeam, await marksOf('Rivers'), await scores('Rivers')], [true, [[null, null, null], [null, null]], [0, 0, 0]], 'Reset game clears the marks with the scores and keeps the mode');

/* An import: the file made above, and one that was edited by hand. */
const importFile = async (name, obj) => {
  await page.setInputFiles('#importBoardFile', { name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
  await settle(page, 500);
};
await importFile('carried', Object.assign({}, exported, { name: 'Carried' }));
eq([(await board('Carried')).everyTeam, await marksOf('Carried'), await page.isChecked('#everyTeamToggle')], [true, [[null, 'rnn', null], [null, null]], true], 'a file exported with the mode on opens with it on and its marks, a mark a team (the team that joined later gave no answer)');
const crafted = JSON.parse(JSON.stringify(OLD_BOARD));
crafted.name = 'Crafted';
crafted.everyTeam = 'yes';
crafted.categories[0].clues[0].marks = ['r', '<img src=x onerror=window.__pwned=5>', 'w', 'r', 'r'];     // used: cleaned to the three teams
crafted.categories[0].clues[1].marks = ['r', 'r', 'r'];                                                  // not used: dropped
crafted.categories[1].clues[0].marks = 'rrr';                                                            // not a list
crafted.categories[1].clues[0].used = true;
await importFile('crafted', crafted);
ok(!('everyTeam' in await board('Crafted')), 'a file whose everyTeam is not true or false opens with the mode off and no field');
eq(await marksOf('Crafted'), [['rnw', null, null], [null, null]], 'marks from a file are cleaned: three teams, three marks of the three kinds; none on an unused clue; a text is not marks');
eq(await page.isChecked('#everyTeamToggle'), false, 'and the tick box is off');

/* ── the Daily Double is still a wager ──────────────────────────────────── */
await openWith(page, URL_PAGE, storageOf(Object.assign({}, DD_BOARD, { everyTeam: true })));
await openCell();
eq(await shown('wagerPanel'), true, 'with the mode on a Daily Double still asks for one team’s wager');
await page.selectOption('#wagerTeamSelect', '1');
await page.fill('#wagerAmount', '50');
await page.click('#wagerStartBtn');
await page.keyboard.press('Space');
await settle(page, 150);
eq([await shown('etaPanel'), await page.$$eval('#awardRow button', b => b.map(x => x.textContent))], [false, ['Correct: +50 Herons', 'Incorrect: −50 Herons']], 'and is answered right or wrong by that team, not marked for every team');
await page.keyboard.press('2');
await settle(page, 150);
eq([await scores('Wager'), await marksOf('Wager')], [[300, 100], [[null, null]]], 'the wager is lost as before, and the clue has no marks');

/* ── 5a. markup in a team's name ────────────────────────────────────────── */
{
  const hostile = JSON.parse(JSON.stringify(OLD_BOARD));
  hostile.everyTeam = true;
  hostile.teams[0].name = X('team');
  hostile.categories[1].name = X('cat');
  hostile.categories[1].clues[0].question = X('q');
  hostile.categories[1].clues[0].answer = X('a');
  hostile.name = 'Rivers';
  await openWith(page, URL_PAGE, storageOf(hostile));
  await openCell();
  await page.keyboard.press('Space');
  await settle(page, 150);
  eq(await page.$eval('#etaTeams legend', l => l.textContent), '1. ' + X('team'), 'a team name that is markup is text in the panel');
  eq(await page.locator('#etaPanel img, #etaPanel a').count(), 0, 'and makes no element there');
  await page.keyboard.press('1');
  eq(await text('etaStatus'), X('team') + ': right.', 'nor in the panel’s status line');
  await page.keyboard.press('Enter');
  await settle(page, 200);
  eq(await text('boardStatus'), X('cat') + ' 100. Right, +100: ' + X('team') + '. No answer: Herons and Finches.', 'nor in the board’s');
  eq(await page.$eval('#undoScoreBtn', b => b.textContent), 'Undo: ' + X('cat') + ' 100 (every team)', 'nor on the Undo button');
  eq(await page.locator('#boardStatus *, #undoScoreBtn *').count(), 0, 'no element is made in either');

  /* ── 6. axe, with the panel open ──────────────────────────────────────── */
  await openCell();
  await page.keyboard.press('Space');
  await settle(page, 200);
  const scan = await a11yScan(page, { include: ['#overlay'] });
  eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the open clue with its marking panel is clean under axe');
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  const dark = await a11yScan(page, { include: ['#overlay'] });
  eq(dark.map(v => v.id + ' ' + v.nodes.join(',')), [], 'and in the dark theme');
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });
  await page.keyboard.press('Escape');
  await settle(page, 150);
  const boardScan = await a11yScan(page, { include: ['#boardCard', '#toolbar'] });
  eq(boardScan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the board with the mode on, its rule and its counts are clean under axe');

  /* ── 5b. markup on the sheets ─────────────────────────────────────────── */
  await page.click('#printQuizKeyBtn');
  await settle(page, 200);
  ok((await text('printArea')).includes(X('q')) && (await text('printArea')).includes(X('a')) && (await text('printArea')).includes(X('cat')), 'a question, an answer and a category that are markup are text on the quiz and its key');
  eq(await page.locator('#printArea img, #printArea a, #printArea script').count(), 0, 'and make no element on the sheet');
  await page.click('#printGuideBtn');
  await settle(page, 200);
  ok((await text('printArea')).includes(X('q')) && (await text('printArea')).includes(X('a')), 'nor on the study guide');
  eq(await page.locator('#printArea img, #printArea a, #printArea script').count(), 0, 'which makes none either');
  eq(await page.evaluate(() => window.__pwned), undefined, 'and nothing a name, a question or a mark carried has run');
}

/* ── 4. the printed sheets ──────────────────────────────────────────────── */
console.log('4. the practice quiz with its key, and the study guide');
/* The pages of Chromium's PDF as text. pdftotext is in CI (poppler-utils). */
function pdfText(buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rgb-play-'));
  try {
    fs.writeFileSync(path.join(dir, 's.pdf'), buf);
    const run = spawnSync('pdftotext', ['-layout', path.join(dir, 's.pdf'), '-'], { encoding: 'utf8' });
    if (run.error || run.status !== 0) return null;
    const pages = run.stdout.split('\f');
    if (pages.length && pages[pages.length - 1].trim() === '') pages.pop();      // the form feed after the last page
    return pages;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function pdfPages(buf) {
  const s = buf.toString('latin1'), re = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m, pages = 0;
  while ((m = re.exec(s))) if (/\/Type\s*\/Page[^s]/.test(m[2])) pages++;
  return pages;
}
const clipped = () => page.evaluate(() => [...document.querySelectorAll('#printArea *')].filter(e => (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) && getComputedStyle(e).overflow !== 'visible').length);
const printedPdf = async () => {
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ format: 'Letter', preferCSSPageSize: true });
  const n = await clipped();
  await page.emulateMedia({ media: 'screen' });
  return { buf, clipped: n };
};

await openWith(page, URL_PAGE, storageOf(OLD_BOARD));
const stored = await boardStorage(page);
eq(await page.$$eval('#toolbar button', b => b.map(x => x.textContent)).then(t => t.filter(x => /^Print/.test(x))), ['Print answer key', 'Print practice quiz', 'Print quiz with answer key', 'Print study guide'], 'the toolbar has the two sheets it had and the two new ones');
await page.click('#printQuizKeyBtn');
await settle(page, 250);
eq(await page.evaluate(() => [window.__printed, document.body.classList.contains('printing-sheet')]), [1, true], 'Print quiz with answer key calls print() once, with the sheet asked for');
eq(await page.$$eval('#printArea > section', s => s.map(x => x.className)), ['pq-sheet pq-quiz', 'pq-sheet pq-key'], 'the sheet is the quiz and then its key');
eq(await page.$$eval('#printArea .pq-quiz > h2, #printArea .pq-key > h2', h => h.map(x => x.textContent)), ['Rivers — Practice Quiz', 'Rivers — Answer Key'], 'each under the board’s name');
eq(await page.$$eval('#printArea .pq-quiz .pq-group', h => h.map(x => x.textContent)), ['Rivers', 'Deltas'], 'the questions are grouped by category');
eq(await page.$$eval('#printArea .pq-quiz .pq-q', h => h.map(x => x.textContent)), ['1. Longest river?', '2. Widest river?', '3. A <b>bold</b> & "quoted" river?', '4. Which delta?', '5. Why deltas form'], 'every clue is on it, the one already played too, numbered through');
eq(await page.$$eval('#printArea .pq-quiz .pq-item', h => h.map(x => x.querySelectorAll('.pq-line').length)), [2, 2, 2, 2, 2], 'with two lines to answer on');
ok(!/The Nile|The Amazon|The Mekong|Silt settles/.test(await page.$eval('#printArea .pq-quiz', s => s.textContent)), 'and no answer');
eq(await page.$$eval('#printArea .pq-key .pq-key-row', h => h.map(x => x.textContent)), ['1. The Nile', '2. The Amazon', '3. <i>None</i>', '4. The Mekong', '5. Silt settles'], 'the key has each answer under the quiz’s number');
eq(await page.$eval('#printArea .pq-key', s => getComputedStyle(s).breakBefore), 'page', 'and starts a new page');
eq(await text('boardStatus'), 'Built a practice quiz of 5 questions, with the answer key on a page of its own.', 'what was built is said');
{
  await page.emulateMedia({ media: 'print' });
  eq(await page.evaluate(() => [...document.body.children].filter(e => e.id !== 'printArea' && getComputedStyle(e).display !== 'none').map(e => e.tagName + '.' + e.className)), [], 'in print, everything but the sheet is out of the flow');
  eq(await page.evaluate(() => { const c = getComputedStyle(document.getElementById('printArea')); return [c.display, c.position, c.color, c.backgroundColor]; }), ['block', 'static', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)'], 'and the sheet is in it, black on white');
  eq(await page.$$eval('#printArea .pq-line', l => [...new Set(l.map(x => Math.round(x.getBoundingClientRect().height) >= 20))]), [true], 'a line to write on has its height');
  await page.emulateMedia({ media: 'screen' });
  const { buf, clipped: n } = await printedPdf();
  eq(pdfPages(buf), 2, 'a five-question quiz and its key are two pages');
  eq(n, 0, 'with nothing clipped');
  const pages = pdfText(buf);
  if (!pages) console.log('  SKIP the PDF’s text (pdftotext is not on this machine)');
  else {
    ok(/Practice Quiz/.test(pages[0]) && /5\. Why deltas form/.test(pages[0]) && !/Answer Key/.test(pages[0]), 'page 1 is the quiz, whole, with no key on it');
    ok(/Answer Key/.test(pages[1]) && /5\. Silt settles/.test(pages[1]) && !/Practice Quiz/.test(pages[1]), 'page 2 is the key');
  }
}

await page.click('#printGuideBtn');
await settle(page, 250);
eq(await page.evaluate(() => [window.__printed, document.body.classList.contains('printing-sheet')]), [2, true], 'Print study guide calls print() once');
eq(await page.$$eval('#printArea > section', s => s.map(x => x.className)), ['pq-sheet pq-guide'], 'the guide is one section, with no key after it');
eq(await page.$$eval('#printArea h2, #printArea h3', h => h.map(x => x.textContent)), ['Rivers — Study Guide', 'Rivers', 'Deltas'], 'under the board’s name, a heading a category');
eq(await page.$$eval('#printArea tbody tr', r => r.map(x => [...x.children].map(c => c.textContent))), [['1. Longest river?', 'The Nile'], ['2. Widest river?', 'The Amazon'], ['3. A <b>bold</b> & "quoted" river?', '<i>None</i>'], ['4. Which delta?', 'The Mekong'], ['5. Why deltas form', 'Silt settles']], 'a row a question, its answer beside it');
ok(await page.$$eval('#printArea tbody tr', r => r.every(x => { const [q, a] = [...x.children].map(c => c.getBoundingClientRect()); return a.left >= q.right - 1 && Math.abs(a.top - q.top) < 2; })), 'beside it on the page, not under it');
eq(await text('boardStatus'), 'Built a study guide of 5 questions, each with its answer beside it.', 'what was built is said');
{
  const { buf, clipped: n } = await printedPdf();
  eq([pdfPages(buf), n], [1, 0], 'a five-question study guide is one page, nothing clipped');
}
eq(await boardStorage(page), stored, 'printing either stores nothing');

/* The two older sheets print as they did, straight after a new one. */
await page.click('#printQuizBtn');
await settle(page, 200);
eq(await page.evaluate(() => [document.body.classList.contains('printing-sheet'), document.querySelectorAll('#printArea .quiz-item').length, document.querySelectorAll('#printArea .pq-sheet').length]), [false, 5, 0], 'Print practice quiz after a new sheet prints the old quiz the old way');
await page.click('#printGuideBtn');
await page.click('#printAnswerKeyBtn');
await settle(page, 200);
eq(await page.evaluate(() => [document.body.classList.contains('printing-sheet'), document.querySelectorAll('#printArea .key-table').length]), [false, 1], 'and so does Print answer key');

/* A board long enough to run over pages: 4 categories of 15. */
{
  const long = { name: 'Long board', categories: ['Rivers', 'Deltas', 'Lakes', 'Seas'].map((c, ci) => ({ name: c, clues: Array.from({ length: 15 }, (_, i) => ({ points: (i + 1) * 100, question: `${c} question ${i + 1}: ` + 'which of these is the one the class read about last week? '.repeat(1 + (i % 3)), answer: `${c} answer ${i + 1}`, used: false, dailyDouble: false })) })),
    teams: [{ name: 'Otters', score: 0 }, { name: 'Herons', score: 0 }], dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15 };
  await openWith(page, URL_PAGE, storageOf(long));
  await page.click('#printQuizKeyBtn');
  await settle(page, 250);
  const quiz = await printedPdf();
  const n = pdfPages(quiz.buf);
  ok(n >= 5, 'sixty questions and their key run over several pages (' + n + ')');
  eq(quiz.clipped, 0, 'nothing clipped');
  const pages = pdfText(quiz.buf);
  if (pages) {
    eq(pages.length, n, 'every page of the PDF has text: no blank page in it or after it');
    ok(pages.every(p => p.trim().length > 20), 'and none is all but empty');
    const keyAt = pages.findIndex(p => /Answer Key/.test(p));
    ok(keyAt > 0 && /^\s*Long board . Answer Key/.test(pages[keyAt]), 'the key starts at the top of a page of its own (page ' + (keyAt + 1) + ')');
    ok(!pages.slice(0, keyAt).some(p => /Seas answer 15|Rivers answer 1\b/.test(p)), 'no answer is on a quiz page');
    ok(/60\. Seas question 15/.test(pages[keyAt - 1]) && /60\. Seas answer 15/.test(pages[pages.length - 1]), 'the last question ends the quiz and the last answer ends the key');
  }
  await page.click('#printGuideBtn');
  await settle(page, 250);
  const guide = await printedPdf();
  const g = pdfPages(guide.buf);
  ok(g >= 2, 'the study guide of sixty runs over pages too (' + g + ')');
  eq(guide.clipped, 0, 'nothing clipped');
  const gp = pdfText(guide.buf);
  if (gp) {
    eq(gp.length, g, 'and has no blank page');
    ok(/Seas question 15/.test(gp[gp.length - 1]) && /Seas answer 15/.test(gp[gp.length - 1]), 'its last page ends with the last question and its answer');
  }
}

/* ── from the question bank ─────────────────────────────────────────────── */
console.log('   from the Question Bank tab');
const q = (id, prompt, answer, unit, extra) => Object.assign({ id, prompt, answer, unit, standard: '', difficulty: '', tags: [], points: 100, createdAt: '2026-10-07T10:00:00.000Z' }, extra || {});
const BANK = { v: 1, data: { schema: 1, questions: [
  q('q-a', 'Capital of Peru?', 'Lima', 'Unit 2', { choices: ['Quito', 'Lima', 'Bogotá'] }),
  q('q-b', 'Longest river?', 'The Nile', 'Unit 1'),
  q('q-c', 'Agent number?', '007', ''),
  q('q-d', 'Largest lake?', 'The Caspian', 'Unit 2'),
  q('q-e', X('prompt'), X('answer'), 'Unit 1', { choices: [X('choice'), X('answer')] }),
], legacy: {} } };
await openWith(page, URL_PAGE, Object.assign(storageOf(OLD_BOARD), { [KEY]: JSON.stringify(BANK) }));
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 250);
const bankBefore = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
eq(await page.$$eval('#bankPrintQuizBtn, #bankPrintGuideBtn', b => b.map(x => [x.textContent, x.getAttribute('aria-describedby')])), [['Practice quiz with answer key', 'bankPrintHint'], ['Study guide', 'bankPrintHint']], 'the bank tab has the two print buttons, each described by the hint');
ok(/ticked questions, or every question the list shows when none is\s+ticked, grouped by unit/.test(await text('bankPrintHint')), 'and the hint says what is printed');
await page.click('#bankPrintQuizBtn');
await settle(page, 250);
eq(await page.evaluate(() => [window.__printed, document.body.classList.contains('printing-sheet')]), [1, true], 'the quiz button calls print() once');
eq(await page.$$eval('#printArea h2, #printArea .pq-quiz h3', h => h.map(x => x.textContent)), ['My question bank — Practice Quiz', 'Unit 2', 'Unit 1', 'My question bank — Answer Key'], 'with nothing ticked, the whole list: named for the source, grouped by unit in the order units first appear');
eq(await page.$$eval('#printArea .pq-quiz .pq-item', i => i.map(x => x.querySelector('.pq-q').textContent)), ['1. Capital of Peru?', '2. Largest lake?', '3. Longest river?', '4. ' + X('prompt'), '5. Agent number?'], 'a unit’s questions together, the ones with no unit last here, numbered through');
eq(await page.$eval('#printArea .pq-quiz .pq-item', i => [i.querySelector('ol').getAttribute('type'), [...i.querySelectorAll('li')].map(l => l.textContent), i.querySelectorAll('.pq-line').length]), ['A', ['Quito', 'Lima', 'Bogotá'], 1], 'a question’s choices are a lettered list, with one line for the answer');
eq(await page.$$eval('#printArea .pq-key .pq-key-row', r => r.map(x => x.textContent)), ['1. B. Lima', '2. The Caspian', '3. The Nile', '4. B. ' + X('answer'), '5. 007'], 'the key gives a choice’s letter with it');
eq(await page.locator('#printArea img, #printArea a').count(), 0, 'a question, an answer and a choice that are markup make no element');
eq(await text('bankPrintStatus'), 'Built a practice quiz of 5 questions, with the answer key on a page of its own.', 'the status line says what was built');
{
  /* From the bank tab the page is tall: the sheet must still end the print. */
  const { buf, clipped: n } = await printedPdf();
  eq([pdfPages(buf), n], [2, 0], 'printed from the bank tab it is the quiz and the key, two pages, nothing clipped and no blank page after');
}

await page.selectOption('#bankFilterUnit', 'Unit 2');
await settle(page, 200);
await page.click('#bankPrintGuideBtn');
await settle(page, 250);
eq(await page.$$eval('#printArea h2, #printArea h3', h => h.map(x => x.textContent)), ['Unit 2 — Study Guide', 'Unit 2'], 'with a unit chosen, the sheet is that unit’s and is named for it');
eq(await page.$$eval('#printArea tbody tr', r => r.map(x => [...x.children].map(c => c.textContent))), [['1. Capital of Peru?QuitoLimaBogotá', 'B. Lima'], ['2. Largest lake?', 'The Caspian']], 'the guide has each answer beside its question, with the letter of a choice');
await page.click('#bankClearFiltersBtn');
await settle(page, 200);
await page.check('#bankList .bank-entry:nth-child(2) input[type="checkbox"]');
await page.check('#bankList .bank-entry:nth-child(3) input[type="checkbox"]');
await page.click('#bankPrintQuizBtn');
await settle(page, 250);
eq(await page.$$eval('#printArea .pq-quiz .pq-q', h => h.map(x => x.textContent)), ['1. Longest river?', '2. Agent number?'], 'with questions ticked, only those');
eq(await text('bankPrintStatus'), 'Built a practice quiz of 2 questions, with the answer key on a page of its own.', 'and the count is theirs');
await page.selectOption('#bankFilterUnit', 'Unit 2');                    // the ticked two are not in this list
await settle(page, 200);
await page.click('#bankPrintQuizBtn');
await settle(page, 250);
eq(await page.$$eval('#printArea .pq-quiz .pq-q', h => h.map(x => x.textContent)), ['1. Capital of Peru?', '2. Largest lake?'], 'a tick on a question the list no longer shows does not print it');
await page.click('#bankClearFiltersBtn');

await page.selectOption('#bankSource', '053');
await settle(page, 250);
await page.click('#bankPrintGuideBtn');
await settle(page, 250);
eq(await page.$eval('#printArea h2', h => h.textContent), 'Cultural Trivia — Study Guide', 'a built-in set prints under its own name');
eq(await page.$$eval('#printArea tbody tr', r => r.length), 30, 'all thirty of its questions');
ok((await page.$$eval('#printArea h3', h => h.length)) >= 2, 'grouped by its categories');
{
  const { buf, clipped: n } = await printedPdf();
  const pages = pdfText(buf);
  eq(n, 0, 'nothing clipped');
  if (pages) eq(pages.length, pdfPages(buf), 'and no blank page');
}
await page.fill('#bankFilterQuery', 'no question says this zzzz');
await settle(page, 200);
const printedSoFar = await page.evaluate(() => window.__printed);
await page.click('#bankPrintQuizBtn');
await settle(page, 200);
eq([await text('bankPrintStatus'), await page.evaluate(() => window.__printed) - printedSoFar], ['There is no question to print: the list is empty.', 0], 'an empty list prints nothing and says so');
eq(await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))), bankBefore, 'printing from the bank, a built-in set included, stores nothing');
eq(await page.evaluate(() => window.__pwned), undefined, 'and nothing on a sheet has run');

eq(page.__errs || [], [], 'no page or console errors: ' + JSON.stringify((page.__errs || []).slice(0, 3)));
eq(page.__blocked || [], [], 'nothing asked of another site');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
