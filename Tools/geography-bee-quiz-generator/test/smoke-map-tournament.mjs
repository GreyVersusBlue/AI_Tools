// smoke-map-tournament.mjs — map questions and team tournament mode
// (SS demo round 2).
//
//   node Tools/geography-bee-quiz-generator/test/smoke-map-tournament.mjs
//
// Two features, one suite, because they meet on the projector tab.
//
// The map half is the one worth being paranoid about: it draws pixels from
// another tool's vendored geometry, and "the map appeared" is a much weaker
// claim than "the map shows the right country". So rather than checking that
// an <img> exists, this projects a known lat/lon through the same plate carrée
// the renderer uses and reads the actual pixel back — Texas must come out
// highlight-coloured and California must not, on the same image. It also
// checks the reverse: two different regions on the same crop must not produce
// the same PNG.
//
// The tournament half is arithmetic and persistence: points land on the team
// that was up, the turn rotates, and an in-progress game survives the laptop
// lid closing.
//
// Exits 1 on any failure. Every team name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8222;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/062-geography-bee-quiz-generator.html';
const CUSTOM_KEY = 'gbq_custom_v1';
const TOURNAMENT_KEY = 'gbq_tournament_v1';

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
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('Geography Bee Quiz Generator — map questions and team tournament');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. the bank grew a fourth category without disturbing the first three ─ */
const bank = await page.evaluate(() => {
  const all = window.__gbqTestHooks.allQuestions().filter(q => !q.custom);
  const byCat = {};
  all.forEach(q => { byCat[q.category] = (byCat[q.category] || 0) + 1; });
  const maps = all.filter(q => q.category === 'maps');
  return {
    total: all.length, byCat,
    firstMapId: maps[0] && maps[0].id,
    lastMapId: maps[maps.length - 1] && maps[maps.length - 1].id,
    bi0: all.find(q => q.id === 'bi0'),
    bi89: all.find(q => q.id === 'bi89'),
    everyMapHasSpec: maps.every(q => q.map && q.map.region && (q.map.dataset === 'us' || q.map.dataset === 'world')),
    datasets: maps.reduce((acc, q) => { acc[q.map.dataset] = (acc[q.map.dataset] || 0) + 1; return acc; }, {}),
    answersAreRegions: maps.every(q => q.a && q.a !== q.q),
  };
});
eq(bank.total, 120, 'the built-in bank is 120 questions');
eq(bank.byCat.capitals, 30, 'capitals is untouched at 30');
eq(bank.byCat.landmarks, 30, 'landmarks is untouched at 30');
eq(bank.byCat.mapskills, 30, 'map skills is untouched at 30');
eq(bank.byCat.maps, 30, 'the new maps category has 30 questions');
eq(bank.firstMapId, 'bi90', 'map question ids continue straight after bi89 rather than renumbering anything');
eq(bank.lastMapId, 'bi119', 'and run to bi119');
eq(bank.bi0 && bank.bi0.a, 'Paris', 'bi0 is still the France/Paris capitals question — no built-in was shifted');
eq(bank.bi89 && bank.bi89.category, 'mapskills', 'bi89 is still the last map-skills question');
ok(bank.everyMapHasSpec, 'every map question carries a dataset + region to draw');
eq(bank.datasets.us, 15, '15 US state questions');
eq(bank.datasets.world, 15, '15 world country questions');
ok(bank.answersAreRegions, 'every map question has an answer distinct from its prompt');

/* ── 2. every built-in map question actually draws ───────────────────────
   A typo in a region name ("Dem. Rep. Congo" is easy to get wrong) would only
   surface the day a teacher lands on that question. Draw all 30 now. */
const drawAll = await page.evaluate(async () => {
  const m = await window.__gbqTestHooks.mapModule();
  const maps = window.__gbqTestHooks.allQuestions().filter(q => q.category === 'maps' && !q.custom);
  const bad = [];
  for (const q of maps) {
    try {
      const res = await m.renderSnippet({ dataset: q.map.dataset, region: q.map.region, context: q.map.context, width: 120, ratio: 1 });
      if (!/^data:image\/png;base64,/.test(res.url) || res.url.length < 500) bad.push(q.map.region + ' (empty image)');
      if (res.crop !== q.map.context) bad.push(q.map.region + ' (drew on ' + res.crop + ')');
    } catch (e) { bad.push(q.map.region + ': ' + e.message); }
  }
  return bad;
});
same(drawAll, [], 'all 30 built-in map questions render a non-empty snippet on their stated crop');

