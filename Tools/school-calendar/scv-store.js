// scv-store.js — localStorage persistence for the School Calendar Visualizer.
//
// One key, one shape, validated on the way in so a corrupt or hand-edited
// blob falls back to the seed instead of crashing the page.

const KEY = "scv_calendar_v1";
export const VERSION = 1;

export function isValid(cal) {
  return !!cal
    && typeof cal === "object"
    && cal.__v === VERSION
    && cal.meta && typeof cal.meta === "object"
    && Array.isArray(cal.dayTypes)
    && cal.days && typeof cal.days === "object";
}

/** True if localStorage rejects writes (private mode, quota, disabled). */
function probeBlocked() {
  try {
    localStorage.setItem("__scv_probe__", "1");
    localStorage.removeItem("__scv_probe__");
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * `seed` is a zero-arg function returning a fresh default calendar. It's
 * called lazily — only when there's nothing usable on disk — so callers
 * don't build seed data on every load.
 */
export function createStore(seed) {
  const blocked = probeBlocked();
  let mem = null;

  function get() {
    if (blocked) return mem || seed();
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch (e) { return seed(); }
    if (!raw) return seed();
    try {
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : seed();
    } catch (e) {
      return seed();
    }
  }

  function set(cal) {
    if (blocked) { mem = cal; return false; }
    try {
      localStorage.setItem(KEY, JSON.stringify(cal));
      return true;
    } catch (e) {
      mem = cal;
      return false;
    }
  }

  function clear() {
    mem = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to undo */ }
  }

  return { get, set, clear, get isMemoryOnly() { return blocked; } };
}
