// scv-store.js — localStorage persistence for the School Calendar Visualizer.
//
// One key, one shape, validated on the way in so a corrupt or hand-edited
// blob falls back to the seed instead of crashing the page.
//
// The key stays "scv_calendar_v1" across blob versions: the Command Center
// dashboard (Tools/010) reads it raw and checks only dayTypes/days, so the
// version lives in __v inside the blob, never in the key name.

import { emptyPacing } from "./scv-pacing.js";

const KEY = "scv_calendar_v1";
export const VERSION = 2;

function hasBaseShape(cal) {
  return !!cal
    && typeof cal === "object"
    && cal.meta && typeof cal.meta === "object"
    && Array.isArray(cal.dayTypes)
    && cal.days && typeof cal.days === "object";
}

// v1 blobs (no pacing) are still valid — old JSON backups must keep
// importing — and are upgraded by migrate() on the way in.
export function isValid(cal) {
  if (!hasBaseShape(cal)) return false;
  if (cal.__v === 1) return true;
  return cal.__v === VERSION
    && cal.pacing && typeof cal.pacing === "object"
    && Array.isArray(cal.pacing.lessons)
    && Array.isArray(cal.pacing.adjustments);
}

/** Upgrade an older valid blob to the current shape. No-op on current blobs. */
export function migrate(cal) {
  if (cal && cal.__v === 1) return { ...cal, __v: VERSION, pacing: emptyPacing() };
  return cal;
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
      return isValid(parsed) ? migrate(parsed) : seed();
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
