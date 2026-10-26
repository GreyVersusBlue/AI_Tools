// parity.test.mjs — _shared/grouping.js against the six splitters it replaces
// (Path 13 P1). _legacy.mjs holds the pages' own functions as they were before
// any page adopted the engine; old and new are fed two generators made from the
// same seed and must return the same groups in the same order, the same
// floaters, and leave the generator at the same point (one more draw from each
// must agree). That is "for the same random numbers the engine makes the
// groups each tool makes today", checked, not claimed.
//
//   node Tools/grouping/test/parity.test.mjs     (or: npm run test:grouping)
//
// Covered: 007, 087 (both rules), 021, 027, 022 with no keep-apart pair, and
// 002 across its five strategies x three remainder rules x count and size, with
// and without apart/together pairs, locks and absences, over one to six
// generations of memory carried on both sides; the roles for 022 and 027
// across eight meetings; fromLegacy()/toLegacy*() round trips; absorbLegacy()
// on what an older page writes. For 022 WITH keep-apart pairs the claim is the
// measured one, not equality: the engine's repair is 002's, and over 2,000
// classes at each of seven shapes it may fail no more often than 022's copy.
//
// Class names here are unique: a repeated name is the one named exception
// (every copy merged two students of one name; the engine keys the second #2),
// pinned in grouping.test.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as L from './_legacy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(site, '_shared/grouping.js'), 'utf8'), ctx);
const G = ctx.window.Grouping;
const H = G.history;
const T0 = Date.now();
const lap = what => console.log(`  [${what}: ${((Date.now() - T0) / 1000).toFixed(1)} s]`);

let pass = 0, fail = 0;
const fails = new Map();
function ok(cond, name, detail) {
  if (cond) { pass++; return true; }
  fail++;
  if (!fails.has(name)) { fails.set(name, detail || ''); }
  return false;
}
const J = x => JSON.stringify(x);
const pair = seed => [G.rng(seed), G.rng(seed)];
const names = n => Array.from({ length: n }, (_, i) => 'S' + String(i + 1).padStart(2, '0'));
const sameEnd = (a, b) => a() === b();

// ── 007 ────────────────────────────────────────────────────────────────
for (let s = 0; s < 300; s++) {
  const cfg = G.rng('007:' + s);
  const n = Math.floor(cfg() * 37);              // 0..36
  const k = [0, 1, 2, 3, 4, 5, 6, 8, 40, NaN][Math.floor(cfg() * 10)];
  const list = names(n);
  if (n > 2 && cfg() < 0.3) list.splice(1, 0, list[0], '', null);   // what np-pick.js filters
  const [a, b] = pair(s);
  const old = L.np007(list, k, a);
  const neu = G.formGroups(list, { count: k, min: 2, allowEmpty: true, rng: b });
  ok(J(old) === J(neu.groups) && sameEnd(a, b), '007 makeGroups', `seed ${s} n ${n} k ${k}`);
}

{ // name-picker/test/smoke.mjs's six assertions on np-pick.js's makeGroups(),
  // moved here with the function (Path 13 P2, v336): the page's own call.
  const C28 = names(28);
  const g007 = (list, k) => G.formGroups(list, { count: k, min: 2, allowEmpty: true, seed: 8 }).groups;
  const groups = g007(C28, 4);
  const sizes = groups.map(g => g.length);
  ok(groups.length === 4, '007: four groups requested, four returned');
  ok(Math.max(...sizes) - Math.min(...sizes) <= 1, '007: group sizes differ by at most one');
  ok(sizes.reduce((x, y) => x + y, 0) === 28, '007: everybody is in exactly one group');
  ok(new Set(groups.flat()).size === 28, '007: nobody is in two groups');
  const odd = g007(C28.slice(0, 27), 4).map(g => g.length);
  ok(Math.max(...odd) - Math.min(...odd) <= 1, '007: 27 into 4 still differs by at most one');
  ok(g007(C28, 1).length === 2, '007: a group count below 2 is clamped to 2');
}
lap('007');
// ── 087, both rules ────────────────────────────────────────────────────
for (const by of ['count', 'size']) {
  for (let s = 0; s < 300; s++) {
    const cfg = G.rng('087:' + by + s);
    const n = 1 + (s % 36);
    const v = 1 + Math.floor(cfg() * 9);
    const [a, b] = pair(s + 1000);
    const old = L.cs087(names(n), by, v, a);
    const opts = by === 'count' ? { count: v } : { size: v, sizeRule: 'near' };
    const neu = G.formGroups(names(n), Object.assign(opts, { rng: b }));
    ok(J(old) === J(neu.groups) && sameEnd(a, b), '087 makeGroups ' + by, `seed ${s} n ${n} v ${v}`);
  }
}
{ // no names: 087 returns no groups, and so does the engine without allowEmpty
  const [a, b] = pair(5);
  ok(J(L.cs087([], 'count', 3, a)) === J(G.formGroups([], { count: 3, rng: b }).groups), '087 no names');
}

