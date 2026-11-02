// smoke-snapshots.mjs — 035's named project snapshots after they moved out of the page
// into schedule-visualizer/sv-snapshots.js (Path 11 P2, rank 140, second increment).
//
//   node Tools/schedule-visualizer/test/smoke-snapshots.mjs
//   (or: npm run test:layout-snapshots)
//
// What is held: the module loads and puts its functions on window (the page's trace-image
// migration and sv-editor.js reach them by bare name); the Settings list says there are none
// yet; Save snapshot stores the whole project under STVIZ_SNAPSHOT_1 with the typed name (a
// default name when blank) and the list shows it with a size and the usage line; five saves
// fill slots 1-4 and the fifth evicts the oldest; the auto slot 0 (what "before clear" writes)
// is listed last with its own class; a name is shown as text, never as markup; Restore asks
// first, "no" changes nothing and "yes" puts the saved project back; Delete asks first too;
// a quota refusal says so instead of dying in the console; a corrupt slot is skipped, not
// fatal. Exits 1 on any failure.

/* global AppState, switchTab, saveSnapshot, listSnapshots -- 035's page globals, read inside page.evaluate() */
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8665;
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
  await page.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('STVIZ_SNAPSHOT_')).forEach(k => localStorage.removeItem(k)); });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);
  await page.evaluate(() => switchTab('settings'));
  await settle(page, 300);
};
const slots = () => page.evaluate(() => [0, 1, 2, 3, 4].map(i => { const r = localStorage.getItem('STVIZ_SNAPSHOT_' + i); if (!r) return null; try { return JSON.parse(r).name; } catch (e) { return 'corrupt'; } }));
const names = () => page.$$eval('#snapshot-list .snapshot-item-name', els => els.map(e => e.textContent));
const toast = () => page.evaluate(() => [...document.querySelectorAll('#toast-container > *')].map(t => t.textContent).join('|'));
const save = async (name) => {
  await page.fill('#snapshot-name-input', name);
  await page.click('#btn-save-snapshot');
};

console.log('School Layout Visualizer: project snapshots (sv-snapshots.js)');

await open();
console.log('1. the module is on the page');
eq(await page.evaluate(() => [typeof window.SVSnapshots, typeof window.saveSnapshot, typeof window.restoreSnapshot, typeof window.snapshotKey, window.SNAPSHOT_TOTAL, typeof window.renderSnapshotList]),
  ['object', 'function', 'function', 'function', 5, 'function'], 'the module and what the page and sv-editor.js call by name are on window');
ok((await page.textContent('#snapshot-list')).includes('No snapshots yet'), 'the list starts empty and says so');

console.log('2. saving');
await save('First plan');
eq(await slots(), [null, 'First plan', null, null, null], 'a save goes to user slot 1');
eq(await names(), ['First plan'], 'and the list shows it');
ok(/~\d+\.\d KB of ~5 MB browser storage/.test(await page.textContent('#snapshot-list .snapshot-usage-line')), 'with the usage line');
ok(/Snapshot "First plan" saved/.test(await toast()), 'and a confirmation toast');
eq(await page.inputValue('#snapshot-name-input'), '', 'the name box is cleared');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('STVIZ_SNAPSHOT_1')));
eq([stored.data.fileType, typeof stored.timestamp, Array.isArray(stored.data.groups)], ['stviz-project', 'string', true], 'the slot holds the whole project with a timestamp');
await save('');
ok(/^Snapshot /.test((await names())[0]), 'a blank name gets a default "Snapshot <time>"');
await page.evaluate(() => saveSnapshot('Auto — before clear', 0));
const listed = await names();
eq(listed[listed.length - 1], 'Auto — before clear', 'the auto slot is listed last');
ok(await page.$$eval('#snapshot-list .snapshot-item', els => els.at(-1).classList.contains('auto')), 'and carries the auto class');
await save('Third');
await save('Fourth');
eq((await slots()).slice(1).every(Boolean), true, 'four saves fill user slots 1-4');
await page.evaluate(() => {
  // age slot 3 so it is the oldest, then add a fifth
  const k = 'STVIZ_SNAPSHOT_3'; const s = JSON.parse(localStorage.getItem(k)); s.timestamp = '2000-01-01T00:00:00.000Z'; localStorage.setItem(k, JSON.stringify(s));
});
await save('Fifth');
const after = await slots();
eq([after[3], after.filter(n => n === 'Fifth').length], ['Fifth', 1], 'a fifth save evicts the oldest user slot');
eq(after[0], 'Auto — before clear', 'and leaves the auto slot alone');

console.log('3. a name is text');
await save('<img src=x onerror="window.__pwned=1"><b>bold</b>');
await settle(page, 200);
eq(await page.evaluate(() => [window.__pwned === undefined, document.querySelectorAll('#snapshot-list img, #snapshot-list b').length]), [true, 0], 'markup in a name is shown, not run');

console.log('4. restore and delete');
await open();
await page.evaluate(() => { AppState.settings.schoolName = 'Before School'; });
await save('Keep me');
await page.evaluate(() => { AppState.settings.schoolName = 'After School'; });
page.once('dialog', d => d.dismiss());
await page.click('#snapshot-list [data-snapshot-slot]');
eq(await page.evaluate(() => AppState.settings.schoolName), 'After School', 'declining the Restore confirmation changes nothing');
page.once('dialog', d => { ok(/Current project will be replaced/.test(d.message()), 'the Restore confirmation warns the project is replaced'); d.accept(); });
await page.click('#snapshot-list [data-snapshot-slot]');
await settle(page, 200);
eq(await page.evaluate(() => AppState.settings.schoolName), 'Before School', 'accepting it puts the saved project back');
ok(/Snapshot "Keep me" restored/.test(await toast()), 'with a toast');
page.once('dialog', d => d.dismiss());
await page.click('#snapshot-list [data-snapshot-delete]');
eq(await names(), ['Keep me'], 'declining the Delete confirmation keeps the snapshot');
page.once('dialog', d => { ok(/cannot be undone/.test(d.message()), 'the Delete confirmation says it cannot be undone'); d.accept(); });
await page.click('#snapshot-list [data-snapshot-delete]');
eq(await slots(), [null, null, null, null, null], 'accepting it removes the slot');
ok((await page.textContent('#snapshot-list')).includes('No snapshots yet'), 'and the list goes back to empty');

console.log('5. refusals');
await page.evaluate(() => { localStorage.setItem('STVIZ_SNAPSHOT_2', '{not json'); });
const listLen = await page.evaluate(() => listSnapshots().length);
eq(listLen, 0, 'a corrupt slot is skipped by the list');
await page.evaluate(() => {
  const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) {
    if (String(k).startsWith('STVIZ_SNAPSHOT_')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    return real.apply(this, arguments);
  };
});
await save('Will not fit');
ok(/browser storage is full/.test(await toast()), 'a full browser says so');
eq((await slots()).filter(n => n === 'Will not fit').length, 0, 'and nothing was stored');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
