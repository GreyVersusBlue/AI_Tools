// chart-svg-a11y.test.mjs — the accessibility baseline Path 16 P1 step 2 gives every chart (the
// parity suite proves the geometry did not move; this proves what was added):
//   - every SVG is role="img", labelled by its <title> and <desc> (ids that exist, unique per prefix);
//   - the <desc> carries the data: category names and values, slice shares, the fit, the box summaries,
//     capped (a 400-row table does not make a 400-item sentence); everything in it is escaped;
//   - a pie percentage is the better of ink and white against its slice, >= 4.5:1 on every palette slice;
//   - grayscale mode: every series after the first is filled with a pattern, the pattern is defined,
//     two series never share one, and it is off in colour mode.
// Each property is then checked against a broken copy of the module, which must fail it.
//
//   node Tools/data-chart-builder/test/chart-svg-a11y.test.mjs   (npm run test:chart-svg-a11y)
// Pure Node, no browser, no port. Exits 1 on any failure.

import { loadChartSvg } from './_load-chart-svg.mjs';

const HEX = ['#6c8ef5', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8'];
const GRAY = ['#141414', '#3d3d3d', '#666666', '#8f8f8f', '#b3b3b3', '#d1d1d1'];
const S = (label, values, i, pal) => ({ label, color: (pal || HEX)[i], dash: '', values, errors: null });
const cats = ['A', 'B & <C>', 'D'];

function check(C) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const ratio = (a, b) => C.contrastRatio(C.relativeLuminance(a), C.relativeLuminance(b));
  const o = { title: 'My <chart>', showValues: true, palette: HEX, trend: true };

  const bar = C.bar({ categories: cats, series: [S('Mass (g)', [3, 7.5, 2], 0), S('Vol', [1, 2, 3], 1)] }, o);
  const pie = C.pie({ categories: cats, series: [S('Share', [50, 30, 20], 0)] }, o);
  const line = C.line({ categories: cats, series: [S('Mass', [3, 7.5, 2], 0)] }, o);
  const sc = C.scatter({ points: [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6.1 }], xLabel: 'Time', yLabel: 'Dist' }, o);
  const bx = C.box({ boxes: [{ label: 'G1', color: HEX[0], min: 1, q1: 3, median: 5, q3: 8, max: 10 }] }, o);
  const blank = C.blankAxes({ categories: cats, series: [S('Mass', [3, 7.5, 2], 0)] }, o);

  for (const [name, svg] of Object.entries({ bar, pie, line, scatter: sc, box: bx, blank })) {
    ok(/^<svg [^>]*role="img"[^>]*aria-labelledby="cs-title cs-desc"/.test(svg), name + ': not role=img + aria-labelledby');
    ok(/<title id="cs-title">[^<]+<\/title><desc id="cs-desc">[^<]+<\/desc>/.test(svg), name + ': no <title>/<desc>');
    ok(svg.includes('My &lt;chart&gt;') && !svg.includes('My <chart>'), name + ': title not escaped');
    ok((svg.match(/id="cs-title"/g) || []).length === 1, name + ': title id not unique');
  }
  const desc = svg => (svg.match(/<desc id="cs-desc">([^<]*)</) || [])[1] || '';
  ok(desc(bar).includes('B &amp; &lt;C&gt; 7.5') && desc(bar).includes('Mass (g)') && desc(bar).includes('Vol'), 'bar desc misses the values');
  ok(desc(pie).includes('(50%)') && desc(pie).includes('(30%)'), 'pie desc misses the shares');
  ok(/R squared 1\b|R squared 0\.99/.test(desc(sc)) && desc(sc).includes('Trend line'), 'scatter desc misses the fit');
  // a curve handed in by the page (dcb-fit.js): drawn, labelled and described; absent without trend
  const fit = { predict: x => 2 * x * x, label: 'y = 2x²  (R² = 1)', desc: 'Power fit y = 2x^2, R squared 1, from 3 points.' };
  const scf = C.scatter({ points: [{ x: 1, y: 2 }, { x: 2, y: 8 }, { x: 3, y: 18 }], xLabel: 'T', yLabel: 'D' }, { ...o, fit });
  ok(/<polyline points="[^"]+"[^>]*stroke-dasharray/.test(scf) && scf.includes('y = 2x²  (R² = 1)'), 'scatter with a fit draws no curve or label');
  ok(desc(scf).includes('Power fit y = 2x^2') && !desc(scf).includes('Trend line'), 'scatter desc misses the fit or keeps the line');
  ok(!/<polyline/.test(C.scatter({ points: [{ x: 1, y: 2 }, { x: 2, y: 8 }], xLabel: 'T', yLabel: 'D' }, { ...o, trend: false, fit })), 'a fit is drawn with the trendline off');
  ok(desc(bx).includes('median 5') && desc(bx).includes('1 to 10'), 'box desc misses the summary');
  ok(/Nothing is plotted/.test(desc(blank)) && !desc(blank).includes('7.5'), 'blank worksheet desc leaks the data');
  const long = Array.from({ length: 400 }, (_, i) => 'c' + i);
  const big = C.bar({ categories: long, series: [S('v', long.map((_, i) => i), 0)] }, {});
  ok(desc(big).length < 1200 && /and 388 more/.test(desc(big)), 'a 400-row desc is not capped (' + desc(big).length + ' chars)');
  ok(C.bar({ categories: cats, series: [S('v', [1, 2, 3], 0)] }, { idPrefix: 'cs-ws' }).includes('aria-labelledby="cs-ws-title cs-ws-desc"'), 'idPrefix not honoured');
  ok(/<title id="cs-title">Bar chart</.test(C.bar({ categories: cats, series: [S('v', [1, 2, 3], 0)] }, {})), 'no default title');

  // pie percentages against their slice
  for (const hex of HEX.concat(GRAY)) {
    const svg = C.pie({ categories: ['a', 'b'], series: [S('s', [60, 40], 0)] }, { showValues: true, palette: [hex, hex] });
    const m = svg.match(/fill="(#[0-9a-f]{6})" font-weight="600">60%/i);
    ok(m && ratio(hex, m[1]) >= 4.5, 'pie label on ' + hex + ' is ' + (m ? ratio(hex, m[1]).toFixed(2) : 'missing'));
  }

  // grayscale
  const series = GRAY.map((g, i) => S('s' + i, [1, 2, 3], i, GRAY));
  const g = C.bar({ categories: cats, series }, { grayscale: true });
  const fills = [...g.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="([^"]+)" rx="2"\/>/g)].map(m => m[1]);
  const perSeries = fills.filter((_, i) => i < 6);
  ok(perSeries[0] === GRAY[0], 'series 0 is not solid in grayscale');
  ok(perSeries.slice(1).every(f => /^url\(#cs-h\d\)$/.test(f)), 'a later series has no pattern in grayscale: ' + perSeries.join(' '));
  ok(new Set(perSeries).size === 6, 'two series share a fill in grayscale');
  [...g.matchAll(/url\(#(cs-h\d)\)/g)].forEach(m => ok(g.includes('<pattern id="' + m[1] + '"'), 'pattern ' + m[1] + ' used but not defined'));
  ok(!/pattern/.test(C.bar({ categories: cats, series }, {})), 'patterns appear in colour mode');
  const gp = C.pie({ categories: cats, series: [S('s', [1, 1, 1], 0)] }, { grayscale: true, showValues: true, palette: GRAY });
  [...gp.matchAll(/url\(#(cs-h\d)\)/g)].forEach(m => ok(gp.includes('<pattern id="' + m[1] + '"'), 'pie pattern ' + m[1] + ' not defined'));
  return bad;
}

let failed = 0;
const real = check(loadChartSvg());
if (real.length) { failed++; real.forEach(b => console.error('FAIL  ' + b)); } else console.log('ok    every accessibility property holds on the module');

const MUTANTS = {
  'role=img dropped': s => s.replace(' role="img" aria-labelledby="', ' aria-labelledby="'),
  'aria-labelledby points nowhere': s => s.replace(`aria-labelledby="' + tid + ' ' + did + '"`, `aria-labelledby="' + tid + ' ' + did + '-x"`),
  'title not escaped': s => s.replace("'\">' + escapeXml(title) + '</title>", "'\">' + title + '</title>"),
  'desc not escaped': s => s.replace("'\">' + escapeXml(desc) + '</desc>", "'\">' + desc + '</desc>"),
  'desc not capped': s => s.replace("return items.length > max ?", "return false ?"),
  'pie desc drops the shares': s => s.replace("' (' + Math.round(Math.max(s.values[i], 0) / total * 100) + '%)'", "''"),
  'pie label always white': s => s.replace("var fill = /^#[0-9a-f]{6}$/i.test(colors[i]) ? textColorFor(colors[i]) : '#ffffff';", "var fill = '#ffffff';"),
  'grayscale: no hatch': s => s.replace("return c.grayscale && HATCHES[i % HATCHES.length] ?", "return false ?"),
  'grayscale: patterns never defined': s => s.replace("    if (!c.grayscale) return '';\n    var out = '', seen = {};", "    return '';\n    var out = '', seen = {};"),
  'grayscale: every series the same hatch': s => s.replace("c.idPrefix + '-h' + (i % HATCHES.length) + ')' : hex;", "c.idPrefix + '-h1)' : hex;"),
  'blank worksheet desc leaks data': s => s.replace("'Blank chart axes for a worksheet. Categories: '", "'Blank chart axes for a worksheet. Values ' + built.series[0].values.join() + '. Categories: '"),
  'idPrefix ignored': s => s.replace("idPrefix: o.idPrefix || 'cs',", "idPrefix: 'cs',"),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = ['threw: ' + e.message]; }
  if (!r.length) { failed++; console.error('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name + ' (' + r[0] + ')');
}
if (failed) { console.error('\n' + failed + ' failure(s)'); process.exit(1); }
console.log('\nall chart-svg a11y checks passed');
