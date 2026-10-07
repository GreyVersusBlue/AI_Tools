// smoke-play-wheel.mjs — the Review Game Board's spin-the-wheel mode (Path 12
// P3, increment 3), in the page.
//
//   node Tools/review-game-board/test/smoke-play-wheel.mjs         (port 8522)
//   node Tools/review-game-board/test/smoke-play-wheel.mjs --print
//
// What's worth holding still:
//   1. the final wager round and quiz-bowl play as they did: the hashes in
//      PINS were made with --print against the page as v284 left it, before
//      the wheel was written (_rounds-game.mjs is the game played);
//   2. the wheel is off until ticked and a board gains nothing until then;
//   3. a spin is the draw rgb-play.js works out from the board's seed and the
//      spin's number: it is stored before the picture moves, said once in
//      words, and the chosen clue takes the focus; a reload between spins
//      changes nothing; a played clue is never chosen;
//   4. the picture turns only when motion is allowed, and is hidden from a
//      screen reader, the list beside it being its words;
//   5. the two extra wedges are off until ticked, and Double points doubles
//      the next clue played, in either way of scoring, and not a Daily Double;
//   6. Export, Import, Edit questions, Reset game and unticking;
//   7. every text is text, never markup; the block is clean under axe.
// The pure half is smoke-play-core.mjs. Every name and question is made up.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { serve, launch, prepPage, settle, a11yScan, downloadText } from '../../board-check/harness.mjs';
import { sha, OLD_BOARD, DD_BOARD, storageOf, boardStorage, openWith } from './_old-game.mjs';
import { playRoundsGame } from './_rounds-game.mjs';

const PORT = 8522;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_PAGE = BASE + '/Tools/030-review-game-board.html';
const PRINT = process.argv.includes('--print');

const here = path.dirname(fileURLToPath(import.meta.url));
const win = {};
vm.runInContext(fs.readFileSync(path.join(here, '..', 'rgb-play.js'), 'utf8'), vm.createContext({ window: win }));
const P = win.ReviewBoardPlay;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const server = await serve(PORT);
const browser = await launch();
const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
await page.emulateMedia({ reducedMotion: 'reduce' });

console.log('Review Game Board — spin the wheel');

/* ── 1. the two rounds, as they were ────────────────────────────────────── */
/* Made with --print against the page as v284 left it, before it was edited. */
const PINS = {"finalTickedRound":"85fb4a85b15e2043","finalTickedBoard":"bcfd6919c03b65e1","finalTickedStorage":"c4e4226df6dcc9b3","finalWagersRound":"d5cf9e3ba14db06f","finalWagersBoard":"8478ae577cf850c3","finalWagersStorage":"d5feb86007e1a15d","finalRefusedRound":"8ae944b2983cf8df","finalRefusedBoard":"8478ae577cf850c3","finalRefusedStorage":"d5feb86007e1a15d","finalQuestionRound":"6d1809289b466ebb","finalQuestionBoard":"1f318585ba426e7e","finalQuestionStorage":"d5feb86007e1a15d","finalUnmarkedRound":"8a13cdf122be6c4b","finalUnmarkedBoard":"1f318585ba426e7e","finalUnmarkedStorage":"d5feb86007e1a15d","finalScoredRound":"c70998f25a5f6e3d","finalScoredBoard":"250a0348e87f8257","finalScoredStorage":"826faa8e9e0eaa15","finalClosedRound":"3ac89ff2fe4c0361","finalClosedBoard":"d6af94991d94bc41","finalClosedStorage":"826faa8e9e0eaa15","finalExport":"8a44a400b14fc499","finalTakenBackRound":"3ac89ff2fe4c0361","finalTakenBackBoard":"599edb909895f0e1","finalTakenBackStorage":"d5feb86007e1a15d","qbTickedRound":"3ac89ff2fe4c0361","qbTickedBoard":"39b30085688a8249","qbTickedStorage":"db10e1bee5e56640","qbTossupRound":"4724176d6451307c","qbTossupBoard":"ed3eec1e24acfe93","qbTossupStorage":"db10e1bee5e56640","qbBuzzedRound":"6ff0ae674cdb5ba9","qbBuzzedBoard":"ed3eec1e24acfe93","qbBuzzedStorage":"db10e1bee5e56640","qbLockedRound":"391cc4bb884fb49e","qbLockedBoard":"ed3eec1e24acfe93","qbLockedStorage":"db10e1bee5e56640","qbRightRound":"8c77f55505bec058","qbRightBoard":"ed3eec1e24acfe93","qbRightStorage":"0ccfcdf174f483f7","qbBonusRound":"dddaccafbe7003e5","qbBonusBoard":"ed3eec1e24acfe93","qbBonusStorage":"cd232110f28a95c2","qbDeadRound":"846e214b3fc17077","qbDeadBoard":"ed3eec1e24acfe93","qbDeadStorage":"444ab8545a72b376","qbSummaryRound":"12aa8bbc96413046","qbSummaryBoard":"a5459ff2e193f748","qbSummaryStorage":"febccbf2a5f43ba7","qbClosedRound":"d76ed2b78eeb07ff","qbClosedBoard":"c07ed02e03e9c47b","qbClosedStorage":"febccbf2a5f43ba7","qbExport":"a7d4257a20f0141f","qbUndoneRound":"d76ed2b78eeb07ff","qbUndoneBoard":"763b3180d9e39b16","qbUndoneStorage":"cd232110f28a95c2","editedRound":"d76ed2b78eeb07ff","editedBoard":"cbe043656153d719","editedStorage":"cd232110f28a95c2","resetRound":"d76ed2b78eeb07ff","resetBoard":"042ab3cb8b65b970","resetStorage":"e70a3f6812502da7","importedRound":"d76ed2b78eeb07ff","importedBoard":"c94392631bcc4ad5","importedStorage":"d857054dcdcef1eb"};

