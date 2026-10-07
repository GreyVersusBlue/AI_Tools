// smoke-teams-core.mjs — pure-logic tests for bt-teams.js: the parsing and
// cleaning of a bracket's teams-with-members, and the first-round consolation
// bracket (who is in it, how it is paired, how many games it has, who is
// third, who wins it) for every entrant count from 3 to 32.
//
//   node Tools/bracket-tournament-generator/test/smoke-teams-core.mjs   (or: npm run test:bracket-teams-core)
//
// The script is a classic one that publishes a global, so it runs here in a
// vm context. The main bracket below is built and played by this file's OWN
// code (an oracle, not the page's), in both of the page's placements: "as
// entered" (byes spread one to a match from the front) and "ranked" (the
// textbook seed order). The page's autoAdvance is stood in for by `advance`
// below; the page's real one is exercised by smoke-teams.mjs in a browser.
// Random plays take a seeded generator. Every name here is made up.
// BT_TEAMS_FILE names another copy of the module (a deliberately broken one).
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = vm.createContext({});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(process.env.BT_TEAMS_FILE || path.join(here, '..', 'bt-teams.js'), 'utf8'), ctx);
const T = ctx.BtTeams;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log('Bracket / Tournament Generator — teams and the consolation bracket (pure logic)');

/* ---------- an independent main bracket ---------- */
const pow2 = n => { let p = 1; while (p < n) p *= 2; return Math.max(p, 2); };
function seedOrder(size) { let s = [1]; while (s.length < size) { const n = s.length * 2, nx = []; s.forEach(x => { nx.push(x); nx.push(n + 1 - x); }); s = nx; } return s; }
function mainBracket(n, mode) {
  const names = Array.from({ length: n }, (_, i) => 'T' + (i + 1));
  const size = pow2(n), r0 = new Array(size).fill(null);
  if (mode === 'ranked') seedOrder(size).forEach((sd, p) => { r0[p] = sd <= n ? names[sd - 1] : null; });
  else { let i = 0; const byes = size - n; for (let m = 0; m < size / 2; m++) { r0[m * 2] = names[i++]; r0[m * 2 + 1] = m < byes ? null : names[i++]; } }
  const slots = [r0]; for (let c = size; c > 1;) { c /= 2; slots.push(new Array(c).fill(false)); }
  return { names, slots, winnerSide: {}, scores: {} };
}
function advance(s) {                                   // the page's autoAdvance, restated
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < s.slots.length - 1; r++) {
      const round = s.slots[r], next = s.slots[r + 1];
      for (let m = 0; m < next.length; m++) {
        if (next[m] !== false) continue;
        const a = round[m * 2], b = round[m * 2 + 1];
        if (a && b === null) { next[m] = a; s.winnerSide[(r + 1) + '_' + m] = m * 2; changed = true; }
        else if (b && a === null) { next[m] = b; s.winnerSide[(r + 1) + '_' + m] = m * 2 + 1; changed = true; }
      }
    }
  }
}
// plays every undecided game of a bracket (main or consolation), returning the games it played
function playOut(s, rand, onGame) {
  let played = 0, again = true;
  while (again) {
    again = false; advance(s);
    for (let r = 0; r < s.slots.length - 1; r++) {
      const round = s.slots[r], next = s.slots[r + 1];
      for (let m = 0; m < next.length; m++) {
        const a = round[m * 2], b = round[m * 2 + 1];
        if (next[m] !== false || typeof a !== 'string' || typeof b !== 'string') continue;
        const side = rand() < 0.5 ? 0 : 1;
        next[m] = side ? b : a; s.winnerSide[(r + 1) + '_' + m] = m * 2 + side;
        played++; again = true; if (onGame) onGame(r, m, a, b, side);
      }
    }
  }
  return played;
}

