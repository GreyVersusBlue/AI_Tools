// smoke-scenarios.mjs — the Final Grade Checker's scenario panel (drop, curve,
// re-weight, named scenarios), in a browser.
//
//   node Tools/final-grade-checker/test/smoke-scenarios.mjs            run
//   node Tools/final-grade-checker/test/smoke-scenarios.mjs --record   re-record golden-old-page.json
//                                                                      (only ever from a page that has no scenario code)
//
// scenario-math.test.mjs proves the arithmetic against an exact-fraction oracle.
// This is the half a pure test cannot see:
//
//   1. A gradebook computes exactly what it did: 12 fingerprints of the cards,
//      triage and old what-if under four settings, and the one stored string,
//      equal to what the page produced before this panel existed.
//   2. A scenario is a QUESTION: the cards, the paste, and everything in
//      localStorage are byte for byte the same after every scenario action.
//   3. The page shows what the math says, and says its rules in words.
//
// Every name is invented. Exits 1 on any failure.

import fs from 'node:fs';
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import { recordPage } from './_golden-page.mjs';

const PORT = 8528;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/036-final_grade_checker.html';
const GOLDEN = new URL('./golden-old-page.json', import.meta.url);

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1000 });
let dialogs = [];
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

if (process.argv.includes('--record')) {
  const g = await recordPage(page, URL_PAGE);
  fs.writeFileSync(GOLDEN, JSON.stringify(g, null, 1) + '\n');
  console.log('recorded', g.grid.length, 'fingerprints');
  await browser.close(); server.close(); process.exit(0);
}

console.log('Final Grade Checker: scenarios');

// ── 1. the old page, pinned ─────────────────────────────────────────────────
{
  const gold = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const now = await recordPage(page, URL_PAGE);
  gold.grid.forEach((g, i) => eq(now.grid[i], g, `cards, triage and what-if for paste ${g.p} under settings ${g.s} are as before`));
  gold.whatif.forEach((g, i) => eq(now.whatif[i], g, `the quick what-if (${g.plus}, drop ${g.drop}) answers as before`));
  eq(now.stored, gold.stored, 'the one stored string is byte for byte what it was (no scenario key when none is saved)');
}

// ── helpers ─────────────────────────────────────────────────────────────────
const PASTE = [
  '10001\tLovelace, Ada\t03\t07\tB(89.00)\tB(89.00)\tB(89.00)\tB(89.00)\t89.00',
  '10002\tPolo, Marco\t03\t07\tC(79.00)\tC(79.00)\tC(79.00)\tC(79.00)\t79.00',
  '10003\tHopper, Grace\t03\t07\tA(95.00)\tA(95.00)\tA(95.00)\tF(40.00)\t81.25',
  '10004\tHe, Zheng\t03\t07\tB(88.00)\tB(85.00)\tB(84.00)\t\t',
].join('\n');

const fresh = async () => {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 200);
};
const load = async text => { await page.fill('#import-area', text); await page.click('#import-btn'); await settle(page, 300); };
const realState = () => page.evaluate(() => ({
  cards: Array.from(document.querySelectorAll('#students-container .student-card')).map(c => ({
    name: (c.querySelector('.name-readonly') || {}).textContent,
    q: Array.from(c.querySelectorAll('.grade-readonly')).map(n => n.textContent),
    f: (c.querySelector('.final-letter') || {}).textContent,
  })),
  paste: document.getElementById('import-area').value,
  store: Object.entries(localStorage).sort(),
  help: document.getElementById('students-container').innerHTML,
}));
const set = async (sel, v) => { await page.selectOption(sel, v); await settle(page, 150); };
const type = async (sel, v) => { await page.fill(sel, v); await page.dispatchEvent(sel, 'input'); await settle(page, 150); };
const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#sc-table tbody tr')).map(tr =>
  Array.from(tr.children).map(c => c.textContent.trim())));
const text = id => page.evaluate(i => document.getElementById(i).textContent.replace(/\s+/g, ' ').trim(), id);
const clear = async () => { await page.click('#sc-clear-btn'); await settle(page, 150); };

