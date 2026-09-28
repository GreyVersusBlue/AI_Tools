// smoke-images.mjs — the Primary Source Analysis Worksheet Generator's uploaded images, in IndexedDB.
//
//   node Tools/primary-source-analysis-generator/test/smoke-images.mjs
//
// Path 4 P4 moved 028's Source A and Source B uploads out of localStorage —
// out of every worksheet (`gvb-primary-source:data:<name>`) and out of the
// source library (`gvb-primary-source:library`) — and into the shared media
// store (_shared/media-db.js, `gvb-media`, namespace `psa`). The fields kept
// their names (`imageDataUrl`, `sourceBImageDataUrl`) and now hold
// `idb:<id>`, where the id is the stored image's hash. What a teacher could
// lose in that move is asserted here, in a real browser with a real IndexedDB:
//
//   1. Worksheets and library entries saved BEFORE the move (data: URL
//      images, the open worksheet and one that is not) are migrated on load;
//      the keys lose the image bytes; each distinct picture is stored once;
//      the editor and the worksheet draw the same picture from an object URL;
//      a saved crop is untouched and still prints.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 1600 px, JPEG,
//      on white (what 028 always stored); the same file uploaded into a
//      second worksheet is the same record.
//   4. Saving to the library stores a reference, not a second copy, and
//      using a library entry copies the reference.
//   5. The printed worksheet shows the images.
//   6. Export worksheet and the share sheet's download are portable (data:
//      URLs, byte for byte, no `idb:`); the link still strips them.
//   7. Importing that file moves its images into the store before saving and
//      reuses the records already there; an `idb:` reference in a file or a
//      link is dropped, an inline image kept and moved.
//   8. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by the library, is not.
//   9. A reference whose image is gone is said on its source, in the note
//      (naming the worksheet) and on the worksheet — axe-clean in both themes.
//  10. With no IndexedDB, an upload is kept inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8446;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/028-primary-source-analysis-generator.html';
const DATA = 'gvb-primary-source:data:';
const REF = /^idb:h[0-9a-f]{32}$/;

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

const sheet = (name, extra = {}) => ({
  name, sourceTitle: name + ' source', sourceType: 'photo', sourceDescription: 'An invented description of ' + name + '.',
  sourceText: '', imageUrl: '', imageDataUrl: '', framework: 'optic', notes: {}, customQuestions: {}, answerLines: 4, ...extra,
});
/* Two worksheets and a library, saved the way 028 saved them before the
   move: RED in both worksheets and the library, BLUE as one's Source B. The
   open one carries a crop, which must come through untouched. */
const CROP = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
const SEED = {
  'gvb-primary-source:list': ['Mill Strike', 'River Ferry'],
  'gvb-primary-source:current': 'Mill Strike',
  [DATA + 'Mill Strike']: sheet('Mill Strike', {
    imageDataUrl: RED, imageCrop: CROP, imageDetail: true,
    corroborationMode: true, sourceBTitle: 'Ferry ledger', sourceBImageDataUrl: BLUE,
  }),
  [DATA + 'River Ferry']: sheet('River Ferry', { imageDataUrl: RED }),
  'gvb-primary-source:library': [{ id: 'src-seed', title: 'Mill photograph', type: 'photo', description: 'Invented.', text: '',
    imageUrl: '', imageDataUrl: RED, citationAuthor: '', citationDate: '', citationOrigin: '', tags: ['Unit 9'], savedAt: '2026-09-01' }],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
let promptAnswer = 'New Worksheet';
page.on('dialog', d => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());

const stored = (p, name) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + name);
const library = p => p.evaluate(() => JSON.parse(localStorage.getItem('gvb-primary-source:library') || '[]'));
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-primary-source/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'psa' }).list());
const current = p => p.evaluate(() => localStorage.getItem('gvb-primary-source:current'));
/* The srcs of the <img>s matching `sel`, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__psaImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
};
/* The text of the next JSON file this page hands the browser as a download. */
const nextDownload = (p, click) => p.evaluate(sel => new Promise(resolve => {
  const real = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    if (blob.type === 'application/json') { URL.createObjectURL = real; blob.text().then(resolve); }
    return real.call(URL, blob);
  };
  document.querySelector(sel).click();
  setTimeout(() => { URL.createObjectURL = real; resolve(null); }, 3000);
}), click);

