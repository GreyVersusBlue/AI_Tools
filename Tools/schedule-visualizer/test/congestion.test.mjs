// Path 11 P2 increment 5: sv-congestion.js gives every answer 035's own
// buildCongestionData, computeTravelTimes, wiBaseMods, wiEffectiveMods,
// wiComputeMetrics and wiComputeDiff gave before the move. Pure Node, no
// browser. It is the first test the what-if lab has had.
//
// congestion-golden.json was written by running _congestion-cases.mjs through
// the v321 page's functions (read out of the page, with AppState, the room
// registry and the cached graph set per call); this runs the same cases
// through the module and compares the JSON. The cases cover congestion with
// every transition filter, sized, blank, string and zero group sizes under
// three defaults, a group found by name and a zone on another floor; travel
// times under four settings, one with the walk and stair seconds unset; base
// and effective mods with overrides out of range, blank and null; what-if
// metrics with no override, an empty one, a reroute, an override for a group
// that is gone and a conflict-excluded room; and the diff under three
// transition filters. Northwind runs through all but the mods case. The
// golden file is not regenerated from the module: a change that is meant
// edits it by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../sv-congestion.js';
import { buildGraph } from '../sv-graph.js';
import { groupDayPath } from '../sv-routes.js';
import { CASES } from './_congestion-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'congestion-golden.json'), 'utf8'));
const M = {
  ...C, buildGraph, groupDayPath,
  // The page's wiComputeDiff() computes both sides itself; the module takes them.
  whatIfDiff: (groups, day, ov, tf, ctx) =>
    C.whatIfDiff(C.whatIfMetrics(groups, day, null, ctx), C.whatIfMetrics(groups, day, ov, ctx), ov, tf),
};

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

// The R59 curve the delays go through, at its anchor points and between them.
// (A size of 0 is not a point on it: groupWeight reads 0 as unsized.)
const mult = [0.5, 1, 1.5, 2, 2.5, 3, 4].map(n => {
  const segs = [{ fromMod: 1, hallwayCells: [{ x: 0, y: 0, floorId: 'f' }] }];
  const data = { entries: [{ name: 'a', group: { size: 10 }, rawSegments: segs },
    { name: 'b', group: { size: Math.round(n * 10) }, rawSegments: JSON.parse(JSON.stringify(segs)) }] };
  C.travelTimes(data, { settings: { modCount: 2, tileWalkTime: 100, defaultGroupSize: 10 }, groups: [] });
  return data.entries[0].rawSegments[0].delaySec;
});
check(JSON.stringify(mult) === JSON.stringify([10, 20, 35, 50, 65, 80, 80]),
  `a 100 s tile's delay at 0.5, 1, 1.5, 2, 2.5, 3 and 4 other groups is 10, 20, 35, 50, 65, 80, 80 s (got ${mult.join(', ')})`);

const src = fs.readFileSync(path.join(HERE, '..', 'sv-congestion.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
for (const name of ['AppState', 'document', 'window', 'localStorage', 'roomRegistry', 'getPathfindingGraph', 'cellCongestionLabel'])
  check(!new RegExp(`\\b${name}\\b`).test(src), `sv-congestion.js does not read ${name}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
