// smoke-bank.mjs — Path 12 P2, increment 2: 040's flashcards and the site's
// question bank, both ways, and the tool itself working exactly as it did.
//
//   node Tools/vocab-flashcard-generator/test/smoke-bank.mjs        (port 8506)
//
// What's worth holding still:
//   1. a list saved before v271 loads, shows, prints and is saved again as it
//      was: what is in storage after a load, the preview and the printed sheet
//      of every mode, and what a share link from before opens, are compared,
//      to the byte, with hashes taken from the page as it was at v270;
//   2. opening 040 writes nothing about the bank: not its key, and not the
//      move of 030's old bank either, which waits for a press;
//   3. bank to 040: the chooser lists the teacher's bank and the seed sets,
//      a ticked question becomes a card with the question on the front and
//      the answer on the back, a question that cannot be a card is shown
//      with the reason and cannot be ticked, and nothing reaches the bank;
//   4. 040 to bank: Send shows what would be stored and stores nothing; Add
//      stores it; the same list sent again adds nothing; a changed definition
//      changes that one question where it stands;
//   5. the round trip: cards made from bank questions, sent back, add nothing;
//   6. text from the bank is text on this page, never markup;
//   7. the new card is clean under axe.
// The mapping itself, field by field, and the ids are in
// printables-logic.test.mjs's neighbour, bank-logic.test.mjs (pure Node).
// Every word, list and question here is made up.
//
// The pins in section 1 were made by running this file with --print against
// the v270 page (SEED_040 names another page file to open). A deliberate
// change to what the tool shows or prints needs them made again.
// Exits 1 on any failure.

import crypto from 'node:crypto';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8506;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_040 = BASE + '/Tools/' + (process.env.SEED_040 || '040-vocab-flashcard-generator.html');
const URL_030 = BASE + '/Tools/030-review-game-board.html';
const KEY = 'gvb-question-bank';
const OLD_KEY = 'gvb-review-board-bank:entries';
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
   so a shuffled sheet is the same sheet every run. `storage` is put in once,
   before the page's first script. */
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
const stored = page => page.evaluate(() => {
  const out = {};
  Object.keys(localStorage).filter(k => !/^gvb-a11y|^__/.test(k)).sort().forEach(k => { out[k] = localStorage.getItem(k); });
  return out;
});

/* ── 1. the tool as it was ──────────────────────────────────────────────── */
console.log('040 — a list from before loads, shows and prints as it did');

const WORDS = [
  'Photosynthesis: process plants use to make food | Plants use photosynthesis to grow | FOH-toh-SIN-thuh-sis | noun',
  'Mitosis: cell division',
  'Écosystème: a community of living things & their <b>surroundings</b>',
  'Made-up term\ta made-up definition, with a comma\tAn example\t\tverb',
  'Osmosis,"water moving, slowly, across a membrane"',
  'Chlorophyll: the green pigment in a leaf',
  'Stomata: small openings on a leaf | | STOH-muh-tuh',
  'Xylem: tubes that carry water up a stem',
  'Phloem: tubes that carry sugar round a plant',
  'a line with nothing to split on',
  'Cell: the smallest living unit',
].join('\n');
// A list as the page stores one now, and one as it stored them before the
// later fields (card size, layout, sort, guides, bingo) existed.
const LIST_NOW = {
  name: 'Made-up Unit 4', words: WORDS, mode: 'flashcards', flashCols: 2, flashRows: 3,
  cardSizePreset: 'grid', flashLayout: 'duplex', wallPerPage: 4, wallShowDef: true,
  sortOrder: 'za', shuffle: false, showGuides: true, bingoCount: 3, bingoField: 'definition',
};
const LIST_OLD = { name: 'Older list', words: 'Alpha: first\nBeta: second\nGamma: third', mode: 'wordwall', flashCols: 3, flashRows: 3, wallPerPage: 2, wallShowDef: false };
const STATE_040 = {
  'gvb-vocab-flashcards:list': JSON.stringify(['Made-up Unit 4', 'Older list']),
  'gvb-vocab-flashcards:data:Made-up Unit 4': JSON.stringify(LIST_NOW),
  'gvb-vocab-flashcards:data:Older list': JSON.stringify(LIST_OLD),
  'gvb-vocab-flashcards:current': 'Made-up Unit 4',
};
// A share link as the v270 page wrote one: the fifteen fields of its
// buildSharePayload(), as JSON, in base64 (state-link.js's encodeState).
const OLD_DECK = {
  v: 1, name: 'Three words', words: 'Uno: one | Tengo uno | OO-noh | number\nDos: two\nTrès: very', mode: 'flashcards',
  flashCols: 2, flashRows: 2, cardSizePreset: '4x6', flashLayout: 'fold', wallPerPage: 2, wallShowDef: true,
  sortOrder: 'az', shuffle: false, showGuides: false, bingoCount: 4, bingoField: 'term',
};
const OLD_LINK = '?deck=' + encodeURIComponent(Buffer.from(JSON.stringify(OLD_DECK), 'utf8').toString('base64'));

