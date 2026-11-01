// engine.test.mjs — ct-engine.js against the arithmetic it replaced.
//
//   node Tools/classroom-timer/test/engine.test.mjs
//
// ct-app.js used to do these sums inline on `phase.endAt` and
// `phase.remainingAtPause`. OLD below is a frozen copy of each of those
// formulas, written from the code as it stood at 9342c12; every function in
// ct-engine.js must give the same answer, over a grid that includes the cases
// a Countdown state cannot hold (a negative hold, zero, a length past 24
// hours). Pure Node: no browser, no clock.
//
// Exits 1 on any failure.

globalThis.window = globalThis;   // countdown.js publishes on window; the engine reads window.Countdown
await import('../../../_shared/countdown.js');
const E = await import('../ct-engine.js');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(Object.is(a, b), `${label} (got ${a}, want ${b})`);

const OLD = {
  begin: (total, now) => now + total,
  remaining: (endAt, now) => Math.max(0, endAt - now),
  isZero: (endAt, now) => endAt - now <= 0,
  pause: (endAt, now) => endAt - now,
  resume: (held, now) => now + held,
  over: (endAt, held, now, running) => running ? now - endAt : -held
};

const D = 24 * 3600 * 1000;
const totals = [1, 999, 1000, 5000, 60000, 90500, 3600000, 10800000, D - 1, D, D + 1, 25 * 3600 * 1000, 0, -5];
// Real clock readings only: Date.now() is never near 0, and a phase whose length is
// 0 or less is refused by onStart() before begin() is ever reached (so for those
// only begin() itself is compared).
const nows = [1788000000000, 1788000000123];
const offsets = [-100000, -1000, -50, -1, 0, 1, 50, 999, 1000, 30000, 59999, 60000, 5 * 60000];

for (const now of nows) for (const total of totals) {
  const p = {};
  E.begin(p, total, now);
  eq(p.endAt, OLD.begin(total, now), `begin ${total} @${now}`);
  eq(p.totalMs, total, `begin keeps the length ${total}`);
  if (total <= 0) continue;
  for (const off of offsets) {
    const at = now + off;
    eq(E.remaining(p, at), OLD.remaining(p.endAt, at), `remaining ${total} @+${off}`);
    eq(E.isZero(p, at), OLD.isZero(p.endAt, at), `isZero ${total} @+${off}`);
    const q = { totalMs: total, endAt: p.endAt };
    E.pause(q, at);
    eq(q.remainingAtPause, OLD.pause(p.endAt, at), `pause ${total} @+${off}`);
    eq(q.endAt, p.endAt, `pause leaves endAt alone ${total} @+${off}`);
    for (const later of [0, 1000, 123456]) {
      const r = { totalMs: total, remainingAtPause: q.remainingAtPause };
      E.resume(r, at + later);
      eq(r.endAt, OLD.resume(q.remainingAtPause, at + later), `resume ${total} @+${off} +${later}`);
    }
    eq(E.over(p, at, true), OLD.over(p.endAt, 0, at, true), `over running ${total} @+${off}`);
    eq(E.over(q, at, false), OLD.over(0, q.remainingAtPause, at, false), `over paused ${total} @+${off}`);
  }
}

// A held negative (a pause in overtime, or just past zero) is kept, not clamped, and a
// resume of it puts the zero instant behind now so the next tick sees zero.
{
  const p = { totalMs: 10000, endAt: 1000 };
  E.pause(p, 6000);
  eq(p.remainingAtPause, -5000, 'a pause in overtime holds minus the time over');
  E.resume(p, 9000);
  eq(p.endAt, 4000, 'a resume puts the zero instant behind now by the same amount');
  eq(E.isZero(p, 9000), true, 'and the next tick sees zero');
  const z = { totalMs: 10000, remainingAtPause: 0 };
  E.resume(z, 500);
  eq(z.endAt, 500, 'a resume of exactly zero is zero left, not a restart from the full length');
}
{
  const h = { totalMs: 20000 };
  E.holdFull(h);
  eq(h.remainingAtPause, 20000, 'holdFull holds the whole length');
  eq(E.held({ totalMs: 20000, remainingAtPause: 7000 }), 7000, 'held is what is held');
  eq(E.held({ totalMs: 20000, remainingAtPause: -3000 }), 0, 'held is never negative');
}
// The engine really goes through Countdown: with its start() broken, begin() changes.
{
  const real = window.Countdown.start;
  window.Countdown.start = (c, now) => { c.endAt = now + c.leftMs + 1; return c; };
  const p = {}; E.begin(p, 5000, 0);
  eq(p.endAt, 5001, 'begin() runs on Countdown.start');
  window.Countdown.start = real;
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