console.log('1. the final wager round and quiz-bowl play as they did before the wheel');
{
  const got = await playRoundsGame(page, URL_PAGE);
  const hashes = Object.fromEntries(Object.keys(got).map(k => [k, sha(got[k])]));
  if (PRINT) { console.log(JSON.stringify(hashes)); await browser.close(); server.close(); process.exit(0); }
  for (const k of Object.keys(PINS)) eq(hashes[k], PINS[k], `the two rounds: ${k} is what the v284 page gave`);
  eq(Object.keys(got).sort(), Object.keys(PINS).sort(), 'every capture has a pin');
  ok(!/"wheel"/.test(got.resetStorage + got.editedStorage + got.importedStorage + got.qbExport + got.finalExport), 'and no board, file or import of that game holds a wheel');
}

/* ── helpers ────────────────────────────────────────────────────────────── */
const clone = v => JSON.parse(JSON.stringify(v));
const board = name => page.evaluate(n => JSON.parse(localStorage.getItem('gvb-review-board:data:' + n)), name);
const wheel = async name => (await board(name || 'Rivers')).wheel;
const scores = async name => (await board(name || 'Rivers')).teams.map(t => t.score);
const text = id => page.evaluate(x => document.getElementById(x).textContent.replace(/\s+/g, ' ').trim(), id);
const shown = id => page.evaluate(x => { const n = document.getElementById(x); return !!n && getComputedStyle(n).display !== 'none' && !n.hidden; }, id);
const focus = () => page.evaluate(() => { const a = document.activeElement; return a.id || a.getAttribute('aria-label') || a.textContent; });
const landed = () => page.$$eval('#boardCols .cell.wheel-landed', c => c.map(x => [x.getAttribute('aria-label'), x.textContent, x.disabled]));
const list = () => page.$$eval('#wheelList li', l => l.map(x => x.textContent));
const press = async k => { await page.keyboard.press(k); await settle(page, 120); };
const click = async sel => { await page.click(sel); await settle(page, 150); };
const X = tag => `${tag}"'><img src=x onerror="window.__pwned=(window.__pwned||0)+1">&amp;`;
const WHEEL = (seed, more) => Object.assign({ on: true, seed, spins: 0, lose: false, double: false, doubleNext: false, last: null }, more || {});
const withWheel = (b, w) => Object.assign(clone(b), { wheel: w });
/* A seed whose first spin over this board lands on a wedge of the kind wanted. */
const seedFor = (b, more, kind) => {
  for (let i = 0; i < 5000; i++) { const s = P.wheelSpin(b.categories, WHEEL('t-' + i, more)); if (s && s.wedge.kind === kind) return 't-' + i; }
  throw new Error('no seed lands on ' + kind);
};
const axe = async (include, label) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); }, theme);
    await settle(page, 350);
    const scan = await a11yScan(page, { include });
    eq(scan.map(v => v.id + ' ' + v.nodes.join(',')), [], `${label} is clean under axe (${theme})`);
  }
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
};
page.on('dialog', d => d.accept());

