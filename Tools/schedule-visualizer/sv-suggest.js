// sv-suggest.js — the School Layout Visualizer's suggestions: the changes to
// one group's day that would clear a finding of the schedule checks.
//
// Path 11 P5 increment 3 (BACKLOG.md, "Path 11", the P5 bullet, which has the
// design). suggestFor() takes one finding from sv-check.js's checkSchedule()
// and returns candidates: codes, ids and numbers. It never changes the
// schedule. The page's "Try in What-If" writes a candidate's `changes` as
// what-if overrides, and the lab's own "Apply Scenario to Schedule" is the one
// way a suggestion reaches the live schedule.
//
// A room in this model is also a teacher, so the moves are the ones that
// change no teacher's class list (Devon, P11-15: a suggestion never changes a
// teacher):
//   M1  swap two of the group's slots on that day: same rooms, same teachers,
//       another order;
//   M2  move the slot to another room of the same teacher, or to a room with
//       no teacher named (the Library), free that mod;
//   M3  another teacher's room in the same department, free that mod. Off
//       unless `kinds` names it, and every M3 candidate says whose class it
//       changes (`changesTeacher`). The page never asks for it.
// Nothing moves a teacher, touches two groups, adds a room or changes a size.
//
// Two stages, so the graph is touched little. Stage 1 applies each candidate
// to a copy of the groups and runs checkSchedule() (with the teacher's walk,
// without the groups' travel); a candidate after which the finding is still
// there is discarded, and the rest are ordered by the counts left, then M1
// before M2 before M3 (a swap is one move, though it changes two slots). Stage 2 takes the
// first `max` (default 5) and runs whatIfMetrics() for each day with bell
// times, through `pathCache` (a Map from "from|to" to the path's answer that
// the caller keeps for one graph), and orders them again with the groups'
// passing time counted. There is no randomness: every set here is enumerated.
// suggestionSentence() is the one English line for a candidate.
//
// Nothing here touches the DOM, `AppState` or storage. The page puts the
// module on `window.SVSuggest`. Its suite is test/suggest.test.mjs
// (npm run test:schedule-suggest).

import { checkSchedule, applyAcks, summary, sentence, daysOf } from './sv-check.js';
import { whatIfMetrics } from './sv-congestion.js';
import { resolveRoomPath } from './sv-graph.js';

export const MOVE_KINDS = ['M1', 'M2', 'M3'];
export const DEFAULT_MAX = 5;
/** Stage 2's emergency stop, in ms. */
export const STAGE2_MS = 500;

const MOVE_ORDER = { M1: 0, M2: 1, M3: 2 };
const nowMs = () => (globalThis.performance && typeof globalThis.performance.now === 'function')
  ? globalThis.performance.now() : Date.now();

/** A group's slots on a day, as the checks and the lab read them (B falls back to A). */
function dayList(g, day, modCount) {
  const raw = day === 'B'
    ? ((g.modsB && g.modsB.length > 0) ? g.modsB : (g.modsA || g.mods || []))
    : (g.modsA || g.mods || []);
  const out = [];
  for (let i = 0; i < modCount; i++) out.push(typeof raw[i] === 'string' ? raw[i].trim() : '');
  return out;
}

/** A copy of the groups with one group's day replaced, the way the lab's Apply writes it. */
function withDay(groups, groupId, day, mods) {
  return groups.map(g => {
    if (g.id !== groupId) return g;
    if (day === 'B') return { ...g, modsB: mods.slice() };
    return Array.isArray(g.mods) ? { ...g, modsA: mods.slice(), mods: mods.slice() } : { ...g, modsA: mods.slice() };
  });
}

/** resolveRoomPath through the caller's cache: a path depends on the two rooms and the graph only. */
export function cachedResolver(graph, pairs, pathCache, resolve) {
  const base = resolve || ((a, b) => resolveRoomPath(graph, a, b, pairs));
  if (!pathCache) return base;
  return (a, b) => {
    const k = (a || '') + '|' + (b || '');
    if (pathCache.has(k)) return pathCache.get(k);
    const r = base(a, b);
    pathCache.set(k, r);
    return r;
  };
}

/** The cells a finding is about: its `where`, or a teacher's taught cells that day. */
function cellsOf(finding, before) {
  if (finding.where && finding.where.length) return finding.where.filter(w => !finding.day || w.day === finding.day);
  if (finding.teacher && finding.day && before.teachers[finding.teacher]) {
    const slots = before.teachers[finding.teacher].days[finding.day] || [];
    const out = [];
    slots.forEach((here, i) => { for (const s of here) for (const g of s.groups) out.push({ groupId: g.id, day: finding.day, modIdx: i }); });
    return out;
  }
  return [];
}

