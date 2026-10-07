// smoke-bank-editor-core.mjs — the pure half of the Review Game Board's
// question-bank editor (Tools/review-game-board/rgb-bank-editor.js, Path 12
// P2): tags and choices as the bank would store them, which choice is the
// answer, what a Save sends and what it leaves alone, and what an import
// would do before it is stored. Pure Node: no browser, no port.
//
//   node Tools/review-game-board/test/smoke-bank-editor-core.mjs
//
// The page itself is smoke-bank-editor.mjs. Every question is made up.
// Exits 1 on any failure.

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

/* The two scripts with no document and no storage: the pure half needs neither. */
const window = {};
const ctx = vm.createContext({ window });
vm.runInContext(src('_shared/question-bank.js'), ctx);
vm.runInContext(src('Tools/review-game-board/rgb-bank-editor.js'), ctx);
const QB = window.QuestionBank, E = window.ReviewBankEditor;
const AT = { now: '2026-10-07T06:00:00.000Z', nowMs: 1791352800000, random: () => 0.123456789 };

console.log('Review Game Board — the bank editor, pure half');

/* ── tags ───────────────────────────────────────────────────────────────── */
eq(E.addTags([], 'rivers'), ['rivers'], 'a typed tag is added');
eq(E.addTags(['rivers'], ' Africa , maps;  '), ['rivers', 'Africa', 'maps'], 'several typed at once are split on a comma and a semicolon, trimmed, blanks dropped');
eq(E.addTags(['Rivers'], 'rivers'), ['Rivers'], 'a tag already there in other letters is not added twice');
eq(E.addTags(['a'], ''), ['a'], 'nothing typed adds nothing');
eq(E.addTags(null, null), [], 'and nothing at all is an empty list');
eq(E.removeTag(['Rivers', 'maps'], 'rivers'), ['maps'], 'a tag is removed whatever its letter case');
eq(E.cleanTags(['a', '', ' a ', 'B', 'b']), ['a', 'B'], 'tags are cleaned by the bank\'s own rule');
eq(E.cleanTags(['one, two']), ['one, two'], 'a tag in a list is one tag, comma and all');
eq(E.cleanTags(['x']), QB.normalize({ tags: ['x'] }).tags, 'which is normalize()\'s');

/* ── choices and the right one ──────────────────────────────────────────── */
eq(E.rightIndex(['Quito', 'Lima', 'Bogotá'], 'Lima'), 1, 'the right choice is the one that is the answer');
eq(E.rightIndex(['Quito', ' LIMA  '], 'lima'), 1, 'letter case and spacing aside');
eq(E.rightIndex(['Quito', 'Lima'], 'Paris'), -1, 'no choice is right when the answer is none of them');
eq(E.rightIndex(['', 'Lima'], ''), -1, 'a blank answer marks nothing, not a blank choice');
eq(E.rightIndex(['Lima', 'Lima'], 'Lima'), 0, 'of two alike the first is the one marked');
eq(E.rightIndex(null, 'Lima'), -1, 'no choices, none marked');
const ABC = ['a', 'b', 'c'];
eq(E.move(ABC, 0, 1), ['b', 'a', 'c'], 'a choice moves down one place');
eq(E.move(ABC, 2, -1), ['a', 'c', 'b'], 'and up one place');
eq([E.move(ABC, 0, -1), E.move(ABC, 2, 1), E.move(ABC, 5, 1)], [ABC, ABC, ABC], 'the first cannot move up, the last cannot move down, and a place that is not there moves nothing');
eq(ABC, ['a', 'b', 'c'], 'move() does not change the list it was given');
eq(E.cleanChoices(['Lima', '', ' lima ', 'A | B']), ['Lima', 'A | B'], 'choices are cleaned by the bank\'s rule: no blanks, no repeats, a bar is part of a choice');
eq(E.cleanChoices(null), [], 'no choices is an empty list');

