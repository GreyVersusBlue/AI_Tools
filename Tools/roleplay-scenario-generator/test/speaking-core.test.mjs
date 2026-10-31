// speaking-core.test.mjs — the rules of 014's speaking record, pure Node.
//   node Tools/roleplay-scenario-generator/test/speaking-core.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'speaking.js'), 'utf8');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
const S = ctx.RpSpeaking;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Speaking record — core rules');

// normalize: junk never throws and always yields a usable record
for (const junk of [null, undefined, 5, 'x', [], {}, { criteria: 'a', marks: 'b' }, { criteria: [], marks: [null, 3, {}] }]) {
  const r = S.normalize(junk);
  eq(r.criteria, S.DEFAULT_CRITERIA, 'junk gets the default criteria: ' + JSON.stringify(junk));
  eq(r.marks, [], 'junk has no marks: ' + JSON.stringify(junk));
}
ok(S.normalize(null).criteria !== S.DEFAULT_CRITERIA, 'a fresh record does not alias the defaults');

// criteria cleaning
eq(S.cleanCriteria(['  a  b ', '', 'a b', 'c']), ['a b', 'c'], 'criteria are trimmed, squeezed, de-duplicated');
eq(S.cleanCriteria(['1', '2', '3', '4', '5', '6', '7', '8']).length, 6, 'at most six criteria');
eq(S.cleanCriteria(['x'.repeat(200)])[0].length, 80, 'a criterion is cut at 80 characters');
eq(S.cleanCriteria('not an array'), [], 'a non-array gives none');

// dates
ok(S.validDate('2026-10-12'), 'a real date is valid');
ok(!S.validDate('2026-02-30'), 'Feb 30 is not');
ok(!S.validDate('2026-1-2') && !S.validDate(20261012) && !S.validDate(''), 'other shapes are not');

// addMark
const rec = S.normalize({ criteria: ['A', 'B', 'C'] });
const m1 = S.addMark(rec, { date: '2026-10-12', scenario: 'so5', title: 'Catching Up', students: ['Ana', 'Ben'], scores: { A: 3, C: 4 } });
ok(m1 && m1.id === 'm1', 'first mark gets id m1');
eq(m1.scores, [{ c: 'A', v: 3 }, { c: 'C', v: 4 }], 'only tapped criteria are stored, in rubric order');
eq(rec.marks.length, 1, 'the mark is in the record');
ok(S.addMark(rec, { date: '2026-10-12', students: [], scores: { A: 1 } }) === null, 'nobody to score is refused');
ok(S.addMark(rec, { date: '2026-10-12', students: ['Ana'], scores: {} }) === null, 'nothing scored is refused');
ok(S.addMark(rec, { date: '2026-10-12', students: ['Ana'], scores: { A: 5 } }) === null, 'level 5 is refused');
ok(S.addMark(rec, { date: '2026-10-12', students: ['Ana'], scores: { A: 0 } }) === null, 'level 0 is refused');
ok(S.addMark(rec, { date: '2026-10-12', students: ['Ana'], scores: { A: 2.5 } }) === null, 'a fraction is refused');
ok(S.addMark(rec, { date: '2026-10-12', students: ['Ana'], scores: { Z: 2 } }) === null, 'a criterion not on the rubric is ignored');
ok(S.addMark(rec, { date: 'tomorrow', students: ['Ana'], scores: { A: 2 } }) === null, 'a bad date is refused');
eq(rec.marks.length, 1, 'refusals add nothing');
S.addMark(rec, { date: '2026-10-13', scenario: 'sc1', title: 'Help', students: ['Ana', 'Cam'], scores: { A: 1, B: 2 } });
ok(rec.marks[1].id === 'm2', 'ids count up');
S.undoLast(rec); S.addMark(rec, { date: '2026-10-14', students: ['Ben'], scores: { B: 4 } });
ok(rec.marks[1].id === 'm2', 'an id freed by Undo is reused, never doubled');

// per-student view
eq(S.marksFor(rec, 'Ana').length, 1, 'Ana is on one mark');
eq(S.marksFor(rec, 'Ben').length, 2, 'Ben is on two');
eq(S.marksFor(rec, 'Zed').length, 0, 'a stranger on none');
const sm = S.summary(rec, 'Ben');
eq(sm.averages, [{ c: 'A', avg: 3, n: 1 }, { c: 'C', avg: 4, n: 1 }, { c: 'B', avg: 4, n: 1 }], 'averages by criterion, first-seen order');
eq(sm.overall, 3.7, 'overall average to one place');
eq(S.summary(rec, 'Zed'), { marks: 0, averages: [], overall: null }, 'an unmarked student has an empty summary');
// the summary is built from the wording used at the time
rec.criteria = ['A2'];
eq(S.summary(rec, 'Ana').averages[0].c, 'A', 'renaming a criterion later does not rewrite old marks');
// nothing of another pair leaks into a student's marks
ok(S.marksFor(rec, 'Ana').every(m => m.students.includes('Ana')), "a student's marks all name them");

// studentsWithMarks
eq(S.studentsWithMarks(rec, ['Ben', 'Ana', 'Dee']), ['Ben', 'Ana'], 'roster order, only those with marks');
eq(S.studentsWithMarks(rec, ['Ana']), ['Ana', 'Ben'], 'someone off the roster still appears, after');

// normalize round trip drops bad marks but keeps good ones
const stored = JSON.parse(JSON.stringify({ criteria: rec.criteria, marks: rec.marks.concat([{ id: 'x', date: 'bad', students: ['Q'], scores: [{ c: 'A', v: 2 }] }]) }));
eq(S.normalize(stored).marks.length, 2, 'a stored mark with a bad date is dropped on load');
ok(S.levelLabel(3) === 'Proficient' && S.levelLabel(9) === '', 'level labels');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
