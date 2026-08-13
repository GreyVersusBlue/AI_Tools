// smoke-writing-record.mjs — the Writing Record: a teacher-typed, per-student
// log of which prompt a student wrote to and the teacher's conference note,
// printable per student.
//
//   node Tools/writing-prompt-generator/test/smoke-writing-record.mjs
//
// Covers the storage contract (gvb-writing-prompts:record, via
// wpg-store.js's loadRecord/saveRecord), the student picker (typed name, or
// picked off a loaded np_rosters roster — read-only, same pattern as the
// Roster Assignment Sheet), adding/editing/removing entries, and the
// per-student print page. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8178;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/025-writing-prompt-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const deepEq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1200 });

console.log('Writing Prompt — Writing Record (per-student conference log)');

const readRecord = () => page.evaluate(() => JSON.parse(localStorage.getItem('gvb-writing-prompts:record') || '{}'));
const datalistOptions = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#recordStudentDatalist option')).map(o => o.value));

async function setStudent(name) {
  await page.fill('#recordStudentInput', name);
  await settle(page, 120);
}

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);

/* ── nothing logged yet ─────────────────────────────────────────────────── */
eq(await page.textContent('#recordViewerName'), 'No student selected', 'no student picked at boot');
ok(await page.isDisabled('#printRecordBtn'), 'print is disabled with no student picked');
ok(await page.isDisabled('#useCurrentPromptBtn'), '"use current prompt" is disabled with nothing on stage yet');
deepEq((await readRecord()), {}, 'the record key starts empty');

/* ── a saved roster feeds the student picker's datalist, read-only ────────── */
const ROSTER = ['Avery Chen', 'Bo Alvarez', 'Cass Nguyen'];
await page.evaluate(names => {
  localStorage.setItem('np_rosters', JSON.stringify({ '2nd Period': names }));
}, ROSTER);
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);

const rosterOpts = await page.evaluate(() =>
  Array.from(document.getElementById('recordRosterLoadSelect').options).map(o => o.textContent));
ok(rosterOpts.some(o => /2nd Period \(3\)/.test(o)), 'the saved roster is offered by name and size: ' + JSON.stringify(rosterOpts));

await page.selectOption('#recordRosterLoadSelect', '2nd Period');
await settle(page, 150);
deepEq((await datalistOptions()).sort(), ROSTER.slice().sort(), 'picking a roster feeds its names into the student datalist');

