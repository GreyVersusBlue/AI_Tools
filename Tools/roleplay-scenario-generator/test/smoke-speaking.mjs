// smoke-speaking.mjs — 014's speaking record on the real page.
//   node Tools/roleplay-scenario-generator/test/smoke-speaking.mjs     (port 8627)
//
// A teacher walks the room, taps a level per criterion for a pair, presses Record.
// Held here: the mark lands on BOTH partners and nobody else; it is stored per class,
// in its own key, and only when Record is pressed; a reload brings it back; Undo and
// Clear work; the printed page for one student shows only that student's marks with a
// number AND a word per level; renaming or deleting a class carries or drops the marks;
// markup typed as a name or criterion stays inert; 360 px is usable; axe is clean.
import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8627;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/014-roleplay-scenario-generator.html';
const KEY = 'gvb-roleplay:speaking';

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) { passed++; return true; } failed++; console.log('  FAIL ' + l); return false; };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1050 });
await page.clock.setFixedTime(new Date('2026-10-12T15:00:00Z'));
const ROSTER = ['Ana Test', 'Ben Test', 'Cam Test', 'Dee Test', '<img src=x onerror=window.__pwned=1>'];
await page.addInitScript((roster) => {
  if (localStorage.getItem('__seeded')) return;
  localStorage.setItem('__seeded', '1');
  localStorage.setItem('gvb-roleplay:roster', JSON.stringify({ 'Period 1': roster }));
  localStorage.setItem('gvb-roleplay:fills', JSON.stringify({ 'Period 1': {} }));
  localStorage.setItem('gvb-roleplay:currentClass', 'Period 1');
  localStorage.setItem('gvb-roleplay:current', 'so5');
}, ROSTER);

const stored = () => page.evaluate((k) => { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); }, KEY);
const rawStored = () => page.evaluate((k) => localStorage.getItem(k), KEY);
const open = async () => {
  if (!(await page.isVisible('#speakingPanel'))) { await page.click('#toggleSpeakingBtn'); await settle(page, 200); }
};
const tap = async (idx, level) => { await page.check(`input[name="spk-c${idx}"][value="${level}"]`); };
const status = () => page.textContent('#spkStatus');

console.log('Roleplay Scenario Generator — speaking record');
await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* 1. loading and opening the panel stores nothing */
eq(await rawStored(), null, 'nothing stored before any mark');
ok(!(await page.isVisible('#speakingPanel')), 'the panel is closed at first');
await open();
ok(await page.isVisible('#speakingPanel'), 'the panel opens');
eq(await rawStored(), null, 'opening the panel stores nothing');
eq(await page.locator('#spkRubric fieldset').count(), 4, 'four default criteria are offered');
eq(await page.locator('#spkRubric input[type=radio]').count(), 16, 'four levels each');
const labels = await page.locator('#spkRubric label').allTextContents();
ok(labels.slice(0, 4).join('|') === '1 Beginning|2 Developing|3 Proficient|4 Advanced', 'each level is a number and a word');
ok(await page.isDisabled('#spkUndoBtn') && await page.isDisabled('#spkPrintBtn') && await page.isDisabled('#spkClearBtn'), 'undo, print, clear are off with no marks');

/* 2. refusals */
await page.click('#spkRecordBtn');
ok(/Choose who/.test(await status()), 'Record with nobody chosen says so');
await page.selectOption('#spkA', 'Ana Test');
await page.selectOption('#spkB', 'Ben Test');
await page.click('#spkRecordBtn');
ok(/at least one level/.test(await status()), 'Record with no level tapped says so');
eq(await rawStored(), null, 'refusals store nothing');

/* 3. a pair mark */
await tap(0, 3); await tap(2, 4);
await page.click('#spkRecordBtn');
await settle(page, 100);
let st = await stored();
eq(Object.keys(st), ['Period 1'], 'stored under the class');
eq(st['Period 1'].marks.length, 1, 'one mark stored');
const rec = st['Period 1'];
eq(rec.marks[0].students, ['Ana Test', 'Ben Test'], 'the mark names both partners');
eq(rec.marks[0].date, '2026-10-12', 'dated from the page clock');
eq(rec.marks[0].title, 'Catching Up With an Old Friend', 'filed under the scenario shown');
eq(rec.marks[0].scores, [{ c: 'Stays in the target language', v: 3 }, { c: 'Keeps the conversation going', v: 4 }], 'only the tapped criteria are scored');
ok(/Recorded for Ana Test & Ben Test: 2 of 4/.test(await status()), 'the status line says what was recorded');
eq(await page.locator('#spkRubric input:checked').count(), 0, 'the taps clear for the next pair');
ok(!(await page.isDisabled('#spkUndoBtn')), 'undo is available now');

