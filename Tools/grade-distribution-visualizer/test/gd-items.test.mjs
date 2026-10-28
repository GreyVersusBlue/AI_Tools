// gd-items.test.mjs — GradeItems (Tools/grade-distribution-visualizer/gd-items.js), Path 16 P3 step 1.
// Named cases for the per-question reader: the name column, the header, a points-possible row, the
// default maximum, blanks, unreadable and over-maximum cells, the priority order and its ties, the
// tiers at the line and at the edge of the watch band, and the chart data (percent MISSED); then
// each rule is checked against a deliberately broken copy of the module, which must fail it.
//   node Tools/grade-distribution-visualizer/test/gd-items.test.mjs   (npm run test:gd-items)
// Pure Node, no browser, no port. Exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(site, p), 'utf8');
const PASTE = read('_shared/paste-table.js');
const ITEMS = read('Tools/grade-distribution-visualizer/gd-items.js');

function load(mutate) {
  let src = ITEMS;
  if (mutate) { const o = mutate(src); if (o === src) throw new Error('mutant changed nothing'); src = o; }
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(PASTE, ctx); vm.runInContext(src, ctx);
  return ctx.GradeItems;
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

function check(G) {
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };

  // 1. names + header, right/wrong 1/0, no points row: out of the highest score in the column
  let r = G.analyze('Name,Q1,Q2,Q3\nAda,1,0,1\nBo,1,0,0\nCy,1,1,0\nDi,0,0,0');
  ok(r.hasNames && !r.maxGiven && r.students === 4, 'names, header, 4 students');
  ok(r.questions.map(q => q.label).join() === 'Q1,Q2,Q3', 'header labels kept');
  ok(near(r.questions[0].pct, 0.75) && near(r.questions[1].pct, 0.25) && near(r.questions[2].pct, 0.25), 'percent correct from 1/0');
  ok(r.order.join() === '1,2,0', 'priority: lowest first, tie Q2 before Q3 (question order)');
  ok(r.questions[0].missed === 1 && r.questions[0].full === 3, 'missed and full-credit counts');
  ok(r.questions[1].zero === 3, 'zero count');

  // 2. no names, no header: Q1..Qn
  r = G.analyze('4\t2\n3\t2\n4\t1');
  ok(!r.hasNames && r.questions.map(q => q.label).join() === 'Q1,Q2', 'bare numbers read as Q1, Q2');
  ok(r.questions[0].max === 4 && near(r.questions[0].pct, 11 / 12), 'default maximum is the highest score in the column');

  // 3. points possible row
  r = G.analyze('Name\tQ1\tQ2\nPoints possible\t4\t2\nAda\t2\t2\nBo\t4\t1');
  ok(r.maxGiven && r.questions[0].max === 4 && r.questions[1].max === 2, 'points row read');
  ok(near(r.questions[0].pct, 0.75) && near(r.questions[1].pct, 0.75), 'percent against the stated maximum');
  ok(r.students === 2, 'the points row is not a student');

  // 4. blank = not attempted
  r = G.analyze('Name,Q1,Q2\nAda,1,\nBo,0,1\nCy,1,1');
  ok(r.questions[1].n === 2 && r.questions[0].n === 3, 'a blank cell leaves the student out of that question');
  ok(near(r.questions[1].pct, 1), 'percent over the attempted only');

  // 5. unreadable, negative and over-maximum cells are named by line, never guessed
  r = G.analyze('Name,Q1,Q2\nMax,4,2\nAda,x,2\nBo,-1,3\nCy,4,1');
  ok(r.problems.length === 3, 'three cells named: ' + r.problems.length);
  ok(r.problems.some(p => p.line === 3 && p.label === 'Q1' && /not a number/.test(p.why)), 'the x is named with its line and column');
  ok(r.problems.some(p => p.line === 4 && /negative/.test(p.why)), 'the negative is named');
  ok(r.problems.some(p => p.line === 4 && p.label === 'Q2' && /over the 2/.test(p.why)), 'the over-maximum is named');
  ok(r.questions[0].n === 1 && r.questions[1].n === 2, 'those cells are left out of n');

  // 6. all-zero column is out of 1; a column nobody attempted is left out of the order
  r = G.analyze('Name,Q1,Q2\nAda,0,\nBo,0,');
  ok(r.questions[0].max === 1 && r.questions[0].pct === 0, 'all-zero column is out of 1');
  ok(r.questions[1].n === 0 && r.questions[1].pct === null && r.order.join() === '0', 'unattempted question stays out of the order');

  // 7. tiers at the line and at the edge of the band
  ok(G.tier(0.69, 70) === 'reteach' && G.tier(0.70, 70) === 'watch', 'reteach below the line, watch at it');
  ok(G.tier(0.799, 70) === 'watch' && G.tier(0.80, 70) === 'secure', 'watch ends 10 points above the line');
  ok(G.tier(0.45, 40) === 'watch' && G.tier(0.5, 60) === 'reteach', 'the line moves the tiers');
  ok(G.tier(0.7) === 'watch', 'no line given: 70');

  // 8. chart data is percent MISSED in question order
  r = G.analyze('Name,Q1,Q2\nAda,1,0\nBo,1,0\nCy,0,0\nDi,1,1');
  const ch = G.chart(r);
  ok(ch.categories.join() === 'Q1,Q2' && ch.series[0].values.join() === '25,75', 'chart: Q1 25% missed, Q2 75% missed, in question order');
  ok(G.chart(G.analyze('Name,Q1,Q2\nAda,1,\nBo,1,')).categories.join() === 'Q1', 'chart leaves out a question nobody attempted');

  // 9. empty, headers only, a name column and nothing else
  ok(G.analyze('').questions.length === 0, 'empty paste');
  ok(G.analyze('Name\nAda\nBo').questions.length === 0, 'a name column alone has no questions');

  // 10. ragged lines are named
  r = G.analyze('Name,Q1,Q2\nAda,1,1\nBo,1');
  ok(r.ragged.length === 1 && r.ragged[0].line === 3, 'the short line is named');

  // 11. a comma paste and a tab paste agree; a percent sign and a stray space are tolerated
  const a = G.analyze('Name,Q1\nAda,50%\nBo,100%'), b = G.analyze('Name\tQ1\nAda\t50 %\nBo\t100%');
  ok(near(a.questions[0].pct, b.questions[0].pct) && near(a.questions[0].pct, 0.75), 'delimiters agree');

  // 12. no student name reaches the result
  ok(!JSON.stringify(G.analyze('Name,Q1\nZelda Quimby,1\nBo,0')).includes('Zelda'), 'no name in the result');

  // 13. section against section: matched by question label, gap in points, flag at 15
  const A = G.analyze('Name,Q1,Q2,Q3\nAda,1,1,1\nBo,1,1,0\nCy,1,0,1\nDi,1,1,1');
  const B = G.analyze('Name,Q1,Q2,Q4\nEd,1,0,1\nFi,0,0,1\nGu,1,0,0\nHa,1,1,1');
  const cmp = G.compare([{ label: '3rd', res: A }, { label: '6th', res: B }]);
  ok(cmp.labels.join() === '3rd,6th', 'section labels kept in order');
  ok(cmp.rows.map(r => r.label).join() === 'Q1,Q2,Q3,Q4', 'questions in order of first appearance, union of both');
  ok(cmp.rows[0].pcts.join() === '100,75' && cmp.rows[0].gap === 25 && cmp.rows[0].flagged, 'Q1: 100 vs 75 is a 25-point gap, flagged');
  ok(cmp.rows[1].pcts.join() === '75,25' && cmp.rows[1].gap === 50, 'Q2: 75 vs 25');
  ok(cmp.rows[2].pcts.join() === '75,' && cmp.rows[2].pcts[1] === null && cmp.rows[2].gap === null && !cmp.rows[2].flagged, 'Q3 only in one section: no gap');
  ok(cmp.rows[3].pcts[0] === null && cmp.rows[3].pcts[1] === 75, 'Q4 only in the second');
  const C = G.analyze('Name,Q1\nAda,0.86\nBo,1');
  const D = G.analyze('Name,Q1\nAda,0.7\nBo,1');
  ok(G.compare([{ label: 'a', res: C }, { label: 'b', res: D }]).rows[0].gap === 8 && !G.compare([{ label: 'a', res: C }, { label: 'b', res: D }]).flagged, 'an 8-point gap is not flagged');
  ok(G.compare([{ label: 'a', res: A }, { label: 'b', res: A }]).rows.every(r => r.gap === 0), 'the same section twice: no gap');
  return bad;
}