async function capture040(storage, search, tour) {
  const page = await fixedPage(storage);
  await page.goto(URL_040 + (search || ''), { waitUntil: 'networkidle' });
  await settle(page, 400);
  const out = {};
  out.loaded = JSON.stringify(await stored(page));
  out.note = await page.textContent('#shareNote');
  const shown = () => page.evaluate(() => [document.getElementById('previewArea').innerHTML, document.getElementById('previewNote').textContent,
    document.getElementById('printNote').textContent, document.getElementById('sheetView').textContent].join('¦'));
  const printed = async sel => { await page.click(sel); return page.$eval('#printArea', el => el.innerHTML); };
  const views = [], sheets = [];
  const mode = async m => { await page.click(`.mode-tab[data-mode="${m}"]`); await settle(page, 80); };
  views.push(await shown()); sheets.push(await printed('#printBtn'));            // as the list was saved
  if (tour) {                                                              // every mode, then the older list
    await mode('flashcards');
    await page.evaluate(() => Array.from(document.querySelectorAll('#sheetView button')).filter(b => b.textContent === 'Back')[0].click()); views.push(await shown());
    sheets.push(await printed('#alignTestBtn'));
    await page.selectOption('#cardSizePreset', '3x5'); await settle(page, 80); views.push(await shown()); sheets.push(await printed('#printBtn'));
    await page.selectOption('#flashLayout', 'fold'); await settle(page, 80); views.push(await shown()); sheets.push(await printed('#printBtn'));
    await page.selectOption('#cardSizePreset', 'grid'); await page.selectOption('#flashLayout', 'duplex'); await settle(page, 80);
    await mode('wordwall'); views.push(await shown()); sheets.push(await printed('#printBtn'));
    await mode('quiz'); views.push(await shown());
    await page.click('.quiz-card'); views.push(await shown());
    for (const m of ['wordsearch', 'crossword', 'bingo', 'matching']) { await mode(m); views.push(await shown()); sheets.push(await printed('#printBtn')); }
    await page.selectOption('#listSwitch', 'Older list'); await settle(page, 150);
    views.push(await shown()); sheets.push(await printed('#printBtn'));
    await mode('flashcards'); views.push(await shown()); sheets.push(await printed('#printBtn'));
  }
  out.views = views.join('\n⏎\n');
  out.sheets = sheets.join('\n⏎\n');
  out.printed = await page.evaluate(() => window.__printed);
  out.end = JSON.stringify(await stored(page));
  out.payload = await page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { captured = t; return Promise.resolve(); } } });
    document.getElementById('shareBtn').click();
    const b = document.querySelector('.share-sheet button[data-share="copy"]');
    if (b) b.click();
    return new Promise(r => setTimeout(() => r(captured ? JSON.stringify(window.StateLink.decodeState(new URL(captured).searchParams.get('deck'))) : ''), 80));
  });
  out.errs = page.__errs.slice(); out.blocked = page.__blocked.slice();
  out.qbKeys = await page.evaluate(k => Object.keys(localStorage).filter(x => x === k[0] || x === k[1]), [KEY, OLD_KEY]);
  await page.context().close();
  return out;
}

