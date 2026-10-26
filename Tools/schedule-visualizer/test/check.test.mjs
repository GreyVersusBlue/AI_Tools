// Path 11 P5 increment 1: the schedule checks, sv-check.js. Pure Node, no
// browser; the banner, the cards and the bulk editor's cells are
// smoke-checks.mjs's.
//
// One invented building: Ms. Okafor on 204 and 118, Mr. Lindqvist on 116,
// Ms. Dunmore on 104, a Library with no teacher, groups 7-1 to 7-4, 8 mods and
// a bell with 4-minute passing. Each kind is seen present and then absent by
// one slot's change (or present by one), and every sentence is held to its
// exact text. Every rule was broken on purpose before it was trusted.
import * as M from '../sv-model.js';
import * as C from '../sv-check.js';

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

const LABELS = Array.from({ length: 8 }, (_, i) => 'Block ' + (i + 1));
function bell() {
  // 8:00 start, 50-minute blocks, 4 minutes between.
  const out = [];
  let t = 8 * 60;
  const hm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  for (let i = 0; i < 8; i++) { out.push({ start: hm(t), end: hm(t + 50) }); t += 54; }
  return out;
}
function settings(extra) {
  return M.normalizeSettings({ modCount: 8, modLabel: 'mod', defaultGroupSize: 25, bellSchedule: { A: bell(), B: null }, ...extra });
}
function registry(extra) {
  const rooms = [
    { roomNumber: '204', teacherName: 'Ms. Okafor', teacherDept: 'SCI', floorId: 'f2' },
    { roomNumber: '118', teacherName: 'Ms. Okafor', teacherDept: 'SCI', floorId: 'f1' },
    { roomNumber: '116', teacherName: 'Mr. Lindqvist', teacherDept: 'MATH', floorId: 'f1' },
    { roomNumber: '104', teacherName: 'Ms. Dunmore', teacherDept: 'ELA', floorId: 'f1' },
    { roomNumber: 'Library', teacherName: null, teacherDept: null, floorId: 'f1' },
  ];
  return rooms.map(r => ({ excludeFromConflict: false, ...r, ...((extra && extra[r.roomNumber]) || {}) }));
}
// A clean A day: every teacher teaches some blocks and has planning.
function groups() {
  return [
    { id: 'a', name: '7-1', size: 24, modsA: ['204', '204', '', '', '104', 'Library', '', ''] },
    { id: 'b', name: '7-2', size: 26, modsA: ['116', '116', '204', '', '', '104', 'Library', ''] },
    { id: 'c', name: '7-3', size: 22, modsA: ['104', '', '', '204', '', '', '104', 'Library'] },
    { id: 'd', name: '7-4', size: 27, modsA: ['', '104', '104', '', '116', '116', '', '204'] },
  ];
}
function run(gs, opts) {
  return C.checkSchedule(gs, { ...(opts || {}), registry: registry(opts && opts.rooms), settings: settings(opts && opts.settings) });
}
const kinds = (r, kind) => r.findings.filter(f => f.kind === kind);
const say = (f) => C.sentence(f, { labels: LABELS });

/* The clean schedule: the base every case changes by one slot. */
{
  const r = run(groups());
  const notesOnly = r.findings.every(f => f.severity === 'note');
  check(notesOnly, 'the base schedule has no error and no warning');
  check(r.days.join() === 'A', 'no group has a B day, so the days are A only');
  check(r.dropped.length === 0, 'nothing dropped from a clean schedule');
}

/* room-double; and an excluded room is never one. */
{
  const gs = groups(); gs[2].modsA[1] = '204';           // 7-3 joins 7-1 in 204, Block 2
  const r = run(gs);
  const f = kinds(r, 'room-double');
  check(f.length === 1 && f[0].severity === 'error' && f[0].mod === 2 && f[0].room === '204', 'room-double: two groups in 204 in Block 2');
  check(say(f[0]) === 'Room 204 has two groups in Block 2: 7-1 and 7-3. One of them needs another room or another block.', 'room-double sentence');
  check(f[0].where.map(w => w.groupId + w.modIdx).join() === 'a1,c1', 'room-double points at both cells');
  check(kinds(run(groups()), 'room-double').length === 0, 'room-double absent without the slot');
  const ex = run(gs, { rooms: { 204: { excludeFromConflict: true } } });
  check(kinds(ex, 'room-double').length === 0, 'an excluded room is never a room-double');
  const cap = run(gs, { rooms: { 204: { excludeFromConflict: true, capacity: 40 } } });
  const oc = kinds(cap, 'over-capacity');
  check(oc.length === 1 && oc[0].n === 46 && oc[0].limit === 40, 'an excluded room still gets over-capacity when the sizes sum past it');
  check(say(oc[0]) === 'Room 204 holds 46 in Block 2 (7-1 with 24 and 7-3 with 22) and seats 40.', 'over-capacity sentence, shared');
}

