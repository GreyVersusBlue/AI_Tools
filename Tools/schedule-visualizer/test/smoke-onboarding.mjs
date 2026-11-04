// smoke-onboarding.mjs — 035's welcome and Help dialogs after initOnboardingAndHelp() moved out of
// the page into schedule-visualizer/sv-onboarding.js (Path 11 P2, rank 140, ninth increment).
//
//   node Tools/schedule-visualizer/test/smoke-onboarding.mjs
//   (or: npm run test:layout-onboarding)
//
// Holds the wiring that moved: the export is on window and is the page's; on a first visit the
// welcome dialog opens by itself and takes focus, and every way of closing it (Start, the X, the
// backdrop, Escape) closes it and records `stviz_onboarded`, so the next visit does not show it; a
// press inside the dialog does not close it; the Help button opens Help, its X, Got it, the backdrop
// and Escape close it, focus goes back to the Help button, and closing Help records nothing.
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8701;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/035-schedule-visualizer.html';
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const isOpen = (page, id) => page.evaluate((i) => document.getElementById(i).classList.contains('open'), id);
const key = (page) => page.evaluate(() => localStorage.getItem('stviz_onboarded'));
const focused = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
const waitOpen = (page, id) => page.waitForFunction((i) => document.getElementById(i).classList.contains('open'), id, { timeout: 5000 })
  .then(() => true, () => false);

/** A fresh context with nothing stored: a first visit, the welcome dialog open. */
async function firstVisit() {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  ok(await waitOpen(page, 'onboarding-modal'), 'first visit: the welcome dialog opens by itself');
  await settle(page, 150);
  return page;
}

console.log('School Layout Visualizer: the welcome and Help dialogs (sv-onboarding.js)');

console.log('1. the module is on window');
let page = await firstVisit();
eq(await page.evaluate(() => [typeof window.initOnboardingAndHelp, typeof window.SVOnboarding,
  window.SVOnboarding.initOnboardingAndHelp === window.initOnboardingAndHelp, 'ONBOARDING_KEY' in window.SVOnboarding]),
['function', 'object', true, false], 'initOnboardingAndHelp exported and copied onto window; the key stays private');

console.log('2. first visit, Start');
// openModal() focuses the first of '.modal-btn.primary, button, [tabindex]' in document order: the X.
eq(await focused(page), 'onboarding-x', 'focus moves into the dialog (its X, first in order)');
eq(await key(page), null, 'nothing recorded while it is open');
await page.evaluate(() => {
  document.getElementById('onboarding-title').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
});
ok(await isOpen(page, 'onboarding-modal'), 'a press inside the dialog does not close it');
await page.keyboard.press('a');
ok(await isOpen(page, 'onboarding-modal'), 'a key other than Escape does not close it');
await page.click('#onboarding-start');
ok(!(await isOpen(page, 'onboarding-modal')), 'Start closes it');
eq(await key(page), '1', 'Start records stviz_onboarded');

console.log('3. the next visit');
await page.reload({ waitUntil: 'load' });
await settle(page, 1200);
ok(!(await isOpen(page, 'onboarding-modal')), 'with the key stored, the welcome dialog does not open');
await page.context().close();

console.log('4. the X, the backdrop and Escape');
page = await firstVisit();
await page.click('#onboarding-x');
ok(!(await isOpen(page, 'onboarding-modal')), 'the X closes it');
eq(await key(page), '1', 'the X records it');
await page.context().close();

page = await firstVisit();
await page.evaluate(() => {
  const o = document.getElementById('onboarding-modal');
  o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
});
ok(!(await isOpen(page, 'onboarding-modal')), 'a press on the backdrop closes it');
eq(await key(page), '1', 'the backdrop records it');
await page.context().close();

page = await firstVisit();
await page.keyboard.press('Escape');
ok(!(await isOpen(page, 'onboarding-modal')), 'Escape closes it');
eq(await key(page), '1', 'Escape records it');
await page.context().close();

console.log('5. Help');
page = await firstVisit();
// Close the welcome without recording it, so a Help close that wrongly records shows up.
await page.evaluate(() => { document.getElementById('onboarding-modal').classList.remove('open'); });
eq(await key(page), null, 'welcome closed by hand, nothing recorded');
const openHelp = async () => {
  await page.click('#btn-open-help');
  return waitOpen(page, 'help-modal');
};
for (const [how, act] of [
  ['its X', () => page.click('#help-x')],
  ['Got it', () => page.click('#help-done')],
  ['the backdrop', () => page.evaluate(() => document.getElementById('help-modal').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))],
  ['Escape', () => page.keyboard.press('Escape')],
]) {
  ok(await openHelp(), `the Help button opens Help (before ${how})`);
  await settle(page, 150);
  ok((await focused(page)) !== 'btn-open-help', `focus moves into Help (before ${how})`);
  await act();
  ok(!(await isOpen(page, 'help-modal')), `${how} closes Help`);
  eq(await focused(page), 'btn-open-help', `focus goes back to the Help button after ${how}`);
}
eq(await key(page), null, 'closing Help records nothing');
await page.context().close();

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
