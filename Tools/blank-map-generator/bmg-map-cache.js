// bmg-map-cache.js — IndexedDB cache for downloaded map image blobs, so a
// map only has to come from Wikimedia Commons once and works offline after.
//
// This file used to BE the site's IndexedDB pattern — hand-rolled open/get/
// put/list/delete against `bmg-maps` — and every planning note that said
// "images belong in IndexedDB" pointed at it. Path 4 P3 lifted it into
// _shared/media-db.js, so what is left here is the adapter: the names this
// tool's callers already use, over the shared store.
//
// The database stays `bmg-maps`, the object store stays `images`, the keyPath
// stays `id`. Those three are a contract with what is already on a teacher's
// disk — moving the cache into the shared `gvb-media` database would not
// migrate their maps, it would hide them, and they are the one kind of data on
// this site that a teacher may have gigabytes of. media-db.js keeps its
// records flat for exactly this reason, so every record written before it
// existed is still a valid record: nothing to migrate, nothing to read twice.
//
// window.MediaDB rather than an import: it is a classic script (half this
// site's tools cannot use `import`), loaded by 046 before this module. It is
// declared in eslint.config.js's SITE_GLOBALS, where the shared globals live.

const DB_NAME = "bmg-maps";
const STORE = "images";

const maps = MediaDB.store({ db: DB_NAME, store: STORE });

export async function isAvailable() {
  return maps.isAvailable();
}

/** Returns the cached record for a map id (Commons file title), or null. */
export async function getCachedMap(id) {
  return maps.get(id);
}

/** Stores a whole record as built by bmg-commons.js's fetchMapImage() —
    { id, title, blob, mime, width, height, attribution, cachedAt }. The blob
    is the record's own field, so it is handed across separately and the rest
    rides along as metadata; media-db writes it back out flat. */
export async function putCachedMap(record) {
  const { id, blob, ...meta } = record;
  return maps.put(id, blob, meta);
}

/** Lightweight listing (no blobs) for a "recently used maps" picker. */
export async function listCachedMaps() {
  const recs = await maps.list();
  return recs.map(r => ({
    id: r.id, title: r.title, width: r.width, height: r.height,
    mime: r.mime, attribution: r.attribution, cachedAt: r.cachedAt,
  }));
}

export async function deleteCachedMap(id) {
  await maps.remove(id);
}
