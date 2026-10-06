// smoke-saves.mjs — 063's named saved stories: each save holds a story's text
// and its word bank together, in the story key's Store envelope at version 2.
//
//   node Tools/grammar-mad-libs/test/smoke-saves.mjs        (port 8490)
//
// The controls follow 041 and 048 (a chooser, + New, Duplicate, Rename, Delete
// behind a confirm). What this suite cares most about is the three ways a
// teacher's work could vanish: the story and bank they already had (legacy
// shapes), a debounced edit landing on the wrong save when they switch fast,
// and Delete of the last save leaving a tool that cannot be used. Every
// assertion reads the page or the disk, not a return value.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8490;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/063-grammar-mad-libs-generator.html';

const STORY_KEY = 'gmlg_custom_story_v1';
const BANKS_KEY = 'gmlg_custom_banks_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Grammar Mad Libs — saved stories');

const server = await serve(PORT);
const browser = await launch();

async function open(init, seed) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  page.__dialogs = [];
  page.__answers = [];     // queued prompt/confirm answers; null = cancel/false
  page.on('dialog', async d => {
    page.__dialogs.push({ type: d.type(), message: d.message(), def: d.defaultValue() });
    const a = page.__answers.length ? page.__answers.shift() : null;
    if (d.type() === 'prompt') { if (a === null) await d.dismiss(); else await d.accept(String(a)); }
    else { if (a) await d.accept(); else await d.dismiss(); }
  });
  if (init) await page.addInitScript(init, seed);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);
  return page;
}
const doc = page => page.evaluate(k => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; }, STORY_KEY);
const names = page => page.$$eval('#storySelect option', os => os.map(o => o.textContent));
const selectedName = page => page.$eval('#storySelect', s => s.selectedOptions[0] && s.selectedOptions[0].textContent);
const text = page => page.$eval('#customText', e => e.value);
const bankOf = async (page, tag) => {
  await page.selectOption('#bankTagSelect', tag);
  await settle(page, 100);
  return page.$eval('#bankWordsInput', e => e.value);
};
const msg = page => page.$eval('#storyMsg', e => e.textContent);
const enabled = (page, id) => page.$eval('#' + id, e => !e.disabled);
const clean = async (page, tag) => {
  eq(page.__errs.length, 0, `${tag}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  eq(page.__blocked.length, 0, `${tag}: nothing left the site`);
  await page.context().close();
};

/* ── 1. An untouched page stores nothing and is a usable empty tool ───── */
{
  const page = await open();
  eq(await names(page), ['No saved stories yet — type below to start one'], '1: the chooser says there is nothing saved');
  eq(await doc(page), null, '1: an untouched page wrote nothing');
  ok(!(await enabled(page, 'storySelect')), '1: the chooser is disabled with no saves');
  for (const id of ['dupStoryBtn', 'renameStoryBtn', 'deleteStoryBtn'])
    ok(!(await enabled(page, id)), `1: ${id} is disabled with nothing to act on`);
  ok(await enabled(page, 'newStoryBtn'), '1: + New is available');
  ok((await page.$eval('#storyPreview', e => e.textContent)).length > 20, '1: a story still renders');
  eq(await page.$eval('label[for=storySelect]', e => e.textContent), 'Saved story', '1: the chooser has a label');

  // typing starts the first save, and it comes back
  await page.fill('#customText', 'A {adjective} {animal} wobbled.');
  await settle(page, 600);
  eq(await names(page), ['My story'], '1: typing started "My story"');
  const d = await doc(page);
  eq(d.v, 2, '1: stored at version 2');
  eq(d.data.list[0].text, 'A {adjective} {animal} wobbled.', '1: with the text');
  ok(await enabled(page, 'deleteStoryBtn'), '1: Delete is available once there is a save');
  const again = await page.context().newPage();
  await again.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(again, 250);
  eq(await text(again), 'A {adjective} {animal} wobbled.', '1: it is there on the next visit');
  await clean(page, '1');
}

/* ── 2. What a teacher had becomes the first save, nothing lost ───────── */
{
  const legacyStory = JSON.stringify({ v: 1, text: 'The {adjective} {animal} sang.' });
  const legacyBanks = JSON.stringify({ animal: ['axolotl', 'pangolin'] });
  const page = await open(([sk, bk, s, b]) => { localStorage.setItem(sk, s); localStorage.setItem(bk, b); },
    [STORY_KEY, BANKS_KEY, legacyStory, legacyBanks]);
  eq(await names(page), ['My story'], '2: one save, named My story');
  eq(await text(page), 'The {adjective} {animal} sang.', '2: its text is the old story');
  ok(/axolotl/.test(await bankOf(page, 'animal')) && /pangolin/.test(await bankOf(page, 'animal')), '2: its bank is the old bank');
  eq(await page.evaluate(k => localStorage.getItem(k), STORY_KEY), legacyStory, '2: reading did not rewrite the story key');
  eq(await page.evaluate(k => localStorage.getItem(k), BANKS_KEY), legacyBanks, '2: nor the bank key');

  // the first edit writes the new shape, with the bank inside the save
  await page.fill('#customText', 'The {adjective} {animal} sang loudly.');
  await settle(page, 600);
  const d = await doc(page);
  eq(d.v, 2, '2: the next write is version 2');
  eq(d.data.list[0].banks.animal, ['axolotl', 'pangolin'], '2: bank and story are in the one save');

  // the old bank key no longer feeds a page that has a list
  await page.evaluate(([bk]) => localStorage.setItem(bk, JSON.stringify({ animal: ['intruder'] })), [BANKS_KEY]);
  const again = await page.context().newPage();
  await again.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(again, 250);
  const w = await bankOf(again, 'animal');
  ok(/axolotl/.test(w) && !/intruder/.test(w), '2: a saved list is not re-migrated over: ' + w);
  await clean(page, '2');
}
{
  // version 1: the bare string Store wrote last time
  const page = await open(([sk, bk]) => {
    localStorage.setItem(sk, JSON.stringify({ v: 1, data: 'Plain {noun} story.' }));
    localStorage.setItem(bk, JSON.stringify({ v: 1, data: { noun: ['kazoo'] } }));
  }, [STORY_KEY, BANKS_KEY]);
  eq(await text(page), 'Plain {noun} story.', '2b: a version-1 enveloped story loads');
  eq(await bankOf(page, 'noun'), 'kazoo', '2b: with its enveloped bank');
  await clean(page, '2b');
}
{
  // a bank and no story at all
  const page = await open(([bk]) => localStorage.setItem(bk, JSON.stringify({ food: ['dumpling'] })), [BANKS_KEY]);
  eq(await names(page), ['My story'], '2c: a bank alone still becomes a save');
  eq(await text(page), '', '2c: with no text');
  eq(await bankOf(page, 'food'), 'dumpling', '2c: and the bank');
  await clean(page, '2c');
}
{
  // junk in the new shape
  const bad = { v: 2, data: { list: [null, { id: 'a', name: '  ', text: 5, banks: { noun: 'nope', verb: ['hop', 7] } }, { id: 'a', name: 'dup id' }, 'x'], currentId: 'zzz' } };
  const page = await open(([sk, d]) => localStorage.setItem(sk, JSON.stringify(d)), [STORY_KEY, bad]);
  eq(await names(page), ['My story'], '2d: malformed entries are dropped, a nameless one is named');
  eq(await text(page), '', '2d: a non-string text becomes empty');
  eq(await bankOf(page, 'verb'), 'hop', '2d: junk words are filtered from a bank');
  eq(await bankOf(page, 'noun'), '', '2d: a bank that is not a list is dropped');
  await clean(page, '2d');
  const page2 = await open(([sk]) => localStorage.setItem(sk, JSON.stringify({ v: 2, data: { list: 'no' } })), [STORY_KEY]);
  eq(await names(page2), ['No saved stories yet — type below to start one'], '2d: a list that is not a list falls back to empty');
  await clean(page2, '2d-b');
}

/* ── 3. + New, switching, and the pair travelling together ────────────── */
{
  const page = await open();
  await page.fill('#customText', 'Story one has a {color} {noun}.');
  await page.selectOption('#bankTagSelect', 'color');
  await page.fill('#bankWordsInput', 'teal, maroon');
  await settle(page, 600);

  page.__answers.push('Unit 2 story');
  await page.click('#newStoryBtn');
  await settle(page, 200);
  eq(page.__dialogs.at(-1).type, 'prompt', '3: + New asks for a name');
  eq(page.__dialogs.at(-1).def, 'New story', '3: with a default');
  eq(await names(page), ['My story', 'Unit 2 story'], '3: both saves are listed');
  eq(await selectedName(page), 'Unit 2 story', '3: the new one is open');
  eq(await text(page), '', '3: it starts with no text');
  eq(await bankOf(page, 'color'), '', '3: and no word bank of its own');
  ok(/Started/.test(await msg(page)), '3: the page says so in the status line: ' + await msg(page));

  await page.fill('#customText', 'Story two has an {animal}.');
  await page.selectOption('#bankTagSelect', 'animal');
  await page.fill('#bankWordsInput', 'okapi');
  await settle(page, 600);

  const first = await page.$$eval('#storySelect option', os => os[0].value);
  await page.selectOption('#storySelect', first);
  await settle(page, 200);
  eq(await text(page), 'Story one has a {color} {noun}.', '3: switching back restores the text');
  eq(await bankOf(page, 'color'), 'teal, maroon', '3: and its word bank');
  eq(await bankOf(page, 'animal'), '', '3: without the other story\'s words');
  ok(/teal|maroon/.test(await page.$eval('#bankBox', e => e.textContent)), '3: the on-screen bank shows this save\'s words');
  ok(/color/.test(await page.$eval('#storyPreview', e => e.textContent)), '3: the opened story is the one previewed');

  // print carries the open save's bank
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click('#printBtn');
  ok(await page.evaluate(() => window.__printed === true), '3: print still runs');
  ok(/teal, maroon/.test(await page.$eval('#printBank', e => e.textContent)), '3: the printed bank is this save\'s');

  // cancelling a name changes nothing
  await page.click('#newStoryBtn');
  await settle(page, 100);
  eq(await names(page), ['My story', 'Unit 2 story'], '3: cancelling + New adds nothing');

  // a blank name still gives a usable one
  page.__answers.push('   ');
  await page.click('#newStoryBtn');
  await settle(page, 100);
  eq((await names(page)).at(-1), 'New story', '3: a blank name falls back to the default');
  await clean(page, '3');
}

/* ── 4. A switch right after typing does not move the edit ────────────── */
{
  const page = await open();
  await page.fill('#customText', 'Original {noun}.');
  await settle(page, 600);
  page.__answers.push('Second');
  await page.click('#newStoryBtn');
  await settle(page, 100);
  const first = await page.$$eval('#storySelect option', os => os[0].value);
  await page.selectOption('#storySelect', first);
  await settle(page, 100);

  // type, and switch before the 300 ms save fires
  await page.fill('#customText', 'Original {noun}, edited fast.');
  const second = await page.$$eval('#storySelect option', os => os[1].value);
  await page.selectOption('#storySelect', second);
  await settle(page, 700);
  eq(await text(page), '', '4: the other story was not given the edit');
  const d = await doc(page);
  eq(d.data.list[0].text, 'Original {noun}, edited fast.', '4: the edit landed on the story it was typed into');
  eq(d.data.list[1].text, '', '4: and the second story is untouched');

  // the same for a word-bank edit (250 ms)
  await page.selectOption('#storySelect', first);
  await settle(page, 100);
  await page.selectOption('#bankTagSelect', 'noun');
  await page.fill('#bankWordsInput', 'kazoo, ukulele');
  await page.selectOption('#storySelect', second);
  await settle(page, 700);
  eq(await bankOf(page, 'noun'), '', '4: the other story has no noun words');
  eq((await doc(page)).data.list[0].banks.noun, ['kazoo', 'ukulele'], '4: the bank edit landed on its own story');
  await clean(page, '4');
}

/* ── 5. Duplicate is a deep copy ──────────────────────────────────────── */
{
  const page = await open();
  await page.fill('#customText', 'Dup {verb} test.');
  await page.selectOption('#bankTagSelect', 'verb');
  await page.fill('#bankWordsInput', 'leap, vault');
  await settle(page, 600);
  page.__answers.push('Copy of mine');
  await page.click('#dupStoryBtn');
  await settle(page, 200);
  eq(page.__dialogs.at(-1).def, 'My story (copy)', '5: the duplicate prompt suggests "(copy)"');
  eq(await names(page), ['My story', 'Copy of mine'], '5: two saves');
  eq(await text(page), 'Dup {verb} test.', '5: the copy has the text');
  eq(await bankOf(page, 'verb'), 'leap, vault', '5: and the bank');

  await page.fill('#bankWordsInput', 'only this');
  await page.fill('#customText', 'Changed copy {verb}.');
  await settle(page, 600);
  const d = await doc(page);
  eq(d.data.list[0].text, 'Dup {verb} test.', '5: editing the copy leaves the original text alone');
  eq(d.data.list[0].banks.verb, ['leap', 'vault'], '5: and its bank');
  ok(d.data.list[0].id !== d.data.list[1].id, '5: the copy has its own id');

  // the default name is taken when the prompt is blank
  page.__answers.push('');
  await page.click('#dupStoryBtn');
  await settle(page, 100);
  eq((await names(page)).at(-1), 'Copy of mine (copy)', '5: a blank duplicate name takes the suggestion');
  await clean(page, '5');
}

/* ── 6. Rename ────────────────────────────────────────────────────────── */
{
  const page = await open();
  await page.fill('#customText', 'Rename {noun}.');
  await settle(page, 600);
  page.__answers.push('Poetry unit');
  await page.click('#renameStoryBtn');
  await settle(page, 100);
  eq(page.__dialogs.at(-1).def, 'My story', '6: the prompt shows the current name');
  eq(await names(page), ['Poetry unit'], '6: the chooser shows the new name');
  eq((await doc(page)).data.list[0].name, 'Poetry unit', '6: and it is stored');
  eq(await text(page), 'Rename {noun}.', '6: the text is untouched');
  page.__answers.push('   ');
  await page.click('#renameStoryBtn');
  await settle(page, 100);
  eq(await names(page), ['Poetry unit'], '6: a blank name keeps the old one');
  await page.click('#renameStoryBtn');            // cancelled
  await settle(page, 100);
  eq(await names(page), ['Poetry unit'], '6: cancel keeps it too');
  page.__answers.push('<b>x</b> & "y"');
  await page.click('#renameStoryBtn');
  await settle(page, 100);
  eq(await names(page), ['<b>x</b> & "y"'], '6: a name with markup shows as text');
  eq(await page.$$eval('#storySelect b', e => e.length), 0, '6: and makes no element');
  await clean(page, '6');
}

/* ── 7. Delete, and deleting the last one ─────────────────────────────── */
{
  const page = await open();
  await page.fill('#customText', 'One {noun}.');
  await settle(page, 600);
  page.__answers.push('Two');
  await page.click('#newStoryBtn');
  await page.fill('#customText', 'Two {verb}.');
  await settle(page, 600);

  await page.click('#deleteStoryBtn');            // cancelled
  await settle(page, 100);
  eq(page.__dialogs.at(-1).type, 'confirm', '7: Delete asks first');
  ok(/Two/.test(page.__dialogs.at(-1).message) && /word bank/.test(page.__dialogs.at(-1).message), '7: naming the story and its bank');
  eq(await names(page), ['My story', 'Two'], '7: cancelling deletes nothing');

  page.__answers.push(true);
  await page.click('#deleteStoryBtn');
  await settle(page, 200);
  eq(await names(page), ['My story'], '7: confirming removes it');
  eq(await text(page), 'One {noun}.', '7: the neighbour is open');
  ok(/Deleted/.test(await msg(page)), '7: the status line says so');

  page.__answers.push(true);
  await page.click('#deleteStoryBtn');
  await settle(page, 200);
  eq(await names(page), ['No saved stories yet — type below to start one'], '7: the last one can go too');
  eq(await text(page), '', '7: the textarea is empty');
  eq(await page.$eval('#bankWordsInput', e => e.value), '', '7: the bank editor is empty');
  ok(!(await enabled(page, 'deleteStoryBtn')), '7: Delete is disabled with nothing left');
  ok(await enabled(page, 'newStoryBtn'), '7: + New works');
  ok((await page.$eval('#storyPreview', e => e.textContent)).length > 20, '7: a story is still showing');
  eq((await doc(page)).data.list, [], '7: an empty list is stored, so the delete is remembered');

  const again = await page.context().newPage();
  await again.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(again, 250);
  eq(await names(again), ['No saved stories yet — type below to start one'], '7: still empty after a reload');

  // and the empty tool takes new work
  await page.fill('#customText', 'Fresh {color}.');
  await settle(page, 600);
  eq(await names(page), ['My story'], '7: typing starts a save again');
  await page.evaluate(() => { window.print = () => { window.__p = 1; }; });
  await page.click('#printBtn');
  ok(await page.evaluate(() => window.__p === 1), '7: printing works');
  await clean(page, '7');
}
{
  // deleting also drops the legacy bank for good: a deleted page does not re-import it
  const page = await open(([sk, bk]) => {
    localStorage.setItem(sk, JSON.stringify({ v: 1, text: 'Old {noun}.' }));
    localStorage.setItem(bk, JSON.stringify({ noun: ['legacy'] }));
  }, [STORY_KEY, BANKS_KEY]);
  page.__answers.push(true);
  await page.click('#deleteStoryBtn');
  await settle(page, 200);
  const again = await page.context().newPage();
  await again.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(again, 250);
  eq(await names(again), ['No saved stories yet — type below to start one'], '7b: a deleted legacy save does not come back');
  await clean(page, '7b');
}

/* ── 8. Opening a save chooses what previews ──────────────────────────── */
{
  const page = await open();
  await page.selectOption('#templateSelect', '2');
  await page.fill('#customText', 'Tagged {place} story.');
  await settle(page, 600);
  page.__answers.push('Plain');
  await page.click('#newStoryBtn');
  await page.fill('#customText', 'no blanks here');
  await settle(page, 600);
  ok(!/Tagged/.test(await page.$eval('#storyPreview', e => e.textContent)), '8: a save with no blank does not preview itself');
  const first = await page.$$eval('#storySelect option', os => os[0].value);
  await page.selectOption('#storySelect', first);
  await settle(page, 200);
  ok(/Tagged/.test(await page.$eval('#storyPreview', e => e.textContent)), '8: a save with a blank previews itself');
  await clean(page, '8');
}

/* ── 9. Keyboard and screen reader ────────────────────────────────────── */
{
  const page = await open();
  await page.fill('#customText', 'Key {noun}.');
  await settle(page, 600);
  await page.focus('#storySelect');
  const order = [];
  for (let i = 0; i < 5; i++) { order.push(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press('Tab'); }
  eq(order, ['storySelect', 'newStoryBtn', 'dupStoryBtn', 'renameStoryBtn', 'deleteStoryBtn'], '9: Tab reaches the chooser and the four buttons in order');
  eq(await page.$eval('#storyMsg', e => [e.getAttribute('role'), e.getAttribute('aria-live')]), ['status', 'polite'], '9: the status line is a polite live region');
  for (const id of ['newStoryBtn', 'dupStoryBtn', 'renameStoryBtn', 'deleteStoryBtn'])
    ok((await page.$eval('#' + id, e => e.textContent.trim())).length > 2, `9: ${id} has a text name`);
  page.__answers.push('Via keys');
  await page.focus('#newStoryBtn');
  await page.keyboard.press('Enter');
  await settle(page, 150);
  eq(await selectedName(page), 'Via keys', '9: + New works from the keyboard');
  await clean(page, '9');
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
