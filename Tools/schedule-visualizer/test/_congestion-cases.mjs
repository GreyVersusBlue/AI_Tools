// The inputs congestion.test.mjs runs through sv-congestion.js.
// congestion-golden.json holds what 035's own functions (buildCongestionData,
// computeTravelTimes, wiBaseMods, wiEffectiveMods, wiComputeMetrics and
// wiComputeDiff) returned for each of them at v321, before Path 11 P2
// increment 5 moved them. Every room and group is made up; the Northwind
// project is Tools/schedule/test's invented school. Segments come from
// sv-routes.js's groupDayPath and graphs from sv-graph.js's buildGraph (both
// held to v320 by their own suites), so m carries those beside the surface.
// Maps and Sets are written as [key, value] lists by ser(), and a segment's
// path and hallwayCells (graph.test.mjs and routes.test.mjs hold those) as
// their length and a hash, which keeps the golden file small.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { building, northwind } from './_routes-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, '../../schedule/test/fixture-northwind.json'), 'utf8'));

const digest = (a) => `${a.length} cells, ${crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex').slice(0, 12)}`;
const tag = (x) => Object.prototype.toString.call(x);
/** JSON with Maps and Sets made into lists, in insertion order. The tag, not
 *  instanceof, so a Map made in another realm (the golden writer's vm) counts. */
export const ser = (v) => JSON.parse(JSON.stringify(v, (k, x) =>
  tag(x) === '[object Map]' ? { map: [...x] } : tag(x) === '[object Set]' ? { set: [...x] }
    : (k === 'path' || k === 'hallwayCells') && Array.isArray(x) ? digest(x) : x));

/** The hotspot namer congestionData is handed; the page's reads the registry. */
export const cellLabel = (x, y, floorId) => ({ label: `cell ${x},${y}`, sub: floorId ? `on ${floorId}` : 'no floor' });

const GROUPS = () => [
  { id: 'g1', name: '7-1', grade: 7, color: '#2563eb', modsA: ['204', '116', '301', '301'], modsB: ['301', '', '204', '116'], size: 22 },
  { id: 'g2', name: '7-2', grade: 7, color: '#16a34a', modsA: ['204', '301', 'NOPE', '116'], modsB: [], size: '' },
  { id: 'g3', name: '7-3', grade: 7, mods: ['116', '204', '204', ''], size: '18' },
  { id: 'g4', name: '7-4', grade: 7, color: '#9333ea', modsA: ['301', '204'], modsB: ['116', '204', '301', '116'], size: 0 },
  { id: 'g5', name: '7-10', grade: 7, color: '#dc2626', modsA: [' 204 ', '116', '116', '301'], size: 40 },
];
const SETTINGS = (over = {}) => ({ modCount: 4, modLabel: 'period', defaultGroupSize: 25, ...over });

/** Visualize-tab entries as buildVizRenderData makes them: one per group, the
 *  raw segments cached; the first carries no group object (looked up by name). */
function entries(m, groups, day, settings, bp, g) {
  return groups.map((gr, i) => ({ name: gr.name, color: gr.color, ...(i ? { group: gr } : {}),
    rawSegments: m.groupDayPath(gr, day, { graph: g, settings, pairs: bp.crossFloorPairs }) || [] }));
}
function nwProject() {
  const p = NW();
  return { bp: northwind(), settings: p.settings, groups: p.groups.map((x, i) => ({ id: 'nw' + i, ...x })) };
}

