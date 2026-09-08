// smoke-share.mjs — the Seating Chart Generator's "Share section…" sheet.
//
//   node Tools/seating-chart/test/smoke-share.mjs
//
// Path 6 P2's third increment moved this tool off state-link.js's own
// mountShareControl and onto the shared sheet (_shared/share.js). The reason
// this page got a suite of its own is one measured bug that the swap fixes,
// and that nothing static on this site could have seen:
//
//   A section's students carry `photo`, a data:image/ URL of tens of KB
//   each. mountShareControl encoded the section WHOLE and put the result in
//   the URL — so a class with photos produced a link no address bar, mail
//   client or QR code could carry, the clipboard accepted it, and the tool
//   reported success. share.js strips images out of the link and the QR by
//   policy, SAYS how many it left out, and the downloaded file keeps them.
//
// So section 2 below is the assertion this file exists for: the link carries
// no image bytes, the sheet's note says so in words, and the DOWNLOAD does
// carry the photo. The download is checked against the writer's own bytes —
// the blob handed to URL.createObjectURL, captured — rather than a
// hand-written envelope, because a hand-written one cannot catch the writer
// drifting from the reader.
//
// Section 5 scans the open sheet with axe. The site-wide sweep opens every
// page with empty storage and cannot click, so a dialog behind a saved chart
// AND a click has never been scanned by it; a suite that has prepped the
// state scans it for nothing extra.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8231;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/005-Seating%20Chart%20Generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* A real 1x1 PNG as a data: URL — small, but it is a data:image/ string and
   that is the whole of what the policy keys on. */
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const STUDENTS = [
  { id: 's0', name: 'Ada Lovelace', note: 'front row, please', flag: false, photo: PHOTO },
  { id: 's1', name: 'Marco Polo', note: '', flag: false, photo: '' },
  { id: 's2', name: 'Mansa Musa', note: '', flag: true, photo: '' },
  { id: 's3', name: 'Ida B Wells', note: '', flag: false, photo: '' },
];
const DESKS = [
  { id: 'f0', x: 40, y: 110 }, { id: 'f1', x: 170, y: 110 },
  { id: 'b0', x: 40, y: 260 }, { id: 'b1', x: 170, y: 260 },
].map(d => ({ ...d, rot: 0, locked: false }));

const FIXTURE = {
  __v: 1, active: 'p1', theme: 'light', zoom: 'fit', lastFirst: false, numbered: false, mirror: false,
  printNames: true, printPhotos: true, printViolations: true, currentQuarter: 'Q1',
  sections: [
    {
      id: 'p1', name: 'Period 2 Geography', students: STUDENTS, desks: DESKS,
      assign: { f0: 's0', f1: 's1', b0: 's2', b1: 's3' },
      apart: [['s0', 's2']], together: [], layouts: [], history: [],
    },
    {
      // A second section, so "only the ACTIVE section travels" is provable
      // rather than vacuous.
      id: 'p2', name: 'Period 4 Civics',
      students: [{ id: 't0', name: 'Hypatia of Alexandria', note: '', flag: false, photo: '' }],
      desks: [{ id: 'g0', x: 40, y: 110, rot: 0, locked: false }],
      assign: { g0: 't0' }, apart: [], together: [], layouts: [], history: [],
    },
  ],
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Seating Chart Generator — share a section');

await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 300);
await page.evaluate(f => localStorage.setItem('seating-chart-v1', JSON.stringify(f)), FIXTURE);
await page.goto(URL_PAGE, { waitUntil: 'load' });
await settle(page, 700);

/* ── 1. the button is a real button in the toolbar, not one a module built ── */
eq(await page.isVisible('#shareBtn'), true, 'the toolbar has a Share section… button');
eq(await page.textContent('#status') !== null, true, 'and the status bar it reports through is present');

/* Opens the sheet, clicks the Copy link row, and CLOSES the sheet in the same
   call: since P2 the sheet is a real modal with a backdrop, and leaving it
   open makes the next click on the page miss. */
const shareLink = async (p = page) => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};

const url = await shareLink();
ok(url && url.indexOf('section=') !== -1, 'the Copy link row produces a ?section= link');

