// smoke-share-target.mjs — Class Roster Hub collects a file shared through the
// PWA share_target.
//
//   node Tools/class-roster-hub/test/smoke-share-target.mjs
//
// On an installed toolkit, "Share" from a spreadsheet or mail app POSTs the
// file to this page; sw.js parks the text in the 'aplp-share' cache under
// share/roster and redirects to ?shared=roster (the worker half is covered by
// Tools/service-worker/test/smoke-sw-tiers.mjs). This suite covers the page
// half with the worker blocked, as every tool suite is: it plants the parked
// response itself, opens the page with the flag, and checks that
//   1. the column-mapping import dialog opens, labelled with the file's name;
//   2. the flag is removed from the URL, so a refresh does not re-import;
//   3. the slot is cleared, so the file is consumed exactly once;
//   4. confirming the dialog lands the names in the editor;
//   5. the flag with an empty slot (a refresh, a bad file) is ignored quietly.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8402;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = `${BASE}/Tools/006-class-roster-hub.html`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });

try {
  // Plant what sw.js would have parked. The key is share/roster at the
  // worker's scope, which for the real site is the origin root.
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const cache = await caches.open('aplp-share');
    await cache.put(
      new Request(new URL('/share/roster', location.href).href),
      new Response('Student ID,Last,First,Period\n1001,Lovelace,Ada,3\n1002,Turing,Alan,3\n1003,Hopper,Grace,3\n',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Share-Name': encodeURIComponent('period-3.csv') } })
    );
  });

  await page.goto(PAGE + '?shared=roster', { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('importOverlay').hidden, null, { timeout: 8000 }).catch(() => {});
  eq(await page.evaluate(() => document.getElementById('importOverlay').hidden), false,
    'arriving with ?shared=roster opens the import dialog');
  eq(await page.evaluate(() => document.getElementById('importTitle').textContent), 'Import names from "period-3.csv"',
    'and the dialog names the shared file');
  eq(await page.evaluate(() => location.search), '', 'the ?shared flag is removed from the URL');
  eq(await page.evaluate(async () => {
    const cache = await caches.open('aplp-share');
    return !!(await cache.match(new URL('/share/roster', location.href).href));
  }), false, 'the share slot is cleared once collected');

  await page.evaluate(() => { document.getElementById('importHasHeader').checked = true; document.getElementById('importHasHeader').dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => { const m = document.getElementById('mapMode'); m.value = 'two'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => {
    const f = document.getElementById('mapFirstCol'), l = document.getElementById('mapLastCol');
    f.value = '2'; l.value = '1';
    f.dispatchEvent(new Event('change', { bubbles: true })); l.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.click('#importConfirmBtn');
  await settle(page, 300);
  const names = await page.evaluate(() => document.getElementById('namesInput').value.split('\n').filter(Boolean));
  eq(names.length, 3, 'confirming the dialog lands the three shared students in the editor');
  ok(names.includes('Ada Lovelace') || names.includes('Lovelace Ada') || names.some(n => /Lovelace/.test(n)), 'and Ada Lovelace is one of them: ' + JSON.stringify(names));

  // The flag with nothing parked: a refresh after the import, or a share the
  // worker could not read.
  await page.goto(PAGE + '?shared=roster', { waitUntil: 'load' });
  await settle(page, 600);
  eq(await page.evaluate(() => document.getElementById('importOverlay').hidden), true,
    '?shared=roster with an empty slot opens nothing');
  eq(await page.evaluate(() => location.search), '', 'and still cleans the URL');

  eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
  eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));
} finally {
  await browser.close();
  server.close();
}

console.log('\nClass Roster Hub — share_target hand-off');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
