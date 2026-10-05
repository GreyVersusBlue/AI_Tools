// smoke-print.mjs — 064 prints through the shared print kit (Path 7 P3).
//
//   node Tools/historical-trading-card-maker/test/smoke-print.mjs
//
// 064 is the kit's tenth adopter and the fourth card grid with a size of its
// own. A trading card is an exact size: 2.5 x 3.5 in (standard), 3.5 x 5 in
// (reference), or a third of a 7.7 in band and 3.4 in tall (fill). So every
// size is `PrintKit.renderCards(..., { cols, perPage }, ...)`, a
// `.pk-cards-own` grid whose cards take no height from the kit; the page
// keeps the card's `height`, `width` and `overflow: hidden`, its gap, and the
// standard and reference column widths. What went to the kit: the grid, the
// cut into pages of six or four, the page breaks, `break-inside`, the rule
// that hides the editor (`print-area.css`), `@page` (`setPage()`, 0.3 in) and
// the white sheet (`.pk-paper`).
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - "Print cards" builds every page of fronts and then every page of backs,
//     each padded to a full grid, the backs row-mirrored
//   - a printed card is the size and in the place it was on the old page
//     (measured on the page from `git show origin/main:` at the printable
//     width, 2026-10-04, before the adoption), and a page of cards with its
//     banner fits the paper
//   - Chromium's PDF page count, per state, in light and in dark. It is the
//     old page's wherever the deck is more than one page of cards. A deck of
//     one page printed THREE sheets on the old page (`was: 3` below): the
//     editor, hidden with `visibility`, kept its height and ran on to a third
//     sheet. It prints two now, the fronts and the backs
//   - a name typed as markup reaches the card as text
//   - only the sheet has a box on paper and the paper is white
//   - Ctrl+P (`beforeprint`) builds the sheet too
//
// print() is stubbed. Nothing here has been checked against a printer, and
// no card sleeve or nine-pocket page has been tried.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8476;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '064-historical-trading-card-maker.html';
const IN = 96;
// Letter less the 0.3 in page margin on each side.
const PAGE_W = 7.9 * IN, PAGE_H = 10.4 * IN;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 0.6) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ± ${tol})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

// Made-up cards only.
const LONG_CARD = {
  id: 'cx', name: 'Wilhelmina Featherstonehaugh-Abernathy of Quillhaven', image: null,
  stats: Array.from({ length: 9 }, (_, i) => ({ label: 'Stat ' + (i + 1), value: 'A made-up value that runs on for a while ' + i })),
  facts: Array.from({ length: 6 }, (_, i) => 'A made-up fact number ' + i + ' that is long enough to wrap over more than one line of the card back.'),
  theme: null, meta: { rarity: 'epic', setName: 'Invented Set', cardNo: 1, setSize: 9, stars: 4 },
};
const deck = (n, size, theme, long) => ({
  v: 2, settings: { size, theme },
  cards: Array.from({ length: n }, (_, i) => (long && i === 0) ? LONG_CARD : ({
    id: 'c' + i, name: 'Figure ' + (i + 1), image: null,
    stats: [{ label: 'Born', value: String(1700 + i) }, { label: 'From', value: 'Port Azul' }],
    facts: ['Made-up fact ' + (i + 1) + '.'], theme: null,
    meta: { rarity: ['common', 'rare', 'epic', 'legendary'][i % 4], setName: 'Invented Set', cardNo: i + 1, setSize: n, stars: i % 6 },
  })),
});

// A card on paper, in px at 96 to the inch, and where the first one sits from
// the left edge of the printable width: the old page's numbers.
const SIZE = {
  standard: { cols: 3, perPage: 6, w: 2.5 * IN, h: 3.5 * IN, left: 4.61, gap: 0.15 * IN, banner: true },
  fill: { cols: 3, perPage: 6, w: 233.59, h: 3.4 * IN, left: 9.41, gap: 0.2 * IN, banner: true },
  reference: { cols: 2, perPage: 4, w: 3.5 * IN, h: 5 * IN, left: 35.8, gap: 0.15 * IN, banner: false },
};

