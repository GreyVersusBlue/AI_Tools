// smoke-photo-store.mjs — the Trading Card Maker's card photos, in IndexedDB.
//
//   node Tools/historical-trading-card-maker/test/smoke-photo-store.mjs
//
// Path 4 P4 moved 064's card photos out of localStorage — out of every saved
// deck (`htcm:data:<name>`, each card's `image.src`) — and into the shared
// media store (_shared/media-db.js, `gvb-media`, namespace `htcm`), and
// deleted htcm-image.js's own downscaler. `image` is still an object; only
// `src` changed, and it now holds `idb:<id>`, where the id is the stored
// image's hash. What a teacher could lose in that move is asserted here, in a
// real browser with a real IndexedDB:
//
//   1. Decks saved BEFORE the move (data: URL photos, the open one and one
//      that is not) are migrated on load; the keys lose the image bytes but
//      keep crop, shape and filter; a deck with no photo is written back
//      byte-identical; the legacy htcm_cards_v2 key is not touched; each
//      distinct photo is stored once; the list, the preview and the print run
//      draw the same photo from an object URL, and print waits for it; the
//      PNG/PDF canvas export draws it too.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 1000 px JPEG on a
//      white mat, as readAndDownscale() always stored; a renamed deck shares
//      the records rather than copying them.
//   4. The share sheet's downloaded file is portable (data: URLs, no `idb:`),
//      and the link still carries no photo.
//   5. A link arrival keeps only a real inline photo (stored by the boot
//      pass); an `idb:` reference or a crafted value is dropped.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by a deck that is not open, is not.
//   7. A photo whose image is gone says so in the list and in a note, is
//      never a broken <img>, leaves the card's window empty in print (and a
//      canvas export still finishes), is
//      axe-clean in both themes, and Print still reaches window.print(). A
//      crafted value in a saved key never reaches the page as markup.
//   8. With no IndexedDB, photos stay inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8452;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';
const DATA = 'htcm:data:';
const REF = /^idb:h[0-9a-f]{32}$/;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* Three real 1x1 PNGs, different pixels, so "the same photo" is checkable. */
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==';
const BLUE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQsLnzHwAEEAJArJfb0AAAAABJRU5ErkJggg==';
/* Only ever on a deck that is not open at load, so switching to it has to read it. */
const GREEN = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgWGDwHwADRAHQpnV64gAAAABJRU5ErkJggg==';
const GONE = 'idb:h0000000000000000000000000000dead';
const CRAFTED = 'data:image/png;base64,AAAA" onerror="window.__pwned=1';

const photo = (src, extra = {}) => ({ src, w: 1, h: 1, crop: { x: 0.25, y: 0.75, scale: 2 }, shape: 'shield', filter: 'sepia', ...extra });
const card = (id, name, image) => ({
  id, name, image, stats: [{ label: 'Born', value: '1800' }], facts: ['A fact.'],
  meta: { rarity: 'common', setName: '', cardNo: 0, setSize: 0, stars: 0 }, theme: null,
});
const deck = cards => ({ v: 2, cards, settings: { size: 'standard', theme: 'classic' } });
/* Decks saved the way 064 saved them before the move: RED on both Rome (open)
   and Greece (not open), BLUE on Rome only, GREEN on Greece only, and one deck
   with no photo, which must come through byte for byte. */
const SEED = {
  'htcm:list': ['Rome', 'Greece', 'Plain'],
  'htcm:current': 'Rome',
  [DATA + 'Rome']: deck([card('a', 'Augustus', photo(RED)), card('b', 'Livia', photo(BLUE)), card('c', 'Nero', null)]),
  [DATA + 'Greece']: deck([card('d', 'Pericles', photo(RED)), card('e', 'Sappho', photo(GREEN))]),
  [DATA + 'Plain']: deck([card('f', 'Hannibal', null)]),
  'htcm_cards_v2': deck([card('g', 'Legacy', photo(RED))]),
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept().catch(() => {}));

const stored = (p, name) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + name);
const rawStored = (p, key) => p.evaluate(k => localStorage.getItem(k), key);
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'htcm' }).list());
const srcs = d => d.cards.map(c => (c.image ? c.image.src : null));
const asDataUrl = (p, src) => p.evaluate(s => fetch(s).then(r => r.blob()).then(b => new Promise(res => {
  const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
})), src);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
const shownAs = async (p, sel) => Promise.all((await srcsOf(p, sel)).map(s => asDataUrl(p, s)));
/* window.print() is stubbed; it records whether every printed photo had
   loaded at the moment it was called, which is what the print-wait is for. */
