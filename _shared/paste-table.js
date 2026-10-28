/* paste-table.js — one parser for a pasted spreadsheet region (Path 16 P2).
   BACKLOG.md's Path 16 P2 bullet has the design, what joined and what did not.

   A pasted region is text a spreadsheet, a gradebook export or a PDF put on the clipboard:
   tabs, commas, semicolons or pipes between cells, sometimes quotes round a cell, a header
   line or none, numbers written "1,234", "$5" or "87%". This file reads it, and says which
   lines it could not read instead of guessing at them.

     PasteTable.splitLine(line, delim[, { quotes, trim }])   one line -> cells; quotes default on
                                             (a doubled "" is a quote), trim default on
     PasteTable.splitFixed(line)             a line with no tabs -> cells on runs of 2+ spaces
     PasteTable.pickDelimiter(text[, { candidates, firstLine, fallback }])
                                             tab, ;, | then , by default; the first of the
                                             candidates the text holds (the first line only
                                             when firstLine)
     PasteTable.toNumber(token)              "1,234" "$5" "87%" "-3.5" -> a number, else null
     PasteTable.isHeaderShape(cells)         a label first, then words or four-digit years
     PasteTable.parse(text[, opts])          { delimiter, header, rows, width, lines, ragged,
                                             blank } — rows padded to the widest line; opts:
                                             delimiter, candidates, firstLine, quotes, trim,
                                             header (true | false | 'auto'), fixed (a line with
                                             no tab splits on runs of spaces), pad (default true)
     PasteTable.columnReport(rows[, { isNumber, from }])
                                             per column { filled, numbers, unreadable: [{ row,
                                             text }] } — the cells that stopped a column reading
                                             as numbers, by data row (1 = the first row given)
     PasteTable.parseNamedValues(text)       "name, value" lines -> { rows: [{ name, value }],
                                             headerSkipped, unreadable: [line] }; the name may
                                             hold the delimiter ("Washington, D.C., 705,749")
     PasteTable.parseNamedColumns(text)      "name, v1, v2…" -> { slices, rows: [{ name, values }],
                                             headerSkipped, unreadable, ambiguous, delimiter };
                                             a comma table whose surplus three-digit fields could
                                             be thousands is reported (ambiguous), not guessed

   Pure functions, no DOM, nothing stored. The same file loads as a classic <script> and as a
   side-effect import from an ES module (Tools/blank-map-generator/bmg-choropleth.js,
   Tools/final-grade-checker/grade-math.mjs); either way it publishes PasteTable on the global. */
