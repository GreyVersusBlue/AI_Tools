// smoke-academic.mjs — Path 12 P2, increment 4: 020's academic-tournament
// mode (matches decided by questions from the site's question bank), and the
// tool itself working exactly as it did for a bracket that does not use it.
//
//   node Tools/bracket-tournament-generator/test/smoke-academic.mjs   (port 8512)
//
// What's worth holding still:
//   1. a bracket saved before v277, of each of the five types, loads, shows,
//      prints blank, shares and takes a pick as it did: compared, to the
//      byte, with hashes taken from the page as it was at v276;
//   2. opening 020 writes nothing about the bank: not its key, and not the
//      move of 030's old bank either;
//   3. the mode is off until the teacher turns it on, and then: the chooser
//      is the module's (030's and 040's wording), a match shows its questions
//      with the answer hidden until revealed, marks are kept, the winner
//      follows from the score when every question is marked, a tie decides
//      nothing, and a name can still be picked by hand;
//   4. the same bracket shows the same questions after a reload, no question
//      is asked twice until the source runs out, and the page says so when
//      it does;
//   5. the printed match sheet: questions for the reader, the answers on a
//      page of their own, more than one page when there is that much;
//   6. text from the bank is text on this page and on the sheet, never markup;
//   7. a share link carries the mode, and a link's copy of it is cleaned;
//   8. the new controls are clean under axe.
// The dealing, the score and the cleaning are in smoke-academic-core.mjs
// (pure Node). Every team, bracket and question here is made up.
//
// The pins in section 1, and the brackets they are taken over, are in
// golden-old-brackets.json, written by running this file with --print
// against the v276 page (SEED_020 names another page file to open). A
// deliberate change to what the tool shows or stores needs them made again.
// Exits 1 on any failure.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8512;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_020 = BASE + '/Tools/' + (process.env.SEED_020 || '020-bracket-tournament-generator.html');
const KEY = 'gvb-question-bank';
const OLD_KEY = 'gvb-review-board-bank:entries';
const PRINT = process.argv.includes('--print');
const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden-old-brackets.json');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 16);

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const errors = [];

/* A page whose Math.random is a fixed sequence and whose print() only notes
   what was on the page, so a shuffled bracket is the same bracket every run.
   `storage` is put in once, before the page's first script. */
async function fixedPage(storage = {}, size = { width: 1300, height: 1000 }) {
  const page = await prepPage(browser, BASE, size);
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(({ storage }) => {
    let a = 12345;
    Math.random = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x80000000; };
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
      window.__printedCard = document.getElementById('bracketCard').innerHTML;
      var sheet = document.getElementById('matchSheet');
      window.__printedSheet = sheet ? sheet.innerHTML : null;
      window.__printedClass = document.body.className;
    };
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
const open = async (page, url = URL_020) => { await page.goto(url, { waitUntil: 'load' }); await settle(page, 400); };
const shareLink = async page => {
  await page.click('#shareBtn');
  await settle(page, 250);
  return page.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 80));
  });
};

/* ── 1. the tool as it was ──────────────────────────────────────────────── */
console.log('020 — brackets from before load, show, print, share and play as they did');

const TEAMS = ['Cartographers', 'Navigators', 'Astronomers', 'Chroniclers', 'Surveyors', 'Tide & <b>Table</b>'];
const TYPES = [
  { type: 'single', name: 'Old single', seed: 'ranked' },
  { type: 'double', name: 'Old double', seed: 'asEntered' },
  { type: 'roundrobin', name: 'Old round robin', seed: 'ranked' },
  { type: 'pools', name: 'Old pools', seed: 'random' },
  { type: 'swiss', name: 'Old swiss', seed: 'asEntered' },
];

/* Builds the five brackets on the page that is open, with a pick, a score
   and (where the type takes one) a schedule each. Used once, with --print,
   on the page from before; its storage is the golden file's. */
async function buildOld(page) {
  for (const t of TYPES) {
    if (await page.isVisible('#newBracketBtn')) { await page.click('#newBracketBtn'); await settle(page, 150); }
    await page.fill('#bracketName', t.name);
    await page.fill('#contestants', TEAMS.join('\n'));
    await page.selectOption('#bracketType', t.type);
    await page.selectOption('#seedMode', t.seed);
    await page.click('#generateBtn');
    await settle(page, 300);
    const live = '#bracketView .slot:not(.slot-bye):not(.slot-empty):not(.slot-decided)';
    await page.click(live);                                   // one pick by name
    await settle(page, 150);
    const boxes = page.locator('#bracketView .match-score');
    const n = await boxes.count();
    if (n >= 4) {                                             // one score, on a later match
      await boxes.nth(n - 2).fill('21');
      await boxes.nth(n - 2).dispatchEvent('change');
      await settle(page, 150);
    }
    if (t.type === 'single' || t.type === 'roundrobin') {
      await page.click('#scheduleBtn');
      await page.fill('#scheduleStations', '2');
      await page.fill('#scheduleStart', '09:30');
      await page.fill('#scheduleDuration', '12');
      await page.click('#scheduleApplyBtn');
      await settle(page, 150);
    }
  }
}

