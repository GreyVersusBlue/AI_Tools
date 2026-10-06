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
// The second half is download(): the anchor it clicks is caught in the page
// and the file read from its blob URL (name, type, bytes), with one real click
// read through harness.downloadText(); and toXlsx() and toZip() with the
// inputs only a browser has, a Blob and a canvas.
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';
import { readZip } from './_zip-read.mjs';

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

// ---- download(), and the helpers that save through it -----------------------
console.log('Export kit — download(), toXlsx() and toZip() in the page');

eq(await page.evaluate(() => [typeof XLSX, typeof JSZip]), ['object', 'function'], 'the fixture loads SheetJS and JSZip');

/** Runs `body` (the source of a function taking ExportKit, which may return a
    promise) with the anchor click caught: the file is read from its blob URL
    and never reaches the disk. Resolves to what was clicked. */
const capture = (body) => page.evaluate(async (body) => {
  const real = HTMLAnchorElement.prototype.click;
  const clicks = [];
  HTMLAnchorElement.prototype.click = function () {
    clicks.push({ name: this.getAttribute('download'), href: this.href, inBody: this.parentNode === document.body, shown: getComputedStyle(this).display,
      read: fetch(this.href).then(r => r.blob()).then(async b => ({ type: b.type, bytes: [...new Uint8Array(await b.arrayBuffer())] })) });
  };
  let result, threw = null;
  try { result = await (0, eval)('(' + body + ')')(ExportKit); } catch (e) { threw = String(e && e.message || e); }
  HTMLAnchorElement.prototype.click = real;
  const out = [];
  for (const c of clicks) out.push(Object.assign({ name: c.name, scheme: c.href.split(':')[0], inBody: c.inBody, shown: c.shown }, await c.read));
  return {
    clicks: out, threw, anchorsLeft: document.querySelectorAll('a[download]').length,
    returned: result instanceof Blob ? { type: result.type, size: result.size } : result === undefined ? null : result,
  };
}, String(body));
const text = bytes => Buffer.from(bytes).toString('utf8');

