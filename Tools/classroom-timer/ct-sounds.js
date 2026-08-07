// ct-sounds.js — three alert tones synthesized with the Web Audio API.
// No audio files to fetch, so nothing here can fail on a filtered school network
// or a blocked CDN. `unlock()` must run inside a user-gesture handler (a Start or
// Test-sound click) because browsers refuse to start an AudioContext otherwise.

export const SOUND_NAMES = ['chime', 'bell', 'buzzer'];

let ctx = null;

export function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(dest, freq, startTime, duration, type, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function render(name, dest, now) {
  if (name === 'chime') {
    [523.25, 659.25, 783.99].forEach((f, i) => tone(dest, f, now + i * 0.13, 0.5, 'sine', 0.4));
  } else if (name === 'bell') {
    tone(dest, 392, now, 1.6, 'sine', 0.5);
    tone(dest, 392 * 2.41, now, 1.1, 'sine', 0.18);
  } else if (name === 'buzzer') {
    tone(dest, 220, now, 0.18, 'square', 0.3);
    tone(dest, 220, now + 0.25, 0.18, 'square', 0.3);
    tone(dest, 220, now + 0.5, 0.32, 'square', 0.3);
  }
}

/** Plays `name` at `volume` (0-1). No-ops for 'none', zero volume, or before unlock(). */
export function play(name, volume) {
  if (!ctx || !SOUND_NAMES.includes(name) || volume <= 0) return;
  const master = ctx.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume));
  master.connect(ctx.destination);
  render(name, master, ctx.currentTime + 0.01);
}

export default { SOUND_NAMES, unlock, play };
