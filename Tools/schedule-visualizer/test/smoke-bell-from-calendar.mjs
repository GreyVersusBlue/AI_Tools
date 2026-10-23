// smoke-bell-from-calendar.mjs — 035 reads 032's bell schedules (Path 9 P1, rank 12).
//
//   node Tools/schedule-visualizer/test/smoke-bell-from-calendar.mjs
//   (or: npm run test:layout-bell-from-calendar)
//
// 032 School Calendar Visualizer owns the school's bell schedules (Devon, 2026-10-21);
// 035's Settings tab has a "From the School Calendar" control under its own A/B bell
// editor, which copies the chosen schedules into that editor through
// SchoolDay.forScheduleVisualizer(). What is held here: with no calendar, or a calendar
// with no schedules, it says so and offers nothing; with schedules, the A and B choices
// default to 032's A-day and B-day schedules; "Use these times" fills the editor by
// position and stores nothing until Save Settings; replacing times already typed asks
// first, and a "no" changes nothing; B "Same as A Day" gives 035's B null; periods past
// the mod count are counted; 032's blob is never written; and the control has no serious
// axe finding. Nothing here describes a real school. Exits 1 on any failure.

/* global switchTab, AppState -- 035's page globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { seedCalendar2026 } from '../../school-calendar/scv-seed.js';

const PORT = 8540;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const P = (label, start, end) => ({ label, start, end });
function calendar() {
  const cal = seedCalendar2026();
  cal.abCycle = { enabled: true, anchorDate: '2026-08-31', anchorLetter: 'A' };
  cal.bell = {
    v: 1,
    schedules: [
      { id: 'reg', name: 'Regular', periods: [P('P1', '07:30', '08:20'), P('P2', '08:25', '09:15'), P('P3', '09:20', '10:10')] },
      { id: 'aday', name: 'A day', periods: [P('B1', '07:30', '09:00'), P('B2', '09:05', '10:35')] },
      { id: 'bday', name: 'B day', periods: [P('B3', '07:45', '09:15'), P('B4', '09:20', '10:50')] },
      { id: 'long', name: 'Ten periods', periods: Array.from({ length: 10 }, (_, i) => P('P' + (i + 1), `${String(7 + i).padStart(2, '0')}:00`, `${String(7 + i).padStart(2, '0')}:45`)) },
    ],
    regular: 'reg', letters: { A: 'aday', B: 'bday' }, types: {},
  };
  return cal;
}

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });

const settings = () => page.evaluate(() => JSON.parse(localStorage.getItem('stviz_settings') || 'null'));
const live = () => page.evaluate(() => JSON.parse(JSON.stringify(AppState.settings.bellSchedule)));
const status = () => page.textContent('#bell-cal-status');
const controlsShown = () => page.isVisible('#bell-cal-controls');
const open = async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
  await page.evaluate(() => switchTab('settings'));
  await settle(page, 300);
};
const putCalendar = cal => page.evaluate(c => localStorage.setItem('scv_calendar_v1', c), cal === null ? null : JSON.stringify(cal));
const rowTimes = () => page.$$eval('#bell-schedule-table tr[data-bell-idx]', trs => trs.map(tr => [...tr.querySelectorAll('input[type=time]')].map(i => i.value)));

console.log('School Layout Visualizer: bell times from the School Calendar');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* 1. no calendar */
await page.evaluate(() => localStorage.removeItem('scv_calendar_v1'));
await open();
ok((await status()).includes('No School Calendar is saved'), 'no calendar: it says so');
ok(!(await controlsShown()), '...and offers nothing to choose');

/* 2. a calendar with no schedules */
await putCalendar(seedCalendar2026());
await open();
ok((await status()).includes('no bell schedules yet'), 'a calendar without schedules: it says so');
ok(!(await controlsShown()), '...and offers nothing');

