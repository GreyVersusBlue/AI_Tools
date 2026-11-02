// sv-snapshots.js — the School Layout Visualizer's named project snapshots (Round 39,
// Settings tab): four user slots and one auto slot in localStorage under STVIZ_SNAPSHOT_<n>,
// the list under Settings with Restore and Delete, and the Save snapshot button. Moved out
// of the page's classic script as a view module, the way sv-settings-editors.js is (rank 140,
// the second increment): behaviour, keys, markup and wording are unchanged. It reads the
// page at call time through the globals below; the page's module script copies its exports
// onto window, which is how the page's boot code reaches migrateSnapshotTraceImages(),
// sv-editor.js reaches saveSnapshot() for its
// "Auto — before clear" slot, and init() reaches initSnapshotManager().
//
// Its browser check is test/smoke-snapshots.mjs.

/* global serializeFullProject, applyFullProject, showToast, escHtml -- 035's page helpers */

/* ==============================================
   R39 — MODULE 5: PROJECT SNAPSHOTS
=============================================== */
export const SNAPSHOT_KEY_PREFIX = 'STVIZ_SNAPSHOT_';
export const SNAPSHOT_USER_SLOTS = 4;   // slots 1–4 are user slots; slot 0 is auto
export const SNAPSHOT_TOTAL      = 5;   // 0..4

export function snapshotKey(slot) {
  return SNAPSHOT_KEY_PREFIX + slot;
}

export function saveSnapshot(name, slot) {
  try {
    const data = serializeFullProject();
    const payload = JSON.stringify({ name, timestamp: new Date().toISOString(), data });
    localStorage.setItem(snapshotKey(slot !== undefined ? slot : _nextUserSnapshotSlot()), payload);
    renderSnapshotList();
    return true;
  } catch (e) {
    console.warn('[STVIZ] Snapshot save failed:', e);
    // R58: surface the failure instead of dying silently in the console.
    const isQuota = e && (e.name === 'QuotaExceededError' || e.code === 22 ||
                          e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    showToast(isQuota
      ? 'Snapshot not saved — browser storage is full. Delete an old snapshot and try again.'
      : 'Snapshot not saved — could not write to browser storage.', 'error');
    return false;
  }
}

/** Find the next available user slot (1-4), or the oldest one if all full. */
export function _nextUserSnapshotSlot() {
  for (let i = 1; i <= SNAPSHOT_USER_SLOTS; i++) {
    if (!localStorage.getItem(snapshotKey(i))) return i;
  }
  // All full — evict the oldest
  let oldest = null, oldestSlot = 1;
  for (let i = 1; i <= SNAPSHOT_USER_SLOTS; i++) {
    try {
      const snap = JSON.parse(localStorage.getItem(snapshotKey(i)));
      if (!snap) continue;
      if (!oldest || snap.timestamp < oldest) { oldest = snap.timestamp; oldestSlot = i; }
    } catch { /* skip */ }
  }
  return oldestSlot;
}

export function listSnapshots() {
  const snaps = [];
  for (let i = 0; i < SNAPSHOT_TOTAL; i++) {
    try {
      const raw = localStorage.getItem(snapshotKey(i));
      if (!raw) continue;
      const snap = JSON.parse(raw);
      // R58: localStorage stores UTF-16, so approximate bytes = 2 × chars.
      snaps.push({ slot: i, name: snap.name, timestamp: snap.timestamp,
                   isAuto: i === 0, sizeBytes: raw.length * 2 });
    } catch { /* skip corrupt entry */ }
  }
  // User slots sorted newest-first; auto slot always last
  const user = snaps.filter(s => !s.isAuto).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const auto = snaps.filter(s => s.isAuto);
  return [...user, ...auto];
}

export function restoreSnapshot(slot) {
  try {
    const raw = localStorage.getItem(snapshotKey(slot));
    if (!raw) { showToast('Snapshot not found.', 'error'); return; }
    const snap = JSON.parse(raw);
    applyFullProject(snap.data);
    showToast(`Snapshot "${escHtml(snap.name)}" restored.`, 'success');
  } catch (e) {
    showToast('Restore failed: snapshot data is corrupt.', 'error');
  }
}

export function deleteSnapshot(slot) {
  localStorage.removeItem(snapshotKey(slot));
  renderSnapshotList();
  showToast('Snapshot deleted.', 'info');
}

export function renderSnapshotList() {
  const listEl = document.getElementById('snapshot-list');
  if (!listEl) return;
  const snaps = listSnapshots();
  if (snaps.length === 0) {
    listEl.innerHTML = '<div class="snapshot-empty">No snapshots yet. Save one above.</div>';
    return;
  }
  listEl.innerHTML = snaps.map(snap => {
    const ts = (() => {
      try {
        const d = new Date(snap.timestamp);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
               ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      } catch { return snap.timestamp; }
    })();
    return `<div class="snapshot-item${snap.isAuto ? ' auto' : ''}">
      <span class="snapshot-item-icon">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${snap.isAuto
            ? '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
            : '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'}
        </svg>
      </span>
      <div class="snapshot-item-info">
        <div class="snapshot-item-name">${escHtml(snap.name)}</div>
        <div class="snapshot-item-ts">${escHtml(ts)} · ${(snap.sizeBytes / 1024).toFixed(1)} KB</div>
      </div>
      <div class="snapshot-item-actions">
        <button class="snapshot-action-btn restore" data-snapshot-slot="${snap.slot}">Restore</button>
        <button class="snapshot-action-btn del" data-snapshot-delete="${snap.slot}">Delete</button>
      </div>
    </div>`;
  }).join('') +
  // R58: total-usage footer — approximate share of the typical ~5 MB quota.
  (() => {
    const totalKB = snaps.reduce((s, x) => s + x.sizeBytes, 0) / 1024;
    return `<div class="snapshot-usage-line">Snapshots using ~${totalKB >= 1024
      ? (totalKB / 1024).toFixed(2) + ' MB' : totalKB.toFixed(1) + ' KB'} of ~5 MB browser storage</div>`;
  })();

  // Wire buttons via delegation
  listEl.querySelectorAll('[data-snapshot-slot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.snapshotSlot, 10);
      if (!confirm('Restore this snapshot? Current project will be replaced.')) return;
      restoreSnapshot(slot);
    });
  });
  listEl.querySelectorAll('[data-snapshot-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.snapshotDelete, 10);
      if (!confirm('Delete this snapshot? This cannot be undone.')) return;
      deleteSnapshot(slot);
    });
  });
}

