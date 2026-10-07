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

  var KINDS = ['title', 'date', 'both'];
  var PICKS = ['random', 'nth', 'hand'];

  /**
   * What a saved or received worksheet says about WHAT is blanked and WHICH
   * events. A timeline saved before dates could be blanked has none of these
   * fields and means "titles, a seeded pick of `count`" — exactly what it
   * always did. Anything unrecognised (a hand-built share link) falls back to
   * that too, so nothing a link carries can reach the page as a surprise.
   */
  function normalizeBlank(raw) {
    var r = raw && typeof raw === 'object' ? raw : {};
    var nth = Math.round(Number(r.nth));
    var hand = [];
    if (Array.isArray(r.hand)) {
      r.hand.forEach(function (id) {
        if (typeof id === 'number' && isFinite(id) && hand.indexOf(id) === -1) hand.push(id);
      });
    }
    return {
      kind: KINDS.indexOf(r.kind) !== -1 ? r.kind : 'title',
      pick: PICKS.indexOf(r.pick) !== -1 ? r.pick : 'random',
      nth: nth >= 1 && nth <= 50 ? nth : 2,
      hand: hand
    };
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
  function chooseBlanks(events, count, version, opts) {
    var eligible = chronological(events).filter(function (e) { return !!(e.title || '').trim(); });
    var o = normalizeBlank(opts);
    if (o.pick === 'nth') {
      // Every nth event along the strip. Each version starts one event later
      // than the one before, so with n versions every event is blanked once.
      var offset = ((version || 1) - 1) % o.nth;
      return eligible.filter(function (e, i) { return i % o.nth === offset; });
    }
    if (o.pick === 'hand') {
      var chosen = {};
      o.hand.forEach(function (id) { chosen[id] = true; });
      return eligible.filter(function (e) { return chosen[e.id] === true; });
    }
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
  function buildItems(events, count, version, opts) {
    return chooseBlanks(events, count, version, opts).map(function (ev, i) {
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

  /** The bank for a date blank: every removed date label, shuffled with a
      seed of its own. Sharing the title bank's seed would apply the same
      permutation to both lists, and with "both" blanked the i-th title would
      sit beside its own date. */
  function dateBank(items, version, labelOf) {
    return shuffled((items || []).map(function (it) { return labelOf(it.event); }), (version || 1) * 7717 + 101);
  }

  /* ---------- printed ordering activity ----------
     The events that have a title, dealt out in an order a student has to
     undo. The deal is a pure function of the events and a stored seed, so a
     reprint is the same paper the key on the desk was made for. */

  function cleanSeed(v) {
    var n = Math.floor(Number(v));
    return n >= 1 && n <= 2147483647 ? n : 1;
  }

  function inChronologicalOrder(list) {
    for (var i = 1; i < list.length; i++) {
      if (list[i].yearStart < list[i - 1].yearStart) return false;
    }
    return true;
  }

  function dealOrder(sorted, seed, attempt) {
    return shuffled(sorted, (cleanSeed(seed) * 104729 + attempt * 7919) >>> 0);
  }

  /**
   * `cards`: the shuffled events, numbered 1..n in the order they are dealt.
   * `key`: the right order, each with the number of its card, and `tied` when
   * its year is the same as a neighbour's (those two may go either way round).
   *
   * With three or more events the deal is never already in order: a draw that
   * comes out right is redrawn from the same seed, so the redraw is as
   * repeatable as the first. When every event is in one year there is no wrong
   * order to deal and the first draw stands.
   */
  function deal(events, seed) {
    var sorted = chronological(events).filter(function (e) { return !!(e.title || '').trim(); });
    var arr = dealOrder(sorted, seed, 0);
    var allSame = sorted.every(function (e) { return e.yearStart === sorted[0].yearStart; });
    if (sorted.length >= 3 && !allSame) {
      for (var k = 1; inChronologicalOrder(arr) && k < 200; k++) arr = dealOrder(sorted, seed, k);
    }
    var cards = arr.map(function (ev, i) { return { label: i + 1, event: ev }; });
    var key = sorted.map(function (ev, i) {
      var label = 0;
      arr.forEach(function (c, j) { if (c === ev) label = j + 1; });
      var tied = (i > 0 && sorted[i - 1].yearStart === ev.yearStart) ||
                 (i < sorted.length - 1 && sorted[i + 1].yearStart === ev.yearStart);
      return { position: i + 1, label: label, event: ev, tied: tied };
    });
    return { cards: cards, key: key };
  }

  /** The seed Reshuffle moves to: the next one whose deal differs from the
      current deal, so pressing the button always changes the paper (when more
      than one order exists at all). */
  function nextSeed(events, seed) {
    var now = deal(events, seed).cards.map(function (c) { return c.event.id; }).join(',');
    var s = cleanSeed(seed);
    for (var i = 0; i < 500; i++) {
      s = s >= 2147483647 ? 1 : s + 1;
      if (deal(events, s).cards.map(function (c) { return c.event.id; }).join(',') !== now) return s;
    }
    return s;
  }

  global.TimelineWorksheet = {
    mulberry32: mulberry32,
    shuffled: shuffled,
    chooseBlanks: chooseBlanks,
    buildItems: buildItems,
    blankNumberMap: blankNumberMap,
    wordBank: wordBank,
    dateBank: dateBank,
    normalizeBlank: normalizeBlank,
    cleanSeed: cleanSeed,
    deal: deal,
    nextSeed: nextSeed
  };
})(typeof window !== 'undefined' ? window : global);