await fresh();
eq(await page.isVisible('#scenario-card'), false, 'the scenario card is hidden until there is a class');
await load(PASTE);
eq(await page.isVisible('#scenario-card'), true, 'and appears with one');
const base = await realState();
eq(base.cards.length, 4, 'four students');
ok(/No scenario is on/.test(await text('sc-summary')), 'with no scenario on it says the results are the real ones');
eq((await rows()).length, 0, 'and shows no table');
const rules = await text('sc-rules');
ok(/drop, then curve, then weight/.test(rules), 'the order is stated on the page');
ok(/stops at 100 unless extra credit/.test(rules) && /need not add to 100/.test(rules) && /negative, not numbers or all zero are refused/.test(rules), 'the cap, the weights rule and the refusal are stated in words');

// ── 2. drop ─────────────────────────────────────────────────────────────────
await set('#sc-drop', '1');
let r = await rows();
eq(r[2], ['Hopper, Grace', 'B (81.25%)', 'A (95.00%)', 'B → A (up); +13.75 points', 'Q4'], 'dropping the lowest quarter: Grace goes B to A and the 40 is named as left out');
eq(r[0][4], 'Q1', 'four equal quarters: the tie drops the earlier quarter');
eq(r[3].slice(1, 3), ['no final', 'no final'], 'a student missing a quarter that counts still has no final');
ok(/1 up, 0 down, 2 unchanged/.test(await text('sc-summary')) || /1 up/.test(await text('sc-summary')), 'the summary counts the moves: ' + await text('sc-summary'));
ok(/Letters before: A 0, B 2, C 1, D 0, F 0, no final 1\. After: A 1, B 1, C 1, D 0, F 0, no final 1/.test(await text('sc-summary')), 'and the letter counts before and after');
await set('#sc-drop', '3');
r = await rows();
eq(r[2][4], 'Q1, Q2, Q4', 'dropping 3 leaves one quarter (Q3, the last of her three 95s: the 40 goes first, then ties drop the earlier quarter) and names the three left out');
eq(await page.$$eval('#sc-drop option', o => o.map(x => x.value)), ['0', '1', '2', '3'], 'the drop can be 0 up to one fewer than the quarters');
eq(await realState(), base, 'the real cards, paste and storage are untouched after drops');

// ── 3. curve ────────────────────────────────────────────────────────────────
await set('#sc-drop', '0');
eq(await page.isVisible('#sc-points-row'), false, 'no points box until Add points is chosen');
await set('#sc-curve-mode', 'plus');
eq(await page.isVisible('#sc-points-row'), true, 'it appears with Add points');
await type('#sc-points', '1');
r = await rows();
eq(r[0].slice(1, 4), ['B (89.00%)', 'A (90.00%)', 'B → A (up); +1.00 points'], 'plus 1: Ada 89 becomes 90, B to A');
eq(r[1].slice(1, 3), ['C (79.00%)', 'B (80.00%)'], 'Marco 79 becomes 80');
await type('#sc-points', '-12');
r = await rows();
eq(r[0][2], 'C (77.00%)', 'a minus takes points off: 89 - 12 = 77');
await type('#sc-points', '20');
r = await rows();
eq(r[0][2], 'A (100.00%)', 'a big curve stops at 100 without extra credit: 89 + 20 is 100');
await page.check('#sc-extra'); await settle(page, 150);
r = await rows();
eq(r[0][2], 'A (109.00%)', 'with extra credit allowed the 89 + 20 becomes 109');
await page.uncheck('#sc-extra');
await type('#sc-points', '0');
await set('#sc-curve-mode', 'top');
eq(await page.isVisible('#sc-points-row'), false, 'the points box goes away for a scaled curve');
r = await rows();
// the class tops are 95, 95, 95 and 89 (Grace's three 95s; Ada's 89 in Q4)
eq(r[0][2], 'A (95.26%)', 'scaling so each quarter\u2019s top becomes 100: Ada (93.68 x 3 + 100) / 4');
eq(r[2][2], 'B (86.24%)', 'Grace scales too: (100 x 3 + 44.94) / 4 = 86.235, shown rounded half up (her 40 times 100/89 is 44.94)');
await set('#sc-apply', '0');
r = await rows();
eq(r[0][2], 'A (90.17%)', 'scaling Q1 only: Ada (93.68 + 89 + 89 + 89) / 4');
eq(await realState(), base, 'the real cards, paste and storage are untouched after curves');
await clear();
eq((await rows()).length, 0, 'Clear scenario puts it away');

