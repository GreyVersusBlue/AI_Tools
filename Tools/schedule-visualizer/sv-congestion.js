// sv-congestion.js — the School Layout Visualizer's congestion arithmetic:
// the visualize tab's congestion and hotspot data, the playback panel's
// travel and delay times, and the what-if lab's baseline-versus-scenario
// metrics and diff.
//
// Path 11 P2 increment 5 (BACKLOG.md, "Path 11", the P2 bullet). Moved from
// 035's classic script with their rules unchanged; what they read from
// AppState is now an argument. The renderers that paint these numbers stay on
// the page, and so does cellCongestionLabel (it reads the room registry and
// the active floor), which congestionData takes as its `cellLabel` argument.
// The page keeps one wrapper per old name in its BRIDGE section
// (window.wiComputeMetrics and window.wiComputeDiff stay where they were) and
// puts this module on window.SVCongestion. Nothing here touches the DOM,
// AppState or storage.
//
// Its suite is test/congestion.test.mjs (npm run test:schedule-visualizer-congestion).

import { modLabels, groupWeight, anyGroupSized, congestionDelayMult, validateBlueprint, migrateBlueprint, floorsFromData, roomRegistryOf } from './sv-model.js';
import { floorCellKey, parseKey, resolveRoomPath } from './sv-graph.js';
import { isCellHeatExcluded } from './sv-routes.js';

/** The default group size the R59 weighting divides by: the setting if it is
 *  a positive number, else 25. */
function defaultSize(settings) {
  return (Number.isFinite(settings.defaultGroupSize) && settings.defaultGroupSize > 0)
    ? settings.defaultGroupSize : 25;
}

/**
 * congestionData(entries, transFilt, { settings, groups, blueprint, cellLabel })
 *
 * Computes congestion, contributors, maxCongestion and hotspots from the
 * already-cached rawSegments on each entry. Called both from buildVizRenderData
 * (initial render) and from the transition-filter change handler (filter change
 * only — no A* re-run needed).
 *
 * transFilt: null = all mods, integer N = only seg.fromMod === N.
 * cellLabel(x, y, floorId) → { label, sub } names a hotspot.
 */
export function congestionData(entries, transFilt, { settings, groups, blueprint, cellLabel }) {
  const colorByName = new Map();
  for (const e of entries) colorByName.set(e.name, e.color || '#3b82f6');

  const congestion  = new Map();   // "floorId:x,y" -> student-weighted load (R59)
  const contributors = new Map();  // "floorId:x,y" -> Map(groupName -> segment count)

  // R59: loads are weighted by group headcount (groupWeight). With every size
  // blank this is a uniform ×defaultGroupSize scaling of the R58 counts, so
  // relative heat and hotspot ordering are unchanged. Display sites divide by
  // defaultGroupSize to recover exact group counts when no group has a size.
  const dgs = defaultSize(settings);
  const weighted = anyGroupSized(groups || []);

  for (const e of entries) {
    const w = groupWeight(e.group || groups.find(g => g.name === e.name), settings);
    const segs = e.rawSegments || [];
    for (const seg of segs) {
      if (seg.error || seg.noTravel || !seg.hallwayCells || !seg.hallwayCells.length) continue;
      // Respect the active transition filter — skip non-matching segments.
      if (transFilt !== null && seg.fromMod !== transFilt) continue;

      const seenThisSeg = new Set();
      for (const cell of seg.hallwayCells) {
        if (isCellHeatExcluded(blueprint, cell.x, cell.y, cell.floorId)) continue;
        const k = floorCellKey(cell.floorId, cell.x, cell.y);
        if (seenThisSeg.has(k)) continue;   // one tally per segment per cell
        seenThisSeg.add(k);

        // Congestion load (student-weighted)
        congestion.set(k, (congestion.get(k) || 0) + w);

        // Contributor map (for tooltip and hotspot table) — raw segment counts
        if (!contributors.has(k)) contributors.set(k, new Map());
        const m = contributors.get(k);
        m.set(e.name, (m.get(e.name) || 0) + 1);
      }
    }
  }

  let maxCongestion = 0;
  for (const v of congestion.values()) if (v > maxCongestion) maxCongestion = v;

  // Sorted hotspots (descending by load, stable on coords) for the summary table.
  const hotspots = [...congestion.entries()].map(([k, count]) => {
    const { x, y, floorId } = parseKey(k);
    const cmap = contributors.get(k) || new Map();
    const groupsArr = [...cmap.entries()]
      .map(([name, n]) => ({ name, n, color: colorByName.get(name) || '#3b82f6' }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, undefined, { numeric: true }));
    const lab = cellLabel(x, y, floorId);
    return { key: k, x, y, floorId, count, groups: groupsArr, label: lab.label, sub: lab.sub };
  }).sort((a, b) => b.count - a.count || a.y - b.y || a.x - b.x);

  return { congestion, maxCongestion, hotspots, contributors, colorByName,
           weighted, defaultGroupSize: dgs };   // R59
}

