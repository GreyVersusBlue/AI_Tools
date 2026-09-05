// smoke-storage.mjs — 063's two keys after they moved onto _shared/store.js.
//
//   node Tools/grammar-mad-libs/test/smoke-storage.mjs
//
// 063 was the site's third storage era: a per-tag word-bank map written as a
// bare object, and a custom story written as `{v: 1, text: "..."}` — a version
// stamp nothing ever dispatched on, and the reason this tool was named in the
// store.js row at all. Both keys now go through Store, which reads that story
// payload as LEGACY VERSION 0, because rule 1 wants a numeric `v` AND an own
// `data` property and this shape only has the first. Getting that wrong loses a
// teacher's story silently — the textarea just comes up empty — so the first
// two sections put a pre-adoption payload on disk and read it back out of the
// rendered page rather than out of a return value.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8413;
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

console.log('Grammar Mad Libs — the two keys on _shared/store.js');

const server = await serve(PORT);
const browser = await launch();

/* ── 1. The pre-adoption payloads still load ─────────────────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(([storyKey, banksKey]) => {
    // byte for byte what 063 wrote before the adoption
    localStorage.setItem(storyKey, JSON.stringify({ v: 1, text: 'The {adjective} {animal} sang.' }));
    localStorage.setItem(banksKey, JSON.stringify({ animal: ['axolotl', 'pangolin'] }));
  }, [STORY_KEY, BANKS_KEY]);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  const story = await page.$eval('#customText', el => el.value);
  eq(story, 'The {adjective} {animal} sang.', '1: the legacy {v:1, text} story is in the textarea');

  await page.selectOption('#bankTagSelect', 'animal');
  await settle(page, 150);
  const words = await page.$eval('#bankWordsInput', el => el.value);
  ok(/axolotl/.test(words) && /pangolin/.test(words),
    '1: the legacy bank override is in the editor: ' + JSON.stringify(words));

  // a read alone must not rewrite either payload — rule 4
  const onDisk = await page.evaluate(([s, b]) => ({
    story: JSON.parse(localStorage.getItem(s)),
    banks: JSON.parse(localStorage.getItem(b)),
  }), [STORY_KEY, BANKS_KEY]);
  eq(onDisk.story, { v: 1, text: 'The {adjective} {animal} sang.' }, '1: reading did not rewrite the story');
  eq(onDisk.banks, { animal: ['axolotl', 'pangolin'] }, '1: nor the banks');

  eq(page.__errs.length, 0, '1: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, '1: nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.context().close();
}

/* ── 2. The next write is an envelope, and it round-trips ────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(([storyKey]) => {
    localStorage.setItem(storyKey, JSON.stringify({ v: 1, text: 'old story' }));
  }, [STORY_KEY]);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  await page.fill('#customText', 'A {adjective} {food} rolled downhill.');
  await settle(page, 600);                 // the 300 ms debounce, with room

  const wrapped = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), STORY_KEY);
  eq(wrapped.v, 1, '2: the write stamps a Store envelope');
  eq(wrapped.data, 'A {adjective} {food} rolled downhill.', '2: the story is the envelope payload, not a {text} blob');

  // and it comes back on the next visit, which is the whole point
  const second = await page.context().newPage();
  await second.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(second, 250);
  eq(await second.$eval('#customText', el => el.value), 'A {adjective} {food} rolled downhill.',
    '2: an enveloped story loads on the next visit');
  await page.context().close();
}

/* ── 3. A bank edit round-trips through the envelope too ─────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  await page.selectOption('#bankTagSelect', 'food');
  await page.fill('#bankWordsInput', 'tteokbokki, injera, pierogi');
  await settle(page, 600);

  const banks = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), BANKS_KEY);
  eq(banks.v, 1, '3: the bank map is enveloped');
  eq(banks.data.food, ['tteokbokki', 'injera', 'pierogi'], '3: with the teacher\'s words inside it');

  const second = await page.context().newPage();
  await second.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(second, 250);
  await second.selectOption('#bankTagSelect', 'food');
  await settle(second, 150);
  ok(/tteokbokki/.test(await second.$eval('#bankWordsInput', el => el.value)),
    '3: and it is there on the next visit');

  eq(page.__errs.length, 0, '3: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  await page.context().close();
}

/* ── 4. Junk on disk falls back rather than throwing ─────────────────── */
{
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(([storyKey, banksKey]) => {
    localStorage.setItem(storyKey, '{not json at all');
    localStorage.setItem(banksKey, '["a bank map is not an array"]');
  }, [STORY_KEY, BANKS_KEY]);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await settle(page, 250);

  eq(await page.$eval('#customText', el => el.value), '', '4: an unparsable story leaves the textarea empty');
  await page.selectOption('#bankTagSelect', 'animal');
  await settle(page, 150);
  eq(await page.$eval('#bankWordsInput', el => el.value), '',
    '4: an array where a bank map belongs is refused, so no tag is overridden');
  ok(await page.$eval('#storyPreview', el => (el.textContent || '').length > 0),
    '4: and the tool still rendered a story');

  eq(page.__errs.length, 0, '4: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  await page.context().close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
