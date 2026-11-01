// smoke-chart-sheet.mjs — Data Chart Builder's chart sheet (Path 16 P5 step 5), on the running page.
//
//   node Tools/data-chart-builder/test/smoke-chart-sheet.mjs   (npm run test:chart-sheet, port 8655)
//
// Up to six snapshots of the chart on screen, printed 1, 2, 4 or 6 to a page through the print kit.
// Held here: "Add" is off until there is a chart and off again at six; each snapshot keeps the chart it
// was (changing the data or the type afterwards does not touch it); Remove and Clear; the sheet is drawn
// as the kit's cards, N to a page, each chart with its own ids; Preview pages opens the kit's dialog and
// its count is Chromium's PDF page count for every choice of charts per page; Print sheet shows only the
// sheet in print media and puts the page back after; Ctrl+P with no sheet asked for is what it was; the
// sheet is in memory only (no storage key, nothing in the share link); no horizontal scroll at 360 px;
// axe finds nothing serious. print() is stubbed; the PDF is Chromium's and nothing was printed on paper.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8655;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/038-data-chart-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });

const DATA = 'Month\tRain (mm)\tSnow (mm)\nJan\t40\t30\nFeb\t35\t28\nMar\t50\t10\nApr\t60\t0\n';

async function setup() {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
}
async function paste(text, title) {
  await page.fill('#data-input', text);
  await page.dispatchEvent('#data-input', 'input');
  await settle(page, 500);
  if (title !== undefined) { await page.fill('#chart-title', title); await page.dispatchEvent('#chart-title', 'input'); await settle(page, 300); }
}
const count = () => page.evaluate(() => document.querySelectorAll('#sheet-list li').length);
const state = () => page.evaluate(() => ({
  add: document.getElementById('sheet-add').disabled,
  preview: document.getElementById('sheet-preview').disabled,
  print: document.getElementById('sheet-print').disabled,
  clear: document.getElementById('sheet-clear').disabled
}));
async function addChart(title) {
  await page.fill('#chart-title', title); await page.dispatchEvent('#chart-title', 'input'); await settle(page, 250);
  await page.click('#sheet-add');
}

console.log('Data Chart Builder — chart sheet (step 5)');
await setup();
eq(await state(), { add: true, preview: true, print: true, clear: true }, 'with no data every button on the card is off');
await paste(DATA, 'Rain by month');
eq((await state()).add, false, 'a chart on screen turns Add on');
eq([(await state()).preview, (await state()).print], [true, true], 'and Preview and Print stay off while the sheet is empty');

await page.click('#sheet-add');
eq(await count(), 1, 'Add puts one chart on the list');
eq(await page.textContent('#sheet-msg'), 'Added. 1 of 6 on the sheet.', 'and says so in a status line');
eq(await page.textContent('#sheet-list li span'), '1. Rain by month', 'the list names it by the chart title');

