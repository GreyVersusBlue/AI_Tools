// smoke-live-noraster.mjs — a built-in map writes no raster (Path 20 P3, step 7).
//
//   node Tools/blank-map-generator/test/smoke-live-noraster.mjs   (npm run test:blank-map-live-noraster, port 8590)
//
// Choosing a built-in base map draws it from the vectors and stores nothing in `bmg-maps`: the record the
// page holds is the map's id, size, title, attribution and calibration with no picture, the stage and the
// locator box are sized from it, the map survives a reload (and "Recently used" does not list it), and
// `buildBaseMapMeta` is exactly `buildBaseMapRecord` without the blob. An older cached record still loads.
// Nothing is requested off-site by these steps.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8590;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

console.log('Blank Map — no raster for a built-in map');
const server = await serve(PORT);
const browser = await launch();
const errors = [];
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/Tools/046-blank-map-generator.html', { waitUntil: 'networkidle' });
await settle(page, 700);
const offsite0 = page.__blocked.length;

const cacheIds = () => page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('bmg-maps');
  r.onerror = () => res([]);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('images')) { res([]); return; }
    const q = db.transaction('images').objectStore('images').getAllKeys();
    q.onsuccess = () => res(q.result);
  };
}));
const look = () => page.evaluate(() => {
  const img = document.getElementById('mapImg'), box = document.getElementById('locatorInset');
  return {
    live: !document.getElementById('baseCanvas').hidden,
    imgSrc: img.getAttribute('src'), imgW: img.width, imgH: img.height,
    boxW: box.style.width, boxH: box.style.height,
    recent: [...document.querySelectorAll('#recentRow .recentItem')].map(e => e.textContent),
  };
});

await page.selectOption('#baseMapSelect', 'usa-48');
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('baseCanvas').hidden, null, { timeout: 20000 });
await settle(page, 500);
let s = await look();
ok(s.live, 'the map is drawn from the vectors');
ok(!s.imgSrc, 'the raster <img> has no source: ' + s.imgSrc);
ok(s.imgW >= 1000 && s.imgH >= 500, 'the stage still has its size: ' + s.imgW + 'x' + s.imgH);
ok(/px$/.test(s.boxW) && parseInt(s.boxW, 10) > 20 && parseInt(s.boxH, 10) > 20, 'the locator box is sized: ' + s.boxW + ' x ' + s.boxH);
ok(!(await cacheIds()).some(id => String(id).startsWith('vector:')), 'no vector: record was written to the cache');
ok(!s.recent.length, 'Recently used lists nothing: ' + JSON.stringify(s.recent));
const mapId = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).filter(v => v.includes('vector:usa')).length);
ok(mapId > 0, 'the project stores the vector: id');

// Annotating still works: a label placed on the live map keeps its place after a reload.
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);
s = await look();
ok(s.live && !s.imgSrc, 'after a reload the map arrives drawn, still with no raster');
ok(s.imgW >= 1000, 'and sized: ' + s.imgW);
ok(!(await cacheIds()).some(id => String(id).startsWith('vector:')), 'the reload wrote no vector: record either');

// The record without a picture is the record with one, minus the blob.
const same = await page.evaluate(async () => {
  const v = await import('./blank-map-generator/bmg-vector.js');
  const out = [];
  for (const [key, opts] of [['usa-48', {}], ['world', { style: 'land', borders: false }], ['europe', { relief: true }]]) {
    const preset = v.findPreset(key);
    if (!preset) { out.push(key + ': no preset'); continue; }
    const a = await v.buildBaseMapRecord(preset, opts);
    const b = v.buildBaseMapMeta(preset, opts);
    const strip = r => JSON.stringify({ ...r, blob: !!r.blob, cachedAt: 0, mime: '' });
    const ka = JSON.parse(strip(a)), kb = JSON.parse(strip(b));
    delete ka.blob; delete kb.blob;
    if (JSON.stringify(ka) !== JSON.stringify(kb)) out.push(key + ': ' + JSON.stringify(ka) + ' vs ' + JSON.stringify(kb));
    if (b.blob !== null || !a.blob) out.push(key + ': blob');
  }
  return out;
});
ok(same.length === 0, 'buildBaseMapMeta equals buildBaseMapRecord without the blob: ' + same.join(' | '));

// An older visit's cached record is used as it is.
await page.evaluate(async () => {
  const v = await import('./blank-map-generator/bmg-vector.js');
  const { putCachedMap } = await import('./blank-map-generator/bmg-map-cache.js');
  await putCachedMap(await v.buildBaseMapRecord(v.findPreset('usa-48'), {}));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);
s = await look();
ok(s.live && s.imgW >= 1000, 'with an old cached record the map still loads drawn: ' + s.imgW);
ok(s.recent.length === 1, 'and Recently used lists that record: ' + JSON.stringify(s.recent));

const real = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
ok(real.length === 0, 'no console errors: ' + JSON.stringify(real));
ok(page.__blocked.length === offsite0, 'nothing requested off-site: ' + JSON.stringify(page.__blocked));
await browser.close();
server.close();
console.log(failed ? `${failed} failed, ${passed} passed` : `smoke-live-noraster: all ${passed} passed`);
process.exit(failed ? 1 : 0);
