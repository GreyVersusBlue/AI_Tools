/* htcm-game.js — the review game's rules and state, with no DOM in it.

   The game is top-trumps played with a deck a class already built: two cards
   are drawn face down, the team on the clock sees theirs, picks a stat, both
   cards flip, and the higher value takes the point. The reason it lives in
   this toolkit at all is the beat *before* the numbers resolve — the card's
   facts are on screen with "what do you remember about this figure?" — so the
   scoring exists to make a review question worth answering, not the other way
   round.

   Two rules do the real work, and both come from the same awkward fact: a
   class-built research deck is not a printed top-trumps set, so two cards
   often have no stat in common.

   1. A round is played on a *category*. The categories on offer are the stat
      labels both cards can answer (matched case-insensitively, same kind of
      value on both sides), plus a "Top stat" wildcard whenever both cards
      carry at least one `X/Y` meter — each card fields its own best meter, so
      the question becomes "what was your figure best at?", which is exactly
      the recall the deck was built to practice.
   2. Because a pair with no category at all is unplayable, the deal doesn't
      hand one out: it takes the next card, scans forward for the first card
      that shares a category with it, and pairs those. A card that can't be
      paired is discarded (counted as drawn) rather than shuffled back, so
      "no repeats until the deck cycles" still holds exactly.

   A value is comparable if it is `X/Y` with Y > 0 (a meter — normalized to
   X/Y so 9/10 and 45/50 compare properly), or if it starts with a number
   (`8`, `1538 °C`, `-218 °C`, `1,732`). Anything else — "Underground
   Railroad", "noun" — is card text, not a stat to compete on. Plain numbers
   only ever meet each other under the same label, so their units match by
   construction.

   State is persisted whole under one key so a mid-game reload (a projector
   cable, a stray Ctrl-W) doesn't cost the scoreboard. It stores card *ids*,
   not copies of the cards: the deck is the source of truth, and a card
   deleted mid-game simply drops out of the queue. */