/* What a bracket from before is held to, one line a thing. */
async function pinsOf(storage) {
  const pins = {};
  const page = await fixedPage(storage);
  await open(page);
  pins['storage after the page opens'] = sha(JSON.stringify(await stored(page)));
  for (const t of TYPES) {
    await page.selectOption('#bracketSwitch', t.name);
    await settle(page, 250);
    pins[t.name + ': the bracket card'] = sha(await page.evaluate(() => document.getElementById('bracketCard').innerHTML));
    pins[t.name + ': the champion banner'] = sha(await page.evaluate(() => { const b = document.getElementById('championBanner'); return b.className + '|' + b.textContent; }));
    await page.check('#printBlank');
    await page.click('#printBtn');
    await settle(page, 150);
    pins[t.name + ': the blank printed sheet'] = sha(await page.evaluate(() => window.__printedCard));
    await page.uncheck('#printBlank');
    await page.click('#printBtn');
    await settle(page, 150);
    pins[t.name + ': the printed bracket'] = sha(await page.evaluate(() => window.__printedCard + '|' + window.__printedClass));
    pins[t.name + ': the share link'] = sha(await shareLink(page));
    const live = '#bracketView .slot:not(.slot-bye):not(.slot-empty):not(.slot-decided)';
    if (await page.locator(live).count()) { await page.locator(live).first().click(); await settle(page, 200); }
    pins[t.name + ': the card after one more pick'] = sha(await page.evaluate(() => document.getElementById('bracketCard').innerHTML));
    pins[t.name + ': what is stored for it after that pick'] = sha(await page.evaluate(n => localStorage.getItem('gvb-bracket:data:' + n), t.name));
  }
  pins['storage at the end'] = sha(JSON.stringify(await stored(page)));
  await page.context().close();
  return pins;
}

if (PRINT) {
  const page = await fixedPage({});
  await open(page);
  await buildOld(page);
  const storage = await stored(page);
  const link = await shareLink(page);                         // the last bracket is not one a link can carry: see below
  await page.selectOption('#bracketSwitch', 'Old double');
  await settle(page, 250);
  const doubleLink = await shareLink(page);
  await page.context().close();
  // An old link opened on a page with nothing saved.
  const fresh = await fixedPage({});
  await open(fresh, doubleLink.replace(/^[^?]*/, URL_020));
  const linkPins = {
    'an old link: storage after it opens': sha(JSON.stringify(await stored(fresh))),
    'an old link: the bracket card': sha(await fresh.evaluate(() => document.getElementById('bracketCard').innerHTML)),
  };
  await fresh.context().close();
  const pins = Object.assign(await pinsOf(storage), linkPins);
  fs.writeFileSync(GOLDEN, JSON.stringify({ madeFrom: 'the v276 page', storage, doubleLink: doubleLink.replace(/^[^?]*/, ''), unused: sha(link), pins }, null, 1) + '\n');
  console.log('wrote ' + GOLDEN + ' with ' + Object.keys(pins).length + ' pins');
  await browser.close(); server.close();
  process.exit(0);
}

const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
{
  const now = await pinsOf(golden.storage);
  const fresh = await fixedPage({});
  await open(fresh, URL_020 + golden.doubleLink);
  now['an old link: storage after it opens'] = sha(JSON.stringify(await stored(fresh)));
  now['an old link: the bracket card'] = sha(await fresh.evaluate(() => document.getElementById('bracketCard').innerHTML));
  await fresh.context().close();
  ok(Object.keys(golden.pins).length >= 38, 'the golden file holds every pin (' + Object.keys(golden.pins).length + ')');
  for (const k of Object.keys(golden.pins)) eq(now[k], golden.pins[k], k + ' is what the v276 page gave');
}

/* ── the bank the rest of this file reads ───────────────────────────────── */
const XSS = '<img src=x onerror="window.__xss=1">';
const q = (id, prompt, answer, unit, extra = {}) => Object.assign({ id, prompt, answer, unit, standard: '', difficulty: '', tags: [], points: 0, createdAt: '2026-01-05T10:00:00.000Z' }, extra);
const BANK = [
  q('q-r1', 'Which made-up river runs past Fernhollow?', 'The Wend', 'Rivers'),
  q('q-r2', 'What is the mouth of a river?', 'Where it meets the sea', 'Rivers'),
  q('q-r3', 'What is a tributary?', 'A stream that feeds a river', 'Rivers'),
  q('q-r4', 'Name the bend a slow river makes.', 'A meander', 'Rivers'),
  q('q-r5', 'What is the source of a river?', 'Where it starts', 'Rivers'),
  q('q-r6', 'Line one of a question\nand line two of it.', 'A two-line question', 'Rivers'),
  q('q-r7', 'A question with no answer yet', '', 'Rivers'),
  q('q-d1', 'What does a delta build?', 'New land', 'Deltas'),
  q('q-d2', 'Which shape names a delta?', 'A triangle', 'Deltas'),
  q('q-x1', 'Markup prompt ' + XSS + ' <b>bold</b>', 'Markup answer ' + XSS + ' <b>bold</b>', 'Markup'),
];
const BANK_TEXT = JSON.stringify({ v: 1, data: { schema: 1, questions: BANK, legacy: {} } });
const RIVERS = BANK.filter(x => x.unit === 'Rivers' && x.answer).map(x => x.prompt);
const answerOf = prompt => BANK.find(x => x.prompt === prompt).answer;

