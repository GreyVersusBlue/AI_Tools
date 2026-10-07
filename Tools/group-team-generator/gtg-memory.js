/* gtg-memory.js — 002's long pairing memory and its roles, as pure functions.
   A plain script that publishes one global, `GtgMemory`, so the page can call
   it and a pure-Node suite can import it. Nothing here touches the page, the
   storage or the clock, and nothing calls Math.random: every draw comes from
   the `rng` the caller hands in, so the same groups, history and rng give the
   same answer.

   LONG MEMORY. The page already keeps every pair's count for the whole year
   (`pairHistory`: sorted "nameA␟nameB" to { gen, count }); what it steers by
   when it repairs a deal is only the last two generations. refine() adds the
   year. After the page has dealt and repaired, refine() swaps students between
   unlocked groups, always taking the swap that helps most, until none helps.
   A swap is judged on three things, compared in this order and never traded:

       1. hard   keep-apart pairs in one group + keep-together pairs split;
       2. recent pairs that shared a group last time (1000) or the time
                 before (100), the page's own penalty, word for word;
       3. spread the sum over every same-group pair of count squared.

   A swap that makes (1) worse is never taken, and one that makes (2) worse is
   taken only to mend a broken rule in (1), whatever either does to (3), so a
   rule the teacher set and the recent-repeat bias keep every bit of their
   force. Count squared is what makes it an evenness measure and not a
   total: one pair that has met four times costs 16, four pairs that have met
   once cost 4, so the search spends its swaps evening the counts out and
   leaves who has never met in the cheapest column, 0.

   Group sizes never change (a swap trades one student for another), a locked
   group is never touched, and an absent student or a floater, who are in no
   group passed in, never move.

   ROLES. assignRoles() gives each member of a group one role from the
   teacher's list so that nobody holds a role again before the others in their
   group have had a turn: the cost of giving member m role r is the marginal
   cost of m's count for r going up by one (2 x count + 1), the roles m held
   longest ago break a tie, and the cheapest whole assignment is found with the
   Hungarian method, not a greedy pass, so one student's fresh role is not
   bought with another's repeat. A group smaller than the list leaves the last
   roles of the list unfilled; a group larger than the list gives the extra
   members "no role", which is counted as a role of its own (key '') so nobody
   sits out twice before others have. Exact ties are broken by rng.

   The history is `{ [name]: { counts: { [role]: n }, last: { [role]: gen } } }`,
   names as the page keys them; '' is the key for "no role". */
