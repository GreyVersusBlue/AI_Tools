/* countdown.js — the site's one countdown: the arithmetic every timer here
   was doing on its own. Path 22 P5. `window.Countdown`, a plain global
   script like qr-draw.js and state-link.js, so classic pages and ES modules
   (004's ct-app.js) read the same copy.

   Three tools counted down three ways before this file: 004 Classroom Timer
   (phase.endAt / phase.remainingAtPause), 010 Command Center's Timer panel
   (whole seconds, endAt stored so a refresh resumes), and 087 Class Screen's
   timer widget (endsAt, fractional seconds). All three already agreed on the
   one idea that matters — drive the clock off a wall-clock END TIME, never a
   decrementing counter, because a backgrounded tab is throttled to one tick a
   minute and a counter would fall behind — and disagreed on the edges: what a
   timer that ran out while the page was closed should show, whether 0:00 can
   appear while a timer is still running, and how "4:30" is parsed.

   THE STATE is a plain object a tool can save as-is or map onto its own saved
   shape:

       { totalMs, endAt, leftMs }

     totalMs  the length it was set to (what Reset goes back to)
     endAt    epoch ms when it will hit zero while RUNNING, else 0
     leftMs   what is left while NOT running (paused, idle, or 0 when done)

   Every function takes `now` (epoch ms) as a parameter rather than reading
   the clock, so a suite can drive it without faking Date, and so one tick
   uses one instant for every decision it makes.

   RAN OUT WHILE CLOSED. restore() of a timer whose endAt has passed gives a
   finished timer (left 0) and says `expired: true` — and the caller should not
   ring for it. 010 decided this first ("showing 00:00 is honest; firing the
   alert now, ten minutes late, is not"); 087 did the same; it is the rule
   here now.

   FORMAT rounds UP for a countdown by default: 0:01 stays on screen until
   the timer is really done, so a running timer never shows 0:00. 004 and
   010 have always rounded to the nearest second, and they keep doing so —
   `round: 'round'` — because their suites and their teachers know that
   display; changing it is a separate, visible decision.

   Not here, on purpose: sounds, painting, storage, agenda segments, round
   robin, overtime. Those are each tool's. 004's phase engine still keeps its
   own endAt/remainingAtPause; moving it onto this state is the next step
   (BACKLOG, Path 22). */
(function (global) {
  'use strict';

  var MAX_MS = 24 * 3600 * 1000;

  function clampMs(v) {
    var n = typeof v === 'number' && isFinite(v) ? v : 0;
    return Math.min(MAX_MS, Math.max(0, n));
  }

  function create(totalMs) {
    var t = clampMs(totalMs);
    return { totalMs: t, endAt: 0, leftMs: t };
  }

  function isRunning(c) { return !!c && c.endAt > 0; }

  /** Milliseconds left at `now` (never negative). */
  function left(c, now) {
    if (!c) return 0;
    return isRunning(c) ? Math.max(0, c.endAt - now) : Math.max(0, c.leftMs);
  }

  /** Starts or resumes. A finished timer starts again from its full length. */
  function start(c, now) {
    if (isRunning(c)) return c;
    if (c.leftMs <= 0) c.leftMs = c.totalMs;
    if (c.leftMs <= 0) return c;
    c.endAt = now + c.leftMs;
    return c;
  }

  function pause(c, now) {
    if (!isRunning(c)) return c;
    c.leftMs = Math.max(0, c.endAt - now);
    c.endAt = 0;
    return c;
  }

  function toggle(c, now) { return isRunning(c) ? pause(c, now) : start(c, now); }

  /** Back to the full length, stopped. */
  function reset(c) {
    c.endAt = 0;
    c.leftMs = c.totalMs;
    return c;
  }

  /** A new length, stopped at it. */
  function setTotal(c, totalMs) {
    c.totalMs = clampMs(totalMs);
    return reset(c);
  }

  /** Adds (or with a negative ms, takes away) time, running or not. */
  function add(c, ms, now) {
    if (isRunning(c)) {
      var l = clampMs(c.endAt - now + ms);
      c.endAt = now + l;
      if (l <= 0) { c.endAt = 0; c.leftMs = 0; }
    } else {
      c.leftMs = clampMs(c.leftMs + ms);
    }
    return c;
  }

  /** True once, on the tick a running timer reaches zero: the caller rings
      then. The timer is left finished (stopped, 0 left). */
  function expire(c, now) {
    if (!isRunning(c) || c.endAt > now) return false;
    c.endAt = 0;
    c.leftMs = 0;
    return true;
  }

  function isDone(c) { return !!c && !isRunning(c) && c.leftMs <= 0; }

  /** A timer read back from storage, cleaned. `expired` means it was running
      and its end time passed while the page was closed: it comes back
      finished, and nothing should ring for it. */
  function restore(saved, now) {
    var s = saved && typeof saved === 'object' ? saved : {};
    var c = create(s.totalMs);
    var endAt = typeof s.endAt === 'number' && isFinite(s.endAt) ? s.endAt : 0;
    var expired = false;
    if (endAt > 0 && endAt > now) {
      c.endAt = Math.min(endAt, now + MAX_MS);
      c.leftMs = 0;
    } else if (endAt > 0) {
      c.leftMs = 0; expired = true;
    } else {
      c.leftMs = typeof s.leftMs === 'number' ? Math.min(c.totalMs, clampMs(s.leftMs)) : c.totalMs;
    }
    return { c: c, expired: expired };
  }

  /**
   * "4:05", or "1:02:03" past an hour; opts.pad gives "04:05".
   * opts.round: 'ceil' (default — a countdown never shows 0:00 while time is
   * left), 'round' (004's and 010's long-standing display), or 'floor' (for
   * elapsed time).
   */
  function format(ms, opts) {
    opts = opts || {};
    var r = opts.round === 'round' ? Math.round : opts.round === 'floor' ? Math.floor : Math.ceil;
    var s = Math.max(0, r(Math.max(0, ms) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    if (h > 0) return h + ':' + pad(m) + ':' + pad(sec);
    return (opts.pad ? pad(m) : String(m)) + ':' + pad(sec);
  }

  /** What a teacher types for a length, in seconds, or null.
      "5" or "2.5" are minutes; "4:30" is m:ss; "1:00:00" is h:mm:ss; "90s"
      is seconds. Zero, negative and over 24 hours are null. */
  function parse(text) {
    if (typeof text !== 'string') return null;
    text = text.trim().toLowerCase();
    var n;
    if (/^\d+(\.\d+)?$/.test(text)) n = Math.round(parseFloat(text) * 60);
    else if (/^\d+s$/.test(text)) n = parseInt(text, 10);
    else if (/^\d+:\d{1,2}$/.test(text)) {
      var a = text.split(':');
      if (+a[1] > 59) return null;
      n = +a[0] * 60 + +a[1];
    } else if (/^\d+:\d{1,2}:\d{1,2}$/.test(text)) {
      var b = text.split(':');
      if (+b[1] > 59 || +b[2] > 59) return null;
      n = +b[0] * 3600 + +b[1] * 60 + +b[2];
    } else return null;
    return n > 0 && n <= MAX_MS / 1000 ? n : null;
  }

  global.Countdown = {
    MAX_MS: MAX_MS,
    create: create,
    restore: restore,
    isRunning: isRunning,
    isDone: isDone,
    left: left,
    start: start,
    pause: pause,
    toggle: toggle,
    reset: reset,
    setTotal: setTotal,
    add: add,
    expire: expire,
    format: format,
    parse: parse
  };
})(typeof window !== 'undefined' ? window : globalThis);
