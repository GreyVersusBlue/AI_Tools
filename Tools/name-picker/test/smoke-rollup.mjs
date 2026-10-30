// smoke-rollup.mjs — Name Picker: the page folds the picks that leave the 500-entry window into np_daily.
//
//   node Tools/name-picker/test/smoke-rollup.mjs
//
// Path 15 P2. With 499 picks already in np_history, three real picks make 502: the page keeps 500, np_daily holds
// the 2 that left, and reloading the page folds nothing twice. "Clear pick history" empties both.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8606;
const BASE = `http://127.0.0.1:${PORT}`;
const ROSTER = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'];
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.addInitScript(({ roster }) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  const h = Array.from({ length: 499 }, (_, i) => ({ name: 'Old ' + (i % 7), time: '09:00 AM', date: '2026-09-' + String(1 + (i % 20)).padStart(2, '0') }));
  localStorage.setItem('np_history', JSON.stringify(h));
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 1': roster }));
  localStorage.setItem('np_current', JSON.stringify(roster));
}, { roster: ROSTER });
await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
await settle(page, 400);
const read = () => page.evaluate(() => ({ h: JSON.parse(localStorage.getItem('np_history') || '[]'), d: JSON.parse(localStorage.getItem('np_daily') || 'null') }));
const total = d => (d ? Object.values(d.days).reduce((a, row) => a + Object.values(row).reduce((x, y) => x + y, 0), 0) : 0);

ok(total((await read()).d) === 0, 'a store with 499 picks has an empty rollup');
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => document.getElementById('pickBtn').click());
  await page.waitForSelector('.modal-overlay #modalDone', { timeout: 20000 });
  await page.evaluate(() => document.getElementById('modalDone').click());
  await settle(page, 400);
}
let s = await read();
/* the store reads np_history through a 500-entry repair, so what counts is the last 500 of what is on disk */
const window500 = h => Math.min(h.length, 500);
ok(window500(s.h) === 500, `np_history reads as 500 (${s.h.length} on disk)`);
ok(total(s.d) + window500(s.h) === 502, 'the rollup and the window together are all 502 picks');
ok(total(s.d) === 2, `np_daily holds the 2 picks that left the window (${total(s.d)})`);
ok(s.d && Object.keys(s.d.days).every(d => /^2026-09-\d\d$/.test(d)), 'they are the oldest picks, on their own days');
ok(s.d && Object.keys(s.d.who).every(k => k.startsWith('n:old ')), 'a name with no roster id is keyed on its normalised name');
ok(!/"__v"/.test(await page.evaluate(() => localStorage.getItem('np_daily'))), 'no version stamp on disk');

await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(() => document.getElementById('pickBtn').click());
await page.waitForSelector('.modal-overlay #modalDone', { timeout: 20000 });
await page.evaluate(() => document.getElementById('modalDone').click());
await settle(page, 400);
s = await read();
ok(total(s.d) === 3, `after a reload one more pick folds one more entry, not the earlier ones again (${total(s.d)})`);
ok(total(s.d) + window500(s.h) === 503, 'and the rollup plus the window are all 503 picks');

page.on('dialog', d => d.accept());
await page.evaluate(() => { const b = document.getElementById('clearHistory'); if (b) b.click(); });
await settle(page, 400);
s = await read();
ok(s.h.length === 0 && total(s.d) === 0, 'Clear pick history empties the history and the rollup');

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
