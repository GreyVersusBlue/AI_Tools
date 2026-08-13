// smoke-week.mjs — the School Calendar Visualizer's week-at-a-glance view.
//
//   node Tools/school-calendar/test/smoke-week.mjs
//
// The month grid answers "where does this fall in the year". A planner page
// answers a different question: what is happening Monday to Friday, and what do
// I need to know about each day. The part a teacher actually needs there is the
// note, and a 40px month cell has no room for it.
//
// So the properties worth holding down are about what survives into the strip:
// the note in full, the day type as a readable word rather than a colour chip
// (school printers are black and white), the A/B letter, the paced lesson —
// and a no-school day greyed rather than dropped, because "there is no Monday
// this week" is itself the thing worth seeing.
//
// Exits 1 on any failure. Nothing here describes a real school.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8168;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/* A week built to exercise every branch: a labelled day with a long note, a
   no-school day mid-week, an ordinary day with nothing on it, and a day
   carrying a free-text lesson. Monday 2026-09-14 through Friday 2026-09-18. */
const WEEK = '2026-09-14';

console.log('School Calendar Visualizer — week at a glance');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 600);

/* ── 1. the mode exists and is off by default ──────────────────────────── */
ok(await page.$('input[name="printMode"][value="week"]'), 'a One week print mode exists');
eq(await page.isVisible('#weekPickWrap'), false, 'its week picker is hidden until it is chosen');
eq(await page.evaluate(() => document.body.classList.contains('view-week')), false, 'and the view is unchanged');

/* ── 2. seed a week worth printing ─────────────────────────────────────── */
/* The calendar seeds lazily and writes nothing until something changes, so the
   year is set through the tool's own Apply button first — that is what puts
   scv_calendar_v1 on disk for the day entries to be added to. */
const dayOf = (n) => {
  const dt = new Date(WEEK + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};
await page.fill('#metaLabel', 'Test Year 2026-27');
await page.fill('#metaStart', dayOf(-30));
await page.fill('#metaEnd', dayOf(60));
await page.click('#btnApplyMeta');
await settle(page, 500);

const seeded = await page.evaluate((days) => {
  const raw = localStorage.getItem('scv_calendar_v1');
  if (!raw) return null;
  const cal = JSON.parse(raw);
  const noSchoolType = (cal.dayTypes || []).find(t => t.noSchool);
  cal.days = cal.days || {};
  cal.days[days.mon] = { types: [], label: 'Unit 2 begins', note: 'Bring the projector remote — the podium one is missing.', lesson: 'Fall of Rome intro' };
  cal.days[days.wed] = { types: noSchoolType ? [noSchoolType.id] : [], label: 'Teacher work day', note: '', lesson: '' };
  cal.days[days.fri] = { types: [], label: '', note: 'Progress reports due by 3pm.', lesson: '' };
  localStorage.setItem('scv_calendar_v1', JSON.stringify(cal));
  return { noSchool: noSchoolType ? noSchoolType.label : null };
}, { mon: dayOf(0), wed: dayOf(2), fri: dayOf(4) });
ok(seeded, 'the calendar store was written and could be seeded');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 600);

/* ── 3. choosing the mode swaps the view ───────────────────────────────── */
await page.check('input[name="printMode"][value="week"]');
await settle(page, 400);
eq(await page.evaluate(() => document.body.classList.contains('view-week')), true, 'choosing One week swaps the view');
eq(await page.isVisible('#weekPickWrap'), true, 'and reveals the week picker');
eq(await page.isVisible('#months'), false, 'the month grid is put away');
eq(await page.isVisible('#weekStrip'), true, 'and the strip is on screen — five columns of notes is not something to print sight-unseen');

await page.fill('#weekPick', WEEK);
await page.dispatchEvent('#weekPick', 'change');
await settle(page, 400);

const days = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('.week-day')).map(c => ({
    name: (c.querySelector('.wd-name') || {}).textContent || '',
    date: (c.querySelector('.wd-date') || {}).textContent || '',
    types: Array.from(c.querySelectorAll('.wd-type')).map(t => t.textContent),
    label: (c.querySelector('.wd-label') || {}).textContent || '',
    lesson: (c.querySelector('.wd-lesson') || {}).textContent || '',
    note: (c.querySelector('.wd-note') || {}).textContent || '',
    off: c.classList.contains('is-off'),
  })));

