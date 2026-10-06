// _sheet-adopters.mjs — what smoke-sheet-adopters.mjs knows about the pages
// whose spreadsheet files are written by ExportKit (Path 7 P4): 001 and 006,
// which save one table as a CSV and as a workbook, and 030 and 036, which
// save a workbook. For each: the state to open it with, how to get the page
// to where its export buttons work, and what each file has to hold.
//
// The cells are the ones that break a hand-rolled file: a comma, a quote,
// text a spreadsheet would run as a formula (= + - @), letters outside ASCII.
// Every name here is invented.
//
// The leading underscore keeps check:tests from calling this a suite.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

const j = v => JSON.stringify(v);

/** A workbook's bytes as { names, sheets: [{ ref, cols, cells: { A1: { t, v } } }] },
    read by the vendored SheetJS in a context of its own. */
let sheetjs = null;
export function readWorkbook(bytes) {
  if (!sheetjs) {
    const g = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(SITE, '_shared/vendor/xlsx/xlsx.full.min.js'), 'utf8'), g);
    sheetjs = g.XLSX;
  }
  const wb = sheetjs.read(Buffer.from(bytes).toString('base64'), { type: 'base64', cellFormula: true, cellStyles: true });
  return {
    names: [...wb.SheetNames],
    sheets: wb.SheetNames.map((n) => {
      const ws = wb.Sheets[n], cells = {};
      for (const k of Object.keys(ws)) {
        if (k[0] === '!') continue;
        cells[k] = { t: ws[k].t, v: ws[k].v };
        if (ws[k].f !== undefined) cells[k].f = ws[k].f;
        if (ws[k].z !== undefined && ws[k].z !== 'General') cells[k].z = ws[k].z;
      }
      return { ref: ws['!ref'], cols: (ws['!cols'] || []).map(c => (c && c.wch !== undefined ? Math.round(c.wch) : null)), cells };
    }),
  };
}

/** A1, B1 … for a table of rows; an empty string and null are no cell. */
export function cellsOf(rows) {
  const out = {};
  rows.forEach((r, ri) => r.forEach((v, ci) => {
    if (v === '' || v === null || v === undefined) return;
    let col = '', n = ci + 1;
    while (n) { col = String.fromCharCode(65 + (n - 1) % 26) + col; n = Math.floor((n - 1) / 26); }
    out[col + (ri + 1)] = { t: typeof v === 'number' ? 'n' : 's', v };
  }));
  return out;
}

const DAY1 = new Date(2026, 8, 28, 12).getTime(), DAY2 = new Date(2026, 8, 29, 12).getTime();
const label = ms => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const HALL_TOTALS = [
  ['Student', 'Passes', 'Total minutes'],
  ['=SUM(A1:A9)', 2, 20],
  ['Okafor, Ben', 1, 6],
  ['Zoë Núñez 日本語', 1, 0],
];
const HALL_DETAIL = [
  ['Date', 'Student', 'Destination', 'Out', 'Back', 'Minutes', 'Note'],
  [new Date(DAY2).toDateString(), '=SUM(A1:A9)', '@Office', '9:30 AM', '9:44 AM', 14, '-left without the pass'],
  [new Date(DAY2).toDateString(), 'Zoë Núñez 日本語', 'Nurse', '9:50 AM', '', 0, 'She said "headache", twice'],
  [new Date(DAY1).toDateString(), '=SUM(A1:A9)', 'Restroom', '9:15 AM', '9:21 AM', 6, ''],
  [new Date(DAY1).toDateString(), 'Okafor, Ben', 'Restroom', '10:02 AM', '10:08 AM', 6, '+1 warning'],
];

const ROSTER_HEAD = ['#', 'Name', 'Preferred name', 'Pronunciation', 'Period / block', 'Course', 'School year'];
const P1 = [
  [1, '=Ada Quill', '@da', 'AY-duh', '-1', 'Science, "honors"', '2026-27'],
  [2, 'Okafor, Ben', '', '', '-1', 'Science, "honors"', '2026-27'],
  [3, '+Bo Tran', '-B', '', '-1', 'Science, "honors"', '2026-27'],
  [4, 'Zoë Núñez 日本語', '', 'ZOH-ee', '-1', 'Science, "honors"', '2026-27'],
];
const P34 = [
  [1, '-Cy Marsh', '', '', '', '', ''],
  [2, '@Di Vance', '', '', '', '', ''],
];

