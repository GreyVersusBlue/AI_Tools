// smoke-export.mjs — the Class Roster Hub's roster export, and its
// device-to-device transfer ("Move Everything to Another Device").
//
//   node Tools/class-roster-hub/test/smoke-export.mjs
//
// A roster typed in here is the canonical class list for the whole site, and
// the only way out of the browser used to be a printed page. What a gradebook
// import or a sub folder wants is columns. This drives the real buttons and
// reads the real downloads.
//
// The join under test is the interesting part: np_rosters holds the names,
// crh_students_v1 hangs preferred name and pronunciation off them, and the
// roster's period/course/year live on the sidecar's meta. A roster the sidecar
// has never seen — one written by Name Picker years ago — still has to export,
// just with empty detail columns.
//
// Part 2 (below the export checks) covers the WebRTC handoff added for the
// "All-rosters device transfer" backlog item — moving every roster, its
// crh_students_v1 sidecar detail, and everything in crh_archive_v1 (archived
// rosters and rolled-over school years) to another device with no file ever
// touching disk. What's verified end-to-end vs. logic-only is called out
// where each part starts, since a real two-device WebRTC handshake can't be
// fully simulated in one headless run but a huge amount of it can — two
// Playwright browser contexts on 127.0.0.1 really do complete a genuine
// host-candidates-only WebRTC connection to each other (loopback is a valid
// "same machine" ICE candidate) and really do move bytes over a real
// RTCDataChannel, chunked exactly the way a cross-room transfer would be.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8158;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/006-class-roster-hub.html';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

async function download(selector) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click(selector),
  ]);
  const dest = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(dest);
  return dest;
}

const readSheets = (file) => page.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wb = XLSX.read(bin, { type: 'array' });
  return wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) }));
}, fs.readFileSync(file).toString('base64'));

