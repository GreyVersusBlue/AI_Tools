// smoke-images.mjs — the Certificate & Award Maker's logo and signature images, in IndexedDB.
//
//   node Tools/certificate-award-maker/test/smoke-images.mjs
//
// Path 4 P4 moved 042's two uploads — the logo/crest and the signature image —
// out of every named preset (`gvb-certificate-maker:data:<name>`, fields
// `logo` and `signatureImage`) and into the shared media store
// (_shared/media-db.js, `gvb-media`, namespace `cam`). The fields kept their
// names and now hold `idb:<id>`, where the id is the stored image's hash.
// What a teacher could lose in that move is asserted here, in a real browser
// with a real IndexedDB:
//
//   1. Presets saved BEFORE the move (data: URL images, the open preset and
//      one that is not) are migrated on load; only the presets that changed
//      are rewritten; the open preset stays open; each distinct picture is
//      stored once; the previews and the certificate draw from object URLs.
//      The pre-presets `:last` slot is still promoted, then removed.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 200 px, PNG, with
//      its transparency kept (what cam-logo.js always stored).
//   4. The same file in a second preset is the same record.
//   5. The batch grid and the printed sheets show the images.
//   6. Delete-then-undo keeps an image only the deleted preset points at,
//      even when another tab's GC removed it meanwhile.
//   7. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by a preset that is not open, is not.
//   8. A reference whose image is gone is said on its preview, and the
//      certificate and the print leave the <img> out — axe-clean in both themes.
//   9. With no IndexedDB, an image stays inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8447;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/042-certificate-award-maker.html';
const DATA = 'gvb-certificate-maker:data:';
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

const preset = (name, extra = {}) => ({
  name, theme: 'elegant', border: 'double-line', logo: '', mode: 'single', studentName: 'Avery Quill',
  batchNames: '', awardTitle: 'Certificate of Achievement', awardTitleCustom: '', reason: '', certDate: '2026-09-28',
  signature: 'Ms. Invented', signatureImage: '', qrUrl: '', orientation: 'landscape', perPage: 1,
  showGuides: false, stockInset: 0, ...extra,
});
/* Three presets saved the way 042 saved them before the move: RED as the
   logo of two (the same crest in both), BLUE as one's signature, and a third
   with no images at all, which must not be rewritten. */
