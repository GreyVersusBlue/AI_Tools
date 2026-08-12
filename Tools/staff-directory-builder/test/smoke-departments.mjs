// smoke-departments.mjs — grouping the staff directory by department.
//
//   node Tools/staff-directory-builder/test/smoke-departments.mjs
//
// The printed directory is the deliverable here: it goes on the workroom wall
// and into a new teacher's binder. One flat alphabetical list is the wrong
// shape for both — "who do I ask about a Science thing" means reading
// forty-one rows — and the grouping that fixes it has three places it can be
// quietly wrong: the people with no department at all (dropped, and nobody
// notices until a substitute has no phone number), the department typed with
// two different capitalisations a year apart (split into two blocks, which is
// a worse answer than not grouping), and the print path, which is a separate
// renderer from the screen and is the one that actually matters.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8196;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/075-staff-directory-builder.html';
const STORE_KEY = 'sdb_directory_v1';
const PREFS_KEY = 'sdb_prefs_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

/* "Science" and "science" are one department typed twice. Sable Whitfield has
   no department at all, which is the row most likely to fall off the page. */
const STAFF = [
  ['Marisol Ruiz', '214', '4214', 'Math'],
  ['Devraj Balasubramanian', '118', '4118', 'Science'],
  ['Amaia Etxeberria', '120', '4120', 'science'],
  ['Beckett Hale', '007', '4007', 'Math'],
  ['Sable Whitfield', '101', '4101', ''],
  ['Nadia Okonjo', '212', '4212', 'Social Studies'],
];

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Staff Directory — group by department');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.evaluate(() => { document.querySelector('details.bulk').open = true; });
await page.fill('#bulkInput', STAFF.map(r => r.join('\t')).join('\n'));
await page.click('#bulkAddBtn');
await settle(page, 300);

/** The visible table, row by row: either a department heading or a person. */
const rows = () => page.$$eval('#dirRows tr', els => els.map(tr => tr.classList.contains('dept-head')
  ? { head: tr.querySelector('td').firstChild.textContent.trim(), count: tr.querySelector('.dept-count').textContent.trim() }
  : { person: tr.querySelector('input[data-field="name"]').value }));

/* ── 1. off by default, and the flat list is untouched ─────────────────── */
eq(await page.isChecked('#groupByDeptBox'), false, 'grouping is off by default — the flat list is what this tool always was');
eq((await rows()).filter(r => r.head).length, 0, 'so there are no headings');
eq((await rows()).length, 6, 'and everybody is on one list');

/* ── 2. on, it blocks the table up ─────────────────────────────────────── */
await page.check('#groupByDeptBox');
await settle(page, 250);
const grouped = await rows();
same(grouped.filter(r => r.head).map(r => r.head),
     ['Math', 'Science', 'Social Studies', 'No department listed'],
     'one heading per department, alphabetical, with the unassigned block last');
same(grouped.filter(r => r.head).map(r => r.count),
     ['2 staff', '2 staff', '1 staff', '1 staff'],
     'each heading counts its own block');
eq(grouped.filter(r => r.person).length, 6, 'and nobody is lost on the way into a block');

/* The case-collapse is the point of that "2 staff" under Science. */
const scienceIdx = grouped.findIndex(r => r.head === 'Science');
same(grouped.slice(scienceIdx + 1, scienceIdx + 3).map(r => r.person),
     ['Amaia Etxeberria', 'Devraj Balasubramanian'],
     '"Science" and "science" are one department, not two blocks');
ok(!grouped.some(r => r.head === 'science'),
   'and the heading takes the spelling of whoever was added first, rather than of whoever sorts first');

/* ── 3. the person with no department is visible, not hidden ───────────── */
const noneIdx = grouped.findIndex(r => r.head === 'No department listed');
eq(grouped[noneIdx + 1].person, 'Sable Whitfield',
   'the staff member with a blank Subject column is under a heading of their own, not dropped');

/* ── 4. sorting still applies, inside each block ───────────────────────── */
/* Name ascending is the default, so Math should read Beckett then Marisol. */
const mathIdx = grouped.findIndex(r => r.head === 'Math');
same(grouped.slice(mathIdx + 1, mathIdx + 3).map(r => r.person), ['Beckett Hale', 'Marisol Ruiz'],
     'rows inside a block follow the current sort');
await page.click('table.dir th[data-sort="room"]');
await settle(page, 250);
const byRoom = await rows();
const m2 = byRoom.findIndex(r => r.head === 'Math');
same(byRoom.slice(m2 + 1, m2 + 3).map(r => r.person), ['Beckett Hale', 'Marisol Ruiz'],
     'sorting by room re-sorts within the block (007 before 214), not across the whole table');

/* ── 5. search narrows the blocks rather than fighting them ────────────── */
await page.fill('#searchInput', 'science');
await settle(page, 250);
const searched = await rows();
same(searched.filter(r => r.head).map(r => r.head), ['Science'], 'a search that matches one department leaves one block');
eq(searched.filter(r => r.person).length, 2, 'with only its people');
await page.fill('#searchInput', '');
await settle(page, 250);

/* ── 6. the printed page, which is the actual deliverable ──────────────── */
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await page.click('#printBtn');
await settle(page, 300);
eq(await page.evaluate(() => window.__printed), 1, 'printing goes ahead');
const printed = await page.$$eval('#printTable tbody tr', els => els.map(tr => tr.classList.contains('dept-head')
  ? 'HEAD: ' + tr.querySelector('td').firstChild.textContent.trim()
  : tr.querySelector('td').textContent.trim()));
same(printed.filter(r => r.startsWith('HEAD')),
     ['HEAD: Math', 'HEAD: Science', 'HEAD: Social Studies', 'HEAD: No department listed'],
     'the printed page carries the same blocks — it is a separate renderer and this is the half that matters');
eq(printed.filter(r => !r.startsWith('HEAD')).length, 6, 'with everybody on it');
eq(await page.$$eval('#printTable thead th', els => els.length), 3,
   'the Subject column comes out when grouped — it would repeat the heading on every row');
ok(/in 4 departments/.test(await page.textContent('#printSub')),
   'and the subtitle says how many departments: ' + await page.textContent('#printSub'));

await page.uncheck('#groupByDeptBox');
await settle(page, 200);
await page.click('#printBtn');
await settle(page, 300);
eq(await page.$$eval('#printTable thead th', els => els.length), 4,
   'ungrouped, the Subject column comes back');
eq(await page.$$eval('#printTable tbody tr.dept-head', els => els.length), 0, 'and there are no headings');

/* ── 7. the preference persists, in its own key ────────────────────────── */
await page.check('#groupByDeptBox');
await settle(page, 250);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.isChecked('#groupByDeptBox'), true, 'the choice survives a reload');
eq((await rows()).filter(r => r.head).length, 4, 'and the table comes back grouped');
const dir = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORE_KEY);
ok(Array.isArray(dir), 'the directory key is still the bare array Export JSON and Import both expect');
same(await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), PREFS_KEY), { groupByDept: true },
     'the preference lives in its own key rather than being wrapped around the people');

/* ── 8. an empty directory does not grow phantom headings ──────────────── */
page.once('dialog', d => d.accept());
await page.click('#clearAllBtn');
await settle(page, 300);
eq((await rows()).length, 0, 'clearing everything leaves no rows at all, headings included');
ok(await page.isVisible('#emptyMsg'), 'and the empty message is what shows instead');

/* ── 9. no console noise, nothing left the site ────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
