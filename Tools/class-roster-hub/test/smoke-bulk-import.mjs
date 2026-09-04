// smoke-bulk-import.mjs — Class Roster Hub's bulk import: many files at once, a
// real .xlsx, splitting one timetable export into a roster per class, and the
// diff that says what an import is about to do.
//
//   node Tools/class-roster-hub/test/smoke-bulk-import.mjs
//
// Path 3 P2. Before this, 006 could EXPORT xlsx and not read one, and a
// six-period gradebook export had to be imported six times by hand — pasting a
// filtered column each time. The three things under test are the three the
// backlog asked for, and each is checked by reading np_rosters back out rather
// than by trusting the dialog's own summary text.
//
// The xlsx fixture is built in the browser with the page's own vendored
// SheetJS, so the test never ships a binary and never asserts against a file
// somebody would have to regenerate.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8408;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const rostersOnDisk = page => page.evaluate(() => {
  const raw = localStorage.getItem('np_rosters');
  return raw === null ? null : JSON.parse(raw);
});

async function open(seed) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
  if (seed) {
    await page.addInitScript(s => localStorage.setItem('np_rosters', JSON.stringify(s)), seed);
  }
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await settle(page, 400);
  return page;
}

/** Hand the page real File objects, the way a picker or a drop would. */
async function dropFiles(page, files) {
  await page.setInputFiles('#csvFileInput', files.map(f => ({
    name: f.name,
    mimeType: f.mime || 'text/csv',
    buffer: Buffer.from(f.body),
  })));
  await settle(page, 700);
}

console.log('Class Roster Hub — bulk import, xlsx, split and diff');

/* ── 1. Split one timetable export into a roster per class ─────────────── */
{
  const page = await open();
  const csv = [
    'Student ID,Last,First,Period',
    '1001,Lovelace,Ada,3',
    '1002,Hopper,Grace,3',
    '1003,Bly,Nellie,5',
    '1004,Curie,Marie,5',
    '1005,Franklin,Rosalind,5',
  ].join('\n');
  await dropFiles(page, [{ name: 'timetable.csv', body: csv }]);

  ok(!(await page.locator('#importOverlay').isHidden()), '1: the mapping dialog opens');
  ok(!(await page.locator('#splitHint').isHidden()),
    '1: a Period column is noticed, and the page says so');

  // header on, name split across Last + First, then split by Period
  await page.check('#importHasHeader');
  await page.selectOption('#mapMode', 'two');
  await page.selectOption('#mapFirstCol', '2');
  await page.selectOption('#mapLastCol', '1');
  await page.check('#importSplit');
  await settle(page, 250);

  ok(!(await page.locator('#splitWrap').isHidden()), '1: the split controls appear');
  ok((await page.locator('#importReplaceWrap').isHidden()),
    '1: "replace the current list" is hidden — a split import writes its own rosters');
  eq(await page.locator('#splitCol').inputValue(), '3', '1: the Period column is pre-selected');

  const summary = await page.locator('#importSummary').textContent();
  ok(/5 names across 2 rosters/.test(summary), `1: the summary counts both rosters (got "${summary}")`);

  await page.click('#importConfirmBtn');
  await settle(page, 500);

  const disk = await rostersOnDisk(page);
  eq(Object.keys(disk).sort(), ['Period 3', 'Period 5'], '1: one file became two rosters, named from the column');
  eq(disk['Period 3'], ['Ada Lovelace', 'Grace Hopper'], '1: ...with the right students in each');
  eq(disk['Period 5'], ['Nellie Bly', 'Marie Curie', 'Rosalind Franklin'], '1: ...and the right split');
  eq(page.__errs, [], '1: no console errors');
  await page.close();
}

/* ── 2. The roster-name prefix is the teacher's ────────────────────────── */
{
  const page = await open();
  await dropFiles(page, [{ name: 't.csv', body: 'Name,Block\nAda Lovelace,A\nGrace Hopper,B' }]);
  await page.check('#importHasHeader');
  await page.check('#importSplit');
  await settle(page, 200);
  await page.selectOption('#splitCol', '1');
  await page.fill('#splitPrefix', 'Block {value} — Science');
  await settle(page, 250);
  await page.click('#importConfirmBtn');
  await settle(page, 400);

  eq(Object.keys(await rostersOnDisk(page)).sort(),
    ['Block A — Science', 'Block B — Science'], '2: the prefix template names the rosters');
  await page.close();
}

/* ── 3. A real .xlsx is read — 006 could only write one before ─────────── */
{
  const page = await open();
  // Build a two-sheet workbook with the page's own vendored SheetJS.
  const xlsxBytes = await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = '../_shared/vendor/xlsx/xlsx.full.min.js';
      el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([['Name'], ['Ada Lovelace'], ['Grace Hopper']]), 'Period 1');
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.aoa_to_sheet([['Name'], ['Nellie Bly']]), 'Period 2');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return Array.from(new Uint8Array(out));
  });
  await page.close();

  const page2 = await open();
  await dropFiles(page2, [{
    name: 'classes.xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Uint8Array.from(xlsxBytes),
  }]);

  ok(!(await page2.locator('#importOverlay').isHidden()), '3: an .xlsx opens the mapping dialog');
  const title = await page2.locator('#importTitle').textContent();
  ok(/Period 1/.test(title) && /1 of 2/.test(title),
    `3: each sheet is one table in a batch of two (got "${title}")`);

  await page2.check('#importHasHeader');
  await settle(page2, 200);
  await page2.click('#importConfirmBtn');
  await settle(page2, 500);

  const t2 = await page2.locator('#importTitle').textContent();
  ok(/Period 2/.test(t2), `3: confirming advances to the next sheet (got "${t2}")`);
  await page2.check('#importHasHeader');
  await settle(page2, 200);
  await page2.click('#importConfirmBtn');
  await settle(page2, 500);

  const disk = await rostersOnDisk(page2);
  eq(Object.keys(disk).sort(), ['Period 1', 'Period 2'], '3: each sheet became a roster named after it');
  eq(disk['Period 1'], ['Ada Lovelace', 'Grace Hopper'], '3: with its own students');
  eq(disk['Period 2'], ['Nellie Bly'], '3: and so did the second');
  eq(page2.__errs, [], '3: no console errors reading a workbook');
  await page2.close();
}

