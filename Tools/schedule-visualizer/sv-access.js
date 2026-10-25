// sv-access.js — the School Layout Visualizer's step-free report sheet
// (Path 11 P3, BACKLOG.md "Path 11", the P3 bullet).
//
// The report itself is sv-routes.js's pure stepFreeReport(); this file only
// lays it out as a printed sheet and opens it in the shared print kit's
// preview. Like sv-editor.js it is a view: it reads the page at call time
// through the globals listed below, and the page's module script copies its
// exports onto window. Every value a teacher typed (room numbers, group
// names, floor labels, the school's name) reaches the sheet through
// textContent, never as markup.
//
// The sheet is #sf-print-sheet, a direct child of <body>. While it is asked
// for, <body> carries `sf-printing`, which sv.css's print rules read to put
// it on paper alone, and PrintKit.setPage() writes a letter portrait page;
// both are taken away when the preview closes or the printing ends, so the
// Blueprint tab's own Ctrl+P sheet is untouched.
//
// Its browser check is test/smoke-step-free.mjs (npm run test:schedule-visualizer-step-free-ui).

/* global AppState, floorLabelById -- 035's classic-script state and sv-editor.js (PrintKit is a SITE_GLOBAL) */

const STATUS_WORDS = {
  'step-free':   'Step-free',
  'stairs-only': 'Stairs only',
  unreachable:   'Not connected',
  unjudged:      'Not judged',
};
const ACCESS_WORDS = { stairs: 'Stairs', elevator: 'Elevator', ramp: 'Ramp' };

