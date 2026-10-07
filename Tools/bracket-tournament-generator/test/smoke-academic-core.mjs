// smoke-academic-core.mjs — pure-logic tests for bt-academic.js (Path 12 P2):
// the deal, the score and the cleaning of a bracket's `academic` field, which
// is all of 020's academic-tournament mode that is not the page.
//
//   node Tools/bracket-tournament-generator/test/smoke-academic-core.mjs   (or: npm run test:bracket-academic-core)
//
// The script is a classic one that publishes a global, so it runs here in a
// vm context. The random cases take a seeded generator. Every id and name
// here is made up. The browser half is smoke-academic.mjs.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({});
ctx.window = ctx;
// BT_ACADEMIC_FILE names another copy of the module (a deliberately broken one).
vm.runInContext(fs.readFileSync(process.env.BT_ACADEMIC_FILE || path.join(here, '..', 'bt-academic.js'), 'utf8'), ctx);
const A = ctx.BtAcademic;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ids = n => Array.from({ length: n }, (_, i) => 'q-' + i);

console.log('bt-academic.js — the seed and a new mode');
eq(A.newSeed(() => 0), 1, 'the lowest seed is 1');
eq(A.newSeed(() => 0.9999999999), 2147483646, 'the highest seed is 2147483646');
eq(A.newSeed(() => NaN), 1, 'a random source that gives no number still gives a seed');
eq(A.fresh(() => 0.5), { on: true, seed: 1073741824, source: '', unit: '', per: 3, drawn: {}, marks: {} }, 'a new mode: on, a seed, the bank, every unit, three a match, nothing dealt');

console.log('bt-academic.js — clean()');
const GOOD = { on: true, seed: 42, source: '053', unit: 'Hispanic World', per: 4, drawn: { '0_0': ['seed:053:b1', 'seed:053:b2'], g0: ['q-1'] }, marks: { '0_0': { 'seed:053:b1': 'a', 'seed:053:b2': 'n' } } };
eq(A.clean(GOOD), GOOD, 'a well-formed field comes back as it is');
eq(A.clean(A.clean(GOOD)), GOOD, 'and cleaning it twice changes nothing');
ok(A.clean(GOOD) !== GOOD && A.clean(GOOD).drawn['0_0'] !== GOOD.drawn['0_0'], 'as a copy, not the same object');
for (const junk of [null, undefined, 'x', 7, [], { on: true }, { seed: 0 }, { seed: -3 }, { seed: 'abc' }, { seed: 2147483647 }, { seed: Infinity }]) {
  eq(A.clean(junk), null, 'not a mode: ' + JSON.stringify(junk));
}
eq(A.clean({ seed: 5.9 }), { on: false, seed: 5, source: '', unit: '', per: 3, drawn: {}, marks: {} }, 'a bare seed is a mode that is off, with the defaults');
eq(A.clean({ seed: 5, on: 'yes' }).on, false, 'on is true only for true');
eq(A.clean({ seed: 5, on: 1 }).on, false, 'and not for 1');
eq([0, -2, 'x', 21, 99, 7.8, '4'].map(per => A.clean({ seed: 5, per }).per), [3, 3, 3, 20, 20, 7, 4], 'questions a match: a whole number from 1 to 20, or three');
eq(A.clean({ seed: 5, source: 'x'.repeat(200), unit: 'u'.repeat(300) }).source.length + '/' + A.clean({ seed: 5, source: 'x'.repeat(200), unit: 'u'.repeat(300) }).unit.length, '80/120', 'a source and a unit are cut to their limits');
eq(A.clean({ seed: 5, source: 9, unit: {} }).source + '|' + A.clean({ seed: 5, source: 9, unit: {} }).unit, '|', 'and are text or nothing');
eq(Object.keys(A.clean({ seed: 5, extra: 1, html: '<img>', name: 'x' })), ['on', 'seed', 'source', 'unit', 'per', 'drawn', 'marks'], 'a field it does not know is dropped');
{
  const raw = JSON.parse('{"seed":5,"drawn":{"__proto__":["a"],"0_0":["a","a","",7,null,"b"],"A B":["x"],"<img>":["x"],"1_1":"abc","2_2":[],"' + 'k'.repeat(41) + '":["x"]}}');
  const c = A.clean(raw);
  eq(c.drawn, { '0_0': ['a', 'b'] }, 'drawn keeps only match keys, and in each only text ids, each once');
  ok(!('length' in c.drawn) && !('a' in c.drawn), 'and a __proto__ key does not become the list\'s prototype');
  eq(A.clean({ seed: 5, drawn: { constructor: ['x'], toString: ['x'], '0_0_0': ['x'], 'pool1_0_0': ['x'], g2: ['x'], '1234_0': ['x'] } }).drawn, {}, 'nor is any key kept that is not one of the page\'s score keys');
  eq(Object.keys(A.clean({ seed: 5, drawn: { '0_0': ['x'], rr1_2: ['x'], w0_1: ['x'], l3_0: ['x'], g0: ['x'], g1: ['x'], pool1_rr0_2: ['x'], br_1_0: ['x'] } }).drawn).length, 8, 'every kind of score key the page writes is kept');
}
eq(A.clean({ seed: 5, drawn: { '0_0': ['x'.repeat(201), 'ok'] } }).drawn, { '0_0': ['ok'] }, 'an id over 200 characters is dropped');
eq(A.clean({ seed: 5, drawn: { '0_0': ids(60) } }).drawn['0_0'].length, 40, 'a match holds at most 40 questions');
{
  const many = {}; for (let i = 0; i < 700; i++) many['rr' + i + '_0'] = ['q'];
  eq(Object.keys(A.clean({ seed: 5, drawn: many }).drawn).length, 600, 'and a bracket at most 600 dealt matches');
}
eq(A.clean({ seed: 5, drawn: { '0_0': ['a', 'b'] }, marks: { '0_0': { a: 'a', b: 'x', c: 'b' }, '1_0': { a: 'a' }, '0_1': 'n' } }).marks, { '0_0': { a: 'a' } }, 'marks are kept only for a dealt question of a dealt match, and only a, b or n');
eq(A.clean({ seed: 5, drawn: { '0_0': ['a'] }, marks: { '0_0': { a: '<b>' } } }).marks, {}, 'a match with no mark left has no marks entry');
eq(A.clean({ seed: 5, drawn: { '0_0': ['constructor'] }, marks: { '0_0': {} } }).marks, {}, 'a question id that is a property of every object is not marked by that');

