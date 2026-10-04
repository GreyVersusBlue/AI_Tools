// smoke-photos.mjs — the Seating Chart Generator's student photos, in IndexedDB.
//
//   node Tools/seating-chart/test/smoke-photos.mjs
//
// Path 4 P4 moved 005's photos out of its one localStorage key and into the
// shared media store (_shared/media-db.js, `gvb-media`, namespace `seating`).
// The chart now holds `idb:<id>` references. Everything a teacher could lose in
// that move is asserted here, in a real browser with a real IndexedDB:
//
//   1. A chart saved BEFORE the move (data: URL photos) is migrated on load:
//      the key loses the image bytes, the store gains the record, and the desk
//      shows the same picture it showed before.
//   2. A reload reads the picture back out of the store.
//   3. A photo added through the file picker goes straight to the store.
//   4. "Save to file" is still portable: data: URLs out, no `idb:` anywhere.
//   5. "Open file" takes a data: URL file and stores its photos.
//   6. An orphaned record (a replaced photo) is deleted on the next load; one
//      younger than the grace period, or still referenced, is not.
//   7. A reference whose image is gone draws the empty circle and SAYS so.
//   8. "Erase saved data" takes the photos with it.
//   9. With no IndexedDB at all, a new photo is kept the old way, inline.
//
// No console errors, ever. Exits 1 on any failure. Every name is invented.

import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';

const PORT = 8238;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';
const KEY = 'seating-chart-v1';

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
const pngBuffer = dataUrl => Buffer.from(dataUrl.split(',')[1], 'base64');

const chart = (students) => ({
  __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
  printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
  sections: [{
    id: 'p1', name: 'Period 3 World Cultures', students,
    desks: [{ id: 'f0', x: 40, y: 110 }, { id: 'f1', x: 170, y: 110 }, { id: 'f2', x: 300, y: 110 }]
      .map(d => ({ ...d, rot: 0, locked: false })),
    assign: { f0: 's0', f1: 's1', f2: 's2' },
    apart: [], together: [], layouts: [], history: [],
  }],
});
const LEGACY = chart([
  { id: 's0', name: 'Ada Lovelace', note: '', flag: false, photo: RED },
  { id: 's1', name: 'Marco Polo', note: '', flag: false, photo: '' },
  { id: 's2', name: 'Mansa Musa', note: '', flag: false, photo: RED },   // same image twice: stored once
]);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());

const saved = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const rawSaved = p => p.evaluate(k => localStorage.getItem(k) || '', KEY);
const records = p => p.evaluate(() => window.MediaDB.store({ ns: 'seating' }).list());
const deskSrc = (p, deskId) => p.evaluate(id => {
  const img = document.querySelector(`.desk[data-id="${id}"] img.photo`);
  return img ? img.getAttribute('src') : null;
}, deskId);
const load = async (p, url = URL_PAGE) => {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__seatingPhotosSettled === true, null, { timeout: 8000 });
  await settle(p, 150);
};

console.log('Seating Chart Generator — photos in the media store');

/* ── 1. a chart from before the move is migrated on load ───────────────── */
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 200);
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, LEGACY]);
await load(page);

let s = await saved(page);
const ref0 = s.sections[0].students[0].photo;
ok(/^idb:[A-Za-z0-9_-]+$/.test(ref0), 'the migrated student now holds an idb: reference: ' + JSON.stringify(ref0));
eq(s.sections[0].students[2].photo, ref0, 'the same picture on two students is stored once and shared');
eq(s.sections[0].students[1].photo, '', 'a student with no photo still has none');
ok(!(await rawSaved(page)).includes('data:image'), 'the localStorage key no longer carries any image bytes');
let recs = await records(page);
eq(recs.length, 1, 'the media store holds one record for it');
eq(recs[0] && 'idb:' + recs[0].id, ref0, 'under the id the chart points at');
eq(recs[0] && recs[0].type, 'image/png', 'with the image\'s type');
eq(await deskSrc(page, 'f0'), RED, 'the desk shows exactly the picture it showed before the move');
ok(/kept in this browser’s image store/.test(await page.textContent('#storageBox')),
  'the storage readout says where the photos are: ' + JSON.stringify(await page.textContent('#storageBox')));

/* ── 2. a reload reads it back ─────────────────────────────────────────── */
await load(page);
eq(await deskSrc(page, 'f0'), RED, 'after a reload the desk draws the photo out of IndexedDB');
eq(await deskSrc(page, 'f2'), RED, 'and so does the other student sharing it');
eq(await deskSrc(page, 'f1'), null, 'and the student without one still has no <img>');

/* ── 3. a photo added through the picker goes straight to the store ────── */
await page.evaluate(() => window.choosePhoto('s1'));
await page.setInputFiles('#photoFile', { name: 'polo.png', mimeType: 'image/png', buffer: pngBuffer(BLUE) });
await page.waitForFunction(() => {
  const img = document.querySelector('.desk[data-id="f1"] img.photo');
  return !!img;
}, null, { timeout: 5000 });
await settle(page, 1500);   // autosave is 1.2 s
s = await saved(page);
const ref1 = s.sections[0].students[1].photo;
ok(/^idb:/.test(ref1) && ref1 !== ref0, 'the new photo is saved as a reference of its own: ' + JSON.stringify(ref1));
ok(!(await rawSaved(page)).includes('data:image'), 'and the key still carries no image bytes');
eq((await records(page)).length, 2, 'the store now holds two records');
ok(/^data:image\/jpeg/.test(await deskSrc(page, 'f1') || ''), 'the desk shows the downscaled JPEG');

