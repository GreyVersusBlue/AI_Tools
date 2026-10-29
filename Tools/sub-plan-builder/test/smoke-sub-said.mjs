// smoke-sub-said.mjs — 044 keeps a typed note per day out, "what the sub said" (Path 10 P5).
//
//   node Tools/sub-plan-builder/test/smoke-sub-said.mjs   (or: npm run test:sub-plan-said; port 8601)
//
// What this pins:
//   - the card lists the days out and a typed note is saved under subPlanBuilder.subSaid.v1 as { v: 1, notes: { date: text } }
//   - the note is back after a reload, on its own day; another day is empty; a day with a note is marked ✓
//   - clearing the box removes the day; the stored text is capped at 2,000 characters
//   - only the newest 60 dates are kept
//   - the note is in none of: the plain-text copy, the share link's payload, the saved history; a broken stored value is ignored
//   - axe finds nothing serious with the card open
// Exits 1 on any failure.

import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
void SITE;

const PORT = 8601;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '044-Sub%20Plan%20Builder.html';
const KEY = 'subPlanBuilder.subSaid.v1';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

async function open(browser, seedRaw, reuse) {
  const page = reuse || await prepPage(browser, BASE, { width: 1100, height: 1100 });
  if (!reuse) {
    await page.addInitScript(([seedRaw]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      if (seedRaw !== null) localStorage.setItem('subPlanBuilder.subSaid.v1', seedRaw);
    }, [seedRaw]);
  }
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  await page.fill('#planDate', '2026-11-02');
  await page.fill('#numDays', '3');
  await page.evaluate(() => document.getElementById('subSaidCard').setAttribute('open', ''));
  await settle(page, 200);
  return page;
}
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

console.log('044 — what the sub said');
const server = await serve(PORT);
const browser = await launch();
try {
  {
    const page = await open(browser, null);
    const opts = await page.$$eval('#subSaidDay option', o => o.map(x => x.value));
    eq(opts.join(), '2026-11-02,2026-11-03,2026-11-04', 'the card lists the three days out');
    await page.fill('#subSaidText', 'Period 3 finished early; <b>video</b> link failed.');
    await settle(page, 100);
    const s = await stored(page);
    eq(s && s.v, 1, 'stored with v 1');
    eq(s && s.notes['2026-11-02'], 'Period 3 finished early; <b>video</b> link failed.', 'the note is stored under its date');
    ok((await page.$eval('#subSaidDay option', o => o.textContent)).includes('✓'), 'the day is marked ✓');

    await page.selectOption('#subSaidDay', '2026-11-03');
    eq(await page.inputValue('#subSaidText'), '', 'another day starts empty');
    await page.fill('#subSaidText', 'Quiet day.');
    await page.selectOption('#subSaidDay', '2026-11-02');
    eq(await page.inputValue('#subSaidText'), 'Period 3 finished early; <b>video</b> link failed.', 'switching back shows the first note');

    // out of every other output
    await page.click('#btnQuickCopy');
    const text = await page.inputValue('#qcText');
    ok(!text.includes('video') && !text.includes('Quiet day'), 'the note is not in the plain-text copy');
    await page.click('#qcClose');
    ok(!(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'subPlanBuilder.subSaid.v1').some(k => localStorage.getItem(k).includes('finished early')))), 'the note is in no other stored key');
    const shareSrc = await page.evaluate(() => document.getElementById('shareCard').textContent);
    ok(!shareSrc.includes('finished early'), 'the share card does not show the note');

    const bad = await a11yScan(page);
    ok(!bad || bad.length === 0, 'axe finds nothing serious ' + JSON.stringify(bad));

    // reload keeps it
    await open(browser, null, page);
    const again = await stored(page);
    eq(Object.keys(again.notes).join(), '2026-11-02,2026-11-03', 'both notes survive a reload');
    eq(await page.inputValue('#subSaidText'), 'Period 3 finished early; <b>video</b> link failed.', 'the first day shows its note after a reload');

    await page.fill('#subSaidText', '');
    eq(Object.keys((await stored(page)).notes).join(), '2026-11-03', 'clearing the box removes that day');
    await page.fill('#subSaidText', 'x'.repeat(2500));
    eq((await stored(page)).notes['2026-11-02'].length, 2000, 'the box and the stored text stop at 2,000 characters');
    await page.close();
  }
  {
    const many = {};
    for (let i = 0; i < 70; i++) many[`2026-0${1 + (i % 9)}-${String(1 + Math.floor(i / 9)).padStart(2, '0')}`] = 'n' + i;
    const page = await open(browser, JSON.stringify({ v: 1, notes: many }));
    await page.fill('#subSaidText', 'new');
    const keys = Object.keys((await stored(page)).notes);
    ok(keys.length <= 60 && keys.includes('2026-11-02'), 'at most the newest 60 dates are kept, and the new one is among them (' + keys.length + ')');
    await page.close();
  }
  for (const raw of ['not json', '[1,2]', '{"v":1,"notes":"x"}', '{"v":1,"notes":{"bad-date":"x","2026-11-02":7}}']) {
    const page = await open(browser, raw);
    eq(await page.inputValue('#subSaidText'), '', 'a broken stored value is ignored: ' + raw);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
