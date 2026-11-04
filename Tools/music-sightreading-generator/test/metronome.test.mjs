// metronome.test.mjs — 067's click track scheduler (msrg-audio.js, AI-47), pure Node, no port.
//
//   node Tools/music-sightreading-generator/test/metronome.test.mjs   (npm run test:music-metronome)
//
// Nobody has listened to this: it ships unheard and wants a person's ears. What this holds
// instead is the arithmetic of the sound. A fake AudioContext records every oscillator the
// scheduler makes (its start time, its pitch, its gain envelope), the audio clock is moved
// by hand, and the timer is turned by hand, so the suite can say exactly when each click is
// due and check it: the click times are start + k * 60/bpm with no drift over a long run and
// no dependence on how late the timer wakes, beat 1 of each measure is the accented click,
// a count-in is one measure that is marked as such, the beat indicator is told about a beat
// only once its audio time has come, the tempo text parses and clamps, and stop() stops the
// timer, schedules nothing more and silences the clicks already handed to the graph. Then
// each MUTANT re-runs the source with one deliberate defect and the suite must notice.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'msrg-audio.js'), 'utf8');

function load(src) {
  const sandbox = { setInterval() { throw new Error('the test passes its own timer'); }, clearInterval() {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'msrg-audio.js' });
  return sandbox.MsrgAudio;
}

/** A fake AudioContext: records what is built, and a clock the test moves. */
function fakeContext() {
  const made = [];
  const param = (log) => ({
    value: 0,
    setValueAtTime(v, t) { log.push(['set', v, t]); },
    exponentialRampToValueAtTime(v, t) { log.push(['ramp', v, t]); },
    linearRampToValueAtTime(v, t) { log.push(['lin', v, t]); }
  });
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: { name: 'destination' },
    made,
    createOscillator() {
      const o = { kind: 'osc', type: null, freqLog: [], startAt: null, stopAt: [], connected: [], disconnected: 0 };
      o.frequency = param(o.freqLog);
      o.connect = (n) => { o.connected.push(n); };
      o.disconnect = () => { o.disconnected++; };
      o.start = (t) => { o.startAt = t; };
      o.stop = (t) => { o.stopAt.push(t); };
      made.push(o);
      return o;
    },
    createGain() {
      const g = { kind: 'gain', gainLog: [], connected: [], disconnected: 0 };
      g.gain = param(g.gainLog);
      g.connect = (n) => { g.connected.push(n); };
      g.disconnect = () => { g.disconnected++; };
      made.push(g);
      return g;
    }
  };
  return ctx;
}

