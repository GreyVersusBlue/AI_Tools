// gbq-map.js — outline-map snippets for the Geography Bee Quiz Generator's
// map questions ("Which country/state is highlighted?").
//
// This is the module that finally makes the tool's own meta description true:
// it has claimed to be "the quiz-format companion to the Blank Map Generator"
// since it was built, while sharing nothing with it but a colour scheme.
//
// WHAT IS SHARED, AND WHAT IS NOT
//
// The geometry is 046's: the vendored Natural Earth GeoJSON in
// `../blank-map-generator/data/` is read directly, and the continent/national
// crops are 046's own `BASE_MAP_PRESETS`, pulled in through a guarded dynamic
// import of `bmg-vector.js` (the same trick the Timeline Builder uses in
// `tlb-places.js`). Nothing under `Tools/blank-map-generator/` is written to,
// ever — this module is a reader.
//
// The *pixels*, though, are drawn here rather than by `renderBaseMapCanvas()`.
// That function always renders at a 4000 px long side because it is building a
// poster-quality base map to cache in IndexedDB; a quiz needs a 320 px thumbnail
// next to question 7, and a printed quiz needs ten of them. Rendering ten
// 4000 px continents and throwing 99% of each away is the wrong trade on a
// classroom Chromebook, and the snippet also wants styling the base map does not
// have (one region picked out, a locator ring around the small ones). So the
// drawing below is a ~120-line local renderer against the same data, which is
// exactly the fallback 015 shipped for the same reason.
//
// The antimeridian handling (`unwrapRing`/`drawableRings`) is adapted from
// bmg-vector.js. It is the third copy of that logic on the site now — see the
// note in `improvement prompts/_site-requests.md`; it wants to move into
// `_shared/`, which is out of bounds for this round.

const DATA_URL = name => new URL('../blank-map-generator/data/' + name, import.meta.url);

const DATASETS = {
  world: { file: 'world-countries-110m.json', noun: 'country' },
  us: { file: 'us-states-10m.json', noun: 'US state' },
};

/* ── crops ──────────────────────────────────────────────────────────────
   046's presets are the source of truth for these bounds; this table is the
   fallback used only if the dynamic import fails (a stale service-worker
   cache, a half-copied folder). Keeping a copy means a map question still
   draws instead of showing a blank box, which matters mid-lesson. */
const FALLBACK_BOUNDS = {
  world: { north: 84, south: -90, west: -180, east: 180 },
  africa: { north: 38, south: -36, west: -20, east: 53 },
  europe: { north: 72, south: 34, west: -25, east: 45 },
  asia: { north: 78, south: -12, west: 25, east: 180 },
  'north-america': { north: 72, south: 5, west: -170, east: -50 },
  'south-america': { north: 14, south: -56, west: -82, east: -33 },
  oceania: { north: 0, south: -48, west: 110, east: 180 },
  'usa-48': { north: 50, south: 24, west: -125, east: -66.5 },
  'usa-50': { north: 72, south: 18, west: -170, east: -66 },
};

let presetsPromise = null;
/** 046's BASE_MAP_PRESETS as a key→bounds map, or the fallback table above. Resolved once. */
export function loadBounds() {
  if (presetsPromise) return presetsPromise;
  presetsPromise = import(new URL('../blank-map-generator/bmg-vector.js', import.meta.url).href)
    .then(mod => {
      const out = {};
      (mod.BASE_MAP_PRESETS || []).forEach(p => { out[p.key] = p.bounds; });
      // Only trust it if it actually covers what we ask for; a partial answer
      // would fail later and further from the cause.
      return Object.keys(FALLBACK_BOUNDS).every(k => out[k]) ? out : FALLBACK_BOUNDS;
    })
    .catch(() => FALLBACK_BOUNDS);
  return presetsPromise;
}

/* ── the region pool ────────────────────────────────────────────────────
   Which places a map question may be about, and which crop each is shown on.
   Names on the left of the `|` are the `properties.name` in the vendored data
   and must match it exactly; the optional right side is what a 7th grader
   should write on the answer line ("The United States", not "United States of
   America").

   The crop is stated rather than computed. A centroid-fits-inside-bounds rule
   gets most of these right on its own, but it puts Iraq and Saudi Arabia on an
   Africa map (both fit inside that crop) and Russia on Europe (its geometry
   wraps the antimeridian, so its bounding box is the whole world). Rather than
   ship an algorithm with known-wrong answers on a demo day, the crop is part of
   the data — `contextFor()` still falls back to the algorithm for anything not
   listed. */
