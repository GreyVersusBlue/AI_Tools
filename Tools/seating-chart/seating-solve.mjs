/* ---------------------------------------------------------------------------
   Seating Chart — the constraint solver (Path 14 P3, increment 1).

   Pure: no DOM, no storage, no clock unless `opts.now` is given, no
   `Math.random` when given `seed` or `rng`. It never throws on data: a
   malformed rule is dropped and named in `dropped`.

   `assignSeats()` and `checkConstraints()` in seating.mjs stay exactly as they
   are (the sub packet, the readers' fixtures and smoke-seating.mjs call them);
   this is the second function, and the page switches to it in a later step.

   Rules: { id, kind, hard, weight, students, desks, zone, anyOf, why }.
     apart     two or more students, no two adjacent
     together  two: adjacent; three or more: a pod (connected); with `anyOf`,
               students[0] adjacent to at least one of anyOf
     zone      each student seated in a zone ('front','back','edge','notEdge',
               or the `desks` list a teacher tapped out)
     space     no occupied neighbour
     seat      one student at one desk (derived from a locked desk, never stored)
     empty     the desk stays empty (derived from desk.empty, never stored)
   `hard` rules are counted first; `weight` (1-3) is a soft rule's price.
   Score is [hard, unseated, soft], compared left to right.

   The engine returns ids and codes; the page writes the sentence.
--------------------------------------------------------------------------- */
import {
  ROOM, neighborMap, frontRowDeskIds, seatKey, seatHistoryMap, frontRowStatus, checkConstraints,
} from './seating.mjs';