/* ── 2. off until ticked ────────────────────────────────────────────────── */
console.log('2. the wheel is off until ticked');
await openWith(page, URL_PAGE, storageOf(OLD_BOARD));
eq([await page.isChecked('#wheelToggle'), await shown('wheelSetup')], [false, false], 'a board from before has the wheel off and no wheel on the page');
eq(await board('Rivers'), OLD_BOARD, 'and its storage is the board it was');
eq(await landed(), [], 'no clue is marked as chosen');
eq(await page.getAttribute('#wheelToggle', 'aria-describedby'), 'wheelRule', 'the tick box is described by its rule');
await press('s');
eq(await board('Rivers'), OLD_BOARD, 'the S key does nothing while the wheel is off');

await page.check('#wheelToggle');
await settle(page, 150);
{
  const b = await board('Rivers'), w = b.wheel;
  ok(/^[0-9a-f]{16}$/.test(w.seed), 'ticking it gives the game a seed');
  eq(Object.assign({}, w, { seed: '' }), WHEEL(''), 'and a wheel with no spin made and both extra wedges off');
  delete b.wheel;
  eq(b, OLD_BOARD, 'which is the only thing the board gains');
}
eq(await shown('wheelSetup'), true, 'the wheel and its rule are shown');
{
  const rule = await text('wheelRule');
  ok(/one wedge for every clue not yet played, and a spin is as likely to land on one wedge as on any other/.test(rule), 'the rule says what is on the wheel and that every wedge is as likely');
  ok(/or the S key/.test(rule) && /chosen clue takes the focus on the board, so Enter opens it/.test(rule), 'and the key that spins and where the focus goes');
  ok(/reloading the page does not change the next spin; Reset game starts a new sequence/.test(rule), 'and that a reload does not re-roll');
  ok(/Two extra wedges are off unless you tick them/.test(rule), 'and that the extra wedges are off to start');
}
eq([await page.isChecked('#wheelLoseToggle'), await page.isChecked('#wheelDoubleToggle')], [false, false], 'both extra wedges are unticked');
ok(/Spin the wheel is on/.test(await text('boardStatus')), 'the change is said in the status line');
eq(await list(), ['Rivers for 200', 'Rivers for 300', 'Deltas for 100', 'Deltas for 200'], 'the list names a wedge for each clue not yet played, and none for the played one');
eq(await text('wheelSummary'), 'What is on the wheel (4 wedges)', 'and counts them');
eq(await text('wheelOdds'), '4 clues not yet played: the wheel has 4 wedges, and a spin is as likely to land on one as on any other (1 in 4).', 'the odds are said in words');
eq([await text('wheelProgress'), await text('wheelStatus')], ['No spin yet.', ''], 'no spin has been made');
eq(await page.getAttribute('#wheelPicture', 'aria-hidden'), 'true', 'the picture is hidden from a screen reader: the list and the status line are its words');
eq(await page.$$eval('#wheelPicture .wheel-wedge', w => w.length), 4, 'the picture has a wedge a clue');
eq(await page.$$eval('#wheelPicture .wheel-label', t => t.map(x => x.textContent)), ['1', '2', '3', '4'], 'numbered as the list is');
eq(await page.getAttribute('#wheelStatus', 'role'), 'status', 'the result line is a status line');
await axe(['#boardCard'], 'the board with the wheel on');

/* ── 3. a spin ──────────────────────────────────────────────────────────── */
console.log('3. a spin is the stored draw, said once, and lands with the focus');
/* The whole game worked out here from the rules, to compare the page with. */
const GAME = (() => {
  const b = clone(OLD_BOARD), w = WHEEL('seed-1'), out = [];
  for (;;) {
    const s = P.wheelSpin(b.categories, w);
    if (!s) break;
    out.push({ n: s.n, cat: s.wedge.cat, clue: s.wedge.clue, label: s.wedge.label, points: b.categories[s.wedge.cat].clues[s.wedge.clue].points, catName: b.categories[s.wedge.cat].name });
    P.wheelApply(w, s);
    b.categories[s.wedge.cat].clues[s.wedge.clue].used = true;
  }
  return out;
})();
eq(GAME.map(g => g.label), ['Rivers for 300', 'Deltas for 200', 'Deltas for 100', 'Rivers for 200'], 'seed-1 on this board is this game, and stays this game');

