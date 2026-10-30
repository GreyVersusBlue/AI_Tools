// qsource.test.mjs — Name Picker: np-question-source.js and the `qid` on a history entry (Path 15 P4). Pure Node.
//
//   node Tools/name-picker/test/qsource.test.mjs
//
// A bank question becomes a prompt: its words only, never the answer; a seed id is never stored; the bag asks every
// question once before repeating; np-store keeps `qid` on an entry that has a prompt and on nothing else; an old entry reads
// exactly as it did.

import * as Q from '../np-question-source.js';
import { createStore, memoryStorage } from '../np-store.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 400) + '\n    want ' + JSON.stringify(b).slice(0, 400)); }
};
const ok = (c, label) => { if (c) passed++; else { failed++; console.log('  FAIL ' + label); } };

/* ---- keepId ---- */
eq(Q.keepId('q_abc123'), 'q_abc123', 'a bank id is kept');
eq(Q.keepId('  q_1  '), 'q_1', 'and trimmed');
eq(Q.keepId('seed:ctcg:12'), '', 'a built-in set id is never kept');
eq(Q.keepId('SEED:x'), '', 'in any case');
eq(Q.keepId('x'.repeat(81)), '', 'an id past 80 characters is not kept');
eq(Q.keepId('x'.repeat(80)).length, 80, 'one of exactly 80 is');
eq([Q.keepId(null), Q.keepId(undefined), Q.keepId(7)], ['', '', '7'], 'a missing id is nothing; a number is its text');

/* ---- toPrompt: words only ---- */
const q1 = { id: 'q1', prompt: '  What is\n  the capital of France? ', answer: 'Paris', choices: ['Paris', 'Rome'], media: { image: 'data:image/png;base64,AAAA' }, unit: 'Geo' };
const p1 = Q.toPrompt(q1);
eq(p1, { text: 'What is the capital of France?', qid: 'q1' }, 'whitespace collapses; the id rides along');
ok(!JSON.stringify(p1).includes('Paris') && !JSON.stringify(p1).includes('data:'), 'the answer, choices and picture never reach the prompt');
eq(Q.toPrompt({ id: 'seed:g:1', prompt: 'A built-in one' }), { text: 'A built-in one', qid: '' }, 'a seed question gives its words and no id');
eq(Q.toPrompt({ id: 'q', prompt: '   ' }), null, 'a question with no words is nothing');
eq([Q.toPrompt(null), Q.toPrompt('x'), Q.toPrompt([])], [null, null, null], 'junk is nothing');
eq(Q.toPrompt({ id: 'q', prompt: 'y'.repeat(500) }).text.length, 300, 'the words are cut to the history cap');

/* ---- usable / idFor ---- */
const bank = [q1, { id: 'q2', prompt: 'Name a river.', answer: 'Seine' }, { id: 'q3', prompt: '' }, { id: 'q4', prompt: 'name a river.', answer: 'x' }, { id: 'q5', prompt: 'Name a river.' }];
const items = Q.usable(bank);
eq(items.map(i => i.qid), ['q1', 'q2', 'q4'], 'blank questions go and an exact repeat of the words goes (case differs, so it stays)');
eq(Q.usable(null), [], 'no list, no items');
eq(Q.idFor(items, 'Name a river.'), 'q2', 'idFor finds the id of exact text');
eq(Q.idFor(items, 'Name a river'), '', 'and nothing for text that is not there');
eq(Q.idFor([], 'x'), '', 'an empty list has none');

/* ---- the bag ---- */
let seed = 3; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ten = Array.from({ length: 10 }, (_, i) => ({ text: 'Q' + i, qid: 'id' + i }));
const bag = Q.createBag(ten, rng);
eq(bag.size(), 10, 'size is the item count');
let allRounds = true, noRepeat = true, prev = null;
for (let round = 0; round < 200; round++) {
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const it = bag.next();
    if (seen.has(it.text)) allRounds = false;
    seen.add(it.text);
    if (i === 0 && prev && prev.text === it.text) noRepeat = false;
    prev = it;
  }
  if (seen.size !== 10) allRounds = false;
}
ok(allRounds, 'in 200 rounds every question is asked exactly once per round');
ok(noRepeat, 'and the first question of a round is never the last of the one before');
const one = Q.createBag([ten[0]], rng);
eq([one.next().text, one.next().text, one.next().text], ['Q0', 'Q0', 'Q0'], 'one question repeats (there is nothing else to ask)');
eq(Q.createBag([], rng).next(), null, 'an empty bag gives null');
const two = Q.createBag(ten.slice(0, 2), rng);
const seq = Array.from({ length: 40 }, () => two.next().text);
ok(seq.every((t, i) => i === 0 || t !== seq[i - 1]), 'two questions alternate: never the same one twice running');
bag.reset(ten.slice(0, 3));
eq([bag.size(), new Set([bag.next().text, bag.next().text, bag.next().text]).size], [3, 3], 'reset swaps the list and starts a fresh round');
const items2 = ten.slice();
const bag2 = Q.createBag(items2, rng); bag2.next();
items2.length = 0;
eq(bag2.size(), 10, 'the bag copies its list: changing the caller’s array changes nothing');

/* ---- np-store: qid on a history entry ---- */
const store = createStore({ storage: memoryStorage() });
const when = { time: '09:00 AM', date: '2026-10-29' };
store.set('history', [
  { name: 'Ada', ...when },
  { name: 'Bo', ...when, prompt: 'A typed one' },
  { name: 'Cy', ...when, prompt: 'From the bank', qid: 'q_9' },
  { name: 'Di', ...when, prompt: 'Built in', qid: 'seed:ctcg:3' },
  { name: 'Ed', ...when, qid: 'q_orphan' },
  { name: 'Fay', ...when, prompt: 'Too long id', qid: 'z'.repeat(81) },
  { name: 'Gus', ...when, prompt: 'Not a string', qid: 42 }
]);
const h = store.get('history');
eq(h.map(e => e.qid || null), [null, null, 'q_9', null, null, null, null], 'qid survives only on an entry with a prompt and a teacher’s own id of a sane length');
eq(h[1], { name: 'Bo', time: '09:00 AM', date: '2026-10-29', prompt: 'A typed one' }, 'a typed-prompt entry reads exactly as before');
eq(h[0], { name: 'Ada', time: '09:00 AM', date: '2026-10-29' }, 'and so does a plain one');
eq(h[2], { name: 'Cy', time: '09:00 AM', date: '2026-10-29', prompt: 'From the bank', qid: 'q_9' }, 'a bank entry is name, time, date, prompt, qid');

console.log(`qsource: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
