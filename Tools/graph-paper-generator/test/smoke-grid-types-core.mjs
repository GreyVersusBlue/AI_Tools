// smoke-grid-types-core.mjs — the geometry of the graph paper tool's newer sheets, in plain Node.
//
//   node Tools/graph-paper-generator/test/smoke-grid-types-core.mjs
//
// Polar paper, log and semi-log paper and the number-line kinds (integers with zero marked,
// decimals, fractions and mixed numbers, open, double, vertical/thermometer) are drawn by
// gpg-render.js with no DOM. This suite reads the SVG each one returns and checks the
// geometry off the numbers: rays at equal angles, circles at equal radii, log lines at
// log10 of 2..9, every fraction and decimal tick where its ratio says, labels in lowest
// terms. The isometric sheets that already existed are pinned the same way (their angles
// and spacing), and every sheet drawn before these were added must come out byte for byte
// the same (golden-old-render.json, hashes recorded from the page before the change).
//
// GPG_RENDER=<path> reads another copy of the renderer: the break-on-purpose runs use it.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);

console.log('Graph Paper — the geometry of the newer grids and number lines');

const here = path.dirname(fileURLToPath(import.meta.url));
const renderPath = process.env.GPG_RENDER || path.join(here, '..', 'gpg-render.js');
const sandbox = {};
new Function('global', readFileSync(renderPath, 'utf8') + '\n;return global;')(sandbox);
const R = sandbox.GraphPaperRender;
for (const name of ['renderPolarPaper', 'renderLogPaper', 'renderFractionLine', 'renderDecimalLine', 'renderOpenLine',
  'renderDoubleLine', 'renderVerticalLine', 'renderHexPaper', 'renderStoryboard', 'renderMusicStaves', 'fractionLabelParts', 'decimalLabel', 'logAxisLines', 'expLabel']) {
  ok(typeof R[name] === 'function', `the renderer exposes ${name}`);
}

const MARGIN = 0.35, THIN = 0.008, BOLD = 0.022, MID = 0.012;
const PAGES = { portrait: { w: 8.5, h: 11 }, landscape: { w: 11, h: 8.5 } };
const HEADER = { title: 'Name & Date', showName: true, showDate: true };
const HEADER_H = 0.55;
const sha = (s) => createHash('sha256').update(s).digest('hex');
const TICK_W = 0.0128;

/* ── SVG readers ───────────────────────────────────────────────────────── */
const num = (s) => parseFloat(s);
function parse(svg) {
  const attr = (tag, name) => { const m = new RegExp(name + '="([^"]*)"').exec(tag); return m ? m[1] : null; };
  const lines = [...svg.matchAll(/<line [^>]*\/>/g)].map(m => ({
    x1: num(attr(m[0], 'x1')), y1: num(attr(m[0], 'y1')), x2: num(attr(m[0], 'x2')), y2: num(attr(m[0], 'y2')),
    w: num(attr(m[0], 'stroke-width')), dashed: /stroke-dasharray/.test(m[0]),
  }));
  const circles = [...svg.matchAll(/<circle [^>]*\/>/g)].map(m => ({
    cx: num(attr(m[0], 'cx')), cy: num(attr(m[0], 'cy')), r: num(attr(m[0], 'r')),
    hollow: attr(m[0], 'fill') === 'none', w: num(attr(m[0], 'stroke-width')),
  }));
  const texts = [...svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)].map(m => ({
    x: num(attr(m[1], 'x')), y: num(attr(m[1], 'y')), size: num(attr(m[1], 'font-size')),
    anchor: attr(m[1], 'text-anchor'), s: m[2],
  })).filter(t => t.size !== 0.2 && t.size !== 0.13); // the header block's own sizes: title and name/date line
  const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => num(m[1]));
  const paths = [...svg.matchAll(/<path d="([^"]*)"/g)].map(m => m[1]);
  return { lines, circles, texts, widths, paths };
}
// Points that agree to within 2e-3in are one point: a coordinate rounded to a fixed number of decimals
// splits one corner in two whenever it lands on the rounding boundary.
function pointIndex() {
  const cells = new Map(), pts = [];
  const find = (x, y) => {
    const cx = Math.floor(x / 0.01), cy = Math.floor(y / 0.01);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const id of cells.get((cx + i) + ',' + (cy + j)) || []) if (Math.hypot(pts[id][0] - x, pts[id][1] - y) < 2e-3) return id;
    }
    return -1;
  };
  const id = (x, y) => {
    let k = find(x, y);
    if (k >= 0) return k;
    k = pts.length; pts.push([x, y]);
    const c = Math.floor(x / 0.01) + ',' + Math.floor(y / 0.01);
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c).push(k);
    return k;
  };
  return { id, find, pts };
}
const clusterValues = (vals, tol = 0.01) => { const out = []; for (const v of sorted(vals)) if (!out.length || v - out[out.length - 1] > tol) out.push(v); return out; };
const horiz = (l) => Math.abs(l.y1 - l.y2) < 1e-9;
const vert = (l) => Math.abs(l.x1 - l.x2) < 1e-9;
const sorted = (a) => [...a].sort((p, q) => p - q);
const diffs = (a) => a.slice(1).map((v, i) => v - a[i]);
const allNear = (a, v, tol) => a.every(d => Math.abs(d - v) <= tol);

// A sheet is on the paper when every line, circle and arc stays inside the margin and
// every label stays on the sheet.
function onPaper(svg, page, headerH, label) {
  const g = parse(svg);
  const lo = MARGIN - 1e-3, hiX = page.w - MARGIN + 1e-3, hiY = page.h - MARGIN + 1e-3;
  const bad = [];
  for (const l of g.lines) {
    for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) if (x < lo || x > hiX || y < lo || y > hiY) bad.push(['line', x, y]);
  }
  for (const c of g.circles) {
    if (c.cx - c.r < lo || c.cx + c.r > hiX || c.cy - c.r < lo || c.cy + c.r > hiY) bad.push(['circle', c.cx, c.cy, c.r]);
  }
  for (const t of g.texts) if (t.x < 0.1 || t.x > page.w - 0.1 || t.y < 0.1 || t.y > page.h - 0.1) bad.push(['text', t.s, t.x, t.y]);
  for (const w of g.widths) if (!(w >= THIN - 1e-9)) bad.push(['hairline', w]);
  ok(bad.length === 0, `${label}: nothing past the margin, nothing thinner than ${THIN}in ${JSON.stringify(bad.slice(0, 3))}`);
  if (headerH) {
    const under = g.lines.filter(l => Math.min(l.y1, l.y2) < MARGIN + headerH - 0.06 + 1e-3 && !(horiz(l) && Math.abs(l.y1 - (MARGIN + headerH - 0.06)) < 1e-3));
    ok(under.length === 0, `${label}: nothing is drawn over the header block`);
  }
}
function fits(svg, page) {
  return new RegExp(`width="${page.w}in" height="${page.h}in"`).test(svg) && new RegExp(`viewBox="0 0 ${page.w} ${page.h}"`).test(svg);
}

/* ── 1. what was drawn before is unchanged ─────────────────────────────── */
console.log('1. the sheets drawn before these existed');
{
  const golden = JSON.parse(readFileSync(path.join(here, 'golden-old-render.json'), 'utf8')).renderer;
  const hdr = { title: 'Name & Date', showName: true, showDate: true };
  const cases = {};
  for (const o of ['portrait', 'landscape']) for (const faded of [false, true]) for (const header of [null, hdr]) {
    const b = { orientation: o, faded, header };
    const k = `${o}|${faded}|${header ? 'h' : 'n'}`;
    cases['square|' + k] = R.renderGraphPaper({ ...b, style: 'square', mode: 'fill', cellSize: 0.25, boldCenter: true, labelAxes: true, labelInterval: 5 }).svg;
    cases['squareExact|' + k] = R.renderGraphPaper({ ...b, style: 'square', mode: 'exact', cols: 10, rows: 12 }).svg;
    cases['dot|' + k] = R.renderGraphPaper({ ...b, style: 'dot', mode: 'fill', cellSize: 0.5 }).svg;
    cases['iso|' + k] = R.renderGraphPaper({ ...b, style: 'isometric', mode: 'fill', cellSize: 0.5 }).svg;
    cases['isoDot|' + k] = R.renderGraphPaper({ ...b, style: 'isometricDot', mode: 'fill', cellSize: 0.3937 }).svg;
    cases['nl|' + k] = R.renderNumberLine({ ...b, min: -5, max: 5, interval: 0.5, labelEvery: 2, copies: 3 }).svg;
    cases['nlRows|' + k] = R.renderNumberLine({ ...b, rows: [{ min: 0, max: 10, interval: 1 }, { min: -1, max: 1, interval: 0.25 }], labelEvery: 1 }).svg;
    cases['plane4|' + k] = R.renderCoordinatePlane({ ...b, quadrants: 'four', xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5, copies: 4 }).svg;
    cases['plane1|' + k] = R.renderCoordinatePlane({ ...b, quadrants: 'first', xMin: 0, xMax: 12, yMin: 0, yMax: 8, interval: 2, labelEvery: 1, copies: 1 }).svg;
    cases['ws|' + k] = R.renderWorksheet({ ...b, copies: 4, quadrants: 'four', xMin: -10, xMax: 10, yMin: -10, yMax: 10, interval: 1, labelEvery: 5, problems: ['y = 2x + 3', 'y = x^2 - 4', 'y = -x', 'y = 0.5x'], showAnswer: true }).svg;
    cases['cornell|' + k] = R.renderCornellNotes({ ...b, cueWidth: 2.5, summaryHeight: 2, ruleSpacing: 0.34 }).svg;
    cases['hw|' + k] = R.renderHandwritingLines({ ...b, lineHeight: 0.5 }).svg;
  }
  cases['calib|p'] = R.renderCalibration({ orientation: 'portrait' }).svg;
  cases['calib|l'] = R.renderCalibration({ orientation: 'landscape' }).svg;
  eq(Object.keys(cases).length, Object.keys(golden).length, 'the golden covers every case drawn here');
  const differing = Object.keys(cases).filter(k => sha(cases[k]) !== golden[k]);
  ok(differing.length === 0, `all ${Object.keys(cases).length} older sheets come out byte for byte as recorded ${JSON.stringify(differing.slice(0, 4))}`);
}

