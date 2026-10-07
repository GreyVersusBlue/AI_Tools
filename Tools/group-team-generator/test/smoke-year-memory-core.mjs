// smoke-year-memory-core.mjs — 002's long pairing memory and its roles, in pure Node.
//
//   node Tools/group-team-generator/test/smoke-year-memory-core.mjs
//
// gtg-memory.js must (1) never trade a keep-apart / keep-together rule or the
// last-two-generations repeat bias for evenness; (2) never change a group's
// size, drop or double a student, or touch a locked group; (3) give the same
// answer for the same groups, history and rng; (4) with the long memory on,
// leave the counts of who has worked with whom no more uneven, and fewer pairs
// never met, than with it off, over many class shapes; and (5) rotate roles so
// that a group's members each hold each role before any holds one twice.
// MEMORY_FILE points it at another copy of the module (the deliberate-break
// runs use it). Every name is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.MEMORY_FILE || path.join(here, '..', 'gtg-memory.js');
await import(pathToFileURL(file).href);
const M = globalThis.GtgMemory;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ['Ada', 'Bo', 'Cy', 'Di', 'Eli', 'Fay', 'Gus', 'Hana', 'Ira', 'Jo', 'Kai', 'Lena', 'Mo', 'Nia', 'Oz', 'Pia', 'Quin', 'Rae', 'Sol', 'Tess', 'Uri', 'Val', 'Wen', 'Xan', 'Yul', 'Zed', 'Abe', 'Bea', 'Cal', 'Dot', 'Eve', 'Flo', 'Gil', 'Hal', 'Isa', 'Jem'];
const names = n => FIRST.slice(0, n);
const stu = n => ({ name: n });
const K = (a, b) => a < b ? a + '␟' + b : b + '␟' + a;
const groupsOf = (arrs) => arrs.map(g => g.map(stu));
const flat = gs => gs.flat().map(s => s.name).sort();

console.log('Group / Team Generator — long pairing memory and roles (pure logic)');

/* ── 1. counts, recency and the score ─────────────────────────────────── */
{
  const h = { [K('Ada', 'Bo')]: { gen: 4, count: 3 }, [K('Cy', 'Di')]: 2 /* a legacy bare generation */, [K('Eli', 'Fay')]: { gen: 3, count: 1 } };
  eq(M.countOf(h, 'Bo', 'Ada'), 3, 'a pair is the same pair either way round');
  eq(M.countOf(h, 'Di', 'Cy'), 1, 'a legacy bare-number entry counts once');
  eq(M.countOf(h, 'Ada', 'Cy'), 0, 'a pair never grouped counts 0');
  eq(M.countOf(null, 'Ada', 'Bo'), 0, 'no history at all counts 0');
  eq(M.recencyOf(h, 4, 'Ada', 'Bo'), 1000, 'a pair last grouped in the generation just made costs 1000');
  eq(M.recencyOf(h, 3, 'Ada', 'Bo'), 1000, 'a pair last grouped in the generation being made costs 1000');
  eq(M.recencyOf(h, 4, 'Eli', 'Fay'), 100, 'a pair last grouped two generations back costs 100');
  eq(M.recencyOf(h, 5, 'Eli', 'Fay'), 0, 'older than that costs nothing');
  eq(M.recencyOf(h, 9, 'Ada', 'Cy'), 0, 'never grouped costs nothing');

  const gs = groupsOf([['Ada', 'Bo', 'Cy'], ['Di', 'Eli', 'Fay']]);
  same(M.score(gs, { history: h, gen: 9, apart: [['Ada', 'Cy']], together: [['Bo', 'Di']] }), [2, 0, 9 + 1], 'score: one keep-apart broken, one keep-together split, spread = 3 squared + 1 (Ada-Bo and Eli-Fay share a group)');
  same(M.score(gs, { history: h, gen: 4, apart: [], together: [] }), [0, 1000 + 100, 9 + 1], 'score: recent 1000 + 100, spread 9 + 1');
  same(M.score(gs, { history: h, gen: 4, apart: [['Ada', 'Zed']], together: [['Ada', 'Zed']] }), [0, 1100, 10], 'a rule naming someone who is not in any group counts as nothing');
}

