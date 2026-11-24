// smoke-pdfin.mjs — 011 Image -> PDF, Path 17 P3: a PDF's pages come in as images.
//
//   node Tools/image-to-pdf/test/smoke-pdfin.mjs     (npm run test:image-to-pdf-pdfin)
//
// The fixture PDFs are made inside the page by ExportKit.toPdf (page i is one
// flat grey), so no binary is committed and nothing comes from the network.
// Made-up names only. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';

const PORT = 8667;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '011-image-to-pdf.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'img2pdf-pdfin-'));

console.log('011 — PDF pages in as images');

{
  const html = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  ok(!srcs.some(s => /pdfjs/.test(s)), 'pdf.js is not a script tag of the page (it loads only when a PDF is chosen)');
  ok(/_shared\/vendor\/pdfjs\/pdf\.min\.js/.test(html) && !/cdn|https?:\/\//i.test(html.match(/loadScriptOnce\('[^']*'\)/g).join('')), 'it loads the one vendored copy, no CDN');
}

const server = await serve(PORT);
const browser = await launch();

async function open() {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
  await page.addInitScript(() => { window.__pdfjsScripts = 0; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.tagName === 'SCRIPT' && /pdfjs/.test(n.src)) window.__pdfjsScripts++; }))).observe(document, { childList: true, subtree: true }); });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  return page;
}

// A PDF of n flat-grey pages (page sizes given), as base64, built in the page.
async function makePdf(page, n, opts = {}) {
  const b64 = await page.evaluate(({ n, greys, size, password, landscape }) => {
    let doc;
    if (password) {
      doc = new jspdf.jsPDF({ unit: 'pt', format: [size.w, size.h], encryption: { userPassword: password, ownerPassword: password } });
      for (let i = 0; i < n; i++) { if (i) doc.addPage([size.w, size.h]); doc.setFillColor(greys[i], greys[i], greys[i]); doc.rect(0, 0, size.w, size.h, 'F'); }
    } else {
      const pages = Array.from({ length: n }, (_, i) => ({ draw: (d, s) => { d.setFillColor(greys[i], greys[i], greys[i]); d.rect(0, 0, s.w, s.h, 'F'); } }));
      doc = ExportKit.toPdf(pages, (landscape ? { orientation: 'landscape', margin: 0 } : { pageSize: { w: size.w, h: size.h }, margin: 0 })).doc;
    }
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }, { n, greys: Array.from({ length: n }, (_, i) => 50 + i * 60), size: opts.size || { w: 612, h: 792 }, password: opts.password || null, landscape: !!opts.landscape });
  return Buffer.from(b64, 'base64');
}

const names = page => page.$$eval('#file-list .filename', els => els.map(e => e.textContent));
const msgOf = page => page.evaluate(() => document.getElementById('msg').textContent);
// The mean grey of each queued thumbnail, in queue order (the thumbs are blob URLs of the page PNGs).
const greys = page => page.evaluate(async () => {
  const out = [];
  for (const img of document.querySelectorAll('#file-list img.thumb')) {
    const im = new Image(); im.src = img.src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    out.push({ g: x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[0], w: im.naturalWidth, h: im.naturalHeight });
  }
  return out;
});
async function pick(page, name, buffer, mimeType = 'application/pdf') {
  await page.setInputFiles('#file-input', [{ name, mimeType, buffer }]);
}
// A PDF of more than one page asks which pages first; this takes the default (all ticked).
async function pickAdd(page, name, buffer) {
  await pick(page, name, buffer);
  await page.click('#pp-add', { timeout: 30000 });
}
async function waitQueue(page, n) {
  await page.waitForFunction(k => document.querySelectorAll('#file-list li').length === k, n, { timeout: 30000 });
  await settle(page, 150);
}

