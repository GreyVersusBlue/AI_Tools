// sv-safety.js — the School Layout Visualizer's safety printing
// (Path 11 P4, BACKLOG.md "Path 11", the P4 bullet): the evacuation cards,
// one per room on every floor (increment 1); the lockdown maps, one per floor
// (increment 2); and the door-sign sets, per teacher (increment 3).
//
// The cards' content is sv-routes.js's pure evacuationCards(); this file only
// lays it out and opens it in the shared print kit's preview, on the same
// sheet and print state as the step-free report (sv-access.js's asking()).
// The tool states nothing of its own beyond labels: the exit names and
// assembly points are what the school typed on the blueprint, and the one
// piece of procedure a card can need, what someone who cannot use stairs
// does, is the school's own words (Settings → Safety printing) or a blank
// line under that label. Every typed value reaches the sheet through
// textContent, never as markup.
//
// A lockdown map marks no shelter area, corner or lock: it is the plan, the
// room numbers, and the school's notes (the building's in Settings, each
// room's in its panel) or blank lines. A door sign is a timetable, with no
// safety wording at all.
//
// Its browser check is test/smoke-evacuation.mjs (in npm run test:schedule-visualizer);
// the content's are test/evacuation-cards.test.mjs and test/safety-sheets.test.mjs.

/* global AppState, floorLabelById, renderEvacuationMapCrop, renderLockdownMap, showToast, TOOL_VERSION -- 035's classic-script state and sv-editor.js (PrintKit is a SITE_GLOBAL) */

import { el, asking, printSheet } from './sv-access.js';

/** The school's plan for anyone who cannot use stairs or steps, or '' (Settings → Safety printing). */
export function noStepFreePlan(settings) {
  const v = settings && settings.evacNoStepFreePlan;
  return typeof v === 'string' ? v.trim() : '';
}

function writeIn(doc, label, lines) {
  const box = el(doc, 'div', 'ev-writein');
  box.appendChild(el(doc, 'p', 'ev-writein-label', label));
  for (let i = 0; i < lines; i++) box.appendChild(el(doc, 'div', 'ev-line'));
  return box;
}

function assembly(doc, way) {
  const box = el(doc, 'div', 'ev-assembly');
  box.appendChild(el(doc, 'span', 'ev-assembly-label', 'Assembly point: '));
  if (way.assemblyPoint) box.appendChild(el(doc, 'span', 'ev-assembly-text', way.assemblyPoint));
  else {
    box.appendChild(el(doc, 'span', 'ev-assembly-text', 'not entered'));
    box.appendChild(el(doc, 'div', 'ev-line'));
  }
  return box;
}

function wayBlock(doc, heading, way, floorName) {
  const sec = el(doc, 'section', 'ev-way');
  sec.appendChild(el(doc, 'h2', 'ev-h2', `${heading}: ${way.exitLabel || 'the marked exit'}`));
  const ol = el(doc, 'ol', 'ev-steps');
  for (const s of way.steps) ol.appendChild(el(doc, 'li', null, s));
  sec.appendChild(ol);
  if (way.crossesFloor) {
    sec.appendChild(el(doc, 'p', 'ev-note', `This route leaves ${floorName}; the map shows only ${floorName}. ` +
      `It goes by ${way.floors.join(', then ')}.`));
  }
  sec.appendChild(assembly(doc, way));
  return sec;
}

/**
 * Fills `sheet` (emptied first) with one card per room from evacuationCards().
 * opts: { floorLabel(id), school, date, version, plan, mapFor(card) → { src, alt } | null }.
 */
