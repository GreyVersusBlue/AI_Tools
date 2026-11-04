// smoke-adopters.mjs — "Load sample data" on the tools that open to an empty form (P15, BACKLOG rank 65).
//
//   node Tools/sample-data/test/smoke-adopters.mjs        (port 8623)
//
// For 059, 072, 049, 043, 042, 082, 038, 084, 019 and 030, each loading _shared/sample-data.js:
//   1. on a clean device the bar shows its Load button, and just opening the page stores nothing
//      the tool did not already store (the page's own keys are the same before and after a reload
//      without a press);
//   2. a press fills the form (the tool's own handlers run, so what the tool stores is what typing
//      would have stored), swaps the button for the note and Clear;
//   3. Clear gives back the blank form and the Load button;
//   4. changing the sample takes the bar away (so Clear cannot delete the teacher's words);
//   5. a device that already holds work never shows the bar, so a press can never overwrite it;
//   6. the bar is not on paper (print media hides it).
// This proves the wiring, NOT that a teacher finds the sample useful. Exits 1 on any failure.
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
/* global ReviewBoardSample -- 030's rgb-sample.js, read inside page.evaluate() */

const PORT = 8623;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const TOOLS = [
  { id: '059', file: '059-experiment-design-planner.html', key: 'edp_planner_v1',
    seed: JSON.stringify({ title: 'My own experiment', question: '', hypIf: '', hypThen: '', hypBecause: '', varIndependent: '', varDependent: '',
      controlled: [{ id: 'a', text: '' }], materials: [{ id: 'b', text: '' }], procedure: [{ id: 'c', text: '' }] }),
    blank: async (p) => await p.inputValue('#expTitle') === '' && await p.inputValue('#question') === '',
    filled: async (p) => (await p.inputValue('#expTitle')).length > 10 && (await p.locator('#materialsWrap .list-row').count()) === 5,
    type: async (p) => p.fill('#expTitle', 'Typed over it') },
  { id: '072', file: '072-plot-diagram-builder.html', key: 'pdb_list_v1',
    seed: null,
    blank: async (p) => await p.inputValue('#storyTitle') === '' && await p.inputValue('[data-stage="climax"]') === '',
    filled: async (p) => (await p.inputValue('#storyTitle')).length > 5 && (await p.inputValue('[data-stage="climax"]')).length > 10,
    type: async (p) => p.fill('#storyTitle', 'Typed over it') },
  { id: '049', file: '049-book-tasting-menu-generator.html', key: 'btmg_books_v1',
    seed: JSON.stringify([{ id: 'mine', title: 'A book I added', author: '', genre: '', blurb: '', cover: null }]),
    blank: async (p) => (await p.textContent('#bookCount')) === '0',
    filled: async (p) => (await p.textContent('#bookCount')) === '6',
    type: async (p) => { await p.click('#booksWrap [data-del]'); } },  // the sample is the six books: changing the list ends the sample
  { id: '043', file: '043-field-trip-permission-slip.html',
    seed: { 'gvb-field-trip:list': '["Mine"]', 'gvb-field-trip:current': 'Mine',
      'gvb-field-trip:data:Mine': JSON.stringify({ name: 'Mine', destination: 'My own place', mode: 'single', collected: {}, chaperones: [], chaperoneAssignments: {} }) },
    blank: async (p) => await p.inputValue('#destination') === '' && await p.inputValue('#purpose') === '',
    filled: async (p) => (await p.inputValue('#destination')).length > 10 && (await p.inputValue('#dueDate')) === '2027-03-01',
    type: async (p) => p.fill('#destination', 'Typed over it') },
  { id: '042', file: '042-certificate-award-maker.html',
    seed: { 'gvb-certificate-maker:list': '["Mine"]', 'gvb-certificate-maker:current': 'Mine',
      'gvb-certificate-maker:data:Mine': JSON.stringify({ name: 'Mine', studentName: '', reason: 'My own reason', signature: '' }) },
    blank: async (p) => await p.inputValue('#reason') === '' && await p.inputValue('#signature') === '',
    filled: async (p) => (await p.inputValue('#reason')).length > 10 && (await p.inputValue('#studentName')) === 'Sample Student',
    type: async (p) => p.fill('#reason', 'Typed over it') },
  { id: '082', file: '082-citation-generator.html',
    seed: { 'citegen:list': '["Mine"]', 'citegen:current': 'Mine',
      'citegen:data:Mine': JSON.stringify({ name: 'Mine', style: 'mla', sources: [{ id: 'x1', type: 'book', fields: { author: 'Mine, A', title: 'My book', publisher: 'P', city: '', year: '2001' } }] }) },
    blank: async (p) => (await p.locator('#listWrap .entry').count()) === 0,
    filled: async (p) => (await p.locator('#listWrap .entry').count()) === 3,
    type: async (p) => { p.once('dialog', (d) => d.accept()); await p.click('#listWrap .entry button[data-act="delete"]'); } },
  { id: '038', file: '038-data-chart-builder.html',
    seed: null,
    blank: async (p) => await p.inputValue('#data-input') === '',
    filled: async (p) => (await p.inputValue('#data-input')).startsWith('Month') && await p.locator('#preview-table-wrap').isVisible(),
    type: async (p) => p.fill('#data-input', 'a\tb\n1\t2') },
  { id: '084', file: '084-socratic-seminar-prep-organizer.html',
    seed: { 'socsem:list': '["Mine"]', 'socsem:current': 'Mine',
      'socsem:data:Mine': JSON.stringify({ name: 'Mine', question: 'My own question?', source: '', date: '', roster: [], order: [], groups: {}, tallies: {} }) },
    blank: async (p) => await p.inputValue('#questionInput') === '' && await p.inputValue('#sourceInput') === '',
    filled: async (p) => (await p.inputValue('#questionInput')).length > 10 && (await p.inputValue('#dateInput')) === 'Friday, period 3',
    type: async (p) => p.fill('#questionInput', 'Typed over it') },
  { id: '019', file: '019-escape-room-builder.html', key: 'escape-room-builder:rooms',
    seed: JSON.stringify({ v: 1, data: { current: 'Mine', sets: { Mine: { name: 'Mine', roomId: 'abc123', storyIntro: '',
      stations: [{ clue: 'My own clue', answers: 'mine', hint: '', next: null, image: '', type: 'text' }] } } } }),
    blank: async (p) => (await p.locator('.station-card').count()) === 1 && await p.inputValue('.station-card .f-clue') === '' &&
      await p.inputValue('#storyIntro') === '',
    filled: async (p) => (await p.locator('.station-card').count()) === 5 && (await p.inputValue('#setName')).startsWith('Sample room') &&
      (await p.inputValue('#storyIntro')).length > 40,
    type: async (p) => p.fill('.station-card .f-hint', 'My own hint') },
  { id: '030', file: '030-review-game-board.html', key: 'gvb-review-board:list',
    seed: { 'gvb-review-board:list': '["Mine"]', 'gvb-review-board:current': 'Mine',
      'gvb-review-board:data:Mine': JSON.stringify({ name: 'Mine', categories: [{ name: 'Mine', clues: [{ points: 100, question: 'My own question?', answer: 'Mine', used: false }] }],
        teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }] }) },
    blank: async (p) => await p.inputValue('#boardName') === '' && (await p.locator('#categoriesEditor .category-block').count()) === 1 &&
      await p.inputValue('#categoriesEditor .cat-name-input') === '',
    filled: async (p) => (await p.inputValue('#boardName')).startsWith('Sample board') &&
      (await p.locator('#categoriesEditor .category-block').count()) === 3 && (await p.locator('#categoriesEditor .clue-row').count()) === 15,
    type: async (p) => p.fill('#categoriesEditor .clue-answer >> nth=0', 'Typed over it') },
];

