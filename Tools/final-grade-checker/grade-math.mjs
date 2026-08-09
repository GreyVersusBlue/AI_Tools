// grade-math.mjs — the Carroll County final-grade calculation, on its own so a
// Node test can import it. Nothing in here touches the DOM.
//
// The county rule, in four parts:
//
//   1. Compute two figures: a quality-points result and a percentage average.
//   2. Report the HIGHER of the two. Not the average of them, not the
//      percentage one by default.
//   3. Ten-point scale: A 90+, B 80-89, C 70-79, D 60-69, F below 60.
//   4. Round up at exactly .5. An 89.5 is an A.
//
// Rule 4 is the one that needs care, and it needs care in both directions.
// See NORMALISE below.

// ── Precision ────────────────────────────────────────────────
//
// Quarter percentages arrive with two decimals (TAC prints `C(73.28)`), so the
// mean of four of them is exact to four decimals. Anything beyond the fourth
// decimal is floating-point noise, not data.
//
// It is not hypothetical noise. Of 8,205,049 four-quarter sets whose mean is
// exactly a .5 boundary, 422,651 evaluate to something like 89.49999999999999
// in IEEE 754. A bare `avg >= 89.5` marks every one of those a B.
//
// The old code dodged that with `Math.round(n * 10) >= 895`, which does absorb
// the noise but rounds to the nearest tenth first. That promotes the whole
// band from x.45 up: an 89.45 average came out an A, and a 59.45 came out a D
// when the student had not passed. Rounding to four decimals kills the noise
// (0 misses across the same 8.2M sets) without moving any real value.
const PRECISION = 10000;
const normalise = n => Math.round(n * PRECISION) / PRECISION;

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;
export const QUARTERS = 4;

// Cutoffs are the true .5 boundaries, compared against a normalised value.
// Exported so callers (the "borderline grade" flag in final_grade_checker.html)
// can measure distance to a boundary without re-declaring these numbers.
export const LETTER_CUTOFFS = [['A', 89.5], ['B', 79.5], ['C', 69.5], ['D', 59.5]];
export const QP_CUTOFFS     = [['A', 3.5],  ['B', 2.5],  ['C', 1.5],  ['D', 0.5]];

const QP_VALUE = { A: 4, B: 3, C: 2, D: 1, F: 0 };
export const RANK = { A: 4, B: 3, C: 2, D: 1, F: 0 };

/** A percentage, or null if it is absent, unreadable or outside 0-100. */
export function toScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
  if (!Number.isFinite(n)) return null;
  if (n < MIN_SCORE || n > MAX_SCORE) return null;
  return n;
}

/** Letter for a single percentage on the ten-point scale. */
export function getLetter(score) {
  const n = toScore(score);
  if (n === null) return null;
  const v = normalise(n);
  for (const [letter, cutoff] of LETTER_CUTOFFS) if (v >= cutoff) return letter;
  return 'F';
}

/** Quality-point value of a letter. */
export function getQP(letter) {
  return QP_VALUE[letter] ?? null;
}

/** Letter for an averaged quality-point figure. */
export function qpToFinalLetter(avgQP) {
  if (!Number.isFinite(avgQP)) return null;
  const v = normalise(avgQP);
  for (const [letter, cutoff] of QP_CUTOFFS) if (v >= cutoff) return letter;
  return 'F';
}

/**
 * Both figures for one student, or null when fewer than four quarters are
 * usable. Declining to guess is deliberate: a three-quarter average is not the
 * county's number and printing one next to the words "final grade" invites it
 * onto a report card.
 *
 * Returns { avgQP, qpFinal, pctAvg, pctFinal, winner, finalLetter }.
 */
export function calcFinals(scores) {
  const valid = (scores || []).map(toScore).filter(s => s !== null);
  if (valid.length < QUARTERS) return null;

  const letters  = valid.map(getLetter);
  const avgQP    = letters.map(getQP).reduce((a, b) => a + b, 0) / QUARTERS;
  const qpFinal  = qpToFinalLetter(avgQP);
  const pctAvg   = valid.reduce((a, b) => a + b, 0) / QUARTERS;
  const pctFinal = getLetter(pctAvg);

  // Rule 2. Ties go to quality points; the letter is the same either way.
  const winner = (RANK[qpFinal] ?? -1) >= (RANK[pctFinal] ?? -1) ? 'QP' : 'PCT';

  return {
    avgQP, qpFinal, pctAvg, pctFinal, winner,
    finalLetter: winner === 'QP' ? qpFinal : pctFinal,
  };
}

