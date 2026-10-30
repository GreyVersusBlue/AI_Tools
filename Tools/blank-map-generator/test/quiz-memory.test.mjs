// quiz-memory.test.mjs — bmg-quiz-memory.js on its own (Path 20 P5), pure Node, no port.
// Named cases for the class's quiz history: place identity, one mark per place per round, replacing a mark,
// what counts as weak and in what order, the missed-first pick, forgetting and pruning, caps, and reading
// junk out of storage. Then each MUTANT re-imports the source with one deliberate defect and the suite must notice.
//
//   node Tools/blank-map-generator/test/quiz-memory.test.mjs   (npm run test:blank-map-quiz-memory)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Real from '../bmg-quiz-memory.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '..', 'bmg-quiz-memory.js'), 'utf8');
const j = v => JSON.stringify(v);

function suite(M) {
  const bad = [];
  const t = (c, l) => { if (!c) bad.push(l); };

  t(M.keyOf('  New   York ') === 'new york' && M.keyOf('NEW YORK') === 'new york', 'a place is the same whatever its capitals and spacing');
  t(M.keyOf('') === null && M.keyOf('   ') === null && M.keyOf(null) === null, 'a label with no text has no identity');
  t(M.keyOf('x'.repeat(200)).length === 80, 'a very long name is cut at 80');

  let m = M.empty();
  m = M.record(m, 'p1', 'Nile', 'missed', '2026-10-01');
  t(M.weakList(m, 'p1').length === 1 && M.weakList(m, 'p1')[0].text === 'Nile' && M.weakList(m, 'p1')[0].missed === 1, 'a miss makes the place weak');
  const before = j(m);
  M.record(m, 'p1', 'Nile', 'got', '2026-10-02');
  t(j(m) === before, 'recording does not change the memory it was given');
  t(M.record(m, 'p1', 'Nile', 'missed', '2026-10-01', 'missed') === m, 'the same button twice in a round counts once');
  const swapped = M.record(m, 'p1', 'Nile', 'got', '2026-10-01', 'missed');
  t(swapped.projects.p1.labels.nile.got === 1 && swapped.projects.p1.labels.nile.missed === 0 && M.weakList(swapped, 'p1').length === 0, 'the other button replaces the first mark rather than adding a second');
  const back = M.record(M.record(M.empty(), 'p1', 'Nile', 'got', '2026-10-01'), 'p1', 'Nile', 'missed', '2026-10-01', 'got');
  t(back.projects.p1.labels.nile.got === 0 && back.projects.p1.labels.nile.missed === 1, 'and a got replaced by a miss is taken back too');
  t(M.record(m, 'p1', '', 'missed', '2026-10-01') === m && M.record(m, 'p1', 'Nile', 'maybe', '2026-10-01') === m && M.record(m, '', 'Nile', 'got', '2026-10-01') === m, 'an empty name, a made-up result or no project records nothing');

  // weak: missed more than got, or missed last time
  let w = M.empty();
  for (const [text, results] of [['Alps', ['missed', 'missed', 'got']], ['Rhine', ['got', 'got', 'missed']], ['Po', ['missed', 'got', 'got']], ['Elbe', ['got']]]) {
    results.forEach((r, i) => { w = M.record(w, 'p', text, r, '2026-10-0' + (i + 1)); });
  }
  t(M.weakList(w, 'p').map(e => e.text).join() === 'Alps,Rhine', 'weak is missed more than got, or missed last: ' + M.weakList(w, 'p').map(e => e.text).join());
  t(M.isWeak({ missed: 0, got: 0, last: 'missed' }) === false && M.isWeak(undefined) === false, 'no misses is never weak');
  let order = M.empty();
  ['missed', 'missed', 'got'].forEach((r, i) => { order = M.record(order, 'p', 'a', r, '2026-10-0' + (i + 1)); });
  ['missed', 'missed', 'missed'].forEach((r, i) => { order = M.record(order, 'p', 'b', r, '2026-10-0' + (i + 1)); });
  ['missed', 'missed', 'got', 'missed'].forEach((r, i) => { order = M.record(order, 'p', 'c', r, '2026-10-0' + (i + 1)); });
  t(M.weakList(order, 'p').map(e => e.text).join() === 'b,c,a', 'worst first: net misses, then misses: ' + M.weakList(order, 'p').map(e => e.text).join());
  t(M.weakList(m, 'other').length === 0 && M.weakList(null, 'p').length === 0 && M.weakList(m, '__proto__').length === 0, 'another project, no memory or a hostile id has none');

  // pick
  const hidden = [{ id: 1, text: 'Alps' }, { id: 2, text: 'Elbe' }, { id: 3, text: 'Rhine' }];
  const pk = M.pickWeak(hidden, w, 'p', () => 0);
  t(pk && pk.text === 'Alps', 'missed-first picks among the hidden places that are weak');
  t(M.pickWeak([{ id: 2, text: 'Elbe' }], w, 'p') === null, 'and null when none of the hidden ones is weak');
  t(M.pickWeak(hidden, w, 'p', () => 0.99).text === 'Rhine', 'with the random draw spread over the weak ones');
  t(M.pickWeak(hidden, w, 'p', () => 1).text === 'Rhine', 'a draw of exactly 1 stays inside the list');
  t(M.pickWeak(hidden, w, 'nope') === null, 'a project with no history picks nothing');

  // forget, prune
  const two = M.record(M.record(M.empty(), 'a', 'X', 'missed', '2026-10-01'), 'b', 'Y', 'missed', '2026-10-01');
  t(!('a' in M.forget(two, 'a').projects) && 'b' in M.forget(two, 'a').projects && 'a' in two.projects, 'forgetting one map leaves the others and the input alone');
  t(j(Object.keys(M.prune(two, ['b']).projects)) === '["b"]' && Object.keys(M.prune(two, []).projects).length === 0, 'pruning keeps only maps that still exist');

  // normalize
  t(j(M.normalize({ __v: 9, projects: { p: { labels: { a: { text: 'a', got: 1 } } } } })) === j(M.empty()), 'another version of the memory reads as empty');
  t(j(M.normalize(null)) === j(M.empty()) && j(M.normalize('x')) === j(M.empty()) && j(M.normalize({ __v: 9, projects: {} })) === j(M.empty()), 'junk and another version read as empty');
  const dirty = M.normalize({ __v: 1, projects: {
    ok: { at: '2026-10-01', labels: { nile: { text: 'Nile', got: 2, missed: 3.5, last: 'got', at: 'yesterday' }, 'Bad Key': { text: 'x', got: 1 }, zero: { text: 'z', got: 0, missed: 0 }, huge: { text: 'H', got: 99999999, missed: 1, last: 'zz' } } },
    notobj: 5, nolabels: { at: '2026-10-01' }, '<img>': { at: '2026-10-01', labels: { a: { text: '<b>', got: 1 } } },
  } });
  t(j(Object.keys(dirty.projects).sort()) === '["<img>","ok"]', 'a project with no usable labels is dropped: ' + j(Object.keys(dirty.projects)));
  const ok = dirty.projects.ok.labels;
  t(!('Bad Key' in ok) && !('zero' in ok), 'a key that is not a normalised name and a place with no counts are dropped');
  t(ok.nile.missed === 0 && ok.nile.got === 2 && ok.nile.at === '', 'a fractional count reads as 0 and a bad date as empty');
  t(ok.huge.got === 9999 && ok.huge.last === 'got', 'a count is capped at 9999 and a bad "last" is worked out');
  t(dirty.projects['<img>'].labels.a.text === '<b>', 'text is kept as text (the page writes it with textContent)');
  const many = { __v: 1, projects: {} };
  for (let i = 0; i < 60; i++) many.projects['p' + i] = { at: '2026-10-' + String(10 + (i % 20)).padStart(2, '0'), labels: { a: { text: 'a', got: 1, missed: 0, last: 'got', at: '' } } };
  t(Object.keys(M.normalize(many).projects).length === M.MAX_PROJECTS, 'projects are capped at ' + M.MAX_PROJECTS);
  let big = M.empty();
  for (let i = 0; i < M.MAX_LABELS + 5; i++) big = M.record(big, 'p', 'place ' + i, 'missed', '2026-10-' + String(1 + (i % 28)).padStart(2, '0'));
  t(Object.keys(big.projects.p.labels).length === M.MAX_LABELS, 'a project keeps at most ' + M.MAX_LABELS + ' places');
  t(M.KEY === 'bmg_quiz_memory_v1', 'the storage key is the one the registry declares');
  return bad;
}

