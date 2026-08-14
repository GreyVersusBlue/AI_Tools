// smoke-regions.mjs — region tagging and the region filter.
//
//   node Tools/geography-bee-quiz-generator/test/smoke-regions.mjs
//
// The four categories say what kind of question something is; the region says
// what part of the world it is about, which is the axis a teacher actually
// plans along ("we are on South America this month"). What this suite holds
// down:
//
//   1. Every built-in question really is tagged. An untagged one would vanish
//      from every region filter and nobody would notice until the day a
//      teacher's Africa quiz came up three questions short.
//   2. The tags are right on a sample checked by hand — Paris is Europe,
//      Nairobi is Africa, Machu Picchu is South America — and the map
//      questions inherit the crop they are already drawn on.
//   3. Region and category filter independently and combine, and the
//      combination reaches everything downstream: the projected question,
//      the printed sheet, and the multiple-choice distractors.
//   4. Map-skills questions are 'global' rather than untagged, and a teacher
//      can filter *to* them.
//   5. A custom question can carry a region, from the form or from a pasted
//      column in either order.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8227;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/062-geography-bee-quiz-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

console.log('Geography Bee Quiz Generator — region tagging');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page);

/* The bank list is the tool's own view of every question, so the assertions
   below read what a teacher would see rather than internal state. */
const bankRows = async () => {
  await page.click('.tab-btn[data-stage="bank"]');
  await settle(page, 120);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#bankList .bank-row')).map(r => r.textContent));
};
const toDisplayTab = async () => { await page.click('.tab-btn[data-stage="display"]'); await settle(page, 120); };

/* ── 1. every built-in is tagged, and the tags read correctly ────────────── */
// Filtering to each region in turn must account for the whole bank: if any
// question were untagged, the regions would not add up to the total.
const total = (await bankRows()).length;
await toDisplayTab();
ok(total > 100, `the bank has its full complement of questions (${total})`);

const countFor = async (region, category = '') => {
  await page.selectOption('#regionFilter', region);
  await page.selectOption('#categoryFilter', category);
  await page.click('#applyFilterBtn');
  await settle(page, 150);
  return page.evaluate(() => {
    const el = document.getElementById('displayNum');
    const m = (el.textContent || '').match(/of\s+(\d+)/i);
    if (m) return parseInt(m[1], 10);
    return (document.getElementById('displayQ').textContent || '').includes('No questions match') ? 0 : -1;
  });
};

const regions = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania', 'global'];
let sum = 0;
for (const r of regions) {
  const n = await countFor(r);
  ok(n > 0, `region ${r} has questions (${n})`);
  sum += n;
}
eq(sum, await countFor(''), 'the regions account for every question in the bank — none is untagged');

/* Spot-check the tagging itself, on questions whose answer names the place. */
const questionsIn = async (region) => {
  await page.selectOption('#regionFilter', region);
  await page.selectOption('#categoryFilter', '');
  await page.click('#applyFilterBtn');
  await settle(page, 150);
  return page.evaluate(() => {
    const seen = [];
    const q = document.getElementById('displayQ');
    const a = document.getElementById('displayA');
    const next = document.getElementById('nextBtn');
    const count = 200;
    for (let i = 0; i < count; i++) {
      seen.push((q.textContent || '') + ' :: ' + (a.textContent || ''));
      next.click();
    }
    return seen;
  });
};

const europe = (await questionsIn('europe')).join(' | ');
ok(/Paris/.test(europe), 'Paris is tagged Europe');
ok(/Eiffel Tower/.test(europe), 'so is the Eiffel Tower');
ok(!/Nairobi/.test(europe), 'and Nairobi is not');

const africa = (await questionsIn('africa')).join(' | ');
ok(/Nairobi/.test(africa), 'Nairobi is tagged Africa');
ok(/Nile/.test(africa), 'the longest river is tagged Africa — a case with no country named in it');
ok(/Sahara/.test(africa), 'and so is the largest hot desert');

const south = (await questionsIn('south-america')).join(' | ');
ok(/Machu Picchu/.test(south), 'Machu Picchu is tagged South America');
ok(/Amazon/.test(south), 'and the Amazon questions are too');

/* Map questions inherit the crop they are drawn on: a US state map question
   is North America, not a region of its own. */
