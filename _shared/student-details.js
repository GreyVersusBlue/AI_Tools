// student-details.js — read-only access to the per-student detail Class Roster
// Hub keeps beside the shared roster.
//
// Lives in _shared/ because two tools now read it: the Name Picker (through
// Tools/name-picker/np-details.js, which re-exports this file so its own import
// path and test suite stay put) and the Behavior & Points Tracker.
//
// The rosters themselves live in `np_rosters` as arrays of plain name strings,
// and fifteen tools depend on that shape, so Class Roster Hub parks the richer
// record in a sidecar key (`crh_students_v1`) instead of changing it. This file
// is the Name Picker's side of that arrangement: it reads the sidecar, never
// writes it, and degrades to "no detail" for every student it cannot match. A
// teacher who has never opened Class Roster Hub sees no change anywhere.
//
// The only two fields the Name Picker uses are the two that pay off the moment
// a name lands on a projector:
//
//   preferred  what the student is actually called — "AJ", not "Aiden"
//   say        how to say the name, spelled out — "yoo-SOOF"
//
// Matching is by name, not by id, because the sidecar's ids do not exist
// anywhere in `np_rosters` and the Name Picker only ever has a name string in
// hand. `normalize()` is deliberately the same shape as Class Roster Hub's own
// key so the two agree on what counts as the same name.
//
// A third field, the stable `id`, is exposed separately by parseIds/lookupId
// rather than through parseDetails: the detail lookup deliberately drops a
// student who has neither a preferred name nor a pronunciation (there is
// nothing to carry), but a tool following a rename needs the id of *every*
// student on the roster, including the plain ones.
//
// DOM-free and storage-injectable, same as np-store.js — test/smoke.mjs drives
// it under plain Node.

export const DETAILS_KEY = "crh_students_v1";

/** Case- and whitespace-insensitive. Matches Class Roster Hub's `normKey`. */
export function normalize(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Turn the sidecar's stored JSON into `{ rosters: { <roster>: { <norm name>:
 * {preferred, say} } }, order: [<roster>] }`.
 *
 * Never throws: a missing, truncated, or hand-edited key reads as empty, which
 * is the same as "this teacher does not use Class Roster Hub".
 */
export function parseDetails(raw) {
  const empty = { rosters: {}, order: [] };
  if (!raw) return empty;
  let db;
  try { db = JSON.parse(raw); } catch (e) { return empty; }
  if (!isObj(db) || !isObj(db.rosters)) return empty;

  const out = { rosters: {}, order: [] };
  for (const [rosterName, entry] of Object.entries(db.rosters)) {
    if (!isObj(entry) || !Array.isArray(entry.students)) continue;
    const byName = {};
    for (const s of entry.students) {
      if (!isObj(s) || typeof s.name !== "string") continue;
      const key = normalize(s.name);
      if (!key) continue;
      const preferred = typeof s.preferred === "string" ? s.preferred.trim().slice(0, 60) : "";
      const say = typeof s.say === "string" ? s.say.trim().slice(0, 60) : "";
      if (!preferred && !say) continue;   // nothing worth carrying
      byName[key] = { preferred, say };
    }
    if (Object.keys(byName).length) {
      out.rosters[rosterName] = byName;
      out.order.push(rosterName);
    }
  }
  return out;
}

/** `parseDetails` against an injectable localStorage-shaped object. */
export function loadDetails(storage) {
  let raw = null;
  try { raw = storage && storage.getItem ? storage.getItem(DETAILS_KEY) : null; }
  catch (e) { return { rosters: {}, order: [] }; }
  return parseDetails(raw);
}

/**
 * Detail for one student, or null.
 *
 * `rosterName` is checked first so two classes with a "Sam" who goes by
 * different things do not collide; without a match there — the usual case,
 * since names can be typed straight into the Name Picker without ever being a
 * saved roster — it falls back to the first roster that knows the name.
 */
export function lookupDetail(parsed, name, rosterName) {
  if (!parsed || !parsed.rosters) return null;
  const key = normalize(name);
  if (!key) return null;
  if (rosterName && parsed.rosters[rosterName] && parsed.rosters[rosterName][key]) {
    return parsed.rosters[rosterName][key];
  }
  for (const r of parsed.order) {
    if (r === rosterName) continue;
    if (parsed.rosters[r][key]) return parsed.rosters[r][key];
  }
  return null;
}

/**
 * How a picked student should be shown.
 *
 * The preferred name becomes the big name — that is the whole point of
 * recording it — and the name on the roster drops to a subtitle so the teacher
 * can still tie it back to the gradebook. With no detail on file, the roster
 * name is the big name and there is no subtitle, which is exactly what the tool
 * did before this file existed.
 */
export function displayName(name, detail) {
  const d = detail || {};
  const preferred = d.preferred && normalize(d.preferred) !== normalize(name) ? d.preferred : "";
  return {
    big: preferred || name,
    sub: preferred ? name : "",
    say: d.say || ""
  };
}

/* ── stable ids ────────────────────────────────────────────────────────────
   Class Roster Hub mints an id per student and keeps it across a rename — its
   `syncRecords()` re-matches a vanished name by sorted-token key, so editing
   "Smith, John" into "John Smith" keeps the same record. A tool that keys its
   own per-student data by name can use that to follow the rename instead of
   orphaning everything the student had. Unlike the detail lookup above, this
   keeps every student, whether or not they carry a preferred name. */

/** `{ rosters: { <roster>: { <norm name>: id } }, order: [<roster>] }`. */
export function parseIds(raw) {
  const empty = { rosters: {}, order: [] };
  if (!raw) return empty;
  let db;
  try { db = JSON.parse(raw); } catch (e) { return empty; }
  if (!isObj(db) || !isObj(db.rosters)) return empty;

  const out = { rosters: {}, order: [] };
  for (const [rosterName, entry] of Object.entries(db.rosters)) {
    if (!isObj(entry) || !Array.isArray(entry.students)) continue;
    const byName = {};
    for (const s of entry.students) {
      if (!isObj(s) || typeof s.name !== "string" || typeof s.id !== "string" || !s.id) continue;
      const key = normalize(s.name);
      if (key) byName[key] = s.id;
    }
    if (Object.keys(byName).length) {
      out.rosters[rosterName] = byName;
      out.order.push(rosterName);
    }
  }
  return out;
}

/** `parseIds` against an injectable localStorage-shaped object. */
export function loadIds(storage) {
  let raw = null;
  try { raw = storage && storage.getItem ? storage.getItem(DETAILS_KEY) : null; }
  catch (e) { return { rosters: {}, order: [] }; }
  return parseIds(raw);
}

/** Stable id for one student, or null. Same roster-first fallback as lookupDetail. */
export function lookupId(parsed, name, rosterName) {
  if (!parsed || !parsed.rosters) return null;
  const key = normalize(name);
  if (!key) return null;
  if (rosterName && parsed.rosters[rosterName] && parsed.rosters[rosterName][key]) {
    return parsed.rosters[rosterName][key];
  }
  for (const r of parsed.order) {
    if (r === rosterName) continue;
    if (parsed.rosters[r][key]) return parsed.rosters[r][key];
  }
  return null;
}

export default {
  DETAILS_KEY, normalize, parseDetails, loadDetails, lookupDetail, displayName,
  parseIds, loadIds, lookupId,
};
