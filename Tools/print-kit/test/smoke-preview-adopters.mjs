// smoke-preview-adopters.mjs — the kit's print preview on the pages that
// adopted it after 074 (Path 7 P5): 076, 077, 051, 042 and 064, each a page
// with one print button; 043, the first with several (four sheets, four
// Print buttons, a Preview button in front of each); and 070, 023, 040, 018,
// 017 and 016, the last six. 018, 017 and 016 keep several areas inside one
// #printArea: the Preview button shows the asked-for area, and closing the
// preview puts the at-rest one back (PrintKit.preview's onClose).
//
//   node Tools/print-kit/test/smoke-preview-adopters.mjs [--only 051]
//
// 074's own suite (Tools/science-safety-label-maker/test/smoke-preview.mjs)
// pins the dialog itself: its keys, its names, its focus, what it leaves
// behind. This one pins what an adopter can get wrong, light and dark, for
// every state that tool's smoke-print.mjs prints (076 to 043) or a part of
// them chosen to cover each button, grid and paper (070 to 016):
//   - "Preview pages" is a real button before the print button, opens the
//     dialog and never calls print()
//   - the preview's page count is Chromium's PDF page count for the same state
//   - every card, slip or certificate of the sheet is in the preview, none on
//     a page past the count, and a canvas (051's QR codes, 042's) shows the
//     pixels of the live one
//   - the paper is the one PrintKit.setPage() wrote for that tool
//   - closing it leaves #printArea, the style sheets and <html> as they were,
//     and on a page with several areas the area Ctrl+P prints is showing again
//   - its Print button closes it and prints once, through the tool's own
//     print, and the PDF of that print has the preview's page count
//   - a Preview button is off exactly when its Print button is
//   - with nothing to print the button says what Print says and opens nothing
//   - axe finds nothing serious with the preview open
//
// A new adopter gets an entry in TOOLS; one with several print buttons lists
// them in `buttons` and gives `pages` as a list in the same order. print() is
// stubbed. The PDF is Chromium's; nothing was printed on paper.
//
// Pages this suite opens (the selector does not follow a table):
//   Tools/076-sub-note-feedback-slip-generator.html
//   Tools/077-testing-accommodations-card-generator.html
//   Tools/051-classroom-label-maker.html
//   Tools/042-certificate-award-maker.html
//   Tools/064-historical-trading-card-maker.html
//   Tools/043-field-trip-permission-slip.html
//   Tools/070-peer-feedback-checklist-generator.html
//   Tools/023-exit-ticket-generator.html
//   Tools/040-vocab-flashcard-generator.html
//   Tools/018-qr-scavenger-hunt-builder.html
//   Tools/017-gallery-walk-qr.html
//   Tools/016-qr-code-generator.html
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';

const PORT = 8495;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const only = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--only'));

// ---- fixtures: made-up names and text only, the states each tool's
// smoke-print.mjs prints, with the page counts pinned there ---------------------

// 076
const LONG_PROMPT = 'Describe in detail everything that happened during the class period including transitions, behaviour, ' +
  'questions students asked, and what you would change next time if you were to teach this lesson again tomorrow morning';
const prompts = (n, text) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, text: text || `Prompt number ${i + 1}?` }));
const slip = (copyCount, n, extra = {}) => ({ copyCount, classPeriod: '', urgencyBox: true, prompts: prompts(n), ...extra });

// 077
const students = n => Array.from({ length: n }, (_, i) => `Student Number${String(i + 1).padStart(2, '0')}`);
const TYPES = ['Extended time', 'Separate setting', 'Read-aloud', 'Breaks as needed', 'Use of calculator', 'Preferential seating']
  .map((name, i) => ({ id: 'x' + i, name }));
function cardSet(n, { notes = {}, all = false, none = false } = {}) {
  const roster = students(n), assignments = {};
  if (!none) roster.forEach((name, i) => TYPES.forEach((t, k) => { if (all || (i + k) % 2 === 0) assignments[name + '|' + t.id] = true; }));
  return { roster, types: TYPES, assignments, notes };
}
const LONG_NOTE = Array(40).fill('Seat near the door; reader for all directions.').join(' ');

// 051
const LONG_WORD = { target: 'el sacapuntas eléctrico de la mesa del profesor', english: 'the electric pencil sharpener on the teacher’s desk (ask before using it)' };
function wordsOf(n, long) {
  const w = [];
  for (let i = 0; i < n; i++) w.push({ target: 'la palabra ' + (i + 1), english: 'word ' + (i + 1) });
  if (long) w.splice(1, 0, LONG_WORD);
  return w;
}

