/* gd-items.js — per-question item analysis for 037 (Path 16 P3).
   BACKLOG.md's Path 16 P3 bullet has the design.

   A pasted region, one row per student and one column per question, read through
   PasteTable (_shared/paste-table.js must be loaded first):

     GradeItems.analyze(text[, { line }])   -> {
        questions: [{ index, label, n, mean, max, pct, full, zero, missed }],
        order:     indexes into questions, lowest percent correct first (ties in question order;
                   a question nobody attempted is left out),
        students:  rows that held at least one score,
        hasNames:  whether the first column was a name column,
        maxGiven:  whether a "points possible" row was read,
        problems:  [{ line, col, label, text, why }] cells left out, by pasted line number,
        ragged:    [{ line, cells }] lines shorter than the widest,
        line:      the reteach line in percent used for the tiers }
     GradeItems.tier(pct, line)             'reteach' below the line, 'watch' within WATCH_BAND above it, else 'secure'
     GradeItems.chart(res)                  { categories, series } for ChartSvg.bar: percent MISSED in question order

   Percent correct is the question's mean over its points possible. Without a "points possible"
   row a question is out of the highest score in its column (all zeros: out of 1), so a 1/0
   right-or-wrong export needs no marking. A blank cell is "did not attempt": that student is left
   out of that question. A cell that is not a number, is negative, or is over a stated maximum is
   named in `problems` and left out; nothing is guessed. No names are kept in the result.

   Pure functions, no DOM, nothing stored. */
(function (root) {
  'use strict';

  var DEFAULT_LINE = 70;
  var WATCH_BAND = 10;
  var MAX_ROW = /^\s*(points?|max(imum)?|possible|out\s+of|total)\b/i;

  function tier(pct, line) {
    var l = line == null || isNaN(line) ? DEFAULT_LINE : line;
    var p = pct * 100;
    if (p < l) return 'reteach';
    if (p < l + WATCH_BAND) return 'watch';
    return 'secure';
  }

  function analyze(text, opts) {
    var P = root.PasteTable;
    var line = opts && opts.line != null && !isNaN(opts.line) ? Number(opts.line) : DEFAULT_LINE;
    var res = { questions: [], order: [], students: 0, hasNames: false, maxGiven: false, problems: [], ragged: [], line: line };
    var parsed = P.parse(text, { header: 'auto' });
    if (!parsed.rows.length) return res;
    res.ragged = parsed.ragged;

    var rows = parsed.rows.map(function (r, i) { return { cells: r, line: parsed.lines[i] }; });
    var maxRow = null;
    rows = rows.filter(function (r) {
      if (!maxRow && MAX_ROW.test(r.cells[0]) && P.toNumber(r.cells[0]) === null) { maxRow = r; return false; }
      return true;
    });
    res.maxGiven = !!maxRow;

    var hasNames = rows.some(function (r) { return r.cells[0] !== '' && P.toNumber(r.cells[0]) === null; }) ||
      (!!maxRow && parsed.width > 1);
    res.hasNames = hasNames;
    var first = hasNames ? 1 : 0;
    var count = parsed.width - first;
    if (count < 1) return res;

    var labels = [];
    for (var c = 0; c < count; c++) {
      var h = parsed.header ? parsed.header[first + c] : '';
      labels.push(h || ('Q' + (c + 1)));
    }

    var cols = [];
    for (c = 0; c < count; c++) cols.push({ vals: [], seenMax: 0 });
    rows.forEach(function (r) {
      var any = false;
      for (var k = 0; k < count; k++) {
        var raw = r.cells[first + k];
        if (raw === '' || raw == null) continue;
        var v = P.toNumber(raw);
        if (v === null || v < 0) {
          res.problems.push({ line: r.line, col: k, label: labels[k], text: raw, why: v === null ? 'not a number' : 'negative' });
          continue;
        }
        cols[k].vals.push({ v: v, line: r.line, raw: raw });
        if (v > cols[k].seenMax) cols[k].seenMax = v;
        any = true;
      }
      if (any) res.students++;
    });

    cols.forEach(function (col, k) {
      var max = 0;
      if (maxRow) {
        var m = P.toNumber(maxRow.cells[first + k]);
        if (m !== null && m > 0) max = m;
        else if (maxRow.cells[first + k] !== '') {
          res.problems.push({ line: maxRow.line, col: k, label: labels[k], text: maxRow.cells[first + k], why: 'points possible is not a positive number; the highest score was used' });
        }
      }
      var stated = max > 0;
      if (!stated) max = col.seenMax > 0 ? col.seenMax : 1;
      var kept = col.vals.filter(function (x) {
        if (stated && x.v > max) {
          res.problems.push({ line: x.line, col: k, label: labels[k], text: x.raw, why: 'over the ' + max + ' points possible' });
          return false;
        }
        return true;
      });
      var n = kept.length, sum = 0, full = 0, zero = 0;
      kept.forEach(function (x) { sum += x.v; if (x.v >= max) full++; if (x.v === 0) zero++; });
      var mean = n ? sum / n : null;
      res.questions.push({
        index: k, label: labels[k], n: n, mean: mean, max: max,
        pct: n ? mean / max : null, full: full, zero: zero, missed: n ? n - full : 0
      });
    });
    res.problems.sort(function (a, b) { return a.line - b.line || a.col - b.col; });

    res.order = res.questions.filter(function (q) { return q.n > 0; })
      .sort(function (a, b) { return a.pct - b.pct || a.index - b.index; })
      .map(function (q) { return q.index; });
    return res;
  }

  function chart(res, color) {
    var qs = res.questions.filter(function (q) { return q.n > 0; });
    return {
      categories: qs.map(function (q) { return q.label; }),
      series: [{ label: 'Percent missed', color: color || '#2171b5',
        values: qs.map(function (q) { return Math.round((1 - q.pct) * 1000) / 10; }) }]
    };
  }

  root.GradeItems = { analyze: analyze, tier: tier, chart: chart, DEFAULT_LINE: DEFAULT_LINE, WATCH_BAND: WATCH_BAND };
})(typeof window !== 'undefined' ? window : globalThis);
