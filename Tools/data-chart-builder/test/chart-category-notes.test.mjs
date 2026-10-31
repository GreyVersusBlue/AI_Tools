// chart-category-notes.test.mjs — annotations on bar and line charts (BACKLOG row 76), pure Node.
//   - the x of a note is a CATEGORY NUMBER (1 = first row); a callout at category 3 sits on the centre of the third bar /
//     the third line point, at value y, wherever the axis is scaled;
//   - on a bar chart a band covers WHOLE categories (2 to 3 reaches half a slot past each centre); on a line chart it
//     runs from the first point to the second; arrows end in a head at the head point; callouts leave the plot clear;
//   - notes are under (bands) or over (arrows, callouts) the data, never mixed up; hatch, not colour alone;
//   - the <desc> names each category ("category 2 (Tue)"), counts what is outside the plot, and a screen reader gets it all;
//   - the scatter's notes are untouched, and with no notes bar and line are byte-identical (test:chart-svg-draw-parity
//     holds the rest);
//   - junk (strings, NaN, categories outside 1..n, values above the axis) never reaches the picture.
// Each property is then checked against a broken copy of the module, which must fail it.
//   node Tools/data-chart-builder/test/chart-category-notes.test.mjs   (npm run test:chart-category-notes)

import { loadChartSvg } from './_load-chart-svg.mjs';

const BUILT = { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ label: 'Reps', color: '#6c8ef5', values: [3, 8, 5, 9, 4] }] };
const desc = svg => (svg.match(/<desc id="cs-desc">([^<]*)</) || [])[1] || '';
const plain = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// geometry of the default 640 x 400 chart: plot 560 wide from x = 56, 296 tall from y = 40, axis top read off the chart
const LEFT = 56, TOP = 40, PW = 560, PH = 296;

