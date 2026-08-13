// smoke-safety-gate.mjs — gating lab groups on the safety contract tracker.
//
//   node Tools/lab-group-role-randomizer/test/smoke-safety-gate.mjs
//
// 013-lab-safety-contract-tracker.html knows who's turned in a signed lab
// safety contract; this tool had no idea. This suite holds down the read-only
// bridge between them: reading 'lsct_sections_v1' (never writing it), finding
// who on the current roster lacks a signed contract for the picked class, and
// the two behaviors a teacher can choose between — flag (stay in groups,
// visibly marked) or exclude (left out of the shuffle entirely) — plus the
// edges around that: a name with no contract record at all defaults to
// unsigned (never assumed signed), the pre-multi-document {signed:bool}
// shape 013 itself migrates from is still read correctly, and a missing or
// corrupt 'lsct_sections_v1' degrades to a clear warning instead of a crash.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/022-lab-group-role-randomizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const ROSTER = ['S1 Signed', 'S2 Unsigned', 'S3 NoRecord', 'S4 Signed', 'S5 NoRecord', 'S6 LegacySigned'];

/** Seeds 'lsct_sections_v1' with two classes:
 *   "Period 3" — the current multi-document {docs:{...}} shape. S1 and S4
 *     are fully signed; S2 explicitly signed:false; S3 and S5 have no
 *     contract record at all (must default to unsigned, not crash).
 *   "Old Format" — the pre-multi-document {signed:bool} shape 013 migrates
 *     from, to prove this tool reads that shape too without 013's own
 *     migration ever having run.
 * Also seeds this tool's own roster under 'lgrr_rosters'. */
async function seed(page, names) {
  await page.evaluate((names) => {
    localStorage.clear();
    localStorage.setItem('lsct_sections_v1', JSON.stringify({
      'Period 3': {
        roster: names, dueDate: '', documents: [{ id: 'doc1', label: 'Lab Safety Contract', fee: '', body: '' }],
        contracts: {
          'S1 Signed': { docs: { doc1: { signed: true, date: '2026-08-01' } }, note: '' },
          'S2 Unsigned': { docs: { doc1: { signed: false, date: '' } }, note: '' },
          'S4 Signed': { docs: { doc1: { signed: true, date: '2026-08-02' } }, note: '' },
          'S6 LegacySigned': { docs: { doc1: { signed: true, date: '2026-08-03' } }, note: '' }
          // S3 NoRecord and S5 NoRecord: no entry at all.
        }
      },
      'Old Format': {
        roster: names, dueDate: '', documents: [{ id: 'legacyDoc', label: 'Contract', fee: '', body: '' }],
        contracts: {
          'S6 LegacySigned': { signed: true, date: '2026-08-01', note: '' } // pre-multi-doc shape
        }
      }
    }));
    localStorage.setItem('lgrr_rosters', JSON.stringify({
      'Period 3 Chem': {
        name: 'Period 3 Chem', students: names.join('\n'),
        roles: [{ name: 'Recorder', description: '' }, { name: 'Materials Manager', description: '' }],
        stations: [], mode: 'count', splitValue: 2, history: {},
        lastGroups: null, checkoutLog: [], keepApart: [], absent: []
      }
    }));
    localStorage.setItem('lgrr_current', 'Period 3 Chem');
  }, names);
}

const pickMode = (p, mode) => p.click(`label[for="mode-${mode}"]`);
const badgedNames = (p) => p.evaluate(() =>
  Array.from(document.querySelectorAll('#resultsArea .group-card li')).filter(
    li => li.querySelector('.no-contract-badge')).map(li => li.querySelector('.name').textContent));
const allGroupNames = (p) => p.evaluate(() =>
  Array.from(document.querySelectorAll('#resultsArea .group-card .name')).map(n => n.textContent));

console.log('Lab Group & Role Randomizer — safety contract gate');

const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await seed(page, ROSTER);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. off by default; the options stay hidden ──────────────────────────── */
ok(!(await page.isChecked('#safetyGateEnabled')), 'the gate starts off for a roster that never touched it');
ok(!(await page.isVisible('#safetyGateOptions')), 'and its options stay collapsed');

