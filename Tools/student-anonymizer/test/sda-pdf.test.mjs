// sda-pdf.test.mjs — pure tests for the Teacher Access Center reader in
// Tools/student-anonymizer/sda-pdf.js: pages are built here as the data extractPage() returns
// (text items, filled rectangles, horizontal lines, top-left origin), with the geometry of a real
// Student Detail Report: the header's filled cells, the grey cells down the Assignment column, a
// wrapped assignment name, the solid strike through a cell, the dashed borders and the one solid
// border under "Extra credit: overall average" that must NOT count as a strike, the category
// totals and the overall line, a page that continues a student, retake and dropped marks.
// Then MUTANTS: deliberate breaks that must each turn a check red.
//
//   node Tools/student-anonymizer/test/sda-pdf.test.mjs   (or: npm run test:anonymizer-pdf)
//
// extractPage() itself (the pdf.js half) is driven by smoke-anonymizer.mjs on a real PDF.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CORE = fs.readFileSync(path.join(here, '..', 'sda-core.js'), 'utf8');
const SRC = fs.readFileSync(path.join(here, '..', 'sda-pdf.js'), 'utf8');

function load(src) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(CORE, ctx);
  vm.runInContext(src, ctx);
  return ctx.window.SdaPdf;
}

// The real report's column cells (x, width) in points.
const COLS = [['Assignment', 72, 121.5], ['Due Date', 193.5, 30], ['Category', 222.6, 58.5], ['Score', 282, 46.5],
  ['Asmt Weight', 328.5, 36], ['Weighted Score', 364.5, 45], ['Total Points', 409.5, 36], ['Weighted Total Points', 445.5, 49.5], ['Percent', 495, 40.5]];
const T = (str, x, y, w, h = 9) => ({ str, x, y, w: w == null ? str.length * 4.5 : w, h });

/** A page: student `name` (null for a continuation page), rows of
    { a: [lines], due, cat, score, wt, ws, tot, wtot, pct, strike: [col names], extra, retake, dropped }. */
