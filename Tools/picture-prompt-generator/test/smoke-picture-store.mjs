// smoke-picture-store.mjs — the Picture-Prompt Generator's pictures, in IndexedDB.
//
//   node Tools/picture-prompt-generator/test/smoke-picture-store.mjs
//
// Path 4 P4 moved 071's pictures out of localStorage — out of the flat list in
// `ppg_images_v1`, each entry's `src` — and into the shared media store
// (_shared/media-db.js, `gvb-media`, namespace `ppg`), and deleted the page's
// own downscaleDataUrl(). The field kept its name and now holds `idb:<id>`,
// where the id is the stored picture's hash. What a teacher could lose in that
// move is asserted here, in a real browser with a real IndexedDB:
//
//   1. A list saved BEFORE the move (data: URL pictures, one of them twice,
//      with pins) is migrated on load; the key loses the image bytes and keeps
//      every entry, id and pin; each distinct picture is stored once; the
//      thumbnails draw the same pictures from object URLs.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload past 1400 px is downscaled to a 1400 px JPEG on white, as
//      downscaleDataUrl() did; one within 1400 px is kept as it came, byte for
//      byte (a PNG keeps its transparency); the same file twice is one record;
//      a file that is not a picture, or one the browser cannot open, is named
//      in the note and the rest still go in, in the order picked.
//   4. The projected card and the printed cards draw from object URLs, the
//      pin still works, and Print waits for every picture to load.
//   5. A `src` that is not a real picture — a crafted value a hand-edited key
//      or a restored backup could carry — never reaches the page as markup.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period is not; one the list points at is not.
//   7. A picture whose record is gone says so on its thumbnail and in the
//      note, is never projected or printed, never leaves a broken <img>, and
//      is axe-clean in both themes.
//   8. With no IndexedDB, pictures stay inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8450;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/071-picture-prompt-generator.html';
const KEY = 'ppg_images_v1';
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

/* The list as 071 saved it before the move: RED twice (two entries, one
   picture), BLUE once, pins on two of them in two sets. */
const SEED_LIST = [
  { id: 'iRed1', src: RED, pinnedPrompts: { en: 'pA' } },
  { id: 'iBlue', src: BLUE, pinnedPrompts: {} },
  { id: 'iRed2', src: RED, pinnedPrompts: { es: 'pB' } },
];
const SEED = {
  [KEY]: SEED_LIST,
  ppg_prompt_sets_v1: { v: 1, activeId: 'en', sets: [
    { id: 'en', name: 'English', starter: 'en', prompts: [{ id: 'pA', text: 'Describe the market.' }, { id: 'pC', text: 'Name five things.' }] },
    { id: 'es', name: 'Spanish', starter: 'es', prompts: [{ id: 'pB', text: 'Describe el mercado.' }] },
  ] },
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
page.on('dialog', d => d.accept().catch(() => {}));

const list = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const rawList = p => p.evaluate(k => localStorage.getItem(k), KEY);
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^ppg_/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'ppg' }).list());
/* The srcs of the <img>s matching `sel`, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
/* The stub records, at the moment print() is called, whether every printed
   picture had loaded — checking afterwards would pass a print that did not wait. */
const stubPrint = p => p.evaluate(() => {
  window.__printCalls = 0;
  window.print = () => {
    window.__printCalls++;
    window.__printLoaded = Array.from(document.querySelectorAll('#printArea img')).every(e => e.complete && e.naturalWidth > 0);
  };
});
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__pictureImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
  await stubPrint(p);
};
const seed = (p, entries) => p.evaluate(s => {
  localStorage.clear();
  Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
}, entries);
const pick = (p, files) => p.setInputFiles('#imageInput', files);
/* Draws the picture behind `ref` and reports its size, its type as stored,
   and the pixel at (x, y). */