/**
 * travelTimes(data, { settings, groups })
 * Mutates each rendered segment to add:
 *   seg.travelSec — base tile traversal + staircase overhead
 *   seg.delaySec  — congestion delay from tiles shared with other groups
 *                   within the SAME transition window.
 * Also sets entry.totalTravelSec / entry.totalDelaySec.
 * Safe to call with null / empty data.
 *
 * Per-tile congestion multiplier (concurrent OTHER groups on a tile):
 *   1 other  → +0.2× walkSec     2 others → +0.5× walkSec     3+ → +0.8× walkSec
 * R59: "others" is now student-weighted — effOthers = (sum of the other
 *   groups' headcounts on the tile) / defaultGroupSize, fed through the
 *   shared congestionDelayMult() curve (piecewise-linear through the same
 *   anchor points). With every size blank this reproduces the R58 integer
 *   behavior exactly.
 */
export function travelTimes(data, { settings, groups }) {
  if (!data || !data.entries || !data.entries.length) return;
  const walkSec  = (settings.tileWalkTime  != null) ? settings.tileWalkTime  : 3;
  const stairSec = (settings.staircaseTime != null) ? settings.staircaseTime : 8;
  const dgs = defaultSize(settings);   // R59
  const entryWeights = data.entries.map(e =>
    groupWeight(e.group || groups.find(g => g.name === e.name), settings));  // R59

  const modCount = settings.modCount;
  const transitionTileSets = [];     // index = fromMod - 1 → Map<"x,y", Set<entryIdx>>
  for (let t = 0; t < modCount - 1; t++) transitionTileSets.push(new Map());

  // Pass 1 — register each group's hallway tiles per transition.
  data.entries.forEach((entry, eIdx) => {
    (entry.rawSegments || []).forEach(seg => {
      if (seg.error || seg.noTravel || !seg.hallwayCells || !seg.hallwayCells.length) return;
      const tIdx = seg.fromMod - 1;
      if (tIdx < 0 || tIdx >= transitionTileSets.length) return;
      const tileMap = transitionTileSets[tIdx];
      const seen = new Set();
      for (const cell of seg.hallwayCells) {
        const k = floorCellKey(cell.floorId, cell.x, cell.y);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!tileMap.has(k)) tileMap.set(k, new Set());
        tileMap.get(k).add(eIdx);
      }
    });
  });

  // Pass 2 — compute times per segment.
  data.entries.forEach((entry, eIdx) => {
    let totalTravel = 0, totalDelay = 0;
    (entry.rawSegments || []).forEach(seg => {
      if (seg.error || seg.noTravel) { seg.travelSec = 0; seg.delaySec = 0; return; }
      const hallwayTiles = (seg.hallwayCells || []).length;
      const usesStair    = seg.usesStaircase ? 1 : 0;
      const baseSec      = hallwayTiles * walkSec + usesStair * stairSec;

      const tIdx = seg.fromMod - 1;
      let delaySec = 0;
      if (tIdx >= 0 && tIdx < transitionTileSets.length) {
        const tileMap = transitionTileSets[tIdx];
        const seen = new Set();
        for (const cell of (seg.hallwayCells || [])) {
          const k = floorCellKey(cell.floorId, cell.x, cell.y);
          if (seen.has(k)) continue;
          seen.add(k);
          const sharers = tileMap.get(k);
          if (!sharers) continue;
          // R59: sum the other sharers' headcounts, normalize by the default
          // group size, then map through the shared multiplier curve.
          let othersWeight = 0;
          for (const oIdx of sharers) if (oIdx !== eIdx) othersWeight += entryWeights[oIdx];
          if (othersWeight <= 0) continue;
          delaySec += walkSec * congestionDelayMult(othersWeight / dgs);
        }
      }

      seg.travelSec = Math.round(baseSec);
      seg.delaySec  = Math.round(delaySec);
      totalTravel  += baseSec;
      totalDelay   += delaySec;
    });
    entry.totalTravelSec = Math.round(totalTravel);
    entry.totalDelaySec  = Math.round(totalDelay);
  });
}

