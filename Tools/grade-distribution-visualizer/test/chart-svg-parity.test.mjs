// chart-svg-parity.test.mjs — _shared/chart-svg.js against 037's chart code as it was
// inline in the page before Path 16 P1 moved it (_legacy-chart.mjs, frozen). Both get the
// same data and must give byte-identical SVG and the same colour arithmetic:
//   - stackedBar and histogram over a grid of score sets x cutoff sets x bucket widths x
//     names (plain, with markup characters, empty) x excluded counts, including an empty
//     class, all zeros, a lone score and scores past 100;
//   - relativeLuminance / contrastRatio / textColorFor on every ramp step and a sweep of greys;
//   - fmt on a spread of numbers; escapeXml; nCaption.
// Then the same comparison is run against deliberately broken copies of the module and
// must FAIL on each, so the check cannot pass on a module that no longer matches.
//
//   node Tools/grade-distribution-visualizer/test/chart-svg-parity.test.mjs   (npm run test:chart-svg-parity)
// Pure Node, no browser, no port. Exits 1 on any failure.

import * as Old from './_legacy-chart.mjs';
import { loadChartSvg } from './_load-chart-svg.mjs';

function letters(scores, c) {
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of scores) {
    if (s >= c.A) counts.A++; else if (s >= c.B) counts.B++; else if (s >= c.C) counts.C++;
    else if (s >= c.D) counts.D++; else counts.F++;
  }
  return counts;
}

const SCORE_SETS = [
  [], [0], [0, 0, 0], [100], [57], [105, 99, 120, 88],
  [92, 88, 75, 61, 59, 0, 0, 45, 100, 83, 77, 71, 66, 91, 90, 80, 70, 60],
  Array.from({ length: 60 }, (_, i) => (i * 37) % 101),
  Array.from({ length: 25 }, () => 85),
  [89.5, 79.99, 69.5, 59.5, 90, 80, 70, 60, 0.5],
];
const CUTOFFS = [{ A: 90, B: 80, C: 70, D: 60 }, { A: 93, B: 85, C: 75, D: 65 }, { A: 50, B: 40, C: 30, D: 0 }];
const NAMES = ['Unit 3 Quiz', 'A & B <test> "x"', '', undefined];
const EXCLUDED = [0, 1, 7];
const WIDTHS = [5, 10, 20, 25];

function* cases() {
  for (const scores of SCORE_SETS) for (const c of CUTOFFS) for (const w of WIDTHS) for (const name of NAMES) for (const ex of EXCLUDED) {
    const lt = letters(scores, c);
    yield {
      name, excluded: ex, bucketWidth: w, letterOrder: ['A', 'B', 'C', 'D', 'F'], letters: lt,
      stats: { n: scores.length }, buckets: Old.buildBuckets(scores, w),
    };
  }
  // Bucket labels are digits today; a label with markup must still be escaped.
  const d = { name: 'x', excluded: 0, bucketWidth: 10, letterOrder: ['A', 'B', 'C', 'D', 'F'], letters: letters([50], CUTOFFS[0]), stats: { n: 1 }, buckets: Old.buildBuckets([50], 10) };
  d.buckets[1].label = 'a<b & "c"';
  yield d;
}

// Returns the list of mismatches for a ChartSvg against the frozen code.
function diff(New) {
  const bad = [];
  let n = 0;
  for (const d of cases()) {
    n++;
    if (New.stackedBar(d) !== Old.buildStackedBarSvg(d)) bad.push('stackedBar #' + n);
    if (New.histogram(d) !== Old.buildHistogramSvg(d)) bad.push('histogram #' + n);
    if (New.nCaption(d) !== Old.nCaption(d)) bad.push('nCaption #' + n);
  }
  const hexes = Object.values(Old.LETTER_HEX).concat([Old.ZERO_HEX, Old.INK_HEX, '#ffffff', '#000000']);
  for (let g = 0; g < 256; g += 5) { const h = '#' + [g, g, g].map(v => v.toString(16).padStart(2, '0')).join(''); hexes.push(h); }
  for (const h of hexes) {
    if (New.relativeLuminance(h) !== Old.relLuminance(h)) bad.push('luminance ' + h);
    if (New.textColorFor(h) !== Old.textColorFor(h)) bad.push('textColorFor ' + h);
    for (const k of hexes) if (New.contrastRatio(New.relativeLuminance(h), New.relativeLuminance(k)) !== Old.contrastRatio(Old.relLuminance(h), Old.relLuminance(k))) bad.push('contrast ' + h + k);
  }
  for (const v of [0, 1, 0.5, 12.3456, 100, 99.95, -3.2, NaN, null, undefined, 1e6]) for (const dp of [undefined, 0, 1, 2]) {
    if (New.fmt(v, dp) !== Old.fmt(v, dp)) bad.push('fmt ' + v + ',' + dp);
  }
  for (const s of ['a&b', '<x>', 'say "hi"', 7, '']) if (New.escapeXml(s) !== Old.escapeXml(s)) bad.push('escapeXml ' + s);
  if (New.hatchPattern('hatchF', Old.LETTER_HEX.F, 'rgba(31,36,48,.35)').length === 0) bad.push('hatchPattern empty');
  return { bad, n };
}

let failed = 0;
const real = diff(loadChartSvg());
if (real.bad.length) { failed++; console.error('FAIL  module differs from 037\'s old code: ' + real.bad.slice(0, 8).join('; ') + (real.bad.length > 8 ? ' …(+' + (real.bad.length - 8) + ')' : '')); }
else console.log('ok    ' + real.n + ' data cases x 2 builders, the colour arithmetic and fmt/escape all identical to 037\'s old code');

// Each mutant changes one behaviour that 037's charts depend on; the parity check must notice.
const MUTANTS = {
  'label colour: white always wins': s => s.replace(/>= contrastRatio\(lum, 1\)/, '< contrastRatio(lum, 1)'),
  'luminance: wrong green weight': s => s.replace('0.7152', '0.7'),
  'F stays unhatched': s => s.replace("l === 'F' ? 'url(#hatchF)'", "l === 'Z' ? 'url(#hatchF)'"),
  'zero bar loses its hatch': s => s.replace("b.isZero ? 'url(#hatchZero)'", "b.isZero ? '#6b6a63'"),
  'n caption drops the excluded count': s => s.replace("if (data.excluded) s +=", "if (false) s +="),
  'labels not escaped': s => s.replace("escapeXml(b.isZero ? '0 (not submitted)' : b.label)", "(b.isZero ? '0 (not submitted)' : b.label)"),
  'title not escaped': s => s.replace("escapeXml((data.name || 'Assignment') + ' — Letter-grade breakdown')", "((data.name || 'Assignment') + ' — Letter-grade breakdown')"),
  'segment labels shown at any size': s => s.replace('if (pct >= 6)', 'if (pct >= 0)'),
  'histogram axis moves': s => s.replace('stroke-width="1.5"/>\' +\n      bars', 'stroke-width="2"/>\' +\n      bars'),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  const r = diff(loadChartSvg(mutate));
  if (r.bad.length === 0) { failed++; console.error('FAIL  mutant survived: ' + name); }
  else console.log('ok    mutant caught: ' + name + ' (' + r.bad.length + ' mismatches)');
}

if (failed) { console.error('\n' + failed + ' failure(s)'); process.exit(1); }
console.log('\nall chart-svg parity checks passed');