/* teacher-double: Ms. Okafor in 204 and 118 at once. */
{
  const gs = groups(); gs[3].modsA[0] = '118';            // 7-4 in 118 while 7-1 is in 204, Block 1
  const r = run(gs);
  const f = kinds(r, 'teacher-double');
  check(f.length === 1 && f[0].severity === 'error' && f[0].teacher === 'Ms. Okafor' && f[0].mod === 1, 'teacher-double: Ms. Okafor in two rooms in Block 1');
  check(say(f[0]) === 'Ms. Okafor is in 118 with 7-4 and in 204 with 7-1 in Block 1. A teacher can only be in one room at a time.', 'teacher-double sentence');
  check(kinds(run(groups()), 'teacher-double').length === 0, 'teacher-double absent without the slot');
}

/* over-capacity, one group. */
{
  const r = run(groups(), { rooms: { 116: { capacity: 26 } } });
  const f = kinds(r, 'over-capacity');
  check(f.length === 2 && f.every(x => x.groups[0].name === '7-4'), 'over-capacity: 7-4 (27) in 116, which seats 26, twice');
  check(say(f[0]) === '7-4 (27) is in 116, which seats 26, in Block 5.', 'over-capacity sentence, one group');
  check(kinds(run(groups(), { rooms: { 116: { capacity: 27 } } }), 'over-capacity').length === 0, 'over-capacity absent at exactly the seats');
  const gs = groups(); gs[3].size = null;
  check(kinds(run(gs, { rooms: { 116: { capacity: 26 } } }), 'over-capacity').length === 0, 'a blank size weighs defaultGroupSize (25)');
  gs[3].size = 0;
  check(kinds(run(gs, { rooms: { 116: { capacity: 24 } } }), 'over-capacity').filter(x => x.groups[0].name === '7-4').length === 2, 'a size of 0 is blank and weighs the default');
}

/* teacher-no-planning. */
{
  const gs = groups();
  gs.push({ id: 'e', name: '8-1', size: 20, modsA: ['', '', '116', '116', '', '', '116', '116'] });   // 116 busy every block
  const r = run(gs, { settings: { checks: { maxRun: 20 } } });
  const f = kinds(r, 'teacher-no-planning');
  check(f.length === 1 && f[0].teacher === 'Mr. Lindqvist' && f[0].severity === 'warn', 'teacher-no-planning: Mr. Lindqvist teaches every block');
  check(say(f[0]) === 'Mr. Lindqvist has no planning block.', 'teacher-no-planning sentence (one day: no day named)');
  gs[4].modsA[7] = '';
  check(kinds(run(gs, { settings: { checks: { maxRun: 20 } } }), 'teacher-no-planning').length === 0, 'teacher-no-planning absent with one free block');
}

/* teacher-run: once per run, first and last block, at maxRun 4 and 2. */
{
  const gs = groups();
  gs.push({ id: 'e', name: '8-1', size: 20, modsA: ['', '', '116', '116', '', '', '', ''] });
  gs[3].modsA[5] = '';                                    // 116: Blocks 1 to 5
  const r = run(gs);
  const f = kinds(r, 'teacher-run');
  check(f.length === 1 && f[0].teacher === 'Mr. Lindqvist' && f[0].mods.join() === '1,5' && f[0].n === 5, 'teacher-run: five in a row, Blocks 1 to 5, one finding');
  check(say(f[0]) === 'Mr. Lindqvist teaches five blocks in a row, Blocks 1 to 5.', 'teacher-run sentence');
  gs[3].modsA[4] = '';
  check(!kinds(run(gs), 'teacher-run').some(x => x.teacher === 'Mr. Lindqvist'), 'teacher-run absent at four in a row (maxRun 4)');
  const two = kinds(run(gs, { settings: { checks: { maxRun: 2 } } }), 'teacher-run');
  check(two.filter(x => x.teacher === 'Mr. Lindqvist').length === 1 && two.find(x => x.teacher === 'Mr. Lindqvist').mods.join() === '1,4', 'at maxRun 2 the four-run is one finding, Blocks 1 to 4');
}

