// grade-math.test.mjs — hand-worked cases for the Carroll County final grade.
//
//   node Tools/final-grade-checker/grade-math.test.mjs
//
// Exits 1 on any failure (locked decision #13). Every case here was watched
// failing against a deliberately broken calculation before it was kept
// (locked decision #34) — see BREAKAGE LOG at the bottom.
//
// No real student appears in this file. Every name is invented.

import {
  getLetter, getQP, qpToFinalLetter, calcFinals, toScore,
  parseGradeToken, splitRow, parsePastedData, findQuarterWindow, isGradeCell,
  LETTER_CUTOFFS_STRICT, QP_CUTOFFS_STRICT,
} from './grade-math.mjs';

let passed = 0, failed = 0;
const fails = [];

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++; fails.push(`${what}\n       expected ${e}\n       got      ${a}`);
}
function group(name) { console.log(`\n${name}`); }

// ── Rule 3: the ten-point scale ──────────────────────────────
group('Rule 3 — ten-point scale');
eq(getLetter(100), 'A', '100 is an A');
eq(getLetter(90),  'A', '90 is an A');
eq(getLetter(89),  'B', '89 is a B');
eq(getLetter(80),  'B', '80 is a B');
eq(getLetter(79),  'C', '79 is a C');
eq(getLetter(70),  'C', '70 is a C');
eq(getLetter(69),  'D', '69 is a D');
eq(getLetter(60),  'D', '60 is a D');
eq(getLetter(59),  'F', '59 is an F');
eq(getLetter(0),   'F', '0 is an F');

// ── Rule 4: round up at exactly .5, and not before ───────────
group('Rule 4 — .5 rounds up, .49 does not');
eq(getLetter(89.5),  'A', '89.5 rounds up to an A');
eq(getLetter(79.5),  'B', '79.5 rounds up to a B');
eq(getLetter(69.5),  'C', '69.5 rounds up to a C');
eq(getLetter(59.5),  'D', '59.5 rounds up to a D — the pass/fail line');
eq(getLetter(89.51), 'A', '89.51 is an A');
eq(getLetter(89.49), 'B', '89.49 is a B');
eq(getLetter(89.45), 'B', '89.45 is a B, not an A (old code said A)');
eq(getLetter(79.45), 'C', '79.45 is a C, not a B (old code said B)');
eq(getLetter(69.45), 'D', '69.45 is a D, not a C (old code said C)');
eq(getLetter(59.45), 'F', '59.45 is an F, not a D (old code passed a failing student)');
eq(getLetter(59.499), 'F', '59.499 is still an F');

// The floating-point half of rule 4. Each of these has an exact mean of 89.5
// but evaluates to 89.49999999999999 in IEEE 754. A bare `>= 89.5` marks them
// all a B and costs a letter grade.
group('Rule 4 — a computed .5 that floating point puts just below');
const fpBoundary = [
  [58.80, 99.99, 99.25, 99.96],
  [59.43, 99.99, 99.25, 99.33],
  [60.18, 99.99, 99.25, 98.58],
];
for (const s of fpBoundary) {
  const raw = (s[0] + s[1] + s[2] + s[3]) / 4;
  eq(raw < 89.5, true, `${JSON.stringify(s)} really does land below 89.5 in floating point (${raw})`);
  eq(getLetter(raw), 'A', `${JSON.stringify(s)} mean is an A despite the float error`);
  eq(calcFinals(s).pctFinal, 'A', `${JSON.stringify(s)} percentage method is an A`);
}

// ── Rule 1 + 2: two figures, the higher one reported ─────────
group('Rule 1 — both figures get computed');
{
  const f = calcFinals([90, 90, 60, 60]);
  eq(f.avgQP, 2.5, 'quality points average is 2.5 (A,A,D,D = 4+4+1+1 / 4)');
  eq(f.pctAvg, 75, 'percentage average is 75');
  eq(f.qpFinal, 'B', 'quality points gives a B');
  eq(f.pctFinal, 'C', 'percentage gives a C');
}

