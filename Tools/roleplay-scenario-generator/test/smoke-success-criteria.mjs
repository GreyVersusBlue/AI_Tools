// smoke-success-criteria.mjs — the "what a good attempt sounds like" strip.
//
//   node Tools/roleplay-scenario-generator/test/smoke-success-criteria.mjs
//
// A scaffolded roleplay tells a pair what to say but never what doing it well
// is, so the pair's real question — "is that enough?" — gets asked of the
// teacher, one pair at a time, all period. A short criteria strip answers it
// once, in writing, on the page in front of them. What this suite holds down:
//
//   The strip reaches every output a student sees: the projector, the pair
//   handout, and each individual role card. A criteria strip that only prints
//   on one of the three is worse than none, because the teacher stops
//   repeating it out loud.
//
//   Criteria are per class, like the scaffolding fill-ins. Spanish 1 and
//   Spanish 3 are not held to the same bar, and switching classes must not
//   carry one class's criteria onto the other's handouts.
//
//   Empty means absent — no empty bordered box on a handout that has no
//   criteria — and the print toggle really suppresses it.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8114;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/014-roleplay-scenario-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });

const CRITERIA_A = [
  'You keep going for at least six exchanges without English.',
  'You use at least three phrases from the scaffolding.',
  'You ask your partner at least one question.',
];
const CRITERIA_B = ['You stay in the past tense the whole way through.'];

/** The strips on every printed handout in #printArea. */
const printedStrips = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .handout')).map(h => {
    const strip = h.querySelector('.h-success');
    return strip ? Array.from(strip.querySelectorAll('li')).map(li => li.textContent) : null;
  }));

const stageStrip = () => page.evaluate(() => {
  const el = document.querySelector('#stage .stage-success');
  return el ? Array.from(el.querySelectorAll('li')).map(li => li.textContent) : null;
});

/* The button toggles, so clicking it blindly closes an already-open panel —
   and a fill on a hidden textarea just times out. */
async function openCriteria() {
  if (!(await page.isVisible('#criteriaPanel'))) {
    await page.click('#toggleCriteriaBtn');
    await settle(page, 200);
  }
}

async function setCriteria(lines) {
  await page.fill('#criteriaText', lines.join('\n'));
  await settle(page, 300);
}

async function printCurrent() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printCurrentBtn');
  await settle(page, 300);
}
async function printRoleCards() {
  await page.evaluate(() => { window.print = function () {}; });
  await page.click('#printRoleCardsBtn');
  await settle(page, 400);
}

console.log('Roleplay Scenario Generator — success-criteria strip');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. nothing typed, nothing printed ───────────────────────────────────── */
await printCurrent();
eq((await printedStrips())[0], null, 'a handout with no criteria has no empty box on it');
eq(await stageStrip(), null, 'and the projector shows none either');

/* ── 2. typed criteria reach the projector and the handout ───────────────── */
await openCriteria();
ok(await page.isVisible('#criteriaPanel'), 'the criteria panel opens');
await setCriteria(CRITERIA_A);

eq((await stageStrip() || []).join(' | '), CRITERIA_A.join(' | '), 'the projector shows the criteria live as they are typed');

await printCurrent();
const handout = await printedStrips();
eq(handout.length, 1, 'one handout printed');
eq((handout[0] || []).join(' | '), CRITERIA_A.join(' | '), 'and it carries the strip');

/* ── 3. every role card carries it too ───────────────────────────────────── */
/* role cards need a paired class; load a roster and pair up */
await page.evaluate(() => {
  localStorage.setItem('np_rosters', JSON.stringify({ 'Spanish 1': ['Ava R.', 'Ben O.', 'Cara L.', 'Dev P.'] }));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
await page.selectOption('#rosterHubSelect', 'Spanish 1');
await page.click('#rosterHubLoadBtn');
await settle(page, 300);
await page.click('#pairUpBtn');
await settle(page, 400);
await printRoleCards();
const cards = await printedStrips();
ok(cards.length >= 4, `a card per student printed (${cards.length})`);
ok(cards.every(c => c && c.join(' | ') === CRITERIA_A.join(' | ')),
   'every role card carries the same strip');

/* ── 4. the criteria survived the reload ─────────────────────────────────── */
await openCriteria();
eq(await page.inputValue('#criteriaText'), CRITERIA_A.join('\n'), 'the criteria came back after a reload');

/* ── 5. the print toggle suppresses it everywhere ────────────────────────── */
await page.uncheck('#criteriaOn');
await settle(page, 300);
eq(await stageStrip(), null, 'turning the strip off clears the projector');
await printCurrent();
eq((await printedStrips())[0], null, 'and the handout');
await page.check('#criteriaOn');
await settle(page, 300);
ok(await stageStrip(), 'turning it back on restores it without retyping');

/* ── 6. criteria are per class ───────────────────────────────────────────── */
page.once('dialog', d => d.accept('Spanish 3'));
await page.click('#addClassBtn');
await settle(page, 400);
await openCriteria();
eq(await page.inputValue('#criteriaText'), '', 'a new class starts with no criteria of its own');
await setCriteria(CRITERIA_B);
await printCurrent();
eq(((await printedStrips())[0] || []).join(' | '), CRITERIA_B.join(' | '), 'the new class prints its own');

await page.selectOption('#classSelect', 'My Class');
await settle(page, 400);
eq(await page.inputValue('#criteriaText'), CRITERIA_A.join('\n'), 'switching back brings the first class\'s criteria');
await printCurrent();
eq(((await printedStrips())[0] || []).join(' | '), CRITERIA_A.join(' | '),
   'and its handouts are unaffected by the other class');

/* ── 7. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
