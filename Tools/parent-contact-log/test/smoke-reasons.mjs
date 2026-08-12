// smoke-reasons.mjs — contact reason tags in the parent/guardian contact log.
//
//   node Tools/parent-contact-log/test/smoke-reasons.mjs
//
// Method answers "how did you reach them". Reason answers "what about", which
// is the axis anyone reviewing a contact log actually asks along: an
// administrator wants the behaviour calls, a conference wants one student, and
// a teacher checking their own habits wants to know how many of these were
// good news.
//
// Two things this suite guards:
//
//   1. Entries logged before reasons existed. A year of a teacher's records
//      has no `reason` field at all, and none of it may break, disappear from
//      the table, or be quietly relabelled as something it isn't.
//   2. What gets stored is a slug, not a label. Renaming "Grades /
//      academics" later must not orphan every entry filed under it.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8200;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/068-parent-contact-log.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1100 });

const log = async (p, { student, reason, outcome, date, method }) => {
  await p.selectOption('#entryStudent', student);
  await p.fill('#entryDate', date || '2026-05-04');
  if (method) await p.selectOption('#entryMethod', method);
  if (reason) await p.selectOption('#entryReason', reason);
  await p.fill('#entryOutcome', outcome);
  await p.click('#logEntryBtn');
  await settle(p, 300);
};

const rows = (p) => p.evaluate(() =>
  [...document.querySelectorAll('#entryRows tr')].map(tr => ({
    student: tr.cells[1].textContent,
    method: tr.cells[2].textContent.trim(),
    reason: tr.cells[3].textContent.trim(),
    reasonClass: (tr.cells[3].querySelector('.reason-badge') || {}).className || '',
    outcome: tr.cells[4].textContent,
  })));

console.log('Parent/Guardian Contact Log — contact reason tags');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.fill('#rosterInput', 'Ada Lovelace\nMarco Polo\nNellie Bly');
await page.click('#saveRosterBtn');
await settle(page, 300);

/* ── 1. reason sits beside method, not instead of it ───────────────────── */
await log(page, { student: 'Ada Lovelace', method: 'Phone call', reason: 'positive', outcome: 'Called to say her essay was the strongest in the class.' });
await log(page, { student: 'Marco Polo', method: 'Email', reason: 'behavior', outcome: 'Emailed about calling out during the lab.' });
await log(page, { student: 'Nellie Bly', method: 'Phone call', reason: 'attendance', outcome: 'Third absence this week.' });
await log(page, { student: 'Ada Lovelace', method: 'Note home', reason: 'grades', outcome: 'Missing two assignments.' });

let list = await rows(page);
eq(list.length, 4, 'four contacts logged');
const ada = list.find(r => r.student === 'Ada Lovelace' && r.method === 'Phone call');
eq(ada.reason, 'Positive / good news', 'the reason shows as its own column, in words');
eq(ada.method, 'Phone call', 'and the method column is untouched — this is a second axis, not a replacement');
ok(/r-positive/.test(ada.reasonClass), 'with a class for colour: ' + ada.reasonClass);

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pcl_entries_v1')));
eq(stored[0].reason, 'positive', 'what is stored is the slug, so renaming the label later orphans nothing');
eq(stored[0].method, 'Phone call', 'alongside the method, unchanged');

/* ── 2. the tally counts what is on screen, and calls out the good news ── */
let tally = await page.textContent('#reasonTally');
ok(/4.*shown/.test(tally.replace(/\s+/g, ' ')), 'the tally counts the rows shown: ' + tally.replace(/\s+/g, ' '));
ok(/Positive \/ good news.*1/.test(tally.replace(/\s+/g, ' ')), 'and breaks them down by reason');
eq(await page.evaluate(() => !!document.querySelector('#reasonTally .t-positive')), true,
   'positive contacts are marked out, since that is the number a teacher is keeping score of');

/* ── 3. filtering by reason ────────────────────────────────────────────── */
await page.selectOption('#filterReason', 'behavior');
await settle(page, 300);
list = await rows(page);
eq(list.length, 1, 'filtering to behaviour leaves one row');
eq(list[0].student, 'Marco Polo', 'the right one');

