// smoke-live-viewer.mjs — 046's screen draws a plain built-in base map from the vectors (Path 20 P3, step 2).
//
//   node Tools/blank-map-generator/test/smoke-live-viewer.mjs   (npm run test:blank-map-live-viewer, port 8585)
//
// Drives the real page: pick the lower-48 map; #baseCanvas must be showing it and the raster <img>
// must be hidden but still the stage's size. At 12x a state border is a hairline on the canvas. A
// burst of 20 wheel events in one task is drawn once. Annotations keep their stage positions across
// the change (a label placed before a zoom is where it was). A reload reopens the saved project on the
// live canvas at the saved view. A data-shaded map is drawn live too (band colours on the canvas, again after a reload),
// and un-shading leaves the plain map. Download PNG does not depend on the canvas element being shown (exports draw from the vectors:
// smoke-live-export). Nothing leaves the browser.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8585;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Blank Map — the live base on screen');
const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 700);
// An empty project opens on a default Wikimedia search (existing behaviour, blocked by the harness and
// the open question of Path 20 P5); this suite counts only what its own steps add.
const offsiteAtStart = page.__blocked.length;
errors.length = 0;
await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 300);

const state = () => page.evaluate(() => {
  const c = document.getElementById('baseCanvas'), img = document.getElementById('mapImg');
  return { canvasHidden: c.hidden, imgVis: getComputedStyle(img).visibility, imgW: img.naturalWidth, imgH: img.naturalHeight, readout: document.getElementById('zoomReadout').textContent };
});
let st = await state();
eq(st.canvasHidden, false, 'the live canvas is showing');
eq(st.imgVis, 'hidden', 'the raster picture is hidden behind it');
ok(st.imgW === 0, 'no raster is loaded for a built-in map since v432 (the stage takes its size from the record): ' + st.imgW);

const inkRuns = () => page.evaluate(() => {
  const c = document.getElementById('baseCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height, dark = (x, y) => { const i = (y * W + x) * 4; return d[i] < 120 && d[i + 1] < 120; };
  // thickness of a stroke at a dark pixel: the shorter of the horizontal and vertical runs through it
  const hr = new Uint16Array(W * H), vr = new Uint16Array(W * H);
  let ink = 0;
  for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!dark(x, y)) { x++; continue; } let e = x; while (e < W && dark(e, y)) e++; for (let k = x; k < e; k++) hr[y * W + k] = e - x; x = e; } }
  for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!dark(x, y)) { y++; continue; } let e = y; while (e < H && dark(x, e)) e++; for (let k = y; k < e; k++) vr[k * W + x] = e - y; y = e; } }
  let maxRun = 0;
  for (let i = 0; i < W * H; i++) if (hr[i]) { ink++; const t = Math.min(hr[i], vr[i]); if (t > maxRun) maxRun = t; }
  return { maxRun, ink };
});
const fit = await inkRuns();
ok(fit.ink > 500, 'the canvas has drawn outline ink at fit: ' + fit.ink);

/* a label placed before zooming keeps its stage position */
const before = await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x)); const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find(q => q.id === w.activeId); return { mapId: (p.data || p).mapId, view: (p.data || p).view }; });
ok(/^vector:usa-48:/.test(before.mapId), 'the project holds a vector id: ' + before.mapId);

/* a wheel burst is one draw */
await page.evaluate(() => { window.__strokes = 0; const o = CanvasRenderingContext2D.prototype.stroke; CanvasRenderingContext2D.prototype.stroke = function (...a) { if (this.canvas && this.canvas.id === 'baseCanvas') window.__strokes++; return o.apply(this, a); }; });
await page.evaluate(() => { const v = document.getElementById('viewport'), r = v.getBoundingClientRect(); for (let i = 0; i < 20; i++) v.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: r.left + r.width * 0.4, clientY: r.top + r.height * 0.5, bubbles: true, cancelable: true })); });
await settle(page, 400);
const strokes = await page.evaluate(() => window.__strokes);
ok(strokes >= 1 && strokes <= 2, 'a burst of 20 wheel events was drawn ' + strokes + ' time(s)');
st = await state();
ok(parseInt(st.readout, 10) > 90, 'zoomed in: ' + st.readout);