group('Rule 2 — the HIGHER of the two is reported');
// Worked by hand:
//   Q1 90 A=4   Q2 90 A=4   Q3 60 D=1   Q4 60 D=1
//   quality points 10/4 = 2.50 -> B
//   percentage    300/4 = 75.00 -> C
//   B beats C, so the student gets a B.
// This is the case that separates a correct tool from one that always reports
// the percentage average.
eq(calcFinals([90, 90, 60, 60]).winner, 'QP', 'quality points wins when it is higher');
eq(calcFinals([90, 90, 60, 60]).finalLetter, 'B', 'and the B is what gets reported');

//   Q1 79 C=2   Q2 79 C=2   Q3 100 A=4   Q4 100 A=4
//   quality points 12/4 = 3.00 -> B
//   percentage    358/4 = 89.50 -> A   (and note the .5)
//   A beats B, so the student gets an A.
eq(calcFinals([79, 79, 100, 100]).qpFinal,  'B',   'quality points gives a B');
eq(calcFinals([79, 79, 100, 100]).pctAvg,   89.5,  'percentage average is exactly 89.5');
eq(calcFinals([79, 79, 100, 100]).pctFinal, 'A',   'percentage gives an A');
eq(calcFinals([79, 79, 100, 100]).winner,   'PCT', 'percentage wins when it is higher');
eq(calcFinals([79, 79, 100, 100]).finalLetter, 'A', 'and the A is what gets reported');

//   A tie: 85 four times. Both methods give a B. Either winner is the same letter.
eq(calcFinals([85, 85, 85, 85]).finalLetter, 'B', 'a tie reports the shared letter');

//   Quality points wins at the pass/fail line.
//   Q1 70 C=2  Q2 70 C=2  Q3 30 F=0  Q4 70 C=2
//   quality points 6/4 = 1.50 -> C
//   percentage   240/4 = 60.00 -> D
eq(calcFinals([70, 70, 30, 70]).qpFinal,     'C', 'quality points gives a C');
eq(calcFinals([70, 70, 30, 70]).pctFinal,    'D', 'percentage gives a D');
eq(calcFinals([70, 70, 30, 70]).finalLetter, 'C', 'the higher, C, is reported');

//   A failing final either way.
eq(calcFinals([50, 55, 40, 58]).qpFinal,     'F', 'four Fs give an F by quality points');
eq(calcFinals([50, 55, 40, 58]).pctFinal,    'F', 'and an F by percentage');
eq(calcFinals([50, 55, 40, 58]).finalLetter, 'F', 'reported F');

//   One quarter carries a student over the line by quality points only.
//   Q1 59 F=0  Q2 60 D=1  Q3 60 D=1  Q4 60 D=1
//   quality points 3/4 = 0.75 -> D
//   percentage   239/4 = 59.75 -> D
eq(calcFinals([59, 60, 60, 60]).finalLetter, 'D', '59.75 average is a D, the student passes');
//   Drop Q1 by two points: 237/4 = 59.25 -> F by percentage, still D by quality points.
eq(calcFinals([57, 60, 60, 60]).pctFinal,    'F', '59.25 average fails by percentage');
eq(calcFinals([57, 60, 60, 60]).qpFinal,     'D', 'but quality points still gives a D');
eq(calcFinals([57, 60, 60, 60]).finalLetter, 'D', 'the county rule passes this student');

