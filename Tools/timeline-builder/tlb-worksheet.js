/* Timeline Builder — timeline worksheet (blank-the-events) selection math.

   The paper counterpart of the on-screen timeline: the same spatial strip a
   class has been looking at all unit, with some of its events replaced by
   numbered blanks, a word bank of the titles that were removed, and a matching
   answer key.

   Follows the Blank Map Generator's worksheet generator
   (`046-blank-map-generator.html`: numbered blanks on the artwork, a numbered
   answer line per blank, an optional shuffled word bank, an answer key page,
   and a seeded PRNG so "version 3" is the same paper every time it is
   generated). The seeded shuffle is the part worth copying exactly — a teacher
   who loses one copy of version 3 has to be able to reprint *that* copy, not a
   new random one, or the answer key on their desk stops matching.

   One deliberate difference from the map tool: there, version 1 numbers items
   in reading order and later versions shuffle the *numbering*, because every
   version of a map worksheet blanks the same labels. Here the versions differ
   in **which events are blanked** instead, so numbering can stay chronological
   (left to right along the strip, the way a timeline is read) and still leave
   two students side by side with different papers. */
(function (global) {
  'use strict';

  /** Small seeded PRNG — same one the map tool uses, for the same reason:
      a given version has to reproduce byte for byte on a reprint. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, seed) {
    var out = (list || []).slice();
    var rand = mulberry32(seed);
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function chronological(events) {
    return (events || []).slice().sort(function (a, b) { return a.yearStart - b.yearStart; });
  }

  /**
   * Which events this version blanks: a seeded pick of `count` of them, put
   * back into chronological order so the numbers still run left to right along
   * the printed strip.
   *
   * `count` is clamped to what actually exists — asking for 10 blanks on a
   * six-event timeline blanks all six rather than producing four phantom
   * answer lines with nothing behind them.
   *
   * An event with no title can't be an answer (there would be nothing to put
   * in the word bank or on the key), so it is never chosen — the same rule the
   * map tool applies to uncaptioned markers.
   */
  function chooseBlanks(events, count, version) {
    var eligible = chronological(events).filter(function (e) { return !!(e.title || '').trim(); });
    var n = Math.max(0, Math.min(eligible.length, Math.round(count || 0)));
    if (!n) return [];
    if (n === eligible.length) return eligible;
    var picked = shuffled(eligible, (version || 1) * 9973).slice(0, n);
    return chronological(picked);
  }

  /**
   * The full item list for one version: `{number, event}` per blank, numbered
   * 1..N chronologically. The number a student reads on the strip and the
   * number on their answer line are this one value, so they cannot drift.
   */
  function buildItems(events, count, version) {
    return chooseBlanks(events, count, version).map(function (ev, i) {
      return { number: i + 1, event: ev };
    });
  }

  /** `{eventId: number}` — the shape renderTimelineCanvas wants, so the strip
      renderer never has to know what a worksheet is. */
  function blankNumberMap(items) {
    var map = {};
    (items || []).forEach(function (it) { map[it.event.id] = it.number; });
    return map;
  }

  /** The word bank: every removed title, shuffled with its own seed so the
      bank's order is not the answer order (which would make the whole sheet a
      matching exercise a student can finish without reading the timeline). */
  function wordBank(items, version) {
    return shuffled((items || []).map(function (it) { return it.event.title; }), (version || 1) * 7717 + 13);
  }

  global.TimelineWorksheet = {
    mulberry32: mulberry32,
    shuffled: shuffled,
    chooseBlanks: chooseBlanks,
    buildItems: buildItems,
    blankNumberMap: blankNumberMap,
    wordBank: wordBank
  };
})(typeof window !== 'undefined' ? window : global);
