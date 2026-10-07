// smoke-board-core.mjs — the Classroom Timer board's logic, in plain Node.
//
//   node Tools/classroom-timer/test/smoke-board-core.mjs
//
// ct-board-core.js is the board with no DOM and no clock of its own: saved
// shape, the state of each timer, start/pause/reset, and what a tick says
// finished. ct-store.js is checked here too, because the board rides in the
// same ct_prefs key and a save from before it must come back with no board.
// Exits 1 on any failure.

import '../../../_shared/countdown.js';
globalThis.window = globalThis;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const Core = await import('../ct-board-core.js');
const Store = await import('../ct-store.js');

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const T = 1_800_000_000_000;
const mk = (min, sec = 0, label = '') => Core.fromSaved({ label, minutes: min, seconds: sec, endAt: 0, leftMs: (min * 60 + sec) * 1000 }, T).entry;

console.log('Classroom Timer — board core');

/* ── 1. what is saved ──────────────────────────────────────────────────── */
eq(Core.sanitizeBoard(undefined), null, 'no board in a save: none is invented');
eq(Core.sanitizeBoard('x'), null, 'a string is not a board');
eq(Core.sanitizeBoard({ open: true, count: 3 }), null, 'a board with no timers list is not a board');
eq(Core.sanitizeBoard({ timers: 'abc' }), null, 'timers that are not a list: none');
{
  const b = Core.sanitizeBoard({ open: 1, count: 3, timers: [{ label: 'Group A', minutes: 7, seconds: 30 }] });
  eq(b.count, 3, 'the count is kept');
  eq(b.open, true, 'open is a boolean');
  eq(b.timers.length, 4, 'there are always four timer slots');
  eq(b.timers[0].label, 'Group A', 'a label is kept');
  eq([b.timers[0].minutes, b.timers[0].seconds], [7, 30], 'a length is kept');
  eq([b.timers[1].minutes, b.timers[1].seconds, b.timers[1].label], [5, 0, ''], 'a missing timer is five minutes with no label');
}
eq(Core.sanitizeBoard({ count: 9, timers: [] }).count, 4, 'a count above four is four');
eq(Core.sanitizeBoard({ count: 1, timers: [] }).count, 2, 'a count below two is two');
eq(Core.sanitizeBoard({ count: 'x', timers: [] }).count, 2, 'a junk count is two');
{
  const t = Core.sanitizeBoard({ timers: [{ label: '  ' + 'x'.repeat(80) + '  ', minutes: 999, seconds: 99 }] }).timers[0];
  eq(t.label.length, 40, 'a label is cut at 40 characters');
  eq([t.minutes, t.seconds], [180, 59], 'a length is clamped to 180:59');
  const n = Core.sanitizeBoard({ timers: [{ minutes: -4, seconds: -1 }] }).timers[0];
  eq([n.minutes, n.seconds], [0, 0], 'a negative length is zero');
  const f = Core.sanitizeBoard({ timers: [{ minutes: 2.9, seconds: 3.9 }] }).timers[0];
  eq([f.minutes, f.seconds], [2, 3], 'a fractional length is floored');
  const e = Core.sanitizeBoard({ timers: [{ minutes: 1, endAt: 'soon', leftMs: 'x' }] }).timers[0];
  eq([e.endAt, e.leftMs], [0, 60000], 'a junk end time is none and a junk remainder is the full length');
  const l = Core.sanitizeBoard({ timers: [{ minutes: 1, leftMs: 9e9 }] }).timers[0];
  eq(l.leftMs, 60000, 'time left cannot exceed the length');
  const neg = Core.sanitizeBoard({ timers: [{ minutes: 1, endAt: -5, leftMs: -5 }] }).timers[0];
  eq([neg.endAt, neg.leftMs], [0, 0], 'a negative end time is none and a negative remainder is zero');
}
ok(Core.sanitizeBoard({ timers: [null, 7, 'x'] }).timers.every((t) => t.minutes === 5), 'junk timer entries become defaults');
eq(Core.defaultTimers().length, 4, 'four default timers');
eq(Core.MIN_TIMERS + ',' + Core.MAX_TIMERS, '2,4', 'two to four timers');

