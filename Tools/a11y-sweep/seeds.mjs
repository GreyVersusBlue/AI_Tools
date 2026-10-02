// seeds.mjs — saved state for the second, "seeded" pass of smoke-a11y-sweep.mjs.
//
// The sweep's first pass opens every page with empty storage, the way a
// teacher meets a tool the first time. Ten shipped serious/critical violations
// (009 #202, 075 #206, 077 #210, 073 #212, 068 #214, 037 #216, 027 #218, 003,
// 030, 042 and 043 #221) were in UI that only renders once something has been
// saved, so that pass could never see them. The seeded pass opens a page again
// with the localStorage below written before its first script runs.
//
// What is seeded, and why:
//   ROSTERS      the shared class roster, written for every page that reads or
//                writes `np_rosters` according to _shared/tool-registry.js (and
//                for 009, which lists every key). On most of those pages it
//                only fills a roster <select>: loading names into a tool takes
//                a pick and a click, which a seed cannot do.
//   PAGE_SEEDS   per tool, a small fixture of the tool's own keys, keyed by
//                tool number. Shapes were read from the tools' load() code and
//                from the suites that already seed them (each entry names its
//                source). Values that a tool writes with a bare setItem(name)
//                — the `:current` keys — are raw strings, not JSON.
//
// What a seed cannot reach is still unscanned: a mode the tool always opens
// out of (003's Score view, 042's grid view), a dialog, a toolbar toggle over
// a calibrated map (046's #scaleBarUnitSelect, #225). Those belong to a per-tool
// suite calling harness.a11yScan() after its own prep, which is how #227 found
// 001's projector note.
//
// The names are invented. Nothing here is, or may become, real student data.

const j = v => JSON.stringify(v);

export const ROSTERS = {
  np_rosters: j({
    'Period 1 — Geology': ['Ada Lovelace', 'Marco Polo', 'Nellie Bly'],
    'Period 3 — Earth Science': ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dana Lee'],
  }),
};

const DAY = 86400000;