const server = await serve(PORT);
const browser = await launch();
const open = async (t, seed, hook) => {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  const seeds = !seed ? null : typeof seed === 'string' ? { [t.key]: seed } : seed;
  if (seeds) await page.addInitScript((kv) => { if (!localStorage.getItem('__seeded')) { for (const k in kv) localStorage.setItem(k, kv[k]); localStorage.setItem('__seeded', '1'); } }, seeds);
  await page.goto(`${BASE}/Tools/${t.file}`);
  await settle(page, 300);
  if (hook) await hook(page);
  return page;
};
const vis = (p, sel) => p.locator(sel).first().isVisible();
const LOAD = '.sample-bar button:first-child', CLEAR = '.sample-bar button:last-child', NOTE = '.sample-bar [role=status]';
// Values are compared with their object keys sorted: 019 writes a new room's station with its id last and
// rewrites it id-first on the next load, the same record in another key order (not a change of content).
const store = (p) => p.evaluate(() => {
  const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {}) : v;
  const val = (k) => { const raw = localStorage.getItem(k); try { return JSON.stringify(canon(JSON.parse(raw))); } catch (e) { return raw; } };
  return JSON.stringify(Object.keys(localStorage).sort().map(k => [k, k.indexOf('theme') >= 0 || k.indexOf('a11y') >= 0 ? '' : val(k)]));
});

