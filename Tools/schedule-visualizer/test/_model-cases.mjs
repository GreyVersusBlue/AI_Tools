// The inputs model.test.mjs runs through sv-model.js. model-golden.json holds
// what 035's own functions returned for each of them at v320, before Path 11
// P2 increment 2 moved them, so the test proves the move changed no answer.
// Every name is made up (Ms. Okafor in 204, Mr. Lindqvist in 116, groups 7-1
// to 7-4); the Northwind project is Tools/schedule/test's invented school.
//
// Each case is { name, run(m) } where m is the model's surface under the
// module's names; the page's old functions were adapted to the same surface
// to write the golden file. A case returns plain JSON (Maps are not used).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, '../../schedule/test/fixture-northwind.json'), 'utf8'));

const clone = (x) => JSON.parse(JSON.stringify(x));
const tryIt = (f) => { try { const v = f(); return { ok: v === undefined ? null : v }; } catch (e) { return { error: e.message }; } };

/** A one-floor, pre-Round-31 blueprint save (top-level cells, no floors key). */
const PRE_FLOORS = {
  version: 3, gridCols: 6, gridRows: 5,
  cells: [
    { col: 0, row: 0, tile: { type: 'classroom', roomNumber: '204', teacher: 'Ms. Okafor', dept: 'ELA' } },
    { col: 1, row: 0, tile: { type: 'hallway' } },
    { col: 2, row: 0, tile: { type: 'classroom', roomNumber: '116', teacher: 'Mr. Lindqvist', groupId: 'g1' } },
    { col: 3, row: 0, tile: { type: 'classroom', groupId: 'g1' } },
    { col: 1, row: 1, tile: { type: 'staircase' } },
    { col: 1, row: 3, tile: { type: 'staircase' } },
    { col: 9, row: 9, tile: { type: 'hallway' } },
  ],
  staircasePairs: [['1,1', '1,3']],
  heatExcludeZones: [{ id: 'hz_4', col: 0, row: 0, cols: 2, rows: 2, label: 'Gym' }],
};

const GROUPS = [
  { id: 'a', name: '7-1', color: '#3b82f6', modsA: ['204', '116', '', 'B-12'], modsB: ['116', '204', '204', 'B-12'], size: 22 },
  { id: 'b', name: '7-2', color: '#ef4444', modsA: ['204', '116', 'LIB', 'B-12'], modsB: [], size: '' },
  { id: 'c', name: '7-3', color: '#10b981', mods: ['204', '301', 'LIB', ''], size: '18' },
  { id: 'd', name: '7-4', color: '#f59e0b', modsA: ['301', '116', 'LIB'], modsB: ['116', '204'], size: 0 },
];
const REGISTRY = [
  { roomNumber: '204', excludeFromConflict: false },
  { roomNumber: 'LIB', excludeFromConflict: true },
  { roomNumber: 'B-12', excludeFromConflict: false },
];
/** 035's GROUP_COLOR_PRESETS, which the page hands in. */
const PRESETS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1','#84cc16','#a855f7'];

