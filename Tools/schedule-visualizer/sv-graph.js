// sv-graph.js — the School Layout Visualizer's pathfinding engine: the
// multi-floor navigation graph, the teleport-aware A* search and the
// segment resolver with its metadata.
//
// Path 11 P2 increment 3 (BACKLOG.md, "Path 11", the P2 bullet). Rounds 7,
// 8 and 31 of 035's classic script, moved with their rules unchanged; what
// they read from AppState (the blueprint's floors and crossFloorPairs) is
// now an argument, and the two page `let`s that cached the graph
// (pathfindingGraph, _blueprintDirty) are createCache()'s. The page keeps
// one wrapper per old name in its BRIDGE section and puts this module on
// window.SVGraph. Nothing here touches the DOM, AppState or storage.
//
// Coordinate convention: this engine returns/consumes {x, y} where
// x === grid column and y === grid row. Internally cells are keyed as the
// string "x,y" on one floor and "floorId:x,y" in the shared graph.
//
// Its suite is test/graph.test.mjs (npm run test:schedule-visualizer-graph).
//
// STEP-FREE ROUTING (Path 11 P3). A staircase pair may say what it is:
// `pair.access` is 'elevator' or 'ramp' (absent, or anything else, is
// stairs), and an elevator may carry `outOfService: true` and its own
// `wait` in cells. buildGraph(blueprint, { stepFree: true }) is the graph a
// wheelchair user walks: a stairs pair joins nothing, every staircase tile
// that is not an end of an in-service elevator or ramp is taken out of the
// graph (it is a flight of steps, not a corridor), and an elevator costs its
// wait. An elevator out of service joins nothing in either graph. A blueprint
// that marks nothing builds the same graph it always did, in both fields the
// golden files hold. buildGraph(blueprint, { evacuation: true }) is the
// graph the evacuation door cards route on: no elevator joins anything,
// because an elevator is not used in a fire. tests: test/step-free.test.mjs
// (npm run test:schedule-visualizer-step-free).

import { pairLabel } from './sv-model.js';

/* ---- small coordinate helpers ---- */
export function cellKey(x, y)   { return x + ',' + y; }
/** Round 31: floor-scoped node key. */
export function floorCellKey(floorId, x, y) { return floorId + ':' + x + ',' + y; }
/**
 * Round 31: parse a node key that may be "x,y" OR "floorId:x,y".
 * Returns { x, y, floorId } (floorId null when absent).
 */
export function parseKey(key) {
  let floorId = null, rest = key;
  const colon = key.indexOf(':');
  if (colon !== -1) { floorId = key.slice(0, colon); rest = key.slice(colon + 1); }
  const i = rest.indexOf(',');
  return { x: +rest.slice(0, i), y: +rest.slice(i + 1), floorId };
}
export function manhattan(ax, ay, bx, by) { return Math.abs(ax - bx) + Math.abs(ay - by); }

export const ORTHO = [ [0, -1], [0, 1], [-1, 0], [1, 0] ]; // up, down, left, right — no diagonals

/**
 * The page's graph cache: get(blueprint) returns the graph built from that
 * blueprint, rebuilding it the first time and after invalidate(); the page
 * calls invalidate() on every grid mutation (the Round 27 dirty flag, which
 * was a page `let` until Path 11 P2). rebuild(blueprint) forces a fresh build.
 */
export function createCache(opts) {
  let graph = null;
  let dirty = true;
  return {
    get(blueprint) {
      if (!graph || dirty) { graph = buildGraph(blueprint, opts); dirty = false; }
      return graph;
    },
    rebuild(blueprint) { graph = buildGraph(blueprint, opts); dirty = false; return graph; },
    invalidate() { dirty = true; },
  };
}

/* ==============================================================
   ROUND 31 — MULTI-FLOOR GRAPH
   ──────────────────────────────────────────────────────────────
   buildLocalFloorGraph() reproduces the single-floor classify +
   orthogonal-adjacency + door-routing logic for ONE floor, keyed
   locally as "x,y". buildFloorEdges() remaps those local keys into
   the shared graph using "floorId:x,y" keys. buildMultiFloorGraph()
   stitches every floor together and adds zero-cost teleport edges
   for every crossFloorPair (same-floor and cross-floor alike).
=============================================================== */