const PINS = {
  seeded: { loaded: '51db3cb48a3be3e4', views: 'ee6c89a08a879300', sheets: '13e6a7e159f6bf9a', end: '8d85b18af1c76e90', payload: '4cf50379ad138153' },
  empty: { loaded: 'd76924e5253b9e06', views: '1ea1b65c737845dd', sheets: 'e3b0c44298fc1c14', end: 'd76924e5253b9e06', payload: 'e3b0c44298fc1c14' },
  link: { loaded: 'c81213dc922902f0', views: 'e15956e6fd5f96e6', sheets: 'c5f9c889c1799b54', end: 'c81213dc922902f0', note: '79f3d1fa3051df82' },
};
const got = {
  seeded: await capture040(STATE_040, '', true),
  empty: await capture040({}),
  // A list is already saved under the name the arrival would take.
  link: await capture040({ 'gvb-vocab-flashcards:list': JSON.stringify(['Three words (shared)']), 'gvb-vocab-flashcards:data:Three words (shared)': JSON.stringify(LIST_OLD), 'gvb-vocab-flashcards:current': 'Three words (shared)' }, OLD_LINK),
};
if (PRINT) {
  const out = {};
  for (const s of Object.keys(PINS)) { out[s] = {}; for (const f of Object.keys(PINS[s])) out[s][f] = sha(got[s][f]); }
  console.log(JSON.stringify(out, null, 2));
  console.log('printed', got.seeded.printed, 'payload', got.seeded.payload.slice(0, 200), 'note', got.link.note, 'errs', JSON.stringify(got.seeded.errs));
  console.log('link stored', got.link.end);
}
for (const s of Object.keys(PINS)) {
  for (const f of Object.keys(PINS[s])) ok(sha(got[s][f]) === PINS[s][f], `${s}: ${f} is byte for byte what the v270 page gave (${sha(got[s][f])})`);
  eq(got[s].errs, [], `${s}: no page or console errors`);
  eq(got[s].blocked, [], `${s}: nothing asked of another site`);
  eq(got[s].qbKeys, [], `${s}: using the tool as before writes neither bank key`);
}
eq(got.seeded.printed, 11, 'every Print button printed once (11 sheets)');
ok(got.seeded.sheets.length > 20000, 'and the sheets are not empty (' + got.seeded.sheets.length + ' characters)');
ok(/saved here as “Three words \(shared\) 2”/.test(got.link.note), 'the old link is saved as a list of its own beside the one with its name: ' + got.link.note);


/* ── 2. opening 040 writes nothing about the bank ───────────────────────── */
console.log('040 — the chooser reads the bank and writes nothing');

const HOSTILE = '<img src=x onerror="window.__xss=1"> & <b>bold</b>';
// 030's bank as its page stored it before v265, never yet moved: the old key.
const OLD_BANK = JSON.stringify([
  { id: 'bank-1', question: 'What is the made-up capital of Madeupia?', answer: 'Madeupville', points: 100, unit: 'Made-up Unit 1', standard: '', difficulty: 'Easy', createdAt: '2026-01-05T10:00:00.000Z' },
  { id: 'bank-2', question: 'Solve: 3x + 4 = 19', answer: 'x = 5', points: 200, unit: 'Made-up Unit 2', standard: '', difficulty: '', createdAt: '2026-01-05T10:01:00.000Z' },
  { id: 'bank-3', question: 'A question of\ntwo lines?', answer: 'Yes', points: 300, unit: 'Made-up Unit 2', standard: '', difficulty: '', createdAt: '2026-01-05T10:02:00.000Z' },
  { id: 'bank-4', question: HOSTILE, answer: HOSTILE + ' answer', points: 400, unit: 'Made-up Unit 1', standard: '', difficulty: 'Hard', createdAt: '2026-01-05T10:03:00.000Z' },
]);
const WITH_BANK = { ...STATE_040, [OLD_KEY]: OLD_BANK };
const bankKeys = page => page.evaluate(k => Object.keys(localStorage).filter(x => x === k[0] || x === k[1]).sort(), [KEY, OLD_KEY]);
const bankOf = page => page.evaluate(k => { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw).data.questions : null; }, KEY);
const listData = (page, name) => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:' + n)), name);

const page = await fixedPage(WITH_BANK);
await page.goto(URL_040, { waitUntil: 'networkidle' });
await settle(page, 400);
ok(await page.isVisible('#bankCard'), 'the Question bank card is on the page');
eq(await bankKeys(page), [OLD_KEY], 'opening the page wrote no bank key: 030\'s old bank is not moved by a page that only reads');
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD_BANK, 'and the old key is byte for byte what it was');
const labels040 = await page.$$eval('#bankSource option', os => os.map(o => o.textContent));
eq(labels040, ['My question bank (4 questions)', 'Cultural Trivia (built in, 30 questions, read-only)', 'Geography Bee (built in, 90 questions, read-only)'],
  'Questions from lists the teacher\'s bank, counted without moving it, and the two seed sets');
{
  const p30 = await fixedPage(WITH_BANK);
  await p30.goto(URL_030, { waitUntil: 'networkidle' });
  await settle(p30, 400);
  await p30.click('.top-tab-btn[data-top="bank"]');
  await settle(p30, 200);
  eq(await p30.$$eval('#bankSource option', os => os.map(o => o.textContent)), labels040, '030\'s chooser says the same, word for word (one sourceLabel())');
  await p30.context().close();
}
eq(await page.$$eval('#bankUnit option', os => os.map(o => o.textContent)), ['All units', 'Made-up Unit 1', 'Made-up Unit 2'], 'Unit lists the bank\'s units');

