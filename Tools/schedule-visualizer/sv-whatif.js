// sv-whatif.js — the School Layout Visualizer's room search (jump to a room
// on the blueprint) and the what-if schedule lab's controls: the group and
// mod pickers, the override store, the scenario cards, the conflicts list,
// the diff map and its tooltip, and saving the sandbox.
//
// Path 11 P2 increment 11 (BACKLOG.md, "Path 11", the P2 bullet). Moved
// verbatim from 035's classic script ("R39 — MODULE 1: ROOM SEARCH &
// JUMP-TO" and "ROUND 51 — WHAT-IF SCHEDULE LAB") with no function changed.
// Like sv-viz.js this is a view: it owns the lab's DOM and reads the page at
// call time through the globals listed below. The arithmetic (metrics, the
// diff, the effective mods) is sv-congestion.js since increment 5, reached
// through the page's BRIDGE wrappers; AppState.whatif stays on the page, as
// AppState.viz does. The page's module script copies every export onto
// window, which is the global surface the classic script had.

/* global AppState, roomRegistry -- 035's classic-script state */
/* global ctx:writable, vizCtx:writable -- canvas lets the page declares (the diff map swaps both to draw off screen) */
/* global wiBaseMods, wiEffectiveMods, wiComputeDiff, getAllModLabels, formatTransitionWindow, parseKey, floorCellKey, rebuildRoomRegistry, saveSchedules, escHtml, showToast, renderConflictBanner -- 035's BRIDGE wrappers and page helpers */
/* global renderCanvas, getEffectiveCellSize, getTile, getGroupCenterX, getGroupCenterY, switchActiveFloor -- sv-editor.js */
/* global scheduleGroupsAutosave, renderGroupList -- sv-schedules-tab.js */
/* global maxFloorWidthPx, totalVizCanvasHeight, drawVizBlueprint, floorOffsetY, cellCongestionLabel, congestionDisplayText -- sv-viz.js */

/* ==============================================
   R39 — MODULE 1: ROOM SEARCH & JUMP-TO
=============================================== */
let _searchHighlightTimer = null;

function initRoomSearch() {
  const overlay   = document.getElementById('bp-room-search');
  const input     = document.getElementById('bp-room-search-input');
  const dropdown  = document.getElementById('bp-room-search-dropdown');
  const closeBtn  = document.getElementById('bp-room-search-close');
  const inputRow  = document.getElementById('bp-room-search-input-row');
  if (!overlay || !input || !dropdown) return;

  // Keyboard shortcut: Ctrl/Cmd+F while blueprint tab is active
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (AppState.ui.activeTab !== 'blueprint') return;
      e.preventDefault();
      openRoomSearch();
    }
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      closeRoomSearch();
    }
  });

  // Close on outside click
  document.addEventListener('mousedown', e => {
    if (overlay.style.display !== 'none' && !overlay.contains(e.target)) {
      closeRoomSearch();
    }
  });

  closeBtn.addEventListener('click', closeRoomSearch);

  input.addEventListener('input', () => {
    renderRoomSearchDropdown(input.value.trim());
    inputRow.classList.toggle('has-results',
      dropdown.children.length > 0 && input.value.trim().length > 0);
  });

  // Close & clear highlight on canvas click
  const canvasEl = document.getElementById('bp-canvas');
  if (canvasEl) {
    canvasEl.addEventListener('mousedown', () => {
      if (AppState.ui.searchHighlightCell) {
        AppState.ui.searchHighlightCell = null;
        renderCanvas();
      }
    });
  }
}

function openRoomSearch() {
  const overlay = document.getElementById('bp-room-search');
  const input   = document.getElementById('bp-room-search-input');
  if (!overlay) return;
  overlay.style.display = '';
  input.value = '';
  document.getElementById('bp-room-search-dropdown').innerHTML = '';
  document.getElementById('bp-room-search-input-row')?.classList.remove('has-results');
  requestAnimationFrame(() => input.focus());
}

function closeRoomSearch() {
  const overlay = document.getElementById('bp-room-search');
  if (overlay) overlay.style.display = 'none';
}

