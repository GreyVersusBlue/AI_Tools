// bracket.test.mjs — pure-logic tests for _shared/bracket.js (Path 13 P3):
// seeding, single and double elimination, round robin, pools, Swiss and the
// standings built on them.
//
//   node Tools/bracket-tournament-generator/test/bracket.test.mjs   (or: npm run test:bracket-engine)
//
// bracket.js is a classic script that publishes window.Bracket, so it runs here
// in a vm context, as grouping.js's suite does. Every check is run against the
// real file and then against a copy with the rule it guards broken on purpose
// (MUTANTS), which it must fail: a check that cannot fail is not counted.
// Parity with 020's page code is bracket-parity.test.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', '..', '..', '_shared', 'bracket.js'), 'utf8');
function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.Bracket;
}
const J = (x) => JSON.stringify(x);
const names = (n) => Array.from({ length: n }, (_, i) => 'P' + (i + 1));

/* Plays every decidable match of a single-elimination state, the lower slot
   winning; returns the number played. */
function playSingle(B, s) {
  let played = 0, changed = true;
  while (changed) {
    changed = false;
    B.autoAdvance(s);
    for (let r = 0; r < s.slots.length - 1; r++) {
      for (let m = 0; m < s.slots[r + 1].length; m++) {
        const a = s.slots[r][m * 2], b = s.slots[r][m * 2 + 1];
        if (s.slots[r + 1][m] === false && a && b) {
          s.slots[r + 1][m] = a; s.winnerSide[(r + 1) + '_' + m] = m * 2; played++; changed = true;
        }
      }
    }
  }
  return played;
}

const CHECKS = {
  'seed order protects the top seeds': (B) =>
    J(B.standardSeedOrder(8)) === J([1, 8, 4, 5, 2, 7, 3, 6]) &&
    B.standardSeedOrder(16).every((s, i, a) => i % 2 || s + a[i + 1] === 17),
  'next power of two is at least two': (B) =>
    B.nextPowerOf2(5) === 8 && B.nextPowerOf2(8) === 8 && B.nextPowerOf2(1) === 2,
  'ranked bracket puts byes on the weakest seeds, never two in one match': (B) => {
    for (let n = 3; n <= 33; n++) {
      const r0 = B.buildBracket('t', names(n), 'ranked').slots[0];
      for (let m = 0; m < r0.length; m += 2) if (r0[m] === null && r0[m + 1] === null) return false;
      if (r0.filter((x) => x === null).length !== r0.length - n) return false;
      if (r0.includes('P' + n) === false || (n > 2 && r0[0] !== 'P1')) return false;
    }
    return true;
  },
  'later rounds start undecided as false, not null': (B) =>
    J(B.buildBracket('t', names(5), 'asEntered').slots.slice(1)) === J([[false, false, false, false], [false, false], [false]]),
  'byes advance on their own': (B) => {
    const s = B.buildBracket('t', names(5), 'ranked');
    B.autoAdvance(s);
    return s.slots[1].filter(Boolean).length === 3 && s.slots[1].includes('P1');
  },
  'a full single-elimination bracket plays n-1 matches to one champion': (B) => {
    for (let n = 2; n <= 20; n++) {
      const s = B.buildBracket('t', names(n), 'ranked');
      if (playSingle(B, s) !== n - 1) return false;
      if (B.eliminationChampionName(s) !== 'P1') return false;
      const st = B.computeEliminationStandings(s);
      if (st.length !== n || st.reduce((t, r) => t + r.w, 0) !== n - 1) return false;
    }
    return true;
  },
  'random seeding repeats under setRng and uses every name once': (B) => {
    B.setRng(() => 0);
    const a = B.shuffle(['a', 'b', 'c', 'd']);
    B.setRng(null);
    return J(a) === J(['b', 'c', 'd', 'a']);
  },
  'round robin: n-1 rounds (n even), every pair meets once': (B) => {
    for (let n = 2; n <= 12; n++) {
      const s = B.buildRoundRobin('t', names(n), 'asEntered');
      const pad = n + (n % 2);
      if (s.rounds.length !== pad - 1) return false;
      const seen = new Set();
      for (const round of s.rounds) for (const m of round) {
        if (m.a == null || m.b == null) continue;
        const k = [m.a, m.b].sort().join('|');
        if (seen.has(k)) return false;
        seen.add(k);
      }
      if (seen.size !== n * (n - 1) / 2) return false;
    }
    return true;
  },
  'standings order: wins, then point difference': (B) => {
    const s = B.buildRoundRobin('t', ['c', 'a', 'b'], 'asEntered');
    s.rounds.forEach((rd, r) => rd.forEach((m, mi) => {
      if (m.a == null || m.b == null) return;
      m.winner = m.a < m.b ? 0 : 1; s.scores['rr' + r + '_' + mi] = { a: m.winner ? 1 : 5, b: m.winner ? 5 : 1 };
    }));
    return J(B.computeStandings(s).map((x) => [x.name, x.w])) === J([['a', 2], ['b', 1], ['c', 0]]);
  },
  'pools deal in a snake': (B) =>
    J(B.distributeIntoPools([1, 2, 3, 4, 5, 6], 2)) === J([[1, 4, 5], [2, 3, 6]]) &&
    J(B.distributeIntoPools([1, 2, 3, 4, 5], 3)) === J([[1], [2, 5], [3, 4]]),
  'double elimination: losers bracket shape for 8': (B) => {
    const s = B.buildDoubleElimBracket('t', names(8), 'asEntered');
    return J(s.loserSlots.map((x) => x.length)) === J([4, 4, 2, 2, 1]) && s.type === 'double';
  },
  'double elimination: round-1 losers drop into the losers bracket': (B) => {
    const s = B.buildDoubleElimBracket('t', names(8), 'asEntered');
    for (let m = 0; m < 4; m++) { s.slots[1][m] = s.slots[0][m * 2]; s.winnerSide['1_' + m] = m * 2; }
    B.autoAdvanceDouble(s);
    return J(s.loserSlots[0]) === J(['P2', 'P4', 'P6', 'P8']);
  },
  'swiss round 1 splits the field; an odd field byes the last entrant': (B) => {
    const a = B.buildSwiss('t', names(4), 'asEntered', 3).rounds[0];
    const b = B.buildSwiss('t', names(5), 'asEntered', 3).rounds[0];
    return J(a.map((m) => [m.a, m.b])) === J([['P1', 'P3'], ['P2', 'P4']]) &&
      b.length === 3 && b[2].a === 'P5' && b[2].b === null && b[2].winner === 0;
  },
  'swiss never repeats a bye while another player has had none': (B) => {
    const s = B.buildSwiss('t', names(5), 'asEntered', 5);
    for (let r = 0; r < 4; r++) {
      s.rounds[r].forEach((m) => { if (m.winner === null) m.winner = 0; });
      s.rounds.push(B.buildSwissRound(s));
    }
    const counts = B.swissByeCounts(s);
    return Object.values(counts).every((c) => c === 1);
  }
};

