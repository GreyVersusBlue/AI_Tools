// Path 11 P5 increment 3: the suggestions, sv-suggest.js. Pure Node, no
// browser; the Fix… list and "Try in What-If" are smoke-checks.mjs's.
//
// The invented building of check.test.mjs (Ms. Okafor on 204 and 118,
// Mr. Lindqvist on 116, Ms. Dunmore on 104, a Library with no teacher, groups
// 7-1 to 7-4, 8 blocks) plus Mr. Abara on 210 in Ms. Okafor's department, and
// the invented Northwind school for everything that needs a real graph. Each
// rule was broken on purpose in the module before it was trusted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../sv-model.js';
import * as C from '../sv-check.js';
import * as S from '../sv-suggest.js';
import { whatIfMetrics } from '../sv-congestion.js';
import { buildGraph, resolveRoomPath } from '../sv-graph.js';
import { northwind } from './_routes-cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}
const eq = (a, b, label) => check(a === b, label + (a === b ? '' : ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

const LABELS = Array.from({ length: 8 }, (_, i) => 'Block ' + (i + 1));
function settings(extra) {
  return M.normalizeSettings({ modCount: 8, modLabel: 'mod', defaultGroupSize: 25, ...extra });
}
function registry(drop) {
  return [
    { roomNumber: '204', teacherName: 'Ms. Okafor', teacherDept: 'SCI' },
    { roomNumber: '118', teacherName: 'Ms. Okafor', teacherDept: 'SCI' },
    { roomNumber: '210', teacherName: 'Mr. Abara', teacherDept: 'SCI' },
    { roomNumber: '116', teacherName: 'Mr. Lindqvist', teacherDept: 'MATH' },
    { roomNumber: '104', teacherName: 'Ms. Dunmore', teacherDept: 'ELA' },
    { roomNumber: 'Library', teacherName: null, teacherDept: null },
  ].filter(r => !(drop || []).includes(r.roomNumber)).map(r => ({ excludeFromConflict: false, floorId: 'f1', ...r }));
}
function groups() {
  return [
    { id: 'a', name: '7-1', size: 24, modsA: ['204', '204', '', '', '104', 'Library', '', ''] },
    { id: 'b', name: '7-2', size: 26, modsA: ['116', '116', '204', '', '', '104', 'Library', ''] },
    { id: 'c', name: '7-3', size: 22, modsA: ['104', '', '', '204', '', '', '104', 'Library'] },
    { id: 'd', name: '7-4', size: 27, modsA: ['', '104', '104', '', '116', '116', '', '210'] },
  ];
}
const set = (gs, name, i, room, day = 'A') => gs.map(g => {
  if (g.name !== name) return g;
  const key = day === 'B' ? 'modsB' : 'modsA';
  const list = (g[key] || []).slice();
  while (list.length < 8) list.push('');
  list[i] = room;
  return { ...g, [key]: list };
});
const findingOf = (gs, kind, opts = {}) => C.checkSchedule(gs, { registry: opts.registry || registry(), settings: opts.settings || settings() })
  .findings.find(f => f.kind === kind);
const ctx = (gs, extra) => ({ groups: gs, registry: registry(), settings: settings(), ...(extra || {}) });
const say = (c, gs, extra) => S.suggestionSentence(c, { labels: LABELS, groups: gs, oneDay: true, ...(extra || {}) });

/** P11-15, held on every candidate: no teacher gains or loses a group's class to another teacher. */
function changesNoTeacher(res, reg) {
  const teacher = (rn) => { const r = reg.find(x => x.roomNumber === rn); return (r && r.teacherName) || ''; };
  return res.candidates.every(c => {
    if (c.move === 'M3' || c.changesTeacher) return false;
    if (new Set(c.changes.map(x => x.modIdx)).size !== c.changes.length) return false;
    if (c.move === 'M1') {
      const [a, b] = c.changes;
      return c.changes.length === 2 && a.from === b.to && b.from === a.to;
    }
    return c.changes.length === 1 && (!teacher(c.changes[0].to) || teacher(c.changes[0].to) === teacher(c.changes[0].from));
  });
}

/* ── A double-booked room ─────────────────────────────────────────────── */
{
  const gs = set(groups(), '7-3', 1, '204');            // 7-1 and 7-3 both in 204 in Block 2
  const f = findingOf(gs, 'room-double');
  eq(f && f.id, 'room-double|A|2|g:7-1+g:7-3+r:204', 'the built schedule has the double booking');
  const res = S.suggestFor(f, ctx(gs, { max: 50 }));
  check(res.candidates.length > 0, 'suggestions exist for it: ' + res.candidates.length);
  check(res.candidates.every(c => c.fixes.includes(f.id)), 'every candidate clears the finding it was asked about');
  eq(res.candidates[0].after.error, 0, 'the first leaves no problem behind');
  check(res.candidates.filter(c => c.after.error).every(c => c.brokeFindings.some(x => x.severity === 'error')),
    'one that leaves a problem made it, and lists it in breaks');
  check(changesNoTeacher(res, registry()), 'none gives a group to another teacher (P11-15)');
  check(res.candidates.every(c => c.changes.every(x => x.from !== x.to)), 'no candidate changes a slot to what it was');
  eq(res.stoppedBy, 'all', 'with max 50 every survivor is measured');
  eq(res.tried, 16, 'the moves tried: 7-1 and 7-3 each swap Block 2 with six blocks of another room, and each can go to 118 or the Library');
  // Among equals, the reorder comes before the room move.
  const firstM1 = res.candidates.findIndex(c => c.move === 'M1');
  const firstM2 = res.candidates.findIndex(c => c.move === 'M2');
  const key = (c) => [c.after.error, c.after.warn, c.after.note].join();
  const tie = res.candidates.filter(c => c.move === 'M2').find(c2 => res.candidates.some(c1 => c1.move === 'M1' && key(c1) === key(c2)));
  check(firstM1 >= 0 && firstM2 >= 0, 'both a swap (M1) and a room move (M2) are offered');
  check(!tie || res.candidates.indexOf(res.candidates.find(c => c.move === 'M1' && key(c) === key(tie))) < res.candidates.indexOf(tie),
    'a swap comes before a room move that leaves the same counts');
  check(res.candidates.some(c => c.move === 'M2' && c.changes[0].to === '118' && c.toTeacher === 'Ms. Okafor'),
    "the teacher's other room, 118, is offered");
  check(res.candidates.some(c => c.move === 'M2' && c.changes[0].to === 'Library' && c.toTeacher === null),
    'the Library, which has no teacher, is offered');
  check(!res.candidates.some(c => c.changes.some(x => x.to === '210' || x.to === '116')), "no other teacher's room is offered");
  // The counts are sorted, fewest problems first, and the order is stable.
  const counts = res.candidates.map(c => c.after.error * 1e6 + c.after.warn * 1e3 + c.after.note);
  check(counts.every((n, i) => i === 0 || counts[i - 1] <= n), 'candidates are ordered by the problems, warnings and notes left');
  eq(JSON.stringify(S.suggestFor(f, ctx(gs, { max: 50 }))), JSON.stringify(res), 'the same question gives the same answer (nothing is random)');
  // max holds and says so.
  const two = S.suggestFor(f, ctx(gs, { max: 2 }));
  eq(two.candidates.length, 2, 'max 2 gives two');
  eq(two.stoppedBy, 'max', 'and says it stopped at max');
  eq(two.found, res.candidates.length, 'and how many it found');
  eq(S.suggestionHeadline(two), '2 of the ' + two.found + ' changes that would clear this, fewest problems left first.', 'the headline for a cut list');
  // M3 only when asked.
  check(!res.candidates.some(c => c.move === 'M3'), 'M3 is off unless asked for');
  const m3 = S.suggestFor(f, ctx(gs, { max: 50, kinds: ['M1', 'M2', 'M3'] }));
  const m3c = m3.candidates.filter(c => c.move === 'M3');
  check(m3c.length > 0 && m3c.every(c => c.changesTeacher && c.changesTeacher.to === 'Mr. Abara' && c.changesTeacher.from === 'Ms. Okafor'),
    'asked for, M3 offers Mr. Abara\'s 210 (same department) and says whose class it changes');
  check(!m3c.some(c => c.changes[0].to === '116' || c.changes[0].to === '104'), 'and never a room of another department');
  // The sentences, held to their text.
  const swap = res.candidates.find(c => c.move === 'M1' && c.groupId === 'c' && c.changes[0].modIdx === 1 && c.changes[1].modIdx === 2);
  eq(swap && say(swap, gs), "Swap 7-3's Block 2 (204) and Block 3 (nothing): same rooms, same teachers, another order. It adds 1 problem: Room 204 has two groups in Block 3: 7-2 and 7-3. One of them needs another room or another block.",
    'the sentence for a swap');
  const other = res.candidates.find(c => c.move === 'M2' && c.groupId === 'c' && c.changes[0].to === '118');
  eq(other && say(other, gs), "Move 7-3 from 204 to Room 118 in Block 2, Ms. Okafor's other room. It adds 1 problem: Ms. Okafor is in 118 with 7-3 and in 204 with 7-1 in Block 2. A teacher can only be in one room at a time.",
    "the sentence for the teacher's other room");
  const lib = res.candidates.find(c => c.move === 'M2' && c.groupId === 'c' && c.changes[0].to === 'Library');
  eq(lib && say(lib, gs), 'Move 7-3 from 204 to Library in Block 2, a room with no teacher named, so Ms. Okafor would not have 7-3 then. It adds no problem or warning.',
    'the sentence for a room with no teacher');
  const abara = m3c.find(c => c.groupId === 'c');
  eq(abara && say(abara, gs), 'Move 7-3 from 204 to Room 210 in Block 2, and Mr. Abara would teach 7-3 then, not Ms. Okafor. It adds no problem or warning.',
    'the sentence for M3');
  eq(say(swap, gs, { oneDay: false }).includes(' on A days:'), true, 'the day is named when the schedule has two');
}

/* ── A candidate that clears one finding and makes another ───────────── */
{
  const s2 = settings({ modCount: 2 });
  const reg = registry();
  const gs = [
    { id: 'p', name: '8-1', modsA: ['204', '204'] },
    { id: 'q', name: '8-2', modsA: ['204', '116'] },
  ];
  const f = C.checkSchedule(gs, { registry: reg, settings: s2 }).findings.find(x => x.kind === 'room-double');
  const res = S.suggestFor(f, { groups: gs, registry: reg, settings: s2, kinds: ['M1'] });
  eq(res.candidates.length, 1, "8-2's one swap is the only M1 (8-1's two slots are the same room)");
  const c = res.candidates[0];
  check(c.fixes.includes(f.id), 'it clears the Block 1 double booking');
  eq(c.breaks.join(), 'room-double|A|2|g:8-1+g:8-2+r:204', 'and lists the Block 2 one it makes');
  eq(c.after.error, 1, 'so a problem is still left');
  eq(S.suggestionSentence(c, { labels: ['Block 1', 'Block 2'], groups: gs, oneDay: true }),
    "Swap 8-2's Block 1 (204) and Block 2 (116): same rooms, same teachers, another order. " +
    'It adds 1 problem: Room 204 has two groups in Block 2: 8-1 and 8-2. One of them needs another room or another block.',
    'and the sentence says what it adds');
}

/* ── A finding no change to a group's day can clear ──────────────────── */
{
  const s5 = settings({ modCount: 5, checks: { maxRun: 4 } });
  const reg = registry(['Library']);   // no teacherless room to move to
  const gs = [{ id: 'r', name: '6-1', modsA: ['204', '204', '204', '204', '204'] }];
  const f = C.checkSchedule(gs, { registry: reg, settings: s5 }).findings.find(x => x.kind === 'teacher-run');
  check(!!f, 'Ms. Okafor teaches five blocks in a row');
  const res = S.suggestFor(f, { groups: gs, registry: reg, settings: s5 });
  eq(res.candidates.length, 0, 'nothing clears it: her other room keeps her teaching');
  check(res.tried > 0, 'though moves were tried: ' + res.tried);
  eq(S.suggestionHeadline(res), "No change to one group's day clears this (" + res.tried + ' tried). The tool does not offer a move that gives a group to another teacher.',
    'and the headline says so');
  const rooms = C.checkSchedule(set(groups(), '7-1', 2, '118'), { registry: registry(), settings: settings() })
    .findings.find(x => x.kind === 'teacher-rooms');
  const none = S.suggestFor(rooms, ctx(groups()));
  eq(none.stoppedBy, 'none', 'a fact about the tiles (teacher-rooms) is not a slot: stoppedBy none');
  eq(S.suggestionHeadline(none), "This is not about one group's slot, so no change to a group's day can clear it.", 'and its headline');
  eq(S.suggestFor(null, ctx(groups())).stoppedBy, 'none', 'no finding at all is none too, not a throw');
}

/* ── No planning: the teacher's taught cells are the ones tried ─────────── */
{
  const s3 = settings({ modCount: 3 });
  const gs = [{ id: 'n', name: '6-2', modsA: ['116', '116', '116'] }];
  const f = C.checkSchedule(gs, { registry: registry(), settings: s3 }).findings.find(x => x.kind === 'teacher-no-planning');
  eq(f && f.where.length, 0, 'teacher-no-planning names no cell of its own');
  const res = S.suggestFor(f, { groups: gs, registry: registry(), settings: s3 });
  check(res.candidates.length === 3 && res.candidates.every(c => c.changes[0].to === 'Library'),
    "it is cleared by moving one of Mr. Lindqvist's blocks to the Library, one candidate per block");
}

/* ── A B day read as the A day ─────────────────────────────────────────── */
{
  const gs = groups().map(g => g.id === 'a' ? { ...g, modsB: ['116', '', '', '', '', '', '', ''] } : g);
  // 7-2 has no B list, so its B day is its A day: 116 in Block 1, beside 7-1's B day.
  const f = C.checkSchedule(gs, { registry: registry(), settings: settings() }).findings
    .find(x => x.kind === 'room-double' && x.day === 'B');
  eq(f && f.id, 'room-double|B|1|g:7-1+g:7-2+r:116', 'a B-day double booking with a group that has no B list');
  const res = S.suggestFor(f, ctx(gs, { max: 50 }));
  const c = res.candidates.find(x => x.groupId === 'b' && x.move === 'M2');
  eq(c && c.changes[0].from, '116', "7-2's B slot is read from its A list");
  check(res.candidates.every(x => x.day === 'B'), 'every candidate is for the B day');
}

/* ── Northwind, with a graph: stage 2, the path cache, the clock ─────────── */
{
  const p = JSON.parse(fs.readFileSync(path.join(HERE, 'fixture-northwind.json'), 'utf8'));
  const bp = northwind();
  const reg = M.roomRegistryOf(bp);
  const graph = buildGraph(bp);
  const s = M.normalizeSettings(p.settings);
  const gs = p.groups.map((x, i) => ({ id: 'nw' + i, ...x }))
    .map(x => x.name === '6-1' ? { ...x, modsA: ['106', ...x.modsA.slice(1)] } : x);
  const f = C.checkSchedule(gs, { registry: reg, settings: s }).findings.find(x => x.kind === 'room-double');
  eq(f && f.id, 'room-double|A|1|g:6-1+g:7-1+r:106', 'Northwind with 6-1 typed into 106 in Block A');
  let calls = 0;
  const counting = (a, b) => { calls++; return resolveRoomPath(graph, a, b, bp.crossFloorPairs); };
  const cache = new Map();
  const opts = { groups: gs, registry: reg, settings: s, graph, blueprint: bp, pathCache: cache, resolve: counting };
  const t0 = performance.now();
  const res = S.suggestFor(f, opts);
  const ms = performance.now() - t0;
  check(res.candidates.length > 0 && res.candidates.every(c => c.travel), 'stage 2 measured every candidate it kept');
  check(res.candidates.every(c => Number.isFinite(c.groupTravelDeltaSec) && Number.isFinite(c.travelDeltaSec)), 'each has its travel deltas');
  eq(calls, cache.size, 'every room pair went to the pathfinder once');
  check(calls > 0, 'and some did: ' + calls);
  const again = calls;
  const res2 = S.suggestFor(f, opts);
  eq(calls, again, 'the second run is answered from the cache, with no pathfinder call');
  eq(JSON.stringify(res2), JSON.stringify(res), 'and gives the same answer');
  check(changesNoTeacher(res, reg), 'no Northwind candidate gives a group to another teacher (P11-15)');
  const sum = (c) => c.after.error * 1e6 + c.after.warn * 1e3 + c.after.note;
  check(res.candidates.every((c, i) => i === 0 || sum(res.candidates[i - 1]) <= sum(c)), 'stage 2 keeps them ordered by what is left');
  console.log('  info Northwind suggestion in ' + ms.toFixed(1) + ' ms, ' + res.tried + ' tried, ' + calls + ' paths');
  // The clock: stage 2 stops at its 500 ms.
  let t = 0;
  const slow = S.suggestFor(f, { ...opts, pathCache: new Map(), now: () => (t += 400) });
  eq(slow.stoppedBy, 'time', 'a stage 2 past 500 ms stops and says so');
  check(slow.candidates.length < res.candidates.length, 'with fewer candidates measured');
  check(S.suggestionHeadline(slow).endsWith('The search stopped early, so there may be others.') || slow.candidates.length === 0,
    'and the headline says there may be others');
  // whatIfMetrics through a resolver gives what it gives without one.
  const plain = whatIfMetrics(gs, 'A', null, { settings: s, blueprint: bp, graph, registry: reg });
  const viaCache = whatIfMetrics(gs, 'A', null, { settings: s, blueprint: bp, graph, registry: reg,
    resolve: S.cachedResolver(graph, bp.crossFloorPairs, new Map()) });
  eq(JSON.stringify(viaCache), JSON.stringify(plain), "whatIfMetrics's resolve hook changes no number");
  // Without a graph the candidates are stage 1's.
  const flat = S.suggestFor(f, { groups: gs, registry: reg, settings: s });
  check(flat.candidates.length > 0 && flat.candidates.every(c => c.travel === false && !('groupTravelDeltaSec' in c)),
    'without a graph, stage 1 answers and says travel was not measured');
}

/* ── Nothing is changed ────────────────────────────────────────────────── */
{
  const gs = set(groups(), '7-3', 1, '204');
  const before = JSON.stringify(gs);
  S.suggestFor(findingOf(gs, 'room-double'), ctx(gs, { max: 50, kinds: ['M1', 'M2', 'M3'] }));
  eq(JSON.stringify(gs), before, 'suggestFor changes no group it was given');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
