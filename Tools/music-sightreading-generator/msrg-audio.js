// msrg-audio.js — 067's sound: the click track for the rhythm tab (AI-47), and the
// sight-reading tab's reference pitch and note play-through (AI-48).
//
// A classic script; it sets globalThis.MsrgAudio. Nothing here touches the DOM or
// storage, and nothing makes a sound until the page hands it an AudioContext, which
// the page creates only inside a Play click (`audioContext()`), so nothing autoplays.
// Both tabs share that one context. The staff-position formula the page draws with
// lives here too (`notePosition`), so what is drawn and what is sounded are one sum.
//
// The scheduler is the look-ahead pattern: a timer wakes every `interval` ms and
// schedules every click that falls inside the next `lookahead` seconds of the AUDIO
// clock (`ctx.currentTime`), each at its exact time. The timer only decides when to
// look; it never decides when a click sounds, so a late or throttled timer does not
// drift the beat. The beat indicator is told about a beat (`onBeat`) on the first
// wake at or after that beat's audio time, so it follows the sound, not the timer.
//
// Tests: Tools/music-sightreading-generator/test/metronome.test.mjs drives it with a
// fake AudioContext and a hand-turned timer (npm run test:music-metronome).

(function (root) {
  'use strict';

  var BPM_MIN = 30;
  var BPM_MAX = 240;

  /** Reads the tempo out of the field's text ("♪ = 92", "Quarter note = 92",
   *  "92 bpm"). The number after an "=" wins; otherwise the first number.
   *  Returns null when there is no number, else { bpm, asked, clamped }. */
  function parseTempo(text) {
    var s = String(text == null ? '' : text);
    var eq = s.indexOf('=');
    var m = (eq !== -1 ? s.slice(eq + 1) : s).match(/\d+(?:\.\d+)?/);
    if (!m && eq !== -1) m = s.match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    var asked = parseFloat(m[0]);
    if (!isFinite(asked)) return null;
    var bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, asked));
    return { bpm: bpm, asked: asked, clamped: bpm !== asked };
  }

  /** Where beat number `index` (0 = the first click) falls. With a count-in, the
   *  first `beatsPerMeasure` clicks are the count-in measure (measure -1). */
  function beatInfo(index, beatsPerMeasure, countIn) {
    var lead = countIn ? beatsPerMeasure : 0;
    if (index < lead) {
      return { index: index, countIn: true, measure: -1, beat: index, accent: index === 0 };
    }
    var k = index - lead;
    var beat = k % beatsPerMeasure;
    return { index: index, countIn: false, measure: Math.floor(k / beatsPerMeasure), beat: beat, accent: beat === 0 };
  }

  var CLICK = {
    accent: { freq: 1760, gain: 0.6 },
    plain: { freq: 1320, gain: 0.32 },
    dur: 0.05
  };

  /** One click at `time`: a short sine blip with a fast decay. Returns its nodes. */
  function click(ctx, dest, time, accent) {
    var spec = accent ? CLICK.accent : CLICK.plain;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(spec.freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(spec.gain, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK.dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + CLICK.dur + 0.01);
    return { time: time, osc: osc, gain: gain, accent: !!accent };
  }

  /**
   * createMetronome({ ctx, bpm, beatsPerMeasure, countIn, onBeat, onStop,
   *                   lookahead, interval, startDelay, setTimer, clearTimer })
   * → { start(), stop(reason), running(), scheduled() }
   *
   * Loops until stop(). `scheduled()` is the clicks handed to the audio graph and not
   * yet over, for the tests.
   */
  function createMetronome(opts) {
    var ctx = opts.ctx;
    var bpm = opts.bpm;
    var perMeasure = opts.beatsPerMeasure;
    var countIn = !!opts.countIn;
    var lookahead = opts.lookahead == null ? 0.12 : opts.lookahead;
    var interval = opts.interval == null ? 25 : opts.interval;
    var startDelay = opts.startDelay == null ? 0.06 : opts.startDelay;
    var setTimer = opts.setTimer || function (fn, ms) { return setInterval(fn, ms); };
    var clearTimer = opts.clearTimer || function (id) { clearInterval(id); };
    var onBeat = opts.onBeat || function () {};
    var onStop = opts.onStop || function () {};
    var dest = opts.destination || ctx.destination;
    var secondsPerBeat = 60 / bpm;

    var running = false;
    var timer = null;
    var startTime = 0;
    var nextIndex = 0;
    var pending = [];   // beats scheduled whose indicator has not been shown yet
    var live = [];      // clicks in the audio graph that have not finished

    function tick() {
      if (!running) return;
      var now = ctx.currentTime;
      // Each click's time is computed from the start, never accumulated, so
      // rounding cannot drift a long run.
      var t = startTime + nextIndex * secondsPerBeat;
      while (t < now + lookahead) {
        var info = beatInfo(nextIndex, perMeasure, countIn);
        info.time = t;
        live.push(click(ctx, dest, t, info.accent));
        pending.push(info);
        nextIndex++;
        t = startTime + nextIndex * secondsPerBeat;
      }
      while (pending.length && pending[0].time <= now) onBeat(pending.shift());
      live = live.filter(function (c) { return c.time + CLICK.dur + 0.01 > now; });
    }

    function start() {
      if (running) return;
      running = true;
      startTime = ctx.currentTime + startDelay;
      nextIndex = 0;
      pending = [];
      live = [];
      timer = setTimer(tick, interval);
      tick();
    }

    function stop(reason) {
      if (!running) return;
      running = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
      // Silence what was already handed to the graph but has not sounded yet.
      live.forEach(function (c) {
        try { c.gain.disconnect(); } catch (e) { /* already gone */ }
        try { c.osc.stop(0); } catch (e) { /* already stopped */ }
      });
      live = [];
      pending = [];
      onStop(reason);
    }

    return {
      start: start,
      stop: stop,
      running: function () { return running; },
      scheduled: function () { return live.slice(); },
      tick: tick
    };
  }

  /* ---------------- Pitches on the staff (AI-48) ----------------
     The staff drawing and the sound read one formula: a note's place on the staff is
     its diatonic number (octave * 7 + letter index, C = 0) less the clef's anchor,
     the diatonic number of the bottom line (E4 in treble, G2 in bass). Position 0
     is the bottom line, each step up is one line or space. The page draws with
     notePosition() and plays with positionFrequency(), so a note cannot be drawn on
     one line and sounded at another. Naturals only: no accidentals, no key. */
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var SEMITONES = [0, 2, 4, 5, 7, 9, 11];
  var CLEF_ANCHOR = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };
  var A4 = 440;

  function diatonicNumber(note) { return note.octave * 7 + LETTERS.indexOf(note.letter); }
  function notePosition(note, clef) { return diatonicNumber(note) - CLEF_ANCHOR[clef]; }

  /** The note drawn at staff position `position` in `clef`. */
  function positionNote(position, clef) {
    var d = position + CLEF_ANCHOR[clef];
    var step = ((d % 7) + 7) % 7;
    return { letter: LETTERS[step], octave: (d - step) / 7 };
  }

  /** Equal temperament, A4 = 440 Hz; MIDI 69 is A4 and C4 is 60. */
  function noteFrequency(note) {
    var midi = (note.octave + 1) * 12 + SEMITONES[LETTERS.indexOf(note.letter)];
    return A4 * Math.pow(2, (midi - 69) / 12);
  }

  function positionFrequency(position, clef) { return noteFrequency(positionNote(position, clef)); }

  /** The reference pitch for a pattern: the lowest C in the range (do, since these
   *  notes are naturals and so in C major), or, when the range holds no C, the
   *  pattern's first note. `range` is the notes the pattern was drawn from. */
  function referenceNote(range, notes) {
    var cs = (range || []).filter(function (n) { return n.letter === 'C'; });
    if (cs.length) {
      cs.sort(function (a, b) { return diatonicNumber(a) - diatonicNumber(b); });
      return { note: cs[0], tonic: true };
    }
    if (notes && notes.length) return { note: notes[0], tonic: false };
    return null;
  }

  var TONE = { type: 'triangle', gain: 0.3, attack: 0.02, share: 0.85, refDur: 1.5 };

  /** One tone at `time` lasting `dur` seconds: a triangle wave with a short attack
   *  and a decay to silence by its end. Returns its nodes. */
  function tone(ctx, dest, time, freq, dur) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = TONE.type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(TONE.gain, time + TONE.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    return { time: time, end: time + dur + 0.02, osc: osc, gain: gain, freq: freq };
  }

  /**
   * createNotePlayer({ ctx, freqs, bpm, noteDuration, onNote, onEnd, onStop,
   *                    lookahead, interval, startDelay, setTimer, clearTimer })
   * → { start(), stop(reason), running(), scheduled(), tick() }
   *
   * Plays `freqs` once, one per beat at `bpm` (even quarter notes), each lasting
   * `noteDuration` seconds (default: 85% of a beat). Same look-ahead scheduler as the
   * click track: note k sounds at start + k * 60/bpm on the audio clock. `onNote`
   * hears about note k once its time has come; `onEnd` once the last note is over,
   * after which the player is no longer running. A one-note player with a longer
   * `noteDuration` is the reference pitch.
   */
  function createNotePlayer(opts) {
    var ctx = opts.ctx;
    var freqs = opts.freqs.slice();
    var beat = 60 / opts.bpm;
    var noteDur = opts.noteDuration == null ? beat * TONE.share : opts.noteDuration;
    var ahead = opts.lookahead == null ? 0.12 : opts.lookahead;
    var every = opts.interval == null ? 25 : opts.interval;
    var delay = opts.startDelay == null ? 0.06 : opts.startDelay;
    var setT = opts.setTimer || function (fn, ms) { return setInterval(fn, ms); };
    var clearT = opts.clearTimer || function (id) { clearInterval(id); };
    var noteCb = opts.onNote || function () {};
    var endCb = opts.onEnd || function () {};
    var stopCb = opts.onStop || function () {};
    var out = opts.destination || ctx.destination;

    var playing = false;
    var handle = null;
    var t0 = 0;
    var next = 0;
    var due = [];      // notes scheduled whose onNote has not fired
    var sounding = []; // tones in the graph that are not over

    function halt() {
      playing = false;
      if (handle !== null) clearT(handle);
      handle = null;
    }

    function wake() {
      if (!playing) return;
      var now = ctx.currentTime;
      while (next < freqs.length && t0 + next * beat < now + ahead) {
        var at = t0 + next * beat;
        sounding.push(tone(ctx, out, at, freqs[next], noteDur));
        due.push({ index: next, time: at, freq: freqs[next], count: freqs.length });
        next++;
      }
      while (due.length && due[0].time <= now) noteCb(due.shift());
      sounding = sounding.filter(function (n) { return n.end > now; });
      if (next >= freqs.length && !due.length && now >= t0 + (freqs.length - 1) * beat + noteDur) {
        halt();
        sounding = [];
        endCb();
      }
    }

    function begin() {
      if (playing || !freqs.length) return;
      playing = true;
      t0 = ctx.currentTime + delay;
      next = 0;
      due = [];
      sounding = [];
      handle = setT(wake, every);
      wake();
    }

    function end(reason) {
      if (!playing) return;
      halt();
      sounding.forEach(function (n) {
        try { n.gain.disconnect(); } catch (e) { /* already gone */ }
        try { n.osc.stop(0); } catch (e) { /* already stopped */ }
      });
      sounding = [];
      due = [];
      stopCb(reason);
    }

    return {
      start: begin,
      stop: end,
      running: function () { return playing; },
      scheduled: function () { return sounding.slice(); },
      tick: wake
    };
  }

  var shared = null;
  /** The page's one AudioContext, made on first call. Call it only from a click
   *  handler: a context made before a gesture starts suspended. Null when the
   *  browser has no Web Audio. */
  function audioContext(win) {
    var w = win || root;
    if (!shared) {
      var Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return null;
      shared = new Ctor();
    }
    if (shared.state === 'suspended' && shared.resume) {
      try { var p = shared.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    }
    return shared;
  }

  root.MsrgAudio = {
    BPM_MIN: BPM_MIN,
    BPM_MAX: BPM_MAX,
    CLICK: CLICK,
    parseTempo: parseTempo,
    beatInfo: beatInfo,
    click: click,
    createMetronome: createMetronome,
    LETTERS: LETTERS,
    CLEF_ANCHOR: CLEF_ANCHOR,
    TONE: TONE,
    notePosition: notePosition,
    positionNote: positionNote,
    noteFrequency: noteFrequency,
    positionFrequency: positionFrequency,
    referenceNote: referenceNote,
    tone: tone,
    createNotePlayer: createNotePlayer,
    audioContext: audioContext
  };
})(globalThis);