const week = await days();
eq(week.length, 5, 'Monday to Friday, five columns');
eq(week.map(d => d.name).join(','), 'Monday,Tuesday,Wednesday,Thursday,Friday', 'named in order');
ok(/Sep 14/.test(week[0].date), 'starting on the Monday that was picked: ' + JSON.stringify(week[0].date));
ok(/Sep 18/.test(week[4].date), 'and ending on that Friday');

/* ── 4. the note is the point ──────────────────────────────────────────── */
eq(week[0].label, 'Unit 2 begins', 'a labelled day shows its label');
ok(/projector remote/.test(week[0].note), 'and its note in full, not truncated: ' + JSON.stringify(week[0].note));
ok(/podium one is missing/.test(week[0].note), 'including the end of a long note');
eq(week[0].lesson, 'Fall of Rome intro', 'the free-text lesson shows too');
ok(/Progress reports/.test(week[4].note), "Friday's note is there as well");
eq(week[3].note, '', 'a day with nothing on it stays empty rather than inventing content');

/* ── 5. a no-school day is greyed, not dropped ─────────────────────────── */
if (seeded && seeded.noSchool) {
  eq(week[2].off, true, 'a no-school day mid-week is greyed');
  ok(week[2].types.length > 0, 'and names its type as a word, not just a colour chip');
  ok(/work day/i.test(week[2].label), 'with its label still readable');
}
eq(week[0].off, false, 'an ordinary teaching day is not greyed');

/* ── 6. the header names the week, and a notes area is printed ─────────── */
const head = await page.textContent('#weekStrip h2');
ok(/Test Year 2026-27/.test(head), 'the strip is headed with the year label: ' + JSON.stringify(head));
ok(/week of/.test(head), 'and says which week it is');
ok(await page.isVisible('.week-lines'), 'a blank notes area is printed with it — a planner page is written on');

/* ── 7. switching back restores the month grid ─────────────────────────── */
await page.check('input[name="printMode"][value="month"]');
await settle(page, 400);
eq(await page.evaluate(() => document.body.classList.contains('view-week')), false, 'switching back leaves week mode');
eq(await page.isVisible('#months'), true, 'and the month grid returns');
eq(await page.isVisible('#weekPickWrap'), false, 'with the week picker hidden again');

/* ── 8. it survives print media ────────────────────────────────────────── */
await page.check('input[name="printMode"][value="week"]');
await settle(page, 300);
await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const printed = await page.evaluate(() => {
  const strip = document.getElementById('weekStrip');
  const cols = document.querySelectorAll('.week-day');
  return {
    stripShown: getComputedStyle(strip).display !== 'none',
    monthsShown: getComputedStyle(document.getElementById('months')).display !== 'none',
    toolbar: getComputedStyle(document.querySelector('.toolbar')).display,
    cols: cols.length,
  };
});
eq(printed.stripShown, true, 'the strip prints');
eq(printed.monthsShown, false, 'the month grid does not print alongside it');
eq(printed.toolbar, 'none', 'and the toolbar stays off the page');
eq(printed.cols, 5, 'with all five days on it');
await page.emulateMedia({ media: 'screen' });

/* ── 8b. Units — named date ranges, deliberately not the lesson-by-lesson
   pacing sequence tested in smoke-pacing.mjs. A unit here is a name plus a
   start/end date; the only arithmetic is the instructional-day count, and
   the only new visuals are the calendar band and the printable table. ──── */
await page.check('input[name="printMode"][value="month"]');
await settle(page, 300);

ok(await page.$('#btnAddUnit'), 'an Add Unit control exists');
ok(await page.$('input[name="printMode"][value="units"]'), 'a Unit pacing calendar print mode exists');

