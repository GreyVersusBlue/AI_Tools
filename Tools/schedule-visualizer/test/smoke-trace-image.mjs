// smoke-trace-image.mjs — the School Layout Visualizer's floor-plan trace
// images, in IndexedDB.
//
//   node Tools/schedule-visualizer/test/smoke-trace-image.mjs
//
// Path 4 P4's last increment moved each floor's "Trace over a real floor plan"
// underlay out of `stviz_blueprint` (and out of every snapshot slot) and into
// the shared media store (_shared/media-db.js, `gvb-media`, namespace
// `stviz-trace`). `floor.traceImage.dataUrl` now holds `idb:<id>`. What a
// teacher could lose in that move is asserted here, in a real browser with a
// real IndexedDB:
//
//   1. A blueprint and a snapshot saved BEFORE the move (inline JPEGs on two
//      floors) are migrated on load: the keys lose the bytes, the store gains
//      one record per distinct picture, and the canvas draws the same image.
//   2. A reload reads the pictures back and draws them, storing nothing twice.
//   3. Everything that leaves the browser or must stand alone carries the
//      bytes, never a reference: the blueprint export, the full-project export
//      (and so the handoff, which sends the same object) and a recovery point.
//      A snapshot taken now holds a reference.
//   4. A file picked in the modal goes straight to the store at 1600 px JPEG
//      0.85; a transparent PNG comes out white, not black.
//   5. An imported blueprint file with an inline image is moved into the store.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period, or still pointed at only by a snapshot slot, is not.
//   7. A reference whose image is gone draws nothing, is said so in the modal
//      (axe-clean), and is left out of an export rather than written into it.
//   8. With no IndexedDB at all, a new image is kept the old way, inline.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

/* global serializeFullProject, saveSnapshot, restoreSnapshot -- page globals read inside page.evaluate() */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8457;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
const KEY = 'stviz_blueprint';
const NS = 'stviz-trace';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const isRef = v => typeof v === 'string' && /^idb:[A-Za-z0-9_-]+$/.test(v);

const floor = (id, label, image) => ({
  id, label, gridCols: 20, gridRows: 12, cells: [], heatExcludeZones: [],
  traceImage: image ? { dataUrl: image, opacity: 0.5, scale: 1, offsetX: 0, offsetY: 0 } : null,
});
const blueprint = (img0, img1) => ({
  version: 5, savedAt: '2026-09-01T12:00:00.000Z', gridCols: 20, gridRows: 12, cells: [],
  staircasePairs: [], heatExcludeZones: [],
  floors: [floor('floor_0', 'Floor 1', img0), floor('floor_1', 'Floor 2', img1)],
  activeFloorIdx: 0, crossFloorPairs: [],
  settings: { schoolName: 'Larkspur Middle', gridSize: 24, gridCols: 20, gridRows: 12 },
});
const project = bp => ({
  fileType: 'stviz-project', version: 1, schemaVersion: 31, savedAt: '2026-09-01T12:00:00.000Z',
  settings: {}, blueprint: bp, groups: [], whatif: null,
});

const server = await serve(PORT);
const browser = await launch();

async function newPage({ noIdb = false } = {}) {
  const p = await prepPage(browser, BASE, { width: 1400, height: 900 });
  p.on('dialog', d => d.accept());
  await p.context().addInitScript(([noIdb]) => {
    try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* storage blocked */ }
    if (noIdb) Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
  }, [noIdb]);
  return p;
}
const page = await newPage();

const load = async (p = page) => {
  await p.goto(URL_PAGE, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__traceImagesSettled === true, null, { timeout: 10000 });
  await settle(p, 400);
};
const saved = (p = page) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const rawKey = (p, k) => p.evaluate(k => localStorage.getItem(k) || '', k);
const records = (p = page) => p.evaluate(ns => window.MediaDB.store({ ns }).list(), NS);
const values = bp => (bp && bp.floors || []).map(f => f.traceImage && f.traceImage.dataUrl);
/* The colour the editor canvas shows inside the first grid cell, where the
   trace image is the only thing drawn over the background. */
const canvasPixel = (p = page) => p.evaluate(() => {
  const c = document.getElementById('bp-canvas');
  const dpr = window.devicePixelRatio || 1;
  return Array.from(c.getContext('2d').getImageData(Math.round(10 * dpr), Math.round(10 * dpr), 1, 1).data);
});
/* Capture what a download link would have saved. */
const captureDownload = (p, trigger) => p.evaluate(trigger => {
  let text = null;
  const real = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return real.call(URL, blob); };
  if (trigger.startsWith('#')) document.querySelector(trigger).click(); else window[trigger]();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = real; r(text); }, 400));
}, trigger);

