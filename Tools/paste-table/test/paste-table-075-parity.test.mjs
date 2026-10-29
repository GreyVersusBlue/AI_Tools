// paste-table-075-parity.test.mjs — 075 Staff Directory Builder's "Add pasted rows" now reads its
// lines through _shared/paste-table.js (Path 16 P2). The page's own readBulkRows is cut out of the
// HTML and run here against PasteTable, and held to a frozen copy of the old loop over a
// hand-written corpus and 5000 seeded random pastes: every row that was added is added with the
// same cells in the same order. What changed is only that a row with no name, which used to
// vanish, is returned with its line number and named in the message; that is pinned below.
//
//   node Tools/paste-table/test/paste-table-075-parity.test.mjs   (npm run test:paste-table-075-parity)
// Pure Node. Exits 1 on any difference.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { bulkArgs } from './_legacy-075-bulk.mjs';
import { loadPasteTable } from './_load-paste-table.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'Tools', '075-staff-directory-builder.html'), 'utf8');
const a = html.indexOf('function readBulkRows'), b = html.indexOf("els.bulkAddBtn.addEventListener", a);
if (a < 0 || b < 0) throw new Error('cannot find readBulkRows in 075');
function page(PasteTable) {
  const ctx = { PasteTable };
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + '\nthis.read = readBulkRows; this.describe = describeBulkUnreadable;', ctx);
  return ctx;
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const live = page(loadPasteTable());
let failed = 0, n = 0;
const ctl = (label, text, pg = live) => {
  n++;
  const o = bulkArgs(text), x = pg.read(text).rows;
  if (!same(o, x)) { failed++; console.error(`FAIL ${label}\n  text: ${JSON.stringify(text)}\n  old: ${JSON.stringify(o)}\n  new: ${JSON.stringify(x)}`); }
};

const HAND = [
  '', 'Ann Lee, 101, 5512, Math', 'Ann Lee\t101\t5512\tMath\tann@x.org', '  Bo  ,  102 ', 'Cy\t\t\tArt', 'Di,,,,d@x', '\n\nEd, 1\r\nFi, 2\r\n',
  '"Lee, Ann", 101', 'a,b\tc,d', ',101', '\t101', '   ', 'Gus', 'Hal, 1, 2, 3, 4, 5, 6', 'Ivy Ng, 12',
];
HAND.forEach((t, i) => ctl('hand ' + (i + 1), t));

let seed = 75075075;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = x => x[Math.floor(rnd() * x.length)];
const CELLS = ['Ann Lee', 'Bo', '', ' ', '101', 'Math', 'a@b.org', '"Lee, Ann"', 'x y'];
for (let i = 0; i < 5000; i++) {
  const lines = [];
  for (let l = 0, L = Math.floor(rnd() * 6); l < L; l++) {
    const sep = pick(['\t', ',', ', ', '\t', ',']);
    lines.push(Array.from({ length: Math.floor(rnd() * 6) }, () => pick(CELLS)).join(sep));
    if (rnd() < 0.1) lines.push(pick(['', '  ']));
  }
  ctl('random ' + i, lines.join(rnd() < 0.2 ? '\r\n' : '\n'));
}

// a row with no name is named, by its line in the paste, and not added
{
  const r = live.read('Ann, 1\n\n,101\nBo, 2\n \t,7');
  n++;
  if (!same(r.rows, [['Ann', '1'], ['Bo', '2']]) || !same(r.unreadable, [{ line: 3, text: ',101' }, { line: 5, text: ',7' }])) { failed++; console.error('FAIL unreadable: ' + JSON.stringify(r)); }
  n++;
  const one = live.describe([{ line: 3, text: ',101' }]);
  if (one !== '1 row has no name, so it was not added: line 3 “,101”.') { failed++; console.error('FAIL describe one: ' + one); }
  n++;
  const many = live.describe([1, 2, 3, 4, 5].map(i => ({ line: i, text: 't' + i })));
  if (many !== '5 rows have no name, so they were not added: line 1 “t1”, line 2 “t2”, line 3 “t3” and 2 more.') { failed++; console.error('FAIL describe many: ' + many); }
}

// Break on purpose
for (const [label, mutate] of [
  ['quotes honoured', s => s.replace('var quotes = !opts || opts.quotes !== false;', 'var quotes = true;')],
  ['cells not trimmed', s => s.replace('var trim = !opts || opts.trim !== false;', 'var trim = false;')],
  ['comma not the fallback', s => s.replace("var fallback = opts && opts.fallback != null ? opts.fallback : ',';", "var fallback = ';';")],
]) {
  const m = page(loadPasteTable(mutate));
  const caught = HAND.some(t => !same(bulkArgs(t), m.read(t).rows));
  if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught`); }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-075-parity: ${n} comparisons identical or as pinned`);
