// pictures-logic.test.mjs — vfg-pictures.js's pure half (rank 142): which term a picture belongs to,
// which terms of a list can have one, and which picture a card shows. Pure Node, no browser.
//
//   node Tools/vocab-flashcard-generator/test/pictures-logic.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ctx = { globalThis: null };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'Tools/vocab-flashcard-generator/vfg-pictures.js'), 'utf8'), ctx);
const V = ctx.VfgPictures;

let passed = 0, failed = 0;
const eq = (a, b, label) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; console.log(`  FAIL ${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
};

console.log('vfg-pictures.js, the pure half');
eq(V.key('  Photo   Synthesis '), 'photo synthesis', 'a key is trimmed, case-folded and has its runs of space made one');
eq(V.key('Photosynthesis'), V.key('photosynthesis'), 'the same word in two cases is one picture');
eq(V.key('café'), V.key('café'), 'a composed and a decomposed letter are one picture');
eq(V.key(''), '', 'an empty term has none');
eq(V.key('   '), '', 'a blank term has none');
eq(V.key(null), '', 'a missing term has none');
eq(V.key('x'.repeat(121)), '', 'a term over 120 characters has none');
eq(V.key('x'.repeat(120)).length, 120, 'and one of exactly 120 has one');
eq(V.termsOf([{ term: 'Cell' }, { term: 'cell ' }, { term: 'Mitosis' }, { term: '' }, null]), ['Cell', 'Mitosis'], 'a list\'s terms are its distinct, non-empty ones, first spelling kept, in order');
eq(V.termsOf(null), [], 'no items, no terms');
const pics = { cell: 'data:image/jpeg;base64,AAAA' };
eq(V.urlFor(pics, ' CELL '), 'data:image/jpeg;base64,AAAA', 'a card finds its picture by the normalised term');
eq(V.urlFor(pics, 'Mitosis'), '', 'a word with no picture shows none');
eq(V.urlFor(pics, 'constructor'), '', 'a word named like an Object property is not a picture');
eq(V.urlFor(null, 'cell'), '', 'no pictures loaded, none shown');
eq(V.NS, 'vocab', 'the namespace is the registry\'s');
eq(V.create(null).NS, 'vocab', 'a store wrapper with no MediaDB still builds');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