function page(name, rows, { totals = true, overall = true } = {}) {
  const items = [], rects = [], lines = [];
  let y = 40;
  if (name) {
    items.push(T('East Middle School', 37, 44, 70), T('Student Detail Report', 230, 38, 150, 15.8), T('11/13/2026', 529, 44, 41));
    items.push(T(name, 230, 57, name.length * 6, 12));
    items.push(T('Course:', 37, 76, 38, 10), T('SOC STUDIES 7', 82, 76, 76, 10), T('Period:', 455, 76, 34, 10), T('01 - 03', 496, 76, 31, 10));
    items.push(T('Teacher:', 37, 90, 42, 10), T('Moore, Devon', 82, 90, 63, 10), T('Marking Period:', 455, 90, 75, 10), T('MP1', 536, 90, 21, 10));
    y = 136;
  }
  // header cells and their labels (two lines)
  COLS.forEach(([label, x, w]) => {
    rects.push({ x, y, w, h: 31.5 });
    const parts = label.split(' ');
    parts.forEach((p, i) => items.push(T(p, x + 4, y + 4 + i * 10, p.length * 4.5)));
  });
  lines.push({ x1: 37, x2: 575, y: y - 4, dashed: false, width: 2 }); // the rule above the table
  y += 31.5;
  rows.forEach(r => {
    const h = 22.7 + (r.a.length > 1 ? 0 : 0);
    rects.push({ x: 72, y, w: 121.5, h }, { x: 193.5, y, w: 30, h }, { x: 222.6, y, w: 58.5, h });
    const base = y + 3;
    r.a.forEach((ln, i) => items.push(T(ln, 73.5, base + i * 10)));
    if (r.retake) items.push(T('R', 66, base, 5));
    if (r.dropped) items.push(T('*', 270, base, 3));
    items.push(T(r.due, 222 - r.due.length * 4.5, base));
    items.push(T(r.cat.split(' ')[0], 223.8, base), T(r.cat.split(' ')[1] || '', 223.8, base + 10));
    const right = (s, colIdx) => { if (s == null || s === '') return; const [, x, w] = COLS[colIdx]; items.push(T(s, x + w - 2 - s.length * 4.5, base)); };
    right(r.score, 3); right(r.wt, 4); right(r.ws, 5); right(r.tot, 6); right(r.wtot, 7); right(r.pct, 8);
    if (r.extra) items.push(T(r.extra, 412, base, 120));
    (r.strike || []).forEach(cn => {
      const [, x, w] = COLS.find(c => c[0] === cn);
      lines.push({ x1: x + 24, x2: x + w - 2, y: base + 4.5, dashed: false, width: 0.45 });
    });
    // dashed cell borders on every row, and the solid box under "Extra credit"
    COLS.slice(3).forEach(([, x, w]) => lines.push({ x1: x, x2: x + w, y: y + h, dashed: true, width: 0.5 }));
    if (r.extra) lines.push({ x1: 409.5, x2: 535.5, y: y + h, dashed: false, width: 0.5 });
    if (r.decoys) {
      // Lines that must not read as strikes: dashed through a cell, solid across three
      // columns inside the row, and a solid single-cell border on the row's edge.
      lines.push({ x1: 300, x2: 326, y: base + 4.5, dashed: true, width: 0.45 });
      lines.push({ x1: 409.5, x2: 535.5, y: base + 6, dashed: false, width: 0.45 });
      lines.push({ x1: 497, x2: 534, y: y + h, dashed: false, width: 0.5 });
    }
    y += h;
  });
  if (totals) {
    items.push(T('R', 37, y + 6, 5), T('= Retake entered for this assignment', 45, y + 6, 150));
    y += 30;
    const TC = [['Category', 90, 76], ["Student's Points", 166, 54], ['Maximum Points', 229, 45], ['= Percent', 274, 50], ['Category Weight', 333, 45],
      ['Category Points', 387, 49], ['Dropped Asmts', 436, 42], ['Excluded Asmts', 478, 43]];
    TC.forEach(([label, x, w]) => {
      rects.push({ x, y, w, h: 27 });
      label.split(' ').forEach((p, i) => items.push(T(p, x + 3, y + 2 + i * 10)));
    });
    items.push(T('/', 223, y + 7, 2), T('*', 326, y + 7, 3), T('*', 352, y + 7, 3));
    y += 27;
    rects.push({ x: 90, y, w: 76, h: 23 });
    items.push(T('Formative', 91, y + 1), T('Assignments', 91, y + 11), T('40.00', 180, y + 1), T('50.00', 240, y + 1), T('80.00%', 280, y + 1),
      T('0.40', 359, y + 1), T('0.320000', 397, y + 1), T('0', 455, y + 1), T('1', 497, y + 1));
    y += 24;
    rects.push({ x: 90, y, w: 76, h: 13 });
    items.push(T('Totals', 91, y + 1), T('1.00', 359, y + 1), T('0.800000', 397, y + 1), T('0', 455, y + 1), T('1', 497, y + 1));
    y += 30;
  }
  if (overall) {
    items.push(T("Student's overall average is:", 181, y, 112), T('0.800000', 300, y, 37), T('/', 345, y, 2), T('1.00', 360, y, 17), T('=', 388, y, 5),
      T('80.00', 400, y, 25), T('%', 432, y, 8), T('(Grade:', 446, y, 30), T('B', 480, y, 6), T(')', 501, y, 2));
  }
  return { width: 612, height: 792, items, rects, lines };
}

const ROWS = [
  { a: ['5 Themes Notesheet'], due: '9/3', cat: 'Formative Assignments', score: '5.00', wt: '1.00', ws: '5.00', tot: '5', wtot: '5', pct: '100.00%', decoys: true },
  { a: ['U1 L6 - Mongol Rise to', 'Power Notes'], due: '10/8', cat: 'Formative Assignments', score: '15.00', wt: '1.00', ws: '15.00', tot: '15', wtot: '15', pct: '100.00%' },
  { a: ['Exit Ticket'], due: '10/19', cat: 'Formative Assignments', score: 'EXC', wt: '1.00', tot: '10', wtot: '10', strike: ['Score'] },
  { a: ['Retaken Quiz'], due: '10/20', cat: 'Summative Assignments', score: '8.00', wt: '1.00', ws: '8.00', tot: '10', wtot: '10', pct: '80.00%', retake: true, dropped: true },
  { a: ['Grade Bump'], due: '11/4', cat: 'Formative Assignments', wt: '1.00', strike: ['Score', 'Asmt Weight'], extra: 'Extra credit: overall average' }
];

