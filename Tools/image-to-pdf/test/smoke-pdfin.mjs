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
  await pick(page, 'Unit_Test_Invented.pdf', pdf);
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
  await pick(page, 'Twelve.pdf', pdf);
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
  await waitQueue(page, 4);
  eq((await names(page))[0], '0-cover.png', 'a picture and a PDF can be added together');
  eq(page.__errs.filter(e => !/Failed to load resource|Invalid PDF|Warning/.test(String(e))).length, 0, `no unexpected page errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// ---- 6. the cap: 101 pages -> 100, and it says so ----
{
  const page = await open();
  const big = await makePdf(page, 101, { size: { w: 40, h: 40 } });
  await pick(page, 'Hundred_One.pdf', big);
  await waitQueue(page, 100);
  await settle(page, 300);
  eq((await names(page)).length, 100, 'a 101-page PDF adds 100 pages');
  ok(/101 pages; only the first 100/.test(await msgOf(page)), `and says plainly that it was cut (got "${await msgOf(page)}")`);
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
