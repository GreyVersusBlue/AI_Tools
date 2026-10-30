// smoke-adopter-051.mjs — Path 19 P2, 051 Classroom Label Maker reads the shared word lists.
//
//   node Tools/word-list/test/smoke-adopter-051.mjs        (port 8614)
//
// Held still here:
//   1. with no saved word list the row is not shown and the page is as before;
//   2. with 040's lists saved before the hub (their old keys) and a 039 set, the row offers them, and
//      adding one puts "target: English" lines in the box, nothing is saved until Save list, and the
//      label list it makes is the words (a term with a colon is named as left out, not dropped quietly);
//   3. 051 writes none of the other tools' keys and the row is clean under axe.
// Every word is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8614;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_051 = BASE + '/Tools/051-classroom-label-maker.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SEED = {
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 1']),
  'gvb-vocab-flashcards:data:Made-up Unit 1': JSON.stringify({ name: 'Made-up Unit 1', words: 'la mesa: the table | La mesa es grande\nla silla\tthe chair\nla ventana, the window\na:b\tcolon term', mode: 'flashcards' }),
  'gvb-vocab-conj:list': JSON.stringify(['Drill set']),
  'gvb-vocab-conj:data:Drill set': JSON.stringify({ name: 'Drill set', mode: 'vocab', vocabText: 'hablar: to speak', conjugations: [] }),
};

const server = await serve(PORT);
const browser = await launch();

async function open(storage) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ storage }) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
    }
  }, { storage });
  await page.goto(URL_051, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}

console.log('051 — no saved word lists');
let page = await open({});
eq(await page.isVisible('#wordListRow'), false, 'the row is not shown');
await page.context().close();

console.log('051 — add words from a saved word list');
page = await open(SEED);
eq(await page.isVisible('#wordListRow'), true, 'the row is shown');
eq(await page.$$eval('#wordListSelect option', o => o.map(x => x.value)), ['Made-up Unit 1', 'Drill set'], 'it offers 040\'s list and 039\'s set');
const savedBefore = await page.evaluate(() => localStorage.getItem('clm_lists_v1'));
await page.selectOption('#wordListSelect', 'Made-up Unit 1');
await page.fill('#wordInput', 'el libro: the book');
await page.click('#wordListAddBtn'); await settle(page, 100);
eq(await page.inputValue('#wordInput'), 'el libro: the book\nla mesa: the table\nla silla: the chair\nla ventana: the window', 'the words are added after what was there, as target: English');
ok(/1 word was left out because its term has a colon/.test(await page.textContent('#wordListNote')), 'a term with a colon is named as left out: ' + await page.textContent('#wordListNote'));
eq(await page.evaluate(() => localStorage.getItem('clm_lists_v1')), savedBefore, 'nothing is saved until Save list');
await page.click('#saveWordsBtn'); await settle(page, 150);
eq(await page.textContent('#wordCount'), '4', 'Save list makes the four words');
eq(await page.$$eval('#wordTable tr td:first-child', c => c.map(x => x.textContent.trim()).filter(Boolean).slice(0, 4)), ['el libro', 'la mesa', 'la silla', 'la ventana'], 'the label list is those words');
await page.selectOption('#wordListSelect', 'Drill set');
await page.click('#wordListAddBtn'); await settle(page, 100);
ok((await page.inputValue('#wordInput')).endsWith('hablar: to speak'), '039\'s set can be added too');
const touched = await page.evaluate(() => Object.keys(localStorage).filter(k => /^gvb-vocab-/.test(k)).sort());
eq(touched, ['gvb-vocab-conj:data:Drill set', 'gvb-vocab-conj:list', 'gvb-vocab-flashcards:data:Made-up Unit 1', 'gvb-vocab-flashcards:list'], '051 adds no key of 040\'s or 039\'s');
eq(await page.evaluate(() => localStorage.getItem('gvb-vocab-flashcards:list')), SEED['gvb-vocab-flashcards:list'], 'and changes none');
const scan = await a11yScan(page, { include: ['#wordListRow'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the row is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
