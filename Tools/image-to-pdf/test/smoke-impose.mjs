// smoke-impose.mjs — 011's booklet and pages-per-sheet layouts, through the
// shared export layer (Path 7 P4 increment 4, which is Path 17 P4).
//
//   node Tools/image-to-pdf/test/smoke-impose.mjs      (or: npm run test:image-to-pdf-impose)
//
// With "Print-shop layout" on, 011 no longer draws its pages itself: it
// records each page's drawing and hands the pages to ExportKit.toPdf(), which
// puts them on their sheets. This suite reads the file that comes out, with a
// PDF reader written below (it inflates the page streams and follows the
// matrices), and holds it to statements made here, not to ExportKit's own
// answers:
//
//   - WHICH page is WHERE. Every page carries "Page N of M", so the reader
//     knows which page each slot holds and which way up it is. A booklet is
//     then folded on paper's terms (outermost sheet first, the back as the
//     reader sees it for the edge the printer turns on) and read front to
//     back; a pages-per-sheet job is read side by side. Page counts that need
//     blanks are in the list.
//   - REGISTER. Seen through the paper, every back slot is on a front slot,
//     for either edge.
//   - NOTHING CLIPPED. Every picture and every line of text is inside its
//     own slot, and at least a quarter inch from the edge of the sheet.
//   - the sheet's size and orientation, the slots' size, the fold, the
//     gutter, the cut marks, creep.
//   - where `pdftoppm` is installed, the PIXELS: each page's picture is a grey
//     of its own with a black corner, and the raster is sampled in every slot.
//     Where it is not, that part is skipped out loud.
//   - the controls: what shows when, the note under them, what is saved (the
//     details) and what is not (the layout itself), an old saved state loading
//     with the layout off, and the default path not going near toPdf().
//
// The default output, layout off, was compared with the page before this
// change in 120 states (8 page counts x 3 orientations x 5 paper sizes, with
// contact sheets, a title page, a header, captions, a rotation and three
// qualities spread across them): the same message, file name and length, the
// same page boxes, content streams and image streams, and the same pixels on
// 600 of 600 pages (`pdftoppm -r 96 -gray`). That comparison is not rerun here.
//
// Nothing here has been printed, folded or put through a duplex unit.
// Made-up names and text only. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { serve, launch, prepPage, settle, SITE } from '../../board-check/harness.mjs';
import { makePng } from './make-fixtures.mjs';
import { readZip } from '../../export/test/_zip-read.mjs';

const PORT = 8483;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '011-image-to-pdf.html';
const KEY = 'image-to-pdf-settings';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const close = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const hasPoppler = spawnSync('pdftoppm', ['-v']).status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'img2pdf-impose-'));

// ---- fixtures: page i's picture is one grey, with a black top-left corner ----
const MAX = 17;
const greyOf = i => 60 + i * 10;                       // 60..220: never the corner's black, never paper white
const files = [];
for (let i = 0; i < MAX; i++) {
  const f = path.join(tmp, String(i + 1).padStart(2, '0') + '-invented.png');
  const g = greyOf(i);
  fs.writeFileSync(f, makePng(60, 40, (x, y) => (x < 20 && y < 14 ? [0, 0, 0] : [g, g, g])));
  files.push(f);
}

// ---- the paper, stated here -------------------------------------------------
const PAPER = { letter: [612, 792], a4: [595.28, 841.89], legal: [612, 1008], tabloid: [792, 1224] };
const INCH = 72, EDGE = INCH / 4, GUTTER = INCH / 8;
const sheetOf = (paper, orientation) => (orientation === 'landscape' ? [PAPER[paper][1], PAPER[paper][0]] : PAPER[paper].slice());
/** Is the back half a turn off for a reader who turns the sheet like a book's page? */
const comesOverTopToBottom = (sheet, flip) => (sheet[0] > sheet[1]) !== (flip === 'short');

// ---- a PDF reader -----------------------------------------------------------
/** [{ box: [w, h], slots: [{ m, texts, images }], loose: { texts, images }, lines }], points.
    A slot is one outermost q ... Q block that sets a matrix: a placed page. */
