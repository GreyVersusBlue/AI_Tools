// bmg-vector.js — built-in, offline base maps rendered from the vendored
// Natural Earth GeoJSON in ./data/.
//
// The point of this module is NOT to make the viewer a vector renderer. The
// tool's whole annotation stack (labels, markers, regions, lines, legend,
// worksheets, all four export paths) is built on "a raster map image of a
// known pixel size, cached in IndexedDB". So this module renders the vector
// data ONCE, at high resolution, into exactly that shape — a cache record
// identical to the one the upload path builds — and hands it back. Every
// existing feature then works on a built-in base map without knowing one
// exists.
//
// The projection is plate carrée (equirectangular with the equator as the
// standard parallel): x is linear in longitude, y is linear in latitude.
// That is deliberate, and it is the whole payoff of generating the map
// ourselves rather than downloading someone else's: because we choose the
// projection and the bounds, we know the map's calibration exactly, so
// `calibration` ships *with* the record and the tool can set it
// automatically. Grid, scale bar, distance measuring, batch coordinate
// placement and the built-in label sets all work the moment the map loads,
// with no eyeballing of the map's edges by the teacher — and the label sets
// land on their real coordinates rather than approximately, because this
// map's projection is the one those anchors were written for.
//
// Keep this file free of DOM/UI concerns beyond the canvas it draws on: the
// host page owns the picker, the cache write, and displayMap().

const DATA_DIR = new URL('./data/', import.meta.url);

/** Natural Earth is public domain (see data/README.md); this is the attribution the record carries into every export. */
export const NATURAL_EARTH_ATTRIBUTION = Object.freeze({
  artist: 'Natural Earth',
  license: 'Public domain — no permission needed',
  licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  descriptionUrl: null,
});

// Which vendored file supplies which layer, per dataset family. `whole` is
// the undivided landmass (a seamless fill, and the coastline when internal
// borders are switched off); `divided` carries the internal boundaries.
const DATASETS = {
  world: { whole: 'world-land-110m.json', divided: 'world-countries-110m.json' },
  us: { whole: 'us-nation-10m.json', divided: 'us-states-10m.json' },
};

/**
 * The presets offered in the picker. Bounds are the exact plate carrée
 * extent the raster is rendered to, so they are also, verbatim, the
 * calibration the project gets. They are chosen a little generously around
 * each region so nothing important sits on the very edge of the paper.
 */
export const BASE_MAP_PRESETS = Object.freeze([
  { key: 'world', label: 'World', dataset: 'world', bounds: { north: 84, south: -90, west: -180, east: 180 },
    note: 'Whole-world plate carrée — the projection the built-in label sets are written for.' },
  { key: 'africa', label: 'Africa', dataset: 'world', bounds: { north: 38, south: -36, west: -20, east: 53 } },
  { key: 'europe', label: 'Europe', dataset: 'world', bounds: { north: 72, south: 34, west: -25, east: 45 } },
  { key: 'asia', label: 'Asia', dataset: 'world', bounds: { north: 78, south: -12, west: 25, east: 180 } },
  { key: 'north-america', label: 'North America', dataset: 'world', bounds: { north: 72, south: 5, west: -170, east: -50 } },
  { key: 'south-america', label: 'South America', dataset: 'world', bounds: { north: 14, south: -56, west: -82, east: -33 } },
  { key: 'oceania', label: 'Australia & Oceania', dataset: 'world', bounds: { north: 0, south: -48, west: 110, east: 180 } },
  { key: 'usa-48', label: 'United States (lower 48)', dataset: 'us', bounds: { north: 50, south: 24, west: -125, east: -66.5 },
    note: 'State outlines. Alaska and Hawaii are outside this crop — use the 50-state map for those.' },
  { key: 'usa-50', label: 'United States (all 50 states)', dataset: 'us', bounds: { north: 72, south: 18, west: -170, east: -66 },
    note: 'Alaska and Hawaii at their true coordinates rather than in inset boxes, so coordinate placement stays honest.' },
]);

export const BASE_MAP_STYLES = Object.freeze([
  { key: 'outline', label: 'Outline only (blank)' },
  { key: 'land', label: 'Light land fill' },
]);

const STYLE_PAINT = {
  outline: { ocean: '#ffffff', land: '#ffffff', stroke: '#2f2e2b' },
  land: { ocean: '#e4eef5', land: '#f6f1e4', stroke: '#5c5a52' },
};