const build = async (page, name, teams, type = 'single') => {
  if (await page.isVisible('#newBracketBtn')) { await page.click('#newBracketBtn'); await settle(page, 150); }
  await page.fill('#bracketName', name);
  await page.fill('#contestants', teams.join('\n'));
  await page.selectOption('#bracketType', type);
  await page.selectOption('#seedMode', 'asEntered');
  await page.click('#generateBtn');
  await settle(page, 300);
};
const bracket = (page, name) => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-bracket:data:' + n)), name);
const prompts = page => page.$$eval('#academicPanel .ac-prompt', els => els.map(e => e.textContent));
const scoreLine = page => page.textContent('#acScore');
const markQ = async (page, i, v) => { await page.check(`#academicPanel input[name="acq${i}"][value="${v}"]`); await settle(page, 150); };
const openMatch = async (page, key) => { await page.click(`#bracketView [data-ac-key="${key}"]`); await settle(page, 150); };

/* ── 2. opening 020 writes nothing about the bank ───────────────────────── */
console.log('020 — the bank is read and never written');
{
  const OLD = JSON.stringify([
    { id: 'bank-1', question: 'An old made-up question?', answer: 'An old answer', points: 100, unit: 'Old unit', standard: '', difficulty: '', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'bank-2', question: 'Another old question?', answer: 'Another answer', points: 200, unit: 'Old unit', standard: '', difficulty: '', createdAt: '2026-01-01T00:00:00.000Z' },
  ]);
  const page = await fixedPage(Object.assign({}, golden.storage, { [OLD_KEY]: OLD }));
  await open(page);
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'opening 020 writes no bank key, not even the move of 030\'s old bank');
  eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD, 'and 030\'s old key is as it was');
  await build(page, 'Reads only', ['Otters', 'Herons']);
  await page.check('#acOn');
  await settle(page, 200);
  eq(await page.$eval('#acSource option', o => o.textContent), 'My question bank (2 questions)', 'the chooser counts 030\'s old questions, which peek() reads in memory');
  await openMatch(page, '0_0');
  eq((await prompts(page)).slice().sort(), ['An old made-up question?', 'Another old question?'], 'and a match is dealt them');
  await markQ(page, 0, 'a');
  await markQ(page, 1, 'a');
  eq((await bracket(page, 'Reads only')).slots[1][0], 'Otters', 'the match is played to a winner');
  eq(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'and after all of that there is still no bank key');
  eq(await page.evaluate(k => localStorage.getItem(k), OLD_KEY), OLD, 'and the old key is untouched');
  await page.context().close();
}

/* ── 3. the mode ────────────────────────────────────────────────────────── */
console.log('020 — off until it is turned on; then a match is played with questions');
const page = await fixedPage({ [KEY]: BANK_TEXT });
await open(page);
eq(await page.isVisible('#academicCard'), false, 'with no bracket open the card is not shown');
await build(page, 'Quiz Cup', ['Otters', 'Herons', 'Minnows', 'Kestrels']);
eq(await page.isVisible('#academicCard'), true, 'a bracket has the Academic tournament card');
eq(await page.isChecked('#acOn'), false, 'and the mode is off');
eq(await page.isVisible('#acSettings'), false, 'with its settings hidden');
eq(await page.locator('.match-q-btn').count(), 0, 'and no match has a Questions button');
ok(!('academic' in await bracket(page, 'Quiz Cup')), 'a bracket with the mode never turned on stores no academic field');
eq(await page.isVisible('#academicPanel'), false, 'and there is no question panel');

await page.check('#acOn');
await settle(page, 200);
{
  const ac = (await bracket(page, 'Quiz Cup')).academic;
  eq([ac.on, ac.source, ac.unit, ac.per, ac.drawn, ac.marks], [true, '', '', 3, {}, {}], 'turning it on stores the mode: the bank, every unit, three a match, nothing dealt');
  ok(Number.isInteger(ac.seed) && ac.seed >= 1, 'with a seed (' + ac.seed + ')');
}
eq(await page.$$eval('#acSource option', os => os.map(o => o.textContent)),
  await page.evaluate(() => QuestionBank.sources({ peek: true }).map(QuestionBank.sourceLabel)), 'the chooser\'s options are the module\'s, word for word');
eq(await page.$$eval('#acSource option', os => os.map(o => o.textContent)),
  ['My question bank (10 questions)', 'Cultural Trivia (built in, 30 questions, read-only)', 'Geography Bee (built in, 90 questions, read-only)'], 'the bank and the two built-in sets, as 030 and 040 list them');
