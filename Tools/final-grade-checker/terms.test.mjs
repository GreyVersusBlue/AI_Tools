// terms.test.mjs — the term count (2 semesters, 3 trimesters, 4 quarters) in the pure modules.
//
//   node Tools/final-grade-checker/terms.test.mjs
//
// Hand-worked cases only; every name is invented. Default (no `terms`) must be the four-quarter
// behaviour grade-math.test.mjs and scenario-math.test.mjs already pin.
import {
  calcFinals, parsePastedData, findQuarterWindow, termsOf, termLabel, termNoun,
  requiredScoreForQuarter, triageStudent,
} from './grade-math.mjs';
import { cleanScenario, checkWeights, applyScenario, compareClass, describeScenario, classTops } from './scenario-math.mjs';

let passed = 0, failed = 0;
const eq = (a, b, what) => {
  if (JSON.stringify(a) === JSON.stringify(b)) { passed++; return; }
  failed++; console.log(`  FAIL ${what}\n     want ${JSON.stringify(b)}\n     got  ${JSON.stringify(a)}`);
};

// termsOf: only 2, 3, 4 are terms; anything else is the old four
eq([undefined, null, 1, 5, 2.5, '3', 2, 3, 4].map(t => termsOf({ terms: t })), [4, 4, 4, 4, 4, 4, 2, 3, 4], 'termsOf');
eq(termsOf(), 4, 'termsOf with no opts');
eq([termLabel(0, 4), termLabel(2, 3), termLabel(1, 2), termLabel(3)], ['Q1', 'T3', 'S2', 'Q4'], 'labels');
eq([2, 3, 4].map(termNoun), ['semester', 'trimester', 'quarter'], 'nouns');

// calcFinals: needs exactly N terms, weights must be N long
eq(calcFinals([90, 80], { terms: 2 }).finalLetter, 'A', 'two semesters 90 and 80: QP 3.5 -> A, pct 85 -> B, the higher is reported');
eq(calcFinals([90, 80], { terms: 2 }) && calcFinals([90, 80], { terms: 2 }).pctAvg, 85, 'two-semester average');
eq(calcFinals([90, null], { terms: 2 }), null, 'a missing semester gives no final');
eq(calcFinals([90, 80, 70], { terms: 3 }).pctAvg, 80, 'three-trimester average');
eq(calcFinals([90, 80, 70], { terms: 3, weights: [1, 1, 2] }).pctAvg, 77.5, 'trimester weights');
eq(calcFinals([90, 80, 70], { terms: 3, weights: [1, 1, 1, 1] }).pctAvg, 80, 'four weights on three terms are ignored, as a wrong-length list was before');
eq(calcFinals([90, 80, 70], {}), null, 'three scores are not a year of four');
eq(calcFinals([90, 80, 70, 60, 50], { terms: 4 }).pctAvg, 75, 'a fifth score is not read');
eq(calcFinals([90, 80, 70, 60]).pctAvg, 75, 'default is four quarters');

// paste window
const row3 = ['1', 'Ada Placeholder', 'S1', '7', 'A(95.00)', 'B(85.00)', 'C(75.00)', '85.00'].join('\t');
const p3 = parsePastedData(row3, { terms: 3 });
eq(p3.students.map(s => s.scores), [[95, 85, 75]], 'trimester paste, three scores');
eq(p3.warnings, [], 'no warnings on a clean trimester row');
eq(parsePastedData(row3).students[0].scores, [95, 85, 75, 85], 'the same row read as quarters takes the bare average as Q4 (the default, unchanged)');
const row2 = ['1', 'Bo Notreal', 'S1', '7', 'A(95.00)', '', '92.00'].join('\t');
const p2 = parsePastedData(row2, { terms: 2 });
eq(p2.students[0].scores, [95, null], 'semester row, one blank');
eq(p2.warnings, ['Row 1 (Bo Notreal): 1 semester(s) missing, so no final grade'], 'semester wording');
eq(parsePastedData('1\tCy\tS1\t7\tA(9', { terms: 2 }).warnings[0], 'Row 1: 5 column(s), need at least 6 (skipped)', 'min columns follows terms');
const bad = parsePastedData(['1', 'Di Madeup', 'S1', '7', 'A(95.00)', 'oops'].join('\t'), { terms: 2 });
eq(bad.warnings[0], 'Row 1 (Di Madeup): S2 reads "oops", which is not a grade, so it counts as missing', 'term label in the not-a-grade note');
eq(findQuarterWindow(['x', 'A(1)', 'B(2)', 'C(3)'], 3), { start: 1, matches: 3, moved: true }, 'window of 3 found at 1');
eq(parsePastedData(row3, { terms: 3, q1Col: 4 }).students[0].scores, [95, 85, 75], 'explicit first-term column with terms');

// triage and the single-term solver follow the count
eq(requiredScoreForQuarter([90, null], 1, 'A', { terms: 2 }).requiredPct, 89, 'solve the second semester for an A: (89.5*2-90)/1');
eq(requiredScoreForQuarter([90, 80], 2, 'A', { terms: 2 }), null, 'term index past the count');
const tri = triageStudent([95, 60, 90], { terms: 3 });
eq(tri.oneAway && tri.oneAway.quarterIdx, 1, 'one-away names the lowest of three');

// scenario
eq(cleanScenario({ dropN: 2 }, 3).problems, [], 'drop 2 of 3 is allowed');
eq(cleanScenario({ dropN: 2 }, 2).problems, ['Drop must be 0 to 1.'], 'drop 2 of 2 is refused');
eq(cleanScenario({ curve: { mode: 'plus', points: 100, apply: 2 } }, 2).scenario.curve.apply, 'all', 'apply past the count is every term');
eq(checkWeights([1, 2, 3], 3).ok, true, 'three weights for three terms');
eq(checkWeights([1, 2, 3, 4], 3).reason, 'There must be three weights.', 'four weights for three terms');
eq(checkWeights([1, 2, 3, 4]).ok, true, 'default four');
eq(classTops([{ scores: [90, 70] }, { scores: [80, 95] }], 2), [9000, 9500], 'tops for two terms');
const ctx = { terms: 2, tops: [9000, 9500] };
eq(applyScenario([90, 70], { dropN: 1, curve: { mode: 'none' }, weights: null }, ctx).dropped, [1], 'drop the lower semester');
eq(applyScenario([90, 70], { dropN: 1, curve: { mode: 'none' }, weights: null }, ctx).final.pctAvg, 90, 'one semester stands in the average');
eq(applyScenario([90, null], null, ctx).reason, 'missing', 'a missing semester');
const cmp = compareClass([{ name: 'Eve Invented', scores: [80, 90] }, { name: 'Fay Madeup', scores: [60, 70, 99] }], { dropN: 0, curve: { mode: 'plus', points: 500, apply: 'all', extra: false }, weights: null }, { terms: 2 });
eq(cmp.rows.map(r => [r.before.pctAvg, r.after.pctAvg]), [[85, 90], [65, 70]], 'class compare on two semesters; a third score is ignored');
eq(describeScenario({ dropN: 1, curve: { mode: 'none' }, weights: [100, 200] }, 2), 'Then, in this order: drop each student’s lowest semester; weights 1 / 2.', 'words follow the noun');
eq(describeScenario({ dropN: 0, curve: { mode: 'plus', points: 300, apply: 1, extra: false }, weights: null }, 3), 'Then, in this order: add 3 points on T2; scores stop at 100.', 'words name T2');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
