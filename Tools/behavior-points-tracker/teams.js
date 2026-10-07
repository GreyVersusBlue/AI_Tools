/* teams.js — team / house points for 008 Behavior & Points Tracker. A plain
   script that publishes one global, `BPTeams`, so the page can call it and a
   pure-Node suite can import it.

   Nothing here touches the page or storage. The page owns the DOM and calls
   save(); this file owns the arithmetic that has to be right, because a house
   total is read aloud to a class:

     Teams belong to a section (one `state`), and every field is OPTIONAL: a
     section that never made a team has none of them, and nothing here adds one
     until the first team is made. That is what keeps a class with no teams
     byte for byte what it was.

       teams     [{ id, name, color }]  two to eight once in use; `color` is a
                 palette id or '' and is never the only cue (the name is always
                 shown, and so is the position)
       teamOf    { studentName: teamId }
       teamBank  { teamId: points }     everything before today
       teamDay   { teamId: points }     today: student taps and direct awards
       teamLog   [{ id, team, delta, label, ts }]   today's direct awards, so
                 each can be undone
       teamSeed  the seed the last even deal used

     A tap on a student also counts for that student's team: award() adds the
     delta to teamDay and the page stamps the team id on the log entry, so that
     undoing the entry takes the same points off the same team even if the
     student has moved since. The students' own points are never read or
     written here, which is why resetting a team's total cannot touch them.

     Archiving a day moves teamDay into teamBank (house points run all term)
     and clears the direct-award log; "Undo the whole day" drops today's share
     of the teams and leaves the bank. Both are exact, with no dependence on
     the log, which the page caps at 300 entries.

     deal() is deterministic: the same names, teams and seed give the same
     teams, with no dependence on the order the names came in. */
