// smoke-share.mjs — Timeline Builder: the shared share sheet, and the file
// the sheet's own Download row writes.
//
//   node Tools/timeline-builder/test/smoke-share.mjs
//
// smoke-map-print.mjs already covers the ?timeline= link end to end. What is
// new in Path 6 P2, and what this suite is for, is the route the link cannot
// carry:
//
//   1. the tool used to hand-strip event photos out of the payload itself.
//      It hands share.js the WHOLE timeline now, and share.js strips data:
//      images out of the LINK and the QR by policy while leaving them in the
//      downloaded file. So a photo reaches another machine through the sheet
//      for the first time — before this it reached one only through Export
//      JSON, and only if the teacher knew to use it.
//   2. that downloaded file is wrapped in the { aplp, state } envelope. The
//      tool's own Import JSON button read `name`/`events` off the top level,
//      so before Share.receiveFile() it would have refused the file the
//      sheet had just written. This suite drives the REAL bytes — the blob
//      handed to URL.createObjectURL is captured and fed back into the file
//      input — rather than a hand-written envelope, because a hand-written
//      one cannot catch the writer drifting from the reader.
//
// Exits 1 on any failure. Every event here is public-domain history.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8236;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/015-timeline-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// A real (tiny) PNG, so the state carries a genuine data:image/… string and
// share.js's stripImages() has something of the right shape to find.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const server = await serve(PORT);
const browser = await launch();

console.log('Timeline Builder — the shared share sheet and its downloaded file');

/* ── a saved timeline with a photo on one event ─────────────────────────── */
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

await page.evaluate((png) => {
  const name = 'Voyages';
  localStorage.setItem('gvb-timeline:list', JSON.stringify([name]));
  localStorage.setItem('gvb-timeline:current', name);
  localStorage.setItem('gvb-timeline:data:' + name, JSON.stringify({
    name, title: 'Voyages', lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
    tracks: [{ id: 0, name: 'Track A' }], eras: [],
    events: [
      { id: 1, year: 1492, title: 'Landfall', text: 'A first crossing.', track: 0, photo: png, place: null },
      { id: 2, year: 1519, title: 'Circumnavigation begins', text: '', track: 0, photo: null, place: null },
    ],
    compareWith: null,
  }));
}, PNG);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.evaluate(() => localStorage.getItem('gvb-timeline:current')), 'Voyages', 'the fixture timeline is the open one');

/* ── 1. one button, one sheet ───────────────────────────────────────────── */
await page.click('#shareBtn');
await settle(page, 250);
ok(await page.isVisible('.share-sheet[role="dialog"]'), 'Share timeline… opens the shared sheet as a dialog');
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
   'with copy, QR and download rows: ' + JSON.stringify(rows));
ok(/1 image is left out of the link and QR code/.test(await page.textContent('.share-sheet-note')),
   'and the sheet counts the photo it is leaving out of the link');

/* ── 2. the file the Download row actually writes ───────────────────────
   Captured off URL.createObjectURL, so these are the writer's own bytes. */
const fileText = await page.evaluate(() => {
  const real = URL.createObjectURL;
  let blob = null;
  // The real object URL is still handed back: a dummy one makes the anchor
  // click log "Not allowed to load local resource", which this suite's own
  // no-console-noise assertion then reports.
  URL.createObjectURL = (b) => { blob = b; return real.call(URL, b); };
  document.querySelector('.share-sheet button[data-share="download"]').click();
  URL.createObjectURL = real;
  return blob ? blob.text() : null;
});
ok(typeof fileText === 'string' && fileText.length > 0, 'the Download row writes a file');
const file = JSON.parse(fileText);
eq(file.aplp.tool, 'timeline-builder', 'wrapped in the envelope, naming the tool');
eq(file.aplp.param, 'timeline', 'and the parameter it reads back');
eq(file.state.v, 1, 'the state inside is versioned');
eq(file.state.events.length, 2, 'with every event');
eq(file.state.events[0].photo, PNG, 'and the photo INTACT — the download is the route images travel');
ok(!('compareWith' in file.state),
   'while compareWith, which names a timeline saved only here, is left behind');

/* The sheet is a dialog the site-wide axe sweep can never reach — it opens
   every page with empty storage, and this one needs a saved timeline and a
   click. Rank 13's answer is to scan the STATE from a suite that has already
   prepped it, and this one is scanned in BOTH themes: the sheet paints its
   own surface, so a fade that reads on paper can stop reading on a dark
   card. (This is where the sheet's five contrast failures on 007 were found:
   it was reading that page's dark-theme --muted onto its own #fff fallback.
   It fades its own resolved ink now, which cannot be inconsistent.) */
eq((await a11yScan(page, { include: '.share-sheet-backdrop' })).length, 0,
   'the open sheet has no serious/critical axe violations in light');

