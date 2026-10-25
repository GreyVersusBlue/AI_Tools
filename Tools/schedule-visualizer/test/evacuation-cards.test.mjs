// Path 11 P4 increment 1: the evacuation cards' content, sv-routes.js's
// exitDoors(), pathInGraph() and evacuationCards(). Pure Node, no browser;
// the layout and the print preview are smoke-evacuation.mjs's.
//
// One invented two-floor building, drawn below. Floor 1's corridor runs
// along row 1 from the West door (two exit tiles, one above the other: one
// double door) to the East door, with a Side door below it at column 8; room
// 101 sits at the west end, 102 at the east end, and W is walled off. Floor 2's
// room 201 reaches floor 1 only by the pair at column 9, stairs unless a case
// says otherwise. Each case changes one thing and says what a card must say,
// and every rule was broken on purpose before it was trusted (each block's
// header says how).
import * as R from '../sv-routes.js';
import * as G from '../sv-graph.js';

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

const EXITS = { w: ['West door', 'Front lawn'], v: ['', ''], e: ['East door', 'Bus loop'], z: ['Side door', ''] };
/** '.' empty, 'H' hallway, 'S' staircase, a key of EXITS an exit, anything else a room of that number. */
function floor(id, label, rows, names = {}) {
  const gridRows = rows.length, gridCols = Math.max(...rows.map(r => r.length));
  const gridData = Array.from({ length: gridRows }, (_, y) => Array.from({ length: gridCols }, (_, x) => {
    const ch = rows[y][x] || '.';
    if (ch === '.') return null;
    if (ch === 'H') return { type: 'hallway' };
    if (ch === 'S') return { type: 'staircase' };
    if (EXITS[ch]) return { type: 'hallway', isExit: true, exitLabel: EXITS[ch][0], assemblyPoint: EXITS[ch][1] };
    return { type: 'classroom', roomNumber: names[ch] || ch };
  }));
  return { id, label, gridCols, gridRows, gridData };
}
function building({ pair = {}, exits = true, lift = false } = {}) {
  const extra = lift ? [{ a: { floorId: 'f1', col: 4, row: 0 }, b: { floorId: 'f2', col: 4, row: 0 }, access: 'elevator' }] : [];
  return {
    floors: [
      floor('f1', 'Floor 1', [lift ? '.A..S..B.S.' : '.A.....B.S.', exits ? 'wHHHHHHHHHe' : 'HHHHHHHHHHH', exits ? 'v.......z..' : '...........', '..........Q'],
        { A: '101', B: '102', Q: 'W' }),
      floor('f2', 'Floor 2', [lift ? '.C..S....S.' : '.C.......S.', '.HHHHHHHHH.'], { C: '201' }),
    ],
    crossFloorPairs: [{ a: { floorId: 'f1', col: 9, row: 0 }, b: { floorId: 'f2', col: 9, row: 0 }, ...pair }, ...extra],
  };
}
const NAMES = { f1: 'Floor 1', f2: 'Floor 2' };
const cardsOf = bp => R.evacuationCards({ blueprint: bp, floorLabel: id => NAMES[id] || id });
const card = (data, room) => data.cards.find(c => c.room === room);
const tile = (bp, f, col, row) => bp.floors[f].gridData[row][col];

/* -- Doors. (Broken on purpose: joining on touch alone left two "Main"
      tiles far apart as two doors; joining without the floor test merged
      tiles on different floors.) -- */
{
  const e = (floorId, col, row, label = '', assemblyPoint = '') => ({ key: `${floorId}:${col},${row}`, floorId, col, row, label, assemblyPoint });
  const doors = R.exitDoors([e('f1', 0, 1, '', ''), e('f1', 0, 2, 'West door', 'Front lawn'), e('f1', 9, 1, 'Main'), e('f1', 1, 1, '', '', ), e('f2', 0, 1),
    e('f1', 20, 5, 'Main', 'Car park')]);
  check(doors.length === 3, `touching tiles on one floor and tiles with one name are one door (${doors.length} doors)`);
  check(doors[0].exits.length === 3 && doors[0].label === 'West door' && doors[0].assemblyPoint === 'Front lawn',
    "a door's name and assembly point are its first typed ones, from any of its tiles");
  check(doors[1].label === 'Main' && doors[1].exits.length === 2 && doors[1].assemblyPoint === 'Car park', 'two far-apart tiles named alike are one door');
  check(doors[2].exits.length === 1 && doors[2].exits[0].floorId === 'f2', 'a tile at the same column and row on another floor is another door');
  check(R.exitDoors([]).length === 0, 'no exits, no doors');
}