/** A timer the test turns by hand. */
function fakeTimer() {
  const t = { fn: null, ms: null, cleared: 0, set: 0 };
  t.setTimer = (fn, ms) => { t.fn = fn; t.ms = ms; t.set++; return 7; };
  t.clearTimer = (id) => { if (id === 7) { t.cleared++; t.fn = null; } };
  return t;
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function suite(A) {
  const bad = [];
  const ok = (c, label) => { if (!c) bad.push(label); };

  // ---- tempo text ----
  const p = (s) => A.parseTempo(s);
  ok(p('♪ = 92') && p('♪ = 92').bpm === 92 && !p('♪ = 92').clamped, 'the shipped default "♪ = 92" reads as 92');
  ok(p('Quarter note = 92').bpm === 92, '"Quarter note = 92" reads as 92');
  ok(p('92 bpm').bpm === 92, '"92 bpm" reads as 92');
  ok(p('2 beats, ♩ = 104').bpm === 104, 'the number after "=" wins over an earlier one');
  ok(p('108 =').bpm === 108, 'a number before an empty "=" is still read');
  ok(p('♩ = 72.5').bpm === 72.5, 'a decimal tempo is read');
  ok(p('') === null && p('Allegro') === null && p(null) === null && p('♩ =') === null, 'no number reads as null (nothing plays)');
  const hi = p('♩ = 300');
  ok(hi.bpm === 240 && hi.asked === 300 && hi.clamped, 'above 240 clamps to 240 and says so');
  const lo = p('♩ = 12');
  ok(lo.bpm === 30 && lo.asked === 12 && lo.clamped, 'below 30 clamps to 30 and says so');
  ok(p('♩ = 240').bpm === 240 && !p('♩ = 240').clamped && p('30').bpm === 30 && !p('30').clamped, 'the ends 30 and 240 are allowed as typed');
  ok(A.BPM_MIN === 30 && A.BPM_MAX === 240, 'the range is 30-240');

  // ---- beat positions ----
  const b = A.beatInfo;
  ok(b(0, 4, false).accent && !b(1, 4, false).accent && b(4, 4, false).accent && b(4, 4, false).measure === 1, '4/4: beats 0 and 4 are accented and 4 starts measure 2');
  ok(b(3, 3, false).accent && b(3, 3, false).measure === 1 && b(5, 3, false).beat === 2, '3/4 counts in threes');
  ok(b(2, 2, false).accent && b(3, 2, false).beat === 1, '2/4 counts in twos');
  ok(b(0, 4, true).countIn && b(3, 4, true).countIn && b(3, 4, true).measure === -1, 'count-in: the first measure is marked as the count-in');
  ok(!b(4, 4, true).countIn && b(4, 4, true).measure === 0 && b(4, 4, true).accent, 'count-in: beat 4 is measure 1, beat 1, accented');
  ok(b(0, 4, true).accent && !b(1, 4, true).accent, 'the count-in accents its own beat 1');

  // ---- the scheduler, 4/4 at 120 ----
  function run(opts) {
    const ctx = fakeContext();
    const tm = fakeTimer();
    const beats = [];
    let stopped = 0;
    const m = A.createMetronome(Object.assign({
      ctx, bpm: 120, beatsPerMeasure: 4, countIn: false,
      onBeat: (i) => beats.push(i), onStop: () => { stopped++; },
      lookahead: 0.1, interval: 25, startDelay: 0.05,
      setTimer: tm.setTimer, clearTimer: tm.clearTimer
    }, opts || {}));
    const advance = (to, step) => { while (ctx.currentTime < to - 1e-12) { ctx.currentTime = Math.min(to, ctx.currentTime + step); if (tm.fn) tm.fn(); } };
    return { ctx, tm, beats, m, advance, stopped: () => stopped };
  }
  const oscs = (ctx) => ctx.made.filter((n) => n.kind === 'osc');

  {
    const r = run();
    ok(r.ctx.made.length === 0, 'creating a metronome makes no sound');
    r.ctx.currentTime = 1.0;
    r.m.start();
    ok(r.tm.set === 1 && r.tm.ms === 25, 'start() sets one timer at the 25 ms interval');
    ok(r.m.running(), 'running() is true after start()');
    ok(oscs(r.ctx).length === 1 && near(oscs(r.ctx)[0].startAt, 1.05), 'the first click is scheduled at once, startDelay after start');
    ok(r.beats.length === 0, 'the indicator is not told before the first beat sounds');
    r.advance(5.0, 0.025);
    const starts = oscs(r.ctx).map((o) => o.startAt);
    ok(starts.every((t, i) => near(t, 1.05 + i * 0.5)), 'every click is at start + k * 0.5 s (120 bpm)');
    ok(starts.length >= 8 && starts.every((t) => t < 5.0 + 0.1 + 1e-9), 'clicks are scheduled no further ahead than the look-ahead');
    ok(starts[starts.length - 1] > 5.0 - 1e-9, 'the look-ahead reaches past the present (no gap at the next beat)');
    const accents = oscs(r.ctx).map((o) => o.freqLog[0][1]);
    ok(accents.every((f, i) => f === (i % 4 === 0 ? A.CLICK.accent.freq : A.CLICK.plain.freq)), 'beat 1 of each 4/4 measure has the higher click and no other beat does');
    const gains = r.ctx.made.filter((n) => n.kind === 'gain').map((g) => Math.max(...g.gainLog.map((e) => e[1])));
    ok(gains.every((gv, i) => gv === (i % 4 === 0 ? A.CLICK.accent.gain : A.CLICK.plain.gain)) && A.CLICK.accent.gain > A.CLICK.plain.gain, 'the accented click is louder too');
    ok(oscs(r.ctx).every((o) => o.stopAt.length === 1 && o.stopAt[0] > o.startAt && o.stopAt[0] - o.startAt < 0.1), 'each click stops itself within 0.1 s');
    ok(r.ctx.made.filter((n) => n.kind === 'gain').every((g) => g.connected[0] === r.ctx.destination), 'every click reaches the destination');
    ok(r.beats.length > 0 && r.beats.every((info, i) => info.index === i && info.time <= 5.0 + 1e-9), 'the indicator is told of each beat in order, only once its time has come');
    ok(r.beats.length === starts.filter((t) => t <= 5.0 + 1e-9).length, 'every beat that has sounded has been shown');
    ok(r.beats.filter((i) => i.accent).every((i) => i.beat === 0), 'the beats shown as accented are beat 1');

    // stop
    const before = oscs(r.ctx).length;
    const pendingNow = r.m.scheduled();
    r.m.stop('test');
    ok(!r.m.running() && r.tm.cleared === 1, 'stop() clears the timer');
    ok(r.stopped() === 1, 'stop() reports once');
    ok(pendingNow.length > 0 && pendingNow.every((c) => c.gain.disconnected > 0 && c.osc.stopAt.includes(0)), 'stop() silences the clicks already scheduled but not over');
    r.advance(8.0, 0.025);
    ok(oscs(r.ctx).length === before, 'nothing is scheduled after stop()');
    const shown = r.beats.length;
    r.m.tick();
    ok(r.beats.length === shown && oscs(r.ctx).length === before, 'a stray timer wake after stop() does nothing');
    r.m.stop('again');
    ok(r.stopped() === 1 && r.tm.cleared === 1, 'a second stop() is a no-op');
  }

  // ---- a late, irregular timer does not move the beat ----
  {
    const r = run({ bpm: 92 });
    r.m.start();
    const wakes = [0.07, 0.13, 0.31, 0.32, 0.6, 0.61, 0.95, 1.4, 1.41, 2.0, 2.05, 2.7, 3.3];
    for (const t of wakes) { r.ctx.currentTime = t; r.tm.fn(); }
    const starts = oscs(r.ctx).map((o) => o.startAt);
    const spb = 60 / 92;
    ok(starts.length > 4 && starts.every((t, i) => near(t, 0.05 + i * spb)), 'click times do not depend on when the timer wakes');
    ok(starts.every((t, i) => i === 0 || t > starts[i - 1]), 'no click is scheduled twice');
  }

  // ---- no drift over a long run ----
  {
    const r = run({ bpm: 137, lookahead: 0.12 });
    r.m.start();
    r.advance(600, 0.025);
    const starts = oscs(r.ctx).map((o) => o.startAt);
    const last = starts.length - 1;
    ok(last > 1300 && near(starts[last], 0.05 + last * 60 / 137, 1e-6), 'after ten minutes the click is still on start + k * 60/bpm');
    ok(r.m.scheduled().length <= 3, 'finished clicks are let go (the live list stays small)');
  }

  // ---- count-in, 3/4 ----
  {
    const r = run({ bpm: 60, beatsPerMeasure: 3, countIn: true });
    r.m.start();
    r.advance(7.2, 0.025);
    const info = r.beats;
    ok(info.length >= 7, 'the 3/4 count-in run shows its beats');
    ok(info.slice(0, 3).every((i) => i.countIn && i.measure === -1), 'the first three beats are the count-in');
    ok(info.slice(3).every((i) => !i.countIn) && info[3].measure === 0 && info[3].beat === 0 && info[6].measure === 1, 'then measure 1 begins, and measure 2 three beats later');
    const f = oscs(r.ctx).map((o) => o.freqLog[0][1]);
    ok(f[0] === A.CLICK.accent.freq && f[3] === A.CLICK.accent.freq && f[6] === A.CLICK.accent.freq && f[1] === A.CLICK.plain.freq && f[4] === A.CLICK.plain.freq, 'accents fall on beat 1 of the count-in and of each measure after it');
    ok(near(oscs(r.ctx)[3].startAt, 0.05 + 3), 'measure 1 starts exactly one measure after the count-in begins');
  }

  // ---- start twice ----
  {
    const r = run();
    r.m.start(); r.m.start();
    ok(r.tm.set === 1 && oscs(r.ctx).length === 1, 'a second start() while running does nothing');
  }

  // ---- the shared context is made on demand only ----
  {
    let made = 0, resumed = 0;
    const win = { AudioContext: function () { made++; this.state = 'suspended'; this.resume = () => { resumed++; return Promise.resolve(); }; } };
    ok(made === 0, 'loading the file makes no AudioContext');
    const c1 = A.audioContext(win);
    const c2 = A.audioContext(win);
    ok(made === 1 && c1 === c2, 'audioContext() makes one context and hands back the same one');
    ok(resumed >= 1, 'a suspended context is resumed');
    const A2 = load(SRC);
    ok(A2.audioContext({}) === null, 'no Web Audio: audioContext() is null, not a throw');
  }

  return bad;
}

const MUTANTS = [
  ['the clamp is off', 'var bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, asked));', 'var bpm = asked;'],
  ['the top of the range is wrong', 'var BPM_MAX = 240;', 'var BPM_MAX = 250;'],
  ['the "=" is ignored', "var m = (eq !== -1 ? s.slice(eq + 1) : s).match(/\\d+(?:\\.\\d+)?/);", 'var m = s.match(/\\d+(?:\\.\\d+)?/);'],
  ['decimals are dropped', "var m = (eq !== -1 ? s.slice(eq + 1) : s).match(/\\d+(?:\\.\\d+)?/);", "var m = (eq !== -1 ? s.slice(eq + 1) : s).match(/\\d+/);"],
  ['no accent', 'accent: beat === 0 };', 'accent: false };'],
  ['the count-in is not skipped', 'var lead = countIn ? beatsPerMeasure : 0;', 'var lead = 0;'],
  ['the accent and plain clicks are the same pitch', 'var spec = accent ? CLICK.accent : CLICK.plain;', 'var spec = CLICK.plain;'],
  ['a late beat is moved to the timer (drift)', 'var t = startTime + nextIndex * secondsPerBeat;', 'var t = Math.max(now, startTime + nextIndex * secondsPerBeat);'],
  ['the beat length is rounded (drift)', 'var secondsPerBeat = 60 / bpm;', 'var secondsPerBeat = Math.round(60 / bpm * 1000) / 1000;'],
  ['no look-ahead', 'while (t < now + lookahead) {', 'while (t < now) {'],
  ['the indicator runs ahead of the sound', 'while (pending.length && pending[0].time <= now) onBeat(pending.shift());', 'while (pending.length) onBeat(pending.shift());'],
  ['stop leaves the timer running', 'if (timer !== null) clearTimer(timer);', ';'],
  ['stop leaves scheduled clicks in the graph', 'try { c.gain.disconnect(); } catch (e) { /* already gone */ }', ';'],
  ['a stray wake after stop still schedules', 'if (!running) return;\n      var now', 'var now'],
  ['start twice doubles the clicks', 'if (running) return;\n      running = true;', 'running = true;'],
  ['finished clicks are kept forever', 'live = live.filter(function (c) { return c.time + CLICK.dur + 0.01 > now; });', ';'],
  ['a new context per call', 'if (!shared) {', 'if (true) {'],
  ['the click never stops itself', 'osc.stop(time + CLICK.dur + 0.01);', ';'],
];

let failed = 0;
const realBad = suite(load(SRC));
failed += realBad.length;
realBad.forEach((m) => console.error('FAIL  ' + m));

for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { failed++; console.error(`FAIL  mutant "${name}": the text it changes is not in msrg-audio.js any more`); continue; }
  let caught;
  try { caught = suite(load(SRC.replace(from, to))); } catch (e) { caught = ['threw: ' + e.message]; }
  if (!caught.length) { failed++; console.error(`FAIL  mutant "${name}" was NOT caught`); }
}

console.log(failed ? `music-metronome: ${failed} FAILED` : `music-metronome: OK — every case passes, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
