// sv-editor.js — the School Layout Visualizer's Blueprint tab: the floor
// data helpers, staircase pairing, undo and redo, the canvas and its
// rendering, the plain floor-plan export and Ctrl+P sheet, the evacuation
// door cards (which draw with the same tile helpers), tool placement,
// selection, the right-hand panel's room, doorway, staircase, dummy-room and
// hallway editors, the corridor-label tool, the status bar, the canvas's
// mouse and keyboard wiring, heat-exclude zones, zoom, the tool palette,
// tile deletion, the context menu and the tile stats.
//
// Path 11 P2 increment 10 (BACKLOG.md, "Path 11", the P2 bullet). Moved
// verbatim from 035's classic script with no function changed. Like
// sv-viz.js and sv-browser.js this is a view, not an engine: it owns the
// tab's DOM and reads the page at call time through the globals listed
// below (a module sees a classic script's top-level declarations, and may
// assign the ones marked writable). The page keeps the bindings that other
// code assigns or reads as bindings: `let canvas, ctx` (the door cards and
// the what-if lab swap ctx to draw off screen), FloorManager, the heat-zone
// id counter, and the trace-image and hand-off glue. The page's module
// script copies every export onto window, which is the global surface the
// classic script had (markup handlers, FloorManager, init(), the other
// modules' bare calls to drawTile and friends). Its top-level listener
// wiring now runs when the module is evaluated: after the page is parsed,
// before DOMContentLoaded, and still before init() adds the page's own
// document keydown listeners, so their order is unchanged.

/* global AppState, FloorManager, TOOL_VERSION, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, TILE_COLORS, DUMMY_COLOR_PRESETS, GRID_LINE_COLOR, PAIR_COLORS -- 035's classic-script state and constants */
/* global canvas:writable, ctx:writable, _heatExcludeIdCounter:writable, activeDummyColor:writable -- lets the page declares (the door cards and the what-if lab swap ctx; loading a blueprint resets the counter) */
/* global deriveSameFloorPairs, invalidatePathfindingGraph, rebuildRoomRegistry, parseKey, getEvacuationGraph, collectExitPoints, computeEvacuationRouteForRoom, buildEvacuationSteps, getPairLabel -- 035's BRIDGE wrappers */
/* global PlaybackController, showToast, scheduleBlueprintAutosave, openModal, closeModal, populateDeptDropdown, saveSnapshot -- 035's page helpers and sv-viz.js */

/* ==============================================
   BLUEPRINT DATA
=============================================== */
/* ── Round 31: Multi-floor helpers ───────────────────────────────── */

/** The floor object currently shown in the blueprint editor. */
function getActiveFloorData() {
  const floors = AppState.blueprint.floors;
  const idx    = AppState.blueprint.activeFloorIdx;
  return floors[idx] || floors[0];
}

/**
 * Re-point the legacy mirror fields at a floor object (BY REFERENCE so that
 * in-place tile mutations through the mirror persist to the floor).
 */
function syncLegacyMirror(floor) {
  const bp = AppState.blueprint;
  bp.gridData         = floor.gridData;
  bp.gridCols         = floor.gridCols;
  bp.gridRows         = floor.gridRows;
  bp.heatExcludeZones = floor.heatExcludeZones;
  bp.staircasePairs   = deriveSameFloorPairs(floor.id);
  AppState.settings.gridCols = floor.gridCols;
  AppState.settings.gridRows = floor.gridRows;
}

/** Switch which floor the blueprint editor shows; re-syncs all legacy mirrors. */
function switchActiveFloor(idx) {
  const floors = AppState.blueprint.floors;
  if (idx < 0 || idx >= floors.length) return;

  // Close playback before switching floors (Round 30 integration).
  if (AppState.viz && AppState.viz.playback && AppState.viz.playback.active &&
      typeof PlaybackController !== 'undefined') {
    PlaybackController.close();
  }

  AppState.blueprint.activeFloorIdx = idx;
  syncLegacyMirror(floors[idx]);

  invalidatePathfindingGraph(); // Round 27 dirty flag

  // Resize the editor canvas to the floor's dimensions before redrawing.
  if (canvas) {
    const cellSize = getEffectiveCellSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = floors[idx].gridCols * cellSize * dpr;
    canvas.height = floors[idx].gridRows * cellSize * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    applyZoom();
  }

  AppState.ui.selectedCell  = null;

  // R43: If pairing mode is active, PRESERVE it across the floor switch so the
  // user can pair staircases across floors. The right panel closes (we don't
  // know which cell is selected on the new floor), but pairing remains armed.
  // The floor-pairing-banner (added in the floor-manager-strip) provides the
  // persistent visual cue.
  if (AppState.ui.isPairingMode) {
    // Just close the right panel; keep isPairingMode + pairingSource intact.
    showRightPanel('empty');
    updateFloorPairingBanner();
  } else {
    AppState.ui.isPairingMode = false;
    AppState.ui.pairingSource = null;
    showRightPanel('empty');
  }

  renderCanvas();
  updateTileStats();
  updateStatusBar();
  if (typeof FloorManager !== 'undefined') FloorManager.renderTabs();
}

function initGridData(cols, rows, clear = false) {
  const bp = AppState.blueprint;
  const floor = getActiveFloorData();
  const prevData = floor.gridData;
  const prevCols = floor.gridCols;
  const prevRows = floor.gridRows;

  floor.gridCols = cols;
  floor.gridRows = rows;
  AppState.settings.gridCols = cols;
  AppState.settings.gridRows = rows;

  const newGrid = Array.from({ length: rows }, () => Array(cols).fill(null));

  if (!clear && prevData && prevData.length > 0) {
    const copyRows = Math.min(prevRows, rows);
    const copyCols = Math.min(prevCols, cols);
    for (let r = 0; r < copyRows; r++) {
      for (let c = 0; c < copyCols; c++) {
        if (prevData[r] && prevData[r][c]) {
          newGrid[r][c] = { ...prevData[r][c] };
        }
      }
    }
  }

  if (clear) {
    // Remove every cross-floor pair that touches this floor.
    bp.crossFloorPairs = (bp.crossFloorPairs || []).filter(
      p => p.a.floorId !== floor.id && p.b.floorId !== floor.id
    );
  }

  floor.gridData = newGrid;
  syncLegacyMirror(floor); // re-point mirrors at the (now resized) floor
  invalidatePathfindingGraph();
}


function getTile(col, row) {
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return null;
  return gridData[row][col] || null;
}

function setTile(col, row, tileData) {
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  if (row < 0 || row >= gridRows || col < 0 || col >= gridCols) return;
  gridData[row][col] = tileData;
  invalidatePathfindingGraph();
}

function getTileCounts() {
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  const counts = { classroom: 0, hallway: 0, staircase: 0, dummy: 0, total: 0 };
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const t = gridData[r][c];
      if (t) { counts[t.type] = (counts[t.type] || 0) + 1; counts.total++; }
    }
  }
  return counts;
}

/* ==============================================
   STAIRCASE PAIRING
=============================================== */

/**
 * Returns the pair index (into crossFloorPairs) for a staircase on the ACTIVE
 * floor, or -1 if unpaired. crossFloorPairs is the source of truth.
 */
function getPairIndex(col, row) {
  const fid = getActiveFloorData().id;
  const pairs = AppState.blueprint.crossFloorPairs || [];
  return pairs.findIndex(p =>
    (p.a.floorId === fid && p.a.col === col && p.a.row === row) ||
    (p.b.floorId === fid && p.b.col === col && p.b.row === row));
}

/**
 * Get the partner cell for a staircase on the ACTIVE floor, or null.
 * Returns { col, row, floorId } so callers can show the partner's floor.
 */
function getPairPartner(col, row) {
  const fid = getActiveFloorData().id;
  for (const p of (AppState.blueprint.crossFloorPairs || [])) {
    if (p.a.floorId === fid && p.a.col === col && p.a.row === row)
      return { col: p.b.col, row: p.b.row, floorId: p.b.floorId };
    if (p.b.floorId === fid && p.b.col === col && p.b.row === row)
      return { col: p.a.col, row: p.a.row, floorId: p.a.floorId };
  }
  return null;
}

/** Floor label for a given floor id (falls back to the id). */
function floorLabelById(floorId) {
  const f = (AppState.blueprint.floors || []).find(fl => fl.id === floorId);
  return f ? f.label : floorId;
}

/**
 * Pair two staircase tiles. floorIdA/floorIdB default to the active floor.
 * Writes to crossFloorPairs (source of truth) and re-derives the mirror.
 */
function pairStaircases(colA, rowA, colB, rowB, floorIdA, floorIdB) {
  const fidA = floorIdA || getActiveFloorData().id;
  const fidB = floorIdB || getActiveFloorData().id;

  // Remove any existing pairs for these specific (floor,cell) endpoints.
  unpairStaircaseOn(fidA, colA, rowA);
  unpairStaircaseOn(fidB, colB, rowB);

  AppState.blueprint.crossFloorPairs.push({
    a: { floorId: fidA, col: colA, row: rowA },
    b: { floorId: fidB, col: colB, row: rowB },
  });
  // Keep the legacy same-floor mirror current for the active floor.
  AppState.blueprint.staircasePairs = deriveSameFloorPairs(getActiveFloorData().id);
  invalidatePathfindingGraph();
}

/** Remove pairing for a staircase endpoint on a specific floor. */
function unpairStaircaseOn(floorId, col, row) {
  const pairs = AppState.blueprint.crossFloorPairs || [];
  const idx = pairs.findIndex(p =>
    (p.a.floorId === floorId && p.a.col === col && p.a.row === row) ||
    (p.b.floorId === floorId && p.b.col === col && p.b.row === row));
  if (idx !== -1) pairs.splice(idx, 1);
}

/** Remove pairing for a staircase on the ACTIVE floor. */
function unpairStaircase(col, row) {
  unpairStaircaseOn(getActiveFloorData().id, col, row);
  AppState.blueprint.staircasePairs = deriveSameFloorPairs(getActiveFloorData().id);
  invalidatePathfindingGraph();
}

/* ==============================================
   UNDO / REDO HISTORY (blueprint mutations)
=============================================== */
const HISTORY_LIMIT = 10;
let undoStack = [];
let redoStack = [];
let pendingSnapshot = null; // snapshot captured at the start of a gesture

function _snapGrid() {
  // Deep-copy the full multi-floor state for the undo stack.
  // Named _snapGrid (R46) — distinct from the named-project saveSnapshot/restoreSnapshot system.
  return JSON.stringify({
    floors:          AppState.blueprint.floors,
    crossFloorPairs: AppState.blueprint.crossFloorPairs,
    activeFloorIdx:  AppState.blueprint.activeFloorIdx,
  });
}

// Renamed _restoreGrid (R46): was restoreSnapshot(snap) — that name collides with the
// named-project restoreSnapshot(slot) in the snapshot-manager section, causing
// undoBlueprint() to call the wrong function and show "Snapshot not found."
function _restoreGrid(snap) {
  const obj = JSON.parse(snap);
  AppState.blueprint.floors          = obj.floors || [];
  AppState.blueprint.crossFloorPairs = obj.crossFloorPairs || [];
  AppState.blueprint.activeFloorIdx  =
    Math.min(obj.activeFloorIdx || 0, AppState.blueprint.floors.length - 1);
  syncLegacyMirror(getActiveFloorData());
  rebuildRoomRegistry();
  invalidatePathfindingGraph();
}

/** Capture the state just before a mutating action begins. */
function beginAction() {
  pendingSnapshot = _snapGrid();
}

/** Commit the pending action onto the undo stack if anything actually changed. */
function commitAction() {
  if (pendingSnapshot === null) return;
  const now = _snapGrid();
  if (now !== pendingSnapshot) {
    undoStack.push(pendingSnapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }
  pendingSnapshot = null;
}

/** Convenience wrapper for a discrete (non-gesture) mutation. */
function runAction(fn) {
  beginAction();
  fn();
  commitAction();
}

function undoBlueprint() {
  if (!undoStack.length) return;
  redoStack.push(_snapGrid());
  _restoreGrid(undoStack.pop());
  afterHistoryRestore();
  showToast('Undo.', 'info');
}

function redoBlueprint() {
  if (!redoStack.length) return;
  undoStack.push(_snapGrid());
  _restoreGrid(redoStack.pop());
  afterHistoryRestore();
  showToast('Redo.', 'info');
}

function afterHistoryRestore() {
  // A restored selection may now point at a different/absent tile — clear it.
  AppState.ui.selectedCell  = null;
  AppState.ui.moveSource    = null;
  AppState.ui.isPairingMode = false;
  AppState.ui.pairingSource = null;
  AppState.ui.tileDrag      = null;
  if (canvas) canvas.classList.remove('tile-dragging', 'has-pickup');
  // Round 31: floors/dimensions may have changed — resize the editor canvas.
  if (canvas) {
    const f = getActiveFloorData();
    const cellSize = getEffectiveCellSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = f.gridCols * cellSize * dpr;
    canvas.height = f.gridRows * cellSize * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    applyZoom();
  }
  if (typeof FloorManager !== 'undefined') FloorManager.renderTabs();
  renderCanvas();
  updateTileStats();
  updateStatusBar();
  showRightPanel('empty');
  scheduleBlueprintAutosave();
  updateUndoRedoButtons();
}

/** Wipe history — used after loading/importing/resetting a whole blueprint. */
function clearHistory() {
  undoStack = [];
  redoStack = [];
  pendingSnapshot = null;
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = undoStack.length === 0;
  if (r) r.disabled = redoStack.length === 0;
}

/* ==============================================
   CANVAS SETUP
=============================================== */
let lastPaintedCell = null;

function initCanvas() {
  canvas = document.getElementById('bp-canvas');
  ctx    = canvas.getContext('2d');
  const { gridCols, gridRows } = AppState.blueprint;
  const cellSize = getEffectiveCellSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = gridCols * cellSize * dpr;
  canvas.height = gridRows * cellSize * dpr;
  ctx.scale(dpr, dpr);
  applyZoom();
  bindCanvasEvents();
  renderCanvas();
}

function getEffectiveCellSize() {
  return AppState.settings.gridSize;
}

function applyZoom() {
  const z = AppState.ui.zoom;
  const cellSize = getEffectiveCellSize();
  const { gridCols, gridRows } = AppState.blueprint;
  // CSS size = logical pixels (canvas is already dpr× in physical pixels)
  canvas.style.width  = (gridCols * cellSize) + 'px';
  canvas.style.height = (gridRows * cellSize) + 'px';
  canvas.style.transformOrigin = 'top left';
  canvas.style.transform = `scale(${z})`;
  const wrapper = document.getElementById('bp-canvas-wrapper');
  wrapper.style.width  = Math.max((gridCols * cellSize * z) + 48, 0) + 'px';
  wrapper.style.height = Math.max((gridRows * cellSize * z) + 48, 0) + 'px';
  document.getElementById('zoom-display').textContent = `Zoom: ${Math.round(z * 100)}%`;
}

function resizeCanvas(cols, rows, clearTiles) {
  initGridData(cols, rows, clearTiles);
  const cellSize = getEffectiveCellSize();
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = cols * cellSize * dpr;
  canvas.height = rows * cellSize * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  applyZoom();
  renderCanvas();
  updateTileStats();
  // Grid dimensions changed — prior undo snapshots no longer match the grid.
  if (typeof clearHistory === 'function') clearHistory();
}

/* ==============================================
   CANVAS — RENDERING
=============================================== */
/* R61: Trace-image underlay — cache decoded <img> elements by dataUrl so
   renderCanvas() (called on nearly every interaction) doesn't re-decode.
   Path 4 P4: the saved value is an idb: reference; traceImageSrc() turns it
   into the data URL sv-trace-image.js holds, synchronously. */
const _traceImageCache = new Map();
function traceImageSrc(value) {
  if (window.SVTraceImage) return window.SVTraceImage.src(value);
  return (typeof value === 'string' && value.startsWith('data:image/')) ? value : '';
}
function getTraceImageEl(dataUrl) {
  if (!dataUrl) return null;
  let img = _traceImageCache.get(dataUrl);
  if (!img) {
    img = new Image();
    img.onload = () => renderCanvas();
    img.src = dataUrl;
    _traceImageCache.set(dataUrl, img);
  }
  return img;
}

function drawTraceImage() {
  const floor = getActiveFloorData();
  const t = floor && floor.traceImage;
  if (!t || !t.dataUrl) return;
  const img = getTraceImageEl(traceImageSrc(t.dataUrl));
  if (!img) return;   // a stored image not read yet, or not in this browser
  if (!img.complete || !img.naturalWidth) return;
  const scale = (typeof t.scale === 'number' && t.scale > 0) ? t.scale : 1;
  ctx.save();
  ctx.globalAlpha = (typeof t.opacity === 'number') ? t.opacity : 0.35;
  ctx.drawImage(img, t.offsetX || 0, t.offsetY || 0, img.naturalWidth * scale, img.naturalHeight * scale);
  ctx.restore();
}

function renderCanvas() {
  if (!ctx) return;
  const { gridCols, gridRows } = AppState.blueprint;
  const cellSize = getEffectiveCellSize();
  const W = gridCols * cellSize;
  const H = gridRows * cellSize;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // R61: Trace-image underlay — a low-opacity photo/scan of the real floor
  // plan to trace room shapes over, drawn beneath the grid and tiles.
  drawTraceImage();

  // Draw tiles
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const tile = getTile(c, r);
      if (tile) drawTile(c, r, tile, cellSize);
    }
  }

  // Grid lines
  drawGrid(gridCols, gridRows, cellSize, W, H);

  // R56: Stamp grouped-classroom labels on top of all tiles so a sibling cell's
  // fill can't clip the centered label (solo rooms are labelled inline above).
  stampAllGroupLabels(cellSize);

  // R39: Search highlight ring
  drawSearchHighlight(cellSize);

  // Highlight selected cell
  drawSelectionHighlight(cellSize);

  // Highlight move source
  drawMoveSourceHighlight(cellSize);

  // Highlight pairing source
  drawPairingSourceHighlight(cellSize);

  // Highlight corridor-label selection
  if (AppState.ui.activeTool === 'corridor-label' && AppState.ui.corridorLabelCells.size > 0) {
    drawCorridorLabelHighlights(cellSize);
  }

  // Draw heat-exclude zone overlays (drawn last so they float above tiles)
  drawHeatExcludeZones(cellSize);
}

/* ==============================================
   BLUEPRINT PNG/PDF EXPORT — plain floor plan (active floor)
=============================================== */
document.getElementById('btn-export-blueprint-png').addEventListener('click', exportBlueprintAsPNG);
document.getElementById('btn-export-blueprint-pdf').addEventListener('click', exportBlueprintAsPDF);
document.getElementById('btn-print-evacuation-cards')?.addEventListener('click', printEvacuationDoorCards);