lap('087');
// ── 021 ────────────────────────────────────────────────────────────────
for (let s = 0; s < 300; s++) {
  const cfg = G.rng('021:' + s);
  const n = 1 + (s % 36);
  const k = Math.max(1, Math.floor(cfg() * 12));
  const [a, b] = pair(s + 2000);
  const old = L.pe021(names(n), String(k), a);
  const neu = G.formGroups(names(n), { count: k, allowEmpty: true, rng: b });
  ok(J(old) === J(neu.groups) && sameEnd(a, b), '021 split', `seed ${s} n ${n} k ${k}`);
}

lap('021');
// ── 027 and 022 (no keep-apart), groups then roles over eight meetings ──
const ROLE_SETS = [['Leader', 'Reader', 'Writer', 'Checker'], ['Discussion Director', 'Summarizer', 'Connector'],
  ['A', 'B', 'C', 'D', 'E', 'F'], ['Solo']];
for (const tool of ['027', '022']) {
  for (let s = 0; s < 300; s++) {
    const cfg = G.rng(tool + ':' + s);
    const n = 1 + (s % 36);
    const mode = cfg() < 0.5 ? 'size' : 'count';
    const splitValue = String(1 + Math.floor(cfg() * 7));
    const roles = ROLE_SETS[Math.floor(cfg() * ROLE_SETS.length)];
    const [a, b] = pair(s + (tool === '027' ? 3000 : 4000));
    const v = Math.max(1, parseInt(splitValue, 10) || 1);
    const opts = mode === 'size' ? { size: v } : { count: v };
    const legacyState = { history: {} };
    let h = H.empty();
    const meetings = s < 60 ? 8 : 1;
    let good = true;
    for (let m = 0; m < meetings && good; m++) {
      const oldGroups = tool === '027'
        ? L.nsc027(names(n), { mode, splitValue }, a)
        : L.lab022(names(n), { mode, splitValue, keepApart: [] }, a).groups;
      const neu = G.formGroups(names(n), Object.assign({ rng: b }, opts));
      good = ok(J(oldGroups) === J(neu.groups), tool + ' makeGroups', `seed ${s} meeting ${m}`);
      // roles, group by group, recorded as each page records them
      const picker = L.rolePicker(legacyState, a);
      const oldRoles = oldGroups.map(g => {
        const asg = picker.assignRolesForGroup(g, roles);
        g.forEach(nm => picker.recordHistory(nm, asg[nm]));
        return g.map(nm => ({ key: nm, role: asg[nm] }));
      });
      const r = G.rotateRoles(neu.groups, roles, h, { rng: b });
      h = H.record(h, neu.groups, { roles: r.byGroup, pairs: false });
      good = good && ok(J(oldRoles) === J(r.byGroup), tool + ' roles', `seed ${s} meeting ${m}`)
        && ok(J(sortObj(H.toLegacyRoles(h))) === J(sortObj(legacyState.history)), tool + ' role history', `seed ${s} meeting ${m}`);
    }
    ok(sameEnd(a, b), tool + ' generator position', `seed ${s}`);
  }
}