/* ---------- 1. every entrant count 3..32, both placements ---------- */
for (const mode of ['asEntered', 'ranked']) {
  for (let n = 3; n <= 32; n++) {
    for (let seed = 1; seed <= 4; seed++) {
      const rand = rng(n * 131 + seed * 7 + (mode === 'ranked' ? 5000 : 0));
      const st = mainBracket(n, mode);
      const tag = `n=${n} ${mode} #${seed}`;
      const size = pow2(n);
      const hadBye = new Set(); const realGames = [];
      for (let m = 0; m < size / 2; m++) {
        const a = st.slots[0][m * 2], b = st.slots[0][m * 2 + 1];
        if (a === null && b) hadBye.add(b); else if (b === null && a) hadBye.add(a); else realGames.push(m);
      }
      const L = n - size / 2;                                    // the oracle's own count of first-round games
      eq(realGames.length, L, `${tag}: first-round game count is n - size/2`);
      eq(T.firstRound(Object.assign({}, st, { slots: st.slots })).length, L, `${tag}: firstRound() counts them`);
      st.consolation = T.fresh(st);
      eq(st.consolation.winnerSide, {}, `${tag}: a new consolation has no results`);
      eq(st.consolation.third, null, `${tag}: and no third-place winner`);
      const lay = T.layout(L);
      eq(lay.feed.length, L, `${tag}: one consolation slot per loser`);
      eq(st.consolation.slots[0].filter(x => x === null).length, pow2(L) - L, `${tag}: consolation byes = size - L`);
      eq(st.consolation.slots[0].length, pow2(L), `${tag}: consolation size`);
      let noTwoByes = true;
      for (let m = 0; m < st.consolation.slots[0].length / 2; m++) if (st.consolation.slots[0][m * 2] === null && st.consolation.slots[0][m * 2 + 1] === null) noTwoByes = false;
      ok(noTwoByes, `${tag}: no consolation game is two byes`);

      // play the main bracket one game at a time, syncing as results arrive
      const losers = []; const loserByMatch = {};
      let sawLoserLater = true;
      for (let guard = 0; guard < 200; guard++) {
        advance(st);
        let did = false;
        outer: for (let r = 0; r < st.slots.length - 1; r++) {
          const round = st.slots[r], next = st.slots[r + 1];
          for (let m = 0; m < next.length; m++) {
            const a = round[m * 2], b = round[m * 2 + 1];
            if (next[m] !== false || typeof a !== 'string' || typeof b !== 'string') continue;
            const side = rand() < 0.5 ? 0 : 1;
            next[m] = side ? b : a; st.winnerSide[(r + 1) + '_' + m] = m * 2 + side;
            if (r === 0) { losers.push(side ? a : b); loserByMatch[m] = side ? a : b; }
            did = true; break outer;
          }
        }
        T.sync(st, advance);
        const placed = st.consolation.slots[0].filter(x => typeof x === 'string');
        if (placed.length !== losers.length) sawLoserLater = false;
        if (!did) break;
      }
      ok(sawLoserLater, `${tag}: each loser is placed as soon as their game is decided, and not before`);
      const inCons = st.consolation.slots[0].filter(x => typeof x === 'string');
      eq([...inCons].sort(), [...losers].sort(), `${tag}: round 0 of the consolation is exactly the first-round losers`);
      eq(new Set(inCons).size, inCons.length, `${tag}: every first-round loser appears once`);
      ok(inCons.every(x => !hadBye.has(x)), `${tag}: nobody who had a first-round bye is in it`);
      eq(inCons.length, L, `${tag}: L losers`);
      realGames.forEach((m, i) => eq(st.consolation.slots[0][lay.feed[i]], loserByMatch[m], `${tag}: game ${m}'s loser sits in the slot for that game, in bracket order`));
      eq(T.consolationWinner(st), L === 1 ? losers[0] : null, `${tag}: the consolation winner is named only when it is known`);

      // consolation play: count the games, and nobody plays themselves
      let selfPlay = false;
      const games = playOut(st.consolation, rand, (r, m, a, b) => { if (a === b) selfPlay = true; });
      ok(!selfPlay, `${tag}: nobody plays themselves`);
      eq(games, L - 1, `${tag}: the consolation has L - 1 games`);
      eq(T.gameCount(L), L - 1, `${tag}: gameCount(L)`);
      const cw = T.consolationWinner(st);
      ok(typeof cw === 'string' && losers.includes(cw), `${tag}: the consolation winner is a first-round loser`);
      let again = false;
      advance(st.consolation); // idempotent
      again = playOut(st.consolation, rand) > 0;
      ok(!again, `${tag}: nothing is left to play`);

      // third place: the semifinal losers
      const semis = T.semiLosers(st);
      eq(semis.length, 2, `${tag}: two semifinals`);
      const real = semis.filter(x => x !== null);
      const tp = T.thirdPlace(st);
      if (n === 3) {
        eq(semis.filter(x => x === null).length, 1, `${tag}: one semifinal is a bye`);
        ok(tp.game === false && tp.place === real[0] && typeof tp.place === 'string', `${tag}: no third-place game; the lone semifinal loser is third`);
        eq(tp.place, cw, `${tag}: with three entrants third place and the consolation winner are the same team`);
      } else {
        eq(real.length, 2, `${tag}: both semifinals were played`);
        ok(tp.game === true && isDeepStrictEqual(tp.players, real) && tp.place === null, `${tag}: a third-place game between the two semifinal losers, undecided`);
        for (const side of [0, 1]) {
          st.consolation.third = side;
          eq(T.thirdPlace(st).place, real[side], `${tag}: third place is the winner (${side}) of that game`);
        }
        st.consolation.third = null;
      }
      const finalists = st.slots[st.slots.length - 2];
      ok(![tp.place].concat(tp.players).some(x => finalists.includes(x) && x === tp.place), `${tag}: third place is not a finalist`);
    }
  }
}

