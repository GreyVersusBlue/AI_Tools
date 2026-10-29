// bmg-geo-store.js — where a dropped boundary file lives (Path 20 P2).
//
// The cleaned GeoJSON is kept as a Blob in the shared `gvb-media` database under the
// `bmg-geo` namespace, not in `bmg-maps`: that database is 046's *cache* (the registry marks
// it safe to leave out of a backup, and "Clear cached maps" empties it), and a file a teacher
// dropped does not come back by itself. In `gvb-media` it is backed up by default and is not
// touched by "Clear cached maps". The rendered PNG of the map is derived, so it stays in the
// cache like every other base map.
//
// window.MediaDB rather than an import, as bmg-map-cache.js does: it is a classic script.

import { registerCustomPreset } from './bmg-vector.js';
import { LIMITS } from './bmg-dropped.js';

export const GEO_NS = 'bmg-geo';
const store = () => MediaDB.store({ ns: GEO_NS });

/** Keeps a parsed file (parseBoundaryFile's success) and makes its preset known. Rejects with a sentence if the browser will not store it; the preset is registered either way, so the map can still be drawn this session. */
export async function saveDropped(parsed) {
  const preset = registerCustomPreset(parsed);
  const blob = new Blob([JSON.stringify(parsed.geojson)], { type: 'application/geo+json' });
  await store().put(parsed.key, blob, {
    title: parsed.title, kind: parsed.kind, shapes: parsed.stats.shapes, vertices: parsed.stats.vertices,
    bounds: parsed.bounds, droppedAt: Date.now(),
  });
  return preset;
}

/** Reads one stored file back and registers it. Resolves to the preset, or null when it is not stored (another device, a cleared browser) or no longer reads as a boundary file. */
export async function restoreDropped(key) {
  if (!/^custom-[0-9a-f]{16}$/.test(String(key))) return null;
  let rec = null;
  try { rec = await store().get(key); } catch (e) { rec = null; }
  if (!rec || !rec.blob || !rec.bounds || rec.size > LIMITS.maxBytes) return null;
  let geojson;
  try { geojson = JSON.parse(await rec.blob.text()); } catch (e) { return null; }
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return null;
  const b = rec.bounds;
  if (![b.north, b.south, b.west, b.east].every(Number.isFinite)) return null;
  return registerCustomPreset({
    key, title: String(rec.title || 'Your boundary file').slice(0, LIMITS.maxName), geojson, bounds: b,
    stats: { shapes: geojson.features.length },
  });
}

/** Every stored file's key and title, newest first, without reading the geometry. */
export async function listDropped() {
  let recs = [];
  try { recs = await store().list(); } catch (e) { recs = []; }
  return recs.filter(r => /^custom-[0-9a-f]{16}$/.test(String(r.id)))
    .sort((a, b) => (b.droppedAt || 0) - (a.droppedAt || 0))
    .map(r => ({ key: r.id, title: String(r.title || 'Your boundary file'), shapes: r.shapes || 0 }));
}
