// smoke-plan-units.mjs — 032's typed units, pins, "Count for pacing" and the dated-unit
// conversion, in the page (Path 9 P2, increment 2). scv-plan.js itself is held by
// plan.test.mjs; this holds what the page does with it.
//
//   node Tools/school-calendar/test/smoke-plan-units.mjs   (or: npm run test:school-calendar-plan-units)
//
// What is held: the Dated units card is hidden while `cal.units` is empty and shown while it
// is not; "Turn into a course…" previews every unit before and after, refuses two that
// overlap (naming both, Apply disabled), and on Apply makes a course whose units are pinned
// at their starts and stamped on the first and last school day of their old spans, empties
// `cal.units` (the card goes away), draws the units as bands, and Undo writes the old bytes
// back; a course with no lessons takes typed units ("+ Add unit", class days, order, remove);
// a pin leaves open days before its unit, or shortens the unit before it, and the notes say
// so, as they do for a pin on a Saturday and a pin on or before the unit before; "Let these
// flow…" previews and then clears every pin after the first, with Undo; unticking "Count for
// pacing" on the half-day type stores `pace: "skip"` and moves the unit holding Sep 18 a day
// later, said in the bar, and a course's own "Counts" puts it back; the drawer on a typed
// unit's day says which day of how many and offers "This unit needs another day" and "This
// class didn't meet"; the card has no serious axe finding. Then the deliberate breaks: the
// scenario is run against a page whose scv-plan.js is altered on the wire, and each must fail.
//
// The clock is pinned (2026-09-15 10:00 local); every expected date is read off the seeded
// 2026-27 calendar with scv-pacing.js's isTeachableDay, not with the module under test.
// Nothing here describes a real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';

const PORT = 8542;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';
const NOW = new Date('2026-09-15T10:00:00');

let passed = 0, failed = 0;
const fails = [];
let quiet = false;
let breakFails = 0;
const ok = (cond, label) => {
  if (quiet) { if (!cond) breakFails++; return !!cond; }
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ── dates off the seed, without scv-plan.js ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const schoolIn = (a, b) => SCHOOL.filter((d) => d >= a && d <= b);
const isSat = (d) => new Date(d + 'T12:00:00Z').getUTCDay() === 6;

function datedBlob(units) {
  const cal = seedCalendar2026();
  cal.units = units;
  return cal;
}
const DATED = [
  { id: 'unit_b', name: 'Ratios', start: '2026-10-01', end: '2026-10-30', color: '#8a3ea1' },
  { id: 'unit_a', name: 'Fractions', start: '2026-09-01', end: '2026-09-30', color: '#2e6b8f' },
];

const server = await serve(PORT);
const browser = await launch();

async function freshPage(routes = {}) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(NOW);
  page.__answers = [];
  page.on('dialog', (d) => {
    const a = page.__answers.length ? page.__answers.shift() : null;
    if (a === false) return d.dismiss();
    return d.type() === 'prompt' ? d.accept(a === null ? d.defaultValue() : String(a)) : d.accept();
  });
  for (const [file, edit] of Object.entries(routes)) {
    await page.route('**/school-calendar/' + file, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: edit(await res.text()), headers: { ...res.headers(), 'content-type': 'text/javascript' } });
    });
  }
  return page;
}
const raw = (page) => page.evaluate(() => localStorage.getItem('scv_calendar_v1'));
const stored = async (page) => JSON.parse(await raw(page) || 'null');
const putRaw = (page, s) => page.evaluate((v) => { if (v === null) localStorage.removeItem('scv_calendar_v1'); else localStorage.setItem('scv_calendar_v1', v); }, s);
const open = async (page) => { await page.goto(URL_PAGE, { waitUntil: 'networkidle' }); await settle(page, 400); };
const notice = async (page) => (await page.isVisible('#planNotice')) ? (await page.textContent('#planNoticeText')).trim() : '';
const openDay = async (page, date) => { await page.click(`#months .day[data-date="${date}"]`); await settle(page, 200); };
const active = (cal) => cal.plan.courses.find((c) => c.id === cal.plan.active);
const unitRows = (page) => page.$$eval('#unitTable tbody tr', (rows) => rows.map((r) => [...r.cells].map((c) => {
  const i = c.querySelector('input'); return i ? i.value : c.textContent.trim();
})));
const notes = async (page) => (await page.textContent('#unitNotes')).trim();

