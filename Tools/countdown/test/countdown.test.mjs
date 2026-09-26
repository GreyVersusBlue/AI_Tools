// countdown.test.mjs — pure-logic tests for _shared/countdown.js (Path 22 P5),
// the one countdown 004, 010 and 087 share.
//
//   node Tools/countdown/test/countdown.test.mjs
//
// countdown.js is a classic script that publishes window.Countdown, so it runs
// here in a vm context. Every function takes `now`, so no clock is faked.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'countdown.js'), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const C = ctx.window.Countdown;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Countdown — shared timer logic');

const T = 1_700_000_000_000;
let c = C.create(300000);
eq(c, { totalMs: 300000, endAt: 0, leftMs: 300000 }, 'create');
eq(C.isRunning(c), false, 'not running');
eq(C.left(c, T), 300000, 'full time left');

C.start(c, T);
eq(c.endAt, T + 300000, 'start sets the end time from now');
eq(C.left(c, T + 60000), 240000, 'left is end minus now');
C.pause(c, T + 60000);
eq([c.endAt, c.leftMs], [0, 240000], 'pause keeps what is left');
eq(C.left(c, T + 999999), 240000, 'a paused timer does not move');
C.start(c, T + 100000);
eq(c.endAt, T + 340000, 'resume continues from what was left');
C.toggle(c, T + 100000);
eq(C.isRunning(c), false, 'toggle pauses');
C.toggle(c, T + 100000);
eq(C.isRunning(c), true, 'toggle resumes');

C.add(c, 60000, T + 100000);
eq(C.left(c, T + 100000), 300000, 'add while running');
C.pause(c, T + 100000);
C.add(c, 30000, T);
eq(c.leftMs, 330000, 'add while paused');
C.add(c, -999999, T);
eq(c.leftMs, 0, 'taking away never goes below zero');

c = C.create(5000);
C.start(c, T);
eq(C.expire(c, T + 4999), false, 'not expired a millisecond early');
eq(C.expire(c, T + 5000), true, 'expires at zero');
eq(C.expire(c, T + 6000), false, 'and only once');
eq(C.isDone(c), true, 'a finished timer is done');
eq(C.left(c, T + 6000), 0, 'with nothing left');
C.start(c, T + 7000);
eq(c.endAt, T + 12000, 'starting a finished timer runs its full length again');
C.reset(c);
eq(c, { totalMs: 5000, endAt: 0, leftMs: 5000 }, 'reset stops at the full length');
C.setTotal(c, 90000);
eq(c, { totalMs: 90000, endAt: 0, leftMs: 90000 }, 'setTotal');
C.setTotal(c, 1e12);
eq(c.totalMs, C.MAX_MS, 'capped at 24 hours');
C.setTotal(c, -5);
eq(c.totalMs, 0, 'never negative');
C.start(c, T);
eq(C.isRunning(c), false, 'a zero-length timer does not start');

// restore
let r = C.restore({ totalMs: 300000, endAt: T + 100000, leftMs: 0 }, T);
eq([r.expired, C.isRunning(r.c), C.left(r.c, T)], [false, true, 100000], 'restore a running timer');
r = C.restore({ totalMs: 300000, endAt: T - 1, leftMs: 0 }, T);
eq([r.expired, C.isRunning(r.c), C.left(r.c, T), C.isDone(r.c)], [true, false, 0, true], 'ran out while closed: finished, flagged, not running');
r = C.restore({ totalMs: 300000, endAt: 0, leftMs: 120000 }, T);
eq([r.expired, C.left(r.c, T)], [false, 120000], 'restore a paused timer');
r = C.restore({ totalMs: 300000, endAt: 0, leftMs: 999999 }, T);
eq(C.left(r.c, T), 300000, 'paused time never exceeds the length');
r = C.restore({ totalMs: 300000 }, T);
eq(C.left(r.c, T), 300000, 'no leftMs means a fresh timer, not a finished one');
r = C.restore(null, T);
eq(r.c, { totalMs: 0, endAt: 0, leftMs: 0 }, 'nothing saved');
r = C.restore({ totalMs: 'x', endAt: 'y', leftMs: NaN }, T);
eq([r.c.totalMs, r.c.endAt, r.expired], [0, 0, false], 'garbage saved');

// format
eq(C.format(245000), '4:05', 'm:ss');
eq(C.format(3723000), '1:02:03', 'h:mm:ss');
eq(C.format(1), '0:01', 'ceil: a running timer never shows 0:00 early');
eq(C.format(0), '0:00', 'zero');
eq(C.format(-500), '0:00', 'negative is zero');
eq(C.format(245000, { pad: true }), '04:05', 'padded');
eq(C.format(1400, { round: 'round', pad: true }), '00:01', 'round (004 and 010)');
eq(C.format(1600, { round: 'round', pad: true }), '00:02', 'round up past a half');
eq(C.format(1999, { round: 'floor' }), '0:01', 'floor for elapsed time');
eq(C.format(4500000, { pad: true, round: 'round' }), '1:15:00', 'past an hour, hours show (010 used to say 75:00)');

// parse
eq(C.parse('5'), 300, 'minutes');
eq(C.parse('2.5'), 150, 'fractional minutes');
eq(C.parse('4:30'), 270, 'm:ss');
eq(C.parse(' 1:00:00 '), 3600, 'h:mm:ss, trimmed');
eq(C.parse('90s'), 90, 'seconds');
eq(C.parse('90S'), 90, 'any case');
for (const bad of ['', '0', '4:75', '1:60:00', 'abc', '-5', '25:00:00', null, 5]) eq(C.parse(bad), null, 'refused: ' + JSON.stringify(bad));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
