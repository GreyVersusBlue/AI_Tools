// chart-scatter-notes.test.mjs — the scatter's annotation layer (Path 16 P5 step 4), pure Node.
//   - a note sits in DATA coordinates: a callout at x = 10 stays on the point whatever the axes (linear or log);
//   - a region is shaded and hatched (not colour alone), clipped to the plot, behind the points; arrows and callouts are on top;
//   - an arrow ends in a head at (x2, y2); a callout has a leader to its point and its box stays inside the plot;
//   - text is escaped and capped at 60 characters; a list is capped at 12; junk (NaN, strings, unknown types, a
//     zero-length arrow, a callout with no text) never reaches the picture;
//   - a note outside the plot, or at or below 0 on a log axis, is not drawn and is counted in the <desc>;
//   - every drawn note is in the <desc>, so a screen reader gets what the picture says;
//   - with no notes the chart is byte-identical (test:chart-svg-draw-parity holds the rest).
// Each property is then checked against a broken copy of the module, which must fail it.
//   node Tools/data-chart-builder/test/chart-scatter-notes.test.mjs   (npm run test:chart-scatter-notes)

import { loadChartSvg } from './_load-chart-svg.mjs';

const SC = { points: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(x => ({ x, y: x * 10 })), xLabel: 'Time', yLabel: 'Temp' };
const desc = svg => (svg.match(/<desc id="cs-desc">([^<]*)</) || [])[1] || '';

