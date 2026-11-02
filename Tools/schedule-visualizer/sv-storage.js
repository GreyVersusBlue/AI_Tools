// sv-storage.js — the School Layout Visualizer's storage-headroom warning (P12): after
// every successful autosave the page asks checkStorageHeadroom() whether this site's
// localStorage is near the ~5 MB floor, and a failed write shows the "could NOT be saved"
// banner through showStorageBanner(). Moved out of the page's classic script as a view
// module, the way sv-snapshots.js is (rank 140, the third increment): behaviour, ids,
// markup and wording are unchanged. The once-per-session flag is module state now; the
// page's module script copies the exports onto window, which is how saveBlueprintToLocalStorage()
// reaches them by bare name.
//
// Its browser check is test/smoke-storage-headroom.mjs.

/* global escHtml -- 035's page helper */

/* ── Storage headroom warning (P12) — a blueprint with a traced image plus
   snapshots was the largest payload on the site (since Path 4 P4 the images
   are in IndexedDB and the key holds a reference), and a silent write failure
   loses a period's worth of layout work with no indication anything went
   wrong. `estimateLocalStorageBytes()` is a character-count proxy for bytes
   (UTF-16 in practice runs closer to 2x this for non-ASCII text, so it's a
   conservative/low estimate, not exact) against the ~5MB-per-origin quota
   that's the practical floor across major browsers. Runs after every
   successful autosave; the proactive banner only fires once per session
   until usage drops back under the threshold, so it doesn't nag on every
   keystroke once shown. ── */
export const STORAGE_WARN_BYTES = 4 * 1024 * 1024; // ~80% of the common 5MB floor
let _storageWarnShown = false;

export function estimateLocalStorageBytes() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += (k || '').length + (localStorage.getItem(k) || '').length;
    }
  } catch (e) { /* storage blocked entirely — nothing to warn about here */ }
  return total;
}

export function checkStorageHeadroom() {
  const bytes = estimateLocalStorageBytes();
  if (bytes < STORAGE_WARN_BYTES) { _storageWarnShown = false; hideStorageBanner(); return; }
  if (_storageWarnShown) return;
  _storageWarnShown = true;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  showStorageBanner('warn',
    'This browser’s storage for this site is around ' + mb + ' MB, and most browsers cap it near 5 MB total. ' +
    'Export a backup now (Blueprint → Export) so a future full-quota write failure can’t silently lose your layout.');
}

export function showStorageBanner(kind, message) {
  let el = document.getElementById('stviz-storage-warn');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stviz-storage-warn';
    el.setAttribute('role', 'alert');
    document.body.appendChild(el);
  }
  el.className = 'stviz-storage-banner ' + kind;
  el.innerHTML = '<span>⚠ ' + escHtml(message) + '</span>' +
    '<button type="button" id="stviz-storage-warn-dismiss">Dismiss</button>';
  el.style.display = 'flex';
  document.getElementById('stviz-storage-warn-dismiss').addEventListener('click', hideStorageBanner);
}

export function hideStorageBanner() {
  const el = document.getElementById('stviz-storage-warn');
  if (el) el.style.display = 'none';
}
