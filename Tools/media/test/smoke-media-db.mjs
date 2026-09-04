// smoke-media-db.mjs — _shared/media-db.js in a real browser (Path 4 P3):
// real IndexedDB, a real canvas downscale, and the adopter's own map cache
// reading a record written the way it was written before this module existed.
//
//   node Tools/media/test/smoke-media-db.mjs
//
// 046 Blank Map Generator is the single adopter: its bmg-map-cache.js WAS the
// site's IndexedDB pattern and is now an adapter over the shared store. The
// page is used here as a host that loads media-db.js — nothing in these
// assertions needs Wikimedia, which the harness blocks anyway.
//
// The assertion this suite exists for is section 5: a record in the exact
// shape bmg-map-cache.js wrote for two years is seeded through raw IndexedDB,
// with no field this module adds, and then read back through the tool's own
// getCachedMap()/listCachedMaps(). If that ever fails, every map a teacher has
// cached has silently vanished from the picker. Tools/media/test/
// media-db.test.mjs asserts the same thing over a fake store; this one does it
// against the browser's, because "no migration needed" is a claim about a real
// database.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8409;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/046-blank-map-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

console.log('The shared media store (Path 4 P3)');

const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
await settle(page, 400);

/* ── 1. the module is on the page ────────────────────────────────────────── */
{
  const info = await page.evaluate(() => ({
    present: !!window.MediaDB,
    db: window.MediaDB && window.MediaDB.DEFAULT_DB,
    store: window.MediaDB && window.MediaDB.DEFAULT_STORE,
    available: window.MediaDB ? window.MediaDB.isAvailable() : false,
  }));
  ok(info.present, '1: _shared/media-db.js is loaded on 046');
  eq([info.db, info.store], ['gvb-media', 'blobs'], '1: the shared database is the one the registry declares');
  ok(await page.evaluate(() => window.MediaDB.isAvailable()), '1: the browser opens it');
}

/* ── 2. a real blob round trip ───────────────────────────────────────────── */
{
  const r = await page.evaluate(async () => {
    const shelf = window.MediaDB.store({ ns: 'suite' });
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    await shelf.put('one', new Blob([bytes], { type: 'image/png' }), { name: 'a picture', tag: 7 });
    const rec = await shelf.get('one');
    const back = new Uint8Array(await rec.blob.arrayBuffer());
    const listed = await shelf.list();
    const usage = await shelf.usage();
    return {
      bytes: [...back], type: rec.type, size: rec.size, name: rec.name, tag: rec.tag,
      listedIds: listed.map(x => x.id),
      listedHasBlob: listed.some(x => 'blob' in x),
      usage,
      missing: await shelf.get('nope'),
    };
  });
  eq(r.bytes, [1, 2, 3, 4, 5, 6, 7, 8], '2: the bytes come back exactly');
  eq([r.type, r.size], ['image/png', 8], '2: type and size are read off the blob itself');
  eq([r.name, r.tag], ['a picture', 7], '2: the caller\'s metadata survives the round trip');
  eq(r.listedIds, ['one'], '2: the listing carries the record');
  ok(!r.listedHasBlob, '2: ...but not its bytes');
  eq(r.usage, { count: 1, bytes: 8 }, '2: usage adds the stored sizes up');
  eq(r.missing, null, '2: an id that was never stored reads as null');
}

/* ── 3. two namespaces, one real database ───────────────────────────────── */
{
  const r = await page.evaluate(async () => {
    const a = window.MediaDB.store({ ns: 'suite' });
    const b = window.MediaDB.store({ ns: 'other' });
    await b.put('one', new Blob(['x'], { type: 'image/png' }), { name: 'not the same one' });
    const mine = await a.get('one');
    const theirs = await b.get('one');
    const removed = await a.clear();
    return {
      mine: mine.name, theirs: theirs.name,
      removed,
      aLeft: (await a.list()).length,
      bLeft: (await b.list()).length,
    };
  });
  eq([r.mine, r.theirs], ['a picture', 'not the same one'], '3: the same id in two namespaces is two records');
  eq(r.removed, 1, '3: clear() takes this namespace\'s records');
  eq([r.aLeft, r.bLeft], [0, 1], '3: ...and leaves the neighbour\'s alone');
  await page.evaluate(() => window.MediaDB.store({ ns: 'other' }).clear());
}

/* ── 4. a real canvas downscale ──────────────────────────────────────────── */
{
  const r = await page.evaluate(async () => {
    // A 1200x300 PNG built in the page, so the source is real bytes rather
    // than a fixture that might not decode.
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = '#2b4c7e'; g.fillRect(0, 0, 1200, 300);
    g.fillStyle = '#e8d9b0'; g.fillRect(0, 0, 600, 150);
    const src = await new Promise(res => c.toBlob(res, 'image/png'));

    const big = await window.MediaDB.downscaleImage(src, { maxDim: 480 });
    const thumb = await window.MediaDB.downscaleImage(src, { maxDim: 160, quality: 0.75 });
    const asUrl = await window.MediaDB.downscaleImage(src, { maxDim: 160, as: 'dataUrl' });
    const tiny = await new Promise(res => {
      const c2 = document.createElement('canvas');
      c2.width = 40; c2.height = 20;
      c2.getContext('2d').fillRect(0, 0, 40, 20);
      c2.toBlob(res, 'image/png');
    });
    const notUpscaled = await window.MediaDB.downscaleImage(tiny, { maxDim: 1600 });

    return {
      srcBytes: src.size,
      big: [big.width, big.height], bigBytes: big.blob.size, bigType: big.blob.type,
      thumb: [thumb.width, thumb.height],
      urlBlob: asUrl.blob, urlHead: (asUrl.dataUrl || '').slice(0, 30),
      notUpscaled: [notUpscaled.width, notUpscaled.height],
    };
  });
  eq(r.big, [480, 120], '4: the long edge lands on maxDim, aspect kept');
  eq(r.thumb, [160, 40], '4: ...at a desk-thumbnail size too');
  eq(r.bigType, 'image/jpeg', '4: JPEG by default');
  ok(r.bigBytes < r.srcBytes, `4: the result is smaller than the source (${r.bigBytes} < ${r.srcBytes})`);
  eq(r.urlBlob, null, '4: as:"dataUrl" returns no blob');
  ok(/^data:image\/jpeg;base64,/.test(r.urlHead), '4: ...it returns a data URL, for a tool still saving into localStorage');
  eq(r.notUpscaled, [40, 20], '4: a small image is left alone rather than blown up');
}