console.log('Primary Source Analysis — uploaded images in the media store');

/* ── 1. worksheets and the library from before the move are migrated ───── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(seed => { localStorage.clear(); Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); }, SEED);
await load(page);

let mill = await stored(page, 'Mill Strike');
let ferry = await stored(page, 'River Ferry');
let lib = await library(page);
const redRef = mill.imageDataUrl, blueRef = mill.sourceBImageDataUrl;
ok(REF.test(redRef), 'the open worksheet\'s Source A upload now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'its Source B upload, a different picture, gets a reference of its own');
eq(ferry.imageDataUrl, redRef, 'a worksheet that is not open is migrated too, and shares the same picture\'s record');
eq(lib[0].imageDataUrl, redRef, 'and so is the library entry');
ok(!(await everyKey(page)).includes('data:image'), 'no gvb-primary-source key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture, however many places use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'primary-source-analysis-generator'), 'each with its type and its owner');
eq(JSON.stringify(mill.imageCrop), JSON.stringify(CROP), 'the saved crop is untouched: a crop is parameters over the stored image');
eq(mill.imageDetail, true, 'and so is the side-by-side choice');
const preview = await srcsOf(page, '#imageFilePreview, #sourceBImageFilePreview, .crop-tool img');
ok(preview.length === 4 && preview.every(s => /^blob:/.test(s)), 'the editor previews and crop tools draw from object URLs: ' + JSON.stringify(preview));
eq((await shownAs(page, '#imageFilePreview'))[0], RED, 'showing exactly the picture Source A showed before the move');
eq((await shownAs(page, '#sourceBImageFilePreview'))[0], BLUE, 'and Source B its own');
ok(await page.$('#previewArea .source-image-pair .detail-marker') !== null, 'the worksheet still prints the whole image with the crop outlined');
eq((await shownAs(page, '#previewArea .crop-frame img'))[0], RED, 'and the enlarged detail is the stored picture');
ok(/2\.0×/.test(await page.textContent('#cropHintA')), 'the crop hint still reports the zoom: ' + JSON.stringify(await page.textContent('#cropHintA')));
/* Scoped to the source cards: the page's .preview-note contrast is already
   on the site allowlist, and this suite is about the image states. The site
   sweep opens 028 with no upload, so it never saw the previews, which had no
   alt text until this suite scanned them. */
const IMAGE_CARDS = '#imageFilePreviewWrap, #sourceBImageFilePreviewWrap, #cropPanelA, #cropPanelB, #previewArea .source-box';
const shownV = await a11yScan(page, { impact: 'serious', include: IMAGE_CARDS });
eq(shownV.length, 0, 'both uploads showing, previews and crop tools included, pass axe: ' + JSON.stringify(shownV.map(v => v.id)));

/* ── 2. a reload reads them back ───────────────────────────────────────── */
await load(page);
eq((await shownAs(page, '#imageFilePreview'))[0], RED, 'after a reload the preview draws its image out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');