/* ── 2. isometric paper that already existed, pinned ───────────────────── */
console.log('2. isometric line and dot paper (existing)');
{
  const cell = 0.5;
  for (const o of ['portrait', 'landscape']) {
    const out = R.renderGraphPaper({ orientation: o, style: 'isometric', mode: 'fill', cellSize: cell, header: null });
    const g = parse(out.svg);
    const fam = { 30: [], 90: [], 150: [] };
    let stray = 0;
    for (const l of g.lines) {
      if (Math.hypot(l.x2 - l.x1, l.y2 - l.y1) < 0.01) continue; // a corner the clip left as a point
      let a = Math.atan2(-(l.y2 - l.y1), l.x2 - l.x1) * 180 / Math.PI; // maths angle, y up
      a = ((a % 180) + 180) % 180;
      const key = [30, 90, 150].find(t => Math.abs(a - t) < 0.05);
      if (key === undefined) { stray++; continue; }
      // perpendicular distance from the origin: the signed offset of this line's family
      // signed distance from the origin along the family's normal, direction made consistent
      let dx = l.x2 - l.x1, dy = l.y2 - l.y1;
      if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      const len = Math.hypot(dx, dy);
      fam[key].push((-dy / len) * l.x1 + (dx / len) * l.y1);
    }
    eq(stray, 0, `${o}: every isometric line is at 30, 90 or 150 degrees, exactly 60 apart`);
    for (const key of [30, 90, 150]) {
      const offs = sorted(fam[key]);
      ok(offs.length > 5, `${o}: family ${key} has lines`);
      // lines of one family are equally spaced, a triangle's height apart
      const gaps = diffs(offs).filter(d => d > 1e-6);
      const want = cell * Math.sqrt(3) / 2;
      ok(allNear(gaps, want, 2e-3), `${o}: family ${key} is spaced a triangle's height (${want.toFixed(4)}in) apart`);
    }
  }
  const dots = parse(R.renderGraphPaper({ orientation: 'portrait', style: 'isometricDot', mode: 'fill', cellSize: cell, header: null }).svg).circles;
  const ys = [...new Set(dots.map(d => d.cy.toFixed(3)))].map(Number).sort((a, b) => a - b);
  ok(allNear(diffs(ys), cell * Math.sqrt(3) / 2, 1e-3), 'isometric dots: rows are a triangle height apart');
  const row0 = dots.filter(d => Math.abs(d.cy - ys[0]) < 1e-3).map(d => d.cx).sort((a, b) => a - b);
  const row1 = dots.filter(d => Math.abs(d.cy - ys[1]) < 1e-3).map(d => d.cx).sort((a, b) => a - b);
  ok(allNear(diffs(row0), cell, 1e-3), 'isometric dots: neighbours in a row are one side length apart');
  near(row1[0] - row0[0], cell / 2, 1e-3, 'isometric dots: the next row is shifted half a side');
  // every dot is exactly one side from six neighbours, so the lattice is equilateral
  const d0 = dots.find(d => Math.abs(d.cy - ys[3]) < 1e-3 && d.cx > 2 && d.cx < 5);
  const near6 = dots.filter(d => { const dist = Math.hypot(d.cx - d0.cx, d.cy - d0.cy); return dist > 1e-6 && Math.abs(dist - cell) < 2e-3; });
  eq(near6.length, 6, 'isometric dots: each dot has six neighbours exactly one side away');
}

/* ── 3. polar paper ────────────────────────────────────────────────────── */
console.log('3. polar graph paper');
for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER]) for (const rays of [12, 16, 24]) for (const ringStep of [0.25, 0.3937, 0.5, 1]) {
  const tag = `polar ${orientation}${header ? '+header' : ''} ${rays} rays @${ringStep}`;
  const page = PAGES[orientation];
  const out = R.renderPolarPaper({ orientation, rays, ringStep, labels: true, header });
  const g = parse(out.svg);
  ok(fits(out.svg, page), `${tag}: sized in inches, viewBox to match`);
  const cx = out.cx, cy = out.cy;
  const headerH = header ? HEADER_H : 0;
  near(cx, page.w / 2, 1e-6, `${tag}: centred across the page`);
  near(cy, MARGIN + headerH + (page.h - 2 * MARGIN - headerH) / 2, 1e-6, `${tag}: centred in the room below the header`);
  // rays: every line that starts at the centre
  const rayLines = g.lines.filter(l => Math.hypot(l.x1 - cx, l.y1 - cy) < 1e-3 && Math.hypot(l.x2 - cx, l.y2 - cy) > 0.5);
  eq(rayLines.length, rays, `${tag}: ${rays} rays`);
  const angles = sorted(rayLines.map(l => (Math.atan2(cy - l.y2, l.x2 - cx) * 180 / Math.PI + 360) % 360));
  ok(allNear(diffs(angles), 360 / rays, 0.01), `${tag}: rays are exactly ${360 / rays} degrees apart`);
  near(angles[0], 0, 0.01, `${tag}: the first ray is at 0`);
  ok(rayLines.every(l => Math.abs(Math.hypot(l.x2 - cx, l.y2 - cy) - out.outer) < 2e-4), `${tag}: every ray reaches the outer circle and no further`);
  // circles: concentric, equal radius steps
  const rings = g.circles.filter(c => c.hollow).sort((a, b) => a.r - b.r);
  ok(rings.length >= 1 && rings.every(c => Math.abs(c.cx - cx) < 1e-3 && Math.abs(c.cy - cy) < 1e-3), `${tag}: circles share the centre`);
  ok(rings.every((c, i) => Math.abs(c.r - (i + 1) * ringStep) < 2e-4), `${tag}: circle k has radius k x ${ringStep}`);
  eq(rings.length, out.radii.length, `${tag}: the SVG draws every circle the layout counts`);
  const room = Math.min(page.w - 2 * MARGIN, page.h - 2 * MARGIN - headerH) / 2 - 0.3;
  eq(rings.length, Math.floor(room / ringStep + 1e-9), `${tag}: as many circles as fit`);
  // weights: the four axes are heavy, the others thin
  const heavy = rayLines.filter(l => l.w === BOLD).length;
  eq(heavy, 4, `${tag}: exactly four heavy axes`);
  ok(rayLines.filter(l => l.w === BOLD).every(l => { const a = (Math.atan2(cy - l.y2, l.x2 - cx) * 180 / Math.PI + 360) % 360; return Math.abs(a % 90) < 0.01 || Math.abs((a % 90) - 90) < 0.01; }), `${tag}: the heavy ones lie on 0, 90, 180 and 270`);
  // labels
  const degLabels = g.texts.filter(t => t.s.endsWith('°')).map(t => t.s);
  eq(degLabels, Array.from({ length: rays }, (_, i) => (i * 360 / rays) + '°'), `${tag}: a degree label on every ray, in order`);
  onPaper(out.svg, page, headerH, tag);
}
{
  const labelled = R.renderPolarPaper({ orientation: 'portrait', rays: 12, ringStep: 0.25, labels: true });
  const bare = R.renderPolarPaper({ orientation: 'portrait', rays: 12, ringStep: 0.25, labels: false });
  eq(parse(bare.svg).texts.length, 0, 'polar: labels off draws no text');
  ok(bare.outer > labelled.outer, 'polar: with no labels the circle may use the room they needed');
  eq(R.renderPolarPaper({ orientation: 'portrait', rays: 13, ringStep: 0.5 }).rays.length, 12, 'polar: an unknown ray count falls back to 12');
  ok(R.renderPolarPaper({ orientation: 'portrait', rays: 12, ringStep: 0 }).radii.length >= 1, 'polar: a zero ring step does not hang or draw nothing');
  ok(R.renderPolarPaper({ orientation: 'portrait', rays: 12, ringStep: 99 }).radii.length === 1, 'polar: a ring step bigger than the page draws one circle');
}

