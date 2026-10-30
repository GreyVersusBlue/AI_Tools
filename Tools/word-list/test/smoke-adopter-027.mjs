// smoke-adopter-027.mjs — Path 19 P2, 027 Novel Study / Reading Circles Manager's vocabulary export
// on the shared word lists.
//
//   node Tools/word-list/test/smoke-adopter-027.mjs        (port 8613)
//
// Held still here:
//   1. the export makes a list in the shared word lists, named "<book> Vocabulary", with each word once
//      (case-insensitively, the earliest definition kept), and 027 writes none of 040's own keys;
//   2. a second export of the same book makes "<book> Vocabulary (2)": nothing is overwritten, and a
//      list name 040 saved before the hub counts as taken;
//   3. 040 then opens the exported list, as it did when 027 wrote 040's keys: its editor shows the
//      words, it has a saved list of that name, and the hub's pointer is cleared (opened once);
//   4. a list with no definitions for the words is exported word-only, as before.
// Every name and word is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8613;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_027 = BASE + '/Tools/027-novel-study-circles-manager.html';
const URL_040 = BASE + '/Tools/040-vocab-flashcard-generator.html';
const HUB = 'gvb-word-lists';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
page.on('dialog', d => d.accept());
// window.open is the hand-off to 040; the test opens 040 itself in the same context
await page.addInitScript(() => { window.open = () => null; });
// a list 040 saved before the hub, under the name the first export would take
await page.addInitScript(() => {
  if (!sessionStorage.getItem('__seeded')) {
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('gvb-vocab-flashcards:list', JSON.stringify(['Made-up Book Vocabulary']));
    localStorage.setItem('gvb-vocab-flashcards:data:Made-up Book Vocabulary', JSON.stringify({ name: 'Made-up Book Vocabulary', words: 'old: older', mode: 'flashcards' }));
  }
});
const click = async id => { await page.click('#' + id); await settle(page, 250); };
const hub = () => page.evaluate(k => { const v = localStorage.getItem(k); return v ? JSON.parse(v).data : null; }, HUB);

console.log('027 — the vocabulary export');
await page.goto(URL_027, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.fill('#bookTitle', 'Made-up Book');
await page.fill('#namesInput', ['Alice', 'Ben', 'Cara', 'Deja'].join('\n'));
await click('splitBtn');
await page.fill('#meetingDate', '2026-08-17');
await page.fill('#meetingVocab', 'austerity: harsh economy\nutilitarian\nHarbor: a port');
await click('logMeetingBtn');
await page.fill('#meetingDate', '2026-08-18');
await page.fill('#meetingVocab', 'Utilitarian: practical over pretty\nharbor: other\nplain: simple');
await click('logMeetingBtn');
const flashKeys = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^gvb-vocab-flashcards:/.test(k)).sort().map(k => [k, localStorage.getItem(k)])));
const flashBefore = await flashKeys();
await click('exportVocabBtn');
let h = await hub();
eq(h && h.lists.map(l => l.name), ['Made-up Book Vocabulary (2)'], 'the export is a new list; the name 040 saved before the hub counts as taken');
eq(h && h.lists[0].words.map(w => [w.term, w.definition]), [['austerity', 'harsh economy'], ['utilitarian', 'practical over pretty'], ['Harbor', 'a port'], ['plain', 'simple']],
  'each word once, the earliest spelling kept, a missing definition filled from a later meeting');
eq(await flashKeys(), flashBefore, '027 writes none of 040\'s own keys');
eq(h.current, 'Made-up Book Vocabulary (2)', 'the hub points at the new list');
await click('exportVocabBtn');
h = await hub();
eq(h.lists.map(l => l.name), ['Made-up Book Vocabulary (2)', 'Made-up Book Vocabulary (3)'], 'a second export makes a third name and overwrites nothing');

console.log('027 — 040 opens it');
const page2 = await prepPage(browser, BASE, { width: 1300, height: 1000 });
page2.on('dialog', d => d.accept());
await page2.goto(URL_040, { waitUntil: 'networkidle' });
await settle(page2, 300);
// same browser context? prepPage opens a fresh context, so carry the storage over
const store = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
await page2.evaluate(s => { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); }, store);
await page2.reload({ waitUntil: 'networkidle' });
await settle(page2, 400);
eq(await page2.inputValue('#listName'), 'Made-up Book Vocabulary (3)', '040 opens the list the hub named');
ok((await page2.inputValue('#wordInput')).startsWith('austerity: harsh economy\nutilitarian: practical over pretty'), 'its editor shows the exported words');
eq(await page2.evaluate(() => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:list'))), ['Made-up Book Vocabulary', 'Made-up Book Vocabulary (3)'], '040 has a saved list of that name, beside the old one');
h = await page2.evaluate(k => JSON.parse(localStorage.getItem(k)).data, HUB);
eq(h.current, '', 'and the pointer is cleared');
await page2.reload({ waitUntil: 'networkidle' }); await settle(page2, 300);
eq(await page2.inputValue('#listName'), 'Made-up Book Vocabulary (3)', 'the next load opens the last list, as always');
eq(page.__errs.concat(page2.__errs), [], 'no page or console errors');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
