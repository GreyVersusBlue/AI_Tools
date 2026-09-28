// smoke-images.mjs — the Escape Room Builder's clue images, in IndexedDB.
//
//   node Tools/escape-room-builder/test/smoke-images.mjs
//
// Path 4 P4 moved 019's station images out of its one localStorage key and into
// the shared media store (_shared/media-db.js, `gvb-media`, namespace
// `escape-room`). A station now holds `idb:<id>`. Everything a teacher or a
// student could lose in that move is asserted here, in a real browser with a
// real IndexedDB:
//
//   1. Rooms saved BEFORE the move (data: URL images, several rooms) are
//      migrated on load: the key loses the image bytes, the store gains one
//      record per distinct image, and the station shows the same picture.
//   2. The student link — which lock.html reads on a phone that has never seen
//      this browser — still carries the image as a data URL, and lock.html
//      draws it. So do the test run and the printed packet.
//   3. A reload reads the pictures back out of the store.
//   4. An image added through the picker goes straight to the store, at the
//      320 px it always had; its size is printed, because the choice of a
//      data-URL cache over object URLs rests on it.
//   5. The share sheet's download is portable (data: URLs, no `idb:`) and the
//      link still strips and counts the images.
//   6. A room arriving by link with an inline image is moved into the store;
//      an `idb:` reference arriving by link is dropped, never trusted.
//   7. An orphaned record is deleted on the next load; one younger than the
//      grace period, or still referenced by ANY saved room, is not.
//   8. A reference whose image is gone is shown as missing and said so (axe-
//      clean in both themes), and the student link leaves it out rather than
//      carrying a dead reference.
//   9. With no IndexedDB at all, a new image is kept the old way, inline.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8239;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/019-escape-room-builder.html';
const KEY = 'escape-room-builder:rooms';

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

const station = (clue, answers, image) => ({
  clue, answers, hint: '', next: null, image, type: 'text', hintCost: 0, awardLetter: '',
  cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null,
});
const room = (name, roomId, stations) => ({
  name, roomId, stations, cardsPerPage: '4', ecLevel: 'Q', showNumber: true, randomizeStart: false,
  countdownEnabled: false, countdownMinutes: 20, storyIntro: '', packetCardsPerPage: '2',
});
/* The bare {current, sets} shape 019 wrote before it adopted Store — the oldest
   rooms on disk — with the same image on two rooms and a second one besides. */
const LEGACY = {
  current: 'Vault of Ur',
  sets: {
    'Vault of Ur': room('Vault of Ur', 'vaultur001', [
      station('What river runs past the ziggurat?', 'euphrates', RED),
      station('Count the gate towers.', '4', ''),
      station('Name the king on the stele.', 'hammurabi', BLUE),
    ]),
    'Silk Road Stop': room('Silk Road Stop', 'silkroad01', [
      station('Which city is the oasis?', 'dunhuang', RED),
    ]),
  },
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const saved = async p => {
  const raw = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
  return raw && raw.data && !raw.sets ? raw.data : raw;
};
const rawSaved = p => p.evaluate(k => localStorage.getItem(k) || '', KEY);
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'escape-room' }).list());
const thumbSrc = (p, idx) => p.evaluate(i => {
  const img = document.querySelector(`.station-card[data-idx="${i}"] .station-image-thumb img`);
  return img ? img.getAttribute('src') : null;
}, idx);
/* The room lock.html gets, decoded the way lock.html decodes it. */
const playerRoom = p => p.evaluate(() => {
  const url = new URL(document.getElementById('playerLink').value);
  return JSON.parse(decodeURIComponent(escape(atob(url.searchParams.get('r')))));
});
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__escapeImagesSettled === true, null, { timeout: 8000 });
  await settle(p, 300);   // render() is debounced 150 ms
};

console.log('Escape Room Builder — clue images in the media store');

/* ── 1. rooms from before the move are migrated on load ────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, LEGACY]);
await load(page);

let s = await saved(page);
const ur = s.sets['Vault of Ur'].stations;
const silk = s.sets['Silk Road Stop'].stations;
ok(/^idb:[A-Za-z0-9_-]+$/.test(ur[0].image), 'the current room\'s station now holds an idb: reference: ' + JSON.stringify(ur[0].image));
ok(/^idb:/.test(silk[0].image), 'and so does a room that is not open: ' + JSON.stringify(silk[0].image));
eq(silk[0].image, ur[0].image, 'the same picture in two rooms is stored once and shared');
ok(/^idb:/.test(ur[2].image) && ur[2].image !== ur[0].image, 'a different picture gets a reference of its own');
eq(ur[1].image, '', 'a station with no image still has none');
ok(!(await rawSaved(page)).includes('data:image'), 'the localStorage key no longer carries any image bytes');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct image');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'escape-room-builder'), 'each with its type and its owner');
eq(await thumbSrc(page, 0), RED, 'the station shows exactly the picture it showed before the move');
eq(await thumbSrc(page, 2), BLUE, 'and so does the other one');

/* ── 2. the student link, the test run and the packet still carry it ───── */
let pr = await playerRoom(page);
eq(pr.stations[0].image, RED, 'the student link carries the image as a data URL, not a reference');
eq(pr.stations[2].image, BLUE, 'every image, in its station');
ok(!(await page.inputValue('#playerLink')).includes('idb'), 'no idb: reference ever reaches a student link');
eq(pr.stations[1].image, undefined, 'a station without one still omits the field');

