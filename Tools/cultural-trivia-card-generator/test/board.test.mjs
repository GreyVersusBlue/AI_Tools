// board.test.mjs — 053's ready-made Review Game Board, the rule (rank 86).
// Plain Node, no browser.
//
//   node Tools/cultural-trivia-card-generator/test/board.test.mjs   (or: npm run test:trivia-board-logic)
//
// Loads ctcg-bank.js and ctcg-board.js in a vm, as the page does, and holds:
//   1. every built-in has a tier, and only the three words;
//   2. the built-in board: three columns in CAT_LABELS order, five clues each
//      at 100..500, never easier lower down, easiest first and hardest last,
//      and exactly these fifteen questions (pinned by id);
//   3. spread(): every place when n <= 5, else five, first and last included;
//   4. hidden built-ins and a teacher's own questions move the board as the
//      rule says (own = medium, even with an id a built-in has), a short
//      column keeps what it has, an empty one is dropped, nothing at all is null;
//   5. the file is the shape 030's normalizeBoard() reads, and nothing else;
//   6. five breaks of ctcg-board.js on purpose, each caught.
// The page and 030's import are smoke-board.mjs. Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..');
const BANK_SRC = fs.readFileSync(path.join(dir, 'ctcg-bank.js'), 'utf8');
const BOARD_SRC = fs.readFileSync(path.join(dir, 'ctcg-board.js'), 'utf8');
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function load(boardSrc = BOARD_SRC) {
  const win = {};
  win.window = win;
  const ctx = vm.createContext(win);
  vm.runInContext(BANK_SRC, ctx);
  vm.runInContext(boardSrc, ctx);
  return { Bank: win.CulturalTriviaBank, Board: win.CulturalTriviaBoard };
}

/* What the checks below say, as a list of failures; run against the real
   file and against each break. */