/* ── 4. Several files at once ──────────────────────────────────────────── */
{
  const page = await open();
  await dropFiles(page, [
    { name: 'period-3.csv', body: 'Name\nAda Lovelace' },
    { name: 'period-5.csv', body: 'Name\nNellie Bly' },
  ]);
  ok(/1 of 2/.test(await page.locator('#importTitle').textContent()), '4: a two-file batch says where it is');
  await page.check('#importHasHeader');
  await settle(page, 150);
  await page.click('#importConfirmBtn');
  await settle(page, 400);
  await page.check('#importHasHeader');
  await settle(page, 150);
  await page.click('#importConfirmBtn');
  await settle(page, 400);

  eq(Object.keys(await rostersOnDisk(page)).sort(), ['period-3', 'period-5'],
    '4: each file became a roster named after it');
  await page.close();
}

/* ── 5. Cancelling one file of a batch abandons the batch ──────────────── */
{
  const page = await open();
  await dropFiles(page, [
    { name: 'a.csv', body: 'Name\nAda Lovelace' },
    { name: 'b.csv', body: 'Name\nNellie Bly' },
  ]);
  await page.click('#importCancelBtn');
  await settle(page, 400);
  ok(await page.locator('#importOverlay').isHidden(),
    '5: cancelling file 1 of 2 does not go on to file 2');
  eq(await rostersOnDisk(page), null, '5: ...and wrote nothing');
  await page.close();
}

/* ── 6. The diff says what an import will do to an existing roster ─────── */
{
  const page = await open({ 'Period 3': ['Ada Lovelace', 'Grace Hopper', 'Nellie Bly'] });
  await page.selectOption('#rosterSwitch', 'Period 3');
  await settle(page, 300);

  // A fresh export: Nellie has left, Marie has joined, and the gradebook now
  // writes "Last, First". Flip is turned OFF so the comma form really reaches
  // the diff — this is what exercises the rename matching rather than the
  // rewrite that would paper over it.
  await dropFiles(page, [{ name: 'p3.csv', body: 'Name\nLovelace, Ada\nHopper, Grace\nCurie, Marie' }]);
  await page.check('#importHasHeader');
  await page.uncheck('#importFlip');
  await page.check('#importReplace');
  await settle(page, 300);

  const diff = await page.locator('#importDiffWrap').textContent();
  ok(/1 new/.test(diff), `6: the new student is counted (got "${diff}")`);
  ok(/1 no longer on it/.test(diff), '6: the departed student is counted');
  ok(/2 renamed/.test(diff), '6: the two who only changed spelling are renames');
  ok(!/3 new/.test(diff), '6: a "Last, First" rewrite is NOT read as three new students');
  /* Pinned in full, because a regex over fragments let "3 news" and "0
     unchangeds" through once — plural() was being handed adjectives. */
  eq(diff, 'What this changes:Period 3 — 1 new, 1 no longer on it, 2 renamed, 0 unchanged',
    '6: the whole readout, worded like English');
  await page.close();
}

/* ── 7. With the flip on, the same file is a no-op, and says so ────────── */
{
  // The default path. "Lovelace, Ada" is rewritten to "Ada Lovelace" before the
  // diff sees it, so re-importing a roster that has not changed reports no
  // change — not 2 renames, and certainly not 2 new + 2 left.
  const page = await open({ 'P': ['Ada Lovelace', 'Grace Hopper'] });
  await page.selectOption('#rosterSwitch', 'P');
  await settle(page, 300);
  await dropFiles(page, [{ name: 'p.csv', body: 'Name\nLovelace, Ada\nHopper, Grace' }]);
  await page.check('#importHasHeader');
  await page.check('#importReplace');
  await settle(page, 300);

  const diff = await page.locator('#importDiffWrap').textContent();
  ok(/no change/.test(diff), `7: re-importing an unchanged roster says so (got "${diff}")`);
  ok(!/new/.test(diff) && !/no longer/.test(diff), '7: nothing is new and nobody left');
  await page.close();
}

/* ── 8. How a roster arrived is recorded on the sidecar, not a new key ─── */
{
  const page = await open();
  const before = await page.evaluate(() => Object.keys(localStorage).sort());
  await dropFiles(page, [{ name: 't.csv', body: 'Name,Period\nAda Lovelace,3' }]);
  await page.check('#importHasHeader');
  await page.check('#importSplit');
  await settle(page, 250);
  await page.click('#importConfirmBtn');
  await settle(page, 500);

  const meta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('crh_students_v1')).rosters['Period 3'].meta);
  eq(meta.source, 'csv', '8: the source is recorded on the existing sidecar meta');
  ok(typeof meta.importedAt === 'number' && meta.importedAt > 0, '8: ...with when');

  const after = await page.evaluate(() => Object.keys(localStorage).sort());
  const added = after.filter(k => !before.includes(k));
  eq(added.sort(), ['crh_students_v1', 'np_rosters'],
    '8: no new localStorage key was invented for import metadata');
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
