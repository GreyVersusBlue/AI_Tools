// Path 11 P3 increment 1: step-free routing in sv-graph.js and the step-free
// report in sv-routes.js. Pure Node, no browser.
//
// One invented two-floor building, drawn below, joined by three pairs: stairs
// at column 1 (pair A), an elevator at column 4 (B) and a ramp at column 12
// (C). Room 204 is beside the exit on floor 1; W is walled off; on floor 2,
// 301 and 302 sit on the corridor and Z is reached only across the stair
// tile. Each case changes one thing about that building and says what a
// wheelchair user's route must do, and every one of them was broken on purpose
// before it was trusted (the header of each block says how).
import * as G from '../sv-graph.js';
import * as R from '../sv-routes.js';

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

/** '.' empty, 'H' hallway, 'E' hallway marked as an exit, 'S' staircase, anything else a room of that number. */
function floor(id, rows, names = {}) {
  const gridRows = rows.length, gridCols = Math.max(...rows.map(r => r.length));
  const gridData = Array.from({ length: gridRows }, (_, y) => Array.from({ length: gridCols }, (_, x) => {
    const ch = rows[y][x] || '.';
    if (ch === '.') return null;
    if (ch === 'H') return { type: 'hallway' };
    if (ch === 'E') return { type: 'hallway', isExit: true, exitLabel: 'Front door' };
    if (ch === 'S') return { type: 'staircase' };
    return { type: 'classroom', roomNumber: names[ch] || ch };
  }));
  return { id, label: id === 'f1' ? 'Floor 1' : 'Floor 2', gridCols, gridRows, gridData };
}
const pair = (col, extra = {}) => ({ a: { floorId: 'f1', col, row: 0 }, b: { floorId: 'f2', col, row: 0 }, ...extra });

function building({ stairs = {}, elevator = { access: 'elevator' }, ramp = { access: 'ramp' }, exit = true } = {}) {
  return {
    floors: [
      floor('f1', ['.S..S.......S', 'AHHHHHHHHHHHH', exit ? '..E..........' : '..H..........', '............W'], { A: '204' }),
      floor('f2', ['ZS..S.......S', 'CHHHHHHHHHHHH', '.D...........'], { C: '301', D: '302' }),
    ],
    crossFloorPairs: [pair(1, stairs), ...(elevator ? [pair(4, elevator)] : []), ...(ramp ? [pair(12, ramp)] : [])],
  };
}
const route = (bp, from, to, opts) => G.resolveRoomPath(G.buildGraph(bp, opts), from, to, bp.crossFloorPairs);
const SF = { stepFree: true };

/* -- What a pair is. (Broken on purpose: pairAccess returning the raw field
      let 'escalator' through as a kind of its own.) -- */
check(G.pairAccess({ access: 'elevator' }) === 'elevator' && G.pairAccess({ access: 'ramp' }) === 'ramp', 'elevator and ramp are read off the pair');
check(G.pairAccess({}) === 'stairs' && G.pairAccess({ access: 'escalator' }) === 'stairs' && G.pairAccess(null) === 'stairs', 'anything else, or nothing, is stairs');
check(!G.pairInService({ access: 'elevator', outOfService: true }) && G.pairInService({ access: 'ramp', outOfService: true }) && G.pairInService({ access: 'elevator' }),
  'only an elevator can be out of service');
check(G.elevatorWait({ wait: 3 }) === 3 && G.elevatorWait({ wait: -1 }) === G.ELEVATOR_WAIT && G.elevatorWait({ wait: '5' }) === G.ELEVATOR_WAIT && G.elevatorWait({}, 7) === 7,
  "an elevator's own wait is used only when it is a sane number");

/* -- The only way up is stairs. (Broken on purpose: keeping the stairs
      pair's teleport and its tiles in the step-free graph made this a 6-cell
      route. Either rule alone stops it; the tile rule is the one tested
      below.) -- */
{
  const bp = building({ elevator: null, ramp: null });
  const plain = route(bp, '204', '301');
  check(!plain.error && plain.pathLength === 6 && plain.staircasePairsUsed.join() === 'A', 'the ordinary route takes the stairs, 6 cells');
  check(!('stepFree' in plain) && !('pathCost' in plain), 'the ordinary route carries none of the step-free fields');
  const sf = route(bp, '204', '301', SF);
  check(sf.error === G.STEP_FREE_NONE && sf.severity === 'error' && sf.stepFree === true && !sf.path,
    'step-free: said plainly, as an error, with no route at all (never a fallback to the stairs)');
  check(route(bp, '204', '204', SF).noTravel === true, 'staying in the same room is still no travel');
}

