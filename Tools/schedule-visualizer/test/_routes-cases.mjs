// The inputs routes.test.mjs runs through sv-routes.js. routes-golden.json
// holds what 035's own functions (findGroupDayPath, computeCongestionMap,
// isCellHeatExcluded and the evacuation section) returned for each of them at
// v320, before Path 11 P2 increment 4 moved them. Every room and group is made
// up; the Northwind project is Tools/schedule/test's invented school. The
// graph each case routes on is built by sv-graph.js (graph.test.mjs holds it
// to v320), so m carries buildGraph beside the routes' surface.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { floor } from './_graph-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, '../../schedule/test/fixture-northwind.json'), 'utf8'));
const pair = (fa, ca, ra, fb, cb, rb) => ({ a: { floorId: fa, col: ca, row: ra }, b: { floorId: fb, col: cb, row: rb } });

/** Two floors: 204 and 116 on f1, 301 on f2; exits E (f1, by 116) and F (f2);
 *  a zone on f2 over the cell above f1's corridor junction; and the active-floor
 *  mirror (top-level heatExcludeZones) holding f1's zone. */
export function building() {
  const f1 = floor('f1', ['AHHHHS', 'H....H', 'HHHHBE'], { A: { roomNumber: '204' }, B: { roomNumber: '116' } });
  const f2 = floor('f2', ['SHHHHC', 'H.....', 'FHHHHH'], { C: { roomNumber: '301' } });
  f1.gridData[2][5] = { type: 'hallway', isExit: true, exitLabel: 'East doors', assemblyPoint: 'Field' };
  f2.gridData[2][0] = { type: 'hallway', isExit: true };
  f1.heatExcludeZones = [{ id: 'hz_1', col: 1, row: 2, cols: 2, rows: 1 }];
  f2.heatExcludeZones = [{ id: 'hz_2', col: 2, row: 0, cols: 2, rows: 1 }];
  f1.gridData[0][3] = { type: 'hallway', isExit: true, exitLabel: 'cut off' };  // in the graph: kept
  const off = floor('f3', ['H'], {});
  off.gridData[0][0] = { type: 'hallway', isExit: true, exitLabel: 'lone' };   // in the graph, unreachable
  return { floors: [f1, f2, off], crossFloorPairs: [pair('f1', 5, 0, 'f2', 0, 0)], heatExcludeZones: f1.heatExcludeZones };
}
export function northwind() {
  const bp = NW().blueprint;
  return {
    floors: bp.floors.map(f => {
      const gridData = Array.from({ length: f.gridRows }, () => Array.from({ length: f.gridCols }, () => null));
      for (const c of f.cells) gridData[c.row][c.col] = { ...c.tile };
      return { id: f.id, label: f.label, gridCols: f.gridCols, gridRows: f.gridRows, gridData, heatExcludeZones: f.heatExcludeZones || [] };
    }),
    crossFloorPairs: bp.crossFloorPairs, heatExcludeZones: (bp.floors[0] && bp.floors[0].heatExcludeZones) || [],
  };
}
const GROUPS = [
  { name: '7-1', modsA: ['204', '116', '301', '301'], modsB: ['301', '', '204', '116'], size: 22 },
  { name: '7-2', modsA: ['204', '301', 'NOPE', '116'], modsB: [], size: '' },
  { name: '7-3', mods: ['116', '204', '204', ''], size: '18' },
  { name: '7-4', modsA: ['301', '204'], modsB: ['116', '204', '301', '116'], size: 0 },
];
const SETTINGS = (over = {}) => ({ modCount: 4, modLabel: 'period', defaultGroupSize: 25, ...over });
const label = (id) => ({ f1: 'Ground', f2: 'Upper' })[id] || `Floor ${id}`;

export const CASES = [
  { name: 'isCellHeatExcluded', run: (m) => { const bp = building();
    return [[1, 2, 'f1'], [2, 2, 'f1'], [3, 2, 'f1'], [2, 0, 'f2'], [2, 0, 'f1'], [1, 2, undefined], [2, 0, undefined], [1, 2, 'nope']].map(([x, y, f]) => m.isCellHeatExcluded(bp, x, y, f)); } },
  { name: 'groupDayPath', run: (m) => { const bp = building(); const g = m.buildGraph(bp);
    return [SETTINGS(), SETTINGS({ modCount: 3, modLabel: 'block' }), SETTINGS({ modCount: 6 })].flatMap(s =>
      GROUPS.flatMap(gr => ['A', 'B', undefined].map(d => m.groupDayPath(gr, d, { graph: g, settings: s, pairs: bp.crossFloorPairs })))).concat([
      m.groupDayPath(undefined, 'A', { graph: g, settings: SETTINGS(), pairs: [] })]); } },
  { name: 'congestionMap', run: (m) => { const bp = building(); const g = m.buildGraph(bp);
    return [SETTINGS(), SETTINGS({ defaultGroupSize: 30 })].flatMap(s => ['A', 'B'].map(d =>
      [...m.congestionMap(GROUPS.map(x => x.name).concat(['missing']), d, { groups: GROUPS, graph: g, settings: s, blueprint: bp })])).concat([
      [...m.congestionMap('not an array', 'A', { groups: GROUPS, graph: g, settings: SETTINGS(), blueprint: bp })]]); } },
  { name: 'evacuation', run: (m) => {
    const out = [];
    for (const bp of [building(), northwind()]) {
      const g = m.buildGraph(bp);
      const exits = m.collectExitPoints(bp, g);
      out.push(exits);
      for (const [room, key] of [...g.roomToKey].sort()) {
        const r = m.computeEvacuationRouteForRoom(key, exits, g);
        out.push([room, r, r && m.buildEvacuationSteps(r.path, r.exit, g, label), r && m.evacPathCost(g, r.path)]);
      }
      out.push(m.computeEvacuationRouteForRoom('nowhere', exits, g), m.computeEvacuationRouteForRoom([...g.roomToKey.values()][0], [], g));
    }
    out.push([[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0], [2, 0]].map(([dx, dy]) => m.evacDirectionLabel(dx, dy)));
    return out;
  } },
];