export function findPreset(key) {
  return BASE_MAP_PRESETS.find(p => p.key === key) || null;
}

// Fetched GeoJSON is kept in memory for the life of the page: switching
// styles or re-cropping a continent shouldn't re-read a 200 KB file.
const geoCache = new Map();

async function loadGeoJson(file) {
  if (geoCache.has(file)) return geoCache.get(file);
  const promise = fetch(new URL(file, DATA_DIR)).then(res => {
    if (!res.ok) throw new Error(`couldn't read the built-in map data (${res.status})`);
    return res.json();
  }).catch(err => {
    geoCache.delete(file); // a failed load must not poison the cache forever
    throw err;
  });
  geoCache.set(file, promise);
  return promise;
}

/**
 * The record id doubles as the cache key, so it has to capture everything
 * that changes a pixel: which data, which crop, which style. Regenerating
 * the same choice therefore hits the IndexedDB cache instead of re-rendering
 * — and, more importantly, re-opening a saved project finds its map already
 * there without the vector data being fetched again.
 */
export function baseMapId(preset, style, borders, choroKey) {
  const b = preset.bounds;
  const bounds = [b.north, b.south, b.west, b.east].join(',');
  const base = `vector:${preset.key}:${bounds}:${style}${borders ? '+borders' : ''}`;
  // Data shading is a suffix, not a new id scheme, for two reasons: the
  // plain base maps already in bmg-map-cache.js keep their exact keys and
  // stay reusable, and stripBaseMapId() below can recover the unshaded
  // identity — which is how the host page knows that re-shading a map it is
  // already showing is the same piece of paper, not a different one, and so
  // must not throw the teacher's labels away.
  return choroKey ? `${base}:choro:${choroKey}` : base;
}

/** The id with any `:choro:<hash>` suffix removed — i.e. which base map this is, regardless of how it is shaded. */
export function stripBaseMapId(id) {
  return String(id || '').replace(/:choro:[^:]*$/, '');
}

/** True when two ids are the same base map (same preset, crop, style, borders) differing at most in their data shading. */
export function sameBaseMap(a, b) {
  if (!a || !b) return false;
  return stripBaseMapId(a) === stripBaseMapId(b);
}

export function baseMapTitle(preset, style, borders, shaded) {
  const parts = [preset.label];
  if (preset.dataset === 'us') parts.push(borders ? 'state outlines' : 'national outline');
  else parts.push(borders ? 'country outlines' : 'coastlines only');
  if (style === 'land') parts.push('land fill');
  if (shaded) parts.push('shaded by data');
  return parts.join(' — ');
}

/**
 * Every region name this preset's data can draw, in file order. The
 * choropleth matcher needs it to tell "I don't recognise that name" from "I
 * recognise it but it isn't on this crop", and the picker uses it for the
 * paste box's placeholder. Always the *divided* file: the undivided landmass
 * has no per-region names in it.
 */
export async function listRegionNames(preset) {
  const files = DATASETS[preset.dataset];
  if (!files) return [];
  const geo = await loadGeoJson(files.divided);
  return (geo.features || []).map(f => (f.properties && f.properties.name) || '').filter(Boolean);
}

// Target size of the raster's longer side. Big enough that a full-page or
// poster-tile print stays crisp (a US Letter page at 300 dpi is 3300 px on
// its long edge), small enough that the render and the PNG encode stay
// quick and the blob stays a sensible thing to keep in IndexedDB.
const TARGET_LONG_SIDE = 4000;

/** Pixel dimensions for a bounds rectangle: plate carrée means one degree of latitude and one of longitude occupy the same number of pixels, so the raster is simply the degree-extent scaled up. */
export function pixelSizeFor(bounds) {
  const lonSpan = Math.abs(bounds.east - bounds.west);
  const latSpan = Math.abs(bounds.north - bounds.south);
  const scale = TARGET_LONG_SIDE / Math.max(lonSpan, latSpan);
  return {
    width: Math.max(2, Math.round(lonSpan * scale)),
    height: Math.max(2, Math.round(latSpan * scale)),
  };
}

