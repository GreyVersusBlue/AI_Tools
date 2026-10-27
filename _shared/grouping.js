/* grouping.js — the one grouping engine (Path 13 P1): splitting a class into
   groups, handing out roles, and the memory of who has worked with whom.
   Publishes window.Grouping. Pure: no DOM, no storage, no clock, and no
   Math.random when a call is given `rng` or `seed`, so the Node suites
   (Tools/grouping/test/) drive all of it in a vm context, as export.js's do.
   It never throws on data: a malformed option is dropped and named in the
   result's `dropped`.

   WHERE IT CAME FROM. The split existed six times (002, 022, 027, 007's
   np-pick.js, 021's split button, 087's cs-core.js) round one core: a
   Fisher-Yates shuffle from the end (j = floor(rng() * (i + 1))), then member
   i to group i % k. For the same random numbers the engine makes the groups,
   floaters and roles each of them makes, for every option each has, and
   Tools/grouping/test/parity.test.mjs holds it to copies of all six taken
   before any page adopts it. Two exceptions, both named in BACKLOG.md's Path 13
   P1 bullet: 022's own keep-apart repair becomes 002's (the same failure rate,
   different draws), and a class with a repeated name (every copy treated two
   students of one name as one; the engine gives the second `#2` on its key).
   Everything better than today is an option that is off until an adopter turns
   it on: `sizeRule: 'floor'` (002's floater rule), `search.keepStrategy`,
   `search.together: 'units'`, `search.restarts` and `rotateRoles`'s
   `method: 'best'`.

   NOT HERE. 002's long-memory refine and its Hungarian role rotation
   (Tools/group-team-generator/gtg-memory.js, v277) came after the design; they
   stay 002's and run after formGroups() exactly where they run today. Stations
   and timers are rotation (P3). Brackets, pools and Swiss are P3 and P4.

   A MEMBER is { key, name, attrs }: `key` any string unique in the call (a
   bare string is a member whose key and name are that string), `attrs` an
   optional map of teacher-set values ({ skill: 4 }) handed in by the tool from
   its own storage; the engine stores no attribute. Groups are lists of keys
   throughout, and the caller maps back to its own records.

   THE MEMORY is the tool's to store, one field per class:
     { v: 1, gen, keys: [key], names: [name], seen: [gen],
       pairs: { "i.j": [lastGen, count] }, roles: { "i": [roleName] } }
   with i < j indexing `keys`. `gen` counts recorded groupings, `seen[i]` is
   the last gen member i was handed in, `roles` the last 30 roles, oldest
   first. Every history.* function returns a new object; formGroups() reads
   the memory and never writes it, so a preview costs nothing and Undo is the
   old object. Keys are made by history.identify(): 'i:<id>' for a student
   with a stable id from the roster sidecar, 'n:<name>' for one without.

   API (each documented where it is defined):
     rng(seed), newSeed(), pin(seed|null)
     plan(n, opts)                     the arithmetic, no draws
     formGroups(members, opts)         the deal, the repair, the report
     rotateRoles(groups, roles, history, opts)
     coverRoles(group, absentKeys)     an absent member's role handed round
     history.{ empty, normalize, record, count, lastGen, rolesOf, coverage,
               rekey, prune, identify, fromLegacy, toLegacyPairs,
               toLegacyRoles, absorbLegacy } */
