// smoke-bell.mjs — the School Calendar Visualizer's bell schedules card (Path 9 P1).
//
//   node Tools/school-calendar/test/smoke-bell.mjs   (or: npm run test:school-calendar-bell)
//
// The card writes one optional field, `cal.bell`, which _shared/school-day.js reads. What is
// held here: a calendar nobody has touched gets no field; adding, typing and assigning write
// what the module resolves (the day editor shows the times a date gets, a half day its own); a
// half-typed period is kept and marked unused; the A/B rows appear with the cycle; removing a
// day type drops its assignment; 035's times import beside what is there; a field the page
// cannot read is kept in `bellBroken`; one from a later version is never edited; `__v` stays 2,
// so a page from an older cache still reads the blob; and the card has no serious axe finding.
//
// The clock is pinned, so the year grid's "today" is fixed. Nothing here describes a real school.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { isValid } from '../scv-store.js';

const PORT = 8539;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/032-School%20Calendar%20Visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await page.clock.setFixedTime(new Date('2026-09-15T10:00:00'));

const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('scv_calendar_v1') || 'null'));
const rawStored = () => page.evaluate(() => localStorage.getItem('scv_calendar_v1'));
const resolve = (date, time) => page.evaluate(([d, t]) => {
  const cal = JSON.parse(localStorage.getItem('scv_calendar_v1'));
  const r = SchoolDay.periodAt(cal, d, t);
  return { schedule: r.day.schedule && r.day.schedule.name, source: r.day.source, state: r.state, period: r.period && r.period.label };
}, [date, time]);
const reload = async () => { await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400); };
const setTime = async (sel, v) => { await page.fill(sel, v); await page.locator(sel).dispatchEvent('change'); };
const openDay = async (date) => { await page.click(`#months .day[data-date="${date}"]`); await settle(page, 200); };
const drawerBell = () => page.textContent('#drawerBell');

console.log('School Calendar Visualizer: bell schedules');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

/* 1. untouched */
ok(await page.isVisible('.bell-card'), 'the Bell Schedules card is shown');
ok((await page.textContent('#bellList')).includes('No bell schedules yet'), 'it says there are none');
ok((await page.textContent('#bellAssign')).includes('Add a bell schedule first'), 'and has nothing to assign');
ok(!(await stored()) || (await stored()).bell === undefined, 'loading writes no bell field');

/* 2. add, type, assign */
await page.click('#btnAddBell');
await settle(page, 200);
let cal = await stored();
eq([cal.__v, cal.bell.v, cal.bell.schedules.length], [2, 1, 1], 'Add writes bell v1 with one schedule, __v still 2');
eq(cal.bell.regular, cal.bell.schedules[0].id, 'the first schedule becomes the ordinary day\'s');
eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Name of bell schedule 1', 'focus goes to its name');
await page.fill('#bellList fieldset[data-bell="0"] .bell-head input', 'Regular');
await page.locator('#bellList fieldset[data-bell="0"] .bell-head input').dispatchEvent('change');
const row = n => `#bellList fieldset[data-bell="0"] tbody tr:nth-child(${n})`;
ok((await page.textContent(row(1))).includes('Not used until both times are set'), 'a new period with no times is marked unused');
await setTime(`${row(1)} input[type=time] >> nth=0`, '07:30');
await setTime(`${row(1)} input[type=time] >> nth=1`, '08:20');
eq((await page.textContent(`${row(1)} .bell-warn`)).trim(), '', 'with both times it is used');
await page.click('#bellList fieldset[data-bell="0"] [data-bell-add]');
await settle(page, 200);
eq(await page.inputValue(`${row(2)} input[type=time] >> nth=0`), '08:25', 'a new period starts five minutes after the last');
eq(await page.inputValue(`${row(2)} input[type=time] >> nth=1`), '09:15', '...and runs fifty minutes');
eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Name of period 2 in Regular', 'focus goes to the new period');
await page.click('#bellList fieldset[data-bell="0"] [data-bell-add]');
await settle(page, 200);
await setTime(`${row(3)} input[type=time] >> nth=1`, '09:00');
ok((await page.textContent(`${row(3)} .bell-warn`)).includes('ends before it starts'), 'a period that ends before it starts is marked');
eq(await resolve('2026-09-01', '08:30'), { schedule: 'Regular', source: 'regular', state: 'in', period: 'Period 2' }, 'the module reads what was typed');
eq(await resolve('2026-09-01', '09:30'), { schedule: 'Regular', source: 'regular', state: 'after', period: null }, 'the unused period is not a period');
eq((await stored()).bell.schedules[0].periods.length, 3, 'but it is kept as typed');

