/* Bracket / Tournament Generator — localStorage persistence.
   Keeps a list of named brackets so a teacher can run more than one
   tournament (e.g. parallel groups) without them overwriting each other. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-bracket:list';
  var DATA_PREFIX = 'gvb-bracket:data:';
  var CURRENT_KEY = 'gvb-bracket:current';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listBrackets() {
    return safeParse(localStorage.getItem(LIST_KEY), []);
  }

  function saveBracket(name, state) {
    var names = listBrackets();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(state));
    localStorage.setItem(CURRENT_KEY, name);
  }

  function loadBracket(name) {
    return safeParse(localStorage.getItem(DATA_PREFIX + name), null);
  }

  function deleteBracket(name) {
    var names = listBrackets().filter(function (n) { return n !== name; });
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

  global.BracketStore = {
    listBrackets: listBrackets,
    saveBracket: saveBracket,
    loadBracket: loadBracket,
    deleteBracket: deleteBracket,
    getCurrentName: getCurrentName,
    setCurrentName: setCurrentName
  };
})(window);
