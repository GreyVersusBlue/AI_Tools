// _legacy.mjs — 021's rotation code as the page had it on 2026-10-27
// (CACHE_VERSION v353), before Path 13 P3 moves it into _shared/rotation.js.
// Copied out of Tools/021-pe-tournament-stations.html (computeAssignment,
// tick, doStart, doPause, doResume, doRotateNow, doReset and tickDisplay's
// time arithmetic), body for body. The only edits: the page's side effects
// (save, renderStage, sound, flashStage, showMsg, ensureAudio, broadcast) are
// left out, `state` and `getRotationMs` come in as arguments, and tick()
// returns `changed` where the page played the alarm. Date.now() is the page's
// own call: a suite patches it. Keep this file when the page stops carrying
// its own copy: it is what holds the shared clock to the rotations every
// class ran.

export function legacy(state, getRotationMs) {
  "use strict";

  function computeAssignment(countOverride) {
    var s = state.stations.length;
    var map = [];
    for (var i = 0; i < s; i++) map.push([]);
    if (s === 0) return map;
    var baseCount = typeof countOverride === 'number' ? countOverride : state.rotation.count;
    var count = ((baseCount % s) + s) % s;
    state.groups.forEach(function (g, gi) {
      var idx = (gi + count) % s;
      map[idx].push(g);
    });
    return map;
  }

  function displayMs() {
    var r = state.rotation;
    var totalMs = getRotationMs();
    var display;
    if (r.running && r.endAt) {
      display = r.endAt - Date.now();
    } else if (r.paused && r.remainingMs != null) {
      display = r.remainingMs;
    } else {
      display = totalMs;
    }
    return display;
  }

  function tick() {
    var r = state.rotation;
    if (!r.running || !r.endAt) { return false; }
    var remaining = r.endAt - Date.now();
    var guard = 0;
    var changed = false;
    while (remaining <= 0 && guard < 200 && state.stations.length > 0) {
      var totalMs = getRotationMs();
      r.count = r.count + 1;
      r.endAt += (totalMs > 0 ? totalMs : 1000);
      remaining = r.endAt - Date.now();
      guard++;
      changed = true;
    }
    return changed;
  }

  function doStart() {
    var totalMs = getRotationMs();
    var r = state.rotation;
    r.running = true;
    r.paused = false;
    r.endAt = Date.now() + (r.remainingMs != null ? r.remainingMs : totalMs);
    r.remainingMs = null;
  }
  function doPause() {
    var r = state.rotation;
    if (!r.running) return;
    r.remainingMs = Math.max(0, r.endAt - Date.now());
    r.running = false;
    r.paused = true;
    r.endAt = null;
  }
  function doResume() {
    var r = state.rotation;
    if (!r.paused) return;
    r.running = true;
    r.paused = false;
    r.endAt = Date.now() + (r.remainingMs != null ? r.remainingMs : getRotationMs());
    r.remainingMs = null;
  }
  function doRotateNow() {
    if (!state.stations.length) return;
    var r = state.rotation;
    r.count = r.count + 1;
    var totalMs = getRotationMs();
    if (r.running) r.endAt = Date.now() + totalMs;
    else if (r.paused) r.remainingMs = totalMs;
  }
  function doReset() {
    var r = state.rotation;
    r.count = 0;
    r.running = false;
    r.paused = false;
    r.endAt = null;
    r.remainingMs = null;
  }

  return { computeAssignment, displayMs, tick, doStart, doPause, doResume, doRotateNow, doReset };
}
