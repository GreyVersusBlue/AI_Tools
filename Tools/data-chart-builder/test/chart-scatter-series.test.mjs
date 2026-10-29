// chart-scatter-series.test.mjs — more than one series on the scatter (Path 16 P5 step 3), pure Node.
//   - each series has its own marker SHAPE (circle, square, triangle, diamond, then round again) and its own palette
//     colour, so colour-blind and black-and-white readers tell them apart without the colour;
//   - the legend names every series with that shape, and gives R² beside it when a trendline is on;
//   - every series is fitted on its own: a straight line each, or the fit the page hands over per series (`fits`);
//   - the <desc> names each series with its point count and its fit; the picture is role="img" with title and desc;
//   - a log axis drops a series' non-positive points and counts them across all series;
//   - one series (or none given) is the single-series chart exactly (the byte-identical case is test:chart-svg-draw-parity).
// Each property is then checked against a broken copy of the module, which must fail it.
//   node Tools/data-chart-builder/test/chart-scatter-series.test.mjs   (npm run test:chart-scatter-series)

import { loadChartSvg } from './_load-chart-svg.mjs';

const PAL = ['#6c8ef5', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8'];
const mk = (label, f) => ({ label, points: [1, 2, 3, 4, 5].map(x => ({ x, y: f(x) })) });
const SERIES = [mk('Mass', x => 2 * x), mk('Volume', x => 3 * x + 1), mk('Heat', x => x * x), mk('Cool', x => 20 - x), mk('Fifth', x => x / 2)];
const SC = { points: SERIES[0].points, series: SERIES, xLabel: 'Time (s)', yLabel: '' };
const desc = svg => (svg.match(/<desc id="cs-desc">([^<]*)</) || [])[1] || '';
const count = (svg, tag) => (svg.match(new RegExp('<' + tag + ' ', 'g')) || []).length;

function check(C) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const svg = C.scatter(SC, { palette: PAL });
  // 5 points each: 2 circles (series 0 and 4), 1 square, 1 triangle polygon, 1 diamond polygon
  const body = svg.slice(0, svg.indexOf('<g transform="translate(0,'));
  ok(count(body, 'circle') === 10, 'circles: ' + count(body, 'circle') + ' (series 1 and 5, 5 points each)');
  ok(count(body, 'rect') === 1 + 5, 'squares: the white background and 5 points, got ' + count(body, 'rect'));
  ok(count(body, 'polygon') === 10, 'triangles and diamonds: ' + count(body, 'polygon'));
  for (const [i, c] of PAL.slice(0, 4).entries()) ok(body.includes('fill="' + c + '"'), 'series ' + i + ' colour ' + c + ' missing');
  ok(/<polygon points="[^"]+"[^>]*fill="#4ade80"/.test(body) && /<rect [^>]*fill="#a78bfa"/.test(body), 'series 2 is not a square or series 3 not a triangle');

  // legend: names, with their own marker shapes
  const legend = svg.slice(svg.indexOf('<g transform="translate(0,'));
  for (const n of ['Mass', 'Volume', 'Heat', 'Cool']) ok(legend.includes('>' + n + '<'), 'legend misses ' + n);
  ok(count(legend, 'circle') >= 1 && count(legend, 'rect') >= 1 && count(legend, 'polygon') >= 2, 'legend markers are not the series\' shapes');
  ok(!/R²/.test(legend), 'legend shows R² with the trendline off');

  // trendline: one fit each, in the series' own colour; R² in the legend and the desc
  const t = C.scatter(SC, { palette: PAL, trend: true });
  ok(count(t, 'polyline') === 5, 'a fit per series: ' + count(t, 'polyline') + ' polylines');
  ok(/stroke="#a78bfa" stroke-width="2" stroke-dasharray/.test(t), 'series 2 line is not its colour');
  ok(/Mass \(R² 1\)/.test(t) && /Heat \(R² 0\.9[0-9]\)/.test(t), 'legend R²: ' + (t.match(/Mass[^<]*|Heat[^<]*/g) || []).join(' | '));
  ok(/Volume: linear fit y = 3x \+ 1, R squared 1\./.test(desc(t)), 'desc fit: ' + desc(t));
  // the page's own fits (a power fit for series 3 only) take over their series
  const fits = SERIES.map((s, i) => i === 2 ? { predict: x => x * x, r2: 1, label: 'y = x²', desc: 'Power fit y = x^2, R squared 1' } : null);
  const f2 = C.scatter(SC, { palette: PAL, trend: true, fits });
  ok(/Heat: Power fit y = x\^2, R squared 1\./.test(desc(f2)) && /Heat \(R² 1\)/.test(f2), 'page fit for one series not used: ' + desc(f2));
  ok(/Mass: linear fit/.test(desc(f2)), 'the other series lost its linear fit');
  ok(!/polyline/.test(C.scatter(SC, { palette: PAL, trend: false })), 'fits drawn with the trendline off');

  // description
  const d = desc(svg);
  ok(/Scatter plot of 5 series against Time \(s\), 25 points: Mass \(5\), Volume \(5\), Heat \(5\), Cool \(5\), Fifth \(5\)\./.test(d), 'series sentence: ' + d);
  ok(/^<svg [^>]*role="img"[^>]*aria-labelledby="cs-title cs-desc"/.test(svg), 'not role=img');
  const esc = C.scatter({ ...SC, series: [{ label: 'A <b>', points: [{ x: 1, y: 1 }] }, { label: 'B', points: [{ x: 2, y: 2 }] }] }, {});
  ok(esc.includes('>A &lt;b&gt;<') && !esc.includes('<b>'), 'series name not escaped in the legend');

  // log axes across series
  const withZero = { ...SC, series: [{ label: 'A', points: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 10, y: 5 }] }, { label: 'B', points: [{ x: 5, y: 0 }, { x: 2, y: 3 }] }] };
  const lg = C.scatter(withZero, { xScale: 'log', yScale: 'log', palette: PAL });
  ok(/2 points with a zero or negative value are not plotted\./.test(desc(lg)) && /A \(2\), B \(1\)/.test(desc(lg)), 'log: ' + desc(lg));

  // one series is the plain chart
  const one = C.scatter({ points: SERIES[0].points, series: [SERIES[0]], xLabel: 'T', yLabel: 'Y' }, { palette: PAL });
  ok(one === C.scatter({ points: SERIES[0].points, xLabel: 'T', yLabel: 'Y' }, { palette: PAL }), 'one series differs from no series');
  // very small / empty series do not crash
  ok(typeof C.scatter({ points: [], series: [{ label: 'A', points: [] }, { label: 'B', points: [] }], xLabel: 'T', yLabel: '' }, { trend: true }) === 'string', 'empty series crash');
  return bad;
}

