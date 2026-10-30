// smoke-do-now-pull.mjs — 044 Sub Plan Builder pulls a do-now from the question bank (Path 10 P4, increment 2).
//
//   node Tools/sub-plan-builder/test/smoke-do-now-pull.mjs   (or: npm run test:sub-plan-donow; port 8599)
//
// What this pins:
//   - no question tagged do-now: the control stays hidden and a typed schedule works as before
//   - a bank with do-now questions: the control lists exactly those prompts, never an untagged one or an answer
//   - choosing one puts "**Do now (5 min):** <prompt>" first in the schedule and keeps every line already typed
//   - choosing another replaces that line rather than adding a second; ** in a prompt cannot break the bold lead-in
//   - the pulled line reaches the plain-text copy and the saved day (it is ordinary schedule text)
//   - the page names no key of the question bank
//   - axe finds nothing serious with the control showing
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8599;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '044-Sub%20Plan%20Builder.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const Q = (id, prompt, tags) => ({ id, prompt, answer: 'SECRETANSWER', tags });
const BANK = { v: 1, data: { schema: 1, questions: [
  Q('a', 'Name two causes of the war.', ['do-now']),
  Q('b', 'Untagged question', ['unit 3']),
  Q('c', 'Write **one** sentence about fractions.', ['Do Now']),
] } };

const src = fs.readFileSync(path.join(SITE, 'Tools', decodeURIComponent(FILE)), 'utf8');
ok(!/gvb-question-bank/.test(src), '044 names no key of the question bank');

async function open(browser, seed) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 1000 });
  await page.addInitScript(([seed]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, [seed]);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}

console.log('044 — do-now pulled from the question bank');
const server = await serve(PORT);
const browser = await launch();
try {
  {
    const page = await open(browser, { 'gvb-question-bank': { v: 1, data: { schema: 1, questions: [Q('b', 'Untagged', ['unit'])] } } });
    eq(await page.$eval('#doNowPullRow', e => e.hidden), true, 'nothing tagged do-now: the control is hidden');
    await page.fill('#scheduleText', '**Setup (5 min):** groups');
    eq(await page.inputValue('#scheduleText'), '**Setup (5 min):** groups', 'a typed schedule is untouched');
    await page.close();
  }
  {
    const page = await open(browser, { 'gvb-question-bank': BANK });
    eq(await page.$eval('#doNowPullRow', e => e.hidden), false, 'tagged questions: the control shows');
    const opts = await page.$$eval('#doNowPick option', o => o.map(x => x.textContent));
    eq(opts.length, 2, 'two prompts listed (the untagged one is not)');
    ok(!opts.join('|').includes('Untagged') && !opts.join('|').includes('SECRETANSWER'), 'no untagged question and no answer in the list');

    await page.fill('#scheduleText', '**Setup (5 min):** groups\n**Wrap-up:** submit');
    await page.selectOption('#doNowPick', '0');
    await page.click('#doNowPullBtn');
    eq(await page.inputValue('#scheduleText'), '**Do now (5 min):** Name two causes of the war.\n**Setup (5 min):** groups\n**Wrap-up:** submit', 'the do-now is first and the typed lines stay');

    await page.selectOption('#doNowPick', '1');
    await page.click('#doNowPullBtn');
    eq(await page.inputValue('#scheduleText'), '**Do now (5 min):** Write one sentence about fractions.\n**Setup (5 min):** groups\n**Wrap-up:** submit', 'a second pull replaces the first and strips ** from the prompt');

    await page.fill('#scheduleText', '');
    await page.click('#doNowPullBtn');
    eq(await page.inputValue('#scheduleText'), '**Do now (5 min):** Write one sentence about fractions.', 'an empty schedule gets just the do-now line');

    const bad = await a11yScan(page);
    ok(!bad || bad.length === 0, 'axe finds nothing serious ' + JSON.stringify(bad));
    await page.click('#btnQuickCopy');
    await settle(page, 200);
    const text = await page.inputValue('#qcText');
    ok(text.includes('- Do now (5 min): Write one sentence about fractions.'), 'the plain-text copy carries the do-now in the schedule');

    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
