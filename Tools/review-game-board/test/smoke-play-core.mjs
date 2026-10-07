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

/* ── spin the wheel ─────────────────────────────────────────────────────── */
{
  const clue = (points, used) => ({ points, question: 'Q' + points, answer: 'A', used: !!used });
  const cats = () => [
    { name: 'Rivers', clues: [clue(100, true), clue(200), clue(300)] },
    { name: 'Deltas', clues: [clue(100), clue(200)] },
  ];
  eq(P.wheelNew('abc'), { on: true, seed: 'abc', spins: 0, lose: false, double: false, doubleNext: false, last: null }, 'a new wheel: no spin made, both extra wedges off');
  eq(P.wheelNew('x'.repeat(200)).seed.length, 64, 'a seed is cut to 64 characters');

  /* the wedges */
  const w = P.wheelNew('seed-1');
  eq(P.wheelWedges(cats(), w), [
    { kind: 'clue', cat: 0, clue: 1, label: 'Rivers for 200' }, { kind: 'clue', cat: 0, clue: 2, label: 'Rivers for 300' },
    { kind: 'clue', cat: 1, clue: 0, label: 'Deltas for 100' }, { kind: 'clue', cat: 1, clue: 1, label: 'Deltas for 200' },
  ], 'one wedge for every clue not yet played, category by category, and none for a played clue');
  eq(P.wheelWedges(cats(), Object.assign({}, w, { lose: true })).map(x => x.label).slice(4), ['Lose a turn'], 'Lose a turn is one more wedge when it is turned on');
  eq(P.wheelWedges(cats(), Object.assign({}, w, { double: true })).map(x => x.label).slice(4), ['Double points'], 'and so is Double points');
  eq(P.wheelWedges(cats(), Object.assign({}, w, { lose: true, double: true })).map(x => x.kind), ['clue', 'clue', 'clue', 'clue', 'lose', 'double'], 'both on: the clues, then Lose a turn, then Double points');
  const allUsed = [{ name: 'Rivers', clues: [clue(100, true)] }];
  eq(P.wheelWedges(allUsed, Object.assign({}, w, { lose: true, double: true })), [], 'with every clue played there is no wheel, extra wedges or not');
  eq([P.wheelWedges(undefined, w), P.wheelWedges([{ name: 'x' }, null], w)], [[], []], 'and none for a board with no clue at all');

  /* the draw */
  eq([P.wheelDraw('s', 1, 0), P.wheelDraw('s', 1, -3), P.wheelDraw('s', 1, 'x')], [-1, -1, -1], 'no wedge, no draw');
  eq([P.wheelDraw('s', 1, 1), P.wheelDraw('s', 99, 1)], [0, 0], 'one wedge: the spin lands on it');
  eq([1, 2, 3, 4, 5, 6, 7, 8].map(n => P.wheelDraw('seed-1', n, 6)), [1, 2, 3, 4, 5, 6, 7, 8].map(n => P.wheelDraw('seed-1', n, 6)), 'the same seed, spin and wedge count give the same wedge');
  eq([1, 2, 3, 4, 5, 6, 7, 8].map(n => P.wheelDraw('seed-1', n, 6)), [1, 2, 3, 3, 1, 5, 1, 2], 'spins 1 to 8 of seed-1 over six wedges are these, and stay these');
  ok([1, 2, 3, 4, 5, 6, 7, 8].map(n => P.wheelDraw('seed-2', n, 6)).join() !== [1, 2, 3, 4, 5, 6, 7, 8].map(n => P.wheelDraw('seed-1', n, 6)).join(), 'another seed gives another sequence');
  {
    /* Fairness, stated: over 24,000 seeds, the first spin over 12 wedges lands
       on each wedge within 1.5 percentage points of 1 in 12 (8.33%), and the
       same holds for spin 7 and for 5 and 30 wedges at their own share. The
       seeds are fixed, so this is one sum, not a chance. */
    const SEEDS = 24000;
    for (const [count, n] of [[12, 1], [12, 7], [5, 1], [30, 3], [2, 1]]) {
      const hits = new Array(count).fill(0);
      let outside = 0;
      for (let i = 0; i < SEEDS; i++) { const d = P.wheelDraw('game-' + i, n, count); if (d >= 0 && d < count && Math.floor(d) === d) hits[d]++; else outside++; }
      const worst = Math.max(...hits.map(h => Math.abs(h / SEEDS - 1 / count)));
      eq(outside, 0, `spin ${n} over ${count} wedges is always a wedge of the wheel`);
      ok(worst <= 0.015, `spin ${n} over ${count} wedges: each wedge's share over ${SEEDS} seeds is within 1.5 points of 1 in ${count} (worst ${(worst * 100).toFixed(2)})`);
      ok(Math.min(...hits) > 0, `and every one of the ${count} wedges is landed on`);
    }
    /* one seed, many spins: the sequence of one game is fair too */
    const hits = new Array(8).fill(0);
    for (let n = 1; n <= 24000; n++) hits[P.wheelDraw('one-game', n, 8)]++;
    ok(Math.max(...hits.map(h => Math.abs(h / 24000 - 1 / 8))) <= 0.015, 'and 24,000 spins of one seed over 8 wedges are within 1.5 points of 1 in 8 each');
  }

  /* a spin, and what it records */
  const spin = P.wheelSpin(cats(), w);
  eq(spin, { n: 1, index: P.wheelDraw('seed-1', 1, 4), count: 4, wedge: P.wheelWedges(cats(), w)[P.wheelDraw('seed-1', 1, 4)] }, 'a spin is the draw for the next number over the wedges as they stand');
  eq(w, P.wheelNew('seed-1'), 'and working it out records nothing');
  eq(P.wheelSpin(cats(), w), spin, 'so asked again before it is recorded, it is the same spin (a reload does not re-roll)');
  P.wheelApply(w, spin);
  eq([w.spins, w.last], [1, { n: 1, kind: 'clue', cat: spin.wedge.cat, clue: spin.wedge.clue }], 'recording it counts it and keeps where it landed');
  eq(P.wheelSpin(cats(), w).n, 2, 'the next spin is number 2');
  eq(P.wheelSpin(allUsed, w), null, 'no unplayed clue, no spin');
  eq(P.wheelSpin(cats(), null), null, 'and none without a wheel');
  {
    /* a whole game, twice, and once more through JSON half-way (a reload):
       the same sequence, every clue once, never a played one */
    const play = reloadAt => {
      let c = cats(), wh = P.wheelNew('game-7');
      wh.lose = true; wh.double = true;
      const seq = [];
      for (let i = 0; i < 200; i++) {
        if (i === reloadAt) { c = JSON.parse(JSON.stringify(c)); wh = P.cleanWheel(JSON.parse(JSON.stringify(wh)), c); }
        const s = P.wheelSpin(c, wh);
        if (!s) break;
        if (s.wedge.kind === 'clue') { if (c[s.wedge.cat].clues[s.wedge.clue].used) seq.push('PLAYED'); c[s.wedge.cat].clues[s.wedge.clue].used = true; wh.doubleNext = false; }
        P.wheelApply(wh, s);
        seq.push(s.wedge.label);
      }
      return seq;
    };
    const a = play(-1);
    eq(play(-1), a, 'the same board and seed played twice give the same sequence of spins');
    eq(play(3), a, 'and the same again when the game is saved and read back after the third spin');
    eq(a.filter(l => /for \d/.test(l)).sort(), ['Deltas for 100', 'Deltas for 200', 'Rivers for 200', 'Rivers for 300'], 'every unplayed clue is landed on once');
    ok(!a.includes('PLAYED') && !a.includes('Rivers for 100'), 'and a clue already played is never chosen');
    ok(a.length < 200, 'the game ends when the clues do');
  }
  {
    /* never a played clue, over many seeds and boards */
    let bad = 0, spins = 0;
    for (let i = 0; i < 3000; i++) {
      const c = cats(), wh = P.wheelNew('n-' + i);
      wh.lose = i % 2 === 0; wh.double = i % 3 === 0;
      c[i % 2].clues[i % 2].used = true;
      for (let k = 0; k < 40; k++) {
        const s = P.wheelSpin(c, wh);
        if (!s) break;
        spins++;
        if (s.index < 0 || s.index >= s.count || !s.wedge) { bad++; break; }
        if (s.wedge.kind === 'clue') { if (c[s.wedge.cat].clues[s.wedge.clue].used) bad++; c[s.wedge.cat].clues[s.wedge.clue].used = true; }
        P.wheelApply(wh, s);
      }
      if (P.wheelWedges(c, wh).length) bad++;
    }
    eq(bad, 0, `over 3,000 seeded games (${spins} spins) no spin lands on a played clue, and every game plays every clue`);
  }

  /* the extra wedges */
  {
    const wh = Object.assign(P.wheelNew('s'), { lose: true, double: true });
    P.wheelApply(wh, { n: 1, index: 4, count: 6, wedge: { kind: 'lose', label: 'Lose a turn' } });
    eq([wh.spins, wh.last, wh.doubleNext], [1, { n: 1, kind: 'lose' }, false], 'Lose a turn is counted and doubles nothing');
    P.wheelApply(wh, { n: 2, index: 5, count: 6, wedge: { kind: 'double', label: 'Double points' } });
    eq([wh.spins, wh.last, wh.doubleNext], [2, { n: 2, kind: 'double' }, true], 'Double points is counted and waits for the next clue');
    eq([P.wheelWorth(200, wh), P.wheelWorth(0, wh)], [400, 0], 'a clue is then worth twice its points');
    wh.doubleNext = false;
    eq(P.wheelWorth(200, wh), 200, 'and its own points once the double is spent');
    eq([P.wheelWorth(200, undefined), P.wheelWorth(200, null), P.wheelWorth('200', undefined)], [200, 200, '200'], 'a board with no wheel: a clue is worth exactly what it holds');
    eq(P.wheelWorth(200, Object.assign(P.wheelNew('s'), { on: false, doubleNext: true })), 200, 'a wheel turned off doubles nothing');
    eq(P.wheelWorth(200, Object.assign(P.wheelNew('s'), { doubleNext: 'yes' })), 200, 'and only a true double doubles');
  }

  /* where it landed, and the words */
  {
    const c = cats(), wh = P.wheelNew('s');
    eq(P.wheelLanded(c, wh), null, 'before a spin the wheel has landed nowhere');
    wh.spins = 1; wh.last = { n: 1, kind: 'clue', cat: 1, clue: 0 };
    eq(P.wheelLanded(c, wh), { cat: 1, clue: 0 }, 'after one it is on that clue');
    c[1].clues[0].used = true;
    eq(P.wheelLanded(c, wh), null, 'until the clue is played');
    c[1].clues[0].used = false;
    eq(P.wheelLanded(c, Object.assign({}, wh, { on: false })), null, 'a wheel turned off marks no clue');
    eq(P.wheelLanded(c, Object.assign({}, wh, { last: { n: 1, kind: 'lose' } })), null, 'nor does Lose a turn');
    eq(P.wheelLanded(c, Object.assign({}, wh, { last: { n: 1, kind: 'clue', cat: 9, clue: 0 } })), null, 'nor a clue the board does not have');
    const s = { n: 3, index: 0, count: 4, wedge: { kind: 'clue', cat: 0, clue: 1, label: 'Rivers for 200' } };
    eq(P.wheelSentence(s, wh), 'Spin 3: Rivers for 200. Press Enter to open it.', 'a spin on a clue, in words');
    eq(P.wheelSentence(s, Object.assign({}, wh, { doubleNext: true })), 'Spin 3: Rivers for 200. Double points: it is worth twice that. Press Enter to open it.', 'with a double waiting, the words say so');
    eq(P.wheelSentence({ n: 4, wedge: { kind: 'lose', label: 'Lose a turn' } }, wh), 'Spin 4: Lose a turn. No clue this spin.', 'Lose a turn, in words');
    eq(P.wheelSentence({ n: 5, wedge: { kind: 'double', label: 'Double points' } }, wh), 'Spin 5: Double points. The next clue played is worth double.', 'Double points, in words');
    eq(P.wheelSentence(null, wh), 'Every clue has been played: there is nothing left to spin for.', 'and no spin left, in words');
    eq(P.wheelOdds(cats(), wh), '4 clues not yet played: the wheel has 4 wedges, and a spin is as likely to land on one as on any other (1 in 4).', 'the odds are said from the wedges as they stand');
    eq(P.wheelOdds(cats(), Object.assign({}, wh, { lose: true, double: true })), '4 clues not yet played and 2 extra wedges: the wheel has 6 wedges, and a spin is as likely to land on one as on any other (1 in 6).', 'the extra wedges are counted in the odds');
    eq(P.wheelOdds(cats(), Object.assign({}, wh, { lose: true })), '4 clues not yet played and 1 extra wedge: the wheel has 5 wedges, and a spin is as likely to land on one as on any other (1 in 5).', 'one extra wedge is "wedge"');
    eq(P.wheelOdds([{ name: 'R', clues: [clue(100)] }], wh), '1 clue not yet played: the wheel has one wedge, so the spin lands on it.', 'one clue left is said plainly');
    eq(P.wheelOdds(allUsed, wh), 'Every clue has been played, so there is nothing to spin for.', 'and none left too');
  }

  /* a wheel from a file */
  {
    const c = cats();
    eq([P.cleanWheel(undefined, c), P.cleanWheel('wheel', c), P.cleanWheel([1], c), P.cleanWheel(null, c)], [null, null, null, null], 'what is not a wheel is none');
    eq(P.cleanWheel({}, c), { on: false, seed: '', spins: 0, lose: false, double: false, doubleNext: false, last: null }, 'an empty one is a wheel that is off');
    const good = { on: true, seed: 'abc', spins: 4, lose: true, double: true, doubleNext: true, last: { n: 4, kind: 'clue', cat: 1, clue: 1 } };
    eq(P.cleanWheel(good, c), good, 'a whole wheel is kept as it is');
    eq(P.cleanWheel(Object.assign({}, good, { extra: '<img>', on: 'yes', lose: 1, double: 'true', doubleNext: 1 }), c), Object.assign({}, good, { on: false, lose: false, double: false, doubleNext: false }), 'only true is on, and nothing else is kept');
    eq(P.cleanWheel(Object.assign({}, good, { seed: 7 }), c).seed, '', 'a seed that is not text is none');
    eq([-1, 2.7, 'x', 100001].map(v => P.cleanWheel(Object.assign({}, good, { spins: v, last: null }), c).spins), [0, 2, 0, 0], 'the count of spins is a whole number from 0 to 100,000');
    eq(P.cleanWheel(Object.assign({}, good, { last: { n: 3, kind: 'clue', cat: 1, clue: 1 } }), c).last, null, 'a last spin that is not the spin the count says is dropped');
    eq(P.cleanWheel(Object.assign({}, good, { last: { n: 4, kind: 'clue', cat: 5, clue: 0 } }), c).last, null, 'so is one on a clue the board does not have');
    eq(P.cleanWheel(Object.assign({}, good, { last: { n: 4, kind: 'clue', cat: '1', clue: '1' } }), c).last, null, 'and one whose place is not a number');
    eq(P.cleanWheel(Object.assign({}, good, { last: { n: 4, kind: 'jackpot' } }), c).last, null, 'and a wedge the wheel does not have');
    eq(P.cleanWheel(Object.assign({}, good, { last: { n: 4, kind: 'lose', cat: 1, x: 2 } }), c).last, { n: 4, kind: 'lose' }, 'Lose a turn is kept, with nothing else on it');
    eq(P.cleanWheel(Object.assign({}, good, { spins: 0, last: { n: 0, kind: 'double' } }), c).last, null, 'and no last spin before the first');
  }

  /* reset */
  {
    const wh = { on: true, seed: 'old', spins: 9, lose: true, double: true, doubleNext: true, last: { n: 9, kind: 'lose' } };
    P.wheelReset(wh, 'new');
    eq(wh, { on: true, seed: 'new', spins: 0, lose: true, double: true, doubleNext: false, last: null }, 'Reset game: a new seed, no spin made, no double waiting, the settings kept');
    P.wheelReset(undefined, 'x');
    ok(true, 'and a board with no wheel is left alone');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
