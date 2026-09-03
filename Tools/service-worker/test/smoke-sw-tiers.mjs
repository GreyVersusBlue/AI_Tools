// smoke-sw-tiers.mjs — the two-tier precache and the stable Wikimedia cache,
// in a real browser, against the REAL sw.js logic.
//
//   node Tools/service-worker/test/smoke-sw-tiers.mjs
//
// smoke-sw-update.mjs generates a tiny worker of its own because it tests the
// page side (sw-register.js). This suite is about the worker, so it stages a
// copy of the repo's own sw.js with only the two URL arrays swapped for staged
// ones: SHELL_URLS names a page and one script, PRECACHE_URLS adds two
// "tool pages" (named so TOOL_PAGE matches them) and a third file. Everything
// else — install, the PRECACHE_REST pass, PRECACHE_STATUS, the cache names, the
// fetch handler — is the code teachers run. If the arrays can no longer be
// found the suite fails rather than silently testing something else.
//
// What it proves:
//   1. Install caches the shell tier and nothing else. The deferred tier is
//      not in the cache when the page first gains a controller.
//   2. The rest arrives without a reload: sw-register.js asks for it a few
//      seconds after load, the worker fills the cache, and the page hears
//      PRECACHE_PROGRESS with done:true and the right counts.
//   3. The readout element (data-sw-offline-status) went from hidden to
//      "N of M tools ready" to "all M tools ready".
//   4. Offline, a deferred-tier page is served from the cache once the pass has
//      run — the offline promise after the trickle is the whole site.
//   5. A version bump keeps the Wikimedia cache: an entry put in aplp-wiki
//      before the update is still there after the new worker activates, while
//      the old versioned precache is gone.
//   6. A second PRECACHE_REST while the cache is complete is a no-op that still
//      answers with status (so a page can always ask).
//   7. The manifest share_target: a multipart POST to .../Tools/006-class-roster-hub.html
//      is answered by the worker with a 303 to ?shared=roster and the file's
//      text parked in the aplp-share cache under share/roster, where Class
//      Roster Hub collects it. There is no server, so this is the only way a
//      shared CSV can arrive.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..', '..', '..');
const STAGE = path.join(SITE, 'Tools', 'board-check', '.sw-tiers-staging');
const PORT = 8401;
const BASE = `http://127.0.0.1:${PORT}`;
const STAGE_URL = `${BASE}/Tools/board-check/.sw-tiers-staging`;
const PAGE = `${STAGE_URL}/page.html`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── the staged site ─────────────────────────────────────────────────────── */

const SHELL = ['./page.html', './shell.js'];
const REST = ['Tools/001-alpha.html', 'Tools/002-beta.html', 'rest.js'];

