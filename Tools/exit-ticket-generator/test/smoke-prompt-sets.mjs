// smoke-prompt-sets.mjs — Planned Sequence mode, wired into the live page.
//
//   node Tools/exit-ticket-generator/test/smoke-prompt-sets.mjs
//
// The prompt bank was shuffle-only: every "next prompt" was a fresh random
// draw, so a teacher planning a week of warm-ups ahead of time had nowhere
// to put that plan — they'd have to remember it, or re-shuffle and hope.
// This ports Writing Prompt Generator's Prompt Sets (the date/cursor
// mechanics live in etg-sequence.js, already covered independently by
// sequence-logic.test.mjs) into the Prompt & Display tab as a second mode.
//
// This suite drives the actual DOM instead of re-deriving the date math —
// that part is already pinned down in sequence-logic.test.mjs — so what it
// holds down is the wiring:
//
//   Switching to Planned Sequence shows a set's item for today (school-day
//   count from its start date), and switching back to Shuffle restores
//   whatever the shuffle side was showing, without redrawing it.
//
//   Prev/Next/Jump-to-today move the displayed day and stay within the
//   set's bounds; "Jump to today" is hidden once the cursor already matches.
//
//   A planned sequence's item never lands in "Shown earlier today" — that
//   log is the shuffle side's own record, per the improvement-prompt note
//   that Prompt Sets are a separate record from history/tally/triage.
//
//   The Printable Handout tab picks up whatever the sequence stage is
//   showing, same as it does for a shuffled prompt.
//
//   The active set, its items, its cursor and the chosen mode all survive a
//   reload.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8176;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/023-exit-ticket-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/** Today's date as 'YYYY-MM-DD' in local time — the same format the page
 *  itself computes with, and the same value its `todayStr()` will read
 *  regardless of which real calendar day this suite happens to run on. */
function todayStr() {
  const d = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });

console.log('Exit Ticket — Planned Sequence mode');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── Shuffle mode is still the default, unaffected by the new feature ──── */
eq(await page.evaluate(() => document.querySelector('.mode-tabs .pill[data-mode="shuffle"]').classList.contains('active')),
   true, 'Shuffle is the default mode on first load');
const initialPrompt = await page.textContent('#promptText');
ok(initialPrompt && initialPrompt !== 'Press Shuffle to get a prompt.',
   'a shuffled prompt is drawn automatically on load, same as before this round: ' + initialPrompt);

/* ── Switching to Planned Sequence with no sets yet ─────────────────────── */
await page.click('.mode-tabs .pill[data-mode="sequence"]');
await settle(page, 200);
ok(await page.isVisible('#seqNavRow'), 'the sequence nav row appears in Planned Sequence mode');
ok(!(await page.isVisible('#shuffleBtn')), 'the Shuffle button hides in Planned Sequence mode');
eq(await page.textContent('#promptText'), 'Create a prompt set below, then come back here.',
   'with no sets at all, the stage points the teacher at the set editor below');
eq(await page.textContent('#setEmptyMsg'), 'No prompt sets yet — choose “+ New set…” above to plan one.',
   'the Prompt Sets card explains there is nothing to pick yet');
ok(!(await page.isVisible('#setEditor')), 'the set editor is hidden until a set exists');

/* ── Creating a set ──────────────────────────────────────────────────────
   "+ New set…" is the select's only option before a set exists; Playwright's
   selectOption still fires change on it, which is what createSet() listens
   for. */
await page.selectOption('#setSelect', '');
await settle(page, 200);
ok(await page.isVisible('#setEditor'), 'the editor appears once a set exists');
eq(await page.inputValue('#setNameInput'), 'Untitled Set', 'a new set gets a default name');
ok(!(await page.getAttribute('#deleteSetBtn', 'disabled')), 'Delete set is enabled once a set is selected');
eq(await page.textContent('#promptText'), 'Pick a prompt set above, or add prompts to it below.',
   'an empty set (no items yet) still asks for prompts rather than showing a blank stage');

