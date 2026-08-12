// smoke-reference-sheet.mjs — the class reference sheet and the artist field.
//
//   node Tools/art-portfolio-label-maker/test/smoke-reference-sheet.mjs
//
// The tool printed labels and nothing else, so a teacher who wanted one page
// listing what was in the show had to retype it. There is now a "Print class
// reference sheet" that lists every piece with its artist and its whole
// statement — no photos, no codes. Getting there needed an artist field,
// since the artist used to be folded into the title by convention. What this
// suite holds down:
//
//   The sheet carries the FULL statement. The labels show a 90-character
//   preview; a reference sheet that also truncated would be useless as a
//   record, which is the one thing it is for.
//
//   Labels and sheet do not leak into each other. They share one print area,
//   switched by a mode class, and the failure mode is a stray page of the
//   other document in the middle of a print run.
//
//   The artist field reaches storage, the label, and the sheet, and portfolios
//   saved before it existed still open and print.
//
//   Spreadsheet import reads a third tab column as the artist, while a
//   comma line still splits only on its first comma — a statement full of
//   commas is normal prose and must not be cut in half.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8148;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/048-art-portfolio-label-maker.html';

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

const LONG = 'Charcoal on newsprint. I kept the left side unfinished on purpose so the eye moves there first, ' +
  'and I smudged the background with my hand rather than a blending stump because the smoother version looked dead.';

const sheetRows = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#printRefSheet tbody tr')).map(tr =>
    Array.from(tr.children).map(td => td.textContent)));

async function fillRow(nth, title, artist, desc) {
  await page.fill(`#entriesList .entry-row:nth-child(${nth}) [data-title]`, title);
  await page.fill(`#entriesList .entry-row:nth-child(${nth}) [data-artist]`, artist);
  await page.fill(`#entriesList .entry-row:nth-child(${nth}) [data-desc]`, desc);
  await settle(page, 250);
}

console.log('Art Portfolio Label Maker — class reference sheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => { window.print = function () {}; });

/* ── 1. the two print buttons are offered together ───────────────────────
   (The tool defaults a blank entry's title to "Entry 1", so both buttons are
   live from the first render — long-standing behaviour, not this round's. The
   assertion that matters is that the new button tracks the old one rather
   than being enabled or disabled on its own schedule.) */
eq(await page.isDisabled('#printSheetBtn'), await page.isDisabled('#printBtn'),
   'the reference sheet is offered exactly when labels are');

await fillRow(1, 'Self-Portrait', 'Ava R.', LONG);
await page.click('#addRowBtn');
await settle(page);
await fillRow(2, 'Still Life with Lamp', 'Marcus T.', 'Acrylic. Three sessions.');
ok(!(await page.isDisabled('#printSheetBtn')), 'and is live once there are real entries');

/* ── 2. the artist reaches storage and the label ─────────────────────────── */
const storedArtists = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem('apl_portfolios_v1'));
  const cur = store.list.find(p => p.id === store.currentId);
  return cur.entries.map(e => e.artist);
});
eq(storedArtists.join(','), 'Ava R.,Marcus T.', 'the artist is saved per entry');
eq(await page.evaluate(() => Array.from(document.querySelectorAll('.label-preview .lbl-artist')).map(e => e.textContent).join(',')),
   'Ava R.,Marcus T.', 'and shows on the label preview');

/* ── 3. the sheet lists every piece, with the whole statement ────────────── */
await page.click('#printSheetBtn');
await settle(page);
const rows = await sheetRows();
eq(rows.length, 2, 'one row per piece');
eq(rows[0].slice(0, 3).join(' | '), '1 | Self-Portrait | Ava R.', 'numbered, titled, and attributed');
eq(rows[0][3], LONG, 'the statement is printed in full, not truncated the way the label is');

const labelDesc = await page.evaluate(() => document.querySelector('.label-preview .lbl-desc').textContent);
ok(labelDesc.length < LONG.length && labelDesc.endsWith('…'),
   'the label really does truncate, so the sheet is carrying something the label cannot');

