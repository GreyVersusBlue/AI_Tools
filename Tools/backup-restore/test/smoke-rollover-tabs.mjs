// smoke-rollover-tabs.mjs — step 1 of 009's "Start a new school year": the
// other tabs (Path 3 P6 increment 3). An open tool holds last year in memory
// and saves it back after the clear, so the page asks the service worker
// (sw.js, the CLIENTS message) which other windows of the site are open.
//
//   node Tools/backup-restore/test/smoke-rollover-tabs.mjs
//
// What it holds, with the real worker:
//   - with no other tab, step 1 is done and the archive can be saved;
//   - another tab of a tool is named, by the registry's title and counted,
//     and the archive is locked until it is closed and the page looks again;
//   - the page looks again before the clear: a tab opened after the archive
//     was checked stops the clear with nothing removed and the journal still
//     at 'archived', and the clear runs once it is closed;
// and with the worker blocked (as on file://):
//   - the page says it cannot see other tabs, and the archive is locked
//     until the teacher says they are closed.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, downloadText } from '../../board-check/harness.mjs';

const PORT = 8534;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/009-backup-restore.html';
const URL_PICKER = BASE + '/Tools/007-Name%20Picker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};

const SEED = {
  np_rosters: JSON.stringify({ 'Period 3': ['Avery Stone', 'Blake Rivers'] }),
  np_history: JSON.stringify([{ name: 'Avery Stone', at: 1 }]),
  'gvb-rubric-builder:data:Essay': JSON.stringify({ title: 'Essay', rows: 4 }),
};

const disabled = (page, sel) => page.$eval(sel, el => el.disabled);
const text = (page, sel) => page.$eval(sel, el => el.textContent);
const hidden = (page, sel) => page.$eval(sel, el => el.hidden);
const tabsMsg = page => text(page, '#roTabsMsg');
async function check(page) {
  await page.click('#roTabsBtn');
  await settle(page, 600);
}
const journalState = page => page.evaluate(() => {
  const j = JSON.parse(localStorage.getItem('br_rollover_v1') || '{"runs":[]}');
  const r = j.runs[j.runs.length - 1];
  return r ? r.state : null;
});

