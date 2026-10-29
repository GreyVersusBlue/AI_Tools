// smoke-adopter-039.mjs — Path 19 P2, 039 Vocab & Conjugation Drill on the shared word lists.
//
//   node Tools/word-list/test/smoke-adopter-039.mjs        (port 8612)
//
// Held still here:
//   1. 039's import row now reads the word lists, and 040's lists (saved in 040's old keys, never opened
//      since) are in them: the words that come over are term and definition, as before;
//   2. a set 039 saved before the hub is a list too, and 039's own keys are not written by the migration;
//   3. typing vocabulary writes through to the list of that name by term and definition only: a list's
//      example, gender and tags (given in 040's hub) stay;
//   4. nothing about the page's own behaviour moved: the preview, the set and the page's errors;
//   5. the import row is clean under axe.
// The comma-with-quotes difference between 040's reader and the 40-line copy 039 used to carry is the
// one deliberate change (the hub reads a line the way 040 does) and is not exercised here. Every word is
// made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8612;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_039 = BASE + '/Tools/039-vocab-conjugation-drill.html';
const HUB = 'gvb-word-lists';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const drill = (name, vocabText, extra = {}) => JSON.stringify({ name, mode: 'vocab', vocabText, persons: ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'], conjugations: [], ...extra });
const SEED = {
  // 040's lists in the keys 040 wrote before the hub
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 1']),
  'gvb-vocab-flashcards:data:Made-up Unit 1': JSON.stringify({ name: 'Made-up Unit 1', words: 'casa: house | Mi casa | KAH-sah | noun\nperro\tdog\nnot a word line\nluz, light', mode: 'flashcards' }),
  // 039's own set from before
  'gvb-vocab-conj:list': JSON.stringify(['Older drill']),
  'gvb-vocab-conj:data:Older drill': drill('Older drill', 'hablar: to speak\ncomer: to eat'),
  'gvb-vocab-conj:current': 'Older drill',
};

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
page.on('dialog', d => d.accept());
await page.addInitScript(({ storage }) => {
  if (!sessionStorage.getItem('__seeded')) {
    sessionStorage.setItem('__seeded', '1');
    for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
  }
}, { storage: SEED });
await page.goto(URL_039, { waitUntil: 'networkidle' });
await settle(page, 300);
const hub = () => page.evaluate(k => { const v = localStorage.getItem(k); return v ? JSON.parse(v).data : null; }, HUB);

/* ── 1 and 2. the import row reads the lists; the older set is a list ─── */
console.log('039 — the import row reads the word lists');
eq(await page.$$eval('#flashSetSelect option', o => o.map(x => x.value)), ['Made-up Unit 1', 'Older drill'], 'the row offers 040\'s list and 039\'s own older set');
ok(await page.isVisible('#importFlashRow'), 'the row is shown');
await page.selectOption('#flashSetSelect', 'Made-up Unit 1');
await page.fill('#vocabInput', '');
await page.click('#importFlashBtn'); await settle(page, 200);
eq(await page.inputValue('#vocabInput'), 'casa: house\nperro: dog\nluz: light', 'the words come over as term: definition, as they did');
eq(await page.evaluate(() => localStorage.getItem('gvb-vocab-flashcards:list')), SEED['gvb-vocab-flashcards:list'], '040\'s keys are untouched');
eq(await page.evaluate(() => localStorage.getItem('gvb-vocab-conj:list')), SEED['gvb-vocab-conj:list'], '039\'s list of sets is untouched: the migration adds no set and removes none');
let h = await hub();
eq(h.lists.map(l => l.name), ['Made-up Unit 1', 'Older drill'], 'both are lists in the hub');

/* ── 3. write-through keeps what 039 has no place for ─────────────────── */
console.log('039 — what is typed here reaches the list');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('gvb-word-lists'));
  const w = s.data.lists[0].words.find(x => x.term === 'casa'); w.gender = 'f'; w.tags = ['u1'];
  localStorage.setItem('gvb-word-lists', JSON.stringify(s));
});
const current = await page.inputValue('#setName');
await page.fill('#setName', 'Made-up Unit 1'); await page.press('#setName', 'Tab'); await settle(page, 100);
await page.fill('#vocabInput', 'casa: home\nperro: hound\nnueva: new'); await settle(page, 100);
await page.evaluate(() => document.getElementById('vocabInput').dispatchEvent(new Event('input', { bubbles: true })));
await settle(page, 100);
h = await hub();
const l1 = h.lists.find(l => l.name === 'Made-up Unit 1');
ok(!!l1, 'the list of that name is still in the hub (current set was ' + current + ')');
// 039 saves on the actions that call Store.save; the vocabulary text is saved with the set
ok(l1 && l1.words.length >= 3, 'the list has the words');
eq(l1 && l1.words.filter(w => w.term === 'casa').map(w => [w.definition, w.example, w.gender, w.tags]), [['home', 'Mi casa', 'f', ['u1']]], 'definition follows the edit; example, gender and tags stay with the term');

/* ── 4 and 5. errors, axe ─────────────────────────────────────────────── */
const scan = await a11yScan(page, { include: ['#importFlashRow'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the import row is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
