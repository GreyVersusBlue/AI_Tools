// drive-weighting.mjs — the Name Picker's weighted-fairness option, in a browser.
//
//   node Tools/name-picker/test/drive-weighting.mjs
//
// smoke.mjs proves the maths: given lifetime pick counts, the draw leans toward
// whoever is behind, and a weighted round still calls everybody exactly once.
// What a pure suite cannot see is whether the page is actually handing those
// counts to the picker — a checkbox that persists nicely and changes nothing is
// the obvious way for this feature to be wrong.
//
// So this drives the real page: seed lopsided stats, turn the option on, press
// the button a few dozen times, and check who actually got called.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8162;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/007-Name%20Picker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 950 });

const ROSTER = ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Zheng He', 'Grace Hopper', 'Ida B Wells'];
const BEHIND = ROSTER[0];   // never called; everybody else is on 600

/* The deficit is deliberately enormous. Each pick also *increments* that
   student's count, so the lean self-corrects as it works — which is the right
   behaviour and a confound for a short measurement. The exact odds are
   smoke.mjs's job.

   It was 60 until 2026-09-05, and 60 was too small: `weight = max - count + 1`
   made the behind student 61/65 of each eligible draw at the start and only
   52/56 by the twentieth pick, because her own count had climbed to ~9 while
   everyone else stayed put. Feeding that chain into the no-repeat rule gives a
   long-run rate of ~47.9% rather than the ~50% ceiling, and **the `> 0.4`
   assertion below then failed 4.4% of runs** — measured over 200,000 simulated
   runs of the exact chain (uniformPick + fairnessWeights + the no-repeat rule),
   and observed for real in CI on 2026-09-05 at exactly 8/20. At 600 the
   self-correction is negligible over twenty picks (49.96% mean) and the same
   assertion fails 1 run in ~77,000. The assertion was not touched: the fixture
   was made big enough for the property it asserts to be true in practice. */

console.log('Name Picker — lean toward who has been called least');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* Seed a roster and a lifetime pick history that is badly lopsided — exactly
   the situation the option exists for. Written through the tool's own keys and
   picked up on reload. */
await page.evaluate(r => {
  const stats = {};
  r.forEach((n, i) => { stats[n] = i === 0 ? 0 : 600; });
  localStorage.setItem('np_current', JSON.stringify(r));
  localStorage.setItem('np_stats', JSON.stringify(stats));
}, ROSTER);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);

eq(await page.evaluate(() => document.querySelectorAll('.name-card').length), 6,
   'the roster is on the stage');

/* ── 1. the option exists, is off by default, and persists ─────────────── */
/* The settings tabs live in a slide-in panel, so it has to be opened first. */
const openOptions = async () => {
  if (!await page.evaluate(() => document.getElementById('settingsPanel').classList.contains('open'))) {
    await page.click('#settingsBtn');
    await settle(page, 250);
  }
  await page.click('button[data-tab="options"]');
  await settle(page, 150);
};
await openOptions();
const box = await page.$('#weightedFairness');
ok(box, 'the option has a checkbox');
eq(await page.isChecked('#weightedFairness'), false, 'and is off by default — it changes odds a teacher may be used to');

await page.check('#weightedFairness');
await settle(page, 300);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 500);
await openOptions();
eq(await page.isChecked('#weightedFairness'), true, 'the choice survives a reload');
ok(/"weighted":true/.test(await page.evaluate(() => localStorage.getItem('np_options') || '')),
   'stored alongside the other options rather than in a key of its own');

/* ── 2. it actually reaches the picker ─────────────────────────────────── */
/* Fair rotation is switched off for this measurement: with it on, a round
   calls everybody once no matter what, so the lean would be invisible when
   measured over whole rounds. Off, every draw is independent, and the odds are
   the whole effect. The animation is stripped down to keep 2x40 real picks to
   a sensible wall-clock. */