console.log('bt-academic.js — order()');
{
  const list = ids(30), o = A.order(42, list);
  eq(o.slice().sort(), list.slice().sort(), 'the order holds every id once');
  eq(A.order(42, list), o, 'the same seed gives the same order');
  eq(A.order(42, list.slice().reverse()), o, 'whatever order the source lists them in');
  ok(JSON.stringify(A.order(43, list)) !== JSON.stringify(o), 'another seed gives another order');
  ok(JSON.stringify(o) !== JSON.stringify(list), 'and it is not the source\'s own order');
  eq(A.order(42, list.concat(['q-new'])).filter(id => id !== 'q-new'), o, 'a question added later slots in without moving the rest');
  eq(A.order(42, ['a', 'a', '', 7, null, 'b']).slice().sort(), ['a', 'b'], 'ids are text, each once');
  eq(A.order(42, null), [], 'no list, no order');
  eq(A.order(1, ['e', 'd', 'c', 'b', 'a']), ['c', 'a', 'd', 'e', 'b'], 'a pinned order: seed 1 over a to e');
  eq(A.order(11, ['a', 'b', 'c', 'd', 'e']), ['b', 'a', 'e', 'd', 'c'], 'and seed 11');
}

console.log('bt-academic.js — deal()');
{
  const ac = { seed: 9, per: 3, drawn: {}, marks: {} }, o = A.order(9, ids(10));
  const before = JSON.stringify(ac);
  const d1 = A.deal(ac, '0_0', o, 3);
  eq(JSON.stringify(ac), before, 'deal() does not change the mode it is given');
  eq(d1, { ids: o.slice(0, 3), added: 3, repeats: 0, short: 0 }, 'the first match gets the first three of the order');
  ac.drawn['0_0'] = d1.ids;
  const d2 = A.deal(ac, '0_1', o, 3);
  eq(d2.ids, o.slice(3, 6), 'the second gets the next three');
  ac.drawn['0_1'] = d2.ids;
  ac.drawn['0_2'] = A.deal(ac, '0_2', o, 3).ids;
  eq(ac.drawn['0_2'], o.slice(6, 9), 'the third the three after');
  const d4 = A.deal(ac, '0_3', o, 3);
  eq(d4, { ids: [o[9], o[0], o[1]], added: 3, repeats: 2, short: 0 }, 'the fourth takes the last unused one, then goes round again, and says two repeat');
  eq(new Set(d4.ids).size, 3, 'never the same question twice in one match');
  ac.drawn['0_3'] = d4.ids;
  const tie = A.deal(ac, '0_0', o, 1);
  eq(tie, { ids: o.slice(0, 3).concat([o[3]]), added: 1, repeats: 1, short: 0 }, 'a tiebreak adds one question the match does not hold, after its own');
  eq(ac.drawn['0_0'], o.slice(0, 3), 'and the match\'s stored list is not changed by asking');
  eq(A.repeatsIn(ac, '0_3'), 2, 'repeatsIn() counts a match\'s questions another match holds');
  eq(A.repeatsIn(ac, '0_2'), 0, 'and none for a match whose questions are its own');
  eq(A.repeatsIn(ac, 'nope'), 0, 'and none for a match never dealt');
  eq(A.deal({ drawn: {} }, 'g0', ['a', 'b'], 5), { ids: ['a', 'b'], added: 2, repeats: 0, short: 3 }, 'a source with fewer than asked gives what it has and says how many are missing');
  eq(A.deal({ drawn: {} }, 'g0', [], 3), { ids: [], added: 0, repeats: 0, short: 3 }, 'an empty source gives nothing');
  eq(A.deal({ drawn: { g0: ['a', 'b'] } }, 'g0', ['a', 'b'], 1), { ids: ['a', 'b'], added: 0, repeats: 0, short: 1 }, 'a tiebreak with no other question adds nothing');
  eq(A.deal({ drawn: {} }, 'g0', ['a', 'b'], 0).ids, [], 'asking for none gives none');
  eq(A.deal({ drawn: {} }, 'g0', ['a', 'b'], 'x').ids, [], 'as does asking for no number');
}
{
  // The property: until the source runs out, no question is in two matches.
  const r = rng(20261007);
  let cases = 0, bad = 0, early = 0, dupIn = 0, wrongLen = 0;
  for (let t = 0; t < 400; t++) {
    const count = 1 + Math.floor(r() * 40), per = 1 + Math.floor(r() * 6), matches = 1 + Math.floor(r() * 12);
    const seed = A.newSeed(r), o = A.order(seed, ids(count)), ac = { drawn: {} };
    const covers = A.supply(count, per);
    for (let m = 0; m < matches; m++) {
      const d = A.deal(ac, 'rr0_' + m, o, per);
      ac.drawn['rr0_' + m] = d.ids;
      if (new Set(d.ids).size !== d.ids.length) dupIn++;
      if (d.ids.length !== Math.min(per, count)) wrongLen++;
      if (m < covers && d.repeats) early++;
      if (m < covers && A.repeatsIn(ac, 'rr0_' + m)) bad++;
    }
    cases++;
  }
  eq([cases, bad, early, dupIn, wrongLen], [400, 0, 0, 0, 0], '400 random brackets: no repeat before the source runs out, none inside a match, every match the right length');
}
eq([A.supply(10, 3), A.supply(9, 3), A.supply(2, 3), A.supply(0, 3), A.supply(-4, 3), A.supply(10, 0)], [3, 3, 0, 0, 0, 3], 'supply(): whole matches a source covers before a repeat');

