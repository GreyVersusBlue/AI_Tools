/* speaking.js — the speaking assessment layer of 014 (BACKLOG Path "per-tool" row 72).

   Pure functions, no DOM and no storage: the page reads and writes the key.
   One record per class:

     { criteria: [text, ...],                       // what the teacher scores, 1 to 6 lines
       marks: [ { id, date: 'YYYY-MM-DD', scenario, title,
                  students: [name, ...],            // the pair (or trio) this tap was for
                  scores: [ { c: text, v: 1..4 } ] // the wording used at the time, so
                } ] }                               // editing a criterion later never rewrites history

   A mark is stored once for the pair. A student's record is every mark that
   names them, so a pair is never scored twice and nothing of another pair
   is in a student's page. Four levels, always shown as a number AND a word. */
(function (root) {
  'use strict';

  var LEVELS = [
    { v: 1, label: 'Beginning' },
    { v: 2, label: 'Developing' },
    { v: 3, label: 'Proficient' },
    { v: 4, label: 'Advanced' }
  ];
  var DEFAULT_CRITERIA = [
    'Stays in the target language',
    'Uses the scaffolding phrases',
    'Keeps the conversation going',
    'Understandable pronunciation'
  ];
  var MAX_CRITERIA = 6, MAX_LEN = 80, MAX_MARKS = 2000;

  function levelLabel(v) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].v === v) return LEVELS[i].label;
    return '';
  }

  function cleanCriteria(lines) {
    var out = [];
    (Array.isArray(lines) ? lines : []).forEach(function (l) {
      var t = String(l == null ? '' : l).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      if (t && out.indexOf(t) < 0 && out.length < MAX_CRITERIA) out.push(t);
    });
    return out;
  }

  function validDate(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var dt = new Date(d + 'T00:00:00Z');
    return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
  }

  function cleanMark(m) {
    if (!m || typeof m !== 'object') return null;
    var students = (Array.isArray(m.students) ? m.students : []).map(function (s) {
      return String(s == null ? '' : s).trim();
    }).filter(Boolean);
    var scores = [];
    (Array.isArray(m.scores) ? m.scores : []).forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var c = String(s.c == null ? '' : s.c).trim().slice(0, MAX_LEN);
      var v = s.v;
      if (c && typeof v === 'number' && v === Math.floor(v) && v >= 1 && v <= 4) scores.push({ c: c, v: v });
    });
    if (!students.length || !scores.length || !validDate(m.date)) return null;
    return {
      id: String(m.id == null ? '' : m.id).slice(0, 40),
      date: m.date,
      scenario: String(m.scenario == null ? '' : m.scenario).slice(0, 80),
      title: String(m.title == null ? '' : m.title).slice(0, 120),
      students: students,
      scores: scores
    };
  }

  /* Whatever is in storage becomes a record the page can use; junk is dropped, never thrown on. */
  function normalize(raw) {
    var rec = { criteria: DEFAULT_CRITERIA.slice(), marks: [] };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return rec;
    if (Array.isArray(raw.criteria)) {
      var c = cleanCriteria(raw.criteria);
      if (c.length) rec.criteria = c;
    }
    if (Array.isArray(raw.marks)) {
      raw.marks.forEach(function (m) {
        var k = cleanMark(m);
        if (k && rec.marks.length < MAX_MARKS) rec.marks.push(k);
      });
    }
    return rec;
  }

  function nextId(rec) {
    var n = 0;
    rec.marks.forEach(function (m) {
      var k = parseInt(String(m.id).replace(/^m/, ''), 10);
      if (k > n) n = k;
    });
    return 'm' + (n + 1);
  }

  /* Add one tap. `scores` is { criterionText: 1..4 } with only the criteria the teacher
     actually tapped; a criterion left alone is not scored, so a quick tap stays quick.
     Returns the stored mark, or null when there is nobody to score or nothing scored. */
  function addMark(rec, spec) {
    var scores = [];
    var seen = spec && spec.scores ? spec.scores : {};
    rec.criteria.forEach(function (c) {
      if (Object.prototype.hasOwnProperty.call(seen, c)) scores.push({ c: c, v: seen[c] });
    });
    var mark = cleanMark({
      id: nextId(rec), date: spec && spec.date, scenario: spec && spec.scenario, title: spec && spec.title,
      students: spec && spec.students, scores: scores
    });
    if (!mark) return null;
    rec.marks.push(mark);
    return mark;
  }

  function undoLast(rec) { return rec.marks.pop() || null; }

  function marksFor(rec, student) {
    return rec.marks.filter(function (m) { return m.students.indexOf(student) >= 0; });
  }

  /* Average of each criterion over a student's marks, in the order criteria first appear. */
  function summary(rec, student) {
    var marks = marksFor(rec, student), order = [], sum = {}, n = {}, total = 0, count = 0;
    marks.forEach(function (m) {
      m.scores.forEach(function (s) {
        if (!(s.c in sum)) { sum[s.c] = 0; n[s.c] = 0; order.push(s.c); }
        sum[s.c] += s.v; n[s.c] += 1; total += s.v; count += 1;
      });
    });
    return {
      marks: marks.length,
      averages: order.map(function (c) { return { c: c, avg: Math.round(sum[c] / n[c] * 10) / 10, n: n[c] }; }),
      overall: count ? Math.round(total / count * 10) / 10 : null
    };
  }

  /* Students with at least one mark, in roster order first, then anyone no longer on the roster. */
  function studentsWithMarks(rec, roster) {
    var named = {};
    rec.marks.forEach(function (m) { m.students.forEach(function (s) { named[s] = true; }); });
    var out = (roster || []).filter(function (s) { return named[s]; });
    Object.keys(named).sort().forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); });
    return out;
  }

  root.RpSpeaking = {
    LEVELS: LEVELS, DEFAULT_CRITERIA: DEFAULT_CRITERIA, MAX_CRITERIA: MAX_CRITERIA,
    levelLabel: levelLabel, cleanCriteria: cleanCriteria, validDate: validDate,
    normalize: normalize, addMark: addMark, undoLast: undoLast,
    marksFor: marksFor, summary: summary, studentsWithMarks: studentsWithMarks
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