/* ==============================================
   BLUEPRINT EXPORT (plain floor plan — PNG/PDF)
   Prints a clean building map / evacuation poster of the active
   floor straight from the editor. Reuses the exact offscreen-canvas
   + jsPDF technique already used by renderExportCanvas() /
   exportVizAsPNG() / exportVizAsPDF() for the movement-viz canvas,
   but draws via this editor's own renderCanvas() (rooms/hallways/
   staircases/labels only — no heatmap or route overlays).
=============================================== */
function renderBlueprintExportCanvas() {
  const EXPORT_SCALE = 2.5; // matches the viz export's 'high' preset
  const cellSize = getEffectiveCellSize();
  const { gridCols, gridRows } = AppState.blueprint;
  const logicalW = gridCols * cellSize;
  const logicalH = gridRows * cellSize;
  const W = logicalW * EXPORT_SCALE;
  const H = logicalH * EXPORT_SCALE;

  // Offscreen canvas at export resolution
  const off = document.createElement('canvas');
  off.width  = W;
  off.height = H;
  const offCtx = off.getContext('2d');
  offCtx.scale(EXPORT_SCALE, EXPORT_SCALE);

  // Temporarily retarget the drawing helpers to the offscreen context
  const savedCtx = ctx;
  ctx = offCtx;
  try {
    // Draw the plain floor-plan blueprint for the currently active floor
    renderCanvas();

    // ── Info block overlay (top-left corner) ───────────────────────────────
    const floor = AppState.blueprint.floors[AppState.blueprint.activeFloorIdx] ||
                  AppState.blueprint.floors[0];
    const schoolName = AppState.settings.schoolName || 'Building Blueprint';
    const floorLabel = floor ? floor.label : 'Floor 1';
    const lines = [schoolName, floorLabel];

    offCtx.save();
    offCtx.font = `600 11px 'DM Sans', sans-serif`;
    let maxW = 0;
    for (const line of lines) {
      const w = offCtx.measureText(line).width;
      if (w > maxW) maxW = w;
    }
    const padding = 10;
    const lineH   = 16;
    const boxW = maxW + padding * 2;
    const boxH = lines.length * lineH + padding * 2;
    const blockX = 12, blockY = 12;

    offCtx.globalAlpha = 0.88;
    offCtx.fillStyle = '#0f1a2e';  // navy-900 matching app header
    offCtx.beginPath();
    if (typeof offCtx.roundRect === 'function') {
      offCtx.roundRect(blockX, blockY, boxW, boxH, 6);
    } else {
      offCtx.rect(blockX, blockY, boxW, boxH);
    }
    offCtx.fill();
    offCtx.globalAlpha = 1;

    lines.forEach((line, i) => {
      const isFirst = i === 0;
      offCtx.font = isFirst
        ? `600 11px 'DM Sans', sans-serif`
        : `400 10px 'DM Sans', sans-serif`;
      offCtx.fillStyle = isFirst ? '#ffffff' : '#a8c4de';  // white / navy-200
      offCtx.textAlign  = 'left';
      offCtx.textBaseline = 'top';
      offCtx.fillText(line, blockX + padding, blockY + padding + i * lineH);
    });
    offCtx.restore();
  } finally {
    // Guaranteed restore of the live global regardless of any drawing error.
    ctx = savedCtx;
  }

  return { dataURL: off.toDataURL('image/png'), w: W, h: H };
}

function exportBlueprintAsPNG() {
  if (!canvas) { showToast('Canvas not ready.', 'warn'); return; }
  showToast('Exporting…', 'info');
  try {
    const { dataURL } = renderBlueprintExportCanvas();
    const schoolName = (AppState.settings.schoolName || 'School').replace(/[^\w\s-]/g, '').trim() || 'School';
    const floor = AppState.blueprint.floors[AppState.blueprint.activeFloorIdx] || AppState.blueprint.floors[0];
    const floorLabel = ((floor && floor.label) || 'Floor 1').replace(/[^\w\s-]/g, '').trim() || 'Floor';
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `Blueprint — ${schoolName} — ${floorLabel}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Saved as PNG', 'success');
  } catch (err) {
    showToast('PNG export failed.', 'error');
    console.warn('[STVIZ] Blueprint PNG export error:', err);
  }
}

function exportBlueprintAsPDF() {
  if (!canvas) { showToast('Canvas not ready.', 'warn'); return; }
  showToast('Exporting…', 'info');
  try {
    const { dataURL, w, h } = renderBlueprintExportCanvas();
    if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
      showToast('PDF export unavailable — try PNG instead.', 'warn');
      return;
    }
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    const mmW = w * 0.264583;
    const mmH = h * 0.264583;
    const orientation = w > h ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: [mmW, mmH] });
    doc.addImage(dataURL, 'PNG', 0, 0, mmW, mmH);
    const schoolName = (AppState.settings.schoolName || 'School').replace(/[^\w\s-]/g, '').trim() || 'School';
    const floor = AppState.blueprint.floors[AppState.blueprint.activeFloorIdx] || AppState.blueprint.floors[0];
    const floorLabel = ((floor && floor.label) || 'Floor 1').replace(/[^\w\s-]/g, '').trim() || 'Floor';
    doc.save(`Blueprint — ${schoolName} — ${floorLabel}.pdf`);
    showToast('Saved as PDF', 'success');
  } catch (err) {
    showToast('PDF export failed — try PNG instead.', 'error');
    console.warn('[STVIZ] Blueprint PDF export error:', err);
  }
}

/* ==============================================
   BLUEPRINT ON PAPER (Ctrl+P on the Blueprint tab)
   Fills #bp-print-sheet, which only print media shows. Same ctx-swap →
   renderCanvas() → restore as renderBlueprintExportCanvas() above, drawn
   straight into the sheet's own canvas (an <img> given its src on
   `beforeprint` may not have decoded by the time the page is laid out), and
   cropped to the cells that hold something plus one cell of margin, so a
   small building on a large grid still fills the page.
=============================================== */
function renderBlueprintPrintSheet() {
  const sheet = document.getElementById('bp-print-sheet');
  const out   = document.getElementById('bp-print-canvas');
  if (!sheet || !out) return;
  const { gridCols, gridRows } = AppState.blueprint;
  const floor = AppState.blueprint.floors[AppState.blueprint.activeFloorIdx] ||
                AppState.blueprint.floors[0];
  const floorLabel = (floor && floor.label) || 'Floor 1';
  document.getElementById('bp-print-title').textContent = AppState.settings.schoolName || 'Building plan';
  document.getElementById('bp-print-sub').textContent = floorLabel;
  out.setAttribute('aria-label', 'Floor plan, ' + floorLabel);

  let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (!getTile(c, r)) continue;
      if (c < c0) c0 = c; if (c > c1) c1 = c;
      if (r < r0) r0 = r; if (r > r1) r1 = r;
    }
  }
  const none = c1 < 0;
  sheet.classList.toggle('bp-print-none', none);
  if (none) { sheet.classList.remove('bp-print-wide'); return; }

  c0 = Math.max(0, c0 - 1); r0 = Math.max(0, r0 - 1);
  c1 = Math.min(gridCols, c1 + 2); r1 = Math.min(gridRows, r1 + 2);
  const cellSize = getEffectiveCellSize();
  const w = (c1 - c0) * cellSize, h = (r1 - r0) * cellSize;
  // 2.5 matches the PNG export; the cap keeps a very large grid inside what a
  // canvas can hold.
  const scale = Math.min(2.5, 4096 / Math.max(w, h));
  out.width  = Math.round(w * scale);
  out.height = Math.round(h * scale);
  sheet.classList.toggle('bp-print-wide', w > h);

  const pctx = out.getContext('2d');
  pctx.setTransform(scale, 0, 0, scale, -c0 * cellSize * scale, -r0 * cellSize * scale);
  const savedCtx = ctx;
  ctx = pctx;
  try {
    renderCanvas();
  } finally {
    ctx = savedCtx;
  }
}

window.addEventListener('beforeprint', () => {
  const viz = document.getElementById('app-visualizer');
  if (viz && viz.style.display === 'none') return; // the Schedule Browser is showing
  if (AppState.ui.activeTab !== 'blueprint') return;
  try {
    renderBlueprintPrintSheet();
  } catch (err) {
    console.warn('[STVIZ] Blueprint print sheet error:', err);
  }
});

/* ==============================================
   EVACUATION DOOR CARDS
   ──────────────────────────────────────────────────────────────
   One postable card per room on the active floor: a cropped,
   route-highlighted floor-plan image plus numbered turn-by-turn
   text and the assigned assembly point, batched into a single
   multi-page PDF. Reuses the exact ctx-swap → renderCanvas() →
   restore technique renderBlueprintExportCanvas() uses just above,
   then crops the result to the route's bounding box and draws the
   path on top before cropping — no changes to renderCanvas() or
   any tile-drawing helper were needed.
=============================================== */

/**
 * Render a cropped PNG of the active floor with one evacuation route
 * highlighted, or null when there is nothing to draw: no path, or the
 * route leaves the active floor via a staircase (a single floor's canvas
 * can't depict a different floor's plan, so those cards fall back to the
 * numbered text steps alone — see drawEvacuationDoorCard()).
 */
function renderEvacuationMapCrop(result, floor) {
  if (!result || !result.path || result.path.length < 2 || result.crossesFloor) return null;

  const EXPORT_SCALE = 3;
  const cellSize = getEffectiveCellSize();
  const { gridCols, gridRows } = floor;
  const W = gridCols * cellSize * EXPORT_SCALE;
  const H = gridRows * cellSize * EXPORT_SCALE;
  if (!(W > 0 && H > 0)) return null;

  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const offCtx = off.getContext('2d');
  offCtx.scale(EXPORT_SCALE, EXPORT_SCALE);

  const savedCtx = ctx;
  ctx = offCtx;
  let minC = Infinity, minR = Infinity, maxC = -1, maxR = -1;
  try {
    renderCanvas(); // draws the plain floor plan for the ACTIVE floor, unmodified

    offCtx.save();
    offCtx.lineWidth = 3.2;
    offCtx.strokeStyle = '#dc2626';
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    offCtx.beginPath();
    let started = false;
    for (const key of result.path) {
      const { x: c, y: r } = parseKey(key);
      if (c < minC) minC = c; if (r < minR) minR = r;
      if (c > maxC) maxC = c; if (r > maxR) maxR = r;
      const cx = c * cellSize + cellSize / 2, cy = r * cellSize + cellSize / 2;
      if (!started) { offCtx.moveTo(cx, cy); started = true; } else offCtx.lineTo(cx, cy);
    }
    offCtx.stroke();

    const startPt = parseKey(result.path[0]);
    const endPt   = parseKey(result.path[result.path.length - 1]);
    offCtx.fillStyle = '#16a34a';
    offCtx.beginPath();
    offCtx.arc(startPt.x * cellSize + cellSize / 2, startPt.y * cellSize + cellSize / 2, cellSize * 0.3, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.fillStyle = '#dc2626';
    offCtx.beginPath();
    offCtx.arc(endPt.x * cellSize + cellSize / 2, endPt.y * cellSize + cellSize / 2, cellSize * 0.3, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.restore();
  } finally {
    ctx = savedCtx; // guaranteed restore even if a drawing call above throws
  }

  if (maxC < 0) return null;
  const pad = 2;
  const c0 = Math.max(0, minC - pad), r0 = Math.max(0, minR - pad);
  const c1 = Math.min(gridCols, maxC + pad + 1), r1 = Math.min(gridRows, maxR + pad + 1);
  const sx = c0 * cellSize * EXPORT_SCALE, sy = r0 * cellSize * EXPORT_SCALE;
  const sw = (c1 - c0) * cellSize * EXPORT_SCALE, sh = (r1 - r0) * cellSize * EXPORT_SCALE;
  if (!(sw > 0 && sh > 0)) return null;

  const crop = document.createElement('canvas');
  crop.width = sw; crop.height = sh;
  crop.getContext('2d').drawImage(off, sx, sy, sw, sh, 0, 0, sw, sh);
  return { dataURL: crop.toDataURL('image/png'), w: sw, h: sh };
}

/** Draw one room's door card onto the current jsPDF page. */
function drawEvacuationDoorCard(doc, opts) {
  const { pageW, pageH, margin, schoolName, floorLabel, roomNumber, result, graph, floor } = opts;
  const contentW = pageW - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 110);
  doc.text(String(schoolName).toUpperCase(), margin, y + 0.18);
  doc.text('EVACUATION ROUTE', pageW - margin, y + 0.18, { align: 'right' });
  y += 0.32;
  doc.setDrawColor(210, 214, 220);
  doc.setLineWidth(0.01);
  doc.line(margin, y, pageW - margin, y);
  y += 0.38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(20, 25, 35);
  doc.text(`Room ${roomNumber}`, margin, y);
  y += 0.26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(90, 100, 110);
  doc.text(floorLabel || 'Floor 1', margin, y);
  y += 0.4;

  if (!result) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(185, 28, 28);
    const msg = doc.splitTextToSize(
      'No evacuation route found for this room. Mark at least one exterior exit ' +
      '(select a hallway tile → check "Exterior exit") that this room can reach.', contentW);
    doc.text(msg, margin, y);
    y += msg.length * 0.24;
    drawDoorCardFooter(doc, { pageW, pageH, margin });
    return;
  }

  const mapImg = renderEvacuationMapCrop(result, floor);
  if (mapImg) {
    const maxImgW = contentW, maxImgH = 4.3;
    const aspect = mapImg.w / mapImg.h;
    let imgW = maxImgW, imgH = imgW / aspect;
    if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * aspect; }
    const imgX = margin + (contentW - imgW) / 2;
    doc.setDrawColor(225, 228, 232);
    doc.rect(imgX, y, imgW, imgH);
    doc.addImage(mapImg.dataURL, 'PNG', imgX, y, imgW, imgH);
    y += imgH + 0.28;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 25, 35);
  doc.text('Route', margin, y);
  y += 0.22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 46, 56);
  const steps = buildEvacuationSteps(result.path, result.exit, graph);
  steps.forEach((step, idx) => {
    const wrapped = doc.splitTextToSize(`${idx + 1}. ${step}`, contentW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 0.19;
  });
  y += 0.22;

  const boxH = 0.62;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.012);
  doc.roundedRect(margin, y, contentW, boxH, 0.06, 0.06, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 95, 70);
  doc.text('ASSEMBLY POINT', margin + 0.16, y + 0.22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(15, 60, 45);
  const assemblyText = result.exit.assemblyPoint || result.exit.label || 'Not set — see building evacuation plan';
  doc.text(assemblyText, margin + 0.16, y + 0.46);
  y += boxH + 0.18;

  if (result.crossesFloor) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 125, 135);
    const note = doc.splitTextToSize(
      'This route continues on another floor via a staircase — the map above shows only ' +
      (floorLabel || 'this floor') + '; follow the numbered steps the rest of the way.', contentW);
    doc.text(note, margin, y);
  }

  drawDoorCardFooter(doc, { pageW, pageH, margin });
}

function drawDoorCardFooter(doc, opts) {
  const { pageH, margin } = opts;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 155, 165);
  doc.text(
    `Generated ${new Date().toLocaleDateString()} · School Layout Visualizer ${TOOL_VERSION} · Post next to classroom door`,
    margin, pageH - margin + 0.12);
}

/**
 * Entry point for the "Print Door Cards" button: one door card per room
 * on the currently active floor, batched into a single downloadable PDF.
 */
function printEvacuationDoorCards() {
  if (!canvas) { showToast('Canvas not ready.', 'warn'); return; }

  // Path 11 P3: no elevator on a door card's route (see sv-graph.js).
  const graph = getEvacuationGraph();
  const exits = collectExitPoints();
  if (!exits.length) {
    showToast('Mark at least one exterior exit first — select a hallway tile and check "Exterior exit".', 'warn');
    return;
  }

  const floor = getActiveFloorData();
  const rooms = [...graph.roomToKey.entries()]
    .filter(([, key]) => key.startsWith(floor.id + ':'))
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  if (!rooms.length) {
    showToast('No rooms on this floor to route yet.', 'warn');
    return;
  }
  if (typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    showToast('PDF export unavailable in this browser.', 'warn');
    return;
  }

  showToast('Building evacuation door cards…', 'info');
  try {
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
    const pageOpts = { pageW: 8.5, pageH: 11, margin: 0.55,
                        schoolName: AppState.settings.schoolName || 'School', floorLabel: floor.label, floor, graph };

    rooms.forEach(([roomNumber, roomKey], idx) => {
      if (idx > 0) doc.addPage();
      const result = computeEvacuationRouteForRoom(roomKey, exits, graph);
      drawEvacuationDoorCard(doc, { ...pageOpts, roomNumber, result });
    });

    const safeSchool = (AppState.settings.schoolName || 'School').replace(/[^\w\s-]/g, '').trim() || 'School';
    const safeFloor   = (floor.label || 'Floor').replace(/[^\w\s-]/g, '').trim() || 'Floor';
    doc.save(`Evacuation Door Cards — ${safeSchool} — ${safeFloor}.pdf`);
    showToast(`Saved ${rooms.length} door card${rooms.length === 1 ? '' : 's'} as PDF`, 'success');
  } catch (err) {
    showToast('Door card export failed.', 'error');
    console.warn('[STVIZ] Evacuation door card export error:', err);
  }
}

function drawGrid(cols, rows, cellSize, W, H) {
  ctx.beginPath();
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.75;
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(c * cellSize + 0.5, 0);
    ctx.lineTo(c * cellSize + 0.5, H);
  }
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(0, r * cellSize + 0.5);
    ctx.lineTo(W, r * cellSize + 0.5);
  }
  ctx.stroke();
}

/* R39: Draw a pulsing double-ring on the search-highlighted cell */
function drawSearchHighlight(cellSize) {
  const hl = AppState.ui.searchHighlightCell;
  if (!hl) return;
  const { col, row } = hl;
  const cx = col * cellSize + cellSize / 2;
  const cy = row * cellSize + cellSize / 2;
  const r  = cellSize * 0.42;
  ctx.save();
  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(59,130,246,0.25)';
  ctx.lineWidth = 6;
  ctx.stroke();
  // Inner solid ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(59,130,246,0.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

function drawCorridorLabelHighlights(cellSize) {
  ctx.save();
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(5,150,105,0.13)';
  for (const key of AppState.ui.corridorLabelCells) {
    const [c, r] = key.split(',').map(Number);
    if (!inBounds(c, r)) continue;
    const x = c * cellSize;
    const y = r * cellSize;
    ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
  }
  ctx.restore();
}

function drawSelectionHighlight(cellSize) {
  const sel = AppState.ui.selectedCell;
  if (!sel || AppState.ui.activeTool !== 'select') return;

  const tile = getTile(sel.col, sel.row);
  // For grouped classrooms, highlight the full group bounding box
  if (tile && tile.type === 'classroom' && tile.groupId) {
    const bounds = getGroupBounds(sel.col, sel.row, tile.groupId);
    const x = bounds.minCol * cellSize;
    const y = bounds.minRow * cellSize;
    const w = (bounds.maxCol - bounds.minCol + 1) * cellSize;
    const h = (bounds.maxRow - bounds.minRow + 1) * cellSize;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(59,130,246,0.4)';
    ctx.shadowBlur  = 6;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
    return;
  }

  const x = sel.col * cellSize;
  const y = sel.row * cellSize;
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(59,130,246,0.4)';
  ctx.shadowBlur  = 6;
  roundRectStroke(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 3);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

function drawMoveSourceHighlight(cellSize) {
  const src = AppState.ui.moveSource;
  if (!src) return;
  const x = src.col * cellSize;
  const y = src.row * cellSize;
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 3]);
  ctx.shadowColor = 'rgba(124,58,237,0.4)';
  ctx.shadowBlur  = 6;
  roundRectStroke(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 3);
  ctx.setLineDash([]);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

function drawPairingSourceHighlight(cellSize) {
  const src = AppState.ui.pairingSource;
  if (!src) return;
  const x = src.col * cellSize;
  const y = src.row * cellSize;
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(124,58,237,0.5)';
  ctx.shadowBlur  = 8;
  roundRectStroke(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 3);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

/**
 * Draw a tile including room label and staircase pair badge.
 */
function drawTile(col, row, tile, cellSize, skipRoomLabel) {
  const x = col * cellSize;
  const y = row * cellSize;
  const pad = 1;

  if (tile.type === 'staircase') {
    const colors = TILE_COLORS.staircase;
    const tx = x + pad, ty = y + pad, tw = cellSize - pad * 2, th = cellSize - pad * 2;
    const r  = Math.min(3, cellSize * 0.1);
    drawStaircaseTile(col, row, tile, tx, ty, tw, th, r, colors, cellSize);
    return;
  }

  if (tile.type === 'dummy') {
    drawDummyTile(col, row, tile, x, y, cellSize, pad);
    return;
  }

  if (tile.type === 'classroom') {
    drawClassroomTile(col, row, tile, x, y, cellSize, pad, skipRoomLabel);
    return;
  }

  // Hallway
  const colors = TILE_COLORS[tile.type];
  if (!colors) return;
  const tx = x + pad, ty = y + pad, tw = cellSize - pad * 2, th = cellSize - pad * 2;
  const r  = Math.min(3, cellSize * 0.1);
  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, r);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Evacuation: green ring + door glyph on any hallway tile marked as an
  // exterior exit (showHallwayEditor). Purely a visual cue in the editor —
  // the evacuation door-card print reads tile.isExit directly, not this draw.
  if (tile.isExit) {
    ctx.save();
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    roundRectStroke(ctx, tx + 1, ty + 1, tw - 2, th - 2, r);
    ctx.font = `${Math.max(10, Math.round(cellSize * 0.5))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', x + cellSize / 2, y + cellSize / 2 + 1);
    ctx.restore();
  }
}

/**
 * Draw a classroom tile, suppressing inner borders on multi-cell group edges.
 */
function drawClassroomTile(col, row, tile, x, y, cellSize, pad, skipRoomLabel) {
  const colors = TILE_COLORS.classroom;
  const groupId = tile.groupId || null;

  // Determine which edges are shared with same group (to suppress borders)
  const sharedTop    = groupId && isSameGroup(col, row - 1, groupId);
  const sharedBottom = groupId && isSameGroup(col, row + 1, groupId);
  const sharedLeft   = groupId && isSameGroup(col - 1, row, groupId);
  const sharedRight  = groupId && isSameGroup(col + 1, row, groupId);

  const tx = x + (sharedLeft  ? 0 : pad);
  const ty = y + (sharedTop   ? 0 : pad);
  const tw = cellSize - (sharedLeft ? 0 : pad) - (sharedRight  ? 0 : pad);
  const th = cellSize - (sharedTop  ? 0 : pad) - (sharedBottom ? 0 : pad);

  ctx.fillStyle = colors.fill;
  ctx.fillRect(tx, ty, tw, th);

  // Draw only the outer/exposed edges
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (!sharedTop)    { ctx.moveTo(tx, ty + 0.5);       ctx.lineTo(tx + tw, ty + 0.5); }
  if (!sharedBottom) { ctx.moveTo(tx, ty + th - 0.5);  ctx.lineTo(tx + tw, ty + th - 0.5); }
  if (!sharedLeft)   { ctx.moveTo(tx + 0.5, ty);       ctx.lineTo(tx + 0.5, ty + th); }
  if (!sharedRight)  { ctx.moveTo(tx + tw - 0.5, ty);  ctx.lineTo(tx + tw - 0.5, ty + th); }
  ctx.stroke();

  // Doorways: draw notches on edges that have explicit doors, or the default indicator on anchor
  const isAnchor = !groupId || isGroupAnchor(col, row, groupId);
  // Get doors from anchor tile
  const anchorDoors = getClassroomDoors(col, row, groupId);
  const hasDoors = anchorDoors.length > 0;

  if (hasDoors) {
    // Draw explicit door notches on each door edge
    drawDoorNotches(col, row, tile, anchorDoors, cellSize, colors);
  } else if (isAnchor && cellSize >= 28) {
    // Default door indicator: a subtle rectangle at the bottom of the group
    const doorW = Math.max(6, cellSize * 0.2);
    const doorH = Math.max(4, cellSize * 0.12);
    const centerX = tile.groupId ? getGroupCenterX(col, row, tile.groupId, cellSize) : x + cellSize / 2;
    ctx.fillStyle = colors.stroke;
    ctx.globalAlpha = 0.35;
    const doorBotY = getGroupBottomY(col, row, groupId, cellSize);
    ctx.fillRect(centerX - doorW / 2, doorBotY - doorH, doorW, doorH);
    ctx.globalAlpha = 1;
  }

  // Room number label.
  // R56: Solo (single-cell) rooms draw their label inline here. GROUPED rooms
  // are intentionally skipped — their label is stamped in a dedicated pass AFTER
  // every tile is filled (see stampGroupLabel / renderCanvas / redrawCell). The
  // row-major fill loop would otherwise let a sibling group cell paint over the
  // anchor's centered label, clipping it to one quadrant.
  if (!skipRoomLabel && isAnchor && !groupId && tile.roomNumber && cellSize >= 24) {
    const gBounds = getGroupBounds(col, row, groupId);
    const lx = tile.groupId ? getGroupCenterX(col, row, tile.groupId, cellSize) : x + cellSize / 2;
    const ly = tile.groupId ? getGroupCenterY(col, row, tile.groupId, cellSize) : y + cellSize / 2;
    const groupW = tile.groupId ? getGroupPixelWidth(col, row, tile.groupId, cellSize) : cellSize;
    const groupH = tile.groupId ? getGroupPixelHeight(col, row, tile.groupId, cellSize) : cellSize;
    ctx.fillStyle = '#1e3a8a';
    // Scale font to the smaller dimension so it always fits inside the classroom block
    const fontSize = Math.max(8, Math.min(14, Math.min(groupW, groupH) * 0.28));
    ctx.font = `600 ${fontSize}px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    // Clip to the full group pixel bounds (no sub-pixel offset) so the text
    // is never cropped by a stale pad/rounding calculation.
    ctx.beginPath();
    ctx.rect(
      gBounds.minCol * cellSize,
      gBounds.minRow * cellSize,
      (gBounds.maxCol - gBounds.minCol + 1) * cellSize,
      (gBounds.maxRow - gBounds.minRow + 1) * cellSize
    );
    ctx.clip();
    ctx.fillText(tile.roomNumber, lx, ly);
    ctx.restore();
  } else if (!skipRoomLabel && isAnchor && !groupId && !tile.roomNumber && cellSize >= 32) {
    const lx = tile.groupId ? getGroupCenterX(col, row, tile.groupId, cellSize) : x + cellSize / 2;
    const ly = tile.groupId ? getGroupCenterY(col, row, tile.groupId, cellSize) : y + cellSize / 2;
    ctx.fillStyle = colors.stroke;
    ctx.globalAlpha = 0.25;
    ctx.font = `600 ${Math.max(10, cellSize * 0.25)}px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', lx, ly);
    ctx.globalAlpha = 1;
  }
}

/** Check if a neighboring cell has the same groupId */
function isSameGroup(col, row, groupId) {
  const t = getTile(col, row);
  return !!(t && t.type === 'classroom' && t.groupId === groupId);
}

/** Is this the top-left (anchor) cell of its group? */
function isGroupAnchor(col, row, groupId) {
  const bounds = getGroupBounds(col, row, groupId);
  return col === bounds.minCol && row === bounds.minRow;
}

/** Get the bounding box of all cells sharing a groupId */
function getGroupBounds(col, row, groupId) {
  if (!groupId) return { minCol: col, minRow: row, maxCol: col, maxRow: row };
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  let minCol = col, maxCol = col, minRow = row, maxRow = row;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const t = gridData[r][c];
      if (t && t.type === 'classroom' && t.groupId === groupId) {
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
      }
    }
  }
  return { minCol, minRow, maxCol, maxRow };
}

