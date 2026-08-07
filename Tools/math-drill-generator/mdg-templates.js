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
    }
  ];

  function byKey(key) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].key === key) return TEMPLATES[i];
    return TEMPLATES[0];
  }

  global.MathDrillTemplates = { TEMPLATES: TEMPLATES, byKey: byKey };
})(typeof window !== 'undefined' ? window : global);
