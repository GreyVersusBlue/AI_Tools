// paste-table.test.mjs — _shared/paste-table.js, named cases for what a pasted region can hold
// (BACKLOG.md, Path 16 P2): every delimiter, quoted cells, a header or none, thousands
// separators, a name that holds the delimiter, ragged rows, and the report of lines it could not
// read. Then each group of cases is run against a deliberately broken copy, which must fail it.
//
//   node Tools/paste-table/test/paste-table.test.mjs   (npm run test:paste-table)
// Pure Node, no browser, no port. Exits 1 on any failure.

import { loadPasteTable } from './_load-paste-table.mjs';

const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each case is [name, fn(PT) -> boolean]. A mutant must make at least one case in its group fail.
const CASES = {
  delimiters: [
    ['tab wins over every other delimiter', PT => PT.pickDelimiter('a,b;c|d\te') === '\t'],
    ['semicolon beats pipe and comma', PT => PT.pickDelimiter('a,b;c|d') === ';'],
    ['pipe beats comma', PT => PT.pickDelimiter('a,b|c') === '|'],
    ['comma when it is all there is, and when nothing is', PT => PT.pickDelimiter('a,b') === ',' && PT.pickDelimiter('abc') === ','],
    ['firstLine looks at the first non-blank line only', PT => PT.pickDelimiter('\n\na,b\nc\td', { firstLine: true }) === ','],
    ['candidates and fallback are the caller\'s', PT => PT.pickDelimiter('a b', { candidates: ['\t'], fallback: '\t' }) === '\t'],
    ['parse reads a semicolon table', PT => deep(PT.parse('a;b\n1;2').rows, [['a', 'b'], ['1', '2']])],
    ['parse reads a pipe table', PT => deep(PT.parse('a|b\n1|2').rows, [['a', 'b'], ['1', '2']])],
    ['parse reads a tab table with an empty cell kept', PT => deep(PT.parse('a\t\tc').rows, [['a', '', 'c']])],
  ],
  quotes: [
    ['a quoted cell keeps its delimiter', PT => deep(PT.splitLine('"Smith, John",87', ','), ['Smith, John', '87'])],
    ['a doubled quote is one quote', PT => deep(PT.splitLine('"say ""hi""",1', ','), ['say "hi"', '1'])],
    ['quotes: false leaves quotes alone', PT => deep(PT.splitLine('"a,b', ',', { quotes: false }), ['"a', 'b'])],
    ['cells are trimmed by default', PT => deep(PT.splitLine(' a , b ', ','), ['a', 'b'])],
    ['trim: false keeps the padding', PT => deep(PT.splitLine(' a , b ', ',', { trim: false }), [' a ', ' b '])],
    ['an unterminated quote swallows to the end of the line, not the next line', PT => deep(PT.parse('"a,b\nc,d').rows, [['a,b', ''], ['c', 'd']])],
  ],
  header: [
    ['header: true takes the first row out', PT => { const t = PT.parse('n,v\na,1', { header: true }); return deep(t.header, ['n', 'v']) && deep(t.rows, [['a', '1']]); }],
    ['header: false keeps every row', PT => PT.parse('n,v\na,1', { header: false }).rows.length === 2],
    ['auto: words after a label are a header', PT => PT.parse('Name,Score\nAnn,87', { header: 'auto' }).header !== null],
    ['auto: four-digit years after a label are a header', PT => PT.parse('State,1790,1850\nVA,1,2', { header: 'auto' }).header !== null],
    ['auto: a data row is never a header', PT => PT.parse('Ann,87,90\nBo,70,71', { header: 'auto' }).header === null],
    ['auto: a six-digit population is not a year', PT => PT.parse('State,320000,583000\nVA,1,2', { header: 'auto' }).header === null],
    ['auto: a lone line is data, not a header', PT => PT.parse('Name,Score', { header: 'auto' }).header === null],
  ],
  numbers: [
    ['thousands separators', PT => PT.toNumber('1,234,567') === 1234567],
    ['dollar sign, percent sign and spaces', PT => PT.toNumber('$ 5') === 5 && PT.toNumber('87%') === 87 && PT.toNumber('1 234') === 1234],
    ['negative and decimal', PT => PT.toNumber('-3.5') === -3.5 && PT.toNumber('.5') === 0.5],
    ['words, blanks and a trailing dot are not numbers', PT => ['', 'abc', '12abc', '1.', '--1', null].every(v => PT.toNumber(v) === null)],
    ['a number in a name column is still a number to isHeaderShape', PT => PT.isHeaderShape(['2024', 'a', 'b']) === false],
  ],
  names: [
    ['a name that holds the delimiter comes out whole', PT => deep(PT.parseNamedValues('Washington, D.C., 705,749').rows, [{ name: 'Washington, D.C.', value: 705749 }])],
    ['a name that holds the delimiter, with tabs', PT => deep(PT.parseNamedValues('Washington, D.C.\t$705,749').rows, [{ name: 'Washington, D.C.', value: 705749 }])],
    ['a header line is skipped when data follows', PT => { const r = PT.parseNamedValues('State, Pop\nTexas, 29,000'); return r.headerSkipped === 'State, Pop' && r.rows.length === 1; }],
    ['a header with nothing after it is reported, not swallowed', PT => { const r = PT.parseNamedValues('State, Pop'); return r.rows.length === 0 && deep(r.unreadable, ['State, Pop']); }],
    ['a later bad line is reported with its text', PT => deep(PT.parseNamedValues('a,1\nnonsense\nb,2').unreadable, ['nonsense'])],
    ['a percent value', PT => PT.parseNamedValues('Ohio, 12.5%').rows[0].value === 12.5],
    ['several columns: header names the slices', PT => deep(PT.parseNamedColumns('State\t1790\t1850\nMaryland\t320000\t583000').slices, ['1790', '1850'])],
    ['several columns without a header are labelled Column n', PT => deep(PT.parseNamedColumns('Maryland;1;2').slices, ['Column 1', 'Column 2'])],
    ['comma thousands in a multi-column table are reported, never guessed', PT => { const r = PT.parseNamedColumns('State, 1790, 1850\nMaryland, 69,000, 148,000'); return r.rows.length === 0 && r.ambiguous.length === 1; }],
    ['a row with too few fields is unreadable', PT => deep(PT.parseNamedColumns('State\t1\t2\nMaryland\t5').unreadable, ['Maryland\t5'])],
  ],
  ragged: [
    ['a short row is padded and named', PT => { const t = PT.parse('a,b,c\n1,2\nx,y,z'); return deep(t.rows[1], ['1', '2', '']) && deep(t.ragged, [{ line: 2, cells: 2 }]); }],
    ['pad: false leaves the row short', PT => deep(PT.parse('a,b,c\n1,2', { pad: false }).rows[1], ['1', '2'])],
    ['line numbers count blank lines', PT => deep(PT.parse('a,b\n\n1,2').lines, [1, 3])],
    ['blank lines are counted', PT => PT.parse('a\n\n\nb').blank === 2],
    ['fixed-width text splits on runs of spaces', PT => deep(PT.parse('Ann   87   90', { fixed: true }).rows, [['Ann', '87', '90']])],
    ['fixed does not touch a line with a tab', PT => deep(PT.parse('a b\tc', { fixed: true }).rows, [['a b', 'c']])],
    ['CRLF lines', PT => deep(PT.parse('a,b\r\n1,2\r\n').rows, [['a', 'b'], ['1', '2']])],
    ['empty text is an empty table', PT => { const t = PT.parse('  \n'); return t.rows.length === 0 && t.width === 0; }],
  ],
  report: [
    ['columnReport names the cells that stopped a column reading as numbers', PT => {
      const r = PT.columnReport([['a', '1'], ['b', 'n/a'], ['c', '3'], ['d', '']]);
      return r[1].numbers === 2 && r[1].filled === 3 && deep(r[1].unreadable, [{ row: 2, text: 'n/a' }]) && r[0].numbers === 0;
    }],
    ['columnReport takes the tool\'s own number test', PT => PT.columnReport([['x']], { isNumber: () => true })[0].numbers === 1],
  ],
};

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error('FAIL:', msg); } };

