// smoke-prompt-sets.mjs — per-target-language prompt sets in a real browser.
//
//   node Tools/picture-prompt-generator/test/smoke-prompt-sets.mjs
//
// The tool used to hold one flat prompt list, so the projected and printed
// task wording was whatever language that list happened to be in. It now holds
// named sets — English, Spanish, French, German, Italian, Latin and a newcomer
// set ship as starters — and the active set drives the stage, the pin, and the
// printed cards alike. What this suite holds down:
//
//   The starter libraries are really there and really switch. Picking Spanish
//   replaces the editable prompt rows and the projected task text.
//
//   Pins are per set. A prompt pinned to a photo in one language must not
//   follow that photo into another language, and must still be there when the
//   teacher switches back.
//
//   The migration off `ppg_prompts_v1`. A teacher who typed their own prompts
//   under the old one-list schema keeps them, as their own set, with their
//   pins intact — a year of edits must not vanish on upgrade.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// The PNG fixture helper is imported from the Image → PDF suite rather than
// copied; it is the repo's one hand-rolled PNG encoder for tests.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { makeSolidPng } from '../../image-to-pdf/test/make-fixtures.mjs';

const PORT = 8171;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/071-picture-prompt-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

/** Answers the next window.prompt/confirm with `value`, once. */
async function answerOnce(value) {
  await page.evaluate(v => {
    const realPrompt = window.prompt, realConfirm = window.confirm;
    window.prompt = function () { window.prompt = realPrompt; return v; };
    window.confirm = function () { window.confirm = realConfirm; return v !== null && v !== false; };
  }, value);
}

const setNames = () => page.evaluate(() =>
  Array.from(document.getElementById('promptSetSelect').options).map(o => o.textContent));
const promptTexts = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#promptsWrap input[data-prompt]')).map(i => i.value));
const stageTask = () => page.evaluate(() => {
  const el = document.querySelector('#stageCard .task-text');
  return el ? el.textContent : '';
});
const storedImages = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppg_images_v1') || '[]'));

const png = makeSolidPng(80, 60, [30, 90, 160]);
const upload = () => page.setInputFiles('#imageInput', { name: 'scene.png', mimeType: 'image/png', buffer: png });

console.log('Picture-Prompt Generator — prompt sets by target language');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. the starter libraries ship, English first ────────────────────────── */
const names = await setNames();
eq(names.length, 7, 'seven starter prompt sets are offered');
ok(names.some(n => /Spanish/.test(n)) && names.some(n => /French/.test(n)) &&
   names.some(n => /German/.test(n)) && names.some(n => /Italian/.test(n)) &&
   names.some(n => /Latin/.test(n)) && names.some(n => /Newcomer/.test(n)),
   'the six target-language sets are all present: ' + JSON.stringify(names));
eq(await page.inputValue('#promptSetSelect'), 'en', 'a first run opens on the English set');
const enPrompts = await promptTexts();
eq(enPrompts.length, 6, 'the English set has its six prompts');
ok(/^Describe what you see/.test(enPrompts[0]), 'the English prompts are in English');

/* ── 2. switching set switches the editable prompts ──────────────────────── */
await page.selectOption('#promptSetSelect', 'es');
await settle(page);
const esPrompts = await promptTexts();
eq(esPrompts.length, 6, 'the Spanish set has its six prompts');
ok(/^Describe lo que ves/.test(esPrompts[0]), 'the Spanish prompts are in Spanish: ' + JSON.stringify(esPrompts[0]));

/* ── 3. the projected task text follows the active set ───────────────────── */
await upload();
await settle(page, 400);
await page.click('#newImageBtn');
await settle(page);
const projectedEs = await stageTask();
ok(esPrompts.includes(projectedEs), 'the projected task is one of the Spanish prompts: ' + JSON.stringify(projectedEs));

await page.selectOption('#promptSetSelect', 'fr');
await settle(page);
const frPrompts = await promptTexts();
const projectedFr = await stageTask();
ok(frPrompts.includes(projectedFr), 'switching to French re-words the projected task without a new pick');
ok(projectedFr !== projectedEs, 'the stage did not keep the Spanish wording');

/* ── 4. pins live in the set they were made in ───────────────────────────── */
await page.click('#pinPromptBtn');
await settle(page);
const pinnedFr = await stageTask();
ok(/Pinned to this image/.test(await page.textContent('#pinPromptBtn')), 'the French prompt pins to the photo');

await page.selectOption('#promptSetSelect', 'es');
await settle(page);
ok(!/Pinned to this image/.test(await page.textContent('#pinPromptBtn')), 'the French pin does not follow the photo into Spanish');

await page.selectOption('#promptSetSelect', 'fr');
await settle(page);
eq(await stageTask(), pinnedFr, 'switching back to French restores the pinned prompt');

const pins = (await storedImages())[0].pinnedPrompts;
eq(Object.keys(pins).join(','), 'fr', 'exactly one set holds a pin for that photo');