/* 12x: drive the viewer to the Oklahoma panhandle's east edge and look at the border */
const hi = await page.evaluate(async () => {
  const V = await import('/Tools/blank-map-generator/bmg-vector.js');
  const p = V.findPreset('usa-48'), s = V.pixelSizeFor(p.bounds);
  const pt = V.projectPoint(p.bounds, s.width, s.height, -100, 35.5);
  const v = document.getElementById('viewport'), r = v.getBoundingClientRect();
  return { cx: pt.x, cy: pt.y, w: r.width, h: r.height };
});
await page.evaluate(({ cx, cy, w, h }) => {
  // scale the page's viewer by posting wheel events until 12x, then pan with the same events' anchor
  const v = document.getElementById('viewport'), r = v.getBoundingClientRect();
  for (let i = 0; i < 40; i++) v.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: r.left + w / 2, clientY: r.top + h / 2, bubbles: true, cancelable: true }));
}, hi);
await settle(page, 400);
st = await state();
ok(parseInt(st.readout, 10) >= 1100, 'at the 12x ceiling: ' + st.readout);
const zoomed = await inkRuns();
ok(zoomed.maxRun <= 4, 'a border on the live canvas at 12x is a hairline (thickest stroke ' + zoomed.maxRun + ' px)');

/* reload: the saved project reopens live at its saved view */
const viewBefore = await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x)); const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find(q => q.id === w.activeId); return (p.data || p).view; });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 400);
const viewAfter = await page.evaluate(() => { const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x)); const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find(q => q.id === w.activeId); return (p.data || p).view; });
ok(viewBefore && viewAfter && Math.abs(viewBefore.scale - viewAfter.scale) < 1e-6 && Math.abs(viewBefore.x - viewAfter.x) < 1e-3, 'the saved view is the view after a reload');
eq((await state()).imgVis, 'hidden', 'after the reload the picture is behind the canvas');

/* a data-shaded map is drawn live too: the canvas shows, carries the band colours, and survives a reload; clearing brings the plain map back */
await page.click('#btnChoroToggle');
await page.click('#btnChoroExample');
await settle(page, 600);
await page.click('#btnChoroApply');
await page.waitForFunction(() => /:choro:/.test(JSON.stringify(Object.keys(localStorage).map(k => localStorage.getItem(k).slice(0, 4000)))), null, { timeout: 30000 });
await settle(page, 1200);
st = await state();
eq(st.canvasHidden, false, 'a data-shaded map is drawn on the live canvas');
eq(st.imgVis, 'hidden', 'and its raster picture stays behind it');
const tint = () => page.evaluate(() => {
  const c = document.getElementById('baseCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 7) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (Math.max(r, g, b) - Math.min(r, g, b) > 40) seen.add((r >> 5) + ',' + (g >> 5) + ',' + (b >> 5)); }
  return seen.size;
});
ok((await tint()) >= 3, 'the canvas carries band colours: ' + await tint() + ' tints');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 30000 });
await settle(page, 600);
eq((await state()).canvasHidden, false, 'after a reload the shaded map is drawn live again');
ok((await tint()) >= 3, 'with its band colours after the reload');
if (await page.locator('#btnChoroClear').isHidden()) await page.click('#btnChoroToggle');
await page.click('#btnChoroClear');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 30000 });
await settle(page, 600);
eq((await state()).canvasHidden, false, 'clearing the shading leaves the live canvas');
eq(await tint(), 0, 'and the plain map has no band colours');

/* an export draws from the vectors, not from the canvas element: hiding the element changes nothing in the file (smoke-live-export holds what it does draw) */
const png = async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#btnDownloadPng')]);
  const fs = await import('node:fs');
  const f = await dl.path();
  const buf = fs.readFileSync(f);
  return buf.toString('base64');
};
const liveOn = await png();
await page.evaluate(() => { document.getElementById('baseCanvas').hidden = true; document.getElementById('mapImg').style.visibility = ''; });
const liveOff = await png();
ok(liveOn.length > 1000 && liveOn === liveOff, 'Download PNG is byte-identical with the canvas element shown or not (' + liveOn.length + ' base64 chars)');

const a11y = await a11yScan(page, { impact: 'serious' });
ok(!a11y || a11y.length === 0, 'axe: no serious or critical violations with the canvas showing' + (a11y && a11y.length ? ' ' + JSON.stringify(a11y.map(v => v.id)) : ''));
ok(page.__blocked.length === offsiteAtStart, 'nothing requested off-site by these steps: ' + JSON.stringify(page.__blocked));
ok(errors.length === 0, 'no console errors: ' + JSON.stringify(errors));

await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-viewer: all ${passed} passed`);
process.exit(failed ? 1 : 0);
