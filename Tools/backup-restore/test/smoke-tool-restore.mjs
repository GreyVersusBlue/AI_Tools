// smoke-tool-restore.mjs — "Restore from a backup" inside a tool (Path 4 P5):
// the shared card from _shared/restore-kit.js, on 001 Hall Pass and 008
// Behavior & Points.
//
//   node Tools/backup-restore/test/smoke-tool-restore.mjs
//
// What it holds, through the real page:
//   - the preview names what changes, record by record, before anything is
//     written, and the three modes change those numbers;
//   - Restore writes only the tool's own keys: the Name Picker's rosters and
//     another tool's sections in the same file are left alone;
//   - the page reloads and shows the restored section;
//   - a locked file is opened with the passphrase (the unlock code is fetched
//     only then), a wrong passphrase writes nothing;
//   - a file with nothing for this tool says so and writes nothing;
//   - the card has no serious axe violation.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8531;
const BASE = `http://127.0.0.1:${PORT}`;
const HALL = BASE + '/Tools/001-hall-pass-log.html';
const BPT = BASE + '/Tools/008-behavior-points-tracker.html';
const BR = BASE + '/Tools/009-backup-restore.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 1000 });

function section(name, names) {
  return { name, namesText: names.join('\n'), destinations: [], outNow: [], log: [], history: [] };
}
const HERE = { current: 'Period 3', sets: { 'Period 1': section('Period 1', ['Ada Lovelace']), 'Period 3': section('Period 3', ['Nellie Bly']) } };
const FILE = { current: 'Period 1', sets: { 'Period 1': section('Period 1', ['Ada Lovelace', 'Marco Polo']), 'Period 2': section('Period 2', ['Zheng He']) } };
const ROSTERS = JSON.stringify({ 'Period 9': ['Kept Here'] });

