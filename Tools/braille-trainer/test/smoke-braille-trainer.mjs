// smoke-braille-trainer.mjs — 088 Braille Reading Trainer in a real browser.
//
//   node Tools/braille-trainer/test/smoke-braille-trainer.mjs
//
// Plays the first lesson to the end by keyboard (answering from the page's
// read-only test hook), proves a wrong answer comes back at the end of the
// lesson, reloads to prove the lesson, XP and sign records were saved, tests
// out of the alphabet, runs a review and a sprint, opens the reading room from
// a seeded state and times a passage with a peek, renders the sign list and the
// translator, and runs axe on the lesson, the reader and the path.
//
// Exits 1 on any failure.

/* global __brailleTrainer -- the page's read-only test hook */
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8460;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/088-braille-reading-trainer.html';
const KEY = 'braille-trainer:state';

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

console.log('Braille Reading Trainer — smoke');

await page.goto(URL_PAGE);
await page.evaluate(() => localStorage.clear());
await page.reload();
await settle(page);

const st = () => page.evaluate(() => __brailleTrainer.state());
const cur = () => page.evaluate(() => __brailleTrainer.run());
const DOTKEYS = 'fdsjkl';

// Answers the current exercise by keyboard; `wrong` answers it wrong.
async function answer(wrong) {
  const r = await cur();
  if (!r) return false;
  const ex = r.ex;
  if (ex.type === 'learn') { await page.keyboard.press('Enter'); return true; }
  if (ex.type === 'dots') {
    const mask = await page.evaluate((a) => window.BrailleCore.cells(a)[0], ex.answer);
    const want = wrong ? (mask ^ 32) : mask;
    for (let i = 0; i < 6; i++) if (want & (1 << i)) await page.keyboard.press(DOTKEYS[i]);
  } else if (ex.type === 'readWord') {
    await page.fill('#typeIn', wrong ? ex.text + 'q' : ex.text.toUpperCase());
  } else {
    const k = ex.options.indexOf(ex.answer);
    await page.keyboard.press(String((wrong ? (k + 1) % ex.options.length : k) + 1));
  }
  await page.keyboard.press('Enter');
  if (!(await page.locator('#viewLesson').isVisible())) return false;
  await page.keyboard.press('Enter');
  return true;
}

// ── first visit ──────────────────────────────────────────────────────
ok(await page.locator('#continueText').textContent().then((s) => s.startsWith('Start here')), 'first visit says start here');
eq(await page.locator('.unit').count(), 22, 'twenty-two units on the path');
ok(await page.locator('.lesson-btn').first().isEnabled(), 'first lesson is open');
ok(await page.locator('.lesson-btn').nth(1).isDisabled(), 'second lesson is locked');
ok(await page.locator('#practiceLocked').isHidden(), 'practice tab not shown yet');

// ── first lesson, with one deliberate miss ───────────────────────────
await page.click('#continueBtn');
await settle(page);
eq((await cur()).ex.type, 'learn', 'a lesson opens on a new sign');
ok(await page.locator('#exStage .numbered').isVisible(), 'the new sign shows numbered dots');
const scan1 = await a11yScan(page);
eq(scan1.map((v) => v.id), [], 'axe: lesson card');
await answer(false);
// Answer the first quiz question wrong.
const before = await page.evaluate(() => __brailleTrainer.run().ex);
const lengthBefore = await page.evaluate(() => document.querySelector('#bar').getAttribute('aria-valuenow'));
await (async () => {
  const ex = before;
  const k = ex.options.indexOf(ex.answer);
  await page.keyboard.press(String(((k + 1) % ex.options.length) + 1));
  await page.keyboard.press('Enter');
})();
ok(await page.locator('#feedback.bad').isVisible(), 'a wrong answer says so');
ok(await page.locator('.opt.right').count() === 1, 'and marks the right option');
await page.keyboard.press('Enter');
ok(lengthBefore !== null, 'progress bar has a value');
let guard = 0;
while ((await cur()) && guard++ < 80) await answer(false);
ok(guard < 80, 'the lesson ends');
ok(await page.locator('#viewResult').isVisible(), 'results show at the end');
eq(await page.locator('#resultH').textContent(), 'Lesson complete!', 'lesson complete');
let s = await st();
ok(s.done['u1-1'], 'lesson 1 recorded as done');
ok(s.xp >= 10, 'XP awarded');
const missedId = before.item;
ok(s.items[missedId] && s.items[missedId].n >= 2 && s.items[missedId].ok >= 1, 'the missed sign came back and was answered');
ok(await page.locator('#resultSlow figure').count() >= 1, 'results list the missed sign');

