// bmg-dropped.js — a boundary file a teacher drops on 046 becomes a base map (Path 20 P2).
//
// Pure: text in, a plain answer out. No DOM, no fetch, no storage, so Node can run it and the
// page's only job is to read the file and hand the text here. Nothing in this file touches the
// network, and no library is needed: GeoJSON is JSON, and TopoJSON's arcs are decoded below
// in about forty lines (the transform, the delta coding, the reversed-arc sign).
//
// WHAT IS ACCEPTED
//   GeoJSON: a FeatureCollection, a Feature, a bare Polygon / MultiPolygon, or a
//     GeometryCollection of those. TopoJSON: a Topology (one object is used; with several,
//     the one with the most shapes). Only Polygon and MultiPolygon are drawn; points and
//     lines are counted and said so, never silently dropped.
//   Coordinates must already be longitude / latitude in degrees (WGS 84, what GeoJSON
//     requires). A file in a projected system (state plane, UTM, Web Mercator metres) has
//     numbers far outside +-180 / +-90 and is refused with the fix named: reprojecting would
//     need a library this site does not carry. A `crs` member naming anything but
//     CRS84 / EPSG:4326 is refused for the same reason.
//   Limits: 8 MB of text, 400,000 vertices, 5,000 shapes. 046's own largest layer is 14,446
//     vertices and draws in about 5 ms, so these are a safety margin, not a tight fit.
//
// WHAT COMES OUT: a clean FeatureCollection (each feature has only `properties.name` and a
// Polygon or MultiPolygon, coordinates rounded to 4 decimals, about 11 m), the calibration
// bounds (the data's box plus 4% each side), a key made from the content (`custom-<hex>`,
// no colon, so it sits inside the `vector:<key>:<bounds>:...` id), and counts for the page
// to report. The same file always gives the same key, so a project that used it finds it
// again when the file is dropped on another machine.

import { unwrapRing } from '../../_shared/geo-project.js';

export const LIMITS = Object.freeze({ maxBytes: 8 * 1024 * 1024, maxVertices: 400000, maxFeatures: 5000, maxName: 80 });

const NAME_KEYS = ['name', 'NAME', 'Name', 'name_en', 'NAME_EN', 'NAMELSAD', 'NAME_1', 'NAME_LONG', 'district', 'DISTRICT', 'label', 'LABEL', 'title', 'TITLE', 'id', 'ID'];

const fail = message => ({ ok: false, message });

function cleanText(v, max) {
  return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function nameOf(props, index) {
  if (props && typeof props === 'object') {
    for (const k of NAME_KEYS) {
      const v = props[k];
      if ((typeof v === 'string' && v.trim()) || (typeof v === 'number' && Number.isFinite(v))) return { name: cleanText(v, LIMITS.maxName), from: k };
    }
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (typeof v === 'string' && v.trim() && v.length <= 120) return { name: cleanText(v, LIMITS.maxName), from: k };
    }
  }
  return { name: 'Shape ' + (index + 1), from: null };
}

/* ── TopoJSON ────────────────────────────────────────────────────────── */

function decodeArcs(topo) {
  const t = topo.transform;
  if (!Array.isArray(topo.arcs)) throw new Error('the TopoJSON has no arcs list');
  const sx = t && t.scale ? t.scale[0] : 1, sy = t && t.scale ? t.scale[1] : 1;
  const tx = t && t.translate ? t.translate[0] : 0, ty = t && t.translate ? t.translate[1] : 0;
  return topo.arcs.map(arc => {
    if (!Array.isArray(arc)) throw new Error('a TopoJSON arc is not a list of points');
    let x = 0, y = 0;
    return arc.map(p => {
      if (!Array.isArray(p) || p.length < 2) throw new Error('a TopoJSON arc has a point with no coordinates');
      if (t) { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; }
      return [p[0], p[1]];
    });
  });
}

