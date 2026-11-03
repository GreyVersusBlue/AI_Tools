// sv-autosave.js — the School Layout Visualizer's autosave: the debounce, the write to
// localStorage and the "Saved 3:04:05 PM" indicator. Moved out of the page's classic script as a
// view module, the way sv-storage.js is (rank 140, the fourth and fifth increments): behaviour,
// ids and wording are unchanged. The load, with the quarantine copy of an unreadable save, is here
// too (rank 140, the sixth increment); applyBlueprintData() is sv-apply.js since the seventh; validateBlueprintData() stays on the
// page. The write reaches the page's serializeBlueprint(), BLUEPRINT_KEY,
// rebuildRoomRegistry() and adoptTraceImages() by bare name, at call time. The module owns two
// pieces of state, the debounce timer and the time of the last save; the page sets the second
// through setLastBlueprintSaveTime() (on "clear"; the load and the write set it themselves). The page's module
// script copies the exports onto window, which is how the page reaches them by bare name.
//
// Its browser check is test/smoke-autosave.mjs.

/* global AppState, validateBlueprintData, applyBlueprintData, serializeBlueprint, BLUEPRINT_KEY, rebuildRoomRegistry, adoptTraceImages, checkStorageHeadroom, showStorageBanner -- 035's page globals and sv-storage.js's, read at call time */

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

/* Why the last load did what it did: 'restored', 'empty' (nothing saved yet —
   a genuine first run) or 'corrupt' (there WAS a payload and it could not be
   read). Only the third case means work is missing, and it's the one that used
   to look identical to a first run — a console warning and an empty editor. */
let _blueprintLoadStatus = 'empty';
export function getBlueprintLoadStatus() { return _blueprintLoadStatus; }

/**
 * Load blueprint from localStorage on startup.
 */
export function loadBlueprintFromLocalStorage() {
  try {
    const raw = localStorage.getItem(BLUEPRINT_KEY);
    if (!raw) { _blueprintLoadStatus = 'empty'; return false; }

    const data = JSON.parse(raw);
    validateBlueprintData(data);
    applyBlueprintData(data);

    // Restore settings from blueprint if present
    if (data.settings && data.settings.schoolName) {
      // Don't overwrite schoolName if settings were also loaded; settings win
    }

    _lastBlueprintSaveTime = data.savedAt ? new Date(data.savedAt) : new Date();
    updateSaveIndicator();
    _blueprintLoadStatus = 'restored';
    return true;
  } catch(e) {
    console.warn('[STVIZ] Could not restore blueprint from localStorage:', e);
    _blueprintLoadStatus = 'corrupt';
    // Park the unreadable payload somewhere the autosave can't tread on it.
    // It may still be salvageable by hand, and the very next edit would
    // otherwise overwrite the only copy of it that exists.
    try {
      const raw = localStorage.getItem(BLUEPRINT_KEY);
      if (raw) localStorage.setItem('stviz_blueprint_unreadable', raw); // BLUEPRINT_KEY + '_unreadable', spelled out so check:registry can resolve it
    } catch (e2) { /* no room to quarantine it — nothing more we can do */ }
    return false;
  }
}
