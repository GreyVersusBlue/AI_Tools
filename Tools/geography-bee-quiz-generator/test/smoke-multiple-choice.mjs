// smoke-multiple-choice.mjs — multiple-choice quiz mode (SS demo round,
// backlog rank 29).
//
//   node Tools/geography-bee-quiz-generator/test/smoke-multiple-choice.mjs
//
// A geography bee is traditionally short-answer, but multiple choice turns
// the same bank into a quick formative check — as long as the wrong options
// are actually wrong, come from the same category (a France question with
// "Tokyo" as a distractor is useless), and the printed answer key genuinely
// matches what's on the paper above it. This suite checks the algorithm
// directly through the tool's own test hooks (window.__gbqTestHooks) for
// things that are hard to prove from rendered HTML alone — distractor
// sourcing and uniqueness across many trials, the thin-pool fallback — then
// drives the real UI for what a teacher actually sees: the projector
// display, the printed quiz + key, hidden-built-in exclusion, and
// settings persistence.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8221;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/062-geography-bee-quiz-generator.html';
const DISABLED_KEY = 'gbq_disabled_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, label) => eq(JSON.stringify(a), JSON.stringify(b), label);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Geography Bee Quiz Generator — multiple-choice mode');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 1. distractor sourcing and uniqueness, via the test hooks ─────────── */
/* A synthetic bank the hook is exercised against directly, so this part
   doesn't depend on the real 90-question content staying exactly as-is. */
const algo = await page.evaluate(() => {
  const H = window.__gbqTestHooks;
  const pool = [
    { category: 'capitals', a: 'Paris', q: 'q1' },
    { category: 'capitals', a: 'Tokyo', q: 'q2' },
    { category: 'capitals', a: 'Ottawa', q: 'q3' },
    { category: 'capitals', a: 'Cairo', q: 'q4' },
    { category: 'capitals', a: 'Seoul', q: 'q5' },
    { category: 'landmarks', a: 'Egypt', q: 'q6' },
    { category: 'landmarks', a: 'France', q: 'q7' },
    { category: 'lonely', a: 'Only Answer', q: 'q8' },   // sole member of its category
  ];
  const item = pool[0]; // Paris (capitals)
  const results = [];
  for (let i = 0; i < 60; i++) results.push(H.buildMcOptions(item, pool, Math.random));

  const allOk = results.every(opts => {
    if (!opts || opts.length < 2 || opts.length > 4) return false;
    const correct = opts.filter(o => o.correct);
    if (correct.length !== 1 || correct[0].text !== 'Paris') return false;
    const texts = opts.map(o => o.text.toLowerCase());
    if (new Set(texts).size !== texts.length) return false; // no duplicate option
    // every distractor must be an answer of another *capitals* question in the pool
    const validSourcePool = new Set(pool.filter(p => p.category === 'capitals' && p !== item).map(p => p.a));
    return opts.filter(o => !o.correct).every(o => validSourcePool.has(o.text));
  });

  const lonelyItem = pool[7];
  const lonelyResult = H.buildMcOptions(lonelyItem, pool, Math.random);

  // same seed -> same result, called twice independently
  const a1 = H.buildMcOptions(item, pool, H.makeRng(4242));
  const a2 = H.buildMcOptions(item, pool, H.makeRng(4242));

  return { allOk, lonelyResult, a1, a2 };
});
ok(algo.allOk, 'every generated option set: 1 correct answer, no duplicate options, distractors from the same category only (60 trials)');
eq(algo.lonelyResult, null, 'a question alone in its category gets no distractors (null, so the caller falls back to short answer)');
same(algo.a1, algo.a2, 'the same seed produces the identical option set both times');

/* ── 2. projector display renders A-D and reveal marks the right one ───── */
await page.selectOption('#categoryFilter', 'capitals');
await page.selectOption('#formatSelect', 'mc');
await page.click('#applyFilterBtn');
await settle(page, 250);

const mcOptsShown = await page.$eval('#displayOptions', el => !el.classList.contains('hidden'));
ok(mcOptsShown, 'multiple-choice options are visible under the question once the format is set to Multiple choice');

