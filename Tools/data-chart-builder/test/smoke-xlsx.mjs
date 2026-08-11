// smoke-xlsx.mjs — the Data Table → Chart Builder's spreadsheet import.
//
//   node Tools/data-chart-builder/test/smoke-xlsx.mjs
//
// The tool took a paste, a .csv or a .tsv. Every sibling tool that handles
// tabular data also reads .xlsx, and a teacher with a lab-data workbook was
// having to open it, select, copy, and come back.
//
// The design under test: a workbook is converted to the tab-separated text the
// tool already parses, rather than to a second internal representation. One
// parser, one set of rules about headers and numbers. So what this suite checks
// is that the conversion is faithful — including the two ways it can silently
// corrupt a table (a cell containing a tab becoming two columns, and a stray
// formatted cell far to the right becoming an empty series) — and that a
// multi-sheet workbook lets you pick.
//
// The .xlsx fixtures are built in the page with the tool's own vendored
// SheetJS, so the test is reading a real workbook rather than a hand-rolled zip.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8166;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/038-data-chart-builder.html';

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

/** Builds a real .xlsx in the page and returns it as base64. `sheets` is
 *  { name: rows[][] }. */
const makeXlsx = (sheets) => page.evaluate(async (defs) => {
  await new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const el = document.createElement('script');
    el.src = '../_shared/vendor/xlsx/xlsx.full.min.js';
    el.onload = resolve; el.onerror = reject;
    document.head.appendChild(el);
  });
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of defs) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  return out;
}, sheetsToPairs(sheets));

function sheetsToPairs(obj) { return Object.entries(obj); }

/** Hands the page a file through the real file input. */
async function chooseFile(name, base64, mime) {
  await page.setInputFiles('#file-input', {
    name,
    mimeType: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(base64, 'base64'),
  });
  await settle(page, 700);
}

const textarea = () => page.inputValue('#data-input');
const previewRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#preview-table tr')).map(tr =>
    Array.from(tr.children).map(td => td.textContent.trim())));

console.log('Data Table → Chart Builder — spreadsheet import');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. the tool advertises xlsx ───────────────────────────────────────── */
ok(/xlsx/i.test(await page.getAttribute('#file-input', 'accept')), 'the file picker accepts .xlsx');
ok(/xlsx/i.test(await page.textContent('.file-drop-row .hint')), 'and the hint says so');
eq(await page.isVisible('#sheet-picker-row'), false, 'no sheet picker before a workbook is loaded');

/* ── 2. a plain one-sheet workbook lands in the textarea ───────────────── */
const simple = await makeXlsx({
  'Trial data': [
    ['Trial', 'Temperature (C)', 'Reaction Time (s)'],
    [1, 20, 45],
    [2, 30, 31],
    [3, 40, 22],
  ],
});
await chooseFile('lab.xlsx', simple);

const text = await textarea();
eq(text.split('\n').length, 4, 'the header row plus three trials arrive');
eq(text.split('\n')[0], 'Trial\tTemperature (C)\tReaction Time (s)', 'as tab-separated text the parser already reads');
eq(text.split('\n')[2], '2\t30\t31', 'with the numbers intact');
eq(await page.isVisible('#sheet-picker-row'), false, 'a single-sheet workbook shows no picker to choose from');

const rows = await previewRows();
ok(rows.length >= 4, `the preview table filled in (${rows.length} rows)`);
eq(rows[0].join('|'), 'Trial|Temperature (C)|Reaction Time (s)', 'headers detected from the workbook');

/* the chart itself has to actually draw from it — the import is only useful
   if it reaches the output, not just the textarea */
await settle(page, 600);
const chart = await page.evaluate(() => {
  const svg = document.querySelector('svg');
  if (!svg) return null;
  return { shapes: svg.querySelectorAll('rect, path, circle, line, polyline').length, text: svg.textContent };
});
ok(chart && chart.shapes > 3, `a chart is drawn from the imported workbook (${chart ? chart.shapes : 0} shapes)`);
const colChoices = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#value-cols-list label, #value-cols-list option, #category-col option'))
    .map(n => n.textContent.trim()));
ok(colChoices.some(c => /Temperature/.test(c)),
   "the workbook's own headers become the column choices: " + JSON.stringify(colChoices.slice(0, 6)));

/* ── 3. the two silent corruptions ─────────────────────────────────────── */
const messy = await makeXlsx({
  Sheet1: [
    ['Site', 'Notes', 'Count', '', ''],
    ['North', 'wet\tand cold', 12, '', ''],
    ['South', 'dry', 7, '', ''],
  ],
});
await chooseFile('messy.xlsx', messy);
const messyText = await textarea();
const messyLines = messyText.split('\n');
eq(messyLines[0].split('\t').length, 3,
   'trailing empty columns are trimmed rather than becoming empty series');
eq(messyLines[1].split('\t').length, 3,
   'a cell containing a tab stays one column');
ok(/wet and cold/.test(messyText), 'with the tab inside it turned into a space');

/* ── 4. a multi-sheet workbook lets you pick ───────────────────────────── */
const multi = await makeXlsx({
  'Raw counts': [['Site', 'Count'], ['North', 12], ['South', 7]],
  'Averages': [['Site', 'Mean'], ['North', 4.5], ['South', 2.5]],
});
await chooseFile('two-sheets.xlsx', multi);

eq(await page.isVisible('#sheet-picker-row'), true, 'a two-sheet workbook shows the picker');
const options = await page.evaluate(() =>
  Array.from(document.getElementById('sheet-picker').options).map(o => o.value));
eq(options.join('|'), 'Raw counts|Averages', 'both sheets are listed, in workbook order');
ok(/Count/.test(await textarea()), 'the first sheet is loaded by default');

await page.selectOption('#sheet-picker', 'Averages');
await settle(page, 600);
const second = await textarea();
ok(/Mean/.test(second), 'switching the picker loads the other sheet');
ok(/4\.5/.test(second), 'with its own numbers');
ok(!/\t12/.test(second), 'and none of the first sheet left behind');

/* ── 5. csv still works, and clears the picker ─────────────────────────── */
await page.setInputFiles('#file-input', {
  name: 'plain.csv', mimeType: 'text/csv',
  buffer: Buffer.from('Site,Count\nEast,3\nWest,9\n'),
});
await settle(page, 600);
ok(/East/.test(await textarea()), 'a .csv still loads as before');
eq(await page.isVisible('#sheet-picker-row'), false, 'and the sheet picker goes away with the workbook');

/* ── 6. a file the tool cannot read is refused by name ─────────────────── */
await page.setInputFiles('#file-input', {
  name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'),
});
await settle(page, 400);
const msg = await page.evaluate(() => {
  const el = document.querySelector('#msg, .msg, #message');
  return el ? el.textContent : '';
});
ok(/csv|tsv|xlsx/i.test(msg), 'an unsupported file says which kinds are accepted: ' + JSON.stringify(msg));

/* ── 7. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
