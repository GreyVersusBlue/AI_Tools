// bmg-map-cache.js — IndexedDB cache for downloaded map image blobs, so a
// map only has to come from Wikimedia Commons once and works offline after.

const DB_NAME = "bmg-maps";
const DB_VERSION = 1;
const STORE = "images";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("indexedDB unavailable")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
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

/** Returns the cached record for a map id (Commons file title), or null. */
export async function getCachedMap(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putCachedMap(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lightweight listing (no blobs) for a "recently used maps" picker. */
export async function listCachedMaps() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).map(r => ({
      id: r.id, title: r.title, width: r.width, height: r.height,
      mime: r.mime, attribution: r.attribution, cachedAt: r.cachedAt,
    })));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCachedMap(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
