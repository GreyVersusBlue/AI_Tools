// smoke-encrypted.mjs — Backup & Restore's optional passphrase lock, and the
// landing page's "saved here · last backup" readout (Path 4 P5).
//
//   node Tools/backup-restore/test/smoke-encrypted.mjs
//
// The lock is only worth having if three things hold: the downloaded file
// really does not contain the student names in any readable form; the right
// passphrase brings back exactly what was saved, through the same preview and
// Restore every other backup goes through; and the wrong one says so without
// writing anything. The readout is checked for its three states: nothing
// saved (hidden), never backed up (flagged), and backed up recently.
//
// Exits 1 on any failure.

import { readFileSync } from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8461;
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

const ROSTERS = { 'Period 2 — Biology': ['Rosalind Franklin', 'Mae Jemison'] };
const PASS = 'correct horse battery';

console.log('Backup & Restore — passphrase-locked backups');

/* ── the landing readout: hidden with nothing saved ─────────────────────── */
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await settle(page, 300);
ok(await page.locator('#backupStatus').isHidden(), 'index: no readout when nothing is saved');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(r => { localStorage.setItem('np_rosters', JSON.stringify(r)); }, ROSTERS);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. the lock's fields are hidden until asked for ────────────────────── */
ok(await page.isVisible('#lockToggle'), 'the passphrase option is offered');
ok(await page.locator('#lockFields').isHidden(), 'its fields stay hidden until it is ticked');
await page.check('#lockToggle');
ok(await page.isVisible('#lockPass'), 'ticking it shows the passphrase fields');

/* ── 2. bad passphrases are refused before anything downloads ───────────── */
await page.fill('#lockPass', 'short');
await page.fill('#lockPass2', 'short');
await page.click('#downloadBtn');
ok(/at least 8/.test(await page.textContent('#dlMsg')), 'a short passphrase is refused');
await page.fill('#lockPass', PASS);
await page.fill('#lockPass2', PASS + 'x');
await page.click('#downloadBtn');
ok(/don.t match/.test(await page.textContent('#dlMsg')), 'a mismatched confirmation is refused');

/* ── 3. the download is locked: no name survives in the file ────────────── */
await page.fill('#lockPass2', PASS);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBtn')]);
const text = readFileSync(await dl.path(), 'utf8');
const file = JSON.parse(text);
ok(file.encrypted && file.encrypted.cipher === 'AES-GCM', 'the file says it is AES-GCM locked');
ok(typeof file.ciphertext === 'string' && file.ciphertext.length > 40, 'and carries ciphertext');
eq(file.data, undefined, 'there is no plain data section');
ok(!/Rosalind|Jemison|np_rosters|Biology/.test(text), 'no student name, key or roster name appears in the file');
eq(file.format, 'aspermylessonplan-backup', 'the outside still names the format');
ok(/locked with your passphrase/.test(await page.textContent('#dlMsg')), 'the message says it was locked');

/* ── 4. restoring it: the wrong passphrase writes nothing ───────────────── */
await page.evaluate(() => localStorage.removeItem('np_rosters'));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.setInputFiles('#fileInput', { name: 'locked.json', mimeType: 'application/json', buffer: Buffer.from(text) });
await settle(page, 300);
ok(await page.isVisible('#unlockPass'), 'a locked file asks for its passphrase');
const unlockScan = await a11yScan(page, { include: '#unlockBox' });
eq(unlockScan.length, 0, 'axe: the passphrase form is clean: ' + JSON.stringify(unlockScan));
ok(!(await page.isVisible('#previewList')), 'and shows no preview yet');
await page.fill('#unlockPass', 'not the passphrase');
await page.click('#unlockBtn');
await page.waitForFunction(() => /does not open/.test(document.getElementById('msg').textContent), null, { timeout: 15000 });
ok(true, 'the wrong passphrase is reported');
ok(!(await page.isVisible('#previewList')), 'and still no preview');
eq(await page.evaluate(() => localStorage.getItem('np_rosters')), null, 'and nothing was written');

/* ── 5. the right one opens the ordinary preview, and Restore round-trips ── */
await page.fill('#unlockPass', PASS);
await page.click('#unlockBtn');
await page.waitForSelector('#previewList li', { timeout: 15000 });
ok(await page.locator('#unlockBox').isHidden(), 'the passphrase form goes away once unlocked');
ok(/1 added/.test(await page.textContent('#previewSummary')), 'the preview shows the roster as added');
await page.click('#restoreBtn');
await settle(page, 600);
eq(await page.evaluate(() => localStorage.getItem('np_rosters')), JSON.stringify(ROSTERS),
   'the restored roster is byte-identical to what was saved');

/* ── 6. a plain file still opens with no passphrase step ────────────────── */
await page.setInputFiles('#fileInput', {
  name: 'plain.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ format: 'aspermylessonplan-backup', formatVersion: 2,
    exportedAt: new Date().toISOString(), data: { np_rosters: JSON.stringify(ROSTERS) } })),
});
await settle(page, 400);
ok(await page.locator('#unlockBox').isHidden(), 'a plain backup never asks for a passphrase');
ok(await page.isVisible('#previewList'), 'and goes straight to the preview');

/* ── 7. the landing readout ─────────────────────────────────────────────── */
await page.evaluate(() => localStorage.removeItem('br_last_backup_at'));
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await settle(page, 300);
const never = await page.textContent('#backupStatus');
ok(/saved · never backed up/.test(never), 'index: data with no backup says so — ' + JSON.stringify(never));
ok(await page.evaluate(() => document.getElementById('backupStatus').classList.contains('stale')), 'and is flagged');
eq(await page.getAttribute('#backupStatus', 'href'), 'Tools/009-backup-restore.html', 'and links to Backup & Restore');
const barScan = await a11yScan(page, { include: '.app-bar' });
eq(barScan.length, 0, 'axe: the app bar with the flagged readout is clean: ' + JSON.stringify(barScan));
await page.evaluate(() => localStorage.setItem('br_last_backup_at', new Date(Date.now() - 3 * 86400000).toISOString()));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
ok(/backed up 3 days ago/.test(await page.textContent('#backupStatus')), 'index: a recent backup reads as such');
ok(!(await page.evaluate(() => document.getElementById('backupStatus').classList.contains('stale'))), 'and is not flagged');

/* ── 8. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
