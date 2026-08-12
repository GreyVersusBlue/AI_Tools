// smoke-sort.mjs — ranking the fitness results grid by an event.
//
//   node Tools/fitness-skill-assessment-tracker/test/smoke-sort.mjs
//
// "Who are the outliers" is the question a PE teacher asks of this grid, and
// a roster-ordered table of twenty-eight rows does not answer it. One click
// per event heading should.
//
// The arithmetic is the part worth pinning, because it is wrong in a way that
// still looks sorted:
//
//   - Best-first means best. A count event is better higher, a time event is
//     better lower, so the first click on Push-ups must put the most at the
//     top and the first click on Mile Run must put the fastest there. A single
//     numeric comparator gets one of the two backwards and nothing on screen
//     says so.
//   - A blank cell is not a zero and it is not the fastest time on record.
//     Students with no result belong at the bottom in *both* directions, or
//     flipping the sort floats an empty row onto the projector.
//   - Times are mm:ss. "9:58" sorts after "10:02" as a string and before it as
//     a duration, which is the whole point.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8197;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/060-fitness-skill-assessment-tracker.html';
const STORE_KEY = 'fsat_tracker_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const ROSTER = ['Marisol Ruiz', 'Beckett Hale', 'Amaia Etxeberria', 'Devraj Balasubramanian', 'Sable Whitfield'];

/* Mile Run is a time event, Push-ups a count. Marisol's 9:58 beats Beckett's
   10:02 as a duration and loses to it as a string, which is the trap. Sable
   has no result for either — the row that must never float to the top. */
const MILE = { 'Marisol Ruiz': '9:58', 'Beckett Hale': '10:02', 'Amaia Etxeberria': '8:45', 'Devraj Balasubramanian': '12:10' };
const PUSHUPS = { 'Marisol Ruiz': '22', 'Beckett Hale': '41', 'Amaia Etxeberria': '15', 'Devraj Balasubramanian': '30' };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Fitness Tracker — sortable results columns');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#rosterInput', ROSTER.join('\n'));
await page.click('#saveRosterBtn');
await settle(page, 250);

/* The three built-in events are Mile Run (time), Push-ups (count), Sit-ups
   (count) — read their real ids rather than assuming them. */
const eventIds = await page.$$eval('#eventsWrap [data-ename]', els => els.map(e => e.getAttribute('data-ename')));
eq(eventIds.length, 3, 'the three built-in events are there to sort by');

const fill = async (eventIdx, values) => {
  for (const [student, v] of Object.entries(values)) {
    await page.fill(`input[data-student="${student}"][data-event="${eventIds[eventIdx]}"]`, v);
  }
  await settle(page, 150);
};
await fill(0, MILE);
await fill(1, PUSHUPS);

const order = () => page.$$eval('#resultsTable tbody tr', els => els.map(tr => tr.getAttribute('data-student-row')));
const clickHead = async idx => {
  await page.click(`#resultsTable th[data-sort-by="${eventIds[idx]}"]`);
  await settle(page, 200);
};

/* ── 1. it opens in roster order, and says nothing ─────────────────────── */
same(await order(), ROSTER, 'the grid opens in the order the roster was typed');
ok(!(await page.isVisible('#sortNote')), 'with no sort note, because nothing is sorted');

/* ── 2. a time event sorts fastest first ───────────────────────────────── */
await clickHead(0);
same(await order(), ['Amaia Etxeberria', 'Marisol Ruiz', 'Beckett Hale', 'Devraj Balasubramanian', 'Sable Whitfield'],
     'Mile Run puts the fastest at the top — and 9:58 beats 10:02, which it would not as text');
ok(/fastest first/.test(await page.textContent('#sortNote')),
   'and the note says which way round it is: ' + await page.textContent('#sortNote'));

await clickHead(0);
same(await order(), ['Devraj Balasubramanian', 'Beckett Hale', 'Marisol Ruiz', 'Amaia Etxeberria', 'Sable Whitfield'],
     'clicking again flips it to slowest first');
eq((await order())[4], 'Sable Whitfield',
   'and the student with no time is still last — a blank is not the fastest run of the day');
ok(/slowest first/.test(await page.textContent('#sortNote')), 'the note flips with it');

/* ── 3. a count event sorts the other way, and calls it the same thing ── */
await clickHead(1);
same(await order(), ['Beckett Hale', 'Devraj Balasubramanian', 'Marisol Ruiz', 'Amaia Etxeberria', 'Sable Whitfield'],
     'Push-ups puts the most at the top — "best first" means the opposite arithmetic here');
ok(/highest first/.test(await page.textContent('#sortNote')), 'described in the units of the event, not "ascending"');
await clickHead(1);
eq((await order())[0], 'Amaia Etxeberria', 'flipped, the fewest come first');
eq((await order())[4], 'Sable Whitfield', 'and the empty row stays at the bottom in this direction too');

/* ── 4. an event nobody has results for keeps roster order ─────────────── */
await clickHead(2);   // Sit-ups: no results entered at all
same(await order(), ROSTER, 'sorting by an event with no results leaves the roster order alone rather than shuffling it');

/* ── 5. by name, and back to roster order ──────────────────────────────── */
await page.click('#resultsTable th[data-sort-by="__name"]');
await settle(page, 200);
same(await order(), ROSTER.slice().sort((a, b) => a.localeCompare(b)), 'the Student heading sorts alphabetically');
await page.click('#resetSortBtn');
await settle(page, 200);
same(await order(), ROSTER, 'and there is a way back to the roster order the teacher typed');
ok(!(await page.isVisible('#sortNote')), 'with the note gone');

/* ── 6. the current order is what prints and what exports ──────────────── */
await clickHead(0);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => window.__printed), 1, 'printing goes ahead');
same(await page.$$eval('#printArea tbody tr td:first-child', els => els.map(td => td.textContent).slice(0, 5)),
     ['Amaia Etxeberria', 'Marisol Ruiz', 'Beckett Hale', 'Devraj Balasubramanian', 'Sable Whitfield'],
     'the printed report is in the order on screen — printing the ranking is the reason to sort');
ok(/fastest first/.test(await page.textContent('#printArea .print-sub')),
   'and the page says how it is ordered, so a printout found later still means something');

const csv = await page.evaluate(async () => {
  // Intercept the download rather than writing a file: the order is the claim.
  const real = URL.createObjectURL;
  let captured = null;
  URL.createObjectURL = blob => { captured = blob; return real.call(URL, blob); };
  document.getElementById('exportCsvBtn').click();
  URL.createObjectURL = real;
  return captured ? await captured.text() : '';
});
const csvNames = csv.split(/\r?\n/).slice(1).map(l => l.split(',')[0]).filter(Boolean);
same(csvNames, ['Amaia Etxeberria', 'Marisol Ruiz', 'Beckett Hale', 'Devraj Balasubramanian', 'Sable Whitfield'],
     'the CSV follows the same order');

/* ── 7. the class stats row is unmoved by any of it ────────────────────── */
const footer = await page.textContent('#resultsTable tfoot');
ok(/8:45/.test(footer) && /12:10/.test(footer),
   'the class average/range row still reads off the whole class, not the sorted view: ' + footer.trim().slice(0, 80));

/* ── 8. sorting is a view, not saved state ─────────────────────────────── */
const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), STORE_KEY);
ok(!('sortBy' in saved) && !('sortDir' in saved), 'nothing about the sort is written to storage');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
same(await order(), ROSTER,
     'reopening gives the teacher their roster back, not whatever they were ranking by last Thursday');

/* ── 9. no console noise, nothing left the site ────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