function check(C) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const near = (a, b) => Math.abs(a - b) < 0.11;
  for (const kind of ['bar', 'line']) {
    const draw = (notes) => C[kind](BUILT, { notes });
    const base = C[kind](BUILT, {});
    ok(draw([]) === base && draw(null) === base, kind + ': empty notes change the chart');
    ok(!/cs-nr|r="7"/.test(base), kind + ': an unannotated chart has note marks');
  }

  // callout position: category 3 (index 2), value 5
  const slot = PW / 5;
  const barCx = LEFT + slot * 2.5;
  const lineCx = LEFT + (PW / 4) * 2;
  const AXIS = Number((C.bar(BUILT, {}).match(/<text x="48" y="44" text-anchor="end"[^>]*>([\d.]+)<\/text>/) || [])[1]);
  ok(AXIS >= 9, 'could not read the top of the value axis: ' + AXIS);
  const cy = v => TOP + PH - (v / AXIS) * PH;
  const circ = svg => (svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="7"/) || []).slice(1).map(Number);
  const bc = circ(C.bar(BUILT, { notes: [{ type: 'callout', x: 3, y: 5, text: 'Boils <here> & now' }] }));
  ok(bc.length === 2 && near(bc[0], barCx) && near(bc[1], cy(5)), 'bar callout is not on the third bar centre: ' + bc + ' want ' + [barCx, cy(5)]);
  const lc = circ(C.line(BUILT, { notes: [{ type: 'callout', x: 3, y: 5, text: 'x' }] }));
  ok(lc.length === 2 && near(lc[0], lineCx) && near(lc[1], cy(5)), 'line callout is not on the third point: ' + lc + ' want ' + [lineCx, cy(5)]);
  const eb = C.bar(BUILT, { notes: [{ type: 'callout', x: 3, y: 5, text: 'Boils <here> & now' }] });
  ok(eb.includes('Boils &lt;here&gt; &amp; now') && !eb.includes('<here>'), 'callout text not escaped');
  ok(plain(desc(eb)).includes('Callout at category 3 (Wed), 5: Boils <here> & now.'), 'callout not named by category in the desc: ' + desc(eb));
  ok(C.line(BUILT, { notes: [{ type: 'callout', x: 2.5, y: 5, text: 'between' }] }).includes('Callout at category 2.5, 5'), 'a fractional category is named plainly');

  // regions: bar = whole categories, line = point to point; hatched; under the data
  const rb = C.bar(BUILT, { notes: [{ type: 'region', x1: 2, x2: 3, text: 'Practice days' }] });
  const rect = rb.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="url\(#cs-nr\)"/);
  ok(rect && near(+rect[1], LEFT + slot) && near(+rect[3], slot * 2) && near(+rect[2], TOP) && near(+rect[4], PH), 'bar band is not categories 2 and 3 in full, full height: ' + (rect && rect.slice(1)));
  ok(/<pattern id="cs-nr"/.test(rb) && /<line x1="0" y1="0" x2="0" y2="7"/.test(rb), 'bar band is not hatched');
  ok(rb.indexOf('cs-nr)') < rb.indexOf('fill="#6c8ef5"', rb.indexOf('cs-nr)')), 'bar band is not under the bars');
  ok(plain(desc(rb)).includes('Shaded region across category 2 (Tue) to category 3 (Wed): Practice days.'), 'bar band desc: ' + desc(rb));
  const rl = C.line(BUILT, { notes: [{ type: 'region', x1: 2, x2: 3, y1: 2, y2: 6 }] });
  const rect2 = rl.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="url\(#cs-nr\)"/);
  ok(rect2 && near(+rect2[1], LEFT + PW / 4) && near(+rect2[3], PW / 4) && near(+rect2[2], cy(6)) && near(+rect2[4], cy(2) - cy(6)), 'line band is not point 2 to point 3, values 2 to 6: ' + (rect2 && rect2.slice(1)));
  const clip = C.bar(BUILT, { notes: [{ type: 'region', x1: 0, x2: 9 }] }).match(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*fill="url\(#cs-nr\)"/);
  ok(clip && near(+clip[1], LEFT) && near(+clip[2], PW), 'a band wider than the chart is not clipped to the plot: ' + (clip && clip.slice(1)));

  // arrows: head at (x2, y2), over the data
  const ar = C.line(BUILT, { notes: [{ type: 'arrow', x1: 5, y1: 9, x2: 4, y2: 9, text: 'Look <here>' }] });
  const headEnd = (ar.match(/<line x1="[\d.]+" y1="[\d.]+" x2="([\d.]+)" y2="([\d.]+)" stroke="#16222e" stroke-width="1.6"/) || []).slice(1).map(Number);
  ok(headEnd.length === 2 && near(headEnd[0], LEFT + (PW / 4) * 3) && near(headEnd[1], cy(9)), 'arrow head is not on category 4, value 9: ' + headEnd);
  ok(/<polygon points="[^"]+" fill="#16222e"\/>/.test(ar), 'no arrow head');
  ok(ar.indexOf('stroke-width="1.6"') > ar.lastIndexOf('<circle cx'), 'arrow under the line points');
  ok(plain(desc(ar)).includes('Arrow from category 5 (Fri), 9 to category 4 (Thu), 9: Look <here>.'), 'arrow desc: ' + desc(ar));
  const ab = C.bar(BUILT, { notes: [{ type: 'arrow', x1: 1, y1: 9, x2: 2, y2: 8 }] });
  ok(ab.indexOf('stroke-width="1.6"') > ab.lastIndexOf('rx="2"'), 'bar arrow is under the bars');

  // outside the plot is counted, not drawn
  const out = C.bar(BUILT, { notes: [{ type: 'callout', x: 9, y: 5, text: 'far' }, { type: 'callout', x: 3, y: 99, text: 'high' }, { type: 'callout', x: 0, y: 5, text: 'zero' }, { type: 'arrow', x1: 1, y1: 1, x2: 8, y2: 1 }] });
  ok(!/r="7"/.test(out) && !/stroke-width="1.6"/.test(out), 'a note outside the plot was drawn');
  ok(/4 notes outside the plot are not drawn\./.test(desc(out)), 'outside count: ' + desc(out));
  ok(/1 note outside the plot is not drawn\./.test(desc(C.bar(BUILT, { notes: [{ type: 'callout', x: 9, y: 5, text: 'far' }] }))), 'singular');
  ok(/r="7"/.test(C.bar(BUILT, { notes: [{ type: 'callout', x: 0.5, y: 5, text: 'edge' }] })), 'the left edge of a bar chart (category 0.5) is inside');

  // one category: nothing divides by zero
  const one = { categories: ['Only'], series: [{ label: 'R', color: '#6c8ef5', values: [4] }] };
  const l1 = C.line(one, { notes: [{ type: 'callout', x: 1, y: 2, text: 'one' }, { type: 'region', x1: 1, x2: 1 }] });
  ok(!/NaN|Infinity/.test(l1) && /r="7"/.test(l1), 'a one-point line chart breaks the notes: ' + l1.slice(0, 120));
  ok(!/NaN|Infinity/.test(C.bar(one, { notes: [{ type: 'region', x1: 1, x2: 1 }] })), 'a one-bar chart breaks the notes');

  // junk never reaches the picture
  ok(C.bar(BUILT, { notes: [{ type: 'callout', x: '3', y: 5, text: 'str' }, { type: 'callout', x: NaN, y: 5, text: 'nan' }, { type: 'weird', x: 1, y: 1 }] }) === C.bar(BUILT, {}), 'junk notes changed the chart');

  // scatter is untouched (its own suite holds the detail): same call, same words
  const SC = { points: [1, 2, 3].map(x => ({ x, y: x * 10 })), xLabel: 'T', yLabel: 'V' };
  ok(/Callout at 2, 20: hi\./.test(desc(C.scatter(SC, { notes: [{ type: 'callout', x: 2, y: 20, text: 'hi' }] }))), 'the scatter callout sentence changed');
  ok(/Shaded region across 1 to 2\./.test(desc(C.scatter(SC, { notes: [{ type: 'region', x1: 1, x2: 2 }] }))), 'the scatter region sentence changed');
  return bad;
}