try {
  for (const t of TOOLS) {
    console.log(`${t.id} ${t.file}`);
    // 1-4: a clean device
    let p = await open(t);
    ok(await vis(p, LOAD), `${t.id}: Load button shows on an empty tool`);
    ok(!(await vis(p, CLEAR)), `${t.id}: Clear is not shown before a press`);
    const before = await store(p);
    await p.reload(); await settle(p, 300);
    eq(await store(p), before, `${t.id}: opening the page twice without a press changes nothing it stores`);
    ok(await t.blank(p), `${t.id}: the form is blank before a press`);

    await p.click(LOAD); await settle(p, 300);
    ok(await t.filled(p), `${t.id}: a press fills the form`);
    ok(!(await vis(p, LOAD)) && await vis(p, NOTE) && await vis(p, CLEAR), `${t.id}: note and Clear replace the button`);
    ok(/made up/i.test(await p.textContent(NOTE)), `${t.id}: the note says it is made up`);

    await p.emulateMedia({ media: 'print' });
    ok(!(await vis(p, '.sample-bar')), `${t.id}: the bar is not printed`);
    await p.emulateMedia({ media: 'screen' });

    await p.click(CLEAR); await settle(p, 300);
    ok(await t.blank(p), `${t.id}: Clear gives back the blank form`);
    ok(await vis(p, LOAD) && !(await vis(p, CLEAR)), `${t.id}: the Load button is back after Clear`);

    await p.click(LOAD); await settle(p, 300);
    await t.type(p); await settle(p, 200);
    ok(!(await vis(p, '.sample-bar')), `${t.id}: changing the sample takes the bar away`);
    await p.context().close();

    // 5: a device that already holds work
    if (t.seed) {
      p = await open(t, t.seed);
      ok(!(await vis(p, '.sample-bar')), `${t.id}: no bar when the device already holds work`);
      await p.context().close();
    }
  }
  // 072 holds work by typing, not by a seed: type first, then reload
  {
    const t = TOOLS[1];
    const p = await open(t);
    await p.fill('#storyTitle', 'My own story'); await settle(p, 200);
    await p.reload(); await settle(p, 300);
    ok(!(await vis(p, '.sample-bar')), '072: no bar once a diagram has a title');
    eq(await p.inputValue('#storyTitle'), 'My own story', '072: and the title is still there');
    await p.context().close();
  }
  // 019: the page's own checks pass on the sample, and the test run finishes it
  {
    const t = TOOLS.find((x) => x.id === '019');
    const p = await open(t);
    await p.click(LOAD); await settle(p, 600);
    eq(await p.textContent('#previewNote'), '5 stations ready.', '019: the page counts five playable stations');
    eq(await p.locator('#cards-preview canvas').count(), 5, '019: a code is drawn for each');
    eq((await p.textContent('#msg')).trim(), '', '019: no warning (no code over budget, no missing picture)');
    ok(!(await p.isDisabled('#printCodesBtn')) && !(await p.isDisabled('#printAnswersBtn')) && !(await p.isDisabled('#printPacketBtn')) &&
      !(await p.isDisabled('#testRunBtn')), '019: every print button and the test run are on');
    eq(await p.locator('.digit-warn:visible').count(), 0, '019: no digit-length warning');
    const rooms = await p.evaluate(() => JSON.parse(localStorage.getItem('escape-room-builder:rooms')));
    const sets = (rooms.data || rooms).sets;
    eq(Object.keys(sets), [await p.inputValue('#setName')], '019: the blank room was renamed, not a second room made');
    // walk it: the test run uses the students' payload and matcher
    await p.click('#testRunBtn'); await settle(p, 200);
    for (const a of ['0.75', '20', 'check the lamp room', 'evaporation', 'lamp']) {
      await p.fill('#trAnswer', a);
      await p.keyboard.press('Enter'); await settle(p, 700);
    }
    eq(await p.textContent('#testRunStep'), 'Finished', '019: the test run reaches the end with the sample\'s answers');
    eq(await p.locator('#testRunBody .tr-trace li').count(), 5, '019: by way of all five stations');
    ok(await p.locator('#testRunBody .tr-ok').count() === 1, '019: and says every station is reachable');
    await p.keyboard.press('Escape'); await settle(p, 200);
    // Clear gives the room its old name back
    await p.click(CLEAR); await settle(p, 300);
    eq(await p.inputValue('#setName'), 'New Escape Room', '019: Clear gives the room its old name back');
    const after = await p.evaluate(() => JSON.parse(localStorage.getItem('escape-room-builder:rooms')));
    eq(Object.keys((after.data || after).sets), ['New Escape Room'], '019: and leaves one room');
    await p.context().close();
  }
  // 030: nothing stored until Save board; Save stores the sample as it is
  {
    const t = TOOLS.find((x) => x.id === '030');
    const p = await open(t);
    const before = await store(p);
    await p.click(LOAD); await settle(p, 300);
    eq(await store(p), before, '030: a press stores nothing');
    const want = await p.evaluate(() => ReviewBoardSample.categories());
    const name = await p.evaluate(() => ReviewBoardSample.name);
    await p.click('#buildFromManualBtn'); await settle(p, 400);
    ok(!(await vis(p, '.sample-bar')), '030: Save board ends the sample');
    eq(await p.locator('#boardCols button.cell:not(.blank)').count(), 15, '030: the board shows fifteen clues');
    const saved = await p.evaluate((n) => JSON.parse(localStorage.getItem('gvb-review-board:data:' + n)), name);
    const strip = (cats) => cats.map((c) => ({ name: c.name, clues: c.clues.map((cl) => ({ points: cl.points, question: cl.question, answer: cl.answer })) }));
    eq(strip(saved.categories), want, '030: the stored board is the sample, every clue in order');
    eq(saved.teams.map((x) => x.name), ['Team 1', 'Team 2'], '030: with the page\'s default teams');
    await p.reload(); await settle(p, 400);
    ok(!(await vis(p, '.sample-bar')), '030: after a reload the saved board holds the device, so no bar');
    eq(await p.textContent('#boardTitle'), name, '030: and the board opens');
    await p.context().close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