export function renderEvacuationCards(sheet, data, opts = {}) {
  const doc = sheet.ownerDocument;
  const floorLabel = opts.floorLabel || (id => id);
  sheet.textContent = '';
  if (!data.exitCount || !data.cards.length) {
    sheet.appendChild(el(doc, 'h1', 'sf-title', 'Evacuation cards'));
    sheet.appendChild(el(doc, 'p', 'sf-summary', !data.exitCount
      ? 'No exterior exit is marked on the blueprint, so no route can be worked out. On the Blueprint tab, select a hallway tile at a door and tick "Exterior exit", then print this again.'
      : 'The blueprint has no numbered rooms yet, so there is nothing to print.'));
    return;
  }
  for (const card of data.cards) {
    const floorName = floorLabel(card.floorId);
    const box = el(doc, 'article', 'ev-card');
    box.dataset.room = card.room;
    const head = el(doc, 'header', 'ev-head');
    head.appendChild(el(doc, 'span', 'ev-school', opts.school || ''));
    head.appendChild(el(doc, 'span', 'ev-kind', 'Evacuation route'));
    box.appendChild(head);
    box.appendChild(el(doc, 'h1', 'ev-room', `Room ${card.room}`));
    box.appendChild(el(doc, 'p', 'ev-floor', floorName));

    if (card.status !== 'route') {
      box.appendChild(el(doc, 'p', 'ev-none', 'No route from this room reaches a marked exit.'));
    } else {
      const map = opts.mapFor ? opts.mapFor(card) : null;
      if (map && map.src) {
        const fig = el(doc, 'figure', 'ev-map');
        const img = el(doc, 'img');
        img.src = map.src;
        img.alt = map.alt || `Plan of ${floorName} with the way out from room ${card.room}`;
        fig.appendChild(img);
        fig.appendChild(el(doc, 'figcaption', 'ev-key', card.second
          ? 'Solid line: first way out. Dashed line: second way out. Circle: this room.'
          : 'Solid line: the way out. Circle: this room.'));
        box.appendChild(fig);
      }
      box.appendChild(wayBlock(doc, 'First way out', card.first, floorName));
      if (card.second) box.appendChild(wayBlock(doc, 'Second way out', card.second, floorName));
      else box.appendChild(el(doc, 'p', 'ev-none-2', 'No second marked exit can be reached from this room.'));

      const sf = el(doc, 'section', 'ev-way ev-step-free');
      sf.appendChild(el(doc, 'h2', 'ev-h2', 'Step-free way out'));
      if (card.stepFree && card.stepFree.same) {
        sf.appendChild(el(doc, 'p', null, `The ${card.stepFree.same} way out has no stairs or steps.`));
      } else if (card.stepFree && card.stepFree.route) {
        const w = card.stepFree.route;
        sf.appendChild(el(doc, 'p', null, `To ${w.exitLabel || 'the marked exit'}, with no stairs or steps:`));
        const ol = el(doc, 'ol', 'ev-steps');
        for (const s of w.steps) ol.appendChild(el(doc, 'li', null, s));
        sf.appendChild(ol);
        sf.appendChild(assembly(doc, w));
      } else {
        sf.appendChild(el(doc, 'p', 'ev-warning', 'No step-free way out of this room: every route to a marked exit has stairs or a step. Routes on this card never use an elevator.'));
        if (opts.plan) {
          sf.appendChild(el(doc, 'p', 'ev-writein-label', 'Plan for anyone who cannot use stairs or steps:'));
          sf.appendChild(el(doc, 'p', 'ev-plan', opts.plan));
        } else sf.appendChild(writeIn(doc, 'Plan for anyone who cannot use stairs or steps:', 3));
      }
      box.appendChild(sf);
    }
    box.appendChild(el(doc, 'p', 'ev-foot', ['Worked out from the blueprint', opts.date, opts.version ? `School Layout Visualizer ${opts.version}` : '']
      .filter(Boolean).join(' · ')));
    sheet.appendChild(box);
  }
}

/** Builds every room's card from the page's blueprint into #sf-print-sheet. */
export function buildEvacuationCards() {
  const sheet = document.getElementById('sf-print-sheet');
  const data = window.SVRoutes.evacuationCards({ blueprint: AppState.blueprint, floorLabel: floorLabelById });
  const floors = new Map((AppState.blueprint.floors || []).map(f => [f.id, f]));
  renderEvacuationCards(sheet, data, {
    floorLabel: floorLabelById,
    school: AppState.settings.schoolName || '',
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    version: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : '',
    plan: noStepFreePlan(AppState.settings),
    mapFor: card => {
      const img = renderEvacuationMapCrop(card, floors.get(card.floorId));
      return img ? { src: img.dataURL } : null;
    },
  });
  return data;
}

/** The Blueprint sidebar's "Evacuation Cards" button: build, then preview with a Print button. */
export function openEvacuationCards(trigger) {
  const data = buildEvacuationCards();
  const none = data.cards.filter(c => c.status !== 'route').length;
  if (none && typeof showToast === 'function') {
    showToast(`${none} room${none === 1 ? ' has' : 's have'} no route to a marked exit; ${none === 1 ? 'its card says' : 'their cards say'} so.`, 'warn');
  }
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Evacuation cards',
    onClose: () => asking(false),
    onPrint: printSheet,
  });
}

document.getElementById('btn-print-evacuation-cards')?.addEventListener('click', e => openEvacuationCards(e.currentTarget));

/* ── Lockdown maps (increment 2) ─────────────────────────────────────── */

/** The building's lockdown note, or '' (Settings → Safety printing). */
export function buildingLockdownNote(settings) {
  const v = settings && settings.lockdownNote;
  return typeof v === 'string' ? v.trim() : '';
}

