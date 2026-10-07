/* Bracket / Tournament Generator (020): teams with members, and the
   first-round consolation bracket. Publishes window.BtTeams. Everything here
   is pure (no DOM, no storage) and is tested in test/smoke-teams-core.mjs;
   the page draws the result.

   WHAT IS STORED, AND WHERE
   Two optional fields on the bracket, in the key it already has
   (gvb-bracket:data:<name>). A bracket that never used either has neither
   field and is saved, shown, printed and shared exactly as it was.
     members:       { '<team name>': [ '<member>', ... ] }   teams with at
                    least one member only; names are the bracket's own
                    entrant strings, so nothing else in the bracket changed.
     consolation:   { slots, winnerSide, third }   single elimination only.
                    `slots` and `winnerSide` have the main bracket's shape
                    (round 0 is the first-round losers, `null` a bye, `false`
                    not decided yet), so the page's own autoAdvance() settles
                    byes in it. `third` is the third-place game's winning side
                    (0, 1) or null. Scores sit in the bracket's `scores`
                    under 'c<round>_<match>' and 'cthird'.
   The bracket has no version number of its own; these two fields are the
   whole of the change, and an older page ignores them.

   THE CONSOLATION RULE
   First-round consolation, not double elimination: the teams that lose their
   first game, and only those, play on. Teams that had a bye in round 1 played
   no first-round game and are not in it. The L losers are placed in the order
   their main-bracket games are listed and paired the way the main bracket
   pairs "as entered": size = the next power of 2 at or above L, the first
   size - L matches get a bye, the rest are full. So there are L - 1 games,
   whoever wins the last is the consolation winner, and a lone loser (a
   bracket with one real first-round game, such as 3 entrants) is the
   consolation winner with no game. Third place is the semifinal losers' game (only the
   teams that actually lost a semifinal: with 3 entrants one semifinal is a
   bye, so the one loser is third with no game). */
