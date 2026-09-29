// smoke-diagrams.mjs — the Formula Sheet Builder's diagrams, in IndexedDB.
//
//   node Tools/formula-sheet-builder/test/smoke-diagrams.mjs
//
// Path 4 P4 moved 041's formula diagrams out of localStorage — out of every
// saved sheet (`gvb-formula-sheet:data:<name>`, each item's `image`) — and
// into the shared media store (_shared/media-db.js, `gvb-media`, namespace
// `fsb`), and deleted the page's own readAndDownscaleImage(). The field kept
// its name and now holds `idb:<id>`, where the id is the stored image's hash.
// What a teacher could lose in that move is asserted here, in a real browser
// with a real IndexedDB:
//
//   1. Sheets saved BEFORE the move (data: URL diagrams, the open one and one
//      that is not) are migrated on load; the keys lose the image bytes; a
//      sheet with no diagram is written back byte-identical; each distinct
//      picture is stored once; the editor and the page preview draw the same
//      picture from an object URL.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 200 px PNG, as
//      readAndDownscaleImage() always stored; the same file on a second sheet
//      is the same record.
//   4. Export JSON and the share sheet's download are portable (data: URLs,
//      byte for byte, no `idb:`); the link still strips the diagrams.
//   5. Importing that file stores its diagrams before saving and reuses the
//      records already there; an `idb:` reference or a value that only looks
//      like an image is dropped from a file or a link, an inline image kept
//      and moved.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by a sheet that is not open, is not.
//   7. A diagram whose image is gone says so on its formula and in the note,
//      is never a broken <img>, is axe-clean in both themes, and Print still
//      reaches window.print().
//   8. With no IndexedDB, diagrams stay inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8449;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/041-formula-sheet-builder.html';
const DATA = 'gvb-formula-sheet:data:';
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
const GONE = 'idb:h0000000000000000000000000000dead';

const item = (name, image) => ({
  name, expression: name + ' = x', note: '', image, workedExample: '', allowed: true, variables: [],
});
const sheet = (name, items) => ({
  name, title: name + ' reference', columns: 2, pageSize: 'full', allowedOnly: false, assessment: '', items,
});
/* Three sheets saved the way 041 saved them before the move: RED on both
   Circles (open) and Prisms (not open), BLUE on Circles only, and one with no
   diagram at all, which must come through byte for byte. */
const SEED = {
  'gvb-formula-sheet:list': ['Circles', 'Prisms', 'Plain'],
  'gvb-formula-sheet:current': 'Circles',
  [DATA + 'Circles']: sheet('Circles', [item('Area of a circle', RED), item('Circumference', BLUE), item('Diameter', '')]),
  [DATA + 'Prisms']: sheet('Prisms', [item('Volume of a prism', RED), item('Surface area', '')]),
  [DATA + 'Plain']: sheet('Plain', [item('Slope', '')]),
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept().catch(() => {}));

const stored = (p, name) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + name);
const rawStored = (p, name) => p.evaluate(k => localStorage.getItem(k), DATA + name);
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-formula-sheet/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'fsb' }).list());
const current = p => p.evaluate(() => localStorage.getItem('gvb-formula-sheet:current'));
const images = (s) => s.items.map(i => i.image);
/* The srcs of the <img>s matching `sel`, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
const stubPrint = p => p.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__formulaImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
  await stubPrint(p);
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
const seed = (p, entries) => p.evaluate(s => {
  localStorage.clear();
  Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, entries);
/* Picks `buffer` through the picture button on formula `n` (0-based). */
const upload = async (p, n, name, buffer) => {
  const chooser = p.waitForEvent('filechooser');
  await p.locator('#itemsList .item-row').nth(n).locator('button[title*="diagram/image"]').click();
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer });
};
const thumbOf = (p, n) => p.locator('#itemsList .item-row').nth(n).locator('img.item-thumb');

console.log('Formula Sheet Builder — diagrams in the media store');

