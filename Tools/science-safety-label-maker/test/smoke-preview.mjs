// smoke-preview.mjs — 074 is the first page with the kit's print preview
// (Path 7 P5).
//
//   node Tools/science-safety-label-maker/test/smoke-preview.mjs
//
// `PrintKit.preview()` shows the sheet in #printArea cut into the pages it
// will print on, in a modal dialog, without opening the print dialog. It finds
// the breaks by putting a copy of the sheet in an <iframe> whose body is a
// multi-column box the size of the printable page, with the page's print rules
// applied, so the browser's own fragmentation does the cutting.
//
// What this pins:
//   - "Preview pages" opens the dialog and never calls print()
//   - the preview's page count is Chromium's PDF page count for the same
//     state, in every state smoke-print.mjs prints, light and dark, and on
//     four other papers; and each page holds the labels the paper holds
//     (a row of labels is never split, a page is full before the next starts)
//   - a label in the preview is the size it is on paper, on a white sheet
//   - the dialog is a real modal: named, focus inside it, a status that says
//     "Page 2 of 3", arrow keys, Home and End, Escape; focus goes back to the
//     button; nothing serious from axe with it open
//   - the preview changes nothing: #printArea, the page's style sheets and
//     <html> are as they were, and the dialog is gone from the DOM on close
//   - its Print button closes it and prints through the tool's own button
//   - it fits a phone
//
// print() is stubbed. The PDF is Chromium's; nothing was printed on paper.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8492;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '074-science-safety-label-maker.html';
const KEY = 'sslm_queue_v1';
const IN = 96;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 0.6) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ± ${tol})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const SYMS = ['flammable', 'corrosive', 'toxic', 'biohazard', 'electrical', 'sharp', 'eyeprotect', 'hot', 'fragile', 'none'];
const LONG = 'Hydrochloric acid 1 M, teacher use only, return to locked cabinet B after every period and sign the log on the door';
function queueOf(n, extra = []) {
  const items = [];
  for (let left = n, i = 0; left > 0; i++) {
    const qty = Math.min(left, 7);
    items.push({ id: 'l' + i, symbol: SYMS[i % SYMS.length], text: 'Shelf ' + (i + 1), qty });
    left -= qty;
  }
  return items.concat(extra);
}
const longRow = { id: 'x', symbol: 'corrosive', text: LONG, qty: 1 };

const SIZE = { small: { cols: 4, h: 1.5 * IN }, medium: { cols: 3, h: 2 * IN }, large: { cols: 2, h: 2.75 * IN } };
const GAP = 0.2 * IN;

// The states smoke-print.mjs prints, with the page counts it pins there.
const STATES = [
  { size: 'small', n: 1, pages: 1 },
  { size: 'small', n: 24, pages: 1 },
  { size: 'small', n: 25, pages: 2 },
  { size: 'small', n: 61, pages: 3 },
  { size: 'small', n: 8, long: true, pages: 1 },
  { size: 'medium', n: 3, pages: 1 },
  { size: 'medium', n: 12, pages: 1 },
  { size: 'medium', n: 13, pages: 2 },
  { size: 'medium', n: 30, pages: 3 },
  { size: 'medium', n: 61, pages: 6 },
  { size: 'medium', n: 8, long: true, pages: 1 },
  { size: 'large', n: 6, pages: 1 },
  { size: 'large', n: 7, pages: 2 },
  { size: 'large', n: 30, pages: 5 },
  { size: 'large', n: 8, long: true, pages: 2 },
].map(s => ({ ...s, queue: queueOf(s.n, s.long ? [longRow] : []), total: s.n + (s.long ? 1 : 0), name: `${s.n + (s.long ? 1 : 0)} ${s.size}${s.long ? ', one long' : ''}` }));

// Other papers, set after the page loads: the preview draws the page
// PrintKit.setPage() last wrote, and the PDF is cut on the same one.
const PAPERS = [
  { paper: 'a4', w: 210 * IN / 25.4, h: 297 * IN / 25.4 },
  { paper: 'legal', w: 8.5 * IN, h: 14 * IN },
  { paper: 'a5', w: 148 * IN / 25.4, h: 210 * IN / 25.4 },
  { paper: 'letter', orientation: 'landscape', w: 11 * IN, h: 8.5 * IN },
];
const PAPER_STATES = [STATES[3], STATES[8], STATES[13], STATES[14]];

