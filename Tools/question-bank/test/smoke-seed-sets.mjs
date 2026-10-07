// smoke-seed-sets.mjs — Path 12 P2, increment 1: 053's and 062's built-in
// questions as read-only seed sets in the site's question bank, and the two
// tools themselves working exactly as they did.
//
//   node Tools/question-bank/test/smoke-seed-sets.mjs        (port 8502)
//
// What's worth holding still:
//   1. 053 and 062, whose built-in lists moved out of the page into a data
//      file at v267, show and print what they did before: each tool's bank
//      list, its cards on the board and its printed sheet are compared, to
//      the byte, with hashes taken from the pages as they were at v266, for
//      an empty browser and for one with custom and hidden questions;
//   2. neither tool loads the question bank or writes its key;
//   3. 030 lists the two sets beside the teacher's bank; choosing one shows
//      its questions with no Delete, filters them, and stores nothing;
//   4. a board is built and played straight from a set, with nothing copied
//      into the teacher's bank;
//   5. "Copy to my bank" stores that one question as the teacher's own, a
//      second copy is skipped, and the set is still whole;
//   6. the new controls are clean under axe.
// The module's own logic, and the two mappings field by field, are in
// question-bank.test.mjs. Every custom question here is made up.
//
// The pins in section 1 were made by running this file with --print against
// the v266 pages (SEED_053 and SEED_062 name another page file to open). A
// deliberate change to what either tool shows needs them made again.
// Exits 1 on any failure.

import crypto from 'node:crypto';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8502;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_053 = BASE + '/Tools/' + (process.env.SEED_053 || '053-cultural-trivia-card-generator.html');
const URL_062 = BASE + '/Tools/' + (process.env.SEED_062 || '062-geography-bee-quiz-generator.html');
const URL_030 = BASE + '/Tools/030-review-game-board.html';
const KEY = 'gvb-question-bank';
const PRINT = process.argv.includes('--print');
const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();

/* A page whose Math.random is a fixed sequence and whose print() does nothing,
   so 053's shuffled print sheet is the same sheet every run. */
async function fixedPage(storage) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ storage }) => {
    let a = 12345;
    Math.random = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x80000000; };
    window.print = () => { window.__printed = (window.__printed || 0) + 1; };
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
    }
  }, { storage });
  return page;
}

/* ── 1. the two tools show and print what they did ──────────────────────── */
console.log('053 and 062 — the tools as they were');

const STATE_053 = {
  ctcg_custom_v1: JSON.stringify([
    { id: 'tmade1', category: 'francophone', q: 'Made-up question about a <b>tag</b> & "quotes"?', a: 'A made-up answer' },
    { id: 'tmade2', category: 'global', q: 'Second made-up question?', a: 'Second answer' },
  ]),
  ctcg_hidden_v1: JSON.stringify(['b2', 'b11', 'b29']),
  ctcg_settings_v1: JSON.stringify({ category: 'francophone', cardCount: '9' }),
};
async function capture053(storage) {
  const page = await fixedPage(storage);
  await page.goto(URL_053, { waitUntil: 'networkidle' });
  await settle(page, 300);
  const out = {};
  out.bank = await page.$eval('#bankList', el => el.innerHTML) + '|' + await page.$eval('#bankCount', el => el.textContent);
  const card = () => page.evaluate(() => ['displayNum', 'displayCat', 'displayQ', 'displayA'].map(id => document.getElementById(id).textContent).join('¦'));
  const cards = [await card()];
  for (let i = 0; i < 4; i++) { await page.click('#nextBtn'); cards.push(await card()); }
  await page.click('#shuffleBtn'); cards.push(await card());
  await page.click('#prevBtn'); cards.push(await card());
  await page.selectOption('#categoryFilter', 'hispanic'); await page.click('#applyFilterBtn'); cards.push(await card());
  out.cards = cards.join('\n');
  await page.click('.tab-btn[data-stage="print"]');
  await page.click('#printBtn');
  out.print = await page.$eval('#printArea', el => el.innerHTML);
  await page.selectOption('#categoryFilter', ''); await page.click('#applyFilterBtn');
  await page.fill('#cardCount', '30');
  await page.click('#printBtn');
  out.printAll = await page.$eval('#printArea', el => el.innerHTML);
  out.printed = await page.evaluate(() => window.__printed);
  out.keys = await page.evaluate(() => Object.keys(localStorage).filter(k => !/^gvb-a11y|^__/.test(k)).sort());
  out.qb = await page.evaluate(() => typeof window.QuestionBank);
  out.errs = page.__errs.slice(); out.blocked = page.__blocked.slice();
  await page.context().close();
  return out;
}