function check(C) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const plain = C.scatter(SC, {});
  ok(C.scatter(SC, { notes: [] }) === plain && C.scatter(SC, { notes: null }) === plain, 'empty notes change the chart');

  // callout: ring on the point (x = 10 is the last point, its circle), at the same pixels in linear and log
  for (const scale of [{}, { xScale: 'log', yScale: 'log' }]) {
    const svg = C.scatter(SC, { ...scale, notes: [{ type: 'callout', x: 10, y: 100, text: 'Boils <here> & now' }] });
    const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="4"/g)].map(m => [+m[1], +m[2]]);
    const last = circles[circles.length - 1];
    const ring = (svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="7"/) || []).slice(1).map(Number);
    ok(ring.length === 2 && Math.abs(ring[0] - last[0]) < 0.1 && Math.abs(ring[1] - last[1]) < 0.1, (scale.xScale ? 'log' : 'linear') + ': the ring is not on the point');
    ok(svg.includes('Boils &lt;here&gt; &amp; now') && !svg.includes('<here>'), 'callout text not escaped');
    ok(/Callout at 10, 100: Boils <here> & now\./.test(desc(svg).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')), 'callout not in the desc: ' + desc(svg));
    const box = svg.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="20" rx="4"/);
    ok(box && +box[1] >= 56 && +box[1] + +box[3] <= 616, 'the callout box leaves the plot sideways: ' + (box && box.slice(1)));
  }
  // near the top-right corner the box flips to the other side
  const corner = C.scatter(SC, { notes: [{ type: 'callout', x: 10, y: 100, text: 'A long label that would run off the right edge' }] });
  const cb = corner.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="20" rx="4"/);
  ok(cb && +cb[1] + +cb[3] <= 616 && +cb[2] >= 40, 'corner callout not flipped inside: ' + (cb && cb.slice(1)));

  // region: hatched pattern, clipped to the plot, under the points, label on top
  const reg = C.scatter(SC, { notes: [{ type: 'region', x1: 8, x2: 20, text: 'Plateau' }] });
  ok(/<pattern id="cs-nr"[^>]*patternTransform="rotate\(45\)"/.test(reg), 'region has no hatch pattern');
  ok(/<pattern id="cs-nr"[^>]*>[\s\S]*<line [^>]*stroke-width="1.2"[\s\S]*<\/pattern>/.test(reg), 'the region hatch has no lines (shading alone is colour only)');
  const rr = reg.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="url\(#cs-nr\)"/);
  ok(rr && +rr[1] + +rr[3] <= 616.01 && +rr[2] === 40, 'region not clipped to the plot: ' + (rr && rr.slice(1)));
  ok(rr && reg.indexOf('fill="url(#cs-nr)"') < reg.indexOf('<circle'), 'region is drawn over the points');
  ok(/Shaded region across 8 to 20: Plateau\./.test(desc(reg)), 'region desc: ' + desc(reg));
  ok(/>Plateau</.test(reg), 'region label missing');
  const band = C.scatter(SC, { notes: [{ type: 'region', x1: 2, x2: 4, y1: 20, y2: 60 }] });
  const bb = band.match(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="url\(#cs-nr\)"/);
  ok(bb && +bb[4] < 296 && +bb[4] > 20, 'a y band is full height: ' + (bb && bb.slice(1)));
  ok(/from 2 to 4 across, 20 to 60 up/.test(desc(band)), 'band desc: ' + desc(band));
  ok(!/pattern/.test(plain) && !/cs-nr/.test(C.scatter(SC, { notes: [{ type: 'arrow', x1: 1, y1: 10, x2: 5, y2: 50 }] })), 'a pattern is defined with no region');

  // arrow: head at (x2, y2), on top of the points
  const arr = C.scatter(SC, { notes: [{ type: 'arrow', x1: 2, y1: 80, x2: 5, y2: 50, text: 'Look <here>' }] });
  const pts = [...arr.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="4"/g)].map(m => [+m[1], +m[2]]);
  const headEnd = (arr.match(/<line x1="[\d.]+" y1="[\d.]+" x2="([\d.]+)" y2="([\d.]+)" stroke="#16222e" stroke-width="1.6"/) || []).slice(1).map(Number);
  ok(headEnd.length === 2 && Math.abs(headEnd[0] - pts[4][0]) < 0.1 && Math.abs(headEnd[1] - pts[4][1]) < 0.1, 'arrow head is not at the point (5, 50): ' + headEnd + ' vs ' + pts[4]);
  ok(/<polygon points="[^"]+" fill="#16222e"\/>/.test(arr), 'no arrow head');
  ok(arr.indexOf('stroke-width="1.6"') > arr.lastIndexOf('<circle cx') , 'arrow under the points');
  ok(/Arrow from 2, 80 to 5, 50: Look <here>\./.test(desc(arr).replace(/&lt;/g, '<').replace(/&gt;/g, '>')) && arr.includes('Look &lt;here&gt;'), 'arrow desc/escape');

  // not drawn, and counted
  const out = C.scatter(SC, { notes: [{ type: 'callout', x: 500, y: 5, text: 'far' }, { type: 'arrow', x1: 1, y1: 1000, x2: 5, y2: 50 }, { type: 'region', x1: 50, x2: 60 }] });
  ok(!/r="7"/.test(out) && !/stroke-width="1.6"/.test(out) && !/cs-nr/.test(out), 'a note outside the plot was drawn');
  ok(/3 notes outside the plot are not drawn\./.test(desc(out)), 'outside count: ' + desc(out));
  ok(/1 note outside the plot is not drawn\./.test(desc(C.scatter(SC, { notes: [{ type: 'callout', x: 500, y: 5, text: 'far' }] }))), 'singular');
  const lg = C.scatter(SC, { xScale: 'log', notes: [{ type: 'callout', x: 0, y: 5, text: 'zero' }, { type: 'callout', x: -3, y: 5, text: 'neg' }] });
  ok(!/r="7"/.test(lg) && /2 notes outside the plot/.test(desc(lg)), 'a note at or below 0 on a log axis');

  // cleaning
  const junk = C.cleanNotes([null, 5, 'x', {}, { type: 'weird', x: 1, y: 1 }, { type: 'callout', x: NaN, y: 1, text: 't' }, { type: 'callout', x: '3', y: 1, text: 't' },
    { type: 'callout', x: 1, y: 1, text: '' }, { type: 'arrow', x1: 1, y1: 1, x2: 1, y2: 1 }, { type: 'region', x1: 1 }, { type: 'region', x1: 5, x2: 2, y1: 9, y2: 3, text: 'ok' },
    { type: 'callout', x: 1, y: 2, text: 'a\nb\u0007c' }]);
  ok(junk.length === 2 && junk[0].x1 === 2 && junk[0].x2 === 5 && junk[0].y1 === 3 && junk[0].y2 === 9, 'cleaning kept junk or lost a region: ' + JSON.stringify(junk));
  ok(junk[1] && junk[1].text === 'a b c', 'control characters not flattened: ' + JSON.stringify(junk[1]));
  ok(C.cleanNotes([{ type: 'callout', x: 1, y: 1, text: 'x'.repeat(200) }])[0].text.length === 60, 'text not capped at 60');
  ok(C.cleanNotes(Array.from({ length: 30 }, (_, i) => ({ type: 'callout', x: i, y: i, text: 't' }))).length === 12, 'list not capped at 12');
  ok(C.cleanNotes('nope').length === 0 && C.cleanNotes(undefined).length === 0, 'non-list');
  ok(C.scatter(SC, { notes: [{ type: 'callout', x: '5', y: 5, text: 'str' }] }) === plain, 'a string coordinate was drawn');

  // multi-series charts take the layer too
  const multi = C.scatter({ ...SC, series: [{ label: 'A', points: SC.points }, { label: 'B', points: SC.points.map(p => ({ x: p.x, y: p.y / 2 })) }] }, { notes: [{ type: 'region', x1: 3, x2: 4, text: 'R' }] });
  ok(/<pattern id="cs-nr"/.test(multi) && /Shaded region across 3 to 4: R\./.test(desc(multi)), 'multi-series ignores the notes');
  return bad;
}

