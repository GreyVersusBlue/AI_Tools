/* Math Fact Drill Sheet Generator — problem generation.
   Pure functions, no DOM, so the actual math (answer correctness, no
   negative subtraction results, clean division, no duplicate problems on
   one sheet) can be unit-tested directly in Node before any UI touches it. */
(function (global) {
  'use strict';

  var SYMBOL = { add: '+', subtract: '−', multiply: '×', divide: '÷' };

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
  function makeProblem(op, range1, range2, rng) {
    rng = rng || Math.random;
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
    } else {
      throw new Error('Unknown operation: ' + op);
    }
    return { a: a, b: b, op: op, symbol: SYMBOL[op], answer: answer };
  }

  function problemKey(p) { return p.a + p.op + p.b; }

  /** Trivial facts a fluency drill usually wants filtered out: anything
      involving ×0/×1, ÷1, or +0 — the answer equals one of the operands so
      there's nothing to actually recall. Subtraction-to-zero (a - a) is left
      alone since "does it hit zero" is itself a fact worth drilling. */
  function isTrivial(p) {
    if (p.op === 'multiply') return p.a === 0 || p.a === 1 || p.b === 0 || p.b === 1;
    if (p.op === 'divide') return p.b === 1 || p.a === p.b;
    if (p.op === 'add') return p.a === 0 || p.b === 0;
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
   */
  function generateProblems(template, count, options) {
    options = options || {};
    var rng = makeRng(options.seed);
    var avoidTrivial = !!options.avoidTrivial;
    var problems = [];
    var seen = {};
    var maxAttemptsPerProblem = 40;

    for (var i = 0; i < count; i++) {
      var problem = null;
      for (var attempt = 0; attempt < maxAttemptsPerProblem; attempt++) {
        var op = template.operation === 'mixed'
          ? pick(rng, ['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        var candidate = makeProblem(op, template.operand1, template.operand2, rng);
        if (avoidTrivial && isTrivial(candidate)) continue;
        var key = problemKey(candidate);
        if (!seen[key]) { problem = candidate; seen[key] = true; break; }
      }
      if (!problem) {
        // Range exhausted for practical dedup/triviality purposes — accept whatever comes next.
        var op2 = template.operation === 'mixed'
          ? pick(rng, ['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        problem = makeProblem(op2, template.operand1, template.operand2, rng);
      }
      problems.push(problem);
    }
    return problems;
  }

  global.MathDrillGenerate = {
    generateProblems: generateProblems, makeProblem: makeProblem, SYMBOL: SYMBOL,
    makeRng: makeRng, isTrivial: isTrivial
  };
})(typeof window !== 'undefined' ? window : global);