/** Build classify + adjacency for a single floor in local "x,y" keys. */
export function buildLocalFloorGraph(gridData, gridCols, gridRows) {
  const adjacency = new Map();   // "x,y" -> [ { key, cost } ]
  const types     = new Map();   // "x,y" -> 'hallway'|'staircase'|'classroom'
  const roomToKey = new Map();   // roomNumber -> "x,y"

  // Pass 1 — classify every occupied cell.
  if (gridData) {
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const t = gridData[y] && gridData[y][x];
        if (!t) continue;
        if (t.type === 'dummy') continue;
        const key = cellKey(x, y);
        types.set(key, t.type);
        if (t.type === 'classroom' && t.roomNumber) {
          if (!roomToKey.has(t.roomNumber)) roomToKey.set(t.roomNumber, key);
        }
      }
    }
    // Prefer a corridor-adjacent cell for grouped-classroom roomToKey mapping.
    // Round 55 fix: non-anchor group cells carry roomNumber:null (only the
    // anchor holds it), so resolve each cell's EFFECTIVE room number through
    // its group anchor. This lets a hallway touching ANY cell of a custom
    // room validate the route, not just one touching the top-left anchor.
    const groupRoomCache = new Map(); // groupId -> roomNumber|null
    const effectiveRoomNumber = (t) => {
      if (!t || t.type !== 'classroom') return null;
      if (t.roomNumber) return t.roomNumber;
      if (!t.groupId) return null;
      if (groupRoomCache.has(t.groupId)) return groupRoomCache.get(t.groupId);
      let found = null;
      outer: for (let gy = 0; gy < gridRows; gy++) {
        for (let gx = 0; gx < gridCols; gx++) {
          const gt = gridData[gy] && gridData[gy][gx];
          if (gt && gt.type === 'classroom' && gt.groupId === t.groupId && gt.roomNumber) {
            found = gt.roomNumber; break outer;
          }
        }
      }
      groupRoomCache.set(t.groupId, found);
      return found;
    };
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const t = gridData[y] && gridData[y][x];
        if (!t || t.type !== 'classroom') continue;
        const roomNum = effectiveRoomNumber(t);
        if (!roomNum) continue;
        const existingKey = roomToKey.get(roomNum);
        if (!existingKey) continue;
        const { x: ex, y: ey } = parseKey(existingKey);
        const existingHasHallwayNeighbor = ORTHO.some(([dx, dy]) => {
          const nt = gridData[ey + dy] && gridData[ey + dy][ex + dx];
          return nt && (nt.type === 'hallway' || nt.type === 'staircase');
        });
        if (!existingHasHallwayNeighbor) {
          const thisHasHallwayNeighbor = ORTHO.some(([dx, dy]) => {
            const nt = gridData[y + dy] && gridData[y + dy][x + dx];
            return nt && (nt.type === 'hallway' || nt.type === 'staircase');
          });
          if (thisHasHallwayNeighbor) roomToKey.set(roomNum, cellKey(x, y));
        }
      }
    }
    // Prefer a door cell as the roomToKey entry when explicit doors exist.
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const t = gridData[y] && gridData[y][x];
        if (!t || t.type !== 'classroom' || !t.doors || !t.doors.length) continue;
        for (const door of t.doors) {
          const dc = door.col, dr = door.row;
          const dt = gridData[dr] && gridData[dr][dc];
          if (!dt || dt.type !== 'classroom') continue;
          const groupId = dt.groupId;
          let roomNum = dt.roomNumber || null;
          if (!roomNum && groupId) {
            outer: for (let gy = 0; gy < gridRows; gy++) {
              for (let gx = 0; gx < gridCols; gx++) {
                const gt = gridData[gy] && gridData[gy][gx];
                if (gt && gt.type === 'classroom' && gt.groupId === groupId && gt.roomNumber) {
                  roomNum = gt.roomNumber; break outer;
                }
              }
            }
          }
          if (!roomNum) continue;
          const delta = { top: [0,-1], bottom: [0,1], left: [-1,0], right: [1,0] }[door.side];
          if (!delta) continue;
          const hn = gridData[dr + delta[1]] && gridData[dr + delta[1]][dc + delta[0]];
          if (hn && (hn.type === 'hallway' || hn.type === 'staircase')) {
            roomToKey.set(roomNum, cellKey(dc, dr));
          }
        }
      }
    }
  }

  // Build door-edge restriction lookup.
  const classroomDoorEdges = new Map();
  if (gridData) {
    const allDoors = [];
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const t = gridData[y] && gridData[y][x];
        if (!t || t.type !== 'classroom' || !t.doors || !t.doors.length) continue;
        for (const door of t.doors) allDoors.push(door);
      }
    }
    for (const door of allDoors) {
      const key = cellKey(door.col, door.row);
      const delta = { top: [0,-1], bottom: [0,1], left: [-1,0], right: [1,0] }[door.side];
      if (!delta) continue;
      const nk = cellKey(door.col + delta[0], door.row + delta[1]);
      if (!types.has(nk)) continue;
      if (!classroomDoorEdges.has(key)) classroomDoorEdges.set(key, new Set());
      classroomDoorEdges.get(key).add(nk);
    }
    const groupsWithDoors = new Set(allDoors.map(d => {
      const t = gridData[d.row] && gridData[d.row][d.col];
      return t && t.groupId ? t.groupId : null;
    }).filter(Boolean));
    for (let y = 0; y < gridRows; y++) {
      for (let x = 0; x < gridCols; x++) {
        const t = gridData[y] && gridData[y][x];
        if (!t || t.type !== 'classroom') continue;
        const key = cellKey(x, y);
        if (classroomDoorEdges.has(key)) continue;
        if (t.groupId && groupsWithDoors.has(t.groupId)) {
          classroomDoorEdges.set(key, new Set());
        }
      }
    }
  }

  // Pass 2 — orthogonal adjacency (no teleports here; added globally later).
  for (const [key, type] of types) {
    const { x, y } = parseKey(key);
    const edges = [];
    for (const [dx, dy] of ORTHO) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) continue;
      const nKey = cellKey(nx, ny);
      const nType = types.get(nKey);
      if (!nType) continue;
      if (type === 'classroom') {
        if (nType === 'hallway' || nType === 'staircase') {
          const allowedEdges = classroomDoorEdges.get(key);
          if (allowedEdges) {
            if (allowedEdges.has(nKey)) edges.push({ key: nKey, cost: 1 });
          } else {
            edges.push({ key: nKey, cost: 1 });
          }
        }
      } else {
        if (nType === 'classroom') {
          const nAllowed = classroomDoorEdges.get(nKey);
          if (nAllowed) {
            if (nAllowed.has(key)) edges.push({ key: nKey, cost: 1 });
          } else {
            edges.push({ key: nKey, cost: 1 });
          }
        } else {
          edges.push({ key: nKey, cost: 1 });
        }
      }
    }
    adjacency.set(key, edges);
  }

  return { adjacency, types, roomToKey };
}

