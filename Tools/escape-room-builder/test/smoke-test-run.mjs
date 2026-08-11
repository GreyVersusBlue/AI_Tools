// smoke-test-run.mjs — the escape room builder's teacher test run.
//
//   node Tools/escape-room-builder/test/smoke-test-run.mjs
//
// Before this, the only way to find out whether a station's answer was
// actually typeable was to print thirty QR codes, tape them round the room,
// and watch a class get stuck on a stray trailing space. "Test run" walks the
// chain in the builder, answering as a student would.
//
// The design decision under test is that it loads the REAL lock.html in an
// iframe rather than reimplementing the answer matching. A second copy of
// normalizeTextAnswer living in the builder would drift, and the day it
// drifted the test run would start certifying rooms that don't work. So the
// assertions below go through the actual player: type into its form, press
// its submit button, and watch its station counter move.
//
// The other half is isolation: the test run stamps the room id with ::test so
// lock.html's own progress key lands where no real player reads it, and the
// key is cleared on each run so a rehearsal never resumes yesterday's.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8197;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/019-escape-room-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

const STATIONS = [
  { clue: 'I have keys but open no locks. What am I?', answers: 'keyboard, a keyboard' },
  { clue: 'What has hands but cannot clap?', answers: 'a clock' },
];

const fillStation = async (p, i, clue, answers) => {
  const card = p.locator('.station-card').nth(i);
  await card.locator('.f-clue').fill(clue);
  await card.locator('.f-answers').fill(answers);
  await settle(p, 250);
};

/** The lock screen inside the modal. */
const lock = () => page.frameLocator('#testRunFrame');
const lockText = () => page.evaluate(() =>
  document.getElementById('testRunFrame').contentDocument.body.innerText);

console.log('Escape Room Builder — teacher test run');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);

/* ── 1. nothing to walk yet ────────────────────────────────────────────── */
eq(await page.evaluate(() => document.getElementById('testRunBtn').disabled), true,
   'a room with no finished station has nothing to test-run');

await fillStation(page, 0, STATIONS[0].clue, STATIONS[0].answers);
await page.click('#addStationBtn');
await settle(page, 300);
await fillStation(page, 1, STATIONS[1].clue, STATIONS[1].answers);
eq(await page.evaluate(() => document.getElementById('testRunBtn').disabled), false,
   'and enables as soon as there is a real chain');

/* ── 2. it opens the actual player, at station 1 ───────────────────────── */
await page.click('#testRunBtn');
await settle(page, 900);
eq(await page.evaluate(() => document.getElementById('testRunOverlay').hidden), false, 'the test run opens');
const frameSrc = await page.evaluate(() => document.getElementById('testRunFrame').src);
ok(/escape-room-builder\/lock\.html/.test(frameSrc), 'running the real student lock page, not a copy of it');
ok(/[?&]r=/.test(frameSrc), 'with the room encoded into it the same way a student link is');

let text = await lockText();
ok(/station 1 of 2/i.test(text), 'starting at station 1: ' + text.split('\n')[0]);
ok(text.includes(STATIONS[0].clue), 'showing the clue as typed in the builder');
ok(/2 stations/.test(await page.textContent('#testRunSub')), 'and the modal header counts the chain');

/* ── 3. a wrong answer is rejected by the real matcher ─────────────────── */
await lock().locator('input[type="text"]').first().fill('a piano');
await lock().locator('button[type="submit"]').first().click();
await settle(page, 500);
text = await lockText();
ok(/Not quite|So close/.test(text), 'a wrong answer is refused: ' + text.split('\n').filter(Boolean).pop());
ok(/station 1 of 2/i.test(text), 'and the chain does not advance');

/* ── 4. the right answer — through the real forgiveness rules ──────────── */
// Deliberately not the literal accepted string: capitals and punctuation that
// player is supposed to forgive. If the builder ever grew its own matcher,
// this is the assertion that would catch it drifting.
await lock().locator('input[type="text"]').first().fill('A Keyboard!');
await lock().locator('button[type="submit"]').first().click();
await settle(page, 900);
text = await lockText();
ok(/station 2 of 2/i.test(text), 'a correct answer unlocks the next station: ' + text.split('\n')[0]);
ok(text.includes(STATIONS[1].clue), 'showing the second clue');

await lock().locator('input[type="text"]').first().fill('a clock');
await lock().locator('button[type="submit"]').first().click();
await settle(page, 900);
text = await lockText();
ok(/escaped|done|finish|complete/i.test(text), 'and the last station finishes the room: ' + text.slice(0, 120).replace(/\n/g, ' | '));

/* ── 5. it cannot touch a real player's progress ───────────────────────── */
const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('escape-room-progress:') === 0));
eq(keys.length, 1, 'exactly one progress key was written: ' + JSON.stringify(keys));
ok(keys[0].endsWith('::test'), 'and it is the test one, which no student link ever reads: ' + keys[0]);

/* a real player's progress for the same room survives a test run */
const realKey = keys[0].replace('::test', '');
await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ current: 1, misses: {}, solved: { 0: true } })), realKey);
await page.click('#testRunRestartBtn');
await settle(page, 900);
eq(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).current, realKey), 1,
   'a genuine player’s progress for the same room is untouched by a rehearsal');

/* ── 6. "Start over" really starts over ────────────────────────────────── */
text = await lockText();
ok(/station 1 of 2/i.test(text), 'Start over returns to station 1 rather than resuming: ' + text.split('\n')[0]);

/* ── 7. closing stops the player and leaves the room alone ─────────────── */
const beforeClose = await page.inputValue('#playerLink');
await page.keyboard.press('Escape');
await settle(page, 300);
eq(await page.evaluate(() => document.getElementById('testRunOverlay').hidden), true, 'Escape closes the test run');
eq(await page.evaluate(() => document.getElementById('testRunFrame').getAttribute('src')), null,
   'and unloads the player, so a countdown is not still ticking behind the modal');
eq(await page.inputValue('#playerLink'), beforeClose, 'the real player link is unchanged by the rehearsal');
ok(!/::test/.test(beforeClose), 'and never carried the test room id in the first place');

/* ── 8. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
