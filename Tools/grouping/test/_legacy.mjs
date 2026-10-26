// _legacy.mjs — the six group splitters and the role picker as the pages had
// them on 2026-10-25 (CACHE_VERSION v334), before Path 13 P2 replaces them with
// _shared/grouping.js. Copied out of the files, not out of BACKLOG.md's design:
//
//   002 Tools/002-group-team-generator.html   shuffle, assign*, assignPool,
//       getStrategy, applyOddHandling, makeGroups (minus GtgMemory's long-memory
//       refine and roles, which stay 002's), locksAreValid, groupIndexOf,
//       find*Violations, pairKey, historyGen/Count, pairHistoryCount,
//       pairRecencyPenalty, totalPairPenalty, findRecentPairViolations,
//       prunePairHistoryToRoster, recordPairHistory, totalScore,
//       resolveConstraints, groupCountFor
//   022 Tools/022-lab-group-role-randomizer.html   groupCountFor (count/size),
//       shuffle, makeGroups, groupIndexOf, findApartViolations,
//       resolveKeepApart, roleRecencyScore, assignRolesForGroup, recordHistory,
//       computeEffectiveMembers
//   027 Tools/027-novel-study-circles-manager.html  groupCountFor, shuffle,
//       makeGroups, roleRecencyScore, assignRolesForGroup, recordHistory
//   007 Tools/name-picker/np-pick.js   shuffle, makeGroups
//   087 Tools/class-screen/cs-core.js  makeGroups
//   021 Tools/021-pe-tournament-stations.html  shuffle and the split button
//
// The only edits: `Math.random` is a `rng` argument, page state (`state`,
// `students`, the form's values, `keepApart`, `lastGroups`) is a context
// object, and 027's group ids are left out (makeId() draws nothing). Each
// function's body is otherwise the page's. Keep this file when P2 deletes the
// originals: it is what holds the engine to the groups every class got.

