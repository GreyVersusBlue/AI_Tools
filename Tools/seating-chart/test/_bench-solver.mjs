// Not a suite: prints ms and stats per shape for the solver (Path 14 P3). The target is under
// 250 ms for 40 desks, 36 students and 30 rules on the classroom laptop, 2 s stop behind it.
//   node Tools/seating-chart/test/_bench-solver.mjs [--repeat N]
import { gridDesks } from '../seating.mjs';
import { solve, rng } from '../seating-solve.mjs';

const repeat = Number(process.argv[process.argv.indexOf('--repeat') + 1]) || 50;
const room = (c, r) => gridDesks(c, r, rng(7)).map((d, i) => ({ ...d, id: 'd' + i, locked: false }));
const section = (n, desks, over = {}) => ({ id: 'x', name: 'P1', students: Array.from({ length: n }, (_, i) => ({ id: 's' + i, name: 'S' + i })), desks, assign: {}, apart: [], together: [], layouts: [], history: [], ...over });
const rules30 = () => {
  const r = [];
  for (let i = 0; i < 20; i++) r.push({ id: 'a' + i, kind: 'apart', hard: true, students: ['s' + i, 's' + ((i * 7 + 5) % 36)] });
  r.push({ id: 'pod', kind: 'together', hard: true, students: ['s0', 's1', 's2', 's3'] });
  for (let i = 0; i < 4; i++) r.push({ id: 'z' + i, kind: 'zone', hard: i < 2, weight: 2, students: ['s' + (10 + i)], zone: 'front' });
  r.push({ id: 'sp', kind: 'space', hard: false, weight: 2, students: ['s20'] });
  return r.filter(x => new Set(x.students).size === x.students.length);
};
const shapes = {
  'grid 40 desks, 36 students, no rules': section(36, room(8, 5)),
  'grid 40 desks, 36 students, 30 rules': section(36, room(8, 5), { rules: rules30() }),
  '60 desks, 50 students, 30 rules': section(50, room(10, 6), { rules: rules30() }),
  'impossible (twelve must be in the front row of eight; runs the whole budget)': section(36, room(8, 5), { rules: rules30().concat([{ id: 'full', kind: 'zone', hard: true, students: Array.from({ length: 12 }, (_, i) => 's' + (i + 20)), zone: 'front' }]) }),
};
for (const [name, sec] of Object.entries(shapes)) {
  const ms = [], moves = [], passes = [];
  for (let k = 0; k < repeat; k++) { const r = solve(sec, { seed: k }); ms.push(r.stats.ms); moves.push(r.stats.moves); passes.push(r.stats.passes); }
  ms.sort((a, b) => a - b);
  const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`${name}\n  ms median ${ms[Math.floor(ms.length / 2)].toFixed(1)}  p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(1)}  max ${ms[ms.length - 1].toFixed(1)}   moves avg ${avg(moves)}  passes avg ${avg(passes)}`);
}
