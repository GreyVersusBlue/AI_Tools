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

   Everything but fromFile() and the preset helpers (valuesIn, apply) is
   MediaDB.images() in _shared/media-db.js, shared with 056, 028 and 015
   since Path 4 P4 increment 6; keepAlive() moved there with it.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/certificate-award-maker/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 200;          // px, long edge — what cam-logo.js always stored
  var TYPE = 'image/png';     // a crest's transparency survives
  var FIELDS = ['logo', 'signatureImage'];

  var images = global.MediaDB.images({ ns: 'cam', owner: 'certificate-award-maker' });

  /** The image values a preset holds, in field order, blanks left out. */
  function valuesIn(preset) {
    var out = [];
    if (!preset) return out;
    FIELDS.forEach(function (f) { if (preset[f]) out.push(preset[f]); });
    return out;
  }

  /** A picked file -> the value for `logo` or `signatureImage`: an `idb:`
      reference to the downscaled PNG, or its data URL when IndexedDB would
      not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a PNG, JPEG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, type: TYPE })
      .then(function (out) { return images.keepOrInline(out.blob); });
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

  global.CamImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    TYPE: TYPE,
    FIELDS: FIELDS,
    isRef: images.isRef,
    isInline: images.isInline,
    isMissing: images.isMissing,
    url: images.url,
    valuesIn: valuesIn,
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    apply: apply,
    keepAlive: images.keepAlive,
    gc: images.gc
  };
})(window);
