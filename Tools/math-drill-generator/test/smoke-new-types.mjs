// smoke-new-types.mjs — the new drill types on the page, not just in the math.
//
//   node Tools/math-drill-generator/test/smoke-new-types.mjs
//
// drill-math.test.mjs proves the arithmetic. This proves the arithmetic
// reaches the paper: these types are not `number symbol number`, so they carry
// their own display text, and the failure this catches is a worksheet that
// prints "undefined + undefined = _____" while the answer key is perfect.
//
//   Every new template renders problems and a matching answer key.
//
//   Vertical (stacked column) format is a whole-number convention. A fraction
//   or a parenthesised expression must be written across even when the sheet
//   is set to vertical, rather than being forced into a column-addition table.
//
//   The four original fact drills still stack.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Also covers the riddle / colour-by-answer / maze self-checking OUTPUT
// FORMATS on the page: that the picker offers all three, that each renders
// real content (not "undefined" where a decoder value or a maze junction
// should be), that the maze's plain problem list is genuinely replaced
// rather than left behind underneath it, and that printing carries the
// self-check section through the same way it carries the plain worksheet.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8126;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/026-math-drill-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });

/* The preview shows the worksheet OR the answer key, never both, so reading a
   sheet means visiting each view. */
const readView = () => page.evaluate(() => ({
  problems: Array.from(document.querySelectorAll('#previewArea .problems .p'))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()),
  answers: Array.from(document.querySelectorAll('#previewArea .answers .a'))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()),
  stacked: document.querySelectorAll('#previewArea .vert-table, #previewArea .vert-div').length,
}));

async function sheet() {
  await page.click('#viewWorksheetBtn');
  await settle(page, 200);
  const worksheet = await readView();
  await page.click('#viewAnswersBtn');
  await settle(page, 200);
  const key = await readView();
  await page.click('#viewWorksheetBtn');
  await settle(page, 200);
  return { problems: worksheet.problems, stacked: worksheet.stacked, answers: key.answers };
}

async function chooseTemplate(key) {
  await page.selectOption('#templateKey', key);
  await settle(page, 400);
}

console.log('Math Drill Generator — new drill types on the page');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });
await settle(page, 400);

/* ── 1. every new template is offered ────────────────────────────────────── */
const options = await page.evaluate(() =>
  Array.from(document.getElementById('templateKey').options).map(o => o.value));
for (const key of ['integers', 'decimals', 'fractions', 'percent', 'ooo']) {
  ok(options.includes(key), `"${key}" is in the template picker`);
}

/* ── 2. each one renders real problems and a matching key ────────────────── */
const SHAPES = {
  integers: /^\d+\.\s*-?\d+ [+−×] \(?-?\d+\)? = _+$/,
  decimals: /^\d+\.\s*\d+(\.\d)? [+−×] \d+(\.\d)? = _+$/,
  fractions: /^\d+\.\s*\d+\/\d+ [+−] \d+\/\d+ = _+$/,
  percent: /^\d+\.\s*\d+% of \d+ = _+$/,
  ooo: /^\d+\.\s*[\d\s+−×÷()]+ = _+$/,
};
for (const [key, shape] of Object.entries(SHAPES)) {
  await chooseTemplate(key);
  const s = await sheet();
  ok(s.problems.length > 0, `"${key}" renders problems`);
  eq(s.answers.length, s.problems.length, `"${key}" answers one-to-one with the problems`);
  ok(!s.problems.some(p => /undefined|NaN/.test(p)), `no undefined or NaN in the "${key}" problems`);
  ok(!s.answers.some(a => /undefined|NaN/.test(a)), `no undefined or NaN in the "${key}" answer key`);
  ok(shape.test(s.problems[0]), `"${key}" problems are written the way that type is written: ${JSON.stringify(s.problems[0])}`);
}

/* ── 3. these types are never stacked into a column-addition table ───────── */
await page.selectOption('#format', 'vertical');
await settle(page, 400);
for (const key of ['fractions', 'percent', 'ooo', 'integers', 'decimals']) {
  await chooseTemplate(key);
  const s = await sheet();
  eq(s.stacked, 0, `"${key}" is written across even in vertical format`);
  ok(SHAPES[key].test(s.problems[0]), `and still reads correctly: ${JSON.stringify(s.problems[0])}`);
}

/* ── 4. the original four still stack ────────────────────────────────────── */
for (const key of ['addition', 'subtraction', 'multiplication', 'division']) {
  await chooseTemplate(key);
  const s = await sheet();
  ok(s.stacked > 0, `"${key}" still stacks in vertical format`);
}

/* ── 5. and still read across in horizontal format ───────────────────────── */
await page.selectOption('#format', 'horizontal');
await settle(page, 400);
await chooseTemplate('multiplication');
const horiz = await sheet();
eq(horiz.stacked, 0, 'horizontal format stacks nothing');
ok(/^\d+\.\s*\d+ × \d+ = _+$/.test(horiz.problems[0]),
   'and multiplication reads across as it always did: ' + JSON.stringify(horiz.problems[0]));

/* ── 6. printing carries the same problems ───────────────────────────────── */
await chooseTemplate('fractions');
const before = (await sheet()).problems[0];
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
const printed = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#printArea .problems .p'))
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()));
ok(printed.length > 0, 'the printed sheet has problems on it');
eq(printed[0], before, 'and they are the ones that were previewed');

/* ── 7. the self-checking format picker offers all three ─────────────────── */
await chooseTemplate('addition');
const selfCheckOptions = await page.evaluate(() =>
  Array.from(document.getElementById('selfCheck').options).map(o => o.value));
