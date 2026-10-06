// smoke-bulk-import.mjs — Math "Find the Mistake": paste rows to import a whole unit.
//
//   node Tools/math-find-the-mistake-generator/test/smoke-bulk-import.mjs        (port 8493)
//
// What this suite holds down:
//
//   Reading. Tab- or comma-separated rows of problem, shown work, fix and
//   explanation (plus an optional topic and grade band), with a header row
//   optional, quoted cells that hold line breaks, commas and quotes, CRLF
//   and a byte-order mark.
//
//   Preview before anything is saved. Each row that cannot be used is named
//   by line with its reason (wrong column count, empty problem, unknown topic,
//   unclosed quote), duplicates are named, and storage is untouched until the
//   add button is pressed. Editing anything after a preview puts the button
//   out again, so what is saved is what was shown.
//
//   Append or replace, with the confirm on replace, and a refusal when the
//   browser will not store the result.
//
//   Text is text. A cell holding <img onerror>, <script>, or starting with =
//   is shown as those characters on the projector, the worksheet, the key and
//   the bank list, and nothing runs; <br> and &minus; still work.
//
//   Storage shape. A bank saved before this existed loads untouched and an
//   append leaves its rows as they were; an imported row is the shape the Add
//   form writes; "Show my problems as rows" re-imports to the same bank.
//
//   Keyboard and labels, and axe with the preview showing.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8493;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/066-math-find-the-mistake-generator.html';
const KEY = 'mftm_custom_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1300, height: 950 });
await page.addInitScript(() => { window.__pwned = 0; window.__printed = 0; window.print = () => { window.__printed++; }; });

const bankStored = () => page.evaluate((k) => localStorage.getItem(k), KEY);
const bankParsed = async () => JSON.parse((await bankStored()) || '[]');
const strip = (rows) => rows.map((r) => { const c = { ...r }; delete c.id; return c; });
async function load(seedRows) {
  await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(([k, rows]) => {
    localStorage.clear();
    if (rows) localStorage.setItem(k, typeof rows === 'string' ? rows : JSON.stringify(rows));
  }, [KEY, seedRows || null]);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.click('[data-stage="bank"]');
}
async function paste(text, { mode = 'append', topic, band } = {}) {
  await page.fill('#importText', text);
  if (topic) await page.selectOption('#importCategory', topic);
  if (band) await page.selectOption('#importBand', band);
  await page.check(mode === 'replace' ? '#importModeReplace' : '#importModeAppend');
}
const preview = async () => { await page.click('#importPreviewBtn'); return page.innerText('#importPreview'); };
const lists = () => page.evaluate(() => ({
  bad: Array.from(document.querySelectorAll('#importPreview .imp-list.bad li')).map(e => e.textContent),
  dup: Array.from(document.querySelectorAll('#importPreview .imp-list.dup li')).map(e => e.textContent),
  add: Array.from(document.querySelectorAll('#importPreview .imp-list.ok li')).map(e => e.textContent),
  sum: (document.querySelector('#importPreview .imp-sum') || {}).textContent
}));
const applyState = () => page.evaluate(() => ({ disabled: document.getElementById('importApplyBtn').disabled, text: document.getElementById('importApplyBtn').textContent }));
const status = () => page.textContent('#importStatus');

const T = '\t';
const HEADER = ['Problem', 'Work', 'Fix', 'Explain'].join(T);

console.log('Find the Mistake — bulk import');

