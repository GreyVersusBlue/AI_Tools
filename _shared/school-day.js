/* school-day.js — what kind of day a date is, and its bell schedule (Path 9 P1).
   Publishes window.SchoolDay. Pure: every function takes the calendar and the
   date (and the time) as arguments and nothing here reads the clock, except
   today(), which takes `now` and only falls back to new Date() when it is not
   given. Nothing writes storage; read() takes a localStorage-shaped object.
   The Node suite (Tools/school-calendar/test/school-day.test.mjs) drives all
   of it.

   THE CALENDAR is 032 School Calendar Visualizer's blob, key 'scv_calendar_v1',
   bare JSON written by Tools/school-calendar/scv-store.js and by nothing else:
     { __v: 2, meta: { start, end, yearLabel }, dayTypes: [{ id, label,
       noSchool?, ... }], days: { 'YYYY-MM-DD': { types: [id], label, ... } },
       abCycle?: { enabled, anchorDate, anchorLetter }, pacing, units?, bell? }
   A day type is a tag; a day may carry several, or none (an ordinary day).

   THE BELL SCHEDULES are one optional field of that blob, `bell`. There is no
   __v bump for it, on purpose (BACKLOG, Path 9 P2, "the storage decision"): a
   page from an older cache that meets __v 3 shows the seed and writes it over
   the teacher's calendar, while one that meets an unknown field saves it back,
   because 032 saves the blob whole. So `bell` carries a version of its own:
     bell = { v: 1,
              schedules: [{ id, name, periods: [{ label, start: 'HH:MM', end: 'HH:MM' }] }],
              regular: scheduleId|null,           an ordinary school day
              letters: { A: id|null, B: id|null },  an A day, a B day (cycle on)
              types: { <dayTypeId>: scheduleId } }  a day tagged with that type
   A calendar saved before v307 has no `bell`: no day has a schedule, which is
   the truth. 032 owns the schedules (Devon, 2026-10-21, P9-10); 035 Schedule
   Visualizer keeps its own A/B mod times, 032 imports them
   (fromScheduleVisualizer, below), and since v308 035 can take 032's back
   into its settings (forScheduleVisualizer), a copy it saves as its own.

   HOW A DATE RESOLVES, in this order, and `why` names the first that fails:
     invalid   not a real YYYY-MM-DD date
     outside   before meta.start or after meta.end (summer is not a school day)
     weekend   Saturday or Sunday
     closed    tagged with a type marked "No school"
   Otherwise it is a school day, and its schedule is the first that applies:
     1. a type on the day that has a schedule assigned, in the legend's order
        (several do: the first wins, the rest are listed in `conflict`);
     2. the day's A/B letter, when the cycle is on and that letter has one;
     3. the ordinary-day schedule;
     4. none (`schedule: null`, a school day with no bell times yet).
   So a half day that falls on an A day uses the half-day schedule. A half day
   (P9-1, Devon 2026-10-21, the design's default) is a whole school day marked
   `half`: it is counted as one day by daysRemaining(), with the number of half
   days given beside it, never as half a count.

   THE A/B LETTER is abLetters() below, the same rule as abLetters() in
   Tools/school-calendar/scv-weeks.js (an ES module this classic script cannot
   import): it alternates on every school day and slides over a closure (Devon,
   2026-10-07). The suite holds the two to the same letters. Whether the rule
   lives here alone is P3's call, when classic-script consumers arrive.

   GRADING PERIODS come from the calendar's own tags: a day tagged with a type
   whose id is 'mpend', or whose label says "marking period" or "grading
   period", is the last day of a period. The first period starts at meta.start;
   what follows the last boundary is a final period to meta.end, if it holds a
   school day.

   Never throws on what it reads: a missing, truncated or hand-edited blob is
   no calendar, and a bell schedule it cannot read is no schedule. */
