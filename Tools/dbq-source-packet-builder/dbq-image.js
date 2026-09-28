/* DBQ / Source Packet Builder — where source images are kept.

   Until Path 4 P4 an image source was a data: URL inside its packet's
   localStorage key (`dbq:data:<name>`), and a second full copy of it inside
   the source library (`dbq:bank`) once it was saved there. 056 never
   downscaled: a scanned document or a phone photo went in at full size, so a
   single real photo (3–5 MB, a third more as base64) was past the ~5 MB the
   whole site shares, and the save failed. Now the image is a Blob in the
   shared media store (_shared/media-db.js, database `gvb-media`, namespace
   `dbq`), and a source holds `idb:<id>`. 009 Backup & Restore backs `gvb-media`
   up by default.

   STILL NOT DOWNSCALED, on purpose. The crop tool prints an enlarged detail of
   a document, and a teacher's scan is kept exactly as it was uploaded — the
   crop and width are settings beside the untouched original, as they always
   were. IndexedDB has room for that; localStorage never did.

   OBJECT URLS, NOT A DATA-URL CACHE. 005 and 019 held every image in memory as
   a data URL, because their images are a few KB and every consumer needed the
   data URL synchronously. Neither is true here: an image is megabytes, and the
   editor, the crop tool and the printed packet only need something an <img>
   can show. So `hydrate()` makes one object URL per stored image (the Blob an
   IndexedDB read hands back is disk-backed, so this holds almost nothing in
   memory), and only the two routes that leave the browser — Export JSON and
   the share sheet's download — read the bytes, asynchronously, through
   `inline()`. An object URL is revoked when gc() deletes its record.

   IDS ARE THE CONTENT'S HASH. `h` + the first 128 bits of the image's SHA-256,
   so the same picture uploaded twice, saved to the library, copied into three
   packets and brought back by an imported file is one record, and a migration
   that runs twice stores nothing the second time. Where crypto.subtle is
   missing (a non-secure context), the id is random and nothing is
   deduplicated — the image is still kept.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE, `fromFile()` hands back the data URL
   itself and the page stores that, exactly as before; the page says so if the
   localStorage write then fails too. `store()` stops at the first failed write
   and leaves the rest inline, still saved, for the next load to try again.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/dbq-source-packet-builder/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var NS = 'dbq';
  var PREFIX = 'idb:';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  /* gc() leaves anything newer than this alone: an image another open tab has
     just stored but not yet written into its saved packet looks exactly like
     an orphan for the moment in between. */
  var GC_GRACE_MS = 10 * 60 * 1000;

  var urls = {};             // 'idb:<id>' -> object URL
  var missing = {};          // 'idb:<id>' -> true once a read found nothing
  var handle = null;

  function store() {
    if (!handle && global.MediaDB) handle = global.MediaDB.store({ ns: NS });
    return handle;
  }

  function isRef(v) { return typeof v === 'string' && REF_RE.test(v); }
  function isInline(v) { return typeof v === 'string' && v.slice(0, 11) === 'data:image/'; }

  /** What an <img src> gets: the data URL itself, the object URL of a stored
      image, or '' when there is nothing to show (not read yet, or gone). */
  function url(image) {
    if (isInline(image)) return image;
    if (isRef(image)) return urls[image] || '';
    return '';
  }

  /** A reference whose image is not in this browser. Only true once
      hydrate() has looked for it. */
  function isMissing(image) { return isRef(image) && !!missing[image]; }

  function randomId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return (b < 16 ? '0' : '') + b.toString(16);
    }).join('');
  }

  /** The id a blob is stored under: its content hash where the browser can
      compute one, otherwise a random id. */
  function idFor(blob) {
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle || typeof blob.arrayBuffer !== 'function') return Promise.resolve(randomId());
    return blob.arrayBuffer()
      .then(function (buf) { return subtle.digest('SHA-256', buf); })
      .then(function (d) { return 'h' + hex(d).slice(0, 32); }, function () { return randomId(); });
  }

  function remember(ref, blob) {
    if (!urls[ref]) urls[ref] = URL.createObjectURL(blob);
    delete missing[ref];
    return ref;
  }

  /** Store one blob; resolves to its reference. Rejects with MediaDB's
      teacher-readable message when the browser refuses. */
  function keep(blob) {
    var s = store();
    if (!s) return Promise.reject(new Error('The image store is not available on this page.'));
    return idFor(blob).then(function (id) {
      return s.put(id, blob, { tool: 'dbq-source-packet-builder' }).then(function () {
        return remember(PREFIX + id, blob);
      });
    });
  }

  /** A picked file -> the value for source.image: an `idb:` reference, or the
      data URL when IndexedDB would not take it (see the header). The file is
      kept as uploaded. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return keep(file)['catch'](function () { return global.MediaDB.toDataUrl(file); });
  }

  /** Read the images behind `refs` and give each an object URL. Resolves to
      the distinct references that have no image in this browser. */
  function hydrate(refs) {
    var s = store();
    var todo = [];
    Array.from(refs || []).forEach(function (r) {
      if (isRef(r) && !urls[r] && todo.indexOf(r) === -1) todo.push(r);
    });
    if (!todo.length) return Promise.resolve([]);
    function lost(ref) { missing[ref] = true; return ref; }
    if (!s) return Promise.resolve(todo.map(lost));
    return Promise.all(todo.map(function (ref) {
      return s.getBlob(ref.slice(PREFIX.length)).then(function (blob) {
        if (!blob) return lost(ref);
        remember(ref, blob);
        return null;
      }, function () { return lost(ref); });
    })).then(function (gone) { return gone.filter(Boolean); });
  }

  /** Move data: URL images into the store. `values` is every image value the
      caller holds; each distinct inline one is written once (by hash, so one
      already stored is simply the same record). Resolves to a map from data
      URL to reference, which the caller applies to FRESH copies of what it
      saves — not to the copies it read before these writes, which another tab
      could have changed in the meantime. The first write that fails stops the
      pass: that image and the rest stay inline, and the next load tries again. */
  function store_(values) {
    var s = store();
    var todo = [];
    (values || []).forEach(function (v) {
      if (isInline(v) && todo.indexOf(v) === -1) todo.push(v);
    });
    var map = {};
    if (!todo.length || !s) return Promise.resolve(map);
    return todo.reduce(function (p, dataUrl) {
      return p.then(function (go) {
        if (!go) return false;
        var blob;
        try { blob = global.MediaDB.dataUrlToBlob(dataUrl); } catch (e) { return true; }   // a malformed one stays as it is
        return keep(blob).then(function (ref) { map[dataUrl] = ref; return true; },
                               function () { return false; });
      });
    }, Promise.resolve(true)).then(function () { return map; });
  }

  /** The value as it leaves this browser: a data URL, or null for a reference
      with nothing behind it (a dangling `idb:` would name an image on the
      receiving device, or nothing). Reads the stored bytes, so it is async. */
  function inline(image) {
    if (isInline(image)) return Promise.resolve(image);
    if (!isRef(image)) return Promise.resolve(null);
    var s = store();
    if (!s) return Promise.resolve(null);
    return s.getBlob(image.slice(PREFIX.length)).then(function (blob) {
      return blob ? global.MediaDB.toDataUrl(blob) : null;
    })['catch'](function () { return null; });
  }

  /** Delete stored images nothing saved points at any more — replaced,
      removed, or in a deleted packet or library entry. `keepRefs` is every
      reference still in use. Run at boot only. */
  function gc(keepRefs) {
    var s = store();
    if (!s) return Promise.resolve(0);
    var keepSet = new Set(Array.from(keepRefs || []));
    var cutoff = Date.now() - GC_GRACE_MS;
    return s.list().then(function (recs) {
      var dead = recs.filter(function (r) {
        return !keepSet.has(PREFIX + r.id) && (Number(r.savedAt) || 0) < cutoff;
      });
      return Promise.all(dead.map(function (r) {
        var ref = PREFIX + r.id;
        if (urls[ref]) { URL.revokeObjectURL(urls[ref]); delete urls[ref]; }
        return s.remove(r.id);
      })).then(function () { return dead.length; });
    });
  }

  global.DbqImage = {
    NS: NS,
    isRef: isRef,
    isInline: isInline,
    isMissing: isMissing,
    url: url,
    fromFile: fromFile,
    hydrate: hydrate,
    store: store_,
    inline: inline,
    gc: gc
  };
})(window);
