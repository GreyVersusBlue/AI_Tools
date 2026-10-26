// grouping.test.mjs — pure-logic tests for _shared/grouping.js (Path 13 P1):
// plan(), formGroups(), rotateRoles(), coverRoles() and the memory.
//
//   node Tools/grouping/test/grouping.test.mjs            (or: npm run test:grouping)
//   node Tools/grouping/test/grouping.test.mjs --update   rewrite golden.json
//
// grouping.js is a classic script that publishes window.Grouping, so it runs
// here in a vm context, as export.js's suite does. Every check is a named
// function of the engine. Each is run against the real file, and then against
// a copy with the rule it guards broken on purpose (MUTANTS at the end), which
// it must fail: a check that cannot fail is not counted as one. golden.json
// holds twelve results for fixed seeds, so a later change that moves a draw
// fails by name; --update rewrites it, and that diff belongs in the commit.
// Parity with the six tools the engine replaces is parity.test.mjs.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const SRC = fs.readFileSync(path.join(site, '_shared/grouping.js'), 'utf8');
const GOLDEN = path.join(here, 'golden.json');
const UPDATE = process.argv.includes('--update');
function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.Grouping;
}
const J = x => JSON.stringify(x);
const names = n => Array.from({ length: n }, (_, i) => 'S' + String(i + 1).padStart(2, '0'));
const flat = gs => gs.reduce((a, g) => a.concat(g), []);