(function (global) {
  'use strict';

  var MAX_MEMBERS = 40;
  var MAX_MEMBER_LEN = 60;
  var hasOwn = Object.prototype.hasOwnProperty;

  function clip(s, n) {
    s = String(s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) : s;
  }

  function cleanList(list) {
    var seen = Object.create(null), out = [];
    (Array.isArray(list) ? list : []).forEach(function (m) {
      if (typeof m !== 'string') return;
      var t = clip(m, MAX_MEMBER_LEN);
      if (!t || seen[t.toLowerCase()] || out.length >= MAX_MEMBERS) return;
      seen[t.toLowerCase()] = true;
      out.push(t);
    });
    return out;
  }

  /* One team per line: "Team name: member, member, member". The first colon
     ends the name; members are split on commas and semicolons. A line with no
     colon is a team with no members, exactly today's entrant. */
  function parseTeams(raw) {
    var names = [], members = Object.create(null);
    String(raw || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var at = line.indexOf(':');
      var name = clip(at < 0 ? line : line.slice(0, at), 120);
      if (!name) return;
      names.push(name);
      if (at < 0) return;
      var list = cleanList(line.slice(at + 1).split(/[,;]/));
      if (!list.length) return;
      members[name] = cleanList((hasOwn.call(members, name) ? members[name] : []).concat(list));
    });
    return { names: names, members: hasMembers(members) ? members : undefined };
  }

  function hasMembers(map) { return !!map && Object.keys(map).length > 0; }

  /* Whatever arrives (a saved bracket, a link, a file) -> a members map for
     the given entrant names only, or undefined. */
  function cleanMembers(value, names) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    var out = Object.create(null);
    (names || []).forEach(function (n) {
      if (typeof n !== 'string' || !hasOwn.call(value, n)) return;
      var list = cleanList(value[n]);
      if (list.length) out[n] = list;
    });
    return hasMembers(out) ? out : undefined;
  }

  function entrantNames(state) {
    var names = [];
    function add(n) { if (typeof n === 'string' && names.indexOf(n) < 0) names.push(n); }
    if (!state) return names;
    if (Array.isArray(state.players)) state.players.forEach(add);
    if (Array.isArray(state.slots) && Array.isArray(state.slots[0])) state.slots[0].forEach(add);
    if (Array.isArray(state.pools)) state.pools.forEach(function (p) { (p && p.players || []).forEach(add); });
    return names;
  }

  /* ---------- the consolation bracket ---------- */

  function nextPow2(n) {
    var p = 1;
    while (p < n) p *= 2;
    return Math.max(p, 2);
  }

  // The consolation's own round arrays for L losers, and which round-0 slot
  // the i-th loser takes.
  function layout(L) {
    var size = nextPow2(L), byes = size - L, round0 = [], feed = [];
    for (var m = 0; m < size / 2; m++) {
      round0.push(false); feed.push(m * 2);
      if (m < byes) round0.push(null);
      else { round0.push(false); feed.push(m * 2 + 1); }
    }
    var rounds = [round0], count = size;
    while (count > 1) { count = count / 2; rounds.push(new Array(count).fill(false)); }
    return { slots: rounds, feed: feed };
  }

  // The main bracket's real first-round games, in bracket order.
  function firstRound(state) {
    var out = [], r0 = state.slots[0], r1 = state.slots[1];
    for (var m = 0; m < r1.length; m++) {
      var a = r0[m * 2], b = r0[m * 2 + 1];
      if (a === null || b === null) continue;                          // a bye: nobody played
      var loser = false;
      if (r1[m] !== false) loser = (state.winnerSide['1_' + m] === m * 2) ? b : a;
      out.push({ m: m, a: a, b: b, loser: loser });
    }
    return out;
  }

  function fresh(state) {
    return { slots: layout(firstRound(state).length).slots, winnerSide: {}, third: null };
  }

  function shapeOk(c, L) {
    if (!c || typeof c !== 'object' || !Array.isArray(c.slots)) return false;
    var want = layout(L).slots;
    if (c.slots.length !== want.length) return false;
    for (var r = 0; r < want.length; r++) {
      if (!Array.isArray(c.slots[r]) || c.slots[r].length !== want[r].length) return false;
      for (var i = 0; i < want[r].length; i++) {
        var v = c.slots[r][i];
        if (r === 0 && want[r][i] === null ? v !== null : !(v === false || typeof v === 'string')) return false;
      }
    }
    return true;
  }

  /* A saved or received `consolation`, made safe: the same shape, or a fresh
     one rebuilt from the main bracket's results (which carry everything
     that matters), or null when the bracket cannot have one. */
  function restore(raw, state) {
    if (!state || !Array.isArray(state.slots) || state.slots.length < 3 || (state.type && state.type !== 'single')) return null;
    var L = firstRound(state).length;
    if (L < 1) return null;
    var c = fresh(state);
    if (shapeOk(raw, L)) {
      c.slots = raw.slots.map(function (round) { return round.slice(); });
      if (raw.winnerSide && typeof raw.winnerSide === 'object') {
        Object.keys(raw.winnerSide).forEach(function (k) {
          if (/^\d+_\d+$/.test(k) && typeof raw.winnerSide[k] === 'number') c.winnerSide[k] = raw.winnerSide[k];
        });
      }
      c.third = (raw.third === 0 || raw.third === 1) ? raw.third : null;
    }
    return c;
  }

  /* Put each first-round loser into its slot and let `advance` (the page's
     own autoAdvance, which handles byes) settle what follows. */
  function sync(state, advance) {
    var c = state.consolation;
    if (!c) return;
    var fr = firstRound(state), feed = layout(fr.length).feed;
    fr.forEach(function (f, i) {
      if (f.loser !== false && c.slots[0][feed[i]] === false) c.slots[0][feed[i]] = f.loser;
    });
    advance(c);
  }

  // Each semifinal's loser: a name, false (not played yet) or null (a bye).
  function semiLosers(state) {
    var n = state.slots.length, round = state.slots[n - 3], next = state.slots[n - 2], out = [];
    for (var m = 0; m < next.length; m++) {
      var a = round[m * 2], b = round[m * 2 + 1];
      if (a === null || b === null) out.push(null);
      else if (next[m] === false) out.push(false);
      else out.push(state.winnerSide[(n - 2) + '_' + m] === m * 2 ? b : a);
    }
    return out;
  }

  /* { game, players: [x, y], place }: whether a third-place game is played,
     its two sides (a name or false), and who is third (a name or null). */
  function thirdPlace(state) {
    var losers = semiLosers(state), real = losers.filter(function (l) { return l !== null; });
    if (real.length < 2) {
      var only = real[0];
      return { game: false, players: [], place: typeof only === 'string' ? only : null };
    }
    var c = state.consolation, side = c && (c.third === 0 || c.third === 1) ? c.third : null;
    var ready = typeof real[0] === 'string' && typeof real[1] === 'string';
    return { game: true, players: [real[0], real[1]], place: ready && side !== null ? real[side] : null };
  }

  function consolationWinner(state) {
    var c = state.consolation;
    if (!c) return null;
    var last = c.slots[c.slots.length - 1][0];
    return typeof last === 'string' ? last : null;
  }

  // How many real games the consolation has for L first-round losers.
  function gameCount(L) { return L < 1 ? 0 : L - 1; }

  global.BtTeams = {
    MAX_MEMBERS: MAX_MEMBERS,
    MAX_MEMBER_LEN: MAX_MEMBER_LEN,
    parseTeams: parseTeams,
    cleanMembers: cleanMembers,
    entrantNames: entrantNames,
    hasMembers: hasMembers,
    layout: layout,
    firstRound: firstRound,
    fresh: fresh,
    restore: restore,
    sync: sync,
    semiLosers: semiLosers,
    thirdPlace: thirdPlace,
    consolationWinner: consolationWinner,
    gameCount: gameCount
  };
})(typeof window !== 'undefined' ? window : global);