/* ── 3. the highlighted region is the answer, not just some colour ────────
   Project two known points through the same plate carrée the renderer uses and
   read the pixels back off a Texas-on-the-lower-48 snippet. */
const pixels = await page.evaluate(async () => {
  const m = await window.__gbqTestHooks.mapModule();
  const res = await m.renderSnippet({ dataset: 'us', region: 'Texas', context: 'usa-48', width: 600, ratio: 1 });
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = res.url; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const B = { north: 50, south: 24, west: -125, east: -66.5 };
  const at = (lon, lat) => {
    const x = Math.round(((lon - B.west) / (B.east - B.west)) * img.width);
    const y = Math.round(((B.north - lat) / (B.north - B.south)) * img.height);
    const d = ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const tally = {};
  const all = ctx.getImageData(0, 0, img.width, img.height).data;
  for (let i = 0; i < all.length; i += 4) {
    const k = all[i] + ',' + all[i + 1] + ',' + all[i + 2];
    tally[k] = (tally[k] || 0) + 1;
  }
  const distinct = Object.keys(tally).length;
  const other = await m.renderSnippet({ dataset: 'us', region: 'California', context: 'usa-48', width: 600, ratio: 1 });
  return {
    size: [img.width, img.height],
    texas: at(-99.5, 31.5),          // central Texas — the answer
    california: at(-119.5, 37.2),    // central California — context
    ocean: at(-70, 28),              // Atlantic, south-east of Florida
    distinct,
    sameAsCalifornia: other.url === res.url,
  };
});
ok(pixels.size[0] === 600 && pixels.size[1] > 100, `the snippet is a real bitmap (${pixels.size.join('x')})`);
same(pixels.texas, [179, 68, 31], 'a point inside Texas is painted the highlight colour');
same(pixels.california, [246, 242, 231], 'a point inside California — same map, wrong state — is plain land');
same(pixels.ocean, [231, 238, 244], 'a point out at sea is ocean');
ok(pixels.distinct > 3, `the snippet has real shading, not one flat colour (${pixels.distinct} distinct colours)`);
ok(!pixels.sameAsCalifornia, 'highlighting a different state on the same crop produces a different image');

/* ── 4. the projector shows the map for a map question ──────────────────── */
await page.selectOption('#categoryFilter', 'maps');
await page.selectOption('#formatSelect', 'mc');
await page.click('#applyFilterBtn');
await settle(page, 800);

const projector = await page.evaluate(() => {
  const img = document.querySelector('#displayMap img.map-snippet');
  return {
    hidden: document.getElementById('displayMap').classList.contains('hidden'),
    hasImg: !!img,
    complete: img ? img.complete && img.naturalWidth > 0 : false,
    isDataUrl: img ? /^data:image\/png/.test(img.getAttribute('src')) : false,
    alt: img ? img.alt : '',
    q: document.getElementById('displayQ').textContent,
  };
});
eq(projector.hidden, false, 'the map panel is shown for a map question');
ok(projector.hasImg && projector.complete, 'a map image is drawn and decoded on the projector display');
ok(projector.isDataUrl, 'the map is an inline data URL — nothing is fetched from anywhere at display time');
ok(/outline map/i.test(projector.alt), 'the map image carries alt text: ' + JSON.stringify(projector.alt));
ok(/highlighted on the map/.test(projector.q), 'the question reads as a map question: ' + projector.q);

/* ── 5. map multiple-choice options are same-category region names ───────
   Walk the whole maps rotation: a "which US state" question must never be
   offered a country as a wrong answer, and vice versa. */
const walk = await page.evaluate(async () => {
  const H = window.__gbqTestHooks;
  const m = await H.mapModule();
  const usNames = new Set(m.regionsFor('us').map(r => r.label));
  const worldNames = new Set(m.regionsFor('world').map(r => r.label));
  const pool = H.filteredQuestions();
  const problems = [];
  let checked = 0;
  pool.forEach(item => {
    if (!item.map) return;
    const opts = H.buildMcOptions(item, pool, Math.random);
    if (!opts) { problems.push(item.a + ': no options at all'); return; }
    checked++;
    if (opts.length !== 4) problems.push(item.a + ': ' + opts.length + ' options');
    if (opts.filter(o => o.correct).length !== 1) problems.push(item.a + ': not exactly one correct');
    const right = opts.find(o => o.correct);
    if (!right || right.text !== item.a) problems.push(item.a + ': correct option text is wrong');
    const wanted = item.map.dataset === 'us' ? usNames : worldNames;
    const stray = opts.filter(o => !o.correct).map(o => o.text).filter(t => !wanted.has(t));
    if (stray.length) problems.push(item.a + ' (' + item.map.dataset + ') got: ' + stray.join(', '));
    if (new Set(opts.map(o => o.text.toLowerCase())).size !== opts.length) problems.push(item.a + ': duplicate options');
  });
  return { problems, checked };
});
eq(walk.checked, 30, 'all 30 map questions produced a full option set');
same(walk.problems, [], 'every map distractor is another region name from the same dataset — never a country against a state question');

/* ── 6. printed quiz embeds the snippet, and the key still matches ──────── */
await page.click('[data-stage="sheet"]');
await settle(page, 150);
await page.fill('#sheetCount', '6');
await page.fill('#quizVersion', '7');
await page.evaluate(() => window.__gbqTestHooks.buildSheet());
await settle(page, 1200);

const sheet = await page.evaluate(() => {
  const problems = Array.from(document.querySelectorAll('#sheetProblems .problem'));
  const keyItems = Array.from(document.querySelectorAll('#sheetKey li'));
  return {
    problemCount: problems.length,
    withMaps: problems.filter(p => p.querySelector('img.map-snippet')).length,
    allDataUrls: problems.every(p => {
      const img = p.querySelector('img.map-snippet');
      return img && /^data:image\/png/.test(img.getAttribute('src'));
    }),
    keyThumbs: keyItems.filter(li => li.querySelector('img.map-snippet')).length,
    // The key thumbnail must be the same picture the student got, not a
    // re-render that could have drifted.
    thumbsMatch: problems.every((p, i) => {
      const a = p.querySelector('img.map-snippet');
      const b = keyItems[i] && keyItems[i].querySelector('img.map-snippet');
      return a && b && a.getAttribute('src') === b.getAttribute('src');
    }),
    keyMatchesPaper: problems.every((p, i) => {
      const line = keyItems[i].textContent;
      const m = line.match(/^\d+\.\s*([A-D])\s—\s(.+)$/);
      if (!m) return false;
      const opts = Array.from(p.querySelectorAll('.mc-print-opt')).map(o => o.textContent);
      const optLine = opts.find(o => o.startsWith(m[1] + '.'));
      return !!optLine && optLine.slice(3).trim() === m[2].trim();
    }),
  };
});
eq(sheet.problemCount, 6, 'six questions printed');
eq(sheet.withMaps, 6, 'every printed map question carries its own inline map image');
ok(sheet.allDataUrls, 'the printed maps are inline data URLs, so the paper prints offline');
eq(sheet.keyThumbs, 6, 'the answer key repeats each map as a thumbnail for grading');
ok(sheet.thumbsMatch, 'the key thumbnail is the identical image the student saw, not a second render');
ok(sheet.keyMatchesPaper, 'each key line names the letter that actually carries that answer on the paper');

// Same version, same paper — including the pictures.
const capture = () => page.evaluate(() => ({
  problems: document.getElementById('sheetProblems').innerHTML,
  key: document.getElementById('sheetKey').innerHTML,
}));
const firstBuild = await capture();
await page.evaluate(() => window.__gbqTestHooks.buildSheet());
await settle(page, 1200);
same(await capture(), firstBuild, 'rebuilding version 7 reproduces the identical map quiz, images and all');

await page.click('#newVersionBtn');
await settle(page, 1200);
ok(JSON.stringify(await capture()) !== JSON.stringify(firstBuild), 'a new version draws a different set of maps');

/* ── 7. generating map questions in bulk ────────────────────────────────── */
await page.click('[data-stage="bank"]');
await settle(page, 150);
await page.selectOption('#mapGenDataset', 'us');
await page.fill('#mapGenCount', '5');
await page.click('#mapGenBtn');
await settle(page, 700);

const generated = await page.evaluate(() => {
  const custom = JSON.parse(localStorage.getItem('gbq_custom_v1') || '[]');
  const builtInRegions = new Set(
    window.__gbqTestHooks.allQuestions()
      .filter(q => !q.custom && q.map && q.map.dataset === 'us')
      .map(q => q.map.region)
  );
  return {
    count: custom.length,
    allMaps: custom.every(c => c.category === 'maps' && c.map && c.map.dataset === 'us'),
    noneDuplicateBuiltIn: custom.every(c => !builtInRegions.has(c.map.region)),
    uniqueRegions: new Set(custom.map(c => c.map.region)).size,
    haveCrops: custom.every(c => !!c.map.context),
    note: document.getElementById('mapGenNote').textContent,
  };
});
eq(generated.count, 5, 'five map questions were generated into the custom bank');
ok(generated.allMaps, 'each generated question is a US-state map question');
ok(generated.noneDuplicateBuiltIn, 'the generator skips states that already have a built-in map question');
eq(generated.uniqueRegions, 5, 'and does not repeat a state within one run');
ok(generated.haveCrops, 'each generated question knows which crop to draw on');
ok(/Added 5 map questions/.test(generated.note), 'the note reports what happened: ' + generated.note);

// A second run must keep going, not hand back the same five.
await page.click('#mapGenBtn');
await settle(page, 700);
const secondRun = await page.evaluate(() => {
  const custom = JSON.parse(localStorage.getItem('gbq_custom_v1') || '[]');
  return { count: custom.length, unique: new Set(custom.map(c => c.map.region)).size };
});
eq(secondRun.count, 10, 'running the generator again adds five more');
eq(secondRun.unique, 10, 'all ten are different states');

// And a generated question draws like a built-in one.
const generatedDraws = await page.evaluate(async () => {
  const m = await window.__gbqTestHooks.mapModule();
  const c = JSON.parse(localStorage.getItem('gbq_custom_v1') || '[]')[0];
  const res = await m.renderSnippet({ dataset: c.map.dataset, region: c.map.region, context: c.map.context, width: 120, ratio: 1 });
  return /^data:image\/png;base64,/.test(res.url) && res.url.length > 500;
});
ok(generatedDraws, 'a generated map question renders the same way a built-in one does');

await page.evaluate(k => localStorage.removeItem(k), CUSTOM_KEY);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 8. team tournament: scoring, turn order, standings ──────────────────── */
await page.click('[data-stage="display"]');
await page.click('#tourToggleBtn');
await settle(page, 150);
await page.selectOption('#tourTeams', '3');
await settle(page, 150);
const nameCount = await page.$$eval('#tourNames input', els => els.length);
eq(nameCount, 3, 'choosing 3 teams gives three name boxes');

await page.fill('#tourNames input[data-team="0"]', 'Cartographers');
await page.fill('#tourNames input[data-team="1"]', 'Compass Roses');
await page.fill('#tourNames input[data-team="2"]', 'Latitude Ladies');
await page.fill('#tourPoints', '2');
await page.click('#tourStartBtn');
await settle(page, 250);

const started = await page.evaluate(() => ({
  teams: window.__gbqTestHooks.tournament().teams.map(t => t.name),
  points: window.__gbqTestHooks.tournament().points,
  board: document.getElementById('tourBoard').textContent,
  turnLine: document.getElementById('tourTurn').textContent,
  upCount: document.querySelectorAll('#tourBoard .tour-team.up').length,
  rightDisabled: document.getElementById('tourRightBtn').disabled,
}));
same(started.teams, ['Cartographers', 'Compass Roses', 'Latitude Ladies'], 'the teams are the names the teacher typed');
eq(started.points, 2, 'the points-per-question setting is kept');
ok(/Cartographers/.test(started.turnLine), 'team 1 is up first: ' + started.turnLine);
eq(started.upCount, 1, 'exactly one team is marked as up on the scoreboard');
eq(started.rightDisabled, true, 'scoring is locked until the answer is revealed');

await page.click('#revealBtn');
await settle(page, 120);
eq(await page.$eval('#tourRightBtn', e => e.disabled), false, 'revealing the answer unlocks the scoring buttons');

// Cartographers right, Compass Roses wrong, Latitude Ladies right,
// Cartographers right.  Expected: 4, 0, 2.
const marks = [true, false, true, true];
for (const right of marks) {
  // Reveal is a toggle, and the check above already left the first answer
  // showing — clicking it blindly would hide it and re-lock scoring.
  if (!await page.$eval('#displayA', e => e.classList.contains('shown'))) {
    await page.click('#revealBtn');
    await settle(page, 100);
  }
  await page.click(right ? '#tourRightBtn' : '#tourWrongBtn');
  await settle(page, 400);
}
const scored = await page.evaluate(() => {
  const t = window.__gbqTestHooks.tournament();
  return { scores: t.teams.map(x => x.score), turn: t.turn, asked: t.asked, locked: document.getElementById('tourRightBtn').disabled };
});
same(scored.scores, [4, 0, 2], 'points land on the team that was actually up, at 2 a question');
eq(scored.asked, 4, 'four questions were scored');
eq(scored.turn, 1, 'the turn wrapped back round to team 2');
eq(scored.locked, true, 'scoring re-locks on the next question, so one question cannot be scored twice');

/* ── 9. the game survives the laptop being closed ───────────────────────── */
const savedRaw = await page.evaluate(k => localStorage.getItem(k), TOURNAMENT_KEY);
ok(!!savedRaw, 'the in-progress game is written to localStorage');
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
const afterReload = await page.evaluate(() => {
  const t = window.__gbqTestHooks.tournament();
  return {
    scores: t ? t.teams.map(x => x.score) : null,
    names: t ? t.teams.map(x => x.name) : null,
    turn: t ? t.turn : null,
    cardShown: document.getElementById('tournamentCard').style.display !== 'none',
    liveShown: document.getElementById('tourLive').style.display !== 'none',
    boardText: document.getElementById('tourBoard').textContent,
  };
});
same(afterReload.scores, [4, 0, 2], 'the scores survive a reload');
same(afterReload.names, ['Cartographers', 'Compass Roses', 'Latitude Ladies'], 'so do the team names');
eq(afterReload.turn, 1, 'and whose turn it is');
ok(afterReload.cardShown && afterReload.liveShown, 'the tournament panel reopens itself rather than making the teacher set it up again');
ok(/Cartographers/.test(afterReload.boardText), 'the scoreboard redraws: ' + afterReload.boardText.replace(/\s+/g, ' ').trim());

/* ── 10. final standings ────────────────────────────────────────────────── */
await page.click('#tourStandingsBtn');
await settle(page, 200);
const standings = await page.evaluate(() => ({
  shown: document.getElementById('tourStandings').style.display !== 'none',
  liveHidden: document.getElementById('tourLive').style.display === 'none',
  lines: Array.from(document.querySelectorAll('#tourStandingsList li')).map(li => li.textContent.replace(/\s+/g, ' ').trim()),
}));
ok(standings.shown && standings.liveHidden, 'the standings screen replaces the play controls');
eq(standings.lines.length, 3, 'all three teams are listed');
ok(/^1\. Cartographers — 4 points$/.test(standings.lines[0]), 'the winner is first: ' + standings.lines[0]);
ok(/^2\. Latitude Ladies — 2 points$/.test(standings.lines[1]), 'then second place: ' + standings.lines[1]);
ok(/^3\. Compass Roses — 0 points$/.test(standings.lines[2]), 'then last: ' + standings.lines[2]);

await page.click('#tourNewBtn');
await settle(page, 200);
const cleared = await page.evaluate(k => ({
  tour: window.__gbqTestHooks.tournament(),
  stored: localStorage.getItem(k),
  setupShown: document.getElementById('tourSetup').style.display !== 'none',
}), TOURNAMENT_KEY);
eq(cleared.tour, null, 'starting a new tournament clears the old game');
eq(cleared.stored, null, 'and clears it from storage rather than leaving a ghost to restore');
ok(cleared.setupShown, 'the setup form comes back');

/* ── 11. short-answer map questions still work (regression) ─────────────── */
await page.selectOption('#categoryFilter', 'maps');
await page.selectOption('#formatSelect', 'short');
await page.click('#applyFilterBtn');
await settle(page, 800);
const shortMode = await page.evaluate(() => ({
  optionsHidden: document.getElementById('displayOptions').classList.contains('hidden'),
  hasMap: !!document.querySelector('#displayMap img.map-snippet'),
}));
ok(shortMode.optionsHidden, 'short-answer mode hides the lettered options on a map question');
ok(shortMode.hasMap, 'but still shows the map — that is the whole question');
await page.click('#revealBtn');
await settle(page, 150);
const revealed = await page.textContent('#displayA');
ok(revealed.trim().length > 0 && !/^Correct answer:/.test(revealed), 'reveal shows the plain region name: ' + revealed);

/* ── 12. no console noise, nothing left the site ─────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