// 042
const roster = n => Array.from({ length: n }, (_, i) => 'Student ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? '2' : '') + ' Sample');
const cert = extra => ({
  name: 'Honor Roll', theme: 'elegant', border: 'double-line', logo: '', mode: 'single', studentName: 'Avery Quill',
  batchNames: '', awardTitle: 'Certificate of Achievement', awardTitleCustom: '', reason: 'For outstanding effort',
  certDate: '2026-09-28', signature: 'Ms. Invented', signatureImage: '', qrUrl: '', orientation: 'landscape', perPage: 1,
  showGuides: false, stockInset: 0, ...extra,
});
const batch = (n, extra) => cert({ mode: 'batch', studentName: '', batchNames: roster(n).join('\n'), ...extra });
const LONG_REASON = new Array(30).join('For a very long reason indeed. ');

// 064
const LONG_CARD = {
  id: 'cx', name: 'Wilhelmina Featherstonehaugh-Abernathy of Quillhaven', image: null,
  stats: Array.from({ length: 9 }, (_, i) => ({ label: 'Stat ' + (i + 1), value: 'A made-up value that runs on for a while ' + i })),
  facts: Array.from({ length: 6 }, (_, i) => 'A made-up fact number ' + i + ' that is long enough to wrap over more than one line of the card back.'),
  theme: null, meta: { rarity: 'epic', setName: 'Invented Set', cardNo: 1, setSize: 9, stars: 4 },
};
const deck = (n, size, theme = 'classic', long = false) => ({
  v: 2, settings: { size, theme },
  cards: Array.from({ length: n }, (_, i) => (long && i === 0) ? LONG_CARD : ({
    id: 'c' + i, name: 'Figure ' + (i + 1), image: null,
    stats: [{ label: 'Born', value: String(1700 + i) }, { label: 'From', value: 'Port Azul' }],
    facts: ['Made-up fact ' + (i + 1) + '.'], theme: null,
    meta: { rarity: ['common', 'rare', 'epic', 'legendary'][i % 4], setName: 'Invented Set', cardNo: i + 1, setSize: n, stars: i % 6 },
  })),
});

// 043
const THREE = ['Aiden Sample', 'Bella Sample', 'Carlos Sample'];
const trip = over => Object.assign({
  name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: THREE.join('\n'), blankCount: 5,
  collected: { 'Aiden Sample': { returned: true, payment: 'paid' } },
  chaperones: [{ name: 'Mr. Invented', phone: '555-0100' }], chaperoneAssignments: { 'Aiden Sample': 'Mr. Invented' },
  schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
  departureTime: '08:30', returnTime: '14:15', purpose: 'Tour the local history wing.', cost: '$12', whatToBring: 'Lunch.',
  chaperoneName: '', chaperonePhone: '', emergencyInstructions: '', dueDate: '2026-10-15',
  secondLang: '', langLayout: 'facing', translations: { purpose: '', whatToBring: '', emergencyInstructions: '' },
}, over);
const LONG_TRIP = new Array(40).join('A made-up sentence about the trip that goes on. ');

// 070
const cats070 = (nc, ni) => Array.from({ length: nc }, (_, c) => ({
  id: 'c' + c, name: 'Category ' + (c + 1),
  items: Array.from({ length: ni }, (_, i) => ({ id: `i${c}_${i}`, text: `Checklist item ${i + 1} of category ${c + 1}` })),
}));
const checklist = (copyCount, ratingStyle, categories, assignmentName = 'Essay') => ({ assignmentName, copyCount, ratingStyle, categories });
const klass = n => Array.from({ length: n }, (_, i) => `Student ${String(i + 1).padStart(2, '0')} Testname`);

// 023
const SHORT = 'Name one thing you learned today.';
const ESSAY = new Array(41).join('Explain how the river shaped the valley, with evidence from the lab. ');
const ticket = over => Object.assign({
  category: 'mine', perPage: 2, showName: true, showDate: true, includeMine: true, thinkTime: 0, slipMode: 'same',
  qrEnabled: false, qrUrl: '', batchMode: false, answerStyle: 'lines', answerSpace: 'auto', mode: 'shuffle',
}, over);
const triage = n => ({ groupSize: 3, students: roster(n).map((name, i) => ({ id: 't' + i, name, status: ['reteach', 'almost', 'got', ''][i % 4] })) });

// 040
const LONGDEF = 'the process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water, generally involving the green pigment and generating oxygen as a byproduct';
function vocab(n, long) {
  const w = [];
  for (let i = 1; i <= n; i++) w.push(`term ${i} [turm ${i}] (noun): the made-up meaning of word number ${i} | An example sentence for word ${i}.`);
  if (long) w.splice(1, 0, `Extraordinarilylongmadeupword: ${LONGDEF} | ${LONGDEF}`);
  return w.join('\n');
}
const PUZZLE = 'Photosynthesis Mitosis Osmosis Ecosystem Enzyme Chlorophyll Nucleus Habitat Organism Membrane Protein Molecule Predator Climate Erosion Glacier Mineral Fossil Magma Sediment Orbit Gravity Comet Planet'
  .split(' ').map((t, i) => `${t}: the made-up meaning number ${i + 1} of this word`).join('\n');
const vlist = over => ({
  name: 'Made-up list', mode: 'flashcards', flashCols: 2, flashRows: 4, cardSizePreset: 'grid', flashLayout: 'duplex',
  wallPerPage: 2, wallShowDef: true, sortOrder: 'none', shuffle: false, showGuides: true, bingoCount: 4, bingoField: 'term', ...over,
});

// 018
const QTYPES = ['text', 'numeric', 'choice', 'photo'];
const LONG_STATION = {
  label: 'The long corridor behind the gymnasium storage room',
  content: 'Walk to the far end of the corridor, count every blue locker on the left side, then subtract the number of doors you passed on the way there and back again.',
  note: 'a long note for the key', qType: 'choice', choices: ['Fourteen lockers', 'Twenty-two lockers', 'Nine', 'None of these', 'Ask', 'Skip'],
  correctChoice: 2, numericAnswer: '', tolerance: '0', hint: 'count twice', hintPenalty: '1', codeWord: 'CORRIDOR',
};
function hunt(pp, n, t, long) {
  const stations = [];
  for (let i = 0; i < n; i++) {
    const qType = QTYPES[i % 4];
    stations.push({
      label: 'Stop ' + (i + 1), content: 'Clue number ' + (i + 1) + ' for the hunt', note: i % 3 ? '' : 'note ' + (i + 1), qType,
      choices: qType === 'choice' ? ['Red', 'Green', 'Blue'] : [], correctChoice: 1, numericAnswer: qType === 'numeric' ? '12' : '', tolerance: '0',
      hint: i % 5 ? '' : 'look up', hintPenalty: '2', codeWord: 'WORD' + (i + 1),
    });
  }
  if (long) stations.splice(1, 0, LONG_STATION);
  const teams = Array.from({ length: t }, (_, i) => ({ name: 'Crew ' + (i + 1), code: 'T' + String(i + 1).padStart(3, 'X'), marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0 }));
  return { name: 'Test hunt', stations, cardsPerPage: String(pp), ecLevel: 'Q', showNumber: true, run: { teams, stagger: true } };
}

// 017
const LONG_TEXT = 'Stand an arm’s length back, read the whole poster from the title down, and then write on your slip one claim the authors make, the evidence they give for it, and one question you would ask them if they were standing here.';
function walk(s) {
  const entries = [];
  for (let i = 0; i < s.n; i++) entries.push({
    name: 'Poster ' + (i + 1),
    value: i % 2 ? 'Look closely at exhibit ' + (i + 1) + ' and count the labels' : 'https://example.com/walk/poster-' + (i + 1),
    feedbackNotes: i % 3 === 0 ? 'Clear title.\nGraph needs units.\nNice colours ' + (i + 1) : '',
  });
  if (s.long) entries.splice(1, 0, { name: 'The very long name of a group project about river deltas', value: LONG_TEXT, feedbackNotes: Array.from({ length: 70 }, (_, k) => 'Comment number ' + (k + 1) + ' about the delta poster and its map').join('\n') });
  return {
    name: 'Test walk', cardsPerPage: String(s.pp), ecLevel: 'Q', showNumber: true, reactionsEnabled: s.n === 5, entries,
    feedbackEnabled: true, feedbackStyle: s.style, feedbackPrompt: s.long ? 'Name one thing this poster taught you and one thing you would change about it' : '',
    feedbackCopies: s.copies, feedbackPerPage: String(s.spp),
    timer: { minutes: 3, seconds: 0, rotations: Math.min(entries.length, 6) },
    walkGroups: Array.from({ length: s.t }, (_, i) => i === 2 ? 'A group with a long name, Table Seven by the window' : 'Walker ' + (i + 1)),
    routeCardsPerPage: String(s.rpp),
  };
}

// 016
const codeLines = n => Array.from({ length: n }, (_, i) => (i === 1 ? 'A much longer label for station two by the window' : 'Station ' + (i + 1)) + ', https://example.com/s/' + (i + 1)).join('\n');
const inventoryOf = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['asset-' + (i + 1), {
  label: 'Microscope ' + (i + 1), status: i % 3 ? 'in' : 'out', assignedTo: i % 3 ? '' : 'Table ' + (i + 1),
  checkedOutAt: i % 3 ? null : 1790000000000, checkedInAt: i % 3 ? 1790000000000 : null, history: [],
}]));

const LETTER = ['816px', '1056px'];
const ONE = [{ preview: 'previewBtn', print: 'printBtn', what: '' }];

