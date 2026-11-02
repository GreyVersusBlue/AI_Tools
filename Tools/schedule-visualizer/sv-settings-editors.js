// sv-settings-editors.js — the School Layout Visualizer's Settings tab editors for
// the bell schedule (A/B day times, with "From the School Calendar") and the
// subject list. Moved out of the page's classic script as a view module,
// the way sv-access.js and sv-schedules-tab.js are: it reads the page at call
// time through the globals below, owns only the bell editor's two bits of
// state, and the page's module script copies its exports onto window (the
// page's populateSettingsForm() and init() call the two renderers by bare name).
//
// The wiring (listeners on the editors' controls) runs when this module is
// evaluated, which is after the page is parsed and before DOMContentLoaded:
// the same moment as the page's own init(), later than the parse-time wiring
// it replaces, and nothing reads these controls before then.
//
// Its browser checks are test/smoke-bell-from-calendar.mjs and
// test/smoke-settings-editors.mjs.

/* global AppState, getAllModLabels, getSubjects, saveSettings, showToast, populateDeptDropdown, brSyncDeptFromSettings, escHtml -- 035's classic-script state, BRIDGE wrappers and page helpers */

/* ==============================================================
   ROUND 59 — BELL SCHEDULE EDITOR (Settings)
   ──────────────────────────────────────────────────────────────
   Lives directly beneath the mod-count control. Renders one
   start/end time row per mod for the active day tab; the B tab
   offers a "Same as A Day" checkbox that nulls B. Edits mutate
   AppState.settings.bellSchedule live (persisted by Save
   Settings, same contract as modCount). Validation is inline
   and non-blocking: end ≤ start flags red, overlaps flag amber.
=============================================================== */
let _bellActiveDay = 'A';
let _bellCalPick = null;   // Path 9 P1: the School Calendar schedules last chosen, below

/** Materialize the stored day array (may be null / short) to modCount rows. */
function _bellDayRows(day) {
  const bs  = AppState.settings.bellSchedule || { A: null, B: null };
  const src = (day === 'B') ? bs.B : bs.A;
  const n   = AppState.settings.modCount || 8;
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = Array.isArray(src) ? src[i] : null;
    out.push(e && (e.start || e.end) ? { start: e.start || null, end: e.end || null } : null);
  }
  return out;
}

/** Write one field back into settings, creating the day array on demand. */
function _bellWrite(day, idx, field, value) {
  const bs = AppState.settings.bellSchedule || (AppState.settings.bellSchedule = { A: null, B: null });
  const key = (day === 'B') ? 'B' : 'A';
  if (!Array.isArray(bs[key])) bs[key] = _bellDayRows(key === 'B' ? 'A' : key).map(e => e ? { ...e } : null);
  const n = AppState.settings.modCount || 8;
  while (bs[key].length < n) bs[key].push(null);
  bs[key].length = Math.max(bs[key].length, n);
  const entry = bs[key][idx] || (bs[key][idx] = { start: null, end: null });
  entry[field] = value || null;
  if (!entry.start && !entry.end) bs[key][idx] = null;
}

export function renderBellScheduleEditor() {
  const host = document.getElementById('bell-schedule-table');
  if (!host) return;
  const bs   = AppState.settings.bellSchedule || { A: null, B: null };
  const day  = _bellActiveDay;
  const sameWrap = document.getElementById('bell-same-as-a-wrap');
  const sameChk  = document.getElementById('bell-same-as-a');
  document.querySelectorAll('.bell-day-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.bellDay === day));

  if (sameWrap) sameWrap.style.display = (day === 'B') ? 'flex' : 'none';
  const bIsSame = !Array.isArray(bs.B);
  if (sameChk) sameChk.checked = bIsSame;

  if (day === 'B' && bIsSame) {
    host.innerHTML = `<div style="font-size:11.5px;color:var(--slate-400);padding:6px 0;">B Day uses the A Day times.</div>`;
    _bellValidate();
    renderBellFromCalendar();
    return;
  }

  const labels = getAllModLabels();
  const rows   = _bellDayRows(day);
  host.innerHTML = `<table class="bell-table"><tbody>${rows.map((e, i) => `
    <tr data-bell-idx="${i}">
      <td class="bell-mod-label">${escHtml(labels[i] || ('Mod ' + (i + 1)))}</td>
      <td><input type="time" class="bell-time-input" data-field="start" value="${e && e.start ? escHtml(e.start) : ''}"/></td>
      <td style="color:var(--slate-300);">–</td>
      <td><input type="time" class="bell-time-input" data-field="end" value="${e && e.end ? escHtml(e.end) : ''}"/></td>
      <td class="bell-row-warn" data-bell-warn></td>
    </tr>`).join('')}</tbody></table>`;

  host.querySelectorAll('.bell-time-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const tr  = inp.closest('tr');
      const idx = parseInt(tr.dataset.bellIdx, 10);
      _bellWrite(day, idx, inp.dataset.field, inp.value);
      _bellValidate();
    });
  });
  _bellValidate();
  renderBellFromCalendar();
}