const SEED = {
  'gvb-certificate-maker:list': ['Honor Roll', 'Science Fair', 'Plain'],
  'gvb-certificate-maker:current': 'Honor Roll',
  [DATA + 'Honor Roll']: preset('Honor Roll', { logo: RED, signatureImage: BLUE }),
  [DATA + 'Science Fair']: preset('Science Fair', { logo: RED }),
  [DATA + 'Plain']: preset('Plain'),
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
let promptAnswer = 'Second Preset';
page.on('dialog', d => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());

const raw = (p, name) => p.evaluate(k => localStorage.getItem(k), DATA + name);
const stored = async (p, name) => JSON.parse(await raw(p, name) || 'null');
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-certificate-maker/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'cam' }).list());
const current = p => p.evaluate(() => localStorage.getItem('gvb-certificate-maker:current'));
/* The srcs of the <img>s matching `sel`, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
const seed = (p, s) => p.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))); }, s);
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__camImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
};
/* Age a stored record, the way time would, through the raw store. */
const age = (p, ref, ms) => p.evaluate(([id, ms]) => new Promise(res => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    const g = os.get('cam/' + id);
    g.onsuccess = () => { const r = g.result; if (r) { r.savedAt = Date.now() - ms; os.put(r); } };
    t.oncomplete = () => { req.result.close(); res(); };
  };
}), [ref.slice(4), ms]);
const savedAtOf = async (p, ref) => ((await records(p)).find(r => 'idb:' + r.id === ref) || {}).savedAt || 0;
/* A PNG made in the page: `w`×`h`, with transparent corners, as a Buffer. */
const makePng = async (p, w, h, kind) => Buffer.from(await p.evaluate(([w, h, kind]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (kind === 'noise') {
    const d = x.createImageData(w, h);
    let s = 7;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d.data[i] = s & 255; d.data[i + 1] = (s >> 8) & 255; d.data[i + 2] = (s >> 16) & 255; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    x.clearRect(0, 0, w / 8, h / 8);
  } else if (kind === 'signature') {
    x.strokeStyle = '#1b2a4a'; x.lineWidth = h / 12; x.lineCap = 'round';
    x.beginPath(); x.moveTo(w * 0.05, h * 0.7);
    for (let i = 1; i <= 12; i++) x.quadraticCurveTo(w * (i / 13), h * (i % 2 ? 0.1 : 0.9), w * ((i + 0.5) / 13), h * 0.55);
    x.stroke();
  } else {
    /* A crest: a gold shield, a navy chevron, a letter, clear all round. */
    x.fillStyle = '#c9a227';
    x.beginPath(); x.moveTo(w * 0.2, h * 0.1); x.lineTo(w * 0.8, h * 0.1); x.lineTo(w * 0.8, h * 0.55);
    x.quadraticCurveTo(w * 0.8, h * 0.85, w * 0.5, h * 0.95); x.quadraticCurveTo(w * 0.2, h * 0.85, w * 0.2, h * 0.55); x.fill();
    x.fillStyle = '#1f2f4d';
    x.beginPath(); x.moveTo(w * 0.2, h * 0.5); x.lineTo(w * 0.5, h * 0.3); x.lineTo(w * 0.8, h * 0.5); x.lineTo(w * 0.8, h * 0.6);
    x.lineTo(w * 0.5, h * 0.4); x.lineTo(w * 0.2, h * 0.6); x.fill();
    x.font = `bold ${Math.round(h * 0.25)}px serif`; x.textAlign = 'center'; x.fillText('E', w * 0.5, h * 0.82);
  }
  return c.toDataURL('image/png').split(',')[1];
}, [w, h, kind]), 'base64');
/* Size and a corner pixel's alpha of the <img> at `sel`. */
const probe = (p, sel) => p.evaluate(sel => new Promise(res => {
  const img = document.querySelector(sel);
  const read = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    res({ w: img.naturalWidth, h: img.naturalHeight, cornerAlpha: g.getImageData(0, 0, 1, 1).data[3] });
  };
  if (img.complete && img.naturalWidth) read(); else img.onload = read;
}), sel);

console.log('Certificate & Award Maker — logo and signature images in the media store');

/* ── 1. presets from before the move are migrated ──────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await seed(page, SEED);
const plainBefore = await raw(page, 'Plain');
await load(page);

let honor = await stored(page, 'Honor Roll');
let fair = await stored(page, 'Science Fair');
const redRef = honor.logo, blueRef = honor.signatureImage;
ok(REF.test(redRef), 'the open preset\'s logo now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'its signature image, a different picture, gets a reference of its own');
eq(fair.logo, redRef, 'a preset that is not open is migrated too, and shares the same crest\'s record');
eq(await raw(page, 'Plain'), plainBefore, 'a preset with no images is not rewritten');
eq(await current(page), 'Honor Roll', 'migrating the other presets did not change which one is open');
ok(!(await everyKey(page)).includes('data:image'), 'no gvb-certificate-maker key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture, however many presets use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'certificate-award-maker'), 'each with its type and its owner');
const previews = await srcsOf(page, '#logoPreviewImg, #signaturePreviewImg');
ok(previews.length === 2 && previews.every(s => /^blob:/.test(s)), 'both previews draw from object URLs: ' + JSON.stringify(previews));
eq((await shownAs(page, '#logoPreviewImg'))[0], RED, 'the logo preview shows exactly the picture it showed before the move');
eq((await shownAs(page, '#signaturePreviewImg'))[0], BLUE, 'and the signature preview its own');
eq((await shownAs(page, '#previewArea .cert-logo'))[0], RED, 'the certificate draws the logo');
eq((await shownAs(page, '#previewArea .cert-sig-img'))[0], BLUE, 'and the signature image');
ok(!(await page.isVisible('#logoMissing')) && !(await page.isVisible('#signatureMissing')), 'and nothing is reported missing');
const IMAGE_BITS = '#logoPreview, #signaturePreview, #previewArea';
const shownV = await a11yScan(page, { impact: 'serious', include: IMAGE_BITS });
eq(shownV.length, 0, 'both images showing pass axe: ' + JSON.stringify(shownV.map(v => v.id)));

/* The pre-presets single slot still becomes a preset, and its images move. */
await seed(page, { 'gvb-certificate-maker:last': JSON.stringify(preset(undefined, { logo: RED })) });
await load(page);
eq(await current(page), 'My Certificate', 'the legacy single slot is promoted to "My Certificate"');
eq((await stored(page, 'My Certificate')).logo, redRef, 'its logo is moved into the store, reusing the record already there');
eq(await page.evaluate(() => localStorage.getItem('gvb-certificate-maker:last')), null, 'and the old slot, which held the data URL, is removed');
eq((await shownAs(page, '#previewArea .cert-logo'))[0], RED, 'the promoted preset draws its logo');