console.log('School Layout Visualizer — trace images in the media store');

/* Three solid-colour PNGs, made by the browser, so "the same picture" is checkable. */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);
const [RED, BLUE, GREEN, PURPLE] = await page.evaluate(() => ['#d01010', '#1030d0', '#10a020', '#8020a0'].map(col => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 48;
  const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 64, 48);
  return c.toDataURL('image/png');
}));

/* ── 1. a blueprint and a snapshot from before the move are migrated ───── */
await page.evaluate(([k, bp, snap]) => {
  localStorage.setItem(k, JSON.stringify(bp));
  localStorage.setItem('STVIZ_SNAPSHOT_1', JSON.stringify({ name: 'Before the move', timestamp: '2026-09-01T12:00:00.000Z', data: snap }));
}, [KEY, blueprint(RED, BLUE), project(blueprint(RED, GREEN))]);
await load();

let bp = await saved();
let [v0, v1] = values(bp);
ok(isRef(v0), 'floor 1\'s trace image is now an idb: reference: ' + JSON.stringify(v0).slice(0, 60));
ok(isRef(v1) && v1 !== v0, 'floor 2\'s is a different one: ' + JSON.stringify(v1).slice(0, 60));
eq(bp.floors[0].traceImage.opacity, 0.5, 'the floor\'s opacity, scale and offsets are kept with it');
ok(!(await rawKey(page, KEY)).includes('data:image'), 'the blueprint key no longer carries any image bytes');
const snapRaw = await rawKey(page, 'STVIZ_SNAPSHOT_1');
ok(!snapRaw.includes('data:image'), 'nor does the snapshot slot taken before the move');
const snapVals = values(JSON.parse(snapRaw).data.blueprint);
eq(snapVals[0], v0, 'the same picture in the blueprint and a snapshot is stored once and shared');
ok(isRef(snapVals[1]) && snapVals[1] !== v1, 'and the snapshot\'s other picture has its own record');
let recs = await records();
eq(recs.length, 3, 'the media store holds one record per distinct picture');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'layout-visualizer'), 'each with its type and owner');
eq(await page.evaluate(v => window.SVTraceImage.src(v), v0), RED, 'the reference resolves to exactly the picture it replaced');
let px = await canvasPixel();
ok(px[0] - px[1] > 60 && px[0] - px[2] > 60, 'the canvas draws the red plan under the grid: ' + px);

/* ── 2. a reload reads them back ───────────────────────────────────────── */
await load();
px = await canvasPixel();
ok(px[0] - px[1] > 60, 'after a reload the canvas draws the plan out of IndexedDB: ' + px);
eq((await records()).length, 3, 'and nothing was stored twice');
eq(JSON.stringify(values(await saved())), JSON.stringify([v0, v1]), 'and the saved references did not change');

/* ── 3. what leaves the browser carries bytes; a snapshot carries a reference ── */
let text = await captureDownload(page, '#btn-export-blueprint');
ok(text && !text.includes('idb:'), 'the blueprint export carries no idb: reference');
eq(JSON.stringify(values(JSON.parse(text || '{}'))), JSON.stringify([RED, BLUE]), 'it carries both floors\' pictures byte for byte');
text = await captureDownload(page, 'exportFullProject');
ok(text && !text.includes('idb:') && JSON.parse(text).blueprint.floors[1].traceImage.dataUrl === BLUE,
  'so does the full-project export');
const handoff = await page.evaluate(() => JSON.stringify(serializeFullProject({ portable: true })));
ok(!handoff.includes('idb:') && handoff.includes(RED.slice(0, 80)),
  'and the object the handoff sends (serializeFullProject({ portable: true }), the call host.sendProject makes)');
await page.evaluate(() => window.RecoveryManager.capture('test', true));
const point = await page.evaluate(() => window.SVRecovery.listPointHeaders().then(h => window.SVRecovery.getPoint(h[0].id)));
const pointJson = JSON.stringify(point && point.data);
ok(!pointJson.includes('idb:') && pointJson.includes(BLUE.slice(0, 80)),
  'a recovery point stands alone: it carries the images, not references');
