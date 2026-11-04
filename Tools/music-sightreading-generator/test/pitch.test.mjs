// pitch.test.mjs — 067's reference pitch and note play-through (msrg-audio.js, AI-48), pure Node, no port.
//
//   node Tools/music-sightreading-generator/test/pitch.test.mjs   (npm run test:music-pitch)
//
// Nobody has listened to this either: it ships unheard. What this holds is the arithmetic.
// The note-to-frequency map is equal temperament on A4 = 440 Hz, checked against known
// values in both clefs and across the page's whole range (C2-B6): every octave doubles,
// every step up the staff is a higher pitch, and the staff-position formula the drawing
// uses (notePosition) and its inverse (positionNote) agree on every note. The reference
// pitch is the lowest C in the range, or the first note when there is none. Then a fake
// AudioContext and a hand-turned timer drive createNotePlayer: note k at start + k*60/bpm
// on the audio clock with no drift, a triangle tone with an envelope that ends in silence,
// the indicator told about a note only once it sounds, the end reported once, after the
// last note is over, and stop() silencing what was already handed to the graph. Each
// MUTANT re-runs the source with one deliberate defect and the suite must notice.

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

function fakeContext() {
  const made = [];
  const param = (log) => ({
    setValueAtTime(v, t) { log.push(['set', v, t]); },
    exponentialRampToValueAtTime(v, t) { log.push(['ramp', v, t]); },
    linearRampToValueAtTime(v, t) { log.push(['lin', v, t]); }
  });
  return {
    currentTime: 0,
    destination: { name: 'destination' },
    made,
    oscs() { return made.filter((n) => n.kind === 'osc'); },
    createOscillator() {
      const o = { kind: 'osc', type: null, freqLog: [], startAt: null, stopAt: [], connected: [] };
      o.frequency = param(o.freqLog);
      o.connect = (n) => { o.connected.push(n); };
      o.disconnect = () => {};
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
}

function fakeTimer() {
  const t = { fn: null, cleared: 0, set: 0 };
  t.setTimer = (fn) => { t.fn = fn; t.set++; return 9; };
  t.clearTimer = (id) => { if (id === 9) { t.cleared++; t.fn = null; } };
  return t;
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const N = (label) => ({ letter: label[0], octave: Number(label.slice(1)) });

function suite(A) {
  const bad = [];
  const ok = (c, label) => { if (!c) bad.push(label); };
  const f = (label) => A.noteFrequency(N(label));

  // ---- note to frequency, A4 = 440 ----
  ok(near(f('A4'), 440), 'A4 is 440 Hz');
  ok(near(f('A3'), 220) && near(f('A5'), 880) && near(f('A2'), 110), 'A2, A3, A5 are 110, 220, 880');
  ok(near(f('C4'), 261.625565, 1e-5), 'middle C is 261.626 Hz');
  ok(near(f('E4'), 329.627557, 1e-5), 'E4 (treble bottom line) is 329.628 Hz');
  ok(near(f('F5'), 698.456463, 1e-5), 'F5 (treble top line) is 698.456 Hz');
  ok(near(f('G2'), 97.998859, 1e-5), 'G2 (bass bottom line) is 97.999 Hz');
  ok(near(f('B3'), 246.941651, 1e-5), 'B3 is 246.942 Hz');
  ok(near(f('F4') / f('E4'), Math.pow(2, 1 / 12)) && near(f('C5') / f('B4'), Math.pow(2, 1 / 12)), 'E-F and B-C are half steps');
  ok(near(f('D4') / f('C4'), Math.pow(2, 2 / 12)) && near(f('G4') / f('F4'), Math.pow(2, 2 / 12)), 'C-D and F-G are whole steps');
  ok(near(f('C2'), 65.406391, 1e-5) && near(f('B6'), 1975.533205, 1e-4), 'the ends of the range, C2 and B6');

  // ---- the whole range: octaves double, every step is higher ----
  const all = [];
  for (let oct = 2; oct <= 6; oct++) A.LETTERS.forEach((l) => all.push({ letter: l, octave: oct }));
  ok(all.length === 35, 'C2-B6 is 35 natural notes');
  ok(all.every((n, i) => i === 0 || A.noteFrequency(n) > A.noteFrequency(all[i - 1])), 'every natural from C2 to B6 is higher than the one before');
  ok(all.slice(0, 28).every((n, i) => near(A.noteFrequency(all[i + 7]) / A.noteFrequency(n), 2, 1e-9)), 'every note an octave up is exactly twice the frequency');

  // ---- staff positions: the drawing's formula ----
  const tp = (l) => A.notePosition(N(l), 'treble');
  const bp = (l) => A.notePosition(N(l), 'bass');
  ok(tp('E4') === 0 && tp('F4') === 1 && tp('G4') === 2 && tp('B4') === 4 && tp('F5') === 8, 'treble: E4 bottom line (0), B4 middle line (4), F5 top line (8)');
  ok(tp('C4') === -2 && tp('A5') === 10 && tp('C6') === 12, 'treble: middle C is one ledger line below (-2), A5 one above (10)');
  ok(bp('G2') === 0 && bp('D3') === 4 && bp('A3') === 8 && bp('C4') === 10 && bp('E2') === -2, 'bass: G2 bottom line, D3 middle, A3 top, middle C one ledger above');
  ok(tp('C4') - bp('C4') === -12, 'middle C sits 12 steps lower on the treble staff than on the bass');
  let inverse = true, sounded = true;
  ['treble', 'bass'].forEach((clef) => all.forEach((n) => {
    const pos = A.notePosition(n, clef);
    const back = A.positionNote(pos, clef);
    if (back.letter !== n.letter || back.octave !== n.octave) inverse = false;
    if (!near(A.positionFrequency(pos, clef), A.noteFrequency(n), 1e-9)) sounded = false;
  }));
  ok(inverse, 'positionNote undoes notePosition for every note in both clefs');
  ok(sounded, 'the pitch sounded for a staff position is the pitch of the note drawn there, both clefs');
  ok(near(A.positionFrequency(0, 'treble'), f('E4')) && near(A.positionFrequency(8, 'bass'), 220), 'treble bottom line sounds E4; bass top line sounds A3, 220 Hz');
  ok(near(A.positionFrequency(4, 'treble') / A.positionFrequency(4, 'bass'), Math.pow(2, 21 / 12), 1e-9), 'the middle lines (B4, D3) are an octave and a major sixth (21 half steps) apart');

  // ---- reference pitch ----
  const range = (labels) => labels.split(' ').map(N);
  let r = A.referenceNote(range('C4 D4 E4 F4 G4 A4 B4 C5 D5'), range('E4 G4'));
  ok(r && r.tonic && r.note.letter === 'C' && r.note.octave === 4, 'a range with C in it: the reference is its lowest C (C4)');
  r = A.referenceNote(range('C5 B4 A4 C4 G4'), range('A4'));
  ok(r && r.tonic && r.note.octave === 4, 'the lowest C is found however the range is ordered');
  r = A.referenceNote(range('D4 E4 F4 G4'), range('G4 E4 D4'));
  ok(r && !r.tonic && r.note.letter === 'G' && r.note.octave === 4, 'a range with no C: the reference is the first note');
  ok(A.referenceNote([], []) === null, 'nothing at all: no reference');

  // ---- the player ----
  {
    const ctx = fakeContext();
    const tm = fakeTimer();
    const heard = [];
    let ended = 0, stopped = 0;
    const freqs = [261.6, 293.7, 329.6, 349.2];
    const p = A.createNotePlayer({ ctx, freqs, bpm: 120, setTimer: tm.setTimer, clearTimer: tm.clearTimer,
      onNote: (i) => heard.push(i), onEnd: () => { ended++; }, onStop: () => { stopped++; } });
    ok(ctx.made.length === 0 && !p.running(), 'nothing is made before start()');
    p.start();
    ok(p.running() && tm.set === 1, 'start() runs the timer');
    p.start();
    ok(tm.set === 1 && ctx.oscs().length === 1, 'a second start() does not double the notes');
    ok(ctx.oscs().length === 1 && near(ctx.oscs()[0].startAt, 0.06, 1e-12), 'only the first note is scheduled at once, just after start');
    ok(heard.length === 0, 'the indicator hears of no note before its time');
    ctx.currentTime = 0.07; tm.fn();
    ok(heard.length === 1 && heard[0].index === 0 && heard[0].count === 4 && near(heard[0].freq, 261.6), 'at its time, note 1 of 4 is reported with its pitch');
    ctx.currentTime = 1.3; tm.fn(); // a late, throttled wake
    const os = ctx.oscs();
    ok(os.length === 3 && [0.06, 0.56, 1.06].every((t, i) => near(os[i].startAt, t, 1e-12)), 'a late wake still puts each note at start + k*0.5 s');
    ok(os.every((o, i) => o.type === 'triangle' && near(o.freqLog[0][1], freqs[i]) && near(o.freqLog[0][2], o.startAt, 1e-12)), 'each note is a triangle tone at its own pitch, set at its own time');
    const g = ctx.made.filter((n) => n.kind === 'gain')[0];
    const dur = 0.5 * 0.85;
    ok(g.gainLog[0][1] <= 0.001 && g.gainLog[1][1] > 0.1 && g.gainLog[g.gainLog.length - 1][1] <= 0.001 &&
       near(g.gainLog[g.gainLog.length - 1][2], 0.06 + dur, 1e-12), 'the envelope rises from silence and is silent again 85% of a beat later');
    ok(near(os[0].stopAt[0], 0.06 + dur + 0.02, 1e-12), 'each oscillator stops itself just after its note');
    ok(os[0].connected[0] === g && g.connected[0] === ctx.destination, 'oscillator to gain to the speakers');
    ok(heard.length === 3 && heard[2].index === 2, 'the indicator has caught up with the three notes sounded');
    ctx.currentTime = 1.6; tm.fn();
    ok(ctx.oscs().length === 4 && near(ctx.oscs()[3].startAt, 1.56, 1e-12) && heard.length === 4, 'the fourth and last note at 1.56 s');
    ok(ended === 0 && p.running(), 'not over while the last note still sounds');
    ctx.currentTime = 1.56 + dur + 0.001; tm.fn();
    ok(ended === 1 && !p.running() && tm.cleared === 1, 'once the last note is over the player ends, once, and stops its timer');
    ok(ctx.oscs().length === 4, 'four notes, no more');
    p.stop();
    ok(stopped === 0, 'stop() after the end reports nothing');
  }
  {
    const ctx = fakeContext();
    const tm = fakeTimer();
    let stopped = 0, ended = 0;
    const p = A.createNotePlayer({ ctx, freqs: [440, 494, 523, 587, 659], bpm: 60, setTimer: tm.setTimer, clearTimer: tm.clearTimer,
      onStop: () => { stopped++; }, onEnd: () => { ended++; } });
    p.start();
    ctx.currentTime = 1.0; tm.fn();
    const before = ctx.oscs().length;
    const live = p.scheduled();
    ok(live.length >= 1, 'notes in the graph are tracked');
    const fn = tm.fn;
    p.stop('why');
    ok(stopped === 1 && !p.running() && tm.cleared === 1, 'stop() stops the timer and reports it');
    ok(live.every((n) => n.gain.disconnected >= 1 && n.osc.stopAt.includes(0)), 'stop() silences the notes already handed to the graph');
    ctx.currentTime = 9; fn();
    ok(ctx.oscs().length === before && ended === 0, 'a stray wake after stop() schedules nothing and reports no end');
  }
  {
    const ctx = fakeContext();
    const tm = fakeTimer();
    let ended = 0;
    const p = A.createNotePlayer({ ctx, freqs: [261.6], bpm: 60, noteDuration: A.TONE.refDur, setTimer: tm.setTimer, clearTimer: tm.clearTimer, onEnd: () => { ended++; } });
    p.start();
    const g = ctx.made.filter((n) => n.kind === 'gain')[0];
    ok(A.TONE.refDur >= 1 && near(g.gainLog[g.gainLog.length - 1][2], 0.06 + A.TONE.refDur, 1e-12), 'the reference pitch is one tone held for its own length');
    ctx.currentTime = 1.0; tm.fn();
    ok(ended === 0 && p.running(), 'still sounding a second in');
    ctx.currentTime = 0.06 + A.TONE.refDur + 0.001; tm.fn();
    ok(ended === 1 && !p.running(), 'and over when its time is up');
  }
  {
    const ctx = fakeContext();
    const tm = fakeTimer();
    const p = A.createNotePlayer({ ctx, freqs: [], bpm: 90, setTimer: tm.setTimer, clearTimer: tm.clearTimer });
    p.start();
    ok(!p.running() && tm.set === 0 && ctx.made.length === 0, 'no notes: nothing starts');
  }
  return bad;
}

const MUTANTS = [
  ['A4 is 442', 'var A4 = 440;', 'var A4 = 442;'],
  ['E-F is a whole step', 'var SEMITONES = [0, 2, 4, 5, 7, 9, 11];', 'var SEMITONES = [0, 2, 4, 6, 7, 9, 11];'],
  ['the MIDI octave is off by one', 'var midi = (note.octave + 1) * 12', 'var midi = note.octave * 12'],
  ['the treble anchor is C, not E', 'treble: 4 * 7 + 2,', 'treble: 4 * 7 + 0,'],
  ['the bass anchor is an octave high', 'bass: 2 * 7 + 4 }', 'bass: 3 * 7 + 4 }'],
  ['positionNote drops the anchor', 'var d = position + CLEF_ANCHOR[clef];', 'var d = position + CLEF_ANCHOR.treble;'],
  ['the reference is the first C, not the lowest', 'cs.sort(function (a, b) { return diatonicNumber(a) - diatonicNumber(b); });', ';'],
  ['the reference looks for A', "return n.letter === 'C';", "return n.letter === 'A';"],
  ['the fallback is the last note', 'return { note: notes[0], tonic: false };', 'return { note: notes[notes.length - 1], tonic: false };'],
  ['a sine, not a triangle', "type: 'triangle'", "type: 'sine'"],
  ['notes fill the whole beat', 'share: 0.85', 'share: 1'],
  ['the reference length is ignored', 'var noteDur = opts.noteDuration == null ? beat * TONE.share : opts.noteDuration;', 'var noteDur = beat * TONE.share;'],
  ['no look-ahead', 'while (next < freqs.length && t0 + next * beat < now + ahead) {', 'while (next < freqs.length && t0 + next * beat < now) {'],
  ['everything scheduled at once', 'while (next < freqs.length && t0 + next * beat < now + ahead) {', 'while (next < freqs.length) {'],
  ['a late note moves to the timer (drift)', 'var at = t0 + next * beat;', 'var at = Math.max(now, t0 + next * beat);'],
  ['the indicator runs ahead of the sound', 'while (due.length && due[0].time <= now) noteCb(due.shift());', 'while (due.length) noteCb(due.shift());'],
  ['the end is reported at the last note\'s start', 'now >= t0 + (freqs.length - 1) * beat + noteDur', 'now >= t0 + (freqs.length - 1) * beat'],
  ['the end is never reported', 'sounding = [];\n        endCb();', 'sounding = [];'],
  ['the timer is never cleared', 'if (handle !== null) clearT(handle);', ';'],
  ['stop leaves notes in the graph', 'try { n.gain.disconnect(); } catch (e) { /* already gone */ }', ';'],
  ['a stray wake after stop still schedules', 'if (!playing) return;\n      var now', 'var now'],
  ['start twice doubles the notes', 'if (playing || !freqs.length) return;', 'if (!freqs.length) return;'],
  ['an empty pattern starts a timer', 'if (playing || !freqs.length) return;', 'if (playing) return;'],
  ['a tone never stops itself', 'osc.stop(time + dur + 0.02);', ';'],
  ['the envelope never closes', 'gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);', ';'],
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

console.log(failed ? `music-pitch: ${failed} FAILED` : `music-pitch: OK — every case passes, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
