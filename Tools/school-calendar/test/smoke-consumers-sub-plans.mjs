// smoke-consumers-sub-plans.mjs — the last readers of 032's school-year spine (Path 9
// P3): 044 Sub Plan Builder and 045 Sub Binder Generator, each reading 032's calendar
// through _shared/school-day.js and never writing it.
//
//   node Tools/school-calendar/test/smoke-consumers-sub-plans.mjs
//   (or: npm run test:school-day-sub-plans)
//
// What is held. The plan in the calendar is placed and stamped here by 032's own module
// (scv-plan.js), so which lesson is on which date comes from 032, not from
// school-day.js. 044: with no calendar there is no "From the School Calendar" box and the
// title starts empty (the page is what it was). With one course, the day out is put in
// 032's words, its paced lesson is listed and is the title of a day new to the page; a
// second day out gets its own lesson; a day the teacher has been on keeps what they left,
// an emptied title included. The day itself, or the school day after it, being the last
// school day of a quarter is said (the seed's second quarter ends on a workday, so its
// deadline is the school day before); a closed day says so and lists nothing. With two
// courses each is named, nothing is filled in, and "Use as title" fills it. A calendar
// another tab saves brings the box in. 045: with no calendar its Today card is what it
// was; with two courses it names the day, lists each course's lesson or unit day and a
// lost day, says the deadlines, prints the same on the packet, and the section list says
// the pacing plan is there. Neither page writes scv_calendar_v1, and axe finds nothing
// serious in the new parts. Then the deliberate breaks: a page or school-day.js is
// altered on the wire, and each must fail.
//
// The clock is pinned per page (local time, the zone the run is in); a date in words is
// made by the page's own formatter, read back in the browser, so the locale is not under
// test. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay, parseLessonList } from '../scv-pacing.js';
import { newCourse, newUnit, placePlan, stamp, syncUnits } from '../scv-plan.js';

const PORT = 8548;
const BASE = `http://127.0.0.1:${PORT}`;
const SPB = BASE + '/Tools/044-Sub%20Plan%20Builder.html';
const BIND = BASE + '/Tools/045-sub-binder-generator.html';
const KEY = 'scv_calendar_v1';

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

/* ── the calendar and its plan, placed by 032's own module ── */
const SEED = seedCalendar2026();
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
const SCHOOL = [];
for (let d = SEED.meta.start; d <= SEED.meta.end; d = addDays(d, 1)) if (isTeachableDay(d, SEED.days, SEED.dayTypes)) SCHOOL.push(d);
const LETTER = Object.fromEntries(SCHOOL.map((d, i) => [d, i % 2 ? 'B' : 'A']));
const CLOSED = '2026-09-07';
const MP = Object.keys(SEED.days).filter((d) => (SEED.days[d].types || []).includes('mpend')).sort();
if (SEED.days[CLOSED]?.label !== 'Labor Day' || SCHOOL.includes(CLOSED) || SCHOOL.includes('2027-01-22')
  || JSON.stringify(MP) !== JSON.stringify(['2026-11-04', '2027-01-22', '2027-04-07'])) {
  console.log('FAIL the seed is not the one this suite was written against'); process.exit(1);
}

const LESSONS = parseLessonList(Array.from({ length: 60 }, (_, i) =>
  `U${1 + Math.floor(i / 15)}-${String(i % 15 + 1).padStart(2, '0')}-${i % 2 ? 'B' : 'A'}-Lesson ${i + 1}`).join('\n')).lessons;