const lock = await prepPage(browser, BASE, { width: 420, height: 900 });
await lock.goto(await page.inputValue('#playerLink'), { waitUntil: 'load' });
await settle(lock, 300);
eq(await lock.evaluate(() => { const i = document.querySelector('img.clue-image'); return i && i.getAttribute('src'); }), RED,
  'lock.html, on a device with none of this browser\'s storage, draws the clue image');
await lock.close();

await page.click('#testRunBtn');
await settle(page, 200);
eq(await page.evaluate(() => { const i = document.querySelector('#testRunBody img.tr-img'); return i && i.getAttribute('src'); }), RED,
  'the teacher test run shows the image');
await page.click('#testRunClose');
await page.evaluate(() => { window.print = () => {}; });
await page.click('#printPacketBtn');
await settle(page, 200);
const packetSrcs = await page.$$eval('#packetCardsGrid img.pc-img', els => els.map(e => e.getAttribute('src')));
ok(packetSrcs.length === 2 && packetSrcs[0] === RED && packetSrcs[1] === BLUE,
  'the printed packet shows both images: ' + JSON.stringify(packetSrcs.map(x => x.slice(0, 30))));

/* ── 3. a reload reads them back ───────────────────────────────────────── */
await load(page);
eq(await thumbSrc(page, 0), RED, 'after a reload the station draws its image out of IndexedDB');
eq((await playerRoom(page)).stations[2].image, BLUE, 'and the student link is built with it');
eq((await records(page)).length, 2, 'and nothing was stored twice');

/* ── 4. an image added through the picker goes straight to the store ───── */
/* A realistic photo: 1200×900 of noise, which JPEG compresses worst. */
const photo = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 900;
  const x = c.getContext('2d');
  const d = x.createImageData(1200, 900);
  let seed = 7;
  for (let i = 0; i < d.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d.data[i] = seed & 255; d.data[i + 1] = (seed >> 8) & 255; d.data[i + 2] = (seed >> 16) & 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
});
await page.setInputFiles('.station-card[data-idx="1"] input.f-image',
  { name: 'gate.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
await page.waitForFunction(() => !!document.querySelector('.station-card[data-idx="1"] .station-image-thumb img'), null, { timeout: 5000 });
await settle(page, 300);
s = await saved(page);
const ref1 = s.sets['Vault of Ur'].stations[1].image;
ok(/^idb:/.test(ref1), 'the new image is saved as a reference: ' + JSON.stringify(ref1));
ok(!(await rawSaved(page)).includes('data:image'), 'and the key still carries no image bytes');
recs = await records(page);
eq(recs.length, 3, 'the store now holds three records');
const added = recs.find(r => 'idb:' + r.id === ref1);
ok(added && added.type === 'image/jpeg', 'stored as the downscaled JPEG');
const dims = await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = src; }),
  await thumbSrc(page, 1));
eq(dims.join('x'), '320x240', 'at the 320 px long edge the inline downscaler used');
console.log(`  (a 1200×900 noise photo stores as ${added && added.size} bytes; ` +
  `${Math.round(((await thumbSrc(page, 1)) || '').length / 1024)} KB as the data URL a link carries)`);
ok(added && added.size < 120 * 1024, 'a worst-case photo stays small enough to hold as a data URL in memory');

/* ── 5. the share sheet: a portable file, and a link without images ────── */
await page.click('#shareBtn');
await page.waitForSelector('.share-sheet', { timeout: 3000 });
const note = await page.textContent('.share-sheet');
ok(/3 images are left out of the link/.test(note), 'the sheet still counts the images it strips from the link: ' + JSON.stringify(note.slice(0, 400)));
const exported = await page.evaluate(() => {
  let text = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
  document.querySelector('.share-sheet [data-share="download"]').click();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 300));
});
ok(exported && !exported.includes('idb:'), 'the downloaded file carries no idb: reference');
const fileState = exported ? JSON.parse(exported).state : {};
eq(fileState.stations && fileState.stations[0].image, RED, 'it carries the migrated image byte for byte');
ok(/^data:image\/jpeg/.test(fileState.stations && fileState.stations[1].image || ''), 'and the new one as a data URL');
eq((await saved(page)).sets['Vault of Ur'].stations[0].image, ur[0].image, 'sharing did not rewrite the saved room');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 6. a room arriving by link ────────────────────────────────────────── */
const arrival = await page.evaluate(([red]) => window.StateLink.buildShareUrl('room', {
  name: 'Lighthouse Trail', stations: [
    { clue: 'What does the keeper light?', answers: 'lamp', image: red },
    { clue: 'Which way is north?', answers: 'up', image: 'idb:someoneelses' },
  ],
}), [RED]);
await load(page, arrival);
s = await saved(page);
const lh = s.sets['Lighthouse Trail'];
ok(lh && /^idb:/.test(lh.stations[0].image), 'an inline image arriving by link is moved into the store: ' + JSON.stringify(lh && lh.stations[0].image));
eq(lh && lh.stations[0].image, ur[0].image, 'and, being the same picture, reuses the record already there');
eq(lh && lh.stations[1].image, '', 'a reference arriving by link is dropped — it would name this browser\'s images, not the sender\'s');
eq(await thumbSrc(page, 0), RED, 'the arrival shows its image');