await openWith(page, URL_PAGE, storageOf(withWheel(OLD_BOARD, WHEEL('seed-1'))));
await page.evaluate(() => {
  window.__says = [];
  new MutationObserver(() => window.__says.push(document.getElementById('wheelStatus').textContent))
    .observe(document.getElementById('wheelStatus'), { childList: true, characterData: true, subtree: true });
});
await click('#wheelSpinBtn');
eq(await text('wheelStatus'), `Spin 1: ${GAME[0].label}. Press Enter to open it.`, 'the spin is said in words, with what to press');
eq(await page.evaluate(() => window.__says.filter(Boolean).length), 1, 'and said once');
eq(await wheel(), WHEEL('seed-1', { spins: 1, last: { n: 1, kind: 'clue', cat: GAME[0].cat, clue: GAME[0].clue } }), 'the spin is counted and kept on the board');
eq(await landed(), [[`${GAME[0].label}, chosen by the wheel`, String(GAME[0].points), false]], 'one clue is marked as chosen, by name');
eq(await focus(), `${GAME[0].label}, chosen by the wheel`, 'and it has the focus');
eq(await page.evaluate(() => getComputedStyle(document.querySelector('.cell.wheel-landed')).outlineStyle), 'dashed', 'the mark is a dashed line');
ok(/▶/.test(await page.evaluate(() => getComputedStyle(document.querySelector('.cell.wheel-landed'), '::before').content)), 'and an arrow, not a colour');
eq(await text('wheelProgress'), `Spins so far: 1. Last: ${GAME[0].label}.`, 'the block says how many spins and the last one');
await press('Enter');
eq([await page.evaluate(() => document.getElementById('overlay').classList.contains('show')), await text('overlayCatPoints')], [true, `${GAME[0].catName} — ${GAME[0].points}`], 'Enter opens the chosen clue');
await press('s');
eq((await wheel()).spins, 1, 'S does not spin while a clue is open');
await press('Space');
await press('1');
eq([await scores(), (await board('Rivers')).categories[GAME[0].cat].clues[GAME[0].clue].used], [[100 + GAME[0].points, 0, -10], true], 'and it is played as any clue is');
eq([await landed(), (await list()).length], [[], 3], 'a played clue is no longer marked, and is off the wheel');

/* a reload between spins changes nothing; S spins; the rest of the game */
await page.reload({ waitUntil: 'networkidle' });
await settle(page, 300);
eq([await page.isChecked('#wheelToggle'), await text('wheelProgress'), await text('wheelStatus')], [true, `Spins so far: 1. Last: ${GAME[0].label}.`, ''], 'a reload keeps the wheel and its count, and announces nothing');
await page.focus('#lightningRoundSeconds');
await press('s');
eq((await wheel()).spins, 1, 'S typed in a box does not spin');
await page.evaluate(() => document.activeElement.blur());
let total = 100 + GAME[0].points;
for (const g of GAME.slice(1)) {
  await press('s');
  eq([await text('wheelStatus'), await focus()], [`Spin ${g.n}: ${g.label}. Press Enter to open it.`, `${g.label}, chosen by the wheel`], `spin ${g.n}, by the S key, is the one the seed gives (${g.label}), reload or not, and has the focus`);
  await press('Enter');
  await press('Space');
  await press('1');
  total += g.points;
  if (g.n === 2) { await page.reload({ waitUntil: 'networkidle' }); await settle(page, 300); }
}
eq(await scores(), [total, 0, -10], 'every clue was landed on once and played');
eq((await board('Rivers')).categories.map(c => c.clues.every(cl => cl.used)), [true, true], 'and none is left');
const done = await boardStorage(page);
await click('#wheelSpinBtn');
eq([await text('wheelStatus'), await boardStorage(page) === done, await focus()], ['Every clue has been played: there is nothing left to spin for.', true, 'wheelSpinBtn'], 'with every clue played a spin says so and counts nothing');
eq([await text('wheelOdds'), await list()], ['Every clue has been played, so there is nothing to spin for.', []], 'and the block says the wheel is empty');