const MUTANTS = [
  ['capitals make a different place', ".toLowerCase();\n  return k", ";\n  return k"],
  ['spacing makes a different place', ".replace(/\\s+/g, ' ')", ""],
  ['a name is not cut', 'k.slice(0, MAX_TEXT) : null', 'k : null'],
  ['the same mark twice counts twice', 'if (prev === result) return mem;', ''],
  ['a replaced got is not taken back', "if (prev === 'got') e.got = Math.max(0, e.got - 1);", ''],
  ['a replaced miss is not taken back', "if (prev === 'missed') e.missed = Math.max(0, e.missed - 1);", ''],
  ['recording changes its input', 'const out = clone(normalize(mem));\n  const p = out.projects[projectId]', 'const out = mem;\n  const p = out.projects[projectId]'],
  ['weak ignores a miss last time', 'e.missed > 0 && (e.missed > e.got || e.last === \'missed\')', 'e.missed > e.got'],
  ['weak includes a clean place', 'e.missed > 0 && (e.missed', '(e.missed'],
  ['worst is not first', '(b.missed - b.got) - (a.missed - a.got) || b.missed - a.missed', 'a.missed - b.missed'],
  ['the pick ignores the weak list', 'weak.has(keyOf(l.text))', 'true'],
  ['the pick can run off the list', 'Math.min(pool.length - 1, Math.floor(rng() * pool.length))', 'Math.floor(rng() * pool.length)'],
  ['forgetting one forgets all', 'delete out.projects[projectId];', 'out.projects = {};'],
  ['pruning keeps the gone', 'if (!live.has(id)) delete out.projects[id];', ''],
  ['a count is not capped', 'Math.min(v, MAX_COUNT) : 0', 'v : 0'],
  ['a fractional count passes', 'Number.isInteger(v) && v > 0', 'v > 0'],
  ['another version is read', 'raw.__v !== VERSION ||', ''],
  ['a bad key is kept', 'k !== keyOf(k)', 'false'],
  ['projects are not capped', 'if (ids.length > MAX_PROJECTS) {', 'if (false) {'],
  ['places are not capped', 'if (keys.length > MAX_LABELS) {', 'if (false) {'],
];

let failed = 0;
const realBad = suite(Real);
failed += realBad.length;
realBad.forEach(m => console.error('FAIL  ' + m));

for (const [name, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { failed++; console.error(`FAIL  mutant "${name}": the text it changes is not in bmg-quiz-memory.js any more`); continue; }
  const mod = await import('data:text/javascript;base64,' + Buffer.from(SRC.replace(from, to)).toString('base64'));
  let caught;
  try { caught = suite(mod); } catch (e) { caught = ['threw ' + e.message]; }
  if (!caught.length) { failed++; console.error(`FAIL  mutant "${name}" was NOT caught`); }
}

console.log(failed ? `quiz-memory: ${failed} FAILED` : `quiz-memory: OK — every case passes, ${MUTANTS.length} mutants all caught`);
process.exit(failed ? 1 : 0);