/* ── 1. reading tab-separated rows, header optional ──────────────────────── */
await load();
const before = await bankStored();
eq(before, null, 'a fresh browser has no saved bank');
const tsv = [
  HEADER,
  ['Solve: 2x + 1 = 9', '2x = 10<br>x = 5', '2x = 8<br>x = 4', 'Subtract 1, not add it.'].join(T),
  ['Evaluate: 3 + 4 × 2', '7 × 2 = 14', '4 × 2 = 8; 3 + 8 = 11', 'Multiply first.'].join(T)
].join('\n');
await paste(tsv);
await preview();
let l = await lists();
eq(l.add.length, 2, 'a header and two rows preview as two problems');
eq(l.bad.length + l.dup.length, 0, 'with nothing wrong with either');
ok(/2 problems will be added/.test(l.sum), 'the summary says what will be added: ' + l.sum);
eq(await bankStored(), null, 'previewing saves nothing');
eq(await page.evaluate(() => document.getElementById('bankCount').textContent), '18', 'and the bank count is the built-in 18');
let a = await applyState();
eq(a.disabled, false, 'the add button is on once there is something to add');
ok(/Add 2 problems/.test(a.text), 'and says how many it adds: ' + a.text);
await page.click('#importApplyBtn');
let b1 = await bankParsed();
eq(b1.length, 2, 'two rows are saved');
eq(JSON.stringify(Object.keys(b1[0]).sort()), JSON.stringify(['band', 'category', 'explain', 'fix', 'id', 'problem', 'work']), 'each saved row has the shape the Add form writes');
eq(b1[0].problem, 'Solve: 2x + 1 = 9', 'the problem is kept');
eq(b1[0].work, '2x = 10<br>x = 5', 'a <br> in a cell is a step break');
eq(b1[0].category + '/' + b1[0].band, 'other/middle', 'with no topic or band in the row it files under the form defaults');
eq(await page.evaluate(() => document.getElementById('bankCount').textContent), '20', 'the bank list shows 20');
ok(/Added 2 problems/.test(await status()), 'the status line says so: ' + await status());
eq(await page.inputValue('#importText'), '', 'the paste box is emptied');
eq((await applyState()).disabled, true, 'and the button goes out again');
eq((await page.innerText('#importPreview')).trim(), '', 'and the preview is cleared');

/* ── 2. no header, commas, defaults from the selects ────────────────────── */
await load();
await paste('Find 10% of 80,"8 × 10 = 80","80 ÷ 10 = 8",Divide by 10 not multiply\nSolve: x/3 = 4,x = 4 - 3,x = 4 × 3,Undo division by multiplying,Percents,high', { topic: 'fractions', band: 'elementary' });
l = (await preview(), await lists());
eq(l.add.length, 2, 'comma rows with no header both preview');
await page.click('#importApplyBtn');
let b2 = await bankParsed();
eq(b2[0].category + '/' + b2[0].band, 'fractions/elementary', 'a row without topic and band takes the selected defaults');
eq(b2[1].category + '/' + b2[1].band, 'percents/high', 'a row naming them (by label, and by band id) takes those');
eq(b2[0].problem, 'Find 10% of 80', 'a comma-separated problem is read');

/* ── 3. quoted cells, CRLF, BOM ──────────────────────────────────────────── */
await load();
await paste('﻿Problem' + T + 'Work' + T + 'Fix' + T + 'Explain\r\n"Solve: ""x"" + 1 = 2, then check"' + T + '"1 + 1 = 2' + '\nx = 1"' + T + '"x = 1' + T + 'again"' + T + 'Quoted, with a comma\r\n');
l = (await preview(), await lists());
eq(l.add.length, 1, 'a quoted row with line breaks, a comma, a tab and doubled quotes is one row');
await page.click('#importApplyBtn');
let b3 = (await bankParsed())[0];
eq(b3.problem, 'Solve: &quot;x&quot; + 1 = 2, then check', 'a doubled quote is one quote (stored as text)');
eq(b3.work, '1 + 1 = 2<br>x = 1', 'a line break inside quotes becomes a step break');
eq(b3.fix, 'x = 1\tagain', 'a tab inside quotes stays in the cell');
eq(b3.explain, 'Quoted, with a comma', 'CRLF and a byte-order mark do not leak into the cells');