lap('027 and 022');
// ── 022's coverage of an absent member's role ──────────────────────────
{
  const cases = [
    [[['A', 'Leader'], ['B', 'Reader'], ['C', 'Writer'], ['D', null]], ['B']],
    [[['A', 'Leader'], ['B', 'Reader'], ['C', 'Writer'], ['D', 'Checker']], ['A', 'C']],
    [[['A', 'Leader'], ['B', 'Reader']], ['A', 'B']],
    [[['A', 'Leader'], ['B', null], ['C', 'Writer']], ['B']],
    [[['A', 'Leader'], ['B', 'Reader'], ['C', 'Writer']], []]
  ];
  cases.forEach(([g, absent], i) => {
    const old = L.coverage022(g.map(([name, role]) => ({ name, role })), nm => absent.includes(nm));
    const neu = G.coverRoles(g.map(([key, role]) => ({ key, role })), absent);
    ok(J(old.map(x => [x.name, x.role, x.effectiveRole, x.absent])) === J(neu.map(x => [x.key, x.role, x.effectiveRole, x.absent])),
      '022 computeEffectiveMembers', 'case ' + i);
  });
}

lap('coverRoles');
// ── 002 across the grid ────────────────────────────────────────────────
// 100 seeds a configuration, not the 300 the simpler tools get: 002's own copy
// spends most of its 800-try budget once memory makes repeats unavoidable, at
// ~35 ms a call for 36 students, and the 30 configurations x 100 seeds x one to
// six generations are ~10,500 groupings (every class size 1 to 36 at least twice
// in each configuration). GTG_SEEDS=300 runs the full design figure.
const GTG_SEEDS = Number(process.env.GTG_SEEDS) || 100;
const STRATS = ['random', 'balanced', 'heterogeneous', 'homogeneous', 'coverage'];
const ODD = ['extra', 'floaters', 'pair'];
let gtgRuns = 0;
for (const strategy of STRATS) {
  for (const oddMode of ODD) {
    for (const mode of ['count', 'size']) {
      for (let s = 0; s < GTG_SEEDS; s++) {
        const cfg = G.rng(['002', strategy, oddMode, mode, s].join(':'));
        const n = 1 + (s % 36);
        const roster = names(n);
        const withSkill = cfg() < 0.8;
        const students = roster.map(nm => ({ name: nm, skill: withSkill && cfg() < 0.85 ? 1 + Math.floor(cfg() * 5) : null }));
        const splitValue = String(mode === 'size' ? 2 + Math.floor(cfg() * 5) : 1 + Math.floor(cfg() * 8));
        const pick = () => roster[Math.floor(cfg() * n)];
        const mkPairs = (max) => {
          const out = [];
          const m = cfg() < 0.5 ? 0 : Math.floor(cfg() * max);
          for (let i = 0; i < m && n > 1; i++) { const x = pick(), y = pick(); if (x !== y) out.push([x, y]); }
          return out;
        };
        const keepApart = mkPairs(8), keepTogether = mkPairs(4);
        const gens = 1 + (s % 6);
        const useLocks = cfg() < 0.4, useAbsent = cfg() < 0.5;
        const key = nm => 'n:' + nm;
        const name = k => k.slice(2);
        const members = students.map(st => ({ key: key(st.name), name: st.name, attrs: st.skill === null ? {} : { skill: st.skill } }));
        const legacyState = { pairHistory: {}, pairGen: 0 };
        let h = H.empty();
        let lastOld = null, lastNew = null;
        const [a, b] = pair(['002', strategy, oddMode, mode, s].join('|'));
        let good = true;
        for (let g = 0; g < gens && good; g++) {
          gtgRuns++;
          const absent = {};
          if (useAbsent) roster.forEach(nm => { if (cfg() < 0.12) absent[nm] = true; });
          const lockedFlags = useLocks && lastOld ? lastOld.groups.map(() => cfg() < 0.35) : null;
          // The page disables Generate with fewer than two present (002, line ~851).
          if (students.filter(st => !absent[st.name]).length < 2) continue;
          const old = L.gtg002({ students, absent, mode, splitValue, strategy, oddMode, keepApart, keepTogether,
            lastGroups: lastOld ? { groups: lastOld.groups } : null, state: legacyState }, { lockedFlags }, a);
          h = H.prune(h, members.map(m => m.key), { departed: 'drop' });
          const v = Math.max(1, parseInt(splitValue, 10) || 1);
          const neu = G.formGroups(members, {
            count: mode === 'count' ? v : undefined, size: mode === 'size' ? v : undefined,
            remainder: oddMode, strategy, absent: Object.keys(absent).map(key),
            apart: keepApart.map(p => p.map(key)), together: keepTogether.map(p => p.map(key)),
            previous: lastNew ? lastNew.groups : undefined, lock: lockedFlags || undefined,
            history: h, rng: b
          });
          const og = old.groups.map(gr => gr.map(st => st.name));
          const ng = neu.groups.map(gr => gr.map(name));
          const tag = `${strategy}/${oddMode}/${mode} seed ${s} n ${n} gen ${g}`;
          good = ok(J(og) === J(ng), '002 groups', tag)
            && ok(J(old.floaters.map(st => st.name)) === J(neu.floaters.map(name)), '002 floaters', tag)
            && ok(J(old.violations) === J(neu.violations.apart.map(p => p.map(name))), '002 apart violations', tag)
            && ok(J(old.togetherViolations) === J(neu.violations.together.map(p => p.map(name))), '002 together violations', tag)
            && ok(J(old.repeatViolations) === J(neu.violations.repeats.map(p => p.map(name))), '002 repeat violations', tag)
            && ok(old.meta.strategy === neu.stats.strategy, '002 strategy fallback', tag)
            && ok(old.meta.lockedCount === neu.stats.lockedCount, '002 locked count', tag)
            && ok(old.meta.bonusGroupSize === neu.stats.ownGroup, '002 own group', tag)
            && ok(!!old.meta.fallbackNote === (neu.stats.note === 'one-left'), '002 one-left note', tag)
            && ok(old.meta.newPairsThisGen === neu.stats.newPairs && old.meta.totalPairsThisGen === neu.stats.totalPairs, '002 pair counts', tag);
          h = H.record(h, neu.groups, { members });
          const lp = H.toLegacyPairs(h);
          good = good && ok(J(sortObj(lp.pairHistory)) === J(sortObj(legacyState.pairHistory)) && lp.pairGen === legacyState.pairGen,
            '002 pair memory', tag);
          lastOld = old; lastNew = neu;
        }
        ok(sameEnd(a, b), '002 generator position', `${strategy}/${oddMode}/${mode} seed ${s}`);
      }
    }
  }
}
function sortObj(o) { const out = {}; Object.keys(o).sort().forEach(k => { out[k] = o[k]; }); return out; }

