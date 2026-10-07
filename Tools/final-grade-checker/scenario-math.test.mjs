// scenario-math.test.mjs — the scenario arithmetic, checked against a second
// calculation that shares no code with it.
//
//   node Tools/final-grade-checker/scenario-math.test.mjs
//
// The oracle below works on exact fractions (BigInt numerator over BigInt
// denominator) and follows the rules in scenario-math.mjs's header as English,
// step by step. It does not call anything from scenario-math.mjs, and it uses
// no integer-of-hundredths shortcut and no float. Thousands of seeded gradebooks
// and scenarios go through both; the answers must be equal to the ten-thousandth
// and to the letter. Every name and number is made up.
//
// The two places a rule is a choice, not arithmetic, are the same two the module
// states: a curved score is rounded to the hundredth, and an average is rounded
// half up to four decimals before it meets a cutoff (the county rule's
// PRECISION in grade-math.mjs).
//
// SCENARIO_MODULE lets the break-on-purpose runs point this file at a mutated
// copy of the module; unset, it tests the real one.

import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const MOD = process.env.SCENARIO_MODULE
  ? pathToFileURL(path.resolve(process.env.SCENARIO_MODULE)).href
  : pathToFileURL(path.join(here, 'scenario-math.mjs')).href;
const S = await import(MOD);
const G = await import(pathToFileURL(path.join(here, process.env.SCENARIO_GRADE_MATH || 'grade-math.mjs')).href);
const { mathHash, OLD_MATH_HASH } = await import('./test/_golden-math.mjs');
const { rng } = await import('./test/_golden-page.mjs');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// ── The oracle: exact fractions ─────────────────────────────────────────────

const big = BigInt;
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
class Fr {
  constructor(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); this.n = n / g; this.d = d / g; }
  add(o) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  mul(o) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o) { return new Fr(this.n * o.d, this.d * o.n); }
  cmp(o) { const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  // round half up to a multiple of 1/scale, returned as an exact fraction
  roundTo(scale) {
    const x = this.mul(new Fr(big(scale))); // x = value * scale
    const fl = (x.n - (((x.n % x.d) + x.d) % x.d)) / x.d; // floor
    const frac = x.add(new Fr(-fl));
    const up = frac.cmp(new Fr(1n, 2n)) >= 0 ? fl + 1n : fl;
    return new Fr(up, big(scale));
  }
}
const F = (n, d = 1) => new Fr(big(n), big(d));
const fromTyped = v => F(Math.round(v * 100), 100);   // a typed percentage, two decimals

const CUT = {
  half:   { letters: [['A', F(179, 2)], ['B', F(159, 2)], ['C', F(139, 2)], ['D', F(119, 2)]], qp: [['A', F(7, 2)], ['B', F(5, 2)], ['C', F(3, 2)], ['D', F(1, 2)]] },
  strict: { letters: [['A', F(90)], ['B', F(80)], ['C', F(70)], ['D', F(60)]], qp: [['A', F(4)], ['B', F(3)], ['C', F(2)], ['D', F(1)]] },
};
const RANK = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// precision: null | 0 | 1 decimals, applied to the (already 4-decimal) average
function letterOf(valueFr, kind, boundary, precision) {
  let v = valueFr.roundTo(10000);
  if (precision !== null && precision !== undefined) v = v.roundTo(Math.pow(10, precision));
  const rows = (boundary === 'strict' ? CUT.strict : CUT.half)[kind];
  for (const [l, c] of rows) if (v.cmp(c) >= 0) return l;
  return 'F';
}

/** The scenario, as English: user = { dropN, mode: none|plus|top, points (percent, a number), apply: 'all'|0..3, extra, weights: null|[numbers] },
 *  page = { boundary, precision, weights: null|[numbers] }, scoresTyped four numbers|null, tops (percent numbers|null per quarter) */
