// printables-logic.test.mjs — pure-logic checks for the four "more
// printables" generators (word search, crossword, bingo, matching quiz).
//
//   node Tools/vocab-flashcard-generator/test/printables-logic.test.mjs
//
// vfg-printables.js is pure — no DOM, same discipline as vfg-layout.js and
// math-drill-generator/mdg-generate.js — so the part that matters most
// (every generated puzzle is actually internally consistent: a word search
// term really is at the grid position it claims, a crossword answer really
// fills its numbered slot, a bingo card really only contains items from the
// caller's master list, a matching quiz's answer key really points at the
// definition it claims to) is checked directly in Node instead of through a
// browser. The browser-level wiring (buttons exist, print output renders, no
// console errors) is smoke-printables.mjs, next to this file.
//
// This module is a browser-style IIFE that attaches to `global` — loading it
// with the Function constructor (the same trick drill-math.test.mjs uses for
// mdg-generate.js) keeps it testable from Node with no build step and no
// second copy of the file.
//
// Exits 1 on any failure. Every word here is invented or public-domain.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const globalShim = {};
new Function('global', fs.readFileSync(path.join(dir, '..', 'vfg-printables.js'), 'utf8'))(globalShim);
const P = globalShim.VfgPrintables;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const group = (name) => console.log('\n' + name);

function item(term, definition, extra) {
  return Object.assign({ term, definition: definition || '', example: '', pronunciation: '', partOfSpeech: '' }, extra || {});
}

/* ===================================================================== */
group('Word search — too-few is honest, not garbage');
eq(P.generateWordSearch([item('Ox'), item('Cat')]), { ok: false, reason: 'too-few', minTerms: 3, have: 2 },
  'two terms refuses rather than generating a puzzle');
ok(P.generateWordSearch([]).ok === false, 'an empty list refuses too');

group('Word search — every placed term is really findable at its reported position');
const wsItems = [
  item('Photosynthesis'), item('Mitosis'), item('Osmosis'), item('Ecosystem'),
  item('Enzyme'), item('Chlorophyll'), item('Nucleus'), item('Habitat'),
];
const ws = P.generateWordSearch(wsItems);
ok(ws.ok, 'a real-sized list generates a puzzle');
if (ws.ok) {
  eq(ws.placements.length + ws.skipped.length, wsItems.length, 'every candidate is either placed or reported skipped, none vanish');
  ws.placements.forEach((pl) => {
    const wanted = P.lettersOnly(pl.term);
    let found = '';
    for (let i = 0; i < pl.length; i++) found += ws.grid[pl.row + pl.dr * i][pl.col + pl.dc * i];
    eq(found, wanted, `"${pl.term}" is actually spelled out at its reported (row,col,dr,dc)`);
  });
  ok(ws.grid.length === ws.size && ws.grid[0].length === ws.size, 'the grid is size x size');
  let allLetters = true;
  ws.grid.forEach((row) => row.forEach((ch) => { if (!/^[A-Z]$/.test(ch)) allLetters = false; }));
  ok(allLetters, 'every grid cell holds exactly one A-Z letter (no gaps left unfilled)');
}

group('Word search — same list regenerates the same puzzle (seeded, not Math.random)');
const wsAgain = P.generateWordSearch(wsItems);
eq(ws.grid, wsAgain.grid, 'identical input produces an identical grid');
eq(ws.placements, wsAgain.placements, 'and identical placements');

/* ===================================================================== */
group('Crossword — too-few is honest');
eq(P.generateCrossword([item('Ox', 'a large animal'), item('Cat', 'a small pet')]),
  { ok: false, reason: 'too-few', minTerms: 3, have: 2 }, 'two terms refuses rather than generating a puzzle');
eq(P.generateCrossword([item('Ox', ''), item('Cat', ''), item('Dog', '')]),
  { ok: false, reason: 'too-few', minTerms: 3, have: 0 }, 'terms with no definition are not eligible clues at all');

group('Crossword — terms that share no letters with anything are dropped and reported, not silently missing');
const cwItems = [
  item('Photosynthesis', 'process plants use to make food'),
  item('Ecosystem', 'a community of living things and their surroundings'),
  item('Mitosis', 'a kind of cell division'),
  item('Osmosis', 'movement of water across a membrane'),
  item('Enzyme', 'a protein that speeds up a reaction'),
  item('Qxjkvw', 'a nonsense term sharing no letters with the others above, on purpose'),
];
const cw = P.generateCrossword(cwItems);
ok(cw.ok, 'an overlapping-letters list produces a crossword');
if (cw.ok) {
  ok(cw.skipped.includes('Qxjkvw'), 'the disjoint-letters term is reported as skipped');
  ok(cw.placements.length >= 2, 'at least two terms actually intersected and placed');
  eq(cw.placements.length + cw.skipped.length, cwItems.length, 'every candidate is placed or skipped, none vanish');
  cw.placements.forEach((pl) => {
    const dr = pl.dir === 'down' ? 1 : 0, dc = pl.dir === 'across' ? 1 : 0;
    let found = '';
    for (let i = 0; i < pl.letters.length; i++) found += cw.grid[pl.row + dr * i][pl.col + dc * i];
    eq(found, pl.letters, `"${pl.term}"'s answer fills its numbered slot in the grid exactly`);
    ok(Number.isInteger(pl.number) && pl.number > 0, `"${pl.term}" got a clue number`);
  });
  ok(cw.width > 0 && cw.height > 0, 'the grid has a real bounding box');
}