/* ---------------------------------------------------------------------------
   Seeded randomness (mulberry32 from a number or an FNV-1a hashed string).
   Copied, not imported: the grouping engine has its own and the two must not
   depend on each other.
--------------------------------------------------------------------------- */
export function hashSeed(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function newSeed(rand = Math.random) { return Math.floor(rand() * 4294967296) >>> 0; }

const KINDS = ['apart', 'together', 'zone', 'seat', 'empty', 'space'];
const ZONE_NAMES = ['front', 'back', 'edge', 'notEdge'];
export const DEFAULT_PREFS = { noRepeatSeat: 2, frontRowRotation: 2, newNeighbours: 0, spreadEmpty: 0 };
export const DEFAULT_BUDGET = { passes: 40, moves: 4000 };

const str = v => (typeof v === 'string' ? v : '');
const ids = (v, ok) => {
  const out = [], seen = new Set();
  for (const x of Array.isArray(v) ? v : []) {
    if (typeof x !== 'string' || !x || seen.has(x) || (ok && !ok.has(x))) continue;
    seen.add(x); out.push(x);
  }
  return out;
};
const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

export function cleanPrefs(p) {
  const out = { ...DEFAULT_PREFS };
  if (p && typeof p === 'object') {
    for (const k of Object.keys(DEFAULT_PREFS)) {
      if (p[k] === undefined) continue;
      const n = Math.round(Number(p[k]));
      if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(3, n));
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Rules
--------------------------------------------------------------------------- */
function ruleKey(r) {
  return [r.kind, r.students.slice().sort().join(','), r.zone, r.desks.slice().sort().join(','),
    r.anyOf.slice().sort().join(',')].join('|');
}

function cleanRule(raw, index, studentSet, deskSet, dropped) {
  const id = raw && typeof raw === 'object' && str(raw.id) ? raw.id : `rule:${index}`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { dropped.push({ id, code: 'malformed' }); return null; }
  if (!KINDS.includes(raw.kind)) { dropped.push({ id, code: 'unknown-kind' }); return null; }
  const kind = raw.kind;
  const students = ids(raw.students, studentSet);
  const desks = ids(raw.desks, deskSet);
  const anyOf = ids(raw.anyOf, studentSet).filter(x => !students.includes(x));
  const zone = ZONE_NAMES.includes(raw.zone) ? raw.zone : '';
  const hadAnyOf = Array.isArray(raw.anyOf) && raw.anyOf.length > 0;
  let ok;
  if (kind === 'apart') ok = students.length >= 2;
  else if (kind === 'together') ok = hadAnyOf ? (students.length >= 1 && anyOf.length >= 1) : students.length >= 2;
  else if (kind === 'zone') ok = students.length >= 1 && (zone || desks.length >= 1);
  else if (kind === 'space') ok = students.length >= 1;
  else if (kind === 'seat') ok = students.length === 1 && desks.length === 1;
  else ok = desks.length >= 1;                                   // empty
  if (!ok) { dropped.push({ id, code: 'too-few' }); return null; }
  const w = Math.round(Number(raw.weight));
  return {
    id, kind,
    hard: raw.hard === true,
    weight: Number.isFinite(w) ? Math.max(1, Math.min(3, w)) : 2,
    students: kind === 'empty' ? [] : (kind === 'seat' ? students.slice(0, 1) : students),
    desks: kind === 'zone' && zone && !desks.length ? [] : desks,
    zone: kind === 'zone' && !desks.length ? zone : '',
    anyOf: kind === 'together' ? anyOf : [],
    why: str(raw.why).trim().slice(0, 200),
  };
}

/** The section's rules, one list: today's `apart`/`together` pairs as 2-member
    hard rules (`legacy:<kind>:<a>|<b>`), `rules` as stored, `seat` rules from
    locked desks with an occupant, `empty` rules from `desk.empty`. A rule naming
    a student or desk that is gone loses the id, and is dropped when fewer than
    its kind's minimum remain. Two hard rules that cannot both hold (a together
    over students that are also kept apart) drop the together and say so. */
export function normalizeRules(section) {
  const students = new Set((section.students || []).map(s => s.id));
  const deskSet = new Set((section.desks || []).map(d => d.id));
  const dropped = [];
  const out = [];
  const byKey = new Map();
  const usedIds = new Set();
  const push = r => {
    const k = ruleKey(r);
    const prev = byKey.get(k);
    if (prev) { prev.hard = prev.hard || r.hard; prev.weight = Math.max(prev.weight, r.weight); if (!prev.why) prev.why = r.why; return; }
    let id = r.id, n = 1;
    while (usedIds.has(id)) id = `${r.id}#${++n}`;
    r.id = id; usedIds.add(id);
    byKey.set(k, r); out.push(r);
  };

  (Array.isArray(section.rules) ? section.rules : []).forEach((raw, i) => {
    const r = cleanRule(raw, i, students, deskSet, dropped);
    if (r) push(r);
  });
  const legacy = (kind, list) => {
    for (const p of Array.isArray(list) ? list : []) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const a = str(p[0]), b = str(p[1]);
      if (!a || !b || a === b || !students.has(a) || !students.has(b)) continue;
      push({ id: `legacy:${kind}:${pairKey(a, b)}`, kind, hard: true, weight: 2, students: [a, b], desks: [], zone: '', anyOf: [], why: '' });
    }
  };
  legacy('apart', section.apart);
  legacy('together', section.together);
  for (const d of section.desks || []) {
    const sid = section.assign && section.assign[d.id];
    if (d.locked && sid && students.has(sid)) push({ id: `seat:${d.id}`, kind: 'seat', hard: true, weight: 3, students: [sid], desks: [d.id], zone: '', anyOf: [], why: '' });
    if (d.empty === true) push({ id: `empty:${d.id}`, kind: 'empty', hard: true, weight: 3, students: [], desks: [d.id], zone: '', anyOf: [], why: '' });
  }

  // contradiction: a hard together and a hard apart over two or more of the same students
  const hardApart = out.filter(r => r.kind === 'apart' && r.hard);
  const keep = [];
  for (const r of out) {
    if (r.kind === 'together' && r.hard && !r.anyOf.length) {
      const clash = hardApart.find(a => r.students.filter(s => a.students.includes(s)).length >= 2);
      if (clash) { dropped.push({ id: r.id, code: 'contradiction', by: [clash.id] }); continue; }
    }
    keep.push(r);
  }
  return { rules: keep, dropped };
}

/** The 2-member apart and together rules, as the pair lists older pages read. */
export function rulesToLegacy(rules) {
  const apart = [], together = [];
  for (const r of rules || []) {
    if (!r || r.anyOf && r.anyOf.length) continue;
    if (!r.students || r.students.length !== 2) continue;
    if (r.kind === 'apart') apart.push([r.students[0], r.students[1]]);
    else if (r.kind === 'together') together.push([r.students[0], r.students[1]]);
  }
  return { apart, together };
}

/** On load: a 2-member rule is represented by the pair lists, so the lists win
    (an older cached page that added or removed a pair is honoured, and a rule's
    hard, weight and why are kept where the pair still matches). Rules of any
    other kind or size live only in `rules`. */
export function absorbLegacy(section) {
  const students = new Set((section.students || []).map(s => s.id));
  const stored = Array.isArray(section.rules) ? section.rules : [];
  const isPair = r => r && (r.kind === 'apart' || r.kind === 'together') && Array.isArray(r.students)
    && r.students.length === 2 && !(Array.isArray(r.anyOf) && r.anyOf.length);
  const inLists = new Map();
  const note = (kind, list) => {
    for (const p of Array.isArray(list) ? list : []) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const a = str(p[0]), b = str(p[1]);
      if (!a || !b || a === b || !students.has(a) || !students.has(b)) continue;
      inLists.set(kind + ':' + pairKey(a, b), [a, b]);
    }
  };
  note('apart', section.apart); note('together', section.together);
  const kept = [], matched = new Set();
  for (const r of stored) {
    if (!isPair(r)) { kept.push(r); continue; }
    const k = r.kind + ':' + pairKey(r.students[0], r.students[1]);
    if (!inLists.has(k)) continue;                                // an older page removed it
    matched.add(k); kept.push(r);
  }
  // pairs in the lists with no rule: a plain Must (normalizeRules derives it), nothing stored
  const rules = kept;
  return { ...section, rules };
}

/* ---------------------------------------------------------------------------
   Zones (geometry only; the room layer adds named zones here and nothing else changes)
--------------------------------------------------------------------------- */
export function zones(desks, nbrs) {
  const list = desks || [];
  const front = new Set(frontRowDeskIds(list));
  const back = new Set();
  if (list.length) {
    const maxY = Math.max(...list.map(d => Number(d.y) || 0));
    for (const d of list) if ((Number(d.y) || 0) >= maxY - ROOM.deskH * 0.6) back.add(d.id);
  }
  const edge = new Set(), notEdge = new Set();
  if (list.length) {
    const deg = list.map(d => (nbrs[d.id] || []).length).sort((a, b) => a - b);
    const median = deg[Math.floor(deg.length / 2)];
    for (const d of list) ((nbrs[d.id] || []).length < median ? edge : notEdge).add(d.id);
  }
  return { front, back, edge, notEdge };
}

/* ---------------------------------------------------------------------------
   Context: everything solve() works out once, exported so the page can score a
   chart a teacher dragged into shape with the same function.
--------------------------------------------------------------------------- */
export function makeContext(section, opts = {}) {
  const desks = section.desks || [];
  const nbrs = opts.nbrs || neighborMap(desks);
  const absent = new Set(Array.isArray(opts.absent) ? opts.absent : []);
  const present = (section.students || []).map(s => s.id).filter(id => !absent.has(id));
  const presentSet = new Set(present);
  const norm = normalizeRules(section);
  const zs = zones(desks, nbrs);
  const nset = {};
  for (const d of desks) nset[d.id] = new Set(nbrs[d.id] || []);

  // absent students are left out of every rule for this solve
  let rules = [];
  for (const r of norm.rules) {
    const s = r.students.filter(x => presentSet.has(x));
    const a = r.anyOf.filter(x => presentSet.has(x));
    if (r.kind === 'seat' && !s.length) continue;
    if (r.kind === 'apart' && s.length < 2) continue;
    if (r.kind === 'together') { if (r.anyOf.length ? (!s.length || !a.length) : s.length < 2) continue; }
    if ((r.kind === 'zone' || r.kind === 'space') && !s.length) continue;
    rules.push({ ...r, students: s, anyOf: a });
  }
  if (opts.keepAll) {
    const pinned = new Set(rules.filter(r => r.kind === 'seat' && r.hard).map(r => r.students[0]));
    for (const [did, sid] of Object.entries(section.assign || {})) {
      if (!presentSet.has(sid) || pinned.has(sid) || !nset[did]) continue;
      rules.push({ id: `keep:${sid}`, kind: 'seat', hard: false, weight: 3, students: [sid], desks: [did], zone: '', anyOf: [], why: '' });
    }
  }

  const zoneSet = {};
  for (const r of rules) if (r.kind === 'zone') zoneSet[r.id] = r.desks.length ? new Set(r.desks) : zs[r.zone] || new Set();
  const byStudent = {};
  for (const r of rules) for (const s of r.students.concat(r.anyOf)) (byStudent[s] = byStudent[s] || []).push(r);
  const emptyDesks = new Set();
  for (const r of rules) if (r.kind === 'empty' && r.hard) for (const d of r.desks) emptyDesks.add(d);

  const prefs = cleanPrefs({ ...(section.prefs || {}), ...(opts.prefs || {}) });
  const history = Array.isArray(section.history) ? section.history : [];
  const quarter = str(opts.quarter);
  const deskById = {};
  for (const d of desks) deskById[d.id] = d;
  const repeatMap = history.length && prefs.noRepeatSeat ? seatHistoryMap(history) : {};
  const frontSet = zs.front;
  const dueSet = quarter && history.length && prefs.frontRowRotation
    ? new Set([...frontRowStatus({ ...section, history }, quarter).dueIds].filter(x => presentSet.has(x))) : new Set();
  const nbrHist = new Set();
  if (history.length && prefs.newNeighbours) {
    for (const h of history) {
      const hn = neighborMap(h.desks || []);
      for (const [did, sid] of Object.entries(h.assign || {})) {
        for (const n of hn[did] || []) { const o = h.assign[n]; if (o && o !== sid) nbrHist.add(pairKey(sid, o)); }
      }
    }
  }
  const hasSpace = rules.some(r => r.kind === 'space');
  return {
    rules, dropped: norm.dropped, nbrs, nset, zs, zoneSet, byStudent, emptyDesks, prefs, repeatMap,
    frontSet, dueSet, nbrHist, quarter, deskById, desks, present, presentSet, hasSpace,
    quick: !hasSpace && !prefs.newNeighbours,
  };
}

/* ---------------------------------------------------------------------------
   Scoring
--------------------------------------------------------------------------- */
const adjacent = (ctx, a, b) => a !== b && ctx.nset[a] !== undefined && ctx.nset[a].has(b);

/** How many times one rule is broken in this arrangement (0 = kept). `partial`
    ignores whoever is not seated yet (the construct phase); `who` collects the
    students involved when asked. */
function ruleBreaks(ctx, r, deskOf, occ, partial, who) {
  switch (r.kind) {
    case 'apart': {
      const seated = r.students.filter(s => deskOf[s]);
      let n = 0;
      for (let i = 0; i < seated.length; i++) for (let j = i + 1; j < seated.length; j++) {
        if (adjacent(ctx, deskOf[seated[i]], deskOf[seated[j]])) { n++; if (who) who.push(seated[i], seated[j]); }
      }
      return n;
    }
    case 'together': {
      if (r.anyOf.length) {
        const a = r.students[0];
        if (!deskOf[a]) { if (partial) return 0; if (who) who.push(a); return 1; }
        const seatedAny = r.anyOf.filter(s => deskOf[s]);
        if (partial && !seatedAny.length) return 0;
        if (seatedAny.some(s => adjacent(ctx, deskOf[a], deskOf[s]))) return 0;
        if (who) who.push(a);
        return 1;
      }
      const seated = r.students.filter(s => deskOf[s]);
      if (!partial && seated.length < r.students.length) { if (who) who.push(...r.students); return 1; }
      if (seated.length < 2) return 0;
      if (partial) {
        let n = 0;
        for (const s of seated) if (!seated.some(o => adjacent(ctx, deskOf[s], deskOf[o]))) { n++; }
        return n;
      }
      // connected components over adjacency
      const seen = new Set();
      let comps = 0;
      for (const s of seated) {
        if (seen.has(s)) continue;
        comps++;
        const stack = [s]; seen.add(s);
        while (stack.length) {
          const c = stack.pop();
          for (const o of seated) if (!seen.has(o) && adjacent(ctx, deskOf[c], deskOf[o])) { seen.add(o); stack.push(o); }
        }
      }
      if (comps > 1 && who) who.push(...r.students);
      return comps - 1;
    }
    case 'zone': {
      const set = ctx.zoneSet[r.id];
      let n = 0;
      for (const s of r.students) {
        const d = deskOf[s];
        if (!d) { if (!partial) { n++; if (who) who.push(s); } continue; }
        if (!set.has(d)) { n++; if (who) who.push(s); }
      }
      return n;
    }
    case 'space': {
      let n = 0;
      for (const s of r.students) {
        const d = deskOf[s];
        if (!d) continue;
        for (const nb of ctx.nbrs[d] || []) if (occ[nb]) { n++; if (who) who.push(s); break; }
      }
      return n;
    }
    case 'seat': {
      const s = r.students[0], d = deskOf[s];
      if (!d) { if (partial) return 0; if (who) who.push(s); return 1; }
      if (d !== r.desks[0]) { if (who) who.push(s); return 1; }
      return 0;
    }
    default: {                                                      // empty
      let n = 0;
      for (const d of r.desks) if (occ[d]) { n++; if (who) who.push(occ[d]); }
      return n;
    }
  }
}

/** The soft cost of one student's seat under the four preferences. */
function prefCost(ctx, sid, deskOf, occ) {
  const d = deskOf[sid];
  const p = ctx.prefs;
  let c = 0;
  if (p.noRepeatSeat && d) {
    const had = ctx.repeatMap[sid];
    if (had && had.has(seatKey(ctx.deskById[d]))) c += p.noRepeatSeat;
  }
  if (p.frontRowRotation && ctx.dueSet.has(sid) && !(d && ctx.frontSet.has(d))) c += p.frontRowRotation;
  if (p.newNeighbours && d && ctx.nbrHist.size) {
    for (const nb of ctx.nbrs[d] || []) { const o = occ[nb]; if (o && ctx.nbrHist.has(pairKey(sid, o))) c += p.newNeighbours / 2; }
  }
  return c;
}

function spreadCost(ctx, occ) {
  if (!ctx.prefs.spreadEmpty) return 0;
  let c = 0;
  for (const d of ctx.desks) {
    if (occ[d.id] || ctx.emptyDesks.has(d.id)) continue;
    for (const n of ctx.nbrs[d.id]) if (n > d.id && !occ[n] && !ctx.emptyDesks.has(n)) c++;
  }
  return c * ctx.prefs.spreadEmpty;
}

function mapsOf(assign) {
  const deskOf = {}, occ = {};
  for (const [d, s] of Object.entries(assign || {})) { if (s) { deskOf[s] = d; occ[d] = s; } }
  return { deskOf, occ };
}

/** Full score of an arrangement. `detail` lists every broken rule (and pref). */
function scoreMaps(ctx, deskOf, occ, detail) {
  let hard = 0, soft = 0;
  const broken = detail ? [] : null;
  for (const r of ctx.rules) {
    const who = detail ? [] : null;
    const n = ruleBreaks(ctx, r, deskOf, occ, false, who);
    if (!n) continue;
    if (r.hard) hard++; else soft += r.weight * n;
    if (detail) broken.push({ ruleId: r.id, kind: r.kind, hard: r.hard, students: [...new Set(who)], desks: r.desks.length ? r.desks.slice() : [...new Set(who)].map(s => deskOf[s]).filter(Boolean), weight: r.weight, cost: n });
  }
  for (const sid of ctx.present) {
    const c = prefCost(ctx, sid, deskOf, occ);
    if (!c) continue;
    soft += c;
    if (detail) broken.push({ ruleId: 'pref', kind: 'pref', hard: false, students: [sid], desks: deskOf[sid] ? [deskOf[sid]] : [], weight: c, cost: 1 });
  }
  const sp = spreadCost(ctx, occ);
  if (sp) {
    soft += sp;
    if (detail) {
      // the students beside a cluster of empty desks are the ones who can break it up
      const near = new Set();
      for (const d of ctx.desks) {
        if (occ[d.id] || ctx.emptyDesks.has(d.id)) continue;
        for (const n of ctx.nbrs[d.id]) if (occ[n]) near.add(occ[n]);
      }
      broken.push({ ruleId: 'pref:spreadEmpty', kind: 'pref', hard: false, students: [...near], desks: [], weight: ctx.prefs.spreadEmpty, cost: sp / ctx.prefs.spreadEmpty });
    }
  }
  let unseated = 0;
  for (const s of ctx.present) if (!deskOf[s]) unseated++;
  return { hard, unseated, soft, broken, key: hard * 1e6 + soft };
}

/** score(section, assign, ctx) → { hard, unseated, soft, broken, list }. The
    list [hard, unseated, soft] is compared left to right. */
export function score(section, assign, ctx = makeContext(section)) {
  const { deskOf, occ } = mapsOf(assign);
  const sc = scoreMaps(ctx, deskOf, occ, true);
  return { hard: sc.hard, unseated: sc.unseated, soft: sc.soft, broken: sc.broken, list: [sc.hard, sc.unseated, sc.soft] };
}

/** The cost of the rules and preferences that placing `sids` touches (construct phase). */
function localKey(ctx, sids, deskOf, occ, stamp) {
  let hard = 0, soft = 0;
  const seen = stamp;
  seen.clear();
  const todo = new Set(sids);
  if (ctx.hasSpace) for (const s of sids) { const d = deskOf[s]; if (d) for (const nb of ctx.nbrs[d] || []) if (occ[nb]) todo.add(occ[nb]); }
  for (const s of todo) {
    for (const r of ctx.byStudent[s] || []) {
      if (seen.has(r)) continue;
      seen.add(r);
      const n = ruleBreaks(ctx, r, deskOf, occ, true, null);
      if (n) { if (r.hard) hard++; else soft += r.weight * n; }
    }
  }
  for (const s of sids) soft += prefCost(ctx, s, deskOf, occ);
  return hard * 1e6 + soft;
}

/* ---------------------------------------------------------------------------
   Feasibility: named before the search; greedy bounds can miss an impossibility
   and never invent one.
--------------------------------------------------------------------------- */
function cliqueCover(deskList, nbrs) {
  const inSet = new Set(deskList);
  const done = new Set();
  let count = 0;
  for (const d of deskList) {
    if (done.has(d)) continue;
    const clique = [d]; done.add(d); count++;
    for (const o of deskList) {
      if (done.has(o) || !inSet.has(o)) continue;
      if (clique.every(c => (nbrs[c] || []).includes(o))) { clique.push(o); done.add(o); }
    }
  }
  return count;
}

function largestCluster(deskList, nbrs) {
  const inSet = new Set(deskList), seen = new Set();
  let best = 0;
  for (const d of deskList) {
    if (seen.has(d)) continue;
    let size = 0; const stack = [d]; seen.add(d);
    while (stack.length) { const c = stack.pop(); size++; for (const n of nbrs[c] || []) if (inSet.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); } }
    best = Math.max(best, size);
  }
  return best;
}