/* teacher-moves: a teacher on one room never moves; with no bell it is worded so; with a bell it is silent when the walk fits. */
{
  const gs = [{ id: 'a', name: '7-1', modsA: ['204', '', '', '', '', '', '', ''] },
              { id: 'b', name: '7-2', modsA: ['', '118', '', '', '', '', '', ''] }];
  const noBell = run(gs, { settings: { bellSchedule: { A: null, B: null } } });
  const f = kinds(noBell, 'teacher-moves');
  check(f.length === 1 && f[0].severity === 'warn' && f[0].window === undefined, 'teacher-moves with no bell: still a finding');
  check(say(f[0]) === 'Ms. Okafor moves from 204 to 118 between Blocks 1 and 2, and no bell times are set.', 'teacher-moves sentence, no bell');
  const fits = run(gs, { walk: () => 150 });
  check(kinds(fits, 'teacher-moves').length === 0, 'teacher-moves with a bell is silent when the walk fits');
  check(kinds(run(gs, { walk: () => 240 }), 'teacher-moves').length === 0, 'a walk of exactly the passing time fits (240 of 240)');
  const over = kinds(run(gs, { walk: () => 300 }), 'teacher-moves');
  check(over.length === 1 && say(over[0]) === 'Ms. Okafor moves from 204 to 118 between Blocks 1 and 2: a 5-minute walk in a 4-minute passing time.', 'teacher-moves sentence, too far');
  const mg = kinds(run(gs, { walk: () => 200, settings: { checks: { passingMarginSec: 60 } } }), 'teacher-moves');
  check(mg.length === 1, 'passingMarginSec takes time off the window');
  check(say(mg[0]) === 'Ms. Okafor moves from 204 to 118 between Blocks 1 and 2: a walk of 3 minutes 20 seconds in a 4-minute passing time, less 1 minute of margin.', 'and the sentence says so');
  const one = [{ id: 'a', name: '7-1', modsA: ['116', '', '', '', '', '', '', ''] }, { id: 'b', name: '7-2', modsA: ['', '116', '', '', '', '', '', ''] }];
  check(kinds(run(one, { settings: { bellSchedule: { A: null, B: null } } }), 'teacher-moves').length === 0, 'a teacher on one room never gets teacher-moves');
  check(kinds(run(gs), 'teacher-moves').length === 0, 'with a bell and no walk handed in, teacher-moves says nothing');
  const flat = bell().map((e, i, all) => ({ start: e.start, end: all[i + 1] ? all[i + 1].start : e.end }));
  const z = kinds(run(gs, { settings: { bellSchedule: { A: flat, B: null } }, walk: () => 30 }), 'teacher-moves');
  check(z.length === 1 && z[0].window === undefined && C.passingSec(settings({ bellSchedule: { A: flat, B: null } }), 'A', 0) === null,
    'back-to-back bell times are no passing time set, not a 0-minute one');
}

/* passing-too-short, from the lab's numbers. */
{
  const gs = groups();
  const travel = { A: { perGroup: [{ id: 'a', segments: [
    { fromMod: 5, toMod: 6, fromRoom: '104', toRoom: 'Library', travelSec: 250, delaySec: 60 },
    { fromMod: 6, toMod: 7, fromRoom: 'Library', toRoom: '', error: 'Mod not assigned' },
  ] }] } };
  const r = run(gs, { travel });
  const f = kinds(r, 'passing-too-short');
  check(f.length === 1 && f[0].sec === 310, 'passing-too-short: 310 s of walking in 240');
  check(say(f[0]) === '7-1 has 5 minutes 10 seconds of walking between Blocks 5 and 6 (104 to Library, with the crowd) in a 4-minute passing time.', 'passing-too-short sentence');
  travel.A.perGroup[0].segments[0].delaySec = 0; travel.A.perGroup[0].segments[0].travelSec = 240;
  check(kinds(run(gs, { travel }), 'passing-too-short').length === 0, 'passing-too-short absent when the walk fits');
  check(kinds(run(gs), 'passing-too-short').length === 0, 'no travel handed in, no passing-too-short');
}

