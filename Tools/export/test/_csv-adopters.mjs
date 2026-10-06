// _csv-adopters.mjs — what smoke-csv-adopters.mjs knows about each page that
// saves its CSV through ExportKit.toCsv(): the state to open it with, the
// button that saves the file, and the table that file has to hold.
//
// The cells are the ones that break a hand-rolled CSV: a comma, a quote, a
// line break, a bare carriage return, text a spreadsheet would run as a
// formula (= + - @), letters outside ASCII, and nothing at all. Every name
// here is invented.
//
// The leading underscore keeps check:tests from calling this a suite.

const j = v => JSON.stringify(v);

export const H = {
  comma: 'Okafor, Ben',
  quote: 'Dana "DJ" Lee',
  lines: 'line one\nline two',
  eq: '=SUM(A1:A9)',
  plus: '+1 555 0100',
  minus: '-left voicemail',
  at: '@home',
  uni: 'Zoë Núñez 日本語',
  cr: 'cr\ralone',
};

/* ── a strict RFC 4180 reader ────────────────────────────────────────────
   Records end in CRLF and nothing else; a bare CR or LF outside quotes, a
   quote inside an unquoted cell, text after a closing quote and a last record
   with no CRLF are each reported in `faults` and never smoothed over. */
export function parseCsv(text, delim = ',') {
  const rows = [], faults = [];
  let row = [], cell = '', i = 0, quoted = false, wasQuoted = false;
  const endCell = () => { row.push(cell); cell = ''; wasQuoted = false; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; wasQuoted = true; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') {
      if (cell !== '' || wasQuoted) faults.push(`a quote inside an unquoted cell at ${i}`);
      quoted = true; i++; continue;
    }
    if (ch === delim) { endCell(); i++; continue; }
    if (ch === '\r' && text[i + 1] === '\n') { endCell(); rows.push(row); row = []; i += 2; continue; }
    if (ch === '\r' || ch === '\n') { faults.push(`a bare ${ch === '\r' ? 'CR' : 'LF'} outside quotes at ${i}`); cell += ch; i++; continue; }
    if (wasQuoted) faults.push(`text after a closing quote at ${i}`);
    cell += ch; i++;
  }
  if (quoted) faults.push('a quote that never closes');
  if (cell !== '' || row.length) { faults.push('the last record does not end in CRLF'); endCell(); rows.push(row); }
  return { rows, faults };
}

/** The reference writer, written here and not taken from export.js: what a
    table of strings is as a CSV file's text, guard included. */
export const GUARD = /^[=+\-@\t\r]/;
export function writeCsv(rows, { guard = true, numeric = () => false } = {}) {
  return rows.map((r, ri) => r.map((v, ci) => {
    let s = String(v);
    if (guard && GUARD.test(s) && !(ri > 0 && numeric(ci))) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',') + '\r\n').join('');
}

/** Takes the guard's apostrophe off again. */
export const unguard = s => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

/** Clicks `selector` in the page and resolves to the file it saves: its
    bytes, its type and its name. harness.downloadText() reads a Blob with
    text(), which drops the byte order mark this suite has to see, so the
    bytes are read here. */
export async function capture(page, selector, timeout = 15000) {
  const got = await page.evaluate(({ selector, timeout }) => new Promise((resolve) => {
    const realCreate = URL.createObjectURL, realClick = HTMLAnchorElement.prototype.click;
    let name = null, done = false;
    const finish = (r) => {
      if (done) return; done = true; clearTimeout(timer);
      URL.createObjectURL = realCreate; HTMLAnchorElement.prototype.click = realClick;
      resolve(r);
    };
    const timer = setTimeout(() => finish({ error: 'no file after ' + timeout + ' ms' }), timeout);
    let pending = null;
    URL.createObjectURL = function (blob) {
      const url = realCreate.call(URL, blob);
      if (blob instanceof Blob && !pending) pending = blob.arrayBuffer().then(b => ({ bytes: Array.from(new Uint8Array(b)), type: blob.type }));
      return url;
    };
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && pending) { name = this.download; pending.then(r => finish({ ...r, name }), e => finish({ error: String(e) })); return; }
      return realClick.call(this);
    };
    const el = document.querySelector(selector);
    if (!el) { finish({ error: 'nothing matches ' + selector }); return; }
    try { el.click(); } catch (e) { finish({ error: 'the click threw: ' + e }); }
  }), { selector, timeout });
  if (got.error) throw new Error(`the download (${selector}) could not be read: ${got.error}`);
  const bytes = Buffer.from(got.bytes);
  return { bytes, type: got.type, name: got.name, text: bytes.toString('utf8') };
}