export function feasibility(section, rules, nbrs = neighborMap(section.desks || []), present) {
  const impossible = [];
  rules = (rules || []).map(r => ({ desks: [], anyOf: [], students: [], zone: '', ...r }));
  const desks = section.desks || [];
  const pres = new Set(present || (section.students || []).map(s => s.id));
  const emptyD = new Set();
  for (const r of rules) if (r.kind === 'empty' && r.hard) for (const d of r.desks) emptyD.add(d);
  const usable = desks.filter(d => !emptyD.has(d.id)).map(d => d.id);
  const zs = zones(desks, nbrs);

  if (pres.size > usable.length) impossible.push({ ruleIds: [], code: 'no-room', students: [], desks: [], count: pres.size - usable.length });

  const seatBy = {};
  for (const r of rules) if (r.kind === 'seat' && r.hard) (seatBy[r.students[0]] = seatBy[r.students[0]] || []).push(r);
  for (const [sid, list] of Object.entries(seatBy)) {
    if (new Set(list.map(r => r.desks[0])).size > 1) impossible.push({ ruleIds: list.map(r => r.id), code: 'seat-twice', students: [sid], desks: list.map(r => r.desks[0]) });
  }

  const hardApart = rules.filter(r => r.kind === 'apart' && r.hard);
  for (const t of rules) {
    if (t.kind !== 'together' || !t.hard || t.anyOf.length) continue;
    for (const a of hardApart) {
      if (t.students.filter(s => a.students.includes(s)).length >= 2) impossible.push({ ruleIds: [t.id, a.id], code: 'contradiction', students: t.students.filter(s => a.students.includes(s)), desks: [] });
    }
  }

  const cluster = largestCluster(usable, nbrs);
  for (const t of rules) {
    if (t.kind === 'together' && t.hard && !t.anyOf.length && t.students.length > cluster) {
      impossible.push({ ruleIds: [t.id], code: 'together-too-big', students: t.students.slice(), desks: [] });
    }
  }

  const cover = cliqueCover(usable, nbrs);
  for (const a of hardApart) if (a.students.length > cover) impossible.push({ ruleIds: [a.id], code: 'apart-clique', students: a.students.slice(), desks: [] });
  const spaceRules = rules.filter(r => r.kind === 'space' && r.hard);
  const spaceStudents = [...new Set(spaceRules.flatMap(r => r.students))];
  if (spaceStudents.length > cover) impossible.push({ ruleIds: spaceRules.map(r => r.id), code: 'space-too-many', students: spaceStudents, desks: [] });

  const pinnedTo = {};
  for (const r of rules) if (r.kind === 'seat' && r.hard) pinnedTo[r.desks[0]] = r.students[0];
  const groups = new Map();
  for (const r of rules) {
    if (r.kind !== 'zone' || !r.hard) continue;
    const set = r.desks.length ? new Set(r.desks) : zs[r.zone] || new Set();
    const key = [...set].sort().join(',');
    if (!groups.has(key)) groups.set(key, { set, rules: [], students: new Set() });
    const g = groups.get(key); g.rules.push(r.id); r.students.forEach(s => g.students.add(s));
  }
  for (const g of groups.values()) {
    let avail = 0;
    for (const d of g.set) {
      if (emptyD.has(d)) continue;
      if (pinnedTo[d] && !g.students.has(pinnedTo[d])) continue;
      avail++;
    }
    if (g.students.size > avail) impossible.push({ ruleIds: g.rules, code: 'zone-full', students: [...g.students], desks: [...g.set] });
  }
  return { impossible };
}