/* ── 007 np-pick.js ──────────────────────────────────────────────────── */
function npShuffle(list, rng = Math.random) {
  const out = Array.from(list);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function np007(names, n, rng) {
  const count = Math.max(2, Math.floor(n) || 2);
  const pool = npShuffle(Array.from(new Set((names || []).filter(x => typeof x === "string" && x))), rng);
  const groups = Array.from({ length: count }, () => []);
  pool.forEach((name, i) => groups[i % count].push(name));
  return groups;
}

/* ── 087 cs-core.js ──────────────────────────────────────────────────── */
export function cs087(names, by, n, rng) {
  rng = rng || Math.random;
  var list = (names || []).slice();
  for (var i = list.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = list[i]; list[i] = list[j]; list[j] = t;
  }
  n = Math.max(1, Math.floor(n) || 1);
  if (!list.length) return [];
  var count;
  if (by === 'count') count = Math.min(n, list.length);
  else {
    count = Math.max(1, Math.floor(list.length / n));
    var rem = list.length - count * n;
    if (rem >= Math.ceil(n / 2) || count === 0) count += 1;
  }
  var groups = [];
  for (var g = 0; g < count; g++) groups.push([]);
  list.forEach(function (name, k) { groups[k % count].push(name); });
  return groups;
}

/* ── 021 split button ────────────────────────────────────────────────── */
function shuffleWith(rng) {
  return function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
}
export function pe021(names, splitCount, rng) {
  var shuffle = shuffleWith(rng);
  var k = Math.max(1, parseInt(splitCount, 10) || 1);
  var shuffled = shuffle(names);
  var buckets = [];
  for (var i = 0; i < k; i++) buckets.push([]);
  shuffled.forEach(function (n, idx) { buckets[idx % k].push(n); });
  return buckets;
}

/* ── 027 ─────────────────────────────────────────────────────────────── */
export function nsc027(names, ctx, rng) {
  var shuffle = shuffleWith(rng);
  var state = ctx;
  function groupCountFor(n) {
    var isSize = state.mode === 'size';
    var v = Math.max(1, parseInt(state.splitValue, 10) || 1);
    var count = isSize ? Math.ceil(n / v) : v;
    return Math.max(1, Math.min(count, n));
  }
  var k = groupCountFor(names.length);
  var groups = [];
  for (var i = 0; i < k; i++) groups.push({ label: 'Group ' + (i + 1), members: [] });
  var shuffled = shuffle(names);
  shuffled.forEach(function (name, idx) { groups[idx % k].members.push(name); });
  return groups.map(function (g) { return g.members; });
}

/* ── 022 and 027's role picker (the two are the same, letter for letter) ─ */
export function rolePicker(state, rng) {
  var shuffle = shuffleWith(rng);
  function roleRecencyScore(studentName, role) {
    var hist = (state.history && state.history[studentName]) || [];
    var idxFromEnd = -1;
    for (var i = hist.length - 1; i >= 0; i--) {
      if (hist[i] === role) { idxFromEnd = hist.length - 1 - i; break; }
    }
    if (idxFromEnd === -1) return -1;
    return idxFromEnd === 0 ? 1000 : (100 - Math.min(idxFromEnd, 99));
  }
  function assignRolesForGroup(members, roles) {
    var order = shuffle(members);
    var available = roles.slice();
    var assignment = {};
    order.forEach(function (name) {
      if (!available.length) { assignment[name] = null; return; }
      var ranked = available.map(function (role) {
        return { role: role, score: roleRecencyScore(name, role) + rng() * 0.5 };
      }).sort(function (a, b) { return a.score - b.score; });
      var chosen = ranked[0].role;
      assignment[name] = chosen;
      available.splice(available.indexOf(chosen), 1);
    });
    return assignment;
  }
  function recordHistory(name, role) {
    if (!role) return;
    if (!state.history) state.history = {};
    if (!state.history[name]) state.history[name] = [];
    state.history[name].push(role);
    if (state.history[name].length > 30) state.history[name].shift();
  }
  return { roleRecencyScore, assignRolesForGroup, recordHistory };
}

/* ── 022 ─────────────────────────────────────────────────────────────── */
export function lab022(names, ctx, rng) {
  var shuffle = shuffleWith(rng);
  var state = ctx;
  function groupCountFor(n) {
    var v = Math.max(1, parseInt(state.splitValue, 10) || 1);
    var count = state.mode === 'size' ? Math.ceil(n / v) : v;
    return Math.max(1, Math.min(count, n));
  }
  function groupIndexOf(groups, name) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].indexOf(name) !== -1) return i;
    }
    return -1;
  }
  function findApartViolations(groups) {
    return (state.keepApart || []).filter(function (pair) {
      var ia = groupIndexOf(groups, pair[0]);
      var ib = groupIndexOf(groups, pair[1]);
      return ia !== -1 && ia === ib;
    });
  }
  function resolveKeepApart(groups) {
    var pairs = state.keepApart || [];
    if (!pairs.length || groups.length < 2) return;
    var attempts = 0, maxAttempts = 600;
    var bestCount = findApartViolations(groups).length;
    while (bestCount > 0 && attempts < maxAttempts) {
      attempts++;
      var violations = findApartViolations(groups);
      if (!violations.length) break;
      var offender = violations[Math.floor(rng() * violations.length)];
      var groupIdx = groupIndexOf(groups, offender[0]);
      var otherIdx = Math.floor(rng() * groups.length);
      if (otherIdx === groupIdx || !groups[otherIdx].length) continue;
      var fromArr = groups[groupIdx];
      var swapOutIdx = fromArr.indexOf(offender[1]);
      if (swapOutIdx === -1) continue;
      var toArr = groups[otherIdx];
      var swapInIdx = Math.floor(rng() * toArr.length);
      var a = fromArr[swapOutIdx], b = toArr[swapInIdx];
      fromArr[swapOutIdx] = b; toArr[swapInIdx] = a;
      var newCount = findApartViolations(groups).length;
      if (newCount > bestCount) { fromArr[swapOutIdx] = a; toArr[swapInIdx] = b; }
      else { bestCount = newCount; }
    }
  }
  var k = groupCountFor(names.length);
  var groups = [];
  for (var i = 0; i < k; i++) groups.push([]);
  var shuffled = shuffle(names);
  shuffled.forEach(function (name, idx) { groups[idx % k].push(name); });
  resolveKeepApart(groups);
  return { groups: groups, violations: findApartViolations(groups) };
}

