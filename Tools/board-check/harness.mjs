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
//                                      page.__blocked / page.__errs. Service
//                                      workers are blocked unless opts passes
//                                      serviceWorkers: 'allow'.
//   settle(page, ms)                   wait for timers/animation to coalesce
//   a11yScan(page, opts)               run axe-core in the page; resolves to
//                                      the violations at or above opts.impact
//                                      ('serious' by default), each with the
//                                      rule id, impact, help text and the
//                                      first few offending selectors
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
 *  `/Tools/005-Seating%20Chart%20Generator.html` finds the file with spaces.
 *
 *  Every response carries `Connection: close`. Node's http server otherwise
 *  answers keep-alive and closes an idle socket about six seconds after its
 *  last response (keepAliveTimeout 5 s, plus a second of grace), and a client
 *  that pools its connections on a keep-alive agent never closes them itself.
 *  A stylesheet re-requested at that exact moment — a page.reload() six
 *  seconds after first load is enough — is written onto a socket the server
 *  has just destroyed, and the request fails with `read ECONNRESET`. That is
 *  how main's CI run #8 crashed exit-ticket-generator/test/smoke-prompt-sets.mjs
 *  on 2026-09-02, five seconds into a suite that passes locally: the client
 *  was Playwright's route.fetch() in prepPage's CSS-rewriting branch (since
 *  removed — see prepPage), the window is one event-loop iteration, so it is
 *  rare, and it can land on any suite. No pooled socket means no idle socket
 *  to lose the race on, for Chromium's own pool as much as Playwright's; a
 *  fresh loopback connection per request costs nothing measurable. */
