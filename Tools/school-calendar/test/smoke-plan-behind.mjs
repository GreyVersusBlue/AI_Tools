// smoke-plan-behind.mjs — 032's "behind" line and "Make this the plan", in the page (Path 9
// P2, increment 3). scv-plan.js's setBaseline() and slip() are held by plan.test.mjs; this
// holds what the page does with them.
//
//   node Tools/school-calendar/test/smoke-plan-behind.mjs   (or: npm run test:school-calendar-plan-behind)
//
// What is held: a course distributed before the year starts gets a baseline dated that day,
// and keeps being re-based while it is still planning; on a later day the stored plan is
// held, the line says the course is on the plan, a snow day before today makes it one class
// day behind with the lesson, its two dates and the lost day named (and the line marked),
// Undo puts it back, a snow day after today leaves it on the plan and does not move the
// baseline, "needs another day" on a past lesson is a day behind with the bump named, and
// "Make this the plan" re-bases it to today with Undo; a course saved before v311 has no
// baseline and says so until its next change; a second course with nothing planned gets no
// line; the card has no serious axe finding. Then the deliberate breaks: the scenario is run
// against a page whose scv-plan.js is altered on the wire, and each must fail.
//
// The clock is pinned (2026-08-20 10:00 local while planning, then the first school day on
// or after 2026-10-01 at 10:00); every expected date is read off the seeded 2026-27
// calendar with scv-pacing.js's isTeachableDay, not with the module under test. Nothing
// here describes a real class. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../scv-seed.js';
import { isTeachableDay } from '../scv-pacing.js';

const PORT = 8543;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';

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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (iso) => MONTHS[+iso.slice(5, 7) - 1] + ' ' + (+iso.slice(8, 10));
const T = SCHOOL.findIndex((d) => d >= '2026-10-01');
const TODAY = SCHOOL[T];
const PLANNING = new Date('2026-08-20T10:00:00');
const LATER = new Date(TODAY + 'T10:00:00');

const CODES = [];
for (let i = 0; i < 60; i++) CODES.push(`U${1 + Math.floor(i / 20)}-${String(i % 20 + 1).padStart(2, '0')}-${i % 2 ? 'B' : 'A'}-Lesson ${i + 1}`);
const code = (n) => CODES[n - 1].split('-').slice(0, 3).join('-'); // lesson n, 1-based
const raw1 = (n) => CODES[n - 1];

const server = await serve(PORT);
const browser = await launch();

async function freshPage(now, routes = {}) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.clock.setFixedTime(now);
  page.__answers = [];
  page.__errs = [];
  page.on('pageerror', (e) => page.__errs.push(String(e)));
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
const lines = (page) => page.$$eval('#courseSlipList li', (els) => els.map((e) => e.textContent.trim()));
const behindMarked = (page) => page.$$eval('#courseSlipList li.slip-behind', (els) => els.length);
const course1 = (cal) => cal.plan.courses[0];