/* ── 4. logarithmic and semi-logarithmic paper ─────────────────────────── */
console.log('4. log and semi-log paper');
{
  const log10 = Math.log10;
  const fracs = R.logAxisLines(1, 0);
  eq(fracs.length, 10, 'logAxisLines: nine lines and the top one in a single decade');
  near(fracs[1].frac, log10(2), 1e-12, 'a log axis puts the 2 line at log10(2) = 0.30103 of the decade');
  ok(Math.abs(fracs[1].frac - 0.2) > 0.1, 'and not at 0.2, where an even axis would');
  eq(['1', '10', '100', '0.1', '0.01', '0.0001', '10^5', '10^-5'].join(), [0, 1, 2, -1, -2, -4, 5, -5].map(R.expLabel).join(), 'decade labels: 1 10 100 0.1 0.01 0.0001 10^5 10^-5');
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER]) {
    for (const kind of ['semilog', 'loglog']) for (const decades of [1, 2, 3, 4, 5, 6]) for (const startExp of [-4, -2, 0, 3]) {
      const tag = `${kind} ${orientation}${header ? '+header' : ''} ${decades} decades from 10^${startExp}`;
      const page = PAGES[orientation];
      const out = R.renderLogPaper({ orientation, kind, decades, startExp, xDecades: Math.min(6, decades + 1), xStartExp: startExp, xDivisions: 10, header });
      const { x0, y0, x1, y1 } = out.plot;
      const h = y1 - y0, w = x1 - x0;
      const g = parse(out.svg);
      const hs = g.lines.filter(l => horiz(l) && Math.abs(l.x1 - x0) < 1e-3 && Math.abs(l.x2 - x1) < 1e-3);
      eq(hs.length, 9 * decades + 1, `${tag}: nine lines per decade and the top line`);
      const want = R.logAxisLines(decades, startExp);
      const ys = sorted(hs.map(l => l.y1)).reverse(); // bottom (largest y) first
      ok(want.every((ln, i) => Math.abs((y1 - ys[i]) - ln.frac * h) < 2e-4), `${tag}: the horizontal lines sit at log10 of 1..9 inside each decade`);
      // the 2..9 lines inside the first decade, read independently of logAxisLines
      ok([2, 3, 4, 5, 6, 7, 8, 9].every(m => Math.abs((y1 - ys[m - 1]) - (log10(m) / decades) * h) < 2e-4), `${tag}: line m is log10(m)/${decades} of the height up`);
      // weights: decade lines heavy, the 5 a step lighter
      const widthOf = (i) => hs.find(l => Math.abs(l.y1 - ys[i]) < 1e-9).w;
      ok(want.every((ln, i) => widthOf(i) === (ln.m === 1 ? BOLD : (ln.m === 5 ? MID : THIN))), `${tag}: decade lines heavy, the 5 line lighter, the rest thin`);
      // lines never merge: the closest pair (9 and 10) is still apart
      const minGap = Math.min(...diffs(sorted(ys)));
      ok(minGap >= 0.05, `${tag}: the closest two lines are ${minGap.toFixed(3)}in apart, not under 0.05`);
      // labels: one per decade line, as the label function writes them
      const yLabels = g.texts.filter(t => t.anchor === 'end').sort((a, b) => b.y - a.y).map(t => t.s);
      eq(yLabels, Array.from({ length: decades + 1 }, (_, i) => R.expLabel(startExp + i)), `${tag}: a label on every decade, bottom to top`);
      const vs = g.lines.filter(l => vert(l) && Math.abs(l.y1 - y0) < 1e-3 && Math.abs(l.y2 - y1) < 1e-3);
      if (kind === 'semilog') {
        eq(vs.length, 11, `${tag}: eleven even vertical lines`);
        const xs = sorted(vs.map(l => l.x1));
        ok(allNear(diffs(xs), w / 10, 2e-4), `${tag}: the vertical lines are equally spaced`);
        eq(g.texts.filter(t => t.anchor === 'middle').map(t => t.s), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], `${tag}: x numbered 0 to 10`);
      } else {
        const xd = Math.min(6, decades + 1);
        eq(vs.length, 9 * xd + 1, `${tag}: nine vertical lines per x decade`);
        const wantX = R.logAxisLines(xd, startExp);
        const xs = sorted(vs.map(l => l.x1));
        ok(wantX.every((ln, i) => Math.abs((xs[i] - x0) - ln.frac * w) < 2e-4), `${tag}: the vertical lines sit at log10 too`);
        ok(Math.min(...diffs(xs)) >= 0.05, `${tag}: the closest two vertical lines are not under 0.05in apart`);
      }
      onPaper(out.svg, page, header ? HEADER_H : 0, tag);
    }
  }
  const s20 = parse(R.renderLogPaper({ orientation: 'portrait', kind: 'semilog', decades: 2, startExp: 0, xDivisions: 20 }).svg);
  const plot = R.renderLogPaper({ orientation: 'portrait', kind: 'semilog', decades: 2, startExp: 0, xDivisions: 20 }).plot;
  const v20 = s20.lines.filter(l => vert(l) && Math.abs(l.y1 - plot.y0) < 1e-3);
  eq(v20.length, 21, 'semi-log with 20 divisions has 21 vertical lines');
  eq(R.renderLogPaper({ orientation: 'portrait', kind: 'semilog', decades: 99, startExp: 99 }).decades, 6, 'log: decades are capped at 6');
  eq(R.renderLogPaper({ orientation: 'portrait', kind: 'semilog', decades: 0, startExp: 0 }).decades, 1, 'log: decades are at least 1');
}

/* ── 5. number lines: shared reading ───────────────────────────────────── */
const tickLines = (g, y, tol = 1e-3) => g.lines.filter(l => vert(l) && l.w === TICK_W && Math.abs((l.y1 + l.y2) / 2 - y) < tol);
const axisLines = (g) => g.lines.filter(l => horiz(l) && l.w === BOLD);

