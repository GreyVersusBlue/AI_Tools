/* Art Critique Worksheet Generator — the optional rubric score (Path rank 81).
   A worksheet may carry `rubric: { on: true, points: 4, circle: true }`; a step may carry
   `points` (0 to 10, 0 = this step is not scored). A worksheet without the field is the plain
   critique it always was: nothing here adds a field until a teacher switches the score on.
   Pure functions, no storage, no DOM. The page turns scoreBox() and totalLine() into the sheet. */
(function (global) {
  'use strict';

  var CHOICES = [2, 3, 4, 5, 10];   // points a step can be worth by default
  var MAX_STEP = 10;
  var MAX_CIRCLE = 5;               // a row of numbers to circle is offered up to this many points

  function int(v, lo, hi, fallback) {
    var n = parseInt(v, 10);
    return (n >= lo && n <= hi) ? n : fallback;
  }

  /* clean(r): the rubric as it is stored, or null when the score is off. */
  function clean(r) {
    if (!r || typeof r !== 'object' || r.on !== true) return null;
    return { on: true, points: CHOICES.indexOf(int(r.points, 1, 99, 4)) === -1 ? 4 : int(r.points, 1, 99, 4), circle: r.circle !== false };
  }

  /* pointsFor(step, rubric): what a step is worth; 0 when the score is off or the step is unscored. */
  function pointsFor(step, rubric) {
    var r = clean(rubric);
    if (!r) return 0;
    if (step && step.points !== undefined && step.points !== null && step.points !== '') {
      return int(step.points, 0, MAX_STEP, r.points);
    }
    return r.points;
  }

  function total(steps, rubric) {
    return (Array.isArray(steps) ? steps : []).reduce(function (sum, s) { return sum + pointsFor(s, rubric); }, 0);
  }

  /* cleanStepPoints(v): the value to keep on a step: an integer 0..10, or undefined for "the default". */
  function cleanStepPoints(v) {
    if (v === '' || v == null) return undefined;
    var n = parseInt(v, 10);
    return (n >= 0 && n <= MAX_STEP) ? n : undefined;
  }

  /* scoreBox(points, rubric): the plain-text parts of a step's score box:
     { label: 'Score', blank: '____', of: '/ 4', circles: [1,2,3,4] or [] }. null when the step is unscored. */
  function scoreBox(points, rubric) {
    var r = clean(rubric);
    if (!r || !(points > 0)) return null;
    var circles = [];
    if (r.circle && points <= MAX_CIRCLE) for (var i = 1; i <= points; i++) circles.push(i);
    return { label: 'Score', blank: '____', of: '/ ' + points, circles: circles };
  }

  function totalLine(steps, rubric) {
    var t = total(steps, rubric);
    return t > 0 ? { label: 'Teacher total', blank: '____', of: '/ ' + t } : null;
  }

  global.CritiqueRubric = {
    CHOICES: CHOICES, MAX_STEP: MAX_STEP, MAX_CIRCLE: MAX_CIRCLE,
    clean: clean, pointsFor: pointsFor, total: total, cleanStepPoints: cleanStepPoints, scoreBox: scoreBox, totalLine: totalLine
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
