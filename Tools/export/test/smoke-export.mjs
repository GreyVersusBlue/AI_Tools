// smoke-export.mjs — _shared/export.js's toPdf() on the vendored jsPDF, in a
// real browser (Path 7 P4), driven on Tools/export/test/fixture.html because
// no tool has adopted it yet.
//
//   node Tools/export/test/smoke-export.mjs      (or: npm run test:export)
//
// export.test.mjs proves the imposition against a folded-paper model and runs
// toPdf() on a jsPDF that only takes notes. This proves what only the real
// library can: that jsPDF 2.5.2 has the matrix calls toPdf() uses, that the
// file it writes has the sheets, the sizes and the `cm` operators the plan
// says, and that the pages LAND where the plan says. Each source page is a
// canvas of one grey with a black top-left corner. Where `pdftoppm` is
// installed the PDF is rasterised and every slot is sampled: its grey says
// which page is there, the corner says which way up. Where it is not (CI),
// that part is skipped out loud and the structural checks stand alone.
//
// Nothing here has been checked on a physical printer, and no booklet has
// been folded.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8480;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const hasPoppler = spawnSync('pdftoppm', ['-v']).status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-kit-'));

const server = await serve(PORT);
const browser = await launch();
console.log('Export kit — toPdf() on the vendored jsPDF');