const server = await serve(PORT);
const browser = await launch();
try {
  console.log('Backup & Restore — the other tabs before a new school year');

  /* ── 1. with the worker ──────────────────────────────────────────── */
  const page = await prepPage(browser, BASE, { width: 1200, height: 1000, serviceWorkers: 'allow' });
  /* The anchor-download path: no save picker, the teacher picks the file. */
  await page.addInitScript(() => { window.showSaveFilePicker = undefined; });
  const ctx = page.context();
  await page.goto(URL_PAGE);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
  await page.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);
  await page.reload();
  await page.waitForFunction(() => /No other tab|Still open/.test(document.getElementById('roTabsMsg').textContent), null, { timeout: 10000 }).catch(() => {});
  ok(/No other tab of this site is open/.test(await tabsMsg(page)), '1: alone, the page says no other tab is open (' + (await tabsMsg(page)).trim() + ')');
  ok(!(await disabled(page, '#roSaveBtn')), '1: ...and the archive can be saved');
  ok(await hidden(page, '#roTabsOkBtn'), '1: ...and it does not ask the teacher, because it can see');

  const other = await ctx.newPage();
  await other.goto(URL_PICKER);
  await other.waitForLoadState('load');
  await check(page);
  ok(/Still open: Name Picker\./.test(await tabsMsg(page)), '2: another tab is named by its tool (' + (await tabsMsg(page)).trim() + ')');
  ok(await disabled(page, '#roSaveBtn'), '2: ...and the archive is locked while it is open');
  ok(await page.$eval('#roStep1', el => el.classList.contains('ro-off')), '2: ...and step 2 shows as not yet');

  const other2 = await ctx.newPage();
  await other2.goto(URL_PICKER + '?x=1');
  const landing = await ctx.newPage();
  await landing.goto(BASE + '/index.html');
  const self2 = await ctx.newPage();
  await self2.goto(URL_PAGE);
  await check(page);
  const msg3 = await tabsMsg(page);
  ok(/Name Picker \(2 tabs\)/.test(msg3), '3: two tabs of one tool are counted (' + msg3.trim() + ')');
  ok(/The landing page/.test(msg3), '3: the landing page is named');
  ok(/Backup & Restore/.test(msg3), '3: a second copy of this page is named too: it saves as well');
  ok(/Close them/.test(msg3), '3: ...and the teacher is told to close them');

  for (const p of [other, other2, landing, self2]) await p.close();
  await check(page);
  ok(/No other tab/.test(await tabsMsg(page)) && !(await disabled(page, '#roSaveBtn')), '4: once they are closed, looking again unlocks the archive');

  /* ── 5. the page looks again before it clears ────────────────────── */
  const archive = await downloadText(page, '#roSaveBtn', { what: 'the year archive' });
  await page.waitForFunction(() => /Saved/.test(document.getElementById('roSaveMsg').textContent), null, { timeout: 15000 });
  await page.setInputFiles('#roCheckFile', { name: 'archive.json', mimeType: 'application/json', buffer: Buffer.from(archive) });
  await page.waitForFunction(() => /is complete/.test(document.getElementById('roCheckMsg').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('roClearBtn').disabled, null, { timeout: 10000 });
  const late = await ctx.newPage();
  await late.goto(URL_PICKER);
  const storeBefore = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  await page.click('#roClearBtn');
  await page.waitForFunction(() => /Nothing was cleared/.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 10000 }).catch(() => {});
  const msg5 = await text(page, '#rolloverMsg');
  ok(/Nothing was cleared: Name Picker is open in another tab/.test(msg5), '5: a tab opened after the check stops the clear (' + msg5.trim() + ')');
  const storeAfter = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  ok(storeAfter === storeBefore, '5: ...with nothing in storage changed');
  ok(await journalState(page) === 'archived', '5: ...and the journal still at archived, not clearing');
  ok(!(await disabled(page, '#roClearBtn')), '5: ...and the clear can be pressed again');

  await late.close();
  await page.click('#roClearBtn');
  await page.waitForFunction(() => /Cleared\./.test(document.getElementById('rolloverMsg').textContent), null, { timeout: 15000 }).catch(() => {});
  ok(/Cleared\./.test(await text(page, '#rolloverMsg')), '6: with the tab closed, the clear runs');
  ok(await page.evaluate(() => localStorage.getItem('np_history')) === null && await journalState(page) === 'done', '6: ...and removes the student data, journal done');
  ok(page.__errs.length === 0, '6: no page errors (' + page.__errs.slice(0, 3).join(' | ') + ')');
  await ctx.close();

  /* ── 7. with no worker to ask (as on file://) ────────────────────── */
  const blind = await prepPage(browser, BASE, { width: 1200, height: 1000 });
  await blind.goto(URL_PAGE);
  await blind.evaluate(seed => { localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);
  await blind.reload();
  await blind.waitForSelector('#roTabsOkBtn:not([hidden])', { timeout: 10000 }).catch(() => {});
  ok(/cannot see other tabs/.test(await tabsMsg(blind)), '7: with no worker the page says it cannot see other tabs (' + (await tabsMsg(blind)).trim() + ')');
  ok(!(await hidden(blind, '#roTabsOkBtn')), '7: ...asks the teacher');
  ok(await disabled(blind, '#roSaveBtn'), '7: ...and the archive is locked until they answer');
  await blind.click('#roTabsOkBtn');
  await settle(blind, 200);
  ok(!(await disabled(blind, '#roSaveBtn')) && await hidden(blind, '#roTabsOkBtn'), '7: saying they are closed unlocks the archive');
  ok(/finds what it saved again/.test(await tabsMsg(blind)), '7: ...and the page says what catches a tab left open');
  ok(blind.__errs.length === 0, '7: no page errors (' + blind.__errs.slice(0, 3).join(' | ') + ')');
  await blind.context().close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