const real = loadPasteTable();
for (const [group, list] of Object.entries(CASES)) {
  for (const [name, fn] of list) {
    let ok = false;
    try { ok = fn(real) === true; } catch (e) { console.error(e); }
    check(ok, `${group}: ${name}`);
  }
}

// Break on purpose: each mutant removes one rule and must fail at least one case in its group.
const MUTANTS = [
  ['delimiters', 'tab no longer first', s => s.replace("['\\t', ';', '|', ',']", "[',', ';', '|', '\\t']")],
  ['delimiters', 'pipe dropped', s => s.replace("['\\t', ';', '|', ',']", "['\\t', ';', ',']")],
  ['quotes', 'quotes ignored', s => s.replace("var quotes = !opts || opts.quotes !== false;", 'var quotes = false;')],
  ['quotes', 'doubled quote not unescaped', s => s.replace("if (s[i + 1] === '\"') { cur += '\"'; i++; } else inQ = false;", 'inQ = false;')],
  ['quotes', 'cells not trimmed', s => s.replace("var trim = !opts || opts.trim !== false;", 'var trim = false;')],
  ['header', 'auto never sees a header', s => s.replace('rows.length > 1 && isHeaderShape(rows[0])', 'false')],
  ['header', 'years not accepted', s => s.replace("/^\\d{4}$/.test(v) && Number(v) >= 1000", 'false && Number(v) >= 1000')],
  ['header', 'a six-digit number can be a year', s => s.replace('Number(v) <= 2999', 'Number(v) <= 999999').replace('/^\\d{4}$/', '/^\\d+$/')],
  ['numbers', 'thousands comma not stripped', s => s.replace('/[,\\s%$]/g', '/[\\s%$]/g')],
  ['numbers', 'junk accepted', s => s.replace('/^-?\\d*\\.?\\d+$/.test(cleaned)', 'true')],
  ['names', 'name split on the first separator', s => s.replace('(.*?)', '([^,;|\\t]*?)')],
  ['names', 'ambiguity guess instead of report', s => s.replace("sliceCount > 1 && nameParts.length > 1", 'false')],
  ['names', 'header swallowed even with nothing after', s => s.replace('if (parsed.length) headerSkipped = firstBad;\n      else unreadable.unshift(firstBad);', 'headerSkipped = firstBad;')],
  ['ragged', 'rows not padded', s => s.replace("if (opts.pad !== false) rows.forEach", 'if (false) rows.forEach')],
  ['ragged', 'ragged not reported', s => s.replace('if (r.length !== width) ragged.push', 'if (false) ragged.push')],
  ['ragged', 'blank lines not counted', s => s.replace('blank++; return;', 'return;')],
  ['report', 'unreadable cells dropped', s => s.replace('else rep.unreadable.push({ row: i + 1, text: v });', ';')],
];
for (const [group, label, mutate] of MUTANTS) {
  const mutant = loadPasteTable(mutate);
  const broke = CASES[group].some(([, fn]) => { try { return fn(mutant) !== true; } catch (e) { return true; } });
  check(broke, `mutant "${label}" was not caught by the ${group} cases`);
}

const total = Object.values(CASES).reduce((n, l) => n + l.length, 0);
if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log(`paste-table: ${total} cases and ${MUTANTS.length} mutants ok`);
