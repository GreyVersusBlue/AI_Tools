// sv-reports.js — the School Layout Visualizer's two printed reports and the
// what-if lab's comparison loader (Path 11 P5 increment 4; BACKLOG.md
// "Path 11", the P5 bullet).
//
// The checks report is one sheet from the Schedules tab: the school, the
// date, the count, every finding by severity with the accepted ones last, and
// the teacher day grid, one per day, which is the page a counsellor takes to
// the meeting. The congestion report is one sheet from the lab: the ten
// busiest hallway cells for the day and transition shown, the groups that
// cross each, the scenario's change at each, the three busiest transitions
// and the scenario's changes. "Compare with a project file…" reads a second
// full-project file, refuses one that describes another building, and loads
// its differences into the lab as a scenario, so the lab is the comparison.
//
// The numbers are sv-check.js's checksReport() and sv-congestion.js's
// congestionReport() and compareProject(); this file lays them out on the
// shared #sf-print-sheet (sv-access.js's asking() and printSheet()) and opens
// them in PrintKit.preview, as the safety sheets do. Every value the school
// typed reaches the page through textContent, never as markup.
//
// Its browser check is test/smoke-checks.mjs (npm run test:schedule-check-smoke);
// the content's is test/reports.test.mjs (npm run test:schedule-reports).

/* global AppState, roomRegistry, TOOL_VERSION, showToast, getAllModLabels, formatTransitionWindow, floorLabelById -- 035's classic-script state, BRIDGE wrappers and sv-editor.js (PrintKit is a SITE_GLOBAL) */
/* global wiComputeDiff, wiAfterOverridesChanged, wiOverrideCount, cellCongestionLabel, congestionDisplayText -- sv-congestion.js's BRIDGE wrappers, sv-whatif.js and sv-viz.js */

import { el, asking, printSheet } from './sv-access.js';

