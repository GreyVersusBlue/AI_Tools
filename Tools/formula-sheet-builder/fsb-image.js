/* Formula Reference Sheet Builder — where formula diagrams are kept.

   Until Path 4 P4 a formula's diagram was a PNG data URL inside its sheet's
   localStorage key (`gvb-formula-sheet:data:<name>`, field `image`), made by
   the page's own readAndDownscaleImage(). Now the diagram is a Blob in the
   shared media store (_shared/media-db.js, database `gvb-media`, namespace
   `fsb`), and `image` holds `idb:<id>`. 009 Backup & Restore backs `gvb-media`
   up by default.

   THE FIELD NAME DID NOT CHANGE, for 028's and 015's reason: a value is one
   of three things — '' (none), `idb:<id>` (this browser's store) or
   `data:image/…` (a sheet not yet moved, an arrival, or a browser with no
   IndexedDB) — and a sheet an older cached copy of the page writes, or an
   export already in a teacher's email, still reads correctly.

   STILL 200 PX, STILL PNG, as readAndDownscaleImage() always stored, now
   through MediaDB.downscaleImage. A diagram is line art on paper: PNG keeps
   its edges sharp and its transparent background transparent, so nothing is
   painted under it. A diagram already saved is not re-encoded.

   Everything else — content-hash ids, object URLs, hydrate, store, inline,
   gc with its grace period — is MediaDB.images(), shared with 056, 028, 042
   and 015. The page decides which sheets hold which diagrams.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/formula-sheet-builder/test/smoke-diagrams.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 200;          // px, long edge — what readAndDownscaleImage() always stored
  var TYPE = 'image/png';
  /* What an arriving diagram has to look like to be kept: a base64 data URL
     of an image type an <img> shows. Anything else a file or a link carries
     in `image` — someone else's `idb:` reference, a URL, a string built to
     break out of an attribute — is dropped on arrival. */
  var INLINE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

  var images = global.MediaDB.images({ ns: 'fsb', owner: 'formula-sheet-builder' });

  /** A picked file -> the value for `image`: an `idb:` reference to the
      downscaled PNG, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, type: TYPE })
      .then(function (out) { return images.keepOrInline(out.blob); });
  }

  /** Every diagram value a sheet holds, blanks left out. */
  function valuesIn(sheet) {
    var out = [];
    if (!sheet || !Array.isArray(sheet.items)) return out;
    sheet.items.forEach(function (item) { if (item && item.image) out.push(item.image); });
    return out;
  }

  /** Replace every diagram `map` names. Returns whether anything changed, so
      the caller writes back only the sheets that did. */
  function apply(sheet, map) {
    var changed = false;
    if (!sheet || !Array.isArray(sheet.items)) return false;
    sheet.items.forEach(function (item) {
      if (item && typeof item.image === 'string' && map[item.image]) { item.image = map[item.image]; changed = true; }
    });
    return changed;
  }

  /** A sheet from outside this browser (a file, a link): keep only diagrams
      that are real inline images; everything else is ''. Returns how many
      were kept. */
  function acceptArrival(sheet) {
    var kept = 0;
    if (!sheet || !Array.isArray(sheet.items)) return 0;
    sheet.items.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      if (typeof item.image === 'string' && INLINE_RE.test(item.image)) kept++;
      else item.image = '';
    });
    return kept;
  }

  /** A copy of `sheet` with every diagram as a data URL ('' where the stored
      image is gone), for anything that leaves this browser. A reference
      never reaches a file, a link or a QR code. */
  function forExport(sheet) {
    var copy = JSON.parse(JSON.stringify(sheet));
    return Promise.all((copy.items || []).map(function (item) {
      if (!item || !item.image) return null;
      return images.inline(item.image).then(function (v) { item.image = v || ''; });
    })).then(function () { return copy; });
  }

  function hasStoredImage(sheet) {
    return valuesIn(sheet).some(images.isRef);
  }

  global.FormulaSheetImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    isRef: images.isRef,
    isInline: images.isInline,
    isMissing: images.isMissing,
    url: images.url,
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    inline: images.inline,
    gc: images.gc,
    valuesIn: valuesIn,
    apply: apply,
    acceptArrival: acceptArrival,
    forExport: forExport,
    hasStoredImage: hasStoredImage
  };
})(window);
