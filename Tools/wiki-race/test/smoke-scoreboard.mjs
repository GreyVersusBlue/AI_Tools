// smoke-scoreboard.mjs — Wiki Race (086) class scoreboard on the Verify screen (AI-30, rank 71).
//
//   node Tools/wiki-race/test/smoke-scoreboard.mjs        (port 8624)
//
// No network is needed: the Verify screen decodes codes locally. The codes are made by the page's own
// buildFinishCode (through the page's __wr hook), pasted one per line with labels, and ranked:
//   1. the table has a caption per seed + difficulty, rows in final-time order (a hint costs 30 s) and a
//      rank column that ties share;
//   2. a repeated code, a line with no code, an edited code and a code with no time are each named by line
//      and none of them is ranked;
//   3. nothing is written to localStorage (names stay on the page) and the page asked for nothing offsite;
//   4. "Copy as text" appears only once there is a table;
//   5. the Verify screen has no serious axe violation with a ranked table showing.
// This proves the wiring, NOT that a teacher finds the table useful. Exits 1 on any failure.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8624;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await prepPage(browser, BASE, { width: 1000, height: 900 });
  await page.goto(`${BASE}/Tools/086-wiki-race.html`);
  await settle(page, 300);
  const lsBefore = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));

  // codes for one real matchup, built by the page itself
  const mk = (seed, difficulty, t, c, h, mid) => page.evaluate(async ({ seed, difficulty, t, c, h, mid }) => {
    const m = window.__wr.computeMatchup(seed, difficulty);
    Object.assign(window.__wr.state, { seed, difficulty, elapsedMs: t, clicks: c, hints: h, path: [m.start, ...mid, m.target] });
    return window.__wr.buildFinishCode();
  }, { seed, difficulty, t, c, h, mid });
  const slow = await mk('period 3', 'easy', 90000, 5, 0, ['A']);
  const fast = await mk('period 3', 'easy', 60000, 9, 0, ['A', 'B']);
  const hinted = await mk('period 3', 'easy', 40000, 4, 1, ['A']);   // 40 s + 30 s = 1:10
  const other = await mk('period 4', 'hard', 30000, 3, 0, []);
  const edited = fast.slice(0, -3) + (fast.endsWith('AAA') ? 'BBB' : 'AAA');

  await page.click('#toVerifyBtn');
  ok(await page.locator('#boardCopyBtn').isHidden(), 'Copy as text is hidden before any ranking');
  await page.fill('#boardInput', [
    `Slow Sam ${slow}`, `Fast Fay: ${fast}`, `Hinted Hal - ${hinted}`, `Other Ola ${other}`,
    `Again ${fast}`, 'just a name', `Edited ${edited}`, `NoTime WR0.abcdef.eyJ2IjoxLCJwIjpbImEiXX0`
  ].join('\n'));
  await page.click('#boardBtn');
  await page.waitForSelector('#boardResult table');
  const tables = await page.$$eval('#boardResult table', ts => ts.map(t => ({
    caption: t.querySelector('caption').textContent,
    rows: [...t.querySelectorAll('tr')].slice(1).map(r => [...r.children].map(c => c.textContent))
  })));
  eq(tables.map(t => t.caption), ['Seed “period 3” · easy · 3 ranked', 'Seed “period 4” · hard · 1 ranked'], 'one table per seed and difficulty, biggest first');
  eq(tables[0].rows.map(r => [r[0], r[1], r[2]]), [['1', 'Fast Fay', '1:00'], ['2', 'Hinted Hal', '1:10'], ['3', 'Slow Sam', '1:30']], 'ranked by final time, hints included');
  eq(tables[0].rows.map(r => r[6]), ['', '', ''], 'real endpoints have no note');
  const notes = await page.$$eval('#boardResult .board-note', n => n.map(e => e.textContent));
  ok(notes.some(n => /^Line 5 .*Again.* repeats the code on line 2/.test(n)), 'the repeated code is named: ' + JSON.stringify(notes));
  ok(notes.some(n => /^Line 6: No finish code on this line/.test(n)), 'the line without a code is named');
  ok(notes.some(n => /^Line 7: Checksum/.test(n)), 'the edited code is refused by line');
  ok(notes.some(n => /^Line 8: /.test(n)), 'the incomplete code is refused by line: ' + JSON.stringify(notes));
  ok(await page.locator('#boardCopyBtn').isVisible(), 'Copy as text appears with a table');
  eq(await page.evaluate(() => JSON.stringify(Object.entries(localStorage))), lsBefore, 'nothing was written to localStorage');
  eq(page.__blocked, [], 'no offsite request');
  eq(page.__errs, [], 'no page errors');
  const bad = await a11yScan(page, { impact: 'serious' });
  eq(bad.map(v => v.id), [], 'no serious axe violation on the Verify screen');

  // an empty paste clears the table
  await page.fill('#boardInput', '');
  await page.click('#boardBtn');
  eq(await page.locator('#boardResult table').count(), 0, 'an empty paste clears the table');
  ok(await page.locator('#boardCopyBtn').isHidden(), 'Copy as text hides again');
} finally {
  await browser.close(); server.close();
}
console.log(`wiki-race scoreboard: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