/* ── 2. THE ASSERTION THIS FILE EXISTS FOR: no photo bytes in the link ──── */
ok(url.indexOf('data:image') === -1, 'the raw URL contains no data:image string');
const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('section')), url);
ok(payload && Array.isArray(payload.students), 'the link decodes to a section');
eq(payload.name, 'Period 2 Geography', 'the ACTIVE section, not the other one');
ok(!JSON.stringify(payload).includes('Hypatia'), 'the other section did not travel');
eq(payload.students.length, 4, 'with every student in it');
eq(payload.students.find(s => s.id === 's0').photo, null, 'the photographed student arrives with the photo replaced by null');
ok(!JSON.stringify(payload).includes('data:image'), 'and no image bytes are anywhere in the payload');
eq(payload.students.find(s => s.id === 's0').note, 'front row, please', 'the note beside that photo does travel');
eq(JSON.stringify(payload.apart), JSON.stringify([['s0', 's2']]), 'and so do the keep-apart rules');

/* The sheet must SAY it dropped the photo — a policy nobody is told about is
   indistinguishable from a bug. */
await page.click('#shareBtn');
await settle(page, 250);
const note = await page.textContent('.share-sheet-note');
ok(/1 image is left out of the link and QR code/.test(note), 'the sheet says one image was left out: ' + JSON.stringify(note));
ok(/downloaded file carries it/.test(note), 'and that the downloaded file still carries it');

/* ── 3. the download is the full state, photo included ─────────────────── */
const file = await page.evaluate(() => {
  let text = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
  document.querySelector('.share-sheet button[data-share="download"]').click();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 200));
});
ok(file && file.indexOf('data:image/png') !== -1, 'the downloaded file DOES carry the photo');
const parsed = JSON.parse(file);
eq(parsed.aplp.tool, 'seating-chart', 'the file says which tool it belongs to');
eq(parsed.aplp.param, 'section', 'and which parameter it is a payload for');
eq(parsed.state.students.find(s => s.id === 's0').photo, PHOTO, 'byte for byte, the photo that was on the chart');
/* The reader half of the same loop: Share.unwrap() turns that envelope back
   into a link payload. P1 shipped a download no adopter's importer could
   open; this is the assertion that keeps it closed. */
const unwrapped = await page.evaluate(t => window.Share.unwrap(JSON.parse(t)), file);
eq(unwrapped.name, 'Period 2 Geography', 'and Share.unwrap() reads it back as a plain section payload');

/* ── 4. the sheet's rows, and the QR budget ─────────────────────────────── */
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
  'the sheet offers copy, QR and download: ' + JSON.stringify(rows));
const qr = await page.evaluate(() => {
  const b = document.querySelector('.share-sheet button[data-share="qr"]');
  return { disabled: b.disabled, reason: (document.querySelector('.share-sheet-reason') || {}).textContent || '' };
});
if (!qr.disabled) {
  await page.click('.share-sheet button[data-share="qr"]');
  await settle(page, 250);
  const w = await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width);
  ok(w > 100, `a four-student section fits a scannable QR (${w}px)`);
} else {
  ok(/(KB|modules)/.test(qr.reason) && /Copy the link/.test(qr.reason),
    'an over-large section greys the QR row out with a reason: ' + JSON.stringify(qr.reason));
}

/* ── 5. axe, on the open sheet — a state the site-wide sweep cannot reach ── */
const sheetViolations = await a11yScan(page, { impact: 'serious', include: '.share-sheet' });
eq(sheetViolations.length, 0, 'no serious/critical axe violations on the open sheet: ' +
  JSON.stringify(sheetViolations.map(v => v.id)));

await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');

/* ── 6. opening the link elsewhere adds it as a NEW section ─────────────── */
const other = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await other.goto(url, { waitUntil: 'load' });
await settle(other, 900);
const arrived = await other.evaluate(() => JSON.parse(localStorage.getItem('seating-chart-v1')));
ok(arrived.sections.some(s => s.name === 'Period 2 Geography'), 'the receiving browser has the shared section');
const got = arrived.sections.find(s => s.name === 'Period 2 Geography');
eq(got.students.length, 4, 'with every student');
eq(got.students.find(s => s.name === 'Ada Lovelace').photo, '',
  'and the stripped photo repaired to an empty string rather than a null that renders as one');
ok(/Imported "Period 2 Geography"/.test(await other.textContent('#status')), 'the status bar says what arrived');
eq(new URL(other.url()).searchParams.get('section'), null,
  'the parameter is consumed on open, so a refresh cannot import it twice');

/* ── 7. a mangled link fails in words, once ─────────────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?section=not-base64-%%%', { waitUntil: 'load' });
await settle(broken, 700);
ok(/could not be read/.test(await broken.textContent('#status')),
  'a mangled link says so rather than opening blank: ' + JSON.stringify(await broken.textContent('#status')));
eq(new URL(broken.url()).searchParams.get('section'), null,
  'and is cleared even though it was unusable, so a refresh does not repeat the failure');

/* ── 8. no console noise ────────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