/* ── 6. fractions and mixed numbers ────────────────────────────────────── */
console.log('6. fraction and mixed-number lines');
{
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER])
    for (const d of [2, 3, 4, 5, 6, 8, 10, 12, 16]) for (const [min, max] of [[0, 1], [0, 3], [-2, 2], [1, 4]])
      for (const style of ['mixed', 'improper']) for (const reduce of [true, false]) {
        const tag = `fraction ${orientation}${header ? '+header' : ''} 1/${d} on ${min}..${max} ${style}${reduce ? '' : ' unreduced'}`;
        const page = PAGES[orientation];
        const out = R.renderFractionLine({ orientation, min, max, denominator: d, labelStyle: style, reduce, labelEvery: 1, copies: 1, header });
        const g = parse(out.svg);
        ok(fits(out.svg, page), `${tag}: sized in inches`);
        const ys = axisLines(g)[0].y1;
        const ticks = tickLines(g, ys).sort((a, b) => a.x1 - b.x1);
        eq(ticks.length, (max - min) * d + 1, `${tag}: one mark per 1/${d}`);
        const tA = MARGIN + 0.35, tB = page.w - MARGIN - 0.35;
        const exact = ticks.every((t, i) => { const v = (min * d + i) / d; return Math.abs(t.x1 - (tA + ((v - min) / (max - min)) * (tB - tA))) < 2e-4; });
        ok(exact, `${tag}: every mark sits at its ratio along the line`);
        ok(allNear(diffs(ticks.map(t => t.x1)), (tB - tA) / ((max - min) * d), 3e-4), `${tag}: the marks are equally spaced`);
        ok(ticks.every((t, i) => { const whole = (min * d + i) % d === 0; return Math.abs((t.y2 - t.y1) - (whole ? 0.28 : 0.16)) < 1e-3; }), `${tag}: whole numbers get the long marks`);
        // labels: the whole numbers are always there; every label is the tick's own value
        const every = out.labelEvery;
        ok(d % every === 0, `${tag}: labels every ${every} marks, a divisor of ${d}, so whole numbers are labelled`);
        const expectedTexts = [];
        for (let k = min * d; k <= max * d; k++) {
          if (k % every !== 0) continue;
          const p = R.fractionLabelParts(k, d, style, reduce);
          // the value the label says is the value of the mark
          const a = Math.abs(k);
          const said = p.whole * p.den + p.num;           // numerator over den
          ok(said * d === a * p.den, `${tag}: label of ${k}/${d} says ${p.whole} ${p.num}/${p.den}`);
          if (p.num === 0) ok(p.whole === a / d && p.den === 1, `${tag}: ${k}/${d} is the whole number ${a / d}`);
          else if (reduce) ok(gcd(p.num, p.den) === 1, `${tag}: ${k}/${d} is in lowest terms (${p.num}/${p.den})`);
          else ok(p.den === d, `${tag}: unreduced keeps the denominator ${d}`);
          if (style === 'improper') ok(p.whole === 0 || p.num === 0, `${tag}: improper never shows a whole part beside a fraction`);
          else if (p.num > 0) ok(p.num < p.den, `${tag}: a mixed number's fraction is proper (${p.num}/${p.den})`);
          ok(p.neg === (k < 0), `${tag}: the sign follows the mark`);
          const wt = p.num === 0 ? (p.neg ? '-' : '') + p.whole : (p.neg ? '-' : '') + (p.whole > 0 ? p.whole : '');
          if (wt !== '') expectedTexts.push(wt);
          if (p.num > 0) expectedTexts.push(String(p.num), String(p.den));
        }
        eq(g.texts.map(t => t.s).sort(), expectedTexts.sort(), `${tag}: the page says exactly those labels`);
        // whole-number labels are centred on their mark
        for (let k = min * d; k <= max * d; k++) {
          if (k % d !== 0 || k % every !== 0) continue;
          const tick = ticks[k - min * d];
          const wholeLabel = g.texts.find(t => t.size === 0.14 && Math.abs(t.x - tick.x1) < 1e-3 && t.anchor === 'middle');
          if (!ok(!!wholeLabel, `${tag}: ${k / d} is labelled centred on its mark`)) break;
        }
        // labels do not run into each other: consecutive labelled marks are further apart than a label is wide
        const gapIn = (tB - tA) / ((max - min) * d);
        let widest = 0;
        for (let k = min * d; k <= max * d; k++) {
          const p = R.fractionLabelParts(k, d, style, reduce);
          const wt = p.num === 0 ? String(p.neg ? '-' : '').length + String(p.whole).length : ((p.neg ? 1 : 0) + (p.whole > 0 ? String(p.whole).length : 0));
          const ww = p.num === 0 ? wt * 0.6 * 0.14 : (wt ? wt * 0.6 * 0.14 + 0.03 : 0);
          const fw = p.num > 0 ? Math.max(String(p.num).length, String(p.den).length) * 0.6 * 0.11 + 0.05 : 0;
          if (k % every === 0) widest = Math.max(widest, ww + fw);
        }
        ok(every * gapIn >= widest || every === d, `${tag}: labelled marks ${(every * gapIn).toFixed(3)}in apart, widest label ${widest.toFixed(3)}in`);
        onPaper(out.svg, page, header ? HEADER_H : 0, tag);
      }
  // the cases the teacher asked for by name
  const half = R.fractionLabelParts(2, 4, 'mixed', true);
  eq([half.whole, half.num, half.den], [0, 1, 2], 'fractions: 2/4 in lowest terms is 1/2');
  const raw = R.fractionLabelParts(2, 4, 'mixed', false);
  eq([raw.whole, raw.num, raw.den], [0, 2, 4], 'fractions: unreduced, 2/4 stays 2/4');
  const mixed = R.fractionLabelParts(6, 4, 'mixed', true);
  eq([mixed.whole, mixed.num, mixed.den], [1, 1, 2], 'fractions: 6/4 as a mixed number is 1 1/2');
  const imp = R.fractionLabelParts(6, 4, 'improper', true);
  eq([imp.whole, imp.num, imp.den], [0, 3, 2], 'fractions: 6/4 as an improper fraction in lowest terms is 3/2');
  const imp2 = R.fractionLabelParts(6, 4, 'improper', false);
  eq([imp2.whole, imp2.num, imp2.den], [0, 6, 4], 'fractions: 6/4 improper unreduced is 6/4');
  const negm = R.fractionLabelParts(-5, 4, 'mixed', true);
  eq([negm.neg, negm.whole, negm.num, negm.den], [true, 1, 1, 4], 'fractions: -5/4 is negative 1 1/4');
  const zero = R.fractionLabelParts(0, 6, 'mixed', true);
  eq([zero.neg, zero.whole, zero.num], [false, 0, 0], 'fractions: zero is a plain 0, not -0');
  // labelEvery honoured when there is room, moved to a divisor when it is not
  const roomy = R.renderFractionLine({ orientation: 'landscape', min: 0, max: 2, denominator: 4, labelEvery: 2, copies: 1 });
  eq(roomy.labelEvery, 2, 'fractions: a label-every of 2 is kept when 2 divides the denominator and there is room');
  const odd = R.renderFractionLine({ orientation: 'landscape', min: 0, max: 2, denominator: 4, labelEvery: 3, copies: 1 });
  eq(odd.labelEvery, 4, 'fractions: a label-every of 3 on quarters moves up to 4, so wholes stay labelled');
  const crowded = R.renderFractionLine({ orientation: 'portrait', min: 0, max: 3, denominator: 16, labelEvery: 1, copies: 1 });
  ok(crowded.labelEvery > 1 && 16 % crowded.labelEvery === 0, 'fractions: sixteenths over three wholes thin their labels instead of overprinting');
  // clamps and copies
  eq(R.renderFractionLine({ orientation: 'portrait', min: 0, max: 1, denominator: 1, copies: 1 }).denominator, 2, 'fractions: a denominator of 1 becomes 2');
  eq(R.renderFractionLine({ orientation: 'portrait', min: 0, max: 1, denominator: 99, copies: 1 }).denominator, 16, 'fractions: a denominator of 99 becomes 16');
  const inv = R.renderFractionLine({ orientation: 'portrait', min: 3, max: 3, denominator: 4, copies: 1 });
  eq([inv.min, inv.max], [3, 4], 'fractions: an empty range becomes one whole');
  const huge = R.renderFractionLine({ orientation: 'portrait', min: 0, max: 1000, denominator: 16, copies: 1 });
  ok(huge.ticks.length <= 401, 'fractions: a huge range is capped, not rendered tick by tick forever (' + huge.ticks.length + ')');
  const rows = R.renderFractionLine({ orientation: 'portrait', min: 0, max: 2, denominator: 4, copies: 3 });
  const gr = parse(rows.svg);
  const axes = axisLines(gr).map(l => l.y1);
  eq(axes.length, 3, 'fractions: three copies draw three lines');
  ok(allNear(diffs(axes), (11 - 0.7) / 3, 1e-3), 'fractions: the copies are evenly spaced down the page');
}

