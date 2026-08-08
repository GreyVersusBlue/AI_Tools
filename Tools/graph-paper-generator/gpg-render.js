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

  function pageSize(orientation) {
    return orientation === 'landscape' ? { w: 11, h: 8.5 } : { w: 8.5, h: 11 };
  }

  function svgWrap(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + 'in" height="' + h + 'in" ' +
      'viewBox="0 0 ' + w + ' ' + h + '" font-family="Consolas, monospace">' + inner + '</svg>';
  }

  function lineEl(x1, y1, x2, y2, strokeWidth) {
    return '<line x1="' + x1.toFixed(4) + '" y1="' + y1.toFixed(4) + '" x2="' + x2.toFixed(4) +
      '" y2="' + y2.toFixed(4) + '" stroke="#1a1a1a" stroke-width="' + strokeWidth + '"/>';
  }

  function textEl(x, y, label, anchor, size) {
    return '<text x="' + x.toFixed(4) + '" y="' + y.toFixed(4) + '" font-size="' + (size || 0.14) +
      '" text-anchor="' + (anchor || 'middle') + '" fill="#1a1a1a">' + label + '</text>';
  }

  function formatNum(v) {
    var r = Math.round(v * 1000) / 1000;
    return String(r);
  }

  /* ---------- Graph paper ---------- */
  // opts: { orientation, cellSize (inches, used when mode='fill'),
  //         mode: 'fill' | 'exact', cols, rows (used when mode='exact'),
  //         boldCenter }
  function renderGraphPaper(opts) {
    var page = pageSize(opts.orientation);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2;
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
    var offsetX = MARGIN + (usableW - gridW) / 2;
    var offsetY = MARGIN + (usableH - gridH) / 2;

    var parts = [];
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

    return { svg: svgWrap(page.w, page.h, parts.join('')), cols: cols, rows: rows, cellSize: cellSize };
  }

  /* ---------- Number line ---------- */
  // opts: { orientation, min, max, interval, labelEvery, copies }
  function renderNumberLine(opts) {
    var page = pageSize(opts.orientation);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2;
    // A typed 0, negative, or non-numeric interval must not survive as a tiny
    // positive one (Math.max(1e-6, -1) is still 1e-6) — that turns a normal
    // range into tens of millions of ticks and hangs the tab.
    var interval = Math.abs(opts.interval) || 1;
    var min = opts.min, max = opts.max;
    if (!(max > min)) max = min + interval; // zero/inverted range → one tick, not NaN/Infinity
    var labelEvery = Math.max(1, Math.round(opts.labelEvery));
    var copies = Math.max(1, Math.round(opts.copies));
    var tickCount = Math.min(2000, Math.max(1, Math.round((max - min) / interval)));

    var spacing = usableH / copies;
    var parts = [];
    for (var i = 0; i < copies; i++) {
      var yCenter = MARGIN + spacing * i + spacing / 2;
      var x0 = MARGIN, x1 = MARGIN + usableW;
      parts.push(lineEl(x0, yCenter, x1, yCenter, BOLD));
      // arrowheads
      parts.push('<path d="M ' + x0.toFixed(4) + ' ' + yCenter.toFixed(4) + ' l 0.12 -0.06 l 0 0.12 z" fill="#1a1a1a"/>');
      parts.push('<path d="M ' + x1.toFixed(4) + ' ' + yCenter.toFixed(4) + ' l -0.12 -0.06 l 0 0.12 z" fill="#1a1a1a"/>');
      for (var t = 0; t <= tickCount; t++) {
        var value = min + t * interval;
        var x = x0 + ((value - min) / (max - min)) * usableW;
        parts.push(lineEl(x, yCenter - 0.09, x, yCenter + 0.09, THIN * 1.6));
        if (t % labelEvery === 0) {
          parts.push(textEl(x, yCenter + 0.28, formatNum(value)));
        }
      }
    }
    return { svg: svgWrap(page.w, page.h, parts.join('')), tickCount: tickCount + 1 };
  }

  /* ---------- Coordinate plane ---------- */
  // opts: { orientation, quadrants: 'four' | 'first', xMin, xMax, yMin, yMax,
  //         interval, labelEvery }
  function renderCoordinatePlane(opts) {
    var page = pageSize(opts.orientation);
    var usableW = page.w - MARGIN * 2;
    var usableH = page.h - MARGIN * 2;

    var xMin = opts.quadrants === 'first' ? 0 : opts.xMin;
    var xMax = opts.xMax;
    var yMin = opts.quadrants === 'first' ? 0 : opts.yMin;
    var yMax = opts.yMax;
    var interval = Math.abs(opts.interval) || 1;
    if (!(xMax > xMin)) xMax = xMin + interval;
    if (!(yMax > yMin)) yMax = yMin + interval;
    var labelEvery = Math.max(1, Math.round(opts.labelEvery));

    var xRange = xMax - xMin, yRange = yMax - yMin;
    var scale = Math.min(usableW / xRange, usableH / yRange);
    var gridW = scale * xRange, gridH = scale * yRange;
    var offsetX = MARGIN + (usableW - gridW) / 2;
    var offsetY = MARGIN + (usableH - gridH) / 2;

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

    for (var ix = 0; ix <= xTicks; ix++) {
      if (ix % labelEvery !== 0) continue;
      var xvL = xMin + ix * interval;
      if (Math.abs(xvL) < 1e-6) continue; // skip origin label, drawn once below
      parts.push(textEl(toSvgX(xvL), xLabelY + 0.22, formatNum(xvL)));
    }
    for (var iy = 0; iy <= yTicks; iy++) {
      if (iy % labelEvery !== 0) continue;
      var yvL = yMin + iy * interval;
      if (Math.abs(yvL) < 1e-6) continue;
      parts.push(textEl(yLabelX - 0.14, toSvgY(yvL) + 0.05, formatNum(yvL), 'end'));
    }
    if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
      parts.push(textEl(toSvgX(0) - 0.14, toSvgY(0) + 0.22, '0', 'end'));
    }

    return { svg: svgWrap(page.w, page.h, parts.join('')), xTicks: xTicks + 1, yTicks: yTicks + 1 };
  }

  global.GraphPaperRender = {
    renderGraphPaper: renderGraphPaper,
    renderNumberLine: renderNumberLine,
    renderCoordinatePlane: renderCoordinatePlane
  };
})(typeof window !== 'undefined' ? window : global);
