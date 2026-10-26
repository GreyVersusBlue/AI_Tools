// The inputs playback.test.mjs runs through sv-playback.js. playback-golden.json
// holds what 035's own drawPlaybackFrame and its helpers drew and returned for
// each of them at v321, before Path 11 P2 increment 6 moved them. Drawing is
// recorded by rec(), a fake 2D context that logs every method call and every
// property it is given, numbers rounded to 1e-6; the page's floorOffsetY and
// offsetPolyline are replaced by the simple stand-ins below on both sides,
// so the case holds the renderer and not those two (they stay on the page).
// A frame's log is kept as its length and a hash (the helpers' logs are kept
// whole), which keeps the golden file small. Segments come from sv-routes.js's groupDayPath (held by routes.test.mjs).
// Every room and group is made up; the Northwind project is
// Tools/schedule/test's invented school.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { building, northwind } from './_routes-cases.mjs';
import { floor } from './_graph-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-northwind.json'), 'utf8'));
const r6 = (v) => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v;

/** A fake CanvasRenderingContext2D: `log` holds every call and property set. */
export function rec() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => k === 'log' ? log : (k in t ? t[k] : (...args) => { log.push([k, ...args.map(r6)]); }),
    set: (t, k, v) => { log.push(['=' + String(k), r6(v)]); t[k] = v; return true; },
  });
  return ctx;
}

/** Stand-ins for the page's floorOffsetY and offsetPolyline. */
export const floorOffsetY = (floorId) => ({ f1: 0, f2: 260, floor_0: 0, floor_1: 520 })[floorId] || 0;
export const offsetPolyline = (poly, entry, laneSpace, cx, cy, floorId) =>
  poly.map((p, i) => ({ x: cx(p.x) + laneSpace * ((entry.laneIndex || 0) - 1), y: cy(p.y) + (i % 2 ? 0.5 : -0.5), floorId }));

const GROUPS = () => [
  { id: 'g1', name: '7-1', color: '#2563eb', modsA: ['204', '116', '301', '301'], modsB: ['301', '', '204', '116'], size: 22 },
  { id: 'g2', name: '7-2', color: '#16a34a', modsA: ['116', '204', '204', '116'], modsB: [], size: '' },
  { id: 'g3', name: '7-3', mods: ['301', '204', '116', ''], size: '18' },
  { id: 'g4', name: '7-4', color: '#9333ea', modsA: ['204', '116', '301', '204'], modsB: ['116', '204', '301', '116'] },
];

function dataFor(m, groups, day, settings, bp, maxConcurrency) {
  const g = m.buildGraph(bp);
  const entries = groups.map((gr, i) => ({ name: gr.name, color: gr.color, group: gr, laneIndex: i,
    rawSegments: m.groupDayPath(gr, day, { graph: g, settings, pairs: bp.crossFloorPairs }) || [] }));
  return { entries, stats: { maxConcurrency } };
}

/** One frame: what was drawn, what the travel panel was told, and what pb gained. */
function frame(m, data, pb, viewOver = {}) {
  const ctx = rec(); const travel = [];
  const view = { cellSize: 40, zoom: 1, constantWidth: false, settings: { tileWalkTime: 3, staircaseTime: 8 },
    baseStroke: 4.5, baseLane: 5.0, floorOffsetY, offsetPolyline, reducedMotion: () => false, now: () => 1790000000450,
    onTravel: (active, segFor, coll, step, progress, cyc) => travel.push([active.map(e => e.name), active.map(e => segFor(e).fromMod),
      coll && [...coll].map(([e, sim]) => [e.name, sim]), step, r6(progress), cyc]),
    ...viewOver };
  m.drawPlaybackFrame(ctx, data, pb, view);
  const sha = crypto.createHash('sha256').update(JSON.stringify(ctx.log)).digest('hex').slice(0, 16);
  return { draw: `${ctx.log.length} calls, ${sha}`, travel, liveHeads: pb._liveHeads ? [...pb._liveHeads] : null, cycle: pb._r50CycleMs };
}
const PB = (over = {}) => ({ currentStep: 0, progress: 0.4, mode: 'simultaneous', animStyle: 'trail', cometScale: 1.5, realtimeCycle: false, ...over });

