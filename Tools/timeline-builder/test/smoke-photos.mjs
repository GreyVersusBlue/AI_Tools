// smoke-photos.mjs — the Timeline Builder's event photos, in IndexedDB.
//
//   node Tools/timeline-builder/test/smoke-photos.mjs
//
// Path 4 P4 moved 015's event photos out of localStorage — out of every saved
// timeline (`gvb-timeline:data:<name>`, each event's `photo`) — and into the
// shared media store (_shared/media-db.js, `gvb-media`, namespace `tlb`), and
// deleted tlb-photo.js. The field kept its name and now holds `idb:<id>`,
// where the id is the stored image's hash. What a teacher could lose in that
// move is asserted here, in a real browser with a real IndexedDB:
//
//   1. Timelines saved BEFORE the move (data: URL photos, the open one and
//      one that is not) are migrated on load; the keys lose the image bytes;
//      a timeline with no photo is written back byte-identical; each distinct
//      picture is stored once; the event list, the timeline, the print view
//      and story mode draw the same picture from an object URL.
//   2. A reload reads them back and stores nothing twice.
//   3. An upload is downscaled by MediaDB.downscaleImage to 480 px, JPEG,
//      on white; the same file in a second timeline is the same record.
//   4. Export JSON and the share sheet's download are portable (data: URLs,
//      byte for byte, no `idb:`); the link still strips the photos.
//   5. Importing that file stores its photos before saving and reuses the
//      records already there; an `idb:` reference in a file or a link is
//      dropped, an inline image kept and moved. A link like the one 046 Blank
//      Map sends (places, no photos) still arrives.
//   6. An orphaned record is deleted on the next load; one younger than the
//      grace period, or referenced only by a timeline that is not open, is not.
//   7. A photo whose image is gone says so on its event and in the note, is
//      never a broken <img>, is axe-clean in both themes, and none of the
//      print paths (Print, wall print, map + timeline) hangs waiting for it.
//   8. With no IndexedDB, photos stay inline, as before.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8448;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/015-timeline-builder.html';
const DATA = 'gvb-timeline:data:';
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
const PHILLY = { name: 'Philadelphia, Pennsylvania', lat: 39.95, lon: -75.17 };
const BOSTON = { name: 'Boston, Massachusetts', lat: 42.36, lon: -71.06 };

const ev = (id, title, yearStart, photo, place = null) => ({
  id, track: 0, title, yearStart, yearEnd: null, category: null, place, displayDate: null,
  description: 'An invented event.', photo,
});
const timeline = (name, events) => ({
  name, title: name, lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
  events, eras: [], tracks: [{ id: 0, name: 'Track A' }], compareWith: null,
});
/* Three timelines saved the way 015 saved them before the move: RED in both
   Rivers (open) and Canals (not open), BLUE in Rivers only, and one with no
   photo at all, which must come through byte for byte. */
const SEED = {
  'gvb-timeline:list': ['Rivers', 'Canals', 'Plain'],
  'gvb-timeline:current': 'Rivers',
  [DATA + 'Rivers']: timeline('Rivers', [
    ev(1, 'Mill opens', 1800, RED, PHILLY), ev(2, 'Ferry sinks', 1810, BLUE, BOSTON), ev(3, 'Bridge built', 1820, null),
  ]),
  [DATA + 'Canals']: timeline('Canals', [ev(1, 'Lock dug', 1825, RED), ev(2, 'Towpath paved', 1830, null)]),
  [DATA + 'Plain']: timeline('Plain', [ev(1, 'Nothing pictured', 1900, null)]),
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
let promptAnswer = 'New Timeline';
page.on('dialog', d => d.type() === 'prompt' ? d.accept(promptAnswer) : d.accept());

const stored = (p, name) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), DATA + name);
const rawStored = (p, name) => p.evaluate(k => localStorage.getItem(k), DATA + name);
const everyKey = p => p.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-timeline/.test(k)).map(k => localStorage.getItem(k)).join('\n'));
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'tlb' }).list());
const current = p => p.evaluate(() => localStorage.getItem('gvb-timeline:current'));
const photos = (t) => t.events.map(e => e.photo);
/* The srcs of the <img>s matching `sel`, read back as data URLs. */
const shownAs = (p, sel) => p.evaluate(s => Promise.all(Array.from(document.querySelectorAll(s)).map(img =>
  fetch(img.getAttribute('src')).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
  })))), sel);
