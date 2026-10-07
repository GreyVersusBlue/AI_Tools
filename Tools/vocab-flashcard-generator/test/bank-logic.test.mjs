// bank-logic.test.mjs — pure-logic tests for vfg-bank.js (Path 12 P2): a bank
// question as a card of 040's list and a card as a bank question, with the
// real _shared/question-bank.js, _shared/store.js and vfg-layout.js.
//
//   node Tools/vocab-flashcard-generator/test/bank-logic.test.mjs   (or: npm run test:vocab-bank-logic)
//
// The scripts are classic ones that publish a global, so they run here in a
// vm context over a fake localStorage, as question-bank.test.mjs runs the
// module. The random questions take a seeded generator. Every word here is
// made up. The browser half is smoke-bank.mjs.
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

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    writes: [],
    get length() { return map.size; },
    key: i => [...map.keys()][i] ?? null,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) { if (k !== '__gvb_store_probe__') this.writes.push(k); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}
function page(storage) {
  const handlers = {};
  const win = {
    localStorage: storage, navigator: {}, console: { error() {} },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    dispatchEvent(e) { (handlers[e.type] || []).forEach(fn => fn(e)); return true; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { body: { appendChild() {} }, createElement: () => ({ style: { cssText: '' }, setAttribute() {}, textContent: '' }) },
    Blob, setTimeout, clearTimeout,
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of ['_shared/store.js', '_shared/question-bank.js', 'Tools/vocab-flashcard-generator/vfg-layout.js', 'Tools/vocab-flashcard-generator/vfg-bank.js']) {
    vm.runInContext(src(f), ctx, { filename: f });
  }
  return win;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const W = page(fakeStorage());
const V = W.VfgBank, parse = W.VocabLayout.parseWordList;
const card = (term, definition, example = '', pronunciation = '', partOfSpeech = '') => ({ term, definition, example, pronunciation, partOfSpeech });

// ---- a question as a card -------------------------------------------------------
console.log('VfgBank — a question as a card');
eq(V.toCard({ prompt: ' What is the capital of Peru? ', answer: ' Lima ' }),
  { ok: true, item: card('What is the capital of Peru?', 'Lima'), line: 'What is the capital of Peru?: Lima' },
  'the question is the term (the front) and the answer the definition (the back), as "term: definition"');
eq(parse(V.toCard({ prompt: 'What is the capital of Peru?', answer: 'Lima' }).line), [card('What is the capital of Peru?', 'Lima')], 'and the page reads that line back as that card');
eq(V.toCard({ prompt: 'Solve: 3x + 4 = 19', answer: 'x = 5' }).line, 'Solve: 3x + 4 = 19\tx = 5', 'a colon in the question would split the card in the wrong place, so the line is tab-separated');
eq(parse('Solve: 3x + 4 = 19\tx = 5'), [card('Solve: 3x + 4 = 19', 'x = 5')], 'which the page has always read');
eq(V.toCard({ prompt: 'Which is a base?', answer: 'NaOH | not HCl' }).line, 'Which is a base?\tNaOH | not HCl', 'a bar in the answer would be read as an example, so that line is tab-separated too');
eq(V.toCard({ prompt: 'Ratio', answer: '3:4, or 0.75' }).line, 'Ratio: 3:4, or 0.75', 'a colon in the answer is fine: the first one splits');
eq(V.toCard({ prompt: 'Lima, Peru', answer: 'a capital, in South America' }).line, 'Lima, Peru: a capital, in South America', 'commas are fine');
eq(V.toCard({ prompt: 'Uno', answer: 'one', example: 'Tengo uno', pronunciation: 'OO-noh', partOfSpeech: 'number' }),
  { ok: true, item: card('Uno', 'one', 'Tengo uno', 'OO-noh', 'number'), line: 'Uno: one | Tengo uno | OO-noh | number' }, 'a question that carries 040\'s three extra fields gets them back');
eq(V.toCard({ prompt: 'Uno', answer: 'one', partOfSpeech: 'number' }).line, 'Uno: one |  |  | number', 'an extra with nothing before it keeps its place');
eq(parse('Uno: one |  |  | number'), [card('Uno', 'one', '', '', 'number')], 'and is read back in that place');
eq(V.toCard({ prompt: 'Uno', answer: 'one', example: 'two\nlines', pronunciation: 7, partOfSpeech: { a: 1 } }).item, card('Uno', 'one'), 'an extra that is not one line of text is left off, and the card is still made');
eq([V.toCard({ prompt: 'Uno', answer: 'one', example: 'two\nlines', partOfSpeech: 'number' }).item, V.toCard({ prompt: 'Uno', answer: 'one', example: 'a\ttab', pronunciation: 'OO-noh' }).line],
  [card('Uno', 'one', '', '', 'number'), 'Uno: one |  | OO-noh'], 'and only that extra is left off: the others stay');
eq(V.toCard({ prompt: 'A <b>bold</b> & "quoted" question?', answer: '<img src=x onerror=alert(1)>' }).item, card('A <b>bold</b> & "quoted" question?', '<img src=x onerror=alert(1)>'), 'markup is kept as the text it is (the page shows a card as text)');
eq(V.toCard({ prompt: 'Has choices?', answer: 'B', choices: ['A', 'B'], media: { id: 'm1' }, points: 300, unit: 'U', tags: ['t'], standard: 'S', difficulty: 'Hard' }).item, card('Has choices?', 'B'), 'nothing else of a question reaches the card');

console.log('VfgBank — what cannot be a card, and why');
eq(V.toCard({ prompt: '', answer: 'A' }), { ok: false, why: 'It has no question.' }, 'no question');
eq(V.toCard({ prompt: 'Q?', answer: '  ' }), { ok: false, why: 'It has no answer, so the back of the card would be blank.' }, 'no answer');
eq(V.toCard({ prompt: 'Line one\nline two', answer: 'A' }).why, 'Its question runs over more than one line, and a card is one line of the list.', 'a question of two lines');
eq(V.toCard({ prompt: 'Q?', answer: 'one\r\ntwo' }).why, 'Its answer runs over more than one line, and a card is one line of the list.', 'an answer of two lines');
eq([V.toCard({ prompt: 'a\tb', answer: 'A' }), V.toCard({ prompt: 'Q', answer: 'a\tb' }).why], [{ ok: false, why: 'It has a tab in it, and in this list a tab is what parts the front of a card from the back.' }, 'It has a tab in it, and in this list a tab is what parts the front of a card from the back.'], 'a tab inside either is refused, with its own reason');
eq([V.toCard(null).ok, V.toCard('text').ok, V.toCard({ prompt: 5, answer: 6 }).ok, V.toCard(undefined).why], [false, false, false, 'It has no question.'], 'what is not a question is refused, never thrown on');
{
  const made = V.cardsFrom([
    { id: 'q-1', prompt: 'One?', answer: '1', choices: ['1', '2'] }, { id: 'q-2', prompt: 'Two\nlines?', answer: '2' }, { id: 'q-3', prompt: 'Three?', answer: '' },
    { id: 'seed:053:b0', prompt: 'Four: a colon', answer: '4', media: 'pic' }, null, { id: 'q-5', prompt: 'Five?', answer: '5', media: null, choices: [] },
  ]);
  eq(made.cards.map(c => [c.id, c.line]), [['q-1', 'One?: 1'], ['seed:053:b0', 'Four: a colon\t4'], ['q-5', 'Five?: 5']], 'cardsFrom() makes the cards it can, in the questions\' order');
  eq(made.refused.map(r => [r.id, r.prompt, r.why]), [
    ['q-2', 'Two\nlines?', 'Its question runs over more than one line, and a card is one line of the list.'],
    ['q-3', 'Three?', 'It has no answer, so the back of the card would be blank.'], ['', '', 'It has no question.']], 'and names each it cannot, with the reason');
  eq([made.withChoices, made.withPicture], [1, 1], 'counting the cards whose question has choices or a picture, which a card does not show');
  eq(V.cardsFrom('nope'), { cards: [], refused: [], withChoices: 0, withPicture: 0 }, 'a list that is not one is no cards');
}
eq([V.appendLines('', ['a: 1', 'b: 2']), V.appendLines('x: 0', ['a: 1']), V.appendLines('x: 0\n\n\n', ['a: 1']), V.appendLines('  \n', ['a: 1']), V.appendLines('x: 0\n', []), V.appendLines(null, ['a: 1'])],
  ['a: 1\nb: 2', 'x: 0\na: 1', 'x: 0\na: 1', 'a: 1', 'x: 0\n', 'a: 1'], 'appendLines() puts the new lines after the list\'s own, one line each, and leaves a list alone when there are none');

eq([V.appendLines('x: 0\n\n\n', []), V.appendLines('x: 0', [])], ['x: 0\n\n\n', 'x: 0'], 'with nothing to add the list\'s text is returned untouched, its blank lines too');

// Every question that is made a card reads back as that card, whatever is in it.
{
  const r = rng(40), bits = ['a', 'B', ' ', ':', '|', ',', '"', '\t', '\n', 'é', '?', '=', '<b>', '  ', '-', '7', '\\'];
  const text = () => Array.from({ length: Math.floor(r() * 9) }, () => bits[Math.floor(r() * bits.length)]).join('');
  let made = 0, refused = 0, wrong = 0, lost = 0;
  for (let i = 0; i < 6000; i++) {
    const q = { prompt: text(), answer: text(), example: r() < 0.4 ? text() : '', pronunciation: r() < 0.3 ? text() : '', partOfSpeech: r() < 0.3 ? text() : '' };
    const c = V.toCard(q);
    if (!c.ok) { refused++; if (q.prompt.trim() && q.answer.trim() && !/[\t\r\n]/.test(q.prompt.trim() + q.answer.trim())) lost++; continue; }
    made++;
    const back = parse(c.line);
    if (back.length !== 1 || !isDeepStrictEqual(plain(back[0]), plain(c.item)) || c.item.term !== q.prompt.trim() || c.item.definition !== q.answer.trim()) wrong++;
  }
  ok(made > 1500 && refused > 1500, `the random questions exercise both outcomes (${made} made, ${refused} refused)`);
  eq(wrong, 0, 'every card made from a random question is read back by the page\'s parser as exactly that question and answer');
  eq(lost, 0, 'and no question with a one-line question and answer is refused');
}

// ---- a card as a question -------------------------------------------------------
console.log('VfgBank — a card as a question, and its id');
const LIST = 'Photosynthesis: process plants use to make food | Plants use it to grow | FOH-toh | noun\nMitosis: cell division\nNo definition yet:\nMitosis: a second meaning\n  mitosis : a third, in another case\nXylem\twater tubes';
{
  const made = V.toQuestions('Made-up Unit 4', parse(LIST));
  eq(made.questions.map(q => [q.prompt, q.answer, q.unit, q.example, q.pronunciation, q.partOfSpeech, q.sharedFrom]), [
    ['Photosynthesis', 'process plants use to make food', 'Made-up Unit 4', 'Plants use it to grow', 'FOH-toh', 'noun', 'vocab-flashcard-generator'],
    ['Mitosis', 'cell division', 'Made-up Unit 4', '', '', '', 'vocab-flashcard-generator'],
    ['Mitosis', 'a second meaning', 'Made-up Unit 4', '', '', '', 'vocab-flashcard-generator'],
    ['mitosis', 'a third, in another case', 'Made-up Unit 4', '', '', '', 'vocab-flashcard-generator'],
    ['Xylem', 'water tubes', 'Made-up Unit 4', '', '', '', 'vocab-flashcard-generator']],
    'the term is the question, the definition the answer, the list\'s name the unit; the three extras ride along');
  eq(made.skipped, [{ term: 'No definition yet', why: 'It has no definition, so there is no answer to store.' }], 'a card with no definition is not a question, and is named');
  const ids = made.questions.map(q => q.id);
  eq([new Set(ids).size, ids.every(id => /^vfg-[a-z0-9]+-[a-z0-9]+(~\d+)?$/.test(id)), ids.some(W.QuestionBank.isSeedId)], [5, true, false], 'each has an id of its own, none a seed\'s');
  eq([ids[2], ids[3]], [ids[1] + '~2', ids[1] + '~3'], 'a term the list has more than once is told apart by its place among them, letter case aside');
  eq(V.toQuestions('Made-up Unit 4', parse(LIST)).questions.map(q => q.id), ids, 'the same list again gives the same ids');
  eq(V.toQuestions('  made-up   unit 4 ', parse(LIST)).questions.map(q => q.id), ids, 'and so does its name in another case or spacing');
  ok(V.toQuestions('Made-up Unit 5', parse(LIST)).questions.every((q, i) => q.id !== ids[i]), 'another list\'s cards have other ids');
  eq(V.cardId('L', 'Term', 1), V.cardId('l', ' term ', 0), 'cardId() is the list and the term, folded');
  ok(V.cardId('ab', 'c', 1) !== V.cardId('a', 'bc', 1), 'the list and the term are hashed apart: "ab"+"c" is not "a"+"bc"');
  eq(V.toQuestions('L', [null, {}, { term: ' ' }, 'x']), { questions: [], skipped: [] }, 'what is not a card is passed over');
  eq(V.toQuestions('L', parse('A:\nA: x')).questions.map(q => q.id), [V.cardId('L', 'A', 2)], 'a repeated term\'s place counts the card with no definition, so giving that one a definition later moves no id');
  // no two of many made-up terms share an id
  const r = rng(7), seen = new Set();
  for (let i = 0; i < 20000; i++) seen.add(V.cardId('List ' + Math.floor(r() * 40), 'term' + i + '-' + Math.floor(r() * 1e6), 1));
  eq(seen.size, 20000, '20,000 made-up terms have 20,000 ids');
}

// ---- the bank's own add path ----------------------------------------------------
console.log('VfgBank — sending a list, by the bank\'s own merge');
{
  const storage = fakeStorage(), win = page(storage), QB = win.QuestionBank, B = win.VfgBank;
  QB.saveQuestion({ id: 'q-mine', prompt: 'mitosis', answer: 'Cell  division' }, { now: 'T0' });       // the teacher's own, same words
  storage.writes.length = 0;
  const made = B.toQuestions('Made-up Unit 4', win.VocabLayout.parseWordList(LIST));
  const steps = B.plan(QB, QB.peek(), made.questions);
  eq(steps.map(s => s.what), ['new', 'there', 'new', 'new', 'new'], 'plan(): a card whose words the bank already has under another id is "there"; the rest are new');
  eq(storage.writes, [], 'plan() stores nothing');
  const first = QB.importQuestions(made.questions, { now: 'T1' });
  eq([first.ok, first.added, first.updated, first.same, first.skipped, QB.list().length], [true, 4, 0, 0, 1, 5], 'importQuestions() does what plan() said');
  eq(plain(QB.list()[0]), plain(QB.normalize({ id: 'q-mine', prompt: 'mitosis', answer: 'Cell  division', createdAt: 'T0' })), 'the teacher\'s own question is untouched');
  const stored = plain(QB.list()[1]);
  eq([stored.id, stored.prompt, stored.answer, stored.unit, stored.example, stored.pronunciation, stored.partOfSpeech, stored.sharedFrom, stored.createdAt],
    [made.questions[0].id, 'Photosynthesis', 'process plants use to make food', 'Made-up Unit 4', 'Plants use it to grow', 'FOH-toh', 'noun', 'vocab-flashcard-generator', 'T1'],
    'a stored card is a full question in the bank\'s shape, with 040\'s extras carried');
  eq(QB.validate(stored), [], 'and the bank finds nothing wrong with it');
  const snapshot = storage.getItem(QB.KEY);
  storage.writes.length = 0;
  eq(B.plan(QB, QB.peek(), made.questions).map(s => s.what), ['same', 'there', 'same', 'same', 'same'], 'plan() for the same list again: every card is there');
  const second = QB.importQuestions(B.toQuestions('Made-up Unit 4', win.VocabLayout.parseWordList(LIST)).questions, { now: 'T2' });
  eq([second.added, second.updated, second.same, second.skipped, storage.writes, storage.getItem(QB.KEY) === snapshot], [0, 0, 4, 1, [], true], 'the same list sent twice adds nothing, changes nothing and writes nothing');
  // a definition edited since: that question changes where it stands
  const edited = B.toQuestions('Made-up Unit 4', win.VocabLayout.parseWordList(LIST.replace('water tubes', 'tubes that carry water'))).questions;
  eq(B.plan(QB, QB.peek(), edited).map(s => s.what), ['same', 'there', 'same', 'same', 'changed'], 'a definition edited since is "changed"');
  const order = QB.list().map(q => q.id);
  const third = QB.importQuestions(edited, { now: 'T3' });
  eq([third.added, third.updated, QB.list().map(q => q.id), plain(QB.list()[4]).answer, plain(QB.list()[4]).createdAt, plain(QB.list()[4]).updatedAt],
    [0, 1, order, 'tubes that carry water', 'T1', 'T3'], 'and changes that one question in place: same id, same place, its first date kept');
  // the list renamed: new ids, but the bank has every card's words
  const renamed = B.toQuestions('Unit 4, renamed', win.VocabLayout.parseWordList(LIST.replace('water tubes', 'tubes that carry water'))).questions;
  eq(B.plan(QB, QB.peek(), renamed).map(s => s.what), ['there', 'there', 'there', 'there', 'there'], 'a renamed list has new ids, and the bank skips every card whose words it holds');
  eq(QB.importQuestions(renamed, { now: 'T4' }).added, 0, 'so that adds nothing either');
  // a new term is a new question
  const more = B.toQuestions('Made-up Unit 4', win.VocabLayout.parseWordList(LIST + '\nPhloem: sugar tubes')).questions;
  eq(B.plan(QB, QB.peek(), more).map(s => s.what).slice(-1), ['new'], 'a term added to the list is the one new question');
  eq([QB.importQuestions(more, { now: 'T5' }).added, QB.list().length], [1, 6], 'and is the one added');
  // a list with the same card twice: the second is there once the first is added
  const twice = B.toQuestions('Twice', win.VocabLayout.parseWordList('Echo: a repeat\nEcho: a repeat')).questions;
  eq([B.plan(QB, QB.peek(), twice).map(s => s.what), QB.importQuestions(twice, { now: 'T6' }).added], [['new', 'there'], 1], 'plan() goes card by card as the bank would: a card the list has twice is added once');
  eq(QB.VERSION, 1, 'the bank\'s version is still 1');
  eq(JSON.parse(storage.getItem(QB.KEY)).v, 1, 'and so is the stored envelope\'s');
}

// ---- the round trip -------------------------------------------------------------
console.log('VfgBank — the round trip');
{
  const storage = fakeStorage(), win = page(storage), QB = win.QuestionBank, B = win.VfgBank;
  // bank -> cards -> bank
  [['What is the capital of Peru?', 'Lima'], ['Solve: 3x + 4 = 19', 'x = 5'], ['Which is a base?', 'NaOH | not HCl'], ['¿Cómo se dice "library"?', 'la biblioteca']]
    .forEach(([prompt, answer], i) => QB.saveQuestion({ prompt, answer, unit: 'Unit 1', points: 100 * i }, { now: 'T0' }));
  const before = storage.getItem(QB.KEY);
  const cards = B.cardsFrom(QB.peek());
  eq(cards.refused, [], 'four ordinary bank questions all become cards');
  const words = B.appendLines('', cards.cards.map(c => c.line));
  const back = B.toQuestions('From the bank', win.VocabLayout.parseWordList(words));
  eq(back.questions.map(q => [q.prompt, q.answer]), QB.peek().map(q => [q.prompt, q.answer]), 'the cards read back as the same questions and answers');
  eq(B.plan(QB, QB.peek(), back.questions).map(s => s.what), ['there', 'there', 'there', 'there'], 'sent back, each is already there');
  storage.writes.length = 0;
  const res = QB.importQuestions(back.questions);
  eq([res.added, res.updated, storage.writes, storage.getItem(QB.KEY) === before], [0, 0, [], true], 'so the round trip adds nothing and the bank is byte for byte what it was');
  // cards -> bank -> cards
  const made = B.toQuestions('Made-up Unit 4', win.VocabLayout.parseWordList(LIST));
  QB.importQuestions(made.questions, { now: 'T1' });
  const mine = QB.filter(QB.peek(), { unit: 'Made-up Unit 4' });
  eq(B.cardsFrom(mine).cards.map(c => c.item), win.VocabLayout.parseWordList(LIST).filter(c => c.definition), 'a list sent to the bank comes back as the cards it was, all five fields');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
