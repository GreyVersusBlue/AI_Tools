/* gtg-seating.js — 002's "seat groups near each other", as one pure function.
   A plain script that publishes `GtgSeating`, so the page can call it and a
   pure-Node suite can import it. It reads a chart the caller hands in (from
   SeatingRead.read()) and never touches storage, the page or the clock.

   build(chart, SeatingRead, { classNames, members }) answers one of two ways:
     { found: false, reason }  'no-chart' (005 has saved nothing), 'no-section'
                               (no section of the chart is this class, and the
                               chart has more than one), 'no-students' (fewer
                               than two of the class's students have a desk);
     { found: true, section, cost, seated, unseated, total }
   where cost(keyA, keyB) is how far apart the two students' desks are, in desk
   widths, for formGroups()'s `cost` option. A student with no desk, or whose
   name is on the chart twice or in the class twice, cannot be placed, so each
   pair with one costs the mean of the placed pairs: the grouping has no pull
   toward or away from them. */
(function (global) {
  'use strict';

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

  function sectionFor(chart, SR, classNames) {
    var sections = chart.sections;
    for (var i = 0; i < classNames.length; i++) {
      if (!classNames[i]) continue;
      for (var j = 0; j < sections.length; j++) if (SR.sameClass(sections[j].name, classNames[i])) return sections[j];
    }
    return sections.length === 1 ? sections[0] : null;
  }

  function build(chart, SR, opts) {
    opts = opts || {};
    if (!chart || !Array.isArray(chart.sections) || !chart.sections.length) return { found: false, reason: 'no-chart' };
    var section = sectionFor(chart, SR, opts.classNames || []);
    if (!section) return { found: false, reason: 'no-section' };

    var seen = {}, seat = {};
    SR.placeDesks(section, {}).forEach(function (d) {
      if (!d.student) return;
      var n = norm(d.student.name);
      seen[n] = (seen[n] || 0) + 1;
      seat[n] = { x: d.x + SR.DESK_W / 2, y: d.y + SR.DESK_H / 2 };
    });
    var members = opts.members || [], count = {};
    members.forEach(function (m) { var n = norm(m.name); count[n] = (count[n] || 0) + 1; });
    var at = {}, placed = [], unseated = [];
    members.forEach(function (m) {
      var n = norm(m.name);
      if (seen[n] === 1 && count[n] === 1) { at[m.key] = seat[n]; placed.push(m.key); } else unseated.push(m.name);
    });
    if (placed.length < 2) return { found: false, reason: 'no-students', section: section.name };

    function dist(a, b) { return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) / SR.DESK_W; }
    var sum = 0, pairs = 0;
    for (var i = 0; i < placed.length; i++) for (var j = i + 1; j < placed.length; j++) { sum += dist(at[placed[i]], at[placed[j]]); pairs++; }
    var mean = sum / pairs;
    return {
      found: true, section: section.name, seated: placed.length, unseated: unseated, total: members.length,
      cost: function (a, b) { return at[a] && at[b] ? dist(at[a], at[b]) : mean; }
    };
  }

  global.GtgSeating = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