await page.click('#btnAddBell');
await settle(page, 200);
await page.fill('#bellList fieldset[data-bell="1"] .bell-head input', 'Early dismissal');
await page.locator('#bellList fieldset[data-bell="1"] .bell-head input').dispatchEvent('change');
await setTime('#bellList fieldset[data-bell="1"] tbody tr:nth-child(1) input[type=time] >> nth=0', '07:30');
await setTime('#bellList fieldset[data-bell="1"] tbody tr:nth-child(1) input[type=time] >> nth=1', '08:00');
cal = await stored();
eq(cal.bell.regular, cal.bell.schedules[0].id, 'a second schedule does not take the ordinary day');
const halfSel = '#bellAssign-type-halfday';
ok(await page.isVisible(halfSel), 'the half-day type has its own row');
ok(!(await page.$('#bellAssign-type-holiday')), 'a no-school type has none');
ok(!(await page.$('#bellAssign-letter-A')), 'no A/B rows while the cycle is off');
eq(await page.textContent('label[for="bellAssign-type-halfday"]'), 'A day tagged "Half Day / Early Dismissal"', 'the row is labelled');
await page.selectOption(halfSel, { label: 'Early dismissal' });
await settle(page, 100);
eq((await stored()).bell.types.halfday, cal.bell.schedules[1].id, 'assigning writes the type\'s schedule');

/* 3. the day editor */
await openDay('2026-09-18');
let t = await drawerBell();
ok(t.includes('Early dismissal, from its "Half Day / Early Dismissal" tag (early dismissal)'), 'a half day shows the early-dismissal schedule: ' + t);
ok(t.includes('Period 1: 07:30 to 08:00'), '...with its times');
await page.click('#drawerClose');
await openDay('2026-09-01');
t = await drawerBell();
ok(t.includes('Regular, from ordinary school day'), 'an ordinary day shows Regular: ' + t);
ok(t.includes('Period 2: 08:25 to 09:15') && !t.includes('09:00'), '...without the unused period');
await setTime(`${row(2)} input[type=time] >> nth=1`, '09:10');
ok((await drawerBell()).includes('Period 2: 08:25 to 09:10'), 'an edit shows in the open day editor');
await page.click('#drawerClose');
await openDay('2026-09-07');
eq((await drawerBell()).trim(), '', 'a closed day shows no schedule');
await page.click('#drawerClose');

/* 4. the A/B rows */
await page.check('#abEnable');
await page.fill('#abAnchorDate', '2026-08-31');
await page.click('#btnApplyAb');
await settle(page, 200);
ok(await page.isVisible('#bellAssign-letter-A') && await page.isVisible('#bellAssign-letter-B'), 'with the cycle on, A and B rows appear');
eq(await page.textContent('label[for="bellAssign-letter-B"]'), 'A B day', 'the B row is labelled');
await page.selectOption('#bellAssign-letter-B', { label: 'Early dismissal' });
eq((await resolve('2026-09-01', '07:45')).source, 'letter', 'a B day takes the B schedule');
eq((await resolve('2026-08-31', '07:45')).source, 'regular', 'an A day with no A schedule takes the ordinary one');
await page.selectOption('#bellAssign-letter-B', '');
eq((await stored()).bell.letters.B, null, 'choosing "The ordinary day\'s" clears it');

/* 5. it survives a reload, and an older page could still read the blob */
const before = await rawStored();
await reload();
eq(await rawStored(), before, 'a reload writes nothing');
eq(await page.inputValue('#bellList fieldset[data-bell="1"] .bell-head input'), 'Early dismissal', 'the schedules come back');
eq(await page.inputValue(halfSel), (await stored()).bell.types.halfday, 'and the assignments');
ok(isValid(await stored()), 'the saved blob passes scv-store.js isValid(), the check every older page makes');

