// smoke-placeholders.mjs — {{placeholder}} tokens in the Prompt Builder.
//
//   node Tools/prompt-builder/test/smoke-placeholders.mjs
//
// A saved preset is this tool's "saved prompt", and what stops one being
// reused next unit is that the topic, the standard and the text are baked
// into it. Writing {{topic}} in a field instead makes the preset a template.
//
// The load-bearing decision, and the thing this pins hardest: substitution
// happens on the way OUT, in fill(), and never on the way in. The fields keep
// the placeholder. Substituting into the fields would work exactly once and
// then quietly turn a template back into a one-off — the failure would be
// invisible until the next unit, when the preset came back with last month's
// topic already in it.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8208;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/029-prompt-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1050 });

console.log('Prompt Builder — {{placeholder}} tokens');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

const promptText = () => page.textContent('#promptOutput');
const tokenInputs = () => page.$$eval('#tokenGrid input[data-token]',
  els => els.map(e => [e.getAttribute('data-token'), e.value]));

/* ── nothing until a placeholder is written ────────────────────────────── */
await page.fill('#grade', '7th');
await page.fill('#subject', 'Social Studies');
await settle(page, 400);
ok(!(await page.isVisible('#tokenPanel')), 'the panel stays out of the way of a prompt with no placeholders in it');

/* ── one placeholder, used in two fields ───────────────────────────────── */
await page.fill('#topic', '{{topic}}');
await page.fill('#objective', 'students can explain why {{topic}} mattered');
await settle(page, 500);
ok(await page.isVisible('#tokenPanel'), 'writing a placeholder opens the panel');
eq((await tokenInputs()).length, 1, 'two fields using the same placeholder ask for it once, not twice');
eq((await tokenInputs())[0][0], 'topic', 'and it is the one that was written');

const before = await promptText();
ok(before.includes('{{topic}}'),
   'an unfilled placeholder stays visible in the prompt rather than leaving a silent hole: ' + before.slice(0, 90));
eq(await page.$$eval('#promptOutput .token-blank', e => e.length), 2,
   'marked in both places it appears, so what is outstanding is obvious');
ok(/1 placeholder still to fill/.test(await page.textContent('#tokenLeft')),
   'and counted: ' + await page.textContent('#tokenLeft'));

/* ── filling it in ─────────────────────────────────────────────────────── */
await page.fill('#tokenGrid input[data-token="topic"]', 'the Nile');
await settle(page, 500);
const after = await promptText();
ok(!after.includes('{{topic}}'), 'filling it in substitutes it everywhere');
eq((after.match(/the Nile/g) || []).length, 2, 'in both of the fields that used it');
eq(await page.$$eval('#promptOutput .token-blank', e => e.length), 0, 'with nothing left marked as outstanding');
ok(!(await page.isVisible('#tokenLeft')), 'and the outstanding count disappears');

/* THE point of the feature: the fields still hold the placeholder. */
eq(await page.inputValue('#topic'), '{{topic}}',
   'the field itself still holds the placeholder — substituting into it would work once and then destroy the template');
eq(await page.inputValue('#objective'), 'students can explain why {{topic}} mattered',
   'in every field that used it');

/* ── typing a value must not rebuild the box being typed into ──────────── */
await page.click('#tokenGrid input[data-token="topic"]');
await page.keyboard.type(' delta');
await settle(page, 400);
eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-token')), 'topic',
   'the input keeps focus while it is being typed into — the panel is only rebuilt when the SET of placeholders changes');
ok((await promptText()).includes('the Nile delta'), 'and every keystroke reaches the prompt');

/* ── a second placeholder joins the first ──────────────────────────────── */
await page.fill('#avoidInclude', 'do not mention {{avoid}}');
await settle(page, 500);
eq((await tokenInputs()).length, 2, 'a new placeholder adds a row');
eq((await tokenInputs()).filter(t => t[0] === 'topic')[0][1], 'the Nile delta',
   'and the value already typed for the first one survives the rebuild');

/* ── spelling and spacing do not split a blank in two ──────────────────── */
await page.fill('#extra', 'Tie it back to {{ Topic }} at the end.');
await settle(page, 500);
eq((await tokenInputs()).length, 2,
   '{{ Topic }} and {{topic}} are one blank — case and spacing must not split it into two questions');
ok((await promptText()).includes('Tie it back to the Nile delta'),
   'and the already-typed value fills the variant spelling too');

/* ── it all survives a reload ──────────────────────────────────────────── */
await settle(page, 700);   // the draft save is debounced
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 700);
eq(await page.inputValue('#topic'), '{{topic}}', 'the placeholder is still in the field after a reload');
eq((await tokenInputs()).filter(t => t[0] === 'topic')[0][1], 'the Nile delta',
   'and the value typed for it comes back too');
ok((await promptText()).includes('the Nile delta'), 'so the built prompt is where it was left');

/* ── a preset is the template, not the answers ─────────────────────────── */
/* Carrying the filled values into a preset would defeat the whole thing: the
   preset would come back next unit with last month's topic already in it. */
page.once('dialog', d => d.accept('Unit template'));
await page.click('#savePresetBtn');
await settle(page, 500);
const preset = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('promptBuilderCustomPresets_v1'))[0]; } catch (e) { return null; }
});
ok(preset, 'the preset saved');
eq(preset.data.topic, '{{topic}}', 'a preset stores the placeholder, which is what makes it reusable');
ok(!('tokens' in preset.data), 'and not this unit’s answers');

await page.click('#tokenGrid input[data-token="topic"]');
await page.fill('#tokenGrid input[data-token="topic"]', '');
await settle(page, 400);
ok((await promptText()).includes('{{topic}}'),
   'clearing a value puts the placeholder back on show rather than leaving a gap');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
