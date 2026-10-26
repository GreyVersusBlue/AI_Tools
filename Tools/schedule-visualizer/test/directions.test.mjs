// Path 11 P6 increment 2: a published copy's Directions tab routes on the
// published geometry, and must agree with 035's own pathfinder. Pure Node, no
// browser.
//
// sv-browser.js is imported with a stub `document` (its top level injects a
// stylesheet and wires two listeners) and window.SVGraph set to sv-graph.js,
// which is what 035's module script does. For every blueprint below, its
// geometry is published the way Publish does with "show directions" ticked
// (brBuildGeometrySnapshot, then brRouteGeometry), and then, for every
// ordered pair of rooms, ordinary and step-free:
//   - the published route (brDirRoute) exists exactly when sv-graph.js's A*
//     finds one, and costs the same (cost, not cells: with a 0-cost pair two
//     cheapest routes can differ in cells, and A* breaks the tie its own way);
//   - every move of the published route is an edge of 035's graph, so the
//     line drawn on the map is a walk 035 would allow;
//   - brDirSteps, on 035's own path, says what sv-routes.js routeSteps()
//     says (the published file's words are 035's).
// The blueprints are graph.test.mjs's (a dummy tile as a wall, a doorway on
// one cell of a grouped room, a non-anchor cell on the corridor, two floors
// and a pair naming a hallway, a same-floor shortcut pair, a walled-off room)
// and Northwind, and a two-floor building with stairs, an elevator and a ramp
// in the step-free variants step-free.test.mjs uses: the elevator out of
// service, its own wait, a step in a hallway, a step at a door.
// Then the published data meets the contract with the new fields, the
// default publish carries none of them, and four breaks on purpose of the
// published geometry are each caught by the comparison above.
import * as G from '../sv-graph.js';
import * as R from '../sv-routes.js';
import { BLUEPRINTS, floor } from './_graph-cases.mjs';
import { validate } from './published-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
globalThis.document = {
  createElement: () => ({}), head: { appendChild() {} }, addEventListener() {},
  getElementById: () => null, querySelector: () => null,
};
globalThis.window = { SVGraph: G };
const B = await import('../sv-browser.js');

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

function northwind() {
  const bp = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-northwind.json'), 'utf8')).blueprint;
  return {
    floors: bp.floors.map(f => {
      const gridData = Array.from({ length: f.gridRows }, () => Array.from({ length: f.gridCols }, () => null));
      for (const c of f.cells) gridData[c.row][c.col] = { ...c.tile };
      return { id: f.id, label: f.label, gridCols: f.gridCols, gridRows: f.gridRows, gridData };
    }),
    crossFloorPairs: bp.crossFloorPairs,
  };
}

/* step-free.test.mjs's building: stairs at column 1, an elevator at 4, a ramp at 12. */
const pair = (col, extra = {}) => ({ a: { floorId: 'f1', col, row: 0 }, b: { floorId: 'f2', col, row: 0 }, ...extra });
function building({ elevator = { access: 'elevator' }, ramp = { access: 'ramp' } } = {}) {
  return {
    floors: [
      floor('f1', ['.S..S.......S', 'AHHHHHHHHHHHH', '..H..........', '............W'], { A: { roomNumber: '204' }, W: { roomNumber: 'W' } }),
      floor('f2', ['ZS..S.......S', 'CHHHHHHHHHHHH', '.D...........'], { Z: { roomNumber: 'Z' }, C: { roomNumber: '301' }, D: { roomNumber: '302' } }),
    ],
    crossFloorPairs: [pair(1), ...(elevator ? [pair(4, elevator)] : []), ...(ramp ? [pair(12, ramp)] : [])],
  };
}
const SETTINGS = { elevatorWait: 6 };

const CASES = Object.keys(BLUEPRINTS).map(name => [name, BLUEPRINTS[name] || northwind()]);
CASES.push(['building', building()]);
CASES.push(['building, stairs only', building({ elevator: null, ramp: null })]);
CASES.push(['building, elevator out of service', building({ elevator: { access: 'elevator', outOfService: true }, ramp: null })]);
CASES.push(['building, elevator wait 3', building({ elevator: { access: 'elevator', wait: 3 }, ramp: null })]);
{
  const bp = building({ ramp: null });
  bp.floors[0].gridData[1][3] = { type: 'hallway', step: true };
  CASES.push(['building, a step in the floor 1 hallway', bp]);
}
{
  const bp = building({ elevator: null });
  bp.floors[1].gridData[1][0] = { type: 'classroom', roomNumber: '301', doors: [{ col: 0, row: 1, side: 'right', stepFree: false }] };
  CASES.push(['building, a step at 301\'s door', bp]);
}