/** The scenario every break re-runs. Returns the bytes saved while planning. */
async function scenario(label, routes = {}) {
  // planning, before the year
  const a = await freshPage(PLANNING, routes);
  await a.goto(BASE + '/index.html');
  await putRaw(a, null);
  await open(a);
  ok(!(await a.isVisible('#courseSlip')), `${label}: with nothing planned there is no behind line`);
  await a.fill('#paceInput', CODES.join('\n'));
  await a.click('#btnPaceDistribute');
  await settle(a, 300);
  let cal = await stored(a);
  const b0 = course1(cal).baseline;
  eq(b0 && [b0.setOn, b0.start, b0.seq.length, b0.seq[0]], ['2026-08-20', SEED.meta.start, 60, code(1)], `${label}: distributing sets the baseline, dated today, with every lesson's code`);
  eq(await lines(a), ['Course 1: on the plan of Aug 20; nothing was planned before today.'], `${label}: the line says nothing was planned before today`);
  // still planning: a change re-bases it
  await openDay(a, SCHOOL[10]);
  a.__answers.push('Snow Day');
  await a.click('#drawerSnow');
  await settle(a, 300);
  cal = await stored(a);
  const mask0 = b0 && b0.mask, mask1 = course1(cal).baseline.mask;
  ok(mask0 !== mask1 && course1(cal).baseline.setOn === '2026-08-20', `${label}: a change while still planning moves the baseline with it`);
  await a.click('#planUndo');
  await settle(a, 300);
  const planned = await raw(a);
  eq(a.__errs, [], `${label}: the planning page threw nothing`);
  await a.context().close();

  // a later day
  const p = await freshPage(LATER, routes);
  await p.goto(BASE + '/index.html');
  await putRaw(p, planned);
  await open(p);
  eq(await lines(p), ['Course 1: on the plan of Aug 20.'], `${label}: on a later day an unchanged course is on the plan`);
  ok(await p.isVisible('#btnMakePlan'), `${label}: "Make this the plan" is offered`);
  // a snow day before today
  await openDay(p, SCHOOL[10]);
  p.__answers.push('Snow Day');
  await p.click('#drawerSnow');
  await settle(p, 300);
  cal = await stored(p);
  eq(course1(cal).baseline.setOn, '2026-08-20', `${label}: after the first class day a change does not move the baseline`);
  const want = `Course 1: 1 class day behind the plan of Aug 20. ${raw1(T + 1)} was planned for today and is now ${short(SCHOOL[T + 1])}. Lost: ${short(SCHOOL[10])} (`;
  const l1 = (await lines(p))[0] || '';
  ok(l1.startsWith(want), `${label}: a snow day before today is one class day behind, with the lesson, its dates and the lost day (${l1})`);
  eq(await behindMarked(p), 1, `${label}: and the line is marked`);
  await p.click('#planUndo');
  await settle(p, 300);
  eq(await lines(p), ['Course 1: on the plan of Aug 20.'], `${label}: Undo puts it back on the plan`);
  // a snow day after today
  await openDay(p, SCHOOL[T + 5]);
  p.__answers.push('Snow Day');
  await p.click('#drawerSnow');
  await settle(p, 300);
  eq(await lines(p), ['Course 1: on the plan of Aug 20.'], `${label}: a snow day after today leaves it on the plan today`);
  await p.click('#planUndo');
  await settle(p, 300);
  // a past lesson needs another day
  await openDay(p, SCHOOL[20]);
  p.__answers.push('Ran long');
  await p.click('#drawerBump');
  await settle(p, 300);
  const l2 = (await lines(p))[0] || '';
  ok(l2.startsWith('Course 1: 1 class day behind the plan of Aug 20.') && l2.endsWith(`Added: one day for ${code(21)} (Ran long).`), `${label}: a past lesson that needed another day is one behind, the bump named (${l2})`);
  // make this the plan
  const beforeMake = await raw(p);
  await p.click('#btnMakePlan');
  await settle(p, 300);
  cal = await stored(p);
  eq([course1(cal).baseline.setOn, await lines(p)], [TODAY, [`Course 1: on the plan of ${short(TODAY)}.`]], `${label}: "Make this the plan" re-bases the course to today`);
  ok((await notice(p)).includes('the dates shown are now the plan'), `${label}: and the bar says so`);
  await p.click('#planUndo');
  await settle(p, 300);
  ok((await raw(p)) === beforeMake, `${label}: Undo writes the old plan back exactly`);
  eq(p.__errs, [], `${label}: the page threw nothing`);
  return { page: p, planned };
}

console.log('School Calendar Visualizer: the behind line and "Make this the plan" (Path 9 P2 increment 3)');

const { page, planned } = await scenario('page');

/* ═══ a course saved before v311, and a second course ═══ */
{
  const old = JSON.parse(planned);
  delete old.plan.courses[0].baseline;
  await putRaw(page, JSON.stringify(old));
  await open(page);
  eq(await lines(page), ['Course 1: no plan to measure against yet. It is set at your next change, or press Make this the plan.'], 'a course saved before v311 says it has no plan to measure against yet');
  eq(await raw(page), JSON.stringify(old), 'and loading it writes nothing');
  page.__answers.push('Second');
  await page.click('#btnCourseAdd');
  await settle(page, 300);
  const cal = await stored(page);
  eq([cal.plan.courses.length, !!cal.plan.courses[0].baseline, cal.plan.courses[1].baseline], [2, true, null], 'the next change sets the old course\'s baseline, and an empty course gets none');
  eq((await lines(page)).length, 1, 'a course with nothing planned has no line');
  ok(!(await page.isVisible('#btnMakePlan')), 'and no "Make this the plan" while it is the one shown');
  await page.click('#courseTabs button >> nth=0');
  await settle(page, 300);
  eq(await page.textContent('#btnMakePlan'), 'Make this the plan for Course 1', 'with two courses the button names the one shown');
  const v = await a11yScan(page, { include: ['.pacing-card'] });
  eq(v.map((x) => x.id), [], 'the Courses card has no serious or critical axe finding');
  eq(page.__errs, [], 'the page threw nothing');
}
await page.context().close();

/* ═══ deliberate breaks: each altered module must fail the scenario ═══ */
const BREAKS = [
  ['baseline reset at every save', { 'scv-plan.js': (s) => s.replace('return !!(first && todayISO && todayISO < first);', 'return true;') }],
  ['baseline undated', { 'scv-plan.js': (s) => s.replace('setOn: todayISO || null,', 'setOn: null,') }],
  ['lost days not in the ledger', { 'scv-plan.js': (s) => s.replace('if (d <= todayISO && !nowSet.has(d)) add("lost"', 'if (false) add("lost"') }],
  ['bumps not named', { 'scv-plan.js': (s) => s.replace('if (key[0] === "G") item.lesson = gapLesson(key, c);', '') }],
];
let caught = 0;
for (const [name, routes] of BREAKS) {
  quiet = true; breakFails = 0;
  let r = null;
  try { r = await scenario(name, routes); } catch (e) { breakFails++; }
  quiet = false;
  if (r) await r.page.context().close().catch(() => {});
  if (breakFails) caught++; else { failed++; fails.push('break not caught: ' + name); console.log('  FAIL break not caught: ' + name); }
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed; ${caught}/${BREAKS.length} deliberate breaks caught`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
