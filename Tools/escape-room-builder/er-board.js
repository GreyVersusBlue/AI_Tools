/* er-board.js — the teacher monitor's teams, clock and leaderboard (Path 18 P3).
 *
 * Pure logic, no DOM: monitor.html feeds it each device's messages and draws what it returns, and
 * Tools/escape-room-builder/test/er-board.test.mjs runs it in Node. A "team" is the device a team
 * connected; the clock is the TEACHER's (pressing Start), and every time here is the monitor's own
 * clock at the moment a message arrived, so nothing a student device sends is trusted for timing
 * and lock.html did not change.
 *
 * Ranking is Stations.rank(): the order 018's leaderboard uses (more stations, then the earlier
 * finish). Score (hint costs) is shown beside it and does not change the order: minutes or
 * points on a room's leaderboard is Devon's open question 5, and this is the default. */
(function (global) {
  'use strict';

  /** How far a device has got: stations passed, all of them once it is done. */
  function passed(d) { return d.total > 0 ? (d.done ? d.total : Math.min(d.station, d.total)) : 0; }

  /** A count a device sent (its station, the room's total): a whole number from 0 up, or NaN for anything else,
      a missing or null one included (lock.html always sends both). Only a number or a string of digits is read, so
      an object with its own toString is never coerced. */
  function count(v) {
    if (typeof v !== 'number' && !(typeof v === 'string' && /^[0-9]{1,6}$/.test(v))) return NaN;
    var n = Number(v);
    return isFinite(n) && n >= 0 && Math.floor(n) === n ? n : NaN;
  }

  /** One message as the monitor reads it, or null when it is not one: a station or total that is not a count
      refuses the whole message (review H3: a station of markup reached the roster's innerHTML). */
  function readMessage(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
    var station = count(msg.station), total = count(msg.total);
    if (isNaN(station) || isNaN(total)) return null;
    return { station: station, total: total, done: msg.done === true,
      id: typeof msg.id === 'string' && msg.id.length <= 64 ? msg.id : null,
      score: typeof msg.score === 'number' && isFinite(msg.score) ? msg.score : null };
  }

  /** Takes one message from a device (the shape lock.html sends: station, id, total, done, score)
      and notes when it arrived. `now` is the monitor's clock in ms. Returns the device, or null, changing
      nothing, when the message is not one (readMessage). */
  function applyMessage(device, raw, now) {
    var msg = readMessage(raw);
    if (!msg) return null;
    var before = passed(device), wasDone = !!device.done, wasId = device.stationId || null;
    device.station = msg.station;
    device.stationId = msg.id;
    device.total = msg.total;
    device.done = msg.done;
    device.score = msg.score;
    if (typeof device.firstAt !== 'number') device.firstAt = now;
    var after = passed(device);
    if (after !== before || typeof device.lastAt !== 'number') device.lastAt = now;
    if (device.done && !wasDone) device.doneAt = now;
    if (!device.done) device.doneAt = null;   // a restarted room is not finished
    // The record (Path 18 P4): a station is solved when the device moves off it, or finishes while on it.
    // The time is the monitor's clock, as every time here is. A device whose code carries no station ids
    // (an older printed code) names nothing, so it records nothing; a restart from the end starts the record again.
    if (!device.marks || typeof device.marks !== 'object') device.marks = {};
    // A room can send a team back to an earlier station, so a lower station number is not a restart; a finished
    // room that is not finished any more is, and the first solve of a station is the one kept.
    if (wasDone && !device.done) device.marks = {};
    else if (wasId && (device.stationId !== wasId || (device.done && !wasDone))) {
      if (!device.marks[wasId]) device.marks[wasId] = { at: now };
    }
    return device;
  }

  function nameOf(d) { return (typeof d.name === 'string' && d.name.trim()) || ('Team ' + d.id); }

  /** Leaderboard rows, best first. `clockStart` is when the teacher pressed Start (ms) or null.
      A finished team's `elapsedMs` is its finish minus the start; it is null before the clock
      starts, for a team still playing, and when the team finished before the clock was started. */
  function leaderboard(devices, clockStart) {
    var rows = devices.map(function (d) {
      var p = passed(d), finished = d.total > 0 && !!d.done;
      var el = finished && typeof clockStart === 'number' && typeof d.doneAt === 'number' && d.doneAt >= clockStart ? d.doneAt - clockStart : null;
      return { id: d.id, name: nameOf(d), passed: p, total: d.total, finished: finished, connected: !!d.connected,
        score: typeof d.score === 'number' ? d.score : null, elapsedMs: el,
        done: p, count: p, effectiveMark: typeof d.lastAt === 'number' ? d.lastAt : null };
    });
    return global.Stations.rank(rows);
  }

  /** The record a monitor keeps of a room's play, in the shape `Stations.debrief` reads as a run
      (`raceStartAt`, `teams [{ name, code, marks, attempts, hintsUsed, penaltyMs }]`), so the debrief has one
      rule and not a second. A device reports where a team is, not its wrong tries or hints, so `attempts`
      and `hintsUsed` are empty here by design and the sheet is drawn `without` them. Student devices are
      not asked for anything: this is only what the monitor already heard. `at` is when it was kept.
      `base` (review M7) is the record kept before this page was opened, or null. Its teams stay, in its order; a
      device the teacher paired as one of them (`kept`, the team's place in `base.teams`) adds its solves to that
      sheet, the first solve of a station kept, and gives it its typed name when it has one; the rest follow. */
  function toRecord(devices, clockStart, at, base) {
    var mine = devices.filter(function (d) { return d.marks && Object.keys(d.marks).length; });
    var used = {};
    function sheet(name, marks) { return { name: name, code: '', marks: marks, attempts: {}, hintsUsed: {}, penaltyMs: 0 }; }
    function copy(into, from) { Object.keys(from || {}).forEach(function (id) { if (!into[id]) into[id] = { at: from[id].at }; }); return into; }
    var teams = (base && Array.isArray(base.teams) ? base.teams : []).map(function (t, i) {
      var d = mine.filter(function (x) { return x.kept === i; })[0];
      if (!d) return sheet(t.name, copy({}, t.marks));
      used[d.id] = true;
      var typed = typeof d.name === 'string' && d.name.trim();
      return sheet(typed || t.name, copy(copy({}, t.marks), d.marks));
    });
    mine.forEach(function (d) { if (!used[d.id]) teams.push(sheet(nameOf(d), copy({}, d.marks))); });
    return { v: 1, at: typeof at === 'number' ? at : null, raceStartAt: typeof clockStart === 'number' ? clockStart : null, teams: teams };
  }

  /** How long a kept record is carried into a newly opened monitor (review M7): a reload mid-game is minutes,
      a block period is 90; a record older than this is last class's, and a new solve starts a new one, as
      before. */
  var CARRY_MS = 2 * 60 * 60 * 1000;
  function carries(record, now) { return !!(record && typeof record.at === 'number' && now - record.at >= 0 && now - record.at < CARRY_MS); }

  /** Who a new pairing can be (review M7), for the pairing box's "Who is connecting?": a team already on this page
      (`d:<id>`, the disconnected ones first) and a team kept from before the page was opened that no device has
      taken yet (`k:<place>`). A new team is the page's own first option and is not in the list. The teacher picks;
      nothing a device sends decides it. */
  function rejoinChoices(devices, base) {
    var out = [];
    devices.filter(function (d) { return !d.connected; }).concat(devices.filter(function (d) { return d.connected; })).forEach(function (d) {
      out.push({ value: 'd:' + d.id, label: nameOf(d) + (d.connected ? ' (still connected)' : ' (disconnected)') });
    });
    (base && Array.isArray(base.teams) ? base.teams : []).forEach(function (t, i) {
      if (devices.some(function (d) { return d.kept === i; })) return;
      out.push({ value: 'k:' + i, label: (t.name || 'Team') + ' (kept before this page was opened)' });
    });
    return out;
  }

  /** A stored record, or null when it is not one. Anything else in a team is dropped. */
  function cleanRecord(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1 || !Array.isArray(raw.teams)) return null;
    var teams = [];
    raw.teams.forEach(function (t) {
      if (!t || typeof t !== 'object' || !t.marks || typeof t.marks !== 'object') return;
      var marks = {};
      Object.keys(t.marks).forEach(function (id) {
        var m = t.marks[id];
        if (m && typeof m === 'object' && typeof m.at === 'number' && isFinite(m.at)) marks[id] = { at: m.at };
      });
      teams.push({ name: typeof t.name === 'string' ? t.name.slice(0, 80) : '', code: '', marks: marks, attempts: {}, hintsUsed: {}, penaltyMs: 0 });
    });
    return { v: 1, at: typeof raw.at === 'number' ? raw.at : null,
      raceStartAt: typeof raw.raceStartAt === 'number' && isFinite(raw.raceStartAt) ? raw.raceStartAt : null, teams: teams };
  }

  /** Which saved room a record belongs to: the one that holds the most of its station ids, ties to the first.
      `sets` is the room store's `{ name: room }`; returns the name, or null when no room holds any. */
  function roomFor(sets, record) {
    var ids = {};
    (record && record.teams || []).forEach(function (t) { Object.keys(t.marks || {}).forEach(function (id) { ids[id] = true; }); });
    var best = null, bestN = 0;
    Object.keys(sets || {}).forEach(function (name) {
      var r = sets[name], n = 0;
      (r && Array.isArray(r.stations) ? r.stations : []).forEach(function (st) { if (st && ids[st.id]) n++; });
      if (n > bestN) { best = name; bestN = n; }
    });
    return best;
  }

  /** 83000 -> "1:23"; 3723000 -> "1:02:03". */
  function formatElapsed(ms) {
    var t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  global.ErBoard = { passed: passed, applyMessage: applyMessage, leaderboard: leaderboard, formatElapsed: formatElapsed, nameOf: nameOf,
    toRecord: toRecord, cleanRecord: cleanRecord, roomFor: roomFor,
    readMessage: readMessage, carries: carries, CARRY_MS: CARRY_MS, rejoinChoices: rejoinChoices };
})(typeof window !== 'undefined' ? window : this);
