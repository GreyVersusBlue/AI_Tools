// sv-autosave.js — the School Layout Visualizer's autosave: the debounce, the write to
// localStorage and the "Saved 3:04:05 PM" indicator. Moved out of the page's classic script as a
// view module, the way sv-storage.js is (rank 140, the fourth and fifth increments): behaviour,
// ids and wording are unchanged. What stays on the page is the load, which holds applyBlueprintData
// and the quarantine copy. The write reaches the page's serializeBlueprint(), BLUEPRINT_KEY,
// rebuildRoomRegistry() and adoptTraceImages() by bare name, at call time. The module owns two
// pieces of state, the debounce timer and the time of the last save; the page sets the second
// through setLastBlueprintSaveTime() (after a load, on "clear"). The page's module
// script copies the exports onto window, which is how the page reaches them by bare name.
//
// Its browser check is test/smoke-autosave.mjs.

/* global AppState, serializeBlueprint, BLUEPRINT_KEY, rebuildRoomRegistry, adoptTraceImages, checkStorageHeadroom, showStorageBanner -- 035's page globals and sv-storage.js's, read at call time */

let _autosaveTimer = null;
let _lastBlueprintSaveTime = null;

/** Set (or clear, with null) the time the indicator reports; call updateSaveIndicator() after. */
export function setLastBlueprintSaveTime(d) { _lastBlueprintSaveTime = d; }

/**
 * Debounce wrapper — saves within 800ms of the last change.
 */
export function scheduleBlueprintAutosave() {
  // Same funnel every change already goes through, so the recovery ring's idea
  // of "something changed" can't drift from the autosave's. Reached via window
  // because RecoveryManager is a `const` declared much further down the page —
  // a bare reference here would be a temporal-dead-zone throw, not undefined.
  if (window.RecoveryManager) window.RecoveryManager.markDirty();
  const indicator = document.getElementById('bp-autosave-indicator');
  if (indicator) { indicator.className = 'bp-autosave-indicator saving'; }
  const textEl = document.getElementById('bp-autosave-text');
  if (textEl) textEl.textContent = 'Saving…';

  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => {
    saveBlueprintToLocalStorage();
  }, 800);
}

/**
 * Update the auto-save indicator and status bar badge.
 */
export function updateSaveIndicator() {
  const indicator = document.getElementById('bp-autosave-indicator');
  const textEl    = document.getElementById('bp-autosave-text');
  const sbarSaved = document.getElementById('sbar-saved');

  if (_lastBlueprintSaveTime) {
    const timeStr = _lastBlueprintSaveTime.toLocaleTimeString();
    if (indicator) { indicator.className = 'bp-autosave-indicator saved'; }
    if (textEl) textEl.textContent = `Saved ${timeStr}`;
    if (sbarSaved) {
      sbarSaved.style.display = '';
      sbarSaved.title = `Blueprint auto-saved at ${timeStr}`;
    }
  }
}

/**
 * Save blueprint to localStorage (the debounced write: scheduleBlueprintAutosave() above calls it, as do import, restore and the trace-image pass).
 */
export function saveBlueprintToLocalStorage() {
  try {
    const payload = serializeBlueprint();
    localStorage.setItem(BLUEPRINT_KEY, JSON.stringify(payload));
    _lastBlueprintSaveTime = new Date();
    updateSaveIndicator();
    rebuildRoomRegistry();
    checkStorageHeadroom();
    // A trace image still inline (IndexedDB refused it last time, or it came
    // back by undo) gets another try at the media store; that pass saves again
    // only if it moved something, so this cannot loop.
    const ti = window.SVTraceImage;
    if (ti && ti.valuesIn(AppState.blueprint.floors).some(ti.isInline)) adoptTraceImages();
  } catch(e) {
    console.warn('[STVIZ] Blueprint auto-save failed:', e);
    if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
      showStorageBanner('fail',
        'Your last change could NOT be saved — this browser’s storage for this site is full. ' +
        'Export a backup right now (Blueprint → Export) before you lose more work, then use Backup & Restore ' +
        'or a different browser profile to make room.');
    }
  }
}
