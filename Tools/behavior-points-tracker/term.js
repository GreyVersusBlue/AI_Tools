/* term.js — the term / year view for 008 Behavior & Points Tracker. A plain
   script that publishes one global, `BPTerm`, so the page can call it and a
   pure-Node suite can import it.

   Nothing here touches the page or storage. It reads what a section already
   keeps (`history`, newest first, each day `{ date, iso?, rows: [{ name,
   points, pos, neg, goal }] }`) and adds it up over a date range, across one
   section or all of them. It writes nothing back and adds no field to
   anything stored.

   Two limits are the stored shape's, not this file's:
     - A day filed before `iso` was kept has only its locale date string. It is
       read with Date.parse when that works; a day that cannot be dated is
       counted as "undated", shown only when no range is asked for.
     - Team totals are one running total with no per-day history, so the view
       has no team column. */
(function (global) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** A day's ISO date (YYYY-MM-DD), or '' when it cannot be told. */
  function isoOf(day) {
    if (!day) return '';
    var m = typeof day.iso === 'string' && ISO.exec(day.iso);
    if (m && validDate(+m[1], +m[2], +m[3])) return day.iso;
    var t = typeof day.date === 'string' ? Date.parse(day.date) : NaN;
    if (!isFinite(t)) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function validDate(y, mo, d) {
    var t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }

  function parts(iso) { var m = ISO.exec(iso); return { y: +m[1], m: +m[2], d: +m[3] }; }

  /** The Monday on or before an ISO date, as an ISO date. */
  function mondayOf(iso) {
    var p = parts(iso);
    var t = new Date(Date.UTC(p.y, p.m - 1, p.d));
    var back = (t.getUTCDay() + 6) % 7;
    t = new Date(t.getTime() - back * 86400000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  function bucketOf(iso, by) {
    if (by === 'month') return iso.slice(0, 7);
    return mondayOf(iso);
  }

  function bucketLabel(key, by) {
    if (by === 'month') { var m = +key.slice(5, 7); return MONTHS[m - 1] + ' ' + key.slice(0, 4); }
    var p = parts(key);
    return 'Week of ' + MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y;
  }

  /** The school year (Aug 1 to Jul 31) a date falls in, as { from, to }. */
  function schoolYear(iso) {
    var p = parts(iso);
    var y = p.m >= 8 ? p.y : p.y - 1;
    return { from: y + '-08-01', to: (y + 1) + '-07-31' };
  }

  /** `n` days before an ISO date (inclusive of that date: 30 gives 30 days). */
  function lastDays(iso, n) {
    var p = parts(iso);
    var t = new Date(Date.UTC(p.y, p.m - 1, p.d) - (n - 1) * 86400000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  /** Adds up days over a range.
        sets    { sectionName: state }   (only `history` and `goals` are read)
        opts    { sections: [name] | null (all), from, to ('' or ISO), by: 'week' | 'month' }
      A student is one line per section: the same name in two sections is two
      lines, because the tool has no way to know they are one child. */
  function summarize(sets, opts) {
    opts = opts || {};
    var by = opts.by === 'month' ? 'month' : 'week';
    var from = ISO.test(opts.from || '') ? opts.from : '';
    var to = ISO.test(opts.to || '') ? opts.to : '';
    var ranged = !!(from || to);
    var names = Array.isArray(opts.sections) ? opts.sections : Object.keys(sets || {}).sort(function (a, b) { return a.localeCompare(b); });

    var buckets = {}, students = {}, dayKeys = {}, undated = 0, totals = { points: 0, pos: 0, neg: 0, days: 0 };

    names.forEach(function (sec) {
      var st = sets && sets[sec];
      if (!st || !Array.isArray(st.history)) return;
      var goals = (st.goals && typeof st.goals === 'object') ? st.goals : {};
      st.history.forEach(function (day) {
        if (!day || !Array.isArray(day.rows)) return;
        var iso = isoOf(day);
        if (!iso) { if (!ranged) undated++; if (ranged) return; }
        else {
          if (from && iso < from) return;
          if (to && iso > to) return;
        }
        var dkey = sec + '\u0000' + (iso || ('?' + day.date));
        if (!dayKeys[dkey]) { dayKeys[dkey] = 1; totals.days++; }
        var b = null;
        if (iso) {
          var key = bucketOf(iso, by);
          b = buckets[key] || (buckets[key] = { key: key, label: bucketLabel(key, by), days: 0, points: 0, pos: 0, neg: 0, _d: {} });
          if (!b._d[dkey]) { b._d[dkey] = 1; b.days++; }
        }
        day.rows.forEach(function (r) {
          if (!r || typeof r.name !== 'string') return;
          var pts = +r.points || 0, pos = +r.pos || 0, neg = +r.neg || 0;
          totals.points += pts; totals.pos += pos; totals.neg += neg;
          if (b) { b.points += pts; b.pos += pos; b.neg += neg; }
          var sk = sec + '\u0000' + r.name;
          var s = students[sk] || (students[sk] = { section: sec, name: r.name, days: 0, points: 0, pos: 0, neg: 0, goalDays: 0, met: 0 });
          s.days++; s.points += pts; s.pos += pos; s.neg += neg;
          var target = (r.goal === undefined || r.goal === null) ? goals[r.name] : r.goal;
          if (target !== undefined && target !== null && isFinite(+target)) {
            s.goalDays++;
            if (pts >= +target) s.met++;
          }
        });
      });
    });

    var bl = Object.keys(buckets).sort().map(function (k) { var b = buckets[k]; delete b._d; return b; });
    var sl = Object.keys(students).map(function (k) { return students[k]; }).sort(function (a, b) {
      return b.points - a.points || a.name.localeCompare(b.name) || a.section.localeCompare(b.section);
    });
    return { by: by, from: from, to: to, days: totals.days, undated: undated, points: totals.points, pos: totals.pos, neg: totals.neg, buckets: bl, students: sl, studentCount: sl.length };
  }

  global.BPTerm = {
    isoOf: isoOf, mondayOf: mondayOf, bucketLabel: bucketLabel, schoolYear: schoolYear, lastDays: lastDays, summarize: summarize
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.BPTerm;
})(typeof globalThis !== 'undefined' ? globalThis : this);
