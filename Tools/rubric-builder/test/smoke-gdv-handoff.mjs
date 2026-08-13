// smoke-gdv-handoff.mjs — Rubric Builder's score handoff to Grade
// Distribution Visualizer (rubric-builder/rb-gdv-handoff.js).
//
//   node Tools/rubric-builder/test/smoke-gdv-handoff.mjs
//
// Scores two students against a template rubric, triggers the "Send scores
// to Grade Distribution Visualizer" handoff, and checks two things:
//   1. The exact `gvb-grade-distribution:*` localStorage keys/shape Grade
//      Distribution Visualizer's own store expects (list / data:<name> /
//      current) are written correctly, and a repeat handoff mints a second,
//      uniquely-named assignment rather than overwriting the first.
//   2. Grade Distribution Visualizer, opened via the real window.open() the
//      handoff performs (same browser context, so real shared localStorage
//      — not a second prepPage() context), actually boots into the exported
//      assignment and its own tolerant score parser reads both students
//      back out with the percentages Rubric Builder computed.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8210;
const BASE = `http://127.0.0.1:${PORT}`;
const RB_URL = BASE + '/Tools/003-rubric-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const close = (a, b, eps, label) => ok(Math.abs(a - b) <= eps, `${label} (got ${a}, want ~${b})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Rubric Builder — score handoff to Grade Distribution Visualizer');

await page.goto(RB_URL, { waitUntil: 'networkidle' });
await settle(page, 500);

/* ── load a template so there are real criteria and real points ────────── */
const templates = await page.$$eval('#templatePicker option', els => els.map(e => e.value).filter(Boolean));
ok(templates.length > 0, 'the tool ships templates to test against');
await page.selectOption('#templatePicker', templates[0]);
await page.click('#loadTemplateBtn');
await settle(page, 300);

await page.click('#modeScoreBtn');
await settle(page, 300);

/** Types/loads a student, then clicks one level button per criterion —
    `pickIndex(levelCount)` chooses which column, so one student can be
    scored at the bottom of the scale and another at the top. */
async function scoreStudent(name, pickIndex) {
  await page.fill('#studentNameInput', name);
  await page.click('#loadStudentScoreBtn');
  await settle(page, 250);
  const critCount = await page.$$eval('#scoreCriteriaList .score-crit-block', els => els.length);
  // Clicking a level button re-renders the whole #scoreCriteriaList
  // (renderScoreCriteria() replaces its innerHTML), so any earlier element
  // handle into it goes stale — re-query fresh from the live DOM on every
  // single click rather than reusing a handle collected before the render.
  for (let i = 0; i < critCount; i++) {
    const btnCount = await page.evaluate((idx) => {
      const block = document.querySelectorAll('#scoreCriteriaList .score-crit-block')[idx];
      return block ? block.querySelectorAll('.level-btn-row .level-btn').length : 0;
    }, i);
    if (!btnCount) continue;
    const idx2 = pickIndex(btnCount);
    const btn = await page.evaluateHandle((args) => {
      const [idx, idx2] = args;
      const block = document.querySelectorAll('#scoreCriteriaList .score-crit-block')[idx];
      return block.querySelectorAll('.level-btn-row .level-btn')[idx2];
    }, [i, idx2]);
    await btn.asElement().click();
    await settle(page, 60);
  }
}

// Level buttons render in state.levels order, which is NOT guaranteed to be
// lowest-to-highest (the built-in templates list levels highest-points-first,
// e.g. "Excellent"(4), "Good"(3), "Fair"(2), "Poor"(1)) — so find the actual
// lowest- and highest-point column indexes from the saved rubric rather than
// assuming index 0 is the bottom of the scale.
const { lowIdx, highIdx } = await page.evaluate(() => {
  const rubricName = localStorage.getItem('gvb-rubric-builder:current');
  const state = JSON.parse(localStorage.getItem('gvb-rubric-builder:data:' + rubricName));
  let lowIdx = 0, highIdx = 0;
  state.levels.forEach((l, i) => {
    if ((Number(l.points) || 0) < (Number(state.levels[lowIdx].points) || 0)) lowIdx = i;
    if ((Number(l.points) || 0) > (Number(state.levels[highIdx].points) || 0)) highIdx = i;
  });
  return { lowIdx, highIdx };
});