// np_rosters itself must come back untouched — this panel only reads it.
deepEq((await page.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')))), { '2nd Period': ROSTER },
   'np_rosters is read-only from this panel');

/* ── picking a student with no entries yet ─────────────────────────────────── */
await setStudent('Avery Chen');
eq(await page.textContent('#recordViewerName'), 'Avery Chen', 'the viewer heading follows the typed name');
ok(/No entries yet for Avery Chen/.test(await page.textContent('#recordEntriesList')), 'and says so when there is nothing logged yet');
ok(await page.isDisabled('#printRecordBtn'), 'print stays disabled until there is at least one entry');

/* ── adding a hand-typed entry, not tied to whatever's on stage ───────────── */
await page.fill('#recordPromptText', 'Write about a time you changed your mind about something.');
await page.fill('#recordNoteText', 'Strong hook; needs a clearer conclusion. Revisit topic sentences.');
await page.click('#addRecordEntryBtn');
await settle(page, 150);

let record = await readRecord();
ok(Array.isArray(record['Avery Chen']) && record['Avery Chen'].length === 1, 'the entry is stored under the exact student name');
let entry = record['Avery Chen'][0];
eq(entry.promptText, 'Write about a time you changed your mind about something.', 'the prompt text is stored verbatim');
eq(entry.note, 'Strong hook; needs a clearer conclusion. Revisit topic sentences.', 'the note is stored verbatim');
eq(entry.band, null, 'a hand-typed entry (not matching the stage prompt) carries no band');
eq(entry.genre, null, 'and no genre either — nothing to infer it from');
ok(/^\d{4}-\d{2}-\d{2}$/.test(entry.date), 'the entry got a date: ' + entry.date);
ok(typeof entry.id === 'string' && entry.id.length > 0, 'the entry has an id');

ok(!(await page.isDisabled('#printRecordBtn')), 'print enables once there is an entry');
ok(/Write about a time you changed your mind/.test(await page.textContent('#recordEntriesList')), 'the new entry renders in the viewer');

/* ── "Use the prompt on stage" pulls in the live prompt, and tags band/genre/rubric ── */
await page.click('#generateBtn');
await settle(page, 200);
const stagePrompt = await page.evaluate(() => document.querySelector('#stagePrompt .prompt-text').textContent);
ok(!(await page.isDisabled('#useCurrentPromptBtn')), 'the button enables once a prompt is on stage');

await setStudent('Bo Alvarez');
await page.click('#useCurrentPromptBtn');
eq(await page.inputValue('#recordPromptText'), stagePrompt, 'clicking it copies the exact prompt text on stage');
await page.fill('#recordNoteText', 'Great use of dialogue.');
await page.click('#addRecordEntryBtn');
await settle(page, 150);

record = await readRecord();
entry = record['Bo Alvarez'][0];
eq(entry.promptText, stagePrompt, 'the entry matches the stage prompt exactly');
ok(entry.band === 'ms' || entry.band === 'hs', 'and picks up the band from the matching stage prompt: ' + entry.band);
ok(typeof entry.genre === 'string' && entry.genre.length > 0, 'and the genre too: ' + entry.genre);

/* ── the student datalist also picks up names that only exist because they were logged (not on any roster) ── */
await setStudent('Devon Prep (no roster)');
await page.fill('#recordPromptText', 'A one-off make-up assignment.');
await page.click('#addRecordEntryBtn');
await settle(page, 150);
ok((await datalistOptions()).includes('Devon Prep (no roster)'),
   'a student logged without a saved roster still shows up in the datalist next time');

/* ── multiple entries for one student, newest first ─────────────────────── */
await setStudent('Avery Chen');
await page.fill('#recordPromptText', 'Describe your favorite place and why it matters to you.');
await page.fill('#recordNoteText', 'Second entry.');
await page.click('#addRecordEntryBtn');
await settle(page, 150);

record = await readRecord();
eq(record['Avery Chen'].length, 2, 'a second entry for the same student appends rather than overwrites');
const entryOrderOnScreen = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#recordEntriesList .record-entry-prompt')).map(p => p.textContent));
eq(entryOrderOnScreen[0], 'Describe your favorite place and why it matters to you.', 'the newest entry lists first');

/* ── editing a note in place persists it ─────────────────────────────────── */
const noteBoxes = await page.$$('#recordEntriesList .record-entry-note');
await noteBoxes[1].fill('Updated: revisit the ending.');
await settle(page, 200);
record = await readRecord();
const oldest = record['Avery Chen'].filter(e => e.promptText.indexOf('changed your mind') !== -1)[0];
eq(oldest.note, 'Updated: revisit the ending.', 'editing a note textarea in place updates storage without re-adding');

/* ── removing an entry ───────────────────────────────────────────────────── */
const beforeRemove = (await readRecord())['Avery Chen'].length;
await page.click('#recordEntriesList li:last-child .remove-btn');
await settle(page, 150);
record = await readRecord();
eq(record['Avery Chen'].length, beforeRemove - 1, 'removing an entry drops just that one');

/* ── removing the last entry for a student clears the student's key entirely ── */
await setStudent('Devon Prep (no roster)');
await page.click('#recordEntriesList li:last-child .remove-btn');
await settle(page, 150);
record = await readRecord();
ok(!Object.prototype.hasOwnProperty.call(record, 'Devon Prep (no roster)'),
   'a student with zero remaining entries is dropped from the record object, not left as an empty array');
ok(await page.isDisabled('#printRecordBtn'), 'print disables again once the viewed student has no entries left');

/* ── the printable page ──────────────────────────────────────────────────── */
await setStudent('Bo Alvarez');
await page.evaluate(() => {
  const orig = window.print;
  window.print = () => {};
  document.getElementById('printRecordBtn').click();
  window.print = orig;
});
await page.emulateMedia({ media: 'print' });
await settle(page, 200);

const printed = await page.evaluate(() => ({
  active: document.getElementById('recordPrintArea').classList.contains('active'),
  heading: document.querySelector('#recordPrintArea h1') ? document.querySelector('#recordPrintArea h1').textContent : '',
  entryCount: document.querySelectorAll('#recordPrintArea .record-print-list > li').length,
  promptText: document.querySelector('#recordPrintArea .rp-prompt') ? document.querySelector('#recordPrintArea .rp-prompt').textContent : '',
  noteText: document.querySelector('#recordPrintArea .rp-note') ? document.querySelector('#recordPrintArea .rp-note').textContent : '',
}));
ok(printed.active, 'the record print area is active in print media');
ok(/Bo Alvarez/.test(printed.heading), 'the printed heading names the student: ' + printed.heading);
eq(printed.entryCount, 1, 'one printed entry for Bo Alvarez');
eq(printed.promptText, stagePrompt, 'the printed entry carries the exact prompt text');
ok(/Great use of dialogue/.test(printed.noteText), 'and the teacher note: ' + printed.noteText);

await page.emulateMedia({ media: 'screen' });

/* ── the roster assignment sheet's own print/roster machinery is untouched ── */
deepEq((await page.evaluate(() => JSON.parse(localStorage.getItem('np_rosters')))), { '2nd Period': ROSTER },
   'np_rosters is still exactly what was seeded — nothing in this round wrote to it');

/* ── persists across a reload ────────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
record = await readRecord();
ok(Array.isArray(record['Bo Alvarez']) && record['Bo Alvarez'].length === 1, 'the record survives a reload');

/* ── no console noise, nothing left the site ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
