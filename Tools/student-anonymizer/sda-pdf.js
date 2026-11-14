/* sda-pdf.js — reading PDFs for 091 Student Data Anonymizer. Publishes
   window.SdaPdf (or module.exports under Node).

   Two halves:
     extractPage(page, OPS)  the one place pdf.js is touched: a page's text
                             items, filled rectangles and straight lines, in
                             points with the origin at the TOP left.
     parseTac(pages)         pure: Teacher Access Center's "Student Detail
                             Report" (one student to a page, the name in the
                             title, no student ID) into a DOCUMENT of three
                             sheets: Assignments, Category totals, Overall.

   THE TAC TABLE. Its column edges are the header's filled cells, not guessed
   from where words sit: a left-aligned name and a right-aligned score in
   neighbouring columns sit a few points apart. Its rows are the grey cells
   down the Assignment column, which also give each row's exact top and
   bottom. When a PDF has no such rectangles, the header words and the due
   dates stand in for both.

   A LINE THROUGH A CELL means the assignment is not included yet, usually
   because the teacher has not entered the grade (Devon, 2026-11-13). The
   report draws it as a solid thin line across one cell; the cell borders are
   dashed, and the one solid border (under "Extra credit: overall average")
   runs along a row's edge and across three columns. So a line counts as a
   strike only when it is solid, inside one column, and inside a row (not on
   its edge). The cells struck are named in "Not included (line through)".

   Nothing here keeps anything between calls. */
