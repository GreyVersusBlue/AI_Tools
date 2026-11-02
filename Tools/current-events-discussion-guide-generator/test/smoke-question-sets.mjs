// smoke-question-sets.mjs — 054's saved question sets, driven in a real page.
//
//   node Tools/current-events-discussion-guide-generator/test/smoke-question-sets.mjs
//
// The six built-in guiding questions used to be the only list. A teacher can
// now save the questions a guide asks as a named set (kept on this device under
// one key, in no guide and no share link), swap a set in on another guide,
// add one to what a guide already asks, go back to the six, and delete a set.
// What is held down: what a saved set contains, what Use / Add / built-in do to
// the ticks and the guide's own questions, what prints (set questions are
// escaped), the confirmations, a set surviving a reload, a set staying out of a
// share link, a damaged store, a full browser store, 360 px and axe. Every name
// and question here is invented. Exits 1 on any failure.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8645;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/054-current-events-discussion-guide-generator.html';
const KEY = 'cedg_qsets_v1';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
console.log('Current Events Discussion Guide — saved question sets');

let answers = [];            // prompt / confirm answers, in order; a confirm with none left says yes
const asked = [];
async function open(width = 1300, store) {
  const page = await prepPage(browser, BASE, { width, height: 1100 });
  page.__errs = [];
  page.on('pageerror', e => page.__errs.push(String(e)));
  page.on('dialog', async d => {
    asked.push(d.type() + ':' + d.message());
    const a = answers.length ? answers.shift() : (d.type() === 'confirm' ? true : '');
    if (a === false || a === null) await d.dismiss(); else await d.accept(typeof a === 'string' ? a : undefined);
  });
  if (store) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, store]);
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await settle(page, 300);
  return page;
}
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const ticks = page => page.$$eval('#presetQuestions input', cs => cs.map(c => c.checked));
const own = page => page.$$eval('#customQuestionsWrap input', is => is.map(i => i.value));
const note = page => page.$eval('#qsetNote', n => n.textContent);
const options = page => page.$$eval('#qsetSelect option', os => os.map(o => o.textContent));
async function addOwn(page, texts) {
  for (const t of texts) {
    await page.click('#addQuestionBtn');
    await page.fill('#customQuestionsWrap .q-row:last-child input', t);
  }
}
const printed = async page => {
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#printBtn');
  await settle(page, 200);
  return page.$$eval('#printArea .q-item', q => q.map(x => x.textContent));
};

{
  const page = await open();
  eq(await options(page), ['The six built-in questions'], 'before any set, the picker offers the six');
  ok(await page.$eval('#qsetDeleteBtn', b => b.disabled), 'and the six cannot be deleted');
  eq(await ticks(page), [true, true, true, true, true, true], 'all six built-in questions are ticked');
  eq(await stored(page), null, 'nothing is stored for a teacher who never saves a set');

  // save: three of the six, plus two of her own
  await page.uncheck('#presetQuestions input[data-preset="0"]');
  await page.uncheck('#presetQuestions input[data-preset="1"]');
  await page.uncheck('#presetQuestions input[data-preset="2"]');
  await addOwn(page, ['Who is the author trying to convince?', 'What <b>evidence</b> is given?']);
  answers = ['  Persuasive   follow-up '];
  await page.click('#qsetSaveBtn');
  await settle(page, 150);
  let st = await stored(page);
  eq(st.v, 1, 'the bank is versioned');
  eq(st.sets.length, 1, 'one set is stored');
  eq(st.sets[0].name, 'Persuasive follow-up', 'its name is trimmed');
  eq(st.sets[0].questions, [
    'What’s one fact from the article that surprised you?',
    'Do you think this issue will still matter in five years? Why or why not?',
    'What’s one question you still have after reading this?',
    'Who is the author trying to convince?',
    'What <b>evidence</b> is given?'], 'the ticked built-ins (as plain text) then her own, nothing else');
  eq(await options(page), ['The six built-in questions', 'Persuasive follow-up (5)'], 'the picker lists it with its size');
  eq(await page.$eval('#qsetSelect', s => s.selectedOptions[0].textContent), 'Persuasive follow-up (5)', '...and has it selected');
  ok(/Saved “Persuasive follow-up” with 5 questions/.test(await note(page)), 'the note says what was saved: ' + (await note(page)));
  ok(!JSON.stringify(st).includes('articleText'), 'the set holds no article');

  // refusals
  answers = [''];
  await page.click('#qsetSaveBtn');
  eq((await stored(page)).sets.length, 1, 'a blank name saves nothing');
  answers = ['persuasive FOLLOW-up', false];
  await page.click('#qsetSaveBtn');
  eq((await stored(page)).sets[0].questions.length, 5, 'a name that exists asks before replacing, and No leaves it');
  ok(asked.some(a => /already exists/.test(a)), 'the question was asked');

  // a fresh guide: use the set
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  eq(await options(page), ['The six built-in questions', 'Persuasive follow-up (5)'], 'the set is there after a reload');
  await page.selectOption('#qsetSelect', { index: 1 });
  ok(!(await page.$eval('#qsetDeleteBtn', b => b.disabled)), 'a saved set can be deleted');
  // the guide has the 5 own questions already from before the reload (guide persisted): use replaces them, asking first
  answers = [false];
  await page.click('#qsetUseBtn');
  eq((await own(page)).length, 2, 'Use, answered No, changes nothing');
  answers = [true];
  await page.click('#qsetUseBtn');
  await settle(page, 150);
  eq(await ticks(page), [false, false, false, false, false, false], 'Use unticks the six built-ins');
  eq((await own(page)).length, 5, 'and the set becomes the guide’s own questions');
  eq((await own(page))[4], 'What <b>evidence</b> is given?', 'as typed');
  ok(/now asks “Persuasive follow-up”/.test(await note(page)), 'the note says so');

  // what prints
  const q = await printed(page);
  eq(q.length, 5, 'five questions print');
  eq(q[4], 'What <b>evidence</b> is given?', 'a question with markup in it prints as text');
  eq(await page.$$eval('#printArea .q-item b', b => b.length), 0, '...never as markup');

  // back to the six
  await page.selectOption('#qsetSelect', 'builtin');
  answers = [true];
  await page.click('#qsetUseBtn');
  await settle(page, 150);
  eq(await ticks(page), [true, true, true, true, true, true], 'the six built-ins swap back in: all ticked');
  eq(await own(page), [], '...and her own list is cleared (after asking)');

  // add: appends only what is missing
  await page.selectOption('#qsetSelect', { index: 1 });
  await page.click('#qsetAddBtn');
  await settle(page, 150);
  eq((await own(page)).length, 2, 'Add puts in only the set\u2019s questions the guide did not already ask (5 minus 3 that match a ticked built-in)');
  ok(/Added 2 questions/.test(await note(page)), 'and counts them: ' + (await note(page)));
  await page.click('#qsetAddBtn');
  eq((await own(page)).length, 2, 'adding again adds nothing');
  ok(/already on this guide/.test(await note(page)), 'and says so');
  eq(await ticks(page), [true, true, true, true, true, true], 'Add leaves the ticks alone');

  // built-in 'add' re-ticks
  await page.uncheck('#presetQuestions input[data-preset="3"]');
  await page.selectOption('#qsetSelect', 'builtin');
  await page.click('#qsetAddBtn');
  eq(await ticks(page), [true, true, true, true, true, true], 'Add on the six ticks them all again');

  // delete
  await page.selectOption('#qsetSelect', { index: 1 });
  answers = [false];
  await page.click('#qsetDeleteBtn');
  eq((await stored(page)).sets.length, 1, 'Delete asks first, and No keeps it');
  answers = [true];
  await page.click('#qsetDeleteBtn');
  await settle(page, 150);
  eq((await stored(page)).sets.length, 0, 'Delete removes it');
  eq(await options(page), ['The six built-in questions'], 'and the picker drops it');
  eq((await own(page)).length, 2, 'a guide that used its questions keeps them');
  eq(page.__errs, [], 'no page errors');
  await page.context().close();
}