const probe = (p, ref, x = 2, y = 2) => p.evaluate(([r, px, py]) => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    res({ w: img.naturalWidth, h: img.naturalHeight, px: Array.from(g.getImageData(px, py, 1, 1).data) });
  };
  img.onerror = () => res(null);
  img.src = window.PicturePromptImage.url(r);
}), [ref, x, y]);
const makePng = (p, w, h) => p.evaluate(([w, h]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#1f3550';
  x.fillRect(Math.round(w / 4), Math.round(h / 4), Math.round(w / 2), Math.round(h / 2));   // a block on transparency
  return c.toDataURL('image/png').split(',')[1];
}, [w, h]).then(b => Buffer.from(b, 'base64'));

console.log('Picture-Prompt Generator — pictures in the media store');

/* ── 1. a list from before the move is migrated ───────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await seed(page, SEED);
await load(page);

let saved = await list(page);
eq(saved.length, 3, 'every entry is still in the list');
eq(saved.map(i => i.id).join(), 'iRed1,iBlue,iRed2', 'with its id, in its order');
const redRef = saved[0].src, blueRef = saved[1].src;
ok(REF.test(redRef), 'the first picture now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'a different picture gets a reference of its own');
eq(saved[2].src, redRef, 'the same picture on a second entry is the same reference');
eq(JSON.stringify(saved.map(i => i.pinnedPrompts)), JSON.stringify(SEED_LIST.map(i => i.pinnedPrompts)), 'every pin is untouched');
ok(!(await everyKey(page)).includes('data:image'), 'no ppg_ key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'picture-prompt-task-generator'), 'each with its type and its owner');
const thumbs = await srcsOf(page, '#thumbGrid img');
ok(thumbs.length === 3 && thumbs.every(s => /^blob:/.test(s)), 'the thumbnails draw from object URLs: ' + JSON.stringify(thumbs));
eq((await shownAs(page, '#thumbGrid img')).join(), [RED, BLUE, RED].join(), 'showing exactly the pictures they showed before the move');

/* ── 2. a reload reads them back ──────────────────────────────────────── */
const before2 = await rawList(page);
await load(page);
eq((await shownAs(page, '#thumbGrid img')).join(), [RED, BLUE, RED].join(), 'after a reload the pictures draw out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');
eq(await rawList(page), before2, 'and the key is not rewritten');

