// smoke-settings-editors.mjs — 035's bell schedule and subjects editors after they moved
// out of the page into schedule-visualizer/sv-settings-editors.js (Path 11 P2, rank 140).
//
//   node Tools/schedule-visualizer/test/smoke-settings-editors.mjs
//   (or: npm run test:layout-settings-editors)
//
// What is held: the module loads and puts its two renderers on window; the Settings tab
// draws one time row per mod and a subject row per subject; typing a time writes it to
// AppState.settings.bellSchedule (and nothing to storage until Save Settings); end <= start
// flags the row and an overlap warns; the B tab's "Same as A Day" box nulls and forks B; a
// subject can be added (code upper-cased, a repeat refused), renamed, recoloured, reordered
// and deleted (a used one asks first, "no" changes nothing); every change is saved and the
// classroom editor's Department list follows. Nothing here describes a real school.
// Exits 1 on any failure.

/* global switchTab, AppState -- 035's page globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8659;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';

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
await page.context().addInitScript(() => { try { localStorage.setItem('stviz_onboarded', '1'); } catch (e) { /* blocked */ } });

const open = async () => {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('stviz_settings'));
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
  await page.evaluate(() => switchTab('settings'));
  await settle(page, 300);
};
const bell = () => page.evaluate(() => JSON.parse(JSON.stringify(AppState.settings.bellSchedule || null)));
const stored = () => page.evaluate(() => localStorage.getItem('stviz_settings'));
const subjectCodes = () => page.$$eval('#subjects-list .subject-code', els => els.map(e => e.textContent));
const savedSubjects = async () => (JSON.parse(await stored() || 'null') || {}).subjects?.map(s => s.code);
const deptOptions = () => page.$$eval('#rp-teacher-dept option', os => os.map(o => o.value));
const toast = () => page.evaluate(() => [...document.querySelectorAll('#toast-container > *')].map(t => t.textContent).join('|'));

console.log('School Layout Visualizer: bell schedule and subjects editors (sv-settings-editors.js)');

await open();
console.log('1. the module is on the page');
eq(await page.evaluate(() => [typeof window.SVSettingsEditors, typeof window.renderBellScheduleEditor, typeof window.renderSubjectsEditor]), ['object', 'function', 'function'], 'the module and both renderers are on window');
const mods = await page.evaluate(() => AppState.settings.modCount);
eq(await page.$$eval('#bell-schedule-table tr[data-bell-idx]', t => t.length), mods, 'one time row per mod');
ok((await subjectCodes()).length > 0, 'the subject list is drawn');

console.log('2. the bell schedule');
const first = page.locator('#bell-schedule-table tr[data-bell-idx="0"] input[data-field="start"]');
await first.fill('07:30');
await page.locator('#bell-schedule-table tr[data-bell-idx="0"] input[data-field="end"]').fill('08:20');
await page.locator('#bell-schedule-table tr[data-bell-idx="1"] input[data-field="start"]').fill('08:10');
eq((await bell()).A.slice(0, 2), [{ start: '07:30', end: '08:20' }, { start: '08:10', end: null }], 'typed times are written to settings.bellSchedule.A');
eq(await page.$eval('#bell-schedule-table tr[data-bell-idx="1"] [data-bell-warn]', e => e.textContent), 'overlaps prior', 'a start before the prior end warns "overlaps prior"');
ok(await page.isVisible('#bell-schedule-warn'), 'and the overlap note shows');
await page.locator('#bell-schedule-table tr[data-bell-idx="0"] input[data-field="end"]').fill('07:00');
eq(await page.$eval('#bell-schedule-table tr[data-bell-idx="0"] [data-bell-warn]', e => e.textContent), 'end ≤ start', 'an end before the start flags the row');
ok(await page.$eval('#bell-schedule-table tr[data-bell-idx="0"] input', e => e.classList.contains('bell-invalid')), 'and marks its inputs invalid');
await page.locator('#bell-schedule-table tr[data-bell-idx="0"] input[data-field="end"]').fill('07:30');
eq(await page.$eval('#bell-schedule-table tr[data-bell-idx="0"] [data-bell-warn]', e => e.textContent), 'end ≤ start', 'an end equal to the start flags the row too');
eq(await stored(), null, 'nothing is stored until Save Settings');
await page.click('.bell-day-tab[data-bell-day="B"]');
eq(await page.$eval('#bell-same-as-a', e => e.checked), true, 'the B tab starts as "Same as A Day"');
ok((await page.textContent('#bell-schedule-table')).includes('B Day uses the A Day times'), 'and says so');
await page.uncheck('#bell-same-as-a');
eq((await bell()).B.slice(0, 2), (await bell()).A.slice(0, 2), 'unchecking forks a copy of A into B');
await page.locator('#bell-schedule-table tr[data-bell-idx="2"] input[data-field="start"]').fill('09:00');
eq([(await bell()).B[2], (await bell()).A[2]], [{ start: '09:00', end: null }, null], 'a B edit does not touch A');
await page.check('#bell-same-as-a');
eq((await bell()).B, null, 'checking "Same as A Day" nulls B');

console.log('3. the subjects');
const before = await subjectCodes();
await page.fill('#subject-new-code', 'zzq');
await page.fill('#subject-new-name', 'Zed Studies');
await page.click('#btn-add-subject');
eq(await subjectCodes(), before.concat(['ZZQ']), 'a new subject is added with its code upper-cased');
eq(await savedSubjects(), before.concat(['ZZQ']), 'and saved');
ok((await deptOptions()).includes('ZZQ'), 'and the classroom editor\'s Department list follows');
await page.fill('#subject-new-code', 'ZZQ');
await page.click('#btn-add-subject');
ok(/already exists/.test(await toast()), 'a repeated code is refused with a note');
eq((await subjectCodes()).length, before.length + 1, 'and not added twice');
await page.fill('#subject-new-code', '');
await page.click('#btn-add-subject');
ok(/Enter a subject code/.test(await toast()), 'an empty code is refused with a note');
const row = '#subjects-list .subject-row:last-child';
await page.fill(row + ' .subject-name-input', 'Zed Renamed');
await page.press(row + ' .subject-name-input', 'Tab');
eq(await page.evaluate(() => AppState.settings.subjects.at(-1).name), 'Zed Renamed', 'a rename is written to settings.subjects');
await page.locator(row + ' .subject-color-dot input').evaluate(e => { e.value = '#123456'; e.dispatchEvent(new Event('input', { bubbles: true })); });
eq(await page.evaluate(() => AppState.settings.subjects.at(-1).color), '#123456', 'a recolour is written');
await page.dragAndDrop('#subjects-list .subject-row:last-child .subject-grip', '#subjects-list .subject-row:first-child');
eq((await subjectCodes())[0], 'ZZQ', 'dragging a row to the top reorders the list');
eq((await savedSubjects())[0], 'ZZQ', 'and the new order is saved');
page.once('dialog', d => d.dismiss());
await page.click('#subjects-list .subject-row:first-child .subject-del-btn');
ok((await subjectCodes()).includes('ZZQ'), 'declining the delete confirmation keeps the subject');
page.once('dialog', d => d.accept());
await page.click('#subjects-list .subject-row:first-child .subject-del-btn');
eq(await subjectCodes(), before, 'accepting it deletes the subject');
eq(await savedSubjects(), before, 'and the list saved has it gone');
ok(!(await deptOptions()).includes('ZZQ'), 'and the Department list drops it');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
