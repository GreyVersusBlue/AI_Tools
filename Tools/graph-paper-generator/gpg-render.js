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

  global.GraphPaperRender = {
    renderGraphPaper: renderGraphPaper,
    renderNumberLine: renderNumberLine,
    renderCoordinatePlane: renderCoordinatePlane
  };
})(typeof window !== 'undefined' ? window : global);