/** Merge one floor's local graph into the shared maps using "floorId:x,y" keys. */
function buildFloorEdges(floor, adjacency, types, roomToKey) {
  const local = buildLocalFloorGraph(floor.gridData, floor.gridCols, floor.gridRows);
  const fid = floor.id;
  for (const [k, ty] of local.types) types.set(floor.id + ':' + k, ty);
  for (const [k, edges] of local.adjacency) {
    adjacency.set(fid + ':' + k, edges.map(e => ({ key: fid + ':' + e.key, cost: e.cost })));
  }
  for (const [room, k] of local.roomToKey) {
    if (!roomToKey.has(room)) roomToKey.set(room, fid + ':' + k); // first floor wins on dup room#
  }
}

/* ---- Path 11 P3: what a staircase pair is ---- */
export const ACCESS_KINDS = ['stairs', 'elevator', 'ramp'];
/** What an elevator ride costs a step-free route, in cells, when the pair names no `wait`. */
export const ELEVATOR_WAIT = 10;
/** 'elevator', 'ramp' or 'stairs' (the default, and what any other value means). */
export function pairAccess(pair) {
  return pair && (pair.access === 'elevator' || pair.access === 'ramp') ? pair.access : 'stairs';
}
/** False only for an elevator marked out of service. */
export function pairInService(pair) {
  return !(pairAccess(pair) === 'elevator' && pair.outOfService === true);
}
/** An elevator's wait in cells: its own `wait` when that is a number from 0 to 999. */
export function elevatorWait(pair, fallback = ELEVATOR_WAIT) {
  const w = pair && pair.wait;
  return (typeof w === 'number' && isFinite(w) && w >= 0 && w <= 999) ? w : fallback;
}

