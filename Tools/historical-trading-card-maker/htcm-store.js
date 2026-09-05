/* htcm-store.js — persistence for the Historical Trading Card Maker.

   Storage is a list of named decks, the same triple-key shape as
   vfg-store.js and the bracket/review-board/formula-sheet stores:
   `htcm:list` (deck names), `htcm:data:<name>` (one v2 document each),
   `htcm:current` (last-open deck). Earlier releases stored one flat
   document (htcm_cards_v2) or a bare array (htcm_cards_v1); on first load
   either one becomes the deck "My cards", and the legacy keys are left in
   place as a one-release backup.

   Schema v2 (the per-deck document):
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
       settings: { size: 'standard'|'fill'|'reference', theme: themeKey } }

   Discipline modeled on _shared/gvb-save.js: repair() runs on every load and
   fills defaults for every field, so later feature rounds can add fields
   without a v3 bump; an unparseable document is refused (fresh start) rather
   than half-loaded. Migration from v1 (htcm_cards_v1 array + htcm_card_size_v1
   string) happens once, writes v2, and deliberately leaves the v1 keys in
   place as a one-release backup. */
(function () {
  'use strict';

  var LIST_KEY = 'htcm:list';
  var DATA_PREFIX = 'htcm:data:';
  var CURRENT_KEY = 'htcm:current';
  var KEY_V2 = 'htcm_cards_v2';
  var KEY_V1 = 'htcm_cards_v1';
  var KEY_V1_SIZE = 'htcm_card_size_v1';
  var DEFAULT_DECK = 'My cards';

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
      // Any value that isn't a known preset falls back to 'standard' — a
      // deck saved by a future round, or a hand-edited export, must not put
      // an unknown class on the print area and lay out as nothing at all.
      size: (s.size === 'fill' || s.size === 'reference') ? s.size : 'standard',
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

  /* ---------- named decks ---------- */

  function listDecks() {
    var names = readJson(LIST_KEY);
    return Array.isArray(names) ? names.filter(function (n) { return typeof n === 'string' && n; }) : [];
  }

  /** Returns {ok:true} or {ok:false, error} — callers must surface a failure
      to the teacher; a swallowed quota error means silent data loss. */
  function saveDeck(name, doc) {
    try {
      var names = listDecks();
      if (names.indexOf(name) === -1) {
        names.push(name);
        localStorage.setItem(LIST_KEY, JSON.stringify(names));
      }
      localStorage.setItem(DATA_PREFIX + name, JSON.stringify(doc));
      localStorage.setItem(CURRENT_KEY, name);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /** A repaired v2 document, or null if the deck doesn't exist. */
  function loadDeck(name) {
    var doc = readJson(DATA_PREFIX + name);
    return doc ? repairDoc(doc) : null;
  }

  function deleteDeck(name) {
    try {
      var names = listDecks().filter(function (n) { return n !== name; });
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
      localStorage.removeItem(DATA_PREFIX + name);
      if (localStorage.getItem(CURRENT_KEY) === name) localStorage.removeItem(CURRENT_KEY);
    } catch (e) { /* removals can't meaningfully fail */ }
  }

  /** The deck to open at boot: the current one, else the first listed, else
      whatever a legacy flat v2 / v1 store migrates into "My cards", else a
      fresh empty "My cards". Legacy keys stay behind as a backup. */
  function loadCurrent() {
    var names = listDecks();
    var current = null;
    try { current = localStorage.getItem(CURRENT_KEY); } catch (e) { /* ignore */ }
    if (current && names.indexOf(current) !== -1) {
      var doc = loadDeck(current);
      if (doc) return { name: current, doc: doc };
    }
    if (names.length) {
      var first = loadDeck(names[0]);
      if (first) return { name: names[0], doc: first };
    }
    var flat = readJson(KEY_V2);
    var migrated = flat ? repairDoc(flat) : migrateV1();
    if (!migrated) migrated = repairDoc(null);
    saveDeck(DEFAULT_DECK, migrated); // best effort
    return { name: DEFAULT_DECK, doc: migrated };
  }

  window.HtcmStore = {
    DEFAULT_DECK: DEFAULT_DECK,
    listDecks: listDecks,
    saveDeck: saveDeck,
    loadDeck: loadDeck,
    deleteDeck: deleteDeck,
    loadCurrent: loadCurrent,
    repairDoc: repairDoc
  };
})();
