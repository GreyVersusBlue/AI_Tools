// smoke-boards.mjs — the Virtual Manipulatives Board in a real browser.
//
//   node Tools/virtual-manipulatives-board/test/smoke-boards.mjs
//
// The board has no pure-logic module to test — every piece is a DOM node and
// the saved-state feature round-trips through the DOM — so this is a browser
// suite from the start. What it holds down:
//
//   Persistence. A reload used to discard the whole board. The working board
//   is now autosaved, and named boards can be saved, stepped through, renamed
//   and deleted. Each of those is asserted against what actually comes back
//   after a real page reload, not against the in-memory model.
//
//   No console errors, ever — the site's standing bar for every tool.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8153;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/080-virtual-manipulatives-board.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1280, height: 900 });

/** Answers the next window.prompt/confirm with `value`, once. */
async function answerOnce(value) {
  await page.evaluate(v => {
    const realPrompt = window.prompt, realConfirm = window.confirm;
    window.prompt = function () { window.prompt = realPrompt; return v; };
    window.confirm = function () { window.confirm = realConfirm; return v !== null && v !== false; };
  }, value);
}

const pieceTypes = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('#board .piece')).map(p => p.getAttribute('data-piece-type')));

const savedNames = () => page.evaluate(() => {
  const raw = localStorage.getItem('vmb_boards_v1');
  return raw ? JSON.parse(raw).boards.map(b => b.name) : [];
});

const selectOptions = () => page.evaluate(() =>
  Array.from(document.getElementById('boardSelect').options).map(o => o.value));

console.log('Virtual Manipulatives Board — saved board states');

await page.goto(URL_PAGE, { waitUntil: 'networkidle' });

/* ── 1. an empty first run ───────────────────────────────────────────────── */
eq((await pieceTypes()).length, 0, 'first run opens with an empty board');
eq((await selectOptions()).length, 1, 'the board picker has only the working-board row when nothing is saved');

/* ── 2. build demo one and save it under a name ──────────────────────────── */
await page.click('[data-add="ten"]');
await page.click('[data-add="unit"]');
await page.click('[data-add="unit"]');
await page.click('[data-add-fraction="4"]');
eq((await pieceTypes()).join(','), 'ten,unit,unit,fraction-4', 'four pieces land on the board');

await answerOnce('Place value: 12');
await page.click('#saveBoardBtn');
await settle(page);
eq((await savedNames()).join(','), 'Place value: 12', 'the board saves under the typed name');

/* ── 3. a second, different demo ─────────────────────────────────────────── */
await page.click('#clearBoardBtn');
await page.click('[data-add="alg-posx"]');
await page.click('[data-add="alg-neg1"]');
await answerOnce('Zero pairs');
await page.click('#saveAsBoardBtn');
await settle(page);
eq((await savedNames()).join(','), 'Place value: 12,Zero pairs', 'a second board is added, not overwritten');

/* ── 4. stepping through the prepped demos ──────────────────────────────── */
await page.click('#prevBoardBtn');
await settle(page);
eq((await pieceTypes()).join(','), 'ten,unit,unit,fraction-4', 'Prev steps back to the first demo');
await page.click('#nextBoardBtn');
await settle(page);
eq((await pieceTypes()).join(','), 'alg-posx,alg-neg1', 'Next steps forward to the second demo');

/* ── 5. positions survive a save/load round trip ─────────────────────────── */
await page.evaluate(() => {
  const p = document.querySelector('#board .piece');
  p.style.left = '300px'; p.style.top = '140px';
});
await page.click('#saveBoardBtn');            // named board already loaded → saves in place
await settle(page);
await page.click('#prevBoardBtn');
await settle(page);
await page.click('#nextBoardBtn');
await settle(page);
const pos = await page.evaluate(() => {
  const p = document.querySelector('#board .piece');
  return [p.style.left, p.style.top];
});
eq(pos.join(','), '300px,140px', 'a dragged piece comes back at the position it was saved at');

/* ── 6. the number line travels with the board ───────────────────────────── */
await page.evaluate(() => {
  document.querySelector('.tab-btn[data-pane="numberline"]').click();
  document.getElementById('nlMin').value = '-4';
  document.getElementById('nlMax').value = '4';
  document.getElementById('rebuildLineBtn').click();
});
await page.evaluate(() => {
  const line = document.getElementById('nlLine').getBoundingClientRect();
  const at = pct => {
    const ev = new MouseEvent('click', { clientX: line.left + line.width * pct, clientY: line.top, bubbles: true });
    document.getElementById('nlLine').dispatchEvent(ev);
  };
  at(0.25); at(0.75);
});
await settle(page);
eq(await page.evaluate(() => document.querySelectorAll('#nlMarkers .nl-marker').length), 2, 'two markers land on the line');
await page.click('#saveBoardBtn');
await settle(page);
const lineSaved = await page.evaluate(() => {
  const b = JSON.parse(localStorage.getItem('vmb_boards_v1')).boards.find(x => x.name === 'Zero pairs');
  return [b.state.line.min, b.state.line.max, b.state.line.markers.length];
});
eq(lineSaved.join(','), '-4,4,2', 'the line range and its markers save with the board');

/* ── 7. the working board survives a reload ─────────────────────────────── */
await page.click('.tab-btn[data-pane="blocks"]');
await page.click('[data-add="hundred"]');     // an unsaved change on top of "Zero pairs"
await settle(page);
await page.reload({ waitUntil: 'networkidle' });
await settle(page);
eq((await pieceTypes()).join(','), 'alg-posx,alg-neg1,hundred', 'the unsaved working board comes back after a reload');
eq(await page.evaluate(() => document.querySelectorAll('#nlMarkers .nl-marker').length), 2, 'number-line markers come back too');
ok(/Unsaved changes/.test(await page.textContent('#saveStatus')), 'the status line flags the unsaved change');

/* ── 8. loading over unsaved work asks first, and a refusal is honored ──── */
await answerOnce(false);                       // "no, don't lose my work"
await page.selectOption('#boardSelect', 'Place value: 12');
await settle(page);
eq((await pieceTypes()).join(','), 'alg-posx,alg-neg1,hundred', 'declining the confirm leaves the board alone');
eq(await page.inputValue('#boardSelect'), 'Zero pairs', 'the picker snaps back to the loaded board');

/* ── 9. rename keeps the state, and never eats another board ────────────── */
await answerOnce('Place value: 12');           // rename "Zero pairs" onto a taken name
await page.click('#renameBoardBtn');
await settle(page);
eq((await savedNames()).join(','), 'Place value: 12,Place value: 12 (2)', 'a colliding rename is suffixed, not merged');

/* ── 10. delete removes the record and leaves the screen alone ──────────── */
await answerOnce(true);
await page.click('#deleteBoardBtn');
await settle(page);
eq((await savedNames()).join(','), 'Place value: 12', 'the deleted board is gone from storage');
eq((await pieceTypes()).join(','), 'alg-posx,alg-neg1,hundred', 'deleting a saved board does not clear the screen');

/* ── 11. no console noise anywhere in the run ───────────────────────────── */
eq(page.__errs.length, 0, 'no page/console errors: ' + JSON.stringify(page.__errs));
eq(page.__blocked.length, 0, 'nothing tried to leave the site: ' + JSON.stringify(page.__blocked));

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