const srcsOf = (p, sel) => p.$$eval(sel, els => els.map(e => e.getAttribute('src')));
const stubPrint = p => p.evaluate(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__timelinePhotosSettled === true, null, { timeout: 8000 });
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
/* Opens a saved timeline from the Timeline menu. */
const switchTo = async (p, name) => {
  await p.selectOption('#timelineSwitch', name);
  await settle(p, 200);
};

console.log('Timeline Builder — event photos in the media store');

/* ── 1. timelines from before the move are migrated ────────────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await seed(page, SEED);
await load(page);

let rivers = await stored(page, 'Rivers');
let canals = await stored(page, 'Canals');
const [redRef, blueRef] = photos(rivers);
ok(REF.test(redRef), 'the open timeline\'s first photo now holds a hash reference: ' + JSON.stringify(redRef));
ok(REF.test(blueRef) && blueRef !== redRef, 'its second photo, a different picture, gets a reference of its own');
eq(photos(rivers)[2], null, 'an event with no photo still has none');
eq(photos(canals)[0], redRef, 'a timeline that is not open is migrated too, and shares the same picture\'s record');
eq(await rawStored(page, 'Plain'), JSON.stringify(SEED[DATA + 'Plain']), 'a timeline with no photo is not rewritten at all');
eq(await current(page), 'Rivers', 'and the open timeline is still the open one');
ok(!(await everyKey(page)).includes('data:image'), 'no gvb-timeline key carries image bytes any more');
let recs = await records(page);
eq(recs.length, 2, 'the media store holds one record per distinct picture, however many timelines use it');
ok(recs.every(r => r.type === 'image/png' && r.tool === 'timeline-builder'), 'each with its type and its owner');
const thumbs = await srcsOf(page, '#eventList img.thumb');
ok(thumbs.length === 2 && thumbs.every(s => /^blob:/.test(s)), 'the event list draws both photos from object URLs: ' + JSON.stringify(thumbs));
const listed = await shownAs(page, '#eventList img.thumb');
ok(listed[0] === RED && listed[1] === BLUE, 'showing exactly the pictures the events showed before the move');
eq((await shownAs(page, '#timelineCanvas .event-label img')).join(), [RED, BLUE].join(), 'so does the timeline itself');
eq((await shownAs(page, '#printViewInner .print-event img')).join(), [RED, BLUE].join(), 'and the print view');
await page.click('#presentBtn');
await page.waitForSelector('#storyOverlay:not([hidden])', { timeout: 5000 });
await settle(page, 300);
eq((await shownAs(page, '#storyPhoto'))[0], RED, 'and story mode');
await page.click('#storyExitBtn');
await settle(page, 200);
const shownV = await a11yScan(page, { impact: 'serious', include: '#eventList, #evPhotoPreview, #printViewInner' });
eq(shownV.length, 0, 'the photos showing pass axe: ' + JSON.stringify(shownV.map(v => v.id)));

/* ── 2. a reload reads them back ───────────────────────────────────────── */
await load(page);
eq((await shownAs(page, '#eventList img.thumb')).join(), [RED, BLUE].join(), 'after a reload the photos draw out of IndexedDB');
eq((await records(page)).length, 2, 'and nothing was stored twice');
eq(JSON.stringify(await stored(page, 'Rivers')), JSON.stringify(rivers), 'and the timeline is unchanged');

/* ── 3. an upload is downscaled and stored; the same file twice is one record ── */
/* A worst-case photo for JPEG: 1600×1200 of noise, transparent in one corner. */
const makePng = (kind) => page.evaluate((kind) => {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 1200;
  const x = c.getContext('2d');
  if (kind === 'noise') {
    const d = x.createImageData(1600, 1200);
    let s = 7;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d.data[i] = s & 255; d.data[i + 1] = (s >> 8) & 255; d.data[i + 2] = (s >> 16) & 255; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    x.clearRect(0, 0, 200, 200);
  } else {
    // Closer to a real photo: smooth gradients and a few shapes.
    const g = x.createLinearGradient(0, 0, 1600, 1200);
    g.addColorStop(0, '#6a8fb5'); g.addColorStop(0.5, '#d9c9a3'); g.addColorStop(1, '#3d5a2a');
    x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `hsl(${i * 37 % 360} 45% ${30 + i % 40}%)`;
      x.beginPath(); x.arc((i * 211) % 1600, (i * 157) % 1200, 30 + (i * 13) % 120, 0, Math.PI * 2); x.fill();
    }
  }
  return c.toDataURL('image/png').split(',')[1];
}, kind);
const noiseBytes = Buffer.from(await makePng('noise'), 'base64');
const sceneBytes = Buffer.from(await makePng('scene'), 'base64');