function renderRoomSearchDropdown(query) {
  const dropdown = document.getElementById('bp-room-search-dropdown');
  if (!dropdown) return;
  if (!query) { dropdown.innerHTML = ''; return; }

  const q = query.toLowerCase();
  const allRooms = roomRegistry; // global

  // Rank: exact prefix first, then substring
  const exactPrefix = [];
  const substring   = [];
  for (const room of allRooms) {
    const rn = (room.roomNumber || '').toLowerCase();
    const tn = (room.teacherName || '').toLowerCase();
    if (rn.startsWith(q)) { exactPrefix.push(room); }
    else if (rn.includes(q) || tn.includes(q)) { substring.push(room); }
  }
  const results = [...exactPrefix, ...substring].slice(0, 8);

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="bp-search-no-results">No rooms match "${escHtml(query)}"</div>`;
    return;
  }

  const floors = AppState.blueprint.floors;
  dropdown.innerHTML = results.map(room => {
    const floorLabel = floors.length > 1
      ? (floors.find(f => f.id === (room.floorId || floors[0].id))?.label || '')
      : '';
    return `<div class="bp-search-item" data-col="${room.anchorCol}" data-row="${room.anchorRow}" data-floor-id="${room.floorId || ''}">
      <span class="bp-search-item-room">${escHtml(room.roomNumber)}</span>
      <span class="bp-search-item-teacher">${room.teacherName ? escHtml(room.teacherName) : '<span style="color:var(--slate-300)">No teacher assigned</span>'}</span>
      ${floorLabel ? `<span class="bp-search-item-floor">${escHtml(floorLabel)}</span>` : ''}
    </div>`;
  }).join('');

  dropdown.querySelectorAll('.bp-search-item').forEach(el => {
    el.addEventListener('click', () => {
      const col     = parseInt(el.dataset.col, 10);
      const row     = parseInt(el.dataset.row, 10);
      const floorId = el.dataset.floorId;
      jumpToRoomSearchResult(col, row, floorId);
      closeRoomSearch();
    });
  });
}

function jumpToRoomSearchResult(col, row, floorId) {
  // If the result is on a different floor, switch to it first
  if (floorId) {
    const floorIdx = AppState.blueprint.floors.findIndex(f => f.id === floorId);
    if (floorIdx >= 0 && floorIdx !== AppState.blueprint.activeFloorIdx) {
      if (typeof switchActiveFloor === 'function') switchActiveFloor(floorIdx);
    }
  }

  const cellSize  = getEffectiveCellSize();
  const tile      = getTile(col, row);
  const groupId   = tile && tile.groupId;

  // Compute anchor pixel center
  const px = groupId ? getGroupCenterX(col, row, groupId, cellSize) : (col + 0.5) * cellSize;
  const py = groupId ? getGroupCenterY(col, row, groupId, cellSize) : (row + 0.5) * cellSize;

  // Scroll bp-canvas-area so the cell is centered in the viewport
  const area = document.getElementById('bp-canvas-area');
  if (area) {
    const z = AppState.ui.zoom || 1;
    area.scrollLeft = px * z - area.clientWidth  / 2;
    area.scrollTop  = py * z - area.clientHeight / 2;
  }

  // Set highlight and auto-clear after 2000 ms
  if (_searchHighlightTimer) clearTimeout(_searchHighlightTimer);
  AppState.ui.searchHighlightCell = { col, row };
  renderCanvas();
  _searchHighlightTimer = setTimeout(() => {
    AppState.ui.searchHighlightCell = null;
    renderCanvas();
    _searchHighlightTimer = null;
  }, 2000);
}

/* ══════════════════════════════════════════════════════════════
   ROUND 51 — WHAT-IF SCHEDULE LAB
   ──────────────────────────────────────────────────────────────
   A constraint-aware schedule simulator layered on the existing
   A* pathfinding and congestion engines. Reassignments live in a
   sandbox ("overrides") that NEVER mutates the real group objects;
   every edit recomputes baseline-vs-scenario metrics:
     • per-group and total travel time (walk + congestion delay,
       same multiplier model as computeTravelTimes / R49-R50)
     • per-transition corridor concurrency + whole-day congestion
     • room double-booking conflicts (excluded rooms respected)
     • routing violations (unreachable rooms / unassigned mods)
   The diff renders as summary cards, a red/blue congestion-delta
   map over the stacked floor blueprint (export-canvas redirect
   pattern), per-group tables, hotspot lists, and a constraint
   panel. "Apply Scenario" commits overrides to the live schedule.
══════════════════════════════════════════════════════════════ */

const WHATIF_KEY = 'stviz_whatif';


let _wiSaveTimer   = null;
let _wiRenderTimer = null;

/* ── Persistence ─────────────────────────────────────────────── */
function saveWhatIf(immediate) {
  const write = () => {
    try {
      localStorage.setItem(WHATIF_KEY, JSON.stringify({
        day: AppState.whatif.day,
        overrides: AppState.whatif.overrides,
      }));
    } catch (e) { /* quota — non-fatal */ }
  };
  if (immediate) { if (_wiSaveTimer) clearTimeout(_wiSaveTimer); _wiSaveTimer = null; write(); return; }
  if (_wiSaveTimer) clearTimeout(_wiSaveTimer);
  _wiSaveTimer = setTimeout(() => { _wiSaveTimer = null; write(); }, 400);
}

function loadWhatIf() {
  try {
    const raw = localStorage.getItem(WHATIF_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      if (data.day === 'A' || data.day === 'B') AppState.whatif.day = data.day;
      if (data.overrides && typeof data.overrides === 'object' && !Array.isArray(data.overrides)) {
        AppState.whatif.overrides = data.overrides;
      }
    }
  } catch (e) { /* corrupt blob — start clean */ }
}

/* ── R58: What-If ↔ full-project bridge ─────────────────────────
   Live overrides are keyed by group id, but applyFullProject
   regenerates every id on import. The project file therefore
   stores overrides keyed by group ARRAY INDEX (stable in export
   order); these two helpers remap in each direction. */
function serializeWhatIfForProject() {
  const out = { version: 1, day: AppState.whatif.day, overridesByIndex: {} };
  const groups = AppState.schedules.groups;
  const src = AppState.whatif.overrides || {};
  for (const gid in src) {
    const idx = groups.findIndex(g => g.id === gid);
    if (idx === -1) continue;                       // orphaned override — drop
    const mods = src[gid];
    if (!mods || typeof mods !== 'object' || !Object.keys(mods).length) continue;
    out.overridesByIndex[idx] = { ...mods };
  }
  return out;
}

function applyWhatIfFromProject(wi, cleanGroups) {
  // Always reset the sandbox first so a pre-R58 file (no `whatif` key)
  // imports with a clean scenario instead of stale, orphaned overrides.
  AppState.whatif.overrides = {};
  AppState.whatif.day = 'A';
  if (wi && typeof wi === 'object') {
    if (wi.day === 'A' || wi.day === 'B') AppState.whatif.day = wi.day;
    const byIdx = wi.overridesByIndex;
    if (byIdx && typeof byIdx === 'object' && !Array.isArray(byIdx)) {
      for (const key in byIdx) {
        const idx = parseInt(key, 10);
        const group = Number.isInteger(idx) ? cleanGroups[idx] : null;
        const mods = byIdx[key];
        if (!group || !mods || typeof mods !== 'object' || Array.isArray(mods)) continue;
        AppState.whatif.overrides[group.id] = { ...mods };
      }
    }
  }
  AppState.whatif.selectedGroupId = null;
  AppState.whatif.lastDiff = null;
  saveWhatIf(true);
  // Day toggle buttons live outside onWhatIfTabActivated — sync them here.
  document.querySelectorAll('.wi-day-btn').forEach(b =>
    b.classList.toggle('active', (b.dataset.wiDay === 'B' ? 'B' : 'A') === AppState.whatif.day));
  // Refresh the What-If tab UI. If the tab is active, run the full
  // activation pipeline (repopulates selects, editor, chips, results);
  // otherwise just keep the tab badge honest.
  if (AppState.ui.activeTab === 'whatif') {
    onWhatIfTabActivated();
  } else if (typeof wiUpdateBadge === 'function') {
    wiUpdateBadge();
  }
}

/* ── Override bookkeeping ────────────────────────────────────── */
function wiOverrideCount() {
  let n = 0;
  for (const gid in AppState.whatif.overrides) n += Object.keys(AppState.whatif.overrides[gid]).length;
  return n;
}

/* wiBaseMods, wiEffectiveMods, the metrics engine (wiComputeMetrics) and
   wiComputeDiff are schedule-visualizer/sv-congestion.js, through their BRIDGE
   wrappers. */

/* ── Override mutations ──────────────────────────────────────── */
function wiSetOverride(groupId, modIdx, room) {
  const group = AppState.schedules.groups.find(g => g.id === groupId);
  if (!group) return;
  const baseRoom = wiBaseMods(group, AppState.whatif.day)[modIdx] || '';
  const next = ((room || '') + '').trim();
  const ov = AppState.whatif.overrides;
  if (next === baseRoom) {
    if (ov[groupId]) { delete ov[groupId][modIdx]; if (!Object.keys(ov[groupId]).length) delete ov[groupId]; }
  } else {
    if (!ov[groupId]) ov[groupId] = {};
    ov[groupId][modIdx] = next;
  }
  wiAfterOverridesChanged();
}

function wiRemoveOverride(groupId, modIdx) {
  const ov = AppState.whatif.overrides;
  if (ov[groupId]) {
    delete ov[groupId][modIdx];
    if (!Object.keys(ov[groupId]).length) delete ov[groupId];
  }
  wiAfterOverridesChanged();
}

function wiResetScenario() {
  const n = wiOverrideCount();
  if (!n) return;
  if (!window.confirm(`Discard all ${n} scenario change${n === 1 ? '' : 's'}? The live schedule is unaffected either way.`)) return;
  AppState.whatif.overrides = {};
  wiAfterOverridesChanged();
  showToast('Scenario reset — back to the live schedule.', 'info');
}

/** Commit sandbox overrides into the real group schedules. */
function wiApplyScenario() {
  const count = wiOverrideCount();
  if (!count) return;
  const day = AppState.whatif.day;
  if (!window.confirm(
    `Apply ${count} change${count === 1 ? '' : 's'} to the live ${day} Day schedule?\n\n` +
    `This rewrites the affected groups' room assignments (you can edit them back in the Schedules tab).`
  )) return;

  const modCount = AppState.settings.modCount;
  for (const gid of Object.keys(AppState.whatif.overrides)) {
    const group = AppState.schedules.groups.find(g => g.id === gid);
    if (!group) continue;
    const eff = wiEffectiveMods(group, day, AppState.whatif.overrides);
    if (day === 'B') {
      group.modsB = eff.slice(0, modCount);
    } else {
      group.modsA = eff.slice(0, modCount);
      if (Array.isArray(group.mods)) group.mods = eff.slice(0, modCount); // keep legacy mirror coherent
    }
  }
  AppState.whatif.overrides = {};
  saveWhatIf(true);
  saveSchedules();
  if (typeof scheduleGroupsAutosave === 'function') scheduleGroupsAutosave();
  if (typeof renderGroupList === 'function') renderGroupList();
  if (typeof renderConflictBanner === 'function') renderConflictBanner();
  showToast(`Scenario applied to the ${day} Day schedule.`, 'success');
  wiAfterOverridesChanged();
}

