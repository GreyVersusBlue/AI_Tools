// smoke-pairing-history.mjs — the Group / Team Generator's year-long
// pairing matrix (backlog: "Retain pair history beyond the current two
// generations and print a who-has-worked-with-whom grid that drives an
// 'everyone pairs with everyone' grouping mode").
//
//   node Tools/group-team-generator/test/smoke-pairing-history.mjs
//
// Three things are under test, matching the three deliverables:
//
//   1. RETENTION POLICY — pairHistory used to be actively deleted once it
//      fell outside PAIR_MEMORY_WINDOW (2) generations. That pruning is
//      gone; what replaced it is roster-membership pruning (bounded by
//      C(current roster size, 2), not by age) plus an explicit reset. A
//      pairing from generation 1 must still be visible many generations
//      later, and a student removed from the roster entirely must have
//      their history actually garbage-collected (not literal unbounded
//      growth either).
//   2. THE GRID — a printable who-has-worked-with-whom matrix built from
//      that retained history, and never part of the share-a-grouping link
//      or QR (that payload is asserted empty of pairing data in
//      smoke-share.mjs already; this file checks the grid itself renders
//      correctly and stays local).
//   3. THE FIFTH STRATEGY — "everyone pairs with everyone" (`coverage`)
//      must actually use the retained history to drive toward full
//      coverage over many generations, not just avoid the last repeat.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8168;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/002-group-team-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

const NAMES = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida Wells', 'Rosa Parks', 'Cesar Chavez'];

async function readState(p) {
  return p.evaluate(() => {
    const name = localStorage.getItem('gtg:current');
    return JSON.parse(localStorage.getItem('gtg:data:' + name));
  });
}

async function setUpRoster(p, names, strategy) {
  await p.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(p, 400);
  await p.fill('#names-input', names.join('\n'));
  await p.dispatchEvent('#names-input', 'input');
  await settle(p, 250);
  if (strategy) {
    await p.selectOption('#strategy-select', strategy);
    await settle(p, 150);
  }
  await p.fill('#split-value', '4');
  await settle(p, 100);
}

async function generate(p, n) {
  for (let i = 0; i < n; i++) {
    await p.click(i === 0 ? '#generate-btn' : '#regenerate-btn');
    await settle(p, 220);
  }
}

console.log('Group / Team Generator — retained pairing history, grid, and coverage strategy');

