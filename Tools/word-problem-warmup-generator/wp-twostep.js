/* wp-twostep.js — two-step word problems for 081, grades 6-8. A plain script
   that publishes one global, `WpTwoStep`, so the page can call it and a
   pure-Node suite can import it.

   Nothing here touches the page, storage or Math.random: a problem is a pure
   function of the rng the page hands in, so the same seed gives the same sheet
   (081's whole point) and a suite can draw thousands of them.

   A problem is { text, answer, work, op: 'two-step', kind, ops, nums, steps }.
     steps  two arithmetic steps { l, op, r, res [, rem] }; the second uses the
            first's result. `res` is whole and at least 1 in every step, the
            first step's `rem` is only ever set by the two remainder kinds.
     nums   the numbers the story gives, in the order they appear in the text.
            Every one is inside the grades 6-8 range for what it is: `add`
            15-400, `factor` 6-15, `divisor` 6-15, `dividend` up to 900.
     work   the key line, "6 × 8 = 48, then 48 − 15 = 33", built from `steps`.
   Each kind keeps its own smaller sub-range where the full one would make a
   silly story (a points total in the tens of thousands); the sub-ranges sit
   inside the band's, and smoke-two-step-core.mjs holds both.

   Three rules the generator keeps by construction and the suite re-checks
   without trusting it: no subtraction goes below 1; no division leaves a
   remainder except in the two kinds written about remainders (and there it
   always does, so the case a teacher wants is what they get); and no number in
   a story is 1, so no noun is ever singular. */