eq(await page.$$eval('#acUnit option', os => os.map(o => o.textContent)), ['Every unit', 'Deltas', 'Markup', 'Rivers'], 'the Unit filter lists the source\'s units');
ok(/^9 questions: enough for 3 matches at 3 a match/.test(await page.textContent('#acSupply')), 'the card counts the questions a match can use (the one with no answer is not one): ' + await page.textContent('#acSupply'));
ok(/one point/.test(await page.textContent('#acRule')) && /tie decides nothing/i.test(await page.textContent('#acRule')), 'and states the rule');
eq(await page.locator('.match-q-btn').count(), 2, 'the two matches that are ready have a Questions button; the final, still TBD, has none');
await page.selectOption('#acUnit', 'Rivers');
await settle(page, 200);
ok(/^6 questions in this unit: enough for 2 matches at 3 a match/.test(await page.textContent('#acSupply')), 'a unit narrows the count: ' + await page.textContent('#acSupply'));
eq((await bracket(page, 'Quiz Cup')).academic.unit, 'Rivers', 'and is stored with the bracket');

await openMatch(page, '0_0');
eq(await page.isVisible('#academicPanel'), true, 'Questions opens the match\'s panel');
eq(await page.textContent('#acPanelTitle'), 'Round 1, match 1: Otters vs Herons', 'headed with the match');
eq(await page.evaluate(() => document.activeElement.id), 'acPanelTitle', 'focus moves to that heading');
eq(await page.getAttribute('[data-ac-key="0_0"]', 'aria-expanded'), 'true', 'and the button says it is open');
const first = await prompts(page);
eq(first.length, 3, 'three questions');
ok(first.every(p => RIVERS.includes(p)) && new Set(first).size === 3, 'each a different question of the unit that has an answer');
eq(await page.$$eval('#academicPanel .ac-answer', els => els.map(e => e.hidden + '/' + (e.offsetParent !== null))), ['true/false', 'true/false', 'true/false'], 'every answer is hidden');
eq((await bracket(page, 'Quiz Cup')).academic.drawn['0_0'].length, 3, 'the deal is stored with the bracket, by id');
await page.click('#academicPanel .ac-q:nth-child(1) .ac-reveal');
eq(await page.textContent('#acAns0'), 'Answer: ' + answerOf(first[0]), 'Show answer reveals that question\'s answer');
eq(await page.isVisible('#acAns0'), true, 'on the page');
eq([await page.getAttribute('.ac-q:nth-child(1) .ac-reveal', 'aria-expanded'), await page.textContent('.ac-q:nth-child(1) .ac-reveal')], ['true', 'Hide answer'], 'and the button says so');
eq(await page.isVisible('#acAns1'), false, 'the next question\'s answer stays hidden');

await markQ(page, 0, 'a');
eq((await bracket(page, 'Quiz Cup')).academic.marks['0_0'], { [(await bracket(page, 'Quiz Cup')).academic.drawn['0_0'][0]]: 'a' }, 'a mark is stored against the question');
eq(await scoreLine(page), 'Otters 1, Herons 0 (1 of 3 marked). The winner is recorded when every question is marked.', 'the score line counts it');
eq(await page.evaluate(() => ['acTieBtn', 'acPickA', 'acPickB'].map(id => document.getElementById(id).hidden)), [true, false, false], 'a match under way offers both picks by name, and no tiebreak');
eq(await page.textContent('[data-ac-key="0_0"]'), 'Questions: 1–0', 'and so does the match\'s button');
eq((await bracket(page, 'Quiz Cup')).slots[1][0], false, 'one mark decides nothing');
await markQ(page, 1, 'b');
eq((await bracket(page, 'Quiz Cup')).slots[1][0], false, 'nor do two of three, though the sides are level');
await markQ(page, 2, 'a');
{
  const b = await bracket(page, 'Quiz Cup');
  eq([b.slots[1][0], b.winnerSide['1_0'], b.scores['0_0']], ['Otters', 0, { a: 2, b: 1 }], 'the third mark records the winner and the score, as two typed scores would');
}
eq(await scoreLine(page), 'Otters 2, Herons 1 (3 of 3 marked). Winner recorded: Otters.', 'the line names the winner');
eq(await page.evaluate(() => ['acTieBtn', 'acPickA', 'acPickB'].map(id => document.getElementById(id).hidden)), [true, true, true], 'and there is nothing left to pick');
eq(await page.evaluate(() => document.activeElement.name), 'acq2', 'focus stays on the mark just made');
eq(await page.isVisible('#acAns0'), true, 'and the panel was not drawn again: the revealed answer is still shown');

