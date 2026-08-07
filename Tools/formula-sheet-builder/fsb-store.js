/* Formula Reference Sheet Builder — localStorage persistence.
   Same shape as the Bracket/Review-Board stores: a list of named sheets so
   more than one unit's reference sheet can be kept around and reopened. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-formula-sheet:list';
  var DATA_PREFIX = 'gvb-formula-sheet:data:';
  var CURRENT_KEY = 'gvb-formula-sheet:current';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listSheets() {
    return safeParse(localStorage.getItem(LIST_KEY), []);
  }

  function saveSheet(name, state) {
    var names = listSheets();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    localStorage.setItem(CURRENT_KEY, name);
  }

  function loadSheet(name) {
    return safeParse(localStorage.getItem(DATA_PREFIX + name), null);
  }

  function deleteSheet(name) {
    var names = listSheets().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  function getCurrentName() { return localStorage.getItem(CURRENT_KEY); }
  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  global.FormulaSheetStore = {
    listSheets: listSheets, saveSheet: saveSheet, loadSheet: loadSheet,
    deleteSheet: deleteSheet, getCurrentName: getCurrentName, setCurrentName: setCurrentName
  };
})(window);