// Reason and method filters compose rather than replacing each other.
await page.selectOption('#filterReason', '');
await page.selectOption('#filterMethod', 'Phone call');
await settle(page, 300);
eq((await rows(page)).length, 2, 'method alone: two phone calls');
await page.selectOption('#filterReason', 'positive');
await settle(page, 300);
list = await rows(page);
eq(list.length, 1, 'method and reason together narrow further');
eq(list[0].student, 'Ada Lovelace', 'to the positive phone call');
await page.selectOption('#filterMethod', '');
await page.selectOption('#filterReason', '');
await settle(page, 300);
eq((await rows(page)).length, 4, 'and clearing both brings everything back');

/* ── 4. editing an entry keeps its reason ──────────────────────────────── */
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('#entryRows tr')].find(r => /Nellie/.test(r.cells[1].textContent));
  tr.querySelector('[data-edit]').click();
});
await settle(page, 300);
eq(await page.inputValue('#entryReason'), 'attendance', 'opening an entry for edit shows the reason it was filed under');
await page.selectOption('#entryReason', 'positive');
await page.click('#logEntryBtn');
await settle(page, 400);
list = await rows(page);
eq(list.find(r => r.student === 'Nellie Bly').reason, 'Positive / good news', 'and changing it sticks');

/* ── 5. a year of entries logged before reasons existed ────────────────── */
const legacy = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await legacy.goto(URL_PAGE, { waitUntil: 'networkidle' });
await legacy.evaluate(() => {
  localStorage.setItem('pcl_roster_v1', JSON.stringify(['Grace Hopper']));
  localStorage.setItem('pcl_entries_v1', JSON.stringify([
    { id: 'old1', student: 'Grace Hopper', date: '2026-01-12', method: 'Email', initials: 'DM', outcome: 'Emailed about the project deadline.' },
  ]));
});
await legacy.reload({ waitUntil: 'networkidle' });
await settle(legacy, 500);
let legacyRows = await rows(legacy);
eq(legacyRows.length, 1, 'an entry saved before reasons existed still shows');
eq(legacyRows[0].outcome, 'Emailed about the project deadline.', 'with its note intact');
eq(legacyRows[0].reason, '—', 'and an em dash rather than a reason it never had');
ok(/r-none/.test(legacyRows[0].reasonClass), 'styled as absent, not as a category: ' + legacyRows[0].reasonClass);
ok(/no reason recorded.*1/.test((await legacy.textContent('#reasonTally')).replace(/\s+/g, ' ')),
   'the tally says how many are untagged rather than hiding them');

await legacy.selectOption('#filterReason', '__none__');
await settle(legacy, 300);
eq((await rows(legacy)).length, 1, 'the "(no reason recorded)" filter finds exactly those');
await legacy.selectOption('#filterReason', 'grades');
await settle(legacy, 300);
eq((await rows(legacy)).length, 0, 'and a real reason does not sweep them up');
await legacy.selectOption('#filterReason', '');
await settle(legacy, 300);

// Editing an untagged legacy entry must not silently file it under the first
// reason in the list — "Other" is the honest default for something never set.
await legacy.evaluate(() => document.querySelector('#entryRows [data-edit]').click());
await settle(legacy, 300);
eq(await legacy.inputValue('#entryReason'), 'other', 'editing an untagged entry defaults to Other, not to whatever is first');

/* ── 6. reason travels with both outputs ───────────────────────────────── */
const csv = await page.evaluate(() => {
  let captured = null;
  const real = URL.createObjectURL;
  URL.createObjectURL = (blob) => { captured = blob; return real.call(URL, blob); };
  document.getElementById('exportCsvBtn').click();
  URL.createObjectURL = real;
  return captured ? captured.text() : null;
});
ok(csv && /Reason/.test(csv.split('\r\n')[0]), 'the CSV gains a Reason column: ' + (csv || '').split('\r\n')[0]);
ok(/Positive \/ good news/.test(csv), 'carrying the readable label, not the slug — this file gets opened by people');

await page.evaluate(() => { window.print = () => {}; });
await page.click('#printAllBtn');
await settle(page, 300);
const printed = await page.evaluate(() => document.getElementById('printArea').textContent);
ok(/Reason/.test(printed), 'the printed list gains the column');
ok(/Behavior/.test(printed), 'with the reasons in it');

/* ── 7. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['legacy', legacy]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
