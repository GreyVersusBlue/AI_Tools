/* School Layout Visualizer — where each floor's trace image is kept.

   Until Path 4 P4 the "Trace over a real floor plan" underlay was a 1600 px
   JPEG data URL inside `stviz_blueprint`, one per floor, and again inside
   every STVIZ_SNAPSHOT_ slot that was taken while it was there. A school with
   three traced floors and a couple of snapshots was spending most of the
   ~5 MB the whole site shares on pictures of its own hallways — the storage
   banner further down the page was written about exactly that. Now the image
   is a Blob in the shared media store (_shared/media-db.js, database
   `gvb-media`, namespace `stviz-trace`) and `floor.traceImage.dataUrl` holds
   `idb:<id>`. The field name was kept so nothing else that reads a blueprint
   has to change. 009 Backup & Restore backs `gvb-media` up by default.

   The downscaler that used to be inline in the page (canvas.toDataURL at
   0.85) is MediaDB.downscaleImage now, at the same 1600 px and quality, with
   a white background painted first: a transparent PNG plan used to come out
   black where it was clear, because JPEG has no alpha.

   WHY A DATA-URL CACHE AND NOT OBJECT URLS, like 005 and 019 and unlike the
   other adopters. drawTraceImage() is called inside renderCanvas(), which
   runs on nearly every pointer move, and the three things that carry a
   blueprint out of this browser are synchronous: the JSON and full-project
   exports, the WebRTC handoff, and RecoveryManager.capture(), which runs on
   pagehide where nothing asynchronous is guaranteed to finish. Each of them
   needs the bytes at the moment it serializes. Holding the data URL in
   memory (one per floor, a few hundred KB at most) lets all four stay
   exactly as synchronous as they were. Only boot and a new image touch
   IndexedDB.

   WHEN INDEXEDDB WILL NOT TAKE A WRITE, `fromFile()` hands back the data URL
   itself and the page stores that, exactly as before. The next save tries
   the store again. Nothing is dropped.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/schedule-visualizer/test/smoke-trace-image.mjs. */
(function (global) {
  'use strict';

  var MAX_DIMENSION = 1600;  // px, long edge — enough detail to trace walls from
  var JPEG_QUALITY = 0.85;
  var NS = 'stviz-trace';
  var OWNER = 'layout-visualizer';
  var REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;
  var REF_SCAN_RE = /idb:[A-Za-z0-9_-]{1,40}/g;

  var cache = {};            // 'idb:<id>' -> data URL
  var missing = {};          // 'idb:<id>' -> true once a read found nothing
  var layer = null;

  function images() {
    if (!layer && global.MediaDB) layer = global.MediaDB.images({ ns: NS, owner: OWNER });
    return layer;
  }

  function isRef(v) { return typeof v === 'string' && REF_RE.test(v); }
  function isInline(v) { return typeof v === 'string' && v.slice(0, 11) === 'data:image/'; }

  /** What the canvas, an export or a handoff gets: the image as a data URL,
      or '' for a reference with nothing behind it in this browser. */
  function src(value) {
    if (isInline(value)) return value;
    if (isRef(value)) return cache[value] || '';
    return '';
  }

  /** A stored image whose reference resolves to nothing here. Only true
      once hydrate() has looked for it. */
  function isMissing(value) { return isRef(value) && !!missing[value]; }

  /** A picked file -> the value for floor.traceImage.dataUrl: an `idb:`
      reference, or the data URL when IndexedDB would not take it. */
  function fromFile(file) {
    var M = global.MediaDB;
    if (!M || !images()) return Promise.reject(new Error('The image store is not available on this page.'));
    return M.downscaleImage(file, { maxDim: MAX_DIMENSION, quality: JPEG_QUALITY, background: '#ffffff' })
      .then(function (out) {
        return M.toDataUrl(out.blob).then(function (dataUrl) {
          return images().keep(out.blob).then(function (ref) {
            cache[ref] = dataUrl;
            delete missing[ref];
            return ref;
          }, function () { return dataUrl; });
        });
      });
  }

  /** Every trace-image value on `floors` (live floors or serialized ones). */
  function valuesIn(floors) {
    var out = [];
    (floors || []).forEach(function (f) {
      var v = f && f.traceImage && f.traceImage.dataUrl;
      if (v) out.push(v);
    });
    return out;
  }

  /** Every `idb:` reference written anywhere in `text` — how boot finds the
      images a saved snapshot still points at without parsing each one. */
  function refsInText(text) {
    return String(text || '').match(REF_SCAN_RE) || [];
  }

  /** Read the images behind `values` into the cache. Resolves to the
      distinct references that have no image in this browser. */
  function hydrate(values) {
    var todo = [];
    (values || []).forEach(function (v) {
      if (isRef(v) && !cache[v] && todo.indexOf(v) === -1) todo.push(v);
    });
    if (!todo.length) return Promise.resolve([]);
    var imgs = images();
    if (!imgs) { todo.forEach(function (r) { missing[r] = true; }); return Promise.resolve(todo); }
    return Promise.all(todo.map(function (ref) {
      return imgs.inline(ref).then(function (url) {
        if (!url) { missing[ref] = true; return ref; }
        cache[ref] = url;
        delete missing[ref];
        return null;
      });
    })).then(function (gone) { return gone.filter(Boolean); });
  }

  /** Move the data: URL images among `values` into the store, each distinct
      one once (content-hash ids). Resolves to a map from data URL to
      reference, which the caller applies to the floors it holds NOW. The
      first failed write stops the pass and the rest stay inline. */
  function store(values) {
    var imgs = images();
    if (!imgs) return Promise.resolve({});
    return imgs.store(values).then(function (map) {
      Object.keys(map).forEach(function (url) {
        cache[map[url]] = url;
        delete missing[map[url]];
      });
      return map;
    });
  }

  /** Delete stored images no saved blueprint or snapshot points at any more.
      Run at boot only; anything saved in the last ten minutes is spared. */
  function gc(keepRefs) {
    var imgs = images();
    return imgs ? imgs.gc(keepRefs) : Promise.resolve(0);
  }

  global.SVTraceImage = {
    MAX_DIMENSION: MAX_DIMENSION,
    JPEG_QUALITY: JPEG_QUALITY,
    NS: NS,
    isRef: isRef,
    isInline: isInline,
    isMissing: isMissing,
    src: src,
    fromFile: fromFile,
    valuesIn: valuesIn,
    refsInText: refsInText,
    hydrate: hydrate,
    store: store,
    gc: gc
  };
})(window);
