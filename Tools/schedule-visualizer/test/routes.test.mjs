// Path 11 P2 increment 4: sv-routes.js gives every answer 035's own
// findGroupDayPath, computeCongestionMap, isCellHeatExcluded and evacuation
// functions gave before the move. Pure Node, no browser.
//
// routes-golden.json was written by running _routes-cases.mjs through the
// v320 page's functions (read out of the page, with AppState and the cached
// graph set per call); this runs the same cases through the module and
// compares the JSON. The cases cover a day with a blank mod, a same-room pair
// and an unknown room on both days and three mod counts; congestion with sized
// and unsized groups under two defaults; a zone on floor 2 that excludes a
// floor-2 cell and not the floor-1 cell under it, and a cell with no floorId
// checked against the active floor's zones (the rule P2 keeps: Devon, P11-9);
// exits nearest by cost through a staircase, an unreachable exit, a room not
// in the graph and no exits at all; and step lists with turns and a stair.
// The golden file is not regenerated from the module: a change that is meant
// edits it by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../sv-routes.js';
import { buildGraph } from '../sv-graph.js';
import { CASES } from './_routes-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'routes-golden.json'), 'utf8'));
const M = { ...R, buildGraph };

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
    where = `\n         first difference at character ${i}: got …${got.slice(Math.max(0, i - 60), i + 40)}…\n         want …${(want || '').slice(Math.max(0, i - 60), i + 40)}…`;
  }
  check(got === want, `${c.name} matches v320` + where);
}
check(Object.keys(golden).length === CASES.length, `every golden case is run (${Object.keys(golden).length} in the file, ${CASES.length} cases)`);

const src = fs.readFileSync(path.join(HERE, '..', 'sv-routes.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
for (const name of ['AppState', 'document', 'window', 'localStorage', 'getPathfindingGraph', 'floorLabelById'])
  check(!new RegExp(`\\b${name}\\b`).test(src), `sv-routes.js does not read ${name}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
