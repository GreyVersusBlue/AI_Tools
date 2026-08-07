/* Timeline Builder — localStorage persistence.
   A list of named timelines, same shape as the other multi-sheet tools.
   Embedded event photos are the one real size risk here (localStorage is
   typically capped around 5-10MB per origin) — photos are downscaled before
   they ever reach this module (see tlb-photo.js), and saveTimeline() reports
   the serialized size back so the UI can warn well before that ceiling. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-timeline:list';
  var DATA_PREFIX = 'gvb-timeline:data:';
  var CURRENT_KEY = 'gvb-timeline:current';
  var WARN_BYTES = 3 * 1024 * 1024; // 3MB — warn well before a typical 5MB quota

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listTimelines() { return safeParse(localStorage.getItem(LIST_KEY), []); }

  /** Returns {ok, bytes, error} — ok:false on quota overflow so the UI can
   * tell the user to remove a photo or two instead of silently losing data. */
  function saveTimeline(name, state) {
    var names = listTimelines();
    var serialized = JSON.stringify(state);
    var bytes = serialized.length;
    try {
      if (names.indexOf(name) === -1) {
        names.push(name);
        localStorage.setItem(LIST_KEY, JSON.stringify(names));
      }
      localStorage.setItem(DATA_PREFIX + name, serialized);
      localStorage.setItem(CURRENT_KEY, name);
      return { ok: true, bytes: bytes, warn: bytes > WARN_BYTES };
    } catch (e) {
      return { ok: false, bytes: bytes, error: e };
    }
  }

  function loadTimeline(name) { return safeParse(localStorage.getItem(DATA_PREFIX + name), null); }

  function deleteTimeline(name) {
    var names = listTimelines().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) localStorage.removeItem(CURRENT_KEY);
  }

  function getCurrentName() { return localStorage.getItem(CURRENT_KEY); }
  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  global.TimelineStore = {
    listTimelines: listTimelines, saveTimeline: saveTimeline, loadTimeline: loadTimeline,
    deleteTimeline: deleteTimeline, getCurrentName: getCurrentName, setCurrentName: setCurrentName,
    WARN_BYTES: WARN_BYTES
  };
})(window);