/* ── 3. an upload is downscaled and stored; the same file twice is one record ── */
/* A realistic photo: 2400×1800 of noise, a big PNG with transparency in one corner. */
const photo = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1800;
  const x = c.getContext('2d');
  const d = x.createImageData(2400, 1800);
  let seed = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d.data[i] = seed & 255; d.data[i + 1] = (seed >> 8) & 255; d.data[i + 2] = (seed >> 16) & 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  x.clearRect(0, 0, 200, 200);
  return c.toDataURL('image/png').split(',')[1];
});
const photoBytes = Buffer.from(photo, 'base64');
promptAnswer = 'Canal Photos';
await page.click('#newSheetBtn');
await settle(page, 200);
eq(await current(page), 'Canal Photos', 'a second worksheet is open');
await page.setInputFiles('#imageFile', { name: 'canal.png', mimeType: 'image/png', buffer: photoBytes });
await page.waitForFunction(k => /^idb:/.test((JSON.parse(localStorage.getItem(k) || '{}').imageDataUrl) || ''), DATA + 'Canal Photos', { timeout: 10000 });
await settle(page, 200);
const canalRef = (await stored(page, 'Canal Photos')).imageDataUrl;
ok(REF.test(canalRef), 'the upload is saved as a reference: ' + JSON.stringify(canalRef));
recs = await records(page);
const canal = recs.find(r => 'idb:' + r.id === canalRef);
eq(canal && canal.type, 'image/jpeg', 'the stored image is the downscaled JPEG, not the uploaded PNG');
ok(canal && canal.size < photoBytes.length / 4, `and much smaller than the upload (${canal && canal.size} of ${photoBytes.length} bytes)`);
const probe = await page.evaluate(() => new Promise(res => {
  const img = document.getElementById('imageFilePreview');
  const read = () => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 4, 4, 0, 0, 4, 4);
    res({ w: img.naturalWidth, h: img.naturalHeight, corner: Array.from(g.getImageData(1, 1, 1, 1).data.slice(0, 3)) });
  };
  if (img.complete && img.naturalWidth) read(); else img.onload = read;
}));
eq(`${probe.w}x${probe.h}`, '1600x1200', 'it is 1600 px on its long edge, the size 028 always stored');
ok(probe.corner.every(v => v > 240), 'and a transparent corner comes out white, not black, as the old downscaler made it: ' + JSON.stringify(probe.corner));
console.log(`  (a 2400×1800 noise PNG of ${photoBytes.length} bytes stores as ${canal && canal.size} bytes of JPEG — ` +
  `${Math.round((canal ? canal.size : 0) * 4 / 3 / 1024)} KB as the data URL localStorage used to hold)`);
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');

promptAnswer = 'Canal Photos, second period';
await page.click('#newSheetBtn');
await settle(page, 200);
await page.setInputFiles('#imageFile', { name: 'canal-again.png', mimeType: 'image/png', buffer: photoBytes });
await page.waitForFunction(k => /^idb:/.test((JSON.parse(localStorage.getItem(k) || '{}').imageDataUrl) || ''), DATA + 'Canal Photos, second period', { timeout: 10000 });
await settle(page, 200);
eq((await stored(page, 'Canal Photos, second period')).imageDataUrl, canalRef, 'the same file uploaded into a second worksheet is the same reference');
eq((await records(page)).length, 3, 'and adds no record');

/* ── 4. the library holds references ───────────────────────────────────── */
await page.fill('#libraryTags', 'Unit 4');
await page.click('#saveSourceALibBtn');
await settle(page, 200);
lib = await library(page);
eq(lib.length, 2, 'saving Source A to the library adds a library entry');
eq(lib[0].imageDataUrl, canalRef, 'which points at the same stored image');
eq((await records(page)).length, 3, 'without storing its bytes a second time (the library used to hold a full copy)');
await page.check('#corroborationEnabled');
await settle(page, 150);
await page.locator('.lib-entry', { hasText: 'Mill photograph' }).getByRole('button', { name: 'Use as Source B' }).click();
await settle(page, 200);
eq((await stored(page, 'Canal Photos, second period')).sourceBImageDataUrl, redRef, 'using a library entry copies its reference into the worksheet');
eq((await shownAs(page, '#sourceBImageFilePreview'))[0], RED, 'and shows its picture');

/* ── 5. the printed worksheet ──────────────────────────────────────────── */
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printBlankBtn');
await settle(page, 200);
const printedSrcs = await srcsOf(page, '#printArea .source-image');
ok(printedSrcs.length === 2 && printedSrcs.every(s => /^blob:/.test(s)), 'the printed worksheet draws both uploads from object URLs: ' + JSON.stringify(printedSrcs));
const printed = await shownAs(page, '#printArea .source-image');
ok(/^data:image\/jpeg;base64,/.test(printed[0]), 'Source A is the downscaled upload');
eq(printed[1], RED, 'Source B is the library picture');