/* ── 3. bank to 040 ─────────────────────────────────────────────────────── */
console.log('040 — bank questions become cards');
const rows = () => page.$$eval('#bankList .bank-row', rs => rs.map(r => ({
  q: r.querySelector('.bank-q').textContent, a: r.querySelector('.bank-a').textContent,
  why: (r.querySelector('.bank-why') || {}).textContent || '', disabled: r.querySelector('input').disabled, checked: r.querySelector('input').checked,
})));
let list = await rows();
eq(list.map(r => r.q), ['What is the made-up capital of Madeupia?', 'Solve: 3x + 4 = 19', 'A question of\ntwo lines?', HOSTILE], 'every bank question is listed, in the teacher\'s order');
eq(list.map(r => r.disabled), [false, false, true, false], 'the one that cannot be a card cannot be ticked');
eq(list[2].why, 'Cannot be a card. Its question runs over more than one line, and a card is one line of the list.', 'and says why, in words');
eq(await page.textContent('#bankRefused'), '1 question shown here cannot become a card, and it says why. A card is one line of this list, with a front and a back.', 'with a line under the list saying so');
eq(await page.evaluate(() => [document.querySelectorAll('#bankCard img, #bankCard b').length, window.__xss]), [0, null], 'markup in a question is text in the list, not elements, and nothing ran');

await page.click('#bankAddBtn');
eq([await page.textContent('#bankStatus'), await page.inputValue('#wordInput')], ['Tick the questions to add first.', WORDS], 'Add with nothing ticked says so and changes nothing');
await page.check('#bankList .bank-row:nth-child(1) input');
await page.selectOption('#bankSource', '062');
await page.selectOption('#bankSource', '');
eq([(await rows()).some(r => r.checked), await page.textContent('#bankStatus')], [false, ''], 'a tick does not cross from one source to another, and the old message is gone');

await page.selectOption('#bankUnit', 'Made-up Unit 2');
eq((await rows()).map(r => r.q), ['Solve: 3x + 4 = 19', 'A question of\ntwo lines?'], 'a unit narrows the list');
await page.click('#bankAllBtn');
eq((await rows()).map(r => r.checked), [true, false], 'Tick all shown ticks what can be a card and leaves the rest');
await page.selectOption('#bankUnit', '');
await page.check('#bankList .bank-row:nth-child(4) input');
eq((await rows()).map(r => r.checked), [false, true, false, true], 'a tick is kept when the filter changes');
await page.click('#bankAddBtn');
await settle(page, 150);
const EXPECT_WORDS = WORDS + '\nSolve: 3x + 4 = 19\tx = 5\n' + HOSTILE + ': ' + HOSTILE + ' answer';
eq(await page.inputValue('#wordInput'), EXPECT_WORDS, 'the two ticked questions are two more lines of the list, after its own');
eq(await page.textContent('#bankStatus'), 'Added 2 cards to “Made-up Unit 4”: the question on the front, the answer on the back. The bank itself was not changed.', 'and the page says what it did');
eq((await rows()).some(r => r.checked), false, 'the ticks are cleared');
{
  const data = await listData(page, 'Made-up Unit 4');
  eq(data, { ...LIST_NOW, words: EXPECT_WORDS }, 'the saved list is the list it was with those lines added: no new field, nothing else moved');
  eq(await bankKeys(page), [OLD_KEY], 'and still no bank key was written');
}
// the cards, as cards: as entered, the two new ones are last
await page.selectOption('#sortOrder', 'none');
await settle(page, 100);
{
  const cards = await page.evaluate(() => {
    document.getElementById('printBtn').click();
    const pages = Array.from(document.querySelectorAll('#printArea .page'));
    const texts = sel => pages.flatMap(p => Array.from(p.querySelectorAll('.flash-card:not(.blank) ' + sel)).map(n => n.textContent));
    return { terms: texts('.term'), defs: texts('.def'), els: document.querySelectorAll('#printArea img, #printArea b, #previewArea img, #previewArea b').length, xss: window.__xss };
  });
  eq(cards.terms.slice(-2), ['Solve: 3x + 4 = 19', HOSTILE], 'the printed fronts carry the questions, whole, the colon included');
  ok(cards.defs.includes('x = 5') && cards.defs.includes(HOSTILE + ' answer'), 'and the printed backs carry the answers');
  eq([cards.els, cards.xss], [0, null], 'as text: no element was made from a question, on the sheet or in the preview, and nothing ran');
}
await page.selectOption('#sortOrder', 'za');

