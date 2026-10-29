// chart-svg.test.mjs — _shared/chart-svg.js on its own terms (the parity suite holds it to 037's old
// output; this holds the properties that would still matter if 037's output changed on purpose):
//   - the label-colour rule gives >= 4.5:1 on every letter-grade ramp step, and on mid-greys it
//     picks whichever of ink / white really has more contrast;
//   - a stacked bar's segments add up to the bar, its percentages to the class, and every
//     pattern it paints with is defined; a histogram bar's height is its count's share of the
//     tallest; nothing from a name or label reaches the markup unescaped;
//   - the one luminance formula: ChartSvg's agrees to the last digit with 046's choropleth ramps' (bmg-choropleth.js keeps
//     RAMPS and its own copy: it is an ES module the map imports, ChartSvg a classic script; BACKLOG Path 16 P1 step 3);
//   - the output is well-formed XML (balanced tags, one root, no raw "<" in text).
// Each property is then checked against a deliberately broken module, which must fail it.
//
//   node Tools/grade-distribution-visualizer/test/chart-svg.test.mjs   (npm run test:chart-svg)
// Pure Node, no browser, no port. Exits 1 on any failure.

import { loadChartSvg } from './_load-chart-svg.mjs';
import { RAMPS, relativeLuminance as mapLuminance } from '../../blank-map-generator/bmg-choropleth.js';

const mk = (scores, name = 'T') => {
  const cut = { A: 90, B: 80, C: 70, D: 60 };
  const L = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach(s => { L[s >= cut.A ? 'A' : s >= cut.B ? 'B' : s >= cut.C ? 'C' : s >= cut.D ? 'D' : 'F']++; });
  const buckets = [];
  for (let i = 0; i < 10; i++) buckets.push({ start: i * 10, end: i * 10 + 9, label: i * 10 + '–' + (i * 10 + 9), count: 0, isZero: false });
  scores.forEach(s => { buckets[Math.min(9, Math.floor(s / 10))].count++; });
  return { name, excluded: 0, bucketWidth: 10, letterOrder: ['A', 'B', 'C', 'D', 'F'], letters: L, stats: { n: scores.length }, buckets };
};

// A deliberately small XML check: tags nest, the document has one root, and text has no raw "<".
function wellFormed(svg) {
  const stack = []; let roots = 0;
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>|([^<]+)/g;
  let m, pos = 0;
  while ((m = re.exec(svg))) {
    if (m.index !== pos) return false; pos = re.lastIndex;
    if (m[5] !== undefined) { if (!stack.length) return false; continue; }
    if (m[1]) { if (stack.pop() !== m[2]) return false; continue; }
    if (!stack.length) roots++;
    if (!m[4]) stack.push(m[2]);
  }
  return pos === svg.length && !stack.length && roots === 1;
}

