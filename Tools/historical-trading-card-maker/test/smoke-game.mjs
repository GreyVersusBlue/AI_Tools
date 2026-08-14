// smoke-game.mjs — the class review game, plus the subject theme packs and
// their sample decks.
//
//   node Tools/historical-trading-card-maker/test/smoke-game.mjs
//
// What matters here, and why:
//
//   1. The game deals without repeats. "No repeats until the deck cycles" is
//      the promise that stops a review game from asking the same two figures
//      four times, so the suite plays a 12-card deck all the way to the end
//      of the pass and checks every id it saw was seen exactly once.
//   2. The stat comparison scores the right team. Computed from the deck
//      itself rather than hard-coded, because the deal is shuffled: the suite
//      reads the persisted game state to learn which two cards came up, works
//      out who should win the shared stat, then checks the scoreboard agrees.
//   3. A game survives a reload. The scoreboard is the thing a teacher can't
//      reconstruct, so it is stored under `htcm:game` and picked up by
//      Resume — including the pair mid-round.
//   4. The new themes don't move the card. The subject packs are additive
//      theme data, and a card printed under "Science lab" must still measure
//      2.5 × 3.5in with its frame adding no layout size.
//   5. Every theme pack's sample deck loads, under its own name and theme,
//      and the original history sample still loads exactly as it did.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8301;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/064-historical-trading-card-maker.html';
const IN = 96;            // CSS inches → px
const PAGE_MARGIN = 0.3;  // must match the @page rule in the tool

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, tol, label) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ±${tol})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Trading Card Maker — review game, subject theme packs, theme sample decks');

const gameState = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('htcm:game') || 'null'));

/* ── 1. the setup gate: an empty deck can't start a game ─────────────────── */
const page = await prepPage(browser, BASE, { width: 1400, height: 950 });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

eq(await page.isDisabled('#gmStartBtn'), true, 'an empty deck cannot start a review game');
ok(/at least 4/.test(await page.textContent('#gmSetupNote')),
   'and the note says how many cards with a comparable stat it needs');
eq(await page.isVisible('#gameOverlay'), false, 'the projector view stays closed until a game starts');

/* ── 2. the round-1 sample deck plays out of the box ─────────────────────── */
await page.click('#sampleDeckBtn');
await settle(page, 300);
eq(await page.inputValue('#deckSelect'), 'Sample deck', 'the history sample deck still loads under its original name');
eq(await page.textContent('#entryCount'), '5', 'with its five cards');
eq(await page.isDisabled('#gmStartBtn'), false, 'the sample deck can start a game with no other setup — a two-click demo');

await page.selectOption('#gmTeamCount', '2');
await settle(page, 100);
eq(await page.evaluate(() => document.querySelectorAll('#gmTeamNames input').length), 2,
   'the team-name boxes follow the team count');
await page.fill('#gmTeamNames input:nth-of-type(1)', 'Blue');
await page.fill('#gmTeamNames input:nth-of-type(2)', 'Gold');
await page.click('#gmStartBtn');
await settle(page, 250);

eq(await page.isVisible('#gameOverlay'), true, 'starting opens the projector view');
let st = await gameState(page);
eq(st.phase, 'draw', 'the round opens with the cards face down');
eq(await page.evaluate(() => document.querySelectorAll('#gameOverlay .gcard-down').length), 2,
   'both cards are face down');
ok(/Blue/.test(await page.textContent('#gmScores')) && /Gold/.test(await page.textContent('#gmScores')),
   'the scoreboard carries the typed team names');
ok(/Reveal/.test(await page.textContent('#gmPrimaryBtn')), 'the teacher is prompted to reveal, not the students');

await page.click('#gmPrimaryBtn');
await settle(page, 150);
st = await gameState(page);
eq(st.phase, 'reveal', 'revealing moves the round on');
ok(/What do you remember about/.test(await page.textContent('#gmMid')),
   'the recall question is on screen before any stat is compared');
ok(await page.evaluate(() => !!document.querySelector('#gmCardA .gcard-inner .trading-card')),
   'the revealed card is a real rendered card, not a second design');
eq(await page.evaluate(() => document.querySelectorAll('#gameOverlay .gcard-down').length), 1,
   'the challenger card is still face down');
