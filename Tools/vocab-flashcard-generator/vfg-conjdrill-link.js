/* Vocabulary Flashcard & Word Wall Generator — read-only bridge to Vocab &
   Conjugation Drill Generator's saved vocabulary drill sets, so a word list
   typed there doesn't have to be retyped here.

   This depends on Vocab & Conjugation Drill Generator's own localStorage
   contract (Tools/vocab-conjugation-drill.html): a list of drill-set names
   under 'gvb-vocab-conj:list', one JSON blob per name under
   'gvb-vocab-conj:data:<name>', each blob holding a `vocabText` string in
   that tool's own "word: translation" per-line format (see its `parseVocab`).

   Deliberately read-only: this file never writes anything back to the other
   tool's keys, and it re-implements just enough of that tool's own parsing
   (colon-split only — the drill tool doesn't support the tab/CSV/pipe
   extensions this tool's own word list does) to convert a saved set into
   the small shared vocabulary-item shape this tool already uses internally:
   { term, definition, example, pronunciation, partOfSpeech }. The drill
   tool only ever stores word/translation, so example/pronunciation/
   partOfSpeech always come back empty — nothing is invented on import. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-vocab-conj:list';
  var DATA_PREFIX = 'gvb-vocab-conj:data:';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listConjDrillSets() {
    var names = safeParse(localStorage.getItem(LIST_KEY), []);
    return Array.isArray(names) ? names.filter(function (n) { return typeof n === 'string' && n; }) : [];
  }

  /** Minimal reimplementation of vocab-conjugation-drill.html's own
      parseVocab — colon-separated "word: translation" lines only. */
  function parseDrillVocabText(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var idx = trimmed.indexOf(':');
      if (idx === -1) { out.push({ word: trimmed, translation: '' }); return; }
      var word = trimmed.slice(0, idx).trim();
      var translation = trimmed.slice(idx + 1).trim();
      if (word) out.push({ word: word, translation: translation });
    });
    return out;
  }

  /** Returns the shared-shape vocabulary items for a saved drill set, or
      an empty array if the name isn't found or the set has no vocab text
      (e.g. a conjugation-only set). Read-only — never writes anything. */
  function getConjDrillItems(name) {
    if (!name) return [];
    var data = safeParse(localStorage.getItem(DATA_PREFIX + name), null);
    if (!data || typeof data.vocabText !== 'string') return [];
    return parseDrillVocabText(data.vocabText).map(function (it) {
      return { term: it.word, definition: it.translation, example: '', pronunciation: '', partOfSpeech: '' };
    });
  }

  global.VfgConjDrillLink = {
    listConjDrillSets: listConjDrillSets,
    getConjDrillItems: getConjDrillItems
  };
})(window);