// `store(state)` is what goes into localStorage before the page loads;
// `after(page, s)` sets what the tool does not save; `piece` is one printed
// thing, counted in the live sheet and in the preview; `pages` is the count
// that tool's smoke-print.mjs pins for the state (left out where it does not).
const TOOLS = [
  {
    n: '076', file: '076-sub-note-feedback-slip-generator.html', piece: '.pk-sheet', paper: LETTER, print: 'Print slips',
    store: s => s.state ? [['snfs_slip_v1', JSON.stringify(s.state)]] : [],
    states: [
      { name: 'two copies, four prompts', state: slip(2, 4), pages: 1 },
      { name: 'five copies, a class period', state: slip(5, 4, { classPeriod: '3rd Period' }), pages: 3 },
      { name: 'four copies, five prompts, no call-me box', state: slip(4, 5, { urgencyBox: false }), pages: 2 },
      { name: 'three copies, six prompts', state: slip(3, 6, { classPeriod: '3rd Period' }), pages: 3 },
      { name: 'four copies, five wordy prompts', state: slip(4, 5, { prompts: prompts(5, LONG_PROMPT) }), pages: 4 },
      { name: 'one copy', state: slip(1, 4), pages: 1 },
      { name: 'a saved count past the limit', state: slip(99, 4), pages: 10 },
      { name: 'a first visit', state: null },
    ],
  },
  {
    n: '077', file: '077-testing-accommodations-card-generator.html', piece: '.pk-card', paper: LETTER, print: 'Print cards',
    store: s => s.state ? [['tacg_cards_v1', JSON.stringify(s.state)]] : [],
    after: async (page, s) => {
      if (s.cols) await page.selectOption('#printColsSelect', s.cols);
      if (s.who) await page.selectOption('#printWhoSelect', s.who);
    },
    empty: { state: null, says: 'Save a roster first.' },
    states: [
      { name: '3 students, 3 across', state: cardSet(3, { notes: { 'Student Number01': '1.5x on unit tests' } }), cols: '3', pages: 1 },
      { name: '9 students, 3 across', state: cardSet(9), cols: '3', pages: 1 },
      { name: '10 students, 3 across', state: cardSet(10), cols: '3', pages: 2 },
      { name: '28 students, 3 across', state: cardSet(28), cols: '3', pages: 4 },
      { name: '28 students, 2 across', state: cardSet(28), cols: '2', pages: 5 },
      { name: '28 students, 4 across, every box ticked', state: cardSet(28, { all: true }), cols: '4', pages: 3 },
      { name: '12 students, 4 across', state: cardSet(12), cols: '4', pages: 1 },
      { name: '13 students, 4 across', state: cardSet(13), cols: '4', pages: 2 },
      { name: '7 students, 2 across, nothing ticked', state: cardSet(7, { none: true }), cols: '2', pages: 2 },
      { name: 'one student picked from 28', state: cardSet(28), cols: '3', who: 'Student Number05', pages: 1 },
      { name: '9 students, a long note, 3 across', state: cardSet(9, { notes: { 'Student Number01': LONG_NOTE } }), cols: '3', pages: 2 },
      { name: '9 students, a long note, 4 across', state: cardSet(9, { notes: { 'Student Number01': LONG_NOTE } }), cols: '4', pages: 2 },
    ],
  },
  {
    n: '051', file: '051-classroom-label-maker.html', piece: '.label-card', paper: LETTER, print: 'Print labels + reference sheet', canvases: true,
    store: s => s.words ? [
      ['clm_lists_v1', JSON.stringify(['Invented list'])],
      ['clm_list_v1:Invented list', JSON.stringify({ name: 'Invented list', words: s.words, lang: 'es-ES' })],
      ['clm_current_v1', 'Invented list'],
    ] : [],
    empty: { words: null, says: 'Save a word list first.' },
    states: [
      { n: 1, pages: 2 }, { n: 3, pages: 2 }, { n: 4, pages: 2 }, { n: 14, long: true, pages: 2 }, { n: 18, pages: 2 },
      { n: 19, pages: 3 }, { n: 21, pages: 3 }, { n: 22, pages: 3 }, { n: 39, pages: 5 }, { n: 40, pages: 5 },
      { n: 61, pages: 7 }, { n: 120, pages: 12 },
    ].map(s => ({ ...s, words: wordsOf(s.n, s.long), name: `${s.long ? s.n + 1 : s.n} label${s.n === 1 ? '' : 's'}${s.long ? ', one long' : ''}` })),
  },
  {
    n: '042', file: '042-certificate-award-maker.html', piece: '.print-page', print: 'Print / Save as PDF',
    store: s => s.set ? [
      ['gvb-certificate-maker:list', JSON.stringify(['Honor Roll'])],
      ['gvb-certificate-maker:current', 'Honor Roll'],
      ['gvb-certificate-maker:data:Honor Roll', JSON.stringify(s.set)],
    ] : [],
    states: [
      { name: 'a first visit', set: null, pages: 1 },
      { name: 'one certificate, landscape', set: cert({}), pages: 1 },
      { name: 'one certificate, portrait', set: cert({ orientation: 'portrait' }), pages: 1, portrait: true },
      { name: 'one certificate at two per page', set: cert({ perPage: 2 }), pages: 1 },
      { name: 'one certificate for pre-printed stock, with guides and a QR code', set: cert({ stockInset: 0.75, showGuides: true, qrUrl: 'https://example.org/awards' }), pages: 1 },
      { name: 'a batch with no names', set: batch(0, {}), pages: 1 },
      { name: 'a batch of three', set: batch(3, {}), pages: 3 },
      { name: 'a batch of three at two per page', set: batch(3, { perPage: 2 }), pages: 2 },
      { name: 'a batch of four at two per page, portrait', set: batch(4, { perPage: 2, orientation: 'portrait' }), pages: 2, portrait: true },
      { name: 'a class of twenty-eight', set: batch(28, {}), pages: 28 },
      { name: 'a class of twenty-eight at two per page', set: batch(28, { perPage: 2 }), pages: 14 },
      { name: 'a batch of three with a reason too long for the certificate', set: batch(3, { theme: 'playful', border: 'stars', reason: LONG_REASON }), pages: 3 },
    ].map(s => ({ ...s, paper: s.portrait ? LETTER : [LETTER[1], LETTER[0]] })),
  },
  {
    n: '064', file: '064-historical-trading-card-maker.html', piece: '.pk-card', paper: LETTER, print: 'Print cards',
    store: s => [
      ['htcm:list', JSON.stringify(['Invented deck'])],
      ['htcm:data:Invented deck', JSON.stringify(s.deck)],
      ['htcm:current', 'Invented deck'],
    ],
    empty: { deck: deck(0, 'standard'), says: 'Add at least one card first.' },
    states: [
      { size: 'standard', n: 1, pages: 2 }, { size: 'standard', n: 6, pages: 2 }, { size: 'standard', n: 7, pages: 4 }, { size: 'standard', n: 13, pages: 6 },
      { size: 'fill', n: 1, pages: 2 }, { size: 'fill', n: 6, pages: 2 }, { size: 'fill', n: 7, pages: 4 }, { size: 'fill', n: 13, pages: 6 },
      { size: 'reference', n: 1, pages: 2 }, { size: 'reference', n: 6, pages: 4 }, { size: 'reference', n: 7, pages: 4 }, { size: 'reference', n: 13, pages: 8 },
      { size: 'standard', n: 4, long: true, pages: 2 }, { size: 'fill', n: 4, theme: 'parchment', long: true, pages: 2 },
      { size: 'reference', n: 5, theme: 'blueprint', long: true, pages: 4 }, { size: 'standard', n: 9, theme: 'science', pages: 4 },
    ].map(s => ({ ...s, deck: deck(s.n, s.size, s.theme, s.long), name: `${s.n} ${s.size} card${s.n === 1 ? '' : 's'}${s.theme ? ', ' + s.theme : ''}${s.long ? ', one long' : ''}` })),
  },
  {
    n: '043', file: '043-field-trip-permission-slip.html', piece: '.pk-sheet, .nothing-missing', paper: LETTER, several: true,
    buttons: [
      { preview: 'previewBtn', print: 'printBtn', what: ' slips', label: 'Preview pages' },
      { preview: 'previewMissingListBtn', print: 'printMissingListBtn', what: ' missing list', label: 'Preview missing list' },
      { preview: 'previewReminderSlipsBtn', print: 'printReminderSlipsBtn', what: ' reminder slips', label: 'Preview reminder slips' },
      { preview: 'previewChaperoneBtn', print: 'printChaperoneBtn', what: ' chaperone groups', label: 'Preview chaperone groups' },
    ],
    store: s => s.state ? [
      ['gvb-field-trip:list', JSON.stringify(['Museum Trip'])],
      ['gvb-field-trip:current', 'Museum Trip'],
      ['gvb-field-trip:data:Museum Trip', JSON.stringify(s.state)],
    ] : [],
    states: [
      { name: 'a first visit', state: null, pages: [1, 1, 1, 1] },
      { name: 'a class of three', state: trip({}), pages: [3, 1, 1, 1] },
      { name: 'a class of twenty-eight', state: trip({ batchNames: roster(28).join('\n'), collected: {}, chaperoneAssignments: {} }), pages: [28, 1, 14, 1] },
      { name: 'one named student', state: trip({ mode: 'single', studentName: 'Bella Sample', batchNames: '' }), pages: [1, 1, 1, 1] },
      { name: 'five blank copies', state: trip({ mode: 'blank' }), pages: [5, 1, 1, 1] },
      { name: 'batch mode with no names', state: trip({ batchNames: '', collected: {}, chaperoneAssignments: {} }), pages: [1, 1, 1, 1] },
      { name: 'three, Spanish on a facing page', state: trip({ secondLang: 'es' }), pages: [6, 1, 1, 1] },
      { name: 'three, Spanish side by side', state: trip({ secondLang: 'es', langLayout: 'column' }) },
      { name: 'three, a long description', state: trip({ purpose: LONG_TRIP, whatToBring: LONG_TRIP }) },
      { name: 'everything returned', state: trip({ collected: { 'Aiden Sample': { returned: true, payment: 'paid' }, 'Bella Sample': { returned: true, payment: 'paid' }, 'Carlos Sample': { returned: true, payment: 'waived' } } }), pages: [3, 1, 1, 1] },
    ],
  },
  {
    n: '070', file: '070-peer-feedback-checklist-generator.html', piece: '.pk-sheet', paper: LETTER, calls: 1,
    wiring: [/wirePreview\(els\.previewBtn, renderBlanks, els\.printBtn\)/, /wirePreview\(els\.previewClassBtn, renderClassSet, els\.printClassBtn\)/,
      /PrintKit\.preview\(\{ trigger: previewBtn, onPrint: function \(\) \{ printBtn\.click\(\); \} \}\)/],
    buttons: [
      { preview: 'previewBtn', print: 'printBtn', what: ' blanks', label: 'Preview checklists' },
      { preview: 'previewClassBtn', print: 'printClassBtn', what: ' class set', label: 'Preview one per student' },
    ],
    store: s => [...(s.state ? [['pfc_checklist_v1', JSON.stringify(s.state)]] : []),
      ...(s.klass ? [['np_rosters', JSON.stringify({ 'Period 3': klass(s.klass) })]] : [])],
    after: async (page, s) => {
      if (s.klass) await page.selectOption('#rosterSelect', 'Period 3');
      if (s.reviewer) await page.check('#withReviewer');
    },
    // a saved checklist with no categories loads the template, so they are deleted on the page
    empty: { state: checklist(2, 'check', cats070(2, 1)), says: 'Load a template or add a category first.',
      prep: async page => { for (let i = 0; i < 2; i++) await page.locator('[data-del-cat]').first().click(); } },
    off: { state: checklist(2, 'check', cats070(3, 3)), buttons: ['previewClassBtn'] },
    states: [
      { name: 'a first visit', state: null, pages: 3, only: 'previewBtn' },
      { name: 'five copies, six lines', state: checklist(5, 'check', cats070(3, 2), ''), pages: 3, only: 'previewBtn' },
      { name: 'four copies, yes / somewhat / no', state: checklist(4, 'three', cats070(3, 3)), pages: 2, only: 'previewBtn' },
      { name: 'four copies, sixteen lines', state: checklist(4, 'check', cats070(4, 4)), pages: 4, only: 'previewBtn' },
      { name: 'four copies, thirty lines', state: checklist(4, 'check', cats070(6, 5)), pages: 8, only: 'previewBtn' },
      { name: 'one copy', state: checklist(1, 'check', cats070(3, 3)), pages: 1, only: 'previewBtn' },
      { name: 'a saved count past the limit', state: checklist(99, 'check', cats070(3, 3)), pages: 30, only: 'previewBtn' },
      { name: 'a class of one', state: checklist(2, 'check', cats070(3, 3)), klass: 1, pages: 1, only: 'previewClassBtn' },
      { name: 'a class of seven, with reviewers', state: checklist(2, 'three', cats070(3, 3)), klass: 7, reviewer: true, pages: 4, only: 'previewClassBtn' },
      { name: 'a class of twenty-eight', state: checklist(2, 'check', cats070(3, 3)), klass: 28, pages: 14, only: 'previewClassBtn' },
      { name: 'a class of five, sixteen lines', state: checklist(2, 'check', cats070(4, 4)), klass: 5, pages: 5, only: 'previewClassBtn' },
    ],
  },
  {
    n: '023', file: '023-exit-ticket-generator.html', piece: '.pk-sheet', paper: LETTER, calls: 2,
    wiring: [/PrintKit\.preview\(\{ trigger: els\.previewBtn, onPrint: function \(\) \{ els\.printBtn\.click\(\); \} \}\)/,
      /trigger: els\.previewTriageBtn, onClose: renderHandout,\s+onPrint: function \(\) \{ els\.printTriageBtn\.click\(\); \}/],
    buttons: [
      { preview: 'previewBtn', print: 'printBtn', what: ' handout', label: 'Preview Handout', tab: '.tab-btn[data-tab="handout"]' },
      { preview: 'previewTriageBtn', print: 'printTriageBtn', what: ' reteach list', label: 'Preview Reteach List', tab: '.tab-btn[data-tab="triage"]', rest: true },
    ],
    store: s => [...(s.set ? [['gvb-exit-ticket:settings', JSON.stringify(s.set)], ['gvb-exit-ticket:customPrompts', JSON.stringify([{ id: 'c1', text: s.prompt || SHORT }])]] : []),
      ...(s.tri ? [['gvb-exit-ticket:triage', JSON.stringify(s.tri)]] : [])],
    after: async (page, s) => {
      if (s.set) { await page.fill('#customPrompt', s.prompt || SHORT); await page.click('#useCustomBtn'); }
      if (s.names) { await page.click('.tab-btn[data-tab="handout"]'); await page.fill('#batchNamesInput', s.names.join('\n')); }
    },
    // what Ctrl+P prints at rest: the handout, never the reteach list
    rest: () => String(document.querySelectorAll('#printArea .triage-print-page').length),
    states: [
      { name: 'a first visit', set: null, pages: 1, only: 'previewBtn' },
      { name: 'four to a page, QR code and grid', set: ticket({ perPage: 4, qrEnabled: true, qrUrl: 'https://example.org/exit-ticket/period-3', answerStyle: 'grid' }), pages: 1, only: 'previewBtn' },
      { name: 'four to a page, a different prompt on each', set: ticket({ perPage: 4, slipMode: 'different', category: 'all' }), pages: 1, only: 'previewBtn' },
      { name: 'two to a page, a prompt too long for a half sheet', set: ticket({}), prompt: ESSAY, pages: 4, only: 'previewBtn' },
      { name: 'four to a page, a prompt too long for a quarter sheet', set: ticket({ perPage: 4 }), prompt: ESSAY, pages: 4, only: 'previewBtn' },
      { name: 'a class set with no names', set: ticket({ batchMode: true }), names: [], pages: 1, only: 'previewBtn', label: 'Preview Class Set' },
      { name: 'a class of three, two to a page', set: ticket({ batchMode: true }), names: roster(3), pages: 2, only: 'previewBtn', label: 'Preview Class Set' },
      { name: 'a class of twenty-eight, four to a page', set: ticket({ batchMode: true, perPage: 4 }), names: roster(28), pages: 7, only: 'previewBtn', label: 'Preview Class Set' },
      { name: 'a class of twenty-eight, four to a page, a long prompt', set: ticket({ batchMode: true, perPage: 4 }), prompt: ESSAY, names: roster(28), pages: 28, only: 'previewBtn', label: 'Preview Class Set' },
      { name: 'a reteach list for eight', set: ticket({ perPage: 4 }), tri: triage(8), pages: 1, only: 'previewTriageBtn' },
      { name: 'a reteach list for sixty', set: ticket({ perPage: 4 }), tri: triage(60), pages: 2, only: 'previewTriageBtn' },
    ],
  },
  {
    n: '040', file: '040-vocab-flashcard-generator.html', piece: '.page', paper: LETTER, calls: 1, view: { width: 778, height: 900 },
    wiring: [/wirePreview\(els\.previewBtn, renderSheet, els\.printBtn\)/, /wirePreview\(els\.previewAlignTestBtn, renderAlignTest, els\.alignTestBtn\)/,
      /if \(build\(\)\) PrintKit\.preview\(\{ trigger: previewBtn, onPrint: printBuilt \}\)/],
    buttons: [
      { preview: 'previewBtn', print: 'printBtn', what: '', label: 'Preview pages' },
      { preview: 'previewAlignTestBtn', print: 'alignTestBtn', what: ' alignment test', label: 'Preview alignment test page' },
    ],
    store: s => [
      ['gvb-vocab-flashcards:list', JSON.stringify(['Made-up list'])],
      ['gvb-vocab-flashcards:data:Made-up list', JSON.stringify(s.list)],
      ['gvb-vocab-flashcards:current', 'Made-up list'],
    ],
    empty: { list: vlist({ words: '' }), says: 'Add some words before printing. The list is empty.' },
    states: [
      { name: 'flashcards 2 x 4, 3 words', list: vlist({ words: vocab(3) }), pages: [2, 2] },
      { name: 'flashcards 2 x 4, 40 words', list: vlist({ words: vocab(40) }), pages: [10, 2] },
      { name: 'flashcards 3 x 5 grid, 10 words, one long', list: vlist({ flashCols: 3, flashRows: 5, words: vocab(9, true) }), pages: [2, 2] },
      { name: '3 x 5 index cards, 10 words, one long', list: vlist({ cardSizePreset: '3x5', words: vocab(9, true) }), pages: [6, 2] },
      { name: '4 x 6 index cards without guides, 3 words', list: vlist({ cardSizePreset: '4x6', showGuides: false, words: vocab(3) }), pages: [4, 2] },
      { name: 'fold-over 2 x 4, 40 words', list: vlist({ flashLayout: 'fold', words: vocab(40) }), pages: [5, 2] },
      { name: 'word wall one to a page, 3 words', list: vlist({ mode: 'wordwall', wallPerPage: 1, words: vocab(3) }), pages: 3, only: 'previewBtn' },
      { name: 'word wall two to a page, 10 words, one long', list: vlist({ mode: 'wordwall', wallPerPage: 2, words: vocab(9, true) }), pages: 5, only: 'previewBtn' },
      { name: 'word wall four to a page without definitions, 40 words', list: vlist({ mode: 'wordwall', wallPerPage: 4, wallShowDef: false, words: vocab(40) }), pages: 10, only: 'previewBtn' },
      { name: 'a word search', list: vlist({ mode: 'wordsearch', words: PUZZLE }), only: 'previewBtn' },
      { name: 'a crossword', list: vlist({ mode: 'crossword', words: PUZZLE }), only: 'previewBtn' },
      { name: 'four bingo cards', list: vlist({ mode: 'bingo', words: PUZZLE }), only: 'previewBtn' },
      { name: 'a matching quiz', list: vlist({ mode: 'matching', words: PUZZLE }), only: 'previewBtn' },
    ],
  },
  {
    n: '018', file: '018-qr-scavenger-hunt-builder.html', paper: LETTER, calls: 1, canvases: true,
    wiring: [/PrintKit\.preview\(\{ trigger: pair\.preview, onClose: atRest, onPrint: function \(\) \{ pair\.print\.click\(\); \} \}\)/,
      /function atRest\(\) \{ showSection\(els\.printStationArea\); \}/, /window\.addEventListener\('afterprint', atRest\)/],
    buttons: [
      { preview: 'preview-stations-btn', print: 'print-stations-btn', what: ' station cards', label: 'Preview Station Cards', tab: '#tab-build', piece: '#print-station-area .p-card' },
      { preview: 'preview-answers-btn', print: 'print-answers-btn', what: ' answer key', label: 'Preview Answer Key', tab: '#tab-build', piece: '#print-answer-area tbody tr:not([aria-hidden])', rest: true },
      { preview: 'preview-clues-btn', print: 'print-clues-btn', what: ' clue cards', label: 'Preview Clue Cards (No Device)', tab: '#tab-build', piece: '#print-clues-area .p-card', rest: true },
      { preview: 'preview-teams-btn', print: 'print-teams-btn', what: ' team cards', label: 'Preview Team Cards', tab: '#tab-run', piece: '#print-teams-area .pk-card', rest: true },
      { preview: 'preview-routes-btn', print: 'print-routes-btn', what: ' route cards', label: 'Preview Route Cards', tab: '#tab-run', piece: '#print-routes-area .pk-card', rest: true },
      { preview: 'preview-answersheets-btn', print: 'print-answersheets-btn', what: ' answer sheets', label: 'Preview Answer Sheets', tab: '#tab-run', piece: '#print-answersheets-area .pk-card', rest: true },
    ],
    store: s => s.hunt ? [['qr-scavenger-hunt-sets', JSON.stringify({ current: s.hunt.name, sets: { [s.hunt.name]: s.hunt } })]] : [],
    rest: () => [...document.querySelectorAll('.print-only.active')].map(x => x.id).join(','),
    off: { hunt: null, buttons: ['preview-stations-btn', 'preview-answers-btn', 'preview-clues-btn'] },
    states: [
      { name: 'one to a page, 5 stations, 3 teams', hunt: hunt(1, 5, 3), pages: [5, 1, 5, 1, 2, 2] },
      { name: 'two to a page, 14 stations (one long), 9 teams', hunt: hunt(2, 13, 9, true), pages: [7, 2, 7, 3, 5, 5] },
      { name: 'four to a page, 1 station, 1 team', hunt: hunt(4, 1, 1), pages: [1, 1, 1, 1, 1, 1] },
      { name: 'four to a page, 30 stations, 12 teams', hunt: hunt(4, 30, 12), pages: [8, 2, 8, 3, 6, 12] },
      { name: 'six to a page, 6 stations, 2 teams', hunt: hunt(6, 6, 2), pages: [1, 1, 1, 1, 1, 1] },
      { name: 'nine to a page, 14 stations (one long), 9 teams', hunt: hunt(9, 13, 9, true) },
    ],
  },
  {
    n: '017', file: '017-gallery-walk-qr.html', paper: LETTER, calls: 1, canvases: true,
    wiring: [/PrintKit\.preview\(\{ trigger: pair\.preview, onClose: atRest, onPrint: function \(\) \{ pair\.print\.click\(\); \} \}\)/,
      /function atRest\(\) \{ showSection\(null\); \}/, /window\.addEventListener\('afterprint', atRest\)/],
    buttons: [
      { preview: 'previewCodesBtn', print: 'printCodesBtn', what: ' QR codes', label: 'Preview QR Codes', piece: '#printQrArea .p-card', rest: true },
      { preview: 'previewRefBtn', print: 'printRefBtn', what: ' reference sheet', label: 'Preview Reference Sheet', piece: '#printRefArea tbody tr:not([aria-hidden])', rest: true },
      { preview: 'previewSlipsBtn', print: 'printSlipsBtn', what: ' feedback slips', label: 'Preview Feedback Slips', piece: '#printSlipsArea .s-card', rest: true },
      { preview: 'previewRouteCardsBtn', print: 'printRouteCardsBtn', what: ' route cards', label: 'Preview Route Cards', piece: '#printRouteCardsArea .r-card', rest: true },
      { preview: 'previewPacketsBtn', print: 'printPacketsBtn', what: ' feedback packets', label: 'Preview Feedback Packets', piece: '#printPacketsArea .pk-page', rest: true },
    ],
    store: s => s.walk ? [['gallery-walk-qr-sets', JSON.stringify({ current: s.walk.name, sets: { [s.walk.name]: s.walk } })]] : [],
    rest: () => [...document.querySelectorAll('.print-only.active')].map(x => x.id).join(',') + '|' + document.getElementById('printArea').classList.contains('sheet-asked'),
    off: { walk: null, buttons: ['previewCodesBtn', 'previewRefBtn', 'previewSlipsBtn', 'previewRouteCardsBtn', 'previewPacketsBtn'] },
    states: [
      { pp: 1, n: 1, spp: 2, style: 'stars', rpp: 4, copies: 6, t: 1, pages: [1, 1, 3, 0, 1] },
      { pp: 2, n: 5, spp: 4, style: 'rubric', rpp: 6, copies: 6, t: 4, pages: [3, 1, 8, 1, 2] },
      { pp: 4, n: 13, long: true, spp: 6, style: 'stars', rpp: 2, copies: 2, t: 11, pages: [4, 1, 5, 6, null] },
      { pp: 6, n: 6, spp: 2, style: 'sticky', rpp: 2, copies: 1, t: 6, pages: [1, 1, 3, 3, 2] },
      { pp: 8, n: 30, spp: 6, style: 'rubric', rpp: 6, copies: 3, t: 30, pages: [4, null, 15, 5, null] },
    ].map(s => ({ ...s, walk: walk(s), name: `${s.pp} codes to a page, ${s.long ? s.n + 1 : s.n} entr${s.n === 1 ? 'y' : 'ies'}, ${s.style} slips ${s.spp} to a page, routes ${s.rpp} to a page` })),
  },
  {
    n: '016', file: '016-qr-code-generator.html', calls: 1,
    wiring: [/window\.PrintKit\.preview\(\{ trigger: pair\.preview, onClose: atRest, onPrint: function \(\) \{ pair\.print\.click\(\); \} \}\)/,
      /wirePreview\('btn-preview', els\.btnPrint\)/, /wirePreview\('btn-bulk-preview', els\.btnBulkPrint\)/, /wirePreview\('btn-preview-inventory', els\.btnPrintInventory\)/],
    buttons: [
      { preview: 'btn-preview', print: 'btn-print', what: ' one code', label: 'Preview this code', piece: '#print-area img', rest: true },
      { preview: 'btn-bulk-preview', print: 'btn-bulk-print', what: ' grid', label: 'Preview grid', piece: '#print-area-bulk .pk-card', rest: true },
      { preview: 'btn-preview-inventory', print: 'btn-print-inventory', what: ' inventory', label: 'Preview inventory sheet', piece: '#print-area-inventory tbody tr:not([aria-hidden])', rest: true },
    ],
    store: s => s.inv ? [['qr-code-generator-inventory', JSON.stringify(inventoryOf(s.inv))]] : [],
    after: async (page, s) => {
      if (s.text) {
        if (s.caption) await page.fill('#caption-text', s.caption);
        await page.fill('#qr-text', s.text);
        await page.waitForFunction(() => !document.getElementById('btn-print').disabled, null, { timeout: 15000 });
      } else if (s.lines) {
        await page.click('label[for="mode-bulk"]');
        await page.selectOption('#bulk-sheet', s.sheet || 'custom');
        if (s.cols) await page.selectOption('#bulk-cols', String(s.cols));
        if (s.cut) await page.check('#bulk-cutlines');
        await page.fill('#bulk-text', codeLines(s.lines));
        await page.click('#btn-bulk-generate');
        await page.waitForFunction(() => /generated/.test(document.getElementById('bulk-status').textContent), null, { timeout: 60000 });
      } else await page.click('label[for="mode-scan"]');
    },
    // the body class a print button adds, which must be gone again
    rest: () => document.body.className.split(/\s+/).filter(c => /^print-/.test(c)).join(','),
    off: { off: true, buttons: ['btn-preview', 'btn-bulk-preview', 'btn-preview-inventory'] },
    states: [
      { name: 'a short link', text: 'https://example.com/a', pages: 1, only: 'btn-preview' },
      { name: 'a link with a caption under it', text: 'https://example.com/a', caption: 'Room 12 sign-in', pages: 1, only: 'btn-preview' },
      { name: 'a plain grid, 2 across, 13 codes', lines: 13, cols: 2, only: 'btn-bulk-preview' },
      { name: 'a plain grid, 3 across with cut lines, 40 codes', lines: 40, cols: 3, cut: true, only: 'btn-bulk-preview' },
      { name: 'a plain grid, 4 across, 3 codes', lines: 3, cols: 4, pages: 1, only: 'btn-bulk-preview' },
      { name: 'Avery 5160, 30 labels', lines: 30, sheet: 'avery5160', pages: 1, only: 'btn-bulk-preview' },
      { name: 'Avery 5160, 65 labels', lines: 65, sheet: 'avery5160', pages: 3, only: 'btn-bulk-preview' },
      { name: 'Avery 5163, 11 labels', lines: 11, sheet: 'avery5163', pages: 2, only: 'btn-bulk-preview' },
      { name: 'an inventory of 6', inv: 6, pages: 1, only: 'btn-preview-inventory' },
      { name: 'an inventory of 70', inv: 70, only: 'btn-preview-inventory' },
    ].map(s => ({ ...s, paper: LETTER })),
  },
].filter(t => !only || t.n === only);

