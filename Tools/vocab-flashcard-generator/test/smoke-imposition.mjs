// smoke-imposition.mjs — 040's double-sided cards are cut into pages and
// turned over by the shared export layer (Path 7 P4).
//
//   node Tools/vocab-flashcard-generator/test/smoke-imposition.mjs
//
// 040 wrote paginate() and mirrorPageRows() first, in vfg-layout.js; they were
// copied to 064, moved to _shared/duplex-print.js, and became ExportKit's.
// 040 kept its own copy until now. It asks ExportKit for the cut into pages
// (paginate) and for the cell behind each front (mirrorPage, told that the
// sheet is upright and turned on its long edge); vfg-layout.js has no copy,
// and _shared/duplex-print.js, which no page loaded, is deleted.
//
// The tool offers one way to turn the paper: the long edge of an upright
// Letter sheet (the alignment test's back page says so). There is no setting
// for the short edge, so there is one edge to check, not two.
//
// What this pins:
//   - the page loads export.js; neither it nor vfg-layout.js has the two
//     functions, and nothing in the tree names duplex-print.js as a file
//   - for each grid the tool offers, with a full last page and a short one:
//     the page asked ExportKit (calls counted, each with the grid, upright,
//     long edge), and on the paper every definition is behind its own word:
//     same row, and as far from the right edge as the word is from the left.
//     That is measured off the printed boxes and worked out here from the
//     turn itself, not read back from the function under test
//   - a blank card is backed by a blank card
//   - the alignment test is cut by the same call as the cards
//   - fold-over and word-wall sheets are cut into pages by ExportKit and have
//     no backs
//   - Chromium's PDF has a sheet for every page, on Letter
//
// The old page against this one (page count, paper, every card's box and
// text, and the raster at 96 dpi) was compared once, in 160 states, when the
// adoption was made: identical. That comparison is not in this suite; the
// numbers smoke-print.mjs holds are the old page's and it passes unedited.
//
// print() is stubbed. Nothing here has been checked on a duplex printer.
//
// Exits 1 on any failure.

/* global VocabLayout -- 040's own module global, read inside page.evaluate() */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8482;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '040-vocab-flashcard-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pdfPaper = buf => [...new Set(buf.toString('latin1').match(/\/MediaBox\s*\[[^\]]*\]/g) || [])].join(';');

// Made-up vocabulary: word N's definition names N, so a back can be matched
// to its front by what is printed on it.
const wordsOf = n => Array.from({ length: n }, (_, i) => `term ${i + 1}: the made-up meaning of word number ${i + 1}.`).join('\n');

const DEFAULTS = {
  name: 'Made-up list', mode: 'flashcards', flashCols: 2, flashRows: 4, cardSizePreset: 'grid', flashLayout: 'duplex',
  wallPerPage: 2, wallShowDef: true, sortOrder: 'none', shuffle: false, showGuides: true, bingoCount: 4, bingoField: 'term',
};

console.log('040 — the cut into pages and the backs are ExportKit\'s');