/** One ring from a list of arc indices: a negative index (~i) is arc i walked backwards, and each arc after the first drops its repeated start point. */
function ringFromArcs(indices, arcs, budget) {
  if (!Array.isArray(indices)) throw new Error('a TopoJSON ring is not a list of arc numbers');
  const out = [];
  for (const raw of indices) {
    if (!Number.isInteger(raw)) throw new Error('a TopoJSON arc number is not a whole number');
    const i = raw < 0 ? ~raw : raw;
    if (i >= arcs.length) throw new Error('a TopoJSON ring names an arc that is not in the file');
    const pts = raw < 0 ? arcs[i].slice().reverse() : arcs[i];
    for (let k = out.length ? 1 : 0; k < pts.length; k++) out.push(pts[k]);
    budget.n += pts.length;
    if (budget.n > LIMITS.maxVertices * 2) throw new Error('that file has more than ' + LIMITS.maxVertices.toLocaleString('en-US') + ' points');
  }
  return out;
}

function topologyShapes(topo) {
  const names = Object.keys(topo.objects || {});
  if (!names.length) throw new Error('the TopoJSON has no objects in it');
  const arcs = decodeArcs(topo);
  const budget = { n: 0 };
  const pieces = names.map(nm => {
    const shapes = [];
    const walk = (g, props) => {
      if (!g || typeof g !== 'object') return;
      if (g.type === 'GeometryCollection') { (g.geometries || []).forEach(x => walk(x, props)); return; }
      const p = g.properties || props;
      if (g.type === 'Polygon') shapes.push({ props: p, polys: [(g.arcs || []).map(r => ringFromArcs(r, arcs, budget))] });
      else if (g.type === 'MultiPolygon') shapes.push({ props: p, polys: (g.arcs || []).map(poly => poly.map(r => ringFromArcs(r, arcs, budget))) });
      else shapes.push({ props: p, polys: [], other: g.type });
    };
    walk(topo.objects[nm], null);
    return { object: nm, shapes };
  });
  let best = pieces[0];
  for (const p of pieces) if (p.shapes.length > best.shapes.length) best = p;
  return { shapes: best.shapes, usedObject: best.object, otherObjects: pieces.length - 1 };
}

/* ── GeoJSON ─────────────────────────────────────────────────────────── */

function geometryShapes(obj) {
  const shapes = [];
  const walk = (g, props) => {
    if (!g || typeof g !== 'object') return;
    switch (g.type) {
      case 'FeatureCollection': (g.features || []).forEach(f => walk(f, null)); break;
      case 'Feature': walk(g.geometry, g.properties); break;
      case 'GeometryCollection': (g.geometries || []).forEach(x => walk(x, props)); break;
      case 'Polygon': shapes.push({ props, polys: [g.coordinates] }); break;
      case 'MultiPolygon': shapes.push({ props, polys: g.coordinates }); break;
      case 'Point': case 'MultiPoint': case 'LineString': case 'MultiLineString': shapes.push({ props, polys: [], other: g.type }); break;
      default: break;
    }
  };
  walk(obj, null);
  return shapes;
}

const r4 = n => Math.round(n * 1e4) / 1e4;