/** Inline, non-blocking validation: end > start per row (red), and warn on
    overlaps between consecutive mods (amber). */
function _bellValidate() {
  const host = document.getElementById('bell-schedule-table');
  const warnEl = document.getElementById('bell-schedule-warn');
  if (!host) return;
  const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const rows = _bellDayRows(_bellActiveDay);
  const problems = [];
  host.querySelectorAll('tr[data-bell-idx]').forEach(tr => {
    const idx = parseInt(tr.dataset.bellIdx, 10);
    const e = rows[idx];
    const warn = tr.querySelector('[data-bell-warn]');
    const inputs = tr.querySelectorAll('.bell-time-input');
    inputs.forEach(i => i.classList.remove('bell-invalid', 'bell-overlap'));
    if (warn) { warn.textContent = ''; warn.classList.remove('overlap'); }
    if (!e) return;
    const s = toMin(e.start), en = toMin(e.end);
    if (s != null && en != null && en <= s) {
      inputs.forEach(i => i.classList.add('bell-invalid'));
      if (warn) warn.textContent = 'end ≤ start';
      problems.push('invalid');
      return;
    }
    const prev = idx > 0 ? rows[idx - 1] : null;
    const prevEnd = prev ? toMin(prev.end) : null;
    if (prevEnd != null && s != null && s < prevEnd) {
      inputs.forEach(i => i.classList.add('bell-overlap'));
      if (warn) { warn.textContent = 'overlaps prior'; warn.classList.add('overlap'); }
      problems.push('overlap');
    }
  });
  if (warnEl) {
    const hasOverlap = problems.includes('overlap');
    warnEl.style.display = hasOverlap ? '' : 'none';
    warnEl.textContent = hasOverlap ? '⚠ Some periods overlap — allowed, but transition windows may look odd.' : '';
  }
}

function initBellScheduleEditor() {
  document.querySelectorAll('.bell-day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _bellActiveDay = tab.dataset.bellDay === 'B' ? 'B' : 'A';
      renderBellScheduleEditor();
    });
  });
  document.getElementById('bell-same-as-a')?.addEventListener('change', (e) => {
    const bs = AppState.settings.bellSchedule || (AppState.settings.bellSchedule = { A: null, B: null });
    if (e.target.checked) {
      bs.B = null;                                             // null = same as A
    } else {
      bs.B = _bellDayRows('A').map(en => en ? { ...en } : null); // fork a copy of A
    }
    renderBellScheduleEditor();
  });
}
initBellScheduleEditor();

/* Path 9 P1 (rank 12): "From the School Calendar". 032 owns the school's bell
   schedules (Devon, 2026-10-21); SchoolDay.forScheduleVisualizer() turns the
   chosen ones into this page's A/B rows, by position, cut or padded to the mod
   count. The rows go into AppState.settings.bellSchedule like a typed edit, so
   Save Settings keeps them and nothing is written here. 032's blob is never
   written by this page. */
