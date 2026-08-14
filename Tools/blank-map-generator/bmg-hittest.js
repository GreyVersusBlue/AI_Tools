// bmg-hittest.js — turn a point on a built-in vector base map into the
// country or state underneath it, and hand back that region's outline in the
// map's own pixel space so it can be shaded.
//
// This module is pure geometry: no DOM, no fetch, no viewer. The host page
// converts a click to stage (map-pixel) coordinates with the viewer it
// already has, calls hitTestRegion(), and gets back a name plus rings. That
// is the entire mechanism behind click-to-shade.
//
// **The projection is not reimplemented here, and that is the point.** The
// base map is a raster that bmg-vector.js drew, so a hit test that computed
// its own longitude/latitude mapping would be a second copy of the same math
// waiting to drift out of step with the picture on screen — and a hit test
// that disagrees with the drawing is worse than no hit test, because it is
// wrong quietly. So `projectPoint` and `drawableRings` are imported from
// bmg-vector.js and used exactly as the renderer uses them, including:
//
//   - the antimeridian unwrapping (Fiji and Chukotka are emitted a second
//     time shifted 360°, so the half that belongs at the far edge of the map
//     is testable there too, exactly where it is drawn);
//   - the polar closure that makes Antarctica a filled cap rather than a
//     sliver (`forStroke = false`, the fill form — a hit test is about what
//     was filled, not what was outlined).
//
// Holes and multi-polygons both fall out of one rule: **even-odd crossing
// counting across every ring of a feature at once.** A point inside South
// Africa's outer ring and also inside its Lesotho-shaped hole crosses two
// boundaries, so it counts as outside South Africa — and Lesotho, a separate
// feature, then claims it. A point on one island of Alaska's hundred-odd
// rings crosses one boundary, so it counts as inside Alaska. Neither case
// needs code of its own.

import { projectPoint, drawableRings } from "./bmg-vector.js";

/** Every ring of a feature's geometry, flattened across a MultiPolygon's separate polygons — even-odd counting below wants them all in one bag. */
function featureRings(feature) {
  const g = feature && feature.geometry;
  if (!g) return [];
  if (g.type === "Polygon") return g.coordinates || [];
  if (g.type === "MultiPolygon") return (g.coordinates || []).flat();
  return [];
}

/**
 * One GeoJSON feature's rings, projected into the raster's pixel space by
 * the same route the renderer took: unwrap/shift/close first, then project.
 */
export function projectFeatureRings(feature, bounds, width, height) {
  const out = [];
  for (const ring of featureRings(feature)) {
    if (!ring || ring.length < 3) continue;
    for (const { points } of drawableRings(ring, false)) {
      const projected = points.map(p => projectPoint(bounds, width, height, p[0], p[1]));
      if (projected.length >= 3) out.push(projected);
    }
  }
  return out;
}

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Projects a whole FeatureCollection once, ready to be tested against many
 * clicks. Building this costs one pass over the vector data (a few tens of
 * thousands of points), so the host page does it when shade mode is entered
 * and keeps it for as long as the same map is on screen.
 *
 * `bounds` is the preset's plate carrée extent and `width`/`height` the
 * raster's pixel size — i.e. exactly what bmg-vector.js drew to, which is
 * also the stage coordinate space the viewer reports clicks in.
 */
export function buildRegionIndex(geojson, bounds, width, height) {
  const entries = [];
  for (const feature of (geojson && geojson.features) || []) {
    const name = (feature.properties && feature.properties.name) || "";
    if (!name) continue;
    const rings = projectFeatureRings(feature, bounds, width, height);
    if (!rings.length) continue;
    entries.push({ name, rings, bbox: bboxOf(rings) });
  }
  return entries;
}

/**
 * Even-odd crossing count over every ring at once — the whole hole and
 * multi-polygon story, in eight lines. A ray is cast in +x from (x, y) and
 * each edge it crosses flips the answer.
 */
export function pointInRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.y > y) !== (b.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        if (x < a.x + t * (b.x - a.x)) inside = !inside;
      }
    }
  }
  return inside;
}

function inBbox(bbox, x, y) {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/**
 * The region under a point, or null for ocean (or a gap in the data). The
 * bounding-box check first is what keeps a click on a 200-feature world map
 * cheap: almost every country is rejected on four comparisons.
 */
export function hitTestRegion(index, x, y) {
  for (const entry of index || []) {
    if (!inBbox(entry.bbox, x, y)) continue;
    if (pointInRings(entry.rings, x, y)) return entry;
  }
  return null;
}

/** The ring with the most points — a decent stand-in for "the main body of this region" when one outline has to represent the whole of it. */
export function largestRing(rings) {
  let best = null;
  for (const ring of rings || []) if (!best || ring.length > best.length) best = ring;
  return best || [];
}

/**
 * Rings trimmed down to what is worth keeping in a saved project.
 *
 * A shaded region's outline is stored with the project, in localStorage, and
 * the raw data is far finer than a fill needs: at a 4000 px raster, sub-pixel
 * coordinates are decoration. Rounding to whole pixels and dropping the
 * points that then repeat cuts the stored size roughly in half with nothing
 * visible lost, and a ring that collapses below a triangle is dropped
 * outright (a two-pixel island cannot be filled anyway).
 */
export function compactRings(rings, decimals = 0) {
  const factor = Math.pow(10, decimals);
  const round = n => Math.round(n * factor) / factor;
  const out = [];
  for (const ring of rings || []) {
    const simplified = [];
    for (const p of ring) {
      const q = { x: round(p.x), y: round(p.y) };
      const prev = simplified[simplified.length - 1];
      if (prev && prev.x === q.x && prev.y === q.y) continue;
      simplified.push(q);
    }
    // A closing point identical to the first is redundant: every consumer
    // closes the path itself.
    const first = simplified[0], last = simplified[simplified.length - 1];
    if (simplified.length > 1 && first.x === last.x && first.y === last.y) simplified.pop();
    if (simplified.length >= 3) out.push(simplified);
  }
  return out;
}