function readPdf(buf) {
  const s = buf.toString('latin1');
  const streamOf = n => {
    const m = new RegExp('(?:^|\\n)' + n + ' 0 obj\\n').exec(s); const at = m.index + m[0].length;
    const start = s.indexOf('stream\n', at) + 7, head = s.slice(at, start);
    const raw = buf.subarray(start, start + Number(/\/Length (\d+)/.exec(head)[1]));
    return /FlateDecode/.test(head) ? zlib.inflateSync(raw) : raw;
  };
  const mul = (m, c) => [m[0] * c[0] + m[1] * c[2], m[0] * c[1] + m[1] * c[3], m[2] * c[0] + m[3] * c[2], m[2] * c[1] + m[3] * c[3], m[4] * c[0] + m[5] * c[2] + c[4], m[4] * c[1] + m[5] * c[3] + c[5]];
  const pages = [];
  for (const pm of s.matchAll(/<<\s*\/Type \/Page\n([\s\S]*?)>>\nendobj/g)) {
    const box = /\/MediaBox \[([^\]]+)\]/.exec(pm[1])[1].trim().split(/\s+/).map(Number);
    const H = box[3];
    const lines = streamOf(+/\/Contents (\d+) 0 R/.exec(pm[1])[1]).toString('latin1').split('\n').map(l => l.trim()).filter(Boolean);
    const page = { box: [box[2], box[3]], slots: [], loose: { texts: [], images: [] }, lines: [] };
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0], slot = null, td = null, pen = null;
    const here = () => slot || page.loose;
    /** A user-space point as the sheet has it, y down from the top. */
    const at = (x, y, m = ctm) => [m[0] * x + m[2] * y + m[4], H - (m[1] * x + m[3] * y + m[5])];
    for (const l of lines) {
      let m;
      if (l === 'q') { stack.push(ctm); continue; }
      if (l === 'Q') { ctm = stack.pop(); if (!stack.length) slot = null; continue; }
      if ((m = /^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm$/.exec(l))) {
        ctm = mul(m.slice(1).map(Number), ctm);
        if (stack.length === 1 && !slot) { slot = { m: ctm.slice(), texts: [], images: [] }; page.slots.push(slot); }
        continue;
      }
      if (/^\/I\d+ Do$/.test(l)) { const a = at(0, 1), b = at(1, 0); here().images.push({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]), turned: ctm[0] < 0 }); continue; }
      if (l === 'BT') { td = [0, 0]; continue; }
      if ((m = /^(-?[\d.]+) (-?[\d.]+) Td$/.exec(l))) { td = [td[0] + Number(m[1]), td[1] + Number(m[2])]; continue; }   // each Td moves on from the last
      if ((m = /^\((.*)\) Tj$/.exec(l))) { const p = at(td[0], td[1]); here().texts.push({ text: m[1].replace(/\\([()\\])/g, '$1'), x: p[0], y: p[1] }); continue; }
      if ((m = /^(-?[\d.]+) (-?[\d.]+) m$/.exec(l))) { pen = at(Number(m[1]), Number(m[2])); continue; }
      if ((m = /^(-?[\d.]+) (-?[\d.]+) l$/.exec(l)) && pen && !stack.length) { const p = at(Number(m[1]), Number(m[2])); page.lines.push({ x1: pen[0], y1: pen[1], x2: p[0], y2: p[1] }); pen = null; }
    }
    pages.push(page);
  }
  return pages;
}

/** A slot's box on the sheet, for a page pw x ph points, and what is in it. */
function placed(slot, sheetH, pw, ph) {
  const s = Math.abs(slot.m[0]), turned = slot.m[0] < 0;
  const x = turned ? slot.m[4] - pw * s : slot.m[4];
  // ExportKit draws a page at the top left of the sheet and lets the matrix carry it: the sheet's height is in f.
  const y = turned ? sheetH * (1 + s) - slot.m[5] - ph * s : sheetH * (1 - s) - slot.m[5];
  const num = slot.texts.map(t => /^Page (\d+) of (\d+)$/.exec(t.text)).find(Boolean);
  return { x, y, w: pw * s, h: ph * s, scale: s, turned, skew: [slot.m[1], slot.m[2]], even: close(Math.abs(slot.m[3]), s, 1e-9),
           page: num ? Number(num[1]) : null, of: num ? Number(num[2]) : null, texts: slot.texts, images: slot.images };
}

/** Rasterises with pdftoppm; returns grey(pageIndex, xPt, yPt). */
let rasterNo = 0;
function raster(bytes) {
  const name = 'r' + (rasterNo++), file = path.join(tmp, name + '.pdf');
  fs.writeFileSync(file, bytes);
  const r = spawnSync('pdftoppm', ['-r', '36', '-gray', '-aa', 'no', file, path.join(tmp, name)]);
  if (r.status !== 0) throw new Error('pdftoppm failed: ' + r.stderr);
  const imgs = fs.readdirSync(tmp).filter(f => f.startsWith(name + '-') && f.endsWith('.pgm'))
    .sort((a, b) => parseInt(a.slice(name.length + 1), 10) - parseInt(b.slice(name.length + 1), 10))
    .map(f => {
      const b = fs.readFileSync(path.join(tmp, f)); fs.unlinkSync(path.join(tmp, f));
      const head = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(b.subarray(0, 40).toString('latin1'));
      return { w: +head[1], h: +head[2], px: b.subarray(head[0].length) };
    });
  fs.unlinkSync(file);
  return (p, x, y) => { const im = imgs[p]; return im.px[Math.min(im.h - 1, Math.max(0, Math.round(y / 2))) * im.w + Math.min(im.w - 1, Math.max(0, Math.round(x / 2)))]; };
}

// ---- driving the page -------------------------------------------------------
const server = await serve(PORT);
const browser = await launch();
console.log('011 — booklet and pages per sheet through ExportKit');

