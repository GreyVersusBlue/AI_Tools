// smoke-hub.mjs — Path 19 P1: the Word Lists hub on 040.
//
//   node Tools/word-list/test/smoke-hub.mjs        (port 8611)
//
// Held still here:
//   1. migration: lists saved by the page before the hub (fixtures of the old format) are in the hub on
//      the first load, under their names and in their order, 040's own keys are byte for byte as they were,
//      and a list deleted afterwards does not come back on the next load;
//   2. write-through: typing in the textarea reaches the hub; a gender and a tag given to a word in the hub
//      survive an edit of the text; rename and delete go to both;
//   3. a pasted table and a file are read into a review that stores nothing, and Add stores them (a new
//      list, and a same-named list joined by term without changing a word that is filled);
//   4. the downloads: all lists as JSON, this list as CSV (read back by the module), the blank template;
//   5. the card is clean under axe and the page has no errors.
// Every word and list here is made up. Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';

const PORT = 8611;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_040 = BASE + '/Tools/040-vocab-flashcard-generator.html';
const HUB = 'gvb-word-lists';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; fails.push(label); console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const OLD = {
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 1', 'Made-up Unit 2']),
  'gvb-vocab-flashcards:data:Made-up Unit 1': JSON.stringify({ name: 'Made-up Unit 1', words: 'casa: house | Mi casa | KAH-sah | noun\nperro\tdog\nnot a word line\nluz, light', mode: 'wordwall', flashCols: 3, flashRows: 2 }),
  'gvb-vocab-flashcards:data:Made-up Unit 2': JSON.stringify({ name: 'Made-up Unit 2', words: 'cell: unit of life\nmitosis: division', mode: 'flashcards' }),
  'gvb-vocab-flashcards:current': 'Made-up Unit 2',
};

const server = await serve(PORT);
const browser = await launch();
const tmp = fs.mkdtempSync(path.join(process.env.AI27_SCRATCH || os.tmpdir(), 'hub-'));

async function open(storage) {
  const page = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ storage }) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]);
    }
  }, { storage });
  await page.goto(URL_040, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const hub = page => page.evaluate(k => { const v = localStorage.getItem(k); return v ? JSON.parse(v).data : null; }, HUB);
const own = page => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /^gvb-vocab-flashcards:/.test(k)).sort().map(k => [k, localStorage.getItem(k)])));
const rows = page => page.$$eval('#hubList li .hub-name', els => els.map(e => e.textContent));

/* ── 1. migration ───────────────────────────────────────────────────────── */
console.log('040 — Word Lists: lists saved before the hub');
let page = await open(OLD);
let h = await hub(page);
eq(h.lists.map(l => l.name), ['Made-up Unit 1', 'Made-up Unit 2'], 'the old lists are in the hub under their names, in order');
eq(h.lists[0].words.map(w => [w.term, w.definition, w.example, w.pronunciation, w.partOfSpeech]),
  [['casa', 'house', 'Mi casa', 'KAH-sah', 'noun'], ['perro', 'dog', '', '', ''], ['luz', 'light', '', '', '']], 'a list\'s words are what 040 read from the same text');
eq(await rows(page), ['Made-up Unit 1 (3 words)', 'Made-up Unit 2 (2 words)'], 'the card lists them with their counts');
const ownAfter = await own(page);
const oldKeys = Object.keys(OLD).sort();
eq(Object.keys(ownAfter).sort(), oldKeys, 'the page keeps 040\'s keys and adds none');
eq(oldKeys.filter(k => k !== 'gvb-vocab-flashcards:data:Made-up Unit 2' && ownAfter[k] !== OLD[k]), [], 'every key the page did not open is byte for byte as it was');
eq(JSON.parse(ownAfter['gvb-vocab-flashcards:data:Made-up Unit 2']).words, 'cell: unit of life\nmitosis: division', 'the list it opened keeps its words (the page fills in its settings defaults, as it always did)');
eq(await page.inputValue('#listName'), 'Made-up Unit 2', 'the list that was current opens, as before');

/* ── 2. write-through ───────────────────────────────────────────────────── */
console.log('040 — Word Lists: the page writes through');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('gvb-word-lists'));
  const w = s.data.lists[1].words.find(x => x.term === 'cell'); w.gender = 'f'; w.tags = ['bio'];
  localStorage.setItem('gvb-word-lists', JSON.stringify(s));
});
await page.fill('#wordInput', 'mitosis: cell division\ncell: smallest unit\nnucleus: the control centre');
await settle(page, 200);
h = await hub(page);
const u2 = h.lists.find(l => l.name === 'Made-up Unit 2');
eq(u2.words.map(w => [w.term, w.definition, w.gender, w.tags]), [['mitosis', 'cell division', '', []], ['cell', 'smallest unit', 'f', ['bio']], ['nucleus', 'the control centre', '', []]],
  'an edit reaches the hub and a gender and tag given in the hub survive it');
