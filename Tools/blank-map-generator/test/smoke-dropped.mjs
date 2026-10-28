// smoke-dropped.mjs — 046 with a boundary file of the teacher's own as the base map (Path 20 P2).
//
//   node Tools/blank-map-generator/test/smoke-dropped.mjs      (npm run test:blank-map-dropped-smoke, port 8583)
//
// Drives the real page: choose a GeoJSON file, then drop a TopoJSON on the base-map strip.
// Each must become a "Your files" entry and a calibrated map (the calibration is the bounds
// bmg-dropped.js computes, checked here against its own answer), click-to-shade must find the
// shape under a real click, the file must survive "Clear cached maps" (it lives in gvb-media,
// not the cache) and a reload, and the project must still shade after the reload. Bad files
// each say what is wrong and leave the map on screen alone. Nothing leaves the browser.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { parseBoundaryFile } from '../bmg-dropped.js';

const PORT = 8583;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Blank Map Generator — your own boundary file');

const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const district = (name, ring) => ({ type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [ring] } });
const districts = JSON.stringify({ type: 'FeatureCollection', features: [
  district('Eastside', sq(-97, 37, 1, 2)), district('Midtown', sq(-98, 37, 1, 2)), district('Westgate', sq(-99, 37, 1, 2)),
] });
const topology = JSON.stringify({ type: 'Topology', transform: { scale: [1, 1], translate: [10, 40] }, arcs: [[[0, 0], [2, 0], [0, 2], [-2, 0], [0, -2]]],
  objects: { parcels: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: { name: 'Parcel One' }, arcs: [[0]] }] } } });
const projected = JSON.stringify({ type: 'FeatureCollection', features: [district('Utm', [[500000, 4000000], [500100, 4000000], [500100, 4000100], [500000, 4000000]])] });

const want = parseBoundaryFile(districts, 'Kansas districts.geojson');
ok(want.ok, 'the fixture parses in Node');

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1000 });

const activeData = () => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => /bmg_workspace/.test(x));
  if (!k) return null;
  const w = JSON.parse(localStorage.getItem(k));
  const p = w.projects.find(q => q.id === w.activeId);
  return p ? (p.data || p) : null;
});
const status = () => page.evaluate(() => { const b = document.getElementById('searchStatus'); return b.hidden ? '' : b.textContent; });
const idbKeys = (dbName, storeName) => page.evaluate(({ dbName, storeName }) => new Promise(resolve => {
  const req = indexedDB.open(dbName);
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
    const g = db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys();
    g.onsuccess = () => { db.close(); resolve(g.result.map(String)); };
    g.onerror = () => { db.close(); resolve(null); };
  };
}), { dbName, storeName });
const showViewer = async () => { await page.evaluate(() => document.getElementById('viewport').scrollIntoView({ block: 'center' })); await settle(page, 250); };
const setFile = (name, text, mime = 'application/json') => page.setInputFiles('#baseMapFile', { name, mimeType: mime, buffer: Buffer.from(text) });
const shaded = async () => ((await activeData()).regions || []).filter(r => r.name).map(r => r.name).sort();

async function clickLatLon(lat, lon, b) {
  await showViewer();
  const pt = await page.evaluate(({ lat, lon, b }) => {
    const r = document.getElementById('mapImg').getBoundingClientRect();
    return { x: r.left + ((lon - b.west) / (b.east - b.west)) * r.width, y: r.top + ((b.north - lat) / (b.north - b.south)) * r.height };
  }, { lat, lon, b });
  await page.mouse.click(pt.x, pt.y);
  await settle(page, 200);
}

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);
const offsiteBefore = page.__blocked.length;

/* ── nothing about a dropped file is read or listed at load ────────────── */
eq(await page.locator('#baseMapSelect optgroup[data-yours]').count(), 0, 'no "Your files" group exists until there is a file');
eq(await page.isVisible('#btnBaseMapFile'), true, 'the Your own file… button is on the base map strip');

/* ── choose a GeoJSON file ─────────────────────────────────────────────── */
await setFile('Kansas districts.geojson', districts);
await page.waitForFunction(() => !document.getElementById('mapImg').hidden && document.getElementById('mapImg').naturalWidth > 0, null, { timeout: 15000 });
await settle(page, 600);
let d = await activeData();
ok(/^vector:custom-[0-9a-f]{16}:/.test(d.mapId || ''), 'the project\'s map id names the dropped file: ' + d.mapId);
ok(d.mapId.includes(want.key), 'and it is the key bmg-dropped.js gives that file');
const cal = d.calibration || {};
ok(['north', 'south', 'west', 'east'].every(k => Math.abs(cal[k] - want.bounds[k]) < 1e-9), 'the calibration is the data box plus 4%: ' + JSON.stringify(cal));
eq(await page.locator('#baseMapSelect optgroup[data-yours] option').allTextContents().then(a => a.join()), 'Kansas districts', 'the file is in the list under Your files, by its name');
eq(await page.inputValue('#baseMapSelect'), want.key, 'and it is the selected base map');
const px = await page.evaluate(() => { const i = document.getElementById('mapImg'); return [i.naturalWidth, i.naturalHeight]; });
ok(px[0] === 4000 && px[1] > 1000 && px[1] < 4000, 'the picture is the 4000 px long side, in the data\'s own proportions: ' + px.join('x'));
eq(await page.isDisabled('#btnShadeClick'), false, 'click-to-shade is available on it');
ok(/Kansas districts|3 shapes/.test(await page.textContent('#baseMapHint')), 'the hint says it is the teacher\'s file: ' + await page.textContent('#baseMapHint'));
ok(!/Natural Earth/.test(await page.textContent('#attribution')), 'it does not credit Natural Earth: ' + await page.textContent('#attribution'));

