// import-logic.test.mjs — pure-logic checks for deg-import.js (BACKLOG rank 87): a whole custom
// bank pasted into 055, one broken sentence and its correction per line. No browser, no clock.
//
//   node Tools/daily-editing-warmup-generator/test/import-logic.test.mjs
//   DEG_MODULE=<path> node ...   runs the same checks on a broken copy (how the mutants are shown)
//
// Exits 1 on any failure. Every sentence here is invented.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..', '..', '..');
const shim = {};
shim.globalThis = shim;
new Function('globalThis', fs.readFileSync(path.join(root, '_shared', 'paste-table.js'), 'utf8').replace(/\}\)\((typeof window[^)]*)\);?\s*$/, '})(globalThis);'))(shim);
const file = process.env.DEG_MODULE || path.join(dir, '..', 'deg-import.js');
new Function('globalThis', fs.readFileSync(file, 'utf8').replace(/\}\)\(typeof window[^\n]*\);?\s*$/, '})(globalThis);'))(shim);
const D = shim.DegImport;
if (!shim.PasteTable) { console.error('PasteTable did not load'); process.exit(1); }

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('FAIL: ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

const CATS = ['capitalization', 'punctuation', 'homophones', 'subject-verb', 'run-ons', 'other'];
const LABELS = { capitalization: 'Capitalization', punctuation: 'Punctuation & Apostrophes', homophones: 'Homophones', 'subject-verb': 'Subject-Verb Agreement', 'run-ons': 'Run-ons & Comma Splices', other: 'Other' };
const P = (t, o) => D.parse(t, Object.assign({ categories: CATS, labels: LABELS }, o || {}));

// ---- separators
let r = P('the cat sit\tThe cat sits.');
eq(r.rows.map(x => [x.broken, x.fixed, x.category]), [['the cat sit', 'The cat sits.', 'other']], 'a tab separates the two sentences');
r = P('the cat sit | The cat sits.');
eq(r.rows.map(x => [x.broken, x.fixed]), [['the cat sit', 'The cat sits.']], 'so does a bar, spaces trimmed');
r = P('a, b, and c is here | A, B, and C are here.');
eq(r.rows[0].broken, 'a, b, and c is here', 'commas inside a sentence are left alone');
r = P('one bad\tOne bad.\ntwo bad | Two bad.');
eq(r.rows.length, 2, 'tab lines and bar lines in one paste both read');
r = P('he said "hi"\tHe said, "Hi."');
eq(r.rows.map(x => [x.broken, x.fixed]), [['he said "hi"', 'He said, "Hi."']], 'quotation marks are text, not CSV quoting');
r = P('a tab | in the first\tThe tab wins.');
eq(r.rows[0].broken, 'a tab | in the first', 'a line with a tab is cut on tabs only');
r = P('cats, dogs and birds is nice, I think');
eq(r.rows.length + '/' + r.skipped.length, '0/1', 'a comma is not a separator');
r = P('line with no separator at all');
eq(r.rows.length + '/' + r.skipped.length, '0/1', 'a line with neither is skipped');
ok(/no tab or \|/.test(r.skipped[0].reason) && r.skipped[0].line === 1, 'and named with its line number and why');

// ---- error type
r = P('x bad | X bad. | subject-verb');
eq(r.rows[0].category, 'subject-verb', 'a key names the error type');
r = P('x bad | X bad. | Run-ons & Comma Splices');
eq(r.rows[0].category, 'run-ons', 'so does its label, any case');
r = P('x bad | X bad. | punctuation');
eq(r.rows[0].category, 'punctuation', 'so does the first word of a label');
r = P('x bad | X bad. | Homoph');
eq(r.rows[0].category, 'homophones', 'four letters of it are enough');
r = P('x bad | X bad. | hom');
eq(r.rows[0].category + '/' + r.unknown, 'other/1', 'three letters are not (counted as unknown)');
r = P('x bad | X bad. | mystery');
eq(r.rows[0].category + '/' + r.unknown, 'other/1', 'an unknown type files under the fallback and is counted');
r = P('x bad | X bad.\ny bad | Y bad.', { fallback: 'homophones' });
eq(r.rows.map(x => x.category), ['homophones', 'homophones'], 'the fallback is the one the page chose');
eq(r.unnamed, 2, 'and the lines that named nothing are counted');
r = P('x bad | X bad. | other | an extra cell');
eq(r.rows[0].category, 'other', 'a fourth cell is ignored');
r = P('x bad | X bad. |');
eq(r.rows.length + '/' + r.unnamed, '1/1', 'an empty third cell is “no type”');

// ---- heading line
r = P('Broken | Fixed | Type\na bad | A bad.');
ok(r.header && r.rows.length === 1, 'a heading line is read as one, not as a sentence');
r = P('Sentence\tCorrection\na bad\tA bad.');
ok(r.header && r.rows.length === 1, 'other heading words');
r = P('a bad | A bad.\nBroken | Fixed');
ok(!r.header && r.rows.length === 2, 'only the first line can be a heading');
r = P('Broken tests are bad | Broken tests are bad!');
ok(!r.header && r.rows.length === 1, 'a sentence that starts with a heading word is a sentence');

// ---- skipped, with line numbers (blank lines count)
r = P('\nok one | Ok one.\n\n | only a fix\nonly broken | \nsame | same\n' + 'x'.repeat(301) + ' | y');
eq(r.rows.map(x => x.line), [2], 'the good row keeps its real line number');
eq(r.skipped.map(x => x.line), [4, 5, 6, 7], 'bad lines are named by real line number, blank lines included');
ok(/no broken/.test(r.skipped[0].reason) && /no correction/.test(r.skipped[1].reason) && /same as/.test(r.skipped[2].reason) && /over 300/.test(r.skipped[3].reason), 'each with its own reason: ' + JSON.stringify(r.skipped.map(x => x.reason)));
r = P('   \n\n  ');
eq(r.rows.length + r.skipped.length, 0, 'only blank lines is nothing, not an error');
r = P('');
eq(r.rows.length, 0, 'empty paste');
r = P(null);
eq(r.rows.length, 0, 'null paste');
r = P('ok  with   spaces | Ok with spaces.');
eq(r.rows[0].broken, 'ok with spaces', 'runs of spaces are collapsed');
r = P('a bad|A bad.\r\nb bad|B bad.\r\n');
eq(r.rows.length, 2, 'Windows line endings');

// ---- cap
const many = Array.from({ length: D.MAX_ROWS + 7 }, (_, i) => 'bad ' + i + ' | Good ' + i + '.').join('\n');
r = P(many);
eq(r.rows.length, D.MAX_ROWS, 'a long paste is cut at the limit');
eq(r.over, 7, 'and says by how many');

// ---- plan: repeats against the bank and within the paste
const bank = [{ broken: 'Their going home', fixed: 'They’re going home.' }, { broken: 'own one', fixed: 'Own one.' }];
const rows = P('their going home | They’re going home.\nOWN ONE | own one.\nnew a | New a.\nnew a | New a.\nnew b | New b.').rows;
let pl = D.plan(rows, bank);
eq(pl.add.map(x => x.broken), ['new a', 'new b'], 'a repeat of the bank (any case) or of an earlier line is left out');
eq(pl.repeats.map(x => x.line), [1, 2, 4], 'and named by line');
eq(D.plan(rows, []).add.length, 4, 'with an empty bank only the in-paste repeat goes');
eq(D.plan([], bank).add.length, 0, 'nothing in, nothing out');
eq(D.fingerprint({ broken: ' A ', fixed: 'b' }), D.fingerprint({ broken: 'a', fixed: ' B ' }), 'the fingerprint is trimmed and case-folded, the share link’s');

console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
