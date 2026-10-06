// smoke-pdf-export.mjs — 064's "Download PDF" through the shared export layer
// (Path 7 P4, the layer's first adopter).
//
//   node Tools/historical-trading-card-maker/test/smoke-pdf-export.mjs
//   (or: npm run test:trading-card-pdf)
//
// htcm-export.js's exportPdf() used to place every card by hand and take its
// backs from _shared/duplex-print.js. It now asks ExportKit for the cut into
// pages (paginate), the cell behind each front (mirrorPage) and the sheet
// (toPdf, 3 x 2 on letter); it still draws the cards and names the file.
// Before the move the old export was saved for eight decks and compared with
// the new: the same pages, the same JPEG bytes in the same order, every box
// within 1e-13 pt, and the same pixels from `pdftoppm -r 96` on 24 of 24
// pages. That comparison is not rerun here. What this pins is the file itself,
// read with a PDF reader written below, which needs no outside program:
//
//   - one PDF page a side, letter portrait, fronts first and then backs
//   - each card 2.5 x 3.5 in, 0.15 in apart, the grid centred on the sheet
//   - WHICH card is in each cell: every image in the file is matched, byte
//     for byte, to the JPEG the page renders for one card's front or back
//   - every back is in the cell behind its own front when the sheet is turned
//     on its long edge
//   - the file's name, and the button coming back when the export is done
//   - the page loads export.js and no longer loads duplex-print.js
//
// Since Path 7 P4 increment 4 the same module's zip and PNG downloads go
// through ExportKit's file helpers too (toZip and download, their first
// adopter), and this suite reads those files as well:
//
//   - "All PNGs (zip)": the file's name, one front and one back PNG per card
//     in deck order under the names the old export gave them, every entry the
//     very PNG the page renders for that card (read by the zip reader the
//     export suites wrote, which checks each CRC itself), through one call to
//     ExportKit.toZip()
//   - "Download PNG": two files, the showing card's front and back
//
// Before the move the old zip was compared with the new for six decks: the
// same entries in the same order with the same bytes inside; the new file is
// deflated where the old one was stored. That comparison is not rerun here.
//
// Nothing here has been printed, and no sheet has been through a duplex unit.
// Made-up cards only. Exits 1 on any failure.

/* global HtcmExport -- 064's export module, called inside page.evaluate() to render each card */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { readZip } from '../../export/test/_zip-read.mjs';

const PORT = 8481;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '064-historical-trading-card-maker.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const sha = buf => crypto.createHash('sha1').update(buf).digest('hex');

// The sheet, in points: what the old export drew.
const COLS = 3, ROWS = 2, PER = COLS * ROWS, W = 2.5 * 72, H = 3.5 * 72, GAP = 0.15 * 72;
const MX = (612 - (COLS * W + (COLS - 1) * GAP)) / 2, MY = (792 - (ROWS * H + (ROWS - 1) * GAP)) / 2;
const cell = i => ({ left: MX + (i % COLS) * (W + GAP), top: MY + Math.floor(i / COLS) * (H + GAP) });
/** The cell a card's back is in, for a portrait sheet turned on its long edge. */
const behind = i => Math.floor(i / COLS) * COLS + (COLS - 1 - i % COLS);

/** The pages of a jsPDF file: [{ box: [w, h], images: [{ sha, left, top, w, h, skew }] }],
    points, y down. Every `Do` is placed by the matrices in force when it runs. */