const STATE_062 = {
  gbq_custom_v1: JSON.stringify([
    { id: 'gmade1', category: 'capitals', area: 'africa', q: 'Made-up capital of a <i>made-up</i> country?', a: 'Madeupville' },
    { id: 'gmade2', category: 'mapskills', q: 'Made-up map skill & more?', a: 'A made-up answer' },
  ]),
  gbq_disabled_v1: JSON.stringify(['bi1', 'bi45', 'bi95']),
};
async function capture062(storage) {
  const page = await fixedPage(storage);
  await page.goto(URL_062, { waitUntil: 'networkidle' });
  await settle(page, 600);
  const out = {};
  out.bank = await page.$eval('#bankList', el => el.innerHTML) + '|' + await page.$eval('#bankCount', el => el.textContent);
  const card = () => page.evaluate(() => ['displayNum', 'displayCat', 'displayQ', 'displayA'].map(id => document.getElementById(id).textContent).join('¦') + '¦' + document.getElementById('displayOptions').textContent);
  const cards = [await card()];
  for (let i = 0; i < 3; i++) { await page.click('#nextBtn'); cards.push(await card()); }
  await page.selectOption('#categoryFilter', 'landmarks'); await page.selectOption('#regionFilter', 'africa'); await page.click('#applyFilterBtn'); cards.push(await card());
  await page.selectOption('#categoryFilter', ''); await page.selectOption('#regionFilter', ''); await page.click('#applyFilterBtn');
  out.cards = cards.join('\n');
  await page.click('.tab-btn[data-stage="sheet"]');
  const sheet = async (version, count, format) => {
    await page.fill('#quizVersion', String(version));
    await page.fill('#sheetCount', String(count));
    await page.selectOption('#formatSelect', format);
    await page.evaluate(() => { document.getElementById('sheetProblems').innerHTML = ''; });
    await page.click('#buildSheetBtn');
    await page.waitForFunction(() => document.getElementById('sheetKey').children.length > 0, null, { timeout: 20000 });
    await settle(page, 300);
    // The sheet's markup, questions and key. A map question's picture is drawn
    // by gbq-map.js, which this change does not touch, and its pixels differ
    // from one Chromium to the next: each data: URL is cut to its length's
    // place, so where a picture sits is held and what it looks like is not.
    return page.evaluate(() => {
      const p = document.getElementById('sheetProblems'), k = document.getElementById('sheetKey');
      return (p.innerHTML + '\n#\n' + k.innerHTML).replace(/data:[^"')\s]+/g, 'data:…');
    });
  };
  out.sheet1 = await sheet(1, 10, 'short');
  out.sheet7 = await sheet(7, 30, 'mc');
  out.sheet3 = await sheet(3, 30, 'short');
  // Map questions the teacher generates take their wording from the data
  // file's mapQuestionText(): what is stored for six of them, ids aside.
  await page.click('.tab-btn[data-stage="bank"]');
  await page.selectOption('#mapGenDataset', 'us');
  await page.fill('#mapGenCount', '6');
  await page.click('#mapGenBtn');
  await page.waitForFunction(() => /Added 6 map question/.test(document.getElementById('mapGenNote').textContent), null, { timeout: 20000 });
  await page.selectOption('#mapGenDataset', 'world');
  await page.click('#mapGenBtn');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gbq_custom_v1') || '[]').filter(c => c.map).length === 12, null, { timeout: 20000 });
  out.maps = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('gbq_custom_v1')).filter(c => c.map).map(c => [c.category, c.q, c.a, c.area, c.map])));
  out.keys = await page.evaluate(() => Object.keys(localStorage).filter(k => !/^gvb-a11y|^__/.test(k)).sort());
  out.qb = await page.evaluate(() => typeof window.QuestionBank);
  out.errs = page.__errs.slice(); out.blocked = page.__blocked.slice();
  await page.context().close();
  return out;
}