// a seed set
await page.selectOption('#bankSource', '053');
await settle(page, 100);
list = await rows();
eq([list.length, list.every(r => !r.disabled), list[0].q, list[0].a], [30, true, 'What is the traditional Mexican celebration honoring deceased loved ones called?', 'Día de los Muertos'], 'choosing Cultural Trivia lists its thirty questions, all of which can be cards');
eq(await page.textContent('#bankSourceNote'), 'These come with 053 Cultural Trivia Card Generator and are read-only. Hispanic, Francophone and global culture.', 'with a note saying whose they are');
eq(await page.isHidden('#bankRefused'), true, 'and no refusal line');
await page.selectOption('#bankUnit', 'Francophone World');
const french = await rows();
await page.click('#bankAllBtn');
await page.click('#bankAddBtn');
await settle(page, 150);
{
  const words = await page.inputValue('#wordInput');
  const added = words.slice(EXPECT_WORDS.length + 1).split('\n');
  eq(added.length, french.length, `every Francophone question (${french.length}) is a line of the list`);
  const parsed = await page.evaluate(w => window.VocabLayout.parseWordList(w).map(c => [c.term, c.definition]), added.join('\n'));
  eq(parsed, french.map(r => [r.q, r.a]), 'each read back by the page as that question on the front and that answer on the back');
  eq(await bankKeys(page), [OLD_KEY], 'cards from a seed set store nothing in the bank either');
}
const WORDS_3 = await page.inputValue('#wordInput');

/* ── 4. 040 to bank ─────────────────────────────────────────────────────── */
console.log('040 — a list is sent to the bank, after a look');
const N_FRENCH = french.length;
// The list: 10 cards of its own, all with a definition; 2 made from bank
// questions; N made from the seed set, which the bank does not hold.
await page.click('#bankSendBtn');
ok(await page.isVisible('#bankReview'), 'Send shows a review');
const review1 = await page.textContent('#bankReviewText');
eq(review1, `“Made-up Unit 4” has ${12 + N_FRENCH} cards. Sending it would add ${10 + N_FRENCH} questions to your question bank: the term as the question, the definition as the answer, and “Made-up Unit 4” as the unit. 2 cards are already there and would be left alone. Nothing is stored until you press the button below.`, 'saying what would be added and what is there already');
eq(await page.textContent('#bankConfirmBtn'), `Add ${10 + N_FRENCH} questions to the bank`, 'the button says the number');
eq(await page.$$eval('#bankReviewList li', ls => [ls.length, ls[0].textContent, ls[ls.length - 1].textContent]), [9, 'Photosynthesis — process plants use to make food', `and ${10 + N_FRENCH - 8} more`], 'the first eight are listed and the rest counted');
eq(await bankKeys(page), [OLD_KEY], 'and nothing is stored by looking');
await page.click('#bankCancelBtn');
eq([await page.isHidden('#bankReview'), await bankKeys(page)], [true, [OLD_KEY]], 'Cancel closes the review and stores nothing');

// a review that has gone stale is not stored
await page.click('#bankSendBtn');
await page.fill('#wordInput', WORDS_3 + '\nLate: added after the review');
await page.dispatchEvent('#wordInput', 'input');
await page.click('#bankConfirmBtn');
eq([await page.textContent('#bankSendStatus'), await bankKeys(page)], ['The list changed after that was worked out, so nothing was added. Press Send again.', [OLD_KEY]], 'a list edited after the review is not sent: what is stored is what was shown');
await page.fill('#wordInput', WORDS_3);
await page.dispatchEvent('#wordInput', 'input');