lap('002 grid');
// ── the old fields, there and back ─────────────────────────────────────
{
  const legacyState = { pairHistory: {}, pairGen: 0 };
  const students = names(12).map(nm => ({ name: nm, skill: null }));
  const [a] = pair('rt');
  for (let g = 0; g < 5; g++) {
    L.gtg002({ students, absent: {}, mode: 'size', splitValue: '3', strategy: 'random', oddMode: 'extra',
      keepApart: [], keepTogether: [], lastGroups: null, state: legacyState }, {}, a);
  }
  const roles = { S01: ['Leader', 'Reader'], S02: ['Writer'], S03: [] };
  const h = H.fromLegacy({ pairHistory: legacyState.pairHistory, pairGen: legacyState.pairGen, roles });
  const lp = H.toLegacyPairs(h);
  ok(J(sortObj(lp.pairHistory)) === J(sortObj(legacyState.pairHistory)) && lp.pairGen === 5, 'fromLegacy then toLegacyPairs');
  ok(J(sortObj(H.toLegacyRoles(h))) === J({ S01: ['Leader', 'Reader'], S02: ['Writer'] }), 'fromLegacy then toLegacyRoles (an empty list is no list)');
  // 002's bare-number entries, from before { gen, count }
  const bare = H.fromLegacy({ pairHistory: { ['A' + '␟' + 'B']: 3 }, pairGen: 4 });
  ok(H.count(bare, 'n:A', 'n:B') === 1 && H.lastGen(bare, 'n:A', 'n:B') === 3, 'fromLegacy reads a bare-number entry');
  const ided = H.fromLegacy({ pairHistory: { ['Ann' + '␟' + 'Bo']: { gen: 1, count: 2 } }, pairGen: 1, idNames: { x1: 'Ann' } });
  ok(H.count(ided, 'i:x1', 'n:Bo') === 2, 'fromLegacy keys a name by its id from idNames');

  // absorbLegacy: what an older page leaves behind
  ok(J(H.absorbLegacy(null, { pairHistory: legacyState.pairHistory, pairGen: 5 })) === J(H.fromLegacy({ pairHistory: legacyState.pairHistory, pairGen: 5 })),
    'absorbLegacy with no memory is fromLegacy');
  const ahead = JSON.parse(J(legacyState));
  L.gtg002({ students, absent: {}, mode: 'size', splitValue: '3', strategy: 'random', oddMode: 'extra',
    keepApart: [], keepTogether: [], lastGroups: null, state: ahead }, {}, a);
  const merged = H.absorbLegacy(h, { pairHistory: ahead.pairHistory, pairGen: ahead.pairGen });
  const ml = H.toLegacyPairs(merged);
  ok(J(sortObj(ml.pairHistory)) === J(sortObj(ahead.pairHistory)) && ml.pairGen === 6, 'absorbLegacy takes a shuffle an older page made');
  ok(J(H.absorbLegacy(h, { pairHistory: legacyState.pairHistory, pairGen: 5 })) === J(h), 'absorbLegacy changes nothing when the old field is not ahead');
  const longer = H.absorbLegacy(h, { roles: { S01: ['Leader', 'Reader', 'Writer'], S02: ['Writer'] } });
  ok(J(H.rolesOf(longer, 'n:S01')) === J(['Leader', 'Reader', 'Writer']) && J(H.rolesOf(longer, 'n:S02')) === J(['Writer']), 'absorbLegacy takes a longer role list');
  const nofield = H.absorbLegacy(undefined, { roles: { S04: ['Reader'] } });
  ok(J(H.rolesOf(nofield, 'n:S04')) === J(['Reader']), 'absorbLegacy with the field missing reads the roles');
}

