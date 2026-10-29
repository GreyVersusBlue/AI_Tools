// paste-table-036-parity.test.mjs — 036 Final Grade Checker's splitRow now splits through
// _shared/paste-table.js (Path 16 P2). This holds the live splitRow, to the frozen old splitRow over a hand-written corpus and 6000 seeded
// random rows: tabs keep their empty cells, a row with no tab splits on runs of 2+ spaces, a quote
// character is just a character, a trailing carriage return goes. 036 stores no grades; nothing here
// adds a way to.
//
//   node Tools/paste-table/test/paste-table-036-parity.test.mjs   (npm run test:paste-table-036-parity)
// Pure Node. Exits 1 on any difference.

import { splitRow as oldSplit } from './_legacy-036-splitrow.mjs';
import { splitRow } from '../../final-grade-checker/grade-math.mjs';
import { loadPasteTable } from './_load-paste-table.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0, n = 0;
const ctl = (label, line) => {
  n++;
  const o = oldSplit(line), x = splitRow(line);
  if (!same(o, x)) { failed++; console.error(`FAIL ${label}\n  line: ${JSON.stringify(line)}\n  old: ${JSON.stringify(o)}\n  new: ${JSON.stringify(x)}`); }
};

const HAND = [
  '', '\t', 'a\tb\t\td', 'a\tb\tc\td\r', 'a  b   c', 'a b c', '  lead  and  trail  ', '"Smith, J"\t"87"', '\ta\t\tb\t',
  '1\tSmith, Jane\tA(90.5)\tB(80)\tC(70.25)\tD(60)\t', 'Smith   A(90)   B(80)', 'one\ttwo  three', ' \t ', 'x\r', '\r', 'a b\tc',
];
HAND.forEach((l, i) => ctl('hand ' + (i + 1), l));

let seed = 36036036;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = a => a[Math.floor(rnd() * a.length)];
const BITS = ['Smith', 'Jane', 'A(90)', '87.5', '', ' ', '  ', '"q"', 'x y', ' '];
for (let i = 0; i < 6000; i++) {
  const sep = pick(['\t', '  ', ' ', '\t', '   ']);
  let line = Array.from({ length: Math.floor(rnd() * 7) }, () => pick(BITS)).join(sep);
  if (rnd() < 0.2) line += '\r';
  ctl('random ' + i, line);
}

// Break on purpose: the corpus must notice the split changing.
// The live splitRow reaches PasteTable through the global; swap a broken copy in for each run.
for (const [label, mutate] of [
  ['quotes honoured in tab rows', src => src.replace("var quotes = !opts || opts.quotes !== false;", 'var quotes = true;')],
  ['cells not trimmed', src => src.replace('var trim = !opts || opts.trim !== false;', 'var trim = false;')],
  ['fixed-width keeps empty pieces', src => src.replace(".filter(function (c) { return c !== ''; })", '')],
  ['fixed-width splits on one space', src => src.replace('/ {2,}/', '/ +/')],
]) {
  const keep = globalThis.PasteTable;
  globalThis.PasteTable = loadPasteTable(mutate);
  try {
    // splitRow passes quotes: false, so only a module that ignores that flag can honour them
    const caught = HAND.concat(['"a\tb"\tc', 'a  b']).some(l => !same(oldSplit(l), splitRow(l)));
    if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught`); }
  } finally { globalThis.PasteTable = keep; }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-036-parity: ${n} comparisons identical`);
