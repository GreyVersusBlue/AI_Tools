// ss-glossary.test.mjs — _shared/ss-glossary.js and _shared/levels.js (AI-30, ranks 67 and 68). Pure Node.
// The glossary sets are held to golden-sets.json, a copy of the two tables as 056 and 028 printed them
// before the move (key order too: 028 prints in text order but sorts ties by key order). stemKey()
// is held to 056's old inline lookup over every word, every inflection of it and 3000 seeded words.
// Levels is held to the four pages' old lists.
//   node Tools/ss-glossary/test/ss-glossary.test.mjs   (npm run test:ss-glossary)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../../_shared/ss-glossary.js';
import '../../../_shared/levels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(here, 'golden-sets.json'), 'utf8'));
const G = globalThis.SSGlossary, L = globalThis.Levels;
let passed = 0, failed = 0;
const eq = (a, b, label) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else { failed++; console.log(`  FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };

eq(G.names(), ['dbq', 'psa'], 'set names');
eq(G.set('dbq'), golden.dbq, 'dbq set unchanged (entries and order)');
eq(G.set('psa'), golden.psa, 'psa set unchanged (entries and order)');
eq(Object.keys(golden.dbq).length, 58, 'dbq count'); eq(Object.keys(golden.psa).length, 78, 'psa count');
eq(G.set('nope'), undefined, 'unknown set');

// 056's old lookup, frozen
const oldKey = (GL, w) => {
  let key = null;
  if (GL[w]) key = w;
  else if (/ies$/.test(w) && GL[w.slice(0, -3) + 'y']) key = w.slice(0, -3) + 'y';
  else if (/(es|ed)$/.test(w) && GL[w.slice(0, -2)]) key = w.slice(0, -2);
  else if (/ing$/.test(w) && GL[w.slice(0, -3)]) key = w.slice(0, -3);
  else if (/s$/.test(w) && GL[w.slice(0, -1)]) key = w.slice(0, -1);
  return key;
};
const words = Object.keys(golden.dbq);
for (const w of words) for (const f of ['', 's', 'es', 'ed', 'ing']) eq(G.stemKey('dbq', w + f), oldKey(golden.dbq, w + f), 'stem ' + w + f);
eq(G.stemKey('dbq', 'colonies'), 'colony', 'ies -> y'); eq(G.stemKey('dbq', 'xyz'), null, 'no hit'); eq(G.stemKey('zzz', 'colony'), null, 'unknown set');
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const letters = 'abcdeilnoprstuy';
for (let i = 0; i < 3000; i++) {
  let w = ''; const n = 3 + Math.floor(rnd() * 8); for (let k = 0; k < n; k++) w += letters[Math.floor(rnd() * letters.length)];
  eq(G.stemKey('dbq', w), oldKey(golden.dbq, w), 'random ' + w);
}
G.add('dbq', 'zzzword', 'x'); eq(G.set('dbq').zzzword, 'x', 'add'); G.add('dbq', 'zzzword', 'y'); eq(G.set('dbq').zzzword, 'x', 'add does not replace');
G.add('dbq', 'census', 'changed'); eq(G.set('dbq').census, golden.dbq.census, 'add does not replace an existing word');
delete G.set('dbq').zzzword;

// levels: the four pages' old lists
eq(L.LEVELS, [{ id: 'academic', label: 'Academic' }, { id: 'honors', label: 'Honors' }, { id: 'gt', label: 'Honors GT' }], 'levels list (054)');
eq(L.LEVELS.map(l => ({ key: l.id, label: l.label })), [{ key: 'academic', label: 'Academic' }, { key: 'honors', label: 'Honors' }, { key: 'gt', label: 'Honors GT' }], 'levels as 056 keys');
eq(L.labels(), { academic: 'Academic', honors: 'Honors', gt: 'Honors GT' }, '083 LEVEL_LABEL');
eq(L.DEFAULT, 'honors', 'default');
for (const id of ['academic', 'honors', 'gt']) { eq(L.isLevel(id), true, 'isLevel ' + id); }
for (const id of ['honorsgt', '', 'x', undefined, 'constructor']) { eq(L.isLevel(id), false, 'isLevel ' + id); eq(L.label(id), 'Honors', 'label ' + id); }
eq(L.label('gt'), 'Honors GT', 'gt label (028 asks for it)');
eq(L.labels() !== L.labels(), true, 'labels() is a fresh object');
console.log(`ss-glossary: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