// Tag one more day (distinct from the ones seeded above) as a half day, so
// the unit built below has both a holiday exclusion and a half day to call
// out — the case the assignment specifically asks for.
const halfDaySeeded = await page.evaluate((thuISO) => {
  const raw = localStorage.getItem('scv_calendar_v1');
  if (!raw) return null;
  const cal = JSON.parse(raw);
  const halfType = (cal.dayTypes || []).find(t => t.id === 'halfday');
  if (!halfType) return null;
  cal.days = cal.days || {};
  const existing = cal.days[thuISO] || { types: [], label: '', note: '', lesson: '' };
  cal.days[thuISO] = { ...existing, types: Array.from(new Set([...existing.types, halfType.id])) };
  localStorage.setItem('scv_calendar_v1', JSON.stringify(cal));
  return true;
}, dayOf(3));
ok(halfDaySeeded, 'the seeded legend has a half-day type to tag Thursday with');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

await page.click('#btnAddUnit');
await settle(page, 300);
eq(await page.$$eval('#unitsList .unit-row', rows => rows.length), 1, 'adding a unit creates one row');

await page.fill('#unitsList .unit-row input[data-f="name"]', 'Unit 3: Fractions');
await page.dispatchEvent('#unitsList .unit-row input[data-f="name"]', 'change');
await settle(page, 200);
await page.fill('#unitsList .unit-row input[data-f="start"]', dayOf(0));
await page.dispatchEvent('#unitsList .unit-row input[data-f="start"]', 'change');
await settle(page, 200);
await page.fill('#unitsList .unit-row input[data-f="end"]', dayOf(4));
await page.dispatchEvent('#unitsList .unit-row input[data-f="end"]', 'change');
await settle(page, 400);

/* the unit spans Mon 9/14–Fri 9/18: 5 weekdays, Wed 9/16 was already tagged
   no-school above, and Thu 9/17 is now a half day. */
const unitStatsText = (await page.textContent('#unitsList .unit-row .unit-stats') || '').replace(/\s+/g, ' ').trim();
eq(unitStatsText, '4 instructional days (incl. 1 half day)',
  'the holiday is excluded from the count and the half day is called out, not folded in: ' + JSON.stringify(unitStatsText));

/* ── the unit renders as a band across the calendar ──────────────────── */
eq(await page.textContent('.day[data-date="2026-09-14"] .unit-tag'), 'Unit 3: Fractions',
  'the unit name labels its first day on the month grid');
ok(await page.$('.day[data-date="2026-09-16"] .unit-bar'), 'a day in the middle of the range still gets a colored band');
eq(await page.$('.day[data-date="2026-09-16"] .unit-tag'), null,
  'but only the first day gets the name label, so the cell does not get crowded');
eq(await page.$('.day[data-date="2026-09-13"] .unit-bar'), null, 'a day before the unit starts gets no band');
eq(await page.$('.day[data-date="2026-09-19"] .unit-bar'), null, 'a day after the unit ends gets no band');

/* ── the printable pacing calendar lists it with its computed count ───── */
await page.check('input[name="printMode"][value="units"]');
await settle(page, 400);
eq(await page.evaluate(() => document.body.classList.contains('view-units')), true, 'choosing Unit pacing calendar swaps the view');
eq(await page.isVisible('#months'), false, 'the month grid is put away');
eq(await page.isVisible('#unitsPrint'), true, 'and the pacing table is shown on screen, not just at print time');

const printRow = await page.evaluate(() => {
  const row = document.querySelector('#unitsPrint tbody tr');
  return row ? Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim()) : null;
});
ok(printRow && /Unit 3: Fractions/.test(printRow[0]), 'the table names the unit: ' + JSON.stringify(printRow));
eq(printRow && printRow[3], '4', 'and lists its computed instructional-day count: ' + JSON.stringify(printRow));
eq(printRow && printRow[4], '1', 'with the half day in its own column: ' + JSON.stringify(printRow));

await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const unitsPrinted = await page.evaluate(() => ({
  tableShown: getComputedStyle(document.getElementById('unitsPrint')).display !== 'none',
  monthsShown: getComputedStyle(document.getElementById('months')).display !== 'none',
}));
eq(unitsPrinted.tableShown, true, 'the pacing table prints');
eq(unitsPrinted.monthsShown, false, 'the month grid does not print alongside it');
await page.emulateMedia({ media: 'screen' });

await page.check('input[name="printMode"][value="month"]');
await settle(page, 300);

/* ── 9. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