/* Each check returns true, or a string saying what was wrong. */
const CHECKS = {
  'plan: sizes add up, spread differs by one, ceil never over, floor never under'(G) {
    for (let n = 0; n <= 60; n++) {
      for (const size of [1, 2, 3, 4, 5, 7]) {
        for (const sizeRule of ['ceil', 'near', 'floor']) {
          for (const remainder of ['spread', 'floaters', 'own-group']) {
            const p = G.plan(n, { size, sizeRule, remainder });
            const sum = p.sizes.reduce((a, b) => a + b, 0);
            if (sum + p.floaters + p.ownGroup !== n) return `n ${n} size ${size} ${sizeRule}/${remainder}: ${sum}+${p.floaters}+${p.ownGroup}`;
            if (remainder === 'spread' && p.sizes.length && Math.max(...p.sizes) - Math.min(...p.sizes) > 1) return `spread n ${n} size ${size}`;
            if (sizeRule === 'ceil' && p.sizes.some(x => x > size)) return `ceil over: n ${n} size ${size} ${J(p.sizes)}`;
            if (sizeRule === 'floor' && n >= size && p.sizes.some(x => x < size)) return `floor under: n ${n} size ${size} ${J(p.sizes)}`;
            if (remainder === 'own-group' && p.floaters > 1) return `own-group left ${p.floaters} floaters`;
          }
        }
      }
    }
    return true;
  },
  'plan: 30 by 4 is six 4s and two 3s; floor with floaters is seven 4s and 2 floaters'(G) {
    const a = G.plan(30, { size: 4 });
    const b = G.plan(30, { size: 4, sizeRule: 'floor', remainder: 'floaters' });
    const c = G.plan(30, { size: 4, sizeRule: 'floor', remainder: 'own-group' });
    const d = G.plan(29, { size: 4, sizeRule: 'floor', remainder: 'own-group' });
    if (J(a.sizes) !== J([4, 4, 4, 4, 4, 4, 3, 3])) return 'ceil ' + J(a.sizes);
    if (J(b.sizes) !== J([4, 4, 4, 4, 4, 4, 4]) || b.floaters !== 2) return 'floor ' + J(b);
    if (c.ownGroup !== 2 || c.floaters) return 'own group ' + J(c);
    if (d.ownGroup || d.floaters !== 1 || d.note !== 'one-left') return 'one left ' + J(d);
    return true;
  },
  'plan: a count is clamped to the class unless allowEmpty, and min holds'(G) {
    if (G.plan(3, { count: 8 }).count !== 3) return 'not clamped';
    if (G.plan(3, { count: 8, allowEmpty: true }).count !== 8) return 'allowEmpty clamped';
    if (G.plan(0, { count: 4 }).count !== 0) return 'no members made groups';
    if (G.plan(10, { count: 1, min: 2 }).count !== 2) return 'min ignored';
    return true;
  },
  'formGroups: every strategy places each present member exactly once'(G) {
    const strategies = ['random', 'balanced', 'heterogeneous', 'homogeneous', 'coverage', 'spread'];
    for (let s = 0; s < 500; s++) {
      const r = G.rng('place' + s);
      const n = s % 41;
      const ms = names(n).map(k => ({ key: k, attrs: { skill: 1 + Math.floor(r() * 5), team: 'abc'[Math.floor(r() * 3)] } }));
      const absent = ms.filter(() => r() < (s % 50 === 7 ? 1 : 0.15)).map(m => m.key);
      const opts = {
        strategy: strategies[s % 6], by: s % 6 === 5 ? 'team' : 'skill', seed: s, absent,
        remainder: ['spread', 'floaters', 'own-group'][s % 3],
        apart: s % 4 === 0 && n > 3 ? [[ms[0].key, ms[1].key], [ms[2].key, ms[3].key]] : [],
        together: s % 5 === 0 && n > 5 ? [[ms[4].key, ms[5].key]] : []
      };
      if (s % 2) opts.size = 1 + (s % 7); else opts.count = 1 + (s % 9);
      const out = G.formGroups(ms, opts);
      const placed = flat(out.groups).concat(out.floaters).sort();
      const want = ms.map(m => m.key).filter(k => !absent.includes(k)).sort();
      if (J(placed) !== J(want)) return `seed ${s} n ${n} ${opts.strategy}: placed ${placed.length} of ${want.length}`;
      if (J(out.absent.slice().sort()) !== J(absent.slice().sort())) return `seed ${s}: absent list`;
    }
    return true;
  },
  'formGroups: the same seed twice gives the same result, and a chosen seed reproduces'(G) {
    const ms = names(23).map(k => ({ key: k, attrs: { skill: k.length } }));
    const a = G.formGroups(ms, { count: 5, seed: 'abc' });
    const b = G.formGroups(ms, { count: 5, seed: 'abc' });
    if (J(a.groups) !== J(b.groups)) return 'same seed, different groups';
    const c = G.formGroups(ms, { count: 5 });
    if (typeof c.seed !== 'number') return 'no seed returned';
    if (J(G.formGroups(ms, { count: 5, seed: c.seed }).groups) !== J(c.groups)) return 'seed did not reproduce';
    G.pin(7);
    const p1 = G.formGroups(ms, { count: 5 });
    G.pin(7);
    const p2 = G.formGroups(ms, { count: 5 });
    G.pin(null);
    if (J(p1.groups) !== J(p2.groups)) return 'pin did not repeat';
    if (J(G.formGroups(ms, { count: 5, seed: 1, rng: G.rng(2) }).groups) !== J(G.formGroups(ms, { count: 5, seed: 1 }).groups)) return 'rng beat seed';
    return true;
  },
  'formGroups: locked groups stay at their index; a locked member absent drops the locks'(G) {
    const ms = names(20);
    const first = G.formGroups(ms, { count: 4, seed: 3 });
    const lock = [false, true, false, true];
    const again = G.formGroups(ms, { count: 9, previous: first.groups, lock, seed: 4 });
    if (J(again.groups[1]) !== J(first.groups[1]) || J(again.groups[3]) !== J(first.groups[3])) return 'locked group moved';
    if (again.groups.length !== 4 || again.stats.lockedCount !== 2 || again.stats.locksDropped) return 'count not fixed by previous ' + J(again.stats);
    const gone = G.formGroups(ms, { count: 4, previous: first.groups, lock, absent: [first.groups[1][0]], seed: 4 });
    if (!gone.stats.locksDropped || gone.stats.lockedCount !== 0) return 'locks kept with a locked member absent';
    return true;
  },
  'formGroups: impossible names the three shapes'(G) {
    const ms = names(12);
    const big = G.formGroups(ms, { count: 4, together: [['S01', 'S02'], ['S02', 'S03'], ['S03', 'S04']], seed: 1 });
    if (!big.impossible.some(x => x.code === 'together-too-big')) return 'a set of 4 into groups of 3 not named';
    const holds = G.formGroups(ms, { count: 3, together: [['S01', 'S02'], ['S02', 'S03']], apart: [['S01', 'S03']], seed: 1 });
    if (!holds.impossible.some(x => x.code === 'together-holds-apart')) return 'a together set holding an apart pair not named';
    const clique = [];
    ['S01', 'S02', 'S03', 'S04'].forEach((a, i, l) => l.slice(i + 1).forEach(b => clique.push([a, b])));
    const many = G.formGroups(ms, { count: 3, apart: clique, seed: 1 });
    if (!many.impossible.some(x => x.code === 'apart-more-than-groups')) return 'four all apart into three groups not named';
    return true;
  },
  'formGroups: nothing impossible is reported on 2,000 satisfiable classes'(G) {
    for (let c = 0; c < 2000; c++) {
      const r = G.rng('sat' + c);
      const n = 8 + Math.floor(r() * 25), k = 2 + Math.floor(r() * 6);
      const ms = names(n);
      const truth = G.formGroups(ms, { count: k, seed: c }).groups;   // a grouping that keeps every rule below
      const at = {};
      truth.forEach((g, i) => g.forEach(m => { at[m] = i; }));
      const apart = [], together = [];
      for (let i = 0; i < 12; i++) {
        const a = ms[Math.floor(r() * n)], b = ms[Math.floor(r() * n)];
        if (a === b) continue;
        (at[a] === at[b] ? together : apart).push([a, b]);
      }
      const out = G.formGroups(ms, { count: k, apart, together, seed: c + 1 });
      if (out.impossible.length) return `class ${c}: ${J(out.impossible[0])}`;
    }
    return true;
  },
  'formGroups: together units leaves no chain broken where pairs leaves some'(G) {
    // Two chains of three (A-B, B-C; D-E, E-F) in 28 by 7: measured 4.5% broken
    // in 2,000 shuffles with pairs (BACKLOG, Path 13 P1, item 4).
    const ms = names(28);
    const together = [['S01', 'S02'], ['S02', 'S03'], ['S04', 'S05'], ['S05', 'S06']];
    let pairs = 0, units = 0;
    for (let s = 0; s < 2000; s++) {
      if (G.formGroups(ms, { count: 7, together, seed: s }).violations.together.length) pairs++;
      if (G.formGroups(ms, { count: 7, together, seed: s, search: { together: 'units' } }).violations.together.length) units++;
    }
    if (units) return `units broke ${units} of 2000`;
    if (pairs < 40 || pairs > 160) return `pairs broke ${pairs} of 2000, outside 2% to 8% round the measured 4.5%`;
    return true;
  },
  'formGroups: together units still makes groups of the planned sizes, floaters too'(G) {
    const ms = names(30);
    const together = [['S01', 'S02'], ['S02', 'S03'], ['S04', 'S05']];
    for (let s = 0; s < 300; s++) {
      const out = G.formGroups(ms, { size: 4, sizeRule: 'floor', remainder: 'floaters', together, seed: s, search: { together: 'units' } });
      if (J(out.stats.sizes) !== J([4, 4, 4, 4, 4, 4, 4]) || out.floaters.length !== 2) return `seed ${s}: ${J(out.stats.sizes)} + ${out.floaters.length}`;
      if (out.violations.together.length) return `seed ${s}: a block was popped`;
    }
    return true;
  },
  'formGroups: keepStrategy holds the balanced gap after four generations of memory'(G) {
    // Measured without it: 0.38 on the first shuffle, 1.56 to 1.89 after (item 2).
    let first = 0, kept = 0, lost = 0;
    const CLASSES = 150;
    for (let c = 0; c < CLASSES; c++) {
      const r = G.rng('bal' + c);
      const ms = names(28).map(k => ({ key: k, attrs: { skill: 1 + Math.floor(r() * 5) } }));
      const gap = gs => { const m = gs.map(g => g.reduce((s, k) => s + ms.find(x => x.key === k).attrs.skill, 0) / g.length); return Math.max(...m) - Math.min(...m); };
      for (const keep of [true, false]) {
        let h = G.history.empty();
        for (let g = 0; g < 4; g++) {
          const out = G.formGroups(ms, { count: 7, strategy: 'balanced', history: h, seed: c * 10 + g, search: { keepStrategy: keep } });
          if (g === 0 && keep) first += gap(out.groups);
          if (g === 3) { if (keep) kept += gap(out.groups); else lost += gap(out.groups); }
          h = G.history.record(h, out.groups, { members: ms });
        }
      }
    }
    first /= CLASSES; kept /= CLASSES; lost /= CLASSES;
    if (kept > first + 0.1) return `fourth gap ${kept.toFixed(2)} against first ${first.toFixed(2)}`;
    if (lost < 1) return `without keepStrategy the gap stayed ${lost.toFixed(2)}, so this proves nothing`;
    return true;
  },
  'formGroups: restarts never return a worse score than no restarts'(G) {
    // Three all apart into two groups: every try ends broken, so every restart runs.
    const ms = names(30);
    const apart = [['S01', 'S02'], ['S01', 'S03'], ['S02', 'S03']];
    for (let i = 0; i < 30; i++) apart.push([ms[(i * 7 + 4) % 30], ms[(i * 11 + 9) % 30]]);
    for (let s = 0; s < 300; s++) {
      const a = G.formGroups(ms, { count: 2, apart, seed: s, search: { attempts: 30 } });
      const b = G.formGroups(ms, { count: 2, apart, seed: s, search: { attempts: 30, restarts: 3 } });
      for (let i = 0; i < 4; i++) {
        if (b.stats.score[i] !== a.stats.score[i]) { if (b.stats.score[i] > a.stats.score[i]) return `seed ${s}: ${J(b.stats.score)} worse than ${J(a.stats.score)}`; break; }
      }
      if (a.stats.score[0] > 0 && b.stats.tries < 2) return `seed ${s}: no restart ran`;
    }
    return true;
  },
  'formGroups: the repair is skipped with nothing to repair, and reports how it stopped'(G) {
    const ms = names(12);
    if (G.formGroups(ms, { count: 3, seed: 1 }).stats.stoppedBy !== 'skipped') return 'not skipped';
    const clean = G.formGroups(ms, { count: 3, apart: [['S01', 'S02']], seed: 1 });
    if (clean.stats.stoppedBy !== 'clean' || clean.violations.apart.length) return 'not clean ' + clean.stats.stoppedBy;
    const clique = [];
    ['S01', 'S02', 'S03', 'S04'].forEach((a, i, l) => l.slice(i + 1).forEach(b => clique.push([a, b])));
    const stuck = G.formGroups(ms, { count: 3, apart: clique, seed: 1, search: { attempts: 50 } });
    if (stuck.stats.stoppedBy !== 'budget' || stuck.stats.attempts !== 50) return 'budget ' + J(stuck.stats);
    return true;
  },
  'formGroups: a strategy reading an attribute nobody has falls back to random'(G) {
    const out = G.formGroups(names(10), { count: 2, strategy: 'balanced', seed: 1 });
    if (out.stats.strategy !== 'random' || !out.stats.fellBack) return J(out.stats);
    const bad = G.formGroups(names(10), { count: 2, strategy: 'nonsense', apart: 'x', seed: 1 });
    if (!bad.dropped.some(d => d.option === 'strategy') || !bad.dropped.some(d => d.option === 'apart')) return 'malformed options not dropped ' + J(bad.dropped);
    return true;
  },
  'formGroups: spread deals a category evenly'(G) {
    for (let s = 0; s < 200; s++) {
      const r = G.rng('spr' + s);
      const ms = names(24).map(k => ({ key: k, attrs: { team: 'abcd'[Math.floor(r() * 4)] } }));
      const out = G.formGroups(ms, { count: 4, strategy: 'spread', by: 'team', seed: s });
      for (const t of 'abcd') {
        const per = out.groups.map(g => g.filter(k => ms.find(m => m.key === k).attrs.team === t).length);
        if (Math.max(...per) - Math.min(...per) > 1) return `seed ${s} team ${t}: ${J(per)}`;
      }
    }
    return true;
  },
  'formGroups: the memory steers away from last time and is never written'(G) {
    const ms = names(24);
    let h = G.history.empty();
    const first = G.formGroups(ms, { count: 6, seed: 1 });
    h = G.history.record(h, first.groups, { members: ms });
    const frozen = J(h);
    const second = G.formGroups(ms, { count: 6, history: h, seed: 2 });
    if (J(h) !== frozen) return 'formGroups wrote the memory';
    if (second.violations.repeats.length > 2) return `${second.violations.repeats.length} repeats of last time`;
    if (second.stats.newPairs + second.violations.repeats.length !== second.stats.totalPairs) return 'pair counts ' + J(second.stats);
    return true;
  },
  'rotateRoles: best never repeats when an assignment without a repeat exists'(G) {
    for (let c = 0; c < 300; c++) {
      const r = G.rng('best' + c);
      const size = 2 + Math.floor(r() * 7), nroles = 2 + Math.floor(r() * 5);
      const roles = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, nroles);
      const g = names(size);
      let h = G.history.empty();
      for (let m = 0; m < 12; m++) {
        const out = G.rotateRoles([g], roles, h, { method: 'best', seed: c * 100 + m });
        // a repeat is avoidable unless more members hold-last a role than there are other slots
        const lastOf = k => { const l = G.history.rolesOf(h, k); return l[l.length - 1]; };
        const slots = roles.concat(Array(Math.max(0, size - nroles)).fill(null));
        const avoidable = canAvoid(g.map(lastOf), slots);
        if (avoidable && out.repeats.length) return `class ${c} meeting ${m}: ${out.repeats.length} repeats`;
        h = G.history.record(h, out.byGroup.map(x => x.map(y => y.key)), { roles: out.byGroup, pairs: false });
      }
    }
    return true;
  },
  'rotateRoles: greedy repeats inside a band round the measured 1.1%'(G) {
    let repeats = 0, total = 0;
    for (let c = 0; c < 2000; c++) {
      let h = G.history.empty();
      const g = names(4);
      for (let m = 0; m < 12; m++) {
        const out = G.rotateRoles([g], ['A', 'B', 'C', 'D'], h, { seed: 'g' + c + ':' + m });
        repeats += out.repeats.length; total += 4;
        h = G.history.record(h, [g], { roles: out.byGroup, pairs: false });
      }
    }
    const rate = repeats / total;
    if (rate < 0.007 || rate > 0.016) return `greedy repeat rate ${(rate * 100).toFixed(2)}%`;
    return true;
  },
  'rotateRoles: a member past the last role gets null, and a map history is read'(G) {
    const out = G.rotateRoles([['a', 'b', 'c']], ['Leader'], { a: ['Leader'] }, { seed: 1 });
    const roles = out.byGroup[0].map(x => x.role);
    if (roles.filter(x => x === null).length !== 2 || !roles.includes('Leader')) return J(out);
    const best = G.rotateRoles([['a', 'b', 'c']], ['Leader'], { a: ['Leader'] }, { method: 'best', seed: 1 });
    if (best.byGroup[0][0].role === 'Leader') return 'best gave a its last role';
    const forced = G.rotateRoles([['a']], ['Leader'], { a: ['Leader'] }, { seed: 1 });
    if (J(forced.repeats) !== J(['a'])) return 'a forced repeat from a map history not reported ' + J(forced);
    return true;
  },
  'coverRoles: an absent member’s role goes round the present ones'(G) {
    const g = [{ key: 'a', role: 'Leader' }, { key: 'b', role: 'Reader' }, { key: 'c', role: 'Writer' }, { key: 'd', role: 'Checker' }];
    const one = G.coverRoles(g, ['b']).map(x => x.effectiveRole);
    if (J(one) !== J(['Leader + Reader', null, 'Writer', 'Checker'])) return 'one absent ' + J(one);
    const two = G.coverRoles(g, ['a', 'c']).map(x => x.effectiveRole);
    if (J(two) !== J([null, 'Reader + Leader', null, 'Checker + Writer'])) return 'two absent ' + J(two);
    const all = G.coverRoles(g, ['a', 'b', 'c', 'd']).map(x => x.effectiveRole);
    if (J(all) !== J([null, null, null, null])) return 'everyone absent ' + J(all);
    const none = G.coverRoles([{ key: 'a', role: null }, { key: 'b', role: 'R' }], ['a']).map(x => x.effectiveRole);
    if (J(none) !== J([null, 'R'])) return 'absent with no role ' + J(none);
    return true;
  },
  'history: record, then count and lastGen'(G) {
    const H = G.history;
    let h = H.record(H.empty(), [['a', 'b', 'c'], ['d', 'e']]);
    h = H.record(h, [['a', 'b'], ['c', 'd', 'e']]);
    if (H.count(h, 'a', 'b') !== 2 || H.lastGen(h, 'a', 'b') !== 2) return 'a-b';
    if (H.count(h, 'b', 'a') !== 2) return 'order mattered';
    if (H.count(h, 'a', 'c') !== 1 || H.lastGen(h, 'a', 'c') !== 1) return 'a-c';
    if (H.count(h, 'a', 'e') !== 0 || h.gen !== 2) return 'a-e / gen';
    const roles = H.record(h, [['a']], { roles: { a: 'Leader' }, pairs: false });
    if (J(H.rolesOf(roles, 'a')) !== J(['Leader']) || H.count(roles, 'a', 'b') !== 2) return 'roles-only record';
    let capped = H.empty();
    for (let i = 0; i < 40; i++) capped = H.record(capped, [['x']], { roles: { x: 'R' + i }, pairs: false });
    if (H.rolesOf(capped, 'x').length !== 30 || H.rolesOf(capped, 'x')[0] !== 'R10') return 'roles not capped at 30';
    return true;
  },
  'history: normalize repairs fifteen broken shapes and never throws'(G) {
    const H = G.history;
    const shapes = [null, undefined, 7, 'x', [], {}, { keys: 'a' }, { v: 1, keys: [1, null, ''] },
      { v: 1, gen: -3, keys: ['a', 'b'], pairs: { '0.1': 'x' } },
      { v: 1, gen: 2, keys: ['a', 'a', 'b'], names: ['A'], pairs: { '0.2': [1, 2], '1.2': [2, 1] } },
      { v: 1, gen: 2, keys: ['a', 'b'], pairs: { '0.0': [1, 1], '0.9': [1, 1], 'x.y': [1, 1], '0.1': [5, 1] } },
      { v: 1, gen: 2, keys: ['__proto__', 'constructor', 'prototype', 'ok'] },
      { v: 1, gen: 1, keys: ['a'], roles: { 0: 'x', 1: ['y'], '__proto__': ['z'] } },
      { v: 1, gen: 1, keys: ['a'], roles: { 0: ['', 3, 'R'] }, seen: ['q'] },
      JSON.parse('{"v":1,"gen":1,"keys":["a","b"],"pairs":{"__proto__":[1,1],"0.1":[1,0]}}')];
    const out = [];
    for (const s of shapes) {
      let n;
      try { n = H.normalize(s); } catch (e) { return 'threw on ' + J(s); }
      if (n.v !== 1 || !Array.isArray(n.keys) || n.keys.length !== n.names.length || n.keys.length !== n.seen.length) return 'bad shape from ' + J(s);
      if (n.keys.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) return 'kept a prototype key';
      out.push(n);
    }
    if (J(out[9].keys) !== J(['a', 'b']) || H.count(out[9], 'a', 'b') !== 2) return 'a repeated key merged wrong ' + J(out[9]);
    if (Object.keys(out[10].pairs).length !== 1 || H.lastGen(out[10], 'a', 'b') !== 2) return 'bad pair keys kept or gen not clamped';
    if (J(out[11].keys) !== J(['ok'])) return 'prototype keys';
    if (J(H.rolesOf(out[13], 'a')) !== J(['R']) || out[13].seen[0] !== 0) return 'roles or seen not repaired';
    if (H.count(out[14], 'a', 'b') !== 0) return 'a zero count kept';
    return true;
  },
  'history: prune under the three policies'(G) {
    const H = G.history;
    let h = H.record(H.empty(), [['a', 'b'], ['c', 'd']]);
    h = H.record(h, [['a', 'c']], { members: ['a', 'b', 'c', 'd'] });
    h = H.record(h, [['a', 'b']], { members: ['a', 'b', 'c'] });
    const drop = H.prune(h, ['a', 'b', 'c'], { departed: 'drop' });
    if (drop.keys.includes('d') || H.count(drop, 'a', 'b') !== 2) return 'drop ' + J(drop.keys);
    const keep = H.prune(h, ['a'], { departed: 'keep' });
    if (keep.keys.length !== 4) return 'keep dropped someone';
    if (H.prune(h, ['a'], {}).keys.length !== 4) return 'the default is not keep';
    // c was handed in at gen 3, d last at gen 2: one grouping has gone by without d.
    const g1 = H.prune(h, ['a', 'b'], { departed: { gens: 1 } });
    if (!g1.keys.includes('c') || g1.keys.includes('d')) return 'gens 1 ' + J(g1.keys);
    const g2 = H.prune(h, ['a', 'b'], { departed: { gens: 2 } });
    if (!g2.keys.includes('d')) return 'gens 2 dropped d after one grouping';
    const g3 = H.prune(H.record(h, [['a', 'b']], { members: ['a', 'b'] }), ['a', 'b'], { departed: { gens: 2 } });
    if (g3.keys.includes('d') || !g3.keys.includes('c')) return 'gens 2 after four ' + J(g3.keys);
    return true;
  },
  'history: rekey onto an existing key adds counts and keeps the target’s roles'(G) {
    const H = G.history;
    let h = H.record(H.empty(), [['a', 'x', 'b']], { roles: { a: 'R1', b: 'R2' } });
    h = H.record(h, [['b', 'x']], { roles: { b: 'R3' } });
    const m = H.rekey(h, 'a', 'b');
    if (m.keys.includes('a')) return 'from kept';
    if (H.count(m, 'b', 'x') !== 3 || H.lastGen(m, 'b', 'x') !== 2) return 'counts ' + H.count(m, 'b', 'x');
    if (J(H.rolesOf(m, 'b')) !== J(['R2', 'R3'])) return 'roles merged ' + J(H.rolesOf(m, 'b'));
    if (H.count(m, 'a', 'b') !== 0) return 'the pair with each other kept';
    const r = H.rekey(h, 'a', 'z');
    if (H.count(r, 'z', 'x') !== 1 || J(H.rolesOf(r, 'z')) !== J(['R1'])) return 'rename in place';
    return true;
  },
  'history: identify follows ids, names, a remade roster, and two of one name'(G) {
    const H = G.history;
    // no ids at all
    const a = H.identify(H.empty(), ['Ann', 'Bo'], {});
    if (J(a.members.map(m => m.key)) !== J(['n:Ann', 'n:Bo'])) return 'no ids ' + J(a.members);
    let h = H.record(a.history, [['n:Ann', 'n:Bo']]);
    // a first id for a student known by name: re-keyed, memory kept
    const b = H.identify(h, ['Ann', 'Bo'], { Ann: 'id1' });
    if (b.members[0].key !== 'i:id1' || H.count(b.history, 'i:id1', 'n:Bo') !== 1 || !b.moved.some(x => x.why === 'rekeyed')) return 'first id ' + J(b);
    h = b.history;
    // a rename followed by id
    const c = H.identify(h, ['Annie', 'Bo'], { Annie: 'id1' });
    if (c.members[0].key !== 'i:id1' || c.history.names[c.history.keys.indexOf('i:id1')] !== 'Annie' || !c.moved.some(x => x.why === 'renamed' && x.toName === 'Annie')) return 'rename ' + J(c);
    // a roster made again in 006, new ids for the same names
    const d = H.identify(h, ['Ann', 'Bo'], { Ann: 'id9', Bo: 'id8' });
    if (H.count(d.history, d.members[0].key, d.members[1].key) !== 1 || d.members[0].key !== 'i:id9') return 'remade roster ' + J(d.members);
    // a renamed student and a new one taking the old name
    const e = H.identify(h, ['Ann', 'Annie', 'Bo'], { Ann: 'id5', Annie: 'id1' });
    if (e.members[1].key !== 'i:id1' || e.members[0].key !== 'i:id5' || H.count(e.history, 'i:id5', 'n:Bo') !== 0) return 'new Ann took the memory ' + J(e.members);
    // a name retyped that still exists as another student, with no id
    const f = H.identify(h, ['Ann', 'Bo', 'Bo'], {});
    if (J(f.members.map(m => m.key)) !== J(['i:id1', 'n:Bo', 'n:Bo#2']) || J(f.duplicates) !== J(['Bo'])) return 'two of one name ' + J(f.members);
    return true;
  },
  'history: coverage against a count written here'(G) {
    const H = G.history;
    let h = H.empty();
    h = H.record(h, [['a', 'b'], ['c', 'd']]);
    h = H.record(h, [['a', 'c'], ['b', 'd']]);
    h = H.record(h, [['a', 'b'], ['c', 'd']]);
    const cv = H.coverage(h, ['a', 'b', 'c', 'd']);
    // met: a-b (2), c-d (2), a-c (1), b-d (1); never: a-d, b-c
    if (cv.met !== 4 || cv.possible !== 6) return `met ${cv.met} of ${cv.possible}`;
    if (J(cv.never) !== J([['a', 'd'], ['b', 'c']])) return 'never ' + J(cv.never);
    if (cv.counts.a.b !== 2 || cv.counts.b.a !== 2 || cv.counts.a.d !== 0) return 'counts';
    return true;
  },
  'golden: twelve fixed-seed results'(G) {
    const now = goldenResults(G);
    const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
    for (const k of Object.keys(want)) { if (J(want[k]) !== J(now[k])) return 'moved: ' + k; }
    if (Object.keys(want).length !== 12) return 'golden.json does not hold twelve';
    return true;
  }
};

