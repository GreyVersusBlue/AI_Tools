// geo-bee-parity.test.mjs — 062's map snippets after they switched from gbq-map.js's own
// adapted antimeridian handling to _shared/geo-project.js (Path 20 P1, rank 59). The old
// functions are frozen in _legacy-gbq-geo.mjs; both are fed the real two GeoJSON files
// 062 reads, under every crop 062 draws, at the sizes it draws, and must record the same
// path operations to the last digit, stroke and fill, whole layer and per feature. Then
// gbq-map.js itself is read: it must import the shared functions and no longer define its
// own copies. A mutant (one defect in the old code) must be caught, so the comparison is
// known to be able to fail.
//
//   node Tools/geography-bee-quiz-generator/test/geo-bee-parity.test.mjs   (npm run test:geo-bee-parity)
// Pure Node, no browser, no port. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Old from './_legacy-gbq-geo.mjs';
import * as New from '../../../_shared/geo-project.js';
import { BASE_MAP_PRESETS } from '../../blank-map-generator/bmg-vector.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', '..', 'blank-map-generator', 'data');
const load = f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
const DATASETS = { world: load('world-countries-110m.json'), us: load('us-states-10m.json') };

let failed = 0, checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { failed++; console.error('FAIL  ' + msg); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function recorder() {
  const ops = [];
  return {
    ops,
    beginPath() { ops.push('b'); },
    moveTo(x, y) { ops.push('m' + x + ',' + y); },
    lineTo(x, y) { ops.push('l' + x + ',' + y); },
    closePath() { ops.push('c'); },
  };
}

// 062 draws snippets 320 css px wide at ratio 2 (and a printed quiz the same), plus whatever
// width a caller asks for: cover a small, the usual and a large bitmap.
const WIDTHS = [96, 640, 1800];
function size(bounds, w) {
  return { w, h: Math.max(30, Math.round(w * (Math.abs(bounds.north - bounds.south) / Math.abs(bounds.east - bounds.west)))) };
}

function traceLayer(trace, geo, bounds, w, h, forStroke) {
  const r = recorder();
  for (const f of geo.features || []) trace(r, f, bounds, w, h, forStroke);
  return r.ops;
}

function compare(newTrace, label) {
  let bad = 0, total = 0;
  for (const geo of Object.values(DATASETS)) {
    for (const preset of BASE_MAP_PRESETS) {
      for (const width of WIDTHS) {
        const { w, h } = size(preset.bounds, width);
        for (const forStroke of [false, true]) {
          total++;
          const a = traceLayer(Old.traceFeature, geo, preset.bounds, w, h, forStroke);
          const b = traceLayer(newTrace, geo, preset.bounds, w, h, forStroke);
          if (!(a.length > 1 && same(a, b))) bad++;
        }
      }
      // a region on its own, filled and stroked: the highlighted answer
      for (const f of geo.features) {
        const { w, h } = size(preset.bounds, 640);
        for (const forStroke of [false, true]) {
          total++;
          const a = recorder(), b = recorder();
          Old.traceFeature(a, f, preset.bounds, w, h, forStroke);
          newTrace(b, f, preset.bounds, w, h, forStroke);
          if (!same(a.ops, b.ops)) bad++;
        }
      }
    }
  }
  return { bad, total, label };
}

const real = compare(New.traceFeature, 'shared traceFeature');
ok(real.total > 1000 && real.bad === 0, `traceFeature: ${real.total} layer and region traces, ${real.bad} differ`);

// drawableRings and the projection on their own
let ringBad = 0, rings = 0;
for (const geo of Object.values(DATASETS)) for (const f of geo.features) for (const poly of Old.polygonsOf(f)) for (const ring of poly) {
  for (const stroke of [false, true]) {
    rings++;
    if (!same(Old.drawableRings(ring, stroke), New.drawableRings(ring, stroke))) ringBad++;
  }
  if (!same(Old.unwrapRing(ring), New.unwrapRing(ring))) ringBad++;
}
ok(rings > 500 && ringBad === 0, `drawableRings / unwrapRing over ${rings} ring passes (${ringBad} differ)`);

let projBad = 0;
for (const preset of BASE_MAP_PRESETS) for (const [lon, lat] of [[0, 0], [-180, 90], [179.99, -89.5], [-96.3, 38.2], [12.5, 41.9]]) {
  if (!same(Old.project(preset.bounds, 640, 480, lon, lat), New.projectPoint(preset.bounds, 640, 480, lon, lat))) projBad++;
}
ok(projBad === 0, `projection: project == projectPoint (${projBad} differ)`);

// the mutants: one defect each in the frozen code must be seen
const mutants = {
  'antimeridian unwrap dropped': (ctx, f, b, w, h, s) => {
    const g = f.geometry; if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) for (const ring of poly) {
      ring.forEach((p, i) => { const q = Old.project(b, w, h, p[0], p[1]); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      ctx.closePath();
    }
  },
  'rings not closed when filling': (ctx, f, b, w, h, s) => {
    const r = recorder(); Old.traceFeature(r, f, b, w, h, s);
    for (const op of r.ops) { if (op === 'c') continue; if (op[0] === 'm') ctx.moveTo(...op.slice(1).split(',').map(Number)); else if (op[0] === 'l') ctx.lineTo(...op.slice(1).split(',').map(Number)); }
  },
  'y axis not flipped': (ctx, f, b, w, h, s) => Old.traceFeature(ctx, f, { ...b, north: b.south, south: b.north }, w, h, s),
};
for (const [name, fn] of Object.entries(mutants)) {
  const m = compare(fn, name);
  ok(m.bad > 0, `mutant "${name}" is caught (${m.bad} of ${m.total} differ)`);
}

// gbq-map.js itself: shared import in, own copies out
const src = fs.readFileSync(path.join(here, '..', 'gbq-map.js'), 'utf8');
ok(/from '\.\.\/\.\.\/_shared\/geo-project\.js'/.test(src), 'gbq-map.js imports _shared/geo-project.js');
for (const name of ['unwrapRing', 'drawableRings', 'project', 'traceFeature']) {
  ok(!new RegExp('function ' + name + '\\s*\\(').test(src), `gbq-map.js no longer defines its own ${name}()`);
}
ok(/traceFeature\(ctx, target, bounds, w, h, true\)/.test(src), 'gbq-map.js still strokes the answer through traceFeature');

console.log(failed ? `geo-bee-parity: ${failed} of ${checks} checks FAILED` : `geo-bee-parity: OK — ${checks} checks, 062 draws the shared geometry the old copy drew`);
process.exit(failed ? 1 : 0);