/* ── 2. a reload reads them back ───────────────────────────────────────── */
await seed(page, { ...SEED, [DATA + 'Honor Roll']: preset('Honor Roll', { logo: redRef, signatureImage: blueRef }),
  [DATA + 'Science Fair']: preset('Science Fair', { logo: redRef }) });
await load(page);
eq((await shownAs(page, '#logoPreviewImg'))[0], RED, 'after a reload the preview draws its image out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');

/* ── 3. an upload is downscaled to 200 px PNG, transparency kept ───────── */
const crest = await makePng(page, 800, 640, 'crest');
const signature = await makePng(page, 900, 240, 'signature');
promptAnswer = 'Spelling Bee';
await page.click('#newPresetBtn');
await settle(page, 200);
eq(await current(page), 'Spelling Bee', 'a new preset is open');
await page.setInputFiles('#logoFile', { name: 'crest.png', mimeType: 'image/png', buffer: crest });
await page.waitForFunction(k => /^idb:/.test((JSON.parse(localStorage.getItem(k) || '{}').logo) || ''), DATA + 'Spelling Bee', { timeout: 10000 });
await page.setInputFiles('#signatureFile', { name: 'sig.png', mimeType: 'image/png', buffer: signature });
await page.waitForFunction(k => /^idb:/.test((JSON.parse(localStorage.getItem(k) || '{}').signatureImage) || ''), DATA + 'Spelling Bee', { timeout: 10000 });
await settle(page, 200);
const bee = await stored(page, 'Spelling Bee');
const crestRef = bee.logo, sigRef = bee.signatureImage;
ok(REF.test(crestRef) && REF.test(sigRef), 'both uploads are saved as references');
recs = await records(page);
const crestRec = recs.find(r => 'idb:' + r.id === crestRef);
const sigRec = recs.find(r => 'idb:' + r.id === sigRef);
eq(crestRec && crestRec.type, 'image/png', 'the stored crest is a PNG, as cam-logo.js always made it');
const crestProbe = await probe(page, '#logoPreviewImg');
eq(`${crestProbe.w}x${crestProbe.h}`, '200x160', 'it is 200 px on its long edge');
eq(crestProbe.cornerAlpha, 0, 'and its clear corner is still clear: no background was painted under it');
const sigProbe = await probe(page, '#signaturePreviewImg');
eq(`${sigProbe.w}x${sigProbe.h}`, '200x53', 'the signature is 200 px on its long edge too');
eq(sigProbe.cornerAlpha, 0, 'and keeps its transparent paper');
const noise = await makePng(page, 800, 800, 'noise');
const noiseSize = await page.evaluate(b64 => {
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return window.MediaDB.downscaleImage(new Blob([u], { type: 'image/png' }), { maxDim: 200, type: 'image/png' }).then(o => o.blob.size);
}, noise.toString('base64'));
console.log(`  (measured: an 800×640 crest stores as ${crestRec && crestRec.size} bytes of PNG, a 900×240 signature as ` +
  `${sigRec && sigRec.size}, and the worst case, 800×800 of noise, as ${noiseSize} — ` +
  `${Math.round(noiseSize * 4 / 3 / 1024)} KB as the data URL each preset used to hold)`);