function oracle(scoresTyped, user, page, tops) {
  // the weights in force
  let w;
  if (user.weights) w = user.weights.map(fromTyped);
  else if (page.weights && page.weights.every(x => x > 0)) w = page.weights.map(fromTyped);
  else w = [F(25), F(25), F(25), F(25)];
  const counted = [0, 1, 2, 3].filter(i => w[i].n > 0n);
  const score = scoresTyped.map(s => (s === null || s < 0 || s > 100) ? null : fromTyped(s));
  if (counted.some(i => score[i] === null)) return null;

  // 1. drop
  const order = counted.slice().sort((a, b) => { const c = score[a].cmp(score[b]); return c || a - b; });
  const n = Math.min(user.dropN, counted.length - 1);
  const dropped = order.slice(0, n);
  const kept = counted.filter(i => !dropped.includes(i));

  // 2. curve
  const ceil = F(user.extra ? 200 : 100);
  const adj = {};
  for (const i of kept) {
    let x = score[i];
    if (user.mode !== 'none' && (user.apply === 'all' || user.apply === i)) {
      if (user.mode === 'plus') x = x.add(fromTyped(user.points));
      else { const t = tops[i] === null ? F(0) : fromTyped(tops[i]); if (t.n > 0n) x = x.mul(F(100)).div(t); }
      x = x.roundTo(100);
      if (x.cmp(F(0)) < 0) x = F(0);
      if (x.cmp(ceil) > 0) x = ceil;
    }
    adj[i] = x;
  }
  // 3. weight
  let wsum = F(0), pct = F(0), qp = F(0);
  const qpOfScore = x => {
    const l = letterOf(x, 'letters', page.boundary, page.precision);
    return { A: 4, B: 3, C: 2, D: 1, F: 0 }[l];
  };
  for (const i of kept) { wsum = wsum.add(w[i]); pct = pct.add(w[i].mul(adj[i])); qp = qp.add(w[i].mul(F(qpOfScore(adj[i])))); }
  pct = pct.div(wsum); qp = qp.div(wsum);
  const pL = letterOf(pct, 'letters', page.boundary, page.precision);
  const qL = letterOf(qp, 'qp', page.boundary, page.precision);
  const winner = RANK[qL] >= RANK[pL] ? 'QP' : 'PCT';
  return { pct4: pct.roundTo(10000), qp4: qp.roundTo(10000), pL, qL, final: winner === 'QP' ? qL : pL, dropped };
}

// ── Adapters: a user-terms scenario into the module's ───────────────────────

const toModule = u => S.cleanScenario({
  dropN: u.dropN,
  curve: { mode: u.mode, points: Math.round(u.points * 100), apply: u.apply, extra: u.extra },
  weights: u.weights,
});
const ctxOf = (page, tops) => ({
  boundary: page.boundary, precision: page.precision === undefined ? null : page.precision,
  pageWeights: page.weights, tops: tops.map(t => (t === null ? null : Math.round(t * 100))),
});
const asNumber = fr => Number(fr.n) / Number(fr.d);

function compare(scores, user, page, tops, label) {
  const o = oracle(scores, user, page, tops);
  const cs = toModule(user);
  const m = S.applyScenario(scores, cs.scenario, ctxOf(page, tops));
  if (o === null) { return ok(m.final === null, `${label}: no final when a counted quarter is missing`); }
  if (!m.final) return ok(false, `${label}: module gave no final, oracle ${o.final}`);
  const same = Math.abs(m.final.pct4 - asNumber(o.pct4.mul(F(10000)))) < 1e-9
    && Math.abs(m.final.qp4 - asNumber(o.qp4.mul(F(10000)))) < 1e-9
    && m.final.pctLetter === o.pL && m.final.qpLetter === o.qL && m.final.finalLetter === o.final
    && JSON.stringify(m.dropped) === JSON.stringify(o.dropped.slice().sort((a, b) => a - b));
  if (!same) console.log('  detail', JSON.stringify({ scores, user, page, tops, m: m.final, dropped: m.dropped, o: { pct4: asNumber(o.pct4), qp4: asNumber(o.qp4), pL: o.pL, qL: o.qL, f: o.final, dropped: o.dropped } }));
  return ok(same, `${label}: module equals the oracle`);
}