/* ── 6. out of the browser: Export worksheet, the share sheet ─────────── */
const exported = await nextDownload(page, '#exportSheetBtn');
ok(exported && !exported.includes('idb:'), 'Export worksheet carries no idb: reference');
const exportedSheet = exported ? JSON.parse(exported) : {};
eq(exportedSheet.sourceBImageDataUrl, RED, 'it carries the images as data URLs, byte for byte');
const canalDataUrl = await page.evaluate(ref => window.PsaImage.inline(ref), canalRef);
eq(exportedSheet.imageDataUrl, canalDataUrl, 'the downscaled upload too');
eq((await stored(page, 'Canal Photos, second period')).imageDataUrl, canalRef, 'exporting did not rewrite the saved worksheet');

await page.click('#shareBtn');
await page.waitForSelector('.share-sheet', { timeout: 5000 });
ok(/left out of the link/.test(await page.textContent('.share-sheet-note')), 'the sheet says the images are left out of the link: ' + JSON.stringify(await page.textContent('.share-sheet-note')));
const sheetFile = await nextDownload(page, '.share-sheet [data-share="download"]');
ok(sheetFile && !sheetFile.includes('idb:'), 'the sheet\'s download carries no idb: reference');
const sheetState = sheetFile ? JSON.parse(sheetFile).state : {};
eq(sheetState.imageDataUrl, canalDataUrl, 'and carries the upload');
eq(sheetState.sourceBImageDataUrl, RED, 'and the library picture');
const url = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
  document.querySelector('.share-sheet [data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 80));
});
ok(url && !url.includes('idb'), 'the link carries no reference');
const linked = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('worksheet')), url);
ok(!linked.imageDataUrl && !linked.sourceBImageDataUrl, 'and no image, by share.js\'s policy');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 7. arrivals: a file, and a link ───────────────────────────────────── */
const withForeignRef = JSON.stringify({ ...exportedSheet, name: 'Foreign', imageDataUrl: 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef' });
await page.setInputFiles('#importSheetFile', { name: 'canal.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await page.waitForFunction(() => /Opened that file/.test(document.getElementById('shareNote').textContent), null, { timeout: 8000 });
const importedName = await current(page);
const imported = await stored(page, importedName);
ok(importedName !== 'Canal Photos, second period', 'the file is saved as a copy beside the original: ' + JSON.stringify(importedName));
eq(imported.imageDataUrl, canalRef, 'an imported file\'s images move into the store and reuse the records already there');
eq(imported.sourceBImageDataUrl, redRef, 'both of them');
eq((await records(page)).length, 3, 'so the import stored nothing new');
ok(!(await everyKey(page)).includes('data:image'), 'and no image bytes were ever left in a key');
eq((await shownAs(page, '#imageFilePreview'))[0], canalDataUrl, 'and the imported worksheet shows its image');

await page.setInputFiles('#importSheetFile', { name: 'foreign.json', mimeType: 'application/json', buffer: Buffer.from(withForeignRef) });
await page.waitForFunction(() => /“Foreign”/.test(document.getElementById('shareNote').textContent), null, { timeout: 8000 });
eq((await stored(page, 'Foreign')).imageDataUrl, '', 'an idb: reference inside a file is dropped — it names the sender\'s images');
eq((await stored(page, 'Foreign')).sourceBImageDataUrl, redRef, 'while its inline image is kept and stored');

const arrival = await page.evaluate(([red]) => window.StateLink.buildShareUrl('worksheet', {
  v: 1, name: 'Hand-built link', framework: 'optic', notes: {},
  imageDataUrl: red, sourceBImageDataUrl: 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef',
}), [RED]);
await load(page, arrival);
const handBuilt = await stored(page, await current(page));
eq(handBuilt.imageDataUrl, redRef, 'an inline image arriving by link is moved into the store and reuses its record');
eq(handBuilt.sourceBImageDataUrl, '', 'a reference arriving by link is dropped');

/* ── 8. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'psa' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'psa/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
});
/* Every worksheet lets go of the canal photo, leaving only the library entry. */
await page.evaluate(([prefix, ref]) => {
  Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => {
    const d = JSON.parse(localStorage.getItem(k));
    if (d.imageDataUrl === ref) { d.imageDataUrl = ''; localStorage.setItem(k, JSON.stringify(d)); }
  });
}, [DATA, canalRef]);
await page.evaluate(ref => new Promise(res => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    const g = os.get('psa/' + ref.slice(4));
    g.onsuccess = () => { const r = g.result; r.savedAt = Date.now() - 3600e3; os.put(r); };
    t.oncomplete = () => { req.result.close(); res(); };
  };
}), canalRef);
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load(page, URL_PAGE);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(canalRef.slice(4)), 'an old record only the library points at survives');
ok(after.includes(redRef.slice(4)) && after.includes(blueRef.slice(4)), 'and so does every one a worksheet points at, open or not');

