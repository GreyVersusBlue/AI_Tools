// smoke-bulk-core.mjs — how 016's Bulk mode reads a paste, in pure Node.
//
//   node Tools/qr-code-generator/test/smoke-bulk-core.mjs
//
// bulk-rows.js decides which rows make a code and which do not, and says why.
// What is pinned here:
//   - a list pasted before this file existed reads exactly as it did: the
//     first delimiter splits, a line with none is its own label and link, an
//     empty side takes the other, a tab beats a comma
//   - a header row of column names is skipped, and only that row, and only
//     when every cell in it is a column name
//   - a quoted cell keeps its comma, through Roster.splitCells read straight
//     out of _shared/roster.js (the file needs a window; the function does not)
//   - a row that will not make a code is named by its line in what was pasted
//     (blank lines and the header counted): empty, too long at the chosen
//     error correction, the same label and link as an earlier row. Two labels
//     on one link are fine.
//   - the limit is read off the real encoder (_shared/vendor/qrcode): CAPACITY
//     bytes fit and one more throws, at each level, in UTF-8 bytes
//   - a label over 60 characters is shortened with an ellipsis; the link is not
// BULK_FILE points the suite at another copy of the module (the
// deliberate-break runs use it). Every name is invented. Exits 1 on any failure.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..', '..');
await import(pathToFileURL(process.env.BULK_FILE || path.join(here, '..', 'bulk-rows.js')).href);
const B = globalThis.QrBulkRows;

// Roster.splitCells, as the page hands it in, cut out of the real file.
const rosterSrc = fs.readFileSync(path.join(root, '_shared', 'roster.js'), 'utf8');
const a = rosterSrc.indexOf('function splitCells(line, delim) {');
const b = rosterSrc.indexOf('/** CSV/TSV text', a);
const splitCells = new Function(rosterSrc.slice(a, b) + '; return splitCells;')();

// The real encoder, to read the limit off.
const qctx = {}; vm.createContext(qctx);
vm.runInContext(fs.readFileSync(path.join(root, '_shared', 'vendor', 'qrcode', 'qrcode.js'), 'utf8') + ';this.q = qrcode', qctx);
const fits = (text, ec) => { try { const o = qctx.q(0, ec); o.addData(text); o.make(); return true; } catch (e) { return false; } };

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (x, y, l) => ok(x === y, `${l} (got ${JSON.stringify(x)}, want ${JSON.stringify(y)})`);
const same = (x, y, l) => eq(JSON.stringify(x), JSON.stringify(y), l);
const P = (raw, o) => B.parse(raw, Object.assign({ splitCells }, o || {}));
const pairs = r => r.rows.map(x => [x.label, x.content]);

console.log('Bulk rows — reading a paste');

/* 1. Before this file: the same rows out. */
same(pairs(P('Station 1, https://example.com/1\nStation 2\thttps://example.com/2')),
  [['Station 1', 'https://example.com/1'], ['Station 2', 'https://example.com/2']], 'comma and tab rows');
same(pairs(P('Just a line')), [['Just a line', 'Just a line']], 'a line with no delimiter is label and content');
same(pairs(P('Wi-Fi, https://example.com/?a=1,2,3')), [['Wi-Fi', 'https://example.com/?a=1,2,3']], 'only the first comma splits');
same(pairs(P('Name,')), [['Name', 'Name']], 'an empty link takes the label');
same(pairs(P(',https://example.com/x')), [['https://example.com/x', 'https://example.com/x']], 'an empty label takes the link');
same(pairs(P('a, b\tc, d')), [['a, b', 'c, d']], 'a tab beats a comma');
same(pairs(P('\n\n  Room 4 , https://example.com/4  \n\n')), [['Room 4', 'https://example.com/4']], 'blank lines are ignored and cells trimmed');
same(pairs(P('A\r\nB\r\n')), [['A', 'A'], ['B', 'B']], 'CRLF');
same(pairs(P('Sign-up, Say "hi" there')), [['Sign-up', 'Say "hi" there']], 'a quote that opens no cell is text, as before');
same(pairs(B.parse('A, b"c', {})), [['A', 'b"c']], 'it reads without a splitCells too');