/**
 * Baseline (live-schedule) mods for a group on a day, padded/trimmed to
 * modCount. Day-fallback rules mirror groupDayPath exactly so the
 * What-If baseline always matches what the Visualize tab renders.
 */
export function baseMods(group, day, modCount) {
  let raw;
  if (day === 'B') {
    raw = (group.modsB && group.modsB.length > 0) ? group.modsB : (group.mods || []);
  } else {
    raw = group.modsA || group.mods || [];
  }
  const mods = [];
  for (let i = 0; i < modCount; i++) mods.push(((raw[i] || '') + '').trim());
  return mods;
}

/** Baseline mods with sandbox overrides applied. Pure — never mutates the group. */
export function effectiveMods(group, day, overrides, modCount) {
  const mods = baseMods(group, day, modCount);
  const ov = overrides && overrides[group.id];
  if (ov) {
    for (const k in ov) {
      const idx = +k;
      if (idx >= 0 && idx < mods.length) mods[idx] = ((ov[k] || '') + '').trim();
    }
  }
  return mods;
}

/**
 * whatIfMetrics(groups, day, overridesOrNull, { settings, blueprint, graph, registry })
 * Full schedule evaluation against the blueprint's graph.
 * Pass overrides = null for the live baseline. Returns:
 *   { day, perGroup, congPerT, congAll, totals:{travelSec,delaySec},
 *     peak:{load,cellKey,transition}, conflicts, routingErrors, unassigned }
 */
