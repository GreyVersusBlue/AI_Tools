// smoke-share-rollout.mjs — Path 6 P3: the builders that could not hand their
// work to another teacher at all. Increment 1 was six SINGLE-DOCUMENT tools;
// increment 2 added the three that keep a NAMED LIBRARY, which is a different
// claim and has its own section below; increment 3 added five more of those
// (041, 051, 069, 082, 083) and no new machinery — which is the point of a
// table-driven suite. Increment 4 adds six more single-document tools (049,
// 058, 074, 076, 078) plus 075, which is the first adopter that MERGES an
// arrival instead of replacing what is there, and section 5c is its.
//
//   node Tools/share/test/smoke-share-rollout.mjs      (or: npm run test:share-rollout)
//
// P1 and P2 covered the tools that ALREADY had share code; each got its own
// per-tool suite because each had its own hand-written bar to delete and its
// own bug in it. P3 is different work: these six pages had no share code, no
// state-link.js and no importer, so what is under test is the same wiring six
// times over. One rollout suite says that once — the shape
// smoke-picker-rollout.mjs and smoke-stage-rollout.mjs already use — and grows
// a row per tool as the rest of P3 lands.
//
// Per page, driven in a real browser:
//
//   0. the four script tags, in dependency order. share.js throws at mount
//      without state-link.js, and its QR row needs qr-draw.js plus the
//      vendored encoder. A page that loads them out of order loses the button
//      on load and nothing says why. Checked statically, off git's own files.
//   1. the toolbar has a real Share button, and the sheet opens on it.
//   2. Copy link produces a `?<param>=` link and the note under the toolbar
//      says so — every one of these tools used alert() or nothing before.
//   3. what travels is what the page's comment says travels. 073 is the row
//      this section exists for: its storage key is the only one in the batch
//      that _shared/tool-registry.js marks `student: true`, and its payload
//      must carry the milestone schedule and NO student name, tick or note.
//   4. the link opens elsewhere: the receiving browser shows the shared work
//      and the parameter is consumed, so a refresh cannot import it twice.
//   5. THE CONFIRM, on the single-document tools. Five of the six in increment
//      1 keep one document, so an arrival lands on top of it. Declining must
//      keep the local copy — a real outcome with a sentence of its own — and,
//      because share.js clears the parameter before the payload is judged, a
//      refresh must not ask again. 081 is exempt and is asserted NOT to ask:
//      nothing it stores is authored.
//   5c. MERGED BESIDE, on 075 alone. Its one key holds a LIST and it already
//      had an importer that adds rows and skips duplicates, so a link merges
//      and must not ask. What is asserted is what SURVIVES: the rows already
//      on the device, the rows that arrived, and — because the duplicate
//      check is the only guard against loss here — that opening the same
//      link twice adds nobody twice.
//   5b. SAVED BESIDE, on the library tools (047, 065, 072, 041, 051, 069, 082,
//      083). These keep a list
//      of names plus a blob per name, so there is nowhere for an arrival to
//      land destructively and there must be NO dialog at all. The claim worth
//      testing is the collision: a link whose document has the SAME NAME as
//      one already on the device must land under a free name, leave the
//      teacher's blob byte-for-byte as it was, and leave the list two long.
//      That is the failure mode "save it under its own name" invites, and it
//      is invisible on an empty install — which is how every one of these
//      would be opened in a demo.
//   6. the sheet's rows, the QR budget, and the { aplp, state } envelope the
//      Download row writes, read back through Share.unwrap. The envelope is
//      the FULL state and the link is the stripped one, so what is asserted is
//      that the file put through the same image policy IS the link's payload —
//      041 and 083 are the first rows whose fixture carries a picture, and the
//      exact-equality version of this assertion was true only because none of
//      the first nine did.
//   7. axe on the OPEN SHEET. The site-wide sweep opens every page with empty
//      storage and cannot click, so this dialog is scanned nowhere else; this
//      is rank 13's own mechanism, free to a suite that has prepped the state.
//      Scanned in dark too on 052, which is the batch's widest palette.
//   8. a mangled link fails in words rather than opening blank.
//   9. no console errors and nothing left the site, on every page opened.
//
// 081 is the odd one and has its own section: it shares a SEED, not problems,
// so the receiving device must regenerate the same set — which is checked by
// comparing the rendered problem text on both machines, not by trusting that
// the seed arrived.
//
// Exits 1 on any failure. Every name here is invented.

import fs from 'fs';
import path from 'path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8415;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/** `doc.source.title` as a path, so a fixture's identifying field can be
    nested. A bare name is the one-segment case, which is what the first three
    library rows use. */
const atPath = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const setAt = (obj, path, value) => {
  const parts = String(path).split('.');
  const last = parts.pop();
  const host = parts.reduce((o, k) => o[k], obj);
  host[last] = value;
};

/* One row per adopter. The fixture is written straight into the tool's own
   storage before the page loads, so "there is work here" is real stored state
   rather than typing driven through the UI — the fixtures are small and the
   point of the suite is the share wiring, not each tool's editor. `expect` is
   read off the payload; `absent` is what must not be in it, as a string search
   over the whole JSON.

   Two storage shapes, and `library` is what tells them apart. A single-document
   tool has one `key`; a library tool has a list key, a per-name data prefix and
   a pointer to the current name, so seeding it means writing three entries and
   the fixture document needs a `docName` to be filed under. */