/** The scenario every break re-runs: the conversion, then a pin on a typed course. */
async function scenario(page, label) {
  await page.goto(BASE + '/index.html');
  await putRaw(page, JSON.stringify(datedBlob(DATED)));
  await open(page);
  ok(await page.isVisible('#unitsCard'), `${label}: the Dated units card is shown while there are dated units`);
  await page.click('#btnConvertUnits');
  await settle(page, 200);
  const before = await raw(page);
  ok(await page.isEnabled('#convertApply'), `${label}: two units that do not overlap can be converted`);
  await page.click('#convertApply');
  await settle(page, 300);
  const cal = await stored(page);
  const c = active(cal);
  eq(c && c.units.map((u) => [u.name, u.pin, u.days]), [
    ['Fractions', '2026-09-01', schoolIn('2026-09-01', '2026-09-30').length],
    ['Ratios', '2026-10-01', schoolIn('2026-10-01', '2026-10-30').length],
  ], `${label}: the course's units are pinned at their starts with their school days, in date order`);
  const fa = schoolIn('2026-09-01', '2026-09-30'), ra = schoolIn('2026-10-01', '2026-10-30');
  eq(c && c.units.map((u) => [u.start, u.end, u.short]), [[fa[0], fa[fa.length - 1], 0], [ra[0], ra[ra.length - 1], 0]], `${label}: each unit is stamped on the first and last school day of its old span`);
  eq(cal.units, [], `${label}: cal.units is emptied`);
  ok(!(await page.isVisible('#unitsCard')), `${label}: and the Dated units card goes away`);
  ok((await notice(page)).includes('Every unit kept its school days'), `${label}: the bar says nothing moved`);
  await page.click('#planUndo');
  await settle(page, 300);
  ok((await raw(page)) === before, `${label}: Undo writes the stored bytes back exactly`);

  // a typed course and a pin
  await page.goto(BASE + '/index.html');
  await putRaw(page, null);
  await open(page);
  page.__answers.push('Typed');
  await page.click('#btnCourseAdd');
  await settle(page, 200);
  await page.click('#btnUnitAdd'); await settle(page, 200);
  await page.click('#btnUnitAdd'); await settle(page, 200);
  let t = active(await stored(page));
  eq(t.units.map((u) => [u.days, u.start, u.end]), [[10, SCHOOL[0], SCHOOL[9]], [10, SCHOOL[10], SCHOOL[19]]], `${label}: two typed units of 10 class days flow one after the other`);
  await page.fill('#unitTable tbody tr:nth-child(2) input[type=date]', SCHOOL[14]);
  await page.dispatchEvent('#unitTable tbody tr:nth-child(2) input[type=date]', 'change');
  await settle(page, 300);
  t = active(await stored(page));
  eq([t.units[1].pin, t.units[1].start], [SCHOOL[14], SCHOOL[14]], `${label}: a pin later than the natural start moves the unit there`);
  ok((await notes(page)).includes('4 class days are open before Unit 2'), `${label}: and the notes count the open days`);
  eq((await unitRows(page))[1][5], '4', `${label}: the Open column says 4`);
}

console.log('School Calendar Visualizer: typed units, pins and the dated-unit conversion (Path 9 P2 increment 2)');

const page = await freshPage();
page.__errs = [];
page.on('pageerror', (e) => page.__errs.push(String(e)));

/* ═══ 1. no dated units: the card is hidden ═══ */
await open(page);
ok(!(await page.isVisible('#unitsCard')), 'with no dated units the Dated units card is hidden');
eq(await raw(page), null, 'and nothing is written on a first visit');

/* ═══ 2. the scenario (conversion, typed units, a pin) ═══ */
await scenario(page, 'page');