/** The projection, in one place. Everything else here — and the calibration the record carries — is this function and its inverse. */
function project(bounds, width, height, lon, lat) {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * width,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * height,
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
function unwrapRing(ring) {
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
function drawableRings(ring, forStroke) {
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

function tracePolygon(ctx, rings, bounds, width, height, forStroke) {
  for (const ring of rings) {
    for (const { points, closed } of drawableRings(ring, forStroke)) {
      for (let i = 0; i < points.length; i++) {
        const { x, y } = project(bounds, width, height, points[i][0], points[i][1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (closed) ctx.closePath();
    }
  }
}

function traceOneFeature(ctx, feature, bounds, width, height, forStroke) {
  const g = feature.geometry;
  if (!g) return;
  if (g.type === 'Polygon') tracePolygon(ctx, g.coordinates, bounds, width, height, forStroke);
  else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) tracePolygon(ctx, poly, bounds, width, height, forStroke);
}

/** Adds every polygon of a FeatureCollection to the current path. `evenodd` filling then handles holes (lakes, enclaves) correctly. `forStroke` drops the synthetic polar closure described in drawableRings(). */
function traceFeatures(ctx, geojson, bounds, width, height, forStroke = false) {
  ctx.beginPath();
  for (const feature of geojson.features || []) traceOneFeature(ctx, feature, bounds, width, height, forStroke);
}

/**
 * Paints each named region that has a colour in `fills` (see
 * bmg-choropleth.js) on top of the land fill and underneath the boundary
 * strokes, so a shaded map still shows its borders.
 *
 * One feature at a time with its own `evenodd` fill, rather than one path
 * per colour class: a country's holes (Lesotho inside South Africa, an
 * enclave) only cancel correctly against that country's own rings, and
 * batching two neighbours into one path would make their shared edge
 * disappear into the interior.
 */
function paintChoropleth(ctx, geojson, bounds, width, height, fills) {
  for (const feature of geojson.features || []) {
    const name = feature.properties && feature.properties.name;
    const hex = name && fills[name];
    if (!hex) continue;
    ctx.beginPath();
    traceOneFeature(ctx, feature, bounds, width, height, false);
    ctx.fillStyle = hex;
    ctx.fill('evenodd');
  }
}

/**
 * Renders a base map onto a canvas. Returns the canvas plus the calibration
 * that describes it — which is not derived or guessed, it *is* the bounds
 * the drawing used.
 */
export async function renderBaseMapCanvas(preset, { style = 'outline', borders = true, fills = null } = {}) {
  const paint = STYLE_PAINT[style] || STYLE_PAINT.outline;
  const bounds = preset.bounds;
  const { width, height } = pixelSizeFor(bounds);
  const files = DATASETS[preset.dataset];
  if (!files) throw new Error(`unknown base map dataset "${preset.dataset}"`);
  const shading = fills && Object.keys(fills).length ? fills : null;

  const whole = await loadGeoJson(files.whole);
  // Data shading is per-region, so it needs the divided file even when the
  // teacher has boundaries switched off — you can still shade Maryland on a
  // borderless map, the shapes just aren't outlined.
  const divided = (borders || shading) ? await loadGeoJson(files.divided) : null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = paint.ocean;
  ctx.fillRect(0, 0, width, height);

  // Land fill comes from the undivided landmass so no seams show between
  // neighbours; the boundaries are stroked on top of it afterwards.
  traceFeatures(ctx, whole, bounds, width, height);
  ctx.fillStyle = paint.land;
  ctx.fill('evenodd');

  if (shading) paintChoropleth(ctx, divided, bounds, width, height, shading);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint.stroke;
  ctx.lineWidth = Math.max(1, Math.round(Math.max(width, height) / 1600));
  traceFeatures(ctx, borders ? divided : whole, bounds, width, height, true);
  ctx.stroke();

  return {
    canvas,
    width,
    height,
    calibration: { north: bounds.north, south: bounds.south, west: bounds.west, east: bounds.east, projection: 'equirectangular' },
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('the browser could not encode the rendered map')), 'image/png');
  });
}

/**
 * Builds the full cache record for a base map — deliberately the same shape
 * `useUploadedFile()` builds, plus a `calibration` field, so displayMap()
 * and the IndexedDB cache need to know nothing new about vectors.
 */
export async function buildBaseMapRecord(preset, { style = 'outline', borders = true, fills = null, choroKey = '' } = {}) {
  const { canvas, width, height, calibration } = await renderBaseMapCanvas(preset, { style, borders, fills });
  const blob = await canvasToBlob(canvas);
  return {
    id: baseMapId(preset, style, borders, choroKey),
    title: baseMapTitle(preset, style, borders, !!choroKey),
    blob,
    mime: 'image/png',
    width,
    height,
    attribution: { ...NATURAL_EARTH_ATTRIBUTION },
    calibration,
    cachedAt: Date.now(),
  };
}
