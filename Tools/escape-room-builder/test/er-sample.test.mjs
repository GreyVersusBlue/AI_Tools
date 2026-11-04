// er-sample.test.mjs — 019's sample room (er-sample.js) against every rule the builder and the
// student page hold a room to, one check per rule, with a mutant per rule.
//
//   node Tools/escape-room-builder/test/er-sample.test.mjs      (or: npm run test:er-sample)
//
// The room is read the way the page reads it (Stations.ensureIds, Stations.read) and played the
// way lock.html plays it (Stations.playPayload, EscapeRoomMatch.checkAnswer, Stations.nextOf), so
// a sample that passes here is one the page shows as ready and a phone can finish. The rules:
//   R1 every station is playable (a clue and an accepted answer), so none is silently dropped;
//   R2 each station's answer, typed as a student would, is accepted, and a wrong one is not;
//   R3 a digit lock's codes are digits and all one length (the builder warns otherwise);
//   R4 a cipher's shift is a real one (1-25, what clampShift keeps) and the shown text differs;
//   R5 the chain from station 1 reaches every station, in order, and ends with "End here";
//   R6 the letters collected on the way spell the last station's answer;
//   R7 every printed station code is inside the QR budget at the default error correction;
//   R8 it reads as a sample (named so, no picture, nothing stored by the file);
//   R9 a save and a reload (toDisk, read) give the same room to play.
// Then each mutant breaks one rule in a copy and the suite checks that exactly that rule fails.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(site, f), 'utf8');

const win = {};
const ctx = { window: win, Math, Date, JSON, Object, Array, String, Number, parseInt, parseFloat, isNaN, isFinite, RegExp, Error, btoa, unescape, encodeURIComponent, URL, TextEncoder };
vm.createContext(ctx);
vm.runInContext(read('_shared/vendor/qrcode/qrcode.js'), ctx);
win.qrcode = ctx.qrcode;
vm.runInContext(read('_shared/qr-draw.js'), ctx);
vm.runInContext(read('_shared/list-sentence.js'), ctx);
vm.runInContext(read('_shared/stations.js'), ctx);
vm.runInContext(read('Tools/escape-room-builder/er-sample.js'), ctx);
const S = win.Stations, M = win.EscapeRoomMatch, SAMPLE = win.ErSample;

// What a student types at each station, and something wrong there.
const TYPED = ['0.75', '20', 'check the lamp room', 'Evaporation', 'LAMP'];
const SLOPPY = ['.750', null, 'Check the lamp room.', '  evaporation! ', 'the lamp'];
const WRONG = ['0.8', '02', 'check the lamp', 'condensation', 'lamb'];
const BASE = 'http://127.0.0.1/Tools/019-escape-room-builder.html';

function room(stations, extra) {
  const obj = Object.assign({ name: SAMPLE.name, roomId: 'sample01', stations, cardsPerPage: '4', ecLevel: 'Q',
    showNumber: true, randomizeStart: false, countdownEnabled: false, countdownMinutes: 20,
    storyIntro: SAMPLE.storyIntro, packetCardsPerPage: '2' }, extra || {});
  let n = 0;
  S.ensureIds(obj, () => ((n++ * 0.137) % 1));
  return obj;
}

