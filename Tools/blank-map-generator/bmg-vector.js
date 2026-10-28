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

import { DEFAULT_LONG_SIDE, pixelSizeFor, traceFeature, traceFeatures } from '../../_shared/geo-project.js';

const TARGET_LONG_SIDE = DEFAULT_LONG_SIDE;

const DATA_DIR = new URL('./data/', import.meta.url);
const ART_DIR = new URL('./art/', import.meta.url);

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
    relief: 'relief-world.webp',
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

/**
 * Which preset a cache/record id came from, or null if that id isn't a
 * built-in base map at all (a Commons file title, an uploaded image). The id
 * is the only thing a reloaded project keeps about *how* its map was made,
 * so this is how click-to-shade knows, after a refresh, that the picture on
 * screen has region shapes behind it — and which ones.
 */
export function presetFromBaseMapId(id) {
  const m = /^vector:([^:]+):/.exec(String(id || ""));
  return m ? findPreset(m[1]) : null;
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
export function baseMapId(preset, style, borders, choroKey, relief = false) {
  const b = preset.bounds;
  const bounds = [b.north, b.south, b.west, b.east].join(',');
  // `+relief` only where it can be drawn: never with data shading (see
  // renderBaseMapCanvas), and never on a preset with no relief render.
  const withRelief = relief && !choroKey && hasRelief(preset);
  const base = `vector:${preset.key}:${bounds}:${style}${borders ? '+borders' : ''}${withRelief ? '+relief' : ''}`;
  // Data shading is a suffix, not a new id scheme, for two reasons: the
  // plain base maps already in bmg-map-cache.js keep their exact keys and
  // stay reusable, and stripBaseMapId() below can recover the unshaded
  // identity — which is how the host page knows that re-shading a map it is
  // already showing is the same piece of paper, not a different one, and so
  // must not throw the teacher's labels away.
  return choroKey ? `${base}:choro:${choroKey}` : base;
}

/** The id with any `:choro:<hash>` suffix and any `+relief` removed — i.e. which base map this is, regardless of how it is shaded. Relief is the same paper with different ink, exactly like data shading, so switching it keeps the teacher's labels. */
export function stripBaseMapId(id) {
  return String(id || '').replace(/:choro:[^:]*$/, '').replace(/\+relief$/, '');
}

/** True when two ids are the same base map (same preset, crop, style, borders) differing at most in their data shading. */
export function sameBaseMap(a, b) {
  if (!a || !b) return false;
  return stripBaseMapId(a) === stripBaseMapId(b);
}

export function baseMapTitle(preset, style, borders, shaded, relief = false) {
  const parts = [preset.label];
  if (preset.dataset === 'us') parts.push(borders ? 'state outlines' : 'national outline');
  else parts.push(borders ? 'country outlines' : 'coastlines only');
  if (style === 'land') parts.push('land fill');
  if (relief && !shaded && hasRelief(preset)) parts.push('shaded relief');
  if (shaded) parts.push('shaded by data');
  return parts.join(' — ');
}

/** True when this preset has a shaded-relief render to draw under its land (today only the whole world: the render has to match the preset's exact extent). */
export function hasRelief(preset) {
  return !!(preset && preset.relief);
}

/**
 * The relief render for a preset, decoded. It is a Blender render of a
 * public-domain elevation model (Tools/blender-art/renders.json has its
 * source, and the luminance range that keeps label ink at 4.5:1 over it),
 * drawn to exactly the preset's bounds, so it is simply stretched to the
 * raster. Its zoom ceiling is its own 2048 px width; that is accepted, not
 * chased (BACKLOG.md, Path 21).
 */
function loadReliefImage(preset) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("couldn't read the built-in relief image"));
    img.src = new URL(preset.relief, ART_DIR).href;
  });
}

/**
 * Every region name this preset's data can draw, in file order. The
 * choropleth matcher needs it to tell "I don't recognise that name" from "I
 * recognise it but it isn't on this crop", and the picker uses it for the
 * paste box's placeholder. Always the *divided* file: the undivided landmass
 * has no per-region names in it.
 */
export async function listRegionNames(preset) {
  const geo = await loadDividedGeoJson(preset);
  return (geo.features || []).map(f => (f.properties && f.properties.name) || '').filter(Boolean);
}

/**
 * The named-region FeatureCollection behind a preset — the same file the
 * boundaries and the data shading are drawn from, handed out whole so
 * bmg-hittest.js can project it for picking. Shares the in-memory cache, so
 * entering shade mode on a map that is already drawn costs no second read.
 */
export async function loadDividedGeoJson(preset) {
  const files = DATASETS[preset && preset.dataset];
  if (!files) return { type: 'FeatureCollection', features: [] };
  return loadGeoJson(files.divided);
}

// The projection, antimeridian handling and path tracing live in
// _shared/geo-project.js (Path 20 P1); these names are re-exported so every
// importer of this file (015, the hit test, the tests) is unchanged.
export { pixelSizeFor, projectPoint, drawableRings } from '../../_shared/geo-project.js';

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
    traceFeature(ctx, feature, bounds, width, height, false);
    ctx.fillStyle = hex;
    ctx.fill('evenodd');
  }
}

/**
 * Renders a base map onto a canvas. Returns the canvas plus the calibration
 * that describes it — which is not derived or guessed, it *is* the bounds
 * the drawing used.
 */
export async function renderBaseMapCanvas(preset, { style = 'outline', borders = true, fills = null, relief = false, longSide = TARGET_LONG_SIDE } = {}) {
  const paint = STYLE_PAINT[style] || STYLE_PAINT.outline;
  const bounds = preset.bounds;
  // `longSide` exists for the time-slice series, which draws several maps as
  // small panels on one sheet: rendering each of those at the full 4000 px
  // and then throwing nine tenths of it away in the downscale is slow for no
  // gain. Everything else takes the default and is unaffected.
  const { width, height } = pixelSizeFor(bounds, longSide);
  const files = DATASETS[preset.dataset];
  if (!files) throw new Error(`unknown base map dataset "${preset.dataset}"`);
  const shading = fills && Object.keys(fills).length ? fills : null;
  // Relief is off under data shading: hill shading behind data colours
  // reads as data. The page disables the toggle too; this is the backstop.
  const reliefImg = relief && !shading && hasRelief(preset) ? await loadReliefImage(preset) : null;

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

  // The relief multiplies over the land fill only (the path above is still
  // current, so it is the clip). Multiply keeps either style's land colour
  // and only darkens it, by at most what the render's luminance floor allows.
  if (reliefImg) {
    ctx.save();
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(reliefImg, 0, 0, width, height);
    ctx.restore();
  }

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
export async function buildBaseMapRecord(preset, { style = 'outline', borders = true, fills = null, choroKey = '', relief = false } = {}) {
  const { canvas, width, height, calibration } = await renderBaseMapCanvas(preset, { style, borders, fills, relief });
  const blob = await canvasToBlob(canvas);
  return {
    id: baseMapId(preset, style, borders, choroKey, relief),
    title: baseMapTitle(preset, style, borders, !!choroKey, relief),
    blob,
    mime: 'image/png',
    width,
    height,
    attribution: { ...NATURAL_EARTH_ATTRIBUTION },
    calibration,
    cachedAt: Date.now(),
  };
}
