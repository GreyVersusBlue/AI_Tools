// smoke-print.mjs — 016 prints through the shared print kit (Path 7 P3).
//
//   node Tools/qr-code-generator/test/smoke-print.mjs
//
// 016 is the kit's thirteenth adopter and the last of the card-grid tools. It
// has three print buttons and three sheets: one code centred on a page, the
// bulk grid (on plain paper, or on Avery label stock), and the equipment
// inventory. Its two `@media print` blocks and the `@page` it rewrote for
// label stock are gone: _shared/print-area.css hides the editor, #printArea
// holds the three sheets as areas with the ids they always had, and
// PrintKit.setPage() writes the page, with the stock's own two margins while
// a stock grid is the sheet that prints.
//
// Which kind each sheet is, read off the old CSS:
//   - one code: not a card at all, a picture centred on a page (`100vh`).
//   - the plain grid: a grid of the tool's own, `{ cols }` and no perPage. A
//     code is a share of the WIDTH (2, 3 or 4 across) and as tall as its
//     picture and label, and the old grid simply ran on over the pages.
//   - label stock: a grid of the tool's own, `{ cols, perPage }`. A label is
//     exact inches at an exact pitch, and a sheet holds cols x rows of them.
//   - the inventory: a table, as wide as its content, centred.
//
// The codes on every sheet are <img>s of a canvas's PNG, not canvases, so the
// "canvas drawn on beforeprint prints as replayed commands" trap does not
// reach this page; all the same the single code and the grid are kept current
// by the tool's own render and nothing with a picture is built on beforeprint.
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - each button prints its own sheet and only that one
//   - one code is the size it was, centred, on one page
//   - a plain-grid code is where it was and the size it was (`old`, measured
//     from `git show origin/main:` on 2026-10-05 on half-inch margins)
//   - LABEL STOCK: every label is its exact size at its exact pitch from the
//     sheet's corner, a sheet holds cols x rows, and N labels print on
//     ceil(N / per sheet) pages. The old page did not do this: <body>'s 2rem
//     of padding stayed above the grid in print, so the first sheet's labels
//     were a third of an inch below the die cut and its last row ran on to a
//     second sheet (30 labels: 2 pages; they are 1 now).
//   - every printed code decodes to its line's link or text
//   - Chromium's PDF page count. Exact where the sheet is exact inches (one
//     code, label stock). Where a height is text (a plain-grid code's label,
//     the inventory's rows) the count depends on the machine's fonts, so what
//     is asserted is the property: the pages the measured rows need.
//   - what the teacher typed reaches every sheet as text
//   - Ctrl+P prints the sheet of the tab that is showing, on that sheet's page
//
// print() is stubbed. Nothing here has been checked against a printer or a
// sheet of labels, and no phone has scanned a printed code: the decode is
// jsQR reading the picture.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8479;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '016-qr-code-generator.html';
const PAGE_W = 720, PAGE_H = 960;   // Letter less half an inch all round, in px
const NEAR = 24;                    // a height this close to a page's end is the fonts' to decide
const IN = 96;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 0.6) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pdfImageCount = buf => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;
const pdfPaper = buf => { const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(buf.toString('latin1')); return m ? `${Math.round(+m[1])}x${Math.round(+m[2])}` : null; };
const PDF = { preferCSSPageSize: true, printBackground: false };

// The label stock, as the vendor draws it (inches). The page's own table is
// read back and compared with this one, below.
const STOCK = {
  avery5160: { cols: 3, rows: 10, labelW: 2.625, labelH: 1, marginTop: 0.5, marginSide: 0.1875, pitchX: 2.75, pitchY: 1 },
  avery5163: { cols: 2, rows: 5, labelW: 4, labelH: 2, marginTop: 0.5, marginSide: 0.25, pitchX: 4, pitchY: 2 },
};

// Made-up lines: a label and a link, the second with a long label.
const entry = i => i === 1
  ? { label: 'A much longer label for station two by the window', content: 'https://example.com/s/2' }
  : { label: 'Station ' + (i + 1), content: 'https://example.com/s/' + (i + 1) };
const entriesOf = n => Array.from({ length: n }, (_, i) => entry(i));
const linesOf = n => entriesOf(n).map(e => e.label + ', ' + e.content).join('\n');
// The plain grid is as wide as its codes want to be, and a code wants to be as
// wide as the wider of its picture and its label on one line. How wide a line
// of text is belongs to the machine's fonts, so the plain grid is also run
// with labels that cannot matter in any font: `short`, none wider than the
// 300 px picture, and `wide`, one far wider than the page (no comma in it:
// a line is split into label and link at its first).
const WIDE = 'A label that is a good deal wider than the whole page when it is set on one line in any font at all and so makes the grid as wide as the page lets it be';
const plainEntries = s => entriesOf(s.n).map((e, i) => i !== 1 ? e : s.labels === 'short' ? { ...e, label: 'Station 2' } : s.labels === 'wide' ? { ...e, label: WIDE } : e);
const plainLines = s => plainEntries(s).map(e => e.label + ', ' + e.content).join('\n');
const inventoryOf = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['asset-' + (i + 1), {
  label: 'Microscope ' + (i + 1), status: i % 3 ? 'in' : 'out', assignedTo: i % 3 ? '' : 'Table ' + (i + 1),
  checkedOutAt: i % 3 ? null : 1790000000000, checkedInAt: i % 3 ? 1790000000000 : null, history: [],
}]));

