/* export.js — the shared export layer (Path 7 P4): the imposition and
   pagination math, toPdf() for pages a tool can already draw, and the file
   helpers (CSV, XLSX, ZIP, download). BACKLOG.md's Path 7 P4 bullet has the
   whole surface and what is left.

   What is here:

     ExportKit.booklet(pageCount, { sheetsPerSignature, flip, rtl })
       Saddle-stitch page order. Each sheet is { front: [left, right],
       back: [left, right] }, a slot is { page, rotate }, pages count from 1
       and a blank is `page: null`.

     ExportKit.nUp(pageCount, { cols, rows, order, rtl, duplex })
       Reading-order N-up: which page goes in which cell of which side.

     ExportKit.flipAxis(orientation, flip), backIndex(), mirrorPage(),
     mirrorPageRows(), paginate()
       Where the back of a card lands so that it prints behind its front, for
       a duplex printer that turns the paper on either edge. paginate() and
       mirrorPageRows() are duplex-print.js's two functions, kept to the
       letter; the Node suite holds the two files to the same answers.

     ExportKit.layout({ sheet, cols, rows, margin, gutter, page, fit, align })
       The geometry of one side: equal cells, and the source page fitted into
       each. Points, origin top left, y down.

     ExportKit.creep(), cutMarks(), matrix()
       How far a booklet sheet's pages move toward the spine, the trim marks
       round a grid, and the PDF matrix that puts a source page in its slot,
       upright or turned 180 degrees.

     ExportKit.paginateBlocks(blocks, pageHeight, { gap, firstPageHeight, minSlice })
       Flow pagination for a PDF nobody lays out with CSS: blocks of known
       height onto pages, never splitting a block that must stay whole,
       keeping a heading with what follows it, slicing a block that may be
       cut. A block taller than a page is placed alone and flagged
       `overflow`; nothing is ever dropped or clipped. No slice is thinner
       than a hundredth of a point.

     ExportKit.pdfPlan(pageCount, opts)
       Everything toPdf() will do, as data: each side of each sheet, its
       size, its slots with their matrices, its cut marks. Pure.

     ExportKit.toPdf(pages, opts)
       Runs a plan on the vendored jsPDF. A page is a canvas, a loaded
       <img>, a data URL, or a function (doc, { w, h, page }) that draws
       with jsPDF in points with the origin at the page's top left.
       Returns { doc, plan }; `filename` also saves the file.

     ExportKit.toCsv(rows, { columns, delimiter, bom, raw })
       A CSV file as a string: RFC 4180 quoting, CRLF after every record, a
       UTF-8 byte order mark first (Excel reads UTF-8 only with one). Rows
       are arrays or objects; `columns` names the order and the header row.
       A typed cell that a spreadsheet would run as a formula gets a leading
       apostrophe; see FORMULAS below.

     ExportKit.toXlsx(sheets, { filename })
       A workbook on the vendored SheetJS, as a Blob. `sheets` is rows, or
       [{ name, rows, columns }]. A string is always a string cell.

     ExportKit.toZip(files, { filename })
       A zip on the vendored JSZip, as a promise of a Blob. `files` is
       [{ name, data }]; data is a string, Blob, ArrayBuffer, typed array or
       canvas (saved as a PNG).

     ExportKit.download(data, filename, mime), ExportKit.filename(title, ext)
       The one anchor click every helper here saves through, and a file name
       that is safe on every desktop.

   FORMULAS. A roster is typed by one person and opened in a spreadsheet by
   another, and a cell that starts with =, +, -, @, a tab or a return is run,
   not shown. toCsv() puts an apostrophe in front of every STRING that starts
   that way (`raw: true` turns that off). A number is not a string: -5 the
   number is written -5, "-5" the typed text is written '-5. toXlsx() needs
   no apostrophe, because it writes every string as a string cell and never
   writes a formula at all.

   WHAT toPdf() DOES NOT DO YET. It does not take a DOM element: the vendored
   jsPDF's html() needs html2canvas, which is not vendored, and that is a
   decision recorded in BACKLOG.md, not made here. It does not clip a page to
   its slot, so a draw function that runs off its page runs onto its
   neighbour. Slots turn 0 or 180 degrees only; there is no quarter turn, so
   an N-up never rotates a page to fit.

   EDGES. `flip` is the edge of the physical paper the duplex unit turns the
   sheet on: 'long' or 'short'. On a portrait sheet the long edge is at the
   side and the sheet turns like a book's page; on a landscape sheet it is at
   the top and the sheet turns like a wall calendar's. flipAxis() is that
   sentence as a function, and every back-side answer here goes through it.
   A booklet sheet is landscape, so it folds right when turned on its SHORT
   edge; told 'long', booklet() turns each back side 180 degrees to suit.

   UNITS. Everything is PostScript points (72 to the inch), y down from the
   top left, until matrix() converts for the PDF. toPt() reads '0.5in',
   '12mm', '2cm', '36pt' and '96px'; a bare number is points.

   Nothing here reads storage, and nothing has been printed on paper.

   Plain global script, not an ES module, for the reason store.js gives. */