// `pages` is Chromium's PDF page count. `was` is what the old page printed for
// the same state where that differs (see the header).
const STATES = [
  { size: 'standard', n: 1, pages: 2, was: 3 },
  { size: 'standard', n: 6, pages: 2, was: 3 },
  { size: 'standard', n: 7, pages: 4 },
  { size: 'standard', n: 13, pages: 6 },
  { size: 'fill', n: 1, pages: 2, was: 3 },
  { size: 'fill', n: 6, pages: 2, was: 3 },
  { size: 'fill', n: 7, pages: 4 },
  { size: 'fill', n: 13, pages: 6 },
  { size: 'reference', n: 1, pages: 2, was: 3 },
  { size: 'reference', n: 6, pages: 4 },
  { size: 'reference', n: 7, pages: 4 },
  { size: 'reference', n: 13, pages: 8 },
  { size: 'standard', n: 4, long: true, pages: 2, was: 3 },
  { size: 'fill', n: 4, theme: 'parchment', long: true, pages: 2, was: 3 },
  { size: 'reference', n: 5, theme: 'blueprint', long: true, pages: 4 },
  { size: 'standard', n: 9, theme: 'science', pages: 4 },
].map(s => ({ theme: 'classic', ...s })).map(s => ({ ...s, name: `${s.n} ${s.size} card${s.n === 1 ? '' : 's'}, ${s.theme}${s.long ? ', one long' : ''}` }));

/** Opens 064 at the printable width of the page, so a card measured in print
    media is where it is on paper. */