console.log('Final Grade Checker: scenario arithmetic');

// ── 0. what was already there is untouched ──────────────────────────────────
eq(mathHash(), OLD_MATH_HASH, 'grade-math.mjs gives the same answers as before the scenario code existed (hash of 4,000 seeded books, 9 option sets)');

// ── 1. hand-worked cases, each from the rules in English ────────────────────
const PAGE0 = { boundary: 'half', precision: null, weights: null };
const U0 = { dropN: 0, mode: 'none', points: 0, apply: 'all', extra: false, weights: null };
const run = (scores, user, page = PAGE0, tops = [null, null, null, null]) => {
  const cs = toModule({ ...U0, ...user });
  return S.applyScenario(scores, cs.scenario, ctxOf(page, tops));
};

// drop
{
  const r = run([95, 95, 95, 40], { dropN: 1 });
  eq(r.dropped, [3], 'drop 1: the 40 is the quarter left out');
  eq(r.final.pctAvg, 95, 'drop 1: the average of what is left, 95');
  eq(r.final.finalLetter, 'A', 'drop 1: an A');
  const r2 = run([90, 70, 60, 80], { dropN: 2 });
  eq(r2.dropped, [1, 2], 'drop 2: the 70 and the 60');
  eq(r2.final.pctAvg, 85, 'drop 2: (90+80)/2 = 85');
  const r3 = run([90, 70, 60, 80], { dropN: 3 });
  eq(r3.dropped, [1, 2, 3].filter(i => i !== 0), 'drop 3 leaves one quarter, the best');
  eq(r3.final.pctAvg, 90, 'drop 3: only the 90 remains');
  const r4 = run([90, 70, 60, 80], { dropN: 99 });
  eq(r4.dropped.length, 3, 'a drop past the limit still leaves one quarter');
  const tie = run([80, 80, 80, 80], { dropN: 2 });
  eq(tie.dropped, [0, 1], 'ties: the earlier quarters are dropped first');
}
// curve
{
  const r = run([84.5, 84.5, 84.5, 84.5], { mode: 'plus', points: 5 });
  eq(r.final.pctAvg, 89.5, 'plus 5 on 84.5 is exactly 89.5');
  eq(r.final.finalLetter, 'A', 'and 89.5 is an A, as it is on the page');
  const strict = run([84.5, 84.5, 84.5, 84.5], { mode: 'plus', points: 5 }, { ...PAGE0, boundary: 'strict' });
  eq(strict.final.finalLetter, 'B', 'under strict rounding the same 89.5 stays a B');
  const cap = run([98, 98, 98, 98], { mode: 'plus', points: 5 });
  eq(cap.final.pctAvg, 100, 'a curve stops at 100');
  const xc = run([98, 98, 98, 98], { mode: 'plus', points: 5, extra: true });
  eq(xc.final.pctAvg, 103, 'with extra credit allowed it does not');
  const neg = run([3, 3, 3, 3], { mode: 'plus', points: -5 });
  eq(neg.final.pctAvg, 0, 'and never goes below 0');
  const top = run([80, 80, 80, 80], { mode: 'top' }, PAGE0, [80, 80, 80, 80]);
  eq(top.final.pctAvg, 100, 'scaling so the top (80) becomes 100 makes 80 into 100');
  const top2 = run([60, 80, 80, 80], { mode: 'top', apply: 0 }, PAGE0, [75, 80, 80, 80]);
  eq(top2.scoresH, [8000, 8000, 8000, 8000], 'scaling Q1 only: 60 x 100/75 = 80, the others untouched');
  const zero = run([50, 50, 50, 50], { mode: 'top' }, PAGE0, [0, 0, 0, 0]);
  eq(zero.final.pctAvg, 50, 'a top of 0 scales nothing');
}
// weight
{
  const r = run([100, 0, 0, 0], { weights: [3, 1, 1, 1] });
  eq(r.final.pctAvg, 50, 'weights 3/1/1/1: (3x100)/6 = 50, no need to add to 100');
  const z = run([90, 50, 50, 50], { weights: [1, 0, 0, 0] });
  eq(z.final.pctAvg, 90, 'a weight of 0 leaves the quarter out: only Q1 counts');
  eq(z.counted, [0], 'and says which quarters counted');
  const miss = run([90, null, null, null], { weights: [1, 0, 0, 0] });
  eq(miss.final === null, false, 'a quarter with no weight need not be on file');
  const miss2 = run([90, null, 80, 80], {});
  eq(miss2.final, null, 'a quarter that counts and is missing: no final, as on the page');
  const bad = S.cleanScenario({ weights: [1, -1, 1, 1] });
  eq(bad.scenario.weights, null, 'negative weights are refused');
  ok(bad.problems.length === 1, 'and the reason is named');
  eq(S.cleanScenario({ weights: [0, 0, 0, 0] }).scenario.weights, null, 'all-zero weights are refused');
  eq(S.cleanScenario({ weights: [1, 'x', 1, 1] }).scenario.weights, null, 'a weight that is not a number is refused');
  eq(S.cleanScenario({ weights: [1, 2, 3] }).scenario.weights, null, 'three weights are refused');
}
// the order is drop, then curve, then weight
{
  // Q1 is the lowest only before the curve: scaling Q1 up by 100/50 would lift it above Q2
  const r = run([50, 60, 90, 90], { dropN: 1, mode: 'top', apply: 0 }, PAGE0, [50, 60, 90, 90]);
  eq(r.dropped, [0], 'the drop looks at the entered scores, before the curve');
  eq(r.final.pctAvg, 80, 'and only then is the curve applied, to what was kept (Q1 is gone)');
  // weights leave Q4 out, so Q4 is never the dropped one
  const w = run([90, 80, 70, 10], { dropN: 1, weights: [1, 1, 1, 0] });
  eq(w.dropped, [2], 'a quarter with no weight is never dropped');
}
// rounding at a letter boundary
{
  const r = run([89.5, 89.5, 89.5, 89.5], {});
  eq(r.final.finalLetter, 'A', '89.5 is an A');
  const r2 = run([89.49, 89.49, 89.49, 89.49], {});
  eq(r2.final.finalLetter, 'B', '89.49 is a B');
  const r3 = run([89.5, 89.5, 89.5, 89.49], {});
  eq(r3.final.pctAvg, 89.4975, 'an average held to four decimals');
  eq(r3.final.pctLetter, 'B', '89.4975 is a B by percentage');
  eq(r3.final.finalLetter, 'A', 'but three A letters average 3.75 quality points, which is the higher figure, so the final is an A');
}

