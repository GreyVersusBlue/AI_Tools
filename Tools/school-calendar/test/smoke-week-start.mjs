// smoke-week-start.mjs — the School Calendar Visualizer's "Week starts on" setting, on the real page.
//
//   node Tools/school-calendar/test/smoke-week-start.mjs
//
// What is held:
//   default  With no key a calendar lays out as it always did (Sunday first) and the setting writes nothing;
//            the older layout itself is held by smoke-weeks.mjs's golden group.
//   layout   For Sunday, Monday and Saturday: the month grid, the year grid and the wall sheet put the
//            chosen weekday first in the header row, and every dated cell sits in the column its weekday
//            says, relative to that first day (so 1 September 2026 moves, and no date drifts).
//   storage  The choice is its own key, `scv_week_start`, removed again when set back to Sunday; the saved
//            calendar string (`scv_calendar_v1`, which 010 reads raw) is the same bytes before and after;
//            the choice survives a reload.
//   week     The one-week print stays Monday to Friday whatever the setting.
//
// The page clock is pinned. Everything here is made up. Exits 1 on any failure.

import { serve, launch } from '../../board-check/harness.mjs';
import { newPinnedPage } from './_capture-views.mjs';

const PORT = 8671;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = `${BASE}/Tools/032-School%20Calendar%20Visualizer.html`;
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await newPinnedPage(browser, BASE);
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const pick = async (v) => { await page.selectOption('#weekStart', v); await page.waitForTimeout(150); };
const store = (k) => page.evaluate((key) => localStorage.getItem(key), k);

/* the layout facts, read off the page: header letters, and for each month the column of every dated cell */
const monthFacts = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#months .month').forEach((m) => {
    const head = Array.from(m.querySelectorAll('.weekdays div')).map((d) => d.textContent);
    const cells = Array.from(m.querySelectorAll('.weeks > div'));
    const dated = cells.map((c, i) => ({ i, d: c.dataset.date })).filter((c) => c.d);
    out.push({ head, dated });
  });
  return out;
});
const yearFacts = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#yearGrid .ymonth').forEach((m) => {
    const head = Array.from(m.querySelectorAll('.yweekdays div')).map((d) => d.textContent);
    const first = Array.from(m.querySelectorAll('.yweeks > div')).findIndex((c) => !c.classList.contains('empty'));
    out.push({ head, first, title: m.querySelector('h4').textContent });
  });
  return out;
});
const dow = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();

console.log('School Calendar Visualizer — week starts on');

/* ═══ default ═══ */
const calBefore = await store('scv_calendar_v1');
eq(await page.inputValue('#weekStart'), '0', 'the setting reads Sunday with no key');
eq(await store('scv_week_start'), null, 'and nothing is stored for it');
{
  const f = await monthFacts();
  ok(f.length > 0, 'the seeded year has months to look at');
  ok(f.every((m) => m.head.join() === NAMES.join()), 'every month header starts Sunday');
}

/* ═══ layout ═══ */
for (const start of [1, 6, 0]) {
  await pick(String(start));
  const want = NAMES.slice(start).concat(NAMES.slice(0, start));
  const months = await monthFacts();
  ok(months.every((m) => m.head.join() === want.join()), `start ${NAMES[start]}: every month header begins ${want[0]}`);
  const drift = months.flatMap((m) => m.dated.filter((c) => c.i % 7 !== (dow(c.d) - start + 7) % 7));
  eq(drift.length, 0, `start ${NAMES[start]}: every dated cell of the month grid is in its weekday's column`);
  const years = await yearFacts();
  ok(years.every((y) => y.head.join() === want.map((w) => w[0]).join()), `start ${NAMES[start]}: the year grid header rotates`);
  const yfirst = years.find((y) => y.title.startsWith('September 2026'));
  eq(yfirst && yfirst.first, (dow('2026-09-01') - start + 7) % 7, `start ${NAMES[start]}: 1 September 2026 sits in the year grid's right column`);
  await page.check('input[name="printMode"][value="wall"]');
  const wall = await page.evaluate(() => {
    const box = document.querySelector('#wallSheet .wmonth');
    const g = box.querySelector('.wgrid');
    const cells = Array.from(g.children).slice(7);
    const at = cells.findIndex((c) => !c.classList.contains('wempty'));
    return { title: box.querySelector('h3').textContent, head: Array.from(g.querySelectorAll('.wdow')).map((d) => d.textContent), at, day: at < 0 ? 0 : Number(cells[at].querySelector('.wn').textContent) };
  });
  eq(wall.head.join(''), want.map((w) => w[0]).join(''), `start ${NAMES[start]}: the wall sheet header rotates`);
  const [mn, yr] = wall.title.split(' ');
  const mi = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(mn) + 1;
  const iso = `${yr}-${String(mi).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
  eq(wall.at % 7, (dow(iso) - start + 7) % 7, `start ${NAMES[start]}: the wall sheet's ${wall.title} puts day ${wall.day} in its weekday's column`);
  await page.check('input[name="printMode"][value="month"]');
}

/* ═══ storage ═══ */
await pick('1');
eq(await store('scv_week_start'), '1', 'Monday is stored under scv_week_start');
eq(await store('scv_calendar_v1'), calBefore, 'the saved calendar is the same bytes (010 reads it raw)');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
eq(await page.inputValue('#weekStart'), '1', 'the choice survives a reload');
eq((await monthFacts())[0].head[0], 'Mon', 'and the grid is laid out from it on load');
await pick('0');
eq(await store('scv_week_start'), null, 'back to Sunday removes the key');
await page.evaluate(() => localStorage.setItem('scv_week_start', '3'));
await page.reload({ waitUntil: 'networkidle' });
eq(await page.inputValue('#weekStart'), '0', 'a stored value that is not 1 or 6 reads as Sunday');

/* ═══ week ═══ */
await pick('6');
await page.check('input[name="printMode"][value="week"]');
const weekNames = await page.evaluate(() => Array.from(document.querySelectorAll('#weekStrip .wd-name')).map((n) => n.textContent.slice(0, 3)));
eq(weekNames, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 'the one-week print is Monday to Friday with the week starting Saturday');
eq(page.__errs, [], 'no page errors');

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