/* ── 1. retention policy: history survives well past the old 2-gen window ── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'random');
  await generate(page, 1);
  const afterFirst = await readState(page);
  const firstKey = Object.keys(afterFirst.pairHistory)[0];
  ok(!!firstKey, 'a pairing was recorded after the first shuffle');
  eq(afterFirst.pairHistory[firstKey].gen, 1, 'recorded at generation 1');
  eq(afterFirst.pairHistory[firstKey].count, 1, 'with a count of 1');

  await generate(page, 5); // now at generation 6 — 4 generations past the old window of 2
  const later = await readState(page);
  ok(firstKey in later.pairHistory,
     'the generation-1 pairing is still present at generation 6 (old code deleted anything > 2 generations old)');
  ok(later.pairGen >= 6, `pairGen advanced normally (got ${later.pairGen})`);
  const anyCount2plus = Object.values(later.pairHistory).some(v => v.count >= 2);
  ok(anyCount2plus, 'at least one pair has been grouped together more than once, and the count field tracks it (not just the last generation)');

  await page.close();
}

/* ── 2. roster-membership pruning: removing a student GCs their history ─── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'random');
  await generate(page, 3);
  const before = await readState(page);
  const mentionsDropped = Object.keys(before.pairHistory).filter(k => k.includes('Cesar Chavez'));
  ok(mentionsDropped.length > 0, 'before removal, some retained pairings mention the student who is about to leave the roster');

  const remaining = NAMES.filter(n => n !== 'Cesar Chavez');
  await page.fill('#names-input', remaining.join('\n'));
  await page.dispatchEvent('#names-input', 'input');
  await settle(page, 250);
  await page.click('#regenerate-btn'); // a deliberate generation — this is what runs prunePairHistoryToRoster
  await settle(page, 250);

  const after = await readState(page);
  const stillMentionsDropped = Object.keys(after.pairHistory).some(k => k.includes('Cesar Chavez'));
  ok(!stillMentionsDropped, 'after the student is removed from the roster and a fresh shuffle runs, no retained entry mentions them any more');
  const stillHasOthers = Object.keys(after.pairHistory).some(k => k.includes('Ada Lovelace'));
  ok(stillHasOthers, 'history for students still on the roster survived the same pass');

  await page.close();
}

/* ── 2b. pruning does not fire mid-typing (only on an actual generation) ── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'random');
  await generate(page, 2);
  const before = await readState(page);
  const keyCountBefore = Object.keys(before.pairHistory).length;
  ok(keyCountBefore > 0, 'history exists before the edit');

  // Simulate a mid-edit keystroke that makes a name momentarily malformed,
  // without clicking generate/reshuffle afterward.
  await page.fill('#names-input', NAMES.join('\n').replace('Marco Polo', 'Marco Pol'));
  await page.dispatchEvent('#names-input', 'input');
  await settle(page, 250);

  const duringEdit = await readState(page);
  const stillHasMarcoPolo = Object.keys(duringEdit.pairHistory).some(k => k.includes('Marco Polo'));
  ok(stillHasMarcoPolo,
     'an in-progress roster edit (no generate/reshuffle click) does not delete history for the name being edited');

  await page.close();
}

/* ── 3. legacy numeric pairHistory is migrated, not dropped ──────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  // Seed a config in the old pre-retention-policy shape: pairHistory[key] was
  // a bare generation number, not { gen, count }.
  await page.evaluate((names) => {
    const legacy = {
      name: 'Legacy Class', names: names.join('\n'), mode: 'count', splitValue: 4,
      strategy: 'random', oddMode: 'extra', namingMode: 'number', customNames: '',
      absentNames: [], keepApart: [], keepTogether: [],
      pairHistory: { 'Ada Lovelace␟Marco Polo': 3 }, pairGen: 3
    };
    localStorage.setItem('gtg:list', JSON.stringify(['Legacy Class']));
    localStorage.setItem('gtg:data:Legacy Class', JSON.stringify(legacy));
    localStorage.setItem('gtg:current', 'Legacy Class');
  }, NAMES);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 400);

  const migrated = await readState(page);
  const entry = migrated.pairHistory['Ada Lovelace␟Marco Polo'];
  ok(!!entry && typeof entry === 'object', 'the legacy bare-number entry was migrated to an object on load');
  eq(entry.gen, 3, 'the generation number carried over');
  eq(entry.count, 1, 'count was seeded at 1 for a pre-existing entry (true count unknowable)');

  await page.close();
}

/* ── 4. explicit reset clears everything, including the grid's data ──────── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'random');
  await generate(page, 3);
  const before = await readState(page);
  ok(Object.keys(before.pairHistory).length > 0, 'history exists before reset');

  page.once('dialog', d => d.accept());
  await page.click('#reset-pair-history-btn');
  await settle(page, 250);

  const after = await readState(page);
  eq(Object.keys(after.pairHistory).length, 0, 'pairHistory is empty after reset');
  eq(after.pairGen, 0, 'pairGen is back to 0');

  await page.click('#view-pairing-grid-btn');
  await settle(page, 200);
  ok(/0 of 28 possible pairs \(0%\)/.test(await page.textContent('#grid-content')),
     'the grid reflects the reset immediately (0 of 28 possible pairs)');

  await page.close();
}

/* ── 5. the pairing grid renders correctly from retained history ─────────── */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'random');
  await generate(page, 4);
  const state = await readState(page);

  await page.click('#view-pairing-grid-btn');
  await settle(page, 250);
  eq(await page.evaluate(() => document.getElementById('grid-overlay').hidden), false, 'the grid overlay opens');

  const totalPairs = NAMES.length * (NAMES.length - 1) / 2;
  const pairedCount = Object.keys(state.pairHistory).length;
  const pct = Math.round(100 * pairedCount / totalPairs);
  const summary = await page.textContent('#grid-content');
  ok(summary.indexOf(`${pairedCount} of ${totalPairs} possible pairs (${pct}%)`) !== -1,
     `the summary line matches the retained history (${pairedCount}/${totalPairs}, ${pct}%): ` + summary.split('\n')[0]);

  // Cross-check every rendered cell against localStorage directly, and the
  // self-diagonal, and that a header abbreviates via shortLabel with the
  // full name still reachable as a tooltip.
  const grid = await page.evaluate(() => {
    const table = document.querySelector('#grid-content table.pairing-grid');
    const rows = Array.from(table.querySelectorAll('tr'));
    const headerCells = Array.from(rows[0].querySelectorAll('th')).map(th => ({ text: th.textContent.trim(), title: th.title }));
    const body = rows.slice(1).map(tr => ({
      rowHeader: tr.querySelector('th').textContent.trim(),
      cells: Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    }));
    return { headerCells, body };
  });
  eq(grid.headerCells[1].title, NAMES[0], 'first data column header carries the full name as a tooltip');
  ok(/^Ada L\.$/.test(grid.headerCells[1].text), `the column header is abbreviated (got "${grid.headerCells[1].text}")`);
  eq(grid.body[0].rowHeader, NAMES[0], 'row headers show the full name, unabbreviated');
  eq(grid.body[0].cells[0], '—', 'the self-pairing diagonal cell is an em dash');

  let mismatches = 0;
  for (let i = 0; i < NAMES.length; i++) {
    for (let j = 0; j < NAMES.length; j++) {
      if (i === j) continue;
      const key = NAMES[i] < NAMES[j] ? `${NAMES[i]}␟${NAMES[j]}` : `${NAMES[j]}␟${NAMES[i]}`;
      const expectedCount = state.pairHistory[key] ? state.pairHistory[key].count : 0;
      const cellText = grid.body[i].cells[j];
      const shown = cellText === '' ? 0 : parseInt(cellText, 10);
      if (shown !== expectedCount) mismatches++;
    }
  }
  eq(mismatches, 0, `every rendered grid cell matches the retained pairHistory count (${mismatches} mismatches)`);

  // Local-only: no query parameter shows up from viewing or printing the grid.
  ok(new URL(page.url()).search === '' || !/grid|matrix/i.test(new URL(page.url()).search),
     'viewing the grid never adds a shareable URL parameter for it');

  await page.click('#grid-close-btn');
  await settle(page, 150);
  eq(await page.evaluate(() => document.getElementById('grid-overlay').hidden), true, 'and closes again');

  await page.close();
}

