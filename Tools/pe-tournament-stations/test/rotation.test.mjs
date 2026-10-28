// rotation.test.mjs — pure-logic tests for _shared/rotation.js (Path 13 P3):
// the station assignment and the rotation clock.
//
//   node Tools/pe-tournament-stations/test/rotation.test.mjs   (or: npm run test:rotation)
//
// rotation.js runs here in a vm context. Every check is run against the real
// file and then against a copy with the rule it guards broken on purpose
// (MUTANTS), which it must fail. Parity with 021's page code is
// rotation-parity.test.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'rotation.js'), 'utf8');
function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.Rotation;
}
const J = (x) => JSON.stringify(x);
const clock = (o) => Object.assign({ count: 0, running: false, paused: false, endAt: null, remainingMs: null }, o);

const CHECKS = {
  'groups walk one station on each rotation': (R) =>
    J(R.computeAssignment(['A', 'B', 'C'], 3, 0)) === J([['A'], ['B'], ['C']]) &&
    J(R.computeAssignment(['A', 'B', 'C'], 3, 1)) === J([['C'], ['A'], ['B']]),
  'a negative count wraps the other way': (R) =>
    J(R.computeAssignment(['A', 'B', 'C'], 3, -1)) === J([['B'], ['C'], ['A']]),
  'more groups than stations share a station; no stations is empty': (R) =>
    J(R.computeAssignment(['A', 'B', 'C'], 2, 0)) === J([['A', 'C'], ['B']]) &&
    J(R.computeAssignment(['A'], 0, 5)) === J([]),
  'start runs a full rotation, or what a pause left': (R) => {
    const a = clock(); R.start(a, 1000, 60000);
    const b = clock({ paused: true, remainingMs: 7000 }); R.start(b, 1000, 60000);
    return a.endAt === 61000 && a.running && b.endAt === 8000 && b.remainingMs === null;
  },
  'pause keeps what is left; pausing a stopped clock changes nothing': (R) => {
    const a = clock({ running: true, endAt: 61000 });
    const ok = R.pause(a, 11000);
    const b = clock();
    return ok === true && a.remainingMs === 50000 && a.paused && !a.running && a.endAt === null &&
      R.pause(b, 5) === false && J(b) === J(clock());
  },
  'resume picks up where the pause left it': (R) => {
    const a = clock({ paused: true, remainingMs: 50000 });
    return R.resume(a, 100000, 60000) === true && a.endAt === 150000 && a.running && !a.paused &&
      R.resume(clock(), 1, 1) === false;
  },
  'rotate now moves the count and restarts a running clock': (R) => {
    const a = clock({ running: true, endAt: 5000 }); R.rotateNow(a, 1000, 60000);
    const b = clock({ paused: true, remainingMs: 3 }); R.rotateNow(b, 1000, 60000);
    const c = clock(); R.rotateNow(c, 1000, 60000);
    return a.count === 1 && a.endAt === 61000 && b.count === 1 && b.remainingMs === 60000 &&
      c.count === 1 && c.endAt === null && c.remainingMs === null;
  },
  'reset puts the clock back to the start': (R) => {
    const a = clock({ count: 4, running: true, paused: true, endAt: 9, remainingMs: 9 });
    R.reset(a);
    return J(a) === J(clock());
  },
  'tick catches a sleeping tab up to the right rotation': (R) => {
    const a = clock({ running: true, endAt: 10000 });
    const changed = R.tick(a, 10000 + 3 * 60000 + 5, 60000, 4);
    return changed === true && a.count === 4 && a.endAt === 10000 + 4 * 60000;
  },
  'tick leaves a clock with time left alone': (R) => {
    const a = clock({ running: true, endAt: 10000 });
    return R.tick(a, 9999, 60000, 4) === false && a.count === 0 && a.endAt === 10000;
  },
  'tick moves nothing without stations, and is capped at 200 a call': (R) => {
    const a = clock({ running: true, endAt: 0 });
    const b = clock({ running: true, endAt: 0 });
    return R.tick(a, 99999, 1000, 0) === false && a.count === 0 && R.tick(b, 1e9, 1000, 3) === true && b.count === 200;
  },
  'a zero-length rotation advances by a second, not forever': (R) => {
    const a = clock({ running: true, endAt: 0 });
    R.tick(a, 3500, 0, 2);
    return a.count === 4 && a.endAt === 4000;
  },
  'rotate now with a finish count stops the clock on the last rotation': (R) => {
    const a = clock({ running: true, endAt: 5000, count: 1 }); R.rotateNow(a, 1000, 60000, 3);
    const b = clock({ paused: true, remainingMs: 9, count: 2 }); R.rotateNow(b, 1000, 60000, 3);
    return a.count === 2 && a.running && a.endAt === 61000 &&
      b.count === 3 && !b.paused && !b.running && b.remainingMs === null && b.endAt === null;
  },
  'tick with a finish count stops at it and counts no further': (R) => {
    const a = clock({ running: true, endAt: 10000 });
    const changed = R.tick(a, 10000 + 9 * 60000, 60000, 1, 3);
    const b = clock({ running: true, endAt: 10000, count: 0 });
    return changed === true && a.count === 3 && !a.running && a.endAt === null && a.remainingMs === null &&
      R.tick(b, 5000, 60000, 1, 3) === false && b.running && b.count === 0;
  },
  'the display shows the time left, the paused time, or a full rotation': (R) =>
    R.remaining(clock({ running: true, endAt: 5000 }), 2000, 60000) === 3000 &&
    R.remaining(clock({ paused: true, remainingMs: 7 }), 2000, 60000) === 7 &&
    R.remaining(clock(), 2000, 60000) === 60000
};

