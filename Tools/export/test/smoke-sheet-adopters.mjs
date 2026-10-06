// smoke-sheet-adopters.mjs — the pages whose spreadsheet files are written by
// ExportKit.toCsv() and ExportKit.toXlsx() (Path 7 P4): 001, 006, 030, 036.
//
//   node Tools/export/test/smoke-sheet-adopters.mjs    (npm run test:sheet-adopters)
//
// 001 (a range report) and 006 (rosters) each save one table two ways. Their
// CSV had the byte order mark and its quoting right and no formula guard: a
// student entered as "=SUM(A1:A9)", or a note typed "-left without the pass",
// was a formula to a spreadsheet. All four built a workbook by hand with
// SheetJS; ExportKit.toXlsx() is that code once, and it never writes a formula.
//
// This opens each page with cells built to break a file, presses each export
// button and reads the bytes the page saves. A CSV: the mark, CRLF, strict
// RFC 4180, the apostrophe before a typed formula and on no number, every
// cell, and the bytes against a writer of its own. A workbook, read back by
// the vendored SheetJS: its sheets by name, every cell's type and value, no
// formula anywhere, and 036's column widths. Then the files go back in where
// the tool reads its own: 006's CSV and workbook through its import dialog,
// 030's template through its importer.
//
// The table and the fixtures are in _sheet-adopters.mjs; 060's CSV, which has
// one table and no workbook, is a row in _csv-adopters.mjs. Exits 1 on any
// failure. Every name here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { GUARD, parseCsv, unguard, capture } from './_csv-adopters.mjs';
import { TOOLS, readWorkbook, cellsOf } from './_sheet-adopters.mjs';

const PORT = 8489;
const BASE = `http://127.0.0.1:${PORT}`;
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* The pages, by name: CI's selector runs a suite when a page its source names
   changes and does not follow imports, so they are written here too. */
const PAGES = [
  'Tools/001-hall-pass-log.html',
  'Tools/006-class-roster-hub.html',
  'Tools/030-review-game-board.html',
  'Tools/036-final_grade_checker.html',
];
eq(TOOLS.map(t => t.file), PAGES, 'the table and this file name the same pages');

const server = await serve(PORT);
const browser = await launch();

async function open(t, seed) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    for (const k of Object.keys(s)) localStorage.setItem(k, s[k]);
  }, seed);
  await page.goto(`${BASE}/${t.file}`, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return { page, errors };
}

/** The reference CSV writer: a string that starts like a formula gets the
    apostrophe, a number never does. */
