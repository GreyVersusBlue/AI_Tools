// smoke-test-run.mjs — the escape room builder's teacher test-run mode, and
// the answer matcher it now shares with the student player page.
//
//   node Tools/escape-room-builder/test/smoke-test-run.mjs
//
// Proofreading a room by reading the answer key does not catch what actually
// breaks one: a clue that never says what to type, a branch pointing at a
// station that was later deleted, or a station nothing routes to. Walking the
// chain is the only way to find those, and until now that meant printing codes
// or playing the real player link for real.
//
// Two things are under test. First, the walk itself: same payload students
// get, same matcher they hit, nothing written to storage. Second — and this is
// the part that would rot silently — that lock.html and the builder really do
// share one matcher, so a test run can't pass an answer the student page would
// reject.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8183;
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

console.log('Escape Room — teacher test run');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── one matcher, two pages ─────────────────────────────────────────────
   Both the builder and lock.html load er-match.js; if either ever grew its
   own copy again, these agreements would be the first thing to break. */
const CASES = [
  [{ type: 'text', answers: ['a keyboard'] }, ' A Keyboard! ', true, 'text matching forgives case, spacing and punctuation'],
  [{ type: 'text', answers: ['a keyboard'] }, 'a keybard', false, 'a typo is not accepted'],
  [{ type: 'text', answers: ['3.14'], numericTolerance: 0.05 }, '3.1', true, 'numeric tolerance accepts a near value'],
  [{ type: 'text', answers: ['3.14'], numericTolerance: 0.05 }, '3.9', false, 'but not one outside the tolerance'],
  [{ type: 'digits', answers: ['4172'] }, '4172', true, 'a digit code matches exactly'],
  [{ type: 'digits', answers: ['4172'] }, '4173', false, 'a wrong digit does not'],
  [{ type: 'text', answers: ['mitosis'] }, '', false, 'an empty answer is never correct'],

  /* ── what "ignores punctuation" has to mean ──────────────────────────
     Each of these was a wrong answer on a correct student, and each one
     came out of a different line of normalizeTextAnswer. */
  [{ type: 'text', answers: ['well known'] }, 'well-known', true,
   'a hyphen separates rather than glues: well-known is well known'],
  [{ type: 'text', answers: ['state of the art'] }, 'state-of-the-art', true,
   'and it keeps separating past the first hyphen'],
  [{ type: 'text', answers: ['1/2'] }, '1 / 2', true,
   'spaces around a mark do not leave a phantom double space behind it'],
  [{ type: 'text', answers: ["it's a keyboard"] }, 'its a keyboard', true,
   'an apostrophe is deleted, not spaced: its and it’s are one word'],
  [{ type: 'text', answers: ["it's a keyboard"] }, 'it’s a keyboard', true,
   'including the curly one a phone or Word produces'],
  [{ type: 'text', answers: ['cafe'] }, 'café', true,
   'an accent is not a different answer'],
  [{ type: 'text', answers: ['1,000'] }, '1000', true,
   'but a separator inside a number still glues: 1,000 is 1000'],
  [{ type: 'text', answers: ['a keyboard'] }, "it's a keyboard", false,
   'a longer answer that merely contains the accepted one is still wrong'],
  [{ type: 'cipher', answers: ['open the door’s lock'] }, "open the door's lock", true,
   'a cipher phrase typed with the other apostrophe still decodes to the same phrase'],
];
const lockPage = await prepPage(browser, BASE, { width: 900, height: 900 });
await lockPage.goto(BASE + '/Tools/escape-room-builder/lock.html', { waitUntil: 'networkidle' });
await settle(lockPage, 300);
for (const [station, given, want, label] of CASES) {
  const inBuilder = await page.evaluate(([st, g]) => window.EscapeRoomMatch.checkAnswer(st, g).correct, [station, given]);
  const inLock = await lockPage.evaluate(([st, g]) => window.EscapeRoomMatch.checkAnswer(st, g).correct, [station, given]);
  eq(inBuilder, want, label);
  eq(inLock, inBuilder, `and lock.html agrees: ${label}`);
}
const near = await page.evaluate(() =>
  window.EscapeRoomMatch.checkAnswer({ type: 'text', answers: ['a keyboard'] }, 'a keybard').nearMiss);