ok((await page.textContent('#gmFacts')).length > 40, 'the card’s fact lines are on screen as the talking point');
ok(await page.evaluate(() => document.querySelectorAll('#gmMid .gm-cat').length > 0),
   'and there is at least one stat to play the round on');

/* the facts can be hidden, for a teacher who wants answers first */
await page.click('#gmFactsToggle');
await settle(page, 100);
eq(await page.textContent('#gmFacts'), '', 'the facts can be hidden until the class has answered');
await page.click('#gmFactsToggle');
await settle(page, 100);
ok((await page.textContent('#gmFacts')).length > 40, 'and brought back');

await page.click('#gmMid .gm-cat');
await settle(page, 150);
st = await gameState(page);
eq(st.phase, 'compare', 'picking a stat resolves the round');
eq(await page.evaluate(() => document.querySelectorAll('#gameOverlay .gcard-down').length), 0,
   'both cards are face up for the comparison');
ok(['a', 'b', 'tie'].indexOf(st.result.winner) !== -1, 'the round has a verdict');
eq(st.teams.reduce((n, t) => n + t.score, 0), st.result.winner === 'tie' ? 0 : 1,
   'exactly one point is awarded, and none at all on a tie');
ok((await page.textContent('#gmFacts')).length > 40,
   'both cards’ facts are on screen for the "why it matters" beat');

/* ── 3. a full pass through a 12-card deck deals with no repeats ─────────── */
const drive = await prepPage(browser, BASE, { width: 1400, height: 950 });
await drive.goto(URL_PAGE, { waitUntil: 'networkidle' });
await drive.evaluate(() => {
  const cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push({
      id: 'g' + i,
      name: 'Figure ' + (i + 1),
      image: null,
      // one stat every card shares, with a value nobody else has: the round
      // outcome is then fully determined by which two cards came up
      stats: [{ label: 'Impact', value: (i + 1) + '/12' }, { label: 'Born', value: String(1700 + i) }],
      facts: ['Fact one about figure ' + (i + 1) + '.', 'Fact two about figure ' + (i + 1) + '.'],
      meta: { rarity: 'common', setName: 'Drive Deck', cardNo: i + 1, setSize: 12, stars: 0 },
      theme: null
    });
  }
  localStorage.setItem('htcm:list', JSON.stringify(['Drive deck']));
  localStorage.setItem('htcm:data:Drive deck', JSON.stringify({ v: 2, cards, settings: { size: 'standard', theme: 'classic' } }));
  localStorage.setItem('htcm:current', 'Drive deck');
});
await drive.reload({ waitUntil: 'networkidle' });
await settle(drive, 300);
eq(await drive.textContent('#entryCount'), '12', 'a 12-card deck is loaded');

await drive.selectOption('#gmTeamCount', '3');
await settle(drive, 100);
await drive.click('#gmStartBtn');
await settle(drive, 250);

// card id 'gI' carries "Impact: (I+1)/12", so the expected winner of an
// Impact round is computable from the ids the deal happened to turn up
const impactOf = (id) => Number(String(id).replace('g', '')) + 1;
let scoredRounds = 0, checkedScoring = 0, guard = 0;
let state = await gameState(drive);
while (state.phase !== 'done' && guard++ < 60) {
  if (state.phase === 'draw') {
    await drive.click('#gmPrimaryBtn');
  } else if (state.phase === 'reveal') {
    // pick the shared "Impact" category by name, and predict the winner
    const picked = await drive.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#gmMid .gm-cat'))
        .filter(b => b.getAttribute('data-cat') === 'impact')[0];
      if (!btn) return false;
      btn.click();
      return true;
    });
    ok(picked, 'the stat both cards share is offered as a category');
    await settle(drive, 80);
    const after = await gameState(drive);
    const aVal = impactOf(after.a);
    const bVal = impactOf(after.b);
    const want = aVal > bVal ? 'a' : (bVal > aVal ? 'b' : 'tie');
    eq(after.result.winner, want, `the higher Impact wins the round (${aVal} vs ${bVal})`);
    checkedScoring++;
    if (want !== 'tie') scoredRounds++;
    state = after;
    continue;
  } else if (state.phase === 'compare') {
    await drive.click('#gmPrimaryBtn');
  }
  await settle(drive, 80);
  state = await gameState(drive);
}
eq(state.phase, 'done', 'the pass ends when the deck runs out of pairs');
ok(checkedScoring >= 5, `every round was scored from the deck itself (${checkedScoring} rounds checked)`);
eq(state.drawn.length, new Set(state.drawn).size, 'no card was dealt twice in one pass through the deck');
eq(state.drawn.length, 12, 'and every card in the deck was dealt exactly once');
eq(state.queue.length, 0, 'the queue is empty at the end of the pass');
eq(state.teams.reduce((n, t) => n + t.score, 0), scoredRounds,
   'the scoreboard totals exactly the rounds that were not ties');