function readPdf(buf) {
  const s = buf.toString('latin1');
  const obj = n => { const m = new RegExp('(?:^|\\n)' + n + ' 0 obj\\n').exec(s); const at = m.index + m[0].length; return { at, head: s.slice(at, s.indexOf('endobj', at)) }; };
  const streamOf = n => { const o = obj(n); const start = s.indexOf('stream\n', o.at) + 7; return buf.subarray(start, start + Number(/\/Length (\d+)/.exec(o.head)[1])); };
  const names = {};
  for (const m of s.matchAll(/\/(I\d+) (\d+) 0 R/g)) names[m[1]] = sha(streamOf(+m[2]));
  const mul = (m, c) => [m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3], m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3], m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]];
  const pages = [];
  for (const m of s.matchAll(/<<\s*\/Type \/Page\n([\s\S]*?)>>\nendobj/g)) {
    const box = /\/MediaBox \[([^\]]+)\]/.exec(m[1])[1].trim().split(/\s+/).map(Number);
    const tok = streamOf(+/\/Contents (\d+) 0 R/.exec(m[1])[1]).toString('latin1').split(/\s+/).filter(Boolean);
    const stack = [], images = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < tok.length; i++) {
      if (tok[i] === 'q') stack.push(ctm);
      else if (tok[i] === 'Q') ctm = stack.pop();
      else if (tok[i] === 'cm') ctm = mul(tok.slice(i - 6, i).map(Number), ctm);
      else if (tok[i] === 'Do') images.push({ sha: names[tok[i - 1].slice(1)], left: ctm[4], top: box[3] - (ctm[5] + ctm[3]), w: ctm[0], h: ctm[3], skew: [ctm[1], ctm[2]] });
    }
    pages.push({ box: [box[2], box[3]], images });
  }
  return pages;
}

const deck = (n, theme, setName) => ({
  v: 2, settings: { size: 'standard', theme },
  cards: Array.from({ length: n }, (_, i) => ({
    id: 'c' + i, name: 'Figure ' + (i + 1), image: null,
    stats: [{ label: 'Born', value: String(1700 + i) }, { label: 'From', value: 'Port Azul' }],
    facts: ['Made-up fact ' + (i + 1) + '.'], theme: i % 5 === 4 ? 'blueprint' : null,
    meta: { rarity: ['common', 'rare', 'epic', 'legendary'][i % 4], setName, cardNo: i + 1, setSize: n, stars: i % 6 },
  })),
});

const STATES = [
  { n: 1, theme: 'classic' },
  { n: 2, theme: 'classic' },
  { n: 5, theme: 'classic' },
  { n: 6, theme: 'classic' },
  { n: 7, theme: 'classic' },
  { n: 13, theme: 'classic' },
  { n: 4, theme: 'parchment', setName: 'Río & Quill: Vol. 2' },
  { n: 9, theme: 'science', setName: '' },
];

