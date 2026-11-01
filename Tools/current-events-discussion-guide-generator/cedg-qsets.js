/* cedg-qsets.js — the teacher's bank of saved question sets for 054 Current
   Events Discussion Guide Generator. A plain script that publishes one global,
   `CedgSets`, so the page can call it and a pure-Node suite can import it.

   The six built-in guiding questions are one fixed set. A teacher who wants a
   set skewed toward persuasive-writing follow-up, or toward historical
   context, saves the questions a guide is asking as a named set and swaps it
   in on the next guide. A set is only a list of question texts; it holds
   nothing about an article or a student.

   Stored under `cedg_qsets_v1` as { v: 1, sets: [{ id, name, questions: [String], ts }] }.
   Nothing here touches storage or the page: load() takes the raw string,
   everything else takes and returns plain values, and the page owns the
   localStorage calls. A set's questions are plain text (the page escapes them
   when it prints), never markup. */
(function (global) {
  'use strict';

  var MAX_SETS = 30;
  var MAX_QUESTIONS = 20;
  var NAME_MAX = 60;
  var QUESTION_MAX = 300;
  var KEY = 'cedg_qsets_v1';

  var ENTITIES = { '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&amp;': '&', '&mdash;': '—', '&ndash;': '–' };

  /** A built-in question (written as HTML) as the plain text a set holds. */
  function plain(q) {
    return String(q == null ? '' : q).replace(/&[a-z]+;/g, function (m) { return ENTITIES[m] || m; });
  }

  function cleanName(n) { return String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); }

  /** Question texts: strings only, trimmed, no blanks, no repeats, capped. */
  function cleanQuestions(list, cap) {
    var limit = cap === undefined ? MAX_QUESTIONS : cap;
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (q) {
      if (typeof q !== 'string') return;
      var t = q.replace(/\s+/g, ' ').trim().slice(0, QUESTION_MAX);
      if (!t || seen[t]) return;
      seen[t] = 1;
      if (out.length < limit) out.push(t);
    });
    return out;
  }

  function uid() { return 'qs' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /** The stored string to a list of sets. Anything unreadable is no sets. */
  function load(raw) {
    var data;
    try { data = JSON.parse(raw || 'null'); } catch (e) { return []; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.sets)) return [];
    var names = {}, out = [];
    data.sets.forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var name = cleanName(s.name), qs = cleanQuestions(s.questions);
      if (!name || !qs.length || names[name.toLowerCase()] || out.length >= MAX_SETS) return;
      names[name.toLowerCase()] = 1;
      out.push({ id: typeof s.id === 'string' && s.id ? s.id : uid(), name: name, questions: qs, ts: typeof s.ts === 'number' ? s.ts : 0 });
    });
    return out;
  }

  function dump(sets) { return JSON.stringify({ v: 1, sets: sets }); }

  function indexOfName(sets, name) {
    var n = cleanName(name).toLowerCase();
    for (var i = 0; i < sets.length; i++) if (sets[i].name.toLowerCase() === n) return i;
    return -1;
  }

  /** Saves `questions` under `name`. Returns { sets, status } where status is
      'added', 'replaced' (same name, ignoring case), 'empty' (nothing to keep),
      'noname' or 'full'. `dropped` counts questions left out by the per-set
      cap. The input list is not changed. */
  function save(sets, name, questions, now) {
    var nm = cleanName(name), qs = cleanQuestions(questions);
    var dropped = cleanQuestions(questions, Infinity).length - qs.length;
    if (!nm) return { sets: sets, status: 'noname' };
    if (!qs.length) return { sets: sets, status: 'empty' };
    var next = sets.slice(), i = indexOfName(sets, nm);
    var entry = { id: i === -1 ? uid() : sets[i].id, name: nm, questions: qs, ts: typeof now === 'number' ? now : Date.now() };
    if (i === -1) {
      if (sets.length >= MAX_SETS) return { sets: sets, status: 'full' };
      next.push(entry);
      return { sets: next, status: 'added', dropped: dropped };
    }
    next[i] = entry;
    return { sets: next, status: 'replaced', dropped: dropped };
  }

  function remove(sets, id) { return sets.filter(function (s) { return s.id !== id; }); }
  function find(sets, id) { for (var i = 0; i < sets.length; i++) if (sets[i].id === id) return sets[i]; return null; }

  /** `current` plus the set's questions that it does not already have. */
  function merge(current, setQuestions) {
    var have = {};
    var out = cleanQuestions(current);
    out.forEach(function (q) { have[q] = 1; });
    cleanQuestions(setQuestions).forEach(function (q) { if (!have[q] && out.length < MAX_QUESTIONS) { have[q] = 1; out.push(q); } });
    return out;
  }

  global.CedgSets = {
    KEY: KEY, MAX_SETS: MAX_SETS, MAX_QUESTIONS: MAX_QUESTIONS, NAME_MAX: NAME_MAX, QUESTION_MAX: QUESTION_MAX,
    plain: plain, cleanName: cleanName, cleanQuestions: cleanQuestions,
    load: load, dump: dump, save: save, remove: remove, find: find, merge: merge, indexOfName: indexOfName
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