const writeRef = rows => rows.map(r => r.map((v) => {
  let s = String(v);
  if (typeof v === 'string' && GUARD.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join(',') + '\r\n').join('');

function checkCsv(T, f, file) {
  eq([...file.bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF], `${T} the file starts with a UTF-8 byte order mark`);
  eq(file.type, 'text/csv;charset=utf-8', `${T} the file's type`);
  ok(f.name.test(file.name), `${T} the file's name (got ${JSON.stringify(file.name)})`);
  const body = file.bytes.subarray(3).toString('utf8');
  const { rows, faults } = parseCsv(body);
  eq(faults, [], `${T} strict RFC 4180: CRLF after every record, nothing bare, nothing unquoted`);
  /* a blank line between two tables reads back as one empty cell */
  const want = f.table.map(r => (r.length ? r : ['']));
  eq(rows.map(r => r.length), want.map(r => r.length), `${T} records and the cells in each`);
  let guarded = 0, wantGuarded = 0;
  const bare = [], wrong = [];
  want.forEach((r, ri) => r.forEach((v, ci) => {
    const got = (rows[ri] || [])[ci];
    if (typeof v === 'string' && GUARD.test(v)) { wantGuarded++; if (got !== "'" + v) bare.push(got); else guarded++; }
    else if (got !== String(v)) wrong.push([got, String(v)]);
  }));
  eq(bare, [], `${T} no cell a spreadsheet would run as a formula`);
  eq(wrong, [], `${T} every other cell as typed, and no apostrophe on a number`);
  ok(wantGuarded > 0 && guarded === wantGuarded, `${T} the ${wantGuarded} typed formulas each got the apostrophe (${guarded})`);
  eq(rows.map(r => r.map(unguard)), want.map(r => r.map(String)), `${T} the table, cell for cell`);
  eq(body, writeRef(f.table), `${T} the file is the reference writer's, byte for byte`);
}

function checkXlsx(T, f, file) {
  eq(file.type, XLSX_TYPE, `${T} the file's type`);
  ok(f.name.test(file.name), `${T} the file's name (got ${JSON.stringify(file.name)})`);
  eq([...file.bytes.subarray(0, 4)], [0x50, 0x4B, 0x03, 0x04], `${T} the file is a zip`);
  const book = readWorkbook(file.bytes);
  eq(book.names, f.sheets.map(s => s.name), `${T} the sheets, by name and in order`);
  f.sheets.forEach((s, i) => {
    const got = (book.sheets[i] || { cells: {} }).cells, want = cellsOf(s.rows);
    eq(Object.keys(got).sort(), Object.keys(want).sort(), `${T} "${s.name}": the cells that are filled`);
    const off = Object.keys(want).filter(k => JSON.stringify(got[k]) !== JSON.stringify(want[k])).map(k => [k, got[k], want[k]]);
    eq(off, [], `${T} "${s.name}": every cell's type and value (a number a number, text text)`);
    ok(Object.keys(got).every(k => got[k].f === undefined && got[k].t !== 'e'), `${T} "${s.name}": no formula and no error cell`);
    const formulas = s.rows.flat().filter(v => typeof v === 'string' && GUARD.test(v));
    for (const v of formulas) ok(Object.values(got).some(c => c.t === 's' && c.v === v), `${T} "${s.name}": ${JSON.stringify(v)} is text, as typed, with no apostrophe`);
  });
  if (f.widths) eq(book.sheets[0].cols, f.widths, `${T} the column widths`);
}

const sheetFile = f => ({ name: f.name, mimeType: f.type, buffer: f.bytes });

for (const t of TOOLS) {
  if (ONLY && ONLY !== t.tool) continue;
  console.log(`${t.tool} — ${t.file}`);

  /* the page itself: the shared file, and no file-writing of its own left */
  const src = fs.readFileSync(path.join(SITE, t.file), 'utf8');
  ok(/<script src="\.\.\/_shared\/export\.js"><\/script>/.test(src), `${t.tool}: the page loads _shared/export.js`);
  ok(!/\.replace\(\/"\/g,\s*'""'\)/.test(src), `${t.tool}: the page doubles no quotes itself`);
  ok(!/XLSX\.(writeFile|utils\.(book_new|aoa_to_sheet|book_append_sheet))/.test(src), `${t.tool}: the page builds no workbook itself`);
  if (t.files.some(f => f.kind === 'csv')) ok(src.includes('ExportKit.toCsv('), `${t.tool}: the page calls ExportKit.toCsv()`);
  ok(src.includes('ExportKit.toXlsx('), `${t.tool}: the page calls ExportKit.toXlsx()`);

  const { page, errors } = await open(t, t.seed);
  await t.prep(page);
  await settle(page, 200);
  const saved = {};
  for (const f of t.files) {
    const T = `${t.tool} ${f.kind}:`;
    const file = saved[f.kind] = await capture(page, f.button);
    await settle(page, 200);
    if (f.kind === 'csv') checkCsv(T, f, file); else checkXlsx(T, f, file);
  }
  eq(errors, [], `${t.tool}: no page error`);
  await page.context().close();

  /* ── the tool's own files go back in ── */
  if (t.tool === '006') {
    const csv = t.files[0], xlsx = t.files[1];
    /* the CSV: one dialog; the teacher names the column, and the names come
       back as they were typed, the apostrophes gone */
    const a = await open(t, {});
    await a.page.setInputFiles('#csvFileInput', sheetFile(saved.csv));
    await a.page.waitForFunction(() => !document.getElementById('importOverlay').hidden, null, { timeout: 5000 }).catch(() => {});
    const preview = await a.page.evaluate(() => document.getElementById('importPreviewWrap').innerText);
    ok(preview.includes('=Ada Quill') && !/'[=+\-@]/.test(preview), '006 csv: the import dialog shows the cells with no apostrophe');
    await a.page.check('#importHasHeader');
    await a.page.selectOption('#mapNameCol', '2');
    await a.page.click('#importConfirmBtn');
    await settle(a.page, 300);
    eq(await a.page.evaluate(() => [...document.querySelectorAll('.stu-row input.nm')].map(i => i.value)), csv.roundTrip.names, '006 csv: its own file imports to the names it came from');
    eq(a.errors, [], '006 csv: no page error on import');
    await a.page.context().close();

    /* the workbook: a sheet per roster, each its own dialog */
    const b = await open(t, {});
    await b.page.setInputFiles('#csvFileInput', sheetFile(saved.xlsx));
    for (let i = 0; i < xlsx.sheets.length; i++) {
      await b.page.waitForFunction(n => !document.getElementById('importOverlay').hidden && document.getElementById('importTitle').textContent.includes(`(${n} of`), i + 1, { timeout: 8000 }).catch(() => {});
      ok((await b.page.evaluate(() => document.getElementById('importTitle').textContent)).includes(xlsx.sheets[i].name), `006 xlsx: dialog ${i + 1} is for the sheet "${xlsx.sheets[i].name}"`);
      await b.page.check('#importHasHeader');
      await b.page.selectOption('#mapNameCol', '1');
      await b.page.click('#importConfirmBtn');
      await settle(b.page, 400);
    }
    eq(await b.page.evaluate(() => JSON.parse(localStorage.getItem('np_rosters') || '{}')), xlsx.roundTrip.rosters, '006 xlsx: its own workbook imports to the rosters it came from');
    eq(b.errors, [], '006 xlsx: no page error on import');
    await b.page.context().close();
  }
  if (t.tool === '030') {
    const c = await open(t, {});
    await c.page.setInputFiles('#importFile', sheetFile(saved.xlsx));
    await c.page.waitForFunction(() => document.getElementById('importStatus').textContent.trim() !== '', null, { timeout: 8000 }).catch(() => {});
    await settle(c.page, 300);
    eq(await c.page.evaluate(() => [document.getElementById('importStatus').className, document.getElementById('importStatus').textContent]), t.files[0].roundTrip.status, '030 xlsx: its own template imports');
    eq(c.errors, [], '030 xlsx: no page error on import');
    await c.page.context().close();
  }
}

await browser.close();
server.close();
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