const stubPrint = p => p.evaluate(() => {
  window.__printCalls = 0; window.__printReady = [];
  window.print = () => {
    window.__printCalls++;
    window.__printReady.push(Array.from(document.querySelectorAll('#printArea img')).every(e => e.complete && e.naturalWidth > 0));
  };
});
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__photosSettled === true, null, { timeout: 8000 });
  await settle(p, 200);
  await stubPrint(p);
};
const seed = (p, entries) => p.evaluate(e => {
  localStorage.clear();
  Object.keys(e).forEach(k => localStorage.setItem(k, typeof e[k] === 'string' ? e[k] : JSON.stringify(e[k])));
}, entries);
const printed = async (p) => {
  await p.click('#printBtn');
  await p.waitForFunction(() => window.__printCalls > 0, null, { timeout: 5000 });
  return p.evaluate(() => window.__printReady[window.__printReady.length - 1]);
};

console.log('Trading Card Maker — card photos in the shared media store');

/* ── 1. decks saved before the move are migrated on load ──────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(() => new Promise(res => { const r = indexedDB.deleteDatabase('gvb-media'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
await seed(page, SEED);
await load(page);

const rome = await stored(page, 'Rome');
const greece = await stored(page, 'Greece');
ok(srcs(rome).slice(0, 2).every(s => REF.test(s)), 'the open deck\'s photos are now references: ' + JSON.stringify(srcs(rome)));
eq(srcs(rome)[2], null, 'a card with no photo still has none');
ok(srcs(greece).every(s => REF.test(s)), 'a deck that is not open is migrated too');
eq(srcs(greece)[0], srcs(rome)[0], 'the same photo in two decks is one reference');
const ra = rome.cards[0].image;
eq(JSON.stringify([ra.crop, ra.shape, ra.filter, ra.w, ra.h]), JSON.stringify([{ x: 0.25, y: 0.75, scale: 2 }, 'shield', 'sepia', 1, 1]),
  'crop, shape, filter and size stay in the deck');
ok(!(await rawStored(page, DATA + 'Rome')).includes('base64') && !(await rawStored(page, DATA + 'Greece')).includes('base64'),
  'the keys no longer hold image bytes');
eq(await rawStored(page, DATA + 'Plain'), JSON.stringify(SEED[DATA + 'Plain']), 'a deck with no photo is not rewritten');
eq(await rawStored(page, 'htcm_cards_v2'), JSON.stringify(SEED.htcm_cards_v2), 'the legacy backup key is left alone');
eq((await records(page)).length, 3, 'three distinct photos, three records');

const thumbs = await srcsOf(page, '.entry-row img.thumb');
ok(thumbs.length === 2 && thumbs.every(s => /^blob:/.test(s)), 'the card list draws both photos from object URLs');
eq((await shownAs(page, '.entry-row img.thumb')).join(), [RED, BLUE].join(), 'and they are the same pictures');
ok(!(await page.evaluate(() => document.querySelector('.entry-row').textContent)).includes('KB photo'),
  'a stored photo is not sized as localStorage cost');
await page.click('.entry-row[data-id="a"] .info');
await settle(page, 150);
eq((await shownAs(page, '#previewFront .pwin img')).join(), RED, 'the preview draws the photo');
ok(await printed(page), 'print waits until every printed photo has loaded');
eq((await shownAs(page, '#printArea .pwin img')).join(), [RED, BLUE].join(), 'and prints both photos');
ok(await page.isHidden('#photoNote'), 'nothing is reported missing');
/* PNG/PDF/zip export draws the stored photo onto a canvas from its object URL. */
const exported = await page.evaluate(() => new Promise(res => {
  const e = JSON.parse(localStorage.getItem('htcm:data:Rome')).cards[0];
  e.image.shape = 'rrect'; e.image.filter = 'none';
  window.HtcmExport.renderCardCanvas(e, 'front', { theme: 'classic' }, canvas => {
    res(Array.from(canvas.getContext('2d').getImageData(375, 245, 1, 1).data));
  });
}));
ok(exported[0] > 200 && exported[1] < 60 && exported[2] < 60, 'the canvas export draws the stored photo: ' + exported);

/* ── 2. a reload reads them back and stores nothing twice ─────────────── */
const before = await rawStored(page, DATA + 'Rome');
await load(page);
eq(await rawStored(page, DATA + 'Rome'), before, 'a reload does not rewrite the migrated deck');
eq((await records(page)).length, 3, 'and stores nothing twice');
eq((await shownAs(page, '.entry-row img.thumb')).join(), [RED, BLUE].join(), 'and the photos are read back');

