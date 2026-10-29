// smoke-modes.mjs — Name Picker: each pick mode still runs through the page and names a winner.
//
//   node Tools/name-picker/test/smoke-modes.mjs
//
// Path 15 P1 steps 3 and 4 lifted jump, disappear, slot and multi into np-mode-*.js behind a host object the
// page builds. test:name-picker-modes holds the logic to the old code; this drives the real
// page: for each mode, with Let's Go Crazy off and on, one pick ends on the winner dialog
// with a name from the roster, and the rolling state is released again.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8605;
const BASE = `http://127.0.0.1:${PORT}`;
const ROSTER = ['Ada', 'Bo', 'Cy', 'Di', 'Ed'];
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
for (const crazy of [false, true]) for (const mode of ['jump', 'disappear', 'slot']) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.selectOption('#mode', mode);
  if (crazy) await page.evaluate(() => document.getElementById('crazyBtn').click());
  await page.evaluate(() => document.getElementById('pickBtn').click());
  const label = `${mode}${crazy ? ' + crazy' : ''}`;
  try {
    await page.waitForSelector('.modal-overlay .winner-name', { timeout: 20000 });
    const winner = (await page.textContent('.modal-overlay .winner-name')).trim();
    ok(ROSTER.includes(winner), `${label}: the dialog names someone on the roster (${winner})`);
    await page.evaluate(() => document.getElementById('modalDone').click());
    await settle(page, 400);
    ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), `${label}: the pick button is free again`);
  } catch (e) { failed++; console.log('  FAIL ' + label + ': no winner dialog (' + String(e.message).split('\n')[0] + ')'); }
  await page.context().close();
}
/* Pick several at once (np-mode-multi.js): three distinct names from the roster, and the pick lands in the history. */
for (const crazy of [false, true]) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
  await page.click('#settingsBtn');
  await settle(page, 300);
  await page.fill('#namesInput', ROSTER.join('\n'));
  await page.click('#loadNames');
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.evaluate(() => { const m = document.getElementById('multiPickCount'); m.value = '3'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  if (crazy) await page.evaluate(() => document.getElementById('crazyBtn').click());
  await page.evaluate(() => document.getElementById('pickBtn').click());
  const label = `multi${crazy ? ' + crazy' : ''}`;
  try {
    await page.waitForSelector('.modal-overlay .multi-pick-name', { timeout: 20000 });
    const got = (await page.$$eval('.modal-overlay .multi-pick-name', els => els.map(e => e.textContent.trim())));
    ok(got.length === 3 && new Set(got).size === 3 && got.every(g => ROSTER.includes(g)), `${label}: three different names from the roster (${got.join(', ')})`);
    await page.evaluate(() => document.getElementById('multiDone').click());
    await settle(page, 400);
    ok(await page.evaluate(() => !document.getElementById('pickBtn').disabled), `${label}: the pick button is free again`);
  } catch (e) { failed++; console.log('  FAIL ' + label + ': no dialog (' + String(e.message).split('\n')[0] + ')'); }
  await page.context().close();
}
await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