/** Build the unified multi-floor navigation graph for a blueprint
 *  ({ floors: [{ id, gridData, gridCols, gridRows }], crossFloorPairs }).
 *  opts.stepFree builds the step-free graph, opts.evacuation the one with
 *  no elevators (see the header);
 *  opts.elevatorWait replaces ELEVATOR_WAIT for pairs naming no wait. */
export function buildGraph(blueprint, opts = {}) {
  const stepFree = !!(opts && opts.stepFree);
  const evacuation = !!(opts && opts.evacuation);
  const waitDefault = (opts && typeof opts.elevatorWait === 'number') ? opts.elevatorWait : ELEVATOR_WAIT;
  const adjacency = new Map();
  const types     = new Map();
  const roomToKey = new Map();
  const portals   = [];

  // Pass 1: intra-floor graphs.
  for (const floor of blueprint.floors) {
    buildFloorEdges(floor, adjacency, types, roomToKey);
  }

  // Pass 2: zero-cost teleport edges for every cross-floor pair (same-floor or cross-floor).
  // Path 11 P3: an elevator out of service joins nothing; on the step-free
  // graph a stairs pair joins nothing either, and an elevator costs its wait.
  // An edge names its access only when it is not stairs, so a blueprint that
  // marks nothing builds the edges it always built.
  const stepFreeEnds = new Set();   // tile keys of in-service elevator/ramp ends
  for (const pair of (blueprint.crossFloorPairs || [])) {
    const a = floorCellKey(pair.a.floorId, pair.a.col, pair.a.row);
    const b = floorCellKey(pair.b.floorId, pair.b.col, pair.b.row);
    if (types.get(a) === 'staircase' && types.get(b) === 'staircase') {
      const access = pairAccess(pair);
      if (!pairInService(pair)) continue;
      if (access !== 'stairs') { stepFreeEnds.add(a); stepFreeEnds.add(b); }
      if (stepFree && access === 'stairs') continue;
      if (evacuation && access === 'elevator') continue;
      const cost = (stepFree && access === 'elevator') ? elevatorWait(pair, waitDefault) : 0;
      const ea = { key: b, cost, teleport: true }, eb = { key: a, cost, teleport: true };
      if (access !== 'stairs') { ea.access = access; eb.access = access; }
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push(ea);
      adjacency.get(b).push(eb);
      portals.push({ key: a, partnerKey: b });
      portals.push({ key: b, partnerKey: a });
    }
  }

  // Pass 3 (step-free only): every other staircase tile is a flight of steps.
  // It keeps its type, loses every edge in and out, and is named in `steps`;
  // a cell that lost an edge to one is named in `cutByStairs`, which is how
  // resolveRoomPath() tells "only stairs reach this room" from "walled off".
  const steps = new Set(), cutByStairs = new Set();
  if (stepFree) {
    for (const [k, ty] of types) if (ty === 'staircase' && !stepFreeEnds.has(k)) steps.add(k);
    for (const [k, edges] of adjacency) {
      if (steps.has(k)) { adjacency.set(k, []); continue; }
      const kept = edges.filter(e => !steps.has(e.key));
      if (kept.length !== edges.length) { cutByStairs.add(k); adjacency.set(k, kept); }
    }
  }

  let edgeCount = 0;
  for (const edges of adjacency.values()) edgeCount += edges.length;
  const totalRows = blueprint.floors.reduce((a, f) => a + f.gridRows, 0);
  const maxCols   = Math.max(...blueprint.floors.map(f => f.gridCols), 0);

  const graph = {
    adjacency, types, roomToKey, portals,
    cols: maxCols, rows: totalRows,
    walkableCount:  [...types.entries()].filter(([k, t]) => (t === 'hallway' || t === 'staircase') && !steps.has(k)).length,
    classroomCount: [...types.values()].filter(t => t === 'classroom').length,
    edgeCount: edgeCount / 2 | 0,
    portalCount: portals.length / 2 | 0,
    isWalkable: (key) => { const ty = types.get(key); return (ty === 'hallway' || ty === 'staircase') && !steps.has(key); },
  };
  // Only the step-free graph carries these, so the ordinary graph's shape is unchanged.
  if (stepFree) { graph.stepFree = true; graph.steps = steps; graph.cutByStairs = cutByStairs; }
  return graph;
}

