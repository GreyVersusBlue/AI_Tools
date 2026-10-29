// smoke-sound.mjs — Name Picker: the page reaches np-sound.js correctly.
//
//   node Tools/name-picker/test/smoke-sound.mjs
//
// Path 15 P1 step 2: the page builds its audio functions with createSound() and hands it
// two readers. A fake AudioContext counts oscillators; Let's Go Crazy plays the klaxon
// (three beeps) only while the Sound box is ticked, and a pick makes tones and no more
// than one context.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8604;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.addInitScript(() => {
  window.__audio = { contexts: 0, oscillators: 0 };
  const mk = () => ({ connect() {}, start() {}, stop() {}, type: '', frequency: { value: 0 },
    gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  window.AudioContext = class { constructor() { window.__audio.contexts++; this.currentTime = 0; this.destination = {}; }
    createOscillator() { window.__audio.oscillators++; return mk(); } createGain() { return mk(); } };
});
await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
await page.click('#settingsBtn');
await settle(page, 300);
await page.fill('#namesInput', 'Ada\nBo\nCy\nDi');
await page.click('#loadNames');
await settle(page, 300);
await page.keyboard.press('Escape');
await settle(page, 300);

const count = () => page.evaluate(() => window.__audio.oscillators);
ok(await page.evaluate(() => document.getElementById('soundToggle').checked), 'Sound starts ticked');
await page.evaluate(() => document.getElementById('crazyBtn').click());
await settle(page, 600);
ok(await count() === 3, 'Crazy on plays the three-beep klaxon (got ' + await count() + ')');
await page.evaluate(() => document.getElementById('crazyBtn').click());
await settle(page, 200);

const before = await count();
await page.evaluate(() => { const c = document.getElementById('soundToggle'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
await page.evaluate(() => document.getElementById('crazyBtn').click());
await settle(page, 600);
ok(await count() === before, 'with Sound unticked the klaxon is silent');
await page.evaluate(() => document.getElementById('crazyBtn').click());
await page.evaluate(() => { const c = document.getElementById('soundToggle'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('#pickBtn');
await settle(page, 4500);
ok(await count() > before, 'a pick plays tones (' + (await count() - before) + ')');
ok(await page.evaluate(() => window.__audio.contexts) === 1, 'and the page made one AudioContext');

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
