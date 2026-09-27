/* Seating Chart Generator — where student photos are kept.

   Until Path 4 P4 a photo was a data: URL inside the one localStorage key this
   tool writes, so thirty faces a period shared the ~5 MB ceiling with every
   roster and rubric on the site, and every undo step held a copy of all of
   them. Now the image is a Blob in the shared media store
   (_shared/media-db.js, database `gvb-media`, namespace `seating`) and the
   chart holds `idb:<id>`, a reference of a few bytes. 009 Backup & Restore
   backs `gvb-media` up by default.

   The downscaler that used to live here was one of three copies of the same
   function; it is MediaDB.downscaleImage now, at this tool's 160 px.

   WHY A DATA-URL CACHE AND NOT OBJECT URLS. Desk thumbnails are ~5–10 KB
   each, so holding them as data URLs in memory costs nothing, and it keeps
   every consumer synchronous: rendering, printing, "Save to file" and the
   share sheet (which strips data: URLs from a link by policy and counts them)
   all read `src()` / `inline()` without awaiting anything, and there is no
   object URL to revoke. Only boot and a new photo touch IndexedDB.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE (a locked-down browser, a full disk),
   `fromFile()` hands back the data URL itself and the page stores that, which
   is exactly what it did before — the photo is still kept, in localStorage,
   and store.js still reports it if THAT write fails. `migrate()` tries again
   on the next load. Nothing is dropped on the floor.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   Browser-only (IndexedDB, canvas); the pure half — which strings are photos,
   which references a chart still holds — is in seating.mjs and unit-tested
   there, and the round trip is Tools/seating-chart/test/smoke-photos.mjs. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 160;   // px, long edge: a desk thumbnail, not a hero photo
  var JPEG_QUALITY = 0.75;
  var NS = 'seating';
  var PREFIX = 'idb:';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  /* gc() leaves anything newer than this alone: a photo another open tab has
     just stored but not yet written into its saved chart looks exactly like an
     orphan for the second or so in between. */
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

  /** What an <img src> gets: the photo, or '' while a reference has nothing
      behind it (not loaded yet, or its image is gone from this browser). */
  function src(photo) {
    if (isInline(photo)) return photo;
    if (isRef(photo)) return cache[photo] || '';
    return '';
  }

  /** The portable form, for a .json file or the share sheet: a data URL, or ''
      for a reference this browser cannot resolve — a dangling `idb:` in a file
      would point at nothing on whatever device opens it. */
  function inline(photo) { return src(photo); }

  /** Store a Blob; resolves to its `idb:` reference. Rejects (with MediaDB's
      teacher-readable message) when the write does not stick. */
  function keep(blob, dataUrl) {
    var s = store();
    if (!s) return Promise.reject(new Error('The image store is not available on this page.'));
    var id = newId();
    return s.put(id, blob, { tool: 'seating-chart' }).then(function () {
      var ref = PREFIX + id;
      cache[ref] = dataUrl;
      return ref;
    });
  }

  /** A picked file -> the value to put on the student: an `idb:` reference,
      or the data URL when IndexedDB would not take it (see the header). */
  function fromFile(file) {
    var M = global.MediaDB;
    return M.downscaleImage(file, { maxDim: MAX_DIMENSION, quality: JPEG_QUALITY }).then(function (out) {
      return M.toDataUrl(out.blob).then(function (dataUrl) {
        return keep(out.blob, dataUrl)['catch'](function () { return dataUrl; });
      });
    });
  }

  /** Read the images behind `refs` (an iterable of `idb:` strings) into the
      cache. Resolves to the references that have no image in this browser. */
  function hydrate(refs) {
    var s = store();
    var todo = Array.from(refs || []).filter(function (r) { return isRef(r) && !cache[r]; });
    if (!todo.length) return Promise.resolve([]);
    if (!s) return Promise.resolve(todo);
    return Promise.all(todo.map(function (ref) {
      return s.getBlob(ref.slice(PREFIX.length)).then(function (blob) {
        if (!blob) return ref;
        return global.MediaDB.toDataUrl(blob).then(function (url) { cache[ref] = url; return null; });
      })['catch'](function () { return ref; });
    })).then(function (missing) { return missing.filter(Boolean); });
  }

  /** Move every data: URL photo in the chart `getState()` returns into the
      store and replace it with a reference. Each distinct image is stored
      once — a duplicated section shares its photos. The replacement is applied
      to whatever getState() returns AFTER the writes, so an undo or an import
      that landed in the meantime is not overwritten with a stale copy.
      Resolves to how many students now point at a reference instead. The
      first write that fails stops the pass: that photo and the rest stay
      inline, still saved, and the next load tries again. */
  function migrate(getState) {
    var s = store();
    var first = getState();
    var urls = [];
    ((first && first.sections) || []).forEach(function (sec) {
      (sec.students || []).forEach(function (st) {
        if (isInline(st.photo) && urls.indexOf(st.photo) === -1) urls.push(st.photo);
      });
    });
    if (!urls.length || !s) return Promise.resolve(0);
    var refFor = {};
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
      var now = getState();
      ((now && now.sections) || []).forEach(function (sec) {
        (sec.students || []).forEach(function (st) {
          if (refFor[st.photo]) { st.photo = refFor[st.photo]; moved++; }
        });
      });
      return moved;
    });
  }

  /** Delete stored photos no chart points at any more — replaced, removed,
      or belonging to a deleted student or section. `keepRefs` is every
      reference still in use. Run at boot only: during a session the undo
      stack may still bring a removed photo back. */
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

  /** Erase: every photo this tool has stored, gone with the charts. */
  function clearAll() {
    cache = {};
    var s = store();
    return s ? s.clear() : Promise.resolve(0);
  }

  global.SeatingPhoto = {
    MAX_DIMENSION: MAX_DIMENSION,
    NS: NS,
    isRef: isRef,
    src: src,
    inline: inline,
    fromFile: fromFile,
    hydrate: hydrate,
    migrate: migrate,
    gc: gc,
    clearAll: clearAll
  };
})(window);
