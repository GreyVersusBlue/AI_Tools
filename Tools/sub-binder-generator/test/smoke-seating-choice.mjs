// smoke-seating-choice.mjs — 045 prints the seating chart the teacher picked.
//
//   node Tools/sub-binder-generator/test/smoke-seating-choice.mjs   (npm run test:sub-binder-seating; port 8664)
//
// The section select used to put itself back to the chart 005 had open on every re-render, its own change
// included, so a second period could be looked at for no time and never printed. Held here:
//   - picking a section shows it and the select keeps it
//   - the printed packet has that section's chart, and only that one
//   - it survives a reload (saved beside the ticked sections, no new key)
//   - "every section" is remembered and prints all of them
//   - a saved section 005 no longer has falls back to the open chart, with no error
//   - the ticked sections still behave as before (one stored object, nothing else added when untouched)
//
// Made-up names only. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8664;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/045-sub-binder-generator.html';
const KEY = 'gvb-sub-binder:included-sections.v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const sec = (id, name, who) => ({ id, name, students: [{ id: 'x' + id, name: who }], desks: [{ id: 'd' + id, x: 0, y: 0, rot: 0 }], assign: { ['d' + id]: 'x' + id } });
const SEATING = { active: 's1', sections: [sec('s1', 'Period 1', 'Ann Lee'), sec('s2', 'Period 2', 'Eve Fox'), sec('s3', 'Period 3', 'Gus Hall')] };

async function open(browser, local) {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(([seating, extra]) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('seating-chart-v1', seating);
      Object.keys(extra).forEach(k => localStorage.setItem(k, extra[k]));
      localStorage.setItem('__seeded', '1');
    }
    window.print = () => {};
  }, [JSON.stringify(SEATING), local || {}]);
  await page.goto(URL_PAGE, { waitUntil: 'load' });
  await settle(page, 300);
  page.errors = errors;
  return page;
}

const shown = page => page.evaluate(() => ({ v: document.getElementById('seatingSelect').value, t: document.getElementById('seatingBody').textContent }));
const packet = async page => {
  await page.click('#printBtn').catch(() => {});
  await settle(page, 200);
  return page.evaluate(() => (document.getElementById('printArea') || document.body).textContent);
};

const server = await serve(PORT);
const browser = await launch();
try {
  const page = await open(browser);
  try {
    let s = await shown(page);
    eq(s.v, 's1', 'first visit: the chart 005 had open');
    await page.selectOption('#seatingSelect', 's2');
    await settle(page, 150);
    s = await shown(page);
    eq(s.v, 's2', 'picking Period 2 keeps it picked');
    ok(/Eve Fox/.test(s.t) && !/Ann Lee/.test(s.t), 'and the card shows Period 2');
    const out = await packet(page);
    ok(/Eve Fox/.test(out) && !/Ann Lee/.test(out) && !/Gus Hall/.test(out), 'the printed packet has Period 2 only');
    eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k), KEY)).seatingSection, 's2', 'the choice is saved with the ticked sections');
    await page.reload({ waitUntil: 'load' }); await settle(page, 300);
    eq((await shown(page)).v, 's2', 'a reload keeps it');
    await page.check('#combineSections');
    await page.reload({ waitUntil: 'load' }); await settle(page, 300);
    eq(await page.isChecked('#combineSections'), true, 'every section: remembered across a reload');
    const all = await packet(page);
    ok(/Ann Lee/.test(all) && /Eve Fox/.test(all) && /Gus Hall/.test(all), 'and prints all three charts');
    eq(page.errors.length, 0, 'no page error: ' + page.errors.join(';'));
  } finally { await page.context().close(); }

  const stale = await open(browser, { [KEY]: JSON.stringify({ seatingSection: 'gone', seatingAll: false }) });
  try {
    eq((await shown(stale)).v, 's1', 'a saved section 005 no longer has: the open chart');
    eq(stale.errors.length, 0, 'with no error');
  } finally { await stale.context().close(); }

  const fresh = await open(browser);
  try {
    await fresh.selectOption('#seatingSelect', 's3'); await settle(fresh, 100);
    ok(/Gus Hall/.test((await shown(fresh)).t), 'a third section can be picked');
    eq(Object.keys(JSON.parse(await fresh.evaluate(k => localStorage.getItem(k), KEY))).join(), 'seatingSection', 'only the choice was added to the stored object');
  } finally { await fresh.context().close(); }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