const envelope = {
  source: 'AsPerMyLessonPlan.com Backup & Restore', format: 'aspermylessonplan-backup', formatVersion: 2,
  exportedAt: '2026-10-01T15:00:00.000Z',
  data: {
    'hall-pass-log-sections': JSON.stringify(FILE),
    'np_rosters': JSON.stringify({ 'Period 1': ['From The File'] }),
    'behavior-points-tracker-sections': JSON.stringify({ current: 'X', sets: { X: { name: 'X' } } }),
  },
};
const asFile = (obj, name = 'toolkit-backup.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
const stored = () => page.evaluate(() => ({
  hall: localStorage.getItem('hall-pass-log-sections'),
  rosters: localStorage.getItem('np_rosters'),
  bpt: localStorage.getItem('behavior-points-tracker-sections'),
}));
const summary = () => page.textContent('#toolRestore .rk-summary');
const statusText = () => page.textContent('#toolRestore .rk-status');

async function seedHall() {
  await page.goto(HALL, { waitUntil: 'networkidle' });
  await page.evaluate(({ here, rosters }) => {
    localStorage.clear();
    localStorage.setItem('hall-pass-log-sections', JSON.stringify(here));
    localStorage.setItem('np_rosters', rosters);
  }, { here: HERE, rosters: ROSTERS });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
}

console.log('Per-tool restore — 001 Hall Pass and 008 Behavior & Points');

/* ── 1. the preview, before anything is written ───────────────────────── */
await seedHall();
const before = await stored();
ok(await page.isVisible('#toolRestore input[type=file]'), '001 shows the restore card');
await page.setInputFiles('#toolRestore input[type=file]', asFile(envelope));
await settle(page, 400);
ok(await page.isVisible('#toolRestore .rk-preview'), 'a valid backup opens the preview');
const rep = await summary();
ok(/1 replaced/.test(rep) && /1 added/.test(rep), 'Replace: one section replaced, one added — ' + JSON.stringify(rep));
ok(/1 record that exist only on this computer would be removed/.test(rep), 'Replace: the section only here is called out');
ok(/other 2 items belong to other tools and are left alone/.test(rep), 'the other tools\' items are named as left alone');
const row = await page.textContent('#toolRestore .rk-list li');
ok(/Period 2/.test(row) && /Period 3/.test(row) && /here only, would be removed/.test(row), 'the row names the sections: ' + JSON.stringify(row));
eq(await page.locator('#toolRestore .rk-list li').count(), 1, 'only this tool\'s data is listed');
eq(await stored(), before, 'nothing is written by opening the file');

await page.check('#toolRestore input[value="merge"]');
await settle(page, 150);
const merge = await summary();
ok(/1 replaced/.test(merge) && !/would be removed/.test(merge), 'Combine: nothing would be removed — ' + JSON.stringify(merge));

/* ── 2. Restore writes only this tool's key, then the page reloads ────── */
const reloaded = page.waitForNavigation({ waitUntil: 'networkidle' });
await page.click('#toolRestore .rk-restore');
await settle(page, 100);
ok(/Restored 1 item/.test(await statusText()), 'the card says what it restored');
await reloaded;
await settle(page, 300);
const after = await stored();
const hall = JSON.parse(after.hall);
eq(Object.keys(hall.sets).sort(), ['Period 1', 'Period 2', 'Period 3'], 'Combine kept the local section and added the new one');
eq(hall.sets['Period 1'].namesText, 'Ada Lovelace\nMarco Polo', 'and took the file\'s copy of the clash');
eq(after.rosters, ROSTERS, 'the Name Picker\'s rosters are untouched');
eq(after.bpt, null, 'Behavior & Points\' sections were not created from the same file');
const options = await page.$$eval('#setSwitch option', os => os.map(o => o.textContent));
ok(options.includes('Period 2'), 'after the reload the tool lists the restored section: ' + JSON.stringify(options));

/* ── 3. a locked file: wrong passphrase writes nothing, right one works ─ */
const lockPage = await prepPage(browser, BASE, { width: 900, height: 700 });
await lockPage.goto(BR, { waitUntil: 'networkidle' });
const locked = await lockPage.evaluate(env => window.BrCrypto.encrypt(JSON.stringify(env), 'correct horse', {
  source: env.source, format: env.format, formatVersion: env.formatVersion, exportedAt: env.exportedAt,
}), envelope);
await lockPage.close();

await seedHall();
/* The tool fills in and re-saves its current section on load, so "nothing
   was written" compares with what is stored after the page settled. */
const settled = (await stored()).hall;
eq(await page.evaluate(() => typeof window.BrCrypto), 'undefined', 'the tool page does not load the unlock code up front');
await page.setInputFiles('#toolRestore input[type=file]', asFile(locked, 'locked.json'));
await settle(page, 300);
ok(await page.isVisible('#toolRestore .rk-unlock'), 'a locked file asks for its passphrase');
ok(!(await page.isVisible('#toolRestore .rk-preview')), 'and shows no preview yet');
await page.fill('#toolRestore input[type=password]', 'wrong');
await page.click('#toolRestore .rk-unlock button[type=submit]');
await page.waitForFunction(() => /passphrase does not open/.test(document.querySelector('#toolRestore .rk-status').textContent), null, { timeout: 30000 });
ok(true, 'a wrong passphrase is refused');
eq((await stored()).hall, settled, 'and nothing was written');
await page.fill('#toolRestore input[type=password]', 'correct horse');
await page.click('#toolRestore .rk-unlock button[type=submit]');
await page.waitForSelector('#toolRestore .rk-preview:not([hidden])', { timeout: 30000 });
ok(/1 replaced/.test(await summary()), 'the right passphrase opens the same preview');
eq(await page.evaluate(() => typeof window.BrCrypto), 'object', 'the unlock code was fetched when it was needed');

const axe = await a11yScan(page, { include: '#toolRestore' });
eq(axe.map(v => v.id), [], 'the open card has no serious axe violation');

await page.click('#toolRestore .rk-cancel');
await settle(page, 150);
ok(!(await page.isVisible('#toolRestore .rk-preview')), 'Cancel closes the preview');
eq((await stored()).hall, settled, 'and nothing was written');

/* ── 4. 008: a file with nothing for it, then Replace ─────────────────── */
await page.goto(BPT, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('behavior-points-tracker-sections', JSON.stringify({ current: 'Old', sets: { Old: { name: 'Old' } } }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
const bptBefore = await page.evaluate(() => localStorage.getItem('behavior-points-tracker-sections'));
await page.setInputFiles('#toolRestore input[type=file]', asFile({ formatVersion: 2, data: { np_rosters: '{}' } }));
await settle(page, 300);
ok(/holds nothing from Behavior/.test(await statusText()), '008: a file with nothing for it says so — ' + JSON.stringify(await statusText()));
ok(!(await page.isVisible('#toolRestore .rk-preview')), '008: and opens no preview');

await page.setInputFiles('#toolRestore input[type=file]', asFile(envelope));
await settle(page, 300);
ok(/1 replaced/.test(await summary()) || /replaced/.test(await summary()), '008: its own key is previewed — ' + JSON.stringify(await summary()));
eq(await page.evaluate(() => localStorage.getItem('behavior-points-tracker-sections')), bptBefore, '008: nothing written by the preview');
await page.uncheck('#toolRestore .rk-list input');
await page.click('#toolRestore .rk-restore');
await settle(page, 150);
ok(/Check at least one row/.test(await statusText()), '008: an unticked row restores nothing');
await page.check('#toolRestore .rk-list input');
const reloaded2 = page.waitForNavigation({ waitUntil: 'networkidle' });
await page.click('#toolRestore .rk-restore');
await reloaded2;
await settle(page, 300);
const bptAfter = await page.evaluate(() => ({ s: localStorage.getItem('behavior-points-tracker-sections'), h: localStorage.getItem('hall-pass-log-sections') }));
/* 008 fills in the restored section's defaults when it loads it, so the
   check is the shape Replace leaves, not the bytes. */
const bptSets = JSON.parse(bptAfter.s).sets;
eq(Object.keys(bptSets), ['X'], '008: Replace wrote the file\'s sections in place of the old one');
eq(bptAfter.h, null, '008: Hall Pass\'s key in the same file was not written');

/* ── 5. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