function getGroupCenterX(col, row, groupId, cellSizeOverride) {
  const b = getGroupBounds(col, row, groupId);
  const cs = cellSizeOverride || getEffectiveCellSize();
  return (b.minCol + (b.maxCol - b.minCol + 1) / 2) * cs;
}
function getGroupCenterY(col, row, groupId, cellSizeOverride) {
  const b = getGroupBounds(col, row, groupId);
  const cs = cellSizeOverride || getEffectiveCellSize();
  return (b.minRow + (b.maxRow - b.minRow + 1) / 2) * cs;
}
function getGroupPixelWidth(col, row, groupId, cellSize) {
  const b = getGroupBounds(col, row, groupId);
  return (b.maxCol - b.minCol + 1) * cellSize;
}
function getGroupPixelHeight(col, row, groupId, cellSize) {
  const b = getGroupBounds(col, row, groupId);
  return (b.maxRow - b.minRow + 1) * cellSize;
}
function getGroupBottomY(col, row, groupId, cellSize) {
  const b = getGroupBounds(col, row, groupId);
  return (b.maxRow + 1) * cellSize - 1;
}

/**
 * R56: Stamp a multi-cell classroom's label ON TOP of all its cells.
 * Called after the whole tile pass so a sibling cell's fill can't clip the
 * anchor's centered label (the previous behaviour cropped it to one quadrant).
 * The room number lives only on the anchor tile, so it is resolved from the
 * group bounds regardless of which member cell (col,row) is passed in. The font
 * shrinks to fit the group width so longer numbers display fully. Coordinates
 * use whatever ctx transform is active (works inside translated floor panels).
 */
function stampGroupLabel(col, row, groupId, cellSize) {
  if (!groupId) return;
  const gb = getGroupBounds(col, row, groupId);
  const anchor = getTile(gb.minCol, gb.minRow);
  if (!anchor) return;
  const lx = getGroupCenterX(col, row, groupId, cellSize);
  const ly = getGroupCenterY(col, row, groupId, cellSize);
  const groupW = getGroupPixelWidth(col, row, groupId, cellSize);
  const groupH = getGroupPixelHeight(col, row, groupId, cellSize);
  ctx.save();
  // Clip to the group's pixel bounds so a long label can't bleed into corridors.
  ctx.beginPath();
  ctx.rect(
    gb.minCol * cellSize,
    gb.minRow * cellSize,
    (gb.maxCol - gb.minCol + 1) * cellSize,
    (gb.maxRow - gb.minRow + 1) * cellSize
  );
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (anchor.roomNumber && cellSize >= 24) {
    ctx.fillStyle = '#1e3a8a';
    // Start from the dimension-scaled size, then shrink until the actual text
    // fits inside the group width (minus a small inset) so it never gets cut.
    let fontSize = Math.max(8, Math.min(14, Math.min(groupW, groupH) * 0.28));
    const maxTextW = Math.max(8, groupW - 6);
    for (let guard = 0; guard < 12; guard++) {
      ctx.font = `600 ${fontSize}px 'DM Mono', monospace`;
      if (ctx.measureText(anchor.roomNumber).width <= maxTextW || fontSize <= 6.5) break;
      fontSize -= 0.75;
    }
    ctx.fillText(anchor.roomNumber, lx, ly);
  } else if (!anchor.roomNumber && cellSize >= 32) {
    ctx.fillStyle = TILE_COLORS.classroom.stroke;
    ctx.globalAlpha = 0.25;
    ctx.font = `600 ${Math.max(10, cellSize * 0.25)}px 'DM Mono', monospace`;
    ctx.fillText('?', lx, ly);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/**
 * R56: Iterate every classroom group once and stamp its label on top of the
 * already-drawn tiles. Used by the full builder render.
 */
function stampAllGroupLabels(cellSize) {
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  const seen = new Set();
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const tile = gridData[r][c];
      if (!tile || tile.type !== 'classroom' || !tile.groupId) continue;
      if (seen.has(tile.groupId)) continue;
      if (!isGroupAnchor(c, r, tile.groupId)) continue;
      seen.add(tile.groupId);
      stampGroupLabel(c, r, tile.groupId, cellSize);
    }
  }
}

/**
 * Get the doors array from the anchor tile of a classroom (or the tile itself if solo).
 * Returns [] if no doors defined.
 */
function getClassroomDoors(col, row, groupId) {
  let anchorTile;
  if (groupId) {
    const bounds = getGroupBounds(col, row, groupId);
    anchorTile = getTile(bounds.minCol, bounds.minRow);
  } else {
    anchorTile = getTile(col, row);
  }
  return (anchorTile && anchorTile.doors) ? anchorTile.doors : [];
}

/**
 * Detect which side of a classroom cell the user clicked near, and whether
 * that side faces a hallway (or open space for a disconnected classroom).
 * Returns { col, row, side } or null.
 * x, y are canvas-local pixel coords relative to cell top-left.
 */
function detectDoorSide(col, row, groupId, xInCell, yInCell, cellSize) {
  // Determine which face was clicked (closest to edge, within 35% of the edge)
  const threshold = cellSize * 0.35;
  const candidates = [];
  if (yInCell < threshold) candidates.push('top');
  if (yInCell > cellSize - threshold) candidates.push('bottom');
  if (xInCell < threshold) candidates.push('left');
  if (xInCell > cellSize - threshold) candidates.push('right');

  if (candidates.length === 0) return null;

  // Pick the edge the cursor is closest to
  const dists = {
    top:    yInCell,
    bottom: cellSize - yInCell,
    left:   xInCell,
    right:  cellSize - xInCell,
  };
  let best = null, bestDist = Infinity;
  for (const side of candidates) {
    if (dists[side] < bestDist) { bestDist = dists[side]; best = side; }
  }
  if (!best) return null;

  // Confirm this edge is exposed (not shared with same group)
  const [nc, nr] = { top: [col, row-1], bottom: [col, row+1], left: [col-1, row], right: [col+1, row] }[best];
  if (groupId && isSameGroup(nc, nr, groupId)) return null; // interior edge — can't place door here

  return { col, row, side: best };
}

/**
 * Draw door notches on the classroom cell's edges.
 * Called for every cell in the group; draws only the doors that belong to this cell.
 */