(function (global) {
  'use strict';

  var MIN_TEAMS = 2;
  var MAX_TEAMS = 8;
  var NAME_MAX = 24;
  var DIRECT_LOG_LIMIT = 50;
  var PALETTE = ['red', 'blue', 'green', 'gold', 'purple', 'orange', 'teal', 'pink'];
  var COLOR_LABELS = {
    red: 'Red', blue: 'Blue', green: 'Green', gold: 'Gold',
    purple: 'Purple', orange: 'Orange', teal: 'Teal', pink: 'Pink'
  };

  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function ordinal(n) {
    var t = n % 100;
    if (t >= 11 && t <= 13) return n + 'th';
    var d = n % 10;
    return n + (d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th');
  }

  /** True once a section has teams worth showing a board for. */
  function active(state) {
    return !!(state && Array.isArray(state.teams) && state.teams.length >= MIN_TEAMS);
  }

  /** Cleans whatever a saved or hand-edited section holds. A section with no
      `teams` at all is left exactly as it is. */
  function normalize(state) {
    if (!state || state.teams === undefined) return state;
    var seen = {};
    var teams = [];
    (Array.isArray(state.teams) ? state.teams : []).forEach(function (t) {
      if (!t || typeof t.id !== 'string' || !t.id || seen[t.id] || teams.length >= MAX_TEAMS) return;
      seen[t.id] = true;
      var name = String(t.name === undefined || t.name === null ? '' : t.name).trim().slice(0, NAME_MAX);
      teams.push({
        id: t.id,
        name: name || 'Team ' + (teams.length + 1),
        color: PALETTE.indexOf(t.color) === -1 ? '' : t.color
      });
    });
    state.teams = teams;
    var of = {};
    if (state.teamOf && typeof state.teamOf === 'object') {
      Object.keys(state.teamOf).forEach(function (n) {
        if (typeof state.teamOf[n] === 'string' && seen[state.teamOf[n]]) of[n] = state.teamOf[n];
      });
    }
    state.teamOf = of;
    ['teamBank', 'teamDay'].forEach(function (bag) {
      var out = {};
      var src = state[bag] && typeof state[bag] === 'object' ? state[bag] : {};
      teams.forEach(function (t) { out[t.id] = isInt(src[t.id]) ? src[t.id] : 0; });
      state[bag] = out;
    });
    state.teamLog = (Array.isArray(state.teamLog) ? state.teamLog : []).filter(function (e) {
      return e && typeof e.id === 'string' && seen[e.team] && isInt(e.delta);
    }).map(function (e) {
      return { id: e.id, team: e.team, delta: e.delta, label: String(e.label || '').slice(0, 60), ts: String(e.ts || '') };
    }).slice(0, DIRECT_LOG_LIMIT);
    state.teamSeed = isInt(state.teamSeed) ? state.teamSeed : 1;
    return state;
  }

  function ensure(state) {
    if (state.teams === undefined) state.teams = [];
    normalize(state);
    return state;
  }

  function find(state, id) {
    return (state.teams || []).filter(function (t) { return t.id === id; })[0] || null;
  }

  /** The smallest 'tmN' not in use, so an id never repeats within a section. */
  function newId(state) {
    var n = 1;
    while (find(state, 'tm' + n)) n++;
    return 'tm' + n;
  }

  /** Adds a team (up to eight) and returns it, or null when full. The default
      colour is the first one no team has. */
  function addTeam(state, name) {
    ensure(state);
    if (state.teams.length >= MAX_TEAMS) return null;
    var used = {};
    state.teams.forEach(function (t) { used[t.color] = true; });
    var color = PALETTE.filter(function (c) { return !used[c]; })[0] || '';
    var t = {
      id: newId(state),
      name: (String(name || '').trim().slice(0, NAME_MAX)) || 'Team ' + (state.teams.length + 1),
      color: color
    };
    state.teams.push(t);
    state.teamBank[t.id] = 0;
    state.teamDay[t.id] = 0;
    return t;
  }

  /** Removes a team, its totals and its direct-award log, and puts its
      students back to "no team". Students' own points are untouched. */
  function removeTeam(state, id) {
    if (!state.teams || !find(state, id)) return false;
    state.teams = state.teams.filter(function (t) { return t.id !== id; });
    Object.keys(state.teamOf).forEach(function (n) { if (state.teamOf[n] === id) delete state.teamOf[n]; });
    delete state.teamBank[id];
    delete state.teamDay[id];
    state.teamLog = state.teamLog.filter(function (e) { return e.team !== id; });
    return true;
  }

  function setTeamOf(state, name, id) {
    ensure(state);
    if (!id) { delete state.teamOf[name]; return true; }
    if (!find(state, id)) return false;
    state.teamOf[name] = id;
    return true;
  }

  function totalOf(state, id) {
    if (!state.teams || !find(state, id)) return 0;
    return (state.teamBank[id] || 0) + (state.teamDay[id] || 0);
  }

  /** A student's tap, counted for their team. Returns the team id, or null
      (and changes nothing) when the student has no team. */
  function award(state, name, delta) {
    if (!state.teams || !isInt(delta)) return null;
    var id = state.teamOf && has(state.teamOf, name) ? state.teamOf[name] : null;
    if (!id || !find(state, id)) return null;
    state.teamDay[id] = (state.teamDay[id] || 0) + delta;
    return id;
  }

  /** Takes a logged tap back off the team the entry was stamped with. */
  function unaward(state, ev) {
    if (!state.teams || !ev || !ev.team || !find(state, ev.team)) return false;
    state.teamDay[ev.team] = (state.teamDay[ev.team] || 0) - ev.delta;
    return true;
  }

  /** Points given to a team directly. Returns the log entry, or null. */
  function give(state, id, delta, label, ts, logId) {
    if (!state.teams || !find(state, id) || !isInt(delta) || delta === 0) return null;
    state.teamDay[id] = (state.teamDay[id] || 0) + delta;
    var e = { id: logId, team: id, delta: delta, label: String(label || '').trim().slice(0, 60), ts: ts || '' };
    state.teamLog.unshift(e);
    if (state.teamLog.length > DIRECT_LOG_LIMIT) state.teamLog.length = DIRECT_LOG_LIMIT;
    return e;
  }

  function undoGive(state, logId) {
    if (!state.teams) return false;
    for (var i = 0; i < state.teamLog.length; i++) {
      if (state.teamLog[i].id !== logId) continue;
      var e = state.teamLog[i];
      state.teamLog.splice(i, 1);
      if (find(state, e.team)) state.teamDay[e.team] = (state.teamDay[e.team] || 0) - e.delta;
      return true;
    }
    return false;
  }

  /** End of day: today joins the bank, the direct-award log is filed away. */
  function archiveDay(state) {
    if (!state.teams) return;
    state.teams.forEach(function (t) {
      state.teamBank[t.id] = (state.teamBank[t.id] || 0) + (state.teamDay[t.id] || 0);
      state.teamDay[t.id] = 0;
    });
    state.teamLog = [];
  }

  /** "Undo the whole day": today's share of every team goes, the bank stays. */
  function clearDay(state) {
    if (!state.teams) return;
    state.teams.forEach(function (t) { state.teamDay[t.id] = 0; });
    state.teamLog = [];
  }

  /** The teacher's reset: every team to 0, bank and today. Students are not
      read or written. */
  function resetTotals(state) {
    if (!state.teams) return;
    state.teams.forEach(function (t) { state.teamBank[t.id] = 0; state.teamDay[t.id] = 0; });
    state.teamLog = [];
  }

  /** Teams best first. `rank` is a competition rank (1, 1, 3): teams with the
      same total share it. `cue` is the words for it, which the board shows
      beside the colour and the order, so no team is told apart by colour
      alone. `lead` is 'sole', 'tied' or '' (nobody leads while every total is
      the same 0, and a lone team has nothing to lead). `opts.hideNegative` ranks on the
      totals the board shows when negatives are hidden (never below 0). */
  function standings(state, opts) {
    if (!state.teams) return [];
    var hideNegative = !!(opts && opts.hideNegative);
    var rows = state.teams.map(function (t, i) {
      var total = totalOf(state, t.id);
      return { id: t.id, name: t.name, color: t.color, total: hideNegative ? Math.max(0, total) : total, order: i };
    });
    rows.sort(function (a, b) { return b.total - a.total || a.order - b.order; });
    rows.forEach(function (r, i) {
      r.rank = i && rows[i - 1].total === r.total ? rows[i - 1].rank : i + 1;
    });
    var top = rows.length ? rows[0].total : 0;
    var atTop = rows.filter(function (r) { return r.rank === 1; }).length;
    var anyBelow = rows.some(function (r) { return r.total < top; });
    rows.forEach(function (r) {
      var shared = rows.filter(function (o) { return o.rank === r.rank; }).length > 1;
      r.cue = (shared ? 'Tied for ' : '') + ordinal(r.rank);
      r.lead = '';
      if (r.rank === 1 && rows.length >= MIN_TEAMS && (top !== 0 || anyBelow)) r.lead = atTop > 1 ? 'tied' : 'sole';
    });
    return rows;
  }

  /** How many of `names` each team has, plus how many have none. */
  function counts(state, names) {
    var out = { none: 0, byTeam: {} };
    (state.teams || []).forEach(function (t) { out.byTeam[t.id] = 0; });
    names.forEach(function (n) {
      var id = state.teamOf && has(state.teamOf, n) ? state.teamOf[n] : null;
      if (id && has(out.byTeam, id)) out.byTeam[id]++; else out.none++;
    });
    return out;
  }

  /** mulberry32: a 32-bit generator small enough to read in one go. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Deals `names` across `teamIds` as evenly as it can (sizes differ by at
      most one), in an order set by `seed` alone. Returns { name: teamId }. */
  function deal(names, teamIds, seed) {
    var out = {};
    if (!teamIds.length) return out;
    var uniq = [];
    var seen = {};
    names.forEach(function (n) { if (!has(seen, n)) { seen[n] = true; uniq.push(n); } });
    uniq.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    var next = rng(isInt(seed) ? seed : 1);
    for (var i = uniq.length - 1; i > 0; i--) {
      var j = Math.floor(next() * (i + 1));
      var tmp = uniq[i]; uniq[i] = uniq[j]; uniq[j] = tmp;
    }
    uniq.forEach(function (n, k) { out[n] = teamIds[k % teamIds.length]; });
    return out;
  }

  global.BPTeams = {
    MIN_TEAMS: MIN_TEAMS,
    MAX_TEAMS: MAX_TEAMS,
    NAME_MAX: NAME_MAX,
    PALETTE: PALETTE,
    COLOR_LABELS: COLOR_LABELS,
    ordinal: ordinal,
    active: active,
    normalize: normalize,
    find: find,
    addTeam: addTeam,
    removeTeam: removeTeam,
    setTeamOf: setTeamOf,
    totalOf: totalOf,
    award: award,
    unaward: unaward,
    give: give,
    undoGive: undoGive,
    archiveDay: archiveDay,
    clearDay: clearDay,
    resetTotals: resetTotals,
    standings: standings,
    counts: counts,
    deal: deal
  };
})(typeof window !== 'undefined' ? window : globalThis);
