/* Primary Source Analysis Worksheet Generator — where Source A and B images are kept.

   Until Path 4 P4 an uploaded image was a data: URL inside its worksheet's
   localStorage key (`gvb-primary-source:data:<name>`, fields `imageDataUrl`
   and `sourceBImageDataUrl`), and a second full copy inside the source
   library (`gvb-primary-source:library`) once it was saved there. Even
   downscaled, a 1600 px photo is a few hundred KB to over a megabyte of
   base64, and the ~5 MB localStorage ceiling is shared by every tool on the
   site. Now the image is a Blob in the shared media store (_shared/media-db.js,
   database `gvb-media`, namespace `psa`), and those same two fields hold
   `idb:<id>`. 009 Backup & Restore backs `gvb-media` up by default.

   THE FIELD NAMES DID NOT CHANGE. `imageDataUrl` now usually holds a
   reference, not a data URL. Renaming it would have broken every exported
   file and every share link already in a teacher's email, and every file an
   older copy of the page will still write. A value is one of three things:
   '' (no upload), `idb:<id>` (this browser's store) or `data:image/…` (an
   arrival not yet moved, or a browser with no IndexedDB).

   STILL DOWNSCALED, as it always was: 1600 px long edge, JPEG 0.82, on white,
   now through MediaDB.downscaleImage instead of the page's own copy. A
   worksheet prints an image at most 3.2 inches tall, so 1600 px is already
   more than paper shows; 056 keeps the original because its crop prints an
   enlarged detail of a scan, and 028's crop does too, but 028 always threw the
   original away and a teacher's existing worksheets were built on the
   downscaled copy.

   A CROP IS PARAMETERS, NOT A NEW IMAGE. `imageCrop` is a normalized rect
   drawn with CSS over the stored image, exactly as before; nothing here cuts
   pixels. So the crop survives the move untouched, and re-cropping never
   stores anything.

   OBJECT URLS, NOT A DATA-URL CACHE, for the reason 056's dbq-image.js gives:
   the editor, the crop tool and the printed worksheet only need something an
   <img> can show, and only Export worksheet and the share sheet's download
   read the bytes back, asynchronously, through `inline()`.

   IDS ARE THE CONTENT'S HASH (`h` + 128 bits of SHA-256), so the same picture
   in two worksheets, the library and an imported file is one record, and a
   migration that runs twice stores nothing the second time. Without
   crypto.subtle the id is random and nothing is deduplicated.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE, `fromFile()` hands back the
   downscaled data URL and the page stores that, exactly as before.

   This file is 056's dbq-image.js with a downscaling fromFile(). The two are
   near-identical on purpose (one adopter per module, per CLAUDE.md); when a
   third big-image tool moves, extract the shared half into _shared/.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/primary-source-analysis-generator/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var NS = 'psa';
  var PREFIX = 'idb:';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  var MAX_DIM = 1600;       // px, long edge — what 028 has always stored
  var QUALITY = 0.82;       // JPEG
  /* gc() leaves anything newer than this alone: an image another open tab has
     just stored but not yet written into its saved worksheet looks exactly
     like an orphan for the moment in between. */
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

  function keep(blob) {
    var s = store();
    if (!s) return Promise.reject(new Error('The image store is not available on this page.'));
    return idFor(blob).then(function (id) {
      return s.put(id, blob, { tool: 'primary-source-analysis-generator' }).then(function () {
        return remember(PREFIX + id, blob);
      });
    });
  }

  /** A picked file -> the value for imageDataUrl: an `idb:` reference to the
      downscaled image, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, background: '#fff' })
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
      stay inline, still saved, and the next load tries again. An arriving
      image is stored as it came (it was downscaled by whoever uploaded it). */
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

  /** The value as it leaves this browser: a data URL, or '' for a reference
      with nothing behind it (a dangling `idb:` would name an image on the
      receiving device, or nothing). Reads the stored bytes, so it is async. */
  function inline(image) {
    if (isInline(image)) return Promise.resolve(image);
    if (!isRef(image)) return Promise.resolve('');
    var s = store();
    if (!s) return Promise.resolve('');
    return s.getBlob(image.slice(PREFIX.length)).then(function (blob) {
      return blob ? global.MediaDB.toDataUrl(blob) : '';
    })['catch'](function () { return ''; });
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
        return s.remove(r.id);
      })).then(function () { return dead.length; });
    });
  }

  global.PsaImage = {
    NS: NS,
    MAX_DIM: MAX_DIM,
    QUALITY: QUALITY,
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