/* ---------- 2. sync is idempotent and order-independent ---------- */
{
  const rand = rng(99);
  const a = mainBracket(11, 'asEntered'); a.consolation = T.fresh(a);
  playOut(a, rand); T.sync(a, advance);
  const once = JSON.stringify(a.consolation);
  T.sync(a, advance);
  eq(JSON.stringify(a.consolation), once, 'sync twice changes nothing');
  const b = mainBracket(11, 'asEntered'); b.consolation = T.fresh(b);
  b.slots = JSON.parse(JSON.stringify(a.slots)); b.winnerSide = JSON.parse(JSON.stringify(a.winnerSide));
  T.sync(b, advance);
  eq(b.consolation.slots[0], a.consolation.slots[0], 'syncing once at the end fills the same slots as syncing after every game');
}

{
  const st = mainBracket(10, 'asEntered'); st.consolation = T.fresh(st);
  playOut(st, rng(3)); T.sync(st, advance);
  const feed = T.layout(T.firstRound(st).length).feed;
  const was = st.consolation.slots[0][feed[0]];
  st.consolation.slots[0][feed[0]] = 'Zed';
  T.sync(st, advance);
  eq(st.consolation.slots[0][feed[0]], 'Zed', 'sync never replaces a slot that already holds a team');
  ok(was !== 'Zed', 'the slot held a real loser before');
}

/* ---------- 3. a bracket with no first-round game, or too few entrants ---------- */
{
  const two = mainBracket(2, 'asEntered');
  eq(T.restore(null, two), null, 'a 2-entrant bracket cannot have a consolation bracket');
  const dbl = mainBracket(8, 'asEntered'); dbl.type = 'double';
  eq(T.restore(null, dbl), null, 'only single elimination has one');
  const four = mainBracket(4, 'asEntered');
  ok(T.restore(null, four) !== null, 'a 4-entrant bracket can');
  eq(T.firstRound(four).length, 2, 'four entrants: two first-round games');
}

/* ---------- 4. restore(): what arrives is made safe ---------- */
{
  const st = mainBracket(6, 'asEntered');
  const good = T.fresh(st);
  good.third = 1; good.winnerSide['1_0'] = 0;
  const kept = T.restore(good, st);
  eq(kept.third, 1, 'restore keeps a good third-place side');
  eq(kept.winnerSide, { '1_0': 0 }, 'restore keeps a good winnerSide');
  eq(kept.slots, good.slots, 'restore keeps a good shape');
  const shaped = (mut) => { const c = T.fresh(st); mut(c); return T.restore(c, st); };
  const freshOne = T.fresh(st);
  eq(shaped(c => { c.slots.pop(); }).slots, freshOne.slots, 'a consolation with a round missing is rebuilt');
  eq(shaped(c => { c.slots[0].push(false); }).slots, freshOne.slots, 'a consolation with a slot too many is rebuilt');
  eq(shaped(c => { c.slots[0][0] = 7; }).slots, freshOne.slots, 'a number in a slot is rebuilt away');
  eq(shaped(c => { c.slots[0][0] = null; }).slots, freshOne.slots, 'a bye where a loser goes is rebuilt away');
  eq(T.restore('junk', st).slots, freshOne.slots, 'a string is rebuilt');
  eq(T.restore({ slots: 5 }, st).slots, freshOne.slots, 'slots that are not arrays are rebuilt');
  eq(shaped(c => { c.third = 'x'; }).third, null, 'a bad third-place side is dropped');
  eq(shaped(c => { c.third = 2; }).third, null, 'a third-place side of 2 is dropped');
  eq(shaped(c => { c.winnerSide = { 'a': 1, '1_0': 'z', '1_1': 1 }; }).winnerSide, { '1_1': 1 }, 'only well-formed winnerSide entries are kept');
  const lone = mainBracket(3, 'asEntered');
  eq(T.fresh(lone).slots, [[false, null], [false]], 'three entrants: one loser, a bye, nothing to play');
}