export function whatIfMetrics(groups, day, overrides, { settings, blueprint, graph, registry }) {
  const modCount = settings.modCount;
  const labels   = modLabels(settings);
  const walkSec  = (settings.tileWalkTime  != null) ? settings.tileWalkTime  : 3;
  const stairSec = (settings.staircaseTime != null) ? settings.staircaseTime : 8;
  const floor0Id = blueprint.floors[0] && blueprint.floors[0].id;
  // R59: student-weighting — mirrors travelTimes / congestionData
  // exactly so baseline and scenario reconcile with the live Visualizer.
  const dgs = defaultSize(settings);
  const weighted = anyGroupSized(groups);

  // Pass 1 — segments per group from effective mods (graph self-validates).
  const perGroup = groups.map(g => {
    const mods = effectiveMods(g, day, overrides, modCount);
    const segments = [];
    for (let i = 0; i < modCount - 1; i++) {
      const seg = {
        fromMod: i + 1, toMod: i + 2,
        fromModLabel: labels[i]     || ('Mod ' + (i + 1)),
        toModLabel:   labels[i + 1] || ('Mod ' + (i + 2)),
        fromRoom: mods[i] || null, toRoom: mods[i + 1] || null,
        path: null, pathLength: 0, usesStaircase: false, staircasePairsUsed: [], hallwayCells: [],
      };
      Object.assign(seg, resolveRoomPath(graph, mods[i], mods[i + 1], blueprint.crossFloorPairs));
      if (seg.error) seg.path = null;
      segments.push(seg);
    }
    return { id: g.id, name: g.name, grade: g.grade, color: g.color, mods, segments,
             weight: groupWeight(g, settings) };   // R59
  });

  // Pass 2 — per-transition tile occupancy (who shares which corridor cell).
  const transitionTileSets = [];
  for (let t = 0; t < modCount - 1; t++) transitionTileSets.push(new Map());
  perGroup.forEach((pg, gi) => {
    pg.segments.forEach(seg => {
      if (seg.error || seg.noTravel || !seg.hallwayCells || !seg.hallwayCells.length) return;
      const tileMap = transitionTileSets[seg.fromMod - 1];
      const seen = new Set();
      for (const cell of seg.hallwayCells) {
        const k = floorCellKey(cell.floorId || floor0Id, cell.x, cell.y);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!tileMap.has(k)) tileMap.set(k, new Set());
        tileMap.get(k).add(gi);
      }
    });
  });

  // Pass 3 — walk + congestion-delay times. Multipliers identical to
  // travelTimes so What-If numbers reconcile with the travel panel.
  let totalTravel = 0, totalDelay = 0, routingErrors = 0, unassigned = 0;
  perGroup.forEach(pg => {
    let t = 0, d = 0;
    pg.segments.forEach(seg => {
      if (seg.error) {
        seg.travelSec = 0; seg.delaySec = 0;
        if (seg.severity === 'error') routingErrors++; else unassigned++;
        return;
      }
      if (seg.noTravel) { seg.travelSec = 0; seg.delaySec = 0; return; }
      const baseSec = (seg.hallwayCells || []).length * walkSec + (seg.usesStaircase ? stairSec : 0);
      let delaySec = 0;
      const tileMap = transitionTileSets[seg.fromMod - 1];
      const seen = new Set();
      for (const cell of (seg.hallwayCells || [])) {
        const k = floorCellKey(cell.floorId || floor0Id, cell.x, cell.y);
        if (seen.has(k)) continue;
        seen.add(k);
        const sharers = tileMap.get(k);
        if (!sharers) continue;
        // R59: student-weighted "others" — identical to travelTimes.
        let othersWeight = 0;
        for (const oIdx of sharers) if (perGroup[oIdx] !== pg) othersWeight += perGroup[oIdx].weight;
        if (othersWeight <= 0) continue;
        delaySec += walkSec * congestionDelayMult(othersWeight / dgs);
      }
      seg.travelSec = Math.round(baseSec);
      seg.delaySec  = Math.round(delaySec);
      t += baseSec; d += delaySec;
    });
    pg.totalTravelSec = Math.round(t);
    pg.totalDelaySec  = Math.round(d);
    totalTravel += t; totalDelay += d;
  });

  // Pass 4 — congestion maps: one per transition + whole-day sum.
  // Mirrors congestionMap: one tally per segment, exclude zones skipped.
  const congPerT = [];
  for (let t = 0; t < modCount - 1; t++) congPerT.push(new Map());
  const congAll = new Map();
  perGroup.forEach(pg => pg.segments.forEach(seg => {
    if (seg.error || seg.noTravel || !seg.hallwayCells || !seg.hallwayCells.length) return;
    const m = congPerT[seg.fromMod - 1];
    const seen = new Set();
    for (const cell of seg.hallwayCells) {
      if (isCellHeatExcluded(blueprint, cell.x, cell.y, cell.floorId)) continue;
      const k = floorCellKey(cell.floorId || floor0Id, cell.x, cell.y);
      if (seen.has(k)) continue;
      seen.add(k);
      m.set(k, (m.get(k) || 0) + pg.weight);        // R59: student-weighted
      congAll.set(k, (congAll.get(k) || 0) + pg.weight);
    }
  }));

  // Peak single-transition load — most groups sharing one tile in one window.
  let peakLoad = 0, peakCellKey = null, peakT = 0;
  congPerT.forEach((m, tIdx) => m.forEach((v, k) => {
    if (v > peakLoad) { peakLoad = v; peakCellKey = k; peakT = tIdx + 1; }
  }));

  // Pass 5 — room double-bookings on EFFECTIVE mods (excluded rooms respected).
  const excludedRooms = new Set(registry.filter(r => r.excludeFromConflict).map(r => r.roomNumber));
  const cMap = new Map();
  perGroup.forEach(pg => pg.mods.forEach((room, idx) => {
    if (!room || excludedRooms.has(room)) return;
    const key = idx + '|' + room;
    if (!cMap.has(key)) cMap.set(key, []);
    cMap.get(key).push(pg.name);
  }));
  const conflicts = [];
  for (const [key, names] of cMap) {
    if (names.length < 2) continue;
    const bar = key.indexOf('|');
    const idx = +key.slice(0, bar), room = key.slice(bar + 1);
    conflicts.push({ key, mod: idx + 1, modLabel: labels[idx] || ('Mod ' + (idx + 1)), room, groupNames: names });
  }
  conflicts.sort((a, b) => a.mod - b.mod);

  return {
    day, perGroup, congPerT, congAll,
    totals: { travelSec: Math.round(totalTravel), delaySec: Math.round(totalDelay) },
    peak: { load: peakLoad, cellKey: peakCellKey, transition: peakT },
    conflicts, routingErrors, unassigned,
    weighted, defaultGroupSize: dgs,   // R59: display metadata for cards/hotspots
  };
}

/** The congestion map a transition filter shows: one transition's, or the day's. */
export function congForFilter(metrics, tf) {
  if (tf && tf >= 1 && tf <= metrics.congPerT.length) return metrics.congPerT[tf - 1];
  return metrics.congAll;
}

