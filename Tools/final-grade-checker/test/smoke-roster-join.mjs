// smoke-roster-join.mjs — the Final Grade Checker's roster check, in a browser.
//
//   node Tools/final-grade-checker/test/smoke-roster-join.mjs
//
// roster-join.test.mjs holds the matching against hand-worked cases. This is the page half: the card
// appears with a paste, a roster from Class Roster Hub (read, never written) or typed names is checked
// against it, the lists name the right students, a name that is markup stays text, and nothing is stored.
// Every name is invented. Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8581;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/036-final_grade_checker.html';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; return true; } failed++; console.log('  FAIL ' + label); return false; };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 1800 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const ROSTERS = JSON.stringify({ 'Period 3': ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Grace Hopper'], 'Period 5': ['Zheng He'] });
await page.addInitScript(r => { if (!localStorage.getItem('np_rosters')) localStorage.setItem('np_rosters', r); }, ROSTERS);
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 200);

const PASTE = [
  '1\tLovelace, Ada\t03\t07\tA(95.00)\tA(95.00)\tA(95.00)\tA(95.00)\t95.00',
  '2\tPolo, Marco\t03\t07\tB(85.00)\tB(85.00)\tB(85.00)\tB(85.00)\t85.00',
  '3\tHopper, Grace\t03\t07\tC(75.00)\tC(75.00)\tC(75.00)\tC(75.00)\t75.00',
  '4\t<img src=x onerror=alert(1)> Newkid\t03\t07\tC(70.00)\tC(70.00)\tC(70.00)\tC(70.00)\t70.00',
  '5\tMarko Polo\t03\t07\tB(80.00)\tB(80.00)\tB(80.00)\tB(80.00)\t80.00',
].join('\n');

console.log('Final Grade Checker — roster check');
eq(await page.isVisible('#roster-card'), false, 'hidden before a paste');
await page.fill('#import-area', PASTE);
await page.click('#import-btn');
await settle(page, 300);
eq(await page.isVisible('#roster-card'), true, 'the card appears with the paste');
eq(await page.$$eval('#rj-roster option', o => o.map(x => x.textContent)), ['None chosen', 'Period 3', 'Period 5'], 'Class Roster Hub rosters are offered');

await page.selectOption('#rj-roster', 'Period 3');
eq((await page.inputValue('#rj-area')).split('\n'), ['Ada Lovelace', 'Marco Polo', 'Nellie Bly', 'Grace Hopper'], 'choosing one fills the box with its names');
await page.click('#rj-check-btn');
await settle(page, 100);
const lists = await page.$$eval('#rj-lists .triage-col', cols => cols.map(c => ({ h: c.querySelector('h3').textContent, items: [...c.querySelectorAll('li')].map(l => l.textContent) })));
eq(lists[0], { h: 'On the roster, no row above (1)', items: ['Nellie Bly'] }, 'Nellie is on the roster with no grades');
eq(lists[1].h, 'In the grades, not on the roster (2)', 'two rows are not on the roster');
ok(lists[1].items.includes('Marko Polo — close to Marco Polo?') === false, 'Marco Polo has a row, so Marko is not offered as close to anyone');
ok(lists[1].items.includes('Marko Polo') && lists[1].items.some(t => t.includes('onerror=alert(1)')), 'both unmatched rows are listed: ' + JSON.stringify(lists[1].items));
const sum = await page.$eval('#rj-summary', e => e.textContent);
ok(/4 on the roster; 3 matched to a row; 1 with no row; 2 rows not on the roster\./.test(sum), 'the summary counts them: ' + sum);
eq(await page.$$eval('#rj-lists img', i => i.length), 0, 'a name that is markup stays text');

// typed names: a near spelling is offered, never matched
await page.fill('#rj-area', 'Lovelace, Ada\nMarco Polo\nMarko Polo-ish');
await page.click('#rj-check-btn');
await settle(page, 100);
const t2 = await page.$$eval('#rj-lists .triage-col', cols => cols.map(c => [...c.querySelectorAll('li')].map(l => l.textContent)));
eq(t2[0], ['Marko Polo-ish'], 'with a typed list the unclaimed roster name is listed');
const sum2 = await page.$eval('#rj-summary', e => e.textContent);
ok(/3 on the roster; 2 matched to a row/.test(sum2), 'matched is by name, not by guess: ' + sum2);

// an empty roster is said, not shown as everyone fine
await page.click('#rj-clear-btn');
await page.click('#rj-check-btn');
eq(await page.$eval('#rj-summary', e => e.textContent), 'Choose a roster or paste a class list first.', 'nothing to check against says so');

// all lined up
await page.fill('#rj-area', ['Ada Lovelace', 'Marco Polo', 'Grace Hopper', '<img src=x onerror=alert(1)> Newkid', 'Marko Polo'].join('\n'));
await page.click('#rj-check-btn');
ok((await page.$eval('#rj-summary', e => e.textContent)).endsWith('Everyone lines up.'), 'a full match says everyone lines up');

// nothing stored by this card, and the roster is untouched
const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
eq(Object.keys(store).sort(), ['np_rosters'], 'the only key in storage is the roster the test put there');
eq(store.np_rosters, ROSTERS, 'and it is byte for byte what it was');

// manual mode hides the card
await page.click('#clear-all-btn');
await settle(page, 200);
eq(await page.isVisible('#roster-card'), false, 'the card goes with the imported class');

eq(errors, [], 'no page errors');
await browser.close();
server.close && server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
