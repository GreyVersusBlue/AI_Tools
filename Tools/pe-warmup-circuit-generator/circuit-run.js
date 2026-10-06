/* circuit-run.js — the clock and the rotation for 069's "Run the circuit"
   projector mode. A plain script that publishes one global, `CircuitRun`, so
   the page can call it and a pure-Node suite can import it and drive it with
   a clock it controls.

   Nothing here touches the page. The page owns the picture and the sound; this
   file owns three things that must be right and are easy to get wrong:

     Time. A run is a position on a timeline of `stations` rounds, each a work
     period and then (if set) a rest period, with no rest after the last round.
     The position is read from a clock — `now()` at the moment you ask minus
     `now()` at the moment you started, plus whatever was banked before a pause
     — never by counting ticks, so a tab the browser throttles to one timer a
     second, or freezes for a minute, shows the right time the next time it
     looks. at(ms, plan) turns a position into a phase, a round and the
     milliseconds left in the phase.

     Rotation. assign(round, plan) says which station each group is at. Group g
     of G starts at station floor(g*n/G) and moves down one station a round,
     wrapping, so with G <= n no two groups share a station and every group
     visits every station in n rounds.

     Beeps. beeps(kind) is the schedule of tones for a rotation signal as data
     (seconds after the signal, frequency, length), which the page hands to Web
     Audio. The sound is optional and off until the teacher turns it on; as data
     it can be asserted on without a speaker. */
(function (global) {
  'use strict';

  var LIMITS = {
    workSecs: { min: 5, max: 600, def: 30 },
    restSecs: { min: 0, max: 300, def: 10 },
    groups: { min: 1, max: 26, def: 1 }
  };

  function int(v, lim) {
    if (typeof v !== 'number' && typeof v !== 'string') return lim.def;
    if (typeof v === 'string' && v.trim() === '') return lim.def;
    var n = Math.round(Number(v));
    if (!isFinite(n)) return lim.def;
    return Math.min(lim.max, Math.max(lim.min, n));
  }

  /** The three run settings as whole numbers inside their limits; anything
      missing or unreadable takes its default. Never throws. */
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
    return {
      workSecs: int(raw.workSecs, LIMITS.workSecs),
      restSecs: int(raw.restSecs, LIMITS.restSecs),
      groups: int(raw.groups, LIMITS.groups)
    };
  }

  /** The timeline for `n` stations, or null when there are none. */
  function plan(n, raw) {
    n = Math.floor(Number(n));
    if (!(n >= 1)) return null;
    var c = clean(raw);
    var work = c.workSecs * 1000;
    var rest = c.restSecs * 1000;
    return {
      stations: n,
      groups: Math.min(c.groups, n),
      workMs: work,
      restMs: rest,
      roundMs: work + rest,
      totalMs: n * work + (n - 1) * rest
    };
  }

  /** Where `ms` into the run falls: { phase: 'work' | 'rest' | 'done', round,
      view, remainingMs, phaseStartMs, key }. `view` is the round whose
      stations to show (during a rest, the round everyone is moving to). */
  function at(ms, p) {
    ms = Math.max(0, Number(ms) || 0);
    if (ms >= p.totalMs) {
      return { phase: 'done', round: p.stations - 1, view: p.stations - 1, remainingMs: 0, phaseStartMs: p.totalMs, key: 'done' };
    }
    var r = Math.floor(ms / p.roundMs);
    var within = ms - r * p.roundMs;
    if (within < p.workMs) {
      return { phase: 'work', round: r, view: r, remainingMs: p.workMs - within, phaseStartMs: r * p.roundMs, key: r + ':work' };
    }
    return { phase: 'rest', round: r, view: r + 1, remainingMs: p.roundMs - within, phaseStartMs: r * p.roundMs + p.workMs, key: r + ':rest' };
  }

  /** Which station (0-based) each group is at in `round`:
      [{ group: 'A', station: 0 }, …]. */
  function assign(round, p) {
    var out = [];
    for (var g = 0; g < p.groups; g++) {
      var start = Math.floor(g * p.stations / p.groups);
      out.push({ group: String.fromCharCode(65 + g), station: (start + round) % p.stations });
    }
    return out;
  }

  /** The position Skip moves to: the start of the next phase, or the end. */
  function skipTarget(ms, p) {
    var s = at(ms, p);
    if (s.phase === 'done') return p.totalMs;
    if (s.phase === 'rest') return Math.min((s.round + 1) * p.roundMs, p.totalMs);
    if (p.restMs > 0) return s.phaseStartMs + p.workMs; // in the last round that is the end
    return Math.min((s.round + 1) * p.roundMs, p.totalMs);
  }

  /** Whole seconds left, rounded up, as m:ss. 0 ms is 0:00. */
  function fmt(ms) {
    var s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /** The tones of a signal: when to start each one (seconds after the signal),
      its pitch in Hz and its length in seconds. 'rest' is the move-now signal,
      two short beeps; 'work' is go, one long higher one; 'done' is three rising
      beeps; 'test' is the single beep heard when the sound is turned on. */
  function beeps(kind) {
    switch (kind) {
      case 'rest': return [{ at: 0, freq: 880, dur: 0.2 }, { at: 0.3, freq: 880, dur: 0.2 }];
      case 'work': return [{ at: 0, freq: 1175, dur: 0.5 }];
      case 'done': return [{ at: 0, freq: 660, dur: 0.2 }, { at: 0.3, freq: 880, dur: 0.2 }, { at: 0.6, freq: 1175, dur: 0.4 }];
      case 'test': return [{ at: 0, freq: 880, dur: 0.15 }];
      default: return [];
    }
  }

  /** A run on `now()` (milliseconds, monotonic). The position is the time
      banked at the last pause plus the clock since the last start, so it is
      right whenever it is read, however long the page went without a tick. */
  function createRun(p, now) {
    var banked = 0;
    var startedAt = null;
    var over = 0;
    function elapsed() {
      var ms = banked + (startedAt === null ? 0 : now() - startedAt);
      if (ms >= p.totalMs) {
        if (startedAt !== null) over = ms - p.totalMs;
        banked = p.totalMs; startedAt = null;
        return p.totalMs;
      }
      return Math.max(0, ms);
    }
    return {
      plan: p,
      elapsed: elapsed,
      running: function () { elapsed(); return startedAt !== null; },
      /* How long ago the clock took the run past its end, as of the read that
         noticed: 0 unless it ended by itself (a skip to the end is 0). */
      overrunMs: function () { elapsed(); return over; },
      state: function () { return at(elapsed(), p); },
      start: function () {
        if (elapsed() >= p.totalMs) return false;
        if (startedAt === null) startedAt = now();
        return true;
      },
      pause: function () { banked = elapsed(); startedAt = null; },
      reset: function () { banked = 0; startedAt = null; over = 0; },
      skip: function () {
        var target = skipTarget(elapsed(), p);
        banked = target;
        if (startedAt !== null) startedAt = now();
      }
    };
  }

  global.CircuitRun = {
    LIMITS: LIMITS,
    clean: clean,
    plan: plan,
    at: at,
    assign: assign,
    skipTarget: skipTarget,
    fmt: fmt,
    beeps: beeps,
    createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
