// smoke-photo.mjs — the photo editor: parametric crop, shaped windows, filters.
//
//   node Tools/historical-trading-card-maker/test/smoke-photo.mjs
//
// The photo pipeline is non-destructive: a card image stores a downscaled
// master plus { crop: {x, y, scale}, shape, filter }, the DOM renders it with
// object-fit/object-position/transform (HtcmPhoto.photoStyle) and the canvas
// exporter inverts the same math into a drawImage source rect
// (HtcmPhoto.sourceRect). What this suite holds down:
//
//   The editor round-trips: pick a photo, open the editor from the deck list,
//   change shape / zoom / filter, save — and the choice lands in the stored
//   v2 document, the live preview, and the print run.
//
//   photoStyle and sourceRect agree — the source-rect math is asserted
//   against hand-computed values, since it is the exporter's half of the
//   WYSIWYG promise.
//
//   The clip-path defs are duplicated into #printArea, because url(#…) refs
//   into subtrees the print stylesheet hides have historically been dropped.
//
// Exits 1 on any failure.

/* global HtcmPhoto, HtcmExport -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8165;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const PX_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });

console.log('Trading Card Maker — photo crop, shapes, filters');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

/* ── 1. a picked photo lands downscaled, with defaults, in a shaped window ── */
await page.fill('#newName', 'Cleopatra');
await page.fill('#newStats', 'Reign: 51-30 BC');
await page.setInputFiles('#newImage', { name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(PX_PNG, 'base64') });
await page.waitForTimeout(400); // downscale is async
ok(await page.isVisible('#adjustBtn'), 'picking a photo reveals the Adjust button');
await page.click('#addEntryBtn');
await settle(page);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('htcm:data:My cards')).cards[0].image);
ok(stored && /^data:image\/jpeg/.test(stored.src), 'the photo is stored re-encoded by the downscaler');
eq(stored.shape, 'rrect', 'the default window shape is the rounded rect');
near(stored.crop.x, 0.5, 0.001, 'the default focal point is centered');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .pwin.shape-rrect')),
   'the preview renders the photo inside its shaped window');
const clip = await page.evaluate(() => getComputedStyle(document.querySelector('#previewFront .pwin')).clipPath);
ok(clip && clip.includes('htcm-clip-rrect'), 'the window is clipped by the shared clipPath def');

/* ── 2. the editor round-trips shape, zoom, and filter ───────────────────── */
await page.click('[data-adjust]');
ok(await page.isVisible('.pe-save'), 'the Photo button opens the editor');
await page.click('.pe-shapes [data-shape="shield"]');
await page.evaluate(() => {
  const z = document.querySelector('.pe-zoom');
  z.value = '2'; z.dispatchEvent(new Event('input'));
});
await page.click('.pe-filters [data-filter="sepia"]');
await page.click('.pe-save');
await settle(page);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('htcm:data:My cards')).cards[0].image);
eq(after.shape, 'shield', 'the shape choice is saved');
near(after.crop.scale, 2, 0.001, 'the zoom is saved');
eq(after.filter, 'sepia', 'the filter is saved');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .pwin.shape-shield.medallion')),
   'a shield window renders as a centered medallion');
const imgStyle = await page.evaluate(() => document.querySelector('#previewFront .pwin img').getAttribute('style'));
ok(imgStyle.includes('scale(2)'), 'the zoom reaches the rendered card');
ok(imgStyle.includes('sepia'), 'the filter reaches the rendered card');
ok(await page.evaluate(() => !!document.querySelector('#previewFront .pwin .pwin-rim path')),
   'the shaped window carries its rim stroke');

/* ── 3. sourceRect inverts photoStyle — the exporter's half of WYSIWYG ───── */
const rect = await page.evaluate(() =>
  HtcmPhoto.sourceRect({ w: 1000, h: 500, crop: { x: 0.5, y: 0.5, scale: 2 } }, 200, 100));
near(rect.sx, 250, 0.01, 'zoom 2 centered: source x starts a quarter in');
near(rect.sy, 125, 0.01, 'and a quarter down');
near(rect.sw, 500, 0.01, 'showing half the width');
near(rect.sh, 250, 0.01, 'and half the height');
const rect2 = await page.evaluate(() =>
  HtcmPhoto.sourceRect({ w: 1000, h: 500, crop: { x: 0, y: 1, scale: 1 } }, 100, 100));
near(rect2.sx, 0, 0.01, 'focal point at the left edge pins the crop left');
near(rect2.sw, 500, 0.01, 'cover-fit of a square window onto 2:1 takes the full height as width');

/* ── 4. the print run keeps the shapes: defs live inside #printArea ──────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
ok(await page.evaluate(() => !!document.querySelector('#printArea .pwin.shape-shield')),
   'the printed card uses the shaped window');
ok(await page.evaluate(() => !!document.querySelector('#printArea svg.htcm-defs clipPath#htcm-clip-shield') ||
                             document.querySelectorAll('clipPath[id="htcm-clip-shield"]').length >= 2),
   'the clipPath defs are duplicated into the print subtree');

/* ── 5. canvas export: 300 DPI, and the pixels land where the DOM puts them ─ */
const sample = await page.evaluate(() => new Promise((res) => {
  // a synthetic entry with a known-white photo, independent of editor state
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const cx = c.getContext('2d');
  cx.fillStyle = '#fff';
  cx.fillRect(0, 0, 8, 8);
  const entry = {
    id: 'x', name: 'Sample', facts: ['A fact.'],
    stats: [{ label: 'Power', value: '8/10' }],
    image: { src: c.toDataURL('image/jpeg'), w: 8, h: 8, crop: { x: 0.5, y: 0.5, scale: 1 }, shape: 'rrect', filter: 'none' },
    meta: { rarity: 'common', setName: '', cardNo: 0, setSize: 0, stars: 0 }, theme: null
  };
  HtcmExport.renderCardCanvas(entry, 'front', { theme: 'parchment' }, (canvas) => {
    const ctx = canvas.getContext('2d');
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    res({
      w: canvas.width, h: canvas.height,
      border: px(Math.round(canvas.width / 2), 2),   // cut-line stroke, theme accent
      photo: px(Math.round(canvas.width / 2), 150),  // inside the banner window: the white test photo
      paper: px(Math.round(canvas.width / 2), canvas.height - 200) // empty stats area: parchment paper
    });
  });
}));
eq(sample.w, 750, 'the export canvas renders 2.5in at 300 DPI');
eq(sample.h, 1050, 'and 3.5in at 300 DPI');
near(sample.border[0], 138, 30, 'the cut-line border strokes in the theme accent (r≈138)');
ok(sample.photo[2] > 235, 'the photo pixels land inside the shaped window (white test photo)');
near(sample.paper[0], 244, 12, 'the paper keeps the theme color (r≈244)');
near(sample.paper[2], 208, 14, 'and its warmth (b≈208) — not white, not the photo');

/* ── 6. the export libraries are wired: jsPDF and JSZip from _shared/vendor ─ */
ok(await page.evaluate(() => !!(window.jspdf && window.jspdf.jsPDF)), 'the vendored jsPDF is loaded');
ok(await page.evaluate(() => !!window.JSZip), 'the vendored JSZip is loaded');
ok(await page.evaluate(() => !!(window.DuplexPrint && DuplexPrint.paginate && DuplexPrint.mirrorPageRows)),
   'the extracted _shared/duplex-print.js is loaded');
eq(await page.evaluate(() => DuplexPrint.mirrorPageRows(['a', 'b', 'c', 'd'], 3).join(',')), 'c,b,a,,,d',
   'row-mirroring still pads and reverses each row');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
