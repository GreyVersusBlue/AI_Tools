// smoke-received-questions.mjs — the Review Game Board takes questions from a
// link (Path 6 P4, 053 to 030), so text nobody at this keyboard typed reaches
// the page. Two things are held still here.
//
//   node Tools/review-game-board/test/smoke-received-questions.mjs   (port 8503)
//
//   A. EVERY PLACE THE PAGE SHOWS TEXT SHOWS IT AS TEXT. A board, a team and
//      a bank question whose every field is markup (an <img onerror>, a
//      javascript: link, a quote that would close an attribute) are put
//      through each sink: the board, a clue's overlay, the Daily Double
//      banner and its wager list, both printed sheets, the editor's rows, the
//      bank list, its filters and the category suggestions. Nothing runs,
//      no element is made, and the text reads back character for character.
//      That includes a clue's POINTS and a team's SCORE held as text, which
//      the page wrote unescaped until v269 (a board is stored as it was
//      saved, and a restored backup is not this page's typing either).
//   B. THE ARRIVAL. A link's questions are shown and nothing is stored; "Don't
//      add" stores nothing; "Add" stores the new ones with ids the bank made,
//      leaves the question whose id the link named alone, and skips what the
//      bank has; the same link again adds nothing; a reload does not ask
//      again; a link that cannot be read, or carries nothing, says so; a page
//      opened with no link, or another parameter, is as it was.
// The link's reader is QuestionBank.fromLink(), pinned in pure Node by
// Tools/question-bank/test/question-bank.test.mjs; the sender's half is
// Tools/share/test/smoke-send-to.mjs. Every name and question here is made
// up. Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8503;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const KEY = 'gvb-question-bank';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* One text that is hostile in element content, in a quoted attribute and as a
   link, with a tag to tell the fields apart. */
const X = tag => `${tag}"'><img src=x onerror="window.__pwned=(window.__pwned||0)+1"><a href="javascript:window.__pwned=99">go</a>&amp;`;

/* A tag is cut at 60 characters by the link's reader, so its hostile text is short. */
const XT = '"><img src=x onerror=window.__pwned=7>';

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
page.on('dialog', d => d.accept());

/** What must be true wherever the page is: nothing ran, and no element came
    out of a text. `where` is a selector to look under. */
async function inert(where, label) {
  const got = await page.evaluate(sel => {
    const roots = Array.from(document.querySelectorAll(sel));
    const made = roots.reduce((n, r) => n + r.querySelectorAll('img[src="x"], a[href^="javascript"], [onerror]').length, 0);
    return { pwned: window.__pwned === undefined ? null : window.__pwned, made, roots: roots.length };
  }, where);
  ok(got.roots > 0, `${label}: ${where} is on the page`);
  eq([got.pwned, got.made], [null, 0], `${label}: nothing ran and no element was made from a text`);
}

console.log('Review Game Board — a hostile board and bank, through every sink');

const BOARD = {
  name: X('board'),
  categories: [{ name: X('cat'), clues: [
    { points: 100, question: X('q1'), answer: X('a1'), used: false, dailyDouble: false },
    { points: X('pts'), question: X('q2'), answer: X('a2'), used: false, dailyDouble: true },
  ] }],
  teams: [{ name: X('team'), score: X('score') }, { name: 'Team 2', score: 0 }],
  dailyDoubleEnabled: true, lightningRoundEnabled: false, lightningRoundSeconds: 15,
};
const BANK = [
  { id: 'q-victim', prompt: X('bq'), answer: X('ba'), unit: X('unit'), standard: X('std'), difficulty: 'Hard', points: 300, tags: [X('tag')], choices: [X('choice')] },
  { id: 'q-plain', prompt: 'Capital of Peru?', answer: 'Lima', unit: 'Unit 1', standard: '', difficulty: '', points: 100 },
];

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await page.evaluate(({ BOARD, BANK }) => {
  localStorage.clear();
  window.ReviewBoardStore.saveBoard('Hostile', BOARD);
  window.QuestionBank.importQuestions(BANK);
}, { BOARD, BANK });
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });

