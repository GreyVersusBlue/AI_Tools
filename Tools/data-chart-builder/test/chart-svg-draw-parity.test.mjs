// chart-svg-draw-parity.test.mjs — _shared/chart-svg.js's bar / line / pie / scatter / box / blankAxes against
// 038's own drawing as it was before Path 16 P1 step 2 moved it (_legacy-draw.mjs, frozen). Both get the
// same data and options and must give the same SVG once the three things step 2 meant to change are
// normalized away: the role / aria-labelledby on <svg>, the <title> and <desc> after it, and the pie
// percentage's fill (white before, the better of ink and white now). Nothing else may move:
// geometry, ticks, labels, legends, error bars, trend line, box whiskers, escaping.
//
// Then the same comparison is run against deliberately broken copies of the module and must FAIL on each.
//
//   node Tools/data-chart-builder/test/chart-svg-draw-parity.test.mjs   (npm run test:chart-svg-draw-parity)
// Pure Node, no browser, no port. Exits 1 on any failure.

import { makeLegacy } from './_legacy-draw.mjs';
import { loadChartSvg } from './_load-chart-svg.mjs';

const HEX = ['#6c8ef5', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8'];
const W = 640, H = 400, PAD = { top: 40, right: 24, bottom: 64, left: 56 };

function normalize(svg) {
  return svg
    .replace(/ role="img" aria-labelledby="[^"]*"/, '')
    .replace(/<title id="[^"]*">[^<]*<\/title><desc id="[^"]*">[^<]*<\/desc>/, '')
    .replace(/(<text [^>]*?)fill="#[0-9a-fA-F]{6}"( font-weight="600">\d+%<\/text>)/g, '$1fill="#fff"$2');
}

const cat = (cats, series) => ({ categories: cats, series });
const S = (label, values, i, extra) => Object.assign({ label, color: HEX[i % 6], dash: '', values, errors: null }, extra || {});
const MANY = Array.from({ length: 12 }, (_, i) => 'Category number ' + (i + 1));
const CASES = {
  category: [
    cat(['A', 'B', 'C'], [S('Mass', [3, 7.5, 2], 0)]),
    cat(['A', 'B', 'C'], [S('Mass', [3, 7.5, 2], 0), S('Volume', [10, 4, 6], 1, { dash: '7,5' })]),
    cat(['Only'], [S('One', [5], 0)]),
    cat(MANY, [S('Many', MANY.map((_, i) => i * 13.37), 0, { errors: MANY.map((_, i) => i % 3) })]),
    cat(['x & y', '<b>', 'a "q"'], [S('T<1>', [1200, 2500, 0], 2)]),
    cat(['Z', 'Y'], [S('Zeros', [0, 0], 0)]),
    cat(['A', 'B', 'C', 'D'], [S('1', [1, 2, 3, 4], 0), S('2', [4, 3, 2, 1], 1), S('3', [2, 2, 2, 2], 2), S('4', [9, 8, 7, 6], 3, { errors: [1, 0, 2, 1] })]),
  ],
  pie: [
    cat(['A', 'B', 'C'], [S('Share', [50, 30, 20], 0)]),
    cat(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], [S('Share', [10, 9, 8, 7, 6, 5, 4, 0.1], 0)]),
    cat(['Whole'], [S('Share', [100], 0)]),
    cat(['A', 'B'], [S('Share', [0, 0], 0)]),
    cat(['A', 'B', 'C'], [S('Share', [5, -3, 5], 0)]),
  ],
  scatter: [
    { points: [{ x: 1, y: 2 }, { x: 2, y: 4.1 }, { x: 3, y: 5.9 }, { x: 4, y: 8.2 }], xLabel: 'Time (s)', yLabel: 'Distance (m)' },
    { points: [{ x: -3, y: 2 }, { x: 0, y: 4 }, { x: 5, y: 1 }], xLabel: 'x & y', yLabel: '<y>' },
    { points: [{ x: 1, y: 1 }], xLabel: 'x', yLabel: 'y' },
    { points: [{ x: 2, y: 1 }, { x: 2, y: 5 }], xLabel: 'x', yLabel: 'y' },
    { points: [], xLabel: 'x', yLabel: 'y' },
  ],
  box: [
    { boxes: [{ label: 'Group 1', color: HEX[0], min: 1, q1: 3, median: 5, q3: 8, max: 10 }] },
    { boxes: [{ label: 'A', color: HEX[0], min: 0, q1: 2, median: 4, q3: 6, max: 12 }, { label: 'B & C', color: HEX[1], min: 5, q1: 6, median: 7, q3: 7.5, max: 9 }, { label: 'D', color: HEX[2], min: 3, q1: 3, median: 3, q3: 3, max: 3 }] },
  ],
};

