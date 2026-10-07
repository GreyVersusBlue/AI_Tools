// smoke-play-core.mjs — the pure half of the Review Game Board's play modes
// and printed sheets (Tools/review-game-board/rgb-play.js, Path 12 P3):
// what every-team-answers scores and keeps, and what the practice quiz, its
// answer key and the study guide hold, in what order. Pure Node: no browser,
// no port. The sheet is built against a document of plain objects, so that a
// text reaching it any way but textContent would show here.
//
//   node Tools/review-game-board/test/smoke-play-core.mjs
//
// The page itself is smoke-play-modes.mjs. Every name and question is made
// up. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const src = f => fs.readFileSync(path.join(site, f), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const window = {};
vm.runInContext(src('Tools/review-game-board/rgb-play.js'), vm.createContext({ window }));
const P = window.ReviewBoardPlay;

console.log('Review Game Board — play modes and printed sheets, pure half');

/* ── every team answers: the marks ──────────────────────────────────────── */
eq(P.MARKS, ['r', 'w', 'n'], 'the three marks, in the order the panel shows them');
eq(P.cleanMarks(['r', 'w', 'n'], 3), ['r', 'w', 'n'], 'a list of marks is kept');
eq(P.cleanMarks(['r'], 3), ['r', 'n', 'n'], 'a short list is filled with no answer');
eq(P.cleanMarks(['r', 'w', 'r', 'r'], 2), ['r', 'w'], 'a long list is cut to the teams');
eq(P.cleanMarks(['R', 'x', null, 7, { r: 1 }], 5), ['n', 'n', 'n', 'n', 'n'], 'anything that is not r or w is no answer');
eq(P.cleanMarks(undefined, 3), null, 'a clue with no marks has none');
eq(P.cleanMarks('rwn', 3), null, 'a text is not a list of marks');
eq(P.cleanMarks({ 0: 'r', length: 1 }, 1), null, 'nor is an object shaped like one');
eq(P.cleanMarks(['r'], 0), [], 'no teams, no marks');
eq(P.cleanMarks(['r'], -4), [], 'nor for a count below zero');

/* ── the rule ───────────────────────────────────────────────────────────── */
eq(P.score(200, ['r', 'w', 'n', 'r']), [200, 0, 0, 200], 'right scores the points; wrong and no answer score nothing');
eq(P.score(200, ['w', 'w']), [0, 0], 'a wrong answer takes nothing off');
eq(P.score('300', ['r']), [300], 'points held as text are a number');
eq(P.score('lots', ['r']), [0], 'points that are not a number are nothing');
eq(P.score(-50, ['r', 'n']), [-50, 0], 'a clue worth less than nothing gives what it is worth');
eq(P.score(100, ['x', undefined]), [0, 0], 'a mark that is not right scores nothing');
eq(P.score(100, null), [], 'no marks, no scores');

eq([P.nextMark('n'), P.nextMark('r'), P.nextMark('w')], ['r', 'w', 'n'], 'a number key goes no answer, right, wrong and round again');
eq(P.nextMark(undefined), 'r', 'and from nothing to right');
eq([P.markWord('r'), P.markWord('w'), P.markWord('n'), P.markWord('?')], ['right', 'wrong', 'no answer', 'no answer'], 'the words for the marks');

eq(P.summary('Deltas 100', 100, ['Otters', 'Herons', 'Finches', 'Wrens'], ['r', 'r', 'w', 'n']),
  'Deltas 100. Right, +100: Otters and Herons. Wrong: Finches. No answer: Wrens.', 'the sentence said when a clue is scored');
eq(P.summary('Deltas 100', 100, ['Otters', 'Herons', 'Finches'], ['r', 'r', 'r']),
  'Deltas 100. Right, +100: Otters, Herons and Finches.', 'three right, and no word about the rest');
eq(P.summary('Deltas 100', 100, ['Otters', 'Herons'], ['w', 'n']),
  'Deltas 100. No team was right. Wrong: Otters. No answer: Herons.', 'none right is said');
eq(P.summary('Deltas 100', 100, ['Otters'], []), 'Deltas 100. No team was right. No answer: Otters.', 'a team with no mark gave no answer');

