/* bracket.js — the bracket engine (Path 13 P3): seeding, single and double
   elimination, round robin, pools, Swiss pairing and the standings tables
   built on them. Publishes window.Bracket. Pure: no DOM, no storage, no clock,
   and no Math.random when a call is given an rng (setRng) — the Node suites
   (Tools/bracket-tournament-generator/test/) drive it in a vm context, as
   grouping.js's are.

   WHERE IT CAME FROM. Every function here is 020's own, moved out of the page
   at v353 with its body unchanged: a state is the same plain object (slots,
   winnerSide, loserSlots, rounds, scores...) it always was, so a bracket saved
   by an older page opens in this one and the reverse. The only change is the
   shuffle, which draws from setRng()'s generator when one is set and from
   Math.random (looked up at the call, so a patched one is seen) when not.
   bracket-parity.test.mjs holds every function to a frozen copy of the page's
   code (_legacy.mjs) over seeded inputs.

   NOT HERE. The page's rendering, undo, share links, scheduling of matches
   to stations and times (state-dependent), and generateBracketFromPools(),
   which writes the page's state. 021 has no bracket (its page text said so;
   the algorithm the Path 13 "Why" called line for line the same is 020's
   alone). Ties, consolation and re-deciding a match are P4. */
(function (root) {
  'use strict';

  var currentRng = null;
  /* A generator (a function returning [0, 1)) for the shuffle, or null to go
     back to Math.random. A suite sets one to make a random seeding repeatable. */
  function setRng(fn) { currentRng = typeof fn === 'function' ? fn : null; }

  function shuffle(arr, rng) {
    var f = rng || currentRng;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor((f ? f() : Math.random()) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nextPowerOf2(n) {
    var p = 1;
    while (p < n) p *= 2;
    return Math.max(p, 2);
  }

  /* Standard "protect the top seeds" bracket placement, recursively built:
     seed 1 always lands at position 0. At each doubling from size n to 2n,
     every existing seed s is paired with its mirror (2n + 1 - s) — the
     textbook NCAA-style seeding order (size 8: 1,8,4,5,2,7,3,6 — i.e.
     1v8, 4v5, 2v7, 3v6). Returns seedPositions where seedPositions[i] is
     the seed NUMBER occupying round-0 position i. */
  function standardSeedOrder(size) {
    var seeds = [1];
    while (seeds.length < size) {
      var n = seeds.length * 2;
      var next = [];
      seeds.forEach(function (s) { next.push(s); next.push(n + 1 - s); });
      seeds = next;
    }
    return seeds;
  }

  /* seedMode: 'random' shuffles; 'ranked' treats `names` as already in seed
     order (names[0] = seed 1) and places them with standardSeedOrder() so
     the top seeds can't meet early and byes land on the weakest seeds;
     anything else ("asEntered") keeps the list order and spreads byes one
     per match front-to-back, same as this tool's original behavior.

     Note on why ranked seeding never doubles up byes in one match: the
     final pairing seedPositions produces is always (s, size+1-s) for
     s = 1..size/2, i.e. one "top half" seed (1..size/2) paired with one
     "bottom half" seed (size/2+1..size). Since numByes = size - n is always
     < size/2 (size is the smallest power of 2 >= n, so n > size/2), every
     bye seed number falls in the bottom half, and the paired top-half seed
     is always real — so no match ever pairs two byes. */
  function buildBracket(name, names, seedMode) {
    var n = names.length;
    var size = nextPowerOf2(n);
    var numMatches = size / 2;
    var round0 = new Array(size).fill(null);

    if (seedMode === 'ranked') {
      var seedPositions = standardSeedOrder(size);
      for (var p = 0; p < size; p++) {
        var seedNum = seedPositions[p];
        round0[p] = (seedNum <= n) ? names[seedNum - 1] : null;
      }
    } else {
      var ordered = (seedMode === 'random') ? shuffle(names) : names.slice();
      var numByes = size - n;
      /* Spread byes one per match (never two in the same match) — numByes
         is always < numMatches for any n, since size is the smallest power
         of 2 that is >= n. */
      var idx = 0;
      for (var m = 0; m < numMatches; m++) {
        if (m < numByes) {
          round0[m * 2] = ordered[idx++];
          round0[m * 2 + 1] = null;
        } else {
          round0[m * 2] = ordered[idx++];
          round0[m * 2 + 1] = ordered[idx++];
        }
      }
    }

    var rounds = [round0];
    var count = size;
    while (count > 1) {
      count = count / 2;
      /* `false` marks "not decided yet" for round 1+. It must be `false`
         and not `undefined`: JSON.stringify turns array holes/`undefined`
         into `null` on save, which would become indistinguishable from a
         real BYE the moment this bracket is reloaded (switching brackets,
         or a page refresh both round-trip through localStorage as JSON). */
      rounds.push(new Array(count).fill(false));
    }

    /* winnerSide records WHICH source slot (its absolute index within the
       earlier round) won each match, keyed "roundIndex_matchIndex" — needed
       because two contestants can share a name, so comparing the winner's
       *name* against a slot's name (as round rendering used to) can't tell
       them apart. */
    return { name: name, slots: rounds, winnerSide: {}, scores: {}, seedMode: seedMode };
  }

  /* Auto-advance byes: if exactly one of a pair is a real name and the
     other is null (bye) or already-eliminated, and the next slot isn't
     decided yet, advance the real name automatically. */
  function autoAdvance(s) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var r = 0; r < s.slots.length - 1; r++) {
        var round = s.slots[r];
        var next = s.slots[r + 1];
        for (var m = 0; m < next.length; m++) {
          if (next[m] !== false) continue;
          var a = round[m * 2];
          var b = round[m * 2 + 1];
          /* Strict null check matters here: a bye is `null`, but an
             undecided match is `false` — loose `== null` would match a real
             null bye only (false != null, so this is already safe either
             way), kept strict for clarity. */
          if (a && b === null) { next[m] = a; s.winnerSide[(r + 1) + '_' + m] = m * 2; changed = true; }
          else if (b && a === null) { next[m] = b; s.winnerSide[(r + 1) + '_' + m] = m * 2 + 1; changed = true; }
        }
      }
    }
  }

  /* ---------- double-elimination ----------
     The winners bracket (state.slots / state.winnerSide) is built and
     auto-advanced with the exact same buildBracket()/autoAdvance() code as
     single-elimination — a double-elim bracket's WB is just a single-elim
     bracket that additionally feeds its losers somewhere instead of
     dropping them.

     The losers bracket (state.loserSlots) is a second sequence of "round
     population" arrays, same shape convention as state.slots (round[r] is
     paired up 2-at-a-time into round[r+1]'s winners), with one twist: LB
     rounds come in pairs per WB round they drain (call the pair's shared
     index i, 1-based):
       - "round A" (0-based index 2i-2): population = the previous round
         B's winners forwarded 1:1 (or, for i=1, the WB round-1 losers
         themselves) — a plain elimination round between LB survivors.
       - "round B" (0-based index 2i-1): population = round A's winners
         interleaved with the freshly-dropped losers of WB round (i+1) —
         a "drop round". Round A's winner for match m lands at the EVEN
         slot 2m (the odd slot 2m+1 is the incoming WB loser); a round B
         winner instead lands directly at slot m of the next round A,
         since round A never interleaves.
     The final loserSlots entry (length 1) is the LB-champion holder, same
     "champion holder" convention state.slots already uses for the WB.

     Worked example, 8 entrants (K=3 WB rounds, size 8):
       WB: R1 4 matches -> R2 2 matches -> Final 1 match -> WB champion.
       LB round A(i=1) [lb0, 4 slots]: the 4 WB-R1 losers, paired into 2
         matches -> 2 winners.
       LB round B(i=1) [lb1, 4 slots]: those 2 winners at slots 0,2 + the
         2 WB-R2 losers at slots 1,3 -> 2 matches -> 2 winners.
       LB round A(i=2) [lb2, 2 slots]: those 2 winners, paired -> 1 match
         -> 1 winner.
       LB round B(i=2) [lb3, 2 slots]: that winner at slot 0 + the WB
         Final's loser at slot 1 -> 1 match -> the LB champion.
     This matches the standard published 8-team double-elim bracket. */
  function buildDoubleElimBracket(name, names, seedMode) {
    var base = buildBracket(name, names, seedMode);
    var wbRounds = base.slots;
    var K = wbRounds.length - 1; // number of real WB match-rounds

    var loserSlots = [];
    for (var i = 1; i <= K - 1; i++) {
      var matchesI = wbRounds[0].length / Math.pow(2, i + 1);
      loserSlots.push(new Array(2 * matchesI).fill(false)); // round A
      loserSlots.push(new Array(2 * matchesI).fill(false)); // round B
    }
    loserSlots.push(new Array(1).fill(false)); // LB champion holder

    return {
      name: name,
      type: 'double',
      slots: wbRounds,
      winnerSide: base.winnerSide,
      loserSlots: loserSlots,
      loserWinnerSide: {},
      grandFinal: { p: [false, false], m1Winner: null, needsReset: false, m2Winner: null, champion: null },
      scores: {},
      seedMode: seedMode
    };
  }

  /* Mirrors autoAdvance()'s bye-skipping, but for a double-elim bracket:
     runs the ordinary WB auto-advance first, then (a) drops each newly
     decided WB match's loser into its losers-bracket slot, and (b) chases
     byes/forwarding through the losers bracket the same way autoAdvance()
     chases them through the winners bracket. A `null` WB loser (a bye —
     nobody really played that match) is dropped into the LB as `null` too,
     so it flows through as a bye there as well instead of stalling the
     bracket. */
  function autoAdvanceDouble(s) {
    autoAdvance(s);

    var wb = s.slots;
    var K = wb.length - 1;
    var lb = s.loserSlots;
    if (K < 1) return;

    function wbLoserAt(wbRoundIdx, m) {
      var next = wb[wbRoundIdx + 1];
      if (next[m] === false) return false; // that WB match isn't decided yet
      var winSide = s.winnerSide[(wbRoundIdx + 1) + '_' + m];
      var loserSide = (winSide === m * 2) ? (m * 2 + 1) : (m * 2);
      return wb[wbRoundIdx][loserSide]; // a name, or null if that side was a bye
    }

    if (K === 1) {
      // Only one WB match total: no losers-bracket games are ever played,
      // the sole loser goes straight through to the LB-champion holder.
      if (lb[0][0] === false) {
        var solo = wbLoserAt(0, 0);
        if (solo !== false) lb[0][0] = solo;
      }
      return;
    }

    var changed = true;
    while (changed) {
      changed = false;

      // Seed LB round A of i=1 directly from the WB round-1 losers.
      for (var m0 = 0; m0 < lb[0].length; m0++) {
        if (lb[0][m0] === false) {
          var loser0 = wbLoserAt(0, m0);
          if (loser0 !== false) { lb[0][m0] = loser0; changed = true; }
        }
      }

      // Drop WB round-(i+1) losers into every "round B" array's odd slots.
      for (var r = 1; r < lb.length - 1; r += 2) {
        var i = (r + 1) / 2;
        var roundB = lb[r];
        for (var mB = 0; mB < roundB.length / 2; mB++) {
          if (roundB[mB * 2 + 1] === false) {
            var loserB = wbLoserAt(i, mB);
            if (loserB !== false) { roundB[mB * 2 + 1] = loserB; changed = true; }
          }
        }
      }

      // Chase byes within the LB and forward already-decided matches.
      for (var r2 = 0; r2 < lb.length - 1; r2++) {
        var pop = lb[r2];
        var nextArr = lb[r2 + 1];
        var isRoundA = (r2 % 2 === 0);
        var matches = pop.length / 2;
        for (var m2 = 0; m2 < matches; m2++) {
          var target = isRoundA ? m2 * 2 : m2;
          if (nextArr[target] !== false) continue;
          var a = pop[m2 * 2];
          var b = pop[m2 * 2 + 1];
          if (a === false || b === false) continue; // still waiting on an earlier round/drop
          if (a === null && b === null) {
            nextArr[target] = null; // cascading bye — nobody real reaches this slot
            changed = true;
          } else if (a === null) {
            nextArr[target] = b;
            s.loserWinnerSide[r2 + '_' + m2] = m2 * 2 + 1;
            changed = true;
          } else if (b === null) {
            nextArr[target] = a;
            s.loserWinnerSide[r2 + '_' + m2] = m2 * 2;
            changed = true;
          }
          // both real names: this is a live match, needs a click
        }
      }
    }
  }

  /* ---------- round robin ----------
     Standard "circle method" scheduling: fix player 0, rotate everyone else
     one seat each round. With n players (n padded to even with one `null`
     BYE seat when the count is odd) this produces exactly n-1 rounds of n/2
     matches each, with every real pair meeting exactly once. A `null` on
     either side of a match means the other side sits out that round — it is
     not a result and never touches standings. */
  /* Round robin has no bracket-placement concept — every pair meets
     regardless of seed order — so seedMode only decides (a) whether the
     entry list is shuffled ('random') or kept as-is ('asEntered'/'ranked'),
     and (b) for 'ranked', a seeds map (entry order = rank 1..N) carried
     along purely so the standings table can show an initial Seed column;
     it never affects the match schedule itself. */
  function buildRoundRobin(name, names, seedMode) {
    var ordered = (seedMode === 'random') ? shuffle(names) : names.slice();
    var arr = ordered.slice();
    if (arr.length % 2 === 1) arr.push(null);
    var n = arr.length;
    var totalRounds = n - 1;
    var rounds = [];
    for (var r = 0; r < totalRounds; r++) {
      var roundMatches = [];
      for (var i = 0; i < n / 2; i++) {
        roundMatches.push({ a: arr[i], b: arr[n - 1 - i], winner: null });
      }
      rounds.push(roundMatches);
      var fixed = arr[0];
      var rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed].concat(rest);
    }
    var out = { name: name, type: 'roundrobin', players: ordered, rounds: rounds, scores: {}, seedMode: seedMode };
    if (seedMode === 'ranked') {
      out.seeds = {};
      names.forEach(function (p, i) { out.seeds[p] = i + 1; });
    }
    return out;
  }

  /* w/l/played come from who was clicked (or score-derived, see
     buildScoreInputs) as the match winner; pf/pa/diff come separately from
     whatever structured {a,b} score was entered for that same match key
     ('rr' + round + '_' + matchIndex) — a match can be decided without a
     score ever being typed, so these two data sources are kept independent
     and just happen to be looked up by the same key. */
  function computeStandings(state) {
    var records = {};
    state.players.forEach(function (p) {
      records[p] = { name: p, w: 0, l: 0, played: 0, pf: 0, pa: 0, diff: 0, seed: (state.seeds && state.seeds[p]) || null };
    });
    state.rounds.forEach(function (round, r) {
      round.forEach(function (m, mi) {
        if (m.a == null || m.b == null || m.winner === null) return;
        var sc = state.scores && state.scores['rr' + r + '_' + mi];
        if (m.winner === 'draw') {
          drawn(records, m, sc);
          return;
        }
        var winnerName = m.winner === 0 ? m.a : m.b;
        var loserName = m.winner === 0 ? m.b : m.a;
        records[winnerName].w++; records[winnerName].played++;
        records[loserName].l++; records[loserName].played++;
        if (sc && typeof sc.a === 'number' && typeof sc.b === 'number') {
          records[m.a].pf += sc.a; records[m.a].pa += sc.b;
          records[m.b].pf += sc.b; records[m.b].pa += sc.a;
        }
      });
    });
    Object.keys(records).forEach(function (k) { records[k].diff = records[k].pf - records[k].pa; });
    return Object.keys(records).map(function (k) { return records[k]; }).sort(byRecord);
  }

  /* A drawn game (P4): each side gets one played and a `d`, and the score, if
     one was typed, counts for points as in any other game. `d` exists only on a
     row that has drawn, so a state nobody drew in has the rows it always had. */
  function drawn(records, m, sc) {
    [m.a, m.b].forEach(function (nm) { records[nm].d = (records[nm].d || 0) + 1; records[nm].played++; });
    if (sc && typeof sc.a === 'number' && typeof sc.b === 'number') {
      records[m.a].pf += sc.a; records[m.a].pa += sc.b;
      records[m.b].pf += sc.b; records[m.b].pa += sc.a;
    }
  }

  /* wins, with a draw worth half a win, then point difference, then fewer
     losses, then name: with no draws, exactly the order this always was. */
  function byRecord(x, y) {
    return (y.w + (y.d || 0) / 2) - (x.w + (x.d || 0) / 2) || y.diff - x.diff || x.l - y.l || x.name.localeCompare(y.name);
  }

  /* ---------- pools (round robin groups feeding an elimination bracket) ----
     A pool is *literally* a buildRoundRobin() result — same {players, rounds}
     shape — so computeStandings() above is reused completely unmodified for
     pool standings; the only wrinkle is that a pool's own `.scores` field is
     discarded (see below) and a view derived from the top-level state.scores
     is passed in its place at read time, so every pool's match scores still
     live in the one place buildScoreInputs already knows how to read/write
     (the top-level `state.scores`), namespaced by a 'poolN_' key prefix the
     same way double-elimination already namespaces its winners/losers/grand-
     final scores with 'w'/'l'/'g' prefixes in one shared map.

     Once every pool's round robin is fully decided, seedOrderFromPools()
     ranks the advancing entrants (top `advancePerPool` from each pool,
     grouped by finish position — every pool's winner, then every pool's
     runner-up, and so on, so the strongest teams from different pools don't
     collide before they have to) and hands that ordered list straight to the
     existing buildBracket(..., 'ranked') — reusing standardSeedOrder's
     "protect the top seeds" placement exactly as ranked single-elimination
     already does, rather than inventing a second seeding algorithm. */

  /* Snake distribution (1,2,..,P, P,..,2,1, 1,2,..) keeps pools balanced in
     both size and (when the incoming order carries seed meaning) strength,
     regardless of whether `orderedNames` came from Ranked seeding, a
     shuffle, or plain list order — harmless either way, so it's always used
     rather than branching on seedMode a second time. */
  function distributeIntoPools(orderedNames, numPools) {
    var pools = [];
    for (var i = 0; i < numPools; i++) pools.push([]);
    orderedNames.forEach(function (nm, i) {
      var cycle = Math.floor(i / numPools);
      var posInCycle = i % numPools;
      var poolIdx = (cycle % 2 === 0) ? posInCycle : (numPools - 1 - posInCycle);
      pools[poolIdx].push(nm);
    });
    return pools;
  }

  function buildPools(name, names, seedMode, numPools, advancePerPool) {
    var ordered = (seedMode === 'random') ? shuffle(names) : names.slice();
    var groups = distributeIntoPools(ordered, numPools);
    var pools = groups.map(function (group, i) {
      var pool = buildRoundRobin('Pool ' + (i + 1), group, 'asEntered');
      delete pool.scores; // pool match scores live in the top-level state.scores — see comment above
      delete pool.type;
      delete pool.seedMode;
      return pool;
    });
    var out = {
      name: name, type: 'pools', seedMode: seedMode,
      pools: pools, advancePerPool: Math.max(1, advancePerPool | 0),
      bracket: null, scores: {}
    };
    if (seedMode === 'ranked') {
      out.seeds = {};
      names.forEach(function (p, i) { out.seeds[p] = i + 1; });
      pools.forEach(function (pool) {
        pool.seeds = {};
        pool.players.forEach(function (p) { pool.seeds[p] = out.seeds[p]; });
      });
    }
    return out;
  }

  function poolRoundRobinComplete(pool) {
    return pool.rounds.every(function (round) {
      return round.every(function (m) { return m.a == null || m.b == null || m.winner !== null; });
    });
  }

  function poolsComplete(poolsState) {
    return poolsState.pools.every(poolRoundRobinComplete);
  }

  /* True once at least one { a } or { b } number exists among the scores
     namespaced under `prefix` — the same "has any score been typed" check
     standingsHasScores() already does for a whole bracket, scoped down to
     one pool (or, with 'br_', the pools-fed bracket) so each standings table
     only grows PF/PA/Diff columns once its own section actually has one. */
  function prefixedHasScores(scoresState, prefix) {
    return !!(scoresState.scores && Object.keys(scoresState.scores).some(function (k) {
      if (k.indexOf(prefix) !== 0) return false;
      var v = scoresState.scores[k];
      return v && (typeof v.a === 'number' || typeof v.b === 'number');
    }));
  }

  function poolScoresView(poolsState, poolIdx) {
    var prefix = 'pool' + poolIdx + '_';
    var view = {};
    Object.keys(poolsState.scores || {}).forEach(function (k) {
      if (k.indexOf(prefix) === 0) view[k.slice(prefix.length)] = poolsState.scores[k];
    });
    return view;
  }

  function poolStandingsFor(poolsState, poolIdx) {
    var pool = poolsState.pools[poolIdx];
    return computeStandings({ players: pool.players, rounds: pool.rounds, scores: poolScoresView(poolsState, poolIdx), seeds: pool.seeds });
  }

  /* Ranks advancing entrants by finish position across pools (every pool's
     1st place, then every pool's 2nd place, ...) rather than pool-by-pool,
     so the top of the seed list is the actual strongest tier of the whole
     field — buildBracket's existing 'ranked' placement then keeps seed 1 and
     seed 2 apart until the final exactly as it already does for a plain
     ranked single-elimination bracket. */
  function seedOrderFromPools(poolsState) {
    var standingsByPool = poolsState.pools.map(function (_, i) { return poolStandingsFor(poolsState, i); });
    var seeded = [];
    for (var rank = 0; rank < poolsState.advancePerPool; rank++) {
      standingsByPool.forEach(function (standings) {
        if (standings[rank]) seeded.push(standings[rank].name);
      });
    }
    return seeded;
  }

  function bracketScoresView(poolsState) {
    var prefix = 'br_';
    var view = {};
    Object.keys(poolsState.scores || {}).forEach(function (k) {
      if (k.indexOf(prefix) === 0) view[k.slice(prefix.length)] = poolsState.scores[k];
    });
    return view;
  }

  /* ---------- Swiss pairing ----------
     Round 1 has no results to pair by, so it uses the standard Swiss
     "split the field in half, top half vs bottom half" opening (seed 1 vs
     seed ceil(n/2)+1, seed 2 vs seed ceil(n/2)+2, ...) over `ordered`'s own
     order — seed order under Ranked, list order otherwise — rather than
     falling through a standings tiebreak that would make Ranked seeding
     invisible in the one round it matters most. An odd field gives the
     LAST entrant (the weakest seed, under Ranked) a bye, the same "byes
     land on the weakest seed" choice the elimination formats already make.

     Every round after that pairs by current record (computeSwissStandings,
     below), grouped best-to-worst, matching each player against the next
     player in that order they haven't already played where possible (a
     small-field or late-round tournament can run out of fresh opponents —
     when that happens this falls back to a repeat rather than leaving
     someone unpaired). A repeated bye is avoided the same way: the player
     with the fewest byes so far gets this round's, ties broken toward the
     weaker current record. */
  function buildSwiss(name, names, seedMode, numRounds) {
    var ordered = (seedMode === 'random') ? shuffle(names) : names.slice();
    var out = { name: name, type: 'swiss', seedMode: seedMode, players: ordered, numRounds: Math.max(1, numRounds | 0), rounds: [], scores: {} };
    if (seedMode === 'ranked') {
      out.seeds = {};
      names.forEach(function (p, i) { out.seeds[p] = i + 1; });
    }
    out.rounds.push(buildSwissRound1(ordered));
    return out;
  }

  function buildSwissRound1(ordered) {
    var arr = ordered.slice();
    var bye = null;
    if (arr.length % 2 === 1) bye = arr.pop();
    var half = arr.length / 2;
    var matches = [];
    for (var i = 0; i < half; i++) {
      matches.push({ a: arr[i], b: arr[i + half], winner: null });
    }
    if (bye !== null) matches.push({ a: bye, b: null, winner: 0 }); // a bye is an automatic win — see computeSwissStandings
    return matches;
  }

  function swissPastOpponents(swState) {
    var seen = {};
    swState.rounds.forEach(function (round) {
      round.forEach(function (m) {
        if (m.a == null || m.b == null) return;
        (seen[m.a] = seen[m.a] || {})[m.b] = true;
        (seen[m.b] = seen[m.b] || {})[m.a] = true;
      });
    });
    return seen;
  }

  function swissByeCounts(swState) {
    var counts = {};
    swState.players.forEach(function (p) { counts[p] = 0; });
    swState.rounds.forEach(function (round) {
      round.forEach(function (m) {
        if (m.a == null && m.b != null) counts[m.b]++;
        else if (m.b == null && m.a != null) counts[m.a]++;
      });
    });
    return counts;
  }

  function buildSwissRound(swState) {
    var standings = computeSwissStandings(swState); // best to worst
    var opponents = swissPastOpponents(swState);
    var byeCounts = swissByeCounts(swState);
    var pool = standings.map(function (r) { return r.name; });

    var byePlayer = null;
    if (pool.length % 2 === 1) {
      var worstFirst = pool.slice().reverse();
      var minByes = Math.min.apply(null, worstFirst.map(function (p) { return byeCounts[p] || 0; }));
      byePlayer = worstFirst.filter(function (p) { return (byeCounts[p] || 0) === minByes; })[0];
      pool = pool.filter(function (p) { return p !== byePlayer; });
    }

    var unpaired = pool.slice();
    var matches = [];
    while (unpaired.length) {
      var p1 = unpaired.shift();
      var idx = -1;
      for (var i = 0; i < unpaired.length; i++) {
        if (!(opponents[p1] && opponents[p1][unpaired[i]])) { idx = i; break; }
      }
      if (idx === -1) idx = 0; // every remaining candidate is a repeat — small-field edge case
      var p2 = unpaired.splice(idx, 1)[0];
      matches.push({ a: p1, b: p2, winner: null });
    }
    if (byePlayer !== null) matches.push({ a: byePlayer, b: null, winner: 0 });
    return matches;
  }

  /* Same shape and tie-break as computeStandings (wins, then point diff,
     then fewer losses, then name) but with one deliberate divergence: a bye
     round credits the present player a genuine win (and a played match),
     not round robin's "sitting out, no credit." Swiss pairing depends on
     every player having a decisive record each round, which a neutral bye
     can't provide — documented here rather than folded silently into
     computeStandings, which round robin (and pools, built on it) still use
     unmodified with the opposite, "a bye is nobody's result" convention. */
  function computeSwissStandings(swState) {
    var records = {};
    swState.players.forEach(function (p) {
      records[p] = { name: p, w: 0, l: 0, played: 0, pf: 0, pa: 0, diff: 0, seed: (swState.seeds && swState.seeds[p]) || null };
    });
    swState.rounds.forEach(function (round, r) {
      round.forEach(function (m, mi) {
        if (m.a == null && m.b == null) return;
        if (m.a == null || m.b == null) {
          var byeWinner = m.a == null ? m.b : m.a;
          if (records[byeWinner]) { records[byeWinner].w++; records[byeWinner].played++; }
          return;
        }
        if (m.winner === null) return;
        var sc = swState.scores && swState.scores['rr' + r + '_' + mi];
        if (m.winner === 'draw') {
          drawn(records, m, sc);
          return;
        }
        var winnerName = m.winner === 0 ? m.a : m.b;
        var loserName = m.winner === 0 ? m.b : m.a;
        records[winnerName].w++; records[winnerName].played++;
        records[loserName].l++; records[loserName].played++;
        if (sc && typeof sc.a === 'number' && typeof sc.b === 'number') {
          records[m.a].pf += sc.a; records[m.a].pa += sc.b;
          records[m.b].pf += sc.b; records[m.b].pa += sc.a;
        }
      });
    });
    Object.keys(records).forEach(function (k) { records[k].diff = records[k].pf - records[k].pa; });
    return Object.keys(records).map(function (k) { return records[k]; }).sort(byRecord);
  }

  /* ---------- elimination standings (single & double) ----------
     The backlog ask ("scores that feed standings") named round robin
     explicitly, but a bracket that eliminates people is exactly the kind of
     "record" a printed sheet should carry too — so this derives the same
     shape of table (W/L/Played/PF/PA/Diff) from the actual decided matches
     in the winners bracket (and, for double elimination, the losers bracket
     and grand final), rather than restricting the standings idea to
     round-robin only. A bye-advance is not a played match (autoAdvance()'s
     own framing: "nobody real reaches this slot" / "nobody really played
     that match") so it never contributes a win or a loss here either. */
  function eliminationEntrants(state) {
    var names = [];
    state.slots[0].forEach(function (n) { if (n != null) names.push(n); });
    return names;
  }

  function eliminationMatches(state) {
    var matches = [];
    function scanBracket(slots, winnerSideMap, keyPrefix) {
      for (var r = 0; r < slots.length - 1; r++) {
        var round = slots[r], next = slots[r + 1];
        for (var m = 0; m < next.length; m++) {
          var a = round[m * 2], b = round[m * 2 + 1];
          if (a == null || b == null) continue; // a bye — nobody really played
          if (next[m] === false) continue; // not decided yet
          var winSide = winnerSideMap[(r + 1) + '_' + m];
          matches.push({ a: a, b: b, winner: (winSide === m * 2) ? a : b, scoreKey: keyPrefix + r + '_' + m });
        }
      }
    }
    scanBracket(state.slots, state.winnerSide, (state.type === 'double') ? 'w' : '');
    if (state.type === 'double') {
      var lb = state.loserSlots;
      for (var r2 = 0; r2 < lb.length - 1; r2++) {
        var lround = lb[r2];
        var count = lround.length / 2;
        for (var m2 = 0; m2 < count; m2++) {
          var a2 = lround[m2 * 2], b2 = lround[m2 * 2 + 1];
          if (a2 == null || b2 == null) continue;
          var winSide2 = state.loserWinnerSide[r2 + '_' + m2];
          if (winSide2 === undefined) continue;
          matches.push({ a: a2, b: b2, winner: (winSide2 === m2 * 2) ? a2 : b2, scoreKey: 'l' + r2 + '_' + m2 });
        }
      }
      var gf = state.grandFinal;
      if (gf.p[0] !== false && gf.p[1] !== false) {
        if (gf.m1Winner !== null) matches.push({ a: gf.p[0], b: gf.p[1], winner: gf.p[gf.m1Winner], scoreKey: 'g0' });
        if (gf.needsReset && gf.m2Winner !== null) matches.push({ a: gf.p[0], b: gf.p[1], winner: gf.p[gf.m2Winner], scoreKey: 'g1' });
      }
    }
    return matches;
  }

  function computeEliminationStandings(state) {
    var records = {};
    function ensure(name) {
      if (!records[name]) records[name] = { name: name, w: 0, l: 0, played: 0, pf: 0, pa: 0, diff: 0 };
      return records[name];
    }
    eliminationEntrants(state).forEach(ensure);
    eliminationMatches(state).forEach(function (mt) {
      var loserName = (mt.winner === mt.a) ? mt.b : mt.a;
      var winnerRec = ensure(mt.winner), loserRec = ensure(loserName);
      winnerRec.w++; winnerRec.played++;
      loserRec.l++; loserRec.played++;
      var sc = state.scores && state.scores[mt.scoreKey];
      if (sc && typeof sc.a === 'number' && typeof sc.b === 'number') {
        ensure(mt.a).pf += sc.a; ensure(mt.a).pa += sc.b;
        ensure(mt.b).pf += sc.b; ensure(mt.b).pa += sc.a;
      }
    });
    Object.keys(records).forEach(function (k) { records[k].diff = records[k].pf - records[k].pa; });
    return Object.keys(records).map(function (k) { return records[k]; }).sort(function (x, y) {
      return y.w - x.w || y.diff - x.diff || x.l - y.l || x.name.localeCompare(y.name);
    });
  }

  function eliminationChampionName(state) {
    if (state.type === 'double') return state.grandFinal.champion || null;
    var totalRounds = state.slots.length;
    return state.slots[totalRounds - 1][0] || null;
  }

  function roundRobinComplete(state) {
    return state.rounds.every(function (round) {
      return round.every(function (m) { return m.a == null || m.b == null || m.winner !== null; });
    });
  }

  /* ---------- re-deciding a match, and draws (Path 13 P4) ----------
     All of this is new; nothing above changes for a state nobody re-decides or
     draws in. A "bracket object" is anything shaped { slots, winnerSide }: the
     single-elimination state, a pools-fed bracket, or a consolation bracket. A
     match's score is keyed prefix + round + '_' + match, the round being that
     of the two contestants, which is how the page reads them back. */

  /* Every match that has been decided downstream of slot (k, i), nearest first,
     as [round of the slot it produced, match]. */
  function decidedBelow(obj, k, i) {
    var out = [];
    while (k + 1 < obj.slots.length) {
      i = i >> 1; k++;
      if (obj.slots[k][i] !== false) out.push([k, i]);
    }
    return out;
  }

  /* The decided matches a change to the match that fills slot (r+1, m) would
     put in doubt: the ones after it, not itself. */
  function dependentsOf(obj, r, m) { return decidedBelow(obj, r + 1, m); }

  function clearBelow(obj, scores, prefix, k, i) {
    var gone = decidedBelow(obj, k, i);
    gone.forEach(function (c) {
      obj.slots[c[0]][c[1]] = false;
      delete obj.winnerSide[c[0] + '_' + c[1]];
      if (scores) delete scores[prefix + (c[0] - 1) + '_' + c[1]];
    });
    return gone;
  }

  /* Gives the match (r, m) to the side that lost it. The match's own score goes
     (it describes the other result) and so does every later decision, since
     one of the two players there is now someone who never played it. Returns
     { ok, cleared: [[round, match]...], reason }; a bye, a match not yet
     decided or a missing match changes nothing. */
  function redecideElimination(obj, scores, r, m, prefix) {
    prefix = prefix || '';
    var slots = obj.slots;
    if (!(r >= 0 && r < slots.length - 1) || !(m >= 0 && m < slots[r + 1].length)) return { ok: false, reason: 'no such match' };
    var a = slots[r][m * 2], b = slots[r][m * 2 + 1];
    if (typeof a !== 'string' || typeof b !== 'string') return { ok: false, reason: 'a bye or an empty side' };
    if (slots[r + 1][m] === false) return { ok: false, reason: 'not decided yet' };
    var was = obj.winnerSide[(r + 1) + '_' + m];
    var side = (was === m * 2) ? m * 2 + 1 : m * 2;
    var cleared = clearBelow(obj, scores, prefix, r + 1, m);
    if (scores) delete scores[prefix + r + '_' + m];
    slots[r + 1][m] = slots[r][side];
    obj.winnerSide[(r + 1) + '_' + m] = side;
    autoAdvance(obj);
    return { ok: true, cleared: cleared };
  }

  /* Empties a consolation (or any bracket-object) slot that held a first-round
     loser who has changed, and everything decided from it. */
  function vacateSlot(obj, scores, prefix, k, i) {
    var cleared = clearBelow(obj, scores, prefix, k, i);
    obj.slots[k][i] = false;
    return cleared;
  }

  /* A game in a round robin, pool or Swiss round: 0, 1 or 'draw' from two
     typed scores. A tie is a draw only when draws are allowed; otherwise null
     (undecided). */
  function resultFromScores(a, b, draws) {
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    if (a === b) return draws ? 'draw' : null;
    return a > b ? 0 : 1;
  }

  /* Changes a decided game to `result` (0, 1 or 'draw'). The score is dropped
     if it says something else. Nothing else depends on a game in a round robin
     or a pool before its bracket is drawn; Swiss and pools have their own
     reopen below for what does. */
  function setMatchResult(match, scores, scoreKey, result) {
    match.winner = result;
    var sc = scores && scores[scoreKey];
    if (sc && resultFromScores(sc.a, sc.b, true) !== result) delete scores[scoreKey];
  }

  /* Swiss: drops every round after `roundIdx` (they were paired from the old
     record) and the scores typed in them. Returns the number of rounds dropped. */
  function swissReopen(swState, roundIdx) {
    var dropped = swState.rounds.length - (roundIdx + 1);
    if (dropped <= 0) return 0;
    swState.rounds.length = roundIdx + 1;
    Object.keys(swState.scores || {}).forEach(function (k) {
      var mt = /^rr(\d+)_/.exec(k);
      if (mt && +mt[1] > roundIdx) delete swState.scores[k];
    });
    return dropped;
  }

  /* Pools: throws away the bracket drawn from the pool standings, and its
     scores (the 'br_' keys). True if there was one. */
  function poolsReopen(poolsState) {
    if (!poolsState.bracket) return false;
    poolsState.bracket = null;
    Object.keys(poolsState.scores || {}).forEach(function (k) { if (k.indexOf('br_') === 0) delete poolsState.scores[k]; });
    return true;
  }

  root.Bracket = {
    setRng: setRng,
    shuffle: shuffle,
    nextPowerOf2: nextPowerOf2,
    standardSeedOrder: standardSeedOrder,
    buildBracket: buildBracket,
    autoAdvance: autoAdvance,
    buildDoubleElimBracket: buildDoubleElimBracket,
    autoAdvanceDouble: autoAdvanceDouble,
    buildRoundRobin: buildRoundRobin,
    computeStandings: computeStandings,
    distributeIntoPools: distributeIntoPools,
    buildPools: buildPools,
    poolRoundRobinComplete: poolRoundRobinComplete,
    poolsComplete: poolsComplete,
    prefixedHasScores: prefixedHasScores,
    poolScoresView: poolScoresView,
    poolStandingsFor: poolStandingsFor,
    seedOrderFromPools: seedOrderFromPools,
    bracketScoresView: bracketScoresView,
    buildSwiss: buildSwiss,
    buildSwissRound1: buildSwissRound1,
    swissPastOpponents: swissPastOpponents,
    swissByeCounts: swissByeCounts,
    buildSwissRound: buildSwissRound,
    computeSwissStandings: computeSwissStandings,
    eliminationEntrants: eliminationEntrants,
    eliminationMatches: eliminationMatches,
    computeEliminationStandings: computeEliminationStandings,
    eliminationChampionName: eliminationChampionName,
    roundRobinComplete: roundRobinComplete,
    dependentsOf: dependentsOf,
    redecideElimination: redecideElimination,
    vacateSlot: vacateSlot,
    resultFromScores: resultFromScores,
    setMatchResult: setMatchResult,
    swissReopen: swissReopen,
    poolsReopen: poolsReopen
  };
})(typeof window !== 'undefined' ? window : globalThis);