function drawDoorNotches(col, row, tile, allDoors, cellSize, colors) {
  const myDoors = allDoors.filter(d => d.col === col && d.row === row);
  if (myDoors.length === 0) return;

  const x = col * cellSize;
  const y = row * cellSize;
  const pad = 1;
  const doorW = Math.max(7, cellSize * 0.32); // door opening width in px
  const doorDepth = Math.max(3, cellSize * 0.13);

  for (const door of myDoors) {
    const { side } = door;
    ctx.save();

    // Erase (fill with background color) to create the gap in the wall
    ctx.fillStyle = '#f8fafc';

    // Draw a colored door arc/gap on the specified side
    let gx, gy, gw, gh;
    if (side === 'top') {
      gx = x + cellSize / 2 - doorW / 2;
      gy = y;
      gw = doorW; gh = doorDepth + pad;
    } else if (side === 'bottom') {
      gx = x + cellSize / 2 - doorW / 2;
      gy = y + cellSize - doorDepth - pad;
      gw = doorW; gh = doorDepth + pad;
    } else if (side === 'left') {
      gx = x;
      gy = y + cellSize / 2 - doorW / 2;
      gw = doorDepth + pad; gh = doorW;
    } else { // right
      gx = x + cellSize - doorDepth - pad;
      gy = y + cellSize / 2 - doorW / 2;
      gw = doorDepth + pad; gh = doorW;
    }

    // Background gap (erase the wall line)
    ctx.fillRect(gx, gy, gw, gh);

    // Draw accent door marking
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    const mid = (side === 'top' || side === 'bottom')
      ? x + cellSize / 2
      : y + cellSize / 2;
    const halfW = doorW / 2;

    ctx.beginPath();
    if (side === 'top') {
      ctx.moveTo(mid - halfW, y + pad);
      ctx.lineTo(mid - halfW, y + doorDepth + pad);
      ctx.moveTo(mid + halfW, y + pad);
      ctx.lineTo(mid + halfW, y + doorDepth + pad);
      // Arc suggestion
      ctx.moveTo(mid - halfW, y + pad);
      ctx.lineTo(mid + halfW, y + pad);
    } else if (side === 'bottom') {
      const by = y + cellSize - pad;
      ctx.moveTo(mid - halfW, by);
      ctx.lineTo(mid - halfW, by - doorDepth);
      ctx.moveTo(mid + halfW, by);
      ctx.lineTo(mid + halfW, by - doorDepth);
      ctx.moveTo(mid - halfW, by);
      ctx.lineTo(mid + halfW, by);
    } else if (side === 'left') {
      ctx.moveTo(x + pad, mid - halfW);
      ctx.lineTo(x + doorDepth + pad, mid - halfW);
      ctx.moveTo(x + pad, mid + halfW);
      ctx.lineTo(x + doorDepth + pad, mid + halfW);
      ctx.moveTo(x + pad, mid - halfW);
      ctx.lineTo(x + pad, mid + halfW);
    } else {
      const rx = x + cellSize - pad;
      ctx.moveTo(rx, mid - halfW);
      ctx.lineTo(rx - doorDepth, mid - halfW);
      ctx.moveTo(rx, mid + halfW);
      ctx.lineTo(rx - doorDepth, mid + halfW);
      ctx.moveTo(rx, mid - halfW);
      ctx.lineTo(rx, mid + halfW);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawDummyTile(col, row, tile, x, y, cellSize, pad) {
  const fillColor  = tile.dummyColor || DUMMY_COLOR_PRESETS[0];
  const strokeColor = darkenHex(fillColor, 0.35);
  const tx = x + pad, ty = y + pad, tw = cellSize - pad * 2, th = cellSize - pad * 2;
  const r  = Math.min(3, cellSize * 0.1);

  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, r);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  if (tile.dummyLabel && cellSize >= 24) {
    const fontSize = Math.max(7, Math.min(11, cellSize * 0.22));
    ctx.fillStyle = darkenHex(fillColor, 0.5);
    ctx.font = `600 ${fontSize}px 'DM Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx + 2, ty + 2, tw - 4, th - 4);
    ctx.clip();
    ctx.fillText(tile.dummyLabel, tx + tw / 2, ty + th / 2);
    ctx.restore();
  }
}

/** Darken a hex color by a factor 0–1 */
function darkenHex(hex, factor) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = Math.round(parseInt(h.slice(0,2), 16) * (1 - factor));
  const g = Math.round(parseInt(h.slice(2,4), 16) * (1 - factor));
  const b = Math.round(parseInt(h.slice(4,6), 16) * (1 - factor));
  return `rgb(${r},${g},${b})`;
}

function drawRoomLabel(roomNumber, tx, ty, tw, th, cellSize) {
  const fontSize = Math.max(8, Math.min(14, cellSize * 0.28));
  ctx.fillStyle = '#1e3a8a';
  ctx.font = `600 ${fontSize}px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Truncate if too long
  let label = roomNumber;
  ctx.save();
  ctx.beginPath();
  ctx.rect(tx + 2, ty + 2, tw - 4, th - 4);
  ctx.clip();
  ctx.fillText(label, tx + tw / 2, ty + th / 2 - (cellSize >= 36 ? 4 : 0));
  ctx.restore();
}

/**
 * Draw staircase tile with stripe pattern, pair label, and optional warning.
 */
function drawStaircaseTile(col, row, tile, tx, ty, tw, th, r, colors, cellSize) {
  // Base fill
  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, r);
  ctx.fillStyle = colors.fill;
  ctx.fill();

  // Clip for stripes
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, r);
  ctx.clip();

  const stripeW = Math.max(4, cellSize * 0.18);
  ctx.strokeStyle = colors.stripe;
  ctx.lineWidth = stripeW * 0.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  const diag = tw + th;
  for (let i = -diag; i < diag * 2; i += stripeW * 2) {
    ctx.moveTo(tx + i, ty);
    ctx.lineTo(tx + i + diag, ty + diag);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Border
  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, r);
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Staircase steps icon
  if (cellSize >= 32) {
    drawStaircaseIcon(tx + 3, ty + 3, tw - 6, th - 6, colors.stroke);
  }

  // Pair badge or warning icon
  const pairIdx = getPairIndex(col, row);
  if (pairIdx >= 0) {
    // Paired: show colored letter badge
    const label  = getPairLabel(pairIdx);
    const color  = PAIR_COLORS[pairIdx % PAIR_COLORS.length];
    const bSize  = Math.max(12, Math.min(18, cellSize * 0.38));
    const bx = tx + tw - bSize - 2;
    const by = ty + 2;

    ctx.beginPath();
    roundRect(ctx, bx, by, bSize, bSize, 3);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = `700 ${Math.max(8, bSize * 0.65)}px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bSize / 2, by + bSize / 2);
  } else if (cellSize >= 28) {
    // Unpaired: warning triangle
    drawWarningIcon(tx + tw - 14, ty + 2, 12, '#d97706');
  }
}

function drawWarningIcon(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = `700 ${Math.max(6, size * 0.55)}px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x + size / 2, y + size * 0.62);
  ctx.globalAlpha = 1;
}

function drawStaircaseIcon(x, y, w, h, color) {
  const steps = 3;
  const sw = w / steps;
  const sh = h / steps;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i < steps; i++) {
    ctx.lineTo(x + sw * i, y + h - sh * i);
    ctx.lineTo(x + sw * (i + 1), y + h - sh * i);
  }
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

/* ==============================================
   CANVAS — Coordinate helpers
=============================================== */
function eventToGridCoord(e) {
  const rect = canvas.getBoundingClientRect();
  const z    = AppState.ui.zoom;
  const cellSize = getEffectiveCellSize();
  const xInCanvas = (e.clientX - rect.left) / z;
  const yInCanvas = (e.clientY - rect.top)  / z;
  return {
    col: Math.floor(xInCanvas / cellSize),
    row: Math.floor(yInCanvas / cellSize),
  };
}

function inBounds(col, row) {
  const { gridCols, gridRows } = AppState.blueprint;
  return col >= 0 && col < gridCols && row >= 0 && row < gridRows;
}

/* ==============================================
   CANVAS — Efficient Single-Cell Redraw
=============================================== */
function redrawCell(col, row) {
  const cellSize = getEffectiveCellSize();
  const x = col * cellSize;
  const y = row * cellSize;
  ctx.clearRect(x, y, cellSize, cellSize);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, cellSize, cellSize);

  const tile = getTile(col, row);
  if (tile) drawTile(col, row, tile, cellSize);

  // Redraw grid lines
  ctx.beginPath();
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 0.75;
  ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + cellSize);
  ctx.moveTo(x + cellSize + 0.5, y); ctx.lineTo(x + cellSize + 0.5, y + cellSize);
  ctx.moveTo(x, y + 0.5); ctx.lineTo(x + cellSize, y + 0.5);
  ctx.moveTo(x, y + cellSize + 0.5); ctx.lineTo(x + cellSize, y + cellSize + 0.5);
  ctx.stroke();

  // R56: If this cell belongs to a multi-cell classroom, re-stamp the group's
  // label on top (resolved from the anchor) so a single-cell redraw of any
  // member can't leave the centered label clipped.
  if (tile && tile.type === 'classroom' && tile.groupId) {
    stampGroupLabel(col, row, tile.groupId, cellSize);
  }
}

/* ==============================================
   TOOL PLACEMENT — applyTool
=============================================== */
function applyTool(col, row) {
  if (!inBounds(col, row)) return;
  const tool = AppState.ui.activeTool;

  // Select and Pan tools are handled directly in the event layer, not here.
  if (tool === 'select' || tool === 'move') return;

  // ── Eraser ──
  if (tool === 'eraser') {
    const existing = getTile(col, row);
    if (existing) {
      // Clean up pairing if staircase
      if (existing.type === 'staircase') {
        const partner = getPairPartner(col, row);
        unpairStaircase(col, row);
        if (partner) redrawCell(partner.col, partner.row);
      }
      // Clean up classroom group if multi-cell
      if (existing.type === 'classroom' && existing.groupId) {
        eraseClassroomGroup(existing.groupId);
        return;
      }
      setTile(col, row, null);
      // If we just erased the selected cell, clear selection
      const sel = AppState.ui.selectedCell;
      if (sel && sel.col === col && sel.row === row) {
        AppState.ui.selectedCell = null;
        showRightPanel('empty');
      }
      redrawCell(col, row);
      updateTileStats();
      scheduleBlueprintAutosave();
    }
    return;
  }

  // ── Draw tile ──
  const existing = getTile(col, row);

  // Dummy tile: just place with active color
  if (tool === 'dummy') {
    if (existing && existing.type === 'dummy') {
      // Open editor on re-click
      AppState.ui.selectedCell = { col, row };
      showRightPanel('dummy', col, row, existing);
      return;
    }
    if (existing && existing.type === 'staircase') {
      const partner = getPairPartner(col, row);
      unpairStaircase(col, row);
      if (partner) redrawCell(partner.col, partner.row);
    }
    if (existing && existing.type === 'classroom' && existing.groupId) {
      eraseClassroomGroup(existing.groupId);
    }
    setTile(col, row, { type: 'dummy', dummyColor: activeDummyColor, dummyLabel: '' });
    redrawCell(col, row);
    updateTileStats();
    scheduleBlueprintAutosave();
    AppState.ui.selectedCell = { col, row };
    showRightPanel('dummy', col, row, getTile(col, row));
    return;
  }

  if (existing && existing.type === tool) {
    // Same type already here — for a classroom, still surface its editor so the
    // user can edit the room number on a repeat click.
    if (tool === 'classroom') focusClassroomEditor(col, row);
    return;
  }

  // If changing type, clean up old staircase pair
  if (existing && existing.type === 'staircase' && tool !== 'staircase') {
    const partner = getPairPartner(col, row);
    unpairStaircase(col, row);
    if (partner) redrawCell(partner.col, partner.row);
  }
  // Clean up classroom group if overwriting a grouped classroom
  if (existing && existing.type === 'classroom' && existing.groupId && tool !== 'classroom') {
    eraseClassroomGroup(existing.groupId);
    return;
  }

  // Preserve room data if re-placing classroom
  const roomData = (existing && existing.type === 'classroom' && tool === 'classroom')
    ? { roomNumber: existing.roomNumber, teacher: existing.teacher, wing: existing.wing }
    : {};

  setTile(col, row, { type: tool, ...roomData });
  redrawCell(col, row);
  updateTileStats();
  scheduleBlueprintAutosave();

  // When placing a classroom, jump straight to its room-number field so the
  // user can label it immediately.
  if (tool === 'classroom') focusClassroomEditor(col, row);
}

/** Erase all cells belonging to a classroom group */
function eraseClassroomGroup(groupId) {
  if (!groupId) return;
  const { gridData, gridCols, gridRows } = AppState.blueprint;
  const cellsToErase = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const t = gridData[r][c];
      if (t && t.type === 'classroom' && t.groupId === groupId) {
        cellsToErase.push({ col: c, row: r });
      }
    }
  }
  for (const { col, row } of cellsToErase) {
    setTile(col, row, null);
    redrawCell(col, row);
    const sel = AppState.ui.selectedCell;
    if (sel && sel.col === col && sel.row === row) {
      AppState.ui.selectedCell = null;
      showRightPanel('empty');
    }
  }
  updateTileStats();
  scheduleBlueprintAutosave();
}

/**
 * Place a multi-cell classroom group from (col1,row1) to (col2,row2).
 * All cells share a groupId; only (minCol,minRow) carries the room data.
 */
function placeClassroomGroup(col1, row1, col2, row2) {
  const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);

  // Generate a unique group ID
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  beginAction();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (!inBounds(c, r)) continue;
      // Clean up any existing tile
      const existing = getTile(c, r);
      if (existing) {
        if (existing.type === 'staircase') {
          const partner = getPairPartner(c, r);
          unpairStaircase(c, r);
          if (partner) redrawCell(partner.col, partner.row);
        }
        if (existing.type === 'classroom' && existing.groupId && existing.groupId !== groupId) {
          // Will be overwritten; if we need to clean old group, do it cell by cell
        }
      }
      setTile(c, r, { type: 'classroom', groupId });
    }
  }
  commitAction();

  // Redraw all affected cells
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      redrawCell(c, r);
    }
  }
  updateTileStats();
  scheduleBlueprintAutosave();

  // Open editor for anchor cell
  const anchorTile = getTile(minCol, minRow);
  AppState.ui.selectedCell = { col: minCol, row: minRow };
  renderCanvas();
  showRightPanel('classroom', minCol, minRow, anchorTile);
  const input = document.getElementById('rp-room-number');
  if (input) requestAnimationFrame(() => { input.focus(); input.select(); });
}

/**
 * Select a classroom tile, open its editor, and move the cursor into the
 * Room Number field. Used right after placing a classroom.
 * For multi-cell groups, always opens on the anchor (top-left) cell.
 */
function focusClassroomEditor(col, row) {
  let tile = getTile(col, row);
  if (!tile || tile.type !== 'classroom') return;

  // For grouped classrooms, redirect to anchor
  if (tile.groupId) {
    const bounds = getGroupBounds(col, row, tile.groupId);
    col = bounds.minCol;
    row = bounds.minRow;
    tile = getTile(col, row);
    if (!tile) return;
  }

  AppState.ui.selectedCell = { col, row };
  renderCanvas(); // show selection highlight
  showRightPanel('classroom', col, row, tile);
  const input = document.getElementById('rp-room-number');
  if (input) {
    // Defer focus to the next frame so the panel is fully visible first.
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }
}

/* ==============================================
   SELECT MODE
=============================================== */
function selectCell(col, row) {
  let selCol = col, selRow = row;

  // For grouped classrooms, redirect selection to anchor
  const tile = inBounds(col, row) ? getTile(col, row) : null;
  if (tile && tile.type === 'classroom' && tile.groupId) {
    const bounds = getGroupBounds(col, row, tile.groupId);
    selCol = bounds.minCol;
    selRow = bounds.minRow;
  }

  AppState.ui.selectedCell = inBounds(selCol, selRow) ? { col: selCol, row: selRow } : null;
  renderCanvas(); // re-render to show highlight

  if (!inBounds(selCol, selRow)) {
    showRightPanel('empty');
    return;
  }

  const selTile = getTile(selCol, selRow);
  if (!selTile) {
    showRightPanel('empty');
    return;
  }

  if (selTile.type === 'classroom') {
    showRightPanel('classroom', selCol, selRow, selTile);
  } else if (selTile.type === 'staircase') {
    showRightPanel('staircase', selCol, selRow, selTile);
  } else if (selTile.type === 'hallway') {
    showRightPanel('hallway', selCol, selRow, selTile);
  } else if (selTile.type === 'dummy') {
    showRightPanel('dummy', selCol, selRow, selTile);
  }
}

/* ==============================================
   RIGHT PANEL — Controller
=============================================== */
function showRightPanel(mode, col, row, tile) {
  // Cancel doorway mode if navigating away from classroom
  if (AppState.ui.isDoorwayMode && mode !== 'classroom') {
    exitDoorwayMode(false);
  }

  const ids = ['rp-empty-state', 'rp-classroom-editor', 'rp-staircase-editor',
               'rp-move-feedback', 'rp-hallway-info', 'rp-dummy-editor',
               'rp-corridor-label-tool', 'rp-heat-exclude-editor', 'rp-heat-exclude-tool'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  if (mode === 'empty') {
    document.getElementById('rp-empty-state').style.display = '';
  } else if (mode === 'classroom') {
    showClassroomEditor(col, row, tile);
  } else if (mode === 'staircase') {
    showStaircaseEditor(col, row, tile);
  } else if (mode === 'move') {
    document.getElementById('rp-move-feedback').style.display = '';
    const cancelSec = document.getElementById('rp-move-cancel-section');
    if (cancelSec) cancelSec.style.display = 'none';
  } else if (mode === 'hallway') {
    showHallwayEditor(col, row, tile);
  } else if (mode === 'dummy') {
    showDummyEditor(col, row, tile);
  } else if (mode === 'corridor-label-info') {
    showCorridorLabelToolPanel();
  } else if (mode === 'heat-exclude-zone') {
    showHeatExcludeZoneEditor(tile); // tile is the zone object here
  } else if (mode === 'heat-exclude-tool') {
    showHeatExcludeToolPanel();
  }
}

/* ==============================================
   HALLWAY EDITOR (Change 5: corridor labels)
=============================================== */
function showHallwayEditor(col, row, tile) {
  document.getElementById('rp-hallway-info').style.display = '';
  document.getElementById('rp-hallway-coord').textContent = `Col ${col + 1}, Row ${row + 1}`;

  const input = document.getElementById('rp-corridor-label');
  if (input) {
    input.value = tile && tile.corridorLabel ? tile.corridorLabel : '';
  }

  // Evacuation: exterior-exit checkbox + its two fields.
  const exitChk    = document.getElementById('rp-hallway-is-exit');
  const exitFields = document.getElementById('rp-hallway-exit-fields');
  const exitLabel  = document.getElementById('rp-exit-label');
  const exitAssembly = document.getElementById('rp-exit-assembly');
  if (exitChk) {
    exitChk.checked = !!(tile && tile.isExit);
    if (exitFields) exitFields.style.display = exitChk.checked ? '' : 'none';
    // Replace any prior listener by cloning (same pattern as the Apply button below).
    const newChk = exitChk.cloneNode(true);
    exitChk.parentNode.replaceChild(newChk, exitChk);
    newChk.addEventListener('change', () => {
      if (exitFields) exitFields.style.display = newChk.checked ? '' : 'none';
    });
  }
  if (exitLabel)    exitLabel.value    = (tile && tile.exitLabel)    ? tile.exitLabel    : '';
  if (exitAssembly) exitAssembly.value = (tile && tile.assemblyPoint) ? tile.assemblyPoint : '';

  // Store target for the Apply button
  AppState.ui.editorTarget = { col, row };

  // Wire Apply button (replace any prior listener by cloning)
  const applyBtn = document.getElementById('rp-btn-save-corridor');
  if (applyBtn) {
    const newBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newBtn, applyBtn);
    newBtn.addEventListener('click', () => {
      const target = AppState.ui.editorTarget;
      if (!target) return;
      const t = getTile(target.col, target.row);
      if (!t) return;
      const labelVal = (document.getElementById('rp-corridor-label')?.value || '').trim();
      if (labelVal) {
        t.corridorLabel = labelVal;
      } else {
        delete t.corridorLabel;
      }
      // Evacuation: exterior-exit marker + its two optional labels.
      const isExitNow = !!document.getElementById('rp-hallway-is-exit')?.checked;
      if (isExitNow) {
        t.isExit = true;
        const dLabel = (document.getElementById('rp-exit-label')?.value || '').trim();
        const aLabel = (document.getElementById('rp-exit-assembly')?.value || '').trim();
        if (dLabel) t.exitLabel = dLabel; else delete t.exitLabel;
        if (aLabel) t.assemblyPoint = aLabel; else delete t.assemblyPoint;
      } else {
        delete t.isExit;
        delete t.exitLabel;
        delete t.assemblyPoint;
      }
      scheduleBlueprintAutosave();
      renderCanvas();
      showToast('Hallway settings saved', 'success');
    });
  }
}

/* ==============================================
   CORRIDOR LABEL TOOL
=============================================== */

/** Update the right panel info for the corridor-label tool. */
function showCorridorLabelToolPanel() {
  const panel = document.getElementById('rp-corridor-label-tool');
  if (!panel) return;
  panel.style.display = '';
  updateCorridorLabelPanelCount();
  // Wire Apply button (one-time; use cloneNode to avoid duplicate listeners)
  const applyBtn = document.getElementById('rp-btn-open-corridor-label');
  if (applyBtn) {
    const nb = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(nb, applyBtn);
    nb.addEventListener('click', openCorridorLabelModal);
  }
  const clearBtn = document.getElementById('rp-btn-clear-corridor-selection');
  if (clearBtn) {
    const nb2 = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(nb2, clearBtn);
    nb2.addEventListener('click', () => {
      AppState.ui.corridorLabelCells.clear();
      updateCorridorLabelPanelCount();
      renderCanvas();
    });
  }
}

