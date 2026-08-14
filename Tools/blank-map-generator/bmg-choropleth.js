// bmg-choropleth.js — shade a built-in vector base map from a pasted
// "region, value" table.
//
// This module is pure data work: parse, match, classify, pick colours. It
// touches no DOM and knows nothing about the viewer, the cache or the
// legend panel. The host page reads a textarea, calls buildChoropleth(),
// and hands the resulting `fills` map to bmg-vector.js, which paints each
// named country/state as it draws the base raster. Everything downstream
// (labels, worksheets, print, PDF, poster tiles) then works on a shaded map
// without knowing one exists — the same trick Round 13 used for base maps
// themselves.
//
// Three decisions worth knowing about:
//
//   1. **Quantile classes, not equal intervals.** Real classroom data is
//      lopsided — California has 67x Wyoming's people — and equal intervals
//      would put 46 states in the lightest band and California alone in the
//      darkest, which shows nothing. Quantiles put roughly the same number
//      of regions in each band, so the map actually has a pattern to read.
//      The legend prints the real numeric range of each band, so nothing is
//      hidden by the choice.
//
//   2. **Grayscale-safe means one hue, getting darker.** The tool's existing
//      grayscale-safe convention (see the "Grayscale-safe fills" checkbox)
//      swaps hatch and dot patterns in for *categorical* region colours,
//      because two unrelated categories in red and green photocopy to the
//      same gray. Ordered data has the opposite need: the bands are ranked,
//      so the honest print-safe encoding is a single hue whose lightness
//      falls step by step. A black-and-white copier reproduces that ranking
//      exactly. Patterns would fight it — a hatch is not "more" than a dot.
//      RAMP_LUMINANCE_STEP below is the guarantee, and the smoke test
//      enforces it.
//
//   3. **Nothing is dropped silently.** A row whose name doesn't match any
//      region on the map comes back in `unmatched` with its name intact, so
//      the UI can say "Puerto Rico, Guam: not on this map" instead of
//      quietly shading 48 of 50 states and letting a teacher present it.

/* ── names ─────────────────────────────────────────────────────────────── */

/**
 * The comparison form of a place name: lowercase, accents stripped,
 * punctuation flattened to spaces, a leading "the" removed. This alone
 * handles a surprising share of the traps — "Côte d'Ivoire" and
 * "Cote d Ivoire" both land on "cote d ivoire", and "D.C." becomes "d c".
 */
export function normalizeName(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// Alias → the exact name Natural Earth uses in ./data/. Keys are written
// here in ordinary form and normalized at build time, so this table stays
// readable. Only aliases that a teacher plausibly types are included; a
// name that isn't here simply gets reported as unmatched, which is the
// honest outcome (England is not the United Kingdom, and the teacher who
// typed it should be the one to decide what they meant).
const WORLD_ALIASES = {
  "United States": "United States of America",
  "USA": "United States of America",
  "U.S.": "United States of America",
  "U.S.A.": "United States of America",
  "US": "United States of America",
  "America": "United States of America",
  "UK": "United Kingdom",
  "U.K.": "United Kingdom",
  "Great Britain": "United Kingdom",
  "Britain": "United Kingdom",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Democratic Republic of Congo": "Dem. Rep. Congo",
  "DR Congo": "Dem. Rep. Congo",
  "DRC": "Dem. Rep. Congo",
  "Congo-Kinshasa": "Dem. Rep. Congo",
  "Zaire": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "Congo-Brazzaville": "Congo",
  "Burma": "Myanmar",
  "Czech Republic": "Czechia",
  "Ivory Coast": "Côte d'Ivoire",
  "Swaziland": "eSwatini",
  "North Macedonia": "Macedonia",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Bosnia": "Bosnia and Herz.",
  "Central African Republic": "Central African Rep.",
  "Dominican Republic": "Dominican Rep.",
  "Equatorial Guinea": "Eq. Guinea",
  "Western Sahara": "W. Sahara",
  "South Sudan": "S. Sudan",
  "Northern Cyprus": "N. Cyprus",
  "Falkland Islands": "Falkland Is.",
  "Solomon Islands": "Solomon Is.",
  "East Timor": "Timor-Leste",
  "Holland": "Netherlands",
  "Russian Federation": "Russia",
  "Turkiye": "Turkey",
  "Republic of Korea": "South Korea",
  "Korea, South": "South Korea",
  "Korea, North": "North Korea",
  "DPRK": "North Korea",
  "UAE": "United Arab Emirates",
  "Lao PDR": "Laos",
  "Viet Nam": "Vietnam",
  "Syrian Arab Republic": "Syria",
  "Cabo Verde": "Cape Verde",
  "Palestinian Territories": "Palestine",
  "West Bank and Gaza": "Palestine",
  "Tanzania, United Republic of": "Tanzania",
};

// US postal abbreviations, plus the handful of long forms and the D.C.
// spellings that a spreadsheet column throws at you.
const US_ALIASES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  "D.C.": "District of Columbia",
  "DC": "District of Columbia",
  "Washington, D.C.": "District of Columbia",
  "Washington DC": "District of Columbia",
  "Virgin Islands": "United States Virgin Islands",
  "N. Mariana Islands": "Commonwealth of the Northern Mariana Islands",
  "Northern Mariana Islands": "Commonwealth of the Northern Mariana Islands",
};