await page.fill('#evTitle', 'Canal photographed');
await page.fill('#evYearStart', '1830');
await page.setInputFiles('#evPhoto', { name: 'canal.png', mimeType: 'image/png', buffer: noiseBytes });
await page.waitForFunction(() => /^blob:/.test(document.getElementById('evPhotoImg').getAttribute('src') || ''), null, { timeout: 10000 });
await page.click('#saveEventBtn');
await settle(page, 200);
rivers = await stored(page, 'Rivers');
const noiseRef = rivers.events.find(e => e.title === 'Canal photographed').photo;
ok(REF.test(noiseRef), 'the upload is saved as a reference: ' + JSON.stringify(noiseRef));
recs = await records(page);
const noiseRec = recs.find(r => 'idb:' + r.id === noiseRef);
eq(noiseRec && noiseRec.type, 'image/jpeg', 'the stored image is the downscaled JPEG, not the uploaded PNG');
const probe = await page.evaluate(ref => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 4, 4, 0, 0, 4, 4);
    res({ w: img.naturalWidth, h: img.naturalHeight, corner: Array.from(g.getImageData(1, 1, 1, 1).data.slice(0, 3)) });
  };
  img.src = window.TimelineImage.url(ref);
}), noiseRef);
eq(`${probe.w}x${probe.h}`, '480x360', 'it is 480 px on its long edge, the size tlb-photo.js always stored');
ok(probe.corner.every(v => v > 240), 'and a transparent corner comes out white, not black as tlb-photo.js made it: ' + JSON.stringify(probe.corner));
ok(!(await everyKey(page)).includes('data:image'), 'and the keys still carry no image bytes');

// The number HISTORY.md records: what a 480 px photo weighs.
await page.setInputFiles('#evPhoto', { name: 'scene.png', mimeType: 'image/png', buffer: sceneBytes });
await page.waitForFunction(() => /^blob:/.test(document.getElementById('evPhotoImg').getAttribute('src') || ''), null, { timeout: 10000 });
await page.click('#evPhotoRemove');
recs = await records(page);
const sceneRec = recs.find(r => r.type === 'image/jpeg' && r.id !== noiseRef.slice(4));
console.log(`  (measured: a 480×360 photo stores as ${sceneRec && sceneRec.size} bytes of JPEG for a smooth scene and ` +
  `${noiseRec && noiseRec.size} for noise, the worst case — ${Math.round((noiseRec ? noiseRec.size : 0) * 4 / 3 / 1024)} KB as the data URL each event used to hold)`);
ok(noiseRec && noiseRec.size < 200 * 1024, 'even the worst case is under 200 KB');

await switchTo(page, 'Canals');
eq(await current(page), 'Canals', 'the second timeline is open');
await page.fill('#evTitle', 'Same canal, other class');
await page.fill('#evYearStart', '1831');
await page.setInputFiles('#evPhoto', { name: 'canal-again.png', mimeType: 'image/png', buffer: noiseBytes });
await page.waitForFunction(() => /^blob:/.test(document.getElementById('evPhotoImg').getAttribute('src') || ''), null, { timeout: 10000 });
await page.click('#saveEventBtn');
await settle(page, 200);
canals = await stored(page, 'Canals');
eq(canals.events.find(e => e.title === 'Same canal, other class').photo, noiseRef, 'the same file in a second timeline is the same reference');
eq((await records(page)).length, recs.length, 'and adds no record');

/* ── 4. out of the browser: Export JSON, the share sheet ───────────────── */
await switchTo(page, 'Rivers');
const exported = await nextDownload(page, '#exportTimelineBtn');
ok(exported && !exported.includes('idb:'), 'Export JSON carries no idb: reference');
const exportedT = exported ? JSON.parse(exported) : { events: [] };
const noiseDataUrl = await page.evaluate(ref => window.TimelineImage.inline(ref), noiseRef);
eq(photos(exportedT).join(), [RED, BLUE, '', noiseDataUrl].join(), 'it carries every photo as a data URL, byte for byte');
eq(JSON.stringify(await stored(page, 'Rivers')), JSON.stringify(rivers), 'exporting did not rewrite the saved timeline');