/* ── 4. Save to file is portable ───────────────────────────────────────── */
const exported = await downloadText(page, '#saveBar [data-gvb="export"]', { what: 'the Save to file download' });
ok(exported && !exported.includes('idb:'), 'the saved file carries no idb: reference');
const file = JSON.parse(exported);
const fileState = file.state || file.data || file;
const fileStudents = (fileState.sections || [])[0]?.students || [];
eq(fileStudents[0] && fileStudents[0].photo, RED, 'the file carries the migrated photo byte for byte');
ok(/^data:image\/jpeg/.test(fileStudents[1] && fileStudents[1].photo || ''), 'and the new one as a data URL');
ok(s.sections[0].students[0].photo === ref0 && (await saved(page)).sections[0].students[0].photo === ref0,
  'exporting did not rewrite the live chart');

/* ── 5. Open file stores the file's photos ─────────────────────────────── */
const incoming = JSON.parse(exported);
((incoming.state || incoming.data || incoming).sections[0].students[0]).photo = BLUE;
await page.setInputFiles('#saveBar input[type=file]', {
  name: 'charts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)),
});
await page.waitForFunction(k => {
  const v = localStorage.getItem(k) || '';
  return v.includes('Period 3') && !v.includes('data:image');
}, KEY, { timeout: 5000 });
s = await saved(page);
ok(/^idb:/.test(s.sections[0].students[0].photo), 'an opened file\'s data URL photos are moved into the store');
eq(await deskSrc(page, 'f0'), BLUE, 'and the desk shows the picture from the file');

/* ── 6. orphans are collected on the next load, and only orphans ───────── */
await page.evaluate(() => {
  const st = window.MediaDB.store({ ns: 'seating' });
  const blob = window.MediaDB.dataUrlToBlob('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4o6HxHwAFPAIsDsQvxQAAAABJRU5ErkJggg==');
  // put() stamps savedAt itself, so the old record is written through the raw store.
  return st.put('fresh-orphan', blob).then(() => new Promise((res, rej) => {
    const req = indexedDB.open('gvb-media');
    req.onsuccess = () => {
      const t = req.result.transaction('blobs', 'readwrite');
      t.objectStore('blobs').put({ id: 'seating/old-orphan', blob, size: blob.size, type: blob.type, savedAt: Date.now() - 3600e3 });
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
ok(s.sections[0].students.filter(x => x.photo).every(x => after.includes(x.photo.slice(4))),
  'every photo the chart still points at survives');

/* ── 7. a reference with nothing behind it says so ─────────────────────── */
const dangling = chart([
  { id: 's0', name: 'Ada Lovelace', note: '', flag: false, photo: 'idb:gone123' },
  { id: 's1', name: 'Marco Polo', note: '', flag: false, photo: '' },
  { id: 's2', name: 'Mansa Musa', note: '', flag: false, photo: '' },
]);
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, dangling]);
await load(page);
eq(await deskSrc(page, 'f0'), null, 'a dangling reference draws no <img>');
ok(await page.$('#rosterList .thumb-placeholder'), 'the roster shows the empty circle for it');
ok(/1 photo is no longer in this browser/.test(await page.textContent('#status')),
  'and the status bar says a photo is missing: ' + JSON.stringify(await page.textContent('#status')));
ok(await page.$('#rosterList [aria-label="Remove photo for Ada Lovelace"]'), 'the teacher can still remove the dead reference');

/* ── 8. Erase takes the photos too ─────────────────────────────────────── */
ok((await records(page)).length > 0, 'there are photos in the store before erasing');
await page.click('#saveBar [data-gvb="reset"]');
await settle(page, 600);
eq((await records(page)).length, 0, 'Erase saved data empties this tool\'s part of the media store');

/* ── 9. with no IndexedDB, a new photo is kept the old way ─────────────── */
const noIdb = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await noIdb.context().addInitScript(() => {
  Object.defineProperty(window, 'indexedDB', { configurable: true, get() { return undefined; } });
});
await noIdb.goto(URL_PAGE, { waitUntil: 'load' });
await settle(noIdb, 200);
await noIdb.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, chart([
  { id: 's0', name: 'Ada Lovelace', note: '', flag: false, photo: '' },
  { id: 's1', name: 'Marco Polo', note: '', flag: false, photo: RED },
  { id: 's2', name: 'Mansa Musa', note: '', flag: false, photo: '' },
])]);
await load(noIdb);
eq(await deskSrc(noIdb, 'f1'), RED, 'an inline photo still draws when there is nowhere to move it');
await noIdb.evaluate(() => window.choosePhoto('s0'));
await noIdb.setInputFiles('#photoFile', { name: 'ada.png', mimeType: 'image/png', buffer: pngBuffer(BLUE) });
await noIdb.waitForFunction(() => !!document.querySelector('.desk[data-id="f0"] img.photo'), null, { timeout: 5000 });
await settle(noIdb, 1500);
const inlineSaved = await saved(noIdb);
ok(/^data:image\/jpeg/.test(inlineSaved.sections[0].students[0].photo),
  'the new photo is saved inline in the key, as before Path 4 P4, rather than lost');
eq(inlineSaved.sections[0].students[1].photo, RED, 'and the old inline one is left exactly as it was');

/* ── 10. no console noise ──────────────────────────────────────────────── */
for (const [name, p] of [['with IndexedDB', page], ['without IndexedDB', noIdb]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