/* ── the count each team shows ──────────────────────────────────────────── */
const cats = () => [
  { name: 'A', clues: [{ points: 100, used: true, marks: ['r', 'w', 'n'] }, { points: 200, used: true }, { points: 300, used: true, marks: ['r', 'r', 'w'] }] },
  { name: 'B', clues: [{ points: 100, used: false }, { points: 200, used: true, marks: ['n', 'r'] }] },
];
eq(P.tally(cats(), 3), [{ right: 2, wrong: 0, none: 1 }, { right: 2, wrong: 1, none: 0 }, { right: 0, wrong: 1, none: 2 }], 'right, wrong and no answer a team, over the clues scored in the mode');
eq(P.tally(cats(), 2), [{ right: 2, wrong: 0, none: 1 }, { right: 2, wrong: 1, none: 0 }], 'counted for the teams there are');
eq(P.tally([], 2), [{ right: 0, wrong: 0, none: 0 }, { right: 0, wrong: 0, none: 0 }], 'nothing scored, nothing counted');
eq(P.tally(null, 1), [{ right: 0, wrong: 0, none: 0 }], 'no board is no count, not an error');
eq(P.tallyLine({ right: 2, wrong: 1, none: 0 }), '2 right · 1 wrong · 0 no answer', 'the line under a team');

{
  const c = cats();
  P.dropTeam(c, 1);
  eq(c.map(x => x.clues.map(cl => cl.marks)), [[['r', 'n'], undefined, ['r', 'w']], [undefined, ['n']]], 'a team removed takes its mark off every scored clue');
  eq(c[0].clues[1], { points: 200, used: true }, 'and a clue with no marks gains none');
  P.dropTeam(c, 9);
  eq(c[0].clues[0].marks, ['r', 'n'], 'a place past the end changes nothing');
  P.dropTeam(c, -1);
  eq(c[0].clues[0].marks, ['r', 'n'], 'nor a place before the start');
  P.clearMarks(c);
  eq(c.map(x => x.clues.map(cl => 'marks' in cl)), [[false, false, false], [false, false]], 'Reset game leaves no clue with marks');
  eq(c[0].clues[0], { points: 100, used: true }, 'and takes nothing else off a clue');
}

/* ── sheet items ────────────────────────────────────────────────────────── */
const BOARD = { name: 'Rivers', categories: [
  { name: 'Rivers', clues: [{ points: 100, question: 'Longest river?', answer: 'The Nile', used: true, image: 'idb:1' }, { points: 200, question: 'Widest river?', answer: 'The Amazon', audioId: 'clip-1' }] },
  { name: 'Deltas', clues: [{ points: 100, question: 'Which delta?', answer: '' }] },
] };
const fromBoard = P.itemsFromBoard(BOARD, v => (v === 'idb:1' ? 'blob:picture' : ''));
eq(fromBoard, [
  { group: 'Rivers', prompt: 'Longest river?', answer: 'The Nile', choices: [], image: 'blob:picture', audio: false },
  { group: 'Rivers', prompt: 'Widest river?', answer: 'The Amazon', choices: [], image: '', audio: true },
  { group: 'Deltas', prompt: 'Which delta?', answer: '', choices: [], image: '', audio: false },
], 'a board’s clues, each under its category, a used one too, with its picture and whether it has a clip');
eq(P.itemsFromBoard(BOARD).map(i => i.image), ['', '', ''], 'with no way to read a picture, none is named');
eq(P.itemsFromBoard(null), [], 'no board, no items');