// ── Quality-point thresholds ─────────────────────────────────
group('Quality points — every reachable average');
eq(getQP('A'), 4, 'A is 4 points'); eq(getQP('B'), 3, 'B is 3 points');
eq(getQP('C'), 2, 'C is 2 points'); eq(getQP('D'), 1, 'D is 1 point');
eq(getQP('F'), 0, 'F is 0 points'); eq(getQP('Z'), null, 'nothing else is a letter');
// Averages of four integers 0-4 are multiples of 0.25 and exact in floating
// point, so this table is the complete set of inputs the method can produce.
const qpTable = [
  [4.00,'A'],[3.75,'A'],[3.50,'A'],[3.25,'B'],[3.00,'B'],[2.75,'B'],[2.50,'B'],
  [2.25,'C'],[2.00,'C'],[1.75,'C'],[1.50,'C'],[1.25,'D'],[1.00,'D'],[0.75,'D'],
  [0.50,'D'],[0.25,'F'],[0.00,'F'],
];
for (const [avg, letter] of qpTable) eq(qpToFinalLetter(avg), letter, `quality-point average ${avg.toFixed(2)} is a ${letter}`);

// ── Missing and exempt quarters ──────────────────────────────
group('Missing or exempt quarters');
eq(calcFinals([90, 90, 90, null]), null, 'three quarters gives no final grade');
eq(calcFinals([90, 90, null, null]), null, 'two quarters gives no final grade');
eq(calcFinals([null, null, null, null]), null, 'no quarters gives no final grade');
eq(calcFinals([90, 90, 90, '']), null, 'an empty string is a missing quarter');
eq(calcFinals([90, 90, 90, 'exempt']), null, 'an unreadable quarter is a missing quarter');
eq(calcFinals([90, 90, 90, 90]).finalLetter, 'A', 'four quarters gives a final grade');
// Three high quarters must not average to a final grade on their own.
eq(calcFinals([100, 100, 100, null]), null, 'three 100s still gives no final grade');

// ── Out-of-range input never reaches the arithmetic ──────────
group('Out-of-range input');
eq(toScore(101), null, '101 is not a percentage');
eq(toScore(-1), null, 'a negative is not a percentage');
eq(toScore('abc'), null, 'text is not a percentage');
eq(toScore(100), 100, '100 is fine');
eq(toScore(0), 0, '0 is fine');
eq(getLetter(950), null, 'a stray 950 gets no letter');
eq(calcFinals([950, 96, 97, 98]), null, 'and it does not become a fourth quarter');
eq(parseGradeToken('A(950.00)'), null, 'a 950 in a paste is rejected');

// ── Paste import ─────────────────────────────────────────────
group('Paste import — token parsing');
eq(parseGradeToken('C(73.28)'), 73.28, 'C(73.28) reads as 73.28');
eq(parseGradeToken('A(100.00)'), 100, 'A(100.00) reads as 100');
eq(parseGradeToken('84'), 84, 'a bare number reads as itself');
eq(parseGradeToken(''), null, 'an empty cell is missing');
eq(parseGradeToken('   '), null, 'a whitespace cell is missing');
eq(parseGradeToken(undefined), null, 'an absent cell is missing');
eq(isGradeCell('B(84.00)'), true, 'B(84.00) is a grade cell');
eq(isGradeCell('88.25'), false, 'the system average column is not a grade cell');
eq(isGradeCell('7'), false, 'the grade-level column is not a grade cell');

group('Paste import — empty cells keep their column');
// THE HEADLINE CASE. Bartholomew has no Q1. Tab-separated, so the empty cell
// is really there. The old parser filtered empty columns out, which shifted
// Q2 into Q1, Q3 into Q2, Q4 into Q3, and the system-average column into Q4 —
// then reported a confident A for a student with three quarters on file.
{
  const paste =
    '123456\tAmelia Fakename\tSS7-3\t7\tB(85.00)\tB(84.00)\tA(91.00)\tA(93.00)\t88.25\n' +
    '123457\tBartholomew Notreal\tSS7-3\t7\t\tB(84.00)\tA(91.00)\tA(93.00)\t89.33';
  const { students, warnings } = parsePastedData(paste);
  eq(students.length, 2, 'both rows import');
  eq(students[0].scores, [85, 84, 91, 93], 'Amelia keeps her four quarters');
  eq(students[1].scores, [null, 84, 91, 93], 'Bartholomew keeps his empty Q1');
  eq(calcFinals(students[1].scores), null, 'and gets no final grade');
  eq(warnings.some(w => /Bartholomew/.test(w) && /1 quarter\(s\) missing/.test(w)), true,
     'and the missing quarter is warned about');
  eq(students[1].scores.includes(89.33), false,
     'the system-average column never becomes a quarter grade');
}

