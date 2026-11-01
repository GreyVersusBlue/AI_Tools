// nsc-assess.test.mjs — 027's discussion assessment arithmetic, in pure Node.
//
//   node Tools/novel-study-circles-manager/test/nsc-assess.test.mjs   (npm run test:nsc-assess-core)
//
// nsc-assess.js stores nothing and draws nothing. Held here: the tap cycle, that a meeting never assessed stays
// without an `assess` field, that clearing the last mark takes the field off again, that a hostile or half-formed
// stored list is read as only its well-formed rows (a student called "__proto__" is just a string), the totals over
// meetings with the unmarked boxes not counted as zeros, and a rename. NSC_FILE points at another copy (the
// deliberate-break runs use it). Every name is invented. Exits 1 on any failure.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.NSC_FILE || path.join(here, '..', 'nsc-assess.js');
await import(pathToFileURL(file).href);
const A = globalThis.NscAssess;

let passed = 0, failed = 0;
const ok = (c, l) => { if (c) passed++; else { failed++; console.log('  FAIL ' + l); } };
const same = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const meeting = (names, extra = {}) => ({ id: 'm', date: '2026-10-01', groups: [{ assignment: names.map(n => ({ name: n, role: 'x' })) }], ...extra });

console.log('Discussion assessment — cycle, rows, totals');

// the tap cycle
same([A.next(undefined), A.next(2), A.next(1), A.next(0)], [2, 1, 0, undefined], 'blank, yes, some, not yet, blank');
same([A.next(null), A.next('2'), A.next(7), A.next(NaN)], [2, 2, 2, 2], 'anything that is not a level starts the cycle again at yes');

// a meeting never assessed
const m = meeting(['Ann', 'Ben', 'Cy']);
same(Object.keys(m).includes('assess'), false, 'a fresh meeting has no assess field');
same(A.studentsOf(meeting(['Ann', 'Ann', 'Ben'])), ['Ann', 'Ben'], 'students are listed once each, in order');
same(A.studentsOf({}), [], 'a meeting with no groups has no students');

// set and clear
ok(A.set(m, 'Ann', 'participated', 2), 'set returns true');
same(m.assess, [{ name: 'Ann', participated: 2 }], 'one mark makes one row');
A.set(m, 'Ann', 'prepared', 0);
same(m.assess, [{ name: 'Ann', participated: 2, prepared: 0 }], 'a zero is kept: not yet is a mark, not a blank');
same(A.levelOf(m, 'Ann', 'prepared'), 0, 'and reads back as 0');
same(A.levelOf(m, 'Ann', 'advanced'), undefined, 'a box not marked reads back as undefined');
same(A.levelOf(m, 'Ben', 'prepared'), undefined, 'a student not marked reads back as undefined');
A.set(m, 'Ann', 'participated', undefined);
A.set(m, 'Ann', 'prepared', undefined);
same(Object.keys(m).includes('assess'), false, 'clearing the last mark takes the field off the meeting');
ok(A.set(m, 'Ben', 'advanced', undefined), 'clearing what was never set is fine');
same(Object.keys(m).includes('assess'), false, 'and adds nothing');
same([A.set(m, 'Ann', 'bogus', 1), A.set(m, 'Ann', 'prepared', 3), A.set(m, '', 'prepared', 1), A.set(null, 'Ann', 'prepared', 1)], [false, false, false, false], 'a bad criterion, level, name or meeting is refused');
same(Object.keys(m).includes('assess'), false, 'and changes nothing');

// hostile stored data
const bad = meeting(['Ann'], { assess: [null, 5, 'x', { name: 7 }, { name: '' }, { name: 'Ann', participated: 9, prepared: '2', advanced: 1 }, { name: 'Ann', participated: 2 }, { name: '__proto__', participated: 2 }, { name: 'constructor', prepared: 0 }] });
same(A.rowsOf(bad), [{ name: 'Ann', advanced: 1 }, { name: '__proto__', participated: 2 }, { name: 'constructor', prepared: 0 }], 'only well-formed rows survive, the first row for a name wins, and out-of-range levels are dropped');
same(Object.prototype.participated, undefined, 'and nothing was written to Object.prototype');
same(A.rowsOf({ assess: 'nope' }), [], 'an assess that is not a list reads as none');
same(A.rowsOf(null), [], 'so does a missing meeting');
A.set(bad, 'Ann', 'participated', 1);
same(A.rowsOf(bad).find(r => r.name === 'Ann'), { name: 'Ann', participated: 1, advanced: 1 }, 'setting on a meeting with a messy list cleans it');

// summary
const m1 = meeting(['Ann', 'Ben'], { id: 'm1' }), m2 = meeting(['Ann', 'Ben'], { id: 'm2' }), m3 = meeting(['Ann', 'Ben'], { id: 'm3' });
A.set(m1, 'Ann', 'participated', 2); A.set(m1, 'Ann', 'prepared', 2); A.set(m1, 'Ann', 'advanced', 1);
A.set(m1, 'Ben', 'participated', 0);
A.set(m2, 'Ann', 'participated', 1); A.set(m2, 'Ben', 'participated', 2); A.set(m2, 'Ben', 'prepared', 2);
const sum = A.summary([m3, m2, m1]);   // newest first, as the page keeps them; m3 was never assessed
same(sum.meetings, 2, 'a meeting with no marks is not counted as assessed');
same(sum.students.map(s => s.name), ['Ann', 'Ben'], 'students in alphabetical order');
const ann = sum.students[0], ben = sum.students[1];
same([ann.points, ann.possible, ann.meetings], [2 + 2 + 1 + 1, 8, 2], 'Ann: points over the boxes marked (4 boxes... 2+2+1 and 1 = 6 of 8)'.replace('4 boxes... 2+2+1 and 1 = 6 of 8', 'six points of eight'));
same(ann.criteria.participated, { yes: 1, some: 1, no: 0, assessed: 2 }, 'Ann participated: one yes, one some, of two');
same(ann.criteria.advanced, { yes: 0, some: 1, no: 0, assessed: 1 }, 'Ann advanced: assessed once');
same([ben.points, ben.possible], [4, 6], 'Ben: a not-yet adds 0 to the points and 2 to the possible; an unmarked box adds neither');
same(ben.criteria.participated, { yes: 1, some: 0, no: 1, assessed: 2 }, 'Ben participated: one yes, one not yet');
same(ben.criteria.advanced.assessed, 0, 'Ben advanced: never assessed');
same(A.summary([]).students, [], 'no meetings, no students');
same(A.summary(undefined).meetings, 0, 'not a list, none');
const lone = meeting(['Ann'], { assess: [{ name: 'Ann' }] });
same(A.summary([lone]).meetings, 0, 'a row with no criterion marked is not an assessment');

// rename
const r = meeting(['Ann', 'Ben']);
A.set(r, 'Ann', 'prepared', 2); A.set(r, 'Ben', 'prepared', 1);
ok(A.rename(r, 'Ann', 'Anna'), 'a rename moves the row');
same(A.rowsOf(r).map(x => x.name), ['Anna', 'Ben'], 'and keeps its place');
same(A.rename(r, 'Anna', 'Ben'), false, 'a rename onto a name that already has a row is refused');
same(A.rowsOf(r).map(x => x.name), ['Anna', 'Ben'], 'and nothing moved');
same(A.rename(meeting(['Ann']), 'Ann', 'Anna'), false, 'a meeting with no assessment has nothing to rename');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
