// sv-routes.js — the School Layout Visualizer's routes over the navigation
// graph: a group's day of segments, the corridor congestion map, the
// heat-exclude zone test, and evacuation routes to the nearest marked exit.
//
// Path 11 P2 increment 4 (BACKLOG.md, "Path 11", the P2 bullet). Moved from
// 035's classic script with their rules unchanged; what they read from
// AppState is now an argument. The page keeps one wrapper per old name in
// its BRIDGE section (window.computeEvacuationRouteForRoom and friends stay
// where they were) and puts this module on window.SVRoutes. Nothing here
// touches the DOM, AppState or storage.
//
// Its suite is test/routes.test.mjs (npm run test:schedule-visualizer-routes).

import { modLabels, groupWeight, pairLabel } from './sv-model.js';
import { astar, buildGraph, floorCellKey, pairAccess, pairInService, parseKey, resolveRoomPath } from './sv-graph.js';

/**
 * Check if a cell is inside any heat-exclude zone of a blueprint.
 * Used by congestionMap to skip excluded cells. Round 31: the zones on the
 * cell's own floor; a cell with no floorId is checked against the
 * blueprint's top-level heatExcludeZones, which on the page is the ACTIVE
 * floor's mirror (a rule P2 keeps as it found it: Devon, P11-9).
 */
export function isCellHeatExcluded(blueprint, x, y, floorId) {
  let zones;
  if (floorId) {
    const f = (blueprint.floors || []).find(fl => fl.id === floorId);
    zones = f ? (f.heatExcludeZones || []) : [];
  } else {
    zones = blueprint.heatExcludeZones || [];
  }
  for (const z of zones) {
    if (x >= z.col && x < z.col + z.cols &&
        y >= z.row && y < z.row + z.rows) return true;
  }
  return false;
}

/**
 * groupDayPath(group, day, { graph, settings, pairs })
 *   → ordered array of path segments chaining Mod 1→2, 2→3, ... N-1→N
 *   (the page's findGroupDayPath(groupName, day) finds the group by name).
 * Each segment now carries full metadata for the visualization layer:
 *   {
 *     fromMod, toMod, fromModLabel, toModLabel, fromRoom, toRoom,
 *     path,                // [{x,y,floorId}…]  (null on error, [] on no-travel)
 *     pathLength,          // cells traversed
 *     usesStaircase,       // boolean
 *     staircasePairsUsed,  // ['A','C', …] pair labels teleported through
 *     hallwayCells,        // [{x,y,floorId}…] hallway-only cells (for congestion)
 *     noTravel?,           // true when fromRoom === toRoom
 *     error?, severity?    // 'warning' | 'error' on failure
 *   }
 */
export function groupDayPath(group, day, { graph, settings, pairs }) {
  if (!group) return null;

  // Resolve which day's mods to use. Fall back to group.mods (A day) if modsB absent.
  const dayKey = (day === 'B') ? 'B' : 'A';
  let mods;
  if (dayKey === 'B') {
    mods = (group.modsB && group.modsB.length > 0) ? group.modsB : (group.mods || []);
  } else {
    mods = group.modsA || group.mods || [];
  }

  const labels   = modLabels(settings);
  const modCount = settings.modCount;
  const segments = [];

  for (let i = 0; i < modCount - 1; i++) {
    const fromRoom = (mods[i]     || '').trim();
    const toRoom   = (mods[i + 1] || '').trim();
    const seg = {
      fromMod:      i + 1,
      toMod:        i + 2,
      fromModLabel: labels[i]     || ('Mod ' + (i + 1)),
      toModLabel:   labels[i + 1] || ('Mod ' + (i + 2)),
      fromRoom:     fromRoom || null,
      toRoom:       toRoom   || null,
      path:         null,
      pathLength:   0,
      usesStaircase: false,
      staircasePairsUsed: [],
      hallwayCells: [],
    };

    Object.assign(seg, resolveRoomPath(graph, fromRoom, toRoom, pairs));
    if (seg.error) seg.path = null; // errors never carry a path
    segments.push(seg);
  }
  return segments;
}

/**
 * congestionMap(groupNames[], day, { groups, graph, settings, blueprint })
 *   → Map<"floorId:x,y", load>
 *   Counts how many group path SEGMENTS traverse each hallway cell across
 *   the supplied groups. A cell is counted at most once per segment, so the
 *   value reflects concurrent corridor load. The visualization layer uses
 *   this to drive the green→red congestion gradient.
 */
export function congestionMap(groupNames, day, { groups, graph, settings, blueprint }) {
  const counts = new Map();
  const names = Array.isArray(groupNames) ? groupNames : [];

  for (const name of names) {
    const grp = groups.find(g => g.name === name);
    const segments = groupDayPath(grp, day, { graph, settings, pairs: blueprint.crossFloorPairs });
    if (!segments) continue;
    // R59: each traversal contributes the group's headcount (explicit size or
    // the settings default) instead of a flat 1 — see groupWeight().
    const w   = groupWeight(grp, settings);
    for (const seg of segments) {
      if (seg.error || seg.noTravel || !seg.hallwayCells || !seg.hallwayCells.length) continue;
      const seenThisSegment = new Set();
      for (const cell of seg.hallwayCells) {
        // Skip cells inside any heat-exclude zone (on the cell's own floor).
        if (isCellHeatExcluded(blueprint, cell.x, cell.y, cell.floorId)) continue;
        const k = floorCellKey(cell.floorId || (blueprint.floors[0] && blueprint.floors[0].id), cell.x, cell.y);
        if (seenThisSegment.has(k)) continue; // one tally per segment
        seenThisSegment.add(k);
        counts.set(k, (counts.get(k) || 0) + w);
      }
    }
  }
  return counts;
}


