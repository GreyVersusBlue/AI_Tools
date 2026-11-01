// sv-autosave.js — the School Layout Visualizer's autosave debounce and its "Saved 3:04:05 PM"
// indicator. Moved out of the page's classic script as a view module, the way sv-storage.js is
// (rank 140, the fourth increment): behaviour, ids and wording are unchanged. What stays on the
// page is the write itself, saveBlueprintToLocalStorage(), and the load, because they hold the
// blueprint (serializeBlueprint, applyBlueprintData, the trace images). The module owns two
// pieces of state, the debounce timer and the time of the last save; the page sets the second
// through setLastBlueprintSaveTime() (after a write, after a load, on "clear"). The page's module
// script copies the exports onto window, which is how the page reaches them by bare name.
//
// Its browser check is test/smoke-autosave.mjs.

/* global saveBlueprintToLocalStorage -- 035's page function, called when the debounce fires */

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
