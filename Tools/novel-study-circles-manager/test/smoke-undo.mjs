// smoke-undo.mjs — Novel Study Circles' Undo on _shared/undo.js (Path 14 P5).
//
//   node Tools/novel-study-circles-manager/test/smoke-undo.mjs
//
// Undo used to hold one snapshot: the last "Delete this meeting" or "Reset
// role history", then nothing. It keeps a stack now, and the button still
// names the step it will take. What this holds down:
//
//   One delete, one Undo brings the meeting back and the button goes grey.
//   A delete, a role-history reset and a second delete undo in reverse order,
//   each restoring only the field it touched, the button naming the next step.
//   Logging a new meeting empties the stack (it touches meetings and history).
//   No console errors; nothing leaves the site.
//
// Exits 1 on any failure. Every name here is invented.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8566;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/027-novel-study-circles-manager.html';

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

const meetings = () => page.evaluate(() => document.querySelectorAll('#meetingHistory .meeting-entry').length);
const btn = () => page.evaluate(() => { const b = document.getElementById('undoBtn'); return { off: b.disabled, text: b.textContent.trim() }; });
const hint = () => page.evaluate(() => document.getElementById('historyHint').textContent.trim());
const click = async (id) => { await page.click('#' + id); await settle(page, 250); };
const logMeeting = async (date) => { await page.fill('#meetingDate', date); await click('logMeetingBtn'); };
const deleteMeeting = async () => {
  await page.evaluate(() => document.querySelector('#meetingHistory [data-del-meeting]').click());
  await settle(page, 250);
};

console.log('Novel Study Circles — multi-step undo');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(() => { window.confirm = () => true; });
await settle(page, 300);
await page.fill('#bookTitle', 'The Giver');
await page.fill('#namesInput', ['Alice', 'Ben', 'Cara', 'Deja', 'Eli', 'Fay', 'Gus', 'Hana'].join('\n'));
await click('splitBtn');
await logMeeting('2026-08-17');
await logMeeting('2026-08-18');
await logMeeting('2026-08-19');
eq(await meetings(), 3, 'three meetings are logged');
const fresh = await hint();
ok(/Remembering role history/.test(fresh), 'the roles are remembered after logging');
eq((await btn()).off, true, 'Undo is grey after logging');

/* ── 1. one delete, one Undo ──────────────────────────────────────────────── */
await deleteMeeting();
eq(await meetings(), 2, 'a delete leaves two meetings');
let b = await btn();
ok(!b.off && b.text === 'Undo: delete meeting', 'Undo is live and names the delete: ' + b.text);
await click('undoBtn');
eq(await meetings(), 3, 'one Undo brings the meeting back');
eq((await btn()).off, true, 'and Undo is grey again');

/* ── 2. delete, reset, delete: undone in reverse ──────────────────────────── */
await deleteMeeting();
await click('resetHistoryBtn');
ok(/No role history yet/.test(await hint()), 'the reset forgets the roles');
await deleteMeeting();
eq(await meetings(), 1, 'two deletes leave one meeting');
await click('undoBtn');
eq(await meetings(), 2, 'first Undo brings back the second delete');
ok(/No role history yet/.test(await hint()), 'and leaves the reset alone');
b = await btn();
eq(b.text, 'Undo: reset role history', 'the button now names the reset');
await click('undoBtn');
eq(await hint(), fresh, 'second Undo brings the role history back');
eq(await meetings(), 2, 'and leaves the meetings alone');
b = await btn();
eq(b.text, 'Undo: delete meeting', 'the button names the first delete');
await click('undoBtn');
eq(await meetings(), 3, 'third Undo brings back the first delete');
eq((await btn()).off, true, 'and Undo is grey once the stack is empty');

/* ── 3. logging a meeting empties the stack ───────────────────────────────── */
await deleteMeeting();
ok(!(await btn()).off, 'a delete leaves Undo live');
await logMeeting('2026-08-20');
eq((await btn()).off, true, 'logging a meeting clears the Undo stack');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
