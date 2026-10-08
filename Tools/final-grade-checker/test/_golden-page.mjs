// _golden-page.mjs — drives the Final Grade Checker through fixed, made-up
// gradebooks and returns a fingerprint of everything it shows, so
// smoke-scenarios.mjs can prove that the page computes today what it computed
// before the scenario panel existed. golden-old-page.json was recorded from the
// page at 235dcf3 (no scenario panel) with `node smoke-scenarios.mjs --record`.
//
// All names are invented.

import crypto from 'node:crypto';
import { settle } from '../../board-check/harness.mjs';

// A small seeded generator (mulberry32) so the fixtures never change.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LET = p => (p >= 89.5 ? 'A' : p >= 79.5 ? 'B' : p >= 69.5 ? 'C' : p >= 59.5 ? 'D' : 'F');
const NAMES = ['Ash', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern', 'Glen', 'Heath', 'Iris', 'Juniper'];

/** A tab-separated paste in the layout the page documents; ~1 in 9 quarters blank. */
export function makePaste(seed, n) {
  const r = rng(seed);
  const lines = [];
  for (let i = 0; i < n; i++) {
    const qs = [];
    for (let q = 0; q < 4; q++) {
      if (r() < 0.11) { qs.push(''); continue; }
      // two decimals, pulled toward the letter boundaries now and then
      const base = r() < 0.3 ? [59.5, 69.5, 79.5, 89.5][Math.floor(r() * 4)] + Math.round((r() - 0.5) * 400) / 100
                              : Math.round(r() * 10000) / 100;
      const v = Math.max(0, Math.min(100, Math.round(base * 100) / 100));
      qs.push(`${LET(v)}(${v.toFixed(2)})`);
    }
    lines.push([String(20000 + i), `${NAMES[i % 10]}${Math.floor(i / 10)}, Test`, '03', '07', ...qs, ''].join('\t'));
  }
  return lines.join('\n');
}

export const PASTES = [makePaste(11, 30), makePaste(2027, 45), makePaste(4093, 12)];

const sha = s => crypto.createHash('sha256').update(s).digest('hex');

async function importPaste(page, text) {
  await page.fill('#import-area', text);
  await page.click('#import-btn');
  await settle(page, 400);
}

async function setSettings(page, s) {
  const open = await page.$eval('#settings-panel', el => !el.hidden);
  if (!open) await page.click('#settings-toggle-btn');
  await page.check(`input[name="round-boundary"][value="${s.boundary}"]`);
  await page.selectOption('#round-precision', s.precision);
  const w = await page.$eval('#weights-enabled', el => el.checked);
  if (w !== s.weightsEnabled) await page.click('#weights-enabled');
  if (s.weights) for (let i = 0; i < 4; i++) {
    await page.fill(`#weight-q${i + 1}`, String(s.weights[i]));
    await page.dispatchEvent(`#weight-q${i + 1}`, 'input');
  }
  const shown = await page.$eval('#show-work-toggle', el => el.checked);
  if (shown !== !!s.showWork) await page.click('#show-work-toggle');
  await settle(page, 200);
}

export const SETTINGS = [
  { boundary: 'half', precision: 'none', weightsEnabled: false },
  { boundary: 'strict', precision: 'none', weightsEnabled: false, showWork: true },
  { boundary: 'half', precision: 'tenth', weightsEnabled: true, weights: [40, 20, 20, 20] },
  { boundary: 'half', precision: 'whole', weightsEnabled: true, weights: [10, 20, 30, 40] },
];

/** Everything the page shows for one paste under one setting, hashed. */
export async function fingerprint(page) {
  return page.evaluate(() => {
    const cards = document.getElementById('students-container').innerHTML;
    const grab = id => { const e = document.getElementById(id); return e ? e.innerHTML : null; };
    return {
      cards,
      triage: grab('triage-missing-list') + '|' + grab('triage-oneaway-list') + '|' + grab('triage-count'),
      whatif: grab('whatif-summary'),
    };
  }).then(f => ({ cards: sha(f.cards), triage: sha(f.triage), whatif: sha(f.whatif), n: f.cards.length }));
}

/** The old page's whole surface: every paste under every setting, plus the
 *  old what-if (+2 and drop) and the one string the page ever stores. */
export async function recordPage(page, url) {
  const out = { grid: [], whatif: [], stored: null };
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  for (let si = 0; si < SETTINGS.length; si++) {
    await setSettings(page, SETTINGS[si]);
    for (let pi = 0; pi < PASTES.length; pi++) {
      await importPaste(page, PASTES[pi]);
      out.grid.push({ s: si, p: pi, ...(await fingerprint(page)) });
    }
  }
  // the old class-wide what-if
  await importPaste(page, PASTES[1]);
  for (const [plus, drop] of [[2, false], [0, true], [1.5, true], [-3, false]]) {
    await page.fill('#whatif-plus', String(plus));
    await page.dispatchEvent('#whatif-plus', 'input');
    await (drop ? page.check('#whatif-drop') : page.uncheck('#whatif-drop'));
    await settle(page, 200);
    out.whatif.push({ plus, drop, ...(await fingerprint(page)) });
  }
  // the one stored string, with Remember ticked under the last settings
  await page.check('#settings-persist');
  await settle(page, 100);
  out.stored = await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1'));
  return out;
}