const TOOLS = [
  {
    n: '052', file: '052-cognates-false-friends-builder.html', param: 'cognates',
    key: 'cffb_list_v1', slug: 'cognates-false-friends-builder', confirms: true,
    state: {
      lang: 'Portuguese',
      cognates: [{ id: 'c1', target: 'animal', english: 'animal' }],
      falseFriends: [{ id: 'f1', target: 'puxar', looksLike: 'push', actual: 'Actually means "to pull".' }],
    },
    expect: p => [
      [p.lang === 'Portuguese', 'the payload carries the language'],
      [p.cognates.length === 1 && p.cognates[0].target === 'animal', 'and the cognate pairs'],
      [p.falseFriends.length === 1 && p.falseFriends[0].actual.indexOf('to pull') !== -1, 'and the false friends'],
    ],
    arrived: page => page.inputValue('#langName'),
    arrivedWant: 'Portuguese',
  },
  {
    n: '057', file: '057-dichotomous-key-builder.html', param: 'key',
    key: 'dkb_key_v1', slug: 'dichotomous-key-builder', confirms: true,
    state: {
      title: 'Rocks of the Schoolyard',
      steps: [
        { id: 'sA', a: { text: 'Shiny', leadsTo: 'sB', result: '', examples: '' },
                    b: { text: 'Dull', leadsTo: '', result: 'Sedimentary', examples: 'Shale' } },
        { id: 'sB', a: { text: 'Layered', leadsTo: '', result: 'Metamorphic', examples: 'Slate' },
                    b: { text: 'Not layered', leadsTo: '', result: 'Igneous', examples: 'Basalt' } },
      ],
    },
    expect: p => [
      [p.title === 'Rocks of the Schoolyard', 'the payload carries the key title'],
      [p.steps.length === 2, 'and both couplets'],
      /* The branch, not just the text. Fresh ids on import would keep every
         word of this key and cut the link between its two steps. */
      [p.steps[0].a.leadsTo === p.steps[1].id, 'and step 1a still points at step 2, by id'],
    ],
    arrived: page => page.inputValue('#keyTitle'),
    arrivedWant: 'Rocks of the Schoolyard',
  },
  {
    n: '070', file: '070-peer-feedback-checklist-generator.html', param: 'checklist',
    key: 'pfc_checklist_v1', slug: 'peer-feedback-checklist-generator', confirms: true,
    state: {
      assignmentName: 'Lab Notebook Swap', copyCount: 9, ratingStyle: 'three',
      categories: [{ id: 'k1', name: 'Data', items: [{ id: 'i1', text: 'Units are on every measurement' }] }],
    },
    expect: p => [
      [p.assignmentName === 'Lab Notebook Swap', 'the payload carries the assignment name'],
      [p.copyCount === 9, 'and the number of copies, which is the class it was built for'],
      [p.ratingStyle === 'three', 'and the rating style'],
      [p.categories[0].items[0].text.indexOf('Units') === 0, 'and every line of every category'],
    ],
    arrived: page => page.inputValue('#assignmentName'),
    arrivedWant: 'Lab Notebook Swap',
  },
  {
    n: '073', file: '073-science-fair-project-tracker.html', param: 'milestones',
    key: 'sfpt_tracker_v1', slug: 'science-fair-project-tracker', confirms: true,
    state: {
      roster: ['Ada Lovelace', 'Ibn al-Haytham'],
      milestones: [{ id: 'm1', name: 'Question & Hypothesis', due: '2026-10-02' },
                   { id: 'm2', name: 'Board Complete', due: '2026-11-14' }],
      done: { 'Ada Lovelace|m1': true },
      notes: { 'Ada Lovelace|m1': 'Needs a measurable variable' },
    },
    expect: p => [
      [p.milestones.length === 2, 'the payload carries the milestone schedule'],
      [p.milestones[1].due === '2026-11-14', 'with its due dates'],
      [p.roster === undefined && p.done === undefined && p.notes === undefined,
        'and carries no roster, done map or notes field at all'],
    ],
    /* The privacy claim, as a search over the whole encoded payload rather
       than over the fields this suite happened to name. */
    absent: ['Ada Lovelace', 'Ibn al-Haytham', 'measurable variable'],
    /* By POSITION, not by id: a milestone that matches one already on the
       device reuses the LOCAL id, so on a fresh install this row's `m1` is
       gone by the time it renders — which is the merge working, not a bug. */
    arrived: page => page.$$eval('[data-mname]', els => els.length ? els[0].value : null),
    arrivedWant: 'Question & Hypothesis',
  },
  {
    n: '079', file: '079-verb-conjugation-poster-generator.html', param: 'poster',
    key: 'vcp_poster_v1', slug: 'verb-conjugation-poster-generator', confirms: true,
    state: {
      title: 'Italian — Passato Prossimo', colorPanels: false,
      persons: ['io', 'tu', 'lui/lei'],
      panels: [{ id: 'p1', name: '-ARE', forms: ['ho parlato', 'hai parlato', 'ha parlato'], color: 'none' }],
    },
    expect: p => [
      [p.title.indexOf('Passato') !== -1, 'the payload carries the poster title'],
      [p.persons.length === 3, 'and its persons'],
      [p.panels[0].forms[1] === 'hai parlato', 'and every form of every panel'],
      [p.colorPanels === false, 'and the poster’s own colour setting'],
    ],
    arrived: page => page.inputValue('#posterTitle'),
    arrivedWant: 'Italian — Passato Prossimo',
  },

  /* ── increment 2: the three named-library tools ───────────────────────── */
  {
    n: '047', file: '047-art-critique-worksheet-generator.html', param: 'worksheet',
    slug: 'art-critique-worksheet-generator',
    library: { list: 'acw_worksheets_list_v1', data: 'acw_worksheet_data_v1:', current: 'acw_worksheet_current_v1' },
    docName: 'Sculpture Unit Critique',
    state: {
      name: 'Sculpture Unit Critique', activityName: 'Clay Vessels Gallery Walk', copyCount: 24, mode: 'self',
      steps: [
        { key: 'describe', label: 'Describe', prompt: 'What did I make?',
          subs: [{ id: 'q1', text: 'What clay body did I use?' }] },
        { key: 'judge', label: 'Judge', prompt: 'Is this piece finished?',
          subs: [{ id: 'q2', text: 'What would I glaze differently?' }] },
      ],
    },
    expect: p => [
      [p.activityName === 'Clay Vessels Gallery Walk', 'the payload carries the activity name'],
      [p.copyCount === 24, 'and the copy count, which is the class it was built for'],
      [p.mode === 'self', 'and the worksheet mode, which rewords every default prompt'],
      [p.steps.length === 2 && p.steps[1].prompt === 'Is this piece finished?', 'and every step’s edited prompt'],
      [p.steps[0].subs[0].text.indexOf('clay body') !== -1, 'and every follow-up question'],
    ],
    arrived: page => page.inputValue('#activityName'),
    arrivedWant: 'Clay Vessels Gallery Walk',
    localField: 'activityName',
  },
  {
    n: '065', file: '065-lab-report-template-builder.html', param: 'template',
    slug: 'lab-report-template-builder',
    library: { list: 'lrt_list_v1', data: 'lrt_data_v1:', current: 'lrt_current_v1' },
    docName: 'Acid-Base Lab',
    state: {
      name: 'Acid-Base Lab', title: 'Acid-Base Reactions', objective: 'Find the neutral point.',
      hypothesisPrompt: 'If more base is added, then ____.',
      materials: [{ id: 'm1', text: 'Goggles' }, { id: 'm2', text: 'Burette' }],
      procedure: [{ id: 'p1', text: 'Fill the burette to zero.' }],
      columns: [{ id: 'c1', text: 'Drops', type: 'number', units: 'drops' },
                { id: 'c2', text: 'Colour', type: 'text', units: '' }],
      dataRows: 8,
      observationsPrompt: 'When did the colour hold?',
      conclusion: [{ id: 'k1', text: 'Was the hypothesis supported?' }],
    },
    expect: p => [
      [p.title === 'Acid-Base Reactions', 'the payload carries the lab title'],
      [p.objective === 'Find the neutral point.', 'and the objective'],
      [p.materials.length === 2 && p.procedure[0].text.indexOf('burette') !== -1, 'and the materials and procedure'],
      /* The kind and units are what make a column print a format hint, and
         they were added after the columns themselves were. */
      [p.columns[0].type === 'number' && p.columns[0].units === 'drops',
        'and each column’s kind and units, not just its name'],
      [p.dataRows === 8, 'and how many blank data rows to print'],
      [p.conclusion[0].text.indexOf('hypothesis') !== -1, 'and the conclusion questions'],
    ],
    arrived: page => page.inputValue('#labTitle'),
    arrivedWant: 'Acid-Base Reactions',
    localField: 'title',
  },
  {
    n: '072', file: '072-plot-diagram-builder.html', param: 'diagram',
    slug: 'plot-diagram-builder',
    library: { list: 'pdb_list_v1', data: 'pdb_data_v1:', current: 'pdb_current_v1' },
    docName: 'Hatchet ch. 1-8',
    state: {
      title: 'Hatchet', author: 'Gary Paulsen',
      characters: 'Brian Robeson', setting: 'The Canadian wilderness',
      conflict: 'Surviving alone after the crash', theme: 'What a person finds out about themselves',
      stages: { exposition: 'Brian boards the bush plane', rising: 'The pilot has a heart attack',
                climax: 'The plane goes into the lake', falling: 'Brian builds a shelter',
                resolution: 'The search plane finds him' },
    },
    expect: p => [
      [p.title === 'Hatchet' && p.author === 'Gary Paulsen', 'the payload carries the story title and author'],
      [p.characters === 'Brian Robeson' && p.theme.indexOf('themselves') !== -1, 'and all four story elements'],
      [Object.keys(p.stages).length === 5 && p.stages.climax.indexOf('lake') !== -1,
        'and all five plot stages'],
      /* The library key is the diagram's identity and is NOT in `state`, so a
         teacher who renamed it away from the story title would lose that name
         if getState() shared the stored blob as-is. */
      [p.name === 'Hatchet ch. 1-8', 'and the name the teacher filed it under, which is not part of the document'],
    ],
    arrived: page => page.inputValue('#storyTitle'),
    arrivedWant: 'Hatchet',
    localField: 'title',
  },

  /* ── increment 3: five more named-library tools ───────────────────────── */
  {
    n: '041', file: '041-formula-sheet-builder.html', param: 'sheet',
    slug: 'formula-sheet-builder',
    library: { list: 'gvb-formula-sheet:list', data: 'gvb-formula-sheet:data:', current: 'gvb-formula-sheet:current' },
    docName: 'Unit 4 — Area & Volume',
    state: {
      name: 'Unit 4 — Area & Volume', title: 'Unit 4 Reference Sheet', columns: 2, pageSize: 'full',
      allowedOnly: true, assessment: 'Unit 4 Test',
      items: [
        { name: 'Area of a trapezoid', expression: 'A = ½(b₁ + b₂)h', note: 'Both bases, then the height.',
          workedExample: 'b₁ = 4, b₂ = 6, h = 3 → A = 15', allowed: true,
          variables: [{ symbol: 'h', meaning: 'perpendicular height' }],
          /* A diagram pasted onto a formula. It must be in the DOWNLOAD and
             out of the LINK — the policy share.js applies to every adopter. */
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
        { name: 'Volume of a cylinder', expression: 'V = πr²h', note: '', workedExample: '', allowed: false, variables: [] },
      ],
    },
    expect: p => [
      [p.title === 'Unit 4 Reference Sheet', 'the payload carries the printed title'],
      [p.items.length === 2 && p.items[0].expression.indexOf('b₁') !== -1, 'and every formula, expression first'],
      [p.items[0].variables[0].meaning === 'perpendicular height', 'and each formula’s variable key'],
      [p.items[0].workedExample.indexOf('A = 15') !== -1, 'and its worked example'],
      /* The tick is the difference between a reference sheet and a permitted
         subset, and the assessment name is what the printed banner claims. */
      [p.allowedOnly === true && p.items[1].allowed === false,
        'and which formulas are ticked as allowed on the assessment'],
      [p.assessment === 'Unit 4 Test', 'and the assessment the sheet is approved for'],
      [p.columns === 2 && p.pageSize === 'full', 'and the print layout'],
      /* stripImages() replaces a data: URL with null. The Download row's
         envelope, checked in section 6, still has the picture. */
      [p.items[0].image === null, 'and the pasted diagram is dropped from the link, not carried in it'],
    ],
    absent: ['iVBORw0KGgo'],
    imageField: 'items.0.image',
    arrived: page => page.inputValue('#sheetTitle'),
    arrivedWant: 'Unit 4 Reference Sheet',
    localField: 'title',
  },
  {
    n: '051', file: '051-classroom-label-maker.html', param: 'labels',
    slug: 'classroom-label-maker',
    library: { list: 'clm_lists_v1', data: 'clm_list_v1:', current: 'clm_current_v1' },
    docName: 'Kitchen unit — la cocina',
    state: {
      name: 'Kitchen unit — la cocina', lang: 'fr-FR',
      words: [{ target: 'la porte', english: 'the door' }, { target: 'la fenêtre', english: 'the window' }],
    },
    expect: p => [
      [p.words.length === 2 && p.words[1].target === 'la fenêtre', 'the payload carries every target word'],
      [p.words[0].english === 'the door', 'and its English'],
      /* The language is what the printed QR codes speak in, so a list shared
         without it would print labels that say the words in the wrong voice. */
      [p.lang === 'fr-FR', 'and the language the pronunciation links are spoken in'],
    ],
    arrived: page => page.inputValue('#wordInput'),
    arrivedWant: 'la porte: the door\nla fenêtre: the window',
    localField: 'words.0.target',
  },
  {
    n: '069', file: '069-pe-warmup-circuit-generator.html', param: 'circuit',
    slug: 'pe-warmup-circuit-generator',
    library: { list: 'pe_circuits_v1', data: 'pe_circuit_v1:', current: 'pe_circuit_current_v1' },
    docName: 'Basketball unit warm-up',
    state: {
      name: 'Basketball unit warm-up', title: 'Monday Warm-Up Circuit', cardsPerPage: '2',
      stations: [
        { id: 's1', emoji: '🏃', name: 'Baseline Sprints', duration: '30 seconds', instructions: 'Sideline to sideline, jog back.' },
        { id: 's2', emoji: '🤸', name: 'Defensive Slides', duration: '20 seconds', instructions: 'Stay low, no crossing the feet.' },
      ],
    },
    expect: p => [
      [p.title === 'Monday Warm-Up Circuit', 'the payload carries the printed header'],
      [p.stations.length === 2 && p.stations[1].name === 'Defensive Slides', 'and every station'],
      [p.stations[0].duration === '30 seconds', 'and how long each one runs'],
      [p.stations[1].instructions.indexOf('Stay low') === 0, 'and the instructions printed on its card'],
      [p.stations[0].emoji === '🏃', 'and the icon that makes a card readable across a gym'],
      [p.cardsPerPage === '2', 'and how many cards go on a page'],
    ],
    arrived: page => page.inputValue('#circuitTitle'),
    arrivedWant: 'Monday Warm-Up Circuit',
    localField: 'title',
  },
  {
    n: '082', file: '082-citation-generator.html', param: 'citations',
    slug: 'citation-generator',
    library: { list: 'citegen:list', data: 'citegen:data:', current: 'citegen:current' },
    docName: 'Space Race research',
    state: {
      name: 'Space Race research', style: 'apa',
      sources: [
        { id: 'c1', type: 'book', fields: { author: 'Shetterly, Margot Lee', title: 'Hidden Figures', publisher: 'William Morrow', year: '2016' } },
        { id: 'c2', type: 'website', fields: { author: 'NASA', title: 'Apollo 11 Mission Overview', container: 'NASA History', url: 'https://example.org/apollo' } },
      ],
    },
    expect: p => [
      [p.sources.length === 2, 'the payload carries every source'],
      [p.sources[0].type === 'book' && p.sources[1].type === 'website', 'with its type, which decides how it formats'],
      [p.sources[0].fields.author === 'Shetterly, Margot Lee', 'and every field typed for it'],
      /* The style is the list's, not the device's: a colleague opening an APA
         list should not get it back in MLA because that is what their browser
         last had open. */
      [p.style === 'apa', 'and the style the list is formatted in'],
    ],
    /* The rendered entry, not an input, because that is where this tool puts
       a source. The fallback branch prints what it found instead. */
    arrived: page => page.$eval('#listWrap', el =>
      el.textContent.indexOf('Hidden Figures') !== -1 ? 'Hidden Figures' : el.textContent.trim().slice(0, 60)),
    arrivedWant: 'Hidden Figures',
    localField: 'sources.0.fields.title',
  },
  {
    n: '083', file: '083-propaganda-analysis-worksheet-generator.html', param: 'analysis',
    slug: 'propaganda-analysis-worksheet-generator',
    library: { list: 'propa:list', data: 'propa:data:', current: 'propa:current' },
    docName: 'Rosie the Riveter',
    state: {
      name: 'Rosie the Riveter', level: 'gt',
      source: {
        title: 'We Can Do It!', creator: 'J. Howard Miller', date: '1943',
        origin: 'Westinghouse War Production Co-Ordinating Committee',
        /* The scanned poster. It must be in the DOWNLOAD and out of the LINK. */
        imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      },
    },
    expect: p => [
      [p.source.title === 'We Can Do It!', 'the payload carries the source’s title'],
      [p.source.creator === 'J. Howard Miller' && p.source.date === '1943', 'its creator and date'],
      [p.source.origin.indexOf('Westinghouse') === 0, 'and where it came from'],
      /* The level rewrites all nine questions, so a worksheet shared without
         it would arrive as a different worksheet. */
      [p.level === 'gt', 'and the level the questions are written at'],
      [p.source.imageDataUrl === null, 'and the scanned poster is dropped from the link, not carried in it'],
    ],
    absent: ['iVBORw0KGgo'],
    imageField: 'source.imageDataUrl',
    arrived: page => page.inputValue('#srcTitle'),
    arrivedWant: 'We Can Do It!',
    localField: 'source.title',
  },
  /* ── increment 4: six more single-document tools ──────────────────────── */
  {
    n: '049', file: '049-book-tasting-menu-generator.html', param: 'menu',
    key: 'btmg_books_v1', slug: 'book-tasting-menu-generator', confirms: true,
    /* This tool's key holds a BARE ARRAY of books and the payload is an
       object around it, so the two image paths differ: `imageField` reads the
       downloaded envelope, `imageStateField` the fixture as stored. */
    state: [
      { id: 'b1', title: 'The Girl Who Drank the Moon', author: 'Kelly Barnhill', genre: 'Fantasy',
        blurb: 'A witch feeds a baby moonlight by mistake.',
        /* A scanned cover. It must be in the DOWNLOAD and out of the LINK. */
        cover: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
      { id: 'b2', title: 'Ghost', author: 'Jason Reynolds', genre: 'Realistic Fiction',
        blurb: 'A sprinter running from more than the starting gun.', cover: null },
    ],
    expect: p => [
      [p.books.length === 2, 'the payload carries every book'],
      [p.books[0].title === 'The Girl Who Drank the Moon', 'with its title'],
      [p.books[0].author === 'Kelly Barnhill' && p.books[0].blurb.indexOf('moonlight') !== -1,
        'its author and the blurb that took an hour to type'],
      /* The genre is the menu's course heading, so a stack shared without it
         prints as one undifferentiated list. */
      [p.books[1].genre === 'Realistic Fiction', 'and the genre, which is the course it prints under'],
      [p.books[0].cover === null, 'and the cover image is dropped from the link, not carried in it'],
    ],
    absent: ['iVBORw0KGgo'],
    imageField: 'books.0.cover',
    imageStateField: '0.cover',
    arrived: page => page.$eval('#booksWrap', el => (el.querySelector('.title-line') || {}).textContent || ''),
    arrivedWant: 'The Girl Who Drank the Moon',
  },
  {
    n: '058', file: '058-duty-roster-builder.html', param: 'duties',
    key: 'drb_roster_v1', slug: 'duty-roster-builder', confirms: true,
    state: {
      staff: ['Rosalind Franklin', 'Chien-Shiung Wu', 'Katherine Johnson'],
      duties: [{ id: 'dA', name: 'Cafeteria (west doors)' }, { id: 'dB', name: 'Bus loop' }],
      assignments: { 'dA|Monday': 'Rosalind Franklin', 'dB|Monday': 'Chien-Shiung Wu',
                     'dA|Tuesday': 'Katherine Johnson' },
      staffSkip: { 'Chien-Shiung Wu': true },
    },
    expect: p => [
      [p.duties.length === 2 && p.duties[0].name === 'Cafeteria (west doors)', 'the payload carries the duty locations'],
      [p.staff.length === 3, 'and the staff list'],
      /* The grid, not just its headings: every assignment is filed under
         `<dutyId>|<day>`, so fresh ids on import would empty the whole week. */
      [p.assignments['dA|Monday'] === 'Rosalind Franklin' && p.assignments['dB|Monday'] === 'Chien-Shiung Wu',
        'and every filled-in cell, keyed on the duty ids that travelled with it'],
      [p.staffSkip['Chien-Shiung Wu'] === true, 'and who is skipped this week'],
    ],
    arrived: page => page.$$eval('#dutiesWrap input[data-duty]', els => els.length ? els[0].value : null),
    arrivedWant: 'Cafeteria (west doors)',
  },
  {
    n: '074', file: '074-science-safety-label-maker.html', param: 'labels',
    key: 'sslm_queue_v1', slug: 'science-safety-label-maker', confirms: true,
    state: {
      labelSize: 'large',
      queue: [
        { id: 'l1', symbol: 'corrosive', text: 'Dilute HCl — Cupboard 3', qty: 4 },
        { id: 'l2', symbol: 'eyeprotect', text: 'Goggles — wash before returning', qty: 2 },
      ],
    },
    expect: p => [
      [p.queue.length === 2 && p.queue[0].text.indexOf('Dilute HCl') === 0, 'the payload carries every queued label'],
      /* The symbol KEY travels, not the drawing: the receiving page draws its
         own SVG for it. */
      [p.queue[0].symbol === 'corrosive' && p.queue[1].symbol === 'eyeprotect',
        'and each label’s hazard symbol, by key'],
      [p.queue[0].qty === 4, 'and how many copies of it to print'],
      [p.labelSize === 'large', 'and the printed label size, which is what the sheet is cut for'],
    ],
    /* The label's own text, without the " — <symbol name>" the row appends:
       what section 5 swaps for KEPT is the string in the fixture, and the
       symbol name is the page's, not the fixture's. */
    arrived: page => page.$eval('#queueWrap', el => {
      const q = el.querySelector('.qtext');
      return q ? q.firstChild.textContent.replace(/\s+—\s+$/, '') : null;
    }),
    arrivedWant: 'Dilute HCl — Cupboard 3',
  },
  {
    n: '076', file: '076-sub-note-feedback-slip-generator.html', param: 'slip',
    key: 'snfs_slip_v1', slug: 'sub-note-feedback-slip', confirms: true,
    state: {
      copyCount: 6, classPeriod: 'Team 6 — Blue Hall', urgencyBox: false,
      prompts: [{ id: 'p1', text: 'Which group needed the most redirection?' },
                { id: 'p2', text: 'Did the lab clean-up get done?' }],
    },
    expect: p => [
      [p.prompts.length === 2 && p.prompts[0].text.indexOf('redirection') !== -1,
        'the payload carries every prompt the department agreed on'],
      [p.copyCount === 6, 'and how many copies to print'],
      [p.classPeriod === 'Team 6 — Blue Hall', 'and the class or period pre-filled on every slip'],
      /* The box is the triage mechanism: a slip shared without the setting
         arrives as a different slip. */
      [p.urgencyBox === false, 'and whether the “call me about this” box is on'],
    ],
    arrived: page => page.inputValue('#classPeriod'),
    arrivedWant: 'Team 6 — Blue Hall',
  },
  {
    n: '078', file: '078-unit-conversion-chart-builder.html', param: 'chart',
    key: 'ucb_chart_v1', slug: 'unit-conversion-chart-builder', confirms: true,
    state: {
      selected: { time: true },
      hidden: { time: { 5: true } },
      custom: { 'Sports Day Conversions': [{ id: 'x1', text: '1 lap = 400 meters' }] },
      columns: 3,
    },
    expect: p => [
      [p.selected.time === true, 'the payload carries which built-in unit sets are ticked'],
      /* The recipe, not the rendered lines: the built-in tables are in the
         page, so what has to travel is which of their lines were removed. */
      [p.hidden.time && p.hidden.time['5'] === true, 'and which of their lines were removed'],
      [p.custom['Sports Day Conversions'][0].text === '1 lap = 400 meters', 'and every custom line, under its group'],
      [p.columns === 3, 'and the column count the chart is laid out in'],
      [JSON.stringify(p).indexOf('1 minute = 60 seconds') === -1,
        'and no built-in conversion text at all, which the receiving page prints from its own copy'],
    ],
    /* The custom group's heading, which is the only one not printed from the
       page's own TEMPLATES table. */
    arrived: page => page.$$eval('#chartGroups h3', els => els.map(e => e.textContent).filter(t => t !== 'Time')[0] || null),
    arrivedWant: 'Sports Day Conversions',
  },

  /* ── increment 4: the one that merges ─────────────────────────────────── */
  {
    n: '075', file: '075-staff-directory-builder.html', param: 'directory',
    key: 'sdb_directory_v1', slug: 'staff-directory-builder', merges: true,
    /* The payload IS the array this tool's Export JSON has always written,
       so the sheet and the file agree without a wrapper. */
    state: [
      { id: 's1', name: 'Amara Okonkwo', room: '214', ext: '4214', subject: 'Math' },
      { id: 's2', name: 'Devi Raman', room: '118', ext: '4118', subject: 'Science' },
    ],
    expect: p => [
      [Array.isArray(p) && p.length === 2, 'the payload is the array Export JSON writes, with every row'],
      [p[0].name === 'Amara Okonkwo' && p[0].room === '214' && p[0].ext === '4214',
        'with each person’s name, room and extension'],
      [p[1].subject === 'Science', 'and their department, which is what the printed page groups by'],
    ],
    /* Every cell of this table is an editable input, so the name is a value
       rather than text — reading textContent here returned "". */
    arrived: page => page.$eval('#dirRows', el => {
      const first = el.querySelector('input[data-field="name"]');
      return first ? first.value : null;
    }),
    arrivedWant: 'Amara Okonkwo',
    arrivedNote: /Added \d+ from a shared/,
    /* Section 5c: the row the local device already has, and the one it does
       not. `mergeLocal` is a whole fixture, because a merge is asserted on
       what SURVIVES rather than on what replaced what. */
    mergeLocal: [{ id: 'x9', name: 'Priya Anand', room: '301', ext: '4301', subject: 'ELA' }],
    mergeKeeps: 'Priya Anand',
  },
  /* ── increment 5: the four rows that are not a copy ──────────────────────
     Every earlier row was wiring the same shape again. These four each needed a
     decision written down first: 077 and 048 hold a key _shared/tool-registry.js
     marks `student: true`, and 018 and 019 were both waiting on Path 12 P2. */
  {
    /* The sharpest per-field split on the site: `tacg_cards_v1` holds every
       student's testing accommodations, and what travels is the LIST OF
       ACCOMMODATION NAMES with no student attached to it. `absent` is the
       assertion that matters here, not `expect`. */
    n: '077', file: '077-testing-accommodations-card-generator.html', param: 'accommodations',
    key: 'tacg_cards_v1', slug: 'testing-accommodations-card-generator',
    merges: true, mergePath: 'types',
    state: {
      roster: ['Priya Raman', 'Dominic Ferraro', 'Wren Halvorsen'],
      types: [
        { id: 't-a', name: 'Braille edition' },
        { id: 't-b', name: 'Scribe for written response' },
      ],
      assignments: { 'Priya Raman|t-a': true, 'Dominic Ferraro|t-b': true },
      notes: { 'Priya Raman': 'Tests in room 114 with Ms Okafor' },
    },
    expect: p => [
      [Array.isArray(p.types) && p.types.length === 2, 'the payload carries the accommodation list'],
      [p.types.map(t => t.name).join('|') === 'Braille edition|Scribe for written response',
        'with the department’s own wording, which is the whole point of sending it'],
      [p.roster === undefined, 'and no roster'],
      [p.assignments === undefined, 'no ticks'],
      [p.notes === undefined, 'and no per-student note'],
    ],
    absent: ['Priya Raman', 'Dominic Ferraro', 'Wren Halvorsen', 'room 114', 'Okafor'],
    arrived: page => page.$$eval('#typesWrap input', els => {
      /* Every type is an editable input, so textContent is "" — 075's lesson,
         and the reason this reads values. */
      const names = els.map(e => e.value);
      return names.indexOf('Braille edition') !== -1 ? 'Braille edition' : JSON.stringify(names);
    }),
    arrivedWant: 'Braille edition',
    /* The merge fixture: a device with its own two accommodations, its own
       roster and its own ticks. Nothing overlaps by name, so the first arrival
       adds both; the second must add neither. */
    mergeLocal: {
      roster: ['Sunniva Aalto'],
      types: [
        { id: 't-local-1', name: 'Extended time' },
        { id: 't-local-2', name: 'Small group setting' },
      ],
      assignments: { 'Sunniva Aalto|t-local-1': true },
      notes: {},
    },
    mergeKeeps: 'Extended time',
    /* The point of merging rather than replacing: a tick is filed under
       `<student>|<typeId>`, so keeping the local ids is what keeps a ticked
       grid intact. A replace would have emptied it silently — 058's lesson in
       the one tool where the data is confidential. */
    mergeKeepsToo: (doc) => [
      ['the local accommodation keeps its id, so the ticks filed under it survive',
        (doc.types || []).some(t => t.id === 't-local-1')],
      ['and the tick itself is still there', doc.assignments && doc.assignments['Sunniva Aalto|t-local-1'] === true],
      ['and the roster on the device is untouched', (doc.roster || []).join() === 'Sunniva Aalto'],
      ['while the arrival got a local id rather than the sender’s',
        (doc.types || []).every(t => t.id !== 't-a')],
    ],
  },
  {
    /* The other marked key, decided the other way: every field on a gallery
       label is composed to be printed and hung on a public wall with the
       artist's name on it. The photos are the half that does not travel. */
    n: '048', file: '048-art-portfolio-label-maker.html', param: 'portfolio',
    slug: 'art-portfolio-label-maker',
    libraryList: { key: 'apl_portfolios_v1' }, docName: 'Kiln Show',
    state: {
      id: 'p-seed', name: 'Kiln Show', title: 'Rm 214 — Kiln Show',
      labelsPerPage: '6', ecLevel: 'Q',
      entries: [
        { id: 'e1', title: 'Ridged Vessel', artist: 'Oleander B.', description: 'Wheel-thrown stoneware, celadon glaze, fired to cone 6.', image: 'data:image/png;base64,iVBORw0KGgo=' },
        { id: 'e2', title: 'Pinch Pot Trio', artist: 'Takoda W.', description: 'Hand-built from three coils, each burnished with a river stone.', image: '' },
      ],
    },
    expect: p => [
      [p.entries.length === 2, 'the payload carries every entry'],
      [p.entries[0].title === 'Ridged Vessel', 'with the piece title'],
      [p.entries[0].artist === 'Oleander B.', 'the artist, which is the decision this row records'],
      [p.entries[1].description.indexOf('river stone') !== -1, 'and the artist statement the QR code holds'],
      [p.labelsPerPage === '6' && p.ecLevel === 'Q', 'plus the print layout it was laid out for'],
      [p.entries[0].image === null, 'and the photo is dropped by the image policy, not carried'],
    ],
    arrived: page => page.$$eval('#entriesList input[data-title]', els => {
      const titles = els.map(e => e.value);
      return titles.indexOf('Ridged Vessel') !== -1 ? 'Ridged Vessel' : JSON.stringify(titles);
    }),
    arrivedWant: 'Ridged Vessel',
    localField: 'entries.0.title',
    imageField: 'entries.0.image',
    imageStateField: 'entries.0.image',
  },
  {
    /* A hunt travels; a Live Run does not. Both live in one object, which is
       why `absent` carries the team name. */
    n: '018', file: '018-qr-scavenger-hunt-builder.html', param: 'hunt',
    slug: 'qr-scavenger-hunt-builder',
    libraryKey: 'qr-scavenger-hunt-sets', docName: 'Library Hunt',
    state: {
      name: 'Library Hunt', cardsPerPage: '4', ecLevel: 'Q', showNumber: true,
      stations: [
        { label: 'Reference desk', content: 'Which shelf holds the atlases?', note: 'Behind the printer', qType: 'text', choices: [], correctChoice: 0, numericAnswer: '', tolerance: '0', hint: 'Look above the globe', hintPenalty: '30', codeWord: 'MERIDIAN' },
        { label: 'Biography wall', content: 'Count the shelves.', note: '', qType: 'numeric', choices: [], correctChoice: 0, numericAnswer: '7', tolerance: '0', hint: '', hintPenalty: '0', codeWord: 'LANTERN' },
      ],
      run: {
        teams: [{ name: 'Rosalind’s group', code: 'MK4T', marks: { 0: { at: 1, correct: true, attempts: 1 } }, attempts: {}, hintsUsed: {}, penaltyMs: 0 }],
        timerRunning: false, timerStartedAt: null, timerElapsedMs: 0, raceStartAt: null, checkinStation: 0, stagger: true,
      },
    },
    expect: p => [
      [p.stations.length === 2, 'the payload carries every station'],
      [p.stations[0].note === 'Behind the printer', 'including the teacher’s private note, which the receiving teacher is'],
      [p.stations[0].hint === 'Look above the globe' && p.stations[0].hintPenalty === '30', 'the hint and what it costs'],
      [p.stations[1].qType === 'numeric' && p.stations[1].numericAnswer === '7', 'the answer type and its answer'],
      [p.stations[0].codeWord === 'MERIDIAN', 'and the printed code word, so the Answer Key still matches the Clue Cards'],
      [p.run === undefined, 'and the Live Run does not travel at all'],
    ],
    absent: ['Rosalind', 'MK4T'],
    arrived: page => page.$$eval('#stations-body input.f-label', els => {
      const labels = els.map(e => e.value);
      return labels.indexOf('Reference desk') !== -1 ? 'Reference desk' : JSON.stringify(labels);
    }),
    arrivedWant: 'Reference desk',
    localField: 'stations.0.label',
  },
  {
    /* The first adopter that already had a link of its own. This one is the
       room as AUTHORED; lock.html?r= is the room as PLAYED. */
    n: '019', file: '019-escape-room-builder.html', param: 'room',
    slug: 'escape-room-builder',
    libraryKey: 'escape-room-builder:rooms', docName: 'Vault of Ur',
    freshIdField: 'roomId',
    state: {
      name: 'Vault of Ur', roomId: 'seedroom01', storyIntro: 'The archivist has lost the key.',
      cardsPerPage: '4', ecLevel: 'Q', showNumber: true, randomizeStart: false,
      countdownEnabled: true, countdownMinutes: 25, packetCardsPerPage: '2',
      stations: [
        { clue: 'I have keys but open no locks.', answers: 'keyboard, a keyboard', hint: 'It is on your desk', next: null, image: '', type: 'text', hintCost: 5, awardLetter: 'R', cipherPlain: '', cipherShift: 0, maxAttempts: 3, numericTolerance: null },
        { clue: 'Decode the archivist’s note.', answers: 'the vault is open', hint: '', next: 'end', image: '', type: 'cipher', hintCost: 0, awardLetter: '', cipherPlain: 'the vault is open', cipherShift: 3, maxAttempts: 0, numericTolerance: null },
      ],
    },
    expect: p => [
      [p.stations.length === 2, 'the payload carries every station'],
      [p.stations[0].answers === 'keyboard, a keyboard', 'with the accepted answers the student link deliberately never shows in full'],
      [p.stations[0].hintCost === 5 && p.stations[0].maxAttempts === 3, 'the hint cost and the attempt cap'],
      [p.stations[0].awardLetter === 'R', 'the letter it awards toward a meta-puzzle'],
      [p.stations[1].next === 'end' && p.stations[1].cipherShift === 3, 'the branch target and the cipher shift'],
      [p.storyIntro.indexOf('archivist') !== -1 && p.countdownMinutes === 25, 'and the story intro and countdown'],
      [p.roomId === undefined, 'and NOT the roomId — a player’s progress is filed under it'],
    ],
    absent: ['seedroom01'],
    arrived: page => page.$$eval('#stationsList textarea.f-clue', els => {
      const clues = els.map(e => e.value);
      return clues.some(c => c.indexOf('keys but open no locks') !== -1)
        ? 'I have keys but open no locks.' : JSON.stringify(clues);
    }),
    arrivedWant: 'I have keys but open no locks.',
    localField: 'stations.0.clue',
  },
  {
    /* Increment 6, the bank-plus-settings group: a built-in bank that ships
       with the page, the teacher's own additions beside it, and device
       settings. What travels is the ADDITIONS — the built-ins are already on
       the other machine — and what must not is the SUBTRACTIONS, which is
       what `untouched` is here to prove. */
    n: '053', file: '053-cultural-trivia-card-generator.html', param: 'trivia',
    key: 'ctcg_custom_v1', slug: 'cultural-trivia-card-generator',
    merges: true, mergeNameOf: r => r.q,
    extraSeed: [['ctcg_hidden_v1', JSON.stringify(['b3', 'b11'])],
                ['ctcg_settings_v1', JSON.stringify({ category: 'francophone', cardCount: '18' })]],
    untouched: [['ctcg_hidden_v1', JSON.stringify(['b3', 'b11'])],
                ['ctcg_settings_v1', JSON.stringify({ category: 'francophone', cardCount: '18' })]],
    state: [
      { id: 'c-a', category: 'hispanic', q: 'Which Andean instrument is a bundle of stopped pipes?', a: 'The zampoña' },
      { id: 'c-b', category: 'francophone', q: 'Which Senegalese port city faces Gorée Island?', a: 'Dakar' },
    ],
    expect: p => [
      [Array.isArray(p.questions) && p.questions.length === 2, 'the payload carries the custom bank'],
      [p.questions[0].a === 'The zampoña', 'with the answer, not only the question'],
      [p.questions[1].category === 'francophone', 'and the category it is filed under'],
      [JSON.stringify(p).indexOf('Día de los Muertos') === -1,
        'and not one built-in question, which is already on the other device'],
      [p.hidden === undefined, 'the hidden built-ins do not travel — an arrival must not subtract'],
      [p.settings === undefined && p.cardCount === undefined, 'and neither do the filter and the card count'],
    ],
    arrived: page => page.$eval('#bankList', el =>
      el.textContent.indexOf('zampoña') !== -1 ? 'zampoña' : el.textContent.slice(0, 140)),
    arrivedWant: 'zampoña',
    mergeAdds: 'Which Andean instrument is a bundle of stopped pipes?',
    arrivedNote: /Added \d+ from a shared/,
    mergeLocal: [
      { id: 'c-mine', category: 'global', q: 'Which Japanese craft folds paper without cutting it?', a: 'Origami (the classical kind)' },
    ],
    mergeKeeps: 'Which Japanese craft folds paper without cutting it?',
  },
  {
    n: '055', file: '055-daily-editing-warmup-generator.html', param: 'editing',
    key: 'deg_custom_v1', slug: 'daily-editing-warmup-generator',
    merges: true, mergeNameOf: r => r.broken,
    extraSeed: [['deg_hidden_v1', JSON.stringify(['b2'])],
                ['deg_settings_v1', JSON.stringify({ category: 'homophones', sheetCount: '9' })]],
    untouched: [['deg_hidden_v1', JSON.stringify(['b2'])],
                ['deg_settings_v1', JSON.stringify({ category: 'homophones', sheetCount: '9' })]],
    state: [
      { id: 's-a', broken: 'the marching band play there first show friday', fixed: 'The marching band plays their first show Friday.', category: 'subject-verb' },
      { id: 's-b', broken: 'wheres the rubric you promised us', fixed: 'Where’s the rubric you promised us?', category: 'punctuation' },
    ],
    expect: p => [
      [Array.isArray(p.sentences) && p.sentences.length === 2, 'the payload carries the teacher’s own sentences'],
      [p.sentences[0].fixed.indexOf('plays their first show') !== -1, 'with the corrected version, which is the answer key'],
      [p.sentences[1].category === 'punctuation', 'and the error type it is filed under'],
      [JSON.stringify(p).indexOf('their going to the movies') === -1, 'and no built-in sentence'],
      [p.hidden === undefined && p.settings === undefined, 'and neither the hidden built-ins nor the filters'],
    ],
    arrived: page => page.$eval('#bankList', el =>
      el.textContent.indexOf('marching band') !== -1 ? 'marching band' : el.textContent.slice(0, 140)),
    arrivedWant: 'marching band',
    mergeAdds: 'the marching band play there first show friday',
    arrivedNote: /Added \d+ from a shared/,
    mergeLocal: [
      { id: 's-mine', broken: 'me and jamal was late to advisory', fixed: 'Jamal and I were late to advisory.', category: 'subject-verb' },
    ],
    mergeKeeps: 'me and jamal was late to advisory',
  },
  {
    /* The map half of this tool travels as a REGION NAME, not a picture: the
       receiving device draws its own from the same vendored map data. And the
       tournament is 018's Live Run in the tool that rule was written for. */
    n: '062', file: '062-geography-bee-quiz-generator.html', param: 'quiz',
    key: 'gbq_custom_v1', slug: 'geography-bee-quiz-generator',
    merges: true, mergeNameOf: r => r.q,
    extraSeed: [['gbq_disabled_v1', JSON.stringify(['b4'])],
                ['gbq_settings_v1', JSON.stringify({ category: 'capitals', region: 'africa', sheetCount: '14', format: 'mc', quizVersion: '3' })],
                ['gbq_tournament_v1', JSON.stringify({ teams: [{ name: 'Team Kestrel', score: 7 }, { name: 'Team Anorak', score: 4 }], turn: 1, asked: 6, points: 2 })]],
    untouched: [['gbq_disabled_v1', JSON.stringify(['b4'])],
                ['gbq_tournament_v1', JSON.stringify({ teams: [{ name: 'Team Kestrel', score: 7 }, { name: 'Team Anorak', score: 4 }], turn: 1, asked: 6, points: 2 })]],
    state: [
      { id: 'q-a', category: 'landmarks', area: 'south-america', q: 'Which salt flat in Bolivia is the largest on Earth?', a: 'Salar de Uyuni' },
      { id: 'q-b', category: 'maps', area: 'europe', q: 'Which country is shaded on this map?', a: 'Portugal', map: { dataset: 'world', region: 'Portugal', context: 'europe' } },
    ],
    expect: p => [
      [Array.isArray(p.questions) && p.questions.length === 2, 'the payload carries the custom bank'],
      [p.questions[0].a === 'Salar de Uyuni', 'with the answer'],
      [p.questions[1].map && p.questions[1].map.region === 'Portugal' && p.questions[1].map.dataset === 'world',
        'and a map question as a region name the other device can draw itself'],
      [JSON.stringify(p.questions[1]).length < 400, 'which is a few dozen bytes rather than a picture'],
      [JSON.stringify(p).indexOf('Team Kestrel') === -1, 'and the tournament in progress does not travel at all'],
      [p.disabled === undefined && p.settings === undefined, 'nor the disabled built-ins or the filters'],
    ],
    absent: ['Team Kestrel', 'Team Anorak'],
    arrived: page => page.$eval('#bankList', el =>
      el.textContent.indexOf('Salar de Uyuni') !== -1 ? 'Salar de Uyuni' : el.textContent.slice(0, 140)),
    arrivedWant: 'Salar de Uyuni',
    mergeAdds: 'Which salt flat in Bolivia is the largest on Earth?',
    arrivedNote: /Added \d+ from a shared/,
    mergeLocal: [
      { id: 'q-mine', category: 'capitals', area: 'asia', q: 'What is the capital of Kazakhstan?', a: 'Astana' },
    ],
    mergeKeeps: 'What is the capital of Kazakhstan?',
  },
  {
    /* The one tool in the group that writes its fields with innerHTML, on
       purpose — the built-ins are full of character entities and the add form
       makes <br> out of a newline. A link is the first input this site has
       had that did not come from the person at the keyboard, so an arriving
       field is escaped and only <br> and entities are put back. */
    n: '066', file: '066-math-find-the-mistake-generator.html', param: 'mistakes',
    key: 'mftm_custom_v1', slug: 'math-find-the-mistake-generator',
    merges: true, mergeNameOf: r => r.problem,
    extraSeed: [['mftm_disabled_builtins_v1', JSON.stringify(['b5', 'b14'])]],
    untouched: [['mftm_disabled_builtins_v1', JSON.stringify(['b5', 'b14'])]],
    state: [
      { id: 'p-a', band: 'middle', category: 'percents', problem: 'Increase 40 by 15%', work: '40 + 15 = 55', fix: '40 &times; 1.15 = 46', explain: 'A percent increase is multiplied, not added as a raw number.' },
      { id: 'p-b', band: 'high', category: 'exponents', problem: 'Simplify: (2x)&sup3;', work: '(2x)&sup3; = 2x&sup3;', fix: '(2x)&sup3; = 8x&sup3;', explain: 'The exponent applies to the 2 as well as the x.<br>2&sup3; = 8.' },
    ],
    expect: p => [
      [Array.isArray(p.problems) && p.problems.length === 2, 'the payload carries the custom problems'],
      [p.problems[0].work === '40 + 15 = 55', 'with the deliberately wrong working'],
      [p.problems[0].fix === '40 &times; 1.15 = 46', 'the correct solution, entities and all'],
      [p.problems[1].explain.indexOf('<br>') !== -1, 'and the line break the tool’s own editor made'],
      [p.problems[1].band === 'high', 'plus the grade band it is filed under'],
      [JSON.stringify(p).indexOf('Machu Picchu') === -1 && p.disabled === undefined,
        'and not the built-ins, nor which of them this teacher switched off'],
    ],
    arrived: page => page.$eval('#bankList', el =>
      el.textContent.indexOf('Increase 40 by 15%') !== -1 ? 'Increase 40 by 15%' : el.textContent.slice(0, 140)),
    arrivedWant: 'Increase 40 by 15%',
    arrivedNote: /Added \d+ from a shared/,
    mergeLocal: [
      { id: 'p-mine', band: 'elementary', category: 'fractions', problem: 'Add: 1/4 + 1/4', work: '1/4 + 1/4 = 2/8', fix: '1/4 + 1/4 = 1/2', explain: 'Add the numerators only; the denominator stays.' },
    ],
    mergeKeeps: 'Add: 1/4 + 1/4',
  },
];

/* ── 0. static: the four tags, in dependency order ──────────────────────── */
console.log('Share rollout — Path 6 P3, the builders that could not share');

const ORDER = ['_shared/state-link.js', '_shared/vendor/qrcode/qrcode.js', '_shared/qr-draw.js', '_shared/share.js'];
for (const t of [...TOOLS,
                 { n: '081', file: '081-word-problem-warmup-generator.html' },
                 { n: '061', file: '061-fraction-decimal-percent-drill-generator.html' }]) {
  const html = fs.readFileSync(path.join(SITE, 'Tools', t.file), 'utf8');
  const at = ORDER.map(src => html.indexOf(`src="../${src}"`));
  ok(at.every(i => i !== -1), `${t.n}: loads all four share scripts: ${JSON.stringify(ORDER.filter((s, i) => at[i] === -1))}`);
  ok(at.every((v, i) => i === 0 || v > at[i - 1]),
    `${t.n}: loads them in dependency order (state-link, encoder, qr-draw, share): ${JSON.stringify(at)}`);
}

/* The string the local variant carries where the shared one carries its own
   identifying text. Nothing in any fixture contains it. */
const KEPT = 'Kept Local Copy';

const server = await serve(PORT);
const browser = await launch();
const pages = [];

/** Opens the sheet, clicks Copy link with a stubbed clipboard, and closes it —
    the sheet is a real modal and leaving it open makes the next click miss. */
const shareLink = async (p) => {
  await p.click('#shareBtn');
  await settle(p, 250);
  return p.evaluate(() => {
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    document.querySelector('.share-sheet button[data-share="copy"]').click();
    return new Promise(r => setTimeout(() => { window.Share.close(); r(captured); }, 60));
  });
};

/** The localStorage entries that put `doc` in front of the teacher: one for a
    single-document tool, three for a library tool (the list, the blob under
    `name`, and the pointer at it). */
const seedFor = (t, doc, name) => [...seedForDoc(t, doc, name), ...(t.extraSeed || [])];

/** Just the document's own entries, before the tool's OTHER keys are added.
    Increment 6's bank tools each write three or four keys and only one of
    them is the bank, so `extraSeed` is how the rest get onto the device —
    which is what makes "the arrival did not touch them" a real assertion. */
const seedForDoc = (t, doc, name) => {
  if (t.library) {
    return [[t.library.list, JSON.stringify([name])],
            [t.library.data + name, JSON.stringify(doc)],
            [t.library.current, name]];
  }
  /* Increment 5's third storage shape: a library that lives inside ONE key as
     { current, sets: { name: doc } } — 018 and 019 both. Seeded as the bare
     object, which is what 018 writes and what _shared/store.js reads for 019 as
     legacy version 0 before rewriting it as an envelope. */
  if (t.libraryKey) return [[t.libraryKey, JSON.stringify({ current: name, sets: { [name]: doc } })]];
  /* And 048's, which is a library too but keyed by id in a LIST rather than by
     name in a map — the same claim (an arrival lands beside, nothing is lost)
     over a third storage layout. */
  if (t.libraryList) return [[t.libraryList.key, JSON.stringify({ list: [doc], currentId: doc.id })]];
  return [[t.key, JSON.stringify(doc)]];
};

/** The names filed in a one-key library and the document under `name`, read
    back out of storage. Handles both what the page was seeded with and the
    { v, data } envelope _shared/store.js rewrites it as on the first save. */
const readLibraryList = (page, key, name) => page.evaluate(([k, n]) => {
  let store = null;
  try { store = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { store = null; }
  const list = (store && store.list) || [];
  return { names: list.map(p => p && p.name), kept: list.filter(p => p && p.name === n)[0] || null };
}, [key, name]);

const readLibraryKey = (page, key, name) => page.evaluate(([k, n]) => {
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { parsed = null; }
  const store = (parsed && typeof parsed === 'object' && parsed.data && !parsed.sets) ? parsed.data : parsed;
  const sets = (store && store.sets) || {};
  return { names: Object.keys(sets), kept: sets[n] || null };
}, [key, name]);

/** Writes `pairs` into localStorage before the page's own script runs — ONCE,
    however many times the page is navigated.

    addInitScript fires on every navigation, so the obvious version silently
    re-seeds on reload and hands back the fixture instead of what the tool
    wrote. That made "a refresh does not file the same arrival twice" pass on a
    tool that had genuinely filed it twice, and fail on one that had not. The
    first entry's key is the sentinel: it exists on this origin from the first
    load onwards, whoever wrote it. */
const seed = (page, pairs) => page.addInitScript((entries) => {
  if (localStorage.getItem(entries[0][0]) !== null) return;
  for (const [k, v] of entries) localStorage.setItem(k, v);
}, pairs);

/** A page seeded with `pairs`, opened at `url`. */
const openSeeded = async (label, url, pairs) => {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push([label, page]);
  await seed(page, pairs);
  await page.goto(url, { waitUntil: 'load' });
  await settle(page, 800);
  return page;
};

/** A page with the fixture already saved, as a teacher who has used the tool
    would have. */
const openWith = async (t, url) =>
  openSeeded(t.n, url || (BASE + '/Tools/' + t.file), seedFor(t, t.state, t.docName));

for (const t of TOOLS) {
  console.log(`\n${t.n} — ${t.file}`);
  const PAGE_URL = BASE + '/Tools/' + t.file;
  const page = await openWith(t);

  /* ── 1/2. the button, the sheet, the link and the note ────────────────── */
  eq(await page.isVisible('#shareBtn'), true, `${t.n}: the toolbar has a Share button`);
  const url = await shareLink(page);
  ok(url && url.indexOf(t.param + '=') !== -1, `${t.n}: Copy link produces a ?${t.param}= link`);
  ok(/Link copied/.test(await page.textContent('#shareNote')),
    `${t.n}: and the note under the toolbar says so, where there was no message at all before`);

  /* ── 3. what travels ──────────────────────────────────────────────────── */
  const payload = await page.evaluate(([u, param]) =>
    window.StateLink.decodeState(new URL(u).searchParams.get(param)), [url, t.param]);
  for (const [cond, label] of t.expect(payload)) ok(cond, `${t.n}: ${label}`);
  const asText = JSON.stringify(payload);
  for (const needle of (t.absent || [])) {
    ok(asText.indexOf(needle) === -1, `${t.n}: ${JSON.stringify(needle)} is not anywhere in the payload`);
  }

  /* ── 4. it opens on an untouched device ───────────────────────────────── */
  const fresh = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push([t.n + '-fresh', fresh]);
  await fresh.goto(url, { waitUntil: 'load' });
  await settle(fresh, 700);
  eq(await t.arrived(fresh), t.arrivedWant, `${t.n}: an untouched device opens the shared work`);
  ok((t.arrivedNote || /Loaded a shared/).test(await fresh.textContent('#shareNote')),
    `${t.n}: and says so: ` + JSON.stringify(await fresh.textContent('#shareNote')));
  eq(new URL(fresh.url()).searchParams.get(t.param), null,
    `${t.n}: the parameter is consumed on open, so a refresh cannot import it twice`);

  /* ── 5. the confirm, on a device that already has work ────────────────── */
  if (t.confirms) {
    /* The same fixture with its one identifying string changed, so "which copy
       is on screen afterwards" has an answer. Doing it as a string swap over
       the encoded fixture keeps this generic across five tools whose documents
       have nothing else in common. */
    const local = JSON.stringify(t.state).split(t.arrivedWant).join(KEPT);
    ok(local !== JSON.stringify(t.state), `${t.n}: the local variant really differs from the shared one`);

    const mine = await prepPage(browser, BASE, { width: 1400, height: 1000 });
    pages.push([t.n + '-declines', mine]);
    const asked = [];
    mine.on('dialog', async d => { asked.push(d.message()); await d.dismiss(); });
    await seed(mine, [[t.key, local]]);
    await mine.goto(url, { waitUntil: 'load' });
    await settle(mine, 800);
    eq(asked.length, 1, `${t.n}: an arriving link asks before replacing saved work`);
    ok(/[Rr]eplace/.test(asked[0] || ''), `${t.n}: and the question says what it would replace: ${JSON.stringify(asked[0])}`);
    ok(/Kept the/.test(await mine.textContent('#shareNote')),
      `${t.n}: declining is a real outcome with a sentence of its own: ` +
      JSON.stringify(await mine.textContent('#shareNote')));
    eq(await t.arrived(mine), KEPT, `${t.n}: and the work already on the device is untouched`);

    /* share.js clears the parameter BEFORE the payload is judged, so a
       refresh of the page the teacher declined on must not ask again. */
    await mine.reload({ waitUntil: 'load' });
    await settle(mine, 700);
    eq(asked.length, 1, `${t.n}: a refresh after declining does not ask a second time`);
    eq(await t.arrived(mine), KEPT, `${t.n}: and still shows the local copy`);

    const yes = await prepPage(browser, BASE, { width: 1400, height: 1000 });
    pages.push([t.n + '-accepts', yes]);
    yes.on('dialog', async d => { await d.accept(); });
    await seed(yes, [[t.key, local]]);
    await yes.goto(url, { waitUntil: 'load' });
    await settle(yes, 800);
    ok(/Loaded a shared/.test(await yes.textContent('#shareNote')),
      `${t.n}: accepting loads the shared copy: ` + JSON.stringify(await yes.textContent('#shareNote')));
  }

  /* ── 5b. saved beside, on a device that already has a library ──────────── */
  if (t.library || t.libraryKey || t.libraryList) {
    /* The collision case, which is the only one that can lose work here: the
       teacher already has a document filed under the SAME NAME the link wants,
       with different content in it. */
    const local = JSON.parse(JSON.stringify(t.state));
    setAt(local, t.localField, KEPT);
    if (Object.prototype.hasOwnProperty.call(local, 'name')) local.name = t.docName;
    ok(JSON.stringify(local) !== JSON.stringify(t.state),
      `${t.n}: the local variant really differs from the shared one`);

    const mine = await prepPage(browser, BASE, { width: 1400, height: 1000 });
    pages.push([t.n + '-beside', mine]);
    const asked = [];
    mine.on('dialog', async d => { asked.push(d.message()); await d.dismiss(); });
    await seed(mine, seedFor(t, local, t.docName));
    await mine.goto(url, { waitUntil: 'load' });
    await settle(mine, 900);

    eq(asked.length, 0,
      `${t.n}: an arriving link does not ask, because it takes nothing away: ` + JSON.stringify(asked));
    eq(await t.arrived(mine), t.arrivedWant, `${t.n}: the shared work is what is on screen`);
    ok(/Loaded a shared/.test(await mine.textContent('#shareNote')),
      `${t.n}: and the note says so: ` + JSON.stringify(await mine.textContent('#shareNote')));

    const after = t.libraryList
      ? await readLibraryList(mine, t.libraryList.key, t.docName)
      : t.libraryKey
      ? await readLibraryKey(mine, t.libraryKey, t.docName)
      : await mine.evaluate(([listKey, dataPrefix, name]) => ({
        names: JSON.parse(localStorage.getItem(listKey) || '[]'),
        kept: JSON.parse(localStorage.getItem(dataPrefix + name) || 'null'),
      }), [t.library.list, t.library.data, t.docName]);
    eq(after.names.length, 2,
      `${t.n}: the saved list holds both, not one: ` + JSON.stringify(after.names));
    ok(after.names.indexOf(t.docName) !== -1,
      `${t.n}: the teacher’s own entry is still listed under its own name`);
    ok(after.names.some(n => n !== t.docName && n.indexOf(t.docName) === 0),
      `${t.n}: and the arrival took a suffixed name beside it: ` + JSON.stringify(after.names));
    eq(after.kept && atPath(after.kept, t.localField), KEPT,
      `${t.n}: and the document already saved under that name is untouched`);

    /* Same as the single-document tools: the parameter is gone, so a refresh
       cannot file a second copy of the same arrival. */
    await mine.reload({ waitUntil: 'load' });
    await settle(mine, 800);
    const names2 = t.libraryList
      ? (await readLibraryList(mine, t.libraryList.key, t.docName)).names
      : t.libraryKey
      ? (await readLibraryKey(mine, t.libraryKey, t.docName)).names
      : await mine.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), t.library.list);
    eq(names2.length, 2, `${t.n}: a refresh does not file the same arrival a second time: ` + JSON.stringify(names2));

    /* 019 alone: the id the arrival must NOT carry over. lock.html keys a
       player's progress under `escape-room-progress:<roomId>`, so a copy that
       kept the sender's id would resume a student's half-finished run of a
       different teacher's room. Read off both documents in the library. */
    if (t.freshIdField) {
      const ids = await mine.evaluate(([k, field]) => {
        let parsed = null;
        try { parsed = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { parsed = null; }
        const store = (parsed && parsed.data && !parsed.sets) ? parsed.data : parsed;
        return Object.values((store && store.sets) || {}).map(d => d && d[field]);
      }, [t.libraryKey, t.freshIdField]);
      eq(ids.length, 2, `${t.n}: both rooms are there to compare ids: ` + JSON.stringify(ids));
      ok(ids[0] && ids[1] && ids[0] !== ids[1],
        `${t.n}: the arrival got its OWN ${t.freshIdField}, so a player's progress cannot carry across: ` +
        JSON.stringify(ids));
    }
  }

  /* ── 5c. merged beside, on the one tool whose arrival adds rows ───────── */
  if (t.merges) {
    /* 075 is the departure this section exists for: a single-document tool
       whose document is a LIST and which already had an importer that adds
       rows and skips duplicates. A link is the same document by another
       route, so it merges, it does not ask, and what must be asserted is that
       the rows already on the device are all still there afterwards. */
    const mine = await prepPage(browser, BASE, { width: 1400, height: 1000 });
    pages.push([t.n + '-merges', mine]);
    const asked = [];
    mine.on('dialog', async d => { asked.push(d.message()); await d.dismiss(); });
    await seed(mine, [[t.key, JSON.stringify(t.mergeLocal)], ...(t.extraSeed || [])]);
    await mine.goto(url, { waitUntil: 'load' });
    await settle(mine, 900);

    eq(asked.length, 0,
      `${t.n}: an arriving link does not ask, because it takes nothing away: ` + JSON.stringify(asked));
    ok(/Added \d+ from a shared/.test(await mine.textContent('#shareNote')),
      `${t.n}: and the note says how many it added: ` + JSON.stringify(await mine.textContent('#shareNote')));

    /* 075's merged list IS the stored document; 077's is one field of it
       (`types`), because the rest of 077's document is the half that must not
       travel at all. `mergePath` is which of the two this row is. */
    const listOf = (doc) => (t.mergePath ? atPath(doc, t.mergePath) : doc) || [];
    /* What names a row, so the two claims below can be written once: 075 and
       077 file people, increment 6's bank tools file questions. `mergeAdds`
       is the arriving row's name where that is not the same string section 4
       looks for on screen — a question is named by its whole text and no
       assertion should read a 90-character sentence out of a rendered list. */
    const nameOf = t.mergeNameOf || (r => r.name);
    const after = listOf(await mine.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), t.key));
    eq(after.length, listOf(t.mergeLocal).length + listOf(t.state).length,
      `${t.n}: the saved list holds both sides of the merge: ` + JSON.stringify(after.map(nameOf)));
    ok(after.some(r => nameOf(r) === t.mergeKeeps),
      `${t.n}: the row already on the device is still there`);
    ok(after.some(r => nameOf(r) === (t.mergeAdds || t.arrivedWant)),
      `${t.n}: and the shared rows are there beside it`);
    /* Increment 6's claim, and the reason those tools share the bank and not
       the whole of storage: an arrival that never stops to ask must only ADD,
       so the keys it has no business in are still byte-for-byte what they
       were — the hidden built-ins, the filters, a tournament in progress. */
    for (const [k, want] of (t.untouched || [])) {
      eq(await mine.evaluate(key => localStorage.getItem(key), k), want,
        `${t.n}: the arrival left ${k} exactly as it was`);
    }
    if (t.mergeKeepsToo) {
      for (const [label, check] of t.mergeKeepsToo(await mine.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), t.key))) {
        ok(check, `${t.n}: ${label}`);
      }
    }

    /* The duplicate check is the guard against loss here, so it is what a
       second arrival of the same link must hit. */
    await mine.goto(url, { waitUntil: 'load' });
    await settle(mine, 900);
    const twice = listOf(await mine.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), t.key));
    eq(twice.length, after.length,
      `${t.n}: opening the same link twice adds nobody a second time: ` + JSON.stringify(twice.map(nameOf)));
    ok(/skipped \d+ already listed/.test(await mine.textContent('#shareNote')),
      `${t.n}: and says it skipped them: ` + JSON.stringify(await mine.textContent('#shareNote')));
  }

  /* ── 6. the rows, the QR budget and the download envelope ─────────────── */
  await page.click('#shareBtn');
  await settle(page, 250);
  const rows = await page.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
  ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
    `${t.n}: the sheet offers copy, QR and download: ${JSON.stringify(rows)}`);
  const qr = await page.evaluate(() => {
    const b = document.querySelector('.share-sheet button[data-share="qr"]');
    return { disabled: b.disabled, reason: (document.querySelector('.share-sheet-reason') || {}).textContent || '' };
  });
  if (!qr.disabled) {
    await page.click('.share-sheet button[data-share="qr"]');
    await settle(page, 250);
    ok(await page.evaluate(() => document.querySelector('.share-sheet-qr canvas').width) > 100,
      `${t.n}: a fixture-sized payload fits a scannable QR`);
  } else {
    ok(/(KB|modules|px)/.test(qr.reason),
      `${t.n}: an over-large payload greys the QR row out with a reason: ${JSON.stringify(qr.reason)}`);
  }
  const file = await page.evaluate(() => {
    let text = null;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { blob.text().then(t => { text = t; }); return realCreate.call(URL, blob); };
    document.querySelector('.share-sheet button[data-share="download"]').click();
    return new Promise(r => setTimeout(() => { URL.createObjectURL = realCreate; r(text); }, 250));
  });
  const parsed = JSON.parse(file);
  eq(parsed.aplp.tool, t.slug, `${t.n}: the downloaded file says which tool it belongs to`);
  eq(parsed.aplp.param, t.param, `${t.n}: and which parameter it is a payload for`);
  /* The file is the FULL state and the link is the stripped one, so these two
     are equal only for a tool whose fixture has no picture in it — which was
     every row until 041 and 083 arrived with one. The general statement is
     that the file, put through the same policy the link went through, IS the
     link's payload; it holds for the image-free rows unchanged. */
  ok(await page.evaluate(([txt, want]) =>
    JSON.stringify(window.Share.stripImages(window.Share.unwrap(JSON.parse(txt))).value) === want,
    [file, JSON.stringify(payload)]),
    `${t.n}: Share.unwrap() reads that envelope back as the payload the link carries, once the same image policy is applied`);
  if (t.imageField) {
    /* And the other half of the policy: the picture the link dropped is in
       the downloaded file, which is the only way it travels at all. */
    eq(await page.evaluate(([txt, path]) =>
      String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), window.Share.unwrap(JSON.parse(txt))),
      [file, t.imageField]), atPath(t.state, t.imageStateField || t.imageField),
      `${t.n}: and the picture the link dropped is in the downloaded file, whole`);
  }

  /* ── 7. axe on the open sheet ─────────────────────────────────────────── */
  const light = await a11yScan(page, { impact: 'serious', include: '.share-sheet' });
  eq(light.length, 0, `${t.n}: no serious/critical axe violations on the open sheet: ` +
    JSON.stringify(light.map(v => v.id)));
  await page.keyboard.press('Escape');
  await settle(page, 200);
  ok(!(await page.$('.share-sheet')), `${t.n}: Escape closes the sheet`);

  /* ── 8. a mangled link fails in words ─────────────────────────────────── */
  const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push([t.n + '-broken', broken]);
  await broken.goto(`${PAGE_URL}?${t.param}=not-base64-%%%`, { waitUntil: 'load' });
  await settle(broken, 700);
  ok(/could not be read/.test(await broken.textContent('#shareNote')),
    `${t.n}: a mangled link says so rather than opening blank: ` +
    JSON.stringify(await broken.textContent('#shareNote')));
  eq(new URL(broken.url()).searchParams.get(t.param), null,
    `${t.n}: and is cleared even though it was unusable, so a refresh does not repeat the failure`);
}