// The override: Undo takes the recorded winner back, and a name can be picked.
await page.click('#undoBtn');
await settle(page, 200);
eq((await bracket(page, 'Quiz Cup')).slots[1][0], false, 'Undo last pick takes the winner back');
eq(await scoreLine(page), 'Otters 2, Herons 1 (3 of 3 marked). Otters is ahead on the questions and no winner is recorded: pick the winner by name.', 'the marks stay, and the line says where things stand');
await page.click('#acPickB');
await settle(page, 200);
eq((await bracket(page, 'Quiz Cup')).slots[1][0], 'Herons', 'Pick Herons as the winner records Herons, against the score');
eq(await scoreLine(page), 'Otters 2, Herons 1 (3 of 3 marked). Winner recorded: Herons. The questions favour Otters; the winner was picked by name. To change it, use Undo last pick straight after the pick.', 'and the line says the winner was picked by name');

// A tie, and a tiebreak.
await openMatch(page, '0_1');
eq(await page.textContent('#acPanelTitle'), 'Round 1, match 2: Minnows vs Kestrels', 'the second match opens in the panel');
const second = await prompts(page);
eq(second.filter(p => first.includes(p)), [], 'with none of the first match\'s questions');
eq(second.concat(first).slice().sort(), RIVERS.slice().sort(), 'between them the two matches hold the unit\'s six');
ok(second.includes('Line one of a question\nand line two of it.') || first.includes('Line one of a question\nand line two of it.'), 'a question of two lines keeps both');
await markQ(page, 0, 'a'); await markQ(page, 1, 'b'); await markQ(page, 2, 'n');
eq(await scoreLine(page), 'Minnows 1, Kestrels 1 (3 of 3 marked). A tie: add a tiebreak question, or pick the winner.', 'one each and one for neither is a tie');
eq((await bracket(page, 'Quiz Cup')).slots[1][1], false, 'and a tie decides nothing');
eq((await bracket(page, 'Quiz Cup')).scores['0_1'], { a: 1, b: 1 }, 'though the score is recorded');
eq(await page.evaluate(() => ['acTieBtn', 'acPickA', 'acPickB'].map(id => document.getElementById(id).hidden)), [false, false, false], 'the tiebreak and both picks are offered');
await page.click('#acTieBtn');
await settle(page, 200);
const withTie = await prompts(page);
eq(withTie.slice(0, 3), second, 'a tiebreak keeps the match\'s three questions');
ok(withTie.length === 4 && first.includes(withTie[3]), 'and adds a fourth; the unit is used up, so it is one of the first match\'s');
ok(/^The source ran out: 1 of these questions is also in another match of this bracket\./.test(await page.textContent('#acPanelNote')), 'and the panel says the source ran out: ' + await page.textContent('#acPanelNote'));
eq(await page.$$eval('#academicPanel input[type=radio]:checked', rs => rs.map(r => r.name + r.value)), ['acq0a', 'acq1b', 'acq2n'], 'the marks already made are still shown');
await markQ(page, 3, 'b');
eq((await bracket(page, 'Quiz Cup')).slots[1][1], 'Kestrels', 'the tiebreak decides the match');
eq(await page.locator('.match-q-btn').count(), 3, 'and the final, now Herons vs Kestrels, has its Questions button');

/* ── 4. the same bracket, the same questions ────────────────────────────── */
console.log('020 — the same questions after a reload; the source running out is said');
await openMatch(page, '1_0');
const final = await prompts(page);
eq([final.length, new Set(final).size], [3, 3], 'the final has three different questions');
ok(/^The source ran out: 3 of these questions are also in another match/.test(await page.textContent('#acPanelNote')), 'all asked before, and the panel says so');
const before = (await bracket(page, 'Quiz Cup')).academic;
await page.reload({ waitUntil: 'load' });
await settle(page, 400);
eq((await bracket(page, 'Quiz Cup')).academic, before, 'a reload stores the mode as it was');
eq(await page.isChecked('#acOn'), true, 'the mode is still on');
eq(await page.isVisible('#academicPanel'), false, 'the panel is closed after a reload');
await openMatch(page, '0_0');
eq(await prompts(page), first, 'the first match shows the same questions, in the same order');
eq(await page.$$eval('#academicPanel .ac-answer', els => els.every(e => e.hidden)), true, 'with every answer hidden again');
await openMatch(page, '0_1');
eq(await prompts(page), withTie, 'the second match its four');
await page.click('#acCloseBtn');
eq([await page.isVisible('#academicPanel'), await page.evaluate(() => document.activeElement.getAttribute('data-ac-key'))], [false, '0_1'], 'Close hides the panel and puts focus back on the match\'s button');
ok(/2 matches at 3 a match before a question is asked a second time\./.test(await page.textContent('#acSupply')), 'the card says how far the unit goes');
await page.selectOption('#acUnit', 'Deltas');
await page.fill('#acPer', '5');
await page.press('#acPer', 'Tab');
await settle(page, 200);
eq(await page.textContent('#acSupply'), 'This source has 2 questions in this unit, fewer than the 5 a match asks for. Each match gets those 2, and every match gets the same.', 'a unit with too few says so plainly');
ok(await page.$eval('#acSupply', e => e.classList.contains('error')), 'as a warning');
await openMatch(page, '0_0');
eq(await prompts(page), first, 'a match already dealt keeps its questions when the settings change');
eq(await page.evaluate(k => localStorage.getItem(k), KEY), BANK_TEXT, 'after all of that the bank is byte for byte what it was');