function run(P) {
  let passed = 0, failed = 0;
  const fails = [];
  const ok = (cond, label) => { if (cond) passed++; else { failed++; fails.push(label); } };
  const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  const v = c => (c == null ? '' : c.v);

  const p1 = page('Doe, Jane Marie', ROWS);
  ok(P.isTac([p1]), 'isTac on a Student Detail page');
  ok(!P.isTac([{ items: [{ str: 'Attendance', x: 0, y: 0, w: 10, h: 9 }], rects: [], lines: [] }]), 'and not on another PDF');
  const rp = P.readPage(p1);
  eq(rp.info, { name: 'Doe, Jane Marie', school: 'East Middle School', date: '11/13/2026', course: 'SOC STUDIES 7', teacher: 'Moore, Devon', period: '01 - 03', mp: 'MP1' }, 'the header fields');
  eq(rp.cols.map(c => c.label), COLS.map(c => c[0]), 'the columns come from the header cells');
  eq(rp.rows.length, 5, 'five rows');
  eq(rp.rows[1].cells[0], 'U1 L6 - Mongol Rise to Power Notes', 'a wrapped assignment name is one cell');
  eq(rp.rows[0].cells.slice(1), ['9/3', 'Formative Assignments', '5.00', '1.00', '5.00', '5', '5', '100.00%'], 'a row\'s cells');
  eq(Object.keys(rp.rows[2].struck), ['3'], 'a solid line through the score is a strike');
  eq(Object.keys(rp.rows[4].struck).sort(), ['3', '4'], 'the Grade Bump\'s two struck cells, and not the solid border under it');
  eq(Object.keys(rp.rows[0].struck), [], 'a dashed line, a line across columns and a border on the row edge are not strikes');
  eq(rp.rows[4].extra, 'Extra credit: overall average', 'text across three columns is a note, not a Total Points value');
  eq(rp.rows[4].cells[6], '', 'and Total Points stays empty');
  eq([rp.rows[3].flags.retake, rp.rows[3].flags.dropped, rp.rows[0].flags.retake], [true, true, false], 'retake and dropped marks');
  eq(rp.totals.cols.map(c => c.label), ['Category', "Student's Points", 'Maximum Points', 'Percent', 'Category Weight', 'Category Points', 'Dropped Asmts', 'Excluded Asmts'], 'the totals columns, without the / = * signs');
  eq(rp.totals.rows.map(r => r.cells[0]), ['Formative Assignments', 'Totals'], 'the totals rows, a wrapped category joined');
  eq([rp.overall.points, rp.overall.max, rp.overall.pct, rp.overall.grade], ['0.800000', '1.00', '80.00%', 'B'], 'the overall line');

  const cont = page(null, [{ a: ['Late Essay'], due: '11/10', cat: 'Summative Assignments', score: '9.00', wt: '1.00', ws: '9.00', tot: '10', wtot: '10', pct: '90.00%' }], { totals: false, overall: false });
  const p2 = page('Roe, Rick', ROWS.slice(0, 1), { totals: false, overall: false });
  const doc = P.parseTac([p1, cont, p2], 'class.pdf');
  eq(doc.students, 2, 'a page with no title continues the student before it');
  const A = doc.sheets[0];
  eq(A.rows.length, 1 + 6 + 1, 'every assignment row, the continued one included');
  eq(A.rows[0].map(v).slice(0, 8), ['Student Name', 'School', 'Report Date', 'Course', 'Teacher', 'Period', 'Marking Period', 'Assignment'], 'the Assignments headings');
  eq(A.rows[6].map(v).slice(0, 1).concat(A.rows[6].map(v).slice(7, 8)), ['Doe, Jane Marie', 'Late Essay'], 'the continued row belongs to the first student');
  eq(A.cols.find(c => c.header === 'Student Name').role, 'name', 'the name column reads as a name');
  eq(A.cols.find(c => c.header === 'Teacher').role, 'context', 'the teacher is kept');
  const notInc = A.rows[0].map(v).indexOf('Not included (line through)');
  eq([v(A.rows[3][notInc]), v(A.rows[5][notInc]), v(A.rows[1][notInc])], ['Yes (Score)', 'Yes (Score, Asmt Weight)', ''], 'which cells were struck, by name');
  const pctCol = A.rows[0].map(v).indexOf('Percent');
  eq([A.rows[1][pctCol].v, A.rows[1][pctCol].z], [1, '0.00%'], 'a percent is a number with its format');
  eq(v(A.rows[3][A.rows[0].map(v).indexOf('Score')]), 'EXC', 'EXC stays text');
  eq(doc.sheets[1].rows.length, 3, 'the category totals sheet');
  eq(doc.sheets[2].rows[1].map(v).slice(-4), [0.8, 1, 0.8, 'B'], 'the overall sheet');
  eq(doc.sheets[2].rows[0].map(v).slice(-1), ['Letter Grade'], 'the letter grade is not read as a grade level');
  eq(doc.sheets[2].cols.find(c => c.header === 'Letter Grade').role, 'data', 'so it is kept');

  eq(P.cell('15.01'), { t: 'n', v: 15.01, z: '0.00' }, 'cell: a decimal');
  eq(P.cell('62.50%'), { t: 'n', v: 0.625, z: '0.00%' }, 'cell: a percent');
  eq(P.cell('N/A'), { t: 's', v: 'N/A' }, 'cell: text');
  eq(P.cell(''), null, 'cell: empty');
  return { passed, failed, fails };
}