lap('legacy fields');
// ── 022 WITH keep-apart pairs: the measured claim ──────────────────────
{
  const SHAPES = [[28, 7, 10], [28, 7, 20], [28, 7, 30], [24, 4, 10], [24, 4, 20], [30, 3, 10], [30, 3, 20]];
  const lines = [];
  for (const [n, k, m] of SHAPES) {
    let oldFail = 0, newFail = 0;
    for (let c = 0; c < 2000; c++) {
      const cfg = G.rng(`apart:${n}:${k}:${m}:${c}`);
      const roster = names(n), apart = [], seen = new Set();
      while (apart.length < m) {
        const x = roster[Math.floor(cfg() * n)], y = roster[Math.floor(cfg() * n)];
        const id = x < y ? x + y : y + x;
        if (x !== y && !seen.has(id)) { seen.add(id); apart.push([x, y]); }
      }
      const r1 = G.rng('022:' + c), r2 = G.rng('eng:' + c);
      if (L.lab022(roster, { mode: 'count', splitValue: String(k), keepApart: apart }, r1).violations.length) oldFail++;
      if (G.formGroups(roster, { count: k, apart, rng: r2 }).violations.apart.length) newFail++;
    }
    lines.push(`  ${n} in ${k}, ${m} pairs: 022 ${oldFail}/2000, engine ${newFail}/2000`);
    // Where 022 never fails, the engine never may. Where some classes fail (30 in
    // 3, where most failures are classes no search can do, the design's measure),
    // the two are different draws on the same classes, so "no more often" is held
    // to three standard deviations of a count: 23 against 24 is the same rate.
    if (!oldFail) ok(newFail === 0, '022 keep-apart: the engine never fails where 022 never does', `${n} in ${k} with ${m} pairs: engine ${newFail}`);
    else ok(newFail <= oldFail + 3 * Math.sqrt(oldFail), '022 keep-apart: the engine fails no more often (3 sigma)', `${n} in ${k} with ${m} pairs: 022 ${oldFail}, engine ${newFail}`);
  }
  console.log('022 keep-apart, failures over 2,000 classes per shape:\n' + lines.join('\n'));
}

lap('022 keep-apart');
console.log(`002 grid: ${gtgRuns} groupings compared`);
for (const [name, detail] of fails) console.log('FAIL', name, '—', detail);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
