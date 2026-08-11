// smoke-session-record.mjs — the Number Talks board's printable session record.
//
//   node Tools/number-talks-board/test/smoke-session-record.mjs
//
// "Save this session" already wrote a .txt file. That is a file in a downloads
// folder; the thing a teacher actually files, hands to a coach during a
// walkthrough, or staples into a planning binder is paper — with the string,
// the answers, and every attributed strategy card on it.
//
// The record is deliberately NOT the student handout: it shows the answers (it
// is the teacher's copy), it names who said what, and it covers the whole
// session rather than the string currently on the board. Those three
// differences are what this suite pins down.
//
// Exits 1 on any failure. Every student name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8179;
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
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Number Talks — printable session record');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/** Clicks a button with window.print() stubbed out, so a headless run doesn't
    block on the print dialog, then returns what landed in #printArea. */
async function printAndRead(id) {
  await page.evaluate(btnId => {
    const orig = window.print;
    window.print = () => {};
    document.getElementById(btnId).click();
    window.print = orig;
  }, id);
  await settle(page, 200);
  return page.evaluate(() => ({
    html: document.getElementById('printArea').innerHTML,
    text: document.getElementById('printArea').textContent,
  }));
}

/* ── a string with a computable answer, plus two attributed strategies ─── */
await page.fill('#customInput', '48 + 27\n48 + 30\n75 - 3');
await page.click('#useCustomBtn');
await settle(page, 300);

await page.click('#addStrategyBtn');
await settle(page, 150);
await page.fill('.strategy-card:nth-of-type(1) .s-name', 'Maya');
await page.fill('.strategy-card:nth-of-type(1) .s-text', 'Made 48 into 50, added 27, took 2 back off.');
await page.dispatchEvent('.strategy-card:nth-of-type(1) .s-text', 'input');
await page.click('#addStrategyBtn');
await settle(page, 150);
await page.fill('.strategy-card:nth-of-type(2) .s-text', 'Broke 27 into 20 and 7.');
await page.dispatchEvent('.strategy-card:nth-of-type(2) .s-text', 'input');
await settle(page, 200);

const rec = await printAndRead('printSessionBtn');

ok(/Session Record/.test(rec.text), 'the record is titled as a session record');
ok(/teacher copy/.test(rec.text), 'and says out loud that it is the teacher copy');
ok(rec.text.includes('48 + 27'), 'the string is on it');
ok(/=\s*75/.test(rec.text), 'with the computed answer — the student handout never shows this');
ok(rec.text.includes('Maya'), 'a named strategy card is attributed');
ok(rec.text.includes('Made 48 into 50'), 'and its text is printed in full');
ok(/Student 2/.test(rec.text), 'an unnamed card still gets a stable label rather than a blank');
ok(rec.text.includes('Broke 27 into 20'), 'the unnamed card’s strategy is printed too');
ok(/Strategies shared \(2\)/.test(rec.text), 'the strategy count is stated: ' + (rec.text.match(/Strategies shared \(\d+\)/) || [])[0]);
ok(/Notes for next time/.test(rec.text), 'there is somewhere to write on it afterwards');
eq(await page.$$eval('#printArea .rec-strategy', e => e.length), 2, 'one block per strategy card');

/* ── the session list travels, not just the current string ─────────────── */
await page.click('#nextPromptBtn');
await settle(page, 250);
await page.click('#nextPromptBtn');
await settle(page, 250);
const rec2 = await printAndRead('printSessionBtn');
const listed = await page.$$eval('#printArea .rec-list li', e => e.length);
ok(listed >= 2, `the whole session's strings are listed (${listed})`);
ok(/Number talks used this session \(\d+\)/.test(rec2.text), 'with a count');
ok(rec2.text.includes('48 + 27'), 'including the one from earlier in the lesson');

/* ── the student handout is untouched and still answer-free ────────────── */
const handout = await printAndRead('printHandoutBtn');
ok(!/rec-answer/.test(handout.html), 'the student handout carries no answer markup');
ok(/Show your thinking/.test(handout.text), 'and still has its workspace');
ok(!/Maya/.test(handout.text), 'and does not leak the strategy board onto a student sheet');

/* ── quick-image mode records the image and its count ──────────────────── */
await page.click('#modeDotsBtn');
await settle(page, 250);
await page.click('#newDotImageBtn');
await settle(page, 400);
const dotRec = await printAndRead('printSessionBtn');
ok(await page.$$eval('#printArea .dot', e => e.length) > 0, 'the quick image itself is drawn on the record');
ok(/How many:/.test(dotRec.text), 'with the count spelled out for the teacher');

/* ── an empty board prints something honest rather than crashing ───────── */
const fresh = await prepPage(browser, BASE, { width: 1200, height: 900 });
await fresh.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(fresh, 400);
await fresh.evaluate(() => {
  const orig = window.print; window.print = () => {};
  document.getElementById('printSessionBtn').click();
  window.print = orig;
});
await settle(fresh, 200);
const emptyText = await fresh.textContent('#printArea');
ok(/No strategy cards were stamped up/.test(emptyText), 'an empty strategy board says so');
ok(/Nothing shown yet this session|No number string/.test(emptyText), 'and so does an empty session');

/* ── no console noise, nothing left the site ───────────────────────────── */
for (const [name, p] of [['main', page], ['fresh', fresh]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