/* 6. removing a day type drops its assignment */
page.once('dialog', d => d.accept());
const halfIdx = await page.evaluate(() => JSON.parse(localStorage.getItem('scv_calendar_v1')).dayTypes.findIndex(x => x.id === 'halfday'));
await page.click(`#legendList [data-act=del][data-i="${halfIdx}"]`);
await settle(page, 200);
eq((await stored()).bell.types.halfday, undefined, 'removing the half-day type removes its assignment');

/* 7. 035's times */
await page.evaluate(() => localStorage.setItem('stviz_settings', JSON.stringify({ modCount: 3, modLabel: 'block',
  bellSchedule: { A: [{ start: '08:00', end: '09:30' }, { start: '09:35', end: '11:00' }, { start: '11:05', end: '' }], B: [{ start: '08:00', end: '09:00' }, null, null] } })));
await page.click('#btnImportBell');
await settle(page, 200);
cal = await stored();
eq(cal.bell.schedules.map(s => s.name).slice(2), ['A day (from the Schedule Visualizer)', 'B day (from the Schedule Visualizer)'], 'the import adds A and B after the two already there');
eq(cal.bell.schedules[2].periods.map(p => p.label), ['Block A', 'Block B'], 'named as 035 names them');
eq([cal.bell.letters.A, cal.bell.letters.B], [cal.bell.schedules[2].id, cal.bell.schedules[3].id], 'the empty letters take them');
eq(cal.bell.regular, cal.bell.schedules[0].id, 'the ordinary day is kept');
ok((await page.textContent('#bellStatus')).includes('1 period was left out'), 'the half-typed row is reported: ' + await page.textContent('#bellStatus'));
let asked = null;
page.once('dialog', d => { asked = d.message(); d.dismiss(); });
await page.click('#btnImportBell');
await settle(page, 200);
ok(asked && asked.includes('imported before'), 'a second import asks first');
eq((await stored()).bell.schedules.length, 4, 'and declining adds nothing');
await page.evaluate(() => localStorage.removeItem('stviz_settings'));
await page.click('#btnImportBell');
ok((await page.textContent('#bellStatus')).includes('no bell times yet'), 'with no 035 times it says so');

/* 8. a field the page cannot read is kept; a later one is not edited */
await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('scv_calendar_v1')); c.bell = 'junk'; localStorage.setItem('scv_calendar_v1', JSON.stringify(c)); });
await reload();
ok((await page.textContent('#bellStatus')).includes('could not be read'), 'a broken field is reported');
await page.click('#btnAddBell');
await settle(page, 200);
cal = await stored();
eq([cal.bellBroken, cal.bell.schedules.length], ['junk', 1], 'adding a schedule keeps the old value as bellBroken');
const newer = { v: 2, schedules: [{ id: 'x', name: 'Future', periods: [] }], future: true };
await page.evaluate((b) => { const c = JSON.parse(localStorage.getItem('scv_calendar_v1')); c.bell = b; localStorage.setItem('scv_calendar_v1', JSON.stringify(c)); }, newer);
await reload();
ok((await page.textContent('#bellStatus')).includes('newer version'), 'a later version is reported');
ok(await page.isDisabled('#btnAddBell') && await page.isDisabled('#btnImportBell'), 'and its buttons are off');
await page.fill('#metaLabel', 'Renamed year');
await page.click('#btnApplyMeta');
await settle(page, 200);
eq((await stored()).bell, newer, 'another edit saves it back untouched');

/* 9. new year carries the schedules */
await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('scv_calendar_v1')); c.bell = { v: 1, schedules: [{ id: 'r', name: 'Regular', periods: [{ label: 'P1', start: '08:00', end: '09:00' }] }], regular: 'r', letters: { A: null, B: null }, types: {} }; localStorage.setItem('scv_calendar_v1', JSON.stringify(c)); });
await reload();
const answers = ['Next year', '2027-08-30', '2028-06-09'];
const onNewYear = d => { if (d.type() === 'prompt') d.accept(answers.shift()); else d.dismiss(); };
page.on('dialog', onNewYear);
await page.click('#btnNewYear');
await settle(page, 300);
page.off('dialog', onNewYear);
cal = await stored();
eq([cal.meta.start, cal.bell && cal.bell.regular], ['2027-08-30', 'r'], 'a new year keeps the bell schedules, as it keeps the legend');

/* 10. accessibility and noise */
const v = await a11yScan(page, { include: '.bell-card' });
eq(v.map(x => x.id), [], 'the card has no serious axe finding');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