// Reset picks keeps the settings and the seed, and deals again from the top.
await page.selectOption('#acUnit', 'Rivers');
await page.fill('#acPer', '3');
await page.press('#acPer', 'Tab');
await page.click('#resetPicksBtn');
await settle(page, 250);
eq(await page.isVisible('#academicPanel'), false, 'Reset picks closes a panel that was open: its deal is gone');
{
  const ac = (await bracket(page, 'Quiz Cup')).academic;
  eq([ac.on, ac.seed, ac.unit, ac.per, ac.drawn, ac.marks], [true, before.seed, 'Rivers', 3, {}, {}], 'Reset picks keeps the mode, its seed and settings, and clears the deal and the marks');
  await openMatch(page, '0_0');
  eq(await prompts(page), first, 'and the first match opened is dealt the same three again');
}

// Turning it off keeps what was done; the bracket shows as any other.
await page.uncheck('#acOn');
await settle(page, 200);
eq([await page.locator('.match-q-btn').count(), await page.isVisible('#academicPanel'), await page.isVisible('#acSettings')], [0, false, false], 'turned off: no buttons, no panel, no settings');
eq((await bracket(page, 'Quiz Cup')).academic.on, false, 'stored as off');
await page.check('#acOn');
await settle(page, 200);
eq(Object.keys((await bracket(page, 'Quiz Cup')).academic.drawn), ['0_0'], 'and turned on again it has what it had');

