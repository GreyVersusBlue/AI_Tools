// smoke-display.mjs — Path 13 P4: 020's second display (?display=1).
//
//   node Tools/bracket-tournament-generator/test/smoke-display.mjs        (or: npm run test:bracket-display)
//
// A teacher's window and a display window share one browser context (a BroadcastChannel does not cross contexts,
// which is why the display is a window on the same browser). For every format the display must draw what the
// teacher's page draws, follow a result, a bracket switch and the setup screen, show nothing a teacher keeps to
// themselves (the academic card's questions and answers, the toolbar), and change nothing: a press on it moves no
// result and writes no storage key. Each rule is then broken on purpose (a route rewrites the page's own text) and
// the suite must notice. Exits 1 on any failure. Names and questions are invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8558;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = '020-bracket-tournament-generator.html';
const URL_PAGE = BASE + '/Tools/' + PAGE;
const OLD_KEY = 'gvb-review-board-bank:entries';
const BANK = JSON.stringify([
  { id: 'q1', question: 'Which river is longest?', answer: 'SECRETNILE', points: 100, unit: 'Rivers', standard: '', difficulty: '', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'q2', question: 'Which river is widest?', answer: 'SECRETAMAZON', points: 100, unit: 'Rivers', standard: '', difficulty: '', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'q3', question: 'Which river is coldest?', answer: 'SECRETLENA', points: 100, unit: 'Rivers', standard: '', difficulty: '', createdAt: '2026-01-01T00:00:00.000Z' },
]);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const server = await serve(PORT);
const browser = await launch();
const errors = [];

async function mutate(page) {
  if (!page.mutation) return;
  await page.route('**/' + PAGE + '*', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: page.mutation.reduce((t, [a, b]) => t.replace(a, () => b), await res.text()) });
  });
}
async function teacherPage(mutation) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => errors.push(String(e)));
  page.mutation = mutation;
  await mutate(page);
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem(k, v); } }, [OLD_KEY, BANK]);
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
async function displayOf(teacher) {
  const d = await teacher.context().newPage();
  d.on('pageerror', (e) => errors.push(String(e)));
  d.mutation = teacher.mutation;
  await mutate(d);
  await d.goto(URL_PAGE + '?display=1', { waitUntil: 'load' });
  await settle(d, 400);
  return d;
}
async function make(page, { name, type = 'single', names }) {
  if (await page.isVisible('#newBracketBtn')) { await page.click('#newBracketBtn'); await settle(page, 150); }
  await page.fill('#contestants', names.join('\n'));
  await page.selectOption('#bracketType', type);
  await page.selectOption('#seedMode', 'asEntered');
  if (type === 'pools') { await page.fill('#poolCount', '2'); await page.fill('#poolAdvance', '1'); }
  if (type === 'swiss') await page.fill('#swissRounds', '2');
  await page.fill('#bracketName', name);
  await page.click('#generateBtn');
  await settle(page, 400);
}
const view = (page) => page.evaluate(() => document.getElementById('bracketView').innerText.replace(/\s+/g, ' ').trim() + '|' + document.getElementById('bracketTitle').textContent.trim());
const keys = (page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const T8 = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];