/* ── 4. bad rows are named with a reason ─────────────────────────────────── */
await load();
const rows4 = [
  ['Good one', 'wrong', 'right', 'because'].join(T),        // line 1
  ['Only three', 'wrong', 'right'].join(T),                 // line 2
  ['', 'wrong', 'right', 'because'].join(T),                // line 3
  ['No work', '', '', 'because'].join(T),                   // line 4
  ['Seven', 'a', 'b', 'c', 'Other', 'middle', 'extra'].join(T), // line 5
  ['Odd topic', 'a', 'b', 'c', 'Astrology'].join(T),        // line 6
  ['Odd band', 'a', 'b', 'c', 'Other', 'college'].join(T),  // line 7
  ['Fine two', 'a2', 'b2', ''].join(T),                     // line 8 (blank explanation is fine)
  ['Lonely'].join(T),                                       // line 9
  '',
  '"Never closed' + T + 'x'                                  // line 11
].join('\n');
await paste(rows4);
await preview();
l = await lists();
eq(l.add.length, 2, 'two usable rows among the bad ones (a blank explanation is allowed)');
eq(l.bad.length, 8, 'eight rows are named');
const badAt = (n) => l.bad.find(t => t.startsWith('Line ' + n + ':')) || '';
ok(/has 3 columns/.test(badAt(2)), 'three columns: ' + badAt(2));
ok(/the problem is empty/.test(badAt(3)), 'empty problem: ' + badAt(3));
ok(/the shown work and the fix are empty/.test(badAt(4)), 'empty work and fix: ' + badAt(4));
ok(/has 7 columns/.test(badAt(5)), 'seven columns: ' + badAt(5));
ok(/topic "Astrology"/.test(badAt(6)), 'unknown topic: ' + badAt(6));
ok(/grade band "college"/.test(badAt(7)), 'unknown band: ' + badAt(7));
ok(/has 1 column,/.test(badAt(9)), 'one column: ' + badAt(9));
ok(/never closed/.test(badAt(11)), 'unclosed quote: ' + badAt(11));
ok(/2 problems will be added/.test(l.sum) && /8 rows cannot be used/.test(l.sum), 'the summary counts both: ' + l.sum);
eq(await bankStored(), null, 'nothing is saved by the preview');
await page.click('#importApplyBtn');
eq((await bankParsed()).length, 2, 'applying adds only the two good rows');
ok(/left out 8 rows/.test(await status()), 'and the status says eight were left out: ' + await status());

/* ── 5. nothing usable: no way to save ──────────────────────────────────── */
await load();
await paste('just one column\nand another');
await preview();
eq((await applyState()).disabled, true, 'a paste with no usable row leaves the button off');
await paste('   \n\n', {});
ok(/Nothing to preview/.test(await preview()), 'a blank box says there is nothing to preview');
eq((await applyState()).disabled, true, 'and the button stays off');
await paste(Array.from({ length: 501 }, (_, i) => ['P' + i, 'w', 'f', 'e'].join(T)).join('\n'));
ok(/501 rows; at most 500/.test(await preview()), 'over 500 rows is refused with the limit named');
eq((await applyState()).disabled, true, 'and cannot be applied');

/* ── 6. editing after a preview takes the button away ───────────────────── */
await load();
await paste(['One', 'w', 'f', 'e'].join(T));
await preview();
eq((await applyState()).disabled, false, 'previewed: button on');
await page.fill('#importText', ['One', 'w', 'f', 'changed'].join(T));
eq((await applyState()).disabled, true, 'editing the text switches it off');
await preview();
await page.selectOption('#importBand', 'high');
eq((await applyState()).disabled, true, 'so does changing the default band');
await preview();
await page.check('#importModeReplace');
eq((await applyState()).disabled, true, 'so does changing the mode');
await preview();
await page.selectOption('#importCategory', 'percents');
eq((await applyState()).disabled, true, 'so does changing the default topic');
await page.click('#importApplyBtn', { force: true, noWaitAfter: true }).catch(() => {});
eq(await bankStored(), null, 'and pressing it anyway saves nothing');

/* ── 7. duplicates ───────────────────────────────────────────────────────── */
await load();
await paste(['Same', 'w1', 'f', 'e'].join(T) + '\n' + ['same', 'W1', 'other fix', 'x'].join(T) + '\n' + ['Same', 'w2', 'f', 'e'].join(T));
await preview();
l = await lists();
eq(l.add.length, 2, 'the same problem and work (any case) twice in a paste is one');
eq(l.dup.length, 1, 'the repeat is named');
ok(/Line 2 repeats line 1/.test(l.dup[0] || ''), 'with its line: ' + l.dup[0]);
await page.click('#importApplyBtn');
eq((await bankParsed()).length, 2, 'two saved');
await paste(['SAME', 'W1', 'f', 'e'].join(T) + '\n' + ['New', 'n', 'f', 'e'].join(T));
await preview();
l = await lists();
ok(/Line 1 is already in your bank/.test(l.dup[0] || ''), 'a row already in the bank is named: ' + (l.dup[0] || ''));
eq(l.add.length, 1, 'and left out');
await page.click('#importApplyBtn');
eq((await bankParsed()).length, 3, 'append kept the two and added one');
ok(/skipped 1 duplicate/.test(await status()), 'the status says one was skipped: ' + await status());
await paste(['SAME', 'W1', 'f', 'e'].join(T), { mode: 'replace' });
await preview();
l = await lists();
eq(l.dup.length + '/' + l.add.length, '0/1', 'when replacing, the old bank is not what duplicates are checked against');