function canAvoid(lastRoles, slots) {
  // Is there an assignment of slots to members with no member given its last role?
  const n = lastRoles.length, used = Array(slots.length).fill(false);
  return (function go(i) {
    if (i === n) return true;
    for (let s = 0; s < slots.length; s++) {
      if (used[s] || (slots[s] !== null && slots[s] === lastRoles[i])) continue;
      used[s] = true;
      if (go(i + 1)) return true;
      used[s] = false;
    }
    return false;
  })(0);
}

function goldenResults(G) {
  const ms = names(26).map((k, i) => ({ key: k, attrs: { skill: 1 + (i * 7) % 5, team: 'abc'[i % 3] } }));
  let h = G.history.empty();
  h = G.history.record(h, G.formGroups(ms, { count: 6, seed: 99 }).groups, { members: ms });
  const pick = r => ({ groups: r.groups, floaters: r.floaters });
  return {
    random: pick(G.formGroups(ms, { count: 6, seed: 1 })),
    balanced: pick(G.formGroups(ms, { count: 6, strategy: 'balanced', seed: 2 })),
    heterogeneous: pick(G.formGroups(ms, { size: 4, strategy: 'heterogeneous', seed: 3 })),
    homogeneous: pick(G.formGroups(ms, { count: 5, strategy: 'homogeneous', seed: 4 })),
    coverage: pick(G.formGroups(ms, { count: 6, strategy: 'coverage', history: h, seed: 5 })),
    spread: pick(G.formGroups(ms, { count: 4, strategy: 'spread', by: 'team', seed: 6 })),
    floaters: pick(G.formGroups(ms, { size: 4, sizeRule: 'floor', remainder: 'floaters', seed: 7 })),
    ownGroup: pick(G.formGroups(ms, { size: 4, remainder: 'own-group', seed: 8 })),
    constraints: pick(G.formGroups(ms, { count: 6, apart: [['S01', 'S02'], ['S03', 'S04']], together: [['S05', 'S06']], history: h, seed: 9 })),
    units: pick(G.formGroups(ms, { count: 6, together: [['S01', 'S02'], ['S02', 'S03']], search: { together: 'units' }, seed: 10 })),
    rolesGreedy: G.rotateRoles([['S01', 'S02', 'S03'], ['S04', 'S05']], ['A', 'B', 'C'], { S01: ['A'] }, { seed: 11 }).byGroup,
    rolesBest: G.rotateRoles([['S01', 'S02', 'S03'], ['S04', 'S05']], ['A', 'B', 'C'], { S01: ['A'] }, { method: 'best', seed: 12 }).byGroup
  };
}