function sheetDate() {
  return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function footer(doc, opts, what) {
  return el(doc, 'p', 'sf-foot', [what, opts.date, opts.version ? `School Layout Visualizer ${opts.version}` : '']
    .filter(Boolean).join(' · '));
}

function header(doc, sheet, title, opts) {
  sheet.appendChild(el(doc, 'h1', 'sf-title', title));
  if (opts.school) sheet.appendChild(el(doc, 'p', 'sf-sub', opts.school));
}

function countWords(c) {
  const part = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  if (!c.error && !c.warn && !c.note) return 'No problems, warnings or notes.';
  return [part(c.error, 'problem', 'problems'), part(c.warn, 'warning', 'warnings'), part(c.note, 'note', 'notes')].join(', ') + '.';
}

const MARK = { error: '✕ ', warn: '! ' };

/* ── The checks report ───────────────────────────────────────────────── */

/**
 * Fills `sheet` (emptied first) from checksReport(). opts: { school, date,
 * version, kindLabel(kind) }.
 */
export function renderChecksReport(sheet, report, opts = {}) {
  const doc = sheet.ownerDocument;
  const kindLabel = opts.kindLabel || (k => k);
  const twoDays = report.days.length > 1;
  sheet.textContent = '';
  header(doc, sheet, 'Schedule checks', opts);
  sheet.appendChild(el(doc, 'p', 'sf-summary', countWords(report.counts)));
  for (const sec of report.sections) {
    if (!sec.items.length) continue;
    sheet.appendChild(el(doc, 'h2', 'sf-h2', `${sec.title} (${sec.items.length})`));
    const t = el(doc, 'table', 'sf-table cr-findings');
    t.dataset.severity = sec.severity;
    const heads = ['What', ...(twoDays ? ['Day'] : []), 'Finding', ...(sec.severity === 'ack' ? ['Why it is fine'] : [])];
    const thead = t.createTHead().insertRow();
    for (const h of heads) thead.appendChild(el(doc, 'th', null, h));
    const body = t.createTBody();
    for (const it of sec.items) {
      const tr = body.insertRow();
      tr.appendChild(el(doc, 'td', null, kindLabel(it.kind)));
      if (twoDays) tr.appendChild(el(doc, 'td', null, it.day ? it.day + ' day' : 'Both'));
      tr.appendChild(el(doc, 'td', null, it.text));
      if (sec.severity === 'ack') tr.appendChild(el(doc, 'td', null, it.note || ''));
    }
    sheet.appendChild(t);
  }
  if (report.dropped) {
    sheet.appendChild(el(doc, 'p', 'sf-note', `${report.dropped} ${report.dropped === 1 ? 'entry was' : 'entries were'} not checked (the Schedules tab lists why).`));
  }
  for (const grid of report.grids) {
    const box = el(doc, 'section', 'cr-grid');
    box.dataset.day = grid.day;
    box.appendChild(el(doc, 'h2', 'sf-h2', twoDays ? `Teachers' day, ${grid.day} day` : "Teachers' day"));
    if (!grid.rows.length) {
      box.appendChild(el(doc, 'p', 'sf-none', 'No room on the blueprint has a teacher named.'));
      sheet.appendChild(box);
      continue;
    }
    const t = el(doc, 'table', 'sf-table cr-grid-table');
    const thead = t.createTHead().insertRow();
    thead.appendChild(el(doc, 'th', null, 'Teacher'));
    for (const l of report.labels) thead.appendChild(el(doc, 'th', null, l));
    const body = t.createTBody();
    for (const row of grid.rows) {
      const tr = body.insertRow();
      tr.appendChild(el(doc, 'th', null, row.teacher));
      for (const c of row.cells) {
        const td = el(doc, 'td', (c.planning ? 'cr-plan' : '') + (c.severity ? ' cr-' + c.severity : ''), (MARK[c.severity] || '') + c.text);
        tr.appendChild(td);
      }
    }
    box.appendChild(t);
    box.appendChild(el(doc, 'p', 'sf-note cr-key', '— is planning. ✕ marks a cell with a problem, ! one with a warning.'));
    sheet.appendChild(box);
  }
  sheet.appendChild(footer(doc, opts, 'Schedule checks'));
}

/** Builds the checks report from the live schedule into #sf-print-sheet. */
export function buildChecksReport() {
  const sheet = document.getElementById('sf-print-sheet');
  const V = window.SVChecksView;
  const result = V.runChecks(AppState.schedules.groups, { travel: true });
  const report = window.SVCheck.checksReport(result, { acks: V.checksForProject().acks });
  renderChecksReport(sheet, report, {
    school: AppState.settings.schoolName || '',
    date: sheetDate(),
    version: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : '',
    kindLabel: k => V.KIND_LABEL[k] || k,
  });
  return report;
}

/** The checks banner's "Checks Report" button: build, then preview with a Print button. */
export function openChecksReport(trigger) {
  buildChecksReport();
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Schedule checks',
    onClose: () => asking(false), onPrint: printSheet,
  });
}

/* ── The congestion report ───────────────────────────────────────────── */

/**
 * Fills `sheet` (emptied first) from congestionReport(). opts: { school, date,
 * version, labels, window(t) → '' | text, cellName(cell) → text,
 * load(n) → text, unit }.
 */
