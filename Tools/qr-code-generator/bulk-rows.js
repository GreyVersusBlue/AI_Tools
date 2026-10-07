/* bulk-rows.js — reads the pasted rows of 016's Bulk (grid) mode. A plain
   script that publishes one global, `QrBulkRows`, so the page can call it and a
   pure-Node suite can import it. It touches no page, no storage and no network:
   a row is only ever turned into text for a code to be drawn from, and a link
   in it is never opened or checked.

   A row is `label, link or text` (or the other way round, by `order`), split on
   a tab, else a comma. Two rules from before this file stay exactly as they
   were, because a list pasted last term must come out as it did:
     - a row with no delimiter is its own label and its own content;
     - only the FIRST delimiter splits, so a link that holds commas stays whole.
   What this file adds is what a spreadsheet export needs:
     - a cell in "double quotes" keeps its comma ("Rm 214, Wi-Fi") and a doubled
       quote inside it is one quote — through the site's own `Roster.splitCells`,
       which the page hands in as `splitCells`; a row with no quoted cell never
       goes near it;
     - a first row of column names (Label, URL, ...) is detected and skipped;
     - every row that will not make a code is named with its line and why: empty,
       too long for a code at the chosen error correction, or the same label and
       link as an earlier row (two labels on one link are fine: a sign-up form
       for a whole class);
     - a label longer than LABEL_MAX characters is shown shortened and ending
       in an ellipsis. The code itself is never shortened.
   A row is numbered by its line in what was pasted, header and blank lines
   counted, which is the row number a spreadsheet shows. */
(function (global) {
  'use strict';

  var LABEL_MAX = 60;
  var ROW_MAX = 400;
  /* Bytes a version-40 code holds in byte mode, by error-correction level. */
  var CAPACITY = { L: 2953, M: 2331, Q: 1663, H: 1273 };

  var HEADER_WORDS = ['label', 'name', 'title', 'caption', 'station', 'student',
    'text', 'link', 'url', 'address', 'website', 'code', 'content', 'qr code',
    'link or text', 'text or link', 'url or text', 'text or url', 'link text'];

  var LINK_WORDS = ['url', 'link', 'website', 'address', 'link or text', 'text or link', 'url or text', 'text or url'];

  function utf8Len(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }

  /* Cut to `max` characters, the last of them an ellipsis. */
  function shortLabel(label, max) {
    max = max || LABEL_MAX;
    var chars = Array.from(String(label));
    if (chars.length <= max) return String(label);
    return chars.slice(0, max - 1).join('').replace(/\s+$/, '') + '…';
  }

  function delimOf(line) { return line.indexOf('\t') !== -1 ? '\t' : ','; }

  /* The cells of one row as [label, content] before any swap. */
  function splitLine(line, splitCells) {
    var delim = delimOf(line);
    var cells;
    if (splitCells && /(^|[,\t])\s*"/.test(line)) {
      cells = splitCells(line, delim);
      cells = cells.length > 2 ? [cells[0], cells.slice(1).join(delim)] : cells;
    } else {
      var idx = line.indexOf(delim);
      cells = idx === -1 ? [line] : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }
    var label = (cells[0] || '').trim();
    var content = (cells.length > 1 ? cells[1] : cells[0] || '').trim();
    if (cells.length > 1) {
      if (!label) label = content;
      if (!content) content = label;
    }
    return { cells: cells, label: label, content: content };
  }

  /* A first row is column names when every cell in it is one. A row with a
     single cell is also a list of one thing per line ("Station" could be a
     label), so it counts only for a word that names a link. */
  function isHeader(cells) {
    var seen = 0, only = '';
    for (var i = 0; i < cells.length; i++) {
      var w = String(cells[i]).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!w) continue;
      if (HEADER_WORDS.indexOf(w) === -1) return false;
      seen++; only = w;
    }
    return seen > 1 || (seen === 1 && LINK_WORDS.indexOf(only) !== -1);
  }

  /** opts: { splitCells, order: 'label-first' | 'link-first', ec: 'L'|'M'|'Q'|'H' }
      → { rows, problems, header, shortened, total }
      rows: each { line, label, shown, content }; problems: each { line, text, reason }. */
  function parse(raw, opts) {
    opts = opts || {};
    var ec = CAPACITY[opts.ec] ? opts.ec : 'M';
    var linkFirst = opts.order === 'link-first';
    var lines = String(raw || '').split(/\r?\n/);
    var rows = [], problems = [], seen = {};
    var header = false, shortened = 0, firstSeen = false, total = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = splitLine(line, opts.splitCells);
      if (!firstSeen) {
        firstSeen = true;
        if (isHeader(parts.cells)) { header = true; continue; }
      }
      total++;
      var label = parts.label, content = parts.content;
      if (linkFirst && parts.cells.length > 1) { var t = label; label = content; content = t; }
      var lineNo = i + 1;
      if (!label && !content) {
        problems.push({ line: lineNo, text: '(empty)', reason: 'nothing to put in a code' });
        continue;
      }
      var bytes = utf8Len(content);
      if (bytes > CAPACITY[ec]) {
        problems.push({ line: lineNo, text: shortLabel(label, 30),
          reason: 'too long for a code at error correction ' + ec + ' (' + bytes + ' bytes, the most is ' + CAPACITY[ec] + ')' });
        continue;
      }
      var key = label + '\u0000' + content;
      if (Object.prototype.hasOwnProperty.call(seen, key)) {
        problems.push({ line: lineNo, text: shortLabel(label, 30), reason: 'same label and link as line ' + seen[key] });
        continue;
      }
      seen[key] = lineNo;
      var shown = shortLabel(label);
      if (shown !== label) shortened++;
      rows.push({ line: lineNo, label: label, shown: shown, content: content });
    }
    return { rows: rows, problems: problems, header: header, shortened: shortened, total: total };
  }

  global.QrBulkRows = {
    LABEL_MAX: LABEL_MAX,
    ROW_MAX: ROW_MAX,
    CAPACITY: CAPACITY,
    utf8Len: utf8Len,
    shortLabel: shortLabel,
    splitLine: splitLine,
    isHeader: isHeader,
    parse: parse
  };
})(typeof window !== 'undefined' ? window : globalThis);