await page.click('#bankSendBtn');
await page.click('#bankConfirmBtn');
await settle(page, 150);
eq(await page.textContent('#bankSendStatus'), `Added ${10 + N_FRENCH} questions to your question bank. They are on Quiz / Review Game Board under the unit “Made-up Unit 4”.`, 'Add stores them and says so');
eq(await bankKeys(page), [KEY, OLD_KEY].sort(), 'the bank\'s key is written now, on that press');
eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD_BANK, 'the old key is still byte for byte what it was');
let bank = await bankOf(page);
eq([bank.length, bank.slice(0, 4).map(q => q.id)], [4 + 10 + N_FRENCH, ['bank-1', 'bank-2', 'bank-3', 'bank-4']], 'the bank is the teacher\'s four, moved over first, and the new ones after them');
{
  const mine = bank.slice(4);
  eq([mine.every(q => /^vfg-/.test(q.id)), mine.every(q => q.unit === 'Made-up Unit 4'), mine.every(q => q.sharedFrom === 'vocab-flashcard-generator'), new Set(mine.map(q => q.id)).size],
    [true, true, true, mine.length], 'each new question has an id made from the list and its term, the list as its unit, and says where it came from');
  eq([mine[0].prompt, mine[0].answer, mine[0].example, mine[0].pronunciation, mine[0].partOfSpeech], ['Photosynthesis', 'process plants use to make food', 'Plants use photosynthesis to grow', 'FOH-toh-SIN-thuh-sis', 'noun'], 'a card\'s five fields are all in its question');
  eq(mine.filter(q => q.prompt === 'Solve: 3x + 4 = 19' || q.prompt === HOSTILE).length, 0, 'the two cards made from bank questions were not added again');
  eq(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).v, KEY), 1, 'the bank\'s version is 1');
}
eq((await page.$$eval('#bankSource option', os => os.map(o => o.textContent)))[0], `My question bank (${14 + N_FRENCH} questions)`, 'the chooser counts the bank as it is now');

// the same list again
const snapshot = await page.evaluate(k => localStorage.getItem(k), KEY);
await page.click('#bankSendBtn');
eq(await page.textContent('#bankReviewText'), `“Made-up Unit 4” has ${12 + N_FRENCH} cards. Every card with a definition is already in your question bank, so there is nothing to add.`, 'sending the same list again: the review says there is nothing to add');
eq([await page.isHidden('#bankConfirmBtn'), await page.textContent('#bankCancelBtn')], [true, 'Close'], 'and offers no Add button');
await page.click('#bankCancelBtn');
eq(await page.evaluate(k => localStorage.getItem(k), KEY) === snapshot, true, 'the bank is byte for byte what it was');

// a definition changed, a term added, a card with no definition
await page.fill('#wordInput', WORDS_3.replace('Mitosis: cell division', 'Mitosis: one cell dividing into two') + '\nMade-up new term: a new definition\nNo definition:');
await page.dispatchEvent('#wordInput', 'input');
await page.click('#bankSendBtn');
eq(await page.textContent('#bankReviewText'), `“Made-up Unit 4” has ${14 + N_FRENCH} cards. Sending it would add 1 question to your question bank: the term as the question, the definition as the answer, and “Made-up Unit 4” as the unit. 1 question sent from this list before would be changed to the wording here. ${11 + N_FRENCH} cards are already there and would be left alone. 1 card with no definition would not be sent. Nothing is stored until you press the button below.`, 'an edited list: one new, one changed, one not a question, each said');
eq(await page.$$eval('#bankReviewList li', ls => ls.map(l => l.textContent)), ['Made-up new term — a new definition', 'Mitosis — one cell dividing into two (changes the bank’s copy)', 'No definition (not sent: no definition)'], 'and listed');
eq(await page.textContent('#bankConfirmBtn'), 'Add 1 and change 1 in the bank', 'the button says both');
const idsBefore = bank.map(q => q.id);
await page.click('#bankConfirmBtn');
await settle(page, 150);
eq(await page.textContent('#bankSendStatus'), 'Added 1 question to your question bank and changed 1. They are on Quiz / Review Game Board under the unit “Made-up Unit 4”.', 'Add says both');
bank = await bankOf(page);
{
  const at = bank.findIndex(q => q.prompt === 'Mitosis');
  eq([bank.length, bank.slice(0, -1).map(q => q.id), bank[at].answer, bank[bank.length - 1].prompt], [idsBefore.length + 1, idsBefore, 'one cell dividing into two', 'Made-up new term'], 'the changed question changed where it stood, under its id, and the new one is last');
}

