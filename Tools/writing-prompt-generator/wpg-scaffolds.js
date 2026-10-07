/* Writing Prompt Generator — which sentence starters and which "if you're
   stuck" line go with a prompt. The words are in wpg-scaffold-data.js; this
   file only chooses.

   The choice is a pure function of the prompt's band, genre, text and an
   optional seed: the same prompt gets the same lines on the screen, the poster,
   the half sheet and every copy, and choosing never touches Math.random, so the
   page's random draw of a prompt is exactly what it was before this existed. */
(function (global) {
  'use strict';

  var MAX_STARTERS = 4;
  var MIN_STARTERS = 2;

  // A prompt that is not the common shape for its genre gets lines written for
  // its own shape. These read the prompt's words; a teacher's own prompt gets
  // the same treatment.
  var TASKS = {
    persuasive: [['audience', /^\s*convince\b/i]],
    expository: [['steps', /^\s*explain\s+(how\s+to|the\s+steps|the\s+process\s+of\s+how)\b/i]],
    creative: [['opening', /\bbegins\s*:|\bstarts\s+in\s+the\s+middle\b/i]]
  };
  var DEFAULT_TASK = { narrative: 'any', persuasive: 'position', descriptive: 'any', expository: 'any', creative: 'any' };

  function taskOf(genre, text) {
    var rules = TASKS[genre] || [];
    for (var i = 0; i < rules.length; i++) if (rules[i][1].test(String(text || ''))) return rules[i][0];
    return DEFAULT_TASK[genre] || 'any';
  }

  // FNV-1a, 32 bit, then mixed: the same number for the same text on every machine.
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // a final mix, so two prompts that differ only in their last characters
    // do not put the lines in nearly the same order
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function bandOf(band) { return band === 'hs' ? 'hs' : 'ms'; }

  function startersList(band, genre, text) {
    var D = global.WpgScaffoldData.STARTERS[bandOf(band)];
    var g = D[genre] || D.narrative;
    var list = g[taskOf(genre, text)];
    return list || g[DEFAULT_TASK[genre]] || g.any;
  }

  function stuckList(band, genre) {
    var D = global.WpgScaffoldData.STUCK[bandOf(band)];
    return D[genre] || D.narrative;
  }

  /** n (2 to 4) starters for this prompt, no repeats, always the same ones. */
  function starters(band, genre, text, n, seed) {
    var count = Math.max(MIN_STARTERS, Math.min(MAX_STARTERS, Math.round(Number(n) || 0)));
    var list = startersList(band, genre, text);
    var salt = String(seed == null ? 0 : seed) + '|' + String(text || '');
    return list.map(function (s, i) { return { s: s, k: hash(salt + '|' + i) }; })
      .sort(function (a, b) { return a.k - b.k || (a.s < b.s ? -1 : 1); })
      .slice(0, count)
      .map(function (o) { return o.s; });
  }

  /** The one "if you're stuck" line for this prompt. */
  function stuck(band, genre, text, seed) {
    var list = stuckList(band, genre);
    var salt = String(seed == null ? 0 : seed) + '|stuck|' + String(text || '');
    return list[hash(salt) % list.length];
  }

  /** What a saved or shared choice means: { starters: 0 or 2..4, stuck: bool }.
      Anything else, or nothing, is off. */
  function normalize(v) {
    var out = { starters: 0, stuck: false };
    if (!v || typeof v !== 'object') return out;
    var n = Number(v.starters);
    if (n === 2 || n === 3 || n === 4) out.starters = n;
    if (v.stuck === true) out.stuck = true;
    return out;
  }

  function isOn(v) { var c = normalize(v); return c.starters > 0 || c.stuck; }

  global.WpgScaffolds = {
    MIN_STARTERS: MIN_STARTERS, MAX_STARTERS: MAX_STARTERS,
    taskOf: taskOf, startersList: startersList, stuckList: stuckList,
    starters: starters, stuck: stuck, normalize: normalize, isOn: isOn, hash: hash
  };
})(typeof window !== 'undefined' ? window : globalThis);