/* ── a real click finds the shape under it ─────────────────────────────── */
await page.click('#btnShadeClick');
await settle(page, 1000);
await clickLatLon(38, -97.5, want.bounds);   // Midtown
eq((await shaded()).join(), 'Midtown', 'clicking the middle shape shades Midtown');
await clickLatLon(38, -96.5, want.bounds);   // Eastside
eq((await shaded()).join(), 'Eastside,Midtown', 'and the right-hand shape joins it');
await clickLatLon(36, -97.5, want.bounds);   // below the data
eq((await shaded()).join(), 'Eastside,Midtown', 'a click outside every shape shades nothing');
await page.click('#btnShadeClick');
await settle(page, 200);

/* ── it is stored where "Clear cached maps" cannot reach, and survives a reload ── */
ok((await idbKeys('gvb-media', 'blobs')).includes('bmg-geo/' + want.key), 'the clean file is in gvb-media under bmg-geo');
ok((await idbKeys('bmg-maps', 'images')).some(k => k.includes(want.key)), 'the rendered picture is in the bmg-maps cache');
page.once('dialog', dlg => dlg.accept());
await page.click('#btnClearCache');
await settle(page, 600);
eq((await idbKeys('bmg-maps', 'images')).length, 0, 'Clear cached maps empties the picture cache');
ok((await idbKeys('gvb-media', 'blobs')).includes('bmg-geo/' + want.key), 'and leaves the dropped file where it was');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);
eq(await page.isVisible('#emptyMapState').catch(() => true) || await page.evaluate(() => document.getElementById('mapImg').hidden), true, 'with the picture cache cleared the project has no picture yet');
await page.focus('#baseMapSelect');
await settle(page, 400);
eq(await page.locator('#baseMapSelect optgroup[data-yours] option').allTextContents().then(a => a.join()), 'Kansas districts', 'the stored file is listed once the list is opened');
await page.selectOption('#baseMapSelect', want.key);
await page.click('#btnBaseMap');
await page.waitForFunction(() => !document.getElementById('mapImg').hidden && document.getElementById('mapImg').naturalWidth > 0, null, { timeout: 15000 });
await settle(page, 600);
d = await activeData();
ok(['north', 'south', 'west', 'east'].every(k => Math.abs((d.calibration || {})[k] - want.bounds[k]) < 1e-9), 'drawn again from the stored file with the same calibration');
eq((await shaded()).join(), 'Eastside,Midtown', 'and the labels and shading the project already had are still where they were');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 1200);
eq(await page.isDisabled('#btnShadeClick'), false, 'after a plain reload the shapes are back for click-to-shade (restored from the stored file)');

/* ── drop a TopoJSON on the strip ──────────────────────────────────────── */
await page.evaluate(text => {
  const dt = new DataTransfer();
  dt.items.add(new File([text], 'parcels.topojson', { type: 'application/json' }));
  document.querySelector('.baseMapStrip').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}, topology);
await page.waitForFunction(() => /parcels/.test(document.getElementById('baseMapSelect').selectedOptions[0].textContent), null, { timeout: 15000 });
await settle(page, 800);
d = await activeData();
const wantTopo = parseBoundaryFile(topology, 'parcels.topojson');
ok(wantTopo.ok && d.mapId.includes(wantTopo.key), 'a dropped TopoJSON becomes the map: ' + d.mapId);
eq(await page.locator('#baseMapSelect optgroup[data-yours] option').count(), 2, 'and joins the first in the list');

/* ── bad files each say what is wrong, and change nothing ──────────────── */
const before = (await activeData()).mapId;
await setFile('utm.geojson', projected);
await settle(page, 400);
ok(/WGS 84/.test(await status()) && /not longitude and latitude/.test(await status()), 'projected coordinates: ' + await status());
await setFile('boundaries.shp', 'x', 'application/octet-stream');
await settle(page, 300);
ok(/\.shp/.test(await status()), 'a shapefile: ' + await status());
await setFile('notes.json', 'this is not json');
await settle(page, 300);
ok(/valid JSON/.test(await status()), 'not JSON: ' + await status());
eq((await activeData()).mapId, before, 'none of the three changed the map on screen');

/* ── nothing left the browser, nothing broke ───────────────────────────── */
eq(page.__blocked.length, offsiteBefore, 'no offsite request at all: ' + JSON.stringify(page.__blocked.slice(offsiteBefore, offsiteBefore + 4)));
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
