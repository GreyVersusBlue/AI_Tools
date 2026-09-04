/* media-db.js — the site's one IndexedDB blob store, and the one image
   downscaler, so that a photo a teacher adds stops being a base64 string in
   localStorage.

   Why this exists. Nine tools base64 an image into localStorage (005, 015,
   019, 028, 041, 042, 056, 071, 080) and share a ~5 MB ceiling with every
   roster, rubric and setting on the site; a data URL is ~33% larger than the
   bytes it carries, so the encoding is itself part of the problem. Exactly one
   tool got this right — the Blank Map Generator keeps downloaded map images as
   Blobs in IndexedDB (bmg-map-cache.js) — and that file is cited across the
   planning notes as "the pattern", by tools that then went and wrote a data
   URL anyway. This is that pattern, generalised, plus the downscaler that
   three tools had already copy-pasted from each other (Tools/timeline-builder/
   tlb-photo.js at 480 px, Tools/seating-chart/scg-photo.js at 160 px, 028
   inline at 1600 px — three sizes, one identical function).

   WHAT IS STORED, AND WHERE.

     One database, `gvb-media`, one object store, `blobs`, keyPath `id`. Tools
     share it through a NAMESPACE — MediaDB.store({ ns: 'seating' }) — which is
     a prefix on the id, not a separate database. One database means one row in
     _shared/tool-registry.js, which means 009 Backup & Restore names it, backs
     it up and can clear it at year end. Nine databases would mean nine rows and
     nine chances to forget one, which is the failure the registry exists to end.

     `store({ db, store })` also takes a database of its own, and there is one
     caller: bmg-maps. Its records were written before this module existed, so
     its database name, store name and keyPath are a contract with what is
     already on a teacher's disk — renaming any of the three would not migrate
     those maps, it would hide them. A NEW tool has no such history and belongs
     in `gvb-media` under a namespace.

   RECORDS ARE FLAT: { id, blob, size, type, savedAt, ...meta }. The obvious
   shape is { id, blob, meta: {...} }, and it is wrong here for the same reason:
   bmg's existing records are flat ({ id, title, blob, mime, width, height,
   attribution, cachedAt }), so a nested envelope would leave every cached map
   readable only through a migration this module would have to carry forever.
   Flat, the old records ARE valid records — nothing to migrate, and that was
   checked against a real cache rather than assumed. The module's own four
   fields are written last and win a name collision.

   A FAILED WRITE IS NEVER SILENT, the same rule _shared/store.js holds for
   localStorage: put() rejects, with a message written to be shown to a teacher
   rather than logged, and `err.quota === true` when the browser is out of
   room. Reads are the opposite — a missing or unopenable database reads as
   "nothing stored", because a tool whose photos are gone should still open.

   Blobs, not data URLs, on the way in and out. A Blob is displayed with
   URL.createObjectURL(blob) — revoke it when the element goes away — and only
   an export needs the base64 form (009 already encodes and decodes blobs for
   its backup file; toDataUrl() here is for a tool's own JSON export).

   Plain global script, not an ES module, for the reason state-link.js and
   store.js give: about half this site's tools use `<script type="module">` and
   half use classic scripts, and one file cannot use `export` and plain-script
   syntax without a parse error under one of them. A module caller reads
   window.MediaDB instead of importing it.

   Not in scope, on purpose: no LRU, no eviction, no size cap. This module
   reports usage() and lets the tool decide — a cache of maps that re-download
   and a folder of student photos that do not are not the same data, and only
   the tool knows which it is holding. */
