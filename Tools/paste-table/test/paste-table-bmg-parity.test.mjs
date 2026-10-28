// paste-table-bmg-parity.test.mjs — 046's pasted-data parsers moved to _shared/paste-table.js in
// Path 16 P2; this holds the shared module AND bmg-choropleth.js's exports to a frozen copy of
// the parsers as they were (_legacy-bmg-parse.mjs), over a hand-written corpus and 4000 seeded
// random pastes built from the shapes a spreadsheet puts out. Nothing the old parser read may
// read differently, and nothing it could not read may start to.
//
//   node Tools/paste-table/test/paste-table-bmg-parity.test.mjs   (npm run test:paste-table-bmg-parity)
// Pure Node. Exits 1 on any difference.

import { parseDataRows as oldRows, parseDataTable as oldTable } from './_legacy-bmg-parse.mjs';
import { parseDataRows, parseDataTable } from '../../blank-map-generator/bmg-choropleth.js';
import { loadPasteTable } from './_load-paste-table.mjs';

const PT = loadPasteTable();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0, n = 0;
const ctl = (label, text) => {
  for (const [what, o, a, b] of [
    ['rows', oldRows(text), PT.parseNamedValues(text), parseDataRows(text)],
    ['table', oldTable(text), PT.parseNamedColumns(text), parseDataTable(text)],
  ]) {
    n++;
    if (!same(o, a)) { failed++; console.error(`FAIL ${what} (module): ${label}\n  text: ${JSON.stringify(text)}\n  old:  ${JSON.stringify(o)}\n  new:  ${JSON.stringify(a)}`); }
    if (!same(o, b)) { failed++; console.error(`FAIL ${what} (bmg export): ${label}\n  text: ${JSON.stringify(text)}`); }
  }
};

const HAND = [
  '', '  \n\n', 'State, Population\nMaryland, 6200000', 'Texas, 29,000,000', 'Washington, D.C., 705,749',
  'Congo, Dem. Rep., 95000000', 'Ohio; 12.5%', 'Ohio | $1,200', 'Ohio\t$ 1 200.50', 'a,b\nc,d', 'x, -5\ny, -6.25',
  'State\t1790\t1850\nMaryland\t320000\t583000', 'State, 1790, 1850, 1900\nMaryland, 320000, 583000, 1188000',
  'State, 1790, 1850\nRhode Island, 69,000, 148,000', 'Virginia, 747000, 1119000\nMaryland, 320000, 583000',
  'Country\t1900\t2000\nCongo, Dem. Rep.\t100\t200', 'a;1;2\nb;3', 'a|1|2|3\nb|4|5|x', 'Name\n\nOne, 1', 'One, 1\r\nTwo, 2\r\n',
  '1, 2', ', 5', 'Name, 5, ', '  , ,', 'n\t\t5', '"Quoted, Name", 5', 'A, 1\nA, 2\nB, 3', 'State,Pop\n',
  'Place, 2001, 2002\nX, 1, 2\nY, bad, 3\nZ, 4', '12, 34, 56', 'a\t1\t2\nb\t3',
];
HAND.forEach((t, i) => ctl('hand ' + (i + 1), t));

// seeded random pastes: a small LCG, so a failure is reproducible
let seed = 20261028;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = a => a[Math.floor(rnd() * a.length)];
const NAMES = ['Maryland', 'Washington, D.C.', 'Congo, Dem. Rep.', 'Ohio', 'New York', 'State', 'Country', 'Name', 'Rhode Island', ''];
const NUMS = ['5', '6200000', '1,188,044', '69,000', '148,000', '-3.5', '$12', '12%', '1 200', '.5', '2001', '1850', '0', 'n/a', 'x', '1e3', ''];
const DELIMS = ['\t', ';', '|', ',', ', '];
for (let i = 0; i < 4000; i++) {
  const d = pick(DELIMS), cols = 1 + Math.floor(rnd() * 4), lines = [];
  for (let l = 0, L = 1 + Math.floor(rnd() * 5); l < L; l++) {
    const cells = [pick(NAMES)];
    for (let c = 0, C = cols + (rnd() < 0.15 ? 1 : 0); c < C; c++) cells.push(pick(NUMS));
    lines.push(cells.join(rnd() < 0.1 ? pick(DELIMS) : d));
    if (rnd() < 0.1) lines.push('');
  }
  ctl('random ' + i, lines.join(rnd() < 0.2 ? '\r\n' : '\n'));
}

// Break on purpose: the parity corpus must notice a rule changing.
for (const [label, mutate] of [
  ['pipe no longer a value separator', src => src.replace('[\\t;,|]', '[\\t;,]')],
  ['thousands guess instead of report', src => src.replace("sliceCount > 1 && nameParts.length > 1", 'false')],
  ['years no longer make a header', src => src.replace('Number(v) <= 2999', 'Number(v) <= 1')],
]) {
  const m = loadPasteTable(mutate);
  const caught = HAND.some(t => !same(oldRows(t), m.parseNamedValues(t)) || !same(oldTable(t), m.parseNamedColumns(t)));
  if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught by the hand corpus`); }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-bmg-parity: ${n} comparisons identical (${HAND.length} hand, 4000 random)`);