/** Baseline vs scenario evaluation + per-cell congestion deltas + conflict diff.
 *  base and scen are whatIfMetrics for the same day, without and with overrides. */
export function whatIfDiff(base, scen, overrides, tf) {
  const day = base.day;
  const groupRows = base.perGroup.map((bg, i) => {
    const sg = scen.perGroup[i];
    const before = bg.totalTravelSec + bg.totalDelaySec;
    const after  = sg.totalTravelSec + sg.totalDelaySec;
    const ov = overrides[bg.id];
    return {
      id: bg.id, name: bg.name, color: bg.color, grade: bg.grade,
      before, after, delta: after - before,
      changed: !!(ov && Object.keys(ov).length),
    };
  });

  const baseMap = congForFilter(base, tf);
  const scenMap = congForFilter(scen, tf);
  const deltas = new Map();
  const keys = new Set([...baseMap.keys(), ...scenMap.keys()]);
  let maxAbs = 0;
  for (const k of keys) {
    const d = (scenMap.get(k) || 0) - (baseMap.get(k) || 0);
    if (d !== 0) { deltas.set(k, d); if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d); }
  }

  const bKeys = new Set(base.conflicts.map(c => c.key));
  const sKeys = new Set(scen.conflicts.map(c => c.key));
  return {
    day, base, scen, groupRows, deltas, maxAbs, baseMap, scenMap,
    newConflicts:        scen.conflicts.filter(c => !bKeys.has(c.key)),
    resolvedConflicts:   base.conflicts.filter(c => !sKeys.has(c.key)),
    persistingConflicts: scen.conflicts.filter(c =>  bKeys.has(c.key)),
  };
}

/* ── The printed congestion report (Path 11 P5 increment 4) ─────────── */

/**
 * The congestion report's numbers, from the lab's own metrics: the `top`
 * (default 10) hallway cells with the highest baseline load for the
 * transition filter `tf` (null for the whole day), each with the groups whose
 * walk crosses it in that window and, when the scenario has changes, its
 * delta from whatIfDiff(); the three transitions with the most load; and the
 * scenario's changes. Ties go by cell key, so the list is the same every run.
 * opts: { tf, top, diff (whatIfDiff's result, or null), overrides, floor0Id }.
 * Naming a cell is the page's (cellCongestionLabel).
 */
export function congestionReport(base, opts = {}) {
  const tf = opts.tf || null;
  const top = opts.top || 10;
  const map = congForFilter(base, tf);
  const deltas = opts.diff ? opts.diff.deltas : null;
  const floor0Id = opts.floor0Id || null;
  const ranked = [...map.entries()].filter(([, v]) => v > 0)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, top);
  const want = new Set(ranked.map(([k]) => k));
  const who = new Map(ranked.map(([k]) => [k, []]));
  for (const pg of base.perGroup) {
    const hit = new Set();
    for (const seg of pg.segments) {
      if (seg.error || seg.noTravel || !seg.hallwayCells) continue;
      if (tf && seg.fromMod !== tf) continue;
      for (const c of seg.hallwayCells) {
        const k = floorCellKey(c.floorId || floor0Id, c.x, c.y);
        if (want.has(k)) hit.add(k);
      }
    }
    for (const k of hit) who.get(k).push(pg.name);
  }
  const cells = ranked.map(([key, load]) => {
    const { x, y, floorId } = parseKey(key);
    return { key, x, y, floorId, load, groups: who.get(key), delta: deltas ? (deltas.get(key) || 0) : null };
  });
  const transitions = base.congPerT.map((m, i) => {
    let total = 0, peak = 0;
    for (const v of m.values()) { total += v; if (v > peak) peak = v; }
    return { t: i + 1, total, peak };
  }).filter(t => t.total > 0).sort((a, b) => (b.total - a.total) || (a.t - b.t)).slice(0, 3);
  const changes = [];
  const ov = opts.overrides || {};
  for (const pg of base.perGroup) {
    const o = ov[pg.id];
    if (!o) continue;
    for (const k of Object.keys(o).map(Number).sort((a, b) => a - b)) {
      changes.push({ group: pg.name, modIdx: k, from: pg.mods[k] || '', to: ((o[k] || '') + '').trim() });
    }
  }
  return { day: base.day, tf, weighted: !!base.weighted, defaultGroupSize: base.defaultGroupSize, cells, transitions, changes };
}

