// smoke-adopter-014.mjs — Path 19 P2, 014 Immersion Roleplay Scenario Generator fills its vocabulary
// cards from the shared word lists.
//
//   node Tools/word-list/test/smoke-adopter-014.mjs        (port 8616)
//
// Held still here:
//   1. with no saved word list the row is not shown and a scenario renders as it did;
//   2. a word fills an empty card when its definition is the card's English phrase (case, spacing and a
//      final full stop ignored); a card the teacher already typed in is never changed; a card with no
//      matching word stays empty; the page says how many it filled;
//   3. what it filled is kept (the page's own fills key) and survives a reload, and 014 changes none of
//      040's keys;
//   4. the row is clean under axe.
// The phrases come from the page itself (the first scenario shown), so the test follows the scenario
// data; every word is made up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8616;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_014 = BASE + '/Tools/014-roleplay-scenario-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
async function open(storage) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1200 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ storage }) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
    }
  }, { storage });
  await page.goto(URL_014, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const prompts = page => page.evaluate(() => Array.from(document.querySelector('.scaff-grid').querySelectorAll('.scaff-card .prompt')).map(x => x.textContent));
const fills = page => page.evaluate(() => Array.from(document.querySelector('.scaff-grid').querySelectorAll('.fill-input')).map(x => x.value));

console.log('014 — no saved word lists');
let page = await open({});
eq(await page.locator('#fillListBtn').count(), 0, 'the row is not shown');
const phrases = await prompts(page);
const currentScenario = await page.evaluate(() => localStorage.getItem('gvb-roleplay:current'));
ok(phrases.length >= 3, 'the scenario has at least three phrases to try: ' + phrases.length);
await page.context().close();

console.log('014 — fill the empty cards');
const words = [
  phrases[0].toUpperCase() + '   ',          // case, trailing spaces
  phrases[1].replace(/[.!?]+$/, '') + '.',    // a final full stop it does not have
];
const wordsText = 'palabra uno: ' + words[0] + '\npalabra dos: ' + words[1] + '\nunrelated: nothing like any phrase';
const SEED = {
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 1']),
  'gvb-vocab-flashcards:data:Made-up Unit 1': JSON.stringify({ name: 'Made-up Unit 1', words: wordsText, mode: 'flashcards' }),
};
page = await open({ ...SEED, 'gvb-roleplay:current': currentScenario });
const shown = await prompts(page);
ok(await page.isVisible('#fillListBtn'), 'the row is shown');
await page.fill('.scaff-grid .fill-input[data-idx="2"]', 'typed by the teacher');
await page.selectOption('#fillListSelect', 'Made-up Unit 1');
await page.click('#fillListBtn'); await settle(page, 200);
const got = await fills(page);
eq(got.slice(0, 3), ['palabra uno', 'palabra dos', 'typed by the teacher'], 'two cards are filled from matching definitions and the typed card is untouched');
ok(got.slice(3).every(v => v === ''), 'a card with no matching word stays empty');
ok(/Filled 2 of (\d+) empty cards? from "Made-up Unit 1"/.test(await page.textContent('#fillListNote')), 'the page says how many: ' + await page.textContent('#fillListNote'));
eq(shown, phrases, 'the page shows the same scenario as the one the words were made from');
await page.click('#fillListBtn'); await settle(page, 200);
ok(/Filled 0 of/.test(await page.textContent('#fillListNote')) && (await fills(page)).slice(0, 3).join('|') === 'palabra uno|palabra dos|typed by the teacher', 'pressing it again changes nothing');
eq(await page.evaluate(() => localStorage.getItem('gvb-vocab-flashcards:list')), SEED['gvb-vocab-flashcards:list'], '014 changes none of 040\'s keys');
const kept = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('gvb-roleplay:fills') || '{}')).flatMap(c => Object.values(c)).flat().filter(Boolean).sort());
eq(kept, ['palabra dos', 'palabra uno', 'typed by the teacher'], 'what was filled is kept in the page\'s own fills');
const scan = await a11yScan(page, { include: ['.fill-from-list'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the row is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