ok(crestRec && crestRec.size < 20000, `a crest is small (${crestRec && crestRec.size} bytes)`);
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');

/* ── 4. the same file in a second preset is the same record ────────────── */
promptAnswer = 'Spelling Bee, second period';
await page.click('#newPresetBtn');
await settle(page, 200);
await page.setInputFiles('#logoFile', { name: 'crest-again.png', mimeType: 'image/png', buffer: crest });
await page.waitForFunction(k => /^idb:/.test((JSON.parse(localStorage.getItem(k) || '{}').logo) || ''), DATA + 'Spelling Bee, second period', { timeout: 10000 });
await settle(page, 200);
eq((await stored(page, 'Spelling Bee, second period')).logo, crestRef, 'the same crest uploaded into a second preset is the same reference');
eq((await records(page)).length, 4, 'and adds no record');

/* ── 5. the batch grid and the printed sheets ──────────────────────────── */
await page.selectOption('#presetSwitch', 'Spelling Bee');
await settle(page, 200);
await page.click('.mode-tab[data-mode="batch"]');
await page.fill('#batchNames', 'Avery Quill\nBrook Lantern\nCasey Thimble');
await settle(page, 150);
await page.click('.view-tab[data-view="grid"]');
await settle(page, 200);
const gridLogos = await srcsOf(page, '#previewArea .thumb-grid .cert-logo');
ok(gridLogos.length === 3 && gridLogos.every(s => /^blob:/.test(s)), 'the batch grid draws every certificate\'s logo from an object URL: ' + JSON.stringify(gridLogos.length));
eq((await srcsOf(page, '#previewArea .thumb-grid .cert-sig-img')).length, 3, 'and every signature');
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printBtn');
await settle(page, 200);
const printedLogos = await srcsOf(page, '#printArea .cert-logo');
ok(printedLogos.length === 3 && printedLogos.every(s => /^blob:/.test(s)), 'the printed sheets carry every logo: ' + JSON.stringify(printedLogos.length));
const printedSig = await shownAs(page, '#printArea .cert-sig-img');
eq(printedSig.length, 3, 'and every signature');
eq(printedSig[0], await shownAs(page, '#signaturePreviewImg').then(a => a[0]), 'showing the stored signature');

/* ── 6. delete-then-undo keeps the image only that preset points at ────── */
await page.selectOption('#presetSwitch', 'Spelling Bee');
await settle(page, 200);
/* The signature is Spelling Bee's alone. Make it an old record first, so
   another tab's GC would take it once nothing saved points at it. */
await age(page, sigRef, 3600e3);
await page.click('#deletePresetBtn');
await settle(page, 200);
ok(await page.isVisible('#undoDeleteBtn'), 'deleting offers an undo');
ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-certificate-maker:list')))).includes('Spelling Bee'), 'the preset is gone from the list');
ok(Date.now() - await savedAtOf(page, sigRef) < 60e3, 'its images are re-stamped, so another tab\'s GC spares them while undo is offered');
/* Another tab collected it anyway — the worst case. */
await page.evaluate(id => window.MediaDB.store({ ns: 'cam' }).remove(id), sigRef.slice(4));
ok(!(await records(page)).some(r => 'idb:' + r.id === sigRef), 'the signature record is removed behind this tab\'s back');
await page.click('#undoDeleteBtn');
await page.waitForFunction(() => localStorage.getItem('gvb-certificate-maker:current') === 'Spelling Bee', null, { timeout: 5000 });
await settle(page, 300);
eq((await stored(page, 'Spelling Bee')).signatureImage, sigRef, 'undo brings the preset back with its reference');
ok((await records(page)).some(r => 'idb:' + r.id === sigRef), 'and writes the image back from memory');
ok(/^blob:/.test(await page.getAttribute('#signaturePreviewImg', 'src') || ''), 'so the signature still shows');
ok(!(await page.isVisible('#signatureMissing')), 'and is not reported missing');

