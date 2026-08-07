/* Writing Prompt Generator — localStorage persistence (last-used settings
   and a short session history of recently shown prompts). */
(function (global) {
  'use strict';

  var KEY = 'gvb-writing-prompts:settings';

  function load() {
    var json = localStorage.getItem(KEY);
    if (json == null) return null;
    try {
      var value = JSON.parse(json);
      return value == null ? null : value;
    } catch (e) { return null; }
  }

  function save(settings) {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }

  global.WritingPromptStore = { load: load, save: save };
})(window);
