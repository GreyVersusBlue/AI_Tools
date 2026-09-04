// smoke-quota-banner.mjs — the half of Path 4 P1 that a Node suite cannot
// prove: on a real full disk, in a real page, the teacher is actually told.
//
// This drives 019 (the first tool to adopt _shared/store.js) with localStorage
// filled to the ceiling, saves a room, and reads the banner back out of the
// browser. The repo has been bitten before by a sweep going green because the
// page was broken rather than fixed, so every assertion here looks at rendered
// state, not at a return value.
//
// It also covers the migration contract's one irreversible claim — that a room
// saved before 019 adopted Store still loads afterwards — because getting that
// wrong silently deletes a teacher's escape rooms.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8406;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/019-escape-room-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Store — a full disk is visible, and legacy rooms survive (Path 4 P1)');

const server = await serve(PORT);
const browser = await launch();

/* ── 1. A pre-Store, unversioned blob still loads, and is re-enveloped ── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(() => {
    // exactly what 019 wrote before it adopted Store: no envelope, no version
    localStorage.setItem('escape-room-builder:rooms', JSON.stringify({
      current: 'Ancient Egypt',
      sets: { 'Ancient Egypt': { name: 'Ancient Egypt', stations: [], cardsPerPage: 4 } },
    }));
  });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  const names = await page.$$eval('#setSwitch option', els => els.map(e => e.value));
  ok(names.includes('Ancient Egypt'), '1: the legacy room is on the switcher: ' + JSON.stringify(names));

  const selected = await page.$eval('#setSwitch', el => el.value);
  eq(selected, 'Ancient Egypt', '1: and is the one loaded');

  // still the legacy shape on disk — reading must not rewrite anything
  const beforeSave = await page.evaluate(() => JSON.parse(localStorage.getItem('escape-room-builder:rooms')));
  ok(beforeSave.v === undefined, '1: a read alone does not rewrite the payload');

  // now make it write, and check the envelope appears without losing the room
  await page.evaluate(() => {
    const el = document.getElementById('setName');
    el.value = 'Ancient Egypt II';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle(page, 250);

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('escape-room-builder:rooms')));
  eq(after.v, 1, '1: the next write stamps the envelope');
  ok(after.data && after.data.sets && Object.keys(after.data.sets).length >= 1,
    '1: and the rooms came through it: ' + JSON.stringify(Object.keys(after.data ? after.data.sets : {})));

  eq(page.__errs.length, 0, '1: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, '1: nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.context().close();
}

/* ── 2. A full disk produces a visible message that names the tool ────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  // Fill the origin's storage for real, rather than stubbing setItem: the
  // point of the test is the browser's own QuotaExceededError, including
  // whichever of the four name/code spellings this browser happens to use.
  //
  // Filling with big chunks alone is not enough: the first 512 KB write to
  // throw still leaves room for a small one, and the room 019 saves is small.
  // So step the chunk size down until even a few characters will not fit --
  // that is the state a teacher is actually in when this matters.
  const filled = await page.evaluate(() => {
    let n = 0, last = null;
    for (let size = 512 * 1024; size >= 1; size = Math.floor(size / 4)) {
      for (;;) {
        try {
          localStorage.setItem('__fill__' + n, 'x'.repeat(size));
          n++;
        } catch (e) {
          last = { name: e && e.name, code: e && e.code };
          break;
        }
      }
    }
    let tiny = null;
    try { localStorage.setItem('__tiny__', 'x'); } catch (e) { tiny = e && e.name; }
    return { writes: n, last, tiny };
  });
  ok(filled.writes > 0 && filled.last, '2: the fill hit the ceiling: ' + JSON.stringify(filled));
  ok(filled.tiny, '2: even a one-character write now throws: ' + JSON.stringify(filled));

  // Add a station through the tool's own button, which is what a teacher is
  // doing when this bites. It has to GROW the payload to fail: overwriting a
  // key with something no larger still fits on a full disk, and an earlier
  // draft of this test passed for exactly that reason.
  const before = await page.evaluate(() => (localStorage.getItem('escape-room-builder:rooms') || '').length);
  await page.click('#addStationBtn');
  await settle(page, 250);
  const after = await page.evaluate(() => (localStorage.getItem('escape-room-builder:rooms') || '').length);
  eq(after, before, '2: the write did not stick — the payload on disk is unchanged');

  const result = await page.evaluate(() => {
    const cur = window.Store.get('escape-room-builder:rooms', { version: 1, migrate: (f, d) => d }) || { sets: {} };
    cur.sets['padded'] = { name: 'padded', note: 'y'.repeat(4096) };
    return window.Store.set('escape-room-builder:rooms', cur, { version: 1 });
  });
  ok(!result.ok, '2: the write reports failure');
  ok(result.quota, '2: classified as a quota failure, not something else');

  await settle(page, 150);
  const banner = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="alert"]')]
      .find(n => /could not save/i.test(n.textContent || ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      text: el.textContent,
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0',
    };
  });

  ok(banner !== null, '2: a role=alert message exists');
  ok(banner && banner.visible, '2: and is actually rendered, not just in the DOM');
  ok(banner && /Escape Room Builder/.test(banner.text), '2: it names the tool: ' + (banner && banner.text));
  ok(banner && /Backup & Restore/.test(banner.text), '2: it points at Backup & Restore');

  eq(page.__blocked.length, 0, '2: nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.context().close();
}

/* ── 3. onChange reaches the tab that wrote, which `storage` never does ─ */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 200);

  const seen = await page.evaluate(async () => {
    const got = [];
    const off = window.Store.onChange('probe-key', v => got.push(v));
    window.Store.set('probe-key', { hello: 'world' });
    window.Store.remove('probe-key');
    off();
    window.Store.set('probe-key', { after: 'unsubscribe' });
    return got;
  });
  eq(seen, [{ hello: 'world' }, null], '3: same-tab set and remove both notified, unsubscribe stopped it');

  eq(page.__errs.length, 0, '3: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  await page.context().close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