const real = check(loadChartSvg());
if (real.length) { console.log('FAIL\n  ' + real.join('\n  ')); process.exit(1); }
console.log('ok    series: shapes, colours, legend, fits, description, log axes');

const MUTANTS = {
  'every series a circle': s => s.replace("var SHAPES = ['circle', 'square', 'triangle', 'diamond'];", "var SHAPES = ['circle', 'circle', 'circle', 'circle'];"),
  'every series one colour': s => s.replace("var color = c.palette[si % c.palette.length], shape", "var color = c.palette[0], shape"),
  'no legend': s => s.replace("parts.push(markerLegend(c, legend));", ""),
  'no R² in the legend': s => s.replace("(sf && sf.r2 != null ? ' (R² ' + round2(sf.r2) + ')' : '')", "''"),
  'one fit for all series': s => s.replace("var lr = linearRegression(se.points);", "var lr = linearRegression(pts);"),
  'page fits ignored': s => s.replace("sf = c.fits && c.fits[si] && typeof c.fits[si].predict === 'function' ? c.fits[si] : null;", "sf = null;"),
  'fit drawn without the switch': s => s.replace("        if (c.trend) {\n          sf =", "        if (true) {\n          sf ="),
  'dropped points not counted': s => s.replace("dropped = sets.reduce(function (n, se) { return n + se.all - se.points.length; }, 0);", "dropped = 0;"),
  'legend name not escaped': s => s.replace("font-size=\"10\" fill=\"#16222e\">' + escapeXml(text) + '</text>');\n      curX += w;", "font-size=\"10\" fill=\"#16222e\">' + text + '</text>');\n      curX += w;"),
  'fit not described': s => s.replace("desc += ' ' + (se.label || 'Series') + ': ' + sf.desc", "desc += ''"),
  'a single series takes the multi path': s => s.replace("sc.series && sc.series.length > 1 ? sc.series : null", "sc.series && sc.series.length > 0 ? sc.series : null"),
};
let failed = 0;
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = [String(e.message)]; }
  if (!r.length) { failed++; console.log('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name);
}
if (failed) process.exit(1);
console.log('\nall series checks passed');
