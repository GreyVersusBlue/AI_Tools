// smoke-adopters.mjs — 039, 014 and 044 speak through _shared/speak.js (Path 19 P3 leftovers, v486).
//
//   node Tools/speak/test/smoke-adopters.mjs        (port 8621)
//
// Until v486 these three pages each carried their own few lines of speechSynthesis. Held here:
//   1. none of the three pages calls speechSynthesis or builds an utterance itself any more, and each
//      loads _shared/speak.js (a static read of the page source);
//   2. with a fake speechSynthesis that logs what it is asked to say, 039's Listen button speaks the
//      infinitive in the set's pronunciation language, 014's Speak button speaks a phrase in the class's
//      language, and 044's Read aloud speaks the whole plan with no language set, then pauses, resumes
//      and stops through the same helper;
//   3. with no speechSynthesis at all the three pages' buttons are disabled (or absent), as before.
// This proves the wiring, NOT that a real speaker says anything. Exits 1 on any failure.

import fs from 'node:fs';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8621;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGES = { p039: '039-vocab-conjugation-drill.html', p014: '014-roleplay-scenario-generator.html', p044: '044-Sub Plan Builder.html' };

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Speak adopters: 039, 014, 044');

// 1. the pages do not speak by themselves any more
for (const [id, file] of Object.entries(PAGES)) {
  const src = fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  ok(!/window\.speechSynthesis|new SpeechSynthesisUtterance|'speechSynthesis' in window/.test(src), `${id}: no speechSynthesis of its own`);
  ok(/<script src="\.\.\/_shared\/speak\.js"><\/script>/.test(src), `${id}: loads _shared/speak.js`);
  ok(src.indexOf('_shared/speak.js') < src.indexOf('Speak.'), `${id}: loads it before it calls it`);
}

const server = await serve(PORT);
const browser = await launch();

const FAKE = () => {
  window.__said = []; window.__calls = [];
  const synth = {
    speaking: false, paused: false, getVoices: () => [],
    cancel() { window.__calls.push('cancel'); this.speaking = false; this.paused = false; },
    pause() { window.__calls.push('pause'); this.paused = true; },
    resume() { window.__calls.push('resume'); this.paused = false; },
    speak(u) { window.__said.push([u.text, u.lang === undefined ? null : u.lang]); this.speaking = true; window.__utt = u; },
    addEventListener() {}, removeEventListener() {}
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

async function open(file, { fake = true } = {}) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
  if (fake) await page.addInitScript(FAKE);
  else await page.addInitScript(() => { delete window.speechSynthesis; delete window.SpeechSynthesisUtterance; });
  await page.goto(BASE + '/Tools/' + encodeURI(file), { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}

// 2a. 039: Listen beside the infinitive
{
  const page = await open(PAGES.p039);
  await page.click('.mode-tab[data-mode="conjugation"]');
  await page.click('#addConjBtn');
  await page.fill('.conj-entry input[placeholder^="Infinitive"]', 'hablar');
  await page.click('.conj-entry .listen-btn');
  eq(await page.evaluate(() => window.__said), [['hablar', 'es-ES']], '039: Listen speaks the infinitive in the default pronunciation language');
  await page.selectOption('#ttsLangSelect', 'fr-FR');
  await page.fill('.conj-entry input[placeholder^="Infinitive"]', 'parler');
  await page.click('.conj-entry .listen-btn');
  eq(await page.evaluate(() => window.__said.slice(-1)), [['parler', 'fr-FR']], '039: and in the language the teacher picked');
  ok((await page.evaluate(() => window.__calls)).includes('cancel'), '039: it cancels what was being said first');
  await page.close();
}

// 2b. 014: Speak on a phrase
{
  const page = await open(PAGES.p014);
  const n = await page.evaluate(() => document.querySelectorAll('.speak-btn:not([disabled])').length);
  ok(n > 0, `014: Speak buttons are enabled (${n})`);
  // Speak reads what the student wrote in that box, so write something first
  await page.fill('.frame-input[data-idx="0"]', 'Buenos días, ¿cómo está?');
  await page.click('.speak-btn[data-kind="frame"][data-idx="0"]');
  const said = await page.evaluate(() => window.__said);
  eq(said, [['Buenos días, ¿cómo está?', 'es-ES']], '014: Speak speaks the written phrase in the class language (Spanish by default)');
  await page.click('.speak-btn[data-kind="frame"][data-idx="1"]');
  eq((await page.evaluate(() => window.__said)).length, 1, '014: an empty box says nothing');
  await page.close();
}

// 2c. 044: Read aloud, pause, resume
{
  const page = await open(PAGES.p044);
  await page.click('#btnQuickCopy');
  await page.waitForSelector('#qcRead');
  await page.click('#qcRead');
  const said = await page.evaluate(() => window.__said);
  eq(said.length, 1, '044: Read aloud speaks once');
  eq(said[0] && said[0][1], null, '044: with no language set, as before');
  ok(said[0] && said[0][0].length > 0, '044: the whole plan text');
  await settle(page, 80);
  eq(await page.textContent('#qcRead'), '⏸️ Pause', '044: the button now says Pause');
  await page.click('#qcRead');
  ok((await page.evaluate(() => window.__calls)).includes('pause'), '044: pressing it pauses');
  await settle(page, 80);
  eq(await page.textContent('#qcRead'), '▶️ Resume', '044: and says Resume');
  await page.click('#qcRead');
  ok((await page.evaluate(() => window.__calls)).includes('resume'), '044: pressing it resumes');
  await page.evaluate(() => { window.__utt.onend(); });
  await page.click('#qcClose');
  ok((await page.evaluate(() => window.__calls)).filter(c => c === 'cancel').length >= 2, '044: closing the box cancels the speech');
  await page.close();
}

// 3. no speechSynthesis in the browser
{
  const p039 = await open(PAGES.p039, { fake: false });
  await p039.click('.mode-tab[data-mode="conjugation"]');
  await p039.click('#addConjBtn');
  eq(await p039.$eval('.conj-entry .listen-btn', b => b.disabled), true, '039: with no speech the Listen button is disabled');
  await p039.close();
  const p014 = await open(PAGES.p014, { fake: false });
  eq(await p014.$$eval('.speak-btn', bs => bs.length > 0 && bs.every(b => b.disabled)), true, '014: with no speech every Speak button is disabled');
  await p014.close();
  const p044 = await open(PAGES.p044, { fake: false });
  await p044.click('#btnQuickCopy');
  await p044.waitForSelector('#qcText');
  eq(await p044.$$('#qcRead').then(a => a.length), 0, '044: with no speech there is no Read aloud button');
  await p044.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
