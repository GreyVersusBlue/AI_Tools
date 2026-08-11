// smoke-reasons.mjs — contact reason tags in the parent/guardian contact log.
//
//   node Tools/parent-contact-log/test/smoke-reasons.mjs
//
// Method answers "how did you reach them". Reason answers "what was it about",
// which is the axis a teacher needs when an administrator asks what has been
// tried with a student — or when checking that home contact is not exclusively
// bad news.
//
// The thing most likely to go wrong is the old data: every entry logged before
// this round has no reason at all, and "not recorded" has to stay "not
// recorded" everywhere rather than being guessed at or backfilled. Several
// checks below exist only to hold that line.
//
// Exits 1 on any failure. Every student name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8189;
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

console.log('Parent Contact Log — reason tags');

/* ── start with one entry from before reasons existed ──────────────────── */
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.addInitScript(() => {
  window.print = () => { window.__printed = (window.__printed || 0) + 1; };
  localStorage.setItem('pcl_roster_v1', JSON.stringify(['Ada Okonkwo', 'Ben Marsh']));
  localStorage.setItem('pcl_entries_v1', JSON.stringify([
    { id: 'legacy1', student: 'Ada Okonkwo', date: '2026-01-12', method: 'Phone call',
      initials: 'DM', outcome: 'Called about missing homework — spoke with mom.' },
  ]));
});
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

const rows = () => page.$$eval('#entryRows tr', trs =>
  trs.map(tr => Array.from(tr.children).map(td => td.textContent.trim())));

let list = await rows();
eq(list.length, 1, 'the pre-reasons entry loads');
eq(list[0][3], '—', 'and shows an em dash rather than inventing a reason for it');

/* ── logging with a reason ─────────────────────────────────────────────── */
const reasonOptions = await page.$$eval('#entryReason option', els => els.map(e => e.value));
ok(reasonOptions.includes('Attendance') && reasonOptions.includes('Behavior') &&
   reasonOptions.includes('Positive news') && reasonOptions.includes('Grades / missing work'),
   'the four axes the backlog named are all offered: ' + JSON.stringify(reasonOptions));

async function log({ student, date, method, reason, outcome }) {
  await page.selectOption('#entryStudent', student);
  await page.fill('#entryDate', date);
  await page.selectOption('#entryMethod', method);
  await page.selectOption('#entryReason', reason);
  await page.fill('#entryOutcome', outcome);
  await page.click('#logEntryBtn');
  await settle(page, 250);
}

await log({ student: 'Ada Okonkwo', date: '2026-02-03', method: 'Email', reason: 'Positive news',
            outcome: 'Emailed home about her presentation.' });
await log({ student: 'Ben Marsh', date: '2026-02-04', method: 'Phone call', reason: 'Attendance',
            outcome: 'Third late arrival this week.' });
await log({ student: 'Ben Marsh', date: '2026-02-06', method: 'Note home', reason: 'Behavior',
            outcome: 'Sent a note about calling out.' });

list = await rows();
eq(list.length, 4, 'three new entries alongside the legacy one');
ok(list.some(r => r[1] === 'Ada Okonkwo' && r[3] === 'Positive news'), 'the reason lands in its own column');

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pcl_entries_v1')));
eq(stored.find(e => e.id === 'legacy1').reason, undefined,
   'the pre-reasons entry is still untouched on disk — nothing was backfilled');
ok(stored.filter(e => e.reason).length === 3, 'and the three new ones carry theirs');

/* ── the reason filter ─────────────────────────────────────────────────── */
await page.selectOption('#filterReason', 'Behavior');
await settle(page, 250);
list = await rows();
eq(list.length, 1, 'filtering by reason narrows the history');
eq(list[0][1], 'Ben Marsh', 'to the right entry');

// Reason and method are genuinely two axes: they compose.
await page.selectOption('#filterReason', '');
await page.selectOption('#filterMethod', 'Phone call');
await settle(page, 250);
eq((await rows()).length, 2, 'method alone matches two calls');
await page.selectOption('#filterReason', 'Attendance');
await settle(page, 250);
list = await rows();
eq(list.length, 1, 'method AND reason together narrow further — the point of a second axis');
eq(list[0][1], 'Ben Marsh', 'to the attendance call');

await page.selectOption('#filterMethod', '');
await page.selectOption('#filterReason', '(not recorded)');
await settle(page, 250);
list = await rows();
eq(list.length, 1, 'the untagged bucket is selectable in its own right');
eq(list[0][1], 'Ada Okonkwo', 'and finds the legacy entry');

/* ── editing an old entry only takes a reason if you save it ───────────── */
await page.selectOption('#filterReason', '');
await settle(page, 250);
await page.click('#entryRows tr:has-text("2026") button[data-edit="legacy1"]');
await settle(page, 250);
eq(await page.inputValue('#entryReason'), 'Attendance',
   'editing a pre-reasons entry opens on the first reason rather than a blank');
const stillBlank = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('pcl_entries_v1')).find(e => e.id === 'legacy1').reason);
eq(stillBlank, undefined, 'and merely opening it has not written one');
await page.selectOption('#entryReason', 'Grades / missing work');
await page.click('#logEntryBtn');
await settle(page, 250);
eq(await page.evaluate(() =>
  JSON.parse(localStorage.getItem('pcl_entries_v1')).find(e => e.id === 'legacy1').reason),
  'Grades / missing work', 'saving the edit is what records it');

/* ── it reaches the printed page ───────────────────────────────────────── */
await page.click('#printAllBtn');
await settle(page, 250);
const printText = await page.textContent('#printArea');
ok(/Reason/.test(printText), 'the printed log has a Reason column');
ok(/Positive news/.test(printText) && /Behavior/.test(printText), 'with the reasons on it');

// A per-student print goes through the same builder.
await page.click('#rosterList [data-print-student="Ben Marsh"]');
await settle(page, 250);
const benPrint = await page.textContent('#printArea');
ok(/Ben Marsh — Contact History/.test(benPrint), 'the per-student print still works');
ok(/Attendance/.test(benPrint) && /Behavior/.test(benPrint), 'and carries reasons too');
ok(!/Ada Okonkwo/.test(benPrint), 'without leaking another student into it');

/* ── the CSV header ────────────────────────────────────────────────────── */
ok(await page.evaluate(() => document.documentElement.innerHTML.includes("'Method', 'Reason', 'Outcome'")),
   'the CSV export gained a Reason column');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
