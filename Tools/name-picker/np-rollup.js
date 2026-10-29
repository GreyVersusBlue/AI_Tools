// np-rollup.js — the Name Picker's per-day record of the picks the 500-entry history window has let go.
//
// np_history keeps the last 500 picks in detail (name, time, prompt) and np-store slices anything older on every
// write. np_daily keeps what that slice used to throw away, as counts: { days: { 'YYYY-MM-DD': { <key>: n } },
// who: { <key>: last name seen } }. <key> is the student's id from the Class Roster Hub sidecar when idOf(name) finds
// one, and 'n:' plus the normalised name when it does not — so a preferred name or a rename keeps its history, and a
// name nobody has an id for still counts. An entry is in np_history or in np_daily, never both: fold() is called with
// exactly the entries that left the window, so the two never need reconciling and view() just adds them.
//
// Pure: no storage, no DOM, no clock. Every function returns a new document and leaves its arguments alone.

export const MAX_DAYS = 400;     // days kept; older days are pruned (the year rollover empties the key anyway)
export const MAX_WHO = 4000;     // names remembered, the same ceiling np_stats has
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const count = n => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The same rule student-details uses to decide two spellings are one name. */
export function normalize(name) {
  return String(name == null ? "" : name).replace(/\s+/g, " ").trim().toLowerCase();
}

/** The rollup key for a name: the student's id, else 'n:' + the normalised name. null for a blank name. */
export function keyFor(name, idOf) {
  const norm = normalize(name);
  if (!norm) return null;
  const id = typeof idOf === "function" ? idOf(name) : null;
  return typeof id === "string" && id ? id : "n:" + norm;
}

export const blank = () => ({ days: {}, who: {} });

/** Validate and clean a stored document: a bad day or count goes, the rest stays. */
export function fix(doc) {
  const out = blank();
  if (!isObj(doc)) return out;
  if (isObj(doc.days)) {
    for (const [day, cells] of Object.entries(doc.days)) {
      if (day !== "" && !DAY.test(day)) continue;
      if (!isObj(cells)) continue;
      const row = {};
      for (const [key, n] of Object.entries(cells)) {
        const c = count(n);
        if (key && c) row[key] = c;
      }
      if (Object.keys(row).length) out.days[day] = row;
    }
  }
  if (isObj(doc.who)) {
    for (const [key, name] of Object.entries(doc.who)) {
      if (typeof name !== "string" || !name.trim() || !key) continue;
      out.who[key] = name.trim().slice(0, 120);
      if (Object.keys(out.who).length >= MAX_WHO) break;
    }
  }
  return prune(out);
}

/** Keep the latest `maxDays` dated days (and the undated bucket); a name nobody counts any more goes from `who`. */
export function prune(doc, maxDays = MAX_DAYS) {
  const days = Object.keys(doc.days).filter(d => d !== "").sort();
  const drop = new Set(days.slice(0, Math.max(0, days.length - maxDays)));
  const out = blank();
  const live = new Set();
  for (const [day, cells] of Object.entries(doc.days)) {
    if (drop.has(day)) continue;
    out.days[day] = { ...cells };
    Object.keys(cells).forEach(k => live.add(k));
  }
  for (const [key, name] of Object.entries(doc.who)) if (live.has(key)) out.who[key] = name;
  return out;
}

/** Add history entries (`{name, date?}`) to a rollup. Returns a new document. */
export function fold(doc, entries, idOf) {
  const out = { days: {}, who: { ...(doc && doc.who) } };
  for (const [day, cells] of Object.entries((doc && doc.days) || {})) out.days[day] = { ...cells };
  for (const e of entries || []) {
    if (!isObj(e)) continue;
    const key = keyFor(e.name, idOf);
    if (!key) continue;
    const day = DAY.test(e.date) ? e.date : "";
    const row = out.days[day] || (out.days[day] = {});
    row[key] = (row[key] || 0) + 1;
    out.who[key] = String(e.name).trim().slice(0, 120);
  }
  return prune(out);
}

/** Two rollups as one: the cells add (how np_stats already merges a backup into what is there). */
export function merge(a, b) {
  const out = { days: {}, who: { ...(a && a.who), ...(b && b.who) } };
  for (const src of [a, b]) {
    for (const [day, cells] of Object.entries((src && src.days) || {})) {
      const row = out.days[day] || (out.days[day] = {});
      for (const [k, n] of Object.entries(cells)) row[k] = (row[k] || 0) + n;
    }
  }
  return prune(out);
}

/** The rollup plus the live history window as one `{ days: { day: { key: n } }, who }`, for a reader that wants all of it. */
export function view(doc, history, idOf) {
  return fold(fix(doc), (history || []).filter(isObj), idOf);
}

/**
 * The page's save step. `history` is the in-memory list, `rolledUp` how many entries from its front were folded
 * already, `max` the window np-store keeps. Folds history[rolledUp .. length-max) once and says how far it got, so an
 * unsaved overflow is counted exactly once however many times the page saves. Returns `{ doc, rolledUp }`.
 */
export function foldOverflow(doc, history, rolledUp, max, idOf) {
  const over = history.length - max;
  if (over <= rolledUp) return { doc, rolledUp };
  return { doc: fold(doc, history.slice(rolledUp, over), idOf), rolledUp: over };
}

/** Total picks per key across every day of a document (or a view). */
export function totals(doc) {
  const out = {};
  for (const cells of Object.values((doc && doc.days) || {})) for (const [k, n] of Object.entries(cells)) out[k] = (out[k] || 0) + n;
  return out;
}

export default { MAX_DAYS, MAX_WHO, normalize, keyFor, blank, fix, prune, fold, foldOverflow, merge, view, totals };
