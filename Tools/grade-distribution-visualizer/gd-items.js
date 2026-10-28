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
     GradeItems.compare(sections)           [{ label, res }] -> { labels, rows: [{ label, pcts, gap }], flagged }:
                                            the same question (matched by its label) in each section, percent
                                            correct per section (null where a section lacks it or nobody
                                            attempted it), and the gap in points between the best and worst
                                            section; a gap of GAP_FLAG points or more is `flagged`
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

  var GAP_FLAG = 15;

  function compare(sections) {
    var order = [], seen = {};
    sections.forEach(function (sec) {
      sec.res.questions.forEach(function (q) { if (!seen[q.label]) { seen[q.label] = true; order.push(q.label); } });
    });
    var rows = order.map(function (label) {
      var pcts = sections.map(function (sec) {
        var q = null;
        sec.res.questions.forEach(function (x) { if (!q && x.label === label && x.n > 0) q = x; });
        return q ? Math.round(q.pct * 1000) / 10 : null;
      });
      var have = pcts.filter(function (v) { return v !== null; });
      var gap = have.length > 1 ? Math.round((Math.max.apply(null, have) - Math.min.apply(null, have)) * 10) / 10 : null;
      return { label: label, pcts: pcts, gap: gap, flagged: gap !== null && gap >= GAP_FLAG };
    });
    return { labels: sections.map(function (s) { return s.label; }), rows: rows, flagged: rows.filter(function (r) { return r.flagged; }).length };
  }

  /* ---- the plain-language page ----
     narrate(m) -> [{ h, t }]: a heading and a paragraph each, from numbers only.
       m = { name, n, mean, median, stdev, min, max, letters: {A..F}, zeros,
             compare: [{ name, mean }], sections: [{ label, res }], line }
     English only. A sentence is written only when the number behind it supports it. */
  function pct0(v) { return Math.round(v) + '%'; }
  function r1(v) { return String(Math.round(v * 10) / 10); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function listUpTo(items, max) {
    return items.length > max ? items.slice(0, max).join(', ') + ' and ' + (items.length - max) + ' more' : items.join(', ');
  }

  function narrate(m) {
    var out = [], name = m.name || 'this assignment';
    var n = m.n || 0;
    if (n) {
      var ab = (m.letters.A + m.letters.B) / n * 100, df = (m.letters.D + m.letters.F) / n * 100;
      var t = 'On ' + name + ', ' + plural(n, 'score was', 'scores were') + ' read. The mean was ' + r1(m.mean) + ' and the median ' + r1(m.median) +
        ' (lowest ' + r1(m.min) + ', highest ' + r1(m.max) + '). ' + pct0(ab) + ' of the class earned an A or B, and ' + pct0(df) + ' earned a D or F.';
      var gap = m.mean - m.median;
      if (gap <= -3) t += ' A few low scores are pulling the mean below the median, so the typical student did better than the mean suggests.';
      else if (gap >= 3) t += ' A few high scores are pulling the mean above the median, so the typical student did a little worse than the mean suggests.';
      else t += ' The mean and median are close, so the average is a fair picture of the typical score.';
      if (m.stdev >= 15) t += ' Scores are widely spread (standard deviation ' + r1(m.stdev) + '), so one plan may not fit every student.';
      else if (m.stdev <= 7) t += ' Scores are tightly bunched (standard deviation ' + r1(m.stdev) + ').';
      out.push({ h: 'How the class did', t: t });
      if (m.zeros > 0) out.push({ h: 'Zeros', t: plural(m.zeros, 'score was', 'scores were') + ' exactly 0 (' + pct0(m.zeros / n * 100) + ' of the class). Check whether those are work not turned in rather than work done badly.' });
    }
    (m.compare || []).forEach(function (c) {
      var d = m.mean - c.mean;
      out.push({ h: 'Compared with ' + c.name, t: Math.abs(d) < 0.05 ? 'The mean is the same as ' + c.name + '\u2019s.' :
        'The mean is ' + r1(Math.abs(d)) + ' point' + (Math.abs(Math.round(d * 10) / 10) === 1 ? '' : 's') + (d > 0 ? ' higher' : ' lower') + ' than on ' + c.name + '.' });
    });
    var secs = m.sections || [];
    var many = secs.length > 1;
    secs.forEach(function (sec) {
      var res = sec.res, line = m.line == null ? DEFAULT_LINE : m.line;
      var low = res.order.filter(function (qi) { return tier(res.questions[qi].pct, line) === 'reteach'; });
      var head = many ? 'Questions \u2014 ' + sec.label : 'Questions';
      var best = res.questions[res.order[res.order.length - 1]];
      var t2;
      if (!low.length) t2 = 'No question fell below ' + pct0(line) + ' correct.';
      else t2 = plural(low.length, 'question was', 'questions were') + ' below ' + pct0(line) + ' correct and need reteaching: ' +
        listUpTo(low.map(function (qi) { return res.questions[qi].label + ' (' + pct0(res.questions[qi].pct * 100) + ')'; }), 5) + '.';
      if (best) t2 += ' The strongest was ' + best.label + ' at ' + pct0(best.pct * 100) + '.';
      out.push({ h: head, t: t2 });
    });
    if (many) {
      var cmp = compare(secs);
      var big = cmp.rows.filter(function (r) { return r.flagged; }).sort(function (a, b) { return b.gap - a.gap; });
      if (big.length) out.push({ h: 'Sections differed', t: 'The sections differed most on ' + listUpTo(big.map(function (r) {
        return r.label + ' (' + cmp.labels.map(function (l, i) { return l + ' ' + (r.pcts[i] == null ? 'none' : pct0(r.pcts[i])); }).join(', ') + ')';
      }), 3) + '.' });
      else out.push({ h: 'Sections differed', t: 'No question differed by ' + GAP_FLAG + ' points or more between sections.' });
    }
    out.push({ h: 'About these numbers', t: 'Written from the figures on this page by rule, not judged by a person. Check them against the gradebook before they go in a binder.' });
    return out;
  }

  root.GradeItems = { analyze: analyze, tier: tier, chart: chart, compare: compare, narrate: narrate, DEFAULT_LINE: DEFAULT_LINE, WATCH_BAND: WATCH_BAND, GAP_FLAG: GAP_FLAG };
})(typeof window !== 'undefined' ? window : globalThis);
