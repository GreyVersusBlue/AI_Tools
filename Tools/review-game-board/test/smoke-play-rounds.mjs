// smoke-play-rounds.mjs — the Review Game Board's final wager round and
// quiz-bowl (Path 12 P3, increment 2), in the page.
//
//   node Tools/review-game-board/test/smoke-play-rounds.mjs         (port 8519)
//   node Tools/review-game-board/test/smoke-play-rounds.mjs --print
//
// What's worth holding still:
//   1. every-team-answers plays as it did: the hashes in PINS were made with
//      --print against the page as v281 left it, before either round was
//      written (_every-team-game.mjs is the game played);
//   2. both rounds are off until ticked and a board gains nothing until then;
//   3. the final wager: a wager is 0 to the team's score (to 100 at 0 or
//      below), typed hidden, refused in words when it is not one; nothing is
//      stored or scored until every team is marked; right adds the wager and
//      wrong takes it off; the result names the winner or the tie; the round
//      can be taken back; it survives a reload, Edit questions, an export and
//      an import, and a file's scores for it are worked out again;
//   4. quiz-bowl: the teacher records the buzz by click or number key; a
//      wrong answer locks the team out and costs what is set (nothing to
//      start); a right one scores the toss-up and gives that team alone a
//      bonus; questions come in the source's order, none twice; the summary
//      says the round; the last toss-up can be undone;
//   5. every text on the round overlay is text, never markup;
//   6. the overlay and the setup blocks are clean under axe, in both themes.
// The pure half is smoke-play-core.mjs. Every name and question is made up.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { sha, OLD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';
import { playEveryTeamGame } from './_every-team-game.mjs';

const PORT = 8519;
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

console.log('Review Game Board — the final wager round and quiz-bowl');

/* ── 1. every team answers, as it was ───────────────────────────────────── */
/* Made with --print against the page as v281 left it, before it was edited. */
const PINS = {"tickedBoard":"6402dd5655d717b8","tickedStorage":"e44128d97d8064c3","panel":"b1b6b8e50e7a01fc","panelMarked":"49768f36953b51de","scoredBoard":"2e9ca2dd1efe36ce","scoredStorage":"7192f9c6c2cfbb58","undoneBoard":"3c90022460c35dd7","undoneStorage":"e44128d97d8064c3","mouseBoard":"96137f7717b6bd0a","mouseStorage":"20f053c44c163333","usedNoMarksStorage":"125d06b8f5a325ce","exported":"d0d510eb24e9ca94","editedBoard":"fed436cfdb59bb07","editedStorage":"b1d0677341d3a14a","droppedBoard":"2469821f08db2d14","droppedStorage":"cf9b8478ccf30e52","offBoard":"64f3cec25f63cf05","offStorage":"ab277a5524f8e8f2","offPanel":"094491d31ce18a38","resetBoard":"49ad51618de0947f","resetStorage":"3d6580d774a79a60","importedStorage":"60342a4ef73ad265","importedBoard":"2b756a2817567fb5"};