/* ---------------------------------------------------------------------------
   The search
--------------------------------------------------------------------------- */
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function blocksOf(ctx, pool) {
  const parent = {};
  for (const s of pool) parent[s] = s;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const r of ctx.rules) {
    if (r.kind !== 'together') continue;
    const m = r.students.concat(r.anyOf).filter(s => parent[s] !== undefined);
    for (let i = 1; i < m.length; i++) parent[find(m[i])] = find(m[0]);
  }
  const g = {};
  for (const s of pool) (g[find(s)] = g[find(s)] || []).push(s);
  return Object.values(g);
}

function priorityOf(ctx, sid) {
  let p = 0;
  for (const r of ctx.byStudent[sid] || []) {
    if (!r.hard) continue;
    if (r.kind === 'zone') p = Math.max(p, 100 / Math.max(1, ctx.zoneSet[r.id].size));
    else if (r.kind === 'together') p = Math.max(p, r.students.length + r.anyOf.length);
    else if (r.kind === 'space') p = Math.max(p, 3);
    else p = Math.max(p, 1);
  }
  return p;
}

function construct(ctx, seed, free0, pool, rand, stamp) {
  const deskOf = { ...seed.deskOf }, occ = { ...seed.occ };
  const free = free0.slice();
  const blocks = blocksOf(ctx, pool).map(b => ({ b: shuffle(b, rand), p: Math.max(...b.map(s => priorityOf(ctx, s))) + b.length * 0.01 }));
  const order = blocks.map(x => ({ ...x, j: rand() })).sort((x, y) => (y.p - x.p) || (x.j - y.j)).flatMap(x => x.b);
  const unseated = [];
  for (const sid of order) {
    if (!free.length) { unseated.push(sid); continue; }
    let pickIdx;
    const plain = ctx.quick && !(ctx.byStudent[sid] || []).length
      && !(ctx.repeatMap[sid] && ctx.repeatMap[sid].size) && !ctx.dueSet.has(sid);
    if (plain) pickIdx = Math.floor(rand() * free.length);
    else {
      let bestKey = Infinity, ties = [];
      for (let i = 0; i < free.length; i++) {
        deskOf[sid] = free[i]; occ[free[i]] = sid;
        const k = localKey(ctx, [sid], deskOf, occ, stamp);
        delete deskOf[sid]; delete occ[free[i]];
        if (k < bestKey) { bestKey = k; ties = [i]; } else if (k === bestKey) ties.push(i);
      }
      pickIdx = ties[Math.floor(rand() * ties.length)];
    }
    const did = free[pickIdx];
    free.splice(pickIdx, 1);
    deskOf[sid] = did; occ[did] = sid;
  }
  return { deskOf, occ, unseated };
}