/* -- A room on the ground floor. (Broken on purpose: one door per exit
      tile gave room 101 the other half of the West double door as its
      "second way out".) -- */
{
  const data = cardsOf(building());
  check(data.exitCount === 4 && data.doorCount === 3, `four exit tiles are three doors (${data.exitCount}, ${data.doorCount})`);
  const c = card(data, '101');
  check(c.status === 'route' && c.first.exitLabel === 'West door' && c.first.assemblyPoint === 'Front lawn', 'room 101: first way out is the West door, to the Front lawn');
  check(c.second && c.second.exitLabel === 'Side door' && c.second.assemblyPoint === '', 'room 101: the second way out is another door (Side), its assembly point not entered');
  check(c.first.steps[c.first.steps.length - 1] === 'Exit at West door.' && c.first.steps.length >= 2, 'each way out ends at its door by name');
  check(!c.first.crossesFloor && c.first.floors.join() === 'Floor 1', 'a ground-floor route stays on its floor');
  check(c.stepFree && c.stepFree.same === 'first', 'with no stairs on it, the first way out is the step-free one');
  const d = card(data, '102');
  check(d.first.exitLabel === 'Side door' && d.second.exitLabel === 'East door', 'room 102: the nearer Side door first, East second');
}

/* -- The order of the cards, and a room nothing reaches. (Broken on
      purpose: leaving out the floor order put 201 before W.) -- */
{
  const data = cardsOf(building());
  check(data.cards.map(c => c.room).join() === '101,102,W,201', `floor order, then room number (${data.cards.map(c => c.room).join()})`);
  const w = card(data, 'W');
  check(w.status === 'none' && !w.first && !w.second && !w.stepFree, 'a walled-off room is "none", with no route of any kind');
}

/* -- Upstairs, by stairs. -- */
{
  const c = card(cardsOf(building()), '201');
  check(c.status === 'route' && c.first.crossesFloor && c.first.floors.join(' > ') === 'Floor 2 > Floor 1', 'room 201 goes down to Floor 1, and the card knows the floors in order');
  check(c.first.steps.includes('Take the stairs to Floor 1.'), 'the steps name the stairs and the floor they lead to');
  check(c.stepFree === null, 'only stairs lead down: no step-free way out, said as null (never a fallback)');
}

/* -- An elevator is never on a card. (Broken on purpose: dropping the
      `evacuation` option from the ordinary graph routed 201 down the
      elevator in the first case; from the step-free graph, gave 201 a
      step-free way out by elevator in the second.) -- */
{
  const c = card(cardsOf(building({ pair: { access: 'elevator' } })), '201');
  check(c.status === 'none', 'with only an elevator down, room 201 has no way out on its card at all');
  const d = card(cardsOf(building({ lift: true })), '201');
  check(d.status === 'route' && d.first.steps.includes('Take the stairs to Floor 1.') && !d.first.steps.some(s => /elevator/.test(s)),
    'with stairs and an elevator, the way out takes the stairs');
  check(d.stepFree === null, 'and the elevator is no step-free way out');
}

/* -- A ramp. -- */
{
  const c = card(cardsOf(building({ pair: { access: 'ramp' } })), '201');
  check(c.first.steps.includes('Take the ramp to Floor 1.') && c.stepFree && c.stepFree.same === 'first', 'down a ramp: the first way out is step-free');
}

/* -- The second way out is the step-free one. (Broken on purpose: checking
      only the first way out gave room 101 a separate step-free route to the
      Side door that was the second way out word for word.) -- */
{
  const bp = building();
  tile(bp, 0, 0, 1).step = true; tile(bp, 0, 0, 2).step = true;   // the West double door has a step
  const c = card(cardsOf(bp), '101');
  check(c.first.exitLabel === 'West door', 'a step does not change the ordinary way out');
  check(c.stepFree && c.stepFree.same === 'second', 'the Side door way out has no step: it is the step-free one, not printed twice');
}

/* -- A step-free way of its own. (Broken on purpose: taking the second way
      out as step-free without checking its path kept the Side door here,
      step and all.) -- */
{
  const bp = building();
  tile(bp, 0, 0, 1).step = true; tile(bp, 0, 0, 2).step = true; tile(bp, 0, 8, 2).step = true;
  const c = card(cardsOf(bp), '101');
  check(c.stepFree && c.stepFree.route && c.stepFree.route.exitLabel === 'East door' && c.stepFree.route.assemblyPoint === 'Bus loop',
    'West and Side both have a step: the step-free way out is its own route, to the East door and the Bus loop');
  check(c.stepFree.route.steps[c.stepFree.route.steps.length - 1] === 'Exit at East door.', 'it ends at its door by name');
  const g = G.buildGraph(bp, { evacuation: true, stepFree: true });
  check(R.pathInGraph(g, c.stepFree.route.path) && !R.pathInGraph(g, c.first.path), 'pathInGraph: the step-free route is on the step-free graph, the first is not');
}

/* -- A step at the room's door cuts every step-free way. -- */
{
  const bp = building();
  tile(bp, 0, 1, 0).doors = [{ side: 'bottom', col: 1, row: 0, stepFree: false }];
  const c = card(cardsOf(bp), '101');
  check(c.status === 'route' && c.stepFree === null, 'room 101 with a step at its door: the ordinary ways out stay, no step-free way out');
}

/* -- Nothing marked. -- */
{
  const data = cardsOf(building({ exits: false }));
  check(data.exitCount === 0 && data.cards.length === 0, 'no exterior exit marked: no cards, nothing guessed');
}

/* -- pathInGraph edges. -- */
{
  const g = G.buildGraph(building());
  check(!R.pathInGraph(g, []) && !R.pathInGraph(g, null) && !R.pathInGraph(g, ['f1:0,0']), 'an empty path, or one off the graph, is not a route');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