/* Taken from the pages at v266, before the lists moved (see the header). */
const PINS = {
  '053 empty': {"bank":"a57c7a8c2d434a9d","cards":"cdb20f65d2847f2b","print":"d6c611b09df63854","printAll":"d263728a42cd8acd"},
  '053 seeded': {"bank":"bbacbbe5827652f0","cards":"e41ca90bed5b919f","print":"01b86d9397e8130e","printAll":"aaed6d90657b144c"},
  '062 empty': {"bank":"d216e5e399dd691b","cards":"3af70b156c43620a","sheet1":"4c2965739679980c","sheet7":"cdb4ef3cae0a7af9","sheet3":"ed8789b3fdf13cc5","maps":"f8b3328d1f2a957d"},
  '062 seeded': {"bank":"7c165ecdedaf22aa","cards":"47773f12f64a8598","sheet1":"2891d4ba18316eb1","sheet7":"60d2db4a2bb31ddb","sheet3":"84a329fbd2a31086","maps":"65b106e3ed88ffcb"},
};
for (const [name, run, storage] of [['053 empty', capture053, {}], ['053 seeded', capture053, STATE_053], ['062 empty', capture062, {}], ['062 seeded', capture062, STATE_062]]) {
  const got = await run(storage);
  const hashes = Object.fromEntries(Object.keys(PINS[name]).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(`  '${name}': ${JSON.stringify(hashes)},  // ${Object.keys(hashes).map(k => got[k].length).join(' ')} chars`); continue; }
  for (const k of Object.keys(PINS[name])) eq(hashes[k], PINS[name][k], `${name}: ${k} is byte for byte what the page gave before the list moved to a file`);
  ok(Object.keys(PINS[name]).every(k => got[k].length > 200), `${name}: and each of those is a real sheet, not an empty one`);
  eq(got.qb, 'undefined', `${name}: the tool does not load the question bank`);
  ok(!got.keys.includes(KEY) && got.keys.every(k => /^(ctcg|gbq)_/.test(k)), `${name}: and writes only its own keys: ${JSON.stringify(got.keys)}`);
  if (name.startsWith('053')) eq(got.printed, 2, `${name}: both print buttons printed`);
  eq(got.errs.length, 0, `${name}: no page errors: ${JSON.stringify(got.errs.slice(0, 3))}`);
  eq(got.blocked.length, 0, `${name}: nothing left the site`);
}
if (PRINT) { await browser.close(); server.close(); process.exit(0); }

/* ── 3. 030 lists the sets ──────────────────────────────────────────────── */
console.log('030 — seed sets beside the teacher\'s bank');
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
page.on('dialog', d => d.accept());
await page.goto(URL_030, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.goto(URL_030, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 200);

const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => !/^gvb-a11y/.test(k)).sort());
const rows = () => page.$$eval('#bankList .bank-entry', els => els.map(r => r.querySelector('.bank-q').textContent + ' / ' + r.querySelector('.bank-a').textContent));
const buttons = () => page.$$eval('#bankList .bank-entry button', els => [...new Set(els.map(b => b.textContent))]);
const choose = async id => { await page.selectOption('#bankSource', id); await settle(page, 200); };
const keys0 = await keys();

eq(await page.$$eval('#bankSource option', os => os.map(o => [o.value, o.textContent])), [
  ['', 'My question bank (0 questions)'],
  ['053', 'Cultural Trivia (built in, 30 questions, read-only)'],
  ['062', 'Geography Bee (built in, 90 questions, read-only)'],
], '"Questions from" offers the teacher\'s bank and the two sets, with their sizes');
ok(await page.isHidden('#bankSourceNote') && await page.isHidden('#bankCopyRow'), 'on the teacher\'s own bank there is no set note and no Copy button');

