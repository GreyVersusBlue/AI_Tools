// Path 11 P2 increment 2: sv-model.js gives every answer 035's own functions
// gave before the move. Pure Node, no browser.
//
// model-golden.json was written by running _model-cases.mjs through the v320
// page's functions (read out of the page, with AppState set per call); this
// runs the same cases through the module and compares the JSON. A rule
// changed in the module, on purpose or not, fails here naming the case. The
// golden file is not regenerated from the module: a change that is meant
// writes the new answer into it by hand, in the commit that makes it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../sv-model.js';
import { CASES } from './_model-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'model-golden.json'), 'utf8'));

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

for (const c of CASES) {
  const got = JSON.stringify(c.run(M));
  const want = JSON.stringify(golden[c.name]);
  let where = '';
  if (got !== want) {
    let i = 0; while (i < got.length && got[i] === want[i]) i++;
    where = `\n         first difference at character ${i}: got …${got.slice(Math.max(0, i - 40), i + 40)}…\n         want …${(want || '').slice(Math.max(0, i - 40), i + 40)}…`;
  }
  check(got === want, `${c.name} matches v320` + where);
}
check(Object.keys(golden).length === CASES.length, `every golden case is run (${Object.keys(golden).length} in the file, ${CASES.length} cases)`);

// What the golden file cannot pin: a fresh id each call, and in the page's shape.
// The clock and the random source are stubbed, because the old id (clock plus
// four random characters) collided only when 200 calls shared a millisecond and
// a random draw, about one run in fifteen. With both held still it hands out the
// same id 200 times, every run; an id maker that is unique by construction does not
// care what they return.
function withStubs(clock, rand, fn) {
  const now = Date.now, random = Math.random;
  Date.now = clock; Math.random = rand;
  try { return fn(); } finally { Date.now = now; Math.random = random; }
}
const SHAPE = /^grp_[0-9a-z]+$/;
for (const [label, rand] of [['a constant random source', () => 0.5], ['a random source of 0', () => 0], ['a random source just under 1', () => 0.9999999999]]) {
  const ids = withStubs(() => 1792963800000, rand, () => new Set(Array.from({ length: 200 }, () => M.groupId())));
  check(ids.size === 200 && [...ids].every(id => SHAPE.test(id)), `groupId() gives 200 distinct grp_ ids with a still clock and ${label}`);
}
const real = new Set(Array.from({ length: 2000 }, () => M.groupId()));
check(real.size === 2000 && [...real].every(id => SHAPE.test(id)), 'groupId() gives 2000 distinct grp_ ids on the real clock and random source');
// An id already taken is never handed out: the first five candidates are refused.
{
  const asked = [];
  const taken = { has(id) { asked.push(id); return asked.length <= 5; } };
  const id = M.groupId(taken);
  check(asked.length === 6 && id === asked[5] && new Set(asked).size === 6, 'groupId(taken) skips every id taken already and returns the first free one');
}
// taken may be the groups themselves, plain ids, or a mix with junk in it.
{
  const groups = [{ id: 'grp_old1' }, 'grp_old2', null, { name: 'no id' }];
  const id = M.groupId(groups);
  check(SHAPE.test(id) && id !== 'grp_old1' && id !== 'grp_old2', 'groupId(groups) reads records with an id, plain ids and junk alike');
}
check(/^floor_[0-9a-z]+$/.test(M.freshId('floor_', [])) && /^be_[0-9a-z]+$/.test(M.freshId('be_')), 'freshId keeps the prefix it is given');
// The module must not reach for page state.
const src = fs.readFileSync(path.join(HERE, '..', 'sv-model.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
for (const name of ['AppState', 'document', 'window', 'localStorage', 'roomRegistry'])
  check(!new RegExp(`\\b${name}\\b`).test(src), `sv-model.js does not read ${name}`);
// normalizeSettings deep-clones the subject seed, so the seed is never shared.
const a = M.normalizeSettings({}), b = M.normalizeSettings({});
a.subjects[0].color = '#000000';
check(b.subjects[0].color === '#2563eb' && M.SUBJECT_SEED[0].color === '#2563eb', 'normalizeSettings hands out a copy of the subject seed');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
