// smoke-adopters.mjs — "Load sample data" on the tools that open to an empty form (P15, BACKLOG rank 65).
//
//   node Tools/sample-data/test/smoke-adopters.mjs        (port 8623)
//
// For 059, 072, 049, 043, 042, 082, 038 and 084, each loading _shared/sample-data.js:
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
const store = (p) => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, k.indexOf('theme') >= 0 || k.indexOf('a11y') >= 0 ? '' : localStorage.getItem(k)])));

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
} finally {
  await browser.close(); server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