/* ---------- 5. parseTeams ---------- */
{
  let r = T.parseTeams('Red Fox: Ann Lee, Bo Chan, Cy Dunn\nBlue Jay\nGreen Owl: Di Ray; Ed Fox\n');
  eq(r.names, ['Red Fox', 'Blue Jay', 'Green Owl'], 'team names, one a line');
  eq(r.members, { 'Red Fox': ['Ann Lee', 'Bo Chan', 'Cy Dunn'], 'Green Owl': ['Di Ray', 'Ed Fox'] }, 'members split on commas and semicolons; a team with no colon has none');
  r = T.parseTeams('A\nB\n');
  eq(r.members, undefined, 'no members at all gives no members field');
  eq(r.names, ['A', 'B'], 'plain names are plain entrants');
  r = T.parseTeams('  A : x , y ,, x \n\n:orphan\nB:\n C : \n');
  eq(r.names, ['A', 'B', 'C'], 'blank lines and a line with no name are skipped; a colon with nothing after is a team with no members');
  eq(r.members, { A: ['x', 'y'] }, 'members are trimmed, empty ones dropped, repeats dropped');
  r = T.parseTeams('A: x\nA: y, x');
  eq(r.names, ['A', 'A'], 'a repeated team name is two entrants, as today');
  eq(r.members, { A: ['x', 'y'] }, 'a repeated team name merges its members');
  r = T.parseTeams('Edge: ' + Array.from({ length: 60 }, (_, i) => 'm' + i).join(', '));
  eq(r.members.Edge.length, T.MAX_MEMBERS, 'members are capped');
  r = T.parseTeams('Long: ' + 'x'.repeat(200));
  eq(r.members.Long[0].length, T.MAX_MEMBER_LEN, 'a long member name is cut');
  r = T.parseTeams('__proto__: a, b\nconstructor: c');
  eq(Object.keys(r.members).sort(), ['__proto__', 'constructor'], 'names that are Object.prototype keys are ordinary teams');
  eq(({}).a, undefined, 'and nothing leaked onto Object.prototype');
  eq(T.parseTeams('Team: a: b, c').members, { Team: ['a: b', 'c'] }, 'only the first colon ends the name');
  eq(T.parseTeams('Ünï: Zoë, 李').members, { 'Ünï': ['Zoë', '李'] }, 'unicode survives');
  eq(T.parseTeams('').names, [], 'empty text');
  eq(T.parseTeams(null).names, [], 'null text');
  eq(T.parseTeams('<b>x</b>: <i>y</i>').members, { '<b>x</b>': ['<i>y</i>'] }, 'markup is kept as text (the page only ever writes it with textContent)');
}

/* ---------- 6. cleanMembers / entrantNames ---------- */
{
  const names = ['A', 'B', 'C'];
  eq(T.cleanMembers({ A: ['x', 'x', ' y '], B: [], C: 'nope', D: ['z'] }, names), { A: ['x', 'y'] }, 'only listed teams, only strings, no repeats, no empties');
  eq(T.cleanMembers({ A: [1, null, {}, 'ok'] }, names), { A: ['ok'] }, 'non-strings are dropped');
  eq(T.cleanMembers(['x'], names), undefined, 'an array is not a members map');
  eq(T.cleanMembers(null, names), undefined, 'null');
  eq(T.cleanMembers('x', names), undefined, 'a string');
  eq(T.cleanMembers({}, names), undefined, 'empty');
  eq(T.cleanMembers(JSON.parse('{"__proto__": ["p"]}'), ['__proto__']), JSON.parse('{"__proto__": ["p"]}'), 'a parsed own __proto__ key is a team');
  eq(T.cleanMembers(JSON.parse('{"__proto__": ["p"]}'), ['A']), undefined, 'and is not read as a prototype for another name');
  ok(T.hasMembers({ A: ['x'] }) && !T.hasMembers({}) && !T.hasMembers(undefined) && !T.hasMembers(null), 'hasMembers');
  eq(T.entrantNames({ slots: [['A', null, 'B', 'A']] }), ['A', 'B'], 'entrants of an elimination bracket, once each');
  eq(T.entrantNames({ players: ['P', 'Q'], rounds: [] }), ['P', 'Q'], 'entrants of a round robin');
  eq(T.entrantNames({ pools: [{ players: ['A'] }, { players: ['B'] }] }), ['A', 'B'], 'entrants of pools');
  eq(T.entrantNames(null), [], 'no bracket');
}

console.log(`\n${failed ? 'FAILED' : 'passed'}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
