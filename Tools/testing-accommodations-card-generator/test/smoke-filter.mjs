// smoke-filter.mjs — filtering the accommodations grid by accommodation.
//
//   node Tools/testing-accommodations-card-generator/test/smoke-filter.mjs
//
// Testing day is planned one accommodation at a time: "who needs a separate
// setting" is a room, "who needs read-aloud" is a proctor. A twenty-eight by
// six grid of checkboxes contains those answers but does not give them, and
// the teacher reading it is doing so the morning of.
//
// The filter is easy to build wrong in two specific ways, and both are here:
// filtering the *view* while Print still emits the whole roster (so the
// read-aloud proctor gets twenty-eight cards), and letting a deleted
// accommodation leave a filter pointing at nothing, which empties the grid
// with no way back except clearing storage.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8195;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/077-testing-accommodations-card-generator.html';
const STORE_KEY = 'tacg_cards_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const ROSTER = ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz', 'Nadia Okonjo', 'Zheng He'];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Testing Accommodations — filter the grid by accommodation');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

await page.fill('#rosterInput', ROSTER.join('\n'));
await page.click('#saveRosterBtn');
await settle(page, 250);

/** The ids of the six built-in accommodation types, in the order they render. */
const typeIds = await page.$$eval('#typesWrap input[data-type]', els => els.map(e => e.getAttribute('data-type')));
eq(typeIds.length, 6, 'the six built-in accommodation types are there to filter by');

/* Extended time (0) for three students, read-aloud (2) for two, and one
   student — Zheng He — deliberately left with nothing ticked. */
const tick = async (student, typeIdx) => {
  await page.check(`input[data-student="${student}"][data-type-check="${typeIds[typeIdx]}"]`);
  await settle(page, 80);
};
for (const n of ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz']) await tick(n, 0);
for (const n of ['Beckett Hale', 'Nadia Okonjo']) await tick(n, 2);

const shownNames = () => page.$$eval('#assignTable tr[data-student-row]', els =>
  els.map(e => e.getAttribute('data-student-row')));

/* ── 1. unfiltered, it is the grid it always was ───────────────────────── */
same(await shownNames(), ROSTER, 'every student is on the grid to begin with');
ok(/4 of 5 students have at least one/.test(await page.textContent('#summaryLine')),
   'and the summary is the whole-roster one: ' + await page.textContent('#summaryLine'));

/* ── 2. filtering to one accommodation ─────────────────────────────────── */
await page.selectOption('#filterSelect', typeIds[2]);   // Read-aloud
await settle(page, 250);
same(await shownNames(), ['Beckett Hale', 'Nadia Okonjo'], 'only the students with that accommodation are listed');
ok(/2 of 5 students: Read-aloud/.test(await page.textContent('#summaryLine')),
   'the summary names the filter and counts it: ' + await page.textContent('#summaryLine'));

/* The filter is a view over the roster, not a filter of the columns — every
   accommodation stays tickable, because "she needs read-aloud AND breaks" is
   exactly the edit a teacher makes while looking at the read-aloud list. */
eq(await page.$$eval('#assignTable th', els => els.length), 8, 'all six columns stay, plus Student and Note');

/* ── 3. Print follows the filter, which is the whole point ─────────────── */
eq(await page.$eval('#printWhoSelect option', o => o.textContent), 'All 2 shown',
   'the Print picker says how many it will cover, rather than lying about "all students"');
same(await page.$$eval('#printWhoSelect option', els => els.map(o => o.value)),
     ['', 'Beckett Hale', 'Nadia Okonjo'], 'and offers only the students on screen');

await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => window.__printed), 1, 'printing goes ahead');
same(await page.$$eval('#printGrid .accom-card h3', els => els.map(h => h.textContent)),
     ['Beckett Hale', 'Nadia Okonjo'],
     'and the proctor gets exactly the read-aloud stack, not the whole roster');

/* ── 4. the students nobody has got to yet ─────────────────────────────── */
await page.selectOption('#filterSelect', '__none');
await settle(page, 250);
same(await shownNames(), ['Zheng He'], 'the "no accommodations yet" bucket finds the student nothing is ticked for');
ok(/no accommodations yet/.test(await page.textContent('#summaryLine')), 'and says so');

/* ── 5. unticking under a live filter ──────────────────────────────────── */
await page.selectOption('#filterSelect', typeIds[0]);   // Extended time
await settle(page, 250);
same(await shownNames(), ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz'], 'three students on extended time');
await page.uncheck(`input[data-student="Marisol Ruiz"][data-type-check="${typeIds[0]}"]`);
await settle(page, 250);
same(await shownNames(), ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz'],
     'the row does not vanish from under the click — that would take the keyboard focus with it');
ok(await page.$eval('#assignTable tr[data-student-row="Marisol Ruiz"]', el => el.classList.contains('filtered-out')),
   'but it is marked as no longer belonging to the list');
ok(/2 of 5/.test(await page.textContent('#summaryLine')), 'the count drops immediately');
await page.click('#printBtn');
await settle(page, 300);
same(await page.$$eval('#printGrid .accom-card h3', els => els.map(h => h.textContent)),
     ['Ada Lovelace', 'Beckett Hale'],
     'and the printed stack drops them too, so the paper and the count agree');

/* ── 6. the filter survives a reload ───────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.inputValue('#filterSelect'), typeIds[0], 'the filter is where it was left');
same(await shownNames(), ['Ada Lovelace', 'Beckett Hale'], 'and the grid comes back filtered');

/* ── 7. deleting the accommodation the filter stands on ────────────────── */
/* Without a guard this leaves state.filter pointing at an id nothing matches,
   which empties the grid permanently with no obvious way back. */
await page.click(`[data-del-type="${typeIds[0]}"]`);
await settle(page, 300);
same(await shownNames(), ROSTER, 'deleting the filtered accommodation falls back to every student');
eq(await page.inputValue('#filterSelect'), '', 'and the picker agrees it is showing everybody');
eq(await page.$$eval('#filterSelect option', els => els.length), 7,
   'the picker rebuilt itself from the five remaining types, plus Every student and the none bucket');

/* ── 8. a filter that matches nobody explains itself ───────────────────── */
const remaining = await page.$$eval('#typesWrap input[data-type]', els => els.map(e => e.getAttribute('data-type')));
await page.selectOption('#filterSelect', remaining[3]);   // Use of calculator — nobody has it
await settle(page, 250);
eq((await shownNames()).length, 0, 'a filter nobody matches shows no rows');
ok(/No students match/.test(await page.textContent('#assignTable')),
   'and says why, with the way out: ' + (await page.textContent('#assignTable')).slice(0, 90));
const before = await page.evaluate(() => window.__printed);
page.once('dialog', d => d.dismiss());
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => window.__printed), before, 'printing an empty filter is refused rather than printing a blank page');

/* ── 9. a saved file from before the filter existed still opens ────────── */
await page.evaluate(([k, roster]) => {
  localStorage.setItem(k, JSON.stringify({ roster: roster, types: [{ id: 'x1', name: 'Extended time' }], assignments: {}, notes: {} }));
}, [STORE_KEY, ROSTER]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
same(await shownNames(), ROSTER, 'a save with no filter field reads as no filter');
eq(await page.inputValue('#filterSelect'), '', 'and the picker starts on every student');

/* ── 10. no console noise, nothing left the site ───────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