/* a clue closed unasked is still on the wheel; a clue opened by hand is allowed */
await openWith(page, URL_PAGE, storageOf(withWheel(OLD_BOARD, WHEEL('seed-1'))));
await click('#wheelSpinBtn');
await press('Enter');
await press('Escape');
eq([(await landed()).length, (await list()).length, (await wheel()).spins], [1, 4, 1], 'a chosen clue closed before it is asked stays chosen and stays on the wheel');
await click('#boardCols .cell:not(.used):not(.blank):not(.wheel-landed)');
eq(await page.evaluate(() => document.getElementById('overlay').classList.contains('show')), true, 'and another clue can still be opened by hand');
await press('Escape');

/* ── 4. the picture ─────────────────────────────────────────────────────── */
console.log('4. the picture turns only when motion is allowed');
eq(await page.evaluate(() => getComputedStyle(document.getElementById('wheelDisc')).transitionDuration), '0s', 'under reduced motion the wheel does not turn');
await page.emulateMedia({ reducedMotion: 'no-preference' });
eq(await page.evaluate(() => getComputedStyle(document.getElementById('wheelDisc')).transitionDuration), '1.2s', 'with motion allowed it turns for 1.2 seconds');
await page.evaluate(() => {
  window.__says = [];
  new MutationObserver(() => window.__says.push(document.getElementById('wheelStatus').textContent))
    .observe(document.getElementById('wheelStatus'), { childList: true, characterData: true, subtree: true });
});
await page.click('#wheelSpinBtn');
await page.click('#wheelSpinBtn');
await page.keyboard.press('s');
await settle(page, 250);
eq([(await wheel()).spins, await text('wheelStatus')], [2, ''], 'while it turns the spin is already on the board, nothing is said yet, and a second press and the S key do not spin again');
ok(await page.evaluate(() => parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(document.getElementById('wheelDisc').style.transform)[1]) >= 720), 'the wheel is sent round at least twice');
await settle(page, 1500);
{
  const w = await wheel(), s2 = P.wheelSpin(OLD_BOARD.categories, WHEEL('seed-1', { spins: 1 }));
  eq([w.spins, w.last.kind === 'clue' ? [w.last.cat, w.last.clue] : null], [2, [s2.wedge.cat, s2.wedge.clue]], 'the spin is the one the seed gives');
  eq([await text('wheelStatus'), await page.evaluate(() => window.__says.filter(Boolean).length)], [`Spin 2: ${s2.wedge.label}. Press Enter to open it.`, 1], 'when it stops the result is said, once');
  eq(await focus(), `${s2.wedge.label}, chosen by the wheel`, 'and the chosen clue has the focus');
  const at = await page.evaluate(() => parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(document.getElementById('wheelDisc').style.transform)[1]));
  eq(((at % 360) + 360) % 360, (360 - (s2.index + 0.5) * 90) % 360, 'the picture rests with the chosen wedge under the pointer');
}
await page.emulateMedia({ reducedMotion: 'reduce' });

/* ── 5. the extra wedges ────────────────────────────────────────────────── */
console.log('5. Lose a turn and Double points');
await page.check('#wheelLoseToggle');
await settle(page, 150);
eq([(await wheel()).lose, (await list()).slice(-1), await text('wheelStatus')], [true, ['Lose a turn'], 'Lose a turn is now a wedge on the wheel. 4 clues not yet played and 1 extra wedge: the wheel has 5 wedges, and a spin is as likely to land on one as on any other (1 in 5).'], 'ticking Lose a turn adds one wedge and says the new odds');
await page.check('#wheelDoubleToggle');
await settle(page, 150);
eq([(await wheel()).double, (await list()).slice(-2)], [true, ['Lose a turn', 'Double points']], 'ticking Double points adds another');
eq(await page.$$eval('#wheelPicture .wheel-label', t => t.map(x => x.textContent)), ['1', '2', '3', '4', 'L', '×2'], 'the picture letters the two extra wedges');
await axe(['#boardCard'], 'the board with both extra wedges and a chosen clue');
await page.uncheck('#wheelLoseToggle');
await settle(page, 150);
eq([(await wheel()).lose, (await list()).slice(-1)], [false, ['Double points']], 'and unticking takes one off');

