/* ssr-report.js — the numbers behind 033's printable parent reading report (BACKLOG row 75).

   Pure functions over a student's log entries already cut to the report period; no DOM, no
   storage, no names. Dates are 'YYYY-MM-DD' strings and all date arithmetic is in UTC, so a
   week never shifts with the browser's time zone or a daylight-saving change.

   An entry here is { date, book, pages, minutes }: `pages` is what was read in that sitting
   (the page works it out over the student's whole log, so a period that starts mid-book does
   not count the pages before it), `minutes` is 0 when none were logged. Weeks run Monday to
   Sunday; the first and last may be partial, and only days inside the period are counted.

   "How consistently" is shown as days read, never as a grade or a rank: nothing here compares
   one student with another. */
(function (root) {
  'use strict';

  var DAY = 86400000;
  var MAX_WEEKS = 10;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function ms(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
    var t = Date.parse(s + 'T00:00:00Z');
    return isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? NaN : t;
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function mondayOf(s) {
    var t = ms(s), dow = new Date(t).getUTCDay(); // 0 = Sunday
    return iso(t - ((dow + 6) % 7) * DAY);
  }
  function short(s) {
    var t = ms(s);
    return isNaN(t) ? '' : MONTHS[new Date(t).getUTCMonth()] + ' ' + new Date(t).getUTCDate();
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* The Monday-to-Sunday weeks that touch [from, to], oldest first. */
  function weekStarts(from, to) {
    var a = ms(from), b = ms(to);
    if (isNaN(a) || isNaN(b) || a > b) return [];
    var out = [], t = ms(mondayOf(from));
    while (t <= b) { out.push(iso(t)); t += 7 * DAY; }
    return out;
  }

  /* One report. Returns null for an unusable period. `weeks` is the last MAX_WEEKS weeks, with
     `earlierWeeks` counting the ones left off the strip (their reading is still in the totals). */
  function build(spec) {
    var from = spec && spec.from, to = spec && spec.to;
    var starts = weekStarts(from, to);
    if (!starts.length) return null;
    var entries = (spec.entries || []).filter(function (e) { return e && e.date >= from && e.date <= to && !isNaN(ms(e.date)); });
    var days = {}, byWeek = {}, books = [], bookAt = {};
    var pages = 0, minutes = 0;
    entries.forEach(function (e) {
      var p = Math.max(0, Math.floor(Number(e.pages) || 0)), m = Math.max(0, Math.floor(Number(e.minutes) || 0));
      days[e.date] = true;
      pages += p; minutes += m;
      var w = mondayOf(e.date);
      var wk = byWeek[w] || (byWeek[w] = { days: {}, pages: 0, minutes: 0 });
      wk.days[e.date] = true; wk.pages += p; wk.minutes += m;
      var title = String(e.book == null ? '' : e.book).trim(), key = title.toLowerCase();
      if (!key) return;
      var b = bookAt[key];
      if (!b) { b = bookAt[key] = { key: key, title: title, days: {}, pages: 0, minutes: 0 }; books.push(b); }
      b.days[e.date] = true; b.pages += p; b.minutes += m;
    });
    var weekRows = starts.map(function (w) {
      var wk = byWeek[w] || { days: {}, pages: 0, minutes: 0 };
      var flags = [];
      for (var i = 0; i < 7; i++) {
        var d = iso(ms(w) + i * DAY);
        flags.push(d < from || d > to ? null : !!wk.days[d]); // null: not in the period
      }
      return { start: w, flags: flags, days: Object.keys(wk.days).length, pages: wk.pages, minutes: wk.minutes };
    });
    var dayList = Object.keys(days).sort(), longest = 0, run = 0, prev = NaN;
    dayList.forEach(function (d) { var t = ms(d); run = (t - prev === DAY) ? run + 1 : 1; prev = t; if (run > longest) longest = run; });
    var gp = Math.max(0, Number(spec.goalPages) || 0), gm = Math.max(0, Number(spec.goalMinutes) || 0);
    var shown = weekRows.slice(-MAX_WEEKS);
    return {
      from: from, to: to,
      daysRead: dayList.length,
      weeksInPeriod: weekRows.length,
      weeksWithReading: weekRows.filter(function (w) { return w.days > 0; }).length,
      avgDaysPerWeek: round1(dayList.length / weekRows.length),
      longestRun: longest,
      pages: pages, minutes: minutes,
      avgMinutesPerDayRead: dayList.length && minutes ? Math.round(minutes / dayList.length) : 0,
      weeks: shown, earlierWeeks: weekRows.length - shown.length,
      books: books.map(function (b) { return { key: b.key, title: b.title, days: Object.keys(b.days).length, pages: b.pages, minutes: b.minutes }; }),
      goalPages: gp, goalMinutes: gm,
      weeksMetPages: gp ? weekRows.filter(function (w) { return w.pages >= gp; }).length : 0,
      weeksMetMinutes: gm ? weekRows.filter(function (w) { return w.minutes >= gm; }).length : 0
    };
  }

  root.SsrReport = { MAX_WEEKS: MAX_WEEKS, mondayOf: mondayOf, short: short, weekStarts: weekStarts, build: build, validDate: function (s) { return !isNaN(ms(s)); } };
}(typeof globalThis !== 'undefined' ? globalThis : this));
