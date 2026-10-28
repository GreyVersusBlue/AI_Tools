// dropped.test.mjs — bmg-dropped.js on its own (Path 20 P2), pure Node, no port.
// A dropped GeoJSON or TopoJSON file's text goes in; what comes out is checked case by
// case: what is accepted (each GeoJSON shape, TopoJSON with and without a transform, shared
// and reversed arcs), the calibration bounds (padding, the antimeridian, the whole world),
// what a bad file says (each one a named case, with the fix in the sentence), the limits,
// that the key follows the content, and that the module cannot reach the network. Then each
// MUTANT below re-imports the source with one deliberate defect and the suite must notice
// (a check that passes on broken code is not a check).
//
//   node Tools/blank-map-generator/test/dropped.test.mjs   (npm run test:blank-map-dropped)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as Real from '../bmg-dropped.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.join(here, '..', 'bmg-dropped.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const SHARED_URL = pathToFileURL(path.join(here, '..', '..', '..', '_shared', 'geo-project.js')).href;

const sq = (x, y, s = 1) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
const fc = (...feats) => JSON.stringify({ type: 'FeatureCollection', features: feats });
const feat = (name, coords, type = 'Polygon') => ({ type: 'Feature', properties: name == null ? {} : { name }, geometry: { type, coordinates: coords } });

// A TopoJSON of two squares sharing the edge x=1 (with a middle vertex, so a reversed walk shows): ring A walks it up, ring B walks the same arc backwards.
function topo({ transform = true, extraObject = false } = {}) {
  // arcs in absolute lon/lat: 0 = shared edge (1,0)->(1,1); 1 = A's other three sides; 2 = B's other three sides
  const abs = [[[1, 0], [1, 0.5], [1, 1]], [[1, 1], [0, 1], [0, 0], [1, 0]], [[1, 0], [2, 0], [2, 1], [1, 1]]];
  let arcs = abs, tf;
  if (transform) {
    tf = { scale: [0.5, 0.25], translate: [-1, -1] };
    arcs = abs.map(a => {
      let px = 0, py = 0;
      return a.map(([lon, lat]) => { const x = Math.round((lon - tf.translate[0]) / tf.scale[0]), y = Math.round((lat - tf.translate[1]) / tf.scale[1]); const d = [x - px, y - py]; px = x; py = y; return d; });
    });
  }
  const objects = {};
  if (extraObject) objects.land = { type: 'Polygon', properties: { name: 'Land' }, arcs: [[0, 1]] };
  objects.states = { type: 'GeometryCollection', geometries: [
    { type: 'Polygon', properties: { name: 'Alpha' }, arcs: [[0, 1]] },
    { type: 'Polygon', properties: { name: 'Beta' }, arcs: [[2, ~0]] },
  ] };
  return JSON.stringify({ type: 'Topology', ...(tf ? { transform: tf } : {}), objects, arcs });
}

