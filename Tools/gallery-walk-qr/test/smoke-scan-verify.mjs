// smoke-scan-verify.mjs — batch-verify every generated code before printing.
//
//   node Tools/gallery-walk-qr/test/smoke-scan-verify.mjs
//
// This tool built a printable batch of QR codes and trusted that whatever
// `qrcode.js` drew would scan. It usually does — but a long link at a low
// error-correction level, or content that pushes right up against a QR
// version's capacity, can produce a code that renders fine on screen and
// still fails a real scanner. Thirty of those on a wall is a reprint, not a
// typo. The fix mirrors what 016-qr-code-generator.html's bulk mode already
// does: decode the canvas immediately after drawing it with jsQR — no
// camera, just "does this read back the text it was built from" — and flag
// any station where it doesn't, before a teacher spends the ink.
//
// Four things are under test:
//
//   1. A real, honestly-generated code is NOT flagged — the check has to
//      agree with itself or it's just noise a teacher learns to ignore.
//   2. A code that fails to decode back to its own content — forced here by
//      wrapping window.jsQR so a chosen station's result comes back altered,
//      since building a QR code that jsQR itself can't read is not something
//      a test should have to construct by hand — gets a visible per-card
//      badge, is named in the summary banner above the print buttons, and is
//      counted in the preview note.
//   3. "Print QR Codes" gates on that result: any unverified station triggers
//      a confirm() naming it, and dismissing it stops the print from firing.
//   4. Accepting that confirm — or having nothing to flag in the first place —
//      lets the print go through with no dialog in the way.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8209;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/017-gallery-walk-qr.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('Gallery Walk QR Codes — batch scan-verify before printing');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── fill in two stations: row 0 (Dioramas) already exists on a fresh
   gallery, row 1 (Timelines) is added ─────────────────────────────────── */
async function fillRow(i, name, value) {
  while ((await page.$$('#entriesBody tr')).length <= i) { await page.click('#addRowBtn'); await settle(page, 80); }
  const row = (await page.$$('#entriesBody tr'))[i];
  await row.$eval('.f-name', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, name);
  await row.$eval('.f-value', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}

await fillRow(0, 'Dioramas', 'https://example.org/dioramas');
await fillRow(1, 'Timelines', 'https://example.org/timelines');
await settle(page, 400);

/* ── 1. two honestly-generated codes: nothing is flagged ────────────────── */
eq(await page.$$eval('.preview-card', els => els.length), 2, 'both stations rendered a preview card');
eq(await page.$$eval('.preview-card.scan-unverified', els => els.length), 0,
   'a real code that decodes to itself is not flagged');
eq(await page.$$eval('.scan-warn-badge', els => els.length), 0, 'no per-card warning badges yet');
ok(!(await page.evaluate(() => document.getElementById('scanWarning').classList.contains('show'))),
   'and the summary banner stays hidden');
ok(!/flagged/.test(await page.textContent('#previewNote')), 'the preview note says nothing about flagged codes');

/* ── 2. force one station's code to fail the local test-scan ────────────── */
// Building a QR payload that jsQR itself can't decode isn't something a test
// should hand-construct — instead, wrap jsQR so results for the "timelines"
// station come back altered, the same effect a bad print would have, without
// touching the encoder or the tool's own verification logic under test.
await page.evaluate(() => {
  const real = window.jsQR;
  window.jsQR = function (data, w, h) {
    const res = real(data, w, h);
    if (res && res.data && res.data.indexOf('timelines') !== -1) {
      return { data: res.data + '-smudged' };
    }
    return res;
  };
});
// Nudge a re-render without changing content, so the wrapped jsQR runs —
// re-dispatching input on a value field is what the entry table itself does
// on every keystroke (see the entriesBody 'input' listener), so this is the
// same trigger a teacher editing a station would cause.
await page.$eval('#entriesBody tr:nth-child(2) .f-value', el => el.dispatchEvent(new Event('input', { bubbles: true })));
await settle(page, 400);

const badgeTexts = await page.$$eval('.scan-warn-badge', els => els.map(e => e.textContent));
eq(badgeTexts.length, 1, 'exactly the one tampered station is flagged, not both');
ok(/scan reliably/i.test(badgeTexts[0]), 'the badge says a code will not scan reliably: ' + badgeTexts[0]);

const flaggedCard = await page.evaluateHandle(() =>
  Array.from(document.querySelectorAll('.preview-card')).find(c => c.classList.contains('scan-unverified')));
const flaggedName = await page.evaluate(el => el.querySelector('.p-name').textContent, flaggedCard);
eq(flaggedName, 'Timelines', 'the flagged card is the one whose scan was tampered with');

const okCard = await page.evaluateHandle(() =>
  Array.from(document.querySelectorAll('.preview-card')).find(c => !c.classList.contains('scan-unverified')));
const okName = await page.evaluate(el => el.querySelector('.p-name').textContent, okCard);
eq(okName, 'Dioramas', 'the untouched station is not caught in the net');

const bannerText = await page.textContent('#scanWarning');
ok(await page.evaluate(() => document.getElementById('scanWarning').classList.contains('show')),
   'the summary banner above the print buttons turns on');
ok(/1 code/.test(bannerText) && /Timelines/.test(bannerText),
   'and names the flagged station, not just a count: ' + JSON.stringify(bannerText));

ok(/1 flagged below/.test(await page.textContent('#previewNote')), 'the preview note reflects the flagged count');

/* ── 3. "Print QR Codes" gates on it — dismiss stops the print ──────────── */
let dialogSeen = null;
page.once('dialog', async d => { dialogSeen = d.message(); await d.dismiss(); });
await page.click('#printCodesBtn');
await settle(page, 300);
ok(dialogSeen !== null, 'clicking Print with an unverified code present raises a confirmation');
ok(/Timelines/.test(dialogSeen || ''), 'naming the station in the dialog: ' + JSON.stringify(dialogSeen));
ok(!(await page.evaluate(() => document.getElementById('printQrArea').classList.contains('active'))),
   'dismissing it means the print view never goes live');

/* ── 4. accepting the confirmation lets the print proceed ───────────────── */
dialogSeen = null;
page.once('dialog', async d => { dialogSeen = d.message(); await d.accept(); });
await page.click('#printCodesBtn');
await settle(page, 300);
ok(dialogSeen !== null, 'the same confirmation appears on a second attempt');
ok(await page.evaluate(() => document.getElementById('printQrArea').classList.contains('active')),
   'and accepting it lets the print view go live');

/* ── 5. once every code verifies clean again, Print does not ask at all ─── */
// A full reload drops the tampered window.jsQR wrapper along with everything
// else the page attached it to — the real jsQR is back in charge.
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await fillRow(0, 'Dioramas', 'https://example.org/dioramas');
await fillRow(1, 'Timelines', 'https://example.org/timelines');
await settle(page, 400);

let unexpectedDialog = false;
page.once('dialog', async d => { unexpectedDialog = true; await d.dismiss(); });
await page.click('#printCodesBtn');
await settle(page, 300);
ok(!unexpectedDialog, 'with nothing flagged, Print goes straight through — no dialog in the way');
ok(await page.evaluate(() => document.getElementById('printQrArea').classList.contains('active')),
   'and the print view goes live directly');

/* ── 6. no console noise, nothing left the site ──────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
