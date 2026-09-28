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

   Everything but fromFile() is MediaDB.images() in _shared/media-db.js,
   shared with 056, 042 and 015 since Path 4 P4 increment 6; until then this
   file was a near-copy of 056's dbq-image.js. inline() still hands back ''
   rather than null for a reference with nothing behind it, as it always did.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/primary-source-analysis-generator/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 1600;       // px, long edge — what 028 has always stored
  var QUALITY = 0.82;       // JPEG

  var images = global.MediaDB.images({ ns: 'psa', owner: 'primary-source-analysis-generator' });

  /** A picked file -> the value for imageDataUrl: an `idb:` reference to the
      downscaled image, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, background: '#fff' })
      .then(function (out) { return images.keepOrInline(out.blob); });
  }

  /** The value as it leaves this browser: a data URL, or '' for a reference
      with nothing behind it. */
  function inline(image) {
    return images.inline(image).then(function (v) { return v || ''; });
  }

  global.PsaImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    QUALITY: QUALITY,
    isRef: images.isRef,
    isInline: images.isInline,
    isMissing: images.isMissing,
    url: images.url,
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    inline: inline,
    gc: images.gc
  };
})(window);