(function (global) {
  'use strict';

  var KEY = 'scv_calendar_v1';
  var BELL_VERSION = 1;
  var DAY_MS = 86400000;
  var ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
  var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  var MAX_SCHEDULES = 40;
  var MAX_PERIODS = 24;
  var MAX_TEXT = 60;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function isoToMs(iso) {
    return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  }
  function msToIso(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function isIso(s) { return typeof s === 'string' && ISO_RE.test(s) && msToIso(isoToMs(s)) === s; }
  function isWeekday(iso) { var dow = new Date(isoToMs(iso)).getUTCDay(); return dow !== 0 && dow !== 6; }

  /** 'HH:MM' to minutes after midnight, or null. */
  function toMinutes(t) {
    var m = typeof t === 'string' ? TIME_RE.exec(t) : null;
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }

  /** The local calendar date and time of a Date, as the teacher's clock reads them. */
  function localISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function localHM(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---- the calendar ---- */

  function isCalendar(cal) {
    return isObj(cal) && isObj(cal.meta) && isIso(cal.meta.start) && isIso(cal.meta.end)
      && Array.isArray(cal.dayTypes) && isObj(cal.days);
  }

  /** The calendar 032 saved, or null. `storage` is localStorage or anything with getItem. */
  function read(storage) {
    var raw = null;
    try { raw = storage && storage.getItem(KEY); } catch (e) { return null; }
    if (typeof raw !== 'string') return null;
    var cal;
    try { cal = JSON.parse(raw); } catch (e) { return null; }
    return isCalendar(cal) ? cal : null;
  }

  function typesOn(cal, iso) {
    var entry = cal.days[iso];
    if (!isObj(entry) || !Array.isArray(entry.types)) return [];
    var out = [];
    cal.dayTypes.forEach(function (t) {
      if (isObj(t) && entry.types.indexOf(t.id) !== -1) out.push(t);
    });
    return out;   // in the legend's order, unknown ids dropped
  }

  function isHalfType(t) {
    return !t.noSchool && (t.id === 'halfday' || /early dismissal|half day/i.test(String(t.label || '')));
  }
  function isBoundaryType(t) {
    return t.id === 'mpend' || /marking period|grading period/i.test(String(t.label || ''));
  }

  /** A weekday with no "No school" tag: 032's isTeachableDay(), the rule the A/B cycle uses.
      It does not look at the year's range, exactly as that one does not. */
  function isSchoolDay(cal, iso) {
    if (!isIso(iso) || !isWeekday(iso)) return false;
    return !typesOn(cal, iso).some(function (t) { return t.noSchool; });
  }

  function countSchoolDaysStrictlyBetween(cal, a, b) {
    var n = 0;
    for (var ms = isoToMs(a) + DAY_MS, end = isoToMs(b); ms < end; ms += DAY_MS) {
      if (isSchoolDay(cal, msToIso(ms))) n++;
    }
    return n;
  }

  /** { 'YYYY-MM-DD': 'A'|'B' } for every school day from the earlier of meta.start and the
      anchor to the later of meta.end and the anchor; {} when the cycle is off. */
  function abLetters(cal) {
    var map = {};
    var ac = cal && cal.abCycle;
    if (!isCalendar(cal) || !ac || !ac.enabled || !isIso(ac.anchorDate)) return map;
    var anchor = ac.anchorDate;
    var anchorLetter = ac.anchorLetter === 'B' ? 'B' : 'A';
    var other = anchorLetter === 'A' ? 'B' : 'A';
    var lo = anchor < cal.meta.start ? anchor : cal.meta.start;
    var hi = anchor > cal.meta.end ? anchor : cal.meta.end;
    if (lo > hi) return map;
    var letter;
    if (lo === anchor) letter = anchorLetter;
    else letter = countSchoolDaysStrictlyBetween(cal, lo, anchor) % 2 === 0 ? anchorLetter : other;
    for (var ms = isoToMs(lo), end = isoToMs(hi); ms <= end; ms += DAY_MS) {
      var iso = msToIso(ms);
      if (isSchoolDay(cal, iso)) {
        map[iso] = letter;
        letter = letter === 'A' ? 'B' : 'A';
      }
    }
    return map;
  }

  /* ---- bell schedules ---- */

  function emptyBell() {
    return { v: BELL_VERSION, schedules: [], regular: null, letters: { A: null, B: null }, types: {} };
  }

  function text(v) { return typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : ''; }

  /** A usable copy of cal.bell: { bell, state, dropped }.
      state 'none' (no field), 'ok', 'broken' (not the shape above: no schedules), or
      'newer' (bell.v above this file's: no schedules here, and a page must not edit it).
      Periods whose times do not parse, or that end before they start, are dropped and
      counted; the rest are sorted by start. An assignment naming no schedule is null. */
  function cleanBell(bell) {
    if (bell === undefined || bell === null) return { bell: emptyBell(), state: 'none', dropped: 0 };
    if (!isObj(bell) || !Array.isArray(bell.schedules)) return { bell: emptyBell(), state: 'broken', dropped: 0 };
    if (typeof bell.v === 'number' && bell.v > BELL_VERSION) return { bell: emptyBell(), state: 'newer', dropped: 0 };
    var out = emptyBell();
    var dropped = 0;
    var ids = {};
    bell.schedules.slice(0, MAX_SCHEDULES).forEach(function (s, i) {
      if (!isObj(s) || typeof s.id !== 'string' || !s.id || s.id.length > 64 || own(ids, s.id)) { dropped++; return; }
      var periods = [];
      (Array.isArray(s.periods) ? s.periods.slice(0, MAX_PERIODS) : []).forEach(function (p) {
        var a = isObj(p) ? toMinutes(p.start) : null;
        var b = isObj(p) ? toMinutes(p.end) : null;
        if (a === null || b === null || b <= a) { dropped++; return; }
        periods.push({ label: text(p.label) || ('Period ' + (periods.length + 1)), start: p.start, end: p.end });
      });
      periods.sort(function (x, y) { return toMinutes(x.start) - toMinutes(y.start); });
      ids[s.id] = true;
      out.schedules.push({ id: s.id, name: text(s.name) || ('Schedule ' + (i + 1)), periods: periods });
    });
    function ref(id) { return typeof id === 'string' && own(ids, id) ? id : null; }
    out.regular = ref(bell.regular);
    var letters = isObj(bell.letters) ? bell.letters : {};
    out.letters = { A: ref(letters.A), B: ref(letters.B) };
    if (isObj(bell.types)) {
      Object.keys(bell.types).forEach(function (k) { var id = ref(bell.types[k]); if (id) out.types[k] = id; });
    }
    return { bell: out, state: 'ok', dropped: dropped };
  }

  function scheduleById(bell, id) {
    for (var i = 0; i < bell.schedules.length; i++) if (bell.schedules[i].id === id) return bell.schedules[i];
    return null;
  }

  /* ---- a date ---- */

  /** Everything about one date. `opts.letters` (abLetters(cal)) and `opts.bell`
      (cleanBell(cal.bell).bell) may be passed in to save working them out again for
      every date of a loop. Returns
      { date, school, why: null|'invalid'|'outside'|'weekend'|'closed', closedBy: typeId|null,
        types: [typeId], half, letter: 'A'|'B'|null,
        schedule: { id, name, periods }|null, source: 'type'|'letter'|'regular'|null,
        sourceId: typeId|'A'|'B'|null, conflict: [typeId] } */
  function dayOf(cal, iso, opts) {
    var o = opts || {};
    var out = { date: iso, school: false, why: null, closedBy: null, types: [], half: false, letter: null,
      schedule: null, source: null, sourceId: null, conflict: [] };
    if (!isCalendar(cal) || !isIso(iso)) { out.why = 'invalid'; return out; }
    var types = typesOn(cal, iso);
    out.types = types.map(function (t) { return t.id; });
    if (iso < cal.meta.start || iso > cal.meta.end) { out.why = 'outside'; return out; }
    if (!isWeekday(iso)) { out.why = 'weekend'; return out; }
    for (var i = 0; i < types.length; i++) {
      if (types[i].noSchool) { out.why = 'closed'; out.closedBy = types[i].id; return out; }
    }
    out.school = true;
    out.half = types.some(isHalfType);
    var letters = o.letters || abLetters(cal);
    out.letter = letters[iso] || null;
    var bell = o.bell || cleanBell(cal.bell).bell;
    types.forEach(function (t) {
      var id = own(bell.types, t.id) ? bell.types[t.id] : null;
      if (!id) return;
      if (out.schedule) { out.conflict.push(t.id); return; }
      out.schedule = scheduleById(bell, id); out.source = 'type'; out.sourceId = t.id;
    });
    if (!out.schedule && out.letter && bell.letters[out.letter]) {
      out.schedule = scheduleById(bell, bell.letters[out.letter]); out.source = 'letter'; out.sourceId = out.letter;
    }
    if (!out.schedule && bell.regular) {
      out.schedule = scheduleById(bell, bell.regular); out.source = 'regular';
    }
    return out;
  }

  function scheduleFor(cal, iso, opts) { return dayOf(cal, iso, opts).schedule; }

  /** A day type's label, or '' when the calendar has no type with that id. */
  function typeLabel(cal, id) {
    if (!isCalendar(cal)) return '';
    for (var i = 0; i < cal.dayTypes.length; i++) {
      var t = cal.dayTypes[i];
      if (isObj(t) && t.id === id) return text(t.label);
    }
    return '';
  }

  /** dayOf()'s result in a few words, the one wording every page that shows the day uses
      (Path 9 P3): 'B day · Half Day / Early Dismissal', 'No school: Labor Day' (the day's
      own name, else its type's), 'No school (weekend)', 'Outside the school year', or
      'A school day' when nothing is tagged and the cycle is off. '' for no calendar. */
  function describe(cal, day) {
    if (!isCalendar(cal) || !isObj(day) || !isIso(day.date) || day.why === 'invalid') return '';
    var entry = isObj(cal.days[day.date]) ? cal.days[day.date] : {};
    var name = text(entry.label);
    if (day.why === 'outside') return 'Outside the school year';
    if (day.why === 'weekend') return 'No school (weekend)';
    if (day.why === 'closed') return 'No school: ' + (name || typeLabel(cal, day.closedBy) || 'closed');
    var parts = [];
    if (day.letter) parts.push(day.letter + ' day');
    (day.types || []).forEach(function (id) { var l = typeLabel(cal, id); if (l) parts.push(l); });
    if (name) parts.push(name);
    return parts.length ? parts.join(' \u00b7 ') : 'A school day';
  }

  /** Where `hm` ('HH:MM') falls in the day's schedule. Returns
      { state, period, index, next, minutesLeft, minutesUntil, day }, state one of
      'noschool' (not a school day), 'noschedule' (a school day with no periods),
      'before' (before the first period), 'in' (start <= time < end), 'between'
      (a passing time), 'after' (after the last), or 'invalid' (the time does not parse).
      `period` is the one in progress, `next` the next to start; minutesLeft is to the
      end of `period`, minutesUntil to the start of `next`. */
  function periodAt(cal, iso, hm, opts) {
    var day = dayOf(cal, iso, opts);
    var out = { state: 'invalid', period: null, index: -1, next: null, minutesLeft: null, minutesUntil: null, day: day };
    var t = toMinutes(hm);
    if (t === null) return out;
    if (!day.school) { out.state = 'noschool'; return out; }
    var periods = day.schedule ? day.schedule.periods : [];
    if (!periods.length) { out.state = 'noschedule'; return out; }
    for (var i = 0; i < periods.length; i++) {
      var a = toMinutes(periods[i].start), b = toMinutes(periods[i].end);
      if (t >= a && t < b && !out.period) { out.period = periods[i]; out.index = i; out.minutesLeft = b - t; }
      if (a > t && !out.next) { out.next = periods[i]; out.minutesUntil = a - t; }
    }
    if (out.period) out.state = 'in';
    else if (t < toMinutes(periods[0].start)) out.state = 'before';
    else if (out.next) out.state = 'between';
    else out.state = 'after';
    return out;
  }

  /** Today on the teacher's clock: { date, time, day, at } (at is periodAt for now). */
  function today(cal, now) {
    var d = now && typeof now.getFullYear === 'function' ? now : new Date();
    var date = localISO(d), time = localHM(d);
    var at = periodAt(cal, date, time);
    return { date: date, time: time, day: at.day, at: at };
  }

  /* ---- grading periods ---- */

  /** [{ n, start, end, days, half }] across meta.start..meta.end; `days` counts its
      school days, half days included, and `half` how many of those are half days. */
  function gradingPeriods(cal) {
    if (!isCalendar(cal) || cal.meta.start > cal.meta.end) return [];
    var out = [];
    var start = cal.meta.start, days = 0, half = 0;
    for (var ms = isoToMs(cal.meta.start), end = isoToMs(cal.meta.end); ms <= end; ms += DAY_MS) {
      var iso = msToIso(ms);
      var types = typesOn(cal, iso);
      if (isWeekday(iso) && !types.some(function (t) { return t.noSchool; })) {
        days++;
        if (types.some(isHalfType)) half++;
      }
      var last = iso === cal.meta.end;
      if (types.some(isBoundaryType) || (last && days > 0)) {
        out.push({ n: out.length + 1, start: start, end: iso, days: days, half: half });
        start = msToIso(ms + DAY_MS); days = 0; half = 0;
      }
    }
    return out;
  }

  function gradingPeriodOf(cal, iso) {
    if (!isIso(iso)) return null;
    var list = gradingPeriods(cal);
    for (var i = 0; i < list.length; i++) if (iso >= list[i].start && iso <= list[i].end) return list[i];
    return null;
  }

  /** School days left in `period` counting from `fromISO` (inclusive) to its end:
      { days, half }. A half day is one of the `days` and is also counted in `half`.
      Before the period starts, the whole period; after it ends, 0. */
  function daysRemaining(cal, period, fromISO) {
    var out = { days: 0, half: 0 };
    if (!isCalendar(cal) || !isObj(period) || !isIso(period.start) || !isIso(period.end) || !isIso(fromISO)) return out;
    var from = fromISO > period.start ? fromISO : period.start;
    for (var ms = isoToMs(from), end = isoToMs(period.end); ms <= end; ms += DAY_MS) {
      var iso = msToIso(ms);
      if (!isSchoolDay(cal, iso)) continue;
      out.days++;
      if (typesOn(cal, iso).some(isHalfType)) out.half++;
    }
    return out;
  }

  /* ---- 035 Schedule Visualizer's bell times ---- */

  var BLOCK_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  var ORDINAL = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th'];
  /** 035's modLabel(), so an imported period is named as 035 names it. */
  function modLabel(n, style) {
    if (style === 'period') return 'Period ' + n;
    if (style === 'block') return 'Block ' + (BLOCK_LETTERS[n - 1] || n);
    if (style === 'hour') return n + (ORDINAL[n - 1] || 'th') + ' Hour';
    return 'Mod ' + n;
  }

  /** The schedules 035 holds, from its parsed 'stviz_settings':
      settings.bellSchedule = { A: [{start,end}|null, ...]|null, B: same|null }, where B null
      means "same as A". Returns { schedules: [{ name, periods }], letters: { A: index|null,
      B: index|null }, skipped } — indexes into `schedules`; a row 035 left blank or
      half-typed is skipped and counted. No schedules when 035 has no times. */
  function fromScheduleVisualizer(settings) {
    var out = { schedules: [], letters: { A: null, B: null }, skipped: 0 };
    if (!isObj(settings) || !isObj(settings.bellSchedule)) return out;
    var n = Math.max(1, Math.min(MAX_PERIODS, parseInt(settings.modCount, 10) || 8));
    var style = settings.modLabel;
    function rows(src) {
      if (!Array.isArray(src)) return null;
      var periods = [];
      for (var i = 0; i < n; i++) {
        var e = src[i];
        if (!isObj(e) || (!e.start && !e.end)) continue;
        var a = toMinutes(e.start), b = toMinutes(e.end);
        if (a === null || b === null || b <= a) { out.skipped++; continue; }
        periods.push({ label: modLabel(i + 1, style), start: e.start, end: e.end });
      }
      return periods;
    }
    var a = rows(settings.bellSchedule.A);
    var b = rows(settings.bellSchedule.B);
    if (a && a.length && b && b.length) {
      out.schedules.push({ name: 'A day (from the Schedule Visualizer)', periods: a });
      out.schedules.push({ name: 'B day (from the Schedule Visualizer)', periods: b });
      out.letters = { A: 0, B: 1 };
    } else if (a && a.length && !Array.isArray(settings.bellSchedule.B)) {
      out.schedules.push({ name: 'Regular day (from the Schedule Visualizer)', periods: a });
      out.letters = { A: 0, B: 0 };
    } else {
      if (a && a.length) { out.schedules.push({ name: 'A day (from the Schedule Visualizer)', periods: a }); out.letters.A = 0; }
      if (b && b.length) { out.schedules.push({ name: 'B day (from the Schedule Visualizer)', periods: b }); out.letters.B = out.schedules.length - 1; }
    }
    return out;
  }

  /** A new bell field with `imported` (fromScheduleVisualizer's result) added after the
      schedules `bell` already has. `makeId()` names each new schedule. Nothing is
      replaced: an assignment already made stays; one not yet made takes the import's
      (A and B to their letters, and the ordinary day to A's when both letters share
      one schedule). */
  function addImported(bell, imported, makeId) {
    var base = cleanBell(bell);
    var next = base.state === 'ok' ? JSON.parse(JSON.stringify(bell)) : emptyBell();
    if (!Array.isArray(next.schedules)) next.schedules = [];
    if (!isObj(next.letters)) next.letters = { A: null, B: null };
    if (!isObj(next.types)) next.types = {};
    if (!own(next, 'regular')) next.regular = null;
    next.v = BELL_VERSION;
    var ids = (imported && imported.schedules || []).map(function (s) {
      var id = makeId();
      next.schedules.push({ id: id, name: s.name, periods: s.periods.map(function (p) {
        return { label: p.label, start: p.start, end: p.end };
      }) });
      return id;
    });
    var L = imported && imported.letters || {};
    ['A', 'B'].forEach(function (k) {
      if (!next.letters[k] && typeof L[k] === 'number' && ids[L[k]]) next.letters[k] = ids[L[k]];
    });
    if (!next.regular && typeof L.A === 'number' && L.A === L.B && ids[L.A]) next.regular = ids[L.A];
    return next;
  }

  /** The other way (rank 12, "032 owns, 035 imports"): 032's schedules as 035's
      settings.bellSchedule, for 035's "From the School Calendar" control.
      forScheduleVisualizer(cal, modCount, pick?) returns
        { state: 'nocalendar'|'none'|'broken'|'newer'|'ok',
          choices: [{ id, name, periods }],     every schedule 032 holds
          pick: { A: id|null, B: id|null },     B null is "same as A"
          bellSchedule: { A: rows|null, B: rows|null },
          extra: { A: n, B: n } }               periods past modCount, left out
      `pick` is what the teacher chose; an id 032 no longer has falls back to the
      default, which is A: the A-day schedule, else the ordinary day's, else the
      first; B: the B-day schedule, else the ordinary day's, else A's; a B that
      is A's schedule is "same as A". Periods go to mods by position: 032's
      first period is mod 1 whatever it is called. `rows` is 035's own shape,
      [{ start, end }|null] of length modCount, a mod past the schedule's end
      null. Writes nothing; 035 keeps the result only when its Save is pressed. */
  function forScheduleVisualizer(cal, modCount, pick) {
    var out = { state: 'nocalendar', choices: [], pick: { A: null, B: null },
      bellSchedule: { A: null, B: null }, extra: { A: 0, B: 0 } };
    if (!isCalendar(cal)) return out;
    var c = cleanBell(cal.bell);
    if (c.state === 'broken' || c.state === 'newer') { out.state = c.state; return out; }
    var bell = c.bell;
    if (!bell.schedules.length) { out.state = 'none'; return out; }
    out.state = 'ok';
    out.choices = bell.schedules.map(function (sc) { return { id: sc.id, name: sc.name, periods: sc.periods.length }; });
    function has(id) { return typeof id === 'string' && !!scheduleById(bell, id); }
    var p = isObj(pick) ? pick : {};
    var a = has(p.A) ? p.A
      : has(bell.letters.A) ? bell.letters.A
      : has(bell.regular) ? bell.regular
      : bell.schedules[0].id;
    var b;
    if (own(p, 'B') && (p.B === null || has(p.B))) b = p.B;
    else b = has(bell.letters.B) ? bell.letters.B : has(bell.regular) ? bell.regular : null;
    if (b === a) b = null;
    out.pick = { A: a, B: b };
    var n = Math.max(1, Math.min(MAX_PERIODS, parseInt(modCount, 10) || 8));
    function rows(id, letter) {
      var periods = scheduleById(bell, id).periods;
      var r = [];
      for (var i = 0; i < n; i++) {
        var q = periods[i];
        r.push(q ? { start: q.start, end: q.end } : null);
      }
      out.extra[letter] = Math.max(0, periods.length - n);
      return r;
    }
    out.bellSchedule.A = rows(a, 'A');
    if (b !== null) out.bellSchedule.B = rows(b, 'B');
    return out;
  }

  global.SchoolDay = {
    KEY: KEY,
    BELL_VERSION: BELL_VERSION,
    toMinutes: toMinutes,
    localISO: localISO,
    read: read,
    isCalendar: isCalendar,
    isSchoolDay: isSchoolDay,
    abLetters: abLetters,
    emptyBell: emptyBell,
    cleanBell: cleanBell,
    dayOf: dayOf,
    scheduleFor: scheduleFor,
    typeLabel: typeLabel,
    describe: describe,
    periodAt: periodAt,
    today: today,
    gradingPeriods: gradingPeriods,
    gradingPeriodOf: gradingPeriodOf,
    daysRemaining: daysRemaining,
    fromScheduleVisualizer: fromScheduleVisualizer,
    addImported: addImported,
    forScheduleVisualizer: forScheduleVisualizer
  };
})(typeof window !== 'undefined' ? window : globalThis);
