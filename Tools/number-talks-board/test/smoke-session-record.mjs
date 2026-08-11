// smoke-session-record.mjs — the number talk's printable session record.
//
//   node Tools/number-talks-board/test/smoke-session-record.mjs
//
// "Save this session" already wrote the same material to a .txt. A text file
// is not what goes in a binder, gets stapled to a PLC agenda, or is handed to
// the student who was pulled out for band. This is the same session on paper:
// every string with its answer, the strategy cards next to the students they
// belong to, and everything shown this period.
//
// Two things this suite is really guarding:
//
//   1. The answers. They are on by default because this is the teacher's
//      record — but the same page is the obvious thing to send home, and a
//      record of the class's thinking with the answers on it is worth much
//      less as a study copy. The checkbox has to actually remove them.
//   2. A strategy card must never break across a page. A student's reasoning
//      split half onto the next sheet is exactly the kind of print defect
//      this repo has already had to go back and fix once.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8196;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/024-number-talks-board.html';

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

/** Fills the nth strategy card the tool creates. */
const addStrategy = async (p, name, text) => {
  await p.click('#addStrategyBtn');
  await settle(p, 200);
  await p.evaluate(([n, t]) => {
    const cards = document.querySelectorAll('#strategyGrid .strategy-card');
    const card = cards[cards.length - 1];
    const nameEl = card.querySelector('input');
    const textEl = card.querySelector('textarea');
    nameEl.value = n; nameEl.dispatchEvent(new Event('input', { bubbles: true }));
    textEl.value = t; textEl.dispatchEvent(new Event('input', { bubbles: true }));
  }, [name, text]);
  await settle(p, 200);
};

console.log('Number Talks Board — printable session record');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 500);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

/* ── 1. an empty session prints something honest rather than nothing ────── */
await page.click('#printSessionBtn');
await settle(page, 300);
const empty = await page.evaluate(() => document.getElementById('printArea').textContent);
ok(/Session Record/.test(empty), 'an untouched session still prints a record');
ok(/No strategy cards were stamped up/.test(empty), 'saying plainly that nobody shared: ' + empty.slice(0, 0));
ok(/Nothing shown yet this session/.test(empty), 'and that nothing has been shown');

/* ── 2. a real session: strings, answers, attributed strategies ─────────── */
await page.click('#nextPromptBtn');
await settle(page, 400);
await page.click('#nextPromptBtn');
await settle(page, 400);
await addStrategy(page, 'Ada', 'Broke the 48 into 40 and 8, then added the 40 first.');
await addStrategy(page, 'Marco', 'Rounded up to 50 and took two back off at the end.');
await addStrategy(page, '', 'Counted on by tens from the bigger number.');

await page.click('#printSessionBtn');
await settle(page, 400);
eq(await page.evaluate(() => window.__printed), 2, 'printing actually reaches the print dialog');

const rec = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  return {
    text: area.textContent,
    cards: [...area.querySelectorAll('.rec-card')].map(c => ({
      who: c.querySelector('.rec-who').textContent,
      what: c.querySelector('.rec-what').textContent,
    })),
    strings: [...area.querySelectorAll('.rec-string')].map(s => s.textContent),
    answers: [...area.querySelectorAll('.rec-answer')].map(s => s.textContent),
    used: [...area.querySelectorAll('.rec-list li')].length,
  };
});
eq(rec.cards.length, 3, 'every strategy card is on the record');
eq(rec.cards[0].who, 'Ada', 'attributed to the student who shared');
ok(/Broke the 48/.test(rec.cards[0].what), 'with their reasoning: ' + rec.cards[0].what);
eq(rec.cards[2].who, 'Student 3', 'a card left unnamed is numbered rather than blank');
ok(rec.strings.length >= 1, `the string on the board is printed (${rec.strings.length} lines)`);
ok(rec.answers.length >= 1, 'with its answer worked out');
ok(/=/.test(rec.strings[0]), 'shown as "expression = answer": ' + rec.strings[0]);
eq(rec.used, 2, 'and both number talks shown this session are listed');
ok(/Strategies shared \(3\)/.test(rec.text), 'the strategy heading carries the count');

/* ── 3. unticking the box really removes the answers ───────────────────── */
await page.uncheck('#sessionKeyCheck');
await page.click('#printSessionBtn');
await settle(page, 400);
const noKey = await page.evaluate(() => {
  const area = document.getElementById('printArea');
  return {
    answers: area.querySelectorAll('.rec-answer').length,
    strings: [...area.querySelectorAll('.rec-string')].map(s => s.textContent),
    text: area.textContent,
    cards: area.querySelectorAll('.rec-card').length,
  };
});
eq(noKey.answers, 0, 'no answer is printed anywhere on a copy going home');
ok(noKey.strings.every(s => s.indexOf('=') === -1), 'not even as part of the string: ' + JSON.stringify(noKey.strings));
ok(/Answers left off this copy/.test(noKey.text), 'and the page says the answers were deliberately left off');
eq(noKey.cards, 3, 'the students’ own thinking is still there — that is the point of the handout');

/* ── 4. a strategy card never splits across a page ─────────────────────── */
await page.check('#sessionKeyCheck');
await page.click('#printSessionBtn');
await settle(page, 300);
await page.emulateMedia({ media: 'print' });
await settle(page, 300);
const breaks = await page.evaluate(() =>
  [...document.querySelectorAll('#printArea .rec-card')].map(c => getComputedStyle(c).breakInside));
ok(breaks.length === 3 && breaks.every(b => b === 'avoid'),
   'every strategy card is break-inside:avoid, so nobody’s reasoning lands half on the next sheet: ' + JSON.stringify(breaks));
await page.emulateMedia({ media: 'screen' });

/* ── 5. it does not disturb the existing outputs ───────────────────────── */
const still = await page.evaluate(() => ({
  save: !!document.getElementById('exportSessionBtn'),
  handout: !!document.getElementById('printHandoutBtn'),
}));
eq(still.save, true, '"Save this session" is still there — the record is an addition, not a replacement');
eq(still.handout, true, 'and so is the student handout of the current string');

await page.click('#printHandoutBtn');
await settle(page, 300);
const handout = await page.evaluate(() => document.getElementById('printArea').textContent);
ok(/Show your thinking/.test(handout), 'the student handout still prints its own thing');
ok(!/Strategies shared/.test(handout), 'and does not leak the session record into it');

/* ── 6. no console noise ───────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