// ── 2. the parity: no scenario is the page's own answer ─────────────────────
{
  const r = rng(404);
  const PAGES = [
    { boundary: 'half', precision: null, weights: null }, { boundary: 'strict', precision: null, weights: null },
    { boundary: 'half', precision: 0, weights: null }, { boundary: 'half', precision: 1, weights: [40, 20, 20, 20] },
    { boundary: 'strict', precision: 1, weights: [10, 20, 30, 40] }, { boundary: 'half', precision: null, weights: [0, 25, 25, 25] },
  ];
  let bad = 0, n = 0;
  for (let i = 0; i < 60000; i++) {
    const page = PAGES[i % PAGES.length];
    const sc = [0, 1, 2, 3].map(() => (r() < 0.08 ? null : r() < 0.2 ? [59.5, 69.5, 79.5, 89.5, 89.45, 59.45][Math.floor(r() * 6)] : Math.round(r() * 10000) / 100));
    const real = G.calcFinals(sc, { boundary: page.boundary, precision: page.precision, weights: page.weights });
    const m = S.applyScenario(sc, S.NO_SCENARIO, ctxOf(page, [null, null, null, null])).final;
    n++;
    if (!real !== !m) { bad++; continue; }
    if (real && (real.finalLetter !== m.finalLetter || real.pctFinal !== m.pctLetter || real.qpFinal !== m.qpLetter
        || Math.round(real.pctAvg * 10000) !== m.pct4 || Math.round(real.avgQP * 10000) !== m.qp4)) bad++;
  }
  eq(bad, 0, `no scenario equals the page's own calcFinals in ${n} books under 6 settings`);
}

