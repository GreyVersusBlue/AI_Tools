// smoke-share.mjs — Name Picker: sharing a saved roster through the shared
// share sheet, and reading one back off a link.
//
//   node Tools/name-picker/test/smoke-share.mjs
//
// The Name Picker's two existing suites are pure Node (storage, picking,
// equity). Nothing had ever opened the page in a browser, so its roster share
// — a hand-built modal with its own drawRosterShareQr and no download at all
// — was the least-watched share code on the site while Path 6 P2 rewrote it.
//
// The shape here is different from every other adopter's, and that is what is
// under test: the 🔗 buttons are per-roster rows that updateRosterUI() rebuilds
// from scratch on every change, so there is no stable button to mount on, and
// each one shares a DIFFERENT roster. This tool calls Share.open() straight
// out of its click handler instead of Share.mount(), and the assertions below
// check that the sheet a given row opens carries that row's roster and not the
// last one rendered.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8237;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/007-Name Picker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// Non-ASCII on purpose: state-link.js base64-encodes through btoa(), which is
// Latin1-only without the encodeURIComponent dance around it.
const PERIOD_3 = ['Ada Lovelace', 'Nellie Bly', 'Zheng He', 'Renée Ortiz'];
const PERIOD_5 = ['Grace Hopper', 'Marco Polo'];

const server = await serve(PORT);
const browser = await launch();

console.log('Name Picker — sharing a saved roster');

/* ── two saved rosters, so "which one did the row share" is answerable ─── */
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(([p3, p5]) => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 3': p3, 'Period 5': p5 }));
}, [PERIOD_3, PERIOD_5]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

await page.click('#settingsBtn');
await settle(page, 400);
const rowNames = await page.$$eval('#rosterList [data-share]', bs => bs.map(b => b.getAttribute('data-share')));
eq(JSON.stringify(rowNames), JSON.stringify(['Period 3', 'Period 5']), 'both saved rosters have a share button');

/* ── 1. the second row opens the sheet for the SECOND roster ────────────
   The row buttons carry their own data-share attribute (the roster name);
   the sheet's rows carry data-share="copy"/"qr"/"download". Different
   meanings, same attribute name — the selectors below are scoped to
   .share-sheet for exactly that reason. */
await page.click('#rosterList [data-share="Period 5"]');
await settle(page, 300);
ok(await page.isVisible('.share-sheet[role="dialog"]'), 'the row\'s 🔗 opens the shared sheet as a dialog');
ok(/Period 5/.test(await page.textContent('.share-sheet h2')), 'titled with the roster that row is for');
const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
   'with copy, QR and download rows — the modal it replaced had no download at all: ' + JSON.stringify(rows));

const link5 = await page.evaluate(() => {
  let captured = null;
  const real = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
  });
  document.querySelector('.share-sheet button[data-share="copy"]').click();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: real });
  window.Share.close();
  return captured;
});
ok(!!link5 && link5.includes('roster='), 'the Copy link row produces a ?roster= URL');
const payload5 = await page.evaluate(u => window.StateLink.decodeState(new URL(u).searchParams.get('roster')), link5);
eq(payload5.name, 'Period 5', 'carrying the roster that row named');
eq(JSON.stringify(payload5.names), JSON.stringify(PERIOD_5), 'and its names, not the other roster\'s');

await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'and the sheet closes again');

/* ── 2. the QR row is available for a roster this small ─────────────────
   A roster is a short payload — this is the case where the sheet draws the
   code rather than greying it out, which is worth pinning because 044's
   plan is the other case in the same increment. */
await page.click('#rosterList [data-share="Period 3"]');
await settle(page, 300);
eq(await page.evaluate(() => document.querySelector('.share-sheet button[data-share="qr"]').disabled), false,
   'a four-name roster is well inside the QR budget');
await page.click('.share-sheet button[data-share="qr"]');
await settle(page, 300);
const qrW = await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width);
ok(qrW > 100, `so a QR is drawn (${qrW}px)`);

/* The sheet is a dialog the site-wide axe sweep can never see: that sweep
   opens every page with empty storage, and this one needs a saved roster
   AND a click before there is anything to scan. Rank 13's answer is to scan
   the STATE from a suite that already prepped it, which costs nothing here —
   the sheet is open, with its QR drawn, one line above. */
const sheetViolations = await a11yScan(page, { include: '.share-sheet-backdrop' });
eq(sheetViolations.length, 0,
   'the open share sheet has no serious/critical axe violations: ' + JSON.stringify(sheetViolations));

await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.$('.share-sheet')), 'Escape closes the sheet');

/* ── 3. the link lands on another browser as a NEW saved roster ─────────
   Never over one already there: the receiver below already has a "Period 5"
   of its own, with different people in it. */
const other = await prepPage(browser, BASE, { width: 1280, height: 950 });
await other.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(other, 400);
await other.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 5': ['Someone Else', 'Another Person'] }));
});
await other.goto(link5, { waitUntil: 'networkidle' });
await settle(other, 700);

const landed = await other.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')));
eq(JSON.stringify(landed['Period 5']), JSON.stringify(['Someone Else', 'Another Person']),
   'the roster already saved here is untouched');
ok(!!landed['Period 5 (2)'], 'the arrival is saved beside it under a uniqued name: ' + JSON.stringify(Object.keys(landed)));
eq(JSON.stringify(landed['Period 5 (2)']), JSON.stringify(PERIOD_5), 'with the sender\'s names');
ok((await other.inputValue('#namesInput')).includes('Grace Hopper'), 'and it is the roster now loaded');
eq(new URL(other.url()).searchParams.get('roster'), null,
   'the parameter is consumed on open, so a refresh cannot re-import it');

/* ── 4. a mangled link fails once, not on every load ────────────────────
   share.js clears the param BEFORE it judges the payload, which is what
   stops a bad link meeting the teacher again on every refresh. */
const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
const alerts = [];
broken.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });
await broken.goto(URL_PAGE + '?roster=not-base64-%%%', { waitUntil: 'networkidle' });
await settle(broken, 600);
ok(alerts.some(m => /roster data looks corrupted/.test(m)),
   'a mangled link says so in this tool\'s own words: ' + JSON.stringify(alerts));
eq(new URL(broken.url()).searchParams.get('roster'), null, 'and the param is cleared anyway');

/* ── no console noise anywhere ──────────────────────────────────────────── */
for (const [name, p] of [['sender', page], ['receiver', other], ['broken link', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
