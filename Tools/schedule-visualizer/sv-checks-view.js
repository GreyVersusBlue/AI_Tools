// sv-checks-view.js — the School Layout Visualizer's schedule checks on the
// page: the Schedules tab's checks banner (which replaced the R39 conflict
// banner), the group cards' marks, the bulk editor's cells, the room panel's
// "This room" list, the what-if lab's Constraint Checks panel and the line the
// Publish button shows before it publishes a schedule with a known problem.
//
// Path 11 P5 increment 1 (BACKLOG.md, "Path 11", the P5 bullet). The checks
// themselves are sv-check.js; this file only shows them and keeps the one
// stored thing, the accepted findings, in `stviz_checks` ({ v: 1, acks }).
// Every sentence reaches the page through textContent: a room or group name is
// whatever the school typed. Like sv-viz.js this is a view that reads the page
// at call time through the globals below; the page's module script copies its
// exports onto window.

/* global AppState, roomRegistry -- 035's classic-script state */
/* global getAllModLabels, wiComputeMetrics, resolveRoomPath, wiEffectiveMods, brPublish -- 035's BRIDGE wrappers and page helpers */

export const CHECKS_KEY = 'stviz_checks';

function svCheck() {
  if (!window.SVCheck) throw new Error('SVCheck is not loaded');
  return window.SVCheck;
}

function localDate(d) {
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

/* ── The ack store ─────────────────────────────────────────────────── */

let store = null;
export function loadChecks() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(CHECKS_KEY) || 'null'); } catch (e) { raw = null; }
  store = svCheck().readChecksStore(raw);
  return store;
}
function acks() { return (store || loadChecks()).acks; }
function saveChecks() {
  const all = runChecks(AppState.schedules.groups, { travel: true }).findings;
  store.acks = svCheck().pruneAcks(store.acks, all, localDate(new Date()));
  try {
    if (Object.keys(store.acks).length) localStorage.setItem(CHECKS_KEY, JSON.stringify(store));
    else localStorage.removeItem(CHECKS_KEY);
  } catch (e) { /* storage full: the acks stay for this visit */ }
}
export function acceptFinding(id, note) {
  acks()[id] = { note: String(note || '').trim().slice(0, 200), on: localDate(new Date()) };
  saveChecks();
  renderConflictBanner();
  if (typeof window.renderGroupList === 'function') window.renderGroupList();
}
export function unacceptFinding(id) {
  delete acks()[id];
  saveChecks();
  renderConflictBanner();
  if (typeof window.renderGroupList === 'function') window.renderGroupList();
}
/** The project file's `checks` field. */
export function checksForProject() { return { v: 1, acks: { ...acks() } }; }
/** A project import replaces the acks with the file's (none when it has none). */
export function applyChecksFromProject(raw) {
  store = svCheck().readChecksStore(raw);
  try {
    if (Object.keys(store.acks).length) localStorage.setItem(CHECKS_KEY, JSON.stringify(store));
    else localStorage.removeItem(CHECKS_KEY);
  } catch (e) { /* as above */ }
}

/* ── Running the checks ─────────────────────────────────────────────── */

function hasBell(day) {
  const arr = window.SVModel.bellDay(AppState.settings, day);
  return Array.isArray(arr) && arr.some(e => e && e.start && e.end);
}
function walkSec(from, to) {
  try {
    const r = resolveRoomPath(from, to);
    if (!r || r.error) return null;
    const walk = AppState.settings.tileWalkTime != null ? AppState.settings.tileWalkTime : 3;
    const stair = AppState.settings.staircaseTime != null ? AppState.settings.staircaseTime : 8;
    return (r.hallwayCells || []).length * walk + (r.usesStaircase ? stair : 0);
  } catch (e) { return null; }
}

/** checkSchedule over these groups, acks applied. `travel: true` adds the two walking checks. */
export function runChecks(groups, opts = {}) {
  const C = svCheck();
  const days = C.daysOf(groups);
  let travel = null;
  if (opts.travel && groups === AppState.schedules.groups) {
    travel = {};
    for (const d of days) {
      if (!hasBell(d)) continue;
      try { travel[d] = wiComputeMetrics(d, null); } catch (e) { /* no blueprint graph yet */ }
    }
  }
  const r = C.checkSchedule(groups, { registry: roomRegistry, settings: AppState.settings, days,
    travel: opts.travelMetrics || travel, walk: opts.travel ? walkSec : null });
  C.applyAcks(r.findings, acks());
  r.summary = C.summary(r.findings);
  return r;
}

function sentenceOf(f, r) { return svCheck().sentence(f, { labels: r.labels }); }