console.log('bt-academic.js — score() and outcome()');
{
  const ac = { drawn: { '0_0': ['a', 'b', 'c', 'd', 'e'] }, marks: { '0_0': { a: 'a', b: 'a', c: 'b', d: 'n', zz: 'a', e: 'x' } } };
  eq(A.score(ac, '0_0'), { a: 2, b: 1, marked: 4, total: 5, done: false }, 'a point a question to the side that got it, none for neither; a mark that is not a, b or n, or for a question not dealt, counts for nothing');
  eq(A.outcome(A.score(ac, '0_0')), 'open', 'open until every question is marked');
  ac.marks['0_0'].e = 'b';
  eq(A.score(ac, '0_0'), { a: 2, b: 2, marked: 5, total: 5, done: true }, 'all five marked');
  eq(A.outcome(A.score(ac, '0_0')), 'tie', 'two each is a tie');
  ac.marks['0_0'].d = 'b';
  eq(A.outcome(A.score(ac, '0_0')), 'b', 'three to two is the second side\'s');
  ac.marks['0_0'] = { a: 'a', b: 'n', c: 'n', d: 'n', e: 'n' };
  eq(A.outcome(A.score(ac, '0_0')), 'a', 'one to nothing is the first side\'s');
  eq(A.score(ac, 'g0'), { a: 0, b: 0, marked: 0, total: 0, done: false }, 'a match with no questions is never done');
  eq(A.outcome(A.score(ac, 'g0')), 'open', 'so it is open, not a tie');
  eq(A.score({ drawn: { g0: ['toString'] }, marks: { g0: {} } }, 'g0').marked, 0, 'an id that is a property of every object is not a mark');
  eq(A.score({}, 'g0').total, 0, 'a mode with nothing in it scores nothing');
  eq(A.outcome(null), 'open', 'no score is open');
}

console.log('bt-academic.js — matchTitle()');
eq(['0_0', '2_3', 'rr1_2', 'w0_1', 'l3_0', 'g0', 'g1', 'pool1_rr0_2', 'br_1_0', 'zzz'].map(A.matchTitle), [
  'Round 1, match 1', 'Round 3, match 4', 'Round 2, match 3', 'Winners bracket round 1, match 2', 'Losers bracket round 4, match 1',
  'Grand final', 'Grand final, bracket reset', 'Pool 2, round 1, match 3', 'Bracket round 2, match 1', 'Match',
], 'a heading for every kind of score key the page writes');
ok(/one point/.test(A.RULE) && /tie decides nothing/i.test(A.RULE) && /pick the winner/.test(A.RULE), 'the rule says a point a question, that a tie decides nothing, and that a winner can be picked');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
