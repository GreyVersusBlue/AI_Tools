// smoke-share.mjs — Class Roster Hub's "Share roster…" sheet.
//
//   node Tools/class-roster-hub/test/smoke-share.mjs
//
// Path 6 P2's third increment replaced two toolbar controls with one: this
// tool had state-link.js's own mountShareControl (a copy-link button that
// module built itself, every message through alert()) standing next to a
// hand-rolled "QR code" modal with its own drawShareQr. Both are gone; the
// shared sheet (_shared/share.js) does copy, QR, download and the system
// share behind one button.
//
// The QR is what changed behaviour. drawShareQr drew whatever the encoder
// accepted at a fixed 6 px per module INTO A CANVAS THE CSS THEN SQUASHED TO
// 260 px, and refused only when the encoder itself threw — so a full class
// list produced a code the tool called a success and no phone could read.
// qr-draw.js measures the module size against the space on screen and greys
// the row out with the reason instead.
//
// The one thing that must NOT have moved is the pairing code. "Move
// everything to another device" draws WebRTC offer/answer payloads through
// the same twenty lines drawShareQr used to be, and those are not share
// payloads, not links, and not Path 6's. Section 4 asserts that half is
// still there and still separate.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8234;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SEED = {
  'Period 2 Geography': ['Ada Lovelace', 'Marco Polo', 'Mansa Musa', 'Ida B Wells'],
  'Period 4 Civics': ['Hypatia of Alexandria', 'Zheng He'],
};

const server = await serve(PORT);
const browser = await launch();

async function openWith(name) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
  await page.addInitScript(seed => { localStorage.setItem('np_rosters', JSON.stringify(seed)); }, SEED);
  await page.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
  await settle(page, 500);
  if (name) { await page.selectOption('#rosterSwitch', name); await settle(page, 300); }
  return page;
}

console.log('Class Roster Hub — share one roster');

const page = await openWith('Period 2 Geography');

/* ── 1. the button is a real button in the toolbar ──────────────────────── */
eq(await page.isVisible('#shareBtn'), true, 'the toolbar has a Share roster… button');
eq(await page.$('#qrBtn'), null, 'and the separate QR code button it replaced is gone');
eq(await page.$('#qrOverlay'), null, 'along with the hand-rolled roster QR modal');

/* Opens the sheet, clicks Copy link, and CLOSES it in the same call: the
   sheet is a real modal with a backdrop, and leaving it open makes the next
   click on the page miss. */
const shareLink = async (p) => {
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

const url = await shareLink(page);
ok(url && url.indexOf('roster=') !== -1, 'the Copy link row produces a ?roster= link');
ok(/Link copied/.test(await page.textContent('#msg')),
  'and the page message line says so, in place of the old alert()');

/* ── 2. ONE roster travels, not the drawer ──────────────────────────────── */
const payload = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('roster')), url);
eq(payload.name, 'Period 2 Geography', 'the payload carries the open roster');
eq(payload.names.length, 4, 'with its names');
ok(!JSON.stringify(payload).includes('Hypatia'), 'and not the other roster saved beside it');

/* ── 3. opening it elsewhere saves it as a NEW roster ───────────────────── */
const other = await prepPage(browser, BASE, { width: 1280, height: 950 });
await other.goto(url, { waitUntil: 'domcontentloaded' });
await settle(other, 800);
const arrived = await other.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')));
ok(arrived && arrived['Period 2 Geography'], 'the receiving browser has the roster: ' + JSON.stringify(Object.keys(arrived || {})));
eq((arrived['Period 2 Geography'] || []).length, 4, 'with every name');
ok(/Imported shared roster/.test(await other.textContent('#msg')), 'and says what arrived');
eq(new URL(other.url()).searchParams.get('roster'), null,
  'the parameter is consumed on open, so a refresh cannot import it twice');

/* ── 4. the pairing codes are NOT the share sheet and did not move ──────── */
eq(await page.$('#handoffOfferCanvas') !== null, true,
  'the device-to-device offer canvas is still in the page');
eq(await page.$('#handoffAnswerCanvas') !== null, true, 'and the answer canvas');
eq(await page.evaluate(() => typeof window.WebRTCPair), 'object',
  'and webrtc-pair.js is still loaded, so the pairing half is untouched');
eq(await page.evaluate(() => typeof window.qrcode), 'function',
  'the vendored encoder is still loaded — qr-draw.js needs it, and so do the pairing codes');

/* ── 5. the sheet's rows, the QR budget and the download ────────────────── */
await page.click('#shareBtn');
await settle(page, 300);
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
  ok(await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width) > 100,
    'a four-name roster fits a scannable QR');
} else {
  ok(/(KB|modules)/.test(qr.reason), 'an over-large roster greys the QR row out with a reason: ' + JSON.stringify(qr.reason));
}
const file = await page.evaluate(() => {
  let text = null;
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
  document.querySelector('.share-sheet button[data-share="download"]').click();
  return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 200));
});
const parsedFile = JSON.parse(file);
eq(parsedFile.aplp.tool, 'class-roster-hub', 'the downloaded file says which tool it belongs to');
eq(parsedFile.aplp.param, 'roster', 'and which parameter it is a payload for');
eq(await page.evaluate(t => window.Share.unwrap(JSON.parse(t)).name, file), 'Period 2 Geography',
  'Share.unwrap() reads that envelope back as a plain roster payload');

/* ── 6. axe, on the open sheet — a state the site-wide sweep cannot reach ── */
const sheetViolations = await a11yScan(page, { impact: 'serious', include: '.share-sheet' });
eq(sheetViolations.length, 0, 'no serious/critical axe violations on the open sheet: ' +
  JSON.stringify(sheetViolations.map(v => v.id)));
await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');

/* ── 7. sharing with nothing open says so, without opening a sheet ──────── */
const empty = await prepPage(browser, BASE, { width: 1280, height: 950 });
await empty.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
await settle(empty, 500);
if (await empty.isVisible('#shareBtn')) {
  await empty.click('#shareBtn');
  await settle(empty, 250);
  ok(!(await empty.$('.share-sheet')), 'with no roster open no sheet is opened');
  ok(/Save a roster first/.test(await empty.textContent('#msg')),
    'and the page says what to do instead: ' + JSON.stringify(await empty.textContent('#msg')));
} else {
  ok(true, 'the toolbar (and with it the share button) is hidden until a roster exists');
}

/* ── 8. a mangled link fails in words, once ─────────────────────────────── */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
await broken.goto(URL_PAGE + '?roster=not-base64-%%%', { waitUntil: 'domcontentloaded' });
await settle(broken, 700);
ok(/could not be read/.test(await broken.textContent('#msg')),
  'a mangled link says so rather than opening blank: ' + JSON.stringify(await broken.textContent('#msg')));
eq(new URL(broken.url()).searchParams.get('roster'), null,
  'and is cleared even though it was unusable, so a refresh does not repeat the failure');

/* ── 9. no console noise ────────────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['empty', empty], ['broken-link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
