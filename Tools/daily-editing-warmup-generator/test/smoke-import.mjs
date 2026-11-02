// smoke-import.mjs — 055's bulk import of a custom bank (deg-import.js and the page), rank 87.
//
//   node Tools/daily-editing-warmup-generator/test/smoke-import.mjs        (port 8638)
//
// The parsing is import-logic.test.mjs's (pure Node). This is the page: a paste is checked
// first and stored only when Add is pressed; the summary says how many go in, how many repeat
// and which lines could not be read; what is added is the same record a typed sentence is
// (the one key, deg_custom_v1), so it lands in the bank list, the projector rotation, the
// worksheet and a share link; a full store reverts instead of pretending; 360 px; axe; and
// nothing leaves the site. Every sentence is invented.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8638;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE = BASE + '/Tools/055-daily-editing-warmup-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (c, l) => { if (c) { passed++; return true; } failed++; fails.push(l); console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Daily Editing Warm-Up — bulk import');

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
page.on('dialog', (d) => d.accept());
await page.goto(PAGE, { waitUntil: 'networkidle' });
await settle(page, 300);
await page.click('.tab-btn[data-stage="bank"]');

const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('deg_custom_v1') || '[]'));
const count = () => page.evaluate(() => Number(document.getElementById('bankCount').textContent));
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
const paste = async (t) => { await page.fill('#bulkText', t); await page.click('#bulkCheckBtn'); };

const start = await count();
eq(start, 24, 'the built-in bank is 24');

// ---- empty
await page.click('#bulkCheckBtn');
ok(/Paste some sentences first/.test(await text('#bulkDone')), 'an empty box says to paste something');
ok(!(await vis('#bulkPreview')), 'and shows no preview');

// ---- a good paste is previewed and adds nothing yet
const GOOD = [
  'Broken\tFixed\tType',
  'the dog dont bark\tThe dog doesn’t bark.\tsubject-verb',
  'we went too the park | We went to the park. | homophones',
  'sally and me left early | Sally and I left early.',
  'no separator on this line',
  ' | only a correction',
  'the dog dont bark\tThe dog doesn’t bark.',
  'mystery case | Mystery case. | zzz',
  'it is the same | it is the same'
].join('\n');
await paste(GOOD);
ok(await vis('#bulkPreview'), 'the preview opens');
let sum = await text('#bulkSummary');
ok(/^4 sentences will be added/.test(sum), 'four will be added: ' + sum);
ok(/1 is already in the bank/.test(sum), 'the in-paste repeat is counted: ' + sum);
ok(/3 lines could not be read/.test(sum), 'three lines could not be read: ' + sum);
ok(/1 line names an error type this tool does not have/.test(sum), 'the unknown type is said: ' + sum);
const skippedItems = await page.evaluate(() => [...document.querySelectorAll('#bulkSkipped li')].map(li => li.textContent));
eq(skippedItems.length, 3, 'each unreadable line is listed');
ok(/^Line 5: /.test(skippedItems[0]) && /^Line 6: /.test(skippedItems[1]) && /^Line 9: /.test(skippedItems[2]), 'by its line number: ' + JSON.stringify(skippedItems));
eq((await stored()).length, 0, 'nothing is stored by checking');
eq(await count(), 24, 'the bank has not changed');
eq(await text('#bulkAddBtn'), 'Add 4 sentences to the bank', 'the button says how many');

// ---- cancel
await page.click('#bulkCancelBtn');
ok(!(await vis('#bulkPreview')), 'Cancel closes the preview');
eq((await stored()).length, 0, 'and adds nothing');
eq(await page.inputValue('#bulkText'), GOOD, 'and keeps the paste for fixing');

// ---- the default type is the one chosen
await page.selectOption('#bulkCategory', 'capitalization');
await page.click('#bulkCheckBtn');
await page.click('#bulkAddBtn');
let rows = await stored();
eq(rows.length, 4, 'Add stores the four');
eq(JSON.stringify(rows.map(r => r.category)), JSON.stringify(['subject-verb', 'homophones', 'capitalization', 'capitalization']), 'with the named types, and the chosen type for the lines that named none or one this tool lacks');
ok(rows.every(r => r.id && r.broken && r.fixed && Object.keys(r).sort().join() === 'broken,category,fixed,id'), 'each is the record a typed sentence is');
ok(rows.some(r => r.broken === 'sally and me left early'), 'sentences are kept as written');
eq(await count(), 28, 'the bank list counts 28');
ok(/Added 4 sentences to the bank/.test(await text('#bulkDone')), 'and says so');
eq(await page.inputValue('#bulkText'), '', 'the box is emptied');
ok(!(await vis('#bulkPreview')), 'the preview is closed');
ok(await page.evaluate(() => /we went too the park/.test(document.getElementById('bankList').textContent)), 'they are in the bank list');
eq(await page.evaluate(() => document.querySelectorAll('#bankList [data-del]').length + document.querySelectorAll('#bankList button').length > 0), true, 'with the usual row buttons');