(function (global) {
  'use strict';

  var NAMES = ['Maya', 'Ethan', 'Priya', 'Jaden', 'Sofia', 'Marcus', 'Aaliyah', 'Owen', 'Lucia', 'Deshawn', 'Ivy', 'Noah', 'Fatima', 'Caleb', 'Zoe', 'Kenji'];
  var ITEMS = ['stickers', 'trading cards', 'marbles', 'baseball cards', 'pencils', 'stamps', 'bracelets', 'comic books', 'seashells', 'granola bars'];

  /* The upper band's ranges, the same as 081's one-step RANGES.middle. */
  var BAND = { add: [15, 400], factor: [6, 15], dividendMax: 900 };

  function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function pick(rng, arr) { return arr[randInt(rng, 0, arr.length - 1)]; }
  function otherName(rng, name) {
    var rest = NAMES.filter(function (n) { return n !== name; });
    return pick(rng, rest);
  }
  function factor(rng) { return randInt(rng, BAND.factor[0], BAND.factor[1]); }

  function step(l, op, r) {
    var res;
    if (op === '+') res = l + r;
    else if (op === '−') res = l - r;
    else if (op === '×') res = l * r;
    else res = Math.floor(l / r);
    var s = { l: l, op: op, r: r, res: res };
    if (op === '÷' && l % r) s.rem = l % r;
    return s;
  }

  function workOf(steps) {
    return steps.map(function (s) {
      return s.l + ' ' + s.op + ' ' + s.r + ' = ' + s.res + (s.rem ? ' R ' + s.rem : '');
    }).join(', then ');
  }

  /* Each kind: make(rng, name, name2, item) -> { text, nums: [[value, role], ...], first, c, second }.
     `nums` is in the order the numbers appear in `text`. */
  var KINDS = [
    { id: 'mult-add', ops: '×,+', make: function (rng, name, name2, item) {
      var a = factor(rng), b = factor(rng), c = randInt(rng, 15, 120);
      return { text: name + ' buys ' + a + ' packs of ' + item + ' with ' + b + ' in each pack. Then a friend gives ' + name + ' ' + c + ' more ' + item + '. How many ' + item + ' does ' + name + ' have now?',
        nums: [[a, 'factor'], [b, 'factor'], [c, 'add']], first: step(a, '×', b), c: c, second: '+' };
    } },
    { id: 'mult-sub', ops: '×,−', make: function (rng, name, name2, item) {
      var a = factor(rng), b = factor(rng);
      var c = randInt(rng, 15, Math.min(120, a * b - 1));
      return { text: name + ' has ' + a + ' boxes with ' + b + ' ' + item + ' in each box. ' + name + ' gives away ' + c + ' of the ' + item + '. How many ' + item + ' does ' + name + ' have left?',
        nums: [[a, 'factor'], [b, 'factor'], [c, 'add']], first: step(a, '×', b), c: c, second: '−' };
    } },
    { id: 'add-mult', ops: '+,×', make: function (rng, name, name2, item) {
      var a = randInt(rng, 15, 100), b = randInt(rng, 15, 100), c = factor(rng);
      return { text: 'In a game, each of the ' + item + ' is worth ' + c + ' points. In round one ' + name + ' wins ' + a + ' ' + item + ', and in round two ' + name + ' wins ' + b + ' more. How many points is that in all?',
        nums: [[c, 'factor'], [a, 'add'], [b, 'add']], first: step(a, '+', b), c: c, second: '×' };
    } },
    { id: 'sub-mult', ops: '−,×', make: function (rng, name, name2, item) {
      var a = randInt(rng, 30, 120), b = randInt(rng, 15, a - 1), c = factor(rng);
      return { text: name + ' has ' + a + ' ' + item + ' and sets aside ' + b + ' of the ' + item + '. Each of the rest can be traded for ' + c + ' raffle tickets. How many raffle tickets can ' + name + ' get?',
        nums: [[a, 'add'], [b, 'add'], [c, 'factor']], first: step(a, '−', b), c: c, second: '×' };
    } },
    { id: 'div-add', ops: '÷,+', make: function (rng, name, name2, item) {
      var b = factor(rng), q = randInt(rng, 2, Math.floor(BAND.dividendMax / b)), c = factor(rng);
      return { text: name + ' packs ' + (b * q) + ' ' + item + ' into boxes of ' + b + '. ' + name + ' already has ' + c + ' filled boxes on a shelf. How many filled boxes does ' + name + ' have in all?',
        nums: [[b * q, 'dividend'], [b, 'divisor'], [c, 'factor']], first: step(b * q, '÷', b), c: c, second: '+' };
    } },
    { id: 'div-sub', ops: '÷,−', make: function (rng, name, name2, item) {
      var b = factor(rng), c = factor(rng);
      var q = randInt(rng, c + 1, Math.floor(BAND.dividendMax / b));
      return { text: name + ' packs ' + (b * q) + ' ' + item + ' into boxes of ' + b + ' and ships ' + c + ' of the boxes. How many boxes are left to ship?',
        nums: [[b * q, 'dividend'], [b, 'divisor'], [c, 'factor']], first: step(b * q, '÷', b), c: c, second: '−' };
    } },
    { id: 'div-mult', ops: '÷,×', make: function (rng, name, name2, item) {
      var b = factor(rng), q = randInt(rng, 2, Math.floor(BAND.dividendMax / b / 5)), c = factor(rng);
      return { text: name + ' shares ' + (b * q) + ' ' + item + ' equally among ' + b + ' students. Each of the ' + item + ' is worth ' + c + ' points. How many points does each student get?',
        nums: [[b * q, 'dividend'], [b, 'divisor'], [c, 'factor']], first: step(b * q, '÷', b), c: c, second: '×' };
    } },
    { id: 'mult-div', ops: '×,÷', make: function (rng, name, name2, item) {
      var a = factor(rng), b = factor(rng), prod = a * b, ds = [];
      for (var d = BAND.factor[0]; d <= BAND.factor[1]; d++) if (prod % d === 0) ds.push(d);
      var c = pick(rng, ds);
      return { text: name + ' makes ' + a + ' batches with ' + b + ' ' + item + ' in each batch and shares all the ' + item + ' equally among ' + c + ' friends. How many ' + item + ' does each friend get?',
        nums: [[a, 'factor'], [b, 'factor'], [c, 'divisor']], first: step(a, '×', b), c: c, second: '÷' };
    } },
    { id: 'add-sub', ops: '+,−', make: function (rng, name, name2, item) {
      var a = randInt(rng, 15, 400), b = randInt(rng, 15, 400);
      var c = randInt(rng, 15, Math.min(400, a + b - 1));
      return { text: name + ' has ' + a + ' ' + item + ' and buys ' + b + ' more. Then ' + name + ' gives ' + c + ' ' + item + ' to the class. How many ' + item + ' does ' + name + ' have left?',
        nums: [[a, 'add'], [b, 'add'], [c, 'add']], first: step(a, '+', b), c: c, second: '−' };
    } },
    { id: 'cmp-more-total', ops: '+,+', make: function (rng, name, name2, item) {
      var a = randInt(rng, 15, 200), b = randInt(rng, 15, 200);
      return { text: name + ' has ' + a + ' ' + item + '. ' + name2 + ' has ' + b + ' more ' + item + ' than ' + name + '. How many ' + item + ' do ' + name + ' and ' + name2 + ' have altogether?',
        nums: [[a, 'add'], [b, 'add']], first: step(a, '+', b), again: true, second: '+' };
    } },
    { id: 'cmp-fewer-total', ops: '−,+', make: function (rng, name, name2, item) {
      var a = randInt(rng, 30, 400), b = randInt(rng, 15, a - 1);
      return { text: name + ' has ' + a + ' ' + item + '. ' + name2 + ' has ' + b + ' fewer ' + item + ' than ' + name + '. How many ' + item + ' do ' + name + ' and ' + name2 + ' have altogether?',
        nums: [[a, 'add'], [b, 'add']], first: step(a, '−', b), again: true, second: '+' };
    } },
    { id: 'cmp-times-total', ops: '×,+', make: function (rng, name, name2, item) {
      var a = randInt(rng, 15, 60), b = factor(rng);
      return { text: name2 + ' has ' + a + ' ' + item + '. ' + name + ' has ' + b + ' times as many ' + item + ' as ' + name2 + '. How many ' + item + ' do ' + name + ' and ' + name2 + ' have altogether?',
        nums: [[a, 'add'], [b, 'factor']], first: step(a, '×', b), again: true, second: '+' };
    } },
    { id: 'cmp-times-diff', ops: '×,−', make: function (rng, name, name2, item) {
      var a = randInt(rng, 15, 60), b = factor(rng);
      return { text: name2 + ' has ' + a + ' ' + item + '. ' + name + ' has ' + b + ' times as many ' + item + ' as ' + name2 + '. How many more ' + item + ' does ' + name + ' have than ' + name2 + '?',
        nums: [[a, 'add'], [b, 'factor']], first: step(a, '×', b), again: true, second: '−' };
    } },
    /* The two remainder kinds. The first step is a division that does not come
       out even; the story is about what the leftover does. */
    { id: 'rem-full-boxes', ops: '÷,×', remainder: true, make: function (rng, name, name2, item) {
      var b = factor(rng), q = randInt(rng, 2, Math.floor(BAND.dividendMax / b / 5)), r = randInt(rng, 1, b - 1), c = factor(rng);
      return { text: name + ' packs ' + (b * q + r) + ' ' + item + ' into boxes of ' + b + '. Only full boxes can be turned in, and each full box is worth ' + c + ' tickets. How many tickets can ' + name + ' get?',
        nums: [[b * q + r, 'dividend'], [b, 'divisor'], [c, 'factor']], first: step(b * q + r, '÷', b), c: c, second: '×' };
    } },
    { id: 'rem-last-group', ops: '÷,+', remainder: true, make: function (rng, name, name2, item) {
      var b = factor(rng), q = randInt(rng, 2, Math.floor(BAND.dividendMax / b / 5)), r = randInt(rng, 1, b - 1), c = factor(rng);
      return { text: name + ' puts ' + (b * q + r) + ' ' + item + ' into groups of ' + b + '. The ' + item + ' left over, plus ' + c + ' more, make one last small group. How many ' + item + ' are in the last group?',
        nums: [[b * q + r, 'dividend'], [b, 'divisor'], [c, 'factor']], first: step(b * q + r, '÷', b), c: c, second: '+', useRem: true };
    } }
  ];

  /* Fill in the second step from the first. It takes the first step's result
     (`res`) and one more given number `c`, except in the comparison kinds, which
     use the first number the story gives again (a total of both people's
     counts, or how many more one has), and in "rem-last-group", whose second
     step takes the leftover `rem` instead of the quotient. */
  function finish(k, built) {
    var s0 = built.first, s1;
    if (built.again) {
      var a = built.nums[0][0];
      s1 = built.second === '−' ? step(s0.res, '−', a) : step(a, built.second, s0.res);
    } else if (built.useRem) {
      s1 = step(s0.rem, built.second, built.c);
    } else {
      s1 = step(s0.res, built.second, built.c);
    }
    var steps = [s0, s1];
    return {
      text: built.text, answer: s1.res, work: workOf(steps), op: 'two-step',
      kind: k.id, ops: k.ops,
      nums: built.nums.map(function (n) { return { v: n[0], role: n[1] }; }),
      steps: steps
    };
  }

  /* One two-step problem for the upper band. Draws from rng in a fixed order:
     the kind, the names, the item, then the kind's own numbers. */
  function makeProblem(rng) {
    var k = pick(rng, KINDS);
    var name = pick(rng, NAMES), name2 = otherName(rng, name), item = pick(rng, ITEMS);
    return finish(k, k.make(rng, name, name2, item));
  }

  /* How a mode applies to a band: two-step is the upper band's, so grades 3-5
     always get one-step whatever was chosen or arrived in a link. */
  function effectiveMode(band, mode) {
    return band === 'middle' && (mode === 'two' || mode === 'mixed') ? mode : 'one';
  }

  /* Whether a problem in this mode is two-step; `coin` is the page's one rng
     draw for a mixed sheet, taken before the problem is. */
  function isTwoStep(mode, coin) {
    return mode === 'two' || (mode === 'mixed' && coin < 0.5);
  }

  global.WpTwoStep = {
    KINDS: KINDS.map(function (k) { return { id: k.id, ops: k.ops, remainder: !!k.remainder }; }),
    BAND: BAND,
    makeProblem: makeProblem,
    effectiveMode: effectiveMode,
    isTwoStep: isTwoStep
  };
})(typeof window !== 'undefined' ? window : globalThis);