function check(C) {
  const bad = [];
  const ok = (c, msg) => { if (!c) bad.push(msg); };
  const ratio = (a, b) => C.contrastRatio(C.relativeLuminance(a), C.relativeLuminance(b));

  for (const [l, hex] of Object.entries(C.LETTER_HEX)) {
    const t = C.textColorFor(hex);
    ok(ratio(hex, t) >= 4.5, 'label contrast on ' + l + ' is ' + ratio(hex, t).toFixed(2));
  }
  for (let g = 0; g < 256; g += 8) {
    const h = '#' + [g, g, g].map(v => v.toString(16).padStart(2, '0')).join('');
    const pick = C.textColorFor(h), other = pick === C.INK_HEX ? '#ffffff' : C.INK_HEX;
    ok(ratio(h, pick) >= ratio(h, other), 'label colour on ' + h + ' is not the better one');
  }
  for (const r of RAMPS) for (const hex of r.stops) ok(C.relativeLuminance(hex) === mapLuminance(hex), 'luminance of ' + r.key + ' ' + hex + ' differs from the map\'s');
  ok(C.relativeLuminance('#000000') === 0 && Math.abs(C.relativeLuminance('#ffffff') - 1) < 1e-9, 'luminance endpoints');
  ok(Math.abs(C.contrastRatio(0, 1) - 21) < 1e-9, 'black on white is 21:1');

  const scores = [95, 91, 85, 72, 71, 65, 40, 30, 0, 0, 99, 88];
  const d = mk(scores, 'Quiz & <b>');
  const svg = C.stackedBar(d);
  ok(wellFormed(svg), 'stackedBar is not well-formed');
  ok(!svg.includes('<b>') && svg.includes('Quiz &amp; &lt;b&gt;'), 'stackedBar title not escaped');
  const barW = 640 - 40;
  const widths = [...svg.matchAll(/<rect x="[\d.]+" y="46" width="([\d.]+)" height="40" fill="[^"]*"\/>/g)].map(m => +m[1]);
  ok(Math.abs(widths.reduce((a, b) => a + b, 0) - barW) < 0.1 * widths.length, 'segment widths do not add up to the bar');
  ok(svg.includes('fill="url(#hatchF)"') && svg.includes('id="hatchF"'), 'F is painted with a pattern that is not defined');
  const legendTotals = [...svg.matchAll(/>([A-F]): (\d+) \(/g)].reduce((a, m) => a + +m[2], 0);
  ok(legendTotals === scores.length, 'legend counts do not add up to n');

  const h = mk(scores, 'H<i>');
  h.buckets.unshift({ start: 0, end: 0, label: '0', count: 2, isZero: true });
  const hs = C.histogram(h);
  ok(wellFormed(hs), 'histogram is not well-formed');
  ok(hs.includes('H&lt;i&gt;') && !hs.includes('<i>'), 'histogram title not escaped');
  ok(hs.includes('url(#hatchZero)') && hs.includes('id="hatchZero"') && hs.includes('0 (not submitted)'), 'zero bar lost its pattern or its label');
  const plotH = 330 - 50 - 50;
  const hts = [...hs.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)" fill="(?:#2e6b8f|url\(#hatchZero\))"\/>/g)].map(m => +m[1]);
  ok(hts.length === h.buckets.length, 'histogram drew ' + hts.length + ' bars for ' + h.buckets.length + ' buckets');
  const maxC = Math.max(...h.buckets.map(b => b.count));
  hts.forEach((v, i) => ok(Math.abs(v - h.buckets[i].count / maxC * plotH) < 0.01, 'bar ' + i + ' height is not its share of the tallest'));
  const empty = C.histogram(mk([]));
  ok(wellFormed(empty) && !/NaN|Infinity/.test(empty), 'an empty class draws NaN or breaks');
  ok(!/NaN|Infinity/.test(C.stackedBar(mk([]))), 'an empty class stacked bar draws NaN');
  const evil = mk([55]); evil.buckets[2].label = '<script>x</script>';
  ok(!C.histogram(evil).includes('<script>'), 'a bucket label reached the markup raw');
  ok(C.fmt(2.50) === '2.5' && C.fmt(3) === '3' && C.fmt(null) === '—' && C.fmt(NaN) === '—', 'fmt');
  return bad;
}

let failed = 0;
const real = check(loadChartSvg());
if (real.length) { failed++; real.forEach(b => console.error('FAIL  ' + b)); } else console.log('ok    every property holds on the module');

const MUTANTS = {
  'text colour: white always': s => s.replace(/return contrastRatio\(lum, relativeLuminance\(ink\)\) >= contrastRatio\(lum, 1\) \? ink : '#ffffff';/, "return '#ffffff';"),
  'text colour: ink always': s => s.replace(/return contrastRatio\(lum, relativeLuminance\(ink\)\) >= contrastRatio\(lum, 1\) \? ink : '#ffffff';/, 'return ink;'),
  'contrast ratio without the flare term': s => s.replace('(Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)', 'Math.max(l1, l2) / Math.min(l1, l2)'),
  'segments scaled to the wrong bar': s => s.replace('var w = barW * (pct / 100);', 'var w = barW * (pct / 100) * 0.9;'),
  'hatch pattern never defined': s => s.replace("hatchPattern('hatchF', o.letterHex.F", "hatchPattern('hatchX', o.letterHex.F"),
  'histogram heights off': s => s.replace('var h = (b.count / maxCount) * plotH;', 'var h = (b.count / (maxCount + 1)) * plotH;'),
  'empty class divides by zero': s => s.replace('|| 1;\n    var n = buckets.length;', ';\n    var n = buckets.length;'),
  'name not escaped (histogram)': s => s.replace("escapeXml((data.name || 'Assignment') + ' — Score histogram", "((data.name || 'Assignment') + ' — Score histogram"),
  'bucket label not escaped': s => s.replace("escapeXml(b.isZero ? '0 (not submitted)' : b.label)", "(b.isZero ? '0 (not submitted)' : b.label)"),
  'fmt shows NaN': s => s.replace("if (n == null || isNaN(n)) return '—';", ''),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = ['threw: ' + e.message]; }
  if (!r.length) { failed++; console.error('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name + ' (' + r[0] + ')');
}
if (failed) { console.error('\n' + failed + ' failure(s)'); process.exit(1); }
console.log('\nall chart-svg checks passed');
