// smoke-print.mjs — 040 prints through the shared print kit (Path 7 P3).
//
//   node Tools/vocab-flashcard-generator/test/smoke-print.mjs
//
// 040 is the kit's ninth adopter and the fourth card grid. It has two print
// buttons, Print and "Print alignment test page", and Print has seven faces:
// double-sided flashcards, fold-over flashcards, word-wall cards, and four
// puzzle pages. Every card goes through `PrintKit.renderCards()` with a grid
// of the page's own (`{ cols, perPage }`, `pk-cards-own`), because none of its
// cards is a share of the kit's printable page:
//   - an index-card preset (3x5, 4x6) is exact inches;
//   - a word-wall card is a share of a 9.5 in grid inside the page's 0.4 in
//     inset, and there is one, two or four to a page (the kit has no 1x1 or
//     1x2 preset, and its 2x2 is a share of a different height);
//   - a grid card (and a fold-over card) is as tall as its words.
// The kit gives the grid, the columns, the cut into pages and `.pk-page`; the
// page keeps its `.page` (the inset and the margin guide) around each grid,
// its 0.15 in gap, its equal rows and the three sizes. The preview is drawn
// by the same function, so what is on screen is what prints. The four puzzle
// pages are whole pages, not cards: each is a `.pk-page`. The page has no
// print rule of its own; the paper is Letter at the 0.2 in it always had.
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - per state, light and dark: the pages, the grid on each, every card's
//     width and height (the old page's, measured from `git show origin/main:`
//     before it was replaced, on the same 0.2 in margins), and Chromium's PDF
//     page count, which is the old page's too
//   - fronts first and then backs, each back row mirrored; a short last page
//     is padded with blank cards
//   - a long word wraps instead of being cut off, and does not make one
//     word-wall column wider than the other; a 3x5 index-card page is one
//     sheet of paper (the three places the sheet is better than the old one)
//   - the preview shows the first printed page
//   - what the teacher typed reaches the card as text
//   - only the sheet has a box on paper, the paper is white, the text black
//   - the alignment test is two numbered pages, the second mirrored
//   - Ctrl+P prints the current sheet, and does not replace the alignment test
//   - an empty list is refused, not printed as a blank sheet
//
// One place the PDF is NOT the old page's, on purpose: the 3x5 index-card
// preset. Two 5 in rows, the gap and the 0.4 in inset are 10.95 in on a
// 10.6 in page, so the old page ran every page on to a second, blank sheet
// (3 words: 4 sheets for 2 pages; 40 words: 40 for 20) and split the
// alignment test's second row off. The printed page trims the inset there
// (`tight`) and each page is one sheet. `OLD_PDF` keeps the old counts.
//
// print() is stubbed. Nothing here has been checked against a printer, and no
// index-card stock has been tried.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8475;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '040-vocab-flashcard-generator.html';
const IN = 96;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

// Made-up vocabulary. One entry has a word too long for a narrow card and a
// definition long enough to shrink its type.
const LONGDEF = 'the process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water, generally involving the green pigment and generating oxygen as a byproduct';
const LONGWORD = 'Extraordinarilylongmadeupword';
function wordsOf(n, long) {
  const w = [];
  for (let i = 1; i <= n; i++) w.push(`term ${i} [turm ${i}] (noun): the made-up meaning of word number ${i} | An example sentence for word ${i}.`);
  if (long) w.splice(1, 0, `${LONGWORD}: ${LONGDEF} | ${LONGDEF}`);
  return w.join('\n');
}
const PUZZLE = 'Photosynthesis Mitosis Osmosis Ecosystem Enzyme Chlorophyll Nucleus Habitat Organism Membrane Protein Molecule Predator Climate Erosion Glacier Mineral Fossil Magma Sediment Orbit Gravity Comet Planet'
  .split(' ').map((t, i) => `${t}: the made-up meaning number ${i + 1} of this word`);

const DEFAULTS = {
  name: 'Made-up list', mode: 'flashcards', flashCols: 2, flashRows: 4, cardSizePreset: 'grid', flashLayout: 'duplex',
  wallPerPage: 2, wallShowDef: true, sortOrder: 'none', shuffle: false, showGuides: true, bingoCount: 4, bingoField: 'term',
};