group('Crossword — mutually disjoint terms report no-fit instead of a fake one-word puzzle');
const noFit = P.generateCrossword([
  item('Bqy', 'nonsense word one'), item('Xzf', 'nonsense word two'), item('Jkw', 'nonsense word three'),
]);
eq(noFit, { ok: false, reason: 'no-fit', minTerms: 3, have: 3 }, 'three terms with no shared letters refuse rather than faking a puzzle');

/* ===================================================================== */
group('Bingo — too few call-items is honest');
eq(P.generateBingoCards([item('A'), item('B'), item('C')]),
  { ok: false, reason: 'too-few', minItems: 9, have: 3 }, 'three items refuses (need at least 9 for a 3x3)');

group('Bingo — card sizing follows the pool, cells only ever come from the master list');
const bingoItems9 = Array.from({ length: 9 }, (_, i) => item('Term' + i, 'Definition ' + i));
const b9 = P.generateBingoCards(bingoItems9, { count: 3 });
ok(b9.ok && b9.size === 3 && b9.free === false, 'exactly 9 items -> a 3x3 card, no free space');
eq(b9.cards.length, 3, 'produced the requested card count');
if (b9.ok) {
  const callTexts = new Set(b9.callList.map((c) => c.text));
  b9.cards.forEach((card, idx) => {
    eq(card.cells.length, 9, `card ${idx} has size*size cells`);
    const texts = card.cells.map((c) => c.text);
    ok(new Set(texts).size === texts.length, `card ${idx} has no duplicate cell text`);
    texts.forEach((t) => ok(callTexts.has(t), `card ${idx}'s cell "${t}" is on the caller's master list`));
  });
}

const bingoItems25 = Array.from({ length: 25 }, (_, i) => item('T' + i, 'D' + i));
const b25 = P.generateBingoCards(bingoItems25, { count: 4 });
ok(b25.ok && b25.size === 5 && b25.free === true, '25+ items -> a 5x5 card with a FREE center');
if (b25.ok) {
  b25.cards.forEach((card, idx) => {
    eq(card.cells[12], { free: true, text: 'FREE' }, `card ${idx}'s center cell (index 12 of 25) is FREE`);
    const nonFree = card.cells.filter((c) => !c.free);
    eq(nonFree.length, 24, `card ${idx} has 24 real cells plus the FREE one`);
  });
  // With a pool this much bigger than one card, at least one pair of cards
  // should differ — "a class doesn't all get identical cards".
  const sig = (card) => card.cells.map((c) => c.text).join('|');
  const distinct = new Set(b25.cards.map(sig));
  ok(distinct.size > 1, 'cards in the same set are not all identical');
}

group('Bingo — same list, same seed, reproducible cards');
const b9Again = P.generateBingoCards(bingoItems9, { count: 3 });
eq(b9, b9Again, 'identical input produces identical cards (seeded, not Math.random)');

/* ===================================================================== */
group('Matching quiz — too-few is honest');
eq(P.generateMatchingQuiz([item('Ox', 'a large animal')]),
  { ok: false, reason: 'too-few', minTerms: 2, have: 1 }, 'one term refuses rather than a one-row quiz');
eq(P.generateMatchingQuiz([item('Ox', 'a large animal'), item('Cat', '')]),
  { ok: false, reason: 'too-few', minTerms: 2, have: 1 }, 'a term with no definition is not eligible');

group('Matching quiz — the answer key really points at the right definition');
const mqItems = [
  item('Photosynthesis', 'process plants use to make food'),
  item('Mitosis', 'a kind of cell division'),
  item('Osmosis', 'movement of water across a membrane'),
  item('Ecosystem', 'a community of living things and their surroundings'),
  item('Enzyme', 'a protein that speeds up a reaction'),
];
const mq = P.generateMatchingQuiz(mqItems);
ok(mq.ok, 'a real list generates a matching quiz');
if (mq.ok) {
  eq(mq.left.length, mqItems.length, 'one row per eligible term');
  eq(mq.right.length, mqItems.length, 'one scrambled definition per term');
  eq(mq.answerKey.length, mqItems.length, 'one answer-key row per term');
  const letters = mq.right.map((r) => r.letter);
  ok(new Set(letters).size === letters.length, 'every definition gets a distinct letter');
  mq.answerKey.forEach((row) => {
    const original = mqItems.find((it) => it.term === row.term);
    const rightEntry = mq.right.find((r) => r.letter === row.letter);
    ok(!!rightEntry, `answer key letter "${row.letter}" for "${row.term}" exists in the right column`);
    eq(rightEntry.definition, original.definition, `"${row.term}"'s answer-key letter really points at its own definition`);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }
