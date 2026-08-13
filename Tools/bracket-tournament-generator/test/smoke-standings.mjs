// smoke-standings.mjs — structured scores feeding standings.
//
//   node Tools/bracket-tournament-generator/test/smoke-standings.mjs
//
// Round 5 replaced the free-text "21-18" score field with a structured
// { a, b } number pair per match. The point of the change: typing both
// numbers should (a) decide the match automatically when they differ, same
// as clicking the winning name, and (b) feed a printable standings table
// with real win/loss/point-differential records — for round robin (the
// backlog ask's literal example) and for single/double elimination (this
// tool's other two formats, generalized the same way — see the improvement
// prompt's Round 5 update for the scoping note).
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8172;
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

console.log('Bracket / Tournament Generator — structured scores feed standings');

/* ── helper: fill the Nth match's score-pair inputs and let it settle ──── */
async function enterScore(page, matchIndex, aVal, bVal) {
  await page.evaluate(({ matchIndex, aVal, bVal }) => {
    const pairs = document.querySelectorAll('.match-score-pair');
    const pair = pairs[matchIndex];
    const inputs = pair.querySelectorAll('input');
    inputs[0].value = String(aVal);
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
  }, { matchIndex, aVal, bVal });
  await settle(page, 120);
  await page.evaluate(({ matchIndex, bVal }) => {
    const pairs = document.querySelectorAll('.match-score-pair');
    const pair = pairs[matchIndex];
    const inputs = pair.querySelectorAll('input');
    inputs[1].value = String(bVal);
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
  }, { matchIndex, bVal });
  await settle(page, 150);
}

const standingsRows = (page) => page.evaluate(() => {
  const table = document.querySelector('.standings-table');
  if (!table) return null;
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()));
  return { headers, rows };
});

