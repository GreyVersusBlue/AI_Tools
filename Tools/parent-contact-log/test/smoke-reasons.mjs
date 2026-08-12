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


/* ── the tally above the history ───────────────────────────────────────────
   "How many of my contacts home were good news" is a number a teacher keeps
   roughly in their head and is sometimes asked for out loud. A log that only
   ever records problems is exactly what this makes visible, so the count has
   to be of what is on screen — this student, this month, this method — and
   not of the whole log, or it answers a question nobody asked. */
const tally = (p = page) => p.evaluate(() => {
  const box = document.getElementById('tallyBox');
  const labels = [...box.querySelectorAll('.tally-label')].map(e => e.textContent);
  const counts = [...box.querySelectorAll('.tally-n')].map(e => Number(e.textContent));
  return {
    head: (box.querySelector('.tally-total') || {}).textContent || '',
    good: (box.querySelector('.tally-good') || {}).textContent || '',
    rows: labels.map((l, i) => [l, counts[i]]),
    empty: !!box.querySelector('.tally-empty'),
  };
});

await page.selectOption('#filterReason', '');
await page.fill('#filterStudent', '');
await settle(page, 300);

const before = await tally();
ok(before.rows.length > 0, 'the tally has something in it once contacts are logged');
ok(/contacts shown/.test(before.head), 'it says how many it is counting: ' + before.head);

/* Most-used reason first, so the shape of the term is readable at a glance. */
const tallyCounts = before.rows.map(r => r[1]);
ok(tallyCounts.every((n, i) => i === 0 || tallyCounts[i - 1] >= n),
   'reasons are ordered most-used first: ' + JSON.stringify(before.rows));
eq(tallyCounts.reduce((a, b) => a + b, 0), (await rows()).length,
   'and the counts add up to exactly the rows underneath');

/* The positive count is pulled out of the list and stated separately, because
   it is the one line anybody is looking for; as one bar among seven it would
   be buried. */
ok(/good news/.test(before.good), 'good news is called out on its own line: ' + before.good);
const positiveRow = before.rows.filter(r => r[0] === 'Positive news')[0];
ok(positiveRow, 'and still appears in the breakdown itself');
ok(before.good.indexOf(String(positiveRow[1])) !== -1,
   'with the same number in both places (' + before.good + ' vs ' + positiveRow[1] + ')');
ok(/%/.test(before.good), 'expressed as a share as well as a count — "1" means nothing without "of 4"');

/* ── it follows the filters, which is the whole point ──────────────────── */
await page.selectOption('#filterReason', 'Positive news');
await settle(page, 300);
const filtered = await tally();
eq(filtered.rows.length, 1, 'filtering to one reason leaves one row in the tally');
eq(filtered.rows[0][0], 'Positive news', 'and it is that reason');
ok(/100%/.test(filtered.good), 'which is now all of what is shown: ' + filtered.good);

await page.selectOption('#filterReason', '');
await settle(page, 200);
await page.fill('#filterStudent', 'zzz-nobody');
await settle(page, 300);
const none = await tally();
ok(none.empty, 'a filter that matches nothing says so rather than dividing by zero');
await page.fill('#filterStudent', '');
await settle(page, 300);

/* ── a log with no good news says so plainly ───────────────────────────── */
/* The uncomfortable case is the one worth getting right: a teacher whose term
   has been all attendance and missing work should see that stated, not an
   absent line they can read past. */
const grim = await prepPage(browser, BASE, { width: 1200, height: 900 });
await grim.addInitScript(() => {
  localStorage.setItem('pcl_roster_v1', JSON.stringify(['Sable Whitfield']));
  localStorage.setItem('pcl_entries_v1', JSON.stringify([
    { id: 'g1', student: 'Sable Whitfield', date: '2026-02-01', method: 'Phone call', reason: 'Attendance', initials: 'DM', outcome: 'Fourth absence' },
    { id: 'g2', student: 'Sable Whitfield', date: '2026-02-02', method: 'Email', reason: 'Behavior', initials: 'DM', outcome: 'Phone out in class' },
    // No reason at all — an entry logged before the reason axis existed.
    { id: 'g3', student: 'Sable Whitfield', date: '2026-01-05', method: 'Phone call', initials: 'DM', outcome: 'Introduced myself' },
  ]));
});
await grim.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(grim, 400);
const grimTally = await tally(grim);
ok(/None of them good news yet/.test(grimTally.good),
   'a log with nothing positive in it says so rather than leaving the line off: ' + grimTally.good);
eq(grimTally.rows.length, 3, 'and the rest of the breakdown is still drawn');
ok(grimTally.rows.some(r => r[0] === '(not recorded)'),
   'an entry logged before the reason axis existed is counted under its own heading rather than dropped out of the total: ' + JSON.stringify(grimTally.rows));
eq(grimTally.rows.reduce((n, r) => n + r[1], 0), 3, 'so the breakdown still adds up to the whole list');

/* ── announced, not just drawn ─────────────────────────────────────────── */
eq(await page.getAttribute('#tallyBox', 'aria-live'), 'polite',
   'the tally is announced when the filters change it');
/* A bare span is inline and ignores width, so a bar with no display:block
   renders as an empty track — visibly a bug, and one this caught once. */
ok(await page.evaluate(() => {
  const fill = document.querySelector('#tallyBox .tally-fill');
  return !!fill && fill.getBoundingClientRect().width > 0;
}), 'the bars actually have width rather than being empty tracks');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['main', page], ['no-good-news', grim]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