/* ── 081: the generator, where the SEED is the payload ──────────────────── */
console.log('\n081 — 081-word-problem-warmup-generator.html (a seed, not problems)');
{
  const PAGE_URL = BASE + '/Tools/081-word-problem-warmup-generator.html';
  const sender = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['081', sender]);
  await sender.goto(PAGE_URL, { waitUntil: 'load' });
  await settle(sender, 600);

  /* A set this suite chose, not the default one, so "the same problems came
     back" cannot pass by both machines happening to boot the same way. */
  await sender.uncheck('[data-op="multiplication"]');
  await sender.uncheck('[data-op="division"]');
  await sender.fill('#problemCount', '5');
  await sender.click('#generateBtn');
  await settle(sender, 400);

  const seed = await sender.inputValue('#seedDisplay');
  ok(/^\d+$/.test(seed), '081: a generated sheet has a numeric seed: ' + JSON.stringify(seed));
  const senderText = await sender.textContent('#sheetProblems');
  ok(senderText && senderText.length > 40, '081: and a printable sheet of problems');

  const url = await shareLink(sender);
  ok(url && url.indexOf('warmup=') !== -1, '081: Copy link produces a ?warmup= link');
  const payload = await sender.evaluate(u =>
    window.StateLink.decodeState(new URL(u).searchParams.get('warmup')), url);
  eq(String(payload.seed), seed, '081: the payload carries the seed on screen');
  eq(payload.problemCount, 5, 'and how many problems');
  ok(payload.ops.length === 2 && payload.ops.indexOf('addition') !== -1 && payload.ops.indexOf('subtraction') !== -1,
    '081: and exactly the operations that were ticked: ' + JSON.stringify(payload.ops));
  ok(payload.lockSeed === undefined,
    '081: the lock-the-seed checkbox is a device preference and does not travel');
  /* The problems themselves are NOT in the link — that is the whole design. */
  const firstProblem = (senderText || '').trim().split('\n')[0].trim().slice(0, 30);
  ok(firstProblem.length > 10 && JSON.stringify(payload).indexOf(firstProblem) === -1,
    '081: and no problem text is in the payload at all: ' + JSON.stringify(payload));

  /* Nothing here is authored, so arrival must NOT stop to ask. */
  const receiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['081-receiver', receiver]);
  const asked081 = [];
  receiver.on('dialog', async d => { asked081.push(d.message()); await d.dismiss(); });
  await receiver.goto(url, { waitUntil: 'load' });
  await settle(receiver, 800);
  eq(asked081.length, 0, '081: an arriving warm-up does not ask, because nothing here is anybody’s typing');
  ok(/Loaded a shared warm-up/.test(await receiver.textContent('#shareNote')), '081: and it says what it did');

  /* The claim the seed exists for, checked against the RENDERED problems on
     both machines rather than against the seed having arrived. */
  eq(await receiver.textContent('#sheetProblems'), senderText,
    '081: the receiving device regenerates the same problems, in the same order');
  eq(await receiver.textContent('#sheetKey'), await sender.textContent('#sheetKey'),
    '081: and the same answer key');
  eq(await receiver.inputValue('#problemCount'), '5', '081: with the same number of problems');
  eq(await receiver.inputValue('#seedDisplay'), seed, '081: from the same seed');
  eq(new URL(receiver.url()).searchParams.get('warmup'), null,
    '081: the parameter is consumed on open');

  /* The sheet's own rows, and axe on it — same claims as the five builders. */
  await sender.click('#shareBtn');
  await settle(sender, 250);
  const rows = await sender.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
  ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
    '081: the sheet offers copy, QR and download: ' + JSON.stringify(rows));
  ok(await sender.evaluate(() => !document.querySelector('.share-sheet button[data-share="qr"]').disabled),
    '081: a seed always fits a QR code — that is the point of sharing one');
  const scan = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
  eq(scan.length, 0, '081: no serious/critical axe violations on the open sheet: ' +
    JSON.stringify(scan.map(v => v.id)));
  await sender.keyboard.press('Escape');
  await settle(sender, 200);

  /* An empty tool has nothing to share and says so instead of opening. */
  const blank = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['081-blank', blank]);
  await blank.addInitScript(() => {
    /* Every operation unticked in storage, so boot's generate() bails before a
       seed exists — the one state in which this tool has nothing to share. */
    localStorage.setItem('wpwg_settings_v1', JSON.stringify({ ops: [], gradeBand: 'middle', problemCount: 6 }));
  });
  const blankDialogs = [];
  blank.on('dialog', async d => { blankDialogs.push(d.message()); await d.accept(); });
  await blank.goto(PAGE_URL, { waitUntil: 'load' });
  await settle(blank, 600);
  await blank.click('#shareBtn');
  await settle(blank, 300);
  ok(!(await blank.$('.share-sheet')), '081: with nothing generated the sheet does not open');
  ok(/Generate a set of problems first/.test(await blank.textContent('#shareNote')),
    '081: and the note says what to do: ' + JSON.stringify(await blank.textContent('#shareNote')));

  const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['081-broken', broken]);
  await broken.goto(PAGE_URL + '?warmup=not-base64-%%%', { waitUntil: 'load' });
  await settle(broken, 700);
  ok(/could not be read/.test(await broken.textContent('#shareNote')),
    '081: a mangled link says so rather than opening blank');
}