/* ── 7. decimals and integers ──────────────────────────────────────────── */
console.log('7. decimal and integer lines');
{
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER])
    for (const step of ['ones', 'tenths', 'hundredths'])
      for (const [min, max] of [[0, 1], [-1, 1], [0.3, 0.8], [-3, 5], [0, 0.1], [-0.25, 0.25], [0.29, 0.58]]) {
        if (step === 'ones' && (!Number.isInteger(min) || !Number.isInteger(max))) continue;
        if (step === 'tenths' && Math.abs(min * 10 - Math.round(min * 10)) > 1e-9) continue;
        if (step === 'tenths' && Math.abs(max * 10 - Math.round(max * 10)) > 1e-9) continue;
        const scale = { ones: 1, tenths: 10, hundredths: 100 }[step];
        const tag = `decimal ${orientation}${header ? '+header' : ''} ${step} on ${min}..${max}`;
        const page = PAGES[orientation];
        const out = R.renderDecimalLine({ orientation, min, max, step, labelEvery: 1, copies: 1, header });
        const g = parse(out.svg);
        const lo = Math.round(min * scale), hi = Math.round(max * scale);
        const y = axisLines(g)[0].y1;
        const ticks = g.lines.filter(l => vert(l) && (l.w === TICK_W || l.w === BOLD) && Math.abs((l.y1 + l.y2) / 2 - y) < 1e-3).sort((a, b) => a.x1 - b.x1);
        eq(ticks.length, hi - lo + 1, `${tag}: one mark per ${1 / scale}`);
        const tA = MARGIN + 0.35, tB = page.w - MARGIN - 0.35;
        ok(ticks.every((t, i) => Math.abs(t.x1 - (tA + (i / (hi - lo)) * (tB - tA))) < 2e-4), `${tag}: every mark is at its exact place (no float drift)`);
        ok(allNear(diffs(ticks.map(t => t.x1)), (tB - tA) / (hi - lo), 3e-4), `${tag}: marks equally spaced`);
        const every = out.labelEvery;
        if (scale > 1) ok(scale % every === 0, `${tag}: labels every ${every} marks, a divisor of ${scale}, so wholes and tenths are labelled`);
        const want = [];
        for (let n = lo; n <= hi; n++) if (n % every === 0) want.push(R.decimalLabel(n, scale));
        eq(g.texts.map(t => t.s), want, `${tag}: the labels read exactly right`);
        // zero is heavier and longer when it is on the line
        const zeroTick = ticks.find((t, i) => lo + i === 0);
        if (lo <= 0 && hi >= 0) ok(zeroTick && zeroTick.w === BOLD && (zeroTick.y2 - zeroTick.y1) > 0.3, `${tag}: zero is a longer, heavier mark`);
        else ok(ticks.every(t => t.w === TICK_W), `${tag}: with zero off the line nothing is heavy`);
        const lens = ticks.map((t, i) => ({ n: lo + i, len: +(t.y2 - t.y1).toFixed(3) })).filter(t => t.n !== 0);
        if (scale === 100) {
          ok(lens.filter(t => t.n % 100 === 0).every(t => t.len === 0.28) && lens.filter(t => t.n % 50 === 0 && t.n % 100 !== 0).every(t => t.len === 0.2) && lens.filter(t => t.n % 50 !== 0).every(t => t.len === 0.14), `${tag}: wholes, halves and the rest get three lengths`);
        }
        onPaper(out.svg, page, header ? HEADER_H : 0, tag);
      }
  eq(R.decimalLabel(35, 100), '0.35', 'decimals: 35 hundredths is 0.35');
  eq(R.decimalLabel(30, 100), '0.30', 'decimals: 30 hundredths is 0.30, the zero kept');
  eq(R.decimalLabel(5, 100), '0.05', 'decimals: 5 hundredths is 0.05');
  eq(R.decimalLabel(-25, 100), '-0.25', 'decimals: negative 25 hundredths');
  eq(R.decimalLabel(-5, 10), '-0.5', 'decimals: negative 5 tenths');
  eq(R.decimalLabel(10, 10), '1.0', 'decimals: 10 tenths is 1.0');
  eq(R.decimalLabel(-3, 1), '-3', 'integers: -3');
  eq(R.decimalLabel(0, 100), '0.00', 'decimals: zero hundredths is 0.00');
  // 0.1 .. 0.7 are the classic float trap: 0.7 * 10 = 7.000000000000001
  const trap = R.renderDecimalLine({ orientation: 'portrait', min: 0.1, max: 0.7, step: 'tenths', labelEvery: 1, copies: 1 });
  eq(parse(trap.svg).texts.map(t => t.s), ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7'], 'decimals: 0.1 to 0.7 by tenths reads 0.1 ... 0.7 with no float noise');
  const hundred = R.renderDecimalLine({ orientation: 'portrait', min: 0, max: 1, step: 'hundredths', labelEvery: 1, copies: 1 });
  ok(hundred.labelEvery >= 10 && 100 % hundred.labelEvery === 0, 'decimals: a hundred hundredths thin their labels (' + hundred.labelEvery + ')');
  ok(hundred.ticks.length === 101, 'decimals: and still draw all 101 marks');
  const huge = R.renderDecimalLine({ orientation: 'portrait', min: 0, max: 5000, step: 'tenths', copies: 1 });
  ok(huge.hi - huge.lo <= 1000, 'decimals: a huge range is capped at 1000 marks');
  const swapped = R.renderDecimalLine({ orientation: 'portrait', min: 5, max: 1, step: 'tenths', copies: 1 });
  ok(swapped.hi > swapped.lo, 'decimals: a backwards range becomes one tenth, not NaN');
  const three = R.renderDecimalLine({ orientation: 'portrait', min: -1, max: 1, step: 'tenths', labelEvery: 1, copies: 3 });
  eq(axisLines(parse(three.svg)).length, 3, 'decimals: three copies draw three lines');
}

/* ── 8. open number line ───────────────────────────────────────────────── */
console.log('8. open number line');
{
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER]) for (const ticks of [0, 1, 5, 10, 40, 60]) {
    const tag = `open ${orientation}${header ? '+header' : ''} ${ticks} marks`;
    const page = PAGES[orientation];
    const out = R.renderOpenLine({ orientation, ticks, copies: 1, header });
    const g = parse(out.svg);
    eq(g.texts.length, 0, `${tag}: no numbers anywhere`);
    const y = axisLines(g)[0].y1;
    const ts = tickLines(g, y).sort((a, b) => a.x1 - b.x1);
    eq(ts.length, ticks, `${tag}: ${ticks} marks`);
    if (ticks > 1) ok(allNear(diffs(ts.map(t => t.x1)), (page.w - 0.7) / (ticks + 1), 3e-4), `${tag}: the marks are equally spaced`);
    if (ticks > 0) {
      near(ts[0].x1 - MARGIN, page.w - MARGIN - ts[ts.length - 1].x1, 3e-4, `${tag}: and the same gap at both ends`);
    }
    onPaper(out.svg, page, header ? HEADER_H : 0, tag);
  }
  eq(R.renderOpenLine({ orientation: 'portrait', ticks: 500, copies: 1 }).ticks, 60, 'open: marks are capped at 60');
  const three = parse(R.renderOpenLine({ orientation: 'portrait', ticks: 4, copies: 3 }).svg);
  const ax = axisLines(three).map(l => l.y1);
  eq(ax.length, 3, 'open: three copies draw three lines');
  ok(allNear(diffs(ax), (11 - 0.7) / 3, 1e-3), 'open: evenly spaced down the page');
  eq(axisLines(parse(R.renderOpenLine({ orientation: 'portrait', ticks: 4, copies: 99 }).svg)).length, 10, 'open: copies are capped at ten');
}

/* ── 9. double number line ─────────────────────────────────────────────── */
console.log('9. double number line');
{
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER])
    for (const [topStep, bottomStep, n] of [[3, 12, 6], [1, 2, 10], [0.5, 2.5, 8], [0.1, 0.25, 5], [15, 4, 20], [2, 3, 2]])
      for (const bottom of ['all', 'example', 'none']) for (const names of [['', ''], ['miles', 'minutes']]) {
        const tag = `double ${orientation}${header ? '+header' : ''} ${topStep}:${bottomStep} x${n} ${bottom}${names[0] ? ' named' : ''}`;
        const page = PAGES[orientation];
        const out = R.renderDoubleLine({ orientation, topStep, bottomStep, intervals: n, topName: names[0], bottomName: names[1], bottom, copies: 1, header });
        const g = parse(out.svg);
        const axes = axisLines(g).sort((a, b) => a.y1 - b.y1);
        eq(axes.length, 2, `${tag}: two lines`);
        const [top, bot] = axes;
        const tTicks = tickLines(g, top.y1).sort((a, b) => a.x1 - b.x1);
        const bTicks = tickLines(g, bot.y1).sort((a, b) => a.x1 - b.x1);
        eq(tTicks.length, n + 1, `${tag}: ${n + 1} marks on the top line`);
        eq(bTicks.map(t => t.x1.toFixed(4)), tTicks.map(t => t.x1.toFixed(4)), `${tag}: the bottom marks sit directly under the top marks`);
        ok(allNear(diffs(tTicks.map(t => t.x1)), (tTicks[n].x1 - tTicks[0].x1) / n, 3e-4), `${tag}: marks equally spaced`);
        const dashed = g.lines.filter(l => l.dashed);
        eq(dashed.length, n + 1, `${tag}: a dashed rule joins each pair of marks`);
        ok(dashed.every(l => l.w === THIN && l.y1 > top.y1 && l.y2 < bot.y1), `${tag}: and runs between the two lines at the thin weight`);
        // labels: top above, bottom below, by the steps
        const above = g.texts.filter(t => t.y < top.y1 && t.anchor === 'middle').sort((a, b) => a.x - b.x).map(t => t.s);
        const fmt = (v) => String(Math.round(v * 1000) / 1000);
        eq(above, Array.from({ length: n + 1 }, (_, i) => fmt(i * topStep)), `${tag}: the top numbers count by ${topStep}`);
        const below = g.texts.filter(t => t.y > bot.y1 && t.anchor === 'middle').sort((a, b) => a.x - b.x).map(t => t.s);
        const wantBelow = bottom === 'all' ? Array.from({ length: n + 1 }, (_, i) => fmt(i * bottomStep)) : bottom === 'example' ? ['0', fmt(bottomStep)] : ['0'];
        eq(below, wantBelow, `${tag}: the bottom numbers are ${bottom}`);
        // top label sits over its mark
        ok(g.texts.filter(t => t.y < top.y1 && t.anchor === 'middle').every(t => tTicks.some(k => Math.abs(k.x1 - t.x) < 1e-3)), `${tag}: every top number is centred over a mark`);
        const nameTexts = g.texts.filter(t => t.anchor === 'start').sort((a, b) => a.y - b.y).map(t => t.s);
        eq(nameTexts, names[0] ? names : [], `${tag}: the names are written beside their lines`);
        if (names[0]) ok(tTicks[0].x1 - 0.35 > names[1].length * 0.084, `${tag}: the scale starts clear of the longest name`);
        onPaper(out.svg, page, header ? HEADER_H : 0, tag);
      }
  const esc = R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 4, topName: '<b>&"', bottomName: 'x', copies: 1 });
  ok(/&lt;b&gt;&amp;&quot;/.test(esc.svg) && !/<b>/.test(esc.svg), 'double: a name with markup is written as text, not markup');
  const longName = parse(R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 4, topName: 'abcdefghijklmnopqrstuvwxyz', bottomName: 'x', copies: 1 }).svg).texts.filter(t => t.anchor === 'start').map(t => t.s);
  ok(longName.includes('abcdefghijklmn') && !longName.includes('abcdefghijklmno'), 'double: a name is cut at 14 characters');
  eq(axisLines(parse(R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 4, copies: 99 }).svg)).length, 8, 'double: copies are capped at four (eight lines)');
  const two = axisLines(parse(R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 4, copies: 2 }).svg)).map(l => l.y1);
  ok(allNear([two[2] - two[0]], (11 - 0.7) / 2, 1e-3), 'double: two copies are half the page apart');
  eq(R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 99, copies: 1 }).intervals, 20, 'double: steps are capped at 20');
  eq(R.renderDoubleLine({ orientation: 'portrait', topStep: 1, bottomStep: 2, intervals: 0, copies: 1 }).intervals, 2, 'double: steps are at least 2');
  const zs = parse(R.renderDoubleLine({ orientation: 'portrait', topStep: 0, bottomStep: -4, intervals: 3, copies: 1 }).svg);
  const zAxes = axisLines(zs).sort((p, q) => p.y1 - q.y1);
  eq(zs.texts.filter(t => t.y < zAxes[0].y1).sort((p, q) => p.x - q.x).map(t => t.s), ['0', '1', '2', '3'], 'double: a zero top step counts by 1 instead of printing 0 0 0 0');
  eq(zs.texts.filter(t => t.y > zAxes[1].y1).sort((p, q) => p.x - q.x).map(t => t.s), ['0', '1', '2', '3'], 'double: a negative bottom step counts by 1');
  // four double lines must not touch
  const four = axisLines(parse(R.renderDoubleLine({ orientation: 'landscape', topStep: 1, bottomStep: 2, intervals: 4, copies: 4 }).svg)).map(l => l.y1);
  ok(four.length === 8 && four[2] - four[1] > 0.5, 'double: four on a landscape page keep half an inch between pairs (' + (four[2] - four[1]).toFixed(2) + ')');
}