/* --------------------------------------------------------------
   ADMISSIBLE TELEPORT-AWARE HEURISTIC
   ──────────────────────────────────────────────────────────────
   A plain Manhattan heuristic can OVER-estimate the true cost when a
   zero-cost staircase teleport lets students skip a large distance,
   which would make A* inadmissible (and potentially non-optimal).

   To keep A* admissible we build a tiny "portal graph" containing the
   goal plus every staircase cell. Edges between any two of these points
   use Manhattan distance (always ≤ the true grid distance), and each
   paired staircase has a 0-cost edge to its partner. Running Dijkstra
   from the goal over this small graph yields, for every staircase cell,
   a guaranteed lower bound on the cost to reach the goal — teleports
   and all. The final heuristic for a cell is then:

       h(cell) = min( manhattan(cell, goal),
                      min over staircase s of  manhattan(cell, s) + dist(s, goal) )

   Every term is a true lower bound, so h never over-estimates → A* stays
   admissible and returns optimal paths even with chained teleports.
-------------------------------------------------------------- */
export function buildHeuristic(graph, goalKey) {
  const goal = parseKey(goalKey);
  const portals = graph.portals; // [ {key, partnerKey}, ... ] (each direction listed once)

  if (portals.length === 0) {
    // No teleports → plain Manhattan is already admissible.
    return (key) => { const c = parseKey(key); return manhattan(c.x, c.y, goal.x, goal.y); };
  }

  // Unique staircase cells.
  const stairKeys = [...new Set(portals.map(p => p.key))];
  const partnerOf = new Map();
  for (const p of portals) partnerOf.set(p.key, p.partnerKey);

  // distToGoal[stairKey] = lower-bound cost from that stair cell to the goal.
  const distToGoal = new Map();
  for (const k of stairKeys) {
    const c = parseKey(k);
    distToGoal.set(k, manhattan(c.x, c.y, goal.x, goal.y)); // initial: walk straight to goal
  }

  // Relax over the small portal graph until stable (Bellman-Ford style;
  // node count is tiny, so this is cheap and guarantees convergence).
  let changed = true, guard = 0;
  while (changed && guard++ < stairKeys.length + 2) {
    changed = false;
    for (const a of stairKeys) {
      const ca = parseKey(a);
      // Option 1: teleport from a to its partner (0 cost), then partner→goal.
      const partner = partnerOf.get(a);
      if (partner != null && distToGoal.has(partner)) {
        const viaTeleport = 0 + distToGoal.get(partner);
        if (viaTeleport < distToGoal.get(a)) { distToGoal.set(a, viaTeleport); changed = true; }
      }
      // Option 2: walk from a to another stair b (Manhattan), then b→goal.
      for (const b of stairKeys) {
        if (a === b) continue;
        const cb = parseKey(b);
        const viaWalk = manhattan(ca.x, ca.y, cb.x, cb.y) + distToGoal.get(b);
        if (viaWalk < distToGoal.get(a)) { distToGoal.set(a, viaWalk); changed = true; }
      }
    }
  }

  return (key) => {
    const c = parseKey(key);
    let best = manhattan(c.x, c.y, goal.x, goal.y); // direct walk lower bound
    for (const s of stairKeys) {
      const cs = parseKey(s);
      const viaStair = manhattan(c.x, c.y, cs.x, cs.y) + distToGoal.get(s);
      if (viaStair < best) best = viaStair;
    }
    return best;
  };
}

/* --------------------------------------------------------------
   A* SEARCH on the navigation graph.
   Returns ordered array of cell keys, or null if unreachable.
   Classroom cells are only ever the start or the goal — never passed
   through — because adjacency never links a classroom to another
   classroom, and walkable expansion only steps onto a classroom when
   it IS the goal.
-------------------------------------------------------------- */
export function astar(graph, startKey, goalKey) {
  if (startKey === goalKey) return [startKey];
  if (!graph.adjacency.has(startKey) || !graph.adjacency.has(goalKey)) return null;

  const h = buildHeuristic(graph, goalKey);

  const gScore   = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const closed   = new Set();

  // Simple binary-heap-free open set: array kept as a min-heap via helpers.
  // For school-sized grids a lightweight heap is more than fast enough.
  const open = new MinHeap();
  open.push(startKey, h(startKey));

  while (open.size > 0) {
    const current = open.pop();
    if (current === goalKey) return reconstruct(cameFrom, current);
    if (closed.has(current)) continue;   // stale duplicate from a reopen
    closed.add(current);

    const curType = graph.types.get(current);
    // Never expand THROUGH a non-start classroom (terminal node rule).
    if (curType === 'classroom' && current !== startKey) continue;

    const g = gScore.get(current);
    for (const edge of graph.adjacency.get(current) || []) {
      const nKey = edge.key;
      const nType = graph.types.get(nKey);
      // The only classroom we may ever step onto is the destination.
      if (nType === 'classroom' && nKey !== goalKey) continue;

      const tentative = g + edge.cost;
      if (tentative < (gScore.has(nKey) ? gScore.get(nKey) : Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentative);
        // The teleport-aware heuristic is admissible but not strictly
        // consistent (a 0-cost teleport edge can violate the triangle
        // inequality), so a node may need to be REOPENED if a cheaper
        // route to it is discovered after it was closed. Allowing reopening
        // keeps A* optimal for any admissible heuristic.
        closed.delete(nKey);
        open.push(nKey, tentative + h(nKey));
      }
    }
  }
  return null; // exhausted — no legal path
}

