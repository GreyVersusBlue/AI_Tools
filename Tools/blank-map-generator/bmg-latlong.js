// bmg-latlong.js — equirectangular (linear) lat/long calibration and
// graticule (grid line) math. Most Wikimedia Commons "blank map" files use
// a simple equirectangular projection, so mapping pixel position to
// longitude/latitude linearly is a reasonable default. It will drift for
// maps drawn in other projections (Mercator, Robinson, etc.) — called out
// in the calibration UI copy rather than hidden.

export function isCalibrated(calibration) {
  if (!calibration) return false;
  const { north, south, east, west } = calibration;
  return [north, south, east, west].every(Number.isFinite) && north !== south && east !== west;
}

export function toLatLon(calibration, imgW, imgH, stageX, stageY) {
  const { north, south, west, east } = calibration;
  return {
    lat: north + (stageY / imgH) * (south - north),
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
  const { north, south, west, east } = calibration;
  const lonStep = niceStep(Math.abs(east - west));
  const latStep = niceStep(Math.abs(north - south));

  const vLines = [];
  const lonLo = Math.min(west, east), lonHi = Math.max(west, east);
  for (let lon = Math.ceil(lonLo / lonStep) * lonStep; lon <= lonHi; lon += lonStep) {
    vLines.push({ lon: round(lon), x: ((lon - west) / (east - west)) * imgW });
  }

  const hLines = [];
  const latLo = Math.min(north, south), latHi = Math.max(north, south);
  for (let lat = Math.ceil(latLo / latStep) * latStep; lat <= latHi; lat += latStep) {
    hLines.push({ lat: round(lat), y: ((lat - north) / (south - north)) * imgH });
  }

  return { vLines, hLines };
}
