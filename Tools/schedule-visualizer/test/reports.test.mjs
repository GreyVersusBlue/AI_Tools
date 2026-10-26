// Path 11 P5 increment 4: the content of the two printed reports and the
// comparison loader. Pure Node, no browser: sv-check.js's checksReport(),
// sv-congestion.js's congestionReport() and compareProject(). The sheets
// themselves are drawn and previewed in smoke-checks.mjs.
//
// Every room and group is made up: the checks building of check.test.mjs
// (Ms. Okafor on 204 and 118, Mr. Lindqvist on 116, Ms. Dunmore on 104, a
// Library), small hand-made lab metrics, and the Northwind fixture. Every rule
// below was broken on purpose before it was trusted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../sv-model.js';
import * as C from '../sv-check.js';
import * as G from '../sv-graph.js';
import * as K from '../sv-congestion.js';
import { northwind } from './_routes-cases.mjs';

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}
const eq = (a, b, label) => check(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NW = () => JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-northwind.json'), 'utf8'));

/* ── checksReport ─────────────────────────────────────────────────────── */

const settings = (extra) => M.normalizeSettings({ modCount: 4, modLabel: 'mod', defaultGroupSize: 25, ...extra });
const registry = () => [
  { roomNumber: '204', teacherName: 'Ms. Okafor', teacherDept: 'SCI', floorId: 'f2' },
  { roomNumber: '118', teacherName: 'Ms. Okafor', teacherDept: 'SCI', floorId: 'f1' },
  { roomNumber: '116', teacherName: 'Mr. Lindqvist', teacherDept: 'MATH', floorId: 'f1' },
  { roomNumber: '104', teacherName: 'Ms. Dunmore', teacherDept: 'ELA', floorId: 'f1' },
  { roomNumber: 'Library', teacherName: null, teacherDept: null, floorId: 'f1' },
].map(r => ({ excludeFromConflict: false, ...r }));
const groups = () => [
  { id: 'a', name: '7-1', modsA: ['204', '116', '', '104'] },
  { id: 'b', name: '7-2', modsA: ['204', '', '116', ''] },
  { id: 'c', name: '7-3', modsA: ['118', '104', '', ''] },
];
function report(gs, acks) {
  const r = C.checkSchedule(gs, { registry: registry(), settings: settings() });
  C.applyAcks(r.findings, acks || {});
  return C.checksReport(r, { acks: acks || {} });
}
const grid = (rep, day) => rep.grids.find(g => g.day === day);
const rowOf = (rep, day, t) => grid(rep, day).rows.find(r => r.teacher === t);

{
  const rep = report(groups());
  eq(rep.sections.map(s => s.severity), ['error', 'warn', 'note', 'ack'], 'four sections, problems first and accepted last');
  const errors = rep.sections[0].items;
  eq(errors.map(i => i.kind).sort(), ['room-double', 'teacher-double'], 'the problems are the double-booked 204 and Ms. Okafor in two rooms at once');
  eq(errors.find(i => i.kind === 'room-double').text, 'Room 204 has two groups in Mod 1: 7-1 and 7-2. One of them needs another room or another mod.',
    "a finding's text is sentence()'s, word for word");
  eq(rep.counts, { error: 2, warn: 0, note: rep.sections[2].items.length }, 'the counts are the un-accepted findings');
  eq(rep.days, ['A'], 'one day when no group has a B list');
  eq(grid(rep, 'A').rows.map(r => r.teacher), ['Mr. Lindqvist', 'Ms. Dunmore', 'Ms. Okafor'], 'teachers down, by name');
  const ok = rowOf(rep, 'A', 'Ms. Okafor');
  eq(ok.rooms, ['118', '204'], "a teacher's row names every room of theirs");
  eq(ok.cells[0].text, '118 7-3 / 204 7-1, 7-2', 'a cell names each room and its groups');
  eq(ok.cells[0].severity, 'error', 'and is marked with the problem it holds');
  eq(ok.cells[1], { planning: true, text: '—', severity: null }, 'a free mod is planning, unmarked');
  const lq = rowOf(rep, 'A', 'Mr. Lindqvist');
  eq(lq.cells.map(c => c.text), ['—', '116 7-1', '116 7-2', '—'], "Mr. Lindqvist's day, as the groups' slots say");
  eq(lq.cells.map(c => c.severity), [null, null, null, null], 'a clean row is unmarked');
  const dn = rowOf(rep, 'A', 'Ms. Dunmore');
  eq(dn.cells[1].severity, null, "Ms. Dunmore's 7-3 is not marked: the problem is 7-3's other mod");
}

/* An accepted finding moves to Accepted, keeps its note and marks nothing. */
{
  const first = report(groups());
  const id = first.sections[0].items.find(i => i.kind === 'room-double').id;
  const rep = report(groups(), { [id]: { note: 'shared lab, both teachers in it', on: '2026-10-25' } });
  eq(rep.sections[0].items.map(i => i.kind), ['teacher-double'], 'the accepted room-double leaves Problems');
  eq(rep.sections[3].items.map(i => [i.kind, i.note]), [['room-double', 'shared lab, both teachers in it']], 'and is under Accepted with its note');
  eq(rep.counts.error, 1, 'and is not counted');
  eq(rowOf(rep, 'A', 'Ms. Okafor').cells[0].severity, 'error', 'the cell is still marked by the teacher-double');
  const id2 = rep.sections[0].items.find(i => i.kind === 'teacher-double').id;
  const rep2 = report(groups(), { [id]: { note: '', on: '2026-10-25' }, [id2]: { note: '', on: '2026-10-25' } });
  eq(rowOf(rep2, 'A', 'Ms. Okafor').cells[0].severity, null, 'with both accepted the cell is unmarked');
}

/* A finding with no cell of its own (no planning) marks the teacher's whole day. */
{
  const gs = [
    { id: 'a', name: '7-1', modsA: ['116', '116', '', ''] },
    { id: 'b', name: '7-2', modsA: ['', '', '116', '116'] },
  ];
  const rep = report(gs);
  check(rep.sections[1].items.some(i => i.kind === 'teacher-no-planning'), 'Mr. Lindqvist teaching every mod is a warning');
  eq(rowOf(rep, 'A', 'Mr. Lindqvist').cells.map(c => c.severity), ['warn', 'warn', 'warn', 'warn'], 'and marks every cell of his day');
  eq(rowOf(rep, 'A', 'Ms. Dunmore').cells.map(c => c.severity), [null, null, null, null], 'and nobody else\'s');
}

/* Two days give two grids; a warning on B marks only B. */
{
  const gs = [
    { id: 'a', name: '7-1', modsA: ['116', '', '', ''], modsB: ['116', '116', '116', '116'] },
  ];
  const rep = report(gs);
  eq(rep.days, ['A', 'B'], 'two days when a group has a B list');
  eq(rep.grids.map(g => g.day), ['A', 'B'], 'a grid per day');
  eq(rowOf(rep, 'A', 'Mr. Lindqvist').cells.map(c => c.severity), [null, null, null, null], 'A is unmarked');
  eq(rowOf(rep, 'B', 'Mr. Lindqvist').cells.map(c => c.severity), ['warn', 'warn', 'warn', 'warn'], 'B carries the no-planning warning');
  check(rep.sections[1].items.every(i => i.day === 'B'), 'and the warning section says which day');
}

/* ── congestionReport ─────────────────────────────────────────────────── */

/* Hand-made metrics: three groups, three mods, two transitions. */
function metrics() {
  const cell = (x) => ({ floorId: 'f1', x, y: 0 });
  const seg = (fromMod, xs) => ({ fromMod, toMod: fromMod + 1, hallwayCells: xs.map(cell) });
  const perGroup = [
    { id: 'a', name: '7-1', mods: ['204', '116', '104'], segments: [seg(1, [1, 2, 3]), seg(2, [3, 4])] },
    { id: 'b', name: '7-2', mods: ['116', '204', '204'], segments: [seg(1, [2, 3]), { fromMod: 2, toMod: 3, noTravel: true }] },
    { id: 'c', name: '7-3', mods: ['104', '', '116'], segments: [{ fromMod: 1, toMod: 2, error: 'Mod not assigned' }, seg(2, [4, 5])] },
  ];
  const k = (x) => 'f1:' + x + ',0';
  const congPerT = [new Map([[k(1), 24], [k(2), 50], [k(3), 50]]), new Map([[k(3), 24], [k(4), 46], [k(5), 22]])];
  const congAll = new Map([[k(1), 24], [k(2), 50], [k(3), 74], [k(4), 46], [k(5), 22]]);
  return { day: 'A', perGroup, congPerT, congAll, weighted: true, defaultGroupSize: 25 };
}
{
  const r = K.congestionReport(metrics(), {});
  eq(r.cells.map(c => [c.key, c.load]), [['f1:3,0', 74], ['f1:2,0', 50], ['f1:4,0', 46], ['f1:1,0', 24], ['f1:5,0', 22]], 'the whole day, busiest first');
  eq(r.cells[0].groups, ['7-1', '7-2'], 'each place names the groups whose walk crosses it');
  eq(r.cells[0].delta, null, 'no scenario, no delta');
  eq([r.cells[0].x, r.cells[0].y, r.cells[0].floorId], [3, 0, 'f1'], 'with its cell for the page to name');
  eq(r.transitions, [{ t: 1, total: 124, peak: 50 }, { t: 2, total: 92, peak: 46 }], 'the transitions by total load');
  eq(r.changes, [], 'and no changes');
  const t2 = K.congestionReport(metrics(), { tf: 2, top: 2 });
  eq(t2.cells.map(c => c.key), ['f1:4,0', 'f1:3,0'], 'a transition filter ranks that window only, and `top` cuts the list');
  eq(t2.cells[1].groups, ['7-1'], "and names only that window's walkers (7-2 crossed 3,0 in the other)");
  const tie = metrics(); tie.congAll = new Map([['f1:9,0', 5], ['f1:10,0', 5], ['f1:1,0', 5]]);
  eq(K.congestionReport(tie, {}).cells.map(c => c.key), ['f1:1,0', 'f1:10,0', 'f1:9,0'], 'a tie goes by key, so the list never shuffles');
  const d = K.congestionReport(metrics(), { diff: { deltas: new Map([['f1:3,0', -24]]) }, overrides: { b: { 1: '104' }, c: { 2: '' } } });
  eq(d.cells.map(c => c.delta), [-24, 0, 0, 0, 0], "with a scenario, each place carries its delta");
  eq(d.changes, [{ group: '7-2', modIdx: 1, from: '204', to: '104' }, { group: '7-3', modIdx: 2, from: '116', to: '' }], 'and the changes are listed, from the baseline');
  const empty = metrics(); empty.congAll = new Map(); empty.congPerT = [new Map(), new Map()];
  eq([K.congestionReport(empty, {}).cells, K.congestionReport(empty, {}).transitions], [[], []], 'a day with no hallway walking ranks nothing');
}

/* On Northwind, through the lab's own metrics: the loads are the lab's numbers. */
const nw = NW();
const nwSettings = M.normalizeSettings(nw.settings);
const nwBp = northwind();
const nwGraph = G.buildGraph(nwBp);
const nwGroups = nw.groups.map((g, i) => ({ id: 'nw' + i, ...g }));
const nwRegistry = M.roomRegistryOf(nwBp);
{
  const base = K.whatIfMetrics(nwGroups, 'A', null, { settings: nwSettings, blueprint: nwBp, graph: nwGraph, registry: nwRegistry });
  const r = K.congestionReport(base, { floor0Id: nwBp.floors[0].id });
  check(r.cells.length > 0 && r.cells.length <= 10, `Northwind ranks ${r.cells.length} places`);
  check(r.cells.every(c => base.congAll.get(c.key) === c.load), 'every load is the lab\'s whole-day number for that cell');
  check(r.cells.every((c, i) => i === 0 || r.cells[i - 1].load >= c.load), 'busiest first');
  check(r.cells.every(c => c.groups.length > 0), 'every place has a group that crosses it');
  const max = Math.max(...base.congAll.values());
  eq(r.cells[0].load, max, 'the first is the busiest cell the lab knows');
}

/* ── compareProject ───────────────────────────────────────────────────── */

const live = () => ({ groups: nwGroups.map(g => ({ ...g })), registry: nwRegistry });
const file = (edit) => { const p = NW(); if (edit) edit(p); return p; };
{
  const same = K.compareProject(live(), file(), { day: 'A', modCount: 4 });
  eq([same.ok, same.changed, same.matched, same.added, same.removed, same.ambiguous], [true, 0, 4, [], [], []],
    'the same file compares as no change, every group matched by name');
  eq(same.overrides, {}, 'and gives no override');

  const moved = K.compareProject(live(), file(p => { p.groups[0].modsA[1] = '108'; p.groups[2].modsA[3] = ''; }), { day: 'A', modCount: 4 });
  eq(moved.overrides, { nw0: { 1: '108' }, nw2: { 3: '' } }, "two slots changed in the file are two overrides on this schedule's ids");
  eq(moved.changed, 2, 'counted');
  const onB = K.compareProject(live(), file(p => { p.groups[0].modsA[1] = '108'; }), { day: 'B', modCount: 4 });
  check(onB.day === 'B' && !(onB.overrides.nw0 && onB.overrides.nw0[1] === '108') , 'an A-day change is not a B-day override');

  const renamed = K.compareProject(live(), file(p => { p.groups[1].name = '6-2 '; p.groups.push({ name: '8-1', modsA: ['101', '102', '103', '104'] }); p.groups.splice(3, 1); }), { day: 'A', modCount: 4 });
  eq(renamed.added, [{ name: '8-1', mods: ['101', '102', '103', '104'] }], 'a group only in the file is listed with its day, not made an override');
  eq(renamed.removed, ['7-2'], 'a group only here is listed as removed');
  eq(renamed.matched, 3, "a name is trimmed, as the import trims it ('6-2 ' is 6-2)");

  const twice = K.compareProject(live(), file(p => { p.groups.push({ ...p.groups[0], modsA: ['108', '108', '108', '108'] }); }), { day: 'A', modCount: 4 });
  eq(twice.ambiguous, ['6-1'], 'a name on two groups in the file is not compared');
  check(!twice.overrides.nw0, 'and gives no override');

  const other = K.compareProject(live(), file(p => {
    const f = p.blueprint.floors[0];
    f.cells = f.cells.map(c => c.tile.roomNumber === '108' ? { ...c, tile: { ...c.tile, roomNumber: '109' } } : c);
  }), { day: 'A', modCount: 4 });
  eq(other, { ok: false, onlyHere: ['108'], onlyThere: ['109'] }, 'a file with another room set is another building, named room by room');

  let msg = '';
  try { K.compareProject(live(), { fileType: 'something-else', blueprint: {} }, { day: 'A' }); } catch (e) { msg = e.message; }
  eq(msg, 'this JSON is not a full-project file.', "another kind of file is refused with the import's own words");
  msg = '';
  try { K.compareProject(live(), { fileType: 'stviz-project' }, { day: 'A' }); } catch (e) { msg = e.message; }
  eq(msg, 'project file is missing its blueprint.', 'and so is a project with no blueprint');
  msg = '';
  try { K.compareProject(live(), { fileType: 'stviz-project', blueprint: { floors: [{}] } }, { day: 'A' }); } catch (e) { msg = e.message; }
  eq(msg, 'Invalid file: malformed floor entry.', "and a blueprint the import's validator rejects");

  // A pre-floors blueprint (one floor, top-level cells) is read the import's way and left as it came.
  const old = { fileType: 'stviz-project', blueprint: { gridCols: 6, gridRows: 5, staircasePairs: [],
    cells: [{ col: 1, row: 1, tile: { type: 'classroom', roomNumber: '204', teacher: 'Ms. Okafor' } }] },
    groups: [{ name: '7-1', modsA: ['204', '', '', ''] }] };
  const oldBefore = JSON.stringify(old);
  const oldLive = { groups: [{ id: 'x', name: '7-1', modsA: ['', '204', '', ''] }], registry: [{ roomNumber: '204' }] };
  eq(K.compareProject(oldLive, old, { day: 'A', modCount: 4 }).overrides, { x: { 0: '204', 1: '' } }, 'a pre-floors file compares');
  eq(JSON.stringify(old), oldBefore, 'and is not changed by being read');
  const f = file(); f.settings.modCount = 6;
  eq(K.compareProject(live(), f, { day: 'A', modCount: 4 }).modCountThere, 6, 'a file with another mod count says so');
  const untouched = file(); const before = JSON.stringify(untouched);
  K.compareProject(live(), untouched, { day: 'A', modCount: 4 });
  eq(JSON.stringify(untouched), before, 'the file object is not changed');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
