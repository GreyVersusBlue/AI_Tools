/* Daily Editing / DOL Warm-Up Generator — bulk import of a custom bank (BACKLOG rank 87).

   Pure: no DOM, no storage, no clock. One broken sentence and its correction per line, the two
   (and an optional error type) separated by a tab or a "|" — a spreadsheet paste, or typed. A
   comma is not a separator, because a sentence is full of them. The cells are cut by
   PasteTable.splitLine (_shared/paste-table.js, loaded first), per line, so a paste that mixes
   tabs and bars still reads; quotes are off, a sentence may hold a quotation.

     DegImport.parse(text, { categories, labels, fallback })
         -> { rows: [{ broken, fixed, category, line }], skipped: [{ line, reason }],
              header, over, unnamed, unknown }
     DegImport.plan(rows, existing)
         -> { add: [row], repeats: [{ line }] }     existing: [{ broken, fixed }] (built-in and own)
     DegImport.fingerprint(row)                     the trimmed, case-folded pair (as the share link's)

   Nothing is guessed at: a line that cannot be read is named with its number and the reason, a
   third cell that is not an error type this tool has files under the fallback and is counted
   (`unknown`), a list over MAX_ROWS is cut and says by how many (`over`). */
(function (global) {
  'use strict';

  var MAX_ROWS = 500;
  var MAX_LEN = 300;
  var HEADER_BROKEN = /^(broken|wrong|incorrect|error|sentence|before)\b/i;
  var HEADER_FIXED = /^(fixed|correct|corrected|correction|answer|after|right)\b/i;

  function str(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

  function fingerprint(row) {
    return String(row.broken).trim().toLowerCase() + '\u0000' + String(row.fixed).trim().toLowerCase();
  }

  /* "run-ons", "Run-ons & Comma Splices", "punctuation" -> the tool's key, or '' when none fits.
     A word of four letters or more may be the start of the key or of the label. */
  function categoryOf(cell, categories, labels) {
    var n = norm(cell);
    if (!n) return '';
    for (var i = 0; i < categories.length; i++) {
      var k = categories[i];
      if (norm(k) === n || norm(labels && labels[k]) === n) return k;
    }
    if (n.length >= 4) {
      for (var j = 0; j < categories.length; j++) {
        var key = categories[j];
        if (norm(key).indexOf(n) === 0 || norm(labels && labels[key]).indexOf(n) === 0) return key;
      }
    }
    return '';
  }

  function parse(text, opts) {
    opts = opts || {};
    var categories = opts.categories || [];
    var fallback = opts.fallback || 'other';
    var PT = global.PasteTable;
    var out = { rows: [], skipped: [], header: false, over: 0, unnamed: 0, unknown: 0 };
    var raw = String(text == null ? '' : text).split(/\r?\n/);
    var seenFirst = false;
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i];
      if (!line.trim()) continue;
      var n = i + 1;
      var delim = PT.pickDelimiter(line, { candidates: ['\t', '|'], fallback: '' });
      if (!delim) { seenFirst = true; out.skipped.push({ line: n, reason: 'no tab or | between the two sentences' }); continue; }
      var cells = PT.splitLine(line, delim, { quotes: false });
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (!seenFirst && cells.length >= 2 && HEADER_BROKEN.test(cells[0]) && HEADER_FIXED.test(cells[1])) {
        seenFirst = true; out.header = true; continue;
      }
      seenFirst = true;
      var broken = str(cells[0]), fixed = str(cells[1]);
      if (cells.length < 2 || !broken || !fixed) { out.skipped.push({ line: n, reason: !broken && !fixed ? 'both sentences are empty' : (!broken ? 'no broken sentence' : 'no correction') }); continue; }
      if (broken.length > MAX_LEN || fixed.length > MAX_LEN) { out.skipped.push({ line: n, reason: 'a sentence is over ' + MAX_LEN + ' characters' }); continue; }
      if (broken === fixed) { out.skipped.push({ line: n, reason: 'the correction is the same as the broken sentence' }); continue; }
      var category = fallback, named = str(cells[2]);
      if (named) {
        var c = categoryOf(named, categories, opts.labels);
        if (c) category = c; else out.unknown++;
      } else out.unnamed++;
      if (out.rows.length >= MAX_ROWS) { out.over++; continue; }
      out.rows.push({ broken: broken, fixed: fixed, category: category, line: n });
    }
    return out;
  }

  function plan(rows, existing) {
    var have = {};
    (existing || []).forEach(function (e) { have[fingerprint(e)] = true; });
    var add = [], repeats = [];
    (rows || []).forEach(function (r) {
      var fp = fingerprint(r);
      if (have[fp]) { repeats.push({ line: r.line }); return; }
      have[fp] = true;
      add.push(r);
    });
    return { add: add, repeats: repeats };
  }

  global.DegImport = { parse: parse, plan: plan, fingerprint: fingerprint, categoryOf: categoryOf, MAX_ROWS: MAX_ROWS, MAX_LEN: MAX_LEN };
})(typeof window !== 'undefined' ? window : globalThis);