const MUTANTS = [
  ['percent against 100 not the maximum', s => s.replace('pct: n ? mean / max : null', 'pct: n ? mean / 100 : null')],
  ['ties in reverse question order', s => s.replace('a.pct - b.pct || a.index - b.index', 'a.pct - b.pct || b.index - a.index')],
  ['order highest first', s => s.replace('a.pct - b.pct || a.index', 'b.pct - a.pct || a.index')],
  ['blank counted as zero', s => s.replace("if (raw === '' || raw == null) continue;", 'if (raw == null) continue; if (raw === "") raw = "0";')],
  ['over-maximum kept', s => s.replace('if (stated && x.v > max) {', 'if (false) {')],
  ['band 5 not 10', s => s.replace('var WATCH_BAND = 10;', 'var WATCH_BAND = 5;')],
  ['at the line is reteach', s => s.replace('if (p < l) return', 'if (p <= l) return')],
  ['points row is a student', s => s.replace('MAX_ROW.test(r.cells[0]) &&', 'false &&')],
  ['chart shows percent correct', s => s.replace('(1 - q.pct) * 1000', 'q.pct * 1000')],
  ['name column not detected', s => s.replace('var first = hasNames ? 1 : 0;', 'var first = 0;')],
  ['gap not flagged', s => s.replace('gap >= GAP_FLAG', 'gap > 100')],
  ['gap in the wrong unit', s => s.replace('Math.round((Math.max.apply(null, have) - Math.min.apply(null, have)) * 10) / 10', '0')],
  ['questions matched by position', s => s.replace('x.label === label &&', 'true &&')],
  ['negative accepted', s => s.replace('v === null || v < 0', 'v === null')]
];

let failed = 0;
const base = check(load());
if (base.length) { failed++; base.forEach(m => console.log('  FAIL ' + m)); }
else console.log('  ok  gd-items cases');
for (const [name, m] of MUTANTS) {
  const bad = check(load(m));
  if (bad.length) console.log('  ok  mutant caught: ' + name);
  else { failed++; console.log('  FAIL mutant survived: ' + name); }
}
console.log(failed ? `${failed} FAILED` : 'gd-items: all passed');
process.exit(failed ? 1 : 0);