/* 4. a second pair via the class pairing, and a solo mark */
await page.click('#pairUpBtn');
await settle(page, 200);
ok((await page.locator('#spkPair option').count()) > 1, 'the pairing is offered');
await page.selectOption('#spkPair', '0');
const pair0 = await page.evaluate(() => [document.getElementById('spkA').value, document.getElementById('spkB').value]);
ok(pair0[0] && pair0[1], 'choosing a pair fills both partners');
await tap(1, 2);
await page.click('#spkRecordBtn');
await page.selectOption('#spkA', 'Dee Test');
await page.selectOption('#spkB', '');
await tap(3, 1);
await page.click('#spkRecordBtn');
st = await stored();
eq(st['Period 1'].marks.length, 3, 'three marks');
eq(st['Period 1'].marks[2].students, ['Dee Test'], 'a student with no partner is recorded alone');

/* 5. reload brings it back; the summary lists students */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
await open();
const rows = await page.locator('#spkSummary tbody tr, #spkSummary tr').allTextContents();
ok(rows.some(r => r.includes('Ana Test')) && rows.some(r => r.includes('Dee Test')), 'marks and students survive a reload');
eq((await stored())['Period 1'].marks.length, 3, 'storage is unchanged by a reload');

/* 6. print one student: only their marks */
await page.evaluate(() => { window.print = function () { window.__prints = (window.__prints || 0) + 1; }; });
await page.selectOption('#spkPrintWho', 'Ana Test');
await page.click('#spkPrintBtn');
await settle(page, 200);
eq(await page.locator('#printArea .spk-record').count(), 1, 'one page for one student');
let text = await page.textContent('#printArea');
ok(text.includes('Speaking record: Ana Test'), 'the page names the student');
ok(text.includes('2026-10-12') && text.includes('Catching Up With an Old Friend'), 'date and scenario are printed');
ok(text.includes('Stays in the target language: 3 Proficient') && text.includes('Keeps the conversation going: 4 Advanced'), 'levels print as number and word');
ok(text.includes('Ben Test'), 'the partner is named');
const anaMarks = (await stored())['Period 1'].marks.filter(m => m.students.includes('Ana Test'));
const allowed = new Set(anaMarks.flatMap(m => m.students));
ok(ROSTER.slice(0, 4).every(n => allowed.has(n) === text.includes(n)), 'only Ana and her own partners are on it');
ok(await page.evaluate(() => document.getElementById('printArea').classList.contains('active')), 'the print area is the one shown');
eq(await page.evaluate(() => window.__prints), 1, 'print() called once');
/* all students */
await page.selectOption('#spkPrintWho', '');
await page.click('#spkPrintBtn');
const nPages = await page.locator('#printArea .spk-record').count();
ok(nPages >= 3, `all students with marks print one page each (${nPages})`);
ok(await page.evaluate(() => Array.from(document.querySelectorAll('#printArea .spk-record')).every(p => p.querySelectorAll('table').length === 1)), 'each page has its table');

/* 7. criteria editing keeps old marks as they were scored */
await page.fill('#spkCriteria', 'Greets politely\nAsks a question\n\nGreets politely');
await settle(page, 200);
eq(await page.locator('#spkRubric fieldset').count(), 2, 'edited criteria become the rubric, blanks and repeats gone');
eq((await stored())['Period 1'].criteria, ['Greets politely', 'Asks a question'], 'criteria saved cleaned');
eq((await stored())['Period 1'].marks[0].scores[0].c, 'Stays in the target language', 'old marks keep the wording they were scored under');
await page.fill('#spkCriteria', '');
await settle(page, 200);
eq(await page.locator('#spkRubric fieldset').count(), 4, 'an emptied box falls back to the defaults');

/* 8. undo and clear */
await page.click('#spkUndoBtn');
eq((await stored())['Period 1'].marks.length, 2, 'Undo removes the last mark only');
ok(/Removed the last mark/.test(await status()), 'Undo says what it did');
let dialogs = [];
page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
await page.click('#spkClearBtn');
eq((await stored())['Period 1'].marks.length, 2, 'Clear then Cancel keeps the marks');
ok(dialogs.length === 1 && /2 speaking marks/.test(dialogs[0]), 'the confirm says how many');
page.removeAllListeners('dialog');
page.on('dialog', d => d.accept());
await page.click('#spkClearBtn');
eq((await stored())['Period 1'].marks, [], 'Clear then OK empties the class');
ok(await page.isDisabled('#spkPrintBtn'), 'nothing left to print');

