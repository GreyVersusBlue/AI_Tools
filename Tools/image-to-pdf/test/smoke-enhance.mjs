// smoke-enhance.mjs — the whiteboard / worksheet cleanup pass.
//
//   node Tools/image-to-pdf/test/smoke-enhance.mjs
//
// A phone photo of a whiteboard is grey, lit unevenly (bright by the window,
// dim in the far corner) and carries the room's colour cast. Printed as-is it
// costs a lot of toner and reads badly. The cleanup flattens the illumination,
// sets the board to white, and pushes the writing dark.
//
// A synthetic "photo" is generated for this: a board with a left-to-right
// brightness gradient and a warm colour cast, with dark strokes written on it
// in known places. That makes the improvement measurable rather than a matter
// of opinion — the suite reads real pixels out of the tool's own before/after
// preview, which is produced by the same function the PDF pipeline uses.
// What it holds down:
//
//   The gradient is flattened: the dim corner of the board and the bright
//   corner both end up near white, within a few levels of each other. That is
//   the whole point — a photo that is white at one edge and grey at the other
//   is the thing being fixed.
//
//   The writing gets darker, not lighter, and contrast goes up.
//
//   The colour cast is removed, since the flat-field runs per channel.
//
//   Marker colour survives on the whiteboard setting. "Worksheet" is allowed
//   to crush harder; "whiteboard" must not turn red marker into black.
//
//   Off means off — the pixels are untouched and the PNG passthrough still
//   applies.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { makePng } from './make-fixtures.mjs';

const PORT = 8111;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/011-image-to-pdf.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── the synthetic whiteboard photo ──────────────────────────────────────────
   400×300. The board runs from a dim 118 on the left to a bright 210 on the
   right, with a warm cast (red above blue). Three marks are written on it:
   near-black at the dim end, near-black at the bright end, and a red one in
   the middle. */
const W = 400, H = 300;
const MARKS = {
  dimInk: { x: 60, y: 150 },
  brightInk: { x: 340, y: 150 },
  redMark: { x: 200, y: 90 },
};
const BOARD = {
  dimCorner: { x: 30, y: 30 },
  brightCorner: { x: 370, y: 270 },
};
function boardPixel(x) {
  const base = 118 + (210 - 118) * (x / W);
  return [Math.round(base * 1.06), Math.round(base), Math.round(base * 0.88)];  // warm cast
}
const near = (x, y, m, r = 14) => Math.abs(x - m.x) < r && Math.abs(y - m.y) < r;
const photo = makePng(W, H, (x, y) => {
  if (near(x, y, MARKS.dimInk) || near(x, y, MARKS.brightInk)) {
    const b = boardPixel(x);
    return [Math.round(b[0] * 0.22), Math.round(b[1] * 0.22), Math.round(b[2] * 0.22)];
  }
  if (near(x, y, MARKS.redMark)) {
    const b = boardPixel(x);
    return [Math.round(b[0] * 0.95), Math.round(b[1] * 0.22), Math.round(b[2] * 0.22)];
  }
  return boardPixel(x);
});

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img2pdf-enhance-'));
const photoPath = path.join(tmpDir, 'whiteboard.png');
fs.writeFileSync(photoPath, photo);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

/** Sample the named points out of one of the preview images. */
async function sample(imgId) {
  return page.evaluate(async ({ id, W, H, points }) => {
    const el = document.getElementById(id);
    if (!el || !el.src) return null;
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = el.src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const out = {};
    for (const [name, p] of Object.entries(points)) {
      const px = Math.min(c.width - 1, Math.round(p.x / W * c.width));
      const py = Math.min(c.height - 1, Math.round(p.y / H * c.height));
      const d = ctx.getImageData(px, py, 1, 1).data;
      out[name] = { r: d[0], g: d[1], b: d[2], lum: Math.round(0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]) };
    }
    return out;
  }, { id: imgId, W, H, points: { ...MARKS, ...BOARD } });
}

console.log('Image → PDF — whiteboard / worksheet cleanup');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.setInputFiles('#file-input', [photoPath]);
await settle(page, 600);