/* ── 4. an empty artist reads as a dash, not a blank cell ────────────────── */
await page.fill('#entriesList .entry-row:nth-child(2) [data-artist]', '');
await settle(page, 250);
await page.click('#printSheetBtn');
await settle(page);
eq((await sheetRows())[1][2], '—', 'a piece with no artist named shows a dash');

/* ── 5. labels and sheet stay out of each other's print ──────────────────── */
await page.click('#printBtn');
await settle(page);
eq(await page.evaluate(() => document.getElementById('printArea').className), 'print-only',
   'the print area is put back after printing labels');
const modeDuringLabels = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  let seen = null;
  const realPrint = window.print;
  window.print = function () { seen = area.className; };
  document.getElementById('printBtn').click();
  window.print = realPrint;
  return seen;
});
ok(/mode-labels/.test(modeDuringLabels) && !/mode-sheet/.test(modeDuringLabels),
   'printing labels puts the area in label mode: ' + JSON.stringify(modeDuringLabels));
const modeDuringSheet = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  let seen = null;
  const realPrint = window.print;
  window.print = function () { seen = area.className; };
  document.getElementById('printSheetBtn').click();
  window.print = realPrint;
  return seen;
});
ok(/mode-sheet/.test(modeDuringSheet) && !/mode-labels/.test(modeDuringSheet),
   'and printing the sheet puts it in sheet mode: ' + JSON.stringify(modeDuringSheet));

/* ── 6. import: tabs give three columns, commas still give two ───────────── */
await page.click('#toggleImportBtn');
await settle(page);
await page.fill('#importText',
  'Woven Basket\tPriya S.\tReed and raffia, made over two weeks.\n' +
  'Clay Bowl, I threw it, trimmed it, and glazed it twice.');
await page.click('#importBtn');
await settle(page, 300);
const imported = await page.evaluate(() => {
  const store = JSON.parse(localStorage.getItem('apl_portfolios_v1'));
  const cur = store.list.find(p => p.id === store.currentId);
  return cur.entries.slice(-2).map(e => [e.title, e.artist, e.description]);
});
eq(imported[0].join(' | '), 'Woven Basket | Priya S. | Reed and raffia, made over two weeks.',
   'a three-column spreadsheet paste fills title, artist and statement');
eq(imported[1].join(' | '), 'Clay Bowl |  | I threw it, trimmed it, and glazed it twice.',
   'a comma line still splits only on its first comma, so a statement keeps its commas');

/* ── 7. a portfolio saved before the artist field existed ────────────────── */
const old = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await old.goto(URL_PAGE, { waitUntil: 'networkidle' });
await old.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('apl_portfolios_v1', JSON.stringify({
    currentId: 'legacy',
    list: [{
      id: 'legacy', name: 'Spring Show', title: 'Spring Show',
      entries: [{ id: 'e1', title: 'Linocut — Sam W.', description: 'Two-colour reduction print.', image: '' }],
      labelsPerPage: '6', ecLevel: 'Q'
    }]
  }));
});
await old.reload({ waitUntil: 'networkidle' });
await settle(old, 300);
eq(await old.inputValue('#entriesList .entry-row:nth-child(1) [data-artist]'), '',
   'an entry from before the artist field opens with it empty');
eq(await old.inputValue('#entriesList .entry-row:nth-child(1) [data-title]'), 'Linocut — Sam W.',
   'and its title is untouched — the artist is not guessed out of it');
await old.evaluate(() => { window.print = function () {}; });
await old.click('#printSheetBtn');
await settle(old);
eq(await old.evaluate(() => Array.from(document.querySelectorAll('#printRefSheet tbody tr td')).map(td => td.textContent).join(' | ')),
   '1 | Linocut — Sam W. | — | Two-colour reduction print.',
   'and it prints on the reference sheet as it stands');

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
for (const [label, p] of [['main', page], ['legacy', old]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
