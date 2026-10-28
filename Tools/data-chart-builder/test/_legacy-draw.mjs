// _legacy-draw.mjs — 038's chart drawing exactly as it was inline in the page at v402, before
// Path 16 P1 step 2 moved it to _shared/chart-svg.js. FROZEN: do not edit it to follow the module;
// test:chart-svg-draw-parity feeds both the same data and demands the same SVG (the a11y
// envelope and the pie label colour are normalized away, nothing else).
// The bodies are 038-data-chart-builder.html lines 883-1143 and 1165 verbatim; the page's
// closure variables (els, W, H, PAD, paletteColor, PALETTE_HEX) are the factory's arguments.
/* eslint-disable */
export function makeLegacy(els, W, H, PAD, paletteColor, PALETTE_HEX) {
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeXML(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
  function niceMax(v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var norm = v / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function svgOpen() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="Inter, system-ui, sans-serif">' +
      '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>';
  }
  function chartTitleEl() {
    var t = els.chartTitle.value.trim();
    if (!t) return '';
    return '<text x="' + (W / 2) + '" y="22" text-anchor="middle" font-size="15" font-weight="700" fill="#16222e">' + escapeXML(t) + '</text>';
  }

  function drawAxes(maxVal, categories) {
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
          parts.push('<text x="' + x + '" y="' + (PAD.top + plotH + 14) + '" text-anchor="end" font-size="9.5" fill="#5b6b78" transform="rotate(-40 ' + x + ' ' + (PAD.top + plotH + 14) + ')">' + escapeXML(label) + '</text>');
        } else {
          parts.push('<text x="' + x + '" y="' + (PAD.top + plotH + 18) + '" text-anchor="middle" font-size="10.5" fill="#5b6b78">' + escapeXML(label) + '</text>');
        }
      });
    }
    return parts.join('');
  }

  function drawYAxisLabel(defaultLabel) {
    var text = els.yAxisLabel.value.trim() || defaultLabel;
    if (!text) return '';
    var plotH = H - PAD.top - PAD.bottom;
    var x = 14, y = PAD.top + plotH / 2;
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="10.5" fill="#5b6b78" transform="rotate(-90 ' + x + ' ' + y + ')">' + escapeXML(text) + '</text>';
  }

  function formatNum(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
    return Math.round(v * 100) / 100 + '';
  }

  /** A vertical error-bar-with-caps centered on (cx, centerY), extending
   * `halfH` pixels up and down — used identically by the bar and line
   * charts so a ± value column reads the same way regardless of chart type. */
  function errorBarSvg(cx, centerY, halfH) {
    if (!halfH) return '';
    var top = centerY - halfH, bot = centerY + halfH;
    return '<line x1="' + cx.toFixed(1) + '" y1="' + top.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + bot.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>' +
      '<line x1="' + (cx - 4).toFixed(1) + '" y1="' + top.toFixed(1) + '" x2="' + (cx + 4).toFixed(1) + '" y2="' + top.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>' +
      '<line x1="' + (cx - 4).toFixed(1) + '" y1="' + bot.toFixed(1) + '" x2="' + (cx + 4).toFixed(1) + '" y2="' + bot.toFixed(1) + '" stroke="#16222e" stroke-width="1.4"/>';
  }

  function drawBarChart(built) {
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var maxVal = niceMax(Math.max.apply(null, built.series.map(function (s) { return Math.max.apply(null, s.values.concat([0])); })) * 1.15);
    var n = built.categories.length;
    var slot = plotW / n;
    var groupPad = slot * 0.18;
    var barW = (slot - groupPad * 2) / built.series.length;

    var parts = [svgOpen(), chartTitleEl(), drawAxes(maxVal, built.categories), drawYAxisLabel(built.series[0] ? built.series[0].label : '')];
    built.categories.forEach(function (cat, i) {
      built.series.forEach(function (s, si) {
        var val = s.values[i];
        var barH = (val / maxVal) * plotH;
        var x = PAD.left + slot * i + groupPad + barW * si;
        var y = PAD.top + plotH - barH;
        parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(barW - 2, 1).toFixed(1) + '" height="' + Math.max(barH, 0).toFixed(1) + '" fill="' + s.color + '" rx="2"/>');
        if (s.errors && s.errors[i]) parts.push(errorBarSvg(x + (barW - 2) / 2, y, (s.errors[i] / maxVal) * plotH));
        if (els.showValues.checked && val !== 0) {
          parts.push('<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#16222e">' + formatNum(val) + '</text>');
        }
      });
    });
    parts.push(drawLegend(built.series));
    parts.push('</svg>');
    return parts.join('');
  }

  function drawLineChart(built) {
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var maxVal = niceMax(Math.max.apply(null, built.series.map(function (s) { return Math.max.apply(null, s.values.concat([0])); })) * 1.15);
    var n = built.categories.length;
    var slot = plotW / Math.max(n - 1, 1);

    var parts = [svgOpen(), chartTitleEl(), drawAxes(maxVal, built.categories), drawYAxisLabel(built.series[0] ? built.series[0].label : '')];
    built.series.forEach(function (s) {
      var pts = s.values.map(function (v, i) {
        var x = n === 1 ? PAD.left + plotW / 2 : PAD.left + slot * i;
        var y = PAD.top + plotH - (v / maxVal) * plotH;
        return [x, y];
      });
      var dashAttr = s.dash ? ' stroke-dasharray="' + s.dash + '"' : '';
      parts.push('<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2.5"' + dashAttr + '/>');
      pts.forEach(function (p, i) {
        if (s.errors && s.errors[i]) parts.push(errorBarSvg(p[0], p[1], (s.errors[i] / maxVal) * plotH));
        parts.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + s.color + '"/>');
        if (els.showValues.checked) {
          parts.push('<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 9).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#16222e">' + formatNum(s.values[i]) + '</text>');
        }
      });
    });
    parts.push(drawLegend(built.series));
    parts.push('</svg>');
    return parts.join('');
  }

  function drawPieChart(built) {
    var s = built.series[0];
    var total = s.values.reduce(function (a, b) { return a + Math.max(b, 0); }, 0);
    var cx = W / 2, cy = H / 2 + 6, r = Math.min(W, H) * 0.28;
    var parts = [svgOpen(), chartTitleEl()];
    if (total <= 0) { parts.push('</svg>'); return parts.join(''); }
    var angle = -Math.PI / 2;
    built.categories.forEach(function (cat, i) {
      var val = Math.max(s.values[i], 0);
      var frac = val / total;
      var next = angle + frac * Math.PI * 2;
      var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      var x2 = cx + r * Math.cos(next), y2 = cy + r * Math.sin(next);
      var largeArc = frac > 0.5 ? 1 : 0;
      var color = paletteColor(i);
      if (frac > 0) {
        parts.push('<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' Z" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>');
      }
      if (els.showValues.checked && frac > 0.02) {
        var midAngle = angle + frac * Math.PI;
        var lx = cx + r * 0.68 * Math.cos(midAngle), ly = cy + r * 0.68 * Math.sin(midAngle);
        parts.push('<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#fff" font-weight="600">' + Math.round(frac * 100) + '%</text>');
      }
      angle = next;
    });
    var legendItems = built.categories.map(function (cat, i) {
      return { label: String(cat), color: paletteColor(i) };
    });
    parts.push(drawLegendItems(legendItems));
    parts.push('</svg>');
    return parts.join('');
  }

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

  function drawScatterChart(sc) {
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var xs = sc.points.map(function (p) { return p.x; }), ys = sc.points.map(function (p) { return p.y; });
    var maxX = niceMax(Math.max.apply(null, xs.concat([0])) * 1.1);
    var maxY = niceMax(Math.max.apply(null, ys.concat([0])) * 1.15);
    var minX = Math.min.apply(null, xs.concat([0]));
    var xRange = maxX - Math.min(minX, 0) || 1;
    var xOrigin = Math.min(minX, 0);

    function toX(v) { return PAD.left + ((v - xOrigin) / xRange) * plotW; }
    function toY(v) { return PAD.top + plotH - (v / maxY) * plotH; }

    var parts = [svgOpen(), chartTitleEl(), drawAxes(maxY, null), drawYAxisLabel(sc.yLabel)];
    parts.push('<text x="' + (W / 2) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10.5" fill="#5b6b78">' + escapeXML(sc.xLabel) + '</text>');

    var trend = null;
    if (els.showTrendline.checked) trend = linearRegression(sc.points);
    if (trend) {
      var lineX1 = xOrigin, lineX2 = maxX;
      var lineY1 = trend.slope * lineX1 + trend.intercept;
      var lineY2 = trend.slope * lineX2 + trend.intercept;
      parts.push('<line x1="' + toX(lineX1).toFixed(1) + '" y1="' + toY(lineY1).toFixed(1) + '" x2="' + toX(lineX2).toFixed(1) + '" y2="' + toY(lineY2).toFixed(1) + '" stroke="' + PALETTE_HEX[4] + '" stroke-width="2" stroke-dasharray="5,4"/>');
      var eq = 'y = ' + round2(trend.slope) + 'x ' + (trend.intercept >= 0 ? '+ ' : '- ') + round2(Math.abs(trend.intercept)) + '  (R² = ' + round2(trend.r2) + ')';
      parts.push('<text x="' + (W - PAD.right) + '" y="' + (PAD.top - 6) + '" text-anchor="end" font-size="10" fill="' + PALETTE_HEX[4] + '">' + escapeXML(eq) + '</text>');
    }

    sc.points.forEach(function (p) {
      parts.push('<circle cx="' + toX(p.x).toFixed(1) + '" cy="' + toY(p.y).toFixed(1) + '" r="4" fill="' + PALETTE_HEX[0] + '" opacity="0.75"/>');
    });
    parts.push('</svg>');
    return parts.join('');
  }

  function drawBoxChart(built) {
    var plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
    var boxes = built.boxes;
    var maxVal = niceMax(Math.max.apply(null, boxes.map(function (b) { return b.max; })) * 1.15);
    var n = boxes.length;
    var slot = plotW / n;
    var boxW = Math.min(slot * 0.5, 70);

    function toY(v) { return PAD.top + plotH - (v / maxVal) * plotH; }

    var parts = [svgOpen(), chartTitleEl(), drawAxes(maxVal, boxes.map(function (b) { return b.label; })), drawYAxisLabel('')];
    boxes.forEach(function (b, i) {
      var x = PAD.left + slot * i + slot / 2;
      var yMin = toY(b.min), yMax = toY(b.max), yQ1 = toY(b.q1), yQ3 = toY(b.q3), yMed = toY(b.median);
      var capW = boxW * 0.5;

      parts.push('<line x1="' + x.toFixed(1) + '" y1="' + yMax.toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + yMin.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<line x1="' + (x - capW / 2).toFixed(1) + '" y1="' + yMax.toFixed(1) + '" x2="' + (x + capW / 2).toFixed(1) + '" y2="' + yMax.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<line x1="' + (x - capW / 2).toFixed(1) + '" y1="' + yMin.toFixed(1) + '" x2="' + (x + capW / 2).toFixed(1) + '" y2="' + yMin.toFixed(1) + '" stroke="' + b.color + '" stroke-width="1.5"/>');
      parts.push('<rect x="' + (x - boxW / 2).toFixed(1) + '" y="' + yQ3.toFixed(1) + '" width="' + boxW.toFixed(1) + '" height="' + Math.max(yQ1 - yQ3, 1).toFixed(1) + '" fill="' + b.color + '" fill-opacity="0.25" stroke="' + b.color + '" stroke-width="1.5" rx="2"/>');
      parts.push('<line x1="' + (x - boxW / 2).toFixed(1) + '" y1="' + yMed.toFixed(1) + '" x2="' + (x + boxW / 2).toFixed(1) + '" y2="' + yMed.toFixed(1) + '" stroke="' + b.color + '" stroke-width="2.5"/>');
      if (els.showValues.checked) {
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

  function drawLegend(series) {
    if (series.length < 2) return '';
    return drawLegendItems(series.map(function (s) { return { label: s.label, color: s.color }; }));
  }
  function drawLegendItems(items) {
    var y = 12, x = PAD.left;
    var parts = ['<g transform="translate(0,' + (H - 8) + ')">'];
    var curX = x;
    items.forEach(function (item) {
      var textW = Math.min(item.label.length * 6 + 24, 160);
      if (curX + textW > W - PAD.right) return; // skip overflow rather than overlapping
      parts.push('<rect x="' + curX + '" y="-9" width="9" height="9" fill="' + item.color + '" rx="2"/>');
      parts.push('<text x="' + (curX + 13) + '" y="-1" font-size="10" fill="#16222e">' + escapeXML(item.label.length > 20 ? item.label.slice(0, 19) + '…' : item.label) + '</text>');
      curX += textW;
    });
    parts.push('</g>');
    return parts.join('');
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  return { drawBarChart, drawLineChart, drawPieChart, drawScatterChart, drawBoxChart, niceMax, formatNum, linearRegression, round2, svgOpen, chartTitleEl, drawAxes, drawYAxisLabel };
}