/* ── the adopters ───────────────────────────────────────────────────────
   seed      localStorage before the page's first script
   button    what saves the file
   name      what the file is called
   numeric   the columns the tool fills with numbers (0-based): a minus sign
             there is a negative number, not a typed cell
   table     the file's rows, header first, as the teacher typed them
   fixed     true for a file the tool writes whole, with no typed cell in it
             and so nothing for the guard to do
   roundTrip the tool's own Import: its file input, the key it saves to and
             the fields to read back; `seed` is what the importing page opens
             with (nothing, unless the file depends on a setting) and `want`
             the saved rows when they are not the table's own strings */
export const ADOPTERS = [
  {
    tool: '003', file: 'Tools/003-rubric-builder.html', button: '#exportScoresCsvBtn', name: /^lab-report-scores\.csv$/,
    numeric: c => c >= 1 && c <= 5,
    seed: {
      'gvb-rubric-builder:list': j(['Lab Report']),
      'gvb-rubric-builder:current': 'Lab Report',
      'gvb-rubric-builder:data:Lab Report': j({
        name: 'Lab Report', title: 'Lab Report Rubric',
        levels: [{ id: 'lvl1', label: 'Excellent', points: 4 }, { id: 'lvl2', label: 'Good', points: 3 }, { id: 'lvl3', label: 'Fair', points: 2 }, { id: 'lvl4', label: 'Not handed in', points: -1 }],
        criteria: [
          { id: 'crit4', name: '=Hypothesis', weight: 1, cells: { lvl1: 'Clear', lvl2: 'Testable', lvl3: 'Vague', lvl4: '' } },
          { id: 'crit5', name: 'Data, table', weight: 2, cells: { lvl1: 'Complete', lvl2: 'Mostly', lvl3: 'Parts', lvl4: '' } },
        ],
      }),
      'gvb-rubric-builder:scores:Lab Report': j({
        [H.uni]: { student: H.uni, selections: { crit4: 'lvl1', crit5: 'lvl3' }, overallComment: 'She said "good", twice\nsecond line' },
        [H.eq]: { student: H.eq, selections: { crit4: 'lvl4', crit5: 'lvl4' }, overallComment: '-needs work' },
        [H.at]: { student: H.at, selections: {}, overallComment: '' },
        [H.comma]: { student: H.comma, selections: { crit4: 'lvl2' }, overallComment: '+1' },
      }),
    },
    table: [
      ['Student', '=Hypothesis', 'Data, table', 'Total points', 'Total possible', 'Percent', 'Overall comment'],
      [H.uni, '4', '4', '8', '12', '66.67', 'She said "good", twice\nsecond line'],
      [H.eq, '-1', '-2', '-3', '12', '-25', '-needs work'],
      [H.at, '', '', '0', '12', '0', ''],
      [H.comma, '3', '', '3', '12', '25', '+1'],
    ],
  },
  {
    tool: '008', file: 'Tools/008-behavior-points-tracker.html', button: '#exportHistoryBtn', name: /^Period 3-history\.csv$/,
    numeric: c => c >= 2,
    seed: (() => {
      const names = [H.comma, H.eq, H.uni, H.quote, H.at, H.minus, H.plus];
      const pts = [-2, 0, 3, 1, 1.5, -1, 2];
      return {
        'behavior-points-tracker-sections': j({
          current: 'Period 3',
          sets: {
            'Period 3': {
              name: 'Period 3', namesText: names.join('\n'), points: {}, posCount: {}, negCount: {}, goals: {}, log: [],
              history: [{ date: 'Oct 1, 2026', iso: '2026-10-01', rows: names.map((n, i) => ({ name: n, points: pts[i], pos: i, neg: 7 - i, goal: null, notes: [] })) }],
            },
          },
        }),
      };
    })(),
    table: [['Date', 'Student', 'Points', 'Positive taps', 'Negative taps']].concat(
      [H.comma, H.eq, H.uni, H.quote, H.at, H.minus, H.plus].map((n, i) => ['Oct 1, 2026', n, String([-2, 0, 3, 1, 1.5, -1, 2][i]), String(i), String(7 - i)])),
  },
  {
    tool: '018', file: 'Tools/018-qr-scavenger-hunt-builder.html', button: '#export-csv-btn', name: /^scavenger-hunt-stations\.csv$/,
    numeric: () => false,
    seed: (() => {
      const st = (label, content, extra) => ({ label, content, note: '', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '', ...extra });
      return {
        'qr-scavenger-hunt-sets': j({
          current: 'Number line hunt',
          sets: {
            'Number line hunt': {
              name: 'Number line hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
              stations: [
                st('=Station', 'What is 2+2, "exactly"?', { note: '-5 is wrong', hint: '+think', hintPenalty: '2', codeWord: 'ALPHA' }),
                st('Zoë, Núñez', 'line one\nline two', { qType: 'numeric', numericAnswer: '-5', tolerance: '1', codeWord: 'BRAVO', note: '@home' }),
                st('Plain', 'Marble starts as which rock?', { qType: 'choice', choices: ['=Limestone', 'Shale'], correctChoice: 0, codeWord: 'CHARLIE' }),
              ],
              run: { teams: [] },
            },
          },
        }),
      };
    })(),
    table: [
      ['Label', 'Content', 'Note', 'Type', 'Answer Details', 'Hint', 'Hint Penalty (min)', 'Code Word'],
      ['=Station', 'What is 2+2, "exactly"?', '-5 is wrong', 'Open-ended', 'Open-ended', '+think', '2', 'ALPHA'],
      ['Zoë, Núñez', 'line one\nline two', '@home', 'Numeric answer', 'Numeric — target -5 ± 1', '', '0', 'BRAVO'],
      ['Plain', 'Marble starts as which rock?', '', 'Multiple choice', 'Multiple choice — correct: A. =Limestone', '', '0', 'CHARLIE'],
    ],
  },
  {
    tool: '033', file: 'Tools/033-ssr-log-tracker.html', button: '#exportCsvBtn', name: /^period-3-reading-log-\d{4}-\d\d-\d\d\.csv$/,
    numeric: c => c >= 4,
    seed: {
      sslt_sections_v1: j({
        'Period 3': {
          roster: [H.comma, H.eq, H.uni],
          logs: {
            [H.comma]: [
              { id: 'e1', date: '2026-09-28', book: '-The Giver', pagesTo: 60, minutes: 20 },
              { id: 'e2', date: '2026-09-30', book: '-The Giver', pagesTo: 186, minutes: '' },
            ],
            [H.eq]: [{ id: 'e3', date: '2026-09-29', book: 'Hatchet, "the" sequel', pagesTo: 45, minutes: 20 }],
            [H.uni]: [
              { id: 'e4', date: '2026-09-29', book: '@Home\rAlone', pagesTo: 44, minutes: 30 },
              { id: 'e5', date: '2026-09-30', book: '+One', pagesTo: 12, minutes: 15 },
            ],
          },
          finished: {}, genres: { '-the giver': 'Sci-fi, dystopia' },
          weeklyGoalPages: 100, weeklyGoalMinutes: 0, rosterName: '', idNames: {},
        },
      }),
      sslt_current_v1: 'Period 3',
    },
    table: [
      ['Student', 'Date', 'Book', 'Genre', 'Pages Read To', 'Minutes', 'Pages This Session'],
      [H.comma, '2026-09-28', '-The Giver', 'Sci-fi, dystopia', '60', '20', '60'],
      [H.comma, '2026-09-30', '-The Giver', 'Sci-fi, dystopia', '186', '', '126'],
      [H.eq, '2026-09-29', 'Hatchet, "the" sequel', '', '45', '20', '45'],
      [H.uni, '2026-09-29', '@Home\rAlone', '', '44', '30', '44'],
      [H.uni, '2026-09-30', '+One', '', '12', '15', '12'],
    ],
  },
  {
    /* The groups template: a header that follows the school's period count
       and naming (five "hours" here, not the default eight "mods"), and two
       example rows the tool writes itself. Nothing in it is typed. Its own
       import reads a grade and a headcount as numbers and every column after
       the four named ones as a room. */
    tool: '035', file: 'Tools/035-schedule-visualizer.html', button: '#btn-download-csv-template', name: /^groups-template\.csv$/,
    numeric: () => false, fixed: true,
    seed: { stviz_settings: j({ modCount: 5, modLabel: 'hour' }) },
    roundTrip: {
      input: '#sch-import-csv-file', key: 'stviz_schedules', fields: ['name', 'grade', 'color', 'size', 'modsA'],
      seed: { stviz_settings: j({ modCount: 5, modLabel: 'hour' }) },
      want: [
        ['Homeroom A', 9, '#3b82f6', 24, ['101', '', '', '', '']],
        ['Homeroom B', 10, '#ef4444', null, ['205', '110', '', '', '']],
      ],
    },
    table: [
      ['Name', 'Grade', 'Color', 'Students', '1st Hour', '2nd Hour', '3rd Hour', '4th Hour', '5th Hour'],
      ['Homeroom A', '9', '#3b82f6', '24', '101', '', '', '', ''],
      ['Homeroom B', '10', '#ef4444', '', '205', '110', '', '', ''],
    ],
  },
  {
    /* A result typed as a plain number goes in as a number (sit and reach is
       often negative); anything else typed in a result box is a typed cell. */
    tool: '060', file: 'Tools/060-fitness-skill-assessment-tracker.html', button: '#exportCsvBtn', name: /^fitness-assessment-results\.csv$/,
    numeric: c => c === 1 || c === 2,
    seed: {
      fsat_tracker_v1: j({
        roster: [H.comma, H.eq, H.uni, H.quote, H.at],
        events: [
          { id: 'e1', name: 'Sit and reach, cm', type: 'count' },
          { id: 'e2', name: '=Mile run', type: 'time' },
          { id: 'e3', name: 'Notes', type: 'count' },
        ],
        results: {
          [H.comma + '|e1']: '-3', [H.comma + '|e2']: '7:10', [H.comma + '|e3']: '-absent Tuesday',
          [H.eq + '|e1']: '12.5', [H.eq + '|e2']: '8:02', [H.eq + '|e3']: '=late',
          [H.uni + '|e1']: '0', [H.uni + '|e3']: 'cr\ralone',
          [H.quote + '|e1']: '-0.5', [H.quote + '|e2']: '9:40', [H.quote + '|e3']: '+2 on the retest, "best yet"',
          [H.at + '|e1']: 'NaN', [H.at + '|e2']: '10:15', [H.at + '|e3']: '@nurse',
        },
      }),
    },
    table: [
      ['Student', 'Sit and reach, cm', '=Mile run', 'Notes'],
      [H.comma, '-3', '7:10', '-absent Tuesday'],
      [H.eq, '12.5', '8:02', '=late'],
      [H.uni, '0', '', H.cr],
      [H.quote, '-0.5', '9:40', '+2 on the retest, "best yet"'],
      [H.at, 'NaN', '10:15', '@nurse'],   // typed, and kept: not a number to hand over
    ],
  },
  {
    tool: '068', file: 'Tools/068-parent-contact-log.html', button: '#exportCsvBtn', name: /^parent-contact-log_\d{4}-\d\d-\d\d\.csv$/,
    numeric: () => false,
    seed: {
      pcl_roster_v1: j([H.comma, H.eq, H.uni]),
      pcl_entries_v1: j([
        { id: 'g1', student: H.comma, date: '2026-02-01', method: 'Phone call', reason: 'Attendance', initials: 'DM', outcome: H.minus },
        { id: 'g2', student: H.eq, date: '2026-02-02', method: 'Email', reason: 'Behavior', initials: '@dm', outcome: 'She said "call back"\nafter 3' },
        { id: 'g3', student: H.uni, date: '2026-02-03', method: 'Email', reason: '', initials: '', outcome: H.cr },
        { id: 'g4', student: H.uni, date: '2026-02-04', method: 'Phone call', reason: 'Attendance', initials: 'DM', outcome: '+1 for effort, = last week' },
      ]),
    },
    table: [
      ['Date', 'Student', 'Method', 'Reason', 'Outcome', 'By'],
      ['2026-02-01', H.comma, 'Phone call', 'Attendance', H.minus, 'DM'],
      ['2026-02-02', H.eq, 'Email', 'Behavior', 'She said "call back"\nafter 3', '@dm'],
      ['2026-02-03', H.uni, 'Email', '', H.cr, ''],
      ['2026-02-04', H.uni, 'Phone call', 'Attendance', '+1 for effort, = last week', 'DM'],
    ],
  },
  {
    tool: '075', file: 'Tools/075-staff-directory-builder.html', button: '#exportCsvBtn', name: /^staff-directory\.csv$/,
    numeric: () => false,
    roundTrip: { input: '#importFile', key: 'sdb_directory_v1', fields: ['name', 'room', 'ext', 'subject'] },
    seed: {
      sdb_directory_v1: j([
        { id: 'p1', name: H.comma, room: '204', ext: H.plus, subject: 'Science' },
        { id: 'p2', name: H.quote, room: '-', ext: '=3104', subject: H.at },
        { id: 'p3', name: H.uni, room: '', ext: '', subject: 'Math' },
        { id: 'p4', name: H.eq, room: '112', ext: '3012', subject: 'Arts, Music' },
      ]),
      sdb_prefs_v1: j({ groupByDept: false }),
    },
    table: [
      ['Name', 'Room', 'Extension', 'Subject / Dept'],
      [H.comma, '204', H.plus, 'Science'],
      [H.quote, '-', '=3104', H.at],
      [H.uni, '', '', 'Math'],
      [H.eq, '112', '3012', 'Arts, Music'],
    ],
  },
];