// ---- a second paste of the same list adds nothing
await paste(GOOD);
sum = await text('#bulkSummary');
ok(/^0 sentences will be added/.test(sum) && /5 are already in the bank/.test(sum), 'pasting it again: all repeats: ' + sum);
ok(!(await vis('#bulkAddBtn')), 'and there is no Add button');
await page.click('#bulkCancelBtn');
// a repeat of a built-in is a repeat too (the first bank row is a built-in)
const b0 = await page.evaluate(() => { const r = document.querySelector('#bankList .bank-row'); return [r.querySelector('.broken-txt').textContent, r.querySelector('.fixed-txt').textContent]; });
await paste(b0[0].toUpperCase() + ' | ' + b0[1] + '\nbrand new one | Brand new one.');
sum = await text('#bulkSummary');
ok(/^1 sentence will be added/.test(sum) && /1 is already in the bank/.test(sum), 'a built-in sentence pasted in any case is a repeat: ' + sum);
await page.click('#bulkAddBtn');
eq(await count(), 29, 'only the new one was added');

// ---- it all behaves like a typed sentence: projector, worksheet, share
await page.selectOption('#categoryFilter', 'capitalization');
await page.click('.tab-btn[data-stage="display"]');
await page.selectOption('#categoryFilter', 'capitalization');
await settle(page, 150);
const shown = [];
for (let i = 0; i < 6; i++) { shown.push(await text('#displayBroken')); await page.click('#nextBtn'); }
ok(shown.includes('sally and me left early'), 'the pasted capitalization sentence is in the projector rotation: ' + JSON.stringify(shown));
await page.selectOption('#categoryFilter', '');
await page.click('.tab-btn[data-stage="sheet"]');
await page.fill('#sheetCount', '30');
await page.click('#buildSheetBtn');
const key = await text('#sheetKey');
ok(/Brand new one\./.test(key) && /Sally and I left early\./.test(key), 'and in the worksheet key');

// ---- a sentence that looks like markup stays text
await page.click('.tab-btn[data-stage="bank"]');
await paste('<img src=x onerror=window.__x=1> bad | <b>Fixed</b> good.');
await page.click('#bulkAddBtn');
await settle(page, 100);
eq(await page.evaluate(() => window.__x === 1 || !!document.querySelector('#bankList img')), false, 'markup in a pasted sentence is text, not elements');
ok(await page.evaluate(() => document.getElementById('bankList').textContent.includes('<b>Fixed</b> good.')), 'it shows as typed');

// ---- over the cap
const huge = Array.from({ length: 510 }, (_, i) => 'bad sentence ' + i + ' | Good sentence ' + i + '.').join('\n');
await paste(huge);
sum = await text('#bulkSummary');
ok(/^500 sentences will be added/.test(sum) && /cut at 500/.test(sum) && /10 more were left out/.test(sum), 'a list over 500 is cut and says so: ' + sum);
await page.click('#bulkCancelBtn');

// ---- a full store is not pretended away
const before = (await stored()).length;
await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
await paste('quota one | Quota one.\nquota two | Quota two.');
await page.click('#bulkAddBtn');
ok(/would not save them/.test(await text('#bulkDone')), 'a refused save is said: ' + await text('#bulkDone'));
await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
eq((await stored()).length, before, 'nothing was stored');
eq(await page.evaluate(() => /quota one/.test(document.getElementById('bankList').textContent)), false, 'and the bank list does not show them');
await paste('after one | After one.');
await page.click('#bulkAddBtn');
eq((await stored()).length, before + 1, 'and a later paste works once storage does');

// ---- the shared link carries them (the share state is the custom list)
ok((await stored()).some(r => r.broken === 'after one'), 'they are in the list the share link carries');

// ---- storage: still the one key
const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('deg_')).sort().join());
ok(/^deg_custom_v1/.test(keys) && !/bulk|import/i.test(keys), 'no new storage key: ' + keys);

// ---- 360 px and axe
await page.setViewportSize({ width: 360, height: 800 });
await paste('x bad | X bad.\nline without a separator');
await settle(page, 150);
eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), true, 'the import card and its preview fit at 360 px');
await page.setViewportSize({ width: 1200, height: 900 });
const viol = await a11yScan(page);
eq(viol.length, 0, 'axe: no serious or critical violation with the preview open: ' + JSON.stringify(viol.map(v => [v.id, v.nodes])));
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
