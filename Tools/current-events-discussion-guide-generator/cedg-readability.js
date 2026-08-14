/* cedg-readability.js — a rough reading-level estimate for a pasted article.

   Pure: text in, numbers out. No DOM, no state, so the arithmetic can be
   checked in Node without a browser.

   What this is for: a teacher pastes an article and wants to know, before
   building a whole guide around it, whether it is anywhere near their
   class. That is the entire scope. It is a *gauge*, not a placement test,
   and every string it produces says so.

   Why Flesch–Kincaid: it needs only sentence length and syllable count, both
   of which can be computed from the text itself with no word list to ship,
   no network, and no per-language data — the constraints this site works
   under. Its well-known weaknesses are stated in the caveats it returns
   rather than hidden: it cannot see vocabulary difficulty, it cannot see
   sentence complexity beyond length, and a long proper noun ("Massachusetts
   legislature") inflates it while a short hard word ("writ") does not. A
   news article about a familiar local topic and one about monetary policy
   can score the same and be nothing like each other in a classroom.

   The syllable counter is a heuristic — vowel groups, minus a silent final
   'e', with a floor of one. It is wrong on some words (every English
   syllable counter is), and it is wrong in both directions rather than
   systematically, which is what keeps the average usable across a few
   hundred words. Below ~40 words the estimate is not reported at all: the
   sample is too small for the average to mean anything, and a confident
   wrong number is worse than no number. */
(function (global) {
  'use strict';

  /** Sentences, by terminal punctuation. Abbreviations ("Mr.", "Sept.")
   *  split a sentence early and nudge the estimate down; that error is small
   *  next to the method's own, and the alternative is shipping an
   *  abbreviation list that would still miss the next one. */
  function splitSentences(text) {
    return String(text || '')
      .split(/[.!?]+(?:\s|$)/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function splitWords(text) {
    return String(text || '')
      .split(/\s+/)
      .map(function (w) { return w.replace(/^[^A-Za-z0-9'’-]+|[^A-Za-z0-9'’-]+$/g, ''); })
      .filter(function (w) { return w.length > 0; });
  }

  /** Vowel groups, minus a silent final 'e', floor of 1.
   *
   *  The one exception worth coding: a final consonant + "le" is its own
   *  syllable ("ar-ti-cle", "ta-ble", "peo-ple"), so the 'e' is not silent
   *  there and stripping it undercounts a whole class of ordinary words —
   *  including "article", which this tool prints on every page. */
  function syllables(word) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    if (!/[^aeiou]le$/.test(w)) w = w.replace(/e$/, '');
    var groups = w.match(/[aeiouy]+/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  /**
   * { words, sentences, avgWordsPerSentence, avgSyllablesPerWord, grade,
   *   band, longWordPct, enough }
   *
   * `grade` is the Flesch–Kincaid grade level, clamped to 1..16 (the formula
   * happily returns 25 for one run-on sentence, which tells a teacher
   * nothing). `enough` is false for a sample too short to characterise, and
   * a caller must not show a number when it is false.
   */
  function analyze(text) {
    var words = splitWords(text);
    var sentences = splitSentences(text);
    var wordCount = words.length;
    var sentenceCount = Math.max(1, sentences.length);
    var syllableTotal = 0, longWords = 0;
    words.forEach(function (w) {
      var s = syllables(w);
      syllableTotal += s;
      if (s >= 3) longWords++;
    });

    var avgWords = wordCount / sentenceCount;
    var avgSyll = wordCount ? (syllableTotal / wordCount) : 0;
    var raw = 0.39 * avgWords + 11.8 * avgSyll - 15.59;
    var grade = Math.max(1, Math.min(16, Math.round(raw * 10) / 10));

    return {
      words: wordCount,
      sentences: sentences.length,
      avgWordsPerSentence: Math.round(avgWords * 10) / 10,
      avgSyllablesPerWord: Math.round(avgSyll * 100) / 100,
      longWordPct: wordCount ? Math.round((longWords / wordCount) * 100) : 0,
      grade: grade,
      band: bandFor(grade),
      enough: wordCount >= MIN_WORDS
    };
  }

  var MIN_WORDS = 40;

  /** A range, never a single grade — the method is not precise enough to
   *  name one, and a teacher reads "grade 9" as a fact while they read
   *  "around grades 8–10" as the estimate it is. */
  function bandFor(grade) {
    if (grade <= 4) return 'around grades 3–5';
    if (grade <= 6) return 'around grades 5–7';
    if (grade <= 8) return 'around grades 7–9';
    if (grade <= 10) return 'around grades 9–11';
    if (grade <= 12) return 'around grades 11–12';
    return 'college level';
  }

  /** One short line for the editor: length, read time, and the band. Returns
   *  '' for empty text, and omits the estimate (keeping the word count) when
   *  the sample is too short to support one. */
  function summaryLine(text) {
    var a = analyze(text);
    if (!a.words) return '';
    var line = a.words + ' words · about ' + Math.max(1, Math.round(a.words / 200)) + ' min read';
    if (!a.enough) return line + ' · too short to estimate a reading level';
    return line + ' · reads ' + a.band +
      ' (avg ' + a.avgWordsPerSentence + ' words/sentence, ' + a.longWordPct + '% long words)';
  }

  global.CedgReadability = {
    analyze: analyze,
    summaryLine: summaryLine,
    splitWords: splitWords,
    splitSentences: splitSentences,
    syllables: syllables,
    bandFor: bandFor,
    MIN_WORDS: MIN_WORDS
  };
})(typeof window !== 'undefined' ? window : global);