function el(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function table(doc, heads, rows) {
  const t = el(doc, 'table', 'sf-table');
  const thead = t.createTHead().insertRow();
  for (const h of heads) thead.appendChild(el(doc, 'th', null, h));
  const body = t.createTBody();
  for (const r of rows) {
    const tr = body.insertRow();
    for (const c of r) tr.appendChild(el(doc, 'td', null, c));
  }
  return t;
}

/** The sentence at the top of the sheet: what the report found, in words. */
export function stepFreeSummary(report) {
  const c = report.counts;
  const total = c.stepFree + c.stairsOnly + c.unreachable + c.unjudged;
  if (!total) return 'The blueprint has no numbered rooms yet, so there is nothing to report.';
  if (!report.exitCount) {
    return 'No exterior exit is marked on the blueprint, so no room can be judged: mark the doors people come in by ' +
      '(Blueprint tab, select a hallway tile, "Exterior exit") and print this again.';
  }
  const parts = [];
  parts.push(c.stairsOnly === 0
    ? `Every room reached from an exit can be reached without stairs (${c.stepFree} of ${total}).`
    : `${c.stairsOnly} of ${total} room${total === 1 ? '' : 's'} can be reached from an exit only by stairs.`);
  if (c.unreachable) parts.push(`${c.unreachable} room${c.unreachable === 1 ? ' is' : 's are'} not connected to any exit by any route, stairs included (a blueprint problem, or an elevator out of service), listed separately.`);
  return parts.join(' ');
}

/** Fills `sheet` (emptied first) with the report. `opts.floorLabel(id)` names a floor. */
export function renderStepFreeSheet(sheet, report, opts = {}) {
  const doc = sheet.ownerDocument;
  const floorLabel = opts.floorLabel || (id => id);
  sheet.textContent = '';
  sheet.appendChild(el(doc, 'h1', 'sf-title', 'Step-free access report'));
  sheet.appendChild(el(doc, 'p', 'sf-sub', [opts.school, opts.date].filter(Boolean).join(' · ')));
  sheet.appendChild(el(doc, 'p', 'sf-summary', stepFreeSummary(report)));

  const out = report.connectors.filter(c => c.outOfService);
  if (out.length) {
    sheet.appendChild(el(doc, 'p', 'sf-warning',
      'Out of service: ' + out.map(c => `elevator ${c.label}`).join(', ') + '. Routes below are worked out without ' + (out.length === 1 ? 'it' : 'them') + '.'));
  }

  const stairsOnly = report.rooms.filter(r => r.status === 'stairs-only');
  const unreachable = report.rooms.filter(r => r.status === 'unreachable');
  sheet.appendChild(el(doc, 'h2', 'sf-h2', 'Rooms that cannot be reached without stairs'));
  if (!report.exitCount) sheet.appendChild(el(doc, 'p', 'sf-none', 'Not judged: no exterior exit is marked.'));
  else if (!stairsOnly.length) sheet.appendChild(el(doc, 'p', 'sf-none', 'None.'));
  else sheet.appendChild(table(doc, ['Room', 'Floor'], stairsOnly.map(r => [r.room, floorLabel(r.floorId)])));

  if (unreachable.length) {
    sheet.appendChild(el(doc, 'h2', 'sf-h2', 'Rooms not connected to any exit'));
    sheet.appendChild(table(doc, ['Room', 'Floor'], unreachable.map(r => [r.room, floorLabel(r.floorId)])));
  }

  sheet.appendChild(el(doc, 'h2', 'sf-h2', 'Moves in the schedule with no step-free route'));
  if (!report.moves.length) {
    sheet.appendChild(el(doc, 'p', 'sf-none', report.movesChecked
      ? `None of the schedule's ${report.movesChecked} room-to-room moves needs stairs.`
      : 'The schedule has no room-to-room moves to check.'));
  } else {
    sheet.appendChild(el(doc, 'p', 'sf-note', `${report.moves.length} of ${report.movesChecked} moves. A student who cannot use stairs could not make these.`));
    sheet.appendChild(table(doc, ['Group', 'Day', 'From', 'To'], report.moves.map(m =>
      [m.group, m.day, `${m.fromRoom} (${m.fromModLabel})`, `${m.toRoom} (${m.toModLabel})`])));
  }

  sheet.appendChild(el(doc, 'h2', 'sf-h2', 'Every room'));
  if (!report.rooms.length) sheet.appendChild(el(doc, 'p', 'sf-none', 'None.'));
  else sheet.appendChild(table(doc, ['Room', 'Floor', 'Step-free?'], report.rooms.map(r => [r.room, floorLabel(r.floorId), STATUS_WORDS[r.status]])));

  sheet.appendChild(el(doc, 'h2', 'sf-h2', 'Connections between floors'));
  if (!report.connectors.length) sheet.appendChild(el(doc, 'p', 'sf-none', 'None are paired.'));
  else sheet.appendChild(table(doc, ['Pair', 'What it is', 'Joins'], report.connectors.map(c =>
    [c.label, ACCESS_WORDS[c.access] + (c.outOfService ? ' (out of service)' : ''),
     c.floors[0] === c.floors[1] ? floorLabel(c.floors[0]) : `${floorLabel(c.floors[0])} and ${floorLabel(c.floors[1])}`])));

  sheet.appendChild(el(doc, 'p', 'sf-foot',
    'Step-free means a route from the room to a marked exterior exit using hallways, ramps and elevators, never a stair tile. ' +
    'An elevator ride is counted as ' + (opts.wait != null ? opts.wait : 10) + ' cells of walking. Mark a pair as an elevator or ramp on the Blueprint tab (select a paired staircase).'));
}

/* ---- the page glue: build, preview, print ---- */

function asking(on) {
  document.body.classList.toggle('sf-printing', on);
  if (on) PrintKit.setPage({ paper: 'letter', orientation: 'portrait', margin: '0.5in' });
  else { const s = document.getElementById('pk-page-style'); if (s) s.remove(); }
}

/** Builds the report from the page's blueprint and schedule into #sf-print-sheet. */
export function buildStepFreeSheet() {
  const sheet = document.getElementById('sf-print-sheet');
  const report = window.SVRoutes.stepFreeReport({
    blueprint: AppState.blueprint, groups: AppState.schedules.groups, settings: AppState.settings,
  });
  renderStepFreeSheet(sheet, report, {
    floorLabel: floorLabelById,
    school: AppState.settings.schoolName || '',
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    wait: window.SVGraph.ELEVATOR_WAIT,
  });
  return report;
}

function printSheet() {
  asking(true);
  const done = () => { window.removeEventListener('afterprint', done); asking(false); };
  window.addEventListener('afterprint', done);
  window.print();
}

/** The Blueprint sidebar's "Step-free report" button: build, then preview with a Print button. */
export function openStepFreeReport(trigger) {
  buildStepFreeSheet();
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Step-free access report',
    onClose: () => asking(false), onPrint: printSheet,
  });
}

document.getElementById('btn-step-free-report')?.addEventListener('click', e => openStepFreeReport(e.currentTarget));
