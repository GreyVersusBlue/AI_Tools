/* export.js — the shared export layer (Path 7 P4). First increment: the
   imposition and pagination math, and toPdf() for pages a tool can already
   draw. BACKLOG.md's Path 7 P4 bullet has the whole surface and what is left.

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
    var cw = Math.max(0, (sheet.w - m.left - m.right - g.x * (cols - 1)) / cols);
    var ch = Math.max(0, (sheet.h - m.top - m.bottom - g.y * (rows - 1)) / rows);
    var page = opts.page && opts.page.w > 0 && opts.page.h > 0 ? opts.page : { w: cw, h: ch };
    var fit = String(opts.fit || 'contain').toLowerCase();
    var spine = String(opts.align || '').toLowerCase() === 'spine' && cols === 2;
    var cells = [], slots = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = m.left + c * (cw + g.x), y = m.top + r * (ch + g.y);
        cells.push({ x: x, y: y, w: cw, h: ch });
        var sx = page.w > 0 ? cw / page.w : 1, sy = page.h > 0 ? ch / page.h : 1;
        if (fit === 'none') { sx = 1; sy = 1; }
        else if (fit !== 'fill') { sx = sy = Math.min(sx, sy); }
        var w = page.w * sx, h = page.h * sy;
        var px = x + (cw - w) / 2;
        if (spine) px = c === 0 ? x + cw - w : x;
        slots.push({ x: px, y: y + (ch - h) / 2, w: w, h: h, scale: sx, scaleY: sy });
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
    toPdf: toPdf
  };
})(window);