/* Each check, broken on purpose: [check, text to find in grouping.js, replacement]. */
const MUTANTS = [
  ['plan: sizes add up, spread differs by one, ceil never over, floor never under', "} else count = Math.ceil(n / size);", "} else count = Math.floor(n / size) || 1;"],
  ['plan: 30 by 4 is six 4s and two 3s; floor with floaters is seven 4s and 2 floaters', "if (floaters >= 2) { ownGroup = floaters; floaters = 0; }", "if (floaters >= 3) { ownGroup = floaters; floaters = 0; }"],
  ['plan: a count is clamped to the class unless allowEmpty, and min holds', "if (!opts.allowEmpty) count = Math.max(1, Math.min(count, n));", ""],
  ['formGroups: every strategy places each present member exactly once', "for (var j = 0; j < size; j++) { groups[target[i]].push(sorted[idx]); idx++; }", "for (var j = 0; j < size && i; j++) { groups[target[i]].push(sorted[idx]); idx++; }"],
  ['formGroups: the same seed twice gives the same result, and a chosen seed reproduces', "return { next: rng(s), seed: s };", "return { next: rng(s), seed: s + 1 };"],
  ['formGroups: locked groups stay at their index; a locked member absent drops the locks', "useLocks = prev.every(function (g, i) { return !lock[i] || g.every(function (k) { return present['#' + k]; }); });", "useLocks = true;"],
  ['formGroups: impossible names the three shapes', "if (count && best.length > count)", "if (count && best.length > count + 1)"],
  ['formGroups: nothing impossible is reported on 2,000 satisfiable classes', "if (s.length > largest) out.push", "if (s.length >= largest - 1) out.push"],
  ['formGroups: together units leaves no chain broken where pairs leaves some', "var units = search.together === 'units';", "var units = false;"],
  ['formGroups: together units still makes groups of the planned sizes, floaters too', "order.forEach(function (m) { groups[smallest()[0]].push(m); });", "order.forEach(function (m, i) { groups[target[i % target.length]].push(m); });"],
  ['formGroups: keepStrategy holds the balanced gap after four generations of memory', "return [hard, keepStrategy ? strategyMeasure(groups, tierOf) : 0, rep, cost];", "return [hard, 0, rep, cost];"],
  ['formGroups: restarts never return a worse score than no restarts', "if (!bestTry || cmp(rep.score, bestTry.rep.score) < 0) bestTry = { d: d, rep: rep };", "bestTry = { d: d, rep: rep };"],
  ['formGroups: the repair is skipped with nothing to repair, and reports how it stopped', "if (isZero(best)) stoppedBy = 'clean';", ""],
  ['formGroups: a strategy reading an attribute nobody has falls back to random', "strategy = 'random'; fellBack = true;", "fellBack = true;"],
  ['formGroups: spread deals a category evenly', "var x = cat(a), y = cat(b); return x < y ? -1 : (x > y ? 1 : 0);", "return 0;"],
  ['formGroups: the memory steers away from last time and is never written', "return penalties[Math.max(nowGen - lg, 1) - 1] || 0;", "return 0;"],
  ['rotateRoles: best never repeats when an assignment without a repeat exists', "if (c < bestCost) { bestCost = c; pickBest = pk.slice(); }", "if (!pickBest) { bestCost = c; pickBest = pk.slice(); }"],
  ['rotateRoles: greedy repeats inside a band round the measured 1.1%', "score: recencyScore(held(k), role) + next() * 0.5", "score: recencyScore(held(k), role) + next() * 2000"],
  ['rotateRoles: a member past the last role gets null, and a map history is read', "var v = history && own(history, k) ? history[k] : null;", "var v = null;"],
  ['coverRoles: an absent member’s role goes round the present ones', "var ti = presentIdx[cursor % presentIdx.length];\n          cursor++;", "var ti = presentIdx[0];"],
  ['history: record, then count and lastGen', "out.pairs[pk] = [gen, (out.pairs[pk] ? out.pairs[pk][1] : 0) + 1];", "out.pairs[pk] = [gen, 1];"],
  ['history: normalize repairs fifteen broken shapes and never throws', "if (!isKey(k) || own(remap, '#' + k)) return;", "if (own(remap, '#' + k)) return;"],
  ['history: prune under the three policies', "if (d === 'drop' || (gens !== null && e.gen - e.mem['#' + k].seen >= gens)) delete e.mem['#' + k];", "if (d === 'drop') delete e.mem['#' + k];"],
  ['history: rekey onto an existing key adds counts and keeps the target’s roles', "e.pairs[p] = cur ? [Math.max(cur[0], v[0]), cur[1] + v[1]] : v.slice();", "e.pairs[p] = cur ? cur : v.slice();"],
  ['history: identify follows ids, names, a remade roster, and two of one name', "if (!claimed['#' + k] && e.mem['#' + k].name === n) hit = k;", "if (e.mem['#' + k].name === n) hit = k;"],
  ['history: coverage against a count written here', "if (c) met++; else never.push([ks[i], ks[j]]);", "if (c > 1) met++; else never.push([ks[i], ks[j]]);"],
  ['golden: twelve fixed-seed results', "var j = Math.floor(next() * (i + 1));", "var j = Math.floor(next() * i);"]
];

