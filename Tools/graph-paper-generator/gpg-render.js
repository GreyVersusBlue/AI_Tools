/* Graph Paper & Number Line Generator — SVG rendering math.
   Pure functions, no DOM — every coordinate is in inches (the SVG root's
   width/height are set in "in" and the viewBox uses the same numbers, so
   1 SVG user unit = 1 inch and printing at 100% scale comes out true-size).
   Kept dependency-free so it can be unit-tested directly in Node. */
(function (global) {
  'use strict';

  var MARGIN = 0.35;
  var THIN = 0.008;
  var BOLD = 0.022;
  var INK_COLOR = '#1a1a1a';
  var FADE_COLOR = '#a8a8a8'; // ink-saving mode: lighter gridlines, pencil work still stands out
  // Worksheet-mode answer key: the plotted line/curve is the answer itself,
  // so it's drawn with an explicit color (not currentColor) rather than
  // through the faded/ink-saving <g> — like the header, it stays full
  // strength and visually distinct even when "lighter gridlines" is on.
  var PLOT_COLOR = '#c43a2f';
  var PLOT_WIDTH = 0.032;

  function pageSize(orientation) {
    return orientation === 'landscape' ? { w: 11, h: 8.5 } : { w: 8.5, h: 11 };
  }

  // Root color is the default ink; a nested <g color="..."> can override it
  // for a faded/ink-saving region without touching every element's own
  // attribute — lineEl/dotEl/textEl below all paint with currentColor.
  function svgWrap(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + 'in" height="' + h + 'in" ' +
      'viewBox="0 0 ' + w + ' ' + h + '" font-family="Consolas, monospace" color="' + INK_COLOR + '">' + inner + '</svg>';
  }

  function gridGroup(color, inner) {
    return '<g color="' + color + '">' + inner + '</g>';
  }

  function lineEl(x1, y1, x2, y2, strokeWidth) {
    return '<line x1="' + x1.toFixed(4) + '" y1="' + y1.toFixed(4) + '" x2="' + x2.toFixed(4) +
      '" y2="' + y2.toFixed(4) + '" stroke="currentColor" stroke-width="' + strokeWidth + '"/>';
  }

  function textEl(x, y, label, anchor, size) {
    return '<text x="' + x.toFixed(4) + '" y="' + y.toFixed(4) + '" font-size="' + (size || 0.14) +
      '" text-anchor="' + (anchor || 'middle') + '" fill="currentColor">' + label + '</text>';
  }

  function formatNum(v) {
    var r = Math.round(v * 1000) / 1000;
    return String(r);
  }

  function dotEl(x, y, r) {
    return '<circle cx="' + x.toFixed(4) + '" cy="' + y.toFixed(4) + '" r="' + r + '" fill="currentColor"/>';
  }

  // Samples plotFn(x) across [xMin, xMax], keeping only the runs of points
  // whose y actually falls inside [yMin, yMax] (a run breaks — and a fresh
  // one starts — at a non-finite value, a division-by-zero null, or a point
  // that plots off the visible plane, e.g. a steep line or a parabola arm
  // running past the top of a small grid). Each surviving run of 2+ points
  // becomes one <polyline>, drawn in PLOT_COLOR so it reads as the answer,
  // not another gridline.
  function plotExprSvg(plotFn, xMin, xMax, yMin, yMax, toSvgX, toSvgY, steps) {
    steps = steps || 240;
    var runs = [];
    var current = null;
    for (var s = 0; s <= steps; s++) {
      var xv = xMin + (xMax - xMin) * s / steps;
      var yv;
      try { yv = plotFn(xv); } catch (e) { yv = null; }
      var valid = typeof yv === 'number' && isFinite(yv) && yv >= yMin - 1e-9 && yv <= yMax + 1e-9;
      if (valid) {
        var pt = [toSvgX(xv), toSvgY(yv)];
        if (!current) { current = []; runs.push(current); }
        current.push(pt);
      } else {
        current = null;
      }
    }
    return runs.map(function (run) {
      if (run.length < 2) return '';
      var pts = run.map(function (p) { return p[0].toFixed(4) + ',' + p[1].toFixed(4); }).join(' ');
      return '<polyline points="' + pts + '" fill="none" stroke="' + PLOT_COLOR + '" stroke-width="' +
        PLOT_WIDTH + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('');
  }

  // Same as lineEl but with a dash pattern — used for the handwriting-practice
  // midline, which by convention is dashed so it reads as "guide, not ink".
  function dashedLineEl(x1, y1, x2, y2, strokeWidth) {
    return '<line x1="' + x1.toFixed(4) + '" y1="' + y1.toFixed(4) + '" x2="' + x2.toFixed(4) +
      '" y2="' + y2.toFixed(4) + '" stroke="currentColor" stroke-width="' + strokeWidth + '" stroke-dasharray="0.08 0.06"/>';
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }

  /* ---------- Shared header block: title + Name/Date fill-in line ---------- */
  // opts.header: { title, showName, showDate } | falsy for no header.
  // Always rendered at full ink, outside any faded <g>, so it stays legible
  // even in ink-saving mode — it's what the student's teacher reads first.
  function headerBlockHeight(header) {
    if (!header) return 0;
    if (!header.title && !header.showName && !header.showDate) return 0;
    return 0.55;
  }

  function headerSvg(header, page, height) {
    if (!height) return '';
    var parts = [];
    if (header.title) {
      parts.push(textEl(page.w / 2, MARGIN + 0.24, escapeXml(header.title), 'middle', 0.2));
    }
    var lineBits = [];
    if (header.showName) lineBits.push('Name: _______________________');
    if (header.showDate) lineBits.push('Date: ____________');
    if (lineBits.length) {
      var lineY = header.title ? MARGIN + 0.44 : MARGIN + 0.24;
      parts.push(textEl(MARGIN, lineY, lineBits.join('          '), 'start', 0.13));
    }
    parts.push(lineEl(MARGIN, MARGIN + height - 0.06, page.w - MARGIN, MARGIN + height - 0.06, THIN));
    return parts.join('');
  }

  // Every line in a family sharing one direction sits at a fixed perpendicular
  // distance from the origin; walking the corners of the target rectangle
  // through that projection gives the k-range to cover it, and Liang-Barsky-
  // style t-clipping trims each infinite line down to the segment actually
  // inside the rectangle (needed for the two slanted isometric line families).
  function clippedLinesForAngle(angleDeg, spacing, w, h) {
    var theta = angleDeg * Math.PI / 180;
    var ux = Math.cos(theta), uy = Math.sin(theta);
    var nx = -Math.sin(theta), ny = Math.cos(theta);
    var corners = [[0, 0], [w, 0], [0, h], [w, h]];
    var projs = corners.map(function (c) { return c[0] * nx + c[1] * ny; });
    var dMin = Math.min.apply(null, projs), dMax = Math.max.apply(null, projs);
    var startK = Math.ceil(dMin / spacing), endK = Math.floor(dMax / spacing);
    var lines = [];
    for (var k = startK; k <= endK; k++) {
      var d = k * spacing;
      var px = d * nx, py = d * ny;
      var tMin = -Infinity, tMax = Infinity;
      if (Math.abs(ux) > 1e-9) {
        var t1 = (0 - px) / ux, t2 = (w - px) / ux;
        tMin = Math.max(tMin, Math.min(t1, t2));
        tMax = Math.min(tMax, Math.max(t1, t2));
      } else if (px < -1e-9 || px > w + 1e-9) {
        continue;
      }
      if (Math.abs(uy) > 1e-9) {
        var t3 = (0 - py) / uy, t4 = (h - py) / uy;
        tMin = Math.max(tMin, Math.min(t3, t4));
        tMax = Math.min(tMax, Math.max(t3, t4));
      } else if (py < -1e-9 || py > h + 1e-9) {
        continue;
      }
      if (tMin > tMax) continue;
      lines.push([px + tMin * ux, py + tMin * uy, px + tMax * ux, py + tMax * uy]);
    }
    return lines;
  }

  /* ---------- Graph paper ---------- */
  // opts: { orientation, cellSize (inches, used when mode='fill'),
  //         mode: 'fill' | 'exact', cols, rows (used when mode='exact'),
  //         boldCenter, style: 'square' | 'dot' | 'isometric' (default 'square'),
  //         faded (ink-saving), header: {title,showName,showDate},
  //         labelAxes, labelInterval (square style only) }
  function renderGraphPaper(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var style = opts.style || 'square';
    var wantAxisLabels = style === 'square' && opts.labelAxes;
    var axisReserve = wantAxisLabels ? 0.22 : 0;
    var usableW = page.w - MARGIN * 2 - axisReserve;
    var usableH = page.h - MARGIN * 2 - headerH;
    var cellSize, cols, rows;

    if (opts.mode === 'exact') {
      cols = Math.max(1, Math.round(opts.cols));
      rows = Math.max(1, Math.round(opts.rows));
      cellSize = Math.min(usableW / cols, usableH / rows);
    } else {
      cellSize = Math.max(0.05, opts.cellSize);
      cols = Math.floor(usableW / cellSize);
      rows = Math.floor(usableH / cellSize);
    }

    var gridW = cellSize * cols;
    var gridH = cellSize * rows;
    var offsetX = MARGIN + axisReserve + (usableW - gridW) / 2;
    var offsetY = MARGIN + headerH + (usableH - gridH) / 2;

    var parts = [];

    if (style === 'isometric') {
      // Three line families 60 degrees apart, all at the same perpendicular
      // spacing (a triangle's height), tile the page with equilateral
      // triangles whose side length is cellSize.
      var perpSpacing = cellSize * (Math.sqrt(3) / 2);
      [90, 30, 150].forEach(function (angle) {
        clippedLinesForAngle(angle, perpSpacing, gridW, gridH).forEach(function (seg) {
          parts.push(lineEl(offsetX + seg[0], offsetY + seg[1], offsetX + seg[2], offsetY + seg[3], THIN));
        });
      });
    } else if (style === 'isometricDot') {
      // A dot at every vertex of the same triangular lattice the isometric
      // line grid above draws — alternate rows shifted by half a cell so
      // each dot sits at the meeting point of the three line families.
      var isoSpacing = cellSize * (Math.sqrt(3) / 2);
      var isoRows = Math.floor(gridH / isoSpacing);
      for (var ir = 0; ir <= isoRows; ir++) {
        var isoY = offsetY + ir * isoSpacing;
        var isoXOffset = (ir % 2 === 1) ? cellSize / 2 : 0;
        for (var ix = isoXOffset; ix <= gridW + 1e-6; ix += cellSize) {
          parts.push(dotEl(offsetX + ix, isoY, 0.012));
        }
      }
    } else if (style === 'dot') {
      for (var dc = 0; dc <= cols; dc++) {
        for (var dr = 0; dr <= rows; dr++) {
          parts.push(dotEl(offsetX + dc * cellSize, offsetY + dr * cellSize, 0.012));
        }
      }
    } else {
      var midCol = cols / 2, midRow = rows / 2;
      for (var c = 0; c <= cols; c++) {
        var x = offsetX + c * cellSize;
        var isBold = opts.boldCenter && Math.abs(c - midCol) < 1e-6;
        parts.push(lineEl(x, offsetY, x, offsetY + gridH, isBold ? BOLD : THIN));
      }
      for (var r = 0; r <= rows; r++) {
        var y = offsetY + r * cellSize;
        var isBoldR = opts.boldCenter && Math.abs(r - midRow) < 1e-6;
        parts.push(lineEl(offsetX, y, offsetX + gridW, y, isBoldR ? BOLD : THIN));
      }
    }

    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(gridColor, parts.join(''));

    if (wantAxisLabels) {
      var labelEvery = Math.max(1, Math.round(opts.labelInterval) || 5);
      var axisParts = [];
      for (var lc = 0; lc <= cols; lc++) {
        if (lc % labelEvery !== 0) continue;
        axisParts.push(textEl(offsetX + lc * cellSize, offsetY + gridH + 0.17, String(lc), 'middle', 0.1));
      }
      for (var lr = 0; lr <= rows; lr++) {
        if (lr % labelEvery !== 0) continue;
        // Row 0 at the bottom, increasing upward — matches how a plotted grid reads.
        axisParts.push(textEl(offsetX - 0.12, offsetY + lr * cellSize + 0.035, String(rows - lr), 'end', 0.1));
      }
      svgInner += axisParts.join('');
    }

    return { svg: svgWrap(page.w, page.h, svgInner), cols: cols, rows: rows, cellSize: cellSize };
  }

  /* ---------- Number line ---------- */
  // opts: { orientation, min, max, interval, labelEvery, copies } for identical copies, or
  //       { orientation, rows: [{min,max,interval,labelEvery}, ...] } to give each copy its
  //       own range — the two shapes are mutually exclusive; rows wins if both are present.
  //       Also accepts faded, header (see renderGraphPaper).
  function renderNumberLine(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;

    var rows;
    if (Array.isArray(opts.rows) && opts.rows.length) {
      rows = opts.rows.map(function (r) {
        // Same guard as the uniform path below: a typed 0/negative/non-numeric interval
        // must not survive as a tiny positive one, which would hang the tab on millions of ticks.
        var interval = Math.abs(r.interval) || 1;
        var min = r.min, max = r.max;
        if (!(max > min)) max = min + interval;
        return { min: min, max: max, interval: interval, labelEvery: Math.max(1, Math.round(r.labelEvery) || 1) };
      });
    } else {
      var uInterval = Math.abs(opts.interval) || 1;
      var uMin = opts.min, uMax = opts.max;
      if (!(uMax > uMin)) uMax = uMin + uInterval; // zero/inverted range → one tick, not NaN/Infinity
      var uLabelEvery = Math.max(1, Math.round(opts.labelEvery));
      var copies = Math.max(1, Math.round(opts.copies));
      rows = [];
      for (var c = 0; c < copies; c++) rows.push({ min: uMin, max: uMax, interval: uInterval, labelEvery: uLabelEvery });
    }

    var spacing = usableH / rows.length;
    var parts = [];
    rows.forEach(function (row, i) {
      var yCenter = MARGIN + headerH + spacing * i + spacing / 2;
      var x0 = MARGIN, x1 = MARGIN + usableW;
      var tickCount = Math.min(2000, Math.max(1, Math.round((row.max - row.min) / row.interval)));
      parts.push(lineEl(x0, yCenter, x1, yCenter, BOLD));
      // arrowheads
      parts.push('<path d="M ' + x0.toFixed(4) + ' ' + yCenter.toFixed(4) + ' l 0.12 -0.06 l 0 0.12 z" fill="currentColor"/>');
      parts.push('<path d="M ' + x1.toFixed(4) + ' ' + yCenter.toFixed(4) + ' l -0.12 -0.06 l 0 0.12 z" fill="currentColor"/>');
      for (var t = 0; t <= tickCount; t++) {
        var value = row.min + t * row.interval;
        var x = x0 + ((value - row.min) / (row.max - row.min)) * usableW;
        parts.push(lineEl(x, yCenter - 0.09, x, yCenter + 0.09, THIN * 1.6));
        if (t % row.labelEvery === 0) {
          parts.push(textEl(x, yCenter + 0.28, formatNum(value)));
        }
      }
    });
    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(gridColor, parts.join(''));
    return { svg: svgWrap(page.w, page.h, svgInner), tickCount: rows.length };
  }

  /* ---------- Coordinate plane ---------- */
  // opts: { orientation, quadrants: 'four' | 'first', xMin, xMax, yMin, yMax,
  //         interval, labelEvery, faded, header, copies (1/2/4/6 small multiples
  //         of the same range on one page — the common "four planes on a
  //         worksheet" layout) }
  var PLANE_LAYOUTS = { 1: { cols: 1, rows: 1 }, 2: { cols: 2, rows: 1 }, 4: { cols: 2, rows: 2 }, 6: { cols: 3, rows: 2 } };
  var PLANE_GUTTER = 0.3;

  // Renders one plane into the sub-rectangle (originX, originY, w, h) and
  // returns its SVG fragment (unwrapped — the caller wraps color/grouping).
  function onePlaneSvg(opts, originX, originY, w, h) {
    var xMin = opts.quadrants === 'first' ? 0 : opts.xMin;
    var xMax = opts.xMax;
    var yMin = opts.quadrants === 'first' ? 0 : opts.yMin;
    var yMax = opts.yMax;
    var interval = Math.abs(opts.interval) || 1;
    if (!(xMax > xMin)) xMax = xMin + interval;
    if (!(yMax > yMin)) yMax = yMin + interval;
    var labelEvery = Math.max(1, Math.round(opts.labelEvery));

    var xRange = xMax - xMin, yRange = yMax - yMin;
    var scale = Math.min(w / xRange, h / yRange);
    var gridW = scale * xRange, gridH = scale * yRange;
    var offsetX = originX + (w - gridW) / 2;
    var offsetY = originY + (h - gridH) / 2;

    function toSvgX(v) { return offsetX + (v - xMin) * scale; }
    function toSvgY(v) { return offsetY + (yMax - v) * scale; } // SVG y grows downward

    var xTicks = Math.min(2000, Math.round(xRange / interval));
    var yTicks = Math.min(2000, Math.round(yRange / interval));
    var parts = [];

    for (var i = 0; i <= xTicks; i++) {
      var xv = xMin + i * interval;
      var x = toSvgX(xv);
      var isAxis = Math.abs(xv) < 1e-6;
      parts.push(lineEl(x, offsetY, x, offsetY + gridH, isAxis ? BOLD : THIN));
    }
    for (var j = 0; j <= yTicks; j++) {
      var yv = yMin + j * interval;
      var y = toSvgY(yv);
      var isAxisY = Math.abs(yv) < 1e-6;
      parts.push(lineEl(offsetX, y, offsetX + gridW, y, isAxisY ? BOLD : THIN));
    }

    // axis labels: place along y=0 (x-axis) and x=0 (y-axis) if in range,
    // otherwise along the plane's edge (first-quadrant case: labels sit on
    // the bottom/left border instead of a mid-page axis).
    var xLabelY = (yMin <= 0 && yMax >= 0) ? toSvgY(0) : offsetY + gridH;
    var yLabelX = (xMin <= 0 && xMax >= 0) ? toSvgX(0) : offsetX;
    var labelSize = w < 4 ? 0.1 : 0.14; // shrink labels when several planes share a page

    for (var ix = 0; ix <= xTicks; ix++) {
      if (ix % labelEvery !== 0) continue;
      var xvL = xMin + ix * interval;
      if (Math.abs(xvL) < 1e-6) continue; // skip origin label, drawn once below
      parts.push(textEl(toSvgX(xvL), xLabelY + labelSize * 1.6, formatNum(xvL), 'middle', labelSize));
    }
    for (var iy = 0; iy <= yTicks; iy++) {
      if (iy % labelEvery !== 0) continue;
      var yvL = yMin + iy * interval;
      if (Math.abs(yvL) < 1e-6) continue;
      parts.push(textEl(yLabelX - labelSize, toSvgY(yvL) + labelSize * 0.35, formatNum(yvL), 'end', labelSize));
    }
    if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
      parts.push(textEl(toSvgX(0) - labelSize, toSvgY(0) + labelSize * 1.6, '0', 'end', labelSize));
    }

    // Worksheet-mode answer key: opts.plotFn (x -> y | null), when present,
    // is drawn on top of the grid. Absent for every existing caller
    // (renderCoordinatePlane never sets it), so this is a no-op for them.
    if (typeof opts.plotFn === 'function') {
      parts.push(plotExprSvg(opts.plotFn, xMin, xMax, yMin, yMax, toSvgX, toSvgY));
    }

    return parts.join('');
  }

  function renderCoordinatePlane(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;
    var copies = PLANE_LAYOUTS[opts.copies] ? opts.copies : 1;
    var layout = PLANE_LAYOUTS[copies];

    var cellW = (usableW - (layout.cols - 1) * PLANE_GUTTER) / layout.cols;
    var cellH = (usableH - (layout.rows - 1) * PLANE_GUTTER) / layout.rows;

    var planeParts = [];
    for (var idx = 0; idx < copies; idx++) {
      var col = idx % layout.cols, row = Math.floor(idx / layout.cols);
      var cellX = MARGIN + col * (cellW + PLANE_GUTTER);
      var cellY = MARGIN + headerH + row * (cellH + PLANE_GUTTER);
      planeParts.push(onePlaneSvg(opts, cellX, cellY, cellW, cellH));
    }

    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(gridColor, planeParts.join(''));
    return { svg: svgWrap(page.w, page.h, svgInner), copies: copies };
  }

  /* ---------- Worksheet mode: expression parsing ----------
     Ported from 024-number-talks-board.html's tokenizeExpr / parseExpression /
     parseTerm / parseFactor arithmetic parser (a hand-rolled tokenizer +
     recursive-descent evaluator, no eval()), adapted for a single free
     variable instead of pure arithmetic:
       - 'x' is a variable token here, not — as it is in the number-talks
         bank — a spelled-out multiplication operator. Explicit
         multiplication uses '*' or '×' only.
       - '^' is added (right-associative) so a simple curve — a parabola —
         can be plotted, not just a line.
       - adjacent value-ish tokens with no operator between them ("2x",
         "3(x+1)", "x(x+2)") get an implicit '*' inserted, the way algebra
         is actually handwritten.
     This is a direct copy/adapt for this tool, not a shared extraction —
     024's own doc has an open, unresolved question about whether the
     arithmetic parser belongs in _shared/, and per that row's guidance this
     row does not attempt that extraction. */

  // raw -> token list, or null if raw contains anything this grammar
  // doesn't recognize. An optional leading "y=" / "f(x)=" is stripped
  // before tokenizing (the caller still prints the original text as typed).
  function tokenizeGraphExpr(raw) {
    var str = String(raw == null ? '' : raw).replace(/\s+/g, '');
    str = str.replace(/^y=/i, '').replace(/^f\(x\)=/i, '');
    if (!str) return null;
    if (!/^[\d.x+\-*×÷/^()]+$/i.test(str)) return null;
    var tokens = [];
    var i = 0;
    while (i < str.length) {
      var c = str[i];
      if ((c >= '0' && c <= '9') || c === '.') {
        var j = i;
        while (j < str.length && ((str[j] >= '0' && str[j] <= '9') || str[j] === '.')) j++;
        var numStr = str.slice(i, j);
        if (!/^\d+(\.\d+)?$/.test(numStr)) return null;
        tokens.push({ type: 'num', value: parseFloat(numStr) });
        i = j;
      } else if (c === 'x' || c === 'X') {
        tokens.push({ type: 'var' }); i++;
      } else if (c === '+' || c === '-') {
        tokens.push({ type: 'op', value: c }); i++;
      } else if (c === '*' || c === '×') {
        tokens.push({ type: 'op', value: '*' }); i++;
      } else if (c === '/' || c === '÷') {
        tokens.push({ type: 'op', value: '/' }); i++;
      } else if (c === '^') {
        tokens.push({ type: 'op', value: '^' }); i++;
      } else if (c === '(' || c === ')') {
        tokens.push({ type: c === '(' ? 'lparen' : 'rparen' }); i++;
      } else {
        return null;
      }
    }
    var withImplicit = [];
    for (var k = 0; k < tokens.length; k++) {
      var tok = tokens[k];
      if (k > 0) {
        var prev = tokens[k - 1];
        var prevEndsValue = prev.type === 'num' || prev.type === 'var' || prev.type === 'rparen';
        var curStartsValue = tok.type === 'num' || tok.type === 'var' || tok.type === 'lparen';
        if (prevEndsValue && curStartsValue) withImplicit.push({ type: 'op', value: '*' });
      }
      withImplicit.push(tok);
    }
    return withImplicit;
  }

  // Recursive-descent parse into a small AST (rather than evaluating
  // straight through, as the number-talks version does) because a plotted
  // curve needs the same expression evaluated at ~240 different x values —
  // parse once, evaluate many times.
  // Precedence, loosest to tightest: + - , * / , unary -, ^ (right-assoc).
  function parseGraphExprAst(tokens) {
    var pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseExpression() {
      var node = parseTerm();
      if (node === null) return null;
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        var op = next().value;
        var rhs = parseTerm();
        if (rhs === null) return null;
        node = { type: 'bin', op: op, left: node, right: rhs };
      }
      return node;
    }
    function parseTerm() {
      var node = parseUnary();
      if (node === null) return null;
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        var op = next().value;
        var rhs = parseUnary();
        if (rhs === null) return null;
        node = { type: 'bin', op: op, left: node, right: rhs };
      }
      return node;
    }
    function parseUnary() {
      if (peek() && peek().type === 'op' && peek().value === '-') {
        next();
        var v = parseUnary();
        return v === null ? null : { type: 'neg', arg: v };
      }
      if (peek() && peek().type === 'op' && peek().value === '+') { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      var base = parseFactor();
      if (base === null) return null;
      if (peek() && peek().type === 'op' && peek().value === '^') {
        next();
        var exp = parseUnary(); // right-associative: x^-1, x^2^1, etc.
        if (exp === null) return null;
        return { type: 'bin', op: '^', left: base, right: exp };
      }
      return base;
    }
    function parseFactor() {
      var tok = peek();
      if (!tok) return null;
      if (tok.type === 'lparen') {
        next();
        var v = parseExpression();
        if (v === null) return null;
        var closing = next();
        if (!closing || closing.type !== 'rparen') return null;
        return v;
      }
      if (tok.type === 'num') { next(); return { type: 'num', value: tok.value }; }
      if (tok.type === 'var') { next(); return { type: 'var' }; }
      return null;
    }

    var result = parseExpression();
    if (result === null || pos !== tokens.length) return null;
    return result;
  }

  function evalGraphAst(node, x) {
    switch (node.type) {
      case 'num': return node.value;
      case 'var': return x;
      case 'neg': { var v = evalGraphAst(node.arg, x); return v === null ? null : -v; }
      case 'bin': {
        var l = evalGraphAst(node.left, x), r = evalGraphAst(node.right, x);
        if (l === null || r === null) return null;
        if (node.op === '+') return l + r;
        if (node.op === '-') return l - r;
        if (node.op === '*') return l * r;
        if (node.op === '/') return r === 0 ? null : l / r;
        if (node.op === '^') return Math.pow(l, r);
        return null;
      }
      default: return null;
    }
  }

  // The one entry point worksheet rendering (and the UI) actually needs:
  // raw problem text -> a function x -> y|null, or null if the text isn't
  // a plottable expression at all (an empty box, a word problem, a typo).
  function parseGraphExpression(raw) {
    var tokens = tokenizeGraphExpr(raw);
    if (!tokens || !tokens.length) return null;
    var ast = parseGraphExprAst(tokens);
    if (!ast) return null;
    return function (x) {
      var v = evalGraphAst(ast, x);
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    };
  }

  /* ---------- Worksheet mode: random problem generation ---------- */
  function termStr(coef, varPart, isFirst) {
    if (coef === 0) return '';
    var neg = coef < 0;
    var abs = Math.abs(coef);
    var coefStr = (abs === 1 && varPart) ? '' : String(abs);
    var body = coefStr + varPart;
    if (isFirst) return neg ? '-' + body : body;
    return (neg ? ' - ' : ' + ') + body;
  }

  function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
  function nonZeroRandInt(rng, min, max) {
    var v;
    do { v = randInt(rng, min, max); } while (v === 0);
    return v;
  }

  // type: 'linear' (y = mx + b) or 'quadratic' (y = ax^2 + bx + c).
  // rng defaults to Math.random but is injectable so this stays testable —
  // pass a fixed sequence and the output is deterministic.
  function generateProblem(type, opts, rng) {
    rng = rng || Math.random;
    if (type === 'quadratic') {
      var a = nonZeroRandInt(rng, -2, 2);
      var b = randInt(rng, -4, 4);
      var c = randInt(rng, -6, 6);
      var terms = [termStr(a, 'x^2', true), termStr(b, 'x', false), termStr(c, '', false)].join('');
      return 'y = ' + (terms || '0');
    }
    var m = nonZeroRandInt(rng, -4, 4);
    var b2 = randInt(rng, -8, 8);
    var terms2 = [termStr(m, 'x', true), termStr(b2, '', false)].join('');
    return 'y = ' + (terms2 || '0');
  }

  /* ---------- Worksheet mode: the sheet itself ----------
     opts: { orientation, copies (1/2/4/6, PLANE_LAYOUTS), quadrants,
     xMin, xMax, yMin, yMax, interval, labelEvery — same shape as
     renderCoordinatePlane's plane options, shared by every cell — plus
     problems: [string, ...] (one per plane; padded/truncated to copies),
     showAnswer (plot each problem's line/curve) and faded/header. }
     Reuses onePlaneSvg/PLANE_LAYOUTS exactly as renderCoordinatePlane does;
     the only difference is a caption band reserved above each plane for the
     problem text, and — when showAnswer is on — a parsed plotFn handed to
     that plane's onePlaneSvg call. */
  function renderWorksheet(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;
    var copies = PLANE_LAYOUTS[opts.copies] ? opts.copies : 1;
    var layout = PLANE_LAYOUTS[copies];

    var problems = Array.isArray(opts.problems) ? opts.problems.slice(0, copies) : [];
    while (problems.length < copies) problems.push('');

    var cellW = (usableW - (layout.cols - 1) * PLANE_GUTTER) / layout.cols;
    var cellH = (usableH - (layout.rows - 1) * PLANE_GUTTER) / layout.rows;
    var captionH = Math.min(0.32, cellH * 0.22);
    var planeH = cellH - captionH;
    var captionSize = layout.cols >= 3 ? 0.11 : 0.14;

    var captionParts = [];
    var planeParts = [];
    var plottedCount = 0;
    for (var idx = 0; idx < copies; idx++) {
      var col = idx % layout.cols, row = Math.floor(idx / layout.cols);
      var cellX = MARGIN + col * (cellW + PLANE_GUTTER);
      var cellY = MARGIN + headerH + row * (cellH + PLANE_GUTTER);
      var problemText = problems[idx] || '';

      captionParts.push(textEl(
        cellX + cellW / 2, cellY + captionH * 0.65,
        escapeXml((idx + 1) + ') ' + problemText), 'middle', captionSize));

      var planeOpts = {
        quadrants: opts.quadrants, xMin: opts.xMin, xMax: opts.xMax,
        yMin: opts.yMin, yMax: opts.yMax, interval: opts.interval, labelEvery: opts.labelEvery
      };
      if (opts.showAnswer && problemText) {
        var fn = parseGraphExpression(problemText);
        if (fn) { planeOpts.plotFn = fn; plottedCount++; }
      }
      planeParts.push(onePlaneSvg(planeOpts, cellX, cellY + captionH, cellW, planeH));
    }

    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    // Captions are the problem itself, not a gridline — like the header,
    // they stay full ink outside the faded group even in ink-saving mode,
    // so the question is never the thing that got harder to read.
    var svgInner = headerSvg(opts.header, page, headerH) +
      captionParts.join('') +
      gridGroup(gridColor, planeParts.join(''));
    return { svg: svgWrap(page.w, page.h, svgInner), copies: copies, plottedCount: plottedCount };
  }

  /* ---------- Cornell notes ---------- */
  // opts: { orientation, cueWidth (inches, left cue column), summaryHeight
  //         (inches, bottom summary band), ruleSpacing (inches, note-taking
  //         line spacing), faded, header }.
  // Layout: a left "cues" column and right "notes" column ruled the same,
  // separated by a vertical divider, sitting above a full-width "summary"
  // band separated by a horizontal divider — the standard three-region
  // Cornell page. Section labels are small caption text drawn inside the
  // faded group (same as gridlines) since they're guides, not header content.
  function renderCornellNotes(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;

    var cueWidth = Math.max(0.5, Math.min(usableW - 0.5, opts.cueWidth || 2.5));
    var summaryHeight = Math.max(0.5, Math.min(usableH - 0.5, opts.summaryHeight || 2));
    var ruleSpacing = Math.max(0.15, opts.ruleSpacing || 0.34);

    var top = MARGIN + headerH;
    var left = MARGIN, right = MARGIN + usableW;
    var bottom = top + usableH;
    var noteAreaH = usableH - summaryHeight;
    var summaryTop = top + noteAreaH;
    var cueDividerX = left + cueWidth;

    var parts = [];

    // Ruled note-taking lines across the full width (cue + notes columns share
    // the same rule spacing, so a line drawn in one column lines up with its
    // neighbor), then again across the summary band at the same spacing.
    var noteRuleCount = Math.max(0, Math.floor(noteAreaH / ruleSpacing));
    for (var i = 1; i <= noteRuleCount; i++) {
      var y = top + i * ruleSpacing;
      if (y >= summaryTop - 1e-6) break;
      parts.push(lineEl(left, y, right, y, THIN));
    }
    var summaryRuleCount = Math.max(0, Math.floor(summaryHeight / ruleSpacing));
    for (var j = 1; j <= summaryRuleCount; j++) {
      var ys = summaryTop + j * ruleSpacing;
      if (ys >= bottom - 1e-6) break;
      parts.push(lineEl(left, ys, right, ys, THIN));
    }

    // Section boundaries, bolder than the ruling so the three regions read at a glance.
    parts.push(lineEl(cueDividerX, top, cueDividerX, summaryTop, BOLD));
    parts.push(lineEl(left, summaryTop, right, summaryTop, BOLD));

    // Small caption labels — inside the faded group like everything else here.
    parts.push(textEl(left + 0.06, top + 0.16, 'CUES', 'start', 0.1));
    parts.push(textEl(cueDividerX + 0.08, top + 0.16, 'NOTES', 'start', 0.1));
    parts.push(textEl(left + 0.06, summaryTop + 0.16, 'SUMMARY', 'start', 0.1));

    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(gridColor, parts.join(''));
    return { svg: svgWrap(page.w, page.h, svgInner), cueWidth: cueWidth, summaryHeight: summaryHeight };
  }

  /* ---------- Handwriting practice lines ---------- */
  // opts: { orientation, lineHeight (inches, distance from topline to
  //         baseline), faded, header }.
  // Each repeated unit is the classic three-line set — topline, dashed
  // midline, solid baseline — with a blank gap before the next set so
  // ascenders/descenders from adjacent rows don't collide.
  function renderHandwritingLines(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;

    var lineHeight = Math.max(0.15, opts.lineHeight || 0.5);
    var gap = lineHeight * 0.6;
    var unit = lineHeight + gap;
    // How many complete sets (topline through baseline) fit before the page runs out.
    var sets = usableH >= lineHeight ? Math.floor((usableH - lineHeight) / unit) + 1 : 0;

    var offsetX = MARGIN, offsetY = MARGIN + headerH;
    var parts = [];
    for (var i = 0; i < sets; i++) {
      var topY = offsetY + i * unit;
      var baseY = topY + lineHeight;
      var midY = topY + lineHeight / 2;
      parts.push(lineEl(offsetX, topY, offsetX + usableW, topY, THIN));
      parts.push(dashedLineEl(offsetX, midY, offsetX + usableW, midY, THIN));
      parts.push(lineEl(offsetX, baseY, offsetX + usableW, baseY, BOLD));
    }

    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(gridColor, parts.join(''));
    return { svg: svgWrap(page.w, page.h, svgInner), lineSets: sets, lineHeight: lineHeight };
  }

  /* ── Print calibration page ────────────────────────────────────────────
     Every other page this tool produces is drawn in inches and is only true
     to scale if the printer actually printed at 100%. "Fit to page", a
     driver's default margins, or a school copier's slight reduction all
     silently shrink it — and a 1/4in grid that is really 0.238in ruins any
     measurement task done on it. Nothing in the tool could tell a teacher
     whether their printer does that.

     This page is the check: rulers to hold a real ruler against, and squares
     to measure, drawn with the same inch-based geometry as everything else, so
     if these come out true then so does the graph paper.

     CM_PER_INCH is exact by definition (an inch is defined as 2.54cm), so the
     centimetre ruler is not an approximation of the inch one — both are drawn
     from the same true unit. */
  var CM_PER_INCH = 2.54;

  function calibrationRuler(x, y, lengthIn, unitIn, majorEvery, minorPerUnit, unitLabel, labelEveryUnits) {
    var parts = [];
    var units = Math.floor(lengthIn / unitIn + 1e-9);
    var baselineY = y + 0.5;
    parts.push(lineEl(x, baselineY, x + units * unitIn, baselineY, BOLD));
    for (var i = 0; i <= units * minorPerUnit; i++) {
      var tickX = x + (i / minorPerUnit) * unitIn;
      var isUnit = i % minorPerUnit === 0;
      var isHalf = !isUnit && (i * 2) % minorPerUnit === 0;
      var len = isUnit ? 0.34 : (isHalf ? 0.2 : 0.11);
      parts.push(lineEl(tickX, baselineY - len, tickX, baselineY, isUnit ? BOLD : THIN));
      if (isUnit) {
        var unitIndex = i / minorPerUnit;
        if (unitIndex % labelEveryUnits === 0) {
          parts.push(textEl(tickX, baselineY + 0.2, formatNum(unitIndex), 'middle', 0.13));
        }
      }
    }
    parts.push(textEl(x + units * unitIn + 0.12, baselineY + 0.05, escapeXml(unitLabel), 'start', 0.13));
    return { svg: parts.join(''), width: units * unitIn, units: units };
  }

  function calibrationSquare(x, y, sideIn, label) {
    return '<rect x="' + x.toFixed(4) + '" y="' + y.toFixed(4) + '" width="' + sideIn.toFixed(4) +
        '" height="' + sideIn.toFixed(4) + '" fill="none" stroke="currentColor" stroke-width="' + BOLD + '"/>' +
      // Left-anchored, not centred: a centred caption under the 1in square
      // runs off the left margin, since the square starts at the margin.
      textEl(x, y + sideIn + 0.2, escapeXml(label), 'start', 0.13);
  }

  function renderCalibration(opts) {
    opts = opts || {};
    var page = pageSize(opts.orientation);
    var x = MARGIN + 0.15;
    var parts = [];
    var y = MARGIN + 0.3;

    parts.push(textEl(page.w / 2, y, 'Printer calibration test page', 'middle', 0.26));
    y += 0.34;
    parts.push(textEl(page.w / 2, y, 'Print this at 100% scale — not "Fit to page" or "Shrink to fit".', 'middle', 0.14));
    y += 0.24;
    parts.push(textEl(page.w / 2, y, 'Then hold a real ruler against the two rulers below.', 'middle', 0.14));
    y += 0.55;

    var inchLen = Math.min(6, page.w - MARGIN * 2 - 0.9);
    var inchRuler = calibrationRuler(x, y, inchLen, 1, 1, 8, 'inches', 1);
    parts.push(inchRuler.svg);
    y += 1.15;

    var cmLen = Math.min(15 / CM_PER_INCH, page.w - MARGIN * 2 - 0.9);
    var cmRuler = calibrationRuler(x, y, cmLen, 1 / CM_PER_INCH, 1, 10, 'centimetres', 1);
    parts.push(cmRuler.svg);
    y += 1.3;

    parts.push(calibrationSquare(x, y, 1, 'This square is exactly 1 inch'));
    parts.push(calibrationSquare(x + 2.2, y, 5 / CM_PER_INCH, 'This square is exactly 5 cm'));
    y += Math.max(1, 5 / CM_PER_INCH) + 0.7;

    // The arithmetic a teacher needs when it is NOT true: measure the 6in
    // ruler, and the ratio is what their printer is doing to every page.
    var lines = [
      'If the marks line up: this printer prints true to scale. Every page from this tool',
      'will be the size it says it is.',
      '',
      'If they do not: measure the ' + formatNum(inchRuler.units) + '-inch ruler above with a real',
      'ruler and write what you get here.',
      '',
      'Measured: ________ inches instead of ' + formatNum(inchRuler.units) + '.',
      '',
      'That is what your printer is doing to every page. Look in the print',
      'dialog for "Fit to page", "Shrink oversized pages", or a scale set to',
      'anything but 100%, turn it off, and print this page again.'
    ];
    lines.forEach(function (line) {
      if (line) parts.push(textEl(x, y, escapeXml(line), 'start', 0.15));
      y += 0.24;
    });

    var color = opts.faded ? FADE_COLOR : INK_COLOR;
    var headerH = headerBlockHeight(opts.header);
    var svgInner = headerSvg(opts.header, page, headerH) + gridGroup(color, parts.join(''));
    return {
      svg: svgWrap(page.w, page.h, svgInner),
      inchUnits: inchRuler.units,
      cmUnits: cmRuler.units
    };
  }

  /* ---------- More grid types (AI-31 / BACKLOG 129) ----------
     Everything below is new; nothing above is changed, so a sheet drawn before
     these existed comes out byte for byte the same (golden-old-render.json).
     Positions are computed from whole numbers wherever the maths allows
     (a tick's index over the span, never a running float sum), so a tick for
     5/8 or 0.35 sits exactly where the ratio says. */
  var MID = 0.012;          // a middle weight between THIN and BOLD, never under THIN
  var TICK_W = THIN * 1.6;  // the existing number line's tick weight
  var CHAR_W = 0.6;         // monospace advance as a share of font size

  function clampInt(v, lo, hi, dflt) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) n = dflt;
    return Math.max(lo, Math.min(hi, n));
  }

  function circleEl(cx, cy, r, strokeWidth) {
    return '<circle cx="' + cx.toFixed(4) + '" cy="' + cy.toFixed(4) + '" r="' + r.toFixed(4) +
      '" fill="none" stroke="currentColor" stroke-width="' + strokeWidth + '"/>';
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function arrowedAxis(xA, xB, y) {
    return lineEl(xA, y, xB, y, BOLD) +
      '<path d="M ' + xA.toFixed(4) + ' ' + y.toFixed(4) + ' l 0.12 -0.06 l 0 0.12 z" fill="currentColor"/>' +
      '<path d="M ' + xB.toFixed(4) + ' ' + y.toFixed(4) + ' l -0.12 -0.06 l 0 0.12 z" fill="currentColor"/>';
  }

  function wrapSheet(page, headerH, opts, parts) {
    var gridColor = opts.faded ? FADE_COLOR : INK_COLOR;
    return svgWrap(page.w, page.h, headerSvg(opts.header, page, headerH) + gridGroup(gridColor, parts.join('')));
  }

  /* ---------- Polar graph paper ---------- */
  // Rings at equal radius steps out from the centre, rays at equal angles
  // (12, 16 or 24 of them), the four axes heavier. The outer ring is the last
  // whole step that fits, so the figure is always a complete circle.
  // opts: { orientation, rays: 12|16|24, ringStep (inches), labels, faded, header }
  var POLAR_RAY_CHOICES = [12, 16, 24];

  function polarLayout(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var labels = opts.labels !== false;
    var reserve = labels ? 0.3 : 0.02;
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;
    var radiusMax = Math.min(usableW, usableH) / 2 - reserve;
    var step = Number(opts.ringStep);
    if (!(step >= 0.1)) step = step > 0 ? 0.1 : 0.5;
    if (step > radiusMax) step = radiusMax;
    var rings = Math.max(1, Math.floor(radiusMax / step + 1e-9));
    var radii = [];
    for (var k = 1; k <= rings; k++) radii.push(k * step);
    var rayCount = POLAR_RAY_CHOICES.indexOf(Math.round(opts.rays)) !== -1 ? Math.round(opts.rays) : 12;
    var angles = [];
    for (var i = 0; i < rayCount; i++) angles.push(i * 360 / rayCount);
    return {
      page: page, headerH: headerH, labels: labels,
      cx: MARGIN + usableW / 2, cy: MARGIN + headerH + usableH / 2,
      step: step, radii: radii, outer: rings * step, rays: angles
    };
  }

  function renderPolarPaper(opts) {
    var L = polarLayout(opts);
    var parts = [];
    L.rays.forEach(function (deg) {
      var th = deg * Math.PI / 180;
      var isAxis = deg % 90 === 0;
      parts.push(lineEl(L.cx, L.cy, L.cx + L.outer * Math.cos(th), L.cy - L.outer * Math.sin(th), isAxis ? BOLD : THIN));
    });
    L.radii.forEach(function (r) { parts.push(circleEl(L.cx, L.cy, r, THIN)); });
    if (L.labels) {
      var every = L.radii.length <= 12 ? 1 : 5;
      L.radii.forEach(function (r, i) {
        if ((i + 1) % every !== 0) return;
        parts.push(textEl(L.cx + r - 0.03, L.cy - 0.04, String(i + 1), 'end', 0.09));
      });
      L.rays.forEach(function (deg) {
        var th = deg * Math.PI / 180;
        var rr = L.outer + 0.17;
        parts.push(textEl(L.cx + rr * Math.cos(th), L.cy - rr * Math.sin(th) + 0.035, deg + '°', 'middle', 0.1));
      });
    }
    return { svg: wrapSheet(L.page, L.headerH, opts, parts), cx: L.cx, cy: L.cy, radii: L.radii, rays: L.rays, outer: L.outer, ringStep: L.step };
  }

  /* ---------- Logarithmic and semi-logarithmic paper ---------- */
  // A log axis runs whole decades; inside decade d the lines for 2..9 sit at
  // (d + log10(m)) / decades of the axis length, the decade lines (m = 1)
  // heaviest and the 5 a step lighter. Semi-log keeps the other axis linear;
  // log-log makes both log.
  // opts: { orientation, kind: 'semilog'|'loglog', decades (1..6), startExp,
  //         xDecades, xStartExp (log-log), xDivisions (10|20, semi-log), faded, header }
  function expLabel(e) {
    if (e >= 5 || e <= -5) return '10^' + e;
    if (e >= 0) return '1' + new Array(e + 1).join('0');
    return '0.' + new Array(-e).join('0') + '1';
  }

  // Every line of a log axis as a fraction of its length: [{ frac, exp, m }].
  function logAxisLines(decades, startExp) {
    var out = [];
    for (var d = 0; d < decades; d++) {
      for (var m = 1; m <= 9; m++) out.push({ frac: (d + Math.log(m) / Math.LN10) / decades, exp: startExp + d, m: m });
    }
    out.push({ frac: 1, exp: startExp + decades, m: 1 });
    return out;
  }

  function logLineWidth(m) { return m === 1 ? BOLD : (m === 5 ? MID : THIN); }

  function renderLogPaper(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var kind = opts.kind === 'loglog' ? 'loglog' : 'semilog';
    var yDec = clampInt(opts.decades, 1, 6, 3), yExp = clampInt(opts.startExp, -4, 4, 0);
    var xDec = clampInt(opts.xDecades, 1, 6, 3), xExp = clampInt(opts.xStartExp, -4, 4, 0);
    var xDiv = opts.xDivisions === 20 || opts.xDivisions === '20' ? 20 : 10;
    var x0 = MARGIN + 0.6, x1 = page.w - MARGIN - 0.1;
    var y0 = MARGIN + headerH + 0.1, y1 = page.h - MARGIN - 0.3;
    var w = x1 - x0, h = y1 - y0;
    var parts = [];
    var yLines = logAxisLines(yDec, yExp);
    yLines.forEach(function (ln) {
      var y = y1 - ln.frac * h;
      parts.push(lineEl(x0, y, x1, y, logLineWidth(ln.m)));
      if (ln.m === 1) parts.push(textEl(x0 - 0.07, y + 0.035, expLabel(ln.exp), 'end', 0.1));
    });
    if (kind === 'loglog') {
      logAxisLines(xDec, xExp).forEach(function (ln) {
        var x = x0 + ln.frac * w;
        parts.push(lineEl(x, y0, x, y1, logLineWidth(ln.m)));
        if (ln.m === 1) parts.push(textEl(x, y1 + 0.17, expLabel(ln.exp), 'middle', 0.1));
      });
    } else {
      var labelStep = xDiv === 10 ? 1 : 2;
      for (var i = 0; i <= xDiv; i++) {
        var xv = x0 + (i / xDiv) * w;
        var edge = i === 0 || i === xDiv;
        parts.push(lineEl(xv, y0, xv, y1, edge ? BOLD : (i % 5 === 0 ? MID : THIN)));
        if (i % labelStep === 0) parts.push(textEl(xv, y1 + 0.17, String(i), 'middle', 0.1));
      }
    }
    return {
      svg: wrapSheet(page, headerH, opts, parts), kind: kind,
      plot: { x0: x0, y0: y0, x1: x1, y1: y1 }, decades: yDec, startExp: yExp, xDecades: xDec, xStartExp: xExp, xDivisions: xDiv
    };
  }

  /* ---------- Number-line variants ---------- */
  // One frame for every horizontal variant: `copies` rows down the page, the
  // scale itself inset 0.35in from each end of the arrowed line so the first and
  // last marks and their labels never touch an arrowhead.
  function rowFrame(opts, copies) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2 - headerH;
    var n = clampInt(copies, 1, 10, 1);
    var spacing = usableH / n;
    return {
      page: page, headerH: headerH, copies: n, spacing: spacing,
      xA: MARGIN, xB: MARGIN + usableW, tA: MARGIN + 0.35, tB: MARGIN + usableW - 0.35,
      yc: function (i) { return MARGIN + headerH + spacing * i + spacing / 2; }
    };
  }

  // The smallest divisor of n that is at least `want`: labels then land on
  // whole numbers, because a whole number is a multiple of n ticks.
  function labelEveryFor(user, n, need) {
    var want = Math.max(1, clampInt(user, 1, 100000, 1), need);
    for (var v = want; v <= n; v++) if (n % v === 0) return v;
    return n;
  }

  // k/d as a label: { neg, whole, num, den }. Mixed: |k|/d = whole + num/den;
  // improper: whole is 0 and num/den is the whole fraction. A multiple of d is a
  // plain whole number (num 0). reduce divides num and den by their gcd.
  function fractionLabelParts(k, d, style, reduce) {
    var a = Math.abs(k), neg = k < 0;
    var whole = Math.floor(a / d), rem = a % d;
    if (rem === 0) return { neg: neg, whole: whole, num: 0, den: 1 };
    var num = rem, den = d;
    if (style === 'improper') { whole = 0; num = a; }
    if (reduce) { var g = gcd(num, den); num = num / g; den = den / g; }
    return { neg: neg, whole: whole, num: num, den: den };
  }

  function fractionWholeText(p) {
    if (p.num === 0) return (p.neg ? '-' : '') + p.whole;
    return (p.neg ? '-' : '') + (p.whole > 0 ? String(p.whole) : '');
  }

  function fractionLabelWidth(p) {
    var wt = fractionWholeText(p);
    var ww = wt.length ? wt.length * CHAR_W * 0.14 + 0.03 : 0;
    var fw = p.num > 0 ? Math.max(String(p.num).length, String(p.den).length) * CHAR_W * 0.11 + 0.05 : 0;
    return ww + fw;
  }

  // The label centred under x: the whole part, then numerator over a bar over denominator.
  function fractionLabelSvg(p, x, y) {
    var wt = fractionWholeText(p);
    if (p.num === 0) return textEl(x, y + 0.12, wt, 'middle', 0.14);
    var ww = wt.length ? wt.length * CHAR_W * 0.14 + 0.03 : 0;
    var fw = Math.max(String(p.num).length, String(p.den).length) * CHAR_W * 0.11 + 0.05;
    var xs = x - (ww + fw) / 2;
    var out = '';
    if (wt.length) out += textEl(xs, y + 0.12, wt, 'start', 0.14);
    var xc = xs + ww + fw / 2;
    out += textEl(xc, y + 0.03, String(p.num), 'middle', 0.11);
    out += lineEl(xc - fw / 2, y + 0.06, xc + fw / 2, y + 0.06, THIN);
    out += textEl(xc, y + 0.17, String(p.den), 'middle', 0.11);
    return out;
  }

  // opts: { orientation, min, max (whole numbers), denominator (2..16), labelStyle:
  //         'mixed'|'improper', reduce, labelEvery, copies, faded, header }
  function renderFractionLine(opts) {
    var fr = rowFrame(opts, opts.copies);
    var d = clampInt(opts.denominator, 2, 16, 4);
    var min = Math.round(Number(opts.min));
    if (!isFinite(min)) min = 0;
    var max = Math.round(Number(opts.max));
    if (!(max > min)) max = min + 1;
    var maxSpan = Math.floor(400 / d);
    if (max - min > maxSpan) max = min + maxSpan;
    var lo = min * d, hi = max * d;
    var style = opts.labelStyle === 'improper' ? 'improper' : 'mixed';
    var reduce = opts.reduce !== false;
    var gap = (fr.tB - fr.tA) / (hi - lo);
    var widest = 0, k;
    for (k = lo; k <= hi; k++) widest = Math.max(widest, fractionLabelWidth(fractionLabelParts(k, d, style, reduce)));
    var every = labelEveryFor(opts.labelEvery, d, Math.ceil((widest + 0.06) / gap));
    var parts = [], ticks = [];
    for (var r = 0; r < fr.copies; r++) {
      var y = fr.yc(r);
      parts.push(arrowedAxis(fr.xA, fr.xB, y));
      for (k = lo; k <= hi; k++) {
        var x = fr.tA + ((k - lo) / (hi - lo)) * (fr.tB - fr.tA);
        var whole = k % d === 0;
        var len = whole ? 0.14 : 0.08;
        parts.push(lineEl(x, y - len, x, y + len, TICK_W));
        if (r === 0) ticks.push({ k: k, x: x });
        if (k % every === 0) parts.push(fractionLabelSvg(fractionLabelParts(k, d, style, reduce), x, y + 0.22));
      }
    }
    return { svg: wrapSheet(fr.page, fr.headerH, opts, parts), ticks: ticks, denominator: d, min: min, max: max, labelEvery: every, rows: fr.copies };
  }

  // Decimal and integer lines: ticks every 1, 0.1 or 0.01, found from the whole
  // number n = value x scale, so 0.35 is tick 35 and never 0.30000000000000004.
  var DECIMAL_SCALES = { ones: 1, tenths: 10, hundredths: 100 };

  function decimalLabel(n, scale) {
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (scale === 1) return sign + a;
    var digits = String(scale).length - 1;
    var frac = String(a % scale);
    while (frac.length < digits) frac = '0' + frac;
    return sign + Math.floor(a / scale) + '.' + frac;
  }

  // opts: { orientation, min, max, step: 'ones'|'tenths'|'hundredths', labelEvery, copies, faded, header }
  function renderDecimalLine(opts) {
    var fr = rowFrame(opts, opts.copies);
    var stepName = DECIMAL_SCALES[opts.step] ? opts.step : 'tenths';
    var scale = DECIMAL_SCALES[stepName];
    var lo = Math.round(Number(opts.min) * scale);
    if (!isFinite(lo)) lo = 0;
    var hi = Math.round(Number(opts.max) * scale);
    if (!(hi > lo)) hi = lo + 1;
    if (hi - lo > 1000) hi = lo + 1000;
    var gap = (fr.tB - fr.tA) / (hi - lo);
    var widest = 0, n;
    for (n = lo; n <= hi; n++) widest = Math.max(widest, decimalLabel(n, scale).length);
    var need = Math.ceil((widest * CHAR_W * 0.14 + 0.08) / gap);
    var every = scale === 1 ? Math.max(1, clampInt(opts.labelEvery, 1, 100000, 1), need) : labelEveryFor(opts.labelEvery, scale, need);
    var parts = [], ticks = [];
    for (var r = 0; r < fr.copies; r++) {
      var y = fr.yc(r);
      parts.push(arrowedAxis(fr.xA, fr.xB, y));
      for (n = lo; n <= hi; n++) {
        var x = fr.tA + ((n - lo) / (hi - lo)) * (fr.tB - fr.tA);
        var major = scale === 1 || n % scale === 0;
        var half = scale > 1 && n % (scale / 2) === 0;
        var len = n === 0 ? 0.17 : (major ? 0.14 : (half ? 0.1 : 0.07));
        parts.push(lineEl(x, y - len, x, y + len, n === 0 ? BOLD : TICK_W));
        if (r === 0) ticks.push({ n: n, x: x });
        if (n % every === 0) parts.push(textEl(x, y + 0.34, decimalLabel(n, scale), 'middle'));
      }
    }
    return { svg: wrapSheet(fr.page, fr.headerH, opts, parts), ticks: ticks, scale: scale, lo: lo, hi: hi, labelEvery: every, rows: fr.copies };
  }

  // Open number line: the arrowed line and equally spaced marks, no numbers.
  // opts: { orientation, ticks (0..60), copies, faded, header }
  function renderOpenLine(opts) {
    var fr = rowFrame(opts, opts.copies);
    var count = clampInt(opts.ticks, 0, 60, 10);
    var parts = [], xs = [];
    for (var r = 0; r < fr.copies; r++) {
      var y = fr.yc(r);
      parts.push(arrowedAxis(fr.xA, fr.xB, y));
      for (var i = 1; i <= count; i++) {
        var x = fr.xA + (i / (count + 1)) * (fr.xB - fr.xA);
        parts.push(lineEl(x, y - 0.1, x, y + 0.1, TICK_W));
        if (r === 0) xs.push(x);
      }
    }
    return { svg: wrapSheet(fr.page, fr.headerH, opts, parts), ticks: count, xs: xs, rows: fr.copies };
  }

  // Double number line for ratios: two lines whose marks share x positions,
  // joined by a faint dashed rule, the top counting by topStep and the bottom by
  // bottomStep. bottom: 'all' shows every bottom number; 'example' shows 0 and the
  // first; 'none' shows only 0, for students to fill in.
  // opts: { orientation, topStep, bottomStep, intervals (2..20), topName, bottomName,
  //         bottom, copies (1..4), faded, header }
  function renderDoubleLine(opts) {
    var copiesIn = clampInt(opts.copies, 1, 4, 1);
    var fr = rowFrame(opts, copiesIn);
    var n = clampInt(opts.intervals, 2, 20, 6);
    var topStep = Number(opts.topStep), botStep = Number(opts.bottomStep);
    if (!(topStep > 0)) topStep = 1;
    if (!(botStep > 0)) botStep = 1;
    var topName = String(opts.topName || '').slice(0, 14), botName = String(opts.bottomName || '').slice(0, 14);
    var nameW = (topName || botName) ? Math.max(topName.length, botName.length) * CHAR_W * 0.14 + 0.2 : 0;
    var xA = fr.xA + nameW, xB = fr.xB;
    var tA = xA + 0.35, tB = xB - 0.35;
    var mode = opts.bottom === 'example' || opts.bottom === 'none' ? opts.bottom : 'all';
    var parts = [], xs = [];
    for (var r = 0; r < fr.copies; r++) {
      var yc = fr.yc(r);
      var yT = yc - 0.45, yB = yc + 0.45;
      parts.push(arrowedAxis(xA, xB, yT), arrowedAxis(xA, xB, yB));
      if (topName) parts.push(textEl(fr.xA, yT + 0.05, escapeXml(topName), 'start'));
      if (botName) parts.push(textEl(fr.xA, yB + 0.05, escapeXml(botName), 'start'));
      for (var i = 0; i <= n; i++) {
        var x = tA + (i / n) * (tB - tA);
        if (r === 0) xs.push(x);
        parts.push(lineEl(x, yT - 0.09, x, yT + 0.09, TICK_W), lineEl(x, yB - 0.09, x, yB + 0.09, TICK_W));
        parts.push(dashedLineEl(x, yT + 0.09, x, yB - 0.09, THIN));
        parts.push(textEl(x, yT - 0.16, formatNum(i * topStep), 'middle'));
        var showBottom = mode === 'all' || i === 0 || (mode === 'example' && i === 1);
        if (showBottom) parts.push(textEl(x, yB + 0.3, formatNum(i * botStep), 'middle'));
      }
    }
    return { svg: wrapSheet(fr.page, fr.headerH, opts, parts), xs: xs, intervals: n, rows: fr.copies, topY: fr.yc(0) - 0.45, bottomY: fr.yc(0) + 0.45 };
  }

  // Vertical number line drawn as a thermometer: a tube with a bulb, marks and
  // numbers on its right, `copies` of them side by side. Ticks come from the
  // whole number n = value x scale, scale being 10^(most decimals typed).
  // opts: { orientation, min, max, interval, labelEvery, copies (1..6), faded, header }
  function decimalsOf(v) {
    var s = Number(v).toFixed(6).replace(/0+$/, '');
    var i = s.indexOf('.');
    return i === -1 ? 0 : s.length - i - 1;
  }

  function renderVerticalLine(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var copies = clampInt(opts.copies, 1, 6, 1);
    var interval = Math.abs(Number(opts.interval)) || 1;
    var minV = Number(opts.min), maxV = Number(opts.max);
    if (!isFinite(minV)) minV = 0;
    if (!(maxV > minV)) maxV = minV + interval;
    var dec = Math.min(3, Math.max(decimalsOf(minV), decimalsOf(maxV), decimalsOf(interval)));
    var scale = Math.pow(10, dec);
    var stepN = Math.max(1, Math.round(interval * scale));
    var lo = Math.round(minV * scale), hi = Math.round(maxV * scale);
    if (hi <= lo) hi = lo + stepN;
    var count = Math.min(400, Math.floor((hi - lo) / stepN));
    hi = lo + count * stepN;
    if (count < 1) { count = 1; hi = lo + stepN; }
    var bulbR = 0.28, tubeW = 0.3, capR = tubeW / 2;
    var bulbCy = page.h - MARGIN - bulbR;
    var yMin = bulbCy - 0.1;
    var yMax = MARGIN + headerH + 0.45;
    var gapIn = (yMin - yMax) / count;
    var every = Math.max(1, clampInt(opts.labelEvery, 1, 100000, 1), Math.ceil(0.2 / gapIn));
    var slotW = (page.w - MARGIN * 2) / copies;
    var parts = [], ticks = [];
    for (var c = 0; c < copies; c++) {
      var xl = MARGIN + slotW * c + 0.15, xr = xl + tubeW;
      var yTop = yMax - 0.2;
      var bx = Math.sqrt(bulbR * bulbR - Math.pow(tubeW / 2, 2));
      parts.push('<path d="M ' + xl.toFixed(4) + ' ' + (bulbCy - bx).toFixed(4) + ' L ' + xl.toFixed(4) + ' ' + (yTop + capR).toFixed(4) +
        ' A ' + capR.toFixed(4) + ' ' + capR.toFixed(4) + ' 0 0 1 ' + xr.toFixed(4) + ' ' + (yTop + capR).toFixed(4) +
        ' L ' + xr.toFixed(4) + ' ' + (bulbCy - bx).toFixed(4) +
        ' A ' + bulbR + ' ' + bulbR + ' 0 1 1 ' + xl.toFixed(4) + ' ' + (bulbCy - bx).toFixed(4) +
        '" fill="none" stroke="currentColor" stroke-width="' + BOLD + '"/>');
      for (var i = 0; i <= count; i++) {
        var nv = lo + i * stepN;
        var y = yMin - (i / count) * (yMin - yMax);
        var major = i % every === 0;
        var len = major ? 0.2 : 0.12;
        parts.push(lineEl(xr, y, xr + len, y, TICK_W));
        if (c === 0) ticks.push({ n: nv, y: y });
        if (major) parts.push(textEl(xr + len + 0.05, y + 0.045, decimalLabel(nv, scale), 'start'));
      }
    }
    return { svg: wrapSheet(page, headerH, opts, parts), ticks: ticks, scale: scale, labelEvery: every, rows: copies, yMin: yMin, yMax: yMax };
  }

  /* ---------- Hexagonal paper, storyboard frames and music staves ---------- */
  function rectEl(x, y, w, h, strokeWidth) {
    return '<rect x="' + x.toFixed(4) + '" y="' + y.toFixed(4) + '" width="' + w.toFixed(4) + '" height="' + h.toFixed(4) +
      '" fill="none" stroke="currentColor" stroke-width="' + strokeWidth + '"/>';
  }

  // Regular hexagons of side `side` tiling the page edge to edge, drawn as shared
  // edges (each edge once). Pointy-top: vertical sides, centres sqrt(3) x side apart in
  // a row, rows 1.5 x side apart and every other row shifted half a hexagon. Flat-top is
  // the same lattice turned a quarter turn. Only whole hexagons inside the area are drawn.
  // opts: { orientation, cellSize (side, inches), hexTop: 'pointy'|'flat', faded, header }
  function hexLayout(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2, usableH = page.h - MARGIN * 2 - headerH;
    var s = Math.max(0.1, Number(opts.cellSize) || 0.25);
    var flat = opts.hexTop === 'flat';
    // work in a frame where hexagons are pointy-top, swapping the axes for flat-top
    var W = flat ? usableH : usableW, H = flat ? usableW : usableH;
    var hexW = Math.sqrt(3) * s;
    var rows = H >= 2 * s ? Math.floor((H - 2 * s) / (1.5 * s)) + 1 : 0;
    var centres = [];
    for (var r = 0; r < rows; r++) {
      var shift = r % 2 === 1 ? hexW / 2 : 0;
      var cols = Math.floor((W - shift) / hexW);
      if (cols < 1) continue;
      for (var c = 0; c < cols; c++) centres.push({ u: shift + hexW / 2 + c * hexW, v: s + r * 1.5 * s });
    }
    if (!centres.length) return { page: page, headerH: headerH, side: s, flat: flat, centres: [], edges: [] };
    var uMin = Math.min.apply(null, centres.map(function (p) { return p.u - hexW / 2; }));
    var uMax = Math.max.apply(null, centres.map(function (p) { return p.u + hexW / 2; }));
    var vMax = Math.max.apply(null, centres.map(function (p) { return p.v + s; }));
    var offU = (W - (uMax - uMin)) / 2 - uMin, offV = (H - vMax) / 2;
    var ox = MARGIN, oy = MARGIN + headerH;
    function toPage(u, v) { return flat ? [ox + v, oy + u] : [ox + u, oy + v]; }
    // A corner shared by three hexagons is reached from three centres by three different sums,
    // so two floats a hair apart are one corner: matched within 1e-3in, not by a rounded string.
    var cornerCells = {}, corners = [];
    function cornerId(x, y) {
      var cx = Math.floor(x / 0.01), cy = Math.floor(y / 0.01);
      for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
        var cell = cornerCells[(cx + i) + ',' + (cy + j)] || [];
        for (var q = 0; q < cell.length; q++) if (Math.abs(corners[cell[q]][0] - x) < 1e-3 && Math.abs(corners[cell[q]][1] - y) < 1e-3) return cell[q];
      }
      var id = corners.length;
      corners.push([x, y]);
      (cornerCells[cx + ',' + cy] = cornerCells[cx + ',' + cy] || []).push(id);
      return id;
    }
    var seen = {}, edges = [], placed = [];
    centres.forEach(function (p) {
      var cu = p.u + offU, cv = p.v + offV;
      placed.push(toPage(cu, cv));
      var verts = [];
      for (var k = 0; k < 6; k++) {
        var ang = (60 * k + 30) * Math.PI / 180; // pointy-top: first vertex at 30 degrees from the u axis
        verts.push([cu + s * Math.cos(ang), cv + s * Math.sin(ang)]);
      }
      for (var e = 0; e < 6; e++) {
        var a = toPage(verts[e][0], verts[e][1]), b = toPage(verts[(e + 1) % 6][0], verts[(e + 1) % 6][1]);
        var ka = cornerId(a[0], a[1]), kb = cornerId(b[0], b[1]);
        var key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (seen[key]) continue;
        seen[key] = true;
        edges.push([a[0], a[1], b[0], b[1]]);
      }
    });
    return { page: page, headerH: headerH, side: s, flat: flat, centres: placed, edges: edges };
  }

  function renderHexPaper(opts) {
    var L = hexLayout(opts);
    var parts = L.edges.map(function (e) { return lineEl(e[0], e[1], e[2], e[3], THIN); });
    return { svg: wrapSheet(L.page, L.headerH, opts, parts), side: L.side, flat: L.flat, centres: L.centres, hexagons: L.centres.length };
  }

  // Storyboard: `frames` boxes of one exact aspect ratio in a grid, each with ruled
  // caption lines beneath.
  // opts: { orientation, frames (2|3|4|6|8|9|12), aspect: '16:9'|'4:3'|'1:1'|'2.35:1', captionLines (0..4), faded, header }
  var STORY_ASPECTS = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '2.35:1': 2.35 };
  var STORY_GRIDS = {
    portrait: { 2: [1, 2], 3: [1, 3], 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 12: [3, 4] },
    landscape: { 2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 12: [4, 3] }
  };
  var STORY_GUTTER = 0.3, CAPTION_GAP = 0.28;

  function storyboardLayout(opts) {
    var page = pageSize(opts.orientation);
    var orient = opts.orientation === 'landscape' ? 'landscape' : 'portrait';
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2, usableH = page.h - MARGIN * 2 - headerH;
    var frames = STORY_GRIDS[orient][opts.frames] ? Math.round(opts.frames) : 6;
    var grid = STORY_GRIDS[orient][frames], cols = grid[0], rows = grid[1];
    var aspectName = STORY_ASPECTS[opts.aspect] ? opts.aspect : '16:9', aspect = STORY_ASPECTS[aspectName];
    var lines = clampInt(opts.captionLines, 0, 4, 2);
    var captionH = lines ? 0.1 + lines * CAPTION_GAP : 0;
    var cellW = (usableW - (cols - 1) * STORY_GUTTER) / cols;
    var cellH = (usableH - (rows - 1) * STORY_GUTTER) / rows;
    var frameW = Math.min(cellW, (cellH - captionH) * aspect);
    var frameH = frameW / aspect;
    var blockW = cols * frameW + (cols - 1) * STORY_GUTTER;
    var blockH = rows * (frameH + captionH) + (rows - 1) * STORY_GUTTER;
    var x0 = MARGIN + (usableW - blockW) / 2, y0 = MARGIN + headerH + (usableH - blockH) / 2;
    var boxes = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      boxes.push({ x: x0 + c * (frameW + STORY_GUTTER), y: y0 + r * (frameH + captionH + STORY_GUTTER), w: frameW, h: frameH });
    }
    return { page: page, headerH: headerH, frames: frames, cols: cols, rows: rows, aspect: aspectName, lines: lines, frameW: frameW, frameH: frameH, captionH: captionH, boxes: boxes };
  }

  function renderStoryboard(opts) {
    var L = storyboardLayout(opts);
    var parts = [];
    L.boxes.forEach(function (b) {
      parts.push(rectEl(b.x, b.y, b.w, b.h, BOLD));
      for (var i = 1; i <= L.lines; i++) {
        var y = b.y + b.h + 0.1 + i * CAPTION_GAP - 0.04;
        parts.push(lineEl(b.x, y, b.x + b.w, y, THIN));
      }
    });
    return { svg: wrapSheet(L.page, L.headerH, opts, parts), frames: L.frames, cols: L.cols, rows: L.rows, aspect: L.aspect, frameW: L.frameW, frameH: L.frameH, boxes: L.boxes, captionLines: L.lines };
  }

  // Music manuscript paper: five-line staves with equal gaps, stacked at a fixed pitch,
  // as many as fit. A grand staff is two staves close together joined by a bar at the left,
  // pairs stacked below one another.
  // opts: { orientation, lineGap (inches between staff lines), grand, faded, header }
  function musicLayout(opts) {
    var page = pageSize(opts.orientation);
    var headerH = headerBlockHeight(opts.header);
    var usableW = page.w - MARGIN * 2, usableH = page.h - MARGIN * 2 - headerH;
    var g = Number(opts.lineGap);
    if (!(g >= 0.05)) g = g > 0 ? 0.05 : 0.125;
    var grand = !!opts.grand;
    var staffH = 4 * g;
    var unitH = grand ? staffH + 3 * g + staffH : staffH;   // one system
    var pitch = grand ? unitH + 5 * g : unitH + 4.5 * g;      // from one system to the next
    var count = usableH >= unitH ? Math.floor((usableH - unitH) / pitch + 1e-9) + 1 : 0;
    var blockH = count ? (count - 1) * pitch + unitH : 0;
    var top = MARGIN + headerH + (usableH - blockH) / 2;
    var systems = [];
    for (var i = 0; i < count; i++) {
      var y = top + i * pitch;
      systems.push(grand ? [y, y + staffH + 3 * g] : [y]);
    }
    return { page: page, headerH: headerH, gap: g, grand: grand, staffH: staffH, unitH: unitH, pitch: pitch, systems: systems, x0: MARGIN, x1: MARGIN + usableW };
  }

  function renderMusicStaves(opts) {
    var L = musicLayout(opts);
    var parts = [];
    L.systems.forEach(function (staffTops) {
      staffTops.forEach(function (yt) {
        for (var k = 0; k < 5; k++) parts.push(lineEl(L.x0, yt + k * L.gap, L.x1, yt + k * L.gap, TICK_W));
        parts.push(lineEl(L.x0, yt, L.x0, yt + L.staffH, TICK_W));
        parts.push(lineEl(L.x1, yt, L.x1, yt + L.staffH, TICK_W));
      });
      if (staffTops.length === 2) parts.push(lineEl(L.x0, staffTops[0], L.x0, staffTops[1] + L.staffH, BOLD));
    });
    return { svg: wrapSheet(L.page, L.headerH, opts, parts), gap: L.gap, grand: L.grand, systems: L.systems, staves: L.systems.reduce(function (n, s) { return n + s.length; }, 0), pitch: L.pitch, staffH: L.staffH };
  }

  global.GraphPaperRender = {
    renderGraphPaper: renderGraphPaper,
    renderNumberLine: renderNumberLine,
    renderCoordinatePlane: renderCoordinatePlane,
    renderCornellNotes: renderCornellNotes,
    renderHandwritingLines: renderHandwritingLines,
    renderCalibration: renderCalibration,
    renderPolarPaper: renderPolarPaper,
    renderHexPaper: renderHexPaper,
    renderStoryboard: renderStoryboard,
    renderMusicStaves: renderMusicStaves,
    renderLogPaper: renderLogPaper,
    renderFractionLine: renderFractionLine,
    renderDecimalLine: renderDecimalLine,
    renderOpenLine: renderOpenLine,
    renderDoubleLine: renderDoubleLine,
    renderVerticalLine: renderVerticalLine,
    fractionLabelParts: fractionLabelParts,
    decimalLabel: decimalLabel,
    logAxisLines: logAxisLines,
    expLabel: expLabel,
    renderWorksheet: renderWorksheet,
    tokenizeGraphExpr: tokenizeGraphExpr,
    parseGraphExpression: parseGraphExpression,
    generateProblem: generateProblem
  };
})(typeof window !== 'undefined' ? window : global);
