// smoke-portfolio.mjs — Student Portfolio mode (filename → student grouping,
// one PDF per student, all zipped via _shared/vendor/jszip/jszip.min.js).
//
//   node Tools/image-to-pdf/test/smoke-portfolio.mjs
//
// Exits non-zero on any failure.
//
// Mirrors smoke.mjs's approach on purpose (same browser-launch pattern, same
// offline-network guard, same "no PDF parser vendored — assert on raw bytes"
// philosophy) rather than sharing a harness, so it stays readable on its own.
// There is also no zip parser vendored in this repo, so this file hand-rolls
// the handful of ZIP structures it needs (End Of Central Directory + Central
// Directory + Local File Header) using only node's built-in zlib — same
// spirit as make-fixtures.mjs hand-rolling PNG chunks.
//
// What this suite covers (see improvement prompts/011-image-to-pdf.md for the
// full naming-convention writeup):
//   1. extractStudentName / groupEntriesByStudent / sanitizeForFilename /
//      substituteStudentToken — the parsing + grouping helpers, exercised
//      directly via window.__imgToPdfPortfolio, including the documented
//      edge cases (camera-default filenames, bare numbers, the "runs two
//      names together" limitation).
//   2. End to end: real files on disk with real student-shaped names, queued
//      through the file input, portfolio mode turned on, the on-page preview
//      checked, a zip downloaded and unpacked, and every resulting PDF
//      checked for a %PDF- header and the expected page count.
//   3. {student} title-page substitution reaching the actual generated PDFs
//      (page count goes up by one per student once a title page is added).
//
// It does not re-test the quality/target-size retry ladder itself (that's
// smoke.mjs's job, and generatePortfolioZip reuses the exact same
// buildWithQualityLadder function) — only that portfolio mode drives it once
// per student and reports honestly.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeSolidPng } from './make-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_PATH = path.join(__dirname, '..', '..', '011-image-to-pdf.html');

let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? '\n        ' + detail : ''}`); }
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. From the repo root, run:\n  npm ci\n  npx playwright install chromium');
  process.exit(1);
}

if (!fs.existsSync(TOOL_PATH)) {
  console.error(`FAIL  tool file not found at ${TOOL_PATH}`);
  process.exit(1);
}

// ── Fixture files on disk, with real filenames (not just paths) ─────────────
// Playwright's setInputFiles hands the browser the file's actual basename, so
// the on-disk name IS the input to extractStudentName — these names are
// chosen to exercise: two images for one student (out of upload order, to
// prove internal ordering is preserved per student), one image for a second
// student, and two "doesn't parse to a name" files that must land in the
// shared Unsorted bucket rather than being dropped.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img2pdf-portfolio-'));
const fixtures = {
  mariaB: path.join(tmpDir, 'Maria_Diaz_07.png'),   // queued before mariaA on purpose
  mariaA: path.join(tmpDir, 'Maria_Diaz_04.png'),
  chen:   path.join(tmpDir, 'Chen_Wei_2.png'),
  imgDefault: path.join(tmpDir, 'IMG_0421.png'),     // camera default -> Unsorted
  bareNumber: path.join(tmpDir, '42.png'),           // bare number -> Unsorted
};
fs.writeFileSync(fixtures.mariaB,    makeSolidPng(60, 40, [200, 40, 40]));
fs.writeFileSync(fixtures.mariaA,    makeSolidPng(60, 40, [40, 160, 40]));
fs.writeFileSync(fixtures.chen,      makeSolidPng(60, 40, [40, 40, 200]));
fs.writeFileSync(fixtures.imgDefault, makeSolidPng(60, 40, [120, 120, 120]));
fs.writeFileSync(fixtures.bareNumber, makeSolidPng(60, 40, [90, 90, 90]));

// ── PDF byte-level helpers (no external PDF parser — same as smoke.mjs) ─────
function isPdf(buf) {
  return buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}
function countPdfPages(buf) {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches ? matches.length : 0;
}

// ── ZIP byte-level helpers (no external zip parser vendored either) ─────────
// Reads just enough of the ZIP format to list entries and get their bytes:
// End Of Central Directory -> Central Directory entries -> Local File Headers.
// Handles the two compression methods JSZip can produce: 0 (stored) and 8
// (deflate). generateAsync({type:'blob'}) with no `compression` option (what
// generatePortfolioZip calls) defaults to stored, but this doesn't assume
// that — it reads the method byte and branches.
function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const searchFloor = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= searchFloor; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('End Of Central Directory record not found — not a valid zip');

  const entryCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const CD_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;
  const entries = [];
  let offset = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CD_SIG) throw new Error(`bad central directory entry at byte ${offset}`);
    const compMethod = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);

    if (buf.readUInt32LE(localHeaderOffset) !== LFH_SIG) throw new Error(`bad local file header for "${name}"`);
    const lNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.subarray(dataStart, dataStart + compSize);

    let data;
    if (compMethod === 0) data = Buffer.from(compData);
    else if (compMethod === 8) data = zlib.inflateRawSync(compData);
    else throw new Error(`unsupported zip compression method ${compMethod} for "${name}"`);

    entries.push({ name, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// Same reasoning/text as smoke.mjs: this tool's shared _ds stylesheet
// @imports Google Fonts over HTTPS, which always fails offline in this
// sandbox and would otherwise make "zero console errors" permanently red for
// a reason unrelated to portfolio mode.
const IGNORED_CONSOLE_ERROR = /^Failed to load resource:/;

async function newPageWithGuards(browser) {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith('file://') ? route.continue() : route.abort();
  });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !IGNORED_CONSOLE_ERROR.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err)));
  return { context, page, consoleErrors, pageErrors };
}

async function downloadFile(page, clickFn, ext) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    clickFn(),
  ]);
  const savePath = path.join(tmpDir, `out-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  await download.saveAs(savePath);
  return fs.readFileSync(savePath);
}