export function initSnapshotManager() {
  // Render list on page load
  renderSnapshotList();

  // Save snapshot button
  document.getElementById('btn-save-snapshot')?.addEventListener('click', () => {
    const input = document.getElementById('snapshot-name-input');
    const name  = (input?.value || '').trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    const ok = saveSnapshot(name);
    if (input) input.value = '';
    if (ok) showToast(`Snapshot "${escHtml(name)}" saved.`, 'success');
  });
}

/* At boot: the snapshot slots taken before Path 4 P4 carry their trace images
   inline, one copy per slot. Move those into the store too (the same picture is
   one record, by content hash) and rewrite only the slots that changed, each
   re-read after the writes. A slot that does not parse is left as it is. */
export function migrateSnapshotTraceImages(api) {
  const read = (i) => { try { return JSON.parse(localStorage.getItem(snapshotKey(i))); } catch (e) { return null; } };
  const floorsOf = (snap) => (snap && snap.data && snap.data.blueprint && Array.isArray(snap.data.blueprint.floors))
    ? snap.data.blueprint.floors : [];
  const values = [];
  for (let i = 0; i < SNAPSHOT_TOTAL; i++) {
    api.valuesIn(floorsOf(read(i))).filter(api.isInline).forEach(v => values.push(v));
  }
  if (!values.length) return Promise.resolve(0);
  return api.store(values).then(map => {
    let moved = 0;
    for (let i = 0; i < SNAPSHOT_TOTAL; i++) {
      const snap = read(i);
      let n = 0;
      for (const f of floorsOf(snap)) {
        const t = f && f.traceImage;
        if (t && map[t.dataUrl]) { t.dataUrl = map[t.dataUrl]; n++; }
      }
      if (!n) continue;
      try { localStorage.setItem(snapshotKey(i), JSON.stringify(snap)); moved += n; }
      catch (e) { /* smaller than what is there, so this should not fail; if it does, the slot is untouched */ }
    }
    if (moved) renderSnapshotList();
    return moved;
  });
}