/* ── 2. turning it on shows a class picker populated from the tracker ────── */
await page.click('#safetyGateEnabled');
await settle(page);
ok(await page.isVisible('#safetyGateOptions'), 'enabling the gate reveals the class picker');
const sectionOptions = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#safetySectionSelect option')).map(o => o.value));
ok(sectionOptions.includes('Period 3') && sectionOptions.includes('Old Format'),
   'both classes from the tracker are offered: ' + JSON.stringify(sectionOptions));
ok(/Pick a class/.test(await page.textContent('#safetyGateReadout')), 'before picking one, the readout says so');

/* ── 3. picking a class reports exactly who is missing a signed contract ─── */
// Signed under "Period 3": S1, S4 (ordinary docs shape) and S6 (also signed,
// via that same current shape, here) — S6's *unsigned* legacy-shape record
// lives under the separate "Old Format" class exercised in step 7.
await page.selectOption('#safetySectionSelect', 'Period 3');
await settle(page);
const readout1 = await page.textContent('#safetyGateReadout');
ok(/3 of 6/.test(readout1), 'three of six are missing: ' + JSON.stringify(readout1));
['S2 Unsigned', 'S3 NoRecord', 'S5 NoRecord'].forEach(n =>
  ok(readout1.indexOf(n) !== -1, `${n} is named as missing in the readout`));
['S1 Signed', 'S4 Signed', 'S6 LegacySigned'].forEach(n =>
  ok(readout1.indexOf(n) === -1, `${n} (signed here) is not named as missing`));
// S3/S5 have no contract record at all for this class — default-unsigned,
// never assumed signed just because there's no explicit false.
ok(readout1.indexOf('S3 NoRecord') !== -1 && readout1.indexOf('S5 NoRecord') !== -1,
   'a student with no contract record at all still counts as missing one');

/* ── 4. "flag" mode (the default): everyone stays in groups, badged ──────── */
ok(await page.isChecked('#safety-mode-flag'), 'flag is the default mode');
await pickMode(page, 'count');
await settle(page);
await page.fill('#splitValue', '2');
await page.click('#shuffleBtn');
await settle(page, 400);
eq((await allGroupNames(page)).length, 6, 'flag mode keeps everyone in the groups');
const flagged = (await badgedNames(page)).sort();
eq(JSON.stringify(flagged), JSON.stringify(['S2 Unsigned', 'S3 NoRecord', 'S5 NoRecord'].sort()),
   'exactly the three unsigned students are badged, not the signed ones');

/* ── 5. the badge is live, not baked in at shuffle time ──────────────────── */
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('lsct_sections_v1'));
  all['Period 3'].contracts['S2 Unsigned'] = { docs: { doc1: { signed: true, date: '2026-08-05' } }, note: '' };
  localStorage.setItem('lsct_sections_v1', JSON.stringify(all));
});
// Nudge a re-render the same way a teacher would notice it (toggling absence
// off/on triggers renderResults; here just re-render via the roster textarea
// no-op isn't enough since it doesn't touch results — use the mode radio's
// sibling event path instead: re-selecting the same class re-renders too).
await page.selectOption('#safetySectionSelect', 'Period 3');
await settle(page);
await page.click('#shuffleBtn'); // reshuffle is the normal path but also re-evaluates the flag live
await settle(page, 300);
ok((await badgedNames(page)).indexOf('S2 Unsigned') === -1,
   'signing S2 in the tracker un-flags them without editing this tool directly');

/* ── 6. "exclude" mode leaves unsigned students out of the shuffle itself ── */
await page.click('label[for="safety-mode-exclude"]');
await settle(page);
await page.click('#shuffleBtn');
await settle(page, 400);
const namesAfterExclude = (await allGroupNames(page)).sort();
// S2 was re-signed above; only S3 and S5 remain unsigned now.
eq(JSON.stringify(namesAfterExclude), JSON.stringify(['S1 Signed', 'S2 Unsigned', 'S4 Signed', 'S6 LegacySigned'].sort()),
   'only the four still-signed students were actually grouped: ' + JSON.stringify(namesAfterExclude));