function stageWorker(version) {
  let src = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  const swap = (name, urls) => {
    const re = new RegExp(`const ${name} = \\[[\\s\\S]*?\\n\\];`);
    if (!re.test(src)) throw new Error(`smoke-sw-tiers: could not find ${name} in sw.js`);
    src = src.replace(re, `const ${name} = [\n${urls.map(u => '  ' + JSON.stringify(u) + ',').join('\n')}\n];`);
  };
  if (!/const CACHE_VERSION = '[^']+';/.test(src)) throw new Error('smoke-sw-tiers: no CACHE_VERSION in sw.js');
  src = src.replace(/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = ${JSON.stringify(version)};`);
  swap('SHELL_URLS', SHELL);
  swap('PRECACHE_URLS', [...SHELL, ...REST]);
  fs.writeFileSync(path.join(STAGE, 'sw.js'), src);
}

function stageFiles() {
  fs.mkdirSync(path.join(STAGE, 'Tools'), { recursive: true });
  fs.mkdirSync(path.join(STAGE, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'shell.js'), 'window.SHELL_LOADED = true;\n');
  fs.writeFileSync(path.join(STAGE, 'rest.js'), 'window.REST_LOADED = true;\n');
  fs.writeFileSync(path.join(STAGE, 'Tools', '001-alpha.html'), '<!doctype html><meta charset="utf-8"><title>alpha</title><h1 id="alpha">alpha</h1>\n');
  fs.writeFileSync(path.join(STAGE, 'Tools', '002-beta.html'), '<!doctype html><meta charset="utf-8"><title>beta</title><h1 id="beta">beta</h1>\n');
  // A stand-in for Class Roster Hub, so the share_target redirect has a page to land on.
  fs.writeFileSync(path.join(STAGE, 'Tools', '006-class-roster-hub.html'), '<!doctype html><meta charset="utf-8"><title>hub</title><h1 id="hub">hub</h1>\n');
  // sw-register resolves '../sw.js' from its own URL, so it is served from a
  // subdirectory to land on the staged worker. The readout element is the
  // same hook index.html uses.
  fs.copyFileSync(path.join(SITE, '_shared', 'sw-register.js'), path.join(STAGE, 'sub', 'register.js'));
  fs.writeFileSync(path.join(STAGE, 'page.html'), `<!doctype html>
<meta charset="utf-8"><title>sw tiers test</title>
<body><h1>staged</h1>
<span id="readout" data-sw-offline-status hidden></span>
<script src="./shell.js"></script>
<script>
  window.PROGRESS = [];
  window.addEventListener('gvb-sw-progress', function (e) { window.PROGRESS.push(e.detail); });
</script>
<script src="./sub/register.js" defer></script>
</body>
`);
}

function cleanup() {
  try { fs.rmSync(STAGE, { recursive: true, force: true }); } catch {}
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const waitForController = page =>
  page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });

/** Which of the staged URLs the versioned precache holds right now. */
const cachedSet = (page, version) => page.evaluate(async (v) => {
  const cache = await caches.open('aplp-precache-' + v);
  const keys = await cache.keys();
  return keys.map(r => new URL(r.url).pathname.split('/.sw-tiers-staging/')[1]).sort();
}, version);

const cacheNames = page => page.evaluate(async () => (await caches.keys()).filter(n => n.startsWith('aplp-')).sort());

async function lastProgress(page, pred, timeout = 20000) {
  try {
    await page.waitForFunction((src) => {
      const f = new Function('p', 'return (' + src + ')(p)');
      return window.PROGRESS.some(f);
    }, pred.toString(), { timeout });
  } catch { /* fall through: the caller asserts on what is there */ }
  return page.evaluate(() => window.PROGRESS[window.PROGRESS.length - 1] || null);
}

/* ── run ─────────────────────────────────────────────────────────────────── */

cleanup();
stageFiles();
stageWorker('t1');

const server = await serve(PORT);
const browser = await launch();
let page;

try {
  page = await prepPage(browser, BASE, { width: 1100, height: 800, serviceWorkers: 'allow' });

  /* 1 — install is the shell tier only */
  await page.goto(PAGE, { waitUntil: 'load' });
  await waitForController(page);
  const atInstall = await cachedSet(page, 't1');
  eq(atInstall.join(','), 'page.html,shell.js',
    'right after install the precache holds the shell tier and nothing else');
  // The status reply can land within milliseconds of the controller, so this
  // is asserted as the invariant it is (shown iff reported) rather than as a
  // race against the worker.
  eq(await page.evaluate(() => document.getElementById('readout').hidden === (window.PROGRESS.length === 0)), true,
    'the readout is hidden exactly until the worker has reported');

  /* 2, 3 — the rest trickles in, and the page hears about it */
  const first = await lastProgress(page, p => p.type === 'PRECACHE_PROGRESS');
  ok(first && first.tools && first.tools.total === 2,
    `the first status counts the two staged tool pages (got ${JSON.stringify(first && first.tools)})`);
  const done = await lastProgress(page, p => p.done === true, 25000);
  eq(!!(done && done.done), true, 'the deferred pass finishes and reports done:true without a reload');
  eq(done && done.files.cached, 5, 'all five staged files are counted as cached');
  eq(done && done.tools.cached, 2, 'both tool pages are counted');
  const afterRest = await cachedSet(page, 't1');
  eq(afterRest.join(','), 'Tools/001-alpha.html,Tools/002-beta.html,page.html,rest.js,shell.js',
    'and the precache really holds every listed file');
  const readout = await page.evaluate(() => ({ text: document.getElementById('readout').textContent, hidden: document.getElementById('readout').hidden }));
  eq(readout.hidden, false, 'the readout is shown once there is something to show');
  eq(readout.text, 'Offline: all 2 tools ready', 'and it reads "all N tools ready" when the pass is complete');
  const sawPartial = await page.evaluate(() => window.PROGRESS.some(p => !p.done));
  eq(sawPartial, true, 'a not-yet-done status was reported first (the readout was never a lie)');

  /* 4 — offline, a deferred-tier page is served from the cache */
  await page.context().setOffline(true);
  const beta = await page.evaluate(async () => {
    try {
      const r = await fetch('./Tools/002-beta.html');
      return r.ok ? await r.text() : 'HTTP ' + r.status;
    } catch (e) { return 'ERR ' + e.message; }
  });
  eq(/id="beta"/.test(beta), true, 'offline, a page from the deferred tier is served from the precache');
  await page.context().setOffline(false);

  /* 5 — a bump keeps the Wikimedia cache and drops the old precache */
  await page.evaluate(async () => {
    const c = await caches.open('aplp-wiki');
    await c.put(new Request('https://upload.wikimedia.org/wikipedia/commons/x/test-map.png'), new Response('map-bytes'));
  });
  stageWorker('t2');
  await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); });
  await page.waitForFunction(() => !!document.getElementById('gvb-sw-bar'), null, { timeout: 15000 }).catch(() => {});
  eq(await page.evaluate(() => !!document.getElementById('gvb-sw-bar')), true, 'the update bar is offered for the bump');
  await page.evaluate(() => { window.PROGRESS = []; });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {}),
    page.click('#gvb-sw-reload'),
  ]);
  await waitForController(page);
  await settle(page, 500);
  const names = await cacheNames(page);
  eq(names.includes('aplp-precache-t2'), true, 'the new precache exists after the update');
  eq(names.includes('aplp-precache-t1'), false, 'the old versioned precache was evicted on activate');
  eq(names.includes('aplp-wiki'), true, 'the Wikimedia cache survived the bump');
  const mapStillThere = await page.evaluate(async () => {
    const c = await caches.open('aplp-wiki');
    const r = await c.match('https://upload.wikimedia.org/wikipedia/commons/x/test-map.png');
    return r ? await r.text() : null;
  });
  eq(mapStillThere, 'map-bytes', 'and the map image a teacher already downloaded is still in it');
  const done2 = await lastProgress(page, p => p.done === true, 25000);
  eq(!!(done2 && done2.done && done2.version === 't2'), true, 'the new version trickles its own deferred tier after the reload');

  /* 6 — asking again when complete is a no-op that still answers */
  await page.evaluate(() => { window.PROGRESS = []; });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    reg.active.postMessage({ type: 'PRECACHE_REST' });
  });
  const again = await lastProgress(page, p => p.done === true, 10000);
  eq(!!(again && again.done && again.files.cached === 5), true, 'a repeat PRECACHE_REST on a full cache answers with a done status');

  /* 7 — the share_target POST */
  const share = await page.evaluate(async () => {
    const fd = new FormData();
    fd.append('title', 'Period 3');
    fd.append('roster', new File(['Name,Period\nAda Lovelace,3\nAlan Turing,3\n'], 'period-3.csv', { type: 'text/csv' }));
    const res = await fetch('./Tools/006-class-roster-hub.html', { method: 'POST', body: fd });
    const landed = new URL(res.url);
    const cache = await caches.open('aplp-share');
    const key = new URL('share/roster', (await navigator.serviceWorker.getRegistration()).scope).href;
    const parked = await cache.match(key);
    return {
      ok: res.ok,
      body: await res.text(),
      landedOn: landed.pathname.split('/').pop() + landed.search,
      text: parked ? await parked.text() : null,
      name: parked ? decodeURIComponent(parked.headers.get('X-Share-Name') || '') : null,
    };
  });
  eq(share.ok && /id="hub"/.test(share.body), true, 'a share_target POST ends on the hub page itself (the worker answered; there is no server to)');
  eq(share.landedOn, '006-class-roster-hub.html?shared=roster', 'and it lands on Class Roster Hub with the ?shared=roster flag');
  eq(share.text, 'Name,Period\nAda Lovelace,3\nAlan Turing,3\n', 'the shared file\'s text is parked in the aplp-share cache');
  eq(share.name, 'period-3.csv', 'with its filename, for the import dialog\'s label');

} finally {
  if (page) {
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      for (const n of await caches.keys()) await caches.delete(n);
    }).catch(() => {});
  }
  await browser.close();
  server.close();
  cleanup();
}

console.log('\nService worker — the two-tier precache');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nfailures:');
  for (const f of fails) console.log('  ' + f);
  process.exit(1);
}