// ── 4. re-weight ────────────────────────────────────────────────────────────
await page.check('#sc-rw'); await settle(page, 150);
eq(await page.isVisible('#sc-weights'), true, 'the weight boxes appear');
await type('#sc-w1', '1'); await type('#sc-w2', '0'); await type('#sc-w3', '0'); await type('#sc-w4', '0');
r = await rows();
eq(r[2].slice(2, 3), ['A (95.00%)'], 'a weight of 1 on Q1 and 0 elsewhere: only Q1 counts (95)');
eq(r[3][2], 'B (88.00%)', 'a quarter with no weight need not be on file: the student missing Q4 now has a final from Q1');
await type('#sc-w1', '-1');
ok(/cannot be negative/.test(await text('sc-note')), 'a negative weight is refused and says why: ' + await text('sc-note'));
ok(/No scenario is on/.test(await text('sc-summary')), 'and the page falls back to its own weights');
await type('#sc-w1', '0');
ok(/cannot all be zero/.test(await text('sc-note')), 'all zero is refused');
await type('#sc-w1', '');
ok(/must be a number/.test(await text('sc-note')), 'a blank weight is refused');
await type('#sc-w1', '3'); await type('#sc-w2', '1'); await type('#sc-w3', '1'); await type('#sc-w4', '1');
r = await rows();
eq(r[2][2], 'B (85.83%)', 'weights that do not add to 100 are shares of their total: (3x95 + 95 + 95 + 40) / 6');
eq(await realState(), base, 'the real cards, paste and storage are untouched after re-weighting');
await clear();

// ── 5. the order is drop, then curve, then weight ───────────────────────────
await load('10009\tOak, Rowan\t03\t07\tB(50.00)\tB(60.00)\tB(90.00)\tB(90.00)\t0\n10010\tPine, Sage\t03\t07\tB(50.00)\tB(60.00)\tB(90.00)\tB(90.00)\t0');
await set('#sc-drop', '1'); await set('#sc-curve-mode', 'top'); await set('#sc-apply', '0');
r = await rows();
eq(r[0][4], 'Q1', 'the drop looks at the scores as entered, before the curve (Q1 is 50, the lowest)');
eq(r[0][2], 'B (80.00%)', 'and the curve only then works on what was kept: (60+90+90)/3');
ok(/drop each student.s lowest quarter; scale Q1/.test(await text('sc-summary')), 'the sentence names drop before curve');
await clear();

