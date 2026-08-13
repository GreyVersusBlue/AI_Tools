// smoke-scan-tracker.mjs — scanning a returned slip's QR to check it off.
//
//   node Tools/field-trip-permission-slip/test/smoke-scan-tracker.mjs
//
// Each printed slip already carries a QR code (see buildSlipQrPayload in the
// tool). This suite holds down the collection tracker's camera-scan feature:
// scanning that QR looks up the student it names on the current roster and
// checks them off, without a camera in the loop.
//
// A real device camera can't be driven under headless Playwright, so instead
// of simulating camera frames this suite decodes the QR the tool actually
// generates (via the same vendored jsQR the camera path uses, run once
// against the printed <img>'s data URL) and feeds the resulting text into
// `window.__ftpsResolveScan(text)` — the exact function the camera's
// `onResult` callback calls. That exercises the real encode -> decode ->
// match -> check-off round trip, just without a video feed in the middle.
//
// What's held down:
//
//   The QR payload is tagged JSON — { ftps: 1, trip, student } — not free
//   text, and each student's slip carries their own name, not a copy of one
//   shared trip-level code.
//
//   A first scan checks the student off and updates the running count. A
//   second scan of the same code is a no-op with an "already collected"
//   message, not a double-count or an error.
//
//   A code naming a student not on the current roster, one from a different
//   saved trip, one with no student at all (a blank copy), one with an
//   empty roster to match against, and plain garbage text are all reported
//   clearly through the status banner and never throw.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8144;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/043-field-trip-permission-slip.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

/** Decodes the QR <img> at `selector` using the page's own jsQR — the same
 *  decoder the camera path uses — by drawing its data URL into a canvas. */
async function decodeQrImg(selector) {
  return page.evaluate(async (sel) => {
    const img = document.querySelector(sel);
    if (!img) return null;
    const src = img.getAttribute('src');
    if (!src) return null;
    const image = new Image();
    image.src = src;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('image failed to load'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  }, selector);
}

/** window.__ftpsResolveScan(text) — the same call the camera's onResult
 *  callback makes — run from the test, standing in for a scan. */
const scan = (text) => page.evaluate((t) => window.__ftpsResolveScan(t), text);

const collectionRowText = () => page.evaluate(() =>
  document.getElementById('collectionSummary') ? document.getElementById('collectionSummary').textContent : '');

const isReturnedChecked = (name) => page.evaluate((n) => {
  const box = document.querySelector('[data-collected-returned="' + n + '"]');
  return box ? box.checked : null;
}, name);

console.log('Field Trip Permission Slip — scan a returned slip to check it off');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.fill('#tripName', 'Science Museum Trip');
await page.fill('#destination', 'City Science Center');
await page.click('.mode-tab[data-mode="batch"]');
await settle(page);
await page.fill('#batchNames', 'Ava Reyes\nBen Okafor\nCara Lin');
await settle(page, 300);

/* ── 0. the scan API is there, and nothing has fired yet ─────────────────── */
ok(await page.evaluate(() => typeof window.__ftpsResolveScan === 'function'),
  'the tracker exposes a scan-resolution entry point for the test suite (and, in production, the camera path)');

/* ── 1. build a printed slip per student and decode each one's own QR ────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);

const names = ['Ava Reyes', 'Ben Okafor', 'Cara Lin'];
const slipCount = await page.evaluate(() => document.querySelectorAll('#printArea .slip').length);
eq(slipCount, 3, 'three students, three slips printed');

const payloads = [];
for (let i = 0; i < names.length; i++) {
  const text = await decodeQrImg(`#printArea .slip:nth-of-type(${i + 1}) .slip-qr`);
  payloads.push(text);
  ok(!!text, `slip ${i + 1}'s QR decodes to something`);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* asserted below */ }
  ok(parsed && parsed.ftps === 1, `slip ${i + 1}'s QR is tagged JSON (ftps: 1): ` + text);
  eq(parsed && parsed.trip, 'Science Museum Trip', `slip ${i + 1}'s QR names the trip`);
  eq(parsed && parsed.student, names[i], `slip ${i + 1}'s QR names its own student, not a shared trip-level code`);
}
ok(new Set(payloads).size === payloads.length, 'each student’s QR payload is distinct from the others');