/** Update the count subtitle and button enable/disable in the right panel. */
function updateCorridorLabelPanelCount() {
  const n = AppState.ui.corridorLabelCells.size;
  const sub = document.getElementById('rp-cl-count-subtitle');
  if (sub) sub.textContent = n === 0 ? 'No tiles selected' : `${n} hallway tile${n === 1 ? '' : 's'} selected`;
  const applyBtn = document.getElementById('rp-btn-open-corridor-label');
  const clearBtn = document.getElementById('rp-btn-clear-corridor-selection');
  if (applyBtn) applyBtn.disabled = (n === 0);
  if (clearBtn) clearBtn.disabled = (n === 0);
}

/** Toggle a hallway tile into/out of the corridor-label selection. */
function corridorLabelToggleCell(col, row) {
  const tile = getTile(col, row);
  if (!tile || tile.type !== 'hallway') return;
  const key = col + ',' + row;
  if (AppState.ui.corridorLabelCells.has(key)) {
    AppState.ui.corridorLabelCells.delete(key);
  } else {
    AppState.ui.corridorLabelCells.add(key);
  }
  if (AppState.ui.activeTool === 'corridor-label') updateCorridorLabelPanelCount();
  renderCanvas();
}

/** Add a hallway cell to the selection (used during drag). */
function corridorLabelAddCell(col, row) {
  const tile = getTile(col, row);
  if (!tile || tile.type !== 'hallway') return;
  const key = col + ',' + row;
  if (!AppState.ui.corridorLabelCells.has(key)) {
    AppState.ui.corridorLabelCells.add(key);
    if (AppState.ui.activeTool === 'corridor-label') updateCorridorLabelPanelCount();
    renderCanvas();
  }
}

/** Open the corridor label naming modal. */
function openCorridorLabelModal() {
  const n = AppState.ui.corridorLabelCells.size;
  if (n === 0) return;
  const countEl = document.getElementById('corridor-label-count');
  if (countEl) countEl.textContent = String(n);
  // Pre-fill with any existing shared label from the selected tiles
  const keys = [...AppState.ui.corridorLabelCells];
  const labels = keys.map(k => {
    const [c, r] = k.split(',').map(Number);
    const t = getTile(c, r);
    return t && t.corridorLabel ? t.corridorLabel : '';
  }).filter(Boolean);
  const sharedLabel = (labels.length > 0 && labels.every(l => l === labels[0])) ? labels[0] : '';
  const input = document.getElementById('corridor-label-input');
  if (input) input.value = sharedLabel;
  openModal('corridor-label-modal');
  setTimeout(() => input && input.focus(), 80);
}

/** Apply the label from the modal to all selected hallway tiles. */
function applyCorridorLabelToSelection() {
  const input = document.getElementById('corridor-label-input');
  const labelVal = (input ? input.value : '').trim();
  let changed = 0;
  for (const key of AppState.ui.corridorLabelCells) {
    const [c, r] = key.split(',').map(Number);
    const t = getTile(c, r);
    if (!t || t.type !== 'hallway') continue;
    if (labelVal) t.corridorLabel = labelVal;
    else delete t.corridorLabel;
    changed++;
  }
  if (changed > 0) {
    scheduleBlueprintAutosave();
    showToast(`Label ${labelVal ? '"' + labelVal + '"' : 'cleared'} applied to ${changed} tile${changed === 1 ? '' : 's'}.`, 'success');
  }
  AppState.ui.corridorLabelCells.clear();
  updateCorridorLabelPanelCount();
  renderCanvas();
  closeModal('corridor-label-modal');
}

/** Wire the corridor-label modal buttons. */
function initCorridorLabelModal() {
  document.getElementById('corridor-label-apply')?.addEventListener('click', applyCorridorLabelToSelection);
  document.getElementById('corridor-label-cancel')?.addEventListener('click', () => closeModal('corridor-label-modal'));
  document.getElementById('corridor-label-x')?.addEventListener('click', () => closeModal('corridor-label-modal'));
  // Allow Enter to submit
  document.getElementById('corridor-label-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCorridorLabelToSelection(); }
    if (e.key === 'Escape') { e.preventDefault(); closeModal('corridor-label-modal'); }
  });
}

/* ==============================================
   CLASSROOM EDITOR
=============================================== */
function showClassroomEditor(col, row, tile) {
  document.getElementById('rp-classroom-editor').style.display = '';
  const groupId = tile && tile.groupId;
  if (groupId) {
    const bounds = getGroupBounds(col, row, groupId);
    const w = bounds.maxCol - bounds.minCol + 1;
    const h = bounds.maxRow - bounds.minRow + 1;
    document.getElementById('rp-classroom-coord').textContent =
      `${w}×${h} room · Col ${col + 1}, Row ${row + 1}`;
  } else {
    document.getElementById('rp-classroom-coord').textContent = `Col ${col + 1}, Row ${row + 1}`;
  }

  // Populate fields
  document.getElementById('rp-room-number').value  = tile.roomNumber  || '';
  document.getElementById('rp-teacher-name').value = tile.teacher      || '';
  populateDeptDropdown(tile.dept || '');   // R59: options from settings.subjects, unknown code preserved
  document.getElementById('rp-teacher-dept').value = tile.dept         || '';
  document.getElementById('rp-wing-label').value   = tile.wing         || '';
  document.getElementById('rp-exclude-conflict').checked = !!(tile.excludeFromConflict);

  document.getElementById('rp-room-number').classList.remove('required-empty');

  // Store target cell for save/clear
  AppState.ui.editorTarget = { col, row };

  // Render doorway section
  renderDoorList(col, row, tile);
  // Reset doorway mode UI state
  exitDoorwayMode(false);
}

document.getElementById('rp-btn-save-room').addEventListener('click', () => {
  const target = AppState.ui.editorTarget;
  if (!target) return;

  const roomNumber = document.getElementById('rp-room-number').value.trim();
  if (!roomNumber) {
    document.getElementById('rp-room-number').classList.add('required-empty');
    document.getElementById('rp-room-number').focus();
    showToast('Room number is required.', 'error');
    return;
  }
  document.getElementById('rp-room-number').classList.remove('required-empty');

  // Prevent duplicate room numbers — each room number must be unique across
  // the building, otherwise pathfinding and schedules become ambiguous.
  const dupKey = roomNumber.toLowerCase();
  const bp = AppState.blueprint;
  const anchorTile = getTile(target.col, target.row);
  const anchorGroupId = anchorTile && anchorTile.groupId;
  let duplicateAt = null;
  for (let r = 0; r < bp.gridRows && !duplicateAt; r++) {
    for (let c = 0; c < bp.gridCols; c++) {
      if (c === target.col && r === target.row) continue;
      const other = bp.gridData[r] && bp.gridData[r][c];
      // Skip cells in the same group
      if (other && other.type === 'classroom' && other.groupId && other.groupId === anchorGroupId) continue;
      if (other && other.type === 'classroom' && other.roomNumber &&
          other.roomNumber.trim().toLowerCase() === dupKey) {
        duplicateAt = { col: c, row: r };
        break;
      }
    }
  }
  if (duplicateAt) {
    document.getElementById('rp-room-number').classList.add('required-empty');
    document.getElementById('rp-room-number').focus();
    showToast(`Room number "${roomNumber}" is already assigned to another classroom. Use a unique number.`, 'error');
    return;
  }

  const tile = getTile(target.col, target.row);
  if (!tile) return;

  beginAction();
  tile.roomNumber = roomNumber;
  tile.teacher    = document.getElementById('rp-teacher-name').value.trim() || null;
  tile.dept       = document.getElementById('rp-teacher-dept').value || null;
  tile.wing       = document.getElementById('rp-wing-label').value.trim()   || null;
  tile.excludeFromConflict = document.getElementById('rp-exclude-conflict').checked || false;

  setTile(target.col, target.row, tile);

  // For grouped classrooms, propagate teacher & wing to all cells, clear roomNumber on non-anchors
  if (tile.groupId) {
    const { gridData, gridCols, gridRows } = bp;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (c === target.col && r === target.row) continue;
        const t = gridData[r][c];
        if (t && t.type === 'classroom' && t.groupId === tile.groupId) {
          t.teacher = tile.teacher;
          t.dept    = tile.dept;
          t.wing    = tile.wing;
          t.roomNumber = null; // only anchor holds roomNumber
          redrawCell(c, r);
        }
      }
    }
  }
  commitAction();
  rebuildRoomRegistry(); // Propagate teacher/dept changes to roomRegistry & schedule browser
  redrawCell(target.col, target.row);
  renderCanvas(); // Re-apply selection highlight
  scheduleBlueprintAutosave();
  showToast(`Room "${roomNumber}" saved.`, 'success');
});

// Enter key on the room number input saves and blurs the field
document.getElementById('rp-room-number').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('rp-btn-save-room').click();
    document.getElementById('rp-room-number').blur();
  }
});

document.getElementById('rp-btn-clear-room').addEventListener('click', () => {
  const target = AppState.ui.editorTarget;
  if (!target) return;

  const tile = getTile(target.col, target.row);
  if (!tile) return;

  if (!confirm('Clear room assignment for this classroom?')) return;

  beginAction();
  tile.roomNumber = null;
  tile.teacher    = null;
  tile.dept       = null;
  tile.wing       = null;
  tile.doors      = null;
  tile.excludeFromConflict = false;

  setTile(target.col, target.row, tile);
  commitAction();
  rebuildRoomRegistry(); // Propagate cleared teacher/dept to roomRegistry & schedule browser
  document.getElementById('rp-room-number').value  = '';
  document.getElementById('rp-teacher-name').value = '';
  document.getElementById('rp-teacher-dept').value = '';
  document.getElementById('rp-wing-label').value   = '';
  document.getElementById('rp-exclude-conflict').checked = false;
  renderDoorList(target.col, target.row, tile);
  redrawCell(target.col, target.row);
  renderCanvas();
  scheduleBlueprintAutosave();
  showToast('Room assignment cleared.', 'info');
});

/* ==============================================
   DOORWAY MANAGEMENT
=============================================== */

/**
 * Render the door list in the right panel for the classroom at (col, row).
 */
