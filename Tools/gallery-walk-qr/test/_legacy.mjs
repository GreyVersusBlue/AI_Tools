// _legacy.mjs — 017's rotation timer as the page had it on 2026-10-27
// (CACHE_VERSION v354), before Path 13 P3 step 3 moves it onto _shared/rotation.js.
// Copied out of Tools/017-gallery-walk-qr.html (tickTimerDisplay's time
// arithmetic, tickTimer, and the start, pause, resume, rotate-now and reset
// click handlers), body for body. The only edits: the page's side effects
// (save, renderTimerUI, ensureAudio, the alarm, showMsg) are left out, `state`
// and `getRotationMs` come in as arguments, a handler returns what the page
// decided on (tick: `changed`; start: false for the zero-length refusal), and
// the early returns report themselves. Date.now() is the page's own call: a
// suite patches it. Keep this file when the page stops carrying its own copy:
// it is what holds the shared clock to the walks every class ran.

export function legacy(state, getRotationMs) {
  "use strict";

  function displayMs() {
    var t = state.timer;
    var totalMs = getRotationMs();
    var display;
    if (t.running && t.endAt) display = t.endAt - Date.now();
    else if (t.paused && t.remainingMs != null) display = t.remainingMs;
    else display = totalMs;
    return display;
  }

  function tick() {
    var t = state.timer;
    if (!t.running || !t.endAt) return false;
    var remaining = t.endAt - Date.now();
    var guard = 0, changed = false;
    while (remaining <= 0 && guard < 200) {
      var totalMs = getRotationMs();
      t.count++;
      changed = true;
      if (t.count >= t.rotations) { t.running = false; t.endAt = null; t.remainingMs = null; break; }
      t.endAt += (totalMs > 0 ? totalMs : 1000);
      remaining = t.endAt - Date.now();
      guard++;
    }
    return changed;
  }

  function doStart() {
    var totalMs = getRotationMs();
    if (totalMs <= 0) return false;
    var t = state.timer;
    if (t.count >= t.rotations) t.count = 0;
    t.running = true;
    t.paused = false;
    t.endAt = Date.now() + (t.remainingMs != null ? t.remainingMs : totalMs);
    t.remainingMs = null;
    return true;
  }
  function doPause() {
    var t = state.timer;
    if (!t.running) return false;
    t.remainingMs = Math.max(0, t.endAt - Date.now());
    t.running = false;
    t.paused = true;
    t.endAt = null;
    return true;
  }
  function doResume() {
    var t = state.timer;
    if (!t.paused) return false;
    t.running = true;
    t.paused = false;
    t.endAt = Date.now() + (t.remainingMs != null ? t.remainingMs : getRotationMs());
    t.remainingMs = null;
    return true;
  }
  function doRotateNow() {
    var t = state.timer;
    if (t.count >= t.rotations) return false;
    t.count++;
    var totalMs = getRotationMs();
    if (t.count >= t.rotations) { t.running = false; t.paused = false; t.endAt = null; t.remainingMs = null; }
    else if (t.running) t.endAt = Date.now() + totalMs;
    else if (t.paused) t.remainingMs = totalMs;
    return true;
  }
  function doReset() {
    var t = state.timer;
    t.count = 0;
    t.running = false;
    t.paused = false;
    t.endAt = null;
    t.remainingMs = null;
  }

  return { displayMs: displayMs, tick: tick, doStart: doStart, doPause: doPause, doResume: doResume, doRotateNow: doRotateNow, doReset: doReset };
}
