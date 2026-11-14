/* sda-io.js — files in and out for 091 Student Data Anonymizer. Publishes
   window.SdaIo (or module.exports under Node). Every function takes the
   library it needs as an argument (SheetJS as X, jsPDF's namespace as J), so
   a Node test hands in the vendored copies and the page hands in window's.

     readSheets(bytes, fileName, X)   a CSV, XLS or XLSX as [{ name, rows }]
     detectLayout(sheets)             which known export this is, by its headings
     readDocument(bytes, fileName, X) both, as a DOCUMENT (see sda-core.js)
     writeXlsx(doc, X)                a DOCUMENT as xlsx bytes
     writePdf(doc, J, X, title)       a DOCUMENT as PDF bytes, one table per sheet

   CELLS ARE COPIED, NOT RETYPED. A number keeps its number format ("0.00%"),
   a string stays a string ("08" stays "08"; a CSV is read with raw: true so a
   student ID never loses a leading zero), and a formula keeps only its value:
   the anonymized file never recalculates from a cell that is no longer there.

   The ExportKit.toXlsx() helper is not used here on purpose: it writes a value
   and no number format, and a copy of a gradebook that shows 0.625 where the
   export showed 62.50% is not "the same information". */
(function (root) {
  'use strict';

  // sda-core.js loads first (window.SdaCore).
  var C = root.SdaCore;

  function toCell(c) {
    if (!c) return null;
    if (c.t === 'z' || c.v == null || c.v === '') return null;
    if (c.t === 'e') return c.w ? { t: 's', v: String(c.w) } : null;
    if (c.t === 'n') return c.z && c.z !== 'General' ? { t: 'n', v: c.v, z: c.z } : { t: 'n', v: c.v };
    if (c.t === 'b') return { t: 'b', v: !!c.v };
    if (c.t === 'd') return { t: 's', v: c.w || String(c.v) };
    return { t: 's', v: String(c.v) };
  }

  function readSheets(bytes, fileName, X) {
    var wb;
    if (/\.csv$/i.test(fileName || '')) {
      var txt = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8').decode(bytes);
      wb = X.read(txt.replace(/^﻿/, ''), { type: 'string', raw: true });
    } else {
      wb = X.read(bytes, { type: 'array', cellNF: true, cellDates: false });
    }
    return wb.SheetNames.map(function (n) {
      var ws = wb.Sheets[n], rows = [];
      if (ws && ws['!ref']) {
        var rg = X.utils.decode_range(ws['!ref']);
        for (var r = rg.s.r; r <= rg.e.r; r++) {
          var row = [];
          for (var c = rg.s.c; c <= rg.e.c; c++) row.push(toCell(ws[X.utils.encode_cell({ r: r, c: c })]));
          while (row.length && row[row.length - 1] == null) row.pop();
          rows.push(row);
        }
        while (rows.length && !rows[rows.length - 1].length) rows.pop();
      }
      return { name: n, rows: rows };
    });
  }

  var LAYOUTS = [
    { id: 'esp-attendance', label: 'ESP Reporting Center: Attendance Totals by Marking Period',
      test: function (h) { return has(h, 'student id') && has(h, 'student name') && h.some(function (x) { return /^abs mp\d|^abs ytd$/.test(x); }); } },
    { id: 'pm-bbcard', label: 'Performance Matters: Baseball Card',
      test: function (h) { return h.some(function (x) { return x.indexOf('state/local by subject') === 0; }); } },
    { id: 'pm-assessment', label: 'Performance Matters: assessment results (items, interactions, rubric, time)',
      test: function (h) { return has(h, 'student id') && has(h, 'student name') && (has(h, 'pe/pp') || has(h, 'test score %')); } },
    { id: 'esp-export', label: 'ESP Reporting Center export',
      test: function (h, raw) { return raw.some(function (x) { return x === 'STUDENT_ID' || x === 'STUDENT_NAME'; }); } }
  ];
  function has(h, s) { return h.indexOf(s) >= 0; }
  function detectLayout(sheets) {
    for (var s = 0; s < sheets.length; s++) {
      var rows = sheets[s].rows, hr = C.findHeaderRow(rows);
      if (hr < 0) continue;
      var raw = (rows[hr] || []).map(function (c) { return C.text(c).trim(); });
      var h = raw.map(function (x) { return x.replace(/[_\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); });
      for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].test(h, raw)) return { id: LAYOUTS[i].id, label: LAYOUTS[i].label };
    }
    return { id: 'generic', label: 'A spreadsheet this page does not know by name: check the columns it picked' };
  }

  function readDocument(bytes, fileName, X) {
    var sheets = readSheets(bytes, fileName, X);
    return { name: fileName, layout: detectLayout(sheets), sheets: sheets.map(function (s) { return C.makeSheet(s.name, s.rows); }) };
  }

  // ---- writing -----------------------------------------------------------------

  function shown(c, X) {
    if (!c) return '';
    if (c.t === 'n' && c.z && X && X.SSF) { try { return X.SSF.format(c.z, c.v); } catch (e) {} }
    if (c.t === 'b') return c.v ? 'TRUE' : 'FALSE';
    return String(c.v);
  }

  function writeXlsx(doc, X) {
    var wb = X.utils.book_new(), taken = {};
    doc.sheets.forEach(function (sh, i) {
      var ws = {}, width = 0, widths = [];
      sh.rows.forEach(function (row, r) {
        (row || []).forEach(function (c, ci) {
          if (!c) return;
          var cell = c.t === 'n' ? (c.z ? { t: 'n', v: c.v, z: c.z } : { t: 'n', v: c.v }) : c.t === 'b' ? { t: 'b', v: c.v } : { t: 's', v: String(c.v) };
          ws[X.utils.encode_cell({ r: r, c: ci })] = cell;
          var len = Math.min(60, String(shown(c, X)).split('\n').reduce(function (m, l) { return Math.max(m, l.length); }, 0));
          widths[ci] = Math.max(widths[ci] || 6, len + 1);
        });
        width = Math.max(width, (row || []).length);
      });
      ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, sh.rows.length - 1), c: Math.max(0, width - 1) } });
      ws['!cols'] = widths.map(function (w) { return { wch: w || 8 }; });
      var name = String(sh.name || 'Sheet' + (i + 1)).replace(/[\[\]:*?\/\\]/g, '').slice(0, 31) || 'Sheet' + (i + 1), base = name, n = 2;
      while (taken[name.toLowerCase()]) name = base.slice(0, 27) + ' (' + n++ + ')';
      taken[name.toLowerCase()] = true;
      X.utils.book_append_sheet(wb, ws, name);
    });
    return X.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  }

  /** One landscape table per sheet, the heading rows repeated on every page. */
  function writePdf(doc, J, X, title) {
    var pdf = new J.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    if (typeof pdf.autoTable !== 'function') throw new Error('The PDF table library did not load. Reload the page and try again.');
    doc.sheets.forEach(function (sh, i) {
      if (i) pdf.addPage();
      var hr = Math.max(0, sh.headerRow == null ? 0 : sh.headerRow);
      var width = sh.rows.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 0);
      var line = function (r) { var out = []; for (var c = 0; c < width; c++) out.push(shown((r || [])[c], X)); return out; };
      pdf.setFontSize(12);
      pdf.text((title ? title + ' — ' : '') + sh.name, 30, 30);
      pdf.autoTable({
        head: sh.rows.slice(0, hr + 1).map(line),
        body: sh.rows.slice(hr + 1).map(line),
        startY: 40,
        margin: { left: 30, right: 30 },
        styles: { fontSize: width > 14 ? 6 : 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [40, 60, 90], textColor: 255 },
        theme: 'grid'
      });
    });
    return pdf.output('arraybuffer');
  }

  var SdaIo = { readSheets: readSheets, detectLayout: detectLayout, readDocument: readDocument, writeXlsx: writeXlsx, writePdf: writePdf, shown: shown, LAYOUTS: LAYOUTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = SdaIo; else root.SdaIo = SdaIo;
})(typeof window !== 'undefined' ? window : globalThis);