/** The old banner's double-bookings, now the checks' room-double findings. */
export function computeScheduleConflicts(day) {
  const r = runChecks(AppState.schedules.groups);
  return svCheck().conflictsOf(r.findings, day, getAllModLabels());
}

/** Groups with an un-accepted error or warning on a day: Map of id → 'error' | 'warn'. */
export function getConflictGroupIds(day) {
  const out = new Map();
  for (const f of runChecks(AppState.schedules.groups).findings) {
    if (f.ack || f.severity === 'note' || (f.day && f.day !== day)) continue;
    for (const w of f.where) {
      if (out.get(w.groupId) !== 'error') out.set(w.groupId, f.severity);
    }
  }
  return out;
}

/* ── The banner ─────────────────────────────────────────────────────── */

export const KIND_LABEL = {
  'room-double': 'Room booked twice', 'teacher-double': 'Teacher in two rooms', 'over-capacity': 'Over capacity',
  'teacher-no-planning': 'No planning', 'teacher-run': 'Long run', 'teacher-moves': 'Teacher moves',
  'passing-too-short': 'Passing time', 'room-unknown': 'Unknown room', 'group-gap': 'Empty slot',
  'teacher-rooms': 'Teacher on two rooms', 'teacher-idle': 'Teacher with no groups', 'room-idle': 'Unused room',
  'room-no-dept': 'No department', 'room-no-teacher': 'No teacher',
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function countLine(s) {
  const parts = [];
  if (s.error) parts.push(s.error + (s.error === 1 ? ' problem' : ' problems'));
  if (s.warn) parts.push(s.warn + (s.warn === 1 ? ' warning' : ' warnings'));
  return parts.length ? parts.join(', ') : 'No problems or warnings';
}

function showFinding(f) {
  const bulk = document.getElementById('bulk-editor-overlay');
  const bulkOpen = bulk && bulk.classList.contains('open');
  if (bulkOpen) {
    for (const w of f.where) {
      const inp = document.querySelector(`input[data-check-cell="${CSS.escape(w.groupId + '|' + w.day + '|' + w.modIdx)}"]`);
      if (inp) { inp.classList.remove('check-flash'); void inp.offsetWidth; inp.classList.add('check-flash'); inp.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    }
    return;
  }
  const first = f.where[0];
  if (!first) return;
  const card = document.querySelector(`.group-card[data-group-id="${CSS.escape(first.groupId)}"]`);
  if (card) {
    card.scrollIntoView({ block: 'nearest' });
    card.classList.remove('check-flash'); void card.offsetWidth; card.classList.add('check-flash');
  }
}

function row(f, r) {
  const li = el('li', 'chk-row chk-' + f.severity);
  li.dataset.kind = f.kind;
  li.dataset.findingId = f.id;
  li.appendChild(el('span', 'chk-tag', KIND_LABEL[f.kind] || f.kind));
  li.appendChild(el('span', 'chk-text', sentenceOf(f, r)));
  const act = el('span', 'chk-actions');
  if (f.ack) {
    const note = acks()[f.id] && acks()[f.id].note;
    if (note) li.appendChild(el('span', 'chk-note', 'Accepted: ' + note));
    const undo = el('button', 'chk-btn', 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', () => unacceptFinding(f.id));
    act.appendChild(undo);
  } else {
    if (f.where.length) {
      const show = el('button', 'chk-btn', 'Show');
      show.type = 'button';
      show.addEventListener('click', () => showFinding(f));
      act.appendChild(show);
    }
    const accept = el('button', 'chk-btn', 'Accept');
    accept.type = 'button';
    accept.title = 'I know, it is fine: stop counting this one';
    accept.addEventListener('click', () => {
      if (li.querySelector('.chk-accept-form')) return;
      const form = el('span', 'chk-accept-form');
      const lab = el('label', 'chk-accept-label', 'Why it is fine (optional)');
      const inp = el('input', 'chk-accept-input');
      inp.type = 'text'; inp.maxLength = 200;
      inp.id = 'chk-accept-' + Math.random().toString(36).slice(2, 8);
      lab.htmlFor = inp.id;
      const ok = el('button', 'chk-btn', 'Save');
      ok.type = 'button';
      ok.addEventListener('click', () => acceptFinding(f.id, inp.value));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } });
      form.append(lab, inp, ok);
      li.appendChild(form);
      inp.focus();
    });
    act.appendChild(accept);
  }
  li.appendChild(act);
  return li;
}

function fold(title, items, r, cls) {
  const d = el('details', 'chk-fold ' + cls);
  d.appendChild(el('summary', null, title + ' (' + items.length + ')'));
  const ul = el('ul', 'chk-list');
  for (const f of items) ul.appendChild(row(f, r));
  d.appendChild(ul);
  return d;
}

