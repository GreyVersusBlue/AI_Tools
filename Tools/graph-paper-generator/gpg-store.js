/* Graph Paper & Number Line Generator — localStorage persistence.
   Multiple named presets (e.g. "Algebra 1 graphing" vs "6th grade
   fractions"), same list/data/current shape as the vocab flashcard and
   certificate maker stores — replaces the old single global settings slot. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-graph-paper:list';
  var DATA_PREFIX = 'gvb-graph-paper:data:';
  var CURRENT_KEY = 'gvb-graph-paper:current';
  var LEGACY_KEY = 'gvb-graph-paper:settings';

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

  /* One-time migration: a returning visitor with the old single global
     settings object gets it promoted into a preset named "My Settings"
     instead of losing it. */
  function migrateLegacyIfNeeded() {
    if (listPresets().length) return;
    var legacy = safeParse(localStorage.getItem(LEGACY_KEY), null);
    if (!legacy) return;
    savePreset('My Settings', legacy);
  }

  global.GraphPaperStore = {
    listPresets: listPresets, savePreset: savePreset, loadPreset: loadPreset,
    deletePreset: deletePreset, getCurrentName: getCurrentName, setCurrentName: setCurrentName,
    migrateLegacyIfNeeded: migrateLegacyIfNeeded
  };
})(window);