export const CASES = [
  { name: 'congestionData', run: (m) => {
    const out = [];
    const bp = building(); const g = m.buildGraph(bp);
    for (const s of [SETTINGS(), SETTINGS({ defaultGroupSize: 30 }), SETTINGS({ defaultGroupSize: 0 })])
      for (const d of ['A', 'B'])
        for (const tf of [null, 1, 2, 3, 9]) {
          const groups = GROUPS();
          out.push(m.congestionData(entries(m, groups, d, s, bp, g), tf, { settings: s, groups, blueprint: bp, cellLabel }));
        }
    const blank = GROUPS().map(x => ({ ...x, size: '' }));
    out.push(m.congestionData(entries(m, blank, 'A', SETTINGS(), bp, g), null, { settings: SETTINGS(), groups: blank, blueprint: bp, cellLabel }));
    out.push(m.congestionData([], null, { settings: SETTINGS(), groups: [], blueprint: bp, cellLabel }));
    // Equal loads at (5,1) and (1,2): hotspots order ties by row, then column.
    const tie = [{ name: 'x', group: { size: 5 }, rawSegments: [{ fromMod: 1, hallwayCells:
      [{ x: 5, y: 1, floorId: 'f1' }, { x: 1, y: 2, floorId: 'f2' }, { x: 5, y: 1, floorId: 'f1' }, { x: 3, y: 0 }] }] }];
    out.push(m.congestionData(tie, null, { settings: SETTINGS(), groups: [], blueprint: bp, cellLabel }));
    const nw = nwProject(); const ng = m.buildGraph(nw.bp);
    for (const d of ['A', 'B'])
      out.push(m.congestionData(entries(m, nw.groups, d, nw.settings, nw.bp, ng), null, { settings: nw.settings, groups: nw.groups, blueprint: nw.bp, cellLabel }));
    return ser(out);
  } },
  { name: 'travelTimes', run: (m) => {
    const out = [];
    const bp = building(); const g = m.buildGraph(bp);
    for (const s of [SETTINGS(), SETTINGS({ tileWalkTime: 5, staircaseTime: 0, defaultGroupSize: 20 }),
      SETTINGS({ tileWalkTime: null, staircaseTime: undefined, modCount: 3 }), SETTINGS({ modCount: 6 })])
      for (const d of ['A', 'B']) {
        const groups = GROUPS();
        const data = { entries: entries(m, groups, d, s, bp, g) };
        m.travelTimes(data, { settings: s, groups });
        out.push(data);
      }
    out.push(m.travelTimes(null, { settings: SETTINGS(), groups: [] }), m.travelTimes({ entries: [] }, { settings: SETTINGS(), groups: [] }));
    const nw = nwProject(); const ng = m.buildGraph(nw.bp);
    for (const d of ['A', 'B']) {
      const data = { entries: entries(m, nw.groups, d, nw.settings, nw.bp, ng) };
      m.travelTimes(data, { settings: nw.settings, groups: nw.groups });
      out.push(data);
    }
    return ser(out);
  } },
  { name: 'baseMods', run: (m) => {
    const ov = { g1: { 1: '116', 3: '', 9: '301' }, g3: { 0: ' 301 ', '-1': 'x' }, g4: { 2: null } };
    return GROUPS().flatMap(gr => ['A', 'B', undefined].flatMap(d => [2, 4, 6].map(n =>
      [m.baseMods(gr, d, n), m.effectiveMods(gr, d, ov, n), m.effectiveMods(gr, d, null, n)])));
  } },
  { name: 'whatIfMetrics', run: (m) => {
    const out = [];
    const bp = building(); const g = m.buildGraph(bp);
    const registry = [{ roomNumber: '204', excludeFromConflict: false }, { roomNumber: '116', excludeFromConflict: true }];
    const ovs = [null, {}, { g1: { 1: '204', 2: '116' }, g2: { 2: '116' } }, { g4: { 0: '', 1: '' }, nope: { 0: '204' } }];
    for (const s of [SETTINGS(), SETTINGS({ defaultGroupSize: 30, tileWalkTime: 4 }), SETTINGS({ modCount: 3, modLabel: 'block' })])
      for (const d of ['A', 'B'])
        for (const ov of (s.defaultGroupSize === 25 && s.modCount === 4 ? ovs : ovs.slice(2, 3)))
          out.push(m.whatIfMetrics(GROUPS(), d, ov, { settings: s, blueprint: bp, graph: g, registry }));
    out.push(m.whatIfMetrics([], 'A', null, { settings: SETTINGS(), blueprint: bp, graph: g, registry: [] }));
    const nw = nwProject(); const ng = m.buildGraph(nw.bp);
    for (const d of ['A', 'B'])
      out.push(m.whatIfMetrics(nw.groups, d, { nw0: { 1: '101' } }, { settings: nw.settings, blueprint: nw.bp, graph: ng, registry: [] }));
    return ser(out);
  } },
  { name: 'whatIfDiff', run: (m) => {
    const out = [];
    const bp = building(); const g = m.buildGraph(bp);
    const registry = [{ roomNumber: '301', excludeFromConflict: false }];
    const ovs = [{}, { g1: { 1: '204', 2: '116' }, g2: { 2: '116' } }, { g4: { 0: '204', 1: '116' }, g3: {} }];
    for (const d of ['A', 'B'])
      for (const ov of ovs)
        for (const tf of [null, 1, 4])
          out.push(m.whatIfDiff(GROUPS(), d, ov, tf, { settings: SETTINGS(), blueprint: bp, graph: g, registry }));
    // base and scen are whatIfMetrics answers, held by the case above: a hash here.
    return ser(out).map(r => ({ ...r, base: digest([r.base]), scen: digest([r.scen]) }));
  } },
];
