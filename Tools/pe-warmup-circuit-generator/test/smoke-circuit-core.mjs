// smoke-circuit-core.mjs — 069's timeline, rotation and beep schedule, in pure Node.
//
//   node Tools/pe-warmup-circuit-generator/test/smoke-circuit-core.mjs
//
// circuit-run.js is the clock and the arithmetic behind "Run the circuit". It is
// tested here without a browser, against a clock the test moves by hand:
//
//   Settings. clean() takes anything and returns whole numbers inside the limits.
//   Timeline. plan() and at(): every boundary, the whole run swept in quarter
//   seconds, no gap, no overlap, no rest after the last round.
//   Rotation. assign(): no two groups on one station, every group meets every
//   station once, group letters, wrap-around.
//   Skip. skipTarget() lands on the next phase start or the end.
//   Clock. createRun(): a run read after a long silence is where the clock
//   says (no drift from missed ticks), pause banks the time, a paused run does
//   not move, skip and reset, the end stops itself.
//   Beeps. The schedule is data: kinds, pitches, when.
//
// CIRCUIT_RUN_FILE points the suite at another copy of the module; the
// deliberate-break runs use it. Exits 1 on any failure.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.CIRCUIT_RUN_FILE || path.join(here, '..', 'circuit-run.js');
await import(pathToFileURL(file).href);
const C = globalThis.CircuitRun;

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// ---- 1. settings ----
console.log('settings');
eq(C.clean(undefined), { workSecs: 30, restSecs: 10, groups: 1 }, 'no settings: 30 / 10 / 1');
eq(C.clean(null), { workSecs: 30, restSecs: 10, groups: 1 }, 'null: defaults');
eq(C.clean([5, 5, 5]), { workSecs: 30, restSecs: 10, groups: 1 }, 'an array: defaults');
eq(C.clean('x'), { workSecs: 30, restSecs: 10, groups: 1 }, 'a string: defaults');
eq(C.clean({ workSecs: 45, restSecs: 0, groups: 4 }), { workSecs: 45, restSecs: 0, groups: 4 }, 'in-range values kept, rest 0 is allowed');
eq(C.clean({ workSecs: '45', restSecs: '15', groups: '3' }), { workSecs: 45, restSecs: 15, groups: 3 }, 'numeric strings read');
eq(C.clean({ workSecs: 44.6 }).workSecs, 45, 'a fraction rounds');
eq(C.clean({ workSecs: 1 }).workSecs, 5, 'work under 5 is 5');
eq(C.clean({ workSecs: 99999 }).workSecs, 600, 'work over 600 is 600');
eq(C.clean({ restSecs: -4 }).restSecs, 0, 'rest under 0 is 0');
eq(C.clean({ restSecs: 9999 }).restSecs, 300, 'rest over 300 is 300');
eq(C.clean({ groups: 0 }).groups, 1, 'groups under 1 is 1');
eq(C.clean({ groups: 99 }).groups, 26, 'groups over 26 is 26');
for (const bad of ['', '   ', 'abc', NaN, Infinity, true, false, null, undefined, {}, []]) {
  eq(C.clean({ workSecs: bad, restSecs: bad, groups: bad }), { workSecs: 30, restSecs: 10, groups: 1 }, `unreadable ${JSON.stringify(bad)} (${typeof bad}) takes the defaults`);
}
eq(C.clean({ workSecs: ' 20 ' }).workSecs, 20, 'a padded numeric string reads');
eq(C.clean({ workSecs: 20, extra: 'x' }), { workSecs: 20, restSecs: 10, groups: 1 }, 'only the three settings come back');

// ---- 2. plan ----
console.log('plan');
eq(C.plan(0, {}), null, 'no stations: no plan');
eq(C.plan(-3, {}), null, 'negative stations: no plan');
eq(C.plan(NaN, {}), null, 'NaN stations: no plan');
eq(C.plan(8, { workSecs: 30, restSecs: 10, groups: 8 }),
  { stations: 8, groups: 8, workMs: 30000, restMs: 10000, roundMs: 40000, totalMs: 8 * 30000 + 7 * 10000 }, '8 stations 30/10: total is 8 works and 7 rests');
eq(C.plan(3, { workSecs: 20, restSecs: 0 }).totalMs, 60000, 'no rest: total is the works');
eq(C.plan(1, { workSecs: 20, restSecs: 10 }).totalMs, 20000, 'one station: no rest at all');
eq(C.plan(3, { groups: 9 }).groups, 3, 'groups are limited to the stations');
eq(C.plan(3, {}).groups, 1, 'one group by default');
eq(C.plan(4.9, {}).stations, 4, 'a fractional count floors');

