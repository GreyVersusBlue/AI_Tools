// "What was broken", in words (Path 14 P3 step 3): pure Node.
import { gridDesks } from '../seating.mjs';
import { rng, solve, blame, makeContext } from '../seating-solve.mjs';
import { explain, nameList } from '../seating-explain.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };
const has = (lines, re, m) => ok(lines.some(l => re.test(l.text)), `${m}  got ${JSON.stringify(lines.map(l => l.text))}`);
const NAMES = ['Avery Stone', 'Blake Rivers', 'Casey Lund', 'Dana Park', 'Eli Moss', 'Fern Ode', 'Gus Hale', 'Hana Ito'];
const room = (c, r) => gridDesks(c, r, rng(7)).map((d, i) => ({ ...d, id: 'd' + i, locked: false }));
const sec = (n, desks, over = {}) => ({ id: 'x', name: 'P1', students: NAMES.slice(0, n).map((name, i) => ({ id: 's' + i, name, note: '', flag: false, photo: '' })), desks, assign: {}, apart: [], together: [], layouts: [], history: [], ...over });

eq(nameList([]), '', 'nameList empty'); eq(nameList(['A']), 'A', 'one'); eq(nameList(['A', 'B']), 'A and B', 'two'); eq(nameList(['A', 'B', 'C']), 'A, B and C', 'three');
function eq(a, b, m) { ok(a === b, `${m} got ${a}`); }

// nothing broken: nothing said
{
  const s = sec(4, room(2, 2), { apart: [['s0', 's1']] });
  eq(explain(s, solve(s, { seed: 1 })).length, 0, 'a clean chart says nothing');
}

// held: two students pinned side by side and kept apart
{
  const s = sec(3, room(3, 1), { apart: [['s0', 's1']], assign: { d0: 's0', d1: 's1' } });
  s.desks[0].locked = true; s.desks[1].locked = true;
  const r = solve(s, { seed: 1 });
  const lines = explain(s, r);
  has(lines, /^Avery Stone and Blake Rivers are side by side: every seat that would mend it is held by .*pinned seat/, 'held names both students and the pinned seats');
  ok(lines.every(l => l.level === 'bad'), 'a broken hard rule is level bad');
}

// impossible
{
  const s = sec(7, room(3, 2), { rules: [{ id: 'big', kind: 'together', hard: true, students: ['s0', 's1', 's2', 's3', 's4', 's5', 's6'] }] });
  const lines = explain(s, solve(s, { seed: 1 }));
  has(lines, /No arrangement of this room can do that\./, 'impossible says nothing can mend it');
  has(lines, /group of 7 joined desks/, 'and says why');
}

// no room
{
  const s = sec(6, room(2, 2));
  const lines = explain(s, solve(s, { seed: 1 }));
  has(lines, /2 fewer desks than students, so 2 students have no desk\./, 'no-room is counted in words');
  eq(lines.filter(l => / no desk\./.test(l.text)).length, 1, 'and said once');
}

// budget (a mending swap exists): from a hand-built chart
{
  const s = sec(6, room(6, 1), { apart: [['s0', 's1']] });
  const fake = { assign: { d0: 's0', d1: 's1', d2: 's2', d3: 's3', d4: 's4', d5: 's5' }, impossible: [], unseated: [], dropped: [] };
  fake.blame = blame(s, fake, makeContext(s));
  fake.broken = [];
  has(explain(s, fake), /A swap would mend it and the search ran out: Shuffle tries again\./, 'budget says so');
}

// soft: a zone wish that could not be met, with its reason; and repeat seats
{
  const s = sec(4, room(2, 2), { rules: [{ id: 'w', kind: 'zone', hard: false, weight: 2, students: ['s0'], desks: ['d3'], why: 'front row, vision' }, { id: 'h', kind: 'zone', hard: true, students: ['s1'], desks: ['d3'] }] });
  const lines = explain(s, solve(s, { seed: 1 }));
  has(lines, /Avery Stone is not in the desks you marked \(front row, vision\): a wish, not a must\./, 'a soft rule is a wish, with the reason as the teacher wrote it');
  ok(lines.every(l => l.level === 'note'), 'a soft rule is level note');
}

// a contradiction that was set aside
{
  const s = sec(4, room(2, 2), { apart: [['s0', 's1']], rules: [{ id: 'tg', kind: 'together', hard: true, students: ['s0', 's1', 's2'] }] });
  has(explain(s, solve(s, { seed: 1 })), /The rule seating Avery Stone, Blake Rivers and Casey Lund together was set aside: it contradicts keeping Avery Stone and Blake Rivers apart\./, 'the dropped rule is named, with what it contradicts');
}

// names are text, not markup, and a departed student does not throw
{
  const s = sec(3, room(3, 1), { apart: [['s0', 's1']], assign: { d0: 's0', d1: 's1' } });
  s.students[0].name = '<b>Avery</b> & Co';
  s.desks[0].locked = true; s.desks[1].locked = true;
  const lines = explain(s, solve(s, { seed: 1 }));
  has(lines, /<b>Avery<\/b> & Co and Blake Rivers/, 'a name comes through as plain text (the page puts it in with textContent)');
  let threw = false;
  try { explain(s, { blame: [{ ruleId: 'gone', cause: 'held', by: [], students: ['nobody'] }], broken: [], impossible: [], unseated: ['nobody'], dropped: [] }); } catch (e) { threw = true; }
  ok(!threw, 'a result naming someone who has left does not throw');
}

console.log(`seating explain: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