ok(/That’s the deck/.test(await drive.textContent('#gmMid')), 'the end-of-deck screen says so');
ok(await drive.evaluate(() => document.querySelectorAll('.gm-standings .gm-row').length === 3),
   'and shows final standings for all three teams');

/* another pass keeps the scores and re-fills the queue */
const scoresBefore = (await gameState(drive)).teams.map(t => t.score);
await drive.click('#gmPrimaryBtn');
await settle(drive, 200);
const reshuffled = await gameState(drive);
eq(reshuffled.pass, 2, 'shuffling starts a second pass');
eq(reshuffled.teams.map(t => t.score).join(','), scoresBefore.join(','), 'with the scores carried over');
ok(reshuffled.queue.length + reshuffled.drawn.length === 12, 'and the whole deck back in play');

/* ── 4. an accidental reload doesn't cost the scoreboard ─────────────────── */
const before = await gameState(drive);
await drive.reload({ waitUntil: 'networkidle' });
await settle(drive, 300);
eq(await drive.isVisible('#gameOverlay'), false, 'a reload lands back on the editor, not mid-game');
eq(await drive.isVisible('#gmResumeBtn'), true, 'with a Resume button offered');
ok(/round/.test(await drive.textContent('#gmResumeBtn')), 'that names the round it left off on');
await drive.click('#gmResumeBtn');
await settle(drive, 250);
const after = await gameState(drive);
eq(await drive.isVisible('#gameOverlay'), true, 'resuming reopens the projector view');
eq(after.round, before.round, 'on the same round');
eq(after.teams.map(t => t.score).join(','), before.teams.map(t => t.score).join(','), 'with the scoreboard intact');
eq(after.a + '/' + after.b, before.a + '/' + before.b, 'and the same two cards still in play');

/* ending the game clears it for good */
drive.once('dialog', d => d.accept());
await drive.click('#gmEndBtn');
await settle(drive, 200);
eq(await drive.evaluate(() => localStorage.getItem('htcm:game')), null, 'ending the game clears the stored state');
eq(await drive.isVisible('#gmResumeBtn'), false, 'and takes the Resume button away');

/* ── 5. the subject theme packs render without moving the card ───────────── */
const themed = await prepPage(browser, BASE, { width: 1280, height: 900 });
await themed.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(themed, 300);

for (const key of ['science', 'blueprint', 'literary', 'vocab']) {
  ok(await themed.evaluate(k => !!document.querySelector('.theme-swatch[data-theme="' + k + '"]'), key),
     `the "${key}" subject theme has a swatch`);
}
const eraStillThere = await themed.evaluate(() =>
  ['classic', 'parchment', 'medieval', 'renaissance', 'deco', 'sport', 'scifi']
    .every(k => !!document.querySelector('.theme-swatch[data-theme="' + k + '"]')));
ok(eraStillThere, 'and all seven era themes are untouched');

const defaultHint = await themed.getAttribute('#newStats', 'placeholder');
await themed.click('.theme-swatch[data-theme="science"]');
await settle(themed, 150);
const scienceHint = await themed.getAttribute('#newStats', 'placeholder');
ok(/Atomic number/.test(scienceHint), 'picking Science lab suggests science stats in the form: ' + JSON.stringify(scienceHint));
await themed.click('.theme-swatch[data-theme="parchment"]');
await settle(themed, 150);
eq(await themed.getAttribute('#newStats', 'placeholder'), defaultHint,
   'an era theme keeps the tool’s original placeholder, unchanged');

await themed.fill('#newName', 'Oxygen');
await themed.fill('#newStats', 'Symbol: O\nAtomic number: 8\nAbundance on Earth: 10/10');
await themed.fill('#newFacts', 'About 21% of the air is oxygen.');
await themed.click('#addEntryBtn');
await settle(themed, 200);
await themed.click('.theme-swatch[data-theme="science"]');
await settle(themed, 200);
ok(await themed.evaluate(() => !!document.querySelector('#previewFront .trading-card.theme-science')),
   'a card renders under the science theme');