ok(near, 'a typo is reported as a near miss, for the gentler message');

/* ── build a three-station room whose station 1 jumps straight to 3 ───── */
async function setStation(i, { clue, answers, hint, next }) {
  const row = (await page.$$('#stationsList > *'))[i];
  await row.$eval('.f-clue', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, clue);
  await row.$eval('.f-answers', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, answers);
  if (hint !== undefined) {
    await row.$eval('.f-hint', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, hint);
  }
  if (next !== undefined) {
    await row.$eval('.f-next', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, next);
  }
}

await page.fill('#setName', 'Fractions Escape');
await page.click('#addStationBtn');
await page.click('#addStationBtn');
await settle(page, 300);
// Station 1 jumps to Station 3, so Station 2 is unreachable — exactly the
// authoring bug the answer key cannot show you.
await setStation(0, { clue: 'I have keys but open no locks.', answers: 'a keyboard', hint: 'You type on it.', next: '2' });
await setStation(1, { clue: 'Orphaned station nothing routes to.', answers: 'lost' });
await setStation(2, { clue: 'What is 1/2 + 1/4?', answers: '3/4', next: 'end' });
await settle(page, 400);

eq(await page.isDisabled('#testRunBtn'), false, 'the test-run button enables once the room is valid');

/* ── walk it ───────────────────────────────────────────────────────────── */
await page.click('#testRunBtn');
await settle(page, 250);
ok(await page.isVisible('#testRunOverlay'), 'the test run opens');
eq(await page.textContent('#testRunStep'), 'Station 1 of 3', 'it starts at station 1');
ok((await page.textContent('#testRunBody')).includes('I have keys'), 'showing the real clue');

// The teacher's own answer key is one click away, and hidden until asked for.
ok(!(await page.textContent('#testRunBody')).includes('Accepts: a keyboard'), 'the answer is not shown by default');
await page.click('#trShowAns');
await settle(page, 150);
ok((await page.textContent('#testRunBody')).includes('Accepts: a keyboard'), 'and appears when the teacher asks');

// A wrong answer gets the student's own message, and is counted.
await page.fill('#trAnswer', 'a mouse');
await page.click('#trCheck');
await settle(page, 200);
ok(/Not quite/.test(await page.textContent('#trFeedback')), 'a wrong answer is refused the way a student sees it');
ok((await page.textContent('#testRunBody')).includes('Misses so far: 1'), 'and the miss is counted for the teacher');

// A near miss gets the gentler message students get.
await page.fill('#trAnswer', 'a keybard');
await page.click('#trCheck');
await settle(page, 200);
ok(/So close/.test(await page.textContent('#trFeedback')), 'a typo gets the near-miss message');

// The hint is behind a button, as it is for a student.
await page.click('#trHint');
await settle(page, 150);
ok((await page.textContent('#testRunBody')).includes('You type on it'), 'the hint reveals on request');

// The right answer, typed the way a student would type it.
await page.fill('#trAnswer', 'A Keyboard');
await page.click('#trCheck');
await settle(page, 700);
eq(await page.textContent('#testRunStep'), 'Station 3 of 3',
   'the branch is followed — station 1 jumps past station 2, exactly as the room is built');

await page.fill('#trAnswer', '3/4');
await page.click('#trCheck');
await settle(page, 700);
eq(await page.textContent('#testRunStep'), 'Finished', 'the chain ends where the room says it ends');

/* ── the finish screen names the unreachable station ───────────────────── */
const summary = await page.textContent('#testRunBody');
ok(/can never be reached/.test(summary), 'the unreachable station is called out: ' + summary.slice(0, 160));
ok(/Station 2/.test(summary), 'and named');
ok(/Station 1/.test(summary) && /Station 3/.test(summary), 'the path walked is listed');