/* ── 1. sheets from before the move are migrated ──────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await seed(page, SEED);
await load(page);

let circles = await stored(page, 'Circles');
let prisms = await stored(page, 'Prisms');
const [redRef, blueRef] = images(circles);
ok(REF.test(redRef), 'the open sheet\'s first diagram now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'its second diagram, a different picture, gets a reference of its own');
eq(images(circles)[2], '', 'a formula with no diagram still has none');
eq(images(prisms)[0], redRef, 'a sheet that is not open is migrated too, and shares the same picture\'s record');
eq(await rawStored(page, 'Plain'), JSON.stringify(SEED[DATA + 'Plain']), 'a sheet with no diagram is not rewritten at all');
eq(await current(page), 'Circles', 'and the open sheet is still the open one');
ok(!(await everyKey(page)).includes('data:image'), 'no gvb-formula-sheet key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture, however many sheets use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'formula-sheet-builder'), 'each with its type and its owner');
const thumbs = await srcsOf(page, '#itemsList img.item-thumb');
ok(thumbs.length === 2 && thumbs.every(s => /^blob:/.test(s)), 'the editor draws both diagrams from object URLs: ' + JSON.stringify(thumbs));
eq((await shownAs(page, '#itemsList img.item-thumb')).join(), [RED, BLUE].join(), 'showing exactly the pictures the formulas showed before the move');
eq((await shownAs(page, '#previewArea img.fimg')).join(), [RED, BLUE].join(), 'and so does the page preview');
const shownV = await a11yScan(page, { impact: 'serious', include: '#itemsList, #previewArea' });
eq(shownV.length, 0, 'the diagrams showing pass axe: ' + JSON.stringify(shownV.map(v => v.id)));

/* ── 2. a reload reads them back ──────────────────────────────────────── */
await load(page);
eq((await shownAs(page, '#itemsList img.item-thumb')).join(), [RED, BLUE].join(), 'after a reload the diagrams draw out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');
eq(JSON.stringify(await stored(page, 'Circles')), JSON.stringify(circles), 'and the sheet is unchanged');

/* ── 3. an upload is downscaled and stored; the same file twice is one record ── */
const bigPng = Buffer.from(await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1200;
  const x = c.getContext('2d');
  x.strokeStyle = '#1f3550'; x.lineWidth = 24;
  x.strokeRect(200, 200, 1200, 800);
  x.beginPath(); x.moveTo(200, 1000); x.lineTo(1400, 200); x.stroke();   // a triangle's hypotenuse, on transparency
  return c.toDataURL('image/png').split(',')[1];
}), 'base64');
await upload(page, 2, 'triangle.png', bigPng);
await page.waitForFunction(() => {
  const img = document.querySelectorAll('#itemsList .item-row')[2].querySelector('img.item-thumb');
  return img && /^blob:/.test(img.getAttribute('src') || '');
}, null, { timeout: 10000 });
circles = await stored(page, 'Circles');
const bigRef = circles.items[2].image;
ok(REF.test(bigRef), 'the upload is saved as a reference: ' + JSON.stringify(bigRef));
recs = await records(page);
const bigRec = recs.find(r => 'idb:' + r.id === bigRef);
eq(bigRec && bigRec.type, 'image/png', 'the stored image is a PNG, as readAndDownscaleImage() always made');
const probe = await page.evaluate(ref => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    res({ w: img.naturalWidth, h: img.naturalHeight, alpha: g.getImageData(5, 5, 1, 1).data[3] });
  };
  img.src = window.FormulaSheetImage.url(ref);
}), bigRef);
eq(`${probe.w}x${probe.h}`, '200x150', 'it is 200 px on its long edge, the size 041 always stored');
eq(probe.alpha, 0, 'and its transparent background is still transparent — nothing is painted under a diagram');
console.log(`  (measured: the 200×150 line diagram stores as ${bigRec && bigRec.size} bytes of PNG)`);
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');
ok(await thumbOf(page, 2).isVisible(), 'the new diagram shows on its formula');
eq((await srcsOf(page, '#previewArea img.fimg')).length, 3, 'and on the page');

await page.selectOption('#sheetSwitch', 'Prisms');
await settle(page, 300);
eq(await current(page), 'Prisms', 'the second sheet is open');
eq((await shownAs(page, '#itemsList img.item-thumb')).join(), RED, 'a sheet switched to after load draws its diagram');
await upload(page, 1, 'triangle-again.png', bigPng);
await page.waitForFunction(() => {
  const img = document.querySelectorAll('#itemsList .item-row')[1].querySelector('img.item-thumb');
  return img && /^blob:/.test(img.getAttribute('src') || '');
}, null, { timeout: 10000 });
prisms = await stored(page, 'Prisms');
eq(prisms.items[1].image, bigRef, 'the same file on a second sheet is the same reference');
eq((await records(page)).length, recs.length, 'and adds no record');

/* ── 4. out of the browser: Export JSON, the share sheet ──────────────── */
await page.selectOption('#sheetSwitch', 'Circles');
await settle(page, 300);
const exported = await nextDownload(page, '#exportSheetBtn');
ok(exported && !exported.includes('idb:'), 'Export JSON carries no idb: reference');
const exportedS = exported ? JSON.parse(exported) : { items: [] };
const bigDataUrl = await page.evaluate(ref => window.FormulaSheetImage.inline(ref), bigRef);
ok(/^data:image\/png;base64,/.test(bigDataUrl || ''), 'the upload reads back as a PNG data URL');
eq(images(exportedS).join(), [RED, BLUE, bigDataUrl].join(), 'it carries every diagram as a data URL, byte for byte');
eq(JSON.stringify(await stored(page, 'Circles')), JSON.stringify(circles), 'exporting did not rewrite the saved sheet');