/* ═══ 3. more pins, the notes, order and remove ═══ */
{
  await page.fill('#unitTable tbody tr:nth-child(2) input[type=date]', SCHOOL[7]);
  await page.dispatchEvent('#unitTable tbody tr:nth-child(2) input[type=date]', 'change');
  await settle(page, 300);
  let t = active(await stored(page));
  eq([t.units[0].short, t.units[0].end, t.units[1].start], [3, SCHOOL[6], SCHOOL[7]], 'a pin inside unit 1 leaves it 3 short and keeps its first days');
  eq((await unitRows(page))[0][6], '3', 'the Short column says 3');
  const sat = SCHOOL.slice(12).map((d) => addDays(d, 1)).find(isSat);
  await page.fill('#unitTable tbody tr:nth-child(2) input[type=date]', sat);
  await page.dispatchEvent('#unitTable tbody tr:nth-child(2) input[type=date]', 'change');
  await settle(page, 300);
  ok(/Unit 2 is pinned to .*, which is not a class day for Typed, so it starts/.test(await notes(page)), 'a pin on a Saturday says where the unit starts instead');
  await page.click('#btnUnitAdd'); await settle(page, 200);
  await page.fill('#unitTable tbody tr:nth-child(3) input[type=date]', SCHOOL[0]);
  await page.dispatchEvent('#unitTable tbody tr:nth-child(3) input[type=date]', 'change');
  await settle(page, 300);
  ok((await notes(page)).includes('Unit 3 is pinned to') && (await notes(page)).includes('on or before the start of the unit before it'), 'a pin before the unit before it is said not to be used');
  // order: move Unit 3 up, then remove it
  await page.click('#unitTable tbody tr:nth-child(3) button[aria-label="Move Unit 3 earlier"]');
  await settle(page, 300);
  t = active(await stored(page));
  eq(t.units.map((u) => u.name), ['Unit 1', 'Unit 3', 'Unit 2'], 'Move earlier reorders the units');
  await page.click('#unitTable tbody tr:nth-child(2) button[aria-label="Remove Unit 3"]');
  await settle(page, 300);
  t = active(await stored(page));
  eq(t.units.map((u) => u.name), ['Unit 1', 'Unit 2'], 'Remove takes the unit out');
  // class days typed
  await page.fill('#unitTable tbody tr:nth-child(1) input[type=number]', '6');
  await page.dispatchEvent('#unitTable tbody tr:nth-child(1) input[type=number]', 'change');
  await settle(page, 300);
  t = active(await stored(page));
  eq([t.units[0].days, t.units[0].end], [6, SCHOOL[5]], 'typing 6 class days ends unit 1 on the sixth school day');
  ok((await page.textContent('#paceStatus')).includes('Planned in units: 2 units, 16 class days'), 'the status line counts the typed plan');
}

/* ═══ 4. "Let these flow…" ═══ */
{
  ok(await page.isVisible('#btnUnitFlow'), '"Let these flow…" is offered while a unit after the first is pinned');
  const before = await raw(page);
  await page.click('#btnUnitFlow');
  await settle(page, 200);
  ok(await page.isVisible('#flowBox'), 'it opens a preview first');
  eq(await raw(page), before, 'and the preview writes nothing');
  ok(/Unit 2/.test(await page.textContent('#flowBox')), 'the preview lists the unit whose dates change');
  await page.click('#flowApply');
  await settle(page, 300);
  const t = active(await stored(page));
  eq([t.units[0].pin, t.units[1].pin, t.units[1].start], [null, null, SCHOOL[6]], 'after it the pins are gone and Unit 2 follows Unit 1');
  ok(!(await page.isVisible('#btnUnitFlow')), 'and the button goes away');
  ok((await notice(page)).length > 0 && await page.isVisible('#planUndo'), 'the bar offers Undo');
  await page.click('#planUndo');
  await settle(page, 300);
  eq(await raw(page), before, 'Undo puts the pins back, byte for byte');
}