await scoreStudent('Alvarez', () => lowIdx);          // lowest-point level everywhere
await settle(page, 200);
await scoreStudent('Baker', () => highIdx);            // highest-point level everywhere
await settle(page, 300);

/* ── expectations, computed the same way earnedPoints()/totalPossiblePoints()
   in the tool itself do (no half credit or weighting exercised here, so this
   stays a direct max(level.points) × weight sum) ─────────────────────────── */
const expect = await page.evaluate(() => {
  const rubricName = localStorage.getItem('gvb-rubric-builder:current');
  const state = JSON.parse(localStorage.getItem('gvb-rubric-builder:data:' + rubricName));
  const scores = JSON.parse(localStorage.getItem('gvb-rubric-builder:scores:' + rubricName) || '{}');
  const maxPts = state.levels.reduce((m, l) => Math.max(m, Number(l.points) || 0), -Infinity);
  const possible = state.criteria.reduce((s, c) => s + maxPts * (c.weight || 1), 0);
  function earned(rec) {
    return state.criteria.reduce((sum, c) => {
      const sel = rec.selections[c.id];
      if (!sel || !sel.levelId) return sum;
      const lvl = state.levels.find(l => l.id === sel.levelId);
      if (!lvl) return sum;
      return sum + (Number(lvl.points) || 0) * (c.weight || 1);
    }, 0);
  }
  const students = {};
  Object.keys(scores).forEach(name => {
    students[name] = possible > 0 ? (earned(scores[name]) / possible) * 100 : 0;
  });
  return { baseName: state.title || state.name, possible, students };
});

ok(expect.possible > 0, 'the loaded template has a nonzero point total');
ok('Alvarez' in expect.students && 'Baker' in expect.students, 'both students have saved score records');
ok(expect.students.Baker > expect.students.Alvarez, 'the top-level student scores higher than the bottom-level student');

const beforeList = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-grade-distribution:list') || '[]'));
eq(beforeList.length, 0, 'nothing under the Grade Distribution Visualizer key before the handoff');

/* ── trigger the handoff: real window.open(), real shared localStorage ──── */
page.once('dialog', d => d.accept());
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#exportScoresGdvBtn'),
]);
await popup.waitForLoadState('networkidle');
await settle(popup, 500);

/* ── exact gvb-grade-distribution:* storage shape ───────────────────────── */
const gdv1 = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('gvb-grade-distribution:list') || '[]');
  const current = localStorage.getItem('gvb-grade-distribution:current');
  const data = JSON.parse(localStorage.getItem('gvb-grade-distribution:data:' + current) || 'null');
  const allKeys = Object.keys(localStorage).filter(k => k.indexOf('gvb-grade-distribution:') === 0);
  return { list, current, data, allKeys };
});

eq(gdv1.list.length, 1, 'exactly one assignment minted under the list key');
ok(gdv1.list.includes(gdv1.current), 'the list contains the current pointer');
ok(!!gdv1.data, 'a data blob exists under data:<current>');
eq(gdv1.data.name, gdv1.current, "the data blob's own name field matches the key it is stored under");
eq(gdv1.data.cutA, 90, 'default A cutoff carried over');
eq(gdv1.data.cutB, 80, 'default B cutoff carried over');
eq(gdv1.data.cutC, 70, 'default C cutoff carried over');
eq(gdv1.data.cutD, 60, 'default D cutoff carried over');
eq(gdv1.data.bucketWidth, 10, 'default bucket width carried over');
ok(Array.isArray(gdv1.data.compareNames) && gdv1.data.compareNames.length === 0, 'compareNames starts empty');
ok(typeof gdv1.data.text === 'string' && gdv1.data.text.length > 0, 'the pasted-score text field is populated');
ok(gdv1.data.text.includes('Alvarez') && gdv1.data.text.includes('Baker'), 'both scored students made it into the text');
eq(gdv1.allKeys.length, 3, 'exactly the three expected gvb-grade-distribution:* keys exist (list, current, one data blob): ' + JSON.stringify(gdv1.allKeys));