function renderBellFromCalendar() {
  const status = document.getElementById('bell-cal-status');
  const controls = document.getElementById('bell-cal-controls');
  if (!status || !controls) return;
  const SD = window.SchoolDay;
  const cal = SD ? SD.read(localStorage) : null;
  const res = SD ? SD.forScheduleVisualizer(cal, AppState.settings.modCount, _bellCalPick) : { state: 'nocalendar' };
  controls.hidden = res.state !== 'ok';
  status.textContent = {
    nocalendar: 'No School Calendar is saved in this browser. Bell schedules made on the School Calendar Visualizer\u2019s Bell Schedules card can be brought in here.',
    none: 'The School Calendar has no bell schedules yet. Add them on its Bell Schedules card to bring them in here.',
    broken: 'The School Calendar\u2019s bell schedules could not be read.',
    newer: 'The School Calendar\u2019s bell schedules were saved by a newer version of this site. Reload this page to bring them in.',
    ok: 'Copy the school\u2019s times from the School Calendar Visualizer into the A and B rows above.',
  }[res.state] || '';
  if (res.state !== 'ok') return;
  const fill = (sel, value, sameOption) => {
    sel.textContent = '';
    if (sameOption) sel.appendChild(new Option('Same as A Day', ''));
    res.choices.forEach(c => sel.appendChild(new Option(`${c.name} (${c.periods} ${c.periods === 1 ? 'period' : 'periods'})`, c.id)));
    sel.value = value || '';
  };
  fill(document.getElementById('bell-cal-a'), res.pick.A, false);
  fill(document.getElementById('bell-cal-b'), res.pick.B, true);
}

function _bellHasTimes() {
  const bs = AppState.settings.bellSchedule || {};
  return ['A', 'B'].some(k => Array.isArray(bs[k]) && bs[k].some(e => e && (e.start || e.end)));
}

document.getElementById('bell-cal-a')?.addEventListener('change', e => {
  _bellCalPick = { A: e.target.value, B: document.getElementById('bell-cal-b').value || null };
});
document.getElementById('bell-cal-b')?.addEventListener('change', e => {
  _bellCalPick = { A: document.getElementById('bell-cal-a').value, B: e.target.value || null };
});
document.getElementById('bell-cal-use')?.addEventListener('click', () => {
  const SD = window.SchoolDay;
  const result = document.getElementById('bell-cal-result');
  const pick = { A: document.getElementById('bell-cal-a').value, B: document.getElementById('bell-cal-b').value || null };
  const res = SD ? SD.forScheduleVisualizer(SD.read(localStorage), AppState.settings.modCount, pick) : null;
  if (!res || res.state !== 'ok') { renderBellFromCalendar(); return; }
  if (_bellHasTimes() && !confirm('Replace the A Day and B Day times above with the School Calendar\u2019s?')) return;
  _bellCalPick = res.pick;
  AppState.settings.bellSchedule = { A: res.bellSchedule.A, B: res.bellSchedule.B };
  _bellActiveDay = 'A';
  renderBellScheduleEditor();
  const name = id => (res.choices.find(c => c.id === id) || {}).name || '';
  let msg = `A Day now has the times of \u201c${name(res.pick.A)}\u201d`
    + (res.pick.B ? `, B Day those of \u201c${name(res.pick.B)}\u201d.` : ', and B Day is the same as A Day.')
    + ' Press Save Settings to keep them.';
  const extra = Math.max(res.extra.A, res.extra.B);
  if (extra) msg += ` ${extra} ${extra === 1 ? 'period' : 'periods'} past ${AppState.settings.modCount} were left out: raise the number above and use them again to bring ${extra === 1 ? 'it' : 'them'} in.`;
  result.textContent = msg;
});

/* ==============================================================
   ROUND 59 — SUBJECTS EDITOR (Settings)
   ──────────────────────────────────────────────────────────────
   Add / rename / recolor / reorder / delete the subject list in
   settings.subjects. Codes are fixed after creation (they are
   the identity classroom tiles reference). Deleting a subject a
   classroom still uses shows a protection warning first.
=============================================================== */
function _subjectCodeUsage(code) {
  let n = 0;
  for (const floor of AppState.blueprint.floors || []) {
    if (!floor.gridData) continue;
    const seenGroups = new Set();
    for (let r = 0; r < floor.gridRows; r++) {
      for (let c = 0; c < floor.gridCols; c++) {
        const t = floor.gridData[r] && floor.gridData[r][c];
        if (!t || t.type !== 'classroom' || t.dept !== code) continue;
        if (t.groupId) { if (seenGroups.has(t.groupId)) continue; seenGroups.add(t.groupId); }
        n++;
      }
    }
  }
  return n;
}

