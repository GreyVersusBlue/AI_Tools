// geo-project.test.mjs — _shared/geo-project.js on its own (Path 20 P1), pure Node.
// Small hand-made shapes whose answers are known: the projection and its inverse, the
// antimeridian unwrap (Fiji, Antarctica), per-feature tracing with a hole, the
// even-odd hit test, compactRings. Then the guard on the guard: each MUTANT below
// re-imports the module's source with one deliberate defect and the suite must notice
// (a check that passes on broken code is not a check).
//
//   node Tools/blank-map-generator/test/geo-project.test.mjs   (npm run test:geo-project)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../../../_shared/geo-project.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'geo-project.js'), 'utf8');

let failed = 0, checks = 0;
function suite(M, label, collect) {
  const bad = [];
  const ok = (cond, msg) => { checks++; if (!cond) bad.push(msg); };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  const B = { north: 10, south: -10, west: 100, east: 140 };
  const p = M.projectPoint(B, 400, 200, 120, 0);
  ok(near(p.x, 200) && near(p.y, 100), 'projectPoint centre');
  const q = M.projectPoint(B, 400, 200, 100, 10);
  ok(near(q.x, 0) && near(q.y, 0), 'projectPoint north-west corner is 0,0');
  const r = M.unprojectPoint(B, 400, 200, 100, 50);
  ok(near(r.lon, 110) && near(r.lat, 5), 'unprojectPoint');
  for (const [lon, lat] of [[103.5, -7.25], [139, 9], [100, -10]]) {
    const pp = M.projectPoint(B, 400, 200, lon, lat), back = M.unprojectPoint(B, 400, 200, pp.x, pp.y);
    ok(near(back.lon, lon) && near(back.lat, lat), `projection round trip ${lon},${lat}`);
  }
  const sz = M.pixelSizeFor({ north: 10, south: -10, west: 0, east: 40 });
  ok(sz.width === 4000 && sz.height === 2000, 'pixelSizeFor keeps the long side at 4000');
  ok(M.pixelSizeFor({ north: 10, south: -10, west: 0, east: 40 }, 800).width === 800, 'pixelSizeFor honours longSide');
  const tiny = M.pixelSizeFor({ north: 0.0001, south: 0, west: 0, east: 40 });
  ok(tiny.height === 2, 'pixelSizeFor never returns under 2 px');

  // Fiji-like ring: vertices clamped to the antimeridian
  const fiji = [[179, -17], [180, -17], [-180, -18], [-179, -18], [179, -17]];
  const un = M.unwrapRing(fiji);
  ok(un.every((pt, i) => i === 0 || Math.abs(pt[0] - un[i - 1][0]) <= 180), 'unwrapRing: no jump over 180');
  ok(un[2][0] === 180 && un[3][0] === 181, 'unwrapRing: continues past 180');
  const fd = M.drawableRings(fiji, true);
  ok(fd.length === 2 && fd.some(x => x.points.some(pt => pt[0] < -170)) && fd.every(x => x.closed), 'drawableRings: Fiji is drawn at both edges');
  ok(M.unwrapRing([[0, 0], [180.5, 0]])[1][0] === -179.5, 'unwrapRing: a 180.5 degree step wraps');
  const west = M.drawableRings([[-181, 0], [-179, 1], [-179, -1]], true);
  ok(west.length === 2 && west.some(x => x.points.some(pt => pt[0] > 178)), 'drawableRings: a ring poking past -180 is also drawn at the east edge');
  // Antarctica-like ring that goes all the way round
  const ant = [[-180, -70], [-90, -75], [0, -72], [90, -75], [180, -70]];
  const antFill = M.drawableRings(ant, false), antLine = M.drawableRings(ant, true);
  ok(antFill.length === 1 && antFill[0].closed && antFill[0].points.length === 7 && antFill[0].points[5][1] === -90, 'drawableRings: encircling ring is closed through the pole to fill');
  ok(antLine[0].closed === false && antLine[0].points.length === 5, 'drawableRings: stroke form is open, with no pole closure');
  const north = M.drawableRings([[-180, 70], [0, 72], [180, 70]], false)[0];
  ok(north.points[north.points.length - 1][1] === 90, 'drawableRings: northern encircling ring closes at +90');

  // traceFeature: a square with a square hole is one beginPath-free run of two closed subpaths
  const square = { type: 'Feature', properties: { name: 'Sq' }, geometry: { type: 'Polygon', coordinates: [
    [[100, 10], [140, 10], [140, -10], [100, -10], [100, 10]],
    [[110, 5], [130, 5], [130, -5], [110, -5], [110, 10 - 5]],
  ] } };
  const ops = [];
  const ctx = { beginPath() { ops.push('b'); }, moveTo(x, y) { ops.push(`m${x},${y}`); }, lineTo(x, y) { ops.push(`l${x},${y}`); }, closePath() { ops.push('c'); } };
  M.traceFeature(ctx, square, B, 400, 200, false);
  ok(ops.filter(o => o[0] === 'm').length === 2 && ops.filter(o => o === 'c').length === 2 && !ops.includes('b'), 'traceFeature: two subpaths, no beginPath of its own');
  ok(ops[0] === 'm0,0' && ops[1] === 'l400,0', 'traceFeature: projects through projectPoint');
  const none = []; M.traceFeature({ moveTo() { none.push(1); } }, { geometry: null }, B, 400, 200, false);
  ok(none.length === 0, 'traceFeature: a feature with no geometry draws nothing');
  const multi = { geometry: { type: 'MultiPolygon', coordinates: [square.geometry.coordinates, square.geometry.coordinates] } };
  const ops2 = []; M.traceFeature({ moveTo() { ops2.push('m'); }, lineTo() {}, closePath() {} }, multi, B, 400, 200, false);
  ok(ops2.length === 4, 'traceFeature: MultiPolygon traces every polygon');
  const ops3 = []; M.traceFeatures({ beginPath() { ops3.push('b'); }, moveTo() {}, lineTo() {}, closePath() {} }, { features: [square, square] }, B, 400, 200);
  ok(ops3.length === 1, 'traceFeatures: exactly one beginPath for the whole layer');

  // hit test: hole belongs to nobody, an island inside it belongs to its own feature
  const island = { type: 'Feature', properties: { name: 'Isle' }, geometry: { type: 'Polygon', coordinates: [[[118, 2], [122, 2], [122, -2], [118, -2], [118, 2]]] } };
  const multiFeature = { type: 'Feature', properties: { name: 'Multi' }, geometry: { type: 'MultiPolygon', coordinates: [
    [[[112, 2], [114, 2], [114, 1], [112, 1], [112, 2]]], [[[126, -1], [128, -1], [128, -2], [126, -2], [126, -1]]]] } };
  const idx = M.buildRegionIndex({ features: [square, island, multiFeature, { properties: {}, geometry: square.geometry }] }, B, 400, 200);
  ok(idx.length === 3, 'buildRegionIndex: skips a feature with no name');
  const at = (lon, lat) => { const pt = M.projectPoint(B, 400, 200, lon, lat); const h = M.hitTestRegion(idx, pt.x, pt.y); return h && h.name; };
  ok(at(104, 8) === 'Sq', 'hit test: inside the outer ring');
  ok(at(112, 3) === null, 'hit test: inside the hole is outside the feature');
  ok(at(120, 0) === 'Isle', 'hit test: the island in the hole is its own region');
  ok(at(100.1, 8) === 'Sq', 'hit test: a point a pixel inside the left edge is inside');
  ok(at(113, 1.5) === 'Multi' && at(127, -1.5) === 'Multi', 'hit test: both polygons of a MultiPolygon are one region');
  ok(at(150, 0) === null, 'hit test: outside everything');
  ok(M.hitTestRegion([], 1, 1) === null && M.hitTestRegion(undefined, 1, 1) === null, 'hit test: no index, no hit');
  ok(M.pointInRings([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]], 5, 5) && !M.pointInRings([[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]], 15, 5), 'pointInRings basic');
  ok(M.largestRing([[1, 2], [1, 2, 3], [1]]).length === 3 && M.largestRing(null).length === 0, 'largestRing');
  const c = M.compactRings([[{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.4 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 0.1, y: 0.1 }], [{ x: 0, y: 0 }, { x: 1, y: 1 }]]);
  ok(c.length === 1 && c[0].length === 4, 'compactRings: rounds, drops repeats and the closing point, drops a sliver');
  ok(M.projectFeatureRings({ geometry: { type: 'Point', coordinates: [0, 0] } }, B, 400, 200).length === 0, 'projectFeatureRings: not a polygon, no rings');

  if (collect) return bad;
  if (bad.length) { failed += bad.length; for (const m of bad) console.error(`FAIL  ${label}: ${m}`); }
  return bad;
}