/* the board */
eq(await page.$eval('#boardCols .cat-header', n => n.textContent), X('cat'), 'the category header is the name as text');
eq(await page.$$eval('#boardCols button.cell', bs => bs.map(b => b.textContent)), ['100', X('pts')], 'a cell shows its points as text, markup and all');
eq(await page.$$eval('#scoreboard .team-chip .score', ns => ns.map(n => n.textContent)), [X('score'), '0'], 'and a score');
await inert('#boardCard', 'the board');

/* an ordinary clue's overlay */
await page.click('#boardCols button.cell >> nth=0');
await settle(page, 200);
eq(await page.$eval('#overlayCatPoints', n => n.textContent), X('cat') + ' — 100', 'the overlay heading is the category as typed (it showed &amp;lt; for < before v269)');
eq(await page.$eval('#overlayQuestion', n => n.textContent), X('q1'), 'the question is text');
eq(await page.$eval('#overlayAnswer', n => n.textContent), X('a1'), 'and so is the answer waiting behind it');
await inert('#overlay', 'the clue overlay');
await page.click('#closeNoAskBtn');
await settle(page, 150);

/* the Daily Double: banner, wager list, the wager line */
await page.click('#boardCols button.cell >> nth=1');
await settle(page, 200);
eq(await page.$eval('#overlayCatPoints', n => [n.textContent, n.querySelectorAll('br').length, n.children.length]),
  ['🌟 DAILY DOUBLE! 🌟' + X('cat'), 1, 1], 'the Daily Double banner is the banner, a line break and the category as text');
eq(await page.$$eval('#wagerTeamSelect option', os => os.map(o => [o.value, o.textContent])),
  [['0', X('team') + ' (score: ' + X('score') + ')'], ['1', 'Team 2 (score: 0)']], 'the wager list names each team and score as text');
await inert('#overlay', 'the wager panel');
await page.fill('#wagerAmount', '50');
await page.click('#wagerStartBtn');
await settle(page, 150);
eq(await page.$eval('#overlayCatPoints', n => [n.textContent, n.children.length]), ['🌟 DAILY DOUBLE! 🌟' + X('team') + ' wagers 50', 1], 'the wager line names the team as text');
await inert('#overlay', 'the wager line');
await page.click('#closeNoAskBtn');
await settle(page, 150);

/* the two printed sheets */
await page.click('#printAnswerKeyBtn');
await page.waitForFunction(() => window.__printed === 1, null, { timeout: 5000 });
eq(await page.$eval('#printArea', n => [n.querySelector('h2').textContent, Array.from(n.querySelectorAll('tbody tr')).map(tr => Array.from(tr.children).map(td => td.textContent))]),
  [X('board') + ' — Answer Key', [[X('cat'), '100', X('q1'), X('a1')], [X('cat'), '★ ' + X('pts'), X('q2'), X('a2')]]],
  'the answer key is the board as text, the points too');
await inert('#printArea', 'the answer key');
await page.click('#printQuizBtn');
await page.waitForFunction(() => window.__printed === 2, null, { timeout: 5000 });
eq(await page.$$eval('#printArea .quiz-q', ps => ps.map(p => p.textContent)),
  ['1. [' + X('cat') + ' — 100 pts] ' + X('q1'), '2. [' + X('cat') + ' — ' + X('pts') + ' pts] ' + X('q2')], 'the practice quiz is the board as text, the points too');
await inert('#printArea', 'the practice quiz');

/* the editor's rows */
await page.click('#editBoardBtn');
await settle(page, 300);
eq(await page.$$eval('#categoriesEditor .clue-row', rows => rows.map(r => [r.querySelector('.clue-question').value, r.querySelector('.clue-answer').value,
  r.querySelector('.clue-points').getAttribute('value'), r.querySelectorAll('.clue-points').length])),
  [[X('q1'), X('a1'), '100', 1], [X('q2'), X('a2'), X('pts'), 1]], 'an editor row holds the question and answer as typed, and points that are markup stay inside the value attribute');
