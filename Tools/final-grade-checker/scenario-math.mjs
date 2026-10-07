// scenario-math.mjs — the Final Grade Checker's scenario model: drop, curve,
// re-weight. Nothing in here touches the DOM, and nothing in here writes to a
// score: every function takes the entered quarters and returns new numbers.
//
// WHAT THIS TOOL GRADES. Four quarter percentages per student, not categories
// of assignments, so "category" below means the four quarters and "assessment"
// means a quarter. The three scenarios, in the one order they always apply:
//
//   1. DROP   leave each student's lowest N quarters out of both averages.
//             N is 0 up to one fewer than the quarters that count, so one
//             always stays. The lowest is the lowest score; a tie drops the
//             earlier quarter first. A quarter with no weight is never counted
//             and never dropped. A quarter with no score cannot be dropped:
//             a student missing a counted quarter still has no final.
//   2. CURVE  on the quarters that were kept, either add a flat number of
//             percentage points, or scale so the highest score the class has
//             in that quarter becomes 100 (score x 100 / top). It applies to
//             every quarter or to one. A curved score is rounded to the
//             hundredth, never goes below 0, and stops at 100 unless extra
//             credit is allowed, when it stops at 200. A top of 0 scales
//             nothing.
//   3. WEIGHT each kept quarter counts its weight divided by the total of the
//             kept weights, so weights need not add to 100. A weight of 0 leaves
//             that quarter out. Weights that are negative, not numbers, or all
//             zero are refused, and the page's own weights are used instead.
//
// THE ARITHMETIC IS IN WHOLE NUMBERS. A score is hundredths of a percent, a
// weight is hundredths, and an average is held in ten-thousandths of a percent
// after rounding half up, which is the county rule's own "compare at four
// decimals" (grade-math.mjs, PRECISION). Nothing is compared as a float, so a
// student sitting on 89.5 exactly is an A in a scenario for the same reason
// they are an A on the page. The same cutoffs, the same ten-point scale, the
// same higher-of-two rule, the same tie to quality points.

import {
  LETTER_CUTOFFS, LETTER_CUTOFFS_STRICT, QP_CUTOFFS, QP_CUTOFFS_STRICT,
  RANK, QUARTERS, calcFinals,
} from './grade-math.mjs';

export const EXTRA_CREDIT_CEILING = 200;      // percent, per quarter
export const NORMAL_CEILING = 100;
export const MAX_DROP = QUARTERS - 1;
export const MAX_POINTS = 50;                 // the most a flat curve may add or take
export const EQUAL_WEIGHT = 2500;             // 25.00, in hundredths

const QP_OF = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const LETTERS_DESC = ['A', 'B', 'C', 'D'];

/** Rounds n/d half up, for whole numbers n >= 0 and d > 0. */
export function divRound(n, d) { return Math.floor((2 * n + d) / (2 * d)); }