const LOST = '2026-09-24';
function plan(two) {
  const cal = seedCalendar2026();
  cal.abCycle = { enabled: true, anchorDate: SCHOOL[0], anchorLetter: 'A' };
  const civ = syncUnits(Object.assign(newCourse('Civics', { id: 'c_civ' }), {
    lessons: JSON.parse(JSON.stringify(LESSONS)),
    lost: two ? [{ id: 'lost_1', date: LOST, reason: 'Assembly' }] : [],
  }));
  const lab = Object.assign(newCourse('Lab', { id: 'c_lab' }), { units: [newUnit('Cells', 20, { id: 'u_1' }), newUnit('Energy', 25, { id: 'u_2' })] });
  cal.plan = { v: 1, active: 'c_civ', algo: 1, courses: two ? [civ, lab] : [civ] };
  const placed = placePlan(cal);
  return { cal: stamp(cal, placed), placed };
}
const ONE = plan(false), TWO = plan(true);
const code = (l) => `U${l.unit}-${l.num}-${l.letter}`;
const words = (l) => `${code(l)} ${l.title}`;
const dateOf = (p, i) => p.placed.c_civ.dateByLessonId[LESSONS[i].id];
const D1 = dateOf(ONE, 5), D2 = dateOf(ONE, 6);
if (!D1 || !D2 || addDays(D1, 1) !== D2 || SEED.days[D1] || SEED.days[D2]) {
  console.log(`FAIL the fixture's lesson dates are not consecutive school days (${D1}, ${D2})`); process.exit(1);
}
const T = TWO.placed;
const TD = T.c_civ.dateByLessonId[LESSONS[10].id];
if (SEED.days[TD]) { console.log('FAIL the two-course day is tagged'); process.exit(1); }
const labSlot = T.c_lab.slots[TD];
if (!labSlot || labSlot.kind !== 'day' || T.c_civ.slots[LOST]) { console.log('FAIL the two-course fixture does not overlap as expected'); process.exit(1); }
const LAB_WORDS = `Cells, day ${labSlot.n} of ${labSlot.of}`;
const labOnLost = T.c_lab.slots[LOST];

const at = (date, hm) => new Date(`${date}T${hm}:00`);

const server = await serve(PORT);
const browser = await launch();

let edits = {};
async function openAt(url, when, store) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(when);
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
  for (const [pat, fn] of Object.entries(edits)) {
    await page.route(pat, async (route) => {
      const res = await route.fetch();
      route.fulfill({ response: res, body: fn(await res.text()), headers: { ...res.headers() } });
    });
  }
  await page.goto(BASE + '/index.html');
  await page.evaluate((kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, store || {});
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const raw = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
const done = async (page, label, stored) => {
  eq(await raw(page, KEY), stored === undefined ? null : stored, `${label}: scv_calendar_v1 is not written`);
  eq(page.__errs, [], `${label}: no page error`);
  await page.context().close();
};
const shortDay = (page, iso) => page.evaluate((d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), iso);
const longDay = (page, iso) => page.evaluate((d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }), iso);

/* ── 044 ── */
const info = (p) => p.evaluate(() => {
  const b = document.getElementById('calInfo');
  return b.hidden ? null : Array.from(b.querySelectorAll('p, li')).map((e) => e.firstChild ? e.firstChild.textContent : '');
});
const title = (p) => p.inputValue('#lessonTitle');
async function setPlanDate(p, iso) {
  await p.fill('#planDate', iso);
  await p.dispatchEvent('#planDate', 'change');
  await settle(p, 100);
}
async function day(p, iso) { await p.click(`#dayTabs button[data-day="${iso}"]`); await settle(p, 100); }