const SCENARIOS = {
  async formats(teacher) {
    const out = [];
    const display = await displayOf(teacher);
    out.push(['the display waits before a bracket exists', await display.isVisible('#displayWait')]);
    for (const type of ['single', 'double', 'roundrobin', 'pools', 'swiss']) {
      await make(teacher, { name: 'F-' + type, type, names: T8 });
      await settle(display, 300);
      const tv = await view(teacher), dv = await view(display);
      out.push([type + ': the display draws the teacher\'s bracket', tv === dv && tv.length > 40]);
      out.push([type + ': the wait line is gone', !(await display.isVisible('#displayWait'))]);
    }
    return out;
  },
  async follows(teacher) {
    const out = [];
    const display = await displayOf(teacher);
    await make(teacher, { name: 'S1', names: ['T1', 'T2', 'T3', 'T4'] });
    await teacher.evaluate(() => document.querySelectorAll('#bracketView > .bracket > .round')[0].querySelectorAll('.match')[0].querySelectorAll('.slot')[0].click());
    await settle(teacher, 300); await settle(display, 300);
    out.push(['a result on the teacher\'s page shows on the display', (await view(display)) === (await view(teacher))]);
    out.push(['it is the round-2 slot that changed', await display.evaluate(() => document.querySelectorAll('#bracketView > .bracket > .round')[1].querySelector('.slot').textContent.trim() === 'T1')]);
    await make(teacher, { name: 'S2', names: ['A1', 'A2', 'A3', 'A4'] });
    await settle(display, 300);
    out.push(['a second bracket replaces the first on the display', /A1/.test(await view(display)) && !/T1/.test(await view(display))]);
    await teacher.click('#newBracketBtn'); await settle(teacher, 300); await settle(display, 300);
    out.push(['the setup screen empties the display', await display.isVisible('#displayWait') && !(await display.isVisible('#bracketCard'))]);
    const late = await displayOf(teacher);                   // a window opened later asks and is answered
    await teacher.selectOption('#bracketSwitch', 'S1'); await settle(teacher, 400);
    const late2 = await displayOf(teacher);
    out.push(['a window opened afterwards is brought up to date', /T1/.test(await view(late2))]);
    await late.close();
    return out;
  },
  async readOnly(teacher) {
    const out = [];
    const display = await displayOf(teacher);
    await make(teacher, { name: 'R1', names: ['T1', 'T2', 'T3', 'T4'] });
    await settle(display, 300);
    const before = { d: await view(display), t: await view(teacher), k: await keys(teacher) };
    await display.evaluate(() => {
      document.querySelectorAll('#bracketView .slot').forEach((s) => s.click());
      document.querySelectorAll('#bracketView input').forEach((i) => { i.value = '9'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    });
    await display.mouse.click(300, 400); await display.keyboard.press('Enter'); await display.keyboard.press('u');
    await settle(display, 300); await settle(teacher, 300);
    out.push(['pressing the display moved nothing on the display', (await view(display)) === before.d]);
    out.push(['nor on the teacher\'s page', (await view(teacher)) === before.t]);
    out.push(['nor in storage', (await keys(teacher)) === before.k]);
    out.push(['the slots cannot take a pointer', await display.evaluate(() => getComputedStyle(document.getElementById('bracketView')).pointerEvents === 'none')]);
    out.push(['the toolbar, setup and header are not on the display', await display.evaluate(() => ['toolbar', 'setupCard', 'academicCard'].every((id) => !document.getElementById(id).offsetParent) && !document.querySelector('.app-header').offsetParent)]);
    out.push(['the Present bar names the match now playing', await display.evaluate(() => document.getElementById('presentBar').classList.contains('show') && /T1 vs T2/.test(document.getElementById('presentText').textContent))]);
    out.push(['a Fullscreen button is there', await display.isVisible('#displayFsBtn')]);
    return out;
  },
  async academic(teacher) {
    const out = [];
    const display = await displayOf(teacher);
    await make(teacher, { name: 'Q1', names: ['T1', 'T2', 'T3', 'T4'] });
    await teacher.check('#acOn'); await settle(teacher, 300);
    await teacher.evaluate(() => document.querySelector('.match-q-btn').click()); await settle(teacher, 300);
    await teacher.evaluate(() => document.querySelectorAll('#academicPanel .ac-reveal').forEach((b) => b.click())); await settle(teacher, 300);
    const t = await teacher.evaluate(() => document.getElementById('academicPanel').innerText);
    out.push(['the teacher sees a question and its answer', /river is/.test(t) && /SECRET/.test(t)]);
    await settle(display, 300);
    const seen = await display.evaluate(() => document.body.innerText);
    out.push(['the display shows no answer', !/SECRET/.test(seen)]);
    out.push(['nor a question', !/Which river/.test(seen)]);
    out.push(['nor the panel or its buttons', await display.evaluate(() => !document.getElementById('academicPanel').offsetParent && !document.querySelector('.match-q-btn') || !document.querySelector('.match-q-btn').offsetParent)]);
    return out;
  },
};

// Each rule, broken in the page, must be noticed by the scenario that guards it.
const BREAKS = [
  ['formats', [["if (isDisplay) {\n    startDisplay();", "if (false) {\n    startDisplay();"]]],
  ['follows', [["try { displayBc.postMessage({ type: 'bracket', state:", "try { 0 && displayBc.postMessage({ type: 'bracket', state:"]]],
  ['readOnly', [["body.display-mode #bracketView { pointer-events: none; }", ""]]],
  ['readOnly', [["        e.stopPropagation(); e.preventDefault();\n      }, true);", "      }, true);"], ["body.display-mode #bracketView { pointer-events: none; }", ""]]],
  // the academic card is kept off the display twice (not drawn, and hidden by CSS); either alone holds, so both go
  ['academic', [["if (!isDisplay) { academic.sync(); postDisplay(); }", "{ academic.sync(); postDisplay(); }"], ["body.display-mode #academicPanel,", "body.display-mode #nothing,"], ["body.display-mode .match-q-btn,", "body.display-mode .nothing,"]]],
];

for (const name of Object.keys(SCENARIOS)) {
  const teacher = await teacherPage();
  let res;
  try { res = await SCENARIOS[name](teacher); } catch (e) { res = [['threw: ' + String(e).split('\n')[0], false]]; }
  for (const [label, good] of res) ok(good, name + ': ' + label);
  await teacher.context().close();
}
for (const [name, muts] of BREAKS) {
  const teacher = await teacherPage(muts);
  let res;
  try { res = await SCENARIOS[name](teacher); } catch (e) { res = [['threw', false]]; }
  ok(res.some(([, good]) => !good), `${name} did not notice the broken rule: ${muts[0][0].slice(0, 60)}`);
  await teacher.context().close();
}
ok(errors.length === 0, 'page errors: ' + errors.slice(0, 3).join(' | '));
await browser.close();
server.close?.();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
process.exit(0);