const ALIAS_LOOKUP = (() => {
  const map = new Map();
  for (const table of [WORLD_ALIASES, US_ALIASES]) {
    for (const [alias, canonical] of Object.entries(table)) map.set(normalizeName(alias), canonical);
  }
  return map;
})();

/* ── parsing ───────────────────────────────────────────────────────────── */

// One "name, value" line. The name is matched lazily and the value must be
// the whole rest of the line, so a name containing the delimiter still
// works: in "Congo, Dem. Rep., 95000000" the first split leaves a value of
// "Dem. Rep., 95000000", which isn't numeric, so the match backtracks to
// the last comma and the name comes out whole. Thousands separators, a
// leading $ and a trailing % all survive, since spreadsheets emit them.
const ROW_RE = /^\s*(.*?)\s*[\t;,|]\s*\$?\s*(-?[\d][\d,\s]*(?:\.\d+)?\s*%?)\s*$/;

function toNumber(token) {
  const cleaned = String(token).replace(/[,\s%$]/g, "");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses pasted text into rows. Blank lines are ignored. A first line that
 * isn't a name/number pair is treated as a header ("state, population") and
 * skipped, as long as something after it does parse — otherwise it is
 * reported like any other unreadable line rather than being swallowed.
 * Later duplicates of the same name win, matching what a spreadsheet does
 * when you look up a key.
 */
export function parseDataRows(text) {
  const lines = String(text == null ? "" : text).split(/\r?\n/);
  const parsed = [];
  const unreadable = [];
  let headerSkipped = null;
  let firstBad = null;

  lines.forEach(line => {
    if (!line.trim()) return;
    const m = ROW_RE.exec(line);
    const value = m ? toNumber(m[2]) : null;
    if (!m || !m[1].trim() || value === null) {
      if (firstBad === null && parsed.length === 0) firstBad = line.trim();
      else unreadable.push(line.trim());
      return;
    }
    parsed.push({ name: m[1].trim(), value });
  });

  if (firstBad !== null) {
    if (parsed.length) headerSkipped = firstBad;
    else unreadable.unshift(firstBad);
  }
  return { rows: parsed, headerSkipped, unreadable };
}

/* ── parsing, several value columns at a time ──────────────────────────── */

/**
 * Which character separates the columns. Order matters and is not arbitrary:
 * a real spreadsheet paste is tab-separated, and a tab can never appear
 * inside a number, so preferring it removes the whole ambiguity below
 * whenever it is available.
 */
function pickDelimiter(text) {
  if (text.includes("\t")) return "\t";
  if (text.includes(";")) return ";";
  if (text.includes("|")) return "|";
  return ",";
}

/** A field that is exactly three digits — the shape of a thousands group, and the reason a comma is a poor column separator for a table of big numbers. */
const THOUSANDS_GROUP = /^\d{3}$/;

function isNumberField(s) { return toNumber(s) !== null; }

/** How many fields at the end of a row read as numbers. */
function trailingNumberCount(fields) {
  let n = 0;
  for (let i = fields.length - 1; i >= 1; i--) {
    if (!isNumberField(fields[i])) break;
    n++;
  }
  return n;
}

/**
 * Whether a line is naming the columns rather than filling them.
 *
 * The single-column parser could tell by asking "does this parse as data?",
 * because a header like `State, Population` doesn't. A time-slice header
 * does: `State, 1790, 1850, 1900` is, read literally, Virginia with three
 * numbers in it. So the test is about *shape* instead. A header's first
 * field is a label, never a number, and its remaining fields are either
 * words (the classic case) or four-digit years (the case this whole feature
 * exists for). Six-digit populations are not years, so a data row is never
 * mistaken for a header and quietly eaten.
 */
function looksLikeHeader(fields) {
  if (fields.length < 2 || isNumberField(fields[0]) || !fields[0]) return false;
  const values = fields.slice(1);
  if (values.every(v => v && !isNumberField(v))) return true;
  return values.every(v => /^\d{4}$/.test(v) && Number(v) >= 1000 && Number(v) <= 2999);
}

/**
 * Parses a table with one *or more* value columns per place:
 *
 *     State, 1790, 1850, 1900
 *     Maryland, 320000, 583000, 1188000
 *
 * **The comma problem, stated honestly.** The single-column parser gets away
 * with commas because it requires the value to run to the end of the line,
 * so `6,200,000` is one token and can only be one number. With several value
 * columns that trick is gone, and `Maryland, 69,000, 148,000` is genuinely
 * ambiguous: two numbers with thousands separators, or four plain numbers?
 * No rule decides that correctly in every case, and a parser that guesses
 * puts a wrong number on a map a class is about to read.
 *
 * So it does not guess. A tab, semicolon or pipe removes the ambiguity
 * outright and is preferred whenever the paste contains one — which covers
 * every real spreadsheet paste. With commas, the header row fixes the column
 * count, and a row that then carries surplus three-digit fields is reported
 * by name with advice, rather than silently becoming a different number.
 *
 * A header row names the slices. Without one they are "Column 1", "Column
 * 2", so a printed series is still labelled with something.
 */
export function parseDataTable(text) {
  const raw = String(text == null ? "" : text);
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const delim = pickDelimiter(raw);
  const split = lines.map(line => line.split(delim).map(f => f.trim()));

  if (!split.length) {
    return { slices: [], rows: [], headerSkipped: null, unreadable: [], ambiguous: [], delimiter: delim };
  }
  const hasHeader = split.length > 1 && looksLikeHeader(split[0]);
  const firstDataAt = hasHeader ? 1 : 0;
  const headerFields = hasHeader ? split[0] : null;
  const headerSkipped = hasHeader ? lines[0].trim() : null;

  // With commas, only a header can establish how many value columns there
  // are — the data rows alone cannot be trusted to say. With an unambiguous
  // delimiter the first data row is enough.
  let sliceCount;
  if (headerFields && headerFields.length >= 2) sliceCount = headerFields.length - 1;
  else if (delim === ",") sliceCount = 1;
  else sliceCount = trailingNumberCount(split[firstDataAt]);
  sliceCount = Math.max(1, sliceCount);

  let slices = headerFields && headerFields.length >= sliceCount + 1
    ? headerFields.slice(headerFields.length - sliceCount).map(s => s || "")
    : null;
  if (!slices || slices.some(s => !s)) {
    slices = Array.from({ length: sliceCount }, (_, i) => `Column ${i + 1}`);
  }

  const rows = [];
  const unreadable = [];
  const ambiguous = [];
  split.forEach((fields, i) => {
    if (i < firstDataAt) return;
    const line = lines[i].trim();
    if (fields.length <= sliceCount) { unreadable.push(line); return; }
    const values = fields.slice(fields.length - sliceCount).map(toNumber);
    const nameParts = fields.slice(0, fields.length - sliceCount);
    const name = nameParts.join(delim).trim();
    if (values.some(v => v === null) || !name) { unreadable.push(line); return; }
    // The surplus-field test: with commas, a name column that has picked up
    // three-digit numeric fields is a thousands separator being read as a
    // column break. Say so instead of shading a state with 69000148.
    if (delim === "," && sliceCount > 1 && nameParts.length > 1
        && nameParts.slice(1).every(f => THOUSANDS_GROUP.test(f) || isNumberField(f))) {
      ambiguous.push(line);
      return;
    }
    rows.push({ name, values });
  });

  return { slices, rows, headerSkipped, unreadable, ambiguous, delimiter: delim };
}

/* ── matching ──────────────────────────────────────────────────────────── */

/**
 * Resolves parsed rows against the region names actually present on this
 * map. Returns matches keyed by the map's own spelling, plus every row that
 * found nothing — by name, so the UI can print them.
 */
export function matchRegions(rows, regionNames) {
  const resolve = makeRegionResolver(regionNames);
  const values = new Map(); // canonical region name → value
  const unmatched = [];
  rows.forEach(row => {
    const region = resolve(row.name);
    if (region) values.set(region, row.value);
    else unmatched.push(row.name);
  });
  return { values, unmatched };
}

/**
 * A reusable "what does this map call that place" function, built once from
 * the map's own name list. Same rule matchRegions() has always used — exact
 * normalized name first, then the alias table — pulled out so a multi-column
 * table can resolve each place once instead of once per column.
 */
export function makeRegionResolver(regionNames) {
  const byNormal = new Map();
  (regionNames || []).forEach(name => byNormal.set(normalizeName(name), name));
  return function resolve(name) {
    const key = normalizeName(name);
    let region = byNormal.get(key);
    if (!region) {
      const alias = ALIAS_LOOKUP.get(key);
      if (alias) region = byNormal.get(normalizeName(alias));
    }
    return region || null;
  };
}

/* ── classification ────────────────────────────────────────────────────── */

export const MIN_CLASSES = 4;
export const MAX_CLASSES = 6;

/**
 * Quantile upper bounds — one per class, ascending, ending at the maximum.
 * Bands that would collapse onto an identical bound (a lot of tied values,
 * or fewer distinct values than classes) are merged rather than emitted as
 * empty duplicates, so the legend never shows two rows meaning the same
 * thing.
 */
export function quantileBreaks(values, classes) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const k = Math.max(1, Math.min(classes, new Set(sorted).size));
  const uppers = [];
  for (let i = 1; i <= k; i++) {
    const idx = Math.min(sorted.length - 1, Math.ceil((i * sorted.length) / k) - 1);
    const upper = sorted[idx];
    if (!uppers.length || upper > uppers[uppers.length - 1]) uppers.push(upper);
  }
  uppers[uppers.length - 1] = sorted[sorted.length - 1];
  return uppers;
}

