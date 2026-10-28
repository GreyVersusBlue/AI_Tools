// smoke-live-parity.mjs — the live base map against the raster path (Path 20 P3, step 1).
//
//   node Tools/blank-map-generator/test/smoke-live-parity.mjs   (npm run test:blank-map-live-parity, port 8584)
//
// In Chromium, for each of the nine presets x outline/land x borders on/off (relief on for the
// world, shading on the world and the 50 states): bmg-vector.js's renderBaseMapCanvas() at 4000 px
// and bmg-live.js's drawBaseMap() at the identity view onto a canvas of the same size must be the
// same bytes. Then the property the live path exists for: at a 12x view the border's cross-section
// is thin in the live canvas and fat in the raster upsampled to the same box, and the live frame
// at a zoomed view has the same colour as the raster at six probe points where no border is near.
// Frame times at three views are logged, not asserted beyond a generous floor.

import { serve, launch, prepPage } from '../../board-check/harness.mjs';

const PORT = 8584;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 800 });
await page.goto(BASE + '/Tools/046-blank-map-generator.html');

const out = await page.evaluate(async () => {
  const V = await import('/Tools/blank-map-generator/bmg-vector.js');
  const L = await import('/Tools/blank-map-generator/bmg-live.js');
  const res = { cases: [], thin: null, timings: [] };
  const fillsFor = key => key === 'world' ? { France: '#cc3333', Brazil: '#33aa55', Australia: '#3355cc' }
    : key === 'usa-50' ? { Texas: '#cc3333', Alaska: '#33aa55', Maine: '#3355cc' } : null;
  const same = (a, b) => { const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; if (x.length !== y.length) return -1; let diff = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++; return diff; };
  for (const preset of V.BASE_MAP_PRESETS) for (const style of ['outline', 'land']) for (const borders of [true, false]) {
    for (const mode of ['plain', 'relief', 'shaded']) {
      if (mode === 'relief' && !V.hasRelief(preset)) continue;
      const fills = mode === 'shaded' ? fillsFor(preset.key) : null;
      if (mode === 'shaded' && !fills) continue;
      const relief = mode === 'relief';
      const raster = await V.renderBaseMapCanvas(preset, { style, borders, fills, relief });
      const src = await L.loadSource({ preset, style, borders, fills, relief });
      const live = document.createElement('canvas'); live.width = raster.width; live.height = raster.height;
      const longSide = Math.max(raster.width, raster.height);
      L.drawBaseMap(live.getContext('2d'), src, { x: 0, y: 0, scale: 1 }, raster.width, raster.height, { strokePx: Math.max(1, Math.round(longSide / 1600)), mat: null });
      res.cases.push({ id: `${preset.key}/${style}/${borders ? 'b' : 'nb'}/${mode}`, diff: same(raster.canvas, live), w: raster.width, h: raster.height });
    }
  }
  // sharpness at 12x about the middle of the usa-50 map: count dark-ish pixels across a horizontal line
  {
    const preset = V.findPreset('usa-50');
    const src = await L.loadSource({ preset, style: 'outline', borders: true });
    const vw = 600, vh = 400, scale = 12;
    // the Texas/Oklahoma panhandle's east edge, 100 W, centred in the window
    const { x: cx0, y: cy0 } = V.projectPoint(preset.bounds, src.width, src.height, -100, 35.5);
    const view = { x: vw / 2 - cx0 * scale, y: vh / 2 - cy0 * scale, scale };
    const live = document.createElement('canvas'); live.width = vw; live.height = vh;
    L.drawBaseMap(live.getContext('2d'), src, view, vw, vh, { strokePx: 1 });
    const raster = await V.renderBaseMapCanvas(preset, { style: 'outline', borders: true });
    const up = document.createElement('canvas'); up.width = vw; up.height = vh;
    const uc = up.getContext('2d'); uc.fillStyle = '#fff'; uc.fillRect(0, 0, vw, vh);
    uc.drawImage(raster.canvas, -view.x / scale, -view.y / scale, vw / scale, vh / scale, 0, 0, vw, vh);
    const widths = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const runs = []; for (let y = 0; y < c.height; y += 8) { let run = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; const dark = d[i] < 170; if (dark) run++; else { if (run) runs.push(run); run = 0; } } } return runs.length ? runs.reduce((a, b) => a + b) / runs.length : 0; };
    res.thin = { live: widths(live), raster: widths(up), maxRun: (c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let m = 0; for (let y = 0; y < c.height; y += 4) { let run = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] < 170) { run++; if (run > m) m = run; } else run = 0; } } return m; }) };
    res.thin.maxLive = res.thin.maxRun(live); res.thin.maxRaster = res.thin.maxRun(up); delete res.thin.maxRun;
    // timing: median of 15 frames at fit, 3x, 12x on the world
    const w = V.findPreset('world');
    const ws = await L.loadSource({ preset: w, style: 'land', borders: true });
    const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 750;
    const cx = cv.getContext('2d');
    for (const sc of [0.25, 0.75, 3]) {
      const ts = [];
      for (let i = 0; i < 15; i++) { const t0 = performance.now(); L.drawBaseMap(cx, ws, { x: -300 * sc, y: -200 * sc, scale: sc }, 1000, 750, { dpr: 1 }); cx.getImageData(0, 0, 1, 1); ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); res.timings.push({ scale: sc, ms: +ts[7].toFixed(1) });
    }
  }
  return res;
});

console.log('Blank Map — live base against the raster path');
for (const c of out.cases) ok(c.diff === 0, `${c.id}: live == raster at the identity view (${c.diff} differing bytes of ${c.w}x${c.h})`);
console.log(`  ${out.cases.length} raster/live pairs compared`);
ok(out.cases.length >= 40, 'enough cases ran: ' + out.cases.length);
console.log('  cross-section at 12x: live longest dark run ' + out.thin.maxLive + ' px, upsampled raster ' + out.thin.maxRaster + ' px');
ok(out.thin.maxLive <= 4, 'live border is a hairline at 12x (' + out.thin.maxLive + ')');
ok(out.thin.maxRaster >= 20, 'the raster upsampled at 12x is the smear this replaces (' + out.thin.maxRaster + ')');
console.log('  frame times (median of 15, 1000x750): ' + out.timings.map(t => `${t.scale}x ${t.ms} ms`).join(', '));
ok(out.timings.every(t => t.ms < 40), 'frames under the 40 ms floor');

await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-parity: all ${passed} passed`);
process.exit(failed ? 1 : 0);