(function (root) {
  'use strict';

  var DATE_RE = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/;

  // ---- extraction (pdf.js) -------------------------------------------------

  function mul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

  /** { width, height, items: [{ str, x, y, w, h }], rects: [{ x, y, w, h }],
      lines: [{ x1, x2, y, dashed, width }] }. y is the TOP of a text item.
      Only filled rectangles and horizontal stroked lines are kept. */
  async function extractPage(page, OPS) {
    var vp = page.getViewport({ scale: 1 }), H = vp.height;
    var tc = await page.getTextContent();
    var items = [];
    tc.items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var fs = Math.abs(it.transform[3]) || it.height || 10;
      items.push({ str: it.str.replace(/\s+/g, ' ').trim(), x: it.transform[4], y: H - it.transform[5] - fs, w: it.width || 0, h: fs });
    });
    var ol = await page.getOperatorList();
    var rects = [], lines = [];
    var ctm = [1, 0, 0, 1, 0, 0], stack = [], dashed = false, lw = 1;
    var PAINT_FILL = {}, PAINT_STROKE = {}, SKIP = {};
    ['fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].forEach(function (k) { if (OPS[k] != null) PAINT_FILL[OPS[k]] = true; });
    ['stroke', 'closeStroke', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].forEach(function (k) { if (OPS[k] != null) PAINT_STROKE[OPS[k]] = true; });
    ['clip', 'eoClip'].forEach(function (k) { if (OPS[k] != null) SKIP[OPS[k]] = true; });
    for (var i = 0; i < ol.fnArray.length; i++) {
      var fn = ol.fnArray[i], args = ol.argsArray[i];
      if (fn === OPS.save) stack.push({ ctm: ctm, dashed: dashed, lw: lw });
      else if (fn === OPS.restore) { var st = stack.pop(); if (st) { ctm = st.ctm; dashed = st.dashed; lw = st.lw; } }
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.setDash) dashed = !!(args[0] && args[0].length);
      else if (fn === OPS.setLineWidth) lw = args[0];
      else if (fn === OPS.constructPath) {
        var j = i + 1;
        while (j < ol.fnArray.length && SKIP[ol.fnArray[j]]) j++;
        var paint = ol.fnArray[j], fill = !!PAINT_FILL[paint], stroke = !!PAINT_STROKE[paint];
        if (!fill && !stroke) continue;
        var ops = args[0], co = args[1], k = 0, cur = null;
        for (var o = 0; o < ops.length; o++) {
          var op = ops[o];
          if (op === OPS.moveTo) { cur = apply(ctm, co[k], co[k + 1]); k += 2; }
          else if (op === OPS.lineTo) {
            var nx = apply(ctm, co[k], co[k + 1]); k += 2;
            if (stroke && cur && Math.abs(cur[1] - nx[1]) < 0.3 && Math.abs(cur[0] - nx[0]) > 0.5) {
              lines.push({ x1: Math.min(cur[0], nx[0]), x2: Math.max(cur[0], nx[0]), y: H - cur[1], dashed: dashed, width: lw * Math.abs(ctm[3] || 1) });
            }
            cur = nx;
          } else if (op === OPS.rectangle) {
            var a = apply(ctm, co[k], co[k + 1]), b = apply(ctm, co[k] + co[k + 2], co[k + 1] + co[k + 3]); k += 4;
            var rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]), rw = Math.abs(b[0] - a[0]), rh = Math.abs(b[1] - a[1]);
            if (fill && rw > 1 && rh > 1) rects.push({ x: rx, y: H - ry - rh, w: rw, h: rh });
            else if (stroke && rh < 0.6 && rw > 0.5) lines.push({ x1: rx, x2: rx + rw, y: H - ry, dashed: dashed, width: lw });
          }
          else if (op === OPS.curveTo) k += 6;
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
        }
      }
    }
    return { width: vp.width, height: H, items: items, rects: rects, lines: lines };
  }

  // ---- the TAC Student Detail Report (pure) --------------------------------

  var mid = function (it) { return it.y + it.h / 2; };
  var sameLine = function (a, b) { return Math.abs((a.y + a.h) - (b.y + b.h)) < 2; };
  function byReading(a, b) { return (a.y + a.h) - (b.y + b.h) > 1.5 ? 1 : (b.y + b.h) - (a.y + a.h) > 1.5 ? -1 : a.x - b.x; }
  function join(items) { return items.slice().sort(byReading).map(function (t) { return t.str; }).join(' ').replace(/\s+/g, ' ').trim(); }

  function isTac(pages) { return pages.some(function (p) { return p.items.some(function (t) { return /Student Detail Report/i.test(t.str); }); }); }

  function labelValue(items, label) {
    var lab = items.find(function (t) { return t.str === label || t.str.indexOf(label + ' ') === 0; });
    if (!lab) return '';
    if (lab.str.length > label.length) return lab.str.slice(label.length).trim();
    var right = items.filter(function (t) { return t !== lab && sameLine(t, lab) && t.x >= lab.x + lab.w - 1 && !/:$/.test(t.str); })
      .sort(function (a, b) { return a.x - b.x; });
    return right.length ? right[0].str : '';
  }

  /** Column edges from the filled header cells in the band of `anchor`, or
      from header words when there are no cells. [{ left, right, label }]. */
  function headerColumns(page, anchor, below) {
    var band = page.rects.filter(function (r) { return r.y <= mid(anchor) && r.y + r.h >= mid(anchor) && r.w < page.width * 0.6 && r.h < 60; });
    band.sort(function (a, b) { return a.x - b.x || b.w - a.w; });
    var cells = [];
    band.forEach(function (r) {
      var last = cells[cells.length - 1];
      if (last && r.x < last.right - 2) { if (r.x + r.w > last.right) last.right = r.x + r.w; last.top = Math.min(last.top, r.y); last.bottom = Math.max(last.bottom, r.y + r.h); return; }
      cells.push({ left: r.x, right: r.x + r.w, top: r.y, bottom: r.y + r.h });
    });
    var top, bottom;
    if (cells.length >= 3) {
      top = Math.min.apply(null, cells.map(function (c) { return c.top; }));
      bottom = Math.max.apply(null, cells.map(function (c) { return c.bottom; }));
    } else {
      // No cells: the header is the run of lines around the anchor with no date in them.
      top = anchor.y - 12; bottom = anchor.y + anchor.h + 12;
      var words = page.items.filter(function (t) { return t.y >= top && t.y + t.h <= bottom && t.y > (below || 0); }).sort(function (a, b) { return a.x - b.x; });
      cells = [];
      words.forEach(function (t) {
        var last = cells[cells.length - 1];
        if (last && t.x < last.right + 3) { last.right = Math.max(last.right, t.x + t.w); return; }
        cells.push({ left: t.x, right: t.x + t.w });
      });
      for (var i = 0; i < cells.length; i++) {
        var l = i ? (cells[i - 1].right + cells[i].left) / 2 : cells[i].left - 40;
        var r = i < cells.length - 1 ? (cells[i].right + cells[i + 1].left) / 2 : cells[i].right + 40;
        cells[i].l2 = l; cells[i].r2 = r;
      }
      cells.forEach(function (c) { c.left = c.l2; c.right = c.r2; });
    }
    cells.forEach(function (c) {
      var inside = page.items.filter(function (t) {
        var cx = t.x + t.w / 2;
        return mid(t) >= top - 1 && mid(t) <= bottom + 1 && cx >= c.left && cx <= c.right && !/^[\/=*]$/.test(t.str);
      });
      c.label = join(inside).replace(/^[=\/*]\s*|\s*[=\/*]$/g, '').trim();
    });
    return { cols: cells.filter(function (c) { return c.label; }), top: top, bottom: bottom };
  }
  function colOf(cols, x) {
    for (var i = 0; i < cols.length; i++) if (x >= cols[i].left - 1.5 && x < cols[i].right - 1) return i;
    return -1;
  }

  /** Rows of a table under `head`, down to `end`: each row starts where
      `isStart(item, colIndex)` says, and owns every item down to the next.
      Returns [{ top, bottom, cells: [string], extra: [string], struck: {col: true}, flags }]. */
  function tableRows(page, head, end, isStart) {
    var cols = head.cols;
    var body = page.items.filter(function (t) { return t.y >= head.bottom - 1 && t.y + t.h <= end + 1; });
    var starts = body.filter(function (t) { return isStart(t, colOf(cols, t.x + 0.5)); }).sort(byReading);
    var rows = [];
    starts.forEach(function (s) {
      if (rows.length && sameLine(rows[rows.length - 1].start, s)) return;
      var top = Math.min.apply(null, body.filter(function (t) { return sameLine(t, s); }).map(function (t) { return t.y; })) - 2.5;
      // A filled cell down the first column that holds this row's first line is its exact extent.
      var cell = page.rects.find(function (r) {
        return Math.abs(r.x - cols[0].left) < 3 && r.w < (cols[0].right - cols[0].left) + 4 && r.y <= mid(s) && r.y + r.h >= mid(s);
      });
      rows.push({ start: s, top: cell ? cell.y : top, exact: cell || null });
    });
    rows.forEach(function (r, i) {
      r.bottom = r.exact ? r.exact.y + r.exact.h : (i < rows.length - 1 ? rows[i + 1].top : end);
      r.cells = cols.map(function () { return []; });
      r.extra = [];
      r.struck = {};
      r.flags = { retake: false, dropped: false };
    });
    body.forEach(function (t) {
      var m = mid(t), row = null;
      for (var i = 0; i < rows.length; i++) if (m >= rows[i].top - 0.5 && m < rows[i].bottom + 0.5) { row = rows[i]; break; }
      if (!row) return;
      if (t.str === '*') { row.flags.dropped = true; return; }
      var c = colOf(cols, t.x + 0.5);
      if (t.str === 'R' && (c <= 0) && t.x < cols[0].left + 6) { row.flags.retake = true; return; }
      if (c < 0) { row.extra.push(t); return; }
      if (t.x + t.w > cols[c].right + 3 && c < cols.length - 1) { row.extra.push(t); return; }
      row.cells[c].push(t);
    });
    page.lines.forEach(function (ln) {
      if (ln.dashed || ln.width > 1.5 || ln.x2 - ln.x1 < 4) return;
      var c = -1;
      for (var i = 0; i < cols.length; i++) if (ln.x1 >= cols[i].left - 2 && ln.x2 <= cols[i].right + 2) { c = i; break; }
      if (c < 0) return;
      rows.forEach(function (r) { if (ln.y > r.top + 2 && ln.y < r.bottom - 2) r.struck[c] = true; });
    });
    return rows.map(function (r) {
      return { cells: r.cells.map(join), extra: join(r.extra), struck: r.struck, flags: r.flags };
    });
  }

  function cell(s) {
    s = String(s == null ? '' : s).trim();
    if (!s) return null;
    var m = s.match(/^(-?\d+)(?:\.(\d+))?$/);
    if (m) return { t: 'n', v: parseFloat(s), z: m[2] ? '0.' + '0'.repeat(m[2].length) : '0' };
    m = s.match(/^(-?\d+)(?:\.(\d+))?%$/);
    if (m) return { t: 'n', v: parseFloat(s) / 100, z: (m[2] ? '0.' + '0'.repeat(m[2].length) : '0') + '%' };
    return { t: 's', v: s };
  }
  var str = function (s) { s = String(s == null ? '' : s).trim(); return s ? { t: 's', v: s } : null; };

  /** One page's student, header fields and tables, or null when the page has
      no Student Detail table at all. */
  function readPage(page) {
    var items = page.items;
    var title = items.find(function (t) { return /Student Detail Report/i.test(t.str); });
    var info = { name: '', school: '', date: '', course: '', teacher: '', period: '', mp: '' };
    var below = 0;
    if (title) {
      var nameIt = items.filter(function (t) {
        return t.y > title.y + title.h * 0.6 && t.y < title.y + title.h + 22 && t.x < title.x + title.w && t.x + t.w > title.x && t.str.indexOf(':') < 0;
      }).sort(function (a, b) { return a.y - b.y; })[0];
      info.name = nameIt ? nameIt.str : '';
      var top = items.filter(function (t) { return t !== title && Math.abs(t.y - title.y) < 14; });
      var d = top.find(function (t) { return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t.str); });
      info.date = d ? d.str : '';
      var sch = top.filter(function (t) { return t.x + t.w < title.x && t !== d; }).sort(function (a, b) { return a.x - b.x; });
      info.school = join(sch);
      info.course = labelValue(items, 'Course:');
      info.teacher = labelValue(items, 'Teacher:');
      info.mp = labelValue(items, 'Marking Period:');
      var per = items.filter(function (t) { return t.str === 'Period:'; })[0];
      info.period = per ? labelValue([per].concat(items.filter(function (t) { return t !== per && !/Marking/.test(t.str); })), 'Period:') : '';
      below = (nameIt || title).y + 5;
    }
    var anchor = items.filter(function (t) { return t.str === 'Assignment' && t.y > below; }).sort(function (a, b) { return a.y - b.y; })[0];
    if (!anchor) return title ? { info: info, cols: [], rows: [], totals: null, overall: null } : null;
    var head = headerColumns(page, anchor, below);
    var endIt = items.filter(function (t) { return t.y > head.bottom && (/Retake entered|overall average is/i.test(t.str) || t.str === 'Category'); })
      .sort(function (a, b) { return a.y - b.y; })[0];
    var end = endIt ? endIt.y - 1 : page.height;
    var dueCol = head.cols.findIndex(function (c) { return /due/i.test(c.label); });
    var numCols = head.cols.map(function (c, i) { return i; }).filter(function (i) { return /score|weight|points|percent/i.test(head.cols[i].label); });
    var rows = tableRows(page, head, end, function (t, c) {
      return dueCol >= 0 ? (c === dueCol && DATE_RE.test(t.str)) : numCols.indexOf(c) >= 0;
    });
    // The category totals table under it.
    var totals = null;
    var catIt = items.filter(function (t) { return t.str === 'Category' && t.y > end; }).sort(function (a, b) { return a.y - b.y; })[0];
    var avgIt = items.find(function (t) { return /overall average is/i.test(t.str); });
    if (catIt) {
      var th = headerColumns(page, catIt, end);
      var tEnd = avgIt ? avgIt.y - 1 : page.height;
      totals = { cols: th.cols, rows: tableRows(page, th, tEnd, function (t, c) { return c > 0 && /^-?[\d.]+%?$/.test(t.str); }) };
    }
    var overall = null;
    if (avgIt) {
      var line = join(items.filter(function (t) { return sameLine(t, avgIt) || (Math.abs(t.y - avgIt.y) < 4); }));
      var m = line.match(/([\d.]+)\s*\/\s*([\d.]+)\s*=\s*([\d.]+)\s*%/), g = line.match(/Grade:\s*([^)]*)\)/);
      overall = { points: m ? m[1] : '', max: m ? m[2] : '', pct: m ? m[3] + '%' : '', grade: g ? g[1].replace(/\s+/g, '') : '', text: line };
    }
    return { info: info, cols: head.cols, rows: rows, totals: totals, overall: overall };
  }

  /** The whole PDF as a DOCUMENT. A page with no title continues the student
      before it. `name` is the file's name. */
  function parseTac(pages, name) {
    var students = [], cur = null, colLabels = null, totalLabels = null;
    pages.forEach(function (p) {
      var r = readPage(p);
      if (!r) return;
      if (r.info.name || !cur) {
        cur = { info: r.info, rows: [], totals: [], overall: null };
        students.push(cur);
      }
      if (r.cols.length && !colLabels) colLabels = r.cols.map(function (c) { return c.label; });
      if (r.totals && r.totals.cols.length && !totalLabels) totalLabels = r.totals.cols.map(function (c) { return c.label; });
      cur.rows = cur.rows.concat(r.rows);
      if (r.totals) cur.totals = cur.totals.concat(r.totals.rows);
      if (r.overall) cur.overall = r.overall;
    });
    colLabels = colLabels || [];
    totalLabels = totalLabels || [];
    var ctxHead = ['Student Name', 'School', 'Report Date', 'Course', 'Teacher', 'Period', 'Marking Period'];
    var ctx = function (s) { var i = s.info; return [str(i.name), str(i.school), str(i.date), str(i.course), str(i.teacher), str(i.period), str(i.mp)]; };
    var aRows = [ctxHead.concat(colLabels, ['Not included (line through)', 'Retake', 'Dropped', 'Note']).map(str)];
    var tRows = [['Student Name', 'Course', 'Period', 'Marking Period'].concat(totalLabels).map(str)];
    var oRows = [['Student Name', 'School', 'Report Date', 'Course', 'Teacher', 'Period', 'Marking Period', 'Points', 'Maximum Points', 'Overall Percent', 'Letter Grade'].map(str)];
    students.forEach(function (s) {
      s.rows.forEach(function (row) {
        var struck = Object.keys(row.struck).map(Number).sort(function (a, b) { return a - b; }).map(function (i) { return colLabels[i]; });
        aRows.push(ctx(s).concat(row.cells.map(cell), [
          struck.length ? str('Yes (' + struck.join(', ') + ')') : null,
          row.flags.retake ? str('Yes') : null, row.flags.dropped ? str('Yes') : null, str(row.extra)]));
      });
      s.totals.forEach(function (row) {
        var c = ctx(s);
        tRows.push([c[0], c[3], c[5], c[6]].concat(row.cells.map(function (v, i) { return i === 0 ? str(v) : cell(v); })));
      });
      if (s.overall) {
        var o = s.overall;
        oRows.push(ctx(s).concat([cell(o.points), cell(o.max), cell(o.pct), str(o.grade)]));
      }
    });
    var C = root.SdaCore; // sda-core.js loads first
    var sheet = function (nm, rows) { var sh = C.makeSheet(nm, rows); sh.headerRow = 0; return sh; };
    return {
      name: name,
      layout: { id: 'tac-detail', label: 'Teacher Access Center: Student Detail Report (PDF)' },
      students: students.length,
      sheets: [sheet('Assignments', aRows), sheet('Category totals', tRows), sheet('Overall', oRows)]
    };
  }

  var SdaPdf = { extractPage: extractPage, isTac: isTac, readPage: readPage, parseTac: parseTac, cell: cell, headerColumns: headerColumns, tableRows: tableRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = SdaPdf; else root.SdaPdf = SdaPdf;
})(typeof window !== 'undefined' ? window : globalThis);