/* ── 10. vertical number line / thermometer ────────────────────────────── */
console.log('10. vertical number line');
{
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER])
    for (const [min, max, interval] of [[0, 100, 10], [-20, 40, 10], [0, 1, 0.1], [0, 2, 0.25], [-5, 5, 1], [0, 1, 0.01], [10, 20, 0.5]])
      for (const copies of [1, 3, 6]) {
        const tag = `vertical ${orientation}${header ? '+header' : ''} ${min}..${max} by ${interval} x${copies}`;
        const page = PAGES[orientation];
        const out = R.renderVerticalLine({ orientation, min, max, interval, labelEvery: 1, copies, header });
        const g = parse(out.svg);
        const n = Math.round((max - min) / interval);
        eq(out.ticks.length, n + 1, `${tag}: one mark per ${interval}`);
        const first = out.ticks;
        near(first[0].y, out.yMin, 1e-9, `${tag}: the lowest mark is at the bottom of the scale`);
        near(first[n].y, out.yMax, 1e-6, `${tag}: the highest is at the top`);
        ok(first.every((t, i) => Math.abs(t.y - (out.yMin - (i / n) * (out.yMin - out.yMax))) < 1e-6), `${tag}: every mark is at its exact height`);
        ok(allNear(diffs(first.map(t => t.y)), -(out.yMin - out.yMax) / n, 1e-6), `${tag}: marks equally spaced, values rising upward`);
        // the SVG has them too, copies times over
        const ticks = g.lines.filter(l => horiz(l) && l.w === TICK_W);
        eq(ticks.length, (n + 1) * copies, `${tag}: every copy draws every mark`);
        const col0 = ticks.filter(l => Math.abs(l.x1 - ticks[0].x1) < 1e-6).map(l => l.y1).sort((a, b) => b - a);
        ok(col0.every((y, i) => Math.abs(y - first[i].y) < 2e-4), `${tag}: the SVG marks are where the layout says`);
        const slot = (page.w - 2 * MARGIN) / copies;
        const xs = [...new Set(ticks.map(l => l.x1.toFixed(4)))].map(Number).sort((a, b) => a - b);
        eq(xs.length, copies, `${tag}: ${copies} thermometers`);
        if (copies > 1) ok(allNear(diffs(xs), slot, 2e-4), `${tag}: side by side in equal slots`);
        // labels: values in order, bottom to top, matching the scale
        const dec = Math.max(...[min, max, interval].map(v => (String(v).split('.')[1] || '').length));
        const sc = Math.pow(10, dec);
        const wantLabels = [];
        for (let i = 0; i <= n; i++) if (i % out.labelEvery === 0) wantLabels.push(R.decimalLabel(Math.round(min * sc) + i * Math.round(interval * sc), sc));
        const firstCol = g.texts.filter(t => Math.abs(t.x - g.texts[0].x) < 1e-6).sort((a, b) => b.y - a.y).map(t => t.s);
        eq(firstCol, wantLabels, `${tag}: the numbers read ${wantLabels[0]} up to ${wantLabels[wantLabels.length - 1]}`);
        // the tube: a path, not past the page
        eq(g.paths.length, copies, `${tag}: a tube and bulb for each`);
        onPaper(out.svg, page, header ? HEADER_H : 0, tag);
      }
  eq(parse(R.renderVerticalLine({ orientation: 'portrait', min: 0, max: 10, interval: 1, copies: 99 }).svg).paths.length, 6, 'vertical: copies are capped at six');
  const swapped = R.renderVerticalLine({ orientation: 'portrait', min: 10, max: 0, interval: 1, copies: 1 });
  ok(swapped.ticks.length >= 2 && swapped.ticks.every(t => isFinite(t.y)), 'vertical: a backwards range becomes one step, not NaN');
  const zeroInt = R.renderVerticalLine({ orientation: 'portrait', min: 0, max: 10, interval: 0, copies: 1 });
  ok(zeroInt.ticks.length === 11, 'vertical: a zero interval counts by 1');
  const big = R.renderVerticalLine({ orientation: 'portrait', min: 0, max: 100000, interval: 1, copies: 1 });
  ok(big.ticks.length <= 401, 'vertical: a huge range is capped (' + big.ticks.length + ')');
  const crowd = R.renderVerticalLine({ orientation: 'portrait', min: 0, max: 400, interval: 1, labelEvery: 1, copies: 1 });
  ok(crowd.labelEvery >= 6, 'vertical: 400 marks thin their labels to fit (' + crowd.labelEvery + ')');
}