function reconstruct(cameFrom, current) {
  const keys = [current];
  while (cameFrom.has(current)) { current = cameFrom.get(current); keys.push(current); }
  keys.reverse();
  return keys;
}

/* Minimal binary min-heap keyed by priority (fScore). */
class MinHeap {
  constructor() { this.items = []; }     // [ {key, p}, ... ]
  get size() { return this.items.length; }
  push(key, p) {
    const a = this.items; a.push({ key, p });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]]; i = parent;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last; let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < a.length && a[l].p < a[s].p) s = l;
        if (r < a.length && a[r].p < a[s].p) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top ? top.key : undefined;
  }
}

/* --------------------------------------------------------------
   PUBLIC API
-------------------------------------------------------------- */

/**
 * findPath(graph, fromRoomNumber, toRoomNumber)
 *   → ordered array of { x, y, floorId } cell coordinates, or null if no path.
 * Rooms are resolved to grid cells via the graph's roomToKey.
 */
export function findPath(graph, fromRoomNumber, toRoomNumber) {
  const fromKey = graph.roomToKey.get(fromRoomNumber);
  const toKey   = graph.roomToKey.get(toRoomNumber);
  if (!fromKey || !toKey) return null; // unknown room number

  const keys = astar(graph, fromKey, toKey);
  if (!keys) return null;
  return keys.map(k => parseKey(k)); // → [ {x, y, floorId}, ... ]
}

/* --------------------------------------------------------------
   ROUND 8 — EDGE-CASE-AWARE SEGMENT RESOLUTION + METADATA
   ──────────────────────────────────────────────────────────────
   resolveRoomPath() is the single source of truth for turning a
   (fromRoom, toRoom) pair into one of three richly-typed results:

     • no travel  → { noTravel:true, path:[], pathLength:0, ... }
     • a failure  → { error:"<message>", severity:'warning'|'error' }
     • a route    → { path:[{x,y,floorId}…], pathLength, usesStaircase,
                      staircasePairsUsed:[…], hallwayCells:[{x,y,floorId}…] }

   Failure messages are the exact strings required by the spec:
     - "Room not found in blueprint"           (room number unknown)
     - "Room unreachable — not connected to any hallway"
     - "No valid path between rooms"           (disconnected components)
   Same-room mods resolve to { noTravel:true }. Unpaired staircases are
   simply walkable dead-ends (no teleport edge) and never throw.
-------------------------------------------------------------- */

/** Map every staircase node key ("floorId:col,row") → its pair index. */
export function buildStaircasePairLookup(crossFloorPairs) {
  const lookup = new Map();
  (crossFloorPairs || []).forEach((pair, idx) => {
    if (pair && pair.a) lookup.set(floorCellKey(pair.a.floorId, pair.a.col, pair.a.row), idx);
    if (pair && pair.b) lookup.set(floorCellKey(pair.b.floorId, pair.b.col, pair.b.row), idx);
  });
  return lookup;
}

/**
 * Inspect a routed sequence of cell keys and produce the metadata bundle
 * the visualization layer consumes. `crossFloorPairs` names the pair labels.
 */