/**
 * suggestFor(finding, { groups, registry, settings, acks, kinds, max, blueprint,
 *   graph, pathCache, resolve, travelDays, now }) → { candidates, tried, found, stoppedBy }.
 *
 * `finding` is one of checkSchedule()'s findings on these groups. `graph` and
 * `blueprint`, optional, give stage 2 and the teacher's walk; without them the
 * candidates are stage 1's, with `travel: false`. `travelDays` are the days
 * whose bell times are set (default: every day). `stoppedBy` is 'all' when
 * every stage-1 survivor was measured, 'max' when more were left, 'time' when
 * stage 2 ran out of its 500 ms, and 'none' when the finding is not about a
 * slot of a group (a fact about a room or a teacher's tiles: no change of a
 * group's day can clear it).
 */
export function suggestFor(finding, opts = {}) {
  const groups = opts.groups || [];
  const registry = opts.registry || [];
  const settings = opts.settings || {};
  const modCount = settings.modCount || 8;
  const kinds = new Set(Array.isArray(opts.kinds) ? opts.kinds.filter(k => MOVE_KINDS.includes(k)) : ['M1', 'M2']);
  const max = Number.isInteger(opts.max) && opts.max > 0 ? opts.max : DEFAULT_MAX;
  const now = typeof opts.now === 'function' ? opts.now : nowMs;
  const days = daysOf(groups);
  const graph = opts.graph || null;
  const blueprint = opts.blueprint || null;
  const resolve = graph ? cachedResolver(graph, blueprint && blueprint.crossFloorPairs, opts.pathCache, opts.resolve) : null;
  const walkSec = settings.tileWalkTime != null ? settings.tileWalkTime : 3;
  const stairSec = settings.staircaseTime != null ? settings.staircaseTime : 8;
  const walk = resolve ? (a, b) => {
    const r = resolve(a, b);
    if (!r || r.error) return null;
    return (r.hallwayCells || []).length * walkSec + (r.usesStaircase ? stairSec : 0);
  } : null;
  const check = (gs, travel) => {
    const r = checkSchedule(gs, { registry, settings, days, walk, travel });
    applyAcks(r.findings, opts.acks);
    r.summary = summary(r.findings);
    return r;
  };
  const before = check(groups, null);
  const empty = (stoppedBy) => ({ candidates: [], tried: 0, found: 0, stoppedBy });
  if (!finding || !finding.day) return empty('none');
  const cells = cellsOf(finding, before);
  if (!cells.length) return empty('none');

  // Who teaches in each room, and which rooms are taken in each mod of the day.
  const reg = new Map();
  for (const r of registry) if (r && typeof r.roomNumber === 'string' && !reg.has(r.roomNumber)) reg.set(r.roomNumber, r);
  const teacherOf = (rn) => { const r = reg.get(rn); return r && typeof r.teacherName === 'string' ? r.teacherName.trim() : ''; };
  const deptOf = (rn) => { const r = reg.get(rn); return (r && r.teacherDept) || ''; };
  const day = finding.day;
  const lists = new Map(groups.filter(g => g && g.id != null).map(g => [g.id, dayList(g, day, modCount)]));
  const taken = Array.from({ length: modCount }, () => new Set());
  for (const mods of lists.values()) mods.forEach((rn, i) => { if (rn) taken[i].add(rn); });
  const freeAt = (rn, i) => !taken[i].has(rn) || (reg.get(rn) && reg.get(rn).excludeFromConflict);

  // Every candidate move, once.
  const raw = [];
  const seen = new Set();
  const push = (c) => {
    const key = c.groupId + '|' + c.changes.map(x => x.modIdx + '=' + x.to).sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    raw.push(c);
  };
  for (const cell of cells) {
    const mods = lists.get(cell.groupId);
    if (!mods) continue;
    const i = cell.modIdx;
    const here = mods[i];
    if (kinds.has('M1')) {
      for (let j = 0; j < modCount; j++) {
        if (j === i || mods[j] === here) continue;
        const a = Math.min(i, j), b = Math.max(i, j);
        push({ move: 'M1', groupId: cell.groupId, day,
          changes: [{ modIdx: a, from: mods[a], to: mods[b] }, { modIdx: b, from: mods[b], to: mods[a] }] });
      }
    }
    const t = here ? teacherOf(here) : '';
    for (const rn of reg.keys()) {
      if (rn === here || !freeAt(rn, i)) continue;
      const rt = teacherOf(rn);
      if (kinds.has('M2') && ((t && rt === t) || !rt)) {
        push({ move: 'M2', groupId: cell.groupId, day, changes: [{ modIdx: i, from: here, to: rn }],
          toTeacher: rt || null, fromTeacher: t || null });
      } else if (kinds.has('M3') && rt && t && rt !== t && deptOf(here) && deptOf(rn) === deptOf(here)) {
        push({ move: 'M3', groupId: cell.groupId, day, changes: [{ modIdx: i, from: here, to: rn }],
          changesTeacher: { from: t, to: rt } });
      }
    }
  }

  // Stage 1: the checks without the groups' travel.
  const survivors = [];
  for (const c of raw) {
    const mods = lists.get(c.groupId).slice();
    for (const ch of c.changes) mods[ch.modIdx] = ch.to;
    c.groupsAfter = withDay(groups, c.groupId, day, mods);
    const after = check(c.groupsAfter, null);
    if (after.findings.some(f => f.id === finding.id)) continue;
    c.after = after.summary;
    c.afterFindings = after.findings;
    survivors.push(c);
  }
  const tried = raw.length;
  // A swap is one move though it changes two slots, so among equal counts M1
  // comes first (the design's "the reorder first among equals").
  const cmp1 = (a, b) => (a.after.error - b.after.error) || (a.after.warn - b.after.warn) ||
    (a.after.note - b.after.note) || (MOVE_ORDER[a.move] - MOVE_ORDER[b.move]);
  survivors.sort(cmp1);   // a stable sort: equals keep the order they were made in

  // Stage 2: the groups' travel, for the first `max`.
  let stoppedBy = survivors.length > max ? 'max' : 'all';
  let measured = survivors.slice(0, max);
  const tDays = (Array.isArray(opts.travelDays) ? opts.travelDays : days).filter(d => days.includes(d));
  let baseRun = before;
  if (graph && blueprint) {
    const ctx = { settings, blueprint, graph, registry, resolve };
    const baseTravel = {};
    for (const d of tDays) baseTravel[d] = whatIfMetrics(groups, d, null, ctx);
    baseRun = check(groups, baseTravel);
    const start = now();
    const done = [];
    for (const c of measured) {
      if (now() - start > STAGE2_MS) { stoppedBy = 'time'; break; }
      const travel = {};
      for (const d of tDays) travel[d] = whatIfMetrics(c.groupsAfter, d, null, ctx);
      const after = check(c.groupsAfter, travel);
      if (after.findings.some(f => f.id === finding.id)) continue;
      c.after = after.summary;
      c.afterFindings = after.findings;
      const bt = baseTravel[day], at = travel[day];
      if (bt && at) {
        c.travelDeltaSec = at.totals.travelSec - bt.totals.travelSec;
        c.delayDeltaSec = at.totals.delaySec - bt.totals.delaySec;
        const bg = bt.perGroup.find(p => p.id === c.groupId), ag = at.perGroup.find(p => p.id === c.groupId);
        c.groupTravelDeltaSec = (ag && bg) ? (ag.totalTravelSec + ag.totalDelaySec) - (bg.totalTravelSec + bg.totalDelaySec) : null;
      }
      c.travel = !!(bt && at);
      done.push(c);
    }
    measured = done;
    const cmp2 = (a, b) => (a.after.error - b.after.error) || (a.after.warn - b.after.warn) ||
      (a.after.note - b.after.note) ||
      (((a.travelDeltaSec || 0) + (a.delayDeltaSec || 0)) - ((b.travelDeltaSec || 0) + (b.delayDeltaSec || 0)));
    measured.sort(cmp2);
  } else {
    for (const c of measured) c.travel = false;
  }

  const baseIds = new Set(baseRun.findings.map(f => f.id));
  const candidates = measured.map(c => {
    const afterIds = new Set(c.afterFindings.map(f => f.id));
    const breaks = c.afterFindings.filter(f => !baseIds.has(f.id));
    const fixed = baseRun.findings.filter(f => !afterIds.has(f.id));
    const out = {
      move: c.move, groupId: c.groupId, day: c.day, changes: c.changes, target: finding.id,
      before: baseRun.summary, after: c.after,
      fixes: fixed.map(f => f.id),
      fixedFindings: fixed,
      breaks: breaks.map(f => f.id),
      brokeFindings: breaks,
      travel: c.travel,
    };
    if (c.travel) {
      out.travelDeltaSec = c.travelDeltaSec;
      out.delayDeltaSec = c.delayDeltaSec;
      out.groupTravelDeltaSec = c.groupTravelDeltaSec;
    }
    if (c.move === 'M2') { out.toTeacher = c.toTeacher; out.fromTeacher = c.fromTeacher; }
    if (c.changesTeacher) out.changesTeacher = c.changesTeacher;
    return out;
  });
  return { candidates, tried, found: survivors.length, stoppedBy };
}