/** Drop overrides that no longer point at anything real (deleted groups,
 *  shrunk mod counts, or edits that converged back to the baseline). */
function wiPruneOverrides() {
  const ov = AppState.whatif.overrides;
  const modCount = AppState.settings.modCount;
  let dirty = false;
  for (const gid of Object.keys(ov)) {
    const group = AppState.schedules.groups.find(g => g.id === gid);
    if (!group) { delete ov[gid]; dirty = true; continue; }
    const baseMods = wiBaseMods(group, AppState.whatif.day);
    for (const k of Object.keys(ov[gid])) {
      const idx = +k;
      if (!(idx >= 0 && idx < modCount) || ((ov[gid][k] || '') + '').trim() === baseMods[idx]) {
        delete ov[gid][k]; dirty = true;
      }
    }
    if (!Object.keys(ov[gid]).length) { delete ov[gid]; dirty = true; }
  }
  if (dirty) saveWhatIf();
}

/* ── Shared render plumbing ──────────────────────────────────── */
function wiAfterOverridesChanged() {
  saveWhatIf();
  wiUpdateBadge();
  wiRenderChips();
  wiRenderModEditor();
  wiUpdateActionButtons();
  wiScheduleRender();
}

function wiUpdateBadge() {
  const badge = document.getElementById('badge-whatif');
  if (!badge) return;
  const n = wiOverrideCount();
  badge.textContent = String(n);
  badge.style.display = n > 0 ? 'inline-flex' : 'none';
  const cnt = document.getElementById('wi-change-count');
  if (cnt) cnt.textContent = n > 0 ? `(${n})` : '';
}