// ---- the files ---------------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/<script src="\.\.\/_shared\/export\.js"><\/script>/.test(src), 'the page loads _shared/export.js');
ok(src.indexOf('_shared/export.js') < src.indexOf('<style>'), 'in the head, before its own script runs');
ok(!/duplex-print\.js/.test(src), 'and does not load _shared/duplex-print.js');
eq((code.match(/ExportKit\.paginate\(/g) || []).length, 3, 'flashcards, fold-over cards and word-wall cards are each cut into pages by ExportKit.paginate()');
eq((code.match(/ExportKit\.mirrorPage\(/g) || []).length, 1, 'one call to ExportKit.mirrorPage() places every back');
eq((code.match(/backsOf\(/g) || []).length, 3, 'which the cards and the alignment test both go through (one definition, two callers)');
ok(/var DUPLEX = \{ orientation: 'portrait', flip: 'long' \};/.test(code), 'the sheet is upright and turned on its long edge, said once');
ok(!/VocabLayout\.(paginate|mirrorPageRows)\b/.test(code), 'the page does not call a paginate or mirrorPageRows of VocabLayout\'s');
ok(!/DuplexPrint/.test(code), 'or name DuplexPrint');
ok(!/function\s+(paginate|mirrorPageRows|mirrorPage)\b/.test(code), 'or write one of its own');

const layoutSrc = fs.readFileSync(path.join(SITE, 'Tools', 'vocab-flashcard-generator', 'vfg-layout.js'), 'utf8');
const layoutCode = layoutSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/paginate|mirrorPageRows/.test(layoutCode), 'vfg-layout.js has no copy of either function');
{
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(layoutSrc, ctx);
  eq(Object.keys(ctx.window.VocabLayout).sort(), ['computeCardSizeIn', 'pageSize', 'parseWordList', 'shuffleItems', 'sortItems'], 'VocabLayout is the word list and the card size, nothing else');
}

ok(!fs.existsSync(path.join(SITE, '_shared', 'duplex-print.js')), '_shared/duplex-print.js is gone');
{
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  ok(!/duplex-print/.test(sw), 'the service worker does not precache it');
  eq((sw.match(/"_shared\/export\.js"/g) || []).length, 2, 'and has export.js in both tiers');
  const pages = [path.join(SITE, 'index.html'), ...fs.readdirSync(path.join(SITE, 'Tools')).filter(f => f.endsWith('.html')).map(f => path.join(SITE, 'Tools', f))];
  const loaders = pages.filter(p => /<script[^>]*duplex-print\.js/.test(fs.readFileSync(p, 'utf8'))).map(p => path.basename(p));
  eq(loaders, [], `none of the ${pages.length} pages loads it`);
  ok(pages.length > 80, 'every page was read');
  ok(!/DuplexPrint/.test(fs.readFileSync(path.join(SITE, 'eslint.config.js'), 'utf8')), 'and ESLint has no global for it');
}

// ---- in the browser ------------------------------------------------------------
async function open(browser, st, theme) {
  const page = await prepPage(browser, BASE, { width: 778, height: 900 });
  await page.addInitScript(([saved, dark]) => {
    window.__printCalls = 0; window.print = () => { window.__printCalls++; };
    if (!localStorage.getItem('gvb-vocab-flashcards:list')) {
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

/** Puts a counter in front of ExportKit's two functions, from now on. */
const listen = page => page.evaluate(() => {
  const real = window.ExportKit, calls = window.__ek = { paginate: [], mirrorPage: [] };
  window.ExportKit = Object.assign({}, real, {
    paginate(items, perPage) { calls.paginate.push({ n: items.length, perPage }); return real.paginate.apply(real, arguments); },
    mirrorPage(items, opts) { calls.mirrorPage.push({ n: items.length, opts: { ...opts } }); return real.mirrorPage.apply(real, arguments); },
  });
});

/** Every page of the sheet in print media: its cards' boxes from the page's
    own left and top, and what is printed on each. */
const sheet = page => page.evaluate(() => {
  const r = v => Math.round(v * 10) / 10;
  return [...document.getElementById('printArea').children].map(p => {
    const pb = p.getBoundingClientRect();
    return { w: r(pb.width), cards: [...p.querySelectorAll('.pk-card')].map(c => {
      const b = c.getBoundingClientRect();
      return { left: r(b.left - pb.left), right: r(pb.right - b.right), top: r(b.top - pb.top), w: r(b.width), text: c.textContent, blank: c.classList.contains('blank') };
    }) };
  });
});
/** Which row of its page a card is in, read off the paper: the count of
    distinct tops above it. */
const rowsOf = cards => { const tops = [...new Set(cards.map(c => c.top))].sort((a, b) => a - b); return cards.map(c => tops.indexOf(c.top)); };

const GRIDS = [
  { name: '1 x 1', st: { flashCols: 1, flashRows: 1 }, cols: 1, rows: 1 },
  { name: '1 x 3', st: { flashCols: 1, flashRows: 3 }, cols: 1, rows: 3 },
  { name: '2 x 4', st: {}, cols: 2, rows: 4 },
  { name: '3 x 3', st: { flashCols: 3, flashRows: 3 }, cols: 3, rows: 3 },
  { name: '3 x 5', st: { flashCols: 3, flashRows: 5 }, cols: 3, rows: 5 },
  { name: '4 x 6', st: { flashCols: 4, flashRows: 6 }, cols: 4, rows: 6 },
  { name: '3x5 index card', st: { cardSizePreset: '3x5' }, cols: 2, rows: 2, exact: true },
  { name: '4x6 index card', st: { cardSizePreset: '4x6' }, cols: 2, rows: 1, exact: true },
];
const TURN = { orientation: 'portrait', flip: 'long' };

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const G of GRIDS) {
    const per = G.cols * G.rows;
    // One word, a page and a bit (a short last page), and exactly two pages.
    for (const n of [...new Set([1, per + Math.ceil(per / 2), per * 2])]) {
      const what = `${theme}, ${G.name}, ${n} word${n === 1 ? '' : 's'}`;
      const page = await open(browser, { ...DEFAULTS, ...G.st, words: wordsOf(n) }, theme);
      try {
        eq(await page.evaluate(() => [typeof ExportKit, typeof window.DuplexPrint, typeof VocabLayout.paginate, typeof VocabLayout.mirrorPageRows]),
          ['object', 'undefined', 'undefined', 'undefined'], `${what}: ExportKit is on the page; DuplexPrint and VocabLayout's two functions are not`);
        await listen(page);
        await page.click('#printBtn');
        eq(await page.evaluate(() => window.__printCalls), 1, `${what}: the button prints once`);
        const calls = await page.evaluate(() => window.__ek);
        const sides = Math.ceil(n / per);
        ok(calls.paginate.length >= 1 && calls.paginate.every(c => c.n === n && c.perPage === per), `${what}: ExportKit.paginate() cut the ${n} into pages of ${per} (${JSON.stringify(calls.paginate[0])})`);
        ok(calls.mirrorPage.length >= sides && calls.mirrorPage.length % sides === 0, `${what}: ExportKit.mirrorPage() was asked for each of the ${sides} page(s) (${calls.mirrorPage.length} calls)`);
        ok(calls.mirrorPage.every(c => c.n === per && JSON.stringify(c.opts) === JSON.stringify({ cols: G.cols, rows: G.rows, ...TURN })), `${what}: each time for a full page of ${per}, ${G.cols} by ${G.rows}, upright, long edge (${JSON.stringify((calls.mirrorPage[0] || {}).opts)})`);

        await page.emulateMedia({ media: 'print' });
        const pages = await sheet(page);
        eq(pages.length, sides * 2, `${what}: ${sides} front page(s), then ${sides} back page(s)`);
        ok(pages.every(p => p.cards.length === per), `${what}: every page a full grid of ${per}`);
        const fronts = pages.slice(0, sides), backs = pages.slice(sides);
        eq(fronts.flatMap(p => p.cards).filter(c => !c.blank).map(c => c.text), Array.from({ length: n }, (_, i) => `term ${i + 1}`), `${what}: the fronts are the words, in list order`);

        // The turn, worked out here. An upright sheet turned on its long edge
        // swaps left and right and keeps top and bottom: the back of a card
        // is in the same row, as far from the right edge as the card is from
        // the left.
        let behind = 0, wrong = [];
        fronts.forEach((fp, s) => {
          const bp = backs[s], fr = rowsOf(fp.cards), br = rowsOf(bp.cards);
          fp.cards.forEach((f, i) => {
            const j = bp.cards.findIndex((b, k) => br[k] === fr[i] && Math.abs(b.right - f.left) <= 0.6 && Math.abs(b.w - f.w) <= 0.6);
            const b = bp.cards[j];
            const num = (f.text.match(/^term (\d+)$/) || [])[1];
            const right = b && (f.blank ? b.blank && b.text === '' : !b.blank && b.text.includes(`word number ${num}.`) && !b.text.includes('term '));
            if (right && (!G.exact || Math.abs(b.top - f.top) <= 0.6)) behind++; else wrong.push(`page ${s + 1} card ${i + 1}`);
          });
        });
        eq(wrong, [], `${what}: every definition is behind its own word when the sheet is turned on its long edge, and every blank behind a blank`);
        eq(behind, sides * per, `${what}: all ${sides * per} of them`);
        if (G.cols > 1 && n >= 2) {
          const f = fronts[0].cards, b = backs[0].cards;
          ok(b[G.cols - 1].text.includes('word number 1.') && !b[0].text.includes('word number 1.'), `${what}: so the first definition is at the right end of its row, not the left`);
          ok(Math.abs(f[0].left - b[G.cols - 1].right) <= 0.6 && Math.abs(f[0].left - b[0].left) <= 0.6, `${what}: the grid is as far from one edge of the paper as from the other (${f[0].left} and ${b[G.cols - 1].right} px)`);
        }

        const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
        eq(pdfPageCount(buf), sides * 2, `${what}: Chromium's PDF is a sheet side for every page`);
        eq(pdfPaper(buf), '/MediaBox [0 0 612 792]', `${what}: on Letter, upright`);
        eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      } catch (e) {
        ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
      } finally {
        await page.context().close();
      }
    }
  }
}

// ---- the alignment test is cut the same way ------------------------------------
for (const G of GRIDS) {
  const what = `alignment test, ${G.name}`;
  const per = G.cols * G.rows;
  const page = await open(browser, { ...DEFAULTS, ...G.st, words: wordsOf(3) });
  try {
    await listen(page);
    await page.click('#alignTestBtn');
    const calls = await page.evaluate(() => window.__ek);
    eq(calls.mirrorPage.map(c => [c.n, c.opts]), [[per, { cols: G.cols, rows: G.rows, ...TURN }]], `${what}: one call to ExportKit.mirrorPage(), with what the cards are cut with`);
    await page.emulateMedia({ media: 'print' });
    const pages = await sheet(page);
    eq(pages.length, 2, `${what}: a front and a back`);
    eq(pages[0].cards.map(c => c.text), Array.from({ length: per }, (_, i) => String(i + 1)), `${what}: the front is numbered in order`);
    const fr = rowsOf(pages[0].cards), br = rowsOf(pages[1].cards);
    const off = pages[0].cards.filter((f, i) => !pages[1].cards.some((b, k) => b.text === f.text && br[k] === fr[i] && Math.abs(b.right - f.left) <= 0.6)).map(f => f.text);
    eq(off, [], `${what}: every number on the back is behind the same number on the front`);
    eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- one-sided sheets: cut into pages, no backs ---------------------------------
const ONE_SIDED = [
  { name: 'fold-over 2 x 4', st: { flashLayout: 'fold' }, per: 8, card: '.fold-card' },
  { name: 'fold-over 3 x 3', st: { flashLayout: 'fold', flashCols: 3, flashRows: 3 }, per: 9, card: '.fold-card' },
  { name: 'word wall, 1 to a page', st: { mode: 'wordwall', wallPerPage: 1 }, per: 1, card: '.wordwall-card' },
  { name: 'word wall, 2 to a page', st: { mode: 'wordwall', wallPerPage: 2 }, per: 2, card: '.wordwall-card' },
  { name: 'word wall, 4 to a page', st: { mode: 'wordwall', wallPerPage: 4 }, per: 4, card: '.wordwall-card' },
];
for (const O of ONE_SIDED) {
  for (const n of [1, O.per * 2 + 1]) {
    const what = `${O.name}, ${n} word${n === 1 ? '' : 's'}`;
    const page = await open(browser, { ...DEFAULTS, ...O.st, words: wordsOf(n) });
    try {
      await listen(page);
      await page.click('#printBtn');
      const calls = await page.evaluate(() => window.__ek);
      ok(calls.paginate.length >= 1 && calls.paginate.every(c => c.n === n && c.perPage === O.per), `${what}: ExportKit.paginate() cut the ${n} into pages of ${O.per}`);
      eq(calls.mirrorPage.length, 0, `${what}: and nothing was mirrored, there being no back`);
      await page.emulateMedia({ media: 'print' });
      const pages = await sheet(page);
      const want = Math.ceil(n / O.per);
      eq(pages.length, want, `${what}: ${want} page(s)`);
      const terms = await page.evaluate(sel => [...document.querySelectorAll('#printArea ' + sel + ' .term')].map(t => t.textContent), O.card);
      eq(terms, Array.from({ length: n }, (_, i) => `term ${i + 1}`), `${what}: every word once, in list order`);
      eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), want, `${what}: Chromium's PDF is ${want} page(s)`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