/* -- An elevator. (Broken on purpose: a 0-cost elevator gave pathCost 20.) -- */
{
  const bp = building({ ramp: null });
  const sf = route(bp, '204', '301', SF);
  check(!sf.error && sf.pathLength === 12, 'step-free goes past the stairs to the elevator: 12 cells');
  check(sf.pathCost === 10 + G.ELEVATOR_WAIT, `the elevator costs its wait: 10 steps + ${G.ELEVATOR_WAIT}`);
  check(JSON.stringify(sf.connectorsUsed) === '[{"label":"B","access":"elevator"}]' && sf.staircasePairsUsed.join() === 'B',
    'the route names the elevator it used, by its pair letter');
  check(route(bp, '204', '301', { stepFree: true, elevatorWait: 0 }).pathCost === 10, 'elevatorWait replaces the default');
  bp.crossFloorPairs[1].wait = 3;
  check(route(bp, '204', '301', SF).pathCost === 13, "a pair's own wait wins over the default");
  check(route(bp, '204', '301').staircasePairsUsed.join() === 'A', 'the ordinary route still takes the nearer stairs');
}

/* -- The elevator is out of service. (Broken on purpose: ignoring
      outOfService routed through it.) -- */
{
  const bp = building({ elevator: { access: 'elevator', outOfService: true }, ramp: null });
  check(route(bp, '204', '301', SF).error === G.STEP_FREE_NONE, 'step-free: no route while the only elevator is out');
  const plain = route(bp, '204', '301');
  check(!plain.error && plain.staircasePairsUsed.join() === 'A', 'the ordinary route is untouched: it takes the stairs');
  const g = G.buildGraph(bp);
  check(g.portalCount === 1, 'an elevator out of service joins nothing even in the ordinary graph');
}

/* -- A ramp, and the wait deciding between it and the elevator. (Broken on
      purpose: charging the ramp a wait too picked the elevator at wait 20.) -- */
{
  const bp = building();
  const near = route(bp, '204', '301', SF);
  check(near.connectorsUsed[0].access === 'elevator' && near.pathCost === 20, 'wait 10: the near elevator (cost 20) beats the far ramp (cost 26)');
  const far = route(bp, '204', '301', { stepFree: true, elevatorWait: 20 });
  check(far.connectorsUsed[0].access === 'ramp' && far.pathCost === 26 && far.pathLength === 28, 'wait 20: the ramp (cost 26) beats the elevator (cost 30)');
  const rampOnly = route(building({ elevator: null }), '204', '301', SF);
  check(rampOnly.connectorsUsed[0].access === 'ramp' && rampOnly.pathCost === 26, 'a ramp costs nothing to cross');
}

/* -- Stair tiles are steps. (Broken on purpose: keeping a stair tile
      walkable let Z be reached step-free across it.) -- */
{
  const bp = building();
  const g = G.buildGraph(bp, SF);
  check(g.stepFree === true && g.steps.has('f1:1,0') && g.steps.has('f2:1,0') && !g.steps.has('f1:4,0') && !g.steps.has('f2:12,0'),
    'the stairs pair\'s tiles are steps; the elevator and ramp tiles are not');
  check(!g.isWalkable('f1:1,0') && g.isWalkable('f1:4,0'), 'a step tile is not walkable');
  check(route(bp, '301', 'Z').staircasePairsUsed.length === 0 && !route(bp, '301', 'Z').error, 'Z is reached on foot across the stair tile');
  check(route(bp, '301', 'Z', SF).error === G.STEP_FREE_NONE, 'step-free: Z, whose only way in is across a stair tile, has no route');
  check(route(bp, '204', 'W', SF).error === 'Room unreachable — not connected to any hallway',
    'a walled-off room keeps its own message: it is a blueprint problem, not a stairs one');
  const before = G.buildGraph({ floors: bp.floors, crossFloorPairs: bp.crossFloorPairs.map(p => ({ a: p.a, b: p.b })) });
  const after = G.buildGraph(bp);
  check(JSON.stringify([...before.adjacency].map(([k, es]) => [k, es.map(e => [e.key, e.cost, !!e.teleport])])) ===
        JSON.stringify([...after.adjacency].map(([k, es]) => [k, es.map(e => [e.key, e.cost, !!e.teleport])])) && !('stepFree' in after),
    'marking pairs changes nothing about the ordinary graph but the access names on their edges');
}

