// ct-engine.js — the arithmetic of the Classroom Timer's phase, on _shared/countdown.js.
//
// Path 22 P13. ct-app.js used to keep `phase.endAt` and `phase.remainingAtPause`
// and do the sums inline in a dozen places (start, pause, resume, a station or
// segment change, the tick, a refresh). They are these functions now, and each
// one builds a Countdown state ({ totalMs, endAt, leftMs }) from the phase,
// asks _shared/countdown.js to move it, and writes the answer back.
//
// The phase keeps the SAME fields it always had (`endAt` while running,
// `remainingAtPause` while paused), because the saved `ct_running_v1` is read by
// the ambient strip window, by a tab still on an older cached build, and by a
// refresh; none of them is changed. Nothing here touches storage, the DOM or
// the clock: every function takes `now`.
//
// WHERE COUNTDOWN CANNOT HELP, AND THIS FILE KEEPS THE OLD ARITHMETIC. A
// Countdown state is never negative and caps at 24 hours; the phase has two
// places that are neither:
//   - OVERTIME. At zero the phase stays "running" with `endAt` as the zero
//     instant and paints `now - endAt` upward; paused, `remainingAtPause` is
//     minus the time over. That is the tool's own, as countdown.js's header
//     says (overtime is each tool's).
//   - The instant just past zero before the next tick has noticed (a pause in
//     that gap saves a small negative, and a resume puts `endAt` behind now so
//     the next tick rings once). Countdown.pause would clamp to 0 and
//     Countdown.start would then restart the timer from its full length.
//   - An "Until" target more than 24 hours away (the day a clock goes back).
// In each, the old sum is used, unchanged. A frozen copy of every old formula
// is compared with these functions over thousands of inputs in
// Tools/classroom-timer/test/engine.test.mjs.
//
// Countdown.expire() is not used: the tick asks `isZero()` and the controller
// decides what zero means (a station, a segment, overtime or the end).

const CD = () => window.Countdown;

/** The Countdown state a phase is in. `running` says which of its two fields is live. */
function stateOf(phase, running) {
  return running
    ? { totalMs: phase.totalMs, endAt: phase.endAt, leftMs: 0 }
    : { totalMs: phase.totalMs, endAt: 0, leftMs: phase.remainingAtPause };
}

const inRange = (ms) => ms > 0 && ms <= CD().MAX_MS;

/** Starts the phase's current length from `now`: `endAt` = now + totalMs. */
export function begin(phase, totalMs, now) {
  phase.totalMs = totalMs;
  if (inRange(totalMs)) {
    phase.endAt = CD().start(CD().create(totalMs), now).endAt;
  } else {
    phase.endAt = now + totalMs;
  }
  return phase;
}

/** A paused phase holding a full length (an agenda segment skipped to while paused). */
export function holdFull(phase) {
  phase.remainingAtPause = phase.totalMs;
  return phase;
}

/** Milliseconds left at `now` while running, never below 0. */
export function remaining(phase, now) {
  return CD().left(stateOf(phase, true), now);
}

/** Milliseconds left while paused (a pause in overtime holds minus the time
    over; this is 0 for that). */
export function held(phase) {
  return CD().left(stateOf(phase, false), 0);
}

/** True on or after the zero instant. */
export function isZero(phase, now) {
  return remaining(phase, now) <= 0;
}

/** Pause: `remainingAtPause` becomes what is left (signed past zero, as it always was). */
export function pause(phase, now) {
  const left = phase.endAt - now;
  if (left > 0 && inRange(phase.totalMs) && left <= phase.totalMs) {
    const c = stateOf(phase, true);
    CD().pause(c, now);
    phase.remainingAtPause = c.leftMs;
  } else {
    phase.remainingAtPause = left;
  }
  return phase;
}

/** Resume: `endAt` becomes now + what was held (a negative hold puts it behind now). */
export function resume(phase, now) {
  const held = phase.remainingAtPause;
  if (held > 0 && inRange(phase.totalMs) && held <= phase.totalMs) {
    phase.endAt = CD().start(stateOf(phase, false), now).endAt;
  } else {
    phase.endAt = now + held;
  }
  return phase;
}

/** Milliseconds past zero in overtime: counting up while running, held while paused. */
export function over(phase, now, running) {
  return running ? now - phase.endAt : -phase.remainingAtPause;
}