export const CASES = [
  { name: 'modLabel, four styles, 1..13', run: (m) => ['mod', 'period', 'block', 'hour', undefined].map(st => Array.from({ length: 13 }, (_, i) => m.modLabel(i + 1, st))) },
  { name: 'modLabels', run: (m) => [m.modLabels({ modCount: 4, modLabel: 'block' }), m.modLabels({ modCount: 0, modLabel: 'mod' }), m.modLabels(NW().settings)] },
  { name: 'normalizeSettings', run: (m) => [
    {}, { defaultGroupSize: '30' }, { defaultGroupSize: 0 }, { defaultGroupSize: 1000 }, { defaultGroupSize: 999 },
    { bellSchedule: { A: [{ start: '8:00', end: '8:42' }, null, { start: '25:00', end: '9:30' }, { start: 'x' }, 'no'], B: 'nope' } },
    { subjects: [] }, { subjects: [{ code: ' art ', name: '  ', color: 'red' }, { code: 'PE', color: '#AABBCC' }] },
    { subjects: [{ code: 'ok' }, { code: '' }] }, NW().settings,
  ].map(s => m.normalizeSettings(clone(s))).concat([m.normalizeSettings(null) === null, m.normalizeSettings('x')]) },
  { name: 'groupWeight', run: (m) => [{ defaultGroupSize: 25 }, { defaultGroupSize: 30 }, {}, { defaultGroupSize: 0 }].map(s =>
    [{ size: 20 }, { size: '' }, { size: '12' }, { size: 0 }, { size: -3 }, { size: 'x' }, { size: 7.6 }, {}, null].map(g => m.groupWeight(g, s))) },
  { name: 'anyGroupSized', run: (m) => [m.anyGroupSized([]), m.anyGroupSized([{ size: '' }, { size: 0 }]), m.anyGroupSized([{}, { size: '3' }]), m.anyGroupSized([{ size: null }, { size: 2 }])] },
  { name: 'congestionDelayMult', run: (m) => [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, -1, NaN].map(n => m.congestionDelayMult(n)) },
  { name: 'formatClockTime', run: (m) => ['08:05', '13:40', '00:00', '12:30', '8:5', '7:15', 'x', null, 805].map(t => m.formatClockTime(t)) },
  { name: 'bellDay, formatModTime, formatTransitionWindow', run: (m) => {
    const s1 = NW().settings;
    const s2 = { bellSchedule: { A: [{ start: '8:00', end: '8:42' }, { start: '8:46', end: null }, { start: '9:40', end: '10:20' }], B: null } };
    const s3 = { bellSchedule: { A: null, B: [{ start: '9:00', end: '9:50' }, { start: '9:55', end: '10:40' }] } };
    return [s1, s2, s3, {}].map(s => ({
      A: m.bellDay(s, 'A'), B: m.bellDay(s, 'B'),
      times: ['A', 'B'].map(d => [0, 1, 2, 3, 9].map(i => m.formatModTime(s, d, i))),
      windows: ['A', 'B'].map(d => [1, 2, 3, 4].map(i => m.formatTransitionWindow(s, d, i))),
    }));
  } },
  { name: 'migrateBlueprint', run: (m) => {
    const v5 = NW().blueprint;
    const noPairs = clone(v5); delete noPairs.crossFloorPairs; delete noPairs.activeFloorIdx;
    return [m.migrateBlueprint(clone(PRE_FLOORS)), m.migrateBlueprint(clone(v5)), m.migrateBlueprint(noPairs),
      m.migrateBlueprint({ gridCols: 8, gridRows: 6 })];
  } },
  { name: 'validateBlueprint', run: (m) => [
    null, 'x', {}, { gridCols: 4, gridRows: 10 }, { gridCols: 10, gridRows: 201 }, { gridCols: 10, gridRows: 10 },
    { gridCols: 10, gridRows: 10, cells: [] }, { gridCols: 10, gridRows: 10, cells: [{ col: 0 }], staircasePairs: [] },
    { gridCols: 10, gridRows: 10, cells: [], staircasePairs: [] }, clone(PRE_FLOORS),
    { floors: [{}] }, { floors: [{ gridCols: 5, gridRows: 5 }] }, { floors: [{ gridCols: 5, gridRows: 5, cells: [] }] }, NW().blueprint,
  ].map(d => tryIt(() => m.validateBlueprint(d))) },
  { name: 'floorsFromData, roomRegistryOf, serializeBlueprint round trip', run: (m) => {
    const out = [];
    for (const raw of [NW().blueprint, clone(PRE_FLOORS)]) {
      const data = m.migrateBlueprint(raw);
      const floors = m.floorsFromData(data);
      const bp = { floors, crossFloorPairs: clone(data.crossFloorPairs), activeFloorIdx: data.activeFloorIdx, gridCols: 30, gridRows: 20 };
      const settings = m.normalizeSettings({ schoolName: 'Test', gridSize: 40, gridCols: 30, gridRows: 20, ...(raw.settings || {}) });
      const saved = m.serializeBlueprint(bp, settings, { savedAt: '2026-01-02T03:04:05.000Z' });
      const portable = m.serializeBlueprint(bp, settings, { portable: true, savedAt: 'P', traceImage: (t) => (t ? { ...t, dataUrl: 'data:x' } : null) });
      out.push({ floors, registry: m.roomRegistryOf(bp), saved, portable, same: m.deriveSameFloorPairs(bp.crossFloorPairs, floors[0].id) });
    }
    return out;
  } },
  { name: 'isGroupAnchorOn, pairLabel, initFloorGridData', run: (m) => {
    const g = [[null, { type: 'classroom', groupId: 'g' }], [{ type: 'classroom', groupId: 'g' }, { type: 'hallway', groupId: 'g' }]];
    const f = { gridCols: 3, gridRows: 2 }; m.initFloorGridData(f);
    return [m.isGroupAnchorOn(g, 2, 2, 1, 0, 'g'), m.isGroupAnchorOn(g, 2, 2, 0, 1, 'g'), m.isGroupAnchorOn(g, 2, 2, 1, 1, ''),
      [0, 1, 25, 26, 51].map(i => m.pairLabel(i)), f];
  } },
  { name: 'scheduleConflicts', run: (m) => ['A', 'B', undefined].map(day =>
    m.scheduleConflicts(clone(GROUPS), day, { registry: REGISTRY, labels: ['Mod 1', 'Mod 2', 'Mod 3'] })).concat([
    m.scheduleConflicts([], 'A', { registry: [], labels: [] })]) },
  { name: 'nextGroupColor', run: (m) => [m.nextGroupColor([], PRESETS), m.nextGroupColor(clone(GROUPS).slice(0, 2), PRESETS),
    m.nextGroupColor(clone(GROUPS), PRESETS), m.nextGroupColor(clone(GROUPS).concat(clone(GROUPS)), PRESETS),
    m.nextGroupColor(PRESETS.map(color => ({ color })), PRESETS), m.nextGroupColor(PRESETS.concat(PRESETS).map(color => ({ color })), PRESETS)] },
  { name: 'groupRecord', run: (m) => clone(GROUPS).concat(NW().groups, [{ name: 'x', size: 7.5 }, { name: 'y', size: '-2' }]).map(g => m.groupRecord(g)) },
];