// `old` is [left, top, width] of the first code on the old page, in px from
// the corner of the printable page; `img` the side of its picture. On the
// plain grid `old` is null where it is the fonts' to decide (two across with
// the long label: 37 and 316 on huginn, where the label is narrower than its
// picture, 26 and 327 in CI, where it is wider), and there `plainWant()` says
// what must hold on either.
const SINGLE = [
  { name: 'a short link at the default size', text: 'https://example.com/a', rect: [160, 280, 400, 400] },
  { name: 'with a caption under it', text: 'https://example.com/a', caption: 'Room 12 sign-in', rect: [160, 262, 400, 436] },
  { name: 'a long link at the largest size', text: 'https://example.com/a-long-link/' + 'x'.repeat(120), size: 'max', rect: [72, 192, 576, 576] },
  { name: 'two letters at the smallest size', text: 'hi', size: 'min', rect: [260, 380, 200, 200] },
];
const PLAIN = [
  { cols: 2, n: 1, old: [37, 42, 316], img: 300 }, { cols: 2, n: 3, old: null },
  { cols: 2, n: 13, old: null }, { cols: 2, n: 40, old: null },
  { cols: 2, n: 3, labels: 'short', old: [37, 42, 316], img: 300 }, { cols: 2, n: 13, labels: 'short', old: [37, 42, 316], img: 300 },
  { cols: 2, n: 3, labels: 'wide', old: [26, 42, 327], img: 311 }, { cols: 2, n: 13, labels: 'wide', cut: true, old: [26, 42, 327], img: 309 },
  { cols: 3, n: 1, cut: true, old: [26, 42, 213.33], img: 195.33 }, { cols: 3, n: 3, old: [26, 42, 213.33], img: 197.33 },
  { cols: 3, n: 13, cut: true, old: [26, 42, 213.33], img: 195.33 }, { cols: 3, n: 40, cut: true, old: [26, 42, 213.33], img: 195.33 },
  { cols: 4, n: 1, old: [26, 42, 156.5], img: 140.5 }, { cols: 4, n: 3, old: [26, 42, 156.5], img: 140.5 },
  { cols: 4, n: 13, old: [26, 42, 156.5], img: 140.5 }, { cols: 4, n: 40, old: [26, 42, 156.5], img: 140.5 },
];
// `oldPages` is what the old page printed; the new count is ceil(n / a sheet).
const LABELS = [
  { sheet: 'avery5160', n: 1, oldPages: 1 }, { sheet: 'avery5160', n: 3, oldPages: 1 }, { sheet: 'avery5160', n: 30, oldPages: 2 },
  { sheet: 'avery5160', n: 31, oldPages: 2 }, { sheet: 'avery5160', n: 65, oldPages: 3 },
  { sheet: 'avery5163', n: 1, oldPages: 1 }, { sheet: 'avery5163', n: 3, oldPages: 1 }, { sheet: 'avery5163', n: 10, oldPages: 2 },
  { sheet: 'avery5163', n: 11, oldPages: 2 }, { sheet: 'avery5163', n: 25, oldPages: 3 },
];
const INVENTORY = [1, 6, 70];

/** The plain grid's rule, from the page's CSS: a code is its picture (300 px
    as drawn) or its widest label on one line, whichever is wider, and its
    8 px of padding each side (and a 1 px cut line); the grid is that many
    codes and 14 px between them, inside 10 px each side, centred, and never
    wider than the page less the sheet's 16 px each side. Returns the first
    code's [left, width] and its picture's side for a label `labelMax` px wide. */
function plainWant(cols, cut, labelMax) {
  const edge = 8 + (cut ? 1 : 0);
  const room = (PAGE_W - 2 * 16 - 2 * 10 - (cols - 1) * 14) / cols;
  const w = Math.min(room, Math.max(300, labelMax) + 2 * edge);
  return { left: (PAGE_W - (cols * w + (cols - 1) * 14 + 2 * 10)) / 2 + 10, w, img: w - 2 * edge };
}

/** Opens 016 as wide as the printable page, so a thing measured in print
    media is the size it is on paper. */
