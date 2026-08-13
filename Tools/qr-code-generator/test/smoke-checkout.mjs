// smoke-checkout.mjs — the QR Code Generator's equipment check-out ledger.
//
//   node Tools/qr-code-generator/test/smoke-checkout.mjs
//
// "Scan a code" mode could already decode any QR code (camera or an uploaded
// photo) and show what it contains. What it could not do was remember
// anything about that code between scans — no record of which lab kit went
// out to which table, no way to tell "returned" from "still out" short of
// asking around the room. This suite pins the ledger built on top of that
// existing scan-result handler.
//
// The camera path is not exercised here (no real camera in a headless
// browser, same reasoning the roster suite's neighbor left for scan mode
// generally) — every check below drives the upload/drop path instead, using
// a QR code this same page generates for itself first, exactly the way a
// teacher would print an asset code with this tool and later scan it back.
//
// What's actually under test, each a place a plausible implementation goes
// quietly wrong:
//
//   1. The ledger is keyed on the scanned code's own text, not the editable
//      label — re-scanning something already tracked must show its existing
//      state, not offer to "start tracking" a duplicate.
//   2. Checking out requires a name — an empty "who" must not silently
//      record a blank assignment.
//   3. Checking in clears who it was assigned to and flips the badge, without
//      losing the item from the ledger.
//   4. The ledger persists in localStorage under its own key, separate from
//      settings/recent/scanned, and survives a reload.
//   5. "Stop tracking" actually removes the entry, including from the
//      checkout panel if that's the code currently on screen.
//   6. The printable inventory sheet is populated only from tracked items,
//      not left over from module scope, and the print-only body class comes
//      off on `afterprint` the same way the existing bulk-grid print path
//      already works.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8192;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/016-qr-code-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });

console.log('QR Code Generator — equipment check-out ledger');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(r => localStorage.setItem('np_rosters', JSON.stringify(r)), {
  'Period 3': ['Ada Lovelace', 'Grace Hopper'],
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 0. generate a code for ourselves to scan back in, same as a teacher
   printing an asset sticker and later scanning it off the shelf ─────────── */
const ASSET_CODE = 'asset:lab-kit-07';
await page.fill('#qr-text', ASSET_CODE);
await page.waitForFunction(
  () => document.getElementById('btn-png') && !document.getElementById('btn-png').disabled, null, { timeout: 10000 });
await settle(page, 300);
const dataUrl = await page.evaluate(() => document.getElementById('qr-canvas').toDataURL('image/png'));
const pngBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');

/* ── 1. switch to scan mode and upload the code — an untracked code offers
   to start tracking it, not a check-in/out control ──────────────────────── */
await page.click('label[for="mode-scan"]');
await settle(page, 200);
ok(await page.isVisible('#scan-content-pane'), 'scan pane is showing');
ok(await page.isVisible('#scan-checkout-card'), 'the new equipment check-out card is part of scan mode');

await page.setInputFiles('#scan-file-input', { name: 'asset.png', mimeType: 'image/png', buffer: pngBuffer });
await page.waitForFunction(
  () => /asset:lab-kit-07/.test(document.getElementById('scan-result').textContent), null, { timeout: 10000 });
await settle(page, 200);

ok(/isn.t tracked/i.test(await page.textContent('#checkout-panel')),
   'a code never seen before offers to start tracking, not check in/out controls');
ok(!(await page.isVisible('#checkout-who')), 'no "checking out to" field yet — nothing to track');

/* ── 2. track it, with an edited label ────────────────────────────────── */
await page.fill('#checkout-new-label', 'Lab Kit 07 — magnets');
await page.click('#btn-track-asset');
await settle(page, 200);

ok(/Lab Kit 07 . magnets/.test(await page.textContent('#checkout-panel')), 'the chosen label is shown, not the raw code');
ok(/Available/.test(await page.textContent('#checkout-panel')), 'a freshly-tracked item starts Available, not Checked out');
eq(await page.textContent('#inventory-summary'), '1 item tracked, 0 checked out.', 'the inventory summary counts it');
ok(!(await page.evaluate(() => document.getElementById('btn-print-inventory').disabled)),
   'print button turns on once something is tracked');

/* ── 3. checking out requires a name ─────────────────────────────────── */
await page.click('#btn-check-out');
await settle(page, 150);
ok(await page.isVisible('#checkout-msg.error'), 'checking out with no name shows an error');
ok(/Enter who/.test(await page.textContent('#checkout-msg')), 'and says what to do about it');
ok(/Available/.test(await page.textContent('#checkout-panel')), 'and the item is still Available — nothing recorded blank');

/* the roster names saved earlier suggest into the "who" field */
const whoOptions = await page.$$eval('#checkout-who-list option', els => els.map(o => o.value));
ok(whoOptions.includes('Ada Lovelace'), 'roster names are offered as suggestions: ' + JSON.stringify(whoOptions));

await page.fill('#checkout-who', 'Table 3');
await page.click('#btn-check-out');
await settle(page, 200);

ok(/Checked out/.test(await page.textContent('#checkout-panel')), 'now shows Checked out');
ok(/Table 3/.test(await page.textContent('#checkout-panel')), 'and to whom');
ok(!(await page.isVisible('#checkout-msg.error')), 'the earlier error clears on a successful check-out');
eq(await page.textContent('#inventory-summary'), '1 item tracked, 1 checked out.', 'the inventory summary reflects it');
ok(/Table 3/.test(await page.textContent('#inventory-list')), 'the ledger list shows who has it');

/* ── 4. persisted to its own key, survives a reload ──────────────────── */
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('qr-code-generator-inventory')));
const rec = stored['asset:lab-kit-07'];
ok(!!rec, 'keyed on the scanned code itself, not the label');
eq(rec.label, 'Lab Kit 07 — magnets', 'label carried through');
eq(rec.status, 'out', 'status persisted');
eq(rec.assignedTo, 'Table 3', 'assignment persisted');
ok(typeof rec.checkedOutAt === 'number' && rec.checkedOutAt > 0, 'a check-out timestamp was recorded');
ok(Array.isArray(rec.history) && rec.history[0].event === 'out' && rec.history[0].who === 'Table 3',
   'a history entry was appended: ' + JSON.stringify(rec.history));

