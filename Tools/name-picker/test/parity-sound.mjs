// parity-sound.mjs — Name Picker: np-sound.js against the audio code it replaced.
//
//   node Tools/name-picker/test/parity-sound.mjs
//
// Path 15 P1 step 2 moved 007's inline audio engine (ensureAudio, playBeep, playBeepForced,
// playNoise, playWinSound, playKlaxon) into np-sound.js. oldSound() below is that code,
// copied byte for byte from 007 at v448 inside a function that supplies the page globals it
// read. Both are driven against a fake AudioContext that records every call, with setTimeout
// replaced by a recorder and Math.random pinned, and the two logs must be identical.
// Pure Node.

import { createSound } from '../np-sound.js';

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log('  FAIL ' + label + '\n    got  ' + JSON.stringify(a).slice(0, 300) + '\n    want ' + JSON.stringify(b).slice(0, 300)); }
};

/* frozen: 007 at v448; `window`, `document` and `crazyMode` are what the page supplied */
function oldSound(window, document, getCrazy) {
  let audioCtx = null;
function ensureAudio(){if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){audioCtx=null;}}return audioCtx;}

/* === ENHANCED AUDIO ENGINE: smooth attack + release envelope eliminates clicks/pops on rapid playback === */
function playBeep(freq=800,duration=80,type='square',volume=0.1){
  if(!document.getElementById('soundToggle').checked)return;
  const ctx=ensureAudio();
  if(!ctx)return;
  try{
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type=type;osc.frequency.value=freq;
    const now=ctx.currentTime;
    const dur=Math.max(0.02,duration/1000);
    const attack=Math.min(0.006,dur*0.25);
    const release=Math.min(0.04,dur*0.55);
    const sustainEnd=Math.max(attack+0.001,dur-release);
    gain.gain.setValueAtTime(0.00001,now);
    gain.gain.linearRampToValueAtTime(volume,now+attack);
    gain.gain.setValueAtTime(volume,now+sustainEnd);
    gain.gain.exponentialRampToValueAtTime(0.00001,now+dur);
    osc.start(now);
    osc.stop(now+dur+0.015);
  }catch(e){}
}

/* Bypass the soundToggle check for soundboard sounds (manual = always play if user clicked) */
function playBeepForced(freq=800,duration=80,type='square',volume=0.1){
  const ctx=ensureAudio();
  if(!ctx)return;
  try{
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.type=type;osc.frequency.value=freq;
    const now=ctx.currentTime;
    const dur=Math.max(0.02,duration/1000);
    const attack=Math.min(0.006,dur*0.25);
    const release=Math.min(0.04,dur*0.55);
    const sustainEnd=Math.max(attack+0.001,dur-release);
    gain.gain.setValueAtTime(0.00001,now);
    gain.gain.linearRampToValueAtTime(volume,now+attack);
    gain.gain.setValueAtTime(volume,now+sustainEnd);
    gain.gain.exponentialRampToValueAtTime(0.00001,now+dur);
    osc.start(now);
    osc.stop(now+dur+0.015);
  }catch(e){}
}

/* Noise burst utility for percussive sounds (applause, drumroll, crickets, etc.) */
function playNoise(duration=200,volume=0.1,filterFreq=null,filterQ=1){
  const ctx=ensureAudio();
  if(!ctx)return;
  try{
    const bufferSize=ctx.sampleRate*Math.max(0.05,duration/1000);
    const buffer=ctx.createBuffer(1,bufferSize,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++)data[i]=Math.random()*2-1;
    const src=ctx.createBufferSource();
    src.buffer=buffer;
    const gain=ctx.createGain();
    const now=ctx.currentTime;
    const dur=duration/1000;
    if(filterFreq){
      const filter=ctx.createBiquadFilter();
      filter.type='bandpass';
      filter.frequency.value=filterFreq;
      filter.Q.value=filterQ;
      src.connect(filter);filter.connect(gain);
    }else{
      src.connect(gain);
    }
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.00001,now);
    gain.gain.linearRampToValueAtTime(volume,now+0.005);
    gain.gain.exponentialRampToValueAtTime(0.00001,now+dur);
    src.start(now);
    src.stop(now+dur+0.02);
  }catch(e){}
}

function playWinSound(rarity){
  if(!document.getElementById('soundToggle').checked)return;
  const v=getCrazy()?0.15:0.12;
  playBeep(523,130,'square',v);
  setTimeout(()=>playBeep(659,130,'square',v),140);
  setTimeout(()=>playBeep(784,130,'square',v),280);
  setTimeout(()=>playBeep(1047,400,'square',v+0.02),420);
  if(rarity&&rarity.name!=='COMMON'){
    setTimeout(()=>playBeep(rarity.sound,200,'sawtooth',0.1),600);
    setTimeout(()=>playBeep(rarity.sound*1.5,300,'triangle',0.1),800);
    if(rarity.name==='MYTHIC'||rarity.name==='LEGENDARY'){
      setTimeout(()=>playBeep(rarity.sound*2,500,'sawtooth',0.12),1100);
    }
  }
}

function playKlaxon(){
  if(!document.getElementById('soundToggle').checked)return;
  playBeep(440,120,'sawtooth',0.12);
  setTimeout(()=>playBeep(330,120,'sawtooth',0.12),130);
  setTimeout(()=>playBeep(440,120,'sawtooth',0.12),260);
}


  return { ensureAudio, playBeep, playBeepForced, playNoise, playWinSound, playKlaxon };
}

