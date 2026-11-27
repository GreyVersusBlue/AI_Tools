// smoke-cycle-labels.mjs — 010 reads a calendar that names its own cycle letters.
//
//   node Tools/command-center/test/smoke-cycle-labels.mjs   (or: npm run test:command-center-cycle-labels)
//
// 032 saves `abCycle.labels` (AI-87) in `scv_calendar_v1`, which 010 reads raw through _shared/school-day.js.
// Held here, on the real page with the clock pinned to 09:00 on a school day:
//   labels  With A, B, C, D the third school day after the anchor reads "C day" in the strip and the Today
//           panel, and the fourth "D day"; a bell schedule set per letter (A and B only) does not break it:
//           the page uses the ordinary day's schedule for a letter that has none.
//   older   A calendar saved before the field still reads A and B, as it did.
//   junk    A labels field that is not a usable list (one letter, a number) reads as A and B, and the page
//           raises no error.
//   write   010 never writes the calendar.
// Everything here is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../../school-calendar/scv-seed.js';
import { isTeachableDay } from '../../school-calendar/scv-pacing.js';

const PORT = 8676;
const BASE = `http://127.0.0.1:${PORT}`;
const DASH = BASE + '/Tools/010-command-center-dashboard.html';
const KEY = 'scv_calendar_v1';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SEED = seedCalendar2026();
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10); };
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const plain = (d) => !(SEED.days[d]?.types || []).length;
const P = (label, start, end) => ({ label, start, end });
// school day k from the anchor, picked so that none is tagged (no half day), so the words are the letter alone
const pick = (mod) => SCHOOL.slice(4).find((d, i) => plain(d) && (i + 4) % 4 === mod);
const calendar = (extra) => {
  const cal = seedCalendar2026();
  cal.abCycle = { enabled: true, anchorDate: SCHOOL[0], anchorLetter: 'A', ...extra };
  cal.bell = { v: 1, schedules: [
    { id: 'reg', name: 'Regular', periods: [P('Period 1', '07:30', '08:20'), P('Period 2', '08:25', '09:15')] },
    { id: 'sa', name: 'Long A', periods: [P('Block 1', '07:30', '09:00')] },
  ], regular: 'reg', letters: { A: 'sa', B: null }, types: {} };
  return JSON.stringify(cal);
};
const at = (date, hm) => new Date(`${date}T${hm}:00`);

const server = await serve(PORT);
const browser = await launch();
async function open(when, cal) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(when);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  await page.goto(BASE + '/index.html');
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [KEY, cal]);
  await page.goto(DASH, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const raw = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

console.log('Command Center — a calendar with its own cycle letters');
const C_DAY = pick(2), D_DAY = pick(3), A_DAY = pick(0), B_DAY = pick(1);
ok(C_DAY && D_DAY && A_DAY && B_DAY, 'the seed has plain days for every place in the ring');

{
  const cal = calendar({ labels: ['A', 'B', 'C', 'D'] });
  for (const [day, want, bell] of [[C_DAY, 'C day', 'Period 2'], [D_DAY, 'D day', 'Period 2'], [A_DAY, 'A day', 'Block 1']]) {
    const p = await open(at(day, '08:30'), cal);
    eq(await text(p, '#nowDay'), want, `labels: ${day} reads "${want}" in the strip`);
    eq(await text(p, '#nowPeriod'), bell, `labels: and the period is ${bell} (the letter's own schedule, else the ordinary day's)`);
    ok((await text(p, '[data-panel="today"] .today-kind') || '').startsWith(want), `labels: the Today panel starts "${want}"`);
    eq(await raw(p), cal, 'write: 010 does not write the calendar');
    eq(p.__errs, [], 'labels: no page error');
    await p.context().close();
  }
}
{
  const cal = calendar({});
  const a = await open(at(A_DAY, '08:30'), cal), b = await open(at(B_DAY, '08:30'), cal);
  eq([await text(a, '#nowDay'), await text(b, '#nowDay')], ['A day', 'B day'], 'older: a record with no labels still reads A and B');
  eq(a.__errs.concat(b.__errs), [], 'older: no page error');
  for (const x of [a, b]) await x.context().close();
}
for (const bad of [['A'], 7, ['A', 'A'], 'AB']) {
  const p = await open(at(B_DAY, '08:30'), calendar({ labels: bad }));
  eq(await text(p, '#nowDay'), 'B day', `junk: labels ${JSON.stringify(bad)} read as A and B`);
  eq(p.__errs, [], `junk: no page error for ${JSON.stringify(bad)}`);
  await p.context().close();
}

await browser.close(); server.close && server.close();
console.log(failed ? `${passed} passed, ${failed} FAILED` : `${passed} passed`);
process.exit(failed ? 1 : 0);
