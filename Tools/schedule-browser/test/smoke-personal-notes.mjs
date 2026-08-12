// smoke-personal-notes.mjs — the schedule browser's personal notes overlay.
//
//   node Tools/schedule-browser/test/smoke-personal-notes.mjs
//
// The published schedule says what a period IS. It cannot say that 4th is bus
// duty this quarter, that 6th is when the IEP meetings land, or that 2nd is
// the one to protect. Those are the things a teacher writes on their printed
// copy in pen, they are per-person, and so they live on the device rather
// than in the published data.
//
// Three things under test:
//
//   1. A note belongs to a teacher AND a day AND a period. A-day 3rd and
//      B-day 3rd are different periods on a block schedule, and a note that
//      leaked between them would be worse than no note.
//   2. Clearing a note removes it rather than storing an empty string — and
//      prunes the teacher/day it leaves behind, so a year of edits doesn't
//      accumulate a blob of empty objects.
//   3. Empty boxes don't print. A schedule covered in dashed empty boxes
//      reads as a form somebody forgot to fill in.
//
// Exits 1 on any failure. Teacher names come from the tool's own published
// sample data.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8205;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/034-schedule-browser.html';
const KEY = 'br_personal_notes_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1500, height: 1200 });

const openTeacher = async (p, name) => {
  await p.evaluate(n => window.brJumpTeacher(n), name);
  await settle(p, 500);
};

/** Types into one note box and blurs it, the way a person would. */
const writeNote = async (p, day, i, text) => {
  const sel = `.br-note[data-note-day="${day}"][data-note-i="${i}"]`;
  await p.fill(sel, text);
  await p.dispatchEvent(sel, 'change');
  await settle(p, 250);
};

const stored = (p) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);

console.log('Schedule Browser — personal notes overlay');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 900);

/* ── 1. every period on a teacher's schedule offers a note ─────────────── */
await openTeacher(page, 'Moore');
const boxes = await page.evaluate(() =>
  [...document.querySelectorAll('.br-note')].map(n => ({ day: n.dataset.noteDay, i: n.dataset.noteI, teacher: n.dataset.noteTeacher })));
ok(boxes.length >= 4, `there is a note box per period (${boxes.length})`);
ok(boxes.some(b => b.day === 'A') && boxes.some(b => b.day === 'B'),
   'on both A and B days for a teacher whose days differ');
ok(boxes.every(b => b.teacher === 'Moore'), 'all tagged with the teacher whose schedule is open');
ok(/saved\s+on this device only/i.test(await page.textContent('.notes-hint')),
   'and the page says these are private to this device');

/* ── 2. a note is per teacher, per day, per period ─────────────────────── */
await writeNote(page, 'A', 2, 'Bus duty');
await writeNote(page, 'B', 2, 'IEP meetings land here');

let saved = await stored(page);
eq(saved.Moore.A['2'], 'Bus duty', 'the A-day note is stored under A');
eq(saved.Moore.B['2'], 'IEP meetings land here', 'and the B-day note under B — same period number, different note');
eq(Object.keys(saved).length, 1, 'only the teacher who was annotated is in storage');

const onScreen = await page.evaluate(() => ({
  a: document.querySelector('.br-note[data-note-day="A"][data-note-i="2"]').value,
  b: document.querySelector('.br-note[data-note-day="B"][data-note-i="2"]').value,
  aFlagged: document.querySelector('.br-note[data-note-day="A"][data-note-i="2"]').classList.contains('has-note'),
  emptyFlagged: document.querySelector('.br-note[data-note-day="A"][data-note-i="0"]').classList.contains('has-note'),
}));
eq(onScreen.a, 'Bus duty', 'the A note reads back on screen');
eq(onScreen.b, 'IEP meetings land here', 'and so does the B one');
eq(onScreen.aFlagged, true, 'a filled box is marked as filled');
eq(onScreen.emptyFlagged, false, 'and an empty one is not');

