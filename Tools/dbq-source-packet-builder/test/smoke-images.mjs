// smoke-images.mjs — the DBQ / Source Packet Builder's source images, in IndexedDB.
//
//   node Tools/dbq-source-packet-builder/test/smoke-images.mjs
//
// Path 4 P4 moved 056's uploaded images out of localStorage — out of every
// packet (`dbq:data:<name>`) and out of the source library (`dbq:bank`) — and
// into the shared media store (_shared/media-db.js, `gvb-media`, namespace
// `dbq`). A source now holds `idb:<id>`, where the id is the image's hash.
// Everything a teacher could lose in that move is asserted here, in a real
// browser with a real IndexedDB:
//
//   1. Packets and library entries saved BEFORE the move (data: URL images,
//      the open packet and one that is not) are migrated on load; the keys lose
//      the image bytes; each distinct picture is stored once, shared by every
//      packet and library entry that used it; the editor draws the same
//      picture, from an object URL.
//   2. A reload reads them back and stores nothing twice.
//   3. An uploaded photo goes in exactly as uploaded (056 never downscaled);
//      its size is printed, because object URLs rest on it. The same file
//      uploaded again, or saved to the library, adds no record.
//   4. The printed packet shows the images.
//   5. The share sheet's download and Export JSON are portable (data: URLs,
//      byte for byte, no `idb:`), and the link still strips and counts them.
//   6. A file import is moved into the store and reuses records already there;
//      an `idb:` reference arriving by link is dropped, an inline image kept.
//   7. An orphaned record is deleted on the next load; one younger than the
//      grace period, or still referenced by ANY packet or the library, is not.
//   8. A reference whose image is gone is marked on its source, said in the
//      note (naming the packet), and printed as unavailable — axe-clean in
//      both themes.
//   9. A save that fails for want of room is said, and the note goes once a
//      save works again.
//  10. With no IndexedDB, an upload is kept inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8240;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/056-dbq-source-packet-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* Two real 1x1 PNGs, different pixels, so "the same picture" is checkable. */
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';

const src = (id, title, type, image, extra = {}) => ({
  id, bankId: null, title, type, text: type === 'text' ? 'Some words from ' + title + '.' : '', image,
  imgW: image ? 1 : 0, imgH: image ? 1 : 0, crop: { x: 0, y: 0, w: 1, h: 1 }, widthPct: 100,
  citation: 'Invented citation for ' + title + '.', questions: [{ id: 'q' + id, text: 'What do you notice?' }], ...extra,
});
const packet = (name, sources) => ({
  name, title: name, context: '', essayPrompt: '', level: 'honors', organizerEnabled: false, rubricEnabled: false,
  sharedQuestions: [{ id: 'sq1', text: 'What is the main idea?' }], sources,
});
/* Two packets and a library, saved the way 056 saved them before the move:
   RED in both packets and in the library, BLUE in one packet only. */
const SEED = {
  'dbq:list': ['Harbor Strike', 'Canal Days'],
  'dbq:current': 'Harbor Strike',
  'dbq:data:Harbor Strike': packet('Harbor Strike', [
    src('s1', 'Dock Photograph', 'image', RED, { bankId: 'b1' }),
    src('s2', 'Union Handbill', 'text', null),
    src('s3', 'Pier Map', 'image', BLUE),
  ]),
  'dbq:data:Canal Days': packet('Canal Days', [src('s4', 'Lock Keeper', 'image', RED)]),
  'dbq:bank': [{ bankId: 'b1', savedAt: '2026-09-01T12:00:00.000Z', source: src('s9', 'Dock Photograph', 'image', RED, { bankId: 'b1' }) }],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
page.on('dialog', d => d.accept());

const stored = (p, name) => p.evaluate(n => JSON.parse(localStorage.getItem('dbq:data:' + n) || 'null'), name);
const bank = p => p.evaluate(() => JSON.parse(localStorage.getItem('dbq:bank') || '[]'));
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^dbq/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'dbq' }).list());
/* The <img> srcs in one source block, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const block = i => `#sourcesWrap .source-block:nth-child(${i})`;
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__dbqImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
};
/* The text of the next file this page hands the browser as a download. */
const nextDownload = (p, click) => p.evaluate(sel => new Promise(resolve => {
  const real = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    if (blob.type === 'application/json') { URL.createObjectURL = real; blob.text().then(resolve); }
    return real.call(URL, blob);
  };
  document.querySelector(sel).click();
  setTimeout(() => { URL.createObjectURL = real; resolve(null); }, 3000);
}), click);

console.log('DBQ / Source Packet Builder — source images in the media store');