/* -- Turn-by-turn wording. (Broken on purpose: the old "Take the stairs" for every teleport.) -- */
{
  const bp = building({ ramp: null });
  const g = G.buildGraph(bp, SF);
  const exits = R.collectExitPoints(bp, g);
  const res = R.computeEvacuationRouteForRoom(g.roomToKey.get('301'), exits, g);
  const steps = R.buildEvacuationSteps(res.path, res.exit, g, (id) => id === 'f1' ? 'Floor 1' : 'Floor 2');
  check(steps.includes('Take the elevator to Floor 1.') && !steps.some(s => /stairs/.test(s)), 'a step-free evacuation card says "Take the elevator"');
  const gp = G.buildGraph(bp);
  const res2 = R.computeEvacuationRouteForRoom(gp.roomToKey.get('301'), R.collectExitPoints(bp, gp), gp);
  check(R.buildEvacuationSteps(res2.path, res2.exit, gp, () => 'Floor 1').includes('Take the stairs to Floor 1.'), 'the ordinary card still says "Take the stairs"');
}

/* -- The report. (Broken on purpose: judging rooms against the ordinary
      graph reported Z step-free; with no exits, reporting every room
      step-free.) -- */
{
  const settings = { modCount: 3, modLabel: 'mod' };
  const groups = [{ name: 'Wheelchair group', modsA: ['204', '301', 'Z'] }, { name: 'Stays put', modsA: ['204', '204', '204'] }];
  const rep = R.stepFreeReport({ blueprint: building(), groups, settings });
  const st = Object.fromEntries(rep.rooms.map(r => [r.room, r.status]));
  check(rep.exitCount === 1, 'one exit is marked');
  check(st['204'] === 'step-free' && st['301'] === 'step-free' && st['302'] === 'step-free', 'rooms the elevator or ramp reaches are step-free');
  check(st.Z === 'stairs-only', 'Z, reached only across a stair tile, is stairs-only');
  check(st.W === 'unreachable', 'W, walled off, is unreachable, not stairs-only');
  check(JSON.stringify(rep.counts) === '{"stepFree":3,"stairsOnly":1,"unreachable":1,"unjudged":0}', 'the counts add up: ' + JSON.stringify(rep.counts));
  check(rep.rooms.map(r => r.room).join() === '204,W,301,302,Z', 'rooms are listed by floor, then by number');
  check(rep.movesChecked === 2 && rep.moves.length === 1 && rep.moves[0].fromRoom === '301' && rep.moves[0].toRoom === 'Z' && rep.moves[0].group === 'Wheelchair group',
    'the one move with no step-free route is listed, out of the two that travel');
  check(rep.connectors.map(c => c.label + ':' + c.access).join() === 'A:stairs,B:elevator,C:ramp', 'the connectors are listed with what they are');

  const out = R.stepFreeReport({ blueprint: building({ elevator: { access: 'elevator', outOfService: true }, ramp: null }), groups, settings });
  const st2 = Object.fromEntries(out.rooms.map(r => [r.room, r.status]));
  check(st2['301'] === 'stairs-only' && st2['302'] === 'stairs-only' && st2['204'] === 'step-free', 'with the elevator out, floor 2 is stairs-only');
  check(out.connectors[1].outOfService === true && out.moves.length === 2, 'the report names the elevator as out of service, and both moves fail');

  const blind = R.stepFreeReport({ blueprint: building({ exit: false }), groups, settings });
  check(blind.exitCount === 0 && blind.rooms.every(r => r.status === 'unjudged') && blind.counts.unjudged === 5,
    'with no exit marked, no room is judged (the report says so; it guesses no front door)');
  check(blind.moves.length === 1, 'moves are judged room to room, exits or not');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
