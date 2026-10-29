// chart-scatter-log.test.mjs — the scatter's logarithmic axes (Path 16 P5 step 2), pure Node.
//   - on a log axis equal ratios are equal distances: 1, 10, 100 sit evenly, and a point between sits where its log says;
//   - the decades are labelled (1, 10, 100; 1e-3 below 0.01), 2 and 5 are faint unlabelled gridlines;
//   - a point at or below 0 is not plotted, and the <desc> says how many were left out and which axis is log;
//   - a trendline on a log axis is drawn as a curve (a polyline), not a straight segment, and carries its R²;
//   - a power law y = x^2 is a straight line on log-log: the fitted curve's points are collinear in the picture;
//   - nothing log is said or drawn when the scale is linear (the byte-identical case is test:chart-svg-draw-parity).
// Each property is then checked against a broken copy of the module, which must fail it.
//   node Tools/data-chart-builder/test/chart-scatter-log.test.mjs   (npm run test:chart-scatter-log)

import { loadChartSvg } from './_load-chart-svg.mjs';

const num = (svg, tag) => [...svg.matchAll(new RegExp('<' + tag + ' cx="([\\d.-]+)" cy="([\\d.-]+)"', 'g'))].map(m => [+m[1], +m[2]]);
const pts = [{ x: 1, y: 1 }, { x: 10, y: 100 }, { x: 100, y: 10000 }, { x: 3, y: 9 }];
const SC = { points: pts, xLabel: 'Length', yLabel: 'Area' };
const desc = svg => (svg.match(/<desc id="cs-desc">([^<]*)</) || [])[1] || '';

function check(C) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const both = C.scatter(SC, { xScale: 'log', yScale: 'log' });
  const c = num(both, 'circle');
  ok(c.length === 4, 'four circles, got ' + c.length);
  ok(c.every(([x, y]) => x >= 56 && x <= 616 && y >= 40 && y <= 336), 'a point is outside the plot: ' + JSON.stringify(c));
  const dx1 = c[1][0] - c[0][0], dx2 = c[2][0] - c[1][0];
  ok(Math.abs(dx1 - dx2) < 0.2 && dx1 > 20, 'x: 1, 10, 100 not evenly spaced (' + dx1 + ', ' + dx2 + ')');
  const dy1 = c[0][1] - c[1][1], dy2 = c[1][1] - c[2][1];
  ok(Math.abs(dy1 - dy2) < 0.2 && dy1 > 20, 'y: 1, 100, 10000 not evenly spaced (' + dy1 + ', ' + dy2 + ')');
  // 3 is log10(3) = 0.477 of the way from 1 to 10
  const px = (c[3][0] - c[0][0]) / (c[1][0] - c[0][0]);
  ok(Math.abs(px - Math.log10(3)) < 0.01, 'x of 3 is at ' + px.toFixed(3) + ' of a decade, want ' + Math.log10(3).toFixed(3));
  ok(/>1<\/text>/.test(both) && />10<\/text>/.test(both) && />100<\/text>/.test(both) && />1k<\/text>/.test(both), 'decade labels missing');
  ok(/stroke="#f0f2f5"/.test(both), 'no faint 2 and 5 gridlines');
  ok(/Both axes are logarithmic, in powers of ten\./.test(desc(both)), 'desc does not say both are log: ' + desc(both));
  ok(/>10k<\/text>/.test(both), 'top decade not labelled');
  ok(/>1e-3<\/text>/.test(C.scatter({ points: [{ x: 1, y: 0.001 }, { x: 2, y: 5 }], xLabel: 'a', yLabel: 'b' }, { yScale: 'log' })), 'small decades not written as 1e-3');
  ok(/The vertical axis is logarithmic/.test(desc(C.scatter(SC, { yScale: 'log' }))) && !/horizontal axis is logarithmic/.test(desc(C.scatter(SC, { yScale: 'log' }))), 'only-y desc');
  ok(/The horizontal axis is logarithmic/.test(desc(C.scatter(SC, { xScale: 'log' }))), 'only-x desc');

  // points at or below zero
  const mixed = C.scatter({ points: [{ x: 0, y: 5 }, { x: -2, y: 3 }, { x: 1, y: 2 }, { x: 10, y: 20 }], xLabel: 'a', yLabel: 'b' }, { xScale: 'log' });
  ok(num(mixed, 'circle').length === 2, 'non-positive x was plotted');
  ok(/2 points with a zero or negative value are not plotted\./.test(desc(mixed)), 'dropped count not in desc: ' + desc(mixed));
  ok(/1 point with a zero or negative value is not plotted\./.test(desc(C.scatter({ points: [{ x: 0, y: 5 }, { x: 1, y: 2 }], xLabel: 'a', yLabel: 'b' }, { xScale: 'log' }))), 'singular wording');
  ok(num(C.scatter({ points: [{ x: 0, y: 5 }, { x: 1, y: 2 }], xLabel: 'a', yLabel: 'b' }, {}), 'circle').length === 2, 'linear dropped a point');
  const none = C.scatter({ points: [{ x: -1, y: -1 }], xLabel: 'a', yLabel: 'b' }, { xScale: 'log', yScale: 'log' });
  ok(num(none, 'circle').length === 0 && /0 points/.test(desc(none)), 'all dropped: a chart with no points still draws');

  // a trendline on a log axis is a curve, and a power law is a straight line on log-log
  const pow = { points: [1, 2, 4, 8, 16, 32].map(x => ({ x, y: x * x })), xLabel: 'x', yLabel: 'y' };
  const t = C.scatter(pow, { xScale: 'log', yScale: 'log', trend: true });
  ok(/<polyline /.test(t) && !/<line [^>]*stroke-dasharray/.test(t), 'a log-axis trendline is not a polyline');
  ok(/Trend line y = /.test(desc(t)) && /R squared/.test(desc(t)), 'log-axis trend not described');
  const fit = { predict: x => x * x, label: 'y = x²  (R² = 1)', desc: 'Power fit y = x^2, R squared 1.' };
  const pl = C.scatter(pow, { xScale: 'log', yScale: 'log', trend: true, fit });
  const poly = (pl.match(/<polyline points="([^"]+)"/) || [])[1];
  const P = (poly || '').split(' ').map(s => s.split(',').map(Number));
  let worst = 0;
  if (P.length > 3) { const [x0, y0] = P[0], [x1, y1] = P[P.length - 1]; P.forEach(([x, y]) => { worst = Math.max(worst, Math.abs((y1 - y0) * (x - x0) - (x1 - x0) * (y - y0)) / Math.hypot(x1 - x0, y1 - y0)); }); }
  const steps = P.slice(1).map((q, i) => q[0] - P[i][0]);
  ok(steps.length > 20 && Math.max(...steps) < 1.5 * Math.min(...steps), 'the curve is not sampled evenly along a log axis');
  ok(P.length > 20 && P[P.length - 1][0] - P[0][0] > 200 && worst < 0.3, 'y = x² is not straight on log-log (off by ' + worst.toFixed(2) + ' px over ' + P.length + ' points)');
  const lin = C.scatter(pow, { trend: true, fit });
  ok(/<polyline /.test(lin) && !/logarithmic/.test(desc(lin)), 'linear axes with a fit mention log');

  // linear says and draws nothing log
  const plain = C.scatter(SC, {});
  ok(!/logarithmic|powers of ten/.test(desc(plain)) && !/stroke="#f0f2f5"/.test(plain), 'linear chart mentions log');
  ok(C.scatter(SC, { xScale: 'linear', yScale: 'bogus' }) === plain, 'an unknown scale is not linear');
  return bad;
}

