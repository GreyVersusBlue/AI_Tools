// drill-frac-exp-eq.test.mjs — the arithmetic of the three drill types added
// 2026-10-07: fraction multiplication and division, exponents, one-step equations.
//
//   node Tools/math-drill-generator/test/drill-frac-exp-eq.test.mjs
//
// mdg-generate.js is pure, so every problem is checked here without a browser.
// The oracle is written apart from the generator: it reads the numbers back OUT
// of the printed text (aText / bText, or the equation's expression) and does the
// arithmetic again with BigInt rationals, so no float is ever compared and the
// generator's own gcd and fractionText are not trusted. What it holds down:
//
//   Answers are right: the product, quotient, power or solution recomputed from
//   the printed numbers equals the printed answer, and an equation's printed
//   answer put back into the printed equation makes both sides equal.
//
//   Answers are written as the tool writes them: lowest terms, no zero
//   denominator, an improper result as a mixed number, a whole result plain.
//
//   Nothing divides by zero: no divisor is 0, no fraction has a 0 denominator.
//
//   Every number sits inside the teacher's bounds, and an option that is off
//   (mixed numbers, a whole factor, exponents under 2, negatives, fraction
//   answers) never shows up; one that is on does.
//
//   No answer past MAX_POWER_RESULT, even for bounds that cannot fit under it.
//
//   No duplicate problem on a sheet, as for the older types.
//
//   A sheet saved before the types existed regenerates the same problems:
//   golden-old-problems.json is 320 hashes recorded from the generator before
//   the change (every template x avoidTrivial x 5 seeds).
//
// MDG_DIR points the suite at a copy of the module (the break-on-purpose runs).
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const MOD = process.env.MDG_DIR || path.join(dir, '..');
const g = {};
for (const f of ['mdg-generate.js', 'mdg-templates.js']) new Function('global', fs.readFileSync(path.join(MOD, f), 'utf8'))(g);
const G = g.MathDrillGenerate, T = g.MathDrillTemplates;