/* [description, find, replace]: each find must occur exactly once. */
const MUTANTS = {
  'seed order protects the top seeds': ['next.push(n + 1 - s)', 'next.push(n - s)'],
  'next power of two is at least two': ['return Math.max(p, 2);', 'return p;'],
  'ranked bracket puts byes on the weakest seeds, never two in one match': ['(seedNum <= n)', '(seedNum < n)'],
  'later rounds start undecided as false, not null': ['rounds.push(new Array(count).fill(false));', 'rounds.push(new Array(count).fill(null));'],
  'byes advance on their own': ['if (a && b === null)', 'if (false)'],
  'a full single-elimination bracket plays n-1 matches to one champion': ['winnerRec.w++; winnerRec.played++;', 'winnerRec.played++;'],
  'random seeding repeats under setRng and uses every name once': ['for (var i = a.length - 1; i > 0; i--)', 'for (var i = a.length - 1; i > 1; i--)'],
  'round robin: n-1 rounds (n even), every pair meets once': ['rest.unshift(rest.pop());', ''],
  'standings order: wins, then point difference': ['return y.w - x.w || y.diff - x.diff || x.l - y.l || x.name.localeCompare(y.name);\n    });\n  }\n\n  /* ---------- pools', 'return x.w - y.w || y.diff - x.diff || x.l - y.l || x.name.localeCompare(y.name);\n    });\n  }\n\n  /* ---------- pools'],
  'pools deal in a snake': ['(numPools - 1 - posInCycle)', '(posInCycle)'],
  'double elimination: losers bracket shape for 8': ['Math.pow(2, i + 1)', 'Math.pow(2, i)'],
  'double elimination: round-1 losers drop into the losers bracket': ['var loser0 = wbLoserAt(0, m0);', 'var loser0 = false;'],
  'swiss round 1 splits the field; an odd field byes the last entrant': ['arr[i + half]', 'arr[i + 1]'],
  'swiss never repeats a bye while another player has had none': ['(byeCounts[p] || 0) === minByes', 'true']
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
