// Path 11 P2 increment 6: sv-playback.js draws and returns what 035's own
// drawPlaybackFrame, buildCollisionSimulation and the staircase portal
// helpers did before the move. Pure Node, no browser.
//
// playback-golden.json was written by running _playback-cases.mjs through
// the v321 page's functions (read out of the page, with vizCtx, AppState, the
// clock and the reduced-motion test set per call); this runs the same cases
// through the module and compares the JSON. A frame is held by every call it
// makes on a recording 2D context and every property it sets, in order, plus
// what it tells the travel-time panel and what it leaves on pb (the live
// heads the hover tooltip reads and the real-time cycle). The cases cover
// both days and three transitions at five points of the cycle, trail and
// comet, sequential slices, three icon scales, two zooms with constant width,
// reduced motion, a real-time cycle, unset walk and stair seconds, the
// Northwind project, and the collision simulation's head-on, following,
// crossing and turning traffic. The golden file is not regenerated from the
// module: a change that is meant edits it by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../sv-playback.js';
import { buildGraph } from '../sv-graph.js';
import { groupDayPath } from '../sv-routes.js';
import { CASES } from './_playback-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'playback-golden.json'), 'utf8'));
const M = { ...P, buildGraph, groupDayPath };

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
  check(got === want, `${c.name} matches v321` + where);
}
check(Object.keys(golden).length === CASES.length, `every golden case is run (${Object.keys(golden).length} in the file, ${CASES.length} cases)`);

const src = fs.readFileSync(path.join(HERE, '..', 'sv-playback.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
for (const name of ['AppState', 'document', 'window', 'localStorage', 'vizCtx', 'getEffectiveCellSize', 'Date', 'matchMedia', 'requestAnimationFrame'])
  check(!new RegExp(`\\b${name}\\b`).test(src), `sv-playback.js does not read ${name}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