{
  const seed = seedFor(OLD_BOARD, { lose: true, double: true }, 'lose');
  await openWith(page, URL_PAGE, storageOf(withWheel(OLD_BOARD, WHEEL(seed, { lose: true, double: true }))));
  const before = await scores();
  await click('#wheelSpinBtn');
  eq([await text('wheelStatus'), await landed(), await focus()], ['Spin 1: Lose a turn. No clue this spin.', [], 'wheelSpinBtn'], 'Lose a turn is said in words, chooses no clue and leaves the focus on the button');
  eq([await wheel(), await scores()], [WHEEL(seed, { lose: true, double: true, spins: 1, last: { n: 1, kind: 'lose' } }), before], 'it is counted, and no score moves');
}
{
  const seed = seedFor(OLD_BOARD, { double: true }, 'double');
  await openWith(page, URL_PAGE, storageOf(withWheel(OLD_BOARD, WHEEL(seed, { double: true }))));
  await click('#wheelSpinBtn');
  eq([await text('wheelStatus'), await landed(), await focus()], ['Spin 1: Double points. The next clue played is worth double.', [], 'wheelSpinBtn'], 'Double points is said in words and chooses no clue');
  eq([(await wheel()).doubleNext, await text('wheelProgress')], [true, 'Spins so far: 1. Last: Double points. A double is waiting: the next clue played is worth twice its points.'], 'the double waits, and the block says so');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 300);
  eq((await wheel()).doubleNext, true, 'a reload keeps the double waiting');
  const s2 = P.wheelSpin(OLD_BOARD.categories, WHEEL(seed, { double: true, spins: 1 }));
  if (s2.wedge.kind === 'clue') {
    await click('#wheelSpinBtn');
    eq(await text('wheelStatus'), `Spin 2: ${s2.wedge.label}. Double points: it is worth twice that. Press Enter to open it.`, 'the next spin on a clue says it is doubled');
  }
  await click('#boardCols .cell:not(.used):not(.blank)');          // Deltas 100, the first open cell, by hand
  eq(await text('overlayCatPoints'), 'Deltas — 200 (double points)', 'the next clue opened says its doubled worth, in words');
  await press('Space');
  eq(await page.$$eval('#awardRow button', b => b.map(x => x.textContent)), ['+200 Otters', '+200 Herons', '+200 Finches'], 'and each team’s button is the doubled points');
  await press('2');
  eq([await scores(), (await wheel()).doubleNext], [[100, 200, -10], false], 'the team scores double, and the double is spent');
  await click('#boardCols .cell:not(.used):not(.blank)');
  eq(await text('overlayCatPoints'), 'Rivers — 200', 'the clue after it is worth its own points');
  await press('Escape');
  await click('#undoScoreBtn');
  eq(await scores(), [100, 0, -10], 'Undo takes the doubled points back off');
}
{
  /* every team answers, doubled */
  const b = withWheel(OLD_BOARD, WHEEL('x', { double: true, doubleNext: true, spins: 1, last: { n: 1, kind: 'double' } }));
  b.everyTeam = true;
  await openWith(page, URL_PAGE, storageOf(b));
  await click('#boardCols .cell:not(.used):not(.blank)');
  await press('Space');
  ok(/Right scores 200;/.test(await text('etaRule')), 'with every team answering the panel says the doubled points');
  await press('1');
  await press('2');
  await press('Enter');
  eq([await scores(), (await wheel()).doubleNext], [[300, 200, -10], false], 'every team marked right scores double, and the double is spent');
  eq(await text('boardStatus'), 'Deltas 100 (double points). Right, +200: Otters and Herons. No answer: Finches.', 'and the status line says it was doubled');
}
{
  /* a Daily Double is its own wager: not doubled, and the double waits */
  const b = withWheel(DD_BOARD, WHEEL('x', { double: true, doubleNext: true, spins: 1, last: { n: 1, kind: 'double' } }));
  await openWith(page, URL_PAGE, storageOf(b));
  await click('#boardCols .cell:not(.used):not(.blank)');
  await page.fill('#wagerAmount', '50');
  await click('#wagerStartBtn');
  await press('Space');
  eq(await page.$$eval('#awardRow button', x => x.map(y => y.textContent)), ['Correct: +50 Otters', 'Incorrect: −50 Otters'], 'a Daily Double is the wager, not doubled');
  await click('#awardRow button');
  eq([await scores('Wager'), (await wheel('Wager')).doubleNext], [[350, 150], true], 'it scores the wager, and the double still waits');
}

