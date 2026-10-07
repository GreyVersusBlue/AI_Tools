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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