const real = check(loadChartSvg());
if (real.length) { console.log('FAIL\n  ' + real.join('\n  ')); process.exit(1); }
console.log('ok    category notes: positions, bands, arrows, callouts, clipping, description, one category, junk, scatter untouched');

const MUTANTS = {
  'bar x not centred on the category': s => s.replace("PAD.left + slot * (x - 0.5) : (n === 1", "PAD.left + slot * (x - 1) : (n === 1"),
  'line x off by one': s => s.replace("PAD.left + slot * (x - 1))); }", "PAD.left + slot * x)); }"),
  'bar band not widened to whole categories': s => s.replace("regionPad: isBar ? 0.5 : 0", "regionPad: 0"),
  'line band widened too': s => s.replace("regionPad: isBar ? 0.5 : 0", "regionPad: 0.5"),
  'y not scaled to the axis': s => s.replace("return PAD.top + plotH - (v / maxVal) * plotH; }\n    function xText", "return PAD.top + plotH - v * plotH / 10; }\n    function xText"),
  'category not named in the desc': s => s.replace("return 'category ' + formatNum(x) + name;", "return formatNum(x);"),
  'region not clipped': s => s.replace("var x1 = clamp(n.x1 - rp, env.xLo, env.xHi), x2 = clamp(n.x2 + rp, env.xLo, env.xHi);", "var x1 = n.x1 - rp, x2 = n.x2 + rp;"),
  'bar notes drawn over the bars it should sit under': s => s.replace("    if (layer) parts.push(layer.under);\n    built.categories.forEach(function (cat, i) {", "    built.categories.forEach(function (cat, i) {"),
  'line over-layer dropped': s => s.replace("    if (layer) parts.push(layer.over);\n    parts.push(seriesLegend(c, built.series));\n    parts.push('</svg>');\n    return parts.join('');\n  }\n\n  function pie", "    parts.push(seriesLegend(c, built.series));\n    parts.push('</svg>');\n    return parts.join('');\n  }\n\n  function pie"),
  'notes missing from the bar desc': s => s.replace("categoryDesc('Bar chart', built, c) + (layer ? layer.desc : '')", "categoryDesc('Bar chart', built, c)"),
  'bar hatch pattern defs dropped': s => s.replace(" + (layer ? layer.defs : '')), titleEl(c), axes(c, maxVal, built.categories)", "), titleEl(c), axes(c, maxVal, built.categories)"),
  'out-of-plot notes drawn': s => s.replace("return x >= env.xLo && x <= env.xHi && y >= env.yLo && y <= env.yHi;", "return true;"),
  'scatter sentence uses the category words': s => s.replace("sentences.push('Callout at ' + xs(n.x) + ', '", "sentences.push('Callout at category ' + xs(n.x) + ', '"),
  'strings accepted as numbers': s => s.replace("typeof v === 'number' && isFinite(v) ? v : null", "isFinite(v) ? +v : null"),
};
let failed = 0;
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = [String(e.message)]; }
  if (!r.length) { failed++; console.log('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name);
}
if (failed) process.exit(1);
console.log('\nall category-annotation checks passed');