/* ── 8. append and replace ───────────────────────────────────────────────── */
await load([{ id: 'old1', band: 'middle', category: 'other', problem: 'Old one', work: 'w', fix: 'f', explain: 'e' }]);
await paste(['New A', 'w', 'f', 'e'].join(T));
await preview();
await page.click('#importApplyBtn');
let b8 = await bankParsed();
eq(b8.map(r => r.problem).join('|'), 'Old one|New A', 'append puts the new rows after the old');
eq(b8[0].id, 'old1', 'and the old row is the same row');
await paste(['New B', 'w', 'f', 'e'].join(T), { mode: 'replace' });
await preview();
ok(/Replacing removes your 2 current problems/.test(await page.innerText('#importPreview')), 'replace says what it will remove');
ok(/Replace my problems with these 1/.test((await applyState()).text), 'and the button says replace');
let asked = '';
page.once('dialog', d => { asked = d.message(); d.dismiss(); });
await page.click('#importApplyBtn');
eq((await bankParsed()).length, 2, 'declining the confirm keeps the bank');
ok(/Replace your 2 problems with these 1/.test(asked), 'the confirm names the numbers: ' + asked);
page.once('dialog', d => d.accept());
await page.click('#importApplyBtn');
eq((await bankParsed()).map(r => r.problem).join('|'), 'New B', 'accepting replaces the bank');
eq(await page.evaluate(() => document.getElementById('bankCount').textContent), '19', 'the list shows 18 built-ins and the one');
ok(/Replaced your problems with 1 problem\./.test(await status()), 'the status says it: ' + await status());
await page.evaluate(() => localStorage.setItem('mftm_disabled_builtins_v1', JSON.stringify(['b0'])));
await paste(['New C', 'w', 'f', 'e'].join(T), { mode: 'replace' });
await preview(); page.once('dialog', d => d.accept()); await page.click('#importApplyBtn');
eq(await page.evaluate(() => localStorage.getItem('mftm_disabled_builtins_v1')), '["b0"]', 'replacing leaves the switched-off built-ins as they were');

/* ── 9. a bank saved before this change ──────────────────────────────────── */
const legacy = JSON.stringify([
  { id: 'mlegacy1', category: 'fractions', problem: 'Old, no band', work: '1 + 1<br>= 3', fix: '= 2', explain: '' },
  { id: 'mlegacy2', band: 'high', category: 'other', problem: 'x &gt; 2', work: 'w', fix: 'f', explain: 'e' }
]);
await load(legacy);
eq(await bankStored(), legacy, 'a saved bank loads without being rewritten');
ok(/Old, no band/.test(await page.innerText('#bankList')), 'and shows in the bank list');
await paste(['Another', 'w', 'f', 'e'].join(T));
await preview(); await page.click('#importApplyBtn');
const b9 = await bankParsed();
eq(JSON.stringify(b9.slice(0, 2)), legacy, 'importing after it leaves the old rows exactly as saved');
eq(b9.length, 3, 'with the new one after them');
await paste(['Old, no band', '1 + 1<br>= 3', 'f', 'e'].join(T));
await preview();
eq((await lists()).dup.length, 1, 'a row matching an old one (which has no band) is a duplicate');