const warnText = await page.textContent('#warnArea');
ok(/Excluded 2 student/.test(warnText), 'the exclusion is called out by count: ' + JSON.stringify(warnText));
['S3 NoRecord', 'S5 NoRecord'].forEach(n =>
  ok(warnText.indexOf(n) !== -1, `${n} is named in the exclusion warning`));

/* ── 7. the pre-multi-document {signed:bool} shape still reads correctly ─── */
await page.selectOption('#safetySectionSelect', 'Old Format');
await settle(page);
const readoutLegacy = await page.textContent('#safetyGateReadout');
// Only S6 has any record in "Old Format", and it's signed via the legacy
// shape — everyone else (never in that section's contracts) is unsigned.
ok(readoutLegacy.indexOf('S6 LegacySigned') === -1, 'the legacy-shape signed record is honored, not misread as unsigned');
ok(/5 of 6/.test(readoutLegacy), 'the other five are missing under this class: ' + JSON.stringify(readoutLegacy));

/* ── 8. everyone excluded leaves nobody to group, and says so ────────────── */
await page.selectOption('#safetySectionSelect', 'Period 3');
await settle(page);
await page.fill('#namesInput', ['S3 NoRecord', 'S5 NoRecord'].join('\n'));
await settle(page, 300);
await page.click('#shuffleBtn');
await settle(page, 300);
const errMsg = await page.textContent('#msg');
ok(/nobody is left to group/.test(errMsg), 'excluding an entire tiny roster is refused with a clear message: ' + JSON.stringify(errMsg));
await page.fill('#namesInput', ROSTER.join('\n'));
await settle(page, 300);

/* ── 9. a class that no longer exists in the tracker degrades cleanly ────── */
await page.evaluate(() => localStorage.removeItem('lsct_sections_v1'));
await page.selectOption('#safetySectionSelect', 'Period 3');
await settle(page);
const missingReadout = await page.textContent('#safetyGateReadout');
ok(/No class named/.test(missingReadout), 'a vanished class explains itself instead of silently doing nothing: ' + JSON.stringify(missingReadout));
await page.click('#shuffleBtn');
await settle(page, 400);
eq((await allGroupNames(page)).length, 6, 'with the tracker data gone, nothing is excluded — the full roster is grouped');
ok(/no class named/i.test(await page.textContent('#warnArea')), 'and the shuffle warns that the gate could not be applied');

/* ── 10. corrupt JSON in the tracker key is handled the same way, not a crash ─ */
await page.evaluate(() => localStorage.setItem('lsct_sections_v1', '{not valid json'));
await page.selectOption('#safetySectionSelect', 'Period 3');
await settle(page);
ok(/No class named/.test(await page.textContent('#safetyGateReadout')), 'corrupt tracker data reads the same as missing data, not an exception');

/* ── 11. settings persist across a reload ─────────────────────────────────── */
await page.evaluate(() => {
  localStorage.setItem('lsct_sections_v1', JSON.stringify({
    'Period 3': {
      roster: [], dueDate: '', documents: [{ id: 'doc1', label: 'Lab Safety Contract', fee: '', body: '' }],
      contracts: { 'S1 Signed': { docs: { doc1: { signed: true } }, note: '' } }
    }
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
ok(await page.isChecked('#safetyGateEnabled'), 'the gate stays on after a reload');
eq(await page.inputValue('#safetySectionSelect'), 'Period 3', 'the picked class is remembered');
ok(await page.isChecked('#safety-mode-exclude'), 'and the exclude mode is remembered');

/* ── 12. turning the gate back off removes the badges without a reshuffle ── */
await page.click('label[for="safety-mode-flag"]');
await settle(page);
await page.click('#shuffleBtn');
await settle(page, 300);
ok((await badgedNames(page)).length > 0, 'sanity: something is flagged before turning the gate off');
await page.click('#safetyGateEnabled');
await settle(page, 300);
eq((await badgedNames(page)).length, 0, 'turning the gate off clears every badge immediately');
ok(!(await page.isVisible('#safetyGateOptions')), 'and the options collapse again');

/* ── 13. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
