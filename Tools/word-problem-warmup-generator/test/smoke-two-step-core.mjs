// smoke-two-step-core.mjs — 081's two-step word problems, in pure Node.
//
//   node Tools/word-problem-warmup-generator/test/smoke-two-step-core.mjs
//
// wp-twostep.js makes a problem from a seeded rng. This draws tens of thousands
// of them and checks every one WITHOUT trusting the generator's own answer:
//   - the numbers in the story, read back out of its text, give the answer by
//     a formula written here for each kind (the text and the key agree);
//   - each step's arithmetic is redone here, step two uses step one's result,
//     and the key line is the steps written out;
//   - no step goes below 1, no division leaves a remainder except in the two
//     remainder kinds (which always do), nothing is fractional;
//   - every number the story gives is inside the grades 6-8 range for what it
//     is, and none is 1 (so no noun is singular), and no digit appears in the
//     text that is not one of the given numbers;
//   - the same seed makes the same problems, every kind turns up, two names in
//     a story differ, and the effective-mode rule keeps grades 3-5 one-step.
// TWOSTEP_FILE points it at another copy of the module (the deliberate-break
// runs use it). Exits 1 on any failure. Names are invented.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.TWOSTEP_FILE || path.join(here, '..', 'wp-twostep.js');
await import(pathToFileURL(file).href);
const W = globalThis.WpTwoStep;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; if (failed <= 40) console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