for (const [name, other] of [
  ['settings', 'qr-code-generator-settings'],
  ['recent generated', 'qr-code-generator-recent'],
]) {
  const v = await page.evaluate(k => localStorage.getItem(k), other);
  ok(!(v && v.indexOf('lab-kit-07') !== -1), `the ledger did not leak into ${name}`);
}

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.click('label[for="mode-scan"]');
await settle(page, 200);
eq(await page.textContent('#inventory-summary'), '1 item tracked, 1 checked out.', 'the ledger survives a reload');
ok(/Table 3/.test(await page.textContent('#inventory-list')), 'and still shows the assignment');

/* re-scanning the same code shows its tracked state, not a duplicate "start
   tracking" prompt — the whole point of keying on the code, not the label */
await page.setInputFiles('#scan-file-input', { name: 'asset2.png', mimeType: 'image/png', buffer: pngBuffer });
await page.waitForFunction(
  () => /asset:lab-kit-07/.test(document.getElementById('scan-result').textContent), null, { timeout: 10000 });
await settle(page, 200);
ok(/Checked out/.test(await page.textContent('#checkout-panel')), 're-scanning the same code shows it is already tracked and out');
ok(!/isn.t tracked/i.test(await page.textContent('#checkout-panel')), 'not offered as a new item');

/* ── 5. checking in clears the assignment and flips the badge ──────────── */
await page.click('#btn-check-in');
await settle(page, 200);
ok(/Available/.test(await page.textContent('#checkout-panel')), 'checked back in shows Available');
ok(!/Table 3/.test(await page.textContent('#checkout-panel')), 'and the prior assignment is gone from the panel');
eq(await page.textContent('#inventory-summary'), '1 item tracked, 0 checked out.', 'the summary drops back to 0 checked out');

const afterCheckin = await page.evaluate(() => JSON.parse(localStorage.getItem('qr-code-generator-inventory'))['asset:lab-kit-07']);
eq(afterCheckin.status, 'in', 'status flipped back to in');
eq(afterCheckin.assignedTo, '', 'assignment cleared');
ok(afterCheckin.history[0].event === 'in' && afterCheckin.history[0].who === 'Table 3',
   'the check-in history entry remembers who had it: ' + JSON.stringify(afterCheckin.history[0]));

/* ── 6. the printable inventory sheet reflects tracked items only ──────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#btn-print-inventory');
await settle(page, 150);
ok(await page.evaluate(() => document.body.classList.contains('print-inventory')), 'print mode is toggled on for the print call');
const sheetText = await page.textContent('#print-area-inventory');
ok(/Lab Kit 07/.test(sheetText), 'the sheet lists the tracked item');
ok(/Available/.test(sheetText), 'and its current status');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await settle(page, 100);
ok(!(await page.evaluate(() => document.body.classList.contains('print-inventory'))),
   'the print-only body class comes back off after printing, same as the bulk grid path');

/* ── 7. stop tracking removes it, including from the panel showing it ──── */
await page.click('#btn-stop-tracking');
await settle(page, 200);
ok(/isn.t tracked/i.test(await page.textContent('#checkout-panel')), 'the panel reverts to "not tracked" for the same code');
eq(await page.textContent('#inventory-summary'),
   'No equipment tracked yet — scan a code above and click “Start tracking this item.”',
   'the ledger is empty again');
ok(await page.evaluate(() => document.getElementById('btn-print-inventory').disabled), 'print button disables with nothing to print');
const emptyStored = await page.evaluate(() => JSON.parse(localStorage.getItem('qr-code-generator-inventory')));
eq(Object.keys(emptyStored).length, 0, 'removed from storage too, not just the screen');

/* ── 8. this tool still never writes the shared roster key ─────────────── */
eq(await page.evaluate(() => JSON.parse(localStorage.getItem('np_rosters'))['Period 3'].length), 2,
   'np_rosters is untouched by any of the above');

/* ── 9. no console noise, nothing left the site ─────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
