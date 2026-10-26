// Path 11 P2 increment 3: sv-graph.js gives every answer 035's own Round 7,
// 8 and 31 functions gave before the move, and its cache behaves as the
// page's dirty flag did. Pure Node, no browser.
//
// graph-golden.json was written by running _graph-cases.mjs through the v320
// page's pathfinding section (read out of the page, with AppState and the
// cached graph set per call); this runs the same cases through the module and
// compares the JSON. The cases cover a dummy tile as a wall, a room reached
// only through its doorway, a grouped room reached through a non-anchor cell,
// two floors joined by a pair and a pair naming a hallway (skipped), a
// same-floor pair shorter than the walk (the admissibility case), a third
// classroom on the straight line (never cut through), a walled-off room and
// two disconnected corridors, and Northwind. The golden file is not
// regenerated from the module: a change that is meant edits it by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../sv-graph.js';
import { CASES, BLUEPRINTS } from './_graph-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(HERE, 'graph-golden.json'), 'utf8'));

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

for (const c of CASES) {
  const got = JSON.stringify(c.run(G));
  const want = JSON.stringify(golden[c.name]);
  let where = '';
  if (got !== want) {
    let i = 0; while (i < got.length && got[i] === want[i]) i++;
    where = `\n         first difference at character ${i}: got …${got.slice(Math.max(0, i - 60), i + 40)}…\n         want …${(want || '').slice(Math.max(0, i - 60), i + 40)}…`;
  }
  check(got === want, `${c.name} matches v320` + where);
}
check(Object.keys(golden).length === CASES.length, `every golden case is run (${Object.keys(golden).length} in the file, ${CASES.length} cases)`);

// The shortcut: through the pair is 4 cells; walking the corridor is 15.
const sc = G.buildGraph(BLUEPRINTS.shortcut);
const r = G.resolveRoomPath(sc, '204', '116', BLUEPRINTS.shortcut.crossFloorPairs);
check(r.pathLength === 4 && r.staircasePairsUsed.join() === 'A', 'the teleport-aware heuristic finds the 4-cell route through the pair');
const walled = G.buildGraph({ ...BLUEPRINTS.shortcut, crossFloorPairs: [] });
check(G.resolveRoomPath(walled, '204', '116', []).error === 'No valid path between rooms',
  'without the pair the only corridor runs through room 999, and a room is never a corridor');

// The cache: the same graph until invalidate(), a new one after, and rebuild() always.
const bp = JSON.parse(JSON.stringify(BLUEPRINTS.cross));
const cache = G.createCache();
const g1 = cache.get(bp);
check(cache.get(bp) === g1, 'the cache returns the same graph until it is invalidated');
bp.floors[0].gridData[2][2] = { type: 'hallway' };
check(cache.get(bp) === g1 && !g1.types.has('f1:2,2'), 'a grid change is not seen before invalidate() (the page calls it on every mutation)');
cache.invalidate();
const g2 = cache.get(bp);
check(g2 !== g1 && g2.types.get('f1:2,2') === 'hallway', 'after invalidate() the next get() rebuilds from the blueprint');
check(cache.rebuild(bp) !== g2, 'rebuild() always builds a fresh graph');
check(G.createCache().get(bp) !== cache.get(bp), 'two caches share nothing');

// The module must not reach for page state.
const src = fs.readFileSync(path.join(HERE, '..', 'sv-graph.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
for (const name of ['AppState', 'document', 'window', 'localStorage', 'pathfindingGraph', '_blueprintDirty'])
  check(!new RegExp(`\\b${name}\\b`).test(src), `sv-graph.js does not read ${name}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