/* ── 5. the round trip, and 030 ─────────────────────────────────────────── */
console.log('040 — the round trip');
await page.selectOption('#bankSource', '');
await page.selectOption('#bankUnit', 'Made-up Unit 4');
await settle(page, 100);
{
  const mine = await rows();
  eq([mine.length, mine.every(r => !r.disabled)], [11 + N_FRENCH, true], 'the list\'s own questions are in the chooser under its unit, every one a card');
  await page.evaluate(() => { window.prompt = () => 'Round trip'; document.getElementById('newListBtn').click(); });
  await settle(page, 150);
  eq([await page.inputValue('#listName'), await page.inputValue('#wordInput')], ['Round trip', ''], 'a new, empty list');
  await page.click('#bankAllBtn');
  await page.click('#bankAddBtn');
  await settle(page, 150);
  const back = await page.evaluate(() => window.VocabLayout.parseWordList(document.getElementById('wordInput').value));
  const sent = await page.evaluate(() => window.VocabLayout.parseWordList(JSON.parse(localStorage.getItem('gvb-vocab-flashcards:data:Made-up Unit 4')).words).filter(c => c.definition));
  const key = c => c.term + '¦' + c.definition + '¦' + c.example + '¦' + c.pronunciation + '¦' + c.partOfSpeech;
  const want = sent.filter(c => c.term !== 'Solve: 3x + 4 = 19' && c.term !== HOSTILE).map(key);
  ok(back.length > 20 && JSON.stringify(back.map(key).sort()) === JSON.stringify(want.sort()), 'cards sent to the bank come back out of it as the cards they were, all five fields');
  const before = await page.evaluate(k => localStorage.getItem(k), KEY);
  await page.click('#bankSendBtn');
  ok(/Every card with a definition is already in your question bank/.test(await page.textContent('#bankReviewText')), 'and sent to the bank again, from a list of another name, they add nothing');
  await page.click('#bankCancelBtn');
  eq(await page.evaluate(k => localStorage.getItem(k), KEY) === before, true, 'the bank is byte for byte what it was');
}
{
  const p30 = await prepPage(browser, BASE, { width: 1300, height: 1000 });
  const all = await stored(page);
  await p30.addInitScript(storage => { for (const k of Object.keys(storage)) localStorage.setItem(k, storage[k]); }, all);
  await p30.goto(URL_030, { waitUntil: 'networkidle' });
  await settle(p30, 400);
  const seen = await p30.evaluate(() => window.QuestionBank.list().map(q => q.id));
  eq(seen, bank.map(q => q.id), '030 reads the bank 040 wrote: the same questions, the same ids, the same order');
  eq(await p30.evaluate(() => window.ReviewBankStore.filterEntries({ unit: 'Made-up Unit 4' }, '').length), 11 + N_FRENCH, 'and filters the list\'s questions by its unit');
  eq(p30.__errs, [], '030 has no page or console errors');
  await p30.context().close();
}

// the bank changed in another tab (030 is where it is edited)
await page.evaluate(k => {
  const env = JSON.parse(localStorage.getItem(k));
  env.data.questions = env.data.questions.slice(0, 3);
  localStorage.setItem(k, JSON.stringify(env));
  window.dispatchEvent(new StorageEvent('storage', { key: k }));
}, KEY);
eq((await page.$$eval('#bankSource option', os => os.map(o => o.textContent)))[0], 'My question bank (3 questions)', 'a change to the bank from another tab is shown here without a reload');

/* ── 6 and 7. as text, and clean under axe ──────────────────────────────── */
console.log('040 — as text, and accessible');
eq(await page.evaluate(() => [document.querySelectorAll('#bankCard img, #bankCard b, #previewArea img, #previewArea b, #printArea img, #printArea b').length, window.__xss]), [0, null], 'after all of that no element was made from a question, and nothing ran');
await page.selectOption('#bankSource', '');
await page.selectOption('#bankUnit', '');
await page.click('#bankSendBtn');
await settle(page, 100);
const scan = await a11yScan(page, { include: ['#bankCard'] });
eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the Question bank card, with a refused row and the review open, is clean under axe');
eq(page.__errs, [], 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked, [], 'nothing asked of another site');

await browser.close();
await server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
