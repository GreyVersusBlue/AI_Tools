// worksheets-logic.test.mjs — pure-logic checks for cffb-worksheets.js (BACKLOG rank 85):
// matching, fill in the blank and trap-or-true worksheets for 052, and the answer key that
// shares each one's model. No browser, no clock, no Math.random.
//
//   node Tools/cognates-false-friends-builder/test/worksheets-logic.test.mjs
//   CFFB_MODULE=<path> node ...   runs the same checks on a broken copy (how the mutants are shown)
//
// Exits 1 on any failure. Every word here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.CFFB_MODULE || path.join(dir, '..', 'cffb-worksheets.js');
const shim = {};
new Function('globalThis', fs.readFileSync(file, 'utf8'))(shim);
const W = shim.CffbWorksheets;

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

const mk = (nc, nf) => ({
  lang: 'Zorbish',
  cognates: Array.from({ length: nc }, (_, i) => ({ id: 'c' + i, target: 'cw' + i, english: 'ce' + i })),
  falseFriends: Array.from({ length: nf }, (_, i) => ({ id: 'f' + i, target: 'fw' + i, looksLike: 'fl' + i, actual: 'Actually means "fm' + i + '" (note).' }))
});
const state = mk(7, 6);

// ---- meaningOf
eq(W.meaningOf({ actual: 'Actually means "pregnant."' }), 'pregnant', 'meaning inside quotes, full stop outside');
eq(W.meaningOf({ actual: 'Actually means "to get/receive" (to become is "werden").' }), 'to get/receive', 'first quoted meaning wins over the parenthetical');
eq(W.meaningOf({ actual: 'Actually means “soup”' }), 'soup', 'curly quotes');
eq(W.meaningOf({ actual: 'a kind of soup.' }), 'a kind of soup', 'no quotes: used whole, final full stop dropped');
eq(W.meaningOf({ actual: 'Actually means: a kind of soup' }), 'a kind of soup', 'leading phrase with a colon dropped');
eq(W.meaningOf({ actual: '' }), '', 'empty');

// ---- items: blank rows are not items
eq(W.items({ cognates: [{ target: '', english: '' }, { target: 'a', english: '' }, { target: 'b', english: 'B' }], falseFriends: [{ target: '', looksLike: '', actual: '' }, { target: 'x', looksLike: 'y', actual: '' }] }).map(i => i.word), ['b'], 'only rows with a word and a meaning count');

// ---- too few
let m = W.model(mk(1, 0), 'match', 'A');
ok(!m.ok && m.reason === 'too-few' && m.minItems === 2 && m.have === 1, 'matching needs two entries');
m = W.model(mk(1, 0), 'trap', 'A');
ok(m.ok, 'trap needs only one');
ok(!W.model(mk(0, 0), 'trap', 'A').ok, 'trap with none is refused');
ok(!W.model({ cognates: [{ target: '', english: '' }], falseFriends: [{ target: '', looksLike: '', actual: '' }] }, 'blank', 'A').ok, 'the blank starter row is not a worksheet');

