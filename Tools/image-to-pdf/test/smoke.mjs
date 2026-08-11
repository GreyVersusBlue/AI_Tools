// smoke.mjs — Image → PDF Assembler's first automated test suite.
//
//   node Tools/image-to-pdf/test/smoke.mjs
//
// Exits non-zero on any failure.
//
// Why this exists: the tool's improvement notes (improvement prompts/
// 011-image-to-pdf.md, Round 3 "Challenges") flag that a canvas/jsPDF
// regression bit a previous round silently — caught only by a human eyeballing
// a headless screenshot, not by any automated check. This suite is
// deliberately small: it drives the one-per-page path end to end (load →
// queue → generate → download) and asserts on the *shape* of the output (a
// real PDF, the right page count, no console/page errors), plus a second pass
// exercising the target-file-size retry ladder added this round. It does not
// attempt to cover contact sheets, SVG handling, title pages, or captions —
// those still rely on a human running the tool. "Catches an obvious
// regression" is the bar, not full coverage.
//
// Playwright comes from the repo-root package.json (devDependencies only —
// see CLAUDE.md "Test tooling") and picks its own Chromium from the standard
// browser cache. Fresh clone: npm ci && npx playwright install chromium

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeSolidPng, makeNoisePng } from './make-fixtures.mjs';

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

// ── Fixture files on disk ───────────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'img2pdf-smoke-'));
const fixtures = {
  red:    path.join(tmpDir, '1-red.png'),
  green:  path.join(tmpDir, '2-green.png'),
  blue:   path.join(tmpDir, '3-blue.png'),
  noise:  path.join(tmpDir, 'noise.png'),
};
fs.writeFileSync(fixtures.red,   makeSolidPng(60, 40, [200, 40, 40]));
fs.writeFileSync(fixtures.green, makeSolidPng(60, 40, [40, 160, 40]));
fs.writeFileSync(fixtures.blue,  makeSolidPng(60, 40, [40, 40, 200]));
fs.writeFileSync(fixtures.noise, makeNoisePng(700, 500, 42));

// ── PDF byte-level helpers (no external PDF parser) ─────────────────────────
function isPdf(buf) {
  return buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}
// Counts real page objects ("/Type /Page") without matching the root
// "/Type /Pages" dictionary. jsPDF may or may not put a space after the
// colon-less slash, so both spacings are accepted.
function countPdfPages(buf) {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches ? matches.length : 0;
}

// The shared design-system stylesheet this tool (and every other tool on the
// site) loads — Tools/_ds/…/styles.css — @imports Google Fonts over HTTPS.
// That's a pre-existing, site-wide, out-of-scope gap (not something this
// round touches — the file lives outside both Tools/011-image-to-pdf.html and
// Tools/image-to-pdf/), and in this sandboxed/offline test environment it
// always fails with net::ERR_CONNECTION_RESET, which Chromium reports as a
// generic "Failed to load resource" console error on every single page load
// regardless of anything this tool's own script does. Asserting "zero console
// errors" without excluding it would make the suite permanently red for a
// reason that has nothing to do with the two features this round shipped, so
// requests to anything other than file:// are aborted up front (this tool is
// supposed to be usable fully offline anyway) and the resulting generic
// resource-load-failure message is filtered out of the error list actually
// asserted on below. A real application error — a thrown exception, a
// console.error(err) from the catch blocks in generatePDF — has different,
// specific text and is NOT filtered.
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