await page.click('#shareBtn');
await page.waitForSelector('.share-sheet', { timeout: 5000 });
ok(/3 images are left out of the link/.test(await page.textContent('.share-sheet-note')),
  'the sheet counts the photos left out of the link: ' + JSON.stringify(await page.textContent('.share-sheet-note')));
const sheetFile = await nextDownload(page, '.share-sheet [data-share="download"]');
ok(sheetFile && !sheetFile.includes('idb:'), 'the sheet\'s download carries no idb: reference');
const sheetState = sheetFile ? JSON.parse(sheetFile).state : { events: [] };
eq(photos(sheetState).join(), [RED, BLUE, '', noiseDataUrl].join(), 'and carries every photo');
const url = await page.evaluate(() => {
  let captured = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } } });
  document.querySelector('.share-sheet [data-share="copy"]').click();
  return new Promise(r => setTimeout(() => r(captured), 80));
});
ok(url && !url.includes('idb'), 'the link carries no reference');
const linked = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('timeline')), url);
ok(linked && linked.events.length === 4 && linked.events.every(e => !e.photo), 'and no photo, by share.js\'s policy');
await page.keyboard.press('Escape');
await settle(page, 100);

/* ── 5. arrivals: a file, a link, and 046's handoff ────────────────────── */
const recsBefore = (await records(page)).length;
await page.setInputFiles('#importTimelineFile', { name: 'rivers.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await page.waitForFunction(() => /^Rivers \(/.test(localStorage.getItem('gvb-timeline:current') || ''), null, { timeout: 8000 });
await settle(page, 200);
const importedName = await current(page);
const imported = await stored(page, importedName);
ok(importedName !== 'Rivers', 'the file is saved as a copy beside the original: ' + JSON.stringify(importedName));
eq(photos(imported).join(), [redRef, blueRef, null, noiseRef].join(), 'an imported file\'s photos move into the store and reuse the records already there');
eq((await records(page)).length, recsBefore, 'so the import stored nothing new');
ok(!(await everyKey(page)).includes('data:image'), 'and no image bytes were ever left in a key');
eq((await shownAs(page, '#eventList img.thumb')).length, 3, 'and the imported timeline shows its photos');

const foreign = JSON.stringify(timeline('Foreign', [ev(1, 'Theirs', 1700, 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef'), ev(2, 'Ours', 1701, BLUE),
  ev(3, 'Crafted', 1702, 'data:image/png;base64,AAAA" onerror="window.__pwned=1')]));
await page.setInputFiles('#importTimelineFile', { name: 'foreign.json', mimeType: 'application/json', buffer: Buffer.from(foreign) });
await page.waitForFunction(() => localStorage.getItem('gvb-timeline:current') === 'Foreign', null, { timeout: 8000 });
await settle(page, 200);
const foreignT = await stored(page, 'Foreign');
eq(photos(foreignT)[0], null, 'an idb: reference inside a file is dropped — it names the sender\'s photos');
eq(photos(foreignT)[1], blueRef, 'while its inline image is kept and stored');
eq(photos(foreignT)[2], null, 'and a value that only starts like an image is dropped too');
eq(await page.evaluate(() => window.__pwned), undefined, 'so nothing in it ever reached the page as markup');

const arrival = await page.evaluate(([red]) => window.StateLink.buildShareUrl('timeline', {
  v: 1, name: 'Hand-built link', title: '', lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
  eras: [], tracks: [{ id: 0, name: 'Track A' }],
  events: [
    { id: 1, track: 0, title: 'Inline', yearStart: 1600, photo: red },
    { id: 2, track: 0, title: 'Reference', yearStart: 1601, photo: 'idb:hdeadbeefdeadbeefdeadbeefdeadbeef' },
  ],
}), [RED]);
await load(page, arrival);
const handBuilt = await stored(page, await current(page));
eq(await current(page), 'Hand-built link', 'a link arrives as a timeline of its own');
eq(photos(handBuilt)[0], redRef, 'an inline image arriving by link is moved into the store and reuses its record');
eq(photos(handBuilt)[1], null, 'a reference arriving by link is dropped');

/* The shape 046 Blank Map sends (its own suite, smoke-timeline-handoff, drives
   the real Send row): places, no photos. */
const fromMap = await page.evaluate(() => window.StateLink.buildShareUrl('timeline', {
  v: 1, name: 'Places from the map', title: 'Places from the map', lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
  eras: [], tracks: [{ id: 0, name: 'Track A' }],
  events: [{ id: 1, track: 0, title: 'Fort', yearStart: 1754, yearEnd: null, category: null, displayDate: null, description: '',
    place: { name: 'Fort', lat: 40.44, lon: -80.0 }, photo: null }],
}));
await load(page, fromMap);
const mapped = await stored(page, await current(page));
eq(mapped.events[0].place && mapped.events[0].place.lat, 40.44, 'a map handoff still arrives with its places');
eq(mapped.events[0].photo, null, 'and no photo');
ok(!/missing/.test(await page.textContent('#shareNote')), 'and nothing is reported missing');

/* ── 6. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'tlb' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'tlb/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
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
      if (/^tlb\/h/.test(r.id)) { r.savedAt = Date.now() - 3600e3; os.put(r); }
    });
    t.oncomplete = () => { req.result.close(); res(); };
  };
}));
/* Canals is the only timeline holding the noise photo once every other lets it go. */
await page.evaluate(([prefix, ref]) => {
  Object.keys(localStorage).filter(k => k.startsWith(prefix) && k !== prefix + 'Canals').forEach(k => {
    const d = JSON.parse(localStorage.getItem(k));
    d.events.forEach(e => { if (e.photo === ref) e.photo = null; });
    localStorage.setItem(k, JSON.stringify(d));
  });
  localStorage.setItem('gvb-timeline:current', 'Rivers');
}, [DATA, noiseRef]);
const before = (await records(page)).map(r => r.id);
ok(before.includes('old-orphan') && before.includes('fresh-orphan'), 'two unreferenced records are seeded');
const sceneId = sceneRec && sceneRec.id;
ok(before.includes(sceneId), 'and the upload that was removed before saving is a third');
await load(page);
const after = (await records(page)).map(r => r.id);
ok(!after.includes('old-orphan'), 'an hour-old record nothing points at is deleted on load');
ok(!after.includes(sceneId), 'and so is an old upload that never made it into a saved event');
ok(after.includes('fresh-orphan'), 'one inside the grace period is left alone (another tab may be about to save it)');
ok(after.includes(noiseRef.slice(4)), 'an old record only a timeline that is not open points at survives');
ok(after.includes(redRef.slice(4)) && after.includes(blueRef.slice(4)), 'and so does every one the open timeline points at');

/* ── 7. a photo with nothing behind it says so, and never hangs a print ── */
await page.evaluate(k => {
  const d = JSON.parse(localStorage.getItem(k));
  d.events[0].photo = 'idb:h0000000000000000000000000000dead';
  localStorage.setItem(k, JSON.stringify(d));
}, DATA + 'Rivers');
await load(page);
eq(GONE, (await stored(page, 'Rivers')).events[0].photo, 'the dangling reference is left in place (the photo might come back in a restore)');
eq((await srcsOf(page, '#eventList img.thumb')).length, 1, 'the event list draws only the photo that is there');
ok(/photo missing from this browser/.test(await page.locator('#eventList .row-item', { hasText: 'Mill opens' }).textContent()),
  'and says so on the event whose photo is gone');
ok(/1 event photo in “Rivers” is missing/.test(await page.textContent('#shareNote')),
  'and the note says so, naming the timeline: ' + JSON.stringify(await page.textContent('#shareNote')));
const emptyImgs = await page.$$eval('img', els => els.filter(e => !e.getAttribute('src') && !e.hidden && e.id !== 'evPhotoImg' && e.id !== 'storyPhoto').length);
eq(emptyImgs, 0, 'no <img> anywhere on the page is left without a picture');
eq((await srcsOf(page, '#timelineCanvas .event-label img')).length, 1, 'the timeline leaves the missing photo out');
eq((await srcsOf(page, '#printViewInner .print-event img')).length, 1, 'and so does the print view');
await page.locator('#eventList .row-item', { hasText: 'Mill opens' }).getByRole('button', { name: 'Edit' }).click();
await settle(page, 150);
ok(await page.isVisible('#evPhotoMissing'), 'editing the event says its photo is missing');
ok(!(await page.isVisible('#evPhotoImg')), 'with no broken preview');
ok(await page.isVisible('#evPhotoRemove'), 'and "Remove photo" is still there');
const SCOPE = '#shareNote, #eventList, #evPhotoPreview';
const lightV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(lightV.length, 0, 'the missing-photo state passes axe: ' + JSON.stringify(lightV.map(v => v.id)));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
const darkV = await a11yScan(page, { impact: 'serious', include: SCOPE });
eq(darkV.length, 0, 'and in dark theme, note included: ' + JSON.stringify(darkV.map(v => v.id)));
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

await page.click('#presentBtn');
await page.waitForSelector('#storyOverlay:not([hidden])', { timeout: 5000 });
await settle(page, 300);
ok(await page.evaluate(() => document.getElementById('storyPhoto').hidden), 'story mode shows no picture for the missing photo');
await page.click('#storyExitBtn');
await settle(page, 200);

await page.click('#printBtn');
await page.waitForFunction(() => window.__printCalls === 1, null, { timeout: 5000 });
eq((await srcsOf(page, '#printArea img')).filter(s => /^blob:/.test(s)).length, 1, 'Print reaches window.print() with the one photo that is there');
await page.click('#tiledPrintToggleBtn');
await page.click('#btnTiledPrintGo');
await page.waitForFunction(() => window.__printCalls === 2, null, { timeout: 10000 });
ok((await srcsOf(page, '#tiledPrintPages img')).every(s => /^blob:/.test(s)), 'the wall print reaches window.print() too, with no photo-less <img>');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await page.click('#mapPrintToggleBtn');
await page.click('#btnMapPrintGo');
await page.waitForFunction(() => window.__printCalls === 3, null, { timeout: 60000 });
const mapImgs = await srcsOf(page, '#mapPrintPages img');
ok(mapImgs.every(s => /^(blob:|data:image\/png)/.test(s)), 'and so does the map + timeline print (map image plus photos): ' + mapImgs.length);
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

await page.locator('#eventList .row-item', { hasText: 'Mill opens' }).getByRole('button', { name: 'Edit' }).click();
await page.click('#evPhotoRemove');
await page.click('#saveEventBtn');
await settle(page, 150);
eq((await stored(page, 'Rivers')).events.find(e => e.title === 'Mill opens').photo, null, 'removing it clears the reference');

/* ── 8. with no IndexedDB, photos stay inline, as before ───────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1300, height: 1000 });
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await seed(noIdb, { 'gvb-timeline:list': ['Rivers'], 'gvb-timeline:current': 'Rivers', [DATA + 'Rivers']: SEED[DATA + 'Rivers'] });
await load(noIdb);
eq((await shownAs(noIdb, '#eventList img.thumb')).join(), [RED, BLUE].join(), 'inline photos still draw when there is nowhere to move them');
eq(photos(await stored(noIdb, 'Rivers')).join(), [RED, BLUE, null].join(), 'and stay inline in the key');
await noIdb.fill('#evTitle', 'Offline upload');
await noIdb.fill('#evYearStart', '1840');
await noIdb.setInputFiles('#evPhoto', { name: 'blue.png', mimeType: 'image/png', buffer: Buffer.from(BLUE.split(',')[1], 'base64') });
await noIdb.waitForFunction(() => /^data:image\/jpeg/.test(document.getElementById('evPhotoImg').getAttribute('src') || ''), null, { timeout: 5000 });
await noIdb.click('#saveEventBtn');
await settle(noIdb, 200);
ok(/^data:image\/jpeg/.test((await stored(noIdb, 'Rivers')).events.find(e => e.title === 'Offline upload').photo || ''),
  'a new upload is saved inline (downscaled JPEG), as before Path 4 P4, rather than lost');
ok(!/missing/.test(await noIdb.textContent('#shareNote')), 'and nothing is reported missing');
const offlineExport = await nextDownload(noIdb, '#exportTimelineBtn');
ok(offlineExport && JSON.parse(offlineExport).events[0].photo === RED, 'and Export JSON still carries them');

/* ── 9. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