async function open(browser, tool, s, theme, view) {
  const page = await prepPage(browser, BASE, view || tool.view || { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([pairs, dark]) => {
    pairs.forEach(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); });
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [tool.store(s), theme === 'dark']);
  await page.goto(`${BASE}/Tools/${tool.file}`, { waitUntil: 'load' });
  await settle(page, 300);
  if (tool.after && !s.off) { await tool.after(page, s); await settle(page, 100); }
  return page;
}

const READY = 'dialog.pk-preview[data-pk-pages]';
async function openPreview(page, b = ONE[0]) {
  if (b.tab) await page.click(b.tab);
  await page.click('#' + b.preview);
  await page.waitForSelector(READY, { timeout: 30000 });
  await settle(page, 100);
}
const isOff = (page, id) => page.evaluate(i => document.getElementById(i).disabled, id);
const statesFor = (tool, b) => tool.states.filter(s => !s.only || s.only === b.preview);

/** What the open preview shows, beside the live sheet it was copied from. */
const readPreview = (page, piece) => page.evaluate(piece => {
  const dialog = document.querySelector('dialog.pk-preview');
  const frame = dialog.querySelector('iframe');
  const d = frame.contentDocument;
  const body = d.body;
  const keep = body.style.transform;
  body.style.transform = 'none';
  const pitch = body.getBoundingClientRect().width + 400;
  const pageOf = el => { const rs = el.getClientRects(); return rs.length ? Math.floor((rs[0].left + 0.5) / pitch) : -1; };
  const live = document.getElementById('printArea');
  const pieces = [...d.querySelectorAll(piece)].map(pageOf);
  const shots = c => { try { return c.width + 'x' + c.height + ':' + c.toDataURL().length + ':' + c.toDataURL().slice(-64); } catch (e) { return 'tainted'; } };
  const out = {
    pages: Number(dialog.getAttribute('data-pk-pages')),
    status: dialog.querySelector('.pk-preview-status').textContent,
    pieces, livePieces: live.querySelectorAll(piece).length,
    last: Math.max(-1, ...[...d.querySelectorAll('[data-pk-preview-root] *')].map(pageOf)),
    text: d.querySelector('[data-pk-preview-root]').textContent.replace(/\s+/g, ' ').length,
    // a header row repeated at the top of a later page is the preview's own
    extra: [...d.querySelectorAll('[data-pk-preview-root] tbody > tr[aria-hidden="true"]')].reduce((n, e) => n + e.textContent.replace(/\s+/g, ' ').length, 0),
    liveText: live.textContent.replace(/\s+/g, ' ').length,
    canvases: [...d.querySelectorAll('canvas')].map(shots),
    liveCanvases: [...live.querySelectorAll('canvas')].map(shots),
    paper: [dialog.querySelector('.pk-preview-sheet').style.width, dialog.querySelector('.pk-preview-sheet').style.height],
    printLabel: dialog.querySelector('.pk-preview-print') ? dialog.querySelector('.pk-preview-print').textContent : null,
    focusIn: dialog.contains(document.activeElement),
  };
  body.style.transform = keep;
  return out;
}, piece);