(function (root) {
  'use strict';

  var DEFAULT_CANDIDATES = ['\t', ';', '|', ','];

  /* A line -> cells. Inside quotes the delimiter is text and "" is one quote, as in a CSV file. */
  function splitLine(line, delim, opts) {
    var quotes = !opts || opts.quotes !== false;
    var trim = !opts || opts.trim !== false;
    var s = String(line == null ? '' : line);
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quotes && inQ) {
        if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (quotes && ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return trim ? out.map(function (c) { return c.trim(); }) : out;
  }

  /* No tabs: the text came from fixed-width columns, where an empty cell cannot be told from
     padding, so a run of 2+ spaces is the break and empty pieces are dropped. */
  function splitFixed(line) {
    return String(line == null ? '' : line).replace(/\r$/, '').trim().split(/ {2,}/)
      .map(function (c) { return c.trim(); }).filter(function (c) { return c !== ''; });
  }

  function pickDelimiter(text, opts) {
    var cands = (opts && opts.candidates) || DEFAULT_CANDIDATES;
    var fallback = opts && opts.fallback != null ? opts.fallback : ',';
    var s = String(text == null ? '' : text);
    if (opts && opts.firstLine) {
      var lines = s.split(/\r?\n/);
      s = '';
      for (var i = 0; i < lines.length; i++) if (lines[i].trim() !== '') { s = lines[i]; break; }
    }
    for (var j = 0; j < cands.length; j++) if (s.indexOf(cands[j]) !== -1) return cands[j];
    return fallback;
  }

  function toNumber(token) {
    var cleaned = String(token == null ? '' : token).replace(/[,\s%$]/g, '');
    if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
    var n = Number(cleaned);
    return isFinite(n) ? n : null;
  }

  function isNumberField(s) { return toNumber(s) !== null; }

  function isHeaderShape(fields) {
    if (!fields || fields.length < 2 || isNumberField(fields[0]) || !fields[0]) return false;
    var values = fields.slice(1);
    if (values.every(function (v) { return v && !isNumberField(v); })) return true;
    return values.every(function (v) { return /^\d{4}$/.test(v) && Number(v) >= 1000 && Number(v) <= 2999; });
  }

  function parse(text, opts) {
    opts = opts || {};
    var raw = String(text == null ? '' : text).split(/\r?\n/);
    var lines = [], blank = 0;
    raw.forEach(function (l, i) {
      if (l.trim() === '') { blank++; return; }
      lines.push({ n: i + 1, text: l });
    });
    if (!lines.length) {
      return { delimiter: opts.delimiter || ',', header: null, rows: [], width: 0, lines: [], ragged: [], blank: blank };
    }
    var delim = opts.delimiter != null ? opts.delimiter : pickDelimiter(opts.firstLine ? lines[0].text : lines.map(function (l) { return l.text; }).join('\n'), opts);
    var rows = lines.map(function (l) {
      if (opts.fixed && l.text.indexOf('\t') === -1) return splitFixed(l.text);
      return splitLine(l.text, delim, opts);
    });
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    // A row that is not as wide as the widest is named, not guessed at: the cell count is
    // what the paste really had, and the caller decides whether a short row is a gap.
    var ragged = [];
    rows.forEach(function (r, i) { if (r.length !== width) ragged.push({ line: lines[i].n, cells: r.length }); });
    if (opts.pad !== false) rows.forEach(function (r) { while (r.length < width) r.push(''); });
    var header = null, lineNos = lines.map(function (l) { return l.n; });
    var wantHeader = opts.header === 'auto' ? rows.length > 1 && isHeaderShape(rows[0]) : opts.header === true;
    if (wantHeader) { header = rows.shift(); lineNos.shift(); ragged = ragged.filter(function (g) { return g.line !== lines[0].n; }); }
    return { delimiter: delim, header: header, rows: rows, width: width, lines: lineNos, ragged: ragged, blank: blank };
  }

  function defaultIsNumber(v) { return toNumber(v) !== null; }

  function columnReport(rows, opts) {
    var isNumber = (opts && opts.isNumber) || defaultIsNumber;
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var out = [];
    for (var c = 0; c < width; c++) {
      var rep = { filled: 0, numbers: 0, unreadable: [] };
      rows.forEach(function (r, i) {
        var v = r[c] == null ? '' : String(r[c]);
        if (v === '') return;
        rep.filled++;
        if (isNumber(v)) rep.numbers++;
        else rep.unreadable.push({ row: i + 1, text: v });
      });
      out.push(rep);
    }
    return out;
  }

  /* ── name + value lines ────────────────────────────────────────────────── */

  // The value runs to the end of the line, so the LAST separator before it is the split and a
  // name that holds the delimiter ("Washington, D.C.") comes out whole. Thousands separators,
  // a leading $ and a trailing % all survive.
  var ROW_RE = /^\s*(.*?)\s*[\t;,|]\s*\$?\s*(-?[\d][\d,\s]*(?:\.\d+)?\s*%?)\s*$/;

  function parseNamedValues(text) {
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var parsed = [], unreadable = [], headerSkipped = null, firstBad = null;
    lines.forEach(function (line) {
      if (!line.trim()) return;
      var m = ROW_RE.exec(line);
      var value = m ? toNumber(m[2]) : null;
      if (!m || !m[1].trim() || value === null) {
        if (firstBad === null && parsed.length === 0) firstBad = line.trim();
        else unreadable.push(line.trim());
        return;
      }
      parsed.push({ name: m[1].trim(), value: value });
    });
    if (firstBad !== null) {
      if (parsed.length) headerSkipped = firstBad;
      else unreadable.unshift(firstBad);
    }
    return { rows: parsed, headerSkipped: headerSkipped, unreadable: unreadable };
  }

  var THOUSANDS_GROUP = /^\d{3}$/;

  function trailingNumberCount(fields) {
    var n = 0;
    for (var i = fields.length - 1; i >= 1; i--) {
      if (!isNumberField(fields[i])) break;
      n++;
    }
    return n;
  }

  function parseNamedColumns(text) {
    var raw = String(text == null ? '' : text);
    var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var delim = pickDelimiter(raw);
    var split = lines.map(function (line) { return line.split(delim).map(function (f) { return f.trim(); }); });
    if (!split.length) {
      return { slices: [], rows: [], headerSkipped: null, unreadable: [], ambiguous: [], delimiter: delim };
    }
    var hasHeader = split.length > 1 && isHeaderShape(split[0]);
    var firstDataAt = hasHeader ? 1 : 0;
    var headerFields = hasHeader ? split[0] : null;
    var headerSkipped = hasHeader ? lines[0].trim() : null;

    // With commas only a header can say how many value columns there are; with an
    // unambiguous delimiter the first data row is enough.
    var sliceCount;
    if (headerFields && headerFields.length >= 2) sliceCount = headerFields.length - 1;
    else if (delim === ',') sliceCount = 1;
    else sliceCount = trailingNumberCount(split[firstDataAt]);
    sliceCount = Math.max(1, sliceCount);

    var slices = headerFields && headerFields.length >= sliceCount + 1
      ? headerFields.slice(headerFields.length - sliceCount).map(function (s) { return s || ''; })
      : null;
    if (!slices || slices.some(function (s) { return !s; })) {
      slices = [];
      for (var k = 0; k < sliceCount; k++) slices.push('Column ' + (k + 1));
    }

    var rows = [], unreadable = [], ambiguous = [];
    split.forEach(function (fields, i) {
      if (i < firstDataAt) return;
      var line = lines[i].trim();
      if (fields.length <= sliceCount) { unreadable.push(line); return; }
      var values = fields.slice(fields.length - sliceCount).map(toNumber);
      var nameParts = fields.slice(0, fields.length - sliceCount);
      var name = nameParts.join(delim).trim();
      if (values.some(function (v) { return v === null; }) || !name) { unreadable.push(line); return; }
      // A name column that picked up three-digit numeric fields is a thousands separator
      // read as a column break: say so instead of shading a state with 69000148.
      if (delim === ',' && sliceCount > 1 && nameParts.length > 1
          && nameParts.slice(1).every(function (f) { return THOUSANDS_GROUP.test(f) || isNumberField(f); })) {
        ambiguous.push(line);
        return;
      }
      rows.push({ name: name, values: values });
    });
    return { slices: slices, rows: rows, headerSkipped: headerSkipped, unreadable: unreadable, ambiguous: ambiguous, delimiter: delim };
  }

  root.PasteTable = {
    splitLine: splitLine,
    splitFixed: splitFixed,
    pickDelimiter: pickDelimiter,
    toNumber: toNumber,
    isHeaderShape: isHeaderShape,
    parse: parse,
    columnReport: columnReport,
    parseNamedValues: parseNamedValues,
    parseNamedColumns: parseNamedColumns
  };
})(typeof window !== 'undefined' ? window : globalThis);
