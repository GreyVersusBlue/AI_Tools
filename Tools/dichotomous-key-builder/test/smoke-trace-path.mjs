// smoke-trace-path.mjs — walking a specimen through the key.
//
//   node Tools/dichotomous-key-builder/test/smoke-trace-path.mjs
//
// The couplet descriptions are free text, so nothing can decide on its own
// whether "has a backbone" is true of a given specimen — the teacher answers
// each couplet as their specimen would. What the tool contributes is
// following the links: remembering the route, highlighting it in the steps
// list, and stopping with a reason. What this suite holds down:
//
//   The three ways a route can end. A named result, a dead end (leads
//   nowhere and names nothing), and a loop back to a step already visited —
//   the last two being exactly the authoring mistakes a teacher does not
//   catch by eye and a class catches immediately.
//
//   The route survives editing, or gets truncated honestly. Changing a
//   "leads to" or deleting a step can strand a recorded route halfway; it is
//   re-walked against the current key on every render rather than left
//   pointing at couplets that no longer connect.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8157;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/057-dichotomous-key-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });

const crumbs = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#traceWrap .crumb')).map(c => c.textContent).join('→'));
const choices = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#traceWrap .trace-choice')).map(b => b.textContent.trim()));
const outcome = () => page.evaluate(() => {
  const el = document.querySelector('#traceWrap .trace-outcome');
  return el ? { good: el.classList.contains('good'), text: el.textContent.replace(/\s+/g, ' ').trim() } : null;
});
const highlighted = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#stepsWrap .choice-row.on-path'))
    .map(r => r.querySelector('.letter').textContent.replace('.', '')));
const pick = letter => page.click(`#traceWrap .trace-choice[data-pick="${letter}"]`);

console.log('Dichotomous Key Builder — walk a specimen through the key');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. the walk starts at step 1 and offers its two couplets ────────────── */
eq(await crumbs(), '', 'no route recorded before anything is picked');
const start = await choices();
eq(start.length, 2, 'step 1 offers both of its couplets');
ok(/^1a\./.test(start[0]) && /Has a backbone/.test(start[0]), 'the first couplet is shown with its number: ' + JSON.stringify(start[0]));
eq((await highlighted()).length, 0, 'nothing is highlighted yet');

/* ── 2. a route that reaches a named result ──────────────────────────────── */
await pick('a');                       // has a backbone → step 2
await settle(page);
eq(await crumbs(), '1a', 'the first choice is recorded');
eq((await highlighted()).join(','), '1a', 'and highlighted in the steps list');
ok((await choices())[0].includes('Has fur'), 'the walk advanced to step 2');

await pick('a');                       // has fur → Mammal
await settle(page);
eq(await crumbs(), '1a→2a', 'the whole route is shown');
eq((await highlighted()).join(','), '1a,2a', 'both couplets are highlighted');
const mammal = await outcome();
ok(mammal.good, 'reaching a result reads as a good outcome');
ok(/Ends at: Mammal/.test(mammal.text), 'and names the result: ' + JSON.stringify(mammal.text));
ok(/Dog, Whale/.test(mammal.text), 'along with the example specimens tagged under it');

/* ── 3. back and start over ──────────────────────────────────────────────── */
await page.click('#traceBackBtn');
await settle(page);
eq(await crumbs(), '1a', 'Back drops the last couplet');
eq((await choices()).length, 2, 'and puts the walk back on step 2');
await page.click('#traceResetBtn');
await settle(page);
eq(await crumbs(), '', 'Start over clears the route');
eq((await highlighted()).length, 0, 'and the highlight with it');

/* ── 4. a result with no example specimens says so ───────────────────────── */
await pick('a'); await settle(page);
await pick('b'); await settle(page);   // "No fur" → Reptile, bird, fish, or amphibian
const noEx = await outcome();
ok(noEx.good, 'a named result is still a good outcome');
ok(/Snake, Robin/.test(noEx.text), 'this one does have examples');

/* ── 5. a dead end is caught ─────────────────────────────────────────────── */
await page.click('#traceResetBtn');
await settle(page);
await page.click('#addStepBtn');       // step 3: blank, no result, leads nowhere
await settle(page);
/* point 2b at the new blank step so the walk can reach it */
await page.selectOption('#stepsWrap .step-block:nth-of-type(2) .choice-row[data-choice="b"] select[data-field="leadsTo"]', { index: 2 });
await settle(page);
await pick('a'); await settle(page);
await pick('b'); await settle(page);
await pick('a'); await settle(page);
const dead = await outcome();
ok(dead && !dead.good, 'a dead end reads as a bad outcome');
ok(/dead end/.test(dead.text), 'and says so plainly: ' + JSON.stringify(dead.text));
eq(await crumbs(), '1a→2b→3a', 'the route that got there is shown');

/* ── 6. a loop is caught ─────────────────────────────────────────────────── */
await page.click('#traceResetBtn');
await settle(page);
/* send 3a back to step 1 */
await page.selectOption('#stepsWrap .step-block:nth-of-type(3) .choice-row[data-choice="a"] select[data-field="leadsTo"]', { index: 1 });
await settle(page);
await pick('a'); await settle(page);
await pick('b'); await settle(page);
await pick('a'); await settle(page);
const loop = await outcome();
ok(loop && !loop.good, 'a loop reads as a bad outcome');
ok(/leads back to step 1/.test(loop.text), 'and names the step it circles back to: ' + JSON.stringify(loop.text));

/* ── 7. editing the key re-walks the recorded route ──────────────────────── */
await page.click('#traceResetBtn');
await settle(page);
await pick('a'); await settle(page);
await pick('b'); await settle(page);
eq(await crumbs(), '1a→2b', 'a two-couplet route is recorded');
/* make 2b a final answer instead — the third couplet no longer follows */
await page.selectOption('#stepsWrap .step-block:nth-of-type(2) .choice-row[data-choice="b"] select[data-field="leadsTo"]', '');
await settle(page);
eq(await crumbs(), '1a→2b', 'the still-valid part of the route survives the edit');
eq((await highlighted()).join(','), '1a,2b', 'and stays highlighted');

await page.click('#stepsWrap .step-block:nth-of-type(1) [data-del-step]');
await settle(page);
eq(await crumbs(), '', 'deleting the step the route started from clears it rather than leaving it dangling');
eq((await highlighted()).length, 0, 'and clears the highlight');

/* ── 8. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