function renderDoorList(col, row, tile) {
  const listEl = document.getElementById('rp-door-list');
  if (!listEl) return;
  const groupId = tile && tile.groupId;
  const doors = getClassroomDoors(col, row, groupId);

  if (doors.length === 0) {
    listEl.innerHTML = `<div class="rp-door-empty">No explicit doors set — entry from any adjacent hallway.</div>`;
    return;
  }

  listEl.innerHTML = '';
  const sideLabel = { top: '↑ Top', bottom: '↓ Bottom', left: '← Left', right: '→ Right' };
  doors.forEach((door, i) => {
    const item = document.createElement('div');
    item.className = 'rp-door-item';
    item.innerHTML = `
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3h6v18H3z"/><path d="M9 12h6"/><path d="M15 3h6v18h-6z"/>
      </svg>
      Door ${i + 1}: Col ${door.col + 1}, Row ${door.row + 1} — ${sideLabel[door.side]}
      <button class="rp-door-remove" data-door-index="${i}" title="Remove this door">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll('.rp-door-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.doorIndex, 10);
      removeDoor(idx);
    });
  });
}

function removeDoor(index) {
  const target = AppState.ui.editorTarget;
  if (!target) return;
  const tile = getTile(target.col, target.row);
  if (!tile) return;
  const anchorTile = getAnchorTile(target.col, target.row, tile.groupId);
  if (!anchorTile || !anchorTile.doors) return;

  beginAction();
  anchorTile.doors.splice(index, 1);
  commitAction();

  renderDoorList(target.col, target.row, tile);
  redrawGroupOrCell(target.col, target.row, tile.groupId);
  scheduleBlueprintAutosave();
}

function getAnchorTile(col, row, groupId) {
  if (!groupId) return getTile(col, row);
  const bounds = getGroupBounds(col, row, groupId);
  return getTile(bounds.minCol, bounds.minRow);
}

function redrawGroupOrCell(col, row, groupId) {
  if (groupId) {
    const bounds = getGroupBounds(col, row, groupId);
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        redrawCell(c, r);
      }
    }
  } else {
    redrawCell(col, row);
  }
  renderCanvas();
}

/** Enter doorway placement mode */
function enterDoorwayMode() {
  AppState.ui.isDoorwayMode = true;
  const target = AppState.ui.editorTarget;
  AppState.ui.doorwayTarget = target ? { ...target } : null;

  document.getElementById('rp-doorway-mode-banner').style.display = '';
  document.getElementById('rp-btn-set-doorway').style.display = 'none';
  document.getElementById('rp-btn-cancel-doorway').style.display = '';
  document.getElementById('rp-doorway-hint').style.display = 'none';

  // Change canvas cursor
  if (canvas) canvas.classList.add('tool-doorway');
  updateStatusBar();
  showToast('Doorway mode — click an edge of this classroom to place a door.', 'info');
}

/** Exit doorway placement mode */
function exitDoorwayMode(redraw = true) {
  AppState.ui.isDoorwayMode = false;
  AppState.ui.doorwayTarget = null;

  const banner = document.getElementById('rp-doorway-mode-banner');
  const btnSet = document.getElementById('rp-btn-set-doorway');
  const btnCancel = document.getElementById('rp-btn-cancel-doorway');
  const hint = document.getElementById('rp-doorway-hint');
  if (banner) banner.style.display = 'none';
  if (btnSet) btnSet.style.display = '';
  if (btnCancel) btnCancel.style.display = 'none';
  if (hint) hint.style.display = '';

  if (canvas) canvas.classList.remove('tool-doorway');
  if (redraw) updateStatusBar();
}

/**
 * Handle a click in doorway mode: determine which classroom cell edge was clicked
 * and add/toggle a door there.
 */
function handleDoorwayClick(col, row, xInCell, yInCell, cellSize) {
  const dtTarget = AppState.ui.doorwayTarget;
  if (!dtTarget) return;

  const tile = getTile(dtTarget.col, dtTarget.row);
  if (!tile || tile.type !== 'classroom') { exitDoorwayMode(); return; }
  const groupId = tile.groupId;

  // Must click on a cell belonging to this classroom (or auto-switch to another classroom)
  const clickedTile = getTile(col, row);
  if (!clickedTile || clickedTile.type !== 'classroom') return;

  // AUTO-SWITCH: if the user clicked a different classroom/group, redirect doorway mode
  // to that classroom instead of silently ignoring the click.
  const clickedOnDifferentClassroom =
    (groupId && clickedTile.groupId !== groupId) ||
    (!groupId && (col !== dtTarget.col || row !== dtTarget.row) && clickedTile.type === 'classroom');

  if (clickedOnDifferentClassroom) {
    // Resolve anchor of the newly-clicked classroom
    const newGroupId = clickedTile.groupId;
    let anchorCol = col, anchorRow = row;
    if (newGroupId) {
      const bounds = getGroupBounds(col, row, newGroupId);
      anchorCol = bounds.minCol;
      anchorRow = bounds.minRow;
    }
    const newAnchorTile = getTile(anchorCol, anchorRow);
    if (!newAnchorTile || newAnchorTile.type !== 'classroom') return;

    // Update doorway mode to point at the new classroom
    AppState.ui.doorwayTarget = { col: anchorCol, row: anchorRow };

    // Refresh the right panel to show the new room's door list
    showRightPanel('classroom', anchorCol, anchorRow, newAnchorTile);
    // Re-enter doorway mode so the banner + UI stays active for the new room
    enterDoorwayMode({ col: anchorCol, row: anchorRow });
    showToast(`Switched to classroom ${newAnchorTile.roomNumber || '(unnamed)'}.`, 'info');

    // Now place the door on the newly-selected classroom at the clicked position
    handleDoorwayClick(col, row, xInCell, yInCell, cellSize);
    return;
  }

  const doorSpec = detectDoorSide(col, row, groupId, xInCell, yInCell, cellSize);
  if (!doorSpec) { showToast('Click closer to an edge of the classroom to place a door.', 'info'); return; }

  // Get/create doors array on anchor tile
  const anchorTile = getAnchorTile(dtTarget.col, dtTarget.row, groupId);
  if (!anchorTile) return;

  beginAction();
  if (!anchorTile.doors) anchorTile.doors = [];

  // Toggle: if same door already exists, remove it; otherwise add it
  const existingIdx = anchorTile.doors.findIndex(
    d => d.col === doorSpec.col && d.row === doorSpec.row && d.side === doorSpec.side
  );
  if (existingIdx >= 0) {
    anchorTile.doors.splice(existingIdx, 1);
    showToast('Door removed.', 'info');
  } else {
    anchorTile.doors.push(doorSpec);
    showToast('Door placed.', 'success');
  }
  commitAction();

  // Re-render door list and cell
  renderDoorList(dtTarget.col, dtTarget.row, tile);
  redrawGroupOrCell(dtTarget.col, dtTarget.row, groupId);
  scheduleBlueprintAutosave();
}

// Wire doorway buttons
document.getElementById('rp-btn-set-doorway').addEventListener('click', enterDoorwayMode);
document.getElementById('rp-btn-cancel-doorway').addEventListener('click', () => exitDoorwayMode(true));

/* ==============================================
   STAIRCASE EDITOR
=============================================== */
function showStaircaseEditor(col, row, tile) {
  document.getElementById('rp-staircase-editor').style.display = '';
  document.getElementById('rp-staircase-coord').textContent = `Col ${col + 1}, Row ${row + 1}`;
  AppState.ui.editorTarget = { col, row };
  refreshStaircasePanel(col, row);
}

function refreshStaircasePanel(col, row) {
  const pairIdx = getPairIndex(col, row);
  const partner = getPairPartner(col, row);
  const isPairingMode = AppState.ui.isPairingMode;

  const indicator = document.getElementById('rp-pair-indicator');
  const targetInfo = document.getElementById('rp-pair-target-info');
  const partnerCoords = document.getElementById('rp-pair-partner-coords');
  const pairingBanner = document.getElementById('rp-pairing-mode-banner');
  const btnPairWith  = document.getElementById('rp-btn-pair-with');
  const btnCancel    = document.getElementById('rp-btn-cancel-pair');
  const btnUnpair    = document.getElementById('rp-btn-unpair');
  refreshPairAccessFields(col, row);

  const src = AppState.ui.pairingSource;
  const activeFloorId = getActiveFloorData().id;
  const srcIsThisCell = isPairingMode && src &&
    src.col === col && src.row === row && (src.floorId || activeFloorId) === activeFloorId;
  const srcIsOtherFloor = isPairingMode && src &&
    src.floorId && src.floorId !== activeFloorId;

  if (srcIsThisCell) {
    // This is the source staircase — show "waiting" state
    indicator.className = 'pair-indicator unpaired';
    indicator.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:currentColor;fill:none;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Click another staircase to pair with, or switch floors first</span>`;
    pairingBanner.style.display = '';
    targetInfo.style.display    = 'none';
    btnPairWith.style.display   = 'none';
    btnCancel.style.display     = '';
    btnUnpair.style.display     = 'none';
  } else if (srcIsOtherFloor) {
    // Source is on another floor — this staircase is a candidate destination
    const srcLabel = floorLabelById(src.floorId);
    indicator.className = 'pair-indicator unpaired';
    indicator.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:currentColor;fill:none;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Click <strong>Pair Here</strong> to link with source on ${srcLabel}</span>`;
    pairingBanner.style.display = '';
    targetInfo.style.display    = 'none';
    btnPairWith.style.display   = 'none';
    // Repurpose cancel as "pair here" + cancel via existing cancel btn
    btnCancel.style.display     = '';
    btnUnpair.style.display     = 'none';
    // Add a "Pair Here" button dynamically if not already present
    let pairHereBtn = document.getElementById('rp-btn-pair-here');
    if (!pairHereBtn) {
      pairHereBtn = document.createElement('button');
      pairHereBtn.id        = 'rp-btn-pair-here';
      pairHereBtn.className = 'rp-btn primary';
      pairHereBtn.style.marginBottom = 'var(--sp-2)';
      pairHereBtn.textContent = '🔗 Pair Here';
      btnCancel.parentNode.insertBefore(pairHereBtn, btnCancel);
    }
    pairHereBtn.style.display = '';
    pairHereBtn.onclick = () => completePairing(col, row);
    // Hide the dynamically inserted "Pair Here" btn in all other branches
  } else if (pairIdx >= 0 && partner) {
    const label = getPairLabel(pairIdx);
    const color = PAIR_COLORS[pairIdx % PAIR_COLORS.length];
    indicator.className = 'pair-indicator paired';
    indicator.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:currentColor;fill:none;"><polyline points="20 6 9 17 4 12"/></svg><span>Paired as <strong style="color:${color}">Pair ${label}</strong></span>`;
    pairingBanner.style.display = 'none';
    targetInfo.style.display    = '';
    const crossFloor = partner.floorId && partner.floorId !== getActiveFloorData().id;
    partnerCoords.textContent   = crossFloor
      ? `${floorLabelById(partner.floorId)}, Col ${partner.col + 1}, Row ${partner.row + 1}`
      : `Col ${partner.col + 1}, Row ${partner.row + 1}`;
    btnPairWith.style.display   = 'none';
    btnCancel.style.display     = 'none';
    btnUnpair.style.display     = '';
    const existingPairHere = document.getElementById('rp-btn-pair-here');
    if (existingPairHere) existingPairHere.style.display = 'none';
  } else {
    indicator.className = 'pair-indicator unpaired';
    indicator.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:currentColor;fill:none;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>Unpaired — not functional for pathfinding</span>`;
    pairingBanner.style.display = 'none';
    targetInfo.style.display    = 'none';
    btnPairWith.style.display   = '';
    btnCancel.style.display     = 'none';
    btnUnpair.style.display     = 'none';
    const existingPairHere = document.getElementById('rp-btn-pair-here');
    if (existingPairHere) existingPairHere.style.display = 'none';
  }
}

/* Path 11 P3: the pair's access kind and out-of-service flag, shown only
   while this staircase is paired and no pairing is in progress. */
function refreshPairAccessFields(col, row) {
  const section = document.getElementById('rp-pair-access-section');
  if (!section) return;
  const idx = getPairIndex(col, row);
  const pair = idx >= 0 ? AppState.blueprint.crossFloorPairs[idx] : null;
  section.style.display = (pair && !AppState.ui.isPairingMode) ? '' : 'none';
  if (!pair) return;
  const access = (pair.access === 'elevator' || pair.access === 'ramp') ? pair.access : 'stairs';
  document.getElementById('rp-pair-access').value = access;
  document.getElementById('rp-pair-oos-row').style.display = access === 'elevator' ? '' : 'none';
  document.getElementById('rp-pair-out-of-service').checked = access === 'elevator' && pair.outOfService === true;
}

function applyPairAccess() {
  const target = AppState.ui.editorTarget;
  if (!target) return;
  const idx = getPairIndex(target.col, target.row);
  if (idx < 0) return;
  const pair = AppState.blueprint.crossFloorPairs[idx];
  const access = document.getElementById('rp-pair-access').value;
  const oos = document.getElementById('rp-pair-out-of-service').checked;
  beginAction();
  if (access === 'elevator' || access === 'ramp') pair.access = access; else delete pair.access;
  if (access === 'elevator' && oos) pair.outOfService = true; else delete pair.outOfService;
  commitAction();
  invalidatePathfindingGraph();
  refreshPairAccessFields(target.col, target.row);
  renderCanvas();
  scheduleBlueprintAutosave();
}
document.getElementById('rp-pair-access')?.addEventListener('change', applyPairAccess);
document.getElementById('rp-pair-out-of-service')?.addEventListener('change', applyPairAccess);

document.getElementById('rp-btn-pair-with').addEventListener('click', () => {
  const target = AppState.ui.editorTarget;
  if (!target) return;

  AppState.ui.isPairingMode  = true;
  AppState.ui.pairingSource  = { col: target.col, row: target.row, floorId: getActiveFloorData().id };

  refreshStaircasePanel(target.col, target.row);
  updateFloorPairingBanner();
  renderCanvas();
  updateStatusBar();
  showToast('Pairing mode active — click another staircase, or switch floors first.', 'info');
});

document.getElementById('rp-btn-cancel-pair').addEventListener('click', () => {
  cancelPairingMode();
});

document.getElementById('rp-btn-unpair').addEventListener('click', () => {
  const target = AppState.ui.editorTarget;
  if (!target) return;
  const partner = getPairPartner(target.col, target.row);
  beginAction();
  unpairStaircase(target.col, target.row);
  commitAction();
  redrawCell(target.col, target.row);
  if (partner && (!partner.floorId || partner.floorId === getActiveFloorData().id))
    redrawCell(partner.col, partner.row);
  refreshStaircasePanel(target.col, target.row);
  scheduleBlueprintAutosave();
  showToast('Staircase unpaired.', 'info');
});

function cancelPairingMode() {
  AppState.ui.isPairingMode = false;
  AppState.ui.pairingSource = null;
  updateFloorPairingBanner();
  const target = AppState.ui.editorTarget;
  if (target) refreshStaircasePanel(target.col, target.row);
  renderCanvas();
  updateStatusBar();
}

/* R43: Show/hide the cross-floor pairing banner in the floor-manager-strip. */
function updateFloorPairingBanner() {
  const banner = document.getElementById('floor-pairing-banner');
  if (!banner) return;
  const src = AppState.ui.pairingSource;
  if (AppState.ui.isPairingMode && src) {
    const srcFloorId    = src.floorId || getActiveFloorData().id;
    const activeFloorId = getActiveFloorData().id;
    const sameFloor     = srcFloorId === activeFloorId;
    const srcFloorLabel = floorLabelById(srcFloorId);
    const textEl = document.getElementById('floor-pairing-banner-text');
    if (textEl) {
      textEl.textContent = sameFloor
        ? 'Pairing mode — switch floors, then click a staircase to link'
        : `Pairing from ${srcFloorLabel} — click a staircase on this floor to complete`;
    }
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

/* ==============================================
   DUMMY ROOM EDITOR
=============================================== */
const DUMMY_COLOR_PRESETS_NAMED = [
  { color: '#e9d5ff', name: 'Purple' },
  { color: '#fce7f3', name: 'Pink' },
  { color: '#d1fae5', name: 'Green' },
  { color: '#fef3c7', name: 'Amber' },
  { color: '#dbeafe', name: 'Blue' },
  { color: '#fee2e2', name: 'Red' },
  { color: '#f3f4f6', name: 'Grey' },
  { color: '#fef9c3', name: 'Yellow' },
];

function buildDummyColorPicker(currentColor) {
  const row = document.getElementById('rp-dummy-color-row');
  if (!row) return;
  row.innerHTML = '';

  DUMMY_COLOR_PRESETS_NAMED.forEach(({ color, name }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rp-dummy-color-preset' + (color === currentColor ? ' selected' : '');
    btn.style.background = color;
    btn.title = name;
    btn.addEventListener('click', () => {
      row.querySelectorAll('.rp-dummy-color-preset, .rp-dummy-custom-swatch').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
      // Update preview in header
      const headerIcon = document.getElementById('rp-dummy-header-icon');
      if (headerIcon) headerIcon.style.background = color;
    });
    row.appendChild(btn);
  });

  // Custom color picker
  const wrap = document.createElement('div');
  wrap.className = 'rp-dummy-custom-wrap';
  const swatch = document.createElement('div');
  const isCustom = !DUMMY_COLOR_PRESETS_NAMED.some(p => p.color === currentColor);
  swatch.className = 'rp-dummy-custom-swatch' + (isCustom ? ' selected' : '');
  swatch.style.background = isCustom ? currentColor : 'transparent';
  swatch.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07A10 10 0 0 1 4.93 4.93"/></svg>`;
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = isCustom ? currentColor : '#ffffff';
  colorInput.title = 'Custom color';
  colorInput.addEventListener('input', () => {
    swatch.style.background = colorInput.value;
    row.querySelectorAll('.rp-dummy-color-preset').forEach(el => el.classList.remove('selected'));
    swatch.classList.add('selected');
    const headerIcon = document.getElementById('rp-dummy-header-icon');
    if (headerIcon) headerIcon.style.background = colorInput.value;
  });
  swatch.appendChild(colorInput);
  wrap.appendChild(swatch);
  row.appendChild(wrap);
}

function getSelectedDummyColor() {
  const row = document.getElementById('rp-dummy-color-row');
  if (!row) return DUMMY_COLOR_PRESETS[0];
  const selectedPreset = row.querySelector('.rp-dummy-color-preset.selected');
  if (selectedPreset) return selectedPreset.style.background || DUMMY_COLOR_PRESETS[0];
  const customSwatch = row.querySelector('.rp-dummy-custom-swatch.selected');
  if (customSwatch) {
    const colorInput = customSwatch.querySelector('input[type="color"]');
    if (colorInput) return colorInput.value;
  }
  return DUMMY_COLOR_PRESETS[0];
}

function showDummyEditor(col, row, tile) {
  document.getElementById('rp-dummy-editor').style.display = '';
  document.getElementById('rp-dummy-coord').textContent = `Col ${col + 1}, Row ${row + 1}`;
  AppState.ui.editorTarget = { col, row };

  const currentColor = tile.dummyColor || DUMMY_COLOR_PRESETS[0];
  const headerIcon = document.getElementById('rp-dummy-header-icon');
  if (headerIcon) headerIcon.style.background = currentColor;

  document.getElementById('rp-dummy-label').value = tile.dummyLabel || '';
  buildDummyColorPicker(currentColor);
}

document.getElementById('rp-btn-save-dummy').addEventListener('click', () => {
  const target = AppState.ui.editorTarget;
  if (!target) return;
  const tile = getTile(target.col, target.row);
  if (!tile || tile.type !== 'dummy') return;

  // Convert rgb(...) from style to hex if needed
  const rawColor = getSelectedDummyColor();
  const newColor = rgbStringToHex(rawColor) || rawColor;
  const newLabel = document.getElementById('rp-dummy-label').value.trim();

  beginAction();
  tile.dummyColor = newColor;
  tile.dummyLabel = newLabel;
  setTile(target.col, target.row, tile);
  commitAction();

  activeDummyColor = newColor;
  updateDummyToolSwatch();

  redrawCell(target.col, target.row);
  renderCanvas();
  scheduleBlueprintAutosave();
  showToast('Dummy room updated.', 'success');
});

function rgbStringToHex(str) {
  if (!str || str.startsWith('#')) return str;
  const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return str;
  return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
}

function updateDummyToolSwatch() {
  const swatch = document.getElementById('dummy-tool-swatch');
  if (swatch) swatch.style.background = activeDummyColor;
  const legendSwatch = document.getElementById('legend-dummy-swatch');
  if (legendSwatch) legendSwatch.style.background = activeDummyColor;
}

function completePairing(col, row) {
  const src = AppState.ui.pairingSource;
  if (!src) return;
  const srcFloorId = src.floorId || getActiveFloorData().id;
  const tgtFloorId = getActiveFloorData().id;
  const sameFloor  = srcFloorId === tgtFloorId;

  if (sameFloor && col === src.col && row === src.row) {
    showToast('Cannot pair a staircase with itself.', 'error');
    return;
  }

  beginAction();
  pairStaircases(src.col, src.row, col, row, srcFloorId, tgtFloorId);
  commitAction();

  AppState.ui.isPairingMode = false;
  AppState.ui.pairingSource = null;
  updateFloorPairingBanner();

  // The source cell may live on another floor; only redraw it if it's visible.
  redrawCell(col, row);
  renderCanvas();
  updateStatusBar();

  // Refresh panel to show new pair (anchor on the cell that's on the active floor).
  AppState.ui.editorTarget = { col, row };
  refreshStaircasePanel(col, row);

  const pairIdx = getPairIndex(col, row);
  const label = getPairLabel(pairIdx);
  scheduleBlueprintAutosave();
  if (sameFloor) {
    showToast(`Staircase pair "${label}" created.`, 'success');
  } else {
    showToast(`Paired across floors: ${floorLabelById(srcFloorId)} → ${floorLabelById(tgtFloorId)}.`, 'success');
  }
}

/* ==============================================
   STATUS BAR
=============================================== */
function updateStatusBar(col, row) {
  const coordEl = document.getElementById('bp-status-coord');
  const modeEl  = document.getElementById('bp-status-mode');
  const ui = AppState.ui;

  if (col !== undefined && row !== undefined && inBounds(col, row)) {
    coordEl.textContent = `Col ${col + 1}, Row ${row + 1}`;
  } else {
    coordEl.textContent = '—';
  }

  if (ui.isPairingMode) {
    const src = ui.pairingSource;
    const srcFloorId    = src ? (src.floorId || getActiveFloorData().id) : null;
    const activeFloorId = getActiveFloorData().id;
    const crossFloor    = src && srcFloorId !== activeFloorId;
    modeEl.textContent  = crossFloor
      ? `🔗 Pairing mode — click a staircase on this floor to link (source: ${floorLabelById(srcFloorId)})`
      : '🔗 Pairing mode — click a staircase tile (or switch floors first)';
  } else if (ui.isDoorwayMode) {
    modeEl.textContent = '🚪 Doorway mode — click a classroom edge to place/remove a door';
  } else if (ui.activeTool === 'move') {
    modeEl.textContent = 'Pan tool — drag the canvas to scroll';
  } else if (ui.activeTool === 'select') {
    modeEl.textContent = 'Select tool — click to edit · drag to move a tile';
  } else if (ui.activeTool === 'eraser') {
    modeEl.textContent = 'Eraser — click or drag to remove';
  } else if (ui.activeTool === 'hallway') {
    modeEl.textContent = 'Hallway tool — click or drag to place';
  } else if (ui.activeTool === 'classroom') {
    modeEl.textContent = ui.classroomDragging
      ? 'Classroom — drag to set size, release to place'
      : 'Classroom — click for 1×1, or click and drag for multi-cell';
  } else if (ui.activeTool === 'dummy') {
    modeEl.textContent = 'Dummy Room — click to place a colored placeholder';
  } else {
    const names = { staircase: 'Staircase' };
    modeEl.textContent = `${names[ui.activeTool] || ui.activeTool} tool — click to place one tile`;
  }
}

/* ==============================================
   CANVAS — Event Binding
=============================================== */
function bindCanvasEvents() {
  const canvasArea = document.getElementById('bp-canvas-area');

  /* ---- Panning helpers (Pan tool + middle-mouse drag) ---- */
  let panState = null;

  function startPan(e) {
    panState = {
      startX: e.clientX, startY: e.clientY,
      scrollLeft: canvasArea.scrollLeft, scrollTop: canvasArea.scrollTop,
    };
    AppState.ui.panning = true;
    canvas.classList.add('panning');
    canvasArea.classList.add('panning');
  }
  function doPan(e) {
    if (!panState) return;
    canvasArea.scrollLeft = panState.scrollLeft - (e.clientX - panState.startX);
    canvasArea.scrollTop  = panState.scrollTop  - (e.clientY - panState.startY);
  }
  function endPan() {
    if (!panState) return;
    panState = null;
    AppState.ui.panning = false;
    canvas.classList.remove('panning');
    canvasArea.classList.remove('panning');
  }

  /* ---- Tile-drag (move) ghost overlay for the Select tool ---- */
  function drawTileDragGhost() {
    const td = AppState.ui.tileDrag;
    if (!td || !td.active || !td.tile) return;
    const cs = getEffectiveCellSize();
    const hc = td.hoverCol, hr = td.hoverRow;
    if (!inBounds(hc, hr)) return;
    const x = hc * cs, y = hr * cs;
    const onSource  = (hc === td.startCol && hr === td.startRow);
    const occupied  = !onSource && !!getTile(hc, hr);
    const colors    = TILE_COLORS[td.tile.type] || TILE_COLORS.hallway;
    ctx.save();
    ctx.globalAlpha = occupied ? 0.3 : 0.55;
    ctx.fillStyle   = occupied ? '#ef4444' : colors.fill;
    ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
    ctx.globalAlpha = 1;
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = occupied ? '#ef4444' : colors.stroke;
    ctx.strokeRect(x + 2.5, y + 2.5, cs - 5, cs - 5);
    ctx.setLineDash([]);
    ctx.restore();
  }

  function finishTileDrag(e) {
    const td = AppState.ui.tileDrag;
    AppState.ui.tileDrag = null;
    canvas.classList.remove('tile-dragging');
    if (!td) return;

    // No real drag occurred → treat as a click: select + edit.
    if (!td.active || !td.tile) {
      selectCell(td.startCol, td.startRow);
      return;
    }

    const { col, row } = eventToGridCoord(e);

    // Multi-cell classroom: don't allow individual-cell dragging; just select
    if (td.tile.type === 'classroom' && td.tile.groupId) {
      renderCanvas();
      selectCell(td.startCol, td.startRow);
      showToast('To move a multi-cell classroom, erase it and redraw.', 'info');
      return;
    }

    // Dropped out of bounds or back on origin → cancel, keep selection.
    if (!inBounds(col, row) || (col === td.startCol && row === td.startRow)) {
      renderCanvas();
      selectCell(td.startCol, td.startRow);
      return;
    }

    // Occupied target → refuse.
    if (getTile(col, row)) {
      showToast('Cannot move here — that cell is occupied.', 'error');
      renderCanvas();
      selectCell(td.startCol, td.startRow);
      return;
    }

    // Perform the move (undoable).
    beginAction();
    const tileCopy = { ...td.tile };
    if (tileCopy.type === 'staircase') {
      const oldKey = `${td.startCol},${td.startRow}`;
      const newKey = `${col},${row}`;
      for (const pair of AppState.blueprint.staircasePairs) {
        if (pair[0] === oldKey) pair[0] = newKey;
        else if (pair[1] === oldKey) pair[1] = newKey;
      }
    }
    setTile(td.startCol, td.startRow, null);
    setTile(col, row, tileCopy);
    commitAction();

    AppState.ui.selectedCell = { col, row };
    updateTileStats();
    renderCanvas();
    scheduleBlueprintAutosave();

    const moved = getTile(col, row);
    if (moved.type === 'classroom')      showRightPanel('classroom', col, row, moved);
    else if (moved.type === 'staircase') showRightPanel('staircase', col, row, moved);
    else if (moved.type === 'dummy')     showRightPanel('dummy', col, row, moved);
    else                                 showRightPanel('hallway', col, row, moved);
    showToast('Tile moved.', 'success');
  }

  /* ---- Mouse down ---- */
  canvas.addEventListener('mousedown', (e) => {
    // Middle mouse → pan; never place tiles.
    if (e.button === 1) { e.preventDefault(); startPan(e); return; }
    // Right mouse → context menu handler deals with it.
    if (e.button === 2) return;
    // Ignore any other buttons (e.g. back/forward).
    if (e.button !== 0) return;

    e.preventDefault();
    const { col, row } = eventToGridCoord(e);
    if (!inBounds(col, row)) return;

    const tool = AppState.ui.activeTool;

    // Pairing mode — clicking the second staircase.
    if (AppState.ui.isPairingMode) {
      const tile = getTile(col, row);
      if (tile && tile.type === 'staircase') completePairing(col, row);
      else showToast('Please click a staircase tile to pair with.', 'error');
      return;
    }

    // Doorway mode — clicking an edge of the classroom to place/remove a door.
    if (AppState.ui.isDoorwayMode) {
      const cellSize = getEffectiveCellSize();
      const rect = canvas.getBoundingClientRect();
      const z = AppState.ui.zoom;
      const xInCell = ((e.clientX - rect.left) / z) - col * cellSize;
      const yInCell = ((e.clientY - rect.top)  / z) - row * cellSize;
      handleDoorwayClick(col, row, xInCell, yInCell, cellSize);
      return;
    }

    // Pan tool — drag the canvas.
    if (tool === 'move') { startPan(e); return; }

    // Select tool — begin a potential tile move; resolved on mouseup.
    if (tool === 'select') {
      const tile = getTile(col, row);
      AppState.ui.tileDrag = {
        startCol: col, startRow: row,
        startX: e.clientX, startY: e.clientY,
        tile: tile ? { ...tile } : null,
        active: false, hoverCol: col, hoverRow: row,
      };
      return;
    }

    // Eraser — drag to erase (one undo step per stroke).
    if (tool === 'eraser') {
      beginAction();
      AppState.ui.isDragging = true;
      lastPaintedCell = null;
      applyTool(col, row);
      lastPaintedCell = `${col},${row}`;
      return;
    }

    // Corridor Label — click/drag to select hallway tiles.
    if (tool === 'corridor-label') {
      AppState.ui.corridorLabelDragging = true;
      corridorLabelToggleCell(col, row);
      lastPaintedCell = `${col},${row}`;
      return;
    }

    // Classroom — start drag-select for multi-cell placement.
    if (tool === 'classroom') {
      AppState.ui.classroomDragStart = { col, row };
      AppState.ui.classroomDragging = true;
      showClassroomDragOverlay(col, row, col, row);
      return;
    }

    // Heat-exclude zone — start drag-draw.
    if (tool === 'heat-exclude') {
      // Check if clicking an existing zone first
      const hitZone = hitTestExcludeZone(col, row);
      if (hitZone) {
        AppState.ui.selectedExcludeZoneId = hitZone.id;
        renderCanvas();
        showRightPanel('heat-exclude-zone', null, null, hitZone);
        return;
      }
      AppState.ui.heatExcludeDragStart = { col, row };
      AppState.ui.heatExcludeDragging = true;
      showHeatExcludeDragOverlay(col, row, col, row);
      return;
    }

    // Draw tools (hallway, dummy, staircase).
    if (tool === 'hallway') {
      // Hallways support click-and-drag painting.
      beginAction();
      AppState.ui.isDragging = true;
      lastPaintedCell = null;
      applyTool(col, row);
      lastPaintedCell = `${col},${row}`;
    } else {
      // Staircase & dummy: exactly one tile per click, no drag paint.
      runAction(() => applyTool(col, row));
    }
  });

  /* ---- Mouse move (over canvas): status bar, tile-drag activation, paint ---- */
  canvas.addEventListener('mousemove', (e) => {
    const { col, row } = eventToGridCoord(e);
    if (inBounds(col, row)) updateStatusBar(col, row);

    // Panning and active tile-drag rendering are handled by the window-level
    // listener so they keep working off-canvas; just bail here.
    if (panState) return;

    // Tile dragging in Select mode — detect when a real drag has begun.
    const td = AppState.ui.tileDrag;
    if (td && td.tile) {
      if (!td.active) {
        const movedFar  = Math.hypot(e.clientX - td.startX, e.clientY - td.startY) > 5;
        const movedCell = inBounds(col, row) && (col !== td.startCol || row !== td.startRow);
        if (movedFar || movedCell) {
          td.active = true;
          canvas.classList.add('tile-dragging');
          td.hoverCol = col; td.hoverRow = row;
          renderCanvas();
          drawTileDragGhost();
        }
      }
      return;
    }

    // Classroom drag-select overlay update
    if (AppState.ui.classroomDragging && AppState.ui.classroomDragStart) {
      const { col: sc, row: sr } = AppState.ui.classroomDragStart;
      if (inBounds(col, row)) showClassroomDragOverlay(sc, sr, col, row);
      return;
    }

    // Heat-exclude drag overlay update
    if (AppState.ui.heatExcludeDragging && AppState.ui.heatExcludeDragStart) {
      const { col: sc, row: sr } = AppState.ui.heatExcludeDragStart;
      const clampedCol = Math.max(0, Math.min(AppState.blueprint.gridCols - 1, col));
      const clampedRow = Math.max(0, Math.min(AppState.blueprint.gridRows - 1, row));
      showHeatExcludeDragOverlay(sc, sr, clampedCol, clampedRow);
      return;
    }

    // Corridor-label drag-select.
    if (AppState.ui.corridorLabelDragging && AppState.ui.activeTool === 'corridor-label') {
      const key = `${col},${row}`;
      if (key !== lastPaintedCell && inBounds(col, row)) {
        lastPaintedCell = key;
        corridorLabelAddCell(col, row);
      }
      return;
    }

    // Drag-paint (hallway / eraser only).
    if (!AppState.ui.isDragging) return;
    const key = `${col},${row}`;
    if (key === lastPaintedCell) return;
    lastPaintedCell = key;

    const tool = AppState.ui.activeTool;
    if (tool !== 'hallway' && tool !== 'eraser') return; // classroom/staircase never drag
    applyTool(col, row);
  });

  /* ---- Mouse up (window-level so drags ending off-canvas still resolve) ---- */
  window.addEventListener('mouseup', (e) => {
    endPan();

    if (AppState.ui.tileDrag) finishTileDrag(e);

    // Classroom drag-select complete
    if (AppState.ui.classroomDragging && AppState.ui.classroomDragStart) {
      const { col: sc, row: sr } = AppState.ui.classroomDragStart;
      const { col, row } = eventToGridCoord(e);
      hideClassroomDragOverlay();
      AppState.ui.classroomDragging = false;
      AppState.ui.classroomDragStart = null;
      // Place the group
      const targetCol = inBounds(col, row) ? col : Math.max(0, Math.min(AppState.blueprint.gridCols - 1, col));
      const targetRow = inBounds(col, row) ? row : Math.max(0, Math.min(AppState.blueprint.gridRows - 1, row));
      placeClassroomGroup(sc, sr, targetCol, targetRow);
    }

    // Heat-exclude drag complete
    if (AppState.ui.heatExcludeDragging && AppState.ui.heatExcludeDragStart) {
      const { col: sc, row: sr } = AppState.ui.heatExcludeDragStart;
      const { col, row } = eventToGridCoord(e);
      const targetCol = Math.max(0, Math.min(AppState.blueprint.gridCols - 1, col));
      const targetRow = Math.max(0, Math.min(AppState.blueprint.gridRows - 1, row));
      hideHeatExcludeDragOverlay();
      AppState.ui.heatExcludeDragging = false;
      AppState.ui.heatExcludeDragStart = null;
      placeHeatExcludeZone(sc, sr, targetCol, targetRow);
    }

    if (AppState.ui.corridorLabelDragging) {
      AppState.ui.corridorLabelDragging = false;
      lastPaintedCell = null;
    }

    if (AppState.ui.isDragging) {
      AppState.ui.isDragging = false;
      lastPaintedCell = null;
      commitAction(); // close out a paint/erase stroke as one undo step
    }
  });

  // Mouse leave
  canvas.addEventListener('mouseleave', () => {
    document.getElementById('bp-status-coord').textContent = '—';
  });

  /* ---- Window-level move: keep pan & tile-drag alive even when the cursor
         leaves the canvas (the canvas scrolls out from under the pointer). ---- */
  window.addEventListener('mousemove', (e) => {
    if (panState) { doPan(e); return; }
    const td = AppState.ui.tileDrag;
    if (td && td.active && td.tile) {
      const { col, row } = eventToGridCoord(e);
      td.hoverCol = col; td.hoverRow = row;
      renderCanvas();
      drawTileDragGhost();
    }
    // Classroom drag overlay update when cursor leaves canvas
    if (AppState.ui.classroomDragging && AppState.ui.classroomDragStart) {
      const { col, row } = eventToGridCoord(e);
      const { col: sc, row: sr } = AppState.ui.classroomDragStart;
      const clampedCol = Math.max(0, Math.min(AppState.blueprint.gridCols - 1, col));
      const clampedRow = Math.max(0, Math.min(AppState.blueprint.gridRows - 1, row));
      showClassroomDragOverlay(sc, sr, clampedCol, clampedRow);
    }
    // Heat-exclude drag overlay update when cursor leaves canvas
    if (AppState.ui.heatExcludeDragging && AppState.ui.heatExcludeDragStart) {
      const { col, row } = eventToGridCoord(e);
      const { col: sc, row: sr } = AppState.ui.heatExcludeDragStart;
      const clampedCol = Math.max(0, Math.min(AppState.blueprint.gridCols - 1, col));
      const clampedRow = Math.max(0, Math.min(AppState.blueprint.gridRows - 1, row));
      showHeatExcludeDragOverlay(sc, sr, clampedCol, clampedRow);
    }
  });

  /* ---- Pan from the canvas margin (area / wrapper around the canvas) ---- */
  const panMargin = (e) => {
    if (e.target === canvas) return; // canvas has its own handler
    if (e.button === 1) { e.preventDefault(); startPan(e); return; }
    if (e.button === 0 && AppState.ui.activeTool === 'move') { e.preventDefault(); startPan(e); }
  };
  canvasArea.addEventListener('mousedown', panMargin);
  const bpWrapper = document.getElementById('bp-canvas-wrapper');
  if (bpWrapper) bpWrapper.addEventListener('mousedown', panMargin);

  // Right-click context menu
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    if (AppState.ui.isPairingMode) {
      cancelPairingMode();
      showToast('Pairing cancelled.', 'info');
      return;
    }

    const { col, row } = eventToGridCoord(e);
    if (!inBounds(col, row)) return;
    showContextMenu(e.clientX, e.clientY, col, row);
  });

  // Ctrl+scroll zoom
  canvasArea.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    adjustZoom(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
  }, { passive: false });
}

