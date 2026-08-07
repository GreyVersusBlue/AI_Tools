/* Math Fact Drill Sheet Generator — problem generation.
   Pure functions, no DOM, so the actual math (answer correctness, no
   negative subtraction results, clean division, no duplicate problems on
   one sheet) can be unit-tested directly in Node before any UI touches it. */
(function (global) {
  'use strict';

  var SYMBOL = { add: '+', subtract: '−', multiply: '×', divide: '÷' };

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** One problem for a specific concrete operation (never 'mixed' itself). */
  function makeProblem(op, range1, range2) {
    var a, b, answer;
    if (op === 'add') {
      a = randInt(range1.min, range1.max);
      b = randInt(range2.min, range2.max);
      answer = a + b;
    } else if (op === 'subtract') {
      // Keep results non-negative: generate the larger value first as the
      // minuend, drawing both from the union of both configured ranges so
      // "operand2 range" still constrains how big the subtracted amount is.
      var hi = randInt(Math.max(range1.min, range2.min), Math.max(range1.max, range2.max));
      var lo = randInt(range2.min, Math.min(range2.max, hi));
      a = hi; b = lo;
      answer = a - b;
    } else if (op === 'multiply') {
      a = randInt(range1.min, range1.max);
      b = randInt(range2.min, range2.max);
      answer = a * b;
    } else if (op === 'divide') {
      // Build from the answer up so division always comes out even.
      var divisor = randInt(Math.max(1, range2.min), Math.max(1, range2.max));
      var quotient = randInt(range1.min, range1.max);
      a = divisor * quotient;
      b = divisor;
      answer = quotient;
    } else {
      throw new Error('Unknown operation: ' + op);
    }
    return { a: a, b: b, op: op, symbol: SYMBOL[op], answer: answer };
  }

  function problemKey(p) { return p.a + p.op + p.b; }

  /**
   * Generate `count` problems for a template, avoiding exact duplicates
   * within the sheet where practical. Falls back to allowing a repeat
   * rather than looping forever if the operand ranges are too small to
   * produce `count` distinct problems.
   */
  function generateProblems(template, count) {
    var problems = [];
    var seen = {};
    var maxAttemptsPerProblem = 40;

    for (var i = 0; i < count; i++) {
      var problem = null;
      for (var attempt = 0; attempt < maxAttemptsPerProblem; attempt++) {
        var op = template.operation === 'mixed'
          ? pick(['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        var candidate = makeProblem(op, template.operand1, template.operand2);
        var key = problemKey(candidate);
        if (!seen[key]) { problem = candidate; seen[key] = true; break; }
      }
      if (!problem) {
        // Range exhausted for practical dedup purposes — accept a repeat.
        var op2 = template.operation === 'mixed'
          ? pick(['add', 'subtract', 'multiply', 'divide'])
          : template.operation;
        problem = makeProblem(op2, template.operand1, template.operand2);
      }
      problems.push(problem);
    }
    return problems;
  }

  global.MathDrillGenerate = { generateProblems: generateProblems, makeProblem: makeProblem, SYMBOL: SYMBOL };
})(typeof window !== 'undefined' ? window : global);
