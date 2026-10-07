// ct-board-core.js — the timer board's logic, with no DOM and no clock of its
// own. The board is two to four independent timers on one screen; each one is
// a _shared/countdown.js state ({ totalMs, endAt, leftMs }), so it is driven by
// a wall-clock END TIME and stays right through a throttled background tab, a
// laptop that slept, or a reload. Every function takes `now` (epoch ms) as a
// parameter so a suite can move the clock without faking Date.
//
// What is saved (inside ct_prefs, as `board`; see ct-store.js):
//   { open, count, timers: [ { label, minutes, seconds, endAt, leftMs } x4 ] }
// `endAt` is set only while a timer runs; `leftMs` is what is left while it is
// stopped; `paused` says a stopped timer was paused rather than never started
// (they differ only when it was paused in the very millisecond it started, but
// then "Ready" would be a lie). A save with no `board` is a save from before
// the board existed.

export const MIN_TIMERS = 2;
export const MAX_TIMERS = 4;
export const MAX_LABEL = 40;

const DEFAULT_TIMER = { label: '', minutes: 5, seconds: 0 };

function clamp(n, lo, hi, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

export function totalMsOf(t) {
  return ((t.minutes || 0) * 60 + (t.seconds || 0)) * 1000;
}

function sanitizeTimer(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const t = {
    label: String(r.label == null ? '' : r.label).trim().slice(0, MAX_LABEL),
    minutes: Math.floor(clamp(r.minutes, 0, 180, DEFAULT_TIMER.minutes)),
    seconds: Math.floor(clamp(r.seconds, 0, 59, DEFAULT_TIMER.seconds)),
    endAt: 0,
    leftMs: 0,
    paused: !!r.paused
  };
  const total = totalMsOf(t);
  const endAt = Number(r.endAt);
  t.endAt = Number.isFinite(endAt) && endAt > 0 ? Math.floor(endAt) : 0;
  t.leftMs = Math.floor(clamp(r.leftMs, 0, total, total));
  if (t.endAt > 0 || t.leftMs <= 0) t.paused = false;
  return t;
}

/** A saved board read back, cleaned — or null when there is none, which is
    what a save from before the board looks like. Never invents one. */
export function sanitizeBoard(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.timers)) return null;
  const timers = [];
  for (let i = 0; i < MAX_TIMERS; i++) timers.push(sanitizeTimer(raw.timers[i]));
  return {
    open: !!raw.open,
    count: Math.floor(clamp(raw.count, MIN_TIMERS, MAX_TIMERS, MIN_TIMERS)),
    timers
  };
}

export function defaultTimers() {
  const out = [];
  for (let i = 0; i < MAX_TIMERS; i++) out.push(sanitizeTimer(DEFAULT_TIMER));
  return out;
}

/** One saved timer as a live entry: { label, minutes, seconds, c } where `c`
    is a Countdown state. `expired` means it ran out while the page was closed:
    it comes back finished and nothing should ring for it. */
export function fromSaved(saved, now) {
  const t = sanitizeTimer(saved);
  const r = window.Countdown.restore({ totalMs: totalMsOf(t), endAt: t.endAt, leftMs: t.leftMs }, now);
  return { entry: { label: t.label, minutes: t.minutes, seconds: t.seconds, paused: t.paused && !r.expired, c: r.c }, expired: r.expired };
}

export function toSaved(entry) {
  const c = entry.c;
  return {
    label: entry.label,
    minutes: entry.minutes,
    seconds: entry.seconds,
    endAt: window.Countdown.isRunning(c) ? c.endAt : 0,
    leftMs: window.Countdown.isRunning(c) ? 0 : c.leftMs,
    paused: !!entry.paused && !window.Countdown.isRunning(c) && c.leftMs > 0
  };
}

/** 'idle' (full length, stopped), 'running', 'paused', or 'done'. */
export function stateOf(entry) {
  const c = entry.c;
  if (window.Countdown.isRunning(c)) return 'running';
  if (c.totalMs <= 0) return 'idle';
  if (c.leftMs <= 0) return 'done';
  return c.leftMs >= c.totalMs && !entry.paused ? 'idle' : 'paused';
}

/** Start, pause or resume (a finished timer starts again from its full
    length). A timer with no length does nothing. */
export function toggle(entry, now) {
  if (entry.c.totalMs <= 0) return false;
  const wasRunning = window.Countdown.isRunning(entry.c);
  window.Countdown.toggle(entry.c, now);
  entry.paused = wasRunning && !window.Countdown.isRunning(entry.c) && entry.c.leftMs > 0;
  return true;
}

export function reset(entry) {
  entry.paused = false;
  window.Countdown.reset(entry.c);
}

/** A new length, stopped at it. Refused while running or paused. */
export function setDuration(entry, minutes, seconds) {
  const s = stateOf(entry);
  if (s === 'running' || s === 'paused') return false;
  entry.minutes = Math.floor(clamp(minutes, 0, 180, 0));
  entry.seconds = Math.floor(clamp(seconds, 0, 59, 0));
  entry.paused = false;
  window.Countdown.setTotal(entry.c, totalMsOf(entry));
  return true;
}

/** One tick over the first `count` entries: the indexes that reached zero on
    this tick, each reported once (Countdown.expire leaves the timer finished). */
export function tick(entries, count, now) {
  const finished = [];
  for (let i = 0; i < count; i++) {
    if (window.Countdown.expire(entries[i].c, now)) finished.push(i);
  }
  return finished;
}

/** Hidden timers must not run: the smallest count that still shows every
    timer that is running or paused. */
export function minCountFor(entries) {
  let min = MIN_TIMERS;
  for (let i = 0; i < entries.length; i++) {
    const s = stateOf(entries[i]);
    if (s === 'running' || s === 'paused') min = Math.max(min, i + 1);
  }
  return min;
}

export function anyRunning(entries, count) {
  for (let i = 0; i < count; i++) if (window.Countdown.isRunning(entries[i].c)) return true;
  return false;
}

/** Same thresholds the single timer's Display card sets, as a fraction left. */
export function urgencyOf(fraction, amberPct, redPct) {
  const red = Math.max(0, (redPct || 0) / 100);
  const amber = Math.max(red, (amberPct || 0) / 100);
  if (fraction <= red) return 'critical';
  if (fraction <= amber) return 'warn';
  return 'good';
}

/** What a screen reader hears when timers finish: one sentence per tick. */
export function finishedMessage(labels) {
  if (!labels.length) return '';
  const list = labels.length === 1 ? labels[0]
    : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
  return list + ": time's up";
}

export default { MIN_TIMERS, MAX_TIMERS, sanitizeBoard, defaultTimers, fromSaved, toSaved, stateOf, toggle, reset, setDuration, tick, minCountFor, anyRunning, urgencyOf, finishedMessage, totalMsOf };