eq(await page.$eval('#categoriesEditor .cat-name-input', n => n.value), X('cat'), 'and the category name');
await inert('#setupCard', 'the editor');

/* the bank: list, filters, the category suggestions */
await page.click('.top-tab-btn[data-top="bank"]');
await settle(page, 250);
eq(await page.$$eval('#bankList .bank-entry', rows => rows.map(r => [r.querySelector('.bank-q').textContent, r.querySelector('.bank-a').textContent,
  Array.from(r.querySelectorAll('.bank-tag')).map(t => t.textContent)])),
  // Since v274 a row shows the question's own tags too, after the four it always showed.
  [[X('bq'), X('ba'), [X('unit'), X('std'), 'Hard', '300 pts', X('tag')]], ['Capital of Peru?', 'Lima', ['Unit 1', '100 pts']]], 'the bank list is every field as text, the question\'s tag among them');
eq(await page.$$eval('#bankFilterUnit option', os => os.map(o => [o.value, o.textContent])), [['', 'All units'], [X('unit'), X('unit')], ['Unit 1', 'Unit 1']].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0]))),
  'the unit filter lists each unit as its own value and label');
eq(await page.$$eval('#bankFilterStandard option', os => os.map(o => [o.value, o.textContent])), [['', 'All standards'], [X('std'), X('std')]], 'and the standard filter');
eq(await page.$$eval('#bankCategoryOptions option', os => os.map(o => [o.value, o.textContent])), [[X('cat'), '']], 'the category suggestions are the editor\'s names as values');
await page.selectOption('#bankFilterUnit', X('unit'));
await settle(page, 150);
eq(await page.$$eval('#bankList .bank-entry .bank-q', ns => ns.map(n => n.textContent)), [X('bq')], 'a filter whose value is markup still filters');
await page.click('#bankClearFiltersBtn');
await settle(page, 150);
await inert('#bankSection', 'the bank tab');

/* pulled into a board, and played */
await page.check('#bankList .bank-entry >> nth=0 >> input[type="checkbox"]');
await page.fill('#bankPullCategory', X('pulled'));
await page.click('#bankPullBtn');
await settle(page, 300);
eq(await page.$$eval('#categoriesEditor .clue-row .clue-question', ns => ns.map(n => n.value)), [X('q1'), X('q2'), X('bq')], 'a pulled question lands in the editor as typed');
await inert('body', 'after a pull');

console.log('\nReview Game Board — questions that arrive by link');

const rawBank = () => page.evaluate(k => localStorage.getItem(k), KEY);
const bank = () => page.evaluate(() => window.QuestionBank.list());
const card = () => page.evaluate(() => {
  const c = document.getElementById('arrivalCard'), add = document.getElementById('arrivalAddBtn'), st = document.getElementById('arrivalStatus');
  const shown = n => !!n && n.getClientRects().length > 0;
  return {
    shown: shown(c), summary: document.getElementById('arrivalSummary').textContent,
    rows: Array.from(document.querySelectorAll('#arrivalList li')).map(li => [li.className, li.querySelector('.bank-q').textContent, li.querySelector('.bank-a').textContent,
      Array.from(li.querySelectorAll('.bank-tag')).map(t => t.textContent)]),
    add: shown(add) ? add.textContent : null, dismiss: document.getElementById('arrivalDismissBtn').textContent,
    status: [st.textContent, st.className], search: location.search,
    tab: document.querySelector('.top-tab-btn.active').dataset.top,
  };
});
const link = payload => page.evaluate(({ payload, base }) => window.StateLink.buildShareUrl('questions', payload, { base }), { payload, base: URL_PAGE });
async function arrive(url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 300);
}

