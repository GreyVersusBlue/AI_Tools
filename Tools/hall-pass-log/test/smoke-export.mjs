// smoke-export.mjs — the Digital Hall Pass log's date-range spreadsheet export.
//
//   node Tools/hall-pass-log/test/smoke-export.mjs
//
// A year of hall-pass data is only worth keeping if it can leave the browser:
// the conversation it feeds is with a counselor or an attendance clerk, and it
// happens in a spreadsheet. This drives the real buttons and reads the real
// downloads — a CSV that parses, and an .xlsx whose two sheets actually carry
// the totals and the individual trips behind them.
//
// The log is seeded straight into localStorage rather than clicked out one
// sign-out at a time: the point here is the export, and the sign-out path has
// its own coverage in the tool.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8157;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/001-hall-pass-log.html';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'hallpass-'));

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

/** Clicks `selector` and returns the saved path of whatever it downloads. */
async function download(selector) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click(selector),
  ]);
  const dest = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(dest);
  return dest;
}

console.log('Digital Hall Pass — date-range spreadsheet export');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── seed three days of archived history plus two trips today ───────────── */
const seeded = await page.evaluate(() => {
  const KEY = Object.keys(localStorage).find(k => /hall-pass/i.test(k));
  const store = JSON.parse(localStorage.getItem(KEY));
  const current = store.sets[store.current];
  const DAY = 86400000;
  const day = (back) => new Date(Date.now() - back * DAY);
  const label = d => d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  const trip = (name, dest, mins, note) => ({
    name, destLabel: dest, outStr: '9:15 AM', inStr: '9:2' + (mins % 10) + ' AM',
    durationMin: mins, note: note || '',
  });

  current.history = [
    { date: label(day(1)), dateMs: day(1).getTime(), rows: [
      trip('Ada Lovelace', 'Restroom', 6), trip('Marco Polo', 'Nurse', 14, 'headache'),
      trip('Ada Lovelace', 'Water', 3),
    ] },
    { date: label(day(3)), dateMs: day(3).getTime(), rows: [
      trip('Ada Lovelace', 'Restroom', 8), trip('Nellie Bly', 'Office', 11),
    ] },
    // Outside the range the test asks for — must not appear in either sheet.
    { date: label(day(40)), dateMs: day(40).getTime(), rows: [
      trip('Zheng He', 'Restroom', 99),
    ] },
  ];
  current.log = [
    { id: 'a', name: 'Marco Polo', destLabel: 'Restroom', outStr: '10:02 AM', outMs: Date.now() - 3600000,
      inStr: '10:07 AM', durationMin: 5, note: '' },
  ];
  localStorage.setItem(KEY, JSON.stringify(store));
  return { key: KEY, days: current.history.length };
});
ok(!!seeded.key, 'found the hall-pass store to seed: ' + seeded.key);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

/* ── build a report over the last week ─────────────────────────────────── */
const iso = back => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
await page.fill('#rangeFrom', iso(7));
await page.fill('#rangeTo', iso(0));
await page.click('#buildRangeBtn');
await settle(page, 300);

const summaryRows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#rangeReportWrap tbody tr'))
    .map(tr => Array.from(tr.children).map(td => td.textContent.trim())));
eq(summaryRows.length, 3, 'three students appear in the week (the 40-day-old trip is out of range)');
eq(summaryRows[0].join('|'), 'Ada Lovelace|3|17 min', 'the busiest student is first, with the right totals');
ok(!summaryRows.some(r => r[0] === 'Zheng He'), 'the out-of-range student is not in the report');

/* ── CSV ────────────────────────────────────────────────────────────────── */
ok(await page.$('#csvRangeBtn'), 'the report offers a CSV export');
const csvPath = await download('#csvRangeBtn');
const csv = fs.readFileSync(csvPath, 'utf8');
ok(csv.charCodeAt(0) === 0xfeff, 'the CSV starts with a BOM so Excel on Windows reads the names correctly');
ok(/Student,Passes,Total minutes/.test(csv), 'it carries the per-student totals header');
ok(/Ada Lovelace,3,17/.test(csv), 'and the totals themselves');
ok(/Date,Student,Destination,Out,Back,Minutes,Note/.test(csv), 'it carries the per-trip detail header too');
ok(/Marco Polo,Nurse,.*,14,headache/.test(csv), 'including the destination, the minutes and the note');
ok(!/Zheng He/.test(csv), 'and nothing from outside the range');

/* a note containing a comma has to survive the round trip */
await page.evaluate(() => {
  const KEY = Object.keys(localStorage).find(k => /hall-pass/i.test(k));
  const store = JSON.parse(localStorage.getItem(KEY));
  store.sets[store.current].history[0].rows[1].note = 'headache, sent home';
  localStorage.setItem(KEY, JSON.stringify(store));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#rangeFrom', iso(7));
await page.fill('#rangeTo', iso(0));
await page.click('#buildRangeBtn');
await settle(page, 250);
const csv2 = fs.readFileSync(await download('#csvRangeBtn'), 'utf8');
ok(/"headache, sent home"/.test(csv2), 'a note containing a comma is quoted, not split into a new column');

/* ── XLSX ───────────────────────────────────────────────────────────────── */
const xlsxPath = await download('#xlsxRangeBtn');
const stat = fs.statSync(xlsxPath);
ok(stat.size > 2000, `an .xlsx of real size came out (${stat.size} bytes)`);
ok(path.extname(xlsxPath) === '.xlsx', 'named .xlsx');
const head = fs.readFileSync(xlsxPath).subarray(0, 2).toString('latin1');
eq(head, 'PK', 'and it really is a zip container, not an HTML error page');

// Read it back with the same vendored SheetJS build the tool ships.
const sheets = await page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wb = XLSX.read(bin, { type: 'array' });
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) }));
}, fs.readFileSync(xlsxPath).toString('base64'));
eq(sheets.map(s => s.name).join(','), 'Totals,Every pass', 'the workbook has both sheets');
eq(sheets[0].rows[0].join('|'), 'Student|Passes|Total minutes', 'the Totals sheet is headed');
eq(sheets[0].rows[1].join('|'), 'Ada Lovelace|3|17', 'and holds the numbers as numbers, not text');
eq(sheets[1].rows.length, 7, 'the detail sheet has a header plus all six in-range trips');
ok(sheets[1].rows.some(r => r[1] === 'Marco Polo' && r[5] === 14), 'a specific trip survived with its minutes');
ok(!sheets[1].rows.some(r => r[1] === 'Zheng He'), 'and nothing out of range got in');

/* ── no console noise ───────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
