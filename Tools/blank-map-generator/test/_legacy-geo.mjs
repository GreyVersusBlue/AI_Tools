// _legacy-geo.mjs — 046's projection, antimeridian handling, path tracing and
// hit test exactly as they were in bmg-vector.js and bmg-hittest.js before
// Path 20 P1 moved them to _shared/geo-project.js (copied at v400, 2026-10-28,
// whitespace and comments trimmed, no line of logic changed). The parity suite
// feeds this and the shared module the same data and requires the same answers.
// Frozen: do not edit it to follow the module. If the module must change
// behaviour on purpose, say so in the suite and in HISTORY.md.

const TARGET_LONG_SIDE = 4000;

export function pixelSizeFor(bounds, longSide = TARGET_LONG_SIDE) {
  const lonSpan = Math.abs(bounds.east - bounds.west);
  const latSpan = Math.abs(bounds.north - bounds.south);
  const scale = longSide / Math.max(lonSpan, latSpan);
  return {
    width: Math.max(2, Math.round(lonSpan * scale)),
    height: Math.max(2, Math.round(latSpan * scale)),
  };
}
export function projectPoint(bounds, width, height, lon, lat) {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
  };
}
export function unwrapRing(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (prev - lon > 180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}
export function drawableRings(ring, forStroke) {
  const un = unwrapRing(ring);
  const first = un[0][0], last = un[un.length - 1][0];
  const encircles = Math.abs(last - first) > 180;
  if (encircles && !forStroke) {
    const meanLat = un.reduce((sum, p) => sum + p[1], 0) / un.length;
    const pole = meanLat < 0 ? -90 : 90;
    un.push([last, pole], [first, pole]);
  }
  let min = Infinity, max = -Infinity;
  for (const p of un) { if (p[0] < min) min = p[0]; if (p[0] > max) max = p[0]; }
  const shifts = [0];
  if (max > 180) shifts.push(-360);
  if (min < -180) shifts.push(360);
  return shifts.map(shift => ({
    points: shift ? un.map(p => [p[0] + shift, p[1]]) : un,
    closed: !(encircles && forStroke),
  }));
}
export function tracePolygon(ctx, rings, bounds, width, height, forStroke) {
  for (const ring of rings) {
    for (const { points, closed } of drawableRings(ring, forStroke)) {
      for (let i = 0; i < points.length; i++) {
        const { x, y } = projectPoint(bounds, width, height, points[i][0], points[i][1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (closed) ctx.closePath();
    }
  }
}
export function traceOneFeature(ctx, feature, bounds, width, height, forStroke) {
  const g = feature.geometry;
  if (!g) return;
  if (g.type === 'Polygon') tracePolygon(ctx, g.coordinates, bounds, width, height, forStroke);
  else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) tracePolygon(ctx, poly, bounds, width, height, forStroke);
}
export function traceFeatures(ctx, geojson, bounds, width, height, forStroke = false) {
  ctx.beginPath();
  for (const feature of geojson.features || []) traceOneFeature(ctx, feature, bounds, width, height, forStroke);
}
export function featureRings(feature) {
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
