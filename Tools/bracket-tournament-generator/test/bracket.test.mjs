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
  },
  're-deciding gives the match to the loser, and clears every later decision that had used the old winner': (B) => {
    const s = B.buildBracket('t', names(8), 'asEntered'); playSingle(B, s);
    const dep = B.dependentsOf(s, 0, 0);
    const out = B.redecideElimination(s, s.scores, 0, 0);
    return J(dep) === J([[2, 0], [3, 0]]) && out.ok && J(out.cleared) === J([[2, 0], [3, 0]]) &&
      s.slots[1][0] === 'P2' && s.winnerSide['1_0'] === 1 && s.slots[2][0] === false && s.slots[3][0] === false &&
      s.slots[1][1] === 'P3' && s.slots[2][1] === 'P5';
  },
  're-deciding clears the scores of what it cleared and leaves other matches alone': (B) => {
    const s = B.buildBracket('t', names(8), 'asEntered'); playSingle(B, s);
    ['0_0', '1_0', '2_0', '0_1'].forEach((k) => { s.scores[k] = { a: 5, b: 1 }; });
    B.redecideElimination(s, s.scores, 0, 0);
    return J(Object.keys(s.scores)) === J(['0_1']);
  },
  're-deciding a match whose next round is undecided clears nothing, and refuses a bye or an undecided match': (B) => {
    const s = B.buildBracket('t', names(5), 'asEntered'); B.autoAdvance(s);
    s.slots[1][3] = 'P4'; s.winnerSide['1_3'] = 6;
    const flip = B.redecideElimination(s, s.scores, 0, 3);
    const bye = B.redecideElimination(s, s.scores, 0, 0);
    const open = B.redecideElimination(B.buildBracket('t', names(4), 'asEntered'), {}, 0, 0);
    return flip.ok && flip.cleared.length === 0 && s.slots[1][3] === 'P5' && !bye.ok && !open.ok && s.slots[1][0] === 'P1';
  },
  'a vacated slot and everything decided from it are cleared': (B) => {
    const s = B.buildBracket('t', names(4), 'asEntered'); playSingle(B, s);
    s.scores['0_0'] = { a: 2, b: 1 };
    const gone = B.vacateSlot(s, s.scores, '', 0, 0);
    return J(gone) === J([[1, 0], [2, 0]]) && s.slots[0][0] === false && s.slots[1][0] === false && s.slots[2][0] === false &&
      s.slots[1][1] === 'P3' && !('0_0' in s.scores);
  },
  'a tied score is a draw only when draws are allowed': (B) =>
    B.resultFromScores(3, 3, true) === 'draw' && B.resultFromScores(3, 3, false) === null &&
    B.resultFromScores(3, 2, false) === 0 && B.resultFromScores(2, 3, true) === 1 && B.resultFromScores('x', 1, true) === null,
  'a draw counts played for both, is worth half a win in the order, and adds no column to a state without one': (B) => {
    const rr = B.buildRoundRobin('t', ['a', 'b', 'c'], 'asEntered');
    const set = (x, y, w) => rr.rounds.forEach((r) => r.forEach((m) => { if (m.a === x && m.b === y || m.a === y && m.b === x) m.winner = w === 'draw' ? 'draw' : (m.a === w ? 0 : 1); }));
    set('a', 'b', 'draw'); set('a', 'c', 'a'); set('b', 'c', 'draw');
    const rows = B.computeStandings(rr);
    const plain = B.buildRoundRobin('t', ['a', 'b'], 'asEntered'); plain.rounds[0][0].winner = 0;
    const sw = B.buildSwiss('t', ['a', 'b', 'c', 'd'], 'asEntered', 2);
    sw.rounds[0][0].winner = 'draw'; sw.rounds[0][1].winner = 0;
    const srows = B.computeSwissStandings(sw);
    return J(rows.map((x) => [x.name, x.w, x.d || 0, x.l, x.played])) === J([['a', 1, 1, 0, 2], ['b', 0, 2, 0, 2], ['c', 0, 1, 1, 2]]) &&
      B.computeStandings(plain).every((x) => !('d' in x)) &&
      J(srows.map((x) => x.name)) === J(['b', 'a', 'c', 'd']) && srows.find((x) => x.name === 'c').d === 1 &&
      B.roundRobinComplete(Object.assign({}, rr));
  },
  'changing a result drops a score that says otherwise': (B) => {
    const sc = { rr0_0: { a: 5, b: 1 } }, m = { a: 'x', b: 'y', winner: 0 };
    B.setMatchResult(m, sc, 'rr0_0', 0);
    const kept = 'rr0_0' in sc;
    B.setMatchResult(m, sc, 'rr0_0', 1);
    return kept && m.winner === 1 && !('rr0_0' in sc);
  },
  'swiss: reopening a round drops the later rounds and their scores': (B) => {
    const s = B.buildSwiss('t', names(4), 'asEntered', 3);
    s.rounds[0].forEach((m) => { m.winner = 0; }); s.rounds.push(B.buildSwissRound(s));
    s.scores.rr0_0 = { a: 3, b: 1 }; s.scores.rr1_0 = { a: 3, b: 1 };
    const n = B.swissReopen(s, 0), again = B.swissReopen(s, 0);
    return n === 1 && again === 0 && s.rounds.length === 1 && J(Object.keys(s.scores)) === J(['rr0_0']);
  },
  'pools: reopening throws away the drawn bracket and only its scores': (B) => {
    const s = B.buildPools('t', names(4), 'asEntered', 2, 1);
    s.bracket = B.buildBracket('b', ['P1', 'P2'], 'ranked');
    s.scores = { pool0_rr0_0: { a: 1, b: 0 }, br_0_0: { a: 1, b: 0 } };
    const had = B.poolsReopen(s), none = B.poolsReopen(s);
    return had && !none && s.bracket === null && J(Object.keys(s.scores)) === J(['pool0_rr0_0']);
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
  'standings order: wins, then point difference': ['(y.w + (y.d || 0) / 2) - (x.w + (x.d || 0) / 2) || y.diff', '(x.w + (x.d || 0) / 2) - (y.w + (y.d || 0) / 2) || y.diff'],
  'pools deal in a snake': ['(numPools - 1 - posInCycle)', '(posInCycle)'],
  'double elimination: losers bracket shape for 8': ['Math.pow(2, i + 1)', 'Math.pow(2, i)'],
  'double elimination: round-1 losers drop into the losers bracket': ['var loser0 = wbLoserAt(0, m0);', 'var loser0 = false;'],
  'swiss round 1 splits the field; an odd field byes the last entrant': ['arr[i + half]', 'arr[i + 1]'],
  'swiss never repeats a bye while another player has had none': ['(byeCounts[p] || 0) === minByes', 'true'],
  're-deciding gives the match to the loser, and clears every later decision that had used the old winner': ['var cleared = clearBelow(obj, scores, prefix, r + 1, m);', 'var cleared = [];'],
  're-deciding clears the scores of what it cleared and leaves other matches alone': ['(c[0] - 1)', 'c[0]'],
  're-deciding a match whose next round is undecided clears nothing, and refuses a bye or an undecided match': ["if (typeof a !== 'string' || typeof b !== 'string') return { ok: false, reason: 'a bye or an empty side' };", ''],
  'a vacated slot and everything decided from it are cleared': ['    obj.slots[k][i] = false;\n    return cleared;', '    return cleared;'],
  'a tied score is a draw only when draws are allowed': ["return draws ? 'draw' : null;", "return 'draw';"],
  'a draw counts played for both, is worth half a win in the order, and adds no column to a state without one': ['records[nm].d = (records[nm].d || 0) + 1; records[nm].played++;', 'records[nm].d = (records[nm].d || 0) + 1;'],
  'changing a result drops a score that says otherwise': ['!== result) delete scores[scoreKey];', '!== result) scores[scoreKey] = sc;'],
  'swiss: reopening a round drops the later rounds and their scores': ['+mt[1] > roundIdx', '+mt[1] < 0'],
  'pools: reopening throws away the drawn bracket and only its scores': ["k.indexOf('br_') === 0", "k.indexOf('zz_') === 0"]
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
