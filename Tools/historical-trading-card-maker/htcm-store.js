/* htcm-store.js — persistence for the Historical Trading Card Maker.

   Schema v2 (key htcm_cards_v2), one JSON document:
     { v: 2,
       cards: [{
         id, name,
         image: null | { src, w, h,                 // downscaled master + px size
                         crop: { x, y, scale },     // normalized focal point, zoom >= 1
                         shape: 'rrect',            // rrect|circle|oval|hex|shield|arch
                         filter: 'none' },          // none|sepia|gray
         stats: [{ label, value }],
         facts: [String],
         meta: { rarity, setName, cardNo, setSize, stars },
         theme: null | themeKey                     // null = deck default
       }],
       settings: { size: 'standard'|'fill', theme: themeKey } }

   Discipline modeled on assets/js/gvb-save.js: repair() runs on every load and
   fills defaults for every field, so later feature rounds can add fields
   without a v3 bump; an unparseable document is refused (fresh start) rather
   than half-loaded. Migration from v1 (htcm_cards_v1 array + htcm_card_size_v1
   string) happens once, writes v2, and deliberately leaves the v1 keys in
   place as a one-release backup. */
(function () {
  'use strict';

  var KEY_V2 = 'htcm_cards_v2';
  var KEY_V1 = 'htcm_cards_v1';
  var KEY_V1_SIZE = 'htcm_card_size_v1';

  var DEFAULT_CROP = { x: 0.5, y: 0.5, scale: 1 };

  function repairCrop(c) {
    c = (c && typeof c === 'object') ? c : {};
    var x = Number(c.x), y = Number(c.y), s = Number(c.scale);
    return {
      x: (isFinite(x) && x >= 0 && x <= 1) ? x : DEFAULT_CROP.x,
      y: (isFinite(y) && y >= 0 && y <= 1) ? y : DEFAULT_CROP.y,
      scale: (isFinite(s) && s >= 1 && s <= 8) ? s : DEFAULT_CROP.scale
    };
  }

  function repairImage(img) {
    // v1 stored the image as a bare data-URL string; v2 wraps it in an object.
    if (typeof img === 'string' && /^data:image\//.test(img)) img = { src: img };
    if (!img || typeof img !== 'object' || typeof img.src !== 'string' || !/^data:image\//.test(img.src)) return null;
    return {
      src: img.src,
      // w/h unknown for migrated v1 images; filled lazily on first render.
      w: (isFinite(Number(img.w)) && Number(img.w) > 0) ? Math.round(Number(img.w)) : 0,
      h: (isFinite(Number(img.h)) && Number(img.h) > 0) ? Math.round(Number(img.h)) : 0,
      crop: repairCrop(img.crop),
      shape: typeof img.shape === 'string' ? img.shape : 'rrect',
      filter: typeof img.filter === 'string' ? img.filter : 'none'
    };
  }

  function repairStat(s) {
    if (typeof s === 'string') return { label: s, value: '' };
    if (!s || typeof s !== 'object') return null;
    return { label: String(s.label == null ? '' : s.label), value: String(s.value == null ? '' : s.value) };
  }

  function repairMeta(m) {
    m = (m && typeof m === 'object') ? m : {};
    var no = Math.round(Number(m.cardNo)), size = Math.round(Number(m.setSize)), stars = Math.round(Number(m.stars));
    return {
      rarity: typeof m.rarity === 'string' ? m.rarity : 'common',
      setName: typeof m.setName === 'string' ? m.setName : '',
      cardNo: (isFinite(no) && no > 0) ? no : 0,
      setSize: (isFinite(size) && size > 0) ? size : 0,
      stars: (isFinite(stars) && stars >= 0 && stars <= 5) ? stars : 0
    };
  }

  function repairCard(c) {
    if (!c || typeof c !== 'object' || !c.name) return null;
    return {
      id: typeof c.id === 'string' && c.id ? c.id : ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      name: String(c.name),
      image: repairImage(c.image),
      stats: Array.isArray(c.stats) ? c.stats.map(repairStat).filter(Boolean) : [],
      facts: Array.isArray(c.facts) ? c.facts.map(function (f) { return String(f); }) : [],
      meta: repairMeta(c.meta),
      theme: typeof c.theme === 'string' ? c.theme : null
    };
  }

  function repairSettings(s) {
    s = (s && typeof s === 'object') ? s : {};
    return {
      size: s.size === 'fill' ? 'fill' : 'standard',
      theme: typeof s.theme === 'string' ? s.theme : 'classic'
    };
  }

  function repairDoc(doc) {
    doc = (doc && typeof doc === 'object') ? doc : {};
    return {
      v: 2,
      cards: Array.isArray(doc.cards) ? doc.cards.map(repairCard).filter(Boolean) : [],
      settings: repairSettings(doc.settings)
    };
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function migrateV1() {
    var v1 = readJson(KEY_V1);
    if (!Array.isArray(v1)) return null;
    var size = null;
    try { size = localStorage.getItem(KEY_V1_SIZE); } catch (e) { /* ignore */ }
    return repairDoc({ cards: v1, settings: { size: size } });
  }

  /** Always returns a valid v2 document. Migrates v1 (writing v2, keeping the
      v1 keys as a one-release backup) the first time it runs. */
  function load() {
    var doc = readJson(KEY_V2);
    if (doc) return repairDoc(doc);
    var migrated = migrateV1();
    if (migrated) {
      save(migrated); // best effort; v1 keys stay untouched as backup
      return migrated;
    }
    return repairDoc(null);
  }

  /** Returns {ok:true} or {ok:false, error} — callers must surface a failure
      to the teacher; a swallowed quota error means silent data loss. */
  function save(doc) {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(doc));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  window.HtcmStore = {
    KEY_V2: KEY_V2,
    load: load,
    save: save,
    repairDoc: repairDoc
  };
})();
