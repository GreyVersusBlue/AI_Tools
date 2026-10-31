/* Vocabulary Flashcard & Word Wall Generator — the study printables (Path 19 P4).

   Pure functions, no DOM, no storage, no clock: the same discipline as
   vfg-printables.js. Every function takes the `{term, definition, example,
   pronunciation, partOfSpeech}` items VocabLayout.parseWordList() makes and
   returns plain data the page turns into markup. Nothing here names a student:
   a schedule belongs to a list, a unit to a word.

     frayer(items, opts)       one Frayer-model page per word (definition,
                               characteristics, examples, non-examples)
     cloze(items, opts)        fill-in-the-blank sentences from each word's
                               `example`, with a word bank and a key
     schedule(items, opts)     which words to learn and which to review, on which
                               teaching day, for a printed drill
     unitOf / withUnit         a word's unit is a `unit:<name>` tag on the hub word
     wallSystem(items, units)  cards by unit, the printable index, the take-down list

   Randomness is seeded from the words (hashString + mulberry32, copied from
   vfg-printables.js's public surface), so the same list prints the same sheet. */
(function (global) {
  'use strict';

  var P = global.VfgPrintables;

  function str(v) { return v == null ? '' : String(v).trim(); }

  /* ---------- Frayer model ---------- */

  /* opts.fill: 'blank' leaves all four boxes empty; 'known' puts the word's own
     definition in the first box and its example in the third (whatever the list holds).
     opts.perPage: 1 or 2. Words are never dropped: a word with no definition just has an empty box. */
  function frayer(items, opts) {
    opts = opts || {};
    var fill = opts.fill === 'known' ? 'known' : 'blank';
    var perPage = opts.perPage === 2 ? 2 : 1;
    var list = (items || []).filter(function (it) { return it && str(it.term); });
    if (!list.length) return { ok: false, reason: 'too-few', have: 0, minItems: 1 };
    var sheets = list.map(function (it) {
      return {
        term: str(it.term),
        partOfSpeech: str(it.partOfSpeech),
        definition: fill === 'known' ? str(it.definition) : '',
        characteristics: '',
        examples: fill === 'known' ? str(it.example) : '',
        nonExamples: ''
      };
    });
    var pages = [];
    for (var i = 0; i < sheets.length; i += perPage) pages.push(sheets.slice(i, i + perPage));
    return { ok: true, fill: fill, perPage: perPage, sheets: sheets, pages: pages };
  }

  /* ---------- fill-in-the-blank ---------- */

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Letters of any alphabet count as letters (so a word may end in an accented one) and
     so does an apostrophe inside a word. */
  var LETTER = '[\\p{L}\\p{M}\\p{N}]';

  /* The sentence with the first whole-word, case-insensitive occurrence of `term` replaced by a
     blank; null when the term does not appear. A longer word that merely contains the term
     (cat in category) is not a match. */
  function blankOut(sentence, term) {
    var t = str(term), s = String(sentence || '');
    if (!t || !s) return null;
    var re = new RegExp('(^|[^\\p{L}\\p{M}\\p{N}])(' + escapeRe(t) + ')(?!' + LETTER + ')', 'iu');
    var m = re.exec(s);
    if (!m) return null;
    var at = m.index + m[1].length;
    return { before: s.slice(0, at), answer: s.slice(at, at + t.length), after: s.slice(at + t.length) };
  }

  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* opts.bank: put a shuffled word bank on the sheet (default true). A word with no example, or whose
     example does not contain it, is reported in `skipped` with the reason, never invented. */
  function cloze(items, opts) {
    opts = opts || {};
    var rows = [], skipped = [];
    (items || []).forEach(function (it) {
      if (!it || !str(it.term)) return;
      if (!str(it.example)) { skipped.push({ term: str(it.term), why: 'no example' }); return; }
      var b = blankOut(it.example, it.term);
      if (!b) { skipped.push({ term: str(it.term), why: 'example does not contain the word' }); return; }
      rows.push({ term: str(it.term), before: b.before, after: b.after, answer: b.answer });
    });
    if (rows.length < 2) return { ok: false, reason: 'too-few', have: rows.length, minItems: 2, skipped: skipped };
    var seed = P.hashString(rows.map(function (r) { return r.answer; }).join('|'));
    var bank = opts.bank === false ? [] : shuffle(rows.map(function (r) { return r.answer; }), P.mulberry32(seed));
    return { ok: true, rows: rows, bank: bank, skipped: skipped };
  }

  /* ---------- spaced repetition for a printed drill ---------- */

  var DEFAULT_STEPS = [1, 3, 7, 14];

  function cleanSteps(steps) {
    var out = [], seen = {};
    (Array.isArray(steps) ? steps : DEFAULT_STEPS).forEach(function (n) {
      n = Math.floor(Number(n));
      if (n >= 1 && n <= 60 && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    out.sort(function (a, b) { return a - b; });
    return out.length ? out : DEFAULT_STEPS.slice();
  }

  /* 'YYYY-MM-DD' -> a UTC day number, or null. Dates are read and written as UTC days so the plan
     never depends on the machine's zone or clock. */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(s));
    if (!m) return null;
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(ms);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return Math.floor(ms / 86400000);
  }
  function fmtDate(day) {
    var d = new Date(day * 86400000);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function isWeekend(day) { var w = new Date(day * 86400000).getUTCDay(); return w === 0 || w === 6; }

  /* opts: perDay (new words each teaching day, 1-20, default 5), steps (teaching days after the
     day a word is learned on which it is reviewed; default 1, 3, 7, 14), start ('YYYY-MM-DD' or '':
     with none the days are only numbered, with one the weekend is skipped), maxDays (cap, 60).
     Day n learns words (n-1)*perDay .. n*perDay-1 in list order and reviews every word whose
     learning day was n - step. The plan ends the day the last review falls. */
  function schedule(items, opts) {
    opts = opts || {};
    var words = (items || []).map(function (it) { return it && str(it.term); }).filter(Boolean);
    if (!words.length) return { ok: false, reason: 'too-few', have: 0, minItems: 1 };
    var perDay = Math.max(1, Math.min(20, Math.floor(Number(opts.perDay)) || 5));
    var steps = cleanSteps(opts.steps);
    var maxDays = Math.max(1, Math.min(120, Math.floor(Number(opts.maxDays)) || 60));
    var learnDays = Math.ceil(words.length / perDay);
    var lastDay = Math.min(maxDays, learnDays + steps[steps.length - 1]);
    var start = parseDate(opts.start);
    var cursor = start;
    var days = [];
    for (var n = 1; n <= lastDay; n++) {
      if (cursor != null) { while (isWeekend(cursor)) cursor++; }
      var learn = words.slice((n - 1) * perDay, n * perDay);
      var review = [];
      steps.forEach(function (st) {
        var d = n - st;
        if (d >= 1) words.slice((d - 1) * perDay, d * perDay).forEach(function (w) { review.push({ term: w, step: st }); });
      });
      days.push({ n: n, date: cursor == null ? '' : fmtDate(cursor), learn: learn, review: review });
      if (cursor != null) cursor++;
    }
    return { ok: true, perDay: perDay, steps: steps, words: words.length, dated: start != null, days: days,
      truncated: learnDays + steps[steps.length - 1] > maxDays };
  }

  /* ---------- word wall as a system ---------- */

  var UNIT_PREFIX = 'unit:';

  /* The unit a hub word belongs to: its first `unit:<name>` tag, '' for none. */
  function unitOf(tags) {
    var list = Array.isArray(tags) ? tags : [];
    for (var i = 0; i < list.length; i++) {
      var t = str(list[i]);
      if (t.toLowerCase().indexOf(UNIT_PREFIX) === 0 && str(t.slice(UNIT_PREFIX.length))) return str(t.slice(UNIT_PREFIX.length));
    }
    return '';
  }

  /* The tags with the unit replaced ('' removes it). Every other tag stays, in order. */
  function withUnit(tags, unit) {
    var out = (Array.isArray(tags) ? tags : []).filter(function (t) { return str(t).toLowerCase().indexOf(UNIT_PREFIX) !== 0; });
    var u = str(unit).replace(/[;,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (u) out.push(UNIT_PREFIX + u);
    return out;
  }

  var NO_UNIT = 'No unit';

  function termKey(t) { return str(t).toLowerCase(); }

  /* items: the list's items; unitFor(term) -> unit name or ''; retired: unit names taken down.
     Returns the units in first-seen order, each with its items in list order, the retired ones
     apart, and the alphabetical index (every word of an up unit, with its unit and the card's
     position in its unit: "Unit 2, card 3"). */
  function wallSystem(items, unitFor, retired) {
    var gone = {};
    (retired || []).forEach(function (u) { gone[str(u)] = true; });
    var order = [], by = {};
    (items || []).forEach(function (it) {
      if (!it || !str(it.term)) return;
      var u = str(unitFor ? unitFor(it.term) : '') || NO_UNIT;
      if (!by[u]) { by[u] = []; order.push(u); }
      by[u].push(it);
    });
    var up = [], down = [];
    order.forEach(function (u) { (gone[u] ? down : up).push({ unit: u, items: by[u] }); });
    var index = [];
    up.forEach(function (g) {
      g.items.forEach(function (it, i) { index.push({ term: str(it.term), unit: g.unit, card: i + 1 }); });
    });
    index.sort(function (a, b) {
      var c = termKey(a.term).localeCompare(termKey(b.term), 'en', { sensitivity: 'base' });
      return c || (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0);
    });
    return { ok: up.length + down.length > 0, reason: up.length + down.length ? undefined : 'too-few', have: 0, minItems: 1,
      units: up, retired: down, index: index,
      unitNames: order };
  }

  global.VfgStudy = {
    frayer: frayer, cloze: cloze, blankOut: blankOut,
    schedule: schedule, DEFAULT_STEPS: DEFAULT_STEPS.slice(), parseDate: parseDate, fmtDate: fmtDate,
    unitOf: unitOf, withUnit: withUnit, wallSystem: wallSystem, NO_UNIT: NO_UNIT
  };
})(typeof window !== 'undefined' ? window : global);