async function downloadPdf(page, clickFn) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    clickFn(),
  ]);
  const savePath = path.join(tmpDir, `out-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await download.saveAs(savePath);
  return fs.readFileSync(savePath);
}

console.log('image-to-pdf smoke\n');

// Each numbered scenario runs in its own try/catch: a hard failure (a
// selector that no longer exists, a download that never fires because the
// button silently no-oped) should be reported as one clear FAIL line, not an
// uncaught-exception stack trace that aborts every later scenario too.
async function runScenario(label, fn) {
  console.log(label);
  try {
    await fn();
  } catch (e) {
    fail++;
    console.log(`  FAIL  scenario threw: ${e && e.message ? e.message : e}`);
  }
}

// This suite launches Chromium itself rather than going through
// board-check/harness.mjs, so it needs its own copy of the same escape hatch:
// PW_CHROMIUM_EXECUTABLE points at an already-installed browser on machines
// where `npx playwright install chromium` can't reach the download host.
// Unset — the normal case — Playwright resolves its own browser as before.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_EXECUTABLE
    ? { headless: true, executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
    : { headless: true }
);

try {
  /* ── 1. Basic path: load 3 images, one-per-page, generate, sanity-check output ── */
  await runScenario('basic generate (one image per page)', async () => {
    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);

    await page.setInputFiles('#file-input', [fixtures.red, fixtures.green, fixtures.blue]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 3);

    const genDisabledBefore = await page.locator('#btn-generate').isDisabled();
    ok(genDisabledBefore === false, 'Generate button enabled once files are queued');

    const pdfBuf = await downloadPdf(page, () => page.click('#btn-generate'));

    ok(isPdf(pdfBuf), 'downloaded file has a %PDF- header', `first bytes: ${pdfBuf.subarray(0, 8).toString('latin1')}`);
    const pageCount = countPdfPages(pdfBuf);
    ok(pageCount === 3, 'PDF has 3 pages (one per queued image)', `counted ${pageCount}`);

    const msgText = await page.locator('#msg').textContent();
    ok(/3 page/.test(msgText || ''), 'on-page status message reports 3 page(s)', msgText || '(empty)');

    ok(consoleErrors.length === 0, 'no console.error output during load+generate', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors during load+generate', pageErrors.join('\n        '));

    await context.close();
  });

  /* ── 2. Target file size: forced-impossible target reports honestly ─────── */
  await runScenario('\ntarget size — impossible target is reported honestly, not silently', async () => {
    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);

    await page.setInputFiles('#file-input', [fixtures.noise]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 1);
    await page.selectOption('#quality', 'high');
    await page.fill('#target-size', '0.001'); // ~1 KB — unreachable at any tier

    const pdfBuf = await downloadPdf(page, () => page.click('#btn-generate'));
    ok(isPdf(pdfBuf), 'downloaded file is still a valid PDF even when the target is missed');

    const run = await page.evaluate(() => window.__imgToPdfLastRun);
    ok(!!run, 'generatePDF exposes __imgToPdfLastRun for introspection');
    ok(run && run.attempts.length > 1, 'multiple quality tiers were actually attempted',
       run ? JSON.stringify(run.attempts) : '(no run info)');
    ok(run && run.attempts[run.attempts.length - 1].quality === 'min',
       'the retry ladder was exhausted down to the lowest ("min") tier before giving up',
       run ? JSON.stringify(run.attempts) : '');

    const msgText = (await page.locator('#msg').textContent()) || '';
    ok(/could not reach/i.test(msgText), 'status message honestly reports the target was not reached', msgText);
    ok(pdfBuf.length > 1024, 'sanity: final file is in fact still bigger than the impossible 1 KB target');

    ok(consoleErrors.length === 0, 'no console.error output during the multi-attempt retry path', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors during the multi-attempt retry path', pageErrors.join('\n        '));

    await context.close();
  });

  /* ── 3. Target file size: reachable target actually downgrades and succeeds ── */
  await runScenario('\ntarget size — reachable target downgrades quality and meets it', async () => {
    // First, a baseline run with no target set, to see how big "high" quality
    // naturally comes out for this fixture — the whole point of the noise
    // fixture is that quality tier visibly changes output size (see
    // make-fixtures.mjs), so a target of half that baseline should force at
    // least one step down the ladder and (for a fixture this size) succeed
    // before running out of tiers.
    const { context: ctxBaseline, page: pageBaseline } = await newPageWithGuards(browser);
    await pageBaseline.goto(pathToFileURL(TOOL_PATH).href);
    await pageBaseline.setInputFiles('#file-input', [fixtures.noise]);
    await pageBaseline.waitForFunction(() => document.querySelectorAll('#file-list li').length === 1);
    await pageBaseline.selectOption('#quality', 'high');
    const baselinePdf = await downloadPdf(pageBaseline, () => pageBaseline.click('#btn-generate'));
    await ctxBaseline.close();
    const baselineMB = baselinePdf.length / (1024 * 1024);

    const { context, page, consoleErrors, pageErrors } = await newPageWithGuards(browser);
    await page.goto(pathToFileURL(TOOL_PATH).href);
    await page.setInputFiles('#file-input', [fixtures.noise]);
    await page.waitForFunction(() => document.querySelectorAll('#file-list li').length === 1);
    await page.selectOption('#quality', 'high');
    const targetMB = Math.max(0.05, baselineMB * 0.5);
    await page.fill('#target-size', targetMB.toFixed(3));

    const pdfBuf = await downloadPdf(page, () => page.click('#btn-generate'));
    const run = await page.evaluate(() => window.__imgToPdfLastRun);

    ok(run && run.attempts.length > 1, 'downgrade path was actually taken (more than one quality tier tried)',
       run ? JSON.stringify(run.attempts) : '(no run info)');

    const finalMB = pdfBuf.length / (1024 * 1024);
    const metTarget = finalMB <= targetMB;
    const msgText = (await page.locator('#msg').textContent()) || '';

    // The on-page report must match reality: honest success language iff the
    // downloaded file is actually at/under the target, honest failure language
    // otherwise. Whichever branch reality took, the message must agree.
    if (metTarget) {
      ok(/downgraded to|within target size/i.test(msgText),
         'target met: status message says so (downgraded-to/within-target language)', msgText);
      ok(!/could not reach/i.test(msgText), 'target met: status message does not falsely claim failure', msgText);
    } else {
      ok(/could not reach/i.test(msgText),
         'target still missed even after downgrading: status message says so honestly', msgText);
    }

    ok(consoleErrors.length === 0, 'no console.error output during the successful-downgrade path', consoleErrors.join('\n        '));
    ok(pageErrors.length === 0, 'no uncaught page errors during the successful-downgrade path', pageErrors.join('\n        '));

    console.log(`        (baseline @high: ${baselineMB.toFixed(3)} MB, target: ${targetMB.toFixed(3)} MB, final @${run ? run.finalQuality : '?'}: ${finalMB.toFixed(3)} MB, met=${metTarget})`);

    await context.close();
  });
} finally {
  await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