function check(boardSrc) {
  const fails = [];
  const ok = (cond, label) => { if (!cond) fails.push(label); };
  const eq = (a, b, label) => ok(isDeepStrictEqual(plain(a), plain(b)), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  let Bank, Board;
  try { ({ Bank, Board } = load(boardSrc)); } catch (e) { return ['the files did not load: ' + e.message]; }
  const items = Bank.items();
  const build = (list, extra = {}) => Board.build(Object.assign({ items: list, labels: Bank.CAT_LABELS, tierOf: Bank.tierOf }, extra));
  const RANK = { easy: 0, medium: 1, hard: 2 };

  /* 1. tiers */
  eq(Object.keys(Bank.TIERS).sort(), items.map(i => i.id).sort(), 'TIERS names every built-in and nothing else');
  ok(Object.values(Bank.TIERS).every(t => t in RANK), 'every tier is easy, medium or hard');
  for (const key of Object.keys(Bank.CAT_LABELS)) {
    const tiers = items.filter(i => i.category === key).map(i => Bank.tierOf(i.id));
    ok(tiers.includes('easy') && tiers.includes('hard'), `${key} has an easy and a hard question`);
  }
  eq([Bank.tierOf('b0'), Bank.tierOf('b2'), Bank.tierOf('t-mine'), Bank.tierOf('constructor')], ['easy', 'hard', 'medium', 'medium'], 'tierOf: a known id, and medium for any other (an inherited name too)');
  eq(Object.keys(items[0]).sort(), ['a', 'category', 'custom', 'id', 'q'], 'items() is unchanged: no tier on it');

  /* 2. the built-in board */
  const built = build(items);
  ok(!!built, 'the built-ins make a board');
  if (built) {
    eq(built.columns.map(c => c.label), ['Hispanic World', 'Francophone World', 'Global Culture'], 'three columns, in CAT_LABELS order');
    eq(built.columns.map(c => c.clues.map(cl => cl.points)), [[100, 200, 300, 400, 500], [100, 200, 300, 400, 500], [100, 200, 300, 400, 500]], 'five clues each, worth 100 to 500');
    for (const c of built.columns) {
      const r = c.clues.map(cl => RANK[cl.tier]);
      ok(r.every((x, i) => i === 0 || x >= r[i - 1]), `${c.label}: never easier further down`);
      eq([c.clues[0].tier, c.clues[4].tier], ['easy', 'hard'], `${c.label}: 100 is easy and 500 is hard`);
    }
    const idOf = {};
    items.forEach(i => { idOf[i.q] = i.id; });
    eq(built.columns.map(c => c.clues.map(cl => idOf[cl.question])), [
      ['b0', 'b6', 'b8', 'b2', 'b7'],
      ['b11', 'b16', 'b14', 'b12', 'b19'],
      ['b23', 'b26', 'b25', 'b21', 'b27'],
    ], 'the fifteen questions, pinned');
    eq(built.board.categories[0].clues[0], { points: 100, question: items[0].q, answer: items[0].a, used: false, dailyDouble: false }, 'a clue carries the question and answer word for word');
    eq(build(items), built, 'the same questions make the same board');
  }

  /* 3. spread */
  eq([0, 1, 2, 3, 4, 5, 6, 9, 10, 12].map(n => Board.spread(n)), [
    [], [0], [0, 1], [0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 3, 4, 5], [0, 2, 4, 6, 8], [0, 2, 5, 7, 9], [0, 3, 6, 8, 11],
  ], 'spread(n) for n = 0..12');

  /* 4. hidden, own, short, empty */
  const noB0 = items.filter(i => i.id !== 'b0');
  const b1 = build(noB0);
  eq(b1 && b1.columns[0].clues.map(cl => cl.tier), ['easy', 'medium', 'medium', 'hard', 'hard'], 'with b0 hidden Hispanic World still runs easy to hard, from nine');
  ok(b1 && b1.columns[0].clues[0].question === items[5].q, 'and its 100 is the next easy question, b5');
  const mine = [
    { id: 'b2', category: 'global', q: 'Own one, with a built-in’s id', a: 'Mine', custom: true },
    { id: 't1', category: 'francophone', q: '<img src=x onerror=alert(1)>', a: '&amp;', custom: true },
  ];
  const byId = id => items.find(i => i.id === id);
  const g = build([byId('b21'), mine[0], byId('b23')]);
  eq(g && g.columns[0].clues.map(cl => [cl.points, cl.tier, cl.custom]), [[100, 'easy', false], [200, 'medium', true], [300, 'hard', false]], 'a teacher’s question counts as medium, whatever its id, and sits between easy and hard');
  const short = build([items[0], items[2], mine[1]]);
  eq(short && short.columns.map(c => [c.label, c.clues.map(cl => cl.points)]), [['Hispanic World', [100, 200]], ['Francophone World', [100]]], 'a short column keeps what it has; an empty category is left off');
  eq(short && short.columns[1].clues[0].question, '<img src=x onerror=alert(1)>', 'text is carried as text, not changed');
  eq(build([]), null, 'no questions, no board');
  eq(build([{ id: 'x', category: 'nowhere', q: 'Q', a: 'A', custom: true }]), null, 'a category the page does not know makes no column');

  /* 5. the file's shape */
  if (built) {
    eq(Object.keys(built.board).sort(), ['categories', 'dailyDoubleEnabled', 'lightningRoundEnabled', 'lightningRoundSeconds', 'name', 'teams'].sort(), 'the board has the fields 030 reads');
    eq([built.board.name, built.board.teams, built.board.dailyDoubleEnabled], ['Cultural Trivia', [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }], false], 'named Cultural Trivia, two teams, no daily double');
    eq(build(items, { name: 'Unit 3' }).board.name, 'Unit 3', 'a name can be given');
  }
  return fails;
}

let failed = 0;
const real = check(BOARD_SRC);
real.forEach(f => console.log('  FAIL ' + f));
failed += real.length;
console.log(`053 board rule: ${real.length ? real.length + ' failing' : 'all checks pass'}`);

/* 6. breaks on purpose */
const BREAKS = [
  ['points step 50', s => s.replace('var POINT_STEP = 100;', 'var POINT_STEP = 50;')],
  ['no sort by tier', s => s.replace('return x.r - y.r || x.i - y.i;', 'return x.i - y.i;')],
  ['take the first five', s => s.replace('out.push(Math.round(k * (n - 1) / (ROWS_PER_COLUMN - 1)));', 'out.push(k);')],
  ['own questions take their id’s tier', s => s.replace("var t = item.custom ? 'medium' : tierOf(item.id);", 'var t = tierOf(item.id);').replace("tier: it.custom ? 'medium' : tierOf(it.id),", 'tier: tierOf(it.id),')],
  ['keep empty columns', s => s.replace('if (clues.length) columns.push(', 'columns.push(')],
];
for (const [name, mutate] of BREAKS) {
  const src = mutate(BOARD_SRC);
  if (src === BOARD_SRC) { console.log(`  FAIL break "${name}" did not apply`); failed++; continue; }
  const got = check(src);
  if (!got.length) { console.log(`  FAIL break "${name}" was not caught`); failed++; }
  else console.log(`  break "${name}" caught (${got.length})`);
}

if (failed) { console.log(`\n${failed} failure(s)`); process.exit(1); }
console.log('\nboard.test: all passed');
