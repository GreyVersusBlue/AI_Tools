/* Math Fact Drill Sheet Generator — problem generation.
   Pure functions, no DOM, so the actual math (answer correctness, no
   negative subtraction results, clean division, no duplicate problems on
   one sheet) can be unit-tested directly in Node before any UI touches it. */
(function (global) {
  'use strict';

  var SYMBOL = { add: '+', subtract: '−', multiply: '×', divide: '÷' };

  /* ---------- problem display ----------
     The four arithmetic operations are all `a symbol b = ?`, so the renderer
     could read the numbers straight off the problem. The types added later —
     fractions, percents, order of operations — are not that shape: a fraction
     has no single numeric operand, "20% of 45" has no operator symbol, and an
     order-of-operations problem is one expression rather than two operands.
     Rather than teach the renderer five special cases, every problem may
     carry `aText` / `bText` / `answerText` (and `expr` for a whole-expression
     problem), which the renderer prefers when present. `vertical: false` marks
     the ones that must not be stacked into a column-addition layout. */

  /** mulberry32 — small, fast, seedable PRNG so a sheet can be reprinted
      identically (same seed + same settings = same problems). Falls back to
      Math.random when no seed is given, which is the prior behavior. */
  function makeRng(seed) {
    if (seed == null) return Math.random;
    var state = seed >>> 0;
    return function () {
      state |= 0; state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /** One problem for a specific concrete operation (never 'mixed' itself). */
  function makeProblem(op, range1, range2, rng, typeOpts) {
    rng = rng || Math.random;
    typeOpts = typeOpts || {};
    var a, b, answer;
    if (op === 'add') {
      a = randInt(rng, range1.min, range1.max);
      b = randInt(rng, range2.min, range2.max);
      answer = a + b;
    } else if (op === 'subtract') {
      // Keep results non-negative: generate the larger value first as the
      // minuend, drawing both from the union of both configured ranges so
      // "operand2 range" still constrains how big the subtracted amount is.
      var hi = randInt(rng, Math.max(range1.min, range2.min), Math.max(range1.max, range2.max));
      var lo = randInt(rng, range2.min, Math.min(range2.max, hi));
      a = hi; b = lo;
      answer = a - b;
    } else if (op === 'multiply') {
      a = randInt(rng, range1.min, range1.max);
      b = randInt(rng, range2.min, range2.max);
      answer = a * b;
    } else if (op === 'divide') {
      // Build from the answer up so division always comes out even.
      var divisor = randInt(rng, Math.max(1, range2.min), Math.max(1, range2.max));
      var quotient = randInt(rng, range1.min, range1.max);
      a = divisor * quotient;
      b = divisor;
      answer = quotient;
    } else if (op === 'integer') {
      return makeIntegerProblem(range1, range2, rng);
    } else if (op === 'decimal') {
      return makeDecimalProblem(range1, range2, rng);
    } else if (op === 'fraction') {
      return makeFractionProblem(rng);
    } else if (op === 'percent') {
      return makePercentProblem(rng);
    } else if (op === 'ooo') {
      return makeOrderOfOpsProblem(rng);
    } else if (op === 'fracmuldiv') {
      return makeFractionMulDivProblem(rng, typeOpts);
    } else if (op === 'exponent') {
      return makeExponentProblem(range1, range2, rng, typeOpts);
    } else if (op === 'equation') {
      return makeEquationProblem(range1, range2, rng, typeOpts);
    } else {
      throw new Error('Unknown operation: ' + op);
    }
    return { a: a, b: b, op: op, symbol: SYMBOL[op], answer: answer };
  }

  function problemKey(p) {
    if (p.expr) return p.expr;
    return (p.aText != null ? p.aText : p.a) + p.op + (p.bText != null ? p.bText : p.b);
  }

  /* ---------- helpers for the non-integer types ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }

  /** A reduced fraction as the string a teacher would write on a key:
      whole numbers plain, improper fractions as mixed numbers. */
  function fractionText(num, den) {
    if (num === 0) return '0';
    var g = gcd(num, den);
    num /= g; den /= g;
    if (den === 1) return String(num);
    var whole = Math.trunc(num / den);
    var rem = Math.abs(num % den);
    if (whole === 0) return num + '/' + den;
    return whole + ' ' + rem + '/' + den;
  }

  /** Round to `places` decimals and drop a trailing ".0" so an answer that
      happens to land on a whole number prints as one. */
  function decimalText(value, places) {
    var f = Math.pow(10, places);
    var v = Math.round(value * f) / f;
    return String(v);
  }

  var FRACTION_DENOMS = [2, 3, 4, 5, 6, 8, 10, 12];
  var PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80];

  /** Signed whole numbers. Negative operands are parenthesised on the right
      of the operator, the way they are written on a worksheet: 5 − (−3). */
  function makeIntegerProblem(range1, range2, rng) {
    var op = pick(rng, ['add', 'subtract', 'multiply']);
    var mag1 = randInt(rng, Math.max(1, range1.min), Math.max(1, range1.max));
    var mag2 = randInt(rng, Math.max(1, range2.min), Math.max(1, range2.max));
    var a = rng() < 0.5 ? -mag1 : mag1;
    var b = rng() < 0.5 ? -mag2 : mag2;
    var answer = op === 'add' ? a + b : op === 'subtract' ? a - b : a * b;
    return {
      a: a, b: b, op: op, symbol: SYMBOL[op], answer: answer,
      aText: String(a), bText: b < 0 ? '(' + b + ')' : String(b), answerText: String(answer),
      vertical: false
    };
  }

  /** One-decimal-place operands. Add and subtract keep one place; multiply
      pairs a decimal with a whole number so the answer stays at one place
      rather than drifting to two. Everything is computed in tenths and
      divided at the end, so no answer arrives with float noise on it. */
  function makeDecimalProblem(range1, range2, rng) {
    var op = pick(rng, ['add', 'subtract', 'multiply']);
    var aT = randInt(rng, Math.max(1, range1.min) * 10, Math.max(1, range1.max) * 10);
    var a = aT / 10, b, answerT;
    if (op === 'multiply') {
      b = randInt(rng, Math.max(2, range2.min), Math.max(2, range2.max));
      answerT = aT * b;
    } else {
      var bT = randInt(rng, Math.max(1, range2.min) * 10, Math.max(1, range2.max) * 10);
      if (op === 'subtract' && bT > aT) { var swap = aT; aT = bT; bT = swap; a = aT / 10; }
      b = bT / 10;
      answerT = op === 'add' ? aT + bT : aT - bT;
    }
    var answer = answerT / 10;
    return {
      a: a, b: b, op: op, symbol: SYMBOL[op], answer: answer,
      aText: decimalText(a, 1), bText: op === 'multiply' ? String(b) : decimalText(b, 1),
      answerText: decimalText(answer, 1), vertical: false
    };
  }

  /** Proper fractions, added or subtracted, answer reduced. Subtraction is
      ordered so the result is never negative — the same rule the whole-number
      subtraction above follows. */
  function makeFractionProblem(rng) {
    var op = rng() < 0.5 ? 'add' : 'subtract';
    var d1 = pick(rng, FRACTION_DENOMS), d2 = pick(rng, FRACTION_DENOMS);
    var n1 = randInt(rng, 1, d1 - 1), n2 = randInt(rng, 1, d2 - 1);
    var lhs = n1 * d2, rhs = n2 * d1, den = d1 * d2;
    if (op === 'subtract' && rhs > lhs) {
      var tn = n1, td = d1; n1 = n2; d1 = d2; n2 = tn; d2 = td;
      lhs = n1 * d2; rhs = n2 * d1;
    }
    var num = op === 'add' ? lhs + rhs : lhs - rhs;
    return {
      a: n1 / d1, b: n2 / d2, op: op, symbol: SYMBOL[op], answer: num / den,
      aText: n1 + '/' + d1, bText: n2 + '/' + d2, answerText: fractionText(num, den),
      vertical: false
    };
  }

  /** "20% of 60". The base is a multiple of 20 so every percent on the list
      lands on a whole number — a fluency drill should be about the percent,
      not about long division. */
  function makePercentProblem(rng) {
    var pct = pick(rng, PERCENTS);
    var base = randInt(rng, 1, 10) * 20;
    var answer = pct * base / 100;
    return {
      a: pct, b: base, op: 'percent', symbol: 'of', answer: answer,
      aText: pct + '%', bText: String(base), answerText: String(answer),
      vertical: false
    };
  }

  /** Three-term expressions where the order matters: a + b × c, (a + b) × c,
      a × b − c, a + b ÷ c. Numbers are kept small and the division case is
      built from its quotient, so every answer is a whole number and the
      problem is about precedence rather than arithmetic. */
  function makeOrderOfOpsProblem(rng) {
    var shape = pick(rng, ['mulThenAdd', 'parenAdd', 'mulThenSub', 'divThenAdd']);
    var a, b, c, expr, answer;
    if (shape === 'mulThenAdd') {
      a = randInt(rng, 1, 12); b = randInt(rng, 2, 9); c = randInt(rng, 2, 9);
      expr = a + ' + ' + b + ' × ' + c; answer = a + b * c;
    } else if (shape === 'parenAdd') {
      a = randInt(rng, 1, 9); b = randInt(rng, 1, 9); c = randInt(rng, 2, 9);
      expr = '(' + a + ' + ' + b + ') × ' + c; answer = (a + b) * c;
    } else if (shape === 'mulThenSub') {
      b = randInt(rng, 2, 9); c = randInt(rng, 2, 9);
      /* Drawn from below the product, not from a fixed 1-12: 2 × 2 − 9 is a
         negative answer on a sheet whose other four types are non-negative. */
      a = randInt(rng, 1, Math.min(12, b * c));
      expr = b + ' × ' + c + ' − ' + a; answer = b * c - a;
    } else {
      c = randInt(rng, 2, 9);
      var q = randInt(rng, 2, 9);
      b = c * q;
      a = randInt(rng, 1, 12);
      expr = a + ' + ' + b + ' ÷ ' + c; answer = a + q;
    }
    return {
      a: a, b: b, op: 'ooo', symbol: '', answer: answer,
      expr: expr, answerText: String(answer), vertical: false
    };
  }

  /* ---------- fraction multiplication and division ----------
     Operands are held as exact integer pairs (n over d), never as floats, so
     the product or quotient is reduced by gcd on integers and the answer text
     comes from the same fractionText() the addition drill uses: whole numbers
     plain, improper results as mixed numbers. */

  /** One operand: { n, d, text }, n/d its exact value (improper when mixed). */
  function fractionOperand(rng, kind) {
    if (kind === 'whole') {
      var w = randInt(rng, 2, 9);
      return { n: w, d: 1, text: String(w) };
    }
    /* Operands are in lowest terms (4/8 would be a reduction exercise of its
       own), so the numerator is redrawn until it shares no factor with d. */
    var d = pick(rng, FRACTION_DENOMS), n;
    do { n = randInt(rng, 1, d - 1); } while (gcd(n, d) !== 1);
    if (kind === 'mixed') {
      var whole = randInt(rng, 1, 3);
      return { n: whole * d + n, d: d, text: whole + ' ' + n + '/' + d };
    }
    return { n: n, d: d, text: n + '/' + d };
  }

  /** opts.fracOp 'both' | 'multiply' | 'divide'; opts.fracMixed lets an operand
      be a mixed number; opts.fracWhole lets one (never both) be a whole-number
      factor. Every operand is at least 1/12 and never zero, so a divisor is
      never zero. */
  function makeFractionMulDivProblem(rng, opts) {
    var op = opts.fracOp === 'multiply' ? 'multiply'
      : opts.fracOp === 'divide' ? 'divide'
      : (rng() < 0.5 ? 'multiply' : 'divide');
    var kinds = ['proper', 'proper'];
    if (opts.fracMixed === true) {
      if (rng() < 0.5) kinds[0] = 'mixed';
      if (rng() < 0.5) kinds[1] = 'mixed';
    }
    if (opts.fracWhole === true && rng() < 0.4) kinds[rng() < 0.5 ? 0 : 1] = 'whole';
    var x = fractionOperand(rng, kinds[0]), y = fractionOperand(rng, kinds[1]);
    var num = op === 'multiply' ? x.n * y.n : x.n * y.d;
    var den = op === 'multiply' ? x.d * y.d : x.d * y.n;
    return {
      a: x.n / x.d, b: y.n / y.d, op: op, symbol: SYMBOL[op], answer: num / den,
      aText: x.text, bText: y.text, answerText: fractionText(num, den),
      vertical: false, wrap: true
    };
  }

  /* ---------- exponents ----------
     The largest answer a sheet will print. A teacher's bounds that would go
     past it lose the exponents (then the bases) that do not fit. */
  var MAX_POWER_RESULT = 1000000;

  function toInt(v, fallback) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : fallback;
  }

  /** b to the e as an exact integer, or -1 if it is past MAX_POWER_RESULT. */
  function powerWithinCap(b, e) {
    var r = 1;
    for (var i = 0; i < e; i++) { r *= b; if (r > MAX_POWER_RESULT) return -1; }
    return r;
  }

  function powerSpeech(b, e) {
    return b + (e === 2 ? ' squared' : e === 3 ? ' cubed' : ' to the power of ' + e);
  }

  /** Base from the operand 1 range, exponent from the operand 2 range.
      opts.expPreset 'custom' | 'squares' (exponent 2) | 'cubes' (exponent 3) |
      'tens' (base 10, exponent from the range). Exponents under 2 only appear
      when opts.expAllowLow is true (then 0 and 1 join the range). */
  function makeExponentProblem(range1, range2, rng, opts) {
    var preset = opts.expPreset === 'squares' || opts.expPreset === 'cubes' || opts.expPreset === 'tens' ? opts.expPreset : 'custom';
    var bLo = Math.max(1, toInt(range1.min, 2)), bHi = Math.min(999, Math.max(bLo, toInt(range1.max, bLo)));
    var eLo = Math.max(0, toInt(range2.min, 2)), eHi = Math.min(999, Math.max(eLo, toInt(range2.max, eLo)));
    var allowLow = opts.expAllowLow === true;
    if (preset === 'tens') { bLo = 10; bHi = 10; }
    var exps = [], e;
    if (preset === 'squares') exps = [2];
    else if (preset === 'cubes') exps = [3];
    else {
      for (e = eLo; e <= eHi; e++) if (e >= 2) exps.push(e);
      if (allowLow) exps = [0, 1].concat(exps.filter(function (v) { return v >= 2; }));
    }
    /* An exponent range wholly under 2, with the low powers not asked for, has
       nothing left: the sheet uses squares rather than going under 2. */
    if (!exps.length) exps = [2];
    var fitting = exps.filter(function (v) { return powerWithinCap(bLo, v) > 0; });
    if (!fitting.length) {
      /* Nothing in the teacher's bounds fits under the cap: keep the smallest
         exponent and lower the base instead of printing a huge answer. */
      fitting = [exps[0]];
      bLo = 1;
    }
    e = pick(rng, fitting);
    var hi = bHi;
    while (hi > bLo && powerWithinCap(hi, e) < 0) hi--;
    var b = randInt(rng, bLo, hi);
    var answer = powerWithinCap(b, e);
    return {
      a: b, b: e, op: 'exponent', symbol: '^', answer: answer,
      expr: b + '^' + e, html: b + '<sup>' + e + '</sup>', speak: powerSpeech(b, e),
      answerText: String(answer), vertical: false, wrap: true
    };
  }

  /* ---------- one-step equations ----------
     The unknown is isolated in one step. Built from the answer up, so a
     solution is a whole number unless the teacher asks for fractions (and then
     only in a x = b, where a does not divide b). Operand 1 range: the size of
     x (for x ÷ a, of the number on the right). Operand 2 range: the size of
     the number a in the equation (at least 2 for a x and x ÷ a). */
  function makeEquationProblem(range1, range2, rng, opts) {
    var forms = opts.eqForms === 'addsub' ? ['add', 'sub']
      : opts.eqForms === 'muldiv' ? ['mul', 'div'] : ['add', 'sub', 'mul', 'div'];
    var form = pick(rng, forms);
    var negatives = opts.eqNegatives === true, fractions = opts.eqFractions === true;
    var small = form === 'add' || form === 'sub';
    var xLo = Math.max(1, toInt(range1.min, 1)), xHi = Math.max(xLo, toInt(range1.max, xLo));
    var aLo = Math.max(small ? 1 : 2, toInt(range2.min, 1)), aHi = Math.max(aLo, toInt(range2.max, aLo));
    var neg = negatives && rng() < 0.5;
    var sign = neg ? -1 : 1;
    var x, a, b, expr, answerText;
    if (form === 'add') {
      x = sign * randInt(rng, xLo, xHi); a = randInt(rng, aLo, aHi); b = x + a;
      expr = 'x + ' + a + ' = ' + b;
    } else if (form === 'sub') {
      if (negatives) {
        x = sign * randInt(rng, xLo, xHi); a = randInt(rng, aLo, aHi);
      } else {
        /* b stays positive: a is drawn below the top of x's range, x above a. */
        a = randInt(rng, aLo, Math.max(aLo, Math.min(aHi, xHi - 1)));
        x = randInt(rng, Math.max(xLo, a + 1), Math.max(xHi, a + 1));
      }
      b = x - a;
      expr = 'x − ' + a + ' = ' + b;
    } else if (form === 'mul') {
      a = randInt(rng, aLo, aHi);
      if (fractions && rng() < 0.5) {
        var q = randInt(rng, 0, xHi - 1), r = randInt(rng, 1, a - 1);
        b = sign * (a * q + r);
        answerText = fractionText(b, a); x = b / a;
      } else {
        x = sign * randInt(rng, xLo, xHi); b = a * x;
      }
      expr = a + 'x = ' + b;
    } else {
      a = randInt(rng, aLo, aHi);
      b = sign * randInt(rng, xLo, xHi); x = a * b;
      expr = 'x ÷ ' + a + ' = ' + b;
    }
    if (answerText == null) answerText = String(x);
    return {
      a: a, b: b, op: 'equation', form: form, symbol: '', answer: x,
      expr: expr, line: expr + '  x = _____',
      answerText: answerText, keyText: 'x = ' + answerText, vertical: false, wrap: true
    };
  }

  /** Trivial facts a fluency drill usually wants filtered out: anything
      involving ×0/×1, ÷1, or +0 — the answer equals one of the operands so
      there's nothing to actually recall. Subtraction-to-zero (a - a) is left
      alone since "does it hit zero" is itself a fact worth drilling. */
  function isTrivial(p) {
    if (p.op === 'multiply') return p.a === 0 || p.a === 1 || p.b === 0 || p.b === 1;
    if (p.op === 'divide') return p.b === 1 || p.a === p.b;
    if (p.op === 'add') return p.a === 0 || p.b === 0;
    if (p.op === 'exponent') return p.a === 1 || p.b <= 1;
    return false;
  }

  /**
   * Generate `count` problems for a template, avoiding exact duplicates
   * within the sheet where practical. Falls back to allowing a repeat
   * rather than looping forever if the operand ranges are too small to
   * produce `count` distinct problems.
   *
   * options.seed — numeric seed for reproducible output (same template +
   *   count + seed always yields the same sheet).
   * options.avoidTrivial — skip ×0/×1/÷1/+0-style facts where practical.
   * options.typeOptions — the settings the fraction multiply/divide, exponent
   *   and equation types read (fracOp, fracMixed, fracWhole, expPreset,
   *   expAllowLow, eqForms, eqNegatives, eqFractions); the older types ignore
   *   it, and a missing or unknown value means the default.
   */
  function generateProblems(template, count, options) {
    options = options || {};
    var rng = makeRng(options.seed);
    var avoidTrivial = !!options.avoidTrivial;
    var typeOptions = options.typeOptions || {};
    var problems = [];
    var seen = {};
    var maxAttemptsPerProblem = 40;

    for (var i = 0; i < count; i++) {
      var problem = null;
      for (var attempt = 0; attempt < maxAttemptsPerProblem; attempt++) {
        var op = template.operation === 'mixed'
          ? pick(rng, ['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        var candidate = makeProblem(op, template.operand1, template.operand2, rng, typeOptions);
        if (avoidTrivial && isTrivial(candidate)) continue;
        var key = problemKey(candidate);
        if (!seen[key]) { problem = candidate; seen[key] = true; break; }
      }
      if (!problem) {
        // Range exhausted for practical dedup/triviality purposes — accept whatever comes next.
        var op2 = template.operation === 'mixed'
          ? pick(rng, ['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        problem = makeProblem(op2, template.operand1, template.operand2, rng, typeOptions);
      }
      problems.push(problem);
    }
    return problems;
  }

  /** Fisher-Yates shuffle driven by a supplied RNG, so it's reproducible
      when the RNG is seeded. Returns a new array; never mutates `arr`. */
  function shuffleWithRng(arr, rng) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /**
   * The anti-copying quiz pattern: take ONE already-generated problem list
   * and produce `count` versions containing the exact same problems, just
   * reordered — distinct from generateProblems() making distinct versions
   * with different random problems. A neighbor's "#1" is a different
   * problem in a different position, but every version shares the same
   * problem/answer set, so the whole room is still graded uniformly.
   *
   * Version 0 keeps the original order (so "Version A" matches what was
   * already previewed); later versions are independently reshuffled from a
   * seeded RNG so the whole set of versions stays reproducible together.
   */
  function reorderVersions(problems, count, seed) {
    var rng = makeRng(seed);
    var versions = [];
    for (var i = 0; i < count; i++) {
      versions.push(i === 0 ? problems.slice() : shuffleWithRng(problems, rng));
    }
    return versions;
  }

  global.MathDrillGenerate = {
    generateProblems: generateProblems, makeProblem: makeProblem, SYMBOL: SYMBOL,
    makeRng: makeRng, isTrivial: isTrivial, fractionText: fractionText,
    shuffleWithRng: shuffleWithRng, reorderVersions: reorderVersions,
    MAX_POWER_RESULT: MAX_POWER_RESULT
  };
})(typeof window !== 'undefined' ? window : global);