let pass = 0, fail = 0;
function report(ok, msg) { if (ok) pass++; else { fail++; console.log('FAIL ' + msg); } }
function run(G, name) {
  try { return CHECKS[name](G); } catch (e) { return 'threw: ' + (e && e.message); }
}

const G = load(SRC);
if (UPDATE) {
  fs.writeFileSync(GOLDEN, JSON.stringify(goldenResults(G), null, 1) + '\n');
  console.log('wrote ' + path.relative(site, GOLDEN));
}
for (const name of Object.keys(CHECKS)) {
  const r = run(G, name);
  report(r === true, name + (r === true ? '' : ' — ' + r));
  if (r === true) console.log('ok   ' + name);
}
// Every check is seen failing once, with its rule broken on purpose.
const named = new Set(MUTANTS.map(m => m[0]));
for (const name of Object.keys(CHECKS)) report(named.has(name), 'no mutant breaks: ' + name);
for (const [name, find, repl] of MUTANTS) {
  if (!CHECKS[name]) { report(false, 'mutant names no check: ' + name); continue; }
  const at = SRC.split(find).length - 1;
  if (at !== 1) { report(false, `mutant text found ${at} times, not once, for: ${name}`); continue; }
  let M;
  try { M = load(SRC.replace(find, repl)); } catch (e) { report(false, 'mutant did not load: ' + name); continue; }
  const r = run(M, name);
  report(r !== true, 'the check passed with its rule broken: ' + name);
}
console.log(`${pass} passed, ${fail} failed (${Object.keys(CHECKS).length} checks, ${MUTANTS.length} broken on purpose)`);
process.exit(fail ? 1 : 0);