/* ── 5. the printed match sheet ─────────────────────────────────────────── */
console.log('020 — the printed match sheet');
function pdfPages(buf) {
  const s = buf.toString('latin1'), objs = new Map(), re = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m, pages = 0;
  while ((m = re.exec(s))) objs.set(+m[1], m[2]);
  for (const body of objs.values()) if (/\/Type\s*\/Page[^s]/.test(body)) pages++;
  return pages;
}
await build(page, 'League day', ['Otters', 'Herons', 'Minnows', 'Kestrels'], 'roundrobin');
await page.emulateMedia({ media: 'print' });
eq(await page.$$eval('#academicCard, #academicPanel, #matchSheet', els => els.map(e => getComputedStyle(e).display)), ['none', 'none', 'none'], 'a bracket with the mode off prints no card, no panel and no sheet');
eq(await page.isVisible('#bracketCard'), true, 'and prints its bracket');
await page.emulateMedia({ media: 'screen' });
await page.check('#acOn');
await settle(page, 200);
await page.selectOption('#acSource', '062');
await page.fill('#acPer', '10');
await page.press('#acPer', 'Tab');
await settle(page, 200);
eq(await page.locator('.match-q-btn').count(), 6, 'a round robin of four has six matches ready');
await page.evaluate(() => { window.__printed = 0; });
await page.click('#acPrintBtn');
await settle(page, 300);
eq(await page.evaluate(() => [window.__printed, document.body.classList.contains('printing-sheet')]), [1, true], 'Print match sheets calls print() once, with the sheet asked for');
eq(await page.textContent('#acPrintNote'), 'Match sheets for 6 matches ready to play, 60 questions, with the answer key on a page of its own.', 'and says what it printed');
const sheet = await page.evaluate(() => {
  const s = document.getElementById('matchSheet');
  return {
    matches: [...s.querySelectorAll('.ms-match')].map(m => m.querySelector('h2').textContent + ' / ' + m.querySelectorAll('li').length),
    keys: [...s.querySelectorAll('.ms-key .ms-key-match')].map(m => m.querySelector('h2').textContent + ' / ' + m.querySelectorAll('li').length),
    questions: [...s.querySelectorAll('.ms-match .ms-q')].map(e => e.textContent),
    answers: [...s.querySelectorAll('.ms-key .ms-a')].map(e => e.textContent),
    readerText: [...s.querySelectorAll('.ms-match')].map(m => m.textContent).join('\n'),
    who: s.querySelector('.ms-who').textContent,
    keyLast: s.lastElementChild.className,
    breaks: [getComputedStyle(s.querySelector('.ms-key')).breakBefore, getComputedStyle(s.querySelector('li')).breakInside, getComputedStyle(s.querySelector('h2')).breakAfter],
  };
});
eq(sheet.matches, ['Round 1, match 1: Otters vs Kestrels / 10', 'Round 1, match 2: Herons vs Minnows / 10', 'Round 2, match 1: Otters vs Minnows / 10', 'Round 2, match 2: Kestrels vs Herons / 10', 'Round 3, match 1: Otters vs Herons / 10', 'Round 3, match 2: Minnows vs Kestrels / 10'], 'the sheet has a section a match, ten questions each, in the bracket\'s order');
eq(sheet.keys, sheet.matches, 'and the key the same sections');
eq(new Set(sheet.questions).size, 60, 'sixty different questions: none repeats while the set has more');
{
  const set = await page.evaluate(() => QuestionBank.setQuestions('062'));
  eq(sheet.answers, sheet.questions.map(p => set.find(x => x.prompt === p).answer), 'the key\'s answers are the questions\' own, in the same order');
  eq(sheet.answers.filter(a => a.length > 3 && sheet.readerText.includes('\n' + a + '\n')).length, 0, 'no answer is printed in the reader\'s part as a line of its own');
}
eq(sheet.who, 'Who got it:  Otters Kestrels Neither', 'each question has a box for either side and for neither');
eq(sheet.keyLast, 'ms-key', 'the key is the last thing on the sheet');
eq(sheet.breaks, ['page', 'avoid', 'avoid'], 'the key starts a page, a question is not split, a heading stays with its match');
eq(Object.keys((await bracket(page, 'League day')).academic.drawn).length, 6, 'printing deals every ready match, and stores the deal');
await page.emulateMedia({ media: 'print' });
eq(await page.evaluate(() => ['#matchSheet', '#bracketCard', '#academicCard', '#academicPanel', '.toolbar', 'footer.note', '#championBanner', '.app-header'].map(sel => getComputedStyle(document.querySelector(sel)).display === 'none')), [false, true, true, true, true, true, true, true], 'on paper the sheet is all there is');
eq(await page.evaluate(() => { const c = getComputedStyle(document.getElementById('matchSheet')); return [c.color, c.backgroundColor]; }), ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'], 'black on white');
{
  const pages = pdfPages(await page.pdf({ format: 'Letter' }));
  ok(pages >= 4, 'sixty questions and their key run over several pages (' + pages + ')');
  const clipped = await page.evaluate(() => [...document.querySelectorAll('#matchSheet *')].filter(e => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible').length);
  eq(clipped, 0, 'and nothing on it is clipped');
}
await page.emulateMedia({ media: 'screen' });
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
eq(await page.evaluate(() => document.body.classList.contains('printing-sheet')), false, 'when printing ends the sheet is no longer asked for');
await page.click('#printBtn');
eq(await page.evaluate(() => [window.__printed, window.__printedClass.includes('printing-sheet')]), [2, false], 'so the Print button prints the bracket, as before');
await page.click('#acPrintBtn');
await page.click('#bracketView .slot:not(.slot-decided)');
await settle(page, 200);
eq(await page.evaluate(() => document.body.classList.contains('printing-sheet')), false, 'and any change to the bracket also puts the bracket back for Ctrl+P');
{
  // Nothing to print: an empty bank.
  const empty = await fixedPage({});
  await open(empty);
  await build(empty, 'No bank yet', ['Otters', 'Herons']);
  await empty.check('#acOn');
  await settle(empty, 200);
  ok(/^This source has no questions, so a match has none to show\./.test(await empty.textContent('#acSupply')), 'an empty bank is said on the card: ' + await empty.textContent('#acSupply'));
  await empty.click('#acPrintBtn');
  eq([await empty.evaluate(() => window.__printed || 0), await empty.textContent('#acPrintNote')], [0, 'Nothing to print: the source has no questions.'], 'and nothing is printed, with the reason');
  await openMatch(empty, '0_0');
  ok(/^No questions: the source has none\./.test(await empty.textContent('#acPanelNote')), 'a match says it has no questions');
  eq(await empty.locator('#academicPanel .ac-q').count(), 0, 'and lists none');
  ok(!('0_0' in (await bracket(empty, 'No bank yet')).academic.drawn), 'an empty deal is not stored, so a source chosen later deals this match');
  await empty.click('#acPickA');
  await settle(empty, 200);
  eq((await bracket(empty, 'No bank yet')).slots[1][0], 'Otters', 'the winner can still be picked by name');
  eq(await empty.evaluate(k => localStorage.getItem(k), KEY), null, 'and no bank key was written');
  await empty.context().close();
}

/* ── 6. text from the bank is text ──────────────────────────────────────── */
console.log('020 — a question that is markup is text, on the page and on paper');
await build(page, 'Markup & <i>Co</i>', ['Tide & <b>Table</b>', 'Herons']);
await page.check('#acOn');
await settle(page, 200);
await page.selectOption('#acUnit', 'Markup');
await page.fill('#acPer', '1');
await page.press('#acPer', 'Tab');
await settle(page, 200);
await openMatch(page, '0_0');
eq(await prompts(page), ['Markup prompt ' + XSS + ' <b>bold</b>'], 'the prompt is shown as its characters');
await page.click('#academicPanel .ac-reveal');
eq(await page.textContent('#acAns0'), 'Answer: Markup answer ' + XSS + ' <b>bold</b>', 'and so is the answer');
eq(await page.textContent('#acPanelTitle'), 'Round 1, match 1: Tide & <b>Table</b> vs Herons', 'a team name that is markup is text in the heading');
eq(await page.getAttribute('[data-ac-key="0_0"]', 'aria-label'), 'Questions for Tide & <b>Table</b> vs Herons', 'and in the button\'s name');
await page.click('#acPrintBtn');
await settle(page, 200);
eq(await page.$$eval('#matchSheet .ms-q, #matchSheet .ms-a', els => els.map(e => e.textContent)), ['Markup prompt ' + XSS + ' <b>bold</b>', 'Markup answer ' + XSS + ' <b>bold</b>'], 'the sheet prints both as their characters');
eq(await page.evaluate(() => [document.querySelectorAll('#academicCard img, #academicCard b, #academicPanel img, #academicPanel b, #matchSheet img, #matchSheet b, #matchSheet i, #bracketView .match-q-btn b').length, window.__xss === undefined]), [0, true], 'no element was made from a question or a name, and nothing ran');
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

/* ── 8. axe (before the share section leaves this page) ─────────────────── */
{
  const scan = await a11yScan(page, { include: ['#academicCard', '#academicPanel', '#bracketCard'] });
  eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], 'the card, an open panel with a revealed answer and the bracket with its Questions buttons are clean under axe');
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  const dark = await a11yScan(page, { include: ['#academicCard', '#academicPanel'] });
  eq(dark.map(v => v.id + ' ' + v.nodes.join(',')), [], 'and in the dark theme');
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); });
}