const WORLD_BY_CROP = {
  europe: ['France', 'Germany', 'Italy', 'Spain', 'Portugal', 'United Kingdom', 'Ireland', 'Norway',
    'Sweden', 'Finland', 'Denmark', 'Poland', 'Greece', 'Ukraine', 'Netherlands', 'Belgium',
    'Switzerland', 'Austria', 'Iceland', 'Turkey', 'Romania', 'Hungary', 'Czechia|the Czech Republic'],
  asia: ['China', 'India', 'Japan', 'South Korea', 'North Korea', 'Vietnam', 'Thailand', 'Indonesia',
    'Philippines|the Philippines', 'Malaysia', 'Pakistan', 'Bangladesh', 'Nepal', 'Afghanistan',
    'Iran', 'Iraq', 'Saudi Arabia', 'Israel', 'Jordan', 'Kazakhstan', 'Mongolia', 'Sri Lanka',
    'Myanmar', 'Cambodia', 'Yemen', 'Syria'],
  africa: ['Egypt', 'Nigeria', 'Kenya', 'Ethiopia', 'South Africa', 'Morocco', 'Algeria', 'Libya',
    'Sudan', 'Ghana', 'Tanzania', 'Uganda', 'Zimbabwe', 'Zambia', 'Madagascar', 'Senegal',
    'Somalia', 'Angola', 'Mozambique', 'Tunisia', 'Dem. Rep. Congo|the Democratic Republic of the Congo'],
  'north-america': ['Canada', 'Mexico', 'Cuba', 'Guatemala', 'Honduras', 'Costa Rica', 'Panama',
    'Nicaragua', 'Jamaica', 'Haiti', 'Belize', 'Dominican Rep.|the Dominican Republic',
    'United States of America|the United States'],
  'south-america': ['Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Venezuela', 'Bolivia',
    'Ecuador', 'Uruguay', 'Paraguay', 'Guyana'],
  oceania: ['Australia', 'New Zealand', 'Papua New Guinea'],
  world: ['Russia'],
};