const real = run(load(SRC));
real.fails.forEach(f => console.log('  FAIL ' + f));
console.log(`sda-pdf: ${real.passed} passed, ${real.failed} failed`);

const MUTANTS = [
  ['dashed borders count', 'if (ln.dashed || ln.width > 1.5 || ln.x2 - ln.x1 < 4) return;', 'if (ln.width > 1.5 || ln.x2 - ln.x1 < 4) return;'],
  ['a strike may span columns', 'if (ln.x1 >= cols[i].left - 2 && ln.x2 <= cols[i].right + 2) { c = i; break; }', 'if (ln.x1 >= cols[i].left - 2 && ln.x1 <= cols[i].right + 2) { c = i; break; }'],
  ['a line on the row edge counts', 'if (ln.y > r.top + 2 && ln.y < r.bottom - 2) r.struck[c] = true;', 'if (ln.y >= r.top && ln.y <= r.bottom) r.struck[c] = true;'],
  ['spanning text goes in the column', 'if (t.x + t.w > cols[c].right + 3 && c < cols.length - 1) { row.extra.push(t); return; }', ''],
  ['"Extra credit: overall average" ends the table', '/Retake entered|overall average is/i.test(t.str)', '/Retake entered|overall average/i.test(t.str)'],
  ['continuation page starts a new student', 'if (r.info.name || !cur) {', 'if (true) {'],
  ['header operators kept in labels', "&& !/^[\\/=*]$/.test(t.str);", ';'],
  ['percent kept as text', "m = s.match(/^(-?\\d+)(?:\\.(\\d+))?%$/);", 'm = null;']
];
let mutantFails = 0;
for (const [label, from, to] of MUTANTS) {
  if (!SRC.includes(from)) { console.log(`  MUTANT "${label}": its text is not in sda-pdf.js any more`); mutantFails++; continue; }
  let caught;
  try { caught = run(load(SRC.replace(from, to))).failed > 0; } catch (e) { caught = true; }
  if (!caught) { console.log(`  MUTANT "${label}" was not caught`); mutantFails++; }
}
console.log(`mutants: ${MUTANTS.length - mutantFails} of ${MUTANTS.length} caught`);
process.exit(real.failed || mutantFails ? 1 : 0);