for (const v of ['none', 'riddle', 'colorByAnswer', 'maze']) {
  ok(selfCheckOptions.includes(v), `"${v}" is offered in the self-checking format picker`);
}

async function chooseSelfCheck(mode) {
  await page.selectOption('#selfCheck', mode);
  await settle(page, 400);
}

/* ── 8. riddle: worksheet shows blanks + decoder, key shows it solved ────── */
await chooseSelfCheck('riddle');
const riddleWorksheet = await page.evaluate(() => ({
  hasBlanks: document.querySelectorAll('#previewArea .riddle-blank').length > 0,
  blankNums: Array.from(document.querySelectorAll('#previewArea .riddle-blank-num')).map(e => e.textContent),
  decoderItems: document.querySelectorAll('#previewArea .riddle-decoder-item').length,
  plainProblemsStillThere: document.querySelectorAll('#previewArea .problems .p').length,
}));
ok(riddleWorksheet.hasBlanks, 'riddle worksheet shows the punchline as blanks');
ok(riddleWorksheet.blankNums.length > 0 && riddleWorksheet.blankNums.every(n => /^\d+(\.\d+)?$/.test(n)),
   'every blank is labelled with a real decoder number, not "undefined": ' + JSON.stringify(riddleWorksheet.blankNums));
ok(riddleWorksheet.decoderItems > 0, 'the decoder key is printed on the worksheet');
ok(riddleWorksheet.plainProblemsStillThere > 0, 'riddle mode keeps the plain problem list (it only adds a section)');

await page.click('#viewAnswersBtn');
await settle(page, 300);
const riddleKey = await page.evaluate(() => {
  const el = document.querySelector('#previewArea .riddle-solved');
  return el ? el.textContent.trim() : null;
});
ok(!!riddleKey && riddleKey.length > 0, 'the answer key shows the solved riddle text');
ok(!/undefined|NaN/.test(riddleKey || ''), 'and it has no "undefined"/"NaN" in it: ' + JSON.stringify(riddleKey));
await page.click('#viewWorksheetBtn');
await settle(page, 200);

/* ── 9. colour-by-answer: worksheet is plain numbers, key is coloured ────── */
await chooseSelfCheck('colorByAnswer');
const cbaWorksheet = await page.evaluate(() => ({
  cells: document.querySelectorAll('#previewArea .cba-cell:not(.cba-blank)').length,
  anyColored: Array.from(document.querySelectorAll('#previewArea .cba-cell')).some(e => e.getAttribute('style')),
  legendItems: document.querySelectorAll('#previewArea .cba-legend-item').length,
}));
ok(cbaWorksheet.cells > 0, 'colour-by-answer worksheet has numbered cells');
ok(!cbaWorksheet.anyColored, 'the printable worksheet grid is left uncoloured (black-and-white safe)');
ok(cbaWorksheet.legendItems > 0, 'a colour-name legend is printed for photocopying');

await page.click('#viewAnswersBtn');
await settle(page, 300);
const cbaKey = await page.evaluate(() => {
  const filled = Array.from(document.querySelectorAll('#previewArea .cba-cell-filled'));
  return { count: filled.length, allColored: filled.every(e => /background/.test(e.getAttribute('style') || '')) };
});
ok(cbaKey.count > 0, 'the answer key grid has filled cells');
ok(cbaKey.allColored, 'and every one of them actually has a background colour set');
await page.click('#viewWorksheetBtn');
await settle(page, 200);

/* ── 10. maze: replaces the plain problem list entirely ──────────────────── */
await chooseSelfCheck('maze');
const mazeWorksheet = await page.evaluate(() => ({
  mazeGridCells: document.querySelectorAll('#previewArea .maze-grid .maze-cell').length,
  junctions: document.querySelectorAll('#previewArea .maze-junction').length,
  choices: Array.from(document.querySelectorAll('#previewArea .maze-junction-choices')).map(e => e.textContent),
  plainProblemsGone: document.querySelectorAll('#previewArea > .sheet > .problems').length,
}));
ok(mazeWorksheet.mazeGridCells > 0, 'the maze grid renders cells');
ok(mazeWorksheet.junctions > 0, 'at least one junction is offered');
ok(mazeWorksheet.choices.every(c => !/undefined|NaN/.test(c)), 'no undefined/NaN in any junction\'s choices');
eq(mazeWorksheet.plainProblemsGone, 0, 'maze mode replaces the plain problem grid rather than leaving it underneath');

await page.click('#viewAnswersBtn');
await settle(page, 300);
const mazeKey = await page.evaluate(() => ({
  correctMarked: document.querySelectorAll('#previewArea .maze-choice-correct').length,
  onPath: document.querySelectorAll('#previewArea .maze-onpath').length,
}));
ok(mazeKey.correctMarked > 0, 'the answer key marks the correct choice at every junction');
ok(mazeKey.onPath > 0, 'and shades the solved path on the map');
await page.click('#viewWorksheetBtn');
await settle(page, 200);

/* ── 11. printing carries the self-check section through ─────────────────── */
await page.evaluate(() => { window.print = function () {}; });
await page.click('#printBtn');
await settle(page);
const printedMaze = await page.evaluate(() => ({
  mazeGrid: document.querySelectorAll('#printArea .maze-grid').length,
  junctionList: document.querySelectorAll('#printArea .maze-junction-list').length,
}));
ok(printedMaze.mazeGrid > 0 && printedMaze.junctionList > 0, 'the printed sheet carries the maze through');

await chooseSelfCheck('none');

/* ── 12. no console noise anywhere in the run ─────────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
