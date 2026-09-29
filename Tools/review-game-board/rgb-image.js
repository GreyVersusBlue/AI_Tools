/* Quiz / Review Game Board — where clue images are kept.

   Until Path 4 P4 a clue's picture was a JPEG data URL on the clue itself,
   inside its board's localStorage key (`gvb-review-board:data:<name>`, field
   `image`), made by the page's own readAndDownscaleImage(). Those bytes were
   what filled localStorage, which is why the page grew a storage readout and
   an out-of-space alert. Now the picture is a Blob in the shared media store
   (_shared/media-db.js, database `gvb-media`, namespace `rgb`), and `image`
   holds `idb:<id>`. 009 Backup & Restore backs `gvb-media` up by default.

   THE FIELD NAME DID NOT CHANGE, for 028's, 015's and 041's reason: a value
   is one of three things — absent (no picture), `idb:<id>` (this browser's
   store) or `data:image/…` (a board not yet moved, an arrival, or a browser
   with no IndexedDB) — and a board an older cached copy of the page writes,
   or an export already in a teacher's email, still reads correctly. A clue
   with no picture still carries no `image` field at all, as before.

   STILL 1000 PX, STILL JPEG AT 0.72 ON A WHITE MAT, as readAndDownscaleImage()
   always stored, now through MediaDB.downscaleImage. A projected clue is a
   few hundred CSS pixels tall, and a transparent PNG lands on a printed page
   as often as on the navy board, so it gets white rather than black under it.
   A picture already saved is not re-encoded.

   NOT THE SAME STORE AS THE CLUE AUDIO. Audio is in `rgb-audio`
   (rgb-audio-db.js), with ids that are owned per board and duplicated on a
   rename. Pictures are content-hashed, so the same map on two boards is one
   record, a renamed copy of a board shares it, and nothing is deleted at the
   moment a board or a picture is — GC at boot does that, with media-db.js's
   ten-minute grace. The two travel out the same way: both are inlined into
   Export JSON (`image` as a data URL here, `audio` by the page).

   The question bank (rgb-bank-store.js) carries no pictures; a pulled entry
   is text only. If it ever does, its values belong in the page's GC keep-set.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/review-game-board/test/smoke-clue-image-store.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 1000;         // px, long edge — what readAndDownscaleImage() always stored
  var QUALITY = 0.72;
  var TYPE = 'image/jpeg';
  /* What an arriving picture has to look like to be kept: a base64 data URL
     of an image type an <img> shows. Anything else a file carries in `image`
     — someone else's `idb:` reference, a URL, a string built to break out of
     an attribute — is dropped on arrival. Also what a saved inline value has
     to look like to be drawn, so a hand-edited key or a crafted backup cannot
     put anything else into a src either. */
  var INLINE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

  var images = global.MediaDB.images({ ns: 'rgb', owner: 'review-game-board' });

  /** A picked file -> the value for `image`: an `idb:` reference to the
      downscaled JPEG, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, type: TYPE, background: '#fff' })
      .then(function (out) { return images.keepOrInline(out.blob); }, function () {
        throw new Error('That file could not be read as an image.');
      });
  }

  /** Whether `v` is a picture value at all: a reference, or a well-formed
      inline image. Everything else is treated as no picture. */
  function isValue(v) {
    return images.isRef(v) || (typeof v === 'string' && INLINE_RE.test(v));
  }

  /** What an <img src> gets: a well-formed data URL, the object URL of a
      stored picture, or '' when there is nothing to show (none, not read yet,
      gone, or not a picture). Never anything else. */
  function url(v) {
    if (images.isRef(v)) return images.url(v);
    return (typeof v === 'string' && INLINE_RE.test(v)) ? v : '';
  }

  function eachClue(board, fn) {
    if (!board || !Array.isArray(board.categories)) return;
    board.categories.forEach(function (c) {
      if (!c || !Array.isArray(c.clues)) return;
      c.clues.forEach(function (cl) { if (cl && typeof cl === 'object') fn(cl); });
    });
  }

  /** Every picture value a board holds. */
  function valuesIn(board) {
    var out = [];
    eachClue(board, function (cl) { if (cl.image) out.push(cl.image); });
    return out;
  }

  /** Replace every picture `map` names. Returns whether anything changed, so
      the caller writes back only the boards that did. */
  function apply(board, map) {
    var changed = false;
    eachClue(board, function (cl) {
      if (typeof cl.image === 'string' && map[cl.image]) { cl.image = map[cl.image]; changed = true; }
    });
    return changed;
  }

  /** A board from outside this browser (a JSON file): keep only pictures that
      are real inline images; every other `image` is removed. Returns how many
      were kept. */
  function acceptArrival(board) {
    var kept = 0;
    eachClue(board, function (cl) {
      if (typeof cl.image === 'string' && INLINE_RE.test(cl.image)) kept++;
      else delete cl.image;
    });
    return kept;
  }

  /** A deep copy of `board` with every picture as a data URL (removed where
      the stored image is gone), for anything that leaves this browser. A
      reference never reaches a file. */
  function forExport(board) {
    var copy = JSON.parse(JSON.stringify(board));
    var jobs = [];
    eachClue(copy, function (cl) {
      if (!cl.image) return;
      jobs.push(images.inline(cl.image).then(function (v) {
        if (v) cl.image = v; else delete cl.image;
      }));
    });
    return Promise.all(jobs).then(function () { return copy; });
  }

  global.ReviewBoardImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    isRef: images.isRef,
    isInline: function (v) { return typeof v === 'string' && INLINE_RE.test(v); },
    isMissing: images.isMissing,
    isValue: isValue,
    url: url,
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    inline: images.inline,
    gc: images.gc,
    valuesIn: valuesIn,
    apply: apply,
    acceptArrival: acceptArrival,
    forExport: forExport
  };
})(window);