// The page is opened at the printable width, 8.5 in less two 0.2 in margins
// (777.6 px; the viewport is whole pixels, 778), so a card measured in print
// media is the size it is on paper. Inside the .page's 0.4 in inset that
// leaves 701.2 px for the grid, and its gap is 0.15 in.
const VIEW_W = 778, INNER = VIEW_W - 2 * 0.4 * IN, GAP = 0.15 * IN;
const share = cols => (INNER - (cols - 1) * GAP) / cols;
const WALL_H = 9.5 * IN;

// kind: which button and which face. `w`/`h` is a card's size in px (h null:
// as tall as its words). `pages` is the .page count and `pdf` Chromium's page
// count: both are what the old page gave for the same state (2026-10-04,
// before the adoption), light and dark.
const KINDS = {
  'flash 2x4':   { st: {}, cols: 2, per: 8, sides: 2, w: share(2), h: null, card: '.flash-card' },
  'flash 3x5 grid': { st: { flashCols: 3, flashRows: 5 }, cols: 3, per: 15, sides: 2, w: share(3), h: null, card: '.flash-card' },
  'flash 3x5 index card': { st: { cardSizePreset: '3x5' }, cols: 2, per: 4, sides: 2, w: 3 * IN, h: 5 * IN, exact: true, card: '.flash-card' },
  'flash 4x6 index card, no guides': { st: { cardSizePreset: '4x6', showGuides: false }, cols: 2, per: 2, sides: 2, w: 4 * IN, h: 6 * IN, exact: true, card: '.flash-card' },
  'fold 2x4':    { st: { flashLayout: 'fold' }, cols: 2, per: 8, sides: 1, w: share(2), h: null, card: '.fold-card' },
  'fold, 3x5 chosen': { st: { flashLayout: 'fold', cardSizePreset: '3x5' }, cols: 2, per: 4, sides: 1, w: share(2), h: null, card: '.fold-card' },
  'wall 1':      { st: { mode: 'wordwall', wallPerPage: 1 }, cols: 1, per: 1, sides: 1, w: INNER, h: WALL_H, wall: true, card: '.wordwall-card' },
  'wall 2':      { st: { mode: 'wordwall', wallPerPage: 2 }, cols: 1, per: 2, sides: 1, w: INNER, h: (WALL_H - GAP) / 2, wall: true, card: '.wordwall-card' },
  'wall 4':      { st: { mode: 'wordwall', wallPerPage: 4 }, cols: 2, per: 4, sides: 1, w: share(2), h: (WALL_H - GAP) / 2, wall: true, card: '.wordwall-card' },
  'wall 4, no definitions': { st: { mode: 'wordwall', wallPerPage: 4, wallShowDef: false }, cols: 2, per: 4, sides: 1, w: share(2), h: (WALL_H - GAP) / 2, wall: true, card: '.wordwall-card' },
  'alignment 2x4': { st: {}, btn: '#alignTestBtn', cols: 2, per: 8, align: true, w: share(2), h: null, card: '.flash-card' },
  'alignment 3x5 index card': { st: { cardSizePreset: '3x5' }, btn: '#alignTestBtn', cols: 2, per: 4, align: true, w: 3 * IN, h: 5 * IN, exact: true, card: '.flash-card' },
};
// list -> per kind, Chromium's PDF page count
const PDF = {
  '3':  { 'flash 2x4': 2, 'flash 3x5 grid': 2, 'flash 3x5 index card': 2, 'flash 4x6 index card, no guides': 4, 'fold 2x4': 1, 'fold, 3x5 chosen': 1, 'wall 1': 3, 'wall 2': 2, 'wall 4': 1, 'wall 4, no definitions': 1, 'alignment 2x4': 2, 'alignment 3x5 index card': 2 },
  '9+': { 'flash 2x4': 4, 'flash 3x5 grid': 2, 'flash 3x5 index card': 6, 'flash 4x6 index card, no guides': 10, 'fold 2x4': 2, 'fold, 3x5 chosen': 3, 'wall 1': 10, 'wall 2': 5, 'wall 4': 3, 'wall 4, no definitions': 3, 'alignment 2x4': 2, 'alignment 3x5 index card': 2 },
  '40': { 'flash 2x4': 10, 'flash 3x5 grid': 6, 'flash 3x5 index card': 20, 'flash 4x6 index card, no guides': 40, 'fold 2x4': 5, 'fold, 3x5 chosen': 10, 'wall 1': 40, 'wall 2': 20, 'wall 4': 10, 'wall 4, no definitions': 10, 'alignment 2x4': 2, 'alignment 3x5 index card': 2 },
};
// What the old page printed where this one differs (see the header).
const OLD_PDF = { '3': { 'flash 3x5 index card': 4, 'alignment 3x5 index card': 4 }, '9+': { 'flash 3x5 index card': 12, 'alignment 3x5 index card': 4 }, '40': { 'flash 3x5 index card': 40, 'alignment 3x5 index card': 4 } };
const LISTS = [{ key: '3', n: 3 }, { key: '9+', n: 9, long: true }, { key: '40', n: 40 }];