/* ── 066: the arriving field that is written with innerHTML ─────────────── */
/* Every other adopter escapes what it prints. 066 does not, on purpose — its
   problems are full of &minus; and &frac12; and its own editor turns a newline
   into <br> — so it is the one tool where a payload is markup by the time it
   reaches the board. A link is the first input on this site that did not come
   from the teacher at this keyboard; this is the assertion that says so. */
console.log('\n066 — an arriving field is escaped before it is written as HTML');
{
  const hostile = {
    problems: [{
      band: 'middle', category: 'other',
      problem: 'Simplify: 6 &divide; 2<img src=x onerror="window.__pwned=1">',
      work: '6 &divide; 2 = 4<script>window.__pwned=1<\/script>',
      fix: '6 &divide; 2 = 3', explain: 'Division, not subtraction.<br>Check it.',
    }],
  };
  const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['066-hostile', page]);
  await page.goto(BASE + '/Tools/066-math-find-the-mistake-generator.html', { waitUntil: 'load' });
  await settle(page, 500);
  const url = await page.evaluate(st => location.origin + location.pathname + '?' +
    'mistakes=' + encodeURIComponent(window.StateLink.encodeState(st)), hostile);
  const victim = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['066-hostile-receiver', victim]);
  await victim.goto(url, { waitUntil: 'load' });
  await settle(victim, 800);

  ok(/Added 1 from a shared/.test(await victim.textContent('#shareNote')),
    '066: the hostile payload is still filed, because it is an ordinary problem with markup in it');
  /* The projector shows the FIRST problem that passes the filters, and the
     built-ins come first — so narrow the filters to the one combination no
     built-in has (Other + middle) and the arrival is what is on the board. */
  await victim.evaluate(() => {
    document.querySelectorAll('#categoryFilterList input[data-cat]').forEach((cb) => {
      if (cb.getAttribute('data-cat') !== 'other') { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    document.querySelectorAll('#bandFilterList input[data-band]').forEach((cb) => {
      if (cb.getAttribute('data-band') !== 'middle') { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  await settle(victim, 300);
  await victim.click('#revealBtn');
  await settle(victim, 200);
  eq(await victim.evaluate(() => window.__pwned === undefined), true,
    '066: and nothing in it ran');
  eq(await victim.evaluate(() => document.querySelectorAll('#displayProblem img, #bankList img').length), 0,
    '066: the <img> arrived as text rather than as an element');
  ok((await victim.textContent('#displayProblem')).indexOf('<img') !== -1,
    '066: it is on the board, visibly, as the characters that were sent: ' +
    JSON.stringify(await victim.textContent('#displayProblem')));
  eq(await victim.evaluate(() => document.querySelectorAll('#displayExplain br').length), 1,
    '066: while the <br> its own editor writes still comes through as a line break');
  ok((await victim.innerHTML('#displayWork')).indexOf('&divide;') === -1 &&
     (await victim.textContent('#displayWork')).indexOf('÷') !== -1,
    '066: and a character entity still renders as its character: ' +
    JSON.stringify(await victim.textContent('#displayWork')));
}

/* ── 062: the arriving map question is DRAWN, not carried ───────────────── */
/* The reason a map question costs about forty bytes of link is that what
   travels is a descriptor — which dataset, which region, which crop — and the
   receiving device renders it from the same vendored map data. Section 3
   asserts the descriptor is in the payload and section 4 that the question is
   filed; neither proves the receiving device can actually draw it, which is
   the whole claim. This does, through the tool's own map module. */
console.log('\n062 — an arriving map question is drawn from the receiving device’s own map data');
{
  const shared = { questions: [{ category: 'maps', area: 'europe', q: 'Which country is shaded on this map?', a: 'Portugal', map: { dataset: 'world', region: 'Portugal', context: 'europe' } }] };
  const sender = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['062-map-sender', sender]);
  await sender.goto(BASE + '/Tools/062-geography-bee-quiz-generator.html', { waitUntil: 'load' });
  await settle(sender, 700);
  const url = await sender.evaluate(st => location.origin + location.pathname + '?' +
    'quiz=' + encodeURIComponent(window.StateLink.encodeState(st)), shared);

  const receiver = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['062-map-receiver', receiver]);
  await receiver.goto(url, { waitUntil: 'load' });
  await settle(receiver, 900);

  const drawn = await receiver.evaluate(async () => {
    const hooks = window.__gbqTestHooks;
    const q = hooks.allQuestions().filter(x => x.custom && x.map)[0];
    if (!q) return 'the map question was not filed';
    const m = await hooks.mapModule();
    const res = await m.renderSnippet({ dataset: q.map.dataset, region: q.map.region, context: q.map.context, width: 300, ratio: 2.6 });
    if (!res || !res.url) return 'no snippet came back';
    return res.url.slice(0, 15) + ' ' + (res.width > 0 && res.height > 0 ? 'sized' : 'unsized');
  });
  eq(drawn, 'data:image/png; sized',
    '062: the receiving device draws the shared region from its own map data: ' + JSON.stringify(drawn));
}

/* ── 061: the second generator, where the SEED is the payload ───────────── */
/* 081 was the first and this is its twin, three increments later: nothing
   here is authored, so the link carries the four numbers that regenerate the
   worksheet and the arrival does not stop to ask. The claim is checked
   against the RENDERED rows on both machines, not against the seed having
   arrived. */
console.log('\n061 — 061-fraction-decimal-percent-drill-generator.html (a seed, not rows)');
{
  const PAGE_URL = BASE + '/Tools/061-fraction-decimal-percent-drill-generator.html';
  const sender = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['061', sender]);
  await sender.goto(PAGE_URL, { waitUntil: 'load' });
  await settle(sender, 600);

  /* A sheet this suite chose, not the default one, so "the same rows came
     back" cannot pass by both machines happening to boot the same way. */
  await sender.selectOption('#difficulty', 'hard');
  await sender.selectOption('#givenForm', 'percent');
  await sender.fill('#rowCount', '9');
  await sender.click('#generateBtn');
  await settle(sender, 400);

  const seedValue = await sender.inputValue('#seedDisplay');
  ok(/^\d+$/.test(seedValue), '061: a generated sheet has a numeric seed: ' + JSON.stringify(seedValue));
  const senderRows = await sender.textContent('#worksheetTable');
  const senderKey = await sender.textContent('#keyTable');
  ok(senderRows && senderRows.length > 40, '061: and a worksheet of rows');

  const url = await shareLink(sender);
  ok(url && url.indexOf('drill=') !== -1, '061: Copy link produces a ?drill= link');
  ok(/Link copied/.test(await sender.textContent('#shareNote')),
    '061: and the note under the header says so');
  const payload = await sender.evaluate(u =>
    window.StateLink.decodeState(new URL(u).searchParams.get('drill')), url);
  eq(String(payload.seed), seedValue, '061: the payload carries the seed on screen');
  eq(payload.rowCount, 9, '061: and how many rows');
  eq(payload.difficulty, 'hard', '061: the difficulty');
  eq(payload.givenForm, 'percent', '061: and which form is given');
  ok(payload.lockSeed === undefined,
    '061: the lock-the-seed checkbox is a statement about the NEXT press of Generate and does not travel');
  /* The rows themselves are NOT in the link — that is the whole design. */
  /* Read the row off the ANSWER KEY: with "always percent" given, every
     fraction cell on the worksheet itself is deliberately blank. */
  const aFraction = (senderKey.match(/\d+\/\d+/) || [''])[0];
  ok(aFraction.length > 2 && JSON.stringify(payload).indexOf(aFraction) === -1,
    '061: and no row is in the payload at all: ' + JSON.stringify(payload));
  ok(JSON.stringify(payload).length < 120, '061: the whole worksheet is under 120 bytes of link');

  const receiver = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['061-receiver', receiver]);
  const asked = [];
  receiver.on('dialog', async d => { asked.push(d.message()); await d.dismiss(); });
  await receiver.goto(url, { waitUntil: 'load' });
  await settle(receiver, 800);
  eq(asked.length, 0, '061: an arriving sheet does not ask, because nothing here is anybody’s typing');
  ok(/Loaded a shared drill sheet/.test(await receiver.textContent('#shareNote')),
    '061: and it says what it did: ' + JSON.stringify(await receiver.textContent('#shareNote')));
  eq(await receiver.textContent('#worksheetTable'), senderRows,
    '061: the receiving device regenerates the same rows, in the same order');
  eq(await receiver.textContent('#keyTable'), senderKey, '061: and the same answer key');
  eq(await receiver.inputValue('#seedDisplay'), seedValue, '061: from the same seed');
  eq(await receiver.inputValue('#rowCount'), '9', '061: with the controls set to what made it');
  eq(await receiver.inputValue('#difficulty'), 'hard', '061: including the difficulty');
  eq(new URL(receiver.url()).searchParams.get('drill'), null, '061: the parameter is consumed on open');

  /* The failure this tool's own boot invites: generate() draws a NEW seed
     unless the seed is locked, so a receiver that rebuilt by calling it would
     show a different worksheet from the one it was sent — on a device whose
     stored settings say "lock" as much as on one that does not. */
  const locked = await prepPage(browser, BASE, { width: 1400, height: 1000 });
  pages.push(['061-locked', locked]);
  await seed(locked, [['fdp_settings_v1', JSON.stringify(
    { difficulty: 'easy', givenForm: 'fraction', rowCount: 30, lockSeed: true, seed: 12345 })]]);
  await locked.goto(url, { waitUntil: 'load' });
  await settle(locked, 800);
  eq(await locked.inputValue('#seedDisplay'), seedValue,
    '061: a device with its own locked seed still shows the sheet it was sent');
  eq(await locked.textContent('#worksheetTable'), senderRows, '061: row for row');
  eq(await locked.isChecked('#lockSeed'), true,
    '061: and its own lock-the-seed setting is left alone, because that is this device’s');

  /* The sheet's own rows, the download envelope, and axe on it. */
  await sender.click('#shareBtn');
  await settle(sender, 250);
  const rows = await sender.$$eval('.share-sheet-rows button', bs => bs.map(b => b.getAttribute('data-share')));
  ok(rows.includes('copy') && rows.includes('qr') && rows.includes('download'),
    '061: the sheet offers copy, QR and download: ' + JSON.stringify(rows));
  ok(await sender.evaluate(() => !document.querySelector('.share-sheet button[data-share="qr"]').disabled),
    '061: a seed always fits a QR code — that is the point of sharing one');
  const scan = await a11yScan(sender, { impact: 'serious', include: '.share-sheet' });
  eq(scan.length, 0, '061: no serious/critical axe violations on the open sheet: ' +
    JSON.stringify(scan.map(v => v.id)));
  await sender.keyboard.press('Escape');
  await settle(sender, 200);

  const broken = await prepPage(browser, BASE, { width: 1200, height: 900 });
  pages.push(['061-broken', broken]);
  await broken.goto(PAGE_URL + '?drill=not-base64-%%%', { waitUntil: 'load' });
  await settle(broken, 700);
  ok(/could not be read/.test(await broken.textContent('#shareNote')),
    '061: a mangled link says so rather than opening blank');
  ok((await broken.textContent('#worksheetTable')).length > 20,
    '061: and the tool still generated its own sheet underneath it');
}

/* ── 9. no console noise, nowhere ───────────────────────────────────────── */
console.log('');
for (const [name, p] of pages) {
  eq(p.__errs.length, 0, `no page/console errors (${name}): ` + JSON.stringify(p.__errs.slice(0, 3)));
  eq(p.__blocked.length, 0, `nothing left the site (${name}): ` + JSON.stringify(p.__blocked.slice(0, 3)));
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