export const CASES = [
  { name: 'simultaneous', run: (m) => {
    const bp = building(); const s = { modCount: 4, modLabel: 'period', defaultGroupSize: 25 };
    const out = [];
    for (const day of ['A', 'B'])
      for (const step of [0, 1, 2])
        for (const progress of [0, 0.07, 0.35, 0.8, 1])
          out.push(frame(m, dataFor(m, GROUPS(), day, s, bp, 3), PB({ currentStep: step, progress })));
    return out;
  } },
  { name: 'comet and views', run: (m) => {
    const bp = building(); const s = { modCount: 4, modLabel: 'period', defaultGroupSize: 25 };
    const out = [];
    for (const [pbo, vo, conc] of [
      [{ animStyle: 'comet' }, {}, 1], [{ animStyle: 'comet', cometScale: 3 }, { cellSize: 24, zoom: 2, constantWidth: true }, 4],
      [{ animStyle: 'comet', cometScale: 0 }, { reducedMotion: () => true }, 2], [{ realtimeCycle: true, progress: 0.95 }, { settings: { tileWalkTime: null, staircaseTime: 2 } }, 6],
      [{ progress: 0.2 }, { settings: { tileWalkTime: 7, staircaseTime: undefined } }, 0]])
      out.push(frame(m, dataFor(m, GROUPS(), 'A', s, bp, conc), PB(pbo), vo));
    return out;
  } },
  { name: 'sequential', run: (m) => {
    const bp = building(); const s = { modCount: 4, modLabel: 'period', defaultGroupSize: 25 };
    const out = [];
    for (const progress of [0, 0.1, 0.26, 0.3, 0.55, 0.74, 0.99])
      for (const [anim, rm] of [['trail', false], ['comet', false], ['comet', true]])
        out.push(frame(m, dataFor(m, GROUPS(), 'A', s, bp, 2), PB({ mode: 'sequential', progress, animStyle: anim, currentStep: 1 }), { reducedMotion: () => rm }));
    return out;
  } },
  { name: 'northwind', run: (m) => {
    const p = NW(); const bp = northwind(); const out = [];
    const groups = p.groups.map((x, i) => ({ id: 'nw' + i, ...x }));
    for (const day of ['A', 'B'])
      for (const step of [0, 1, 2])
        for (const [mode, anim] of [['simultaneous', 'trail'], ['simultaneous', 'comet'], ['sequential', 'comet']])
          out.push(frame(m, dataFor(m, groups, day, p.settings, bp, 2), PB({ currentStep: step, progress: 0.45, mode, animStyle: anim })));
    return out;
  } },
  { name: 'crossing', run: (m) => {
    // A plus-shaped junction: A west to east, B north to south, C east to
    // west. B reaches the middle square while A holds it, so it waits there
    // and the trail view draws its waiting pulse (a clock-driven radius).
    const bp = { floors: [floor('f1', ['..N..', '..H..', 'WHHHE', '..H..', '..T..'])], crossFloorPairs: [] };
    const groups = [{ id: 'a', name: 'A', color: '#111111', modsA: ['W', 'E'] }, { id: 'b', name: 'B', modsA: ['N', 'T'] }, { id: 'c', name: 'C', modsA: ['E', 'W'] }];
    const s = { modCount: 2 }; const out = [];
    for (const progress of [0.1, 0.25, 0.3, 0.4, 0.6])
      for (const [anim, now] of [['trail', () => 1790000000450], ['trail', () => 1790000000000], ['comet', () => 1790000000450]])
        out.push(frame(m, dataFor(m, groups, 'A', s, bp, 2), PB({ progress, animStyle: anim }), { now }));
    return out;
  } },
  { name: 'nothing to draw', run: (m) => [
    frame(m, null, PB()), frame(m, { entries: [] }, PB()),
    frame(m, { entries: [{ name: 'x', group: { id: 'x', name: 'x' }, rawSegments: [{ fromMod: 1, path: [{ x: 0, y: 0 }] }] }], stats: {} }, PB()),
  ] },
  { name: 'helpers', run: (m) => {
    const legs = m.buildTeleportLegs([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 300 }, { x: 80, y: 300 }], [40, 0, 40], [false, true, false]);
    const prefix = [0, 40, 40, 80];
    const dwell = [-0.5, 0, 0.2, 0.35, 0.4, 0.5, 0.7, 1, 1.5].flatMap(t => [
      m.mapSequentialDwell(t, 80, legs, prefix, 26.67), m.mapSequentialDwell(t, 80, [], prefix, 26.67),
      m.mapSequentialDwell(t, 80, legs, prefix, 0), m.mapSequentialDwell(t, 0, legs, prefix, 10)]);
    const draws = [];
    for (const rm of [false, true]) for (const f of [-1, 0, 0.3, 1, 2]) { const c = rec(); m.drawPortalDwellArc(c, legs[0], f, 6, '#123456', 0.5, rm); draws.push(c.log); }
    for (const d of [-30, -19.2, -10, -0.01, 0, 0.01, 4, 9.6, 12, 19.2, 30]) { const c = rec(); m.drawPortalPulse(c, legs[0], 40, 40 + d, 6, '#654321', 1); draws.push(c.log); }
    for (const b of [0.2, 3]) { const c = rec(); m.drawPortalPulse(c, legs[0], 40, 41, b, '#000', 0.7); draws.push(c.log); }
    return JSON.parse(JSON.stringify({ legs, dwell, draws }, (k, v) => r6(v)));
  } },
  { name: 'collision simulation', run: (m) => {
    // Head-on, following, crossing and turning traffic through a plus-shaped junction.
    const H = (pts, f = 'f') => pts.map(([x, y]) => ({ x, y, floorId: f }));
    const mk = (id, cells) => ({ name: id, group: { id }, seg: { hallwayCells: H(cells) } });
    const sets = [
      [mk('b', [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]), mk('a', [[4, 2], [3, 2], [2, 2], [1, 2], [0, 2]])],
      [mk('a', [[0, 2], [1, 2], [2, 2], [3, 2]]), mk('b', [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]), mk('c', [[1, 2], [2, 2]])],
      [mk('a', [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]), mk('b', [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]])],
      [mk('a', [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]]), mk('b', [[2, 0], [2, 1], [2, 2], [3, 2]]), mk('c', [[2, 4], [2, 3], [2, 2], [1, 2]])],
      [mk('a', [[0, 0], [0, 0], [1, 0]]), { name: 'z', group: { name: 'z' }, seg: { hallwayCells: [] } }, { name: 'n', group: { id: 'n' }, seg: null },
        { name: 'f', group: { id: 'f' }, seg: { hallwayCells: [{ x: 0, y: 0, floorId: 'f' }, { x: 0, y: 0, floorId: 'g' }, { x: 1, y: 0, floorId: 'g' }] } }],
    ];
    return sets.flatMap(set => [[3, 8], [1.5, 0]].map(([w, st]) =>
      [...m.buildCollisionSimulation(set, e => e.seg, w, st)].map(([e, sim]) => [e.name, sim])));
  } },
];