/* ── 6. the grid is unaffected by too-small a roster ──────────────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await setUpRoster(page, ['Solo Student'], null);
  await page.click('#view-pairing-grid-btn');
  await settle(page, 200);
  ok(/at least two names/.test(await page.textContent('#grid-content')), 'a one-student roster gets a plain-English message, not a broken table');
  await page.close();
}

/* ── 7. "everyone pairs with everyone" actually drives toward full coverage ─ */
{
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  await setUpRoster(page, NAMES, 'coverage');
  eq(await page.evaluate(() => document.getElementById('strategy-select').disabled), false,
     'the coverage strategy is selectable without any skill ratings on the roster (unlike balanced/heterogeneous/homogeneous)');

  // 30 generations, not 20. splitValue 4 in 'count' mode means FOUR groups, so
  // this roster of 8 shuffles into 4 pairs and each generation covers only 4 of
  // the 28 possible pairs — 20 generations is 80 pair-slots for 28 pairs, which
  // is marginal rather than comfortable. assignCoverage is greedy over a shuffled
  // pool with randomised tie-breaks, so coverage is a probability, not an
  // invariant: simulating the real 4-groups-of-2 shape over 200,000 trials, 20
  // generations leaves a pair uncovered 0.276% of the time (~1 run in 362, always
  // landing on exactly 27 of 28), while 30 and 40 generations were complete in
  // 200,000 of 200,000. CI hit the 1-in-362 on 2026-09-02 with the reported
  // "got 27, want 28"; the suite passed 12/12 locally on the same commit.
  //
  // The assertion below is deliberately unchanged — full coverage is the property
  // the coverage strategy exists to deliver, and weakening it to 27 would delete
  // the test. What changes is only the number of rounds the strategy is given to
  // get there. 30 is chosen over 40 because the neighbouring spread assertion has
  // to keep holding too: across those same 200,000 trials the max-min spread never
  // exceeded 6 at either count, so 30 keeps the run short without risking it.
  await generate(page, 30);
  const state = await readState(page);
  const totalPairs = NAMES.length * (NAMES.length - 1) / 2;
  const counts = Object.values(state.pairHistory).map(v => v.count);
  eq(counts.length, totalPairs,
     `after 30 generations, every one of the ${totalPairs} possible pairs has shared a group at least once`);
  const spread = Math.max(...counts) - Math.min(...counts);
  ok(spread <= 6, `coverage stays reasonably balanced across pairs, not just complete (max-min spread ${spread})`);

  const explain = await page.textContent('#explain-area');
  ok(/brand new/.test(explain), '"why this grouping" reports how many pairings in the latest shuffle were brand new');

  await page.close();
}

/* ── 8. no console noise anywhere in this suite ────────────────────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await setUpRoster(page, NAMES, 'coverage');
  await generate(page, 3);
  await page.click('#view-pairing-grid-btn');
  await settle(page, 200);
  eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
