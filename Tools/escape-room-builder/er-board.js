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

  /** Takes one message from a device (the shape lock.html sends: station, id, total, done, score)
      and notes when it arrived. `now` is the monitor's clock in ms. */
  function applyMessage(device, msg, now) {
    var before = passed(device), wasDone = !!device.done, wasId = device.stationId || null;
    device.station = msg.station || 0;
    device.stationId = typeof msg.id === 'string' ? msg.id : null;
    device.total = msg.total || 0;
    device.done = !!msg.done;
    device.score = typeof msg.score === 'number' ? msg.score : null;
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
      not asked for anything: this is only what the monitor already heard. `at` is when it was kept. */
  function toRecord(devices, clockStart, at) {
    return {
      v: 1, at: typeof at === 'number' ? at : null,
      raceStartAt: typeof clockStart === 'number' ? clockStart : null,
      teams: devices.filter(function (d) { return d.marks && Object.keys(d.marks).length; }).map(function (d) {
        var marks = {};
        Object.keys(d.marks).forEach(function (id) { marks[id] = { at: d.marks[id].at }; });
        return { name: nameOf(d), code: '', marks: marks, attempts: {}, hintsUsed: {}, penaltyMs: 0 };
      })
    };
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
    toRecord: toRecord, cleanRecord: cleanRecord, roomFor: roomFor };
})(typeof window !== 'undefined' ? window : this);
