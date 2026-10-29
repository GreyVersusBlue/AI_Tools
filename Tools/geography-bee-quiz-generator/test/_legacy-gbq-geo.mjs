// _legacy-gbq-geo.mjs — gbq-map.js's own adapted antimeridian handling, projection and
// path tracing exactly as they were before 062 switched to _shared/geo-project.js
// (copied at v423, 2026-10-28, comments trimmed, no line of logic changed). The parity
// suite feeds this and the shared module the same data and requires the same answers.
// Frozen: do not edit it to follow the module.

export function polygonsOf(feature) {
  const g = feature && feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
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

/** Plate carrée, the same projection 046 renders in, so a snippet and a printed blank map agree about where a place is. */
export function project(bounds, w, h, lon, lat) {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * w,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * h,
  };
}

export function traceFeature(ctx, feature, bounds, w, h, forStroke) {
  for (const poly of polygonsOf(feature)) {
    for (const ring of poly) {
      for (const { points, closed } of drawableRings(ring, forStroke)) {
        for (let i = 0; i < points.length; i++) {
          const p = project(bounds, w, h, points[i][0], points[i][1]);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        if (closed) ctx.closePath();
      }
    }
  }
}