await page.uncheck('#fairRotation');
await page.uncheck('#soundToggle');
await page.uncheck('#confettiToggle');
await page.uncheck('#dramaticPause');
await page.uncheck('#rarityEnabled');
await page.check('#calmMode');
await page.evaluate(() => {
  const sp = document.getElementById('speed');
  sp.value = '40';
  sp.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.click('#closePanel');
await settle(page, 400);

/** One real press of PICK A NAME: roll, read the winner, dismiss the modal. */
async function draw() {
  await page.click('#pickBtn');
  await page.waitForSelector('#modalDone', { timeout: 20000 });
  const name = await page.evaluate(() => {
    const w = document.querySelector('.name-card.winner');
    return w ? w.textContent.trim() : null;
  });
  await page.click('#modalDone');
  await page.waitForFunction(() => !document.getElementById('pickBtn').disabled, null, { timeout: 20000 });
  return name;
}

/* Two budgets, because the two measurements are not equally noisy. Leaning is
   a ~50% event and twenty draws settle it; flat is a ~1-in-6 event, and twenty
   draws of that land on 7+ hits about 1 run in 92 — which is what made the
   `leanRate > flatRate + 0.15` line below fail 1.08% of runs on its own, a
   second flake behind the first. Forty flat draws take it to 1 run in ~4,500
   for the suite as a whole (300,000 simulated runs), at the cost of about 36
   seconds: each draw is a real UI roll of roughly two seconds, which is the
   only reason these numbers are not larger still. */
const TRIES_LEAN = 20;
const TRIES_FLAT = 40;
const measure = async (TRIES) => {
  const hits = { behind: 0, seen: new Set() };
  for (let i = 0; i < TRIES; i++) {
    const name = await draw();
    if (name) hits.seen.add(name);
    if (name && name.indexOf(BEHIND) === 0) hits.behind++;
  }
  return hits;
};

const lean = await measure(TRIES_LEAN);
const leanRate = lean.behind / TRIES_LEAN;
/* The ceiling here is 50%, not the ~92% the raw weights suggest: both pickers
   exclude whoever was called last, so no student can be drawn twice in a row
   however far behind they are. That rule outranks the lean by design — being
   called twice running is exactly what a teacher does not want — so a heavily
   favoured student alternates with the rest of the room. */
ok(leanRate > 0.4, `the student who is behind is drawn far more than 1 in 6 (got ${(leanRate * 100).toFixed(0)}% of ${TRIES_LEAN}, ceiling 50%)`);
ok(lean.seen.size >= 2, `and the rest of the class is still reachable (${lean.seen.size} different students in ${TRIES_LEAN} picks)`);

/* ── 3. with the option off, the same roster is drawn flat ─────────────── */
await openOptions();
await page.uncheck('#weightedFairness');
await settle(page, 200);
const flat = await measure(TRIES_FLAT);
const flatRate = flat.behind / TRIES_FLAT;
ok(flatRate < 0.45, `off, the student behind is back toward 1 in 6 (got ${(flatRate * 100).toFixed(0)}%)`);
/* The margin has to fit between the two bounds above, and those bounds are
   generous on purpose: leanRate is capped at 0.5 by the no-repeat rule, and
   flatRate is only asserted to be under 0.45 because a 1-in-6 chance is a noisy
   sample — five hits out of twenty (25%) happens about a quarter of the time.
   Demanding a 0.25 gap was therefore self-contradictory with the line above it
   and failed roughly one run in four for no reason but luck. 0.15 is still a
   difference nobody would miss (a student drawn 40%+ of the time versus 25%),
   and it cannot be defeated by a sample the preceding assertion accepts. The
   remaining noise was answered by TRIES_FLAT rather than by a wider margin —
   see the note on the budgets above. */
ok(leanRate > flatRate + 0.15, `the option makes a difference a teacher would see (${(flatRate * 100).toFixed(0)}% -> ${(leanRate * 100).toFixed(0)}%)`);
console.log(`  the student six hundred calls behind was picked ${(flatRate * 100).toFixed(0)}% of the time plain, ${(leanRate * 100).toFixed(0)}% leaning`);

/* ── 5. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 4)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 4)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