(function (global) {
  'use strict';

  var VERSION = 1;
  var MAX_ROLES = 30;
  var LEGACY_SEP = '␟';
  var STRATEGIES = ['random', 'balanced', 'heterogeneous', 'homogeneous', 'coverage', 'spread'];
  var ATTR_STRATEGIES = ['balanced', 'heterogeneous', 'homogeneous', 'spread'];
  // Not `{ __proto__: true, ... }`: in a literal that sets the prototype and
  // makes no key, which is how the first draft let __proto__ through.
  var BAD_KEYS = Object.create(null);
  BAD_KEYS['__proto__'] = BAD_KEYS.constructor = BAD_KEYS.prototype = true;

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isBad(k) { return BAD_KEYS[k] === true; }
  function isKey(k) { return typeof k === 'string' && k !== '' && !isBad(k); }
  function whole(x, lo) { var n = Math.floor(Number(x)); return isFinite(n) && n >= lo ? n : null; }

  /* ── random numbers ──────────────────────────────────────────────────── */

  /* FNV-1a, 32-bit, for a string seed. */
  function hashString(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /* mulberry32 from a 32-bit number or a string. */
  function rng(seed) {
    var a = typeof seed === 'string' ? hashString(seed) : (Number(seed) >>> 0);
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() {
    var c = global.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      var a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] >>> 0;
    }
    return Math.floor(Math.random() * 4294967296) >>> 0;
  }

  var pinned = null;
  /* A test hook: while a seed is pinned, a call with no `rng` or `seed` draws
     from it, in order, across calls. pin(null) clears it. */
  function pin(seed) { pinned = seed === null || seed === undefined ? null : rng(seed); }

  /* `seed` wins over `rng`, which wins over pin(), which wins over a fresh
     newSeed(). The seed is returned when the engine was given or chose one. */
  function drawFrom(opts) {
    if (opts && (typeof opts.seed === 'number' || typeof opts.seed === 'string')) {
      return { next: rng(opts.seed), seed: opts.seed };
    }
    if (opts && typeof opts.rng === 'function') return { next: opts.rng, seed: null };
    if (pinned) return { next: pinned, seed: null };
    var s = newSeed();
    return { next: rng(s), seed: s };
  }

  function shuffle(list, next) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── plan: the arithmetic a page shows before the shuffle ────────────── */

  var REMAINDERS = { spread: 'spread', extra: 'spread', floaters: 'floaters', 'own-group': 'own-group', pair: 'own-group' };

  /* plan(n, { count | size, sizeRule, remainder, min, allowEmpty })
     → { count, sizes, floaters, ownGroup, note }. Draws nothing.
     sizeRule, for `size`: 'ceil' (002, 022, 027: never over the size),
     'near' (087: floor, plus one when the remainder is at least half a
     group) or 'floor' (never under, once n >= size; with floaters or an
     own group every group is exactly `size` and the rest are left over). remainder: 'spread'
     (some groups get one more; 002's stored word 'extra' too), 'floaters'
     or 'own-group' (two or more left over make a group of their own, one
     stays a floater with a note; 002's 'pair'). The count is clamped to
     [max(1, min), n]; `allowEmpty` drops the upper clamp, for 007 and 021,
     which make empty groups when asked for more groups than names. No
     members and no allowEmpty is no groups. */
  function plan(n, opts) {
    opts = opts || {};
    n = whole(n, 0) || 0;
    var lo = Math.max(1, whole(opts.min, 1) || 1);
    var rule = opts.sizeRule === 'near' || opts.sizeRule === 'floor' ? opts.sizeRule : 'ceil';
    var remainder = REMAINDERS[opts.remainder] || 'spread';
    var size = whole(opts.size, 1);
    var count;
    if (size !== null && (opts.count === undefined || opts.count === null)) {
      if (rule === 'floor') count = Math.floor(n / size);
      else if (rule === 'near') {
        count = Math.max(1, Math.floor(n / size));
        if (n - count * size >= Math.ceil(size / 2)) count += 1;
      } else count = Math.ceil(n / size);
    } else {
      count = whole(opts.count, 1) || 1;
    }
    if (!n && !opts.allowEmpty) count = 0;
    else {
      count = Math.max(lo, count);
      if (!opts.allowEmpty) count = Math.max(1, Math.min(count, n));
    }
    var base = count ? Math.floor(n / count) : 0;
    /* 'floor' with the rest left over: every group is `size` (never over it), the rest
       are floaters or a group of their own. Spread keeps floor's "never under". */
    if (rule === 'floor' && remainder !== 'spread' && size !== null && (opts.count === undefined || opts.count === null) &&
        count && count * size <= n) base = size;
    var extra = count ? n - base * count : 0;
    var sizes = [], floaters = 0, ownGroup = 0, note = null;
    for (var i = 0; i < count; i++) sizes.push(base + (remainder === 'spread' && i < extra ? 1 : 0));
    if (remainder !== 'spread') {
      floaters = extra;
      if (remainder === 'own-group') {
        if (floaters >= 2) { ownGroup = floaters; floaters = 0; }
        else if (floaters === 1) note = 'one-left';
      }
    }
    return { count: count, sizes: sizes, floaters: floaters, ownGroup: ownGroup, note: note };
  }

  /* ── the memory ──────────────────────────────────────────────────────── */

  function empty() { return { v: VERSION, gen: 0, keys: [], names: [], seen: [], pairs: {}, roles: {} }; }

  /* normalize(h): repairs what it can, empties what it cannot, never throws.
     Refuses __proto__, constructor and prototype as keys, as 022 does for a
     roster file arriving by link. */
  function normalize(h) {
    if (!isObj(h) || !Array.isArray(h.keys)) return empty();
    var out = empty();
    out.gen = whole(h.gen, 0) || 0;
    var remap = {};
    h.keys.forEach(function (k, i) {
      if (!isKey(k) || own(remap, '#' + k)) return;
      remap['#' + k] = true;
      remap[i] = out.keys.length;
      out.keys.push(k);
      var nm = Array.isArray(h.names) ? h.names[i] : null;
      out.names.push(typeof nm === 'string' ? nm : k.replace(/^[in]:/, ''));
      var sn = Array.isArray(h.seen) ? whole(h.seen[i], 0) : null;
      out.seen.push(sn === null ? 0 : Math.min(sn, out.gen));
    });
    if (isObj(h.pairs)) {
      Object.keys(h.pairs).forEach(function (pk) {
        var m = /^(\d+)\.(\d+)$/.exec(pk);
        var e = h.pairs[pk];
        if (!m || !Array.isArray(e)) return;
        var a = remap[m[1]], b = remap[m[2]];
        if (a === undefined || b === undefined || a === b) return;
        var g = whole(e[0], 0), c = whole(e[1], 1);
        if (g === null || c === null) return;
        var i = Math.min(a, b), j = Math.max(a, b);
        var cur = out.pairs[i + '.' + j];
        g = Math.min(g, out.gen);
        out.pairs[i + '.' + j] = cur ? [Math.max(cur[0], g), cur[1] + c] : [g, c];
      });
    }
    if (isObj(h.roles)) {
      Object.keys(h.roles).forEach(function (ri) {
        var a = /^\d+$/.test(ri) ? remap[ri] : undefined;
        if (a === undefined || !Array.isArray(h.roles[ri])) return;
        var list = h.roles[ri].filter(function (r) { return typeof r === 'string' && r; });
        if (list.length) out.roles[a] = list.slice(-MAX_ROLES);
      });
    }
    return out;
  }

  /* Working form: members by key, pairs by key pair. Every mutator expands,
     edits and compacts, so index bookkeeping lives in two functions only. */
  function expand(h) {
    h = normalize(h);
    var order = h.keys.slice(), mem = {};
    h.keys.forEach(function (k, i) {
      mem['#' + k] = { name: h.names[i], seen: h.seen[i], roles: (h.roles[i] || []).slice() };
    });
    var pairs = {};
    Object.keys(h.pairs).forEach(function (pk) {
      var p = pk.split('.');
      pairs[pk2(h.keys[+p[0]], h.keys[+p[1]])] = h.pairs[pk].slice();
    });
    return { gen: h.gen, order: order, mem: mem, pairs: pairs };
  }
  function pk2(a, b) { return a < b ? a + '\u0000' + b : b + '\u0000' + a; }
  function compact(e) {
    var out = empty(), at = {};
    out.gen = e.gen;
    e.order.forEach(function (k) {
      if (!own(e.mem, '#' + k)) return;
      at['#' + k] = out.keys.length;
      var m = e.mem['#' + k];
      out.keys.push(k); out.names.push(m.name); out.seen.push(m.seen);
      if (m.roles.length) out.roles[out.keys.length - 1] = m.roles.slice(-MAX_ROLES);
    });
    Object.keys(e.pairs).forEach(function (p) {
      var ab = p.split('\u0000'), i = at['#' + ab[0]], j = at['#' + ab[1]];
      if (i === undefined || j === undefined) return;
      out.pairs[Math.min(i, j) + '.' + Math.max(i, j)] = e.pairs[p].slice();
    });
    return out;
  }
  function addMember(e, key, name) {
    if (own(e.mem, '#' + key)) return e.mem['#' + key];
    e.order.push(key);
    e.mem['#' + key] = { name: typeof name === 'string' ? name : key.replace(/^[in]:/, ''), seen: 0, roles: [] };
    return e.mem['#' + key];
  }

  /* Shaped as normalize() returns it, which every function here returns:
     trusted as it is. Anything else (a stored blob, a hand-made object) goes
     through normalize() first. A tool normalizes what it loads, once. */
  function shaped(h) {
    return isObj(h) && h.v === VERSION && typeof h.gen === 'number' && Array.isArray(h.keys) &&
      Array.isArray(h.names) && Array.isArray(h.seen) && h.names.length === h.keys.length &&
      h.seen.length === h.keys.length && isObj(h.pairs) && isObj(h.roles);
  }

  /* A read-only view for the hot loops: key → index, and pair lookups. */
  function reader(h) {
    h = shaped(h) ? h : normalize(h);
    var idx = {};
    h.keys.forEach(function (k, i) { idx['#' + k] = i; });
    function entry(a, b) {
      var i = idx['#' + a], j = idx['#' + b];
      if (i === undefined || j === undefined || i === j) return null;
      return h.pairs[Math.min(i, j) + '.' + Math.max(i, j)] || null;
    }
    return {
      h: h,
      idx: idx,
      any: Object.keys(h.pairs).length > 0,
      count: function (a, b) { var e = entry(a, b); return e ? e[1] : 0; },
      last: function (a, b) { var e = entry(a, b); return e ? e[0] : 0; },
      roles: function (k) { var i = idx['#' + k]; return i === undefined ? [] : (h.roles[i] || []); }
    };
  }

  function count(h, a, b) { return reader(h).count(a, b); }
  function lastGen(h, a, b) { return reader(h).last(a, b); }
  function rolesOf(h, key) { return reader(h).roles(key).slice(); }

  /* record(h, groups, { roles, members, pairs, maxRoles }) → a new memory with
     one more grouping in it. `groups` are lists of keys; `roles` is
     rotateRoles()'s byGroup or a { key: role } map (null is "no role" and is
     not remembered, as in 022 and 027); `members` ([{ key, name }] or keys)
     names everyone handed in, absent or not, for `seen` and for the names of
     keys the memory has not met; `pairs: false` records roles only (027). */
  function record(h, groups, opts) {
    opts = opts || {};
    h = shaped(h) ? h : normalize(h);
    // Works on the indexes directly: a member the memory has not met goes on
    // the end, so no index moves and nothing is rebuilt.
    var out = { v: VERSION, gen: h.gen + 1, keys: h.keys.slice(), names: h.names.slice(), seen: h.seen.slice(),
      pairs: Object.assign({}, h.pairs), roles: Object.assign({}, h.roles) };
    var gen = out.gen, at = {};
    out.keys.forEach(function (k, i) { at['#' + k] = i; });
    var names = {};
    function index(k) {
      if (own(at, '#' + k)) return at['#' + k];
      at['#' + k] = out.keys.length;
      out.keys.push(k);
      out.names.push(own(names, '#' + k) ? names['#' + k] : k.replace(/^[in]:/, ''));
      out.seen.push(0);
      return out.keys.length - 1;
    }
    (Array.isArray(opts.members) ? opts.members : []).forEach(function (m) {
      var k = typeof m === 'string' ? m : (isObj(m) ? m.key : null);
      if (!isKey(k)) return;
      names['#' + k] = isObj(m) && typeof m.name === 'string' ? m.name : k;
      out.seen[index(k)] = gen;
    });
    (Array.isArray(groups) ? groups : []).forEach(function (g) {
      var ix = (Array.isArray(g) ? g : []).filter(isKey).map(index);
      ix.forEach(function (i) { out.seen[i] = gen; });
      if (opts.pairs === false) return;
      for (var a = 0; a < ix.length; a++) {
        for (var b = a + 1; b < ix.length; b++) {
          if (ix[a] === ix[b]) continue;
          var pk = Math.min(ix[a], ix[b]) + '.' + Math.max(ix[a], ix[b]);
          out.pairs[pk] = [gen, (out.pairs[pk] ? out.pairs[pk][1] : 0) + 1];
        }
      }
    });
    var cap = whole(opts.maxRoles, 1) || MAX_ROLES;
    function give(k, role) {
      if (!isKey(k) || typeof role !== 'string' || !role) return;
      var i = index(k);
      var list = (out.roles[i] || []).concat([role]);
      out.roles[i] = list.length > cap ? list.slice(-cap) : list;
    }
    if (Array.isArray(opts.roles)) {
      opts.roles.forEach(function (g) {
        (Array.isArray(g) ? g : []).forEach(function (x) { if (isObj(x)) give(x.key, x.role); });
      });
    } else if (isObj(opts.roles)) {
      Object.keys(opts.roles).forEach(function (k) { give(k, opts.roles[k]); });
    }
    return out;
  }

  /* coverage(h, keys) → { met, possible, never: [[a, b]], counts }: who has
     worked with whom among `keys`, which is 002's grid. counts[a][b] is the
     number of groupings a and b shared. */
  function coverage(h, keys) {
    var r = reader(h);
    var ks = (Array.isArray(keys) ? keys : []).filter(isKey);
    var met = 0, possible = 0, never = [], counts = {};
    ks.forEach(function (k) { counts[k] = {}; });
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var c = r.count(ks[i], ks[j]);
        counts[ks[i]][ks[j]] = c; counts[ks[j]][ks[i]] = c;
        possible++;
        if (c) met++; else never.push([ks[i], ks[j]]);
      }
    }
    return { met: met, possible: possible, never: never, counts: counts };
  }

  /* rekey(h, from, to). When `to` is new, `from` is renamed in place. When it
     exists, both tools' rules hold: pair counts add and the later gen wins
     (002); roles are not merged, `to` keeps its own (022, 027); the pair of
     the two with each other is dropped. */
  function rekey(h, from, to) {
    var e = expand(h);
    if (!isKey(from) || !isKey(to) || from === to || !own(e.mem, '#' + from)) return compact(e);
    var src = e.mem['#' + from];
    if (!own(e.mem, '#' + to)) {
      e.order[e.order.indexOf(from)] = to;
      e.mem['#' + to] = src;
    } else {
      var dst = e.mem['#' + to];
      dst.seen = Math.max(dst.seen, src.seen);
    }
    delete e.mem['#' + from];
    var moved = {};
    Object.keys(e.pairs).forEach(function (p) {
      var ab = p.split('\u0000');
      if (ab[0] !== from && ab[1] !== from) return;
      var other = ab[0] === from ? ab[1] : ab[0];
      var v = e.pairs[p];
      delete e.pairs[p];
      if (other === to) return;
      moved[other] = v;
    });
    Object.keys(moved).forEach(function (other) {
      var p = pk2(to, other), v = moved[other], cur = e.pairs[p];
      e.pairs[p] = cur ? [Math.max(cur[0], v[0]), cur[1] + v[1]] : v.slice();
    });
    e.order = e.order.filter(function (k, i, a) { return own(e.mem, '#' + k) && a.indexOf(k) === i; });
    return compact(e);
  }

  /* prune(h, keys, { departed, maxRoles }). Called by the tool once per
     grouping, never per keystroke (002's reason: a name half retyped must not
     lose its year). `departed`: 'drop' (002: a member not in `keys` loses
     every pair and role), 'keep' (022 and 027, the default) or { gens: N }
     (kept until N groupings have been recorded without them). Absent
     students belong in `keys`. Nothing is pruned by age. */
  function prune(h, keys, policy) {
    policy = policy || {};
    var e = expand(h);
    var here = {};
    (Array.isArray(keys) ? keys : []).forEach(function (k) { if (isKey(k)) here['#' + k] = true; });
    var d = policy.departed;
    var gens = isObj(d) ? whole(d.gens, 0) : null;
    e.order.forEach(function (k) {
      if (here['#' + k]) return;
      if (d === 'drop' || (gens !== null && e.gen - e.mem['#' + k].seen >= gens)) delete e.mem['#' + k];
    });
    var cap = whole(policy.maxRoles, 1);
    if (cap) e.order.forEach(function (k) { var m = e.mem['#' + k]; if (m) m.roles = m.roles.slice(-cap); });
    return compact(e);
  }

  /* identify(h, names, ids) → { members, history, moved, duplicates }: the one
     place a name becomes a key. `ids` is { name: id|null } from the roster
     sidecar (Roster.idsFor). For each name, in two passes so a new student
     cannot take the memory of a renamed one: (a) it has an id the memory
     knows ('i:<id>'): that member, and the stored name is updated, which is
     all a followed rename is; (b) else a key no current name has claimed
     whose stored name is this exact string: that member, re-keyed to
     'i:<id>' when there is an id (the first sighting of an id, or a roster
     made again in 006 with new ids for the same names); (c) else a new member,
     'i:<id>' or 'n:<name>'. A name that appears twice gets '#2', '#3' on its
     key in list order and is listed in `duplicates`. `moved` lists
     { why: 'renamed'|'rekeyed', key, fromKey, fromName, toName } so the tool
     can move its own name-keyed lists. What it cannot follow is what
     Roster.trackRenames cannot: a name retyped with no id carried over. */
  function identify(h, names, ids) {
    var e = expand(h);
    ids = isObj(ids) ? ids : {};
    var list = (Array.isArray(names) ? names : []).map(function (n) { return typeof n === 'string' ? n : ''; });
    var claimed = {}, keyOf = new Array(list.length), moved = [], duplicates = [], seenName = {};
    var occ = list.map(function (n) {
      seenName['#' + n] = (seenName['#' + n] || 0) + 1;
      if (seenName['#' + n] === 2) duplicates.push(n);
      return seenName['#' + n];
    });
    function idOf(n) { var v = own(ids, n) ? ids[n] : null; return typeof v === 'string' && v ? v : null; }
    function suffix(base, c) { return c > 1 ? base + '#' + c : base; }
    // (a)
    list.forEach(function (n, i) {
      var id = idOf(n);
      if (!id || !n) return;
      var k = suffix('i:' + id, occ[i]);
      if (!own(e.mem, '#' + k) || claimed['#' + k]) return;
      claimed['#' + k] = true;
      keyOf[i] = k;
      var m = e.mem['#' + k];
      if (m.name !== n) moved.push({ why: 'renamed', key: k, fromKey: k, fromName: m.name, toName: n });
      m.name = n;
    });
    // (b)
    var rekeys = [];
    list.forEach(function (n, i) {
      if (keyOf[i] || !n) return;
      var hit = null;
      for (var x = 0; x < e.order.length && !hit; x++) {
        var k = e.order[x];
        if (!claimed['#' + k] && e.mem['#' + k].name === n) hit = k;
      }
      if (!hit) return;
      claimed['#' + hit] = true;
      var id = idOf(n), want = id ? suffix('i:' + id, occ[i]) : hit;
      if (want !== hit && !own(e.mem, '#' + want)) {
        rekeys.push([hit, want]);
        moved.push({ why: 'rekeyed', key: want, fromKey: hit, fromName: n, toName: n });
        claimed['#' + want] = true;
        keyOf[i] = want;
      } else keyOf[i] = hit;
    });
    // (c)
    var used = {};
    keyOf.forEach(function (k) { if (k) used['#' + k] = true; });
    list.forEach(function (n, i) {
      if (keyOf[i]) return;
      var id = idOf(n);
      var base = id ? 'i:' + id : 'n:' + n, c = occ[i], k = suffix(base, c);
      while (used['#' + k] || own(e.mem, '#' + k)) {
        c++; k = base + '#' + c;
      }
      used['#' + k] = true;
      claimed['#' + k] = true;
      keyOf[i] = k;
      addMember(e, k, n);
    });
    var out = compact(e);
    rekeys.forEach(function (r) { out = rekey(out, r[0], r[1]); });
    return {
      members: list.map(function (n, i) { return { key: keyOf[i], name: n }; }),
      history: out,
      moved: moved,
      duplicates: duplicates
    };
  }

  /* fromLegacy({ pairHistory, pairGen, roles, idNames }): the memory from the
     fields the tools store today. pairHistory is 002's sorted "a␟b" to
     { gen, count } (or a bare generation number, before counts); roles is
     022's and 027's { name: [role, ...] }; idNames is { id: name } as
     Roster.trackRenames keeps it, read once to key a name by its id. */
  function fromLegacy(legacy) {
    legacy = isObj(legacy) ? legacy : {};
    var e = expand(empty());
    var idByName = {};
    if (isObj(legacy.idNames)) {
      Object.keys(legacy.idNames).forEach(function (id) {
        var n = legacy.idNames[id];
        if (typeof n === 'string' && id && !own(idByName, '#' + n)) idByName['#' + n] = id;
      });
    }
    function keyFor(n) { return idByName['#' + n] ? 'i:' + idByName['#' + n] : 'n:' + n; }
    var ph = isObj(legacy.pairHistory) ? legacy.pairHistory : {};
    var maxSeen = 0;
    Object.keys(ph).forEach(function (pk) {
      var at = pk.indexOf(LEGACY_SEP);
      if (at <= 0 || at === pk.length - 1) return;
      var a = pk.slice(0, at), b = pk.slice(at + 1);
      if (a === b || isBad(a) || isBad(b)) return;
      var v = ph[pk];
      var g = isObj(v) ? whole(v.gen, 0) || 0 : (whole(v, 0) || 0);
      var c = isObj(v) ? whole(v.count, 0) || 0 : (v ? 1 : 0);
      if (!c) return;
      var ka = keyFor(a), kb = keyFor(b);
      addMember(e, ka, a); addMember(e, kb, b);
      var p = pk2(ka, kb), cur = e.pairs[p];
      e.pairs[p] = cur ? [Math.max(cur[0], g), cur[1] + c] : [g, c];
      e.mem['#' + ka].seen = Math.max(e.mem['#' + ka].seen, g);
      e.mem['#' + kb].seen = Math.max(e.mem['#' + kb].seen, g);
      maxSeen = Math.max(maxSeen, g);
    });
    e.gen = Math.max(whole(legacy.pairGen, 0) || 0, maxSeen);
    if (isObj(legacy.roles)) {
      Object.keys(legacy.roles).forEach(function (n) {
        if (isBad(n) || !Array.isArray(legacy.roles[n])) return;
        var list = legacy.roles[n].filter(function (r) { return typeof r === 'string' && r; });
        if (!list.length) return;
        addMember(e, keyFor(n), n).roles = list.slice(-MAX_ROLES);
      });
    }
    return compact(e);
  }

  /* toLegacyPairs(h) → { pairHistory, pairGen }, 002's two fields, by name. */
  function toLegacyPairs(h) {
    h = normalize(h);
    var out = {};
    Object.keys(h.pairs).forEach(function (pk) {
      var p = pk.split('.'), a = h.names[+p[0]], b = h.names[+p[1]];
      if (a === b) return;
      out[a < b ? a + LEGACY_SEP + b : b + LEGACY_SEP + a] = { gen: h.pairs[pk][0], count: h.pairs[pk][1] };
    });
    return { pairHistory: out, pairGen: h.gen };
  }

  /* toLegacyRoles(h) → 022's and 027's { name: [role, ...] }. */
  function toLegacyRoles(h) {
    h = normalize(h);
    var out = {};
    Object.keys(h.roles).forEach(function (i) { out[h.names[+i]] = h.roles[i].slice(); });
    return out;
  }

  /* byIdNames(h, idNames): the tool's { id: name } map, as
     Roster.trackRenames keeps it, applied to a memory. An 'i:<id>' member takes
     the map's name for it (an older page that followed a rename wrote that
     name, and moved the old fields to it). A member keyed by name, not by id,
     whose name is the map's name for an id it does not hold, is re-keyed to
     'i:<id>': a memory keyed by name (the P2 ports before roster ids) then
     follows a rename that happened before identify() first saw the id, which
     identify() alone cannot, since the name it would match is the old one.
     One id per name, the map's first. Adds no member. */
  function byIdNames(h, idNames) {
    if (!isObj(idNames)) return h;
    var names = h.names.slice(), rekeys = [], done = {};
    Object.keys(idNames).forEach(function (id) {
      var n = idNames[id], k = 'i:' + id;
      if (typeof n !== 'string' || !n || !id || isBad(id) || own(done, '#' + n)) return;
      done['#' + n] = true;
      var at = h.keys.indexOf(k);
      if (at !== -1) { names[at] = n; return; }
      for (var x = 0; x < h.keys.length; x++) {
        if (h.keys[x].indexOf('i:') !== 0 && h.names[x] === n) { rekeys.push([h.keys[x], k]); return; }
      }
    });
    var out = Object.assign({}, h, { names: names });
    rekeys.forEach(function (r) { out = rekey(out, r[0], r[1]); });
    return out;
  }

  /* absorbLegacy(h, legacy): the load-time merge. An older cached page drops
     the memory field when it saves and keeps writing the old ones, so the old
     ones win where they are ahead. No memory: fromLegacy(). idNames first (see
     byIdNames). pairGen above the memory's gen: each pair with a newer gen
     adds its count difference and takes that gen. A role list that differs
     from the memory's replaces it. */
  function absorbLegacy(h, legacy) {
    legacy = isObj(legacy) ? legacy : {};
    if (!isObj(h) || !Array.isArray(h.keys)) return fromLegacy(legacy);
    var e = expand(byIdNames(normalize(h), legacy.idNames));
    var byName = {};
    e.order.forEach(function (k) { var n = e.mem['#' + k].name; if (!own(byName, '#' + n)) byName['#' + n] = k; });
    function keyFor(n) {
      if (own(byName, '#' + n)) return byName['#' + n];
      var k = 'n:' + n, c = 1;
      while (own(e.mem, '#' + k)) { c++; k = 'n:' + n + '#' + c; }
      addMember(e, k, n);
      byName['#' + n] = k;
      return k;
    }
    var lg = whole(legacy.pairGen, 0) || 0;
    if (lg > e.gen && isObj(legacy.pairHistory)) {
      var ph = legacy.pairHistory;
      Object.keys(ph).forEach(function (pk) {
        var at = pk.indexOf(LEGACY_SEP);
        if (at <= 0) return;
        var a = pk.slice(0, at), b = pk.slice(at + 1);
        if (a === b || isBad(a) || isBad(b)) return;
        var v = ph[pk];
        var g = isObj(v) ? whole(v.gen, 0) || 0 : (whole(v, 0) || 0);
        var c = isObj(v) ? whole(v.count, 0) || 0 : (v ? 1 : 0);
        var ka = keyFor(a), kb = keyFor(b), p = pk2(ka, kb), cur = e.pairs[p] || [0, 0];
        if (g <= cur[0]) return;
        e.pairs[p] = [g, cur[1] + Math.max(0, c - cur[1])];
        e.mem['#' + ka].seen = Math.max(e.mem['#' + ka].seen, g);
        e.mem['#' + kb].seen = Math.max(e.mem['#' + kb].seen, g);
      });
      e.gen = lg;
    }
    if (isObj(legacy.roles)) {
      Object.keys(legacy.roles).forEach(function (n) {
        if (isBad(n) || !Array.isArray(legacy.roles[n])) return;
        var list = legacy.roles[n].filter(function (r) { return typeof r === 'string' && r; }).slice(-MAX_ROLES);
        var m = e.mem['#' + keyFor(n)];
        if (list.join('\u0000') !== m.roles.join('\u0000')) m.roles = list;
      });
    }
    return compact(e);
  }

  /* ── formGroups ──────────────────────────────────────────────────────── */

  function readMembers(list, dropped) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (m, i) {
      var mm = typeof m === 'string' ? { key: m, name: m } : m;
      if (!isObj(mm) || !isKey(mm.key)) { if (!(typeof m === 'string' && m === '')) dropped.push({ option: 'members', index: i, why: 'no key' }); return; }
      if (seen['#' + mm.key]) { dropped.push({ option: 'members', index: i, why: 'repeated key', key: mm.key }); return; }
      seen['#' + mm.key] = true;
      out.push({ key: mm.key, name: typeof mm.name === 'string' ? mm.name : mm.key, attrs: isObj(mm.attrs) ? mm.attrs : {} });
    });
    return out;
  }

  function readPairs(list, name, dropped) {
    var out = [];
    if (list === undefined || list === null) return out;
    if (!Array.isArray(list)) { dropped.push({ option: name, why: 'not a list' }); return out; }
    list.forEach(function (p, i) {
      if (!Array.isArray(p) || p.length !== 2 || !isKey(p[0]) || !isKey(p[1]) || p[0] === p[1]) {
        dropped.push({ option: name, index: i, why: 'not a pair of two keys' });
        return;
      }
      out.push([p[0], p[1]]);
    });
    return out;
  }

  /* 002's `(s.skill || 3)`, word for word: a missing value, and a 0, read as
     `missing`. The skill strategies were only ever fed 1 to 5. */
  function attrOf(m, by, missing) {
    var v = Number(m.attrs[by]);
    return v ? v : missing;
  }

  function dealRandom(pool, groups, target, next) {
    var k = target.length;
    shuffle(pool, next).forEach(function (m, i) { groups[target[i % k]].push(m); });
  }
  function sortedByAttr(pool, next, val) {
    return shuffle(pool, next).sort(function (a, b) { return val(b) - val(a); });
  }
  function dealBalanced(pool, groups, target, next, val) {
    var k = target.length, dir = 1, gi = 0;
    sortedByAttr(pool, next, val).forEach(function (m) {
      groups[target[gi]].push(m);
      gi += dir;
      if (gi === k) { gi = k - 1; dir = -1; }
      else if (gi < 0) { gi = 0; dir = 1; }
    });
  }
  function tierCuts(n) { var t1 = Math.ceil(n / 3); return [t1, Math.ceil((n - t1) / 2) + t1]; }
  function dealHeterogeneous(pool, groups, target, next, val, tierOf) {
    var k = target.length;
    var sorted = sortedByAttr(pool, next, val), cut = tierCuts(sorted.length);
    var tiers = [shuffle(sorted.slice(0, cut[0]), next), shuffle(sorted.slice(cut[0], cut[1]), next), shuffle(sorted.slice(cut[1]), next)];
    tiers.forEach(function (tier, t) {
      tier.forEach(function (m, gi) { tierOf[m.key] = t; groups[target[gi % k]].push(m); });
    });
  }
  function dealHomogeneous(pool, groups, target, next, val) {
    var k = target.length;
    var sorted = sortedByAttr(pool, next, val);
    var base = Math.floor(sorted.length / k), extra = sorted.length % k, idx = 0;
    for (var i = 0; i < k; i++) {
      var size = base + (i < extra ? 1 : 0);
      for (var j = 0; j < size; j++) { groups[target[i]].push(sorted[idx]); idx++; }
    }
  }
  function dealCoverage(pool, groups, target, next, mem) {
    var sizes = {};
    target.forEach(function (i) { sizes[i] = groups[i].length; });
    shuffle(pool, next).forEach(function (m) {
      var minSize = Math.min.apply(null, target.map(function (i) { return sizes[i]; }));
      var cands = shuffle(target.filter(function (i) { return sizes[i] === minSize; }), next);
      var best = cands[0], bestCost = Infinity;
      cands.forEach(function (i) {
        var c = groups[i].reduce(function (s, o) { return s + mem(m, o); }, 0);
        if (c < bestCost) { bestCost = c; best = i; }
      });
      groups[best].push(m);
      sizes[best]++;
    });
  }
  /* New: a category dealt evenly. Shuffle, stable sort by category, deal. */
  function dealSpread(pool, groups, target, next, by) {
    var k = target.length;
    function cat(m) { var v = m.attrs[by]; return v === undefined || v === null ? '' : String(v); }
    shuffle(pool, next).sort(function (a, b) { var x = cat(a), y = cat(b); return x < y ? -1 : (x > y ? 1 : 0); })
      .forEach(function (m, i) { groups[target[i % k]].push(m); });
  }

  /* Union of together pairs, over present members only: [[key]] of two or more. */
  function togetherSets(together, present) {
    var parent = {};
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    together.forEach(function (p) {
      if (!present['#' + p[0]] || !present['#' + p[1]]) return;
      var a = '#' + p[0], b = '#' + p[1];
      if (!own(parent, a)) parent[a] = a;
      if (!own(parent, b)) parent[b] = b;
      parent[find(a)] = find(b);
    });
    var sets = {};
    Object.keys(parent).forEach(function (x) { var r = find(x); (sets[r] = sets[r] || []).push(x.slice(1)); });
    return Object.keys(sets).map(function (r) { return sets[r]; });
  }

  /* What no search can do, found before any draw. Greedy for the all-apart
     set, so it can miss one; it never invents one. */
  function findImpossible(apart, together, present, count, largest) {
    var out = [];
    var sets = togetherSets(together, present);
    var setOf = {};
    sets.forEach(function (s, i) {
      s.forEach(function (k) { setOf['#' + k] = i; });
      if (s.length > largest) out.push({ code: 'together-too-big', keys: s.slice() });
    });
    var flagged = {};
    apart.forEach(function (p) {
      var a = setOf['#' + p[0]], b = setOf['#' + p[1]];
      if (a !== undefined && a === b && !flagged[a] && present['#' + p[0]] && present['#' + p[1]]) {
        flagged[a] = true;
        out.push({ code: 'together-holds-apart', keys: sets[a].slice(), pair: p.slice() });
      }
    });
    var adj = {}, nodes = [];
    apart.forEach(function (p) {
      if (!present['#' + p[0]] || !present['#' + p[1]]) return;
      [p[0], p[1]].forEach(function (k) { if (!adj['#' + k]) { adj['#' + k] = {}; nodes.push(k); } });
      adj['#' + p[0]]['#' + p[1]] = true; adj['#' + p[1]]['#' + p[0]] = true;
    });
    var best = [];
    nodes.forEach(function (start) {
      var clique = [start];
      nodes.forEach(function (k) {
        if (k === start) return;
        if (clique.every(function (c) { return adj['#' + c]['#' + k]; })) clique.push(k);
      });
      if (clique.length > best.length) best = clique;
    });
    if (count && best.length > count) out.push({ code: 'apart-more-than-groups', keys: best });
    return out;
  }

  function cmp(a, b) {
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
    return 0;
  }
  function isZero(s) { return s.every(function (x) { return x === 0; }); }

  /* formGroups(members, opts). opts: count or size, sizeRule, remainder, min,
     allowEmpty (see plan()); absent: [key]; strategy: 'random', 'balanced',
     'heterogeneous', 'homogeneous', 'coverage' (002's five stored words) or
     'spread'; by ('skill') and missing (3) for the strategies that read an
     attribute; apart and together: [[a, b]]; previous: [[key]] with lock:
     [bool] (002's locked groups: kept at their index, the count fixed at
     previous.length); history (read, never changed); recency: { penalties:
     [1000, 100] }; cost(a, b), added for each pair sharing a group (and brought down by swaps
     once nothing else is broken); search:
     { attempts: 800, restarts: 0, keepStrategy: false, together: 'pairs' };
     rng or seed.
     Returns { groups, floaters, absent, seed, violations: { apart, together,
     repeats }, impossible, dropped, stats }. */
  function formGroups(list, opts) {
    opts = isObj(opts) ? opts : {};
    var dropped = [];
    var draw = drawFrom(opts);
    var next = draw.next;
    var members = readMembers(list, dropped);
    var mem = reader(opts.history);
    var penalties = isObj(opts.recency) && Array.isArray(opts.recency.penalties)
      ? opts.recency.penalties.map(function (x) { return Number(x) || 0; }) : [1000, 100];
    var search = isObj(opts.search) ? opts.search : {};
    var attempts = whole(search.attempts, 0);
    if (attempts === null) attempts = 800;
    var restarts = whole(search.restarts, 0) || 0;
    var keepStrategy = search.keepStrategy === true;
    var units = search.together === 'units';
    var by = typeof opts.by === 'string' && opts.by ? opts.by : 'skill';
    var missing = Number(opts.missing);
    if (!isFinite(missing) || opts.missing === undefined || opts.missing === null) missing = 3;
    var costFn = typeof opts.cost === 'function' ? opts.cost : null;
    var apart = readPairs(opts.apart, 'apart', dropped);
    var together = readPairs(opts.together, 'together', dropped);

    // The hot loop works on member indexes: the memory's two numbers for every
    // pair read once into tables, and each rule as a pair of indexes. A rule
    // naming someone not in the call can never be broken, so it is kept only
    // for the skip test, which counts it as 002 does.
    var N = members.length, ixOf = {};
    members.forEach(function (m, i) { m.ix = i; ixOf['#' + m.key] = i; });
    var lastT = new Float64Array(N * N), cntT = new Float64Array(N * N);
    if (mem.any) {
      var hIx = mem.h.keys.map(function (k) { return own(ixOf, '#' + k) ? ixOf['#' + k] : -1; });
      Object.keys(mem.h.pairs).forEach(function (pk) {
        var d = pk.indexOf('.'), i0 = hIx[+pk.slice(0, d)], j0 = hIx[+pk.slice(d + 1)];
        if (i0 === undefined || j0 === undefined || i0 < 0 || j0 < 0) return;
        var e0 = mem.h.pairs[pk];
        lastT[i0 * N + j0] = lastT[j0 * N + i0] = e0[0];
        cntT[i0 * N + j0] = cntT[j0 * N + i0] = e0[1];
      });
    }
    function ixPairs(list) {
      return list.filter(function (q) { return own(ixOf, '#' + q[0]) && own(ixOf, '#' + q[1]); })
        .map(function (q) { return [ixOf['#' + q[0]], ixOf['#' + q[1]], q]; });
    }
    var apartIx = ixPairs(apart), togetherIx = ixPairs(together);

    var strategy = opts.strategy === undefined ? 'random' : opts.strategy;
    if (STRATEGIES.indexOf(strategy) === -1) { dropped.push({ option: 'strategy', why: 'unknown', value: strategy }); strategy = 'random'; }
    var fellBack = false;
    if (ATTR_STRATEGIES.indexOf(strategy) !== -1 &&
        !members.some(function (m) { var v = m.attrs[by]; return v !== undefined && v !== null && v !== ''; })) {
      strategy = 'random'; fellBack = true;
    }
    var val = function (m) { return attrOf(m, by, missing); };

    var absentSet = {};
    (Array.isArray(opts.absent) ? opts.absent : []).forEach(function (k) { if (isKey(k)) absentSet['#' + k] = true; });
    var active = members.filter(function (m) { return !absentSet['#' + m.key]; });
    var absent = members.filter(function (m) { return absentSet['#' + m.key]; }).map(function (m) { return m.key; });
    var byKey = {};
    active.forEach(function (m) { byKey['#' + m.key] = m; });
    var present = {};
    active.forEach(function (m) { present['#' + m.key] = true; });

    // Locks: every locked member present, or the locks are dropped and said so.
    var prev = Array.isArray(opts.previous) ? opts.previous : null;
    var lock = Array.isArray(opts.lock) ? opts.lock : null;
    var useLocks = false, locksDropped = false, lockedCount = 0;
    if (prev && lock && lock.some(Boolean)) {
      if (lock.length === prev.length && prev.every(Array.isArray)) {
        useLocks = prev.every(function (g, i) { return !lock[i] || g.every(function (k) { return present['#' + k]; }); });
      }
      if (!useLocks) locksDropped = true;
    }

    var p, count, pool, lockedIdx = {}, base = [], target = [];
    if (useLocks) {
      var lockedKeys = {};
      prev.forEach(function (g, i) {
        if (lock[i]) {
          lockedCount++; lockedIdx[i] = true;
          base.push(g.map(function (k) { lockedKeys['#' + k] = true; return byKey['#' + k]; }));
        } else { target.push(i); base.push([]); }
      });
      pool = active.filter(function (m) { return !lockedKeys['#' + m.key]; });
      count = prev.length;
      p = plan(pool.length, { count: target.length || 1, remainder: opts.remainder, allowEmpty: true });
    } else {
      p = plan(active.length, opts);
      count = p.count;
      pool = active;
      for (var gi0 = 0; gi0 < count; gi0++) { base.push([]); target.push(gi0); }
    }
    var largest = Math.max.apply(null, [0].concat(p.sizes, p.ownGroup ? [p.ownGroup] : []));
    var impossible = findImpossible(apart, together, present, target.length + (p.ownGroup ? 1 : 0), largest);

    var remainder = REMAINDERS[opts.remainder] || 'spread';
    var floorExact = opts.sizeRule === 'floor' && remainder !== 'spread' && !useLocks &&
      (opts.count === undefined || opts.count === null) && p.sizes.length > 0;

    function deal() {
      var groups = base.map(function (g) { return g.slice(); });
      var tierOf = {};
      if (!target.length) return { groups: groups, floaters: [], tierOf: tierOf };
      if (units) dealUnits(groups, tierOf);
      else dealPool(pool, groups, target, tierOf);
      // The remainder: pop from the end of each dealt group, in group order,
      // down to the smallest, which is the size plan() gave.
      var floaters = [];
      if (remainder !== 'spread') {
        // Under 'units' a block is dealt before any single, so the end of a
        // group is a single and popping never splits a block.
        var minSize = Math.min.apply(null, target.map(function (i) { return groups[i].length; }));
        /* sizeRule 'floor': the size plan() gave is the size asked for (never over it), not the smallest group dealt. */
        if (floorExact) minSize = p.sizes[0];
        target.forEach(function (i) {
          while (groups[i].length > minSize) floaters.push(groups[i].pop());
        });
        // A deal that was uneven (heterogeneous tiers) leaves a group short: fill it from the leftovers.
        if (floorExact) target.forEach(function (i) {
          while (groups[i].length < minSize && floaters.length) groups[i].push(floaters.pop());
        });
        if (remainder === 'own-group' && floaters.length >= 2) { groups.push(floaters); floaters = []; }
      }
      return { groups: groups, floaters: floaters, tierOf: tierOf };
    }
    function dealPool(list, groups, tgt, tierOf) {
      if (strategy === 'balanced') dealBalanced(list, groups, tgt, next, val);
      else if (strategy === 'heterogeneous') dealHeterogeneous(list, groups, tgt, next, val, tierOf);
      else if (strategy === 'homogeneous') dealHomogeneous(list, groups, tgt, next, val);
      else if (strategy === 'coverage') dealCoverage(list, groups, tgt, next, function (x, y) { return cntT[x.ix * N + y.ix]; });
      else if (strategy === 'spread') dealSpread(list, groups, tgt, next, by);
      else dealRandom(list, groups, tgt, next);
    }
    function inPool() { var o = {}; pool.forEach(function (m) { o['#' + m.key] = true; }); return o; }
    /* together: 'units'. The sets go first, largest first, each as one block
       into the smallest group (ties shuffled); the strategy then orders the
       rest, and each goes to the smallest group. */
    function dealUnits(groups, tierOf) {
      var sets = togetherSets(together, inPool());
      var inSet = {};
      sets.forEach(function (s) { s.forEach(function (k) { inSet['#' + k] = true; }); });
      sets = shuffle(sets, next).sort(function (a, b) { return b.length - a.length; });
      function smallest() {
        var min = Math.min.apply(null, target.map(function (i) { return groups[i].length; }));
        return target.filter(function (i) { return groups[i].length === min; });
      }
      sets.forEach(function (s) {
        var c = shuffle(smallest(), next)[0];
        s.forEach(function (k) { groups[c].push(byKey['#' + k]); });
      });
      var singles = pool.filter(function (m) { return !inSet['#' + m.key]; });
      var scratch = target.map(function () { return []; });
      var tgt = target.map(function (_, i) { return i; });
      dealPool(singles, scratch, tgt, tierOf);
      // Read the strategy's order back round-robin, then fill smallest-first.
      var order = [];
      for (var r = 0; order.length < singles.length; r++) {
        scratch.forEach(function (g) { if (g[r]) order.push(g[r]); });
      }
      order.forEach(function (m) { groups[smallest()[0]].push(m); });
    }

    var nowGen = mem.h.gen + 1;
    function where(groups) {
      var at = new Int32Array(N).fill(-1);
      for (var i = 0; i < groups.length; i++) { var g = groups[i]; for (var j = 0; j < g.length; j++) at[g[j].ix] = i; }
      return at;
    }
    function penalty(a, b) {
      var lg = lastT[a.ix * N + b.ix];
      if (!lg) return 0;
      return penalties[Math.max(nowGen - lg, 1) - 1] || 0;
    }
    function apartBroken(at) {
      var out = [];
      for (var i = 0; i < apartIx.length; i++) { var q = apartIx[i], ia = at[q[0]]; if (ia !== -1 && ia === at[q[1]]) out.push(q[2]); }
      return out;
    }
    function togetherBroken(at) {
      var out = [];
      for (var i = 0; i < togetherIx.length; i++) {
        var q = togetherIx[i], ia = at[q[0]], ib = at[q[1]];
        if (ia !== -1 && ib !== -1 && ia !== ib) out.push(q[2]);
      }
      return out;
    }
    function hardCount(at) {
      var n = 0, i, q;
      for (i = 0; i < apartIx.length; i++) { q = apartIx[i]; if (at[q[0]] !== -1 && at[q[0]] === at[q[1]]) n++; }
      for (i = 0; i < togetherIx.length; i++) { q = togetherIx[i]; if (at[q[0]] !== -1 && at[q[1]] !== -1 && at[q[0]] !== at[q[1]]) n++; }
      return n;
    }
    function repeatPairs(groups) {
      var out = [];
      groups.forEach(function (g) {
        for (var i = 0; i < g.length; i++) {
          for (var j = i + 1; j < g.length; j++) { if (penalty(g[i], g[j]) > 0) out.push([g[i].key, g[j].key]); }
        }
      });
      return out;
    }
    function strategyMeasure(groups, tierOf) {
      var gs = groups.filter(function (g) { return g.length; });
      if (!gs.length) return 0;
      if (strategy === 'balanced') {
        var means = gs.map(function (g) { return g.reduce(function (s, m) { return s + val(m); }, 0) / g.length; });
        return Math.round((Math.max.apply(null, means) - Math.min.apply(null, means)) * 100);
      }
      if (strategy === 'homogeneous') {
        return Math.round(gs.reduce(function (s, g) {
          var v = g.map(val);
          return s + (Math.max.apply(null, v) - Math.min.apply(null, v));
        }, 0) * 100);
      }
      if (strategy === 'heterogeneous') {
        var tiersIn = {};
        Object.keys(tierOf).forEach(function (k) { tiersIn[tierOf[k]] = true; });
        var nt = Object.keys(tiersIn).length, miss = 0;
        gs.forEach(function (g) {
          if (g.length < nt) return;
          var has = {};
          g.forEach(function (m) { if (tierOf[m.key] !== undefined) has[tierOf[m.key]] = true; });
          miss += nt - Object.keys(has).length;
        });
        return miss;
      }
      if (strategy === 'spread') {
        var cats = {};
        gs.forEach(function (g, gi) {
          g.forEach(function (m) {
            var c = String(m.attrs[by] === undefined || m.attrs[by] === null ? '' : m.attrs[by]);
            (cats[c] = cats[c] || gs.map(function () { return 0; }))[gi]++;
          });
        });
        var worst = 0;
        Object.keys(cats).forEach(function (c) { worst = Math.max(worst, Math.max.apply(null, cats[c]) - Math.min.apply(null, cats[c])); });
        return worst;
      }
      return 0;
    }
    function score(groups, tierOf) {
      var hard = hardCount(where(groups));
      var rep = 0, cost = 0;
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        for (var i = 0; i < g.length; i++) {
          for (var j = i + 1; j < g.length; j++) {
            if (mem.any) rep += penalty(g[i], g[j]);
            if (costFn) { var c = Number(costFn(g[i].key, g[j].key)); if (isFinite(c)) cost += c; }
          }
        }
      }
      return [hard, keepStrategy ? strategyMeasure(groups, tierOf) : 0, rep, cost];
    }

    /* The repair, 002's resolveConstraints() draw for draw. */
    function repair(groups, tierOf) {
      var unlocked = groups.filter(function (_, i) { return !lockedIdx[i]; }).length;
      var best = score(groups, tierOf);
      if ((!apart.length && !together.length && !mem.any && !costFn && !keepStrategy) || unlocked < 2) {
        return { score: best, attempts: 0, stoppedBy: 'skipped' };
      }
      var n = 0, stoppedBy = 'budget';
      while (!isZero(best) && n < attempts) {
        n++;
        var at = where(groups);
        var all = apartBroken(at).concat(togetherBroken(at));
        if (mem.any) all = all.concat(repeatPairs(groups));
        if (!all.length) {
          /* Nothing is broken. With a cost to bring down, swap two members of different
             unlocked groups and keep the swap when the score is better. */
          if (!costFn) { stoppedBy = 'nothing'; break; }
          var open = [];
          for (var ug = 0; ug < groups.length; ug++) { if (!lockedIdx[ug] && groups[ug].length) open.push(ug); }
          if (open.length < 2) { stoppedBy = 'nothing'; break; }
          var ga = groups[open[Math.floor(next() * open.length)]], gb = groups[open[Math.floor(next() * open.length)]];
          if (ga === gb) continue;
          var ia = Math.floor(next() * ga.length), ib = Math.floor(next() * gb.length);
          var ma = ga[ia], mb = gb[ib];
          ga[ia] = mb; gb[ib] = ma;
          var cs = score(groups, tierOf);
          if (cmp(cs, best) < 0) best = cs; else { ga[ia] = ma; gb[ib] = mb; }
          continue;
        }
        var off = all[Math.floor(next() * all.length)];
        var gi = own(ixOf, '#' + off[0]) ? at[ixOf['#' + off[0]]] : -1;
        if (gi === -1 || lockedIdx[gi]) continue;
        var from = groups[gi];
        var si = -1;
        for (var q = 0; q < from.length; q++) { if (from[q].key === off[1]) { si = q; break; } }
        var s;
        if (si !== -1) {
          var cands = [];
          for (var oi = 0; oi < groups.length; oi++) { if (oi !== gi && !lockedIdx[oi] && groups[oi].length) cands.push(oi); }
          if (!cands.length) continue;
          var to = groups[cands[Math.floor(next() * cands.length)]];
          var ti = Math.floor(next() * to.length);
          var a = from[si], b = to[ti];
          from[si] = b; to[ti] = a;
          s = score(groups, tierOf);
          if (cmp(s, best) > 0) { from[si] = a; to[ti] = b; } else best = s;
        } else {
          var ogi = own(ixOf, '#' + off[1]) ? at[ixOf['#' + off[1]]] : -1;
          if (ogi === -1 || lockedIdx[ogi]) continue;
          var tog = groups[ogi];
          var mi = -1;
          for (var r = 0; r < tog.length; r++) { if (tog[r].key === off[1]) { mi = r; break; } }
          var fi = Math.floor(next() * from.length);
          var a2 = from[fi], b2 = tog[mi];
          from[fi] = b2; tog[mi] = a2;
          s = score(groups, tierOf);
          if (cmp(s, best) > 0) { from[fi] = a2; tog[mi] = b2; } else best = s;
        }
      }
      if (isZero(best)) stoppedBy = 'clean';
      return { score: best, attempts: n, stoppedBy: stoppedBy };
    }

    var tries = 0, bestTry = null;
    for (var t = 0; t <= restarts; t++) {
      tries++;
      var d = deal();
      var rep = repair(d.groups, d.tierOf);
      if (!bestTry || cmp(rep.score, bestTry.rep.score) < 0) bestTry = { d: d, rep: rep };
      if (rep.score[0] === 0) break;
    }
    var groups = bestTry.d.groups;
    var at = where(groups);
    var totalPairs = 0, newPairs = 0;
    groups.forEach(function (g) {
      for (var i = 0; i < g.length; i++) {
        for (var j = i + 1; j < g.length; j++) { totalPairs++; if (!cntT[g[i].ix * N + g[j].ix]) newPairs++; }
      }
    });
    var keysOf = function (g) { return g.map(function (m) { return m.key; }); };
    return {
      groups: groups.map(keysOf),
      floaters: keysOf(bestTry.d.floaters),
      absent: absent,
      seed: draw.seed,
      violations: { apart: apartBroken(at), together: togetherBroken(at), repeats: repeatPairs(groups) },
      impossible: impossible,
      dropped: dropped,
      stats: {
        strategy: strategy, fellBack: fellBack, count: count,
        sizes: groups.map(function (g) { return g.length; }),
        ownGroup: remainder === 'own-group' && groups.length > count ? groups[groups.length - 1].length : 0,
        note: remainder === 'own-group' && bestTry.d.floaters.length === 1 ? 'one-left' : null,
        lockedCount: lockedCount, placed: groups.reduce(function (s, g) { return s + g.length; }, 0),
        locksDropped: locksDropped, newPairs: newPairs, totalPairs: totalPairs,
        attempts: bestTry.rep.attempts, tries: tries, score: bestTry.rep.score,
        stoppedBy: bestTry.rep.stoppedBy, spread: strategyMeasure(groups, bestTry.d.tierOf)
      }
    };
  }

  /* ── roles ───────────────────────────────────────────────────────────── */

  /* 022's and 027's roleRecencyScore: never held -1, held last time 1000,
     held k hand-outs ago 100 - min(k, 99). */
  function recencyScore(list, role) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] === role) { var k = list.length - 1 - i; return k === 0 ? 1000 : 100 - Math.min(k, 99); }
    }
    return -1;
  }

  function permutations(n, k, visit) {
    var used = new Array(k).fill(false), pick = [];
    (function go(d) {
      if (d === n) { visit(pick); return; }
      for (var s = 0; s < k; s++) {
        if (used[s]) continue;
        used[s] = true; pick.push(s); go(d + 1); pick.pop(); used[s] = false;
      }
    })(0);
  }

  /* rotateRoles(groups, roles, history, { method, rng, seed }) →
     { byGroup: [[{ key, role }]], repeats: [key] }, members in group order;
     a member past the last role gets role null. 'greedy' (the default) is
     022's and 027's picker draw for draw: members in shuffled order, each
     takes the open role it held longest ago, a random 0 to 0.5 added to each
     score. 'best' is the cheapest whole assignment over the same scores,
     every ordering tried up to 8 members and 400,000 orderings, greedy then swaps above,
     ties broken by rng. `history` is the memory, or { key: [role] }. */
  function rotateRoles(groups, roles, history, opts) {
    opts = isObj(opts) ? opts : {};
    var draw = drawFrom(opts), next = draw.next;
    var mem = isObj(history) && !Array.isArray(history.keys) ? null : reader(history);
    function held(k) {
      if (mem) return mem.roles(k);
      var v = history && own(history, k) ? history[k] : null;
      return Array.isArray(v) ? v : [];
    }
    var rl = (Array.isArray(roles) ? roles : []).filter(function (r) { return typeof r === 'string' && r; });
    var best = opts.method === 'best';
    var byGroup = [], repeats = [];
    (Array.isArray(groups) ? groups : []).forEach(function (g) {
      var ms = (Array.isArray(g) ? g : []).filter(isKey);
      var given = {};
      if (!best) {
        var order = shuffle(ms, next), available = rl.slice();
        order.forEach(function (k) {
          if (!available.length) { given['#' + k] = null; return; }
          var ranked = available.map(function (role) {
            return { role: role, score: recencyScore(held(k), role) + next() * 0.5 };
          }).sort(function (a, b) { return a.score - b.score; });
          var chosen = ranked[0].role;
          given['#' + k] = chosen;
          available.splice(available.indexOf(chosen), 1);
        });
      } else {
        var slots = rl.slice();
        while (slots.length < ms.length) slots.push(null);
        var cost = ms.map(function (k) {
          return slots.map(function (r) { return (r === null ? 0 : recencyScore(held(k), r)) + next() * 1e-3; });
        });
        var pickBest = null, bestCost = Infinity;
        /* Every ordering for a small group, unless there are so many roles that the orderings run past 400,000
           (8 members and 10 roles is 1.8 million, a second and a half on a phone): then the greedy pick and swaps below. */
        var orderings = 1;
        for (var oi = 0; oi < ms.length && orderings <= 400000; oi++) orderings *= (slots.length - oi);
        if (ms.length <= 8 && orderings <= 400000) {
          permutations(ms.length, slots.length, function (pk) {
            var c = 0;
            for (var i = 0; i < pk.length; i++) c += cost[i][pk[i]];
            if (c < bestCost) { bestCost = c; pickBest = pk.slice(); }
          });
        } else {
          var free = slots.map(function (_, i) { return i; });
          pickBest = ms.map(function (_, i) {
            var bi = 0;
            for (var x = 1; x < free.length; x++) { if (cost[i][free[x]] < cost[i][free[bi]]) bi = x; }
            return free.splice(bi, 1)[0];
          });
          var improved = true;
          while (improved) {
            improved = false;
            for (var a = 0; a < pickBest.length; a++) {
              for (var b = a + 1; b < pickBest.length; b++) {
                var now = cost[a][pickBest[a]] + cost[b][pickBest[b]];
                var sw = cost[a][pickBest[b]] + cost[b][pickBest[a]];
                if (sw < now - 1e-9) { var tmp = pickBest[a]; pickBest[a] = pickBest[b]; pickBest[b] = tmp; improved = true; }
              }
              // ...and a role nobody has yet, when it costs this member less.
              for (var u = 0; u < slots.length; u++) {
                if (pickBest.indexOf(u) === -1 && cost[a][u] < cost[a][pickBest[a]] - 1e-9) { pickBest[a] = u; improved = true; }
              }
            }
          }
        }
        ms.forEach(function (k, i) { given['#' + k] = pickBest ? slots[pickBest[i]] : null; });
      }
      byGroup.push(ms.map(function (k) {
        var r = own(given, '#' + k) ? given['#' + k] : null;
        if (r !== null && recencyScore(held(k), r) === 1000) repeats.push(k);
        return { key: k, role: r };
      }));
    });
    return { byGroup: byGroup, repeats: repeats, seed: draw.seed };
  }

  /* coverRoles(group, absentKeys): 022's computeEffectiveMembers(). An absent
     member's role is handed round the present ones, round-robin, the cursor
     moving on even when a slot is reused. `group` is [{ key, role }]; returns
     [{ key, role, effectiveRole, absent }]. No draws. */
  function coverRoles(group, absentKeys) {
    var out = {};
    (Array.isArray(absentKeys) ? absentKeys : []).forEach(function (k) { out['#' + k] = true; });
    var ms = (Array.isArray(group) ? group : []).filter(isObj);
    var presentIdx = [];
    ms.forEach(function (m, i) { if (!out['#' + m.key]) presentIdx.push(i); });
    var cover = {};
    if (presentIdx.length) {
      var cursor = 0;
      ms.forEach(function (m) {
        if (out['#' + m.key] && m.role) {
          var ti = presentIdx[cursor % presentIdx.length];
          cursor++;
          (cover[ti] = cover[ti] || []).push(m.role);
        }
      });
    }
    return ms.map(function (m, i) {
      var isAbsent = !!out['#' + m.key];
      var extra = cover[i] || [];
      var eff = m.role || null;
      if (extra.length) eff = (eff ? [eff] : []).concat(extra).join(' + ');
      return { key: m.key, role: m.role || null, effectiveRole: isAbsent ? null : eff, absent: isAbsent };
    });
  }

  global.Grouping = {
    VERSION: VERSION,
    MAX_ROLES: MAX_ROLES,
    STRATEGIES: STRATEGIES.slice(),
    rng: rng,
    newSeed: newSeed,
    pin: pin,
    plan: plan,
    formGroups: formGroups,
    rotateRoles: rotateRoles,
    coverRoles: coverRoles,
    history: {
      empty: empty,
      normalize: normalize,
      record: record,
      count: count,
      lastGen: lastGen,
      rolesOf: rolesOf,
      coverage: coverage,
      rekey: rekey,
      prune: prune,
      identify: identify,
      fromLegacy: fromLegacy,
      toLegacyPairs: toLegacyPairs,
      toLegacyRoles: toLegacyRoles,
      absorbLegacy: absorbLegacy
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