async function open(browser, saved, theme, view = { width: 1100, height: 900 }) {
  const page = await prepPage(browser, BASE, view);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([key, value, dark]) => {
    if (value) localStorage.setItem(key, value);
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [KEY, saved ? JSON.stringify(saved) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

const READY = 'dialog.pk-preview[data-pk-pages]';
async function openPreview(page) {
  await page.click('#previewBtn');
  await page.waitForSelector(READY, { timeout: 15000 });
  await settle(page, 100);
}

/** What the open preview shows: the count, and which labels are on which page. */
const readPreview = page => page.evaluate(() => {
  const dialog = document.querySelector('dialog.pk-preview');
  const frame = dialog.querySelector('iframe');
  const d = frame.contentDocument;
  const body = d.body;
  const keep = body.style.transform;
  body.style.transform = 'none';
  const pitch = body.getBoundingClientRect().width + 400;
  const cards = [...d.querySelectorAll('.label-card')].map(c => {
    const rs = c.getClientRects();
    return { text: c.querySelector('.ltext').textContent, parts: rs.length, page: Math.floor((rs[0].left + 0.5) / pitch), left: rs[0].left % pitch, top: rs[0].top, w: rs[0].width, h: rs[0].height, bottom: rs[0].bottom };
  });
  const sheet = d.querySelector('[data-pk-preview-root]');
  const cs = d.defaultView.getComputedStyle(sheet);
  const out = {
    pages: Number(dialog.getAttribute('data-pk-pages')),
    status: dialog.querySelector('.pk-preview-status').textContent,
    cards,
    perPage: cards.reduce((a, c) => { a[c.page] = (a[c.page] || 0) + 1; return a; }, []),
    bodyH: body.getBoundingClientRect().height, bodyW: body.getBoundingClientRect().width,
    sheet: { display: cs.display, position: cs.position, bg: cs.backgroundColor, color: cs.color, id: sheet.id, cls: sheet.className },
    inkColor: d.defaultView.getComputedStyle(d.querySelector('.ltext')).color,
    compat: d.compatMode,
    frameBox: [frame.style.left, frame.style.top, frame.style.width, frame.style.height],
    paperBox: [dialog.querySelector('.pk-preview-sheet').style.width, dialog.querySelector('.pk-preview-sheet').style.height],
  };
  body.style.transform = keep;
  return out;
});

const snapshot = page => page.evaluate(() => ({
  area: document.getElementById('printArea').outerHTML,
  sheets: [...document.styleSheets].map(s => (s.ownerNode.tagName + ':' + (s.href || s.ownerNode.textContent.length) + ':' + s.media.mediaText + ':' + s.cssRules.length)).join('|'),
  html: [...document.documentElement.attributes].map(a => a.name + '=' + a.value).join('|'),
  body: document.body.className + '|' + (document.body.getAttribute('style') || ''),
  kids: document.body.children.length,
  dialogs: document.querySelectorAll('dialog.pk-preview, iframe.pk-preview-frame').length,
}));

console.log('074 — the print preview (PrintKit.preview)');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/<button type="button" class="secondary" id="previewBtn">Preview pages<\/button>/.test(src), 'the page has a "Preview pages" button, a real <button>');
ok(src.indexOf('id="previewBtn"') < src.indexOf('id="printBtn"'), 'before "Print labels"');
ok(/PrintKit\.preview\(\{ trigger: els\.previewBtn, onPrint: printSheet \}\)/.test(src), 'it calls PrintKit.preview(), handing over the button and the tool\'s own print');
ok(!/@media\s+print/.test(src) && !/@page/.test(src), 'and the page still has no print rule of its own');

const server = await serve(PORT);
const browser = await launch();

// ---- the count is the PDF's, in every state ----------------------------------
for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const size = SIZE[s.size];
    const page = await open(browser, { queue: s.queue, labelSize: s.size }, theme);
    try {
      await openPreview(page);
      const p = await readPreview(page);
      eq(await page.evaluate(() => window.__printCalls), 0, `${what}: the preview did not call print()`);
      eq(p.pages, s.pages, `${what}: the preview is ${s.pages} page${s.pages === 1 ? '' : 's'}`);
      eq(p.status, `Page 1 of ${s.pages}`, `${what}: and says so`);
      eq(p.cards.length, s.total, `${what}: every label is in it`);
      eq(p.cards.filter(c => c.parts !== 1).length, 0, `${what}: no label is split across two pages`);
      eq(p.perPage.length, s.pages, `${what}: no page of the count is empty`);
      ok(p.cards.every((c, i) => i === 0 || c.page >= p.cards[i - 1].page), `${what}: the labels run on in order`);
      ok(p.cards.every(c => c.bottom <= p.bodyH + 0.6 && c.top >= -0.6), `${what}: each label is inside its page`);
      if (!s.long) {
        const perPage = Math.floor((p.bodyH + GAP) / (size.h + GAP)) * size.cols;
        eq(p.perPage, Array.from({ length: s.pages }, (_, i) => Math.min(perPage, s.total - i * perPage)), `${what}: ${perPage} to a page, the last page the rest`);
        ok(p.cards.every(c => Math.abs(c.h - size.h) <= 0.6), `${what}: a label is ${size.h / IN} in tall, as on paper`);
        const w = (p.bodyW - (size.cols - 1) * GAP) / size.cols;
        ok(p.cards.every(c => Math.abs(c.w - w) <= 0.6), `${what}: and ${size.cols} across the printable width`);
      }
      near(p.bodyW, 7.5 * IN, `${what}: a page is 7.5 in wide`);
      near(p.bodyH, 10 * IN, `${what}: and 10 in tall`);
      eq(p.paperBox, ['816px', '1056px'], `${what}: on Letter paper`);
      eq(p.frameBox, ['48px', '48px', '720px', '960px'], `${what}: inside half-inch margins`);
      eq(p.compat, 'CSS1Compat', `${what}: the frame is in standards mode`);
      eq([p.sheet.id, p.sheet.display, p.sheet.position], ['printArea', 'block', 'static'], `${what}: the sheet is shown in the frame (the screen rule hides it), in the flow`);
      eq([p.sheet.bg, p.sheet.color, p.inkColor], ['rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)'], `${what}: white paper and black text, as .pk-paper prints it`);

      await page.keyboard.press('Escape');
      await settle(page, 100);
      await page.emulateMedia({ media: null });
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(p.pages, pdf, `${what}: the preview's count is Chromium's PDF page count`);
    } finally { await page.context().close(); }
  }
}