await page.fill('#setNameInput', 'Week 3 Warm-Ups');
await page.dispatchEvent('#setNameInput', 'input');
await settle(page, 150);
eq((await page.textContent('#setSelect')).includes('Week 3 Warm-Ups'), true, 'the set selector picks up the renamed set');

/* ── Adding items builds the day-by-day list ────────────────────────────── */
const items = [
  { text: 'Monday warm-up: name one thing you remember from Friday.', cat: 'general' },
  { text: 'Tuesday warm-up: solve 6 x 7 two different ways.', cat: 'math' },
  { text: 'Wednesday warm-up: what surprised you in today\'s reading?', cat: 'ela' },
  { text: 'Thursday warm-up: name one force you saw this morning.', cat: 'science' },
  { text: 'Friday warm-up: what are you proud of from this week?', cat: 'sel' },
];
for (const it of items) {
  await page.fill('#setItemText', it.text);
  await page.selectOption('#setItemCategory', it.cat);
  await page.click('#addManualToSetBtn');
  await settle(page, 120);
}
const dayLabels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#setItemsList .si-day')).map(el => el.textContent));
eq(dayLabels.length, 5, 'all five planned prompts appear in the set list');
eq(dayLabels[0], 'Day 1', 'items are numbered by day, in the order added');
eq(dayLabels[4], 'Day 5', 'and the last one is Day 5 of 5');

/* Selecting the set surfaced it in Planned Sequence mode automatically
   (selectSet() re-renders the stage when already in sequence mode), so Day 1
   should already be on stage before we touch the start date. */
eq(await page.textContent('#promptText'), items[0].text, 'the freshly-created set opens on Day 1');
eq(await page.textContent('#seqDayLabel'), 'Day 1 of 5', 'the day counter reads "Day 1 of 5"');
ok(await page.getAttribute('#seqPrevBtn', 'disabled') !== null, 'Prev is disabled on the first day');

/* ── Manual Prev/Next override, independent of any start date ──────────── */
await page.click('#seqNextBtn');
await settle(page, 150);
eq(await page.textContent('#promptText'), items[1].text, 'Next advances to Day 2');
eq(await page.textContent('#seqDayLabel'), 'Day 2 of 5', 'the day counter follows Next');
await page.click('#seqNextBtn');
await page.click('#seqNextBtn');
await page.click('#seqNextBtn');
await settle(page, 150);
eq(await page.textContent('#promptText'), items[4].text, 'four Nexts from Day 1 lands on the last item, Day 5');
ok(await page.getAttribute('#seqNextBtn', 'disabled') !== null, 'Next is disabled on the last day — no walking past the end');
await page.click('#seqNextBtn', { force: true }); // disabled — should be a no-op; force bypasses Playwright's actionability wait
await settle(page, 100);
eq(await page.textContent('#seqDayLabel'), 'Day 5 of 5', 'clicking a disabled Next does not overshoot');
await page.click('#seqPrevBtn');
await settle(page, 150);
eq(await page.textContent('#promptText'), items[3].text, 'Prev steps back one day');

/* ── "Jump to today" ─────────────────────────────────────────────────────
   Start date = today: schoolDaysSince(today, today) is always 0 regardless
   of which real weekday this suite runs on, so the suggestion is
   deterministically Day 1. */
const today = todayStr();
await page.fill('#setStartDate', today);
await page.dispatchEvent('#setStartDate', 'change');
await settle(page, 200);
ok(await page.isVisible('#seqJumpBtn'),
   'cursor is on Day 4 but today\'s slot is Day 1 — "Jump to today" appears');
await page.click('#seqJumpBtn');
await settle(page, 200);
eq(await page.textContent('#promptText'), items[0].text, 'Jump to today lands on Day 1 (today = the start date)');
ok(!(await page.isVisible('#seqJumpBtn')), 'and the button disappears once the cursor already matches today');

/* Manually step forward, then confirm the button reappears and jump still
   works from a different starting cursor. */
await page.click('#seqNextBtn');
await page.click('#seqNextBtn');
await settle(page, 150);
ok(await page.isVisible('#seqJumpBtn'), 'stepping away from today brings the Jump button back');
await page.click('#seqJumpBtn');
await settle(page, 200);
eq(await page.textContent('#seqDayLabel'), 'Day 1 of 5', 'jumping again returns to Day 1');