// a snapshot is a snapshot: change the title and the type, the first one stays
await page.fill('#chart-title', 'Something else'); await page.dispatchEvent('#chart-title', 'input'); await settle(page, 250);
await page.evaluate(() => { const r = document.querySelector('input[name="chart-type"][value="line"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await settle(page, 400);
eq(await page.textContent('#sheet-list li span'), '1. Rain by month', 'changing the chart afterwards does not change the snapshot');

// fill to six
for (const t of ['Two', 'Three', 'Four', 'Five', 'Six']) await addChart(t);
eq(await count(), 6, 'six charts are on the list');
eq((await state()).add, true, 'Add is off at six');
eq(await page.textContent('#sheet-msg'), 'Added. 6 of 6 on the sheet.', 'and the status line says six of six');

// Remove
await page.click('#sheet-list li:nth-child(2) button');
eq(await count(), 5, 'Remove takes one off');
eq(await page.evaluate(() => [...document.querySelectorAll('#sheet-list li span')].map(s => s.textContent)), ['1. Rain by month', '2. Three', '3. Four', '4. Five', '5. Six'], 'the right one, and the list is renumbered');
eq((await state()).add, false, 'Add is back on');
eq(await page.getAttribute('#sheet-list li button', 'aria-label'), 'Remove chart 1, Rain by month, from the sheet', 'a Remove button says which chart');
await page.click('#sheet-add');
eq(await count(), 6, 'and it can be filled to six again');

// the sheet in the page: per-page choices
const draw = async per => {
  await page.selectOption('#sheet-per', String(per));
  await page.click('#sheet-preview');
  await page.waitForSelector('dialog.pk-preview[data-pk-pages]', { timeout: 15000 });
  const info = await page.evaluate(() => {
    const s = document.getElementById('chartSheet');
    return {
      pages: Number(document.querySelector('dialog.pk-preview').getAttribute('data-pk-pages')),
      grids: [...s.querySelectorAll('.pk-cards')].map(g => g.querySelectorAll('.pk-card').length),
      svgs: s.querySelectorAll('svg').length,
      ids: [...s.querySelectorAll('[id]')].map(e => e.id),
      caps: [...s.querySelectorAll('figcaption')].map(c => c.textContent),
      bodyClass: document.body.classList.contains('printing-sheet'),
      pageRule: (document.getElementById('pk-page-style') || {}).textContent
    };
  });
  return info;
};
const closePreview = async () => { await page.keyboard.press('Escape'); await settle(page, 150); };
const plan = { 1: [1, 1, 1, 1, 1, 1], 2: [2, 2, 2], 4: [4, 2], 6: [6] };
for (const per of [1, 2, 4, 6]) {
  const info = await draw(per);
  eq(info.grids, plan[per], `${per} to a page: the cards fall ${JSON.stringify(plan[per])}`);
  eq(info.svgs, 6, `${per} to a page: all six charts are drawn`);
  eq(new Set(info.ids).size, info.ids.length, `${per} to a page: no two elements on the sheet share an id`);
  eq(info.caps[0], 'Rain by month', `${per} to a page: each chart has its title under it`);
  ok(info.bodyClass, `${per} to a page: the page is marked while the preview is open`);
  ok(new RegExp('size: letter ' + (per === 1 ? 'landscape' : 'portrait')).test(info.pageRule || ''), `${per} to a page: @page is ${per === 1 ? 'landscape' : 'portrait'}: ${info.pageRule}`);
  eq(info.pages, plan[per].length, `${per} to a page: the preview counts ${plan[per].length} page(s)`);
  // The same sheet, printed: Chromium's PDF
  await page.click('.pk-preview-print');
  await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
  await settle(page, 100);
  const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
  eq(pdf, info.pages, `${per} to a page: the preview's count is Chromium's PDF page count`);
  await page.evaluate(() => { window.__printCalls = 0; window.dispatchEvent(new Event('afterprint')); });
  await settle(page, 100);
}

// A part-filled sheet
await page.click('#sheet-list li:nth-child(1) button');
await page.click('#sheet-list li:nth-child(1) button');
let info = await draw(4);
eq([info.grids, info.pages], [[4], 1], 'four charts at 4 to a page are one full page');
await closePreview();

// Print in print media: only the sheet
await page.selectOption('#sheet-per', '2');
await page.click('#sheet-print');
await settle(page, 150);
eq(await page.evaluate(() => window.__printCalls), 1, 'Print sheet prints once');
await page.emulateMedia({ media: 'print' });
const shown = await page.evaluate(() => {
  const vis = e => e && getComputedStyle(e).display !== 'none';
  const kids = [...document.body.children].filter(vis).map(e => e.id || e.tagName.toLowerCase()).filter(t => t !== 'script');
  return { kids, sheet: vis(document.getElementById('chartSheet')) };
});
eq(shown, { kids: ['chartSheet'], sheet: true }, 'in print media the sheet is the only thing on the page');
await page.emulateMedia({ media: null });
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await settle(page, 100);
eq(await page.evaluate(() => [document.body.classList.contains('printing-sheet'), !!document.getElementById('pk-page-style')]), [false, false], 'after the print the page is as it was (no marker, no @page rule of ours)');

// Ctrl+P with no sheet asked for does not show the sheet
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => [getComputedStyle(document.getElementById('chartSheet')).display, getComputedStyle(document.getElementById('sheet-card')).display]), ['none', 'none'], 'Ctrl+P prints neither the sheet nor its card');
await page.emulateMedia({ media: null });

// Preview closes cleanly
await draw(4);
await closePreview();
eq(await page.evaluate(() => [document.querySelectorAll('dialog.pk-preview').length, document.body.classList.contains('printing-sheet'), document.activeElement.id]), [0, false, 'sheet-preview'], 'Escape closes the preview, takes the marker off and returns the focus');

// Clear
await page.click('#sheet-clear');
eq([await count(), await state()], [0, { add: false, preview: true, print: true, clear: true }], 'Clear empties the list and turns Preview, Print and Clear off');

// memory only
const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /sheet/i.test(k)));
eq(stored, [], 'nothing about the sheet is in storage');
await page.click('#sheet-add');
const link = await page.evaluate(() => document.getElementById('shareBtn') ? 'has' : 'none');
ok(link === 'has', 'the share button is still there');

// 360 px
const phone = await prepPage(browser, BASE, { width: 360, height: 800, mobile: true });
await phone.goto(URL_PAGE, { waitUntil: 'networkidle' });
await phone.fill('#data-input', DATA); await phone.dispatchEvent('#data-input', 'input'); await settle(phone, 500);
await phone.click('#sheet-add');
eq(await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no sideways scroll at 360 px with the card in use');

const scan = await a11yScan(page, { impact: 'serious' });
ok(!scan.length, 'axe: no serious violation with the card in use: ' + JSON.stringify(scan.map(v => [v.id, v.nodes])));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
