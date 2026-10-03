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

  // 006 — nothing of its own: the page opens on the first shared roster, which
  // it owns but the registry files under Name Picker, so it needs an entry to
  // be given ROSTERS at all (read off its init, Path 7 P2).
  '006': () => ({}),

  // 008 — a section with today's taps, a note and one archived day (008's normalizeState).
  '008': () => {
    const names = ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dana Lee'];
    return {
      'behavior-points-tracker-sections': j({
        current: 'Period 3',
        sets: {
          'Period 3': {
            name: 'Period 3', namesText: names.join('\n'),
            points: { 'Aiden Smith': 3, 'Bella Cruz': -1, 'Carlos Diaz': 2 },
            posCount: { 'Aiden Smith': 3, 'Carlos Diaz': 2 }, negCount: { 'Bella Cruz': 1 },
            goals: { 'Aiden Smith': 5 },
            log: [{ id: 'ev1', name: 'Bella Cruz', tagId: 't7', tagLabel: 'Unprepared', delta: -1, time: '10:02 AM', note: 'Left the lab notebook at home for the third day running and borrowed paper from a neighbour' }],
            history: [{
              date: 'Oct 1, 2026', iso: '2026-10-01',
              rows: names.map((n, i) => ({ name: n, points: 2 - i, pos: 3 - i, neg: 1, goal: i ? null : 5, notes: i === 1 ? [{ label: 'Unprepared', delta: -1, note: 'No pencil' }] : [] })),
            }],
          },
        },
      }),
    };
  },

  // 009 — the roster (student) plus 075's directory (settings) fill the key table (smoke-restore-diff.mjs).
  '009': () => ({
    sdb_directory_v1: j([{ id: 'p1', name: 'Ana Ruiz', room: '204', ext: '3104', subject: 'Science' }]),
  }),

  // 017 — three stations with feedback slips on, notes and a walking order (017's loadSetByName).
  '017': () => ({
    'gallery-walk-qr-sets': j({
      current: 'Biome posters',
      sets: {
        'Biome posters': {
          name: 'Biome posters', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
          entries: [
            { name: 'Aiden Smith', value: 'https://example.com/biomes/tundra', feedbackNotes: 'Clear map. Label the permafrost line.' },
            { name: 'Bella Cruz', value: 'https://example.com/biomes/rainforest', feedbackNotes: '' },
            { name: 'Carlos Diaz and Dana Lee', value: 'The temperate deciduous forest poster, with its food web and a climate graph for all four seasons', feedbackNotes: 'Food web arrows point the wrong way.' },
          ],
          feedbackEnabled: true, feedbackStyle: 'stars', feedbackPrompt: 'One thing this poster taught me', feedbackCopies: 6, feedbackPerPage: '4',
          timer: { minutes: 3, seconds: 0, rotations: 3 },
          walkGroups: ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz', 'Dana Lee'], routeCardsPerPage: '4',
        },
      },
    }),
  }),

  // 018 — a hunt with one station of each question type and three teams (018's blankStation, ensureRun).
  '018': () => {
    const st = (label, content, extra) => ({ label, content, note: '', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '', ...extra });
    const team = (name, code) => ({ name, marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0, code });
    return {
      'qr-scavenger-hunt-sets': j({
        current: 'Rock cycle hunt',
        sets: {
          'Rock cycle hunt': {
            name: 'Rock cycle hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
            stations: [
              st('Igneous', 'Which rock forms when magma cools slowly underground, and how can you tell from its crystals?', { note: 'granite', hint: 'Look at the crystal size', hintPenalty: '30', codeWord: 'BASALT' }),
              st('Sedimentary', 'How many layers are in the sample?', { qType: 'numeric', numericAnswer: '5', tolerance: '1', codeWord: 'DELTA' }),
              st('Metamorphic', 'Marble starts as which rock?', { qType: 'choice', choices: ['Limestone', 'Shale', 'Granite'], correctChoice: 0, codeWord: 'SCHIST' }),
            ],
            run: { teams: [team('Team 1', 'K7Q'), team('Team 2', 'M3X'), team('Team 3', 'R9T')] },
          },
        },
      }),
    };
  },

  // 023 — a custom prompt long enough to wrap, QR on, and eight students triaged (023's applySavedSettings, loadTriage).
  '023': () => ({
    'gvb-exit-ticket:settings': j({
      category: 'mine',
      perPage: 4,
      showName: true,
      showDate: true,
      includeMine: true,
      thinkTime: 0,
      slipMode: 'same',
      qrEnabled: true,
      qrUrl: 'https://example.org/exit-ticket/period-3',
      batchMode: false,
      answerStyle: 'lines',
      answerSpace: 'auto',
      mode: 'shuffle'
    }),
    'gvb-exit-ticket:customPrompts': j([
      {
        id: 'c1',
        text: 'Explain, using at least two pieces of evidence from today’s stream-table lab, why the outside bend of a river erodes faster than the inside bend, and predict what the channel will look like after one hundred more years of flooding.'
      }
    ]),
    'gvb-exit-ticket:triage': j({
      groupSize: 3,
      students: [
        { id: 't1', name: 'Ada Lovelace', status: 'reteach' },
        { id: 't2', name: 'Marco Polo', status: 'almost' },
        { id: 't3', name: 'Nellie Bly', status: 'got' },
        { id: 't4', name: 'Aiden Smith', status: 'reteach' },
        { id: 't5', name: 'Bella Cruz', status: 'reteach' },
        { id: 't6', name: 'Carlos Diaz', status: 'almost' },
        { id: 't7', name: 'Dana Lee', status: '' },
        { id: 't8', name: 'Maximiliana Featherstonehaugh-Villanueva de la Cruz', status: 'reteach' }
      ]
    }),
  }),

  // 025 — sequence mode on a saved set, so a fixed long prompt is on stage, and one student's record (writing-prompt-generator/wpg-store.js).
  '025': () => ({
    'gvb-writing-prompts:settings': j({
      bands: [ 'ms', 'hs' ],
      genre: 'all',
      includeCustom: true,
      mode: 'sequence',
      anonView: 'one',
      timerMinutes: 5,
      wordGoal: 150,
      handoutSpacing: 'normal',
      handoutNameLine: true
    }),
    'gvb-writing-prompts:sets': j([
      {
        id: 'set1',
        name: 'Geology Unit Week 1',
        startDate: null,
        cursor: 0,
        items: [
          {
            id: 'si1',
            band: 'ms',
            genre: 'persuasive',
            text: 'The canyon you are standing in took six million years to carve and you have forty minutes. Write a letter to a student who will stand in this exact spot one hundred years from now: describe what you can see, hear and smell today, argue for one thing about this place that must not be allowed to change, and explain what you think they will find different.',
            rubricName: null
          },
          {
            id: 'si2',
            band: 'ms',
            genre: 'descriptive',
            text: 'Describe a rock from your pocket to someone who has never seen one.',
            rubricName: null
          },
          { id: 'si3', band: 'hs', genre: 'expository', text: 'Explain how a fossil forms, step by step.', rubricName: null }
        ]
      }
    ]),
    'gvb-writing-prompts:activeSet': 'set1',
    'gvb-writing-prompts:record': j({
      'Ada Lovelace': [
        {
          id: 'wr1',
          date: '2026-09-14',
          promptText: 'The canyon you are standing in took six million years to carve and you have forty minutes. Write a letter to a student who will stand in this exact spot one hundred years from now: describe what you can see, hear and smell today, argue for one thing about this place that must not be allowed to change, and explain what you think they will find different.',
          band: 'ms',
          genre: 'persuasive',
          rubricName: 'Argument Writing',
          note: 'Strong opening image and a clear claim by the second paragraph. Evidence is listed rather than explained; next conference, practise the "this shows that" sentence after each example. Watch run-on sentences when the ideas come quickly.'
        },
        {
          id: 'wr2',
          date: '2026-09-21',
          promptText: 'Describe a rock from your pocket to someone who has never seen one.',
          band: 'ms',
          genre: 'descriptive',
          rubricName: null,
          note: 'Vivid sensory detail.'
        },
        {
          id: 'wr3',
          date: '2026-09-28',
          promptText: 'Explain how a fossil forms, step by step.',
          band: 'hs',
          genre: 'expository',
          rubricName: null,
          note: ''
        }
      ],
      'Marco Polo': [
        {
          id: 'wr4',
          date: '2026-09-14',
          promptText: 'Explain how a fossil forms, step by step.',
          band: null,
          genre: null,
          rubricName: null,
          note: 'Absent Tuesday; finished at home.'
        }
      ]
    }),
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

  // 044 — standing details: teacher, room, four periods, a long fire route (044's standingDetails).
  '044': () => ({
    'subPlanBuilder.standingDetails.v1': j({
      teacherName: 'Ada Lovelace',
      signOffName: 'Ms. Lovelace',
      roomNumber: '214',
      periods: [
        { label: '1', time: '8:05-8:55', _id: 'p0' },
        { label: '3', time: '10:00-10:50', _id: 'p1' },
        { label: '6', time: '12:40-1:30', _id: 'p2' },
        { label: '7', time: '1:35-2:25', _id: 'p3' }
      ],
      rosterLocation: 'blue substitute folder',
      absenceLocation: 'blue substitute folder',
      emergencyLocation: 'on the laptop podium',
      behaviorVariant: 'long',
      referralLines: '4',
      includeCallingOut: true,
      phoneNurse: '555-0101',
      phoneCounseling: '555-0102',
      phoneSupport: '555-0103',
      phoneOther: 'posted on the filing cabinet',
      fireRoute: 'Out the door, LEFT down the science hallway, exit door 7, line up on the far side of the bus loop by the flagpole and take attendance from the red clipboard hanging beside the classroom door before anyone moves again.',
      lockdownProcedure: 'Lock the door (key on the lanyard), lights off, students against the interior wall away from the windows, silent.',
      medicalAlerts: 'Period 3: one student carries an inhaler; see the nurse sheet in the folder.',
      keysLocation: 'top desk drawer, green lanyard',
      whoToAsk: 'Mr. Polo in room 216',
      techFailureText: 'Use the paper copies in the **red tray**.'
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

  // 048 — seven labels, one long statement, one long title, three thumbnails, one with no statement (048's portfolio list).
  '048': () => ({
    apl_portfolios_v1: j({
      currentId: 'p1',
      list: [
        {
          id: 'p1',
          name: 'Period 1 Ceramics',
          title: 'Period 1 — Geology in Clay: Spring Gallery Walk',
          labelsPerPage: '6',
          ecLevel: 'Q',
          entries: [
            {
              id: 'e1',
              title: 'Canyon Bowl',
              artist: 'Ada Lovelace',
              description: 'I built this piece over three weeks from river clay I dug myself, and the glaze is meant to look like the layers of sandstone we mapped on the field trip. The crack along the rim happened in the kiln; I kept it because real canyon walls are not smooth either, and I wanted the bowl to tell the truth about how it was made.',
              image: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20fill%3D%22%23c96%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2234%22%20fill%3D%22%23369%22%2F%3E%3C%2Fsvg%3E'
            },
            { id: 'e2', title: 'Strata', artist: 'Marco Polo', description: 'Layers of coloured slip, one per rock type.', image: '' },
            {
              id: 'e3',
              title: 'A Very Long Title For A Sculpture About Plate Tectonics And Subduction Zones',
              artist: 'Nellie Bly',
              description: 'Two slabs pushed together until one buckled.',
              image: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20fill%3D%22%23c96%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2234%22%20fill%3D%22%23369%22%2F%3E%3C%2Fsvg%3E'
            },
            { id: 'e4', title: 'Geode', artist: 'Aiden Smith', description: 'Pinch pot with crushed glass melted inside.', image: '' },
            {
              id: 'e5',
              title: 'Fossil Tile',
              artist: 'Bella Cruz',
              description: '',
              image: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22120%22%3E%3Crect%20width%3D%22120%22%20height%3D%22120%22%20fill%3D%22%23c96%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2234%22%20fill%3D%22%23369%22%2F%3E%3C%2Fsvg%3E'
            },
            { id: 'e6', title: 'Volcano Mug', artist: 'Carlos Diaz', description: 'The handle is the lava flow.', image: '' },
            { id: 'e7', title: 'Delta', artist: 'Dana Lee', description: 'Carved while the clay was leather-hard.', image: '' }
          ]
        }
      ]
    }),
  }),

  // 049 — seven books in four genres, one long blurb, one long title, two covers; five rounds of slips (049's load()).
  '049': () => ({
    btmg_books_v1: j([
      {
        id: 'b1',
        title: 'The River That Forgot',
        author: 'Ada Lovelace',
        genre: 'Fantasy',
        blurb: 'When the river that feeds her town stops running overnight, twelve-year-old Imara follows the dry bed upstream with a borrowed mule, a hand-drawn map and a boy who swears he is not lost. What they find at the headwaters is older than the town, hungrier than the drought, and has been waiting a very long time for somebody to ask it a polite question.',
        cover: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2290%22%20height%3D%22130%22%3E%3Crect%20width%3D%2290%22%20height%3D%22130%22%20fill%3D%22%23375%22%2F%3E%3Crect%20x%3D%2212%22%20y%3D%2220%22%20width%3D%2266%22%20height%3D%2214%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E'
      },
      {
        id: 'b2',
        title: 'Salt and Starlight',
        author: 'Marco Polo',
        genre: 'Fantasy',
        blurb: 'A caravan guide discovers the desert stars are moving.',
        cover: null
      },
      {
        id: 'b3',
        title: 'Ten Days Around the Newsroom and Other True Stories of Reporters Who Would Not Quit',
        author: 'Nellie Bly',
        genre: 'Nonfiction',
        blurb: 'Real reporters, real deadlines.',
        cover: null
      },
      {
        id: 'b4',
        title: 'Faultline',
        author: 'Aiden Smith',
        genre: 'Science Fiction',
        blurb: 'The earthquake drill was not a drill.',
        cover: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2290%22%20height%3D%22130%22%3E%3Crect%20width%3D%2290%22%20height%3D%22130%22%20fill%3D%22%23375%22%2F%3E%3Crect%20x%3D%2212%22%20y%3D%2220%22%20width%3D%2266%22%20height%3D%2214%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E'
      },
      {
        id: 'b5',
        title: 'Bella and the Basalt Giants',
        author: 'Bella Cruz',
        genre: 'Science Fiction',
        blurb: 'A field trip to the lava beds goes sideways.',
        cover: null
      },
      {
        id: 'b6',
        title: 'Dig',
        author: 'Carlos Diaz',
        genre: 'Mystery',
        blurb: 'Somebody buried something under the school garden.',
        cover: null
      },
      { id: 'b7', title: 'No Genre Here', author: 'Dana Lee', genre: '', blurb: 'Falls under More Books.', cover: null }
    ]),
    btmg_slips_v1: j({ rounds: 5, copies: 4 }),
  }),

  // 051 — a named list of fourteen words, one pair long enough to wrap a label (051's named-list store).
  '051': () => ({
    clm_lists_v1: j([ 'Room set — el aula' ]),
    'clm_list_v1:Room set — el aula': j({
      name: 'Room set — el aula',
      words: [
        { target: 'la puerta', english: 'door' },
        { target: 'la ventana', english: 'window' },
        { target: 'el escritorio', english: 'desk' },
        { target: 'la silla', english: 'chair' },
        { target: 'la pizarra', english: 'whiteboard' },
        { target: 'el reloj', english: 'clock' },
        { target: 'la estantería', english: 'bookshelf' },
        {
          target: 'el sacapuntas eléctrico de la mesa del profesor',
          english: 'the electric pencil sharpener on the teacher’s desk (ask before using it)'
        },
        { target: 'la papelera', english: 'wastebasket' },
        { target: 'el armario', english: 'cupboard' },
        { target: 'la computadora', english: 'computer' },
        { target: 'el proyector', english: 'projector' },
        { target: 'la bandera', english: 'flag' },
        { target: 'el mapa', english: 'map' }
      ],
      lang: 'es-ES'
    }),
    clm_current_v1: 'Room set — el aula',
  }),

  // 053 — three custom questions (one long), one built-in hidden, the 30-card maximum (053's load()).
  '053': () => ({
    ctcg_custom_v1: j([
      {
        id: 'tseed1',
        category: 'hispanic',
        q: 'Which two countries share the island of Hispaniola, and which of the two has Spanish as its official language while the other uses French and Haitian Creole?',
        a: 'The Dominican Republic (Spanish) and Haiti (French and Haitian Creole) — the Dominican Republic is the Spanish-speaking one, on the eastern two-thirds of the island'
      },
      { id: 'tseed2', category: 'francophone', q: 'What city is the capital of Senegal?', a: 'Dakar' },
      { id: 'tseed3', category: 'global', q: 'What is the Maori name for New Zealand?', a: 'Aotearoa' }
    ]),
    ctcg_hidden_v1: j([ 'b3' ]),
    ctcg_settings_v1: j({ category: '', cardCount: '30' }),
  }),

  // 060 — twelve students, five events, one student with no results and one missing cell (060's load()).
  '060': () => ({
    fsat_tracker_v1: j({
      roster: [
        'Ada Lovelace',
        'Marco Polo',
        'Nellie Bly',
        'Aiden Smith',
        'Bella Cruz',
        'Carlos Diaz',
        'Dana Lee',
        'Maximiliana Featherstonehaugh-Abernathy',
        'Omar Haddad',
        'Priya Nair',
        'Quentin Brooks',
        'Rosa Vega'
      ],
      events: [
        { id: 'eseed1', name: 'Mile Run', type: 'time' },
        { id: 'eseed2', name: 'Push-ups', type: 'count' },
        { id: 'eseed3', name: 'Sit-ups', type: 'count' },
        { id: 'eseed4', name: 'Sit-and-reach flexibility (cm, best of three tries)', type: 'count' },
        { id: 'eseed5', name: 'Shuttle Run', type: 'time' }
      ],
      results: {
        'Ada Lovelace|eseed1': '7:10',
        'Ada Lovelace|eseed2': '8',
        'Ada Lovelace|eseed3': '20',
        'Ada Lovelace|eseed4': '18',
        'Ada Lovelace|eseed5': '0:11.0',
        'Marco Polo|eseed1': '8:14',
        'Marco Polo|eseed2': '11',
        'Marco Polo|eseed3': '22',
        'Marco Polo|eseed4': '19',
        'Marco Polo|eseed5': '0:12.1',
        'Nellie Bly|eseed1': '9:18',
        'Nellie Bly|eseed2': '14',
        'Nellie Bly|eseed4': '20',
        'Nellie Bly|eseed5': '0:13.2',
        'Aiden Smith|eseed1': '10:22',
        'Aiden Smith|eseed2': '17',
        'Aiden Smith|eseed3': '26',
        'Aiden Smith|eseed4': '21',
        'Aiden Smith|eseed5': '0:14.3',
        'Bella Cruz|eseed1': '11:26',
        'Bella Cruz|eseed2': '20',
        'Bella Cruz|eseed3': '28',
        'Bella Cruz|eseed4': '22',
        'Bella Cruz|eseed5': '0:11.4',
        'Dana Lee|eseed1': '8:34',
        'Dana Lee|eseed2': '26',
        'Dana Lee|eseed3': '32',
        'Dana Lee|eseed4': '24',
        'Dana Lee|eseed5': '0:13.6',
        'Maximiliana Featherstonehaugh-Abernathy|eseed1': '9:38',
        'Maximiliana Featherstonehaugh-Abernathy|eseed2': '29',
        'Maximiliana Featherstonehaugh-Abernathy|eseed3': '34',
        'Maximiliana Featherstonehaugh-Abernathy|eseed4': '25',
        'Maximiliana Featherstonehaugh-Abernathy|eseed5': '0:14.7',
        'Omar Haddad|eseed1': '10:42',
        'Omar Haddad|eseed2': '32',
        'Omar Haddad|eseed3': '36',
        'Omar Haddad|eseed4': '26',
        'Omar Haddad|eseed5': '0:11.8',
        'Priya Nair|eseed1': '11:46',
        'Priya Nair|eseed2': '35',
        'Priya Nair|eseed3': '38',
        'Priya Nair|eseed4': '27',
        'Priya Nair|eseed5': '0:12.9',
        'Quentin Brooks|eseed1': '7:50',
        'Quentin Brooks|eseed2': '38',
        'Quentin Brooks|eseed3': '40',
        'Quentin Brooks|eseed4': '28',
        'Quentin Brooks|eseed5': '0:13.0',
        'Rosa Vega|eseed1': '8:54',
        'Rosa Vega|eseed2': '41',
        'Rosa Vega|eseed3': '42',
        'Rosa Vega|eseed4': '29',
        'Rosa Vega|eseed5': '0:14.1'
      }
    }),
  }),

  // 061 — a locked seed at 30 rows on hard, so the sheet is the same every run and as long as it gets (061's settings).
  '061': () => ({
    fdp_settings_v1: j({ difficulty: 'hard', givenForm: 'random', rowCount: 30, lockSeed: true, seed: 20261003 }),
  }),

  // 064 — an eleven-card deck at standard size, one card with a long name, seven stats and five facts (064's v2 deck doc).
  '064': () => ({
    'htcm:list': j([ 'Explorers and inventors' ]),
    'htcm:data:Explorers and inventors': j({
      v: 2,
      cards: [
        {
          id: 'cseed1',
          name: 'Ada Lovelace',
          image: null,
          stats: [
            { label: 'Born', value: '1815' },
            { label: 'Field', value: 'Mathematics' },
            { label: 'Known for', value: 'First published algorithm' }
          ],
          facts: [ 'Wrote notes on the Analytical Engine.', 'Worked with Charles Babbage.' ],
          theme: null,
          meta: { rarity: 'legendary', setName: 'Unit 4 Research', cardNo: 1, setSize: 11, stars: 5 }
        },
        {
          id: 'cseed2',
          name: 'Marco Polo',
          image: null,
          stats: [ { label: 'Born', value: '1254' }, { label: 'From', value: 'Venice' }, { label: 'Travelled', value: '24 years' } ],
          facts: [ 'Travelled the Silk Road to China.', 'His book described Asia to European readers.' ],
          theme: null,
          meta: { rarity: 'rare', setName: 'Unit 4 Research', cardNo: 2, setSize: 11, stars: 2 }
        },
        {
          id: 'cseed3',
          name: 'Nellie Bly',
          image: null,
          stats: [ { label: 'Born', value: '1864' }, { label: 'Field', value: 'Journalism' }, { label: 'Trip', value: '72 days' } ],
          facts: [ 'Went around the world in 72 days.', 'Pioneered investigative reporting.' ],
          theme: null,
          meta: { rarity: 'epic', setName: 'Unit 4 Research', cardNo: 3, setSize: 11, stars: 3 }
        },
        {
          id: 'cseed4',
          name: 'Maximiliana Featherstonehaugh-Abernathy of the Northern Territories',
          image: null,
          stats: [
            { label: 'Born', value: 'An uncertain year somewhere between 1702 and 1711' },
            { label: 'Occupation', value: 'Cartographer, navigator and natural philosopher' },
            { label: 'Voyages', value: '14' },
            { label: 'Languages', value: '6' },
            { label: 'Maps drawn', value: '212' },
            { label: 'Ships', value: '3' },
            { label: 'Legacy', value: 'Coastal survey method' }
          ],
          facts: [
            'An invented figure with a deliberately long name, so a clipped title or stat shows up on paper.',
            'Charted more than two hundred harbours and kept a daily journal for thirty-one years without missing a single entry, even while ill.',
            'Taught navigation to apprentices.',
            'Corresponded with scholars in four countries.',
            'Her instruments are imagined to sit in a museum.'
          ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 4, setSize: 11, stars: 4 }
        },
        {
          id: 'cseed5',
          name: 'Aiden Smith',
          image: null,
          stats: [ { label: 'Role', value: 'Inventor' }, { label: 'Patents', value: '12' } ],
          facts: [ 'Built a better lantern.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 5, setSize: 11, stars: 5 }
        },
        {
          id: 'cseed6',
          name: 'Bella Cruz',
          image: null,
          stats: [ { label: 'Role', value: 'Botanist' }, { label: 'Species named', value: '40' } ],
          facts: [ 'Catalogued mountain flowers.', 'Kept a pressed-plant herbarium.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 6, setSize: 11, stars: 0 }
        },
        {
          id: 'cseed7',
          name: 'Carlos Diaz',
          image: null,
          stats: [ { label: 'Role', value: 'Engineer' }, { label: 'Bridges', value: '9' } ],
          facts: [ 'Designed a suspension bridge.' ],
          theme: null,
          meta: { rarity: 'rare', setName: 'Unit 4 Research', cardNo: 7, setSize: 11, stars: 1 }
        },
        {
          id: 'cseed8',
          name: 'Dana Lee',
          image: null,
          stats: [ { label: 'Role', value: 'Astronomer' }, { label: 'Comets', value: '3' } ],
          facts: [ 'Mapped the southern sky.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 8, setSize: 11, stars: 2 }
        },
        {
          id: 'cseed9',
          name: 'Omar Haddad',
          image: null,
          stats: [ { label: 'Role', value: 'Physician' }, { label: 'Books', value: '5' } ],
          facts: [ 'Wrote a guide to herbal medicine.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 9, setSize: 11, stars: 3 }
        },
        {
          id: 'cseed10',
          name: 'Priya Nair',
          image: null,
          stats: [ { label: 'Role', value: 'Mathematician' }, { label: 'Proofs', value: '17' } ],
          facts: [ 'Studied prime numbers.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 10, setSize: 11, stars: 4 }
        },
        {
          id: 'cseed11',
          name: 'Republic of Verdania',
          image: null,
          stats: [ { label: 'Capital', value: 'Port Azul' }, { label: 'Population', value: '4.2 million' }, { label: 'Area', value: '88,000 km²' } ],
          facts: [ 'An invented country card.', 'Exports coffee and copper.' ],
          theme: null,
          meta: { rarity: 'common', setName: 'Unit 4 Research', cardNo: 11, setSize: 11, stars: 5 }
        }
      ],
      settings: { size: 'standard', theme: 'classic' }
    }),
    'htcm:current': 'Explorers and inventors',
  }),

  // 067 — eight measures and 24 notes with a long tempo line; the pitch tab is print-audit-prep.mjs's (067's settings).
  '067': () => ({
    msrg_settings_v1: j({
      v: 1,
      activeTab: 'rhythm',
      rhythm: {
        timeSig: '4',
        numMeasures: '8',
        tempo: 'Allegro moderato, quarter note = 92, clap and count aloud',
        pool: [ 'quarter', 'eighthPair', 'half', 'quarterRest' ],
        notation: 'drawn'
      },
      pitch: { clef: 'treble', minNote: 'C4', maxNote: 'G5', numNotes: '24', showNames: true }
    }),
  }),

  // 068 — a roster and two logged contacts (parent-contact-log/test/smoke-reasons.mjs).
  '068': () => ({
    pcl_roster_v1: j(['Sable Whitfield']),
    pcl_entries_v1: j([
      { id: 'g1', student: 'Sable Whitfield', date: '2026-02-01', method: 'Phone call', reason: 'Attendance', initials: 'DM', outcome: 'Fourth absence' },
      { id: 'g2', student: 'Sable Whitfield', date: '2026-02-02', method: 'Email', reason: 'Behavior', initials: 'DM', outcome: 'Phone out in class' },
    ]),
  }),

  // 069 — eight stations at six to a page, one with long instructions and one with none (069's named library).
  '069': () => ({
    pe_circuits_v1: j([ 'Period 3 Tournament Warm-Up' ]),
    'pe_circuit_v1:Period 3 Tournament Warm-Up': j({
      name: 'Period 3 Tournament Warm-Up',
      title: 'Period 3 Tournament Warm-Up — rotate clockwise on the whistle',
      cardsPerPage: '6',
      stations: [
        { id: 's1', emoji: '🏃', name: 'High Knees', duration: '30 seconds', instructions: 'Jog in place, driving knees up to hip height.' },
        {
          id: 's2',
          emoji: '🤸',
          name: 'Jumping Jacks',
          duration: '30 seconds',
          instructions: 'Feet together to feet apart, arms overhead each time.'
        },
        {
          id: 's3',
          emoji: '💪',
          name: 'Push-Ups',
          duration: '10 reps',
          instructions: 'Full or modified (knees down) — chest to the floor, elbows at 45°.'
        },
        {
          id: 's4',
          emoji: '🦵',
          name: 'Walking Lunges With a Twist Toward the Front Knee',
          duration: '10 per leg, then 10 more backward',
          instructions: 'Step forward into a lunge with the back knee close to the floor, rotate your shoulders toward the front knee, hold for a two-count, return to centre and alternate legs. Keep your chest tall and your front knee behind your toes the whole time. If you finish early, repeat the set walking backward to the cone.'
        },
        {
          id: 's5',
          emoji: '🧘',
          name: 'Plank Hold',
          duration: '20 seconds',
          instructions: 'Forearms and toes on the floor, straight line from head to heels.'
        },
        {
          id: 's6',
          emoji: '⏱️',
          name: 'Shuttle Run',
          duration: '3 trips',
          instructions: 'Sprint to the far cone and back, touching the line each time.'
        },
        { id: 's7', emoji: '', name: 'Arm Circles', duration: '20 seconds each direction', instructions: '' },
        {
          id: 's8',
          emoji: '🏋️',
          name: 'Bodyweight Squats',
          duration: '15 reps',
          instructions: 'Feet shoulder-width apart, sit hips back, chest up.'
        }
      ]
    }),
    pe_circuit_current_v1: 'Period 3 Tournament Warm-Up',
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

  // 074 — ten rows, every symbol, fourteen labels at the small size, one with long text (074's queue).
  '074': () => ({
    sslm_queue_v1: j({
      labelSize: 'small',
      queue: [
        { id: 'l1', symbol: 'flammable', text: 'Ethanol', qty: 2 },
        {
          id: 'l2',
          symbol: 'corrosive',
          text: 'Hydrochloric acid 1 M — teacher use only, return to locked cabinet B after every period',
          qty: 2
        },
        { id: 'l3', symbol: 'toxic', text: 'Copper sulfate', qty: 1 },
        { id: 'l4', symbol: 'biohazard', text: 'Used agar plates', qty: 1 },
        { id: 'l5', symbol: 'electrical', text: 'Power supplies', qty: 1 },
        { id: 'l6', symbol: 'sharp', text: 'Scalpels & dissecting pins', qty: 2 },
        { id: 'l7', symbol: 'eyeprotect', text: 'Goggles — Period 1', qty: 1 },
        { id: 'l8', symbol: 'hot', text: 'Hot plates', qty: 1 },
        { id: 'l9', symbol: 'fragile', text: 'Graduated cylinders 100 mL', qty: 2 },
        { id: 'l10', symbol: 'none', text: 'Bin 4: Rock samples', qty: 1 }
      ]
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

  // 082 — six sources of six types in MLA, the website one with a long title and URL (082's named library).
  '082': () => ({
    'citegen:list': j([ 'Earth Science Research Project' ]),
    'citegen:data:Earth Science Research Project': j({
      name: 'Earth Science Research Project',
      style: 'mla',
      sources: [
        {
          id: 'c1',
          type: 'book',
          fields: { author: 'Lovelace, Ada', title: 'Notes on Layered Rock', publisher: 'Example Press', city: 'Boston', year: '2019' }
        },
        {
          id: 'c2',
          type: 'website',
          fields: {
            author: 'Example Geological Society',
            title: 'How Sedimentary Layers Record Ten Thousand Years of Floods, Droughts and Volcanic Ash in a Single River Valley',
            container: 'Example Earth Science Learning Portal',
            publisher: 'Example Geological Society Education Office',
            pubMonth: 'March',
            pubDay: '4',
            pubYear: '2021',
            url: 'https://example.org/learning/earth-science/sedimentary-layers/how-layers-record-floods-droughts-and-volcanic-ash?unit=3&lesson=12',
            accessMonth: 'September',
            accessDay: '28',
            accessYear: '2026'
          }
        },
        {
          id: 'c3',
          type: 'magazine',
          fields: {
            author: 'Polo, Marco',
            title: 'Walking the Old Trade Routes',
            container: 'Example Traveler',
            pubMonth: 'June',
            pubDay: '',
            pubYear: '2020',
            pages: '22-25',
            url: ''
          }
        },
        {
          id: 'c4',
          type: 'journal',
          fields: {
            author: 'Bly, Nellie',
            title: 'Field Notes From a Cave Survey',
            container: 'Journal of Example Studies',
            volume: '12',
            issue: '3',
            year: '2018',
            pages: '110-125',
            url: ''
          }
        },
        {
          id: 'c5',
          type: 'wikipedia',
          fields: {
            title: 'Stratigraphy',
            updatedMonth: 'August',
            updatedDay: '15',
            updatedYear: '2026',
            url: 'https://en.wikipedia.org/wiki/Stratigraphy',
            accessMonth: 'September',
            accessDay: '28',
            accessYear: '2026'
          }
        },
        {
          id: 'c6',
          type: 'video',
          fields: {
            author: 'Example Science Channel',
            title: 'Reading a Rock Wall',
            container: 'YouTube',
            pubMonth: 'January',
            pubDay: '9',
            pubYear: '2022',
            url: 'https://example.org/watch/rock-wall'
          }
        }
      ]
    }),
    'citegen:current': 'Earth Science Research Project',
  }),
};