/* A start date set far in the past clamps the suggestion to the set's last
   real item, deterministically, regardless of which real weekday "today" is
   — thousands of school days will have elapsed either way. */
await page.fill('#setStartDate', '2000-01-03');
await page.dispatchEvent('#setStartDate', 'change');
await settle(page, 200);
ok(await page.isVisible('#seqJumpBtn'), 'a long-elapsed start date still offers a jump (cursor is not already at the end)');
await page.click('#seqJumpBtn');
await settle(page, 200);
eq(await page.textContent('#seqDayLabel'), 'Day 5 of 5',
   'the suggestion clamps to the last planned day instead of running off the end of a short set');

/* Put the start date back on today for the reload check below. */
await page.fill('#setStartDate', today);
await page.dispatchEvent('#setStartDate', 'change');
await page.click('#seqPrevBtn');
await page.click('#seqPrevBtn');
await page.click('#seqPrevBtn');
await page.click('#seqPrevBtn');
await settle(page, 150);
eq(await page.textContent('#seqDayLabel'), 'Day 1 of 5', 'back to Day 1 before the next checks');

/* ── Switching modes doesn't touch "Shown earlier today" ────────────────── */
const historyCountInSequence = await page.evaluate(() => document.querySelectorAll('#historyList li').length);
await page.click('#seqNextBtn');
await settle(page, 150);
eq(await page.evaluate(() => document.querySelectorAll('#historyList li').length), historyCountInSequence,
   'stepping through a planned sequence never adds to the shuffle history log');

await page.click('.mode-tabs .pill[data-mode="shuffle"]');
await settle(page, 200);
eq(await page.textContent('#promptText'), initialPrompt,
   'switching back to Shuffle restores the original shuffled prompt instead of drawing a new one');
eq(await page.evaluate(() => document.querySelectorAll('#historyList li').length), historyCountInSequence,
   'and the history log is still untouched — only Shuffle itself adds to it');

await page.click('#shuffleBtn');
await settle(page, 200);
eq(await page.evaluate(() => document.querySelectorAll('#historyList li').length), historyCountInSequence + 1,
   'a real Shuffle click does add to the history log, confirming the log still works at all');

/* ── The Printable Handout tab follows the sequence stage ───────────────── */
await page.click('.mode-tabs .pill[data-mode="sequence"]');
await settle(page, 200);
const seqPromptNow = await page.textContent('#promptText');
await page.click('.tab-btn[data-tab="handout"]');
await settle(page, 200);
eq(await page.textContent('#handoutPromptDisplay'), seqPromptNow,
   'the handout tab shows whatever the sequence stage is currently displaying');
await page.click('.tab-btn[data-tab="bank"]');
await settle(page, 200);

/* ── Everything survives a reload: mode, active set, items, cursor ──────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 400);
eq(await page.evaluate(() => document.querySelector('.mode-tabs .pill[data-mode="sequence"]').classList.contains('active')),
   true, 'Planned Sequence mode persists across a reload');
ok(await page.isVisible('#seqNavRow'), 'and the sequence nav is showing again without re-clicking the mode tab');
eq((await page.textContent('#setSelect')).includes('Week 3 Warm-Ups'), true, 'the set itself persisted');
eq(await page.evaluate(() =>
     Array.from(document.querySelectorAll('#setItemsList .si-day')).length), 5,
   'all five planned items persisted');
eq(await page.textContent('#promptText'), seqPromptNow, 'the cursor position (which day is showing) persisted too');

/* ── Deleting a set clears the stage back to "create one" ───────────────── */
await page.once('dialog', d => d.accept());
await page.click('#deleteSetBtn');
await settle(page, 200);
eq(await page.textContent('#promptText'), 'Create a prompt set below, then come back here.',
   'deleting the only set returns to the empty-state message');
eq(await page.textContent('#setEmptyMsg'), 'No prompt sets yet — choose “+ New set…” above to plan one.',
   'and the Prompt Sets card goes back to its empty state');

/* ── no console noise, nothing left the site ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