let passed = 0, failed = 0;
const fails = [];
const FAIL_CAP = 25;
const ok = (cond, what) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(what); if (fails.length <= FAIL_CAP) console.log('  FAIL ' + what); return false;
};
const eq = (a, b, what) => ok(a === b, `${what} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = name => console.log(`\n${name}`);

import { absB, gcdB, rat, mul, div, add, same, parseNum, writtenAs } from './_oracle.mjs';

const sheet = (key, count, seed, typeOptions, extra = {}) =>
  G.generateProblems(Object.assign({}, T.byKey(key), extra), count, { seed, typeOptions });
const hash = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

/* ── 0. a sheet saved before today ────────────────────────────────────────── */
group('Older sheets regenerate the same problems');
{
  const gold = JSON.parse(fs.readFileSync(path.join(dir, 'golden-old-problems.json'), 'utf8'));
  let n = 0, bad = [];
  for (const [k, h] of Object.entries(gold.entries)) {
    const [key, av, seed] = k.split('|');
    const probs = G.generateProblems(T.byKey(key), 30, { seed: +seed, avoidTrivial: av === '1' });
    n++;
    if (hash(probs) !== h) bad.push(k);
  }
  eq(n, 320, 'golden holds 320 recorded sheets');
  ok(bad.length === 0, 'every recorded sheet is unchanged (' + bad.slice(0, 4).join(', ') + ')');
  // the same sheets with typeOptions present (the page always passes them) are unchanged too
  let bad2 = 0;
  for (const [k, h] of Object.entries(gold.entries)) {
    const [key, av, seed] = k.split('|');
    const probs = G.generateProblems(T.byKey(key), 30, { seed: +seed, avoidTrivial: av === '1', typeOptions: { fracMixed: true, fracWhole: true, expAllowLow: true, eqNegatives: true, eqFractions: true } });
    if (hash(probs) !== h) bad2++;
  }
  eq(bad2, 0, 'older types ignore the new options');
  ok(['addition', 'subtraction', 'multiplication', 'division', 'mixed', 'integers', 'decimals', 'fractions', 'percent', 'ooo'].every(k => T.byKey(k).key === k), 'the older templates are still there');
  eq(T.byKey('fracmuldiv').key, 'fracmuldiv', 'fraction multiply and divide has a template');
  eq(T.byKey('exponents').key, 'exponents', 'exponents has a template');
  eq(T.byKey('equations').key, 'equations', 'equations has a template');
  eq(T.TEMPLATES.length, new Set(T.TEMPLATES.map(t => t.key)).size, 'template keys stay unique');
}

/* ── 1. fraction multiplication and division ─────────────────────────────── */
group('Fraction multiplication and division');
{
  const combos = [];
  for (const fracOp of ['both', 'multiply', 'divide']) for (const fracMixed of [false, true]) for (const fracWhole of [false, true]) combos.push({ fracOp, fracMixed, fracWhole });
  let probs = 0, sawMixed = 0, sawWhole = 0, sawMul = 0, sawDiv = 0, sawImproper = 0, sawWholeAnswer = 0, sawProperAnswer = 0;
  const bad = {};
  const flag = (k, ctx) => { bad[k] = bad[k] || ctx; };
  for (const o of combos) {
    const tag = JSON.stringify(o);
    for (let seed = 1; seed <= 300; seed++) {
      const ps = sheet('fracmuldiv', 30, seed * 7919 + 13, o);
      const seen = new Set();
      for (const p of ps) {
        probs++;
        const A = parseNum(p.aText), B = parseNum(p.bText);
        if (!A || !B) { flag('operand text parses and has no zero denominator', tag + ' ' + p.aText + '|' + p.bText); continue; }
        const isMul = p.symbol === '×', isDiv = p.symbol === '÷';
        if (!isMul && !isDiv) { flag('symbol is × or ÷', tag + ' ' + p.symbol); continue; }
        if (isMul) sawMul++; else sawDiv++;
        if (p.op !== (isMul ? 'multiply' : 'divide')) flag('op field matches the symbol', tag);
        if (o.fracOp === 'multiply' && !isMul) flag('multiply-only sheets only multiply', tag);
        if (o.fracOp === 'divide' && !isDiv) flag('divide-only sheets only divide', tag);
        if (B.r.n === 0n || A.r.n === 0n) flag('no zero operand (so never a zero divisor)', tag);
        let want;
        try { want = isMul ? mul(A.r, B.r) : div(A.r, B.r); } catch (e) { flag('arithmetic is possible', tag); continue; }
        if (!writtenAs(p.answerText, want)) flag('answer text is the exact result in lowest terms, improper as a mixed number', tag + ' ' + p.aText + p.symbol + p.bText + ' = ' + p.answerText);
        if (want.d === 1n) sawWholeAnswer++; else if (absB(want.n) > want.d) sawImproper++; else sawProperAnswer++;
        if (Math.abs(p.answer - Number(want.n) / Number(want.d)) > 1e-9) flag('numeric answer matches', tag);
        for (const [X, t] of [[A, p.aText], [B, p.bText]]) {
          if (X.kind === 'mixed') {
            sawMixed++;
            if (!o.fracMixed) flag('no mixed number unless asked', tag + ' ' + t);
            if (!(X.num > 0n && X.num < X.den && gcdB(X.num, X.den) === 1n && X.whole >= 1n && X.whole <= 3n)) flag('a mixed operand is whole 1-3 plus a proper reduced fraction', t);
          } else if (X.kind === 'int') {
            sawWhole++;
            if (!o.fracWhole) flag('no whole-number factor unless asked', tag + ' ' + t);
            if (!(X.r.n >= 2n && X.r.n <= 9n)) flag('a whole factor is 2 to 9', t);
          } else {
            if (!(X.num > 0n && X.num < X.den && gcdB(X.num, X.den) === 1n)) flag('a fraction operand is proper and in lowest terms', t);
            if (![2n, 3n, 4n, 5n, 6n, 8n, 10n, 12n].includes(X.den)) flag('denominators come from the tool pool', t);
          }
        }
        if (A.kind === 'int' && B.kind === 'int') flag('never two whole numbers', tag);
        if (p.vertical !== false) flag('never stacked in a column', tag);
        const key = p.aText + p.op + p.bText;
        if (seen.has(key)) flag('no duplicate problem on a sheet', tag + ' ' + key);
        seen.add(key);
      }
    }
  }
  for (const [k, ctx] of Object.entries(bad)) ok(false, `fraction multiply/divide: ${k} — first seen at ${ctx}`);
  ok(Object.keys(bad).length === 0, `${probs} fraction problems, every rule held`);
  ok(sawMixed > 0 && sawWhole > 0 && sawMul > 0 && sawDiv > 0, 'mixed numbers, whole factors, × and ÷ all turn up when allowed');
  ok(sawImproper > 0 && sawWholeAnswer > 0 && sawProperAnswer > 0, 'answers come out improper, whole and proper');
  // defaults: a missing option is the default (both operations, proper fractions only)
  const dflt = sheet('fracmuldiv', 200, 77, undefined);
  ok(dflt.every(p => parseNum(p.aText).kind === 'frac' && parseNum(p.bText).kind === 'frac'), 'default sheet: proper fractions only');
  ok(dflt.some(p => p.symbol === '×') && dflt.some(p => p.symbol === '÷'), 'default sheet: both operations');
  const junk = sheet('fracmuldiv', 50, 3, { fracOp: '<img src=x>', fracMixed: 'yes', fracWhole: 1 });
  ok(junk.every(p => parseNum(p.aText).kind === 'frac' && parseNum(p.bText).kind === 'frac'), 'junk option values are the default, not truthy');
  // the trivial filter's divide rule: x ÷ x is not offered when asked to avoid trivial facts
  const nt = G.generateProblems(T.byKey('fracmuldiv'), 40, { seed: 5, avoidTrivial: true });
  ok(nt.every(p => !(p.op === 'divide' && p.a === p.b)), 'avoid trivial leaves out x ÷ x');
  eq(hash(sheet('fracmuldiv', 30, 99, { fracMixed: true })), hash(sheet('fracmuldiv', 30, 99, { fracMixed: true })), 'same seed, same options: same sheet');
  ok(hash(sheet('fracmuldiv', 30, 99, {})) !== hash(sheet('fracmuldiv', 30, 100, {})), 'a different seed is a different sheet');
}

/* ── 2. exponents ─────────────────────────────────────────────────────────── */
group('Exponents');
{
  const CAP = 1000000n;
  const cases = [];
  const ranges = [
    { name: 'default', r1: { min: 2, max: 12 }, r2: { min: 2, max: 5 } },
    { name: 'small', r1: { min: 2, max: 3 }, r2: { min: 2, max: 4 } },
    { name: 'wide', r1: { min: 1, max: 30 }, r2: { min: 1, max: 10 } },
    { name: 'huge', r1: { min: 2, max: 999 }, r2: { min: 2, max: 20 } },
    { name: 'single', r1: { min: 7, max: 7 }, r2: { min: 3, max: 3 } },
    { name: 'low', r1: { min: 1, max: 9 }, r2: { min: 1, max: 1 } }
  ];
  for (const rg of ranges) for (const expPreset of ['custom', 'squares', 'cubes', 'tens']) for (const expAllowLow of [false, true]) cases.push({ rg, expPreset, expAllowLow });
  let probs = 0, sawLow0 = 0, sawLow1 = 0, sawBig = 0;
  const bad = {};
  const flag = (k, ctx) => { bad[k] = bad[k] || ctx; };
  for (const c of cases) {
    const tag = c.rg.name + '/' + c.expPreset + '/' + (c.expAllowLow ? 'low' : 'nolow');
    const { r1, r2 } = c.rg;
    for (let seed = 1; seed <= 120; seed++) {
      const ps = G.generateProblems({ key: 'exponents', operation: 'exponent', operand1: r1, operand2: r2 }, 24, { seed: seed * 104729 + 7, typeOptions: { expPreset: c.expPreset, expAllowLow: c.expAllowLow } });
      for (const p of ps) {
        probs++;
        const m = /^(\d+)\^(\d+)$/.exec(p.expr || '');
        if (!m) { flag('expr is base^exponent', tag + ' ' + p.expr); continue; }
        const b = BigInt(m[1]), e = BigInt(m[2]);
        const want = b ** e;

        if (String(want) !== p.answerText) flag('answer is the exact power', tag + ' ' + p.expr + ' = ' + p.answerText);
        if (want > CAP) flag('no answer past one million', tag + ' ' + p.expr);
        if (p.answer !== Number(want)) flag('numeric answer matches', tag);
        if (p.html !== `${m[1]}<sup>${m[2]}</sup>`) flag('printed as a real superscript', tag + ' ' + p.html);
        const speak = Number(e) === 2 ? `${b} squared` : Number(e) === 3 ? `${b} cubed` : `${b} to the power of ${e}`;
        if (p.speak !== speak) flag('spoken form is read correctly', tag + ' ' + p.speak);
        if (p.vertical !== false) flag('never stacked', tag);
        if (p.symbol !== '^' || p.op !== 'exponent') flag('op and symbol', tag);
        if (e === 0n) sawLow0++; if (e === 1n) sawLow1++; if (want > 100000n) sawBig++;
        if (!c.expAllowLow && e < 2n) flag('no exponent under 2 unless asked', tag + ' ' + p.expr);
        const feasibleBase = r1.min;
        // bounds: the exponents the teacher can name, and bases in range
        const eLo = Math.max(0, r2.min), eHi = Math.max(eLo, r2.max);
        let eOk;
        if (c.expPreset === 'squares') eOk = e === 2n;
        else if (c.expPreset === 'cubes') eOk = e === 3n;
        else eOk = (Number(e) >= Math.max(2, eLo) && Number(e) <= eHi) || (c.expAllowLow && (e === 0n || e === 1n));
        const baseOk = c.expPreset === 'tens' ? b === 10n : (b >= BigInt(Math.max(1, r1.min)) && b <= BigInt(Math.min(999, Math.max(r1.min, r1.max))));
        // a range whose lowest base cannot fit under the cap at its lowest exponent is the one place a bound gives way
        const lowestFits = (BigInt(Math.max(1, feasibleBase)) ** BigInt(c.expPreset === 'squares' ? 2 : c.expPreset === 'cubes' ? 3 : Math.max(2, eLo))) <= CAP;
        if (c.expPreset === 'tens' ? true : lowestFits) {
          if (!eOk && !(c.expPreset !== 'squares' && c.expPreset !== 'cubes' && r2.max < 2 && !c.expAllowLow && e === 2n)) flag('exponent inside the teacher\'s bounds', tag + ' ' + p.expr);
          if (!baseOk) flag('base inside the teacher\'s bounds', tag + ' ' + p.expr);
        }
      }
    }
  }
  for (const [k, ctx] of Object.entries(bad)) ok(false, `exponents: ${k} — first seen at ${ctx}`);
  ok(Object.keys(bad).length === 0, `${probs} exponent problems, every rule held`);
  ok(sawLow0 > 0 && sawLow1 > 0, 'exponents 0 and 1 turn up when allowed');
  ok(sawBig > 0, 'large powers turn up (the cap is a ceiling, not a squeeze)');

  // presets
  const sq = sheet('exponents', 40, 11, { expPreset: 'squares' }).map(p => p.expr);
  ok(sq.every(x => /^\d+\^2$/.test(x)), 'squares: every exponent is 2');
  const cu = sheet('exponents', 40, 12, { expPreset: 'cubes' }).map(p => p.expr);
  ok(cu.every(x => /^\d+\^3$/.test(x)), 'cubes: every exponent is 3');
  const te = sheet('exponents', 60, 13, { expPreset: 'tens' }, { operand2: { min: 2, max: 6 } });
  ok(te.every(p => /^10\^[2-6]$/.test(p.expr)), 'powers of ten: base 10, exponent from the range');
  ok(te.every(p => p.answerText === '1' + '0'.repeat(Number(p.expr.split('^')[1]))), 'powers of ten: a 1 and that many zeros');
  const te7 = G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 2, max: 12 }, operand2: { min: 2, max: 9 } }, 60, { seed: 9, typeOptions: { expPreset: 'tens' } });
  ok(te7.every(p => Number(p.expr.split('^')[1]) <= 6), 'powers of ten stop at 10^6 under the cap');
  // the cap squeezes the base range, it does not cut it short: the largest base that fits is still drawn
  const cubesBig = G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 2, max: 999 }, operand2: { min: 2, max: 5 } }, 100, { seed: 31, typeOptions: { expPreset: 'cubes' } });
  const cubeBases = new Set();
  for (let seed = 1; seed <= 60; seed++) for (const p of G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 2, max: 999 }, operand2: { min: 2, max: 5 } }, 100, { seed, typeOptions: { expPreset: 'cubes' } })) cubeBases.add(Number(p.expr.split('^')[0]));
  ok(Math.max(...cubeBases) === 100 && cubesBig.every(p => Number(p.expr.split('^')[0]) <= 100), 'cubes with bases up to 999: nothing past 100 (100 cubed is a million) and 100 itself is drawn');
  // the cap, for bounds that cannot fit
  const impossible = G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 999, max: 999 }, operand2: { min: 4, max: 9 } }, 40, { seed: 4, typeOptions: {} });
  ok(impossible.every(p => BigInt(p.answerText) <= CAP && String(BigInt(p.expr.split('^')[0]) ** BigInt(p.expr.split('^')[1])) === p.answerText), 'bounds that cannot fit under the cap still stay under it, and are right');
  // duplicates: a pool far larger than the sheet
  let dup = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const ps = sheet('exponents', 15, seed * 31 + 5, {});
    if (new Set(ps.map(p => p.expr)).size !== ps.length) dup++;
  }
  eq(dup, 0, 'no duplicate problem on a sheet with room to avoid it (400 sheets of 15 from 44)');
  // avoid trivial
  let triv = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ps = G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 1, max: 12 }, operand2: { min: 2, max: 5 } }, 20, { seed: seed * 17, avoidTrivial: true, typeOptions: { expAllowLow: true } });
    triv += ps.filter(p => p.a === 1 || p.b <= 1).length;
  }
  eq(triv, 0, 'avoid trivial leaves out 1 to a power and exponents 0 and 1');
  ok(G.isTrivial({ op: 'exponent', a: 1, b: 5 }) && G.isTrivial({ op: 'exponent', a: 6, b: 1 }) && G.isTrivial({ op: 'exponent', a: 6, b: 0 }) && !G.isTrivial({ op: 'exponent', a: 6, b: 2 }), 'isTrivial reads exponents');
  // junk
  const jk = G.generateProblems({ key: 'x', operation: 'exponent', operand1: { min: 'abc' }, operand2: {} }, 10, { seed: 2, typeOptions: { expPreset: '<b>', expAllowLow: 'true' } });
  ok(jk.length === 10 && jk.every(p => /^\d+\^\d+$/.test(p.expr) && BigInt(p.answerText) <= CAP), 'junk ranges and options give a sheet that is still right');
  eq(G.MAX_POWER_RESULT, 1000000, 'the stated cap is one million');
}

/* ── 3. one-step equations ───────────────────────────────────────────────── */
group('One-step equations');
{
  const forms = { add: /^x \+ (\d+) = (-?\d+)$/, sub: /^x − (\d+) = (-?\d+)$/, mul: /^(\d+)x = (-?\d+)$/, div: /^x ÷ (\d+) = (-?\d+)$/ };
  const ranges = [
    { name: 'default', r1: { min: 1, max: 12 }, r2: { min: 1, max: 12 } },
    { name: 'tiny', r1: { min: 1, max: 1 }, r2: { min: 1, max: 1 } },
    { name: 'wide', r1: { min: 3, max: 40 }, r2: { min: 2, max: 25 } },
    { name: 'a-large', r1: { min: 1, max: 5 }, r2: { min: 10, max: 30 } },
    { name: 'big', r1: { min: 50, max: 999 }, r2: { min: 50, max: 999 } },
    { name: 'zero-floor', r1: { min: 0, max: 3 }, r2: { min: 0, max: 3 } }
  ];
  const bad = {};
  const flag = (k, ctx) => { bad[k] = bad[k] || ctx; };
  let probs = 0;
  const saw = { add: 0, sub: 0, mul: 0, div: 0, neg: 0, frac: 0, mixedAns: 0, zeroB: 0, negMulWhole: 0, negAdd: 0, negSub: 0, negMul: 0, negDiv: 0 };
  for (const rg of ranges) for (const eqForms of ['all', 'addsub', 'muldiv']) for (const eqNegatives of [false, true]) for (const eqFractions of [false, true]) {
    const tag = [rg.name, eqForms, eqNegatives ? 'neg' : 'pos', eqFractions ? 'frac' : 'whole'].join('/');
    for (let seed = 1; seed <= 80; seed++) {
      const ps = G.generateProblems({ key: 'equations', operation: 'equation', operand1: rg.r1, operand2: rg.r2 }, 30, { seed: seed * 6007 + 3, typeOptions: { eqForms, eqNegatives, eqFractions } });
      for (const p of ps) {
        probs++;
        let form = null, m = null;
        for (const [f, re] of Object.entries(forms)) { m = re.exec(p.expr); if (m) { form = f; break; } }
        if (!form) { flag('expression is one of the four one-step shapes', tag + ' ' + p.expr); continue; }
        saw[form]++;
        if (p.form !== form) flag('form field matches the expression', tag);
        if (eqForms === 'addsub' && !(form === 'add' || form === 'sub')) flag('add/subtract only', tag);
        if (eqForms === 'muldiv' && !(form === 'mul' || form === 'div')) flag('multiply/divide only', tag);
        const a = BigInt(m[1]), b = BigInt(m[2]);
        if (a === 0n) flag('the number a is never zero (no divide by zero)', tag + ' ' + p.expr);
        if ((form === 'mul' || form === 'div') && a < 2n) flag('a is at least 2 for ax and x ÷ a', tag + ' ' + p.expr);
        // solve apart from the generator
        let sol;
        if (form === 'add') sol = rat(b - a); else if (form === 'sub') sol = rat(b + a);
        else if (form === 'mul') sol = rat(b, a); else sol = rat(b * a);
        if (!writtenAs(p.answerText, sol)) flag('answer text is the exact solution in lowest terms', tag + ' ' + p.expr + ' => ' + p.answerText);
        if (p.keyText !== 'x = ' + p.answerText) flag('key line is x = answer', tag);
        if (p.line !== p.expr + '  x = _____') flag('worksheet line ends in x = blank', tag);
        // substitute the printed answer back into the printed equation
        const X = parseNum(p.answerText);
        if (X) {
          const lhs = form === 'add' ? add(X.r, rat(a)) : form === 'sub' ? add(X.r, rat(-a)) : form === 'mul' ? mul(rat(a), X.r) : div(X.r, rat(a));
          if (!same(lhs, rat(b))) flag('the printed answer satisfies the printed equation', tag + ' ' + p.expr + ' x=' + p.answerText);
        }
        if (Math.abs(p.answer - Number(sol.n) / Number(sol.d)) > 1e-9) flag('numeric answer matches', tag);
        const whole = sol.d === 1n;
        if (!whole) { saw.frac++; if (!(eqFractions && form === 'mul')) flag('a fraction answer only when asked, and only in ax = b', tag + ' ' + p.expr); else if (b % a === 0n) flag('fraction answer means a does not divide b', tag); if (absB(sol.n) > sol.d) saw.mixedAns++; }
        if (sol.n === 0n) flag('x is never zero', tag);
        if (sol.n < 0n && form === 'mul' && sol.d === 1n && !eqFractions) saw.negMulWhole++;
        if (sol.n < 0n) { saw.neg++; saw['neg' + form[0].toUpperCase() + form.slice(1)]++; if (!eqNegatives) flag('no negative answer unless asked', tag + ' ' + p.expr); }
        if (!eqNegatives && b < 0n) flag('without negatives, every number printed is positive', tag + ' ' + p.expr);
        if (b === 0n) saw.zeroB++;
        // bounds (the floor on a for ax and x ÷ a is 2, and for x + a, x − a is 1)
        const xLo = Math.max(1, rg.r1.min), xHi = Math.max(xLo, rg.r1.max);
        const aLo = Math.max(form === 'add' || form === 'sub' ? 1 : 2, rg.r2.min), aHi = Math.max(aLo, rg.r2.max);
        const subFeasible = form !== 'sub' || eqNegatives || aLo <= xHi - 1;
        if (subFeasible) {
          if (!(a >= BigInt(aLo) && a <= BigInt(aHi))) flag('the number a is inside the range', tag + ' ' + p.expr);
          const xv = form === 'div' ? absB(b) : (whole ? absB(sol.n) : null);
          if (form === 'mul' && !whole) {
            // a fraction answer: b = a*q + r with q below the top of the x range
            if (!(absB(b) / a < BigInt(xHi))) flag('fraction answer stays under the top of the x range', tag + ' ' + p.expr);
          } else if (!(xv >= BigInt(xLo) && xv <= BigInt(xHi))) flag('x (or the right-hand number of x ÷ a) is inside the range', tag + ' ' + p.expr);
        }
      }
    }
  }
  for (const [k, ctx] of Object.entries(bad)) ok(false, `equations: ${k} — first seen at ${ctx}`);
  ok(Object.keys(bad).length === 0, `${probs} equations, every rule held`);
  ok(saw.add > 0 && saw.sub > 0 && saw.mul > 0 && saw.div > 0, 'all four forms turn up');
  ok(saw.negMulWhole > 0, 'negative whole answers turn up in ax = b without fractions on');
  ok(saw.negAdd > 0 && saw.negSub > 0 && saw.negMul > 0 && saw.negDiv > 0, 'negative answers turn up in every form when allowed');
  ok(saw.frac > 0 && saw.mixedAns > 0, 'fraction answers (including mixed numbers) turn up when allowed');

  // duplicates, where the pool is large
  let dup = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const ps = sheet('equations', 20, seed * 41 + 9, {});
    if (new Set(ps.map(p => p.expr)).size !== ps.length) dup++;
  }
  eq(dup, 0, 'no duplicate equation on a sheet with room to avoid it (300 sheets of 20)');
  // default is whole numbers, positive
  const dp = sheet('equations', 400, 21, undefined);
  ok(dp.every(p => /^\d+$/.test(p.answerText) && Number(p.answerText) >= 1), 'default: positive whole-number answers only');
  const jk = sheet('equations', 50, 8, { eqForms: null, eqNegatives: 'yes', eqFractions: 1 });
  ok(jk.every(p => /^\d+$/.test(p.answerText)), 'junk option values are the default');
  const jr = G.generateProblems({ key: 'x', operation: 'equation', operand1: {}, operand2: { min: 'z' } }, 20, { seed: 4 });
  ok(jr.length === 20 && jr.every(p => /^\d+$/.test(p.answerText)), 'junk ranges still give whole-number equations');
  ok(!G.isTrivial({ op: 'equation', a: 2, b: 4 }), 'the trivial filter leaves equations alone');
  // x - a = b stays positive and the solution is whole at the tightest feasible range
  const tight = G.generateProblems({ key: 'x', operation: 'equation', operand1: { min: 2, max: 2 }, operand2: { min: 1, max: 1 } }, 30, { seed: 1, typeOptions: { eqForms: 'addsub' } });
  ok(tight.every(p => /^x [+−] 1 = \d+$/.test(p.expr)), 'range 2..2 and 1..1: x + 1 = 3 or x − 1 = 1');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(`${fails.length} failing assertion(s), first ${Math.min(5, fails.length)}:`); fails.slice(0, 5).forEach(f => console.log('  - ' + f)); process.exit(1); }
