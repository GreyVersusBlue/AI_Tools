// smoke-typed-columns.mjs — typed data-table columns on the lab packet.
//
//   node Tools/lab-report-template-builder/test/smoke-typed-columns.mjs
//
// A data table used to print as a grid of blank cells with a name on top,
// which tells a student nothing about what belongs in a cell. Each column now
// declares a kind — Number or Text — and an optional units label, and both
// print under the column name. What this suite holds down:
//
//   The declaration reaches the printed packet: "number" and the units show up
//   in the header, and numeric columns right-align so a column of measurements
//   lines up on its digits.
//
//   The three fields in a column row stay separate. They share one row and one
//   delegated input handler, and the obvious bug is typing units into a column
//   and having it overwrite the column name.
//
//   Templates saved before columns had a kind still open, still print their
//   original headers, and are upgraded to an explicit Text with no units
//   rather than left half-shaped.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8165;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/065-lab-report-template-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });

/** Open the print preview (which renders the real print markup) and describe
 *  the data table's header and first body row. */
async function previewTable(p = page) {
  await p.click('#previewBtn');
  await settle(p);
  const out = await p.evaluate(() => {
    const t = document.querySelector('#previewBody table.data-table');
    return {
      heads: Array.from(t.querySelectorAll('thead th')).map(th => ({
        name: th.childNodes[0].textContent.trim(),
        meta: th.querySelector('.ch-meta') ? th.querySelector('.ch-meta').textContent : null,
        num: th.classList.contains('num'),
      })),
      firstRow: Array.from(t.querySelectorAll('tbody tr:first-child td')).map(td => td.className),
      rowCount: t.querySelectorAll('tbody tr').length,
    };
  });
  await p.click('#closePreviewBtn');
  await settle(p);
  return out;
}

const columnRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#columnsWrap .col-row')).map(r => ({
    name: r.querySelector('[data-field="text"]').value,
    type: r.querySelector('[data-field="type"]').value,
    units: r.querySelector('[data-field="units"]').value,
  })));

console.log('Lab Report Template Builder — typed data-table columns');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. the chemistry starter declares its own columns ───────────────────── */
await page.selectOption('#templateSelect', 'chemistry');
page.once('dialog', d => d.accept());
await page.click('#loadTemplateBtn');
await settle(page);
const chem = await columnRows();
eq(chem.map(c => `${c.name}/${c.type}/${c.units}`).join(' | '),
   'Trial/number/ | Sign of Reaction/text/ | Time/number/sec',
   'the chemistry starter ships typed columns with units');

const chemTable = await previewTable();
eq(chemTable.heads.map(h => h.meta).join(' | '), 'number |  | number · sec',
   'the header says what belongs in each column');
ok(chemTable.heads[0].meta === 'number' && chemTable.heads[1].meta === null,
   'a text column stays unannotated — a blank cell already reads as "write something"');
eq(chemTable.heads.map(h => h.num ? 'R' : 'L').join(''), 'RLR', 'numeric headers align right, text left');
eq(chemTable.firstRow.join(','), 'num,,num', 'and the body cells follow the same alignment');

/* ── 2. the three fields in a column row stay separate ───────────────────── */
await page.fill('#columnsWrap .col-row:nth-child(2) [data-field="units"]', 'colour');
await settle(page);
const afterUnits = await columnRows();
eq(afterUnits[1].name, 'Sign of Reaction', 'typing units does not overwrite the column name');
eq(afterUnits[1].units, 'colour', 'and the units land where they were typed');

await page.selectOption('#columnsWrap .col-row:nth-child(2) [data-field="type"]', 'number');
await settle(page);
eq((await columnRows())[1].type, 'number', 'switching a column to Number sticks');
eq((await previewTable()).heads[1].meta, 'number · colour', 'and both the kind and the units print');

/* ── 3. reorder and delete still work on the richer row ──────────────────── */
await page.click('#columnsWrap .col-row:nth-child(3) [data-up]');
await settle(page);
eq((await columnRows()).map(c => c.name).join(','), 'Trial,Time,Sign of Reaction', 'a column moves up, carrying its kind and units');
eq((await columnRows())[1].units, 'sec', 'the moved column kept its units');
await page.click('#columnsWrap .col-row:nth-child(1) [data-del]');
await settle(page);
eq((await columnRows()).map(c => c.name).join(','), 'Time,Sign of Reaction', 'a column deletes');

/* ── 4. a new column starts as plain text ────────────────────────────────── */
await page.click('#addColumnBtn');
await settle(page);
const added = (await columnRows())[2];
eq(added.type + '/' + added.units, 'text/', 'an added column starts as Text with no units');

/* ── 5. it all survives a reload ─────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq((await columnRows()).map(c => `${c.name}/${c.type}/${c.units}`).join(' | '),
   'Time/number/sec | Sign of Reaction/number/colour | /text/',
   'kinds and units are saved with the template');

/* ── 6. a template saved before columns were typed ───────────────────────── */
const old = await prepPage(browser, BASE, { width: 1400, height: 950 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(() => {
  localStorage.clear();
  const legacy = {
    name: 'Density Lab', title: 'Density Lab', objective: 'Find the density of three samples.',
    hypothesisPrompt: 'If ____, then ____.',
    materials: [{ id: 'm1', text: 'Balance' }],
    procedure: [{ id: 'p1', text: 'Mass each sample.' }],
    columns: [{ id: 'c1', text: 'Sample' }, { id: 'c2', text: 'Mass (g)' }],
    dataRows: 3,
    observationsPrompt: 'What did you notice?',
    conclusion: [{ id: 'q1', text: 'Was your hypothesis supported?' }]
  };
  localStorage.setItem('lrt_list_v1', JSON.stringify(['Density Lab']));
  localStorage.setItem('lrt_data_v1:Density Lab', JSON.stringify(legacy));
  localStorage.setItem('lrt_current_v1', 'Density Lab');
});
await old.reload({ waitUntil: 'networkidle' });
await settle(old);
const upgraded = await old.evaluate(() =>
  JSON.parse(localStorage.getItem('lrt_data_v1:Density Lab')).columns
    .map(c => `${c.text}/${c.type}/${c.units}`).join(' | '));
eq(upgraded, 'Sample/text/ | Mass (g)/text/', 'old columns are upgraded to an explicit Text with no units');

const oldTable = await previewTable(old);
eq(oldTable.heads.map(h => h.name).join(','), 'Sample,Mass (g)', 'the old headers print exactly as they did before');
ok(oldTable.heads.every(h => h.meta === null && !h.num), 'and gain no annotation the teacher did not ask for');
eq(oldTable.rowCount, 3, 'the saved blank-row count is untouched');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
for (const [label, p] of [['main', page], ['legacy', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