/* ── 7. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'cam' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==');
  return st.put('fresh-orphan', blob).then(() => st.put('old-orphan', blob));
});
await age(page, 'idb:old-orphan', 3600e3);
/* Deleted for good this time: no undo survives a reload. */
await page.click('#deletePresetBtn');
await settle(page, 200);
await age(page, sigRef, 3600e3);
await age(page, redRef, 3600e3);    // only closed presets point at RED
const before = (await records(page)).map(r => r.id);
ok(['old-orphan', 'fresh-orphan', sigRef.slice(4)].every(id => before.includes(id)), 'three unreferenced records are there before the load');
await load(page);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(!after.includes(sigRef.slice(4)), 'and so is the signature of a preset deleted for good');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(redRef.slice(4)), 'an old record only presets that are not open point at survives');
ok(after.includes(crestRef.slice(4)), 'and so does one a remaining preset points at');

/* ── 8. a reference with nothing behind it says so ─────────────────────── */
await page.evaluate(k => {
  const d = JSON.parse(localStorage.getItem(k));
  d.logo = 'idb:h0000000000000000000000000000dead';
  d.signatureImage = 'idb:h000000000000000000000000000dead2';
  localStorage.setItem(k, JSON.stringify(d));
  localStorage.setItem('gvb-certificate-maker:current', 'Science Fair');
}, DATA + 'Science Fair');
await load(page);
eq(await page.getAttribute('#logoPreviewImg', 'src'), null, 'a dangling reference draws no preview image');
ok(await page.isVisible('#logoMissing'), 'the logo preview says the image is missing');
ok(/missing from this browser’s storage/.test(await page.textContent('#logoMissing')), 'in words: ' + JSON.stringify(await page.textContent('#logoMissing')));
ok(await page.isVisible('#signatureMissing'), 'and so does the signature preview');
ok(await page.isVisible('#logoRemove') && await page.isVisible('#signatureRemove'), '"Remove" is still offered for both');
eq(await page.$('#previewArea .cert-logo'), null, 'the certificate leaves the missing logo out rather than draw a broken image');
eq(await page.$('#previewArea .cert-sig-img'), null, 'and falls back to the plain signature line');
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printBtn');
await settle(page, 150);
eq(await page.$$eval('#printArea img.cert-logo, #printArea img.cert-sig-img', els => els.length), 0, 'the print carries no broken <img> either');
const lightV = await a11yScan(page, { impact: 'serious', include: IMAGE_BITS });
eq(lightV.length, 0, 'the missing-image state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: IMAGE_BITS });
eq(darkV.length, 0, 'and in dark theme: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await page.click('#logoRemove');
await settle(page, 150);
eq((await stored(page, 'Science Fair')).logo, '', 'removing it clears the reference');
ok(!(await page.isVisible('#logoPreview')), 'and the preview goes away');

/* ── 9. with no IndexedDB, an image is kept the old way ────────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1300, height: 1000 });
noIdb.on('dialog', d => d.accept());
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, { 'gvb-certificate-maker:list': ['Honor Roll'], 'gvb-certificate-maker:current': 'Honor Roll',
  [DATA + 'Honor Roll']: preset('Honor Roll', { logo: RED }) });
await load(noIdb);
eq((await shownAs(noIdb, '#logoPreviewImg'))[0], RED, 'an inline logo still draws when there is nowhere to move it');
eq((await shownAs(noIdb, '#previewArea .cert-logo'))[0], RED, 'on the certificate too');
eq((await stored(noIdb, 'Honor Roll')).logo, RED, 'and stays inline in the key');
await noIdb.setInputFiles('#signatureFile', { name: 'sig.png', mimeType: 'image/png', buffer: signature });
await noIdb.waitForFunction(k => /^data:image\/png/.test(JSON.parse(localStorage.getItem(k)).signatureImage || ''), DATA + 'Honor Roll', { timeout: 5000 });
ok(true, 'a new upload is saved inline (a downscaled PNG), as before Path 4 P4, rather than lost');
ok(!(await noIdb.isVisible('#logoMissing')) && !(await noIdb.isVisible('#signatureMissing')), 'and nothing is reported missing');

/* ── 10. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
