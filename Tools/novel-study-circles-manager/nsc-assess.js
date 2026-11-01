/* nsc-assess.js — the discussion assessment for 027 Novel Study / Reading Circles Manager. A plain
   script that publishes one global, `NscAssess`, so the page can call it and a pure-Node suite can import it.

   Nothing here touches the page or storage. A meeting may carry an optional `assess` list, one row per student the
   teacher tapped, `{ name, participated?, prepared?, advanced? }`, each criterion 2 (yes), 1 (some) or 0 (not yet);
   a criterion with no value was not assessed. The list is an array and not an object keyed by name, so a student
   named "constructor" or "__proto__" is only a string. A meeting that was never assessed has no `assess` field, so
   every meeting saved before this module opens as it did.

   Anything read from a stored or imported meeting goes through `rowsOf()`, which keeps only well-formed rows. */
(function (global) {
  'use strict';

  var CRITERIA = [
    { key: 'participated', label: 'Participated' },
    { key: 'prepared', label: 'Prepared' },
    { key: 'advanced', label: 'Advanced the conversation' }
  ];
  var WORDS = { 2: 'Yes', 1: 'Some', 0: 'Not yet' };
  var MARKS = { 2: '✓', 1: '~', 0: '✗' };

  function isLevel(v) { return v === 0 || v === 1 || v === 2; }

  /** The tap cycle: not assessed, yes, some, not yet, and round to not assessed. */
  function next(level) {
    if (!isLevel(level)) return 2;
    return level === 0 ? undefined : level - 1;
  }

  /** The well-formed rows of a meeting's assessment, as copies. */
  function rowsOf(meeting) {
    var list = meeting && Array.isArray(meeting.assess) ? meeting.assess : [];
    var seen = {};
    var out = [];
    list.forEach(function (r) {
      if (!r || typeof r.name !== 'string' || !r.name || Object.prototype.hasOwnProperty.call(seen, r.name)) return;
      seen[r.name] = true;
      var row = { name: r.name };
      var marked = false;
      CRITERIA.forEach(function (c) { if (isLevel(r[c.key])) { row[c.key] = r[c.key]; marked = true; } });
      if (marked) out.push(row);
    });
    return out;
  }

  /** The students a meeting had, in the order its groups list them, once each. */
  function studentsOf(meeting) {
    var names = [];
    var seen = {};
    ((meeting && meeting.groups) || []).forEach(function (g) {
      ((g && g.assignment) || []).forEach(function (a) {
        if (a && typeof a.name === 'string' && a.name && !Object.prototype.hasOwnProperty.call(seen, a.name)) { seen[a.name] = true; names.push(a.name); }
      });
    });
    return names;
  }

  /** What one student was tapped at in one meeting: a level, or undefined. */
  function levelOf(meeting, name, key) {
    var rows = rowsOf(meeting);
    for (var i = 0; i < rows.length; i++) if (rows[i].name === name) return rows[i][key];
    return undefined;
  }

  /** Sets (or, with undefined, clears) one criterion for one student on the meeting itself. A row left with no
      criterion is removed, and the field goes when the list is empty, so an untouched meeting stays untouched. */
  function set(meeting, name, key, level) {
    if (!meeting || typeof name !== 'string' || !name) return false;
    if (!CRITERIA.some(function (c) { return c.key === key; })) return false;
    if (level !== undefined && !isLevel(level)) return false;
    var rows = rowsOf(meeting);
    var row = null;
    rows.forEach(function (r) { if (r.name === name) row = r; });
    if (!row) { if (level === undefined) return true; row = { name: name }; rows.push(row); }
    if (level === undefined) delete row[key]; else row[key] = level;
    rows = rows.filter(function (r) { return CRITERIA.some(function (c) { return isLevel(r[c.key]); }); });
    if (rows.length) meeting.assess = rows; else delete meeting.assess;
    return true;
  }

  /** Moves a student's row to a new name (a rename in Class Roster Hub). Refuses when `to` already has a row. */
  function rename(meeting, from, to) {
    if (!meeting || !Array.isArray(meeting.assess) || typeof to !== 'string' || !to) return false;
    var hasTo = meeting.assess.some(function (r) { return r && r.name === to; });
    var moved = false;
    meeting.assess.forEach(function (r) { if (r && r.name === from && !hasTo) { r.name = to; moved = true; } });
    return moved;
  }

  /** One line per student across the meetings (newest first or not, order does not matter): for each criterion the
      count of yes, some and not yet, how many meetings it was assessed in, and the points over the points possible
      (2 for each assessed criterion). Students in alphabetical order. A meeting with no assessment adds nothing. */
  function summary(meetings) {
    var by = {};
    var order = [];
    var assessedMeetings = 0;
    (Array.isArray(meetings) ? meetings : []).forEach(function (m) {
      var rows = rowsOf(m);
      if (!rows.length) return;
      assessedMeetings++;
      rows.forEach(function (r) {
        if (!Object.prototype.hasOwnProperty.call(by, r.name)) {
          by[r.name] = { name: r.name, meetings: 0, points: 0, possible: 0, criteria: {} };
          CRITERIA.forEach(function (c) { by[r.name].criteria[c.key] = { yes: 0, some: 0, no: 0, assessed: 0 }; });
          order.push(r.name);
        }
        var s = by[r.name];
        var any = false;
        CRITERIA.forEach(function (c) {
          var v = r[c.key];
          if (!isLevel(v)) return;
          any = true;
          var cell = s.criteria[c.key];
          cell.assessed++;
          if (v === 2) cell.yes++; else if (v === 1) cell.some++; else cell.no++;
          s.points += v;
          s.possible += 2;
        });
        if (any) s.meetings++;
      });
    });
    order.sort(function (a, b) { return a.localeCompare(b); });
    return { meetings: assessedMeetings, students: order.map(function (n) { return by[n]; }) };
  }

  global.NscAssess = { CRITERIA: CRITERIA, WORDS: WORDS, MARKS: MARKS, next: next, rowsOf: rowsOf, studentsOf: studentsOf, levelOf: levelOf, set: set, rename: rename, summary: summary };
})(typeof globalThis !== 'undefined' ? globalThis : this);