export function renderCongestionReport(sheet, data, opts = {}) {
  const doc = sheet.ownerDocument;
  const labels = opts.labels || [];
  const load = opts.load || (n => String(n));
  const unit = opts.unit || '';
  const trans = (t) => {
    const w = opts.window ? opts.window(t) : '';
    return `${labels[t - 1] || 'Mod ' + t} → ${labels[t] || 'Mod ' + (t + 1)}${w ? ' (' + w + ')' : ''}`;
  };
  const scenario = data.changes.length > 0;
  sheet.textContent = '';
  header(doc, sheet, 'Hallway congestion', opts);
  sheet.appendChild(el(doc, 'p', 'sf-summary', `${data.day} day, ${data.tf ? trans(data.tf) : 'every transition'}` +
    (scenario ? `, with the scenario's ${data.changes.length} ${data.changes.length === 1 ? 'change' : 'changes'}.` : ', the live schedule.')));
  if (!data.cells.length) {
    sheet.appendChild(el(doc, 'p', 'sf-none', 'No group walks a hallway in this window, so there is nothing to rank.'));
    sheet.appendChild(footer(doc, opts, 'Hallway congestion'));
    return;
  }
  sheet.appendChild(el(doc, 'h2', 'sf-h2', `The ${data.cells.length} busiest places`));
  const t = el(doc, 'table', 'sf-table cr-cells');
  const thead = t.createTHead().insertRow();
  for (const h of ['', 'Where', 'Load' + (unit ? ` (${unit})` : ''), ...(scenario ? ['Scenario change'] : []), 'Groups that pass']) {
    thead.appendChild(el(doc, 'th', null, h));
  }
  const body = t.createTBody();
  data.cells.forEach((c, i) => {
    const tr = body.insertRow();
    tr.appendChild(el(doc, 'td', null, String(i + 1)));
    tr.appendChild(el(doc, 'td', null, opts.cellName ? opts.cellName(c) : c.key));
    tr.appendChild(el(doc, 'td', null, load(c.load)));
    if (scenario) tr.appendChild(el(doc, 'td', null, c.delta ? (c.delta > 0 ? '+' : '−') + load(Math.abs(c.delta)) : 'no change'));
    tr.appendChild(el(doc, 'td', null, c.groups.join(', ')));
  });
  sheet.appendChild(t);
  if (data.transitions.length) {
    sheet.appendChild(el(doc, 'h2', 'sf-h2', 'The busiest transitions'));
    const ol = el(doc, 'ol', 'cr-trans');
    for (const tr of data.transitions) {
      ol.appendChild(el(doc, 'li', null, `${trans(tr.t)}: ${load(tr.total)} in total along the way, ${load(tr.peak)} at the busiest place.`));
    }
    sheet.appendChild(ol);
  }
  if (scenario) {
    sheet.appendChild(el(doc, 'h2', 'sf-h2', "The scenario's changes"));
    const ul = el(doc, 'ul', 'cr-changes');
    for (const ch of data.changes) {
      ul.appendChild(el(doc, 'li', null, `${ch.group}, ${labels[ch.modIdx] || 'Mod ' + (ch.modIdx + 1)}: ${ch.from || 'nothing'} → ${ch.to || 'nothing'}`));
    }
    sheet.appendChild(ul);
  }
  sheet.appendChild(footer(doc, opts, 'Hallway congestion'));
}

/** Builds the congestion report for the lab's day and transition filter into #sf-print-sheet. */
export function buildCongestionReport() {
  const sheet = document.getElementById('sf-print-sheet');
  const diff = wiComputeDiff();
  const overrides = AppState.whatif.overrides || {};
  const hasChanges = Object.keys(overrides).length > 0;
  const data = window.SVCongestion.congestionReport(diff.base, {
    tf: AppState.whatif.transitionFilter || null,
    diff: hasChanges ? diff : null,
    overrides,
    floor0Id: AppState.blueprint.floors[0] && AppState.blueprint.floors[0].id,
  });
  const meta = { weighted: diff.base.weighted, defaultGroupSize: diff.base.defaultGroupSize };
  renderCongestionReport(sheet, data, {
    school: AppState.settings.schoolName || '',
    date: sheetDate(),
    version: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : '',
    labels: getAllModLabels(),
    window: t => formatTransitionWindow(data.day, t),
    load: n => congestionDisplayText(meta, n),
    unit: meta.weighted ? 'students' : 'groups',
    cellName: c => {
      const lbl = cellCongestionLabel(c.x, c.y, c.floorId);
      return [lbl.label || 'Hallway', lbl.sub, floorLabelById(c.floorId)].filter(Boolean).join(', ');
    },
  });
  return data;
}

/** The lab's "Congestion Report" button. */
export function openCongestionReport(trigger) {
  if (!AppState.schedules.groups.length || !roomRegistry.length) {
    if (typeof showToast === 'function') showToast('The congestion report needs a blueprint with rooms and a schedule with groups.', 'info');
    return null;
  }
  buildCongestionReport();
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Hallway congestion',
    onClose: () => asking(false), onPrint: printSheet,
  });
}

/* ── Comparing with another project file ─────────────────────────────── */