/* ── a draft ────────────────────────────────────────────────────────────── */
const STORED = {
  id: 'q-keep-1', prompt: 'Capital of Peru?', answer: 'Lima', choices: ['Quito', 'Lima'], media: { kind: 'image', ref: 'idb:rgb/made-up' },
  unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', tags: ['capitals'], points: 100,
  createdAt: '2026-08-20T14:00:00.000Z', hint: 'On the coast', copiedFrom: 'seed:062:bi3'
};
const draft = E.draftOf(STORED);
eq(draft, { prompt: 'Capital of Peru?', answer: 'Lima', points: 100, unit: 'Unit 1', standard: '6.G.1', difficulty: 'Easy', tags: ['capitals'], choices: ['Quito', 'Lima'] },
  'a draft is the eight fields the form shows, and nothing else');
draft.tags.push('x'); draft.choices.push('y');
eq([STORED.tags, STORED.choices], [['capitals'], ['Quito', 'Lima']], 'and changing a draft does not reach the question');
eq(E.draftOf({ question: 'Old name?', answer: 'Yes' }), { prompt: 'Old name?', answer: 'Yes', points: 0, unit: '', standard: '', difficulty: '', tags: [], choices: [] },
  'a question with no choices and no tags is a draft with empty lists');

eq(E.questionOf({ prompt: '  Q? ', answer: ' A ', points: '250', unit: ' U ', standard: ' S ', difficulty: 'Hard', tags: ['t', 'T'], choices: ['A', '', 'B'] }, 'q-1'),
  { prompt: 'Q?', answer: 'A', points: 250, unit: 'U', standard: 'S', difficulty: 'Hard', tags: ['t'], choices: ['A', 'B'], id: 'q-1' },
  'a draft to save is trimmed, its points a number, its lists cleaned, the id kept');
eq(Object.keys(E.questionOf(E.draftOf(STORED), STORED.id)).sort(), ['answer', 'choices', 'difficulty', 'id', 'points', 'prompt', 'standard', 'tags', 'unit'],
  'and it names the eight fields and the id only: no media, no date, no field the form does not show');
eq([E.questionOf({ points: '' }).points, E.questionOf({ points: 'abc' }).points, E.questionOf({ points: '-50' }).points], [0, 0, -50], 'points that are not a number are 0');
eq(E.questionOf({ difficulty: 'Impossible' }).difficulty, '', 'a difficulty that is not one of the three is blank');
ok(!('id' in E.questionOf({ prompt: 'p', answer: 'a' })), 'with no id given there is none, so the bank makes one');
eq(E.questionOf(null), { prompt: '', answer: '', points: 0, unit: '', standard: '', difficulty: '', tags: [], choices: [] }, 'nothing at all is a blank question, not a throw');

eq(E.problems({ prompt: 'Q', answer: 'A' }), [], 'a question and an answer can be saved');
eq([E.problems({ prompt: ' ', answer: 'A' }), E.problems({ prompt: 'Q', answer: '' })], [['Add both a question and an answer.'], ['Add both a question and an answer.']], 'no question, or no answer, cannot');
eq(E.notes({ prompt: 'Q', answer: 'Lima', choices: ['Quito', 'Lima'] }), [], 'choices with the answer among them need no note');
eq(E.notes({ prompt: 'Q', answer: 'Paris', choices: ['Quito', 'Lima'] }).length, 1, 'choices without the answer among them are said');
eq([E.notes({ prompt: 'Q', answer: 'Paris', choices: [] }), E.notes({ prompt: 'Q', answer: 'Paris', choices: ['', ' '] })], [[], []], 'no choices, or only blank rows, need no note');

/* ── what a Save changes ────────────────────────────────────────────────── */
eq(E.changed(STORED, E.draftOf(STORED)), false, 'a form saved as it opened changes nothing');
eq(E.changed(STORED, { ...E.draftOf(STORED), points: '100', unit: ' Unit 1 ' }), false, 'not when the same values are typed as text with spaces round them');
for (const [field, value, name] of [
  ['prompt', 'Capital of Ecuador?', 'question'], ['answer', 'Quito', 'answer'], ['points', '200', 'points'], ['unit', 'Unit 2', 'unit'],
  ['standard', '6.G.2', 'standard'], ['difficulty', 'Hard', 'difficulty'], ['tags', ['capitals', 'peru'], 'tags'], ['choices', ['Lima', 'Quito'], 'choices'],
]) {
  const d = { ...E.draftOf(STORED), [field]: value };
  eq([E.changed(STORED, d), E.differences(STORED, E.questionOf(d))], [true, [name]], `a changed ${name} is a change, and is named`);
}
eq(E.changed({ prompt: 'Q', answer: 'A' }, { prompt: 'Q', answer: 'A', choices: ['', ''] }), false, 'blank choice rows are not a change');
eq(E.changed({ prompt: 'Q', answer: 'A', points: 12 }, { prompt: 'Q', answer: 'A', points: '12.7' }), false, 'points are compared as the whole number a Save would store');