/* ── 2. state, start, pause, reset ─────────────────────────────────────── */
{
  const e = mk(1);
  eq(Core.stateOf(e), 'idle', 'a new timer is idle');
  ok(Core.toggle(e, T), 'start works');
  eq(Core.stateOf(e), 'running', 'then it runs');
  eq(window.Countdown.left(e.c, T + 10_000), 50_000, 'ten seconds later 50 s are left');
  Core.toggle(e, T + 10_000);
  eq(Core.stateOf(e), 'paused', 'pause');
  eq(window.Countdown.left(e.c, T + 99_000), 50_000, 'a paused timer does not move');
  Core.toggle(e, T + 99_000);
  eq(window.Countdown.left(e.c, T + 109_000), 40_000, 'resume carries on from what was left');
  Core.reset(e);
  eq(Core.stateOf(e), 'idle', 'reset is idle');
  eq(e.c.leftMs, 60_000, 'and back to the full length');
}
{
  // paused in the very millisecond it started: nothing has been used, but it is paused
  const e = mk(1);
  Core.toggle(e, T); Core.toggle(e, T);
  eq(Core.stateOf(e), 'paused', 'a timer paused with nothing used is paused, not Ready');
  eq(Core.toSaved(e).paused, true, 'and says so when saved');
  eq(Core.stateOf(Core.fromSaved(Core.toSaved(e), T + 5000).entry), 'paused', 'and comes back paused');
  eq(window.Countdown.left(Core.fromSaved(Core.toSaved(e), T + 5000).entry.c, T + 99_000), 60_000, 'with its whole length left');
  Core.toggle(e, T + 10);
  eq(Core.stateOf(e), 'running', 'resume runs it');
  eq(Core.toSaved(e).paused, false, 'and a running timer is not saved as paused');
  Core.toggle(e, T + 20); Core.reset(e);
  eq(Core.stateOf(e), 'idle', 'reset clears a pause');
  eq(Core.toSaved(e).paused, false, 'in the save too');
  eq(Core.sanitizeBoard({ timers: [{ minutes: 1, leftMs: 60000, paused: true }] }).timers[0].paused, true, 'a saved pause is read back');
  eq(Core.sanitizeBoard({ timers: [{ minutes: 1, leftMs: 0, paused: true }] }).timers[0].paused, false, 'a finished timer is not paused');
  eq(Core.sanitizeBoard({ timers: [{ minutes: 1, endAt: T, leftMs: 60000, paused: true }] }).timers[0].paused, false, 'nor a running one');
  eq(Core.sanitizeBoard({ timers: [{ minutes: 1 }] }).timers[0].paused, false, 'a save with no pause field is not paused');
}
{
  const e = mk(0, 0);
  eq(Core.toggle(e, T), false, 'a zero-length timer does not start');
  eq(Core.stateOf(e), 'idle', 'and stays idle');
}

/* ── 3. the clock: wall-clock end times, not counted ticks ─────────────── */
{
  const e = mk(10);
  Core.toggle(e, T);
  // the laptop sleeps for 7 minutes: not one tick runs, then one does
  eq(Core.tick([e], 1, T + 7 * 60_000), [], 'after a long gap nothing has finished early');
  eq(window.Countdown.left(e.c, T + 7 * 60_000), 3 * 60_000, 'and the time left is exact');
  eq(Core.tick([e], 1, T + 10 * 60_000 + 1), [0], 'the first tick after the end time reports it');
  eq(Core.tick([e], 1, T + 10 * 60_000 + 2), [], 'and only once');
  eq(Core.stateOf(e), 'done', 'it is done');
  eq(window.Countdown.left(e.c, T + 11 * 60_000), 0, 'with nothing left');
}
{
  const e = mk(1);
  Core.toggle(e, T);
  eq(Core.tick([e], 1, T + 60_000), [0], 'exactly at the end time it finishes');
  Core.toggle(e, T + 61_000);
  eq(Core.stateOf(e), 'running', 'a finished timer starts again');
  eq(window.Countdown.left(e.c, T + 61_000), 60_000, 'from its full length');
}

/* ── 4. several timers: independent, each reported once ────────────────── */
{
  const a = mk(1), b = mk(2), c = mk(1), d = mk(1);
  Core.toggle(a, T); Core.toggle(b, T); Core.toggle(d, T);
  const all = [a, b, c, d];
  eq(Core.tick(all, 4, T + 30_000), [], 'none finished at 30 s');
  eq(Core.tick(all, 4, T + 60_000), [0, 3], 'a and d finish together at 60 s, c never started');
  eq(Core.tick(all, 4, T + 61_000), [], 'and are not reported again');
  eq([Core.stateOf(a), Core.stateOf(b), Core.stateOf(c), Core.stateOf(d)], ['done', 'running', 'idle', 'done'], 'each has its own state');
  eq(window.Countdown.left(b.c, T + 61_000), 59_000, 'b is untouched by the others');
  eq(Core.anyRunning(all, 4), true, 'one is still running');
  eq(Core.anyRunning(all, 1), false, 'but not among the first one');
  Core.toggle(c, T + 62_000);
  eq(Core.tick(all, 2, T + 200_000), [1], 'a tick over the first two ignores hidden timers');
  eq(Core.stateOf(c), 'running', 'c, hidden from that tick, was not touched');
}

/* ── 5. changing a length ──────────────────────────────────────────────── */
{
  const e = mk(5);
  ok(Core.setDuration(e, 2, 30), 'a length can be changed when idle');
  eq([e.minutes, e.seconds, e.c.totalMs, e.c.leftMs], [2, 30, 150_000, 150_000], 'the timer is stopped at the new length');
  Core.toggle(e, T);
  eq(Core.setDuration(e, 9, 0), false, 'not while running');
  eq(e.c.totalMs, 150_000, 'and nothing changed');
  Core.toggle(e, T + 1000);
  eq(Core.setDuration(e, 9, 0), false, 'not while paused');
  Core.reset(e);
  ok(Core.setDuration(e, 999, 99), 'after reset it can');
  eq([e.minutes, e.seconds], [180, 59], 'and is clamped');
}