/* room-unknown and group-gap, from one walk. */
{
  const gs = groups(); gs[2].modsA[5] = 'Rm 207';
  const r = run(gs);
  const u = kinds(r, 'room-unknown');
  check(u.length === 1 && u[0].room === 'Rm 207' && u[0].mod === 6, 'room-unknown: Rm 207 in Block 6');
  check(say(u[0]) === "7-3 is in 'Rm 207' in Block 6, and the blueprint has no room 'Rm 207'.", 'room-unknown sentence');
  check(kinds(run(groups()), 'room-unknown').length === 0, 'room-unknown absent without the slot');
  const g = kinds(run(groups()), 'group-gap');
  check(g.some(x => x.groups[0].name === '7-2' && x.mod === 4), 'group-gap: 7-2 has nothing in Block 4');
  const gs2 = groups(); gs2[1].modsA[3] = '118';
  check(!kinds(run(gs2), 'group-gap').some(x => x.groups[0].name === '7-2' && x.mod === 4), 'group-gap absent once the slot is filled');
  check(say(g.find(x => x.groups[0].name === '7-2' && x.mod === 4)) === '7-2 has nothing in Block 4.', 'group-gap sentence');
}

/* teacher-rooms, teacher-idle, room-idle, room-no-dept, room-no-teacher. */
{
  const r = run(groups());
  const tr = kinds(r, 'teacher-rooms');
  check(tr.length === 1 && say(tr[0]) === 'Ms. Okafor is written on two rooms, 118 and 204.', 'teacher-rooms: Ms. Okafor on two rooms, sentence');
  check(kinds(C.checkSchedule(groups(), { registry: registry().filter(x => x.roomNumber !== '118'), settings: settings() }), 'teacher-rooms').length === 0, 'teacher-rooms absent with one room');
  const gs = groups(); for (const g of gs) g.modsA = g.modsA.map(x => x === '104' ? '' : x);
  const ti = kinds(run(gs), 'teacher-idle');
  check(ti.length === 1 && say(ti[0]) === "Ms. Dunmore's room 104 has no group.", 'teacher-idle: Ms. Dunmore, sentence');
  check(kinds(run(groups()), 'teacher-idle').length === 0, 'teacher-idle absent with one group in 104');
  check(!kinds(run(gs), 'room-idle').some(x => x.room === '104'), 'an idle teacher\'s room is teacher-idle, not room-idle too');
  const ri = kinds(run(groups()), 'room-idle');
  check(ri.length === 1 && ri[0].room === '118' && say(ri[0]) === 'Room 118 has no group.', 'room-idle: a teacher\'s second room unused, sentence');
  const gs3 = groups(); gs3[0].modsA[6] = '118';
  check(kinds(run(gs3), 'room-idle').length === 0, 'room-idle absent once 118 holds a group');
  const nd = kinds(run(groups(), { rooms: { 116: { teacherDept: null } } }), 'room-no-dept');
  check(nd.length === 1 && say(nd[0]) === 'Room 116 (Mr. Lindqvist) has no department, so the published browser colours it as ELA.', 'room-no-dept: 116, sentence');
  check(kinds(run(groups()), 'room-no-dept').length === 0, 'room-no-dept absent with a department, and never on a room with no teacher');
  const nt = kinds(run(groups()), 'room-no-teacher');
  check(nt.length === 1 && say(nt[0]) === 'Library has groups in Blocks 6, 7 and 8 and no teacher named.', 'room-no-teacher: the Library, sentence');
  check(kinds(run(groups(), { rooms: { Library: { teacherName: 'Mx. Reyes', teacherDept: 'ELA' } } }), 'room-no-teacher').length === 0, 'room-no-teacher absent with a teacher named');
}

/* Names are matched exactly: trimmed, case kept. This is the rule; changing it is a decision. */
{
  const reg = registry().map(r => r.roomNumber === '118' ? { ...r, teacherName: 'ms. okafor' } : r);
  const r = C.checkSchedule(groups(), { registry: reg, settings: settings() });
  check(kinds(r, 'teacher-rooms').length === 0, 'a case-different name is a second teacher');
  const reg2 = registry().map(r => r.roomNumber === '118' ? { ...r, teacherName: '  Ms. Okafor ' } : r);
  check(kinds(C.checkSchedule(groups(), { registry: reg2, settings: settings() }), 'teacher-rooms').length === 1, 'a name is trimmed before it is matched');
  const reg3 = registry().map(r => r.roomNumber === '118' ? { ...r, teacherName: 'Ms Okafor' } : r);
  check(kinds(C.checkSchedule(groups(), { registry: reg3, settings: settings() }), 'teacher-rooms').length === 0, 'names differing by a dot are two teachers (Devon, P11-19)');
}

