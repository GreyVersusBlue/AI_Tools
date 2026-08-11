// smoke-export.mjs — the Class Roster Hub's roster export.
//
//   node Tools/class-roster-hub/test/smoke-export.mjs
//
// A roster typed in here is the canonical class list for the whole site, and
// the only way out of the browser used to be a printed page. What a gradebook
// import or a sub folder wants is columns. This drives the real buttons and
// reads the real downloads.
//
// The join under test is the interesting part: np_rosters holds the names,
// crh_students_v1 hangs preferred name and pronunciation off them, and the
// roster's period/course/year live on the sidecar's meta. A roster the sidecar
// has never seen — one written by Name Picker years ago — still has to export,
// just with empty detail columns.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8158;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

async function download(selector) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click(selector),
  ]);
  const dest = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(dest);
  return dest;
}

const readSheets = (file) => page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wb = XLSX.read(bin, { type: 'array' });
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) }));
}, fs.readFileSync(file).toString('base64'));

console.log('Class Roster Hub — roster export to spreadsheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── seed one detailed roster and one bare, Name-Picker-era roster ─────── */
await page.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({
    'Period 3 — Earth Science': ['Ada Lovelace', 'Marco Polo', "Fatima al-Fihri"],
    'Period 5/6 Honors': ['Nellie Bly', 'Zheng He'],
  }));
  // Only the first roster has a sidecar record — the second is what a roster
  // written by another tool before this one existed looks like.
  localStorage.setItem('crh_students_v1', JSON.stringify({
    version: 1,
    rosters: {
      'Period 3 — Earth Science': {
        meta: { period: '3', subject: 'Earth Science', term: '2026–27' },
        students: [
          { id: 's1', name: 'Ada Lovelace', preferred: 'Addie', say: 'AY-duh' },
          { id: 's2', name: 'Marco Polo', preferred: '', say: '' },
          { id: 's3', name: "Fatima al-Fihri", preferred: 'Tima', say: 'fah-TEE-mah' },
        ],
        orphans: [],
      },
    },
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

await page.selectOption('#rosterSwitch', 'Period 3 — Earth Science');
await settle(page, 300);

/* ── 1. the controls exist and default to the open roster ──────────────── */
eq(await page.inputValue('#exportScope'), 'one', 'the export defaults to the roster you have open');

/* ── 2. CSV of one roster ──────────────────────────────────────────────── */
const csv = fs.readFileSync(await download('#exportCsvBtn'), 'utf8');
ok(csv.charCodeAt(0) === 0xfeff, 'the CSV starts with a BOM so Excel on Windows reads accented names');
const csvLines = csv.replace(/^﻿/, '').trim().split('\r\n');
eq(csvLines[0], '#,Name,Preferred name,Pronunciation,Period / block,Course,School year',
   'one roster exports without a Roster column');
eq(csvLines.length, 4, 'a header plus the three students');
eq(csvLines[1], '1,Ada Lovelace,Addie,AY-duh,3,Earth Science,2026–27',
   'the sidecar detail and the roster meta are joined onto the name');
ok(/Fatima al-Fihri,Tima,fah-TEE-mah/.test(csv), 'an accented/hyphenated name survives');

/* ── 3. CSV of every roster, including one with no sidecar record ──────── */
await page.selectOption('#exportScope', 'all');
const csvAll = fs.readFileSync(await download('#exportCsvBtn'), 'utf8').replace(/^﻿/, '');
const allLines = csvAll.trim().split('\r\n');
eq(allLines[0].split(',')[0], 'Roster', 'exporting everything adds a Roster column');
eq(allLines.length, 6, 'a header plus all five students across both rosters');
ok(allLines.some(l => l.startsWith('Period 5/6 Honors,1,Nellie Bly,,,,')),
   'a roster with no sidecar record still exports, with empty detail columns: ' + JSON.stringify(allLines.slice(-2)));

/* ── 4. Excel — one sheet per roster ───────────────────────────────────── */
const xlsxPath = await download('#exportXlsxBtn');
eq(fs.readFileSync(xlsxPath).subarray(0, 2).toString('latin1'), 'PK', 'a real .xlsx zip came out');
const sheets = await readSheets(xlsxPath);
eq(sheets.length, 2, 'one sheet per roster');
ok(sheets.some(s => s.name === 'Period 3 — Earth Science'), 'sheets are named after their roster');
ok(sheets.some(s => s.name === 'Period 5 6 Honors'),
   'a slash is stripped from the sheet name — Excel rejects it: ' + JSON.stringify(sheets.map(s => s.name)));
const p3 = sheets.find(s => s.name.startsWith('Period 3'));
eq(p3.rows[0].join('|'), '#|Name|Preferred name|Pronunciation|Period / block|Course|School year', 'headed');
eq(p3.rows[1].join('|'), '1|Ada Lovelace|Addie|AY-duh|3|Earth Science|2026–27', 'with the joined detail');
eq(typeof p3.rows[1][0], 'number', 'the row number is a number, not text');

/* ── 5. unsaved edits on screen are what gets exported ─────────────────── */
await page.selectOption('#exportScope', 'one');
await page.click('#tabText');
await settle(page, 200);
await page.fill('#namesInput', 'Ada Lovelace\nMarco Polo\nFatima al-Fihri\nGrace Hopper');
await page.dispatchEvent('#namesInput', 'input');
await settle(page, 300);
const csvLive = fs.readFileSync(await download('#exportCsvBtn'), 'utf8').replace(/^﻿/, '');
ok(/Grace Hopper/.test(csvLive), 'a student added but not yet saved is still in the export');

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
