// bracket-parity.test.mjs — holds _shared/bracket.js to 020's bracket code as
// the page had it at v352 (_legacy.mjs, copied out of the page by line range).
//
//   node Tools/bracket-tournament-generator/test/bracket-parity.test.mjs   (or: npm run test:bracket-parity)
//
// For every entry count 1 to 40, every seed mode, and every builder, the two
// are given the same seeded random numbers (the legacy copy through a patched
// Math.random, the engine through setRng) and the same sequence of results, and
// their whole states are compared as JSON after every step: the bracket built,
// each match decided, the byes and drops that follow, the standings, the pool
// seed order, each Swiss round. A saved bracket from the old page therefore
// opens in the new one. Exits 1 on the first difference, naming the case.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { legacy } from './_legacy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'bracket.js'), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const NEW = ctx.window.Bracket;
const OLD = legacy();

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
const realRandom = Math.random;
let checks = 0, failures = 0;
function same(label, a, b) {
  checks++;
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) {
    failures++;
    if (failures <= 5) console.log('FAIL ' + label + '\n  old ' + x.slice(0, 200) + '\n  new ' + y.slice(0, 200));
  }
}
/* Runs fn(B, rng) for both engines with an identical random stream. */
function both(seed, fn) {
  const rO = mulberry(seed);
  Math.random = rO;
  const o = fn(OLD, mulberry(seed + 1));
  Math.random = realRandom;
  NEW.setRng(mulberry(seed));
  const n = fn(NEW, mulberry(seed + 1));
  NEW.setRng(null);
  return [o, n];
}
const names = (n) => Array.from({ length: n }, (_, i) => 'P' + (i + 1));
const MODES = ['random', 'ranked', 'asEntered'];

/* Decides every decidable single/double-elimination match, in an order the
   rng picks, returning snapshots after each step. */
function playElim(B, s, rng, double) {
  const snaps = [];
  const adv = () => (double ? B.autoAdvanceDouble(s) : B.autoAdvance(s));
  adv(); snaps.push(JSON.stringify(s));
  for (let guard = 0; guard < 500; guard++) {
    const open = [];
    for (let r = 0; r < s.slots.length - 1; r++) for (let m = 0; m < s.slots[r + 1].length; m++)
      if (s.slots[r + 1][m] === false && s.slots[r][m * 2] && s.slots[r][m * 2 + 1]) open.push(['w', r, m]);
    if (double) {
      const lb = s.loserSlots;
      for (let r = 0; r < lb.length - 1; r++) for (let m = 0; m < lb[r].length / 2; m++) {
        const t = r % 2 === 0 ? m * 2 : m;
        if (lb[r + 1][t] === false && lb[r][m * 2] && lb[r][m * 2 + 1]) open.push(['l', r, m, t]);
      }
    }
    if (!open.length) break;
    const pick = open[Math.floor(rng() * open.length)];
    const side = rng() < 0.5 ? 0 : 1;
    if (pick[0] === 'w') {
      const [, r, m] = pick;
      s.slots[r + 1][m] = s.slots[r][m * 2 + side]; s.winnerSide[(r + 1) + '_' + m] = m * 2 + side;
      s.scores[(double ? 'w' : '') + r + '_' + m] = { a: Math.floor(rng() * 9), b: Math.floor(rng() * 9) };
    } else {
      const [, r, m, t] = pick;
      s.loserSlots[r + 1][t] = s.loserSlots[r][m * 2 + side]; s.loserWinnerSide[r + '_' + m] = m * 2 + side;
    }
    adv(); snaps.push(JSON.stringify(s));
  }
  snaps.push(JSON.stringify([B.computeEliminationStandings(s), B.eliminationChampionName(s), B.eliminationEntrants(s), B.eliminationMatches(s)]));
  return snaps;
}