export function serve(port) {
  const server = http.createServer((req, res) => {
    res.setHeader('Connection', 'close');
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

// PW_CHROMIUM_EXECUTABLE is an escape hatch for machines where
// `npx playwright install chromium` can't reach the download host (a locked-down
// school network, a sandboxed CI container) but a compatible Chromium is already
// on disk. Unset — the normal case — Playwright resolves its own browser exactly
// as before.
// `opts.args` is additive Chromium launch flags, e.g. the fake-microphone
// pair a MediaRecorder suite needs (['--use-fake-device-for-media-stream',
// '--use-fake-ui-for-media-stream']). Optional and empty by default, so
// every existing no-arg call site (`launch()`) is unaffected.
export async function launch(opts = {}) {
  const exe = process.env.PW_CHROMIUM_EXECUTABLE;
  const base = exe ? { headless: true, executablePath: exe } : { headless: true };
  if (opts.args && opts.args.length) base.args = opts.args;
  return chromium.launch(base);
}

// Until 2026-09-03 the shared _ds stylesheet @imported Google Fonts over
// HTTPS on every page that linked it, and prepPage fetched every same-origin
// stylesheet through route.fetch() to strip that @import before the browser
// saw it — a test working around a site bug, and the code path that lost the
// keep-alive race described above serve(). The faces are vendored now
// (_shared/vendor/barlow/), the strip is gone, and a request to
// fonts.googleapis.com or fonts.gstatic.com is an offsite request like any
// other: aborted, and counted in page.__blocked.

/**
 * A fresh page in its own context. `base` is the origin the test considers
 * "on-site"; file:, data:, blob: and about: always pass (published-file tests
 * open their output from file://). Offsite requests are aborted; they land in
 * page.__blocked. Page errors, console errors, failed requests and >=400
 * responses land in page.__errs.
 */
export async function prepPage(browser, base, { width, height, dsf = 1, mobile = false, permissions, serviceWorkers = 'block' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dsf,
    isMobile: mobile,
    hasTouch: mobile,
    acceptDownloads: true,
    // Optional and undefined by default (Playwright treats that the same as
    // omitting the key) — only a suite that passes e.g. ['microphone'] for a
    // MediaRecorder flow changes behavior here.
    permissions,
    // Every tool registers sw.js, and a controlled page gets its responses
    // from the SW's precache — which bypasses the route() interception below
    // entirely (the offsite abort and the __blocked bookkeeping both
    // silently stop working from the second load on). Tests here are
    // about the tools, not the service worker, so keep it out of the loop.
    //
    // 'block' unless a suite asks otherwise, so every existing call site is
    // unaffected. The one suite that passes 'allow' is the service worker's
    // own (Tools/service-worker/test/), which is about the update flow rather
    // than about a tool — and which therefore has to accept that the caveats
    // above apply to it.
    serviceWorkers,
  });
  const page = await context.newPage();
  page.__blocked = [];
  page.__errs = [];
  const abortedByUs = new Set();

  const handle = async route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (/^(file|data|blob|about|chrome):/.test(url)) return route.continue();
    abortedByUs.add(url);
    page.__blocked.push(url);
    return route.abort();
  };

  // Nothing thrown in here may escape. A rejection from a route handler is an
  // unhandled promise rejection in the suite's process, and Node's default for
  // that is to exit 1 on the spot — before the suite's own reporter runs, so
  // the run shows "exited 1 without printing a FAIL line" and nothing else.
  // A harness-side failure is recorded on page.__errs instead, where every
  // suite's "no page/console errors" assertion turns it into a named FAIL.
  // Errors from a page or context that has already gone away (a suite closing
  // its browser with a request in flight) are noise, not findings.
  await page.route('**/*', async route => {
    try {
      await handle(route);
    } catch (e) {
      const msg = String(e && e.message || e).split('\n')[0];
      if (!/closed|already handled|detached|Target page/i.test(msg)) {
        page.__errs.push(`harness route failed: ${route.request().url()} — ${msg}`);
      }
      try { await route.continue(); } catch {}
    }
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

/* ── accessibility ─────────────────────────────────────────────────────── */

// axe-core is a dev dependency (package.json), injected into the page from
// node_modules at scan time. It is never served by the site and must never be
// precached: it exists only inside a test. The a11y widget (_shared/a11y.js)
// is on 77 tools with no automated check behind it; this is the check.
const AXE_PATH = path.join(SITE, 'node_modules', 'axe-core', 'axe.min.js');
const IMPACT_RANK = { minor: 0, moderate: 1, serious: 2, critical: 3 };

/**
 * Run axe-core against the page's current document.
 *   opts.impact   lowest impact to report ('minor' | 'moderate' | 'serious' |
 *                 'critical'); 'serious' by default, which is where a screen
 *                 reader user is actually blocked rather than inconvenienced.
 *   opts.rules    axe run options' `rules` map, to switch rules on or off.
 *   opts.include  a selector to scope the scan to.
 * Resolves to an array of { id, impact, help, helpUrl, nodes: [selector…],
 * count } sorted most severe first. Throws if axe-core is not installed.
 */
export async function a11yScan(page, { impact = 'serious', rules, include } = {}) {
  if (!fs.existsSync(AXE_PATH)) {
    throw new Error('axe-core is not installed. From the repo root, run: npm ci');
  }
  const already = await page.evaluate(() => typeof window.axe !== 'undefined');
  if (!already) await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async ({ rules, include }) => {
    const context = include ? { include: [include] } : document;
    const r = await window.axe.run(context, {
      resultTypes: ['violations'],
      rules: rules || {},
      // The colour-contrast rule is kept; iframes are none of ours.
      iframes: false,
    });
    return r.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      count: v.nodes.length,
      nodes: v.nodes.slice(0, 4).map(n => (n.target || []).join(' ')),
    }));
  }, { rules, include });
  const floor = IMPACT_RANK[impact] ?? IMPACT_RANK.serious;
  return results
    .filter(v => (IMPACT_RANK[v.impact] ?? 0) >= floor)
    .sort((a, b) => (IMPACT_RANK[b.impact] ?? 0) - (IMPACT_RANK[a.impact] ?? 0) || a.id.localeCompare(b.id));
}