const BANK = [
  { id: 'q-first', prompt: 'First?', answer: 'One', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-08-01T00:00:00.000Z' },
  QB.normalize(STORED),
  { id: 'q-last', prompt: 'Last?', answer: 'Three', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-08-03T00:00:00.000Z' },
];
const edited = { ...E.draftOf(STORED), answer: 'Quito', choices: ['Quito', 'Lima', 'Bogotá'], tags: ['capitals', 'andes'], unit: 'Unit 9' };
const saved = QB.upsert(BANK, E.questionOf(edited, STORED.id), AT);
eq(saved.questions.map(q => q.id), ['q-first', 'q-keep-1', 'q-last'], 'a Save keeps the question\'s id and its place in the bank');
eq(saved.question, { ...QB.normalize(STORED), answer: 'Quito', choices: ['Quito', 'Lima', 'Bogotá'], tags: ['capitals', 'andes'], unit: 'Unit 9', updatedAt: AT.now },
  'and changes the fields that were edited and `updatedAt`, nothing else: its picture, its first date, where it was copied from and a field this page does not know are as they were');
eq([saved.questions[0], saved.questions[2]], [BANK[0], BANK[2]], 'the questions round it are untouched');
eq(BANK[1], QB.normalize(STORED), 'and the list handed in is not changed');
const emptied = QB.upsert(BANK, E.questionOf({ ...E.draftOf(STORED), choices: [], tags: [] }, STORED.id), AT).question;
eq(['choices' in emptied, emptied.tags, emptied.media], [false, [], STORED.media], 'a Save with every choice removed stores no `choices` field, and with every tag removed an empty list');

/* The add card: with no choices and no tags, what is stored is what the
   six-field form stored before v274. */
const SIX = { prompt: 'Longest river?', answer: 'The Nile', points: 400, unit: 'Unit 2', standard: '', difficulty: 'Hard' };
const fresh = E.questionOf({ ...SIX, points: '400', tags: [], choices: [] });
delete fresh.choices;
eq(QB.upsert(BANK, fresh, AT).question, QB.upsert(BANK, SIX, AT).question, 'a question added with no choices and no tags is stored as the six-field form stored it');
const withBoth = QB.upsert(BANK, E.questionOf({ ...SIX, tags: ['rivers'], choices: ['The Nile', 'The Amazon'] }), AT).question;
eq([withBoth.choices, withBoth.tags, withBoth.id.slice(0, 2)], [['The Nile', 'The Amazon'], ['rivers'], 'q-'], 'and one added with choices and tags holds them, under a new id');

/* ── a preview before an import ─────────────────────────────────────────── */
const FILE = { questions: [
  { prompt: 'Smallest prime?', answer: '2', unit: 'Unit 3' },                                  // new
  { id: 'q-first', prompt: 'First?', answer: 'One', unit: 'Unit 1', tags: ['counting'] },       // changes unit and tags
  { id: 'q-last', prompt: 'Last?', answer: 'Three', unit: '', standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-08-03T00:00:00.000Z' }, // the same
  { prompt: 'first?', answer: ' ONE ' },                                                         // no id, words already there
  { prompt: 'No answer here', answer: '' },                                                      // refused
  { prompt: '', answer: '' },                                                                    // refused twice over
  { prompt: 'Smallest prime?', answer: '2' },                                                    // the file repeats itself
  { id: 'seed:062:bi3', prompt: 'A seed by name?', answer: 'Not stored as one' },                // new, under a new id
], rows: [2, 3, 4, 5, 6, 7, 8, 9] };
const before = JSON.stringify(BANK);
const plan = E.importPlan(BANK, FILE);
eq(JSON.stringify(BANK), before, 'working out a preview does not change the bank it was given');
eq([plan.total, plan.added, plan.updated, plan.there, plan.refused, plan.more], [8, 2, 1, 3, 2, 0], 'a preview counts what would be added, changed, is already there and is refused');
eq(plan.rows.map(r => r.status), ['new', 'change', 'there', 'there', 'refused', 'refused', 'there', 'new'], 'and says which is which, in the file\'s order; a question the file repeats is marked already there');
eq(plan.rows.map(r => r.row), FILE.rows, 'each under the file\'s own row number');
eq(plan.rows[1].fields, ['unit', 'tags'], 'a change names the fields it would change');
eq([plan.rows[4].reasons, plan.rows[5].reasons], [['no answer'], ['no question', 'no answer']], 'a refusal says why, in the bank\'s own words');
eq(plan.rows[0].question, QB.normalize(FILE.questions[0]), 'and each row carries the question as the bank would read it');
const real = QB.merge(BANK, FILE.questions, AT);
eq([plan.added, plan.updated, plan.there, plan.refused], [real.added, real.updated, real.same + real.skipped, real.invalid.length], 'the counts are the import\'s own: merge() over the same questions gives the same four');
eq(plan.rows.filter(r => r.status === 'new').length + plan.rows.filter(r => r.status === 'change').length, real.added + real.updated, 'and the rows marked new and changed are as many as it stores');
eq(E.importPlan(BANK, FILE).signature, plan.signature, 'two previews of the same file over the same bank have the same signature');
ok(E.importPlan(real.questions, FILE).signature !== plan.signature, 'and over a bank that has changed, a different one');
const again = E.importPlan(real.questions, FILE);
eq([again.added, again.updated, again.there, again.refused], [0, 0, 6, 2], 'after the import the same file would add and change nothing');

const short = E.importPlan(BANK, FILE, 3);
eq([short.rows.length, short.more, short.added, short.refused], [3, 5, 2, 2], 'a preview lists only so many rows and still counts the whole file');
eq(E.MOST_SHOWN, 500, 'the page lists the first 500');
eq(E.importPlan(BANK, { questions: [{ prompt: 'p', answer: 'a' }] }).rows[0].row, 1, 'with no row numbers a row is its place in the file');
eq(E.importPlan(BANK, null).total, 0, 'nothing to import is an empty preview, not a throw');
const media = E.importPlan(BANK, { questions: [{ id: 'q-keep-1', hint: 'A new hint' }] });
eq(media.rows[0].status, 'refused', 'a row that names an id and no question is refused, as the import refuses it');
const other = E.importPlan(BANK, { questions: [{ ...QB.normalize(STORED), hint: 'A new hint' }] });
eq([other.rows[0].status, other.rows[0].fields], ['change', ['other details']], 'a change to a field the form does not show is still a change, named as other details');

eq(plan.rows.map(E.statusLabel), ['new', 'changes a question in your bank: unit, tags', 'already in your bank', 'already in your bank', 'left out: no answer', 'left out: no question, no answer', 'already in your bank', 'new'],
  'each status is said in words');
eq(E.planSentence(plan, 'more.csv'), 'more.csv holds 8 questions. 2 would be added, 1 would change a question already in your bank, 3 are already in your bank, 2 would be left out (no question or no answer). Nothing is stored until you press the button, and an import never deletes.',
  'the summary says the file, the four counts, and that nothing is stored yet');
eq(E.planSentence(again), 'That file holds 8 questions. 6 are already in your bank, 2 would be left out (no question or no answer). There is nothing to add, so nothing was stored.',
  'and with nothing to add it says so');
ok(/1 would change a question already in your bank\. Nothing is stored until you press the button/.test(E.planSentence(other, 'x.json')), 'a file that only changes a question still waits for the button');
eq(E.planSentence(E.importPlan([], { questions: [{ prompt: 'p', answer: 'a' }] }), 'one.json'), 'one.json holds 1 question. 1 would be added. Nothing is stored until you press the button, and an import never deletes.', 'one question is "1 question"');
eq(E.planSentence(E.importPlan([QB.normalize({ id: 'x', prompt: 'p', answer: 'a' })], { questions: [{ prompt: 'p', answer: 'a' }] })).includes('1 is already in your bank'), true, 'and one already there "is", not "are"');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