group('Paste import — column guards');
{
  // Six columns passed the old `< 6` guard and then read undefined for Q3/Q4.
  const { students, warnings } = parsePastedData('123458\tCordelia Madeup\tSS7-3\t7\tA(95.00)\tA(96.00)');
  eq(students.length, 0, 'a six-column row is skipped, not half-read');
  eq(/6 column\(s\), need at least 8/.test(warnings[0]), true, 'and says why');
}
{
  // An extra leading column shifts everything. The grade cells are still
  // findable, so the parser moves the window and says so.
  const { students, warnings } = parsePastedData('X\t123459\tDesmond Invented\tSS7-3\t7\tB(85.00)\tB(84.00)\tA(91.00)\tA(93.00)\t88.25');
  eq(students[0].scores, [85, 84, 91, 93], 'the quarters are still found');
  eq(warnings.some(w => /position 6, not 5/.test(w)), true, 'and the shift is reported');
}
{
  // A cell with something unreadable in it gets named, not silently dropped.
  const { warnings } = parsePastedData('1\tEudora Pretend\tSS7-3\t7\tB(85.00)\tEX\tA(91.00)\tA(93.00)\t88.25');
  eq(warnings.some(w => /Q2 reads "EX"/.test(w)), true, 'an "EX" quarter is named in a warning');
}
{
  const { students, warnings } = parsePastedData('1\tFitzwilliam Sham\tSS7-3\t7\t\t\t\t\t');
  eq(students.length, 0, 'a row with no grades at all is skipped');
  eq(warnings.some(w => /no grade data/.test(w)), true, 'and says so');
}
group('Paste import — explicit column mapping (colOpts)');
{
  // Same shifted-column paste as the "extra leading column" case above, but
  // this time told explicitly where things are instead of relying on the
  // auto-detect heuristic. No "position N, not N" warning should appear,
  // since the caller isn't disagreeing with a guess — it's stating a fact.
  const paste = 'X\t123459\tDesmond Invented\tSS7-3\t7\tB(85.00)\tB(84.00)\tA(91.00)\tA(93.00)\t88.25';
  const { students, warnings } = parsePastedData(paste, { nameCol: 2, q1Col: 5 });
  eq(students[0].name, 'Desmond Invented', 'explicit nameCol is honored');
  eq(students[0].scores, [85, 84, 91, 93], 'explicit q1Col is honored');
  eq(warnings.some(w => /position/.test(w)), false, 'no auto-detect disagreement warning when the mapping was explicit');
}
{
  // A mapping that runs off the end of a short row is a column guard
  // failure, not a crash reading undefined.
  const { students, warnings } = parsePastedData('a\tb\tc', { nameCol: 1, q1Col: 5 });
  eq(students.length, 0, 'an out-of-range explicit mapping skips the row');
  eq(/need at least 9/.test(warnings[0]), true, 'and reports the mapping-derived minimum, not the default 8');
}
{
  // parsePastedData(raw) and parsePastedData(raw, null) must stay identical
  // to every pre-existing call site that doesn't know about colOpts yet.
  const paste = '123456\tAmelia Fakename\tSS7-3\t7\tB(85.00)\tB(84.00)\tA(91.00)\tA(93.00)\t88.25';
  const a = parsePastedData(paste);
  const b = parsePastedData(paste, null);
  eq(JSON.stringify(a), JSON.stringify(b), 'omitting colOpts matches passing null');
}

eq(parsePastedData('').students.length, 0, 'an empty paste imports nothing');
eq(parsePastedData('\n\n  \n').students.length, 0, 'a whitespace paste imports nothing');