await page.evaluate(() => {
  // a11y.js is the only owner of data-theme on this site; 'dark' is the
  // explicit choice, as against its 'auto' default.
  localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark',
   'the page can be put into its native dark palette');
await page.click('#shareBtn');
await settle(page, 300);
const darkSheet = await page.evaluate(() => ({
  card: getComputedStyle(document.querySelector('.share-sheet')).backgroundColor,
  ink: getComputedStyle(document.querySelector('.share-sheet')).color,
}));
ok(/^rgb\(\s*(\d+)/.test(darkSheet.card), 'the sheet paints a real background in dark: ' + JSON.stringify(darkSheet));
eq((await a11yScan(page, { include: '.share-sheet-backdrop' })).length, 0,
   'and no serious/critical axe violations there either');

await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');
await page.evaluate(() => localStorage.removeItem('gvb-a11y-prefs'));

/* ── 3. that file opens again in this tool's own Import JSON ────────────
   The assertion that would have failed before Share.receiveFile(): the
   envelope's keys are `aplp` and `state`, and the importer looks for `name`
   and `events`. */
const receiver = await prepPage(browser, BASE, { width: 1280, height: 950 });
await receiver.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(receiver, 400);
const before = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));

await receiver.setInputFiles('#importTimelineFile', {
  name: 'Voyages.json', mimeType: 'application/json', buffer: Buffer.from(fileText, 'utf8'),
});
await settle(receiver, 500);

const arrived = await receiver.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  return { name, data: JSON.parse(localStorage.getItem('gvb-timeline:data:' + name)) };
});
ok(/^Voyages/.test(arrived.name), 'a .json written by the share sheet opens in Import JSON: ' + arrived.name);
eq(arrived.data.events.length, 2, 'with every event');
eq(arrived.data.events[0].photo, PNG, 'and the photo, which no link could have carried');
const after = await receiver.evaluate(() => JSON.parse(localStorage.getItem('gvb-timeline:list') || '[]'));
ok(before.every(n => after.includes(n)), 'nothing already saved here was replaced');

/* A plain Export JSON file — no envelope — still opens, because unwrap()
   passes anything without an `aplp` header straight through. */
const bare = JSON.stringify({
  name: 'Hand Written', title: '', lineStyle: 'solid', compactLabels: false, scaleMode: 'linear',
  tracks: [{ id: 0, name: 'Track A' }], eras: [], events: [{ id: 1, year: 1776, title: 'Declaration', text: '', track: 0, photo: null, place: null }],
});
await receiver.setInputFiles('#importTimelineFile', {
  name: 'hand-written.json', mimeType: 'application/json', buffer: Buffer.from(bare, 'utf8'),
});
await settle(receiver, 500);
eq(await receiver.evaluate(() => localStorage.getItem('gvb-timeline:current')), 'Hand Written',
   'a bare export from before the sheet existed still opens');

/* And another tool's export is refused, by the one shared sentence. */
receiver.__alerts = [];
receiver.on('dialog', d => { receiver.__alerts.push(d.message()); d.dismiss(); });
await receiver.setInputFiles('#importTimelineFile', {
  name: 'not-ours.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ words: "this is 040's shape" }), 'utf8'),
});
await settle(receiver, 500);
ok(receiver.__alerts.some(m => /doesn’t look like a timeline file/.test(m)),
   'another tool\'s export is refused by name: ' + JSON.stringify(receiver.__alerts));
eq(await receiver.evaluate(() => localStorage.getItem('gvb-timeline:current')), 'Hand Written',
   'and nothing on screen changed');

/* ── 4. a link arrives with its photos blanked, and says so ─────────────
   The receiving side blanks an image only when it is NOT a usable string,
   so a link's null is blanked and a file's pixels are not — the same rule
   028 needed in the first increment. */
const link = await page.evaluate(() => {
  let captured = null;
  const real = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.getElementById('shareBtn').click();
  document.querySelector('.share-sheet button[data-share="copy"]').click();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: real });
  window.Share.close();
  return captured;
});
ok(!!link && link.includes('timeline='), 'the Copy link row produces a ?timeline= URL');
ok(link.indexOf('iVBORw0KGgo') === -1, 'with no trace of the photo in it');

const linkReceiver = await prepPage(browser, BASE, { width: 1280, height: 950 });
await linkReceiver.goto(link, { waitUntil: 'networkidle' });
await settle(linkReceiver, 600);
const viaLink = await linkReceiver.evaluate(() => {
  const name = localStorage.getItem('gvb-timeline:current');
  return { name, data: JSON.parse(localStorage.getItem('gvb-timeline:data:' + name)) };
});
eq(viaLink.data.events.length, 2, 'the link carries every event');
eq(viaLink.data.events[0].photo, null, 'with the photo blanked rather than left as a broken value');
ok(/stayed on their device/.test(await linkReceiver.textContent('#shareNote')),
   'and the note says where the photos went: ' + JSON.stringify(await linkReceiver.textContent('#shareNote')));

/* ── no console noise anywhere ──────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['file import', receiver], ['link receiver', linkReceiver]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