/* 3. schedules: the defaults, then use */
const cal = calendar();
const calRaw = JSON.stringify(cal);
await putCalendar(cal);
await open();
ok(await controlsShown(), 'with schedules the choices are shown');
eq([await page.inputValue('#bell-cal-a'), await page.inputValue('#bell-cal-b')], ['aday', 'bday'], 'A and B default to 032\'s A-day and B-day schedules');
eq(await page.$$eval('#bell-cal-b option', os => os.map(o => o.textContent)),
  ['Same as A Day', 'Regular (3 periods)', 'A day (2 periods)', 'B day (2 periods)', 'Ten periods (10 periods)'], 'B offers "Same as A Day" and every schedule');
const before = await settings();
await page.click('#bell-cal-use');
await settle(page, 200);
const modCount = await page.evaluate(() => AppState.settings.modCount);
const want = (pairs) => Array.from({ length: modCount }, (_, i) => pairs[i] || ['', '']);
eq(await rowTimes(), want([['07:30', '09:00'], ['09:05', '10:35']]), 'the A rows show the A-day times, by position');
const bs = await live();
eq([bs.A.length, bs.A[0], bs.A[2], bs.B[1]], [modCount, { start: '07:30', end: '09:00' }, null, { start: '09:20', end: '10:50' }], 'the editor holds A and B in 035\'s own shape');
eq(await settings(), before, 'nothing is stored before Save Settings');
ok((await page.textContent('#bell-cal-result')).includes('Press Save Settings'), 'it says to press Save Settings');
await page.click('#btn-save-settings');
await settle(page, 200);
eq((await settings()).bellSchedule.B[0], { start: '07:45', end: '09:15' }, 'Save Settings keeps them');
eq(await page.evaluate(() => localStorage.getItem('scv_calendar_v1')), calRaw, '032\'s calendar is not written');

/* 4. replacing typed times asks first; "no" changes nothing */
await page.selectOption('#bell-cal-a', 'reg');
await page.selectOption('#bell-cal-b', '');
let asked = 0;
const no = d => { asked++; d.dismiss(); };
page.on('dialog', no);
await page.click('#bell-cal-use');
await settle(page, 200);
page.off('dialog', no);
eq([asked, (await live()).A[0]], [1, { start: '07:30', end: '09:00' }], 'times already there: it asks, and No keeps them');
const yes = d => { asked++; d.accept(); };
page.on('dialog', yes);
await page.click('#bell-cal-use');
await settle(page, 200);
page.off('dialog', yes);
const bs2 = await live();
eq([bs2.A[2], bs2.B], [{ start: '09:20', end: '10:10' }, null], 'Yes: Regular on A, and B "Same as A Day" is null');
ok((await page.textContent('#bell-cal-result')).includes('same as A Day'), '...and it says so');

/* 5. more periods than mods */
await page.evaluate(() => switchTab('settings'));
await page.selectOption('#bell-cal-a', 'long');
page.on('dialog', yes);
await page.click('#bell-cal-use');
await settle(page, 200);
page.off('dialog', yes);
const extra = 10 - modCount;
if (extra > 0) ok((await page.textContent('#bell-cal-result')).includes(`${extra} ${extra === 1 ? 'period' : 'periods'} past ${modCount} were left out`), 'periods past the mod count are counted');
eq((await live()).A.length, modCount, '...and the rows stop at the mod count');
eq(await page.inputValue('#bell-cal-a'), 'long', 'the choice survives a redraw');

/* 6. a newer bell field is not read */
await putCalendar(Object.assign(seedCalendar2026(), { bell: { v: 2, schedules: [] } }));
await open();
ok((await status()).includes('newer version'), 'a newer bell field: it says reload');
ok(!(await controlsShown()), '...and offers nothing');

/* 7. accessibility and noise */
await putCalendar(cal);
await open();
const v = await a11yScan(page, { include: '#bell-from-calendar' });
eq(v.map(x => x.id), [], 'the control has no serious axe finding');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
