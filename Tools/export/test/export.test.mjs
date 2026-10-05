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
//
// The file helpers are here too. toCsv() is read back by an RFC 4180 reader
// written in this file; toXlsx() and toZip() run on the vendored SheetJS and
// JSZip and are read back by _zip-read.mjs, which is neither, and by `unzip`
// and Python's zipfile when the machine has them (the run says which it used).
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
// paginate() and mirrorPageRows() as _shared/duplex-print.js and 040's
// vfg-layout.js had them, word for word. Both copies were deleted in v245,
// when 040 followed 064 on to ExportKit; this one stays, so ExportKit's two
// are still held to the answers every printed deck has been cut by.
const DP = {
  paginate(items, perPage) {
    var pages = [];
    for (var i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
  },
  mirrorPageRows(pageItems, cols) {
    var mirrored = [];
    for (var i = 0; i < pageItems.length; i += cols) {
      var row = pageItems.slice(i, i + cols);
      while (row.length < cols) row.push(null);
      mirrored = mirrored.concat(row.slice().reverse());
    }
    return mirrored;
  },
};

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
sweep('paginate() and mirrorPageRows() give the answers duplex-print.js and vfg-layout.js gave — 2,000 random decks', check => {
  const r = rng(20261005);
  for (let t = 0; t < 2000; t++) {
    const items = Array.from({ length: Math.floor(r() * 40) }, (_, i) => i);
    const cols = 1 + Math.floor(r() * 5), per = cols * (1 + Math.floor(r() * 5));
    const a = EK.paginate(items, per), b = DP.paginate(items, per);
    check(JSON.stringify(a) === JSON.stringify(b), { why: 'paginate', n: items.length, per });
    for (const page of a) {
      const m = JSON.stringify(EK.mirrorPageRows(page, cols));
      check(m === JSON.stringify(DP.mirrorPageRows(page, cols)), { why: 'mirrorPageRows', page, cols });
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

// ---- geometry: no float noise (found by 064, the first adopter) -------------
{
  // Six 2.5 x 3.5 in cards on letter, 0.15 in apart, centred: 064's sheet.
  const lay = EK.layout({ sheet: { w: 612, h: 792 }, cols: 3, rows: 2, margin: { top: 138.6, bottom: 138.6, left: 25.2, right: 25.2 }, gutter: 10.8, page: { w: 180, h: 252 } });
  eq(lay.slots.map(s => [s.x, s.y, s.w, s.h, s.scale]), [[25.2, 138.6, 180, 252, 1], [216, 138.6, 180, 252, 1], [406.8, 138.6, 180, 252, 1], [25.2, 401.4, 180, 252, 1], [216, 401.4, 180, 252, 1], [406.8, 401.4, 180, 252, 1]],
     'a grid whose margins are tenths of an inch has its cards at exactly 25.2, 216 and 406.8 pt, at a scale of exactly 1');
  const plan = EK.pdfPlan(6, { impose: { kind: 'nup', cols: 3, rows: 2 }, margin: { top: 138.6, bottom: 138.6, left: 25.2, right: 25.2 }, gutter: 10.8, pageSize: { w: 180, h: 252 } });
  eq(plan.sides[0].slots.map(s => s.matrix), [[1, 0, 0, 1, 25.2, -138.6], [1, 0, 0, 1, 216, -138.6], [1, 0, 0, 1, 406.8, -138.6], [1, 0, 0, 1, 25.2, -401.4], [1, 0, 0, 1, 216, -401.4], [1, 0, 0, 1, 406.8, -401.4]],
     'and its matrices are those numbers, not 0.9999999999999999 and 215.99999999999997');
}

// ---- the file helpers: CSV --------------------------------------------------
console.log('ExportKit — CSV, XLSX, ZIP and file names');

/** An RFC 4180 reader, written here and nowhere near toCsv(): records of
    fields, a quoted field ending at a quote that is not doubled. */
function readCsv(text, delim = ',') {
  const rows = []; let row = [], field = '', i = 0, quoted = false, any = false;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
      else if (ch === '"') { quoted = false; i++; }
      else { field += ch; i++; }
    } else if (ch === '"' && field === '') { quoted = true; any = true; i++; }
    else if (ch === delim) { row.push(field); field = ''; any = true; i++; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; any = false; i += 2; }
    else { field += ch; any = true; i++; }
  }
  if (any || field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const BOM = '\uFEFF';
{
  const plain = EK.toCsv([['a', 'b'], ['c', 'd']]);
  eq(plain, BOM + 'a,b\r\nc,d\r\n', 'two rows: a BOM, commas, CRLF after every record');
  eq([plain.charCodeAt(0), [...Buffer.from(plain, 'utf8').subarray(0, 3)]], [0xFEFF, [0xEF, 0xBB, 0xBF]], 'the file starts with the UTF-8 byte order mark');
  eq(EK.toCsv([['a']], { bom: false }), 'a\r\n', 'bom: false leaves it off');
  eq(EK.toCsv([], {}), BOM, 'no rows is a BOM and nothing else');
  eq(EK.toCsv(null, { bom: false }), '', 'no rows at all is an empty file');
  ok(!/[^\r]\n/.test(plain) && !/\r[^\n]/.test(plain), 'no bare LF and no bare CR between records');

  const q = (v, o) => EK.toCsv([[v]], Object.assign({ bom: false }, o)).slice(0, -2);
  eq(q('Okafor, Ines'), '"Okafor, Ines"', 'a comma is quoted');
  eq(q('say "hi"'), '"say ""hi"""', 'a quote is doubled inside quotes');
  eq(q('line one\nline two'), '"line one\nline two"', 'a newline is quoted and kept');
  eq(q('a\r\nb'), '"a\r\nb"', 'a CRLF inside a cell is quoted and kept');
  eq(q('plain text'), 'plain text', 'a cell with none of them is not quoted');
  eq(q(' padded '), ' padded ', 'spaces are kept as typed');
  eq(q(''), '', 'an empty string is an empty cell');
  eq(q(null) + q(undefined) + q(NaN) + q(Infinity), '', 'null, undefined, NaN and Infinity are empty cells');
  eq([q(0), q(-5), q(3.25), q(true), q(false)], ['0', '-5', '3.25', 'true', 'false'], 'numbers and booleans are written plainly, a negative number with no apostrophe');
  eq(q(new Date(2026, 9, 5)), '2026-10-05', 'a date at midnight is its day');
  eq(q(new Date(2026, 0, 9, 14, 5, 7)), '2026-01-09 14:05:07', 'a date with a time of day carries it');
  eq(q(new Date(NaN)), '', 'a date that is not one is empty');

  // The formula guard.
  eq(q('=1+1'), "'=1+1", 'a typed = gets an apostrophe');
  eq(q('+1 555 0100'), "'+1 555 0100", 'a typed + gets an apostrophe');
  eq(q('-5'), "'-5", 'a typed - gets an apostrophe');
  eq(q('@handle'), "'@handle", 'a typed @ gets an apostrophe');
  eq(q('\tcmd'), "'\tcmd", 'a leading tab gets an apostrophe');
  eq(q('\rcmd'), '"\'\rcmd"', 'a leading return gets an apostrophe, and the cell is quoted for the return');
  eq(q('=HYPERLINK("http://x","y"),1'), '"\'=HYPERLINK(""http://x"",""y""),1"', 'the apostrophe goes inside the quotes');
  eq(q('a=b'), 'a=b', 'a = that is not first is left alone');
  eq(q(' =1'), ' =1', 'only the very first character counts');
  eq(q('=1+1', { raw: true }), '=1+1', 'raw: true writes it as typed');
  eq(q('-5', { raw: true }), '-5', 'raw: true, a typed minus');

  // Delimiters.
  eq(EK.toCsv([['a;b', 'c,d']], { delimiter: ';', bom: false }), '"a;b";c,d\r\n', 'with ; the semicolon is what gets quoted, not the comma');
  eq(EK.toCsv([['a\tb', 'c']], { delimiter: '\t', bom: false }), '"a\tb"\tc\r\n', 'a tab delimiter');
  eq(EK.toCsv([['a', 'b']], { delimiter: '', bom: false }), 'a,b\r\n', 'an empty delimiter is a comma');

  // Columns and object rows.
  const people = [{ name: 'Ines Okafor', room: 12 }, { room: 7, name: 'Tavi Brandt', note: 'new' }];
  eq(EK.toCsv(people, { bom: false }), 'name,room,note\r\nInes Okafor,12,\r\nTavi Brandt,7,new\r\n', 'object rows: every key, in the order first seen, missing ones empty');
  eq(EK.toCsv(people, { bom: false, columns: ['room', 'name'] }), 'room,name\r\n12,Ines Okafor\r\n7,Tavi Brandt\r\n', 'columns picks and orders');
  eq(EK.toCsv(people, { bom: false, columns: [{ key: 'name', label: 'Student' }, { key: 'room', label: 'Room, floor 1' }] }),
     'Student,"Room, floor 1"\r\nInes Okafor,12\r\nTavi Brandt,7\r\n', 'a column can carry a label, quoted like any cell');
  eq(EK.toCsv([['x', 'y'], ['z']], { bom: false, columns: ['A', 'B', 'C'] }), 'A,B,C\r\nx,y,\r\nz,,\r\n', 'array rows under columns are positional and padded');
  eq(EK.toCsv([{ a: 1 }], { bom: false, columns: ['=cmd'] }), "'=cmd\r\n\r\n", 'a header is guarded like any typed cell');
  eq(EK.toCsv([{ constructor: 'x', toString: 'y' }], { bom: false }), 'constructor,toString\r\nx,y\r\n', 'keys that are also Object.prototype names are data');
  eq(EK.toCsv([{ a: 1 }, { b: 2 }], { bom: false, columns: ['hasOwnProperty'] }), 'hasOwnProperty\r\n\r\n\r\n', 'an inherited property is not a cell');
  eq(EK.toCsv(['solo', 7], { bom: false }), 'solo\r\n7\r\n', 'a row that is one value is one cell');

  // Round trip: 600 random tables through the reader above.
  const ALPHA = ['a', 'B', ' ', ',', ';', '"', '\n', '\r\n', '\t', '=', '+', '-', '@', "'", 'é', '字', '😀', '0', '.'];
  const random = rng(20261005);
  const cellOf = () => { let s = ''; for (let n = Math.floor(random() * 6); n > 0; n--) s += ALPHA[Math.floor(random() * ALPHA.length)]; return s; };
  const tableOf = () => { const w = 1 + Math.floor(random() * 5), t = []; for (let r = 1 + Math.floor(random() * 6); r > 0; r--) t.push(Array.from({ length: w }, cellOf)); return t; };
  sweep('600 random tables come back cell for cell with raw: true, for , ; and tab', check => {
    for (let n = 0; n < 600; n++) {
      const t = tableOf(), d = [',', ';', '\t'][n % 3];
      // A lone \r in a cell is kept by quoting; the reader takes \r\n outside quotes only.
      const back = readCsv(EK.toCsv(t, { raw: true, bom: false, delimiter: d }), d);
      check(JSON.stringify(back) === JSON.stringify(t), { t, d, back });
    }
  });
  sweep('600 more, guarded: every cell is as typed, or as typed behind one apostrophe exactly when it starts = + - @ tab or return', check => {
    for (let n = 0; n < 600; n++) {
      const t = tableOf();
      const back = readCsv(EK.toCsv(t, { bom: false }));
      check(back.length === t.length, { t, back });
      t.forEach((row, r) => row.forEach((cell, c) => {
        const want = /^[=+\-@\t\r]/.test(cell) ? "'" + cell : cell;
        check(back[r] && back[r][c] === want, { cell, got: back[r] && back[r][c] });
      }));
    }
  });
  sweep('in those tables no guarded file has a field a spreadsheet would run', check => {
    for (let n = 0; n < 300; n++) for (const row of readCsv(EK.toCsv(tableOf(), { bom: false }))) for (const f of row) check(!/^[=+\-@\t\r]/.test(f), f);
  });
}

// ---- file names -------------------------------------------------------------
eq(EK.filename('Period 3 roster', 'csv'), 'Period 3 roster.csv', 'a plain title keeps its spaces');
eq(EK.filename('A/B: "what?" <now>|*', 'xlsx'), 'A B what now.xlsx', 'the nine characters Windows refuses are gone');
eq(EK.filename('  ..hidden..  ', 'zip'), 'hidden.zip', 'no dot or space at either end');
eq(EK.filename('', 'pdf'), 'export.pdf', 'an empty title is "export"');
eq(EK.filename(null), 'export', 'no title and no extension');
eq(EK.filename('///', '.csv'), 'export.csv', 'a title of nothing but separators is "export", and a dot on the extension is not doubled');
eq(EK.filename('tab\there\nnow', 'txt'), 'tab here now.txt', 'control characters are spaces');
eq(EK.filename('x'.repeat(200), 'csv').length, 84, 'a long title is cut to 80 characters');
eq(EK.filename('Año 字 😀', 'csv'), 'Año 字 😀.csv', 'letters of any alphabet stay');
eq(EK.filename('notes', '../sh'), 'notes.sh', 'an extension is letters and digits only');

// ---- XLSX and ZIP: on the vendored libraries, read back by other hands -------
{
  const { readZip, crc32 } = await import('./_zip-read.mjs');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  eq(crc32(Buffer.from('123456789')), 0xCBF43926, 'the reader\'s own CRC-32 gets the check value for "123456789"');

  // One context with both libraries and a second copy of export.js: the
  // vendored files are browser builds and want `window` to be the global.
  const g = { Blob, setTimeout, clearTimeout, Promise };
  g.window = g; g.self = g;
  vm.createContext(g);
  for (const f of ['_shared/vendor/xlsx/xlsx.full.min.js', '_shared/vendor/jszip/jszip.min.js', '_shared/export.js']) vm.runInContext(fs.readFileSync(path.join(site, f), 'utf8'), g);
  const K = g.ExportKit;
  const bytesOf = async blob => Buffer.from(await blob.arrayBuffer());
  const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, '&');
  /** A workbook read from its own XML: { names, sheets: [{ A1: { t, v, s } }], xml }. */
  function readXlsx(bytes) {
    const files = Object.fromEntries(readZip(bytes).map(e => [e.name, e]));
    const text = n => files[n] ? files[n].data.toString('utf8') : '';
    const strings = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>|<t[^>]*\/>/g)].map(t => unxml(t[1] || '')).join(''));
    const names = [...text('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(m => unxml(m[1]));
    const sheets = names.map((_, i) => {
      const xml = text(`xl/worksheets/sheet${i + 1}.xml`), cells = {};
      for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const t = (/ t="([^"]*)"/.exec(m[2]) || [])[1] || 'n', s = (/ s="([^"]*)"/.exec(m[2]) || [])[1];
        const v = (/<v>([\s\S]*?)<\/v>/.exec(m[3] || '') || [])[1];
        cells[m[1]] = { t, v: t === 's' ? strings[+v] : t === 'n' ? Number(v) : unxml(v || ''), s: s === undefined ? 0 : +s };
      }
      return cells;
    });
    const styles = text('xl/styles.xml');
    const fmts = Object.fromEntries([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map(m => [m[1], unxml(m[2])]));
    const xfs = [...((/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles) || [])[1] || '').matchAll(/<xf numFmtId="(\d+)"/g)].map(m => fmts[m[1]] || m[1]);
    return { files, names, sheets, xfs, allXml: Object.values(files).filter(e => /\.xml$/.test(e.name)).map(e => e.data.toString('utf8')).join('\n') };
  }

  // XLSX.
  const day = new Date(2026, 9, 5), moment = new Date(2026, 9, 5, 14, 30, 0);
  const rows = [
    ['Name', 'Score', 'When', 'Flag'],
    ['=SUM(B2:B9)', 3.5, day, true],
    ['-x <&> "q" \'a\'', -5, moment, false],
    ['Zoë 字 😀', 0, new Date(NaN), null],
    ['00123', NaN, '', undefined],
    ['line one\nline two', 1e21, '@cmd', '+1'],
  ];
  const blob = K.toXlsx(rows);
  eq([blob instanceof Blob, blob.type], [true, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], 'toXlsx returns a Blob of the xlsx type');
  eq(K.MIME.xlsx, blob.type, 'which is ExportKit.MIME.xlsx');
  const xbytes = await bytesOf(blob);
  eq([...xbytes.subarray(0, 4)], [0x50, 0x4B, 3, 4], 'the file is a zip');
  const xentries = readZip(xbytes);
  ok(xentries.every(e => e.crcOk), 'every part\'s CRC-32 is right, worked out by the reader');
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml', 'xl/styles.xml'])
    ok(xentries.some(e => e.name === part), `the package has ${part}`);
  const book = readXlsx(xbytes), S = book.sheets[0];
  eq(book.names, ['Sheet1'], 'bare rows are one sheet, Sheet1');
  eq([S.A1, S.B1, S.C1, S.D1].map(c => [c.t, c.v]), [['s', 'Name'], ['s', 'Score'], ['s', 'When'], ['s', 'Flag']], 'the first row is four shared strings');
  eq([S.A2.t, S.A2.v], ['s', '=SUM(B2:B9)'], 'a typed formula is a string cell with its text whole, no apostrophe');
  eq([S.A3.t, S.A3.v], ['s', '-x <&> "q" \'a\''], 'markup characters come back as typed');
  eq([S.A4.t, S.A4.v], ['s', 'Zoë 字 😀'], 'so do an umlaut, a CJK character and an emoji');
  eq([S.A5.t, S.A5.v], ['s', '00123'], 'typed digits stay text and keep their zeros');
  eq([S.A6.t, S.A6.v], ['s', 'line one\nline two'], 'a line break inside a cell is kept');
  eq([S.C6.v, S.D6.v, S.C6.t, S.D6.t], ['@cmd', '+1', 's', 's'], '@ and + cells are strings too');
  eq([S.B2, S.B3, S.B4, S.B6].map(c => [c.t, c.v]), [['n', 3.5], ['n', -5], ['n', 0], ['n', 1e21]], 'numbers are number cells');
  eq([S.D2.t, S.D2.v, S.D3.t, S.D3.v], ['b', '1', 'b', '0'], 'booleans are boolean cells');
  eq([S.C2.t, S.C2.v, book.xfs[S.C2.s]], ['n', 46300, 'yyyy-mm-dd'], '5 October 2026 is serial 46300, shown as a date');
  near(S.C3.v, 46300 + 14.5 / 24, 'half past two that afternoon is that serial and 14.5 hours', 1e-9);
  eq(book.xfs[S.C3.s], 'yyyy-mm-dd hh:mm:ss', 'shown with its time');
  eq([S.C4, S.D4, S.B5, S.C5, S.D5], [undefined, undefined, undefined, undefined, undefined], 'a bad date, null, NaN, an empty string and undefined write no cell');
  ok(!/<f[ >\/]/.test(book.allXml), 'there is no formula element anywhere in the package');
  ok(/<dimension ref="A1:D6"\/>/.test(book.files['xl/worksheets/sheet1.xml'].data.toString('utf8')), 'the sheet\'s dimension is A1:D6');

  // The same file through SheetJS's own reader, as a second opinion.
  const again = g.XLSX.read(new (vm.runInContext('Uint8Array', g))(xbytes), { type: 'array', cellDates: false });
  const first = again.Sheets[again.SheetNames[0]];
  eq([first.A2.t, first.A2.v, first.A2.f], ['s', '=SUM(B2:B9)', undefined], 'SheetJS reads the typed formula back as a string with no formula');
  eq([first.B3.v, first.C2.v, first.C2.z || first.C2.w, first.D2.v], [-5, 46300, first.C2.z ? 'yyyy-mm-dd' : '2026-10-05', true], 'and the number, the date and the boolean as written');

  // Named sheets, columns and Excel's rules for a name.
  const multi = K.toXlsx([
    { name: 'Period 1: [A/B]*?\\', rows: [{ n: 'Ines Okafor', s: 9 }, { n: 'Tavi Brandt', s: 7 }], columns: [{ key: 'n', label: 'Student' }, { key: 's', label: 'Score' }] },
    { name: 'period 1 ab', rows: [['x']] },
    { name: '', rows: [] },
    { name: 'A very long sheet name that runs well past the limit', rows: [[1]] },
    { name: 'A very long sheet name that runs well past the limit', rows: [[2]] },
    { name: "'quoted'", rows: [[3]] },
  ]);
  const mb = readXlsx(await bytesOf(multi));
  eq(mb.names, ['Period 1 AB', 'period 1 ab (2)', 'Sheet3', 'A very long sheet name that run', 'A very long sheet name that (2)', 'quoted'],
     'names lose [ ] : * ? / \\ and edge apostrophes, are cut to 31, are never empty, and a repeat (case-blind) gets (2)');
  ok(mb.names.every(n => n.length <= 31), 'no name is over 31 characters');
  eq([mb.sheets[0].A1.v, mb.sheets[0].B1.v, mb.sheets[0].A3.v, mb.sheets[0].B3.v], ['Student', 'Score', 'Tavi Brandt', 7], 'columns give the header row and the order');
  eq(Object.keys(mb.sheets[2]), [], 'a sheet with no rows is an empty sheet, not an error');
  eq(readXlsx(await bytesOf(K.toXlsx({ name: 'Only', rows: [['a']] }))).names, ['Only'], 'one sheet object is one sheet');
  eq(readXlsx(await bytesOf(K.toXlsx([]))).names, ['Sheet1'], 'no rows at all is one empty sheet');
  eq(readXlsx(await bytesOf(K.toXlsx([{ rows: 'not rows' }, { b: 2 }]))).sheets[0].A1.v, 'rows', 'a list of objects without row lists is rows, not sheets');
  let threw = '';
  try { EK.toXlsx([['a']]); } catch (e) { threw = String(e.message); }
  ok(/SheetJS is not loaded/.test(threw) && threw.includes('_shared/vendor/xlsx/xlsx.full.min.js'), 'with no SheetJS on the page toXlsx throws, naming the vendored file');
  ctx.window.Blob = Blob;
  eq(readXlsx(await bytesOf(EK.toXlsx([['handed in']], { XLSX: g.XLSX }))).sheets[0].A1.v, 'handed in', 'the library can be handed in as opts.XLSX');

  // ZIP. Typed arrays are made inside the context: JSZip tells an array by
  // its own realm's constructor. A Blob and a canvas need a browser, and
  // smoke-export.mjs has them.
  const u8 = vm.runInContext('new Uint8Array([0, 1, 2, 253, 254, 255])', g);
  const big = 'The quick brown fox. '.repeat(400);
  const files = [
    { name: 'notes.txt', data: 'héllo, 字 😀\n' },
    { name: 'sets/period 1/roster.csv', data: K.toCsv([['a', 'b']]) },
    { name: 'sets\\period 1\\roster.csv', data: 'second' },
    { name: 'SETS-period 1-roster.csv', data: 'third' },
    { name: 'bytes.bin', data: u8 },
    { name: 'buffer.bin', data: u8.buffer },
    { name: 'Añо 字 😀.txt', data: big },
    { name: '', data: '' },
    { name: '../../etc/passwd', data: 'x' },
    { name: 'noext', data: 'a' },
    { name: 'noext', data: 'b' },
    { data: null },
  ];
  const want = [
    ['notes.txt', Buffer.from('héllo, 字 😀\n')],
    ['sets-period 1-roster.csv', Buffer.from(BOM + 'a,b\r\n')],
    ['sets-period 1-roster (2).csv', Buffer.from('second')],
    ['SETS-period 1-roster (3).csv', Buffer.from('third')],
    ['bytes.bin', Buffer.from([0, 1, 2, 253, 254, 255])],
    ['buffer.bin', Buffer.from([0, 1, 2, 253, 254, 255])],
    ['Añо 字 😀.txt', Buffer.from(big)],
    ['file8', Buffer.alloc(0)],
    ['etc-passwd', Buffer.from('x')],
    ['noext', Buffer.from('a')],
    ['noext (2)', Buffer.from('b')],
    ['file12', Buffer.alloc(0)],
  ];
  const promise = K.toZip(files);
  ok(promise && typeof promise.then === 'function', 'toZip returns a promise');
  const zblob = await promise;
  eq([zblob instanceof Blob, zblob.type, K.MIME.zip], [true, 'application/zip', 'application/zip'], 'of a Blob of type application/zip');
  const zbytes = await bytesOf(zblob);
  const entries = readZip(zbytes);
  eq(entries.map(e => e.name), want.map(w => w[0]), 'names: separators are hyphens, nothing climbs out with .., a repeat (case-blind) gets (2) before its extension, a missing name is fileN');
  ok(entries.every(e => !/[\\/]/.test(e.name)), 'no entry name has a path separator');
  ok(entries.every(e => e.name === e.localName), 'each local header carries the name its directory entry does');
  ok(entries.every((e, i) => e.data.equals(want[i][1])), 'every entry\'s bytes are the bytes handed in');
  ok(entries.every(e => e.crcOk), 'every stored CRC-32 is the CRC-32 of those bytes, worked out by the reader');
  eq(entries.filter(e => /[^\x00-\x7f]/.test(e.name)).map(e => e.utf8), [true], 'the name outside ASCII is flagged UTF-8 (general purpose bit 11)');
  ok(entries[6].method === 8 && zbytes.length < big.length, 'a long text is deflated: the whole zip is smaller than that one file');
  eq(readZip(await bytesOf(await K.toZip([]))).length, 0, 'no files is an empty zip, and still a zip');
  eq(readZip(await bytesOf(await K.toZip(null))).length, 0, 'so is nothing at all');
  threw = '';
  try { EK.toZip([{ name: 'a', data: 'b' }]); } catch (e) { threw = String(e.message); }
  ok(/JSZip is not loaded/.test(threw) && threw.includes('_shared/vendor/jszip/jszip.min.js'), 'with no JSZip on the page toZip throws, naming the vendored file');
  eq(readZip(await bytesOf(await EK.toZip([{ name: 'in.txt', data: 'handed in' }], { JSZip: g.JSZip }))).map(e => [e.name, e.data.toString()]), [['in.txt', 'handed in']], 'the library can be handed in as opts.JSZip');
  threw = '';
  ctx.window.URL = URL; // everything a page has but the document
  try { EK.download('x', 'x.txt'); } catch (e) { threw = String(e.message); }
  ok(/not a page that can save a file/.test(threw), 'download() outside a page says so instead of failing on document');

  // Outside readers, when the machine has them. The checks above do not
  // depend on these.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-kit-zip-'));
  const zfile = path.join(dir, 'kit.zip'), xfile = path.join(dir, 'kit.xlsx');
  fs.writeFileSync(zfile, zbytes); fs.writeFileSync(xfile, xbytes);
  const used = [];
  if (spawnSync('unzip', ['-v']).status === 0) {
    used.push('unzip');
    const t = spawnSync('unzip', ['-t', zfile], { encoding: 'utf8' });
    ok(t.status === 0 && /No errors detected/.test(t.stdout), 'unzip -t finds no errors in the zip');
    eq(spawnSync('unzip', ['-p', zfile, 'notes.txt']).stdout.equals(want[0][1]), true, 'unzip -p hands back notes.txt byte for byte');
    eq(spawnSync('unzip', ['-p', zfile, 'sets-period 1-roster (2).csv'], { encoding: 'utf8' }).stdout, 'second', 'and the renamed repeat');
    ok(spawnSync('unzip', ['-t', xfile], { encoding: 'utf8' }).status === 0, 'unzip -t finds no errors in the workbook');
  }
  const py = spawnSync('python3', ['-c', 'import zipfile, json, sys, xml.dom.minidom\n' +
    'z = zipfile.ZipFile(sys.argv[1]); x = zipfile.ZipFile(sys.argv[2])\n' +
    '[xml.dom.minidom.parseString(x.read(n)) for n in x.namelist() if n.endswith(".xml") or n.endswith(".rels")]\n' +
    'print(json.dumps({"bad": z.testzip(), "xbad": x.testzip(), "names": z.namelist(), "sizes": [i.file_size for i in z.infolist()], "crcs": [i.CRC for i in z.infolist()], "text": z.read("notes.txt").decode("utf-8")}))',
    zfile, xfile], { encoding: 'utf8' });
  if (py.status === 0) {
    used.push('python3 zipfile');
    const got = JSON.parse(py.stdout);
    eq([got.bad, got.xbad], [null, null], 'Python\'s zipfile checks every CRC in the zip and in the workbook, and every XML part of the workbook parses');
    eq(got.names, want.map(w => w[0]), 'Python reads the same names, the UTF-8 one included');
    eq(got.sizes, want.map(w => w[1].length), 'and the same sizes');
    eq(got.crcs, want.map(w => crc32(w[1])), 'and the CRC-32 this suite works out for each file');
    eq(got.text, 'héllo, 字 😀\n', 'and the same text');
  } else if (spawnSync('python3', ['--version']).status === 0) {
    ok(false, 'python3 is here and could not read the files: ' + String(py.stderr).slice(-300));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('  NOTE outside readers used: ' + (used.join(', ') || 'none on this machine') + '; the reader written in _zip-read.mjs ran either way. No spreadsheet program was available to open the workbook.');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