/* ── a dry run writes nothing ──────────────────────────────────────────── */
const storageKeys = await page.evaluate(() =>
  Object.keys(localStorage).filter(k => /escape-room-progress|escaperoom:progress|lock/i.test(k)));
eq(storageKeys.length, 0, 'the test run left no player progress behind: ' + JSON.stringify(storageKeys));

/* ── it closes, and reopening starts clean ─────────────────────────────── */
await page.keyboard.press('Escape');
await settle(page, 200);
ok(!(await page.isVisible('#testRunOverlay')), 'Escape closes the test run');
await page.click('#testRunBtn');
await settle(page, 250);
eq(await page.textContent('#testRunStep'), 'Station 1 of 3', 'reopening starts from the top');
ok(!(await page.textContent('#testRunBody')).includes('Misses so far: 1'), 'with the miss count reset');
ok(!(await page.textContent('#testRunBody')).includes('Accepts:'), 'and the answer hidden again');
await page.click('#testRunClose');
await settle(page, 150);

/* ── paper packet ─────────────────────────────────────────────────────────
   The printable non-digital fallback: cut-apart station cards plus a
   teacher key, built from the same buildRoomPayload/validStations data as
   everything else — no QR codes, no player link. Extends the same
   3-station branching room (station 1 jumps past the orphaned station 2 to
   station 3) with a digit-lock station and a cipher station, so the packet
   is exercised against every puzzle type, a costed hint, an awarded
   letter, and an unreachable station in one pass. */
function caesarEncodeJs(text, shift) {
  const sh = ((shift % 26) + 26) % 26;
  return String(text).replace(/[a-zA-Z]/g, (ch) => {
    const base = ch === ch.toUpperCase() ? 65 : 97;
    return String.fromCharCode((ch.charCodeAt(0) - base + sh) % 26 + base);
  });
}

await page.evaluate(() => { window.print = function () {}; }); // no real print dialog in headless

// Station 4: digit lock, costed hint, awards a letter.
await page.click('#addStationBtn');
await settle(page, 200);
let rows = await page.$$('#stationsList > *');
await rows[3].$eval('.f-type', (el) => { el.value = 'digits'; el.dispatchEvent(new Event('change', { bubbles: true })); });
await settle(page, 150);
rows = await page.$$('#stationsList > *'); // DOM rebuilt by the type change
await rows[3].$eval('.f-clue', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'Crack the locker.');
await rows[3].$eval('.f-answers', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '482');
await rows[3].$eval('.f-hint', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'Half of 964.');
await rows[3].$eval('.f-hint-cost', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '15');
await rows[3].$eval('.f-award-letter', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'R');
await settle(page, 200);

// Station 5: cipher, fixed shift so the ciphertext is predictable.
await page.click('#addStationBtn');
await settle(page, 200);
rows = await page.$$('#stationsList > *');
await rows[4].$eval('.f-type', (el) => { el.value = 'cipher'; el.dispatchEvent(new Event('change', { bubbles: true })); });
await settle(page, 150);
rows = await page.$$('#stationsList > *');
await rows[4].$eval('.f-clue', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'Decode the vault message.');
await rows[4].$eval('.f-cipher-plain', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'open the vault');
await rows[4].$eval('.f-cipher-shift', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '3');
await settle(page, 200);

// Route station 3 ("What is 1/2 + 1/4?", was the chain's end) on to the new
// digit-lock station, which auto-advances into the cipher station — leaves
// station 2 ("Orphaned station...") the only one still unreachable.
rows = await page.$$('#stationsList > *');
await rows[2].$eval('.f-next', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, '3');
await settle(page, 250);

eq(await page.isDisabled('#printPacketBtn'), false, 'the paper-packet button enables once the room is valid');

await page.click('#printPacketBtn');
await settle(page, 250);

