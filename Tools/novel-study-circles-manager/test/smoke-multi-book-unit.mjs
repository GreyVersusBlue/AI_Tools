// smoke-multi-book-unit.mjs — differentiated circles, four books, one view.
//
//   node Tools/novel-study-circles-manager/test/smoke-multi-book-unit.mjs
//
// The tool's core model is one project per book (its own roster split, its
// own reading schedule, its own pace). The real-world shape this row asks
// for — four circles reading four different books at four different paces —
// is expressed here as a "unit": a small, separate, additive record that
// only ever *references* existing projects by name and never reshapes their
// storage. What this suite holds down:
//
//   A unit groups two independently-paced book projects — one with a
//   Reading Schedule Planner row landing on a date, one with an actual
//   meeting logged on that date — and the combined view correctly tells
//   "planned" apart from "already met" for each, on a single chosen date.
//
//   A date neither project is meeting on shows 0 of N, not a stale count.
//
//   Renaming a project the unit references keeps the reference intact (no
//   silent drop) — the checked box and the combined-view card follow the
//   new name.
//
//   Deleting a project removes it from the unit's own stored record too,
//   so a stale reference can't resurface after a reload.
//
//   Deleting a unit never touches the book projects it referenced — they
//   stay switchable in the ordinary Project dropdown.
//
//   The unit itself (its name and which projects it references) survives a
//   reload via its own localStorage keys, independent of the per-project
//   'novel-study-circles' store — the combined-view date field resets to
//   today on reopening, same as the "Log a Meeting" date field already does
//   per project, rather than pinning a stale date from last time.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8213;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/027-novel-study-circles-manager.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });

console.log('Novel Study / Reading Circles Manager — multi-book unit + combined meeting-day view');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 200);

/* ── helpers ──────────────────────────────────────────────────────────── */

async function renameCurrentProject(name) {
  await page.fill('#projectName', name);
  await page.locator('#projectName').blur();
  await settle(page);
}

async function promptDialog(value, action) {
  page.once('dialog', d => d.accept(value));
  await action();
  await settle(page);
}

async function confirmDialog(accept, action) {
  page.once('dialog', d => (accept ? d.accept() : d.dismiss()));
  await action();
  await settle(page);
}

const combinedRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#unitCombinedView .group-card')).map(c => ({
    title: c.querySelector('h3').textContent,
    status: c.querySelector('.unit-status') ? c.querySelector('.unit-status').textContent : null,
    groupCount: c.querySelectorAll('ul > li').length,
  })));

const summary = () => page.textContent('#unitCombinedSummary').catch(() => null);

async function checkUnitProject(name, checked) {
  const box = page.locator(`#unitProjectList input[data-unit-project="${name}"]`);
  const isChecked = await box.isChecked();
  if (isChecked !== checked) await box.click();
  await settle(page);
}

/* ── 1. Project A: Circle A / The Giver, with a reading schedule ────────── */

await renameCurrentProject('Circle A');
await page.fill('#bookTitle', 'The Giver');
await page.fill('#namesInput', ['Alice', 'Ben', 'Cara', 'Deja', 'Eli', 'Fay', 'Gus', 'Hana'].join('\n'));
await settle(page, 150);
await page.click('#splitBtn');
await settle(page);

await page.fill('#schTotalChapters', '5');
await page.fill('#schStartDate', '2026-08-17');
await page.fill('#schEndDate', '2026-08-17'); // Monday — a single-row schedule landing exactly on 2026-08-17
await page.click('#scheduleGenBtn');
await settle(page);
ok(await page.isVisible('#printScheduleBtn'), 'Circle A: a schedule row was generated');

/* ── 2. Project B: Circle B / Number the Stars, with a logged meeting ───── */

await promptDialog('Circle B', () => page.click('#newProjectBtn'));
await page.fill('#bookTitle', 'Number the Stars');
await page.fill('#namesInput', ['Ivy', 'Jax', 'Kira', 'Leo'].join('\n'));
await settle(page, 150);
await page.click('#splitBtn');
await settle(page);