/* ── 2. refine: what it must never do ─────────────────────────────────── */
function dealRandom(ns, k, rng) {
  const a = ns.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const gs = Array.from({ length: k }, () => []);
  a.forEach((n, i) => gs[i % k].push(stu(n)));
  return gs;
}
function recordPairs(h, gs, gen) {
  const next = { ...h };
  gs.forEach(g => { for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const k = K(g[i].name, g[j].name); next[k] = { gen, count: ((next[k] && next[k].count) || 0) + 1 };
  } });
  return next;
}
{
  let violations = 0, sizeBad = 0, lostStudent = 0, hardUp = 0, recentUp = 0, spreadUp = 0, lockedMoved = 0, historyTouched = 0, swapsOverCap = 0, ran = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = mulberry(seed * 7919);
    const n = 8 + (seed % 5) * 5, k = 2 + (seed % 6);   // 8..28 students, 2..7 groups
    const ns = names(n);
    let h = {};
    for (let g = 1; g <= 4; g++) h = recordPairs(h, dealRandom(ns, k, rng), g);
    const apart = [[ns[0], ns[1]], [ns[2], ns[3]]], together = [[ns[4], ns[5]]];
    const gs = dealRandom(ns, k, rng);
    const lockedIdx = seed % 3 === 0 ? { 0: true } : {};
    const lockedBefore = JSON.stringify(gs[0]);
    const sizes = gs.map(g => g.length), whoBefore = flat(gs);
    const hBefore = JSON.stringify(h);
    const r = M.refine(gs, { history: h, gen: 4, apart, together, locked: lockedIdx, rng: mulberry(seed), spread: true, maxSwaps: 50 });
    ran++;
    if (JSON.stringify(gs.map(g => g.length)) !== JSON.stringify(sizes)) sizeBad++;
    if (JSON.stringify(flat(gs)) !== JSON.stringify(whoBefore)) lostStudent++;
    if (r.after[0] > r.before[0]) hardUp++;
    if (r.after[0] === r.before[0] && r.after[1] === r.before[1] && r.after[2] > r.before[2]) spreadUp++;
    if (r.after[0] === r.before[0] && r.after[1] > r.before[1]) recentUp++;
    if (lockedIdx[0] && JSON.stringify(gs[0]) !== lockedBefore) lockedMoved++;
    if (JSON.stringify(h) !== hBefore) historyTouched++;
    if (r.swaps > 50) swapsOverCap++;
    const real = M.score(gs, { history: h, gen: 4, apart, together });
    if (JSON.stringify(real) !== JSON.stringify(r.after)) violations++;
  }
  eq(sizeBad, 0, `no group changed size, over ${ran} classes`);
  eq(lostStudent, 0, 'no student was dropped or doubled');
  eq(hardUp, 0, 'a keep-apart or keep-together rule is never made worse');
  eq(recentUp, 0, 'the recent-repeat penalty is never made worse unless a broken rule was mended by it');
  eq(spreadUp, 0, 'the spread never rises when the rules and recent repeats are level');
  eq(lockedMoved, 0, 'a locked group is never touched');
  eq(historyTouched, 0, 'the history passed in is read, never changed');
  eq(swapsOverCap, 0, 'the swap cap is honoured');
  eq(violations, 0, 'the score refine reports is the score of the groups it leaves');
}