eq(JSON.stringify(values(await saved())), JSON.stringify([v0, v1]), 'none of that rewrote the saved blueprint');
await page.evaluate(() => saveSnapshot('After the move', 2));
const snap2 = await rawKey(page, 'STVIZ_SNAPSHOT_2');
ok(snap2.includes(v0) && !snap2.includes('data:image'), 'a snapshot taken now holds references, not bytes');
console.log(`  (snapshot slot: ${snapRaw.length} chars after migration, ${snap2.length} for a new one)`);

/* ── 4. a picked file goes straight to the store ───────────────────────── */
/* A realistic scan: 2400×1800 of noise, which JPEG compresses worst. */
const scan = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1800;
  const x = c.getContext('2d');
  const d = x.createImageData(2400, 1800);
  let seed = 11;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d.data[i] = seed & 255; d.data[i + 1] = (seed >> 8) & 255; d.data[i + 2] = (seed >> 16) & 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
});
await page.click('#btn-trace-image');
await page.setInputFiles('#trace-image-file', { name: 'larkspur-floor1.png', mimeType: 'image/png', buffer: Buffer.from(scan, 'base64') });
await page.waitForFunction(v => { const b = JSON.parse(localStorage.getItem('stviz_blueprint')); return b.floors[0].traceImage.dataUrl !== v; }, v0, { timeout: 10000 });
bp = await saved();
const vScan = values(bp)[0];
ok(isRef(vScan), 'the picked scan is saved as a reference: ' + JSON.stringify(vScan));
ok(!(await rawKey(page, KEY)).includes('data:image'), 'and the key still carries no image bytes');
recs = await records();
const added = recs.find(r => 'idb:' + r.id === vScan);
ok(added && added.type === 'image/jpeg', 'stored as a JPEG');
const decode = (p, v) => p.evaluate(v => new Promise(r => {
  const i = new Image();
  i.onload = () => {
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    r({ w: i.naturalWidth, h: i.naturalHeight, mid: Array.from(x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data) });
  };
  i.onerror = () => r(null);
  i.src = window.SVTraceImage.src(v);
}), v);
const dScan = await decode(page, vScan);
eq(dScan && `${dScan.w}x${dScan.h}`, '1600x1200', 'at the 1600 px long edge the inline downscaler used');
console.log(`  (a 2400×1800 noise scan stores as ${added && added.size} bytes)`);
ok(added && added.size < 1.5 * 1024 * 1024, 'a worst-case scan stays small enough to hold as a data URL in memory');
eq(await page.isVisible('#trace-image-missing'), false, 'nothing is reported missing');

const clear = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 100;
  const x = c.getContext('2d'); x.strokeStyle = '#000'; x.strokeRect(10, 10, 20, 20);   // lines on a clear background
  return c.toDataURL('image/png').split(',')[1];
});
await page.setInputFiles('#trace-image-file', { name: 'lines.png', mimeType: 'image/png', buffer: Buffer.from(clear, 'base64') });
await page.waitForFunction(v => { const b = JSON.parse(localStorage.getItem('stviz_blueprint')); return b.floors[0].traceImage.dataUrl !== v; }, vScan, { timeout: 10000 });
const dClear = await decode(page, values(await saved())[0]);
ok(dClear && dClear.mid.slice(0, 3).every(c => c > 235), 'a transparent PNG plan comes out white where it was clear, not black: ' + (dClear && dClear.mid));
await page.click('#trace-image-done');

/* ── 5. an imported blueprint file is moved into the store ─────────────── */
await page.setInputFiles('#bp-import-file', {
  name: 'larkspur-blueprint.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(blueprint(PURPLE, null))),
});
/* Wait for the imported blueprint itself, not just "floor 1 holds a reference":
   it already did (the upload above), which raced the import on a slower CI box. */
const before5 = values(await saved())[0];
await page.waitForFunction(prev => {
  const b = JSON.parse(localStorage.getItem('stviz_blueprint'));
  const v = b.floors[0].traceImage && b.floors[0].traceImage.dataUrl;
  return b.floors[1].traceImage === null && /^idb:/.test(v || '') && v !== prev;
}, before5, { timeout: 10000 });
bp = await saved();
const vPurple = values(bp)[0];
ok(isRef(vPurple) && !(await rawKey(page, KEY)).includes('data:image'), 'an imported file\'s inline image is moved into the store');
eq(await page.evaluate(v => window.SVTraceImage.src(v), vPurple), PURPLE, 'and it is the same picture');
eq(bp.floors[1].traceImage, null, 'a floor without one still has none');