// ── 3. thousands of seeded books against the oracle ─────────────────────────
{
  const r = rng(31337);
  const pick = a => a[Math.floor(r() * a.length)];
  const BOUNDARY = ['half', 'strict'];
  const PREC = [null, null, 0, 1];
  const PAGEW = [null, null, [40, 20, 20, 20], [10, 20, 30, 40], [0, 25, 25, 25]];
  let count = 0;
  for (let i = 0; i < 6000; i++) {
    const nStudents = 1 + Math.floor(r() * 6);
    const students = Array.from({ length: nStudents }, () => [0, 1, 2, 3].map(() =>
      r() < 0.07 ? null
        : r() < 0.25 ? pick([0, 100, 59.5, 69.5, 79.5, 89.5, 89.49, 59.45, 79.5]) + (r() < 0.5 ? 0 : pick([-0.5, 0.5, -0.01, 0.01, 1]))
        : Math.round(r() * 10000) / 100).map(v => (v === null ? null : Math.max(0, Math.min(100, Math.round(v * 100) / 100)))));
    // the class's tops, read the way the module reads them
    const tops = [0, 1, 2, 3].map(q => { let t = null; students.forEach(s => { if (s[q] !== null && (t === null || s[q] > t)) t = s[q]; }); return t; });
    const page = { boundary: pick(BOUNDARY), precision: pick(PREC), weights: pick(PAGEW) };
    const mode = pick(['none', 'plus', 'plus', 'top']);
    const user = {
      dropN: pick([0, 0, 1, 2, 3, 5]), mode,
      points: mode === 'plus' ? pick([0, 1, 2.5, 5, 10, -3, -10, 0.01, 4.99, 50]) : 0,
      apply: pick(['all', 'all', 0, 1, 2, 3]), extra: r() < 0.3,
      weights: r() < 0.4 ? [0, 1, 2, 3].map(() => pick([0, 1, 1, 2, 5, 25, 33.33, 0.5])) : null,
    };
    if (user.weights && user.weights.every(x => x === 0)) user.weights[pick([0, 1, 2, 3])] = 1;
    for (const sc of students) { count++; if (!compare(sc, user, page, tops, `book ${i}`)) break; }
  }
  ok(count > 15000, `compared ${count} students`);
}

// ── 4. the class view ───────────────────────────────────────────────────────
{
  const students = [
    { name: 'Ash', scores: [89, 89, 89, 89] }, { name: 'Birch', scores: [79, 79, 79, 79] },
    { name: 'Cedar', scores: [95, 95, 95, 95] }, { name: 'Dune', scores: [88, 85, 84, null] },
  ];
  const frozen = JSON.stringify(students);
  students.forEach(s => Object.freeze(s.scores));
  const cs = S.cleanScenario({ curve: { mode: 'plus', points: 100, apply: 'all', extra: false } });
  const c = S.compareClass(students, cs.scenario, { boundary: 'half', precision: null, weights: null });
  eq(c.rows.map(x => x.moved), ['up', 'up', 'same', null], '+1 point: Ash and Birch move up, Cedar stays, Dune has no final');
  eq(c.up, 2, 'two up');
  eq(c.noFinal, 1, 'one without a final');
  eq(c.rows[0].diffPct, 1, 'the difference in the percentage average is 1 point');
  eq(c.letters.before, { A: 1, B: 1, C: 1, D: 0, F: 0, none: 1 }, 'letters before');
  eq(c.letters.after, { A: 2, B: 1, C: 0, D: 0, F: 0, none: 1 }, 'letters after');
  eq(JSON.stringify(students), frozen, 'the entered scores are exactly as they were (and were frozen)');
  const tops = S.classTops(students);
  eq(tops, [9500, 9500, 9500, 9500], 'the class top per quarter, in hundredths');
}