/* ── 2b. refine: determinism and a hand-built case ────────────────────── */
{
  const ns = names(12);
  let h = {};
  const r0 = mulberry(5);
  for (let g = 1; g <= 3; g++) h = recordPairs(h, dealRandom(ns, 3, r0), g);
  const run = (seed) => { const gs = dealRandom(ns, 3, mulberry(99)); M.refine(gs, { history: h, gen: 3, rng: mulberry(seed), spread: true }); return JSON.stringify(gs); };
  eq(run(8), run(8), 'the same groups, history and rng give the same answer');
  const outs = new Set(); for (let s = 1; s <= 12; s++) outs.add(run(s));
  ok(outs.size > 1, `a different rng can give a different grouping on a class with ties (${outs.size} of 12 differ)`);

  // Four students, two groups: A-B and C-D have met three times, nothing else.
  const h2 = { [K('Ada', 'Bo')]: { gen: 1, count: 3 }, [K('Cy', 'Di')]: { gen: 1, count: 3 } };
  const gs = groupsOf([['Ada', 'Bo'], ['Cy', 'Di']]);
  const r = M.refine(gs, { history: h2, gen: 9, rng: mulberry(1), spread: true });
  same(r.before, [0, 0, 18], 'two pairs that met three times: spread 9 + 9');
  same(r.after, [0, 0, 0], 'it splits them into pairs that have never met');
  ok(r.swaps >= 1, 'by swapping');
  const gs2 = groupsOf([['Ada', 'Bo'], ['Cy', 'Di']]);
  const off = M.refine(gs2, { history: h2, gen: 9, rng: mulberry(1), spread: false });
  eq(off.swaps, 0, 'with the long memory off the same groups are left alone (nothing recent, nothing broken)');

  // Hard rules beat evenness: A and C must stay apart and B and D together... the even grouping would break them.
  const gs3 = groupsOf([['Ada', 'Bo'], ['Cy', 'Di']]);
  const r3 = M.refine(gs3, { history: h2, gen: 9, apart: [['Ada', 'Bo']], together: [], rng: mulberry(1), spread: true });
  eq(r3.after[0], 0, 'a keep-apart pair already apart stays apart');
  const gs4 = groupsOf([['Ada', 'Bo'], ['Cy', 'Di']]);
  const r4 = M.refine(gs4, { history: h2, gen: 9, apart: [], together: [['Ada', 'Bo'], ['Cy', 'Di']], rng: mulberry(1), spread: true });
  same(gs4.map(g => g.map(s => s.name).sort()), [['Ada', 'Bo'], ['Cy', 'Di']], 'two keep-together rules hold even though the pairs have met three times each');
  eq(r4.swaps, 0, '... and no swap was made');
  // Recent beats evenness: Ada-Bo met last generation; Cy-Di met long ago many times. Splitting Cy-Di would put Ada with Cy, never met, but...
  const h5 = { [K('Ada', 'Cy')]: { gen: 8, count: 1 }, [K('Cy', 'Di')]: { gen: 1, count: 9 }, [K('Ada', 'Bo')]: { gen: 1, count: 9 } };
  const gs5 = groupsOf([['Ada', 'Bo'], ['Cy', 'Di']]);
  M.refine(gs5, { history: h5, gen: 8, rng: mulberry(2), spread: true });
  const together = (gs, a, b) => gs.some(g => g.some(s => s.name === a) && g.some(s => s.name === b));
  ok(!together(gs5, 'Ada', 'Cy'), 'a pair grouped last generation is not put together again to even out two old pairs');
}

/* ── 3. the fairness claim, over many class shapes ────────────────────── */
{
  const SHAPES = [[12, 3], [16, 4], [20, 5], [24, 6], [28, 7], [30, 5], [26, 5], [27, 7], [32, 8], [22, 11]];
  const ROUNDS = 12, SEEDS = 40;
  const total = { off: { var: 0, never: 0, max: 0 }, on: { var: 0, never: 0, max: 0 } };
  let shapesBetter = 0, shapesNotWorse = 0, perRunWorse = 0, perRun = 0;
  console.log('  shape   rounds  off: variance never max   on: variance never max');
  for (const [n, k] of SHAPES) {
    const ns = names(n);
    const acc = { off: { var: 0, never: 0, max: 0 }, on: { var: 0, never: 0, max: 0 } };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const res = {};
      for (const mode of ['off', 'on']) {
        const rng = mulberry(seed * 104729 + n);
        let h = {};
        for (let g = 1; g <= ROUNDS; g++) {
          const gs = dealRandom(ns, k, rng);
          M.refine(gs, { history: h, gen: g - 1, rng, spread: mode === 'on' });
          h = recordPairs(h, gs, g);
        }
        res[mode] = M.coverage(h, ns);
        acc[mode].var += res[mode].variance; acc[mode].never += res[mode].never; acc[mode].max += res[mode].max;
      }
      perRun++; if (res.on.variance > res.off.variance + 1e-9) perRunWorse++;
    }
    for (const m of ['off', 'on']) for (const f of ['var', 'never', 'max']) { acc[m][f] /= SEEDS; total[m][f] += acc[m][f]; }
    console.log(`  ${String(n).padStart(2)} in ${String(k).padStart(2)}  ${ROUNDS}      ${acc.off.var.toFixed(2).padStart(8)} ${acc.off.never.toFixed(1).padStart(6)} ${acc.off.max.toFixed(1).padStart(4)}   ${acc.on.var.toFixed(2).padStart(8)} ${acc.on.never.toFixed(1).padStart(6)} ${acc.on.max.toFixed(1).padStart(4)}`);
    if (acc.on.var <= acc.off.var + 1e-9 && acc.on.never <= acc.off.never + 1e-9) shapesNotWorse++;
    if (acc.on.var < acc.off.var && acc.on.never < acc.off.never) shapesBetter++;
    ok(acc.on.var <= acc.off.var + 1e-9, `${n} in ${k}: the spread of pair counts after ${ROUNDS} rounds is no worse with the long memory on (${acc.on.var.toFixed(3)} vs ${acc.off.var.toFixed(3)})`);
    ok(acc.on.never <= acc.off.never + 1e-9, `${n} in ${k}: no more pairs have never met with the long memory on (${acc.on.never.toFixed(2)} vs ${acc.off.never.toFixed(2)})`);
  }
  eq(shapesNotWorse, SHAPES.length, 'every class shape is no worse on both measures');
  ok(shapesBetter >= SHAPES.length - 1, `at least all but one shape is strictly better on both measures (${shapesBetter} of ${SHAPES.length})`);
  ok(total.on.never < total.off.never * 0.85, `never-paired pairs fall by at least 15% overall (${total.on.never.toFixed(1)} vs ${total.off.never.toFixed(1)})`);
  ok(total.on.var < total.off.var * 0.85, `the spread falls by at least 15% overall (${total.on.var.toFixed(2)} vs ${total.off.var.toFixed(2)})`);
  ok(perRunWorse / perRun < 0.1, `a single class is rarely worse with it on: ${perRunWorse} of ${perRun} runs`);
}