await page.click('#shareBtn');
await page.waitForSelector('.share-sheet', { timeout: 5000 });
ok(/3 images are left out of the link/.test(await page.textContent('.share-sheet')),
  'the sheet counts the diagrams left out of the link');
const sheetFile = await nextDownload(page, '.share-sheet [data-share="download"]');
ok(sheetFile && !sheetFile.includes('idb:'), 'the sheet\'s download carries no idb: reference');
const sheetState = sheetFile ? JSON.parse(sheetFile).state : { items: [] };
eq(images(sheetState).join(), [RED, BLUE, bigDataUrl].join(), 'and carries every diagram');
const url = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
  document.querySelector('.share-sheet [data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 80));
});
ok(url && !url.includes('idb'), 'the link carries no reference');
const linked = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('sheet')), url);
ok(linked && linked.items.length === 3 && linked.items.every(i => !i.image), 'and no diagram, by share.js\'s policy');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 5. arrivals: a file and a link ───────────────────────────────────── */
const recsBefore = (await records(page)).length;
await page.setInputFiles('#importSheetFile', { name: 'circles.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await page.waitForFunction(() => /^Circles \(/.test(localStorage.getItem('gvb-formula-sheet:current') || ''), null, { timeout: 8000 });
await settle(page, 200);
const importedName = await current(page);
const imported = await stored(page, importedName);
eq(images(imported).join(), [redRef, blueRef, bigRef].join(), 'an imported file\'s diagrams move into the store and reuse the records already there');
eq((await records(page)).length, recsBefore, 'so the import stored nothing new');
ok(!(await everyKey(page)).includes('data:image'), 'and no image bytes were ever left in a key');
eq((await srcsOf(page, '#itemsList img.item-thumb')).filter(s => /^blob:/.test(s)).length, 3, 'and the imported sheet shows its diagrams');

const foreign = JSON.stringify(sheet('Foreign', [item('Theirs', 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef'), item('Ours', BLUE),
  item('Crafted', 'data:image/png;base64,AAAA" onerror="window.__pwned=1')]));
await page.setInputFiles('#importSheetFile', { name: 'foreign.json', mimeType: 'application/json', buffer: Buffer.from(foreign) });
await page.waitForFunction(() => localStorage.getItem('gvb-formula-sheet:current') === 'Foreign', null, { timeout: 8000 });
await settle(page, 200);
const foreignS = await stored(page, 'Foreign');
eq(images(foreignS)[0], '', 'an idb: reference inside a file is dropped — it names the sender\'s diagrams');
eq(images(foreignS)[1], blueRef, 'while its inline image is kept and stored');
eq(images(foreignS)[2], '', 'and a value that only starts like an image is dropped too');
eq(await page.evaluate(() => window.__pwned), undefined, 'so nothing in it ever reached the page as markup');

const arrival = await page.evaluate(([red]) => window.StateLink.buildShareUrl('sheet', {
  name: 'Hand-built link', title: '', columns: 2, pageSize: 'full',
  items: [
    { name: 'Inline', expression: 'a', image: red },
    { name: 'Reference', expression: 'b', image: 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef' },
    { name: 'Crafted', expression: 'c', image: 'data:image/png;base64,AAAA" onerror="window.__pwned=2' },
  ],
}), [RED]);
await load(page, arrival);
const handBuilt = await stored(page, await current(page));
eq(await current(page), 'Hand-built link', 'a link arrives as a sheet of its own');
eq(images(handBuilt)[0], redRef, 'an inline image arriving by link is moved into the store and reuses its record');
eq(images(handBuilt)[1], '', 'a reference arriving by link is dropped');
eq(images(handBuilt)[2], '', 'and so is a value that only starts like an image');
eq(await page.evaluate(() => window.__pwned), undefined, 'which never reached the page as markup');
ok(!/missing/.test(await page.textContent('#shareNote')), 'and nothing is reported missing');

/* ── 6. orphans are collected on the next load, and only orphans ──────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'fsb' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'fsb/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
});
/* Age every real record past the grace period, so only references keep them. */
await page.evaluate(() => new Promise(res => {
  const req = indexedDB.open('gvb-media');
  req.onsuccess = () => {
    const t = req.result.transaction('blobs', 'readwrite');
    const os = t.objectStore('blobs');
    const all = os.getAll();
    all.onsuccess = () => all.result.forEach(r => {
      if (/^fsb\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); }
    });
    t.oncomplete = () => { req.result.close(); res(); };
  };
}));
/* Prisms is the only sheet holding the big diagram once every other lets it go. */
await page.evaluate(([prefix, ref]) => {
  Object.keys(localStorage).filter(k => k.startsWith(prefix) && k !== prefix + 'Prisms').forEach(k => {
    const d = JSON.parse(localStorage.getItem(k));
    d.items.forEach(i => { if (i.image === ref) i.image = ''; });
    localStorage.setItem(k, JSON.stringify(d));
  });
  localStorage.setItem('gvb-formula-sheet:current', 'Circles');
}, [DATA, bigRef]);
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load(page);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(bigRef.slice(4)), 'an old record only a sheet that is not open points at survives');
ok(after.includes(redRef.slice(4)) && after.includes(blueRef.slice(4)), 'and so does every one the open sheet points at');

/* ── 7. a diagram with nothing behind it says so, and never hangs a print ── */
await page.evaluate(([k, gone]) => {
  const d = JSON.parse(localStorage.getItem(k));
  d.items[0].image = gone;
  localStorage.setItem(k, JSON.stringify(d));
}, [DATA + 'Circles', GONE]);
await load(page);
eq((await stored(page, 'Circles')).items[0].image, GONE, 'the dangling reference is left in place (the diagram might come back in a restore)');
eq((await srcsOf(page, '#itemsList img.item-thumb')).length, 1, 'the editor draws only the diagram that is there');
ok(/Diagram missing from this browser/.test(await page.locator('#itemsList .item-row').nth(0).textContent()),
  'and says so on the formula whose diagram is gone');
ok(/1 diagram on “Circles” is missing/.test(await page.textContent('#shareNote')),
  'and the note says so, naming the sheet: ' + JSON.stringify(await page.textContent('#shareNote')));
eq((await srcsOf(page, '#previewArea img.fimg')).length, 1, 'the page leaves the missing diagram out');
eq(await page.$$eval('img', els => els.filter(e => !e.getAttribute('src')).length), 0, 'no <img> anywhere on the page is left without a picture');
ok(await page.locator('#itemsList .item-row').nth(0).locator('.item-thumb-remove').isVisible(), 'and the remove button is still on it');
const SCOPE = '#shareNote, #itemsList, #previewArea';
const lightV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(lightV.length, 0, 'the missing-diagram state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(darkV.length, 0, 'and in dark theme, note included: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

await page.click('#printBtn');
await page.waitForFunction(() => window.__printCalls === 1, null, { timeout: 5000 });
eq((await srcsOf(page, '#printArea img')).filter(s => /^blob:/.test(s)).length, 1, 'Print reaches window.print() with the one diagram that is there');
await page.selectOption('#pageSize', 'card');
await page.click('#printBtn');
await page.waitForFunction(() => window.__printCalls === 2, null, { timeout: 5000 });
eq((await srcsOf(page, '#printArea img')).length, 4, 'and the four-up card print carries it on every copy');
ok((await page.$$eval('#printArea img', els => els.every(e => e.complete && e.naturalWidth > 0))), 'every printed diagram had loaded before print');
await page.selectOption('#pageSize', 'full');

await page.locator('#itemsList .item-row').nth(0).locator('.item-thumb-remove').click();
await settle(page, 150);
eq((await stored(page, 'Circles')).items[0].image, '', 'removing it clears the reference');

/* ── 8. with no IndexedDB, diagrams stay inline, as before ────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1400, height: 1000 });
noIdb.on('dialog', d => d.accept().catch(() => {}));
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, { 'gvb-formula-sheet:list': ['Circles'], 'gvb-formula-sheet:current': 'Circles', [DATA + 'Circles']: SEED[DATA + 'Circles'] });
await load(noIdb);
eq((await shownAs(noIdb, '#itemsList img.item-thumb')).join(), [RED, BLUE].join(), 'inline diagrams still draw when there is nowhere to move them');
eq(images(await stored(noIdb, 'Circles')).join(), [RED, BLUE, ''].join(), 'and stay inline in the key');
await upload(noIdb, 2, 'blue.png', Buffer.from(BLUE.split(',')[1], 'base64'));
await noIdb.waitForFunction(() => {
  const img = document.querySelectorAll('#itemsList .item-row')[2].querySelector('img.item-thumb');
  return img && /^data:image\/png/.test(img.getAttribute('src') || '');
}, null, { timeout: 5000 });
ok(/^data:image\/png/.test((await stored(noIdb, 'Circles')).items[2].image || ''),
  'a new upload is saved inline (a PNG), as before Path 4 P4, rather than lost');
ok(!/missing/.test(await noIdb.textContent('#shareNote')), 'and nothing is reported missing');
const offlineExport = await nextDownload(noIdb, '#exportSheetBtn');
ok(offlineExport && JSON.parse(offlineExport).items[0].image === RED, 'and Export JSON still carries them');

/* ── 9. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
