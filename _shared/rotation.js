/* rotation.js — the station-rotation clock (Path 13 P3): who stands at which
   station for rotation number N, and the countdown that moves N along.
   Publishes window.Rotation. Pure: no DOM, no storage, no sound, and no clock
   of its own: every function that needs the time is handed `now` (ms), so the
   Node suite pins it. The page keeps the sound, the stage drawing, the remote
   and save().

   WHERE IT CAME FROM. 021's computeAssignment() and its start / pause / resume
   / rotate-now / reset / tick code, moved out of the page at v354 with the
   arithmetic unchanged. The clock is a plain object the page already saves as
   `state.rotation`: { count, running, paused, endAt, remainingMs, minutes,
   seconds }. Each function changes that object in place, as the page did, and
   returns what the page needs to decide about sound and saving. A saved unit
   from an older page opens in this one and the reverse.
   Tools/pe-tournament-stations/test/rotation-parity.test.mjs holds every
   function to a frozen copy of the page's code (_legacy.mjs).

   `totalMs` is one rotation's length in ms, read by the page from its inputs
   (0 when unset). `stationCount` is the number of stations.

   FINISH AT N. rotateNow and tick take an optional last argument, the count at
   which the run is over (017's "Number of rotations"). Left out, they are 021's.
   Added at v355 for 017, the third reader of this module's arithmetic.

   NOT HERE. 004's round-robin tab (one step per zero, endAt = now + length, no
   catch-up) and 069's circuit (a performance.now timeline of work and rest)
   do not do this arithmetic, so they do not use it. */
(function (root) {
  'use strict';

  /* groups[gi] stands at station (gi + count) mod stationCount, count wrapped
     into 0..stationCount-1 (a negative count too). Returns an array of
     stationCount arrays of groups; no stations is an empty array. */
  function computeAssignment(groups, stationCount, count) {
    var s = stationCount;
    var map = [];
    for (var i = 0; i < s; i++) map.push([]);
    if (s === 0) return map;
    var wrapped = ((count % s) + s) % s;
    groups.forEach(function (g, gi) {
      var idx = (gi + wrapped) % s;
      map[idx].push(g);
    });
    return map;
  }

  /* Milliseconds the stage clock shows. */
  function remaining(r, now, totalMs) {
    if (r.running && r.endAt) return r.endAt - now;
    if (r.paused && r.remainingMs != null) return r.remainingMs;
    return totalMs;
  }

  function start(r, now, totalMs) {
    r.running = true;
    r.paused = false;
    r.endAt = now + (r.remainingMs != null ? r.remainingMs : totalMs);
    r.remainingMs = null;
  }

  /* False (and nothing changed) when the clock was not running. */
  function pause(r, now) {
    if (!r.running) return false;
    r.remainingMs = Math.max(0, r.endAt - now);
    r.running = false;
    r.paused = true;
    r.endAt = null;
    return true;
  }

  /* False (and nothing changed) when the clock was not paused. */
  function resume(r, now, totalMs) {
    if (!r.paused) return false;
    r.running = true;
    r.paused = false;
    r.endAt = now + (r.remainingMs != null ? r.remainingMs : totalMs);
    r.remainingMs = null;
    return true;
  }

  /* The clock stops where a run of `finishAt` rotations ends (017's "Number of
     rotations"): not running, not paused, nothing left on it. count is kept. */
  function finish(r) {
    r.running = false;
    r.paused = false;
    r.endAt = null;
    r.remainingMs = null;
  }

  /* One rotation now; a running clock starts a full rotation over, a paused one
     is left with a full rotation to resume into. With `finishAt` (a rotation
     count, left out by 021) the rotation that brings the count to it stops the
     clock instead. */
  function rotateNow(r, now, totalMs, finishAt) {
    r.count = r.count + 1;
    if (finishAt && r.count >= finishAt) finish(r);
    else if (r.running) r.endAt = now + totalMs;
    else if (r.paused) r.remainingMs = totalMs;
  }

  function reset(r) {
    r.count = 0;
    r.running = false;
    r.paused = false;
    r.endAt = null;
    r.remainingMs = null;
  }

  /* Catches the count up with the clock: every rotation whose end has passed
     (a tab that slept through several comes back to the right one; at most 200
     in a call, as the page always capped it). Returns true if the count moved.
     A zero-length rotation advances by a second so it cannot spin. With
     `finishAt` (left out by 021) the rotation that brings the count to it
     stops the clock, with no further catching up. */
  function tick(r, now, totalMs, stationCount, finishAt) {
    var left = r.endAt - now;
    var guard = 0;
    var changed = false;
    while (left <= 0 && guard < 200 && stationCount > 0) {
      r.count = r.count + 1;
      changed = true;
      if (finishAt && r.count >= finishAt) { finish(r); break; }
      r.endAt += (totalMs > 0 ? totalMs : 1000);
      left = r.endAt - now;
      guard++;
    }
    return changed;
  }

  root.Rotation = {
    computeAssignment: computeAssignment,
    remaining: remaining,
    start: start,
    pause: pause,
    resume: resume,
    rotateNow: rotateNow,
    reset: reset,
    tick: tick
  };
})(typeof window !== 'undefined' ? window : globalThis);
