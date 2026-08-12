// drill-math.test.mjs — the arithmetic behind the new drill types.
//
//   node Tools/math-drill-generator/test/drill-math.test.mjs
//
// mdg-generate.js is pure — no DOM — so the part that matters most here can be
// checked directly instead of through a browser: an answer key that is wrong
// is worse than a layout that is ugly, and a teacher grading thirty sheets
// will not notice one bad fraction until a parent does.
//
// Every new type is generated in bulk against a seeded RNG and every problem
// is re-derived independently of the generator's own arithmetic. What this
// suite holds down:
//
//   Answers are right. Fractions reduce, mixed numbers are formed correctly,
//   decimals do not carry float noise, percents and order-of-operations land
//   on whole numbers.
//
//   Nothing is out of a middle-school worksheet's range: no negative results
//   where the type does not allow them, no improper decimals, no division
//   that does not come out even.
//
//   The problems carry the display text the renderer needs, since these types
//   are not `number symbol number` and a missing aText silently prints
//   "undefined".
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/* The module is a browser-style IIFE that attaches to `global`; loading it
   with the Function constructor keeps it usable from Node without adding a
   build step or a second copy of the file. */
const globalShim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'mdg-generate.js'), 'utf8'))(globalShim);
new Function('global', fs.readFileSync(path.join(dir, '..', 'mdg-templates.js'), 'utf8'))(globalShim);
const G = globalShim.MathDrillGenerate;
const T = globalShim.MathDrillTemplates;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, what) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(what); console.log('  FAIL ' + what); return false;
};
const eq = (a, b, what) => ok(a === b, `${what} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = name => console.log(`\n${name}`);

/** 200 problems from one template, seeded so a failure is reproducible. */
function bulk(key, count = 200) {
  const t = T.byKey(key);
  ok(t.key === key, `template "${key}" exists`);
  return G.generateProblems(t, count, { seed: 20260812 });
}

/** Parse "1 2/3", "5/6", "3" back into a number, so an answer string can be
 *  checked against arithmetic done independently of the generator. */
function parseFractionText(s) {
  const mixed = /^(-?\d+) (\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const w = Number(mixed[1]);
    const frac = Number(mixed[2]) / Number(mixed[3]);
    return w < 0 ? w - frac : w + frac;
  }
  const simple = /^(-?\d+)\/(\d+)$/.exec(s);
  if (simple) return Number(simple[1]) / Number(simple[2]);
  return Number(s);
}

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a || 1; };

console.log('Math Drill Generator — fraction, decimal, percent, integer and order-of-operations types');

/* ── every new template is reachable from the picker ─────────────────────── */
group('Templates');
for (const key of ['integers', 'decimals', 'fractions', 'percent', 'ooo']) {
  ok(T.TEMPLATES.some(t => t.key === key), `"${key}" is in the template list`);
}
ok(T.TEMPLATES.filter(t => t.key === 'addition').length === 1, 'the original fact templates are still there');

/* ── integers ────────────────────────────────────────────────────────────── */
group('Integer operations');
{
  const ps = bulk('integers');
  let sawNegativeOperand = false, sawNegativeAnswer = false;
  for (const p of ps) {
    const expected = p.op === 'add' ? p.a + p.b : p.op === 'subtract' ? p.a - p.b : p.a * p.b;
    if (!ok(p.answer === expected, `integer answer for ${p.a} ${p.symbol} ${p.b} (got ${p.answer}, want ${expected})`)) break;
    if (!ok(Number.isInteger(p.answer), `integer answer is whole: ${p.answer}`)) break;
    if (p.a < 0 || p.b < 0) sawNegativeOperand = true;
    if (p.answer < 0) sawNegativeAnswer = true;
    if (!ok(p.bText === (p.b < 0 ? `(${p.b})` : String(p.b)),
        `a negative right operand is parenthesised: ${p.bText} for ${p.b}`)) break;
  }
  ok(sawNegativeOperand, 'negative operands really do appear');
  ok(sawNegativeAnswer, 'and so do negative answers — this is the point of the type');
  ok(ps.every(p => p.vertical === false), 'integer problems are marked as not stackable');
}

/* ── decimals ────────────────────────────────────────────────────────────── */
group('Decimal operations');
{
  const ps = bulk('decimals');
  for (const p of ps) {
    const expected = p.op === 'add' ? p.a + p.b : p.op === 'subtract' ? p.a - p.b : p.a * p.b;
    if (!ok(Math.abs(p.answer - expected) < 1e-9, `decimal answer for ${p.aText} ${p.symbol} ${p.bText} (got ${p.answer}, want ${expected})`)) break;
    if (!ok(p.answer >= 0, `no negative decimal answers: ${p.aText} ${p.symbol} ${p.bText} = ${p.answer}`)) break;
    /* The float-noise check: the printed answer must be a clean one-place
       decimal, not 4.300000000000001. */
    if (!ok(/^\d+(\.\d)?$/.test(p.answerText), `answer prints cleanly: ${JSON.stringify(p.answerText)}`)) break;
    if (!ok(/^\d+(\.\d)?$/.test(p.aText), `first operand prints cleanly: ${JSON.stringify(p.aText)}`)) break;
  }
  ok(ps.some(p => p.aText.includes('.')), 'the operands really are decimals');
  ok(ps.some(p => p.op === 'multiply'), 'multiplication appears alongside add and subtract');
}

/* ── fractions ───────────────────────────────────────────────────────────── */
group('Fraction addition and subtraction');
{
  const ps = bulk('fractions');
  for (const p of ps) {
    const [n1, d1] = p.aText.split('/').map(Number);
    const [n2, d2] = p.bText.split('/').map(Number);
    if (!ok(n1 < d1 && n2 < d2, `both operands are proper fractions: ${p.aText}, ${p.bText}`)) break;
    const expected = p.op === 'add' ? n1 / d1 + n2 / d2 : n1 / d1 - n2 / d2;
    if (!ok(expected >= 0, `no negative fraction answers: ${p.aText} ${p.symbol} ${p.bText}`)) break;
    if (!ok(Math.abs(parseFractionText(p.answerText) - expected) < 1e-9,
        `fraction answer for ${p.aText} ${p.symbol} ${p.bText} (got ${JSON.stringify(p.answerText)}, want ${expected})`)) break;
    /* Reduced: the printed fraction part must have no common factor left. */
    const frac = /(\d+)\/(\d+)/.exec(p.answerText);
    if (frac && !ok(gcd(Number(frac[1]), Number(frac[2])) === 1,
        `answer is fully reduced: ${JSON.stringify(p.answerText)}`)) break;
    if (frac && !ok(Number(frac[1]) < Number(frac[2]),
        `an improper answer is written as a mixed number: ${JSON.stringify(p.answerText)}`)) break;
  }
  ok(ps.some(p => / /.test(p.answerText)), 'mixed-number answers occur');
  ok(ps.some(p => !p.answerText.includes('/')), 'and answers that come out whole are written as whole numbers');
}

/* ── percent ─────────────────────────────────────────────────────────────── */
group('Percent of a number');
{
  const ps = bulk('percent');
  for (const p of ps) {
    if (!ok(p.answer === p.a * p.b / 100, `percent answer for ${p.aText} of ${p.bText}`)) break;
    if (!ok(Number.isInteger(p.answer), `${p.aText} of ${p.bText} lands on a whole number, not ${p.answer}`)) break;
    if (!ok(p.symbol === 'of', 'the problem reads "20% of 60" rather than using an operator')) break;
    if (!ok(/^\d+%$/.test(p.aText), `the percent is written with its sign: ${JSON.stringify(p.aText)}`)) break;
  }
}

/* ── order of operations ─────────────────────────────────────────────────── */
group('Order of operations');
{
  const ps = bulk('ooo');
  const evalExpr = expr => {
    /* Evaluated independently of the generator: normalise the printed
       characters and let JS apply precedence, which is the rule the problem
       is testing in the first place. */
    const js = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    if (!/^[\d\s+\-*/().]+$/.test(js)) throw new Error('unexpected characters in ' + expr);
    return Function('"use strict";return (' + js + ')')();
  };
  for (const p of ps) {
    if (!ok(typeof p.expr === 'string' && p.expr.length > 0, 'the problem carries a whole expression')) break;
    if (!ok(p.answer === evalExpr(p.expr), `${p.expr} = ${p.answer}`)) break;
    if (!ok(Number.isInteger(p.answer) && p.answer >= 0, `${p.expr} gives a non-negative whole number, not ${p.answer}`)) break;
  }
  ok(ps.some(p => p.expr.includes('(')), 'parenthesised problems appear');
  ok(ps.some(p => p.expr.includes('÷')), 'division problems appear, and come out even');
  ok(ps.some(p => p.expr.includes('×') && !p.expr.includes('(')),
     'so do bare precedence problems where multiplication has to go first');
}

/* ── the original four are untouched ─────────────────────────────────────── */
group('The original fact drills');
for (const [key, check] of [
  ['addition', p => p.a + p.b === p.answer],
  ['subtraction', p => p.a - p.b === p.answer && p.answer >= 0],
  ['multiplication', p => p.a * p.b === p.answer],
  ['division', p => p.b * p.answer === p.a],
]) {
  const ps = bulk(key, 100);
  ok(ps.every(check), `${key} still produces correct answers`);
  ok(ps.every(p => p.vertical !== false), `${key} problems can still be stacked vertically`);
  ok(ps.every(p => p.aText === undefined), `${key} problems still render straight off their operands`);
}

/* ── seeding still reproduces a sheet ────────────────────────────────────── */
group('Reproducibility');
for (const key of ['fractions', 'decimals', 'ooo', 'integers', 'percent']) {
  const t = T.byKey(key);
  const one = G.generateProblems(t, 30, { seed: 7 }).map(p => p.expr || p.aText + p.symbol + p.bText).join('|');
  const two = G.generateProblems(t, 30, { seed: 7 }).map(p => p.expr || p.aText + p.symbol + p.bText).join('|');
  eq(one, two, `the same seed reprints the same "${key}" sheet`);
}

/* ── the helper the display text leans on ────────────────────────────────── */
group('fractionText');
eq(G.fractionText(3, 6), '1/2', 'reduces');
eq(G.fractionText(4, 2), '2', 'a whole number drops its denominator');
eq(G.fractionText(7, 6), '1 1/6', 'improper becomes mixed');
eq(G.fractionText(9, 3), '3', 'and reduces to a whole number when it can');
eq(G.fractionText(0, 5), '0', 'zero is zero');
eq(G.fractionText(13, 4), '3 1/4', 'a larger improper fraction');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
