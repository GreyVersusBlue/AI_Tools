// smoke-rubric.mjs — 047's optional teacher score (acw-rubric.js and the page).
//
//   node Tools/art-critique-worksheet-generator/test/smoke-rubric.mjs
//
// A critique worksheet may carry a score: a "Score ___ / 4" box on each step, a row of numbers to
// circle, a per-step point value (0 = unscored) and a total line at the bottom. What this holds down:
//
//   With the score off, a printed half sheet is byte-for-byte what the tool printed before the
//   score existed (the hash below was taken from the page before the change), and a saved
//   worksheet gains no field it did not have.
//   With it on, every step shows its own points, the total is the sum of them, an unscored step
//   shows no box, and what the teacher typed in a prompt is still escaped.
//   The score survives a reload, a duplicate and a share link; a link cannot smuggle a
//   bad value in. Exits 1 on any failure.

import { createHash } from 'node:crypto';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import '../acw-rubric.js';

const R = globalThis.CritiqueRubric;
const PORT = 8634;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '047-art-critique-worksheet-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Art Critique Worksheet Generator — teacher score');

/* ── pure ──────────────────────────────────────────────────────────────── */
eq(R.clean(null), null, 'no rubric is no score');
eq(R.clean({ on: false, points: 4 }), null, 'off is off');
eq(R.clean({ on: 'yes' }), null, 'only a real true switches it on');
eq(JSON.stringify(R.clean({ on: true })), '{"on":true,"points":4,"circle":true}', 'defaults: 4 points, numbers to circle');
eq(R.clean({ on: true, points: 7 }).points, 4, 'a point value that is not offered falls back to 4');
eq(R.clean({ on: true, points: '10' }).points, 10, 'a stored string is read');
eq(R.clean({ on: true, circle: false }).circle, false, 'circle can be turned off');
const rub = { on: true, points: 4, circle: true };
eq(R.pointsFor({}, rub), 4, 'a step with no value is worth the default');
eq(R.pointsFor({ points: 2 }, rub), 2, 'a step with its own value keeps it');
eq(R.pointsFor({ points: 0 }, rub), 0, 'zero leaves a step unscored');
eq(R.pointsFor({ points: 99 }, rub), 4, 'a value past the limit is the default');
eq(R.pointsFor({ points: 3 }, null), 0, 'with the score off nothing is worth anything');
eq(R.total([{}, { points: 2 }, { points: 0 }, {}], rub), 10, 'the total is the sum of the steps');
eq(R.total(null, rub), 0, 'no steps, no total');
eq(R.cleanStepPoints(''), undefined, 'an empty box means the default');
eq(R.cleanStepPoints('11'), undefined, 'eleven is too many');
eq(R.cleanStepPoints('-1'), undefined, 'negative is refused');
eq(R.cleanStepPoints('0'), 0, 'zero is kept');
eq(R.scoreBox(0, rub), null, 'an unscored step has no box');
eq(R.scoreBox(4, null), null, 'no box with the score off');
eq(JSON.stringify(R.scoreBox(4, rub).circles), '[1,2,3,4]', 'four points: numbers 1 to 4');
eq(R.scoreBox(10, rub).circles.length, 0, 'ten points: no row of numbers');
eq(R.scoreBox(3, { on: true, points: 4, circle: false }).circles.length, 0, 'circle off: no numbers');
eq(R.scoreBox(3, rub).of, '/ 3', 'the box says out of how many');
eq(R.totalLine([{ points: 0 }], rub), null, 'no total when nothing is scored');
eq(R.totalLine([{}, {}], rub).of, '/ 8', 'the total line says out of how many');

/* ── page ──────────────────────────────────────────────────────────────── */
const GOLDEN = '95b0e5ac9ea54a7360d2afa2a37de151be7c5b49754f41ee7fe10a9ea1abec13';   // the old page's printArea for WS, taken before this change
const WS = { name: 'Golden', activityName: 'Portrait Walk', copyCount: 2, mode: 'other', steps: [
  { key: 'describe', label: 'Describe', prompt: 'What do you see?', subs: [{ id: 'a', text: 'Colors?' }, { id: 'b', text: '' }] },
  { key: 'analyze', label: 'Analyze', prompt: 'How is it organized?', subs: [] },
  { key: 'judge', label: 'Judge', prompt: 'Is it <successful>?', subs: [{ id: 'c', text: 'Why & why not?' }] }] };