console.log('Class Roster Hub — roster export to spreadsheet');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── seed one detailed roster and one bare, Name-Picker-era roster ─────── */
await page.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({
    'Period 3 — Earth Science': ['Ada Lovelace', 'Marco Polo', "Fatima al-Fihri"],
    'Period 5/6 Honors': ['Nellie Bly', 'Zheng He'],
  }));
  // Only the first roster has a sidecar record — the second is what a roster
  // written by another tool before this one existed looks like.
  localStorage.setItem('crh_students_v1', JSON.stringify({
    version: 1,
    rosters: {
      'Period 3 — Earth Science': {
        meta: { period: '3', subject: 'Earth Science', term: '2026–27' },
        students: [
          { id: 's1', name: 'Ada Lovelace', preferred: 'Addie', say: 'AY-duh' },
          { id: 's2', name: 'Marco Polo', preferred: '', say: '' },
          { id: 's3', name: "Fatima al-Fihri", preferred: 'Tima', say: 'fah-TEE-mah' },
        ],
        orphans: [],
      },
    },
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

await page.selectOption('#rosterSwitch', 'Period 3 — Earth Science');
await settle(page, 300);

/* ── 1. the controls exist and default to the open roster ──────────────── */
eq(await page.inputValue('#exportScope'), 'one', 'the export defaults to the roster you have open');

/* ── 2. CSV of one roster ──────────────────────────────────────────────── */
const csv = fs.readFileSync(await download('#exportCsvBtn'), 'utf8');
ok(csv.charCodeAt(0) === 0xfeff, 'the CSV starts with a BOM so Excel on Windows reads accented names');
const csvLines = csv.replace(/^﻿/, '').trim().split('\r\n');
eq(csvLines[0], '#,Name,Preferred name,Pronunciation,Period / block,Course,School year',
   'one roster exports without a Roster column');
eq(csvLines.length, 4, 'a header plus the three students');
eq(csvLines[1], '1,Ada Lovelace,Addie,AY-duh,3,Earth Science,2026–27',
   'the sidecar detail and the roster meta are joined onto the name');
ok(/Fatima al-Fihri,Tima,fah-TEE-mah/.test(csv), 'an accented/hyphenated name survives');

/* ── 3. CSV of every roster, including one with no sidecar record ──────── */
await page.selectOption('#exportScope', 'all');
const csvAll = fs.readFileSync(await download('#exportCsvBtn'), 'utf8').replace(/^﻿/, '');
const allLines = csvAll.trim().split('\r\n');
eq(allLines[0].split(',')[0], 'Roster', 'exporting everything adds a Roster column');
eq(allLines.length, 6, 'a header plus all five students across both rosters');
ok(allLines.some(l => l.startsWith('Period 5/6 Honors,1,Nellie Bly,,,,')),
   'a roster with no sidecar record still exports, with empty detail columns: ' + JSON.stringify(allLines.slice(-2)));

/* ── 4. Excel — one sheet per roster ───────────────────────────────────── */
const xlsxPath = await download('#exportXlsxBtn');
eq(fs.readFileSync(xlsxPath).subarray(0, 2).toString('latin1'), 'PK', 'a real .xlsx zip came out');
const sheets = await readSheets(xlsxPath);
eq(sheets.length, 2, 'one sheet per roster');
ok(sheets.some(s => s.name === 'Period 3 — Earth Science'), 'sheets are named after their roster');
ok(sheets.some(s => s.name === 'Period 5 6 Honors'),
   'a slash is stripped from the sheet name — Excel rejects it: ' + JSON.stringify(sheets.map(s => s.name)));
const p3 = sheets.find(s => s.name.startsWith('Period 3'));
eq(p3.rows[0].join('|'), '#|Name|Preferred name|Pronunciation|Period / block|Course|School year', 'headed');
eq(p3.rows[1].join('|'), '1|Ada Lovelace|Addie|AY-duh|3|Earth Science|2026–27', 'with the joined detail');
eq(typeof p3.rows[1][0], 'number', 'the row number is a number, not text');

/* ── 5. unsaved edits on screen are what gets exported ─────────────────── */
await page.selectOption('#exportScope', 'one');
await page.click('#tabText');
await settle(page, 200);
await page.fill('#namesInput', 'Ada Lovelace\nMarco Polo\nFatima al-Fihri\nGrace Hopper');
await page.dispatchEvent('#namesInput', 'input');
await settle(page, 300);
const csvLive = fs.readFileSync(await download('#exportCsvBtn'), 'utf8').replace(/^﻿/, '');
ok(/Grace Hopper/.test(csvLive), 'a student added but not yet saved is still in the export');

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

/* ════════════════════════════════════════════════════════════════════════
   PART 2 — device-to-device transfer ("Move Everything to Another Device")

   Verified END-TO-END below, with a real WebRTC connection: two Playwright
   browser contexts (two separate localStorage stores — "device A" and
   "device B") on the same 127.0.0.1 server, driving the actual buttons —
   Send, paste/generate the pairing codes, Connect, and finally Import —
   exactly as a teacher would, including the camera-free paste path (no
   getUserMedia in a headless run, so the "Scan with camera" buttons
   themselves are NOT exercised here — only the manual code exchange is).
   _shared/webrtc-pair.js is host-candidates-only by design, so two
   contexts on 127.0.0.1 really do negotiate a genuine peer connection —
   loopback is a valid same-machine ICE candidate — and bytes really do
   cross a real RTCDataChannel, chunked the same way a cross-room transfer
   would be.

   This single scenario also stands in for the "export the full payload,
   reimport it, verify nothing is lost or duplicated" round-trip check the
   task asked for: rather than unit-test buildHandoffPayload/
   applyHandoffPayload in isolation (they're private to the page's closure,
   not exposed on window, and exposing internal handles for the sake of a
   test isn't worth doing when the real UI already drives the exact same
   code path) the scenario below sends a payload deliberately shaped to
   exercise every part of it at once:
     - a detailed roster (sidecar meta + per-student preferred/say + an
       archived-withdrawn student) — proves the sidecar and per-roster
       archive both survive the round trip;
     - a bare roster with no sidecar record — proves a roster the sidecar
       has never seen still transfers (same fallback the export join
       already relies on);
     - a 200-student roster — big enough alone to guarantee the payload
       spans multiple 12 000-char chunks, so a correct final count is
       proof the chunk/reassembly protocol didn't drop or corrupt anything;
     - one individually archived roster and one archived school year in
       crh_archive_v1 — proves the archive, not just the active rosters,
       makes the trip;
     - a roster on the RECEIVING device that shares a name with one being
       sent — proves import is additive (restoreSnapshot's existing
       auto-rename-on-collision), never a destructive overwrite of
       whatever's already on the new device.
   ════════════════════════════════════════════════════════════════════════ */

console.log('\nClass Roster Hub — device-to-device transfer (WebRTC handoff)');

async function waitForValue(p, selector, timeoutMs = 20000) {
  await p.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!(el && el.value && el.value.length > 10);
  }, selector, { timeout: timeoutMs });
  return p.$eval(selector, (el) => el.value);
}
async function waitForTextMatch(p, selector, regex, timeoutMs = 20000) {
  await p.waitForFunction(
    ({ sel, src, flags }) => {
      const el = document.querySelector(sel);
      return !!(el && new RegExp(src, flags).test(el.textContent || ''));
    },
    { sel: selector, src: regex.source, flags: regex.flags },
    { timeout: timeoutMs }
  );
  return p.$eval(selector, (el) => el.textContent);
}
async function waitForVisible(p, selector, timeoutMs = 20000) {
  await p.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!(el && el.style.display !== 'none');
  }, selector, { timeout: timeoutMs });
}

