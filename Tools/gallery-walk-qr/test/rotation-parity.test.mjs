// rotation-parity.test.mjs — holds 017's timer, now on _shared/rotation.js, to the
// timer code the page had at v354 (_legacy.mjs, copied out of the page).
//
//   node Tools/gallery-walk-qr/test/rotation-parity.test.mjs   (or: npm run test:gallery-rotation-parity)
//
// Random sequences of start / pause / resume / rotate-now / reset / tick, on a
// fake clock that jumps by random steps (some long enough to sleep through the
// whole walk), with 1 to 6 rotations and a starting count that may already be
// at or past the end, are run against the frozen page code (Date.now patched to
// the fake clock) and against Rotation wrapped the way the page calls it. After
// every step the whole timer object, the returned values and the displayed time
// must be identical. Exits 1 on the first difference.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { legacy } from './_legacy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'rotation.js'), 'utf8'), ctx);
const R = ctx.window.Rotation;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realNow = Date.now;
let checks = 0, failures = 0;
function same(label, a, b) {
  checks++;
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) {
    failures++;
    if (failures <= 5) console.log('FAIL ' + label + '\n  old ' + x.slice(0, 300) + '\n  new ' + y.slice(0, 300));
  }
}

for (let seed = 1; seed <= 600; seed++) {
  const rng = mulberry(seed);
  const rotations = 1 + Math.floor(rng() * 6);
  const base = { timer: { minutes: 3, seconds: 0, rotations, soundEnabled: true, count: Math.floor(rng() * (rotations + 2)), running: false, paused: false, endAt: null, remainingMs: null } };
  const oldState = JSON.parse(JSON.stringify(base));
  const newState = JSON.parse(JSON.stringify(base));
  let now = 1_000_000 + Math.floor(rng() * 1000);
  const minutes = Math.floor(rng() * 3), seconds = Math.floor(rng() * 60);
  const totalMs = (minutes * 60 + seconds) * 1000;
  const getMs = () => totalMs;
  const L = legacy(oldState, getMs);
  Date.now = () => now;
  // the page's handlers around Rotation
  const N = {
    start: () => {
      if (totalMs <= 0) return false;
      const t = newState.timer;
      if (t.count >= t.rotations) t.count = 0;
      R.start(t, now, totalMs);
      return true;
    },
    pause: () => R.pause(newState.timer, now),
    resume: () => R.resume(newState.timer, now, totalMs),
    rotateNow: () => {
      const t = newState.timer;
      if (t.count >= t.rotations) return false;
      R.rotateNow(t, now, totalMs, t.rotations);
      return true;
    },
    reset: () => R.reset(newState.timer),
    tick: () => {
      const t = newState.timer;
      if (!t.running || !t.endAt) return false;
      return R.tick(t, now, totalMs, 1, t.rotations);
    },
    shown: () => R.remaining(newState.timer, now, totalMs)
  };
  for (let step = 0; step < 40; step++) {
    const op = ['start', 'pause', 'resume', 'rotateNow', 'reset', 'tick', 'tick'][Math.floor(rng() * 7)];
    now += rng() < 0.2 ? Math.floor(rng() * 20 * 60000) : Math.floor(rng() * 90000);
    let a, b;
    if (op === 'start') { a = L.doStart(); b = N.start(); }
    else if (op === 'pause') { a = L.doPause(); b = N.pause(); }
    else if (op === 'resume') { a = L.doResume(); b = N.resume(); }
    else if (op === 'rotateNow') { a = L.doRotateNow(); b = N.rotateNow(); }
    else if (op === 'reset') { L.doReset(); N.reset(); }
    else { a = L.tick(); b = N.tick(); }
    const label = `seed ${seed} step ${step} ${op}`;
    same(label + ' timer', oldState.timer, newState.timer);
    same(label + ' returned', a, b);
    same(label + ' display', L.displayMs(), N.shown());
  }
}
Date.now = realNow;
console.log(`${checks} checks, ${failures} differences`);
process.exit(failures ? 1 : 0);