/* ── 10. text is inert ───────────────────────────────────────────────────── */
await load();
const evil = [
  ['<img src=x onerror="window.__pwned++">', '<script>window.__pwned++</script>', 'x"><svg onload=window.__pwned++>', '<b onmouseover=window.__pwned++>x</b>'].join(T),
  ['=1+1', '+SUM(A1)', '@cmd', '-2+3'].join(T),
  ['Entity &minus;5 &amp; <br>', 'a&lt;b<br>c', '&frac12;', 'fine'].join(T)
].join('\n');
await paste(evil);
await preview();
eq((await page.evaluate(() => document.querySelectorAll('#importPreview img, #importPreview script, #importPreview svg, #importPreview b').length)), 0, 'the preview holds no element made from a cell');
await page.click('#importApplyBtn');
await settle(page, 200);
const b10 = await bankParsed();
ok(b10[0].problem.indexOf('<') === -1 && b10[0].work.indexOf('<') === -1 && b10[0].fix.indexOf('<') === -1 && b10[0].explain.indexOf('<') === -1, 'no < is stored from a cell: ' + b10[0].problem);
eq(b10[1].problem + '|' + b10[1].work + '|' + b10[1].fix + '|' + b10[1].explain, '=1+1|+SUM(A1)|@cmd|-2+3', 'cells starting = + @ - are kept as the text they are');
eq(b10[2].problem, 'Entity &minus;5 &amp; <br>', 'an entity and a <br> are the two things that survive as markup');
const dom = () => page.evaluate(() => ({
  imgs: document.querySelectorAll('img, svg:not(.a11y-icon), script:not([src]):not(#x)').length,
  list: document.getElementById('bankList').innerText,
  pwned: window.__pwned
}));
let d10 = await dom();
ok(/<img src=x onerror/.test(d10.list), 'the bank list shows the typed characters: ' + d10.list.slice(0, 100));
ok(/=1\+1/.test(d10.list), 'and the = problem');
eq(d10.pwned, 0, 'nothing ran');
await page.click('[data-stage="display"]');
// walk the projector through all the custom problems
const seen = [];
for (let i = 0; i < 30; i++) {
  const t = await page.innerText('#displayProblem');
  seen.push(t);
  if (/onerror/.test(t) || /=1\+1/.test(t)) await page.click('#revealBtn'), await page.click('#revealBtn');
  await page.click('#nextBtn');
}
ok(seen.some(t => /<img src=x onerror/.test(t)), 'the projector shows the img cell as text');
eq(await page.evaluate(() => document.querySelectorAll('.display-card img, .display-card svg, .display-card b').length), 0, 'and builds no element from it');
await page.click('[data-stage="sheet"]');
await page.fill('#sheetCount', '20');
await page.click('#buildSheetBtn');
const sheetHtml = await page.innerHTML('#printArea');
ok(sheetHtml.indexOf('<img') === -1 && sheetHtml.indexOf('<script') === -1 && sheetHtml.indexOf('onerror') > -1, 'the worksheet and key carry the text, not an element');
d10 = await dom();
eq(d10.pwned, 0, 'still nothing ran after the projector and the worksheet');
eq(await page.evaluate(() => document.querySelectorAll('#printArea img, #printArea svg, #printArea script').length), 0, 'no img, svg or script in the printed area');

/* ── 11. round trip: show as rows, replace, same bank ───────────────────── */
await load();
await paste([
  ['Solve: 2x + 1 = 9, then check', '"2x = 10"<br>x = 5', '2x = 8<br>x = 4', 'Subtract, "not add".', 'Two-Step Equations', 'High (9–12)'].map(c => c).join(T),
  ['Minus &minus;3 − 4', 'tab\there', '=oops', '', 'fractions', 'elementary'].join(T)
].join('\n'));
// the second row has a raw tab inside a cell, which splits it; use quotes
await page.fill('#importText', [
  ['Solve: 2x + 1 = 9, then check', '2x = 10<br>x = 5', '2x = 8<br>x = 4', 'Subtract, "not add".'].join(T) + T + 'Two-Step Equations' + T + 'High (9–12)',
  ['Minus &minus;3', '"tab\there\nnext"', '=oops', ''].join(T) + T + 'fractions' + T + 'elementary'
].join('\n'));
await preview(); await page.click('#importApplyBtn');
const orig = strip(await bankParsed());
eq(orig.length, 2, 'two rows to round-trip');
await page.click('#importShowBtn');
const shown = await page.inputValue('#importText');
ok(/^Problem\tShown work\tFix\tExplanation\tTopic\tGrade band\n/.test(shown), 'the rows come out with a header');
await page.check('#importModeReplace');
await preview();
l = await lists();
eq(l.add.length + '/' + l.bad.length + '/' + l.dup.length, '2/0/0', 'the box previews back as the same two rows');
page.once('dialog', d => d.accept());
await page.click('#importApplyBtn');
eq(JSON.stringify(strip(await bankParsed())), JSON.stringify(orig), 'replacing with the shown rows gives the same bank');
await page.click('#importShowBtn');
eq(await page.inputValue('#importText'), shown, 'and showing it again gives the same text');
// a row typed in the Add form comes round too
await page.fill('#newProblem', 'Typed: 5 + 5'); await page.fill('#newWork', '5 + 5 = 55\nso 55'); await page.fill('#newFix', '5 + 5 = 10'); await page.fill('#newExplain', 'Add, do not join.');
await page.click('#addProblemBtn');
const withTyped = strip(await bankParsed());
await page.click('#importShowBtn'); await page.check('#importModeReplace'); await preview();
page.once('dialog', d => d.accept()); await page.click('#importApplyBtn');
eq(JSON.stringify(strip(await bankParsed())), JSON.stringify(withTyped), 'a problem typed in the Add form comes back the same');
await page.fill('#importText', ''); 
await page.evaluate(() => localStorage.setItem('mftm_custom_v1', '[]'));
await page.reload({ waitUntil: 'networkidle' }); await page.click('[data-stage="bank"]');
await page.click('#importShowBtn');
ok(/no problems of your own/.test(await status()), 'with nothing of your own, Show says there is nothing to show');
eq(await page.inputValue('#importText'), '', 'and writes nothing');