await choose('053');
const trivia = await rows();
eq([trivia.length, trivia[0], trivia[29]], [30, 'What is the traditional Mexican celebration honoring deceased loved ones called? / Día de los Muertos', 'What is the world’s most widely celebrated New Year based on the lunar calendar, especially in China? / Lunar New Year (Chinese New Year)'], '053\'s thirty are listed, first to last, in the tool\'s order');
eq(await buttons(), ['Copy to my bank'], 'a set\'s rows have "Copy to my bank" and no Delete');
ok(/053 Cultural Trivia Card Generator/.test(await page.textContent('#bankSourceNote')) && /cannot be changed or deleted/.test(await page.textContent('#bankSourceNote')), 'the note says where the set comes from and that it is read-only');
ok(await page.isVisible('#bankCopyRow'), 'and the Copy selected button is there');
eq(await page.$$eval('#bankFilterUnit option', os => os.map(o => o.value)), ['', 'Francophone World', 'Global Culture', 'Hispanic World'], 'the Unit filter offers the set\'s categories');
ok(!(await page.textContent('#bankList')).includes('0 pts'), 'a seed row shows no "0 pts"');

await choose('062');
eq((await rows()).length, 90, '062\'s ninety text questions are listed');
ok(!(await rows()).some(r => /highlighted on the map/.test(r)), 'none of them is a map question');
await page.selectOption('#bankFilterUnit', 'Capitals'); await settle(page, 150);
eq((await rows()).length, 30, 'filtered to Capitals, thirty');
await page.fill('#bankFilterQuery', 'japan'); await settle(page, 200);
eq(await rows(), ['What is the capital of Japan? / Tokyo'], 'and searched within the set');
await page.click('#bankClearFiltersBtn'); await settle(page, 150);
eq((await rows()).length, 90, 'Clear filters stays on the set');
eq(await keys(), keys0, 'looking through both sets wrote nothing to storage');

/* ── 4. play a board straight from a set ────────────────────────────────── */
console.log('030 — a board from a set, with nothing copied');
await page.selectOption('#bankFilterUnit', 'Landmarks'); await settle(page, 150);
const boxes = await page.$$('#bankList .bank-entry input[type="checkbox"]');
for (const i of [0, 1, 2]) await boxes[i].check();
await page.fill('#bankPullCategory', 'Landmarks');
await page.click('#bankPullBtn');
await settle(page, 300);
ok(await page.isVisible('#setupCard'), 'pulling from a set opens the board editor');
const pulled = await page.evaluate(() => {
  const block = [...document.querySelectorAll('#categoriesEditor .category-block')].find(b => b.querySelector('.cat-name-input').value === 'Landmarks');
  return [...block.querySelectorAll('.clue-row')].map(r => [r.querySelector('.clue-points').value, r.querySelector('.clue-question').value, r.querySelector('.clue-answer').value]);
});
eq(pulled, [
  ['100', 'In which country would you find the Great Pyramid of Giza?', 'Egypt'],
  ['200', 'In which country would you find the Eiffel Tower?', 'France'],
  ['300', 'In which country would you find Machu Picchu?', 'Peru'],
], 'the three seeds are clue rows, given 100, 200 and 300 points');
await page.fill('#boardName', 'Seed board');
await page.click('#buildFromManualBtn');
await settle(page, 400);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gvb-review-board:data:Seed board')));
eq(saved.categories.find(c => c.name === 'Landmarks').clues.map(c => [c.points, c.answer]), [[100, 'Egypt'], [200, 'France'], [300, 'Peru']], 'the board is saved with them');
ok(!JSON.stringify(saved).includes('seed:'), 'as plain clues: no seed id is on the board');
const cells = await page.$$eval('#boardCols .cell:not(.blank)', els => els.map(e => e.textContent));
ok(cells.includes('200'), 'the board shows its cells: ' + JSON.stringify(cells));
await page.click('#boardCols .cell:has-text("200")');
await settle(page, 300);
eq(await page.textContent('#overlayQuestion'), 'In which country would you find the Eiffel Tower?', 'and a cell opens the seed\'s question');
ok(!(await keys()).includes(KEY) || (await page.evaluate(k => JSON.parse(localStorage.getItem(k)).data.questions.length, KEY)) === 0, 'the teacher\'s bank is still empty: playing from a set copied nothing');
await page.keyboard.press('Escape');
await page.goto(URL_030, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 200);

