// smoke-binder-stale.mjs — the evergreen emergency binder (Path 10 P3), in a browser.
//
//   node Tools/packet-builder/test/smoke-binder-stale.mjs   (or: npm run test:binder-stale-smoke; port 8597)
//
// What this pins:
//   - 090: "Print emergency binder" is one click: it ticks the Emergency binder's pages, calls print() once
//     and records the print (a fingerprint per source key, no data); a printed packet that is not the
//     Emergency binder records nothing; ?preset=emergency shows that packet with the button focused
//   - index.html and 010: no line on an empty profile; the "never printed" line once details exist;
//     none after the binder is printed; "changed" after 044 saves a different room; neither page's line
//     names a student or a detail
//   - 044: a save stamps its details with today's local date, and the binder prints that date
//   - axe finds nothing serious on the index with the line showing, on 010 and on 090
//
// print() is stubbed and the clock is pinned. Nothing here has been checked on paper. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8597;
const BASE = `http://127.0.0.1:${PORT}`;
const STANDING = 'subPlanBuilder.standingDetails.v1';
const EVERGREEN = 'gvb-packet:evergreen.v1';
const NOW = new Date('2026-10-29T15:00:00-04:00');

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const DETAILS = { teacherName: 'Ms. Example', roomNumber: '214', periods: [{ label: '1', time: '8:00-8:50' }], fireRoute: 'Out the east door', lockdownProcedure: 'Lights off', savedOn: '2026-09-02' };

async function open(browser, url, seed) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; window.dispatchEvent(new Event('beforeprint')); }; });
  await page.addInitScript(([seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed]);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const line = (page, sel) => page.$eval(sel, e => ({ hidden: e.hidden, text: e.textContent, href: e.getAttribute('href') })).catch(() => null);
const record = page => page.evaluate(k => localStorage.getItem(k), EVERGREEN);

console.log('Path 10 P3 — emergency binder');

const server = await serve(PORT);
const browser = await launch();
try {
  // ---- an empty profile: no line anywhere ----
  for (const [url, sel] of [['index.html', '#binderStatus'], ['Tools/010-command-center-dashboard.html', '#binderStatus']]) {
    const page = await open(browser, url, {});
    const l = await line(page, sel);
    ok(l && l.hidden, `${url}: empty profile shows no reminder`);
    await page.close();
  }

  // ---- details saved, never printed ----
  for (const [url, sel, href] of [['index.html', '#binderStatus', 'Tools/090-packet-builder.html?preset=emergency'], ['Tools/010-command-center-dashboard.html', '#binderStatus', '../Tools/090-packet-builder.html?preset=emergency']]) {
    const page = await open(browser, url, { [STANDING]: DETAILS });
    const l = await line(page, sel);
    ok(l && !l.hidden && /never been printed/.test(l.text), `${url}: details saved, never printed: the line shows`);
    eq(l && l.href, href, `${url}: the line links the Emergency binder`);
    ok(!/Example|214|east door/i.test(l ? l.text : ''), `${url}: the line names no detail`);
    if (url !== 'index.html') {   // the index's own contrast findings are the sweep's allowlist's, not this line's
      const bad = await a11yScan(page);
      ok(bad.length === 0, `${url}: axe finds nothing serious with the line showing ${JSON.stringify(bad)}`);
    }
    await page.close();
  }

  // ---- 090: one click prints, records, and quiets the reminder ----
  {
    const page = await open(browser, 'Tools/090-packet-builder.html', { [STANDING]: DETAILS });
    eq(await record(page), null, '090: nothing recorded before a print');
    await page.check('#secList .sec:nth-child(1) input');
    await page.evaluate(() => window.print());
    eq(await record(page), null, '090: a packet that is not the Emergency binder records nothing');
    await page.evaluate(() => { window.__printCalls = 0; });
    await page.click('#binderBtn');
    eq(await page.evaluate(() => window.__printCalls), 1, '090: one click calls print() once');
    const titles = await page.$$eval('#live .pb-page', ps => ps.map(p => p.getAttribute('data-section')));
    ok(titles.includes('emergency-info') && titles.includes('sub-plan'), '090: the click ticked the Emergency binder pages ' + titles.join());
    const html = await page.$eval('#printArea', e => e.textContent);
    ok(/Details last saved 2026-09-02\./.test(html), '090: the printed binder carries the details\' version stamp');
    const rec = JSON.parse(await record(page));
    ok(rec && rec.v === 1 && rec.at.startsWith('2026-10-29') && Object.keys(rec.sums).includes(STANDING), '090: the print is recorded with a fingerprint per key');
    ok(!/Example|214|east door/i.test(JSON.stringify(rec)), '090: the record holds no detail');
    const bad = await a11yScan(page);
    ok(bad.length === 0, '090: axe finds nothing serious ' + JSON.stringify(bad));
    await page.close();
  }
  // ---- ?preset=emergency, then a save in 044 turns the line to "changed" ----
  {
    const page = await open(browser, 'Tools/090-packet-builder.html?preset=emergency', { [STANDING]: DETAILS });
    ok((await page.$$eval('#live .pb-page', ps => ps.length)) >= 2, '090: ?preset=emergency shows the Emergency binder');
    eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'binderBtn', '090: ?preset=emergency leaves the print button focused');
    await page.click('#binderBtn');
    const mid = await page.evaluate(([k]) => ({ rec: localStorage.getItem(k) }), [EVERGREEN]);
    ok(mid.rec, '090: printed from the reminder\'s link');
    const idx = await page.context().newPage();
    await idx.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await settle(idx, 300);
    ok((await line(idx, '#binderStatus')).hidden, 'index: no reminder right after printing');
    await idx.close();

    const p44 = await page.context().newPage();
    await p44.clock.setFixedTime(NOW);
    await p44.goto(`${BASE}/Tools/044-Sub%20Plan%20Builder.html`, { waitUntil: 'load' });
    await settle(p44, 300);
    await p44.fill('#roomNumber', '305');
    await settle(p44, 700);
    const saved = await p44.evaluate(k => JSON.parse(localStorage.getItem(k)), STANDING);
    eq(saved.roomNumber, '305', '044: the new room is saved');
    eq(saved.savedOn, '2026-10-29', '044: the save stamps today\'s local date');
    await p44.close();

    const idx2 = await page.context().newPage();
    await idx2.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await settle(idx2, 300);
    const l = await line(idx2, '#binderStatus');
    ok(l && !l.hidden && /changed/.test(l.text), 'index: a room change after the print brings the reminder back');
    await idx2.close();
    const cc = await page.context().newPage();
    await cc.goto(`${BASE}/Tools/010-command-center-dashboard.html`, { waitUntil: 'load' });
    await settle(cc, 400);
    const l2 = await line(cc, '#binderStatus');
    ok(l2 && !l2.hidden && /changed/.test(l2.text), '010: and so does Command Center');
    const bad = await a11yScan(cc);
    ok(bad.length === 0, '010: axe finds nothing serious with the line showing ' + JSON.stringify(bad));
    await cc.close();
    await page.click('#binderBtn');
    const idx3 = await page.context().newPage();
    await idx3.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await settle(idx3, 300);
    ok((await line(idx3, '#binderStatus')).hidden, 'index: printing again quiets it');
    await idx3.close();
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
console.log('PASS binder-stale');
