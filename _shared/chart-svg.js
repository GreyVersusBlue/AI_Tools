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
         trendColor, trend (scatter: draw the fit), grayscale (hatch per series),
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
      kind: o.kind || ''
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

  function scatter(sc, o) {
    var c = chartOpts(o), W = c.W, H = c.H, PAD = c.pad;
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var xs = sc.points.map(function (p) { return p.x; }), ys = sc.points.map(function (p) { return p.y; });
    var maxX = niceMax(Math.max.apply(null, xs.concat([0])) * 1.1);
    var maxY = niceMax(Math.max.apply(null, ys.concat([0])) * 1.15);
    var minX = Math.min.apply(null, xs.concat([0]));
    var xRange = maxX - Math.min(minX, 0) || 1;
    var xOrigin = Math.min(minX, 0);

    function toX(v) { return PAD.left + ((v - xOrigin) / xRange) * plotW; }
    function toY(v) { return PAD.top + plotH - (v / maxY) * plotH; }

    var trend = c.trend ? linearRegression(sc.points) : null;
    var desc = 'Scatter plot of ' + sc.yLabel + ' against ' + sc.xLabel + ', ' + sc.points.length + ' point' + (sc.points.length === 1 ? '' : 's') + '.';
    if (sc.points.length) desc += ' ' + sc.xLabel + ' runs from ' + formatNum(Math.min.apply(null, xs)) + ' to ' + formatNum(Math.max.apply(null, xs)) + '; ' + sc.yLabel + ' from ' + formatNum(Math.min.apply(null, ys)) + ' to ' + formatNum(Math.max.apply(null, ys)) + '.';
    if (trend) desc += ' Trend line y = ' + round2(trend.slope) + 'x ' + (trend.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(trend.intercept)) + ', R squared ' + round2(trend.r2) + '.';

    var parts = [open(c, 'Scatter plot', desc), titleEl(c), axes(c, maxY, null), yAxisLabel(c, sc.yLabel)];
    parts.push('<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="#5b6b78">' + escapeXml(sc.xLabel) + '</text>');

    if (trend) {
      var lineX1 = xOrigin, lineX2 = maxX;
      var lineY1 = trend.slope * lineX1 + trend.intercept;
      var lineY2 = trend.slope * lineX2 + trend.intercept;
      parts.push('<line x1="' + toX(lineX1).toFixed(1) + '" y1="' + toY(lineY1).toFixed(1) + '" x2="' + toX(lineX2).toFixed(1) + '" y2="' + toY(lineY2).toFixed(1) + '" stroke="' + c.trendColor + '" stroke-width="2" stroke-dasharray="5,4"/>');
      var eq = 'y = ' + round2(trend.slope) + 'x ' + (trend.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(trend.intercept)) + '  (R² = ' + round2(trend.r2) + ')';
      parts.push('<text x="' + (W - PAD.right) + '" y="' + (PAD.top - 6) + '" text-anchor="end" font-size="10" fill="' + c.trendColor + '">' + escapeXml(eq) + '</text>');
    }

    sc.points.forEach(function (p) {
      parts.push('<circle cx="' + toX(p.x).toFixed(1) + '" cy="' + toY(p.y).toFixed(1) + '" r="4" fill="' + c.pointColor + '" opacity="0.75"/>');
    });
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