/** sv-graph.js's key ("floorId:x,y") as brDirGraph's ("floorIndex:x,y"), and back. */
const toPub = (bp, k) => { const p = G.parseKey(k); return bp.floors.findIndex(f => String(f.id) === String(p.floorId)) + ':' + p.x + ',' + p.y; };
const toGraph = (bp, k) => { const m = /^(\d+):(-?\d+),(-?\d+)$/.exec(k); return G.floorCellKey(bp.floors[+m[1]].id, +m[2], +m[3]); };
const edgeCost = (graph, a, b) => { const e = (graph.adjacency.get(a) || []).find(x => x.key === b); return e ? e.cost : null; };

/** Every disagreement between the published routes on `geom` and 035's graph, as strings. */
function compare(bp, geom, stepFree) {
  const graph = G.buildGraph(bp, stepFree ? { stepFree: true, elevatorWait: G.settingsElevatorWait(SETTINGS) } : {});
  const rooms = [...graph.roomToKey.keys()].sort();
  const label = id => (bp.floors.find(f => String(f.id) === String(id)) || {}).label;
  const bad = [];
  let routes = 0;
  for (const a of rooms) for (const b of rooms) {
    if (a === b) { if (!B.brDirRoute(geom, a, b, stepFree).same) bad.push(`${a}→${b}: not the same room`); continue; }
    const keys = G.astar(graph, graph.roomToKey.get(a), graph.roomToKey.get(b));
    const pub = B.brDirRoute(geom, a, b, stepFree);
    if (!keys) { if (!pub.error) bad.push(`${a}→${b}: 035 finds no route, the copy does`); continue; }
    if (pub.error) { bad.push(`${a}→${b}: the copy says "${pub.error}"`); continue; }
    routes++;
    let want = 0;
    for (let i = 1; i < keys.length; i++) want += edgeCost(graph, keys[i - 1], keys[i]);
    if (pub.cost !== want) bad.push(`${a}→${b}: costs ${pub.cost}, 035's ${want}`);
    const gk = pub.path.map(k => toGraph(bp, k));
    let walk = gk[0] === graph.roomToKey.get(a) && gk[gk.length - 1] === graph.roomToKey.get(b), sum = 0;
    for (let i = 1; i < gk.length && walk; i++) { const c = edgeCost(graph, gk[i - 1], gk[i]); if (c === null) walk = false; else sum += c; }
    if (!walk || sum !== pub.cost) bad.push(`${a}→${b}: the copy's line is not a walk in 035's graph`);
    const g = B.brDirGraph(geom, stepFree);
    const said = B.brDirSteps(g, keys.map(k => toPub(bp, k))).join(' ');
    const want035 = R.routeSteps(keys, graph, label).join(' ');
    if (said !== want035) bad.push(`${a}→${b}: says "${said}", 035 "${want035}"`);
  }
  return { bad, routes, rooms: rooms.length };
}

const routed = bp => B.brRouteGeometry(B.brBuildGeometrySnapshot(bp), bp, SETTINGS);

for (const [name, bp] of CASES) {
  const geom = routed(bp);
  for (const sf of [false, true]) {
    const r = compare(bp, geom, sf);
    check(r.bad.length === 0, `${name}${sf ? ', step-free' : ''}: ${r.rooms} rooms, ${r.routes} routes agree with sv-graph.js`
      + (r.bad.length ? '\n         ' + r.bad.slice(0, 4).join('\n         ') : ''));
  }
}