/* ── 6. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(([ns, red]) => {
  const st = window.MediaDB.store({ ns });
  const blob = window.MediaDB.dataUrlToBlob(red);
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: ns + '/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
}, [NS, RED]);
/* RED is now pointed at only by snapshot slots 1 and 2. Age its record past
   the grace period so only those references can be what spares it. */
await page.evaluate(([ns, id]) => new Promise((res, rej) => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const s = t.objectStore('blobs');
    const g = s.get(ns + '/' + id);
    g.onsuccess = () => { const r = g.result; r.savedAt = Date.now() - 3600e3; s.put(r); };
    t.oncomplete = () => { req.result.close(); res(); };
    t.onerror = () => rej(t.error);
  };
}), [NS, v0.slice(4)]);
let ids = (await records()).map(r => r.id);
ok(ids.includes('old-orphan') && ids.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load();
ids = (await records()).map(r => r.id);
ok(!ids.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(ids.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(ids.includes(v0.slice(4)), 'an old record that only a snapshot slot points at survives');
ok(ids.includes(vPurple.slice(4)), 'and so does the one the live blueprint points at');
await page.evaluate(() => restoreSnapshot(1));
await page.waitForFunction(v => window.SVTraceImage.src(v) !== '', v0, { timeout: 5000 });
await settle(page, 300);
px = await canvasPixel();
ok(px[0] - px[1] > 60, 'restoring that snapshot draws its picture again: ' + px);

/* ── 7. a reference with nothing behind it says so ─────────────────────── */
await page.evaluate(([k, bp]) => localStorage.setItem(k, JSON.stringify(bp)), [KEY, blueprint('idb:gone123', null)]);
await load();
px = await canvasPixel();
ok(Math.abs(px[0] - px[2]) < 20, 'a dangling reference draws nothing on the canvas: ' + px);
eq(values(await saved())[0], 'idb:gone123', 'and the reference is kept, not silently dropped');
await page.click('#btn-trace-image');
await settle(page, 200);
ok(await page.isVisible('#trace-image-missing'), 'the trace-image dialog says the picture is not in this browser');
/* The dialog's body, not its footer: the footer's Done button is 035's page-wide
   --accent primary button, one of the colour-contrast instances the a11y
   allowlist carries for this page until the contrast round. The body's two
   sliders had no accessible name and its hint was too faint; both were fixed
   with this suite, because they show whenever a floor has a trace image. */
const violations = await a11yScan(page, { impact: 'serious', include: '#trace-image-modal .modal-body' });
eq(violations.length, 0, 'the missing-image state passes axe: ' + JSON.stringify(violations.map(v => v.id)));
await page.click('#trace-image-done');
text = await captureDownload(page, '#btn-export-blueprint');
const exp = JSON.parse(text || '{}');
ok(text && !text.includes('idb:') && exp.floors[0].traceImage === null,
  'an export leaves the lost picture out rather than writing a dead reference into the file');

/* ── 8. with no IndexedDB, a new image is kept the old way ─────────────── */
const noIdb = await newPage({ noIdb: true });
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await noIdb.evaluate(([k, bp]) => localStorage.setItem(k, JSON.stringify(bp)), [KEY, blueprint(null, BLUE)]);
await load(noIdb);
eq(values(await saved(noIdb))[1], BLUE, 'an inline image is left exactly as it was when there is nowhere to move it');
await noIdb.click('#btn-trace-image');
await noIdb.setInputFiles('#trace-image-file', { name: 'red.png', mimeType: 'image/png', buffer: Buffer.from(RED.split(',')[1], 'base64') });
await noIdb.waitForFunction(() => { const b = JSON.parse(localStorage.getItem('stviz_blueprint')); return !!(b.floors[0].traceImage && b.floors[0].traceImage.dataUrl); }, null, { timeout: 10000 });
ok(/^data:image\/jpeg/.test(values(await saved(noIdb))[0]), 'a new image is saved inline in the key, as before Path 4 P4, rather than lost');
await noIdb.click('#trace-image-done');
px = await canvasPixel(noIdb);
ok(px[0] - px[1] > 60, 'and the canvas draws it: ' + px);

/* ── 9. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