{
  const r = await capture(K => K.download('héllo, 字\r\n', 'notes.txt', 'text/plain'));
  eq(r.clicks.length, 1, 'download(): one anchor is clicked');
  const c = r.clicks[0];
  eq([c.name, c.scheme, c.type], ['notes.txt', 'blob', 'text/plain'], 'download(): the anchor carries the file name and a blob URL of the type asked for');
  eq(text(c.bytes), 'héllo, 字\r\n', 'download(): the blob is the text, as UTF-8');
  eq([c.inBody, c.shown, r.anchorsLeft], [true, 'none', 0], 'download(): the anchor is in the page for the click, never visible, and gone afterwards');
  eq(r.returned, { type: 'text/plain', size: c.bytes.length }, 'download(): it returns the Blob it saved');
}
{
  const r = await capture(K => K.download(new Uint8Array([1, 2, 3, 250]).buffer, 'raw.bin'));
  eq([r.clicks[0].name, r.clicks[0].type, r.clicks[0].bytes], ['raw.bin', 'application/octet-stream', [1, 2, 3, 250]], 'download(): an ArrayBuffer with no type is octet-stream, byte for byte');
  const t = await capture(K => K.download(new Uint8Array([9, 8]), 'typed.bin', 'application/x-test'));
  eq([t.clicks[0].type, t.clicks[0].bytes], ['application/x-test', [9, 8]], 'download(): a typed array too');
  const b = await capture(K => K.download(new Blob(['kept'], { type: 'text/markdown' }), 'kept.md'));
  eq([b.clicks[0].type, text(b.clicks[0].bytes)], ['text/markdown', 'kept'], 'download(): a Blob keeps its own type');
  const re = await capture(K => K.download(new Blob(['a,b'], { type: 'text/plain' }), 're.csv', 'text/csv'));
  eq([re.clicks[0].type, text(re.clicks[0].bytes)], ['text/csv', 'a,b'], 'download(): a mime re-types a Blob that has another');
  const n = await capture(K => K.download('x', ''));
  eq(n.clicks[0].name, 'download', 'download(): no name is "download", not an empty attribute');
}
{
  // The harness's own reader, on a real click: what a tool's suite will call.
  await page.evaluate(() => { window.saveNotes = () => { ExportKit.download(ExportKit.toCsv([['Ines Okafor', '=1+1']]), ExportKit.filename('Period 3: roster', 'csv'), ExportKit.MIME.csv); }; });
  const [dl, csv] = await Promise.all([
    page.waitForEvent('download'),
    downloadText(page, { call: 'saveNotes' }, { what: 'the roster CSV' }),
  ]);
  eq(dl.suggestedFilename(), 'Period 3 roster.csv', 'a real click: the browser is offered the file under filename()\'s safe name');
  await dl.cancel().catch(() => {});
  eq(csv.replace(/^\uFEFF/, ''), "Ines Okafor,'=1+1\r\n", 'a real click: harness.downloadText() reads the CSV, guarded');
  const viaCapture = await capture(K => K.download(K.toCsv([['a']]), 'a.csv', K.MIME.csv));
  // A blob URL answers with the bare type; the Blob itself keeps the charset.
  eq([viaCapture.returned.type, viaCapture.clicks[0].type, viaCapture.clicks[0].bytes.slice(0, 3)], ['text/csv;charset=utf-8', 'text/csv', [0xEF, 0xBB, 0xBF]], 'a CSV saved through download() is a text/csv Blob that says utf-8 and starts with the three BOM bytes');
}
{
  const r = await capture(K => K.toXlsx([{ name: 'Scores', rows: [{ n: 'Ines Okafor', s: 9 }, { n: '=cmd', s: -1 }] }], { filename: 'scores.xlsx' }));
  eq(r.clicks.length, 1, 'toXlsx({ filename }): one file is saved');
  const c = r.clicks[0];
  eq([c.name, c.type], ['scores.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'toXlsx: under its name and the xlsx type');
  eq(r.returned, { type: c.type, size: c.bytes.length }, 'toXlsx: and returns that Blob');
  const parts = readZip(Buffer.from(c.bytes));
  ok(parts.every(e => e.crcOk) && parts.some(e => e.name === 'xl/worksheets/sheet1.xml'), 'toXlsx: the saved bytes are a sound zip with a sheet in it');
  const shared = parts.find(e => e.name === 'xl/sharedStrings.xml').data.toString('utf8');
  ok(shared.includes('<t>=cmd</t>') && !parts.some(e => /<f[ >/]/.test(e.data.toString('utf8'))), 'toXlsx: the typed formula is a shared string, and the package has no formula');
  eq((await capture(K => { K.toXlsx([['a']]); })).clicks.length, 0, 'toXlsx with no filename saves nothing');
  const gone = await capture(K => { const X = window.XLSX; window.XLSX = undefined; try { K.toXlsx([['a']]); } finally { window.XLSX = X; } });
  ok(/SheetJS is not loaded/.test(gone.threw || '') && gone.threw.includes('_shared/vendor/xlsx/xlsx.full.min.js'), 'toXlsx with no SheetJS on the page throws, naming the vendored file');
}
{
  const r = await capture(async K => {
    const c = document.createElement('canvas');
    c.width = 3; c.height = 2;
    const x = c.getContext('2d');
    x.fillStyle = '#c00'; x.fillRect(0, 0, 3, 2);
    await K.toZip([
      { name: 'cards/front.png', data: c },
      { name: 'note.txt', data: new Blob(['from a blob, é']) },
      { name: 'note.txt', data: 'from a string' },
      { name: 'raw.bin', data: new Uint8Array([7, 7, 7]).buffer },
    ], { filename: 'set.zip' });
  });
  eq(r.threw, null, 'toZip({ filename }) with a canvas, a Blob, a string and an ArrayBuffer resolves');
  const c = r.clicks[0] || { bytes: [] };
  eq([r.clicks.length, c.name, c.type], [1, 'set.zip', 'application/zip'], 'toZip: one file is saved, under its name, as application/zip');
  const parts = c.bytes.length ? readZip(Buffer.from(c.bytes)) : [];
  eq(parts.map(e => e.name), ['cards-front.png', 'note.txt', 'note (2).txt', 'raw.bin'], 'toZip: the names, flat, the repeat numbered');
  ok(parts.length === 4 && parts.every(e => e.crcOk), 'toZip: every CRC-32 is right by the suite\'s own reader');
  if (parts.length === 4) {
    eq([...parts[0].data.subarray(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 'toZip: a canvas is stored as a PNG');
    eq([parts[0].data.readUInt32BE(16), parts[0].data.readUInt32BE(20)], [3, 2], 'toZip: of the canvas\'s own 3 x 2 pixels');
    eq([parts[1].data.toString('utf8'), parts[2].data.toString('utf8'), [...parts[3].data]], ['from a blob, é', 'from a string', [7, 7, 7]], 'toZip: a Blob, a string and an ArrayBuffer come back byte for byte');
  }
  const back = await page.evaluate(async () => {
    const blob = await ExportKit.toZip([{ name: 'a.txt', data: 'one' }]);
    const z = await JSZip.loadAsync(blob);
    return [blob instanceof Blob, blob.type, Object.keys(z.files), await z.file('a.txt').async('string')];
  });
  eq(back, [true, 'application/zip', ['a.txt'], 'one'], 'toZip with no filename resolves to a Blob JSZip reads back, and saves nothing');
  const gone = await capture(K => { const Z = window.JSZip; window.JSZip = undefined; try { K.toZip([]); } finally { window.JSZip = Z; } });
  ok(/JSZip is not loaded/.test(gone.threw || '') && gone.threw.includes('_shared/vendor/jszip/jszip.min.js'), 'toZip with no JSZip on the page throws, naming the vendored file');
}

if (!hasPoppler) console.log('  NOTE pdftoppm is not installed: the PDFs were checked by structure only, not rasterised.');

await browser.close();
await new Promise(r => server.close(r));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
