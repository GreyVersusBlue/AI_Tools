// vfg-pictures.js — a picture on a vocabulary card (040, rank 142).
//
// A picture belongs to a TERM, not to a list: the page's lists are text a
// teacher types, with no stable word ids, so the picture's id is the term
// normalised by key() — trimmed, case-folded, runs of space made one — and the
// same word in two lists shows the same picture. The bytes are Blobs in the
// site's one IndexedDB store (`gvb-media`, namespace `vocab`, _shared/media-db.js),
// downscaled to 480 px on the way in; nothing is written to localStorage, so no
// key and no list record changes, and a list with no pictures is stored exactly
// as before. Pictures stay on this device: a share link, a list file and the
// Word Lists store carry words only (the page says so under the picture list).
//
// key() is pure (Node tests it); create(MediaDB) is the thin store wrapper the
// page uses, and a browser with no IndexedDB just reports available() false.

(function (global) {
  'use strict';

  var NS = 'vocab';
  var MAX_DIM = 480;
  var MAX_KEY = 120;

  /** The picture id for a term, or '' for a term that cannot have one. */
  function key(term) {
    var t = String(term == null ? '' : term).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!t || t.length > MAX_KEY) return '';
    return t;
  }

  /** The distinct terms of a list's items that can have a picture, in order. */
  function termsOf(items) {
    var seen = {}, out = [];
    (items || []).forEach(function (it) {
      var k = it && key(it.term);
      if (k && !seen[k]) { seen[k] = true; out.push(it.term); }
    });
    return out;
  }

  /** Where a picture goes on a card: a data URL from `pics` (key -> data URL), or ''. */
  function urlFor(pics, term) {
    var k = key(term);
    return k && pics && Object.prototype.hasOwnProperty.call(pics, k) ? pics[k] : '';
  }

  function create(MediaDB) {
    var store = MediaDB && MediaDB.store ? MediaDB.store({ ns: NS }) : null;
    return {
      NS: NS,
      available: function () { return store ? store.isAvailable() : Promise.resolve(false); },
      /** Every picture as { key: dataUrl }. A missing store reads as none. */
      load: function () {
        if (!store) return Promise.resolve({});
        return store.list().then(function (recs) {
          var map = {};
          return Promise.all((recs || []).map(function (r) {
            return store.getBlob(r.id).then(function (blob) {
              return blob ? MediaDB.toDataUrl(blob).then(function (u) { map[r.id] = u; }) : null;
            });
          })).then(function () { return map; });
        })['catch'](function () { return {}; });
      },
      /** Downscale and keep a picture for a term. Rejects with a message to show. */
      add: function (term, file) {
        var k = key(term);
        if (!k) return Promise.reject(new Error('That word cannot have a picture.'));
        if (!store) return Promise.reject(new Error('This browser cannot store pictures.'));
        return MediaDB.downscaleImage(file, { maxDim: MAX_DIM, type: 'image/jpeg', quality: 0.82, background: '#fff', as: 'dataUrl' })
          .then(function (res) {
            return store.put(k, MediaDB.dataUrlToBlob(res.dataUrl), { term: String(term).slice(0, MAX_KEY) })
              .then(function () { return res.dataUrl; });
          });
      },
      remove: function (term) { var k = key(term); return k && store ? store.remove(k) : Promise.resolve(); },
      removeAll: function () { return store ? store.clear() : Promise.resolve(); },
      usage: function () { return store ? store.usage() : Promise.resolve({ count: 0, bytes: 0 }); }
    };
  }

  global.VfgPictures = { NS: NS, MAX_DIM: MAX_DIM, key: key, termsOf: termsOf, urlFor: urlFor, create: create };
})(typeof window !== 'undefined' ? window : globalThis);