// ---- 1. a 3-page PDF: three entries, in order, drawn from the right pages ----
{
  const page = await open();
  eq(await page.evaluate(() => window.__pdfjsScripts + (window.pdfjsLib ? 1 : 0)), 0, 'pdf.js is not loaded before a PDF is chosen');
  const pdf = await makePdf(page, 3);
  ok(pdf.subarray(0, 5).toString() === '%PDF-', 'the fixture is a real PDF');
  await pickAdd(page, 'Unit_Test_Invented.pdf', pdf);
  await waitQueue(page, 3);
  eq(await page.evaluate(() => window.__pdfjsScripts), 2, 'choosing a PDF loads pdf.js and its worker, once each');
  eq(await names(page), ['Unit_Test_Invented p1.png', 'Unit_Test_Invented p2.png', 'Unit_Test_Invented p3.png'], 'three entries named "<file> pN", in page order');
  const g = await greys(page);
  ok(g.every((x, i) => Math.abs(x.g - (50 + i * 60)) <= 2), `each entry shows its own page, greys 50, 110, 170 (got ${JSON.stringify(g.map(x => x.g))})`);
  eq([g[0].w, g[0].h], [1600, 2071], 'a Letter page is drawn 1600 px wide');
  ok(/Added 3 pages from PDF/.test(await msgOf(page)), `the message says 3 pages were added (got "${await msgOf(page)}")`);
  ok(/becomes part of the picture|can no longer be selected/.test(await page.textContent('#pdf-help')), 'the help text says a text PDF becomes pictures');

  // Re-adding the same PDF adds nothing.
  await pick(page, 'Unit_Test_Invented.pdf', pdf);
  await settle(page, 600);
  eq((await names(page)).length, 3, 'the same PDF again adds nothing');
  ok(/already in the queue/.test(await msgOf(page)), 'and says so');

  // ---- 2. rotate, delete, reorder work on pages ----
  await page.click('#file-list li:nth-child(2) [data-act="rotate"]');
  ok(/currently 90/.test(await page.getAttribute('#file-list li:nth-child(2) [data-act="rotate"]', 'aria-label')), 'rotate works on a page');
  await page.click('#file-list li:nth-child(1) [data-act="remove"]');
  eq(await names(page), ['Unit_Test_Invented p2.png', 'Unit_Test_Invented p3.png'], 'removing page 1 leaves pages 2 and 3');
  await page.click('label[for="sort-custom"]');
  await page.click('#file-list li:nth-child(1) [data-act="down"]');
  eq(await names(page), ['Unit_Test_Invented p3.png', 'Unit_Test_Invented p2.png'], 'a page can be moved down');

  // ---- 3. generate: the pages merge into one PDF, rotated page included ----
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#btn-generate')]);
  const bytes = fs.readFileSync(await dl.path());
  eq((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 2, 'Generate makes a 2-page PDF from the remaining pages');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 4. a PDF merges with a picture, and numeric sort puts p2 before p10 ----
{
  const page = await open();
  const pdf = await makePdf(page, 12, { landscape: true });
  await pickAdd(page, 'Twelve.pdf', pdf);
  await waitQueue(page, 12);
  const n = await names(page);
  eq([n[0], n[1], n[9], n[11]], ['Twelve p1.png', 'Twelve p2.png', 'Twelve p10.png', 'Twelve p12.png'], 'pages 1-12 sort in page order (p2 before p10)');
  const g = await greys(page);
  eq([g[0].w, g[0].h], [1600, 1236], 'a landscape page keeps its shape at 1600 px wide');
  await page.context().close();
}

// ---- 5. refusals: not a PDF, truncated, locked ----
{
  const page = await open();
  await pick(page, 'Notes_Invented.pdf', Buffer.from('this is plain text, not a PDF'), 'application/pdf');
  await settle(page, 800);
  eq((await names(page)).length, 0, 'a file named .pdf that is not one adds nothing');
  ok(/couldn.t be read/.test(await msgOf(page)) && /Notes_Invented\.pdf/.test(await msgOf(page)), `and says so by name (got "${await msgOf(page)}")`);

  const good = await makePdf(page, 3);
  await pick(page, 'Cut_Short.pdf', good.subarray(0, Math.floor(good.length / 3)));
  await settle(page, 800);
  eq((await names(page)).length, 0, 'a truncated PDF adds nothing');
  ok(/couldn.t be read|couldn.t be drawn/.test(await msgOf(page)), `and says so (got "${await msgOf(page)}")`);

  const locked = await makePdf(page, 2, { password: 'invented-pw' });
  await pick(page, 'Locked_Invented.pdf', locked);
  await settle(page, 800);
  eq((await names(page)).length, 0, 'a password-locked PDF adds nothing');
  ok(/locked with a password/.test(await msgOf(page)), `and says why in a plain sentence (got "${await msgOf(page)}")`);

  // A good PDF still works afterward, and a picture and a PDF go in together.
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30); return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('#file-input', [
    { name: '0-cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') },
    { name: 'Good.pdf', mimeType: 'application/pdf', buffer: good }]);
  await page.click('#pp-add', { timeout: 30000 });
  await waitQueue(page, 4);
  eq((await names(page))[0], '0-cover.png', 'a picture and a PDF can be added together');
  eq(page.__errs.filter(e => !/Failed to load resource|Invalid PDF|Warning/.test(String(e))).length, 0, `no unexpected page errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 6. the cap: 101 pages -> 100, and it says so ----
{
  const page = await open();
  const big = await makePdf(page, 101, { size: { w: 40, h: 40 } });
  await pickAdd(page, 'Hundred_One.pdf', big);
  await waitQueue(page, 100);
  await settle(page, 300);
  eq((await names(page)).length, 100, 'a 101-page PDF adds 100 pages (the first 100 start ticked)');
  ok(/100 were added|Added 100 pages/.test(await msgOf(page)), `and says 100 were added (got "${await msgOf(page)}")`);
  await page.context().close();
}

// ---- 7. the picker: range field, ticks, Select all / none, cancel, keyboard, 390 px ----
{
  const page = await open();
  const pdf = await makePdf(page, 10, { size: { w: 200, h: 260 } });
  await pick(page, 'Ten.pdf', pdf);
  await page.waitForSelector('dialog.pp-dialog[open]', { timeout: 30000 });
  const ticked = () => page.$$eval('.pp-grid input:checked', els => els.map(e => +e.value));
  eq((await ticked()).length, 10, 'all ten pages start ticked');
  eq((await names(page)).length, 0, 'nothing is in the queue until Add pages is pressed');
  ok(await page.evaluate(() => document.querySelector('dialog.pp-dialog').getAttribute('aria-labelledby') === 'pp-title' && /Ten\.pdf/.test(document.getElementById('pp-title').textContent)), 'the dialog is named by its title, which names the file');
  // Thumbnails draw (an undrawn canvas is transparent).
  await page.waitForFunction(() => { const c = document.querySelectorAll('.pp-grid canvas'); return c.length === 10 && [...c].every(x => x.getContext('2d').getImageData(x.width >> 1, x.height >> 1, 1, 1).data[3] > 0); }, null, { timeout: 30000 });
  ok(true, 'every thumbnail is drawn');

  await page.click('#pp-none');
  eq(await ticked(), [], 'Select none unticks everything');
  ok(await page.isDisabled('#pp-add'), 'and Add pages is disabled with nothing ticked');
  await page.click('#pp-all');
  eq((await ticked()).length, 10, 'Select all ticks everything again');

  await page.fill('#pp-range', '1-3, 7');
  eq(await ticked(), [1, 2, 3, 7], 'the range "1-3, 7" ticks pages 1, 2, 3 and 7');
  await page.fill('#pp-range', '9 - 10,2');
  eq(await ticked(), [2, 9, 10], 'spaces around a dash and a lone page are read');
  await page.fill('#pp-range', '1-3, 7');
  await page.fill('#pp-range', '4-12');
  ok(/out of range/.test(await page.textContent('#pp-status')) && await page.isDisabled('#pp-add'), 'a page past the end is refused in words and Add pages is disabled');
  await page.fill('#pp-range', '5-3');
  ok(/backwards/.test(await page.textContent('#pp-status')), 'a backwards range is refused in words');
  await page.fill('#pp-range', 'two');
  ok(/isn.t a page/.test(await page.textContent('#pp-status')), 'a word is refused in words');
  await page.fill('#pp-range', '1-3, 7');

  // A tick changes the field, and the field the ticks.
  await page.uncheck('.pp-grid input[value="2"]');
  eq(await page.inputValue('#pp-range'), '1, 3, 7', 'unticking page 2 rewrites the field to "1, 3, 7"');

  // Keyboard: Tab reaches a checkbox and Space toggles it; the label is the page number.
  await page.focus('.pp-grid input[value="4"]');
  await page.keyboard.press('Space');
  eq(await ticked(), [1, 3, 4, 7], 'Space on a focused page checkbox ticks it');
  eq(await page.evaluate(() => document.activeElement.closest('label').textContent.trim()), 'Page 4', 'its accessible name is "Page 4"');
  await page.keyboard.press('Space');

  await page.click('#pp-add');
  await waitQueue(page, 3);
  eq(await names(page), ['Ten p1.png', 'Ten p3.png', 'Ten p7.png'], 'only the ticked pages come in, in page order');
  const g = await greys(page);
  ok(Math.abs(g[0].g - 50) <= 2 && Math.abs(g[1].g - 170) <= 2, `and page 1 and page 3 are the right pages (greys 50 and 170, got ${JSON.stringify(g.map(x => x.g))})`);
  ok(!(await page.$('dialog.pp-dialog')), 'the dialog is gone');
  await page.context().close();
}
{
  // Cancel, and Escape, add nothing.
  const page = await open();
  const pdf = await makePdf(page, 4, { size: { w: 200, h: 260 } });
  await pick(page, 'Four.pdf', pdf);
  await page.waitForSelector('dialog.pp-dialog[open]');
  await page.click('#pp-cancel');
  await settle(page, 300);
  eq((await names(page)).length, 0, 'Cancel adds nothing');
  ok(/no pages were added/.test(await msgOf(page)), `and says so (got "${await msgOf(page)}")`);
  await pick(page, 'Four.pdf', pdf);
  await page.waitForSelector('dialog.pp-dialog[open]');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  eq((await names(page)).length, 0, 'Escape adds nothing');
  ok(!(await page.$('dialog.pp-dialog')), 'and closes the dialog');
  await pickAdd(page, 'Four.pdf', pdf);
  await waitQueue(page, 4);
  ok(true, 'the same PDF can be chosen again after a cancel');
  await page.context().close();
}
{
  // 390 px: the dialog fits, nothing scrolls sideways, buttons are reachable.
  const page = await prepPage(browser, BASE, { width: 390, height: 780 });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  const pdf = await makePdf(page, 30, { size: { w: 200, h: 260 } });
  await pick(page, 'Thirty.pdf', pdf);
  await page.waitForSelector('dialog.pp-dialog[open]', { timeout: 30000 });
  const m = await page.evaluate(() => { const d = document.querySelector('dialog.pp-dialog'); const r = d.getBoundingClientRect(); return { l: r.left, r: r.right, sw: d.scrollWidth, cw: d.clientWidth }; });
  ok(m.l >= 0 && m.r <= 390 && m.sw <= m.cw, `the dialog fits 390 px with no sideways scroll (${JSON.stringify(m)})`);
  await page.locator('#pp-add').scrollIntoViewIfNeeded();
  const b = await page.evaluate(() => { const r = document.getElementById('pp-add').getBoundingClientRect(); return { r: r.right, b: r.bottom, h: innerHeight }; });
  ok(b.r <= 390 && b.b <= b.h, `Add pages is reachable on screen (${JSON.stringify(b)})`);
  await page.click('#pp-none');
  await page.fill('#pp-range', '30');
  await page.click('#pp-add');
  await waitQueue(page, 1);
  eq(await names(page), ['Thirty p30.png'], 'a one-page pick from 30 works');
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