/* ── 1. packets and the library from before the move are migrated ──────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(seed => { localStorage.clear(); Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); }, SEED);
await load(page);

let harbor = await stored(page, 'Harbor Strike');
let canal = await stored(page, 'Canal Days');
let lib = await bank(page);
const redRef = harbor.sources[0].image, blueRef = harbor.sources[2].image;
ok(/^idb:h[0-9a-f]{32}$/.test(redRef), 'the open packet\'s image source now holds a hash reference: ' + JSON.stringify(redRef));
ok(/^idb:h[0-9a-f]{32}$/.test(blueRef) && blueRef !== redRef, 'a different picture gets a reference of its own');
eq(canal.sources[0].image, redRef, 'a packet that is not open is migrated too, and shares the same picture\'s record');
eq(lib[0].source.image, redRef, 'and so is the library entry');
eq(harbor.sources[1].image, null, 'a text source still has no image');
ok(!(await everyKey(page)).includes('data:image'), 'no dbq key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture, however many places use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'dbq-source-packet-builder'), 'each with its type and its owner');
const cropSrcs = await page.$$eval('.crop-tool img', els => els.map(e => e.getAttribute('src')));
ok(cropSrcs.length === 2 && cropSrcs.every(s => /^blob:/.test(s)), 'the crop tool draws from object URLs: ' + JSON.stringify(cropSrcs));
eq((await shownAs(page, `${block(1)} .crop-tool img`))[0], RED, 'showing exactly the picture it showed before the move');
eq((await shownAs(page, `${block(3)} .crop-frame img`))[0], BLUE, 'and the print-size preview shows the other one');
/* The page sweep opens on the text-only example, so it has never seen an
   image source: its upload and width controls had no accessible name. */
const shownV = await a11yScan(page, { impact: 'serious', include: block(1) });
eq(shownV.length, 0, 'an image source, crop tool and all, passes axe: ' + JSON.stringify(shownV.map(v => v.id)));

/* ── 2. a reload reads them back ───────────────────────────────────────── */
await load(page);
eq((await shownAs(page, `${block(1)} .crop-tool img`))[0], RED, 'after a reload the source draws its image out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');

/* ── 3. an uploaded photo is stored as uploaded ─────────────────────────── */
/* A realistic photo: 1600×1200 of noise, a big PNG — 056 never downscaled. */
const photo = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1200;
  const x = c.getContext('2d');
  const d = x.createImageData(1600, 1200);
  let seed = 11;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d.data[i] = seed & 255; d.data[i + 1] = (seed >> 8) & 255; d.data[i + 2] = (seed >> 16) & 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
});
const photoBytes = Buffer.from(photo, 'base64');
await page.click('#addSourceBtn');
await settle(page, 150);
await page.selectOption(`${block(4)} select[data-field="type"]`, 'image');
await settle(page, 150);
await page.fill(`${block(4)} [data-field="title"]`, 'Warehouse Fire');
await page.setInputFiles(`${block(4)} input[type="file"]`, { name: 'fire.png', mimeType: 'image/png', buffer: photoBytes });
await page.waitForFunction(() => { const b = document.querySelector('#sourcesWrap .source-block:nth-child(4) .crop-frame'); return b && /aspect-ratio/.test(b.getAttribute('style')); }, null, { timeout: 8000 });
harbor = await stored(page, 'Harbor Strike');
const fireRef = harbor.sources[3].image;
ok(/^idb:h[0-9a-f]{32}$/.test(fireRef), 'the upload is saved as a reference: ' + JSON.stringify(fireRef));
eq(`${harbor.sources[3].imgW}x${harbor.sources[3].imgH}`, '1600x1200', 'with its natural size, for the crop maths');
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');
recs = await records(page);
const fire = recs.find(r => 'idb:' + r.id === fireRef);
eq(fire && fire.size, photoBytes.length, 'the stored image is the uploaded file, byte for byte in size (not downscaled)');
console.log(`  (a 1600×1200 noise PNG stores as ${photoBytes.length} bytes — ` +
  `${Math.round(photoBytes.length * 4 / 3 / 1024)} KB as a data URL, which localStorage could never have held beside anything else)`);
ok(photoBytes.length > 5 * 1024 * 1024 * 0.75, 'which is past what the old localStorage path could store at all');

await page.click('#addSourceBtn');
await settle(page, 150);
await page.selectOption(`${block(5)} select[data-field="type"]`, 'image');
await settle(page, 150);
await page.setInputFiles(`${block(5)} input[type="file"]`, { name: 'fire-again.png', mimeType: 'image/png', buffer: photoBytes });
await page.waitForFunction(() => !!document.querySelector('#sourcesWrap .source-block:nth-child(5) .crop-tool img'), null, { timeout: 8000 });
await settle(page, 300);
eq((await stored(page, 'Harbor Strike')).sources[4].image, fireRef, 'the same file uploaded again is the same reference');
eq((await records(page)).length, 3, 'and adds no record');
await page.click(`${block(4)} [data-to-bank]`);
await settle(page, 200);
lib = await bank(page);
eq(lib.length, 2, 'saving the upload to the library adds a library entry');
eq(lib[1].source.image, fireRef, 'which points at the same stored image');
eq((await records(page)).length, 3, 'without storing its bytes a second time (the library used to hold a full copy)');
await page.click(`${block(5)} [data-del-src-btn]`);
await settle(page, 200);