(function (global) {
  'use strict';

  var KEY = 'htcm:game';
  var TOP = '*top';                 // the "Top stat" wildcard category
  var MIN_CARDS = 4;                // below this a game is not worth starting
  var MIN_TEAMS = 2, MAX_TEAMS = 6;
  var METER = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/;

  /* ---------- reading stats ---------- */

  function statValue(s) {
    var raw = String(s && s.value == null ? '' : s.value).trim();
    var m = METER.exec(raw);
    if (m && parseFloat(m[2]) > 0) return { kind: 'meter', n: parseFloat(m[1]) / parseFloat(m[2]), raw: raw };
    var plain = /^-?\d+(?:\.\d+)?/.exec(raw.replace(/,/g, ''));
    if (plain) return { kind: 'number', n: parseFloat(plain[0]), raw: raw };
    return null;
  }

  /** Every stat on a card that can be competed on, in card order. */
  function comparable(card) {
    var out = [];
    var stats = (card && Array.isArray(card.stats)) ? card.stats : [];
    stats.forEach(function (s) {
      var label = String((s && s.label) || '').trim();
      if (!label) return;
      var v = statValue(s);
      if (!v) return;
      out.push({ label: label, key: label.toLowerCase(), kind: v.kind, n: v.n, raw: v.raw });
    });
    return out;
  }

  /** A card can play at all if it has at least one comparable stat. */
  function playable(card) { return comparable(card).length > 0; }

  function bestMeter(card) {
    var best = null;
    comparable(card).forEach(function (s) {
      if (s.kind === 'meter' && (!best || s.n > best.n)) best = s;
    });
    return best;
  }

  /** The categories this pair can be played on — see rule 1 in the header. */
  function categories(a, b) {
    var bKeys = {};
    comparable(b).forEach(function (s) { if (!bKeys[s.key]) bKeys[s.key] = s; });
    var seen = {}, out = [];
    comparable(a).forEach(function (s) {
      var match = bKeys[s.key];
      if (!match || match.kind !== s.kind || seen[s.key]) return;
      seen[s.key] = 1;
      out.push({ key: s.key, label: s.label, kind: s.kind });
    });
    if (bestMeter(a) && bestMeter(b)) out.push({ key: TOP, label: 'Top stat', kind: 'meter' });
    return out;
  }

  function statFor(card, key) {
    if (key === TOP) return bestMeter(card);
    var found = null;
    comparable(card).forEach(function (s) { if (!found && s.key === key) found = s; });
    return found;
  }

  /** { a, b, winner: 'a'|'b'|'tie' } for one category, or null if either card
      can't answer it. */
  function resolve(cardA, cardB, key) {
    var sa = statFor(cardA, key), sb = statFor(cardB, key);
    if (!sa || !sb) return null;
    return { a: sa, b: sb, winner: sa.n > sb.n ? 'a' : (sb.n > sa.n ? 'b' : 'tie') };
  }

  /* ---------- the game ---------- */

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function eligible(cards) {
    return (Array.isArray(cards) ? cards : []).filter(playable);
  }

  function byId(cards) {
    var map = {};
    (Array.isArray(cards) ? cards : []).forEach(function (c) { if (c && c.id) map[c.id] = c; });
    return map;
  }

  function teamA(state) { return state.turn % state.teams.length; }
  function teamB(state) { return (state.turn + 1) % state.teams.length; }

  /** Draws the next playable pair — see rule 2 in the header. Sets phase
      'done' when the deck can't produce another pair. */
  function deal(state, map) {
    while (state.queue.length >= 2) {
      var aId = state.queue.shift();
      var a = map[aId];
      if (!a) continue;                       // deleted from the deck mid-game
      var idx = -1;
      for (var i = 0; i < state.queue.length; i++) {
        var b = map[state.queue[i]];
        if (b && categories(a, b).length) { idx = i; break; }
      }
      if (idx === -1) { state.drawn.push(aId); continue; }
      var bId = state.queue.splice(idx, 1)[0];
      state.a = aId; state.b = bId;
      state.drawn.push(aId, bId);
      state.category = null; state.result = null;
      state.phase = 'draw';
      return state;
    }
    state.a = null; state.b = null;
    state.phase = 'done';
    return state;
  }

  function newGame(deckName, teamNames, cards) {
    var pool = eligible(cards);
    var state = {
      v: 1,
      deck: String(deckName || ''),
      teams: teamNames.map(function (n, i) {
        return { name: String(n || '').trim() || ('Team ' + (i + 1)), score: 0 };
      }),
      queue: shuffle(pool.map(function (c) { return c.id; })),
      drawn: [],
      round: 1, pass: 1, turn: 0,
      phase: 'draw', a: null, b: null, category: null, result: null
    };
    return deal(state, byId(pool));
  }

  /** The teacher reveals the picking team's card: the recall beat. */
  function reveal(state) {
    if (state.phase === 'draw') state.phase = 'reveal';
    return state;
  }

  /** The team picks a stat; the round resolves and the point is awarded. */
  function choose(state, map, key) {
    var r = resolve(map[state.a], map[state.b], key);
    if (!r) return state;
    state.category = key;
    state.result = {
      key: key,
      aLabel: r.a.label, aValue: r.a.raw,
      bLabel: r.b.label, bValue: r.b.raw,
      winner: r.winner
    };
    if (r.winner === 'a') state.teams[teamA(state)].score++;
    else if (r.winner === 'b') state.teams[teamB(state)].score++;
    state.phase = 'compare';
    return state;
  }

  /** On to the next pair. A tie scored nothing, so it re-draws the same round
      with the same teams on the clock rather than advancing either. */
  function next(state, map) {
    if (!(state.result && state.result.winner === 'tie')) {
      state.round++;
      state.turn++;
    }
    return deal(state, map);
  }

  /** Another pass through the same deck, scores carried over. */
  function reshuffle(state, cards) {
    var pool = eligible(cards);
    state.queue = shuffle(pool.map(function (c) { return c.id; }));
    state.drawn = [];
    state.pass++;
    return deal(state, byId(pool));
  }

  /** Teams sorted high to low, with ties sharing a place. */
  function standings(state) {
    var rows = state.teams.map(function (t, i) { return { name: t.name, score: t.score, index: i }; });
    rows.sort(function (x, y) { return y.score - x.score || x.index - y.index; });
    var place = 0, lastScore = null;
    rows.forEach(function (r, i) {
      if (r.score !== lastScore) { place = i + 1; lastScore = r.score; }
      r.place = place;
    });
    return rows;
  }

  /* ---------- persistence ---------- */

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  /** A stored game, repaired enough to trust, or null. */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    var s;
    try { s = JSON.parse(raw); } catch (e) { return null; }
    if (!s || typeof s !== 'object' || !Array.isArray(s.teams) || !s.teams.length) return null;
    if (!Array.isArray(s.queue) || !Array.isArray(s.drawn)) return null;
    s.teams = s.teams.map(function (t, i) {
      return { name: String((t && t.name) || ('Team ' + (i + 1))), score: Math.max(0, Math.round(Number(t && t.score)) || 0) };
    });
    s.round = Math.max(1, Math.round(Number(s.round)) || 1);
    s.pass = Math.max(1, Math.round(Number(s.pass)) || 1);
    s.turn = Math.max(0, Math.round(Number(s.turn)) || 0);
    if (['draw', 'reveal', 'compare', 'done'].indexOf(s.phase) === -1) s.phase = 'draw';
    return s;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
  }

  global.HtcmGame = {
    KEY: KEY, TOP: TOP, MIN_CARDS: MIN_CARDS, MIN_TEAMS: MIN_TEAMS, MAX_TEAMS: MAX_TEAMS,
    statValue: statValue,
    comparable: comparable,
    playable: playable,
    eligible: eligible,
    byId: byId,
    categories: categories,
    statFor: statFor,
    resolve: resolve,
    teamA: teamA,
    teamB: teamB,
    newGame: newGame,
    reveal: reveal,
    choose: choose,
    next: next,
    deal: deal,
    reshuffle: reshuffle,
    standings: standings,
    save: save,
    load: load,
    clear: clear
  };
})(window);
