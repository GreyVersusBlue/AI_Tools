// smoke-qsource.mjs — Name Picker: a pick that carries a question from the question bank (Path 15 P4).
//
//   node Tools/name-picker/test/smoke-qsource.mjs
//
// Three bank questions, a roster, "Enable random task prompts" on and the bank chosen as the source. Each pick shows the
// question's words (never its answer) and logs prompt + qid; the bag asks all three before repeating; "Same question, next
// student" keeps the id; typed prompts still behave as they did; a built-in/seed id would not be stored; reading the bank writes nothing.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8608;
const BASE = `http://127.0.0.1:${PORT}`;
const ROSTER = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Fay'];
let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else { failed++; console.log(`  FAIL ${l}\n    got  ${JSON.stringify(a)}\n    want ${JSON.stringify(b)}`); } };

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
await page.addInitScript(({ roster }) => {
  if (localStorage.getItem('seeded')) return;
  localStorage.setItem('seeded', '1');
  localStorage.setItem('np_rosters', JSON.stringify({ 'Period 1': roster }));
  localStorage.setItem('np_current', JSON.stringify(roster));
  localStorage.setItem('np_prompts', JSON.stringify(['Typed one', 'Typed two']));
}, { roster: ROSTER });
await page.goto(BASE + '/Tools/007-Name Picker.html', { waitUntil: 'networkidle' });
await settle(page, 400);
const click = sel => page.evaluate(q => document.querySelector(q).click(), sel);

/* the teacher's bank, written the way 030 writes it */
const saved = await page.evaluate(() => {
  const r = QuestionBank.importQuestions([
    { prompt: 'What is the capital of France?', answer: 'Paris-SECRET' },
    { prompt: 'Name a river in Egypt.', answer: 'Nile-SECRET' },
    { prompt: 'Which planet is red?', answer: 'Mars-SECRET' }
  ]);
  return { ids: QuestionBank.list().map(q => q.id), added: r.added };
});
eq(saved.added, 3, 'three questions in the bank');
const bankBefore = await page.evaluate(() => localStorage.getItem('gvb-question-bank'));

await click('button[data-tab="prompts"]');
await settle(page, 200);
const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#promptSource option')).map(o => [o.value, o.textContent]));
eq(opts, [['typed', 'My typed prompts'], ['src:', 'My question bank (3 questions)']], 'the chooser lists typed prompts and the bank (no built-in sets are loaded here)');
eq(await page.evaluate(() => document.getElementById('promptSource').value), 'typed', 'it opens on typed prompts');
eq(await page.evaluate(() => localStorage.getItem('gvb-question-bank')), bankBefore, 'looking at the bank wrote nothing to it');

const pick = async () => {
  await page.evaluate(() => document.getElementById('pickBtn').click());
  await page.waitForSelector('.modal-overlay #modalDone', { timeout: 20000 });
  const modal = await page.evaluate(() => document.querySelector('.modal-overlay .prompt-task') ? document.querySelector('.modal-overlay .prompt-task').textContent : null);
  return modal;
};
const done = async () => { await page.evaluate(() => document.getElementById('modalDone').click()); await settle(page, 300); };
const history = () => page.evaluate(() => JSON.parse(localStorage.getItem('np_history') || '[]'));

await page.evaluate(() => { const c = document.getElementById('promptsEnabled'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });

/* typed prompts first: nothing changes */
let m = await pick();
ok(/Typed (one|two)/.test(m), 'with the typed source the TASK is a typed line: ' + m);
await done();
let h = await history();
ok(h.length === 1 && /^Typed/.test(h[0].prompt) && h[0].qid === undefined, 'and the entry has a prompt and no qid');

/* the bank as the source */
await page.evaluate(() => { const s = document.getElementById('promptSource'); s.value = 'src:'; s.dispatchEvent(new Event('change', { bubbles: true })); });
const shown = [];
for (let i = 0; i < 3; i++) { shown.push(await pick()); await done(); }
const QS = ['What is the capital of France?', 'Name a river in Egypt.', 'Which planet is red?'];
eq([...shown.map(t => t.replace('📝 TASK', ''))].sort(), QS.slice().sort(), 'three picks ask all three questions, none twice');
ok(!shown.some(t => /SECRET|Paris|Nile|Mars/.test(t)), 'no answer is ever shown');
h = await history();
eq(h.slice(1).map(e => e.prompt).sort(), QS.slice().sort(), 'the log holds the question words');
ok(h.slice(1).every(e => typeof e.qid === 'string' && e.qid === saved.ids[QS.indexOf(e.prompt)]), 'and each entry’s qid is the bank’s id for that question');
ok(!JSON.stringify(h).includes('SECRET'), 'no answer is in the history');
const next = await pick();
ok(QS.some(q => next.includes(q)), 'a fourth pick starts a new round of the same questions');
/* same question, next student */
await page.evaluate(() => document.getElementById('modalSameQ').click());
await page.waitForSelector('.modal-overlay #modalDone', { timeout: 20000 });
await done();
h = await history();
const last2 = h.slice(-2);
ok(last2[0].prompt === last2[1].prompt && last2[0].qid && last2[0].qid === last2[1].qid, '"Same question, next student" repeats the words and keeps the id');
eq(await page.evaluate(() => localStorage.getItem('gvb-question-bank')), bankBefore, 'picking from the bank wrote nothing to it');

/* a deleted question: the old entry keeps what was said */
await page.evaluate(id => QuestionBank.deleteQuestion(id), saved.ids[0]);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
const h2 = await history();
ok(h2.some(e => e.prompt === QS[0] && e.qid === saved.ids[0]), 'after the bank loses a question the log still says what was asked');
await click('button[data-tab="prompts"]');
await settle(page, 200);
eq(await page.evaluate(() => Array.from(document.querySelectorAll('#promptSource option')).map(o => o.textContent)), ['My typed prompts', 'My question bank (2 questions)'], 'the chooser follows the bank');

/* the bank emptied while chosen: back to typed prompts, no crash */
await page.evaluate(() => { const s = document.getElementById('promptSource'); s.value = 'src:'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.evaluate(() => { QuestionBank.list().forEach(q => QuestionBank.deleteQuestion(q.id)); });
await click('button[data-tab="stats"]');
await click('button[data-tab="prompts"]');
await settle(page, 200);
eq(await page.evaluate(() => document.getElementById('promptSource').value), 'typed', 'an emptied bank drops the choice back to typed prompts');
await page.evaluate(() => { const c = document.getElementById('promptsEnabled'); c.checked = true; });
const m3 = await pick();
ok(/Typed/.test(m3), 'and the next pick carries a typed prompt');

await browser.close();
server.close && server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