/** The rules that fail for a room (in-memory shape, ids given). */
function broken(obj) {
  const out = new Set();
  const set = S.read(obj);
  const pl = S.playable(set);
  const payload = S.playPayload(set, {});
  // R1
  if (pl.length !== obj.stations.length) out.add('R1');
  // R2
  payload.stations.forEach((st, n) => {
    const yes = (t) => t !== null && t !== undefined && M.checkAnswer(st, t).correct;
    if (!yes(TYPED[n])) out.add('R2');
    if (SLOPPY[n] !== null && SLOPPY[n] !== undefined && !yes(SLOPPY[n])) out.add('R2');
    if (WRONG[n] !== undefined && M.checkAnswer(st, WRONG[n]).correct) out.add('R2');
  });
  // R3
  pl.filter((s) => s._norm.type === 'digits').forEach((s) => {
    const codes = s._norm.answers;
    if (!codes.every((c) => /^\d+$/.test(c)) || new Set(codes.map((c) => c.length)).size !== 1) out.add('R3');
  });
  // R4
  obj.stations.forEach((st, i) => {
    if (st.type !== 'cipher') return;
    const p = pl.find((s) => s._index === i);
    if (!p || !(st.cipherShift >= 1 && st.cipherShift <= 25) || p._norm.cipherShift !== st.cipherShift) out.add('R4');
    else {
      const sh = p._norm.cipherShift;
      const enc = st.cipherPlain.replace(/[a-z]/g, (c) => String.fromCharCode((c.charCodeAt(0) - 97 + sh) % 26 + 97));
      if (enc === st.cipherPlain) out.add('R4');
    }
  });
  // R5: walk with the right answer at every station
  const walk = [];
  let cur = pl.length ? pl[0] : null;
  while (cur && walk.length <= pl.length) {
    walk.push(cur.id);
    const nx = S.nextOf(set, cur, TYPED[walk.length - 1]);
    if (nx === 'end' || nx === null) { walk.push(nx); break; }
    cur = pl.find((s) => s.id === nx);
  }
  const ids = pl.map((s) => s.id);
  if (JSON.stringify(walk) !== JSON.stringify(ids.concat(['end']))) out.add('R5');
  if (S.reachable(set).length !== ids.length) out.add('R5');
  // R6
  const last = payload.stations[payload.stations.length - 1];
  const letters = payload.stations.slice(0, -1).map((s) => s.awardLetter || '').join('');
  if (last.awardLetter || !letters || !M.checkAnswer(last, letters).correct) out.add('R6');
  // R7
  const budget = S.budget(set, { ecLevel: 'Q', base: BASE });
  if (budget.length !== pl.length || budget.some((r) => !r.ok)) out.add('R7');
  // R8
  if (!/^Sample\b/.test(obj.name) || !/sample/i.test(obj.storyIntro) || obj.stations.some((s) => s.image)) out.add('R8');
  // R9
  const again = S.read(JSON.parse(JSON.stringify(S.toDisk(obj))));
  if (JSON.stringify(S.playPayload(again, {})) !== JSON.stringify(payload)) out.add('R9');
  return [...out].sort();
}

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('019 sample room');
const fresh = SAMPLE.stations();
eq(fresh.length, 5, 'five stations');
eq(broken(room(SAMPLE.stations())), [], 'the sample breaks no rule');
ok(SAMPLE.stations() !== SAMPLE.stations() && SAMPLE.stations()[0] !== SAMPLE.stations()[0], 'stations() hands out fresh objects every call');
const keys = ['clue', 'answers', 'hint', 'next', 'image', 'type', 'hintCost', 'awardLetter', 'cipherPlain', 'cipherShift', 'maxAttempts', 'numericTolerance'];
ok(fresh.every((s) => JSON.stringify(Object.keys(s).sort()) === JSON.stringify(keys.slice().sort())), 'each station has exactly newSet()\'s fields');
eq(fresh.map((s) => s.type), ['text', 'digits', 'cipher', 'text', 'text'], 'one of each puzzle type');
ok(fresh.some((s) => s.hintCost > 0) && fresh.some((s) => s.maxAttempts > 0) && fresh.some((s) => s.numericTolerance !== null), 'it shows a costed hint, an attempt limit and a tolerance');

const MUTANTS = [
  ['R1', 'a station with no clue', (st) => { st[3].clue = '  '; }],
  ['R2', 'an answer the clue does not ask for', (st) => { st[3].answers = 'evaporate'; }],
  ['R3', 'codes of two lengths', (st) => { st[1].answers = '20, 020'; }],
  ['R4', 'a shift of 0', (st) => { st[2].cipherShift = 0; }],
  ['R5', 'the room ends early', (st) => { st[1].next = 'end'; }],
  ['R6', 'a letter that does not spell the word', (st) => { st[2].awardLetter = 'N'; }],
  ['R7', 'a clue too long for a printed code', (st) => { st[0].clue += ' ' + 'The keeper wrote more. '.repeat(100); }],
  ['R8', 'a station with a picture', (st) => { st[0].image = 'data:image/png;base64,AAAA'; }],
];
for (const [rule, what, mutate] of MUTANTS) {
  const st = SAMPLE.stations();
  mutate(st);
  const got = broken(room(st));
  ok(got.includes(rule), `mutant (${what}) is caught by ${rule} (got ${JSON.stringify(got)})`);
}
// R9 can only break if the store drops a field; break toDisk itself to prove the check can see it
{
  const real = S.toDisk;
  S.toDisk = (o) => { const d = real(o); d.stations[4].next = null; return d; };
  ok(broken(room(SAMPLE.stations())).includes('R9'), 'mutant (a save that loses "End here") is caught by R9');
  S.toDisk = real;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