export function coverage022(members, isAbsentNow) {
  var presentIdx = [];
  members.forEach(function (m, i) { if (!isAbsentNow(m.name)) presentIdx.push(i); });
  var coverage = {};
  if (presentIdx.length) {
    var cursor = 0;
    members.forEach(function (m, i) {
      if (isAbsentNow(m.name) && m.role) {
        var targetIdx = presentIdx[cursor % presentIdx.length];
        cursor++;
        (coverage[targetIdx] = coverage[targetIdx] || []).push(m.role);
      }
    });
  }
  return members.map(function (m, i) {
    var isAbsent = isAbsentNow(m.name);
    var extra = coverage[i] || [];
    var effectiveRole = m.role || null;
    if (extra.length) effectiveRole = (effectiveRole ? [effectiveRole] : []).concat(extra).join(' + ');
    return { name: m.name, role: m.role, effectiveRole: isAbsent ? null : effectiveRole, absent: isAbsent };
  });
}

/* ── 002 ─────────────────────────────────────────────────────────────── */
// ctx: { students: [{ name, skill|null }], absent: { name: true }, mode:
// 'count'|'size', splitValue, strategy (the select's value), oddMode,
// keepApart, keepTogether, lastGroups ({ groups: [[student]] } or null),
// state: { pairHistory, pairGen } }. Returns makeGroups()'s result, without
// the long-memory refine and the roles, and records the pairs on ctx.state.
export function gtg002(ctx, opts, rng) {
  var shuffle = shuffleWith(rng);
  var students = ctx.students, state = ctx.state, keepApart = ctx.keepApart || [], keepTogether = ctx.keepTogether || [];
  var lastGroups = ctx.lastGroups || null;
  var SKILL_STRATEGIES = ['balanced', 'heterogeneous', 'homogeneous'];
  function getActiveStudents() { return students.filter(function (s) { return !ctx.absent[s.name]; }); }
  function groupCountFor(n) {
    var isSize = ctx.mode === 'size';
    var v = Math.max(1, parseInt(ctx.splitValue, 10) || 1);
    var count = isSize ? Math.ceil(n / v) : v;
    return Math.max(1, Math.min(count, n));
  }
  function assignRandom(pool, groups, targetIdx) {
    var k = targetIdx.length;
    var shuffled = shuffle(pool);
    shuffled.forEach(function (s, idx) { groups[targetIdx[idx % k]].push(s); });
  }
  function assignBalanced(pool, groups, targetIdx) {
    var k = targetIdx.length;
    var sorted = shuffle(pool).sort(function (a, b) { return (b.skill || 3) - (a.skill || 3); });
    var dir = 1, gi = 0;
    sorted.forEach(function (s) {
      groups[targetIdx[gi]].push(s);
      gi += dir;
      if (gi === k) { gi = k - 1; dir = -1; }
      else if (gi < 0) { gi = 0; dir = 1; }
    });
  }
  function assignHeterogeneous(pool, groups, targetIdx) {
    var k = targetIdx.length;
    var sorted = shuffle(pool).sort(function (a, b) { return (b.skill || 3) - (a.skill || 3); });
    var n = sorted.length;
    var t1 = Math.ceil(n / 3), t2 = Math.ceil((n - t1) / 2) + t1;
    var tiers = [shuffle(sorted.slice(0, t1)), shuffle(sorted.slice(t1, t2)), shuffle(sorted.slice(t2))];
    tiers.forEach(function (tier) {
      var gi = 0;
      tier.forEach(function (s) { groups[targetIdx[gi % k]].push(s); gi++; });
    });
  }
  function assignHomogeneous(pool, groups, targetIdx) {
    var k = targetIdx.length;
    var sorted = shuffle(pool).sort(function (a, b) { return (b.skill || 3) - (a.skill || 3); });
    var base = Math.floor(sorted.length / k), extra = sorted.length % k, idx = 0;
    for (var i = 0; i < k; i++) {
      var size = base + (i < extra ? 1 : 0);
      for (var j = 0; j < size; j++) { groups[targetIdx[i]].push(sorted[idx]); idx++; }
    }
  }
  function assignCoverage(pool, groups, targetIdx) {
    var sizes = {};
    targetIdx.forEach(function (i) { sizes[i] = groups[i].length; });
    shuffle(pool).forEach(function (s) {
      var minSize = Math.min.apply(null, targetIdx.map(function (i) { return sizes[i]; }));
      var candidates = shuffle(targetIdx.filter(function (i) { return sizes[i] === minSize; }));
      var best = candidates[0], bestCost = Infinity;
      candidates.forEach(function (i) {
        var cost = groups[i].reduce(function (sum, m) { return sum + pairHistoryCount(s.name, m.name); }, 0);
        if (cost < bestCost) { bestCost = cost; best = i; }
      });
      groups[best].push(s);
      sizes[best]++;
    });
  }
  function assignPool(pool, groups, targetIdx, strategy) {
    if (!targetIdx.length) return;
    if (strategy === 'balanced') assignBalanced(pool, groups, targetIdx);
    else if (strategy === 'heterogeneous') assignHeterogeneous(pool, groups, targetIdx);
    else if (strategy === 'homogeneous') assignHomogeneous(pool, groups, targetIdx);
    else if (strategy === 'coverage') assignCoverage(pool, groups, targetIdx);
    else assignRandom(pool, groups, targetIdx);
  }
  function getStrategy() {
    var hasSkills = students.some(function (s) { return s.skill !== null; });
    var v = ctx.strategy;
    return (SKILL_STRATEGIES.indexOf(v) !== -1 && !hasSkills) ? 'random' : v;
  }
  function applyOddHandling(groups, targetIdx, oddMode) {
    if (!targetIdx.length || oddMode === 'extra') return { floaters: [], fallbackNote: null, bonusGroupSize: 0 };
    var sizes = targetIdx.map(function (i) { return groups[i].length; });
    var minSize = Math.min.apply(null, sizes);
    var floaters = [];
    targetIdx.forEach(function (i) {
      while (groups[i].length > minSize) floaters.push(groups[i].pop());
    });
    if (oddMode === 'pair') {
      if (floaters.length >= 2) { groups.push(floaters); return { floaters: [], fallbackNote: null, bonusGroupSize: floaters.length }; }
      if (floaters.length === 1) return { floaters: floaters, fallbackNote: 'Only one student was left over, so they were kept as a floater — a pair needs at least two.', bonusGroupSize: 0 };
    }
    return { floaters: floaters, fallbackNote: null, bonusGroupSize: 0 };
  }
  function locksAreValid(lockedFlagsIn, activeStudents) {
    var activeNames = {};
    activeStudents.forEach(function (s) { activeNames[s.name] = true; });
    var ok = true;
    lastGroups.groups.forEach(function (g, i) {
      if (lockedFlagsIn[i]) g.forEach(function (s) { if (!activeNames[s.name]) ok = false; });
    });
    return ok;
  }
  function groupIndexOf(groups, name) {
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].some(function (s) { return s.name === name; })) return i;
    }
    return -1;
  }
  function findApartViolations(groups) {
    return keepApart.filter(function (pair) {
      var ia = groupIndexOf(groups, pair[0]);
      var ib = groupIndexOf(groups, pair[1]);
      return ia !== -1 && ia === ib;
    });
  }
  function findTogetherViolations(groups) {
    return keepTogether.filter(function (pair) {
      var ia = groupIndexOf(groups, pair[0]);
      var ib = groupIndexOf(groups, pair[1]);
      return ia !== -1 && ib !== -1 && ia !== ib;
    });
  }
  function pairKey(a, b) {
    return a < b ? a + '␟' + b : b + '␟' + a;
  }
  function historyGen(entry) { return entry && typeof entry === 'object' ? entry.gen : (entry || 0); }
  function historyCount(entry) { return entry && typeof entry === 'object' ? (entry.count || 0) : (entry ? 1 : 0); }
  function pairHistoryCount(a, b) {
    if (!state || !state.pairHistory) return 0;
    return historyCount(state.pairHistory[pairKey(a, b)]);
  }
  function pairRecencyPenalty(a, b) {
    if (!state || !state.pairHistory) return 0;
    var lastGen = historyGen(state.pairHistory[pairKey(a, b)]);
    if (!lastGen) return 0;
    var gap = ((state.pairGen || 0) + 1) - lastGen;
    if (gap <= 1) return 1000;
    if (gap === 2) return 100;
    return 0;
  }
  function totalPairPenalty(groups) {
    var total = 0;
    groups.forEach(function (group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          total += pairRecencyPenalty(group[i].name, group[j].name);
        }
      }
    });
    return total;
  }
  function findRecentPairViolations(groups) {
    var result = [];
    groups.forEach(function (group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          if (pairRecencyPenalty(group[i].name, group[j].name) > 0) result.push([group[i].name, group[j].name]);
        }
      }
    });
    return result;
  }
  function prunePairHistoryToRoster() {
    if (!state || !state.pairHistory) return;
    var current = {};
    students.forEach(function (s) { current[s.name] = true; });
    Object.keys(state.pairHistory).forEach(function (key) {
      var sep = key.indexOf('␟');
      var a = key.slice(0, sep), b = key.slice(sep + 1);
      if (!current[a] || !current[b]) delete state.pairHistory[key];
    });
  }
  function recordPairHistory(groups) {
    if (!state) return;
    var newGen = (state.pairGen || 0) + 1;
    state.pairGen = newGen;
    if (!state.pairHistory) state.pairHistory = {};
    groups.forEach(function (group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          var key = pairKey(group[i].name, group[j].name);
          var prevCount = historyCount(state.pairHistory[key]);
          state.pairHistory[key] = { gen: newGen, count: prevCount + 1 };
        }
      }
    });
  }
  var HARD_CONSTRAINT_WEIGHT = 100000;
  function totalScore(groups) {
    return (findApartViolations(groups).length + findTogetherViolations(groups).length) * HARD_CONSTRAINT_WEIGHT +
      totalPairPenalty(groups);
  }
  function resolveConstraints(groups, lockedIdx) {
    lockedIdx = lockedIdx || {};
    var hasPairBias = !!(state && state.pairHistory && Object.keys(state.pairHistory).length);
    var unlockedCount = groups.filter(function (_, i) { return !lockedIdx[i]; }).length;
    if ((!keepApart.length && !keepTogether.length && !hasPairBias) || unlockedCount < 2) return;
    var attempts = 0, maxAttempts = 800;
    var bestScore = totalScore(groups);
    while (bestScore > 0 && attempts < maxAttempts) {
      attempts++;
      var allViolations = findApartViolations(groups).concat(findTogetherViolations(groups));
      if (hasPairBias) allViolations = allViolations.concat(findRecentPairViolations(groups));
      if (!allViolations.length) break;
      var offender = allViolations[Math.floor(rng() * allViolations.length)];
      var groupIdx = groupIndexOf(groups, offender[0]);
      if (groupIdx === -1 || lockedIdx[groupIdx]) continue;
      var fromArr = groups[groupIdx];
      var sameGroupIdx = fromArr.findIndex(function (s) { return s.name === offender[1]; });
      if (sameGroupIdx !== -1) {
        var candidates = [];
        for (var oi = 0; oi < groups.length; oi++) { if (oi !== groupIdx && !lockedIdx[oi] && groups[oi].length) candidates.push(oi); }
        if (!candidates.length) continue;
        var otherIdx = candidates[Math.floor(rng() * candidates.length)];
        var toArr = groups[otherIdx];
        var swapInIdx = Math.floor(rng() * toArr.length);
        var a = fromArr[sameGroupIdx], b = toArr[swapInIdx];
        fromArr[sameGroupIdx] = b; toArr[swapInIdx] = a;
        var newScore = totalScore(groups);
        if (newScore > bestScore) { fromArr[sameGroupIdx] = a; toArr[swapInIdx] = b; }
        else { bestScore = newScore; }
      } else {
        var otherGroupIdx = groupIndexOf(groups, offender[1]);
        if (otherGroupIdx === -1 || lockedIdx[otherGroupIdx]) continue;
        var togetherArr = groups[otherGroupIdx];
        var moveIdx = togetherArr.findIndex(function (s) { return s.name === offender[1]; });
        var swapInIdx2 = Math.floor(rng() * fromArr.length);
        var a2 = fromArr[swapInIdx2], b2 = togetherArr[moveIdx];
        fromArr[swapInIdx2] = b2; togetherArr[moveIdx] = a2;
        var newScore2 = totalScore(groups);
        if (newScore2 > bestScore) { fromArr[swapInIdx2] = a2; togetherArr[moveIdx] = b2; }
        else { bestScore = newScore2; }
      }
    }
  }
  function countPairingsInGroups(groups) {
    var total = 0, brandNew = 0;
    groups.forEach(function (group) {
      for (var i = 0; i < group.length; i++) {
        for (var j = i + 1; j < group.length; j++) {
          total++;
          if (pairHistoryCount(group[i].name, group[j].name) === 0) brandNew++;
        }
      }
    });
    return { total: total, brandNew: brandNew };
  }

  // makeGroups(opts), the page's, without GtgMemory.pruneRoles / refine /
  // assignGroupRoles / recordRoles (002's own module, outside the engine).
  opts = opts || {};
  prunePairHistoryToRoster();
  var activeStudents = getActiveStudents();
  var strategy = getStrategy();
  var oddMode = ctx.oddMode;
  var groups, targetIdx, lockedCount = 0, usedLocks = false, lockedIdxSet = {};
  var lockedFlagsIn = opts.lockedFlags;
  if (lockedFlagsIn && lastGroups && lockedFlagsIn.length === lastGroups.groups.length &&
      lockedFlagsIn.some(Boolean) && locksAreValid(lockedFlagsIn, activeStudents)) {
    usedLocks = true;
    groups = lastGroups.groups.map(function (g) { return g.slice(); });
    targetIdx = [];
    var lockedNames = {};
    groups.forEach(function (g, i) {
      if (lockedFlagsIn[i]) { lockedCount++; lockedIdxSet[i] = true; g.forEach(function (s) { lockedNames[s.name] = true; }); }
      else { targetIdx.push(i); groups[i] = []; }
    });
    var pool = activeStudents.filter(function (s) { return !lockedNames[s.name]; });
    assignPool(pool, groups, targetIdx, strategy);
  } else {
    var k = groupCountFor(activeStudents.length);
    groups = [];
    for (var i = 0; i < k; i++) groups.push([]);
    targetIdx = groups.map(function (_, idx) { return idx; });
    assignPool(activeStudents, groups, targetIdx, strategy);
  }
  var oddResult = applyOddHandling(groups, targetIdx, oddMode);
  resolveConstraints(groups, lockedIdxSet);
  var violations = findApartViolations(groups);
  var togetherViolations = findTogetherViolations(groups);
  var repeatViolations = findRecentPairViolations(groups);
  var pairStats = countPairingsInGroups(groups);
  recordPairHistory(groups);
  return {
    groups: groups, violations: violations, togetherViolations: togetherViolations,
    repeatViolations: repeatViolations, floaters: oddResult.floaters,
    meta: { strategy: strategy, lockedCount: lockedCount, usedLocks: usedLocks,
      fallbackNote: oddResult.fallbackNote, bonusGroupSize: oddResult.bonusGroupSize,
      newPairsThisGen: pairStats.brandNew, totalPairsThisGen: pairStats.total }
  };
}