/* ── 4. coverage and notYet ───────────────────────────────────────────── */
{
  const ns = ['Ada', 'Bo', 'Cy', 'Di'];
  const h = { [K('Ada', 'Bo')]: { gen: 1, count: 2 }, [K('Ada', 'Cy')]: { gen: 1, count: 1 } };
  const c = M.coverage(h, ns);
  eq(c.pairs, 6, 'four students have six pairs');
  eq(c.never, 4, 'four of them have never met');
  eq(c.max, 2, 'the busiest pair has met twice');
  ok(Math.abs(c.mean - 0.5) < 1e-9, 'the mean count is (2 + 1) / 6');
  ok(Math.abs(c.variance - (5 / 6 - 0.25)) < 1e-9, 'the variance is the mean of squares minus the square of the mean');
  const ny = M.notYet(h, ns);
  same(ny.map(x => [x.name, x.met, x.of, x.never]), [['Ada', 2, 3, ['Di']], ['Bo', 1, 3, ['Cy', 'Di']], ['Cy', 1, 3, ['Bo', 'Di']], ['Di', 0, 3, ['Ada', 'Bo', 'Cy']]], 'notYet names who each student has not met, in roster order');
  same(M.notYet({}, ['Solo']), [{ name: 'Solo', met: 0, of: 0, never: [] }], 'a class of one has met everyone there is');
}