async function open(browser, st, theme) {
  const page = await prepPage(browser, BASE, { width: VIEW_W, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([saved, dark]) => {
    if (saved && !localStorage.getItem('gvb-vocab-flashcards:list')) {
      localStorage.setItem('gvb-vocab-flashcards:list', JSON.stringify([saved.name]));
      localStorage.setItem('gvb-vocab-flashcards:data:' + saved.name, JSON.stringify(saved));
      localStorage.setItem('gvb-vocab-flashcards:current', saved.name);
    }
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [st, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 250);
  return page;
}

/** What the sheet is made of and how big it is, read in print media. */
const built = (page, cardSel) => page.evaluate((sel) => {
  const r = n => Math.round(n * 10) / 10;
  const area = document.getElementById('printArea');
  const pages = [...area.children];
  const cards = [...area.querySelectorAll(sel)];
  const rect = e => e.getBoundingClientRect();
  return {
    area: area.className,
    pages: pages.length,
    pageCls: pages.every(p => p.matches('.page.paper-sheet.pk-page')),
    guides: pages.filter(p => p.classList.contains('guides')).length,
    tight: pages.filter(p => p.classList.contains('tight')).length,
    grids: pages.map(p => { const g = p.querySelectorAll(':scope > .pk-cards.pk-cards-own'); return g.length === 1 ? g[0].style.getPropertyValue('--pk-cols') + ':' + g[0].children.length + ':' + (g[0].classList.contains('exact-size') ? 'x' : '') + (g[0].classList.contains('wall-grid') ? 'w' : '') : 'none'; }),
    labels: pages.map(p => (p.querySelector(':scope > .align-label') || {}).textContent || ''),
    stray: cards.length - area.querySelectorAll('.page > .pk-cards > .pk-card').length,
    w: cards.map(c => r(rect(c).width)),
    h: cards.map(c => r(rect(c).height)),
    rowsEqual: pages.every(p => { const hs = [...p.querySelectorAll('.pk-card')].map(c => r(rect(c).height)); return hs.every(x => Math.abs(x - hs[0]) <= 0.2); }),
    text: cards.map(c => c.textContent),
    blank: cards.map(c => c.classList.contains('blank') || c.children.length === 0),
    clipped: cards.filter(c => c.scrollWidth > c.clientWidth + 1).length,
    markup: area.querySelectorAll('b, i, script, img').length,
    ink: pages[0] ? getComputedStyle(pages[0]).color : '',
    paper: pages[0] ? getComputedStyle(pages[0]).backgroundColor : '',
    ground: getComputedStyle(area).backgroundColor,
    onPaper: [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.localName).join(','),
    shadow: pages[0] ? getComputedStyle(pages[0]).boxShadow : '',
  };
}, cardSel);

console.log('040 — the vocabulary cards print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(code), 'has no @media print block of its own');
ok(!/@page/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(/PrintKit\.setPage\(\{ paper: 'letter', orientation: 'portrait', margin: '0\.2in' \}\)/.test(code), 'the paper is Letter, portrait, at the 0.2 in the page always printed with');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
eq((code.match(/PrintKit\.renderCards\(/g) || []).length, 1, 'one call to PrintKit.renderCards() draws every card, preview and print');
ok(!/\.grid\s*\{|page-break|\.(flash|fold|wordwall)-card[^{}]*\{[^}]*break-inside/.test(code), 'the grid, the page breaks and a card\'s break-inside are the kit\'s, not the page\'s');
ok(!/#printArea\s*\{[^}]*display/.test(code), 'and it does not hide or show #printArea itself');
ok(!/(flashCard|defCard|foldCard|wallCard|alignTestCard)Html/.test(code), 'no card is built from a string');
ok(/<div id="printArea" class="pk-paper"><\/div>\s*\n\s*<script>/.test(src) && /<\/div>\s*\n\s*<div id="printArea"/.test(src), '#printArea is a .pk-paper, written as a child of <body>');

const server = await serve(PORT);
const browser = await launch();

// ---- every card state, light and dark -----------------------------------------
for (const theme of ['light', 'dark']) {
  for (const list of LISTS) {
    for (const [kind, K] of Object.entries(KINDS)) {
      const what = `${theme}, ${kind}, ${list.n}${list.long ? ' and a long one' : ''}`;
      const page = await open(browser, { ...DEFAULTS, ...K.st, words: wordsOf(list.n, list.long) }, theme);
      try {
        const total = list.n + (list.long ? 1 : 0);
        const sheets = K.align ? 2 : Math.ceil(total / K.per) * K.sides;
        const preview = await page.evaluate((sel) => [...document.querySelectorAll('#previewArea ' + sel)].map(c => c.textContent), K.card);
        await page.click(K.btn || '#printBtn');
        eq(await page.evaluate(() => window.__printCalls), 1, `${what}: the button prints once`);
        await page.emulateMedia({ media: 'print' });
        const b = await built(page, K.card);

        eq(b.area, 'pk-paper', `${what}: #printArea is the kit's paper`);
        eq(b.pages, sheets, `${what}: ${sheets} page(s)`);
        ok(b.pageCls, `${what}: each a .page.paper-sheet.pk-page`);
        eq(b.guides, K.st.showGuides === false ? 0 : sheets, `${what}: the margin guide follows the setting`);
        eq(b.grids.join(' '), Array(sheets).fill(`${K.cols}:${K.per}:${K.exact ? 'x' : ''}${K.wall ? 'w' : ''}`).join(' '), `${what}: one kit grid of its own to a page, ${K.cols} across, ${K.per} cards, short pages padded`);
        eq(b.stray, 0, `${what}: every card is a .pk-card in a kit grid`);
        const tol = (!K.h && !K.wall) ? 0.2 : 0.6;
        ok(b.w.every(w => Math.abs(w - K.w) <= 0.2), `${what}: every card is ${K.w.toFixed(1)} px wide, as on the old page (${[...new Set(b.w)].join(', ')})`);
        if (K.h) ok(b.h.every(h => Math.abs(h - K.h) <= tol), `${what}: and ${K.h.toFixed(1)} px tall (${[...new Set(b.h)].join(', ')})`);
        else ok(b.rowsEqual, `${what}: and the cards of a page are one height, the tallest's`);
        eq(b.clipped, 0, `${what}: no card cuts its words off at the side`);
        eq(b.ink, 'rgb(0, 0, 0)', `${what}: the ink is black`);
        eq(b.paper, 'rgb(255, 255, 255)', `${what}: the page is white`);
        eq(b.ground, 'rgb(255, 255, 255)', `${what}: on white paper`);
        eq(b.onPaper, 'printArea', `${what}: only the sheet has a box on paper`);
        eq(b.shadow, 'none', `${what}: with no shadow`);

        if (K.align) {
          eq(b.labels.join('|'), 'ALIGNMENT TEST — FRONT (page 1 of 2)|ALIGNMENT TEST — BACK (page 2 of 2, flip along the long edge)', `${what}: the two pages are labelled`);
          const nums = b.text.map(Number);
          eq(nums.slice(0, K.per).join(','), Array.from({ length: K.per }, (_, i) => i + 1).join(','), `${what}: the front is numbered in order`);
          const mirrored = [];
          for (let r = 0; r < K.per / K.cols; r++) for (let c = K.cols - 1; c >= 0; c--) mirrored.push(r * K.cols + c + 1);
          eq(nums.slice(K.per).join(','), mirrored.join(','), `${what}: the back has each row mirrored`);
        } else {
          eq(b.labels.join(''), '', `${what}: no page label`);
          const fronts = b.text.slice(0, b.text.length / K.sides);
          const order = fronts.filter(t => t).map(t => (t.match(/^term (\d+)/) || [0, 'L'])[1]).join(',');
          const want = []; for (let i = 1; i <= list.n; i++) { want.push(String(i)); if (list.long && i === 1) want.push('L'); }
          eq(order, want.join(','), `${what}: the words are in list order`);
          eq(b.blank.slice(0, fronts.length).filter(Boolean).length, fronts.length - total, `${what}: the last page is padded with ${fronts.length - total} blank card(s)`);
          if (K.sides === 2) {
            const backs = b.text.slice(fronts.length);
            let mirror = true;
            for (let i = 0; i < fronts.length; i++) {
              const row = Math.floor(i / K.cols), col = i % K.cols, j = row * K.cols + (K.cols - 1 - col);
              const f = fronts[i], k = backs[j];
              const n = (f.match(/^term (\d+)/) || [])[1];
              if (!f) { if (k) mirror = false; } else if (n) { if (!k.includes(`word number ${n}`) || k.includes('term ')) mirror = false; } else if (!k.includes('green plants')) mirror = false;
            }
            ok(mirror, `${what}: the backs follow the fronts, each row mirrored, definitions only`);
          }
          eq(preview.join('¦'), b.text.slice(0, K.per).join('¦'), `${what}: the preview showed the first printed page`);
        }

        eq(b.tight, kind.includes('3x5 index card') ? sheets : 0, `${what}: only a 3x5 index-card page trims its inset on paper`);
        const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
        const was = (OLD_PDF[list.key] || {})[kind];
        eq(pdfPageCount(buf), PDF[list.key][kind], `${what}: Chromium's PDF is ${PDF[list.key][kind]} page(s), ${was ? `where the old page's was ${was}` : 'as the old page\'s was'}`);
        eq(pdfPageCount(buf), b.pages, `${what}: one sheet of paper to a page`);
        eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      } catch (e) {
        ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
      } finally {
        await page.context().close();
      }
    }
  }
}

// ---- where the sheet is better than the old one ---------------------------------
{
  // The old page let a long word push its column wide: two word-wall columns
  // came out 518 and 168 px. And it cut a long word off at a narrow card's edge.
  const page = await open(browser, { ...DEFAULTS, mode: 'wordwall', wallPerPage: 4, words: wordsOf(3, true) });
  try {
    await page.click('#printBtn');
    await page.emulateMedia({ media: 'print' });
    const b = await built(page, '.wordwall-card');
    eq([...new Set(b.w)].join(','), String(Math.round(share(2) * 10) / 10), 'a long word on a word-wall card wraps, and the two columns stay the same width');
    eq(b.clipped, 0, 'and nothing is cut off');
  } catch (e) { ok(false, `long word, word wall: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
}
{
  const page = await open(browser, { ...DEFAULTS, flashCols: 3, flashRows: 5, words: wordsOf(3, true) });
  try {
    await page.click('#printBtn');
    await page.emulateMedia({ media: 'print' });
    const m = await page.evaluate((word) => {
      const term = [...document.querySelectorAll('#printArea .flash-card .term')].find(t => t.textContent === word);
      const card = term.parentElement, other = document.querySelector('#printArea .flash-card .term');
      return { inside: term.getBoundingClientRect().right <= card.getBoundingClientRect().right + 0.5 && term.scrollWidth <= card.clientWidth, lines: Math.round(term.getBoundingClientRect().height / other.getBoundingClientRect().height) };
    }, LONGWORD);
    ok(m.inside, 'a word too long for a narrow flashcard stays inside the card');
    ok(m.lines >= 2, `on a second line (${m.lines})`);
  } catch (e) { ok(false, `long word, flashcard: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
}

// ---- what is typed is text ---------------------------------------------------------
for (const st of [{}, { flashLayout: 'fold' }, { mode: 'wordwall' }]) {
  const page = await open(browser, { ...DEFAULTS, ...st, words: '<b>bold</b> [<i>pron</i>] (<img src=x onerror=1>): <script>x</script> & "quotes" | <b>ex</b>' });
  try {
    await page.click('#printBtn');
    const m = await page.evaluate(() => {
      const a = document.getElementById('printArea'), p = document.getElementById('previewArea');
      return { markup: a.querySelectorAll('b, i, script, img').length + p.querySelectorAll('b, i, script, img').length, text: a.textContent };
    });
    eq(m.markup, 0, `${st.mode || st.flashLayout || 'flashcards'}: markup typed into the list makes no element, on the sheet or in the preview`);
    ok(m.text.includes('<b>bold</b>') && m.text.includes('& "quotes"'), `${st.mode || st.flashLayout || 'flashcards'}: it is printed as the text it is`);
  } catch (e) { ok(false, `text: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
}

// ---- the four puzzle pages: whole pages, each a .pk-page -------------------------
// `pdf` is the old page's count for the same list.
const PUZZLES = [
  { mode: 'wordsearch', n: 9, pages: 2, pdf: 2 }, { mode: 'wordsearch', n: 24, pages: 2, pdf: 3 },
  { mode: 'crossword', n: 9, pages: 2, pdf: 2 }, { mode: 'crossword', n: 24, pages: 2, pdf: 3 },
  { mode: 'bingo', n: 9, pages: 5, pdf: 5 }, { mode: 'bingo', n: 24, pages: 5, pdf: 5 },
  { mode: 'matching', n: 9, pages: 2, pdf: 2 }, { mode: 'matching', n: 24, pages: 2, pdf: 2 },
];
for (const theme of ['light', 'dark']) {
  for (const P of PUZZLES) {
    const what = `${theme}, ${P.mode}, ${P.n} words`;
    const page = await open(browser, { ...DEFAULTS, mode: P.mode, words: PUZZLE.slice(0, P.n).join('\n') }, theme);
    try {
      await page.click('#printBtn');
      await page.emulateMedia({ media: 'print' });
      const b = await built(page, '.none');
      eq(b.pages, P.pages, `${what}: ${P.pages} pages`);
      ok(b.pageCls, `${what}: each a .page.paper-sheet.pk-page`);
      eq(b.ink, 'rgb(0, 0, 0)', `${what}: the ink is black`);
      eq(b.onPaper, 'printArea', `${what}: only the sheet has a box on paper`);
      eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), P.pdf, `${what}: Chromium's PDF is ${P.pdf} page(s), as the old page's was`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) { ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
  }
}

// ---- Ctrl+P: no button pressed -----------------------------------------------------
{
  const page = await open(browser, { ...DEFAULTS, words: wordsOf(9) });
  try {
    eq(await page.locator('#printArea > *').count(), 0, 'before anything is printed the sheet is empty');
    const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(buf), 4, 'printing with no button pressed prints the flashcards, fronts and backs (it printed one empty page)');
    eq(await page.evaluate(() => window.__printCalls), 0, 'and the page did not call print() itself');
    eq(await page.locator('#printArea .flash-card').count(), 32, 'the sheet it built is the current mode\'s');

    // The alignment test is the other button's sheet: `beforeprint` must not
    // swap it for the flashcards, and the next print after it is the cards again.
    await page.click('#alignTestBtn');
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    eq(await page.locator('#printArea .align-label').count(), 2, 'the alignment test is still the sheet when its own print begins');
    await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); window.dispatchEvent(new Event('beforeprint')); });
    eq(await page.locator('#printArea .align-label').count(), 0, 'and the next Ctrl+P prints the cards again');
    eq(await page.locator('#printArea .flash-card').count(), 32, 'all of them');

    await page.click('.mode-tab[data-mode="wordwall"]');
    await settle(page, 200);
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 5, 'after a change of mode Ctrl+P prints that mode (word wall, two to a page)');
    await page.click('.mode-tab[data-mode="quiz"]');
    await settle(page, 200);
    await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); window.dispatchEvent(new Event('beforeprint')); });
    eq(await page.locator('#printArea > *').count(), 0, 'self-quiz has nothing to print, and Ctrl+P there builds no sheet');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) { ok(false, `Ctrl+P: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
}

// ---- nothing to print ------------------------------------------------------------
for (const mode of ['flashcards', 'wordwall']) {
  const page = await open(browser, { ...DEFAULTS, mode, words: '' });
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(dialogs.length, 1, `${mode}: with no words, Print says so`);
    ok(/list is empty/i.test(dialogs[0] || ''), `${mode}: and names what is missing`);
    eq(await page.evaluate(() => window.__printCalls), 0, `${mode}: and print() is not called`);
    eq(await page.locator('#printArea > *').count(), 0, `${mode}: and no sheet is built`);
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 1, `${mode}: Ctrl+P then is one page, as it was`);
  } catch (e) { ok(false, `nothing to print: ${String(e.message || e).split('\n')[0]}`); } finally { await page.context().close(); }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