function wiUpdateActionButtons() {
  const n = wiOverrideCount();
  const apply = document.getElementById('wi-apply-btn');
  const reset = document.getElementById('wi-reset-btn');
  if (apply) apply.disabled = n === 0;
  if (reset) reset.disabled = n === 0;
}

function wiScheduleRender() {
  if (_wiRenderTimer) clearTimeout(_wiRenderTimer);
  _wiRenderTimer = setTimeout(() => { _wiRenderTimer = null; wiRenderAll(); }, 30);
}

function wiFmtSec(s) {
  s = Math.round(Math.abs(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`;
}

/* ── Left panel: editor UI ───────────────────────────────────── */
function wiPopulateGroupSelect() {
  const sel = document.getElementById('wi-group-select');
  if (!sel) return;
  const groups = AppState.schedules.groups.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!groups.length) {
    sel.innerHTML = '<option value="">— no groups defined —</option>';
    AppState.whatif.selectedGroupId = null;
    return;
  }
  if (!groups.find(g => g.id === AppState.whatif.selectedGroupId)) {
    AppState.whatif.selectedGroupId = groups[0].id;
  }
  sel.innerHTML = groups.map(g =>
    `<option value="${escHtml(g.id)}"${g.id === AppState.whatif.selectedGroupId ? ' selected' : ''}>` +
    `${escHtml(g.name)}${g.grade ? ' · Grade ' + escHtml(String(g.grade)) : ''}</option>`
  ).join('');
}

function wiRenderModEditor() {
  const host = document.getElementById('wi-mod-editor');
  if (!host) return;
  const group = AppState.schedules.groups.find(g => g.id === AppState.whatif.selectedGroupId);
  if (!group) {
    host.innerHTML = '<div class="wi-empty-note">Add groups in the Schedules tab to start experimenting.</div>';
    return;
  }
  const day      = AppState.whatif.day;
  const modCount = AppState.settings.modCount;
  const labels   = getAllModLabels();
  const baseMods = wiBaseMods(group, day);
  const ov       = AppState.whatif.overrides[group.id] || {};
  const roomNums = roomRegistry.map(r => r.roomNumber);
  const roomSet  = new Set(roomNums);

  let html = '';
  for (let i = 0; i < modCount; i++) {
    const baseRoom = baseMods[i];
    const hasOv    = Object.prototype.hasOwnProperty.call(ov, i);
    const effRoom  = hasOv ? ((ov[i] || '') + '').trim() : baseRoom;
    // Keep baseline/effective rooms selectable even if they left the registry.
    const extras = [effRoom, baseRoom].filter(r => r && !roomSet.has(r));
    const opts = [`<option value=""${effRoom === '' ? ' selected' : ''}>— unassigned —</option>`]
      .concat(roomNums.concat(extras).map(r =>
        `<option value="${escHtml(r)}"${r === effRoom ? ' selected' : ''}>${escHtml(r)}</option>`));
    html += `
      <div class="wi-mod-row${hasOv ? ' modified' : ''}">
        <span class="wi-mod-label">${escHtml(labels[i] || ('Mod ' + (i + 1)))}</span>
        <select class="viz-select wi-mod-select" data-mod-idx="${i}" aria-label="Room for ${escHtml(labels[i] || ('Mod ' + (i + 1)))}">${opts.join('')}</select>
        <button class="wi-revert-btn" data-mod-idx="${i}" title="Revert to scheduled room (${escHtml(baseRoom || 'unassigned')})">&#8634;</button>
      </div>`;
    if (hasOv) html += `<div class="wi-base-hint">scheduled: ${escHtml(baseRoom || 'unassigned')}</div>`;
  }
  host.innerHTML = html;
  host.querySelectorAll('.wi-mod-select').forEach(s => s.addEventListener('change', e => {
    wiSetOverride(group.id, +e.target.dataset.modIdx, e.target.value);
  }));
  host.querySelectorAll('.wi-revert-btn').forEach(b => b.addEventListener('click', e => {
    wiRemoveOverride(group.id, +e.currentTarget.dataset.modIdx);
  }));
}

function wiRenderChips() {
  const host = document.getElementById('wi-override-chips');
  if (!host) return;
  const ov = AppState.whatif.overrides;
  const labels = getAllModLabels();
  const day = AppState.whatif.day;
  const chips = [];
  for (const gid of Object.keys(ov)) {
    const group = AppState.schedules.groups.find(g => g.id === gid);
    if (!group) continue;
    const baseMods = wiBaseMods(group, day);
    const idxs = Object.keys(ov[gid]).map(Number).sort((a, b) => a - b);
    for (const idx of idxs) {
      const from = baseMods[idx] || '—';
      const to   = ((ov[gid][idx] || '') + '').trim() || '—';
      chips.push(
        `<div class="wi-chip"><span>${escHtml(group.name)} · ${escHtml(labels[idx] || ('Mod ' + (idx + 1)))}: ` +
        `<b>${escHtml(from)}</b> &rarr; <b>${escHtml(to)}</b></span>` +
        `<button class="wi-chip-x" data-gid="${escHtml(gid)}" data-idx="${idx}" title="Remove this change">&times;</button></div>`
      );
    }
  }
  host.innerHTML = chips.length
    ? chips.join('')
    : '<div class="wi-empty-note">No changes yet. The scenario currently mirrors the live schedule.</div>';
  host.querySelectorAll('.wi-chip-x').forEach(b => b.addEventListener('click', e => {
    wiRemoveOverride(e.currentTarget.dataset.gid, +e.currentTarget.dataset.idx);
  }));
}

function wiPopulateTransitionSelect() {
  const sel = document.getElementById('wi-transition-select');
  if (!sel) return;
  const labels = getAllModLabels();
  const modCount = AppState.settings.modCount;
  const opts = ['<option value="">All transitions (whole day)</option>'];
  for (let t = 1; t <= modCount - 1; t++) {
    const win = formatTransitionWindow(AppState.whatif.day || 'A', t);   // R59
    const lbl = `${labels[t - 1] || ('Mod ' + t)} \u2192 ${labels[t] || ('Mod ' + (t + 1))}${win ? ' \u00b7 ' + win : ''}`;
    opts.push(`<option value="${t}"${AppState.whatif.transitionFilter === t ? ' selected' : ''}>${escHtml(lbl)}</option>`);
  }
  sel.innerHTML = opts.join('');
}

/* ── Right panel: results rendering ──────────────────────────── */
function wiRenderAll() {
  const emptyEl = document.getElementById('wi-results-empty');
  const innerEl = document.getElementById('wi-results-inner');
  if (!emptyEl || !innerEl) return;
  if (!AppState.schedules.groups.length || !roomRegistry.length) {
    emptyEl.style.display = '';
    innerEl.style.display = 'none';
    AppState.whatif.lastDiff = null;
    return;
  }
  emptyEl.style.display = 'none';
  innerEl.style.display = '';

  const diff = wiComputeDiff();
  AppState.whatif.lastDiff = diff;
  wiRenderCards(diff);
  wiRenderDiffMap(diff);
  wiRenderGroupTable(diff);
  wiRenderHotspots(diff);
  wiRenderConflicts(diff);
}

function wiDeltaPill(delta, fmt) {
  const cls  = delta === 0 ? 'flat' : (delta > 0 ? 'up' : 'down');
  const sign = delta > 0 ? '+' : (delta < 0 ? '\u2212' : '\u00b1');
  return `<span class="wi-delta ${cls}">${sign}${fmt(Math.abs(delta))}</span>`;
}

function wiRenderCards(diff) {
  const host = document.getElementById('wi-cards');
  if (!host) return;
  const b = diff.base, s = diff.scen;
  const cards = [
    { title: 'Total Travel Time \u00b7 All Groups',
      before: b.totals.travelSec + b.totals.delaySec,
      after:  s.totals.travelSec + s.totals.delaySec, fmt: wiFmtSec },
    { title: 'Congestion Delay',
      before: b.totals.delaySec, after: s.totals.delaySec, fmt: wiFmtSec },
    { title: 'Peak Transition Load',
      // R59: loads are student-weighted — show ~students when any group has a
      // size, otherwise divide back to exact group counts (pre-R59 display).
      before: b.peak.load, after: s.peak.load,
      fmt: v => b.weighted
        ? `~${Math.round(v)} students`
        : (() => { const n = Math.round(v / (b.defaultGroupSize || 25)); return n + (n === 1 ? ' group' : ' groups'); })() },
    { title: 'Room Double-Bookings',
      before: b.conflicts.length, after: s.conflicts.length, fmt: v => String(v) },
  ];
  host.innerHTML = cards.map(c => {
    const d = c.after - c.before;
    return `<div class="wi-card">
      <div class="wi-card-title">${c.title}</div>
      <div class="wi-card-vals">${d !== 0 ? `<span class="wi-card-before">${c.fmt(c.before)}</span>` : ''}<span class="wi-card-after">${c.fmt(c.after)}</span></div>
      ${wiDeltaPill(d, c.fmt)}
    </div>`;
  }).join('');
}

/**
 * Red/blue congestion-delta map over the stacked floor blueprint.
 * Uses the export-canvas pattern: drawVizBlueprint() against an offscreen
 * canvas with ctx/vizCtx temporarily redirected inside try/finally, then
 * a per-cell delta overlay, then a DPR-aware scaled blit into #wi-diff-canvas.
 */
function wiRenderDiffMap(diff) {
  const canvas = document.getElementById('wi-diff-canvas');
  const wrap   = document.getElementById('wi-map-wrap');
  if (!canvas || !wrap) return;
  const cellSize = getEffectiveCellSize();
  const logicalW = maxFloorWidthPx();
  const logicalH = totalVizCanvasHeight();
  if (!logicalW || !logicalH) return;
  const floor0Id = AppState.blueprint.floors[0] && AppState.blueprint.floors[0].id;

  const off = document.createElement('canvas');
  off.width = logicalW; off.height = logicalH;
  const offCtx = off.getContext('2d');
  if (!offCtx) return;

  const savedCtx = ctx, savedVizCtx = vizCtx;
  ctx = offCtx; vizCtx = offCtx;
  try {
    drawVizBlueprint();
  } finally {
    ctx = savedCtx; vizCtx = savedVizCtx;
  }

  // Soften the blueprint so the delta overlay reads clearly.
  offCtx.fillStyle = 'rgba(255,255,255,0.45)';
  offCtx.fillRect(0, 0, logicalW, logicalH);

  const maxAbs = Math.max(1, diff.maxAbs);
  for (const [k, d] of diff.deltas) {
    const { x, y, floorId } = parseKey(k);
    const offY = floorOffsetY(floorId || floor0Id);
    const px = x * cellSize, py = offY + y * cellSize;
    const a = 0.28 + 0.55 * (Math.abs(d) / maxAbs);
    offCtx.fillStyle = d > 0 ? `rgba(220,38,38,${a.toFixed(3)})` : `rgba(37,99,235,${a.toFixed(3)})`;
    offCtx.fillRect(px, py, cellSize, cellSize);
    offCtx.strokeStyle = d > 0 ? 'rgba(153,27,27,0.55)' : 'rgba(30,64,175,0.55)';
    offCtx.lineWidth = 1;
    offCtx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  }

  const availW = Math.max(280, wrap.clientWidth - 2 || 0);
  const scale  = Math.min(1, availW / logicalW);
  const dispW  = Math.max(1, Math.round(logicalW * scale));
  const dispH  = Math.max(1, Math.round(logicalH * scale));
  const dpr    = window.devicePixelRatio || 1;
  canvas.width = dispW * dpr; canvas.height = dispH * dpr;
  canvas.style.width = dispW + 'px'; canvas.style.height = dispH + 'px';
  const dctx = canvas.getContext('2d');
  if (!dctx) return;
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.imageSmoothingEnabled = true;
  dctx.clearRect(0, 0, dispW, dispH);
  dctx.drawImage(off, 0, 0, dispW, dispH);

  AppState.whatif._mapLayout = { scale, cellSize };
}

function wiRenderGroupTable(diff) {
  const host = document.getElementById('wi-group-table-wrap');
  if (!host) return;
  const rows = diff.groupRows.slice().sort((a, b) =>
    Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  host.innerHTML =
    `<table class="wi-table"><thead><tr><th>Group</th><th style="text-align:right;">Before</th><th style="text-align:right;">After</th><th style="text-align:right;">&Delta;</th></tr></thead><tbody>` +
    rows.map(r => {
      const col  = r.delta > 0 ? '#b91c1c' : r.delta < 0 ? '#047857' : 'var(--slate-400)';
      const sign = r.delta > 0 ? '+' : r.delta < 0 ? '\u2212' : '\u00b1';
      return `<tr>
        <td><span class="wi-dot" style="background:${escHtml(r.color || '#64748b')};"></span>${escHtml(r.name)}${r.changed ? ' <span style="color:var(--warn);font-size:10px;font-weight:600;">&#9679; edited</span>' : ''}</td>
        <td class="num">${wiFmtSec(r.before)}</td>
        <td class="num">${wiFmtSec(r.after)}</td>
        <td class="num" style="color:${col};font-weight:600;">${sign}${wiFmtSec(Math.abs(r.delta))}</td>
      </tr>`;
    }).join('') + '</tbody></table>';
}

function wiRenderHotspots(diff) {
  const host = document.getElementById('wi-hotspots');
  if (!host) return;
  const entries = [...diff.deltas.entries()];
  if (!entries.length) {
    host.innerHTML = '<div class="wi-empty-note">No corridor-level changes \u2014 the scenario routes match the live schedule.</div>';
    return;
  }
  const worsened = entries.filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const improved = entries.filter(e => e[1] < 0).sort((a, b) => a[1] - b[1]).slice(0, 5);
  const item = (e) => {
    const k = e[0], d = e[1];
    const { x, y, floorId } = parseKey(k);
    const lbl = cellCongestionLabel(x, y, floorId);
    const floor = (AppState.blueprint.floors.find(f => f.id === floorId) || {}).label || '';
    const before = diff.baseMap.get(k) || 0, after = diff.scenMap.get(k) || 0;
    // R59: hotspot loads are student-weighted — display via the shared helper
    // ("~87 students" when sized, exact group counts otherwise).
    const wm = { weighted: diff.base.weighted, defaultGroupSize: diff.base.defaultGroupSize };
    const beforeTxt = congestionDisplayText(wm, before), afterTxt = congestionDisplayText(wm, after);
    const unit = diff.base.weighted ? ' students' : '';
    const col = d > 0 ? '#b91c1c' : '#047857';
    return `<div class="wi-hot-item"><span><b>${escHtml(lbl.label || 'Hallway')}</b>` +
      `${lbl.sub ? ` <span style="color:var(--slate-400);">\u00b7 ${escHtml(lbl.sub)}</span>` : ''}` +
      `${floor ? ` <span style="color:var(--slate-400);">\u00b7 ${escHtml(floor)}</span>` : ''}</span>` +
      `<span class="wi-hot-delta" style="color:${col};">${beforeTxt} \u2192 ${afterTxt}${unit}</span></div>`;
  };
  let html = '';
  if (worsened.length) html += '<div class="viz-section-label" style="margin-bottom:4px;">More crowded</div>' + worsened.map(item).join('');
  if (improved.length) html += `<div class="viz-section-label" style="margin:${worsened.length ? '12px' : '0'} 0 4px;">Less crowded</div>` + improved.map(item).join('');
  host.innerHTML = html;
}

function wiRenderConflicts(diff) {
  const host = document.getElementById('wi-conflicts');
  if (!host) return;
  const rows = [];
  const conflictLine = (tag, c) =>
    `<div class="wi-hot-item"><span><span class="wi-conflict-tag ${tag}">${tag === 'new' ? 'New' : 'Resolved'}</span>` +
    `${escHtml(c.modLabel)} \u00b7 Room <b style="font-family:var(--font-mono);">${escHtml(c.room)}</b> \u2014 ` +
    `${c.groupNames.map(escHtml).join(', ')}</span></div>`;
  diff.newConflicts.forEach(c => rows.push(conflictLine('new', c)));
  diff.resolvedConflicts.forEach(c => rows.push(conflictLine('resolved', c)));
  if (diff.persistingConflicts.length) {
    rows.push(`<div class="wi-hot-item"><span><span class="wi-conflict-tag existing">Existing</span>` +
      `${diff.persistingConflicts.length} pre-existing double-booking${diff.persistingConflicts.length === 1 ? '' : 's'} unaffected by this scenario</span></div>`);
  }
  const rb = diff.base.routingErrors + diff.base.unassigned;
  const rs = diff.scen.routingErrors + diff.scen.unassigned;
  if (rb !== rs) {
    rows.push(`<div class="wi-hot-item"><span><span class="wi-conflict-tag ${rs > rb ? 'new' : 'resolved'}">${rs > rb ? 'Warning' : 'Improved'}</span>` +
      `Routing issues (no path / unassigned mods): ${rb} \u2192 ${rs}</span></div>`);
  }
  host.innerHTML = rows.length
    ? rows.join('')
    : '<div class="wi-empty-note">No double-bookings or routing violations introduced by this scenario. \u2713</div>';
}

/* ── Map tooltip ─────────────────────────────────────────────── */
function wiOnMapMove(e) {
  const tip    = document.getElementById('wi-tooltip');
  const diff   = AppState.whatif.lastDiff;
  const layout = AppState.whatif._mapLayout;
  if (!tip || !diff || !layout || !layout.scale) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const lx = (e.clientX - rect.left) / layout.scale;
  const ly = (e.clientY - rect.top)  / layout.scale;
  const cellSize = layout.cellSize;

  let hit = null;
  for (const f of AppState.blueprint.floors) {
    const offY = floorOffsetY(f.id);
    if (ly >= offY && ly < offY + f.gridRows * cellSize) { hit = { f, offY }; break; }
  }
  if (!hit) { tip.style.display = 'none'; return; }
  const x = Math.floor(lx / cellSize);
  const y = Math.floor((ly - hit.offY) / cellSize);
  if (x < 0 || y < 0 || x >= hit.f.gridCols || y >= hit.f.gridRows) { tip.style.display = 'none'; return; }

  const k = floorCellKey(hit.f.id, x, y);
  const before = diff.baseMap.get(k) || 0;
  const after  = diff.scenMap.get(k) || 0;
  if (!before && !after) { tip.style.display = 'none'; return; }

  const lbl = cellCongestionLabel(x, y, hit.f.id);
  const d = after - before;
  const dTxt = d === 0 ? '\u00b10' : (d > 0 ? '+' + d : String(d));
  tip.innerHTML =
    `<div><b>${escHtml(lbl.label || 'Hallway')}</b>${lbl.sub ? ` <span class="tt-sub">\u00b7 ${escHtml(lbl.sub)}</span>` : ''}</div>` +
    `<div class="tt-sub">${escHtml(hit.f.label || '')} \u00b7 ${before} \u2192 ${after} group path${after === 1 ? '' : 's'} (${dTxt})</div>`;
  tip.style.display = 'block';
  tip.style.left = Math.min(window.innerWidth - 260, e.clientX + 14) + 'px';
  tip.style.top  = (e.clientY + 14) + 'px';
}

function wiOnMapLeave() {
  const tip = document.getElementById('wi-tooltip');
  if (tip) tip.style.display = 'none';
}

/* ── Activation + init ───────────────────────────────────────── */
function onWhatIfTabActivated() {
  rebuildRoomRegistry();   // fresh room → cell map; graph self-validates via dirty flag
  wiPruneOverrides();      // schedules/blueprint may have changed underneath us
  wiPopulateGroupSelect();
  wiPopulateTransitionSelect();
  wiRenderModEditor();
  wiRenderChips();
  wiUpdateBadge();
  wiUpdateActionButtons();
  wiScheduleRender();
}

function initWhatIfModule() {
  loadWhatIf();
  wiUpdateBadge();

  document.querySelectorAll('.wi-day-btn').forEach(btn => btn.addEventListener('click', () => {
    const day = btn.dataset.wiDay === 'B' ? 'B' : 'A';
    if (day === AppState.whatif.day) return;
    AppState.whatif.day = day;
    document.querySelectorAll('.wi-day-btn').forEach(b => b.classList.toggle('active', b === btn));
    saveWhatIf();
    wiPruneOverrides();    // overrides are validated against the new day's baseline
    wiRenderModEditor();
    wiRenderChips();
    wiUpdateBadge();
    wiUpdateActionButtons();
    wiScheduleRender();
  }));
  // Reflect persisted day on the toggle.
  document.querySelectorAll('.wi-day-btn').forEach(b =>
    b.classList.toggle('active', (b.dataset.wiDay === 'B' ? 'B' : 'A') === AppState.whatif.day));

  const groupSel = document.getElementById('wi-group-select');
  if (groupSel) groupSel.addEventListener('change', e => {
    AppState.whatif.selectedGroupId = e.target.value || null;
    wiRenderModEditor();
  });

  const transSel = document.getElementById('wi-transition-select');
  if (transSel) transSel.addEventListener('change', e => {
    const v = parseInt(e.target.value, 10);
    AppState.whatif.transitionFilter = Number.isFinite(v) && v >= 1 ? v : null;
    wiScheduleRender();
  });

  const applyBtn = document.getElementById('wi-apply-btn');
  if (applyBtn) applyBtn.addEventListener('click', wiApplyScenario);
  const resetBtn = document.getElementById('wi-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', wiResetScenario);

  const mapCanvas = document.getElementById('wi-diff-canvas');
  if (mapCanvas) {
    mapCanvas.addEventListener('mousemove', wiOnMapMove);
    mapCanvas.addEventListener('mouseleave', wiOnMapLeave);
  }

  // Re-fit the diff map when the window resizes while the tab is active.
  let _wiResizeTimer = null;
  window.addEventListener('resize', () => {
    if (AppState.ui.activeTab !== 'whatif') return;
    if (_wiResizeTimer) clearTimeout(_wiResizeTimer);
    _wiResizeTimer = setTimeout(() => {
      _wiResizeTimer = null;
      if (AppState.whatif.lastDiff) wiRenderDiffMap(AppState.whatif.lastDiff);
    }, 120);
  });
}


export {
  initRoomSearch, openRoomSearch, closeRoomSearch, renderRoomSearchDropdown, jumpToRoomSearchResult, WHATIF_KEY,
  saveWhatIf, loadWhatIf, serializeWhatIfForProject, applyWhatIfFromProject, wiOverrideCount, wiSetOverride,
  wiRemoveOverride, wiResetScenario, wiApplyScenario, wiPruneOverrides, wiAfterOverridesChanged, wiUpdateBadge,
  wiUpdateActionButtons, wiScheduleRender, wiFmtSec, wiPopulateGroupSelect, wiRenderModEditor, wiRenderChips,
  wiPopulateTransitionSelect, wiRenderAll, wiDeltaPill, wiRenderCards, wiRenderDiffMap, wiRenderGroupTable,
  wiRenderHotspots, wiRenderConflicts, wiOnMapMove, wiOnMapLeave, onWhatIfTabActivated, initWhatIfModule
};