function diff(New) {
  const bad = [];
  let n = 0;
  for (const showValues of [false, true]) for (const title of ['', 'Plot of <it> & "them"']) for (const yLabel of ['', 'Custom y']) for (const trend of [false, true]) {
    const els = { showValues: { checked: showValues }, chartTitle: { value: title }, yAxisLabel: { value: yLabel }, showTrendline: { checked: trend } };
    const Old = makeLegacy(els, W, H, PAD, i => HEX[i % 6], HEX);
    const o = { W, H, pad: PAD, title, yLabel, showValues, trend, palette: HEX, pointColor: HEX[0], trendColor: HEX[4] };
    const chk = (name, a, b) => { n++; if (normalize(a) !== normalize(b)) bad.push(name + ' #' + n); };
    CASES.category.forEach(b => {
      chk('bar', New.bar(b, o), Old.drawBarChart(b));
      chk('line', New.line(b, o), Old.drawLineChart(b));
    });
    CASES.pie.forEach(b => chk('pie', New.pie(b, o), Old.drawPieChart(b)));
    CASES.scatter.forEach(b => chk('scatter', New.scatter(b, o), Old.drawScatterChart(b)));
    CASES.box.forEach(b => chk('box', New.box(b, o), Old.drawBoxChart(b)));
    const sheet = (b) => {
      const parts = [Old.svgOpen(), Old.chartTitleEl(), Old.drawAxes(Old.niceMax(Math.max.apply(null, b.series.map(s => Math.max.apply(null, s.values.concat([0])))) * 1.15), b.categories), Old.drawYAxisLabel(b.series[0] ? b.series[0].label : ''), '</svg>'];
      return parts.join('');
    };
    CASES.category.forEach(b => chk('blankAxes', New.blankAxes(b, o), sheet(b)));
  }
  const Old = makeLegacy({}, W, H, PAD, i => HEX[i % 6], HEX);
  for (const v of [0, 0.4, 1, 3, 7.5, 99, 100, 1234, 5e5, 0.0123]) {
    n++; if (New.niceMax(v) !== Old.niceMax(v)) bad.push('niceMax ' + v);
  }
  for (const v of [0, 1, -1, 999, 1000, 1500, 2000, 12345.678, 0.005, -2500]) {
    n++; if (New.formatNum(v) !== Old.formatNum(v)) bad.push('formatNum ' + v);
  }
  for (const pts of [[], [{ x: 1, y: 1 }], [{ x: 1, y: 1 }, { x: 2, y: 3 }], [{ x: 1, y: 1 }, { x: 1, y: 3 }], [{ x: 1, y: 2 }, { x: 2, y: 4.2 }, { x: 3, y: 5.8 }]]) {
    n++; if (JSON.stringify(New.linearRegression(pts)) !== JSON.stringify(Old.linearRegression(pts))) bad.push('linearRegression ' + JSON.stringify(pts));
  }
  return { bad, n };
}

let failed = 0;
const real = diff(loadChartSvg());
if (real.bad.length) { failed++; console.error("FAIL  module differs from 038's old drawing: " + real.bad.slice(0, 8).join('; ') + (real.bad.length > 8 ? ' …(+' + (real.bad.length - 8) + ')' : '')); }
else console.log('ok    ' + real.n + " drawings and helpers identical to 038's old code (a11y envelope and pie label colour aside)");

const MUTANTS = {
  'bars start at the wrong x': s => s.replace('var x = PAD.left + slot * i + groupPad + barW * si;', 'var x = PAD.left + slot * i + groupPad + barW * si + 1;'),
  'value labels on zero bars': s => s.replace('if (c.showValues && val !== 0) {', 'if (c.showValues) {'),
  'line chart loses a single point centre': s => s.replace('var x = n === 1 ? PAD.left + plotW / 2 : PAD.left + slot * i;', 'var x = PAD.left + slot * i;'),
  'pie large-arc flag': s => s.replace('var largeArc = frac > 0.5 ? 1 : 0;', 'var largeArc = frac > 0.4 ? 1 : 0;'),
  'pie negative slices counted': s => s.replace('var val = Math.max(s.values[i], 0);\n      var frac', 'var val = s.values[i];\n      var frac'),
  'scatter origin ignores negative x': s => s.replace('var xOrigin = Math.min(minX, 0);', 'var xOrigin = 0;'),
  'trend line drawn without the switch': s => s.replace('var trend = c.trend && !multi ? linearRegression(pts) : null;', 'var trend = linearRegression(pts);'),
  'box median thinner': s => s.replace('stroke-width="2.5"/>\');\n      if (c.showValues) {', 'stroke-width="2"/>\');\n      if (c.showValues) {'),
  'category labels not escaped': s => s.replace("escapeXml(label) + '</text>');\n        }\n      });", "label + '</text>');\n        }\n      });"),
  'niceMax rounds down': s => s.replace('var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;', 'var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 4 ? 5 : 10;'),
  'axis label truncation': s => s.replace("label.slice(0, 9) + '…'", "label.slice(0, 8) + '…'"),
  'error bar caps removed': s => s.replace('(cx - 4).toFixed(1) + \'" y1="\' + top.toFixed(1) + \'" x2="\' + (cx + 4)', '(cx - 3).toFixed(1) + \'" y1="\' + top.toFixed(1) + \'" x2="\' + (cx + 3)'),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  const r = diff(loadChartSvg(mutate));
  if (r.bad.length === 0) { failed++; console.error('FAIL  mutant survived: ' + name); }
  else console.log('ok    mutant caught: ' + name + ' (' + r.bad.length + ' mismatches)');
}

if (failed) { console.error('\n' + failed + ' failure(s)'); process.exit(1); }
console.log('\nall chart-svg draw parity checks passed');