/** Shapes → clean features, or a thrown Error with a sentence the page shows. */
function cleanShapes(shapes) {
  const features = [];
  const stats = { shapes: 0, rings: 0, vertices: 0, dropped: { points: 0, lines: 0, other: 0, emptyShapes: 0, shortRings: 0 }, namesFrom: {}, unnamed: 0 };
  shapes.forEach((s, idx) => {
    if (s.other) {
      if (/Point/.test(s.other)) stats.dropped.points++; else if (/LineString/.test(s.other)) stats.dropped.lines++; else stats.dropped.other++;
      return;
    }
    const polys = [];
    for (const poly of s.polys || []) {
      if (!Array.isArray(poly) || !poly.length) continue;
      const rings = [];
      for (let ri = 0; ri < poly.length; ri++) {
        const ring = poly[ri];
        if (!Array.isArray(ring)) throw new Error('a shape has a ring that is not a list of points');
        const pts = [];
        for (const p of ring) {
          if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
            throw new Error('a point is not a pair of numbers');
          }
          if (Math.abs(p[0]) > 180.000001 || Math.abs(p[1]) > 90.000001) {
            const e = new Error('NOT_LONLAT');
            e.sample = p;
            throw e;
          }
          const q = [r4(Math.max(-180, Math.min(180, p[0]))), r4(Math.max(-90, Math.min(90, p[1])))];
          const last = pts[pts.length - 1];
          if (!last || last[0] !== q[0] || last[1] !== q[1]) pts.push(q);
        }
        if (pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push([pts[0][0], pts[0][1]]);
        if (pts.length < 4) { stats.dropped.shortRings++; if (ri === 0) break; continue; }
        rings.push(pts);
        stats.vertices += pts.length;
        stats.rings++;
      }
      if (rings.length && rings[0]) polys.push(rings);
    }
    if (!polys.length) { stats.dropped.emptyShapes++; return; }
    const { name, from } = nameOf(s.props, idx);
    if (from) stats.namesFrom[from] = (stats.namesFrom[from] || 0) + 1; else stats.unnamed++;
    features.push({
      type: 'Feature',
      properties: { name },
      geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
    });
    stats.shapes++;
    if (features.length > LIMITS.maxFeatures) throw new Error('that file has more than ' + LIMITS.maxFeatures.toLocaleString('en-US') + ' shapes');
    if (stats.vertices > LIMITS.maxVertices) throw new Error('that file has more than ' + LIMITS.maxVertices.toLocaleString('en-US') + ' points');
  });
  return { features, stats };
}

/** The data's box, padded 4% a side, in the unwrapped longitudes the shared module draws with; the whole world when the data spans it. */
export function boundsFor(features) {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const f of features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const un = unwrapRing(poly[0]);
      for (const p of un) {
        if (p[0] < w) w = p[0];
        if (p[0] > e) e = p[0];
        if (p[1] < s) s = p[1];
        if (p[1] > n) n = p[1];
      }
    }
  }
  if (!(e - w > 1e-6) || !(n - s > 1e-6)) return null;
  if (e - w >= 360) return { north: 90, south: -90, west: -180, east: 180 };
  const padX = Math.max((e - w) * 0.04, 0.002), padY = Math.max((n - s) * 0.04, 0.002);
  const b = { north: Math.min(90, n + padY), south: Math.max(-90, s - padY), west: w - padX, east: e + padX };
  if (b.east - b.west > 360) { b.west = -180; b.east = 180; }
  return { north: r4(b.north), south: r4(b.south), west: r4(b.west), east: r4(b.east) };
}

/** A key from the content, stable across machines: two 32-bit hashes of the cleaned features, 16 hex digits. */
export function customKey(features) {
  const text = JSON.stringify(features);
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) ^ c) >>> 0;
  }
  return 'custom-' + a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

function titleFrom(fileName) {
  const base = String(fileName || '').replace(/^.*[\\/]/, '').replace(/\.(geo)?json$|\.topojson$/i, '');
  return cleanText(base, LIMITS.maxName) || 'Your boundary file';
}

const BAD_EXT = /\.(shp|dbf|shx|zip|kml|kmz|gpkg|gdb|csv|xlsx?|png|jpe?g|gif|pdf)$/i;

/**
 * The whole job: the file's text and name in, `{ ok: true, ... }` or `{ ok: false, message }` out.
 * The message is written to be shown to a teacher as it stands.
 */