await page.fill('#meetingDate', '2026-08-17');
await page.fill('#cpWhole', 'Through Chapter 3');
await page.click('#logMeetingBtn');
await settle(page);
ok((await page.textContent('#resultsArea')).includes('2026-08-17'), 'Circle B: meeting logged for 2026-08-17');

/* ── 3. group two independently-paced books under one unit ──────────────── */

await promptDialog('Book Clubs — 4th Period', () => page.click('#newUnitBtn'));
ok(await page.isVisible('#unitBody'), 'unit body appears once a unit exists');

await checkUnitProject('Circle A', true);
await checkUnitProject('Circle B', true);
await page.fill('#unitDate', '2026-08-17');
await settle(page);

let rows = await combinedRows();
eq(rows.length, 2, 'both circles show up in the combined view');
eq(await summary(), '2 of 2 circles meeting on 2026-08-17', 'the summary line counts both as meeting');
const a = rows.find(r => r.title.startsWith('Circle A'));
const b = rows.find(r => r.title.startsWith('Circle B'));
ok(!!a && /Planned: Through Chapters 1-5/.test(a.status), `Circle A reads as planned from its own schedule: ${JSON.stringify(a)}`);
ok(!!b && /Meeting logged.*Through Chapter 3/.test(b.status), `Circle B reads as an actually-logged meeting: ${JSON.stringify(b)}`);
eq(a.groupCount, 4, 'Circle A shows its 4 reading-circle groups');
eq(b.groupCount, 4, 'Circle B (4 students, default "4 groups" split) shows its 4 groups');

/* ── 4. a date neither book is meeting on ────────────────────────────────── */

await page.fill('#unitDate', '2026-08-18');
await settle(page);
eq(await summary(), '0 of 2 circles meeting on 2026-08-18', 'an off-day correctly reads as zero, not stale');
rows = await combinedRows();
ok(rows.every(r => r.status === 'Not meeting this date'), 'neither circle is flagged as meeting on the off-day');

await page.fill('#unitDate', '2026-08-17');
await settle(page);

/* ── 5. renaming a member project keeps the unit's reference intact ─────── */

await page.selectOption('#projectSwitch', 'Circle A');
await settle(page);
await renameCurrentProject('The Giver Circle');
ok(await page.isChecked('#unitProjectList input[data-unit-project="The Giver Circle"]'), 'the renamed project is still checked in the unit list');
ok(!(await page.locator('#unitProjectList input[data-unit-project="Circle A"]').count()), 'the old name is gone from the checklist, not duplicated');
rows = await combinedRows();
ok(rows.some(r => r.title.startsWith('The Giver Circle') && /Planned/.test(r.status)), 'the combined view follows the rename, keeping its planned status');

/* ── 6. deleting a member project drops it from the unit, not just the view ─ */

await page.selectOption('#projectSwitch', 'Circle B');
await settle(page);
await confirmDialog(true, () => page.click('#deleteProjectBtn'));
rows = await combinedRows();
eq(rows.length, 1, 'the combined view drops the deleted project');
eq(await summary(), '1 of 1 circle meeting on 2026-08-17', 'and the summary recomputes for the remaining circle');

/* ── 7. persistence across reload (own storage, independent of projects) ─── */

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#unitName'), 'Book Clubs — 4th Period', 'the unit itself survives a reload');
ok(await page.inputValue('#unitDate'), 'the date field defaults back to today rather than staying empty');
rows = await combinedRows();
eq(rows.length, 1, 'and the (already-pruned) project reference list survives correctly');

/* ── 8. deleting the unit never touches its member projects ─────────────── */

await confirmDialog(true, () => page.click('#deleteUnitBtn'));
ok(!(await page.isVisible('#unitBody')), 'the unit body hides once the unit is gone');
const projectOptions = await page.$$eval('#projectSwitch option', opts => opts.map(o => o.value));
ok(projectOptions.includes('The Giver Circle'), 'the book project the unit referenced still exists on its own: ' + JSON.stringify(projectOptions));

/* ── 9. no console noise anywhere in the run ─────────────────────────────── */

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