async function open(browser, { theme, inventory, width = PAGE_W } = {}) {
  const page = await prepPage(browser, BASE, { width, height: PAGE_H });
  await page.clock.setFixedTime(new Date('2026-10-05T10:00:00'));
  await page.addInitScript(([dark, inv]) => {
    window.__printCalls = 0; window.print = () => { window.__printCalls++; };
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
    if (inv && !localStorage.getItem('qr-code-generator-inventory')) localStorage.setItem('qr-code-generator-inventory', JSON.stringify(inv));
  }, [theme === 'dark', inventory || null]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const press = async (page, id) => {
  const pressed = await page.evaluate(i => { const x = document.getElementById(i); if (x.disabled) return false; x.click(); return true; }, id);
  await page.evaluate(() => Promise.all([...document.images].filter(i => i.getAttribute('src')).map(i => i.decode().catch(() => 0))));
  return pressed;
};
async function typeCode(page, s) {
  if (s.size) await page.evaluate(sz => { const e = document.getElementById('size-slider'); e.value = sz === 'max' ? e.max : e.min; e.dispatchEvent(new Event('input', { bubbles: true })); }, s.size);
  if (s.caption) await page.fill('#caption-text', s.caption);
  await page.fill('#qr-text', s.text);
  await page.waitForFunction(() => !document.getElementById('btn-print').disabled);
}
async function makeGrid(page, { sheet = 'custom', cols, cut, text }) {
  await page.click('label[for="mode-bulk"]');
  await page.selectOption('#bulk-sheet', sheet);
  if (cols) await page.selectOption('#bulk-cols', String(cols));
  if (cut) await page.check('#bulk-cutlines');
  await page.fill('#bulk-text', text);
  await page.click('#btn-bulk-generate');
  await page.waitForFunction(() => /generated/.test(document.getElementById('bulk-status').textContent), null, { timeout: 60000 });
}

/** What is on the paper, read in print media: the areas showing, anything
    showing outside #printArea, and the boxes of `sel` from the page's corner. */
const onPaper = (page, sel) => page.evaluate(sel => {
  const box = e => { const b = e.getBoundingClientRect(); return [b.left + scrollX, b.top + scrollY, b.width, b.height].map(v => Math.round(v * 100) / 100); };
  const sheet = document.getElementById('printArea');
  const cs = getComputedStyle(sheet);
  const els = sel ? [...sheet.querySelectorAll(sel)] : [];
  const imgs = [...sheet.querySelectorAll('img')].filter(i => i.getBoundingClientRect().height > 0);
  return {
    showing: [...sheet.children].filter(a => getComputedStyle(a).display !== 'none').map(a => a.id).join(','),
    outside: [...document.body.children].filter(e => e !== sheet && e.getBoundingClientRect().height > 0).map(e => e.id || e.tagName).join(','),
    sheet: [cs.display, cs.backgroundColor, cs.color].join(' '),
    boxes: els.map(box),
    imgBoxes: imgs.map(box),
    grids: [...sheet.querySelectorAll('.pk-cards')].filter(g => g.getBoundingClientRect().height > 0).map(g => ({
      cls: g.className, cols: g.style.getPropertyValue('--pk-cols'), n: g.children.length, box: box(g),
      allCards: [...g.children].every(c => c.classList.contains('pk-card') && c.classList.contains('bulk-item')),
    })),
    labels: [...sheet.querySelectorAll('.bulk-item-label')].filter(l => l.getBoundingClientRect().height > 0).map(l => l.textContent),
    // The widest label set on one line, in the label's own type: what the
    // machine's fonts make of it. Measured out of the flow, then taken away.
    labelMax: Math.max(0, ...[...sheet.querySelectorAll('.bulk-item-label')].filter(l => l.getBoundingClientRect().height > 0).map(l => {
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;visibility:hidden;font:' + getComputedStyle(l).font;
      span.textContent = l.textContent; l.parentNode.parentNode.parentNode.appendChild(span);
      const w = span.getBoundingClientRect().width; span.remove(); return w;
    })),
    labelInk: (l => l ? getComputedStyle(l).color : null)(sheet.querySelector('.bulk-item-label')),
    cut: (c => c ? getComputedStyle(c).borderTopStyle : null)(sheet.querySelector('.bulk-item')),
    decoded: imgs.map(i => {
      const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height); const q = window.jsQR(d.data, c.width, c.height);
      return q ? q.data : null;
    }),
    pageRule: (document.getElementById('pk-page-style') || {}).textContent || '',
  };
}, sel);

/** The pages a run of rows needs when no row may split: [fewest, most], the
    two apart only where a row ends within NEAR px of a page's end. `first` is
    what stands above the first row. */
function pagesFor(rows, gap, first) {
  const count = cap => { let pages = 1, y = first; for (const h of rows) { if (y + h > cap && y > 0) { pages++; y = 0; } y += h + gap; } return pages; };
  return [count(PAGE_H + NEAR), count(PAGE_H - NEAR)];
}

console.log('016 — the QR generator\'s three sheets print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(code), 'has no @media print block of its own');
ok(!/@page/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(!/print-page-style|setPrintPageMargin/.test(code), 'and the <style> it rewrote for label stock is gone');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/page-break|break-inside|break-after/.test(code), 'the page breaks are the kit\'s, not the page\'s');
ok(!/visibility:\s*hidden/.test(code), 'and so is hiding the editor');
ok(!/#printArea\s*\{[^}]*display/.test(code), 'it does not hide or show #printArea itself');
eq((code.match(/PrintKit\.renderCards\(/g) || []).length, 1, 'the bulk grid, plain or stock, is one PrintKit.renderCards() call');
eq((code.match(/PrintKit\.setPage\(/g) || []).length, 1, 'and the page is one PrintKit.setPage() call');
ok(!/printArea(Bulk|Inventory)\.innerHTML\s*=\s*[^'";]*['"][^'"]/.test(code), 'no sheet is built from a string');
ok(/<\/div>\s*\n\s*<div id="printArea" class="pk-paper">\s*\n\s*<div class="print-only" id="print-area">/.test(src), '#printArea is a .pk-paper, written as a child of <body>, with the single code first');
ok(/id="print-area-bulk"/.test(src) && /id="print-area-inventory"/.test(src) && /id="print-img"/.test(src), 'the three sheets keep their ids');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  // ---- one code ----------------------------------------------------------------
  for (const s of SINGLE) {
    const what = `${theme}, one code, ${s.name}`;
    const page = await open(browser, { theme });
    try {
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheets are hidden on screen`);
      ok(await page.evaluate(() => !document.getElementById('print-img').hasAttribute('src')), `${what}: with nothing typed there is no picture on the sheet`);
      await typeCode(page, s);
      ok(await page.evaluate(() => document.getElementById('print-img').src === document.getElementById('qr-canvas').toDataURL('image/png')), `${what}: the sheet's picture is the code on screen before any button is pressed`);
      eq(await press(page, 'btn-print'), true, `${what}: the button is on`);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print() once`);
      await page.emulateMedia({ media: 'print' });
      const m = await onPaper(page, '#print-img');
      eq(m.showing, 'print-area', `${what}: the single code is the only sheet on the paper`);
      eq(m.outside, '', `${what}: nothing outside #printArea is on the paper`);
      eq(m.sheet, 'block rgb(255, 255, 255) rgb(0, 0, 0)', `${what}: the paper is white and the ink black`);
      eq(JSON.stringify(m.boxes[0]), JSON.stringify(s.rect), `${what}: the code is the size it was, in the middle of the page`);
      eq(JSON.stringify(m.decoded), JSON.stringify([s.text]), `${what}: it decodes to what was typed`);
      eq(m.pageRule, '@page { size: letter portrait; margin: 0.5in; }', `${what}: the page is Letter at half an inch`);
      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const buf = await page.pdf(PDF);
      eq(pdfPageCount(buf), 1, `${what}: one page in Chromium's PDF, as it was`);
      eq(pdfPaper(buf), '612x792', `${what}: on Letter portrait`);
      ok(pdfImageCount(buf) >= 1, `${what}: with the code as a bitmap`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }

  // ---- the plain-paper grid -----------------------------------------------------
  for (const s of PLAIN) {
    const what = `${theme}, plain grid, ${s.cols} across, ${s.n} code${s.n === 1 ? '' : 's'}${s.cut ? ', cut lines' : ''}${s.labels ? `, ${s.labels} labels` : ''}`;
    const page = await open(browser, { theme });
    try {
      await makeGrid(page, { cols: s.cols, cut: s.cut, text: plainLines(s) });
      eq(await page.locator('#print-area-bulk .bulk-item').count(), s.n, `${what}: the sheet is built when the grid is, so Ctrl+P has something to print`);
      eq(await press(page, 'btn-bulk-print'), true, `${what}: the button is on`);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print() once`);
      ok(await page.evaluate(() => document.body.classList.contains('print-bulk')), `${what}: the button's class is on <body> while it prints`);
      await page.emulateMedia({ media: 'print' });
      const m = await onPaper(page, '#print-area-bulk .bulk-item');
      eq(m.showing, 'print-area-bulk', `${what}: the grid is the only sheet on the paper`);
      eq(m.outside, '', `${what}: nothing outside #printArea is on the paper`);
      eq(m.sheet, 'block rgb(255, 255, 255) rgb(0, 0, 0)', `${what}: the paper is white and the ink black`);
      eq(m.grids.length, 1, `${what}: one grid, which runs on over the pages`);
      eq(m.grids[0].cls, 'pk-cards pk-page pk-cards-own', `${what}: a kit grid of the tool's own`);
      eq(m.grids[0].cols, String(s.cols), `${what}: ${s.cols} across`);
      ok(m.grids[0].n === s.n && m.grids[0].allCards, `${what}: every code is a kit card`);
      // What the page's CSS gives for the labels as this machine's fonts set
      // them; and, wherever the fonts cannot matter, the old page's numbers.
      const want = plainWant(s.cols, s.cut, m.labelMax);
      ok(m.labelMax > 0, `${what}: the widest label was measured (${Math.round(m.labelMax)} px on one line)`);
      near(m.boxes[0][0], want.left, `${what}: the grid is centred, as wide as its codes and no wider than the page`);
      ok(m.boxes.every(b => Math.abs(b[2] - want.w) <= 0.6), `${what}: every code is its picture or its widest label, whichever is wider, up to its share of the page (${Math.round(want.w * 100) / 100} px; first is ${m.boxes[0][2]})`);
      ok(m.imgBoxes.every(b => Math.abs(b[2] - want.img) <= 0.6 && Math.abs(b[3] - want.img) <= 0.6), `${what}: every picture fills its code (${Math.round(want.img * 100) / 100} px square; first is ${m.imgBoxes[0][2]})`);
      near(m.grids[0].box[0] + m.grids[0].box[2] / 2, PAGE_W / 2, `${what}: the grid's middle is the page's`);
      ok(m.grids[0].box[2] <= PAGE_W - 2 * 16 + 0.6, `${what}: and it keeps the sheet's 16 px each side (${m.grids[0].box[2]} px wide)`);
      near(m.boxes[0][1], 42, `${what}: the first code is as far down as it was`);
      if (s.old) {
        near(m.boxes[0][0], s.old[0], `${what}: the first code is as far in from the left as it was`);
        ok(m.boxes.every(b => Math.abs(b[2] - s.old[2]) <= 0.6), `${what}: every code is the width it was (${s.old[2]} px; first is ${m.boxes[0][2]})`);
        ok(m.imgBoxes.every(b => Math.abs(b[2] - s.img) <= 0.6 && Math.abs(b[3] - s.img) <= 0.6), `${what}: every picture is the size it was (${s.img} px square; first is ${m.imgBoxes[0][2]})`);
      }
      if (s.n > 1) near(m.boxes[1][0] - m.boxes[0][0] - m.boxes[0][2], 14, `${what}: 14 px between codes, as there was`);
      if (s.n > s.cols) near(m.boxes[s.cols][1] - m.boxes[0][1] - m.boxes[0][3], 14, `${what}: and 14 px between rows`);
      eq(m.cut, s.cut ? 'dashed' : 'none', `${what}: cut lines ${s.cut ? 'on' : 'off'}`);
      eq(m.labelInk, 'rgb(26, 29, 39)', `${what}: a label is the ink it was`);
      eq(JSON.stringify(m.labels), JSON.stringify(plainEntries(s).map(e => e.label)), `${what}: every label is on the sheet, in order`);
      eq(JSON.stringify(m.decoded), JSON.stringify(plainEntries(s).map(e => e.content)), `${what}: every code decodes to its line's link`);
      eq(m.pageRule, '@page { size: letter portrait; margin: 0.5in; }', `${what}: the page is Letter at half an inch`);
      // The rows as measured, each as tall as its tallest code.
      const rows = [];
      for (let i = 0; i < m.boxes.length; i += s.cols) rows.push(Math.max(...m.boxes.slice(i, i + s.cols).map(b => b[3])));
      const [lo, hi] = pagesFor(rows, 14, 42);
      await page.emulateMedia({ media: null });
      const buf = await page.pdf(PDF);
      const got = pdfPageCount(buf);
      ok(got >= lo && got <= hi, `${what}: the pages its rows need and none after them (${got} in Chromium's PDF, ${lo === hi ? lo : lo + ' to ' + hi} by the rows)`);
      ok(pdfImageCount(buf) >= 1, `${what}: with the codes as bitmaps`);
      ok(await page.evaluate(() => !document.body.classList.contains('print-bulk')), `${what}: the button's class is off again after printing`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }

  // ---- label stock ----------------------------------------------------------------
  for (const s of LABELS) {
    const p = STOCK[s.sheet];
    const per = p.cols * p.rows;
    const what = `${theme}, ${s.sheet}, ${s.n} label${s.n === 1 ? '' : 's'}`;
    // As wide as the stock's printable page: the sheet less its two side margins.
    const page = await open(browser, { theme, width: Math.round((8.5 - 2 * p.marginSide) * IN) });
    try {
      await makeGrid(page, { sheet: s.sheet, text: linesOf(s.n) });
      eq(await press(page, 'btn-bulk-print'), true, `${what}: the button is on`);
      await page.emulateMedia({ media: 'print' });
      const m = await onPaper(page, '#print-area-bulk .bulk-item');
      eq(m.showing, 'print-area-bulk', `${what}: the grid is the only sheet on the paper`);
      eq(m.outside, '', `${what}: nothing outside #printArea is on the paper`);
      eq(m.pageRule, `@page { size: letter portrait; margin: ${p.marginTop}in ${p.marginSide}in; }`, `${what}: the page has the stock's own margins, top and side`);
      eq(m.grids.length, Math.ceil(s.n / per), `${what}: one grid to a sheet of ${per}`);
      ok(m.grids.every((g, i) => g.cls === 'pk-cards pk-page pk-cards-own' && g.cols === String(p.cols) && g.allCards && g.n === Math.min(per, s.n - i * per)), `${what}: each a kit grid of the tool's own, ${p.cols} across, full but the last`);
      ok(m.grids.every((g, i) => Math.abs(g.box[0]) <= 0.01 && Math.abs(g.box[1] - m.grids[0].box[1] - i * p.rows * p.labelH * IN) <= 0.01), `${what}: every sheet starts at the page's corner, with nothing above its first label (first grid at ${m.grids[0].box[0]}, ${m.grids[0].box[1]})`);
      eq(m.grids[0].box[1], 0, `${what}: the first label's top edge is the top of the printable page (it was 32 px, a third of an inch, lower)`);
      ok(m.grids.every(g => g.box[3] <= p.rows * p.labelH * IN + 0.01), `${what}: no sheet of labels is taller than the page's ${p.rows} rows`);
      // Every label: its exact size, at its exact pitch from its sheet's corner.
      const bad = m.boxes.map((b, i) => {
        const k = i % per, sheetTop = Math.floor(i / per) * p.rows * p.labelH * IN;
        const want = [(k % p.cols) * p.pitchX * IN, sheetTop + Math.floor(k / p.cols) * p.pitchY * IN, p.labelW * IN, p.labelH * IN];
        return want.every((v, j) => Math.abs(v - b[j]) <= 0.05) ? null : `#${i + 1} ${JSON.stringify(b)} not ${JSON.stringify(want)}`;
      }).filter(Boolean);
      eq(bad.length, 0, `${what}: every label is ${p.labelW} x ${p.labelH} in at a pitch of ${p.pitchX} x ${p.pitchY} in ${bad.slice(0, 2).join('; ')}`);
      near((8.5 - 2 * p.marginSide) * IN, (p.cols - 1) * p.pitchX * IN + p.labelW * IN, `${what}: and the last column ends at the printable page's right edge`, 0.01);
      eq(JSON.stringify(m.labels), JSON.stringify(entriesOf(s.n).map(e => e.label)), `${what}: every label's words are on the sheet, in order`);
      eq(JSON.stringify(m.decoded), JSON.stringify(entriesOf(s.n).map(e => e.content)), `${what}: every code decodes to its line's link`);
      await page.emulateMedia({ media: null });
      const buf = await page.pdf(PDF);
      eq(pdfPageCount(buf), Math.ceil(s.n / per), `${what}: ${Math.ceil(s.n / per)} page${s.n > per ? 's' : ''} in Chromium's PDF, a sheet of ${per} to a page (the old page printed ${s.oldPages})`);
      eq(pdfPaper(buf), '612x792', `${what}: on Letter portrait`);
      const sheets = Math.ceil(s.n / per);
      ok((await page.textContent('#bulk-status')).includes(`. ${sheets} sheet${sheets === 1 ? '' : 's'} of `), `${what}: which is the number of sheets the page says are needed`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }

  // ---- the inventory sheet --------------------------------------------------------
  for (const n of INVENTORY) {
    const what = `${theme}, inventory, ${n} item${n === 1 ? '' : 's'}`;
    const page = await open(browser, { theme, inventory: inventoryOf(n) });
    try {
      await page.click('label[for="mode-scan"]');
      await settle(page, 200);
      eq(await page.locator('#print-area-inventory tbody tr').count(), n, `${what}: the sheet is kept current, so Ctrl+P has something to print`);
      eq(await press(page, 'btn-print-inventory'), true, `${what}: the button is on`);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print() once`);
      ok(await page.evaluate(() => document.body.classList.contains('print-inventory')), `${what}: the button's class is on <body> while it prints`);
      await page.emulateMedia({ media: 'print' });
      const m = await onPaper(page, '#print-area-inventory, #print-area-inventory h1, #print-area-inventory table, #print-area-inventory tbody tr');
      eq(m.showing, 'print-area-inventory', `${what}: the inventory is the only sheet on the paper`);
      eq(m.outside, '', `${what}: nothing outside #printArea is on the paper`);
      const [area, h1, table, ...rows] = m.boxes;
      near(area[0] + area[2] / 2, PAGE_W / 2, `${what}: the sheet is centred on the page, as it was`);
      near(h1[1], 42, `${what}: its heading is as far down as it was`);
      near(table[2], area[2] - 20, `${what}: and it is as wide as its table and 10 px each side`);
      const t = await page.evaluate(() => {
        const a = document.getElementById('print-area-inventory');
        return { h1: a.querySelector('h1').textContent, p: a.querySelector('p').textContent, ink: getComputedStyle(a).color + ' ' + getComputedStyle(a.querySelector('p')).color,
          head: [...a.querySelectorAll('th')].map(x => x.textContent).join('|'), cells: [...a.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent).join('|')) };
      });
      eq(t.h1, 'Equipment Inventory', `${what}: headed as it was`);
      ok(t.p.startsWith('Printed ') && t.p.endsWith(` — ${n} item${n === 1 ? '' : 's'}`), `${what}: with when it was printed and how many items (${t.p})`);
      eq(t.ink, 'rgb(17, 17, 17) rgb(68, 68, 68)', `${what}: in the two inks it had`);
      eq(t.head, 'Item|Status|Checked out to|Since', `${what}: the four columns`);
      ok(t.cells.some(c => c.startsWith('Microscope 1|Checked out|Table 1|')) && (n < 2 || t.cells.some(c => c.startsWith('Microscope 2|Available||'))), `${what}: an item out names who has it, an item in does not`);
      const [lo, hi] = pagesFor(rows.map(r => r[3]), 0, rows[0][1]);
      await page.emulateMedia({ media: null });
      const got = pdfPageCount(await page.pdf(PDF));
      ok(got >= lo && got <= hi, `${what}: the pages its rows need and none after them (${got} in Chromium's PDF, ${lo === hi ? lo : lo + ' to ' + hi} by the rows)`);
      ok(await page.evaluate(() => !document.body.classList.contains('print-inventory')), `${what}: the button's class is off again after printing`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- the page's own table of label stock is the vendor's ---------------------------
{
  const page = await open(browser);
  try {
    for (const [key, p] of Object.entries(STOCK)) {
      await makeGrid(page, { sheet: key, text: linesOf(2) });
      const v = await page.evaluate(() => { const a = document.getElementById('print-area-bulk'); const g = k => a.style.getPropertyValue(k); return [a.classList.contains('stock'), g('--label-w'), g('--label-h'), g('--label-gap-x'), g('--label-gap-y')].join(' '); });
      eq(v, `true ${p.labelW}in ${p.labelH}in ${p.pitchX - p.labelW}in ${p.pitchY - p.labelH}in`, `${key}: the label's size and gutters reach the sheet as the vendor's`);
      near(2 * p.marginSide + (p.cols - 1) * p.pitchX + p.labelW, 8.5, `${key}: its columns and side margins make 8.5 in`, 0.0001);
      near(2 * p.marginTop + p.rows * p.pitchY, 11, `${key}: its rows and top margins make 11 in`, 0.0001);
    }
    await makeGrid(page, { sheet: 'custom', cols: 3, text: linesOf(2) });
    eq(await page.evaluate(() => { const a = document.getElementById('print-area-bulk'); return [a.classList.contains('stock'), a.style.getPropertyValue('--label-w')].join('|'); }), 'false|', 'going back to plain paper takes the stock\'s sizes off the sheet');
    eq(await page.evaluate(() => document.getElementById('pk-page-style').textContent), '@page { size: letter portrait; margin: 0.5in; }', 'and puts the page back to half an inch');
  } catch (e) {
    ok(false, `the stock table: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- what is typed is text ---------------------------------------------------------
{
  const page = await open(browser, { inventory: { 'asset-x': { label: '<b>Scale</b> & <img src=x onerror=alert(1)>', status: 'out', assignedTo: '<i>Table 3</i>', checkedOutAt: 1790000000000, checkedInAt: null, history: [] } } });
  try {
    await makeGrid(page, { cols: 2, text: '<b>Bold</b> & <i>co</i>, https://example.com/x\n<script>alert(1)</script>' });
    const g = await page.evaluate(() => { const a = document.getElementById('print-area-bulk'); return { n: a.querySelectorAll('b, i, script').length, labels: [...a.querySelectorAll('.bulk-item-label')].map(l => l.textContent) }; });
    eq(g.n, 0, 'markup typed as a label makes no element on the grid sheet');
    eq(JSON.stringify(g.labels), JSON.stringify(['<b>Bold</b> & <i>co</i>', '<script>alert(1)</script>']), 'it prints as the text that was typed');
    await makeGrid(page, { sheet: 'avery5160', text: '<b>Bold</b>, https://example.com/x' });
    eq(await page.evaluate(() => document.querySelector('#print-area-bulk .bulk-item-label').textContent + '|' + document.querySelectorAll('#print-area-bulk b').length), '<b>Bold</b>|0', 'and the same on a label');
    await page.click('label[for="mode-scan"]');
    await settle(page, 200);
    const t = await page.evaluate(() => { const a = document.getElementById('print-area-inventory'); return { n: a.querySelectorAll('b, i, img').length, row: [...a.querySelectorAll('tbody td')].map(c => c.textContent).slice(0, 3).join('|') }; });
    eq(t.n, 0, 'markup in an item\'s name or its borrower makes no element on the inventory sheet');
    eq(t.row, '<b>Scale</b> & <img src=x onerror=alert(1)>|Checked out|<i>Table 3</i>', 'it prints as the text that was saved');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `typed text: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- Ctrl+P: Chromium's own print path, with no button pressed, tab by tab ----------
{
  const page = await open(browser, { inventory: inventoryOf(4), width: Math.round((8.5 - 2 * STOCK.avery5160.marginSide) * IN) });
  const showing = async () => {
    await page.evaluate(() => Promise.all([...document.images].filter(i => i.getAttribute('src')).map(i => i.decode().catch(() => 0))));
    await page.emulateMedia({ media: 'print' }); const m = await onPaper(page, '#print-area-bulk .bulk-item'); await page.emulateMedia({ media: null }); return m; };
  try {
    eq(pdfPageCount(await page.pdf(PDF)), 1, 'Ctrl+P with nothing typed is one page, as it was');
    eq((await showing()).imgBoxes.length, 0, 'with no picture on it, and not a broken one');

    await typeCode(page, SINGLE[0]);
    let buf = await page.pdf(PDF);
    eq(pdfPageCount(buf), 1, 'Ctrl+P on the Single tab prints the code that is on screen, on one page (it printed whatever the button last printed, or nothing)');
    ok(pdfImageCount(buf) >= 1, `as a bitmap (${pdfImageCount(buf)} image objects)`);
    eq((await showing()).decoded.join(), SINGLE[0].text, 'and it is the code for what is typed');
    const was = await page.evaluate(() => document.getElementById('print-img').src);
    await page.fill('#qr-text', 'https://example.com/changed');
    await page.waitForFunction(src => document.getElementById('print-img').src !== src, was);   // the render is debounced
    eq((await showing()).decoded.join(), 'https://example.com/changed', 'typing something else changes the sheet with the screen');

    await makeGrid(page, { sheet: 'avery5160', text: linesOf(31) });
    let m = await showing();
    eq(m.showing, 'print-area-bulk', 'on the Bulk tab Ctrl+P prints the grid');
    eq(m.pageRule, '@page { size: letter portrait; margin: 0.5in 0.1875in; }', 'on the stock\'s own margins, with no button pressed');
    eq(m.boxes[0][1], 0, 'its first label at the top of the printable page');
    buf = await page.pdf(PDF);
    eq(pdfPageCount(buf), 2, '31 labels on two pages');
    ok(pdfImageCount(buf) >= 1, 'with the codes as bitmaps');

    await page.click('label[for="mode-scan"]');
    await settle(page, 200);
    m = await showing();
    eq(m.showing, 'print-area-inventory', 'on the Scan tab Ctrl+P prints the inventory');
    eq(m.pageRule, '@page { size: letter portrait; margin: 0.5in; }', 'on the plain page: the stock\'s margins do not follow it there');
    await page.clock.setFixedTime(new Date('2026-10-05T14:30:00'));
    const before = await page.evaluate(() => document.querySelector('#print-area-inventory p').textContent);
    eq(pdfPageCount(await page.pdf(PDF)), 1, 'four items on one page');
    const after = await page.evaluate(() => document.querySelector('#print-area-inventory p').textContent);
    ok(before !== after && /2:30/.test(after), `and its "Printed" line is the time of this print, not of the last change (${after})`);

    await page.click('label[for="mode-single"]');
    await settle(page, 200);
    m = await showing();
    eq(m.showing, 'print-area', 'back on the Single tab it is the single code again');
    eq(m.pageRule, '@page { size: letter portrait; margin: 0.5in; }', 'on the plain page');
    eq(await page.evaluate(() => window.__printCalls), 0, 'and the page never called print() itself');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `Ctrl+P: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- a button's sheet steps down after it prints, and the page with it ---------------
{
  const page = await open(browser, { inventory: inventoryOf(2) });
  try {
    await makeGrid(page, { sheet: 'avery5163', text: linesOf(3) });
    await press(page, 'btn-bulk-print');
    eq(await page.evaluate(() => document.body.className.includes('print-bulk') + ' ' + document.getElementById('pk-page-style').textContent), 'true @page { size: letter portrait; margin: 0.5in 0.25in; }', 'Print grid on shipping labels: its class and its margins');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    ok(await page.evaluate(() => !document.body.classList.contains('print-bulk')), 'afterprint takes the class off');
    await page.click('label[for="mode-single"]');
    await typeCode(page, SINGLE[0]);
    await press(page, 'btn-print');
    eq(await page.evaluate(() => document.getElementById('pk-page-style').textContent), '@page { size: letter portrait; margin: 0.5in; }', 'Print this code after a sheet of labels is on the plain page, not the stock\'s');
    await page.emulateMedia({ media: 'print' });
    eq((await onPaper(page)).showing, 'print-area', 'and prints the code, not the labels');
    await page.emulateMedia({ media: null });
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `after printing: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- nothing to print ------------------------------------------------------------------
{
  const page = await open(browser);
  try {
    eq(await page.evaluate(() => ['btn-print', 'btn-bulk-print', 'btn-print-inventory'].every(id => document.getElementById(id).disabled)), true, 'with nothing typed, generated or tracked all three print buttons are off');
    await page.click('label[for="mode-bulk"]');
    eq(await page.locator('#print-area-bulk > *').count(), 0, 'and there is no grid sheet');
    eq(pdfPageCount(await page.pdf(PDF)), 1, 'Ctrl+P on the Bulk tab is then one empty page');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `nothing to print: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — ${passed} green`);