function sheetDate() {
  return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function footer(doc, cls, opts, what) {
  return el(doc, 'p', cls, [what, opts.date, opts.version ? `School Layout Visualizer ${opts.version}` : '']
    .filter(Boolean).join(' · '));
}

/**
 * Fills `sheet` (emptied first) with one lockdown map per floor from
 * sv-model.js's lockdownPages(). opts: { school, date, version, note,
 * mapFor(page) → { src, alt } | null }.
 */
export function renderLockdownMaps(sheet, data, opts = {}) {
  const doc = sheet.ownerDocument;
  sheet.textContent = '';
  if (!data.pages.length) {
    sheet.appendChild(el(doc, 'h1', 'sf-title', 'Lockdown maps'));
    sheet.appendChild(el(doc, 'p', 'sf-summary', 'The blueprint has no numbered rooms yet, so there is nothing to print.'));
    return;
  }
  for (const page of data.pages) {
    const box = el(doc, 'article', 'lk-page');
    box.dataset.floor = page.floorId;
    const head = el(doc, 'header', 'ev-head');
    head.appendChild(el(doc, 'span', 'ev-school', opts.school || ''));
    head.appendChild(el(doc, 'span', 'ev-kind', 'Lockdown map'));
    box.appendChild(head);
    box.appendChild(el(doc, 'h1', 'lk-floor', page.floorName));
    const map = opts.mapFor ? opts.mapFor(page) : null;
    if (map && map.src) {
      const fig = el(doc, 'figure', 'lk-map');
      const img = el(doc, 'img');
      img.src = map.src;
      img.alt = map.alt || `Plan of ${page.floorName} with every room's number`;
      fig.appendChild(img);
      box.appendChild(fig);
    }
    const sec = el(doc, 'section', 'lk-note');
    sec.appendChild(el(doc, 'h2', 'ev-h2', 'Lockdown note for the building'));
    if (opts.note) sec.appendChild(el(doc, 'p', 'ev-plan', opts.note));
    else {
      for (let i = 0; i < 3; i++) sec.appendChild(el(doc, 'div', 'ev-line'));
    }
    box.appendChild(sec);
    const noted = page.rooms.filter(r => r.note);
    const rooms = el(doc, 'section', 'lk-rooms');
    rooms.appendChild(el(doc, 'h2', 'ev-h2', 'Notes for rooms on this floor'));
    if (noted.length) {
      const dl = el(doc, 'dl', 'lk-room-notes');
      for (const r of noted) {
        dl.appendChild(el(doc, 'dt', null, `Room ${r.room}`));
        dl.appendChild(el(doc, 'dd', null, r.note));
      }
      rooms.appendChild(dl);
    } else {
      rooms.appendChild(el(doc, 'p', 'ev-note', 'No room on this floor has a note.'));
    }
    box.appendChild(rooms);
    box.appendChild(footer(doc, 'ev-foot', opts, 'Drawn from the blueprint'));
    sheet.appendChild(box);
  }
}

/** Builds every floor's lockdown map from the page's blueprint into #sf-print-sheet. */
export function buildLockdownMaps() {
  const sheet = document.getElementById('sf-print-sheet');
  const data = window.SVModel.lockdownPages(AppState.blueprint, { floorLabel: floorLabelById });
  const floors = new Map((AppState.blueprint.floors || []).map(f => [f.id, f]));
  renderLockdownMaps(sheet, data, {
    school: AppState.settings.schoolName || '',
    date: sheetDate(),
    version: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : '',
    note: buildingLockdownNote(AppState.settings),
    mapFor: page => {
      const img = renderLockdownMap(page, floors.get(page.floorId));
      return img ? { src: img.dataURL } : null;
    },
  });
  return data;
}

/** The Blueprint sidebar's "Lockdown Maps" button: build, then preview with a Print button. */
export function openLockdownMaps(trigger) {
  buildLockdownMaps();
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Lockdown maps',
    onClose: () => asking(false),
    onPrint: printSheet,
  });
}

document.getElementById('btn-print-lockdown-maps')?.addEventListener('click', e => openLockdownMaps(e.currentTarget));

/* ── Door-sign sets (increment 3) ────────────────────────────────────── */