/* ── 10b. hexagonal paper ──────────────────────────────────────────────── */
console.log('10b. hexagonal paper');
for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER]) for (const hexTop of ['pointy', 'flat']) for (const side of [0.25, 0.3937, 0.5, 1]) {
  const tag = `hex ${orientation}${header ? '+header' : ''} ${hexTop} side ${side}`;
  const page = PAGES[orientation];
  const headerH = header ? HEADER_H : 0;
  const out = R.renderHexPaper({ orientation, cellSize: side, hexTop, header });
  const g = parse(out.svg);
  ok(fits(out.svg, page), `${tag}: sized in inches`);
  const hl = g.lines.filter(l => !(headerH && horiz(l) && Math.abs(l.y1 - (MARGIN + headerH - 0.06)) < 1e-3));
  ok(hl.length > 10, `${tag}: draws hexagons (${out.hexagons})`);
  ok(hl.every(l => Math.abs(Math.hypot(l.x2 - l.x1, l.y2 - l.y1) - side) < 3e-4), `${tag}: every edge is exactly one side long`);
  const want = hexTop === 'pointy' ? [30, 90, 150] : [0, 60, 120];
  const stray = hl.filter(l => { const a = (((Math.atan2(-(l.y2 - l.y1), l.x2 - l.x1) * 180 / Math.PI) % 180) + 180) % 180; return !want.some(t => Math.abs(a - t) < 0.05 || Math.abs(a - t - 180) < 0.05 || (t === 0 && Math.abs(a - 180) < 0.05)); });
  eq(stray.length, 0, `${tag}: edges lie at ${want.join(', ')} degrees only`);
  const PI = pointIndex();
  const ekeys = new Set(hl.map(l => { const a = PI.id(l.x1, l.y1), b = PI.id(l.x2, l.y2); return a < b ? a + '|' + b : b + '|' + a; }));
  eq(ekeys.size, hl.length, `${tag}: no edge is drawn twice`);
  // each hexagon: six corners one side from its centre, all drawn
  const cornersOk = out.centres.every(([cx, cy]) => [0, 1, 2, 3, 4, 5].every(k => {
    const ang = ((hexTop === 'pointy' ? 30 : 0) + 60 * k) * Math.PI / 180;
    return PI.find(cx + side * Math.cos(ang), cy - side * Math.sin(ang)) >= 0 || PI.find(cx + side * Math.cos(ang), cy + side * Math.sin(ang)) >= 0;
  }));
  ok(cornersOk, `${tag}: every hexagon has all six corners one side from its centre`);
  // centres: every nearest neighbour is sqrt(3) x side away, and there are six of them for an inner one
  const cs = out.centres, nn = [];
  cs.forEach((p, i) => { let m = Infinity; cs.forEach((q, j) => { if (i !== j) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); }); nn.push(m); });
  ok(nn.every(d => Math.abs(d - Math.sqrt(3) * side) < 5e-4), `${tag}: neighbouring centres are sqrt(3) x side apart (tiling, no gaps or overlaps)`);
  // three edges meet 120 degrees apart at an inner vertex
  const at = new Map();
  hl.forEach(l => { for (const [x, y, ox, oy] of [[l.x1, l.y1, l.x2, l.y2], [l.x2, l.y2, l.x1, l.y1]]) { const k = PI.id(x, y); if (!at.has(k)) at.set(k, []); at.get(k).push(Math.atan2(-(oy - y), ox - x) * 180 / Math.PI); } });
  const threes = [...at.values()].filter(a => a.length === 3);
  ok(threes.length > 10 && threes.every(a => { const s = a.map(v => (v + 360) % 360).sort((p, q) => p - q); return Math.abs(s[1] - s[0] - 120) < 0.1 && Math.abs(s[2] - s[1] - 120) < 0.1; }), `${tag}: ${threes.length} inner corners, each three edges 120 degrees apart`);
  ok([...at.values()].every(a => a.length <= 3), `${tag}: never more than three edges at a corner`);
  // the page is filled to within one more hexagon each way
  const xs = hl.flatMap(l => [l.x1, l.x2]), ys = hl.flatMap(l => [l.y1, l.y2]);
  const uw = page.w - 2 * MARGIN, uh = page.h - 2 * MARGIN - headerH;
  const along = hexTop === 'pointy' ? [Math.max(...xs) - Math.min(...xs), uw, Math.max(...ys) - Math.min(...ys), uh] : [Math.max(...ys) - Math.min(...ys), uh, Math.max(...xs) - Math.min(...xs), uw];
  ok(along[0] > along[1] - Math.sqrt(3) * side - 1e-3 && along[0] <= along[1] + 1e-3, `${tag}: a row of hexagons fills the width within one hexagon`);
  ok(along[2] > along[3] - 1.5 * side - 1e-3 && along[2] <= along[3] + 1e-3, `${tag}: and the rows fill the height within one row`);
  near(Math.min(...xs) - MARGIN, page.w - MARGIN - Math.max(...xs), 1e-3, `${tag}: the hexagons sit centred across the page`);
  near(Math.min(...ys) - (MARGIN + headerH), MARGIN + headerH + uh - Math.max(...ys), 1e-3, `${tag}: and down it`);
  onPaper(out.svg, page, headerH, tag);
}
eq(R.renderHexPaper({ orientation: 'portrait', cellSize: 0.03, hexTop: 'pointy' }).side, 0.1, 'hex: a side under 0.1 inch is held to 0.1');
eq(R.renderHexPaper({ orientation: 'portrait', cellSize: 99, hexTop: 'pointy' }).hexagons, 0, 'hex: a side bigger than the page draws nothing, without an error');
ok(R.renderHexPaper({ orientation: 'portrait', cellSize: 0, hexTop: 'pointy' }).side >= 0.1, 'hex: a zero side is held to 0.1 inch');

/* ── 10c. storyboard frames ────────────────────────────────────────────── */
console.log('10c. storyboard frames');
{
  const ASP = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '2.35:1': 2.35 };
  const rects = (svg) => [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
  for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER])
    for (const frames of [2, 3, 4, 6, 8, 9, 12]) for (const aspect of Object.keys(ASP)) for (const captionLines of [0, 2, 4]) {
      const tag = `storyboard ${orientation}${header ? '+header' : ''} ${frames} frames ${aspect} ${captionLines} lines`;
      const page = PAGES[orientation];
      const headerH = header ? HEADER_H : 0;
      const out = R.renderStoryboard({ orientation, frames, aspect, captionLines, header });
      const rs = rects(out.svg);
      eq(rs.length, frames, `${tag}: ${frames} frames`);
      ok(rs.every(r => Math.abs(r.w - rs[0].w) < 2e-4 && Math.abs(r.h - rs[0].h) < 2e-4), `${tag}: every frame is the same size`);
      ok(rs.every(r => Math.abs(r.w / r.h - ASP[aspect]) < 2e-3), `${tag}: every frame is exactly ${aspect} (${(rs[0].w / rs[0].h).toFixed(4)})`);
      const colsX = clusterValues(rs.map(r => r.x));
      const rowsY = clusterValues(rs.map(r => r.y));
      eq([colsX.length, rowsY.length], [out.cols, out.rows], `${tag}: ${out.cols} columns by ${out.rows} rows`);
      ok(colsX.length < 2 || allNear(diffs(colsX), rs[0].w + 0.3, 3e-4), `${tag}: equal 0.3in gutters between columns`);
      const capH = captionLines ? 0.1 + captionLines * 0.28 : 0;
      ok(rowsY.length < 2 || allNear(diffs(rowsY), rs[0].h + capH + 0.3, 3e-4), `${tag}: equal gutters between rows, caption lines included`);
      const g = parse(out.svg);
      const capLines = g.lines.filter(l => horiz(l) && !(headerH && Math.abs(l.y1 - (MARGIN + headerH - 0.06)) < 1e-3));
      eq(capLines.length, frames * captionLines, `${tag}: ${captionLines} caption lines under each frame`);
      ok(capLines.every(l => rs.some(r => Math.abs(l.x1 - r.x) < 2e-4 && Math.abs(l.x2 - (r.x + r.w)) < 2e-4 && l.y1 > r.y + r.h)), `${tag}: each as wide as its frame and below it`);
      ok(rs.every(r => capLines.filter(l => Math.abs(l.x1 - r.x) < 2e-4 && l.y1 > r.y + r.h && l.y1 < r.y + r.h + capH + 1e-3).length === captionLines), `${tag}: and inside its own frame's caption space`);
      const uw = page.w - 2 * MARGIN, uh = page.h - 2 * MARGIN - headerH;
      const left = Math.min(...rs.map(r => r.x)) - MARGIN, right = page.w - MARGIN - Math.max(...rs.map(r => r.x + r.w));
      near(left, right, 3e-4, `${tag}: centred across the page`);
      const top = Math.min(...rs.map(r => r.y)) - (MARGIN + headerH), bottom = MARGIN + headerH + uh - Math.max(...rs.map(r => r.y + r.h)) - capH;
      near(top, bottom, 3e-4, `${tag}: and down it`);
      const blockW = out.cols * rs[0].w + (out.cols - 1) * 0.3, blockH = out.rows * (rs[0].h + capH) + (out.rows - 1) * 0.3;
      ok(Math.abs(blockW - uw) < 2e-3 || Math.abs(blockH - uh) < 2e-3, `${tag}: as large as the page allows`);
      ok(rs.every(r => r.x >= MARGIN - 1e-3 && r.x + r.w <= page.w - MARGIN + 1e-3 && r.y >= MARGIN + headerH - 1e-3 && r.y + r.h + capH <= page.h - MARGIN + 1e-3), `${tag}: inside the margins and below the header`);
      onPaper(out.svg, page, headerH, tag);
    }
  eq(R.renderStoryboard({ orientation: 'portrait', frames: 7, aspect: '16:9' }).frames, 6, 'storyboard: an unknown frame count becomes 6');
  eq(R.renderStoryboard({ orientation: 'portrait', frames: 4, aspect: '5:7' }).aspect, '16:9', 'storyboard: an unknown aspect becomes 16:9');
  eq(R.renderStoryboard({ orientation: 'portrait', frames: 4, aspect: '4:3', captionLines: 99 }).captionLines, 4, 'storyboard: caption lines are capped at 4');
  eq(R.renderStoryboard({ orientation: 'portrait', frames: 4, aspect: '4:3', captionLines: -3 }).captionLines, 0, 'storyboard: and are not negative');
}