/* ── round trip: the popup really is Grade Distribution Visualizer, booted
   into the exported assignment via its own boot-time getCurrentName()/
   loadListByName(), not just storage sitting there unread ────────────────── */
ok(/037-grade-distribution-visualizer\.html/.test(popup.url()), 'the handoff opened Grade Distribution Visualizer: ' + popup.url());
eq(await popup.inputValue('#listName'), gdv1.current, 'the assignment-name field shows the minted name');
eq(await popup.inputValue('#scoreInput'), gdv1.data.text, 'the score textarea is populated with the exported text');

const parsedBack = await popup.evaluate(() => {
  // Re-derive the same tolerant "last colon/comma-separated numeric token"
  // parse Grade Distribution Visualizer's own extractScore() does (it's a
  // page-local closure, not exposed globally) — this is checking that the
  // shape we wrote is something ITS parser actually accepts, not just that
  // our own text happens to look right.
  const text = document.getElementById('scoreInput').value;
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const i = line.lastIndexOf(':');
    if (i === -1) return;
    const name = line.slice(0, i).trim();
    const score = parseFloat(line.slice(i + 1));
    if (!isNaN(score)) out[name] = score;
  });
  return out;
});
close(parsedBack.Alvarez, expect.students.Alvarez, 0.5, `Alvarez's percent round-trips through the store (got ${parsedBack.Alvarez}, want ~${expect.students.Alvarez})`);
close(parsedBack.Baker, expect.students.Baker, 0.5, `Baker's percent round-trips through the store (got ${parsedBack.Baker}, want ~${expect.students.Baker})`);

// And Grade Distribution Visualizer's own rendered stats agree it parsed
// both lines cleanly (n = 2, nothing excluded as blank/non-numeric) — read
// straight out of its stats-table rows rather than guessing a text format.
const stats = await popup.evaluate(() => {
  const rows = {};
  document.querySelectorAll('#outputBody .stats-table tr').forEach(tr => {
    const label = tr.querySelector('.stat-label');
    const value = tr.querySelector('.stat-value');
    if (label && value) rows[label.textContent.trim()] = value.textContent.trim();
  });
  return rows;
});
eq(stats['Number of scores (n)'], '2', "Grade Distribution Visualizer's own stats table shows n = 2: " + JSON.stringify(stats));
eq(stats['Excluded (blank/non-numeric)'], '0', 'and nothing was excluded as blank/non-numeric: ' + JSON.stringify(stats));

/* ── never overwrite: a second handoff mints a NEW assignment ───────────── */
page.once('dialog', d => d.accept());
const [popup2] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#exportScoresGdvBtn'),
]);
await popup2.waitForLoadState('networkidle');
await settle(popup2, 400);

const gdv2 = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('gvb-grade-distribution:list') || '[]');
  const current = localStorage.getItem('gvb-grade-distribution:current');
  return { list, current };
});

eq(gdv2.list.length, 2, 'a repeat handoff adds a second assignment rather than overwriting the first');
ok(gdv2.list.includes(gdv1.current), 'the first assignment is still there, untouched');
ok(gdv2.current !== gdv1.current, 'the pointer now names the newly-minted second assignment');
eq(gdv2.current, expect.baseName + ' (2)', 'the second name follows the repo-wide " (2)" dedup convention: ' + gdv2.current);

const firstDataStillThere = await page.evaluate((name) =>
  JSON.parse(localStorage.getItem('gvb-grade-distribution:data:' + name) || 'null'), gdv1.current);
ok(!!firstDataStillThere && firstDataStillThere.text === gdv1.data.text, "the first assignment's data blob is unchanged");

/* ── no console noise, nothing left the site, on the opener page ────────── */
eq(page.__errs.length, 0, 'no page/console errors on Rubric Builder: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site from Rubric Builder: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
