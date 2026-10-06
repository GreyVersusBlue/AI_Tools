// smoke-preview-adopters.mjs — the kit's print preview on the pages that
// adopted it after 074 (Path 7 P5): 076, 077, 051, 042 and 064, each a page
// with one print button, and 043, the first with several (four sheets, four
// Print buttons, a Preview button in front of each).
//
//   node Tools/print-kit/test/smoke-preview-adopters.mjs [--only 051]
//
// 074's own suite (Tools/science-safety-label-maker/test/smoke-preview.mjs)
// pins the dialog itself: its keys, its names, its focus, what it leaves
// behind. This one pins what an adopter can get wrong, for every state that
// tool's smoke-print.mjs prints, light and dark:
//   - "Preview pages" is a real button before the print button, opens the
//     dialog and never calls print()
//   - the preview's page count is Chromium's PDF page count for the same state
//   - every card, slip or certificate of the sheet is in the preview, none on
//     a page past the count, and a canvas (051's QR codes, 042's) shows the
//     pixels of the live one
//   - the paper is the one PrintKit.setPage() wrote for that tool
//   - closing it leaves #printArea, the style sheets and <html> as they were
//   - its Print button closes it and prints once, through the tool's own print
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
].filter(t => !only || t.n === only);

async function open(browser, tool, s, theme, view = { width: 1100, height: 900 }) {
  const page = await prepPage(browser, BASE, view);
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([pairs, dark]) => {
    pairs.forEach(([k, v]) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); });
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [tool.store(s), theme === 'dark']);
  await page.goto(`${BASE}/Tools/${tool.file}`, { waitUntil: 'load' });
  await settle(page, 300);
  if (tool.after) { await tool.after(page, s); await settle(page, 100); }
  return page;
}

const READY = 'dialog.pk-preview[data-pk-pages]';
async function openPreview(page, id = 'previewBtn') {
  await page.click('#' + id);
  await page.waitForSelector(READY, { timeout: 30000 });
  await settle(page, 100);
}

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

const snapshot = page => page.evaluate(() => ({
  area: document.getElementById('printArea').outerHTML,
  sheets: [...document.styleSheets].map(s => (s.ownerNode.tagName + ':' + (s.href || s.ownerNode.textContent.length) + ':' + s.media.mediaText + ':' + s.cssRules.length)).join('|'),
  html: [...document.documentElement.attributes].map(a => a.name + '=' + a.value).join('|'),
  body: document.body.className + '|' + (document.body.getAttribute('style') || ''),
  kids: document.body.children.length,
  dialogs: document.querySelectorAll('dialog.pk-preview, iframe.pk-preview-frame').length,
}));

console.log('the print preview on 076, 077, 051, 042, 064 and 043 (PrintKit.preview)');

const server = await serve(PORT);
const browser = await launch();

for (const tool of TOOLS) {
  const T = tool.n;
  // ---- the page itself -------------------------------------------------------
  const src = fs.readFileSync(path.join(SITE, 'Tools', tool.file), 'utf8');
  const buttons = tool.buttons || ONE;
  for (const b of buttons) {
    const tag = (src.match(new RegExp(`<button type="button" class="secondary[^"]*" id="${b.preview}">([^<]+)</button>\\s*<button [^>]*id="${b.print}"`)) || [])[1];
    eq(tag, b.label || 'Preview pages', `${T}: a "${b.label || 'Preview pages'}" button, a real <button>, right before its print button`);
  }
  if (tool.several) {
    eq((src.match(/wirePreview\(els\.preview\w+, /g) || []).length, buttons.length, `${T}: each Preview button is wired to its own sheet`);
    ok(/PrintKit\.preview\(\{ trigger: previewBtn, onPrint: function \(\) \{ printBtn\.click\(\); \} \}\)/.test(src), `${T}: and its Print presses the Print button it stands beside`);
  } else {
    ok(/PrintKit\.preview\(\{ trigger: els\.previewBtn, onPrint: printSheet \}\)/.test(src), `${T}: it calls PrintKit.preview(), handing over the button and the tool's own print`);
  }
  eq((src.match(/PrintKit\.preview\(/g) || []).length, 1, `${T}: PrintKit.preview() is called from one place`);
  ok(!/@media\s+print/.test(src), `${T}: and the page still has no print block of its own`);

  // ---- the count is the PDF's, in every state --------------------------------
  for (const theme of ['light', 'dark']) {
    for (const s0 of tool.states) for (const [bi, b] of buttons.entries()) {
      const s = { ...s0, pages: Array.isArray(s0.pages) ? s0.pages[bi] : s0.pages };
      const what = `${T} ${theme}, ${s.name}${b.what}`;
      const page = await open(browser, tool, s, theme);
      try {
        await openPreview(page, b.preview);
        const p = await readPreview(page, tool.piece);
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
        const open1 = await snapshot(page);

        await page.keyboard.press('Escape');
        await settle(page, 100);
        const shut = await snapshot(page);
        eq([shut.dialogs, await page.evaluate(() => document.activeElement.id)], [0, b.preview], `${what}: Escape closes it and the focus is back on the button`);
        eq({ ...shut, dialogs: 0, kids: 0 }, { ...open1, dialogs: 0, kids: 0 }, `${what}: the sheet, the style sheets and <html> are as they were while it was open`);
        await page.emulateMedia({ media: null });
        const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
        eq(p.pages, pdf, `${what}: the preview's count is Chromium's PDF page count`);
      } finally { await page.context().close(); }
    }
  }

  // ---- its Print, axe, a phone -------------------------------------------------
  for (const [bi, b] of buttons.entries()) {
    const s0 = tool.states[Math.min(3, tool.states.length - 1)];
    const s = { ...s0, pages: Array.isArray(s0.pages) ? s0.pages[bi] : s0.pages };
    const page = await open(browser, tool, s, 'light');
    try {
      await openPreview(page, b.preview);
      const violations = await a11yScan(page, { impact: 'serious' });
      eq(violations.map(v => v.id), [], `${T}${b.what}: axe finds nothing serious with the preview open`);
      await page.click('.pk-preview-print');
      await page.waitForFunction(() => window.__printCalls > 0, null, { timeout: 15000 }).catch(() => {});
      await settle(page, 150);
      eq([(await snapshot(page)).dialogs, await page.evaluate(() => window.__printCalls)], [0, 1], `${T}${b.what}: the preview's Print closes it and prints, once`);
    } finally { await page.context().close(); }

    const phone = await open(browser, tool, s, 'light', { width: 375, height: 667 });
    try {
      const wasWide = await phone.evaluate(() => document.documentElement.scrollWidth);
      await phone.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), b.preview);
      const box = await phone.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { left: r.left, right: r.right, w: r.width }; }, b.preview);
      ok(box.w > 0 && box.left >= 0 && box.right <= Math.max(375, wasWide), `${T}${b.what} phone: the button is on the page (${Math.round(box.left)} to ${Math.round(box.right)})`);
      await openPreview(phone, b.preview);
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

  // ---- nothing to preview ------------------------------------------------------
  if (tool.empty) {
    const page = await open(browser, tool, tool.empty, 'light');
    try {
      let said = '';
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
