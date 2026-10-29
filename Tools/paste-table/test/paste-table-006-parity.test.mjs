// paste-table-006-parity.test.mjs — 006 Class Roster Hub reads a pasted spreadsheet region (and a CSV
// file) through _shared/paste-table.js (Path 16 P2); Roster.parseDelimited left _shared/roster.js.
// The page's own parseTable is cut out of the HTML and run here against PasteTable, and held to a
// frozen copy of the old parseDelimited over a hand-written corpus and 5000 seeded random pastes:
// `rows` and `cols` must be equal. The page's `ragged` (rows narrower than the widest, which the
// import dialog now says) is pinned separately, with its wording.
//
//   node Tools/paste-table/test/paste-table-006-parity.test.mjs   (npm run test:paste-table-006-parity)
// Pure Node. Exits 1 on any difference.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseDelimited as oldParse } from './_legacy-006-parse.mjs';
import { loadPasteTable } from './_load-paste-table.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'Tools', '006-class-roster-hub.html'), 'utf8');
const a = html.indexOf('function parseTable(text)'), b = html.indexOf('var looksLikeHeader', a);
if (a < 0 || b < 0) throw new Error('cannot find parseTable in 006');
function page(PasteTable) {
  const ctx = { PasteTable };
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + '\nthis.parseTable = parseTable; this.describe = describeRagged;', ctx);
  return ctx;
}
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const live = page(loadPasteTable());
let failed = 0, n = 0;
const ctl = (label, text, pg = live) => {
  n++;
  const o = oldParse(text), t = pg.parseTable(text), x = { rows: t.rows, cols: t.cols };
  if (!same(o, x)) { failed++; console.error(`FAIL ${label}\n  text: ${JSON.stringify(text)}\n  old: ${JSON.stringify(o)}\n  new: ${JSON.stringify(x)}`); }
};

const HAND = [
  '', '  \n', 'Name\tPeriod\nAnn Lee\t3\nBo Ray\t4', 'Name,Period\nAnn Lee,3', '"Lee, Ann",3\n"Ray, Bo",4', 'Last,First\nLee,Ann\nRay',
  'Ann\nBo\nCy', 'Ann\nLee, Bo\nRay\tx', 'Ann Lee\n', 'a\tb,c\n1,2', 'a,b\t\nc\td', '"say ""hi""",1', '"open,1\nb,2', 'a;b\n1;2', 'x\r\ny\r\n', ' a , b \n1,2',
  'Name\tPeriod\n\n\nAnn\t3', 'Smith, John\nDoe, Jane', 'a\t\tb', ',,', ' ',
];
HAND.forEach((t, i) => ctl('hand ' + (i + 1), t));

let seed = 6006006;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = x => x[Math.floor(rnd() * x.length)];
const CELLS = ['Ann Lee', 'Bo', '', ' ', '3', '"Lee, Ann"', '"q""r"', '"open', 'x y', 'Name', 'Period'];
for (let i = 0; i < 5000; i++) {
  const d = pick(['\t', ',', ';', '\t', ',']), lines = [];
  for (let l = 0, L = Math.floor(rnd() * 6); l < L; l++) {
    lines.push(Array.from({ length: Math.floor(rnd() * 5) }, () => pick(CELLS)).join(rnd() < 0.15 ? pick(['\t', ',']) : d));
    if (rnd() < 0.1) lines.push(pick(['', '  ']));
  }
  ctl('random ' + i, lines.join(rnd() < 0.2 ? '\r\n' : '\n'));
}

// the short rows are named, by line in the paste
{
  const t = live.parseTable('Name\tPeriod\nAnn\t3\nBo\n\nCy\n');
  n++;
  if (!same(t.ragged, [{ line: 3, cells: 1 }, { line: 5, cells: 1 }])) { failed++; console.error('FAIL ragged: ' + JSON.stringify(t.ragged)); }
  n++;
  const one = live.describe([{ line: 3, cells: 1 }]);
  if (one !== '1 row has fewer cells than the widest (line 3), so the missing cells are blank.') { failed++; console.error('FAIL describe one: ' + one); }
  n++;
  const many = live.describe([1, 2, 3, 4, 5, 6, 7].map(line => ({ line, cells: 1 })));
  if (many !== '7 rows have fewer cells than the widest (lines 1, 2, 3, 4, 5 and 2 more), so the missing cells are blank.') { failed++; console.error('FAIL describe many: ' + many); }
  n++;
  if (live.describe([]) !== '' || live.describe(undefined) !== '') { failed++; console.error('FAIL describe of nothing'); }
}

// Break on purpose
for (const [label, mutate] of [
  ['quotes ignored', s => s.replace('var quotes = !opts || opts.quotes !== false;', 'var quotes = false;')],
  ['cells not trimmed', s => s.replace('var trim = !opts || opts.trim !== false;', 'var trim = false;')],
  ['comma not a candidate fallback', s => s.replace("var fallback = opts && opts.fallback != null ? opts.fallback : ',';", "var fallback = ',';")],
  ['rows not padded', s => s.replace('if (opts.pad !== false) rows.forEach', 'if (false) rows.forEach')],
]) {
  const m = page(loadPasteTable(mutate));
  const caught = HAND.some(t => { const x = m.parseTable(t); return !same(oldParse(t), { rows: x.rows, cols: x.cols }); });
  if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught`); }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-006-parity: ${n} comparisons identical or as pinned`);