/* ── 5. the adopter reads what it wrote before this module existed ───────── */
{
  const r = await page.evaluate(async () => {
    // Seeded through raw IndexedDB in the exact shape bmg-map-cache.js used
    // to write: flat, with `mime` and `cachedAt`, and none of the fields
    // media-db.js adds.
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('bmg-maps', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put({
          id: 'File:Suite.svg', title: 'Suite map',
          blob: new Blob([new Uint8Array([9, 9, 9])], { type: 'image/svg+xml' }),
          mime: 'image/svg+xml', width: 800, height: 600,
          attribution: { artist: 'A cartographer', license: 'CC0' },
          cachedAt: 1700000000000,
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const cache = await import('/Tools/blank-map-generator/bmg-map-cache.js');
    const rec = await cache.getCachedMap('File:Suite.svg');
    const listed = await cache.listCachedMaps();
    const bytes = rec ? [...new Uint8Array(await rec.blob.arrayBuffer())] : null;

    // And a new record, written through the adapter, reads the same way.
    await cache.putCachedMap({
      id: 'File:New.png', title: 'New map', blob: new Blob(['ab'], { type: 'image/png' }),
      mime: 'image/png', width: 10, height: 20, attribution: { license: 'CC0' }, cachedAt: 1800000000000,
    });
    const fresh = await cache.getCachedMap('File:New.png');
    await cache.deleteCachedMap('File:New.png');

    return {
      available: await cache.isAvailable(),
      title: rec && rec.title, mime: rec && rec.mime, cachedAt: rec && rec.cachedAt,
      artist: rec && rec.attribution && rec.attribution.artist,
      bytes,
      listed: listed.map(x => [x.id, x.title, x.mime, x.cachedAt]),
      freshTitle: fresh && fresh.title,
      freshWidth: fresh && fresh.width,
      gone: await cache.getCachedMap('File:New.png'),
    };
  });
  ok(r.available, '5: the tool\'s own cache reports available');
  eq([r.title, r.mime, r.cachedAt], ['Suite map', 'image/svg+xml', 1700000000000],
    '5: a record written before media-db.js reads back through the adapter unchanged');
  eq(r.artist, 'A cartographer', '5: ...nested attribution included');
  eq(r.bytes, [9, 9, 9], '5: ...and its blob is the same bytes');
  eq(r.listed, [['File:Suite.svg', 'Suite map', 'image/svg+xml', 1700000000000]],
    '5: the recent-maps listing is unchanged in shape');
  eq([r.freshTitle, r.freshWidth], ['New map', 10], '5: a record written through the shared store reads the same way');
  eq(r.gone, null, '5: and deleting one removes it');
}

/* ── 6. 009 finds the shared database, names it, and ticks it ───────────── */
{
  // The point of registering it. A record is left in gvb-media (same origin,
  // so 009 sees the same IndexedDB) and the backup page is opened cold.
  await page.evaluate(() => window.MediaDB.store({ ns: 'suite' })
    .put('photo', new Blob(['abc'], { type: 'image/jpeg' }), { name: 'a student photo' }));

  // A SECOND PAGE IN THE SAME CONTEXT, not a second prepPage(): the harness
  // gives every prepPage its own browser context, and IndexedDB does not cross
  // one. A fresh context here found "Nothing is stored in IndexedDB" and the
  // section failed for a reason that had nothing to do with 009.
  const backup = await page.context().newPage();
  await backup.goto(BASE + '/Tools/009-backup-restore.html', { waitUntil: 'domcontentloaded' });
  await settle(backup, 1200);

  const r = await backup.evaluate(() => {
    const rows = [...document.querySelectorAll('#idbWrap .idb-check')].map(cb => ({
      db: cb.dataset.db,
      checked: cb.checked,
      label: cb.closest('tr').querySelector('.g-label').textContent,
    }));
    return { rows, text: document.getElementById('idbWrap').textContent };
  });
  const media = r.rows.find(x => x.db === 'gvb-media');
  const maps = r.rows.find(x => x.db === 'bmg-maps');
  ok(media, '6: 009 lists the shared media store — the registration is what makes it visible');
  ok(media && media.checked, '6: ...ticked, because nothing can re-download a teacher\'s photos');
  ok(media && /student photos/.test(media.label), '6: ...and named from the registry, not left as "Other saved data"');
  ok(maps, '6: the map cache is listed too');
  ok(maps && !maps.checked, '6: ...but left unticked, because those re-download');
  await backup.close();

  await page.evaluate(() => window.MediaDB.store({ ns: 'suite' }).clear());
}

await page.close();
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