group('Paste import — row splitting');
eq(splitRow('a\tb\t\td'), ['a','b','','d'], 'tabs keep empty cells');
eq(splitRow('a\tb\tc\td\r'), ['a','b','c','d'], 'a trailing carriage return is stripped');
eq(splitRow('a  b   c'), ['a','b','c'], 'fixed-width text splits on runs of spaces');
eq(findQuarterWindow(['1','n','s','7','B(85.00)','B(84.00)','A(91.00)','A(93.00)','88.25']).start, 4,
   'the documented layout is used as-is');

// ── Rounding-rule options (opts.boundary / opts.precision) ──
// Added when the tool grew a visible "Grading Settings" panel. Every case
// above this point calls these functions with no second argument at all, so
// none of them exercise this — these are new coverage, not a rewrite of the
// old cases, and the old cases passing unmodified is itself the proof that
// the default behaviour (opts undefined) did not change.
group('Rounding options — boundary: strict vs half (default)');
eq(getLetter(89.5), 'A', 'default (no opts) still rounds 89.5 up to an A');
eq(getLetter(89.5, {}), 'A', 'an empty opts object behaves like no opts at all');
eq(getLetter(89.5, { boundary: 'strict' }), 'B', 'strict mode gives no credit for exactly .5');
eq(getLetter(90, { boundary: 'strict' }), 'A', 'strict mode still awards the whole cutoff');
eq(getLetter(89.99, { boundary: 'strict' }), 'B', 'strict mode: 89.99 is not a 90');
eq(qpToFinalLetter(3.5), 'A', 'default quality points still rounds 3.5 up to an A');
eq(qpToFinalLetter(3.5, { boundary: 'strict' }), 'B', 'strict quality points gives no credit for 3.5');
eq(qpToFinalLetter(4, { boundary: 'strict' }), 'A', 'strict quality points still awards an exact 4.0');
eq(LETTER_CUTOFFS_STRICT.find(([l]) => l === 'A')[1], 90, 'strict letter cutoff for A is a flat 90');
eq(QP_CUTOFFS_STRICT.find(([l]) => l === 'A')[1], 4, 'strict QP cutoff for A is a flat 4.0');

group('Rounding options — precision (round before the cutoff check)');
eq(getLetter(89.46), 'B', 'without precision, 89.46 stays a B');
eq(getLetter(89.46, { precision: 1 }), 'A', 'rounded to one decimal first, 89.46 becomes 89.5, an A');
eq(getLetter(89.44, { precision: 1 }), 'B', 'rounded to one decimal, 89.44 becomes 89.4, still a B');
eq(getLetter(89.6, { precision: 0 }), 'A', 'rounded to a whole percent, 89.6 becomes 90, an A');
eq(getLetter(89.4, { precision: 0 }), 'B', 'rounded to a whole percent, 89.4 becomes 89, still a B');

