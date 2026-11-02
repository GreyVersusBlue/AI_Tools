// psa-pull.test.mjs — reading 028's source library for 056, in pure Node.
//
//   node Tools/dbq-source-packet-builder/test/psa-pull.test.mjs
//
// dbq-psa-pull.js shapes entries from another tool's storage into packet
// sources. Whatever is in that key is untrusted shape: the wrong type is
// dropped, an image survives only as an `idb:` reference or an inline image,
// the citation is built in a fixed order, and a picture's description does not
// end up as its text. PULL_FILE points the suite at another copy of the module
// (the deliberate-break runs use it). Every title is invented. Exits 1 on any
// failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.PULL_FILE || path.join(here, '..', 'dbq-psa-pull.js');
await import(pathToFileURL(file).href);
const P = globalThis.DbqPsaPull;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Reading 028’s library for a packet');

eq(P.KEY, 'gvb-primary-source:library', 'the key is 028’s');

/* read */
eq(P.read(null), [], 'nothing stored is nothing');
eq(P.read('{not json'), [], 'unreadable is nothing');
eq(P.read('{"a":1}'), [], 'an object where a list belongs is nothing');
const raw = JSON.stringify([
  { id: 'a', title: ' Letter ', type: 'text', text: 'Dear friends', description: 'd', citationAuthor: 'A. Writer', citationOrigin: 'Archive X', citationDate: '1963', tags: ['unit 3', ' ', 7, 'unit 3'], savedAt: '2026-01-02' },
  { id: 'b', title: 'Photo', type: 'photo', description: 'A street', imageDataUrl: 'idb:h0123abcd' },
  { id: 'c', title: 'Inline', imageDataUrl: 'data:image/png;base64,AAAA' },
  { id: 'd', title: 'Hostile', imageDataUrl: 'javascript:alert(1)' },
  { id: 'e', title: 'Quote', imageDataUrl: 'idb:abc" onerror="x' },
  null, 'text', 5, {},
  { id: 'f' },
  { id: 'a', title: 'Duplicate id' },
  { id: 'g', title: 7, text: ['not', 'a', 'string'] },
]);
const list = P.read(raw);
eq(list.map(e => e.id), ['a', 'b', 'c', 'd', 'e'], 'readable entries stay, junk and a repeated id go');
eq(list[0].title, 'Letter', 'a title is trimmed');
eq(list[0].tags, ['unit 3', 'unit 3'], 'tags keep only strings, trimmed');
eq(list.map(e => e.image), ['', 'idb:h0123abcd', 'data:image/png;base64,AAAA', '', ''], 'an image is kept only as an idb reference or an inline image');
eq(P.read(JSON.stringify(Array.from({ length: 600 }, (_, i) => ({ id: 'x' + i, title: 'T' + i })))).length, 500, 'a very long library is cut at 500');

/* citation, label */
eq(P.citationOf(list[0]), 'A. Writer, Archive X, 1963', 'author, origin, date, in that order');
eq(P.citationOf({ author: '', origin: 'Archive X', date: '' }), 'Archive X', 'only the parts that exist');
eq(P.citationOf({ author: '', origin: '', date: '' }), '', 'none is empty');
eq(P.label(list[0]), 'Letter', 'a title is the label');
eq(P.label({ title: '', author: 'A', origin: '', date: '', text: '', description: '' }), 'A', 'no title: the citation');
eq(P.label({ title: '', author: '', origin: '', date: '', text: 'x'.repeat(60), description: '' }), 'x'.repeat(40) + '…', 'no title or citation: the start of the text');
eq(P.label({ title: '', author: '', origin: '', date: '', text: '', description: '' }), 'Untitled source', 'nothing at all');

/* search */
eq(list.filter(e => P.matches(e, 'unit 3')).map(e => e.id), ['a'], 'search finds a tag');
eq(list.filter(e => P.matches(e, 'ARCHIVE')).map(e => e.id), ['a'], 'a citation, any case');
eq(list.filter(e => P.matches(e, 'street')).map(e => e.id), ['b'], 'a description');
eq(list.filter(e => P.matches(e, '  ')).length, 5, 'a blank search finds everything');
eq(list.filter(e => P.matches(e, 'zzz')).length, 0, 'and nothing else matches nothing');

/* the packet source */
let s = P.toSource(list[0], 'S1', 'Q1');
eq([s.id, s.bankId, s.title, s.type, s.text, s.image, s.citation, s.widthPct], ['S1', null, 'Letter', 'text', 'Dear friends', null, 'A. Writer, Archive X, 1963', 100], 'a text entry becomes a text source');
eq(s.questions, [{ id: 'Q1', text: '' }], 'with one empty question');
eq(s.crop, { x: 0, y: 0, w: 1, h: 1 }, 'and an uncropped frame');
s = P.toSource({ ...list[0], text: '  ' }, 'S', 'Q');
eq(s.text, 'd', 'a text entry with no text takes its description');
s = P.toSource(list[1], 'S2', 'Q2');
eq([s.type, s.text, s.image], ['image', '', null], 'a picture is an image source; its description is not its text; the page sets the image');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
