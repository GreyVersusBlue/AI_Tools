// A zone rule that remembers its mark (Path 14 P4 step 6): pure Node.
// A rule tied to a mark follows it when it moves, resizes or turns; old desk-list zone rules are
// untouched; a gone mark leaves an ordinary desk-list rule; a link carries no mark id; an old chart
// (fixtures/saved-v357.json) still loads byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairState } from '../seating.mjs';
import * as R from '../seating-room.mjs';
import { buildRule, addRule, forShare, describeRule, pruneRules } from '../seating-rules.mjs';
import { score, rng } from '../seating-solve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const old = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'saved-v357.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}  got ${JSON.stringify(a).slice(0, 300)}  want ${JSON.stringify(b).slice(0, 300)}`);
const clone = x => JSON.parse(JSON.stringify(x));

let st = repairState(clone(old), rng(1));
eq(st, old, 'old chart loads exactly as saved');
const made = R.createRoom(st, st.sections[0].id, 'Room 12', rng(2));
st = made.state;
const roomId = made.room.id, secId = st.sections[0].id;
st = R.setMark(st, roomId, { id: 'door1', kind: 'door', x: 300, y: 100, w: 60, h: 110, label: 'Door' }, rng(3)).state;
const sec0 = () => st.sections.find(s => s.id === secId);
const near0 = R.desksNear(st.rooms[0], 'door1').filter(id => sec0().desks.some(d => d.id === id));
ok(near0.length > 0 && near0.length < sec0().desks.length, 'some, not all, desks are near the door');
const studentIds = sec0().students.map(s => s.id);
ok(studentIds.length >= 1, 'the fixture has a student');

// building the rule
const built = buildRule({ kind: 'zone', zone: 'mark', mark: 'door1', markDesks: near0, students: [studentIds[0]], hard: false, weight: 2 }, sec0(), () => 'z1');
ok(built.rule && built.rule.mark === 'door1' && built.rule.zone === '' && JSON.stringify(built.rule.desks) === JSON.stringify(near0), 'buildRule: a mark rule holds the mark id and the desks near it');
eq(buildRule({ kind: 'zone', zone: 'mark', mark: '', markDesks: near0, students: [studentIds[0]] }, sec0()).error, 'Pick a mark in the room.', 'buildRule: no mark is refused with a sentence');
eq(buildRule({ kind: 'zone', zone: 'mark', mark: 'door1', markDesks: [], students: [studentIds[0]] }, sec0()).error, 'No desk is near that mark.', 'buildRule: a mark with no desk near it is refused');
const plain = buildRule({ kind: 'zone', zone: 'desks', desks: near0, students: [studentIds[0]], mark: 'door1' }, sec0(), () => 'z2');
ok(plain.rule && !('mark' in plain.rule), 'buildRule: a desk-list rule never carries a mark, even if the form had one');
const front = buildRule({ kind: 'zone', zone: 'front', students: [studentIds[0]] }, sec0(), () => 'z3');
ok(front.rule && !('mark' in front.rule), 'buildRule: a named zone carries no mark');

// follow: move, resize, turn
const s0 = clone(sec0());
addRule(s0, built.rule);
st = { ...st, sections: st.sections.map(s => (s.id === secId ? s0 : s)) };
eq(R.syncMarkRules(st), st, 'syncMarkRules: nothing moved, nothing changes (same object)');
ok(R.syncMarkRules(st) === st, 'syncMarkRules: returns the same state object when unchanged');
const ruleDesks = s => s.rules.find(r => r.id === 'rule:z1').desks;
const lastDesk = sec0().desks[sec0().desks.length - 1];
const moved = R.syncMarkRules(R.setMark(st, roomId, { ...st.rooms[0].marks[0], x: lastDesk.x + 110, y: lastDesk.y }).state);
const nearMoved = R.desksNear(moved.rooms[0], 'door1').filter(id => sec0().desks.some(d => d.id === id));
eq(ruleDesks(moved.sections.find(s => s.id === secId)), nearMoved, 'moving the mark moves the rule\'s desks');
ok(JSON.stringify(nearMoved) !== JSON.stringify(near0), 'and they are different desks from before');
const bigger = R.syncMarkRules(R.editMark(st, roomId, 'door1', { w: 400, h: 300 }).state);
ok(ruleDesks(bigger.sections.find(s => s.id === secId)).length > near0.length, 'making the mark bigger takes in more desks');
eq(ruleDesks(R.syncMarkRules(bigger).sections.find(s => s.id === secId)), ruleDesks(bigger.sections.find(s => s.id === secId)), 'syncing twice is the same as once');

// the solver reads desks only
const a = score(sec0Of(moved), {});
function sec0Of(s) { return s.sections.find(x => x.id === secId); }
ok(a && typeof a === 'object', 'the solver scores a section with a mark rule (it reads desks)');

// a mark with no desk near it leaves the rule's desks as they were
const far = R.syncMarkRules(R.editMark(R.setMark(st, roomId, { ...st.rooms[0].marks[0], x: 1200, y: 800 }).state, roomId, 'door1', { w: 10, h: 10 }).state);
ok(ruleDesks(far.sections.find(s => s.id === secId)).length >= 1, 'a mark with no desk near keeps the last desks (never an empty rule)');

// a gone mark: the rule becomes an ordinary desk-list rule
const gone = R.syncMarkRules(R.removeMark(st, roomId, 'door1'));
const gr = gone.sections.find(s => s.id === secId).rules.find(r => r.id === 'rule:z1');
ok(gr && !('mark' in gr) && JSON.stringify(gr.desks) === JSON.stringify(near0), 'removing the mark keeps the desks and forgets the mark');
const detached = R.syncMarkRules(R.detachSection(st, secId));
ok(!('mark' in detached.sections.find(s => s.id === secId).rules.find(r => r.id === 'rule:z1')), 'a period that leaves the room forgets the mark');

// a save and load keeps it; an old desk-list rule is unchanged; a link carries no mark
eq(repairState(clone(moved), rng(9)), moved, 'a state with a mark rule round-trips');
const sh = forShare(moved.sections.find(s => s.id === secId));
ok(sh.rules.every(r => !('mark' in r)) && !('room' in sh), 'forShare: no mark id and no room in a link');
ok(moved.sections.find(s => s.id === secId).rules.some(r => r.mark === 'door1'), 'forShare leaves the stored rule alone');
const s1 = clone(sec0()); addRule(s1, plain.rule);
const s1b = clone(s1); pruneRules(s1b);
eq(s1b.rules, s1.rules, 'an old desk-list zone rule is unchanged by prune');
eq(describeRule(built.rule, id => id, id => 3, id => 'Door').text, `${studentIds[0]} in the desks near Door`, 'describeRule: a mark rule says which mark');
ok(/desk /.test(describeRule(built.rule, id => id, id => 3).text), 'describeRule: with no mark name it falls back to the desk numbers');
eq(describeRule(plain.rule, id => id, id => 3, id => 'Door').text, `${studentIds[0]} in desk ${plain.rule.desks.map(() => 3).join(', ')}`, 'describeRule: a desk-list rule is worded as before');

console.log(`seating room zone: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