/* Two days: a group with no B list is where its A list says on B; the day is named. */
{
  const gs = groups(); gs[0].modsB = ['104', '', '', '', '', '', '', ''];
  const r = run(gs);
  check(r.days.join() === 'A,B', 'one group with a B day makes both days');
  const dbl = kinds(r, 'room-double').filter(f => f.day === 'B');
  check(dbl.length === 1 && dbl[0].room === '104' && dbl[0].mod === 1, 'on B, 7-3 (no B list) is in 104 as on A, with 7-1');
  check(say(dbl[0]) === 'Room 104 has two groups in Block 1 on B days: 7-1 and 7-3. One of them needs another room or another block.', 'the day is named when two exist');
  check(C.conflictsOf(r.findings, 'B', LABELS).length === 1, 'conflictsOf(B) has it');
}

/* dropped: never thrown. */
{
  const gs = groups();
  gs.push({ id: 'x', name: '  ', modsA: ['204'] });
  gs[1].size = 'many';
  gs[2].modsA[9] = '204';
  gs[3].modsA[0] = 7;
  const r = run(gs, { rooms: { 204: { capacity: 0 } } });
  const paths = r.dropped.map(d => d.path).join(' ');
  check(/groups\[4\]/.test(paths), 'a nameless group is dropped');
  check(/groups\[1\]\.size/.test(paths), 'a string size is dropped and read as blank');
  check(/groups\[2\]\.modsA\[9\]/.test(paths), 'a slot past modCount is dropped');
  check(/groups\[3\]\.modsA\[0\]/.test(paths), 'a slot that is not text is dropped');
  check(/registry\.204\.capacity/.test(paths), 'a capacity of 0 is dropped');
  const twice = C.checkSchedule(groups(), { registry: [...registry(), { roomNumber: '204', teacherName: 'Mr. X', floorId: 'f9' }], settings: settings() });
  check(twice.dropped.some(d => /f2 and f9/.test(d.reason)), 'a room number on two rooms is dropped with both floors named');
  check(C.checkSchedule(null, {}).findings.length === 0, 'no groups, no registry: nothing thrown');
}

/* settings.checks.off quiets a kind. */
{
  const r = run(groups(), { settings: { checks: { off: ['group-gap', 'nonsense'] } } });
  check(kinds(r, 'group-gap').length === 0 && C.normalizeChecks({ off: ['group-gap', 'nonsense'] }).off.join() === 'group-gap', 'off quiets a kind; an unknown kind is dropped');
  const n = C.normalizeChecks({ maxRun: 'x', passingMarginSec: -5 });
  check(n.maxRun === 4 && n.passingMarginSec === 0, 'bad limits read as the defaults (maxRun 4, margin 0)');
}

/* Fingerprints and acks. */
{
  const gs = groups(); gs[2].modsA[1] = '204';
  const a = kinds(run(gs), 'room-double')[0];
  const gs2 = gs.map((g, i) => ({ ...g, id: 'new' + i }));
  const b = kinds(run(gs2), 'room-double')[0];
  check(a.id === b.id, 'a fingerprint does not move when the group ids do');
  const gs3 = gs.map(g => g.name === '7-3' ? { ...g, name: '7-3b' } : g);
  check(kinds(run(gs3), 'room-double')[0].id !== a.id, 'a fingerprint changes when a name does');
  const r = run(gs);
  C.applyAcks(r.findings, { [a.id]: { note: 'shared', on: '2026-10-25' } });
  check(r.findings.find(f => f.id === a.id).ack === true && C.summary(r.findings).error === 0, 'an accepted finding is marked and not counted');
  const acks = { [a.id]: { note: '', on: '2026-10-01' }, 'old|x': { note: '', on: '2026-09-24' }, 'fresh|x': { note: '', on: '2026-09-26' } };
  const kept = C.pruneAcks(acks, r.findings, '2026-10-26');
  check(kept[a.id] && !kept['old|x'] && kept['fresh|x'], 'an ack that matches is kept; one that does not is kept 30 days from on, then dropped');
  const store = C.readChecksStore({ v: 1, acks: { ok: { note: 'n', on: '2026-10-25' }, bad: { on: 'yesterday' } } });
  check(store.acks.ok && !store.acks.bad && C.readChecksStore({ v: 2 }).acks && Object.keys(C.readChecksStore('x').acks).length === 0, 'readChecksStore keeps only well-formed acks');
}

