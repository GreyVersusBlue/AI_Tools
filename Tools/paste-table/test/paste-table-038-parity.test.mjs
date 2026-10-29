// paste-table-038-parity.test.mjs — 038 Data Chart Builder's parseTable moved onto
// _shared/paste-table.js (Path 16 P2). The page's own parseTable is cut out of the HTML and run
// here against PasteTable, and held to a frozen copy of the old one over a hand-written corpus
// and 4000 seeded random pastes, with the header box both ways: headers and rows must be equal
// (the page adds `lines`, which the old table did not have, and the column note reads it).
// Then the unreadable-cells note's wording is pinned from the page's own renderValueColsNote.
//
//   node Tools/paste-table/test/paste-table-038-parity.test.mjs   (npm run test:paste-table-038-parity)
// Pure Node. Exits 1 on any difference.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseTable as oldParse } from './_legacy-038-parse.mjs';
import { loadPasteTable } from './_load-paste-table.mjs';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = fs.readFileSync(path.join(site, 'Tools', '038-data-chart-builder.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); if (a < 0 || b < 0) throw new Error('cannot find ' + from); return html.slice(a, b); };

const PT = loadPasteTable();
function pageFns(PasteTable, header) {
  const ctx = { PasteTable, els: { hasHeaders: { checked: header }, valueColsNote: { hidden: true, textContent: '' } }, numericCols: [] };
  vm.createContext(ctx);
  vm.runInContext(cut('function parseTable(text)', 'function isNumeric') + cut('function isNumeric', 'function toNumber') +
    cut('function renderValueColsNote', 'function renderPreview') + '\nthis.parseTable = parseTable; this.note = renderValueColsNote;', ctx);
  return ctx;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let failed = 0, n = 0;
function compare(label, text) {
  for (const header of [true, false]) {
    n++;
    const o = oldParse(text, header);
    const t = pageFns(PT, header).parseTable(text);
    const strip = x => x && { headers: x.headers, rows: x.rows };
    if (!same(o, strip(t))) { failed++; console.error(`FAIL ${label} (header ${header})\n  text: ${JSON.stringify(text)}\n  old: ${JSON.stringify(o)}\n  new: ${JSON.stringify(strip(t))}`); }
  }
}

const HAND = [
  '', '   \n  ', 'Name,Score\nAnn,87\nBo,92', 'Name\tScore\nAnn\t87', 'a,b\n1', '"Smith, John",87\n"Lee, Ann",90',
  '"say ""hi""",1', 'a\tb,c\n1\t2,3', 'a,b\tc\n1,2', 'Only a header', 'x,y\r\n1,2\r\n', ' a , b \n 1 , 2 ', ',\n,', 'a,,c\n1,2,3',
  'a;b\n1;2', 'a|b\n1|2', '"unterminated,1\nb,2', 'a,b\n\n\n1,2', 'Temp,Time\n1,000,5', '12,34', 'a\t\tb\n\t1\t', '\ta\tb', 'a,b\n1\t2',
];
HAND.forEach((t, i) => compare('hand ' + (i + 1), t));

let seed = 38038038;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = a => a[Math.floor(rnd() * a.length)];
const CELLS = ['a', 'Name', '12', '1,234', '"x, y"', '"q""r"', ' pad ', '', '-3.5', '87%', 'n/a', '"open', '5\r'];
for (let i = 0; i < 4000; i++) {
  const d = pick(['\t', ',', ';', '|']), lines = [];
  for (let l = 0, L = Math.floor(rnd() * 6); l < L; l++) {
    const cells = []; for (let c = 0, C = Math.floor(rnd() * 5); c < C; c++) cells.push(pick(CELLS));
    lines.push(cells.join(rnd() < 0.15 ? pick(['\t', ',']) : d));
    if (rnd() < 0.1) lines.push(pick(['', '  ', '\t']));
  }
  compare('random ' + i, lines.join(rnd() < 0.2 ? '\r\n' : '\n'));
}

// the note: a mostly-numeric column that is left out says which line stopped it
{
  const f = pageFns(PT, true);
  const t = f.parseTable('Name,Score,Pts\nAnn,87,1\nBo,n/a,2\nCy,90,3\n\nDi,91,x');
  // numericCols is empty: neither Score nor Pts was offered, so both are candidates for the note
  f.note(t);
  const msg = f.els.valueColsNote.textContent;
  const ok = !f.els.valueColsNote.hidden && /“Score” is not offered as a value column: line 3 reads “n\/a”/.test(msg) && /“Pts” is not offered as a value column: line 6 reads “x”/.test(msg);
  n++; if (!ok) { failed++; console.error('FAIL note wording: ' + JSON.stringify(msg)); }
  const g = pageFns(PT, true);
  const t2 = g.parseTable('Name,Score\nAnn,87\nBo,92');
  vm.runInContext('numericCols = [1]', g);
  g.note(t2);
  n++; if (!g.els.valueColsNote.hidden) { failed++; console.error('FAIL note shown for a clean table'); }
  const h = pageFns(PT, true);
  const t3 = h.parseTable('Name,Notes\nAnn,hello\nBo,world');
  h.note(t3);
  n++; if (!h.els.valueColsNote.hidden) { failed++; console.error('FAIL note shown for a text column'); }
}

// Break on purpose: the corpus must notice the parser changing.
for (const [label, mutate] of [
  ['cells not trimmed', src => src.replace('var trim = !opts || opts.trim !== false;', 'var trim = false;')],
  ['quotes ignored', src => src.replace('var quotes = !opts || opts.quotes !== false;', 'var quotes = false;')],
  ['rows not padded', src => src.replace('if (opts.pad !== false) rows.forEach', 'if (false) rows.forEach')],
  ['delimiter looked for on every line', src => src.replace('if (opts && opts.firstLine) {', 'if (false) {').replace('opts.firstLine ? lines[0].text', 'false ? lines[0].text')],
]) {
  const m = loadPasteTable(mutate);
  const caught = HAND.some(t => [true, false].some(h => {
    const o = oldParse(t, h), x = pageFns(m, h).parseTable(t);
    return !same(o, x && { headers: x.headers, rows: x.rows });
  }));
  if (!caught) { failed++; console.error(`FAIL: mutant "${label}" was not caught`); }
}
{
  const m = loadPasteTable(src => src.replace('else rep.unreadable.push({ row: i + 1, text: v });', ';'));
  const f = pageFns(m, true);
  f.note(f.parseTable('Name,Score\nAnn,87\nBo,n/a\nCy,90'));
  if (!f.els.valueColsNote.hidden) { failed++; console.error('FAIL: mutant "report empty" was not caught by the note'); }
}

if (failed) { console.error(`${failed} differences in ${n} comparisons`); process.exit(1); }
console.log(`paste-table-038-parity: ${n} comparisons identical or as pinned`);