/* ── 12. the browser will not store it ───────────────────────────────────── */
await load([{ id: 'k', band: 'middle', category: 'other', problem: 'Keep me', work: 'w', fix: 'f', explain: '' }]);
await paste(['Too big', 'w', 'f', 'e'].join(T));
await preview();
await page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('quota'); }; });
await page.click('#importApplyBtn');
ok(/Nothing was saved/.test(await status()), 'a refused save says so: ' + await status());
ok(/Keep me/.test(await page.innerText('#bankList')) && !/Too big/.test(await page.innerText('#bankList')), 'and the bank on screen is the old one');
eq(await page.inputValue('#importText'), ['Too big', 'w', 'f', 'e'].join(T), 'and the paste is still there to try again');

/* ── 13. imported problems travel in a share link like any other ─────────── */
await load();
await paste(['Shared one', 'w', 'f', 'e'].join(T) + T + 'fractions' + T + 'high');
await preview(); await page.click('#importApplyBtn');
await page.click('#shareBtn');
await settle(page, 300);
ok(await page.evaluate(() => !!document.querySelector('dialog[open], [role="dialog"]')), 'Share opens with an imported problem in the bank (it has something to send)');
await page.keyboard.press('Escape');

/* ── 14. keyboard and labels ─────────────────────────────────────────────── */
await load();
for (const [label, id] of [['Rows to import', 'importText'], ['Topic for rows that do not name one', 'importCategory'], ['Grade band for rows that do not name one', 'importBand'],
  ['Add to my problems', 'importModeAppend'], ['Replace all my problems', 'importModeReplace']]) {
  eq(await page.getByLabel(label, { exact: true }).evaluate(e => e.id), id, `"${label}" names its control`);
}
eq(await page.evaluate(() => document.querySelector('#importModeAppend').closest('fieldset').querySelector('legend').textContent), 'What to do with them', 'the two modes are a fieldset with a legend');
eq(await page.getAttribute('#importPreview', 'aria-live'), 'polite', 'the preview is announced');
eq(await page.getAttribute('#importStatus', 'role'), 'status', 'and so is the status line');
await page.fill('#importText', ['K', 'w', 'f', 'e'].join(T));
await page.focus('#importPreviewBtn');
await page.keyboard.press('Enter');
eq((await lists()).add.length, 1, 'Preview works from the keyboard');
await page.keyboard.press('Tab');
eq(await page.evaluate(() => document.activeElement.id), 'importApplyBtn', 'Tab goes to the add button next');
await page.keyboard.press('Space'); await settle(page, 100);
eq((await bankParsed()).length, 1, 'and Space adds the problem');
await paste(['One', 'w', 'f', 'e'].join(T) + '\nbad row');
await preview();
const axe = await a11yScan(page);
eq(axe.length, 0, 'no serious accessibility violation with a preview showing: ' + JSON.stringify(axe));
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
eq((await a11yScan(page)).length, 0, 'and none in dark');

/* ── 15. no console noise ────────────────────────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing left the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