suite(G, 'real module');

// Mutants: [description, from, to]. Each must make at least one check fail.
const MUTANTS = [
  ['unwrap only one way', 'while (prev - lon > 180) lon += 360;', ''],
  ['unwrap threshold off by a degree', 'while (lon - prev > 180) lon -= 360;', 'while (lon - prev > 181) lon -= 360;'],
  ['no pole closure when filling', 'un.push([last, pole], [first, pole]);', ''],
  ['pole closure on strokes too', 'if (encircles && !forStroke) {', 'if (encircles) {'],
  ['no -360 shift', 'if (max > 180) shifts.push(-360);', ''],
  ['no +360 shift', 'if (min < -180) shifts.push(360);', ''],
  ['y axis not flipped', 'y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,', 'y: ((lat - bounds.south) / (bounds.north - bounds.south)) * height,'],
  ['inverse lat sign', 'lat: bounds.north - (y / height) * (bounds.north - bounds.south),', 'lat: bounds.south + (y / height) * (bounds.north - bounds.south),'],
  ['trace skips MultiPolygon', "else if (g.type === 'MultiPolygon') for", "else if (g.type === 'Nope') for"],
  ['traceFeatures forgets beginPath', 'ctx.beginPath();\n  for (const feature of geojson.features', 'for (const feature of geojson.features'],
  ['hit test ignores holes', 'if (x < a.x + t * (b.x - a.x)) inside = !inside;', 'if (x < a.x + t * (b.x - a.x)) inside = true;'],
  ['bounding box too tight', 'x >= bbox.minX && x <= bbox.maxX', 'x >= bbox.minX + 5 && x <= bbox.maxX'],
  ['pixelSizeFor floor gone', 'Math.max(2, Math.round(latSpan * scale))', 'Math.round(latSpan * scale)'],
  ['compactRings keeps the closing point', 'if (simplified.length > 1 && first.x === last.x && first.y === last.y) simplified.pop();', ''],
  ['featureRings flat() missing', "(g.coordinates || []).flat()", '(g.coordinates || [])'],
];

for (const [name, from, to] of MUTANTS) {
  if (SRC.split(from).length !== 2) { failed++; console.error(`FAIL  mutant "${name}": its target text is not in geo-project.js exactly once (the module changed; update the mutant)`); continue; }
  const mod = await import('data:text/javascript;base64,' + Buffer.from(SRC.replace(from, to)).toString('base64'));
  const bad = suite(mod, name, true);
  checks++;
  if (!bad.length) { failed++; console.error(`FAIL  mutant "${name}" was not noticed by any check`); }
}

console.log(failed ? `geo-project: ${failed} FAILED (${checks} checks)` : `geo-project: OK — ${checks} checks, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
