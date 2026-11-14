// smoke-anonymizer.mjs — 091 Student Data Anonymizer, the page, in a browser.
//
//   node Tools/student-anonymizer/test/smoke-anonymizer.mjs   (or: npm run test:anonymizer; port 8702)
//
// What this pins, on made-up files built here (the repo is public; no real export is in it):
//   - an attendance-style XLSX (ID, name, GRADE), an assessment-style XLSX with two sheets and a
//     class-average row above the headings, a CSV whose IDs start with zeros, and a Teacher Access
//     Center-style PDF drawn with the vendored jsPDF (filled header cells, a solid line through a
//     score, dashed borders), so extractPage() runs on a real PDF through the vendored pdf.js
//   - the counts, the one cross-file student, the clean leak check, GRADE offered unticked
//   - the saved XLSX: a Student Code column, no name, no ID, no GRADE, codes XX-XX, a percent
//     still a formatted number; ticking GRADE keeps it; the PDF toggle saves a PDF; the TAC copy
//     says which cells were struck
//   - the key: one row per student; using it again gives every student the same code
//   - a key whose ID disagrees with a name raises a conflict, and choosing settles it
//   - putting names back with the key restores the names; a code the key lacks is listed
//   - a PDF that is not a Student Detail Report is refused in words
//   - nothing is written to localStorage, sessionStorage or IndexedDB
//   - axe finds nothing serious on the filled page, light and dark, and no page error is thrown
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8702;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '091-student-data-anonymizer.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// SheetJS in Node, the vendored copy.
const xctx = { Buffer, TextDecoder, console: { log() {}, error() {}, warn() {} } };
xctx.window = xctx;
vm.createContext(xctx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared/vendor/xlsx/xlsx.full.min.js'), 'utf8'), xctx);
const X = xctx.XLSX;
const CODE = /^[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{2}$/;

function xlsxBuffer(sheets) {
  const wb = X.utils.book_new();
  for (const [name, rows] of sheets) {
    const ws = X.utils.aoa_to_sheet(rows);
    X.utils.book_append_sheet(wb, ws, name);
  }
  return Buffer.from(X.write(wb, { bookType: 'xlsx', type: 'array' }));
}
function readXlsx(file) {
  const wb = X.read(fs.readFileSync(file), { type: 'buffer', cellNF: true });
  return wb.SheetNames.map(n => ({ name: n, ws: wb.Sheets[n], rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }) }));
}

const ATT = xlsxBuffer([['Attendance', [
  ['SCHOOL', 'STUDENT_ID', 'STUDENT_NAME', 'GRADE', 'ABS_MP1', 'ABS_YTD'],
  ['Example Middle', '900001', 'Abbott, Ada Grace', '07', 2, 2],
  ['Example Middle', '900002', 'Baker, Ben', '08', 0, 0],
  ['Example Middle', '900003', 'Cruz, Carla Maria', '06', 5, 5],
  ['Example Middle', '900004', 'Dunn, Dev Kareem, III', '07', 1, 1]
]]]);
const EBAS = (() => {
  const wb = X.utils.book_new();
  const items = X.utils.aoa_to_sheet([
    ['', '', '78.0%', '', ' 1-1'],
    ['Student ID', 'Student Name', 'Test Score %', 'PE/PP', 'Q1'],
    ['900002', 'Baker, Ben', 0.625, ' 5/8', 1],
    ['900001', 'Abbott, Ada', 0.9, ' 7/8', 1]
  ]);
  items.C3.z = '0.00%'; items.C4.z = '0.00%';
  X.utils.book_append_sheet(wb, items, 'Item Scores');
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['', '', 'Avg'], ['Student ID', 'Student Name', 'Minutes'], ['900002', 'Baker, Ben', 12], ['900001', 'Abbott, Ada', 9]]), 'Duration');
  return Buffer.from(X.write(wb, { bookType: 'xlsx', type: 'array' }));
})();
const CSV = Buffer.from('﻿Student ID,Last Name,First Name,Score\r\n007001,Evans,Eli,88\r\n007002,Fox,Fay,91\r\n');

