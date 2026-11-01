// qsets.test.mjs — 054's bank of saved question sets, in pure Node.
//
//   node Tools/current-events-discussion-guide-generator/test/qsets.test.mjs
//
// cedg-qsets.js decides what a set is: plain question texts, trimmed, no blanks
// or repeats, capped; a name that is unique ignoring case; saving over a name
// replaces it; a damaged store is no sets rather than an error. QSETS_FILE
// points the suite at another copy of the module (the deliberate-break runs use
// it). Every question here is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.QSETS_FILE || path.join(here, '..', 'cedg-qsets.js');
await import(pathToFileURL(file).href);
const S = globalThis.CedgSets;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Question sets — what a set is, saving, loading');

/* built-in text */
eq(S.plain('What&rsquo;s one question you still have?'), 'What’s one question you still have?', 'a built-in question loses its entity');
eq(S.plain('Tom &amp; Jo &mdash; why?'), 'Tom & Jo — why?', 'other entities too');
eq(S.plain('keeps &unknown; as it is'), 'keeps &unknown; as it is', 'an entity it does not know is left alone');

/* cleaning */
eq(S.cleanName('  Persuasive   follow-up  '), 'Persuasive follow-up', 'a name is trimmed and its spaces collapsed');
eq(S.cleanName('x'.repeat(100)).length, S.NAME_MAX, 'a name is capped');
eq(S.cleanQuestions(['  Why now? ', '', '   ', 'Why now?', 5, null, 'Who gains?']), ['Why now?', 'Who gains?'], 'blanks, repeats and non-strings go');
eq(S.cleanQuestions(Array.from({ length: 30 }, (_, i) => 'Q' + i)).length, S.MAX_QUESTIONS, 'a set is capped at 20 questions');
eq(S.cleanQuestions(Array.from({ length: 30 }, (_, i) => 'Q' + i), Infinity).length, 30, '...unless asked to count them all');
eq(S.cleanQuestions(['y'.repeat(500)])[0].length, S.QUESTION_MAX, 'a question is capped');
eq(S.cleanQuestions('not a list'), [], 'not a list is no questions');

/* saving */
let r = S.save([], 'Persuasive', ['Who is the author trying to convince?', 'What evidence is given?'], 100);
eq([r.status, r.sets.length, r.sets[0].name, r.sets[0].questions.length, r.sets[0].ts], ['added', 1, 'Persuasive', 2, 100], 'a first set is added');
const one = r.sets;
r = S.save(one, 'persuasive', ['A new one?'], 200);
eq([r.status, r.sets.length, r.sets[0].name, r.sets[0].questions], ['replaced', 1, 'persuasive', ['A new one?']], 'the same name, any case, replaces rather than duplicates');
eq(r.sets[0].id, one[0].id, '...and keeps its id');
eq(one[0].questions.length, 2, 'the list it was given is not changed');
eq(S.save(one, 'PERSUASIVE', ['Upper?']).status, 'replaced', 'a name in capitals still finds it');
eq(S.save(one, '', ['Q?']).status, 'noname', 'no name is refused');
eq(S.save(one, '   ', ['Q?']).status, 'noname', 'a blank name is refused');
eq(S.save(one, 'Empty', ['', '  ']).status, 'empty', 'a set with nothing in it is refused');
let big = []; for (let i = 0; i < S.MAX_SETS; i++) big = S.save(big, 'Set ' + i, ['Q' + i]).sets;
eq(big.length, S.MAX_SETS, 'thirty sets fit');
eq(S.save(big, 'One too many', ['Q?']).status, 'full', 'the thirty-first is refused');
eq(S.save(big, 'set 3', ['Changed?']).status, 'replaced', 'but a full bank can still replace one');
eq(S.save([], 'Long', Array.from({ length: 25 }, (_, i) => 'Q' + i)).dropped, 5, 'questions past the cap are counted as dropped');
eq(S.save([], 'Short', ['A?', 'B?']).dropped, 0, '...and none dropped is zero');

/* load / dump */
const round = S.load(S.dump(big));
eq(round.map(s => s.name), big.map(s => s.name), 'a bank survives dump and load');
eq(S.load(null), [], 'nothing stored is no sets');
eq(S.load('{not json'), [], 'unreadable storage is no sets');
eq(S.load('{"v":1}'), [], 'a store with no list is no sets');
eq(S.load('[1,2]'), [], 'a list where an object belongs is no sets');
eq(S.load(JSON.stringify({ v: 1, sets: [null, 4, { name: 'A', questions: [] }, { name: '', questions: ['Q'] }, { name: 'Good', questions: ['Q?', 7] }, { name: 'good', questions: ['Dup?'] }] })).map(s => s.name), ['Good'], 'damaged and duplicate-named entries are dropped on load');
eq(S.load(JSON.stringify({ sets: [{ name: 'A', questions: ['<img src=x onerror=1>'] }] }))[0].questions, ['<img src=x onerror=1>'], 'question text is kept as typed (the page escapes it)');
eq(S.load(JSON.stringify({ sets: Array.from({ length: 40 }, (_, i) => ({ name: 'S' + i, questions: ['Q'] })) })).length, S.MAX_SETS, 'a bank over the cap is cut on load');

/* remove / find / merge */
eq(S.remove(one, one[0].id).length, 0, 'remove takes a set out by id');
eq(S.remove(one, 'nope').length, 1, '...and an unknown id changes nothing');
eq(S.find(one, one[0].id).name, 'Persuasive', 'find returns the set');
eq(S.find(one, 'nope'), null, '...or null');
eq(S.merge(['A?', 'B?'], ['B?', 'C?', 'A?']), ['A?', 'B?', 'C?'], 'merge adds only what is missing, in order');
eq(S.merge([], ['X?']), ['X?'], 'merge into nothing');
eq(S.merge(Array.from({ length: 20 }, (_, i) => 'Q' + i), ['New?']).length, 20, 'merge stops at the cap');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