function suite(M) {
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const P = (text, name = 'x.geojson') => M.parseBoundaryFile(text, name);
  const refused = (r, re, msg) => ok(r && r.ok === false && re.test(r.message), `${msg} (got ${JSON.stringify(r && (r.message || 'ok'))})`);
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  // ---- accepted, each GeoJSON shape ----
  let r = P(fc(feat('Alpha', [sq(0, 0)]), feat('Beta', [sq(2, 0)])), 'Districts.geojson');
  ok(r.ok && r.kind === 'geojson' && r.stats.shapes === 2 && r.stats.rings === 2 && r.stats.vertices === 10, 'FeatureCollection: two shapes, ten vertices');
  ok(r.ok && r.title === 'Districts' && r.geojson.features[0].properties.name === 'Alpha', 'title from the file name; names kept');
  ok(r.ok && /^custom-[0-9a-f]{16}$/.test(r.key), 'key is custom- and sixteen hex digits');
  ok(r.ok && near(r.bounds.west, -0.12) && near(r.bounds.east, 3.12) && near(r.bounds.south, -0.04) && near(r.bounds.north, 1.04), 'bounds are the data box plus 4% a side ' + JSON.stringify(r.bounds));
  r = P(JSON.stringify(feat('One', [sq(5, 5, 2)])));
  ok(r.ok && r.stats.shapes === 1, 'a bare Feature');
  r = P(JSON.stringify({ type: 'Polygon', coordinates: [sq(5, 5, 2)] }));
  ok(r.ok && r.geojson.features[0].properties.name === 'Shape 1', 'a bare Polygon, unnamed, is Shape 1');
  r = P(JSON.stringify({ type: 'MultiPolygon', coordinates: [[sq(0, 0)], [sq(3, 3)]] }));
  ok(r.ok && r.geojson.features[0].geometry.type === 'MultiPolygon', 'a bare MultiPolygon stays one MultiPolygon shape');
  r = P(JSON.stringify({ type: 'GeometryCollection', geometries: [{ type: 'Polygon', coordinates: [sq(0, 0)] }, { type: 'Polygon', coordinates: [sq(4, 4)] }] }));
  ok(r.ok && r.stats.shapes === 2, 'a GeometryCollection of polygons');
  r = P(fc(feat('Ring', [sq(0, 0, 10), sq(3, 3, 2)])));
  ok(r.ok && r.stats.rings === 2 && r.geojson.features[0].geometry.coordinates.length === 2, 'a hole ring is kept inside its polygon');

  // ---- cleaning ----
  r = P(fc(feat('Open', [[[0, 0], [1, 0], [1, 1], [0, 1]]])));
  const ring0 = r.ok && r.geojson.features[0].geometry.coordinates[0];
  ok(r.ok && ring0.length === 5 && ring0[0][0] === ring0[4][0] && ring0[0][1] === ring0[4][1], 'an unclosed ring is closed');
  r = P(fc(feat('Dup', [[[0, 0], [0, 0], [1, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])));
  ok(r.ok && r.stats.vertices === 5, 'repeated consecutive points are dropped');
  r = P(fc(feat('Round', [[[0.123456789, 0], [1.000049, 0], [1, 1.2345678], [0, 1], [0.123456789, 0]]])));
  ok(r.ok && r.geojson.features[0].geometry.coordinates[0][0][0] === 0.1235, 'coordinates are rounded to four decimals');
  r = P(fc(feat('Tiny', [[[0, 0], [1, 1], [0, 0]]]), feat('Fine', [sq(2, 2)])));
  ok(r.ok && r.stats.shapes === 1 && r.warnings.some(w => /ring|outline/.test(w)), 'a two-point ring is left out and said');
  r = P(fc(feat('A\u0007B\nC', [sq(0, 0)])));
  ok(r.ok && r.geojson.features[0].properties.name === 'A B C', 'control characters in a name become spaces');
  r = P(fc({ type: 'Feature', properties: { NAMELSAD: 'Smith County', GEOID: 12 }, geometry: { type: 'Polygon', coordinates: [sq(0, 0)] } }, { type: 'Feature', properties: { zone: 'Zone 9' }, geometry: { type: 'Polygon', coordinates: [sq(2, 2)] } }, { type: 'Feature', properties: null, geometry: { type: 'Polygon', coordinates: [sq(4, 4)] } }));
  ok(r.ok && r.geojson.features.map(f => f.properties.name).join('|') === 'Smith County|Zone 9|Shape 3', 'names: known key, then first short string, else Shape N');
  ok(r.ok && r.warnings.some(w => /1 shape/.test(w) && /Shape N/.test(w)), 'unnamed shapes are said');
  r = P(fc(feat('Alpha', [sq(0, 0)]), { type: 'Feature', properties: { name: 'Well' }, geometry: { type: 'Point', coordinates: [0.5, 0.5] } }, { type: 'Feature', properties: { name: 'River' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }));
  ok(r.ok && r.stats.shapes === 1 && r.stats.dropped.points === 1 && r.stats.dropped.lines === 1 && r.warnings.length >= 2, 'points and lines are counted, left out and said');

  // ---- bounds ----
  r = P(fc(feat('Fiji', [[[177, -17], [180, -17], [180, -19], [177, -19], [177, -17]]]), feat('East', [[[-180, -16], [-178, -16], [-178, -18], [-180, -18], [-180, -16]]])));
  // Separate parts on both sides of 180: the renderer shifts a ring only when it crosses 180, so a
  // part wholly at -180..-178 cannot be placed at 180..182. The honest calibration is the whole world.
  ok(r.ok && r.bounds.west === -180 && r.bounds.east === 180, 'separate parts on both sides of the antimeridian calibrate to the whole world ' + (r.ok && JSON.stringify(r.bounds)));
  r = P(fc(feat('Wrap', [[[179, 0], [-179, 0], [-179, 2], [179, 2], [179, 0]]])));
  ok(r.ok && r.bounds.east - r.bounds.west < 8, 'a ring that wraps the antimeridian is 2 degrees wide, not 358');
  r = P(fc(feat('Globe', [[[-180, -60], [-90, -60], [0, -60], [90, -60], [180, -60], [180, -90], [-180, -90], [-180, -60]]])));
  ok(r.ok && r.bounds.west === -180 && r.bounds.east === 180, 'data spanning 360 degrees calibrates to the whole world');
  r = P(fc(feat('Pole', [sq(0, 89)])));
  ok(r.ok && r.bounds.north <= 90 && r.bounds.south >= -90, 'bounds never pass the poles');
  r = P(fc(feat('Flat', [[[0, 0], [1, 0], [2, 0], [0, 0]]])));
  refused(r, /no width or height|no areas/, 'a degenerate sliver with no height');

  // ---- a bad file says ----
  refused(P('{ nope'), /isn't valid JSON/, 'not JSON');
  refused(P(''), /empty/, 'empty file');
  refused(P('[1,2,3]'), /not GeoJSON or TopoJSON/, 'JSON that is not GeoJSON');
  refused(P('{"type":"Banana"}'), /not one GeoJSON or TopoJSON uses/, 'an unknown type');
  refused(P(fc(feat('P', [sq(0, 0)])), 'districts.shp'), /\.shp/, 'a shapefile by extension');
  refused(P(fc(feat('P', [sq(0, 0)])), 'districts.kml'), /\.kml/, 'a KML by extension');
  refused(P(fc(feat('Utm', [[[500000, 4000000], [500100, 4000000], [500100, 4000100], [500000, 4000100], [500000, 4000000]]]))), /not longitude and latitude[^]*WGS 84/, 'projected coordinates name the fix');
  refused(P(fc(feat('Lat', [[[0, 95], [1, 95], [1, 96], [0, 96], [0, 95]]]))), /not longitude and latitude/, 'latitude past 90');
  refused(P(JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3857' } }, features: [feat('A', [sq(0, 0)])] })), /EPSG::3857[^]*WGS 84/, 'a crs that is not WGS 84');
  ok(P(JSON.stringify({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } }, features: [feat('A', [sq(0, 0)])] })).ok, 'CRS84 is accepted');
  refused(P(fc({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 1] } })), /no areas to draw/, 'only points');
  refused(P(fc({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } })), /no areas to draw/, 'only lines');
  refused(P(fc()), /no shapes/, 'an empty collection');
  refused(P(fc(feat('Bad', [[[0, 0], ['a', 1], [1, 1], [0, 0]]]))), /pair of numbers/, 'a coordinate that is not a number');
  refused(P('x'.repeat(8 * 1024 * 1024 + 1)), /MB[^]*limit/, 'over the size limit, with its size');
  const many = Array.from({ length: 5001 }, (_, i) => feat('S' + i, [sq((i % 70) * 2, Math.floor(i / 70) * 1, 0.5)]));
  refused(P(fc(...many)), /more than 5,000 shapes/, 'over the shape limit');
  const big = [];
  for (let i = 0; i < 400002; i++) big.push([(i * 7) % 170, (i * 3) % 80]);
  big.push(big[0]);
  refused(P(fc(feat('Huge', [big]))), /more than 400,000 points/, 'over the vertex limit');

  // ---- keys ----
  const a = P(fc(feat('Alpha', [sq(0, 0)]))), a2 = P(fc(feat('Alpha', [sq(0, 0)])).replace('FeatureCollection', 'FeatureCollection')), b = P(fc(feat('Alpha', [sq(0, 0.5)]))), c = P(fc(feat('Alphb', [sq(0, 0)])));
  ok(a.ok && a.key === a2.key, 'the same content has the same key');
  ok(a.ok && b.ok && a.key !== b.key && a.key !== c.key, 'a moved vertex or a renamed shape changes the key');
  ok(a.ok && P(JSON.stringify(JSON.parse(fc(feat('Alpha', [sq(0, 0)]))), null, 4)).key === a.key, 'whitespace in the file does not change the key');

  // ---- TopoJSON ----
  for (const transform of [true, false]) {
    r = P(topo({ transform }), 'tx.topojson');
    ok(r.ok && r.kind === 'topojson' && r.stats.shapes === 2, `TopoJSON (transform ${transform}) gives two shapes`);
    const A = r.ok && r.geojson.features[0].geometry.coordinates[0], B = r.ok && r.geojson.features[1].geometry.coordinates[0];
    ok(r.ok && JSON.stringify(A) === JSON.stringify([[1, 0], [1, 0.5], [1, 1], [0, 1], [0, 0], [1, 0]]), `TopoJSON (transform ${transform}): ring A decodes through the shared arc ` + JSON.stringify(A));
    ok(r.ok && JSON.stringify(B) === JSON.stringify([[1, 0], [2, 0], [2, 1], [1, 1], [1, 0.5], [1, 0]]), `TopoJSON (transform ${transform}): ring B walks the shared arc backwards ` + JSON.stringify(B));
    ok(r.ok && r.geojson.features[0].properties.name === 'Alpha', 'TopoJSON names come from properties');
  }
  r = P(topo({ extraObject: true }));
  ok(r.ok && r.stats.shapes === 2 && r.warnings.some(w => /2 layers[^]*states/.test(w)), 'with two objects the one with more shapes is used, and it says so');
  r = JSON.parse(topo()); r.objects.states.geometries[0].arcs = [[0, 9]];
  refused(P(JSON.stringify(r)), /arc that is not in the file/, 'an arc number outside the list');
  r = JSON.parse(topo()); delete r.arcs;
  refused(P(JSON.stringify(r)), /no arcs list/, 'a Topology with no arcs');
  r = JSON.parse(topo()); r.objects = {};
  refused(P(JSON.stringify(r)), /no objects/, 'a Topology with no objects');

  // ---- the module cannot reach the network ----
  ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|import\s*\(|https?:\/\//.test(SRC.replace(/\/\/.*$/gm, '')), 'bmg-dropped.js has no network call');
  const store = fs.readFileSync(path.join(here, '..', 'bmg-geo-store.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//.test(store), 'bmg-geo-store.js has no network call');
  return bad;
}

// ---- the mutants ----
const MUTANTS = [
  ['no padding on the bounds', 'const padX = Math.max((e - w) * 0.04, 0.002), padY = Math.max((n - s) * 0.04, 0.002);', 'const padX = 0, padY = 0;'],
  ['the lon/lat check is off', 'Math.abs(p[0]) > 180.000001 || Math.abs(p[1]) > 90.000001', 'false'],
  ['a reversed arc is read forwards', 'const pts = raw < 0 ? arcs[i].slice().reverse() : arcs[i];', 'const pts = arcs[i];'],
  ['TopoJSON deltas are read as absolute', 'x += p[0]; y += p[1]; return', 'x = p[0]; y = p[1]; return'],
  ['the vertex limit is off', 'if (stats.vertices > LIMITS.maxVertices) throw', 'if (false) throw'],
  ['the shape limit is off', 'if (features.length > LIMITS.maxFeatures) throw', 'if (false) throw'],
  ['an open ring is left open', 'pts.push([pts[0][0], pts[0][1]]);', ';'],
  ['bounds ignore the antimeridian', 'const un = unwrapRing(poly[0]);', 'const un = poly[0];'],
  ['the key ignores the content', 'const text = JSON.stringify(features);', 'const text = "x";'],
  ['the crs check is off', "if (crs && !/CRS84|EPSG::?4326/i.test(String(crs)))", 'if (false)'],
  ['the size limit is off', 'if (bytes > LIMITS.maxBytes)', 'if (false)'],
  ['coordinates are not rounded', 'const r4 = n => Math.round(n * 1e4) / 1e4;', 'const r4 = n => n;'],
  ['points are dropped without a word', "if (d.points) warnings.push(", 'if (false) warnings.push('],
  ['the shared object choice is first, not largest', 'if (p.shapes.length > best.shapes.length) best = p;', ';'],
];

let failed = 0;
const realBad = suite(Real);
failed += realBad.length;
realBad.forEach(m => console.error('FAIL  ' + m));

for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { failed++; console.error(`FAIL  mutant "${name}": the text it changes is not in bmg-dropped.js any more`); continue; }
  const src = SRC.replace("'../../_shared/geo-project.js'", JSON.stringify(SHARED_URL)).replace(from, to);
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const caught = suite(mod);
  if (!caught.length) { failed++; console.error(`FAIL  mutant "${name}" was NOT caught`); }
}

console.log(failed ? `dropped: ${failed} FAILED` : `dropped: OK — every case passes, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