/* 2. The header row. */
let r = P('Label, URL\nStation 1, https://example.com/1');
eq(r.header, true, 'a header row is found');
same(pairs(r), [['Station 1', 'https://example.com/1']], '…and skipped');
r = P('Name\tLink or text\nAnn\thttps://example.com/a');
eq(r.header, true, 'a tab header: Name, Link or text');
r = P('Title, Address\nA, B');
eq(r.header, true, 'Title, Address');
r = P('URL\nhttps://example.com/1');
eq(r.header, true, 'a one-column header');
eq(r.rows.length, 1, '…leaves the one row');
r = P('Station 1, https://example.com/1\nLabel, URL');
eq(r.header, false, 'a header-looking row that is not first is a row');
eq(r.rows.length, 2, '…and makes a code');
r = P('Label, https://example.com/1');
eq(r.header, false, 'one column name and one link is a row');
r = P('Text, Text');
eq(r.header, true, 'every cell a column name is a header');
r = P('\n\nLabel, URL\nA, B');
eq(r.header, true, 'a header after blank lines');
eq(r.rows[0].line, 4, '…and the row after it is line 4');
r = P('Name, Room\nAnn, 4');
eq(r.header, false, '"Room" is not a column name here, so it is a row');
eq(r.rows.length, 2, '…two rows');
eq(P('Station 1, Station 2').header, false, 'Station 1 is a label, not the column name Station');
eq(P('Station\nCode\nText').rows.length, 3, 'single-cell words that could be labels are rows');
eq(P('Name,').rows.length, 1, 'a name with an empty link is a row, not a header');

/* 3. Quoted cells. */
r = P('"Rm 214, Wi-Fi", https://example.com/wifi');
same(pairs(r), [['Rm 214, Wi-Fi', 'https://example.com/wifi']], 'a quoted label keeps its comma');
r = P('"Say ""hi""", https://example.com/x');
same(pairs(r), [['Say "hi"', 'https://example.com/x']], 'a doubled quote is one quote');
r = P('Lab, "https://example.com/?a=1,2"');
same(pairs(r), [['Lab', 'https://example.com/?a=1,2']], 'a quoted link keeps its comma');
r = P('"Only quoted"');
same(pairs(r), [['Only quoted', 'Only quoted']], 'one quoted cell is label and link');
r = P('"A", b, c');
same(pairs(r), [['A', 'b,c']], 'a quoted row with more than two cells: the rest is the link, rejoined by the delimiter');
r = P('"a\tb"\thttps://example.com/t');
same(pairs(r), [['a\tb', 'https://example.com/t']], 'a quoted tab stays in a tab-separated row');
r = P('Label,URL\n"Rm 214, Wi-Fi",https://example.com/w\n"Rm 3, Lab",https://example.com/l');
same(pairs(r), [['Rm 214, Wi-Fi', 'https://example.com/w'], ['Rm 3, Lab', 'https://example.com/l']], 'a header and two quoted rows');

/* 4. Order. */
r = P('https://example.com/1, Station 1', { order: 'link-first' });
same(pairs(r), [['Station 1', 'https://example.com/1']], 'link then label');
r = P('Only a link', { order: 'link-first' });
same(pairs(r), [['Only a link', 'Only a link']], 'one cell is not swapped');
r = P('Name, Link\nhttps://example.com/1, A', { order: 'link-first' });
eq(r.header, true, 'a header is found in either order');
same(pairs(r), [['A', 'https://example.com/1']], '…and the rows are swapped');
r = P(',Station 1', { order: 'link-first' });
same(pairs(r), [['Station 1', 'Station 1']], 'link first with an empty link');

/* 5. What will not make a code, and where. */
r = P('Label, URL\nA, https://example.com/a\n\n,\nB, https://example.com/b\nA, https://example.com/a\nC, https://example.com/a');
same(r.rows.map(x => x.line), [2, 5, 7], 'rows keep their line in what was pasted (header and blank counted)');
same(r.problems.map(x => [x.line, x.text]), [[4, '(empty)'], [6, 'A']], 'the empty row and the repeat are named by line');
ok(/same label and link as line 2/.test(r.problems[1].reason), 'a repeat names the line it repeats: ' + r.problems[1].reason);
eq(r.rows.length, 3, 'two labels on one link are both kept');
r = P('"", ""');
eq(r.problems.length, 1, 'two empty quoted cells is an empty row');
eq(r.rows.length, 0, '…and makes nothing');
r = P('A, x\nB, x\nA, x');
eq(r.rows.length, 2, 'the same link under two labels makes two codes');
eq(r.problems.length, 1, 'only the exact repeat is left out');
eq(P('A, x\nA, y').rows.length, 2, 'the same label on two links makes two codes');
eq(P('a\n\nb\n  \n').total, 2, 'total counts rows, not blank lines');
r = P('a, b\nA, b');
eq(r.rows.length, 2, 'a repeat is exact: case differs, both stay');