/* ── colour ramps ──────────────────────────────────────────────────────── */

// Single-hue sequential ramps: six stops each, light to dark, in the
// tradition of Cynthia Brewer's sequential schemes. Each stop's relative
// luminance is meaningfully lower than the one before it (see
// rampLuminances / RAMP_LUMINANCE_STEP), which is what makes the map
// survive a black-and-white copier with its ranking intact.
export const RAMPS = Object.freeze([
  { key: "blues", label: "Blues (light to dark)", stops: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"] },
  { key: "oranges", label: "Oranges (light to dark)", stops: ["#feedde", "#fdd0a2", "#fdae6b", "#fd8d3c", "#e6550d", "#a63603"] },
  { key: "greens", label: "Greens (light to dark)", stops: ["#edf8e9", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"] },
  { key: "greys", label: "Greys (prints anywhere)", stops: ["#f7f7f7", "#d9d9d9", "#bdbdbd", "#969696", "#636363", "#252525"] },
]);

export const DEFAULT_RAMP = "blues";
/** Minimum drop in relative luminance between neighbouring ramp stops. Below about this, a photocopier stops separating them. */
export const RAMP_LUMINANCE_STEP = 0.04;

export function findRamp(key) {
  return RAMPS.find(r => r.key === key) || RAMPS[0];
}

/** WCAG relative luminance — the number a grayscale copier is effectively reproducing. */
export function relativeLuminance(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const channel = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function rampLuminances(key) {
  return findRamp(key).stops.map(relativeLuminance);
}

/** Picks `count` evenly-spread stops from a ramp, always keeping the lightest and darkest ends. */
export function rampColors(key, count) {
  const stops = findRamp(key).stops;
  const n = Math.max(1, Math.min(count, stops.length));
  if (n === 1) return [stops[stops.length - 1]];
  return Array.from({ length: n }, (_, i) => stops[Math.round((i * (stops.length - 1)) / (n - 1))]);
}

/* ── number formatting ─────────────────────────────────────────────────── */

/** Formats a value for a legend row, choosing one scale for the whole set so the rows read as a series ("1.4M", "6.2M") rather than a jumble. */
export function makeValueFormatter(values) {
  const max = values.length ? Math.max(...values.map(Math.abs)) : 0;
  if (max >= 1e9) return v => `${trimZero(v / 1e9)}B`;
  if (max >= 1e6) return v => `${trimZero(v / 1e6)}M`;
  if (max >= 1e4) return v => Math.round(v).toLocaleString("en-US");
  if (Number.isInteger(max) && values.every(Number.isInteger)) return v => String(v);
  return v => trimZero(v, 2);
}

function trimZero(n, places = 1) {
  return String(Number(n.toFixed(places)));
}

/* ── the whole job ─────────────────────────────────────────────────────── */

export const classKey = i => `choro:${i}`;

/** A short, stable id for one shading result, so a shaded render gets its own cache record instead of overwriting the plain base map. FNV-1a, base 36. */
export function choroplethKey(parts) {
  const s = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Parse → match → classify → colour, in one call.
 *
 * `regionNames` is the list of names the map can actually draw (from
 * bmg-vector.js's listRegionNames). Returns everything the UI and the
 * renderer need, including the honest bookkeeping: how many rows matched,
 * which didn't, and how many regions on the map ended up with no data.
 */
export function buildChoropleth({ text, regionNames = [], classes = 5, ramp = DEFAULT_RAMP } = {}) {
  const classCount = Math.max(MIN_CLASSES, Math.min(MAX_CLASSES, Math.round(classes) || 5));
  const { rows, headerSkipped, unreadable } = parseDataRows(text);
  const { values, unmatched } = matchRegions(rows, regionNames);

  const numbers = [...values.values()];
  const breaks = quantileBreaks(numbers, classCount);
  const colors = rampColors(ramp, breaks.length);
  const format = makeValueFormatter(numbers);

  const classOf = v => {
    for (let i = 0; i < breaks.length; i++) if (v <= breaks[i]) return i;
    return breaks.length - 1;
  };

  const fills = {};
  const counts = breaks.map(() => 0);
  values.forEach((v, region) => {
    const i = classOf(v);
    fills[region] = colors[i];
    counts[i]++;
  });

  const min = numbers.length ? Math.min(...numbers) : 0;
  const legendRows = breaks.map((upper, i) => {
    const lower = i === 0 ? min : breaks[i - 1];
    return {
      key: classKey(i),
      hex: colors[i],
      label: lower === upper ? format(upper) : `${format(lower)} to ${format(upper)}`,
      count: counts[i],
    };
  });

  const regionsWithData = values.size;

  return {
    ok: regionsWithData > 0,
    classes: classCount,
    ramp,
    rowCount: rows.length,
    headerSkipped,
    unreadable,
    unmatched,
    matchedCount: regionsWithData,
    breaks,
    fills,
    legendRows,
    format,
    key: choroplethKey({ f: Object.entries(fills).sort(([a], [b]) => (a < b ? -1 : 1)), r: ramp, c: classCount }),
  };
}

/* ── time slices: one map per column, one set of bands ─────────────────── */

/** The most maps a series will print. Past this the panels are too small to read anything off, and the honest answer is a second sheet. */
export const MAX_SLICES = 8;

/**
 * Parse → match → classify → colour, for a table with several value columns
 * — the shape of every "territorial change over time" question a social
 * studies unit asks. One map per column, printed as a labelled series.
 *
 * **The bands are computed once across every value in every column, and the
 * same bands colour all of them.** That is the entire point and the one
 * thing that would be easy to get wrong: classify each map on its own data
 * and 1900's darkest band and 2000's darkest band mean different numbers, so
 * a series that looks like it shows growth might show nothing at all, or
 * hide a tenfold rise behind identical-looking maps. Shared bands mean the
 * three maps are comparable at a glance, which is the only reason to put
 * them side by side.
 *
 * The cost of that choice is honest and visible: if one slice's values are
 * far larger, the other slices sit in the lightest band or two. That is the
 * data saying so, and the key prints the real numeric range either way.
 */
export function buildSeries({ text, regionNames = [], classes = 5, ramp = DEFAULT_RAMP } = {}) {
  const classCount = Math.max(MIN_CLASSES, Math.min(MAX_CLASSES, Math.round(classes) || 5));
  const { slices, rows, headerSkipped, unreadable, ambiguous } = parseDataTable(text);
  const capped = slices.slice(0, MAX_SLICES);

  // A place is matched once, not once per column.
  const resolve = makeRegionResolver(regionNames);
  const canonicalOf = new Map();
  const unmatched = [];
  rows.forEach(r => {
    const region = resolve(r.name);
    if (region) canonicalOf.set(r.name, region);
    else unmatched.push(r.name);
  });
  const matchedCount = new Set(canonicalOf.values()).size;

  const pooled = [];
  rows.forEach(r => { if (canonicalOf.has(r.name)) capped.forEach((_, i) => pooled.push(r.values[i])); });

  const breaks = quantileBreaks(pooled, classCount);
  const colors = rampColors(ramp, breaks.length);
  const format = makeValueFormatter(pooled);
  const classOf = v => {
    for (let i = 0; i < breaks.length; i++) if (v <= breaks[i]) return i;
    return breaks.length - 1;
  };

  const counts = breaks.map(() => 0);
  const sliceResults = capped.map((label, i) => {
    const fills = {};
    rows.forEach(r => {
      const region = canonicalOf.get(r.name);
      if (!region) return;
      const cls = classOf(r.values[i]);
      fills[region] = colors[cls];
      counts[cls]++;
    });
    return { label, fills, key: choroplethKey({ f: Object.entries(fills).sort(([a], [b]) => (a < b ? -1 : 1)), r: ramp, c: classCount, s: label }) };
  });

  const min = pooled.length ? Math.min(...pooled) : 0;
  const legendRows = breaks.map((upper, i) => {
    const lower = i === 0 ? min : breaks[i - 1];
    return {
      key: classKey(i),
      hex: colors[i],
      label: lower === upper ? format(upper) : `${format(lower)} to ${format(upper)}`,
      count: counts[i],
    };
  });

  return {
    ok: sliceResults.length > 1 && matchedCount > 0,
    sliceCount: slices.length,
    dropped: Math.max(0, slices.length - capped.length),
    slices: sliceResults,
    sliceLabels: capped,
    legendRows,
    breaks,
    matchedCount,
    rowCount: rows.length,
    unmatched,
    unreadable,
    ambiguous: ambiguous || [],
    headerSkipped,
    format,
  };
}

/**
 * Population of the thirteen original states across three censuses, so the
 * time-slice series has something real to demonstrate on. Rounded, and
 * deliberately a story a 7th grader can read off three maps: the whole
 * seaboard is dark in 1790 because that is where everyone lived, and by 1900
 * the same states are pale beside a country that has filled in behind them.
 */
export const EXAMPLE_TIME_SLICES = [
  "State, 1790, 1850, 1900",
  "Virginia, 747000, 1119000, 1854000",
  "Pennsylvania, 434000, 2311000, 6302000",
  "North Carolina, 394000, 869000, 1894000",
  "Massachusetts, 379000, 995000, 2805000",
  "New York, 340000, 3097000, 7269000",
  "Maryland, 320000, 583000, 1188000",
  "South Carolina, 249000, 668000, 1340000",
  "Connecticut, 238000, 371000, 908000",
  "New Jersey, 184000, 490000, 1884000",
  "New Hampshire, 142000, 318000, 412000",
  "Georgia, 83000, 906000, 2216000",
  "Rhode Island, 69000, 148000, 428000",
  "Delaware, 59000, 92000, 185000",
].join("\n");

/* ── legend swatch ─────────────────────────────────────────────────────── */

let swatchId = 0;

/** A plain filled square for one class. Unlike a region swatch this takes a raw hex (ramp colours aren't in the 6-colour palette) and fills solid, because the *depth of the fill* is the whole message. */
export function choroSwatchSvg(hex, size = 16) {
  swatchId++;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">` +
    `<rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}" stroke="#7a776e" stroke-width="1"/></svg>`;
}

/* ── example data ──────────────────────────────────────────────────────── */

/**
 * Rounded population estimates for all 50 states, so the paste box has
 * something real in it during a demo or a first run. Rounded on purpose:
 * these are for showing a pattern on a map, not for a statistics lesson,
 * and a rounded figure won't quietly go stale the way a precise one does.
 * Written with thousands separators because that is what comes out of a
 * spreadsheet, and the parser should be seen coping with it.
 */
export const EXAMPLE_US_POPULATION = [
  "State, Population",
  "California, 39,000,000",
  "Texas, 30,500,000",
  "Florida, 22,600,000",
  "New York, 19,600,000",
  "Pennsylvania, 13,000,000",
  "Illinois, 12,600,000",
  "Ohio, 11,800,000",
  "Georgia, 11,000,000",
  "North Carolina, 10,800,000",
  "Michigan, 10,000,000",
  "New Jersey, 9,300,000",
  "Virginia, 8,700,000",
  "Washington, 7,800,000",
  "Arizona, 7,400,000",
  "Tennessee, 7,100,000",
  "Massachusetts, 7,000,000",
  "Indiana, 6,900,000",
  "Maryland, 6,200,000",
  "Missouri, 6,200,000",
  "Wisconsin, 5,900,000",
  "Colorado, 5,900,000",
  "Minnesota, 5,700,000",
  "South Carolina, 5,400,000",
  "Alabama, 5,100,000",
  "Louisiana, 4,600,000",
  "Kentucky, 4,500,000",
  "Oregon, 4,200,000",
  "Oklahoma, 4,100,000",
  "Connecticut, 3,600,000",
  "Utah, 3,400,000",
  "Iowa, 3,200,000",
  "Nevada, 3,200,000",
  "Arkansas, 3,100,000",
  "Mississippi, 2,900,000",
  "Kansas, 2,900,000",
  "New Mexico, 2,100,000",
  "Nebraska, 2,000,000",
  "Idaho, 2,000,000",
  "West Virginia, 1,800,000",
  "Hawaii, 1,400,000",
  "New Hampshire, 1,400,000",
  "Maine, 1,400,000",
  "Rhode Island, 1,100,000",
  "Montana, 1,100,000",
  "Delaware, 1,000,000",
  "South Dakota, 920,000",
  "North Dakota, 780,000",
  "Alaska, 730,000",
  "Vermont, 650,000",
  "Wyoming, 580,000",
].join("\n");