/* ── 5. printed cards use the active set ─────────────────────────────────── */
await page.evaluate(() => { window.print = function () {}; });
await page.selectOption('#promptSetSelect', 'de');
await settle(page);
const dePrompts = await promptTexts();
await page.click('#printBtn');
await settle(page);
const printed = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .ptext')).map(e => e.textContent));
eq(printed.length, 1, 'one card prints for the one uploaded photo');
ok(dePrompts.includes(printed[0]), 'the printed card carries a German prompt: ' + JSON.stringify(printed[0]));

/* ── 6. an edit stays in its own set, and survives a reload ──────────────── */
await page.fill('#promptsWrap input[data-prompt]', 'Beschreibe das Wetter auf dem Bild.');
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#promptSetSelect'), 'de', 'the active set is remembered across a reload');
eq((await promptTexts())[0], 'Beschreibe das Wetter auf dem Bild.', 'the edit came back');
await page.selectOption('#promptSetSelect', 'en');
await settle(page);
ok(/^Describe what you see/.test((await promptTexts())[0]), 'the English set was untouched by the German edit');

/* ── 7. a custom set, then deleting it ───────────────────────────────────── */
await answerOnce('Spanish 2 — past tense');
await page.click('#newSetBtn');
await settle(page);
eq((await setNames()).length, 8, 'a custom set is added to the picker');
eq(await page.evaluate(() => document.querySelectorAll('#promptsWrap input[data-prompt]').length), 0, 'a new custom set starts empty');
ok(await page.evaluate(() => document.getElementById('restoreSetBtn').disabled), 'a custom set has no starter prompts to restore to');

await answerOnce(true);
await page.click('#deleteSetBtn');
await settle(page);
eq((await setNames()).length, 7, 'deleting the custom set puts the picker back');

/* ── 8. restoring a starter set after an edit ────────────────────────────── */
await page.selectOption('#promptSetSelect', 'de');
await settle(page);
await answerOnce(true);
await page.click('#restoreSetBtn');
await settle(page);
ok(/^Beschreibe so genau wie möglich/.test((await promptTexts())[0]), 'Restore starter prompts puts the shipped German wording back');

/* ── 9. migration off the old one-list schema ────────────────────────────── */
const migrate = await prepPage(browser, BASE, { width: 1280, height: 900 });
await migrate.goto(URL_PAGE, { waitUntil: 'networkidle' });
await migrate.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('ppg_prompts_v1', JSON.stringify([
    { id: 'p1', text: 'Describe the trench in three sentences.' },
    { id: 'p2', text: 'What does this poster want you to believe?' }
  ]));
  localStorage.setItem('ppg_images_v1', JSON.stringify([
    { id: 'i1', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', pinnedPromptId: 'p2' }
  ]));
});
await migrate.reload({ waitUntil: 'networkidle' });
await settle(migrate);

const migratedSets = await migrate.evaluate(() => JSON.parse(localStorage.getItem('ppg_prompt_sets_v1')));
eq(migratedSets.activeId, 'my-prompts', 'the teacher\'s own prompts stay the active set after the upgrade');
eq(migratedSets.sets[0].prompts.map(p => p.text).join(' | '),
   'Describe the trench in three sentences. | What does this poster want you to believe?',
   'both hand-written prompts survived the migration');
ok(migratedSets.sets.some(s => s.id === 'es'), 'the starter languages are added alongside them');
eq(await migrate.evaluate(() => JSON.parse(localStorage.getItem('ppg_images_v1'))[0].pinnedPrompts['my-prompts']),
   'p2', 'the old single pin was rehomed onto the migrated set');
eq(await migrate.evaluate(() => localStorage.getItem('ppg_prompts_v1')), null, 'the old key is retired once it has been read');

/* an untouched default list is recognised as the English starter, not cloned */
const clean = await prepPage(browser, BASE, { width: 1280, height: 900 });
await clean.goto(URL_PAGE, { waitUntil: 'networkidle' });
await clean.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('ppg_prompts_v1', JSON.stringify([
    { id: 'd1', text: 'Describe what you see in as much detail as possible.' },
    { id: 'd2', text: 'What is happening in this picture? Use at least three verbs.' },
    { id: 'd3', text: 'Write five sentences about this image.' },
    { id: 'd4', text: 'Who might be in this picture, and what are they doing?' },
    { id: 'd5', text: 'Describe the colors, shapes, and objects you notice.' },
    { id: 'd6', text: 'Imagine you are inside this picture. What do you hear, smell, and feel?' }
  ]));
});
await clean.reload({ waitUntil: 'networkidle' });
await settle(clean);
eq(await clean.evaluate(() => JSON.parse(localStorage.getItem('ppg_prompt_sets_v1')).sets.length), 7,
   'a never-edited default list becomes the English starter rather than an eighth set');
eq(await clean.evaluate(() => JSON.parse(localStorage.getItem('ppg_prompt_sets_v1')).activeId), 'en',
   'and it opens on English');

/* ── 10. no console noise anywhere in the run ────────────────────────────── */
for (const [label, p] of [['main', page], ['migration', migrate], ['clean', clean]]) {
  eq(p.__errs.length, 0, `no page/console errors on the ${label} page: ` + JSON.stringify(p.__errs));
  eq(p.__blocked.length, 0, `nothing left the site from the ${label} page: ` + JSON.stringify(p.__blocked));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
