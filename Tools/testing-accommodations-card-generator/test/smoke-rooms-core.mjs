// smoke-rooms-core.mjs — which testing room each student goes to, in pure Node.
//
//   node Tools/testing-accommodations-card-generator/test/smoke-rooms-core.mjs
//
// rooms.js must never seat a student in a room that lacks one of their
// accommodations, must give the same answer for the same input, must leave a
// student unplaced (with the reason) only when no arrangement can seat them,
// and must not move a kept placement. ROOMS_FILE points it at another copy of
// the module (the deliberate-break runs use it). Names are invented.
// Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.ROOMS_FILE || path.join(here, '..', 'rooms.js');
await import(pathToFileURL(file).href);
const R = globalThis.TacgRooms;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(a === b, `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const same = (a, b, l) => eq(JSON.stringify(a), JSON.stringify(b), l);

console.log('Rooms — routing, reasons, determinism');

const T = ['ext', 'sep', 'read', 'brk'];
const room = (id, capacity, provides) => ({ id, name: id, capacity, proctor: '', provides });
const stu = (name, ...needs) => ({ name, needs });
const route = (students, rooms, keep) => R.route({ students, rooms, typeIds: T, keep });

/* 1. needsOf, routable, capacityOf, providesOf, missingFor, loads */
const state = {
  roster: ['Ann', 'Bo', 'Cy', 'Di'],
  types: T.map(id => ({ id, name: id })),
  assignments: { 'Ann|sep': true, 'Ann|ext': true, 'Cy|read': true, 'Di|gone': true, 'Bo|brk': false },
};
same(R.needsOf(state, 'Ann'), ['ext', 'sep'], 'needs come back in the order the types are listed');
same(R.needsOf(state, 'Bo'), [], 'an unticked box is no need');
same(R.needsOf(state, 'Di'), [], 'a tick on a deleted type is no need');
same(R.routable(state), ['Ann', 'Cy'], 'only students with an accommodation need a room');
eq(R.capacityOf({ capacity: 8 }), 8, 'capacity 8');
eq(R.capacityOf({ capacity: '12' }), 12, 'capacity typed as text');
eq(R.capacityOf({ capacity: 3.9 }), 3, 'capacity is whole seats');
eq(R.capacityOf({ capacity: -2 }), 0, 'negative capacity is none');
eq(R.capacityOf({ capacity: 'lots' }), 0, 'junk capacity is none');
eq(R.capacityOf({}), 0, 'no capacity is none');
same(R.providesOf(room('a', 1, ['sep', 'gone', 'sep', 'ext']), T), ['sep', 'ext'], 'provides drops deleted types and repeats');
same(R.providesOf({}, T), [], 'a room with no list provides nothing');
same(R.missingFor(['ext', 'read'], room('a', 1, ['ext']), T), ['read'], 'missingFor names what the room lacks');
same(R.missingFor(['ext'], room('a', 1, ['ext', 'read']), T), [], 'a room with more than needed is a fit');
same(R.missingFor(['ext'], room('a', 1, ['gone']), T), ['ext'], 'a deleted type provides nothing');
same(R.loads([room('a', 1, []), room('b', 1, [])], { x: 'a', y: 'a', z: 'zz' }), { a: 2, b: 0 }, 'loads counts per room and ignores a room that is gone');

/* 2. a simple route, the rule, tightest fit */
{
  const rooms = [room('big', 5, ['ext', 'sep', 'read']), room('small', 5, ['ext'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'ext', 'read'), stu('Cy', 'sep')], rooms);
  eq(r.placed.Ann, 'small', 'extended time only: the room that offers nothing else');
  eq(r.placed.Bo, 'big', 'a student whose needs only one room offers goes there');
  eq(r.placed.Cy, 'big', 'separate setting: only the big room has it');
  eq(r.unplaced.length, 0, 'nobody left over');
}
{
  const rooms = [room('a', 5, ['ext', 'sep']), room('b', 5, ['ext', 'sep'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'ext')], rooms);
  eq(r.placed.Ann, 'a', 'equal rooms: the first in order');
  eq(r.placed.Bo, 'a', 'and the first again while it has space');
}

/* 3. the rule is never bent */
{
  const rooms = [room('a', 9, ['ext']), room('b', 9, ['read'])];
  const students = [stu('Ann', 'ext', 'read'), stu('Bo', 'ext'), stu('Cy', 'read'), stu('Di', 'brk')];
  const r = route(students, rooms);
  same(Object.keys(r.placed).sort(), ['Bo', 'Cy'], 'only students a room can fully serve are placed');
  eq(r.placed.Bo, 'a', 'Bo in a');
  eq(r.placed.Cy, 'b', 'Cy in b');
  same(r.unplaced.map(u => u.name), ['Ann', 'Di'], 'the others are returned, roster order');
  same(r.unplaced[0].reason, { kind: 'combo', needs: ['ext', 'read'] }, 'each need is offered somewhere but not together');
  same(r.unplaced[1].reason, { kind: 'missing', missing: ['brk'] }, 'nobody offers breaks');
  for (const s of students) if (r.placed[s.name]) {
    same(R.missingFor(s.needs, rooms.find(x => x.id === r.placed[s.name]), T), [], `${s.name} is placed in a room that provides everything`);
  }
}

/* 4. full rooms and the reason */
{
  const rooms = [room('a', 2, ['sep']), room('b', 1, ['sep'])];
  const students = ['Ann', 'Bo', 'Cy', 'Di', 'Ed'].map(n => stu(n, 'sep'));
  const r = route(students, rooms);
  eq(Object.keys(r.placed).length, 3, 'three seats, three placed');
  same(r.unplaced.map(u => u.name), ['Di', 'Ed'], 'the last two in roster order are left');
  same(r.unplaced[0].reason, { kind: 'full', rooms: ['a', 'b'] }, 'the rooms that would do are named, and they are full');
  eq(R.loads(rooms, r.placed).a, 2, 'a is full');
  eq(R.loads(rooms, r.placed).b, 1, 'b is full');
}
{
  const r = route([stu('Ann', 'ext')], [room('a', 0, ['ext'])]);
  eq(r.unplaced.length, 1, 'a room with no seats seats nobody');
  eq(r.unplaced[0].reason.kind, 'full', '… and says it is full');
  same(route([stu('Ann', 'ext')], []).unplaced[0].reason, { kind: 'missing', missing: ['ext'] }, 'no rooms at all: nobody provides it');
  same(route([], [room('a', 1, [])]).placed, {}, 'no students, no placements');
}

/* 5. an already-placed student is moved to make space (an augmenting path) */
{
  // Ann fits a or b; Bo fits only a. Greedy puts Ann in a (first) and strands Bo.
  const rooms = [room('a', 1, ['ext', 'sep']), room('b', 1, ['ext'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'ext', 'sep')], rooms);
  eq(r.unplaced.length, 0, 'both placed although Ann had to move over for Bo');
  eq(r.placed.Ann, 'b', 'Ann in b');
  eq(r.placed.Bo, 'a', 'Bo in a');
}
{
  // A chain: three students, each can only be seated if the one before shifts.
  const rooms = [room('a', 1, ['s1', 's2', 's3']), room('b', 1, ['s2', 's3']), room('c', 1, ['s3'])];
  const T3 = ['s1', 's2', 's3'];
  const r = R.route({ students: [stu('P', 's3'), stu('Q', 's3'), stu('S', 's1', 's2', 's3')], rooms, typeIds: T3 });
  eq(Object.keys(r.placed).length, 3, 'a chain of three moves seats all three');
  eq(r.placed.S, 'a', 'the demanding student takes the only room that has it');
}

/* 6. most demanding first */
{
  const rooms = [room('a', 1, ['ext', 'sep']), room('b', 1, ['ext'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'ext', 'sep')], rooms);
  eq(r.placed.Bo, 'a', 'the student with two needs gets the one room that has both, whatever the roster order');
}

/* 7. determinism */
{
  const rooms = [room('a', 3, ['ext', 'sep']), room('b', 2, ['ext', 'read']), room('c', 2, ['ext', 'sep', 'read', 'brk'])];
  const students = Array.from({ length: 9 }, (_, i) => stu('S' + i, ...T.filter((_, k) => (i + k) % 3 === 0 || k === 0).slice(0, 1 + (i % 3))));
  const first = JSON.stringify(route(students, rooms));
  let allSame = true;
  for (let n = 0; n < 20; n++) if (JSON.stringify(route(students.map(s => ({ ...s })), rooms.map(r => ({ ...r })))) !== first) allSame = false;
  ok(allSame, 'twenty runs on the same input give the same answer byte for byte');
  const r = JSON.parse(first);
  for (const s of students) if (r.placed[s.name]) {
    same(R.missingFor(s.needs, rooms.find(x => x.id === r.placed[s.name]), T), [], `${s.name} fits the room they got`);
  }
  const l = R.loads(rooms, r.placed);
  ok(rooms.every(x => l[x.id] <= x.capacity), 'no room is over capacity');
}

/* 8. kept placements */
{
  const rooms = [room('a', 2, ['ext']), room('b', 2, ['ext', 'read'])];
  const students = [stu('Ann', 'ext'), stu('Bo', 'ext'), stu('Cy', 'ext'), stu('Di', 'ext', 'read')];
  const r = route(students, rooms, { Ann: 'b', Bo: 'b' });
  eq(r.placed.Ann, 'b', 'a kept student stays');
  eq(r.placed.Bo, 'b', 'and the other');
  eq(r.placed.Cy, 'a', 'the room b is full of kept students, so Cy goes to a');
  eq(r.unplaced.map(u => u.name).join(), 'Di', 'Di needs read-aloud, only b has it, and kept students fill b: left over, not displacing them');
  eq(r.unplaced[0].reason.kind, 'full', '… for being full');
  // a kept placement that breaks the rule is not touched (the page warns, the route does not decide)
  const k = route([stu('Ann', 'ext', 'read')], [room('a', 1, ['ext'])], { Ann: 'a' });
  eq(k.placed.Ann, 'a', 'a hand move to a room that lacks something is kept as the teacher left it');
  // a kept placement into a room that no longer exists is ignored
  const g = route([stu('Ann', 'ext')], [room('a', 1, ['ext'])], { Ann: 'gone' });
  eq(g.placed.Ann, 'a', 'a kept room that was deleted is not honoured; the student is routed');
  // over-capacity kept placements take every seat
  const o = route([stu('Ann', 'ext'), stu('Bo', 'ext'), stu('Cy', 'ext')], [room('a', 1, ['ext'])], { Ann: 'a', Bo: 'a' });
  eq(o.unplaced.length, 1, 'a room over capacity by kept students takes no one more');
}

/* 9. inputs are not changed */
{
  const rooms = [room('a', 1, ['ext'])]; const students = [stu('Ann', 'ext')]; const keep = { Ann: 'a' };
  const before = JSON.stringify([rooms, students, keep]);
  route(students, rooms, keep);
  eq(JSON.stringify([rooms, students, keep]), before, 'route() leaves its inputs as they were');
}

/* 10. a student who can only go where an earlier, more flexible student sits */
{
  const rooms = [room('a', 1, ['ext', 'sep']), room('b', 1, ['ext', 'read'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'sep')], rooms);
  eq(r.placed.Ann, 'b', 'Ann moves to b so that Bo, who can only use a, is seated');
  eq(r.placed.Bo, 'a', 'Bo in a');
}

/* 10b. the move can go to an earlier room: the one who moved is in one room only */
{
  const rooms = [room('a', 1, ['ext', 'read', 'brk']), room('b', 1, ['ext', 'sep'])];
  const r = route([stu('Ann', 'ext'), stu('Bo', 'sep')], rooms);
  eq(r.placed.Ann, 'a', 'Ann ends in a, the earlier room she moved to');
  eq(r.placed.Bo, 'b', 'Bo in b');
  same(R.loads(rooms, r.placed), { a: 1, b: 1 }, 'one student to a seat');
}

/* 11. when seats run short the most demanding student is seated, not the first on the roster */
{
  const r = route([stu('Ann', 'ext'), stu('Bo', 'ext', 'read')], [room('a', 1, ['ext', 'read'])]);
  eq(r.placed.Bo, 'a', 'Bo, with two needs, gets the one seat');
  same(r.unplaced.map(u => u.name), ['Ann'], 'Ann is the one left, and told so');
}

/* 12. 400 random small cases against a brute-force best: nobody is seated wrongly, no room is over,
       and nobody is left unplaced who an arrangement could seat. */
{
  let seed = 12345;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const best = (students, rooms) => {
    let top = 0;
    const left = rooms.map(r => r.capacity);
    const go = (i, count) => {
      if (count + (students.length - i) <= top) return;
      if (i === students.length) { top = Math.max(top, count); return; }
      rooms.forEach((r, k) => {
        if (left[k] > 0 && R.missingFor(students[i].needs, r, T).length === 0) { left[k]--; go(i + 1, count + 1); left[k]++; }
      });
      go(i + 1, count);
    };
    go(0, 0);
    return top;
  };
  let badRule = 0, badCap = 0, notBest = 0, badReason = 0, nondet = 0;
  for (let c = 0; c < 400; c++) {
    const rooms = Array.from({ length: 1 + rnd(4) }, (_, i) => room('r' + i, rnd(4), T.filter(() => rnd(2))));
    const students = Array.from({ length: 1 + rnd(7) }, (_, i) => stu('S' + i, ...T.filter(() => rnd(3) === 0)));
    const live = students.filter(s => s.needs.length);
    const r = route(live, rooms);
    live.forEach(s => { if (r.placed[s.name] && R.missingFor(s.needs, rooms.find(x => x.id === r.placed[s.name]), T).length) badRule++; });
    const l = R.loads(rooms, r.placed);
    rooms.forEach(x => { if (l[x.id] > x.capacity) badCap++; });
    if (Object.keys(r.placed).length !== best(live, rooms)) notBest++;
    if (Object.keys(r.placed).length + r.unplaced.length !== live.length) badReason++;
    if (JSON.stringify(route(live, rooms)) !== JSON.stringify(r)) nondet++;
  }
  eq(badRule, 0, 'across 400 random cases nobody is seated in a room that lacks something');
  eq(badCap, 0, 'no room is ever over capacity');
  eq(notBest, 0, 'the number seated is the best any arrangement can do');
  eq(badReason, 0, 'everyone is either placed or listed as unplaced');
  eq(nondet, 0, 'and a second run gives the same answer');
}

console.log(failed ? `\n${failed} FAILED, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