const real = check(loadChartSvg());
if (real.length) { console.log('FAIL\n  ' + real.join('\n  ')); process.exit(1); }
console.log('ok    notes: data coordinates, regions, arrows, callouts, cleaning, description');

const MUTANTS = {
  'callout text not escaped': s => s.replace("var t = escapeXml(n.text);", "var t = n.text;"),
  'text not capped': s => s.replace(".trim().slice(0, NOTE_TEXT_MAX);", ".trim();"),
  'list not capped': s => s.replace("if (out.length >= NOTE_MAX || !n", "if (!n"),
  'strings accepted as numbers': s => s.replace("typeof v === 'number' && isFinite(v) ? v : null", "isFinite(v) ? +v : null"),
  'region not clipped': s => s.replace("var x1 = clamp(n.x1, env.xLo, env.xHi), x2 = clamp(n.x2, env.xLo, env.xHi);", "var x1 = n.x1, x2 = n.x2;"),
  'region without hatch': s => s.replace('<line x1="0" y1="0" x2="0" y2="7" stroke="rgba(31,36,48,.35)" stroke-width="1.2"/>', ''),
  'region drawn over the points': s => s.replace("if (layer) parts.push(layer.under);", ""),
  'out-of-plot notes drawn': s => s.replace("return x >= env.xLo && x <= env.xHi && y >= env.yLo && y <= env.yHi;", "return true;"),
  'skipped not counted': s => s.replace("if (skipped) sentences.push(", "if (false) sentences.push("),
  'arrow head at the tail': s => s.replace("var ax = env.toX(n.x1), ay = env.toY(n.y1), bx = env.toX(n.x2), by = env.toY(n.y2);", "var ax = env.toX(n.x2), ay = env.toY(n.y2), bx = env.toX(n.x1), by = env.toY(n.y1);"),
  'callout box never flips': s => s.replace("var bxp = cx + 16 + w > right ? cx - 16 - w : cx + 16;", "var bxp = cx + 16;"),
  'notes not in the desc': s => s.replace("if (layer) desc += layer.desc;", ""),
  'zero-length arrow kept': s => s.replace("|| (q[0] === q[2] && q[1] === q[3])", ""),
  'multi-series drops the layer': s => s.replace("parts[0] = open(c, 'Scatter plot', desc, layer && layer.defs);", "parts[0] = open(c, 'Scatter plot', desc);"),
  'control characters kept': s => s.replace(".replace(/[\\u0000-\\u001f]+/g, ' ')", ""),
};
let failed = 0;
for (const [name, mutate] of Object.entries(MUTANTS)) {
  let r;
  try { r = check(loadChartSvg(mutate)); } catch (e) { r = [String(e.message)]; }
  if (!r.length) { failed++; console.log('FAIL  mutant survived: ' + name); } else console.log('ok    mutant caught: ' + name);
}
if (failed) process.exit(1);
console.log('\nall annotation checks passed');