const optionCount = await page.$$eval('#displayOptions .mc-opt', els => els.length);
ok(optionCount >= 2 && optionCount <= 4, `2-4 lettered options are shown (got ${optionCount})`);

const lettersShown = await page.$$eval('#displayOptions .mc-letter', els => els.map(e => e.textContent));
same(lettersShown, ['A', 'B', 'C', 'D'].slice(0, optionCount), 'options are lettered A, B, C... in order');

// Reveal answer marks exactly one option correct and matches the text summary.
await page.click('#revealBtn');
await settle(page, 150);
const revealedInfo = await page.evaluate(() => {
  const opts = document.getElementById('displayOptions');
  const correctEls = opts.querySelectorAll('.mc-opt.correct');
  const revealed = opts.classList.contains('revealed');
  return { correctCount: correctEls.length, revealed, summary: document.getElementById('displayA').textContent, shown: document.getElementById('displayA').classList.contains('shown') };
});
eq(revealedInfo.correctCount, 1, 'exactly one option is marked correct');
ok(revealedInfo.revealed, 'the options container gets the revealed class so CSS highlights the correct one');
ok(revealedInfo.shown, 'the plain-text answer line also reveals');
ok(/^Correct answer: [A-D]\)/.test(revealedInfo.summary), 'and states which letter is correct: ' + revealedInfo.summary);

// Un-reveal, move to Prev/Next, and options regenerate without leaving stale state.
await page.click('#revealBtn');
await page.click('#nextBtn');
await settle(page, 150);
eq(await page.$eval('#displayA', el => el.classList.contains('shown')), false, 'moving to the next question re-hides the answer');
eq(await page.$eval('#displayOptions', el => el.classList.contains('revealed')), false, 'and clears the revealed highlight');

/* ── 3. short-answer mode is unaffected (regression) ────────────────────── */
await page.selectOption('#formatSelect', 'short');
await settle(page, 200);
eq(await page.$eval('#displayOptions', el => el.classList.contains('hidden')), true, 'switching back to Short answer hides the options list');
await page.click('#revealBtn');
await settle(page, 150);
const shortAnswerText = await page.textContent('#displayA');
ok(shortAnswerText.length > 0 && !/^Correct answer:/.test(shortAnswerText), 'short-answer reveal shows the plain answer text, not the MC summary');
await page.click('#revealBtn');

/* ── 4. hidden built-ins are excluded from both rotation and MC pools ──── */
// Hide "What is the capital of France?" (bi0, answer Paris) and drive every
// remaining capitals question through the projector — Paris must never
// appear again, not as a question and not as a distractor.
await page.selectOption('#formatSelect', 'mc');
await page.click('[data-stage="bank"]');
await settle(page, 150);
await page.click('[data-toggle="bi0"]');
await settle(page, 250);
await page.click('[data-stage="display"]');
await settle(page, 150);
await page.click('#applyFilterBtn');
await settle(page, 250);

const orderLen = await page.evaluate(() => {
  const m = document.getElementById('displayNum').textContent.match(/of (\d+)/);
  return m ? parseInt(m[1], 10) : 0;
});
ok(orderLen > 0, 'capitals still has questions after hiding one built-in');
let sawParis = false;
for (let i = 0; i < orderLen; i++) {
  const texts = await page.evaluate(() => {
    const q = document.getElementById('displayQ').textContent;
    const opts = Array.from(document.querySelectorAll('#displayOptions .mc-opt')).map(e => e.textContent);
    return [q, ...opts];
  });
  if (texts.some(t => /france|paris/i.test(t))) sawParis = true;
  await page.click('#nextBtn');
  await settle(page, 80);
}
ok(!sawParis, 'the hidden France/Paris built-in never appears again — not as a question, not as a distractor');

/* ── 5. printed quiz: same version = same paper, key matches the paper ── */
await page.click('[data-stage="sheet"]');
await settle(page, 150);
await page.selectOption('#categoryFilter', 'landmarks');
await page.click('#applyFilterBtn');
await settle(page, 200);
await page.fill('#sheetCount', '8');
await page.fill('#quizVersion', '5');
await page.click('#buildSheetBtn');
await settle(page, 250);