console.log('image-to-pdf portfolio-mode smoke\n');

async function runScenario(label, fn) {
  console.log(label);
  try {
    await fn();
  } catch (e) {
    fail++;
    console.log(`  FAIL  scenario threw: ${e && e.stack ? e.stack : e}`);
  }
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_EXECUTABLE
    ? { headless: true, executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
    : { headless: true }
);

try {
  /* ── 1. Parsing/grouping helpers, exercised directly ─────────────────── */
  await runScenario('filename -> student name parsing (window.__imgToPdfPortfolio)', async () => {
    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);

    const hasHelpers = await page.evaluate(() => typeof window.__imgToPdfPortfolio === 'object');
    ok(hasHelpers, 'window.__imgToPdfPortfolio is exposed for introspection');

    const cases = await page.evaluate(() => {
      const { extractStudentName } = window.__imgToPdfPortfolio;
      return {
        simple:        extractStudentName('Maria_Diaz_04.jpg'),
        pageWord:      extractStudentName('Maria Diaz - pg2.png'),
        dotDigit:      extractStudentName('Chen-Wei.03.jpeg'),
        cameraDefault: extractStudentName('IMG_0421.jpg'),
        dscDefault:    extractStudentName('DSC_1002.JPG'),
        bareNumber:    extractStudentName('42.png'),
        runTogether:   extractStudentName('SmithJohn_2.jpg'),
        noTrailingNum: extractStudentName('cover.png'),
      };
    });
    ok(cases.simple === 'Maria Diaz', '"Maria_Diaz_04.jpg" -> "Maria Diaz"', JSON.stringify(cases.simple));
    ok(cases.pageWord === 'Maria Diaz', '"Maria Diaz - pg2.png" -> "Maria Diaz" (page-word + digits stripped)', JSON.stringify(cases.pageWord));
    ok(cases.cameraDefault === null, '"IMG_0421.jpg" -> null (camera-default token, routed to Unsorted)', JSON.stringify(cases.cameraDefault));
    ok(cases.dscDefault === null, '"DSC_1002.JPG" -> null (generic token match is case-insensitive)', JSON.stringify(cases.dscDefault));
    ok(cases.bareNumber === null, '"42.png" -> null (purely numeric, routed to Unsorted)', JSON.stringify(cases.bareNumber));
    ok(cases.runTogether === 'SmithJohn', '"SmithJohn_2.jpg" -> "SmithJohn" (documented no-split limitation)', JSON.stringify(cases.runTogether));
    ok(cases.noTrailingNum === 'cover', '"cover.png" (no trailing digit run) keeps the whole stem', JSON.stringify(cases.noTrailingNum));

    const grouping = await page.evaluate(() => {
      const { groupEntriesByStudent } = window.__imgToPdfPortfolio;
      const fakeOrdered = [
        { file: { name: 'Chen_Wei_2.png' } },
        { file: { name: 'Maria_Diaz_07.png' } },
        { file: { name: 'Maria_Diaz_04.png' } },
        { file: { name: 'IMG_0421.png' } },
        { file: { name: '42.png' } },
      ];
      return groupEntriesByStudent(fakeOrdered).map(g => ({ name: g.name, files: g.entries.map(e => e.file.name) }));
    });
    ok(grouping.length === 3, 'grouping 5 files by 2 real students + generics yields 3 groups', JSON.stringify(grouping));
    ok(grouping.map(g => g.name).join(',') === 'Chen Wei,Maria Diaz,Unsorted',
       'groups sort alphabetically by name with Unsorted forced last', JSON.stringify(grouping.map(g => g.name)));
    const maria = grouping.find(g => g.name === 'Maria Diaz');
    ok(!!maria && maria.files.length === 2, '"Maria Diaz" group has both her files', JSON.stringify(maria));
    ok(!!maria && maria.files[0] === 'Maria_Diaz_07.png' && maria.files[1] === 'Maria_Diaz_04.png',
       'within a group, entries keep the input order (not re-sorted by filename)', JSON.stringify(maria && maria.files));
    const unsorted = grouping.find(g => g.name === 'Unsorted');
    ok(!!unsorted && unsorted.files.length === 2, 'the two unparseable files are grouped into "Unsorted", not dropped', JSON.stringify(unsorted));

    const sanitized = await page.evaluate(() => window.__imgToPdfPortfolio.sanitizeForFilename('Smith/Jones: "Kid"?'));
    ok(!/[\\/:*?"<>|]/.test(sanitized), 'sanitizeForFilename strips filesystem-unsafe characters', sanitized);
    ok(sanitized.length > 0, 'sanitizeForFilename never returns empty for non-empty input', sanitized);

    const substituted = await page.evaluate(() =>
      window.__imgToPdfPortfolio.substituteStudentToken("{STUDENT}'s Work — Room 204", 'Maria Diaz'));
    ok(substituted === "Maria Diaz's Work — Room 204",
       '{student} token substitution is case-insensitive and replaces with the real name', substituted);

    ok(consoleErrors.length === 0, 'no console.error output while exercising the helpers', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors while exercising the helpers', pageErrors.join('\n        '));

    await context.close();
  });

  /* ── 2. End to end: real files, real UI, real zip ─────────────────────── */
  let zipBuf, entries;
  await runScenario('\nend to end — grouped preview, one PDF per student, zipped', async () => {
    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);

    await page.setInputFiles('#file-input', [
      fixtures.mariaB, fixtures.mariaA, fixtures.chen, fixtures.imgDefault, fixtures.bareNumber,
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 5);

    const filenameBefore = await page.inputValue('#filename');
    ok(filenameBefore === 'assembled.pdf', 'sanity: filename field starts at its normal default');

    await page.check('#opt-portfolio');
    await page.waitForSelector('#portfolio-preview:visible');

    const filenameAfter = await page.inputValue('#filename');
    ok(filenameAfter === 'portfolios.zip', 'turning on portfolio mode swaps the (untouched) default filename to portfolios.zip');

    const previewText = (await page.locator('#portfolio-preview').textContent()) || '';
    ok(/3 PDFs will be produced/i.test(previewText), 'preview announces 3 PDFs up front', previewText);
    ok(/Chen Wei.*1 image/.test(previewText), 'preview lists Chen Wei with 1 image', previewText);
    ok(/Maria Diaz.*2 images/.test(previewText), 'preview lists Maria Diaz with 2 images', previewText);
    ok(/Unsorted.*2 images/.test(previewText), 'preview lists the Unsorted bucket with its 2 images', previewText);

    const genDisabled = await page.locator('#btn-generate').isDisabled();
    ok(genDisabled === false, 'Generate button is enabled with portfolio mode on and files queued');

    zipBuf = await downloadFile(page, () => page.click('#btn-generate'), 'zip');
    ok(zipBuf.length > 0 && zipBuf.subarray(0, 2).toString('latin1') === 'PK', 'downloaded file is a real zip (PK local-file-header signature)');

    entries = readZipEntries(zipBuf);
    ok(entries.length === 3, 'zip contains exactly 3 entries — one per student group', entries.map(e => e.name).join(', '));

    const names = entries.map(e => e.name).sort();
    ok(JSON.stringify(names) === JSON.stringify(['Chen Wei.pdf', 'Maria Diaz.pdf', 'Unsorted.pdf']),
       'zip entry names are the sanitized student names + .pdf', JSON.stringify(names));

    const byName = Object.fromEntries(entries.map(e => [e.name, e.data]));
    ok(isPdf(byName['Chen Wei.pdf']), '"Chen Wei.pdf" is a real PDF (%PDF- header)');
    ok(isPdf(byName['Maria Diaz.pdf']), '"Maria Diaz.pdf" is a real PDF (%PDF- header)');
    ok(isPdf(byName['Unsorted.pdf']), '"Unsorted.pdf" is a real PDF (%PDF- header)');

    ok(countPdfPages(byName['Chen Wei.pdf']) === 1, 'Chen Wei\'s PDF has 1 page (his 1 image)', String(countPdfPages(byName['Chen Wei.pdf'])));
    ok(countPdfPages(byName['Maria Diaz.pdf']) === 2, 'Maria Diaz\'s PDF has 2 pages (her 2 images)', String(countPdfPages(byName['Maria Diaz.pdf'])));
    ok(countPdfPages(byName['Unsorted.pdf']) === 2, 'the Unsorted PDF has 2 pages (the 2 unparseable images)', String(countPdfPages(byName['Unsorted.pdf'])));

    const msgText = (await page.locator('#msg').textContent()) || '';
    ok(/3 student PDFs/.test(msgText), 'status message reports 3 student PDFs', msgText);
    ok(/portfolios\.zip/.test(msgText), 'status message names the saved zip file', msgText);

    const run = await page.evaluate(() => window.__imgToPdfLastPortfolioRun);
    ok(!!run, 'generatePortfolioZip exposes __imgToPdfLastPortfolioRun for introspection');
    ok(run && run.groupNames.join(',') === 'Chen Wei,Maria Diaz,Unsorted', 'run info group names match and stay alphabetical + Unsorted-last', run ? JSON.stringify(run.groupNames) : '');
    ok(run && run.perStudent.length === 3, 'run info lists all 3 students as successfully produced', run ? JSON.stringify(run.perStudent.map(p => p.name)) : '');
    ok(run && run.allSkipped.length === 0, 'nothing was skipped for these clean fixtures', run ? JSON.stringify(run.allSkipped) : '');

    ok(consoleErrors.length === 0, 'no console.error output during the full portfolio generate', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors during the full portfolio generate', pageErrors.join('\n        '));

    await context.close();
  });

  /* ── 3. {student} title-page substitution reaches the real PDFs ───────── */
  await runScenario('\n{student} token in the title page personalizes each student\'s PDF', async () => {
    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);

    await page.setInputFiles('#file-input', [fixtures.mariaB, fixtures.mariaA, fixtures.chen]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 3);
    await page.check('#opt-portfolio');
    await page.check('#opt-titlepage');
    await page.fill('#titlepage-title', "{student}'s Portfolio");
    await page.waitForSelector('#portfolio-preview:visible');

    const zipBuf2 = await downloadFile(page, () => page.click('#btn-generate'), 'zip');
    const entries2 = readZipEntries(zipBuf2);
    ok(entries2.length === 2, 'still one PDF per student (2) with a title page in play', entries2.map(e => e.name).join(', '));

    const byName2 = Object.fromEntries(entries2.map(e => [e.name, e.data]));
    // Without a title page: Chen Wei = 1 page, Maria Diaz = 2 pages (see
    // scenario 2). With {student} substituted into a non-empty title, every
    // student's PDF gains exactly one title page on top of that.
    ok(countPdfPages(byName2['Chen Wei.pdf']) === 2, 'Chen Wei\'s PDF gained exactly 1 title page (1 image + 1 title = 2)', String(countPdfPages(byName2['Chen Wei.pdf'])));
    ok(countPdfPages(byName2['Maria Diaz.pdf']) === 3, 'Maria Diaz\'s PDF gained exactly 1 title page (2 images + 1 title = 3)', String(countPdfPages(byName2['Maria Diaz.pdf'])));

    ok(consoleErrors.length === 0, 'no console.error output with a {student} title page template', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors with a {student} title page template', pageErrors.join('\n        '));

    await context.close();
  });

  /* ── 4. Turning portfolio mode back off restores the normal default name ── */
  await runScenario('\nunchecking portfolio mode restores the normal default filename', async () => {
    const { context, page } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);
    await page.setInputFiles('#file-input', [fixtures.chen]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 1);

    await page.check('#opt-portfolio');
    ok((await page.inputValue('#filename')) === 'portfolios.zip', 'sanity: checking the box swapped the default filename');
    await page.uncheck('#opt-portfolio');
    ok((await page.inputValue('#filename')) === 'assembled.pdf', 'unchecking it swaps the (still-untouched) default filename back');
    ok(!(await page.isVisible('#portfolio-preview')), 'the preview panel hides again once portfolio mode is off');

    await context.close();
  });
} finally {
  await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