/* ==============================================
   CLASSROOM DRAG-SELECT OVERLAY
=============================================== */
function showClassroomDragOverlay(col1, row1, col2, row2) {
  const overlay = document.getElementById('classroom-drag-overlay');
  if (!overlay) return;
  const cellSize = getEffectiveCellSize();
  const z = AppState.ui.zoom;
  const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);
  const w = (maxCol - minCol + 1);
  const h = (maxRow - minRow + 1);

  // The canvas has 24px padding inside bp-canvas-wrapper, so offset the overlay
  const PAD = 24;
  overlay.style.display = 'block';
  overlay.style.left   = `${PAD + minCol * cellSize * z}px`;
  overlay.style.top    = `${PAD + minRow * cellSize * z}px`;
  overlay.style.width  = `${w * cellSize * z}px`;
  overlay.style.height = `${h * cellSize * z}px`;

  // Show size label
  overlay.title = `${w} × ${h} classroom`;
}

function hideClassroomDragOverlay() {
  const overlay = document.getElementById('classroom-drag-overlay');
  if (overlay) overlay.style.display = 'none';
}

/* ==============================================
   HEAT-EXCLUDE ZONE — drag overlay + placement
=============================================== */

function genExcludeZoneId() {
  return 'hz_' + (_heatExcludeIdCounter++);
}

function showHeatExcludeDragOverlay(col1, row1, col2, row2) {
  const overlay = document.getElementById('heat-exclude-drag-overlay');
  if (!overlay) return;
  const cellSize = getEffectiveCellSize();
  const z = AppState.ui.zoom;
  const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);
  const w = maxCol - minCol + 1;
  const h = maxRow - minRow + 1;
  const PAD = 24;
  overlay.style.display = 'block';
  overlay.style.left   = `${PAD + minCol * cellSize * z}px`;
  overlay.style.top    = `${PAD + minRow * cellSize * z}px`;
  overlay.style.width  = `${w * cellSize * z}px`;
  overlay.style.height = `${h * cellSize * z}px`;
  overlay.title = `${w} × ${h} exclusion zone`;
}

function hideHeatExcludeDragOverlay() {
  const overlay = document.getElementById('heat-exclude-drag-overlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Place a new heat-exclude zone from drag coordinates.
 * Zones are stored as {id, col, row, cols, rows, label} — not grid tiles.
 */
function placeHeatExcludeZone(col1, row1, col2, row2) {
  const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);
  const zone = {
    id:    genExcludeZoneId(),
    col:   minCol,
    row:   minRow,
    cols:  maxCol - minCol + 1,
    rows:  maxRow - minRow + 1,
    label: '',
  };
  AppState.blueprint.heatExcludeZones.push(zone);
  AppState.ui.selectedExcludeZoneId = zone.id;
  scheduleBlueprintAutosave();
  renderCanvas();
  showRightPanel('heat-exclude-zone', null, null, zone);
  showToast('Exclusion zone added.', 'success');
}

/**
 * Hit-test: return the zone (if any) whose rectangle covers (col, row).
 */
function hitTestExcludeZone(col, row) {
  const zones = AppState.blueprint.heatExcludeZones || [];
  // Iterate in reverse so the most recently placed zone wins on overlap
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (col >= z.col && col < z.col + z.cols &&
        row >= z.row && row < z.row + z.rows) {
      return z;
    }
  }
  return null;
}

/**
 * Delete a heat-exclude zone by id.
 */
function deleteHeatExcludeZone(id) {
  const zones = AppState.blueprint.heatExcludeZones;
  const idx = zones.findIndex(z => z.id === id);
  if (idx >= 0) zones.splice(idx, 1);
  AppState.ui.selectedExcludeZoneId = null;
  scheduleBlueprintAutosave();
  renderCanvas();
  showRightPanel('heat-exclude-tool');
}

/**
 * Draw all heat-exclude zones on the blueprint canvas as dashed rectangles.
 * Called at the end of renderCanvas so they float above tiles.
 */