/* Decides a round-robin-shaped state's matches (pool, swiss or plain). */
function decide(rounds, scores, prefix, rng) {
  rounds.forEach((rd, r) => rd.forEach((m, mi) => {
    if (m.a == null || m.b == null || m.winner !== null) return;
    m.winner = rng() < 0.5 ? 0 : 1;
    if (rng() < 0.6) scores[prefix + 'rr' + r + '_' + mi] = { a: Math.floor(rng() * 9), b: Math.floor(rng() * 9) };
  }));
}

let seed = 1;
for (let n = 1; n <= 40; n++) for (const mode of MODES) {
  const label = `n=${n} ${mode}`;
  seed++;
  same(label + ' single', ...both(seed, (B, rng) => playElim(B, B.buildBracket('t', names(n), mode), rng, false)));
  if (n >= 2) same(label + ' double', ...both(seed, (B, rng) => playElim(B, B.buildDoubleElimBracket('t', names(n), mode), rng, true)));
  same(label + ' roundrobin', ...both(seed, (B, rng) => {
    const s = B.buildRoundRobin('t', names(n), mode);
    const snap = [JSON.stringify(s)];
    decide(s.rounds, s.scores, '', rng);
    snap.push(JSON.stringify([s, B.computeStandings(s), B.roundRobinComplete(s)]));
    return snap;
  }));
  for (const pools of [1, 2, 3, 4, 5]) for (const adv of [1, 2]) {
    if (n < pools) continue;
    same(`${label} pools=${pools}/${adv}`, ...both(seed, (B, rng) => {
      const s = B.buildPools('t', names(n), mode, pools, adv);
      const snap = [JSON.stringify(s)];
      s.pools.forEach((p, i) => decide(p.rounds, s.scores, 'pool' + i + '_', rng));
      // pools keep scores under 'pool<i>_<key>', where <key> is 'rr..' — rebuild that shape
      snap.push(JSON.stringify([s, s.pools.map((_, i) => B.poolStandingsFor(s, i)), B.poolsComplete(s), B.seedOrderFromPools(s),
        B.bracketScoresView(s), s.pools.map((_, i) => B.poolScoresView(s, i)), B.prefixedHasScores(s, 'pool0_')]));
      return snap;
    }));
  }
  for (const rounds of [1, 3, 5]) {
    same(`${label} swiss=${rounds}`, ...both(seed, (B, rng) => {
      const s = B.buildSwiss('t', names(n), mode, rounds);
      const snap = [JSON.stringify(s)];
      for (let r = 0; r < s.numRounds - 1 && n >= 2; r++) {
        decide([s.rounds[s.rounds.length - 1]], {}, '', rng); // winners
        s.rounds[s.rounds.length - 1].forEach((m, mi) => {
          if (m.a != null && m.b != null && rng() < 0.6) s.scores['rr' + (s.rounds.length - 1) + '_' + mi] = { a: Math.floor(rng() * 9), b: Math.floor(rng() * 9) };
        });
        s.rounds.push(B.buildSwissRound(s));
        snap.push(JSON.stringify([s.rounds[s.rounds.length - 1], B.computeSwissStandings(s), B.swissPastOpponents(s), B.swissByeCounts(s)]));
      }
      return snap;
    }));
  }
}
same('shuffle', ...both(99, (B) => B.shuffle(names(30))));
same('nextPowerOf2', [1, 2, 3, 5, 8, 9, 33].map(OLD.nextPowerOf2), [1, 2, 3, 5, 8, 9, 33].map(NEW.nextPowerOf2));
// setRng is P3's one addition; the P4 names (re-deciding, draws) are new functions beside the old surface,
// which has to stay whole. The old bodies they touch (the two standings) are held below, with no draws.
const P4_NEW = ['dependentsOf', 'redecideElimination', 'vacateSlot', 'resultFromScores', 'setMatchResult', 'swissReopen', 'poolsReopen'];
same('same surface', Object.keys(OLD).sort(), Object.keys(NEW).filter((k) => k !== 'setRng' && !P4_NEW.includes(k)).sort());
same('P4 additions present', P4_NEW.slice().sort(), Object.keys(NEW).filter((k) => P4_NEW.includes(k)).sort());

console.log(`${checks} checks, ${failures} differences`);
process.exit(failures ? 1 : 0);