const real = check(loadChartSvg());
if (real.length) { console.log('FAIL\n  ' + real.join('\n  ')); process.exit(1); }
console.log('ok    log axes: spacing, ticks, dropped points, curves');

const MUTANTS = {
  'log10 replaced by ln': s => s.replace("return PAD.left + ((Math.log10(v) - xd[0]) / (xd[1] - xd[0])) * plotW;", "return PAD.left + ((Math.log(v) - xd[0]) / (xd[1] - xd[0])) * plotW;"),
  'non-positive points kept': s => s.replace("pts = sc.points.filter(function (p) { return (!xLog || p.x > 0) && (!yLog || p.y > 0); });", "pts = sc.points;"),
  'dropped count not said': s => s.replace("if (dropped) desc +=", "if (false) desc +="),
  'minor gridlines made major': s => s.replaceAll("(t.major ? '#e1e5ea' : '#f0f2f5')", "'#e1e5ea'"),
  'decades unlabelled': s => s.replace("if (t.major) parts.push('<text x=\"' + (PAD.left - 8)", "if (false) parts.push('<text x=\"' + (PAD.left - 8)"),
  'small decades as 0': s => s.replace("return '1e' + Math.round(Math.log10(v));", "return formatNum(v);"),
  'straight trend on log axes': s => s.replace("if (!fit && trend && (xLog || yLog)) {", "if (false) {"),
  'curve sampled evenly in x not in log x': s => s.replace("var fx = xLog ? Math.pow(10, xd[0] + (xd[1] - xd[0]) * si / steps) : xLo", "var fx = xLo"),
  'domain one decade short': s => s.replace("hi === lo ? lo + 1 : hi", "hi === lo ? lo + 1 : hi - 1"),
  'log said on linear': s => s.replace("if (xLog || yLog) {\n      desc +=", "if (true) {\n      desc +="),
};
let failed = 0;
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = [String(e.message)]; }
  if (!r.length) { failed++; console.log('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name);
}
if (failed) process.exit(1);
console.log('\nall log-axis checks passed');
