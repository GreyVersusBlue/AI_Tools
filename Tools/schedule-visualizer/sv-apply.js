// sv-apply.js — the School Layout Visualizer's applyBlueprintData(): put a deserialized plan on
// the page (floors, cross-floor pairs, grid settings, the canvas size, the room registry, the trace
// images). Moved out of the page's classic script as a view module (rank 140, the seventh
// increment): the body is unchanged, line for line. It reaches everything it touches by bare name
// at call time, as sv-autosave.js does: the page's `let`s and `const`s sit in the global lexical
// scope a module can read and assign. The two it assigns are the page's `ctx` and
// `_heatExcludeIdCounter`. The page's module script copies the export onto window, which is how
// import, restore, the recovery ring and the load reach it by bare name.
//
// Its browser check is test/smoke-apply.mjs.

/* eslint-disable-next-line no-unused-vars -- _heatExcludeIdCounter is only assigned here; the page reads it */
/* global AppState, validateBlueprintData, migrateBlueprintToFloors, svModel, syncLegacyMirror, getActiveFloorData, invalidatePathfindingGraph, normalizeSettings, canvas, ctx:writable, _heatExcludeIdCounter:writable, applyZoom, renderCanvas, updateTileStats, updateStatusBar, showRightPanel, rebuildRoomRegistry, FloorManager, sizeVizCanvas, clearHistory, adoptTraceImages -- 035's page globals, read at call time */

/**
 * Apply a deserialized blueprint object to the application state and re-render.
 * Returns true on success, throws on validation failure.
 */
export function applyBlueprintData(data) {
  validateBlueprintData(data); // throws if invalid
  migrateBlueprintToFloors(data); // normalize old/new into floors[] shape

  // Reset transient UI state.
  AppState.ui.selectedCell  = null;
  AppState.ui.moveSource    = null;
  AppState.ui.isPairingMode = false;
  AppState.ui.pairingSource = null;
  AppState.ui.editorTarget  = null;

  // Rebuild every floor object from its serialized cells array.
  const floors = svModel().floorsFromData(data);

  AppState.blueprint.floors          = floors;
  AppState.blueprint.crossFloorPairs = JSON.parse(JSON.stringify(data.crossFloorPairs || []));
  AppState.blueprint.activeFloorIdx  = Math.min(data.activeFloorIdx || 0, floors.length - 1);
  syncLegacyMirror(getActiveFloorData());
  invalidatePathfindingGraph();

  // Re-sync the heat-exclude id counter across ALL floors so new zones don't collide.
  let maxCounter = 0;
  for (const f of floors) {
    for (const z of (f.heatExcludeZones || [])) {
      const n = parseInt((z.id || '').replace('hz_', ''), 10);
      if (!isNaN(n) && n > maxCounter) maxCounter = n;
    }
  }
  _heatExcludeIdCounter = maxCounter + 1;

  // Restore relevant settings (grid dimensions + cell size)
  if (data.settings) {
    if (data.settings.gridSize)   AppState.settings.gridSize   = data.settings.gridSize;
    if (data.settings.gridCols)   AppState.settings.gridCols   = data.settings.gridCols;
    if (data.settings.gridRows)   AppState.settings.gridRows   = data.settings.gridRows;
    // R59: restore bell schedule + subjects when the blueprint file carries them.
    if (data.settings.bellSchedule) AppState.settings.bellSchedule = data.settings.bellSchedule;
    if (Array.isArray(data.settings.subjects)) AppState.settings.subjects = data.settings.subjects;
    normalizeSettings(AppState.settings);
  }

  // Re-render the editor canvas to the active floor's dimensions.
  if (canvas) {
    const af = getActiveFloorData();
    const cellSize = AppState.settings.gridSize;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = af.gridCols * cellSize * dpr;
    canvas.height = af.gridRows * cellSize * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    applyZoom();
    renderCanvas();
  }

  updateTileStats();
  updateStatusBar();
  showRightPanel('empty');
  rebuildRoomRegistry();
  if (typeof FloorManager !== 'undefined') FloorManager.renderTabs();
  if (typeof sizeVizCanvas === 'function') sizeVizCanvas();
  if (typeof clearHistory === 'function') clearHistory();
  adoptTraceImages();   // Path 4 P4: read stored trace images, store arriving ones

  return true;
}