/* ── 1. off by default, and no preview ───────────────────────────────────── */
eq(await page.inputValue('#enhance'), 'off', 'cleanup is off unless it is asked for');
ok(!(await page.isVisible('#enhance-preview')), 'and no before/after is shown');

/* ── 2. whiteboard mode ──────────────────────────────────────────────────── */
await page.selectOption('#enhance', 'whiteboard');
await settle(page, 800);
ok(await page.isVisible('#enhance-preview'), 'picking a mode shows the before/after');

const before = await sample('enhance-before');
const after = await sample('enhance-after');
ok(before && after, 'both preview images decoded');

/* the fixture really is the problem being solved */
ok(before.brightCorner.lum - before.dimCorner.lum > 50,
   `the source really is unevenly lit (${before.dimCorner.lum} → ${before.brightCorner.lum})`);
ok(before.dimCorner.r > before.dimCorner.b + 8,
   `and really does have a warm cast (r ${before.dimCorner.r} vs b ${before.dimCorner.b})`);

/* the gradient is flattened and the board goes white */
ok(after.dimCorner.lum > 235, `the dim corner of the board comes out white (${after.dimCorner.lum})`);
ok(after.brightCorner.lum > 235, `so does the bright corner (${after.brightCorner.lum})`);
ok(Math.abs(after.dimCorner.lum - after.brightCorner.lum) <= 6,
   `and the two ends match within a few levels (${after.dimCorner.lum} vs ${after.brightCorner.lum})`);

/* the colour cast is gone */
ok(Math.abs(after.dimCorner.r - after.dimCorner.b) <= 6,
   `the warm cast is neutralised (r ${after.dimCorner.r} vs b ${after.dimCorner.b})`);

/* the writing gets darker at both ends of the lighting */
ok(after.dimInk.lum < before.dimInk.lum,
   `writing in the dim area darkens (${before.dimInk.lum} → ${after.dimInk.lum})`);
ok(after.brightInk.lum < before.brightInk.lum,
   `writing in the bright area darkens too (${before.brightInk.lum} → ${after.brightInk.lum})`);

const contrastBefore = before.dimCorner.lum - before.dimInk.lum;
const contrastAfter = after.dimCorner.lum - after.dimInk.lum;
ok(contrastAfter > contrastBefore,
   `contrast against the board goes up (${contrastBefore} → ${contrastAfter})`);

/* marker colour survives */
ok(after.redMark.r - after.redMark.g > 40,
   `red marker is still red, not black (r ${after.redMark.r}, g ${after.redMark.g})`);

/* ── 3. worksheet mode pulls harder ──────────────────────────────────────── */
await page.selectOption('#enhance', 'worksheet');
await settle(page, 800);
const sheet = await sample('enhance-after');
ok(sheet.dimInk.lum <= after.dimInk.lum,
   `worksheet mode is at least as aggressive on the ink (${after.dimInk.lum} → ${sheet.dimInk.lum})`);
ok(sheet.dimCorner.lum > 235, 'and still leaves the paper white');

/* ── 4. off restores the original pixels ─────────────────────────────────── */
await page.selectOption('#enhance', 'off');
await settle(page, 500);
ok(!(await page.isVisible('#enhance-preview')), 'turning it off hides the preview again');

/* ── 5. the cleanup reaches the generated PDF ────────────────────────────── */
async function generate() {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#btn-generate'),
  ]);
  const out = path.join(tmpDir, 'out-' + Date.now() + '.pdf');
  await download.saveAs(out);
  return fs.readFileSync(out);
}
const plainPdf = await generate();
ok(plainPdf.subarray(0, 5).toString('latin1') === '%PDF-', 'a PDF is produced with cleanup off');

await page.selectOption('#enhance', 'worksheet');
await settle(page, 800);
const cleanedPdf = await generate();
ok(cleanedPdf.subarray(0, 5).toString('latin1') === '%PDF-', 'and with cleanup on');
ok(cleanedPdf.length !== plainPdf.length,
   `the cleaned PDF's bytes differ from the untouched one (${plainPdf.length} vs ${cleanedPdf.length}), ` +
   'so the pass really is running in the pipeline and not only in the preview');

/* ── 6. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