/* 9. per class: rename carries, a second class is separate, delete drops */
await page.selectOption('#spkA', 'Cam Test'); await tap(0, 2); await page.click('#spkRecordBtn');
page.removeAllListeners('dialog');
page.on('dialog', async d => { if (d.type() === 'prompt') await d.accept('Period 9'); else await d.accept(); });
await page.click('#renameClassBtn');
await settle(page, 200);
st = await stored();
ok(st['Period 9'] && !st['Period 1'] && st['Period 9'].marks.length === 1, 'renaming a class carries its marks');
page.removeAllListeners('dialog');
page.on('dialog', async d => { if (d.type() === 'prompt') await d.accept('Period 2'); else await d.accept(); });
await page.click('#addClassBtn');
await settle(page, 200);
await open();
eq(await page.locator('#spkSummary table').count(), 0, 'a new class starts with no marks');
eq(await page.locator('#spkRubric fieldset').count(), 4, 'and the default criteria');
await page.fill('#spkCriteria', 'Only for period 2');
await page.evaluate(() => { const o = document.createElement('option'); o.value = 'Zed Test'; o.textContent = 'Zed Test'; document.getElementById('spkA').appendChild(o); });
await page.selectOption('#spkA', 'Zed Test');
await tap(0, 1);
await page.click('#spkRecordBtn');
st = await stored();
eq(Object.keys(st).sort(), ['Period 2', 'Period 9'], 'a second class has its own record');
eq(st['Period 9'].marks.length, 1, 'and the first class is untouched by it');
await page.click('#deleteClassBtn');
await settle(page, 200);
st = await stored();
eq(Object.keys(st), ['Period 9'], 'deleting a class drops its marks and only its marks');

/* 10. hostile names stay text */
const fresh = await prepPage(browser, BASE, { width: 1400, height: 1000 });
await fresh.clock.setFixedTime(new Date('2026-10-12T15:00:00Z'));
await fresh.addInitScript((roster) => {
  localStorage.setItem('gvb-roleplay:roster', JSON.stringify({ 'Period 1': roster }));
  localStorage.setItem('gvb-roleplay:fills', JSON.stringify({ 'Period 1': {} }));
  localStorage.setItem('gvb-roleplay:currentClass', 'Period 1');
}, ROSTER);
await fresh.goto(URL_PAGE, { waitUntil: 'networkidle' });
await fresh.click('#toggleSpeakingBtn');
await fresh.fill('#spkCriteria', '<b onclick=1>Bold</b>');
await fresh.selectOption('#spkA', ROSTER[4]);
await fresh.check('input[name="spk-c0"][value="4"]');
await fresh.click('#spkRecordBtn');
await fresh.evaluate(() => { window.print = function () {}; });
await fresh.click('#spkPrintBtn');
await settle(fresh, 200);
eq(await fresh.evaluate(() => window.__pwned), undefined, 'a name with markup ran nothing');
eq(await fresh.locator('#printArea img, #spkSummary img, #spkRubric b').count(), 0, 'and made no element');
ok((await fresh.textContent('#printArea')).includes('<img src=x'), 'the name prints as text');
ok((await fresh.textContent('#spkRubric')).includes('<b onclick=1>Bold</b>'), 'a criterion with markup is text');

/* 11. a junk stored value loads as an empty record, unchanged */
await fresh.evaluate((k) => localStorage.setItem(k, '{"Period 1":{"criteria":7,"marks":[1,null,{"x":1}]}}'), KEY);
await fresh.reload({ waitUntil: 'networkidle' });
await fresh.click('#toggleSpeakingBtn');
eq(await fresh.locator('#spkRubric fieldset').count(), 4, 'junk loads as the default rubric');
eq(await fresh.evaluate((k) => localStorage.getItem(k), KEY), '{"Period 1":{"criteria":7,"marks":[1,null,{"x":1}]}}', 'and is not rewritten by loading');

/* 12. 360 px and axe */
await fresh.setViewportSize({ width: 360, height: 800 });
await settle(fresh, 200);
ok(await fresh.evaluate(() => document.documentElement.scrollWidth <= 360), 'no sideways scroll at 360 px');
const box = await fresh.locator('#spkRecordBtn').boundingBox();
ok(box && box.height >= 24, 'Record is a target big enough to tap');
for (const theme of ['light', 'dark']) {
  await fresh.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  const v = await a11yScan(fresh, { impact: 'serious', include: '#speakingPanel' });
  eq(v.map(x => x.id), [], `axe is clean on the panel in ${theme}`);
}
ok(page.__errs.length === 0 && fresh.__errs.length === 0, 'no console errors: ' + JSON.stringify(page.__errs.concat(fresh.__errs)));

await browser.close();
server.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