function improve(ctx, st, pinned, rand, budget, stats, expired) {
  const tabu = new Set();
  let sideways = 0, cur = scoreMaps(ctx, st.deskOf, st.occ, false).key;
  const allDesks = ctx.desks.map(d => d.id);
  while (stats.moves < budget.moves) {
    if (expired()) { stats.timedOut = true; break; }
    const sc = scoreMaps(ctx, st.deskOf, st.occ, true);
    const todo = sc.broken.filter(b => b.ruleId !== 'pref' && b.ruleId !== 'pref:spreadEmpty' && !tabu.has(b.ruleId));
    const prefs = sc.broken.filter(b => b.kind === 'pref');
    const pool = todo.length ? todo : (sc.hard === 0 ? prefs : []);
    if (!pool.length) break;
    pool.sort((x, y) => (Number(y.hard) - Number(x.hard)) || (y.weight * y.cost - x.weight * x.cost));
    const top = pool.filter(b => b.hard === pool[0].hard && b.weight * b.cost === pool[0].weight * pool[0].cost);
    const target = top[Math.floor(rand() * top.length)];
    const movers = shuffle(target.students.filter(s => st.deskOf[s] && !pinned.has(st.deskOf[s])), rand);
    let best = null, bestKey = Infinity, nTies = 0;
    outer:
    for (const s of movers) {
      const from = st.deskOf[s];
      for (const d of allDesks) {
        if (d === from || pinned.has(d)) continue;
        if (stats.moves >= budget.moves) break outer;
        const other = st.occ[d];
        // try: move (d free) or swap (d taken)
        st.deskOf[s] = d; st.occ[d] = s;
        if (other) { st.deskOf[other] = from; st.occ[from] = other; } else delete st.occ[from];
        const k = scoreMaps(ctx, st.deskOf, st.occ, false).key;
        stats.moves++;
        st.deskOf[s] = from; st.occ[from] = s;
        if (other) { st.deskOf[other] = d; st.occ[d] = other; } else delete st.occ[d];
        if (k < bestKey) { bestKey = k; best = { s, d, other, from }; nTies = 1; }
        else if (k === bestKey && best) { nTies++; if (rand() * nTies < 1) best = { s, d, other, from }; }
      }
    }
    const apply = () => {
      const { s, d, other, from } = best;
      st.deskOf[s] = d; st.occ[d] = s;
      if (other) { st.deskOf[other] = from; st.occ[from] = other; } else delete st.occ[from];
    };
    if (best && bestKey < cur) { apply(); cur = bestKey; sideways = 0; stats.improved++; }
    else if (best && bestKey === cur && sideways < 2) { apply(); sideways++; }
    else { tabu.add(target.ruleId); sideways = 0; }
  }
}

