// verify-offline-copy.mjs — proves AI_Tools-offline.zip actually works when
// opened via a real file:// URL, not just that make-offline-copy.mjs ran
// without throwing.
//
//   node Tools/board-check/verify-offline-copy.mjs        (or: npm run offline:verify)
//
// Unzips to a scratch directory OUTSIDE the repo and opens each patched
// entry point with a real file:// URL in headless Chromium — using an http
// server here (the way the other test suites do, via harness.mjs's serve())
// would defeat the entire point of testing file://.
//
// Some tools have a real, pre-existing (not introduced by the offline-copy
// generator) dependency on the open internet regardless of file:// vs http —
// e.g. Blank Map Generator auto-runs a Wikimedia Commons search for a new
// project, and the _ds design-system stylesheet some tools link @imports
// Google Fonts (the same site-wide gap harness.mjs's own test suites already
// document and work around). A sandboxed CI/container network can't reach
// either, and shouldn't be expected to — what matters for THIS check is
// whether the LOCAL file:// loading (the thing this generator actually
// fixes) works, not whether Wikimedia/Google Fonts happen to be reachable
// from wherever this script runs. So: a failed request to a genuine offsite
// http(s) URL is logged but not fatal; a failed request to a local file://
// resource, or any uncaught page error, is fatal.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { launch, SITE } from './harness.mjs';

const ZIP_PATH = path.join(SITE, 'AI_Tools-offline.zip');

const ENTRIES = [
  'Tools/046-blank-map-generator.html',
  'Tools/035-schedule-visualizer.html',
  'Tools/036-final_grade_checker.html',
  'Tools/032-School Calendar Visualizer.html',
  'Tools/007-Name Picker.html',
  'Tools/008-behavior-points-tracker.html',
  'Tools/004-Classroom Timer.html',
  'Tools/005-Seating Chart Generator.html',
  'Tools/classroom-timer/mirror.html',
  'Tools/010-command-center-dashboard.html',
];

function fail(msg) {
  console.error('verify-offline-copy: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(ZIP_PATH)) {
  fail(`${path.relative(SITE, ZIP_PATH)} not found — run \`npm run offline:build\` first.`);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aplp-offline-verify-'));
execFileSync('unzip', ['-q', ZIP_PATH, '-d', scratch]);

const browser = await launch();
const errors = [];

for (const rel of ENTRIES) {
  const filePath = path.join(scratch, rel);
  if (!fs.existsSync(filePath)) { errors.push(`${rel}: not found in unzipped copy`); continue; }

  const page = await browser.newPage();
  const pageErrs = [];
  const offsiteNoise = [];
  page.on('pageerror', e => pageErrs.push(String(e)));
  page.on('console', msg => {
    // "Failed to load resource" is Chromium's generic echo of a request
    // that already failed at the network layer — the requestfailed handler
    // below captures the actual URL and decides on/offsite, so this generic
    // duplicate is never itself the source of truth (same convention as
    // harness.mjs's prepPage()).
    if (msg.type() === 'error' && !/^Failed to load resource/.test(msg.text())) {
      pageErrs.push(msg.text());
    }
  });
  page.on('requestfailed', req => {
    const url = req.url();
    if (url.startsWith('file://')) {
      pageErrs.push(`local resource failed to load: ${url} (${req.failure()?.errorText || 'unknown'})`);
    } else {
      offsiteNoise.push(`${url} (${req.failure()?.errorText || 'unknown'})`);
    }
  });

  await page.goto(pathToFileURL(filePath).href);
  await page.waitForTimeout(500);

  if (offsiteNoise.length) {
    console.log(`  ..  ${rel}: ${offsiteNoise.length} offsite request(s) unreachable from this environment (expected, not a failure):`);
    for (const n of offsiteNoise) console.log(`        ${n}`);
  }

  if (pageErrs.length) {
    errors.push(`${rel}: ${pageErrs.length} console/page error(s):\n    ` + pageErrs.join('\n    '));
  } else {
    console.log(`  ok  ${rel}`);
  }

  // Deeper check for Blank Map Generator: prove the bmg-vector.js patch
  // actually renders a built-in base map offline, not just that the page
  // didn't throw.
  if (rel === 'Tools/046-blank-map-generator.html' && !pageErrs.length) {
    try {
      await page.selectOption('#baseMapSelect', 'world');
      await page.click('#btnBaseMap');
      await page.waitForFunction(
        () => document.getElementById('mapImg')?.src.startsWith('blob:'),
        { timeout: 10000 }
      );
      console.log('  ok  Tools/046-blank-map-generator.html: built-in base map rendered offline');
    } catch (e) {
      errors.push(`Tools/046-blank-map-generator.html: built-in base map did not render — ${e}`);
    }
  }

  await page.close();
}

await browser.close();
fs.rmSync(scratch, { recursive: true, force: true });

if (errors.length) {
  console.error(`\nverify-offline-copy: FAILED (${errors.length} issue(s)):\n`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

console.log(`\nverify-offline-copy: OK — all ${ENTRIES.length} entry points load cleanly from a real file:// URL.`);