const server = await serve(PORT);
const browser = await launch();
async function open(ws = WS, url = '') {
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await page.addInitScript(w => {
    window.print = () => {};
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (!w) return;
    localStorage.setItem('acw_worksheets_list_v1', JSON.stringify([w.name]));
    localStorage.setItem('acw_worksheet_current_v1', w.name);
    localStorage.setItem('acw_worksheet_data_v1:' + w.name, JSON.stringify(w));
  }, ws);
  await page.goto(`${BASE}/Tools/${FILE}${url}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}
const printed = async page => { await page.click('#printBtn'); await settle(page, 100); return page.$eval('#printArea', e => e.innerHTML); };
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('acw_worksheet_data_v1:' + localStorage.getItem('acw_worksheet_current_v1'))));

let page = await open();
let html = await printed(page);
eq(createHash('sha256').update(html).digest('hex'), GOLDEN, 'with the score off the printed sheet is byte-for-byte the old one');
ok(!('rubric' in await stored(page)), 'and the saved worksheet has no rubric field');
ok(await page.isHidden('#rubricOpts'), 'the options stay hidden until the score is switched on');

await page.check('#rubricOn');
await settle(page, 150);
ok(await page.isVisible('#rubricPoints'), 'switching it on shows the options');
eq((await page.textContent('#rubricTotal')).trim(), 'The worksheet is worth 12 points.', 'three steps of four points: 12');
eq(await page.$$eval('.step-block .step-points input', e => e.length), 3, 'every step block has its own points box');
html = await printed(page);
eq((html.match(/class="hs-score"/g) || []).length, 2 * 3, 'every step of both copies has a score box');
eq((html.match(/Score ____ \/ 4/g) || []).length, 6, 'each reads Score ___ / 4');
eq((html.match(/class="hs-dot"/g) || []).length, 2 * 3 * 4, 'with a row of four numbers to circle');
ok(html.includes('Teacher total: ____ / 12'), 'and a total at the bottom');
ok(html.includes('Is it &lt;successful&gt;?') && html.includes('Why &amp; why not?'), 'the teacher’s prompts are still escaped');

// Per-step points: step 2 worth 2, step 3 unscored.
await page.fill('#pts-analyze', '2');
await page.fill('#pts-judge', '0');
await settle(page, 150);
eq((await page.textContent('#rubricTotal')).trim(), 'The worksheet is worth 6 points.', 'the total follows the steps');
html = await printed(page);
eq((html.match(/class="hs-score"/g) || []).length, 4, 'an unscored step has no box (2 copies x 2 steps)');
ok(html.includes('Score ____ / 2') && html.includes('Teacher total: ____ / 6'), 'the 2-point step and the 6-point total');
let st = await stored(page);
eq(JSON.stringify(st.steps.map(s => s.points)), '[null,2,0]', 'the step values are saved (undefined for the default)');

// A ten-point scale drops the numbers; circle can be turned off.
await page.selectOption('#rubricPoints', '10');
await page.fill('#pts-analyze', '');
await settle(page, 150);
html = await printed(page);
eq((html.match(/class="hs-dot"/g) || []).length, 0, 'ten points: no row of numbers');
await page.selectOption('#rubricPoints', '3');
await page.uncheck('#rubricCircle');
html = await printed(page);
eq((html.match(/class="hs-dot"/g) || []).length, 0, 'circle off: no numbers');
st = await stored(page);
eq(JSON.stringify(st.rubric), '{"on":true,"points":3,"circle":false}', 'the rubric is saved as a small object');

// Reload, duplicate, 360 px.
await page.reload({ waitUntil: 'load' }); await settle(page, 300);
ok(await page.isChecked('#rubricOn'), 'a reload still has the score on');
eq(await page.inputValue('#rubricPoints'), '3', 'at the points chosen');
await page.click('#duplicateWorksheetBtn'); await settle(page, 150);
eq((await stored(page)).rubric.points, 3, 'a duplicate keeps the score');
await page.setViewportSize({ width: 360, height: 800 }); await settle(page, 200);
eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'no sideways scroll at 360 px');
await page.setViewportSize({ width: 1200, height: 900 });

// Switching off drops the field and the sheet goes back.
await page.uncheck('#rubricOn'); await settle(page, 150);
ok(!('rubric' in await stored(page)), 'switching the score off removes the field');
await page.close();

// A share link: the score travels, bad values do not.
async function arrive(payload) {
  const p = await prepPage(browser, BASE, { width: 1200, height: 900 });
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  const link = await p.evaluate(async pl => {
    const enc = StateLink.encodeState(pl);
    return enc;
  }, payload);
  await p.close();
  return link;
}
const link = await arrive({ name: 'Shared', steps: [{ key: 'describe', label: 'Describe', prompt: 'p', subs: [], points: 3 }, { key: 'x', label: 'X', prompt: 'q', subs: [], points: 40 }], rubric: { on: true, points: 5, circle: true } });
if (link) {
  page = await open(null, `?worksheet=${encodeURIComponent(link)}`);
  const got = await stored(page);
  eq(JSON.stringify(got.rubric), '{"on":true,"points":5,"circle":true}', 'a shared worksheet brings its score');
  eq(JSON.stringify(got.steps.map(s => s.points)), '[3,null]', 'and its step values, with a wild one dropped');
  await page.close();
} else {
  ok(false, 'StateLink.encode was not available to build a link');
}

eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