/* ════════════════════════ 1. round robin ════════════════════════════════ */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  await page.fill('#contestants', 'Alpha\nBeta\nGamma\nDelta');
  await page.selectOption('#bracketType', 'roundrobin');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'RR Smoke Test');
  await page.click('#generateBtn');
  await settle(page, 400);

  // Circle-method schedule for 4 entrants, as-entered (no shuffle):
  //   R0: Alpha v Delta, Beta v Gamma
  //   R1: Alpha v Gamma, Delta v Beta
  //   R2: Alpha v Beta,  Gamma v Delta
  await enterScore(page, 0, 10, 5);   // Alpha 10 - Delta 5   -> Alpha
  await enterScore(page, 1, 8, 12);   // Beta 8  - Gamma 12   -> Gamma
  await enterScore(page, 2, 7, 3);    // Alpha 7 - Gamma 3    -> Alpha
  await enterScore(page, 3, 6, 4);    // Delta 6 - Beta 4     -> Delta
  await enterScore(page, 4, 9, 2);    // Alpha 9 - Beta 2     -> Alpha
  await enterScore(page, 5, 5, 1);    // Gamma 5 - Delta 1    -> Gamma

  const winners = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.slot-winner')).map(el => el.textContent.trim()));
  ok(winners.filter(w => w === 'Alpha').length === 3, `Alpha auto-advanced as winner in all 3 of its matches (saw ${JSON.stringify(winners)})`);
  ok(winners.includes('Gamma'), 'Gamma marked winner where its score was higher');
  ok(winners.includes('Delta'), 'Delta marked winner where its score was higher');
  ok(!winners.includes('Beta'), 'Beta (0 wins) never marked a winner');

  const standings = await standingsRows(page);
  ok(!!standings, 'a standings table rendered');
  eq(standings.headers.join(','), 'Team,W,L,Played,PF,PA,Diff', 'standings table has PF/PA/Diff columns once scores exist');
  const names = standings.rows.map(r => r[0]);
  eq(names.join(','), 'Alpha,Gamma,Delta,Beta', 'standings ranked by wins, then point differential');
  eq(standings.rows[0].slice(1), ['3', '0', '3', '26', '10', '+16'], "Alpha's record (W/L/Played/PF/PA/Diff)");
  eq(standings.rows[3].slice(1), ['0', '3', '3', '14', '27', '-13'], "Beta's record (last place, negative diff)");

  const champion = (await page.textContent('#championBanner')).trim();
  ok(/Champion: Alpha/.test(champion), `champion banner names the standings leader (got "${champion}")`);

  // Print output: exercise the blank-print path and confirm the live view
  // (including the standings table just verified) survives the round-trip.
  await page.evaluate(() => { window.print = () => {}; }); // headless has no real print dialog
  await page.check('#printBlank');
  await page.click('#printBtn');
  await settle(page, 200);
  const afterPrint = await standingsRows(page);
  eq(afterPrint.rows.map(r => r[0]).join(','), 'Alpha,Gamma,Delta,Beta', 'live standings restored after a blank print cycle');
  await page.uncheck('#printBlank');

  eq(page.__errs.length, 0, 'no page/console errors (round robin): ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site (round robin): ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

/* ════════════════════════ 2. single elimination ═════════════════════════ */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  await page.fill('#contestants', 'Eagles\nFalcons\nHawks\nOwls');
  await page.selectOption('#bracketType', 'single');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'SE Smoke Test');
  await page.click('#generateBtn');
  await settle(page, 400);

  await enterScore(page, 0, 21, 14); // Eagles 21 - Falcons 14 -> Eagles
  await enterScore(page, 1, 20, 30); // Hawks 20  - Owls 30    -> Owls

  const semisWinners = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.slot-winner')).map(el => el.textContent.trim()));
  eq(semisWinners.sort().join(','), 'Eagles,Owls', 'both round-0 matches auto-decided from scores');

  const round1Text = await page.evaluate(() => {
    const rounds = document.querySelectorAll('.bracket .round');
    return Array.from(rounds[1].querySelectorAll('.slot')).map(s => s.textContent.trim());
  });
  eq(round1Text.join(','), 'Eagles,Owls', 'the final match populated with both round-0 winners');

  // Final: match index 2 (the third .match-score-pair on the page — two in
  // round 0, this is the first/only one in round 1).
  await enterScore(page, 2, 15, 10); // Eagles 15 - Owls 10 -> Eagles champion

  const champion = (await page.textContent('#championBanner')).trim();
  ok(/Champion: Eagles/.test(champion), `champion banner names the bracket winner (got "${champion}")`);

  const standings = await standingsRows(page);
  ok(!!standings, 'an elimination-bracket standings table rendered too (not just round robin)');
  const byName = {};
  standings.rows.forEach(r => { byName[r[0]] = r.slice(1); });
  eq(byName['Eagles'], ['2', '0', '2', '36', '24', '+12'], "Eagles' derived record (2 real matches played, both won)");
  eq(byName['Owls'], ['1', '1', '2', '40', '35', '+5'], "Owls' derived record (won round 0, lost the final)");
  eq(byName['Falcons'], ['0', '1', '1', '14', '21', '-7'], "Falcons' derived record (one loss, no bye credit)");
  eq(byName['Hawks'], ['0', '1', '1', '20', '30', '-10'], "Hawks' derived record");
  const standingsNames = standings.rows.map(r => r[0]);
  eq(standingsNames.join(','), 'Eagles,Owls,Falcons,Hawks', 'elimination standings ranked by W then point differential');
  ok(standings.rows[0][0] === 'Eagles', 'the champion is the standings leader here too');

  eq(page.__errs.length, 0, 'no page/console errors (single elim): ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site (single elim): ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

/* ════════════════ 3. legacy free-text score migrates on load ═══════════ */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  await page.fill('#contestants', 'Reds\nBlues');
  await page.selectOption('#bracketType', 'single');
  await page.selectOption('#seedMode', 'asEntered');
  await page.fill('#bracketName', 'Legacy Score Test');
  await page.click('#generateBtn');
  await settle(page, 300);

  // Simulate a bracket saved by the OLD free-text version of this tool,
  // then reload the page so the boot path (loadBracketByName) migrates it.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('gvb-bracket:data:Legacy Score Test'));
    raw.scores = { '0_0': '21-9' };
    localStorage.setItem('gvb-bracket:data:Legacy Score Test', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 400);

  const migrated = await page.evaluate(() => {
    const pair = document.querySelector('.match-score-pair');
    const inputs = pair.querySelectorAll('input');
    return { a: inputs[0].value, b: inputs[1].value };
  });
  eq(migrated.a, '21', 'legacy "21-9" text score migrated into the first structured input');
  eq(migrated.b, '9', 'and the second');
  // Migration is deliberately passive: it normalizes the record but does not
  // retroactively re-adjudicate a match nobody has touched since the old
  // free-text version — see the "Challenges" note in the improvement prompt.
  const winnerBeforeTouch = await page.evaluate(() =>
    (document.querySelector('.slot-winner') || {}).textContent);
  eq(winnerBeforeTouch, undefined, 'a migrated score alone does not auto-decide the match — only a fresh edit does');

  // The teacher opening this old bracket and just re-confirming the score
  // (a real 'change' event on the now-structured field) decides it exactly
  // like any other score entry would.
  await enterScore(page, 0, 21, 9);
  const winnerAfterTouch = await page.evaluate(() =>
    (document.querySelector('.slot-winner') || {}).textContent);
  eq((winnerAfterTouch || '').trim(), 'Reds', 're-touching the migrated score decides the match (21 > 9)');

  eq(page.__errs.length, 0, 'no page/console errors (legacy migration): ' + JSON.stringify(page.__errs.slice(0, 3)));
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