export function renderConflictBanner() {
  const banner  = document.getElementById('sch-conflict-banner');
  const countEl = document.getElementById('sch-conflict-count');
  const label   = document.getElementById('sch-conflict-label');
  const host    = document.getElementById('sch-check-list');
  const header  = document.getElementById('sch-conflict-banner-header');
  const wrap    = document.getElementById('sch-conflict-table-wrap');
  if (!banner || !countEl || !host) return;
  if (!AppState.schedules.groups.length) { banner.style.display = 'none'; return; }

  const day = AppState.schedules.activeDayTab || 'A';
  const r = runChecks(AppState.schedules.groups, { travel: true });
  const today = r.findings.filter(f => !f.day || f.day === day);
  const s = svCheck().summary(today);
  banner.style.display = '';
  banner.classList.toggle('chk-has-error', s.error > 0);
  banner.classList.toggle('chk-clean', !s.error && !s.warn);
  countEl.textContent = String(s.error + s.warn);
  if (label) label.textContent = countLine(s) + (r.days.length > 1 ? ' on ' + day + ' days' : '');

  host.replaceChildren();
  const open = today.filter(f => !f.ack && f.severity !== 'note');
  const notes = today.filter(f => !f.ack && f.severity === 'note');
  const accepted = today.filter(f => f.ack);
  const ul = el('ul', 'chk-list');
  for (const f of open) ul.appendChild(row(f, r));
  if (open.length) host.appendChild(ul);
  if (notes.length) host.appendChild(fold('Notes', notes, r, 'chk-notes'));
  if (accepted.length) host.appendChild(fold('Accepted', accepted, r, 'chk-accepted'));
  if (r.dropped.length) {
    host.appendChild(el('p', 'chk-dropped', r.dropped.length + (r.dropped.length === 1 ? ' entry was' : ' entries were') +
      ' not checked: ' + r.dropped.map(d => d.reason).slice(0, 3).join('; ') + (r.dropped.length > 3 ? '; …' : '') + '.'));
  }
  if (!host.childNodes.length) host.appendChild(el('p', 'chk-dropped', 'Nothing to report.'));

  if (header && !header.dataset.conflictWired) {
    header.dataset.conflictWired = '1';
    const toggle = () => {
      const isOpen = wrap.classList.toggle('open');
      header.classList.toggle('open', isOpen);
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  }
}

/** Open the banner's list (the publish warning's Review). */
export function openChecksBanner() {
  const wrap = document.getElementById('sch-conflict-table-wrap');
  const header = document.getElementById('sch-conflict-banner-header');
  if (typeof window.switchTab === 'function') window.switchTab('schedules');
  renderConflictBanner();
  if (wrap && !wrap.classList.contains('open')) { wrap.classList.add('open'); header && header.classList.add('open'); }
  document.getElementById('sch-conflict-banner')?.scrollIntoView({ block: 'nearest' });
}

/* ── The bulk editor's cells ─────────────────────────────────────────── */

/** Mark every mod input of the bulk editor that a finding is about (no travel: every keystroke). */
export function markBulkCells(groups, root) {
  if (!root) return;
  const r = runChecks(groups);
  const worst = new Map();
  for (const f of r.findings) {
    if (f.ack || f.severity === 'note') continue;
    for (const w of f.where) {
      const k = w.groupId + '|' + w.day + '|' + w.modIdx;
      const cur = worst.get(k);
      if (!cur || (cur.severity === 'warn' && f.severity === 'error')) worst.set(k, { severity: f.severity, text: [] });
      worst.get(k).text.push(sentenceOf(f, r));
    }
  }
  for (const inp of root.querySelectorAll('input[data-check-cell]')) {
    const hit = worst.get(inp.dataset.checkCell);
    inp.classList.toggle('chk-cell-error', !!hit && hit.severity === 'error');
    inp.classList.toggle('chk-cell-warn', !!hit && hit.severity === 'warn');
    if (hit) inp.title = hit.text.join('\n'); else inp.removeAttribute('title');
  }
}

/* ── The room panel ─────────────────────────────────────────────────── */

export function renderRoomChecks(roomNumber) {
  const host = document.getElementById('rp-room-checks');
  if (!host) return;
  host.replaceChildren();
  if (!roomNumber) return;
  const day = AppState.schedules.activeDayTab || 'A';
  const r = runChecks(AppState.schedules.groups);
  const mine = r.findings.filter(f => (!f.day || f.day === day) &&
    (f.room === roomNumber || (f.rooms || []).includes(roomNumber)) && f.severity !== 'note' && !f.ack);
  if (!mine.length) return;
  host.appendChild(el('div', 'rp-section-label', 'This room'));
  for (const f of mine.slice(0, 2)) host.appendChild(el('p', 'chk-room-line chk-' + f.severity, sentenceOf(f, r)));
  if (mine.length > 2) host.appendChild(el('p', 'chk-room-line', 'and ' + (mine.length - 2) + ' more in the Schedules tab.'));
}

/* ── The what-if lab ────────────────────────────────────────────────── */

/** The lab's Constraint Checks panel: the scenario's findings against the live schedule's, by kind. */
export function renderLabChecks(diff) {
  const host = document.getElementById('wi-conflicts');
  if (!host) return;
  const C = svCheck();
  const day = AppState.whatif.day;
  const live = AppState.schedules.groups;
  const scen = live.map(g => {
    const mods = wiEffectiveMods(g, day, AppState.whatif.overrides);
    return day === 'B' ? { ...g, modsB: mods } : { ...g, modsA: mods, mods };
  });
  const before = runChecks(live, { travelMetrics: { [day]: diff.base } }).findings.filter(f => !f.day || f.day === day);
  const after = runChecks(scen, { travelMetrics: { [day]: diff.scen } }).findings.filter(f => !f.day || f.day === day);
  const bIds = new Set(before.map(f => f.id)), aIds = new Set(after.map(f => f.id));
  const isNew = after.filter(f => !bIds.has(f.id) && f.severity !== 'note');
  const gone = before.filter(f => !aIds.has(f.id) && f.severity !== 'note');
  const same = after.filter(f => bIds.has(f.id));
  const r = { labels: getAllModLabels() };
  host.replaceChildren();
  const line = (tag, cls, f) => {
    const d = el('div', 'wi-hot-item');
    const s = el('span');
    s.appendChild(el('span', 'wi-conflict-tag ' + cls, tag));
    s.appendChild(document.createTextNode(C.sentence(f, r)));
    d.appendChild(s);
    return d;
  };
  for (const f of isNew) host.appendChild(line('New', 'new', f));
  for (const f of gone) host.appendChild(line('Resolved', 'resolved', f));
  const cnt = (sev) => same.filter(f => f.severity === sev).length;
  const parts = [];
  if (cnt('error')) parts.push(cnt('error') + (cnt('error') === 1 ? ' problem' : ' problems'));
  if (cnt('warn')) parts.push(cnt('warn') + (cnt('warn') === 1 ? ' warning' : ' warnings'));
  if (cnt('note')) parts.push(cnt('note') + (cnt('note') === 1 ? ' note' : ' notes'));
  if (parts.length) {
    const d = el('div', 'wi-hot-item');
    const s = el('span');
    s.appendChild(el('span', 'wi-conflict-tag existing', 'Unchanged'));
    s.appendChild(document.createTextNode(parts.join(', ') + ' this scenario does not change'));
    d.appendChild(s);
    host.appendChild(d);
  }
  const rb = diff.base.routingErrors + diff.base.unassigned;
  const rs = diff.scen.routingErrors + diff.scen.unassigned;
  if (rb !== rs) {
    const d = el('div', 'wi-hot-item');
    const s = el('span');
    s.appendChild(el('span', 'wi-conflict-tag ' + (rs > rb ? 'new' : 'resolved'), rs > rb ? 'Warning' : 'Improved'));
    s.appendChild(document.createTextNode('Routing issues (no path / unassigned mods): ' + rb + ' → ' + rs));
    d.appendChild(s);
    host.appendChild(d);
  }
  if (!host.childNodes.length) host.appendChild(el('div', 'wi-empty-note', 'This scenario adds no problem and no warning. ✓'));
}

/* ── Publish ────────────────────────────────────────────────────────── */

/** The sentence the Publish button shows when the schedule has problems, or ''. */
export function publishWarning() {
  const r = runChecks(AppState.schedules.groups);
  const open = r.findings.filter(f => !f.ack && f.severity === 'error');
  if (!open.length) return '';
  const rooms = open.some(f => f.kind === 'room-double');
  const teachers = r.findings.some(f => f.kind === 'teacher-rooms') || open.some(f => f.kind === 'teacher-double');
  const hide = [];
  if (rooms) hide.push('a room with two groups shows one of them');
  if (teachers) hide.push('a teacher on two rooms shows one room');
  return 'This schedule has ' + open.length + (open.length === 1 ? ' problem' : ' problems') +
    (hide.length ? ' the published browser will hide: ' + hide.join(', ') : '') + '.';
}

/** The Publish button: warns and goes on (Devon, P11-18), or opens the list. */
export function publishChecked() {
  const warn = publishWarning();
  if (warn && !window.confirm(warn + '\n\nOK publishes anyway. Cancel opens the list of problems.')) {
    openChecksBanner();
    return;
  }
  brPublish();
}