// ── 5. words ─────────────────────────────────────────────────────────────────
{
  ok(/No scenario is on/.test(S.describeScenario(S.NO_SCENARIO)), 'an off scenario says so');
  const d = S.describeScenario(toModule({ ...U0, dropN: 1, mode: 'plus', points: 2, weights: [1, 2, 3, 4] }).scenario);
  ok(d.indexOf('drop') >= 0 && d.indexOf('drop') < d.indexOf('add') && d.indexOf('add') < d.indexOf('weights'), 'the sentence names drop, then curve, then weights');
  ok(/stop at 100/.test(d), 'and says where scores stop');
}

// ── 6. the limits, and what counts as a scenario ────────────────────────────
{
  const hi = S.cleanScenario({ curve: { mode: 'plus', points: 9000 } });
  eq(hi.scenario.curve.points, 5000, 'a flat curve is held to 50 points');
  eq(hi.problems.length, 1, 'and says so');
  const lo = S.cleanScenario({ curve: { mode: 'plus', points: -9000 } });
  eq(lo.scenario.curve.points, -5000, 'and 50 points down');
  const dn = S.cleanScenario({ dropN: 7 });
  eq([dn.scenario.dropN, dn.problems.length], [3, 1], 'a drop of 7 is held to 3 and named');
  const dm = S.cleanScenario({ dropN: -1 });
  eq([dm.scenario.dropN, dm.problems.length], [0, 1], 'a drop of -1 is held to 0 and named');
  eq(S.cleanScenario(null).scenario, S.NO_SCENARIO, 'nothing typed is no scenario');
  eq(S.cleanScenario({ curve: { mode: 'bogus' } }).scenario.curve.mode, 'none', 'an unknown curve is off');
  eq(S.isNoScenario(S.NO_SCENARIO), true, 'no scenario is no scenario');
  eq(S.isNoScenario({ dropN: 0, curve: { mode: 'none' }, weights: [1, 1, 1, 1] }), false, 'weights alone are a scenario');
  eq(S.isNoScenario({ dropN: 1, curve: { mode: 'none' }, weights: null }), false, 'so is a drop');
  eq(S.isNoScenario({ dropN: 0, curve: { mode: 'plus', points: 1 }, weights: null }), false, 'and a curve');
  // a tie between the two methods goes to quality points
  eq(run([89.5, 89.5, 89.5, 89.5], {}).final.winner, 'QP', 'a tie between the two figures is reported as quality points');
  eq(run([100, 100, 100, 100], {}).final.winner, 'QP', 'and so is 100 across the board');
  eq(run([100, 100, 79.4, 79.4], {}).final.winner, 'PCT', 'the percentage figure is reported when it is the higher (89.7 is an A; 3.0 quality points is a B)');
  // the class top ignores a score outside 0 to 100
  eq(S.classTops([{ scores: [105, -4, 50, null] }, { scores: [60, 20, null, null] }]), [6000, 2000, 5000, null], 'the class top ignores a score outside 0 to 100');
  // a move down is called a move down
  const dwn = S.compareClass([{ name: 'Ash', scores: [89, 89, 89, 89] }],
    S.cleanScenario({ curve: { mode: 'plus', points: -1000 } }).scenario, { boundary: 'half', precision: null, weights: null });
  eq(dwn.rows[0].moved, 'down', 'a letter that falls is a move down');
  eq([dwn.up, dwn.down, dwn.same], [0, 1, 0], 'counted as one down');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