// `area` and `body` leave out which of several areas is showing: that is `rest`,
// read by the tool's own function and compared on its own.
const snapshot = (page, tool) => page.evaluate(rest => ({
  rest: rest ? (0, eval)('(' + rest + ')')() : '',
  area: document.getElementById('printArea').outerHTML.replace(/ ?\b(active|sheet-asked)\b/g, '').replace(/ class=""/g, ''),
  sheets: [...document.styleSheets].map(s => (s.ownerNode.tagName + ':' + (s.href || s.ownerNode.textContent.length) + ':' + s.media.mediaText + ':' + s.cssRules.length)).join('|'),
  html: [...document.documentElement.attributes].map(a => a.name + '=' + a.value).join('|'),
  body: document.body.className.replace(/ ?\bprint-(bulk|inventory)\b/g, '') + '|' + (document.body.getAttribute('style') || ''),
  kids: document.body.children.length,
  dialogs: document.querySelectorAll('dialog.pk-preview, iframe.pk-preview-frame').length,
}), tool && tool.rest ? String(tool.rest) : null);

console.log('the print preview on 076, 077, 051, 042, 064, 043, 070, 023, 040, 018, 017 and 016 (PrintKit.preview)');

const server = await serve(PORT);
const browser = await launch();

for (const tool of TOOLS) {
  const T = tool.n;
  // ---- the page itself -------------------------------------------------------
  const src = fs.readFileSync(path.join(SITE, 'Tools', tool.file), 'utf8');
  const buttons = tool.buttons || ONE;
  for (const b of buttons) {
    const tag = (src.match(new RegExp(`<button type="button" class="(?:btn-)?secondary[^"]*" id="${b.preview}"[^>]*>([^<]+)</button>\\s*<button [^>]*id="${b.print}"`)) || [])[1];
    eq(tag, b.label || 'Preview pages', `${T}: a "${b.label || 'Preview pages'}" button, a real <button>, right before its print button`);
  }
  if (tool.wiring) {
    tool.wiring.forEach((re, i) => ok(re.test(src), `${T}: the preview is wired as the page's comment says (${i + 1} of ${tool.wiring.length})`));
  } else if (tool.several) {
    eq((src.match(/wirePreview\(els\.preview\w+, /g) || []).length, buttons.length, `${T}: each Preview button is wired to its own sheet`);
    ok(/PrintKit\.preview\(\{ trigger: previewBtn, onPrint: function \(\) \{ printBtn\.click\(\); \} \}\)/.test(src), `${T}: and its Print presses the Print button it stands beside`);
  } else {
    ok(/PrintKit\.preview\(\{ trigger: els\.previewBtn, onPrint: printSheet \}\)/.test(src), `${T}: it calls PrintKit.preview(), handing over the button and the tool's own print`);
  }
  eq((src.match(/PrintKit\.preview\(/g) || []).length, tool.calls || 1, `${T}: PrintKit.preview() is called from ${tool.calls === 2 ? 'two places' : 'one place'}`);
  ok(!/@media\s+print/.test(src), `${T}: and the page still has no print block of its own`);

  // ---- the count is the PDF's, in every state --------------------------------
  for (const theme of ['light', 'dark']) {
    for (const s0 of tool.states) for (const [bi, b] of buttons.entries()) {
      if (s0.only && s0.only !== b.preview) continue;
      const s = { ...s0, pages: Array.isArray(s0.pages) ? s0.pages[bi] : s0.pages };
      const what = `${T} ${theme}, ${s.name}${b.what}`;
      const page = await open(browser, tool, s, theme);
      try {
        if (b.tab) await page.click(b.tab);
        if (await isOff(page, b.preview)) {
          // a sheet this state cannot print (017's routes with one station): both buttons are off
          ok(s.pages === 0 && await isOff(page, b.print), `${what}: Preview is off because Print is`);
          continue;
        }
        if (s.label) eq(await page.textContent('#' + b.preview), s.label, `${what}: the button is named for what Print would print`);
        const before = await snapshot(page, tool);
        await openPreview(page, b);
        const p = await readPreview(page, b.piece || tool.piece);
        eq(await page.evaluate(() => window.__printCalls), 0, `${what}: the preview did not call print()`);
        if (s.pages) eq(p.pages, s.pages, `${what}: the preview is ${s.pages} page${s.pages === 1 ? '' : 's'}`);
        eq(p.status, `Page 1 of ${p.pages}`, `${what}: and says so`);
        ok(p.livePieces > 0 && p.pieces.length === p.livePieces, `${what}: every piece of the sheet is in it (${p.pieces.length} of ${p.livePieces})`);
        ok(p.pieces.every(n => n >= 0 && n < p.pages), `${what}: each on a page of the count`);
        ok(p.pieces.every((n, i) => i === 0 || n >= p.pieces[i - 1]), `${what}: in order`);
        eq(p.last, p.pages - 1, `${what}: the last page of the count is the last page with anything on it`);
        eq(p.text - p.extra, p.liveText, `${what}: the text is the sheet's text`);
        eq(p.canvases, p.liveCanvases, `${what}: ${p.liveCanvases.length ? 'each canvas shows the live one\'s pixels' : 'no canvas, as on the sheet'}`);
        if (tool.canvases) ok(p.liveCanvases.length > 0 && new Set(p.canvases).size > 1 || p.liveCanvases.length === 1, `${what}: and they are drawn, not blank copies`);
        eq(p.paper, s.paper || tool.paper, `${what}: on the paper setPage() wrote`);
        eq(p.printLabel, 'Print…', `${what}: the preview has its own Print`);
        ok(p.focusIn, `${what}: the focus is inside the dialog`);
        const open1 = await snapshot(page, tool);

        await page.keyboard.press('Escape');
        await settle(page, 100);
        const shut = await snapshot(page, tool);
        eq([shut.dialogs, await page.evaluate(() => document.activeElement.id)], [0, b.preview], `${what}: Escape closes it and the focus is back on the button`);
        if (b.rest) eq(shut.rest, before.rest, `${what}: and what Ctrl+P prints is what it was before the preview`);
        // 023's reteach list borrows #printArea and hands it back, so its sheet is not "as it was while open"
        const same = x => ({ ...x, dialogs: 0, kids: 0, rest: '', area: T === '023' && b.rest ? '' : x.area });
        eq(same(shut), same(open1), `${what}: the sheet, the style sheets and <html> are as they were while it was open`);
        // The paper: open it again and press the preview's own Print, which is
        // how the sheet that was looked at is printed. print() is stubbed, so
        // the page is left as a print dialog would find it; the PDF is that print.
        await openPreview(page, b);
        const again = Number(await page.getAttribute('dialog.pk-preview', 'data-pk-pages'));
        await page.click('.pk-preview-print');
        await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
        await settle(page, 100);
        eq([again, await page.evaluate(() => window.__printCalls), (await snapshot(page, tool)).dialogs], [p.pages, 1, 0], `${what}: opened again it has the same count, and its Print closes it and prints once`);
        await page.emulateMedia({ media: null });
        const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
        eq(p.pages, pdf, `${what}: the preview's count is Chromium's PDF page count`);
      } finally { await page.context().close(); }
    }
  }

  // ---- its Print, axe, a phone -------------------------------------------------
  for (const [bi, b] of buttons.entries()) {
    const mine = statesFor(tool, b);
    const s0 = mine[Math.min(3, mine.length - 1)];
    const s = { ...s0, pages: Array.isArray(s0.pages) ? s0.pages[bi] : s0.pages };
    const page = await open(browser, tool, s, 'light');
    try {
      // What the page has without the preview is the a11y sweep's to hold
      // (023's reteach tab, seeded, has a contrast finding of its own).
      if (b.tab) await page.click(b.tab);
      const had = (await a11yScan(page, { impact: 'serious' })).map(v => v.id);
      await openPreview(page, b);
      const violations = await a11yScan(page, { impact: 'serious' });
      eq(violations.map(v => v.id).filter(id => !had.includes(id)), [], `${T}${b.what}: axe finds nothing serious that the preview brought`);
      await page.click('.pk-preview-print');
      await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
      await settle(page, 150);
      eq([(await snapshot(page)).dialogs, await page.evaluate(() => window.__printCalls)], [0, 1], `${T}${b.what}: the preview's Print closes it and prints, once`);
      // Close, the third way out (Escape and Print are above)
      if (b.rest) {
        await openPreview(page, b);
        await page.click('.pk-preview-close');
        await settle(page, 100);
        const rest = await page.evaluate(r => (0, eval)('(' + r + ')')(), String(tool.rest));
        const fresh = await open(browser, tool, s, 'light');
        try {
          if (b.tab) await fresh.click(b.tab);
          eq(rest, await fresh.evaluate(r => (0, eval)('(' + r + ')')(), String(tool.rest)), `${T}${b.what}: Close leaves Ctrl+P what it is on a page where nothing was pressed`);
        } finally { await fresh.context().close(); }
      }
    } finally { await page.context().close(); }

    const phone = await open(browser, tool, s, 'light', { width: 375, height: 667 });
    try {
      const wasWide = await phone.evaluate(() => document.documentElement.scrollWidth);
      if (b.tab) await phone.click(b.tab);
      await phone.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), b.preview);
      const box = await phone.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { left: r.left, right: r.right, w: r.width }; }, b.preview);
      ok(box.w > 0 && box.left >= 0 && box.right <= Math.max(375, wasWide), `${T}${b.what} phone: the button is on the page (${Math.round(box.left)} to ${Math.round(box.right)})`);
      await openPreview(phone, b);
      const m = await phone.evaluate(wasWide => {
        const dialog = document.querySelector('dialog.pk-preview');
        const r = dialog.getBoundingClientRect();
        return {
          inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          buttons: [...dialog.querySelectorAll('button')].every(x => { const q = x.getBoundingClientRect(); return q.left >= r.left && q.right <= r.right && q.width > 0; }),
          pages: Number(dialog.getAttribute('data-pk-pages')),
          sideways: document.documentElement.scrollWidth <= wasWide,
        };
      }, wasWide);
      ok(m.inView && m.buttons, `${T} phone: the dialog and its buttons are inside a 375 x 667 window`);
      if (s.pages) eq(m.pages, s.pages, `${T} phone: the count does not depend on the window`);
      ok(m.sideways, `${T} phone: the preview makes the page no wider than it was`);
    } finally { await phone.context().close(); }
  }

  // ---- a Preview button is off whenever its Print button is ----------------------
  if (tool.off) {
    const page = await open(browser, tool, tool.off, 'light');
    try {
      for (const id of tool.off.buttons) {
        const b = buttons.find(x => x.preview === id);
        if (b.tab) await page.click(b.tab);
        eq([await isOff(page, b.preview), await isOff(page, b.print)], [true, true], `${T}${b.what}: with nothing to print, Preview is off as Print is`);
      }
      eq(await page.locator('dialog.pk-preview').count(), 0, `${T}: and no preview is open`);
    } finally { await page.context().close(); }
  }

  // ---- nothing to preview ------------------------------------------------------
  if (tool.empty) {
    const page = await open(browser, tool, tool.empty, 'light');
    try {
      let said = '';
      if (tool.empty.prep) await tool.empty.prep(page);
      page.on('dialog', async dlg => { said = dlg.message(); await dlg.accept(); });
      await page.click('#previewBtn');
      await settle(page, 300);
      eq(said, tool.empty.says, `${T}: with nothing to print the button says so, as Print does`);
      eq([await page.locator('dialog.pk-preview').count(), await page.evaluate(() => window.__printCalls)], [0, 0], `${T}: and opens no preview and prints nothing`);
    } finally { await page.context().close(); }
  }
}

await browser.close();
await new Promise(r => server.close(r));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — ${passed} green`);