/* 6. Too long, read off the real encoder. */
for (const ec of ['L', 'M', 'Q', 'H']) {
  const cap = B.CAPACITY[ec];
  ok(fits('a'.repeat(cap), ec), `${ec}: the table's ${cap} bytes fit the real encoder`);
  ok(!fits('a'.repeat(cap + 1), ec), `${ec}: one more byte does not`);
  const at = P('x, ' + 'a'.repeat(cap), { ec });
  eq(at.rows.length, 1, `${ec}: ${cap} bytes make a code`);
  const over = P('x, ' + 'a'.repeat(cap + 1), { ec });
  eq(over.rows.length, 0, `${ec}: ${cap + 1} bytes do not`);
  ok(over.problems.length === 1 && /too long/.test(over.problems[0].reason) && over.problems[0].reason.indexOf(String(cap + 1)) !== -1 && over.problems[0].reason.indexOf(' ' + ec + ' ') !== -1,
    `${ec}: the reason names the level and both sizes: ${(over.problems[0] || {}).reason}`);
}
eq(P('x, ' + 'a'.repeat(2331), { ec: 'bogus' }).rows.length, 1, 'an unknown level reads as M');
eq(P('x, ' + 'a'.repeat(2332), { ec: 'bogus' }).rows.length, 0, '…and applies M\'s limit');
eq(P('x, ' + 'a'.repeat(2332), {}).rows.length, 0, 'no level reads as M');
// Bytes, not characters.
ok(fits('é'.repeat(1165), 'M') && !fits('é'.repeat(1166), 'M'), 'the encoder counts é as two bytes');
eq(P('x, ' + 'é'.repeat(1165)).rows.length, 1, '1165 é (2330 bytes) make a code at M');
eq(P('x, ' + 'é'.repeat(1166)).rows.length, 0, '1166 é (2332 bytes) do not');
eq(B.utf8Len('a€😀'), 1 + 3 + 4, 'utf8Len counts 1, 3 and 4 byte characters');
ok(fits('😀'.repeat(582), 'M') && !fits('😀'.repeat(583), 'M'), 'the encoder counts an emoji as four bytes');
eq(P('x, ' + '😀'.repeat(582)).rows.length, 1, '582 emoji (2328 bytes) make a code');
eq(P('x, ' + '😀'.repeat(583)).rows.length, 0, '583 emoji (2332 bytes) do not');
// A long label does not count against the link.
eq(P('L'.repeat(3000) + ', https://example.com/ok').rows.length, 1, 'the limit is the link, not the label');

/* 7. Labels. */
eq(B.LABEL_MAX, 60, 'the label rule is 60 characters');
eq(B.shortLabel('x'.repeat(60)), 'x'.repeat(60), '60 characters are shown whole');
eq(B.shortLabel('x'.repeat(61)), 'x'.repeat(59) + '…', '61 are cut to 59 and an ellipsis (60 in all)');
eq(Array.from(B.shortLabel('😀'.repeat(70))).length, 60, 'an emoji label is cut by characters, never in half');
eq(B.shortLabel('x'.repeat(58) + ' ' + 'y'.repeat(10)), 'x'.repeat(58) + '…', 'no space before the ellipsis');
r = P('x'.repeat(61) + ', https://example.com/1\nshort, https://example.com/2');
eq(r.shortened, 1, 'one shortened label is counted');
eq(r.rows[0].shown, 'x'.repeat(59) + '…', 'the row carries the shown label');
eq(r.rows[0].label, 'x'.repeat(61), '…and keeps the whole one');
eq(r.rows[0].content, 'https://example.com/1', 'the link is never shortened');
eq(r.rows[1].shown, 'short', 'a short label is shown as is');
eq(P('A, ' + 'a'.repeat(2900), { ec: 'L' }).rows[0].content.length, 2900, 'a long link at L is whole');

/* 8. Nothing in, nothing out. */
for (const empty of ['', '\n\n', '   \n\t\n', null, undefined]) {
  const e = P(empty);
  ok(e.rows.length === 0 && e.problems.length === 0 && e.header === false, `an empty paste (${JSON.stringify(empty)}) is no rows and no problems`);
}
// The text it is given is never run: a tag stays a string.
r = P('<img src=x onerror=alert(1)>, https://example.com/x');
eq(r.rows[0].label, '<img src=x onerror=alert(1)>', 'markup in a label is carried as text');
eq(P('=HYPERLINK("x"), y').rows[0].label.charAt(0), '=', 'a leading = is carried as text');

console.log(`\n${failed ? 'FAIL' : 'PASS'} — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