(function (global) {
  'use strict';

  var UNIT = { 'in': 72, mm: 72 / 25.4, cm: 72 / 2.54, pt: 1, px: 0.75 };

  /* Portrait sizes in points. PrintKit.PAPERS is the same four in CSS units;
     tabloid and A3 are here because a booklet of letter or A4 pages is
     printed on them. */
  var PAPERS = {
    letter:  { w: 612, h: 792 },
    legal:   { w: 612, h: 1008 },
    tabloid: { w: 792, h: 1224 },
    a3:      { w: 841.89, h: 1190.55 },
    a4:      { w: 595.28, h: 841.89 },
    a5:      { w: 419.53, h: 595.28 }
  };

  var MAX_PAGES = 4000;

  function count(n) {
    n = Math.floor(Number(n));
    return n > 0 && isFinite(n) ? Math.min(n, MAX_PAGES) : 0;
  }
  function atLeast1(n) { n = Math.floor(Number(n)); return n >= 1 && isFinite(n) ? n : 1; }
  function nonNeg(n, fallback) { n = Number(n); return n >= 0 && isFinite(n) ? n : (fallback || 0); }

  /** A length in points. A number is points already; a string carries a unit. */
  function toPt(v, fallback) {
    if (typeof v === 'number') return isFinite(v) ? v : nonNeg(fallback);
    var m = /^\s*(-?\d*\.?\d+)\s*(in|mm|cm|pt|px)\s*$/i.exec(String(v === null || v === undefined ? '' : v));
    return m ? Number(m[1]) * UNIT[m[2].toLowerCase()] : nonNeg(fallback);
  }

  /** { paper, orientation, w, h } in points. An unknown paper is letter. */
  function paper(opts) {
    opts = opts || {};
    var key = String(opts.paper || '').toLowerCase();
    if (!PAPERS[key]) key = 'letter';
    var landscape = String(opts.orientation || '').toLowerCase() === 'landscape';
    var p = PAPERS[key];
    return { paper: key, orientation: landscape ? 'landscape' : 'portrait', w: landscape ? p.h : p.w, h: landscape ? p.w : p.h };
  }

  // ---- duplex ---------------------------------------------------------------

  /** The axis, as the reader sees the sheet, that a duplex unit turns it
      about: 'vertical' swaps left and right, 'horizontal' swaps top and
      bottom. */
  function flipAxis(orientation, flip) {
    var landscape = String(orientation || '').toLowerCase() === 'landscape';
    var short = String(flip || '').toLowerCase() === 'short';
    return landscape === short ? 'vertical' : 'horizontal';
  }

  /** Where the cell at row-major `index` of a cols x rows grid is on the
      other side of the paper. */
  function backIndex(index, cols, rows, axis) {
    var r = Math.floor(index / cols), c = index % cols;
    return axis === 'horizontal' ? (rows - 1 - r) * cols + c : r * cols + (cols - 1 - c);
  }

  /** Splits items into pages of perPage. (duplex-print.js's paginate.) */
  function paginate(items, perPage) {
    perPage = atLeast1(perPage);
    var pages = [];
    for (var i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
  }

  /** duplex-print.js's mirrorPageRows, to the letter: each row reversed, a
      short last row padded with null first. Right for a portrait sheet turned
      on its long edge, and for a stack turned over by hand the same way. */
  function mirrorPageRows(pageItems, cols) {
    cols = atLeast1(cols);
    var mirrored = [];
    for (var i = 0; i < pageItems.length; i += cols) {
      var row = pageItems.slice(i, i + cols);
      while (row.length < cols) row.push(null);
      mirrored = mirrored.concat(row.reverse());
    }
    return mirrored;
  }

  /** One page of fronts in, the page of backs out, for either edge: the
      page is padded with null to cols x rows and every item moved to the cell
      behind its own. */
  function mirrorPage(pageItems, opts) {
    opts = opts || {};
    var cols = atLeast1(opts.cols);
    var rows = Math.max(atLeast1(opts.rows), Math.ceil(pageItems.length / cols));
    var axis = flipAxis(opts.orientation, opts.flip === undefined ? 'long' : opts.flip);
    var out = [];
    for (var i = 0; i < cols * rows; i++) out.push(null);
    for (var j = 0; j < pageItems.length; j++) out[backIndex(j, cols, rows, axis)] = pageItems[j];
    return out;
  }

  // ---- booklet --------------------------------------------------------------

  function slot(page, total, rotate) { return { page: page >= 1 && page <= total ? page : null, rotate: rotate }; }

  /** Saddle-stitch imposition. Sheets are listed outermost first within each
      signature, signatures in reading order. */
  function booklet(pageCount, opts) {
    opts = opts || {};
    var n = count(pageCount);
    var total = Math.ceil(n / 4);
    var per = Math.floor(Number(opts.sheetsPerSignature));
    if (!(per >= 1) || per > total) per = total;
    var long = String(opts.flip || '').toLowerCase() === 'long';
    var rtl = !!opts.rtl;
    var sheets = [];
    for (var first = 0, sig = 0; first < total; first += per, sig++) {
      var inSig = Math.min(per, total - first);
      var base = first * 4, P = inSig * 4;
      for (var i = 0; i < inSig; i++) {
        var front = [slot(base + P - 2 * i, n, 0), slot(base + 1 + 2 * i, n, 0)];
        var back = [slot(base + 2 + 2 * i, n, 0), slot(base + P - 1 - 2 * i, n, 0)];
        if (rtl) { front.reverse(); back.reverse(); }
        // Turned on the long edge, a landscape sheet comes over top to
        // bottom: the back is set upside down, which also swaps its halves.
        if (long) { back.reverse(); back[0].rotate = 180; back[1].rotate = 180; }
        sheets.push({ signature: sig, sheet: i, of: inSig, front: front, back: back });
      }
    }
    return {
      pageCount: n, pages: total * 4, blanks: total * 4 - n,
      signatures: total ? Math.ceil(total / per) : 0, sheetsPerSignature: per,
      flip: long ? 'long' : 'short', sheets: sheets
    };
  }

  // ---- N-up -----------------------------------------------------------------

  /** Reading-order N-up. A side is cols x rows slots in row-major cell order.
      `order: 'column'` fills down each column first; `rtl` starts at the
      right. With `duplex` pages run front, back, front; the back is read
      after the sheet is turned, so it is not mirrored (mirrorPage() is for
      card backs, which must sit behind their own fronts). */
  function nUp(pageCount, opts) {
    opts = opts || {};
    var n = count(pageCount);
    var cols = atLeast1(opts.cols), rows = atLeast1(opts.rows);
    var per = cols * rows;
    var column = String(opts.order || '').toLowerCase() === 'column';
    var rtl = !!opts.rtl, duplex = !!opts.duplex;
    function side(start) {
      var s = [];
      for (var cell = 0; cell < per; cell++) {
        var r = Math.floor(cell / cols), c = cell % cols;
        if (rtl) c = cols - 1 - c;
        s.push(slot(start + (column ? c * rows + r : r * cols + c) + 1, n, 0));
      }
      return s;
    }
    var sides = Math.ceil(n / per), sheets = [];
    for (var i = 0; i < sides; i += duplex ? 2 : 1) {
      var sheet = { sheet: sheets.length, front: side(i * per) };
      if (duplex) sheet.back = side((i + 1) * per);
      sheets.push(sheet);
    }
    return {
      pageCount: n, perSide: per, cols: cols, rows: rows, sides: sheets.length * (duplex ? 2 : 1),
      blanks: sheets.length * (duplex ? 2 : 1) * per - n, duplex: duplex, sheets: sheets
    };
  }

  /** Sheets of paper a job takes. */
  function sheetCount(pageCount, opts) {
    opts = opts || {};
    var n = count(pageCount);
    if (opts.kind === 'booklet') return Math.ceil(n / 4);
    var per = opts.kind === 'nup' ? atLeast1(opts.cols) * atLeast1(opts.rows) : 1;
    return Math.ceil(Math.ceil(n / per) / (opts.duplex ? 2 : 1));
  }

  /** The order the sides come out of the printer. 'interleaved' is front,
      back, front, back, for a duplex unit. 'fronts-first' is every front and
      then every back, for a stack put back in the tray by hand;
      `reverseBacks` is for the printer that hands the stack back in reverse. */
  function sides(sheets, opts) {
    opts = opts || {};
    var out = [], i;
    function push(i, face) { if (sheets[i][face]) out.push({ index: i, face: face, slots: sheets[i][face] }); }
    if (String(opts.stack || '') === 'fronts-first') {
      for (i = 0; i < sheets.length; i++) push(i, 'front');
      if (opts.reverseBacks) for (i = sheets.length - 1; i >= 0; i--) push(i, 'back');
      else for (i = 0; i < sheets.length; i++) push(i, 'back');
    } else {
      for (i = 0; i < sheets.length; i++) { push(i, 'front'); push(i, 'back'); }
    }
    return out;
  }

  // ---- geometry -------------------------------------------------------------

  function box4(m) {
    if (m && typeof m === 'object') return { top: toPt(m.top), right: toPt(m.right), bottom: toPt(m.bottom), left: toPt(m.left) };
    var v = Math.max(0, toPt(m));
    return { top: v, right: v, bottom: v, left: v };
  }

  /* A billionth of a point. Margins and gutters that are tenths of an inch
     leave a cell 179.99999999999997 pt wide and a card at 215.99999999999997,
     and a rasteriser at 96 to the inch puts that card a pixel left of the one
     at 216. Nothing a printer can show, and not worth a file that differs. */
  function tidy(v) { return Math.round(v * 1e9) / 1e9; }

  /** One side's geometry. `sheet` and `page` are { w, h } in points; `margin`
      is one length or { top, right, bottom, left }; `gutter` one length or
      { x, y }. `fit` is 'contain' (the default: scale the page to the cell,
      keep its shape), 'none' (actual size) or 'fill' (stretch). `align` is
      'center' or 'spine', which pushes the pages of a two-column side
      together at the fold. Returns { cells, slots }, both row-major;
      a slot is { x, y, w, h, scale, scaleY }. */
  function layout(opts) {
    opts = opts || {};
    var sheet = opts.sheet || PAPERS.letter;
    var cols = atLeast1(opts.cols), rows = atLeast1(opts.rows);
    var m = box4(opts.margin);
    var g = opts.gutter && typeof opts.gutter === 'object' ? { x: Math.max(0, toPt(opts.gutter.x)), y: Math.max(0, toPt(opts.gutter.y)) }
      : { x: Math.max(0, toPt(opts.gutter)), y: Math.max(0, toPt(opts.gutter)) };
    var cw = tidy(Math.max(0, (sheet.w - m.left - m.right - g.x * (cols - 1)) / cols));
    var ch = tidy(Math.max(0, (sheet.h - m.top - m.bottom - g.y * (rows - 1)) / rows));
    var page = opts.page && opts.page.w > 0 && opts.page.h > 0 ? opts.page : { w: cw, h: ch };
    var fit = String(opts.fit || 'contain').toLowerCase();
    var spine = String(opts.align || '').toLowerCase() === 'spine' && cols === 2;
    var cells = [], slots = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = tidy(m.left + c * (cw + g.x)), y = tidy(m.top + r * (ch + g.y));
        cells.push({ x: x, y: y, w: cw, h: ch });
        var sx = page.w > 0 ? tidy(cw / page.w) : 1, sy = page.h > 0 ? tidy(ch / page.h) : 1;
        if (fit === 'none') { sx = 1; sy = 1; }
        else if (fit !== 'fill') { sx = sy = Math.min(sx, sy); }
        var w = page.w * sx, h = page.h * sy;
        var px = x + (cw - w) / 2;
        if (spine) px = c === 0 ? x + cw - w : x;
        slots.push({ x: tidy(px), y: tidy(y + (ch - h) / 2), w: tidy(w), h: tidy(h), scale: sx, scaleY: sy });
      }
    }
    return { sheet: { w: sheet.w, h: sheet.h }, cols: cols, rows: rows, cells: cells, slots: slots };
  }

  /** How far the pages of booklet sheet `sheet` (0 is the outermost of `of`)
      move toward the spine. Each sheet wrapped round the inner ones pushes
      them out at the fore-edge by one thickness of paper, and the trim takes
      that off; `thickness` is one sheet's, in points (20 lb bond is about
      0.29). The linear model, which is the usual one. */
  function creep(sheet, of, thickness) {
    var i = Math.min(Math.max(0, Math.floor(Number(sheet)) || 0), Math.max(0, atLeast1(of) - 1));
    return i * Math.max(0, toPt(thickness));
  }

  /** Trim marks round a grid: a short line in the margin at every cell edge,
      top, bottom and both sides. `length` and `offset` (the gap between a
      mark and the grid) are points. A mark that has no room in the margin is
      shortened, and left out when nothing of it is left. */
  function cutMarks(lay, opts) {
    opts = opts || {};
    var len = toPt(opts.length === undefined ? 9 : opts.length), off = toPt(opts.offset === undefined ? 4.5 : opts.offset);
    var xs = [], ys = [], i, c, marks = [];
    function add(list, v) { for (var k = 0; k < list.length; k++) if (Math.abs(list[k] - v) < 0.01) return; list.push(v); }
    for (i = 0; i < lay.cells.length; i++) {
      c = lay.cells[i];
      add(xs, c.x); add(xs, c.x + c.w); add(ys, c.y); add(ys, c.y + c.h);
    }
    if (!xs.length) return marks;
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    function seg(xa, ya, xb, yb) {
      xa = Math.max(0, Math.min(lay.sheet.w, xa)); xb = Math.max(0, Math.min(lay.sheet.w, xb));
      ya = Math.max(0, Math.min(lay.sheet.h, ya)); yb = Math.max(0, Math.min(lay.sheet.h, yb));
      if (Math.abs(xa - xb) + Math.abs(ya - yb) > 0.01) marks.push({ x1: xa, y1: ya, x2: xb, y2: yb });
    }
    xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
    for (i = 0; i < xs.length; i++) {
      seg(xs[i], y0 - off - len, xs[i], y0 - off);
      seg(xs[i], y1 + off, xs[i], y1 + off + len);
    }
    for (i = 0; i < ys.length; i++) {
      seg(x0 - off - len, ys[i], x0 - off, ys[i]);
      seg(x1 + off, ys[i], x1 + off + len, ys[i]);
    }
    return marks;
  }

  /** The PDF matrix [a, b, c, d, e, f] that carries a source page, drawn at
      the top left of a sheet `sheetH` points tall, into `slot`, upright or
      turned 180 degrees. jsPDF has already turned its y-down coordinates into
      the PDF's y-up ones by the time a matrix applies, which is why sheetH is
      in it. */
  function matrix(slot, sheetH, rotate) {
    var sx = slot.scale, sy = slot.scaleY === undefined ? slot.scale : slot.scaleY;
    if (rotate === 180) return [-sx, 0, 0, -sy, slot.x + slot.w, sheetH * (1 + sy) - slot.y - slot.h];
    return [sx, 0, 0, sy, slot.x, sheetH * (1 - sy) - slot.y];
  }

  // ---- flow pagination ------------------------------------------------------

  function block(b) {
    if (typeof b === 'number') return { h: Math.max(0, b) };
    b = b || {};
    return { h: nonNeg(b.h), split: !!b.split, keepWithNext: !!b.keepWithNext, breakBefore: !!b.breakBefore };
  }

  /** Blocks of known height onto pages. A block is a height, or
      { h, split, keepWithNext, breakBefore }: `split` lets it be cut across
      pages (a long table, running text), otherwise it stays whole.
      Returns pages; a page is a list of { i, y, h, from, to }: block `i`,
      placed at `y`, showing the part of it from `from` to `to`. A whole block
      has from 0 and to its height. A block that must stay whole and is taller
      than the page is alone on its page with `overflow: true`. */
  function paginateBlocks(blocks, pageHeight, opts) {
    opts = opts || {};
    var H = Math.max(1, nonNeg(pageHeight, 1));
    var firstH = opts.firstPageHeight === undefined ? H : Math.max(1, nonNeg(opts.firstPageHeight, H));
    var gap = nonNeg(opts.gap), minSlice = nonNeg(opts.minSlice);
    var EPS = 1e-6, MIN_TAKE = 0.01;
    var list = [], i;
    for (i = 0; i < (blocks || []).length; i++) list.push(block(blocks[i]));
    var pages = [[]], y = 0;
    function cur() { return pages[pages.length - 1]; }
    function height() { return pages.length === 1 ? firstH : H; }
    function room() { return height() - y - (cur().length ? gap : 0); }
    function newPage() { pages.push([]); y = 0; }
    function put(idx, h, from, to, overflow) {
      var top = y + (cur().length ? gap : 0);
      var item = { i: idx, y: top, h: h, from: from, to: to };
      if (overflow) item.overflow = true;
      cur().push(item);
      y = top + h;
    }
    /* The height a run starting at `idx` needs to stay together: the block,
       and, while each says keepWithNext, the one after it (the first slice of
       it when it may be cut). */
    function runHeight(idx) {
      var total = 0, k = idx;
      for (;;) {
        var b = list[k];
        var last = !b.keepWithNext || k + 1 >= list.length;
        total += b.split && last ? Math.min(b.h, Math.max(minSlice, MIN_TAKE)) : b.h;
        if (last) return total;
        total += gap; k++;
      }
    }
    for (i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.breakBefore && cur().length) newPage();
      // A run that fits on a page of its own, and not in what is left of
      // this one, starts the next. One that fits nowhere is placed as it comes.
      if (cur().length && b.keepWithNext && runHeight(i) > room() + EPS && runHeight(i) <= H + EPS) newPage();
      if (!b.split || b.h <= EPS) {
        if (cur().length && b.h > room() + EPS) newPage();
        put(i, b.h, 0, b.h, b.h > height() + EPS);
        continue;
      }
      var done = 0;
      while (b.h - done > EPS) {
        var left = b.h - done, space = room();
        if (left <= space + EPS) { put(i, left, done, b.h); done = b.h; break; }
        // Too little room left on a page that already has something: the
        // slice starts the next page.
        if (cur().length && space < Math.max(minSlice, MIN_TAKE) - EPS) { newPage(); continue; }
        var take = Math.max(space, MIN_TAKE);
        // Do not leave less than minSlice for the last page when this slice
        // can give some of its own up.
        if (left - take < minSlice - EPS && left - minSlice >= minSlice - EPS) take = left - minSlice;
        put(i, take, done, done + take);
        done += take;
        newPage();
      }
    }
    if (pages.length > 1 && !cur().length) pages.pop();
    if (pages.length === 1 && !pages[0].length) return [];
    return pages;
  }

  // ---- the PDF --------------------------------------------------------------

  /** Everything toPdf() draws, as data. opts:
        paper, orientation   the sheet (PAPERS; letter portrait by default)
        margin, gutter       of the sheet, any toPt() length
        pageSize             { w, h } of a source page, points or lengths.
                             Default: the sheet for 1-up, half of it for a
                             booklet, the cell for N-up.
        impose               nothing for 1-up, or
                             { kind: 'booklet', sheetsPerSignature, flip, rtl, creep }
                             { kind: 'nup', cols, rows, order, rtl, duplex }
        stack, reverseBacks  the order of the sides; see sides()
        cutMarks             true, or { length, offset }
      A booklet's sheet is always landscape, whatever `orientation` says.
      Returns { kind, sheet, sheets, sides }; a side is
      { sheet, face, w, h, slots, marks } and a slot adds x, y, w, h, scale
      and matrix to the imposition's { page, rotate }. */
  function pdfPlan(pageCount, opts) {
    opts = opts || {};
    var imp = opts.impose || {};
    var kind = imp.kind === 'booklet' || imp.kind === 'nup' ? imp.kind : 'single';
    var sheet = paper({ paper: opts.paper, orientation: kind === 'booklet' ? 'landscape' : opts.orientation });
    var src = opts.pageSize ? { w: toPt(opts.pageSize.w), h: toPt(opts.pageSize.h) } : null;
    var imposed, cols = 1, rows = 1;
    if (kind === 'booklet') { imposed = booklet(pageCount, imp); cols = 2; }
    else if (kind === 'nup') { imposed = nUp(pageCount, imp); cols = imposed.cols; rows = imposed.rows; }
    else imposed = nUp(pageCount, { cols: 1, rows: 1, duplex: false });
    var base = layout({
      sheet: sheet, cols: cols, rows: rows, margin: opts.margin, page: src,
      gutter: kind === 'booklet' ? { x: 0, y: 0 } : opts.gutter,
      fit: opts.fit, align: kind === 'booklet' ? 'spine' : 'center'
    });
    var marks = opts.cutMarks ? cutMarks(base, opts.cutMarks === true ? {} : opts.cutMarks) : [];
    var ordered = sides(imposed.sheets, opts);
    var out = [];
    for (var i = 0; i < ordered.length; i++) {
      var s = ordered[i], sh = imposed.sheets[s.index];
      var shift = kind === 'booklet' ? creep(sh.sheet, sh.of, imp.creep) : 0;
      var slots = [];
      for (var k = 0; k < s.slots.length; k++) {
        var g = base.slots[k], x = g.x;
        if (shift) x += k === 0 ? shift : -shift;
        var placed = { page: s.slots[k].page, rotate: s.slots[k].rotate, x: x, y: g.y, w: g.w, h: g.h, scale: g.scale, scaleY: g.scaleY };
        placed.matrix = matrix(placed, sheet.h, placed.rotate);
        slots.push(placed);
      }
      out.push({ sheet: s.index, face: s.face, w: sheet.w, h: sheet.h, slots: slots, marks: marks });
    }
    var one = base.slots[0];
    return {
      kind: kind, sheet: sheet, sheets: imposed.sheets.length, blanks: imposed.blanks,
      page: { w: one.w / one.scale, h: one.h / one.scaleY }, sides: out
    };
  }

  function drawSource(doc, source, size, n) {
    if (typeof source === 'function') { source(doc, { w: size.w, h: size.h, page: n }); return; }
    if (source && typeof source === 'object' && typeof source.draw === 'function') { source.draw(doc, { w: size.w, h: size.h, page: n }); return; }
    var img = source && typeof source === 'object' && source.image ? source.image : source;
    var type = typeof img === 'string' && /^data:image\/png/i.test(img) ? 'PNG'
      : typeof img === 'string' ? 'JPEG'
      : (source && source.type) || 'PNG';
    doc.addImage(img, type, 0, 0, size.w, size.h, undefined, 'FAST');
  }

  /** Draws `pages` into a PDF as pdfPlan() lays them out. opts are pdfPlan's,
      plus `filename` (saves the file when given), `title`, and `jsPDF` (the
      constructor, when the page has it somewhere other than window.jspdf).
      Synchronous: an <img> must have loaded before it is handed in.
      Returns { doc, plan }. Throws if jsPDF is not on the page. */
  function toPdf(pages, opts) {
    opts = opts || {};
    pages = pages || [];
    var JsPDF = opts.jsPDF || (global.jspdf && global.jspdf.jsPDF);
    if (!JsPDF) throw new Error('ExportKit.toPdf: jsPDF is not loaded (_shared/vendor/jspdf/jspdf.umd.min.js)');
    var plan = pdfPlan(pages.length, opts);
    var sheet = plan.sheet;
    var doc = new JsPDF({ unit: 'pt', format: [sheet.w, sheet.h], orientation: sheet.w > sheet.h ? 'landscape' : 'portrait' });
    if (opts.title && doc.setProperties) doc.setProperties({ title: String(opts.title) });
    for (var i = 0; i < plan.sides.length; i++) {
      var side = plan.sides[i];
      if (i > 0) doc.addPage([sheet.w, sheet.h], sheet.w > sheet.h ? 'landscape' : 'portrait');
      for (var k = 0; k < side.slots.length; k++) {
        var s = side.slots[k];
        if (s.page === null) continue;
        var m = s.matrix;
        doc.saveGraphicsState();
        doc.setCurrentTransformationMatrix(new doc.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]));
        drawSource(doc, pages[s.page - 1], plan.page, s.page);
        doc.restoreGraphicsState();
      }
      if (side.marks.length) {
        doc.setDrawColor(0); doc.setLineWidth(0.25);
        for (var j = 0; j < side.marks.length; j++) doc.line(side.marks[j].x1, side.marks[j].y1, side.marks[j].x2, side.marks[j].y2);
      }
    }
    if (opts.filename) doc.save(String(opts.filename));
    return { doc: doc, plan: plan };
  }

  // ---- files -----------------------------------------------------------------

  var MIME = {
    csv: 'text/csv;charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip'
  };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDate(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
  function isRecord(v) { return !!v && typeof v === 'object' && !Array.isArray(v) && !isDate(v); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** A date as text, in local time: 2026-10-05, with 14:30:00 after it when
      it has a time of day. A date that is not one is ''. */
  function dateText(d) {
    if (isNaN(d.getTime())) return '';
    var day = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    if (!d.getHours() && !d.getMinutes() && !d.getSeconds()) return day;
    return day + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  /** Rows and `columns` as one grid of raw values, header row first when
      there is one. A column is a key, or { key, label }. With no `columns`,
      object rows take every key any of them has, in the order first seen,
      and array rows have no header. An array row is positional. */
  function grid(rows, columns) {
    rows = rows || [];
    var cols = null, i, k;
    if (columns && columns.length) {
      cols = [];
      for (i = 0; i < columns.length; i++) {
        var c = columns[i];
        cols.push(isRecord(c) ? { key: c.key, label: String(c.label === undefined ? c.key : c.label) } : { key: c, label: String(c) });
      }
    } else {
      var seen = {}, keys = [];
      for (i = 0; i < rows.length; i++) {
        if (!isRecord(rows[i])) continue;
        for (k in rows[i]) if (own(rows[i], k) && !own(seen, k)) { seen[k] = true; keys.push({ key: k, label: k }); }
      }
      if (keys.length) cols = keys;
    }
    var out = [];
    if (cols) out.push(cols.map(function (c) { return c.label; }));
    for (i = 0; i < rows.length; i++) {
      var r = rows[i], line = [];
      if (Array.isArray(r)) {
        line = r.slice();
        while (cols && line.length < cols.length) line.push('');
      } else if (isRecord(r)) {
        for (k = 0; cols && k < cols.length; k++) line.push(own(r, cols[k].key) ? r[cols[k].key] : '');
      } else {
        line = [r];
      }
      out.push(line);
    }
    return out;
  }

  /** CSV text. opts:
        columns     the order and the header row; see grid()
        delimiter   ',' by default; ';' and '\t' are the other two in use
        bom         false leaves the byte order mark off
        raw         true writes a string that starts like a formula as it is
      Nothing, null and NaN are empty cells; a Date is dateText(). */
  function toCsv(rows, opts) {
    opts = opts || {};
    var delim = opts.delimiter === undefined || opts.delimiter === null || opts.delimiter === '' ? ',' : String(opts.delimiter);
    var table = grid(rows, opts.columns), out = '';
    function cell(v) {
      var s;
      if (v === null || v === undefined) s = '';
      else if (typeof v === 'number') s = isFinite(v) ? String(v) : '';
      else if (isDate(v)) s = dateText(v);
      else {
        s = String(v);
        if (typeof v === 'string' && !opts.raw && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      }
      return s.indexOf(delim) >= 0 || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    for (var i = 0; i < table.length; i++) out += table[i].map(cell).join(delim) + '\r\n';
    return (opts.bom === false ? '' : '\uFEFF') + out;
  }

  /** A name a file can have on Windows, macOS, ChromeOS and Linux alike: no
      \ / : * ? " < > | or control characters, no dot or space at either end,
      at most 80 characters, and never empty ('export'). `ext` is added with
      its dot. */
  function filename(title, ext) {
    var s = String(title === null || title === undefined ? '' : title)
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[. ]+|[. ]+$/g, '');
    if (s.length > 80) s = s.slice(0, 80).replace(/[. ]+$/, '');
    if (!s) s = 'export';
    var e = String(ext === null || ext === undefined ? '' : ext).replace(/[^A-Za-z0-9]+/g, '');
    return e ? s + '.' + e : s;
  }

  /** Hands `data` to the browser as a file named `name`: a string, a Blob,
      an ArrayBuffer or a typed array. `mime` is the type of what is not a
      Blob already, and re-types a Blob that has another. Returns the Blob
      that was saved. */
  function download(data, name, mime) {
    var doc = global.document;
    if (!doc || !global.Blob || !global.URL || !global.URL.createObjectURL) throw new Error('ExportKit.download: this is not a page that can save a file');
    var isBlob = data instanceof global.Blob;
    var blob = isBlob && (!mime || data.type === mime) ? data
      : new global.Blob([data === null || data === undefined ? '' : data], { type: mime || (isBlob && data.type) || 'application/octet-stream' });
    var url = global.URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = String(name === null || name === undefined || name === '' ? 'download' : name);
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
    return blob;
  }

  /** Excel's rules for a sheet name: none of [ ] : * ? / \, no apostrophe at
      either end, 31 characters, not empty, and no two alike (case-blind). */
  function sheetName(name, index, taken) {
    var s = String(name === null || name === undefined ? '' : name).replace(/[\[\]:*?\/\\]/g, '').replace(/\s+/g, ' ').replace(/^[' ]+|[' ]+$/g, '');
    if (!s) s = 'Sheet' + (index + 1);
    s = s.slice(0, 31).replace(/[' ]+$/, '');
    var base = s, n = 2;
    while (own(taken, s.toLowerCase())) {
      var tail = ' (' + n++ + ')';
      s = base.slice(0, 31 - tail.length).replace(/[' ]+$/, '') + tail;
    }
    taken[s.toLowerCase()] = true;
    return s;
  }

  /** A workbook as a Blob. `sheets` is one sheet's rows, or
      [{ name, rows, columns }]; rows and columns are toCsv()'s. A string is
      a string cell whatever it starts with, a finite number a number, a
      boolean a boolean, and a Date a date cell showing dateText()'s form in
      local time. No cell is ever a formula. opts: `filename` saves the file
      too; `XLSX` is the library, when the page has it somewhere other than
      window.XLSX. Throws if SheetJS is not on the page. */
  function toXlsx(sheets, opts) {
    opts = opts || {};
    var X = opts.XLSX || global.XLSX;
    if (!X || !X.utils || !X.write) throw new Error('ExportKit.toXlsx: SheetJS is not loaded (_shared/vendor/xlsx/xlsx.full.min.js)');
    var list;
    if (isRecord(sheets)) list = [sheets];
    else {
      list = sheets || [];
      var named = list.length > 0;
      for (var q = 0; q < list.length; q++) if (!isRecord(list[q]) || !Array.isArray(list[q].rows)) named = false;
      if (!named) list = [{ rows: list }];
    }
    var wb = X.utils.book_new(), taken = {};
    for (var i = 0; i < list.length; i++) {
      var table = grid(list[i].rows, list[i].columns), ws = {}, width = 0;
      for (var r = 0; r < table.length; r++) {
        width = Math.max(width, table[r].length);
        for (var c = 0; c < table[r].length; c++) {
          var v = table[r][c], cell = null;
          if (v === null || v === undefined || v === '') continue;
          if (typeof v === 'number') cell = isFinite(v) ? { t: 'n', v: v } : null;
          else if (typeof v === 'boolean') cell = { t: 'b', v: v };
          else if (isDate(v)) {
            if (!isNaN(v.getTime())) {
              var time = v.getHours() || v.getMinutes() || v.getSeconds();
              // The serial of the local wall-clock time; 25569 is 1970-01-01.
              var serial = Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()) / 86400000 + 25569;
              cell = { t: 'n', v: serial, z: time ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd' };
            }
          } else cell = { t: 's', v: String(v) };
          if (cell) ws[X.utils.encode_cell({ r: r, c: c })] = cell;
        }
      }
      ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, table.length - 1), c: Math.max(0, width - 1) } });
      X.utils.book_append_sheet(wb, ws, sheetName(list[i].name, i, taken));
    }
    var bytes = X.write(wb, { bookType: 'xlsx', type: 'array', compression: true, bookSST: true });
    var blob = new global.Blob([bytes], { type: MIME.xlsx });
    if (opts.filename) download(blob, String(opts.filename));
    return blob;
  }

  /** A name inside a zip: one flat list, so a path separator becomes a
      hyphen, and a name already used (case-blind) gets " (2)" before its
      extension. */
  function entryName(name, index, taken) {
    var s = String(name === null || name === undefined ? '' : name)
      .replace(/[\\/]+/g, '-').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/^[-. ]+|[. ]+$/g, '');
    if (!s) s = 'file' + (index + 1);
    var dot = s.lastIndexOf('.');
    var stem = dot > 0 ? s.slice(0, dot) : s, ext = dot > 0 ? s.slice(dot) : '';
    for (var n = 2; own(taken, s.toLowerCase()); n++) s = stem + ' (' + n + ')' + ext;
    taken[s.toLowerCase()] = true;
    return s;
  }

  /** A zip as a promise of a Blob. `files` is [{ name, data }]: a string
      (stored as UTF-8), a Blob, an ArrayBuffer, a typed array, or a canvas
      (stored as a PNG). opts: `filename` saves the file too; `JSZip` is the
      library, when the page has it somewhere other than window.JSZip.
      Throws if JSZip is not on the page. */
  function toZip(files, opts) {
    opts = opts || {};
    var Z = opts.JSZip || global.JSZip;
    if (!Z) throw new Error('ExportKit.toZip: JSZip is not loaded (_shared/vendor/jszip/jszip.min.js)');
    var zip = new Z(), taken = {};
    files = files || [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i] || {}, data = f.data, name = entryName(f.name, i, taken);
      if (data && typeof data.toDataURL === 'function') zip.file(name, data.toDataURL('image/png').split(',')[1], { base64: true });
      else if (typeof data === 'string') zip.file(name, data);
      else zip.file(name, data === null || data === undefined ? '' : data, { binary: true });
    }
    return zip.generateAsync({ type: 'blob', mimeType: MIME.zip, compression: 'DEFLATE' }).then(function (blob) {
      if (opts.filename) download(blob, String(opts.filename));
      return blob;
    });
  }

  global.ExportKit = {
    PAPERS: PAPERS,
    toPt: toPt,
    paper: paper,
    flipAxis: flipAxis,
    backIndex: backIndex,
    paginate: paginate,
    mirrorPageRows: mirrorPageRows,
    mirrorPage: mirrorPage,
    booklet: booklet,
    nUp: nUp,
    sheetCount: sheetCount,
    sides: sides,
    layout: layout,
    creep: creep,
    cutMarks: cutMarks,
    matrix: matrix,
    paginateBlocks: paginateBlocks,
    pdfPlan: pdfPlan,
    toPdf: toPdf,
    MIME: MIME,
    toCsv: toCsv,
    toXlsx: toXlsx,
    toZip: toZip,
    download: download,
    filename: filename
  };
})(window);
