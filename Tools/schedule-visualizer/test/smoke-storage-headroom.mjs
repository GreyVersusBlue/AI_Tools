// smoke-storage-headroom.mjs — 035's storage-headroom warning after it moved out of the
// page into schedule-visualizer/sv-storage.js (Path 11 P2, rank 140, third increment).
//
//   node Tools/schedule-visualizer/test/smoke-storage-headroom.mjs
//   (or: npm run test:layout-storage)
//
// Held: the module's functions are on window (saveBlueprintToLocalStorage reaches them by
// bare name); the estimate is the character count of every key and value; under ~4 MB
// there is no banner; over it a "warn" banner names the size, once, and stays dismissed
// until usage has dropped back under the line (then the next crossing warns again);
// Dismiss hides it; a message is text, never markup; a refused autosave write (quota)
// shows the "fail" banner that says the change was NOT saved. Exits 1 on any failure.

/* global BLUEPRINT_KEY, saveBlueprintToLocalStorage, checkStorageHeadroom, showStorageBanner, estimateLocalStorageBytes -- 035's globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8670;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });
await page.goto(BASE + '/Tools/035-schedule-visualizer.html', { waitUntil: 'networkidle' });
await settle(page, 400);
console.log('School Layout Visualizer: storage headroom (sv-storage.js)');

const banner = () => page.evaluate(() => {
  const el = document.getElementById('stviz-storage-warn');
  return el ? { shown: el.style.display !== 'none', cls: el.className, text: el.textContent, html: el.innerHTML } : null;
});
const fill = (chars) => page.evaluate((n) => { localStorage.setItem('zz_fill', 'x'.repeat(n)); }, chars);
const unfill = () => page.evaluate(() => localStorage.removeItem('zz_fill'));

eq(await page.evaluate(() => [typeof window.SVStorage, typeof checkStorageHeadroom, typeof showStorageBanner, typeof hideStorageBanner, typeof estimateLocalStorageBytes, window.STORAGE_WARN_BYTES]),
  ['object', 'function', 'function', 'function', 'function', 4 * 1024 * 1024], 'the module and its functions are on window');

console.log('1. the estimate');
const est = await page.evaluate(() => {
  let t = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); t += k.length + localStorage.getItem(k).length; }
  return [estimateLocalStorageBytes(), t];
});
eq(est[0], est[1], 'the estimate is the character count of every key and value');

console.log('2. under the line: no banner');
await page.evaluate(() => checkStorageHeadroom());
const b0 = await banner();
ok(!b0 || !b0.shown, 'a small store shows no banner');

console.log('3. over the line: one warning');
await fill(4 * 1024 * 1024 + 10);
await page.evaluate(() => checkStorageHeadroom());
let b = await banner();
ok(b && b.shown && /warn/.test(b.cls), 'over 4 MB a warn banner appears');
ok(b && /around 4\.\d MB/.test(b.text), 'it names the size');
await page.click('#stviz-storage-warn-dismiss');
b = await banner();
ok(b && !b.shown, 'Dismiss hides it');
await page.evaluate(() => checkStorageHeadroom());
b = await banner();
ok(b && !b.shown, 'still over the line: it does not nag again after being dismissed');
await unfill();
await page.evaluate(() => checkStorageHeadroom());
await fill(4 * 1024 * 1024 + 10);
await page.evaluate(() => checkStorageHeadroom());
b = await banner();
ok(b && b.shown, 'after usage dropped under the line, crossing it again warns again');
await unfill();
await page.evaluate(() => checkStorageHeadroom());
b = await banner();
ok(b && !b.shown, 'dropping under the line hides the banner');

console.log('4. a message is text');
await page.evaluate(() => showStorageBanner('warn', '<img src=x onerror=window.__x=1>'));
b = await banner();
ok(b && b.shown && b.text.includes('<img src=x'), 'markup in a message is shown as text');
ok(!(await page.evaluate(() => window.__x)), 'and did not run');

console.log('5. a refused autosave write');
await page.evaluate(() => { document.getElementById('stviz-storage-warn')?.remove(); });
await page.evaluate(() => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === BLUEPRINT_KEY) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    return real.call(this, k, v);
  };
  saveBlueprintToLocalStorage();
  Storage.prototype.setItem = real;
});
b = await banner();
ok(b && b.shown && /fail/.test(b.cls) && /could NOT be saved/.test(b.text), 'a quota refusal shows the "could NOT be saved" banner');

await browser.close(); server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