// ---- 3. at() ----
console.log('timeline');
const P = C.plan(3, { workSecs: 30, restSecs: 10 }); // 0-30 w0, 30-40 r0, 40-70 w1, 70-80 r1, 80-110 w2, done at 110
const at = (ms) => C.at(ms, P);
eq(at(0), { phase: 'work', round: 0, view: 0, remainingMs: 30000, phaseStartMs: 0, key: '0:work' }, 't=0 is the start of round 0');
eq(at(29999).phase + at(29999).remainingMs, 'work1', 'last millisecond of work is still work');
eq(at(30000), { phase: 'rest', round: 0, view: 1, remainingMs: 10000, phaseStartMs: 30000, key: '0:rest' }, 'at 30 s the rest begins and the view is round 1');
eq(at(39999).phase, 'rest', 'last ms of rest is rest');
eq(at(40000), { phase: 'work', round: 1, view: 1, remainingMs: 30000, phaseStartMs: 40000, key: '1:work' }, 'at 40 s round 1 works');
eq(at(70000).key, '1:rest', 'at 70 s rest 1');
eq(at(80000).key, '2:work', 'at 80 s the last round');
eq(at(109999), { phase: 'work', round: 2, view: 2, remainingMs: 1, phaseStartMs: 80000, key: '2:work' }, 'one ms before the end the last round is working with 1 ms left');
eq(at(110000), { phase: 'done', round: 2, view: 2, remainingMs: 0, phaseStartMs: 110000, key: 'done' }, 'at the total the run is done');
eq(at(10 ** 9).phase, 'done', 'far past the end is done');
eq(at(-5000).key, '0:work', 'before the start clamps to the start');
eq(at(NaN).key, '0:work', 'NaN is the start');
// sweep
{
  let keys = [], prev = null, gap = 0;
  for (let ms = 0; ms <= P.totalMs + 1000; ms += 250) {
    const s = at(ms);
    if (s.key !== prev) { keys.push(s.key); prev = s.key; }
    if (s.phase !== 'done' && (s.remainingMs <= 0 || s.remainingMs > (s.phase === 'work' ? P.workMs : P.restMs))) gap++;
    if (s.phase !== 'done' && Math.abs((s.phaseStartMs + (s.phase === 'work' ? P.workMs : P.restMs) - s.remainingMs) - ms) > 0) gap++;
  }
  eq(keys, ['0:work', '0:rest', '1:work', '1:rest', '2:work', 'done'], 'swept in quarter seconds: six phases in order, no rest after the last round');
  eq(gap, 0, 'swept: remaining time is always inside its phase and phase start plus length minus remaining is the position');
}
{
  const Q = C.plan(4, { workSecs: 20, restSecs: 0 });
  let keys = [], prev = null;
  for (let ms = 0; ms <= Q.totalMs + 500; ms += 500) { const s = C.at(ms, Q); if (s.key !== prev) { keys.push(s.key); prev = s.key; } }
  eq(keys, ['0:work', '1:work', '2:work', '3:work', 'done'], 'no rest: work rounds back to back, no rest phase ever');
  eq(C.at(Q.totalMs - 1, Q).view, 3, 'no rest: the last round is round 3');
}
{
  const one = C.plan(1, { workSecs: 20, restSecs: 10 });
  eq(C.at(19999, one).phase, 'work', 'one station: works to the end');
  eq(C.at(20000, one).phase, 'done', 'one station: done with no rest');
}

