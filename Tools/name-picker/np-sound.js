/* np-sound.js — the Name Picker's audio engine.
   One lazily-made AudioContext and the tone, noise and jingle builders on top of it. The page
   hands in two readers instead of this file reaching for page globals: soundOn() is the Sound
   checkbox, isCrazy() is Let's Go Crazy. Nothing here touches the DOM, so a fake AudioContext
   can drive it in Node (test/parity-sound.mjs holds it to the code it replaced). Smooth
   attack-and-release envelopes keep rapid playback free of clicks and pops. */

export function createSound({ soundOn, isCrazy, AudioContextCtor }) {
  let audioCtx = null;
  const Ctor = () => AudioContextCtor || (typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : undefined);

  function ensureAudio() {
    if (!audioCtx) { try { audioCtx = new (Ctor())(); } catch (e) { audioCtx = null; } }
    return audioCtx;
  }

  function tone(freq, duration, type, volume) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      const now = ctx.currentTime;
      const dur = Math.max(0.02, duration / 1000);
      const attack = Math.min(0.006, dur * 0.25);
      const release = Math.min(0.04, dur * 0.55);
      const sustainEnd = Math.max(attack + 0.001, dur - release);
      gain.gain.setValueAtTime(0.00001, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.setValueAtTime(volume, now + sustainEnd);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
      osc.start(now);
      osc.stop(now + dur + 0.015);
    } catch (e) { /* a context that refuses is silence, not an error */ }
  }

  /* Honours the Sound checkbox. */
  function playBeep(freq = 800, duration = 80, type = 'square', volume = 0.1) {
    if (!soundOn()) return;
    tone(freq, duration, type, volume);
  }

  /* Bypasses the checkbox: a soundboard button or a toggle click is a request for the sound. */
  function playBeepForced(freq = 800, duration = 80, type = 'square', volume = 0.1) {
    tone(freq, duration, type, volume);
  }

  /* Noise burst for percussive sounds (applause, drumroll, crickets, etc.) */
  function playNoise(duration = 200, volume = 0.1, filterFreq = null, filterQ = 1) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * Math.max(0.05, duration / 1000);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const dur = duration / 1000;
      if (filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = filterQ;
        src.connect(filter); filter.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.00001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
      src.start(now);
      src.stop(now + dur + 0.02);
    } catch (e) { /* silence */ }
  }

  function playWinSound(rarity) {
    if (!soundOn()) return;
    const v = isCrazy() ? 0.15 : 0.12;
    playBeep(523, 130, 'square', v);
    setTimeout(() => playBeep(659, 130, 'square', v), 140);
    setTimeout(() => playBeep(784, 130, 'square', v), 280);
    setTimeout(() => playBeep(1047, 400, 'square', v + 0.02), 420);
    if (rarity && rarity.name !== 'COMMON') {
      setTimeout(() => playBeep(rarity.sound, 200, 'sawtooth', 0.1), 600);
      setTimeout(() => playBeep(rarity.sound * 1.5, 300, 'triangle', 0.1), 800);
      if (rarity.name === 'MYTHIC' || rarity.name === 'LEGENDARY') {
        setTimeout(() => playBeep(rarity.sound * 2, 500, 'sawtooth', 0.12), 1100);
      }
    }
  }

  function playKlaxon() {
    if (!soundOn()) return;
    playBeep(440, 120, 'sawtooth', 0.12);
    setTimeout(() => playBeep(330, 120, 'sawtooth', 0.12), 130);
    setTimeout(() => playBeep(440, 120, 'sawtooth', 0.12), 260);
  }

  return { ensureAudio, playBeep, playBeepForced, playNoise, playWinSound, playKlaxon };
}