// A Student Detail Report, drawn the way the real one is, in the page with the vendored jsPDF.
async function tacPdf(page) {
  await page.addScriptTag({ url: `${BASE}/_shared/vendor/jspdf/jspdf.umd.min.js` });
  const b64 = await page.evaluate(() => {
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    const COLS = [['Assignment', 72, 121.5], ['Due Date', 193.5, 30], ['Category', 222.6, 58.5], ['Score', 282, 46.5], ['Asmt Weight', 328.5, 36],
      ['Weighted Score', 364.5, 45], ['Total Points', 409.5, 36], ['Weighted Total Points', 445.5, 49.5], ['Percent', 495, 40.5]];
    function studentPage(name, rows, first) {
      if (!first) doc.addPage();
      doc.setFontSize(8); doc.text('Example Middle', 37, 52); doc.text('11/13/2026', 529, 52);
      doc.setFontSize(15); doc.text('Student Detail Report', 230, 50);
      doc.setFontSize(12); doc.text(name, 230, 66);
      doc.setFontSize(10); doc.text('Course:', 37, 84); doc.text('SOC STUDIES 7', 82, 84); doc.text('Period:', 455, 84); doc.text('01 - 03', 496, 84);
      doc.text('Teacher:', 37, 98); doc.text('Teacher, Pat', 82, 98); doc.text('Marking Period:', 455, 98); doc.text('MP1', 536, 98);
      doc.setFontSize(9);
      let y = 136;
      COLS.forEach(([label, x, w]) => {
        doc.setFillColor(20, 100, 140); doc.rect(x, y, w, 31.5, 'F');
        doc.setTextColor(255, 255, 255);
        label.split(' ').forEach((p, i) => doc.text(p, x + 3, y + 11 + i * 10));
        doc.setTextColor(0, 0, 0);
      });
      y += 31.5;
      rows.forEach(r => {
        doc.setFillColor(220, 220, 220);
        doc.rect(72, y, 121.5, 22.7, 'F'); doc.rect(193.5, y, 30, 22.7, 'F'); doc.rect(222.6, y, 58.5, 22.7, 'F');
        const base = y + 10;
        doc.text(r[0], 73.5, base); doc.text(r[1], 196, base); doc.text('Formative', 224, base); doc.text('Assignments', 224, base + 10);
        doc.text(r[2], 326, base, { align: 'right' }); doc.text('1.00', 362, base, { align: 'right' });
        doc.text(r[3], 443, base, { align: 'right' });
        doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.5); doc.line(282, y + 22.7, 535.5, y + 22.7);
        doc.setLineDashPattern([], 0);
        if (r[4]) { doc.setLineWidth(0.45); doc.line(306, base - 3, 325, base - 3); }
        y += 22.7;
      });
      doc.text('R', 37, y + 14); doc.text('= Retake entered for this assignment', 45, y + 14);
    }
    studentPage('Abbott, Ada Grace', [['Map Quiz', '9/3', '8.00', '10', false], ['Exit Ticket', '9/10', 'EXC', '5', true]], true);
    studentPage('Newman, Nia', [['Map Quiz', '9/3', '9.00', '10', false]], false);
    return btoa(doc.output());
  });
  return Buffer.from(b64, 'base64');
}

async function open(browser, { dark = false } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  if (dark) await page.addInitScript(() => localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' })));
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 200);
  return page;
}
async function download(page, selector, to) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const file = path.join(to, dl.suggestedFilename());
  await dl.saveAs(file);
  return file;
}
const results = () => '#anonResult:not([hidden])';