const MUTANTS = {
  'groups walk one station on each rotation': ['var idx = ', 'var idx = (gi + wrapped + 1) % s; var _unused = '],
  'a negative count wraps the other way': ['((count % s) + s) % s', '(count % s)'],
  'more groups than stations share a station; no stations is empty': ['if (s === 0) return map;', 'if (s === 0) return [[]];'],
  'start runs a full rotation, or what a pause left': ['r.endAt = now + (r.remainingMs != null ? r.remainingMs : totalMs);\n    r.remainingMs = null;\n  }\n\n  /* False (and nothing changed) when the clock was not running. */', 'r.endAt = now + totalMs;\n    r.remainingMs = null;\n  }\n\n  /* False (and nothing changed) when the clock was not running. */'],
  'pause keeps what is left; pausing a stopped clock changes nothing': ['if (!r.running) return false;', ''],
  'resume picks up where the pause left it': ['if (!r.paused) return false;', ''],
  'rotate now moves the count and restarts a running clock': ['if (r.running) r.endAt = now + totalMs;', 'if (r.running) r.endAt = r.endAt;'],
  'reset puts the clock back to the start': ['r.count = 0;', ''],
  'tick catches a sleeping tab up to the right rotation': ['r.endAt += (totalMs > 0 ? totalMs : 1000);', 'r.endAt += 1;'],
  'tick leaves a clock with time left alone': ['while (left <= 0 ', 'while (left <= 1 '],
  'tick moves nothing without stations, and is capped at 200 a call': ['guard < 200', 'guard < 500'],
  'a zero-length rotation advances by a second, not forever': ['(totalMs > 0 ? totalMs : 1000)', 'totalMs'],
  'rotate now with a finish count stops the clock on the last rotation': ['r.count >= finishAt) finish(r);\n    else if', 'r.count > finishAt) finish(r);\n    else if'],
  'tick with a finish count stops at it and counts no further': ['{ finish(r); break; }', '{ finish(r); }'],
  'the display shows the time left, the paused time, or a full rotation': ['if (r.paused && r.remainingMs != null) return r.remainingMs;', '']
};

let failed = 0, ran = 0;
const real = load(SRC);
for (const [name, fn] of Object.entries(CHECKS)) {
  ran++;
  let ok = false;
  try { ok = !!fn(real); } catch (e) { console.log('  threw: ' + e.message); }
  console.log((ok ? 'ok   ' : 'FAIL ') + name);
  if (!ok) failed++;
  const mut = MUTANTS[name];
  if (!mut) { console.log('FAIL no mutant for ' + name); failed++; continue; }
  const count = SRC.split(mut[0]).length - 1;
  if (count !== 1) { console.log(`FAIL mutant text for "${name}" occurs ${count} times`); failed++; continue; }
  let mutantOk = true;
  try { mutantOk = !!fn(load(SRC.replace(mut[0], () => mut[1]))); } catch (e) { mutantOk = false; }
  ran++;
  console.log((mutantOk ? 'FAIL ' : 'ok   ') + '  ...and fails with its rule broken');
  if (mutantOk) failed++;
}
console.log(`\n${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