const pageA = await prepPage(browser, BASE, { width: 1300, height: 1000 });
const pageB = await prepPage(browser, BASE, { width: 1300, height: 1000 });

/* ── seed "device A" (the sender): three active rosters, one individually
   archived roster, and one archived school year ──────────────────────── */
await pageA.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(pageA, 300);
await pageA.evaluate(() => {
  const bigNames = [];
  for (let i = 0; i < 200; i++) bigNames.push('Student ' + i + ' Testerson');
  localStorage.setItem('np_rosters', JSON.stringify({
    'Period 3 — Earth Science': ['Ada Lovelace', 'Marco Polo', 'Fatima al-Fihri'],
    'Period 5/6 Honors': ['Nellie Bly', 'Zheng He'],
    'Big Roster': bigNames,
  }));
  localStorage.setItem('crh_students_v1', JSON.stringify({
    version: 1,
    rosters: {
      'Period 3 — Earth Science': {
        meta: { period: '3', subject: 'Earth Science', term: '2026–27' },
        students: [
          { id: 's1', name: 'Ada Lovelace', preferred: 'Addie', say: 'AY-duh' },
          { id: 's2', name: 'Marco Polo', preferred: '', say: '' },
          { id: 's3', name: 'Fatima al-Fihri', preferred: 'Tima', say: 'fah-TEE-mah' },
        ],
        orphans: [],
      },
    },
  }));
  localStorage.setItem('crh_archived_students', JSON.stringify({
    'Period 3 — Earth Science': ['Old Student Who Left'],
  }));
  localStorage.setItem('crh_archive_v1', JSON.stringify({
    version: 1,
    rosters: [{
      name: 'Period 1 — Retired Class', names: ['Someone Gone'], meta: {},
      students: [], archivedStudents: [], archivedAt: Date.now(),
    }],
    years: [{
      id: 'y1', label: '2025–26', archivedAt: Date.now(),
      rosters: [{ name: 'Old Year Class', names: ['Past Student'], meta: {}, students: [], archivedStudents: [] }],
    }],
  }));
});
await pageA.reload({ waitUntil: 'networkidle' });
await settle(pageA, 300);

/* ── seed "device B" (the receiver): its own unrelated roster, plus one that
   collides by name with a roster coming from A ─────────────────────────── */
await pageB.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(pageB, 300);
await pageB.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({
    'Period 3 — Earth Science': ['Someone Already Here'],
    "Ms. Rivera's Homeroom": ['Already', 'On', 'This', 'Device'],
  }));
});
await pageB.reload({ waitUntil: 'networkidle' });
await settle(pageB, 300);

/* ── pair: A sends, B receives (paste path — no camera in headless) ────── */
await pageA.click('#handoffBtn');
await pageA.click('#handoffStartSendBtn');
const offerText = await waitForValue(pageA, '#handoffOfferText');
ok(offerText.length > 10, 'the sending device produced an offer code');

await pageB.click('#handoffBtn');
await pageB.click('#handoffStartReceiveBtn');
await pageB.fill('#handoffOfferInput', offerText);
await pageB.click('#handoffCreateAnswerBtn');
const answerText = await waitForValue(pageB, '#handoffAnswerText');
ok(answerText.length > 10, 'the receiving device produced a reply code');

await pageA.fill('#handoffAnswerInput', answerText);
await pageA.click('#handoffConnectBtn');

