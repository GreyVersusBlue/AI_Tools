/* Timeline Builder — where event photos are kept.

   Until Path 4 P4 an event's photo was a JPEG data URL inside its timeline's
   localStorage key (`gvb-timeline:data:<name>`, field `photo`), downscaled by
   this folder's own tlb-photo.js. A dozen photos was most of what the size
   warning in tlb-store.js warned about, in the ~5 MB of localStorage the
   whole site shares. Now the photo is a Blob in the shared media store
   (_shared/media-db.js, database `gvb-media`, namespace `tlb`), and `photo`
   holds `idb:<id>`. 009 Backup & Restore backs `gvb-media` up by default.

   THE FIELD NAME DID NOT CHANGE, for 028's reason: a value is one of three
   things — null or '' (none), `idb:<id>` (this browser's store) or
   `data:image/…` (a timeline not yet moved, an arrival, or a browser with no
   IndexedDB) — and a timeline an older cached copy of the page writes, or an
   export already in a teacher's email, still reads correctly.

   STILL 480 PX, STILL JPEG 0.72, as tlb-photo.js always stored, now through
   MediaDB.downscaleImage. One thing differs: a transparent PNG is painted on
   white first. tlb-photo.js painted nothing, so a transparent clip-art picture
   came out as a black square; every place a photo shows is a white card or
   paper. A photo already saved is not re-encoded.

   Everything else — content-hash ids, object URLs, hydrate, store, inline,
   gc with its grace period — is MediaDB.images(), shared with 056, 028 and
   042. The page decides which timelines hold which photos.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/timeline-builder/test/smoke-photos.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 480;        // px, long edge — what tlb-photo.js always stored
  var QUALITY = 0.72;       // JPEG
  /* What an arriving photo has to look like to be kept: a base64 data URL
     of an image type an <img> shows. Anything else a file or a link carries
     in `photo` — someone else's `idb:` reference, a URL, a string built to
     break out of an attribute — is dropped on arrival. */
  var INLINE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

  var images = global.MediaDB.images({ ns: 'tlb', owner: 'timeline-builder' });

  /** A picked file -> the value for `photo`: an `idb:` reference to the
      downscaled JPEG, or its data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('That file is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, background: '#fff' })
      .then(function (out) { return images.keepOrInline(out.blob); });
  }

  /** Every photo value a timeline holds, blanks left out. */
  function valuesIn(timeline) {
    var out = [];
    if (!timeline || !Array.isArray(timeline.events)) return out;
    timeline.events.forEach(function (ev) { if (ev && ev.photo) out.push(ev.photo); });
    return out;
  }

  /** Replace every photo `map` names. Returns whether anything changed, so
      the caller writes back only the timelines that did. */
  function apply(timeline, map) {
    var changed = false;
    if (!timeline || !Array.isArray(timeline.events)) return false;
    timeline.events.forEach(function (ev) {
      if (ev && typeof ev.photo === 'string' && map[ev.photo]) { ev.photo = map[ev.photo]; changed = true; }
    });
    return changed;
  }

  /** A timeline from outside this browser (a file, a link, a handoff): keep
      only photos that are real inline images; everything else is null.
      Returns how many were kept. */
  function acceptArrival(timeline) {
    var kept = 0;
    if (!timeline || !Array.isArray(timeline.events)) return 0;
    timeline.events.forEach(function (ev) {
      if (!ev || typeof ev !== 'object') return;
      if (typeof ev.photo === 'string' && INLINE_RE.test(ev.photo)) kept++;
      else ev.photo = null;
    });
    return kept;
  }

  /** A copy of `timeline` with every photo as a data URL (null where the
      stored image is gone), for anything that leaves this browser. A
      reference never reaches a file, a link or a QR code. */
  function forExport(timeline) {
    var copy = JSON.parse(JSON.stringify(timeline));
    return Promise.all((copy.events || []).map(function (ev) {
      if (!ev || !ev.photo) return null;
      return images.inline(ev.photo).then(function (v) { ev.photo = v; });
    })).then(function () { return copy; });
  }

  function hasStoredPhoto(timeline) {
    return valuesIn(timeline).some(images.isRef);
  }

  global.TimelineImage = {
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
    inline: images.inline,
    gc: images.gc,
    valuesIn: valuesIn,
    apply: apply,
    acceptArrival: acceptArrival,
    forExport: forExport,
    hasStoredPhoto: hasStoredPhoto
  };
})(window);
