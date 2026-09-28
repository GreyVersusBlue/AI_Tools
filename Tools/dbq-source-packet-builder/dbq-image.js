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

   Everything but fromFile() is MediaDB.images() in _shared/media-db.js,
   shared with 028, 042 and 015 since Path 4 P4 increment 6.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/dbq-source-packet-builder/test/smoke-images.mjs. */
(function (global) {
  'use strict';

  var images = global.MediaDB.images({ ns: 'dbq', owner: 'dbq-source-packet-builder' });

  /** A picked file -> the value for source.image: an `idb:` reference, or the
      data URL when IndexedDB would not take it (see the header). The file is
      kept as uploaded. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return images.keepOrInline(file);
  }

  global.DbqImage = {
    NS: images.NS,
    isRef: images.isRef,
    isInline: images.isInline,
    isMissing: images.isMissing,
    url: images.url,
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    inline: images.inline,
    gc: images.gc
  };
})(window);