// ---- 4. rotation ----
console.log('rotation');
for (const [n, g] of [[8, 8], [8, 4], [8, 3], [5, 5], [6, 2], [7, 1], [3, 26], [12, 5]]) {
  const p = C.plan(n, { groups: g });
  let distinct = true;
  const visited = {};
  for (let r = 0; r < n; r++) {
    const a = C.assign(r, p);
    if (new Set(a.map((x) => x.station)).size !== a.length) distinct = false;
    for (const x of a) (visited[x.group] ||= new Set()).add(x.station);
  }
  ok(distinct, `${n} stations ${g} groups: no two groups on one station in any round`);
  ok(Object.keys(visited).length === p.groups && Object.values(visited).every((v) => v.size === n), `${n} stations ${g} groups: every group meets every station in ${n} rounds`);
}
eq(C.assign(0, C.plan(8, { groups: 8 })).map((a) => a.station), [0, 1, 2, 3, 4, 5, 6, 7], '8 groups on 8: group A at 1 ... H at 8 to start');
eq(C.assign(1, C.plan(8, { groups: 8 })).map((a) => a.station), [1, 2, 3, 4, 5, 6, 7, 0], 'one round on: everyone has moved down one, H wraps to station 1');
eq(C.assign(0, C.plan(8, { groups: 4 })), [{ group: 'A', station: 0 }, { group: 'B', station: 2 }, { group: 'C', station: 4 }, { group: 'D', station: 6 }], '4 groups on 8: spread evenly, letters A to D');
eq(C.assign(7, C.plan(8, { groups: 4 })).map((a) => a.station), [7, 1, 3, 5], '4 groups on 8, round 7: wraps');
eq(C.assign(2, C.plan(5, { groups: 1 })), [{ group: 'A', station: 2 }], 'one group follows the round');
eq(C.assign(0, C.plan(30, { groups: 26 })).pop(), { group: 'Z', station: 28 }, '26 groups: the last letter is Z');

// ---- 5. skip ----
console.log('skip');
const sk = (ms) => C.skipTarget(ms, P);
eq(sk(0), 30000, 'in work: skip goes to the start of the rest');
eq(sk(12345), 30000, 'mid-work: the same');
eq(sk(30000), 40000, 'in rest: skip goes to the next round');
eq(sk(39000), 40000, 'late in rest: the same');
eq(sk(80000), 110000, 'in the last work: skip is the end (no rest follows)');
eq(sk(110000), 110000, 'done stays done');
{
  const Q = C.plan(3, { workSecs: 20, restSecs: 0 });
  eq([0, 20000, 40000].map((ms) => C.skipTarget(ms, Q)), [20000, 40000, 60000], 'no rest: skip goes to the next round, the last to the end');
}
{
  let ms = 0, steps = [];
  while (ms < P.totalMs) { ms = sk(ms); steps.push(ms); }
  eq(steps, [30000, 40000, 70000, 80000, 110000], 'skipping from the start visits every boundary and ends at the total');
}

// ---- 6. fmt ----
console.log('format');
eq([0, 1, 999, 1000, 1001, 59000, 59001, 59999, 60000, 600000, 3599000].map(C.fmt), ['0:00', '0:01', '0:01', '0:01', '0:02', '0:59', '1:00', '1:00', '1:00', '10:00', '59:59'], 'whole seconds, rounded up, m:ss');
eq(C.fmt(-4), '0:00', 'negative is 0:00');
eq(C.fmt(NaN), '0:00', 'NaN is 0:00');

// ---- 7. beeps ----
console.log('beeps');
eq(C.beeps('rest'), [{ at: 0, freq: 880, dur: 0.2 }, { at: 0.3, freq: 880, dur: 0.2 }], 'move: two beeps 0.3 s apart at 880 Hz');
eq(C.beeps('work'), [{ at: 0, freq: 1175, dur: 0.5 }], 'go: one long higher beep');
eq(C.beeps('done'), [{ at: 0, freq: 660, dur: 0.2 }, { at: 0.3, freq: 880, dur: 0.2 }, { at: 0.6, freq: 1175, dur: 0.4 }], 'done: three rising beeps');
eq(C.beeps('test'), [{ at: 0, freq: 880, dur: 0.15 }], 'test: one short beep');
eq(C.beeps('nope'), [], 'an unknown signal is silent');
eq(C.beeps(), [], 'no signal is silent');
for (const k of ['rest', 'work', 'done', 'test']) {
  const b = C.beeps(k);
  ok(b.every((x, i) => x.dur > 0 && x.freq >= 400 && x.freq <= 2000 && (i === 0 || x.at >= b[i - 1].at + b[i - 1].dur)), `${k}: beeps are audible, positive, and do not overlap`);
  ok(b.every((x) => x.at >= 0) && b[b.length - 1].at + b[b.length - 1].dur <= 1.1, `${k}: the whole signal is over inside 1.1 s`);
}
ok(C.beeps('rest') !== C.beeps('rest'), 'each call is a fresh list (a caller cannot corrupt the schedule)');

