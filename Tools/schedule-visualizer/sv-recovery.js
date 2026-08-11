// sv-recovery.js — a rolling ring of automatic recovery points for the School
// Layout Visualizer, plus the "did the last session end cleanly?" flag that
// decides whether to offer one on load.
//
// Why this exists. The tool already autosaves the blueprint to localStorage
// 800ms after every change, which covers "I closed the tab". What it did not
// cover is everything else that can happen to the biggest, most laboriously
// built artifact on the site:
//
//   - the autosaved payload is there but unreadable (a half-written value, a
//     browser that evicted part of the origin's storage, a schema mistake) —
//     the loader logged a console warning and opened an empty editor, and the
//     next keystroke's autosave overwrote whatever was left;
//   - a quota-exceeded write means the last N minutes never landed at all;
//   - a destructive action (import over, reset, a grid resize gone wrong)
//     that isn't one of the two places wired to the single "auto" snapshot
//     slot;
//   - the browser or the machine dies, and the teacher has no idea whether
//     what they see on the next open is current.
//
// Storage is IndexedDB, not localStorage, on purpose (P12). A full project
// carries traced floor-plan images; three generations of one in localStorage
// would compete with the live autosave for the same ~5MB and could itself be
// the thing that pushes a write over quota. IndexedDB has room, and a
// recovery ring that can't be written is worse than no ring at all.
//
// Everything here degrades to a no-op if IndexedDB is unavailable (private
// windows, storage switched off): the caller's live autosave is unaffected.

const DB_NAME = 'stviz-recovery';
const DB_VERSION = 1;
const STORE = 'points';

/** How many generations to keep. Three covers "the mistake was a while ago"
 *  without turning the ring into an unbounded archive — named snapshots are
 *  the deliberate-archive feature; this one is the safety net. */
export const MAX_POINTS = 3;

/** The session-open marker. localStorage, not IndexedDB: it has to be written
 *  and cleared synchronously at load and at pagehide, which IndexedDB can't
 *  promise during a teardown. It holds no project data — just a timestamp. */
export const SESSION_KEY = 'STVIZ_SESSION_OPEN_v1';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('indexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function isAvailable() {
  try { await openDB(); return true; } catch (e) { return false; }
}

/**
 * Writes one recovery point and trims the ring to MAX_POINTS, newest kept.
 * `data` is a serialized full project; `meta` carries the counts shown in the
 * picker so listing never has to parse a multi-megabyte payload.
 * Resolves to the stored record, or null if storage refused it.
 */
export async function putPoint(data, meta = {}) {
  let db;
  try { db = await openDB(); } catch (e) { return null; }
  const record = {
    id: 'rp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    savedAt: new Date().toISOString(),
    reason: meta.reason || 'periodic',
    rooms: Number(meta.rooms) || 0,
    groups: Number(meta.groups) || 0,
    floors: Number(meta.floors) || 0,
    data,
  };
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    return null;   // quota, or the store went away — the live autosave still ran
  }
  await trim();
  return record;
}

/** Newest first. Payloads are included — callers that only need the header
 *  should use listPointHeaders(). */
export async function listPoints() {
  let db;
  try { db = await openDB(); } catch (e) { return []; }
  const all = await new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  return all.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

/** Newest first, without the project payloads — what the picker renders. */
export async function listPointHeaders() {
  const points = await listPoints();
  return points.map(p => ({
    id: p.id, savedAt: p.savedAt, reason: p.reason,
    rooms: p.rooms, groups: p.groups, floors: p.floors,
    sizeBytes: (() => { try { return JSON.stringify(p.data).length * 2; } catch (e) { return 0; } })(),
  }));
}

export async function getPoint(id) {
  let db;
  try { db = await openDB(); } catch (e) { return null; }
  return new Promise((resolve) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function deletePoint(id) {
  let db;
  try { db = await openDB(); } catch (e) { return false; }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/** Drops everything past MAX_POINTS, oldest first. */
async function trim() {
  const points = await listPoints();
  for (const stale of points.slice(MAX_POINTS)) await deletePoint(stale.id);
}

export async function clearPoints() {
  const points = await listPoints();
  for (const p of points) await deletePoint(p.id);
}

/* ── session flag ─────────────────────────────────────────────────────────
   markSessionOpen() at boot, markSessionClosed() on pagehide. If a boot finds
   the flag already set, the previous session never got to its pagehide — a
   crash, a killed tab, a lost machine — which is exactly when a teacher wants
   to be told what the recovery ring is holding. ───────────────────────────*/

/** Returns the previous session's open-marker (or null) and re-arms it. */
export function markSessionOpen() {
  let previous = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) { try { previous = JSON.parse(raw); } catch (e) { previous = { at: null }; } }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ at: new Date().toISOString() }));
  } catch (e) { /* storage blocked — recovery just won't be offered */ }
  return previous;
}

export function markSessionClosed() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* nothing to do */ }
}
