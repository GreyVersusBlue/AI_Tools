/* Quiz / Review Game Board — localStorage persistence.
   Same shape as the Bracket / Tournament Generator's store: a list of named
   boards so more than one game can be kept around without overwriting. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-review-board:list';
  var DATA_PREFIX = 'gvb-review-board:data:';
  var CURRENT_KEY = 'gvb-review-board:current';

  /* NOTE: localStorage.getItem returns `null` for a missing key, and
     JSON.parse(null) parses that as the *string* "null" -> the value
     `null` (no exception!). A naive try/catch safeParse would return
     `null` instead of `fallback` for a key that was never set. Guard
     against both the missing-key case and an explicit `null` payload. */
  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listBoards() {
    return safeParse(localStorage.getItem(LIST_KEY), []);
  }

  /* Returns true on success, false if the write was refused — which since
     clues can carry images (see P12) is a real, reachable outcome rather
     than a theoretical one. localStorage is capped around 5 MB and a board
     with a dozen projected maps in it can get there. The board list is only
     amended after the payload lands, so a refused save never leaves a name
     in the switcher pointing at nothing. */
  function saveBoard(name, state) {
    try {
      localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    } catch (e) {
      return false;
    }
    var names = listBoards();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(CURRENT_KEY, name);
    return true;
  }

  /** Rough bytes this tool is holding in localStorage, for a usage readout.
      Counts the UTF-16 characters of every value under our own prefixes —
      exact enough to warn on, and it never touches another tool's keys. */
  function usageBytes() {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && (k === LIST_KEY || k === CURRENT_KEY || k.indexOf(DATA_PREFIX) === 0)) {
        total += (localStorage.getItem(k) || '').length * 2;
      }
    }
    return total;
  }

  function loadBoard(name) {
    return safeParse(localStorage.getItem(DATA_PREFIX + name), null);
  }

  function deleteBoard(name) {
    var names = listBoards().filter(function (n) { return n !== name; });
    localStorage.setItem(LIST_KEY, JSON.stringify(names));
    localStorage.removeItem(DATA_PREFIX + name);
    if (localStorage.getItem(CURRENT_KEY) === name) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  function getCurrentName() {
    return localStorage.getItem(CURRENT_KEY);
  }

  function setCurrentName(name) {
    if (name) localStorage.setItem(CURRENT_KEY, name);
    else localStorage.removeItem(CURRENT_KEY);
  }

  global.ReviewBoardStore = {
    listBoards: listBoards,
    saveBoard: saveBoard,
    loadBoard: loadBoard,
    deleteBoard: deleteBoard,
    getCurrentName: getCurrentName,
    setCurrentName: setCurrentName,
    usageBytes: usageBytes
  };
})(window);