/* ── Comparing with another project file (Path 11 P5 increment 4) ───── */

/** A project file's groups read as applyFullProject() reads them (no ids, no colours). */
function fileGroups(raw) {
  const out = [];
  for (const g of (Array.isArray(raw) ? raw : [])) {
    if (!g || typeof g !== 'object' || typeof g.name !== 'string' || !g.name.trim()) continue;
    const a = Array.isArray(g.modsA) ? g.modsA.slice(0, 20) : (Array.isArray(g.mods) ? g.mods.slice(0, 20) : []);
    out.push({ name: g.name.trim(), modsA: a, mods: a, modsB: Array.isArray(g.modsB) ? g.modsB.slice(0, 20) : [] });
  }
  return out;
}

function countNames(groups) {
  const n = new Map();
  for (const g of groups) n.set(g.name, (n.get(g.name) || 0) + 1);
  return n;
}

/**
 * Turns a second full-project file into what-if overrides on this schedule,
 * matching groups by name (trimmed, exact), for one day. The file is checked
 * as an import checks it (it throws the import's own message) and nothing is
 * applied. Two files describe one building only when their numbered rooms are
 * the same set; otherwise `{ ok: false, onlyHere, onlyThere }`. Otherwise
 * `{ ok: true, day, overrides: { [liveGroupId]: { [modIdx]: room } }, changed,
 * matched, added: [{ name, mods }], removed: [name], ambiguous: [name],
 * modCountThere }`: a group only in the file cannot be an override and is
 * listed; a name on two groups in either file is not compared.
 * live: { groups, registry }; opts: { day, modCount }.
 */
export function compareProject(live, data, opts = {}) {
  if (!data || typeof data !== 'object') throw new Error('file is not a valid project.');
  if (data.fileType && data.fileType !== 'stviz-project') throw new Error('this JSON is not a full-project file.');
  if (!data.blueprint || typeof data.blueprint !== 'object') throw new Error('project file is missing its blueprint.');
  validateBlueprint(data.blueprint);
  const day = opts.day === 'B' ? 'B' : 'A';
  const modCount = opts.modCount || 8;
  const bp = migrateBlueprint(JSON.parse(JSON.stringify(data.blueprint)));
  const there = new Set(roomRegistryOf({ floors: floorsFromData(bp) }).map(r => r.roomNumber));
  const here = new Set((live.registry || []).map(r => r.roomNumber));
  const sortRooms = (a, b) => a.localeCompare(b, undefined, { numeric: true });
  const onlyHere = [...here].filter(r => !there.has(r)).sort(sortRooms);
  const onlyThere = [...there].filter(r => !here.has(r)).sort(sortRooms);
  if (onlyHere.length || onlyThere.length) return { ok: false, onlyHere, onlyThere };

  const theirs = fileGroups(data.groups);
  const ours = (live.groups || []).filter(g => g && typeof g.name === 'string' && g.name.trim());
  const ourName = (g) => g.name.trim();
  const nOurs = countNames(ours.map(g => ({ name: ourName(g) })));
  const nTheirs = countNames(theirs);
  const ambiguous = [...new Set([...nOurs, ...nTheirs].filter(([, n]) => n > 1).map(([name]) => name))].sort(sortRooms);
  const skip = new Set(ambiguous);
  const byName = new Map(theirs.map(g => [g.name, g]));
  const overrides = {};
  let changed = 0, matched = 0;
  const removed = [];
  for (const g of ours) {
    const name = ourName(g);
    if (skip.has(name)) continue;
    const t = byName.get(name);
    if (!t) { removed.push(name); continue; }
    matched++;
    const a = baseMods(g, day, modCount), b = baseMods(t, day, modCount);
    for (let i = 0; i < modCount; i++) {
      if (a[i] === b[i]) continue;
      if (!overrides[g.id]) overrides[g.id] = {};
      overrides[g.id][i] = b[i];
      changed++;
    }
  }
  const added = theirs.filter(t => !skip.has(t.name) && !nOurs.has(t.name))
    .map(t => ({ name: t.name, mods: baseMods(t, day, modCount) }));
  const settingsThere = data.settings && typeof data.settings === 'object' ? data.settings : {};
  const modCountThere = Number.isInteger(settingsThere.modCount) ? settingsThere.modCount : null;
  return { ok: true, day, overrides, changed, matched, added, removed, ambiguous, modCountThere };
}