// ---- other papers ---------------------------------------------------------------
for (const paper of PAPERS) {
  for (const s of PAPER_STATES) {
    const what = `${paper.paper}${paper.orientation ? ' ' + paper.orientation : ''}, ${s.name}`;
    const page = await open(browser, { queue: s.queue, labelSize: s.size }, 'light');
    try {
      await page.evaluate(p => { PrintKit.setPage({ paper: p.paper, orientation: p.orientation, margin: '0.5in' }); }, paper);
      await openPreview(page);
      const p = await readPreview(page);
      near(parseFloat(p.paperBox[0]), paper.w, `${what}: the paper is as wide as the page setPage() wrote`, 0.01);
      near(parseFloat(p.paperBox[1]), paper.h, `${what}: and as tall`, 0.01);
      near(p.bodyW, paper.w - IN, `${what}: the printable width`, 0.05);
      near(p.bodyH, paper.h - IN, `${what}: the printable height`, 0.05);
      eq(p.cards.filter(c => c.parts !== 1).length, s.long && paper.paper === 'a5' ? p.cards.filter(c => c.parts !== 1).length : 0, `${what}: no label is split`);
      eq(p.cards.length, s.total, `${what}: every label is in it`);
      await page.keyboard.press('Escape');
      await settle(page, 100);
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(p.pages, pdf, `${what}: the preview's count is Chromium's PDF page count (${pdf})`);
      ok(pdf >= 1 && (paper.paper !== 'legal' || pdf <= s.pages), `${what}: and a taller paper takes no more pages`);
    } finally { await page.context().close(); }
  }
}