console.log('1. every team answers plays as it did before the two rounds');
{
  const got = await playEveryTeamGame(page, URL_PAGE);
  const hashes = Object.fromEntries(Object.keys(got).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(JSON.stringify(hashes)); await browser.close(); server.close(); process.exit(0); }
  for (const k of Object.keys(PINS)) eq(hashes[k], PINS[k], `every team answers: ${k} is what the v281 page gave`);
  eq(Object.keys(got).sort(), Object.keys(PINS).sort(), 'every capture has a pin');
  ok(!/"final"|quizBowl/.test(got.resetStorage + got.editedStorage + got.importedStorage + got.exported), 'and no board, file or import of that game holds either round');
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const board = name => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-review-board:data:' + n)), name);
const scores = async name => (await board(name)).teams.map(t => t.score);
const text = id => page.evaluate(x => document.getElementById(x).textContent.replace(/\s+/g, ' ').trim(), id);
const shown = id => page.evaluate(x => { const n = document.getElementById(x); return !!n && getComputedStyle(n).display !== 'none' && !n.hidden; }, id);
const open = () => page.evaluate(() => document.getElementById('roundOverlay').classList.contains('show'));
const actions = () => page.$$eval('#roundActions button', b => b.map(x => x.textContent));
const bodyTexts = sel => page.$$eval('#roundBody ' + sel, n => n.map(x => x.textContent));
const focusId = () => page.evaluate(() => { const a = document.activeElement; return a.id || a.name || a.textContent; });
const press = async k => { await page.keyboard.press(k); await settle(page, 120); };
const click = async sel => { await page.click(sel); await settle(page, 150); };
const act = async label => { await page.click(`#roundActions button:has-text("${label}")`); await settle(page, 150); };
const X = tag => `${tag}"'><img src=x onerror="window.__pwned=(window.__pwned||0)+1">&amp;`;
const q = (id, prompt, answer, unit) => ({ id, prompt, answer, choices: [], media: null, unit: unit || '', standard: '', difficulty: '', tags: [], points: 100, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
const BANK = { v: 1, data: { schema: 1, questions: [
  q('q-a', 'Capital of Peru?', 'Lima'),
  q('q-b', 'Longest river?', 'The Nile'),
  q('q-skip', 'A question with no answer?', ''),
  q('q-c', 'Largest lake?', 'The Caspian'),
  q('q-d', 'Highest peak?', 'Everest'),
  q('q-e', X('prompt'), X('answer')),
], legacy: {} } };
const withBank = b => Object.assign(storageOf(b), { [KEY]: JSON.stringify(BANK) });
const axe = async (include, label) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); }, theme);
    await settle(page, 350);   // a team's chip fades to the theme's colour over 0.2 s
    const scan = await a11yScan(page, { include });
    eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], `${label} is clean under axe (${theme})`);
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
};
page.on('dialog', d => d.accept());

/* ── 2. off until ticked ────────────────────────────────────────────────── */
console.log('2. both rounds are off until ticked');
await openWith(page, URL_PAGE, withBank(OLD_BOARD));
eq([await page.isChecked('#finalToggle'), await page.isChecked('#quizBowlToggle')], [false, false], 'a board from before has both rounds off');
eq([await shown('finalSetup'), await shown('quizBowlSetup'), await open()], [false, false, false], 'and neither setup block nor the round overlay on the page');
eq(await board('Rivers'), OLD_BOARD, 'and its storage is the board it was');
eq([await page.getAttribute('#finalToggle', 'aria-describedby'), await page.getAttribute('#quizBowlToggle', 'aria-describedby')], ['finalRule', 'quizBowlRule'], 'each tick box is described by its rule');
eq([await page.getAttribute('#roundOverlay', 'role'), await page.getAttribute('#roundOverlay', 'aria-modal'), await page.getAttribute('#roundOverlay', 'aria-labelledby')], ['dialog', 'true', 'roundHead'], 'the round overlay is a dialog named by its heading');

/* ── 3. the final wager round ───────────────────────────────────────────── */
console.log('3. the final wager round');
await page.check('#finalToggle');
await settle(page, 150);
{
  const b = await board('Rivers');
  eq(b.final, { on: true, question: '', answer: '' }, 'ticking it is saved on the board, with no question yet');
  delete b.final;
  eq(b, OLD_BOARD, 'and is the only thing the board gains');
}
eq(await shown('finalSetup'), true, 'the setup block is shown');
ok(/from 0 up to its score, and a team at 0 or below may wager up to 100/.test(await text('finalRule')), 'the rule says what a team may wager, the 100 included');
ok(/right answer adds the wager; a wrong answer takes it off/.test(await text('finalRule')), 'and what right and wrong do');
ok(/final wager round is on/.test(await text('boardStatus')), 'the change is said in the status line');
eq([await text('finalStartBtn'), await shown('finalUndoBtn')], ['Start the final wager round', false], 'there is a start button and nothing to take back');

await click('#finalStartBtn');
eq([await open(), await text('finalStatus'), await focusId()], [false, 'Type the final question, or pick one, before the round starts.', 'finalQuestion'], 'no question, no round: it says so and focus goes to the question');