/** One door sign: the room, the teacher, the subject, and a table of mods per day. */
function doorSignCard(doc, sign, opts) {
  const card = el(doc, 'article', 'ds-sign');
  card.dataset.room = sign.room;
  const head = el(doc, 'header', 'ds-head');
  head.appendChild(el(doc, 'span', 'ds-school', opts.school || ''));
  if (sign.subject) head.appendChild(el(doc, 'span', 'ds-subject', sign.subject));
  card.appendChild(head);
  card.appendChild(el(doc, 'h1', 'ds-room', `Room ${sign.room}`));
  card.appendChild(el(doc, 'p', 'ds-teacher', sign.teacher));
  const days = el(doc, 'div', 'ds-days');
  for (const day of sign.days) {
    const t = el(doc, 'table', 'ds-table');
    if (day.label) t.appendChild(el(doc, 'caption', null, day.label));
    const timed = day.mods.some(m => m.time);   // no bell times set: no empty Time column
    const thead = t.createTHead().insertRow();
    for (const h of timed ? ['', 'Time', 'Group'] : ['', 'Group']) thead.appendChild(el(doc, 'th', null, h));
    const body = t.createTBody();
    for (const m of day.mods) {
      const tr = body.insertRow();
      tr.appendChild(el(doc, 'th', null, m.label));
      if (timed) tr.appendChild(el(doc, 'td', null, m.time));
      tr.appendChild(el(doc, 'td', m.groups.length ? null : 'ds-empty', m.groups.length ? m.groups.join(', ') : '—'));
    }
    days.appendChild(t);
  }
  card.appendChild(days);
  card.appendChild(footer(doc, 'ds-foot', opts, 'From the schedule'));
  return card;
}

/**
 * Fills `sheet` (emptied first) with door signs, two to a letter page through
 * PrintKit.renderCards, from sv-model.js's doorSigns(). opts: { teacher (one
 * name, or '' for every teacher), school, date, version }.
 */
export function renderDoorSigns(sheet, data, opts = {}) {
  const doc = sheet.ownerDocument;
  sheet.textContent = '';
  const sets = opts.teacher ? data.teachers.filter(t => t.teacher === opts.teacher) : data.teachers;
  const signs = sets.flatMap(t => t.signs);
  if (!signs.length) {
    sheet.appendChild(el(doc, 'h1', 'sf-title', 'Door signs'));
    sheet.appendChild(el(doc, 'p', 'sf-summary', data.teachers.length
      ? 'That teacher has no room on the blueprint any more, so there is nothing to print.'
      : 'No classroom on the blueprint has a teacher name, so there is nothing to print. Select a classroom and type its teacher, then print this again.'));
    return;
  }
  const holder = el(doc, 'div', 'ds-set');
  sheet.appendChild(holder);
  PrintKit.renderCards(holder, signs, { cols: 1, perPage: 2 }, sign => doorSignCard(doc, sign, opts));
}

/** The "Door signs for" list: every teacher with a room, keeping the choice if it is still there. */
export function fillDoorSignTeachers(select) {
  if (!select) return;
  const data = window.SVModel.doorSigns({ blueprint: AppState.blueprint, groups: AppState.schedules.groups, settings: AppState.settings });
  const keep = select.value;
  while (select.options.length > 1) select.remove(1);
  for (const t of data.teachers) {
    const o = document.createElement('option');
    o.value = t.teacher;
    o.textContent = `${t.teacher} (${t.signs.length} room${t.signs.length === 1 ? '' : 's'})`;
    select.appendChild(o);
  }
  select.value = data.teachers.some(t => t.teacher === keep) ? keep : '';
}

/** Builds the chosen teacher's signs (or everyone's) into #sf-print-sheet. */
export function buildDoorSigns(teacher) {
  const sheet = document.getElementById('sf-print-sheet');
  const data = window.SVModel.doorSigns({ blueprint: AppState.blueprint, groups: AppState.schedules.groups, settings: AppState.settings });
  renderDoorSigns(sheet, data, {
    teacher: teacher || '',
    school: AppState.settings.schoolName || '',
    date: sheetDate(),
    version: typeof TOOL_VERSION === 'string' ? TOOL_VERSION : '',
  });
  return data;
}

/** The Blueprint sidebar's "Door Signs" button: build, then preview with a Print button. */
export function openDoorSigns(trigger) {
  const select = document.getElementById('door-sign-teacher');
  const data = buildDoorSigns(select ? select.value : '');
  if (data.untaught && typeof showToast === 'function') {
    showToast(`${data.untaught} numbered room${data.untaught === 1 ? ' has' : 's have'} no teacher name, so no sign.`, 'info');
  }
  asking(true);
  return PrintKit.preview({
    area: document.getElementById('sf-print-sheet'), trigger, title: 'Door signs',
    onClose: () => asking(false),
    onPrint: printSheet,
  });
}

{
  const select = document.getElementById('door-sign-teacher');
  // Filled when it is about to be used, so it follows the blueprint without a hook in the editor.
  for (const type of ['focus', 'pointerdown']) select?.addEventListener(type, () => fillDoorSignTeachers(select));
  document.getElementById('btn-print-door-signs')?.addEventListener('click', e => openDoorSigns(e.currentTarget));
}
