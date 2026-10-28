// geo-project-parity.test.mjs — _shared/geo-project.js against 046's own geometry as
// it was before Path 20 P1 moved it (_legacy-geo.mjs, frozen). Both are fed the real
// four GeoJSON files under all nine presets and must give identical answers:
//   - every recorded path operation (moveTo/lineTo/closePath, in order, to the last
//     digit) for the whole layer stroked and filled and for every feature on its own;
//   - drawableRings for every ring of every feature, stroke and fill;
//   - projectFeatureRings, buildRegionIndex and hitTestRegion on a grid of 61x61 points
//     over each preset, and largestRing / compactRings on the projected rings;
//   - pixelSizeFor at the default and a smaller long side;
//   - the names bmg-vector.js and bmg-hittest.js still export (re-exports intact).
//
//   node Tools/blank-map-generator/test/geo-project-parity.test.mjs   (npm run test:geo-project-parity)
// Pure Node, no browser, no port. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Old from './_legacy-geo.mjs';
import * as New from '../../../_shared/geo-project.js';
import * as Vec from '../bmg-vector.js';
import * as Hit from '../bmg-hittest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
const load = f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
const FILES = {
  world: { whole: load('world-land-110m.json'), divided: load('world-countries-110m.json') },
  us: { whole: load('us-nation-10m.json'), divided: load('us-states-10m.json') },
};

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

for (const preset of Vec.BASE_MAP_PRESETS) {
  const { bounds } = preset;
  const { width, height } = Old.pixelSizeFor(bounds);
  ok(same(New.pixelSizeFor(bounds), { width, height }), `${preset.key}: pixelSizeFor default`);
  ok(same(New.pixelSizeFor(bounds, 900), Old.pixelSizeFor(bounds, 900)), `${preset.key}: pixelSizeFor 900`);
  ok(same(Vec.pixelSizeFor(bounds), { width, height }), `${preset.key}: bmg-vector re-export of pixelSizeFor`);

  const layers = FILES[preset.dataset];
  for (const layerName of ['whole', 'divided']) {
    const layer = layers[layerName];
    for (const forStroke of [false, true]) {
      const a = recorder(), b = recorder();
      Old.traceFeatures(a, layer, bounds, width, height, forStroke);
      New.traceFeatures(b, layer, bounds, width, height, forStroke);
      ok(a.ops.length > 1 && same(a.ops, b.ops), `${preset.key}/${layerName}/stroke=${forStroke}: traceFeatures ops (${a.ops.length})`);
    }
    // per feature, filled: what the choropleth does
    let bad = 0;
    for (const f of layer.features) {
      const a = recorder(), b = recorder();
      Old.traceOneFeature(a, f, bounds, width, height, false);
      New.traceFeature(b, f, bounds, width, height, false);
      if (!same(a.ops, b.ops)) bad++;
    }
    ok(bad === 0, `${preset.key}/${layerName}: traceFeature per feature (${bad} differ of ${layer.features.length})`);
  }

  const divided = layers.divided;
  let ringBad = 0, rings = 0;
  for (const f of divided.features) for (const ring of Old.featureRings(f)) {
    for (const fs_ of [false, true]) {
      rings++;
      if (!same(Old.drawableRings(ring, fs_), New.drawableRings(ring, fs_))) ringBad++;
    }
  }
  ok(rings > 100 && ringBad === 0, `${preset.key}: drawableRings over ${rings} rings (${ringBad} differ)`);

  const oldIdx = Old.buildRegionIndex(divided, bounds, width, height);
  const newIdx = New.buildRegionIndex(divided, bounds, width, height);
  ok(oldIdx.length > 0 && same(oldIdx, newIdx), `${preset.key}: buildRegionIndex (${oldIdx.length} regions)`);
  ok(same(Hit.buildRegionIndex(divided, bounds, width, height), oldIdx), `${preset.key}: bmg-hittest re-export builds the same index`);

  let hitBad = 0, hits = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = (i / N) * width, y = (j / N) * height;
    const a = Old.hitTestRegion(oldIdx, x, y), b = New.hitTestRegion(newIdx, x, y);
    if ((a && a.name) !== (b && b.name)) hitBad++;
    if (a) hits++;
  }
  ok(hits > 0 && hitBad === 0, `${preset.key}: hitTestRegion on ${(N + 1) ** 2} points (${hits} land, ${hitBad} differ)`);

  let ringsBad = 0;
  for (const e of oldIdx) {
    if (!same(Old.largestRing(e.rings), New.largestRing(e.rings))) ringsBad++;
    if (!same(Old.compactRings(e.rings), New.compactRings(e.rings))) ringsBad++;
    if (!same(Old.compactRings(e.rings, 2), New.compactRings(e.rings, 2))) ringsBad++;
  }
  ok(ringsBad === 0, `${preset.key}: largestRing / compactRings (${ringsBad} differ)`);
}

for (const name of ['projectPoint', 'drawableRings', 'pixelSizeFor']) {
  ok(Vec[name] === New[name], `bmg-vector.js still exports ${name}, and it is the shared one`);
}
for (const name of ['projectFeatureRings', 'buildRegionIndex', 'pointInRings', 'hitTestRegion', 'largestRing', 'compactRings']) {
  ok(Hit[name] === New[name], `bmg-hittest.js still exports ${name}, and it is the shared one`);
}

console.log(failed ? `geo-project-parity: ${failed} of ${checks} checks FAILED` : `geo-project-parity: OK — ${checks} checks, shared geometry == frozen 046 code`);
process.exit(failed ? 1 : 0);