/* ── 7. a share link ────────────────────────────────────────────────────── */
console.log('020 — a share link carries the mode, cleaned');
await page.selectOption('#bracketSwitch', 'Quiz Cup');
await settle(page, 250);
eq(await page.isVisible('#academicPanel'), false, 'switching to another bracket closes the panel: its match was the other bracket\'s');
await openMatch(page, '0_0');
await markQ(page, 0, 'b');
const sent = await bracket(page, 'Quiz Cup');
const link = await shareLink(page);
{
  const there = await fixedPage({ [KEY]: BANK_TEXT });
  await open(there, link);
  const got = await bracket(there, 'Quiz Cup');
  eq(got.academic, sent.academic, 'a link opened where the same bank is carries the mode whole: seed, settings, deal and marks');
  await openMatch(there, '0_0');
  eq(await prompts(there), first, 'and shows the same questions');
  eq(await there.$$eval('#academicPanel input[type=radio]:checked', rs => rs.map(r => r.name + r.value)), ['acq0b'], 'with the mark made');
  await there.context().close();

  const elsewhere = await fixedPage({});
  await open(elsewhere, link);
  await openMatch(elsewhere, '0_0');
  ok((await prompts(elsewhere)).every(p => /^This question is no longer in its source/.test(p)), 'where the bank is not, each question says it is not in its source');
  eq(await elsewhere.locator('#academicPanel .ac-reveal').count(), 0, 'and has no answer to show');
  eq(await elsewhere.evaluate(k => localStorage.getItem(k), KEY), null, 'a link writes no bank key');
  await elsewhere.context().close();

  // A link's own idea of the mode is cleaned.
  const crafted = await page.evaluate(({ state, XSS }) => {
    const s = JSON.parse(JSON.stringify(state));
    s.name = 'Crafted';
    s.academic = { on: true, seed: 77, source: XSS, unit: XSS, per: 9999, html: XSS, drawn: { '0_0': ['q-r1', XSS, 5, 'q-r1'], 'evil key': ['q-r2'], '0_1': 'q-r3' }, marks: { '0_0': { 'q-r1': 'a', [XSS]: XSS }, '1_0': { 'q-r1': 'a' } } };
    return location.pathname + '?bracket=' + encodeURIComponent(StateLink.encodeState(s));
  }, { state: sent, XSS });
  const odd = await fixedPage({ [KEY]: BANK_TEXT });
  await open(odd, BASE + crafted);
  const got2 = (await bracket(odd, 'Crafted')).academic;
  eq(got2, { on: true, seed: 77, source: XSS, unit: XSS, per: 20, drawn: { '0_0': ['q-r1', XSS] }, marks: { '0_0': { 'q-r1': 'a' } } }, 'a crafted link\'s mode is cut to its seven fields, their types and their limits');
  eq(await odd.$$eval('#acSource option:checked, #acUnit option:checked', os => os.map(o => o.textContent)), ['A source this device does not have (0 questions)', XSS + ' (no questions now)'], 'a source and a unit it names are shown as text');
  await openMatch(odd, '0_0');
  eq(await odd.evaluate(() => [document.querySelectorAll('#academicCard img, #academicPanel img').length, window.__xss === undefined]), [0, true], 'and no element is made from them, and nothing runs');
  eq(await odd.evaluate(k => localStorage.getItem(k), KEY), BANK_TEXT, 'the bank is untouched');
  await odd.context().close();

  // A link from before has no mode, and gets none.
  const old = await fixedPage({});
  await open(old, URL_020 + golden.doubleLink);
  ok(!('academic' in await bracket(old, 'Old double')), 'a link from before the mode opens with no academic field');
  eq(await old.isChecked('#acOn'), false, 'and the mode off');
  await old.context().close();
}
eq(page.__errs || [], [], 'no page or console errors: ' + JSON.stringify((page.__errs || []).slice(0, 3)));
eq(page.__blocked || [], [], 'nothing asked of another site');

eq(errors, [], 'no console error anywhere in this run');
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