/* ── 3. an upload goes through MediaDB.downscaleImage ─────────────────── */
const bigPng = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1600;
  const x = c.getContext('2d');
  x.fillStyle = '#1f3550';
  x.fillRect(600, 400, 1200, 800);      // a navy block on transparency
  return c.toDataURL('image/png').split(',')[1];
});
await page.fill('#newName', 'Cicero');
await page.setInputFiles('#newImage', { name: 'cicero.png', mimeType: 'image/png', buffer: Buffer.from(bigPng, 'base64') });
await page.waitForFunction(() => /^blob:/.test((document.querySelector('#previewFront .pwin img') || {}).src || ''), null, { timeout: 10000 });
await page.click('#addEntryBtn');
await settle(page, 200);
const up = (await stored(page, 'Rome')).cards[3].image;
ok(REF.test(up.src), 'the upload is saved as a reference');
eq(`${up.w}x${up.h}`, '1000x667', 'downscaled to 1000 px on the long edge, and its size recorded');
const upInfo = await page.evaluate(id => window.MediaDB.store({ ns: 'htcm' }).getBlob(id).then(b => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    res({ type: b.type, w: img.width, corner: Array.from(x.getImageData(2, 2, 1, 1).data.slice(0, 3)) });
  };
  img.src = URL.createObjectURL(b);
})), up.src.slice(4));
eq(upInfo.type, 'image/jpeg', 'as a JPEG');
ok(upInfo.corner.every(v => v > 240), 'with white, not black, where the PNG was transparent: ' + upInfo.corner);
eq((await records(page)).length, 4, 'one new record');
await page.evaluate(() => { window.prompt = () => 'Rome copy'; });
await page.click('#renameDeckBtn');
await settle(page, 200);
eq(srcs(await stored(page, 'Rome copy')).join(), srcs(rome).slice(0, 2).concat([null, up.src]).join(), 'a renamed deck keeps the same references');
eq((await records(page)).length, 4, 'and copies nothing');

/* ── 4. the share sheet's file is portable; the link carries no photo ─── */
await page.evaluate(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
  });
});
await page.click('#shareBtn');
await page.waitForSelector('.share-sheet button[data-share="download"]');
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.share-sheet button[data-share="download"]'),
]);
const fileText = await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8');
const file = JSON.parse(fileText);
ok(!fileText.includes('idb:'), 'no reference reaches the downloaded file');
eq(srcs(file.state).slice(0, 2).join(), [RED, BLUE].join(), 'it carries the photos byte for byte');
eq(file.state.cards[0].image.shape, 'shield', 'with their framing');
await page.click('.share-sheet button[data-share="copy"]');
await settle(page, 150);
const link = await page.evaluate(() => window.__copied);
ok(link && !link.includes('idb') && link.length < 4000, 'the link carries neither a photo nor a reference');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 5. a link keeps only a real inline photo ─────────────────────────── */
const arrivalUrl = await page.evaluate(([u, r, c]) => u + '?deck=' + window.StateLink.encodeState({
  v: 1, name: 'Arrival', settings: { size: 'standard', theme: 'classic' },
  cards: [
    { id: 'x1', name: 'Foreign ref', image: { src: 'idb:h1111111111111111111111111111beef', w: 1, h: 1 }, stats: [], facts: [] },
    { id: 'x2', name: 'Inline', image: { src: r, w: 1, h: 1 }, stats: [], facts: [] },
    { id: 'x3', name: 'Crafted', image: { src: c, w: 1, h: 1 }, stats: [], facts: [] },
  ],
}), [URL_PAGE, RED, CRAFTED]);
await load(page, arrivalUrl);
const arrived = await stored(page, 'Arrival');
eq(arrived.cards[0].image, null, 'an idb: reference in a link is dropped — it names the sender\'s photo');
eq(arrived.cards[1].image && arrived.cards[1].image.src, srcs(rome)[0], 'an inline photo is kept, and the boot pass stores it (the same record)');
eq(arrived.cards[2].image, null, 'a value that only starts like an image is dropped');
ok(/its photo came with it/.test(await page.textContent('#shareNote')), 'and the note says the photo came');
eq(await page.evaluate(() => window.__pwned), undefined, 'nothing crafted reached the page as markup');

/* ── 6. orphans are collected on the next load, and only orphans ──────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'htcm' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'htcm/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
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
      if (/^htcm\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); }
    });
    t.oncomplete = () => { req.result.close(); res(); };
  };
}));
/* Drop the upload from every deck, so its record is an orphan; then make
   Greece the open deck, so BLUE is held only by a deck that is not open. */