/* The sort is total: no two findings tie. */
{
  const gs = groups(); gs[2].modsA[1] = '204'; gs[3].modsA[0] = '118'; gs[0].modsB = ['104', '104', '', '', '', '', '', ''];
  const r = run(gs, { rooms: { 116: { capacity: 2, teacherDept: null } } });
  let ties = 0, order = true;
  for (let i = 1; i < r.findings.length; i++) {
    const c = C.compareFindings(r.findings[i - 1], r.findings[i]);
    if (c === 0) ties++;
    if (c > 0) order = false;
  }
  check(ties === 0 && order, 'findings are in order and no two tie (' + r.findings.length + ' findings)');
  const shuffled = r.findings.slice().reverse().sort(C.compareFindings);
  check(shuffled.map(f => f.id).join() === r.findings.map(f => f.id).join(), 'sorting a reversed list gives the same order');
  check(r.findings[0].severity === 'error' && r.findings[r.findings.length - 1].severity === 'note', 'errors first, notes last');
}

/* No sentence carries an HTML entity. */
{
  const gs = groups(); gs[2].modsA[1] = '204'; gs[3].modsA[0] = '118'; gs[2].modsA[5] = 'Rm <b>';
  const r = run(gs, { rooms: { 116: { capacity: 2, teacherDept: null } } });
  const all = r.findings.map(say);
  check(all.every(s => !/&[a-z#0-9]+;/i.test(s)), 'no sentence carries an HTML entity');
  check(all.some(s => s.includes('Rm <b>')), 'a name is written as typed, for textContent to show');
  check(C.KINDS.length === 14 && C.KINDS.every(k => C.SEVERITY[k]), 'fourteen kinds, each with a severity');
}

/* conflictsOf equals the old scheduleConflicts on 300 random schedules. */
{
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const reg = registry();
  const rooms = ['204', '118', '116', '104', 'Library', '', '301'];
  let same = 0;
  for (let n = 0; n < 300; n++) {
    const both = rnd() < 0.5;
    const gs = Array.from({ length: 2 + Math.floor(rnd() * 6) }, (_, i) => ({
      id: 'g' + i, name: 'G' + i,
      modsA: Array.from({ length: 8 }, () => rooms[Math.floor(rnd() * rooms.length)]),
      modsB: both ? Array.from({ length: 8 }, () => rooms[Math.floor(rnd() * rooms.length)] || '204') : [],
    }));
    const r = C.checkSchedule(gs, { registry: reg, settings: settings() });
    const ok = ['A', 'B'].every(day => JSON.stringify(C.conflictsOf(r.findings, day, LABELS)) ===
      JSON.stringify(M.scheduleConflicts(gs, day, { registry: reg, labels: LABELS })));
    if (ok) same++;
  }
  check(same === 300, 'conflictsOf equals scheduleConflicts on 300 random schedules (' + same + ')');
}

/* The probe's building: printed, not asserted. */
{
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const reg = [];
  for (let i = 0; i < 90; i++) reg.push({ roomNumber: String(100 + i), teacherName: i < 72 ? 'T' + (i < 6 ? i : i % 66) : null, teacherDept: 'ELA', floorId: i < 45 ? 'f1' : 'f2' });
  const gs = Array.from({ length: 60 }, (_, i) => ({ id: 'g' + i, name: 'G' + i,
    modsA: Array.from({ length: 8 }, () => String(100 + Math.floor(rnd() * 90))),
    modsB: Array.from({ length: 8 }, () => String(100 + Math.floor(rnd() * 90))) }));
  const st = settings();
  const t0 = performance.now();
  let r;
  for (let i = 0; i < 200; i++) r = C.checkSchedule(gs, { registry: reg, settings: st });
  console.log('  info a 90-room, 60-group, 8-mod, two-day building: ' + ((performance.now() - t0) / 200).toFixed(2) + ' ms a check, ' + r.findings.length + ' findings');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
