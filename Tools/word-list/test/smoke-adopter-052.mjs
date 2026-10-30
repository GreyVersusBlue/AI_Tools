// smoke-adopter-052.mjs — Path 19 P2, 052 Cognates & False Friends Builder starts from a shared word list.
//
//   node Tools/word-list/test/smoke-adopter-052.mjs        (port 8615)
//
// Held still here:
//   1. with no saved word list the row is not shown;
//   2. with 040's lists saved before the hub, the row offers them and puts "word<TAB>English" lines in the
//      bulk box (a word with no definition is not put in), adds to the box rather than replacing it, and
//      adds nothing to the page's lists until the existing Add to lists button is pressed;
//   3. Add to lists then makes the true cognates, exactly as a pasted spreadsheet would, and a tab and a
//      third field makes a false friend;
//   4. 052 changes none of 040's keys, and the row is clean under axe.
// Every word is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8615;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_052 = BASE + '/Tools/052-cognates-false-friends-builder.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const SEED = {
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 1']),
  'gvb-vocab-flashcards:data:Made-up Unit 1': JSON.stringify({ name: 'Made-up Unit 1', words: 'animal: animal\nhospital: hospital\nno-definition-word:\nactual | pipe: really', mode: 'flashcards' }),
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
  await page.goto(URL_052, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const counts = page => page.evaluate(() => [document.querySelectorAll('#cognatesWrap .row3').length, document.querySelectorAll('#falseFriendsWrap .row3').length]);

console.log('052 — no saved word lists');
let page = await open({});
eq(await page.isVisible('#wordListRow'), false, 'the row is not shown');
await page.context().close();

console.log('052 — start from a saved word list');
page = await open(SEED);
eq(await page.isVisible('#wordListRow'), true, 'the row is shown');
eq(await page.$$eval('#wordListSelect option', o => o.map(x => x.value)), ['Made-up Unit 1'], 'it offers 040\'s list');
const before = await counts(page);
await page.fill('#bulkInput', 'typed\tword');
await page.click('#wordListFillBtn'); await settle(page, 100);
eq(await page.inputValue('#bulkInput'), 'typed\tword\nanimal\tanimal\nhospital\thospital\nactual | pipe\treally', 'the words are added after what was typed, tab-separated; a word without a definition is left out');
eq(await counts(page), before, 'nothing is added to the lists yet');
await page.click('#bulkImportBtn'); await settle(page, 150);
const after = await counts(page);
eq([after[0] - before[0], after[1] - before[1]], [4, 0], 'Add to lists makes four true cognates, the pipe in a word safe');
await page.fill('#bulkInput', 'embarazada\tembarrassed\tactually pregnant');
await page.click('#bulkImportBtn'); await settle(page, 150);
eq((await counts(page))[1] - after[1], 1, 'a third field after a tab makes a false friend');
eq(await page.evaluate(() => localStorage.getItem('gvb-vocab-flashcards:list')), SEED['gvb-vocab-flashcards:list'], '052 changes none of 040\'s keys');
const scan = await a11yScan(page, { include: ['#wordListRow'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the row is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