// ── saved across a reload ────────────────────────────────────────────
await page.reload();
await settle(page);
s = await st();
ok(s.done['u1-1'] && s.xp >= 10, 'progress survives a reload');
ok(await page.locator('.lesson-btn').nth(1).isEnabled(), 'lesson 2 unlocked');
ok((await page.locator('#continueText').textContent()).startsWith('Next up'), 'continue offers the next lesson');
eq(await page.locator('#statSigns').textContent(), '3', 'three signs learned');

// ── test out of the alphabet ─────────────────────────────────────────
const testOut = page.locator('.unit').nth(5).locator('.test-out');
ok(await testOut.isVisible(), 'locked units offer a test-out');
await testOut.click();
await settle(page);
guard = 0;
while ((await cur()) && guard++ < 30) await answer(false);
eq(await page.locator('#resultH').textContent(), 'Passed!', 'test-out passes with right answers');
s = await st();
ok(s.done['u6-r'] && s.done['u2-1'], 'test-out marks the alphabet done');
ok(!s.done['u7-1'], 'and nothing after it');
await page.click('#resultBack');

// ── practice: review and sprint ──────────────────────────────────────
await page.click('nav.tabs button[data-view="practice"]');
ok(await page.locator('#reviewBtn').isEnabled(), 'review is available');
await page.click('#reviewBtn');
await settle(page);
guard = 0;
while ((await cur()) && guard++ < 60) await answer(false);
eq(await page.locator('#resultH').textContent(), 'Practice complete', 'review completes');
await page.click('#resultBack');
await page.clock.install();
await page.click('#sprintBtn');
for (let i = 0; i < 5; i++) {
  const ex = (await cur()).ex;
  await page.keyboard.press(String(ex.options.indexOf(ex.answer) + 1));
  await page.clock.runFor(300);
}
await page.clock.runFor(61000);
await settle(page);
ok((await page.locator('#resultH').textContent()).endsWith('right in 60 seconds'), 'sprint ends after a minute');
ok((await st()).sprint.best >= 5, 'sprint best saved');
await page.click('#resultBack');

// ── reading room ─────────────────────────────────────────────────────
await page.click('nav.tabs button[data-view="read"]');
ok(await page.locator('#readLocked').isVisible(), 'reading room locked before punctuation');
await page.evaluate((key) => {
  const s = JSON.parse(localStorage.getItem(key));
  for (const l of window.BrailleCore.LESSONS) { s.done[l.id] = true; if (l.id === 'u10-r') break; }
  localStorage.setItem(key, JSON.stringify(s));
}, KEY);
await page.reload();
await settle(page);
await page.click('nav.tabs button[data-view="read"]');
ok(await page.locator('#readOpen').isVisible(), 'reading room open after punctuation');
eq(await page.locator('.passage-row').count(), 10, 'ten passages');
await page.locator('.passage-row button').first().click();
ok(await page.locator('.reader-cover').isVisible(), 'passage hidden until start');
await page.click('#readerGo');
const words = await page.locator('#readerPage button.bw').count();
eq(words, 41, 'the first passage draws 41 words');
// "…The cat did not want to move." With the letter words learned, "not" is one cell.
eq(await page.locator('#readerPage button.bw').nth(14).locator('.bcell').count(), 1, 'contracted as far as learned');
await page.locator('#readerPage button.bw').nth(1).click();
eq(await page.locator('#readerPage .peek').first().textContent(), 'cat', 'a peek shows the print word');
eq(await page.locator('#readerPeeks').textContent(), '1 peek', 'peeks counted');
const scan2 = await a11yScan(page);
eq(scan2.map((v) => v.id), [], 'axe: reader');
await page.click('#readerGo');
ok(/words per minute, 1 peek/.test(await page.locator('#readerResult').textContent()), 'finishing shows the rate');
ok(await page.locator('#readerPrintText').isVisible(), 'and the print text');
s = await st();
ok(s.reading.p1 && s.reading.p1.times === 1 && s.reading.p1.best > 0, 'reading score saved');
await page.click('#readerBack');
await page.selectOption('#readMode', 'grade1');
eq((await st()).settings.mode, 'grade1', 'mode saved');

// ── all signs and translate ──────────────────────────────────────────
await page.click('nav.tabs button[data-view="signs"]');
eq(await page.locator('.sign').count(), 212, 'every sign listed');
await page.check('#signsLearned');
ok(await page.locator('.sign').count() < 212, 'filter to learned signs');
await page.fill('#trIn', 'the');
eq(await page.locator('#trOut .bcell').count(), 1, '"the" translates to one cell');

await page.click('nav.tabs button[data-view="path"]');
const scan3 = await a11yScan(page);
eq(scan3.map((v) => v.id), [], 'axe: path');

eq(errors, [], 'no page errors');

await browser.close();
server.close();
console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
