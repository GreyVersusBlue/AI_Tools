/* Rubric Builder — write-only bridge that hands scored totals to Grade
   Distribution Visualizer (Tools/037-grade-distribution-visualizer.html).
   Direction is the opposite of wpg-rubric-link.js (Tools/writing-prompt-
   generator/wpg-rubric-link.js only reads Rubric Builder's own store and
   points its `:current` key at an existing entry): this file WRITES a
   brand-new named "assignment" into Grade Distribution Visualizer's own
   localStorage contract, matching its saved-set shape exactly, so a class
   already scored here doesn't have to be retyped there.

   This depends on Grade Distribution Visualizer's own store (inline script
   in Tools/037-grade-distribution-visualizer.html): a list of set names
   under 'gvb-grade-distribution:list', one JSON blob per name under
   'gvb-grade-distribution:data:<name>' shaped
   { name, text, cutA, cutB, cutC, cutD, bucketWidth, compareNames }, and a
   'gvb-grade-distribution:current' pointer it reads on load to decide which
   assignment to show. `text` is the same tolerant "Name: score" / "Name,
   score" / one-score-per-line paste format its own textarea accepts —
   there is no per-criterion structure in that store, only a flat list of
   one score per student, so only rubric TOTALS travel here, never the
   criteria/level breakdown. Scores travel as a percent of the rubric's
   total possible points, since that's the 0-100 scale Grade Distribution
   Visualizer's default cutoffs (90/80/70/60) assume.

   Never overwrites an existing assignment: always mints a new, unique name
   first (the same " (2)", " (3)"... dedup other saved-list tools in this
   repo use for their own names), then points `:current` at the new one. */
(function (global) {
  'use strict';

  var LIST_KEY = 'gvb-grade-distribution:list';
  var DATA_PREFIX = 'gvb-grade-distribution:data:';
  var CURRENT_KEY = 'gvb-grade-distribution:current';

  function safeParse(json, fallback) {
    if (json == null) return fallback;
    try {
      var value = JSON.parse(json);
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function listSetNames() {
    var names = safeParse(localStorage.getItem(LIST_KEY), []);
    return Array.isArray(names) ? names.filter(function (n) { return typeof n === 'string' && n; }) : [];
  }

  /** Same " (2)", " (3)"... dedup pattern used by every other tool's own
      saved-list naming in this repo — never silently overwrite an
      assignment that's already there. */
  function uniqueSetName(base) {
    var names = listSetNames();
    var trimmed = (base || '').trim() || 'Rubric scores';
    if (names.indexOf(trimmed) === -1) return trimmed;
    var n = 2, candidate = trimmed + ' (' + n + ')';
    while (names.indexOf(candidate) !== -1) { n++; candidate = trimmed + ' (' + n + ')'; }
    return candidate;
  }

  /** Writes a brand-new assignment, exactly matching saveSet() in
      037-grade-distribution-visualizer.html: push the name onto the list
      (always true here, since the name just came from uniqueSetName), store
      the data blob, and point `:current` at it. */
  function writeSet(name, data) {
    var names = listSetNames();
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem(LIST_KEY, JSON.stringify(names));
    }
    localStorage.setItem(DATA_PREFIX + name, JSON.stringify(data));
    localStorage.setItem(CURRENT_KEY, name);
  }

  /** scores: [{ student, percent }] (percent already 0-100, as a number or
      numeric string). baseName is the assignment name offered to the
      teacher, deduped before writing. Returns the name actually written. */
  function exportScores(baseName, scores) {
    var name = uniqueSetName(baseName);
    var text = scores.map(function (s) {
      return s.student + ': ' + s.percent;
    }).join('\n');
    var data = {
      name: name,
      text: text,
      cutA: 90, cutB: 80, cutC: 70, cutD: 60,
      bucketWidth: 10,
      compareNames: []
    };
    writeSet(name, data);
    return name;
  }

  /** Writes the set, then opens Grade Distribution Visualizer to it in a
      new tab — a same-directory relative path, since both tools live
      directly under Tools/. Returns the name actually written. */
  function exportAndOpen(baseName, scores) {
    var name = exportScores(baseName, scores);
    global.open('037-grade-distribution-visualizer.html', '_blank');
    return name;
  }

  global.RbGdvHandoff = {
    uniqueSetName: uniqueSetName,
    exportScores: exportScores,
    exportAndOpen: exportAndOpen
  };
})(window);
