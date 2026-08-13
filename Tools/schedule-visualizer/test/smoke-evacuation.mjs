// smoke-evacuation.mjs — evacuation route planner / door cards for the
// School Layout Visualizer.
//
//   node Tools/schedule-visualizer/test/smoke-evacuation.mjs
//
// Not wired into package.json's `npm test` — this round's boundaries said
// not to touch package.json, so run it directly, or add
//   "test:evacuation": "node Tools/schedule-visualizer/test/smoke-evacuation.mjs"
// in a future round that's allowed to.
//
// Reuses the schedule suite's Northwind fixture. Marks one hallway tile on
// its ground-floor corridor as an exterior exit, then checks:
//   - collectExitPoints() finds it, with its label and assembly point
//   - computeEvacuationRouteForRoom() finds a real astar() path from a room
//     on the same floor to that exit
//   - buildEvacuationSteps() turns the path into readable turn-by-turn text
//     ending in "Exit at <label>"
//   - a room with NO reachable exit (nothing marked on its floor, no
//     staircase teleport to one that is) correctly comes back null instead
//     of throwing
//   - printEvacuationDoorCards() runs end-to-end (jsPDF build + save) with
//     zero console errors and zero offsite requests
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from '../../schedule/test/fixture-northwind.mjs';

const PORT = 8155;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 900 });

await page.context().addInitScript(() => {
  try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* storage blocked */ }
});

console.log('School Layout Visualizer — evacuation route planner');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. load the fixture, mark one hallway tile as an exterior exit ─────── */
await page.evaluate(project => { applyFullProject(project); }, fixtureProject());
await settle(page, 300);
const roomsNow = await page.evaluate(() => roomRegistry.length);
ok(roomsNow >= 10, `the fixture loaded (${roomsNow} rooms)`);

// Northwind's floor_0 corridor is hallway tiles at row 4, cols 1-14
// (staircases sit at col 0 and col 15) — see fixture-northwind.mjs.
await page.evaluate(() => {
  const floor = AppState.blueprint.floors.find(f => f.id === 'floor_0');
  const tile = floor.gridData[4][3];
  tile.isExit = true;
  tile.exitLabel = 'Door A';
  tile.assemblyPoint = 'Front lawn near flagpole';
});

/* ── 2. collectExitPoints() finds it ─────────────────────────────────────── */
const exits = await page.evaluate(() => window.collectExitPoints());
eq(exits.length, 1, 'exactly one marked exit is on the graph');
eq(exits[0]?.label, 'Door A', 'the exit carries its door label');
eq(exits[0]?.assemblyPoint, 'Front lawn near flagpole', 'the exit carries its assembly point');

/* ── 3. a same-floor room routes to it via astar() ───────────────────────── */
const route101 = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const exits = window.collectExitPoints();
  const roomKey = graph.roomToKey.get('101');
  const result = window.computeEvacuationRouteForRoom(roomKey, exits, graph);
  const steps = result ? window.buildEvacuationSteps(result.path, result.exit, graph) : null;
  return { hasResult: !!result, pathLen: result ? result.path.length : 0,
           crossesFloor: result ? result.crossesFloor : null, steps };
});
ok(route101.hasResult, 'room 101 finds a route to the marked exit');
ok(route101.pathLen > 1, `the route has real cells (${route101.pathLen})`);
eq(route101.crossesFloor, false, 'the route stays on floor 1 (an exit is marked there)');
ok(Array.isArray(route101.steps) && route101.steps.length > 0, 'buildEvacuationSteps() returns turn-by-turn text');
ok(route101.steps && /Exit at Door A\.$/.test(route101.steps[route101.steps.length - 1]),
   `the last step names the door (${JSON.stringify(route101.steps && route101.steps.slice(-1))})`);

/* ── 4. floor 2 has no marked exit of its own — routes via the staircase ── */
const route201 = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const exits = window.collectExitPoints();
  const roomKey = graph.roomToKey.get('201');
  const result = window.computeEvacuationRouteForRoom(roomKey, exits, graph);
  return { hasResult: !!result, crossesFloor: result ? result.crossesFloor : null };
});
ok(route201.hasResult, 'room 201 (floor 2, no exit on its own floor) still finds a route');
eq(route201.crossesFloor, true, 'that route crosses floors via the staircase teleport to reach the exit');

/* ── 5. no marked exit at all → null, not a throw ────────────────────────── */
const noExitResult = await page.evaluate(() => {
  const graph = getPathfindingGraph();
  const roomKey = graph.roomToKey.get('101');
  return window.computeEvacuationRouteForRoom(roomKey, [], graph);
});
eq(noExitResult, null, 'zero marked exits comes back null instead of throwing');

/* ── 6. the door-card PDF pipeline runs end-to-end with no console noise ── */
const beforeErrs = page.__errs.length;
await page.evaluate(() => { printEvacuationDoorCards(); });
await settle(page, 800);
eq(page.__errs.length, beforeErrs, 'no page/console errors while building door cards: ' +
   JSON.stringify(page.__errs.slice(beforeErrs, beforeErrs + 4)));

/* ── 7. the door-card DOM path renders without leaving the editor blank ─── */
const canvasStillThere = await page.evaluate(() => !!document.getElementById('bp-canvas'));
ok(canvasStillThere, 'the blueprint canvas is still intact after printing door cards');

eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
