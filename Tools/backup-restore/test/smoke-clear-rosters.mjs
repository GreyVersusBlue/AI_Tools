// smoke-clear-rosters.mjs — the landing page's "Clear all rosters" (Path 3 P6,
// item 5; Devon, 2026-10-07: "a 'clear all rosters' button on main page, with
// a confirmation screen").
//
//   node Tools/backup-restore/test/smoke-clear-rosters.mjs
//
// What it holds:
//   - with nothing saved the button is not shown;
//   - the button opens a modal confirmation screen naming the classes and
//     their student counts, what goes and what stays, with focus on Cancel;
//   - Cancel and Escape close it with storage byte-equal and focus back on
//     the button: the screen itself never clears anything;
//   - its continue link opens 009's "Start a new school year" card, focused,
//     with the clear still locked and storage still byte-equal, because the
//     clear only runs there, after the archive is saved and checked;
//   - more than eight classes are summarised; saved data with no class list
//     still shows the button and says so;
//   - the open screen is clean under axe in the light and dark themes.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8535;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_HOME = BASE + '/index.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

const SEED = {
  np_rosters: JSON.stringify({ 'Period 3': ['Avery Stone', 'Blake Rivers'], 'Period 5': ['Casey Lund'] }),
  crh_students_v1: JSON.stringify({ version: 1, rosters: { 'Period 3': { meta: { period: '3' }, students: [{ id: 'a', name: 'Avery Stone' }, { id: 'b', name: 'Blake Rivers' }], orphans: [] },
    /* a class only the sidecar holds still counts */
    'Period 7': { meta: {}, students: [{ id: 'd', name: 'Drew Hale' }], orphans: [] } } }),
  np_history: JSON.stringify([{ name: 'Avery Stone', at: 1 }]),
};

const store = page => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const isOpen = page => page.$eval('#clearRostersDlg', d => d.open);
const hidden = (page, sel) => page.$eval(sel, el => el.hidden);
const activeId = page => page.evaluate(() => document.activeElement && document.activeElement.id);
async function seed(page, data, prefs) {
  await page.goto(URL_HOME);
  await page.evaluate(({ data, prefs }) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    if (prefs) localStorage.setItem('gvb-a11y-prefs', prefs);
  }, { data, prefs });
  await page.reload();
  await settle(page, 300);
}

const server = await serve(PORT);
const browser = await launch();
try {
  console.log('Landing page — Clear all rosters');
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });

  /* ── 1. nothing saved ────────────────────────────────────────────── */
  await seed(page, {});
  ok(await hidden(page, '#clearRostersBtn'), '1: with nothing saved the button is not shown');

  /* ── 2. the confirmation screen ──────────────────────────────────── */
  await seed(page, SEED);
  const before = await store(page);
  ok(!(await hidden(page, '#clearRostersBtn')), '2: with rosters saved the button is shown');
  await page.click('#clearRostersBtn');
  await settle(page, 200);
  ok(await isOpen(page), '2: the button opens the confirmation screen');
  ok(await page.$eval('#clearRostersDlg', d => d.matches(':modal')), '2: ...as a modal dialog');
  const count = await page.textContent('#clearRostersCount');
  ok(/3 classes with 4 students/.test(count), '2: it counts the classes and students (' + count.trim() + ')');
  const items = await page.$$eval('#clearRostersList li', lis => lis.map(li => li.textContent));
  ok(items.join('|') === 'Period 3 (2)|Period 5 (1)|Period 7 (1)', '2: ...and lists each class with its count (' + items.join('|') + ')');
  const body = await page.textContent('#clearRostersDlg');
  ok(/What goes:/.test(body) && /What stays:/.test(body), '2: it says what goes and what stays');
  ok(/Nothing is cleared yet/.test(body) && /reads it back/.test(body), '2: ...and that nothing is cleared until the copy is checked');
  ok(!/Avery|Blake|Casey|Drew/.test(body), '2: it names no student');
  ok(await activeId(page) === 'clearRostersCancel', '2: focus starts on Cancel (' + await activeId(page) + ')');
  const scanLight = await a11yScan(page, { include: '#clearRostersDlg' });
  ok(scanLight.length === 0, '2: axe finds nothing serious on the open screen, light (' + scanLight.map(v => v.id).join(', ') + ')');

  await page.click('#clearRostersCancel');
  await settle(page, 150);
  ok(!(await isOpen(page)), '3: Cancel closes it');
  ok(await store(page) === before, '3: ...with storage unchanged');
  ok(await activeId(page) === 'clearRostersBtn', '3: ...and focus back on the button');

  await page.click('#clearRostersBtn');
  await settle(page, 150);
  await page.keyboard.press('Escape');
  await settle(page, 150);
  ok(!(await isOpen(page)), '4: Escape closes it');
  ok(await store(page) === before, '4: ...with storage unchanged');

  /* ── 5. continue: 009's card, nothing cleared ────────────────────── */
  await page.click('#clearRostersBtn');
  await settle(page, 150);
  await Promise.all([page.waitForNavigation(), page.click('#clearRostersGo')]);
  await settle(page, 400);
  ok(/\/Tools\/009-backup-restore\.html#rolloverCard$/.test(page.url()), '5: continue opens 009 at the rollover card (' + page.url() + ')');
  ok(await activeId(page) === 'rolloverCard', '5: ...with the card focused');
  ok(await page.$eval('#roClearBtn', b => b.disabled), '5: ...and the clear still locked until the archive is checked');
  ok(await store(page) === before, '5: ...and storage unchanged');

  /* ── 6. many classes; no class list ──────────────────────────────── */
  const many = {};
  for (let i = 1; i <= 10; i++) many['Class ' + String(i).padStart(2, '0')] = ['Avery Stone'];
  await seed(page, { np_rosters: JSON.stringify(many) });
  await page.click('#clearRostersBtn');
  await settle(page, 150);
  const manyItems = await page.$$eval('#clearRostersList li', lis => lis.map(li => li.textContent));
  ok(manyItems.length === 9 && manyItems[8] === 'and 2 more', '6: ten classes show eight and "and 2 more" (' + manyItems.slice(-2).join('|') + ')');
  await page.keyboard.press('Escape');

  await seed(page, { 'gvb-rubric-builder:data:Essay': JSON.stringify({ title: 'Essay' }) });
  ok(!(await hidden(page, '#clearRostersBtn')), '7: saved data with no class list still shows the button');
  await page.click('#clearRostersBtn');
  await settle(page, 150);
  ok(/No class list is saved/.test(await page.textContent('#clearRostersCount')), '7: ...and the screen says no class list is saved');
  ok(await hidden(page, '#clearRostersList'), '7: ...with no empty list');
  await page.keyboard.press('Escape');

  /* ── 8. dark ─────────────────────────────────────────────────────── */
  await seed(page, SEED, JSON.stringify({ theme: 'dark' }));
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'dark', '8: the page is dark');
  await page.click('#clearRostersBtn');
  await settle(page, 200);
  const scanDark = await a11yScan(page, { include: '#clearRostersDlg' });
  ok(scanDark.length === 0, '8: axe finds nothing serious on the open screen, dark (' + scanDark.map(v => v.id).join(', ') + ')');
  ok(page.__errs.length === 0, '8: no page errors (' + page.__errs.slice(0, 3).join(' | ') + ')');
  await page.context().close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
