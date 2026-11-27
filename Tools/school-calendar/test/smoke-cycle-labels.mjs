// smoke-cycle-labels.mjs — 032's Day letters setting, on the real page.
//
//   node Tools/school-calendar/test/smoke-cycle-labels.mjs   (or: npm run test:school-calendar-cycle-labels)
//
// `abCycle.labels` is one optional field of `scv_calendar_v1` (AI-87; no new key). Held here:
//   older   A calendar saved before the field (the cycle on, no `labels`) loads with "A, B" in the setting and
//           A/B in the grids; pressing Apply with nothing changed writes the same `abCycle`, with no `labels`
//           field in it, so an ordinary calendar's record is unchanged.
//   letters With A, B, C, D the anchor date takes the chosen letter (C), the month grid, the year grid and its
//           key, and the printed week show C and D and never anything else, and "…is a" offers the four.
//   round   The record keeps `labels`; after a reload the setting, the choices, the anchor letter and the grids
//           are what they were. Setting A, B again takes the field out.
//   refuse  An unusable list (one letter, a repeat, a long word) is refused with a message and writes nothing.
// The page clock is pinned. Everything here is made up. Exits 1 on any failure.

import { serve, launch } from '../../board-check/harness.mjs';
import { newPinnedPage } from './_capture-views.mjs';

const PORT = 8675;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = `${BASE}/Tools/032-School%20Calendar%20Visualizer.html`;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await newPinnedPage(browser, BASE);
const dialogs = [];
page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('scv_calendar_v1')).abCycle);
const settle = (ms = 250) => page.waitForTimeout(ms);
const monthBadges = () => page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('#months .ab-badge')).map((b) => b.textContent))].sort());
const yearBadges = () => page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('#yearGrid .yab:not(.yab-off)')).map((b) => b.textContent))].sort());
const choices = () => page.evaluate(() => Array.from(document.querySelectorAll('#abAnchorLetter option')).map((o) => o.value));

console.log('School Calendar Visualizer — day letters');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(300);

/* older: the cycle on, as before the field */
await page.check('#abEnable');
await page.fill('#abAnchorDate', '2026-08-31');
await page.selectOption('#abAnchorLetter', 'B');
await page.click('#btnApplyAb');
await settle();
eq(await stored(), { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'B' }, 'older: the record has no labels field');
eq(await page.inputValue('#abLabels'), 'A, B', 'older: the setting reads A, B');
eq(await choices(), ['A', 'B'], 'older: the anchor choices are A and B');
eq(await monthBadges(), ['A', 'B'], 'older: the month grid says A and B');
const before = await stored();
await page.reload({ waitUntil: 'networkidle' }); await settle(300);
eq(await page.inputValue('#abLabels'), 'A, B', 'older: after a reload the setting still reads A, B');
eq(await page.inputValue('#abAnchorLetter'), 'B', 'older: and the anchor is still a B day');
await page.click('#btnApplyAb'); await settle();
eq(await stored(), before, 'older: Apply with nothing changed writes the same abCycle');

/* letters */
await page.fill('#abLabels', 'A, B, C, D');
await page.dispatchEvent('#abLabels', 'input');
eq(await choices(), ['A', 'B', 'C', 'D'], 'letters: "…is a" offers the four');
await page.selectOption('#abAnchorLetter', 'C');
await page.fill('#abAnchorDate', '2026-09-16');
await page.click('#btnApplyAb'); await settle();
eq(await stored(), { enabled: true, anchorDate: '2026-09-16', anchorLetter: 'C', labels: ['A', 'B', 'C', 'D'] }, 'letters: the record carries the labels');
eq(await monthBadges(), ['A', 'B', 'C', 'D'], 'letters: the month grid says A, B, C and D');
eq(await yearBadges(), ['A', 'B', 'C', 'D'], 'letters: the year grid badges say them too');
ok(/A, B, C, D: the school day/.test(await page.evaluate(() => document.getElementById('yearGrid').parentElement.textContent)), 'letters: the year grid key names them');
const sep16 = await page.evaluate(() => { const c = document.querySelector('#months [data-date="2026-09-16"]'); return c && (c.querySelector('.ab-badge') || {}).textContent; });
eq(sep16, 'C', 'letters: the anchor date is a C day');
const sep17 = await page.evaluate(() => { const c = document.querySelector('#months [data-date="2026-09-17"]'); return c && (c.querySelector('.ab-badge') || {}).textContent; });
eq(sep17, 'D', 'letters: and the next school day a D day');
await page.check('input[name="printMode"][value="week"]');
await page.fill('#weekPick', '2026-09-14'); await page.dispatchEvent('#weekPick', 'change'); await settle();
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#weekStrip .wd-ab')).map((e) => e.textContent)), ['A', 'B', 'C', 'D', 'A'], 'letters: the printed week Monday to Friday says A B C D A');
await page.check('input[name="printMode"][value="month"]');

/* round trip */
await page.reload({ waitUntil: 'networkidle' }); await settle(300);
eq(await page.inputValue('#abLabels'), 'A, B, C, D', 'round: the setting survives a reload');
eq(await choices(), ['A', 'B', 'C', 'D'], 'round: and so do the choices');
eq(await page.inputValue('#abAnchorLetter'), 'C', 'round: and the anchor letter');
eq(await monthBadges(), ['A', 'B', 'C', 'D'], 'round: and the grids');

/* refuse */
for (const bad of ['A', 'A, A', 'Monday, Tuesday']) {
  const rec = await stored(); dialogs.length = 0;
  await page.fill('#abLabels', bad); await page.click('#btnApplyAb'); await settle(100);
  ok(dialogs.length === 1 && /Day letters/.test(dialogs[0]), `refuse: "${bad}" gets a message`);
  eq(await stored(), rec, `refuse: "${bad}" writes nothing`);
}

/* back to A, B takes the field out */
await page.fill('#abLabels', 'A, B'); await page.dispatchEvent('#abLabels', 'input');
await page.selectOption('#abAnchorLetter', 'A'); await page.click('#btnApplyAb'); await settle();
eq(await stored(), { enabled: true, anchorDate: '2026-09-16', anchorLetter: 'A' }, 'back to A, B: the field is gone');
eq(await monthBadges(), ['A', 'B'], 'back to A, B: the grid says A and B');

eq(page.__errs, [], 'no page errors');
await browser.close(); server.close && server.close();
console.log(failed ? `${passed} passed, ${failed} FAILED` : `${passed} passed`);
process.exit(failed ? 1 : 0);