export function renderSubjectsEditor() {
  const host = document.getElementById('subjects-list');
  if (!host) return;
  const subjects = getSubjects();
  host.innerHTML = subjects.map((s, i) => {
    const used = _subjectCodeUsage(s.code);
    return `
    <div class="subject-row" draggable="true" data-subject-idx="${i}">
      <span class="subject-grip" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
      </span>
      <span class="subject-code" title="${escHtml(s.code)}">${escHtml(s.code)}</span>
      <input type="text" class="subject-name-input" value="${escHtml(s.name)}" maxlength="40"/>
      ${used > 0 ? `<span class="subject-inuse-badge">${used} room${used === 1 ? '' : 's'}</span>` : ''}
      <span class="subject-color-dot" style="background:${escHtml(s.color)};" title="Change color">
        <input type="color" value="${escHtml(s.color)}"/>
      </span>
      <button class="subject-del-btn" title="Delete subject">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('') || `<div style="font-size:12px;color:var(--slate-400);">No subjects yet — add one below.</div>`;

  // Rename / recolor / delete wiring
  host.querySelectorAll('.subject-row').forEach(row => {
    const idx = parseInt(row.dataset.subjectIdx, 10);
    row.querySelector('.subject-name-input')?.addEventListener('change', (e) => {
      const v = e.target.value.trim();
      if (v) getSubjects()[idx].name = v; else e.target.value = getSubjects()[idx].name;
      _subjectsChanged();
    });
    row.querySelector('.subject-color-dot input[type=color]')?.addEventListener('input', (e) => {
      getSubjects()[idx].color = e.target.value;
      row.querySelector('.subject-color-dot').style.background = e.target.value;
      _subjectsChanged(true);   // color-only: skip full re-render so the picker stays open
    });
    row.querySelector('.subject-del-btn')?.addEventListener('click', () => {
      const s = getSubjects()[idx];
      const used = _subjectCodeUsage(s.code);
      const msg = used > 0
        ? `"${s.name}" (${s.code}) is assigned to ${used} classroom${used === 1 ? '' : 's'}.\n\nDeleting it will leave those rooms with an unknown subject code (they keep working, with a neutral color).\n\nDelete anyway?`
        : `Delete subject "${s.name}" (${s.code})?`;
      if (!confirm(msg)) return;
      getSubjects().splice(idx, 1);
      _subjectsChanged();
    });
    // Drag-to-reorder
    row.addEventListener('dragstart', (e) => {
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!Number.isFinite(from) || from === idx) return;
      const list = getSubjects();
      const [moved] = list.splice(from, 1);
      list.splice(idx, 0, moved);
      _subjectsChanged();
    });
  });
}

/** Propagate subject edits to every consumer, then persist. */
function _subjectsChanged(skipRerender) {
  saveSettings();
  if (!skipRerender) renderSubjectsEditor();
  populateDeptDropdown();                      // classroom editor select
  if (typeof brSyncDeptFromSettings === 'function') brSyncDeptFromSettings();  // Schedule Browser palette
}

function initSubjectsEditor() {
  document.getElementById('btn-add-subject')?.addEventListener('click', () => {
    const codeEl  = document.getElementById('subject-new-code');
    const nameEl  = document.getElementById('subject-new-name');
    const colorEl = document.getElementById('subject-new-color');
    const code = (codeEl?.value || '').trim().toUpperCase();
    if (!code) { showToast('Enter a subject code (e.g. ART).', 'warn'); return; }
    if (getSubjects().some(s => s.code === code)) { showToast(`Subject code "${code}" already exists.`, 'warn'); return; }
    const name = (nameEl?.value || '').trim() || code;
    getSubjects().push({ code, name, color: colorEl?.value || '#64748b' });
    if (codeEl) codeEl.value = '';
    if (nameEl) nameEl.value = '';
    _subjectsChanged();
    showToast(`Subject "${name}" added.`, 'success');
  });
}
initSubjectsEditor();