const sendStatus = await waitForTextMatch(pageA, '#handoffSendStatus', /Sent/);
ok(/Sent 3 rosters/.test(sendStatus), 'the sending device confirms all 3 rosters were sent: ' + JSON.stringify(sendStatus));
ok(/plus the archive/.test(sendStatus), 'the sending device notes the archive went along too: ' + JSON.stringify(sendStatus));

/* ── the receiving device gets a chance to review before anything is written ── */
await waitForVisible(pageB, '#handoffStepApply');
const summary = await pageB.$eval('#handoffApplySummary', (el) => el.textContent);
ok(/Received 3 rosters/.test(summary), 'the receiving device summarizes the incoming rosters before importing: ' + JSON.stringify(summary));
ok(/1 archived roster/.test(summary), 'the summary mentions the incoming archived roster: ' + JSON.stringify(summary));
ok(/1 archived school year/.test(summary), 'the summary mentions the incoming archived school year: ' + JSON.stringify(summary));

await pageB.click('#handoffApplyBtn');
await settle(pageB, 500);

const after = await pageB.evaluate(() => ({
  rosters: JSON.parse(localStorage.getItem('np_rosters') || '{}'),
  records: JSON.parse(localStorage.getItem('crh_students_v1') || '{}'),
  archivedStudents: JSON.parse(localStorage.getItem('crh_archived_students') || '{}'),
  archive: JSON.parse(localStorage.getItem('crh_archive_v1') || '{}'),
}));

/* ── device B's own pre-existing data is untouched ──────────────────────── */
eq((after.rosters['Period 3 — Earth Science'] || []).length, 1,
   "device B's own roster of the same name is untouched, not overwritten");
eq((after.rosters['Period 3 — Earth Science'] || [])[0], 'Someone Already Here',
   "device B's own student under that name is still there");
eq((after.rosters["Ms. Rivera's Homeroom"] || []).length, 4, "device B's unrelated roster is untouched");

/* ── the colliding incoming roster landed renamed, not merged/overwritten ── */
const renamed = after.rosters['Period 3 — Earth Science (2)'];
ok(Array.isArray(renamed), 'the incoming roster with a colliding name was imported under a renamed copy');
eq((renamed || []).length, 3, 'all 3 students of the renamed roster came across');
const renamedRec = (after.records.rosters || {})['Period 3 — Earth Science (2)'];
ok(!!renamedRec, 'the renamed roster kept its crh_students_v1 sidecar entry');
ok((renamedRec && renamedRec.students || []).some((s) => s.preferred === 'Addie' && s.say === 'AY-duh'),
   'the sidecar detail (preferred name, pronunciation) survived the transfer: ' + JSON.stringify(renamedRec && renamedRec.students));
ok((after.archivedStudents['Period 3 — Earth Science (2)'] || []).includes('Old Student Who Left'),
   "the roster's own archived-withdrawn student list survived the transfer");

/* ── the non-colliding rosters landed as-is ─────────────────────────────── */
eq((after.rosters['Period 5/6 Honors'] || []).length, 2, 'the bare roster with no sidecar record still transferred');

/* ── the 200-student roster proves chunking + reassembly didn't lose or
   duplicate anything ───────────────────────────────────────────────────── */
const big = after.rosters['Big Roster'] || [];
eq(big.length, 200, 'a large, multi-chunk roster arrived with none of its 200 students lost or duplicated');
eq(new Set(big).size, 200, 'none of those 200 names were duplicated by the chunk reassembly');

/* ── the archive (individually archived rosters + archived school years) ── */
ok((after.archive.rosters || []).some((r) => r.name === 'Period 1 — Retired Class'),
   'the individually archived roster from device A is now in device B’s archive too');
ok((after.archive.years || []).some((y) => y.label === '2025–26'),
   'the archived school year from device A is now in device B’s archive too');

/* ── no console noise or off-site requests from either device during the transfer ── */
eq(pageA.__errs.length, 0, 'sending device: no page/console errors: ' + JSON.stringify(pageA.__errs.slice(0, 4)));
eq(pageB.__errs.length, 0, 'receiving device: no page/console errors: ' + JSON.stringify(pageB.__errs.slice(0, 4)));
eq(pageA.__blocked.length, 0, 'sending device: nothing tried to leave the site: ' + JSON.stringify(pageA.__blocked.slice(0, 4)));
eq(pageB.__blocked.length, 0, 'receiving device: nothing tried to leave the site: ' + JSON.stringify(pageB.__blocked.slice(0, 4)));

await browser.close();
server.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