export function parseBoundaryFile(text, fileName = '') {
  const ext = BAD_EXT.exec(String(fileName));
  if (ext) return fail('046 reads GeoJSON (.geojson or .json) and TopoJSON (.topojson or .json), not ' + ext[0].toLowerCase() + ' files. Most GIS programs, and the free mapshaper.org, can save a boundary file as GeoJSON.');
  const bytes = typeof text === 'string' ? text.length : 0;
  if (!bytes) return fail('That file is empty.');
  if (bytes > LIMITS.maxBytes) return fail('That file is ' + (bytes / 1048576).toFixed(1) + ' MB; the limit is ' + (LIMITS.maxBytes / 1048576) + ' MB. Simplify the boundaries first (mapshaper.org does it in a few clicks) and drop the smaller file.');
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return fail("That isn't a GeoJSON or TopoJSON file: it isn't valid JSON (" + String(e.message).slice(0, 80) + ').'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || typeof obj.type !== 'string') return fail("That is JSON, but not GeoJSON or TopoJSON: it has no \"type\" such as FeatureCollection or Topology.");
  const crs = obj.crs && obj.crs.properties && obj.crs.properties.name;
  if (crs && !/CRS84|EPSG::?4326/i.test(String(crs))) return fail('That file says its coordinates are in ' + cleanText(crs, 60) + ', not longitude and latitude (WGS 84). Re-save it as WGS 84 / EPSG:4326 and drop it again.');

  let kind, shapes, topoNote = '';
  try {
    if (obj.type === 'Topology') {
      kind = 'topojson';
      const t = topologyShapes(obj);
      shapes = t.shapes;
      if (t.otherObjects > 0) topoNote = 'This TopoJSON holds ' + (t.otherObjects + 1) + ' layers; “' + cleanText(t.usedObject, 40) + '” (the one with the most shapes) is the base map.';
    } else {
      kind = 'geojson';
      if (!['FeatureCollection', 'Feature', 'GeometryCollection', 'Polygon', 'MultiPolygon', 'Point', 'MultiPoint', 'LineString', 'MultiLineString'].includes(obj.type)) return fail('That is JSON, but its type “' + cleanText(obj.type, 30) + '” is not one GeoJSON or TopoJSON uses.');
      shapes = geometryShapes(obj);
    }
  } catch (e) {
    return fail("That file's shapes can't be read: " + e.message + '.');
  }
  if (!shapes.length) return fail('That file has no shapes in it.');

  let cleaned;
  try { cleaned = cleanShapes(shapes); } catch (e) {
    if (e.message === 'NOT_LONLAT') {
      const p = e.sample;
      return fail('Those coordinates are not longitude and latitude (' + (p ? 'one point is ' + r4(p[0]) + ', ' + r4(p[1]) : 'some numbers are far outside +-180 and +-90') + '). The file is probably in a projected system such as state plane or UTM. Re-save it as WGS 84 / EPSG:4326 (any GIS program, or mapshaper.org with -proj wgs84) and drop it again.');
    }
    return fail("That file's shapes can't be read: " + e.message + '.');
  }
  const { features, stats } = cleaned;
  if (!features.length) {
    const d = stats.dropped;
    return fail('That file has no areas to draw: it holds ' + [d.points && d.points + ' point(s)', d.lines && d.lines + ' line(s)', d.emptyShapes && d.emptyShapes + ' empty shape(s)'].filter(Boolean).join(', ') + '. A base map needs polygons (districts, watersheds, countries).');
  }
  const bounds = boundsFor(features);
  if (!bounds) return fail('Those shapes have no width or height to draw (every point is in one place).');

  const warnings = [];
  const d = stats.dropped;
  if (d.points) warnings.push(d.points + ' point(s) were left out (a base map draws areas).');
  if (d.lines) warnings.push(d.lines + ' line(s) were left out (a base map draws areas).');
  if (d.other) warnings.push(d.other + ' shape(s) of another kind were left out.');
  if (d.emptyShapes) warnings.push(d.emptyShapes + ' shape(s) had no usable outline and were left out.');
  if (d.shortRings) warnings.push(d.shortRings + ' ring(s) of fewer than 3 points were left out.');
  if (stats.unnamed) warnings.push(stats.unnamed + ' shape(s) had no name property and are called “Shape N”.');
  if (topoNote) warnings.unshift(topoNote);

  return {
    ok: true,
    kind,
    key: customKey(features),
    title: titleFrom(fileName),
    geojson: { type: 'FeatureCollection', features },
    bounds,
    stats: { shapes: stats.shapes, rings: stats.rings, vertices: stats.vertices, namesFrom: stats.namesFrom, unnamed: stats.unnamed, dropped: stats.dropped },
    warnings,
  };
}