function drawHeatExcludeZones(cellSize, targetCtx) {
  const c = targetCtx || ctx;
  const zones = AppState.blueprint.heatExcludeZones || [];
  const selId = AppState.ui.selectedExcludeZoneId;

  c.save();
  for (const zone of zones) {
    const x = zone.col * cellSize;
    const y = zone.row * cellSize;
    const w = zone.cols * cellSize;
    const h = zone.rows * cellSize;
    const isSelected = (zone.id === selId);

    // Translucent fill
    c.fillStyle = isSelected ? 'rgba(251,146,60,0.22)' : 'rgba(251,146,60,0.10)';
    c.fillRect(x + 1, y + 1, w - 2, h - 2);

    // Dashed border
    c.strokeStyle = isSelected ? '#ea580c' : '#f97316';
    c.lineWidth = isSelected ? 2.5 : 2;
    c.setLineDash([5, 4]);
    c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    c.setLineDash([]);

    // Label text
    const label = zone.label || 'Exclude Zone';
    const fontSize = Math.max(9, Math.min(13, Math.min(w * 0.18, h * 0.35)));
    if (w >= 24 && h >= 20) {
      c.fillStyle = isSelected ? '#c2410c' : '#ea580c';
      c.globalAlpha = isSelected ? 0.95 : 0.7;
      c.font = `600 ${fontSize}px 'DM Mono', monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, x + w / 2, y + h / 2, w - 8);
    }

    c.globalAlpha = 1;
  }
  c.restore();
}


/* -- Right panel functions for heat-exclude zones -- */

function showHeatExcludeZoneEditor(zone) {
  const el = document.getElementById('rp-heat-exclude-editor');
  if (!el) return;
  el.style.display = '';

  document.getElementById('rp-heat-exclude-coord').textContent =
    `${zone.cols} × ${zone.rows} cells`;
  document.getElementById('rp-heat-exclude-label').value = zone.label || '';

  // Save button
  const saveBtn = document.getElementById('rp-btn-save-heat-exclude');
  if (saveBtn) {
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.addEventListener('click', () => {
      zone.label = (document.getElementById('rp-heat-exclude-label')?.value || '').trim();
      scheduleBlueprintAutosave();
      renderCanvas();
      showToast('Zone label saved.', 'success');
    });
  }

  // Delete button
  const delBtn = document.getElementById('rp-btn-delete-heat-exclude');
  if (delBtn) {
    const newDel = delBtn.cloneNode(true);
    delBtn.parentNode.replaceChild(newDel, delBtn);
    newDel.addEventListener('click', () => {
      deleteHeatExcludeZone(zone.id);
      showToast('Exclusion zone deleted.', 'info');
    });
  }
}

function showHeatExcludeToolPanel() {
  const el = document.getElementById('rp-heat-exclude-tool');
  if (!el) return;
  el.style.display = '';

  // Populate zone list
  const zones = AppState.blueprint.heatExcludeZones || [];
  const listSection = document.getElementById('rp-heat-exclude-list-section');
  const listEl = document.getElementById('rp-heat-exclude-list');
  if (listSection && listEl) {
    listSection.style.display = zones.length > 0 ? '' : 'none';
    listEl.innerHTML = '';
    for (const zone of zones) {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--slate-100);font-size:12px;cursor:pointer;';
      item.innerHTML = `<span style="flex:1;color:var(--slate-700);">${zone.label || 'Unnamed Zone'} <span style="color:var(--slate-400)">(${zone.cols}×${zone.rows})</span></span>
        <button style="background:none;border:none;cursor:pointer;color:var(--error);font-size:11px;padding:2px 6px;border-radius:3px;" title="Delete">✕</button>`;
      item.querySelector('button').addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteHeatExcludeZone(zone.id);
        showToast('Zone deleted.', 'info');
      });
      item.addEventListener('click', () => {
        AppState.ui.selectedExcludeZoneId = zone.id;
        renderCanvas();
        showRightPanel('heat-exclude-zone', null, null, zone);
      });
      listEl.appendChild(item);
    }
  }
}

/* ==============================================
   ZOOM CONTROLS
=============================================== */
function adjustZoom(delta) {
  AppState.ui.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, AppState.ui.zoom + delta));
  applyZoom();
}

document.getElementById('btn-zoom-in').addEventListener('click', () => adjustZoom(ZOOM_STEP));
document.getElementById('btn-zoom-out').addEventListener('click', () => adjustZoom(-ZOOM_STEP));
document.getElementById('btn-zoom-reset').addEventListener('click', () => { AppState.ui.zoom = 1.0; applyZoom(); });

/* ==============================================
   TOOL PALETTE
=============================================== */
const toolButtons = document.querySelectorAll('.tool-btn');

function setActiveTool(toolName) {
  // If switching away from pairing mode, cancel it
  if (AppState.ui.isPairingMode && toolName !== 'select') {
    cancelPairingMode();
  }

  // Cancel doorway mode when switching tools
  if (AppState.ui.isDoorwayMode) {
    exitDoorwayMode(false);
  }

  // Clear corridor-label selection when switching tools
  if (toolName !== 'corridor-label') {
    AppState.ui.corridorLabelCells.clear();
    AppState.ui.corridorLabelDragging = false;
  }

  // Cancel any in-progress heat-exclude drag
  if (toolName !== 'heat-exclude') {
    AppState.ui.heatExcludeDragging = false;
    AppState.ui.heatExcludeDragStart = null;
    AppState.ui.selectedExcludeZoneId = null;
    hideHeatExcludeDragOverlay();
  }

  // Abort any in-progress tile drag when changing tools
  if (AppState.ui.tileDrag) {
    AppState.ui.tileDrag = null;
    if (canvas) canvas.classList.remove('tile-dragging');
  }

  AppState.ui.activeTool = toolName;

  toolButtons.forEach(btn => {
    btn.classList.remove('active', 'active-eraser', 'active-move');
    if (btn.dataset.tool === toolName) {
      if (toolName === 'eraser') btn.classList.add('active-eraser');
      else if (toolName === 'move') btn.classList.add('active-move');
      else btn.classList.add('active');
    }
  });

  // Update canvas cursor
  const canvasArea = document.getElementById('bp-canvas-area');
  if (canvas) {
    canvas.className = '';
    if (toolName === 'eraser')  { canvas.style.cursor = 'cell'; }
    else if (toolName === 'select') { canvas.className = 'tool-select'; canvas.style.cursor = 'default'; }
    else if (toolName === 'move')   { canvas.className = 'tool-move'; canvas.style.cursor = 'grab'; }
    else if (toolName === 'corridor-label') { canvas.style.cursor = 'crosshair'; }
    else if (toolName === 'heat-exclude') { canvas.style.cursor = 'crosshair'; }
    else { canvas.style.cursor = 'crosshair'; }
  }
  if (canvasArea) canvasArea.classList.toggle('pan-ready', toolName === 'move');

  // Show/update right panel for pan tool
  if (toolName === 'move') {
    showRightPanel('move');
  } else if (toolName === 'corridor-label') {
    showRightPanel('corridor-label-info');
  } else if (toolName === 'heat-exclude') {
    showRightPanel('heat-exclude-tool');
  } else if (toolName !== 'select') {
    // If switching to a draw/erase tool, clear right panel unless something was selected
    const sel = AppState.ui.selectedCell;
    if (!sel) showRightPanel('empty');
  }

  updateStatusBar();
  renderCanvas();
}

toolButtons.forEach(btn => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (AppState.ui.activeTab !== 'blueprint') return;

  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

  // Undo / Redo — only when not typing in a field (so native text undo still works there)
  if (!inField && (e.ctrlKey || e.metaKey)) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoBlueprint(); return; }
    if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoBlueprint(); return; }
  }

  if (inField) return;

  if (e.key === 'Escape') {
    if (AppState.ui.isPairingMode) { cancelPairingMode(); showToast('Pairing cancelled.', 'info'); return; }
    if (AppState.ui.isDoorwayMode) { exitDoorwayMode(true); showToast('Doorway mode cancelled.', 'info'); return; }
    if (AppState.ui.tileDrag)      { AppState.ui.tileDrag = null; canvas.classList.remove('tile-dragging'); renderCanvas(); return; }
    hideContextMenu();
    return;
  }

  // Delete / Backspace — remove the selected tile (with confirmation)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelectedTile();
    return;
  }

  const map = {
    's': 'select', 'S': 'select',
    'm': 'move',   'M': 'move',
    '1': 'classroom', '2': 'hallway', '3': 'staircase', '4': 'dummy', '5': 'heat-exclude',
    'e': 'eraser', 'E': 'eraser',
    'l': 'corridor-label', 'L': 'corridor-label',
  };
  if (map[e.key]) setActiveTool(map[e.key]);
});

/* ==============================================
   TILE DELETION (shared by Delete key + context menu)
=============================================== */
function deleteTileAt(col, row, { confirmPrompt = false } = {}) {
  const tile = getTile(col, row);
  if (!tile) return false;

  if (confirmPrompt) {
    let label;
    if (tile.type === 'classroom' && tile.groupId) {
      const bounds = getGroupBounds(col, row, tile.groupId);
      const w = bounds.maxCol - bounds.minCol + 1;
      const h = bounds.maxRow - bounds.minRow + 1;
      const roomNum = getTile(bounds.minCol, bounds.minRow)?.roomNumber;
      label = roomNum ? `${w}×${h} classroom "${roomNum}"` : `${w}×${h} classroom`;
    } else if (tile.type === 'classroom' && tile.roomNumber) {
      label = `classroom "${tile.roomNumber}"`;
    } else if (tile.type === 'dummy') {
      label = `dummy room${tile.dummyLabel ? ` "${tile.dummyLabel}"` : ''}`;
    } else {
      label = `this ${tile.type}`;
    }
    if (!confirm(`Delete ${label}? You can undo this with Ctrl+Z.`)) return false;
  }

  // Multi-cell classroom group: erase all cells
  if (tile.type === 'classroom' && tile.groupId) {
    beginAction();
    eraseClassroomGroup(tile.groupId);
    commitAction();
    return true;
  }

  let partner = null;
  runAction(() => {
    if (tile.type === 'staircase') {
      partner = getPairPartner(col, row);
      unpairStaircase(col, row);
    }
    setTile(col, row, null);
  });

  if (partner) redrawCell(partner.col, partner.row);
  redrawCell(col, row);

  if (AppState.ui.selectedCell &&
      AppState.ui.selectedCell.col === col &&
      AppState.ui.selectedCell.row === row) {
    AppState.ui.selectedCell = null;
    showRightPanel('empty');
  }

  renderCanvas();
  updateTileStats();
  scheduleBlueprintAutosave();
  showToast('Tile deleted.', 'info');
  return true;
}

function deleteSelectedTile() {
  const sel = AppState.ui.selectedCell;
  if (!sel || !getTile(sel.col, sel.row)) {
    showToast('Select a tile first, then press Delete.', 'info');
    return;
  }
  deleteTileAt(sel.col, sel.row, { confirmPrompt: true });
}

/* ==============================================
   UNDO / REDO BUTTON WIRING
=============================================== */
document.getElementById('btn-undo').addEventListener('click', undoBlueprint);
document.getElementById('btn-redo').addEventListener('click', redoBlueprint);

/* ==============================================
   CANVAS RESET
=============================================== */
document.getElementById('btn-reset-canvas').addEventListener('click', () => {
  if (!confirm('Clear all tiles from the canvas? You can undo this with Ctrl+Z.')) return;
  saveSnapshot('Auto — before clear', 0); // R39: auto-snapshot slot 0
  const { gridCols, gridRows } = AppState.blueprint;
  beginAction();
  AppState.ui.selectedCell  = null;
  AppState.ui.moveSource    = null;
  AppState.ui.tileDrag      = null;
  AppState.ui.isPairingMode = false;
  AppState.ui.pairingSource = null;
  initGridData(gridCols, gridRows, true);
  commitAction();
  renderCanvas();
  updateTileStats();
  showRightPanel('empty');
  scheduleBlueprintAutosave();
  showToast('Canvas cleared.', 'info');
});

/* ==============================================
   CONTEXT MENU
=============================================== */
const contextMenu = document.getElementById('bp-context-menu');

function showContextMenu(x, y, col, row) {
  AppState.ui.contextMenuCell = { col, row };
  const tile = getTile(col, row);

  let headerText;
  if (!tile) {
    headerText = `Empty Cell — (${col + 1}, ${row + 1})`;
  } else if (tile.type === 'classroom' && tile.groupId) {
    const bounds = getGroupBounds(col, row, tile.groupId);
    const w = bounds.maxCol - bounds.minCol + 1;
    const h = bounds.maxRow - bounds.minRow + 1;
    headerText = `Classroom ${w}×${h} — (${col + 1}, ${row + 1})`;
  } else {
    headerText = `${tile.type.charAt(0).toUpperCase() + tile.type.slice(1)} — (${col + 1}, ${row + 1})`;
  }
  document.getElementById('ctx-menu-header').textContent = headerText;

  document.querySelectorAll('.ctx-type-btn').forEach(btn => {
    btn.classList.toggle('active', tile && btn.dataset.type === tile.type);
  });

  document.getElementById('ctx-delete-tile').style.display = tile ? '' : 'none';
  document.getElementById('ctx-assign-room').style.display = tile && tile.type === 'classroom' ? '' : 'none';
  document.getElementById('ctx-pair-staircase').style.display = tile && tile.type === 'staircase' ? '' : 'none';

  contextMenu.classList.add('visible');
  contextMenu.style.left = '0px';
  contextMenu.style.top  = '0px';

  const mw = contextMenu.offsetWidth;
  const mh = contextMenu.offsetHeight;
  let cx = x + 4, cy = y + 4;
  if (cx + mw > window.innerWidth - 8)  cx = x - mw - 4;
  if (cy + mh > window.innerHeight - 8) cy = y - mh - 4;
  contextMenu.style.left = `${cx}px`;
  contextMenu.style.top  = `${cy}px`;
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
  AppState.ui.contextMenuCell = null;
}

document.addEventListener('mousedown', (e) => { if (!contextMenu.contains(e.target)) hideContextMenu(); });

// Change tile type
document.querySelectorAll('.ctx-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cell = AppState.ui.contextMenuCell;
    if (!cell) return;
    const newType = btn.dataset.type;
    const existing = getTile(cell.col, cell.row);

    beginAction();
    // If changing type, clean up old staircase pair
    if (existing && existing.type === 'staircase' && newType !== 'staircase') {
      const partner = getPairPartner(cell.col, cell.row);
      unpairStaircase(cell.col, cell.row);
      if (partner) redrawCell(partner.col, partner.row);
    }
    // Clean up classroom group if changing away from classroom
    if (existing && existing.type === 'classroom' && existing.groupId && newType !== 'classroom') {
      // Will erase the whole group — do that after commitAction
    }

    if (existing) {
      if (existing.type === 'classroom' && existing.groupId && newType !== 'classroom') {
        commitAction();
        eraseClassroomGroup(existing.groupId);
        if (newType !== 'classroom') {
          setTile(cell.col, cell.row, { type: newType, ...(newType === 'dummy' ? { dummyColor: activeDummyColor, dummyLabel: '' } : {}) });
          redrawCell(cell.col, cell.row);
        }
      } else {
        existing.type = newType;
        if (newType !== 'classroom') { existing.roomNumber = null; existing.teacher = null; existing.wing = null; existing.groupId = null; existing.doors = null; }
        if (newType === 'dummy' && !existing.dummyColor) { existing.dummyColor = activeDummyColor; existing.dummyLabel = ''; }
        setTile(cell.col, cell.row, existing);
        commitAction();
        redrawCell(cell.col, cell.row);
      }
    } else {
      setTile(cell.col, cell.row, { type: newType, ...(newType === 'dummy' ? { dummyColor: activeDummyColor, dummyLabel: '' } : {}) });
      commitAction();
      redrawCell(cell.col, cell.row);
    }
    renderCanvas();
    updateTileStats();
    scheduleBlueprintAutosave();
    hideContextMenu();
  });
});

// Delete tile
document.getElementById('ctx-delete-tile').addEventListener('click', () => {
  const cell = AppState.ui.contextMenuCell;
  hideContextMenu();
  if (!cell) return;
  deleteTileAt(cell.col, cell.row, { confirmPrompt: false });
});

// Assign Room (opens classroom editor)
document.getElementById('ctx-assign-room').addEventListener('click', () => {
  const cell = AppState.ui.contextMenuCell;
  if (!cell) return;
  const tile = getTile(cell.col, cell.row);
  if (!tile) return;
  setActiveTool('select');
  AppState.ui.selectedCell = { col: cell.col, row: cell.row };
  showRightPanel('classroom', cell.col, cell.row, tile);
  renderCanvas();
  hideContextMenu();
});

// Pair staircase from context menu
document.getElementById('ctx-pair-staircase').addEventListener('click', () => {
  const cell = AppState.ui.contextMenuCell;
  if (!cell) return;
  setActiveTool('select');
  AppState.ui.selectedCell  = { col: cell.col, row: cell.row };
  AppState.ui.editorTarget  = { col: cell.col, row: cell.row };
  const tile = getTile(cell.col, cell.row);
  showRightPanel('staircase', cell.col, cell.row, tile);
  // Auto-enter pairing mode
  AppState.ui.isPairingMode = true;
  AppState.ui.pairingSource = { col: cell.col, row: cell.row, floorId: getActiveFloorData().id };
  refreshStaircasePanel(cell.col, cell.row);
  updateFloorPairingBanner();
  renderCanvas();
  updateStatusBar();
  showToast('Pairing mode active — click another staircase, or switch floors first.', 'info');
  hideContextMenu();
});

/* ==============================================
   TILE STATS
=============================================== */
function updateTileStats() {
  const counts = getTileCounts();
  document.getElementById('stat-classroom').textContent  = counts.classroom;
  document.getElementById('stat-hallway').textContent    = counts.hallway;
  document.getElementById('stat-staircase').textContent  = counts.staircase;
  document.getElementById('stat-total').textContent      = counts.total;

  // Update status bar pills
  const registry = rebuildRoomRegistry();
  const pairs    = (AppState.blueprint.crossFloorPairs || []).length; // all pairs (incl. cross-floor)
  const floorCount = AppState.blueprint.floors.length;

  const sbarC = document.getElementById('sbar-classroom');
  const sbarH = document.getElementById('sbar-hallway');
  const sbarS = document.getElementById('sbar-staircase');
  const sbarR = document.getElementById('sbar-rooms');
  const sbarP = document.getElementById('sbar-pairs');
  if (sbarC) sbarC.textContent = `${counts.classroom} cls`;
  if (sbarH) sbarH.textContent = `${counts.hallway} hall`;
  if (sbarS) sbarS.textContent = `${counts.staircase} stair`;
  if (sbarR) sbarR.textContent = `${registry.length} room${registry.length !== 1 ? 's' : ''}`;
  if (sbarP) sbarP.textContent =
    `${pairs} pair${pairs !== 1 ? 's' : ''}${floorCount > 1 ? ` · ${floorCount} floors` : ''}`;
}


export {
  getActiveFloorData, syncLegacyMirror, switchActiveFloor, initGridData, getTile, setTile, getTileCounts,
  getPairIndex, getPairPartner, floorLabelById, pairStaircases, unpairStaircaseOn, unpairStaircase, HISTORY_LIMIT,
  _snapGrid, _restoreGrid, beginAction, commitAction, runAction, undoBlueprint, redoBlueprint, afterHistoryRestore,
  clearHistory, updateUndoRedoButtons, initCanvas, getEffectiveCellSize, applyZoom, resizeCanvas, _traceImageCache,
  traceImageSrc, getTraceImageEl, drawTraceImage, renderCanvas, renderBlueprintExportCanvas, exportBlueprintAsPNG,
  exportBlueprintAsPDF, renderBlueprintPrintSheet, renderEvacuationMapCrop, drawEvacuationDoorCard,
  drawDoorCardFooter, printEvacuationDoorCards, drawGrid, drawSearchHighlight, drawCorridorLabelHighlights,
  drawSelectionHighlight, drawMoveSourceHighlight, drawPairingSourceHighlight, roundRectStroke, drawTile,
  drawClassroomTile, isSameGroup, isGroupAnchor, getGroupBounds, getGroupCenterX, getGroupCenterY,
  getGroupPixelWidth, getGroupPixelHeight, getGroupBottomY, stampGroupLabel, stampAllGroupLabels, getClassroomDoors,
  detectDoorSide, drawDoorNotches, drawDummyTile, darkenHex, drawRoomLabel, drawStaircaseTile, drawWarningIcon,
  drawStaircaseIcon, roundRect, eventToGridCoord, inBounds, redrawCell, applyTool, eraseClassroomGroup,
  placeClassroomGroup, focusClassroomEditor, selectCell, showRightPanel, showHallwayEditor,
  showCorridorLabelToolPanel, updateCorridorLabelPanelCount, corridorLabelToggleCell, corridorLabelAddCell,
  openCorridorLabelModal, applyCorridorLabelToSelection, initCorridorLabelModal, showClassroomEditor, renderDoorList,
  removeDoor, getAnchorTile, redrawGroupOrCell, enterDoorwayMode, exitDoorwayMode, handleDoorwayClick,
  showStaircaseEditor, refreshStaircasePanel, cancelPairingMode, updateFloorPairingBanner, DUMMY_COLOR_PRESETS_NAMED,
  buildDummyColorPicker, getSelectedDummyColor, showDummyEditor, rgbStringToHex, updateDummyToolSwatch,
  completePairing, updateStatusBar, bindCanvasEvents, showClassroomDragOverlay, hideClassroomDragOverlay,
  genExcludeZoneId, showHeatExcludeDragOverlay, hideHeatExcludeDragOverlay, placeHeatExcludeZone, hitTestExcludeZone,
  deleteHeatExcludeZone, drawHeatExcludeZones, showHeatExcludeZoneEditor, showHeatExcludeToolPanel, adjustZoom,
  toolButtons, setActiveTool, deleteTileAt, deleteSelectedTile, contextMenu, showContextMenu, hideContextMenu,
  updateTileStats
};