/* The cases reach what they are meant to. */
{
  const geom = routed(building());
  const plain = B.brDirRoute(geom, '204', '301', false), sf = B.brDirRoute(geom, '204', '301', true);
  check(plain.steps.join(' ') === 'Head east 1 tile. Head north 1 tile. Take the stairs to f2. Head south 1 tile. Head west 1 tile. Arrive at room 301.',
    'building: the ordinary route takes the stairs: ' + plain.steps.join(' '));
  check(sf.cost === 10 + 6 && sf.steps.includes('Take the elevator to f2.'), 'step-free takes the elevator and costs Settings\' wait (6): ' + sf.cost);
  const off = routed(building({ elevator: { access: 'elevator', outOfService: true }, ramp: null }));
  check(B.brDirRoute(off, '204', '301', true).error === 'No step-free route between these rooms'
    && off.links.length === 1, 'an elevator out of service is not published, and step-free says so plainly');
  const lone = B.brDirRoute(routed(BLUEPRINTS.islands), 'LONE', '116', false);
  check(lone.error === 'No route between these rooms on this map', 'a walled-off room has no route: ' + lone.error);
  check(B.brDirRoute(geom, '204', 'NOPE', false).error === 'This map does not show the way into that room', 'an unknown room is said plainly');
  check(B.brDirRoute(B.brBuildGeometrySnapshot(building()), '204', '301', false).error === 'This file has no directions',
    'geometry without links (a copy published with the box off) has no directions');
}

/* What is published. */
{
  const bp = northwind();
  const plain = B.brBuildGeometrySnapshot(bp);
  const geom = routed(bp);
  check(!('links' in plain) && plain.floors.every(f => !('steps' in f) && f.rooms.every(r => !('door' in r) && !('doors' in r))),
    'the snapshot Publish writes with the box off carries none of the new fields');
  check(geom.links.length === 1 && geom.links[0].access === 'stairs' && JSON.stringify(geom.links[0].a) === '["floor_0",0,4]',
    'Northwind publishes its one pair as stairs: ' + JSON.stringify(geom.links));
  const named = geom.floors.flatMap(f => f.rooms.filter(r => r.rn));
  check(named.length > 0 && named.every(r => Array.isArray(r.door) && r.doors.length > 0), `every Northwind room has a door cell and a corridor cell (${named.length} rooms)`);
  const data = { school: 'Northwind Middle', publishedOn: '2026-01-15', dept: {}, order: {}, teachers: {}, sections: {}, room2teacher: {},
    groupRooms: {}, modCount: 4, modLabel: 'block', bell: null, geometry: geom, format: 1, tool: 'v62' };
  const v = validate(data);
  check(v.ok, 'the routed geometry meets the contract: ' + JSON.stringify(v.errors.slice(0, 3)));
  const sb = routed(building());
  sb.floors[0].steps = [[2, 2]];
  sb.floors[1].rooms[0].doors.push([1, 1, 1]);
  check(validate({ ...data, geometry: sb }).ok, 'and so does the building with steps and a step at a door');
  const broken = JSON.parse(JSON.stringify(sb));
  broken.links[0].a = ['f9', 1, 0];
  broken.links[1].access = 'escalator';
  broken.floors[0].rooms[0].door = [9, 9];
  broken.floors[0].rooms[0].doors.push([0, 3]);
  broken.floors[0].steps = [[1, 0]];
  const e = validate({ ...data, geometry: broken }).errors.map(x => x.path).sort();
  check(JSON.stringify(e) === JSON.stringify(['geometry.floors[0].rooms[0].door', 'geometry.floors[0].rooms[0].doors[1]', 'geometry.floors[0].steps[0]', 'geometry.links[0].a', 'geometry.links[1].access']),
    'the contract names each broken field: ' + JSON.stringify(e));
}

/* Broken on purpose: each change to the published geometry is caught by compare(). */
{
  const breaks = [
    ['a pair dropped', building(), g => { g.links.splice(1, 1); }, true],
    ['the elevator\'s wait doubled', building(), g => { g.links[1].wait = 12; }, true],
    ['a door cell moved off the corridor', building(), g => { const r = g.floors[1].rooms.find(x => x.rn === '301'); r.doors = [[1, 0]]; }, false],
    ['the ramp published as stairs', building({ elevator: null }), g => { g.links[1].access = 'stairs'; }, true],
  ];
  for (const [label, bp, edit, sf] of breaks) {
    const g = JSON.parse(JSON.stringify(routed(bp)));
    edit(g);
    check(compare(bp, g, sf).bad.length > 0, `a break is caught: ${label}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
