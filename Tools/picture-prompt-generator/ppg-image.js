/* Picture-Prompt Generator — where the prompt pictures are kept.

   Until Path 4 P4 each picture was a data URL inside one localStorage key,
   `ppg_images_v1`, a flat list of { id, src, pinnedPrompts }, made by the
   page's own downscaleDataUrl(). That key is ~5 MB of room for a tool whose
   whole point is a stack of photos. Now the picture is a Blob in the shared
   media store (_shared/media-db.js, database `gvb-media`, namespace `ppg`),
   and `src` holds `idb:<id>`. 009 Backup & Restore backs `gvb-media` up by
   default.

   071 IS SHAPED UNLIKE THE EARLIER ADOPTERS. There is no document holding
   images: the list IS the library, and the prompt sets (`ppg_prompt_sets_v1`,
   and the legacy `ppg_prompts_v1` they migrate from) never mention a
   picture. A pin is `pinnedPrompts[setId] = promptId` on the picture's own
   entry, so it moves with the entry and nothing else refers to a picture.
   Nothing arrives from outside either: the share link carries a prompt set
   only, and there is no file import. So there is no arrival or export
   helper here — only what the one list needs.

   THE FIELD NAME DID NOT CHANGE, for 028's and 015's reason: a value is one
   of three things — '' (none), `idb:<id>` (this browser's store) or
   `data:image/…` (a list not yet moved, or a browser with no IndexedDB) —
   and a list an older cached copy of the page writes still reads correctly.

   STILL 1400 PX JPEG AT 0.82 for a picture larger than that, as
   downscaleDataUrl() made it, now through MediaDB.downscaleImage — and,
   as before, A PICTURE ALREADY WITHIN 1400 PX IS KEPT AS IT CAME: a small
   PNG keeps its transparency, an animated GIF keeps moving, and nothing is
   re-encoded for no reason. The one change is a file no browser can decode
   (an iPhone HEIC, say): it used to be saved as a picture that never drew,
   and is now refused with a message. A downscaled photo gets a white mat,
   since JPEG has no alpha and these go on paper.

   Everything else — content-hash ids, object URLs, hydrate, store, inline,
   gc with its grace period — is MediaDB.images(), shared with 056, 028, 042,
   015 and 041.

   Needs window.MediaDB, so _shared/media-db.js is linked before this file.
   The round trip is Tools/picture-prompt-generator/test/smoke-picture-store.mjs. */
(function (global) {
  'use strict';

  var MAX_DIM = 1400;         // px, long edge — what downscaleDataUrl() always used
  var QUALITY = 0.82;
  /* What a saved `src` has to look like to be drawn: a base64 data URL of an
     image, or a reference. Anything else in the key — only a hand edit or a
     crafted backup could put it there — is treated as a missing picture and
     never reaches an attribute. */
  var INLINE_RE = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*$/i;

  var images = global.MediaDB.images({ ns: 'ppg', owner: 'picture-prompt-task-generator' });

  /** The picture's natural size, or null when the browser cannot decode it. */
  function measure(file) {
    return new Promise(function (resolve) {
      var u = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(u); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { URL.revokeObjectURL(u); resolve(null); };
      img.src = u;
    });
  }

  /** A picked file -> the value for `src`: an `idb:` reference, or the
      picture's data URL when IndexedDB would not take it. */
  function fromFile(file) {
    if (!file || !/^image\//.test(file.type || '')) {
      return Promise.reject(new Error('“' + ((file && file.name) || 'That file') + '” is not an image. Choose a JPEG, PNG, GIF or WebP file.'));
    }
    return measure(file).then(function (dim) {
      if (!dim) throw new Error('“' + file.name + '” could not be opened as a picture in this browser. Save it as a JPEG or PNG and try again.');
      /* No size at all (an SVG without one) was kept as it came before, too. */
      if (!dim.w || !dim.h || (dim.w <= MAX_DIM && dim.h <= MAX_DIM)) return images.keepOrInline(file);
      return global.MediaDB.downscaleImage(file, { maxDim: MAX_DIM, quality: QUALITY, type: 'image/jpeg', background: '#fff' })
        .then(function (out) { return images.keepOrInline(out.blob); });
    });
  }

  /** Whether a saved `src` is something this page will draw from. */
  function isValid(src) {
    return images.isRef(src) || (typeof src === 'string' && INLINE_RE.test(src));
  }

  /** Every picture value the list holds, blanks left out. */
  function valuesIn(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (img) {
      if (img && typeof img.src === 'string' && img.src) out.push(img.src);
    });
    return out;
  }

  /** Replace every value `map` names. Returns whether anything changed, so
      the caller writes back only when something did. */
  function apply(list, map) {
    var changed = false;
    (Array.isArray(list) ? list : []).forEach(function (img) {
      if (img && typeof img.src === 'string' && map[img.src]) { img.src = map[img.src]; changed = true; }
    });
    return changed;
  }

  global.PicturePromptImage = {
    NS: images.NS,
    MAX_DIM: MAX_DIM,
    isRef: images.isRef,
    isInline: images.isInline,
    isMissing: images.isMissing,
    isValid: isValid,
    url: function (src) { return isValid(src) ? images.url(src) : ''; },
    fromFile: fromFile,
    hydrate: images.hydrate,
    store: images.store,
    inline: images.inline,
    gc: images.gc,
    valuesIn: valuesIn,
    apply: apply
  };
})(window);