async function scenario() {
  /* ═══ 044 Sub Plan Builder ═══ */
  {
    const p = await openAt(SPB, at(D1, '07:00'));
    eq(await info(p), null, '044 with no calendar has no School Calendar box');
    eq(await title(p), '', '...and the title starts empty');
    await done(p, '044 no calendar');
  }
  const one = JSON.stringify(ONE.cal);
  {
    const p = await openAt(SPB, at(D1, '07:00'), { [KEY]: one });
    const l5 = LESSONS[5], l6 = LESSONS[6];
    eq(await info(p), [`From the School Calendar, ${await longDay(p, D1)}: ${LETTER[D1]} day.`, 'From the pacing plan:', words(l5)],
      '044 says the day out in 032\'s words and lists its paced lesson');
    eq(await title(p), words(l5), '...which is the title of a day new to the page');
    await p.fill('#numDays', '2');
    await p.dispatchEvent('#numDays', 'input');
    await settle(p, 100);
    eq(await title(p), words(l5), 'a second day out leaves the first day\'s title');
    await p.fill('#lessonTitle', '');
    await day(p, D2);
    eq(await title(p), words(l6), 'the second day gets its own lesson');
    eq((await info(p) || []).slice(-1), [words(l6)], '...and the box follows the day shown');
    await day(p, D1);
    eq(await title(p), '', 'a day the teacher emptied stays empty');
    await setPlanDate(p, '2026-11-03');
    ok((await info(p) || []).includes(`Grading deadline: the next school day, ${await shortDay(p, '2026-11-04')}, is the last school day of Quarter 1.`),
      '044 says the next school day ends Quarter 1');
    await setPlanDate(p, '2026-11-04');
    ok((await info(p) || []).includes('Grading deadline: this is the last school day of Quarter 1.'), '044 says the day out ends Quarter 1');
    ok(!(await info(p) || []).some((t) => /next school day/.test(t)), '...and not the day after it');
    await setPlanDate(p, '2027-01-21');
    ok((await info(p) || []).includes('Grading deadline: this is the last school day of Quarter 2.'),
      '044: a quarter that ends on a workday has its deadline on the school day before');
    await setPlanDate(p, '2027-01-25');
    ok(!(await info(p) || []).some((t) => /Grading deadline/.test(t)), '...and the school day after the workday is none');
    await p.fill('#numDays', '1');
    await p.dispatchEvent('#numDays', 'input');
    await setPlanDate(p, CLOSED);
    eq(await info(p), [`From the School Calendar, ${await longDay(p, CLOSED)}: No school: Labor Day.`], '044: a closed day says so and lists nothing');
    eq(await title(p), '', '...and fills in nothing');
    await done(p, '044 one course', one);
  }
  const two = JSON.stringify(TWO.cal);
  {
    const p = await openAt(SPB, at(TD, '07:00'), { [KEY]: two });
    const l = LESSONS[10];
    eq((await info(p) || []).slice(1), ['From the pacing plan:', `Civics: ${words(l)}`, `Lab: ${LAB_WORDS}`], '044 names each course');
    eq(await title(p), '', '...and fills in nothing when there are two');
    eq(await p.$$eval('#calInfo button', (bs) => bs.map((b) => b.textContent)), ['Use as title'], 'only a lesson has a "Use as title" button');
    await p.click('#calInfo button');
    eq(await title(p), words(l), '"Use as title" fills the title');
    const v = await a11yScan(p, { include: ['#calInfo'] });
    eq(v.map((x) => x.id), [], '044\'s School Calendar box: no serious axe violation');
    await done(p, '044 two courses', two);
  }
  {
    const p = await openAt(SPB, at(D1, '07:00'));
    const other = await p.context().newPage();
    await other.goto(BASE + '/index.html');
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, one]);
    await settle(p, 300);
    eq((await info(p) || []).slice(-1), [words(LESSONS[5])], '044 picks up a calendar another tab saved');
    await other.close();
    await done(p, '044 another tab', one);
  }

  /* ═══ 045 Sub Binder Generator ═══ */
  const card = (p) => p.evaluate(() => document.getElementById('todayCalBody').innerText.trim());
  async function setBundle(p, iso) {
    await p.fill('#bundleDate', iso);
    await p.dispatchEvent('#bundleDate', 'change');
    await settle(p, 100);
  }
  {
    const p = await openAt(BIND, at(TD, '07:00'));
    ok(/^No school calendar saved yet\./.test(await card(p)), '045 with no calendar is what it was');
    await done(p, '045 no calendar');
  }
  {
    const p = await openAt(BIND, at(TD, '07:00'), { [KEY]: two });
    await setBundle(p, TD);
    const c = await card(p);
    ok(c.startsWith(`${LETTER[TD]} day`), '045 names the day');
    ok(c.includes(`Civics: ${words(LESSONS[10])}`) && c.includes(`Lab: ${LAB_WORDS}`), '045 lists each course\'s lesson or unit day');
    ok(!/Nothing tagged/.test(c), '...and no "nothing tagged" hint beside them');
    ok(/with the pacing plan/.test(await p.$eval('#sectionChecklist', (e) => e.textContent)), 'the section list says the pacing plan is there');
    await p.evaluate(() => { window.print = () => {}; });
    await p.click('#printBtn');
    await settle(p, 100);
    ok((await p.$eval('#printArea', (e) => e.textContent)).includes(`Lab: ${LAB_WORDS}`), '045 prints the pacing plan on the packet');
    await setBundle(p, LOST);
    const lost = await card(p);
    ok(lost.includes('Civics: Does not meet: Assembly'), '045 says a course did not meet');
    eq(lost.includes('Lab: '), !!labOnLost, '...for that course only');
    await setBundle(p, '2026-11-04');
    ok((await card(p)).includes('Grading deadline: this is the last school day of Quarter 1.'), '045 says the day ends Quarter 1');
    await setBundle(p, '2026-11-03');
    ok((await card(p)).includes(`Grading deadline: the next school day, ${await shortDay(p, '2026-11-04')}, is the last school day of Quarter 1.`),
      '045 says the next school day ends Quarter 1');
    const v = await a11yScan(p, { include: ['#todayCalBody'] });
    eq(v.map((x) => x.id), [], '045\'s Today card: no serious axe violation');
    await done(p, '045 two courses', two);
  }
  {
    const p = await openAt(BIND, at(D1, '07:00'), { [KEY]: one });
    await setBundle(p, D1);
    const c = await card(p);
    ok(c.includes(words(LESSONS[5])) && !c.includes('Civics:'), '045 with one course leaves its name out');
    await done(p, '045 one course', one);
  }
}