ok(await themed.evaluate(() => !!document.querySelector('#previewFront .trading-card .card-frame')),
   'with its frame overlay');

const box = await themed.evaluate(({ inch, margin }) => {
  window.print = function () {};
  document.getElementById('printBtn').click();
  const probe = document.getElementById('printArea').cloneNode(true);
  probe.style.display = 'block';
  probe.style.position = 'absolute';
  probe.style.left = '-10000px';
  probe.style.width = (8.5 - margin * 2) * inch + 'px';
  document.body.appendChild(probe);
  const card = probe.querySelector('.trading-card');
  const r = card.getBoundingClientRect();
  const out = { w: r.width, h: r.height, themed: card.classList.contains('theme-science') };
  probe.remove();
  return out;
}, { inch: IN, margin: PAGE_MARGIN });
eq(box.themed, true, 'the print run uses the new theme');
near(box.w / IN, 2.5, 0.02, 'and a science-themed card still measures 2.5in across');
near(box.h / IN, 3.5, 0.02, 'and 3.5in tall — the new frames add no layout size');

/* ── 6. one sample deck per theme pack ───────────────────────────────────── */
const samples = await prepPage(browser, BASE, { width: 1280, height: 900 });
await samples.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(samples, 300);
const options = await samples.evaluate(() =>
  Array.from(document.getElementById('sampleSelect').options).map(o => o.textContent));
eq(options.length, 5, 'five sample decks are on offer: ' + JSON.stringify(options));
ok(/Founding figures/.test(options[0]), 'with the original history deck still first (so the button alone loads it)');

const expected = [
  { index: '1', deck: 'Elements sample deck', theme: 'science', has: 'Oxygen' },
  { index: '2', deck: 'Math concepts sample deck', theme: 'blueprint', has: 'Pi' },
  { index: '3', deck: 'Novel characters sample deck', theme: 'literary', has: 'Odysseus' },
  { index: '4', deck: 'Vocabulary sample deck', theme: 'vocab', has: 'Scarcity' },
];
for (const s of expected) {
  await samples.selectOption('#sampleSelect', s.index);
  await samples.click('#sampleDeckBtn');
  await settle(samples, 250);
  eq(await samples.inputValue('#deckSelect'), s.deck, `"${s.deck}" loads as its own deck`);
  const doc = await samples.evaluate(name => JSON.parse(localStorage.getItem('htcm:data:' + name)), s.deck);
  eq(doc.settings.theme, s.theme, `and arrives on the ${s.theme} theme`);
  eq(doc.cards.length, 4, 'with four cards');
  ok(doc.cards.some(c => c.name === s.has), `including ${s.has}`);
  ok(doc.cards.every(c => c.facts.length >= 3), 'each with real facts on the back');
  ok(doc.cards.every(c => !c.image), 'and no photos, which are always the teacher’s own');
  ok(await samples.evaluate(() => window.HtcmGame.eligible(
    JSON.parse(localStorage.getItem('htcm:data:' + document.getElementById('deckSelect').value)).cards).length >= 4),
     'every card in it can play the review game');
  eq(await samples.isDisabled('#gmStartBtn'), false, 'so the deck can start a game the moment it loads');
}

/* the subject decks are built to share stat labels, which is what makes them
   play as proper top-trumps rather than falling back on the wildcard */
await samples.selectOption('#deckSelect', 'Novel characters sample deck');
await settle(samples, 250);
await samples.click('#gmStartBtn');
await settle(samples, 250);
await samples.click('#gmPrimaryBtn');
await settle(samples, 150);
const cats = await samples.evaluate(() =>
  Array.from(document.querySelectorAll('#gmMid .gm-cat')).map(b => b.getAttribute('data-cat')));
ok(cats.indexOf('cleverness') !== -1 && cats.indexOf('courage') !== -1,
   'the literature deck offers its shared stats by name: ' + JSON.stringify(cats));
ok(cats.indexOf('*top') !== -1, 'with the "Top stat" wildcard always available as well');

/* ── 7. nothing noisy, nothing offsite ───────────────────────────────────── */
for (const [name, p] of [['sample-game', page], ['drive', drive], ['themes', themed], ['samples', samples]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 5)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 5)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
