// bmg-store.js — localStorage persistence for the current project's map
// choice, view state, labels, markers, and legend (caption text + panel
// position). normalize() backfills fields added after a project's first
// save, so older saved projects don't need a version bump to pick them up.

const KEY = "bmg_project_v1";
export const VERSION = 1;

function blank() {
  return {
    __v: VERSION, mapId: null, view: { x: 0, y: 0, scale: 1 },
    labels: [], markers: [], legendText: {}, legendPos: { x: 12, y: 12 },
    regions: [], regionLegendText: {},
    compassEnabled: false, gridEnabled: false, locatorEnabled: false, calibration: null,
    compassPos: null, locatorPos: null,
  };
}

function isValid(p) {
  return !!p && typeof p === "object" && p.__v === VERSION
    && p.view && typeof p.view === "object"
    && Array.isArray(p.labels) && Array.isArray(p.markers);
}

/** Backfills fields added after a project was first saved (e.g. legend, calibration, regions). */
function normalize(p) {
  if (!p.legendText || typeof p.legendText !== "object") p.legendText = {};
  if (!p.legendPos || typeof p.legendPos !== "object") p.legendPos = { x: 12, y: 12 };
  if (!Array.isArray(p.regions)) p.regions = [];
  if (!p.regionLegendText || typeof p.regionLegendText !== "object") p.regionLegendText = {};
  if (typeof p.compassEnabled !== "boolean") p.compassEnabled = false;
  if (typeof p.gridEnabled !== "boolean") p.gridEnabled = false;
  if (typeof p.locatorEnabled !== "boolean") p.locatorEnabled = false;
  if (p.calibration !== null && typeof p.calibration !== "object") p.calibration = null;
  if (p.compassPos !== null && typeof p.compassPos !== "object") p.compassPos = null;
  if (p.locatorPos !== null && typeof p.locatorPos !== "object") p.locatorPos = null;
  return p;
}

function probeBlocked() {
  try {
    localStorage.setItem("__bmg_probe__", "1");
    localStorage.removeItem("__bmg_probe__");
    return false;
  } catch (e) {
    return true;
  }
}

export function createStore() {
  const blocked = probeBlocked();
  let mem = null;

  function get() {
    if (blocked) return mem || blank();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? normalize(parsed) : blank();
    } catch (e) {
      return blank();
    }
  }

  function set(p) {
    if (blocked) { mem = p; return false; }
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
      return true;
    } catch (e) {
      mem = p;
      return false;
    }
  }

  return { get, set, get isMemoryOnly() { return blocked; } };
}