// ---- the dialog: keyboard, names, focus, and nothing left behind -----------------
{
  const s = STATES[8]; // 30 medium labels, three pages
  const page = await open(browser, { queue: s.queue, labelSize: s.size }, 'light');
  try {
    // Build the sheet once first, so "before" is the sheet the preview shows.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    const before = await snapshot(page);
    eq(before.dialogs, 0, 'no preview is in the page until it is asked for');

    await page.focus('#previewBtn');
    await page.keyboard.press('Enter');
    await page.waitForSelector(READY, { timeout: 15000 });
    await settle(page, 100);
    const d = await page.evaluate(() => {
      const dialog = document.querySelector('dialog.pk-preview');
      const status = dialog.querySelector('.pk-preview-status');
      const frame = dialog.querySelector('iframe');
      const r = dialog.getBoundingClientRect();
      const fit = dialog.querySelector('.pk-preview-fit').getBoundingClientRect();
      const stage = dialog.querySelector('.pk-preview-stage').getBoundingClientRect();
      return {
        open: dialog.open, modal: dialog.matches(':modal'),
        name: document.getElementById(dialog.getAttribute('aria-labelledby')).textContent,
        heading: dialog.querySelector('h2').textContent,
        role: status.getAttribute('role'), status: status.textContent,
        frameTitle: frame.title, frameTab: frame.getAttribute('tabindex'),
        focus: document.activeElement.className, focusIn: dialog.contains(document.activeElement),
        buttons: [...dialog.querySelectorAll('button')].map(b => [b.textContent, b.type, b.getAttribute('aria-disabled')]),
        inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        whole: fit.left >= stage.left && fit.right <= stage.right + 0.5 && fit.top >= stage.top && fit.bottom <= stage.bottom + 0.5,
        ratio: fit.width / fit.height,
        scale: dialog.querySelector('.pk-preview-sheet').style.transform,
      };
    });
    ok(d.open && d.modal, 'Enter on the button opens a modal dialog');
    eq([d.name, d.heading], ['Print preview', 'Print preview'], 'named by its heading');
    eq([d.role, d.status], ['status', 'Page 1 of 3'], 'with a status region that reads "Page 1 of 3"');
    ok(d.frameTitle.length > 0 && d.frameTab === '-1', 'the frame has a title and is not a tab stop');
    ok(d.focusIn, `focus is inside the dialog (on ${d.focus})`);
    eq(d.buttons, [['Previous page', 'button', 'true'], ['Next page', 'button', 'false'], ['Print…', 'button', null], ['Close', 'button', null]], 'Previous (not available on page 1), Next, Print and Close, each a named button');
    ok(d.inView, 'the dialog is inside the window');
    ok(d.whole, 'and the whole page is in view, not a corner of it');
    near(d.ratio, 8.5 / 11, 'drawn in the paper\'s proportions', 0.005);
    ok(/^scale\((0\.\d+|1)\)$/.test(d.scale), `scaled to fit, never enlarged (${d.scale})`);

    const violations = await a11yScan(page, { impact: 'serious' });
    eq(violations.map(v => v.id), [], 'axe finds nothing serious with the preview open');

    const at = () => page.evaluate(() => {
      const dialog = document.querySelector('dialog.pk-preview');
      const d = dialog.querySelector('iframe').contentDocument;
      const first = [...d.querySelectorAll('.label-card')].findIndex(c => { const r = c.getBoundingClientRect(); return r.left >= -1 && r.left < d.defaultView.innerWidth; });
      return [dialog.querySelector('.pk-preview-status').textContent, first,
        dialog.querySelector('.pk-preview-prev').getAttribute('aria-disabled'), dialog.querySelector('.pk-preview-next').getAttribute('aria-disabled'),
        dialog.contains(document.activeElement)];
    });
    eq(await at(), ['Page 1 of 3', 0, 'true', 'false', true], 'page 1 shows the first label');
    await page.keyboard.press('ArrowRight');
    eq(await at(), ['Page 2 of 3', 12, 'false', 'false', true], 'Right arrow: page 2, which starts at the thirteenth label');
    await page.keyboard.press('PageDown');
    eq(await at(), ['Page 3 of 3', 24, 'false', 'true', true], 'Page Down: page 3, the twenty-fifth');
    await page.keyboard.press('ArrowRight');
    eq(await at(), ['Page 3 of 3', 24, 'false', 'true', true], 'and no further');
    await page.keyboard.press('Home');
    eq((await at())[0], 'Page 1 of 3', 'Home: the first page');
    await page.keyboard.press('End');
    eq((await at())[0], 'Page 3 of 3', 'End: the last');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('PageUp');
    eq((await at())[0], 'Page 1 of 3', 'Left arrow and Page Up go back');
    await page.click('.pk-preview-prev', { force: true }); // aria-disabled: Playwright would wait for it
    eq((await at())[0], 'Page 1 of 3', 'Previous on page 1 does nothing');
    await page.click('.pk-preview-next');
    eq(await at(), ['Page 2 of 3', 12, 'false', 'false', true], 'the Next button turns the page, and keeps the focus');
    const seen = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => document.querySelector('dialog.pk-preview').contains(document.activeElement) ? document.activeElement.textContent : document.activeElement === document.body ? '(the browser)' : 'the page behind: ' + document.activeElement.id)); }
    // A modal dialog hands Tab to the browser's own controls after its last
    // button; in a headless page that reads as <body>. What must never get
    // the focus is a control of the page behind the dialog.
    ok(!seen.some(x => x.startsWith('the page behind')), `Tab never reaches the page behind the dialog (${seen.join(', ')})`);
    ok(['Previous page', 'Next page', 'Print…', 'Close'].every(b => seen.includes(b)), 'and reaches every button');
    eq(await page.evaluate(() => window.__printCalls), 0, 'none of that called print()');

    await page.keyboard.press('Escape');
    await settle(page, 100);
    eq(await page.evaluate(() => document.activeElement.id), 'previewBtn', 'Escape closes it and the focus is back on the button');
    eq(await snapshot(page), before, 'and the page is as it was: the sheet, the style sheets, <html>, <body>, and no dialog or frame left in it');

    // Close button, then the preview's own Print.
    await openPreview(page);
    await page.click('.pk-preview-close');
    await settle(page, 100);
    eq((await snapshot(page)).dialogs, 0, 'the Close button closes it');
    await openPreview(page);
    await page.click('.pk-preview-print');
    await settle(page, 150);
    eq([(await snapshot(page)).dialogs, await page.evaluate(() => window.__printCalls)], [0, 1], 'its Print button closes it and prints, once');

    // Opened twice without closing: one dialog, not two.
    const twice = await page.evaluate(async () => {
      const a = PrintKit.preview({});
      const b = await PrintKit.preview({});
      await a;
      const n = document.querySelectorAll('dialog.pk-preview').length;
      const pages = b.pages; const went = [b.go(2), b.go(99), b.go(-4), b.go('x')];
      b.close();
      return [n, pages, went, document.querySelectorAll('dialog.pk-preview').length];
    });
    eq(twice, [1, 3, [2, 3, 1, 1], 0], 'a second preview() replaces the first; go() is held to the pages there are; close() takes it away');
  } finally { await page.context().close(); }
}