const QS = [
  { id: 'q1', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 2', choices: ['Quito', 'Lima', '', 'Bogotá'], points: 100 },
  { id: 'q2', prompt: 'Agent number?', answer: '007', unit: '' },
  { id: 'q3', prompt: '   ', answer: 'no question', unit: 'Unit 2' },
  { id: 'q4', prompt: 'Longest river?', answer: 'The Nile', unit: ' Unit 2 ' },
  null,
];
const fromBank = P.itemsFromQuestions(QS);
eq(fromBank, [
  { group: 'Unit 2', prompt: 'Capital of Peru?', answer: 'Lima', choices: ['Quito', 'Lima', 'Bogotá'], image: '', audio: false },
  { group: '', prompt: 'Agent number?', answer: '007', choices: [], image: '', audio: false },
  { group: 'Unit 2', prompt: 'Longest river?', answer: 'The Nile', choices: [], image: '', audio: false },
], 'the bank’s questions under their units; one with no question is left out, and a blank choice');
eq(P.itemsFromQuestions(undefined), [], 'no questions, no items');

eq(P.answerLetter(['Quito', 'Lima', 'Bogotá'], 'Lima'), 'B', 'the answer is the second choice');
eq(P.answerLetter(['Quito', 'Lima'], '  lima '), 'B', 'letters and spacing aside');
eq(P.answerLetter(['Quito', 'Lima'], 'Cusco'), '', 'an answer that is none of the choices has no letter');
eq(P.answerLetter(['', 'Lima'], ''), '', 'a blank answer matches no choice, not even a blank one');
eq(P.answerLetter([], 'Lima'), '', 'no choices, no letter');

/* ── the sheet as data ──────────────────────────────────────────────────── */
const quiz = P.sheetModel('quiz', 'Unit 2', fromBank);
eq([quiz.kind, quiz.title, quiz.heading, quiz.keyHeading, quiz.count], ['quiz', 'Unit 2', 'Unit 2 — Practice Quiz', 'Unit 2 — Answer Key', 3], 'a quiz: its headings and how many questions');
eq(quiz.groups.map(g => [g.name, g.items.map(i => i.n + ' ' + i.prompt)]),
  [['Unit 2', ['1 Capital of Peru?', '2 Longest river?']], ['', ['3 Agent number?']]],
  'groups in the order they first appear, a unit’s questions together, numbered through the groups');
eq(quiz.groups[0].items[0].letter, 'B', 'a question with choices knows the answer’s letter');
eq(quiz.groups.map(g => g.items.map(P.answerText)), [['B. Lima', 'The Nile'], ['007']], 'what the key says: the letter with the answer, or the answer');
eq(P.answerText({ answer: '  ', letter: '' }), '', 'a question with no answer has no answer text');
const guide = P.sheetModel('guide', '  ', fromBoard);
eq([guide.kind, guide.title, guide.heading, guide.count], ['guide', 'Questions', 'Questions — Study Guide', 3], 'a study guide, and a sheet with no title is called Questions');
eq(P.sheetModel('anything', 'T', []).kind, 'quiz', 'a kind that is not guide is the quiz');
eq(P.sheetModel('quiz', 'T', []).groups, [], 'no items, no groups');
eq(P.sheetModel('quiz', 'T', [{ group: 'constructor', prompt: 'a', answer: 'b' }, { group: '__proto__', prompt: 'c', answer: 'd' }]).groups.map(g => [g.name, g.items.length]),
  [['constructor', 1], ['__proto__', 1]], 'a group named like a property of every object is a group like any other');
eq(P.sheetModel('quiz', 'T', [{ group: 'G', prompt: 'p', answer: 'a', choices: Array.from({ length: 30 }, (_, i) => 'c' + i) }]).groups[0].items[0].choices.length, 26, 'at most a letter a choice');
eq(P.sheetSentence(quiz), 'Built a practice quiz of 3 questions, with the answer key on a page of its own.', 'what the status line says of a quiz');
eq(P.sheetSentence(P.sheetModel('guide', 'T', [fromBank[0]])), 'Built a study guide of 1 question, each with its answer beside it.', 'and of a guide of one');

/* ── the sheet as elements ──────────────────────────────────────────────── */
/* A document of plain objects. Setting innerHTML on one of its nodes, or
   asking for a method it does not have, is how markup would get in. */
function fakeDoc() {
  const node = tag => {
    const n = { tag, className: '', textContent: '', children: [], attrs: {},
      appendChild(c) { this.children.push(c); return c; },
      setAttribute(k, v) { this.attrs[k] = String(v); } };
    Object.defineProperty(n, 'innerHTML', { set() { throw new Error('innerHTML was set'); } });
    return n;
  };
  return { createElement: node, createTextNode: t => ({ text: String(t) }), createDocumentFragment: () => node('#fragment') };
}
const walk = (n, fn) => { fn(n); (n.children || []).forEach(c => walk(c, fn)); };
const all = (root, pred) => { const out = []; walk(root, n => { if (n.tag && pred(n)) out.push(n); }); return out; };
const cls = c => n => (' ' + n.className + ' ').includes(' ' + c + ' ');
const textOf = n => (n.text !== undefined ? n.text : (n.textContent || '') + (n.children || []).map(textOf).join(''));

const X = '<img src=x onerror="window.__pwned=1">';
const hostile = [{ group: X + 'g', prompt: X + 'p', answer: X + 'a', choices: [X + 'c', X + 'a'], image: 'blob:x', audio: true }];
{
  const sheet = P.buildSheet(fakeDoc(), quiz);
  eq(sheet.children.map(s => s.className), ['pq-sheet pq-quiz', 'pq-sheet pq-key'], 'a quiz is the questions and then the key, the key a section of its own');
  const [q, k] = sheet.children;
  eq(q.children.slice(0, 2).map(n => [n.tag, n.textContent]), [['h2', 'Unit 2 — Practice Quiz'], ['p', 'Name: _____________________________    Date: ______________']], 'the quiz starts with its heading and a line for the name and date');
  eq(all(q, cls('pq-group')).map(n => n.textContent), ['Unit 2'], 'a named group has a heading; the group with no name has none');
  eq(all(q, cls('pq-item')).map(textOf), ['1. Capital of Peru?QuitoLimaBogotá', '2. Longest river?', '3. Agent number?'], 'each question once, in order, with its choices');
  eq(all(q, cls('pq-item')).map(i => all(i, cls('pq-line')).length), [1, 2, 2], 'two lines to write on, one under a question with choices');
  eq(all(q, cls('pq-choices')).map(n => [n.tag, n.attrs.type]), [['ol', 'A']], 'choices are a lettered list');
  ok(!all(q, () => true).some(n => /Lima|Nile|007/.test(n.textContent) && !cls('pq-choices')(n) && n.tag !== 'li'), 'no answer is on the quiz but as a choice');
  ok(!textOf(q).includes('The Nile') && !textOf(q).includes('007'), 'no answer is in the quiz’s text');
  eq(k.children[0].textContent, 'Unit 2 — Answer Key', 'the key has its own heading');
  eq(all(k, cls('pq-key-row')).map(textOf), ['1. B. Lima', '2. The Nile', '3. 007'], 'the key: a number and its answer, the same numbers as the quiz');
  ok(!textOf(k).includes('Capital of Peru'), 'the key does not repeat the questions');
}
{
  const sheet = P.buildSheet(fakeDoc(), P.sheetModel('guide', 'Rivers', fromBoard));
  eq(sheet.children.map(s => s.className), ['pq-sheet pq-guide'], 'a study guide is one section, with no key after it');
  const g = sheet.children[0];
  eq(g.children.slice(0, 2).map(n => n.textContent), ['Rivers — Study Guide', '3 questions, each with its answer beside it.'], 'its heading and what it is');
  eq(all(g, cls('pq-group')).map(n => n.textContent), ['Rivers', 'Deltas'], 'a heading a category');
  eq(all(g, n => n.tag === 'table').length, 2, 'and a table a category');
  eq(all(g, n => n.tag === 'th').map(n => [n.textContent, n.attrs.scope]), [['Question', 'col'], ['Answer', 'col'], ['Question', 'col'], ['Answer', 'col']], 'each with its two column headings');
  eq(all(g, n => n.tag === 'tr' && n.children[0].tag === 'td').map(tr => tr.children.map(textOf)),
    [['1. Longest river?', 'The Nile'], ['2. Widest river? (audio clip: play it from the device)', 'The Amazon'], ['3. Which delta?', '(no answer given)']],
    'a row a question: the question, and its answer beside it; a clip is named; a missing answer is said');
  eq(all(g, n => n.tag === 'img').map(n => [n.className, n.attrs.src, n.attrs.alt]), [['key-img', 'blob:picture', '']], 'a picture is drawn small, with an empty alt');
}
{
  const m = P.sheetModel('quiz', X + 't', hostile);
  for (const kind of ['quiz', 'guide']) {
    const sheet = P.buildSheet(fakeDoc(), Object.assign({}, m, { kind }));
    const tags = all(sheet, () => true).map(n => n.tag);
    eq(tags.filter(t => !['#fragment', 'section', 'h2', 'h3', 'p', 'div', 'b', 'em', 'ol', 'li', 'img', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(t)), [], kind + ': only the sheet’s own elements are made');
    eq(all(sheet, n => n.tag === 'img').map(n => n.attrs.src), ['blob:x'], kind + ': the one picture is the item’s own');
    ok(textOf(sheet).includes(X + 'p') && textOf(sheet).includes(X + 'g') && textOf(sheet).includes(X + 't'), kind + ': a question, a group and a title that are markup are text');
  }
  const keyRows = all(P.buildSheet(fakeDoc(), m), cls('pq-key-row')).map(textOf);
  eq(keyRows, ['1. B. ' + X + 'a'], 'and so is an answer, with the letter of the choice it is');
  const quizPictures = all(P.buildSheet(fakeDoc(), m).children[0], n => n.tag === 'img').map(n => n.className);
  eq(quizPictures, ['quiz-img'], 'the quiz draws the picture large, under its question');
}

/* ── who is ahead, in words ─────────────────────────────────────────────── */
eq(P.standings(['Otters', 'Herons', 'Finches'], [100, 300, 100]).map(r => [r.name, r.score, r.place]),
  [['Herons', 300, 1], ['Otters', 100, 2], ['Finches', 100, 2]], 'standings run from the highest score, a tie sharing a place, in the scoreboard’s order');
eq(P.standings(['A', 'B', 'C', 'D'], [5, 5, 3, 1]).map(r => r.place), [1, 1, 3, 4], 'the place after a tie of two is the third');
eq(P.standings(['A', 'B'], ['7', undefined]).map(r => r.score), [7, 0], 'a score that is not a number counts as 0');
eq(P.standings([], []), [], 'no team, no standings');
eq(P.resultSentence(['Otters', 'Herons'], [500, 300]), 'Otters win with 500 points.', 'one winner is named');
eq(P.resultSentence(['Otters', 'Herons'], [300, 500]), 'Herons win with 500 points.', 'whichever team it is');
eq(P.resultSentence(['Otters', 'Herons', 'Finches'], [400, 400, 100]), 'Otters and Herons tie for first place with 400 points each.', 'a tie of two is said as a tie');
eq(P.resultSentence(['Otters', 'Herons', 'Finches'], [0, 0, 0]), 'Otters, Herons and Finches tie for first place with 0 points each.', 'and a tie of all three');
eq(P.resultSentence(['Otters', 'Herons'], [1, 0]), 'Otters win with 1 point.', 'one point is singular');
eq(P.resultSentence(['Otters', 'Herons'], [-1, -5]), 'Otters win with -1 point.', 'and so is one below zero');
eq(P.resultSentence(['Otters'], [40]), 'Otters finish with 40 points.', 'a team alone finishes, it does not win');
eq(P.resultSentence([], []), '', 'no team, no sentence');

/* ── the final wager round ──────────────────────────────────────────────── */
eq(P.FINAL_FLOOR, 100, 'a team with nothing may wager up to 100');
eq([P.wagerMax(300), P.wagerMax(1), P.wagerMax(0), P.wagerMax(-50), P.wagerMax(undefined), P.wagerMax(250.9)], [300, 1, 100, 100, 100, 250], 'the most a team may wager is its score, or 100 at 0 or below');
eq(P.readWager('200', 300), { ok: true, value: 200, why: '' }, 'a wager within the score is read');
eq(P.readWager('300', 300), { ok: true, value: 300, why: '' }, 'the whole score may be wagered');
eq(P.readWager('0', 300), { ok: true, value: 0, why: '' }, 'and so may nothing');
eq(P.readWager(' 50 ', 300).value, 50, 'spaces round it are ignored');
eq(P.readWager('301', 300), { ok: false, value: null, why: 'the most this team may wager is 300' }, 'one over the score is refused, with the bound');
eq(P.readWager('100', -20).ok, true, 'a team below zero may wager 100');
eq(P.readWager('101', -20), { ok: false, value: null, why: 'the most this team may wager is 100' }, 'and not 101');
eq(P.readWager('100', 0).ok, true, 'a team at zero may wager 100');
eq(P.readWager('', 300), { ok: false, value: null, why: 'no wager yet' }, 'an empty box is not a wager of 0');
eq(P.readWager('   ', 300).why, 'no wager yet', 'nor is a box of spaces');
for (const bad of ['-5', '2.5', 'ten', '1e2', '+5', '5 0', '0x10', '1234567890']) eq(P.readWager(bad, 300), { ok: false, value: null, why: 'a wager is a whole number, 0 or more' }, `"${bad}" is not a wager`);
eq(P.finalDeltas([200, 50, 30], ['r', 'w', 'n']), [200, -50, 0], 'right adds the wager, wrong takes it off, a team that did not play is untouched');
eq(P.finalDeltas([0, 0], ['r', 'w']), [0, 0], 'a wager of nothing moves nothing');
eq(P.finalDeltas([10], []), [0], 'an unmarked wager moves nothing');
eq(P.finalDeltas(undefined, ['r']), [], 'no wagers, no change');
eq(P.finalUnmarked(['r', null, 'w', undefined], 4), [1, 3], 'the teams not yet marked are named by place');
eq(P.finalUnmarked(['r', 'w'], 2), [], 'none when every team is marked');
eq(P.finalUnmarked(['r', 'n'], 2), [1], 'no answer is not a mark in the final round');
eq(P.finalUnmarked(null, 2), [0, 1], 'every team when nothing is marked');
eq(P.finalLines(['Otters', 'Herons', 'Wrens'], [500, -50, 10], [200, 50, 0], ['r', 'w', 'n']),
  ['Otters wagered 200 and were right: +200, now 500.', 'Herons wagered 50 and were wrong: −50, now -50.', 'Wrens did not play the final round: 10.'], 'a line a team says the wager, the mark, the change and the score');
eq(P.cleanFinal(undefined, 3), null, 'a board with no final round has none');
for (const bad of [null, 'final', 7, ['x'], true]) eq(P.cleanFinal(bad, 3), null, `${JSON.stringify(bad)} is not a final round`);
eq(P.cleanFinal({ on: true, question: 'Q?', answer: 'A' }, 3), { on: true, question: 'Q?', answer: 'A' }, 'a round not yet played is its switch and its question');
eq(P.cleanFinal({ on: 'yes', question: 5, answer: null, extra: 1 }, 3), { on: false, question: '', answer: '' }, 'on only when true, texts only when texts, nothing else kept');
eq(P.cleanFinal({ on: true, question: 'x'.repeat(5000), answer: '' }, 1).question.length, 2000, 'a question is cut at 2,000 characters');
eq(P.cleanFinal({ on: true, question: 'Q', answer: 'A', wagers: [200, 50], marks: ['r', 'w'], deltas: [999, 999] }, 2),
  { on: true, question: 'Q', answer: 'A', wagers: [200, 50], marks: ['r', 'w'], deltas: [200, -50] }, 'what a played round scored is worked out again, never read from the file');
eq(P.cleanFinal({ on: true, question: 'Q', answer: 'A', wagers: [200, -5, 'x', 2.9], marks: ['r', 'w', 'r'], deltas: [] }, 4),
  { on: true, question: 'Q', answer: 'A', wagers: [200, 0, 0, 2], marks: ['r', 'w', 'r', 'n'], deltas: [200, 0, 0, 0] }, 'a wager that is not a whole number 0 or more is 0, and a missing mark is not played');
eq('deltas' in P.cleanFinal({ on: true, question: 'Q', answer: 'A', wagers: [200], marks: ['r'] }, 1), false, 'the played half is kept only whole: no deltas, no play');
eq('wagers' in P.cleanFinal({ on: true, question: 'Q', answer: 'A', wagers: '200', marks: ['r'], deltas: [200] }, 1), false, 'and wagers that are not a list are no play');
eq([P.finalPlayed({ on: true }), P.finalPlayed({ deltas: [] }), P.finalPlayed(undefined)], [false, true, false], 'a round is played once it has deltas');
{
  const f = { on: true, question: 'Q', answer: 'A', wagers: [1], marks: ['r'], deltas: [1] };
  P.finalClear(f);
  eq(f, { on: true, question: 'Q', answer: 'A' }, 'clearing a round keeps the switch and the question');
  P.finalClear(undefined);
  ok(true, 'and clearing no round is nothing');
}

/* ── quiz-bowl ──────────────────────────────────────────────────────────── */
const R = (over = {}) => Object.assign(P.qbNew(), over);
eq(P.QB_DEFAULTS, { tossup: 10, bonus: 10, penalty: 0 }, 'a toss-up and a bonus are 10 and a wrong buzz costs nothing, to start');
eq(P.qbNew(), { on: true, source: '', tossup: 10, bonus: 10, penalty: 0, log: [], over: false }, 'a new round');
eq([P.qbPoints('15', 10), P.qbPoints(0, 10), P.qbPoints('', 10), P.qbPoints('x', 10), P.qbPoints(-1, 10), P.qbPoints(1001, 10), P.qbPoints(2.7, 10), P.qbPoints(1000, 10)],
  [15, 0, 10, 10, 10, 10, 2, 1000], 'points are a whole number from 0 to 1,000, or the default');
eq(P.qbStart('q1'), { id: 'q1', wrong: [], right: null, bonusId: null, bonus: null }, 'a toss-up just read');
eq(P.qbOpen(P.qbStart('q1'), 3), [0, 1, 2], 'every team may buzz at first');
{
  let e = P.qbStart('q1');
  const first = e;
  e = P.qbBuzz(e, 1, false, 3);
  eq(e, { id: 'q1', wrong: [1], right: null, bonusId: null, bonus: null }, 'a wrong buzz is recorded');
  eq(first.wrong, [], 'on a new entry: the one before is not changed');
  eq(P.qbOpen(e, 3), [0, 2], 'and that team is locked out');
  ok(P.qbBuzz(e, 1, true, 3) === e, 'a locked-out team cannot buzz again, right or wrong');
  ok(P.qbBuzz(e, 3, true, 3) === e && P.qbBuzz(e, -1, true, 3) === e, 'nor can a team that is not there');
  const won = P.qbBuzz(e, 2, true, 3);
  eq(won, { id: 'q1', wrong: [1], right: 2, bonusId: null, bonus: null }, 'a right buzz wins the toss-up');
  eq(P.qbOpen(won, 3), [], 'and then nobody may buzz');
  ok(P.qbBuzz(won, 0, true, 3) === won, 'not even a team that has not buzzed');
  const dead = P.qbBuzz(P.qbBuzz(e, 0, false, 3), 2, false, 3);
  eq([dead.wrong, dead.right, P.qbOpen(dead, 3)], [[1, 0, 2], null, []], 'three wrong buzzes leave the toss-up dead');
  eq(P.qbDeltas(won, R({ penalty: 5 }), 3), [0, -5, 10], 'the winner scores the toss-up and a wrong buzz costs the penalty');
  eq(P.qbDeltas(won, R(), 3), [0, 0, 10], 'which is nothing unless set');
  eq(P.qbDeltas(dead, R({ penalty: 5 }), 3), [-5, -5, -5], 'a dead toss-up costs each team that buzzed');
  const withBonus = P.qbBonus(won, 'q2', null);
  eq(withBonus, { id: 'q1', wrong: [1], right: 2, bonusId: 'q2', bonus: null }, 'the bonus question shown is recorded before it is marked');
  eq(P.qbDeltas(withBonus, R({ bonus: 20 }), 3), [0, 0, 10], 'and scores nothing yet');
  eq(P.qbDeltas(P.qbBonus(withBonus, 'q2', 'r'), R({ bonus: 20 }), 3), [0, 0, 30], 'a right bonus goes to the team that won the toss-up alone');
  eq(P.qbDeltas(P.qbBonus(withBonus, 'q2', 'w'), R({ bonus: 20, penalty: 5 }), 3), [0, -5, 10], 'a wrong bonus costs nothing');
  ok(P.qbBonus(e, 'q2', 'r') === e, 'no bonus without a toss-up won');
  ok(P.qbBonus(won, 'q1', 'r') === won && P.qbBonus(won, '', 'r') === won, 'and a bonus is another question than its toss-up');
  eq(P.qbBonus(won, 'q2', 'x').bonus, null, 'a mark that is not right or wrong is none');
  eq(P.qbDeltas(won, R(), 2), [0, 0], 'a team that has left scores nothing');
  eq(P.qbDeltas(null, R(), 2), [0, 0], 'no entry, no change');
  eq(P.qbDeltas({ id: 'a', wrong: [5, 0], right: null, bonusId: null, bonus: null }, R({ penalty: 5 }), 2), [-5, 0], 'a wrong buzz by a team that has left costs nobody, and adds no team');
}
{
  const round = R({ penalty: 5, log: [
    { id: 'a', wrong: [0], right: 1, bonusId: 'b', bonus: 'r' },
    { id: 'c', wrong: [0, 1], right: null, bonusId: null, bonus: null },
    { id: 'd', wrong: [], right: 0, bonusId: 'e', bonus: 'w' },
  ] });
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  eq(P.qbAsked(round), ['a', 'b', 'c', 'd', 'e'], 'every toss-up and every bonus has been used');
  eq(P.qbNextId(ids, round), 'f', 'the next question is the first of the source not yet used');
  eq(P.qbNextId(ids, round, ['f']), 'g', 'the toss-up on the screen is not its own bonus');
  eq(P.qbNextId(ids, round, ['f', 'g']), '', 'and there is none when the source has run out');
  eq(P.qbNextId(['b', 'a'], R()), 'b', 'the order is the source’s, not the alphabet’s');
  eq(P.qbNextId([], R()), '', 'an empty source has no question');
  eq([P.qbLeft(ids, round), P.qbLeft(ids, round, ['f']), P.qbLeft(ids, R())], [2, 1, 7], 'what is left is counted the same way');
  eq(P.qbNextId(['toString', 'constructor'], R()), 'toString', 'an id that is a property’s name is still a question');
  eq(P.qbTotals(round, 2), [{ tossups: 1, bonuses: 0, wrong: 2, points: 0 }, { tossups: 1, bonuses: 1, wrong: 1, points: 15 }], 'the round a team: toss-ups, bonuses, wrong buzzes and points');
  eq(P.qbSummary(round, ['Otters', 'Herons']), {
    asked: 3, dead: 1,
    lines: ['Otters: 1 toss-up, 0 bonuses, 2 wrong buzzes, 0 points this round.', 'Herons: 1 toss-up, 1 bonus, 1 wrong buzz, 15 points this round.'],
    sentence: '3 toss-ups asked; 1 went unanswered.', roundResult: 'This round: Herons win with 15 points.',
  }, 'the summary says each team’s round and who won it');
  eq(P.qbSummary(R({ log: [{ id: 'a', wrong: [], right: 0, bonusId: null, bonus: null }] }), ['Otters', 'Herons']).sentence, '1 toss-up asked; every one was answered.', 'one toss-up is singular');
  eq(P.qbSummary(R(), ['Otters']), { asked: 0, dead: 0, lines: ['Otters: 0 toss-ups, 0 bonuses, 0 wrong buzzes, 0 points this round.'], sentence: '0 toss-ups asked; every one was answered.', roundResult: '' }, 'a round with nothing asked has no winner');
}
eq(P.cleanQuizBowl(undefined, 3), null, 'a board with no quiz-bowl round has none');
for (const bad of [null, 'qb', 3, [1]]) eq(P.cleanQuizBowl(bad, 3), null, `${JSON.stringify(bad)} is not a round`);
eq(P.cleanQuizBowl({}, 3), { on: false, source: '', tossup: 10, bonus: 10, penalty: 0, log: [], over: false }, 'an empty one is off, with the defaults');
eq(P.cleanQuizBowl({ on: true, source: 'cultural-trivia', tossup: 20, bonus: 5, penalty: 5, over: true, log: [], extra: 1 }, 3),
  { on: true, source: 'cultural-trivia', tossup: 20, bonus: 5, penalty: 5, log: [], over: true }, 'the settings are kept and nothing else');
eq(P.cleanQuizBowl({ on: 1, source: 9, tossup: -3, bonus: 'x', penalty: 5000, over: 'yes', log: 'none' }, 3),
  { on: false, source: '', tossup: 10, bonus: 10, penalty: 0, log: [], over: false }, 'and anything of the wrong kind is the default');
eq(P.cleanQuizBowl({ log: [
  { id: 'a', wrong: [0, 0, 7, 'x', 1], right: 2, bonusId: 'b', bonus: 'r' },
  { id: 'a', wrong: [], right: 0 },
  { id: 'c', wrong: [1], right: 1, bonusId: 'd', bonus: 'r' },
  { id: 'e', wrong: [], right: null, bonusId: 'f', bonus: 'r' },
  { id: 'g', wrong: [], right: 0, bonusId: 'b', bonus: 'r' },
  { id: 'h', wrong: [], right: 0, bonusId: 'h', bonus: 'r' },
  { id: 'i', wrong: [], right: 0, bonusId: 'j', bonus: 'maybe' },
  { id: '', right: 0 }, { right: 0 }, null, 'k', { id: 5 },
] }, 3).log, [
  { id: 'a', wrong: [0, 1], right: 2, bonusId: 'b', bonus: 'r' },
  { id: 'c', wrong: [1], right: null, bonusId: null, bonus: null },
  { id: 'e', wrong: [], right: null, bonusId: null, bonus: null },
  { id: 'g', wrong: [], right: 0, bonusId: null, bonus: null },
  { id: 'h', wrong: [], right: 0, bonusId: null, bonus: null },
  { id: 'i', wrong: [], right: 0, bonusId: 'j', bonus: null },
], 'a log is cleaned: no question twice, no team that is not there, no team both wrong and right, no bonus without a winner or on a used question');
eq(P.cleanQuizBowl({ log: [{ id: 'a', wrong: [], right: 2 }] }, 2).log[0].right, null, 'a winner beyond the teams is no winner');

/* ── a team leaves ──────────────────────────────────────────────────────── */
{
  const b = {
    final: { on: true, question: 'Q', answer: 'A', wagers: [10, 20, 30], marks: ['r', 'w', 'r'], deltas: [10, -20, 30] },
    quizBowl: R({ log: [
      { id: 'a', wrong: [0, 1], right: 2, bonusId: 'b', bonus: 'r' },
      { id: 'c', wrong: [2], right: 1, bonusId: 'd', bonus: 'r' },
      { id: 'e', wrong: [], right: 0, bonusId: null, bonus: null },
    ] }),
  };
  P.dropTeamFromRounds(b, 1);
  eq([b.final.wagers, b.final.marks, b.final.deltas], [[10, 30], ['r', 'r'], [10, 30]], 'a team that leaves takes its wager, its mark and its change out of the final round');
  eq(b.quizBowl.log, [
    { id: 'a', wrong: [0], right: 1, bonusId: 'b', bonus: 'r' },
    { id: 'c', wrong: [1], right: null, bonusId: null, bonus: null },
    { id: 'e', wrong: [], right: 0, bonusId: null, bonus: null },
  ], 'and its buzzes out of the quiz-bowl log, the teams after it moving up a place');
  const plainBoard = { name: 'x' };
  P.dropTeamFromRounds(plainBoard, 0);
  eq(plainBoard, { name: 'x' }, 'a board with neither round gains nothing');
  const unplayed = { final: { on: true, question: 'Q', answer: 'A' } };
  P.dropTeamFromRounds(unplayed, 0);
  eq(unplayed, { final: { on: true, question: 'Q', answer: 'A' } }, 'nor does a final round not yet played');
  P.dropTeamFromRounds(undefined, 0);
  P.dropTeamFromRounds(b, -1);
  eq(b.final.wagers, [10, 30], 'and a place below zero drops nobody');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
