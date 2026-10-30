// smoke-study.mjs — the study printables (Path 19 P4) in 040: Frayer model, fill in the blank,
// review schedule, and the word wall as a system (units, index, retire).
//
//   node Tools/vocab-flashcard-generator/test/smoke-study.mjs        (port 8619)
//
// The arithmetic is study-logic.test.mjs's (pure Node). This is the page: the four tabs, what
// each prints, that a unit is a tag on the word in Word Lists and keeps what else the word
// holds, that a retired unit leaves the wall and the index, and that nothing names a student
// or leaves the site. Dates are typed in, so no clock or zone matters. Nothing here has been
// printed on paper. Every word is invented.
//
// Exits 1 on any failure.

/* global VocabLayout -- 040's own page global, read inside page.evaluate() */

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8619;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
console.log('Vocabulary Flashcards — Frayer / fill in the blank / review schedule / word wall system');

const page = await prepPage(browser, BASE, { width: 1360, height: 980 });
// a speech engine that logs what it is asked to say (no real voice is tried)
await page.addInitScript(() => {
  window.__said = [];
  window.__voices = [];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => window.__voices, cancel() {}, speak(u) { window.__said.push([u.text, u.lang]); }, addEventListener() {}, removeEventListener() {} } });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
page.on('dialog', (d) => d.accept());

const WORDS = [
  'tide: the rise and fall of the sea | The tide came in at noon.',
  'reef: a ridge of rock near the surface | A reef kept the waves small.',
  'delta: land where a river meets the sea | The delta is flat and green.',
  'cove: a small sheltered bay',
  'dune: a hill of sand | Wind built the dune overnight.',
  'strait: a narrow channel | Ships crossed the strait.',
].join('\n');
await page.fill('#listName', 'Shorelines');
await page.fill('#wordInput', WORDS);
await page.dispatchEvent('#wordInput', 'input');
await settle(page, 300);

const mode = async (m) => { await page.click(`.mode-tab[data-mode="${m}"]`); await settle(page, 250); };
const printCount = () => page.evaluate(() => { window.print = () => {}; document.getElementById('printBtn').click(); return document.querySelectorAll('#printArea > .page').length; });
const printText = () => page.evaluate(() => document.getElementById('printArea').innerText);

// the example column of the textarea is "term: definition | example"? check how this list parsed
const parsed = await page.evaluate(() => VocabLayout.parseWordList(document.getElementById('wordInput').value).map((i) => [i.term, i.example]));
const haveExamples = parsed.filter((p) => p[1]).length;
ok(haveExamples >= 1, `the list's lines carry example sentences (${JSON.stringify(parsed)})`);