export const PAGE_SEEDS = {
  // 001 — sections with a roster and yesterday's history (shape: smoke-export.mjs).
  '001': () => ({
    'hall-pass-log-sections': j({
      current: 'Period 3',
      sets: {
        'Period 3': {
          name: 'Period 3',
          namesText: 'Ada Lovelace\nMarco Polo\nNellie Bly',
          log: [{ id: 'a', name: 'Marco Polo', destLabel: 'Restroom', outStr: '10:02 AM', outMs: Date.now() - 3600000, inStr: '10:07 AM', durationMin: 5, note: '' }],
          history: [{
            date: new Date(Date.now() - DAY).toDateString(), dateMs: Date.now() - DAY,
            rows: [
              { name: 'Ada Lovelace', destLabel: 'Restroom', outStr: '9:15 AM', inStr: '9:21 AM', durationMin: 6, note: '' },
              { name: 'Marco Polo', destLabel: 'Nurse', outStr: '9:30 AM', inStr: '9:44 AM', durationMin: 14, note: 'headache' },
            ],
          }],
        },
      },
    }),
  }),

  // 003 — two rubrics, one with criteria (shape: rubric-builder/rb-store.js).
  '003': () => ({
    'gvb-rubric-builder:list': j(['Lab Report', 'Essay']),
    'gvb-rubric-builder:current': 'Lab Report',
    'gvb-rubric-builder:data:Lab Report': j({
      name: 'Lab Report', title: 'Lab Report Rubric',
      levels: [{ id: 'lvl1', label: 'Excellent', points: 4 }, { id: 'lvl2', label: 'Good', points: 3 }, { id: 'lvl3', label: 'Fair', points: 2 }],
      criteria: [
        { id: 'crit4', name: 'Hypothesis', weight: 1, cells: { lvl1: 'Clear and testable', lvl2: 'Testable', lvl3: 'Vague' } },
        { id: 'crit5', name: 'Data table', weight: 1, cells: { lvl1: 'Complete, labeled', lvl2: 'Mostly complete', lvl3: 'Missing parts' } },
      ],
    }),
    'gvb-rubric-builder:data:Essay': j({ name: 'Essay', title: '', levels: [{ id: 'lvl1', label: 'Excellent', points: 4 }, { id: 'lvl2', label: 'Good', points: 3 }], criteria: [] }),
  }),

  // 009 — the roster (student) plus 075's directory (settings) fill the key table (smoke-restore-diff.mjs).
  '009': () => ({
    sdb_directory_v1: j([{ id: 'p1', name: 'Ana Ruiz', room: '204', ext: '3104', subject: 'Science' }]),
  }),

  // 027 — one project with groups and a logged meeting (027's loadProjectByName).
  '027': () => ({
    'novel-study-circles': j({
      'Hatchet P3': {
        name: 'Hatchet P3', students: 'Aiden Smith\nBella Cruz\nCarlos Diaz\nDana Lee', bookTitle: 'Hatchet',
        mode: 'count', splitValue: 2,
        groups: [{ id: 'g1', label: 'Group 1', members: ['Aiden Smith', 'Bella Cruz'] }, { id: 'g2', label: 'Group 2', members: ['Carlos Diaz', 'Dana Lee'] }],
        roles: ['Discussion Director', 'Summarizer'], together: true,
        history: { 'Aiden Smith': ['Discussion Director'] },
        meetings: [{
          id: 'm1', date: '2026-09-30', together: true, wholeClassCheckpoint: 'Through Chapter 6',
          vocab: [{ word: 'ravine', definition: 'deep narrow valley' }],
          groups: [
            { id: 'g1', label: 'Group 1', checkpoint: '', assignment: [{ name: 'Aiden Smith', role: 'Discussion Director' }, { name: 'Bella Cruz', role: 'Summarizer' }] },
            { id: 'g2', label: 'Group 2', checkpoint: '', assignment: [{ name: 'Carlos Diaz', role: 'Discussion Director' }, { name: 'Dana Lee', role: 'Summarizer' }] },
          ],
        }],
      },
    }),
    'novel-study-circles-current': 'Hatchet P3',
  }),

  // 030 — a 2×2 board with two teams (review-game-board/test/smoke-board-art.mjs).
  '030': () => {
    const clue = (points, q) => ({ points, question: q, answer: q + ' answer', used: false, dailyDouble: false });
    return {
      'gvb-review-board:list': j(['Rivers']),
      'gvb-review-board:current': 'Rivers',
      'gvb-review-board:data:Rivers': j({
        name: 'Rivers',
        categories: [
          { name: 'Rivers', clues: [clue(100, 'Longest river?'), clue(200, 'Widest river?')] },
          { name: 'Deltas', clues: [clue(100, 'Which delta?'), clue(200, 'Why deltas form')] },
        ],
        teams: [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
        dailyDoubleEnabled: false, lightningRoundEnabled: false, lightningRoundSeconds: 15,
      }),
    };
  },

  // 037 — five scores, so the histogram and its stacked bar draw (037's loadListByName).
  '037': () => ({
    'gvb-grade-distribution:list': j(['Unit 2 Test']),
    'gvb-grade-distribution:current': 'Unit 2 Test',
    'gvb-grade-distribution:data:Unit 2 Test': j({
      name: 'Unit 2 Test', text: 'Aiden Smith: 92\nBella Cruz: 85\nCarlos Diaz: 71\nDana Lee: 64\nEli Park: 88',
      cutA: 90, cutB: 80, cutC: 70, cutD: 60, bucketWidth: 10, compareNames: [],
    }),
  }),

  // 042 — a batch preset (certificate-award-maker/test/smoke-images.mjs).
  '042': () => {
    const preset = (name, extra) => ({
      name, theme: 'elegant', border: 'double-line', logo: '', mode: 'batch', studentName: '',
      batchNames: 'Aiden Smith\nBella Cruz\nCarlos Diaz', awardTitle: 'Certificate of Achievement', awardTitleCustom: '',
      reason: 'For outstanding effort', certDate: '2026-09-28', signature: 'Ms. Invented', signatureImage: '', qrUrl: '',
      orientation: 'landscape', perPage: 1, showGuides: false, stockInset: 0, ...extra,
    });
    return {
      'gvb-certificate-maker:list': j(['Honor Roll', 'Plain']),
      'gvb-certificate-maker:current': 'Honor Roll',
      'gvb-certificate-maker:data:Honor Roll': j(preset('Honor Roll', {})),
      'gvb-certificate-maker:data:Plain': j(preset('Plain', { mode: 'single', studentName: 'Avery Quill', batchNames: '' })),
    };
  },

  // 043 — batch slips with a cost, so the collection tracker grows payment selects (smoke-bilingual.mjs).
  '043': () => ({
    'gvb-field-trip:list': j(['Museum Trip']),
    'gvb-field-trip:current': 'Museum Trip',
    'gvb-field-trip:data:Museum Trip': j({
      name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: 'Aiden Smith\nBella Cruz\nCarlos Diaz', blankCount: 5,
      collected: { 'Aiden Smith': { returned: true, payment: 'paid' } },
      chaperones: [{ name: 'Mr. Lee', phone: '555-0100' }], chaperoneAssignments: { 'Aiden Smith': 'Mr. Lee' },
      schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
      departureTime: '', returnTime: '', purpose: 'Tour the local history wing.', cost: '$12', whatToBring: 'Lunch.',
      chaperoneName: '', chaperonePhone: '', emergencyInstructions: '', dueDate: '2026-10-15',
    }),
  }),

  // 046 — two saved projects, so the project switcher has a choice (blank-map-generator/bmg-store.js).
  '046': () => {
    const data = { __v: 1, mapId: null, view: { x: 0, y: 0, scale: 1 }, labels: [], markers: [] };
    return {
      bmg_workspace_v1: j({
        __v: 1, activeId: 'pA',
        labelSets: [{ id: 'ls1', name: '13 Colonies', places: [{ name: 'Boston', lat: 42.36, lon: -71.06 }] }],
        projects: [
          { id: 'pA', name: 'Civil War Map', updatedAt: 1790000000000, data },
          { id: 'pB', name: 'Europe 1914', updatedAt: 1790000000000, data },
        ],
      }),
    };
  },

  // 068 — a roster and two logged contacts (parent-contact-log/test/smoke-reasons.mjs).
  '068': () => ({
    pcl_roster_v1: j(['Sable Whitfield']),
    pcl_entries_v1: j([
      { id: 'g1', student: 'Sable Whitfield', date: '2026-02-01', method: 'Phone call', reason: 'Attendance', initials: 'DM', outcome: 'Fourth absence' },
      { id: 'g2', student: 'Sable Whitfield', date: '2026-02-02', method: 'Email', reason: 'Behavior', initials: 'DM', outcome: 'Phone out in class' },
    ]),
  }),

  // 073 — the progress grid, one cell overdue and one with a note (073's load()).
  '073': () => ({
    sfpt_tracker_v1: j({
      roster: ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz'],
      milestones: [{ id: 'm1', name: 'Question & Hypothesis', due: '2026-10-01' }, { id: 'm2', name: 'Background Research', due: '2026-10-15' }, { id: 'm3', name: 'Board Complete', due: '' }],
      done: { 'Aiden Smith|m1': true, 'Aiden Smith|m2': true, 'Bella Cruz|m1': true },
      notes: { 'Carlos Diaz|m1': 'needs a testable question' },
    }),
  }),

  // 075 — the editable directory, grouped by department (smoke-departments.mjs).
  '075': () => ({
    sdb_directory_v1: j([
      { id: 'p1', name: 'Ana Ruiz', room: '204', ext: '3104', subject: 'Science' },
      { id: 'p2', name: 'Ben Okafor', room: '112', ext: '3012', subject: 'Math' },
      { id: 'p3', name: 'Cara Liu', room: 'Office', ext: '3000', subject: 'Admin' },
    ]),
    sdb_prefs_v1: j({ groupByDept: true }),
  }),

  // 077 — the assignment grid with a note (testing-accommodations-card-generator/test/smoke-filter.mjs).
  '077': () => ({
    tacg_cards_v1: j({
      roster: ['Ada Lovelace', 'Beckett Hale', 'Marisol Ruiz'],
      types: [{ id: 'x1', name: 'Extended time' }, { id: 'x2', name: 'Read-aloud' }],
      assignments: { 'Ada Lovelace|x1': true, 'Marisol Ruiz|x2': true },
      notes: { 'Ada Lovelace': '1.5x on unit tests' },
    }),
  }),
};