/* a recorder in place of the Web Audio graph */
function makeEnv() {
  const log = [];
  let n = 0;
  const param = (id, name) => new Proxy({ _v: 0 }, {
    get: (t, k) => (k === 'value' ? t._v : (...a) => log.push([id, name, k, ...a])),
    set: (t, k, v) => { if (k === 'value') { t._v = v; log.push([id, name, 'value=', v]); } return true; },
  });
  const node = (kind) => {
    const id = kind + (n++);
    const base = { id, connect: (to) => log.push([id, 'connect', to && to.id || 'destination']), start: (t) => log.push([id, 'start', t]), stop: (t) => log.push([id, 'stop', t]) };
    return new Proxy(base, {
      get: (t, k) => (k in t ? t[k] : (k === 'gain' || k === 'frequency' || k === 'Q' ? param(id, k) : undefined)),
      set: (t, k, v) => { log.push([id, k + '=', typeof v === 'object' ? 'buffer' : v]); t[k] = v; return true; },
    });
  };
  class FakeCtx {
    constructor() { this.currentTime = 1.5; this.sampleRate = 100; this.destination = { id: 'destination' }; log.push(['ctx', 'new']); }
    createOscillator() { return node('osc'); }
    createGain() { return node('gain'); }
    createBiquadFilter() { return node('filter'); }
    createBufferSource() { return node('src'); }
    createBuffer(ch, len, rate) { log.push(['ctx', 'buffer', ch, len, rate]); return { getChannelData: () => new Float32Array(len) }; }
  }
  const timers = [];
  return { log, FakeCtx, timers, setTimeout: (fn, ms) => { timers.push([ms, fn]); return timers.length; } };
}

function run(label, driver) {
  const results = [];
  for (const which of ['old', 'new']) {
    const env = makeEnv();
    const realST = globalThis.setTimeout, realRand = Math.random;
    let seed = 7;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    globalThis.setTimeout = env.setTimeout;
    const state = { sound: true, crazy: false };
    try {
      const api = which === 'old'
        ? oldSound({ AudioContext: env.FakeCtx }, { getElementById: () => ({ get checked() { return state.sound; } }) }, () => state.crazy)
        : createSound({ soundOn: () => state.sound, isCrazy: () => state.crazy, AudioContextCtor: env.FakeCtx });
      driver(api, state);
      for (let i = 0; i < env.timers.length; i++) { env.log.push(['timer', env.timers[i][0]]); env.timers[i][1](); }
    } finally { globalThis.setTimeout = realST; Math.random = realRand; }
    results.push(env.log);
  }
  eq(results[1], results[0], label);
  return results[0].length;
}

console.log('Name Picker — np-sound parity');

const R_MYTHIC = { name: 'MYTHIC', sound: 1400 }, R_RARE = { name: 'RARE', sound: 500 }, R_COMMON = { name: 'COMMON', sound: 200 };
const cases = {
  'a beep': (a) => a.playBeep(),
  'a beep with every argument': (a) => a.playBeep(550, 60, 'sine', 0.3),
  'a very short beep': (a) => a.playBeep(300, 10, 'triangle', 0.05),
  'a forced beep': (a) => a.playBeepForced(280, 80, 'sine', 0.06),
  'a noise burst, no filter': (a) => a.playNoise(),
  'a filtered noise burst': (a) => a.playNoise(300, 0.15, 2000, 2),
  'a win sound, nothing': (a) => a.playWinSound(null),
  'a win sound, common': (a) => a.playWinSound(R_COMMON),
  'a win sound, rare': (a) => a.playWinSound(R_RARE),
  'a win sound, mythic': (a) => a.playWinSound(R_MYTHIC),
  'a win sound in crazy mode': (a, s) => { s.crazy = true; a.playWinSound(R_RARE); },
  'the klaxon': (a) => a.playKlaxon(),
  'ensureAudio twice makes one context': (a) => { a.ensureAudio(); a.ensureAudio(); a.playBeep(); },
};
for (const [label, drive] of Object.entries(cases)) {
  const len = run(label, drive);
  if (len < 1) { failed++; console.log('  FAIL ' + label + ' recorded nothing'); } else passed++;
}
/* the Sound checkbox: off silences the gated functions and not the forced ones */
for (const [label, drive] of Object.entries({
  'a beep with sound off': (a, s) => { s.sound = false; a.playBeep(); },
  'a win sound with sound off': (a, s) => { s.sound = false; a.playWinSound(R_MYTHIC); },
  'the klaxon with sound off': (a, s) => { s.sound = false; a.playKlaxon(); },
  'a forced beep with sound off': (a, s) => { s.sound = false; a.playBeepForced(520, 80, 'sine', 0.06); },
  'noise with sound off': (a, s) => { s.sound = false; a.playNoise(60, 0.12, 300, 2); },
})) run(label, drive);

/* no AudioContext at all: silence, and ensureAudio says so */
{
  const realST = globalThis.setTimeout; globalThis.setTimeout = () => 0;
  const api = createSound({ soundOn: () => true, isCrazy: () => false, AudioContextCtor: function () { throw new Error('blocked'); } });
  eq([api.ensureAudio(), api.playBeep(), api.playNoise()], [null, undefined, undefined], 'a refused AudioContext is silence');
  globalThis.setTimeout = realST;
}

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
