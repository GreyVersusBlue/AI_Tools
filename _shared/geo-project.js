// geo-project.js — the geometry every Blank Map-family tool shares (Path 20 P1).
//
// One projection, the antimeridian handling that stops stray lines across the
// Pacific, per-feature path tracing, and the hit test over projected rings. It
// was bmg-vector.js's and bmg-hittest.js's own code and moved here unchanged,
// so a second tool reads one copy instead of adapting another (gbq-map.js still
// carries its own adapted unwrapRing/drawableRings; moving it is a later step).
// bmg-vector.js and bmg-hittest.js re-export these names, so 046, 015 and the
// other importers are untouched. Behaviour is held to a frozen copy of the old
// code, Tools/blank-map-generator/test/_legacy-geo.mjs (`npm run
// test:geo-project-parity`), and the pure pieces by `npm run test:geo-project`.
//
// Pure: no DOM, no fetch, no storage; a canvas context is only ever an
// argument. The data files stay in Tools/blank-map-generator/data/.
//
// "bounds" is { north, south, west, east } in degrees. The map is plate
// carrée: x is linear in longitude and y linear in latitude.

/** Target size of the raster's longer side: big enough that a full-page or poster-tile print stays crisp, small enough that the render and the PNG encode stay quick. */
export const DEFAULT_LONG_SIDE = 4000;

/** Pixel dimensions for a bounds rectangle: plate carrée means one degree of latitude and one of longitude occupy the same number of pixels, so the raster is simply the degree-extent scaled up. */
export function pixelSizeFor(bounds, longSide = DEFAULT_LONG_SIDE) {
  const lonSpan = Math.abs(bounds.east - bounds.west);
  const latSpan = Math.abs(bounds.north - bounds.south);
  const scale = longSide / Math.max(lonSpan, latSpan);
  return {
    width: Math.max(2, Math.round(lonSpan * scale)),
    height: Math.max(2, Math.round(latSpan * scale)),
  };
}

/**
 * The projection, in one place. Everything else here — and the calibration
 * the record carries — is this function and its inverse.
 *
 * Shared so the hit test below can turn a click into a
 * region using the identical arithmetic rather than a second copy of it: a
 * hit test that disagrees with what was drawn is wrong silently, which is
 * the worst way for it to be wrong.
 */
export function projectPoint(bounds, width, height, lon, lat) {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
  };
}

/** Inverse of projectPoint(): a pixel of the raster back to longitude and latitude. */
export function unprojectPoint(bounds, width, height, x, y) {
  return {
    lon: bounds.west + (x / width) * (bounds.east - bounds.west),
    lat: bounds.north - (y / height) * (bounds.north - bounds.south),
  };
}

/**
 * Rewrites a ring's longitudes so consecutive points never jump more than
 * 180°, letting values run past ±180 instead.
 *
 * This matters because Natural Earth stores a ring that straddles the
 * antimeridian with its vertices clamped to ±180 — so the ring contains a
 * step from, say, -180 straight to +179.4 (Fiji), or +180 to -180
 * (Antarctica's closing edge). Drawn naively, each of those steps is a
 * `lineTo` clean across the entire map: the stray full-width horizontal
 * lines through the South Pacific and across northern Siberia that a plate
 * carrée render of this data otherwise picks up.
 */
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

/**
 * One ring in, one or more drawable subpaths out — in continuous longitude
 * space, with the antimeridian handled.
 *
 * A ring that goes all the way around the globe (Antarctica) comes out of
 * unwrapRing() with its ends 360° apart, so it can't simply be closed. For
 * *filling* it is closed through the pole, which is what makes Antarctica
 * fill as a polar cap down to the bottom of the map rather than as a sliver
 * cut off at the data's own clip latitude. For *stroking* that closure is
 * left off entirely: it is a construction, not a coastline, and drawing it
 * would put a hard line along the bottom edge of every world map. A ring
 * that merely pokes past ±180 (Fiji, the tip of Chukotka) is additionally
 * emitted shifted a full 360°, so the part belonging at the opposite edge of
 * the map is drawn there.
 */
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

export function traceFeature(ctx, feature, bounds, width, height, forStroke) {
  const g = feature.geometry;
  if (!g) return;
  if (g.type === 'Polygon') tracePolygon(ctx, g.coordinates, bounds, width, height, forStroke);
  else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) tracePolygon(ctx, poly, bounds, width, height, forStroke);
}

/** Adds every polygon of a FeatureCollection to the current path. `evenodd` filling then handles holes (lakes, enclaves) correctly. `forStroke` drops the synthetic polar closure described in drawableRings(). */
export function traceFeatures(ctx, geojson, bounds, width, height, forStroke = false) {
  ctx.beginPath();
  for (const feature of geojson.features || []) traceFeature(ctx, feature, bounds, width, height, forStroke);
}

// ---- hit test: which feature is under a point (ex bmg-hittest.js) ----

/** Every ring of a feature's geometry, flattened across a MultiPolygon's separate polygons — even-odd counting below wants them all in one bag. */
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
