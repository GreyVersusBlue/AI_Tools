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
    var before = passed(device), wasDone = !!device.done;
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

  /** 83000 -> "1:23"; 3723000 -> "1:02:03". */
  function formatElapsed(ms) {
    var t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  global.ErBoard = { passed: passed, applyMessage: applyMessage, leaderboard: leaderboard, formatElapsed: formatElapsed, nameOf: nameOf };
})(typeof window !== 'undefined' ? window : this);
