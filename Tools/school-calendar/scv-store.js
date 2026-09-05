// scv-store.js — localStorage persistence for the School Calendar Visualizer.
//
// One key, one shape, validated on the way in so a corrupt or hand-edited
// blob falls back to the seed instead of crashing the page.
//
// The key stays "scv_calendar_v1" across blob versions: the Command Center
// dashboard (Tools/010) reads it raw and checks only dayTypes/days, so the
// version lives in __v inside the blob, never in the key name.
//
// Since the Path 4 adoption this file no longer touches localStorage itself:
// every read and write goes through window.Store (_shared/store.js), which the
// page loads before this module. What that buys, and what it deliberately does
// not change:
//
//   * A write that does not stick is now VISIBLE. It used to return `false`
//     and, unless the page happened to look at the return value, that was the
//     end of it. Store owns the message and names this tool.
//   * The bytes on disk are IDENTICAL. Store's `raw: true` writes the bare
//     JSON of the blob with no {v, data} envelope around it, because 010 reads
//     this key with a plain JSON.parse. Enveloping it would empty the Command
//     Center's calendar panel on a teacher's machine.
//   * Because the payload carries a numeric `__v`, Store's migration contract
//     reads it back at THAT version (rule 2's gvb-save exception), not as
//     version 0. So the identity `migrate` below never rewrites anything; the
//     real isValid/migrate pair still runs here, on every load, exactly as it
//     did before — including on a current-version blob, which is the case
//     Store's own version machinery would have skipped.
//   * The blocked-storage probe is Store's now (`Store.isBlocked()`), and its
//     in-memory fallback replaces this file's `mem`. `isMemoryOnly` still
//     answers the same question, so 032's storage warning is unchanged.

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

/* The migrate hook Store's contract requires. It is the identity function on
   purpose: a caller that passes no `migrate` at all is telling Store it can
   only read its own current version, so an older payload would be refused
   before this file ever saw it. Validation and the real v1 -> v2 upgrade stay
   in get(), below, where they run on every load rather than only on one that
   Store judged to be behind. */
const keepWhateverIsThere = (fromVersion, cal) => cal;

/**
 * `seed` is a zero-arg function returning a fresh default calendar. It's
 * called lazily — only when there's nothing usable on disk — so callers
 * don't build seed data on every load.
 */
export function createStore(seed) {
  function get() {
    const stored = Store.get(KEY, {
      version: VERSION,
      migrate: keepWhateverIsThere,
      default: null,
    });
    if (!isValid(stored)) return seed();
    return migrate(stored);
  }

  function set(cal) {
    return Store.set(KEY, cal, { raw: true }).ok;
  }

  function clear() {
    Store.remove(KEY);
  }

  return { get, set, clear, get isMemoryOnly() { return Store.isBlocked(); } };
}
