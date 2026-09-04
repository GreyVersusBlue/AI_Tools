// smoke-picker-rollout.mjs — the saved-roster dropdown, across the rollout.
//
//   node Tools/roster/test/smoke-picker-rollout.mjs
//
// Path 3 P3 replaced roughly six copy-pasted picker functions across 25 tool
// pages with `Roster.mountRosterPicker` (or, where the dropdown does more than
// the helper offers, with `Roster.listRosters`/`getRoster`), and wired six more
// tools that had no picker at all. The module's own logic is covered by
// roster.test.mjs; this file covers what only the pages can answer.
//
// Four things are under test, and each is a real bug the rollout was for:
//
//   0. THE SCRIPT TAGS. roster.js depends hard on store.js and says so — a page
//      that reaches for `Roster` without loading both, in that order, throws on
//      load and the control never appears. Checked statically on every page,
//      including the ones whose picker lives behind a mode switch.
//   1. THE ARRAY.ISARRAY BUG. Five of the copies (017, 022, 033, 043, 084) did
//      `rosters[n].length` inside a try/catch that blanked the whole control on
//      a throw, so ONE hand-edited entry whose value is not an array hid EVERY
//      roster. The fixture below contains exactly that entry. Every page must
//      still list the good rosters; the bad one is dropped and nothing else.
//   2. SAME-TAB REFRESH. `storage` does not fire in the tab that wrote, so a
//      tool opened beside Class Roster Hub was stale until reload. The mount
//      subscribes to Roster.onChange, which covers both halves.
//   3. NOBODY WRITES np_rosters. It belongs to the Name Picker; these pages
//      read it. A picker that "tidied" the key on mount would silently rewrite
//      a teacher's rosters on every page load.
//
// Exits 1 on any failure. Every name here is invented.

import fs from 'fs';
import path from 'path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8410;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* "Ledger" is the hand-edited entry: a string where an array belongs. It is the
   whole reason assertion 1 exists. The blank and the padded name are there
   because a roster typed by hand has both — and they are why "Period 2 Science"
   is expected to count FOUR, not five: readRosters() trims and drops the blank,
   where every copy this replaced counted it and offered the teacher a roster
   with a nameless student in it. */
const ROSTERS = {
  'Period 2 Science': ['Ada Lovelace', 'Ruiz, Marisol', '  Nellie Bly  ', '', 'Zheng He'],
  'Period 6 Science': ['Grace Hopper', 'Ida B Wells'],
  'Ledger': 'not an array at all',
};

console.log('Roster picker rollout — the saved-roster dropdown across the tools that have one');

/* ── 0. static: every consumer loads store.js then roster.js, and none of them
       still parses np_rosters by hand ─────────────────────────────────────── */
const toolFiles = fs.readdirSync(path.join(SITE, 'Tools'))
  .filter(f => /^\d{3}[-\s].*\.html$/.test(f))
  .sort();

