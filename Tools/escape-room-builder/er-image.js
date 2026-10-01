/* Escape Room Builder — where station clue images are kept.

   Until Path 4 P4 a clue image was a data: URL inside the one localStorage
   key this tool writes (`escape-room-builder:rooms`), next to every other
   saved room, so a teacher with a few illustrated rooms was spending the
   ~5 MB the whole site shares on JPEGs. Now the image is a Blob in the shared
   media store (_shared/media-db.js, database `gvb-media`, namespace
   `escape-room`) and the station holds `idb:<id>`. 009 Backup & Restore backs
   `gvb-media` up by default.

   The downscaler that used to be inline in the page (canvas.toDataURL at
   0.6) is MediaDB.downscaleImage now, at the same 320 px and quality.

   WHY A DATA-URL CACHE AND NOT OBJECT URLS, as 005 did. A 320 px JPEG at 0.6
   is a few tens of KB (measured in test/smoke-images.mjs), and more to the
   point every consumer of the image needs the data URL itself, synchronously:
   the student link carries the image INSIDE the URL, because lock.html runs
   on a student's phone that has never seen this browser's IndexedDB, and the
   printed station cards and packet draw it. (A station's QR code never
   carries it; see stationPayloadFor in the page.) render() builds those links on every keystroke, and
   the share sheet's getState() is synchronous. An object URL would only move
   the base64 step into each of them. Only boot and a new image touch
   IndexedDB.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE, `fromFile()` hands back the data URL
   itself and the page stores that, exactly as before — the image is kept, in
   localStorage, and store.js says so if THAT write fails. `migrate()` tries
   again on the next load. Nothing is dropped on the floor.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/escape-room-builder/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 320;   // px, long edge — what the inline downscaler used
  var JPEG_QUALITY = 0.6;
  var NS = 'escape-room';
  var PREFIX = 'idb:';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  /* gc() leaves anything newer than this alone: an image another open tab has
     just stored but not yet written into its saved room looks exactly like an
     orphan for the moment in between. */
  var GC_GRACE_MS = 10 * 60 * 1000;

  var cache = {};            // 'idb:<id>' -> data URL
  var handle = null;

  function store() {
    if (!handle && global.MediaDB) handle = global.MediaDB.store({ ns: NS });
    return handle;
  }

  function isRef(v) { return typeof v === 'string' && REF_RE.test(v); }
  function isInline(v) { return typeof v === 'string' && v.slice(0, 11) === 'data:image/'; }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** What an <img src>, a link or a file gets: the image as a data URL, or ''
      for a reference with nothing behind it in this browser (a dangling
      `idb:` in a student link would point at nothing on a phone). */
  function src(image) {
    if (isInline(image)) return image;
    if (isRef(image)) return cache[image] || '';
    return '';
  }

  /** A stored image whose reference resolves to nothing here. */
  function isMissing(image) { return isRef(image) && !cache[image]; }

  function keep(blob, dataUrl) {
    var s = store();
    if (!s) return Promise.reject(new Error('The image store is not available on this page.'));
    var id = newId();
    return s.put(id, blob, { tool: 'escape-room-builder' }).then(function () {
      var ref = PREFIX + id;
      cache[ref] = dataUrl;
      return ref;
    });
  }

  /** A picked file -> the value for station.image: an `idb:` reference, or
      the data URL when IndexedDB would not take it (see the header). */
  function fromFile(file) {
    var M = global.MediaDB;
    return M.downscaleImage(file, { maxDim: MAX_DIMENSION, quality: JPEG_QUALITY }).then(function (out) {
      return M.toDataUrl(out.blob).then(function (dataUrl) {
        return keep(out.blob, dataUrl)['catch'](function () { return dataUrl; });
      });
    });
  }

  /** Every image value on every station of `rooms` (an array of rooms). */
  function imagesIn(rooms) {
    var out = [];
    (rooms || []).forEach(function (room) {
      ((room && room.stations) || []).forEach(function (st) {
        if (st && st.image) out.push(st.image);
      });
    });
    return out;
  }

  /** Read the images behind `refs` into the cache. Resolves to the distinct
      references that have no image in this browser. */
  function hydrate(refs) {
    var s = store();
    var todo = [];
    Array.from(refs || []).forEach(function (r) {
      if (isRef(r) && !cache[r] && todo.indexOf(r) === -1) todo.push(r);
    });
    if (!todo.length) return Promise.resolve([]);
    if (!s) return Promise.resolve(todo);
    return Promise.all(todo.map(function (ref) {
      return s.getBlob(ref.slice(PREFIX.length)).then(function (blob) {
        if (!blob) return ref;
        return global.MediaDB.toDataUrl(blob).then(function (url) { cache[ref] = url; return null; });
      })['catch'](function () { return ref; });
    })).then(function (missing) { return missing.filter(Boolean); });
  }

  /** Move every data: URL image in the rooms `getRooms()` returns into the
      store and replace it with a reference. Each distinct image is stored
      once — a room copied from another shares its images, and one already
      in the store (read into the cache by hydrate() first) is reused. The
      replacement is applied to what getRooms() returns AFTER the writes, so
      an edit that landed in the meantime is not overwritten with a stale
      copy; the caller saves. Resolves to how many stations now hold a reference instead. The
      first write that fails stops the pass: that image and the rest stay
      inline, still saved, and the next load tries again. */
  function migrate(getRooms) {
    var s = store();
    var urls = [];
    imagesIn(getRooms()).forEach(function (v) {
      if (isInline(v) && urls.indexOf(v) === -1) urls.push(v);
    });
    if (!urls.length || !s) return Promise.resolve(0);
    /* An image already in the store — hydrate() has read every one a saved
       room points at — is reused rather than stored again, so a room that
       comes back by link does not double what is on disk. */
    var refFor = {};
    Object.keys(cache).forEach(function (ref) {
      var i = urls.indexOf(cache[ref]);
      if (i !== -1) { refFor[urls[i]] = ref; urls.splice(i, 1); }
    });
    return urls.reduce(function (p, url) {
      return p.then(function (go) {
        if (!go) return false;
        var blob;
        try { blob = global.MediaDB.dataUrlToBlob(url); } catch (e) { return true; }   // a malformed one stays as it is
        return keep(blob, url).then(function (ref) { refFor[url] = ref; return true; },
                                    function () { return false; });
      });
    }, Promise.resolve(true)).then(function () {
      var moved = 0;
      (getRooms() || []).forEach(function (room) {
        ((room && room.stations) || []).forEach(function (st) {
          if (st && refFor[st.image]) { st.image = refFor[st.image]; moved++; }
        });
      });
      return moved;
    });
  }

  /** Delete stored images no saved room points at any more — replaced,
      removed, or on a deleted station or room. `keepRefs` is every reference
      still in use. Run at boot only. */
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
        delete cache[PREFIX + r.id];
        return s.remove(r.id);
      })).then(function () { return dead.length; });
    });
  }

  global.EscapeRoomImage = {
    MAX_DIMENSION: MAX_DIMENSION,
    JPEG_QUALITY: JPEG_QUALITY,
    NS: NS,
    isRef: isRef,
    isInline: isInline,
    isMissing: isMissing,
    src: src,
    imagesIn: imagesIn,
    fromFile: fromFile,
    hydrate: hydrate,
    migrate: migrate,
    gc: gc
  };
})(window);