/* ==============================================================
   EVACUATION ROUTES
   ──────────────────────────────────────────────────────────────
   Computes, for a room, the shortest path to the nearest marked
   exterior exit — entirely by calling the existing astar() above
   with different (startKey, goalKey) pairs. astar() itself is
   untouched: no new edge type, no new heuristic case, and the
   admissible teleport-aware heuristic documented above it still
   applies unchanged to every one of these calls.

   "Exterior exit" is NOT a new grid-tile TYPE (that would have meant
   touching the classify pass, drawTile(), the doorway/eraser tools,
   serialization, etc. throughout this file). It's a boolean flag —
   tile.isExit, plus optional tile.exitLabel / tile.assemblyPoint —
   on an ordinary hallway tile, following the exact precedent already
   set by corridorLabel on the same tile shape (see showHallwayEditor
   above). Because a flag on an existing tile object round-trips
   through serializeBlueprint()/applyBlueprintData() for free (tiles
   are already copied wholesale with `{...tile}`), none of the
   blueprint save/load code needed to change for this to persist,
   export, import, and survive the recovery-point ring.
=============================================================== */

/**
 * Every marked exterior exit across all floors, as graph-scoped keys
 * ("floorId:col,row") the astar() goal parameter already expects. An exit
 * cell that is not in the graph's adjacency is dropped.
 */
export function collectExitPoints(blueprint, graph) {
  const exits = [];
  for (const floor of (blueprint.floors || [])) {
    if (!floor.gridData) continue;
    for (let r = 0; r < floor.gridRows; r++) {
      for (let c = 0; c < floor.gridCols; c++) {
        const t = floor.gridData[r] && floor.gridData[r][c];
        if (t && t.type === 'hallway' && t.isExit) {
          const key = floorCellKey(floor.id, c, r);
          if (graph.adjacency.has(key)) {
            exits.push({
              key, floorId: floor.id, col: c, row: r,
              label: t.exitLabel || '',
              assemblyPoint: t.assemblyPoint || '',
            });
          }
        }
      }
    }
  }
  return exits;
}

/**
 * Re-derive a path's total edge cost from the same adjacency list astar()
 * searched, so candidate exits can be compared by real cost (teleports are
 * 0-cost) rather than by raw cell count.
 */
export function evacPathCost(graph, path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const edges = graph.adjacency.get(path[i - 1]) || [];
    const edge = edges.find(e => e.key === path[i]);
    total += edge ? edge.cost : 1;
  }
  return total;
}

/**
 * Shortest evacuation route from one room's graph key to the nearest
 * marked exit: one astar() call per candidate exit (schools have very
 * few marked exits, so this is cheap), keeping the lowest-cost result.
 * Returns { path, exit, cost, crossesFloor } or null (room not in the
 * graph, or no marked exit is reachable from it at all).
 */
export function computeEvacuationRouteForRoom(roomKey, exits, graph) {
  if (!graph.adjacency.has(roomKey)) return null;
  let best = null;
  for (const exit of exits) {
    const path = astar(graph, roomKey, exit.key);
    if (!path) continue;
    const cost = evacPathCost(graph, path);
    if (!best || cost < best.cost) best = { path, exit, cost };
  }
  if (!best) return null;
  const startFloorId = parseKey(roomKey).floorId;
  best.crossesFloor = best.path.some(k => parseKey(k).floorId !== startFloorId);
  return best;
}

/** Human direction word for one orthogonal step on the SAME floor. */
export function evacDirectionLabel(dx, dy) {
  if (dx === 1) return 'east';
  if (dx === -1) return 'west';
  if (dy === 1) return 'south';
  if (dy === -1) return 'north';
  return null;
}

/**
 * Turn a raw A* key path into short numbered turn-by-turn instructions,
 * collapsing runs of same-direction steps into one line and calling out
 * staircase teleports by the destination floor's own label. Reads the
 * `teleport` flag straight off the matching adjacency edge (the same
 * flag sv-graph.js's buildGraph() set when it built the edge) rather than
 * inferring a floor change from coordinates, since paired staircases are
 * not required to sit at the same col/row on each floor. `floorLabel(id)`
 * names a floor (the page's floorLabelById).
 */
