// smoke-contact-sheet.mjs — the lab safety tracker's parent-contact sheet.
//
//   node Tools/lab-safety-contract-tracker/test/smoke-contact-sheet.mjs
//
// "Print missing list" answers who still owes a contract. It does not help
// with the part that takes the time: calling or emailing home, twice, and
// being able to say what was tried and when if an administrator or a parent
// asks later.
//
// What this pins down: the sheet carries exactly the missing students (never a
// signed one), it prints what the tool knows (which documents, what is unpaid,
// the teacher's note) and leaves blank what only the teacher will know, and
// the existing prints are untouched.
//
// Also covers the per-student QR code stamped on "Print blank forms" and the
// "Scan returned forms" check-off tracker built on top of it: the printed
// code actually decodes (via the same jsQR build the scanner uses) to the
// code the tracker generated, and the decode -> match -> check-off pipeline
// (fed decoded text directly, the same shape the camera would deliver) is
// exercised for the checked / duplicate / unmatched-code / unmatched-student
// / wrong-class paths.
//
// Exits 1 on any failure. Every student name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8185;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/013-lab-safety-contract-tracker.html';

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

// window.print() would block a headless run on the print dialog.
await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });

console.log('Lab Safety Tracker — parent-contact follow-up sheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── a class of four, two of whom have turned theirs in ────────────────── */
await page.fill('#rosterInput', 'Ada Okonkwo\nBen Marsh\nCarla Reyes\nDmitri Volkov');
await page.click('#saveRosterBtn');
await settle(page, 400);

// Sign the first two through the tool's own toggle buttons.
const rowCount = await page.$$eval('#studentRows .student-row', e => e.length);
eq(rowCount, 4, 'the roster rendered a row per student');
for (const name of ['Ada Okonkwo', 'Ben Marsh']) {
  await page.click(`#studentRows .student-row[data-name="${name}"] .status-toggle:not(.paid-toggle)`);
  await settle(page, 200);
}
eq(await page.$$eval('#studentRows .student-row.signed', e => e.length), 2, 'two students now read as signed');

// A teacher note on one of the missing students, to prove it travels.
await page.fill('#studentRows .student-row[data-name="Carla Reyes"] .s-note', 'Dad asked for a Spanish copy');
await page.dispatchEvent('#studentRows .student-row[data-name="Carla Reyes"] .s-note', 'input');
await settle(page, 400);

/* ── print the contact sheet ───────────────────────────────────────────── */
await page.click('#printContactBtn');
await settle(page, 300);

const active = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.print-only.active')).map(e => e.id));
eq(JSON.stringify(active), JSON.stringify(['printContactArea']), 'only the contact sheet is the active print area');
ok(await page.evaluate(() => window.__printed > 0), 'the print dialog was asked for');

const text = await page.textContent('#printContactArea');
ok(/Parent Contact Log/.test(text), 'it is titled as a contact log');
ok(text.includes('Carla Reyes') && text.includes('Dmitri Volkov'), 'both missing students are on it');
ok(!text.includes('Ada Okonkwo') && !text.includes('Ben Marsh'), 'and neither signed student is');
ok(/2 students to chase/.test(text), 'the count is stated: ' + (text.match(/\d+ students? to chase/) || [])[0]);
ok(text.includes('Dad asked for a Spanish copy'), 'the teacher note travels onto the chase sheet');

const rows = await page.$$eval('#printContactBody tr.contact-row', e => e.length);
eq(rows, 2, 'one row per student to chase');

const firstRow = await page.$eval('#printContactBody tr.contact-row', r => ({
  cells: r.children.length,
  attempts: r.querySelectorAll('.contact-attempt').length,
  methods: r.querySelector('.c-methods') ? r.querySelector('.c-methods').textContent : '',
  lines: r.querySelectorAll('.c-line').length,
  outcomeEmpty: r.children[2].textContent.trim() === '',
}));
eq(firstRow.cells, 3, 'student / attempts / outcome');
eq(firstRow.attempts, 2, 'two dated attempts per student — one call is rarely the whole chase');
ok(/Call/.test(firstRow.methods) && /Email/.test(firstRow.methods) && /Note.home/.test(firstRow.methods),
   'the methods are tick boxes, not free text: ' + firstRow.methods);
ok(firstRow.lines >= 2, 'each attempt has a date line to write on');
ok(firstRow.outcomeEmpty, 'the outcome column is left blank for the pen');
ok(/Kept by:/.test(await page.textContent('.contact-by')), 'the sheet records who kept it');

/* ── the existing prints still work and are unchanged ──────────────────── */
await page.click('#printMissingBtn');
await settle(page, 250);
const active2 = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.print-only.active')).map(e => e.id));
eq(JSON.stringify(active2), JSON.stringify(['printMissingArea']), 'the missing list still prints on its own');
ok(!(await page.textContent('#printMissingArea')).includes('Contact attempts'),
   'and did not grow contact columns');

/* ── everybody signed: the sheet says so instead of printing blank ─────── */
// "Mark all as signed" confirms first (P11); Playwright dismisses dialogs by
// default, which would silently make this check pass for the wrong reason.
page.once('dialog', d => d.accept());
await page.click('#markAllSignedBtn');
await settle(page, 400);
await page.click('#printContactBtn');
await settle(page, 250);
ok(/nobody to contact/.test(await page.textContent('#printContactArea')),
   'with nothing to chase, the sheet says so');

/* ── per-student codes on the printed blank contract, and the scan-to-check-
   off tracker that reads them back ("Scan returned forms") ───────────────
   Isolated in a fresh class so the mark-all-signed state above doesn't get
   in the way of testing the checked/duplicate/unmatched paths below. */
page.once('dialog', d => d.accept('QR Scan Test Class'));
await page.click('#newSectionBtn');
await settle(page, 300);

await page.fill('#rosterInput', 'Aiden Kapoor\nBrianna Cole\nCarmen Diaz');
await page.click('#saveRosterBtn');
await settle(page, 300);

const scanDocId = await page.$eval('#docsEditor .doc-row', el => el.dataset.id);

await page.click('#printFormsBtn');
await settle(page, 300);

const activeForms = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.print-only.active')).map(e => e.id));
eq(JSON.stringify(activeForms), JSON.stringify(['printFormsArea']), 'print blank forms is the active print area');

eq(await page.$$eval('#printFormsBody .form-page', e => e.length), 3, 'one blank form per roster student');

const firstQr = await page.$eval('#printFormsBody .form-page:first-child .form-qr img', img => ({
  src: img.getAttribute('src') || '',
  alt: img.getAttribute('alt') || '',
}));
ok(firstQr.src.startsWith('data:image/png'), 'each blank form carries a rendered QR code, not a dead include');
ok(firstQr.alt.includes('Aiden Kapoor'), 'the code is captioned with the student it identifies: ' + firstQr.alt);

// Decode the actual printed image with the same jsQR build the scanner
// uses, and confirm it round-trips to exactly the code the tracker itself
// would generate — not just "some image got drawn".
const expectedCode = await page.evaluate(
  ({ docId, name }) => window.LSCT_TEST.buildStudentCodeText(docId, name),
  { docId: scanDocId, name: 'Aiden Kapoor' }
);
const decodedFromPrint = await page.evaluate((src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(data.data, data.width, data.height);
    resolve(code ? code.data : null);
  };
  img.onerror = () => resolve(null);
  img.src = src;
}), firstQr.src);
eq(decodedFromPrint, expectedCode, 'the printed QR decodes to exactly the per-student code the tracker generated');

