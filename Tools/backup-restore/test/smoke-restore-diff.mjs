// smoke-restore-diff.mjs — the Backup & Restore preview's record-level diff.
//
//   node Tools/backup-restore/test/smoke-restore-diff.mjs
//
// The preview used to answer "how many files will be overwritten", which is
// the wrong unit: a teacher doesn't have one file called np_rosters, they have
// six rosters, and what they need before pressing Restore is which of the six
// the backup replaces, which it adds, and which it leaves alone.
//
// The case that matters most is the one that was completely invisible:
// "Replace" writes the file's value over the whole key, so a roster that
// exists only on this computer and is absent from the backup is destroyed. The
// preview now says so, and switching modes has to change the numbers, because
// that difference is the whole reason the modes exist.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8159;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/009-backup-restore.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });

/* On this computer: four rosters. In the backup: three — one identical, one
   changed, one new. "Period 4 — Physics" and "Period 6 — Astronomy" exist only
   here, and are the records a Replace silently destroys. */
const ON_DISK = {
  'Period 1 — Geology': ['Ada Lovelace', 'Marco Polo'],
  'Period 3 — Earth Science': ['Nellie Bly'],
  'Period 4 — Physics': ['Zheng He'],
  'Period 6 — Astronomy': ['Grace Hopper', 'Alan Turing'],
};
const IN_BACKUP = {
  'Period 1 — Geology': ['Ada Lovelace', 'Marco Polo'],          // identical → untouched
  'Period 3 — Earth Science': ['Nellie Bly', 'Sojourner Truth'], // differs → replaced
  'Period 5 — Chemistry': ['Ida B Wells'],                       // new → added
};

const summary = () => page.textContent('#previewSummary');
const rows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#previewList li')).map(li => li.textContent.trim()));

async function pickMode(value) {
  await page.check(`input[name="restoreMode"][value="${value}"]`);
  await settle(page, 200);
}

console.log('Backup & Restore — record-level restore preview');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── seed this computer, then hand the page a backup file ───────────────── */
await page.evaluate(disk => { localStorage.setItem('np_rosters', JSON.stringify(disk)); }, ON_DISK);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

const envelope = {
  format: 'aspermylessonplan-backup',
  version: 2,
  exportedAt: new Date().toISOString(),
  data: { np_rosters: JSON.stringify(IN_BACKUP) },
};
await page.setInputFiles('#fileInput', {
  name: 'toolkit-backup.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(envelope)),
});
await settle(page, 500);

ok(await page.isVisible('#previewList'), 'the preview opens for a valid backup');

/* ── 1. Replace: one replaced, one added, one untouched, one destroyed ─── */
await pickMode('replace');
const rep = await summary();
ok(/1 replaced/.test(rep), 'Replace: one roster is replaced — ' + JSON.stringify(rep));
ok(/1 added/.test(rep), 'Replace: one roster is added');
ok(/1 untouched/.test(rep), 'Replace: the identical roster is untouched');
ok(/2 records that exist only on this computer would be removed/.test(rep),
   'Replace: both rosters that exist only here are called out as being removed');

const repRow = (await rows())[0];
ok(/Period 3 — Earth Science/.test(repRow), 'the row names the roster being replaced: ' + JSON.stringify(repRow));
ok(/Period 5 — Chemistry/.test(repRow), 'and the one being added');
ok(/Period 6 — Astronomy/.test(repRow), 'and the one that would be removed');
ok(/here only, would be removed/.test(repRow), 'in those words');

/* ── 2. Add only what is missing: nothing is replaced, nothing is lost ─── */
await pickMode('fill');
const fill = await summary();
ok(/0 replaced/.test(fill), 'Add-only: nothing is replaced — ' + JSON.stringify(fill));
ok(/1 added/.test(fill), 'Add-only: the new roster still arrives');
ok(/4 untouched/.test(fill), 'Add-only: all four rosters already here are untouched');
ok(!/would be removed/.test(fill), 'Add-only: nothing is removed');

/* ── 3. Combine, file wins: replaces the clash but keeps the local-only ── */
await pickMode('merge');
const merge = await summary();
ok(/1 replaced/.test(merge), 'Combine: the clashing roster takes the file\'s copy — ' + JSON.stringify(merge));
ok(/1 added/.test(merge), 'Combine: the new roster arrives');
ok(/3 untouched/.test(merge), 'Combine: the identical roster and both local-only ones are left alone');
ok(!/would be removed/.test(merge), 'Combine: nothing is removed');

/* ── 4. switching modes must not silently re-tick an excluded row ──────── */
await page.uncheck('.restore-grp-check');
await pickMode('replace');
eq(await page.isChecked('.restore-grp-check'), false, 'a row the teacher excluded stays excluded across a mode change');
await page.check('.restore-grp-check');

/* ── 5. the numbers are the truth: restore and compare ─────────────────── */
await pickMode('merge');
await page.click('#restoreBtn');
await settle(page, 600);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')));
eq(Object.keys(after).sort().join('|'),
   'Period 1 — Geology|Period 3 — Earth Science|Period 4 — Physics|Period 5 — Chemistry|Period 6 — Astronomy',
   'Combine really did add one and keep the local-only rosters');
eq(after['Period 3 — Earth Science'].join(','), 'Nellie Bly,Sojourner Truth', 'and really did take the file\'s copy of the clash');

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