/* ── 6. save and restore ───────────────────────────────────────────────── */
{
  const e = mk(10, 0, 'Lab');
  Core.toggle(e, T);
  const s = Core.toSaved(e);
  eq([s.label, s.minutes, s.seconds, s.endAt, s.leftMs], ['Lab', 10, 0, T + 600_000, 0], 'a running timer saves its end time');
  const r = Core.fromSaved(s, T + 120_000);
  eq(Core.stateOf(r.entry), 'running', 'it comes back running');
  eq(window.Countdown.left(r.entry.c, T + 120_000), 480_000, 'with the time left read off the wall clock');
  eq(r.expired, false, 'not expired');
  Core.toggle(e, T + 200_000);
  const p = Core.toSaved(e);
  eq([p.endAt, p.leftMs], [0, 400_000], 'a paused timer saves what is left');
  const rp = Core.fromSaved(p, T + 9_000_000);
  eq(Core.stateOf(rp.entry), 'paused', 'it comes back paused');
  eq(window.Countdown.left(rp.entry.c, T + 9_000_000), 400_000, 'however long the page was closed');
  const ex = Core.fromSaved(s, T + 700_000);
  eq(ex.expired, true, 'one that ran out while closed says so');
  eq(Core.stateOf(ex.entry), 'done', 'and is finished');
  eq(Core.tick([ex.entry], 1, T + 700_001), [], 'and nothing rings for it');
  const idle = Core.toSaved(mk(3));
  eq([idle.endAt, idle.leftMs], [0, 180_000], 'an idle timer saves its full length');
  eq(Core.stateOf(Core.fromSaved(idle, T).entry), 'idle', 'and comes back idle');
  const done = Core.toSaved(ex.entry);
  eq([done.endAt, done.leftMs], [0, 0], 'a finished timer saves as finished');
  eq(Core.stateOf(Core.fromSaved(done, T).entry), 'done', 'and comes back finished');
}

/* ── 7. which counts are allowed ───────────────────────────────────────── */
{
  const es = [mk(1), mk(1), mk(1), mk(1)];
  eq(Core.minCountFor(es), 2, 'nothing running: any count');
  Core.toggle(es[2], T);
  eq(Core.minCountFor(es), 3, 'the third timer running: at least three');
  Core.toggle(es[2], T + 1);
  eq(Core.minCountFor(es), 3, 'paused counts too');
  Core.reset(es[2]);
  Core.toggle(es[3], T);
  eq(Core.minCountFor(es), 4, 'the fourth running: four');
}

/* ── 8. colour thresholds, and the words that go with them ─────────────── */
eq(Core.urgencyOf(1, 25, 10), 'good', 'full is good');
eq(Core.urgencyOf(0.25, 25, 10), 'warn', 'at the amber line is amber');
eq(Core.urgencyOf(0.26, 25, 10), 'good', 'just above is good');
eq(Core.urgencyOf(0.1, 25, 10), 'critical', 'at the red line is red');
eq(Core.urgencyOf(0.05, 5, 20), 'critical', 'amber is never below red');
eq(Core.finishedMessage([]), '', 'nothing finished: nothing said');
eq(Core.finishedMessage(['Group A']), "Group A: time's up", 'one finished');
eq(Core.finishedMessage(['A', 'B']), "A and B: time's up", 'two finished');
eq(Core.finishedMessage(['A', 'B', 'C']), "A, B and C: time's up", 'three finished');

/* ── 9. the store: the board rides in ct_prefs, and only when it was saved ─ */
{
  store.clear();
  const old = JSON.stringify({ v: 1, activeTab: 'transition', transition: { minutes: 3, seconds: 15 }, sound: { choice: 'bell', volume: 0.4, muted: true, flashEnabled: true } });
  store.set('ct_prefs', old);
  const loaded = Store.load();
  eq('board' in loaded, false, 'a save from before the board loads with no board key');
  Store.save({ activeTab: 'countdown' });
  eq('board' in JSON.parse(store.get('ct_prefs')), false, 'and a save of something else does not add one');
  eq(Store.load().activeTab, 'countdown', 'the save itself works');
  Store.save({ board: { open: true, count: 3, timers: [{ label: 'A', minutes: 4, seconds: 0 }] } });
  const b = Store.load().board;
  eq([b.open, b.count, b.timers[0].label, b.timers[0].minutes], [true, 3, 'A', 4], 'a board saved is a board loaded');
  Store.save({ activeTab: 'agenda' });
  eq(Store.load().board.count, 3, 'a later save of something else keeps the board');
  Store.save({ customPresets: [] });
  eq(Store.load().board.timers[0].label, 'A', 'including through a preset save');
  store.set('ct_prefs', '{"v":1,"board":{"timers":"nope"}}');
  eq('board' in Store.load(), false, 'a damaged board is dropped, not thrown');
  store.set('ct_prefs', '{not json');
  eq('board' in Store.load(), false, 'unreadable prefs load as defaults');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