console.log('Path 9 P3: 044 and 045 read the school-year spine');
await scenario();

/* ═══ deliberate breaks: each altered file must fail the scenario ═══ */
const A = '**/044-Sub%20Plan%20Builder.html', B = '**/045-sub-binder-generator.html', S = '**/_shared/school-day.js';
const BREAKS = [
  ['044: every day filled in', { [A]: (s) => s.replace('if (fresh) suggestTitle(dateStr);', 'suggestTitle(dateStr);') }],
  ['044: filled in beside another course', { [A]: (s) => s.replace("if (items.length === 1 && items[0].kind === 'lesson')", "if (items.some((x) => x.kind === 'lesson'))").replace('SchoolDay.describeLesson(items[0])', "SchoolDay.describeLesson(items.find((x) => x.kind === 'lesson'))") }],
  ['044: the next day\'s deadline dropped', { [A]: (s) => s.replace('if (g2) box.appendChild(', 'if (false) box.appendChild(') }],
  ['044: courses not named', { [A]: (s) => s.replace("li.textContent = (many ? it.course + ': ' : '') + words;", 'li.textContent = words;') }],
  ['044: another tab ignored', { [A]: (s) => s.replace("if (e.key === null || (window.SchoolDay && e.key === SchoolDay.KEY)) renderCalendarInfo();", '') }],
  ['045: the plan not read', { [B]: (s) => s.replace('return calCache ? SchoolDay.lessonsOn(calCache, dateStr) : [];', 'return [];') }],
  ['045: the day\'s own deadline dropped', { [B]: (s) => s.replace('if (g) out.push({ date: dateStr, period: g, next: false });', '') }],
  ['045: course named with one course', { [B]: (s) => s.replace('calCache.plan.courses.length > 1;', 'calCache.plan.courses.length > 0;') }],
  ['school-day: deadline on the tag', { [S]: (s) => s.replace('      if (isSchoolDay(cal, msToIso(ms))) return null;\n    }\n    return gp;', '    }\n    return gp.end === iso ? gp : null;') }],
  ['school-day: lost days unread', { [S]: (s) => s.replace("if (isObj(x) && x.date === iso) push({ kind: 'lost'", "if (false) push({ kind: 'lost'") }],
];
let caught = 0;
for (const [name, e] of BREAKS) {
  edits = e;
  quiet = true; breakFails = 0;
  try { await scenario(); } catch (err) { breakFails++; }
  quiet = false;
  for (const c of browser.contexts()) await c.close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}
edits = {};

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
