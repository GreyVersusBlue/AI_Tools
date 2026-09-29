/* htcm-image.js — where the Historical Trading Card Maker keeps card photos.

   Until Path 4 P4 a card's photo was a JPEG data URL in `image.src`, inside
   its deck's localStorage key (`htcm:data:<name>`), made by this file's own
   readAndDownscale(). Those bytes were what filled localStorage, which is why
   the page's save warning talks about photos. Now the photo is a Blob in the
   shared media store (_shared/media-db.js, database `gvb-media`, namespace
   `htcm`), and `image.src` holds `idb:<id>`. 009 Backup & Restore backs
   `gvb-media` up by default.

   ONLY `src` MOVED. A card's `image` is still an object — `{ src, w, h, crop,
   shape, filter }` — and everything but `src` is a few numbers that stay in
   the deck. `src` is one of: `idb:<id>` (this browser's store) or
   `data:image/…` (a deck not yet moved, or a browser with no IndexedDB). A
   deck an older cached copy of the page writes still reads correctly. A card
   with no photo still has `image: null`, as before.

   STILL 1000 PX, STILL JPEG AT 0.72 ON A WHITE MAT, as readAndDownscale()
   always stored, now through MediaDB.downscaleImage — this was the last copy
   of 030's pipeline, and it is gone. A photo already saved is not re-encoded.

   Content-hashed ids: the same photo on two cards or in two decks is one
   record, a renamed deck shares it, and nothing is deleted at the moment a
   card or a deck is — GC at boot does that, with media-db.js's ten-minute
   grace. The review game (`htcm:game`) holds card ids, not photos.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/historical-trading-card-maker/test/smoke-photo-store.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 1000;   // long edge px: plenty for a 2.5in card at 300 DPI
  var QUALITY = 0.72;   // keeps a phone photo around ~100 KB
  var TYPE = 'image/jpeg';
  /* What an inline photo has to look like to be kept from outside this
     browser or drawn at all: a base64 data URL of an image type an <img>
     shows. Anything else in `src` — someone else's `idb:` reference, a URL, a
     string built to break out of an attribute — is not a photo. */
  var INLINE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

  var images = global.MediaDB.images({ ns: 'htcm', owner: 'historical-trading-card-maker' });

  function isInline(v) { return typeof v === 'string' && INLINE_RE.test(v); }

  /** Whether `v` can be a photo's `src`: a reference or a well-formed inline
      image. htcm-store.js's repair drops a photo whose `src` is not. */
  function isValue(v) { return images.isRef(v) || isInline(v); }

  /** What an <img src> gets for a photo's `src`: a well-formed data URL, the
      object URL of a stored photo, or '' when there is nothing to show (not
      read yet, gone, or not a photo). Never anything else. */
  function url(v) {
    if (images.isRef(v)) return images.url(v);
    return isInline(v) ? v : '';
  }

  /** A picked file -> { src, w, h }: `src` is an `idb:` reference to the
      downscaled JPEG, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, type: TYPE, background: '#fff' })
      .then(function (out) {
        return images.keepOrInline(out.blob).then(function (src) {
          return { src: src, w: out.width, h: out.height };
        });
      }, function () {
        throw new Error('That file could not be read as an image.');
      });
  }

  /** Roughly how much of this page's localStorage a photo costs. Only an
      inline one costs anything there; a stored one is the store's business. */
  function approxKb(src) {
    if (!isInline(src)) return 0;
    // base64 carries 3 bytes per 4 characters; close enough to show a teacher.
    return Math.max(1, Math.round(src.length * 0.75 / 1024));
  }

  function eachPhoto(deck, fn) {
    if (!deck || !Array.isArray(deck.cards)) return;
    deck.cards.forEach(function (c) {
      if (c && c.image && typeof c.image === 'object') fn(c.image, c);
    });
  }

  /** Every photo `src` a deck holds. */
  function valuesIn(deck) {
    var out = [];
    eachPhoto(deck, function (img) { if (img.src) out.push(img.src); });
    return out;
  }

  /** Replace every `src` `map` names. Returns whether anything changed, so
      the caller writes back only the decks that did. */
  function apply(deck, map) {
    var changed = false;
    eachPhoto(deck, function (img) {
      if (typeof img.src === 'string' && map[img.src]) { img.src = map[img.src]; changed = true; }
    });
    return changed;
  }

  /** A deck from outside this browser (a link): keep only photos that are
      real inline images; every other photo becomes `image: null`. Returns
      how many were kept. */
  function acceptArrival(deck) {
    var kept = 0;
    if (!deck || !Array.isArray(deck.cards)) return 0;
    deck.cards.forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      if (c.image && typeof c.image === 'object' && isInline(c.image.src)) kept++;
      else c.image = null;
    });
    return kept;
  }

  /** Whether a deck holds a photo whose bytes have to be read back. */
  function hasStored(deck) { return valuesIn(deck).some(images.isRef); }

  /** A deep copy of `deck` with every photo `src` as a data URL (the photo
      removed where the stored image is gone), for anything that leaves this
      browser. A reference never reaches a file. */
  function forExport(deck) {
    var copy = JSON.parse(JSON.stringify(deck));
    var jobs = [];
    if (copy && Array.isArray(copy.cards)) {
      copy.cards.forEach(function (c) {
        if (!c || !c.image || typeof c.image !== 'object') return;
        jobs.push(images.inline(c.image.src).then(function (v) {
          if (v) c.image.src = v; else c.image = null;
        }));
      });
    }
    return Promise.all(jobs).then(function () { return copy; });
  }

  global.HtcmImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    isRef: images.isRef,
    isInline: isInline,
    isMissing: images.isMissing,
    isValue: isValue,
    url: url,
    fromFile: fromFile,
    approxKb: approxKb,
    hydrate: images.hydrate,
    store: images.store,
    inline: images.inline,
    gc: images.gc,
    valuesIn: valuesIn,
    apply: apply,
    acceptArrival: acceptArrival,
    hasStored: hasStored,
    forExport: forExport
  };
})(window);