export const TOOLS = [
  {
    tool: '001', file: 'Tools/001-hall-pass-log.html',
    seed: {
      'hall-pass-log-sections': j({
        current: 'Period 3',
        sets: {
          'Period 3': {
            name: 'Period 3', namesText: '=SUM(A1:A9)\nOkafor, Ben\nZoë Núñez 日本語', log: [],
            history: [
              { date: new Date(DAY1).toDateString(), dateMs: DAY1, rows: [
                { name: '=SUM(A1:A9)', destLabel: 'Restroom', outStr: '9:15 AM', inStr: '9:21 AM', durationMin: 6, note: '' },
                { name: 'Okafor, Ben', destLabel: 'Restroom', outStr: '10:02 AM', inStr: '10:08 AM', durationMin: 6, note: '+1 warning' },
              ] },
              { date: new Date(DAY2).toDateString(), dateMs: DAY2, rows: [
                { name: '=SUM(A1:A9)', destLabel: '@Office', outStr: '9:30 AM', inStr: '9:44 AM', durationMin: 14, note: '-left without the pass' },
                { name: 'Zoë Núñez 日本語', destLabel: 'Nurse', outStr: '9:50 AM', inStr: '', durationMin: 0, note: 'She said "headache", twice' },
              ] },
            ],
          },
        },
      }),
    },
    async prep(page) {
      await page.fill('#rangeFrom', '2026-09-01');
      await page.fill('#rangeTo', '2026-09-30');
      await page.click('#buildRangeBtn');
    },
    files: [
      {
        kind: 'csv', button: '#csvRangeBtn', name: /^period-3-sep-1-2026-to-sep-30-2026\.csv$/,
        table: [['Hall pass log', 'Period 3'], ['Range', `${label(new Date(2026, 8, 1))} to ${label(new Date(2026, 8, 30))}`], [],
          ...HALL_TOTALS, [], ...HALL_DETAIL],
      },
      {
        kind: 'xlsx', button: '#xlsxRangeBtn', name: /^period-3-sep-1-2026-to-sep-30-2026\.xlsx$/,
        sheets: [{ name: 'Totals', rows: HALL_TOTALS }, { name: 'Every pass', rows: HALL_DETAIL }],
      },
    ],
  },
  {
    tool: '006', file: 'Tools/006-class-roster-hub.html',
    seed: {
      np_rosters: j({ 'Period 1': P1.map(r => r[1]), 'Period 3/4: Lab [A]': P34.map(r => r[1]) }),
      crh_students_v1: j({
        version: 1,
        rosters: {
          'Period 1': {
            meta: { period: '-1', subject: 'Science, "honors"', term: '2026-27' }, orphans: [],
            students: P1.map((r, i) => ({ id: 's' + i, name: r[1], preferred: r[2], say: r[3] })),
          },
        },
      }),
    },
    async prep(page) { await page.selectOption('#exportScope', 'all'); },
    files: [
      {
        kind: 'csv', button: '#exportCsvBtn', name: /^all-rosters\.csv$/,
        table: [['Roster', ...ROSTER_HEAD], ...P1.map(r => ['Period 1', ...r]), ...P34.map(r => ['Period 3/4: Lab [A]', ...r])],
        /* its own file goes back in: the dialog shows the cells as they were typed */
        roundTrip: { names: ['=Ada Quill', 'Ben Okafor', '+Bo Tran', 'Zoë Núñez 日本語', '-Cy Marsh', '@Di Vance'] },
      },
      {
        kind: 'xlsx', button: '#exportXlsxBtn', name: /^all-rosters\.xlsx$/,
        sheets: [{ name: 'Period 1', rows: [ROSTER_HEAD, ...P1] }, { name: 'Period 3 4 Lab A', rows: [ROSTER_HEAD, ...P34] }],
        roundTrip: { rosters: { 'Period 1': ['=Ada Quill', 'Ben Okafor', '+Bo Tran', 'Zoë Núñez 日本語'], 'Period 3 4 Lab A': ['-Cy Marsh', '@Di Vance'] } },
      },
    ],
  },
  {
    tool: '030', file: 'Tools/030-review-game-board.html', seed: {},
    async prep() {},
    files: [
      {
        kind: 'xlsx', button: '#downloadTemplateBtn', name: /^review-game-board-template\.xlsx$/,
        sheets: [{ name: 'Questions', rows: [
          ['Category', 'Points', 'Question', 'Answer'],
          ['Example Category', 100, 'This is a sample question.', 'This is the sample answer.'],
          ['Example Category', 200, 'A harder sample question.', 'Its answer.'],
        ] }],
        roundTrip: { status: ['import-status ok', 'Imported 1 categories.'] },
      },
    ],
  },
  {
    tool: '036', file: 'Tools/036-final_grade_checker.html', seed: {},
    async prep(page) {
      const fill = async (i, name, qs) => {
        const id = await page.locator('.name-input').nth(i).getAttribute('data-student');
        await page.fill(`#name-${id}`, name);
        for (let q = 0; q < 4; q++) if (qs[q] !== null) await page.fill(`#q${q + 1}-${id}`, String(qs[q]));
      };
      await fill(0, '=SUM(A1:A9)', [92, 88.5, 79, 95]);
      await fill(1, 'Okafor, Ben', [73.28, 64, null, 81]);
      await fill(2, '', [55, 61, 48, 70]);
      await fill(3, 'Zoë Núñez 日本語', [null, null, null, null]);
    },
    files: [
      {
        kind: 'xlsx', button: '#export-excel-btn', name: /^final_grades\.xlsx$/,
        widths: [4, 30, 9, 9, 9, 9, 10, 10, 10, 10, 14, 26],
        sheets: [{ name: 'Final Grades', rows: [
          ['#', 'Student Name', 'Q1', 'Q2', 'Q3', 'Q4', 'QP Avg', 'QP Grade', 'Pct Avg', 'Pct Grade', 'Final Grade', 'Method Used'],
          [1, '=SUM(A1:A9)', 92, 88.5, 79, 95, 3.25, 'B', 88.63, 'B', 'B', 'Quality Points'],
          [2, 'Okafor, Ben', 73.28, 64, 'Missing', 81, 'Incomplete', '', 'Incomplete', '', 'No final grade', 'All four quarters required'],
          [3, 'Student 3', 55, 61, 48, 70, 0.75, 'D', 58.5, 'F', 'D', 'Quality Points'],
          [4, 'Zoë Núñez 日本語', 'Missing', 'Missing', 'Missing', 'Missing', 'Incomplete', '', 'Incomplete', '', 'No final grade', 'All four quarters required'],
        ] }],
      },
    ],
  },
];