export function buildEvacuationSteps(path, exit, graph, floorLabel) {
  const steps = [];
  let i = 0;
  while (i < path.length - 1) {
    const edges = graph.adjacency.get(path[i]) || [];
    const edge  = edges.find(e => e.key === path[i + 1]);
    if (edge && edge.teleport) {
      const toFloorId = parseKey(path[i + 1]).floorId;
      const by = edge.access === 'elevator' ? 'the elevator' : edge.access === 'ramp' ? 'the ramp' : 'the stairs';
      steps.push(`Take ${by} to ${floorLabel(toFloorId)}.`);
      i++;
      continue;
    }
    const a = parseKey(path[i]), b = parseKey(path[i + 1]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const dir = evacDirectionLabel(dx, dy);
    if (!dir) { i++; continue; }
    let count = 1, j = i + 1;
    while (j < path.length - 1) {
      const e2 = (graph.adjacency.get(path[j]) || []).find(e => e.key === path[j + 1]);
      if (!e2 || e2.teleport) break;
      const c1 = parseKey(path[j]), c2 = parseKey(path[j + 1]);
      if (c1.floorId !== c2.floorId || c2.x - c1.x !== dx || c2.y - c1.y !== dy) break;
      count++; j++;
    }
    steps.push(`Head ${dir} ${count} tile${count === 1 ? '' : 's'}.`);
    i = j;
  }
  steps.push(`Exit at ${(exit && exit.label) ? exit.label : 'the marked exit'}.`);
  return steps;
}


/* ==============================================================
   STEP-FREE REPORT (Path 11 P3)
   ──────────────────────────────────────────────────────────────
   Which rooms cannot be reached without stairs, and which of the
   schedule's moves have no step-free route. A room is judged against
   the marked exterior exits, the way people come into the building:
   it is 'step-free' when the step-free graph reaches one of them,
   'stairs-only' when only the ordinary graph does, and 'unreachable'
   when neither does (walled off: a blueprint problem, not an access
   one). With no exit marked a room cannot be judged, and the report
   says so rather than guessing a front door. A move is listed when
   the ordinary graph routes it and the step-free graph cannot;
   moves the ordinary graph cannot route are another check's.
=============================================================== */

/** The days a group has: A always, B when it has its own B-day mods. */
function groupDays(group) {
  return (group.modsB && group.modsB.length > 0) ? ['A', 'B'] : ['A'];
}

/**
 * stepFreeReport({ blueprint, groups, settings, elevatorWait? }) →
 *   { exitCount, connectors: [{ label, access, outOfService, floors: [a, b] }],
 *     rooms: [{ room, floorId, status }], moves: [{ group, day, fromModLabel,
 *     toModLabel, fromRoom, toRoom }], movesChecked, counts: { stepFree,
 *     stairsOnly, unreachable, unjudged } }
 * Rooms are sorted by floor order, then by room number as text.
 */
export function stepFreeReport({ blueprint, groups, settings, elevatorWait }) {
  const plain = buildGraph(blueprint);
  const free  = buildGraph(blueprint, { stepFree: true, elevatorWait });
  const pairs = blueprint.crossFloorPairs || [];

  const connectors = [];
  pairs.forEach((p, idx) => {
    if (!p || !p.a || !p.b) return;
    connectors.push({
      label: pairLabel(idx), access: pairAccess(p),
      outOfService: !pairInService(p), floors: [p.a.floorId, p.b.floorId],
    });
  });

  const exitsPlain = collectExitPoints(blueprint, plain);
  const exitsFree  = collectExitPoints(blueprint, free);
  const floorOrder = new Map((blueprint.floors || []).map((f, i) => [f.id, i]));
  const rooms = [];
  const counts = { stepFree: 0, stairsOnly: 0, unreachable: 0, unjudged: 0 };
  for (const [room, key] of plain.roomToKey) {
    const floorId = parseKey(key).floorId;
    let status;
    if (!exitsPlain.length) status = 'unjudged';
    else if (computeEvacuationRouteForRoom(key, exitsFree, free)) status = 'step-free';
    else if (computeEvacuationRouteForRoom(key, exitsPlain, plain)) status = 'stairs-only';
    else status = 'unreachable';
    counts[{ 'step-free': 'stepFree', 'stairs-only': 'stairsOnly', unreachable: 'unreachable', unjudged: 'unjudged' }[status]]++;
    rooms.push({ room, floorId, status });
  }
  rooms.sort((a, b) => ((floorOrder.get(a.floorId) || 0) - (floorOrder.get(b.floorId) || 0)) ||
    a.room.localeCompare(b.room, undefined, { numeric: true }));

  const moves = [];
  let movesChecked = 0;
  for (const group of (groups || [])) {
    for (const day of groupDays(group)) {
      const a = groupDayPath(group, day, { graph: plain, settings, pairs }) || [];
      const b = groupDayPath(group, day, { graph: free,  settings, pairs }) || [];
      a.forEach((seg, i) => {
        if (seg.error || seg.noTravel) return;
        movesChecked++;
        if (b[i] && b[i].error) {
          moves.push({ group: group.name, day, fromModLabel: seg.fromModLabel, toModLabel: seg.toModLabel,
            fromRoom: seg.fromRoom, toRoom: seg.toRoom });
        }
      });
    }
  }
  return { exitCount: exitsPlain.length, connectors, rooms, moves, movesChecked, counts };
}