// ---- nothing to preview ---------------------------------------------------------
{
  const page = await open(browser, { queue: [], labelSize: 'medium' }, 'light');
  try {
    let said = '';
    page.on('dialog', async dlg => { said = dlg.message(); await dlg.accept(); });
    await page.click('#previewBtn');
    await settle(page, 200);
    eq(said, 'Add at least one label first.', 'with no labels the button says so, as Print does');
    eq(await page.locator('dialog.pk-preview').count(), 0, 'and opens no preview');
  } finally { await page.context().close(); }
}

// ---- on a phone -----------------------------------------------------------------
{
  const s = STATES[8];
  const page = await open(browser, { queue: s.queue, labelSize: s.size }, 'light', { width: 375, height: 667 });
  try {
    // 074's own queue row is 26 px wider than a 375 px phone (the same before
    // the preview, and not this suite's to fix): the preview must not add to it.
    const wasWide = await page.evaluate(() => document.documentElement.scrollWidth);
    await openPreview(page);
    const m = await page.evaluate(wasWide => {
      const dialog = document.querySelector('dialog.pk-preview');
      const r = dialog.getBoundingClientRect();
      const fit = dialog.querySelector('.pk-preview-fit').getBoundingClientRect();
      const stage = dialog.querySelector('.pk-preview-stage').getBoundingClientRect();
      const buttons = [...dialog.querySelectorAll('button')].map(b => b.getBoundingClientRect());
      return {
        inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        whole: fit.left >= stage.left && fit.right <= stage.right + 0.5 && fit.bottom <= stage.bottom + 0.5,
        buttons: buttons.every(b => b.left >= r.left && b.right <= r.right && b.width > 0),
        pages: dialog.getAttribute('data-pk-pages'),
        sideways: document.documentElement.scrollWidth <= wasWide,
        stage: (s => s.scrollWidth <= s.clientWidth && s.scrollHeight <= s.clientHeight)(dialog.querySelector('.pk-preview-stage')),
      };
    }, wasWide);
    ok(m.inView, 'phone: the dialog is inside a 375 x 667 window');
    ok(m.whole, 'phone: the whole page is in view');
    ok(m.buttons, 'phone: every button is inside the dialog');
    eq(m.pages, '3', 'phone: the count does not depend on the window (3 pages)');
    ok(m.sideways, 'phone: the preview makes the page no wider than it was');
    ok(m.stage, 'phone: and the page of the preview needs no scrolling');
  } finally { await page.context().close(); }
}

await browser.close();
await new Promise(r => server.close(r));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — ${passed} green`);
