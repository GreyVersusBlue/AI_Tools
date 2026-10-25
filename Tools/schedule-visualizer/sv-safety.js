// sv-safety.js — the School Layout Visualizer's safety printing
// (Path 11 P4, BACKLOG.md "Path 11", the P4 bullet): increment 1, the
// evacuation cards, one per room on every floor.
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
// Its browser check is test/smoke-evacuation.mjs (in npm run test:schedule-visualizer);
// the content's is test/evacuation-cards.test.mjs.

/* global AppState, floorLabelById, renderEvacuationMapCrop, showToast, TOOL_VERSION -- 035's classic-script state and sv-editor.js (PrintKit is a SITE_GLOBAL) */

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
