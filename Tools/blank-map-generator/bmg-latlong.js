// bmg-latlong.js — lat/long calibration and graticule (grid line) math for
// two projections: equirectangular (evenly-spaced lat/long, what most
// Commons "blank map" files use) and Mercator (common on wall/web maps,
// where lines of latitude get farther apart toward the poles). Any other
// projection (Robinson, conic, etc.) will still drift — called out in the
// calibration UI copy rather than hidden.

const DEFAULT_PROJECTION = "equirectangular";

// Mercator's y coordinate is undefined at the poles (tan of a right angle);
// real Mercator maps are always clipped well short of ±90°, so clamp to the
// standard ~85.05° cutoff rather than let the math blow up to Infinity/NaN
// if a calibration is mistakenly set to a full ±90°.
const MERCATOR_LAT_LIMIT = 85.05;

function mercatorY(latDeg) {
  const clamped = Math.max(-MERCATOR_LAT_LIMIT, Math.min(MERCATOR_LAT_LIMIT, latDeg));
  const rad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function inverseMercatorY(y) {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** Projects a latitude to the linear axis a calibration's north/south edges are measured along. */
function projectedLat(lat, projection) {
  return projection === "mercator" ? mercatorY(lat) : lat;
}

export function isCalibrated(calibration) {
  if (!calibration) return false;
  const { north, south, east, west } = calibration;
  return [north, south, east, west].every(Number.isFinite) && north !== south && east !== west;
}

export function toLatLon(calibration, imgW, imgH, stageX, stageY) {
  const { north, south, west, east, projection = DEFAULT_PROJECTION } = calibration;
  const pNorth = projectedLat(north, projection);
  const pSouth = projectedLat(south, projection);
  const p = pNorth + (stageY / imgH) * (pSouth - pNorth);
  return {
    lat: projection === "mercator" ? inverseMercatorY(p) : p,
    lon: west + (stageX / imgW) * (east - west),
  };
}

export function formatLatLon(lat, lon) {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}° ${latDir}, ${Math.abs(lon).toFixed(1)}° ${lonDir}`;
}

/** Inverse of toLatLon() — turns a real-world lat/lon into stage-pixel coordinates on a calibrated map. Used to batch-place markers from pasted "name, lat, lon" lists. */
export function fromLatLon(calibration, imgW, imgH, lat, lon) {
  const { north, south, west, east, projection = DEFAULT_PROJECTION } = calibration;
  const pNorth = projectedLat(north, projection);
  const pSouth = projectedLat(south, projection);
  const p = projectedLat(lat, projection);
  return {
    x: ((lon - west) / (east - west)) * imgW,
    y: ((p - pNorth) / (pSouth - pNorth)) * imgH,
  };
}

// Mean Earth radius in km, used only for the scale bar's rough real-world
// distance estimate — same "best-effort" accuracy tier as the rest of this
// file's projection math.
const KM_PER_DEG = (Math.PI / 180) * 6371;
const MI_PER_KM = 0.621371;

/**
 * Real-world meters represented by one stage (map) pixel, measured
 * horizontally along the map's vertical center column at `atStageY` — km
 * per degree of longitude shrinks by cos(latitude), and Mercator maps also
 * stretch vertically near the poles, so this is latitude-dependent even
 * though the calibration itself is a flat lon-per-pixel ratio.
 */
export function metersPerMapPixel(calibration, imgW, imgH, atStageY) {
  const { west, east } = calibration;
  const { lat } = toLatLon(calibration, imgW, imgH, imgW / 2, atStageY);
  const degLonPerPixel = Math.abs(east - west) / imgW;
  const kmPerDegreeLon = KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
  return degLonPerPixel * kmPerDegreeLon * 1000;
}

// Rounds down to the nearest "nice" 1-2-5 step at or below `value` — the
// convention printed map scale bars use, so the bar's number is always
// something a student could actually estimate distances with (e.g. a
// computed 340 km becomes a bar labeled "200 km", not an odd number).
function niceScaleDown(value) {
  if (!(value > 0)) return 0;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  const fraction = value / base;
  const nice = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return nice * base;
}

function formatScaleLabel(value, unit) {
  const rounded = Math.round(value * 100) / 100;
  if (unit === "km" && rounded < 1) return `${Math.round(rounded * 1000)} m`;
  if (unit === "mi" && rounded < 1) return `${Math.round(rounded * 5280)} ft`;
  return `${rounded} ${unit}`;
}

/**
 * Computes a scale bar's on-screen pixel width and label for the current
 * view. `targetPx` is the bar's ideal width — the actual width comes out to
 * whatever "nice" round real-world distance lands closest to it, per
 * niceScaleDown(). Returns null if the map isn't calibrated (or the current
 * view/zoom hasn't settled yet), so callers can just hide the bar.
 */
export function computeScaleBar(calibration, imgW, imgH, viewStageY, scale, unit = "km", targetPx = 110) {
  if (!isCalibrated(calibration) || !imgW || !imgH || !scale) return null;
  const metersPerScreenPx = metersPerMapPixel(calibration, imgW, imgH, viewStageY) / scale;
  if (!Number.isFinite(metersPerScreenPx) || metersPerScreenPx <= 0) return null;
  const targetKm = (targetPx * metersPerScreenPx) / 1000;
  const targetUnits = unit === "mi" ? targetKm * MI_PER_KM : targetKm;
  const niceUnits = niceScaleDown(targetUnits);
  if (!niceUnits) return null;
  const niceMeters = (unit === "mi" ? niceUnits / MI_PER_KM : niceUnits) * 1000;
  return { widthPx: niceMeters / metersPerScreenPx, label: formatScaleLabel(niceUnits, unit) };
}

const NICE_STEPS = [90, 60, 45, 30, 20, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1];

function niceStep(span) {
  const target = span / 8; // aim for roughly 8 lines across the span
  for (const step of NICE_STEPS) {
    if (step <= target) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

function round(n) { return Math.round(n * 100) / 100; }

/** Grid line positions in stage-pixel coordinates for the calibrated extent. */
export function computeGraticule(calibration, imgW, imgH) {
  const { north, south, west, east, projection = DEFAULT_PROJECTION } = calibration;
  const lonStep = niceStep(Math.abs(east - west));
  const latStep = niceStep(Math.abs(north - south));

  const vLines = [];
  const lonLo = Math.min(west, east), lonHi = Math.max(west, east);
  for (let lon = Math.ceil(lonLo / lonStep) * lonStep; lon <= lonHi; lon += lonStep) {
    vLines.push({ lon: round(lon), x: ((lon - west) / (east - west)) * imgW });
  }

  const hLines = [];
  const latLo = Math.min(north, south), latHi = Math.max(north, south);
  const pNorth = projectedLat(north, projection);
  const pSouth = projectedLat(south, projection);
  for (let lat = Math.ceil(latLo / latStep) * latStep; lat <= latHi; lat += latStep) {
    hLines.push({ lat: round(lat), y: ((projectedLat(lat, projection) - pNorth) / (pSouth - pNorth)) * imgH });
  }

  return { vLines, hLines };
}
