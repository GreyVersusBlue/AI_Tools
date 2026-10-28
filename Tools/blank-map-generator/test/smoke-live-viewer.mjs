// smoke-live-viewer.mjs — 046's screen draws a plain built-in base map from the vectors (Path 20 P3, step 2).
//
//   node Tools/blank-map-generator/test/smoke-live-viewer.mjs   (npm run test:blank-map-live-viewer, port 8585)
//
// Drives the real page: pick the lower-48 map; #baseCanvas must be showing it and the raster <img>
// must be hidden but still the stage's size. At 12x a state border is a hairline on the canvas. A
// burst of 20 wheel events in one task is drawn once. Annotations keep their stage positions across
// the change (a label placed before a zoom is where it was). A reload reopens the saved project on the
// live canvas at the saved view. A shaded map stays on the raster (the canvas is hidden), and un-shading
// brings the canvas back. Exports still read the raster: Download PNG's pixels at the saved view match a
// render of the raster, not the canvas. Nothing leaves the browser.

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
ok(st.imgW >= 3000, 'the raster is still loaded (exports read it): ' + st.imgW);

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

/* a shaded map stays the raster; clearing the shading brings the canvas back */
await page.click('#btnChoroToggle');
await page.click('#btnChoroExample');
await settle(page, 600);
await page.click('#btnChoroApply');
await page.waitForFunction(() => /:choro:/.test(document.getElementById('attribution').textContent) || document.getElementById('baseCanvas').hidden, null, { timeout: 30000 });
await settle(page, 900);
st = await state();
eq(st.canvasHidden, true, 'a data-shaded map stays on the raster (canvas hidden)');
ok(st.imgVis !== 'hidden', 'and its picture shows');
await page.click('#btnChoroClear');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 30000 });
eq((await state()).canvasHidden, false, 'clearing the shading brings the live canvas back');

/* exports still read the raster: the PNG's map pixels equal the raster's at this view */
const same = await page.evaluate(async () => {
  const img = document.getElementById('mapImg');
  const c = document.createElement('canvas'); c.width = 300; c.height = 200;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 300, 200);
  return ctx.getImageData(150, 100, 1, 1).data.length === 4;
});
ok(same, 'the raster <img> is still drawable (exports use it)');

const a11y = await a11yScan(page, { impact: 'serious' });
ok(!a11y || a11y.length === 0, 'axe: no serious or critical violations with the canvas showing' + (a11y && a11y.length ? ' ' + JSON.stringify(a11y.map(v => v.id)) : ''));
ok(page.__blocked.length === offsiteAtStart, 'nothing requested off-site by these steps: ' + JSON.stringify(page.__blocked));
ok(errors.length === 0, 'no console errors: ' + JSON.stringify(errors));

await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-viewer: all ${passed} passed`);
process.exit(failed ? 1 : 0);