/* ── 6. files, Edit, Reset, unticking ───────────────────────────────────── */
console.log('6. Export, Import, Edit questions, Reset game and unticking');
await openWith(page, URL_PAGE, storageOf(withWheel(OLD_BOARD, WHEEL('seed-1', { double: true }))));
await click('#wheelSpinBtn');
const kept = await wheel();
const exported = await downloadText(page, '#exportBoardBtn', { what: 'the board file' });
eq(JSON.parse(exported).wheel, kept, 'Export JSON carries the wheel: its seed, its count and its last spin');
{
  const file = JSON.parse(exported);
  file.wheel.extra = X('extra');
  file.wheel.lose = 'yes';
  file.wheel.last = { n: 1, kind: 'clue', cat: 7, clue: 0, more: X('more') };
  await page.setInputFiles('#importBoardFile', { name: 'wheel.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await settle(page, 500);
  eq(await wheel('Rivers (2)'), Object.assign({}, kept, { last: null }), 'Import JSON cleans the wheel: only what a wheel holds is kept, and a last spin on a clue the board does not have is dropped');
  const s2 = P.wheelSpin(OLD_BOARD.categories, Object.assign({}, kept));
  await click('#wheelSpinBtn');
  eq(await text('wheelStatus'), P.wheelSentence(s2, kept), 'and the imported game goes on with the spin the seed gives next');
  const file2 = JSON.parse(exported);
  delete file2.wheel.seed;
  await page.setInputFiles('#importBoardFile', { name: 'noseed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file2)) });
  await settle(page, 500);
  ok(/^[0-9a-f]{16}$/.test((await wheel('Rivers (3)')).seed), 'a file’s wheel with no seed is given one');
  await page.selectOption('#boardSwitch', 'Rivers');
  await settle(page, 200);
}
await click('#editBoardBtn');
await click('#buildFromManualBtn');
await settle(page, 300);
eq(await wheel(), Object.assign({}, kept, { last: null }), 'Edit questions and Save board keep the wheel and its count, and forget where it last landed (the clues may have moved)');
eq(await landed(), [], 'so no clue is marked');
await click('#resetGameBtn');
await settle(page, 200);
{
  const w = await wheel();
  ok(/^[0-9a-f]{16}$/.test(w.seed) && w.seed !== 'seed-1', 'Reset game gives the wheel a new seed');
  eq(Object.assign({}, w, { seed: '' }), WHEEL('', { double: true }), 'no spin made, and the settings kept');
}
await page.uncheck('#wheelToggle');
await settle(page, 150);
eq([(await wheel()).on, await shown('wheelSetup'), await landed()], [false, false, []], 'unticking hides the wheel and marks no clue');
ok(/Spin the wheel is off/.test(await text('boardStatus')), 'and says so');
await press('s');
eq((await wheel()).spins, 0, 'and S no longer spins');
{
  const b = withWheel(OLD_BOARD, WHEEL('x', { double: true, doubleNext: true, spins: 1, last: { n: 1, kind: 'double' } }));
  await openWith(page, URL_PAGE, storageOf(b));
  await page.uncheck('#wheelToggle');
  await settle(page, 150);
  await click('#boardCols .cell:not(.used):not(.blank)');
  eq([await text('overlayCatPoints'), (await wheel()).doubleNext], ['Deltas — 100', false], 'unticking with a double waiting drops the double');
  await press('Escape');
}

/* ── 7. text is text ────────────────────────────────────────────────────── */
console.log('7. every text is text');
{
  const b = withWheel(OLD_BOARD, WHEEL(''));
  b.categories[0].name = X('cat');
  b.wheel.seed = seedFor(b, {}, 'clue');
  for (let i = 0; i < 5000; i++) { const s = P.wheelSpin(b.categories, WHEEL('m-' + i)); if (s.wedge.cat === 0) { b.wheel.seed = 'm-' + i; break; } }
  await openWith(page, URL_PAGE, storageOf(b));
  await click('#wheelSpinBtn');
  ok((await list())[0] === X('cat') + ' for 200', 'a category that is markup is text in the list');
  ok((await text('wheelStatus')).includes(X('cat').replace(/\s+/g, ' ')), 'and in the status line');
  ok((await landed())[0][0].startsWith(X('cat')), 'and in the chosen clue’s name');
  eq(await page.evaluate(() => [window.__pwned, document.querySelectorAll('#wheelSetup img, #boardCols img').length]), [undefined, 0], 'and nothing of it ran or became an element');
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