const PAYLOAD = {
  v: 1, from: 'cultural-trivia-card-generator', name: 'Custom trivia',
  questions: [
    { id: 'q-victim', prompt: X('new'), answer: X('ans'), unit: X('u'), tags: [XT, 'plain tag'], choices: [X('c1'), 'B'], media: { src: 'javascript:alert(1)' }, extra: X('extra') },
    { prompt: ' capital of  PERU? ', answer: 'lima', unit: 'Hispanic World' },
    { prompt: 'What is a quinceañera?', answer: 'A 15th birthday', unit: 'Hispanic World', points: 200 },
    { prompt: '', answer: 'no question' },
    { prompt: 'What is a quinceañera?', answer: 'a 15th  birthday' },
  ],
};
const LINK = await link(PAYLOAD);
const before = await rawBank();
const idsBefore = (await bank()).map(q => q.id);

/* 1. shown, nothing stored */
await arrive(LINK);
let c = await card();
eq(c.shown, true, 'opening the link shows the arrival card');
eq(c.summary, '4 questions arrived from the Cultural Trivia Card Generator. 2 are already in your bank and will be skipped. 1 row with no question or no answer was left out. Nothing is added until you press the button.',
  'the card says how many came, from where, how many the bank has, and that nothing is added yet');
eq(c.rows, [
  ['', X('new'), X('ans'), [X('u'), XT, 'plain tag', '2 choices']],
  ['have', 'capital of  PERU?', 'lima', ['Hispanic World', 'already in your bank']],
  ['', 'What is a quinceañera?', 'A 15th birthday', ['Hispanic World', '200 pts']],
  ['have', 'What is a quinceañera?', 'a 15th  birthday', ['already in your bank']],
], 'each question is listed as text with its unit, tags and choices; one the bank has, and one the link repeats, is marked');
eq([c.add, c.dismiss], ['Add 2 questions to my bank', 'Don’t add'], 'the buttons say what they will do');
eq(c.search, '', 'the parameter is gone from the address bar');
eq(await rawBank(), before, 'and the stored bank is byte for byte what it was: nothing is stored on arrival');
await inert('#arrivalCard', 'the arrival card');
const axe = await a11yScan(page, { include: '#arrivalCard' });
eq(axe.map(v => v.id + ' ' + v.nodes.join(' ')), [], 'the arrival card has no serious or critical axe violation');

/* 2. a reload does not ask again */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
c = await card();
eq([c.shown, c.status[0]], [false, ''], 'after a reload the card is not there and nothing is said');
eq(await rawBank(), before, 'and nothing was stored');

/* 3. Don't add */
await arrive(LINK);
await page.click('#arrivalDismissBtn');
await settle(page, 150);
c = await card();
eq([c.shown, c.status, c.rows.length], [false, ['Nothing was added to your bank.', 'import-status'], 0], '"Don’t add" closes the card and says nothing was added');
eq(await rawBank(), before, 'and nothing was');

/* 4. Add */
await arrive(LINK);
await page.click('#arrivalAddBtn');
await settle(page, 250);
c = await card();
eq([c.shown, c.status, c.tab], [false, ['Added 2 questions to your bank; 2 already there. They are in the list below.', 'import-status ok'], 'bank'], '"Add" stores them, says so and opens the bank tab');
let now = await bank();
eq(now.length, 4, 'the bank has two more questions');
eq(now.slice(0, 2).map(q => [q.id, q.prompt, q.answer]), [['q-victim', X('bq'), X('ba')], ['q-plain', 'Capital of Peru?', 'Lima']], 'the question whose id the link named is word for word what it was, and so is the other');
const arrived = now.slice(2);
eq(arrived.map(q => [q.prompt, q.answer, q.unit, q.tags, q.choices || null, q.points, q.sharedFrom]), [
  [X('new'), X('ans'), X('u'), [XT, 'plain tag'], [X('c1'), 'B'], 0, 'cultural-trivia-card-generator'],
  ['What is a quinceañera?', 'A 15th birthday', 'Hispanic World', [], null, 200, 'cultural-trivia-card-generator'],
], 'each arrival is stored in the bank\'s shape, with where it came from');
ok(arrived.every(q => /^q-/.test(q.id) && idsBefore.indexOf(q.id) === -1 && !('media' in q) && !('extra' in q)), 'with an id the bank made, and no media or unknown field from the link');
eq(await page.$$eval('#bankList .bank-entry .bank-q', ns => ns.map(n => n.textContent)), [X('bq'), 'Capital of Peru?', X('new'), 'What is a quinceañera?'], 'and the bank list shows them, as text');
await inert('body', 'after Add');