(function (global) {
  'use strict';

  var SEP = '␟';
  var HARD = 0, RECENT = 1, SPREAD = 2;

  /* ── pairs ──────────────────────────────────────────────────────────── */

  function pairKey(a, b) { return a < b ? a + SEP + b : b + SEP + a; }

  function entryCount(e) { return e && typeof e === 'object' ? (e.count || 0) : (e ? 1 : 0); }
  function entryGen(e) { return e && typeof e === 'object' ? (e.gen || 0) : (e || 0); }

  function countOf(history, a, b) {
    return history ? entryCount(history[pairKey(a, b)]) : 0;
  }

  /* The page's pairRecencyPenalty, unchanged: a pair last grouped one
     generation ago (or this very one) costs 1000, two generations ago 100. */
  function recencyOf(history, gen, a, b) {
    if (!history) return 0;
    var last = entryGen(history[pairKey(a, b)]);
    if (!last) return 0;
    var gap = (gen || 0) + 1 - last;
    if (gap <= 1) return 1000;
    if (gap === 2) return 100;
    return 0;
  }

  function nameOf(s) { return typeof s === 'string' ? s : s.name; }

  /* Where each name sits: { name: groupIndex }, groups being arrays of students
     ({ name } objects or bare names). */
  function placement(groups) {
    var at = {};
    groups.forEach(function (g, i) { g.forEach(function (s) { at[nameOf(s)] = i; }); });
    return at;
  }

  /* The three scores of an arrangement, as [hard, recent, spread]. */
  function score(groups, ctx) {
    var at = placement(groups);
    var hard = 0, recent = 0, spread = 0;
    (ctx.apart || []).forEach(function (p) {
      if (at[p[0]] !== undefined && at[p[0]] === at[p[1]]) hard++;
    });
    (ctx.together || []).forEach(function (p) {
      if (at[p[0]] !== undefined && at[p[1]] !== undefined && at[p[0]] !== at[p[1]]) hard++;
    });
    groups.forEach(function (g) {
      for (var i = 0; i < g.length; i++) {
        for (var j = i + 1; j < g.length; j++) {
          var a = nameOf(g[i]), b = nameOf(g[j]);
          recent += recencyOf(ctx.history, ctx.gen, a, b);
          var c = countOf(ctx.history, a, b);
          spread += c * c;
        }
      }
    });
    return [hard, recent, spread];
  }

  function shuffled(list, rng) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* refine(groups, { history, gen, apart, together, locked, rng, spread,
                      maxSwaps })
     Swaps students between unlocked groups, in place, and returns
     { swaps, before, after }, the two scores as [hard, recent, spread].
     `locked` is { groupIndex: true }. With `spread` off it still lowers
     (hard, recent), which is the baseline a suite compares against; the page
     calls it only with `spread` on. */
  function refine(groups, opts) {
    var ctx = { history: opts.history, gen: opts.gen || 0, apart: opts.apart, together: opts.together };
    var locked = opts.locked || {};
    var rng = opts.rng;
    var useSpread = !!opts.spread;
    var maxSwaps = opts.maxSwaps || 400;
    var open = [];
    groups.forEach(function (g, i) { if (!locked[i] && g.length) open.push(i); });
    var before = score(groups, ctx);
    if (open.length < 2) return { swaps: 0, before: before, after: before };

    /* What one pair costs, worked out once per pair: [recent, spread]. */
    var all = [];
    groups.forEach(function (g) { g.forEach(function (s) { all.push(nameOf(s)); }); });
    var ix = {};
    all.forEach(function (n, i) { ix[n] = i; });
    var N = all.length, R = [], S = [];
    for (var i = 0; i < N; i++) {
      R.push(new Array(N)); S.push(new Array(N));
      for (var j = 0; j < i; j++) { R[i][j] = R[j][i]; S[i][j] = S[j][i]; }
      for (var k = i + 1; k < N; k++) {
        R[i][k] = recencyOf(ctx.history, ctx.gen, all[i], all[k]);
        var c = countOf(ctx.history, all[i], all[k]);
        S[i][k] = c * c;
      }
      R[i][i] = 0; S[i][i] = 0;
    }
    /* The rules that name each student, as [other, wantTogether]. */
    var rules = {};
    function addRule(a, b, together) {
      (rules[a] = rules[a] || []).push([b, together]);
      (rules[b] = rules[b] || []).push([a, together]);
    }
    (ctx.apart || []).forEach(function (p) { addRule(p[0], p[1], false); });
    (ctx.together || []).forEach(function (p) { addRule(p[0], p[1], true); });

    var at = placement(groups);
    /* Broken rules among those that name x or y, if x sat in group gx and y in
       group gy (everyone else where they are). A rule naming both counts once. */
    function broken(x, y, gx, gy) {
      var total = 0;
      [x, y].forEach(function (who, w) {
        (rules[who] || []).forEach(function (r) {
          var other = r[0];
          if (w === 1 && other === x) return;            // the x-y rule was counted from x
          var go = other === x ? gx : other === y ? gy : at[other];
          var gw = w === 0 ? gx : gy;
          if (go === undefined) return;
          if (r[1] ? go !== gw : go === gw) total++;
        });
      });
      return total;
    }

    var cur = before.slice(), swaps = 0;
    while (swaps < maxSwaps) {
      var cand = [];
      for (var xa = 0; xa < open.length; xa++) {
        for (var yb = xa + 1; yb < open.length; yb++) {
          for (var p = 0; p < groups[open[xa]].length; p++) {
            for (var q = 0; q < groups[open[yb]].length; q++) cand.push([open[xa], p, open[yb], q]);
          }
        }
      }
      cand = shuffled(cand, rng);
      var best = null, bd = [0, 0, 0];
      for (var ci = 0; ci < cand.length; ci++) {
        var m = cand[ci];
        var ga = groups[m[0]], gb = groups[m[2]];
        var xn = nameOf(ga[m[1]]), yn = nameOf(gb[m[3]]);
        var xi = ix[xn], yi = ix[yn];
        var dr = 0, ds = 0;
        for (var u = 0; u < ga.length; u++) {
          if (u === m[1]) continue;
          var ui = ix[nameOf(ga[u])];
          dr += R[yi][ui] - R[xi][ui]; ds += S[yi][ui] - S[xi][ui];
        }
        for (var v = 0; v < gb.length; v++) {
          if (v === m[3]) continue;
          var vi = ix[nameOf(gb[v])];
          dr += R[xi][vi] - R[yi][vi]; ds += S[xi][vi] - S[yi][vi];
        }
        var dh = broken(xn, yn, m[2], m[0]) - broken(xn, yn, m[0], m[2]);
        var d = [dh, dr, useSpread ? ds : 0];
        if (d[0] < bd[0] || (d[0] === bd[0] && (d[1] < bd[1] || (d[1] === bd[1] && d[2] < bd[2])))) { best = m; bd = d; }
      }
      if (!best) break;
      var t = groups[best[0]][best[1]];
      groups[best[0]][best[1]] = groups[best[2]][best[3]];
      groups[best[2]][best[3]] = t;
      at = placement(groups);
      cur = [cur[0] + bd[0], cur[1] + bd[1], cur[2] + bd[2]];
      swaps++;
    }
    /* The spread is reported whether or not it was steered by, so a caller can
       compare; recompute it from the groups left. */
    return { swaps: swaps, before: before, after: score(groups, ctx) };
  }

  /* How evenly a set of names has met: over every pair among `names`, the
     number that have never met, the largest count, and the spread (the
     population variance of the counts, so 0 means every pair has met the same
     number of times). */
  function coverage(history, names) {
    var n = names.length, pairs = 0, never = 0, max = 0, sum = 0, sumSq = 0;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var c = countOf(history, names[i], names[j]);
        pairs++; sum += c; sumSq += c * c;
        if (!c) never++;
        if (c > max) max = c;
      }
    }
    var mean = pairs ? sum / pairs : 0;
    return { pairs: pairs, never: never, max: max, mean: mean, variance: pairs ? sumSq / pairs - mean * mean : 0 };
  }

  /* Per student: how many classmates they have met and who they have not, in
     roster order. Names that appear in `names` only. */
  function notYet(history, names) {
    return names.map(function (a) {
      var never = [];
      names.forEach(function (b) {
        if (a !== b && !countOf(history, a, b)) never.push(b);
      });
      return { name: a, met: names.length - 1 - never.length, of: names.length - 1, never: never };
    });
  }

  /* ── roles ──────────────────────────────────────────────────────────── */

  var MAX_ROLES = 12, MAX_ROLE_LEN = 40;

  /* The teacher's list, one role per line: trimmed, blanks and repeats
     (ignoring case) dropped, cut to 40 characters and to the first 12. */
  function parseRoles(text) {
    var seen = {}, out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var r = line.trim().replace(/\s+/g, ' ').slice(0, MAX_ROLE_LEN).trim();
      var k = r.toLowerCase();
      if (!r || seen[k] || out.length >= MAX_ROLES) return;
      seen[k] = true; out.push(r);
    });
    return out;
  }

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function roleCount(h, name, role) {
    var e = h && own(h, name) ? h[name] : null;
    return e && e.counts && own(e.counts, role) ? (e.counts[role] || 0) : 0;
  }
  function roleLast(h, name, role) {
    var e = h && own(h, name) ? h[name] : null;
    return e && e.last && own(e.last, role) ? (e.last[role] || 0) : 0;
  }

  /* Cheapest assignment of rows to columns of a square integer matrix
     (the Hungarian method, O(n^3)); returns col index per row. */
  function hungarian(cost) {
    var n = cost.length, INF = Infinity;
    var u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    var p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (var i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0;
      var minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        var i0 = p[j0], delta = INF, j1 = 0;
        for (var j = 1; j <= n; j++) {
          if (used[j]) continue;
          var cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (var k = 0; k <= n; k++) {
          if (used[k]) { u[p[k]] += delta; v[k] -= delta; } else minv[k] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var jj = way[j0]; p[j0] = p[jj]; j0 = jj; } while (j0);
    }
    var res = new Array(n);
    for (var c = 1; c <= n; c++) res[p[c] - 1] = c - 1;
    return res;
  }

  /* assignRoles(names, roles, history, gen, rng) -> array parallel to names,
     each the role given or '' for none. */
  function assignRoles(names, roles, history, gen, rng) {
    var m = names.length;
    if (!m) return [];
    var filled = roles.slice(0, m);
    var cols = filled.slice();
    while (cols.length < m) cols.push('');
    var jit = Math.max(1, Math.floor(1e6 / (m + 1) / 1.5));
    var cost = names.map(function (nm) {
      return cols.map(function (role) {
        var c = roleCount(history, nm, role);
        var last = Math.min(roleLast(history, nm, role), 9999);
        return (2 * c + 1) * 1e11 + last * 1e6 + Math.floor(rng() * jit);
      });
    });
    var pick = hungarian(cost);
    return pick.map(function (j) { return cols[j]; });
  }

  /* recordRoles(history, names, given, gen) -> a new history with each name's
     count for the role it was given (or '') one higher and last = gen. */
  function recordRoles(history, names, given, gen) {
    var next = {};
    Object.keys(history || {}).forEach(function (k) { next[k] = history[k]; });
    names.forEach(function (nm, i) {
      var old = own(next, nm) ? next[nm] : { counts: {}, last: {} };
      var counts = {}, last = {};
      Object.keys(old.counts || {}).forEach(function (k) { counts[k] = old.counts[k]; });
      Object.keys(old.last || {}).forEach(function (k) { last[k] = old.last[k]; });
      var role = given[i] || '';
      counts[role] = (counts[role] || 0) + 1;
      last[role] = gen;
      next[nm] = { counts: counts, last: last };
    });
    return next;
  }

  /* A student renamed: their counts follow them, added to any the new name
     already has, the later generation kept. */
  function renameRoles(history, from, to) {
    if (!history || !own(history, from) || from === to) return history;
    var next = {};
    Object.keys(history).forEach(function (k) { if (k !== from) next[k] = history[k]; });
    var a = history[from], b = own(history, to) ? history[to] : { counts: {}, last: {} };
    var counts = {}, last = {};
    [b, a].forEach(function (e) {
      Object.keys(e.counts || {}).forEach(function (k) { counts[k] = (counts[k] || 0) + e.counts[k]; });
      Object.keys(e.last || {}).forEach(function (k) { last[k] = Math.max(last[k] || 0, e.last[k]); });
    });
    next[to] = { counts: counts, last: last };
    return next;
  }

  /* Keeps only the students on `names`, so the history is bounded by the
     roster as the pair memory is. */
  function pruneRoles(history, names) {
    var keep = {}, next = {};
    names.forEach(function (n) { keep[n] = true; });
    Object.keys(history || {}).forEach(function (k) { if (keep[k]) next[k] = history[k]; });
    return next;
  }

  /* Reads a saved role history defensively: anything that is not the shape
     above is dropped, and the keys that could poison an object are refused. */
  function normalizeRoles(h) {
    var out = {};
    if (!h || typeof h !== 'object') return out;
    Object.keys(h).forEach(function (name) {
      if (name === '__proto__' || name === 'constructor' || name === 'prototype') return;
      var e = h[name];
      if (!e || typeof e !== 'object') return;
      var counts = {}, last = {};
      Object.keys(e.counts || {}).forEach(function (r) {
        if (r === '__proto__' || r === 'constructor' || r === 'prototype') return;
        var n = e.counts[r];
        if (typeof n === 'number' && n > 0 && isFinite(n)) counts[r] = Math.floor(n);
      });
      Object.keys(e.last || {}).forEach(function (r) {
        if (!own(counts, r)) return;
        var g = e.last[r];
        if (typeof g === 'number' && g >= 0 && isFinite(g)) last[r] = Math.floor(g);
      });
      out[name] = { counts: counts, last: last };
    });
    return out;
  }

  global.GtgMemory = {
    pairKey: pairKey,
    countOf: countOf,
    recencyOf: recencyOf,
    score: score,
    refine: refine,
    coverage: coverage,
    notYet: notYet,
    parseRoles: parseRoles,
    roleCount: roleCount,
    assignRoles: assignRoles,
    recordRoles: recordRoles,
    renameRoles: renameRoles,
    pruneRoles: pruneRoles,
    normalizeRoles: normalizeRoles,
    hungarian: hungarian
  };
})(typeof window !== 'undefined' ? window : globalThis);