// ---- the wiring, read off the source ----------------------------------------
console.log('064 — Download PDF through ExportKit');
{
  const html = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  ok(srcs.includes('../_shared/export.js'), 'the page loads _shared/export.js');
  ok(!srcs.includes('../_shared/duplex-print.js'), 'and no longer loads _shared/duplex-print.js');
  ok(srcs.indexOf('../_shared/export.js') < srcs.indexOf('historical-trading-card-maker/htcm-export.js'), 'export.js comes before htcm-export.js');
  const code = fs.readFileSync(path.join(SITE, 'Tools/historical-trading-card-maker/htcm-export.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  ok(/\.toPdf\(/.test(code) && /\.mirrorPage\(/.test(code) && /\.paginate\(/.test(code), 'exportPdf() calls ExportKit\'s toPdf, mirrorPage and paginate');
  ok(!/DuplexPrint|new jsPDF|\.addImage\(|\.addPage\(/.test(code), 'and does not build the document, place an image or name DuplexPrint itself');
  ok(!/DuplexPrint\./.test(html.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '')), 'the page\'s own script does not call DuplexPrint either');
  ok(/\.toZip\(/.test(code) && /ExportKit\.download\(/.test(code), 'exportZip() and the PNG download call ExportKit\'s toZip and download');
  ok(!/new\s+(global\.)?JSZip|generateAsync|createObjectURL|createElement\('a'\)/.test(code), 'and the module builds no zip and clicks no anchor of its own');
}

const server = await serve(PORT);
const browser = await launch();

for (const st of STATES) {
  const setName = st.setName === undefined ? 'Invented Set' : st.setName;
  const label = `${st.n} card${st.n === 1 ? '' : 's'}, ${st.theme}`;
  const doc = deck(st.n, st.theme, setName);
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(value => {
    localStorage.setItem('htcm:list', JSON.stringify(['Invented deck']));
    localStorage.setItem('htcm:data:Invented deck', value);
    localStorage.setItem('htcm:current', 'Invented deck');
  }, JSON.stringify(doc));
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);

  eq(await page.evaluate(() => [typeof ExportKit, typeof window.DuplexPrint, typeof jspdf.jsPDF]), ['object', 'undefined', 'function'], `${label}: ExportKit and jsPDF are on the page, DuplexPrint is not`);
  const before = await page.evaluate(() => document.getElementById('pdfBtn').textContent);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#pdfBtn')]);
  const want = (setName || 'trading-cards').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.pdf';
  eq(dl.suggestedFilename(), want, `${label}: the file is named for the set`);
  const bytes = fs.readFileSync(await dl.path());
  await dl.delete().catch(() => {});
  eq(await page.evaluate(() => { const b = document.getElementById('pdfBtn'); return [b.disabled, b.textContent]; }), [false, before], `${label}: the button is back, enabled, with its label`);

  // What the page itself renders for each card, front and back.
  const rendered = await page.evaluate(({ cards, theme }) => new Promise(resolve => {
    const out = [];
    (function next(i) {
      if (i >= cards.length * 2) { resolve(out); return; }
      HtcmExport.renderCardCanvas(cards[i >> 1], i % 2 ? 'back' : 'front', { theme }, canvas => { out.push(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]); next(i + 1); });
    })(0);
  }), { cards: doc.cards, theme: st.theme });
  const who = {};
  rendered.forEach((b64, i) => { who[sha(Buffer.from(b64, 'base64'))] = `${i % 2 ? 'back' : 'front'} ${i >> 1}`; });
  eq(Object.keys(who).length, st.n * 2, `${label}: every card's front and back is a picture of its own`);

  ok(bytes.subarray(0, 5).toString() === '%PDF-', `${label}: the download is a PDF`);
  const pages = readPdf(bytes);
  const sheets = Math.ceil(st.n / PER);
  eq(pages.length, sheets * 2, `${label}: ${sheets} page${sheets === 1 ? '' : 's'} of fronts and as many of backs`);
  ok(pages.every(p => p.box[0] === 612 && p.box[1] === 792), `${label}: every page is letter portrait`);

  // The expected file: for each page, which picture is in which cell.
  const expected = [];
  for (const side of ['front', 'back']) for (let p = 0; p < sheets; p++) {
    const onPage = [];
    for (let k = 0; k < PER && p * PER + k < st.n; k++) onPage.push({ who: `${side} ${p * PER + k}`, cell: side === 'front' ? k : behind(k) });
    expected.push(onPage.sort((a, b) => a.cell - b.cell));
  }
  const got = pages.map(p => p.images.map(im => ({ who: who[im.sha] || 'a picture the page did not render', cell: Math.round((im.top - MY) / (H + GAP)) * COLS + Math.round((im.left - MX) / (W + GAP)) })).sort((a, b) => a.cell - b.cell));
  eq(got, expected, `${label}: fronts in reading order, then each back in the cell behind its front`);

  let off = null, shape = null;
  pages.forEach((p, pi) => p.images.forEach((im, k) => {
    const c = cell(Math.round((im.top - MY) / (H + GAP)) * COLS + Math.round((im.left - MX) / (W + GAP)));
    if (off === null && (Math.abs(im.left - c.left) > 0.01 || Math.abs(im.top - c.top) > 0.01)) off = { page: pi, k, left: im.left, top: im.top, want: c };
    if (shape === null && (Math.abs(im.w - W) > 0.01 || Math.abs(im.h - H) > 0.01 || im.skew[0] || im.skew[1])) shape = { page: pi, k, w: im.w, h: im.h, skew: im.skew };
  }));
  eq(off, null, `${label}: every card sits exactly on the grid (0.35 in from the side, 1.925 in from the top, 0.15 in apart)`);
  eq(shape, null, `${label}: every card is 2.5 x 3.5 in, upright and unstretched`);

  // Turn the sheet on its long edge: a back's left edge is its front's right edge, mirrored.
  let astray = null;
  for (let p = 0; p < sheets; p++) for (const f of pages[p].images) {
    const b = (pages[sheets + p] || { images: [] }).images.find(x => who[x.sha] === (who[f.sha] || '').replace('front', 'back'));
    if (astray === null && (!b || Math.abs((612 - (b.left + b.w)) - f.left) > 0.01 || Math.abs(b.top - f.top) > 0.01)) astray = { card: who[f.sha], front: [f.left, f.top], back: b ? [b.left, b.top] : null };
  }
  eq(astray, null, `${label}: seen through the paper, every back is behind its own front`);

  // ---- All PNGs (zip), through ExportKit.toZip() ----
  await page.evaluate(() => { window.__zips = 0; const real = ExportKit.toZip; ExportKit.toZip = function () { window.__zips++; return real.apply(this, arguments); }; });
  const zipLabel = await page.evaluate(() => document.getElementById('zipBtn').textContent);
  const [zdl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#zipBtn')]);
  eq(zdl.suggestedFilename(), want.replace(/\.pdf$/, '-cards.zip'), `${label}: the zip is named for the set`);
  const zbytes = fs.readFileSync(await zdl.path());
  await zdl.delete().catch(() => {});
  await page.waitForFunction(() => !document.getElementById('zipBtn').disabled);
  eq(await page.evaluate(() => [document.getElementById('zipBtn').textContent, window.__zips]), [zipLabel, 1], `${label}: the zip button is back with its label, after one call to ExportKit.toZip()`);
  const pngs = await page.evaluate(({ cards, theme }) => new Promise(resolve => {
    const out = [];
    (function next(i) {
      if (i >= cards.length * 2) { resolve(out); return; }
      HtcmExport.renderCardCanvas(cards[i >> 1], i % 2 ? 'back' : 'front', { theme }, canvas => { out.push(canvas.toDataURL('image/png').split(',')[1]); next(i + 1); });
    })(0);
  }), { cards: doc.cards, theme: st.theme });
  const entries = readZip(zbytes);
  const slugOf = t => String(t || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
  eq(entries.map(e => e.name), doc.cards.flatMap((c, i) => ['front', 'back'].map(side => `${String(i + 1).padStart(2, '0')}-${slugOf(c.name)}-${side}.png`)), `${label}: a front and a back for every card, in deck order, under the names the export always gave`);
  ok(entries.every(e => e.crcOk && e.name === e.localName), `${label}: every entry's CRC is right and its two headers agree`);
  ok(entries.every(e => e.data.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n'), `${label}: every entry is a PNG`);
  eq(entries.map(e => sha(e.data)), pngs.map(b64 => sha(Buffer.from(b64, 'base64'))), `${label}: each entry is, byte for byte, the PNG the page renders for that card and side`);

  eq(page.__errs.length, 0, `${label}: no page or console errors: ${JSON.stringify(page.__errs)}`);
  eq(page.__blocked.length, 0, `${label}: nothing tried to leave the site`);
  await page.context().close();
}

// ---- Download PNG: the showing card's front and back, through ExportKit.download() ----
{
  const doc = deck(3, 'classic', 'Invented Set');
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(value => {
    localStorage.setItem('htcm:list', JSON.stringify(['Invented deck']));
    localStorage.setItem('htcm:data:Invented deck', value);
    localStorage.setItem('htcm:current', 'Invented deck');
  }, JSON.stringify(doc));
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  await page.evaluate(() => { window.__saved = []; const real = ExportKit.download; ExportKit.download = function (data, name) { window.__saved.push(name); return real.apply(this, arguments); }; });
  const got = [];
  page.on('download', d => got.push(d));
  await page.click('#pngBtn');
  await page.waitForFunction(() => window.__saved.length === 2 && !document.getElementById('pngBtn').disabled, null, { timeout: 60000 });
  for (let i = 0; i < 50 && got.length < 2; i++) await settle(page, 100);
  const names = await page.evaluate(() => window.__saved);
  ok(names.length === 2 && /-front\.png$/.test(names[0]) && /-back\.png$/.test(names[1]) && names[0].replace('-front', '') === names[1].replace('-back', ''), `Download PNG: two calls to ExportKit.download(), a front and a back of one card (got ${JSON.stringify(names)})`);
  eq(got.map(d => d.suggestedFilename()), names, 'Download PNG: and the browser is handed those two files');
  const files = await Promise.all(got.map(async d => fs.readFileSync(await d.path())));
  ok(files.length === 2 && files.every(b => b.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') && sha(files[0]) !== sha(files[1]), 'Download PNG: both are PNGs, and not the same picture');
  eq(page.__errs.length, 0, `Download PNG: no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));

console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