// ── Paste import ─────────────────────────────────────────────
//
// A TAC quarter cell is a letter and a percentage in brackets: `C(73.28)`.
// A bare number at the end of the row is the system's own average, which this
// tool ignores because it is the thing being checked.
const GRADE_CELL = /^[A-Za-z][+-]?\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)$/;

export const Q1_COLUMN = 4;      // documented layout: id, name, section, grade, Q1..Q4, avg
export const MIN_COLUMNS = Q1_COLUMN + QUARTERS;   // 8

/** True for a cell that is unmistakably a quarter grade. */
export function isGradeCell(cell) {
  return GRADE_CELL.test(String(cell ?? '').trim());
}

/** The percentage inside a cell, or null. Accepts `B(84.00)` and a bare `84`. */
export function parseGradeToken(tok) {
  if (tok === null || tok === undefined) return null;
  const t = String(tok).trim();
  if (t === '') return null;
  const m = t.match(GRADE_CELL);
  return toScore(m ? m[1] : t);
}

/**
 * Split one pasted row into cells.
 *
 * Tab-separated rows keep their empty cells. That matters more than anything
 * else in this file: dropping an empty cell shifts every later column left, so
 * a student missing Q1 silently gets Q2's grade as Q1 and the system-average
 * column as Q4. See the test suite.
 *
 * A row with no tabs came from fixed-width text, where an empty cell is
 * indistinguishable from padding. Those get split on runs of spaces and the
 * grade-cell scan below has to find the quarters.
 */
export function splitRow(line) {
  const l = String(line).replace(/\r$/, '');
  if (l.includes('\t')) return l.split('\t').map(c => c.trim());
  return l.trim().split(/ {2,}/).map(c => c.trim()).filter(c => c !== '');
}

/**
 * Where the four quarter columns start. Prefers the documented position and
 * only moves if some other window holds strictly more recognisable grade
 * cells, which is what happens when a paste carries an extra leading column.
 */
export function findQuarterWindow(cols) {
  const score = i => {
    if (i < 0 || i + QUARTERS > cols.length) return -1;
    return cols.slice(i, i + QUARTERS).filter(isGradeCell).length;
  };
  const documented = score(Q1_COLUMN);
  let best = Q1_COLUMN, bestScore = documented;
  for (let i = 0; i + QUARTERS <= cols.length; i++) {
    if (score(i) > bestScore) { best = i; bestScore = score(i); }
  }
  return { start: bestScore > 0 ? best : Q1_COLUMN, matches: Math.max(bestScore, 0), moved: bestScore > 0 && best !== Q1_COLUMN };
}

/**
 * Parse a whole paste. Returns { students, warnings }. Every row that is
 * dropped or altered produces a warning; nothing is adjusted silently.
 */
export function parsePastedData(raw) {
  const lines = String(raw ?? '').split('\n').filter(l => l.trim().length > 0);
  const students = [], warnings = [];

  lines.forEach((line, li) => {
    const row = `Row ${li + 1}`;
    const cols = splitRow(line);

    if (cols.length < MIN_COLUMNS) {
      warnings.push(`${row}: ${cols.length} column(s), need at least ${MIN_COLUMNS} (skipped)`);
      return;
    }

    const name = cols[1] || `Row ${li + 1}`;
    const { start, moved } = findQuarterWindow(cols);
    if (moved) warnings.push(`${row} (${name}): quarter columns found at position ${start + 1}, not ${Q1_COLUMN + 1}`);

    const raws   = [0, 1, 2, 3].map(q => cols[start + q] ?? '');
    const scores = raws.map(parseGradeToken);

    // A cell with something in it that did not yield a percentage is a problem
    // worth naming, not a quarter to quietly treat as missing.
    raws.forEach((cell, q) => {
      if (String(cell).trim() !== '' && scores[q] === null) {
        warnings.push(`${row} (${name}): Q${q + 1} reads "${String(cell).trim()}", which is not a grade, so it counts as missing`);
      }
    });

    if (scores.every(v => v === null)) {
      warnings.push(`${row} (${name}): no grade data (skipped)`);
      return;
    }
    const missing = scores.filter(v => v === null).length;
    if (missing > 0) warnings.push(`${row} (${name}): ${missing} quarter(s) missing, so no final grade`);

    students.push({ name, scores });
  });

  return { students, warnings };
}
