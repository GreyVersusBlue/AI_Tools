/* Cultural Trivia Card Generator (053): the ready-made Review Game Board
   (BACKLOG rank 86, Devon's answers of 2026-11-03).

   Pure: no storage, no DOM. The page hands in the questions it is showing
   (built-ins not hidden, then the teacher's own) and gets back a board in the
   shape 030's "Export JSON" writes and its "Import JSON" reads
   (normalizeBoard() in Tools/030-review-game-board.html), so 030 needed no
   change to take it.

   THE RULE, all of it:
     - one column per category, in CAT_LABELS order (Hispanic World,
       Francophone World, Global Culture); a category with no question is
       left off, and a board with no column is null;
     - a column's questions are put in order easy, medium, hard (tierOf();
       a teacher's own question counts as medium), keeping the bank's own
       order inside a tier;
     - from that order, five are taken spread evenly from the easiest to the
       hardest: places round(k * (n - 1) / 4) for k = 0..4, so the first is
       always the easiest and the fifth the hardest; a column of five or fewer
       takes them all;
     - the clues are worth 100, 200, 300, 400, 500 from the top, the scale
       030 itself gives a seed question pulled onto a board.
   The same questions always make the same board: hiding a built-in or adding
   one's own is how a teacher changes it.

   Publishes window.CulturalTriviaBoard (globalThis in a vm). */
(function (global) {
  'use strict';

  var ROWS_PER_COLUMN = 5;
  var POINT_STEP = 100;
  var TIER_RANK = { easy: 0, medium: 1, hard: 2 };

  function rankOf(tierOf, item) {
    var t = item.custom ? 'medium' : tierOf(item.id);
    return Object.prototype.hasOwnProperty.call(TIER_RANK, t) ? TIER_RANK[t] : TIER_RANK.medium;
  }

  /** The places taken from a sorted column of n: every one when n <= 5,
      else five spread evenly, first and last included. */
  function spread(n) {
    var out = [];
    if (n <= ROWS_PER_COLUMN) { for (var i = 0; i < n; i++) out.push(i); return out; }
    for (var k = 0; k < ROWS_PER_COLUMN; k++) out.push(Math.round(k * (n - 1) / (ROWS_PER_COLUMN - 1)));
    return out;
  }

  /** opts: { items, labels, tierOf, name }. items are 053's own
      ({ id, category, q, a, custom }). Returns { columns, board } or null.
      columns is what the page previews ({ key, label, clues: [{ points,
      question, answer, tier, custom }] }); board is the file's content. */
  function build(opts) {
    var items = (opts && opts.items) || [];
    var labels = (opts && opts.labels) || {};
    var tierOf = (opts && opts.tierOf) || function () { return 'medium'; };
    var columns = [];
    Object.keys(labels).forEach(function (key) {
      var mine = items.filter(function (it) { return it && it.category === key; })
        .map(function (it, i) { return { it: it, i: i, r: rankOf(tierOf, it) }; });
      mine.sort(function (x, y) { return x.r - y.r || x.i - y.i; });
      var clues = spread(mine.length).map(function (place, slot) {
        var it = mine[place].it;
        return {
          points: (slot + 1) * POINT_STEP,
          question: String(it.q),
          answer: String(it.a),
          tier: it.custom ? 'medium' : tierOf(it.id),
          custom: !!it.custom
        };
      });
      if (clues.length) columns.push({ key: key, label: String(labels[key]), clues: clues });
    });
    if (!columns.length) return null;
    var board = {
      name: String((opts && opts.name) || 'Cultural Trivia'),
      categories: columns.map(function (c) {
        return {
          name: c.label,
          clues: c.clues.map(function (cl) {
            return { points: cl.points, question: cl.question, answer: cl.answer, used: false, dailyDouble: false };
          })
        };
      }),
      teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
      dailyDoubleEnabled: false,
      lightningRoundEnabled: false,
      lightningRoundSeconds: 15
    };
    return { columns: columns, board: board };
  }

  global.CulturalTriviaBoard = {
    ROWS_PER_COLUMN: ROWS_PER_COLUMN, POINT_STEP: POINT_STEP,
    spread: spread, build: build
  };
})(typeof window !== 'undefined' ? window : globalThis);
