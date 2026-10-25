// The inputs graph.test.mjs runs through sv-graph.js. graph-golden.json holds
// what 035's own Round 7/8/31 functions returned for each of them at v320,
// before Path 11 P2 increment 3 moved them. Every room is made up; the
// Northwind project is Tools/schedule/test's invented school.
//
// A floor is drawn as rows of characters: '.' empty, 'H' hallway, 'S'
// staircase, 'X' a dummy tile, and any other character a classroom whose
// room number the case's legend gives (a legend entry may add a groupId or
// doors). Graphs are compared as plain JSON: every Map as its entries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, '../../schedule/test/fixture-northwind.json'), 'utf8'));

export function floor(id, rows, legend = {}) {
  const gridRows = rows.length, gridCols = Math.max(...rows.map(r => r.length));
  const gridData = Array.from({ length: gridRows }, (_, y) => Array.from({ length: gridCols }, (_, x) => {
    const ch = rows[y][x] || '.';
    if (ch === '.') return null;
    if (ch === 'H') return { type: 'hallway' };
    if (ch === 'S') return { type: 'staircase' };
    if (ch === 'X') return { type: 'dummy' };
    const l = legend[ch] || { roomNumber: ch };
    return { type: 'classroom', ...l };
  }));
  return { id, label: id, gridCols, gridRows, gridData };
}
const pair = (fa, ca, ra, fb, cb, rb) => ({ a: { floorId: fa, col: ca, row: ra }, b: { floorId: fb, col: cb, row: rb } });

/** Northwind's blueprint as the page holds it: floors with gridData. */
function northwind() {
  const bp = NW().blueprint;
  return {
    floors: bp.floors.map(f => {
      const gridData = Array.from({ length: f.gridRows }, () => Array.from({ length: f.gridCols }, () => null));
      for (const c of f.cells) gridData[c.row][c.col] = { ...c.tile };
      return { id: f.id, label: f.label, gridCols: f.gridCols, gridRows: f.gridRows, gridData };
    }),
    crossFloorPairs: bp.crossFloorPairs,
  };
}

export const ser = (g) => g && ({
  adjacency: [...g.adjacency], types: [...g.types], roomToKey: [...g.roomToKey], portals: g.portals,
  cols: g.cols, rows: g.rows, walkableCount: g.walkableCount, classroomCount: g.classroomCount,
  edgeCount: g.edgeCount, portalCount: g.portalCount,
  walkable: [...g.types.keys()].filter(k => g.isWalkable(k)),
});

export const BLUEPRINTS = {
  // a 3×3 cross of corridor with three rooms and a dummy tile as a wall
  cross: { floors: [floor('f1', ['AHB', 'HHX', 'CH.'], { A: { roomNumber: '204' }, B: { roomNumber: '116' }, C: { roomNumber: '301' } })], crossFloorPairs: [] },
  // a two-cell room whose only doorway is on its right-hand cell's bottom side
  // ('a' is the anchor, which alone holds the room number, Round 55)
  door: { floors: [floor('f1', ['HHHH', 'aAHB', 'HHHH'], {
    a: { roomNumber: '204', groupId: 'g1', doors: [{ col: 1, row: 1, side: 'bottom' }] }, A: { roomNumber: null, groupId: 'g1' },
    B: { roomNumber: '116' },
  })], crossFloorPairs: [] },
  // a grouped room whose anchor touches no corridor; a non-anchor cell does
  grouped: { floors: [floor('f1', ['aA.', 'AAH', '..H', 'BHH'], {
    a: { roomNumber: '204', groupId: 'g2' }, A: { roomNumber: null, groupId: 'g2' }, B: { roomNumber: '116' },
  })], crossFloorPairs: [] },
  // two floors, a real pair and a pair naming a hallway cell (skipped)
  floors: { floors: [
    floor('f1', ['AHHHS', '....H', 'BHHHH'], { A: { roomNumber: '204' }, B: { roomNumber: '116' } }),
    floor('f2', ['SHHHC', 'H....', 'HHHHD'], { C: { roomNumber: '301' }, D: { roomNumber: '302' } }),
  ], crossFloorPairs: [pair('f1', 4, 0, 'f2', 0, 0), pair('f1', 1, 0, 'f2', 1, 0)] },
  // a same-floor pair that shortcuts a long corridor (the admissibility case),
  // and a third classroom sitting on the straight line between two rooms
  shortcut: { floors: [floor('f1', [
    'AS.......SB',
    'H.........H',
    'HHHHHCHHHHH',
  ], { A: { roomNumber: '204' }, B: { roomNumber: '116' }, C: { roomNumber: '999' } })], crossFloorPairs: [pair('f1', 1, 0, 'f1', 9, 0)] },
  // a room walled off from every corridor, and two disconnected corridors
  islands: { floors: [floor('f1', ['A.HHB', '.....', 'CHH.D'], {
    A: { roomNumber: 'LONE' }, B: { roomNumber: '116' }, C: { roomNumber: '204' }, D: { roomNumber: '301' },
  })], crossFloorPairs: [] },
  northwind: null,
};

