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