/* another teacher's page starts blank and does not disturb the first */
await openTeacher(page, 'Almer');
eq(await page.evaluate(() => document.querySelector('.br-note[data-note-day="A"][data-note-i="2"]').value), '',
   'a different teacher’s schedule opens with no notes on it');
await writeNote(page, 'A', 0, 'Covers my class');
saved = await stored(page);
eq(saved.Moore.A['2'], 'Bus duty', 'and writing there leaves the first teacher’s notes alone');
eq(saved.Almer.A['0'], 'Covers my class', 'while saving its own');

/* ── 3. they survive a reload ──────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 900);
await openTeacher(page, 'Moore');
eq(await page.evaluate(() => document.querySelector('.br-note[data-note-day="A"][data-note-i="2"]').value), 'Bus duty',
   'notes are still there after a reload — this is a year-long annotation, not a session');

/* ── 4. clearing removes rather than stores an empty ───────────────────── */
await writeNote(page, 'A', 2, '');
saved = await stored(page);
ok(!saved.Moore || !saved.Moore.A || saved.Moore.A['2'] === undefined,
   'clearing a note deletes it rather than storing an empty string: ' + JSON.stringify(saved.Moore));
eq(saved.Moore.B['2'], 'IEP meetings land here', 'without touching the note on the other day');

await writeNote(page, 'B', 2, '');
saved = await stored(page);
eq(saved.Moore, undefined,
   'and emptying a teacher’s last note prunes them entirely instead of leaving an empty husk: ' + JSON.stringify(saved));
eq(saved.Almer.A['0'], 'Covers my class', 'while the other teacher is untouched');

/* ── 5. empty boxes do not print ───────────────────────────────────────── */
await openTeacher(page, 'Almer');
await writeNote(page, 'A', 1, 'Protect this one');
await page.emulateMedia({ media: 'print' });
await settle(page, 400);
const printed = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.br-note')];
  const filled = all.filter(n => n.value.trim());
  const empty = all.filter(n => !n.value.trim());
  const vis = n => {
    const cs = getComputedStyle(n);
    return cs.display !== 'none' && n.getBoundingClientRect().height > 0;
  };
  return {
    filledVisible: filled.every(vis),
    emptyVisible: empty.filter(vis).length,
    hintHidden: getComputedStyle(document.querySelector('.notes-hint')).display === 'none',
    filledBorder: filled.length ? getComputedStyle(filled[0]).borderTopStyle : null,
  };
});
eq(printed.filledVisible, true, 'a note with something in it prints');
eq(printed.emptyVisible, 0, 'and every empty box vanishes — a page of dashed boxes reads as an unfilled form');
eq(printed.filledBorder, 'none', 'the printed note is text, not a form field');
eq(printed.hintHidden, true, 'the on-screen explanation does not print either');
await page.emulateMedia({ media: 'screen' });

/* ── 6. an unreadable stored blob does not break the page ──────────────── */
const broken = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await broken.goto(URL_PAGE, { waitUntil: 'networkidle' });
await broken.evaluate(k => localStorage.setItem(k, '{not json'), KEY);
await broken.reload({ waitUntil: 'networkidle' });
await settle(broken, 900);
await openTeacher(broken, 'Moore');
ok((await broken.evaluate(() => document.querySelectorAll('.br-note').length)) >= 4,
   'a corrupt notes blob still renders the schedule with empty boxes');
await broken.fill('.br-note[data-note-day="A"][data-note-i="0"]', 'Starts over cleanly');
await broken.dispatchEvent('.br-note[data-note-day="A"][data-note-i="0"]', 'change');
await settle(broken, 300);
eq((await stored(broken)).Moore.A['0'], 'Starts over cleanly', 'and writing a new note repairs the store');

/* ── 7. no console noise ───────────────────────────────────────────────── */
for (const [name, p] of [['main', page], ['broken', broken]]) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