/** The note under the lab's actions saying what a comparison loaded, or nothing. */
export function renderCompareNote(res, fileName) {
  const host = document.getElementById('wi-compare-note');
  if (!host) return;
  host.replaceChildren();
  if (!res) { host.hidden = true; return; }
  host.hidden = false;
  const doc = document;
  if (!res.ok) {
    host.appendChild(el(doc, 'p', 'wi-compare-head', `${fileName} describes a different building: ` +
      `${res.onlyHere.length + res.onlyThere.length} ${res.onlyHere.length + res.onlyThere.length === 1 ? 'room differs' : 'rooms differ'}. Comparison needs one building.`));
    if (res.onlyHere.length) host.appendChild(el(doc, 'p', null, 'Only in this blueprint: ' + res.onlyHere.join(', ')));
    if (res.onlyThere.length) host.appendChild(el(doc, 'p', null, 'Only in the file: ' + res.onlyThere.join(', ')));
    host.appendChild(el(doc, 'p', null, 'The scenario was not changed.'));
    return;
  }
  host.appendChild(el(doc, 'p', 'wi-compare-head', `Compared with ${fileName}, ${res.day} day: ` +
    `${res.changed} ${res.changed === 1 ? 'slot differs' : 'slots differ'} in ${Object.keys(res.overrides).length} of ${res.matched} ${res.matched === 1 ? 'group' : 'groups'} with the same name. ` +
    'They are the scenario now; Apply would make them the live schedule.'));
  if (res.added.length) {
    host.appendChild(el(doc, 'p', null, 'Only in the file, not in the scenario: ' +
      res.added.map(g => `${g.name} (${g.mods.map(m => m || '—').join(', ')})`).join('; ')));
  }
  if (res.removed.length) host.appendChild(el(doc, 'p', null, 'Only in this schedule, still walking in the scenario: ' + res.removed.join(', ')));
  if (res.ambiguous.length) host.appendChild(el(doc, 'p', null, 'Not compared, because two groups share the name: ' + res.ambiguous.join(', ')));
  if (res.modCountThere && res.modCountThere !== AppState.settings.modCount) {
    host.appendChild(el(doc, 'p', null, `The file has ${res.modCountThere} mods a day and this schedule ${AppState.settings.modCount}; only this schedule's are compared.`));
  }
  host.appendChild(el(doc, 'p', null, `The other day is compared by switching the lab to it and loading the file again. Bell times are this schedule's.`));
}

/** Reads a parsed project file into the lab. Returns compareProject()'s result, or null when cancelled. */
export function loadComparison(data, fileName) {
  const res = window.SVCongestion.compareProject(
    { groups: AppState.schedules.groups, registry: roomRegistry }, data,
    { day: AppState.whatif.day, modCount: AppState.settings.modCount });
  if (res.ok) {
    const n = wiOverrideCount();
    if (n && !window.confirm(`Comparing replaces the scenario's ${n} change${n === 1 ? '' : 's'}. The live schedule is unaffected either way.`)) return null;
    AppState.whatif.overrides = res.overrides;
    wiAfterOverridesChanged();
  }
  renderCompareNote(res, fileName);
  return res;
}

{
  const input = document.getElementById('wi-compare-file');
  document.getElementById('wi-compare-btn')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (evt) => {
      let data;
      try { data = JSON.parse(evt.target.result); } catch (err) { showToast('Comparison failed: the file is not valid JSON.', 'error'); return; }
      try { loadComparison(data, file.name); } catch (err) { showToast(`Comparison failed: ${err.message}`, 'error'); }
    };
    reader.onerror = () => showToast('Comparison failed: could not read the file.', 'error');
    reader.readAsText(file);
  });
  // A reset scenario is no longer the comparison (after the lab's own handler has run).
  document.getElementById('wi-reset-btn')?.addEventListener('click', () => setTimeout(() => { if (!wiOverrideCount()) renderCompareNote(null); }, 0));
  document.getElementById('btn-print-checks')?.addEventListener('click', e => openChecksReport(e.currentTarget));
  document.getElementById('wi-congestion-report-btn')?.addEventListener('click', e => openCongestionReport(e.currentTarget));
}