/* ── 2. scanning a decoded code checks that student off ──────────────────── */
eq(await isReturnedChecked('Ava Reyes'), false, 'Ava starts unreturned');
const r1 = await scan(payloads[0]);
eq(r1.status, 'checked-off', 'scanning Ava’s slip checks her off');
eq(r1.student, 'Ava Reyes', 'and reports which student');
eq(await isReturnedChecked('Ava Reyes'), true, 'her Returned checkbox is now checked');
ok(/1 of 3 returned/.test(await collectionRowText()), 'and the running count updates: ' + JSON.stringify(await collectionRowText()));
const banner1 = await page.evaluate(() => document.getElementById('scanStatus').textContent);
ok(/Checked off: Ava Reyes/.test(banner1), 'the status banner confirms it: ' + JSON.stringify(banner1));
ok(await page.evaluate(() => document.getElementById('scanStatus').classList.contains('ok')), 'styled as a success');

/* ── 3. a duplicate scan is a graceful no-op, not an error or double count ─ */
const r2 = await scan(payloads[0]);
eq(r2.status, 'duplicate', 'scanning the same slip again is recognized as a duplicate');
eq(r2.student, 'Ava Reyes', 'still names the student');
ok(/already checked off/.test(await page.evaluate(() => document.getElementById('scanStatus').textContent)),
  'the banner says so in plain language');
ok(/1 of 3 returned/.test(await collectionRowText()), 'the count does not move on a duplicate scan');
eq(await isReturnedChecked('Ava Reyes'), true, 'still checked, not toggled off');

/* ── 4. a code naming nobody on this roster is a clear, non-crashing error ─ */
const unmatched = JSON.stringify({ ftps: 1, trip: 'Science Museum Trip', student: 'Nobody Here' });
const r3 = await scan(unmatched);
eq(r3.status, 'unmatched', 'an unrecognized student name is reported, not silently ignored');
ok(/No student named/.test(await page.evaluate(() => document.getElementById('scanStatus').textContent)),
  'named in the banner');
ok(/1 of 3 returned/.test(await collectionRowText()), 'and nothing on the roster changes');

/* ── 5. a code from a different saved trip is caught, not cross-applied ──── */
const wrongTrip = JSON.stringify({ ftps: 1, trip: 'Fall Field Day', student: 'Ben Okafor' });
const r4 = await scan(wrongTrip);
eq(r4.status, 'trip-mismatch', 'a slip printed for a different trip is refused rather than checking off a same-named student here');
eq(await isReturnedChecked('Ben Okafor'), false, 'Ben is untouched by the wrong-trip scan');
ok(/different trip/.test(await page.evaluate(() => document.getElementById('scanStatus').textContent)),
  'and the banner explains why');

/* ── 6. a blank-copy slip has no student to check off ─────────────────────── */
const blankSlip = JSON.stringify({ ftps: 1, trip: 'Science Museum Trip', student: '' });
const r5 = await scan(blankSlip);
eq(r5.status, 'no-student', 'a blank copy’s QR (no name filled in yet) is recognized, not treated as a match for nobody');

/* ── 7. garbage input never crashes the scanner ───────────────────────────── */
const r6 = await scan('this is not a QR payload at all');
eq(r6.status, 'invalid', 'unrelated text (someone else’s QR code) is rejected cleanly');
const r7 = await scan('{"totally": "unrelated json"}');
eq(r7.status, 'invalid', 'JSON that isn’t this tool’s schema is rejected the same way');

/* ── 8. round out the roster, then confirm the summary tracks all of it ──── */
const r8 = await scan(payloads[1]); // Ben
eq(r8.status, 'checked-off', 'Ben’s own slip (not the wrong-trip one) checks him off');
const r9 = await scan(payloads[2]); // Cara
eq(r9.status, 'checked-off', 'and Cara’s');
ok(/3 of 3 returned/.test(await collectionRowText()), 'all three now show returned: ' + JSON.stringify(await collectionRowText()));

/* ── 9. an empty roster is reported, not matched against nothing ─────────── */
await page.fill('#batchNames', '');
await settle(page, 300);
const r10 = await scan(payloads[0]);
eq(r10.status, 'no-roster', 'scanning with no student names loaded says so instead of failing to match silently');
await page.fill('#batchNames', 'Ava Reyes\nBen Okafor\nCara Lin');
await settle(page, 300);

/* ── 10. the scan panel's own UI opens and closes without console noise ──── */
await page.click('#scanSlipBtn');
await settle(page, 400);
ok(await page.isVisible('#scanCamOverlay'), 'the camera modal opens');
await settle(page, 800); // let getUserMedia resolve/reject in this camera-less headless run
const camStatus = await page.textContent('#scanCamStatus');
ok(/Camera unavailable|Point the camera/.test(camStatus), 'no camera in this environment is reported in the modal, not thrown: ' + JSON.stringify(camStatus));
await page.click('#scanCamCancel');
await settle(page, 200);
ok(!(await page.isVisible('#scanCamOverlay')), 'and Cancel closes it again');

/* ── 11. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site (no upload, camera access only): ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