/** The rooms a case routes between: all of them, but Northwind's first six. */
const roomsOf = (name, g) => [...g.roomToKey.keys()].sort().slice(0, name === 'northwind' ? 6 : undefined);

/** Each case: { name, run(m) } where m is the module's surface. */
export const CASES = [
  ...Object.keys(BLUEPRINTS).map(name => ({ name: `buildGraph ${name}`, run: (m) => ser(m.buildGraph(BLUEPRINTS[name] || northwind())) })),
  { name: 'buildLocalFloorGraph cross', run: (m) => { const f = BLUEPRINTS.cross.floors[0]; const g = m.buildLocalFloorGraph(f.gridData, f.gridCols, f.gridRows);
    return { adjacency: [...g.adjacency], types: [...g.types], roomToKey: [...g.roomToKey] }; } },
  { name: 'key helpers', run: (m) => [m.cellKey(3, 4), m.floorCellKey('f2', 0, 7), m.parseKey('5,6'), m.parseKey('floor_1:12,0'), m.parseKey('a:b:1,2')] },
  { name: 'astar and heuristic', run: (m) => {
    const out = [];
    for (const name of Object.keys(BLUEPRINTS)) {
      const g = m.buildGraph(BLUEPRINTS[name] || northwind());
      const rooms = roomsOf(name, g);
      for (const a of rooms) for (const b of rooms) {
        const ka = g.roomToKey.get(a), kb = g.roomToKey.get(b);
        const h = m.buildHeuristic(g, kb);
        out.push([name, a, b, m.astar(g, ka, kb), h(ka)]);
      }
      out.push([name, 'unknown', m.astar(g, 'nope', [...g.roomToKey.values()][0] || 'x')]);
    }
    return out;
  } },
  { name: 'resolveRoomPath and findPath', run: (m) => {
    const out = [];
    for (const name of Object.keys(BLUEPRINTS)) {
      const bp = BLUEPRINTS[name] || northwind();
      const g = m.buildGraph(bp);
      const rooms = roomsOf(name, g);
      const pairs = rooms.flatMap(a => rooms.map(b => [a, b]))
        .concat([[rooms[0], ''], ['', rooms[0]], ['  ', rooms[0]], [rooms[0], 'NOPE'], ['NOPE', rooms[0]]]);
      for (const [a, b] of pairs) out.push([name, a, b, m.resolveRoomPath(g, a, b, bp.crossFloorPairs), m.findPath(g, a, b)]);
      out.push([name, 'null', m.resolveRoomPath(g, null, undefined, bp.crossFloorPairs), m.resolveRoomPath(g, ' 116 ', '204', bp.crossFloorPairs)]);
    }
    return out;
  } },
];
