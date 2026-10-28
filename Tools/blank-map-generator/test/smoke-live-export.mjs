// smoke-live-export.mjs — 046's exports draw a plain built-in map from the vectors (Path 20 P3, step 4).
//
//   node Tools/blank-map-generator/test/smoke-live-export.mjs   (npm run test:blank-map-live-export, port 8587)
//
// Drives the real page on the lower-48 map. At a 3x view Download PNG's middle matches the live canvas
// pixel for pixel (same projection, same state, one function). At the 12x ceiling a border in the
// PNG is a hairline (the raster path it replaces was 38 px wide there). The tiled poster's pages, read
// from the images the page builds before it calls print() (stubbed), carry a border at most 6 px wide
// at 12x and join: the overlap strip of two neighbours is the same pixels. A data-shaded map is still
// the raster (its export is not the vector path). Nothing leaves the browser.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import fs from 'node:fs';

const PORT = 8587;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

console.log('Blank Map — exports from the vectors');
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/Tools/046-blank-map-generator.html', { waitUntil: 'networkidle' });
await settle(page, 700);
const offsiteAtStart = page.__blocked.length;
errors.length = 0;
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 300);

const zoomBy = (n, fx = 0.5, fy = 0.5) => page.evaluate(({ n, fx, fy }) => {
  const v = document.getElementById('viewport'), r = v.getBoundingClientRect();
  for (let i = 0; i < n; i++) v.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles: true, cancelable: true }));
}, { n, fx, fy });
const pngBase64 = async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#btnDownloadPng')]);
  return fs.readFileSync(await dl.path()).toString('base64');
};
/* how fat the ink is: the count of dark pixels whose whole 7 x 7 neighbourhood is dark. A stroke under 7 px wide leaves none; a smeared border leaves thousands. */
const fatInk = (src, crop) => page.evaluate(async ({ src, crop }) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const cx = crop ? Math.round(c.width * 0.15) : 0, cy = crop ? Math.round(c.height * 0.15) : 0;
  const W = c.width - 2 * cx, H = c.height - 2 * cy;
  const d = x.getImageData(cx, cy, W, H).data;
  const dark = new Uint8Array(W * H);
  let ink = 0;
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 200 && d[i * 4] < 120 && d[i * 4 + 1] < 120 && d[i * 4 + 2] < 140) { dark[i] = 1; ink++; }
  let fat = 0;
  for (let y = 3; y < H - 3; y++) for (let px = 3; px < W - 3; px++) {
    if (!dark[y * W + px]) continue;
    let all = true;
    for (let dy = -3; dy <= 3 && all; dy++) for (let dx = -3; dx <= 3; dx++) if (!dark[(y + dy) * W + px + dx]) { all = false; break; }
    if (all) fat++;
  }
  return { fat, ink };
}, { src, crop });

/* 3x: the PNG's middle is the canvas's middle */
await zoomBy(10);
await settle(page, 400);
const b64 = await pngBase64();
ok(b64.length > 1000, 'Download PNG produced a file');
const same = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const live = document.getElementById('baseCanvas');
  // the PNG is the viewport's border box (2 px bigger than the canvas); the origin is shared
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const x0 = Math.round(live.width * 0.2), y0 = Math.round(live.height * 0.2), w = Math.round(live.width * 0.6), h = Math.round(live.height * 0.5);
  const a = x.getImageData(x0, y0, w, h).data, b = live.getContext('2d').getImageData(x0, y0, w, h).data;
  let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
  return { diff, total: a.length / 4 };
}, b64);
ok(same.diff === 0 && same.total > 50000, 'the PNG middle equals the live canvas, ' + same.diff + ' of ' + same.total + ' pixels differ');

/* 12x on the Oklahoma panhandle's east edge */
await page.evaluate(async () => {
  const V = await import('/Tools/blank-map-generator/bmg-vector.js');
  const p = V.findPreset('usa-48'), s = V.pixelSizeFor(p.bounds), pt = V.projectPoint(p.bounds, s.width, s.height, -100, 35.5);
  window.__pt = pt;
});
await zoomBy(40);
await settle(page, 400);
const b12 = await pngBase64();
const t12 = await fatInk('data:image/png;base64,' + b12, true);
ok(t12.ink > 100, 'the 12x PNG has border ink: ' + t12.ink);
ok(t12.fat === 0, 'a border in the 12x PNG is a hairline (' + t12.fat + ' pixels sit in a 7 px block of ink)');

/* the tiled poster at the same view: print() is stubbed, the page builds its tile images first */
await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
await page.click('#btnTiledPrint');
await page.click('#btnTiledPrintGo');
await page.waitForFunction(() => window.__printed === true, null, { timeout: 60000 });
const tiles = await page.evaluate(() => [...document.querySelectorAll('#tiledPrintPages img')].map(i => i.src));
if (process.env.DUMP) tiles.forEach((s, i) => fs.writeFileSync(process.env.DUMP + '/tile' + i + '.png', Buffer.from(s.split(',')[1], 'base64')));
ok(tiles.length === 4, 'a 2 x 2 poster has four tiles: ' + tiles.length);
for (let i = 0; i < tiles.length; i++) {
  const t = await fatInk(tiles[i], false);
  ok(t.fat === 0, `poster tile ${i + 1}: ${t.fat} pixels sit in a 7 px block of ink (a raster border was 38 px at 12x)`);
}
/* the overlap strip between tile 1 (left) and tile 2 (right) is the same pixels: tile width 1200, overlap 40 each side */
const strip = await page.evaluate(async (srcs) => {
  const load = async s => { const i = new Image(); i.src = s; await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); return c; };
  const a = await load(srcs[0]), b = await load(srcs[1]);
  // a spans x 0..1240 of the poster, b spans 1160..2440: the shared strip is poster x 1160..1240
  const w = 80, h = Math.min(a.height, b.height);
  const da = a.getContext('2d').getImageData(1160, 0, w, h).data, db = b.getContext('2d').getImageData(0, 0, w, h).data;
  let diff = 0; for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) diff++;
  return { diff, n: da.length };
}, tiles);
ok(strip.diff === 0 && strip.n > 1000, 'neighbouring poster tiles agree on their overlap strip (' + strip.diff + ' bytes differ)');

ok(page.__blocked.length === offsiteAtStart, 'nothing requested off-site by these steps: ' + JSON.stringify(page.__blocked));
ok(errors.length === 0, 'no console errors: ' + JSON.stringify(errors));
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-export: all ${passed} passed`);
process.exit(failed ? 1 : 0);