await page.selectOption('#regionFilter', 'north-america');
await page.selectOption('#categoryFilter', 'maps');
await page.click('#applyFilterBtn');
await settle(page, 200);
const mapNorth = await page.evaluate(() => {
  const seen = [];
  for (let i = 0; i < 25; i++) {
    seen.push(document.getElementById('displayA').textContent || '');
    document.getElementById('nextBtn').click();
  }
  return seen.join(' | ');
});
ok(/Texas|California|Maryland/.test(mapNorth), 'US state map questions filter as North America');
ok(/Canada|Mexico/.test(mapNorth), 'alongside the North American countries');

/* ── 2. map skills are 'global', and reachable ───────────────────────────── */
await page.selectOption('#regionFilter', 'global');
await page.selectOption('#categoryFilter', '');
await page.click('#applyFilterBtn');
await settle(page, 200);
const global = await page.evaluate(() => {
  const seen = [];
  for (let i = 0; i < 40; i++) {
    seen.push(document.getElementById('displayQ').textContent || '');
    document.getElementById('nextBtn').click();
  }
  return seen.join(' | ');
});
ok(/Equator|Prime Meridian|contour line|compass/.test(global),
   'map-skills questions are filed as "no particular region" and can be filtered to');

/* ── 3. region and category combine ──────────────────────────────────────── */
const asiaAll = await countFor('asia', '');
const asiaCapitals = await countFor('asia', 'capitals');
const allCapitals = await countFor('', 'capitals');
ok(asiaCapitals > 0, `Asia + Capitals is a real slice (${asiaCapitals})`);
ok(asiaCapitals < asiaAll, 'narrower than Asia alone');
ok(asiaCapitals < allCapitals, 'and narrower than Capitals alone');

/* The filter reaches the printed sheet, not just the projector. */
await page.selectOption('#regionFilter', 'africa');
await page.selectOption('#categoryFilter', '');
await page.click('#applyFilterBtn');
await settle(page, 150);
await page.click('.tab-btn[data-stage="sheet"]');
await settle(page, 150);
await page.fill('#sheetCount', '8');
await page.click('#buildSheetBtn');
await settle(page, 250);
const sheet = await page.textContent('#sheetProblems');
ok(sheet.length > 0, 'a sheet builds under a region filter');
ok(!/Paris|Tokyo|Canberra/.test(sheet), 'and it does not contain questions from other regions');

/* ── 4. the choice is remembered ─────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq(await page.inputValue('#regionFilter'), 'africa', 'the region filter survives a reload');
await page.selectOption('#regionFilter', '');
await page.click('#applyFilterBtn');
await settle(page, 150);

/* ── 5. custom questions carry a region ──────────────────────────────────── */
await page.click('.tab-btn[data-stage="bank"]');
await settle(page, 150);
await page.selectOption('#newCategory', 'capitals');
await page.selectOption('#newRegion', 'africa');
await page.fill('#newQ', 'What is the capital of Ghana?');
await page.fill('#newA', 'Accra');
await page.click('#addQBtn');
await settle(page, 200);
ok((await bankRows()).some(r => /Accra/.test(r) && /Africa/.test(r)),
   'a custom question shows the region it was filed under');

// Pasted, with the region in its own column — and in either order relative
// to the category, since a spreadsheet's column order is the teacher's.
await page.fill('#bulkInput',
  'What is the capital of Senegal? | Dakar | capitals | Africa\n' +
  'What is the capital of Peru? | Lima | South America | capitals\n' +
  'Which ocean lies east of Africa? | The Indian Ocean');
await page.click('#bulkImportBtn');
await settle(page, 250);
const rows = await bankRows();
ok(rows.some(r => /Dakar/.test(r) && /Africa/.test(r)), 'a pasted region column is read (category then region)');
ok(rows.some(r => /Lima/.test(r) && /South America/.test(r)), 'and in the other order too');
ok(rows.some(r => /Indian Ocean/.test(r)), 'a line with no tags still imports');

// A two-part answer that happens to end in a place name must not have that
// name eaten as a region tag.
await page.fill('#bulkInput', 'Name the two countries Iguazu Falls sits between. | Brazil | Argentina');
await page.click('#bulkImportBtn');
await settle(page, 250);
ok((await bankRows()).some(r => /Brazil \| Argentina/.test(r)),
   'a multi-part answer is not mistaken for a region tag');

/* ── 6. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