const US_BY_CROP = {
  'usa-48': ['Alabama', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
    'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
  'usa-50': ['Alaska', 'Hawaii'],
};

function buildPool(byCrop) {
  const out = [];
  Object.keys(byCrop).forEach(crop => {
    byCrop[crop].forEach(entry => {
      const bar = entry.indexOf('|');
      const name = bar === -1 ? entry : entry.slice(0, bar);
      out.push({ name, label: bar === -1 ? entry : entry.slice(bar + 1), crop });
    });
  });
  return out;
}

/** Every region a map question may be generated for, per dataset. */
export const REGION_POOL = Object.freeze({
  world: Object.freeze(buildPool(WORLD_BY_CROP)),
  us: Object.freeze(buildPool(US_BY_CROP)),
});

export function regionsFor(dataset) {
  return REGION_POOL[dataset] || [];
}

export function findRegion(dataset, name) {
  const key = String(name || '').toLowerCase();
  return regionsFor(dataset).find(r => r.name.toLowerCase() === key) || null;
}

/** What the answer line should say for a region — its friendly label if it has one. */
export function labelFor(dataset, name) {
  const hit = findRegion(dataset, name);
  return hit ? hit.label : String(name || '');
}

export function datasetNoun(dataset) {
  return (DATASETS[dataset] || DATASETS.world).noun;
}

/* ── geometry ───────────────────────────────────────────────────────────── */

const geoCache = new Map();
function loadGeo(dataset) {
  const spec = DATASETS[dataset];
  if (!spec) return Promise.reject(new Error('unknown map dataset "' + dataset + '"'));
  if (geoCache.has(dataset)) return geoCache.get(dataset);
  const p = fetch(DATA_URL(spec.file))
    .then(res => {
      if (!res.ok) throw new Error("couldn't read the built-in map data (" + res.status + ')');
      return res.json();
    })
    .catch(err => { geoCache.delete(dataset); throw err; });
  geoCache.set(dataset, p);
  return p;
}

function polygonsOf(feature) {
  const g = feature && feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

/* Adapted from bmg-vector.js — see the header note. Natural Earth clamps a ring
   that straddles the antimeridian to ±180, so drawing it as-is rules a line
   clean across the map. Rewriting the longitudes so no step exceeds 180° fixes
   it; a ring that ends up more than 360° wide encircles the globe (Antarctica)
   and is closed through the pole when filling only. */
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

/** Plate carrée, the same projection 046 renders in, so a snippet and a printed blank map agree about where a place is. */
function project(bounds, w, h, lon, lat) {
  return {
    x: ((lon - bounds.west) / (bounds.east - bounds.west)) * w,
    y: ((bounds.north - lat) / (bounds.north - bounds.south)) * h,
  };
}

function traceFeature(ctx, feature, bounds, w, h, forStroke) {
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

/** The region's largest polygon, as a lon/lat box — used to pick a crop and to decide whether it needs a locator ring. */
function mainBox(feature) {
  let best = null;
  for (const poly of polygonsOf(feature)) {
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    for (const p of poly[0]) {
      if (p[0] < w) w = p[0];
      if (p[0] > e) e = p[0];
      if (p[1] < s) s = p[1];
      if (p[1] > n) n = p[1];
    }
    const span = (e - w) * (n - s);
    if (!best || span > best.span) best = { west: w, east: e, south: s, north: n, span };
  }
  return best;
}

const AUTO_CROPS = ['europe', 'africa', 'south-america', 'north-america', 'oceania', 'asia'];

/**
 * Which crop a region is shown on: whatever the pool says, else the smallest
 * continent crop its main landmass fits inside, else the world.
 */
export function contextFor(dataset, name, feature) {
  const listed = findRegion(dataset, name);
  if (listed) return listed.crop;
  if (dataset === 'us') return 'usa-48';
  const box = feature && mainBox(feature);
  if (box) {
    const fit = AUTO_CROPS.find(key => {
      const b = FALLBACK_BOUNDS[key];
      return box.west >= b.west && box.east <= b.east && box.south >= b.south && box.north <= b.north;
    });
    if (fit) return fit;
  }
  return 'world';
}

/* ── the snippet ────────────────────────────────────────────────────────
   Paper-first colours: the land is near-white and the highlighted region is a
   dark terracotta, so the two are still obviously different after a school
   copier has turned them both grey. */
const PAINT = {
  ocean: '#e7eef4',
  land: '#f6f2e7',
  border: '#a6a299',
  highlight: '#b3441f',
  highlightEdge: '#5d2410',
  frame: '#b9b5ac',
};

const renderCache = new Map();

/**
 * Draws `region` highlighted inside its crop and returns a PNG data URL plus
 * the CSS size to show it at.
 *
 * `width` is CSS pixels; the bitmap is `ratio`x that, so the printed copy is
 * crisp without the on-screen one being heavy. Results are cached by every
 * argument that changes a pixel, because a 10-question printed quiz asks for
 * the same handful of crops over and over.
 */
export async function renderSnippet({ dataset = 'world', region, context = null, width = 320, ratio = 2 } = {}) {
  const cacheKey = [dataset, region, context, width, ratio].join('|');
  if (renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  const p = (async () => {
    const [geo, boundsTable] = await Promise.all([loadGeo(dataset), loadBounds()]);
    const key = String(region || '').toLowerCase();
    const target = (geo.features || []).find(f => f.properties && String(f.properties.name).toLowerCase() === key);
    if (!target) throw new Error('the built-in map data has no region called "' + region + '"');

    const crop = context || contextFor(dataset, region, target);
    const bounds = boundsTable[crop] || FALLBACK_BOUNDS[crop] || FALLBACK_BOUNDS.world;

    const lonSpan = Math.abs(bounds.east - bounds.west);
    const latSpan = Math.abs(bounds.north - bounds.south);
    const cssW = Math.max(40, Math.round(width));
    const cssH = Math.max(30, Math.round(cssW * (latSpan / lonSpan)));
    const w = Math.round(cssW * ratio), h = Math.round(cssH * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.fillStyle = PAINT.ocean;
    ctx.fillRect(0, 0, w, h);

    // All the land in one path with an even-odd fill, so lakes and enclaves
    // punch through instead of being painted over.
    ctx.beginPath();
    for (const f of geo.features || []) traceFeature(ctx, f, bounds, w, h, false);
    ctx.fillStyle = PAINT.land;
    ctx.fill('evenodd');

    // The answer, painted on its own so its holes cancel against its own rings.
    ctx.beginPath();
    traceFeature(ctx, target, bounds, w, h, false);
    ctx.fillStyle = PAINT.highlight;
    ctx.fill('evenodd');

    ctx.strokeStyle = PAINT.border;
    ctx.lineWidth = Math.max(0.6, w / 900);
    ctx.beginPath();
    for (const f of geo.features || []) traceFeature(ctx, f, bounds, w, h, true);
    ctx.stroke();

    ctx.strokeStyle = PAINT.highlightEdge;
    ctx.lineWidth = Math.max(1.2, w / 380);
    ctx.beginPath();
    traceFeature(ctx, target, bounds, w, h, true);
    ctx.stroke();

    // Rhode Island on a lower-48 map is about four pixels wide. A ring around
    // anything that small is the difference between a question and a squint.
    const box = mainBox(target);
    let ringed = false;
    if (box) {
      const a = project(bounds, w, h, box.west, box.north);
      const b = project(bounds, w, h, box.east, box.south);
      const boxW = Math.abs(b.x - a.x), boxH = Math.abs(b.y - a.y);
      if (Math.max(boxW, boxH) < Math.max(w, h) * 0.07) {
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const r = Math.max(w * 0.045, Math.hypot(boxW, boxH) * 0.9);
        ctx.strokeStyle = PAINT.highlightEdge;
        ctx.lineWidth = Math.max(1.4, w / 320);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ringed = true;
      }
    }

    ctx.strokeStyle = PAINT.frame;
    ctx.lineWidth = Math.max(1, w / 700);
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    const url = canvas.toDataURL('image/png');
    canvas.width = 1; canvas.height = 1; // release the buffer now, not at GC's convenience
    return { url, width: cssW, height: cssH, crop, ringed, dataset, region };
  })().catch(err => { renderCache.delete(cacheKey); throw err; });

  renderCache.set(cacheKey, p);
  return p;
}
