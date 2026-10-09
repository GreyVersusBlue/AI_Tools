/* Pure-logic tests for the conference sign-up rules (core.js).
   No browser, no server: the rules take `now` as an argument, so the ten-minute
   hold is tested by passing a later `now`, not by waiting. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle, newState, TIMES, norm, parseTeachers } from '../core.js';

let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log('ok   ' + name);
};

const teachers = JSON.parse(readFileSync(new URL('../teachers.json', import.meta.url), 'utf8'));
const T0 = Date.UTC(2026, 9, 12, 20, 0, 0);
const MIN = 60000;
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const fresh = (open = true) => {
  const s = newState(teachers, { open, date: 'Tuesday, October 13, 2026' });
  return s;
};
const call = (s, op, body, now = T0, admin = false) => handle(s, op, body, { now, admin, rng });
const A = 'token-parent-A';
const B = 'token-parent-B';
const [t1, t2] = teachers;

test('the seed is the 32 teachers and the twelve 15-minute slots from the old sheet', () => {
  assert.equal(teachers.length, 32);
  assert.equal(TIMES.length, 12);
  assert.equal(TIMES[0], '4:00');
  assert.equal(TIMES[11], '6:45');
});

test('everything starts open, and a parent sees only letters, never a name', () => {
  const s = fresh();
  const v = call(s, 'state', { token: A }).body;
  assert.equal(v.teachers.length, 32);
  assert.equal(v.grid[t1.id], 'f'.repeat(12));
  assert.ok(!JSON.stringify(v).includes('student'));
});

test('a hold is exclusive, and a second parent sees it as held', () => {
  const s = fresh();
  assert.ok(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' }).body.ok);
  const r = call(s, 'hold', { token: B, student: 'Other Kid', tid: t1.id, time: '4:00' });
  assert.equal(r.body.reason, 'held');
  assert.equal(call(s, 'state', { token: B }).body.grid[t1.id][0], 'h');
  assert.equal(call(s, 'state', { token: A }).body.grid[t1.id][0], 'm');
});

test('a hold frees itself after ten minutes and not before', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  assert.equal(call(s, 'hold', { token: B, student: 'Kid B', tid: t1.id, time: '4:00' }, T0 + 9 * MIN + 59000).body.reason, 'held');
  assert.ok(call(s, 'hold', { token: B, student: 'Kid B', tid: t1.id, time: '4:00' }, T0 + 10 * MIN).body.ok);
});

test('holding your own slot again just restarts the clock', () => {
  const s = fresh();
  const a = call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const b = call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' }, T0 + 5 * MIN);
  assert.equal(b.body.until - a.body.until, 5 * MIN);
});

test('release gives the slot back, and only to its owner', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  call(s, 'release', { token: B, tid: t1.id, time: '4:00' });
  assert.equal(call(s, 'hold', { token: B, student: 'Kid B', tid: t1.id, time: '4:00' }).body.reason, 'held');
  call(s, 'release', { token: A, tid: t1.id, time: '4:00' });
  assert.ok(call(s, 'hold', { token: B, student: 'Kid B', tid: t1.id, time: '4:00' }).body.ok);
});

test('a parent cannot put one child with two teachers at the same time', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const r = call(s, 'hold', { token: A, student: 'azul  PINA', tid: t2.id, time: '4:00' });
  assert.equal(r.body.reason, 'student-busy');
  assert.equal(r.body.teacher, t1.name);
  assert.ok(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t2.id, time: '4:15' }).body.ok);
});

test('the same child is refused at a time another parent already booked for them', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  assert.ok(call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Mom', items: [{ tid: t1.id, time: '4:00' }] }).body.ok);
  const r = call(s, 'hold', { token: B, student: 'Azul Pina', tid: t2.id, time: '4:00' });
  assert.equal(r.body.reason, 'student-busy');
});

test('a browser may hold only so many slots at once', () => {
  const s = fresh();
  s.config.maxHolds = 3;
  for (let i = 0; i < 3; i++) assert.ok(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: TIMES[i] }).body.ok);
  assert.equal(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: TIMES[3] }).body.reason, 'too-many');
  assert.ok(call(s, 'hold', { token: B, student: 'Kid B', tid: t1.id, time: TIMES[3] }).body.ok);
});

test('sign-ups that are not open take no holds and no checkouts, but staff still can book', () => {
  const s = fresh(false);
  assert.equal(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' }).body.reason, 'closed');
  assert.ok(call(s, 'admin/book', { student: 'Azul Pina', parent: 'Mom', tid: t1.id, time: '4:00' }, T0, true).body.ok);
});

test('checkout books the whole bag under one confirmation code', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t2.id, time: '4:15' });
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const r = call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Maria Pina', items: [{ tid: t2.id, time: '4:15' }, { tid: t1.id, time: '4:00' }] });
  assert.ok(r.body.ok);
  assert.match(r.body.code, /^[A-Z2-9]{6}$/);
  assert.deepEqual(r.body.bookings.map((x) => x.time), ['4:00', '4:15']);
  assert.equal(call(s, 'state', { token: B }).body.grid[t1.id][0], 't');
  assert.equal(call(s, 'state', { token: A }).body.mine.length, 0);
});

test('checkout is all or none: one lost hold books nothing and names the slot', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t2.id, time: '4:15' });
  // A's second hold lapses, and B takes it.
  call(s, 'release', { token: A, tid: t2.id, time: '4:15' });
  call(s, 'hold', { token: B, student: 'Kid B', tid: t2.id, time: '4:15' });
  const r = call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Maria Pina', items: [{ tid: t1.id, time: '4:00' }, { tid: t2.id, time: '4:15' }] });
  assert.equal(r.body.ok, false);
  assert.deepEqual(r.body.failures.map((f) => [f.tid, f.reason]), [[t2.id, 'held']]);
  assert.equal(call(s, 'state', { token: B }).body.grid[t1.id][0], 'h', 'the good slot stays held for A, not booked');
});

test('a hold that ran out a moment ago but was not taken can still be checked out', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const r = call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Maria Pina', items: [{ tid: t1.id, time: '4:00' }] }, T0 + 11 * MIN);
  assert.ok(r.body.ok);
});

test('a retried checkout returns the same confirmation and books nothing twice', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const body = { token: A, student: 'Azul Pina', parent: 'Maria Pina', items: [{ tid: t1.id, time: '4:00' }] };
  const one = call(s, 'checkout', body);
  const two = call(s, 'checkout', body);
  assert.equal(two.body.code, one.body.code);
  assert.equal(two.changed, false);
});

test('checkout needs a student, a parent and something in the bag', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const items = [{ tid: t1.id, time: '4:00' }];
  assert.equal(call(s, 'checkout', { token: A, student: 'Azul Pina', parent: '', items }).body.reason, 'parent');
  assert.equal(call(s, 'checkout', { token: A, student: '', parent: 'Mom', items }).body.reason, 'student');
  assert.equal(call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Mom', items: [] }).body.reason, 'empty');
});

test('two items at one time cannot be checked out together', () => {
  const s = fresh();
  const items = [{ tid: t1.id, time: '4:00' }, { tid: t2.id, time: '4:00' }];
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  const r = call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Mom', items });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.failures[0].reason, 'student-busy');
});

test('staff can double-book a child for a team conference, and it shares one code', () => {
  const s = fresh();
  const first = call(s, 'admin/book', { student: 'Azul Pina', parent: 'Maria', tid: t1.id, time: '4:00' }, T0, true);
  assert.ok(first.body.ok);
  const refused = call(s, 'admin/book', { student: 'Azul Pina', parent: 'Maria', tid: t2.id, time: '4:00' }, T0, true);
  assert.equal(refused.body.reason, 'student-busy');
  const team = call(s, 'admin/book', { student: 'Azul Pina', parent: 'Maria', tid: t2.id, time: '4:00', force: true }, T0, true);
  assert.ok(team.body.ok);
  assert.equal(team.body.team, true);
  assert.equal(team.body.code, first.body.code);
});

test('a team booking keeps the family\'s own spelling, whatever staff typed', () => {
  const s = fresh();
  call(s, 'admin/book', { student: 'Azul Pina', parent: 'Maria Pina', tid: t1.id, time: '4:00' }, T0, true);
  call(s, 'admin/book', { student: 'azul PINA', parent: '', tid: t2.id, time: '4:00', force: true }, T0, true);
  assert.equal(s.slots[t2.id + '|4:00'].booking.student, 'Azul Pina');
  assert.equal(s.slots[t2.id + '|4:00'].booking.parent, 'Maria Pina');
});

test('staff booking pushes aside a parent hold, and nobody can book over a booking', () => {
  const s = fresh();
  call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:00' });
  assert.ok(call(s, 'admin/book', { student: 'Kid C', parent: 'Dad', tid: t1.id, time: '4:00' }, T0, true).body.ok);
  assert.equal(call(s, 'admin/book', { student: 'Kid D', parent: 'Dad', tid: t1.id, time: '4:00' }, T0, true).body.reason, 'taken');
  assert.equal(call(s, 'checkout', { token: A, student: 'Azul Pina', parent: 'Mom', items: [{ tid: t1.id, time: '4:00' }] }).body.reason, 'unavailable');
});

test('blocking removes a slot from parents, and a booked slot cannot be blocked', () => {
  const s = fresh();
  call(s, 'admin/book', { student: 'Kid C', parent: 'Dad', tid: t1.id, time: '4:00' }, T0, true);
  const r = call(s, 'admin/block', { on: true, cells: [{ tid: t1.id, time: '4:00' }, { tid: t1.id, time: '4:15' }] }, T0, true);
  assert.deepEqual(r.body.refused, [{ tid: t1.id, time: '4:00' }]);
  assert.equal(call(s, 'state', { token: A }).body.grid[t1.id].slice(0, 2), 'tb');
  assert.equal(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:15' }).body.reason, 'blocked');
  call(s, 'admin/block', { on: false, cells: [{ tid: t1.id, time: '4:15' }] }, T0, true);
  assert.ok(call(s, 'hold', { token: A, student: 'Azul Pina', tid: t1.id, time: '4:15' }).body.ok);
});

test('cancelling a meeting reopens the slot', () => {
  const s = fresh();
  call(s, 'admin/book', { student: 'Kid C', parent: 'Dad', tid: t1.id, time: '4:00' }, T0, true);
  assert.ok(call(s, 'admin/cancel', { tid: t1.id, time: '4:00' }, T0, true).body.ok);
  assert.equal(call(s, 'state', { token: A }).body.grid[t1.id][0], 'f');
  assert.equal(call(s, 'admin/cancel', { tid: t1.id, time: '4:00' }, T0, true).body.reason, 'none');
});

test('admin routes need the admin flag; parent routes do not', () => {
  const s = fresh();
  for (const op of ['admin/login', 'admin/state', 'admin/book', 'admin/cancel', 'admin/block', 'admin/config', 'admin/teachers', 'admin/reset', 'admin/export']) {
    assert.equal(call(s, op, {}, T0, false).status, 401, op);
  }
  assert.equal(call(s, 'state', {}).status, 200);
});

test('the teacher list can be edited, keeps ids by name, and refuses to strand a meeting', () => {
  const s = fresh();
  call(s, 'admin/book', { student: 'Kid C', parent: 'Dad', tid: t1.id, time: '4:00' }, T0, true);
  const lines = teachers.map((t) => `${t.name} | ${t.subject} | ${t.grade}`).concat('Mr. New | Art | 6th');
  const r = call(s, 'admin/teachers', { text: lines.join('\n') }, T0, true);
  assert.ok(r.body.ok);
  assert.equal(s.teachers.length, 33);
  assert.equal(s.teachers[0].id, t1.id);
  assert.equal(s.slots[t1.id + '|4:00'].booking.student, 'Kid C');
  const without = parseTeachers(lines.slice(1).join('\n'));
  const r2 = call(s, 'admin/teachers', { teachers: without }, T0, true);
  assert.equal(r2.body.reason, 'has-meetings');
  assert.deepEqual(r2.body.teachers, [t1.name]);
});

test('config clamps hold minutes and the open switch persists', () => {
  const s = fresh(false);
  call(s, 'admin/config', { open: true, holdMinutes: 500, maxHolds: 0 }, T0, true);
  assert.equal(s.config.open, true);
  assert.equal(s.config.holdMinutes, 60);
  assert.equal(s.config.maxHolds, 6);
  call(s, 'admin/config', { holdMinutes: 1 }, T0, true);
  assert.equal(s.config.holdMinutes, 1);
});

test('the export matches the old sheet: header, subject and grade rows, Block, open counts', () => {
  const s = fresh();
  call(s, 'admin/book', { student: 'Azul Pina', parent: 'Maria', tid: t1.id, time: '4:00' }, T0, true);
  call(s, 'admin/block', { on: true, cells: [{ tid: t2.id, time: '4:15' }] }, T0, true);
  const [matrix, list] = call(s, 'admin/export', { tz: 0 }, T0, true).body.sheets;
  const rows = matrix.rows;
  assert.match(rows[0][0], /East Middle School – Teacher Conferences, Tuesday, October 13, 2026/);
  assert.deepEqual(rows[2].slice(0, 3), ['Time (PM)', 'Ms. Almer', 'Mr. Barrett']);
  assert.equal(rows[2][33], 'Open Slots');
  assert.deepEqual(rows[3].slice(0, 2), ['Subject', 'Science']);
  assert.deepEqual(rows[4].slice(0, 2), ['Grade', '6th & 7th']);
  assert.deepEqual([rows[5][0], rows[5][1]], ['4:00', 'Azul Pina']);
  assert.equal(rows[6][2], 'Block');
  assert.equal(rows[5][33], 31);
  const openRow = rows.find((r) => r[0] === 'Open per teacher');
  assert.equal(openRow[1], 11);
  assert.equal(openRow[2], 11);
  assert.equal(openRow[33], 32 * 12 - 2);
  assert.equal(list.rows.length, 2);
  assert.deepEqual(list.rows[1].slice(0, 7), ['4:00', 'Ms. Almer', 'Science', '6th & 7th', 'Azul Pina', 'Maria', list.rows[1][6]]);
  assert.equal(list.rows[1][7], 'Staff');
});

test('norm folds case, spacing, accents and punctuation', () => {
  assert.equal(norm("  O’Hara-Turner,  JAMESON "), 'oharaturner jameson');
  assert.equal(norm('Zoë  Núñez'), 'zoe nunez');
});

test('a hundred requests for one slot, one after another (as the Durable Object serialises them): exactly one wins', () => {
  const s = fresh();
  let wins = 0;
  for (let i = 0; i < 100; i++) {
    if (call(s, 'hold', { token: 'racer-token-' + i, student: 'Kid ' + i, tid: t1.id, time: '4:00' }).body.ok) wins++;
  }
  assert.equal(wins, 1);
});

console.log(`\n${n} passed`);