/** A percentage or weight typed by a person, in hundredths, or null. */
export function toHundredths(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

const cutoffs4 = table => Object.fromEntries(table.map(([l, c]) => [l, Math.round(c * 10000)]));
const LETTER4 = { half: cutoffs4(LETTER_CUTOFFS), strict: cutoffs4(LETTER_CUTOFFS_STRICT) };
const QP4 = { half: cutoffs4(QP_CUTOFFS), strict: cutoffs4(QP_CUTOFFS_STRICT) };

/** Rounds a ten-thousandths value to `decimals` places (0 or 1), or leaves it. */
function roundPlaces(x4, decimals) {
  if (decimals === null || decimals === undefined) return x4;
  const unit = Math.pow(10, 4 - decimals);
  return divRound(x4, unit) * unit;
}

function letterFrom4(x4, table, boundary, decimals) {
  const v = roundPlaces(x4, decimals);
  const cut = table[boundary === 'strict' ? 'strict' : 'half'];
  for (const l of LETTERS_DESC) if (v >= cut[l]) return l;
  return 'F';
}

/** The letter for a score held in hundredths (ten-point scale, county rounding). */
export function scoreLetter(h, ctx) {
  const c = ctx || {};
  return letterFrom4(h * 100, LETTER4, c.boundary, c.precision);
}

// ── Scenario: its shape, its checks, its words ───────────────────────────────

export const NO_SCENARIO = Object.freeze({
  dropN: 0,
  curve: Object.freeze({ mode: 'none', points: 0, apply: 'all', extra: false }),
  weights: null,
});

/**
 * A scenario in the one shape the rest of this file reads, from whatever was
 * typed or loaded. Nothing is guessed: anything unreadable becomes "off" and is
 * named in `problems`. `weights` is null (use the page's) or four hundredths.
 */
export function cleanScenario(raw) {
  const problems = [];
  const s = raw && typeof raw === 'object' ? raw : {};
  let dropN = Number.isInteger(s.dropN) ? s.dropN : 0;
  if (dropN < 0 || dropN > MAX_DROP) { problems.push(`Drop must be 0 to ${MAX_DROP}.`); dropN = Math.max(0, Math.min(MAX_DROP, dropN)); }

  const c = s.curve && typeof s.curve === 'object' ? s.curve : {};
  const mode = c.mode === 'plus' || c.mode === 'top' ? c.mode : 'none';
  let points = Number.isInteger(c.points) ? c.points : 0;
  if (Math.abs(points) > MAX_POINTS * 100) {
    problems.push(`A flat curve can add or take at most ${MAX_POINTS} points.`);
    points = Math.sign(points) * MAX_POINTS * 100;
  }
  const apply = Number.isInteger(c.apply) && c.apply >= 0 && c.apply < QUARTERS ? c.apply : 'all';

  let weights = null;
  if (s.weights !== null && s.weights !== undefined) {
    const w = checkWeights(s.weights);
    if (w.ok) weights = w.hundredths;
    else problems.push(w.reason);
  }
  return {
    scenario: { dropN, curve: { mode, points, apply, extra: !!c.extra }, weights },
    problems,
  };
}

/** Weights typed for the scenario: four numbers >= 0, not all zero. */
export function checkWeights(arr) {
  if (!Array.isArray(arr) || arr.length !== QUARTERS) return { ok: false, reason: 'There must be four weights.' };
  const hundredths = arr.map(toHundredths);
  if (hundredths.some(h => h === null)) return { ok: false, reason: 'Every weight must be a number.' };
  if (hundredths.some(h => h < 0)) return { ok: false, reason: 'A weight cannot be negative.' };
  if (hundredths.every(h => h === 0)) return { ok: false, reason: 'The weights cannot all be zero.' };
  return { ok: true, hundredths };
}

export function isNoScenario(s) {
  return !s || (!s.dropN && (!s.curve || s.curve.mode === 'none') && !s.weights);
}

/** The weights in force, in hundredths: the scenario's if it has any, else the
 *  page's Grading Settings (used only if every one is above 0, as calcFinals
 *  does), else an equal 25 each. */
export function effectiveWeights(scenario, pageWeights) {
  if (scenario && scenario.weights) return scenario.weights.slice();
  if (Array.isArray(pageWeights) && pageWeights.length === QUARTERS
      && pageWeights.every(w => Number.isFinite(w) && w > 0)) return pageWeights.map(w => Math.round(w * 100));
  return new Array(QUARTERS).fill(EQUAL_WEIGHT);
}

/** The highest entered score in each quarter across the class, in hundredths
 *  (null where nobody has one). The "top score" a scale-to-100 curve uses. */
export function classTops(students) {
  const tops = new Array(QUARTERS).fill(null);
  for (const st of students || []) {
    (st.scores || []).forEach((v, q) => {
      const h = toHundredths(v);
      if (h === null || h < 0 || h > NORMAL_CEILING * 100) return;
      if (tops[q] === null || h > tops[q]) tops[q] = h;
    });
  }
  return tops;
}

// ── One student ──────────────────────────────────────────────────────────────

/**
 * The scenario applied to one student's four quarters.
 *
 * @param scores   four percentages or null, as the page holds them
 * @param scenario a cleanScenario() result
 * @param ctx      { boundary, precision (null|0|1), pageWeights, tops }
 * @returns { final: null | {pct4, qp4, pctAvg, avgQP, pctLetter, qpLetter, winner, finalLetter},
 *            reason, dropped: [quarter index], counted: [quarter index],
 *            scoresH: [curved hundredths | null] }
 */
export function applyScenario(scores, scenario, ctx) {
  const c = ctx || {};
  const sc = scenario || NO_SCENARIO;
  const w = effectiveWeights(sc, c.pageWeights);
  const counted = [];
  for (let i = 0; i < QUARTERS; i++) if (w[i] > 0) counted.push(i);

  const h = (scores || []).slice(0, QUARTERS).map(v => {
    const x = toHundredths(v);
    return x === null || x < 0 || x > NORMAL_CEILING * 100 ? null : x;
  });
  while (h.length < QUARTERS) h.push(null);

  const none = reason => ({ final: null, reason, dropped: [], counted, scoresH: h.map(() => null) });
  if (counted.some(i => h[i] === null)) return none('missing');

  // 1. drop: the lowest N, one always stays; a tie drops the earlier quarter
  const n = Math.max(0, Math.min(sc.dropN | 0, counted.length - 1));
  const dropped = counted.slice().sort((a, b) => h[a] - h[b] || a - b).slice(0, n).sort((a, b) => a - b);
  const kept = counted.filter(i => !dropped.includes(i));

  // 2. curve, on what was kept
  const cv = sc.curve || NO_SCENARIO.curve;
  const ceiling = (cv.extra ? EXTRA_CREDIT_CEILING : NORMAL_CEILING) * 100;
  const curved = h.map(() => null);
  for (const i of kept) {
    let x = h[i];
    if (cv.mode !== 'none' && (cv.apply === 'all' || cv.apply === i)) {
      if (cv.mode === 'plus') x = x + cv.points;
      else if (cv.mode === 'top') {
        const top = c.tops && c.tops[i];
        if (top > 0) x = divRound(x * 10000, top);
      }
      x = Math.max(0, Math.min(ceiling, x));
    }
    curved[i] = x;
  }

  // 3. weight: each kept quarter counts its share of the kept weights
  const W = kept.reduce((a, i) => a + w[i], 0);
  const S = kept.reduce((a, i) => a + w[i] * curved[i], 0);
  const Q = kept.reduce((a, i) => a + w[i] * QP_OF[scoreLetter(curved[i], c)], 0);
  const pct4 = divRound(S * 100, W);
  const qp4 = divRound(Q * 10000, W);
  const pctLetter = letterFrom4(pct4, LETTER4, c.boundary, c.precision);
  const qpLetter = letterFrom4(qp4, QP4, c.boundary, c.precision);
  const winner = RANK[qpLetter] >= RANK[pctLetter] ? 'QP' : 'PCT';
  return {
    final: {
      pct4, qp4, pctAvg: pct4 / 10000, avgQP: qp4 / 10000, pctLetter, qpLetter, winner,
      finalLetter: winner === 'QP' ? qpLetter : pctLetter,
    },
    reason: null, dropped, counted, scoresH: curved,
  };
}

// ── The class: before and after ──────────────────────────────────────────────

/**
 * One row per student: the real result from calcFinals() with the page's own
 * settings, the scenario's result, and the difference. Neither input is
 * changed; the students come back untouched.
 *
 * @param students [{ name, scores }]
 * @param pageOpts the page's calcOpts(): { boundary, precision, weights }
 */
export function compareClass(students, scenario, pageOpts) {
  const po = pageOpts || {};
  const ctx = {
    boundary: po.boundary, precision: po.precision === undefined ? null : po.precision,
    pageWeights: po.weights, tops: classTops(students),
  };
  const rows = (students || []).map(st => {
    const before = calcFinals(st.scores, po);
    const r = applyScenario(st.scores, scenario, ctx);
    const after = r.final;
    let diffPct = null, moved = null;
    if (before && after) {
      diffPct = (after.pct4 - Math.round(before.pctAvg * 10000)) / 10000;
      moved = RANK[after.finalLetter] === RANK[before.finalLetter] ? 'same'
        : RANK[after.finalLetter] > RANK[before.finalLetter] ? 'up' : 'down';
    }
    return { name: st.name, before, after, reason: r.reason, dropped: r.dropped, diffPct, moved };
  });
  const tally = key => {
    const t = { A: 0, B: 0, C: 0, D: 0, F: 0, none: 0 };
    rows.forEach(r => { const f = r[key]; if (f) t[f.finalLetter]++; else t.none++; });
    return t;
  };
  return {
    rows,
    up: rows.filter(r => r.moved === 'up').length,
    down: rows.filter(r => r.moved === 'down').length,
    same: rows.filter(r => r.moved === 'same').length,
    noFinal: rows.filter(r => !r.before || !r.after).length,
    letters: { before: tally('before'), after: tally('after') },
  };
}

// ── Words ────────────────────────────────────────────────────────────────────

const pts = h => (h / 100).toString();

/** The scenario in one sentence, in the order it is applied. */
export function describeScenario(s) {
  if (isNoScenario(s)) return 'No scenario is on: the results are the real ones.';
  const bits = [];
  if (s.dropN) bits.push(`drop each student’s lowest ${s.dropN === 1 ? 'quarter' : s.dropN + ' quarters'}`);
  const cv = s.curve;
  if (cv && cv.mode !== 'none') {
    const where = cv.apply === 'all' ? 'every quarter' : `Q${cv.apply + 1}`;
    if (cv.mode === 'plus') bits.push(`${cv.points >= 0 ? 'add' : 'take off'} ${pts(Math.abs(cv.points))} points on ${where}`);
    else bits.push(`scale ${where} so the class’s top score becomes 100`);
    bits.push(cv.extra ? 'scores may go above 100, to 200 at most' : 'scores stop at 100');
  }
  if (s.weights) bits.push(`weights ${s.weights.map(pts).join(' / ')}`);
  return 'Then, in this order: ' + bits.join('; ') + '.';
}
