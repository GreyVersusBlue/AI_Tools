// smoke-apply.mjs — 035's applyBlueprintData() after it moved out of the page into
// schedule-visualizer/sv-apply.js (Path 11 P2, rank 140, seventh increment).
//
//   node Tools/schedule-visualizer/test/smoke-apply.mjs
//   (or: npm run test:layout-apply)
//
// Held: the function is on window from the module; a saved plan round-trips (the floors, the
// cross-floor pairs, the room registry and the active floor come back, and the canvas is sized to
// the active floor and its context re-taken); an old save (one floor, a top-level cells array, no
// `floors`) opens as one floor; the heat-exclude id counter moves past every zone on every floor;
// transient selection state is reset; a payload that is not a blueprint throws and leaves the plan
// on screen untouched; the trace-image pass is run once at the end. Exits 1 on any failure.

/* global AppState, applyBlueprintData, applyFullProject, serializeBlueprint, roomRegistry, canvas, ctx, _heatExcludeIdCounter, getActiveFloorData -- 035's globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { fixtureProject } from './fixture-northwind.mjs';

const PORT = 8674;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
console.log('School Layout Visualizer: applying a plan (sv-apply.js)');

eq(await page.evaluate(() => [typeof window.SVApply, typeof applyBlueprintData, window.SVApply.applyBlueprintData === applyBlueprintData]),
  ['object', 'function', true], 'the module and its function are on window');

const shape = () => page.evaluate(() => ({
  floors: AppState.blueprint.floors.map(f => [f.id, f.gridCols, f.gridRows, f.gridData.flat().filter(Boolean).length]),
  pairs: AppState.blueprint.crossFloorPairs.length,
  active: AppState.blueprint.activeFloorIdx,
  rooms: roomRegistry.map(r => r.roomNumber).sort(),
}));

console.log('1. a saved plan round-trips');
await page.evaluate((p) => { applyFullProject(p); }, fixtureProject());
const before = await shape();
ok(before.floors.length === 2 && before.pairs >= 1 && before.rooms.length >= 8, 'the fixture is a two-floor plan with rooms and a staircase pair');
const payload = await page.evaluate(() => JSON.parse(JSON.stringify(serializeBlueprint())));
await page.evaluate(() => { applyBlueprintData({ floors: [{ id: 'floor_0', label: 'Floor 1', gridCols: 5, gridRows: 5, cells: [] }], crossFloorPairs: [] }); });
eq((await shape()).rooms, [], 'a plan with no rooms empties the registry');
const r1 = await page.evaluate((d) => applyBlueprintData(d), payload);
eq(r1, true, 'apply returns true');
eq(await shape(), before, 'floors, pairs, active floor and rooms come back exactly');
const dims = await page.evaluate(() => {
  const af = getActiveFloorData(), dpr = window.devicePixelRatio || 1, cs = AppState.settings.gridSize;
  return { w: canvas.width === af.gridCols * cs * dpr, h: canvas.height === af.gridRows * cs * dpr, ctxIsCanvas: ctx.canvas === canvas };
});
eq(dims, { w: true, h: true, ctxIsCanvas: true }, 'the canvas is sized to the active floor and the page context is re-taken');

console.log('2. an old save opens');
await page.evaluate(() => { applyBlueprintData({ gridCols: 12, gridRows: 7, cells: [{ col: 1, row: 1, tile: { type: 'classroom', roomNumber: '9', teacher: 'Old' } }], staircasePairs: [] }); });
const old = await shape();
eq([old.floors.length, old.floors[0][1], old.floors[0][2], old.floors[0][3], old.active], [1, 12, 7, 1, 0], 'one floor, 12 by 7, one cell, floor 0');
eq(old.rooms, ['9'], 'the room is in the registry');
eq(await page.evaluate(() => canvas.width / (window.devicePixelRatio || 1) / AppState.settings.gridSize), 12, 'the canvas is 12 cells wide');

console.log('3. the heat-exclude counter, settings and selection');
await page.evaluate(() => {
  AppState.ui.selectedCell = { col: 1, row: 1 }; AppState.ui.isPairingMode = true; AppState.ui.moveSource = { col: 0, row: 0 };
  applyBlueprintData({ activeFloorIdx: 9,
    settings: { gridSize: 24 },
    floors: [
      { id: 'a', label: 'A', gridCols: 6, gridRows: 6, cells: [], heatExcludeZones: [{ id: 'hz_3' }] },
      { id: 'b', label: 'B', gridCols: 8, gridRows: 4, cells: [], heatExcludeZones: [{ id: 'hz_11' }, { id: 'hz_2' }] },
    ] });
});
const st = await page.evaluate(() => ({ ctr: _heatExcludeIdCounter, act: AppState.blueprint.activeFloorIdx, gs: AppState.settings.gridSize,
  sel: AppState.ui.selectedCell, pair: AppState.ui.isPairingMode, mv: AppState.ui.moveSource }));
eq([st.ctr, st.act, st.gs, st.sel, st.pair, st.mv], [12, 1, 24, null, false, null], 'counter past the highest zone on any floor, active floor clamped, grid size taken, selection cleared');

console.log('4. a payload that is not a blueprint');
await page.evaluate((d) => applyBlueprintData(d), payload);
const keep = await shape();
const threw = await page.evaluate(() => { try { applyBlueprintData({ nonsense: true }); return false; } catch (e) { return String(e.message); } });
ok(typeof threw === 'string' && threw.length > 0, 'it throws with a message');
eq(await shape(), keep, 'the plan on screen is untouched');
ok(await page.evaluate(() => { try { applyBlueprintData(null); return false; } catch (e) { return true; } }), 'null throws');

console.log('5. the trace-image pass runs at the end');
const traced = await page.evaluate(() => {
  let calls = 0; const real = window.adoptTraceImages;
  // the page's own function is a global function declaration: wrap through the global object
  window.adoptTraceImages = function () { calls++; return real.apply(this, arguments); };
  applyBlueprintData(JSON.parse(JSON.stringify(serializeBlueprint())));
  window.adoptTraceImages = real;
  return calls;
});
eq(traced, 1, 'adoptTraceImages() is called once per apply');

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