// ---- 8. the clock ----
console.log('clock');
{
  let t = 5000;
  const run = C.createRun(P, () => t);
  eq([run.elapsed(), run.running()], [0, false], 'a new run is at 0 and not running');
  eq(run.state().key, '0:work', 'a new run is in round 0 work');
  t += 20000;
  eq(run.elapsed(), 0, 'time passing before start does not count');
  ok(run.start() === true, 'start succeeds');
  t += 12000;
  eq(run.elapsed(), 12000, '12 s after start: 12 s');
  t += 83000; // no tick in between: the tab was frozen
  eq(run.elapsed(), 95000, 'after a silence of 83 s with no tick: exactly 95 s, no drift');
  eq(run.state(), { phase: 'work', round: 2, view: 2, remainingMs: 15000, phaseStartMs: 80000, key: '2:work' }, 'and that is 15 s into the last round');
  run.pause();
  eq([run.elapsed(), run.running()], [95000, false], 'pause banks 95 s');
  t += 600000;
  eq(run.elapsed(), 95000, 'ten minutes paused moves nothing');
  run.start();
  t += 5000;
  eq(run.elapsed(), 100000, 'resume continues from 95 s');
  run.start();
  t += 1000;
  eq(run.elapsed(), 101000, 'a second start does not restart the count');
  run.pause(); run.pause();
  eq(run.elapsed(), 101000, 'pause twice is the same as once');
  run.reset();
  eq([run.elapsed(), run.running()], [0, false], 'reset: 0 and stopped');
  run.start();
  t += 1000;
  run.reset();
  t += 5000;
  eq(run.elapsed(), 0, 'reset while running stops it too');
}
{
  let t = 0;
  const run = C.createRun(P, () => t);
  run.start(); t = 10000;
  run.skip();
  eq([run.elapsed(), run.running()], [30000, true], 'skip while running: to the start of the rest, still running');
  t += 4000;
  eq(run.elapsed(), 34000, 'and it runs on from there');
  run.pause();
  run.skip();
  eq([run.elapsed(), run.running()], [40000, false], 'skip while paused: moves and stays paused');
  run.skip(); run.skip(); run.skip();
  eq(run.elapsed(), 110000, 'skip to the end');
  eq(run.running(), false, 'the run stopped at the end');
  eq(run.start(), false, 'start after the end does nothing');
  run.reset();
  eq(run.start(), true, 'reset then start works again');
}
{
  let t = 0;
  const run = C.createRun(P, () => t);
  run.start(); t = 109000;
  eq(run.running(), true, '1 s before the end it is still running');
  t = 110001;
  eq([run.running(), run.elapsed(), run.state().phase], [false, 110000, 'done'], 'past the end it has stopped itself at the total, done');
  t = 900000;
  eq(run.elapsed(), 110000, 'and stays there');
}
{
  let t = 0;
  const run = C.createRun(P, () => t);
  run.start(); t = 110000;
  eq([run.running(), run.state().phase], [false, 'done'], 'a run read at exactly its total is already stopped');
}
{
  let t = 0;
  const run = C.createRun(P, () => t);
  run.start(); t = 130000;
  eq(run.overrunMs(), 20000, 'overrun: asked first, before any other read, it still knows');
}
{
  let t = 0;
  const run = C.createRun(P, () => t);
  eq(run.overrunMs(), 0, 'overrun: 0 before anything');
  run.start(); t = 150000;
  eq([run.elapsed(), run.overrunMs()], [110000, 40000], 'overrun: a run found 40 s past its end says so');
  t = 999999;
  eq(run.overrunMs(), 40000, 'overrun: and keeps the figure of the read that noticed');
  run.reset();
  eq(run.overrunMs(), 0, 'overrun: reset clears it');
  run.start(); t += 1;
  run.skip(); run.skip(); run.skip(); run.skip(); run.skip();
  eq([run.running(), run.overrunMs()], [false, 0], 'overrun: a skip to the end is not an overrun');
}
{
  let t = 1000;
  const run = C.createRun(P, () => t);
  run.start(); t = 500;
  ok(run.elapsed() >= 0, 'a clock that steps backward never gives a negative position');
}
{
  // drift: a run read on a ragged, throttled schedule agrees with the clock every time
  let t = 0, seed = 12345, worst = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const run = C.createRun(P, () => t);
  run.start();
  for (let i = 0; i < 3000 && run.running(); i++) {
    t += Math.floor(rnd() * 3000);
    worst = Math.max(worst, Math.abs(run.elapsed() - Math.min(t, P.totalMs)));
  }
  eq(worst, 0, '3,000 reads at random gaps up to 3 s: the position is the clock every time');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