/* ── 9. a reference with nothing behind it says so ─────────────────────── */
await page.evaluate(k => {
  const d = JSON.parse(localStorage.getItem(k));
  d.imageDataUrl = 'idb:h0000000000000000000000000000dead';
  localStorage.setItem(k, JSON.stringify(d));
  localStorage.setItem('gvb-primary-source:current', 'River Ferry');
}, DATA + 'River Ferry');
await load(page);
eq(await page.getAttribute('#imageFilePreview', 'src'), null, 'a dangling reference draws no image');
ok(await page.isVisible('#clearImageFileBtn'), 'but "Remove uploaded image" is still there');
ok(/missing from this browser’s storage/.test(await page.textContent('#imageSizeWarning')), 'the source says its image is missing');
ok(/1 uploaded image saved in “River Ferry” is missing/.test(await page.textContent('#shareNote')),
  'and the note says so, naming the worksheet: ' + JSON.stringify(await page.textContent('#shareNote')));
ok(/Image not available on this device/.test(await page.textContent('#previewArea')), 'the worksheet says so instead of a blank box');
const lightV = await a11yScan(page, { impact: 'serious', include: '#shareNote, #imageFilePreviewWrap, #previewArea .source-box' });
eq(lightV.length, 0, 'the missing-image state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: '#shareNote, #imageFilePreviewWrap, #previewArea .source-box' });
eq(darkV.length, 0, 'and in dark theme, note included: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await page.click('#clearImageFileBtn');
await settle(page, 150);
eq((await stored(page, 'River Ferry')).imageDataUrl, '', 'removing it clears the reference');

/* ── 10. with no IndexedDB, an upload is kept the old way ──────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await noIdb.evaluate(([k, seed]) => {
  localStorage.clear();
  localStorage.setItem('gvb-primary-source:list', JSON.stringify(['Mill Strike']));
  localStorage.setItem('gvb-primary-source:current', 'Mill Strike');
  localStorage.setItem(k, JSON.stringify(seed));
}, [DATA + 'Mill Strike', { ...SEED[DATA + 'Mill Strike'], sourceBImageDataUrl: '' }]);
await load(noIdb);
eq((await shownAs(noIdb, '#imageFilePreview'))[0], RED, 'an inline image still draws when there is nowhere to move it');
eq((await stored(noIdb, 'Mill Strike')).imageDataUrl, RED, 'and stays inline in the key');
await noIdb.setInputFiles('#sourceBImageFile', { name: 'blue.png', mimeType: 'image/png', buffer: Buffer.from(BLUE.split(',')[1], 'base64') });
await noIdb.waitForFunction(k => /^data:image\/jpeg/.test(JSON.parse(localStorage.getItem(k)).sourceBImageDataUrl || ''), DATA + 'Mill Strike', { timeout: 5000 });
ok(true, 'a new upload is saved inline (downscaled JPEG), as before Path 4 P4, rather than lost');
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