/** solve(section, opts) → { assign, unseated, forced: false, seed, score, broken,
    blame, impossible, dropped, stats, moved, apartOK, togetherOK, apartBroken, togetherBroken }.
    opts: { seed | rng, quarter, prefs, keep: 'locked' | 'all', absent, budget, timeLimitMs, now }.
    The budget is counted, not timed, so a seed gives the same chart on every
    machine; `timeLimitMs` is an emergency stop only. */
export function solve(section, opts = {}) {
  const now = typeof opts.now === 'function' ? opts.now : Date.now;
  const t0 = now();
  const budget = { ...DEFAULT_BUDGET, ...(opts.budget || {}) };
  const limit = Number.isFinite(opts.timeLimitMs) ? opts.timeLimitMs : 2000;
  let seed = null, rand;
  if (opts.seed !== undefined && opts.seed !== null) { seed = opts.seed; rand = rng(seed); }
  else if (typeof opts.rng === 'function') rand = opts.rng;
  else { seed = newSeed(); rand = rng(seed); }

  const keepAll = opts.keep === 'all';
  const ctx = makeContext(section, { absent: opts.absent, quarter: opts.quarter, prefs: opts.prefs, keepAll });
  const feas = feasibility(section, ctx.rules, ctx.nbrs, ctx.present);
  const stats = { passes: 0, moves: 0, improved: 0, ms: 0, stoppedBy: 'budget', timedOut: false };

  // seeds: pinned occupants, and under keep:'all' every seated student where they are
  const seed0 = { deskOf: {}, occ: {} };
  const pinned = new Set();
  for (const r of ctx.rules) {
    if (r.kind === 'seat' && r.hard && !seed0.deskOf[r.students[0]] && !seed0.occ[r.desks[0]]) {
      seed0.deskOf[r.students[0]] = r.desks[0]; seed0.occ[r.desks[0]] = r.students[0]; pinned.add(r.desks[0]);
    }
  }
  if (keepAll) {
    for (const [did, sid] of Object.entries(section.assign || {})) {
      if (!ctx.presentSet.has(sid) || seed0.deskOf[sid] || seed0.occ[did] || !ctx.nset[did] || ctx.emptyDesks.has(did)) continue;
      seed0.deskOf[sid] = did; seed0.occ[did] = sid;
    }
  }
  const free0 = ctx.desks.map(d => d.id).filter(d => !seed0.occ[d] && !ctx.emptyDesks.has(d));
  const pool = ctx.present.filter(s => !seed0.deskOf[s]);
  const expired = () => now() - t0 >= limit;
  const stamp = new Set();

  let best = null;
  for (let pass = 0; pass < budget.passes; pass++) {
    const st = construct(ctx, seed0, free0, pool, rand, stamp);
    improve(ctx, st, pinned, rand, budget, stats, expired);
    stats.passes++;
    const sc = scoreMaps(ctx, st.deskOf, st.occ, false);
    const unseated = ctx.present.filter(s => !st.deskOf[s]).length;
    const key = sc.key + unseated * 1e3;
    if (!best || key < best.key) best = { deskOf: { ...st.deskOf }, occ: { ...st.occ }, key, hard: sc.hard };
    if (best.hard === 0) { stats.stoppedBy = 'clean'; break; }
    if (stats.timedOut || expired()) { stats.stoppedBy = 'time'; break; }
    if (stats.moves >= budget.moves) { stats.stoppedBy = 'budget'; break; }
  }
  if (!best) best = { deskOf: { ...seed0.deskOf }, occ: { ...seed0.occ }, key: 0, hard: 0 };
  if (best.hard > 0 && stats.stoppedBy === 'budget' && feas.impossible.length) stats.stoppedBy = 'impossible';

  const assign = { ...best.occ };
  const final = scoreMaps(ctx, best.deskOf, best.occ, true);
  const unseated = ctx.present.filter(s => !best.deskOf[s]);
  const result = {
    assign, unseated, forced: false, seed,
    score: [final.hard, unseated.length, final.soft],
    broken: final.broken,
    impossible: feas.impossible,
    dropped: ctx.dropped,
    stats,
    moved: keepAll ? Object.entries(section.assign || {}).filter(([d, s]) => ctx.presentSet.has(s) && best.deskOf[s] && best.deskOf[s] !== d).map(([, s]) => s) : [],
  };
  result.blame = blame(section, result, ctx);
  const report = checkConstraints({ ...section, assign }, ctx.nbrs);
  Object.assign(result, { apartOK: report.apartOK, togetherOK: report.togetherOK, apartBroken: report.apartBroken, togetherBroken: report.togetherBroken });
  stats.ms = now() - t0;
  return result;
}