/* ── it warns about (but still prints) the unreachable station ─────────── */
const packetMsg = await page.textContent('#msg');
ok(/Heads up: station 2/.test(packetMsg), 'the packet flags the still-orphaned station: ' + packetMsg);
ok(/nothing in the chain routes to it/.test(packetMsg), 'and explains why');

ok(await page.evaluate(() => document.getElementById('printPacketArea').classList.contains('active')),
   'the packet print area is the one made active');

/* ── every valid station gets a card, in order, reachable or not ────────── */
const cardTexts = await page.$$eval('#packetCardsGrid .packet-card', els => els.map(el => el.textContent));
eq(cardTexts.length, 5, 'one card per valid station, including the orphaned one');
[1, 2, 3, 4, 5].forEach((n, i) => ok(new RegExp('Station ' + n).test(cardTexts[i]), `card ${i} is labeled Station ${n}`));

/* ── digit-lock card: boxes, not the code; hint and its cost; no bare letter ── */
const digitCardHtml = await page.$eval('#packetCardsGrid .packet-card:nth-child(4)', el => el.innerHTML);
const digitCardText = await page.$eval('#packetCardsGrid .packet-card:nth-child(4)', el => el.textContent);
eq((digitCardHtml.match(/pc-digit-box/g) || []).length, 3, 'three digit boxes, matching the length of "482"');
ok(!digitCardText.includes('482'), 'the code itself never prints on the student card: ' + digitCardText);
ok(digitCardText.includes('Half of 964.'), 'the hint text is there to be flipped and read');
ok(/15 pts/.test(digitCardText), 'and its point cost is printed with it');
ok(digitCardHtml.includes('pc-hint-text'), 'the hint sits in the upside-down block');
ok(digitCardHtml.includes('pc-letter-box'), 'an empty letter box prints for the awarded letter');
const letterLine = await page.$eval('#packetCardsGrid .packet-card:nth-child(4) .pc-letter', el => el.textContent);
ok(!/\bR\b/.test(letterLine), 'but the letter itself is not on the card, only in the teacher key: ' + letterLine);

/* ── cipher card: shows the ciphertext, never the plaintext ─────────────── */
const expectedCipher = caesarEncodeJs('open the vault', 3);
eq(expectedCipher, 'rshq wkh ydxow', 'sanity check on the test\'s own cipher helper');
const cipherCardText = await page.$eval('#packetCardsGrid .packet-card:nth-child(5)', el => el.textContent);
ok(cipherCardText.includes(expectedCipher), 'the card shows the encoded message: ' + cipherCardText);
ok(!cipherCardText.toLowerCase().includes('open the vault'), 'never the plaintext');

/* ── teacher key at the end of the packet is complete ────────────────────── */
const keyRows = await page.$$eval('#packetKeyBody tr', rows => rows.map(r => r.textContent));
eq(keyRows.length, 5, 'one key row per station, same count as cards');
ok(keyRows[3].includes('482') && /Digit lock/.test(keyRows[3]), 'the digit code is spelled out in the key');
ok(keyRows[3].includes('R'), 'and the awarded letter, unlike on the card');
ok(keyRows[4].includes(expectedCipher) && keyRows[4].includes('open the vault'),
   'the cipher row shows both the ciphertext and the decoded phrase');
ok(/Station 4/.test(keyRows[2]), 'the key\'s Next column reflects the new branch (station 3 now points to the digit lock)');

/* ── cards-per-page selection actually changes the printed layout ───────── */
eq(await page.evaluate(() => document.getElementById('packetCardsGrid').className), 'packet-cards-grid pk-2',
   'defaults to two cards per page');
await page.selectOption('#packetCardsPerPage', '1');
await settle(page, 150);
await page.click('#printPacketBtn');
await settle(page, 200);
eq(await page.evaluate(() => document.getElementById('packetCardsGrid').className), 'packet-cards-grid pk-1',
   'switching to one-per-page rebuilds the grid with the new class');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['builder', page], ['lock', lockPage]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
