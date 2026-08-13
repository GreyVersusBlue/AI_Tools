// smoke-pools-swiss.mjs — pools-into-a-bracket and Swiss pairing.
//
//   node Tools/bracket-tournament-generator/test/smoke-pools-swiss.mjs
//
// Covers the two new formats added alongside single/double elimination and
// round robin: Pools (round-robin groups feeding an elimination bracket) and
// Swiss (record-based pairing for a fixed number of rounds). Every scenario
// below is worked out by hand against the tool's own pairing/seeding math
// (distributeIntoPools' snake distribution, buildRoundRobin's circle method,
// standardSeedOrder's bracket placement, and the Swiss round-by-record
// pairing with repeat-avoidance) so each assertion checks a *predicted*
// value, not just "something rendered."
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8173;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/020-bracket-tournament-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => {
  const same = Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b;
  return ok(same, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
};

const server = await serve(PORT);
const browser = await launch();

console.log('Bracket / Tournament Generator — pools and Swiss');

/* ── helper: fill the Nth match's score-pair inputs and let it settle ──── */
async function enterScore(page, matchIndex, aVal, bVal) {
  await page.evaluate(({ matchIndex, aVal }) => {
    const pair = document.querySelectorAll('.match-score-pair')[matchIndex];
    const input = pair.querySelectorAll('input')[0];
    input.value = String(aVal);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { matchIndex, aVal });
  await settle(page, 100);
  await page.evaluate(({ matchIndex, bVal }) => {
    const pair = document.querySelectorAll('.match-score-pair')[matchIndex];
    const input = pair.querySelectorAll('input')[1];
    input.value = String(bVal);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { matchIndex, bVal });
  await settle(page, 120);
}

const standingsRows = (page, selectorScope) => page.evaluate((scope) => {
  const tables = document.querySelectorAll('.standings-table');
  const table = scope != null ? tables[scope] : tables[tables.length - 1];
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
  return { headers, rows };
}, selectorScope);

const roundSlotTexts = (page, roundIndex) => page.evaluate((roundIndex) => {
  const rounds = document.querySelectorAll('.bracket .round');
  const round = rounds[roundIndex];
  if (!round) return null;
  return Array.from(round.querySelectorAll('.slot')).map(s => s.textContent.trim());
}, roundIndex);

/* ════════════════════ 1. pools — standings + bracket seeding ════════════ */
{
  const page = await prepPage(browser, BASE, { width: 1500, height: 1400 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  // 8 entrants, 2 pools, advance top 2 from each. As-entered (no shuffle) so
  // distributeIntoPools' snake split is fully predictable:
  //   cycle0: T1->pool0, T2->pool1   cycle1: T3->pool1, T4->pool0
  //   cycle2: T5->pool0, T6->pool1   cycle3: T7->pool1, T8->pool0
  //   Pool 1 = [T1, T4, T5, T8]   Pool 2 = [T2, T3, T6, T7]
  await page.fill('#contestants', 'T1\nT2\nT3\nT4\nT5\nT6\nT7\nT8');
  await page.selectOption('#bracketType', 'pools');
  await page.fill('#poolCount', '2');
  await page.fill('#poolAdvance', '2');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'Pools Smoke Test');
  await page.click('#generateBtn');
  await settle(page, 400);

  const poolHeadings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bracket-subtitle')).map(el => el.textContent.trim()));
  ok(poolHeadings.includes('Pool 1') && poolHeadings.includes('Pool 2'), `both pool headings rendered (saw ${JSON.stringify(poolHeadings)})`);

  // Pool 1's round-robin (circle method on [T1,T4,T5,T8]):
  //   R0: T1v T8, T4v T5   R1: T1v T5, T8v T4   R2: T1v T4, T5v T8
  // Scored so the finish order is exactly the input order T1 > T4 > T5 > T8.
  await enterScore(page, 0, 10, 3);  // T1 beats T8
  await enterScore(page, 1, 8, 4);   // T4 beats T5
  await enterScore(page, 2, 9, 2);   // T1 beats T5
  await enterScore(page, 3, 3, 7);   // T4 beats T8 (a=T8, b=T4)
  await enterScore(page, 4, 6, 1);   // T1 beats T4
  await enterScore(page, 5, 5, 2);   // T5 beats T8

  // Pool 2's round-robin (circle method on [T2,T3,T6,T7]), finish order
  // T2 > T3 > T6 > T7:
  await enterScore(page, 6, 11, 4);  // T2 beats T7
  await enterScore(page, 7, 7, 5);   // T3 beats T6
  await enterScore(page, 8, 9, 3);   // T2 beats T6
  await enterScore(page, 9, 2, 8);   // T3 beats T7 (a=T7, b=T3)
  await enterScore(page, 10, 6, 2);  // T2 beats T3
  await enterScore(page, 11, 5, 1);  // T6 beats T7

  const pool1Standings = await standingsRows(page, 0);
  eq(pool1Standings.rows.map(r => r[0]).join(','), 'T1,T4,T5,T8', 'Pool 1 standings ranked T1 > T4 > T5 > T8');
  eq(pool1Standings.rows[0].slice(1), ['3', '0', '3', '25', '6', '+19'], "Pool 1 leader T1's full W/L/Played/PF/PA/Diff record");
  eq(pool1Standings.rows[3].slice(1), ['0', '3', '3', '8', '22', '-14'], "Pool 1 last place T8's record");

  const pool2Standings = await standingsRows(page, 1);
  eq(pool2Standings.rows.map(r => r[0]).join(','), 'T2,T3,T6,T7', 'Pool 2 standings ranked T2 > T3 > T6 > T7');
  eq(pool2Standings.rows[0].slice(1), ['3', '0', '3', '26', '9', '+17'], "Pool 2 leader T2's full record");

  // Both pools are complete — the "Generate bracket" action should appear.
  const genBtnVisible = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Generate bracket from pool results'));
  ok(genBtnVisible, '"Generate bracket from pool results" button appears once every pool match is decided');

  await page.click('text=Generate bracket from pool results');
  await settle(page, 300);

  // seedOrderFromPools groups by finish position across pools, not
  // pool-by-pool: every pool's 1st place, then every pool's 2nd place —
  // [T1, T2, T4, T3] — then buildBracket(..., 'ranked') places them with
  // standardSeedOrder(4) = [1,4,2,3], i.e. seed1 vs seed4, seed2 vs seed3.
  // Round indices are global across every `.bracket` box on the page: Pool 1's
  // box contributes rounds 0-2, Pool 2's box rounds 3-5, so the newly
  // appended bracket box's own round 0 is index 6.
  const bracketRound0 = await roundSlotTexts(page, 6);
  eq(bracketRound0, ['T1', 'T3', 'T2', 'T4'], 'bracket seeded by cross-pool finish position (rank-1 finishers T1/T2 kept apart from each other by ranked placement, paired against the two rank-2 finishers)');

  // Decide the bracket: T1 over T3, T2 over T4, then T1 over T2 in the final.
  // Bracket score-pairs start right after the 12 pool score-pairs (indices 12/13 = round 0, 14 = the final).
  await enterScore(page, 12, 10, 5);  // T1 beats T3
  await enterScore(page, 13, 9, 5);   // T2 beats T4
  await settle(page, 200);
  await enterScore(page, 14, 8, 3);   // T1 beats T2 -> champion

  const champion = (await page.textContent('#championBanner')).trim();
  ok(/Champion: T1/.test(champion), `champion banner names the bracket winner (got "${champion}")`);

  const bracketStandings = await standingsRows(page);
  ok(!!bracketStandings, 'the pools-fed bracket has its own standings table');
  eq(bracketStandings.rows[0][0], 'T1', 'the bracket standings leader is the champion');

  eq(page.__errs.length, 0, 'no page/console errors (pools): ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site (pools): ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

/* ═══════════════════ 2. Swiss — round-by-record pairing ═════════════════ */
{
  const page = await prepPage(browser, BASE, { width: 1500, height: 1200 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  await page.fill('#contestants', 'S1\nS2\nS3\nS4');
  await page.selectOption('#bracketType', 'swiss');
  await page.fill('#swissRounds', '3');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'Swiss Smoke Test');
  await page.click('#generateBtn');
  await settle(page, 400);

  // Round 1 has no results to pair by: top half vs bottom half over the
  // entered order — S1 v S3, S2 v S4.
  const round1 = await roundSlotTexts(page, 0);
  eq(round1, ['S1', 'S3', 'S2', 'S4'], 'Round 1 pairs top half vs bottom half (no standings to pair by yet)');

  await enterScore(page, 0, 10, 5); // S1 beats S3
  await enterScore(page, 1, 9, 4);  // S2 beats S4

  await page.click('text=Generate Round 2 pairings');
  await settle(page, 300);

  // Both winners (S1, S2) are tied 1-0 with equal point differential (+5
  // each) — the tiebreak (fewer losses, then name) puts S1 ahead of S2, and
  // symmetrically S3 ahead of S4. Pairing by record groups the winners
  // together and the losers together: S1 v S2, S3 v S4.
  const round2 = await roundSlotTexts(page, 1);
  eq(round2, ['S1', 'S2', 'S3', 'S4'], 'Round 2 pairs by current record — winners together, losers together');

  await enterScore(page, 2, 7, 3); // S1 beats S2
  await enterScore(page, 3, 6, 2); // S4 beats S3

  await page.click('text=Generate Round 3 pairings');
  await settle(page, 300);

  // By Round 3 every player has faced two of the other three (S1: S3, S2 —
  // S2: S4, S1 — S3: S1, S4 — S4: S2, S3), so exactly one perfect pairing
  // avoids every repeat regardless of standings order: S1 v S4, S2 v S3.
  const round3 = await roundSlotTexts(page, 2);
  eq(round3, ['S1', 'S4', 'S2', 'S3'], 'Round 3 pairs the only remaining opponents each player has not yet faced');

  // A tied score never auto-decides, in Swiss same as every other format.
  await enterScore(page, 4, 4, 4); // S1 v S4, tied
  const tiedWinner = await page.evaluate(() => {
    const pair = document.querySelectorAll('.match-score-pair')[4];
    const match = pair.closest('.match');
    return match.querySelector('.slot-winner');
  });
  ok(!tiedWinner, 'a tied score does not auto-decide a Swiss match');

  await enterScore(page, 4, 5, 2); // S1 beats S4 for real
  await enterScore(page, 5, 4, 1); // S2 beats S3

  const champion = (await page.textContent('#championBanner')).trim();
  ok(/Champion: S1/.test(champion), `Swiss champion banner names the sole 3-0 leader (got "${champion}")`);

  const finalStandings = await standingsRows(page);
  eq(finalStandings.rows[0][0], 'S1', 'S1 (3-0) tops the final Swiss standings');

  eq(page.__errs.length, 0, 'no page/console errors (Swiss round-by-record): ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site (Swiss round-by-record): ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

/* ═══════════════ 3. Swiss — bye credit and bye rotation (odd field) ═════ */
{
  const page = await prepPage(browser, BASE, { width: 1500, height: 1200 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  await page.fill('#contestants', 'B1\nB2\nB3');
  await page.selectOption('#bracketType', 'swiss');
  await page.fill('#swissRounds', '2');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'Swiss Bye Test');
  await page.click('#generateBtn');
  await settle(page, 400);

  // Odd field: the last entrant (B3) sits out Round 1 with an automatic win.
  const round1 = await roundSlotTexts(page, 0);
  eq(round1, ['B1', 'B2', 'B3 — BYE (win)'], 'Round 1: B1 v B2 real match, B3 gets the opening bye (an automatic win)');

  await enterScore(page, 0, 10, 4); // B1 beats B2

  await page.click('text=Generate Round 2 pairings');
  await settle(page, 300);

  // Standings after Round 1: B1 (1-0, diff +6) and B3 (1-0 via bye, diff 0)
  // are tied on wins; B1's better differential ranks it above B3. B2 is
  // last. Bye assignment looks at BYE COUNT first, not standings: B1 and B2
  // both have 0 byes so far (B3 already used its one), and between those two
  // the weaker current record (B2, 0-1) gets Round 2's bye — so B3, despite
  // outranking B2 in the standings, does NOT get a second consecutive bye.
  const round2 = await roundSlotTexts(page, 1);
  eq(round2, ['B1', 'B3', 'B2 — BYE (win)'], 'Round 2: the bye rotates to B2 (fewest byes so far) rather than repeating on B3');

  await enterScore(page, 1, 6, 3); // B1 beats B3

  const finalStandings = await standingsRows(page);
  eq(finalStandings.rows.map(r => r[0]).join(','), 'B1,B3,B2', 'final order: B1 (2-0) on top; B3 (1-1, better diff than B2) ahead of B2 (1-1)');
  eq(finalStandings.rows[0].slice(1), ['2', '0', '2', '16', '7', '+9'], "B1's full record");
  // B3's one win came from a bye (no points recorded) and it lost a real
  // match to B1 — a bye still counts as a genuinely played match, unlike
  // round robin's neutral "sitting out."
  eq(finalStandings.rows[1].slice(1), ['1', '1', '2', '3', '6', '-3'], "B3's record — bye win (0-0) plus the Round 2 loss (3-6), 2 matches played");

  const champion = (await page.textContent('#championBanner')).trim();
  ok(/Champion: B1/.test(champion), `champion banner names the sole 2-0 leader (got "${champion}")`);

  eq(page.__errs.length, 0, 'no page/console errors (Swiss byes): ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site (Swiss byes): ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
