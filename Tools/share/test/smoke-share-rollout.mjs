// smoke-share-rollout.mjs — Path 6 P3: the builders that could not hand their
// work to another teacher at all. Increment 1 was six SINGLE-DOCUMENT tools;
// increment 2 added the three that keep a NAMED LIBRARY, which is a different
// claim and has its own section below; increment 3 adds five more of those
// (041, 051, 069, 082, 083) and no new machinery — which is the point of a
// table-driven suite.
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
];

/* ── 0. static: the four tags, in dependency order ──────────────────────── */
console.log('Share rollout — Path 6 P3, the builders that could not share');

const ORDER = ['_shared/state-link.js', '_shared/vendor/qrcode/qrcode.js', '_shared/qr-draw.js', '_shared/share.js'];
for (const t of [...TOOLS, { n: '081', file: '081-word-problem-warmup-generator.html' }]) {
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
const seedFor = (t, doc, name) => t.library
  ? [[t.library.list, JSON.stringify([name])],
     [t.library.data + name, JSON.stringify(doc)],
     [t.library.current, name]]
  : [[t.key, JSON.stringify(doc)]];

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
  ok(/Loaded a shared/.test(await fresh.textContent('#shareNote')), `${t.n}: and says so`);
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
  if (t.library) {
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

    const after = await mine.evaluate(([listKey, dataPrefix, name]) => ({
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
    const names2 = await mine.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), t.library.list);
    eq(names2.length, 2, `${t.n}: a refresh does not file the same arrival a second time: ` + JSON.stringify(names2));
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
      [file, t.imageField]), atPath(t.state, t.imageField),
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
