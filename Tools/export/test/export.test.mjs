// export.test.mjs — pure-logic tests for _shared/export.js (Path 7 P4): the
// booklet, N-up and duplex imposition, the sheet geometry, and the flow
// pagination, plus toPdf() run against a jsPDF that only records its calls.
//
//   node Tools/export/test/export.test.mjs      (or: npm run test:export)
//
// export.js is a classic script that publishes window.ExportKit, so it runs
// here in a vm context with no document. The imposition is checked against
// models written here from the paper, not from the code: a booklet is FOLDED
// (sheets nested, leaves turned) and must read 1, 2, 3 in order; a card's back
// is found by turning the sheet over and must be behind its front. Both are
// run for every page count from 0 to 97, which covers each count mod 4 two
// dozen times over. The randomised parts take a seeded generator, as
// name-picker's pure suite does. The browser half is smoke-export.mjs.
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(here, '..', '..', '..');
const load = (file, ctx) => { vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(site, file), 'utf8'), ctx); return ctx; };
const ctx = load('_shared/export.js', { window: {} });
const EK = ctx.window.ExportKit;
const DP = load('_shared/duplex-print.js', { window: {} }).window.DuplexPrint;
const VL = load('Tools/vocab-flashcard-generator/vfg-layout.js', { window: {} }).window.VocabLayout;

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + label); } };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 1e-6) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b})`);
/** Counts one check for a whole sweep, and prints only the first case that broke it. */
function sweep(label, run) {
  let bad = null;
  run((cond, detail) => { if (!cond && bad === null) bad = detail; });
  ok(bad === null, `${label}${bad === null ? '' : ' — first failure: ' + (typeof bad === 'string' ? bad : JSON.stringify(bad))}`);
}
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pagesOf = side => side.map(s => s.page);

console.log('ExportKit — imposition, geometry and pagination');

// ---- units and paper -------------------------------------------------------
near(EK.toPt('1in'), 72, '1in is 72 pt');
near(EK.toPt('25.4mm'), 72, '25.4mm is 72 pt');
near(EK.toPt('2.54 cm'), 72, '2.54 cm is 72 pt');
near(EK.toPt('96px'), 72, '96px is 72 pt');
near(EK.toPt(36), 36, 'a number is points');
near(EK.toPt('.5IN'), 36, 'units are case-blind and a leading dot is a number');
near(EK.toPt('wide', 9), 9, 'what is not a length is the fallback');
near(EK.toPt(undefined), 0, 'nothing is 0');
eq(EK.paper({}), { paper: 'letter', orientation: 'portrait', w: 612, h: 792 }, 'the default paper is letter portrait');
eq(EK.paper({ paper: 'A4', orientation: 'Landscape' }), { paper: 'a4', orientation: 'landscape', w: 841.89, h: 595.28 }, 'A4 landscape');
eq(EK.paper({ paper: 'foolscap' }).paper, 'letter', 'an unknown paper is letter');

// ---- booklet: the cases worked by hand -------------------------------------
const bk = (n, o) => EK.booklet(n, o).sheets.map(s => [pagesOf(s.front), pagesOf(s.back)]);
eq(bk(8), [[[8, 1], [2, 7]], [[6, 3], [4, 5]]], 'eight pages: 8-1 / 2-7, then 6-3 / 4-5');
eq(bk(4), [[[4, 1], [2, 3]]], 'four pages are one sheet');
eq(bk(12), [[[12, 1], [2, 11]], [[10, 3], [4, 9]], [[8, 5], [6, 7]]], 'twelve pages, three nested sheets');
eq(bk(5), [[[null, 1], [2, null]], [[null, 3], [4, 5]]], 'five pages: three blanks, all at the back of the book');
eq(bk(1), [[[null, 1], [null, null]]], 'one page is a sheet with three blanks');
eq(bk(2), [[[null, 1], [2, null]]], 'two pages');
eq(bk(3), [[[null, 1], [2, 3]]], 'three pages');
eq(bk(0), [], 'no pages, no sheets');
eq(bk(-3), [], 'a negative count is no pages');
eq(bk('eight'), [], 'a count that is not a number is no pages');
eq(bk(8, { rtl: true }), [[[1, 8], [7, 2]], [[3, 6], [5, 4]]], 'bound on the right, each side is the other way round');
eq(bk(8, { flip: 'long' }), [[[8, 1], [7, 2]], [[6, 3], [5, 4]]], 'turned on the long edge, the back swaps its halves');
eq(EK.booklet(8, { flip: 'long' }).sheets.map(s => [s.front.map(x => x.rotate), s.back.map(x => x.rotate)]),
   [[[0, 0], [180, 180]], [[0, 0], [180, 180]]], '... and is set upside down; the front never is');
eq(bk(16, { sheetsPerSignature: 2 }),
   [[[8, 1], [2, 7]], [[6, 3], [4, 5]], [[16, 9], [10, 15]], [[14, 11], [12, 13]]], 'sixteen pages in two signatures of two sheets');
eq(bk(10, { sheetsPerSignature: 2 }),
   [[[8, 1], [2, 7]], [[6, 3], [4, 5]], [[null, 9], [10, null]]], 'ten pages: a full signature, then a one-sheet signature holding the blanks');
{
  const b = EK.booklet(10, { sheetsPerSignature: 2 });
  eq([b.pageCount, b.pages, b.blanks, b.signatures, b.sheetsPerSignature, b.flip], [10, 12, 2, 2, 2, 'short'], 'the summary: 10 pages on 12, 2 blank, 2 signatures');
  eq(b.sheets.map(s => [s.signature, s.sheet, s.of]), [[0, 0, 2], [0, 1, 2], [1, 0, 1]], 'each sheet knows its signature and its place in it');
  eq(EK.booklet(8, { sheetsPerSignature: 99 }).signatures, 1, 'a signature larger than the book is the whole book');
  eq(EK.booklet(8, { sheetsPerSignature: 0 }).signatures, 1, 'a signature of 0 sheets is the whole book');
  eq(EK.booklet(0).signatures, 0, 'an empty book has no signatures');
}

// ---- booklet: fold every one and read it -----------------------------------
/* The model. A sheet lies face up: front-left, front-right. Turn it over about
   `axis` to look at the back as it was printed. About a vertical axis, what is
   behind front-right is now at the back's LEFT; about a horizontal one, left
   stays left and everything is upside down. A book opens about a vertical
   fold, so a back page is upright in the book when it was printed upright and
   the sheet turned about a vertical axis, or printed turned 180 and the sheet
   turned about a horizontal one. Nest the sheets of a signature, fold, and
   read the leaves: outer to inner on the near half, inner to outer on the far. */
function foldAndRead(book, rtl) {
  const axis = EK.flipAxis('landscape', book.flip);
  const pages = [], upright = [];
  const bySig = new Map();
  for (const s of book.sheets) { if (!bySig.has(s.signature)) bySig.set(s.signature, []); bySig.get(s.signature).push(s); }
  for (const sheets of bySig.values()) {
    const behind = (s, half) => s.back[axis === 'vertical' ? 1 - half : half];
    const near = rtl ? 0 : 1, far = 1 - near;   // the half of the sheet the first leaves are
    const leaf = [];
    for (let i = 0; i < sheets.length; i++) leaf.push(sheets[i].front[near], behind(sheets[i], near));
    for (let i = sheets.length - 1; i >= 0; i--) leaf.push(behind(sheets[i], far), sheets[i].front[far]);
    for (const x of leaf) pages.push(x.page);
    for (const s of sheets) {
      for (const x of s.front) upright.push(x.rotate === 0);
      for (const x of s.back) upright.push(x.rotate === (axis === 'vertical' ? 0 : 180));
    }
  }
  return { pages, upright: upright.every(Boolean) };
}
const SIGS = [undefined, 1, 2, 3, 4, 5, 7];
for (const flip of ['short', 'long']) {
  for (const rtl of [false, true]) {
    sweep(`a folded booklet reads 1..n in order, upright, blanks last — every count 0..97, 7 signature sizes, flip ${flip}${rtl ? ', bound right' : ''}`, check => {
      for (let n = 0; n <= 97; n++) {
        for (const per of SIGS) {
          const book = EK.booklet(n, { sheetsPerSignature: per, flip, rtl });
          const at = { n, per };
          const sheets = Math.ceil(n / 4);
          check(book.sheets.length === sheets, { ...at, why: 'sheet count', got: book.sheets.length });
          check(book.pages === sheets * 4 && book.blanks === sheets * 4 - n, { ...at, why: 'padding' });
          check(book.sheets.every(s => s.front.length === 2 && s.back.length === 2), { ...at, why: 'two halves a side' });
          const read = foldAndRead(book, rtl);
          const want = Array.from({ length: sheets * 4 }, (_, i) => (i < n ? i + 1 : null));
          check(JSON.stringify(read.pages) === JSON.stringify(want), { ...at, why: 'reading order', got: read.pages });
          check(read.upright, { ...at, why: 'a page is upside down in the book' });
          if (per) check(book.sheets.every(s => s.of <= per) && book.signatures === Math.ceil(sheets / Math.min(per, sheets || 1)), { ...at, why: 'signature sizes' });
        }
      }
    });
  }
}
sweep('the two sides of a booklet leaf are consecutive pages, and facing pages of a spread sum to the same number', check => {
  for (let n = 4; n <= 96; n += 4) {
    for (const s of EK.booklet(n).sheets) {
      check(s.front[0].page + s.front[1].page === n + 1 && s.back[0].page + s.back[1].page === n + 1, { n, why: 'pair sum' });
      check(s.back[0].page === s.front[1].page + 1 && s.front[0].page === s.back[1].page + 1, { n, why: 'leaf sides' });
    }
  }
});

// ---- N-up -------------------------------------------------------------------
const nu = (n, o) => EK.nUp(n, o).sheets.map(s => (s.back ? [pagesOf(s.front), pagesOf(s.back)] : pagesOf(s.front)));
eq(nu(4, { cols: 2, rows: 2 }), [[1, 2, 3, 4]], 'four up reads across, then down');
eq(nu(4, { cols: 2, rows: 2, order: 'column' }), [[1, 3, 2, 4]], 'column order reads down, then across');
eq(nu(4, { cols: 2, rows: 2, rtl: true }), [[2, 1, 4, 3]], 'right to left starts each row at the right');
eq(nu(4, { cols: 2, rows: 2, order: 'column', rtl: true }), [[3, 1, 4, 2]], 'right to left by columns starts with the right column');
eq(nu(6, { cols: 3, rows: 2, order: 'column' }), [[1, 3, 5, 2, 4, 6]], 'six up by columns');
eq(nu(5, { cols: 2, rows: 1 }), [[1, 2], [3, 4], [5, null]], 'two up, five pages: three sides, one blank');
eq(nu(5, { cols: 2, rows: 1, duplex: true }), [[[1, 2], [3, 4]], [[5, null], [null, null]]], 'two up on both sides: the back reads on, unmirrored');
eq(nu(0, { cols: 2, rows: 2 }), [], 'no pages, no sheets');
eq(nu(3, {}), [[1], [2], [3]], 'no grid is one up');
{
  const u = EK.nUp(5, { cols: 2, rows: 1, duplex: true });
  eq([u.perSide, u.sides, u.blanks, u.sheets.length], [2, 4, 3, 2], 'the summary counts both sides of the last sheet');
}
sweep('N-up places every page once, in reading order, on the fewest sides — 0..97 pages, 9 grids, both orders, both directions, one and two sides', check => {
  for (const [cols, rows] of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3], [4, 4], [5, 2]]) {
    for (const order of ['row', 'column']) for (const rtl of [false, true]) for (const duplex of [false, true]) {
      for (let n = 0; n <= 97; n++) {
        const u = EK.nUp(n, { cols, rows, order, rtl, duplex });
        const at = { n, cols, rows, order, rtl, duplex };
        const per = cols * rows, sideCount = Math.ceil(n / per);
        check(u.sheets.length === Math.ceil(sideCount / (duplex ? 2 : 1)), { ...at, why: 'sheets' });
        check(u.sheets.length === EK.sheetCount(n, { kind: 'nup', cols, rows, duplex }), { ...at, why: 'sheetCount() disagrees' });
        const read = [];
        for (const s of u.sheets) for (const side of duplex ? [s.front, s.back] : [s.front]) {
          check(side.length === per && side.every(x => x.rotate === 0), { ...at, why: 'side shape' });
          // Read the side the way the options say a reader would.
          const cells = [];
          for (let a = 0; a < (order === 'column' ? cols : rows); a++) for (let b = 0; b < (order === 'column' ? rows : cols); b++) {
            let r = order === 'column' ? b : a, c = order === 'column' ? a : b;
            if (rtl) c = cols - 1 - c;
            cells.push(side[r * cols + c].page);
          }
          read.push(...cells);
        }
        const want = read.map((_, i) => (i < n ? i + 1 : null));
        check(JSON.stringify(read) === JSON.stringify(want), { ...at, why: 'reading order', got: read });
      }
    }
  }
});
eq([0, 1, 4, 5, 8, 9].map(n => EK.sheetCount(n, { kind: 'booklet' })), [0, 1, 1, 2, 2, 3], 'a booklet takes a sheet for every four pages');
eq([0, 1, 2, 3].map(n => EK.sheetCount(n, { duplex: true })), [0, 1, 1, 2], 'plain two-sided takes a sheet for every two');
eq(EK.sheetCount(7, {}), 7, 'plain one-sided takes a sheet a page');
sweep('sheetCount() agrees with booklet() for every count 0..97', check => {
  for (let n = 0; n <= 97; n++) check(EK.sheetCount(n, { kind: 'booklet' }) === EK.booklet(n).sheets.length, { n });
});

// ---- duplex: where a back goes ---------------------------------------------
eq([['portrait', 'long'], ['portrait', 'short'], ['landscape', 'long'], ['landscape', 'short']].map(a => EK.flipAxis(...a)),
   ['vertical', 'horizontal', 'horizontal', 'vertical'], 'the paper turns about a vertical axis for portrait long-edge and landscape short-edge');
eq(EK.flipAxis(undefined, undefined), 'vertical', 'nothing said is portrait on the long edge');
eq(EK.flipAxis('portrait'), 'vertical', 'portrait with no edge named is the long edge');
eq(EK.mirrorPage(['a', 'b', 'c', 'd', 'e', 'f'], { cols: 3, rows: 2 }), ['c', 'b', 'a', 'f', 'e', 'd'], 'portrait, long edge: each row reversed');
eq(EK.mirrorPage(['a', 'b', 'c', 'd', 'e', 'f'], { cols: 3, rows: 2, flip: 'short' }), ['d', 'e', 'f', 'a', 'b', 'c'], 'portrait, short edge: the rows change places');
eq(EK.mirrorPage(['a', 'b', 'c', 'd', 'e', 'f'], { cols: 3, rows: 2, orientation: 'landscape', flip: 'short' }), ['c', 'b', 'a', 'f', 'e', 'd'], 'landscape, short edge: each row reversed');
eq(EK.mirrorPage(['a', 'b', 'c', 'd', 'e', 'f'], { cols: 3, rows: 2, orientation: 'landscape' }), ['d', 'e', 'f', 'a', 'b', 'c'], 'landscape, long edge: the rows change places');
eq(EK.mirrorPage(['a', 'b', 'c', 'd'], { cols: 3, rows: 2 }), [null, 'b', 'a', null, null, 'd'].map((v, i) => [ 'c', 'b', 'a', null, null, 'd'][i]), 'a short page is padded before it is mirrored');
eq(EK.mirrorPage(['a', 'b', 'c', 'd'], { cols: 3, rows: 3, flip: 'short' }), [null, null, null, 'd', null, null, 'a', 'b', 'c'], 'short edge needs the whole page: a part page mirrors from the bottom row');
eq(EK.mirrorPage([], { cols: 2, rows: 2 }), [null, null, null, null], 'an empty page is a page of blanks');
eq(EK.mirrorPage(['a', 'b', 'c'], { cols: 2 }), ['b', 'a', null, 'c'], 'with no row count there are as many rows as the items need');
eq(EK.mirrorPageRows(['a', 'b', 'c', 'd'], 3), ['c', 'b', 'a', null, null, 'd'], 'mirrorPageRows is the 064 suite\'s own example');
eq(EK.paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], 'paginate splits into pages');
eq(EK.paginate([], 4), [], 'nothing paginates to no pages');
{
  const src = [1, 2, 3, 4];
  EK.mirrorPageRows(src, 3); EK.mirrorPage(src, { cols: 2, rows: 2 });
  eq(src, [1, 2, 3, 4], 'neither mirror changes the list it was given');
}
/* The model: a card is a rectangle on the sheet. Turn the sheet about the
   axis and the point (x, y) is seen at (W - x, y) or (x, H - y). A back is
   right when its cell, turned, covers its front's cell. */
sweep('a mirrored back lies exactly behind its front — every grid to 5 x 6, every fill, both orientations, both edges', check => {
  for (let cols = 1; cols <= 5; cols++) for (let rows = 1; rows <= 6; rows++) {
    for (const orientation of ['portrait', 'landscape']) for (const flip of ['long', 'short']) {
      const sheet = EK.paper({ orientation });
      const lay = EK.layout({ sheet, cols, rows, margin: 18, gutter: 9 });
      const axis = EK.flipAxis(orientation, flip);
      for (let n = 0; n <= cols * rows; n++) {
        const fronts = Array.from({ length: n }, (_, i) => 'card' + i);
        const backs = EK.mirrorPage(fronts, { cols, rows, orientation, flip });
        const at = { cols, rows, orientation, flip, n };
        check(backs.length === cols * rows && backs.filter(x => x !== null).length === n, { ...at, why: 'shape' });
        for (let i = 0; i < n; i++) {
          const f = lay.cells[i], b = lay.cells[backs.indexOf(fronts[i])];
          const bx = axis === 'vertical' ? sheet.w - (b.x + b.w) : b.x;
          const by = axis === 'horizontal' ? sheet.h - (b.y + b.h) : b.y;
          check(Math.abs(bx - f.x) < 1e-6 && Math.abs(by - f.y) < 1e-6, { ...at, i, why: 'not behind its front' });
        }
      }
    }
  }
});
sweep('backIndex() is its own inverse, and stays on the page', check => {
  for (let cols = 1; cols <= 6; cols++) for (let rows = 1; rows <= 6; rows++) for (const axis of ['vertical', 'horizontal']) {
    for (let i = 0; i < cols * rows; i++) {
      const b = EK.backIndex(i, cols, rows, axis);
      check(b >= 0 && b < cols * rows && EK.backIndex(b, cols, rows, axis) === i, { cols, rows, axis, i });
    }
  }
});
sweep('paginate() and mirrorPageRows() give duplex-print.js\'s answers, and vfg-layout.js\'s — 2,000 random decks', check => {
  const r = rng(20261005);
  for (let t = 0; t < 2000; t++) {
    const items = Array.from({ length: Math.floor(r() * 40) }, (_, i) => i);
    const cols = 1 + Math.floor(r() * 5), per = cols * (1 + Math.floor(r() * 5));
    const a = EK.paginate(items, per), b = DP.paginate(items, per), c = VL.paginate(items, per);
    check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c), { why: 'paginate', n: items.length, per });
    for (const page of a) {
      const m = JSON.stringify(EK.mirrorPageRows(page, cols));
      check(m === JSON.stringify(DP.mirrorPageRows(page, cols)) && m === JSON.stringify(VL.mirrorPageRows(page, cols)), { why: 'mirrorPageRows', page, cols });
      if (page.length === per) check(m === JSON.stringify(EK.mirrorPage(page, { cols, rows: per / cols })), { why: 'mirrorPage on a full portrait page is mirrorPageRows', page, cols });
    }
  }
});

// ---- geometry ----------------------------------------------------------------
{
  const L = EK.paper({ orientation: 'landscape' });
  const bkl = EK.layout({ sheet: L, cols: 2, rows: 1, align: 'spine' });
  eq(bkl.cells, [{ x: 0, y: 0, w: 396, h: 612 }, { x: 396, y: 0, w: 396, h: 612 }], 'a letter booklet sheet is two 5.5 x 8.5 in halves');
  eq(bkl.slots.map(s => [s.x, s.y, s.w, s.h, s.scale]), [[0, 0, 396, 612, 1], [396, 0, 396, 612, 1]], 'with no page size, a page is its cell');
  const fit = EK.layout({ sheet: L, cols: 2, rows: 1, align: 'spine', page: { w: 612, h: 1224 } });
  near(fit.slots[0].scale, 0.5, 'a tabloid page in a half-letter cell is held to the height: scale 0.5');
  eq(fit.slots.map(s => [s.x, s.w, s.y, s.h]), [[90, 306, 0, 612], [396, 306, 0, 612]], 'aligned to the spine, the two pages meet at the fold');
  const mid = EK.layout({ sheet: L, cols: 2, rows: 1, page: { w: 612, h: 1224 } });
  eq(mid.slots.map(s => s.x), [45, 441], 'centred, each page sits in the middle of its half');
  const wide = EK.layout({ sheet: L, cols: 2, rows: 1, page: { w: 792, h: 612 } });
  eq(wide.slots.map(s => [s.x, s.y, s.w, s.h, s.scale]), [[0, 153, 396, 306, 0.5], [396, 153, 396, 306, 0.5]], 'a page held to the width is centred top to bottom');
  const m = EK.layout({ sheet: { w: 612, h: 792 }, cols: 2, rows: 2, margin: '0.5in', gutter: '0.25in' });
  eq(m.cells.map(c => [c.x, c.y, c.w, c.h]), [[36, 36, 261, 351], [315, 36, 261, 351], [36, 405, 261, 351], [315, 405, 261, 351]], 'margins and gutters: four cells, row-major');
  const mm = EK.layout({ sheet: { w: 612, h: 792 }, cols: 1, rows: 1, margin: { top: 36, right: 18, bottom: 0, left: '1in' } });
  eq(mm.cells, [{ x: 72, y: 36, w: 522, h: 756 }], 'a margin can be four different lengths');
  const gg = EK.layout({ sheet: { w: 600, h: 800 }, cols: 3, rows: 2, gutter: { x: 30, y: 0 } });
  eq(gg.cells.map(c => c.x), [0, 210, 420, 0, 210, 420], 'a gutter can differ across and down');
  const none = EK.layout({ sheet: { w: 600, h: 800 }, cols: 1, rows: 1, page: { w: 300, h: 300 }, fit: 'none' });
  eq(none.slots, [{ x: 150, y: 250, w: 300, h: 300, scale: 1, scaleY: 1 }], 'fit none keeps the page its own size, centred');
  const fill = EK.layout({ sheet: { w: 600, h: 800 }, cols: 1, rows: 1, page: { w: 300, h: 200 }, fit: 'fill' });
  eq([fill.slots[0].scale, fill.slots[0].scaleY, fill.slots[0].w, fill.slots[0].h], [2, 4, 600, 800], 'fit fill stretches each way');
  const squeezed = EK.layout({ sheet: { w: 100, h: 100 }, cols: 2, rows: 1, margin: 80 });
  eq(squeezed.cells.map(c => c.w), [0, 0], 'margins wider than the sheet leave cells of no width, not negative ones');
  ok(squeezed.slots.every(x => [x.x, x.y, x.w, x.h, x.scale, x.scaleY].every(Number.isFinite)), '... and slots whose numbers are still numbers');
}
sweep('cells tile the sheet inside its margins, and a fitted page keeps its shape inside its cell — 3,000 random sheets', check => {
  const r = rng(7);
  for (let t = 0; t < 3000; t++) {
    const sheet = { w: 300 + r() * 900, h: 300 + r() * 900 };
    const cols = 1 + Math.floor(r() * 5), rows = 1 + Math.floor(r() * 5);
    const margin = r() * 40, gutter = r() * 20;
    const page = { w: 50 + r() * 800, h: 50 + r() * 800 };
    const lay = EK.layout({ sheet, cols, rows, margin, gutter, page });
    const at = { t, cols, rows };
    check(lay.cells.length === cols * rows && lay.slots.length === cols * rows, { ...at, why: 'count' });
    const last = lay.cells[cols * rows - 1];
    check(Math.abs(lay.cells[0].x - margin) < 1e-6 && Math.abs(last.x + last.w - (sheet.w - margin)) < 1e-6, { ...at, why: 'width not filled' });
    check(Math.abs(lay.cells[0].y - margin) < 1e-6 && Math.abs(last.y + last.h - (sheet.h - margin)) < 1e-6, { ...at, why: 'height not filled' });
    for (let i = 0; i < lay.cells.length; i++) {
      const c = lay.cells[i], s = lay.slots[i];
      if (i % cols) check(Math.abs(c.x - (lay.cells[i - 1].x + lay.cells[i - 1].w + gutter)) < 1e-6, { ...at, i, why: 'gutter' });
      check(s.x >= c.x - 1e-6 && s.y >= c.y - 1e-6 && s.x + s.w <= c.x + c.w + 1e-6 && s.y + s.h <= c.y + c.h + 1e-6, { ...at, i, why: 'page outside its cell' });
      check(Math.abs(s.w / s.h - page.w / page.h) < 1e-6, { ...at, i, why: 'page lost its shape' });
      check(Math.abs(s.w - c.w) < 1e-6 || Math.abs(s.h - c.h) < 1e-6, { ...at, i, why: 'page smaller than it could be' });
    }
  }
});

// ---- creep --------------------------------------------------------------------
eq([0, 1, 2, 3].map(i => EK.creep(i, 4, 0.5)), [0, 0.5, 1, 1.5], 'creep grows by one thickness a sheet, from none on the outside');
eq(EK.creep(9, 4, 0.5), 1.5, 'a sheet index past the signature is the innermost');
eq(EK.creep(2, 4, undefined), 0, 'no thickness, no creep');
near(EK.creep(1, 2, '0.1mm'), 72 / 254, 'thickness takes a unit');

// ---- cut marks ------------------------------------------------------------------
{
  const lay = EK.layout({ sheet: { w: 612, h: 792 }, cols: 2, rows: 2, margin: 36 });
  const marks = EK.cutMarks(lay);
  eq(marks.length, 12, 'a 2 x 2 grid with no gutter has three edges each way: twelve marks');
  eq(marks[0], { x1: 36, y1: 22.5, x2: 36, y2: 31.5 }, 'a top mark is 9 pt long and stops 4.5 pt short of the grid');
  ok(marks.every(k => (k.x1 === k.x2) !== (k.y1 === k.y2)), 'every mark is a vertical or a horizontal line');
  ok(marks.every(k => {
    const mx = (k.x1 + k.x2) / 2, my = (k.y1 + k.y2) / 2;
    return mx < 36 || mx > 576 || my < 36 || my > 756;
  }), 'no mark is inside the grid');
  eq(EK.cutMarks(EK.layout({ sheet: { w: 612, h: 792 }, cols: 2, rows: 2, margin: 36, gutter: 12 })).length, 16, 'with a gutter each cell has its own edges: sixteen marks');
  eq(EK.cutMarks(EK.layout({ sheet: { w: 612, h: 792 }, cols: 2, rows: 2 })).length, 0, 'with no margin there is no room for a mark, and none is drawn');
  const tight = EK.cutMarks(EK.layout({ sheet: { w: 612, h: 792 }, cols: 1, rows: 1, margin: 9 }));
  eq(tight[0], { x1: 9, y1: 0, x2: 9, y2: 4.5 }, 'a mark with half the room is half as long');
  eq(EK.cutMarks(lay, { length: 18, offset: 0 })[0], { x1: 36, y1: 18, x2: 36, y2: 36 }, 'length and offset can be set');
}

// ---- the PDF matrix ---------------------------------------------------------------
/* jsPDF draws a point (x, y) of a page at PDF coordinates (x, H - y). The
   matrix must carry that to the slot: (u, v) -> (a u + c v + e, b u + d v + f). */
const through = (m, H, x, y) => { const u = x, v = H - y; const X = m[0] * u + m[2] * v + m[4], Y = m[1] * u + m[3] * v + m[5]; return [X, H - Y]; };
{
  const H = 612, slot = { x: 90, y: 108, w: 306, h: 396, scale: 0.5 };
  eq(EK.matrix(slot, H, 0), [0.5, 0, 0, 0.5, 90, 198], 'upright: scale, then move');
  eq(through(EK.matrix(slot, H, 0), H, 0, 0), [90, 108], 'upright, the page\'s top left is the slot\'s top left');
  eq(through(EK.matrix(slot, H, 0), H, 612, 792), [396, 504], '... and its bottom right the slot\'s bottom right');
  eq(through(EK.matrix(slot, H, 180), H, 0, 0), [396, 504], 'turned 180, the page\'s top left is the slot\'s bottom right');
  eq(through(EK.matrix(slot, H, 180), H, 612, 792), [90, 108], '... and its bottom right the slot\'s top left');
  eq(EK.matrix({ x: 0, y: 0, w: 612, h: 792, scale: 1 }, 792, 0), [1, 0, 0, 1, 0, 0], 'a whole page at actual size is the identity');
}
sweep('the matrix carries all four corners of a page to its slot, upright and turned — 2,000 random slots', check => {
  const r = rng(99);
  for (let t = 0; t < 2000; t++) {
    const H = 300 + r() * 900, pw = 50 + r() * 700, ph = 50 + r() * 700;
    const sx = 0.1 + r() * 2, sy = r() < 0.5 ? sx : 0.1 + r() * 2;
    const slot = { x: r() * 500, y: r() * 500, w: pw * sx, h: ph * sy, scale: sx, scaleY: sy };
    for (const [px, py, fx, fy] of [[0, 0, 0, 0], [pw, 0, 1, 0], [0, ph, 0, 1], [pw, ph, 1, 1]]) {
      const up = through(EK.matrix(slot, H, 0), H, px, py), dn = through(EK.matrix(slot, H, 180), H, px, py);
      check(Math.abs(up[0] - (slot.x + fx * slot.w)) < 1e-6 && Math.abs(up[1] - (slot.y + fy * slot.h)) < 1e-6, { t, why: 'upright', px, py });
      check(Math.abs(dn[0] - (slot.x + (1 - fx) * slot.w)) < 1e-6 && Math.abs(dn[1] - (slot.y + (1 - fy) * slot.h)) < 1e-6, { t, why: 'turned', px, py });
    }
  }
});

// ---- flow pagination ------------------------------------------------------------
const pb = (blocks, H, o) => EK.paginateBlocks(blocks, H, o).map(p => p.map(x => [x.i, x.y, x.h]));
eq(pb([], 100), [], 'no blocks, no pages');
eq(pb([40, 40, 40], 100), [[[0, 0, 40], [1, 40, 40]], [[2, 0, 40]]], 'three 40s on a page of 100: two, then one');
eq(pb([50, 50], 100), [[[0, 0, 50], [1, 50, 50]]], 'blocks that exactly fill a page share it');
eq(pb([50, 50], 100, { gap: 10 }), [[[0, 0, 50]], [[1, 0, 50]]], 'a gap between them and they no longer fit');
eq(pb([30, 30, 30], 100, { gap: 5 }), [[[0, 0, 30], [1, 35, 30], [2, 70, 30]]], 'the gap is between blocks, not above the first or below the last');
eq(pb([30, { h: 30, breakBefore: true }, 30], 100), [[[0, 0, 30]], [[1, 0, 30], [2, 30, 30]]], 'breakBefore starts a page');
eq(pb([{ h: 30, breakBefore: true }], 100), [[[0, 0, 30]]], 'breakBefore on the first block is not a blank first page');
eq(pb([60, { h: 20, keepWithNext: true }, 40], 100), [[[0, 0, 60]], [[1, 0, 20], [2, 20, 40]]], 'a heading that would be left at the foot of a page goes with what follows it');
eq(pb([60, 20, 40], 100), [[[0, 0, 60], [1, 60, 20]], [[2, 0, 40]]], '... which without keepWithNext it would not');
eq(pb([10, { h: 20, keepWithNext: true }, { h: 20, keepWithNext: true }, 60], 100), [[[0, 0, 10]], [[1, 0, 20], [2, 20, 20], [3, 40, 60]]], 'a chain of keepWithNext moves together');
eq(pb([10, { h: 60, keepWithNext: true }, 60], 100), [[[0, 0, 10], [1, 10, 60]], [[2, 0, 60]]], 'a run too tall for any page is placed as it comes, not pushed down for nothing');
eq(pb([10, { h: 20, keepWithNext: true }], 100), [[[0, 0, 10], [1, 10, 20]]], 'keepWithNext on the last block asks for nothing');
{
  const tall = EK.paginateBlocks([30, 150, 30], 100);
  eq(tall.map(p => p.map(x => [x.i, x.h, !!x.overflow])), [[[0, 30, false]], [[1, 150, true]], [[2, 30, false]]], 'a whole block taller than the page is alone on a page, flagged, and not cut short');
  const cut = EK.paginateBlocks([30, { h: 150, split: true }, 30], 100);
  eq(cut.map(p => p.map(x => [x.i, x.y, x.h, x.from, x.to])),
     [[[0, 0, 30, 0, 30], [1, 30, 70, 0, 70]], [[1, 0, 80, 70, 150]], [[2, 0, 30, 0, 30]]], 'a block that may be cut fills the page and runs on, and says which part is where');
  eq(EK.paginateBlocks([30, { h: 150, split: true }, 20], 100).map(p => p.map(x => x.i)), [[0, 1], [1, 2]], '... and what follows it shares its last page when there is room');
  eq(EK.paginateBlocks([{ h: 250, split: true }], 100).map(p => p.map(x => [x.from, x.to])), [[[0, 100]], [[100, 200]], [[200, 250]]], 'a long one runs over as many pages as it needs');
  eq(EK.paginateBlocks([95, { h: 50, split: true }], 100, { minSlice: 20 }).map(p => p.map(x => [x.i, x.from, x.to])),
     [[[0, 0, 95]], [[1, 0, 50]]], 'a slice smaller than minSlice is not started at the foot of a page');
  eq(EK.paginateBlocks([{ h: 110, split: true }], 100, { minSlice: 20 }).map(p => p.map(x => [x.from, x.to])),
     [[[0, 90]], [[90, 110]]], 'a last slice smaller than minSlice takes some from the page before');
  eq(pb([60, 60], 100, { firstPageHeight: 130 }), [[[0, 0, 60], [1, 60, 60]]], 'the first page can be a different height');
  eq(pb([60, 60, 60], 100, { firstPageHeight: 50 }), [[[0, 0, 60]], [[1, 0, 60]], [[2, 0, 60]]], '... shorter, too');
  eq(EK.paginateBlocks([60], 100, { firstPageHeight: 50 })[0][0].overflow, true, '... and a block too tall for it is flagged there');
  eq(pb([0, 0, 100], 100), [[[0, 0, 0], [1, 0, 0], [2, 0, 100]]], 'blocks of no height take no room');
  eq(pb([{ h: 0, split: true }, 100], 100), [[[0, 0, 0], [1, 0, 100]]], 'a splittable block of no height is placed once');
  eq(pb([-5, 'x', null, 20], 100), [[[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 20]]], 'what is not a height is no height, and is still a block');
}
sweep('flow pagination loses nothing, overlaps nothing, never runs off a page unflagged, and wastes no page — 4,000 random documents', check => {
  const r = rng(424242);
  for (let t = 0; t < 4000; t++) {
    const H = 100 + Math.floor(r() * 400);
    const gap = r() < 0.5 ? 0 : Math.floor(r() * 12);
    const minSlice = r() < 0.5 ? 0 : Math.floor(r() * 30);
    const firstPageHeight = r() < 0.7 ? undefined : 60 + Math.floor(r() * 400);
    const plain = r() < 0.3;   // no flags at all: must match the plain greedy fill
    const blocks = Array.from({ length: Math.floor(r() * 30) }, () => {
      const h = r() < 0.08 ? Math.floor(H + r() * 2 * H) : Math.floor(r() * H * 0.6);
      return plain ? h : { h, split: r() < 0.25, keepWithNext: r() < 0.2, breakBefore: r() < 0.05 };
    });
    const pages = EK.paginateBlocks(blocks, H, { gap, minSlice, firstPageHeight });
    const at = { t, H, gap, minSlice, firstPageHeight };
    const hOf = b => (typeof b === 'number' ? b : b.h);
    const seen = blocks.map(() => 0);
    let lastI = -1, lastTo = 0;
    check(pages.every(p => p.length > 0), { ...at, why: 'an empty page' });
    pages.forEach((p, pi) => {
      const ph = pi === 0 && firstPageHeight !== undefined ? firstPageHeight : H;
      p.forEach((x, k) => {
        const b = blocks[x.i];
        check(Math.abs(x.h - (x.to - x.from)) < 1e-6, { ...at, why: 'h is not to - from', x });
        // in order, and each part of a block follows the one before it
        if (x.i === lastI) check(Math.abs(x.from - lastTo) < 1e-6 && k === 0, { ...at, why: 'slices out of order or on one page', x });
        else check(x.i === lastI + 1 && x.from === 0, { ...at, why: 'block skipped or out of order', x, lastI });
        lastI = x.i; lastTo = x.to;
        seen[x.i] += x.h;
        check(k === 0 ? x.y === 0 : Math.abs(x.y - (p[k - 1].y + p[k - 1].h + gap)) < 1e-6, { ...at, why: 'not stacked with the gap', x });
        const whole = x.from === 0 && Math.abs(x.to - hOf(b)) < 1e-6;
        if (typeof b === 'number' || !b.split) check(whole, { ...at, why: 'a block that must stay whole was cut', x });
        const fits = x.y + x.h <= ph + 1e-6;
        check(fits || (x.overflow === true && k === 0 && hOf(b) > ph), { ...at, why: 'runs off the page', x, ph });
        check(!x.overflow || (!fits && (typeof b === 'number' || !b.split)), { ...at, why: 'flagged for nothing', x });
        if (typeof b !== 'number' && b.breakBefore) check(k === 0 || x.from > 0, { ...at, why: 'breakBefore ignored', x });
        // a heading is not left at the foot of a page when it and what follows fit on one
        if (typeof b !== 'number' && b.keepWithNext && !b.split && k === p.length - 1 && x.i + 1 < blocks.length && pi + 1 < pages.length) {
          const nx = blocks[x.i + 1];
          const first = nx.split ? Math.min(nx.h, Math.max(minSlice, 0.01)) : nx.h;   // the thinnest slice export.js will start
          if (!nx.breakBefore && !nx.keepWithNext && k > 0) check(x.h + gap + first > H + 1e-6, { ...at, why: 'a heading left behind', x });
        }
        // the last slice of a cut block is not a sliver, where the block and the pages are long enough to avoid one
        if (x.from > 0 && Math.abs(x.to - hOf(b)) < 1e-6 && hOf(b) >= 2 * minSlice && 2 * minSlice <= Math.min(H, firstPageHeight === undefined ? H : firstPageHeight)) {
          check(x.h >= minSlice - 1e-6, { ...at, why: 'last slice under minSlice', x });
        }
      });
    });
    check(blocks.every((b, i) => Math.abs(seen[i] - hOf(b)) < 1e-6), { ...at, why: 'a block was lost or doubled', seen });
    if (plain) {
      // The reference: first fit, in order.
      const ref = [[]]; let y = 0;
      blocks.forEach((h, i) => {
        const ph = ref.length === 1 && firstPageHeight !== undefined ? firstPageHeight : H;
        const need = (ref[ref.length - 1].length ? gap : 0) + h;
        if (ref[ref.length - 1].length && y + need > ph) { ref.push([]); y = 0; }
        y += (ref[ref.length - 1].length ? gap : 0) + h; ref[ref.length - 1].push(i);
      });
      check(JSON.stringify(pages.map(p => p.map(x => x.i))) === JSON.stringify(blocks.length ? ref : []), { ...at, why: 'not the greedy fill' });
    }
  }
});

// ---- the plan ---------------------------------------------------------------------
{
  const p = EK.pdfPlan(8, { impose: { kind: 'booklet' } });
  eq([p.kind, p.sheet.orientation, p.sheet.w, p.sheet.h, p.sheets, p.blanks], ['booklet', 'landscape', 792, 612, 2, 0], 'a booklet plan is on landscape paper');
  eq(p.page, { w: 396, h: 612 }, 'its pages are half sheets unless a size is given');
  eq(p.sides.map(s => [s.sheet, s.face, s.slots.map(x => x.page)]),
     [[0, 'front', [8, 1]], [0, 'back', [2, 7]], [1, 'front', [6, 3]], [1, 'back', [4, 5]]], 'sides come front, back, front, back');
  eq(p.sides[0].slots.map(x => x.matrix), [[1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 396, 0]], 'half-sheet pages are placed at actual size');
  eq(EK.pdfPlan(8, { impose: { kind: 'booklet' }, orientation: 'portrait' }).sheet.orientation, 'landscape', 'a booklet is landscape whatever it is told');
  const manual = EK.pdfPlan(8, { impose: { kind: 'booklet' }, stack: 'fronts-first' });
  eq(manual.sides.map(s => [s.sheet, s.face]), [[0, 'front'], [1, 'front'], [0, 'back'], [1, 'back']], 'fronts-first is every front, then every back');
  const rev = EK.pdfPlan(8, { impose: { kind: 'booklet' }, stack: 'fronts-first', reverseBacks: true });
  eq(rev.sides.map(s => [s.sheet, s.face]), [[0, 'front'], [1, 'front'], [1, 'back'], [0, 'back']], 'reverseBacks runs the backs last sheet first');
  const lng = EK.pdfPlan(4, { impose: { kind: 'booklet', flip: 'long' } });
  eq(lng.sides[1].slots.map(x => [x.page, x.rotate, x.matrix]), [[3, 180, [-1, 0, 0, -1, 396, 612]], [2, 180, [-1, 0, 0, -1, 792, 612]]], 'long-edge backs are placed turned');
  const cr = EK.pdfPlan(12, { impose: { kind: 'booklet', creep: 2 } });
  eq(cr.sides.filter(s => s.face === 'front').map(s => s.slots.map(x => x.x)), [[0, 396], [2, 394], [4, 392]], 'creep moves both pages of each inner sheet toward the fold');
  eq(cr.sides.filter(s => s.face === 'back').map(s => s.slots.map(x => x.x)), [[0, 396], [2, 394], [4, 392]], '... on the back as on the front');
  eq(cr.sides[2].slots.map(x => x.matrix[4]), [2, 394], '... and the matrix moves with it');
  const sig = EK.pdfPlan(16, { impose: { kind: 'booklet', creep: 2, sheetsPerSignature: 2 } });
  eq(sig.sides.filter(s => s.face === 'front').map(s => s.slots[0].x), [0, 2, 0, 2], 'creep starts again with each signature');
  const letter = EK.pdfPlan(4, { impose: { kind: 'booklet' }, pageSize: { w: '8.5in', h: '17in' } });
  eq(letter.sides[0].slots.map(x => [x.x, x.y, x.w, x.h, x.scale]), [[90, 0, 306, 612, 0.5], [396, 0, 306, 612, 0.5]], 'larger pages are scaled to the half sheet and meet at the fold');
  eq(letter.page, { w: 612, h: 1224 }, 'the plan reports the source page size');
  near(EK.pdfPlan(4, { impose: { kind: 'booklet' }, pageSize: { w: 612, h: 792 } }).sides[0].slots[0].scale, 396 / 612, 'a letter page on a half-letter page is 65%', 1e-9);

  const four = EK.pdfPlan(5, { impose: { kind: 'nup', cols: 2, rows: 2 }, margin: 36, gutter: 0, cutMarks: true, pageSize: { w: 612, h: 792 } });
  eq([four.kind, four.sheets, four.sides.length, four.blanks], ['nup', 2, 2, 3], 'four up, five pages: two sheets');
  eq(four.sides[1].slots.map(x => x.page), [5, null, null, null], 'the last side is mostly blank');
  eq(four.sides[0].marks.length, 12, 'cut marks ride on every side');
  near(four.sides[0].slots[0].scale, 270 / 612, 'pages are scaled to their cells', 1e-9);
  const dup = EK.pdfPlan(5, { impose: { kind: 'nup', cols: 2, rows: 1, duplex: true }, orientation: 'landscape' });
  eq(dup.sides.map(s => [s.sheet, s.face, s.slots.map(x => x.page)]), [[0, 'front', [1, 2]], [0, 'back', [3, 4]], [1, 'front', [5, null]], [1, 'back', [null, null]]], 'two-sided two up');
  const one = EK.pdfPlan(3, {});
  eq([one.kind, one.sides.length, one.sides[0].slots[0].matrix, one.page], ['single', 3, [1, 0, 0, 1, 0, 0], { w: 612, h: 792 }], 'no imposition is a page a sheet at actual size');
  eq(EK.pdfPlan(3, { paper: 'a4', pageSize: { w: 612, h: 792 } }).sides[0].slots[0].scale < 1, true, 'a letter page on A4 is scaled down to fit');
  eq(EK.pdfPlan(0, { impose: { kind: 'booklet' } }).sides, [], 'no pages, no sides');
  eq(EK.pdfPlan(2, { impose: { kind: 'fan-fold' } }).kind, 'single', 'an unknown kind is no imposition');
}
sweep('every plan draws each page exactly once, inside the sheet — 0..40 pages, booklets and grids, with and without a page size', check => {
  const cases = [{ kind: 'booklet' }, { kind: 'booklet', flip: 'long', creep: 0.3 }, { kind: 'booklet', sheetsPerSignature: 3 }, { kind: 'nup', cols: 2, rows: 2 }, { kind: 'nup', cols: 3, rows: 2, duplex: true }, undefined];
  for (const impose of cases) for (const pageSize of [undefined, { w: 612, h: 792 }, { w: 300, h: 300 }]) for (const stack of [undefined, 'fronts-first']) {
    for (let n = 0; n <= 40; n++) {
      const p = EK.pdfPlan(n, { impose, pageSize, stack, margin: 18, cutMarks: true });
      const at = { n, impose, pageSize, stack };
      const drawn = p.sides.flatMap(s => s.slots.map(x => x.page).filter(x => x !== null)).sort((a, b) => a - b);
      check(JSON.stringify(drawn) === JSON.stringify(Array.from({ length: n }, (_, i) => i + 1)), { ...at, why: 'pages drawn', drawn });
      for (const s of p.sides) for (const x of s.slots) {
        check(x.x >= -1e-6 && x.y >= -1e-6 && x.x + x.w <= s.w + 1e-6 && x.y + x.h <= s.h + 1e-6, { ...at, why: 'slot off the sheet', x });
        const tl = through(x.matrix, s.h, 0, 0);
        const want = x.rotate === 180 ? [x.x + x.w, x.y + x.h] : [x.x, x.y];
        check(Math.abs(tl[0] - want[0]) < 1e-6 && Math.abs(tl[1] - want[1]) < 1e-6, { ...at, why: 'matrix does not match the slot', x });
      }
    }
  }
});

// ---- toPdf against a jsPDF that only takes notes -------------------------------------
function FakePdf(o) {
  const log = [['new', o.unit, o.format, o.orientation]];
  this.log = log;
  this.Matrix = function (...m) { this.m = m; };
  this.addPage = (f, orient) => log.push(['addPage', f, orient]);
  this.saveGraphicsState = () => log.push(['q']);
  this.restoreGraphicsState = () => log.push(['Q']);
  this.setCurrentTransformationMatrix = m => log.push(['cm', m.m]);
  this.addImage = (img, type, x, y, w, h) => log.push(['image', img, type, x, y, w, h]);
  this.setDrawColor = () => {}; this.setLineWidth = () => {};
  this.line = (...a) => log.push(['line', ...a]);
  this.setProperties = p => log.push(['props', p]);
  this.save = name => log.push(['save', name]);
}
{
  let threw = '';
  try { EK.toPdf(['a']); } catch (e) { threw = e.message; }
  ok(/jsPDF is not loaded/.test(threw), 'with no jsPDF on the page toPdf says so, and names the file');
  const calls = [];
  const draw = tag => (doc, box) => calls.push([tag, box.w, box.h, box.page]);
  const out = EK.toPdf([draw('p1'), draw('p2'), draw('p3'), draw('p4')], { jsPDF: FakePdf, impose: { kind: 'booklet', flip: 'long' }, filename: 'book.pdf', title: 'Book' });
  eq(out.doc.log[0], ['new', 'pt', [792, 612], 'landscape'], 'the document is made in points at the sheet\'s size');
  eq(out.doc.log.filter(l => l[0] === 'addPage').length, 1, 'one sheet, two sides: one page added to the first');
  eq(calls, [['p4', 396, 612, 4], ['p1', 396, 612, 1], ['p3', 396, 612, 3], ['p2', 396, 612, 2]], 'each page\'s own function is called, in slot order, with its size and number');
  eq(out.doc.log.filter(l => l[0] === 'cm').map(l => l[1]), [[1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 396, 0], [-1, 0, 0, -1, 396, 612], [-1, 0, 0, -1, 792, 612]], 'each under its slot\'s matrix');
  eq(out.doc.log.filter(l => l[0] === 'q').length, out.doc.log.filter(l => l[0] === 'Q').length, 'every saved graphics state is restored');
  eq(out.doc.log[out.doc.log.length - 1], ['save', 'book.pdf'], 'a filename saves the file, last');
  eq(out.doc.log[1], ['props', { title: 'Book' }], 'a title is set');
  eq(out.plan.sides.length, 2, 'the plan comes back with the document');

  const imgs = EK.toPdf(['data:image/png;base64,AAA', 'data:image/jpeg;base64,BBB', { image: 'canvas-stand-in', type: 'JPEG' }, { draw: draw('obj') }, 'data:image/png;base64,CCC'],
    { jsPDF: FakePdf, impose: { kind: 'nup', cols: 2, rows: 2 }, pageSize: { w: 100, h: 100 }, cutMarks: true, margin: 36 });
  eq(imgs.doc.log.filter(l => l[0] === 'image').map(l => l.slice(1)),
     [['data:image/png;base64,AAA', 'PNG', 0, 0, 100, 100], ['data:image/jpeg;base64,BBB', 'JPEG', 0, 0, 100, 100], ['canvas-stand-in', 'JPEG', 0, 0, 100, 100], ['data:image/png;base64,CCC', 'PNG', 0, 0, 100, 100]],
     'an image is drawn at its page\'s origin and size; the matrix does the placing');
  eq(calls[calls.length - 1], ['obj', 100, 100, 4], 'a { draw } object is a draw function');
  eq(imgs.doc.log.filter(l => l[0] === 'line').length, 24, 'cut marks are drawn on both sides');
  eq(imgs.doc.log.filter(l => l[0] === 'save').length, 0, 'with no filename nothing is saved');
  eq(imgs.doc.log.filter(l => l[0] === 'cm').length, 5, 'blank slots draw nothing');
  eq(EK.toPdf([], { jsPDF: FakePdf }).doc.log.length, 1, 'no pages is an untouched document');
  ctx.window.jspdf = { jsPDF: FakePdf };
  eq(EK.toPdf([draw('g')]).doc.log[0][0], 'new', 'jsPDF is found on window.jspdf when it is not handed in');
  delete ctx.window.jspdf;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
