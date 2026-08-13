/* Writing Prompt Generator — localStorage persistence (last-used settings
   and a dated history of recently shown prompts, kept across sessions). */
(function (global) {
  'use strict';

  var KEY = 'gvb-writing-prompts:settings';
  var HISTORY_KEY = 'gvb-writing-prompts:history';
  var CUSTOM_KEY = 'gvb-writing-prompts:custom';
  var SETS_KEY = 'gvb-writing-prompts:sets';
  var ACTIVE_SET_KEY = 'gvb-writing-prompts:activeSet';
  var RECORD_KEY = 'gvb-writing-prompts:record';

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

  /* Prompt sets: teacher-planned sequences of specific prompts, advanced by
     date or by hand, instead of a random draw each day. */
  function loadSets() {
    var json = localStorage.getItem(SETS_KEY);
    if (json == null) return [];
    try {
      var value = JSON.parse(json);
      return Array.isArray(value) ? value : [];
    } catch (e) { return []; }
  }

  function saveSets(sets) {
    localStorage.setItem(SETS_KEY, JSON.stringify(sets));
  }

  function loadActiveSetId() {
    return localStorage.getItem(ACTIVE_SET_KEY) || null;
  }

  function saveActiveSetId(id) {
    if (id) localStorage.setItem(ACTIVE_SET_KEY, id);
    else localStorage.removeItem(ACTIVE_SET_KEY);
  }

  /* Writing Record: a teacher-typed, per-student log of which prompt each
     student wrote to and the teacher's conference note about it — the
     "student writing portfolio" major feature, teacher-maintained (students
     are not intended users of this site; see the improvement-prompts doc's
     "Deferred — student-facing" section). Shape:
       { [studentName]: [ { id, date, promptText, band, genre, rubricName, note } ] }
     Keyed by exact student name string (as typed/picked), newest entry last
     within each array — callers sort for display. */
  function loadRecord() {
    var json = localStorage.getItem(RECORD_KEY);
    if (json == null) return {};
    try {
      var value = JSON.parse(json);
      return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    } catch (e) { return {}; }
  }

  function saveRecord(record) {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  }

  global.WritingPromptStore = {
    load: load, save: save, loadHistory: loadHistory, saveHistory: saveHistory,
    loadCustom: loadCustom, saveCustom: saveCustom,
    loadSets: loadSets, saveSets: saveSets,
    loadActiveSetId: loadActiveSetId, saveActiveSetId: saveActiveSetId,
    loadRecord: loadRecord, saveRecord: saveRecord
  };
})(window);
