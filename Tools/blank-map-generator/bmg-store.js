// bmg-store.js — localStorage persistence for the current project's map
// choice and view state. `labels`/`markers` are carried in the shape now
// (empty until later phases) so this doesn't need a migration once they're
// used.

const KEY = "bmg_project_v1";
export const VERSION = 1;

function blank() {
  return { __v: VERSION, mapId: null, view: { x: 0, y: 0, scale: 1 }, labels: [], markers: [] };
}

function isValid(p) {
  return !!p && typeof p === "object" && p.__v === VERSION
    && p.view && typeof p.view === "object"
    && Array.isArray(p.labels) && Array.isArray(p.markers);
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
      return isValid(parsed) ? parsed : blank();
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