/* ── Sentences ─────────────────────────────────────────────────────── */

/** "1 problem", "2 warnings", "1 problem and 2 warnings". */
function countWords(findings) {
  const e = findings.filter(f => f.severity === 'error').length, w = findings.filter(f => f.severity === 'warn').length;
  const parts = [];
  if (e) parts.push(e + (e === 1 ? ' problem' : ' problems'));
  if (w) parts.push(w + (w === 1 ? ' warning' : ' warnings'));
  return parts.join(' and ');
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
const roomName = (rn) => /^\d/.test(rn) ? 'Room ' + rn : rn;
const inRoom = (rn) => rn ? ' (' + rn + ')' : ' (nothing)';

/** The line above the list: how many changes clear the finding, or why none is offered. */
export function suggestionHeadline(result) {
  const n = result.candidates.length;
  if (result.stoppedBy === 'none') return "This is not about one group's slot, so no change to a group's day can clear it.";
  if (!n) {
    return "No change to one group's day clears this (" + result.tried + ' tried' +
      '). The tool does not offer a move that gives a group to another teacher.';
  }
  if (result.stoppedBy === 'max') return n + ' of the ' + result.found + ' changes that would clear this, fewest problems left first.';
  const head = (WORDS[n] || String(n)) + (n === 1 ? ' change would clear this.' : ' changes would clear this, fewest problems left first.');
  return result.stoppedBy === 'time' ? head + ' The search stopped early, so there may be others.' : head;
}

/**
 * The English line for a candidate. `opts.labels` is modLabels(settings),
 * `opts.groups` gives the group's name, `opts.oneDay` drops the day.
 */
export function suggestionSentence(c, opts = {}) {
  const labels = opts.labels || [];
  const mod = (i) => labels[i] || ('Mod ' + (i + 1));
  const g = (opts.groups || []).find(x => x.id === c.groupId);
  const name = g ? String(g.name).trim() : 'The group';
  const on = opts.oneDay ? '' : ' on ' + c.day + ' days';
  let what;
  if (c.move === 'M1') {
    const [a, b] = c.changes;
    what = 'Swap ' + name + "'s " + mod(a.modIdx) + inRoom(a.from) + ' and ' + mod(b.modIdx) + inRoom(b.from) + on +
      ': same rooms, same teachers, another order.';
  } else {
    const ch = c.changes[0];
    const to = roomName(ch.to);
    const head = (ch.from ? 'Move ' + name + ' from ' + ch.from + ' to ' : 'Put ' + name + ' in ') + to + ' in ' + mod(ch.modIdx) + on;
    if (c.move === 'M3') {
      what = head + ', and ' + c.changesTeacher.to + ' would teach ' + name + ' then, not ' + c.changesTeacher.from + '.';
    } else if (c.toTeacher) {
      what = head + ', ' + c.toTeacher + "'s other room.";
    } else if (c.fromTeacher) {
      what = head + ', a room with no teacher named, so ' + c.fromTeacher + ' would not have ' + name + ' then.';
    } else {
      what = head + ', a room with no teacher named.';
    }
  }
  // Notes are counted nowhere else on the page, so the sentence names only
  // problems and warnings; `fixes` and `breaks` keep every finding.
  const severe = (f) => f.severity !== 'note';
  const effects = [];
  const others = (c.fixedFindings || []).filter(f => severe(f) && f.id !== c.target);
  if (others.length) effects.push('it also clears ' + countWords(others));
  const added = (c.brokeFindings || []).filter(severe);
  if (added.length) {
    const s = sentence(added[0], { labels }).replace(/\.$/, '');
    effects.push('it adds ' + countWords(added) + (added.length === 1 ? ': ' : ', the first: ') + s);
  } else {
    effects.push('it adds no problem or warning');
  }
  if (c.travel && Number.isFinite(c.groupTravelDeltaSec) && c.groupTravelDeltaSec !== 0) {
    const s = Math.abs(c.groupTravelDeltaSec);
    const d = s % 60 === 0 ? (s / 60) + (s === 60 ? ' minute' : ' minutes')
      : s < 60 ? s + ' seconds' : Math.floor(s / 60) + (s < 120 ? ' minute ' : ' minutes ') + (s % 60) + ' seconds';
    effects.push(name + ' walks ' + d + (c.groupTravelDeltaSec < 0 ? ' less' : ' more'));
  }
  const tail = effects.join('; ');
  return what + ' ' + tail.charAt(0).toUpperCase() + tail.slice(1) + '.';
}