(function (global) {
  'use strict';

  var DEFAULT_DB = 'gvb-media';
  var DEFAULT_STORE = 'blobs';
  var DB_VERSION = 1;

  var opened = {};        // "db/store" -> Promise<IDBDatabase>

  /* ---- availability --------------------------------------------------- */

  function hasIdb() {
    try { return !!global.indexedDB; } catch (e) { return false; }
  }

  /* ---- errors that are meant to be read ------------------------------- */

  /* The union of the names browsers actually use, as in store.js: they
     disagree about which they set, and a check that misses one reports "some
     other error" for a disk that is simply full. */
  function isQuotaError(e) {
    if (!e) return false;
    return e.name === 'QuotaExceededError' ||
           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           e.code === 22 || e.code === 1014;
  }

  function writeError(e) {
    var err;
    if (isQuotaError(e)) {
      err = new Error('There is no room left in this browser’s storage for this site. ' +
        'Open Backup & Restore to export and clear what you no longer need, then try ' +
        'again — until you do, this image is not being kept.');
      err.quota = true;
    } else {
      err = new Error('This browser would not save that image (' +
        ((e && e.name) || 'unknown error') + '). It stays on screen, but it will be ' +
        'gone when you close the tab.');
      err.quota = false;
    }
    err.cause = e;
    return err;
  }

  /* ---- pure helpers, so the id maths is testable without a browser ---- */

  /** The on-disk key for a caller's id inside a namespace. */
  function nsKey(ns, id) {
    if (typeof id !== 'string' || !id) throw new Error('MediaDB: an id must be a non-empty string.');
    if (!ns) return id;
    return ns + '/' + id;
  }

  /** The caller's id back out of an on-disk key, or null if it is not ours.
      An id may itself contain "/" — only the namespace prefix is removed. */
  function unNsKey(ns, key) {
    if (typeof key !== 'string') return null;
    if (!ns) return key;
    var p = ns + '/';
    return key.indexOf(p) === 0 ? key.slice(p.length) : null;
  }

  /** The record put() writes. Separate from the IndexedDB call so a test can
      assert the shape — including that the module's own fields win. */
  function buildRecord(key, blob, meta) {
    var rec = {};
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach(function (k) { rec[k] = meta[k]; });
    }
    rec.id = key;
    rec.blob = blob;
    rec.size = (blob && typeof blob.size === 'number') ? blob.size : 0;
    rec.type = (blob && blob.type) || (meta && meta.type) || '';
    rec.savedAt = Date.now();
    return rec;
  }

  /** A record for a listing: everything except the bytes. Listing 200 photos
      should not hold 200 blobs in memory to show their names. */
  function withoutBlob(rec, ns) {
    var out = {};
    Object.keys(rec).forEach(function (k) { if (k !== 'blob') out[k] = rec[k]; });
    out.id = unNsKey(ns, rec.id);
    return out;
  }

  /** Long-edge fit, the identical maths the three copied downscalers used:
      never scale up, never round to zero. */
  function fitDimensions(w, h, maxDim) {
    w = Math.max(0, Number(w) || 0);
    h = Math.max(0, Number(h) || 0);
    if (!w || !h) return { w: 0, h: 0 };
    var scale = Math.min(1, maxDim / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  }

  /* ---- opening -------------------------------------------------------- */

  /* `name` and `storeName` are this module's parameters, never its own
     constants — which is also what keeps check-registry.mjs's call-site scan
     honest: a lower-case argument to indexedDB.open() is a generic helper
     being handed a database by its caller, exactly as store.js is for
     localStorage. The literal names live at the call sites (MediaDB.store),
     which is where that script reads them. */
  function openDb(name, storeName) {
    var cacheKey = name + '/' + storeName;
    if (opened[cacheKey]) return opened[cacheKey];
    opened[cacheKey] = new Promise(function (resolve, reject) {
      if (!hasIdb()) { reject(new Error('indexedDB unavailable')); return; }
      var req;
      try { req = global.indexedDB.open(name, DB_VERSION); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('indexedDB blocked')); };
    });
    /* A rejected open must not be cached forever: a browser that refused once
       because another tab held an upgrade will open fine on the next try. */
    opened[cacheKey]['catch'](function () { delete opened[cacheKey]; });
    return opened[cacheKey];
  }

  function tx(db, storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  /* ---- one handle over one (database, store, namespace) --------------- */

  function makeStore(opts) {
    opts = opts || {};
    var dbName = opts.db || DEFAULT_DB;
    var storeName = opts.store || DEFAULT_STORE;
    var ns = opts.ns || '';
    if (ns.indexOf('/') !== -1) throw new Error('MediaDB: a namespace may not contain "/".');

    function open() { return openDb(dbName, storeName); }

    var api = {
      db: dbName,
      store: storeName,
      ns: ns,

      /** Whether this browser will open the database at all. Never throws. */
      isAvailable: function () {
        return open().then(function () { return true; }, function () { return false; });
      },

      /** Writes one blob. Rejects — loudly, with a message meant to be shown —
          when the browser refuses, because a photo that silently did not save
          is a photo the teacher believes they have. */
      put: function (id, blob, meta) {
        var key;
        try { key = nsKey(ns, id); } catch (e) { return Promise.reject(e); }
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var t;
            try { t = db.transaction(storeName, 'readwrite'); }
            catch (e) { reject(writeError(e)); return; }
            try { t.objectStore(storeName).put(buildRecord(key, blob, meta)); }
            catch (e) { reject(writeError(e)); return; }
            t.oncomplete = function () { resolve(true); };
            t.onerror = function () { reject(writeError(t.error)); };
            t.onabort = function () { reject(writeError(t.error)); };
          });
        }, function (e) { return Promise.reject(writeError(e)); });
      },

      /** The whole record, blob included, or null. Never rejects: "no
          database" and "no such id" are the same answer to a reader. */
      get: function (id) {
        var key;
        try { key = nsKey(ns, id); } catch (e) { return Promise.resolve(null); }
        return open().then(function (db) {
          return new Promise(function (resolve) {
            var req = tx(db, storeName, 'readonly').get(key);
            req.onsuccess = function () {
              if (!req.result) { resolve(null); return; }
              /* A COPY, with the id in the caller's terms. Rewriting
                 req.result.id in place would be invisible in a browser — a
                 real IndexedDB hands back a structured clone — and destructive
                 anywhere the record is shared, which is how the suite's fake
                 store caught it: the namespace prefix was gone from the record
                 the next list() had to match on. */
              var rec = {};
              Object.keys(req.result).forEach(function (k) { rec[k] = req.result[k]; });
              rec.id = unNsKey(ns, rec.id);
              resolve(rec);
            };
            req.onerror = function () { resolve(null); };
          });
        }, function () { return null; });
      },

      /** Just the bytes, or null. */
      getBlob: function (id) {
        return api.get(id).then(function (rec) { return rec ? rec.blob : null; });
      },

      /** Every record in this namespace WITHOUT its blob, newest first. */
      list: function () {
        return open().then(function (db) {
          return new Promise(function (resolve) {
            var req = tx(db, storeName, 'readonly').getAll();
            req.onsuccess = function () {
              var out = [];
              (req.result || []).forEach(function (rec) {
                if (!rec || unNsKey(ns, rec.id) === null) return;   // another namespace's
                out.push(withoutBlob(rec, ns));
              });
              out.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
              resolve(out);
            };
            req.onerror = function () { resolve([]); };
          });
        }, function () { return []; });
      },

      remove: function (id) {
        var key;
        try { key = nsKey(ns, id); } catch (e) { return Promise.resolve(false); }
        return open().then(function (db) {
          return new Promise(function (resolve) {
            var t = db.transaction(storeName, 'readwrite');
            t.objectStore(storeName)['delete'](key);
            t.oncomplete = function () { resolve(true); };
            t.onerror = function () { resolve(false); };
          });
        }, function () { return false; });
      },

      /** Everything in THIS namespace. A namespaced handle never clears the
          whole store — the shared database is the point. */
      clear: function () {
        return api.list().then(function (recs) {
          return Promise.all(recs.map(function (r) { return api.remove(r.id); }))
            .then(function () { return recs.length; });
        });
      },

      /** { count, bytes } for this namespace, from the records' own stored
          sizes — no blob is read. This is what this store holds, NOT what the
          origin is using; navigator.storage.estimate() answers that, and 009
          already shows it. */
      usage: function () {
        return api.list().then(function (recs) {
          var bytes = 0;
          recs.forEach(function (r) { bytes += Number(r.size) || 0; });
          return { count: recs.length, bytes: bytes };
        });
      }
    };
    return api;
  }

  /* ---- images --------------------------------------------------------- */

  function decode(file) {
    /* createImageBitmap decodes off the main thread and skips the base64
       round trip the three copied versions all did (FileReader -> data URL ->
       Image.src). The fallback is that same path, for a browser without it. */
    if (typeof global.createImageBitmap === 'function') {
      return global.createImageBitmap(file)['catch'](function () { return viaImage(file); });
    }
    return viaImage(file);
  }

  function viaImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that image file.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Could not decode that image file.')); };
        img.onload = function () { resolve(img); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('Could not encode that image.'));
        }, type, quality);
        return;
      }
      try {
        resolve(dataUrlToBlob(canvas.toDataURL(type, quality)));
      } catch (e) { reject(new Error('Could not encode that image.')); }
    });
  }

  function dataUrlToBlob(dataUrl) {
    var comma = dataUrl.indexOf(',');
    var head = dataUrl.slice(0, comma);
    var m = /data:([^;,]+)/.exec(head);
    var type = m ? m[1] : '';
    var bin = global.atob(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }

  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Could not read that image.')); };
      fr.onload = function () { resolve(fr.result); };
      fr.readAsDataURL(blob);
    });
  }

  /**
   * The one downscaler. Resolves to { blob, dataUrl, width, height, type },
   * where the form the caller did not ask for is null.
   *
   *   maxDim   long edge in px. There is no right default — the three copies
   *            this replaces used 160 (a desk thumbnail), 480 (a timeline
   *            photo) and 1600 (a document a class reads) — so a caller that
   *            means something other than a 1600 px document says so.
   *   quality  JPEG quality, 0–1.
   *   type     output mime; 'image/jpeg' unless the source is a PNG the caller
   *            wants kept (transparency does not survive JPEG).
   *   as       'blob' (default, for this store) or 'dataUrl' (for a tool still
   *            saving into localStorage, or building a JSON export).
   */
  function downscaleImage(file, opts) {
    opts = opts || {};
    var maxDim = Number(opts.maxDim) || 1600;
    var quality = typeof opts.quality === 'number' ? opts.quality : 0.8;
    var type = opts.type || 'image/jpeg';
    var wantUrl = opts.as === 'dataUrl';

    return decode(file).then(function (src) {
      var sw = src.width, sh = src.height;
      var fit = fitDimensions(sw, sh, maxDim);
      if (!fit.w || !fit.h) throw new Error('Could not read that image’s size.');
      var canvas = document.createElement('canvas');
      canvas.width = fit.w; canvas.height = fit.h;
      canvas.getContext('2d').drawImage(src, 0, 0, fit.w, fit.h);
      if (typeof src.close === 'function') src.close();   // an ImageBitmap holds memory
      return canvasToBlob(canvas, type, quality).then(function (blob) {
        var out = { blob: wantUrl ? null : blob, dataUrl: null, width: fit.w, height: fit.h, type: blob.type || type };
        if (!wantUrl) return out;
        return toDataUrl(blob).then(function (url) { out.dataUrl = url; return out; });
      });
    });
  }

  /* ---- the module ------------------------------------------------------ */

  var shared = makeStore({});

  global.MediaDB = {
    DEFAULT_DB: DEFAULT_DB,
    DEFAULT_STORE: DEFAULT_STORE,
    DB_VERSION: DB_VERSION,

    /** A handle over the shared database under a namespace, or — for bmg-maps
        alone — over a database of its own. */
    store: makeStore,

    /* The unnamespaced shared store, for a caller with one thing to keep. */
    isAvailable: shared.isAvailable,
    put: shared.put,
    get: shared.get,
    getBlob: shared.getBlob,
    list: shared.list,
    remove: shared.remove,
    clear: shared.clear,
    usage: shared.usage,

    downscaleImage: downscaleImage,
    toDataUrl: toDataUrl,
    dataUrlToBlob: dataUrlToBlob,

    /* pure, and exported because the suite asserts them directly */
    fitDimensions: fitDimensions,
    nsKey: nsKey,
    unNsKey: unNsKey,
    buildRecord: buildRecord,
    withoutBlob: withoutBlob,
    isQuotaError: isQuotaError
  };
})(window);
