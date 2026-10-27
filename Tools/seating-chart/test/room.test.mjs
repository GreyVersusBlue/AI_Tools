// Seating room layer (Path 14 P4 step 1): pure Node.
// Old charts (fixtures/saved-v357.json, written by v357's own repair) load byte-identical; a room is
// shared by periods through a mirror in section.desks, so the readers never see a room; edits to the
// room follow into every period; a missing room is forgotten without losing a desk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairState, ROOM } from '../seating.mjs';
import * as R from '../seating-room.mjs';
import { rng } from '../seating-solve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const old = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'saved-v357.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}  got ${JSON.stringify(a).slice(0, 300)}  want ${JSON.stringify(b).slice(0, 300)}`);
const clone = x => JSON.parse(JSON.stringify(x));

// 0. the geometry this file copies is ROOM's
eq(R.GEOMETRY, { width: ROOM.width, height: ROOM.height, deskW: ROOM.deskW, deskH: ROOM.deskH }, 'geometry equals ROOM');

// 1. an old chart: unchanged, no rooms, no room field, twice over
const base = repairState(clone(old), rng(1));
eq(base, old, 'old format loads exactly as saved');
ok(!('rooms' in base) && base.sections.every(s => !('room' in s)), 'old format: no rooms or room field appears');
eq(repairState(clone(base), rng(2)), base, 'old format: loading twice changes nothing');

// 2. a room from a period; a second period joins; the seats are counted
let st = clone(base);
st.sections[1].students = [{ id: 'x1', name: 'Xia', note: '', flag: false, photo: '' }];
st = repairState(st, rng(3));
let made = R.createRoom(st, 'secA', 'Room 12', rng(4));
st = made.state;
ok(made.room && st.rooms.length === 1 && st.sections[0].room === made.room.id, 'createRoom: room exists and the period is in it');
eq(st.sections[0].desks, base.sections[0].desks, 'createRoom: the period\'s desks and seats are unchanged');
eq(st.sections[0].assign, base.sections[0].assign, 'createRoom: seats unchanged');
const roomId = made.room.id;
let at = R.attachSection(st, 'secB', roomId);
st = at.state;
eq(st.sections[1].desks.map(d => d.id), st.rooms[0].desks.map(d => d.id), 'attachSection: the second period has the room\'s desks');
ok(at.unseated === 0, 'attachSection: nothing to unseat for an empty period');
eq(R.sectionsIn(st, roomId), ['secA', 'secB'], 'sectionsIn names both periods');

// 3. it survives a save and load, and the load is idempotent
const re = repairState(clone(st), rng(5));
eq(re, st, 'room + mirror round-trip unchanged');
eq(repairState(clone(re), rng(6)), re, 'room + mirror: loading twice changes nothing');

// 4. editing the room once changes every period; locked stays the period's own
let lockedA = clone(st); lockedA.sections[0].desks[0].locked = true; lockedA = repairState(lockedA, rng(7));
const moved = R.setRoomDesks(lockedA, roomId, lockedA.rooms[0].desks.map((d, i) => (i === 1 ? { ...d, x: 600, y: 300 } : d)));
ok(moved.state.sections.every(s => { const d = s.desks.find(x => x.id === lockedA.rooms[0].desks[1].id); return d.x === 600 && d.y === 300; }), 'setRoomDesks: the moved desk moves in every period');
ok(moved.state.sections[0].desks[0].locked === true && moved.state.sections[1].desks[0].locked === false, 'setRoomDesks: locked stays per period');
const dropped = lockedA.rooms[0].desks[0].id;
const removed = R.setRoomDesks(lockedA, roomId, lockedA.rooms[0].desks.slice(1));
ok(!removed.state.sections[0].desks.some(d => d.id === dropped) && !(dropped in removed.state.sections[0].assign), 'setRoomDesks: a removed desk is gone and its seat dropped');
ok(removed.unseated === 1, `setRoomDesks: the dropped seat is counted (${removed.unseated})`);
eq(repairState(clone(removed.state), rng(8)), removed.state, 'edited room round-trips');
ok(lockedA.rooms[0].desks.length === removed.state.rooms[0].desks.length + 1 && lockedA.sections[0].desks.length === removed.state.sections[0].desks.length + 1, 'edits leave the old state alone');

// 4b. a section whose desks drifted (an older cached page saved a move) follows the room on load
const drift = clone(st); drift.sections[1].desks[2].x = 50;
eq(repairState(drift, rng(15)).sections[1].desks, st.sections[1].desks, 'load: a drifted mirror is put back to the room\'s geometry');

// 5. a period joining a room that lacks its desks unseats them, counted
const second = repairState(clone(base), rng(9));
const mk = R.createRoom(second, 'secB', 'Empty', rng(10));
const joined = R.attachSection(mk.state, 'secA', mk.room.id);
ok(joined.unseated === Object.keys(base.sections[0].assign).length && Object.keys(joined.state.sections[0].assign).length === 0, 'attachSection: seats on desks the room lacks are unseated and counted');

// 6. a missing room is forgotten, the desks stay; a bad room is repaired
const gone = clone(st); gone.rooms = [];
const g = repairState(gone, rng(11));
ok(g.sections.every(s => !('room' in s)) && g.sections[0].desks.length === st.sections[0].desks.length && !('rooms' in g), 'missing room: period forgets it and keeps its desks');
const bad = clone(st); bad.rooms = [null, 5, { id: roomId, name: '  ', desks: st.rooms[0].desks, marks: [{ kind: 'door', x: -50, y: 9999, w: 4000, h: 1 }, { kind: 'zzz' }, null] }, { id: roomId, name: 'dup' }];
const b = repairState(bad, rng(12));
ok(b.rooms.length === 1 && b.rooms[0].name === 'Room 1', 'bad rooms: junk and duplicates dropped, name defaulted');
ok(b.rooms[0].marks.length === 1 && b.rooms[0].marks[0].x === 0 && b.rooms[0].marks[0].w === ROOM.width && b.rooms[0].marks[0].y <= ROOM.height - 10, 'bad rooms: marks clamped, unknown kind dropped');

// 7. detach and delete keep desks and seats
const det = R.detachSection(st, 'secB');
ok(!('room' in det.sections[1]) && det.sections[1].desks.length === st.sections[1].desks.length, 'detachSection: keeps the desks');
const del = R.deleteRoom(st, roomId);
ok(!('rooms' in del) && del.sections.every(s => !('room' in s)) && del.sections[0].desks.length === st.sections[0].desks.length, 'deleteRoom: periods keep desks, rooms field goes with the last room');
eq(del, repairState(clone(del), rng(13)), 'deleteRoom: result is already a loadable chart');

// 8. marks and "near the door"
let mm = R.setMark(st, roomId, { id: 'door1', kind: 'door', x: 300, y: 100, w: 60, h: 100, label: 'Door' }, rng(14));
st = mm.state;
ok(mm.mark && st.rooms[0].marks.length === 1, 'setMark adds');
st = R.setMark(st, roomId, { id: 'door1', kind: 'door', x: 300, y: 100, w: 60, h: 110 }).state;
ok(st.rooms[0].marks.length === 1 && st.rooms[0].marks[0].h === 110, 'setMark with the same id replaces');
ok(R.setMark(st, roomId, { kind: 'nope' }).mark === null, 'setMark refuses an unknown kind');
const near = R.desksNear(st.rooms[0], 'door1', 150);
const all = st.rooms[0].desks;
ok(near.length > 0 && near.length < all.length, `desksNear picks some desks (${near.length} of ${all.length})`);
ok(near.every(id => { const d = all.find(x => x.id === id); return Math.hypot(Math.max(300 - (d.x + 53), 0, d.x + 53 - 360), Math.max(100 - (d.y + 35), 0, d.y + 35 - 210)) <= 150; }), 'desksNear: every pick is within the radius of the mark');
eq(R.desksNear(st.rooms[0], 'nope'), [], 'desksNear: unknown mark gives none');
ok(R.removeMark(st, roomId, 'door1').rooms[0].marks.length === 0, 'removeMark removes');

// 9. what the readers see: section.desks only, in the shape they read
const SeatingRead = (await import('../../../_shared/seating-read.js').then(() => globalThis.SeatingRead).catch(() => null));
if (SeatingRead && SeatingRead.parse) {
  const parsed = SeatingRead.parse(JSON.stringify(st));
  ok(parsed && parsed.sections[0].desks.length === st.sections[0].desks.length, 'seating-read parses a chart with rooms');
}

console.log(`seating room: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
