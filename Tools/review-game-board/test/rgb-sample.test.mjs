// rgb-sample.test.mjs — 030's sample board (rgb-sample.js) against the rules the board editor
// holds a board to, one check per rule, with a mutant per rule.
//
//   node Tools/review-game-board/test/rgb-sample.test.mjs      (or: npm run test:rgb-sample)
//
// The rules, each read off the page:
//   R1 every category has a name and five clues, each with a question and an answer
//      (readManualEditor() drops a category with no name and a row with nothing in it);
//   R2 category names are unique (the bank's "pull into board" finds a category by name);
//   R3 questions are unique within a category (Save keys a played clue by category and question,
//      so two equal ones would share their "used" mark);
//   R4 points are whole numbers above 0, already in rising order (readManualEditor() parses them
//      with parseInt and sorts each category), and the same ladder in every column;
//   R5 no field has space at either end (readManualEditor() trims, so the saved board would differ
//      from the sample and the page could not tell its own sample from an edit);
//   R6 it reads as a sample: named so, no picture or audio clue, no team, nothing stored.
// What the page does with it (fill the editor, Save, reload) is the browser half, in
// Tools/sample-data/test/smoke-adopters.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const win = {};
vm.runInContext(fs.readFileSync(path.join(site, 'Tools/review-game-board/rgb-sample.js'), 'utf8'), vm.createContext({ window: win }));
const SAMPLE = win.ReviewBoardSample;

function broken(name, cats) {
  const out = new Set();
  const blank = (v) => typeof v !== 'string' || !v.trim();
  // R1
  if (!cats.length || cats.some((c) => blank(c.name) || c.clues.length !== 5 || c.clues.some((cl) => blank(cl.question) || blank(cl.answer)))) out.add('R1');
  // R2
  if (new Set(cats.map((c) => c.name.trim())).size !== cats.length) out.add('R2');
  // R3
  if (cats.some((c) => new Set(c.clues.map((cl) => cl.question.trim())).size !== c.clues.length)) out.add('R3');
  // R4
  const ladder = JSON.stringify(cats[0] ? cats[0].clues.map((cl) => cl.points) : []);
  cats.forEach((c) => {
    const pts = c.clues.map((cl) => cl.points);
    if (pts.some((p) => !Number.isInteger(p) || p <= 0 || String(parseInt(String(p), 10)) !== String(p))) out.add('R4');
    if (JSON.stringify(pts.slice().sort((a, b) => a - b)) !== JSON.stringify(pts) || new Set(pts).size !== pts.length) out.add('R4');
    if (JSON.stringify(pts) !== ladder) out.add('R4');
  });
  // R5
  const texts = [name].concat(...cats.map((c) => [c.name].concat(...c.clues.map((cl) => [cl.question, cl.answer]))));
  if (texts.some((t) => typeof t === 'string' && t !== t.trim())) out.add('R5');
  // R6
  if (!/^Sample\b/.test(name) || cats.some((c) => c.clues.some((cl) => cl.image || cl.audioId || Object.keys(cl).some((k) => ['points', 'question', 'answer'].indexOf(k) === -1)))) out.add('R6');
  return [...out].sort();
}

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('030 sample board');
eq(broken(SAMPLE.name, SAMPLE.categories()), [], 'the sample breaks no rule');
eq(SAMPLE.categories().map((c) => c.clues.length), [5, 5, 5], 'three categories of five');
eq(SAMPLE.categories()[0].clues.map((cl) => cl.points), [100, 200, 300, 400, 500], 'points 100 to 500');
ok(SAMPLE.categories() !== SAMPLE.categories() && SAMPLE.categories()[0].clues[0] !== SAMPLE.categories()[0].clues[0], 'categories() hands out fresh objects every call');
eq(Object.keys(SAMPLE).sort(), ['categories', 'name'], 'it publishes the name and the categories, and nothing about teams');

const MUTANTS = [
  ['R1', 'a clue with no answer', (c) => { c[1].clues[2].answer = ''; }],
  ['R1', 'a category of four', (c) => { c[2].clues.pop(); }],
  ['R2', 'two categories with one name', (c) => { c[2].name = c[0].name; }],
  ['R3', 'one question twice in a category', (c) => { c[0].clues[4].question = c[0].clues[1].question; }],
  ['R4', 'points out of order', (c) => { c[0].clues[0].points = 600; }],
  ['R4', 'a fraction of a point', (c) => { c[1].clues[1].points = 250.5; }],
  ['R4', 'a column on another ladder', (c) => { c[2].clues.forEach((cl, i) => { cl.points = (i + 1) * 200; }); }],
  ['R5', 'a trailing space', (c) => { c[0].clues[0].answer += ' '; }],
  ['R6', 'a picture clue', (c) => { c[0].clues[0].image = 'data:image/png;base64,AAAA'; }],
];
for (const [rule, what, mutate] of MUTANTS) {
  const c = SAMPLE.categories();
  mutate(c);
  const got = broken(SAMPLE.name, c);
  ok(got.includes(rule), `mutant (${what}) is caught by ${rule} (got ${JSON.stringify(got)})`);
}
ok(broken('My board', SAMPLE.categories()).includes('R6'), 'mutant (not named as a sample) is caught by R6');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
