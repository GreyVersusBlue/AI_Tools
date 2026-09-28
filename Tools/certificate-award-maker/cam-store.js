/* Certificate & Award Maker — localStorage persistence.
   Multiple named presets (theme + border + signature combo, etc.), same
   list/data/current shape as the vocab flashcard and formula-sheet stores —
   replaces the old single "last settings used" slot. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-certificate-maker:list';
  var DATA_PREFIX = 'gvb-certificate-maker:data:';
  var CURRENT_KEY = 'gvb-certificate-maker:current';
  var LEGACY_KEY = 'gvb-certificate-maker:last';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listPresets() { return safeParse(localStorage.getItem(LIST_KEY), []); }

  function savePreset(name, settings) {
    var names = listPresets();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(settings));
    localStorage.setItem(CURRENT_KEY, name);
  }

  /* Rewrite a saved preset's settings without making it the current one —
     the image migration walks presets that are not open. A name that is no
     longer in the list is left alone (it was deleted meanwhile). */
  function updatePreset(name, settings) {
    if (listPresets().indexOf(name) === -1) return false;
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(settings));
    return true;
  }

  function loadPreset(name) { return safeParse(localStorage.getItem(DATA_PREFIX + name), null); }

  function deletePreset(name) {
    var names = listPresets().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) localStorage.removeItem(CURRENT_KEY);
  }

  function getCurrentName() { return localStorage.getItem(CURRENT_KEY); }
  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  /* One-time migration: a returning visitor with the old single-slot
     settings object (from before named presets existed) gets it promoted
     into a preset named "My Certificate" instead of losing it. The old key
     is removed once the preset is saved: nothing reads it after that (the
     list is never empty again), and it held the logo and signature as data
     URLs, which Path 4 P4 moved out of localStorage. */
  function migrateLegacyIfNeeded() {
    if (listPresets().length) return;
    var legacy = safeParse(localStorage.getItem(LEGACY_KEY), null);
    if (!legacy) return;
    savePreset('My Certificate', legacy);
    localStorage.removeItem(LEGACY_KEY);
  }

  global.CertificateStore = {
    listPresets: listPresets, savePreset: savePreset, loadPreset: loadPreset, updatePreset: updatePreset,
    deletePreset: deletePreset, getCurrentName: getCurrentName, setCurrentName: setCurrentName,
    migrateLegacyIfNeeded: migrateLegacyIfNeeded
  };
})(window);
