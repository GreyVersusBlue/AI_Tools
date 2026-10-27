// rotation-parity.test.mjs — holds _shared/rotation.js to 021's rotation code as
// the page had it at v353 (_legacy.mjs, copied out of the page).
//
//   node Tools/pe-tournament-stations/test/rotation-parity.test.mjs   (or: npm run test:rotation-parity)
//
// Random sequences of start / pause / resume / rotate-now / reset / tick, with
// a fake clock that jumps by random steps (some of them long enough to sleep
// through many rotations), are run against the frozen page code (Date.now
// patched to the fake clock) and against Rotation, wrapped the way the page
// calls it. After every step the whole clock object, the returned values, the
// station assignment for the current count and the next, and the displayed
// time must be identical. Exits 1 on the first difference.

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
function fresh(rng) {
  const stations = Array.from({ length: Math.floor(rng() * 7) }, (_, i) => ({ id: 's' + i }));
  const groups = Array.from({ length: Math.floor(rng() * 9) }, (_, i) => ({ id: 'g' + i, name: 'G' + i }));
  return { stations, groups, rotation: { count: Math.floor(rng() * 5) - 1, running: false, paused: false, endAt: null, remainingMs: null } };
}

for (let seed = 1; seed <= 400; seed++) {
  const rng = mulberry(seed);
  const base = fresh(rng);
  const oldState = JSON.parse(JSON.stringify(base));
  const newState = JSON.parse(JSON.stringify(base));
  let now = 1_000_000 + Math.floor(rng() * 1000);
  const minutes = Math.floor(rng() * 3), seconds = Math.floor(rng() * 60);
  const totalMs = (minutes * 60 + seconds) * 1000;
  const getMs = () => totalMs;
  const L = legacy(oldState, getMs);
  Date.now = () => now;
  // the page's wrappers around Rotation
  const N = {
    assign: (c) => R.computeAssignment(newState.groups, newState.stations.length, typeof c === 'number' ? c : newState.rotation.count),
    start: () => R.start(newState.rotation, now, totalMs),
    pause: () => R.pause(newState.rotation, now),
    resume: () => R.resume(newState.rotation, now, totalMs),
    rotateNow: () => { if (!newState.stations.length) return; R.rotateNow(newState.rotation, now, totalMs); },
    reset: () => R.reset(newState.rotation),
    tick: () => { const r = newState.rotation; if (!r.running || !r.endAt) return false; return R.tick(r, now, totalMs, newState.stations.length); },
    shown: () => R.remaining(newState.rotation, now, totalMs)
  };
  for (let step = 0; step < 40; step++) {
    const op = ['start', 'pause', 'resume', 'rotateNow', 'reset', 'tick', 'tick'][Math.floor(rng() * 7)];
    now += rng() < 0.2 ? Math.floor(rng() * 20 * 60000) : Math.floor(rng() * 90000);
    let a, b;
    if (op === 'start') { L.doStart(); N.start(); }
    else if (op === 'pause') { L.doPause(); N.pause(); }
    else if (op === 'resume') { L.doResume(); N.resume(); }
    else if (op === 'rotateNow') { L.doRotateNow(); N.rotateNow(); }
    else if (op === 'reset') { L.doReset(); N.reset(); }
    else { a = L.tick(); b = N.tick(); }
    const label = `seed ${seed} step ${step} ${op}`;
    same(label + ' clock', oldState.rotation, newState.rotation);
    same(label + ' returned', a, b);
    same(label + ' assignment', [L.computeAssignment(), L.computeAssignment(oldState.rotation.count + 1)], [N.assign(), N.assign(newState.rotation.count + 1)]);
    same(label + ' display', L.displayMs(), N.shown());
  }
}
Date.now = realNow;
console.log(`${checks} checks, ${failures} differences`);
process.exit(failures ? 1 : 0);