eq(await page.$$eval('#finalSource option', o => o.map(x => x.textContent)).then(l => [l[0], l.length >= 3]), ['My question bank (6 questions)', true], 'a question can be picked from the bank or a built-in set');
eq(await page.$$eval('#finalPick option', o => o.map(x => x.value)), ['q-a', 'q-b', 'q-c', 'q-d', 'q-e'], 'only a question with an answer is offered');
await page.selectOption('#finalPick', 'q-c');
await click('#finalUseBtn');
eq([(await board('Rivers')).final.question, (await board('Rivers')).final.answer], ['Largest lake?', 'The Caspian'], 'Use this question copies it onto the board');
eq(await page.evaluate(k => localStorage.getItem(k), KEY), JSON.stringify(BANK), 'and the bank is not written');
await page.fill('#finalQuestion', 'Which river crosses the equator twice?');
await page.fill('#finalAnswer', 'The Congo');
await page.dispatchEvent('#finalAnswer', 'change');
await page.dispatchEvent('#finalQuestion', 'change');
eq((await board('Rivers')).final, { on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo' }, 'a typed question is the board’s own final question');

await axe(['#boardCard'], 'the board with the final round’s setup');
const before = await boardStorage(page);
await click('#finalStartBtn');
eq([await open(), await text('roundHead'), await shown('roundQuestion'), await shown('roundAnswer')], [true, 'Final wager', false, false], 'the round opens on the wagers, the question not shown');
eq(await bodyTexts('label'), ['1. Otters (score 100): wager 0 to 100', '2. Herons (score 0): wager 0 to 100', '3. Finches (score -10): wager 0 to 100'], 'a box a team, labelled with its score and the most it may wager');
eq(await page.$$eval('#roundBody input', i => i.map(x => [x.type, x.getAttribute('aria-describedby'), x.getAttribute('autocomplete')])), [0, 1, 2].map(i => ['password', 'fwn-' + i, 'off']), 'each wager is typed hidden, and described by its note');
eq(await bodyTexts('.round-note'), ['no wager yet', 'no wager yet', 'no wager yet'], 'each note says no wager is in');
eq(await focusId(), 'fw-0', 'focus is on the first team’s wager');
ok(/stays hidden until all are in/.test((await bodyTexts('p'))[0]) && /may wager up to 100/.test((await bodyTexts('p'))[0]), 'the overlay says the rule too');

await axe(['#roundOverlay'], 'the final round’s wager stage');
await page.focus('#fw-0');
await page.fill('#fw-0', '101');
await page.fill('#fw-1', '2.5');
await settle(page, 100);
eq(await bodyTexts('.round-note'), ['the most this team may wager is 100', 'a wager is a whole number, 0 or more', 'no wager yet'], 'a wager over the bound and one that is not a whole number are refused in words');
await act('All wagers are in');
eq([await text('roundHead'), await shown('roundQuestion')], ['Final wager', false], 'the question is not shown while a wager is missing');
eq(await text('roundStatus'), 'Not every wager is in. Otters: the most this team may wager is 100; Herons: a wager is a whole number, 0 or more; Finches: no wager yet.', 'and the status line names each team and why');
eq(await focusId(), 'fw-0', 'focus goes to the first wager that is not in');
await page.fill('#fw-0', '100');
await page.fill('#fw-1', '0');
await settle(page, 100);
eq(await text('roundStatus'), '2 of 3 wagers are in.', 'the count of wagers in is said');
await page.fill('#fw-2', '40');
eq(await boardStorage(page), before, 'typing wagers stores nothing');
await page.focus('#fw-2');
await press('Enter');
eq([await text('roundHead'), await text('roundQuestion'), await shown('roundAnswer')], ['Final question', 'Which river crosses the equator twice?', false], 'with every wager in, Enter shows the question and not the answer');
eq(await bodyTexts('li'), ['Otters wagered 100', 'Herons wagered 0', 'Finches wagered 40'], 'and the wagers are shown');
eq([await actions(), await focusId()], [['Show answer'], 'Show answer'], 'Show answer has the focus');
await page.evaluate(() => document.activeElement.blur());
await press('Space');
eq([await shown('roundAnswer'), await text('roundAnswer')], [true, 'The Congo'], 'Space shows the answer');
eq(await page.$$eval('#roundBody fieldset', f => f.map(x => [x.querySelector('legend').textContent, Array.from(x.querySelectorAll('label')).map(l => l.textContent).join('/'), x.querySelectorAll('input[type=radio]:checked').length])),
  [['1. Otters, wagered 100', 'Right/Wrong', 0], ['2. Herons, wagered 0', 'Right/Wrong', 0], ['3. Finches, wagered 40', 'Right/Wrong', 0]], 'a group a team with Right and Wrong, none marked to start');
eq(await focusId(), 'fm-0', 'focus is on the first team’s mark');
await axe(['#roundOverlay'], 'the final round’s marking stage');

await press('1');
eq([await text('roundStatus'), await page.isChecked('input[name="fm-0"][value="r"]')], ['Otters: right.', true], 'key 1 marks the first team right and says so');
await press('3');
await press('3');
eq([await text('roundStatus'), await page.isChecked('input[name="fm-2"][value="w"]')], ['Finches: wrong.', true], 'a second press of a key turns right to wrong');
await press('Enter');
eq([await text('roundHead'), await text('roundStatus'), await focusId()], ['Final question', 'Mark every team right or wrong first. Not marked: Herons.', 'fm-1'], 'the round is not scored while a team is unmarked: it names the team and focus goes there');
eq(await boardStorage(page), before, 'and nothing is stored yet');
await page.check('input[name="fm-1"][value="w"]');
await act('Score the final round');
eq(await scores('Rivers'), [200, 0, -50], 'right adds the wager, wrong takes it off, and a wager of 0 changes nothing');
eq((await board('Rivers')).final, { on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo', wagers: [100, 0, 40], marks: ['r', 'w', 'w'], deltas: [100, 0, -40] }, 'the wagers, the marks and what they scored are kept on the board');
eq([await text('roundHead'), await text('roundQuestion')], ['Final scores', 'Otters win with 200 points.'], 'the result names the winner in words');
eq(await page.$$eval('#roundBody ol li', l => l.map(x => [x.value, x.textContent])), [[1, 'Otters: 200'], [2, 'Herons: 0'], [3, 'Finches: -50']], 'with the teams in order of score, each with its place');
eq(await bodyTexts('ul li'), ['Otters wagered 100 and were right: +100, now 200.', 'Herons wagered 0 and were wrong: +0, now 0.', 'Finches wagered 40 and were wrong: −40, now -50.'], 'and a line a team for its wager');
eq(await text('roundStatus'), 'The final round is scored. Otters win with 200 points.', 'the status line says it too');
await axe(['#roundOverlay'], 'the final round’s result');
await press('Escape');
eq([await open(), await focusId()], [false, 'finalStartBtn'], 'Escape closes the result and focus returns to the button that opened it');
eq([await text('finalStartBtn'), await shown('finalUndoBtn'), await text('finalStatus')], ['Show the final result', true, 'Final round scored. Otters win with 200 points.'], 'the board now offers the result and a way to take the round back');
eq(await page.$$eval('#scoreboard .score', s => s.map(x => x.textContent)), ['200', '0', '-50'], 'and the scoreboard shows the new scores');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq([await page.isChecked('#finalToggle'), await text('finalStartBtn'), await page.inputValue('#finalQuestion')], [true, 'Show the final result', 'Which river crosses the equator twice?'], 'a reload keeps the round, its question and that it was played');
await click('#finalStartBtn');
eq([await text('roundHead'), await text('roundQuestion')], ['Final scores', 'Otters win with 200 points.'], 'and the result can be shown again');
await click('#roundCloseBtn');

const exported = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
eq(JSON.parse(exported).final, { on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo', wagers: [100, 0, 40], marks: ['r', 'w', 'w'], deltas: [100, 0, -40] }, 'Export JSON carries the round');
{
  const file = JSON.parse(exported);
  file.final.deltas = [9999, 9999, 9999];
  file.final.wagers = [100, -7, 40];
  file.final.extra = X('extra');
  file.quizBowl = { on: true, tossup: 'lots', log: [{ id: 'q-a', wrong: [9], right: 0 }, { id: 'q-a', right: 1 }] };
  await page.setInputFiles('#importBoardFile', { name: 'final.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await settle(page, 500);
  const got = await board('Rivers (2)');
  eq(got.final, { on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo', wagers: [100, 0, 40], marks: ['r', 'w', 'w'], deltas: [100, 0, -40] }, 'Import JSON cleans the round: what it scored is worked out again and nothing else is kept');
  eq(got.quizBowl, { on: true, source: '', tossup: 10, bonus: 10, penalty: 0, log: [{ id: 'q-a', wrong: [], right: 0, bonusId: null, bonus: null }], over: false }, 'and cleans a quiz-bowl round the same way');
  await page.selectOption('#boardSwitch', 'Rivers');
  await settle(page, 200);
}

await click('#editBoardBtn');
await click('#buildFromManualBtn');
await settle(page, 200);
eq(((await board('Rivers')).final || {}).deltas, [100, 0, -40], 'Edit questions and Save board keep the round');

await click('#finalUndoBtn');
eq(await scores('Rivers'), [100, 0, -10], 'Take the final round back puts every score where it was');
eq((await board('Rivers')).final, { on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo' }, 'and keeps the question, not the wagers');
eq([await text('finalStartBtn'), await shown('finalUndoBtn'), await focusId()], ['Start the final wager round', false, 'finalStartBtn'], 'the round can be started again');
ok(/Took the final round back/.test(await text('finalStatus')), 'and the status line says what happened');

/* a round closed before it is scored stores nothing */
{
  const at = await boardStorage(page);
  await click('#finalStartBtn');
  for (const [i, w] of [[0, '50'], [1, '100'], [2, '100']]) await page.fill('#fw-' + i, w);
  await act('All wagers are in');
  await act('Show answer');
  await press('1');
  await press('Escape');
  eq([await open(), await boardStorage(page) === at], [false, true], 'Escape before the round is scored closes it with nothing stored and no score changed');
  ok(/closed before it was scored/.test(await text('finalStatus')), 'and says so');
}

/* a tie, and a team that leaves */
await click('#finalStartBtn');
for (const [i, w] of [[0, '0'], [1, '100'], [2, '100']]) await page.fill('#fw-' + i, w);
await act('All wagers are in');
await act('Show answer');
await page.check('input[name="fm-0"][value="r"]');
await page.check('input[name="fm-1"][value="r"]');
await page.check('input[name="fm-2"][value="w"]');
await act('Score the final round');
eq([await scores('Rivers'), await text('roundQuestion')], [[100, 100, -110], 'Otters and Herons tie for first place with 100 points each.'], 'a tie is said as a tie, by name');
eq(await page.$$eval('#roundBody ol li', l => l.map(x => x.value)), [1, 1, 3], 'and the tied teams share first place');
await click('#roundCloseBtn');
await click('#scoreboard .team-chip:nth-child(2) button.danger');
eq((await board('Rivers')).final.deltas, [0, -100], 'a team that leaves takes its wager out of the round, so taking it back still fits the teams');
await click('#finalUndoBtn');
eq(await scores('Rivers'), [100, -10], 'and the round taken back restores the two that are left');

await click('#resetGameBtn');
eq([(await board('Rivers')).final, await scores('Rivers')], [{ on: true, question: 'Which river crosses the equator twice?', answer: 'The Congo' }, [0, 0]], 'Reset game keeps the round on and its question');
await page.uncheck('#finalToggle');
await settle(page, 150);
eq([(await board('Rivers')).final.on, await shown('finalSetup'), (await board('Rivers')).final.question !== ''], [false, false, true], 'unticking hides the round and keeps its question');
await axe(['#boardCard'], 'the board with the final round unticked');

/* ── 4. quiz-bowl ───────────────────────────────────────────────────────── */
console.log('4. quiz-bowl');
await openWith(page, URL_PAGE, withBank(OLD_BOARD));
await page.check('#quizBowlToggle');
await settle(page, 150);
{
  const b = await board('Rivers');
  eq(b.quizBowl, { on: true, source: '', tossup: 10, bonus: 10, penalty: 0, log: [], over: false }, 'ticking it is saved on the board with the defaults');
  delete b.quizBowl;
  eq(b, OLD_BOARD, 'and is the only thing the board gains');
}
ok(/You record the buzz/.test(await text('quizBowlRule')) && /locks that team out of the question and costs what is set below \(nothing, unless you change it\)/.test(await text('quizBowlRule')), 'the rule says who records the buzz, the lock-out and that a wrong answer costs nothing unless set');
ok(/earns that team alone a bonus question/.test(await text('quizBowlRule')) && /none twice in a round/.test(await text('quizBowlRule')), 'and the bonus and no repeats');
eq([await page.inputValue('#qbTossup'), await page.inputValue('#qbBonus'), await page.inputValue('#qbPenalty')], ['10', '10', '0'], 'the three point values are shown');
eq(await text('quizBowlProgress'), '0 toss-ups asked. 5 questions are left in this source.', 'the block says how many questions the source has, one with no answer not counted');
eq([await text('quizBowlStartBtn'), await shown('quizBowlUndoBtn'), await shown('quizBowlNewBtn')], ['Start the round', false, false], 'a start button, and nothing to undo');
await page.fill('#qbPenalty', '5');
await page.dispatchEvent('#qbPenalty', 'change');
await page.fill('#qbBonus', '20');
await page.dispatchEvent('#qbBonus', 'change');
eq([(await board('Rivers')).quizBowl.penalty, (await board('Rivers')).quizBowl.bonus], [5, 20], 'a changed value is saved');
await axe(['#boardCard'], 'the board with the quiz-bowl setup');

const qbBefore = await boardStorage(page);
await click('#quizBowlStartBtn');
eq([await open(), await text('roundHead'), await text('roundQuestion'), await shown('roundAnswer')], [true, 'Toss-up 1 · 10 points', 'Capital of Peru?', false], 'the round opens on the first question of the source, its answer not shown');
eq(await bodyTexts('.award-row button'), ['1. Otters (100)', '2. Herons (0)', '3. Finches (-10)'], 'a button a team, numbered, with its running score');
eq([await actions(), await focusId()], [['Nobody got it: show the answer'], '1. Otters (100)'], 'focus is on the first team that may buzz');
await axe(['#roundOverlay'], 'an open toss-up');

await press('2');
eq([await text('roundStatus'), await actions(), await focusId()], ['Herons buzzed. Right or wrong?', ['Right: +10 Herons', 'Wrong: −5 Herons', 'Not Herons: back'], 'Right: +10 Herons'], 'key 2 records Herons’ buzz and asks right or wrong');
await act('Not Herons');
eq((await bodyTexts('.award-row button')).length, 3, 'a buzz recorded by mistake can be put back');
await press('2');
await press('w');
eq(await text('roundStatus'), 'Herons: wrong, locked out of this question, −5.', 'W marks the buzz wrong and says the lock-out and the cost');
eq(await page.$$eval('#roundBody .award-row button', b => b.map(x => [x.textContent, x.disabled])), [['1. Otters (100)', false], ['2. Herons (0), locked out', true], ['3. Finches (-10)', false]], 'the team is locked out of the question, in words');
eq(await boardStorage(page), qbBefore, 'nothing is stored or scored until the toss-up is decided');
await press('2');
eq([await text('roundStatus'), (await actions()).length], ['Herons are locked out of this question.', 1], 'a locked-out team’s key does nothing but say so');
await axe(['#roundOverlay'], 'a toss-up with a team locked out');
await click('#roundBody .award-row button:nth-child(3)');
eq(await text('roundStatus'), 'Finches buzzed. Right or wrong?', 'a buzz can be recorded by a click');
await press('r');
eq([await text('roundStatus'), await text('roundAnswer'), await shown('roundAnswer')], ['Finches: right, +10.', 'Lima', true], 'R marks it right, scores the toss-up and shows the answer');
eq(await scores('Rivers'), [100, -5, 0], 'the toss-up is on the winner’s score and the wrong buzz cost its team');
eq((await board('Rivers')).quizBowl.log, [{ id: 'q-a', wrong: [1], right: 2, bonusId: null, bonus: null }], 'the toss-up is in the board’s log by its id, not its words');
eq(await actions(), ['Bonus question for Finches', 'End the round'], 'the winner is offered a bonus');
await act('Bonus question for Finches');
eq([await text('roundHead'), await text('roundQuestion'), await shown('roundAnswer'), await text('roundStatus')], ['Bonus for Finches · 20 points', 'Longest river?', false, 'A bonus question for Finches alone.'], 'the bonus is the next question of the source, for that team alone');
eq((await board('Rivers')).quizBowl.log[0].bonusId, 'q-b', 'and is used from the moment it is shown');
await page.evaluate(() => document.activeElement.blur());
await press('Space');
eq([await text('roundAnswer'), await actions()], ['The Nile', ['Right: +20 Finches', 'Wrong: no points']], 'Space shows its answer and the two marks');
await press('r');
eq([await scores('Rivers'), await text('roundStatus')], [[100, -5, 20], 'Finches: bonus right, +20.'], 'a right bonus scores the bonus points');
ok((await bodyTexts('p')).includes('Scores: Otters 100 · Herons -5 · Finches 20.'), 'the running score is shown between questions');
eq(await actions(), ['Next toss-up', 'End the round'], 'then the next toss-up or the end');

await act('Next toss-up');
eq([await text('roundHead'), await text('roundQuestion')], ['Toss-up 2 · 10 points', 'Largest lake?'], 'the next toss-up skips the bonus already used and the question with no answer');
await act('Nobody got it');
eq([await text('roundStatus'), await text('roundAnswer'), await scores('Rivers')], ['No team got this toss-up.', 'The Caspian', [100, -5, 20]], 'a toss-up nobody got shows its answer and scores nothing');
await act('Next toss-up');
eq(await text('roundQuestion'), 'Highest peak?', 'toss-up 3');
for (const k of ['1', 'w', '2', 'w', '3', 'w']) await press(k);
eq([await text('roundStatus'), await text('roundAnswer'), await scores('Rivers')], ['Finches: wrong, −5. No team got this toss-up.', 'Everest', [95, -10, 15]], 'when every team is wrong the toss-up is dead, each having paid the cost');
await press('Escape');
eq([await open(), await focusId(), await text('quizBowlStartBtn')], [false, 'quizBowlStartBtn', 'Continue the round'], 'Escape closes the round, which can be continued');
eq(await text('quizBowlProgress'), '3 toss-ups asked. 1 question is left in this source. The source and the points are fixed until a new round.', 'the block says where the round stands');
eq(await page.$$eval('#quizBowlSource, #qbTossup, #qbBonus, #qbPenalty', n => n.map(x => x.disabled)), [true, true, true, true], 'and the source and the points cannot be changed mid-round');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq([(await board('Rivers')).quizBowl.log.length, await text('quizBowlStartBtn')], [3, 'Continue the round'], 'a reload keeps the round');

/* 5. markup is text */
await click('#quizBowlStartBtn');
eq([await text('roundHead'), await text('roundQuestion')], ['Toss-up 4 · 10 points', X('prompt')], 'a question that is markup is shown as text');
await page.evaluate(() => { document.querySelector('#roundBody .award-row button').focus(); });
await press('Escape');
ok(/closed during a toss-up/.test(await text('quizBowlStatus')), 'a toss-up closed undecided is said not to count');
eq((await board('Rivers')).quizBowl.log.length, 3, 'and is not in the log');
await click('#quizBowlStartBtn');
await press('1');
await press('r');
eq([await text('roundAnswer'), await actions()], [X('answer'), ['End the round']], 'the last question’s answer is text too, and with no question left there is no bonus');
ok((await bodyTexts('p')).includes('No question is left in this source for a bonus.'), 'which the overlay says');
await act('End the round');
eq([await text('roundHead'), await text('roundQuestion')], ['Quiz-bowl round', 'This round: Finches win with 25 points.'], 'the summary names the round’s winner');
eq(await bodyTexts('li'), [
  'Otters: 1 toss-up, 0 bonuses, 1 wrong buzz, 5 points this round.',
  'Herons: 0 toss-ups, 0 bonuses, 2 wrong buzzes, -10 points this round.',
  'Finches: 1 toss-up, 1 bonus, 1 wrong buzz, 25 points this round.',
], 'with a line a team: toss-ups, bonuses, wrong buzzes, points');
ok((await bodyTexts('p')).includes('4 toss-ups asked; 2 went unanswered.') && (await bodyTexts('p')).includes('Scores now: Otters 105 · Herons -10 · Finches 15.'), 'and what was asked and the scores now');
await axe(['#roundOverlay'], 'the round summary');
await click('#roundCloseBtn');
eq([(await board('Rivers')).quizBowl.over, await text('quizBowlStartBtn')], [true, 'Show the round summary'], 'an ended round is over, and its summary can be shown again');
ok(/Round over\. 4 toss-ups asked; 2 went unanswered\./.test(await text('quizBowlStatus')), 'the status line says the round is over');

{
  const file = JSON.parse(await downloadText(page, '#exportBoardBtn', { what: 'the board file' }));
  eq([file.quizBowl.log.length, file.quizBowl.over, file.quizBowl.penalty], [4, true, 5], 'Export JSON carries the round');
}
await click('#editBoardBtn');
await click('#buildFromManualBtn');
await settle(page, 200);
eq(((await board('Rivers')).quizBowl || { log: [] }).log.length, 4, 'Edit questions and Save board keep it');

await click('#quizBowlUndoBtn');
eq([await scores('Rivers'), (await board('Rivers')).quizBowl.log.length, (await board('Rivers')).quizBowl.over], [[95, -10, 15], 3, false], 'Undo the last toss-up takes its points off and reopens the round');
eq(await text('quizBowlStatus'), 'Took back toss-up 4: its points are off the scores, and it will be asked again.', 'and says so');
await click('#quizBowlUndoBtn');
await click('#quizBowlUndoBtn');
await click('#quizBowlUndoBtn');
eq([await scores('Rivers'), (await board('Rivers')).quizBowl.log, await shown('quizBowlUndoBtn')], [[100, 0, -10], [], false], 'undone to the start, every score is where it began: the bonus and each cost included');
eq(await page.$$eval('#quizBowlSource, #qbPenalty', n => n.map(x => x.disabled)), [false, false], 'and the settings can be changed again');

/* an empty source, a built-in set, a new round, a reset */
await page.evaluate(k => { const b = JSON.parse(localStorage.getItem(k)); b.data.questions = []; localStorage.setItem(k, JSON.stringify(b)); }, KEY);
await click('#quizBowlStartBtn');
eq([await open(), await text('quizBowlStatus')], [false, 'This source has no question with an answer. Choose another, or add questions on the Question Bank tab.'], 'a source with no question starts no round and says why');
{
  const setId = await page.$eval('#quizBowlSource option:nth-child(2)', o => o.value);
  await page.selectOption('#quizBowlSource', setId);
  await settle(page, 150);
  eq((await board('Rivers')).quizBowl.source, setId, 'a built-in set can be the source');
  await click('#quizBowlStartBtn');
  const first = await text('roundQuestion');
  ok(first.length > 0 && await open(), 'and its first question is the first toss-up');
  await press('1');
  await press('r');
  ok(/^seed:/.test((await board('Rivers')).quizBowl.log[0].id), 'logged by its seed id');
  await act('End the round');
  await click('#roundCloseBtn');
  await click('#quizBowlNewBtn');
  eq([(await board('Rivers')).quizBowl.log, (await board('Rivers')).quizBowl.over, await scores('Rivers')], [[], false, [110, 0, -10]], 'Start a new round empties the log and keeps the points scored');
  await click('#quizBowlStartBtn');
  eq(await text('roundQuestion'), first, 'so a question may be asked again in a new round');
  await press('3');
  await press('r');
  await press('Escape');
  await click('#scoreboard .team-chip:nth-child(1) button.danger');
  eq((await board('Rivers')).quizBowl.log.map(e => e.right), [1], 'a team that leaves moves the teams after it up a place in the log');
  await click('#resetGameBtn');
  eq([(await board('Rivers')).quizBowl.log, (await board('Rivers')).quizBowl.on, (await board('Rivers')).quizBowl.source], [[], true, setId], 'Reset game empties the round and keeps it on, with its settings');
}
eq(await page.evaluate(() => window.__pwned), undefined, 'and no markup anywhere has run');

eq(page.__errs || [], [], 'no page or console errors: ' + JSON.stringify((page.__errs || []).slice(0, 3)));
eq(page.__blocked || [], [], 'nothing asked of another site');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