await page.evaluate(ref => {
  ['Rome copy'].forEach(n => {
    const d = JSON.parse(localStorage.getItem('htcm:data:' + n));
    d.cards = d.cards.filter(c => !(c.image && c.image.src === ref));
    localStorage.setItem('htcm:data:' + n, JSON.stringify(d));
  });
  localStorage.setItem('htcm:current', 'Greece');
}, up.src);
await load(page);
const ids = (await records(page)).map(r => r.id).sort();
ok(!ids.includes('old-orphan'), 'an old orphan is deleted');
ok(ids.includes('fresh-orphan'), 'one younger than the grace period is not');
ok(!ids.includes(up.src.slice(4)), 'a photo no deck holds any more is deleted');
ok(ids.includes(srcs(rome)[1].slice(4)), 'a photo held only by a deck that is not open is kept');
eq(ids.length, 4, 'and nothing else changes: ' + ids.join());
eq((await shownAs(page, '.entry-row img.thumb')).join(), [RED, GREEN].join(), 'the open deck draws its photos');
await page.selectOption('#deckSelect', 'Rome copy');
await page.waitForFunction(() => document.querySelectorAll('.entry-row img.thumb').length === 2, null, { timeout: 5000 });
eq((await shownAs(page, '.entry-row img.thumb')).join(), [RED, BLUE].join(), 'switching decks reads the other deck\'s photos');

/* ── 7. a photo whose image is gone ───────────────────────────────────── */
await page.evaluate(([k, gone, crafted]) => {
  const d = JSON.parse(localStorage.getItem(k));
  d.cards[1].image.src = gone;
  d.cards.push({ id: 'z', name: 'Crafted', image: { src: crafted, w: 1, h: 1 }, stats: [], facts: [], meta: {}, theme: null });
  localStorage.setItem(k, JSON.stringify(d));
  localStorage.setItem('htcm:current', 'Rome copy');
}, [DATA + 'Rome copy', GONE, CRAFTED]);
await load(page);
ok(await page.isVisible('#photoNote'), 'a missing photo is reported');
ok(/1 photo in “Rome copy” is missing/.test(await page.textContent('#photoNote')), 'by count and deck: ' + await page.textContent('#photoNote'));
ok(/photo missing from this browser/.test(await page.textContent('.entry-row[data-id="b"]')), 'and on its card in the list');
eq(await page.$$eval('.entry-row img.thumb', els => els.length), 1, 'no thumbnail is drawn for it, or for the crafted value');
ok(await printed(page), 'Print still reaches window.print()');
eq(await page.$$eval('#printArea .pwin', els => els.length), 3, 'the missing and crafted photos keep their windows in print');
eq(await page.$$eval('#printArea .pwin img', els => els.length), 1, 'but draw nothing in them — no broken <img>');
eq(await page.evaluate(() => window.__pwned), undefined, 'a crafted value in a saved key never reaches the page as markup');
const goneExport = await page.evaluate(g => new Promise(res => {
  const e = JSON.parse(localStorage.getItem('htcm:data:Rome copy')).cards[1];
  e.image.src = g; e.image.shape = 'rrect'; e.image.filter = 'none';
  const t = setTimeout(() => res('hung'), 5000);
  window.HtcmExport.renderCardCanvas(e, 'front', { theme: 'classic' }, canvas => { clearTimeout(t); res(canvas.width); });
}), GONE);
eq(goneExport, 750, 'the canvas export of a card whose photo is gone still finishes');
const noteV = await a11yScan(page, { impact: 'serious', include: '#photoNote' });
eq(noteV.length, 0, 'the missing-photo note passes axe: ' + JSON.stringify(noteV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const noteDarkV = await a11yScan(page, { impact: 'serious', include: '#photoNote' });
eq(noteDarkV.length, 0, 'and in dark theme: ' + JSON.stringify(noteDarkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

/* ── 8. with no IndexedDB, photos stay inline, as before ──────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1400, height: 1000 });
noIdb.on('dialog', d => d.accept().catch(() => {}));
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, { 'htcm:list': ['Rome'], 'htcm:current': 'Rome', [DATA + 'Rome']: SEED[DATA + 'Rome'] });
await load(noIdb);
eq((await srcsOf(noIdb, '.entry-row img.thumb')).join(), [RED, BLUE].join(), 'an inline photo still draws when there is nowhere to move it');
eq(srcs(await stored(noIdb, 'Rome')).join(), [RED, BLUE, null].join(), 'and stays inline in the key');
ok(/KB photo/.test(await noIdb.textContent('.entry-row')), 'the list still sizes an inline photo, since it still costs localStorage');
await noIdb.fill('#newName', 'Cicero');
await noIdb.setInputFiles('#newImage', { name: 'cicero.png', mimeType: 'image/png', buffer: Buffer.from(bigPng, 'base64') });
await noIdb.waitForFunction(() => /^data:image\/jpeg/.test((document.querySelector('#previewFront .pwin img') || {}).src || ''), null, { timeout: 10000 });
await noIdb.click('#addEntryBtn');
await settle(noIdb, 200);
ok(/^data:image\/jpeg/.test(srcs(await stored(noIdb, 'Rome'))[3] || ''), 'a new upload is saved inline (a JPEG), as before Path 4 P4, rather than lost');
ok(await noIdb.isHidden('#photoNote'), 'and nothing is reported missing');

/* ── 9. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