export function buildPathMetadata(cellKeys, graph, crossFloorPairs) {
  const path = cellKeys.map(k => parseKey(k));
  let usesStaircase = false;
  const hallwayCells = [];

  for (const k of cellKeys) {
    const ty = graph.types.get(k);
    if (ty === 'staircase') usesStaircase = true;
    else if (ty === 'hallway') hallwayCells.push(parseKey(k));
  }

  // A teleport shows up as two CONSECUTIVE staircase cells that are either on
  // different floors, or non-adjacent on the same floor, belonging to one pair.
  const pairLookup = buildStaircasePairLookup(crossFloorPairs);
  const usedPairIdx = new Set();
  for (let i = 1; i < cellKeys.length; i++) {
    const a = cellKeys[i - 1], b = cellKeys[i];
    if (graph.types.get(a) !== 'staircase' || graph.types.get(b) !== 'staircase') continue;
    const pa = parseKey(a), pb = parseKey(b);
    const crossFloor = pa.floorId !== pb.floorId;
    const dist = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
    if (!crossFloor && dist <= 1) continue; // adjacent same-floor stairs = walked
    const ia = pairLookup.get(a), ib = pairLookup.get(b);
    if (ia != null && ia === ib) usedPairIdx.add(ia);
  }
  const staircasePairsUsed = [...usedPairIdx]
    .sort((x, y) => x - y)
    .map(idx => pairLabel(idx));

  const meta = {
    path,
    pathLength: path.length, // cells traversed (inclusive of both endpoints)
    usesStaircase,
    staircasePairsUsed,
    hallwayCells,
  };
  // Path 11 P3: a step-free route names what carried it between floors and
  // what it cost, an elevator's wait included.
  if (graph.stepFree) {
    meta.stepFree = true;
    meta.connectorsUsed = [...usedPairIdx].sort((x, y) => x - y)
      .map(idx => ({ label: pairLabel(idx), access: pairAccess((crossFloorPairs || [])[idx]) }));
    let cost = 0;
    for (let i = 1; i < cellKeys.length; i++) {
      const e = (graph.adjacency.get(cellKeys[i - 1]) || []).find(ed => ed.key === cellKeys[i]);
      cost += e ? e.cost : 1;
    }
    meta.pathCost = cost;
  }
  return meta;
}

/**
 * resolveRoomPath(graph, fromRoom, toRoom, crossFloorPairs) → richly-typed
 * result (see header above). Used by findGroupDayPath and validation.
 */
/** The one sentence a step-free route that does not exist is given (Path 11 P3). */
export const STEP_FREE_NONE = 'No step-free route between these rooms';

export function resolveRoomPath(graph, fromRoom, toRoom, crossFloorPairs) {
  const from = (fromRoom || '').trim();
  const to   = (toRoom   || '').trim();

  // A mod with no assigned room is a soft (warning) condition.
  if (!from || !to) {
    return { error: 'Mod not assigned', severity: 'warning' };
  }

  // Student stays in the same room: zero-length, no travel.
  if (from === to) {
    return {
      noTravel: true, path: [], pathLength: 0,
      usesStaircase: false, staircasePairsUsed: [], hallwayCells: [],
    };
  }

  const fromKey = graph.roomToKey.get(from);
  const toKey   = graph.roomToKey.get(to);

  // Room number doesn't correspond to any classroom tile in the blueprint.
  if (!fromKey || !toKey) {
    return { error: 'Room not found in blueprint', severity: 'warning' };
  }

  // A classroom with no edges at all is walled off from every corridor.
  const fromIsolated = (graph.adjacency.get(fromKey) || []).length === 0;
  const toIsolated   = (graph.adjacency.get(toKey)   || []).length === 0;
  // Path 11 P3: on the step-free graph, say plainly that stairs are the
  // reason; never fall back to a route with steps in it.
  if (graph.stepFree && ((fromIsolated && graph.cutByStairs.has(fromKey)) || (toIsolated && graph.cutByStairs.has(toKey)))) {
    return { error: STEP_FREE_NONE, severity: 'error', stepFree: true };
  }
  if (fromIsolated || toIsolated) {
    return { error: 'Room unreachable — not connected to any hallway', severity: 'error' };
  }

  // Both endpoints touch a corridor but live in disconnected components.
  const keys = astar(graph, fromKey, toKey);
  if (!keys) {
    if (graph.stepFree) return { error: STEP_FREE_NONE, severity: 'error', stepFree: true };
    return { error: 'No valid path between rooms', severity: 'error' };
  }

  return buildPathMetadata(keys, graph, crossFloorPairs);
}