let consumers = 0;
for (const f of toolFiles) {
  const src = fs.readFileSync(path.join(SITE, 'Tools', f), 'utf8');
  const usesRoster = /\bRoster\s*\.\s*[a-zA-Z]/.test(src);
  if (usesRoster) {
    consumers++;
    const store = src.indexOf('<script src="../_shared/store.js"></script>');
    const roster = src.indexOf('<script src="../_shared/roster.js"></script>');
    ok(store !== -1, `${f}: loads _shared/store.js`);
    ok(roster !== -1, `${f}: loads _shared/roster.js`);
    ok(store !== -1 && roster !== -1 && store < roster,
      `${f}: store.js is loaded before roster.js`);
  }
  /* 007 is the Name Picker, which OWNS the key through np-store.js, and its
     only mention is in a comment. Nobody else may parse it by hand. */
  if (f.startsWith('007')) continue;
  ok(!/localStorage\s*\.\s*getItem\s*\(\s*['"]np_rosters['"]/.test(src),
    `${f}: no hand-rolled localStorage read of np_rosters`);
}
ok(consumers >= 25, `at least 25 tool pages consume _shared/roster.js (found ${consumers})`);

/* ── the browser half ─────────────────────────────────────────────────────── */

/* Pages whose picker is mounted by the time the page has settled. `reveal` is a
   selector to click first for the ones whose dropdown lives behind a mode tab.
   003, 023 and 025 are deliberately absent: their pickers appear only after a
   saved document exists and a mode is switched, which is a different tool's
   flow to drive; assertion 0 covers their wiring. */
const PAGES = [
  { file: '001-hall-pass-log.html', sel: '#rosterSelect' },
  { file: '002-group-team-generator.html', sel: '#roster-select' },
  { file: '005-Seating Chart Generator.html', sel: '#rosterHubSelect' },
  { file: '008-behavior-points-tracker.html', sel: '#rosterSelect' },
  { file: '013-lab-safety-contract-tracker.html', sel: '#rosterHubSelect' },
  { file: '014-roleplay-scenario-generator.html', sel: '#rosterHubSelect' },
  { file: '017-gallery-walk-qr.html', sel: '#rosterHubSelect' },
  { file: '017-gallery-walk-qr.html', sel: '#walkRosterSelect' },
  { file: '020-bracket-tournament-generator.html', sel: '#rosterSelect' },
  { file: '021-pe-tournament-stations.html', sel: '#rosterHubSelect' },
  { file: '022-lab-group-role-randomizer.html', sel: '#rosterHubSelect' },
  { file: '027-novel-study-circles-manager.html', sel: '#rosterHubSelect' },
  { file: '030-review-game-board.html', sel: '#rosterSelect' },
  { file: '033-ssr-log-tracker.html', sel: '#rosterHubSelect' },
  { file: '042-certificate-award-maker.html', sel: '#camRosterSelect', reveal: '.mode-tab[data-mode="batch"]' },
  { file: '043-field-trip-permission-slip.html', sel: '#rosterSelect', reveal: '.mode-tab[data-mode="batch"]' },
  { file: '058-duty-roster-builder.html', sel: '#rosterHubSelect' },
  { file: '060-fitness-skill-assessment-tracker.html', sel: '#rosterHubSelect' },
  { file: '073-science-fair-project-tracker.html', sel: '#rosterHubSelect' },
  { file: '075-staff-directory-builder.html', sel: '#rosterHubSelect' },
  { file: '077-testing-accommodations-card-generator.html', sel: '#rosterHubSelect' },
  { file: '084-socratic-seminar-prep-organizer.html', sel: '#importSelect' },
  { file: '085-parent-communication-templates.html', sel: '#importSelect' },
];

const server = await serve(PORT);
const browser = await launch();

/* ── 1 and 3. every page lists both good rosters, past the bad entry, and
       writes nothing back ─────────────────────────────────────────────────── */
for (const spec of PAGES) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message)));
  const url = BASE + '/Tools/' + spec.file.split('/').map(encodeURIComponent).join('/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(r => localStorage.setItem('np_rosters', JSON.stringify(r)), ROSTERS);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 350);
  if (spec.reveal) { await page.click(spec.reveal); await settle(page, 250); }

  const label = `${spec.file} ${spec.sel}`;
  const seen = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    return el ? [...el.options].map(o => o.textContent) : null;
  }, spec.sel);

  if (!ok(seen !== null, `${label}: the dropdown exists`)) { await page.close(); continue; }
  ok(seen.some(t => t === 'Period 2 Science (4)'), `${label}: lists "Period 2 Science (4)"`);
  ok(seen.some(t => t === 'Period 6 Science (2)'), `${label}: lists "Period 6 Science (2)"`);
  ok(!seen.some(t => /Ledger/.test(t)), `${label}: drops the hand-edited "Ledger" entry`);
  ok(errors.length === 0, `${label}: no page errors (${errors.slice(0, 2).join(' | ')})`);

  const onDisk = await page.evaluate(() => localStorage.getItem('np_rosters'));
  eq(onDisk, JSON.stringify(ROSTERS), `${label}: np_rosters untouched on disk`);

  await page.close();
}

/* ── 2. same-tab refresh: a write in THIS tab reaches the mounted picker ──── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  await page.goto(BASE + '/Tools/001-hall-pass-log.html', { waitUntil: 'networkidle' });
  await page.evaluate(r => localStorage.setItem('np_rosters', JSON.stringify(r)), ROSTERS);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);

  const before = await page.evaluate(() => document.querySelector('#rosterSelect').options.length);
  /* Written through the module, which is what Class Roster Hub does — the
     same-tab write a `storage` listener never hears. */
  await page.evaluate(() => window.Roster.setRoster('Period 9 Study Hall', ['Katherine Johnson']));
  await settle(page, 250);
  const after = await page.evaluate(() =>
    [...document.querySelector('#rosterSelect').options].map(o => o.textContent));

  eq(after.length, before + 1, 'same-tab write adds one option without a reload');
  ok(after.some(t => t === 'Period 9 Study Hall (1)'),
    'same-tab write shows the new roster with its count');
  await page.close();
}

/* ── 4. the Load button fills the tool's own names box, and saves nothing ─── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  await page.goto(BASE + '/Tools/060-fitness-skill-assessment-tracker.html', { waitUntil: 'networkidle' });
  await page.evaluate(r => localStorage.setItem('np_rosters', JSON.stringify(r)), ROSTERS);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);

  await page.selectOption('#rosterHubSelect', 'Period 6 Science');
  await page.click('#rosterHubLoadBtn');
  await settle(page, 150);
  const box = await page.evaluate(() => document.querySelector('#rosterInput').value);
  eq(box, 'Grace Hopper\nIda B Wells', '060: Load fills the names box, one per line');
  /* Non-destructive on purpose: filling the box must not save anything yet. */
  const saved = await page.evaluate(() => localStorage.getItem('fsat_tracker_v1'));
  ok(saved === null || !/Grace Hopper/.test(saved), '060: Load does not save until Save roster');
  await page.close();
}

await browser.close();
await server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAIL'); for (const f of fails) console.log('  - ' + f); process.exit(1); }
console.log('PASS');