/* ── 4. the printed packet ─────────────────────────────────────────────── */
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printBtn');
await settle(page, 200);
const printed = await shownAs(page, '#printArea .crop-frame img');
eq(printed.length, 3, 'the printed packet has all three images');
ok(printed[0] === RED && printed[1] === BLUE, 'the migrated ones, as they were');
ok(/^data:image\/png;base64,/.test(printed[2]) && printed[2].length > 1000, 'and the upload');

/* ── 5. out of the browser: share sheet, download, Export JSON ─────────── */
await page.click('#shareBtn');
await page.waitForSelector('.share-sheet', { timeout: 5000 });
const note = await page.textContent('.share-sheet-note');
ok(/3 images are left out of the link and QR code/.test(note), 'the sheet counts the images it strips from the link: ' + JSON.stringify(note));
ok(/Dock Photograph/.test(note) && /Warehouse Fire/.test(note), 'and names the sources they belong to');
const sheetFile = await nextDownload(page, '.share-sheet [data-share="download"]');
ok(sheetFile && !sheetFile.includes('idb:'), 'the sheet\'s download carries no idb: reference');
const sheetState = sheetFile ? JSON.parse(sheetFile).state : { sources: [] };
eq(sheetState.sources[0].image, RED, 'it carries a migrated image byte for byte');
eq(sheetState.sources[2].image, BLUE, 'every one');
eq(sheetState.sources[3].image, 'data:image/png;base64,' + photo, 'the upload exactly as uploaded');
const url = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
  document.querySelector('.share-sheet [data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 80));
});
ok(url && !url.includes('idb'), 'the link carries no reference');
const linked = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('packet')), url);
eq(linked.sources[0].image, null, 'and no image, by share.js\'s policy');
await page.keyboard.press('Escape');
await settle(page, 100);
eq((await stored(page, 'Harbor Strike')).sources[0].image, redRef, 'sharing did not rewrite the saved packet');

const exported = await nextDownload(page, '#exportJsonBtn');
ok(exported && !exported.includes('idb:'), 'Export JSON carries no idb: reference');
const exportedPacket = exported ? JSON.parse(exported) : { sources: [] };
eq(exportedPacket.sources[0].image, RED, 'and carries the images as data URLs');
eq(exportedPacket.sources[3].image, 'data:image/png;base64,' + photo, 'the big one too');

/* ── 6. arrivals: a file, and a link ───────────────────────────────────── */
await page.setInputFiles('#importJsonFile', { name: 'harbor.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await page.waitForFunction(() => /Opened that file/.test(document.getElementById('shareNote').textContent), null, { timeout: 8000 });
await page.waitForFunction(() => !/data:image/.test(localStorage.getItem('dbq:data:' + localStorage.getItem('dbq:current')) || 'data:image'), null, { timeout: 8000 });
const importedName = await page.inputValue('#packetName');
const imported = await stored(page, importedName);
eq(imported.sources[0].image, redRef, 'an imported file\'s images move into the store and reuse the records already there');
eq(imported.sources[3].image, fireRef, 'the big one included');
eq((await records(page)).length, 3, 'so the import stored nothing new');
eq((await shownAs(page, `${block(3)} .crop-tool img`))[0], BLUE, 'and the imported packet shows its images');

const arrival = await page.evaluate(([red]) => window.StateLink.buildShareUrl('packet', {
  v: 1, name: 'Mill Town', title: 'Mill Town', sources: [
    { id: 'a1', title: 'Hand-built link image', type: 'image', image: red },
    { id: 'a2', title: 'Someone else\'s reference', type: 'image', image: 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef' },
  ],
}), [RED]);
await load(page, arrival);
const mill = await stored(page, await page.inputValue('#packetName'));
eq(mill.sources[0].image, redRef, 'an inline image arriving by link is moved into the store and reuses its record');
eq(mill.sources[1].image, null, 'a reference arriving by link is dropped — it names the sender\'s images, not this browser\'s');
ok(/No image on this device yet/.test(await page.textContent(block(2))), 'and that source asks for the image, as a link without one always has');

/* ── 7. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'dbq' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'dbq/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
});
/* The library entry is now the ONLY thing pointing at the upload's record. */
await page.evaluate(n => {
  ['Harbor Strike', n].forEach(name => {
    const d = JSON.parse(localStorage.getItem('dbq:data:' + name));
    d.sources = d.sources.filter(s => s.title !== 'Warehouse Fire');
    localStorage.setItem('dbq:data:' + name, JSON.stringify(d));
  });
}, importedName);
/* …and the old-orphan backdates the upload's record too, as if it were old. */
await page.evaluate(ref => new Promise(res => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    const g = os.get('dbq/' + ref.slice(4));
    g.onsuccess = () => { const r = g.result; r.savedAt = Date.now() - 3600e3; os.put(r); };
    t.oncomplete = () => { req.result.close(); res(); };
  };
}), fireRef);
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load(page, URL_PAGE);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(fireRef.slice(4)), 'an old record only the library points at survives');
ok(after.includes(redRef.slice(4)) && after.includes(blueRef.slice(4)), 'and so does every one a packet points at, open or not');

