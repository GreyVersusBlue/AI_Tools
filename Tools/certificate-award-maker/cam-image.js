/* Certificate & Award Maker — where the logo/crest and signature images are kept.

   Until Path 4 P4 both uploads were PNG data URLs inside every named preset
   (`gvb-certificate-maker:data:<name>`, fields `logo` and `signatureImage`),
   so the same school crest saved in ten presets was ten copies in the ~5 MB
   of localStorage the whole site shares. Now the image is a Blob in the
   shared media store (_shared/media-db.js, database `gvb-media`, namespace
   `cam`) and those same two fields hold `idb:<id>`. 009 Backup & Restore
   backs `gvb-media` up by default.

   THE FIELD NAMES DID NOT CHANGE, for 028's reason: a value is one of three
   things — '' (none), `idb:<id>` (this browser's store) or `data:image/…`
   (a preset not yet moved, or a browser with no IndexedDB) — and a preset an
   older cached copy of the page writes still reads correctly.

   STILL 200 PX, STILL PNG, NO BACKGROUND. This file replaces cam-logo.js,
   the page's own copy of the downscaler; MediaDB.downscaleImage runs with
   the same long edge and type, so a crest's transparent background survives
   and the certificate's paper shows through it.

   OBJECT URLS, NOT A DATA-URL CACHE. 005 and 019 keep data URLs in memory
   because their consumers need the bytes synchronously (019's student link
   and QR codes carry the image; 005's Save to file and share sheet inline
   it). Nothing in 042 does: there is no share link, no export and no file,
   and every consumer — the two previews, the live certificate, the batch
   grid and the printed sheets — is an <img src>. An object URL is a short
   string, so a 30-name batch grid is not 30 copies of each image inside one
   innerHTML string, which is what a data URL would put there.

   IDS ARE THE CONTENT'S HASH (`h` + 128 bits of SHA-256), so the same crest
   in two presets is one record and a migration that runs twice stores
   nothing the second time. Without crypto.subtle the id is random and
   nothing is deduplicated.

   THE DELETE UNDO. A deleted preset can be brought back for 10 seconds, and
   the images it points at must survive that. GC runs only at boot, so this
   tab never deletes one; `keepAlive()` covers another tab booting inside the
   window: on delete it re-stamps the record (the 10-minute grace then spares
   it), and on undo it writes the bytes back from memory if they went anyway.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE, `fromFile()` hands back the
   downscaled data URL and the page stores that, exactly as before.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/certificate-award-maker/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var NS = 'cam';
  var OWNER = 'certificate-award-maker';
  var PREFIX = 'idb:';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  var MAX_DIM = 200;          // px, long edge — what cam-logo.js always stored
  var TYPE = 'image/png';     // a crest's transparency survives
  var FIELDS = ['logo', 'signatureImage'];
  /* gc() leaves anything newer than this alone: an image another open tab has
     just stored but not yet written into its saved preset looks exactly like
     an orphan for the moment in between. */
  var GC_GRACE_MS = 10 * 60 * 1000;

  var urls = {};             // 'idb:<id>' -> object URL
  var blobs = {};            // 'idb:<id>' -> Blob, for keepAlive()
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

  /** The image values a preset holds, in field order, blanks left out. */
  function valuesIn(preset) {
    var out = [];
    if (!preset) return out;
    FIELDS.forEach(function (f) { if (preset[f]) out.push(preset[f]); });
    return out;
  }

  function randomId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return (b < 16 ? '0' : '') + b.toString(16);
    }).join('');
  }

  function idFor(blob) {
    var subtle = global.crypto && global.crypto.subtle;
    if (!subtle || typeof blob.arrayBuffer !== 'function') return Promise.resolve(randomId());
    return blob.arrayBuffer()
      .then(function (buf) { return subtle.digest('SHA-256', buf); })
      .then(function (d) { return 'h' + hex(d).slice(0, 32); }, function () { return randomId(); });
  }

  function remember(ref, blob) {
    if (!urls[ref]) urls[ref] = URL.createObjectURL(blob);
    blobs[ref] = blob;
    delete missing[ref];
    return ref;
  }

  function keep(blob) {
    var s = store();
    if (!s) return Promise.reject(new Error('The image store is not available on this page.'));
    return idFor(blob).then(function (id) {
      return s.put(id, blob, { tool: OWNER }).then(function () {
        return remember(PREFIX + id, blob);
      });
    });
  }

  /** A picked file -> the value for `logo` or `signatureImage`: an `idb:`
      reference to the downscaled PNG, or its data URL when IndexedDB would
      not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a PNG, JPEG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, type: TYPE })
      .then(function (out) {
        return keep(out.blob)['catch'](function () { return global.MediaDB.toDataUrl(out.blob); });
      });
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

  /** Move data: URL images into the store, each distinct one once. Resolves
      to a map from data URL to reference, for the caller to apply to FRESH
      copies of what it saves. The first failed write stops the pass; the rest
      stay inline, still saved, and the next load tries again. */
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

  /** Replace every field of `preset` that `map` names. Returns whether
      anything changed, so the caller writes back only what did. */
  function apply(preset, map) {
    var changed = false;
    if (!preset) return false;
    FIELDS.forEach(function (f) {
      if (map[preset[f]]) { preset[f] = map[preset[f]]; changed = true; }
    });
    return changed;
  }

  /** Write the images behind `refs` again from memory. On delete this
      re-stamps them, so a GC in another tab spares them for its grace
      period; on undo it puts back any that went anyway. Resolves once done;
      a reference this tab never read is skipped. */
  function keepAlive(refs) {
    var s = store();
    if (!s) return Promise.resolve(0);
    var todo = Array.from(refs || []).filter(function (r) { return isRef(r) && blobs[r]; });
    return Promise.all(todo.map(function (ref) {
      return s.put(ref.slice(PREFIX.length), blobs[ref], { tool: OWNER }).then(function () {
        delete missing[ref];
        return 1;
      }, function () { return 0; });
    })).then(function (done) { return done.reduce(function (a, b) { return a + b; }, 0); });
  }

  /** Delete stored images nothing saved points at any more. `keepRefs` is
      every reference still in use. Run at boot only. */
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
        delete blobs[ref];
        return s.remove(r.id);
      })).then(function () { return dead.length; });
    });
  }

  global.CamImage = {
    NS: NS,
    MAX_DIM: MAX_DIM,
    TYPE: TYPE,
    FIELDS: FIELDS,
    isRef: isRef,
    isInline: isInline,
    isMissing: isMissing,
    url: url,
    valuesIn: valuesIn,
    fromFile: fromFile,
    hydrate: hydrate,
    store: store_,
    apply: apply,
    keepAlive: keepAlive,
    gc: gc
  };
})(window);