/* a list nobody used the study tabs on is stored with no new field */
ok(await page.evaluate(() => !('study' in JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Shorelines')))), 'before any study setting is touched, the stored list has no study field');

/* ── Frayer ── */
await mode('frayer');
ok(await page.isVisible('#frayerOptions'), 'Frayer options show');
eq(await printCount(), 6, 'one Frayer page per word');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .fr-q').length), 24, 'four boxes per word');
eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .fr-q h3')].slice(0, 4).map((h) => h.textContent)), ['Definition', 'Characteristics', 'Examples', 'Non-examples'], 'the four headings');
eq(await page.evaluate(() => document.querySelector('#printArea .fr-center strong').textContent), 'tide', 'the word is in the middle');
eq(await page.evaluate(() => document.querySelector('#printArea .fr-fill').textContent), '', 'blank by default');
await page.selectOption('#frayerFill', 'known');
await page.selectOption('#frayerPerPage', '2');
await settle(page, 250);
eq(await printCount(), 3, 'two to a page: six words are three pages');
ok(/the rise and fall of the sea/.test(await printText()), 'filled in: the definition is in its box');

/* ── fill in the blank ── */
await mode('cloze');
ok(await page.isVisible('#clozeOptions'), 'cloze options show');
eq(await printCount(), 2, 'the sheet and its key');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .cz-list')[0].children.length), haveExamples, 'one sentence per word that has an example');
const key = await page.evaluate(() => document.querySelectorAll('#printArea .cz-list')[1].innerText);
ok(/tide/.test(key) && /came in at noon/.test(key), 'the key puts the word back');
const sheet = await page.evaluate(() => document.querySelectorAll('#printArea .cz-list')[0].innerText);
ok(!/\btide\b/.test(sheet), 'the sheet itself does not give the word away');
eq(await page.evaluate(() => document.querySelectorAll('#printArea .cz-bank span').length), haveExamples, 'a word bank of the answers');
await page.uncheck('#clozeBank'); await settle(page, 250);
await printCount();
eq(await page.evaluate(() => document.querySelectorAll('#printArea .cz-bank').length), 0, 'no bank when switched off');
ok(/cove \(no example\)/.test(await page.textContent('#previewNote')), 'a word with no example is named as left out');

/* ── review schedule ── */
await mode('schedule');
ok(await page.isVisible('#srOptions'), 'schedule options show');
await page.fill('#srPerDay', '2'); await page.fill('#srSteps', '1, 3'); await page.fill('#srStart', '2026-10-30');
await page.dispatchEvent('#srPerDay', 'input'); await page.dispatchEvent('#srSteps', 'input'); await page.dispatchEvent('#srStart', 'change');
await settle(page, 300);
await printCount();
const rows = await page.evaluate(() => [...document.querySelectorAll('#printArea .sr-table tr')].map((r) => [...r.children].map((c) => c.textContent)));
eq(rows[1][0], 'Day 1 · 2026-10-30', 'Friday first');
eq(rows[2][0], 'Day 2 · 2026-11-02', 'then Monday: the weekend is skipped');
eq(rows[1][1], 'tide, reef', 'two new words the first day');
eq(rows[2][2], 'tide (1), reef (1)', 'and they are reviewed the next teaching day');
eq(rows.length, 1 + 3 + 3, 'three learning days plus the three review-only days after the last at step 3');
ok(!(await page.isVisible('#srDayWrap')), 'the day box is for the drill sheet only');
await page.selectOption('#srPart', 'day'); await page.fill('#srDay', '2'); await page.dispatchEvent('#srDay', 'input');
await settle(page, 250);
ok(await page.isVisible('#srDayWrap'), 'the day box shows for the drill sheet');
eq(await printCount(), 2, 'a day with reviews prints the sheet and its key');
const drill = await printText();
ok(/Drill — Day 2/.test(drill) && /New today/.test(drill) && /Review: write what each word means/.test(drill), 'the drill sheet has its parts');
ok(/the rise and fall of the sea/.test(drill), 'the key gives the definition');
ok(!/Student|Name:/i.test(drill), 'no student, no name line');

/* ── word wall system ── */
await mode('wallsystem');
ok(await page.isVisible('#wallSysOptions'), 'word wall system options show');
eq(await page.$$eval('#unitRows input', (e) => e.length), 6, 'a unit box per word');
// keep a field the module does not know on a hub word, as P5 will (audio)
await page.evaluate(() => {
  const l = WordList.get('Shorelines');
  l.words[0].audio = 'idb:keep-me';
  WordList.put('Shorelines', l.words);
});
const setUnit = async (i, v) => { const el = (await page.$$('#unitRows input'))[i]; await el.fill(v); await el.dispatchEvent('change'); await settle(page, 200); };
await setUnit(0, 'Water'); await setUnit(1, 'Water'); await setUnit(2, 'Land'); await setUnit(3, 'Land'); await setUnit(4, 'Land');
const tags = await page.evaluate(() => WordList.get('Shorelines').words.map((w) => [w.term, w.tags]));
eq(tags[0], ['tide', ['unit:Water']], 'the unit is a tag on the word in Word Lists');
eq(tags[5], ['strait', []], 'a word given no unit has none');
eq(await page.evaluate(() => WordList.get('Shorelines').words[0].audio), 'idb:keep-me', "a field the module does not know survives the unit write");
await page.evaluate(() => document.getElementById('wordInput').dispatchEvent(new Event('input', { bubbles: true })));
await settle(page, 200);
eq(await page.evaluate(() => WordList.get('Shorelines').words[0].audio), 'idb:keep-me', 'and a save from the textarea');
eq(await page.evaluate(() => WordList.get('Shorelines').words[0].tags), ['unit:Water'], 'and the unit with it');
let n = await printCount();
eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .unit-label')].map((x) => x.textContent)), ['Water', 'Land', 'Land (continued)', 'No unit'], 'cards a unit at a time, in the order the units appear (Land has three cards, two to a page)');
ok(n >= 3, 'at least a page per unit');
await page.selectOption('#wallPart', 'index'); await settle(page, 250);
await printCount();
const idx = await page.evaluate(() => [...document.querySelectorAll('#printArea .ws-index tr')].slice(1).map((r) => [...r.children].map((c) => c.textContent).join('|')));
eq(idx, ['cove|Land|2', 'delta|Land|1', 'dune|Land|3', 'reef|Water|2', 'strait|No unit|1', 'tide|Water|1'], 'the index is A to Z with the unit and the card');
eq(await page.$$eval('#unitRetire label', (e) => e.map((x) => x.textContent)), ['Water', 'Land'], 'a retire tick per named unit');
await page.locator('#unitRetire label', { hasText: 'Water' }).locator('input').check(); await settle(page, 250);
await printCount();
eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .ws-index tr')].slice(1).map((r) => r.children[0].textContent)), ['cove', 'delta', 'dune', 'strait'], 'a retired unit leaves the index');
await page.selectOption('#wallPart', 'takedown'); await settle(page, 250);
await printCount();
const down = await printText();
ok(/Water \(2 cards\)/.test(down) && /tide/.test(down) && /reef/.test(down) && !/delta/.test(down), 'the take-down list names the retired unit and only its words');
await page.selectOption('#wallPart', 'cards'); await settle(page, 250);
await printCount();
eq(await page.evaluate(() => [...document.querySelectorAll('#printArea .unit-label')].map((x) => x.textContent)), ['Land', 'Land (continued)', 'No unit'], 'a retired unit leaves the cards');
// the retire choice is on the list, so it survives a reload
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
await mode('wallsystem');
eq(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Shorelines')).study.retiredUnits), ['Water'], 'the retired unit is stored with the list');
eq(await page.$$eval('#unitRetire input:checked', (e) => e.length), 1, 'and ticked again after a reload');
// every word in one unit, that unit retired -> a message, not a blank sheet
await page.fill('#unitAll', 'Tides'); await page.click('#unitAllBtn'); await settle(page, 250);
await page.locator('#unitRetire label', { hasText: 'Tides' }).locator('input').check(); await settle(page, 250);
await page.selectOption('#wallPart', 'cards'); await settle(page, 250);
let dlg = null; page.once('dialog', (d) => { dlg = d.message(); });
await page.click('#printBtn'); await settle(page, 200);
ok(dlg && /Every unit is retired/.test(dlg), 'with every unit retired, Print says so instead of printing nothing');
await page.selectOption('#wallPart', 'takedown'); await settle(page, 250);
await printCount();
ok(/Tides \(6 cards\)/.test(await printText()), 'and the take-down list has all six');

/* ── the self-quiz reads a card aloud (Path 19 P5) ── */
await page.fill('#wordInput', WORDS); await page.dispatchEvent('#wordInput', 'input'); await settle(page, 250);
await mode('quiz');
ok(await page.isHidden('#hearBtn'), 'with no language chosen there is no Hear button');
await page.selectOption('#quizLang', 'es-ES'); await settle(page, 250);
ok(/no es-ES voice/.test(await page.textContent('#quizLangNote')), 'with no Spanish voice the page says so');
await page.click('#hearBtn');
eq(await page.evaluate(() => window.__said), [['tide', 'es-ES']], 'Hear says the term showing');
await page.click('.quiz-card'); await settle(page, 200);
await page.click('#hearBtn');
eq(await page.evaluate(() => window.__said[1]), ['the rise and fall of the sea', 'es-ES'], 'and, flipped, the definition');
eq(await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Shorelines')).study.speakLang), 'es-ES', 'the choice is kept with the list');
await page.evaluate(() => { window.__voices = [{ lang: 'es_MX', name: 'v' }]; });
await page.selectOption('#quizLang', 'fr-FR'); await page.selectOption('#quizLang', 'es-ES'); await settle(page, 250);
eq(await page.textContent('#quizLangNote'), '', 'with a Spanish voice there is no warning');
await page.selectOption('#quizLang', ''); await settle(page, 250);
ok(await page.isHidden('#hearBtn'), 'Off removes the button');
// a list given a language in Word Lists starts there, without writing a study field
await page.evaluate(() => { WordList.setLang('Shorelines', 'fr'); });
await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Shorelines')); delete st.study; localStorage.setItem('gvb-vocab-flashcards:data:Shorelines', JSON.stringify(st)); });
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 400);
await mode('quiz');
eq(await page.inputValue('#quizLang'), 'fr-FR', "a list with a language in Word Lists starts the quiz in it");
ok(await page.evaluate(() => !('study' in JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Shorelines')))), 'and that choice is not written until the teacher makes one');

/* ── the controls of each new tab are accessible (the sitewide sweep sees only the tab at rest) ── */
for (const m of ['frayer', 'cloze', 'schedule', 'wallsystem']) {
  await mode(m);
  const v = await a11yScan(page, { impact: 'serious' });
  eq(v.map((x) => x.id + ' ' + x.nodes.join('|')), [], `${m}: no serious or critical accessibility violation`);
}

/* ── an empty list, and the other tabs still work ── */
await page.fill('#wordInput', ''); await page.dispatchEvent('#wordInput', 'input'); await settle(page, 250);
for (const m of ['frayer', 'cloze', 'schedule', 'wallsystem']) {
  await mode(m);
  ok(/Add some words to preview/.test(await page.textContent('#previewArea')), `${m}: an empty list says so`);
}
await page.fill('#wordInput', 'Ox: a large animal'); await page.dispatchEvent('#wordInput', 'input'); await settle(page, 250);
await mode('cloze');
let d2 = null; page.once('dialog', (d) => { d2 = d.message(); });
await page.click('#printBtn'); await settle(page, 200);
ok(d2 && /at least 2 words/.test(d2), 'cloze with one word refuses and says why');

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 5)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 5)));
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