const server = await serve(PORT);
const browser = await launch();
const tmp = fs.mkdtempSync(path.join(SITE, 'Tools/student-anonymizer/test/.tmp-'));
try {
  // ---- anonymize four files at once
  let page = await open(browser);
  const PDF = await tacPdf(page);
  const files = [
    { name: 'Attendance_Totals.xlsx', mimeType: 'application/octet-stream', buffer: ATT },
    { name: 'EBAS_Unit_1.xlsx', mimeType: 'application/octet-stream', buffer: EBAS },
    { name: 'scores.csv', mimeType: 'text/csv', buffer: CSV },
    { name: 'Student_Detail.pdf', mimeType: 'application/pdf', buffer: PDF }
  ];
  await page.setInputFiles('#anonFiles', files);
  await page.waitForSelector(results(), { timeout: 30000 });
  await settle(page, 300);
  const listText = (await page.textContent('#fileList')).replace(/\s+/g, ' ');
  ok(/ESP Reporting Center: Attendance Totals/.test(listText), 'the attendance file is known by name');
  ok(/Performance Matters: assessment results/.test(listText), 'the assessment file is known by name');
  ok(/Teacher Access Center: Student Detail Report/.test(listText), 'the PDF is read as a Student Detail Report');
  ok(/2 students on 3 sheets/.test(listText), 'the PDF\'s two students');
  // 4 attendance + Evans, Fox (CSV) + Newman (PDF only) = 7; Abbott and Baker join across files.
  ok(/^7 students in all\./.test(await page.textContent('#matchSummary')), 'seven students in all: Abbott and Baker are one each across files');
  ok(/^Checked: no student name or ID/.test(await page.textContent('#leakNote')), 'the leak check is clean');
  const checks = await page.$$eval('#detailChecks input', els => els.map(e => [e.parentElement.textContent.trim(), e.checked]));
  eq(checks.map(c => c[1]), [false], 'one student detail offered, unticked');
  ok(/GRADE/.test(checks[0] && checks[0][0]), 'and it is GRADE');

  const buttons = await page.$$eval('#anonDownloads button', bs => bs.map(b => b.textContent));
  eq(buttons.length, 5, 'four files to save and the key');
  const attFile = await download(page, '#anonDownloads div:nth-child(1) button', tmp);
  ok(/Attendance_Totals - anonymized\.xlsx$/.test(attFile), 'the anonymized file\'s name');
  const att = readXlsx(attFile)[0];
  eq(att.rows[0], ['SCHOOL', 'Student Code', 'ABS_MP1', 'ABS_YTD'], 'ID, name and GRADE are gone; a code column takes their place');
  ok(att.rows.slice(1).every(r => CODE.test(r[1])), 'every row has a code');
  const attCodes = att.rows.slice(1).map(r => r[1]);
  eq(attCodes, attCodes.slice().sort(), 'rows are in code order');
  ok(!JSON.stringify(att.rows).match(/Abbott|Baker|9000/), 'no name or ID anywhere in it');

  const ebFile = await download(page, '#anonDownloads div:nth-child(2) button', tmp);
  const eb = readXlsx(ebFile);
  eq(eb.map(s => s.name), ['Item Scores', 'Duration'], 'both sheets are kept');
  eq(eb[0].rows[0], ['', '78.0%', '', ' 1-1'], 'the class-average row stays above the headings');
  eq(eb[0].rows[1], ['Student Code', 'Test Score %', 'PE/PP', 'Q1'], 'the assessment headings');
  const pctCell = eb[0].ws.B3;
  eq([pctCell.t, pctCell.z], ['n', '0.00%'], 'a percent is still a number with its format');
  const codeOf = {};
  att.rows.slice(1).forEach(r => { codeOf[r[2] + '|' + r[3]] = r[1]; });
  ok(eb[0].rows.slice(2).every(r => CODE.test(r[0])) && eb[1].rows.slice(2).every(r => CODE.test(r[0])), 'each sheet\'s students have codes');
  eq(eb[0].rows.slice(2).map(r => r[0]).sort(), eb[1].rows.slice(2).map(r => r[0]).sort(), 'a student has one code on every sheet');

  const csvFile = await download(page, '#anonDownloads div:nth-child(3) button', tmp);
  eq(readXlsx(csvFile)[0].rows[0], ['Student Code', 'Score'], 'the CSV\'s ID, last and first name become one code');

  const pdfOut = await download(page, '#anonDownloads div:nth-child(4) button', tmp);
  const tac = readXlsx(pdfOut);
  eq(tac.map(s => s.name), ['Assignments', 'Category totals', 'Overall'], 'the PDF becomes three sheets');
  const th = tac[0].rows[0];
  eq(th.slice(0, 2), ['Student Code', 'School'], 'its name column is a code');
  ok(th.includes('Teacher') && tac[0].rows.slice(1).every(r => r[th.indexOf('Teacher')] === 'Teacher, Pat'), 'the teacher\'s name is kept');
  const struck = tac[0].rows.slice(1).map(r => [r[th.indexOf('Assignment')], r[th.indexOf('Not included (line through)')]]);
  ok(struck.some(([a, s]) => a === 'Exit Ticket' && s === 'Yes (Score)'), 'the struck score is named');
  ok(struck.filter(([a, s]) => a === 'Map Quiz').every(([, s]) => !s), 'an unstruck row says nothing');
  ok(!JSON.stringify(tac).match(/Abbott|Newman/), 'no student name in the PDF\'s copy');

  const keyFile = await download(page, '#anonDownloads button.secondary', tmp);
  const key = readXlsx(keyFile)[0].rows;
  eq(key[0], ['Code', 'Student ID', 'Last name', 'First name', 'Name as written', 'Other spellings', 'Other IDs', 'First seen in', 'Added'], 'the key\'s headings');
  eq(key.length - 1, 7, 'one key row per student');
  const abbott = key.find(r => r[2] === 'Abbott');
  eq([abbott[1], abbott[4]], ['900001', 'Abbott, Ada Grace'], 'Abbott\'s ID and fullest name');
  ok(/Abbott, Ada/.test(abbott[5]), 'and the shorter spelling');
  eq(key.find(r => r[2] === 'Evans')[1], '007001', 'a CSV ID keeps its leading zeros');

  // Ticking GRADE keeps it; the PDF toggle saves a PDF.
  await page.check('#detailChecks input');
  await settle(page, 150);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.type === 'checkbox'), 'focus stays on the box after the page redraws');
  const att2 = readXlsx(await download(page, '#anonDownloads div:nth-child(1) button', tmp))[0];
  eq(att2.rows[0], ['SCHOOL', 'Student Code', 'GRADE', 'ABS_MP1', 'ABS_YTD'], 'a ticked GRADE is kept');
  eq(att2.rows.slice(1).map(r => r[1]), attCodes, 'and every code is the same as before the tick');
  await page.check('#asPdf');
  const pdfSaved = await download(page, '#anonDownloads div:nth-child(1) button', tmp);
  ok(/\.pdf$/.test(pdfSaved) && fs.readFileSync(pdfSaved).subarray(0, 5).toString() === '%PDF-', 'the PDF toggle saves a PDF');

  for (const t of [['light', page]]) {
    const bad = await a11yScan(t[1]);
    ok(!bad.length, `axe, ${t[0]}: ${bad.map(b => b.id + ' ' + b.nodes.join(',')).join('; ')}`);
  }
  const stored = await page.evaluate(async () => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage), idb: indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [] }));
  eq(stored, { ls: [], ss: [], idb: [] }, 'nothing is stored');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();

  // ---- the key, used again: every student keeps their code
  page = await open(browser);
  await page.setInputFiles('#anonKey', keyFile);
  await settle(page, 300);
  ok(/7 students in it/.test(await page.textContent('#anonStatus')), 'the key is read');
  await page.setInputFiles('#anonFiles', files.slice(0, 1));
  await page.waitForSelector(results());
  ok(/From the key: 4 by ID, 0 by name\. New codes: 0\./.test(await page.textContent('#matchSummary')), 'all four by ID, none new');
  const again = readXlsx(await download(page, '#anonDownloads div:nth-child(1) button', tmp))[0];
  eq(again.rows.slice(1).map(r => r[1]), attCodes, 'the same codes as the first time');
  const updated = readXlsx(await download(page, '#anonDownloads button.secondary', tmp))[0].rows;
  eq(updated.length - 1, 7, 'the saved key still lists everyone');

  // ---- a conflict: the key holds Baker under another ID
  const bad = readXlsx(keyFile)[0].rows.map(r => (r[2] === 'Baker' ? [r[0], '999999'].concat(r.slice(2)) : r));
  const badKey = path.join(tmp, 'bad key.xlsx');
  fs.writeFileSync(badKey, xlsxBuffer([['Key', bad]]));
  await page.setInputFiles('#anonKey', badKey);
  await page.waitForSelector('#conflicts .conflict');
  const cf = (await page.textContent('#conflicts')).replace(/\s+/g, ' ');
  ok(/Baker, Ben.*different ID \(999999\)/.test(cf), 'the conflict names the student and the other ID');
  ok(/New codes: 1\./.test(await page.textContent('#matchSummary')), 'until settled, the student gets a new code');
  const bakerCode = bad.find(r => r[2] === 'Baker')[0];
  await page.selectOption('#conflicts select', bakerCode);
  await settle(page, 150);
  ok(/1 you matched\. New codes: 0\./.test(await page.textContent('#matchSummary')), 'choosing puts the student on the key\'s code');
  await page.context().close();

  // ---- put names back
  page = await open(browser);
  await page.click('#modeBack');
  ok(await page.isVisible('#backPane') && !(await page.isVisible('#anonPane')), 'the reverse pane shows');
  await page.setInputFiles('#backFiles', attFile);
  await page.waitForFunction(() => /choose the key/i.test(document.getElementById('backStatus').textContent), null, { timeout: 10000 }).catch(() => {});
  ok(/choose the key/i.test(await page.textContent('#backStatus')), 'it asks for the key');
  await page.setInputFiles('#backKey', keyFile);
  await page.waitForSelector('#backResult:not([hidden])');
  ok(/4 rows given a name back/.test(await page.textContent('#backList')), 'four rows restored');
  const backFile = await download(page, '#backDownloads button', tmp);
  ok(/Attendance_Totals - with names\.xlsx$/.test(backFile), 'the restored file\'s name');
  const back = readXlsx(backFile)[0].rows;
  eq(back[0].slice(0, 4), ['SCHOOL', 'Student ID', 'Student Name', 'Student Code'], 'names go back in front of the code');
  ok(back.some(r => r[1] === '900004' && r[2] === 'Dunn, Dev Kareem, III'), 'the right student comes back');
  const partKey = path.join(tmp, 'part key.xlsx');
  fs.writeFileSync(partKey, xlsxBuffer([['Key', readXlsx(keyFile)[0].rows.filter(r => r[2] !== 'Dunn')]]));
  await page.setInputFiles('#backKey', partKey);
  await settle(page, 300);
  ok(/1 code not in this key/.test(await page.textContent('#backList')), 'a code the key lacks is listed');
  await page.context().close();

  // ---- a PDF that is not a Student Detail Report
  page = await open(browser, { dark: true });
  await page.addScriptTag({ url: `${BASE}/_shared/vendor/jspdf/jspdf.umd.min.js` });
  const other = Buffer.from(await page.evaluate(() => { const d = new window.jspdf.jsPDF(); d.text('Field trip form', 20, 20); return btoa(d.output()); }), 'base64');
  await page.setInputFiles('#anonFiles', [{ name: 'trip.pdf', mimeType: 'application/pdf', buffer: other }]);
  await page.waitForFunction(() => /not a PDF this page can read/.test(document.getElementById('anonStatus').textContent));
  ok(true, 'another PDF is refused in words');
  await page.setInputFiles('#anonFiles', files.slice(0, 2));
  await page.waitForSelector(results());
  const darkBad = await a11yScan(page);
  ok(!darkBad.length, `axe, dark: ${darkBad.map(b => b.id + ' ' + b.nodes.join(',')).join('; ')}`);
  eq(page.__errs, [], 'no page errors in dark');
  ok(!page.__blocked.length, 'nothing offsite was requested');
  await page.context().close();
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  server.close();
}

console.log(`smoke-anonymizer: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
