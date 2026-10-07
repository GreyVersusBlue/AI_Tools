/* Quiz / Review Game Board — the question bank, as this page reads it.
   Since v265 the bank is the site's shared one (_shared/question-bank.js, key
   'gvb-question-bank'); this file is the page's view of it and stores nothing
   itself. Its surface is what it was when the bank was this tool's own key
   ('gvb-review-board-bank:entries'): entries of { id, question, answer,
   points, unit, standard, difficulty, createdAt }, in the teacher's order.
   The shared module moves that old key's entries over (and says exactly how,
   in its header); a question's other fields (choices, tags, media) are kept
   in the shared bank and left alone by a save from here.

   Since v267 the page can also read a SEED SET: a tool's built-in questions,
   published read-only through QuestionBank.registerSet() (053's and 062's so
   far). `source` below is '' for the teacher's own bank or a set's id. A set
   is listed, filtered and pulled into a board exactly as the bank is, but it
   is never saved to or deleted from: copyToBank() is the one way a seed
   question reaches the teacher's storage, as a new question of their own.

   A board that pulls from the bank still gets its own COPY of the entry
   (plain points/question/answer fields on the clue), not a live reference, so
   editing or deleting a bank entry later never changes a board that already
   used it. */
(function (global) {
  'use strict';

  var QB = global.QuestionBank;

  /** The questions of `source`: the teacher's bank for '' (or nothing), a
      seed set's for its id. The shared module's, since 040 lists them too. */
  function questionsOf(source) {
    return QB.questionsOf(source);
  }

  function listEntries(source) {
    return questionsOf(source).map(QB.toLegacy);
  }

  /** What the page can list: the teacher's bank first, then every seed set.
      [{ id, title, source, note, count, readOnly }] */
  function sources() {
    return QB.sources();
  }

  /** Any entry the page can show, by id: a seed's or the bank's. */
  function findEntry(id) {
    if (QB.isSeedId(id)) { var seed = QB.findSeed(id); return seed ? QB.toLegacy(seed) : null; }
    var hit = QB.list().filter(function (q) { return q.id === id; })[0];
    return hit ? QB.toLegacy(hit) : null;
  }

  /** Copies seed questions into the teacher's bank. Returns { ok, added,
      skipped, missing } and the write's own flags. */
  function copyToBank(ids) {
    return QB.copyFromSet(ids);
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
  function distinctValues(field, source) {
    return QB.distinct(questionsOf(source), field);
  }

  /** Entries matching every non-empty filter field; `query` matches question
      or answer text, case-insensitively. All filters are optional/ANDed. */
  function filterEntries(filters, source) {
    return QB.filter(questionsOf(source), filters).map(QB.toLegacy);
  }

  global.ReviewBankStore = {
    DIFFICULTIES: QB.DIFFICULTIES,
    listEntries: listEntries,
    sources: sources,
    findEntry: findEntry,
    copyToBank: copyToBank,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    distinctValues: distinctValues,
    filterEntries: filterEntries
  };
})(window);