/* The same generator the page has (081's makeRng), copied here on purpose. */
function makeRng(seed) {
  let state = seed >>> 0;
  return function () {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('Two-step word problems — arithmetic, ranges, wording, determinism');

/* What a number in the story may be, written out here and not read from the module. */
const RANGE = { add: [15, 400], factor: [6, 15], divisor: [6, 15] };
const DIVIDEND_MAX = 900;
const NAMES = ['Maya', 'Ethan', 'Priya', 'Jaden', 'Sofia', 'Marcus', 'Aaliyah', 'Owen', 'Lucia', 'Deshawn', 'Ivy', 'Noah', 'Fatima', 'Caleb', 'Zoe', 'Kenji'];

/* Per kind: the answer from the numbers in the order the text gives them. */
const ORACLE = {
  'mult-add':        ([a, b, c]) => a * b + c,
  'mult-sub':        ([a, b, c]) => a * b - c,
  'add-mult':        ([c, a, b]) => (a + b) * c,
  'sub-mult':        ([a, b, c]) => (a - b) * c,
  'div-add':         ([n, d, c]) => n / d + c,
  'div-sub':         ([n, d, c]) => n / d - c,
  'div-mult':        ([n, d, c]) => (n / d) * c,
  'mult-div':        ([a, b, c]) => (a * b) / c,
  'add-sub':         ([a, b, c]) => a + b - c,
  'cmp-more-total':  ([a, b]) => a + (a + b),
  'cmp-fewer-total': ([a, b]) => a + (a - b),
  'cmp-times-total': ([a, b]) => a + a * b,
  'cmp-times-diff':  ([a, b]) => a * b - a,
  'rem-full-boxes':  ([n, d, c]) => Math.floor(n / d) * c,
  'rem-last-group':  ([n, d, c]) => (n % d) + c,
};
const REMAINDER_KINDS = ['rem-full-boxes', 'rem-last-group'];
const STEP_OPS = { '+': (l, r) => l + r, '−': (l, r) => l - r, '×': (l, r) => l * r };
const fmtStep = s => `${s.l} ${s.op} ${s.r} = ${s.res}${s.rem ? ' R ' + s.rem : ''}`;

/* 1. The module's own table of kinds. */
same(W.KINDS.map(k => k.id).sort(), Object.keys(ORACLE).sort(), 'the module has exactly the kinds this suite has an oracle for');
same(W.KINDS.filter(k => k.remainder).map(k => k.id).sort(), [...REMAINDER_KINDS].sort(), 'exactly two kinds are about remainders');
ok(W.KINDS.length >= 12, 'at least twelve kinds, so a sheet of twenty does not repeat itself');

/* 2. Draw many. */
const SEEDS = 4000, PER = 12;
const kindCount = {};
let total = 0, remainderSeen = 0;
const tokenRe = /\d[\d,]*/g;
for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = makeRng(seed * 2654435761);
  for (let i = 0; i < PER; i++) {
    const p = W.makeProblem(rng, 'middle');
    total++;
    const tag = `seed ${seed * 2654435761 >>> 0} #${i + 1} ${p.kind}: ${p.text}`;
    kindCount[p.kind] = (kindCount[p.kind] || 0) + 1;
    const oracle = ORACLE[p.kind];
    if (!ok(oracle, `${tag} — unknown kind`)) continue;

    /* shape */
    ok(p.op === 'two-step', `${tag} — op is two-step`);
    ok(Array.isArray(p.steps) && p.steps.length === 2, `${tag} — two steps`);
    if (!p.steps || p.steps.length !== 2) continue;
    ok(typeof p.text === 'string' && p.text.length > 30 && /[.?]$/.test(p.text), `${tag} — a sentence that ends`);
    ok(typeof p.work === 'string' && p.work.length > 0, `${tag} — has work`);

    /* the story's numbers, read back from the text, in order */
    const given = (p.text.match(tokenRe) || []).map(t => Number(t.replace(/,/g, '')));
    same(given, p.nums.map(n => n.v), `${tag} — the numbers the module says it gave are the numbers in the text, in order`);
    ok(oracle(given) === p.answer, `${tag} — the key says ${p.answer}, the story's numbers give ${oracle(given)}`);

    /* the steps, redone */
    const [s0, s1] = p.steps;
    for (const [n, s] of [[1, s0], [2, s1]]) {
      let res, rem = 0;
      if (s.op === '÷') { res = Math.floor(s.l / s.r); rem = s.l % s.r; }
      else if (STEP_OPS[s.op]) res = STEP_OPS[s.op](s.l, s.r);
      else { ok(false, `${tag} — step ${n} has an operation I do not know: ${s.op}`); continue; }
      ok(res === s.res, `${tag} — step ${n}: ${s.l} ${s.op} ${s.r} is ${res}, the key says ${s.res}`);
      ok(Number.isInteger(s.res) && s.res >= 1, `${tag} — step ${n} comes to a whole number of at least 1 (${s.res})`);
      ok(Number.isInteger(s.l) && Number.isInteger(s.r) && s.l >= 1 && s.r >= 1, `${tag} — step ${n}'s operands are whole and positive`);
      if (REMAINDER_KINDS.includes(p.kind) && n === 1) {
        ok(rem >= 1, `${tag} — a remainder kind's division leaves a remainder (${rem})`);
        eq(s.rem, rem, `${tag} — and the key records it`);
        remainderSeen++;
      } else {
        ok(rem === 0, `${tag} — step ${n} divides evenly (remainder ${rem})`);
        ok(s.rem === undefined, `${tag} — step ${n} records no remainder`);
      }
    }
    ok(s1.l === s0.res || s1.r === s0.res || (p.kind === 'rem-last-group' && s1.l === s0.rem), `${tag} — step two uses step one's result`);
    ok(s1.res === p.answer, `${tag} — the answer is step two's result`);
    eq(p.work, fmtStep(s0) + ', then ' + fmtStep(s1), `${tag} — the key line is the two steps written out`);
    eq(p.ops, `${s0.op},${s1.op}`, `${tag} — the declared operations are the ones used`);
    ok(s0.op !== s1.op || p.kind === 'cmp-more-total', `${tag} — two different operations unless it is the add-add comparison`);

    /* ranges and wording */
    for (const n of p.nums) {
      if (n.role === 'dividend') ok(n.v >= 2 * RANGE.divisor[0] && n.v <= DIVIDEND_MAX, `${tag} — dividend ${n.v} is up to ${DIVIDEND_MAX}`);
      else if (RANGE[n.role]) ok(n.v >= RANGE[n.role][0] && n.v <= RANGE[n.role][1], `${tag} — ${n.role} ${n.v} is inside ${RANGE[n.role]}`);
      else ok(false, `${tag} — a number with an unknown role: ${n.role}`);
      ok(n.v !== 1, `${tag} — no number is 1`);
    }
    ok(!/(^|[^\d])1 [a-z]/.test(p.text) && !/\b0 [a-z]/.test(p.text), `${tag} — no "1 <plural noun>" or "0 <noun>"`);
    ok(!/\bundefined\b|\bNaN\b|\[object|\{[a-z]/.test(p.text), `${tag} — no leftover placeholder`);
    ok(!/\d,\d/.test(p.text), `${tag} — no thousands comma in a story number`);
    const named = NAMES.filter(n => new RegExp('\\b' + n + '\\b').test(p.text));
    ok(named.length >= 1 && named.length <= 2, `${tag} — one or two names (${named})`);
    if (p.kind.startsWith('cmp-')) ok(named.length === 2, `${tag} — a comparison names two different people`);
    else ok(named.length === 1, `${tag} — a non-comparison names one person`);
    ok(!/\b(he|she|his|her|him|hers|they|their|them)\b/i.test(p.text), `${tag} — no pronoun`);
    ok(p.answer <= 20000, `${tag} — the answer ${p.answer} is a size a story can have`);
  }
}
console.log(`  ${total} problems from ${SEEDS} seeds`);

/* 3. Every kind turns up, and none is starved. */
for (const k of Object.keys(ORACLE)) {
  ok((kindCount[k] || 0) > total / Object.keys(ORACLE).length / 3, `kind ${k} turns up (${kindCount[k] || 0} of ${total})`);
}
ok(remainderSeen > 0, 'the remainder kinds were exercised');

/* 4. The same seed gives the same problems; a different seed does not. */
const run = seed => { const r = makeRng(seed); const out = []; for (let i = 0; i < 20; i++) out.push(W.makeProblem(r, 'middle')); return JSON.stringify(out); };
eq(run(20260812), run(20260812), 'the same seed makes the same twenty problems');
ok(run(20260812) !== run(20260813), 'a different seed makes different ones');
const first = JSON.parse(run(42));
ok(new Set(first.map(p => p.text)).size >= 18, 'twenty problems from one seed are not repeats (' + new Set(first.map(p => p.text)).size + ' distinct)');
const spent = makeRng(9); const before = []; for (let i = 0; i < 5; i++) before.push(spent());
const rng2 = makeRng(9); W.makeProblem(rng2, 'middle'); const after = rng2();
ok(after !== before[0], 'a problem draws from the rng it was given (the next draw has moved on)');

/* 5. Math.random is never used: a problem is a pure function of the rng. */
const realRandom = Math.random;
Math.random = () => { throw new Error('Math.random called'); };
let threw = null;
try { for (let s = 1; s <= 200; s++) { const r = makeRng(s); for (let i = 0; i < 12; i++) W.makeProblem(r, 'middle'); } } catch (e) { threw = e.message; }
Math.random = realRandom;
eq(threw, null, 'making problems never calls Math.random');

/* 6. Mode rules. */
eq(W.effectiveMode('middle', 'two'), 'two', 'middle + two = two');
eq(W.effectiveMode('middle', 'mixed'), 'mixed', 'middle + mixed = mixed');
eq(W.effectiveMode('middle', 'one'), 'one', 'middle + one = one');
eq(W.effectiveMode('elementary', 'two'), 'one', 'elementary + two = one');
eq(W.effectiveMode('elementary', 'mixed'), 'one', 'elementary + mixed = one');
eq(W.effectiveMode('middle', undefined), 'one', 'no mode = one');
eq(W.effectiveMode('middle', 'nonsense'), 'one', 'an unknown mode = one');
eq(W.effectiveMode('middle', '__proto__'), 'one', 'a prototype name = one');
eq(W.isTwoStep('two', 0.99), true, 'two-step mode: always two-step');
eq(W.isTwoStep('one', 0), false, 'one-step mode: never two-step');
eq(W.isTwoStep('mixed', 0.49), true, 'mixed: a low coin is two-step');
eq(W.isTwoStep('mixed', 0.5), false, 'mixed: the coin at one half is one-step');
eq(W.isTwoStep('mixed', 0.99), false, 'mixed: a high coin is one-step');
let twos = 0; const cr = makeRng(77); for (let i = 0; i < 4000; i++) if (W.isTwoStep('mixed', cr())) twos++;
ok(twos > 1800 && twos < 2200, `mixed is about half and half (${twos} of 4000)`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
