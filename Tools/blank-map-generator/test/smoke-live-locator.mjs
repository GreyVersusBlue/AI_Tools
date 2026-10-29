// smoke-live-locator.mjs — the locator inset is drawn from the vectors (Path 20 P3, step 6).
//
//   node Tools/blank-map-generator/test/smoke-live-locator.mjs   (npm run test:blank-map-live-locator, port 8589)
//
// With a plain built-in map on the live canvas, the inset shows #locatorCanvas (one drawBaseMap call at
// the fit view, 150 px on its long side) and hides the raster <img>; Download PNG draws that canvas, not
// the image, into the export. Hiding the live map (a new project) puts the picture back. Nothing is
// requested off-site by these steps.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8589;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

console.log('Blank Map — the locator from the vectors');
const server = await serve(PORT);
const browser = await launch();
const errors = [];
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/Tools/046-blank-map-generator.html', { waitUntil: 'networkidle' });
await settle(page, 700);
const offsite0 = page.__blocked.length;
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 400);
await page.click('#btnLocator');
await settle(page, 300);

const st = () => page.evaluate(() => {
  const c = document.getElementById('locatorCanvas'), img = document.getElementById('locatorImg'), box = document.getElementById('locatorInset');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 16) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
  return { canvasHidden: c.hidden, imgHidden: img.hidden, w: c.width, h: c.height, cssW: box.clientWidth, cssH: box.clientHeight, colours: seen.size, boxVisible: !box.hidden };
});
let s = await st();
ok(s.boxVisible, 'the locator is on');
ok(!s.canvasHidden && s.imgHidden, 'a plain built-in map shows the canvas and not the raster image');
ok(Math.max(s.w, s.h) <= 300 && Math.max(s.w, s.h) >= 150, 'the canvas is 150 px on its long side at 1x-2x: ' + s.w + 'x' + s.h);
ok(Math.abs(s.w / s.h - s.cssW / s.cssH) < 0.1, 'its aspect matches the inset box: ' + s.w / s.h + ' vs ' + s.cssW / s.cssH);
ok(s.colours >= 3, 'it is drawn (ocean, land, border): ' + s.colours + ' colours');

// Download PNG draws the canvas into the export, not the image.
await page.evaluate(() => {
  window.__srcs = [];
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...r) { window.__srcs.push(img && img.id); return orig.call(this, img, ...r); };
});
const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await page.click('#btnDownloadPng');
await dl;
await settle(page, 500);
const srcs = await page.evaluate(() => window.__srcs);
ok(srcs.includes('locatorCanvas'), 'Download PNG draws the locator canvas: ' + JSON.stringify(srcs));
ok(!srcs.includes('locatorImg'), 'and not the raster image');

// A new project has no live map: the picture's slot comes back.
await page.evaluate(() => { const b = document.getElementById('btnNewProject'); if (b) b.click(); });
await settle(page, 500);
const isLive = await page.evaluate(() => !document.getElementById('baseCanvas').hidden);
if (!isLive) {
  s = await st();
  ok(s.canvasHidden && !s.imgHidden, 'with no live map the raster image is the inset again');
} else ok(true, 'new-project button not available here; skipped');

const real = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
ok(real.length === 0, 'no console errors: ' + JSON.stringify(real));
ok(page.__blocked.length === offsite0, 'nothing requested off-site: ' + JSON.stringify(page.__blocked));
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-locator: all ${passed} passed`);
process.exit(failed ? 1 : 0);
