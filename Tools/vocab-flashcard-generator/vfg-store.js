/* Vocabulary Flashcard & Word Wall Generator — localStorage persistence.
   A list of named word lists (one per unit), same shape as the bracket/
   review-board/formula-sheet stores. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-vocab-flashcards:list';
  var DATA_PREFIX = 'gvb-vocab-flashcards:data:';
  var CURRENT_KEY = 'gvb-vocab-flashcards:current';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listSets() { return safeParse(localStorage.getItem(LIST_KEY), []); }

  function saveSet(name, state) {
    var names = listSets();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    localStorage.setItem(CURRENT_KEY, name);
  }

  function loadSet(name) { return safeParse(localStorage.getItem(DATA_PREFIX + name), null); }

  function deleteSet(name) {
    var names = listSets().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) localStorage.removeItem(CURRENT_KEY);
  }

  function getCurrentName() { return localStorage.getItem(CURRENT_KEY); }
  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  global.VocabStore = {
    listSets: listSets, saveSet: saveSet, loadSet: loadSet,
    deleteSet: deleteSet, getCurrentName: getCurrentName, setCurrentName: setCurrentName
  };
})(window);
