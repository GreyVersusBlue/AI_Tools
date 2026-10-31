// smoke-library.mjs — 029's prompt library on the real page.
//   node Tools/prompt-builder/test/smoke-library.mjs     (port 8628)
//
// Held here: every entry loads a full form state and builds a prompt; the teacher's own
// name, grade, subject and class survive a load while the task fields are replaced; an
// entry written for the library leaves its {{blanks}} visible and opens the Placeholders
// panel; the page's own examples load through the library exactly as their buttons do;
// the filter narrows by task; loading stores only what the page already stored (the draft
// and the mode, no new key); 360 px and axe.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8628;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/029-prompt-builder.html';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

const keys = () => page.evaluate(() => Object.keys(localStorage).sort());
const out = () => page.textContent('#promptOutput');
const val = (id) => page.inputValue('#' + id);
const entryBtn = (id) => page.locator(`.lib-entry[data-entry="${id}"] button`);

console.log('Prompt Builder — task library');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
const keysBefore = await keys();

/* 1. closed at first; opens; groups and entries */
ok(!(await page.isVisible('#libraryPanel')), 'the library is closed at first');
eq(await page.getAttribute('#libraryBtn', 'aria-expanded'), 'false', 'and the button says so');
await page.click('#libraryBtn');
ok(await page.isVisible('#libraryPanel'), 'the button opens it');
eq(await page.getAttribute('#libraryBtn', 'aria-expanded'), 'true', 'and says it is open');
eq(await page.evaluate(() => document.activeElement && document.activeElement.id), 'libFilter', 'focus goes to the filter');
eq(await page.locator('.lib-group h4').allTextContents(),
  ['Plan and teach', 'Assess and give feedback', 'Reach every learner', 'Talk with families', 'Make content for other tools on this site'], 'the groups are the teaching tasks, in order');
const total = await page.locator('.lib-entry').count();
eq(total, 13, 'thirteen entries');
eq(await keys(), keysBefore, 'building and opening the library stored nothing');

/* 2. the teacher's own context survives; task fields are replaced */
await page.fill('#name', 'Pat Example');
await page.fill('#grade', '7th');
await page.fill('#subject', 'Science');
await page.fill('#extra', 'old extra text');
await page.fill('#topic', 'old topic');
await entryBtn('feedbackBank').click();
await settle(page, 200);
eq([await val('name'), await val('grade'), await val('subject')], ['Pat Example', '7th', 'Science'], 'name, grade and subject stay');
eq(await val('topic'), '{{assignment}}', 'the topic is the entry\'s blank');
eq(await val('extra'), '', 'a field the entry does not set is cleared');
ok((await out()).includes('{{assignment}}'), 'the blank is visible in the prompt, not hidden');
ok(await page.isVisible('#tokenPanel'), 'the Placeholders panel opens for an entry with blanks');
ok(/Loaded .Feedback comment bank.\. Fill in: assignment type, assignment, what the work should show/.test(await page.textContent('#libStatus')), 'the status names the entry and its blanks');

/* 3. fill the blanks and the prompt uses them */
await page.fill('#tokenPanel input[data-token="assignment"]', 'Lab report');
await settle(page, 150);
ok((await out()).includes('Lab report') && !(await out()).includes('{{assignment}}'), 'a filled blank is replaced in the output');
ok((await out()).includes('{{assignment type}}'), 'and a blank left alone stays visible');

/* 4. every entry loads and builds */
const ids = await page.locator('.lib-entry').evaluateAll(els => els.map(e => e.dataset.entry));
const bad = [];
for (const id of ids) {
  await entryBtn(id).click();
  await settle(page, 120);
  const o = (await out()).trim();
  const status = await page.textContent('#libStatus');
  if (!o || /your prompt builds itself here/.test(o) || !status.includes('Loaded')) bad.push(id);
  if ((await val('name')) !== 'Pat Example') bad.push(id + ':name');
}
eq(bad, [], 'every entry loads a form that builds a prompt, with the teacher\'s name intact');

/* 5. the page's own examples load the same way through the library */
async function fresh() { await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300); }
for (const [libId, presetKey] of [['lesson', 'lesson'], ['quiz', 'quiz'], ['reviewBoard', 'reviewBoard']]) {
  await fresh();
  await page.click(`.preset-btn[data-preset="${presetKey}"]`);
  await settle(page, 150);
  const viaButton = await out();
  await fresh();
  await page.click('#libraryBtn');
  await entryBtn(libId).click();
  await settle(page, 150);
  eq(await out(), viaButton, `${libId}: the library gives the same prompt as the example button`);
}

/* 6. filter */
await fresh();
await page.click('#libraryBtn');
await page.fill('#libFilter', 'famil');
const shown = await page.locator('.lib-entry:visible').evaluateAll(els => els.map(e => e.dataset.entry));
eq(shown, ['email', 'familyTranslation', 'difficultConversation'], 'the filter narrows to one task');
eq(await page.locator('.lib-group:visible').count(), 1, 'and hides the groups with nothing left');
await page.fill('#libFilter', 'zzzz');
ok(await page.isVisible('#libEmpty'), 'no match says so');
await page.fill('#libFilter', '');
eq(await page.locator('.lib-entry:visible').count(), 13, 'clearing the filter shows everything');
ok(!(await page.isVisible('#libEmpty')), 'and hides the message');

/* 7. storage: only what the page already kept */
await entryBtn('accommodationIdeas').click();
await settle(page, 700);
const after = await keys();
ok(after.every(k => /^promptBuilder/.test(k) || k === 'gvb-a11y-prefs'), 'only the existing Prompt Builder keys are written: ' + JSON.stringify(after));
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await val('topic'), '{{the task or lesson}}', 'the loaded entry survives a reload as the draft');

/* 8. 360 px, axe, console */
await page.setViewportSize({ width: 360, height: 800 });
await page.click('#libraryBtn');
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll at 360 px');
await page.fill('#topic', '{{a very long placeholder name that used to push the whole page sideways at phone width}}');
await settle(page, 200);
ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360), 'a long placeholder name wraps instead of widening the page at 360 px');
ok(await page.evaluate(() => Array.from(document.querySelectorAll('.token-grid label')).every(l => l.scrollWidth <= l.clientWidth + 1)), 'and the long name wraps inside its own cell, not over the input');
for (const theme of ['light', 'dark']) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  const v = await a11yScan(page, { impact: 'serious', include: '#libraryPanel' });
  eq(v.map(x => x.id), [], `axe is clean on the library in ${theme}`);
}
ok(page.__errs.length === 0, 'no console errors: ' + JSON.stringify(page.__errs));

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