{
  const html = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  ok(srcs.includes('../_shared/export.js'), 'the page loads _shared/export.js');
  ok(srcs.indexOf('../_shared/vendor/jspdf/jspdf.umd.min.js') < srcs.indexOf('../_shared/export.js'), 'after the vendored jsPDF');
  const code = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
  ok(/ExportKit\.toPdf\(/.test(code) && /ExportKit\.pdfPlan\(/.test(code) && /ExportKit\.layout\(/.test(code), 'its script calls ExportKit.toPdf, pdfPlan and layout');
  ok(!/function\s+(booklet|nUp|impose\w*Order|saddle\w*)\s*\(/i.test(code), 'and has no imposition order of its own');
}

async function open(saved) {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
  if (saved !== undefined) await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, saved]);
  await page.addInitScript(() => {
    window.__toPdfCalls = 0;
    window.addEventListener('DOMContentLoaded', () => {
      if (!window.ExportKit) return;
      const real = ExportKit.toPdf;
      ExportKit.toPdf = function () { window.__toPdfCalls++; return real.apply(this, arguments); };
    });
  });
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 100);
  return page;
}
const ORIENT_LABEL = { auto: 'orient-auto', portrait: 'orient-port', landscape: 'orient-land' };
async function setFiles(page, n) {
  await page.click('#btn-clear');
  await page.setInputFiles('#file-input', files.slice(0, n));
}
async function generate(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#btn-generate')]);
  const bytes = fs.readFileSync(await dl.path());
  const name = dl.suggestedFilename();
  await dl.delete().catch(() => {});
  await page.waitForFunction(() => !document.getElementById('btn-generate').disabled);
  return { bytes, name, msg: await page.evaluate(() => document.getElementById('msg').textContent), last: await page.evaluate(() => window.__imgToPdfLastRun) };
}
const visible = (page, id) => page.evaluate(i => { const el = document.getElementById(i); return !!el && getComputedStyle(el).display !== 'none'; }, id);

// ---- what every imposed file must be, whatever the layout --------------------
/** Checks one file. `want`: { sheet: [w, h], page: [w, h], sides, pages (count), slots(side) -> expected boxes or null, minScale? }.
    Returns the sides as [{ slots: [placed] }], for the layout's own reading. */
function common(label, bytes, want) {
  ok(bytes.subarray(0, 5).toString() === '%PDF-', `${label}: the download is a PDF`);
  const pdf = readPdf(bytes);
  eq(pdf.length, want.sides, `${label}: ${want.sides} side${want.sides === 1 ? '' : 's'} of paper`);
  ok(pdf.every(p => close(p.box[0], want.sheet[0]) && close(p.box[1], want.sheet[1])), `${label}: every side is ${want.sheet.join(' x ')} pt (got ${JSON.stringify(pdf[0] && pdf[0].box)})`);
  const sides = pdf.map(p => ({ slots: p.slots.map(sl => placed(sl, p.box[1], want.page[0], want.page[1])), lines: p.lines, loose: p.loose }));
  const all = sides.flatMap(sd => sd.slots);
  eq(all.map(x => x.page).sort((a, b) => a - b), Array.from({ length: want.pages }, (_, i) => i + 1), `${label}: every page is placed exactly once`);
  ok(all.every(x => x.of === want.pages), `${label}: each says "of ${want.pages}", the reader's pages and not the sheets`);
  ok(all.every(x => !x.skew[0] && !x.skew[1] && x.even), `${label}: no page is skewed or stretched`);
  ok(sides.every(sd => !sd.loose.texts.length && !sd.loose.images.length), `${label}: nothing is drawn outside a placed page`);
  // Nothing clipped: inside its own slot, and a quarter inch inside the sheet.
  let out = null, edge = null;
  for (const sd of sides) for (const x of sd.slots) {
    for (const im of x.images) {
      if (out === null && (im.x0 < x.x - 0.01 || im.y0 < x.y - 0.01 || im.x1 > x.x + x.w + 0.01 || im.y1 > x.y + x.h + 0.01)) out = { page: x.page, picture: im, slot: [x.x, x.y, x.w, x.h] };
      if (edge === null && (im.x0 < EDGE - 0.01 || im.y0 < EDGE - 0.01 || im.x1 > want.sheet[0] - EDGE + 0.01 || im.y1 > want.sheet[1] - EDGE + 0.01)) edge = { page: x.page, picture: im };
      if (edge === null && im.turned !== x.turned) edge = { page: x.page, why: 'the picture is not the way up its page is' };
    }
    for (const t of x.texts) {
      if (out === null && (t.x < x.x - 0.01 || t.y < x.y - 0.01 || t.x > x.x + x.w + 0.01 || t.y > x.y + x.h + 0.01)) out = { page: x.page, text: t, slot: [x.x, x.y, x.w, x.h] };
      if (edge === null && (t.x < 5 || t.y < 5 || t.x > want.sheet[0] - 5 || t.y > want.sheet[1] - 5)) edge = { page: x.page, text: t };
    }
    if (out === null && x.images.length !== 1) out = { page: x.page, why: 'pictures on the page', n: x.images.length };
  }
  eq(out, null, `${label}: every picture and line of text is inside its own page's slot`);
  eq(edge, null, `${label}: every picture is a quarter inch or more inside the sheet, the way up its page is`);
  // The pixels.
  if (hasPoppler) {
    const grey = raster(bytes);
    let wrong = null;
    sides.forEach((sd, si) => sd.slots.forEach(x => {
      const im = x.images[0]; if (!im || wrong !== null) return;
      const w = im.x1 - im.x0, h = im.y1 - im.y0;
      const body = x.turned ? [im.x0 + w * 0.3, im.y0 + h * 0.3] : [im.x0 + w * 0.7, im.y0 + h * 0.7];
      const corner = x.turned ? [im.x1 - w * 0.12, im.y1 - h * 0.12] : [im.x0 + w * 0.12, im.y0 + h * 0.12];
      const g = grey(si, body[0], body[1]), c = grey(si, corner[0], corner[1]);
      if (Math.abs(g - greyOf(want.first + x.page - 1)) > 2 || c > 8) wrong = { side: si, page: x.page, grey: g, wantGrey: greyOf(want.first + x.page - 1), corner: c };
    }));
    eq(wrong, null, `${label}: in the raster each slot shows its own page's picture, the black corner where the page's top left is`);
  }
  return sides;
}

/** Through the paper: every back slot is on a front slot. */
function registers(label, sides, sheet) {
  let off = null, n = 0;
  for (let i = 0; i + 1 < sides.length; i += 2) for (const b of sides[i + 1].slots) {
    n++;
    const mx = sheet[0] - b.x - b.w;
    // the front may hold a blank there, so compare with the slot grid, which the fronts and backs share
    const grid = sides[i].grid;
    if (off === null && !grid.some(f => close(f.x, mx) && close(f.y, b.y) && close(f.w, b.w) && close(f.h, b.h))) off = { sheet: i / 2, back: [b.x, b.y, b.w, b.h] };
  }
  eq(off, null, `${label}: seen through the paper, every back page is exactly on a front slot (${n} checked)`);
}

// =============================================================================
// 1. The controls
// =============================================================================
{
  const page = await open();
  eq(await page.evaluate(() => [typeof ExportKit, typeof jspdf.jsPDF]), ['object', 'function'], 'ExportKit and jsPDF are on the page');
  eq(await page.evaluate(() => document.getElementById('impose-kind').value), 'off', 'the layout starts off');
  eq(await Promise.all(['impose-nup-group', 'impose-sides-group', 'impose-marks-group', 'impose-creep-group', 'impose-summary'].map(i => visible(page, i))), [false, false, false, false, false], 'off: none of its details show');
  await page.selectOption('#impose-kind', 'booklet');
  eq(await Promise.all(['impose-nup-group', 'impose-sides-group', 'impose-marks-group', 'impose-creep-group', 'impose-summary'].map(i => visible(page, i))), [false, true, false, true, true], 'booklet: the flip edge and creep show');
  eq(await page.evaluate(() => [document.getElementById('impose-sides').value, document.querySelector('#impose-sides option[value="one"]').disabled]), ['long', true], 'a booklet cannot be one-sided');
  await page.selectOption('#impose-kind', 'nup');
  eq(await Promise.all(['impose-nup-group', 'impose-sides-group', 'impose-marks-group', 'impose-creep-group', 'impose-summary'].map(i => visible(page, i))), [true, true, true, false, true], 'pages per sheet: the count, the sides and cut marks show');
  await page.selectOption('#impose-sides', 'one');
  await page.selectOption('#impose-kind', 'booklet');
  eq(await page.evaluate(() => document.getElementById('impose-sides').value), 'long', 'switching to a booklet from one-sided makes it two-sided');
  await setFiles(page, 5);
  const note = await page.evaluate(() => document.getElementById('impose-summary').textContent);
  ok(/^5 pages on 2 sheets of Letter as a booklet, printed on both sides; the last 3 pages of the booklet are blank\./.test(note), `the note counts pages, sheets and blanks before anything is made (got "${note}")`);
  ok(/flip on the long edge/.test(note) && /actual size/.test(note), 'and says what to choose in the print dialog');
  await page.selectOption('#impose-sides', 'short');
  ok(/flip on the short edge/.test(await page.evaluate(() => document.getElementById('impose-summary').textContent)), 'the note follows the flip edge');
  await page.selectOption('#grid-density', '4');
  ok(/^2 pages on 1 sheet /.test(await page.evaluate(() => document.getElementById('impose-summary').textContent)), 'and the contact-sheet setting (5 pictures, 4 to a page: 2 pages)');
  await page.selectOption('#grid-density', '1');
  await page.selectOption('#page-size', 'original');
  ok(/Match image size/.test(await page.evaluate(() => document.getElementById('impose-summary').textContent)), 'it says "Match image size" prints on Letter here');
  await page.selectOption('#page-size', 'letter');

  // What is saved, and what is not.
  await page.selectOption('#impose-kind', 'nup');
  await page.selectOption('#impose-nup', '6');
  await page.check('#impose-marks');
  await page.selectOption('#impose-kind', 'booklet');
  await page.check('#impose-creep');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  eq(saved.impose, { nup: '6', sides: 'short', marks: true, creep: true }, 'the details are saved with the other settings');
  ok(!JSON.stringify(saved).includes('booklet') && !('kind' in saved.impose), 'the layout itself is not saved');
  eq(Object.keys(saved).sort(), ['gridDensity', 'impose', 'orient', 'pageNumbers', 'pageSize', 'quality'], 'the settings the page saved before are all still there');
  await page.reload({ waitUntil: 'load' });
  eq(await page.evaluate(() => ['impose-kind', 'impose-nup', 'impose-sides'].map(i => document.getElementById(i).value).concat([document.getElementById('impose-marks').checked, document.getElementById('impose-creep').checked])),
     ['off', '6', 'short', true, true], 'after a reload the layout is off and the details are as they were left');
  eq(page.__errs.length, 0, `no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// A state saved by the page before this change, and some that are damaged.
for (const [what, blob] of [
  ['a state saved before the layout existed', JSON.stringify({ pageSize: 'a4', orient: 'landscape', quality: 'high', gridDensity: '4', pageNumbers: false })],
  ['a state whose impose is not an object', JSON.stringify({ pageSize: 'legal', impose: 'booklet' })],
  ['a state with details that are not on offer', JSON.stringify({ impose: { kind: 'booklet', nup: '7', sides: 'sideways', marks: 'yes', creep: 1 } })],
  ['a state that is not JSON', '{nope'],
]) {
  const page = await open(blob);
  eq(await page.evaluate(() => ['impose-kind', 'impose-nup', 'impose-sides'].map(i => document.getElementById(i).value).concat([document.getElementById('impose-marks').checked, document.getElementById('impose-creep').checked])),
     ['off', '2', 'long', false, false], `${what}: the layout is off and its details are at their defaults`);
  if (what.includes('before')) {
    eq(await page.evaluate(() => [document.getElementById('page-size').value, document.querySelector('input[name="orient"]:checked').value, document.getElementById('quality').value, document.getElementById('grid-density').value, document.getElementById('opt-pagenum').checked]),
       ['a4', 'landscape', 'high', '4', false], `${what}: its own five settings load unchanged`);
    await page.selectOption('#grid-density', '1');
    await setFiles(page, 3);
    const out = await generate(page);
    const pdf = readPdf(out.bytes);
    eq([pdf.length, await page.evaluate(() => window.__toPdfCalls), out.last.imposed], [3, 0, null], `${what}: Generate makes a page a picture, without ExportKit.toPdf()`);
    // jsPDF wraps a picture in its own q ... cm ... Q, which the reader counts as a block; nothing else is in one.
    ok(pdf.every(p => close(p.box[0], 841.89, 0.01) && close(p.box[1], 595.28, 0.01) && p.slots.length === 1 && p.slots[0].images.length === 1 && !p.slots[0].texts.length), `${what}: A4 landscape pages, each with its one picture drawn straight on it`);
    ok(/3 page\(s\)/.test(out.msg), `${what}: the message is the one it always was (got "${out.msg}")`);
  }
  eq(page.__errs.length, 0, `${what}: no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

// =============================================================================
// 2. Booklets
// =============================================================================
const COUNTS = [1, 2, 3, 4, 5, 8, 9, 17];
{
  const page = await open();
  const cases = [];
  for (const n of COUNTS) for (const flip of ['long', 'short']) cases.push({ n, flip, paper: 'letter' });
  for (const paper of ['a4', 'legal', 'tabloid']) for (const flip of ['long', 'short']) for (const n of [5, 9]) cases.push({ n, flip, paper });
  cases.push({ n: 9, flip: 'long', paper: 'letter', creep: true }, { n: 17, flip: 'short', paper: 'letter', creep: true });
  cases.push({ n: 5, flip: 'long', paper: 'original', orient: 'landscape' });   // both fall back: Letter, and the booklet's own upright page

  for (const c of cases) {
    const label = `booklet, ${c.n} page${c.n === 1 ? '' : 's'}, ${c.paper}, flip ${c.flip}${c.creep ? ', creep' : ''}`;
    const paper = PAPER[c.paper] ? c.paper : 'letter';
    const sheet = sheetOf(paper, 'landscape'), pw = sheet[0] / 2, ph = sheet[1];
    const S = Math.ceil(c.n / 4);
    await setFiles(page, c.n);
    await page.selectOption('#page-size', c.paper);
    await page.click(`label[for="${ORIENT_LABEL[c.orient || 'auto']}"]`);
    await page.selectOption('#impose-kind', 'booklet');
    await page.selectOption('#impose-sides', c.flip);
    await page.setChecked('#impose-creep', !!c.creep);
    const calls = await page.evaluate(() => window.__toPdfCalls);
    const out = await generate(page);
    eq(await page.evaluate(() => window.__toPdfCalls) - calls, 1, `${label}: one call to ExportKit.toPdf()`);
    const sides = common(label, out.bytes, { sheet, page: [pw, ph], sides: S * 2, pages: c.n, first: 0 });
    eq([out.last.imposed.kind, out.last.imposed.sheets, out.last.imposed.sides, out.last.imposed.blanks], ['booklet', S, S * 2, S * 4 - c.n], `${label}: the run reports ${S} sheet${S === 1 ? '' : 's'} and ${S * 4 - c.n} blank`);
    ok(out.msg.startsWith(`PDF saved: assembled.pdf — ${c.n} page${c.n === 1 ? '' : 's'} on ${S} sheet${S === 1 ? '' : 's'} of ${{ letter: 'Letter', a4: 'A4', legal: 'Legal', tabloid: 'Tabloid' }[paper]} as a booklet, printed on both sides`), `${label}: the message says so (got "${out.msg}")`);

    // Slots: actual size, the two halves of the sheet, moved toward the fold by creep.
    let geo = null;
    sides.forEach((sd, si) => {
      const shift = c.creep ? 0.29 * Math.floor(si / 2) : 0;
      sd.grid = [{ x: shift, y: 0, w: pw, h: ph }, { x: pw - shift, y: 0, w: pw, h: ph }];
      for (const x of sd.slots) {
        const half = x.x + x.w / 2 < sheet[0] / 2 ? 0 : 1;
        x.half = half;
        if (geo === null && (!close(x.scale, 1, 1e-9) || !close(x.x, sd.grid[half].x, 0.001) || !close(x.y, 0, 0.001))) geo = { side: si, page: x.page, x: x.x, y: x.y, scale: x.scale, want: sd.grid[half] };
      }
      if (geo === null && new Set(sd.slots.map(x => x.half)).size !== sd.slots.length) geo = { side: si, why: 'two pages in one half' };
    });
    eq(geo, null, `${label}: each page is actual size (${(pw / 72).toFixed(2)} x ${(ph / 72).toFixed(2)} in), a half of the sheet each, meeting at the fold${c.creep ? ', an inner sheet 0.29 pt nearer it per sheet' : ''}`);
    if (c.creep) ok(sides.length >= 4 && close(sides[2].slots[0].x - sides[2].grid[sides[2].slots[0].half].x, 0, 0.001) && sides[2].grid[0].x > 0.2, `${label}: the second sheet really is moved`);
    registers(label, sides, sheet);

    // Fold it. The reader turns every sheet like a page; a unit that brought
    // it over top to bottom leaves the back half a turn off for that reader.
    const flipped = comesOverTopToBottom(sheet, c.flip);
    let upside = null;
    const face = (sd, isBack) => {
      const halves = [null, null];
      for (const x of sd.slots) {
        const turnedForReader = isBack && flipped ? !x.turned : x.turned;
        if (upside === null && turnedForReader) upside = { page: x.page, back: isBack };
        halves[isBack && flipped ? 1 - x.half : x.half] = x.page;
      }
      return halves;   // [left, right] as read
    };
    const fronts = [], backs = [];
    for (let i = 0; i < S; i++) { fronts.push(face(sides[2 * i], false)); backs.push(face(sides[2 * i + 1], true)); }
    eq(upside, null, `${label}: no page is upside down when the booklet is read`);
    // Nested outermost first and folded: out along the right-hand pages, back along the left.
    const read = [];
    for (let i = 0; i < S; i++) read.push(fronts[i][1], backs[i][0]);
    for (let i = S - 1; i >= 0; i--) read.push(backs[i][1], fronts[i][0]);
    eq(read, Array.from({ length: S * 4 }, (_, i) => (i < c.n ? i + 1 : null)), `${label}: folded and read front to back, the pages run 1 to ${c.n}${S * 4 > c.n ? ', then ' + (S * 4 - c.n) + ' blank' : ''}`);
    eq(sides.reduce((a, sd) => a + sd.lines.length, 0), 0, `${label}: a booklet has no cut marks`);
  }

  // A title page and a header ride along; a contact sheet is a page like any other.
  await setFiles(page, 6);
  await page.selectOption('#page-size', 'letter');
  await page.selectOption('#impose-sides', 'long');
  await page.uncheck('#impose-creep');
  await page.check('#opt-titlepage');
  await page.fill('#titlepage-title', 'An Invented Field Guide');
  await page.fill('#header-text', 'Made-up header (draft)');
  await page.locator('.caption-input').nth(2).fill('A caption for the third made-up picture');
  {
    const out = await generate(page);
    const pdf = readPdf(out.bytes);
    eq(pdf.length, 4, 'booklet with a title page: 7 pages take 2 sheets');
    const slots = pdf.flatMap((p, si) => p.slots.map(sl => ({ si, ...placed(sl, 612, 396, 612) })));
    // On a half-letter page the 26 pt title wraps, so it is two lines of text.
    const title = slots.filter(x => x.texts.some(t => t.text === 'An Invented Field') && x.texts.some(t => t.text === 'Guide'));
    eq([title.length, title[0] && title[0].si, title[0] && title[0].x, title[0] && title[0].page], [1, 0, 396, null], 'the title page is the booklet\'s cover (first side, right-hand half) and carries no page number');
    eq([slots.filter(x => x.page !== null).map(x => x.page).sort((a, b) => a - b), slots.filter(x => x.page !== null).map(x => x.of)], [[1, 2, 3, 4, 5, 6], [6, 6, 6, 6, 6, 6]], 'the six picture pages are numbered 1 to 6 of 6');
    ok(slots.filter(x => x.page !== null).every(x => x.texts.some(t => t.text === 'Made-up header (draft)')), 'each carries the running header, inside its own slot');
    ok(slots.find(x => x.page === 3).texts.some(t => /A caption for the third/.test(t.text)), 'the caption travels with its page');
    ok(/7 pages on 2 sheets/.test(out.msg), `the message counts the title page (got "${out.msg}")`);
  }
  await page.uncheck('#opt-titlepage');
  await page.fill('#header-text', '');
  await page.selectOption('#grid-density', '4');
  await setFiles(page, 17);
  {
    const out = await generate(page);
    const pdf = readPdf(out.bytes);
    const slots = pdf.flatMap(p => p.slots.map(sl => placed(sl, 612, 396, 612)));
    eq([pdf.length, slots.length, slots.reduce((a, x) => a + x.images.length, 0)], [4, 5, 17], 'booklet of contact sheets: 17 pictures, 4 to a page, are 5 pages on 2 sheets');
    ok(slots.every(x => x.images.every(im => im.x0 >= x.x - 0.01 && im.x1 <= x.x + x.w + 0.01 && im.y0 >= x.y - 0.01 && im.y1 <= x.y + x.h + 0.01)), 'every picture inside its own page');
  }
  await page.selectOption('#grid-density', '1');

  // A tall picture with no header and no page numbers would reach the top and bottom of its page.
  {
    const tall = path.join(tmp, '99-tall-invented.png');
    fs.writeFileSync(tall, makePng(30, 160, () => [120, 120, 120]));
    await page.click('#btn-clear');
    await page.setInputFiles('#file-input', [tall]);
    await page.uncheck('#opt-pagenum');
    const out = await generate(page);
    const im = readPdf(out.bytes)[0].slots[0].images[0];
    ok(close(im.y0, EDGE, 0.01) && close(im.y1, 612 - EDGE, 0.01) && im.x0 > 396 + EDGE, `booklet, a tall picture, no header or page number: it stops a quarter inch from the top and the bottom of its page (got ${JSON.stringify(im)})`);
    const text = out.bytes.toString('latin1');
    const heads = [...text.matchAll(/\/Contents (\d+) 0 R/g)].map(m => { const at = text.search(new RegExp('(?:^|\\n)' + m[1] + ' 0 obj\\n')); return text.slice(at, text.indexOf('stream\n', at)); });
    ok(heads.length === 2 && heads.every(h => /\/Filter \/FlateDecode/.test(h)), 'the imposed file\'s page streams are deflated, as 011\'s files always were');
    await page.check('#opt-pagenum');
  }
  eq(page.__errs.length, 0, `booklets: no page or console errors: ${JSON.stringify(page.__errs)}`);
  eq(page.__blocked.length, 0, 'booklets: nothing tried to leave the site');
  await page.context().close();
}

// =============================================================================
// 3. Pages per sheet
// =============================================================================
/** The arrangement that shows the pages largest, by this suite's own arithmetic. */
function bestGrid(paper, pageOrient, per) {
  const pg = sheetOf(paper, pageOrient);
  const grids = { 2: [[2, 1], [1, 2]], 4: [[2, 2]], 6: [[3, 2], [2, 3]], 9: [[3, 3]] }[per];
  let best = null;
  for (const so of [pageOrient, pageOrient === 'landscape' ? 'portrait' : 'landscape']) for (const [cols, rows] of grids) {
    const sh = sheetOf(paper, so);
    const cw = (sh[0] - 2 * EDGE - (cols - 1) * GUTTER) / cols, ch = (sh[1] - 2 * EDGE - (rows - 1) * GUTTER) / rows;
    const scale = Math.min(cw / pg[0], ch / pg[1]);
    if (!best || scale > best.scale + 1e-9) best = { scale, sheet: sh, cols, rows, cw, ch, page: pg };
  }
  best.cells = [];
  for (let r = 0; r < best.rows; r++) for (let c = 0; c < best.cols; c++) {
    const x = EDGE + c * (best.cw + GUTTER), y = EDGE + r * (best.ch + GUTTER), w = pg[0] * best.scale, h = pg[1] * best.scale;
    best.cells.push({ x: x + (best.cw - w) / 2, y: y + (best.ch - h) / 2, w, h, cx: x, cy: y });
  }
  return best;
}
{
  // The arrangements for Letter, said out loud, so bestGrid() above is not the only witness.
  eq([2, 4, 6, 9].map(per => { const b = bestGrid('letter', 'portrait', per); return [b.sheet[0] > b.sheet[1] ? 'landscape' : 'portrait', b.cols, b.rows]; }),
     [['landscape', 2, 1], ['portrait', 2, 2], ['landscape', 3, 2], ['portrait', 3, 3]], 'upright Letter pages: 2 and 6 go on a sheet turned sideways, 4 and 9 on an upright one');

  const page = await open();
  const cases = [];
  for (const per of [2, 4, 6, 9]) for (const n of COUNTS) for (const sides of ['one', 'long', 'short']) cases.push({ per, n, sides, paper: 'letter', orient: 'auto' });
  for (const per of [2, 4, 6, 9]) for (const sides of ['long', 'short']) cases.push({ per, n: 9, sides, paper: 'letter', orient: 'landscape' });
  for (const paper of ['a4', 'legal', 'tabloid']) for (const per of [2, 6]) for (const orient of ['portrait', 'landscape']) cases.push({ per, n: 17, sides: 'long', paper, orient });
  cases.push({ per: 4, n: 5, sides: 'short', paper: 'original', orient: 'auto' });
  cases.forEach((c, i) => { c.marks = i % 3 === 0; });

  for (const c of cases) {
    const label = `${c.per} to a side, ${c.n} page${c.n === 1 ? '' : 's'}, ${c.paper} ${c.orient}, ${c.sides === 'one' ? 'one-sided' : 'flip ' + c.sides}${c.marks ? ', cut marks' : ''}`;
    const paper = PAPER[c.paper] ? c.paper : 'letter';
    const g = bestGrid(paper, c.orient === 'landscape' ? 'landscape' : 'portrait', c.per);
    const two = c.sides !== 'one';
    const sideCount = Math.ceil(c.n / c.per), sheets = two ? Math.ceil(sideCount / 2) : sideCount;
    await setFiles(page, c.n);
    await page.selectOption('#page-size', c.paper);
    await page.click(`label[for="${ORIENT_LABEL[c.orient]}"]`);
    await page.selectOption('#impose-kind', 'nup');
    await page.selectOption('#impose-nup', String(c.per));
    await page.selectOption('#impose-sides', c.sides);
    await page.setChecked('#impose-marks', c.marks);
    const calls = await page.evaluate(() => window.__toPdfCalls);
    const out = await generate(page);
    eq(await page.evaluate(() => window.__toPdfCalls) - calls, 1, `${label}: one call to ExportKit.toPdf()`);
    const sides = common(label, out.bytes, { sheet: g.sheet, page: g.page, sides: two ? sheets * 2 : sheets, pages: c.n, first: 0 });
    eq([out.last.imposed.kind, out.last.imposed.sheets], ['nup', sheets], `${label}: the run reports ${sheets} sheet${sheets === 1 ? '' : 's'}`);
    ok(out.msg.includes(`${c.n} page${c.n === 1 ? '' : 's'} on ${sheets} sheet${sheets === 1 ? '' : 's'} of `) && out.msg.includes(`, ${c.per} to a side, printed on ${two ? 'both sides' : 'one side'}`), `${label}: the message says so (got "${out.msg}")`);

    // Every page is on a cell of the grid, at the one scale.
    let geo = null;
    for (const sd of sides) {
      sd.grid = g.cells;
      for (const x of sd.slots) {
        x.cell = g.cells.findIndex(k => close(k.x, x.x) && close(k.y, x.y));
        if (geo === null && (x.cell < 0 || !close(x.scale, g.scale, 1e-6))) geo = { page: x.page, x: x.x, y: x.y, scale: x.scale, want: g.scale };
      }
      if (geo === null && new Set(sd.slots.map(x => x.cell)).size !== sd.slots.length) geo = { why: 'two pages in one cell' };
    }
    eq(geo, null, `${label}: ${g.cols} x ${g.rows} on a ${g.sheet[0] > g.sheet[1] ? 'sideways' : 'upright'} sheet, a quarter inch in, an eighth apart, every page at ${(g.scale * 100).toFixed(1)}%`);

    // Read it: fronts as they are; a back as the reader sees it.
    const flipped = two && comesOverTopToBottom(g.sheet, c.sides);
    const read = [];
    let upside = null;
    sides.forEach((sd, si) => {
      const isBack = two && si % 2 === 1;
      const cells = new Array(c.per).fill(null);
      for (const x of sd.slots) {
        const turnedForReader = isBack && flipped ? !x.turned : x.turned;
        if (upside === null && turnedForReader) upside = { side: si, page: x.page };
        cells[isBack && flipped ? c.per - 1 - x.cell : x.cell] = x.page;
      }
      read.push(...cells);
    });
    eq(upside, null, `${label}: no page is upside down for a reader who turns the sheet like a page`);
    eq(read, read.map((_, i) => (i < c.n ? i + 1 : null)), `${label}: read across and down, side after side, the pages run 1 to ${c.n}`);
    if (two) registers(label, sides, g.sheet);

    // Cut marks: in the margin, at every edge of every cell, on every side; none when off.
    const want = c.marks ? 2 * (new Set(g.cells.flatMap(k => [k.cx, k.cx + g.cw].map(v => v.toFixed(2)))).size + new Set(g.cells.flatMap(k => [k.cy, k.cy + g.ch].map(v => v.toFixed(2)))).size) : 0;
    eq(sides.map(sd => sd.lines.length), sides.map(() => want), `${label}: ${want ? want + ' cut marks on every side' : 'no cut marks'}`);
    if (c.marks) {
      const gx0 = EDGE, gx1 = g.sheet[0] - EDGE, gy0 = EDGE, gy1 = g.sheet[1] - EDGE;
      const inMargin = l => [[l.x1, l.y1], [l.x2, l.y2]].every(([x, y]) => x >= -0.01 && y >= -0.01 && x <= g.sheet[0] + 0.01 && y <= g.sheet[1] + 0.01 && (x <= gx0 - 4.49 || x >= gx1 + 4.49 || y <= gy0 - 4.49 || y >= gy1 + 4.49));
      const onEdge = l => (close(l.x1, l.x2) ? g.cells.some(k => close(k.cx, l.x1) || close(k.cx + g.cw, l.x1)) : close(l.y1, l.y2) && g.cells.some(k => close(k.cy, l.y1) || close(k.cy + g.ch, l.y1)));
      ok(sides.every(sd => sd.lines.every(l => inMargin(l) && onEdge(l) && close(Math.abs(l.x2 - l.x1) + Math.abs(l.y2 - l.y1), 9))), `${label}: each mark is 9 pt long, in line with a cell edge, in the margin clear of the pages`);
    }
  }
  eq(page.__errs.length, 0, `pages per sheet: no page or console errors: ${JSON.stringify(page.__errs)}`);
  eq(page.__blocked.length, 0, 'pages per sheet: nothing tried to leave the site');
  await page.context().close();
}

// =============================================================================
// 4. Portfolios: one imposed PDF per student
// =============================================================================
{
  const page = await open();
  const named = [];
  for (const [who, count] of [['Ada_Invented', 5], ['Bo_Madeup', 2]]) for (let i = 1; i <= count; i++) {
    const f = path.join(tmp, `${who}_${String(i).padStart(2, '0')}.png`);
    fs.copyFileSync(files[i - 1], f); named.push(f);
  }
  await page.setInputFiles('#file-input', named);
  await page.check('#opt-portfolio');
  await page.selectOption('#impose-kind', 'booklet');
  const out = await generate(page);
  eq(out.name, 'portfolios.zip', 'portfolio mode still downloads a zip');
  const zip = readZip(out.bytes);
  eq(zip.map(e => e.name).sort(), ['Ada Invented.pdf', 'Bo Madeup.pdf'], 'one PDF per student');
  const ada = readPdf(zip.find(e => e.name.startsWith('Ada')).data), bo = readPdf(zip.find(e => e.name.startsWith('Bo')).data);
  eq([ada.length, bo.length, ada[0].box, ada.reduce((a, p) => a + p.slots.length, 0), bo.reduce((a, p) => a + p.slots.length, 0)], [4, 2, [792, 612], 5, 2], 'each student\'s PDF is a booklet of its own: 5 pages on 2 sheets, 2 pages on 1');
  ok(/each one laid out as a booklet/.test(out.msg), `the message says so (got "${out.msg}")`);
  eq(page.__errs.length, 0, `portfolios: no page or console errors: ${JSON.stringify(page.__errs)}`);
  await page.context().close();
}

await browser.close();
await new Promise(r => server.close(r));
fs.rmSync(tmp, { recursive: true, force: true });

if (!hasPoppler) console.log('  NOTE pdftoppm is not installed: the raster checks were skipped; the structural checks stand alone.');
console.log(failed ? `\nFAIL — ${failed} failed, ${passed} passed` : `\nPASS — ${passed} green`);
process.exit(failed ? 1 : 0);