async function open(browser, doc, theme) {
  const page = await prepPage(browser, BASE, { width: Math.round(PAGE_W), height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([value, dark]) => {
    localStorage.setItem('htcm:list', JSON.stringify(['Invented deck']));
    localStorage.setItem('htcm:data:Invented deck', value);
    localStorage.setItem('htcm:current', 'Invented deck');
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [JSON.stringify(doc), theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

/** Row-mirrored, as the backs are: each row of `cols` reversed. */
function mirror(list, cols) {
  const out = [];
  for (let i = 0; i < list.length; i += cols) out.push(...list.slice(i, i + cols).reverse());
  return out;
}

console.log('064 — the trading cards print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print\s*\{/.test(src), 'has no @media print block of its own');
ok(!/@page\s*\{/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(/PrintKit\.setPage\(\{ paper: 'letter', orientation: 'portrait', margin: '0\.3in' \}\)/.test(src), 'and asks the kit for Letter at its own 0.3 in');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/#printArea\s*\{\s*display/.test(src) && !/page-break|break-inside|\.print-page/.test(src), 'the hidden sheet, the page breaks and break-inside are the shared files\', not the page\'s');
ok(!/printArea\.innerHTML/.test(src), 'the sheet is not one string written into #printArea');
ok(/<div id="printArea" class="pk-paper"><\/div>\s*\n\s*<script/.test(src) && /<\/div>\s*\n\s*<div id="printArea"/.test(src), '#printArea is a .pk-paper, written as a child of <body>');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const size = SIZE[s.size];
    const doc = deck(s.n, s.size, s.theme, s.long);
    const page = await open(browser, doc, theme);
    try {
      const names = doc.cards.map(c => c.name);
      const sheets = Math.ceil(s.n / size.perPage);
      const padded = names.concat(Array(sheets * size.perPage - s.n).fill(''));
      const wantFronts = padded;
      const wantBacks = [];
      for (let i = 0; i < padded.length; i += size.perPage) wantBacks.push(...mirror(padded.slice(i, i + size.perPage), size.cols));

      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      eq(await page.locator('#printArea > *').count(), 0, `${what}: and empty until something prints`);
      await page.click('#printBtn');
      await settle(page, 200);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      const built = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const kids = [...area.children];
        const cardName = c => { const n = c.querySelector('.cname'); return n ? n.textContent : ''; };
        return {
          area: area.className,
          order: kids.map(k => k.classList.contains('pk-cards') ? 'G' : k.classList.contains('section-label') ? 'L' : k.classList.contains('htcm-defs') ? 'D' : '?').join(''),
          grids: [...new Set(kids.filter(k => k.classList.contains('pk-cards')).map(g => g.className))].join('|'),
          cols: [...new Set(kids.filter(k => k.classList.contains('pk-cards')).map(g => g.style.getPropertyValue('--pk-cols')))].join('|'),
          perGrid: [...new Set(kids.filter(k => k.classList.contains('pk-cards')).map(g => g.children.length))].join('|'),
          stray: area.querySelectorAll('.trading-card').length - area.querySelectorAll('.pk-cards > .trading-card.pk-card').length,
          fronts: [...area.querySelectorAll('.trading-card:not(.back)')].map(cardName),
          backs: [...area.querySelectorAll('.trading-card.back')].length,
          backOrder: [...area.querySelectorAll('.trading-card.back')].map(c => c.classList.contains('blank') ? '' : '#'),
          frontsFirst: !area.querySelector('.trading-card.back ~ .trading-card:not(.back)') && !area.querySelector('.pk-cards:has(.back) ~ .pk-cards:has(.trading-card:not(.back))'),
          themed: [...area.querySelectorAll('.trading-card:not(.blank)')].every(c => /\btheme-/.test(c.className)),
          labels: [...area.querySelectorAll('.section-label')].map(l => l.textContent),
        };
      });
      eq(built.area, `pk-paper size-${s.size}`, `${what}: #printArea is the kit's paper and carries the card size`);
      eq(built.order, 'DL' + 'G'.repeat(sheets) + 'L' + 'G'.repeat(sheets), `${what}: the defs, the fronts' banner and ${sheets} page(s) of fronts, the backs' banner and ${sheets} of backs`);
      eq(built.grids, 'pk-cards pk-page pk-cards-own card-grid', `${what}: each page of cards is a kit grid of the tool's own`);
      eq(built.cols, String(size.cols), `${what}: ${size.cols} across`);
      eq(built.perGrid, String(size.perPage), `${what}: every page padded to ${size.perPage} cards`);
      eq(built.stray, 0, `${what}: every card is a kit card, directly in a grid`);
      eq(built.fronts.join('|'), wantFronts.join('|'), `${what}: the fronts in deck order, blanks after`);
      eq(built.backs, wantBacks.length, `${what}: as many backs as fronts`);
      eq(built.backOrder.join(''), wantBacks.map(n => n ? '#' : '').join(''), `${what}: the backs row-mirrored, so a back lies under its front`);
      ok(built.frontsFirst, `${what}: every page of fronts before any page of backs`);
      ok(built.themed, `${what}: each card carries its theme`);
      eq(built.labels.join('|'), 'Card fronts|Card backs (row-mirrored to align when you flip the printed front stack and reprint)', `${what}: the two banners`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const rect = e => e.getBoundingClientRect();
        const grids = [...area.querySelectorAll('.pk-cards')];
        const first = grids[0], label = area.querySelector('.section-label');
        return {
          bg: getComputedStyle(area).backgroundColor,
          ink: getComputedStyle(area).color,
          areaW: rect(area).width,
          cards: [...area.querySelectorAll('.trading-card')].map(c => ({ w: rect(c).width, h: rect(c).height, clip: getComputedStyle(c).overflow })),
          firstRow: [...first.children].slice(0, 3).map(c => rect(c).left),
          rows: [...new Set([...first.children].map(c => Math.round(rect(c).top)))].length,
          gridH: grids.map(g => rect(g).height),
          bannerShown: getComputedStyle(label).display !== 'none',
          // from the top of the banner's margin box to the foot of the grid
          firstPageH: rect(first).bottom - (getComputedStyle(label).display === 'none' ? rect(first).top : rect(label).top - parseFloat(getComputedStyle(label).marginTop)),
          breaks: grids.map(g => getComputedStyle(g).breakAfter).join(','),
          keep: [...new Set([...area.querySelectorAll('.trading-card')].map(c => getComputedStyle(c).breakInside))].join(','),
          outside: [...document.body.querySelectorAll('*')].filter(e => !area.contains(e) && e !== area && e.getClientRects().length).length,
        };
      });
      eq(m.bg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      eq(m.ink, 'rgb(0, 0, 0)', `${what}: and the sheet's own text black`);
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper`);
      ok(m.cards.every(c => Math.abs(c.w - size.w) <= 0.6), `${what}: every card is ${(size.w / IN).toFixed(2)} in wide, as before (first ${m.cards[0].w})`);
      ok(m.cards.every(c => Math.abs(c.h - size.h) <= 0.6), `${what}: every card is ${(size.h / IN).toFixed(2)} in tall, as before (first ${m.cards[0].h})`);
      ok(m.cards.every(c => c.clip === 'hidden'), `${what}: a card is still an exact size, clipped, by the tool's own rule`);
      near(m.firstRow[0], size.left, `${what}: the first card sits where it did from the left edge`, 0.6);
      near(m.firstRow[1] - m.firstRow[0], size.w + size.gap, `${what}: with the tool's own gap between cards`, 0.6);
      eq(m.rows, 2, `${what}: two rows to a page`);
      ok(m.gridH.every(h => Math.abs(h - (2 * size.h + size.gap)) <= 0.8), `${what}: a page of cards is two rows and one gap tall`);
      eq(m.bannerShown, size.banner, `${what}: the banners ${size.banner ? 'print' : 'are dropped, there being no room'}`);
      ok(m.firstPageH <= PAGE_H + 0.5, `${what}: the first page, banner and cards, fits the paper (${(m.firstPageH / IN).toFixed(2)} of ${(PAGE_H / IN).toFixed(2)} in)`);
      ok(m.areaW <= PAGE_W + 0.5, `${what}: and the sheet is no wider than the paper`);
      eq(m.breaks, Array(2 * sheets - 1).fill('page').concat('auto').join(','), `${what}: a page break after every page of cards but the last`);
      eq(m.keep, 'avoid', `${what}: no card is split over two sheets`);

      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
      eq(pdfPageCount(pdf), s.pages, `${what}: Chromium's PDF is ${s.pages} page(s)${s.was ? `, the fronts and the backs (the old page ran on to ${s.was})` : ', as on the old page'}`);
      eq(s.pages, 2 * sheets, `${what}: which is one sheet per page of fronts and one per page of backs`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- Ctrl+P, with no button pressed -----------------------------------------
for (const theme of ['light', 'dark']) {
  const page = await open(browser, deck(7, 'standard', 'classic'), theme);
  try {
    eq(await page.locator('#printArea > *').count(), 0, `Ctrl+P, ${theme}: the sheet starts empty`);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(pdf), 4, `Ctrl+P, ${theme}: beforeprint builds the sheet, and it is the button's four pages`);
    eq(await page.locator('#printArea .pk-cards > .trading-card.pk-card').count(), 24, `Ctrl+P, ${theme}: 24 cards, fronts and backs`);
    eq(await page.evaluate(() => window.__printCalls), 0, `Ctrl+P, ${theme}: without the page calling print() itself`);
    // the button after it: one sheet, not two
    await page.click('#printBtn');
    await settle(page, 200);
    eq(await page.locator('#printArea .pk-cards').count(), 4, `Ctrl+P, ${theme}: the button then rebuilds the sheet, it does not add to it`);
    eq(await page.locator('#printArea svg.htcm-defs').count(), 1, `Ctrl+P, ${theme}: with one copy of the SVG defs`);
  } finally {
    await page.context().close();
  }
}

// ---- an empty deck ----------------------------------------------------------
{
  const page = await open(browser, deck(0, 'standard', 'classic'), 'light');
  try {
    let said = '';
    page.on('dialog', d => { said = d.message(); d.dismiss(); });
    await page.click('#printBtn');
    await settle(page, 150);
    eq(said, 'Add at least one card first.', 'an empty deck: the button says so');
    eq(await page.evaluate(() => window.__printCalls), 0, 'an empty deck: and prints nothing');
    eq(await page.locator('#printArea > *').count(), 0, 'an empty deck: the sheet stays empty');
  } finally {
    await page.context().close();
  }
}

// ---- what is typed is text --------------------------------------------------
{
  const doc = deck(2, 'standard', 'classic');
  doc.cards[0].name = '<img src=x onerror="window.__pwned=1"><b>Bold</b>';
  doc.cards[0].facts = ['<script>window.__pwned=1</script>'];
  const page = await open(browser, doc, 'light');
  try {
    await page.click('#printBtn');
    await settle(page, 200);
    eq(await page.locator('#printArea .trading-card:not(.back) .cname').first().textContent(), '<img src=x onerror="window.__pwned=1"><b>Bold</b>', 'a name typed as markup prints as the text it is');
    eq(await page.locator('#printArea .trading-card img, #printArea .trading-card .cname b, #printArea .trading-card script').count(), 0, 'and makes no element on the sheet');
    eq(await page.evaluate(() => window.__pwned), undefined, 'and runs nothing');
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

if (failed) {
  console.log(`\nFAIL — ${failed} of ${passed + failed} failed:`);
  for (const f of fails) console.log('  - ' + f);
  process.exit(1);
}
console.log(`PASS — ${passed} green`);