group('Rounding options — weights (opts.weights)');
{
  // Equal weights must reproduce the unweighted result exactly, not just
  // approximately — the tool falls back to the plain sum/QUARTERS arithmetic
  // whenever weights are absent, and this checks the two paths agree when
  // weights are present but equal.
  const scores = [90, 90, 60, 60];
  const equal = calcFinals(scores, { weights: [25, 25, 25, 25] });
  const none  = calcFinals(scores);
  eq(equal.finalLetter, none.finalLetter, 'equal explicit weights match the unweighted default');
  eq(equal.avgQP, none.avgQP, 'and the quality-points average matches exactly');
  eq(equal.pctAvg, none.pctAvg, 'and the percentage average matches exactly');
}
{
  // Q1 100=A(4) Q2 100=A(4) Q3 60=D(1) Q4 60=D(1), weighted 10/10/40/40.
  // Percentage: (100*10 + 100*10 + 60*40 + 60*40) / 100 = 68.00 -> D
  // Quality points: (4*10 + 4*10 + 1*40 + 1*40) / 100 = 1.60 -> C
  // Quality points (C) beats percentage (D), so the weighted final is a C —
  // a flat unweighted average of the same four scores is 80 (a B) by
  // percentage, so the weighting visibly changes the outcome, as it should.
  const f = calcFinals([100, 100, 60, 60], { weights: [10, 10, 40, 40] });
  eq(f.pctAvg, 68, 'heavily-weighted low quarters pull the percentage average down to 68');
  eq(f.pctFinal, 'D', 'which is a D');
  eq(f.avgQP, 1.6, 'the quality-points average is pulled down to 1.60');
  eq(f.qpFinal, 'C', 'which is a C');
  eq(f.winner, 'QP', 'quality points wins');
  eq(f.finalLetter, 'C', 'so the weighted final is a C, not the unweighted B');
}
eq(calcFinals([90, 90, 90, 90], { weights: [0, 0, 0, 0] }).finalLetter, 'A',
  'all-zero weights fall back to the unweighted average rather than dividing by zero');

// ── End-to-end: a paste, through the arithmetic, to a letter ─
group('End to end — a pasted class');
{
  const paste = [
    '100001\tGwendolyn Placeholder\tSS7-1\t7\tA(95.00)\tA(92.00)\tB(88.00)\tA(94.00)\t92.25',
    '100002\tHoratio Notarealboy\tSS7-1\t7\tA(90.00)\tA(90.00)\tD(60.00)\tD(60.00)\t75.00',
    '100003\tIsolde Madeupname\tSS7-1\t7\tC(79.00)\tC(79.00)\tA(100.00)\tA(100.00)\t89.50',
    '100004\tJasper Fictional\tSS7-1\t7\tB(85.00)\t\tB(86.00)\tB(87.00)\t86.00',
  ].join('\n');
  const { students } = parsePastedData(paste);
  const result = students.map(s => {
    const f = calcFinals(s.scores);
    return [s.name, f ? f.finalLetter : 'no final', f ? f.winner : '-'];
  });
  eq(result, [
    ['Gwendolyn Placeholder', 'A', 'QP'],   // 4+4+3+4 = 3.75 -> A ; 92.25 -> A ; tie, QP
    ['Horatio Notarealboy',   'B', 'QP'],   // 4+4+1+1 = 2.50 -> B ; 75.00 -> C ; QP wins
    ['Isolde Madeupname',     'A', 'PCT'],  // 2+2+4+4 = 3.00 -> B ; 89.50 -> A ; PCT wins
    ['Jasper Fictional',      'no final', '-'], // missing Q2
  ], 'four students, four correct outcomes');
}

// ── Report ───────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
if (failed) {
  console.log(`${failed} FAILED, ${passed} passed\n`);
  for (const f of fails) console.log(`  FAIL ${f}\n`);
  process.exit(1);
}
console.log(`${passed} passed, 0 failed`);

// ── BREAKAGE LOG (locked decision #34) ───────────────────────
//
// Each of these was applied to grade-math.mjs, the suite run, the failures
// counted, then reverted. A case nobody has watched fail is a case that might
// not be able to fail.
//
//   1. winner = 'PCT' always                     -> 5 failed
//   2. `>= 89.5` on the raw value, no normalise  -> 6 failed  (the float cases)
//   3. Math.round(n*10) thresholds, i.e. the old -> 6 failed  (the x.45 band)
//      code restored
//   4. calcFinals divides by valid.length, so a  -> 8 failed
//      three-quarter student gets a final
//   5. splitRow filters empty cells, i.e. the    -> 7 failed  (the headline case)
//      old parser restored
//   6. MIN_COLUMNS back to 6                     -> 2 failed
//   7. range check removed from toScore          -> 5 failed
//   8. quarter window pinned to column 4         -> 2 failed
//
// All eight exited 1. The script that does this lives outside the repo; it
// patches, runs, records and restores byte-for-byte.