const page = await prepPage(browser, BASE, { width: 900, height: 700 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${BASE}/Tools/export/test/fixture.html`);
await settle(page);

eq(await page.evaluate(() => [typeof ExportKit, typeof jspdf.jsPDF]), ['object', 'function'], 'the fixture loads ExportKit and jsPDF');
eq(await page.evaluate(() => { const d = new jspdf.jsPDF(); return [typeof d.Matrix, typeof d.setCurrentTransformationMatrix, typeof d.saveGraphicsState, typeof d.restoreGraphicsState]; }),
   ['function', 'function', 'function', 'function'], 'the vendored jsPDF has the four calls placement is built on');

/** The grey page n of `count` is painted (never near the black corner or white paper). */
const grey = (n, count) => Math.round(60 + (n - 1) * (150 / Math.max(1, count - 1)));

/** Builds `count` canvas pages, runs toPdf(), returns the plan and the file. */
async function make(count, opts, how = 'canvas') {
  const res = await page.evaluate(({ count, opts, how, greys }) => {
    const pages = [];
    for (let n = 1; n <= count; n++) {
      const g = greys[n - 1];
      if (how === 'draw') {
        pages.push((doc, box) => {
          doc.setFillColor(g, g, g); doc.rect(0, 0, box.w, box.h, 'F');
          doc.setFillColor(0, 0, 0); doc.rect(0, 0, box.w / 2, box.h / 2, 'F');
        });
        continue;
      }
      const c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      const x = c.getContext('2d');
      x.fillStyle = `rgb(${g},${g},${g})`; x.fillRect(0, 0, 40, 40);
      x.fillStyle = '#000'; x.fillRect(0, 0, 20, 20);
      pages.push(how === 'dataurl' ? c.toDataURL('image/png') : c);
    }
    const out = ExportKit.toPdf(pages, opts);
    return { plan: out.plan, pdf: out.doc.output('datauristring').split(',')[1] };
  }, { count, opts, how, greys: Array.from({ length: count }, (_, i) => grey(i + 1, count)) });
  return { plan: res.plan, bytes: Buffer.from(res.pdf, 'base64') };
}

/** What the file says: page count, each page's size, each page's `cm` operators. */
function read(bytes) {
  const text = bytes.toString('latin1');
  const sizes = [...text.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map(m => [Math.round(+m[3]), Math.round(+m[4])]);
  // A page's drawing is the stream of the object its /Contents names; a blank side has an empty one.
  const streams = [...text.matchAll(/\/Contents (\d+) 0 R/g)].map(m => {
    const obj = new RegExp('(?:^|\\n)' + m[1] + ' 0 obj\\r?\\n[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)endstream').exec(text);
    return obj ? obj[1] : '';
  });
  return { pages: (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length, sizes, streams };
}
/** The placement matrices of one page's content stream: `cm`s that follow a bare `q` (jsPDF's own image `cm` follows a `q` too, but inside ours). */
function matrices(stream) {
  const out = [];
  const lines = stream.split(/\r?\n/).map(l => l.trim());
  let depth = 0;
  for (const l of lines) {
    if (l === 'q') { depth++; continue; }
    if (l === 'Q') { depth--; continue; }
    const m = /^(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm$/.exec(l);
    if (m && depth === 1) out.push(m.slice(1).map(Number));
    const inline = /^q (-?[\d.]+ ){6}cm/.test(l);   // an image's own q ... cm ... Q on one line
    if (inline && !/Q$/.test(l)) depth++;
  }
  return out;
}

/** Rasterises with pdftoppm and returns a sampler: grey(pageIndex, xPt, yPt). */
function raster(bytes, name) {
  const file = path.join(tmp, name + '.pdf');
  fs.writeFileSync(file, bytes);
  const r = spawnSync('pdftoppm', ['-r', '36', '-gray', '-aa', 'no', file, path.join(tmp, name)]);
  if (r.status !== 0) throw new Error('pdftoppm failed: ' + r.stderr);
  const files = fs.readdirSync(tmp).filter(f => f.startsWith(name + '-') && f.endsWith('.pgm')).sort((a, b) => parseInt(a.slice(name.length + 1), 10) - parseInt(b.slice(name.length + 1), 10));
  const imgs = files.map(f => {
    const buf = fs.readFileSync(path.join(tmp, f));
    const head = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.toString('latin1', 0, 40));
    return { w: +head[1], h: +head[2], data: buf.subarray(head[0].length) };
  });
  return (p, x, y) => { const im = imgs[p]; const px = Math.min(im.w - 1, Math.floor(x / 2)), py = Math.min(im.h - 1, Math.floor(y / 2)); return im.data[py * im.w + px]; };
}

/** Checks one file against its plan, structurally and (with poppler) by eye. */
function verify(label, count, made) {
  const { plan, bytes } = made;
  const doc = read(bytes);
  eq(doc.pages, Math.max(1, plan.sides.length), `${label}: one PDF page a side`);
  ok(doc.sizes.length >= 1 && doc.sizes.every(s => s[0] === Math.round(plan.sheet.w) && s[1] === Math.round(plan.sheet.h)), `${label}: every page is the sheet's size (${Math.round(plan.sheet.w)} x ${Math.round(plan.sheet.h)} pt; got ${JSON.stringify(doc.sizes[0])})`);
  const want = plan.sides.map(s => s.slots.filter(x => x.page !== null).map(x => x.matrix.map(v => +v.toFixed(2))));
  const got = doc.streams.slice(0, plan.sides.length).map(s => matrices(s).map(m => m.map(v => +v.toFixed(2))));
  eq(got, want, `${label}: the file's placement matrices are the plan's`);
  if (!hasPoppler) return;
  const at = raster(bytes, label.replace(/\W+/g, '-'));
  let wrongPage = null, wrongWay = null, notBlank = null;
  plan.sides.forEach((side, si) => side.slots.forEach(x => {
    // The centre of each quarter of the slot: a page's top-left quarter is black.
    const q = (fx, fy) => at(si, x.x + x.w * fx, x.y + x.h * fy);
    const tl = q(0.25, 0.25), br = q(0.75, 0.75), tr = q(0.75, 0.25), bl = q(0.25, 0.75);
    if (x.page === null) { if ([tl, br, tr, bl].some(v => v < 250) && !notBlank) notBlank = { side: si, x }; return; }
    const g = grey(x.page, count);
    const black = x.rotate === 180 ? br : tl, body = x.rotate === 180 ? tl : br;
    if ((Math.abs(body - g) > 3 || Math.abs(tr - g) > 3 || Math.abs(bl - g) > 3) && !wrongPage) wrongPage = { side: si, page: x.page, want: g, got: [body, tr, bl] };
    if (black > 10 && !wrongWay) wrongWay = { side: si, page: x.page, rotate: x.rotate, corner: black };
  }));
  ok(wrongPage === null, `${label}: rasterised, every slot holds the page the plan names${wrongPage ? ' — ' + JSON.stringify(wrongPage) : ''}`);
  ok(wrongWay === null, `${label}: ... the right way up${wrongWay ? ' — ' + JSON.stringify(wrongWay) : ''}`);
  ok(notBlank === null, `${label}: ... and a blank slot is white paper${notBlank ? ' — ' + JSON.stringify(notBlank) : ''}`);
}

verify('1-up, 3 pages', 3, await make(3, {}));
verify('booklet, 8 pages', 8, await make(8, { impose: { kind: 'booklet' } }));
verify('booklet, 5 pages (3 blanks)', 5, await make(5, { impose: { kind: 'booklet' } }));
verify('booklet, long-edge flip', 8, await make(8, { impose: { kind: 'booklet', flip: 'long' } }));
verify('booklet, creep and two signatures', 14, await make(14, { impose: { kind: 'booklet', creep: 6, sheetsPerSignature: 2 } }));
verify('booklet of letter pages on A4', 4, await make(4, { paper: 'a4', impose: { kind: 'booklet' }, pageSize: { w: 612, h: 792 } }));
verify('booklet from data URLs', 4, await make(4, { impose: { kind: 'booklet', flip: 'long' } }, 'dataurl'));
verify('booklet from draw functions', 6, await make(6, { impose: { kind: 'booklet', flip: 'long' } }, 'draw'));
verify('4-up with margins and a gutter', 7, await make(7, { impose: { kind: 'nup', cols: 2, rows: 2 }, margin: '0.5in', gutter: '0.25in', pageSize: { w: 612, h: 792 } }));
verify('6-up by columns, two-sided, landscape', 15, await make(15, { orientation: 'landscape', impose: { kind: 'nup', cols: 3, rows: 2, order: 'column', duplex: true }, margin: 18 }, 'draw'));
verify('2-up fronts first, backs reversed', 6, await make(6, { orientation: 'landscape', impose: { kind: 'nup', cols: 2, rows: 1, duplex: true }, stack: 'fronts-first', reverseBacks: true }));

// ---- the model again, on the raster: does a long-edge back sit behind its front? ----
if (hasPoppler) {
  // Page 2 must be behind page 1. Short edge: turn about the vertical axis, so
  // page 1's slot at x is page 2's at W - x - w. Long edge: about the
  // horizontal axis, same x, and page 2 upside down on the sheet.
  for (const flip of ['short', 'long']) {
    const { plan } = await make(4, { impose: { kind: 'booklet', flip } });
    const one = plan.sides[0].slots.find(s => s.page === 1), two = plan.sides[1].slots.find(s => s.page === 2);
    const behind = flip === 'short' ? plan.sheet.w - two.x - two.w : two.x;
    eq([behind, two.rotate], [one.x, flip === 'short' ? 0 : 180], `turned on the ${flip} edge, page 2 is printed behind page 1`);
  }
}

// ---- cut marks and saving ---------------------------------------------------------
{
  const made = await make(4, { impose: { kind: 'nup', cols: 2, rows: 2 }, margin: 36, cutMarks: true });
  const doc = read(made.bytes);
  const lines = (doc.streams[0].match(/^[\d.]+ [\d.]+ m\s*\n?[\d.]+ [\d.]+ l\s*\n?S$/gm) || []).length || (doc.streams[0].match(/ l\b/g) || []).length;
  eq(lines, 12, 'cut marks: twelve strokes on a 2 x 2 side');
  if (hasPoppler) {
    const at = raster(made.bytes, 'marks');
    ok(at(0, 36, 27) < 200 && at(0, 100, 27) > 250, 'rasterised, a mark is in the top margin at the grid\'s left edge and nowhere along it');
  }
}
{
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => { ExportKit.toPdf([(doc, b) => doc.text('Page', 20, 20)], { filename: 'one.pdf', title: 'One' }); })
  ]);
  eq(download.suggestedFilename(), 'one.pdf', 'a filename downloads the file under that name');
  const saved = fs.readFileSync(await download.path());
  ok(saved.subarray(0, 5).toString('latin1') === '%PDF-' && /\/Title \(One\)/.test(saved.toString('latin1')), 'the download is a PDF and carries its title');
}
eq(await page.evaluate(() => { const saved = window.jspdf; window.jspdf = undefined; try { ExportKit.toPdf([]); return 'no error'; } catch (e) { return /jsPDF is not loaded/.test(e.message); } finally { window.jspdf = saved; } }),
   true, 'without jsPDF, toPdf() throws an error that names the missing file');
eq(errors, [], 'no page errors');

if (!hasPoppler) console.log('  NOTE pdftoppm is not installed: the PDFs were checked by structure only, not rasterised.');

await browser.close();
await new Promise(r => server.close(r));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