/* a set that a guide did not use is in no guide record (and so in no link or file made from one) */
{
  const page = await open(1300, JSON.stringify({ v: 1, sets: [{ id: 'a', name: 'Secret set name', questions: ['Hidden question text?'], ts: 1 }] }));
  const mem = await page.evaluate(() => Object.keys(localStorage).filter(k => /^cedg_guide_v1:/.test(k)).map(k => localStorage.getItem(k)).join('|'));
  ok(!mem.includes('Secret set name') && !mem.includes('Hidden question text'), 'a guide’s own record holds none of a set it did not use');
  eq(await options(page), ['The six built-in questions', 'Secret set name (1)'], 'a stored set is offered');
  await page.context().close();
}

/* damaged and over-full stores */
{
  const page = await open(1300, '{"v":1,"sets":[null,{"name":"A","questions":[]},{"name":"Fine","questions":["Real question?",5]}]}');
  eq(await options(page), ['The six built-in questions', 'Fine (1)'], 'a damaged store keeps what is readable');
  await page.context().close();
  const page2 = await open(1300, 'not json at all');
  eq(await options(page2), ['The six built-in questions'], 'an unreadable store is an empty bank, not an error');
  eq(page2.__errs, [], '...with no page error');
  await addOwn(page2, ['Q one?']);
  await page2.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/cedg_qsets/.test(k)) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; });
  answers = ['Will not fit'];
  await page2.click('#qsetSaveBtn');
  await settle(page2, 150);
  ok(/refused to save the set/.test(await note(page2)), 'a full browser store is said out loud: ' + (await note(page2)));
  eq(await options(page2), ['The six built-in questions'], '...and no set appears that was not kept');
  await page2.context().close();
}

/* nothing to save */
{
  const page = await open();
  for (let i = 0; i < 6; i++) await page.uncheck(`#presetQuestions input[data-preset="${i}"]`);
  await page.click('#qsetSaveBtn');
  ok(/nothing to save/.test(await note(page)), 'a guide asking nothing has nothing to save');
  await page.context().close();
}

/* 360 px and axe */
{
  const page = await open(360, JSON.stringify({ v: 1, sets: [{ id: 'a', name: 'A set with a rather long name indeed', questions: ['Q?'], ts: 1 }] }));
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(over <= 1, 'no sideways scroll at 360 px (' + over + ')');
  const small = await page.$$eval('.qset-bar button, .qset-bar select', bs => bs.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
  ok(Math.min(...small) >= 24, 'every control is at least 24 px (' + Math.round(Math.min(...small)) + ')');
  const v = await a11yScan(page);
  eq(v.map(x => x.id), [], 'no serious axe violations');
  await page.context().close();
}

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