// ---- matching: groups of at most 10, each key correct, every word once
m = W.model(state, 'match', 'A');
ok(m.ok && m.kind === 'match' && m.variant === 'A', 'matching model');
eq(m.groups.map(g => g.words.length), [10, 3], '13 entries are two groups, 10 and 3');
const truth = new Map(W.items(state).map(i => [i.word, i.meaning]));
let seen = new Set(), keyOk = true, numsOk = true, letterOk = true, notAllOpposite = true;
m.groups.forEach(g => {
  eq(g.meanings.length, g.words.length, 'one meaning per word');
  g.key.forEach(k => {
    seen.add(k.word);
    const shown = g.meanings.find(x => x.letter === k.letter);
    if (!shown || shown.text !== truth.get(k.word) || k.meaning !== truth.get(k.word)) keyOk = false;
    const w = g.words.find(x => x.word === k.word);
    if (!w || w.n !== k.n) numsOk = false;
  });
  if (!g.meanings.every((x, i) => x.letter === 'ABCDEFGHIJ'[i])) letterOk = false;
  if (g.words.every((w, i) => g.key[i].letter === g.meanings[i].letter && g.meanings[i].text === truth.get(w.word))) notAllOpposite = false;
});
ok(keyOk, 'every key letter points at the meaning of that word');
ok(numsOk, 'key numbers equal the worksheet numbers');
ok(letterOk, 'letters run A, B, C in order down the right');
ok(notAllOpposite, 'a group is never in the answer order');
eq([...seen].sort(), [...truth.keys()].sort(), 'every word appears exactly once');
eq(m.groups.flatMap(g => g.words.map(w => w.n)), Array.from({ length: 13 }, (_, i) => i + 1), 'numbers run 1..13 across groups');
// the pair case: two entries must not come out in answer order
for (const v of W.VARIANTS) {
  const g = W.model(mk(2, 0), 'match', v).groups[0];
  ok(g.words.some((w, i) => g.meanings[i].text !== truth0(w.word)), 'two entries are swapped, variant ' + v);
}
function truth0(w) { return 'ce' + w.slice(2); }

// ---- determinism and variants
eq(W.model(state, 'match', 'A'), W.model(state, 'match', 'A'), 'same list, same variant: same sheet');
eq(W.model(state, 'match', 'b'), W.model(state, 'match', 'B'), 'variant letters are case-insensitive');
eq(W.model(state, 'match', 'zzz').variant, 'A', 'an unknown variant is A');
const orders = W.VARIANTS.map(v => JSON.stringify(W.model(state, 'match', v).groups[0].words.map(w => w.word)));
eq(new Set(orders).size, 4, 'four variants, four different word orders');
const changed = JSON.parse(JSON.stringify(state)); changed.cognates[0].english = 'other';
ok(JSON.stringify(W.model(changed, 'match', 'A')) !== JSON.stringify(W.model(state, 'match', 'A')), 'a changed meaning changes the sheet');

// ---- fill in the blank
m = W.model(state, 'blank', 'B');
ok(m.ok && m.rows.length === 13 && m.bank.length === 13, 'blank: a sentence and a bank word per entry');
eq([...m.bank].sort(), [...truth.keys()].sort(), 'the bank is exactly the answers');
ok(m.rows.every(r => r.sentence.split('______').length === 2), 'one blank in each sentence');
ok(m.rows.every(r => !r.sentence.includes(r.answer)), 'no sentence gives its own answer away');
ok(m.rows.every(r => r.sentence.includes(truth.get(r.answer))), 'each sentence carries the meaning of its answer');
ok(m.rows.filter(r => r.answer.startsWith('fw')).every(r => /looks like “fl\d”/.test(r.sentence)), 'a false friend’s sentence names what it looks like');
ok(m.rows.filter(r => r.answer.startsWith('cw')).every(r => /Zorbish word ______ means/.test(r.sentence)), 'a cognate’s sentence is the plain one');
eq(m.rows.map(r => r.n), Array.from({ length: 13 }, (_, i) => i + 1), 'numbered 1..13');

// ---- trap or true
m = W.model(state, 'trap', 'C');
ok(m.ok && m.rows.length === 13, 'trap: a row per entry');
ok(m.rows.every(r => (r.answer === 'false') === r.word.startsWith('fw')), 'false friends are the traps, nothing else');
ok(m.rows.filter(r => r.answer === 'false').every(r => r.meaning === 'fm' + r.word.slice(2)), 'a trap carries its real meaning');
ok(m.rows.filter(r => r.answer === 'true').every(r => r.meaning === ''), 'a true cognate carries no “really means”');
ok(m.rows.every(r => r.lookalike === (r.word.startsWith('fw') ? 'fl' : 'ce') + r.word.slice(2)), 'the look-alike is the English column or the “looks like” column');
const lang = W.model({ cognates: [{ target: 'a', english: 'b' }], falseFriends: [] }, 'trap', 'A');
eq(lang.lang, 'Target Language', 'a list with no language name still has a heading');

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
