// smoke-storage-persist.mjs — sw-register.js asks the browser to keep this
// site's storage (navigator.storage.persist()), and only when it should.
//
//   node Tools/service-worker/test/smoke-storage-persist.mjs
//
// Every page loads _shared/sw-register.js, so this drives the real landing page
// with StorageManager's persist()/persisted() replaced by counters (Chromium
// decides persist() silently and would tell the suite nothing). What it proves:
//   1. A page whose origin holds saved data asks exactly once, a few seconds
//      after load — never at load, where it would compete with first paint.
//   2. An origin holding nothing does not ask: Firefox turns persist() into a
//      permission prompt, and a first-visit prompt is one nobody accepts.
//   3. Already persisted → no ask.
//   4. A busy page (window.TOOL_BUSY) does not ask — the same suppression rule
//      as the update bar, so a projected page never grows a browser prompt.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8441;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/index.html`;
const DELAY_MS = 5000;   // PERSIST_DELAY_MS in sw-register.js

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* Runs before any page script. `seed` puts a key in localStorage the way a
   teacher's earlier session would have; `persisted` is the browser's answer to
   persisted(); `busy` sets TOOL_BUSY. The seed is written only when the origin is
   still empty, so it cannot mask a key the page itself writes. */
function stub({ seed, persisted, busy }) {
  window.__persist = { asks: 0, checks: 0, firstAskAt: null, lengthAtAsk: null };
  const t0 = Date.now();
  const proto = window.StorageManager && window.StorageManager.prototype;
  if (proto) {
    proto.persisted = function () { window.__persist.checks++; return Promise.resolve(persisted); };
    proto.persist = function () {
      const p = window.__persist;
      p.asks++;
      if (p.firstAskAt === null) { p.firstAskAt = Date.now() - t0; p.lengthAtAsk = localStorage.length; }
      return Promise.resolve(true);
    };
  }
  if (seed) localStorage.setItem('smoke-storage-persist', '1');
  if (busy) window.TOOL_BUSY = true;
}

async function run(browser, opts) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 800 });
  await page.addInitScript(stub, opts);
  await page.goto(PAGE, { waitUntil: 'load' });
  await settle(page, 1000);
  const early = await page.evaluate(() => window.__persist.asks);
  await settle(page, DELAY_MS + 1500);
  const state = await page.evaluate(() => Object.assign({ length: localStorage.length }, window.__persist));
  const errs = page.__errs.slice();
  await page.context().close();
  return { early, state, errs };
}

const server = await serve(PORT);
const browser = await launch();
try {
  console.log('1. saved data, not yet persisted → asks once, after the delay');
  {
    const { early, state, errs } = await run(browser, { seed: true, persisted: false, busy: false });
    eq(early, 0, 'no ask in the first second after load');
    eq(state.asks, 1, 'persist() called exactly once');
    ok(state.lengthAtAsk > 0, 'the ask came from an origin holding data');
    eq(errs.length, 0, `no page errors (${errs.join(' | ')})`);
  }

  console.log('2. an origin holding nothing → no ask');
  {
    const { state } = await run(browser, { seed: false, persisted: false, busy: false });
    // The landing page may write a preference of its own on load; if it does,
    // the rule under test is "asked iff the origin held data at ask time".
    if (state.length === 0) eq(state.asks, 0, 'empty origin: persist() not called');
    else ok(state.asks === 1 && state.lengthAtAsk > 0,
      `page wrote ${state.length} key(s) itself; the ask followed the data rule`);
  }

  console.log('3. already persisted → no ask');
  {
    const { state } = await run(browser, { seed: true, persisted: true, busy: false });
    ok(state.checks >= 1, 'persisted() was consulted');
    eq(state.asks, 0, 'persist() not called when already persisted');
  }

  console.log('4. a busy page → no ask');
  {
    const { state } = await run(browser, { seed: true, persisted: false, busy: true });
    eq(state.asks, 0, 'persist() not called while TOOL_BUSY');
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nsmoke-storage-persist: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