// ── 6. save, use, update, delete ────────────────────────────────────────────
await load(PASTE);
const stored0 = await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1'));
eq(stored0, null, 'nothing is stored before anything is asked');
await set('#sc-drop', '1'); await set('#sc-curve-mode', 'plus'); await type('#sc-points', '2');
await page.click('#sc-save-btn');
ok(/Give the scenario a name/.test(await text('sc-note')), 'saving with no name asks for one');
await page.fill('#sc-name', 'Drop one, plus two'); await page.click('#sc-save-btn'); await settle(page, 150);
ok(/Saved .Drop one, plus two.. It is kept for this tab only/.test(await text('sc-note')), 'saved, and it says it is only for this tab: ' + await text('sc-note'));
eq(await page.$$eval('#sc-saved option', o => o.map(x => x.value)), ['Drop one, plus two'], 'it is in the saved list');
eq(await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1')), null, 'without Remember, nothing reaches storage');
await clear();
eq((await rows()).length, 0, 'cleared');
await page.click('#sc-load-btn'); await settle(page, 200);
eq([await page.inputValue('#sc-drop'), await page.inputValue('#sc-curve-mode'), await page.inputValue('#sc-points')], ['1', 'plus', '2'], 'Use it puts the saved scenario back in the form');
eq((await rows())[2][2].slice(0, 1), 'A', 'and the table follows');
await page.click('#settings-toggle-btn'); await page.check('#settings-persist'); await settle(page, 150);
let st = JSON.parse(await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1')));
eq(st.scenarios, [{ name: 'Drop one, plus two', dropN: 1, curve: { mode: 'plus', points: 200, apply: 'all', extra: false }, weights: null }], 'with Remember ticked the scenario is stored, as settings only');
ok(!/Lovelace|Hopper|10001|89\.00/.test(JSON.stringify(st)), 'and nothing of a name or a grade is stored with it');
await set('#sc-curve-mode', 'top');
await page.fill('#sc-name', 'drop one, plus two'); await page.click('#sc-save-btn'); await settle(page, 150);
eq(await page.$$eval('#sc-saved option', o => o.length), 1, 'saving under the same name (any case) updates it');
st = JSON.parse(await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1')));
eq(st.scenarios[0].curve.mode, 'top', 'with the new settings');
// reload: scenario survives with Remember on
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
eq(await page.$$eval('#sc-saved option', o => o.map(x => x.value)), ['drop one, plus two'], 'it is there after a reload');
await load(PASTE);
// delete
dialogs = [];
await page.selectOption('#sc-saved', 'drop one, plus two'); await page.click('#sc-delete-btn'); await settle(page, 200);
ok(dialogs.length === 1 && /pasted grades are not affected/.test(dialogs[0]), 'delete asks first: ' + dialogs[0]);
eq(await page.$$eval('#sc-saved option', o => o.map(x => x.textContent)), ['None saved'], 'and it is gone');
st = await page.evaluate(() => localStorage.getItem('final-grade-checker:settings-v1'));
ok(!/scenarios/.test(st), 'the last one deleted takes the key with it, so the stored string is the old shape again: ' + st);
eq(await page.isDisabled('#sc-delete-btn'), true, 'nothing left to delete');
// a corrupt saved entry is ignored
await page.evaluate(() => localStorage.setItem('final-grade-checker:settings-v1',
  JSON.stringify({ boundary: 'half', precision: 'none', weightsEnabled: false, weights: [25, 25, 25, 25], showWork: false, persist: true,
    scenarios: [null, 5, { name: '' }, { name: 'Bad', dropN: 99, curve: { mode: 'x', points: 'y' }, weights: [1] }] })));
await page.reload({ waitUntil: 'networkidle' }); await settle(page, 200);
eq(await page.$$eval('#sc-saved option', o => o.map(x => x.value)), ['Bad'], 'a corrupt saved scenario cannot break the page: only the named one loads, cleaned');
await load(PASTE);
await page.selectOption('#sc-saved', 'Bad'); await page.click('#sc-load-btn'); await settle(page, 200);
eq([await page.inputValue('#sc-drop'), await page.inputValue('#sc-curve-mode')], ['3', 'none'], 'its drop is held to 3 and its unknown curve is off');
await page.evaluate(() => localStorage.clear());

// ── 7. settings still rule, print, accessibility ────────────────────────────
await fresh(); await load(PASTE);
await page.click('#settings-toggle-btn'); await page.check('input[name="round-boundary"][value="strict"]'); await settle(page, 200);
await set('#sc-curve-mode', 'plus'); await type('#sc-points', '0.5');
await page.fill('#import-area', ''); // the paste area may be cleared; the class stays
r = await rows();
eq(r[0].slice(1, 3), ['B (89.00%)', 'B (89.50%)'], 'under strict rounding 89.5 stays a B in the scenario too');
await page.check('input[name="round-boundary"][value="half"]'); await settle(page, 200);
r = await rows();
eq(r[0][2], 'A (89.50%)', 'and is an A under the county rule');
await page.emulateMedia({ media: 'print' });
eq(await page.isVisible('#scenario-card'), false, 'the scenario card does not print');
await page.emulateMedia({ media: 'screen' });
// scoped to the new card: the page's own import status and triage colours are older and not this row's
const viol = await a11yScan(page, { impact: 'serious', include: '#scenario-card' });
eq(viol, [], 'axe finds nothing serious in the scenario card with a scenario on');
eq(await page.$eval('#sc-scroll', e => e.getAttribute('tabindex')), '0', 'the results box can be scrolled from the keyboard');
eq(await page.$$eval('#sc-table thead th', t => t.map(x => x.scope)), ['col', 'col', 'col', 'col', 'col'], 'the table has column headers');
eq(await page.$$eval('#sc-table tbody th', t => t.every(x => x.scope === 'row')), true, 'and row headers');
eq(page.__errs.length, 0, 'no page or console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
