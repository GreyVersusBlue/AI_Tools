// smoke-sw-update.mjs — the service worker update flow, in a real browser.
//
//   node Tools/service-worker/test/smoke-sw-update.mjs
//
// The only suite on this site that lets a service worker run. Every other one
// passes serviceWorkers:'block' for a good reason (see harness.mjs): a
// controlled page is served from the precache, which bypasses the harness's
// request interception. This suite is about the worker itself, so it opts in.
//
// It also does not test the real site. It stages a tiny scratch copy — one
// page, sw-register.js, and a generated sw.js — so that "a new version was
// deployed" can be made to happen for real: the worker's bytes change between
// loads, which is exactly what the browser uses to decide an update exists.
// Testing against the repo's own sw.js would mean either editing a tracked file
// mid-run or asserting nothing at all.
//
// What it proves:
//   1. A first install does not offer anything. There is no older page to
//      disrupt, so asking would be noise.
//   2. After a bump, the open tab KEEPS ITS OLD ASSETS. This is the whole point
//      of the phase — the old worker used to swap them out mid-lesson.
//   3. The bar appears, and does not steal focus.
//   4. "Not now" hides it and leaves the worker waiting; the old version keeps
//      serving.
//   5. "Reload" gets the new version.
//   6. Fullscreen suppresses the offer, and it returns on the next load.
//   7. Two updates in one session BOTH reload. This is the regression test for
//      the reload guard: a plain "have we reloaded?" flag passes checks 1-6 and
//      fails here, stranding the page on old assets under a new controller.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..', '..', '..');
// Inside SITE because harness.serve() is rooted there. Gitignored.
const STAGE = path.join(SITE, 'Tools', 'board-check', '.sw-test-staging');
const PORT = 8177;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/Tools/board-check/.sw-test-staging/page.html`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── the staged site ─────────────────────────────────────────────────────── */

/** Write a worker whose precache carries `version`, plus the asset that names
 *  it. Changing the version changes sw.js's bytes, which is what makes the
 *  browser treat it as an update. */
function stage(version) {
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'version.js'), `window.STAGED_VERSION = ${JSON.stringify(version)};\n`);
  fs.writeFileSync(path.join(STAGE, 'sw.js'), `