/* ── 5. roles ─────────────────────────────────────────────────────────── */
{
  same(M.parseRoles('Recorder\n  Reporter  \n\nrecorder\nTimekeeper\r\nMaterials   Manager'), ['Recorder', 'Reporter', 'Timekeeper', 'Materials Manager'], 'a role list: trimmed, blanks and repeats (any case) dropped, inner spaces squeezed');
  eq(M.parseRoles(Array.from({ length: 20 }, (_, i) => 'Role ' + i).join('\n')).length, 12, 'at most twelve roles');
  eq(M.parseRoles('x'.repeat(80))[0].length, 40, 'a role is cut to 40 characters');
  same(M.parseRoles(null), [], 'no text, no roles');

  const none = () => 0;
  // Hungarian against brute force.
  let hungBad = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = mulberry(seed), n = 2 + (seed % 6);
    const cost = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rng() * 50)));
    const pick = M.hungarian(cost);
    const used = new Set(pick);
    const total = pick.reduce((s, j, i) => s + cost[i][j], 0);
    let best = Infinity;
    const perm = (arr, rest) => { if (!rest.length) { best = Math.min(best, arr.reduce((s, j, i) => s + cost[i][j], 0)); return; } rest.forEach((x, ix) => perm([...arr, x], rest.filter((_, iy) => iy !== ix))); };
    perm([], [...Array(n).keys()]);
    if (total !== best || used.size !== n) hungBad++;
  }
  eq(hungBad, 0, 'the assignment finder is optimal and one-to-one on 200 random matrices (checked against every permutation)');

  const rolesList = ['Recorder', 'Reporter', 'Timekeeper', 'Checker'];
  // Four members, four roles, eight rounds: everyone holds every role exactly twice.
  {
    const ms = ['Ada', 'Bo', 'Cy', 'Di'];
    let h = {}; const rng = mulberry(31);
    const seenAt = [];
    for (let g = 1; g <= 8; g++) {
      const given = M.assignRoles(ms, rolesList, h, g, rng);
      ok(new Set(given).size === 4 && given.every(r => rolesList.includes(r)), `round ${g}: four members, four different roles`);
      seenAt.push(given);
      h = M.recordRoles(h, ms, given, g);
    }
    let every = true;
    ms.forEach(m => rolesList.forEach(r => { if (M.roleCount(h, m, r) !== 2) every = false; }));
    ok(every, 'after eight rounds everyone has held each of four roles exactly twice');
    let firstFour = true;
    ms.forEach((m, mi) => { if (new Set(seenAt.slice(0, 4).map(g => g[mi])).size !== 4) firstFour = false; });
    ok(firstFour, 'nobody held a role twice in the first four rounds');
  }
  // Five members, four roles: each sits out (no role) exactly once in five rounds.
  {
    const ms = ['Ada', 'Bo', 'Cy', 'Di', 'Eli'];
    let h = {}; const rng = mulberry(32);
    for (let g = 1; g <= 5; g++) {
      const given = M.assignRoles(ms, rolesList, h, g, rng);
      eq(given.filter(r => r === '').length, 1, `round ${g}: one member of five has no role`);
      h = M.recordRoles(h, ms, given, g);
    }
    ok(ms.every(m => M.roleCount(h, m, '') === 1), 'in five rounds everyone sat out exactly once');
    ok(ms.every(m => rolesList.every(r => M.roleCount(h, m, r) === 1)), 'and held every role exactly once');
  }
  // Three members, four roles: the last role of the list goes unfilled.
  {
    const given = M.assignRoles(['Ada', 'Bo', 'Cy'], rolesList, {}, 1, mulberry(3));
    same(given.slice().sort(), ['Recorder', 'Reporter', 'Timekeeper'], 'a group of three gets the first three roles of the list; the last goes unfilled');
  }
  same(M.assignRoles([], rolesList, {}, 1, none), [], 'an empty group gets nothing');
  same(M.assignRoles(['Ada', 'Bo'], [], {}, 1, mulberry(1)), ['', ''], 'no roles: everyone has none');

  // Optimal for the cost it states: marginal count, then the role held longest ago.
  let optBad = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const rng = mulberry(seed * 13), m = 2 + (seed % 5);
    const ms = names(m), roles = rolesList.slice(0, 2 + (seed % 3));
    let h = {};
    for (let g = 1; g <= 1 + (seed % 6); g++) h = M.recordRoles(h, ms, M.assignRoles(ms, roles, h, g, rng).map((r, i) => (rng() < 0.3 ? roles[Math.floor(rng() * roles.length)] : r)), g);
    const given = M.assignRoles(ms, roles, h, 9, none);
    const cols = roles.slice(0, m); while (cols.length < m) cols.push('');
    const c = (mi, col) => (2 * M.roleCount(h, ms[mi], col) + 1) * 1e11 + Math.min((h[ms[mi]] && h[ms[mi]].last[col]) || 0, 9999) * 1e6;
    const got = given.reduce((s, r, i) => s + c(i, r), 0);
    let best = Infinity;
    const perm = (arr, rest) => { if (!rest.length) { best = Math.min(best, arr.reduce((s, col, i) => s + c(i, col), 0)); return; } rest.forEach((x, ix) => perm([...arr, x], rest.filter((_, iy) => iy !== ix))); };
    perm([], cols);
    if (got !== best) optBad++;
  }
  eq(optBad, 0, 'the assignment is the cheapest for its stated cost, over 150 random histories (checked against every permutation)');

  // Determinism and ties not favouring roster order.
  const ms6 = names(6), r6 = rolesList.concat(['Scribe', 'Runner']);
  same(M.assignRoles(ms6, r6, {}, 1, mulberry(77)), M.assignRoles(ms6, r6, {}, 1, mulberry(77)), 'the same history and rng give the same roles');
  const gotRecorder = {}; ms6.forEach(m => gotRecorder[m] = 0);
  for (let s = 1; s <= 300; s++) { const g = M.assignRoles(ms6, r6, {}, 1, mulberry(s)); gotRecorder[ms6[g.indexOf('Recorder')]]++; }
  ok(ms6.every(m => gotRecorder[m] > 20), `with no history the first role goes to everyone in turn, not the top of the list: ${JSON.stringify(gotRecorder)}`);

  // The record, rename, prune and normalise helpers.
  const h0 = {};
  const h1 = M.recordRoles(h0, ['Ada', 'Bo'], ['Recorder', ''], 3);
  same(h0, {}, 'recordRoles does not change the history it is given');
  same(h1, { Ada: { counts: { Recorder: 1 }, last: { Recorder: 3 } }, Bo: { counts: { '': 1 }, last: { '': 3 } } }, 'recordRoles counts the role and the generation; "no role" is the key ""');
  const h2 = M.recordRoles(h1, ['Ada'], ['Recorder'], 5);
  eq(M.roleCount(h2, 'Ada', 'Recorder'), 2, 'a second turn adds to the count');
  eq(h2.Ada.last.Recorder, 5, 'and moves the last generation');
  const hr = M.renameRoles(M.recordRoles(h2, ['Cy'], ['Recorder'], 4), 'Cy', 'Ada');
  eq(M.roleCount(hr, 'Ada', 'Recorder'), 3, 'a rename onto a name that has a history adds the counts');
  eq(hr.Ada.last.Recorder, 5, 'and keeps the later generation');
  ok(!('Cy' in hr), 'and the old name is gone');
  same(M.renameRoles(h1, 'Nobody', 'Zed'), h1, 'renaming a name with no history changes nothing');
  same(Object.keys(M.pruneRoles(h2, ['Bo', 'Zed'])), ['Bo'], 'prune keeps only the names on the roster');
  const bad = JSON.parse('{"__proto__":{"counts":{"x":1}},"Ada":{"counts":{"Recorder":2,"__proto__":3,"neg":-1,"str":"a"},"last":{"Recorder":4,"ghost":9}},"Bo":5,"Cy":{"counts":null}}');
  const nn = M.normalizeRoles(bad);
  same(nn, { Ada: { counts: { Recorder: 2 }, last: { Recorder: 4 } }, Cy: { counts: {}, last: {} } }, 'normalizeRoles keeps good counts and drops poison keys, negatives, strings and a last with no count');
  same(M.normalizeRoles('nope'), {}, 'normalizeRoles of a non-object is empty');
  ok(!({}).x, 'and Object.prototype was not polluted');

  // Over a rotating class (new groups every round) roles spread better than chance.
  const ns = names(24), SEEDS = 20, ROUNDS = 24;
  let spreadOn = 0, spreadRandom = 0, repeatsOn = 0, repeatsRandom = 0, slots = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const mode of ['on', 'random']) {
      const rng = mulberry(seed * 31 + 7);
      let h = {};
      for (let g = 1; g <= ROUNDS; g++) {
        const gs = dealRandom(ns, 6, rng);
        gs.forEach(group => {
          const ms = group.map(s => s.name);
          let given;
          if (mode === 'on') given = M.assignRoles(ms, rolesList, h, g, rng);
          else { const pool = rolesList.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } given = ms.map((_, i) => pool[i % pool.length]); }
          ms.forEach((nm, i) => {
            const fresh = rolesList.some(r => !M.roleCount(h, nm, r));
            if (fresh && M.roleCount(h, nm, given[i]) > 0) { if (mode === 'on') repeatsOn++; else repeatsRandom++; }
            if (mode === 'on') slots++;
          });
          h = M.recordRoles(h, ms, given, g);
        });
      }
      let worst = 0;
      ns.forEach(nm => { const cs = rolesList.map(r => M.roleCount(h, nm, r)); worst += Math.max(...cs) - Math.min(...cs); });
      if (mode === 'on') spreadOn += worst / ns.length; else spreadRandom += worst / ns.length;
    }
  }
  console.log(`  roles over a class that regroups every round: gap between a student's most- and least-held role ${(spreadOn / SEEDS).toFixed(2)} vs ${(spreadRandom / SEEDS).toFixed(2)} at random; repeat while a new role was open ${repeatsOn} vs ${repeatsRandom} of ${slots}`);
  ok(spreadOn < spreadRandom * 0.6, 'a student\'s most-held and least-held role are closer than at random');
  ok(repeatsOn < repeatsRandom * 0.35, 'a student rarely gets a role they have held while one they have not is on the list');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
