// harness.mjs — shared browser-test plumbing for the suites under Tools/*/test/.
//
// Written from scratch for Round 1c of REFACTOR_PLAN.md: the original
// board-check folder was never committed to this repository (verified with
// `git log --all`), but three suites import from here — schedule/test/smoke.mjs,
// schedule/test/publish.mjs and seating-chart/test/drive-seating.mjs — so the
// exports below are shaped to match those call sites exactly, not the other
// way around.
//
//   serve(port)                        static file server rooted at the repo
//                                      root; resolves once listening, has a
//                                      synchronous .close()
//   launch()                           headless Chromium via Playwright
//   prepPage(browser, base, opts)      a page in its own context, with offsite
//                                      requests blocked and bookkeeping on
//                                      page.__blocked / page.__errs
//   settle(page, ms)                   wait for timers/animation to coalesce
//   SITE                               absolute path to the repo root
//
// Playwright comes from the repo-root package.json (devDependencies only —
// see CLAUDE.md "Test tooling"). The import is guarded so a fresh clone gets
// told what to run instead of a MODULE_NOT_FOUND stack.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed. From the repo root, run:\n' +
    '  npm ci\n' +
    '  npx playwright install chromium'
  );
  process.exit(1);
}

/* ── static server ─────────────────────────────────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

/** Static server rooted at the repo root. URL paths are percent-decoded, so
 *  `/Tools/005-Seating%20Chart%20Generator.html` finds the file with spaces. */
export function serve(port) {
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    } catch {
      res.writeHead(400); res.end('bad request'); return;
    }
    let file = path.normalize(path.join(SITE, pathname));
    if (!file.startsWith(SITE)) { res.writeHead(403); res.end('forbidden'); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/* ── browser ───────────────────────────────────────────────────────────── */

export async function launch() {
  return chromium.launch({ headless: true });
}

// The shared _ds stylesheet @imports Google Fonts over HTTPS on every page
// that links it. That is a pre-existing, site-wide gap, not a property of the
// tool under test, and image-to-pdf's suite already documents the same
// reasoning: counting it would make every suite permanently red for a cause
// no tool controls. Stripping the @import out of served CSS stops the request
// from ever being issued — which matters because drive-seating.mjs keeps its
// own page.on('request') log and asserts nothing left the site; an abort
// would still show up there. The CDN abort below stays as a second fence
// (silent, not counted in __blocked) in case fonts get pulled some other way.
const GOOGLE_FONTS_IMPORT = /@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/g;
const KNOWN_NOISE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * A fresh page in its own context. `base` is the origin the test considers
 * "on-site"; file:, data:, blob: and about: always pass (published-file tests
 * open their output from file://). Offsite requests are aborted; they land in
 * page.__blocked. Page errors, console errors, failed requests and >=400
 * responses land in page.__errs.
 */
export async function prepPage(browser, base, { width, height, dsf = 1, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    acceptDownloads: true,
    // Every tool registers sw.js, and a controlled page gets its responses
    // from the SW's precache — which bypasses the route() interception below
    // entirely (the CSS strip, the offsite abort, the __blocked bookkeeping
    // all silently stop working from the second load on). Tests here are
    // about the tools, not the service worker, so keep it out of the loop.
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.__blocked = [];
  page.__errs = [];
  const abortedByUs = new Set();

  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(base)) {
      if (/\.css(\?|$)/.test(url)) {
        const resp = await route.fetch();
        const body = await resp.text();
        if (body.includes('fonts.googleapis.com')) {
          return route.fulfill({
            status: 200,
            headers: { 'content-type': 'text/css; charset=utf-8' },
            body: body.replace(GOOGLE_FONTS_IMPORT, ''),
          });
        }
        return route.fulfill({ response: resp });
      }
      return route.continue();
    }
    if (/^(file|data|blob|about|chrome):/.test(url)) return route.continue();
    abortedByUs.add(url);
    if (!KNOWN_NOISE.test(url)) page.__blocked.push(url);
    return route.abort();
  });

  page.on('pageerror', e => page.__errs.push(String(e)));
  page.on('console', msg => {
    // "Failed to load resource" is Chromium's generic echo of a request we
    // aborted or a 404 the response listener below already records.
    if (msg.type() === 'error' && !/^Failed to load resource/.test(msg.text())) {
      page.__errs.push(msg.text());
    }
  });
  page.on('requestfailed', req => {
    if (!abortedByUs.has(req.url())) {
      page.__errs.push(`request failed: ${req.url()} (${req.failure()?.errorText || 'unknown'})`);
    }
  });
  page.on('response', res => {
    if (res.status() >= 400) page.__errs.push(`HTTP ${res.status()} ${res.url()}`);
  });

  return page;
}

/** Let timers, autosave debounces and animation frames coalesce. */
export const settle = (page, ms = 200) => page.waitForTimeout(ms);