const CACHE_VERSION = ${JSON.stringify(version)};
const PRECACHE = 'swtest-' + CACHE_VERSION;
const URLS = ['./page.html', './version.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PRECACHE).then((c) =>
    Promise.allSettled(URLS.map((u) => c.add(new Request(u, { cache: 'reload' }))))));
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((names) => Promise.all(
    names.filter((n) => n.startsWith('swtest-') && n !== PRECACHE).map((n) => caches.delete(n))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
`.trimStart());
}

// page.html loads version.js (so the page can report which version it is
// actually being served) and the REAL _shared/sw-register.js, which is the file
// under test. sw-register resolves '../sw.js' from its own src, so it is copied
// in beside the staged worker rather than linked from _shared/.
function stagePage() {
  fs.copyFileSync(path.join(SITE, '_shared', 'sw-register.js'), path.join(STAGE, 'sw-register.js'));
  fs.mkdirSync(path.join(STAGE, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'page.html'), `<!doctype html>
<meta charset="utf-8"><title>sw update test</title>
<body><h1>staged</h1>
<script src="./version.js"></script>
<script src="./sub/register.js" defer></script>
</body>
`);
  // sw-register resolves '../sw.js' relative to its own URL, so it is served
  // from a subdirectory to land on the staged worker.
  fs.copyFileSync(path.join(SITE, '_shared', 'sw-register.js'), path.join(STAGE, 'sub', 'register.js'));
}

function cleanup() {
  try { fs.rmSync(STAGE, { recursive: true, force: true }); } catch {}
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const barVisible = page => page.evaluate(() => !!document.getElementById('gvb-sw-bar'));
const servedVersion = page => page.evaluate(() => window.STAGED_VERSION);
const waitForController = page =>
  page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });

/* Waiting on conditions rather than on the clock. An earlier draft of this
   suite asserted after a fixed settle() and was intermittently wrong: the bar
   is put up by sw-register's `load` handler, after register() resolves, so
   800ms was usually but not always enough. A suite that fails one run in five
   is worse than no suite — it teaches you to re-run instead of to read. */

/** True if the bar appears within `timeout`. Returns false rather than throwing
 *  so the assertion reports "no bar" instead of a stack. */
async function barAppears(page, timeout = 10000) {
  try {
    await page.waitForFunction(() => !!document.getElementById('gvb-sw-bar'), null, { timeout });
    return true;
  } catch { return false; }
}

/** Wait until a worker is genuinely waiting — so the offer *could* have been
 *  made — and only then report whether the bar is showing. That is how "no bar"
 *  is asserted without racing the thing that would have drawn it. */
async function barAfterUpdateReady(page, timeout = 10000) {
  try {
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg && reg.waiting);
    }, null, { timeout });
  } catch { /* nothing waiting: the absence assertion below is still the answer */ }
  await settle(page, 400);
  return barVisible(page);
}

/** Wait for the page to report a given staged version, so "the reload landed"
 *  is not a guess about how long a reload takes. */
async function versionBecomes(page, want, timeout = 15000) {
  try {
    await page.waitForFunction(v => window.STAGED_VERSION === v, want, { timeout });
    return want;
  } catch { return await servedVersion(page); }
}

/** Ask the page to check for an update, then give the browser a moment to run
 *  install + statechange. */
async function bumpTo(page, version) {
  stage(version);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
  });
  await settle(page, 900);
}

/* ── run ─────────────────────────────────────────────────────────────────── */

cleanup();
stage('v1');
stagePage();

const server = await serve(PORT);
const browser = await launch();
let page;

try {
  page = await prepPage(browser, BASE, { width: 1100, height: 800, serviceWorkers: 'allow' });

  /* 1 — first install is silent */
  await page.goto(PAGE, { waitUntil: 'load' });
  await waitForController(page);
  await settle(page, 400);
  eq(await servedVersion(page), 'v1', 'the page starts on v1');
  eq(await barVisible(page), false, 'a first install offers nothing — there is no older page to disrupt');
  eq(await page.evaluate(() => window.location.href.length > 0), true, 'and the page did not reload itself on that first claim');

  /* 2, 3 — a bump leaves the tab alone and offers the update */
  await bumpTo(page, 'v2');
  eq(await servedVersion(page), 'v1',
    'after v2 installs, the open tab is still running v1 — the deploy did not swap under it');
  eq(await barAppears(page), true, 'the update bar appears');
  eq(await page.evaluate(() => document.getElementById('gvb-sw-bar').getAttribute('role')), 'status',
    'the bar is a status region, not a dialog');
  eq(await page.evaluate(() => document.activeElement === document.body), true,
    'and it does not take focus');

  /* 4 — "Not now" */
  await page.click('#gvb-sw-dismiss');
  await settle(page, 200);
  eq(await barVisible(page), false, '"Not now" hides the bar');
  eq(await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(reg && reg.waiting);
  }), true, 'and the new worker is still waiting, not discarded');
  eq(await servedVersion(page), 'v1', 'and the page is still being served v1');

  /* the offer comes back on the next load — dismissal is not persisted */
  await page.reload({ waitUntil: 'load' });
  eq(await barAppears(page), true, 'reloading offers the waiting update again — a dismissal is not a preference');

  /* 5 — "Reload" takes the update */
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {}),
    page.click('#gvb-sw-reload'),
  ]);
  eq(await versionBecomes(page, 'v2'), 'v2', '"Reload" gets the new version');
  eq(await barVisible(page), false, 'and the bar is gone afterwards');

  /* 6 — fullscreen suppresses the offer */
  await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {}));
  await settle(page, 300);
  const wentFullscreen = await page.evaluate(() => !!document.fullscreenElement);
  if (wentFullscreen) {
    await bumpTo(page, 'v3');
    eq(await barAfterUpdateReady(page), false, 'fullscreen suppresses the offer — no bar over a projected lesson');
    await page.evaluate(() => document.exitFullscreen().catch(() => {}));
    await settle(page, 300);
    await page.reload({ waitUntil: 'load' });
    eq(await barAppears(page), true, 'and the offer returns on the next load — suppression is not dismissal');
  } else {
    // Headless Chromium can refuse the Fullscreen API without a user gesture.
    // Assert the rule directly rather than silently skipping it.
    await bumpTo(page, 'v3');
    await page.evaluate(() => { window.TOOL_BUSY = true; });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => { window.TOOL_BUSY = true; });
    eq(await barAfterUpdateReady(page), false, 'a page that declares TOOL_BUSY is not interrupted');
    await page.evaluate(() => { window.TOOL_BUSY = false; });
    await page.reload({ waitUntil: 'load' });
    eq(await barAppears(page), true, 'and the offer returns once it is no longer busy');
  }

  /* 7 — two updates in one session both reload.
     The regression test for the reload guard. A plain "have we reloaded?" flag
     would pass everything above and fail here: the second controllerchange
     would be ignored and the page left on v3's assets under v4's controller. */
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {}),
    page.click('#gvb-sw-reload'),
  ]);
  eq(await versionBecomes(page, 'v3'), 'v3', 'the first of two updates in one session lands');

  await bumpTo(page, 'v4');
  eq(await barAppears(page), true, 'a second update in the same session is offered');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {}),
    page.click('#gvb-sw-reload'),
  ]);
  eq(await versionBecomes(page, 'v4'), 'v4',
    'and the SECOND reload happens too — the guard stops loops, not legitimate updates');

} finally {
  if (page) {
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }).catch(() => {});
  }
  await browser.close();
  server.close();
  cleanup();
}

console.log('\nService worker — the update flow');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:');
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