const captureQuiz = () => page.evaluate(() => ({
  problems: document.getElementById('sheetProblems').innerHTML,
  key: document.getElementById('sheetKey').innerHTML,
}));
const first = await captureQuiz();
ok(/mc-print-opt/.test(first.problems), 'multiple-choice options print under each question');

await page.click('#buildSheetBtn'); // same version again
await settle(page, 250);
const second = await captureQuiz();
same(first, second, 'rebuilding with the same version number regenerates byte-for-byte the same quiz and key');

await page.click('#newVersionBtn'); // bumps version and rebuilds
await settle(page, 250);
const third = await captureQuiz();
ok(JSON.stringify(third) !== JSON.stringify(first), 'a new version produces a different paper');

await page.fill('#quizVersion', '5');
await page.click('#buildSheetBtn');
await settle(page, 250);
const fourth = await captureQuiz();
same(first, fourth, 'and dialing the version back to 5 reproduces the original paper again');

// Key matches the paper: for each numbered item, the letter in the key must
// point at the option carrying that same answer text in the problem block.
const keyMatches = await page.evaluate(() => {
  const problems = Array.from(document.querySelectorAll('#sheetProblems .problem'));
  const keyItems = Array.from(document.querySelectorAll('#sheetKey li')).map(li => li.textContent);
  return problems.every((p, i) => {
    const keyLine = keyItems[i];
    const m = keyLine.match(/^\d+\.\s([A-D])\s—\s(.+)$/);
    if (!m) return false;
    const [, letter, answerText] = m;
    const opts = Array.from(p.querySelectorAll('.mc-print-opt')).map(o => o.textContent);
    const optLine = opts.find(o => o.startsWith(letter + '.'));
    return !!optLine && optLine.slice(3).trim() === answerText.trim();
  });
});
ok(keyMatches, 'every answer-key line names the letter that actually carries that answer text on the printed quiz');

/* ── 6. thin-pool fallback: a category down to one visible question ────── */
await page.evaluate(([disabledKey]) => {
  // Hide every built-in landmark except one (bi10 — Great Pyramid of Giza),
  // so its own generated question has zero same-category distractors left.
  const ids = [];
  for (let i = 10; i <= 19; i++) ids.push('bi' + i);      // original 10 landmarks
  for (let i = 50; i <= 69; i++) ids.push('bi' + i);      // the 20 added this round
  const keep = 'bi10';
  const hide = ids.filter(id => id !== keep);
  localStorage.setItem(disabledKey, JSON.stringify(hide));
}, [DISABLED_KEY]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await page.selectOption('#categoryFilter', 'landmarks');
await page.selectOption('#formatSelect', 'mc');
await page.click('#applyFilterBtn');
await settle(page, 250);

const fallbackState = await page.evaluate(() => ({
  optionsHidden: document.getElementById('displayOptions').classList.contains('hidden'),
  q: document.getElementById('displayQ').textContent,
}));
ok(fallbackState.optionsHidden, 'with only one landmarks question visible, MC mode falls back to short answer instead of crashing or padding with nonsense: ' + fallbackState.q);
await page.click('#revealBtn');
await settle(page, 150);
eq(await page.textContent('#displayA'), 'Egypt', 'and reveal still shows the plain answer for the fallback question');

// Restore full bank state for the remaining checks.
await page.evaluate(([disabledKey]) => localStorage.removeItem(disabledKey), [DISABLED_KEY]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

/* ── 7. format choice persists across reloads ───────────────────────────── */
await page.selectOption('#formatSelect', 'mc');
await settle(page, 200);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq(await page.inputValue('#formatSelect'), 'mc', 'the quiz-format setting survives a reload');

/* ── 8. the bank grew and stayed balanced (30/30/30) ────────────────────── */
const counts = await page.evaluate(() => {
  const all = window.__gbqTestHooks.allQuestions();
  const out = { capitals: 0, landmarks: 0, mapskills: 0 };
  all.forEach(q => { if (!q.custom) out[q.category]++; });
  return out;
});
eq(counts.capitals, 30, '30 built-in capitals questions');
eq(counts.landmarks, 30, '30 built-in landmarks questions');
eq(counts.mapskills, 30, '30 built-in map-skills questions');

/* ── 9. no console noise, nothing left the site ─────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
