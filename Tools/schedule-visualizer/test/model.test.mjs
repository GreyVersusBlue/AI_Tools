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
const ids = new Set(Array.from({ length: 200 }, () => M.groupId()));
check(ids.size === 200 && [...ids].every(id => /^grp_[0-9a-z]+$/.test(id)), 'groupId() gives 200 distinct grp_ ids');
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
