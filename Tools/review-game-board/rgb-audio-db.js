// rgb-audio-db.js — IndexedDB storage for audio clips attached to a clue on
// the Quiz / Review Game Board.
//
// Why IndexedDB and not inline-on-the-clue (the pattern clue *images* use,
// see rgb-store.js / 030-review-game-board.html): a recording is a much
// worse fit for localStorage than a downscaled JPEG. A clue image is capped
// hard (1000px, JPEG 0.72) specifically so it survives inside a ~10 MB
// per-origin localStorage budget shared with every other saved board; a
// useful pronunciation or music-excerpt clip is routinely bigger than that
// on its own, and there is no equivalent "downscale" for audio that keeps it
// intelligible. IndexedDB carries a much larger, browser-managed quota, so
// clips live here and a clue just carries a small string id (`clue.audioId`)
// pointing at one.
//
// One DB, one object store, records keyed by an opaque id the caller
// generates (genId()) — same shape as bmg-map-cache.js / sv-recovery.js, the
// two existing small IndexedDB modules in this repo.
//
// Ownership: each clip is owned by exactly one clue on exactly one saved
// board. When a board that carries audio is duplicated in-app (edited, then
// saved under a new name — see 030-review-game-board.html's buildFromManualBtn
// handler), the new board gets its own fresh copies via duplicateClip()
// rather than sharing ids with the original. That is a deliberate choice:
// deleting a board deletes its own clips (rgb store's deleteBoardBtn handler
// walks the board's clues and calls deleteClip() on each audioId), and a
// shared-reference design would mean that could silently break another
// board's playback. See "Where the next round should pick up" in
// improvement prompts/030-review-game-board.md for the full writeup.

const DB_NAME = 'rgb-audio';
const DB_VERSION = 1;
const STORE = 'clips';

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
  try { await openDB(); return true; }
  catch (e) { return false; }
}

/** A fresh id for a new clip. Not a UUID — this only has to be unique within
    one board's clues, and Date.now() + a few random base36 chars is plenty. */
export function genId() {
  return 'clip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/** Stores (or overwrites) a clip under `id`. Overwriting is the normal path
    while a teacher is still editing a clue — re-recording before Save board
    reuses the same id instead of leaking a discarded take. */
export async function putClip(id, blob, meta = {}) {
  const db = await openDB();
  const record = {
    id,
    blob,
    mime: blob.type || meta.mime || 'audio/webm',
    sizeBytes: blob.size,
    createdAt: meta.createdAt || new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

/** The full record ({id, blob, mime, sizeBytes, createdAt}), or null. */
export async function getClip(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteClip(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Copies a clip's blob to a fresh id (or a caller-supplied one) so the copy
    is independently owned. Returns the new id, or null if the source clip
    doesn't exist (a board that references an already-deleted clip, e.g.). */
export async function duplicateClip(sourceId, newId) {
  const source = await getClip(sourceId);
  if (!source) return null;
  const id = newId || genId();
  await putClip(id, source.blob, { createdAt: new Date().toISOString() });
  return id;
}