/* ── 10d. music staves ─────────────────────────────────────────────────── */
console.log('10d. music staff paper');
for (const orientation of ['portrait', 'landscape']) for (const header of [null, HEADER]) for (const grand of [false, true]) for (const gap of [0.08, 0.1, 0.125, 0.16, 0.2]) {
  const tag = `staves ${orientation}${header ? '+header' : ''} ${grand ? 'grand' : 'single'} gap ${gap}`;
  const page = PAGES[orientation];
  const headerH = header ? HEADER_H : 0;
  const out = R.renderMusicStaves({ orientation, lineGap: gap, grand, header });
  const g = parse(out.svg);
  const staffLines = g.lines.filter(l => horiz(l) && l.w === TICK_W);
  eq(staffLines.length, out.staves * 5, `${tag}: five lines on each of ${out.staves} staves`);
  ok(staffLines.every(l => Math.abs(l.x1 - MARGIN) < 1e-3 && Math.abs(l.x2 - (page.w - MARGIN)) < 1e-3), `${tag}: every staff line runs the full width`);
  const ys = sorted(staffLines.map(l => l.y1));
  // group into staves of five
  const staves = []; for (let i = 0; i < ys.length; i += 5) staves.push(ys.slice(i, i + 5));
  ok(staves.every(s => allNear(diffs(s), gap, 3e-4)), `${tag}: the five lines of every staff are exactly ${gap}in apart`);
  const tops = staves.map(s => s[0]);
  if (!grand) ok(tops.length < 2 || allNear(diffs(tops), 8.5 * gap, 3e-4), `${tag}: staves repeat at a fixed pitch of 8.5 line gaps`);
  else {
    const within = tops.filter((_, i) => i % 2 === 1).map((t, i) => t - tops[2 * i]);
    ok(allNear(within, 4 * gap + 3 * gap, 3e-4), `${tag}: the two staves of a pair are ${7 * gap}in top to top`);
    const between = tops.filter((_, i) => i % 2 === 0).map(t => t);
    ok(between.length < 2 || allNear(diffs(between), 16 * gap, 3e-4), `${tag}: pairs repeat every 16 line gaps`);
    const bars = g.lines.filter(l => vert(l) && l.w === BOLD && Math.abs(l.x1 - MARGIN) < 1e-3);
    eq(bars.length, out.staves / 2, `${tag}: one joining bar per pair at the left`);
    ok(bars.every((b, i) => Math.abs(b.y1 - tops[2 * i]) < 3e-4 && Math.abs(b.y2 - (staves[2 * i + 1][4])) < 3e-4), `${tag}: spanning both staves of its pair`);
  }
  // as many as fit: one more would run past the bottom margin
  const unit = grand ? 11 * gap : 4 * gap, pitch = grand ? 16 * gap : 8.5 * gap;
  const room = page.h - 2 * MARGIN - headerH;
  eq(out.systems.length, Math.floor((room - unit) / pitch + 1e-9) + 1, `${tag}: as many systems as fit (a last one that ends exactly on the margin counts)`);
  ok((out.systems.length) * pitch - pitch + unit + pitch > room, `${tag}: and one more would not fit`);
  const firstTop = tops[0] - (MARGIN + headerH), lastBottom = (MARGIN + headerH + room) - staves[staves.length - 1][4];
  near(firstTop, lastBottom, 3e-4, `${tag}: centred top to bottom in the room under the header`);
  const bound = g.lines.filter(l => vert(l) && l.w === TICK_W);
  eq(bound.length, out.staves * 2, `${tag}: a bar at each end of every staff`);
  onPaper(out.svg, page, headerH, tag);
}
eq(R.renderMusicStaves({ orientation: 'portrait', lineGap: 0, grand: false }).gap, 0.125, 'staves: a zero gap becomes 0.125 inch');
eq(R.renderMusicStaves({ orientation: 'portrait', lineGap: 0.01, grand: false }).gap, 0.05, 'staves: a gap under 0.05 is held to 0.05');
eq(R.renderMusicStaves({ orientation: 'portrait', lineGap: 9, grand: true }).staves, 0, 'staves: a gap too big for one pair draws none, without an error');

/* ── 11. nothing past the paper, nothing NaN, under a lot of option sets ─ */
console.log('11. a thousand random option sets');
{
  let seed = 20261007;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const rr = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  let bad = 0, worst = '';
  for (let i = 0; i < 1000; i++) {
    const orientation = pick(['portrait', 'landscape']);
    const header = pick([null, HEADER, { title: 'T', showName: false, showDate: false }]);
    const faded = rnd() < 0.5;
    const kind = pick(['polar', 'log', 'fraction', 'decimal', 'open', 'double', 'vertical', 'hex', 'storyboard', 'music']);
    let out, label;
    if (kind === 'polar') { out = R.renderPolarPaper({ orientation, rays: pick([12, 16, 24, 7]), ringStep: pick([0.05, 0.25, 0.3937, 0.5, 1, 3, -1, 'x']), labels: rnd() < 0.5, faded, header }); label = 'polar'; }
    else if (kind === 'log') { out = R.renderLogPaper({ orientation, kind: pick(['semilog', 'loglog', 'x']), decades: rr(-1, 9), startExp: rr(-9, 9), xDecades: rr(-1, 9), xStartExp: rr(-9, 9), xDivisions: pick([10, 20, 7]), faded, header }); label = 'log'; }
    else if (kind === 'fraction') { out = R.renderFractionLine({ orientation, min: rr(-6, 6), max: rr(-6, 12), denominator: rr(-2, 40), labelStyle: pick(['mixed', 'improper', 'x']), reduce: rnd() < 0.5, labelEvery: rr(-2, 20), copies: rr(-1, 14), faded, header }); label = 'fraction'; }
    else if (kind === 'decimal') { out = R.renderDecimalLine({ orientation, min: pick([0, -1, 0.3, -2.5, 7, 'x']), max: pick([1, 0.5, 10, 100, -4, 'y']), step: pick(['ones', 'tenths', 'hundredths', 'x']), labelEvery: rr(-2, 20), copies: rr(-1, 14), faded, header }); label = 'decimal'; }
    else if (kind === 'open') { out = R.renderOpenLine({ orientation, ticks: rr(-3, 100), copies: rr(-1, 14), faded, header }); label = 'open'; }
    else if (kind === 'double') { out = R.renderDoubleLine({ orientation, topStep: pick([1, 0.1, 3, 0, -2, 25.5, 'x']), bottomStep: pick([1, 2.5, 12, 0, 'y']), intervals: rr(-2, 40), topName: pick(['', 'miles', 'a very long name indeed']), bottomName: pick(['', 'min', '<i>']), bottom: pick(['all', 'example', 'none', 'x']), copies: rr(-1, 9), faded, header }); label = 'double'; }
    else if (kind === 'hex') { out = R.renderHexPaper({ orientation, cellSize: pick([0.05, 0.1, 0.25, 0.3937, 0.5, 1, 5, 'x', -1]), hexTop: pick(['pointy', 'flat', 'x']), faded, header }); label = 'hex'; }
    else if (kind === 'storyboard') { out = R.renderStoryboard({ orientation, frames: pick([1, 2, 3, 4, 6, 7, 8, 9, 12, 20, 'x']), aspect: pick(['16:9', '4:3', '1:1', '2.35:1', 'x']), captionLines: rr(-2, 9), faded, header }); label = 'storyboard'; }
    else if (kind === 'music') { out = R.renderMusicStaves({ orientation, lineGap: pick([0, 0.01, 0.05, 0.1, 0.125, 0.2, 0.5, 9, 'x']), grand: rnd() < 0.5, faded, header }); label = 'music'; }
    else { out = R.renderVerticalLine({ orientation, min: pick([0, -20, 0.5, 'x']), max: pick([100, 1, -5, 'y']), interval: pick([10, 0.1, 0, 1, 0.001, 'z']), labelEvery: rr(-2, 30), copies: rr(-1, 12), faded, header }); label = 'vertical'; }
    const svg = out.svg;
    const page = PAGES[orientation];
    const problems = [];
    if (/NaN|Infinity|undefined|null/.test(svg)) problems.push('non-finite');
    if (!fits(svg, page)) problems.push('size');
    const g = parse(svg);
    for (const l of g.lines) for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) if (x < MARGIN - 1e-3 || x > page.w - MARGIN + 1e-3 || y < MARGIN - 1e-3 || y > page.h - MARGIN + 1e-3) problems.push('line off the margin');
    for (const w of g.widths) if (w < THIN - 1e-9) problems.push('hairline');
    for (const t of g.texts) if (t.x < 0.1 || t.x > page.w - 0.1 || t.y < 0.1 || t.y > page.h - 0.1) problems.push('text off the sheet');
    if (problems.length) { bad++; worst = worst || `${label} ${JSON.stringify(problems.slice(0, 2))}`; }
  }
  ok(bad === 0, `1000 random option sets, valid and invalid, all draw cleanly on the paper (${bad} bad; first: ${worst})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.slice(0, 40).forEach(f => console.log('  - ' + f)); process.exit(1); }
