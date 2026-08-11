/* er-match.js — the escape room's answer matching, in one place.

   Two pages have to agree, exactly, on whether a typed answer is right:
   `lock.html`, which students play, and the builder's teacher test-run mode,
   which exists to tell a teacher what students will experience. A second
   implementation of "is this correct" would eventually drift from the first,
   and the whole point of a test run is that it doesn't.

   Plain global script (`window.EscapeRoomMatch`), not an ES module: lock.html
   and 019-escape-room-builder.html are both classic-script pages, same
   convention as _shared/state-link.js.

   The behavior here is lifted verbatim from lock.html, including the
   deliberate split between the two normalizers:

     - digit-lock and cipher answers compare exactly after light normalization
       (case and whitespace), because a digit code or a decoded cipher phrase
       is not the kind of free typing that benefits from forgiveness;
     - text answers ignore case, whitespace and all punctuation, plus an
       optional numeric match within a per-station tolerance.
*/
(function (global) {
  'use strict';

  function normalizeAnswer(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,!?'"]/g, '');
  }

  function normalizeTextAnswer(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
  }

  /** Plain Levenshtein edit distance — used only to decide whether a wrong
      text answer is a near miss worth a gentler message, never to accept an
      answer as correct. */
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var k = 1; k <= n; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        curr[k] = Math.min(prev[k] + 1, curr[k - 1] + 1, prev[k - 1] + cost);
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  /** "Close but not correct" — within a couple of edits of some accepted
      answer, scaled a little for longer answers, but never so loose that a
      genuinely different answer counts as a near miss. */
  function isNearMiss(given, acceptedList) {
    if (!given) return false;
    return acceptedList.some(function (accepted) {
      if (!accepted || accepted === given) return false;
      var dist = levenshtein(given, accepted);
      return dist > 0 && dist <= Math.max(1, Math.min(3, Math.ceil(accepted.length * 0.3)));
    });
  }

  /**
   * Is `rawGiven` an accepted answer for `station`?
   * @returns {{correct: boolean, nearMiss: boolean}}
   */
  function checkAnswer(station, rawGiven) {
    station = station || {};
    var answers = station.answers || [];
    var type = station.type || 'text';

    if (type !== 'text') {
      var givenOld = normalizeAnswer(rawGiven);
      var acceptedOld = answers.map(normalizeAnswer);
      return { correct: givenOld.length > 0 && acceptedOld.indexOf(givenOld) !== -1, nearMiss: false };
    }

    var givenNorm = normalizeTextAnswer(rawGiven);
    var acceptedNorm = answers.map(normalizeTextAnswer);
    var correct = givenNorm.length > 0 && acceptedNorm.indexOf(givenNorm) !== -1;

    if (!correct && station.numericTolerance !== undefined && station.numericTolerance !== null) {
      var givenNum = parseFloat(rawGiven);
      if (!isNaN(givenNum) && String(rawGiven).trim() !== '') {
        correct = answers.some(function (a) {
          var accNum = parseFloat(a);
          return !isNaN(accNum) && Math.abs(accNum - givenNum) <= station.numericTolerance;
        });
      }
    }

    return { correct: correct, nearMiss: correct ? false : isNearMiss(givenNorm, acceptedNorm) };
  }

  global.EscapeRoomMatch = {
    normalizeAnswer: normalizeAnswer,
    normalizeTextAnswer: normalizeTextAnswer,
    levenshtein: levenshtein,
    isNearMiss: isNearMiss,
    checkAnswer: checkAnswer
  };
})(window);