await page.fill('#listName', 'Renamed unit'); await page.press('#listName', 'Tab'); await settle(page, 200);
await page.fill('#wordInput', 'mitosis: cell division\ncell: smallest unit\nnucleus: the control centre\nrib: bone'); await settle(page, 200);
h = await hub(page);
eq(h.lists.map(l => l.name), ['Made-up Unit 1', 'Renamed unit'], 'a rename goes to the hub and leaves one list, not two');
eq(h.lists[1].words.find(w => w.term === 'cell').gender, 'f', 'and the renamed list keeps its gender');
await page.click('#deleteListBtn'); await settle(page, 200);
h = await hub(page);
eq(h.lists.map(l => l.name), ['Made-up Unit 1'], 'a delete goes to the hub');
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300);
eq((await hub(page)).lists.map(l => l.name), ['Made-up Unit 1'], 'a deleted list does not come back on the next load');
eq((await hub(page)).legacy, ['Made-up Unit 1', 'Made-up Unit 2'], 'the migrated names are remembered');

/* ── 3. a pasted table and a file, reviewed before they are stored ──────── */
console.log('040 — Word Lists: import is shown first');
const before = JSON.stringify(await hub(page));
await page.fill('#hubPaste', 'term\tmeaning\tgender\ncasa\tHOME\tf\nmesa\ttable\tf\n\t\tstray');
await page.fill('#hubPasteName', 'Made-up Unit 1');
await page.click('#hubReadBtn'); await settle(page, 100);
ok(await page.isVisible('#hubReview'), 'the review opens');
const planText = await page.$$eval('#hubReviewList li', els => els.map(e => e.textContent));
ok(/joins the list you have; 1 new, 1 filled in, none changed/.test(planText[0]), 'a same-named list is joined, saying what it adds: ' + planText[0]);
ok(/Line 4 has no term/.test(planText[1] || ''), 'a line with no term is named, with its number: ' + planText[1]);
eq(JSON.stringify(await hub(page)), before, 'reading a table stores nothing');
await page.click('#hubCancelBtn'); await settle(page, 50);
eq(JSON.stringify(await hub(page)), before, 'Cancel stores nothing');
await page.click('#hubReadBtn'); await page.click('#hubConfirmBtn'); await settle(page, 200);
const u1 = (await hub(page)).lists[0];
eq(u1.words.map(w => [w.term, w.definition, w.gender]), [['casa', 'house', 'f'], ['perro', 'dog', ''], ['luz', 'light', ''], ['mesa', 'table', 'f']], 'Add joins by term: a filled definition is not changed, an empty gender is filled, a new word is added');
ok((await page.inputValue('#wordInput')).includes('mesa: table'), 'the open list on the page shows the added word');
const csvFile = path.join(tmp, 'Made-up deck.csv'); fs.writeFileSync(csvFile, 'word,translation\nuno,one\ndos,two\n');
await page.fill('#hubPasteName', 'Numbers');
await page.setInputFiles('#hubFile', csvFile); await settle(page, 200);
ok(await page.isVisible('#hubReview'), 'a CSV file opens the review');
await page.click('#hubConfirmBtn'); await settle(page, 200);
ok(await page.isVisible('#hubReview') === false, 'Add closes the review');
const jsonFile = path.join(tmp, 'lists.json'); fs.writeFileSync(jsonFile, JSON.stringify({ app: 'word-lists', v: 1, lists: [{ name: 'From a file', words: [{ term: 'sol', definition: 'sun', audio: 'keep-me' }] }] }));
await page.setInputFiles('#hubFile', jsonFile); await settle(page, 200); await page.click('#hubConfirmBtn'); await settle(page, 200);
h = await hub(page);
ok(h.lists.some(l => l.name === 'From a file' && l.words[0].audio === 'keep-me'), 'a JSON file adds its list and keeps a field the page does not know');
ok((await page.$$eval('#listSwitch option', o => o.map(x => x.value))).includes('From a file'), 'an added list is a list on the page too');
await page.setInputFiles('#hubFile', path.join(tmp, 'lists.json')); fs.writeFileSync(path.join(tmp, 'bad.json'), '{"nope":1}');
await page.click('#hubCancelBtn');
await page.setInputFiles('#hubFile', path.join(tmp, 'bad.json')); await settle(page, 200);
ok(/not a word-lists file/.test(await page.textContent('#hubStatus')), 'a file that is not a word-lists file is refused in words');

/* ── 4. downloads ───────────────────────────────────────────────────────── */
console.log('040 — Word Lists: downloads');
const json = JSON.parse(await downloadText(page, '#hubJsonBtn'));
eq([json.app, json.v, json.lists.map(l => l.name)], ['word-lists', 1, ['Made-up Unit 1', 'Numbers', 'From a file']], 'all lists download as JSON');
const csv = await downloadText(page, '#hubCsvBtn');
ok(csv.replace(/^\uFEFF/, '').startsWith('term,definition,example,pronunciation,partOfSpeech,gender,tags') && csv.includes('mesa,table'), 'this list downloads as CSV');
const back = await page.evaluate(t => WordList.parseTable(t).words.map(w => [w.term, w.definition, w.gender]), csv);
eq(back, [['casa', 'house', 'f'], ['perro', 'dog', ''], ['luz', 'light', ''], ['mesa', 'table', 'f']], 'the CSV reads back to the same words');
ok((await downloadText(page, '#hubTemplateBtn')).includes('la biblioteca'), 'the template downloads');

/* ── 5. axe, errors ─────────────────────────────────────────────────────── */
console.log('040 — Word Lists: accessible');
await page.fill('#hubPaste', 'a\tb'); await page.click('#hubReadBtn'); await settle(page, 100);
const scan = await a11yScan(page, { include: ['#hubCard'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the Word Lists card, with the review open, is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

fs.rmSync(tmp, { recursive: true, force: true });
await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
