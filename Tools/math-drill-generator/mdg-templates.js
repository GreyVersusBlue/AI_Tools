/* Math Fact Drill Sheet Generator — template config.
   Each template is a plain data object describing an operation and operand
   ranges. Adding a new question type later (fractions, word problems, order
   of operations) means adding one entry here plus, if the problem *format*
   is genuinely different (not just a/op/b=?), a new case in
   mdg-generate.js's generateProblems() — the UI and print layout don't
   need to change either way. */
(function (global) {
  'use strict';

  var TEMPLATES = [
    {
      key: 'addition', label: 'Addition Facts', operation: 'add',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'subtraction', label: 'Subtraction Facts', operation: 'subtract',
      operand1: { min: 1, max: 20 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'multiplication', label: 'Multiplication Facts', operation: 'multiply',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'division', label: 'Division Facts', operation: 'divide',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'mixed', label: 'Mixed Operations', operation: 'mixed',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    /* The five below are the grades 6-8 half of this tool. They keep the same
       template shape as the four fact drills, but their problems are not all
       `a symbol b` — see the display-text note at the top of mdg-generate.js.
       The operand ranges mean what they can: for integers they bound the
       magnitude before a sign is picked, for decimals the whole-number part.
       Fractions, percents and order of operations generate from their own
       fixed pools and ignore the ranges — the ranges panel is still shown for
       them, which is a rough edge worth revisiting. */
    {
      key: 'integers', label: 'Integer Operations (+ − ×)', operation: 'integer',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'decimals', label: 'Decimal Operations (+ − ×)', operation: 'decimal',
      operand1: { min: 1, max: 9 }, operand2: { min: 1, max: 9 }
    },
    {
      key: 'fractions', label: 'Fraction Addition & Subtraction', operation: 'fraction',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'percent', label: 'Percent of a Number', operation: 'percent',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    },
    {
      key: 'ooo', label: 'Order of Operations', operation: 'ooo',
      operand1: { min: 1, max: 12 }, operand2: { min: 1, max: 12 }
    }
  ];

  /* Fact-family templates: narrower drills that pin one factor/divisor to a
     single digit (2-12) instead of letting it range, e.g. "x6 Facts Only"
     only ever produces 6 x b. Generated in a loop to avoid 22 near-identical
     literals, but each pushed entry has the exact same shape as the static
     templates above (key/label/operation/operand1/operand2), so
     mdg-generate.js and the UI need no changes to support them. For
     multiply, operand1 is pinned (operand2 still ranges 1-12); for divide,
     operand2 is pinned since it doubles as the divisor (operand1 still
     ranges 1-12 as the quotient). */
  for (var digit = 2; digit <= 12; digit++) {
    TEMPLATES.push({
      key: 'mult' + digit, label: '×' + digit + ' Facts Only', operation: 'multiply',
      operand1: { min: digit, max: digit }, operand2: { min: 1, max: 12 }
    });
    TEMPLATES.push({
      key: 'div' + digit, label: '÷ by ' + digit + ' Facts Only', operation: 'divide',
      operand1: { min: 1, max: 12 }, operand2: { min: digit, max: digit }
    });
  }

  function byKey(key) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === key) return TEMPLATES[i];
    return TEMPLATES[0];
  }

  global.MathDrillTemplates = { TEMPLATES: TEMPLATES, byKey: byKey };
})(typeof window !== 'undefined' ? window : global);
