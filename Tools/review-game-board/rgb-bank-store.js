/* Quiz / Review Game Board — the question bank, as this page reads it.
   Since v265 the bank is the site's shared one (_shared/question-bank.js, key
   'gvb-question-bank'); this file is the page's view of it and stores nothing
   itself. Its surface is what it was when the bank was this tool's own key
   ('gvb-review-board-bank:entries'): entries of { id, question, answer,
   points, unit, standard, difficulty, createdAt }, in the teacher's order.
   The shared module moves that old key's entries over (and says exactly how,
   in its header); a question's other fields (choices, tags, media) are kept
   in the shared bank and left alone by a save from here.

   A board that pulls from the bank still gets its own COPY of the entry
   (plain points/question/answer fields on the clue), not a live reference, so
   editing or deleting a bank entry later never changes a board that already
   used it. */
(function (global) {
  'use strict';

  var QB = global.QuestionBank;

  function listEntries() {
    return QB.list().map(QB.toLegacy);
  }

  /** Upserts by id (a missing/blank id creates a new entry). Returns the
      stored entry in this page's shape. */
  function saveEntry(entry) {
    entry = entry || {};
    var q = {
      prompt: entry.question, answer: entry.answer, points: entry.points,
      unit: entry.unit, standard: entry.standard,
      // The page's own three, exactly as its select spells them.
      difficulty: QB.DIFFICULTIES.indexOf(entry.difficulty) !== -1 ? entry.difficulty : ''
    };
    if (entry.id) q.id = entry.id;
    if (entry.createdAt) q.createdAt = entry.createdAt;
    return QB.toLegacy(QB.saveQuestion(q).question);
  }

  function deleteEntry(id) {
    QB.deleteQuestion(id);
  }

  /** Distinct, non-blank values already used for `field` (unit or standard),
      sorted — what the filter dropdowns are populated from. */
  function distinctValues(field) {
    return QB.distinct(QB.list(), field);
  }

  /** Entries matching every non-empty filter field; `query` matches question
      or answer text, case-insensitively. All filters are optional/ANDed. */
  function filterEntries(filters) {
    return QB.filter(QB.list(), filters).map(QB.toLegacy);
  }

  global.ReviewBankStore = {
    DIFFICULTIES: QB.DIFFICULTIES,
    listEntries: listEntries,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    distinctValues: distinctValues,
    filterEntries: filterEntries
  };
})(window);