/* ═══ 5. Count for pacing, and a course's own override ═══ */
{
  // a plain two-unit course, unpinned, holding Sep 18 (a half day in the seed) in unit 2
  await putRaw(page, null);
  await open(page);
  page.__answers.push('Pace');
  await page.click('#btnCourseAdd'); await settle(page, 200);
  await page.click('#btnUnitAdd'); await settle(page, 200);
  await page.click('#btnUnitAdd'); await settle(page, 200);
  const halfIdx = SCHOOL.indexOf('2026-09-18');
  ok(halfIdx >= 10 && halfIdx < 20, 'the fixture: Sep 18 is in unit 2');
  const box = await page.$('#legendList input[data-f=pace] >> nth=0');
  const halfBox = await page.$('.legend-row:has(input[value*="Half Day"]) input[data-f=pace]');
  ok(!!box && !!halfBox, 'each school day type has a "Count for pacing" box');
  await halfBox.click(); // the legend is redrawn by the change, so no uncheck()
  await settle(page, 300);
  let cal = await stored(page);
  eq(cal.dayTypes.find((x) => x.id === 'halfday').pace, 'skip', 'unticking it stores pace: "skip" on the type');
  eq(active(cal).units[1].end, SCHOOL[20], 'and unit 2 ends a school day later');
  ok(/Unit 2 now ends/.test(await notice(page)), 'the bar says Unit 2 moved');
  const sel = '#coursePace select[aria-label="Pace: Half Day / Early Dismissal"]';
  ok(await page.isVisible(sel), 'the course lists the type with its own choice');
  await page.selectOption(sel, 'count');
  await settle(page, 300);
  cal = await stored(page);
  eq([active(cal).pace.halfday, active(cal).units[1].end], ['count', SCHOOL[19]], 'the course\'s own "Counts" puts the day back for this course');
  await page.selectOption(sel, '');
  await settle(page, 300);
  await page.click('.legend-row:has(input[value*="Half Day"]) input[data-f=pace]');
  await settle(page, 300);
  cal = await stored(page);
  eq([cal.dayTypes.find((x) => x.id === 'halfday').pace, active(cal).pace], [undefined, {}], 'ticking it again and "As the day type" leave no field behind');
}

/* ═══ 6. the drawer on a typed unit's day ═══ */
{
  await openDay(page, SCHOOL[12]);
  ok(/Unit 2 — class day 3 of 10/.test(await page.textContent('#drawerPacing')), 'the drawer says which day of the unit it is');
  await page.click('#drawerUnitDay');
  await settle(page, 300);
  let c = active(await stored(page));
  eq([c.units[1].days, c.units[1].end], [11, SCHOOL[20]], '"This unit needs another day" adds a class day to it');
  await openDay(page, SCHOOL[12]);
  page.__answers.push('Assembly');
  await page.click('#drawerLost');
  await settle(page, 300);
  c = active(await stored(page));
  eq([c.lost.map((x) => [x.date, x.reason]), c.units[1].end], [[[SCHOOL[12], 'Assembly']], SCHOOL[21]], '"This class didn\'t meet" takes the date away and the unit ends a day later');
  ok(await page.evaluate((d) => !!document.querySelector(`#months .day[data-date="${d}"] .unit-bar`), SCHOOL[3]), 'a typed course\'s units are drawn as bands');
}

/* ═══ 7. overlap refused, and the scan ═══ */
{
  const over = [{ ...DATED[1] }, { ...DATED[0], start: '2026-09-28' }];
  await putRaw(page, JSON.stringify(datedBlob(over)));
  await open(page);
  await page.click('#btnConvertUnits');
  await settle(page, 200);
  ok(await page.isDisabled('#convertApply'), 'two overlapping units cannot be converted');
  ok(/“Fractions” and “Ratios” overlap/.test(await page.textContent('#convertBox')), 'and the preview names both');
  await page.uncheck('#convertBox input[aria-label="Include Ratios"]');
  await settle(page, 200);
  ok(await page.isEnabled('#convertApply'), 'unticking one lets the other through');
  const v = await a11yScan(page, { include: ['.pacing-card', '#unitsCard'] });
  eq(v.map((x) => x.id), [], 'the Courses and Dated units cards have no serious or critical axe finding');
}
eq(page.__errs, [], 'the page threw nothing');
await page.context().close();

/* ═══ 8. deliberate breaks: each altered module must fail the scenario ═══ */
const BREAKS = [
  ['pins ignored', { 'scv-plan.js': (s) => s.replace('    if (u && typeof u.pin === "string"', '    if (false && u && typeof u.pin === "string"') }],
  ['open days not counted', { 'scv-plan.js': (s) => s.replace('if (j > i) st.open += j - i;', '') }],
  ['conversion counts weekdays', { 'scv-plan.js': (s) => s.replace('unitInstructionalStats(from, to, cal.days, cal.dayTypes).instructionalDays', 'unitInstructionalStats(from, to, cal.days, cal.dayTypes).weekdays') }],
  ['conversion unsorted', { 'scv-plan.js': (s) => s.replace('  ranged.sort((x, y) => (x.u.start < y.u.start ? -1 : x.u.start > y.u.start ? 1 : 0));\n', '') }],
];
let caught = 0;
for (const [name, routes] of BREAKS) {
  const p = await freshPage(routes);
  quiet = true; breakFails = 0;
  try { await scenario(p, name); } catch (e) { breakFails++; }
  quiet = false;
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
  await p.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
