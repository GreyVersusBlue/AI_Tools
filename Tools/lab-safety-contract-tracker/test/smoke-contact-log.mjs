// smoke-contact-log.mjs — the lab safety tracker's parent-contact follow-up sheet.
//
//   node Tools/lab-safety-contract-tracker/test/smoke-contact-log.mjs
//
// The missing list answers "who hasn't turned it in". This answers the next
// question, which is the one that actually eats a week: who has been chased,
// how, when, and what came of it. It prints as a form to fill in by hand while
// working down the list with a phone in the other hand.
//
// Two things worth pinning:
//
//   1. Nothing on it is stored. Contact notes about a family are the most
//      sensitive thing this tool could hold, and it has no business keeping
//      them in a browser a substitute might sit at. The sheet is paper.
//   2. A row must never split across a page. Half a student's contact history
//      on the next sheet is worse than useless as documentation.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8198;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/013-lab-safety-contract-tracker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const ROSTER = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He'];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

const contactRows = (p) => p.evaluate(() =>
  [...document.querySelectorAll('#printContactBody tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim())));

console.log('Lab Safety Contract Tracker — parent-contact follow-up sheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

await page.fill('#rosterInput', ROSTER.join('\n'));
await page.click('#saveRosterBtn');
await settle(page, 500);

/* ── 1. it lists exactly the students still missing something ──────────── */
// Mark two of the four in, through the tool's own status pills.
// One at a time, re-querying between clicks: marking a student in re-renders
// the whole list, so a NodeList captured up front goes stale after the first.
for (const who of ['Ada Lovelace', 'Zheng He']) {
  await page.evaluate(name => {
    const row = [...document.querySelectorAll('.student-row')]
      .find(r => ((r.querySelector('.s-name') || {}).textContent || '').trim() === name);
    const pill = row && row.querySelector('.status-toggle:not(.is-signed):not(.is-paid)');
    if (pill) pill.click();
  }, who);
  await settle(page, 300);
}
eq(await page.evaluate(() => document.querySelectorAll('.student-row.signed').length), 2,
   'two of the four are marked in before printing');

await page.click('#printContactBtn');
await settle(page, 400);
eq(await page.evaluate(() => window.__printed), 1, 'the button prints');
eq(await page.evaluate(() => document.getElementById('printContactArea').classList.contains('active')), true,
   'switching on the contact log, not one of the other print areas');
eq(await page.evaluate(() => document.getElementById('printMissingArea').classList.contains('active')), false,
   'the missing-list report stays off, so one print job is one thing');

let rows = await contactRows(page);
eq(rows.length, 2, 'a row per student still missing something, and only those');
const names = rows.map(r => r[0]).sort();
eq(JSON.stringify(names), JSON.stringify(['Marco Polo', 'Nellie Bly']),
   'the two who have turned theirs in are not on the chase list');
ok(/Contract|Lab Safety/i.test(rows[0][1]), 'each row names what is still outstanding: ' + rows[0][1]);
ok(/^\d+ of|2 student/.test(await page.textContent('#printContactSub')) || /2 students to follow up/.test(await page.textContent('#printContactSub')),
   'the subheading counts the follow-ups: ' + await page.textContent('#printContactSub'));

/* ── 2. it is a form, not a report ─────────────────────────────────────── */
eq(rows[0].length, 5, 'five columns: student, what is missing, two attempts, outcome');
ok(/call/.test(rows[0][2]) && /email/.test(rows[0][2]) && /note home/.test(rows[0][2]),
   'an attempt column offers the methods to tick: ' + rows[0][2]);
ok(/Date:/.test(rows[0][2]), 'and a date to write in');
eq(rows[0][3], rows[0][2], 'there are two attempt columns, because one attempt is rarely what gets asked about');
eq(rows[0][4], '', 'the outcome column is left blank to write in');
const boxes = await page.evaluate(() =>
  document.querySelectorAll('#printContactBody .attempt-box').length);
eq(boxes, 4, 'two attempt boxes on each of the two rows');

/* ── 3. nothing about the chase is stored ──────────────────────────────── */
const stored = await page.evaluate(() => JSON.stringify(localStorage));
ok(!/attempt|contactLog|outcome/i.test(stored),
   'no contact-log field is written to storage — this sheet is paper on purpose');

/* ── 4. rows never split across a page ─────────────────────────────────── */
await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const printCheck = await page.evaluate(() => {
  const trs = [...document.querySelectorAll('#printContactBody tr')];
  const tds = [...document.querySelectorAll('#printContactBody td')];
  return {
    breaks: trs.map(tr => getComputedStyle(tr).breakInside),
    minHeight: Math.min(...tds.map(td => Math.round(td.getBoundingClientRect().height))),
    visible: getComputedStyle(document.getElementById('printContactArea')).display,
  };
});
ok(printCheck.breaks.every(b => b === 'avoid'),
   'every row is break-inside:avoid: ' + JSON.stringify(printCheck.breaks));
ok(printCheck.minHeight >= 70, `and tall enough to write in (${printCheck.minHeight}px ≈ ${(printCheck.minHeight / 96).toFixed(2)}in)`);
eq(printCheck.visible, 'block', 'the contact log is what actually prints');
await page.emulateMedia({ media: 'screen' });

/* ── 5. a fully-collected class says so instead of printing a blank grid ─ */
for (let i = 0; i < ROSTER.length; i++) {
  await page.evaluate(() => {
    const pill = document.querySelector('.student-row .status-toggle:not(.is-signed):not(.is-paid)');
    if (pill) pill.click();
  });
  await settle(page, 250);
}
eq(await page.evaluate(() => document.querySelectorAll('.student-row.unsigned').length), 0,
   'everyone is marked in for the last check');
await page.click('#printContactBtn');
await settle(page, 400);
rows = await contactRows(page);
eq(rows.length, 1, 'a class with nothing outstanding prints one row');
ok(/nothing to chase/i.test(rows[0][0]), 'saying so in words: ' + rows[0][0]);

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