/* ── 8. a reference with nothing behind it says so ─────────────────────── */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('dbq:data:Canal Days'));
  d.sources[0].image = 'idb:h0000000000000000000000000000dead';
  localStorage.setItem('dbq:data:Canal Days', JSON.stringify(d));
  localStorage.setItem('dbq:current', 'Canal Days');
});
await load(page);
eq(await page.$(`${block(1)} .crop-tool img`), null, 'a dangling reference draws no <img>');
ok(/missing from this browser’s storage/.test(await page.textContent(block(1))), 'the source says its image is missing');
ok(/1 image saved in “Canal Days” is missing/.test(await page.textContent('#shareNote')),
  'and the note says so, naming the packet: ' + JSON.stringify(await page.textContent('#shareNote')));
await page.click('#printBtn');
await settle(page, 150);
ok(/Image not available on this device/.test(await page.textContent('#printArea')), 'the printed packet says so instead of a blank box');
const lightV = await a11yScan(page, { impact: 'serious', include: block(1) });
eq(lightV.length, 0, 'the missing-image state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: '#shareNote, ' + block(1) });
eq(darkV.length, 0, 'and in dark theme, note included: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* ── 9. a save that fails is said ──────────────────────────────────────── */
await page.evaluate(() => {
  window.__realSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (/^dbq:data:/.test(k)) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    return window.__realSet.call(this, k, v);
  };
});
await page.fill('#packetTitle', 'Canal Days, revised');
await settle(page, 100);
ok(/Could not save “Canal Days”: this browser’s storage for this site is full/.test(await page.textContent('#shareNote')),
  'a save refused for want of room is said: ' + JSON.stringify(await page.textContent('#shareNote')));
ok(await page.evaluate(() => document.getElementById('shareNote').classList.contains('error')), 'as an error');
await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
await page.fill('#packetTitle', 'Canal Days, revised again');
await settle(page, 100);
eq(await page.textContent('#shareNote'), '', 'and once a save works again the note goes');
eq((await stored(page, 'Canal Days')).title, 'Canal Days, revised again', 'with the latest text saved');

/* ── 10. with no IndexedDB, an upload is kept the old way ──────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await noIdb.evaluate(seed => {
  localStorage.clear();
  localStorage.setItem('dbq:list', JSON.stringify(['Harbor Strike']));
  localStorage.setItem('dbq:current', 'Harbor Strike');
  localStorage.setItem('dbq:data:Harbor Strike', JSON.stringify(seed));
}, { ...SEED['dbq:data:Harbor Strike'], sources: SEED['dbq:data:Harbor Strike'].sources.map((s, i) => i === 2 ? { ...s, image: null } : s) });
await load(noIdb);
eq((await shownAs(noIdb, `${block(1)} .crop-tool img`))[0], RED, 'an inline image still draws when there is nowhere to move it');
eq((await stored(noIdb, 'Harbor Strike')).sources[0].image, RED, 'and stays inline in the key');
await noIdb.setInputFiles(`${block(3)} input[type="file"]`, { name: 'blue.png', mimeType: 'image/png', buffer: Buffer.from(BLUE.split(',')[1], 'base64') });
await noIdb.waitForFunction(() => /^data:image/.test((JSON.parse(localStorage.getItem('dbq:data:Harbor Strike')).sources[2] || {}).image || '') &&
  JSON.parse(localStorage.getItem('dbq:data:Harbor Strike')).sources[2].image.length > 0, null, { timeout: 5000 });
eq((await stored(noIdb, 'Harbor Strike')).sources[2].image, BLUE, 'a new upload is saved inline, as before Path 4 P4, rather than lost');
ok(!/missing/.test(await noIdb.textContent('#shareNote')), 'and nothing is reported missing');

/* ── 11. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