/* ── 7. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'escape-room' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'escape-room/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
      t.oncomplete = () => { req.result.close(); res(); };
      t.onerror = () => rej(t.error);
    };
  }));
});
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
await load(page);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
s = await saved(page);
const allRefs = Object.values(s.sets).flatMap(r => r.stations.map(x => x.image)).filter(Boolean);
ok(allRefs.length >= 5 && allRefs.every(x => after.includes(x.slice(4))),
  'every image any saved room points at survives, open or not: ' + JSON.stringify(allRefs));

/* ── 8. a reference with nothing behind it says so ─────────────────────── */
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, {
  current: 'Vault of Ur',
  sets: { 'Vault of Ur': room('Vault of Ur', 'vaultur001', [
    station('What river runs past the ziggurat?', 'euphrates', 'idb:gone123'),
    station('Count the gate towers.', '4', ''),
  ]) },
}]);
await load(page);
eq(await thumbSrc(page, 0), null, 'a dangling reference draws no <img>');
ok(/Image missing/.test(await page.textContent('.station-card[data-idx="0"]')), 'the station says its image is missing');
ok(/Station 1’s image is no longer in this browser/.test(await page.textContent('#msg')),
  'and the message line says so: ' + JSON.stringify(await page.textContent('#msg')));
eq((await playerRoom(page)).stations[0].image, undefined, 'the student link leaves the lost image out instead of carrying a dead reference');
ok(await page.$('.station-card[data-idx="0"] [aria-label="Remove image for station 1"]'), 'the teacher can still remove the dead reference');
const missingViolations = await a11yScan(page, { impact: 'serious', include: '.station-card[data-idx="0"]' });
eq(missingViolations.length, 0, 'the missing-image state passes axe: ' + JSON.stringify(missingViolations.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkViolations = await a11yScan(page, { impact: 'serious', include: '.station-card[data-idx="0"]' });
eq(darkViolations.length, 0, 'and in dark theme: ' + JSON.stringify(darkViolations.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
await page.click('.station-card[data-idx="0"] [data-remove-image]');
await settle(page, 300);
eq(await page.textContent('#msg'), '', 'and once it is removed the message goes away');

/* ── 9. with no IndexedDB, a new image is kept the old way ─────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await noIdb.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, {
  current: 'Vault of Ur',
  sets: { 'Vault of Ur': room('Vault of Ur', 'vaultur001', [
    station('What river runs past the ziggurat?', 'euphrates', ''),
    station('Count the gate towers.', '4', RED),
  ]) },
}]);
await load(noIdb);
eq(await thumbSrc(noIdb, 1), RED, 'an inline image still draws when there is nowhere to move it');
eq((await playerRoom(noIdb)).stations[1].image, RED, 'and still rides the student link');
await noIdb.setInputFiles('.station-card[data-idx="0"] input.f-image',
  { name: 'river.png', mimeType: 'image/png', buffer: Buffer.from(BLUE.split(',')[1], 'base64') });
await noIdb.waitForFunction(() => !!document.querySelector('.station-card[data-idx="0"] .station-image-thumb img'), null, { timeout: 5000 });
await settle(noIdb, 300);
const inlineSaved = await saved(noIdb);
ok(/^data:image\/jpeg/.test(inlineSaved.sets['Vault of Ur'].stations[0].image),
  'the new image is saved inline in the key, as before Path 4 P4, rather than lost');
eq(inlineSaved.sets['Vault of Ur'].stations[1].image, RED, 'and the old inline one is left exactly as it was');
/* Not `#msg === ''`: a real photo (~33 KB as a data URL) is far past what a QR
   code holds, and every station's code carries the whole room, so the page
   already says it cannot build them. That predates Path 4 P4; see HISTORY.md. */
ok(!/no longer in this browser/.test(await noIdb.textContent('#msg')), 'and nothing is reported missing');

/* ── 10. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
