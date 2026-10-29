// _legacy-chart.mjs — 037's chart code exactly as it was inline in the page at v401, before
// Path 16 P1 moved it to _shared/chart-svg.js. FROZEN: do not edit it to follow the module;
// test:chart-svg-parity feeds both the same data and demands byte-identical SVG.
// Lines are 037-grade-distribution-visualizer.html 466-614 verbatim (only the exports added; escapeHtml, escapeAttr and computeOutliers left out, they are not chart code).

  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    var f = n.toFixed(d == null ? 1 : d);
    return f.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1') || f;
  }

  // Same sequential, colorblind-/print-safe ramp as the --gA..--gF CSS
  // variables above, duplicated here because the SVG exports are built as
  // plain strings and can't reference a CSS custom property.
  var LETTER_HEX = { A: '#08306b', B: '#2171b5', C: '#4292c6', D: '#6baed6', F: '#9ecae1' };
  var ZERO_HEX = '#6b6a63';

  var INK_HEX = '#1f2430';

  /** WCAG 2.x relative luminance of a #rrggbb string. */
  function relLuminance(hex) {
    var chan = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }

  function contrastRatio(l1, l2) {
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  var INK_LUM = relLuminance(INK_HEX);

  /** Picks readable label text (near-black or white) for a fill color,
   * instead of assuming white always works — the whole point of a
   * light-to-dark sequential palette is that some steps are light.
   *
   * This used to be a perceived-brightness guess with a 0.55 threshold, and
   * it got C (--gC, #4292c6) wrong in both themes: white on that blue is
   * 3.41:1, a serious axe color-contrast violation on the stacked bar since
   * the tool shipped, unseen because the site-wide sweep opens this page with
   * no scores and the bar never renders. Real WCAG contrast, both candidates,
   * better one wins: C now takes the dark ink at 4.55:1. */
  function textColorFor(hex) {
    var lum = relLuminance(hex);
    return contrastRatio(lum, INK_LUM) >= contrastRatio(lum, 1) ? INK_HEX : '#ffffff';
  }

  /** The <defs> hatch patterns shared by both SVG builders below — F and the
   * "zero" histogram bar both get a diagonal hatch as a second, non-color
   * signal on top of the palette, so they survive grayscale printing and
   * don't depend on hue perception at all. */
  function hatchDefs() {
    return '<defs>' +
      '<pattern id="hatchF" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<rect width="7" height="7" fill="' + LETTER_HEX.F + '"/>' +
        '<line x1="0" y1="0" x2="0" y2="7" stroke="rgba(31,36,48,.35)" stroke-width="3"/>' +
      '</pattern>' +
      '<pattern id="hatchZero" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<rect width="7" height="7" fill="' + ZERO_HEX + '"/>' +
        '<line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.45)" stroke-width="3"/>' +
      '</pattern>' +
      '</defs>';
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }


  /** "n=31 (2 excluded — blank/non-numeric)" — the same line the caller
   * embeds in every SVG export, so a downloaded or printed chart never loses
   * the count that decides whether the shape it's showing is trustworthy. */
  function nCaption(data) {
    var s = 'n = ' + data.stats.n;
    if (data.excluded) s += ' (' + data.excluded + ' excluded — blank/non-numeric)';
    return s;
  }

  /* Rebuilt as standalone SVG (distinct from the CSS flexbox bar shown on
     screen) so it can be downloaded as a self-contained file — a flexbox
     layout has no meaning outside this page's stylesheet. */
  function buildStackedBarSvg(data) {
    var W = 640, H = 168, pad = 20, barY = 46, barH = 40;
    var barW = W - pad * 2;
    var x = pad, legend = '', segs = '';
    var legendY = barY + barH + 34, lx = pad;
    data.letterOrder.forEach(function (l) {
      var count = data.letters[l];
      var pct = data.stats.n ? (count / data.stats.n * 100) : 0;
      var w = barW * (pct / 100);
      var fill = l === 'F' ? 'url(#hatchF)' : LETTER_HEX[l];
      var textFill = textColorFor(LETTER_HEX[l]);
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
      hatchDefs() +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + pad + '" y="18" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Letter-grade breakdown') + '</text>' +
      '<text x="' + pad + '" y="34" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<rect x="' + pad + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="none" stroke="#8c897f"/>' +
      segs + legend +
      '</svg>';
  }

  function buildHistogramSvg(data) {
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
      hatchDefs() +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<text x="' + padL + '" y="20" font-size="14" font-weight="700" font-family="Segoe UI, Arial, sans-serif" fill="#1f2430">' + escapeXml((data.name || 'Assignment') + ' — Score histogram (bucket width ' + data.bucketWidth + ')') + '</text>' +
      '<text x="' + padL + '" y="36" font-size="11" font-family="Segoe UI, Arial, sans-serif" fill="#6b6a63">' + escapeXml(nCaption(data)) + '</text>' +
      '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (padT + plotH) + '" stroke="#8c897f" stroke-width="1.5"/>' +
      bars + labels +
      '</svg>';
  }

  function buildBuckets(scores, width) {
    var w = Math.max(1, width || 10);
    var numBuckets = Math.max(1, Math.ceil(100 / w));
    var buckets = [];
    for (var i = 0; i < numBuckets; i++) {
      var start = i * w;
      var isLast = i === numBuckets - 1;
      buckets.push({
        start: start,
        end: start + w - 1,
        isLast: isLast,
        label: isLast ? (start + '–100+') : (start + '–' + (start + w - 1)),
        count: 0,
        isZero: false
      });
    }
    var zeroCount = 0;
    scores.forEach(function (s) {
      if (s === 0) { zeroCount++; return; }
      var idx = Math.floor(s / w);
      if (idx < 0) idx = 0;
      if (idx > numBuckets - 1) idx = numBuckets - 1;
      buckets[idx].count++;
    });
    if (zeroCount > 0) {
      var firstRegular = buckets[0];
      if (firstRegular.start === 0 && firstRegular.end > 0) firstRegular.label = '1–' + firstRegular.end;
      buckets.unshift({ start: 0, end: 0, isLast: false, label: '0', count: zeroCount, isZero: true });
    }
    return buckets;
  }


export { buildBuckets, fmt, relLuminance, contrastRatio, textColorFor, hatchDefs, escapeXml, nCaption, buildStackedBarSvg, buildHistogramSvg, LETTER_HEX, ZERO_HEX, INK_HEX };