/* ── 5. copy into the teacher's bank ────────────────────────────────────── */
console.log('030 — copying out of a set');
await choose('053');
await page.click('#bankCopyBtn');
eq(await page.$eval('#bankCopyStatus', el => [el.textContent, el.className]), ['Select at least one question first.', 'import-status error'], 'Copy selected with nothing selected says so');
await page.click('#bankList .bank-entry:nth-child(4) button');
await settle(page, 200);
eq(await page.$eval('#bankCopyStatus', el => [el.textContent, el.className]), ['Copied 1 question into your bank. Choose "My question bank" above to see it.', 'import-status ok'], 'a row\'s Copy button copies that question and says so');
eq(await page.inputValue('#bankSource'), '053', 'the list stays on the set');
let mine = await page.evaluate(() => window.QuestionBank.list());
eq(mine.map(q => [q.prompt, q.answer, q.unit, q.copiedFrom, q.category]), [['What ancient civilization built Machu Picchu?', 'The Inca', 'Hispanic World', 'seed:053:b3', 'hispanic']], 'the bank holds it with the fields the mapping gave it and where it came from');
ok(/^q-/.test(mine[0].id) && mine[0].createdAt, 'under an id and a date of its own');
const all = await page.$$('#bankList .bank-entry input[type="checkbox"]');
for (const i of [3, 4, 5]) await all[i].check();
await page.click('#bankCopyBtn');
await settle(page, 200);
eq(await page.$eval('#bankCopyStatus', el => el.textContent), 'Copied 2 questions into your bank; 1 question already in your bank. Choose "My question bank" above to see them.', 'copying three, one already there: two added, one skipped');
eq(await page.$$eval('#bankList .bank-entry input[type="checkbox"]', els => els.filter(e => e.checked).length), 0, 'and the selection is cleared');
await page.click('#bankList .bank-entry:nth-child(4) button');
await settle(page, 200);
eq(await page.$eval('#bankCopyStatus', el => el.textContent), 'Nothing copied: 1 question already in your bank.', 'the same question copied again is skipped');
eq((await rows()).length, 30, 'the set is still thirty');
eq(await page.$eval('#bankSource option', o => o.textContent), 'My question bank (3 questions)', 'the chooser counts the teacher\'s bank');
const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).data.questions, KEY);
eq([stored.length, stored.some(q => /^seed:/.test(q.id))], [3, false], 'storage holds the three copies and no seed id');

await choose('');
eq(await rows(), ['What ancient civilization built Machu Picchu? / The Inca', 'What is a popular Spanish tradition where people eat 12 grapes at midnight on New Year’s Eve? / Las doce uvas de la suerte', 'What is the name of the vibrant, multi-day festival held in Rio de Janeiro before Lent (in Brazil, Portuguese-speaking but culturally linked)? / Carnival (Carnaval)'], 'My question bank lists the copies');
// Since v275 a row of the teacher's own bank has Edit as well; a seed's row, above, still has neither.
eq(await buttons(), ['Edit', 'Delete'], 'where they have Edit and Delete, as any question of the teacher\'s');
await page.click('#bankList .bank-entry button.danger');
await settle(page, 200);
eq((await rows()).length, 2, 'and a copy can be deleted');
await choose('053');
eq((await rows())[3], 'What ancient civilization built Machu Picchu? / The Inca', 'the seed it was copied from is still in the set');
// A selection made in one source does not follow to another.
await (await page.$('#bankList .bank-entry input[type="checkbox"]')).check();
await choose('062'); await choose('053');
eq(await page.$$eval('#bankList .bank-entry input[type="checkbox"]', els => els.filter(e => e.checked).length), 0, 'a selection does not cross from one source to another');

/* ── 6. axe, and no noise ───────────────────────────────────────────────── */
const scan = await a11yScan(page, { include: ['#bankSection'] });
eq(scan.map(v => v.id), [], 'the bank tab with a set showing is clean under axe');
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
