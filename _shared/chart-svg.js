/* chart-svg.js — the shared chart layer (Path 16 P1): SVG strings built from plain
   data, the contrast rule that picks a label colour, the hatch patterns that are a
   second signal beside colour, and the one rasterizer / download / copy path.
   BACKLOG.md's Path 16 P1 bullet has the design and what is still to move in.

   Step 1: Grade Distribution Visualizer's (037) code, moved unchanged.
   Step 2: Data Chart Builder's (038) drawing: niceMax, formatNum, round2, linearRegression,
   bar / line / pie / scatter / box (built, opts) and blankAxes, each role="img" with a <title>
   and a generated <desc>; opts in the section's header comment.

     ChartSvg.escapeXml(s), ChartSvg.fmt(n, d)
     ChartSvg.relativeLuminance(hex), ChartSvg.contrastRatio(lumA, lumB)
     ChartSvg.textColorFor(hex[, ink])    near-black or white, whichever has the
                                          higher WCAG contrast on that fill
     ChartSvg.hatchPattern(id, base, stroke)
     ChartSvg.stackedBar(data[, opts]), ChartSvg.histogram(data[, opts])
         data is 037's lastChartData: { name, stats: { n }, letters, letterOrder,
         buckets, bucketWidth, excluded }
     ChartSvg.toPngBlob(svg, w, h, onBlob, onError)   2x, on white
     ChartSvg.downloadBlob / downloadSvg / downloadPng / copyImage / setStatus

   Pure functions touch no DOM; the browser half touches `document` only when
   called. Nothing here stores anything. A hex is #rrggbb. */