/* 5. the same link again */
const afterAdd = await rawBank();
await arrive(LINK);
c = await card();
eq([c.shown, c.add, c.dismiss, c.rows.map(r => r[0])], [true, null, 'Close', ['have', 'have', 'have', 'have']], 'the same link again: every question is marked, and there is no Add button');
eq(c.summary, '4 questions arrived from the Cultural Trivia Card Generator. All of them are already in your bank, so there is nothing to add. 1 row with no question or no answer was left out.', 'and the card says there is nothing to add');
await page.click('#arrivalDismissBtn');
await settle(page, 150);
eq(await rawBank(), afterAdd, 'the stored bank is byte for byte what it was after the first Add');
eq((await bank()).map(q => q.id), now.map(q => q.id), 'and no id has moved');

/* 6. links that cannot be used */
await arrive(URL_PAGE + '?questions=not-a-link');
c = await card();
eq([c.shown, c.status, c.search], [false, ['That shared link could not be read — it may have been cut short when it was copied or emailed.', 'import-status error'], ''], 'a link cut short is refused in the share helper\'s words');
await arrive(LINK.slice(0, LINK.length - 40));
eq((await card()).status[1], 'import-status error', 'and so is the real link with its end missing');
await arrive(await link({ questions: [{ prompt: '', answer: 'x' }, null] }));
eq([(await card()).shown, (await card()).status], [false, ['That link carried no questions.', 'import-status error']], 'a link with no usable question says so');
await arrive(await link({ name: 'not questions', words: 'a: b' }));
eq((await card()).status[1], 'import-status error', 'another tool\'s payload under this parameter is refused');
await arrive(await link({ from: X('from'), questions: [{ prompt: 'From nowhere?', answer: 'Yes' }] }));
c = await card();
eq(c.summary, '1 question arrived from a shared link. Nothing is added until you press the button.', 'a sender the page does not know is "a shared link", never the link\'s own text');
await page.click('#arrivalDismissBtn');
await arrive(await link({ from: 'some-other-tool', questions: [{ prompt: 'From a tool this page has not heard of?', answer: 'Yes' }] }));
eq((await card()).summary, '1 question arrived from a shared link. Nothing is added until you press the button.', 'and so is a slug the page has no name for');
await page.click('#arrivalDismissBtn');
eq(await rawBank(), afterAdd, 'none of those stored anything');

/* 7. a page opened as before */
for (const tail of ['', '?trivia=' + LINK.split('questions=')[1], '?utm=1']) {
  await arrive(URL_PAGE + tail);
  c = await card();
  eq([c.shown, c.status[0], c.tab], [false, '', 'boards'], 'no card and no message for ' + JSON.stringify(tail.slice(0, 12) || 'no parameter'));
}
eq(await page.$eval('#boardTitle', n => n.textContent.indexOf('board') === 0), true, 'and the open board is still the open board');

/* 8. as long a list as the sender will send: 40 questions in one link.
   (_shared/handoffs.js refuses a link past 7,500 characters; a 150-question
   link, about 17,000, was refused by this suite's own server.) */
const many = { v: 1, from: 'cultural-trivia-card-generator', questions: Array.from({ length: 40 }, (_, i) => ({ prompt: 'Made-up question number ' + (i + 1) + '?', answer: 'Answer ' + (i + 1), unit: 'Global Culture' })) };
const manyLink = await link(many);
ok(manyLink.length > 4000 && manyLink.length < 7500, `a 40-question link is ${manyLink.length} characters, under the sender's bound`);
await arrive(manyLink);
c = await card();
eq([c.rows.length, c.add], [40, 'Add 40 questions to my bank'], 'and arrives whole');
await page.click('#arrivalAddBtn');
await settle(page, 300);
eq((await bank()).length, 44, 'and Add stores all 40');

/* ── no console noise, nothing left the site ────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