/* ── the scanner's decode → match → check-off pipeline, fed decoded text
   directly (same shape scanQRFromCamera's onResult delivers) — no camera
   needed, matching how scanning a returned paper actually behaves ────── */
const firstScan = await page.evaluate(code => window.LSCT_TEST.processScannedCode(code), expectedCode);
eq(firstScan.status, 'checked', 'scanning a returned form checks that student off');
ok(await page.$eval('#studentRows .student-row[data-name="Aiden Kapoor"]', el => el.classList.contains('signed')),
   'Aiden now reads as signed after the scan');

const secondScan = await page.evaluate(code => window.LSCT_TEST.processScannedCode(code), expectedCode);
eq(secondScan.status, 'duplicate', 'scanning the same returned form twice is a no-op, not a second check-off');

const badCodeScan = await page.evaluate(() => window.LSCT_TEST.processScannedCode('not a real qr payload'));
eq(badCodeScan.status, 'bad-code', 'a code this tracker never printed is reported clearly, not silently dropped');

const unknownStudentCode = await page.evaluate(
  ({ docId }) => window.LSCT_TEST.buildStudentCodeText(docId, 'Someone Not On Roster'),
  { docId: scanDocId }
);
const unknownStudentScan = await page.evaluate(code => window.LSCT_TEST.processScannedCode(code), unknownStudentCode);
eq(unknownStudentScan.status, 'unknown-student', 'a code for a student not on this roster is reported as unmatched');

const wrongClassCode = 'LSCT1|' + encodeURIComponent('Some Other Class') + '|' +
  encodeURIComponent(scanDocId) + '|' + encodeURIComponent('Brianna Cole');
const wrongClassScan = await page.evaluate(code => window.LSCT_TEST.processScannedCode(code), wrongClassCode);
eq(wrongClassScan.status, 'wrong-class', 'a code printed for a different class is not silently applied to this one');

ok(!(await page.$eval('#studentRows .student-row[data-name="Brianna Cole"]', el => el.classList.contains('signed'))),
   'Brianna is untouched by the bad/unmatched scans above — only a matching code checks anyone off');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
