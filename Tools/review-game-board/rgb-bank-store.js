/* Quiz / Review Game Board — reusable question bank persistence.
   A separate localStorage key prefix from rgb-store.js's saved boards
   (gvb-review-board:*) on purpose: the bank is not a board and must not be
   overloaded onto that store's list/data shape. It is one flat list of
   entries, each tagged by unit/standard/difficulty, that any board's editor
   can pull from — a board that pulls from the bank gets its own COPY of the
   entry (plain points/question/answer fields on the clue), not a live
   reference, so editing or deleting a bank entry later never changes a
   board that already used it. That mirrors the one-way JSON-import pattern
   already used elsewhere in this tool (import copies in, source and copy
   are independent from then on). */
(function (global) {
  'use strict';

  var ENTRIES_KEY = 'gvb-review-board-bank:entries';
  var DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listEntries() {
    var list = safeParse(localStorage.getItem(ENTRIES_KEY), []);
    return Array.isArray(list) ? list : [];
  }

  function genId() {
    return 'bank-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /** Upserts by id (a missing/blank id creates a new entry). Returns the
      stored entry, normalized to the full field set — anything the caller
      didn't provide comes back as a blank/default rather than undefined, so
      every stored record has the same shape regardless of how it arrived
      (typed in, or a future import path). */
  function saveEntry(entry) {
    var list = listEntries();
    var id = (entry && entry.id) || genId();
    var normalized = {
      id: id,
      question: String((entry && entry.question) || '').trim(),
      answer: String((entry && entry.answer) || '').trim(),
      points: Number(entry && entry.points) || 0,
      unit: String((entry && entry.unit) || '').trim(),
      standard: String((entry && entry.standard) || '').trim(),
      difficulty: DIFFICULTIES.indexOf(entry && entry.difficulty) !== -1 ? entry.difficulty : '',
      createdAt: (entry && entry.createdAt) || new Date().toISOString()
    };
    var idx = list.findIndex(function (e) { return e.id === id; });
    if (idx === -1) list.push(normalized); else list[idx] = normalized;
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(list));
    return normalized;
  }

  function deleteEntry(id) {
    var list = listEntries().filter(function (e) { return e.id !== id; });
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(list));
  }

  /** Distinct, non-blank values already used for `field` (unit or standard),
      sorted — what the filter dropdowns are populated from, since those two
      tags are free text the teacher defines as they go rather than a fixed
      list. */
  function distinctValues(field) {
    var seen = {};
    var out = [];
    listEntries().forEach(function (e) {
      var v = e[field];
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  /** Entries matching every non-empty filter field; `query` matches question
      or answer text, case-insensitively. All filters are optional/ANDed. */
  function filterEntries(filters) {
    filters = filters || {};
    var q = (filters.query || '').trim().toLowerCase();
    return listEntries().filter(function (e) {
      if (filters.unit && e.unit !== filters.unit) return false;
      if (filters.standard && e.standard !== filters.standard) return false;
      if (filters.difficulty && e.difficulty !== filters.difficulty) return false;
      if (q && e.question.toLowerCase().indexOf(q) === -1 && e.answer.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  global.ReviewBankStore = {
    DIFFICULTIES: DIFFICULTIES,
    listEntries: listEntries,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    distinctValues: distinctValues,
    filterEntries: filterEntries
  };
})(window);
