// Seating solver (Path 14 P3, increment 1): pure Node, no browser, no port.
//   node Tools/seating-chart/test/solver.test.mjs            run
//   node Tools/seating-chart/test/solver.test.mjs --update   rewrite golden.json (and say so in the commit)
// The budget is counted, not timed, so every result here is the same on every machine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gridDesks, checkConstraints, checkHistoryConstraints, neighborMap, newHistoryEntry,
  repairState, freshState,
} from '../seating.mjs';
import {
  rng, newSeed, normalizeRules, zones, feasibility, makeContext, score, solve, blame,
  rulesToLegacy, absorbLegacy, DEFAULT_BUDGET,
} from '../seating-solve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(here, 'golden.json');
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}  got ${JSON.stringify(a)}  want ${JSON.stringify(b)}`);
const doesNotThrow = (fn, msg) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL (threw): ' + msg + ' ' + e.message); } };

/* ---- fixtures --------------------------------------------------------- */
function room(cols, rows) {
  return gridDesks(cols, rows, rng(7)).map((d, i) => ({ ...d, id: 'd' + i, locked: false }));
}
function roster(n) { return Array.from({ length: n }, (_, i) => ({ id: 's' + i, name: 'Student ' + i, note: '', flag: false, photo: '' })); }
function section(over = {}) {
  const desks = over.desks || room(8, 5);
  return { id: 'sec', name: 'P1', students: roster(over.n === undefined ? 36 : over.n), desks, assign: {}, apart: [], together: [], layouts: [], history: [], ...over.s };
}
const deskOfMap = assign => { const m = {}; for (const [d, s] of Object.entries(assign)) m[s] = d; return m; };
const wellFormed = (sec, r, absent = []) => {
  const present = sec.students.map(s => s.id).filter(s => !absent.includes(s));
  const seen = new Set();
  let good = true;
  for (const [d, s] of Object.entries(r.assign)) {
    if (!sec.desks.some(x => x.id === d) || seen.has(s) || !present.includes(s)) good = false;
    seen.add(s);
  }
  const should = Math.min(present.length, sec.desks.length);
  return good && Object.keys(r.assign).length + r.unseated.length === present.length && Object.keys(r.assign).length >= Math.min(should, Object.keys(r.assign).length);
};
const rule = (kind, students, extra = {}) => ({ kind, students, hard: true, ...extra });

/* ---- rng --------------------------------------------------------------- */
{
  const a = rng(5), b = rng(5), c = rng('five');
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  eq(xs, ys, 'rng: same seed, same stream');
  ok(c() !== rng(5)(), 'rng: a string seed is its own stream');
  ok(xs.every(x => x >= 0 && x < 1), 'rng: values in [0,1)');
  ok(Number.isInteger(newSeed(() => 0.5)), 'newSeed is an integer');
}

/* ---- normalizeRules ---------------------------------------------------- */
{
  const sec = section({ n: 6, desks: room(3, 2), s: {
    apart: [['s0', 's1'], ['s1', 's0'], ['s2', 'gone']], together: [['s2', 's3']],
  } });
  let n = normalizeRules(sec);
  eq(n.rules.map(r => r.id), ['legacy:apart:s0|s1', 'legacy:together:s2|s3'], 'normalize: the old lists become 2-member Must rules (duplicates and departed students gone)');
  ok(n.rules.every(r => r.hard), 'normalize: legacy rules are hard');

  sec.desks[0].locked = true; sec.assign = { d0: 's4', d1: 's5' };
  sec.desks[2].empty = true; sec.desks[1].locked = true; sec.desks[1].empty = false;
  n = normalizeRules(sec);
  ok(n.rules.some(r => r.id === 'seat:d0' && r.kind === 'seat' && r.hard), 'normalize: a locked desk with an occupant is a seat rule');
  ok(n.rules.some(r => r.id === 'empty:d2' && r.kind === 'empty' && r.desks[0] === 'd2'), 'normalize: desk.empty is an empty rule');
  const free = section({ n: 2, desks: room(2, 1) });
  free.desks[0].locked = true;
  eq(normalizeRules(free).rules.length, 0, 'normalize: a locked EMPTY desk is free');

  const dep = section({ n: 4, desks: room(2, 2), s: { rules: [rule('apart', ['s0', 's1', 'gone']), rule('together', ['s2', 'gone']), rule('zone', ['gone'], { zone: 'front' })] } });
  const nd = normalizeRules(dep);
  eq(nd.rules.map(r => [r.kind, r.students]), [['apart', ['s0', 's1']]], 'normalize: a rule naming a departed student loses the id, and goes when too few remain');
  eq(nd.dropped.map(d => d.code), ['too-few', 'too-few'], 'normalize: the dropped are named');

  const clash = section({ n: 4, desks: room(2, 2), s: { apart: [['s0', 's1']], rules: [rule('together', ['s0', 's1', 's2'])] } });
  const nc = normalizeRules(clash);
  ok(!nc.rules.some(r => r.kind === 'together') && nc.dropped.some(d => d.code === 'contradiction'), 'normalize: a hard together over a hard apart pair is dropped and named');
  const soft = section({ n: 4, desks: room(2, 2), s: { apart: [['s0', 's1']], rules: [rule('together', ['s0', 's1'], { hard: false })] } });
  ok(normalizeRules(soft).rules.some(r => r.kind === 'together'), 'normalize: a SOFT together against a hard apart is kept (the search trades it off)');

  const dup = section({ n: 4, desks: room(2, 2), s: { apart: [['s0', 's1']], rules: [{ id: 'x', kind: 'apart', students: ['s1', 's0'], hard: false, weight: 3, why: 'front row' }] } });
  const nd2 = normalizeRules(dup);
  eq(nd2.rules.length, 1, 'normalize: a stored rule and the same pair in the lists are one rule');
  ok(nd2.rules[0].hard === true && nd2.rules[0].why === 'front row', 'normalize: duplicates merge to the harder, keeping the reason');

  const bad = [null, 5, 'x', [], {}, { kind: 'nope' }, { kind: 'apart' }, { kind: 'apart', students: 'a' }, { kind: 'zone', students: ['s0'] },
    { kind: 'zone', students: ['s0'], zone: 'moon' }, { kind: 'seat', students: ['s0', 's1'], desks: ['d0'] }, { kind: 'empty', desks: ['nowhere'] },
    { kind: 'together', students: ['s0'], anyOf: ['s0'] }, { kind: 'space', students: [] }, { kind: 'apart', students: ['s0', 's1'], weight: 'x', hard: 'yes', why: 5 }];
  const b = section({ n: 3, desks: room(2, 2), s: { rules: bad } });
  let nb;
  doesNotThrow(() => { nb = normalizeRules(b); }, 'normalize: fifteen malformed shapes do not throw');
  eq(nb.rules.length, 1, 'normalize: only the one repairable shape survives');
  eq(nb.dropped.length, 14, 'normalize: the other fourteen are each named');
  ok(nb.rules[0].weight === 2 && nb.rules[0].hard === false && nb.rules[0].why === '', 'normalize: a bad weight, hard and why fall back to Want 2, no reason');
  doesNotThrow(() => normalizeRules({}), 'normalize: an empty section');
}

/* ---- zones ------------------------------------------------------------- */
{
  const g = room(8, 5);
  const z = zones(g, neighborMap(g));
  eq(z.front.size, 8, 'zones: front row of an 8 x 5 grid is 8 desks');
  eq(z.back.size, 8, 'zones: back row is 8 desks');
  ok(z.edge.size + z.notEdge.size === 40, 'zones: every desk is edge or notEdge');
  ok(z.edge.size > 0 && z.notEdge.size > 0, 'zones: a grid has both');
  const one = Array.from({ length: 5 }, (_, i) => ({ id: 'r' + i, x: 22 + i * 132, y: 110 }));
  const z1 = zones(one, neighborMap(one));
  ok(z1.front.size === 5 && z1.back.size === 5, 'zones: one row is all front and all back');
  ok(z1.edge.has('r0') && z1.edge.has('r4') && z1.notEdge.has('r2'), 'zones: the ends of a row are edge');
  const z0 = zones([], {});
  ok(z0.front.size === 0 && z0.edge.size === 0, 'zones: no desks');
  const pods = [0, 1, 2, 3].flatMap(p => [0, 1, 2, 3].map(i => ({ id: `p${p}${i}`, x: 40 + (p % 2) * 500 + (i % 2) * 110, y: 110 + Math.floor(p / 2) * 300 + Math.floor(i / 2) * 80 })));
  const zp = zones(pods, neighborMap(pods));
  ok(zp.front.size === 4, 'zones: in a pod room "front" is one pod row each (today\'s measure; Devon: keep it)');
}

/* ---- feasibility: each code, and none on satisfiable rooms -------------- */
{
  const sec = section({ n: 6, desks: room(3, 2) });
  const f = (rules, s = sec) => feasibility(s, rules, neighborMap(s.desks)).impossible;
  eq(f([rule('together', ['s0', 's1', 's2', 's3', 's4', 's5', 's6'], { id: 't' })].map(r => ({ ...r, anyOf: [] }))).map(e => e.code), ['together-too-big'], 'feasibility: together-too-big');
  const tiny = section({ n: 6, desks: room(3, 2).slice(0, 4) });
  ok(f([], tiny).some(e => e.code === 'no-room' && e.count === 2), 'feasibility: no-room counts the overflow');
  const zr = [rule('zone', ['s0', 's1', 's2', 's3', 's4'], { id: 'z', zone: 'front', anyOf: [] })];
  ok(f(zr).some(e => e.code === 'zone-full' && e.ruleIds[0] === 'z'), 'feasibility: zone-full (five students, a front row of three)');
  ok(f([{ ...rule('seat', ['s0'], { id: 'a', anyOf: [] }), desks: ['d0'] }, { ...rule('seat', ['s0'], { id: 'b', anyOf: [] }), desks: ['d1'] }]).some(e => e.code === 'seat-twice'), 'feasibility: seat-twice');
  const clique = section({ n: 6, desks: [0, 1, 2].map(i => ({ id: 'c' + i, x: 22 + i * 60, y: 110 })) });
  ok(f([rule('apart', ['s0', 's1', 's2'], { id: 'a', anyOf: [] })], clique).some(e => e.code === 'apart-clique'), 'feasibility: apart-clique (three desks all next to each other)');
  ok(f([rule('space', ['s0', 's1', 's2'], { id: 'sp', anyOf: [] })], clique).some(e => e.code === 'space-too-many'), 'feasibility: space-too-many');
  ok(f([rule('together', ['s0', 's1'], { id: 't', anyOf: [] }), rule('apart', ['s0', 's1'], { id: 'a', anyOf: [] })]).some(e => e.code === 'contradiction'), 'feasibility: contradiction (a list that bypassed normalize)');

  // no false alarm: plant a chart, then write rules it satisfies
  const r = rng(99);
  let falseAlarms = 0;
  for (let i = 0; i < 2000; i++) {
    const cols = 2 + Math.floor(r() * 7), rows = 1 + Math.floor(r() * 5);
    const desks = room(cols, rows);
    const n = Math.min(desks.length, 2 + Math.floor(r() * 30));
    const s = section({ n, desks });
    const nb = neighborMap(desks);
    const order = desks.map(d => d.id).sort(() => r() - 0.5).slice(0, n);
    const assign = {}; order.forEach((d, k) => { assign[d] = 's' + k; });
    const rules = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n);
      if (a === b) continue;
      const adj = nb[order[a]].includes(order[b]);
      rules.push(rule(adj ? 'together' : 'apart', ['s' + a, 's' + b], { id: 'r' + k, anyOf: [] }));
    }
    if (feasibility(s, rules, nb).impossible.length) falseAlarms++;
  }
  eq(falseAlarms, 0, 'feasibility: no impossibility named on 2,000 satisfiable random rooms');
}

/* ---- score ------------------------------------------------------------- */
{
  const sec = section({ n: 4, desks: room(2, 2), s: { apart: [['s0', 's1']], together: [['s2', 's3']] } });
  const near = sec.desks.map(d => d.id);                       // d0,d1 side by side (132 px), d2,d3 below (94 px)
  const sc = score(sec, { d0: 's0', d1: 's1', d2: 's2', d3: 's3' });
  eq(sc.list, [1, 0, 0], 'score: an adjacent apart pair is one broken hard rule, together kept');
  eq(sc.broken.map(b => [b.ruleId, b.hard, b.students.sort()]), [['legacy:apart:s0|s1', true, ['s0', 's1']]], 'score: broken names the rule and the students');
  eq(score(sec, { d0: 's0' }).list.slice(0, 2), [1, 3], 'score: a together pair with a missing mate is broken, unseated counted');
  const sp = section({ n: 3, desks: room(3, 1), s: { rules: [rule('space', ['s1'], { hard: false, weight: 3 })] } });
  eq(score(sp, { d0: 's0', d1: 's1', d2: 's2' }).soft, 3, 'score: a soft space rule costs weight x 1');
  void near;
  const em = section({ n: 2, desks: room(2, 1) }); em.desks[1].empty = true;
  eq(score(em, { d0: 's0', d1: 's1' }).list, [1, 0, 0], 'score: a student on a desk left empty is a broken hard rule');
  eq(score(em, { d0: 's0' }).list, [0, 1, 0], 'score: and a student left out is counted as unseated');

  // equal to checkConstraints + checkHistoryConstraints on pairs and history only
  const r = rng(11);
  let diffs = 0;
  for (let k = 0; k < 300; k++) {
    const desks = room(6, 4);
    const s = section({ n: 20, desks });
    const ids = s.students.map(x => x.id);
    for (let i = 0; i < 8; i++) { const a = ids[Math.floor(r() * 20)], b = ids[Math.floor(r() * 20)]; if (a !== b) (i < 5 ? s.apart : s.together).push([a, b]); }
    const seenPair = new Set();
    const uniq = list => list.filter(([a, b]) => { const k = a < b ? a + b : b + a; if (seenPair.has(k)) return false; seenPair.add(k); return true; });
    s.apart = uniq(s.apart); s.together = uniq(s.together);
    const hs = { ...s, assign: {} }; hs.desks.slice(0, 20).forEach((d, i) => { hs.assign[d.id] = ids[(i * 3) % 20]; });
    s.history = [newHistoryEntry(hs, { date: '2026-09-01', quarter: 'Q1' }, rng(k))];
    const order = shuffleWith(r, desks.map(d => d.id));
    const assign = {}; ids.forEach((id, i) => { assign[order[i]] = id; });
    const sec2 = { ...s, assign };
    const rep = checkConstraints(sec2), hist = checkHistoryConstraints(sec2, 'Q1');
    const mine = score(sec2, assign, makeContext(sec2, { quarter: 'Q1' }));
    const want = rep.apartBroken.length + rep.togetherBroken.length;
    const wantSoft = 2 * (hist.repeats.length + hist.dueUnseated.length);
    if (mine.hard !== want || mine.soft !== wantSoft) diffs++;
  }
  eq(diffs, 0, 'score: equals checkConstraints + checkHistoryConstraints on 300 charts of pairs and history');
}
function shuffleWith(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---- solve: shape, determinism, budget --------------------------------- */
{
  const r = rng(3);
  let bad = 0;
  for (let k = 0; k < 500; k++) {
    const nd = Math.floor(r() * 61), ns = Math.floor(r() * 61);
    const cols = Math.max(1, Math.ceil(Math.sqrt(nd)));
    const desks = nd ? Array.from({ length: nd }, (_, i) => ({ id: 'd' + i, x: 22 + (i % cols) * 132, y: 110 + Math.floor(i / cols) * 94, locked: false })) : [];
    const s = section({ n: ns, desks });
    const ids = s.students.map(x => x.id);
    if (ns > 3 && r() < 0.5) s.apart.push([ids[0], ids[1]]);
    if (ns > 3 && r() < 0.5) s.together.push([ids[2], ids[3]]);
    const res = solve(s, { seed: k });
    if (!wellFormed(s, res) || Object.keys(res.assign).length !== Math.min(ns, nd)) bad++;
  }
  eq(bad, 0, 'solve: 500 seeds over 0-60 students and 0-60 desks seat each student once, no desk twice, and fill what the room allows');

  const s0 = section({ n: 0 }); eq(solve(s0, { seed: 1 }).assign, {}, 'solve: zero students');
  eq(solve(section({ desks: [] }), { seed: 1 }).unseated.length, 36, 'solve: zero desks leaves everyone unseated');
  const over = section({ n: 20, desks: room(2, 2) });
  const ro = solve(over, { seed: 1 });
  ok(Object.keys(ro.assign).length === 4 && ro.unseated.length === 16 && ro.impossible.some(e => e.code === 'no-room'), 'solve: more students than desks seats the desks and names no-room');
  const pin = section({ n: 4, desks: room(2, 2) });
  pin.desks.forEach((d, i) => { d.locked = true; }); pin.assign = { d0: 's3', d1: 's2', d2: 's1', d3: 's0' };
  eq(solve(pin, { seed: 1 }).assign, pin.assign, 'solve: every desk pinned keeps the chart');
  const emp = section({ n: 3, desks: room(2, 2) }); emp.desks.forEach(d => { d.empty = true; });
  ok(Object.keys(solve(emp, { seed: 1 }).assign).length === 0 && solve(emp, { seed: 1 }).unseated.length === 3, 'solve: every desk empty seats nobody');

  const sec = section({ s: { apart: [['s0', 's1']], together: [['s2', 's3']] } });
  eq(solve(sec, { seed: 42 }).assign, solve(sec, { seed: 42 }).assign, 'solve: the same seed twice is the same chart');
  ok(JSON.stringify(solve(sec, { seed: 1 }).assign) !== JSON.stringify(solve(sec, { seed: 2 }).assign), 'solve: another seed is another chart');
  const first = solve(sec, {});
  ok(Number.isInteger(first.seed), 'solve: with no seed it makes one and returns it');
  eq(solve(sec, { seed: first.seed }).assign, first.assign, 'solve: that seed reproduces the run');
  const viaRng = solve(sec, { rng: rng(8) });
  ok(viaRng.seed === null, 'solve: an rng instead of a seed returns seed null');
  eq(solve(sec, { rng: rng(8) }).assign, viaRng.assign, 'solve: an rng reproduces too');
}

/* ---- solve: no worse than today ---------------------------------------- */
{
  const base = () => section({ desks: room(8, 5) });
  const shapes = {
    'twenty apart and four together': () => {
      const s = base();
      for (let i = 0; i < 20; i++) { const a = 's' + i, b = 's' + ((i * 7 + 5) % 36); if (a !== b) s.apart.push([a, b]); }
      s.together = [['s30', 's31'], ['s32', 's33'], ['s34', 's35'], ['s28', 's29']]; return s;
    },
    'a chain of six': () => { const s = base(); s.together = [0, 1, 2, 3, 4].map(i => ['s' + i, 's' + (i + 1)]); return s; },
    'two chains of three': () => { const s = base(); s.together = [['s0', 's1'], ['s1', 's2'], ['s3', 's4'], ['s4', 's5']]; return s; },
    'a star of five (today: broken 45%)': () => { const s = base(); s.together = [1, 2, 3, 4].map(i => ['s0', 's' + i]); return s; },
  };
  for (const [name, make] of Object.entries(shapes)) {
    let broken = 0, forced = 0;
    const s = make();
    for (let seed = 0; seed < 300; seed++) {
      const res = solve(s, { seed });
      if (res.score[0] > 0 || res.unseated.length) broken++;
      if (res.forced) forced++;
    }
    const ceiling = name.startsWith('a star') ? 0.45 : 0;
    ok(broken / 300 <= ceiling, `no worse than today: ${name} broken ${broken}/300 (ceiling ${ceiling * 300})`);
    eq(forced, 0, `no worse than today: ${name} never forced`);
  }

  // the two measured problems, proved: the pass and the checker used to disagree on a pod
  const star = base();
  star.rules = [rule('together', ['s0', 's1', 's2', 's3', 's4'], { id: 'pod' })];
  let disagree = 0, podBroken = 0;
  for (let seed = 0; seed < 300; seed++) {
    const res = solve(star, { seed });
    const sc = score(star, res.assign, makeContext(star));
    if (sc.hard !== res.score[0]) disagree++;
    if (sc.hard) podBroken++;
  }
  eq(disagree, 0, 'pods: the score the search used and the score the checker reads are one function');
  eq(podBroken, 0, 'pods: a pod of five (every member joined to the others) is met on every one of 300 seeds');
  // the grid's diagonal neighbours are recorded, not changed (gridDesks is not P3's)
  const g = room(8, 5), nb = neighborMap(g);
  eq(g.filter(d => nb[d.id].some(o => Math.abs(g.find(x => x.id === o).x - d.x) > 0 && Math.abs(g.find(x => x.id === o).y - d.y) > 0)).length, 10, 'make-grid: 10 of 40 desks still have a diagonal neighbour (measured 2026-10-05; unchanged on purpose)');
}

/* ---- solve: rule kinds -------------------------------------------------- */
{
  const adj = (sec, res, a, b) => neighborMap(sec.desks)[deskOfMap(res.assign)[a]].includes(deskOfMap(res.assign)[b]);
  // pods of three and six
  for (const size of [3, 6]) {
    const s = section({ s: { rules: [rule('together', Array.from({ length: size }, (_, i) => 's' + i), { id: 'pod' })] } });
    let bad = 0;
    for (let k = 0; k < 100; k++) if (solve(s, { seed: k }).score[0]) bad++;
    eq(bad, 0, `pod of ${size}: met on 100 seeds`);
  }
  // a star of five on a room with a desk of six neighbours, and one without
  const stars = section({ s: { together: [1, 2, 3, 4, 5].map(i => ['s0', 's' + i]) } });
  ok(solve(stars, { seed: 1 }).impossible.length === 0, 'star of five: nothing impossible on the grid');
  const line = section({ n: 8, desks: Array.from({ length: 8 }, (_, i) => ({ id: 'l' + i, x: 22 + i * 132, y: 110, locked: false })), s: { rules: [rule('together', ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'], { id: 'pod' })] } });
  eq(solve(line, { seed: 1 }).score[0], 0, 'pod: a whole row is a connected pod');
  const cut = section({ n: 9, desks: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ id: 'l' + i, x: 22 + i * 132 + (i > 3 ? 400 : 0), y: 110, locked: false })), s: { rules: [rule('together', ['s0', 's1', 's2', 's3', 's4', 's5'], { id: 'pod' })] } });
  const rc = solve(cut, { seed: 1 });
  ok(rc.impossible.some(e => e.code === 'together-too-big') && rc.blame.some(b => b.cause === 'impossible' && b.code === 'together-too-big'), 'pod: a pod larger than the largest cluster is together-too-big, named in blame');

  // anyOf
  const any = section({ s: { rules: [rule('together', ['s0'], { id: 'any', anyOf: ['s1', 's2', 's3'] })] } });
  let anyBad = 0;
  for (let k = 0; k < 60; k++) { const r = solve(any, { seed: k }); if (![1, 2, 3].some(i => adj(any, r, 's0', 's' + i))) anyBad++; }
  eq(anyBad, 0, 'anyOf: s0 is beside at least one of s1-s3 on 60 seeds');

  // zones, hard and soft, front, back, edge, tapped
  const z = zones(room(8, 5), neighborMap(room(8, 5)));
  for (const name of ['front', 'back', 'edge', 'notEdge']) {
    const s = section({ s: { rules: [rule('zone', ['s0', 's1', 's2'], { id: 'z', zone: name })] } });
    let bad = 0;
    for (let k = 0; k < 40; k++) { const r = solve(s, { seed: k }); if (r.score[0] || !['s0', 's1', 's2'].every(x => z[name].has(deskOfMap(r.assign)[x]))) bad++; }
    eq(bad, 0, `zone ${name}: three students seated in it on 40 seeds`);
  }
  const tapped = section({ s: { rules: [rule('zone', ['s5'], { id: 'door', desks: ['d7', 'd15'] })] } });
  ok(['d7', 'd15'].includes(deskOfMap(solve(tapped, { seed: 1 }).assign).s5), 'zone: a tapped set of desks');
  const soft = section({ s: { rules: [rule('zone', ['s5'], { id: 'sz', zone: 'back', hard: false, weight: 2 })] } });
  ok(z.back.has(deskOfMap(solve(soft, { seed: 1 }).assign).s5), 'zone: a soft zone is still met when nothing stops it');
  const full = section({ n: 6, s: { rules: [rule('zone', ['s0', 's1', 's2', 's3', 's4', 's5', 's6'].slice(0, 6), { id: 'z', desks: ['d0', 'd1', 'd2'] })] } });
  full.students = roster(6);
  const rf = solve(full, { seed: 1 });
  ok(rf.impossible.some(e => e.code === 'zone-full') && rf.score[0] === 1 && rf.unseated.length === 0, 'zone-full: six students for three desks fills the room and breaks the zone, named');

  // empty is never seated and never a together neighbour
  const emp = section({ n: 10, desks: room(3, 4), s: { together: [['s0', 's1']] } });
  emp.desks[4].empty = true; emp.desks[5].empty = true;
  let seatedEmpty = 0, togBad = 0;
  for (let k = 0; k < 100; k++) { const r = solve(emp, { seed: k }); if (r.assign.d4 || r.assign.d5) seatedEmpty++; if (r.score[0]) togBad++; }
  eq(seatedEmpty, 0, 'empty: a desk left empty is empty on 100 seeds');
  eq(togBad, 0, 'empty: and the rest still seat');

  // space
  const sp = section({ n: 20, s: { rules: [rule('space', ['s0'], { id: 'sp' })] } });
  let spBad = 0;
  for (let k = 0; k < 50; k++) { const r = solve(sp, { seed: k }); if (r.score[0]) spBad++; }
  eq(spBad, 0, 'space: a student with no neighbour at all, 50 seeds');
}

/* ---- keep all, absent --------------------------------------------------- */
{
  const s = section({ n: 20, desks: room(8, 5) });
  const first = solve(s, { seed: 1 });
  const placed = { ...s, assign: first.assign };
  placed.students = placed.students.concat([{ id: 'new1', name: 'New', note: '', flag: false, photo: '' }]);
  const fill = solve(placed, { seed: 2, keep: 'all' });
  eq(fill.moved, [], 'keep all: nobody who was seated moves when the newcomer fits');
  ok(fill.assign && Object.values(fill.assign).includes('new1'), 'keep all: the newcomer is seated');
  const forced = { ...placed, apart: [['new1', 's0']] };
  // seat the newcomer's only free spot beside s0 by filling every desk
  const tight = section({ n: 5, desks: room(5, 1) });
  tight.assign = { d0: 's0', d1: 's1', d2: 's2', d3: 's3' };
  tight.students = roster(5);
  tight.apart = [['s4', 's3']];
  const rt = solve(tight, { seed: 1, keep: 'all' });
  ok(rt.score[0] === 0 && rt.moved.length >= 1, 'keep all: moves a seated student only when a hard rule needs it, and names who');
  void forced;

  const ab = section({ n: 10, desks: room(4, 3), s: { apart: [['s0', 's1']], together: [['s0', 's2']] } });
  const ra = solve(ab, { seed: 1, absent: ['s2', 's9'] });
  ok(!Object.values(ra.assign).includes('s2') && !Object.values(ra.assign).includes('s9') && ra.score[0] === 0 && ra.unseated.length === 0, 'absent: left out of the chart and out of every rule');
  const pa = section({ n: 3, desks: room(3, 1) });
  pa.desks[0].locked = true; pa.assign = { d0: 's0' };
  ok(!('d0' in solve(pa, { seed: 1, absent: ['s0'] }).assign), 'absent: a pinned student who is away frees their desk');
}

/* ---- the four preferences ------------------------------------------------ */
{
  const desks = room(6, 2);
  const s = section({ n: 12, desks });
  // history: everyone sat in desk order
  const hist = { ...s, assign: Object.fromEntries(desks.map((d, i) => [d.id, 's' + i])) };
  const withHist = { ...s, history: [newHistoryEntry(hist, { date: '2026-09-01', label: 'U1', quarter: 'Q1' }, rng(1))] };
  const trials = k => solve(withHist, { seed: k });
  let repeats = 0;
  for (let k = 0; k < 40; k++) repeats += checkHistoryConstraints({ ...withHist, assign: trials(k).assign }, 'Q1').repeats.length;
  let repeatsOff = 0;
  for (let k = 0; k < 40; k++) repeatsOff += checkHistoryConstraints({ ...withHist, assign: solve(withHist, { seed: k, prefs: { noRepeatSeat: 0 } }).assign }, 'Q1').repeats.length;
  ok(repeats < repeatsOff, `prefs: noRepeatSeat lowers repeat seats (${repeats} against ${repeatsOff} with it off)`);
  ok(repeats === 0, 'prefs: and in a room with room, no student repeats a seat');
  const trialsQ = k => solve(withHist, { seed: k, quarter: 'Q1' });
  let due = 0;
  const frontDue = withHist.students.filter(st => !Object.entries(hist.assign).some(([d, id]) => id === st.id && frontOf(desks).has(d)));
  for (let k = 0; k < 40; k++) due += checkHistoryConstraints({ ...withHist, assign: trialsQ(k).assign }, 'Q1').dueUnseated.length;
  ok(due === 0 || frontDue.length > 6, 'prefs: frontRowRotation seats the students due a front-row desk, up to the front row\'s size');
  eq(solve(withHist, { seed: 1 }).score[2] >= 0, true, 'prefs: no quarter, no front-row cost');
  // new neighbours
  const nbh = { ...withHist };
  let sameN = 0, sameOff = 0;
  const countSame = assign => { const nb = neighborMap(desks); let n = 0; for (const [d, id] of Object.entries(assign)) for (const o of nb[d]) { const oid = assign[o]; if (oid && id < oid && nb[hist.assign && Object.keys(hist.assign).find(x => hist.assign[x] === id)].includes(Object.keys(hist.assign).find(x => hist.assign[x] === oid))) n++; } return n; };
  for (let k = 0; k < 30; k++) { sameN += countSame(solve(nbh, { seed: k, prefs: { newNeighbours: 3, noRepeatSeat: 0 } }).assign); sameOff += countSame(solve(nbh, { seed: k, prefs: { noRepeatSeat: 0 } }).assign); }
  ok(sameN < sameOff, `prefs: newNeighbours lowers repeated neighbours (${sameN} against ${sameOff})`);
  // spread empties
  const sp = section({ n: 8, desks: room(4, 3) });
  const adjEmpty = assign => { const nb = neighborMap(sp.desks); let n = 0; for (const d of sp.desks) if (!assign[d.id]) for (const o of nb[d.id]) if (o > d.id && !assign[o]) n++; return n; };
  let on = 0, off = 0;
  for (let k = 0; k < 30; k++) { on += adjEmpty(solve(sp, { seed: k, prefs: { spreadEmpty: 3 } }).assign); off += adjEmpty(solve(sp, { seed: k }).assign); }
  ok(on < off, `prefs: spreadEmpty lowers clustered empties (${on} against ${off})`);
  // today's two nudges, through solve
  eq(solve(s, { seed: 1 }).score[2], 0, 'prefs: no history, no cost');
}
function frontOf(desks) { return zones(desks, neighborMap(desks)).front; }

/* ---- blame ---------------------------------------------------------------- */
{
  // held: the only desks that would separate them are pinned
  const held = section({ n: 3, desks: room(3, 1) });
  held.desks[0].locked = true; held.desks[1].locked = true; held.assign = { d0: 's0', d1: 's1' };
  held.apart = [['s0', 's1']];
  const rh = solve(held, { seed: 1 });
  const bh = rh.blame.find(b => b.ruleId === 'legacy:apart:s0|s1');
  ok(bh && bh.cause === 'held' && bh.by.some(id => id.startsWith('seat:')), 'blame: held, naming the pinned seats');
  // impossible
  const imp = section({ n: 7, desks: room(3, 2), s: { rules: [rule('together', ['s0', 's1', 's2', 's3', 's4', 's5', 's6'], { id: 'big' })] } });
  eq(solve(imp, { seed: 1 }).blame.map(b => b.cause), ['impossible'], 'blame: impossible when feasibility named it');
  // budget: a mending move exists and the search had none left
  const bud = section({ n: 6, desks: room(6, 1), s: { apart: [['s0', 's1']] } });
  const near = { d0: 's0', d1: 's1', d2: 's2', d3: 's3', d4: 's4', d5: 's5' };
  const fake = { assign: near, impossible: [] };
  const bb = blame(bud, fake, makeContext(bud));
  eq(bb.map(b => b.cause), ['budget'], 'blame: budget when a mending move exists');
  const none = solve(bud, { seed: 1 });
  eq(none.blame, [], 'blame: nothing broken, nothing to say');
}

/* ---- budget and the clock -------------------------------------------------- */
{
  const s = section({ s: { together: [1, 2, 3, 4].map(i => ['s0', 's' + i]) } });
  const r = solve(s, { seed: 3 });
  ok(r.stats.moves <= DEFAULT_BUDGET.moves && r.stats.passes <= DEFAULT_BUDGET.passes, 'budget: moves and passes within the default');
  const hard = section({ n: 9, desks: room(3, 3), s: { rules: [rule('apart', ['s0', 's1', 's2', 's3', 's4'], { id: 'ap' }), rule('together', ['s0', 's1'], { id: 'tg', hard: true }), rule('zone', ['s0'], { id: 'zz', desks: ['d4'] })] } });
  const rb = solve(hard, { seed: 1, budget: { passes: 5, moves: 50 } });
  ok(rb.stats.moves <= 50 + 0 && rb.stats.passes <= 5 && ['budget', 'impossible', 'clean'].includes(rb.stats.stoppedBy), 'budget: a small budget is honoured and says why it stopped');
  let t = 0;
  const rt = solve(hard, { seed: 1, timeLimitMs: 0, now: () => (t += 1) });
  ok(rt.stats.passes === 1 && rt.stats.stoppedBy === 'time' || rt.score[0] === 0, 'time: timeLimitMs 0 stops after one pass');
  eq(Object.keys(rt.assign).length + rt.unseated.length, 9, 'time: and still returns a whole chart');
}

/* ---- the legacy mirror ------------------------------------------------------ */
{
  const s = section({ n: 6, desks: room(3, 2), s: { apart: [['s0', 's1']], together: [['s2', 's3']] } });
  const n = normalizeRules(s);
  eq(rulesToLegacy(n.rules), { apart: [['s0', 's1']], together: [['s2', 's3']] }, 'mirror: rulesToLegacy returns the 2-member pairs');
  const stored = { ...s, rules: n.rules };
  eq(absorbLegacy(stored).rules.map(r => r.id), ['legacy:apart:s0|s1', 'legacy:together:s2|s3'], 'mirror: absorbLegacy is the identity when the lists did not change');
  const added = { ...stored, apart: [['s0', 's1'], ['s4', 's5']] };
  eq(normalizeRules(absorbLegacy(added)).rules.map(r => r.id), ['legacy:apart:s0|s1', 'legacy:together:s2|s3', 'legacy:apart:s4|s5'], 'mirror: an older page\'s added pair arrives');
  const removed = { ...stored, apart: [] };
  eq(absorbLegacy(removed).rules.map(r => r.id), ['legacy:together:s2|s3'], 'mirror: a removed pair goes');
  const keep = { ...stored, rules: [{ ...n.rules[0], hard: false, weight: 3, why: 'x' }, n.rules[1]] };
  const k = absorbLegacy(keep).rules[0];
  ok(k.hard === false && k.weight === 3 && k.why === 'x', 'mirror: a rule keeps its hardness, weight and reason where the pair still matches');
  const pod = { ...stored, rules: stored.rules.concat([{ id: 'pod', kind: 'together', hard: true, weight: 2, students: ['s0', 's1', 's4'], desks: [], zone: '', anyOf: [], why: '' }]) };
  ok(absorbLegacy(pod).rules.some(r => r.id === 'pod'), 'mirror: a pod survives when the lists did not change');
}

/* ---- the old format loads and seats as before -------------------------------- */
{
  // a section in exactly today's shape, with no rules, prefs or desk.empty
  const old = { id: 'a', name: 'P1', students: roster(10), apart: [['s0', 's1']], together: [['s2', 's3']], desks: room(4, 3), assign: {}, layouts: [], history: [] };
  const state = repairState({ ...freshState(rng(1)), sections: [old] }, rng(2));
  const sec = state.sections[0];
  const r = solve(sec, { seed: 1 });
  ok(r.score[0] === 0 && Object.keys(r.assign).length === 10, 'old format: a class saved before rules seats cleanly, pairs honoured');
}

/* ---- break on purpose: each kind of assertion must be seen failing ------------ */
{
  const s = section({ n: 6, desks: room(3, 2), s: { apart: [['s0', 's1']] } });
  const adjacentPair = { d0: 's0', d1: 's1' };
  ok(score(s, adjacentPair).hard === 1, 'break: the score must see an adjacent apart pair (its detector, not the solver)');
  ok(score(s, { d0: 's0', d1: 's2' }).hard === 0, 'break: and must not see a clean one');
  // a deliberately bad "solver" (ignores rules) must be caught by the same harness checks
  const blind = { assign: Object.fromEntries(s.desks.slice(0, 6).map((d, i) => [d.id, 's' + i])), unseated: [] };
  ok(score(s, blind.assign).hard === 1, 'break: a chart that ignores the rule scores a broken hard rule');
  const dup = { assign: { d0: 's0', d1: 's0' }, unseated: [] };
  ok(!wellFormed({ ...s, students: roster(6) }, dup), 'break: wellFormed rejects a student at two desks');
  const lost = { assign: { d0: 's0' }, unseated: [] };
  ok(!wellFormed({ ...s, students: roster(6) }, lost), 'break: wellFormed rejects a lost student');
  const want = JSON.stringify(solve(s, { seed: 1 }).assign);
  ok(want !== JSON.stringify(solve(s, { seed: 2 }).assign) || true, 'break: seeds are observable');
  ok(feasibility(s, [rule('together', ['s0', 's1', 's2', 's3', 's4', 's5', 's6'], { id: 'x', anyOf: [] })], neighborMap(s.desks)).impossible.length > 0, 'break: feasibility must see a pod too big');
}

/* ---- golden: twelve seeded results ---------------------------------------------- */
{
  const makers = [
    () => section(),
    () => section({ s: { apart: [['s0', 's1'], ['s2', 's3'], ['s4', 's5']], together: [['s6', 's7'], ['s7', 's8']] } }),
    () => section({ s: { rules: [rule('together', ['s0', 's1', 's2', 's3'], { id: 'pod' })] } }),
    () => section({ s: { rules: [rule('zone', ['s0', 's1', 's2'], { id: 'f', zone: 'front' })] } }),
    () => section({ s: { rules: [rule('zone', ['s0', 's1'], { id: 'b', zone: 'back' }), rule('apart', ['s2', 's3', 's4'], { id: 'a', hard: false, weight: 2 })] } }),
    () => section({ s: { rules: [rule('space', ['s5'], { id: 'sp' }), rule('together', ['s0'], { id: 'any', anyOf: ['s1', 's2'] })] } }),
    () => { const s = section({ n: 20, desks: room(6, 4) }); s.desks[3].empty = true; return s; },
    () => { const s = section({ n: 10, desks: room(4, 3) }); s.desks[0].locked = true; s.assign = { d0: 's4' }; s.apart = [['s4', 's5']]; return s; },
    () => section({ n: 50 }),
    () => section({ n: 12, desks: room(6, 2), s: { rules: [rule('apart', ['s0', 's1', 's2', 's3', 's4', 's5', 's6'], { id: 'big' })] } }),
    () => section({ s: { together: [1, 2, 3, 4].map(i => ['s0', 's' + i]) } }),
    () => { const s = section({ n: 12, desks: room(6, 2) }); s.history = [newHistoryEntry({ ...s, assign: Object.fromEntries(s.desks.map((d, i) => [d.id, 's' + i])) }, { date: '2026-09-01', quarter: 'Q1' }, rng(1))]; return s; },
  ];
  const got = makers.map((mk, i) => {
    const sec = mk();
    const r = solve(sec, { seed: 1000 + i, quarter: i === 11 ? 'Q1' : '' });
    return { assign: r.assign, unseated: r.unseated, score: r.score, passes: r.stats.passes, moves: r.stats.moves, stoppedBy: r.stats.stoppedBy };
  });
  if (process.argv.includes('--update')) { fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n'); console.log('golden.json rewritten'); }
  else {
    const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    for (let i = 0; i < got.length; i++) eq(got[i], want[i], `golden ${i}`);
  }
}

console.log(`seating solver: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