(function (root) {
  'use strict';

  var LETTER_HEX = { A: '#08306b', B: '#2171b5', C: '#4292c6', D: '#6baed6', F: '#9ecae1' };
  var ZERO_HEX = '#6b6a63';
  var INK_HEX = '#1f2430';

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    var f = n.toFixed(d == null ? 1 : d);
    return f.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1') || f;
  }

  /** WCAG 2.x relative luminance of a #rrggbb string. */
  function relativeLuminance(hex) {
    var chan = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrastRatio(l1, l2) {
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /** Readable label text for a fill: the ink or white, by real WCAG contrast, the
      better one wins. (A brightness guess with a 0.55 threshold put white on
      #4292c6 at 3.41:1; the ink is 4.55:1.) */
  function textColorFor(hex, ink) {
    ink = ink || INK_HEX;
    var lum = relativeLuminance(hex);
    return contrastRatio(lum, relativeLuminance(ink)) >= contrastRatio(lum, 1) ? ink : '#ffffff';
  }

  /** One diagonal-hatch <pattern>: a second, non-colour signal that survives
      grayscale printing. */
  function hatchPattern(id, base, stroke) {
    return '<pattern id="' + id + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="7" height="7" fill="' + base + '"/>' +
      '<line x1="0" y1="0" x2="0" y2="7" stroke="' + stroke + '" stroke-width="3"/>' +
      '</pattern>';
  }

  function letterDefs(o) {
    return '<defs>' +
      hatchPattern('hatchF', o.letterHex.F, 'rgba(31,36,48,.35)') +
      hatchPattern('hatchZero', o.zeroHex, 'rgba(255,255,255,.45)') +
      '</defs>';
  }

  function opts(o) {
    o = o || {};
    return {
      letterHex: o.letterHex || LETTER_HEX,
      zeroHex: o.zeroHex || ZERO_HEX,
      ink: o.ink || INK_HEX
    };
  }

  /** "n=31 (2 excluded — blank/non-numeric)": every export carries the count that
      decides whether the shape it shows is trustworthy. */
  function nCaption(data) {
    var s = 'n = ' + data.stats.n;
    if (data.excluded) s += ' (' + data.excluded + ' excluded — blank/non-numeric)';
    return s;
  }

  /** The letter-grade breakdown as a standalone SVG (a flexbox bar has no meaning
      outside the page's stylesheet). */
  function stackedBar(data, o) {
    o = opts(o);
    var W = 640, H = 168, pad = 20, barY = 46, barH = 40;
    var barW = W - pad * 2;
    var x = pad, legend = '', segs = '';
    var legendY = barY + barH + 34, lx = pad;
    data.letterOrder.forEach(function (l) {
      var count = data.letters[l];
      var pct = data.stats.n ? (count / data.stats.n * 100) : 0;
      var w = barW * (pct / 100);
      var fill = l === 'F' ? 'url(#hatchF)' : o.letterHex[l];
      var textFill = textColorFor(o.letterHex[l], o.ink);
      if (w > 0) {
        segs += '<rect x="' + x.toFixed(2) + '" y="' + barY + '" width="' + w.toFixed(2) + '" height="' + barH + '" fill="' + fill + '"/>';
        if (pct >= 6) {
          segs += '<text x="' + (x + w / 2).toFixed(2) + '" y="' + (barY + barH / 2 + 5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + textFill + '" font-family="Segoe UI, Arial, sans-serif">' + Math.round(pct) + '%</text>';
        }
        x += w;
      }
      var legendText = l + ': ' + count + ' (' + fmt(pct, 1) + '%)';
      legend += '<rect x="' + lx + '" y="' + (legendY - 11) + '" width="11" height="11" fill="' + fill + '" stroke="#8c897f"/>' +
        '<text x="' + (lx + 16) + '" y="' + legendY + '" font-size="12" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml(legendText) + '</text>';
      lx += 16 + legendText.length * 6.6 + 18;
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      letterDefs(o) +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + pad + '" y="18" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Letter-grade breakdown') + '</text>' +
      '<text x="' + pad + '" y="34" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<rect x="' + pad + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="none" stroke="#8c897f"/>' +
      segs + legend +
      '</svg>';
  }

  function histogram(data, o) {
    o = opts(o);
    var W = 640, H = 330, padL = 30, padR = 20, padT = 50, padB = 50;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var buckets = data.buckets;
    var maxCount = buckets.reduce(function (m, b) { return Math.max(m, b.count); }, 0) || 1;
    var n = buckets.length;
    var gap = 6;
    var barW = (plotW - gap * (n - 1)) / n;
    var bars = '', labels = '';
    buckets.forEach(function (b, i) {
      var h = (b.count / maxCount) * plotH;
      var x = padL + i * (barW + gap);
      var y = padT + (plotH - h);
      var fill = b.isZero ? 'url(#hatchZero)' : '#2e6b8f';
      bars += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2) + '" height="' + h.toFixed(2) + '" fill="' + fill + '"/>';
      if (b.count) bars += '<text x="' + (x + barW / 2).toFixed(2) + '" y="' + (y - 6).toFixed(2) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1f3550" font-family="Segoe UI, Arial, sans-serif">' + b.count + '</text>';
      var labelWeight = b.isZero ? 'font-weight="700" fill="#1f2430"' : 'fill="#6b6a63"';
      labels += '<text x="' + (x + barW / 2).toFixed(2) + '" y="' + (padT + plotH + 18) + '" text-anchor="middle" font-size="10" ' + labelWeight + ' font-family="Segoe UI, Arial, sans-serif">' + escapeXml(b.isZero ? '0 (not submitted)' : b.label) + '</text>';
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      letterDefs(o) +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + padL + '" y="20" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Score histogram (bucket width ' + data.bucketWidth + ')') + '</text>' +
      '<text x="' + padL + '" y="36" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + plotH) + '" stroke="#8c897f" stroke-width="1.5"/>' +
      bars + labels +
      '</svg>';
  }

  /* ---------- Step 2: the category / scatter / box charts (038's drawing) ----------

     Every chart takes the data the page already builds and an options object `o`:
       { W, H, pad, title, yLabel, showValues, palette (hex list, pie), pointColor,
         trendColor, trend (scatter: draw the fit), fit (scatter: a curve to draw instead of the straight
         line, { predict(x), label, desc } from dcb-fit.js; nothing changes without it), notes (scatter: the annotation layer, see Step 4 below), fits (scatter with sc.series: one fit per series, in order), xScale / yScale ('log': base-10 axis on
         the scatter; points at or below 0 are left out and counted in the <desc>), grayscale (hatch per series),
         idPrefix (ids for the <title>, <desc> and patterns: unique per SVG on a page) }
     and returns a standalone SVG string. Each SVG is role="img" with a <title> and a
     <desc> that says what the picture says (type, categories, values), so a screen
     reader gets the data and not "image". */

  function niceMax(v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var norm = v / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function formatNum(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
    return Math.round(v * 100) / 100 + '';
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  function linearRegression(points) {
    var n = points.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
    points.forEach(function (p) {
      sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumXX += p.x * p.x; sumYY += p.y * p.y;
    });
    var denom = n * sumXX - sumX * sumX;
    if (n < 2 || denom === 0) return null;
    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    var corrDenom = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    var r = corrDenom === 0 ? 0 : (n * sumXY - sumX * sumY) / corrDenom;
    return { slope: slope, intercept: intercept, r2: r * r };
  }

  function chartOpts(o) {
    o = o || {};
    return {
      W: o.W || 640, H: o.H || 400,
      pad: o.pad || { top: 40, right: 24, bottom: 64, left: 56 },
      title: o.title || '', yLabel: o.yLabel || '',
      showValues: !!o.showValues, trend: !!o.trend, grayscale: !!o.grayscale,
      palette: o.palette || ['#6c8ef5', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8'],
      pointColor: o.pointColor || '#6c8ef5', trendColor: o.trendColor || '#f87171',
      xLabel: o.xLabel || '',
      yMax: o.yMax > 0 ? o.yMax : 0,
      idPrefix: o.idPrefix || 'cs',
      kind: o.kind || '',
      fit: o.fit || null, fits: o.fits || null, notes: o.notes || null,
      xScale: o.xScale === 'log' ? 'log' : 'linear', yScale: o.yScale === 'log' ? 'log' : 'linear'
    };
  }

  /* The hatches a grayscale chart adds on top of lightness: series 0 stays solid (the darkest),
     the others get a line pattern at a different angle and spacing, so two greys of similar
     lightness still read apart on a black-and-white copier. */
  var HATCHES = [null,
    { angle: 45, gap: 6 }, { angle: 135, gap: 6 }, { angle: 0, gap: 6 }, { angle: 90, gap: 6 }, { angle: 45, gap: 12 }];

  function seriesFill(c, hex, i) {
    return c.grayscale && HATCHES[i % HATCHES.length] ? 'url(#' + c.idPrefix + '-h' + (i % HATCHES.length) + ')' : hex;
  }

  function seriesDefs(c, colors) {
    if (!c.grayscale) return '';
    var out = '', seen = {};
    colors.forEach(function (hex, i) {
      var k = i % HATCHES.length, h = HATCHES[k];
      if (!h || seen[k]) return;
      seen[k] = true;
      var stroke = textColorFor(hex) === INK_HEX ? 'rgba(31,36,48,.55)' : 'rgba(255,255,255,.7)';
      out += '<pattern id="' + c.idPrefix + '-h' + k + '" width="' + h.gap + '" height="' + h.gap + '" patternUnits="userSpaceOnUse" patternTransform="rotate(' + h.angle + ')">' +
        '<rect width="' + h.gap + '" height="' + h.gap + '" fill="' + hex + '"/>' +
        '<line x1="0" y1="0" x2="0" y2="' + h.gap + '" stroke="' + stroke + '" stroke-width="2"/></pattern>';
    });
    return out ? '<defs>' + out + '</defs>' : '';
  }

  function listCap(items, max) {
    return items.length > max ? items.slice(0, max).join(', ') + ' and ' + (items.length - max) + ' more' : items.join(', ');
  }

  function open(c, kindTitle, desc, defs) {
    var title = c.title || kindTitle;
    var tid = c.idPrefix + '-title', did = c.idPrefix + '-desc';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + c.W + ' ' + c.H + '" role="img" aria-labelledby="' + tid + ' ' + did + '" font-family="Inter, system-ui, sans-serif">' +
      '<title id="' + tid + '">' + escapeXml(title) + '</title><desc id="' + did + '">' + escapeXml(desc) + '</desc>' +
      (defs || '') +
      '<rect width="' + c.W + '" height="' + c.H + '" fill="#ffffff"/>';
  }

  function titleEl(c) {
    if (!c.title) return '';
    return '<text x="' + (c.W / 2) + '" y="22" text-anchor="middle" font-size="15" font-weight="700" fill="#16222e">' + escapeXml(c.title) + '</text>';
  }

  function axes(c, maxVal, categories) {
    var W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var parts = [];
    var ticks = 5;
    for (var i = 0; i <= ticks; i++) {
      var y = PAD.top + plotH - (plotH * i / ticks);
      var val = (maxVal * i / ticks);
      parts.push('<line x1="' + PAD.left + '" y1="' + y + '" x2="' + (W - PAD.right) + '" y2="' + y + '" stroke="#e1e5ea" stroke-width="1"/>');
      parts.push('<text x="' + (PAD.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#5b6b78">' + formatNum(val) + '</text>');
    }
    parts.push('<line x1="' + PAD.left + '" y1="' + PAD.top + '" x2="' + PAD.left + '" y2="' + (PAD.top + plotH) + '" stroke="#c7cfd6" stroke-width="1.5"/>');
    parts.push('<line x1="' + PAD.left + '" y1="' + (PAD.top + plotH) + '" x2="' + (W - PAD.right) + '" y2="' + (PAD.top + plotH) + '" stroke="#c7cfd6" stroke-width="1.5"/>');

    if (categories) {
      var n = categories.length;
      var slot = plotW / n;
      categories.forEach(function (cat, i) {
        var x = PAD.left + slot * i + slot / 2;
        var label = String(cat);
        if (label.length > 10) label = label.slice(0, 9) + '…';
        var rotate = n > 8;
        if (rotate) {
          parts.push('<text x="' + x + '" y="' + (PAD.top + plotH + 14) + '" text-anchor="end" font-size="9.5" fill="#5b6b78" transform="rotate(-40 ' + x + ' ' + (PAD.top + plotH + 14) + ')">' + escapeXml(label) + '</text>');
        } else {
          parts.push('<text x="' + x + '" y="' + (PAD.top + plotH + 18) + '" text-anchor="middle" font-size="10.5" fill="#5b6b78">' + escapeXml(label) + '</text>');
        }
      });
    }
    return parts.join('');
  }

  function yAxisLabel(c, defaultLabel) {
    var text = c.yLabel || defaultLabel;
    if (!text) return '';
    var plotH = c.H - c.pad.top - c.pad.bottom;
    var x = 14, y = c.pad.top + plotH / 2;
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="10.5" fill="#5b6b78" transform="rotate(-90 ' + x + ' ' + y + ')">' + escapeXml(text) + '</text>';
  }

  function errorBar(cx, centerY, halfH) {
    if (!halfH) return '';
    var top = centerY - halfH, bot = centerY + halfH;
    return '<line x1="' + cx.toFixed(1) + '" y1="' + top.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + bot.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>' +
      '<line x1="' + (cx - 4).toFixed(1) + '" y1="' + top.toFixed(1) + '" x2="' + (cx + 4).toFixed(1) + '" y2="' + top.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>' +
      '<line x1="' + (cx - 4).toFixed(1) + '" y1="' + bot.toFixed(1) + '" x2="' + (cx + 4).toFixed(1) + '" y2="' + bot.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>';
  }

  function legendItems(c, items) {
    var x = c.pad.left;
    var parts = ['<g transform="translate(0,' + (c.H - 8) + ')">'];
    var curX = x;
    items.forEach(function (item) {
      var textW = Math.min(item.label.length * 6 + 24, 160);
      if (curX + textW > c.W - c.pad.right) return;
      parts.push('<rect x="' + curX + '" y="-9" width="9" height="9" fill="' + item.fill + '" rx="2"/>');
      parts.push('<text x="' + (curX + 13) + '" y="-1" font-size="10" fill="#16222e">' + escapeXml(item.label.length > 20 ? item.label.slice(0, 19) + '…' : item.label) + '</text>');
      curX += textW;
    });
    parts.push('</g>');
    return parts.join('');
  }

  function seriesLegend(c, series) {
    if (series.length < 2) return '';
    return legendItems(c, series.map(function (s, i) { return { label: s.label, fill: seriesFill(c, s.color, i) }; }));
  }

  function maxOf(series) {
    return niceMax(Math.max.apply(null, series.map(function (s) { return Math.max.apply(null, s.values.concat([0])); })) * 1.15);
  }

  function categoryDesc(kind, built, o) {
    var cats = built.categories.map(String);
    var lines = [kind + ' with ' + cats.length + ' categor' + (cats.length === 1 ? 'y' : 'ies') + ': ' + listCap(cats, 12) + '.'];
    built.series.forEach(function (s) {
      var pairs = s.values.map(function (v, i) { return cats[i] + ' ' + formatNum(v); });
      lines.push((s.label || 'Series') + ': ' + listCap(pairs, 12) + '.');
    });
    if (o && o.yLabel) lines.push('Vertical axis: ' + o.yLabel + '.');
    return lines.join(' ');
  }

  function bar(built, o) {
    var c = chartOpts(o), W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var maxVal = c.yMax || maxOf(built.series);
    var n = built.categories.length;
    var slot = plotW / n;
    var groupPad = slot * 0.18;
    var barW = (slot - groupPad * 2) / built.series.length;

    var parts = [open(c, 'Bar chart', categoryDesc('Bar chart', built, c), seriesDefs(c, built.series.map(function (s) { return s.color; }))), titleEl(c), axes(c, maxVal, built.categories), yAxisLabel(c, built.series[0] ? built.series[0].label : '')];
    built.categories.forEach(function (cat, i) {
      built.series.forEach(function (s, si) {
        var val = s.values[i];
        var barH = (val / maxVal) * plotH;
        var x = PAD.left + slot * i + groupPad + barW * si;
        var y = PAD.top + plotH - barH;
        parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 2, 1).toFixed(1) + '" height="' + Math.max(barH, 0).toFixed(1) + '" fill="' + seriesFill(c, s.color, si) + '" rx="2"/>');
        if (s.errors && s.errors[i]) parts.push(errorBar(x + (barW - 2) / 2, y, (s.errors[i] / maxVal) * plotH));
        if (c.showValues && val !== 0) {
          parts.push('<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#16222e">' + formatNum(val) + '</text>');
        }
      });
    });
    parts.push(seriesLegend(c, built.series));
    parts.push('</svg>');
    return parts.join('');
  }

  function line(built, o) {
    var c = chartOpts(o), W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var maxVal = maxOf(built.series);
    var n = built.categories.length;
    var slot = plotW / Math.max(n - 1, 1);

    var parts = [open(c, 'Line chart', categoryDesc('Line chart', built, c)), titleEl(c), axes(c, maxVal, built.categories), yAxisLabel(c, built.series[0] ? built.series[0].label : '')];
    built.series.forEach(function (s) {
      var pts = s.values.map(function (v, i) {
        var x = n === 1 ? PAD.left + plotW / 2 : PAD.left + slot * i;
        var y = PAD.top + plotH - (v / maxVal) * plotH;
        return [x, y];
      });
      var dashAttr = s.dash ? ' stroke-dasharray="' + s.dash + '"' : '';
      parts.push('<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2.5"' + dashAttr + '/>');
      pts.forEach(function (p, i) {
        if (s.errors && s.errors[i]) parts.push(errorBar(p[0], p[1], (s.errors[i] / maxVal) * plotH));
        parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + s.color + '"/>');
        if (c.showValues) {
          parts.push('<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 9).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#16222e">' + formatNum(s.values[i]) + '</text>');
        }
      });
    });
    parts.push(seriesLegend(c, built.series));
    parts.push('</svg>');
    return parts.join('');
  }

  function pie(built, o) {
    var c = chartOpts(o), W = c.W, H = c.H;
    var s = built.series[0];
    var total = s.values.reduce(function (a, b) { return a + Math.max(b, 0); }, 0);
    var cx = W / 2, cy = H / 2 + 6, r = Math.min(W, H) * 0.28;
    var colors = built.categories.map(function (cat, i) { return c.palette[i % c.palette.length]; });
    var shares = built.categories.map(function (cat, i) {
      return String(cat) + ' ' + formatNum(s.values[i]) + (total > 0 ? ' (' + Math.round(Math.max(s.values[i], 0) / total * 100) + '%)' : '');
    });
    var desc = 'Pie chart of ' + (s.label || 'values') + ' with ' + shares.length + ' slice' + (shares.length === 1 ? '' : 's') + ': ' + listCap(shares, 12) + '.';
    var parts = [open(c, 'Pie chart', desc, seriesDefs(c, colors)), titleEl(c)];
    if (total <= 0) { parts.push('</svg>'); return parts.join(''); }
    var angle = -Math.PI / 2;
    built.categories.forEach(function (cat, i) {
      var val = Math.max(s.values[i], 0);
      var frac = val / total;
      var next = angle + frac * Math.PI * 2;
      var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(next), y2 = cy + r * Math.sin(next);
      var largeArc = frac > 0.5 ? 1 : 0;
      if (frac > 0) {
        parts.push('<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' Z" fill="' + seriesFill(c, colors[i], i) + '" stroke="#fff" stroke-width="1.5"/>');
      }
      if (c.showValues && frac > 0.02) {
        var midAngle = angle + frac * Math.PI;
        var lx = cx + r * 0.68 * Math.cos(midAngle), ly = cy + r * 0.68 * Math.sin(midAngle);
        /* The label sits on the slice, so its colour is chosen against the slice (white on the
           yellow slice was 1.6:1). On a hatched slice the label gets a backing plate instead. */
        var onHatch = c.grayscale && HATCHES[i % HATCHES.length];
        var fill = /^#[0-9a-f]{6}$/i.test(colors[i]) ? textColorFor(colors[i]) : '#ffffff';
        var label = Math.round(frac * 100) + '%';
        if (onHatch) parts.push('<rect x="' + (lx - 14).toFixed(1) + '" y="' + (ly - 11).toFixed(1) + '" width="28" height="16" rx="3" fill="#ffffff"/>');
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="' + (onHatch ? INK_HEX : fill) + '" font-weight="600">' + label + '</text>');
      }
      angle = next;
    });
    parts.push(legendItems(c, built.categories.map(function (cat, i) { return { label: String(cat), fill: seriesFill(c, colors[i], i) }; })));
    parts.push('</svg>');
    return parts.join('');
  }

  /* ---------- Step 2: logarithmic axes (the scatter's xScale / yScale: 'log', base 10) ---------- */

  function logLabel(v) {
    if (v >= 1000) return formatNum(v);
    if (v >= 0.01) return String(v);
    return '1e' + Math.round(Math.log10(v));
  }

  /* [lowest, highest] power of ten that holds the values; one decade wide at least */
  function logDomain(vals) {
    vals = vals.filter(function (v) { return v > 0 && isFinite(v); });
    if (!vals.length) return [0, 1];
    var lo = Math.floor(Math.log10(Math.min.apply(null, vals))), hi = Math.ceil(Math.log10(Math.max.apply(null, vals)));
    return [lo, hi === lo ? lo + 1 : hi];
  }

  /* gridlines at every decade (labelled) and at 2 and 5 of each (faint, unlabelled) */
  function logTicks(d) {
    var out = [];
    for (var e = d[0]; e <= d[1]; e++) {
      out.push({ e: e, v: Math.pow(10, e), major: true });
      if (e < d[1]) { out.push({ e: e + Math.log10(2), v: 2 * Math.pow(10, e), major: false }); out.push({ e: e + Math.log10(5), v: 5 * Math.pow(10, e), major: false }); }
    }
    return out;
  }

  function logYAxis(c, d) {
    var PAD = c.pad, plotH = c.H - PAD.top - PAD.bottom, parts = [];
    logTicks(d).forEach(function (t) {
      var y = PAD.top + plotH - ((t.e - d[0]) / (d[1] - d[0])) * plotH;
      parts.push('<line x1="' + PAD.left + '" y1="' + y.toFixed(1) + '" x2="' + (c.W - PAD.right) + '" y2="' + y.toFixed(1) + '" stroke="' + (t.major ? '#e1e5ea' : '#f0f2f5') + '" stroke-width="1"/>');
      if (t.major) parts.push('<text x="' + (PAD.left - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#5b6b78">' + logLabel(t.v) + '</text>');
    });
    parts.push('<line x1="' + PAD.left + '" y1="' + PAD.top + '" x2="' + PAD.left + '" y2="' + (PAD.top + plotH) + '" stroke="#c7cfd6" stroke-width="1.5"/>');
    parts.push('<line x1="' + PAD.left + '" y1="' + (PAD.top + plotH) + '" x2="' + (c.W - PAD.right) + '" y2="' + (PAD.top + plotH) + '" stroke="#c7cfd6" stroke-width="1.5"/>');
    return parts.join('');
  }

  function logXAxis(c, d) {
    var PAD = c.pad, plotW = c.W - PAD.left - PAD.right, plotH = c.H - PAD.top - PAD.bottom, parts = [];
    logTicks(d).forEach(function (t) {
      var x = PAD.left + ((t.e - d[0]) / (d[1] - d[0])) * plotW;
      parts.push('<line x1="' + x.toFixed(1) + '" y1="' + PAD.top + '" x2="' + x.toFixed(1) + '" y2="' + (PAD.top + plotH) + '" stroke="' + (t.major ? '#e1e5ea' : '#f0f2f5') + '" stroke-width="1"/>');
      if (t.major) parts.push('<text x="' + x.toFixed(1) + '" y="' + (PAD.top + plotH + 16) + '" text-anchor="middle" font-size="10" fill="#5b6b78">' + logLabel(t.v) + '</text>');
    });
    return parts.join('');
  }

  /* ---------- Step 4: the annotation layer (the scatter's `notes`) ----------

     A note is placed in DATA coordinates, so it stays on its point when the axes change:
       { type: 'region',  x1, x2, y1?, y2?, text }     a shaded, hatched band (full height without y1/y2)
       { type: 'arrow',   x1, y1, x2, y2, text }       from the tail (x1, y1) to the head (x2, y2); text at the tail
       { type: 'callout', x, y, text }                 a labelled box with a leader to the point
     cleanNotes() is the only way a list gets in: at most 12, numbers that are finite, text escaped on the way out
     and capped at 60 characters, anything else dropped. A note that does not fit the plot (outside it, or at or
     below 0 on a log axis) is not drawn and is counted in the <desc>; a region is clipped to the plot. */

  var NOTE_MAX = 12, NOTE_TEXT_MAX = 60;

  function cleanNotes(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (n) {
      if (out.length >= NOTE_MAX || !n || typeof n !== 'object') return;
      var text = String(n.text == null ? '' : n.text).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, NOTE_TEXT_MAX);
      var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : null; };
      if (n.type === 'region') {
        var a = num(n.x1), b = num(n.x2);
        if (a === null || b === null) return;
        var r = { type: 'region', x1: Math.min(a, b), x2: Math.max(a, b), text: text };
        var c1 = num(n.y1), c2 = num(n.y2);
        if (c1 !== null && c2 !== null) { r.y1 = Math.min(c1, c2); r.y2 = Math.max(c1, c2); }
        out.push(r);
      } else if (n.type === 'arrow') {
        var q = [num(n.x1), num(n.y1), num(n.x2), num(n.y2)];
        if (q.indexOf(null) !== -1 || (q[0] === q[2] && q[1] === q[3])) return;
        out.push({ type: 'arrow', x1: q[0], y1: q[1], x2: q[2], y2: q[3], text: text });
      } else if (n.type === 'callout') {
        var x = num(n.x), y = num(n.y);
        if (x === null || y === null || !text) return;
        out.push({ type: 'callout', x: x, y: y, text: text });
      }
    });
    return out;
  }

  /* env: { c, toX, toY, xLo, xHi, yLo, yHi, xLog, yLog } -> { defs, under, over, desc } */
  function noteLayer(notes, env) {
    var c = env.c, PAD = c.pad, left = PAD.left, right = c.W - PAD.right, top = PAD.top, bottom = c.H - PAD.bottom;
    var under = [], over = [], sentences = [], skipped = 0, hasRegion = false, ink = '#16222e';
    function fits(x, y) {   // on a log axis xLo and yLo are above 0, so a note at or below 0 is outside
      return x >= env.xLo && x <= env.xHi && y >= env.yLo && y <= env.yHi;
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    cleanNotes(notes).forEach(function (n, i) {
      var t = escapeXml(n.text);
      if (n.type === 'region') {
        var x1 = clamp(n.x1, env.xLo, env.xHi), x2 = clamp(n.x2, env.xLo, env.xHi);
        var hasY = 'y1' in n;
        var y1 = hasY ? clamp(n.y1, env.yLo, env.yHi) : env.yLo, y2 = hasY ? clamp(n.y2, env.yLo, env.yHi) : env.yHi;
        if (!(x2 > x1) || !(y2 > y1)) { skipped++; return; }
        hasRegion = true;
        var px1 = env.toX(x1), px2 = env.toX(x2), py1 = env.toY(y2), py2 = env.toY(y1);
        under.push('<rect x="' + px1.toFixed(1) + '" y="' + py1.toFixed(1) + '" width="' + (px2 - px1).toFixed(1) + '" height="' + (py2 - py1).toFixed(1) + '" fill="url(#' + c.idPrefix + '-nr)" stroke="#8a97a3" stroke-width="1" stroke-dasharray="2,3"/>');
        if (n.text) over.push('<text x="' + (px1 + 4).toFixed(1) + '" y="' + (py1 + 12).toFixed(1) + '" font-size="10" font-weight="600" fill="' + ink + '">' + t + '</text>');
        sentences.push('Shaded region ' + (hasY ? 'from ' + formatNum(n.x1) + ' to ' + formatNum(n.x2) + ' across, ' + formatNum(n.y1) + ' to ' + formatNum(n.y2) + ' up' : 'across ' + formatNum(n.x1) + ' to ' + formatNum(n.x2)) + (n.text ? ': ' + n.text : '') + '.');
      } else if (n.type === 'arrow') {
        if (!fits(n.x1, n.y1) || !fits(n.x2, n.y2)) { skipped++; return; }
        var ax = env.toX(n.x1), ay = env.toY(n.y1), bx = env.toX(n.x2), by = env.toY(n.y2);
        var ang = Math.atan2(by - ay, bx - ax), hl = 9, spread = 0.5;
        var h1 = [bx - hl * Math.cos(ang - spread), by - hl * Math.sin(ang - spread)], h2 = [bx - hl * Math.cos(ang + spread), by - hl * Math.sin(ang + spread)];
        over.push('<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' + bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="' + ink + '" stroke-width="1.6"/>');
        over.push('<polygon points="' + bx.toFixed(1) + ',' + by.toFixed(1) + ' ' + h1[0].toFixed(1) + ',' + h1[1].toFixed(1) + ' ' + h2[0].toFixed(1) + ',' + h2[1].toFixed(1) + '" fill="' + ink + '"/>');
        if (n.text) {
          var ty = ay - 8 < top + 10 ? ay + 16 : ay - 8;
          var anchor = ax > right - 80 ? 'end' : ax < left + 80 ? 'start' : 'middle';
          over.push('<text x="' + ax.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + anchor + '" font-size="10" font-weight="600" fill="' + ink + '" stroke="#ffffff" stroke-width="3" paint-order="stroke">' + t + '</text>');
        }
        sentences.push('Arrow from ' + formatNum(n.x1) + ', ' + formatNum(n.y1) + ' to ' + formatNum(n.x2) + ', ' + formatNum(n.y2) + (n.text ? ': ' + n.text : '') + '.');
      } else {
        if (!fits(n.x, n.y)) { skipped++; return; }
        var cx = env.toX(n.x), cy = env.toY(n.y);
        var w = Math.min(n.text.length * 5.8 + 14, 260), h = 20;
        var bxp = cx + 16 + w > right ? cx - 16 - w : cx + 16;
        var byp = cy - 30 < top ? cy + 12 : cy - 30;
        over.push('<line x1="' + cx.toFixed(1) + '" y1="' + cy.toFixed(1) + '" x2="' + (bxp + w / 2).toFixed(1) + '" y2="' + (byp + h / 2).toFixed(1) + '" stroke="' + ink + '" stroke-width="1.2"/>');
        over.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="7" fill="none" stroke="' + ink + '" stroke-width="1.4"/>');
        over.push('<rect x="' + bxp.toFixed(1) + '" y="' + byp.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h + '" rx="4" fill="#ffffff" stroke="' + ink + '" stroke-width="1.2"/>');
        over.push('<text x="' + (bxp + w / 2).toFixed(1) + '" y="' + (byp + 14).toFixed(1) + '" text-anchor="middle" font-size="10" fill="' + ink + '">' + t + '</text>');
        sentences.push('Callout at ' + formatNum(n.x) + ', ' + formatNum(n.y) + ': ' + n.text + '.');
      }
    });
    if (skipped) sentences.push(skipped + ' note' + (skipped === 1 ? '' : 's') + ' outside the plot ' + (skipped === 1 ? 'is' : 'are') + ' not drawn.');
    return {
      defs: hasRegion ? '<defs><pattern id="' + c.idPrefix + '-nr" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(108,142,245,.14)"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(31,36,48,.35)" stroke-width="1.2"/></pattern></defs>' : '',
      under: under.join(''), over: over.join(''), desc: sentences.length ? ' ' + sentences.join(' ') : ''
    };
  }

  /* ---------- Step 3: more than one series on a scatter (shape as well as colour) ---------- */

  var SHAPES = ['circle', 'square', 'triangle', 'diamond'];

  function markerEl(shape, cx, cy, fill, r, opacity) {
    var a = ' fill="' + fill + '" opacity="' + opacity + '"';
    if (shape === 'square') return '<rect x="' + (cx - r).toFixed(1) + '" y="' + (cy - r).toFixed(1) + '" width="' + (2 * r) + '" height="' + (2 * r) + '"' + a + '/>';
    if (shape === 'triangle') return '<polygon points="' + cx.toFixed(1) + ',' + (cy - r - 1).toFixed(1) + ' ' + (cx + r + 1).toFixed(1) + ',' + (cy + r).toFixed(1) + ' ' + (cx - r - 1).toFixed(1) + ',' + (cy + r).toFixed(1) + '"' + a + '/>';
    if (shape === 'diamond') return '<polygon points="' + cx.toFixed(1) + ',' + (cy - r - 1).toFixed(1) + ' ' + (cx + r + 1).toFixed(1) + ',' + cy.toFixed(1) + ' ' + cx.toFixed(1) + ',' + (cy + r + 1).toFixed(1) + ' ' + (cx - r - 1).toFixed(1) + ',' + cy.toFixed(1) + '"' + a + '/>';
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '"' + a + '/>';
  }

  /* the legend of a multi-series scatter: the series' own marker, its name, and its R² when a fit is drawn */
  function markerLegend(c, items) {
    var parts = ['<g transform="translate(0,' + (c.H - 26) + ')">'], curX = c.pad.left;
    items.forEach(function (it) {
      var text = it.label.length > 22 ? it.label.slice(0, 21) + '…' : it.label;
      var w = Math.min(text.length * 6 + 28, 190);
      if (curX + w > c.W - c.pad.right) return;
      parts.push(markerEl(it.shape, curX + 5, -4, it.color, 4, 1));
      parts.push('<text x="' + (curX + 13) + '" y="0" font-size="10" fill="#16222e">' + escapeXml(text) + '</text>');
      curX += w;
    });
    parts.push('</g>');
    return parts.join('');
  }

  function scatter(sc, o) {
    var c = chartOpts(o), W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var xLog = c.xScale === 'log', yLog = c.yScale === 'log';
    var multi = sc.series && sc.series.length > 1 ? sc.series : null;
    var kept = function (p) { return (!xLog || p.x > 0) && (!yLog || p.y > 0); };
    var sets = multi ? multi.map(function (se) { return { label: se.label, points: xLog || yLog ? se.points.filter(kept) : se.points, all: se.points.length }; }) : null;
    var pts = multi ? [].concat.apply([], sets.map(function (se) { return se.points; })) : sc.points, dropped = 0;
    if (multi) { dropped = sets.reduce(function (n, se) { return n + se.all - se.points.length; }, 0); }
    else if (xLog || yLog) {
      pts = sc.points.filter(kept);
      dropped = sc.points.length - pts.length;
    }
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var maxX = niceMax(Math.max.apply(null, xs.concat([0])) * 1.1);
    var maxY = niceMax(Math.max.apply(null, ys.concat([0])) * 1.15);
    var minX = Math.min.apply(null, xs.concat([0]));
    var xRange = maxX - Math.min(minX, 0) || 1;
    var xOrigin = Math.min(minX, 0);
    var xd = xLog ? logDomain(xs) : null, yd = yLog ? logDomain(ys) : null;
    var xLo = xLog ? Math.pow(10, xd[0]) : xOrigin, xHi = xLog ? Math.pow(10, xd[1]) : maxX;
    var yLo = yLog ? Math.pow(10, yd[0]) : 0, yHi = yLog ? Math.pow(10, yd[1]) : maxY;

    function toX(v) {
      if (xLog) return PAD.left + ((Math.log10(v) - xd[0]) / (xd[1] - xd[0])) * plotW;
      return PAD.left + ((v - xOrigin) / xRange) * plotW;
    }
    function toY(v) {
      if (yLog) return PAD.top + plotH - ((Math.log10(v) - yd[0]) / (yd[1] - yd[0])) * plotH;
      return PAD.top + plotH - (v / maxY) * plotH;
    }

    var trend = c.trend && !multi ? linearRegression(pts) : null;
    var desc = 'Scatter plot of ' + sc.yLabel + ' against ' + sc.xLabel + ', ' + pts.length + ' point' + (pts.length === 1 ? '' : 's') + '.';
    if (pts.length) desc += ' ' + sc.xLabel + ' runs from ' + formatNum(Math.min.apply(null, xs)) + ' to ' + formatNum(Math.max.apply(null, xs)) + '; ' + sc.yLabel + ' from ' + formatNum(Math.min.apply(null, ys)) + ' to ' + formatNum(Math.max.apply(null, ys)) + '.';
    if (xLog || yLog) {
      desc += ' ' + (xLog && yLog ? 'Both axes are logarithmic' : xLog ? 'The horizontal axis is logarithmic' : 'The vertical axis is logarithmic') + ', in powers of ten.';
      if (dropped) desc += ' ' + dropped + ' point' + (dropped === 1 ? ' with a zero or negative value is' : 's with a zero or negative value are') + ' not plotted.';
    }
    if (multi) {
      desc = 'Scatter plot of ' + sets.length + ' series against ' + sc.xLabel + ', ' + pts.length + ' point' + (pts.length === 1 ? '' : 's') + ': ' +
        sets.map(function (se) { return (se.label || 'Series') + ' (' + se.points.length + ')'; }).join(', ') + '.';
      if (pts.length) desc += ' ' + sc.xLabel + ' runs from ' + formatNum(Math.min.apply(null, xs)) + ' to ' + formatNum(Math.max.apply(null, xs)) + '; values from ' + formatNum(Math.min.apply(null, ys)) + ' to ' + formatNum(Math.max.apply(null, ys)) + '.';
      if (xLog || yLog) {
        desc += ' ' + (xLog && yLog ? 'Both axes are logarithmic' : xLog ? 'The horizontal axis is logarithmic' : 'The vertical axis is logarithmic') + ', in powers of ten.';
        if (dropped) desc += ' ' + dropped + ' point' + (dropped === 1 ? ' with a zero or negative value is' : 's with a zero or negative value are') + ' not plotted.';
      }
    }
    var fit = c.trend && !multi && c.fit && typeof c.fit.predict === 'function' ? c.fit : null;
    if (fit) trend = null;
    if (!fit && trend && (xLog || yLog)) {
      /* a straight line is not straight on a log axis: draw it as the curve it is */
      var tr = trend, teq = 'y = ' + round2(tr.slope) + 'x ' + (tr.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(tr.intercept));
      fit = { predict: function (x) { return tr.slope * x + tr.intercept; }, label: teq + '  (R² = ' + round2(tr.r2) + ')', desc: 'Trend line ' + teq + ', R squared ' + round2(tr.r2) + '.' };
      trend = null;
    }
    if (fit) desc += ' ' + fit.desc;
    if (trend) desc += ' Trend line y = ' + round2(trend.slope) + 'x ' + (trend.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(trend.intercept)) + ', R squared ' + round2(trend.r2) + '.';

    var layer = c.notes && c.notes.length ? noteLayer(c.notes, { c: c, toX: toX, toY: toY, xLo: xLo, xHi: xHi, yLo: yLo, yHi: yHi, xLog: xLog, yLog: yLog }) : null;
    if (layer) desc += layer.desc;
    var parts = [open(c, 'Scatter plot', desc, layer && layer.defs), titleEl(c), yLog ? logYAxis(c, yd) : axes(c, maxY, null), yAxisLabel(c, multi ? '' : sc.yLabel)];
    if (xLog) parts.push(logXAxis(c, xd));
    parts.push('<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="#5b6b78">' + escapeXml(sc.xLabel) + '</text>');
    if (layer) parts.push(layer.under);

    if (trend) {
      var lineX1 = xOrigin, lineX2 = maxX;
      var lineY1 = trend.slope * lineX1 + trend.intercept;
      var lineY2 = trend.slope * lineX2 + trend.intercept;
      parts.push('<line x1="' + toX(lineX1).toFixed(1) + '" y1="' + toY(lineY1).toFixed(1) + '" x2="' + toX(lineX2).toFixed(1) + '" y2="' + toY(lineY2).toFixed(1) + '" stroke="' + c.trendColor + '" stroke-width="2" stroke-dasharray="5,4"/>');
      var eq = 'y = ' + round2(trend.slope) + 'x ' + (trend.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(trend.intercept)) + '  (R² = ' + round2(trend.r2) + ')';
      parts.push('<text x="' + (W - PAD.right) + '" y="' + (PAD.top - 6) + '" text-anchor="end" font-size="10" fill="' + c.trendColor + '">' + escapeXml(eq) + '</text>');
    }

    if (fit) {
      /* a curve: sampled across the plot (evenly in the axis's own scale), broken wherever it leaves it or is not a number */
      var segs = [], cur = [], steps = 120;
      for (var si = 0; si <= steps; si++) {
        var fx = xLog ? Math.pow(10, xd[0] + (xd[1] - xd[0]) * si / steps) : xLo + (xHi - xLo) * si / steps, fy = fit.predict(fx);
        if (isFinite(fy) && fy >= yLo && fy <= yHi) cur.push(toX(fx).toFixed(1) + ',' + toY(fy).toFixed(1));
        else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      segs.forEach(function (sg) {
        if (sg.length > 1) parts.push('<polyline points="' + sg.join(' ') + '" fill="none" stroke="' + c.trendColor + '" stroke-width="2" stroke-dasharray="5,4"/>');
      });
      parts.push('<text x="' + (W - PAD.right) + '" y="' + (PAD.top - 6) + '" text-anchor="end" font-size="10" fill="' + c.trendColor + '">' + escapeXml(fit.label) + '</text>');
    }

    if (multi) {
      var legend = [];
      sets.forEach(function (se, si) {
        var color = c.palette[si % c.palette.length], shape = SHAPES[si % SHAPES.length], sf = null;
        if (c.trend) {
          sf = c.fits && c.fits[si] && typeof c.fits[si].predict === 'function' ? c.fits[si] : null;
          if (!sf) {
            var lr = linearRegression(se.points);
            if (lr) sf = { predict: function (x) { return lr.slope * x + lr.intercept; }, r2: lr.r2, label: 'y = ' + round2(lr.slope) + 'x ' + (lr.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(lr.intercept)), desc: 'linear fit y = ' + round2(lr.slope) + 'x ' + (lr.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(lr.intercept)) + ', R squared ' + round2(lr.r2) };
          }
        }
        if (sf) {
          var sgs = [], sc2 = [], n2 = 120;
          for (var k = 0; k <= n2; k++) {
            var gx = xLog ? Math.pow(10, xd[0] + (xd[1] - xd[0]) * k / n2) : xLo + (xHi - xLo) * k / n2, gy = sf.predict(gx);
            if (isFinite(gy) && gy >= yLo && gy <= yHi) sc2.push(toX(gx).toFixed(1) + ',' + toY(gy).toFixed(1));
            else if (sc2.length) { sgs.push(sc2); sc2 = []; }
          }
          if (sc2.length) sgs.push(sc2);
          sgs.forEach(function (sg) { if (sg.length > 1) parts.push('<polyline points="' + sg.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-dasharray="5,4"/>'); });
          desc += ' ' + (se.label || 'Series') + ': ' + sf.desc + (/\.$/.test(sf.desc) ? '' : '.');
        }
        se.points.forEach(function (p) { parts.push(markerEl(shape, toX(p.x), toY(p.y), color, 4, 0.8)); });
        legend.push({ label: (se.label || 'Series') + (sf && sf.r2 != null ? ' (R² ' + round2(sf.r2) + ')' : ''), shape: shape, color: color });
      });
      parts.push(markerLegend(c, legend));
      parts[0] = open(c, 'Scatter plot', desc, layer && layer.defs);
    } else pts.forEach(function (p) {
      parts.push('<circle cx="' + toX(p.x).toFixed(1) + '" cy="' + toY(p.y).toFixed(1) + '" r="4" fill="' + c.pointColor + '" opacity="0.75"/>');
    });
    if (layer) parts.push(layer.over);
    parts.push('</svg>');
    return parts.join('');
  }

  function box(built, o) {
    var c = chartOpts(o), W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var boxes = built.boxes;
    var maxVal = niceMax(Math.max.apply(null, boxes.map(function (b) { return b.max; })) * 1.15);
    var n = boxes.length;
    var slot = plotW / n;
    var boxW = Math.min(slot * 0.5, 70);

    function toY(v) { return PAD.top + plotH - (v / maxVal) * plotH; }

    var summaries = boxes.map(function (b) {
      return b.label + ': median ' + formatNum(b.median) + ', middle half ' + formatNum(b.q1) + ' to ' + formatNum(b.q3) + ', range ' + formatNum(b.min) + ' to ' + formatNum(b.max);
    });
    var desc = 'Box plot with ' + n + ' box' + (n === 1 ? '' : 'es') + '. ' + listCap(summaries, 8) + '.';
    var parts = [open(c, 'Box plot', desc, seriesDefs(c, boxes.map(function (b) { return b.color; }))), titleEl(c), axes(c, maxVal, boxes.map(function (b) { return b.label; })), yAxisLabel(c, '')];
    boxes.forEach(function (b, i) {
      var x = PAD.left + slot * i + slot / 2;
      var yMin = toY(b.min), yMax = toY(b.max), yQ1 = toY(b.q1), yQ3 = toY(b.q3), yMed = toY(b.median);
      var capW = boxW * 0.5;

      parts.push('<line x1="' + x.toFixed(1) + '" y1="' + yMax.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + yMin.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<line x1="' + (x - capW / 2).toFixed(1) + '" y1="' + yMax.toFixed(1) + '" x2="' + (x + capW / 2).toFixed(1) + '" y2="' + yMax.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<line x1="' + (x - capW / 2).toFixed(1) + '" y1="' + yMin.toFixed(1) + '" x2="' + (x + capW / 2).toFixed(1) + '" y2="' + yMin.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<rect x="' + (x - boxW / 2).toFixed(1) + '" y="' + yQ3.toFixed(1) + '" width="' + boxW.toFixed(1) + '" height="' + Math.max(yQ1 - yQ3, 1).toFixed(1) + '" fill="' + b.color + '" fill-opacity="0.25" stroke="' + b.color + '" stroke-width="1.5" rx="2"/>');
      parts.push('<line x1="' + (x - boxW / 2).toFixed(1) + '" y1="' + yMed.toFixed(1) + '" x2="' + (x + boxW / 2).toFixed(1) + '" y2="' + yMed.toFixed(1) + '" stroke="' + b.color + '" stroke-width="2.5"/>');
      if (c.showValues) {
        var lx = x + boxW / 2 + 5;
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + (yMax + 3).toFixed(1) + '" font-size="8.5" fill="#16222e">max ' + formatNum(b.max) + '</text>');
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + (yQ3 + 3).toFixed(1) + '" font-size="8.5" fill="#16222e">Q3 ' + formatNum(b.q3) + '</text>');
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + (yMed + 3).toFixed(1) + '" font-size="8.5" fill="#16222e" font-weight="600">med ' + formatNum(b.median) + '</text>');
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + (yQ1 + 3).toFixed(1) + '" font-size="8.5" fill="#16222e">Q1 ' + formatNum(b.q1) + '</text>');
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + (yMin + 3).toFixed(1) + '" font-size="8.5" fill="#16222e">min ' + formatNum(b.min) + '</text>');
      }
    });
    parts.push('</svg>');
    return parts.join('');
  }

  /** The axes, title and category labels with nothing plotted: the handout a student plots by hand. */
  function blankAxes(built, o) {
    var c = chartOpts(o);
    var maxVal = maxOf(built.series);
    var cats = built.categories.map(String);
    var desc = 'Blank chart axes for a worksheet. Categories: ' + listCap(cats, 12) + '. Vertical axis from 0 to ' + formatNum(maxVal) + '. Nothing is plotted.';
    return [open(c, 'Blank chart', desc), titleEl(c), axes(c, maxVal, built.categories), yAxisLabel(c, built.series[0] ? built.series[0].label : ''), '</svg>'].join('');
  }

  /* ---------- the browser half: rasterize, download, copy ---------- */

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadSvg(svgString, filenameBase) {
    downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), filenameBase + '.svg');
  }

  /** Rasterise a standalone SVG to a PNG blob at 2x on white (a transparent chart
      pasted into a dark document is unreadable). The download and the copy share it,
      so the image on the clipboard is byte-for-byte the image on disk. */
  function toPngBlob(svgString, w, h, onBlob, onError) {
    var img = new Image();
    var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);
    img.onload = function () {
      var scale = 2;
      var canvas = document.createElement('canvas');
      canvas.width = w * scale; canvas.height = h * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        if (blob) onBlob(blob); else onError();
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); onError(); };
    img.src = url;
  }

  function downloadPng(svgString, filenameBase, w, h) {
    toPngBlob(svgString, w, h,
      function (blob) { downloadBlob(blob, filenameBase + '.png'); },
      function () { alert('Could not render a PNG — try downloading the SVG instead.'); });
  }

  /* The status goes next to the button, not into an alert: it is a "did that work?"
     answer, not something to dismiss. It is announced (role=status), a success
     clears itself, a failure stays until the next attempt replaces it. */
  var statusTimers = new WeakMap();

  function setStatus(row, text, isError) {
    if (!row) return;
    var el = row.querySelector('.copy-status');
    if (!el) {
      el = document.createElement('span');
      el.className = 'copy-status';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      row.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('error', !!isError);

    var pending = statusTimers.get(el);
    if (pending) clearTimeout(pending);
    if (!isError && text && text.indexOf('…') === -1) {
      statusTimers.set(el, setTimeout(function () {
        if (el.textContent === text) el.textContent = '';
      }, 6000));
    }
  }

  /** Put the chart on the clipboard as an image. Clipboard image writes need a secure
      context and are unsupported or permission-gated in places, so every failure falls
      back to the PNG download and says so. The try/catch is as well as the rejection
      handler: a partly implemented API throws from the ClipboardItem constructor
      synchronously instead of rejecting. */
  function copyImage(svgString, filenameBase, w, h, row) {
    var canWrite = !!(navigator.clipboard && window.ClipboardItem && navigator.clipboard.write);
    setStatus(row, 'Copying…');
    toPngBlob(svgString, w, h, function (blob) {
      if (!canWrite) {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'This browser can’t put an image on the clipboard — downloaded the PNG instead.', true);
        return;
      }
      var wrote;
      try {
        wrote = navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      } catch (e) {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'This browser refused the clipboard — downloaded the PNG instead.', true);
        return;
      }
      Promise.resolve(wrote).then(function () {
        setStatus(row, 'Copied — paste it straight into your document.');
      }, function () {
        downloadBlob(blob, filenameBase + '.png');
        setStatus(row, 'The clipboard was blocked here — downloaded the PNG instead.', true);
      });
    }, function () {
      setStatus(row, 'Could not render the chart as an image. The SVG download still works.', true);
    });
  }

  root.ChartSvg = {
    LETTER_HEX: LETTER_HEX,
    ZERO_HEX: ZERO_HEX,
    INK_HEX: INK_HEX,
    escapeXml: escapeXml,
    fmt: fmt,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    textColorFor: textColorFor,
    hatchPattern: hatchPattern,
    nCaption: nCaption,
    stackedBar: stackedBar,
    histogram: histogram,
    niceMax: niceMax,
    formatNum: formatNum,
    round2: round2,
    cleanNotes: cleanNotes,
    linearRegression: linearRegression,
    bar: bar,
    line: line,
    pie: pie,
    scatter: scatter,
    box: box,
    blankAxes: blankAxes,
    toPngBlob: toPngBlob,
    downloadBlob: downloadBlob,
    downloadSvg: downloadSvg,
    downloadPng: downloadPng,
    setStatus: setStatus,
    copyImage: copyImage
  };
})(window);
