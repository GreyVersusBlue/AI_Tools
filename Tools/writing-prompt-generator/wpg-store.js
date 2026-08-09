/* Writing Prompt Generator — localStorage persistence (last-used settings
   and a dated history of recently shown prompts, kept across sessions). */
(function (global) {
  'use strict';

  var KEY = 'gvb-writing-prompts:settings';
  var HISTORY_KEY = 'gvb-writing-prompts:history';
  var CUSTOM_KEY = 'gvb-writing-prompts:custom';

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

  function loadHistory() {
    var json = localStorage.getItem(HISTORY_KEY);
    if (json == null) return [];
    try {
      var value = JSON.parse(json);
      return Array.isArray(value) ? value : [];
    } catch (e) { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function loadCustom() {
    var json = localStorage.getItem(CUSTOM_KEY);
    if (json == null) return [];
    try {
      var value = JSON.parse(json);
      return Array.isArray(value) ? value : [];
    } catch (e) { return []; }
  }

  function saveCustom(list) {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  }

  global.WritingPromptStore = {
    load: load, save: save, loadHistory: loadHistory, saveHistory: saveHistory,
    loadCustom: loadCustom, saveCustom: saveCustom
  };
})(window);