/** blame(section, result, ctx) → one entry per broken hard rule:
    { ruleId, cause, by, desks, students }, cause 'impossible' (feasibility named
    it), 'held' (every desk that would mend it is held by a pinned seat, an empty,
    or a student whose own hard rule the swap would break) or 'budget' (a move
    that mends it without a net loss exists and the search ran out). One bounded
    probe per broken rule; no re-solve. */
export function blame(section, result, ctx = makeContext(section)) {
  const { deskOf, occ } = mapsOf(result.assign);
  const base = scoreMaps(ctx, deskOf, occ, true);
  const heldDesks = {};
  for (const r of ctx.rules) {
    if (r.kind === 'seat' && r.hard) heldDesks[r.desks[0]] = r.id;
    if (r.kind === 'empty' && r.hard) for (const d of r.desks) heldDesks[d] = r.id;
  }
  const out = [];
  for (const b of base.broken) {
    if (!b.hard) continue;
    const imp = (result.impossible || []).find(e => e.ruleIds.includes(b.ruleId));
    if (imp) { out.push({ ruleId: b.ruleId, cause: 'impossible', code: imp.code, by: imp.ruleIds.filter(x => x !== b.ruleId), desks: imp.desks.slice(), students: b.students.slice() }); continue; }
    const rule = ctx.rules.find(r => r.id === b.ruleId);
    const by = new Set(), tried = new Set();
    let canMend = false;
    for (const s of b.students) {
      const from = deskOf[s];
      if (!from || heldDesks[from]) { if (from && heldDesks[from]) by.add(heldDesks[from]); continue; }
      for (const d of ctx.desks.map(x => x.id)) {
        if (d === from) continue;
        if (heldDesks[d]) { by.add(heldDesks[d]); tried.add(d); continue; }
        const other = occ[d];
        const dO = { ...deskOf }, oO = { ...occ };
        dO[s] = d; oO[d] = s;
        if (other) { dO[other] = from; oO[from] = other; } else delete oO[from];
        if (ruleBreaks(ctx, rule, dO, oO, false, null)) continue;
        tried.add(d);
        const after = scoreMaps(ctx, dO, oO, true);
        if (after.hard < base.hard) { canMend = true; continue; }
        const was = new Set(base.broken.filter(x => x.hard).map(x => x.ruleId));
        for (const x of after.broken) if (x.hard && !was.has(x.ruleId)) by.add(x.ruleId);
      }
    }
    out.push({ ruleId: b.ruleId, cause: canMend ? 'budget' : 'held', by: [...by], desks: [...tried], students: b.students.slice() });
  }
  return out;
}