/* ── 3. uploads ───────────────────────────────────────────────────────── */
const bigPng = await makePng(page, 2800, 1400);
const smallPng = await makePng(page, 300, 200);
await pick(page, [
  { name: 'market.png', mimeType: 'image/png', buffer: bigPng },
  { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a picture') },
  { name: 'phone.heic', mimeType: 'image/heic', buffer: Buffer.from('not decodable at all') },
  { name: 'sticker.png', mimeType: 'image/png', buffer: smallPng },
]);
await page.waitForFunction(() => document.querySelectorAll('#thumbGrid .thumb-wrap').length === 5, null, { timeout: 10000 });
await settle(page, 200);
saved = await list(page);
eq(saved.length, 5, 'the two pictures went in and the two other files did not');
const bigRef = saved[3].src, smallRef = saved[4].src;
ok(REF.test(bigRef) && REF.test(smallRef), 'both uploads are saved as references, in the order picked');
const note = await page.textContent('#shareNote');
ok(/notes\.txt” is not an image/.test(note), 'the note names the file that is not a picture: ' + JSON.stringify(note));
ok(/phone\.heic” could not be opened/.test(note), 'and the one this browser cannot open');
recs = await records(page);
const bigRec = recs.find(r => 'idb:' + r.id === bigRef);
const smallRec = recs.find(r => 'idb:' + r.id === smallRef);
eq(bigRec && bigRec.type, 'image/jpeg', 'a picture past 1400 px is stored as a JPEG, as downscaleDataUrl() made it');
const bigProbe = await probe(page, bigRef);
eq(bigProbe && `${bigProbe.w}x${bigProbe.h}`, '1400x700', 'at 1400 px on its long edge');
ok(bigProbe && bigProbe.px.slice(0, 3).every(v => v > 240), 'with white, not black, where it was transparent: ' + JSON.stringify(bigProbe && bigProbe.px));
console.log(`  (measured: the 2800×1400 test picture stores as ${bigRec && bigRec.size} bytes of JPEG)`);
eq(smallRec && smallRec.type, 'image/png', 'a picture within 1400 px is kept as it came');
eq(smallRec && smallRec.size, smallPng.length, 'byte for byte');
const smallProbe = await probe(page, smallRef);
eq(smallProbe && smallProbe.px[3], 0, 'so its transparent corner is still transparent');
ok(!(await everyKey(page)).includes('data:image'), 'and the key still carries no image bytes');

const nRecs = recs.length;
await pick(page, [{ name: 'sticker-again.png', mimeType: 'image/png', buffer: smallPng }]);
await page.waitForFunction(() => document.querySelectorAll('#thumbGrid .thumb-wrap').length === 6, null, { timeout: 10000 });
await settle(page, 200);
saved = await list(page);
eq(saved[5].src, smallRef, 'the same file uploaded again is the same reference');
eq((await records(page)).length, nRecs, 'and adds no record');

/* ── 4. the projected card, the pin and the printed cards ─────────────── */
await page.click('#newImageBtn');
await settle(page, 150);
const stageSrc = await srcsOf(page, '#stageCard img');
ok(stageSrc.length === 1 && /^blob:/.test(stageSrc[0]), 'the projected picture draws from an object URL');
/* The draw is random, and one seeded picture is already pinned in English,
   so the click is checked as a toggle from whatever it started as. */
const wasPinned = /Pinned/.test(await page.textContent('#pinPromptBtn'));
await page.click('#pinPromptBtn');
await settle(page, 100);
eq(/Pinned/.test(await page.textContent('#pinPromptBtn')), !wasPinned, 'the pin still toggles on a stored picture');
ok((await list(page)).every(i => REF.test(i.src)), 'and pinning wrote back references, not bytes');
await page.click('#printBtn');
await page.waitForFunction(() => window.__printCalls === 1, null, { timeout: 5000 });
const printed = await srcsOf(page, '#printArea img');
ok(printed.length === 6 && printed.every(s => /^blob:/.test(s)), 'Print puts every picture on a card, from object URLs');
eq(await page.evaluate(() => window.__printLoaded), true, 'and every one had loaded when print() was called');

/* ── 5. a crafted src never reaches markup ────────────────────────────── */
await page.evaluate(k => {
  const l = JSON.parse(localStorage.getItem(k));
  l.push({ id: 'x" onmouseover="window.__pwned=3', src: 'data:image/png;base64,AAAA" onerror="window.__pwned=1', pinnedPrompts: {} });
  l.push({ id: 'iJs', src: 'javascript:window.__pwned=2', pinnedPrompts: {} });
  localStorage.setItem(k, JSON.stringify(l));
}, KEY);
await load(page);
eq(await page.evaluate(() => window.__pwned), undefined, 'a crafted src or id never ran');
eq(await page.$$eval('[onerror], [onmouseover]', els => els.length), 0, 'and never became an attribute');
eq((await srcsOf(page, '#thumbGrid img')).length, 6, 'only the six real pictures are drawn');
eq(await page.locator('#thumbGrid .thumb-missing').count(), 2, 'the two crafted entries show as missing pictures');
let projectedCrafted = null;
for (let n = 0; n < 12 && !projectedCrafted; n++) {
  await page.click('#newImageBtn');
  const s = await srcsOf(page, '#stageCard img');
  if (!(s.length === 1 && /^blob:/.test(s[0]))) projectedCrafted = s;
}
ok(!projectedCrafted, 'twelve draws only ever projected stored pictures: ' + JSON.stringify(projectedCrafted));
/* Clear the crafted entries through the page, as a teacher would. */
for (let n = 0; n < 2; n++) {
  await page.locator('#thumbGrid .thumb-wrap').filter({ has: page.locator('.thumb-missing') }).first().locator('.del').click();
  await settle(page, 100);
}
eq((await list(page)).length, 6, 'the × removes a missing picture from the list');

/* ── 6. orphans are collected on the next load, and only orphans ──────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'ppg' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'ppg/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
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
      if (/^ppg\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); }
    });
    t.oncomplete = () => { req.result.close(); res(); };
  };
}));
/* Delete the big upload through the page: its record is now an orphan. */
await page.locator(`#thumbGrid .thumb-wrap[data-id="${saved[3].id}"] .del`).click();
await settle(page, 100);
const before6 = (await records(page)).map(r => r.id);
ok(before6.includes('old-orphan') && before6.includes('fresh-orphan') && before6.includes(bigRef.slice(4)),
  'three unreferenced records are there before the reload');
await load(page);
const after6 = (await records(page)).map(r => r.id);
ok(!after6.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(!after6.includes(bigRef.slice(4)), 'and so is a deleted thumbnail\'s picture');
ok(after6.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok([redRef, blueRef, smallRef].every(r => after6.includes(r.slice(4))), 'and every one the list points at survives');

/* ── 7. a picture with nothing behind it ──────────────────────────────── */
await page.evaluate(([k, gone]) => {
  const l = JSON.parse(localStorage.getItem(k));
  l[1].src = gone;
  localStorage.setItem(k, JSON.stringify(l));
}, [KEY, GONE]);
await load(page);
eq((await list(page))[1].src, GONE, 'the dangling reference is left in place (the picture might come back in a restore)');
eq((await srcsOf(page, '#thumbGrid img')).length, 4, 'the thumbnails draw only the pictures that are there');
ok(/Picture missing from this browser/.test(await page.locator('#thumbGrid .thumb-wrap').nth(1).textContent()),
  'and the gone one says so on its tile');
ok(/1 saved picture is missing/.test(await page.textContent('#shareNote')),
  'and the note says so: ' + JSON.stringify(await page.textContent('#shareNote')));
let projectedGone = false;
for (let n = 0; n < 12; n++) {
  await page.click('#newImageBtn');
  const s = await srcsOf(page, '#stageCard img');
  if (!(s.length === 1 && /^blob:/.test(s[0]))) projectedGone = true;
}
ok(!projectedGone, 'twelve draws never project the missing picture');
eq(await page.textContent('#usedHint').then(t => /of 4 images/.test(t)), true, 'and the round counts only the four that can be shown');
await page.click('#printBtn');
await page.waitForFunction(() => window.__printCalls === 1, null, { timeout: 5000 });
eq((await srcsOf(page, '#printArea img')).length, 4, 'Print leaves the missing picture off the cards');
eq(await page.$$eval('img', els => els.filter(e => !e.getAttribute('src')).length), 0, 'no <img> anywhere is left without a picture');
const SCOPE = '#shareNote, #thumbGrid, #stageCard';
const lightV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(lightV.length, 0, 'the missing-picture state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(darkV.length, 0, 'and in dark theme: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* Every picture gone: the stage says why rather than asking for an upload. */
await page.evaluate(([k, gone]) => {
  const l = JSON.parse(localStorage.getItem(k));
  l.forEach(i => { i.src = gone; });
  localStorage.setItem(k, JSON.stringify(l));
}, [KEY, GONE]);
await load(page);
await page.click('#newImageBtn');
ok(/None of the saved pictures is in this browser/.test(await page.textContent('#stageCard')),
  'with every picture gone, the stage says so');

/* ── 8. with no IndexedDB, pictures stay inline, as before ────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1280, height: 900 });
noIdb.on('dialog', d => d.accept().catch(() => {}));
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, SEED);
await load(noIdb);
eq((await shownAs(noIdb, '#thumbGrid img')).join(), [RED, BLUE, RED].join(), 'inline pictures still draw when there is nowhere to move them');
eq((await list(noIdb)).map(i => i.src).join(), [RED, BLUE, RED].join(), 'and stay inline in the key');
await pick(noIdb, [{ name: 'sticker.png', mimeType: 'image/png', buffer: smallPng }]);
await noIdb.waitForFunction(() => document.querySelectorAll('#thumbGrid img').length === 4, null, { timeout: 5000 });
ok(/^data:image\/png;base64,/.test((await list(noIdb))[3].src || ''), 'a new upload is saved inline, as before Path 4 P4, rather than lost');
ok(!/missing/.test(await noIdb.textContent('#shareNote')), 'and nothing is reported missing');
await noIdb.click('#newImageBtn');
ok(/^data:image\//.test((await srcsOf(noIdb, '#stageCard img'))[0] || ''), 'and the stage projects it');

/* ── 9. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
