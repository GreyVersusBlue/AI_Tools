// smoke-print.mjs — 017 prints through the shared print kit (Path 7 P3).
//
//   node Tools/gallery-walk-qr/test/smoke-print.mjs
//
// 017 is the kit's twelfth adopter, with five print buttons: QR codes, the
// reference sheet, feedback slips, feedback packets and route cards. All five
// moved. Its `@media print` block is gone; _shared/print-area.css hides the
// editor, and #printArea holds the five sheets and shows the one a button
// asked for (`.active`), or the QR codes when none has.
//
// A QR card, a slip and a route card are each the second kind, a grid of the
// tool's own (`{ cols, perPage }`, `pk-cards-own`): a card is a share of the
// page's WIDTH (one to four across) and as tall as what is on it, cut into
// pages of 1, 2, 4, 6 or 8 by the "per printed page" choice. No kit preset is
// that: a preset card is a share of the page's height too. A packet is a
// page (`.pk-page`), not a card, and the reference sheet is a table.
//
// The QR sheet carries a <canvas> on every card, so nothing is drawn on
// `beforeprint`: a canvas drawn inside that event reaches Chromium's PDF as
// replayed drawing commands, not as the bitmap. The QR sheet, which is what
// Ctrl+P prints, is kept current by render().
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - each button shows its own sheet and only that one, built as kit grids
//     of the right columns and page size, every card built from text
//   - a printed card is the width it was on the old page (8 px between cards,
//     4 px at the sides), a slip the height it was, and a QR code the size it
//     was
//   - every QR code decodes to the entry's link or text
//   - Chromium's PDF page count per button, per state, light and dark. `old`
//     is what the old page printed on the same half-inch margins, measured
//     from `git show origin/main:` on 2026-10-05 before the adoption; a card
//     sheet whose grids all fit their page must print exactly that. Where a
//     height is text (a packet, the reference table, a grid taller than the
//     page) the count depends on the machine's fonts, so what is asserted is
//     the property: the pages its measured height needs, and none after it.
//   - what the teacher typed reaches every sheet as text
//   - Ctrl+P prints the QR codes, as bitmaps, and does so again after another
//     sheet has printed
//
// print() is stubbed. Nothing here has been checked against a printer and no
// phone has scanned a printed code: the decode is jsQR reading the canvas.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8478;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '017-gallery-walk-qr.html';
const PAGE_W = 720, PAGE_H = 960;   // Letter less half an inch all round, in px
const NEAR = 24;                    // a height this close to a page's end is the fonts' to decide

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pdfImageCount = buf => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

// Made-up entries: a link and a line of text in turn, a note on every third.
const LONG_TEXT = 'Stand an arm’s length back, read the whole poster from the title down, and then write on your slip one claim the authors make, the evidence they give for it, and one question you would ask them if they were standing here.';
function entriesOf(n, long) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({
    name: 'Poster ' + (i + 1),
    value: i % 2 ? 'Look closely at exhibit ' + (i + 1) + ' and count the labels' : 'https://example.com/walk/poster-' + (i + 1),
    feedbackNotes: i % 3 === 0 ? 'Clear title.\nGraph needs units.\nNice colours ' + (i + 1) : '',
  });
  if (long) out.splice(1, 0, { name: 'The very long name of a group project about river deltas', value: LONG_TEXT, feedbackNotes: Array.from({ length: 70 }, (_, k) => 'Comment number ' + (k + 1) + ' about the delta poster and its map').join('\n') });
  return out;
}
const walkersOf = t => Array.from({ length: t }, (_, i) => i === 2 ? 'A group with a long name, Table Seven by the window' : 'Walker ' + (i + 1));

// The five buttons: the area each shows, its grid, its card, and what the
// cards are made from.
const GRID = { 1: [1, 1], 2: [2, 2], 4: [2, 4], 6: [3, 6], 8: [4, 8] };
const BUTTONS = [
  { name: 'QR codes', btn: 'printCodesBtn', area: 'printQrArea', gridOf: 'printQrGrid', card: '.p-card', pp: s => s.pp, items: s => s.entries, qr: true, head: ['.p-name', '.p-num'] },
  { name: 'reference sheet', btn: 'printRefBtn', area: 'printRefArea' },
  { name: 'feedback slips', btn: 'printSlipsBtn', area: 'printSlipsArea', gridOf: 'printSlipGrid', card: '.s-card', pp: s => s.spp, items: s => s.entries.flatMap(e => Array(s.copies).fill(e)), dashed: true, head: ['.slip-station strong', '.slip-footer'] },
  { name: 'feedback packets', btn: 'printPacketsBtn', area: 'printPacketsArea' },
  { name: 'route cards', btn: 'printRouteCardsBtn', area: 'printRouteCardsArea', gridOf: 'printRouteCardsGrid', card: '.r-card', pp: s => s.rpp, items: s => s.entries.length < 2 ? [] : s.walkers, head: ['.route-name', '.route-header'] },
];

// `old` is the old page's PDF page count for the five buttons, in the order
// above, on half-inch margins (0: the button is off, one station has no route).
// `slipH` is the height of the first slip on the old page, in px.
const STATES = [
  { pp: 1, n: 1, spp: 2, style: 'stars', rpp: 4, copies: 6, t: 1, old: [1, 1, 3, 1, 0], slipH: 293.6 },
  { pp: 1, n: 5, spp: 4, style: 'rubric', rpp: 6, copies: 6, t: 4, old: [5, 1, 8, 2, 1], slipH: 309.6 },
  { pp: 1, n: 13, long: true, spp: 6, style: 'sticky', rpp: 2, copies: 2, t: 11, old: [14, 1, 5, 8, 6], slipH: 319.9 },
  { pp: 2, n: 1, spp: 2, style: 'stars', rpp: 4, copies: 6, t: 1, old: [1, 1, 3, 1, 0], slipH: 293.6 },
  { pp: 2, n: 5, spp: 4, style: 'rubric', rpp: 6, copies: 6, t: 4, old: [3, 1, 8, 2, 1], slipH: 309.6 },
  { pp: 2, n: 13, long: true, spp: 6, style: 'sticky', rpp: 2, copies: 2, t: 11, old: [7, 1, 5, 8, 6], slipH: 319.9 },
  { pp: 4, n: 1, spp: 2, style: 'rubric', rpp: 4, copies: 6, t: 1, old: [1, 1, 3, 1, 0], slipH: 309.6 },
  { pp: 4, n: 5, spp: 4, style: 'sticky', rpp: 6, copies: 6, t: 4, old: [2, 1, 8, 2, 1], slipH: 235.5 },
  { pp: 4, n: 13, long: true, spp: 6, style: 'stars', rpp: 2, copies: 2, t: 11, old: [4, 1, 5, 8, 6], slipH: 444.1 },
  { pp: 6, n: 1, spp: 2, style: 'rubric', rpp: 4, copies: 6, t: 1, old: [1, 1, 3, 1, 0], slipH: 309.6 },
  { pp: 6, n: 5, spp: 4, style: 'sticky', rpp: 6, copies: 6, t: 4, old: [1, 1, 8, 2, 1], slipH: 235.5 },
  { pp: 6, n: 13, long: true, spp: 6, style: 'stars', rpp: 2, copies: 2, t: 11, old: [3, 1, 5, 8, 6], slipH: 444.1 },
  { pp: 8, n: 1, spp: 2, style: 'rubric', rpp: 4, copies: 6, t: 1, old: [1, 1, 3, 1, 0], slipH: 309.6 },
  { pp: 8, n: 5, spp: 4, style: 'sticky', rpp: 6, copies: 6, t: 4, old: [1, 1, 8, 2, 1], slipH: 235.5 },
  { pp: 8, n: 13, long: true, spp: 6, style: 'stars', rpp: 2, copies: 2, t: 11, old: [2, 1, 5, 8, 6], slipH: 444.1 },
  { pp: 4, n: 30, spp: 4, style: 'stars', rpp: 4, copies: 2, t: 28, old: [8, 2, 15, 10, 7], slipH: 293.6 },
  { pp: 8, n: 30, spp: 6, style: 'rubric', rpp: 6, copies: 3, t: 30, old: [4, 2, 15, 10, 5], slipH: 350.7 },
  { pp: 6, n: 6, spp: 2, style: 'sticky', rpp: 2, copies: 1, t: 6, old: [1, 1, 3, 2, 3], slipH: 235.5 },
].map(s => ({ ...s, entries: entriesOf(s.n, s.long), walkers: walkersOf(s.t),
  name: `${s.pp} codes to a page, ${s.long ? s.n + 1 : s.n} entr${s.n === 1 ? 'y' : 'ies'}${s.long ? ' (one long)' : ''}, ${s.style} slips ${s.spp} to a page, routes ${s.rpp} to a page` }));

const setOf = s => ({
  name: 'Test walk', cardsPerPage: String(s.pp), ecLevel: 'Q', showNumber: true, reactionsEnabled: s.n === 5, entries: s.entries,
  feedbackEnabled: true, feedbackStyle: s.style, feedbackPrompt: s.long ? 'Name one thing this poster taught you and one thing you would change about it' : '',
  feedbackCopies: s.copies, feedbackPerPage: String(s.spp),
  timer: { minutes: 3, seconds: 0, rotations: Math.min(s.entries.length, 6) }, walkGroups: s.walkers, routeCardsPerPage: String(s.rpp),
});

/** Opens 017 at the printable width of the page, so a card measured in print
    media is the size it is on paper. `set` is the saved walk, or null. */
async function open(browser, set, theme) {
  const page = await prepPage(browser, BASE, { width: PAGE_W, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([saved, dark]) => {
    if (saved && !localStorage.getItem('gallery-walk-qr-sets')) localStorage.setItem('gallery-walk-qr-sets', JSON.stringify({ current: saved.name, sets: { [saved.name]: saved } }));
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [set, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}

/** Presses a print button, in the page (most are below the fold at this
    width). False if the button is off. */
async function press(page, b) {
  const pressed = await page.evaluate(id => { const x = document.getElementById(id); if (x.disabled) return false; x.click(); return true; }, b.btn);
  await settle(page, 150);
  return pressed;
}

/** Reads every QR code in an area back with the site's own decoder. */
const decodeAll = (page, area) => page.evaluate(id => [...document.querySelectorAll('#' + id + ' canvas')].map(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const r = window.jsQR(d.data, d.width, d.height);
  return r ? r.data : null;
}), area);

const activeSheets = page => page.evaluate(() => [...document.querySelectorAll('.print-only.active')].map(x => x.id).join(','));

/** The pages a run of blocks of these heights needs, each starting a page:
    [fewest, most], the two apart only where a block ends within NEAR px of a
    page's end. */
function pagesFor(heights) {
  let lo = 0, hi = 0;
  for (const h of heights) {
    lo += Math.max(1, Math.ceil((h - NEAR) / PAGE_H));
    hi += Math.max(1, Math.ceil((h + NEAR) / PAGE_H));
  }
  return [Math.max(1, lo), Math.max(1, hi)];
}

console.log('017 — the gallery walk\'s five sheets print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(code), 'has no @media print block of its own');
ok(!/@page/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/page-break|break-inside|break-after|\.pp-\d|'pp-'/.test(code), 'the columns, the cut into pages and the page breaks are the kit\'s, not the page\'s');
ok(!/#printArea\s*\{[^}]*display/.test(code), 'and it does not hide or show #printArea itself');
eq((code.match(/PrintKit\.renderCards\(/g) || []).length, 3, 'the three card sheets are each one PrintKit.renderCards() call');
ok(!/(Grid|printRefBody|printPacketsBody)\.innerHTML/.test(code), 'no sheet is built from a string');
ok(!/beforeprint/.test(code), 'nothing is drawn on beforeprint (a canvas drawn there prints as replayed commands)');
ok(/<\/div>\s*\n\s*<div id="printArea" class="pk-paper">\s*\n\s*<div class="print-only" id="printQrArea">/.test(src), '#printArea is a .pk-paper, written as a child of <body>, with the QR codes first');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const page = await open(browser, setOf(s), theme);
    page.on('dialog', d => d.accept());
    try {
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${theme}, ${s.name}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${theme}, ${s.name}: the sheets are hidden on screen`);
      eq(await page.locator('#printQrGrid .p-card').count(), s.entries.length, `${theme}, ${s.name}: the QR codes are already built, so Ctrl+P has something to print`);
      eq(await activeSheets(page), '', `${theme}, ${s.name}: no button's sheet is live until one is pressed`);

      for (let bi = 0; bi < BUTTONS.length; bi++) {
        const b = BUTTONS[bi];
        const what = `${theme}, ${s.name}, ${b.name}`;
        const before = await page.evaluate(() => window.__printCalls);
        const pressed = await press(page, b);
        if (!s.old[bi]) { eq(pressed, false, `${what}: the button is off, as it was`); continue; }
        eq(await page.evaluate(() => window.__printCalls) - before, 1, `${what}: it called print() once`);
        eq(await activeSheets(page), b.area, `${what}: its sheet is the live one`);

        await page.emulateMedia({ media: 'print' });
        await settle(page, 100);
        const m = await page.evaluate(([id, gridId, sel, head]) => {
          const sheet = document.getElementById('printArea');
          const area = document.getElementById(id);
          const r = x => x.getBoundingClientRect();
          const cs = x => getComputedStyle(x);
          const cards = sel ? [...area.querySelectorAll(sel)] : [];
          const grids = gridId ? [...document.getElementById(gridId).children] : [];
          const outside = [...document.body.querySelectorAll('*')].filter(x => !sheet.contains(x) && !x.contains(sheet) && x.getClientRects().length);
          const clipped = [...area.querySelectorAll('*')].filter(x => cs(x).overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1);
          const rows = {};
          cards.forEach(c => { const k = grids.indexOf(c.parentElement) + '/' + Math.round(r(c).top); (rows[k] = rows[k] || []).push(r(c).height); });
          const packets = [...area.querySelectorAll('.packet-page')];
          return {
            shown: [...sheet.children].filter(x => x.getClientRects().length).map(x => x.id).join(','),
            kids: [...new Set(grids.map(g => g.className))].join('|'),
            cols: [...new Set(grids.map(g => g.style.getPropertyValue('--pk-cols')))].join('|'),
            per: grids.map(g => g.children.length),
            gridH: grids.map(g => r(g).height),
            stray: cards.length - (sel ? area.querySelectorAll('.pk-cards > ' + sel + '.pk-card').length : 0),
            count: cards.length,
            widths: cards.map(c => r(c).width),
            firstH: cards[0] ? r(cards[0]).height : 0,
            lefts: [...new Set(cards.map(c => Math.round(r(c).left)))].sort((x, y) => x - y),
            ragged: Object.values(rows).filter(h => Math.max(...h) - Math.min(...h) > 0.6).length,
            gap: grids[0] ? cs(grids[0]).rowGap + ' ' + cs(grids[0]).columnGap + ' / ' + cs(grids[0]).paddingTop + ' ' + cs(grids[0]).paddingLeft : '',
            canv: [...area.querySelectorAll('canvas')].map(c => [r(c).width, r(c).height, c.width, c.height]),
            spill: cards.filter(c => [...c.children].some(k => r(k).bottom > r(c).bottom + 0.5)).length,
            clipped: clipped.length,
            outside: outside.length,
            first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].id ? '#' + outside[0].id : '') : '',
            keep: cards[0] ? cs(cards[0]).breakInside : '',
            gridBreak: grids.map(g => cs(g).breakAfter).join(','),
            border: cards[0] ? cs(cards[0]).borderTopColor + ' ' + cs(cards[0]).borderTopStyle : '',
            ink: cards[0] ? head.map(h => cs(cards[0].querySelector(h)).color).join(' ') : '',
            tableW: area.querySelector('table') ? r(area.querySelector('table')).width : 0,
            tableInk: area.querySelector('td') ? cs(area.querySelector('td')).color + ' ' + cs(area.querySelector('th')).backgroundColor : '',
            heads: [...area.querySelectorAll('thead th')].filter(x => x.getClientRects().length).map(x => x.textContent).join('|'),
            rowsN: area.querySelectorAll('tbody tr').length,
            areaH: r(area).height,
            packetH: packets.map(p => r(p).height),
            packetCls: [...new Set(packets.map(p => p.className))].join('|'),
            packetBreak: packets.map(p => cs(p).breakAfter).join(','),
            packetNames: packets.map(p => p.querySelector('h2').textContent).join('|'),
            packetLines: packets.map(p => p.querySelectorAll('li').length).join(','),
            paper: cs(sheet).backgroundColor,
          };
        }, [b.area, b.gridOf || '', b.card || '', b.head || []]);

        eq(m.shown, b.area, `${what}: its sheet is on the paper, and only its sheet`);
        eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
        eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
        eq(m.paper, 'rgb(255, 255, 255)', `${what}: the paper is white`);

        let want;   // [fewest, most] PDF pages
        if (b.card) {
          const items = b.items(s);
          const [cols, per] = GRID[b.pp(s)];
          const pages = Math.ceil(items.length / per);
          eq(m.count, items.length, `${what}: one card for each of the ${items.length}`);
          eq(m.kids, 'pk-cards pk-page pk-cards-own', `${what}: every grid is a kit page of the tool's own cards`);
          eq(m.cols, String(cols), `${what}: ${cols} across`);
          eq(m.per.join(','), Array.from({ length: pages }, (_, i) => Math.min(per, items.length - i * per)).join(','), `${what}: ${per} to a grid, the last one short`);
          eq(m.stray, 0, `${what}: every card is a kit card, directly in a grid`);
          const w = (PAGE_W - 8 - (cols - 1) * 8) / cols;
          ok(m.widths.every(x => Math.abs(x - w) <= 0.6), `${what}: a card is ${w.toFixed(0)} px wide, as it was (${Math.min(...m.widths).toFixed(1)} to ${Math.max(...m.widths).toFixed(1)})`);
          eq(m.lefts.join(','), Array.from({ length: Math.min(cols, items.length) }, (_, i) => Math.round(4 + i * (w + 8))).join(','), `${what}: 4 px in from the side and 8 px apart, as they were`);
          eq(m.gap, '8px 8px / 0px 4px', `${what}: the gap is the tool's, not the kit's, with nothing above a page of cards`);
          eq(m.ragged, 0, `${what}: the cards of a row are one height`);
          eq(m.spill, 0, `${what}: every card's content ends above its bottom border`);
          eq(m.keep, 'avoid', `${what}: a card is not split across two pages if it fits on one`);
          eq(m.gridBreak, Array.from({ length: pages }, (_, i) => i < pages - 1 ? 'page' : 'auto').join(','), `${what}: the page breaks after every grid but the last`);
          eq(m.border, 'rgb(153, 153, 153) ' + (b.dashed ? 'dashed' : 'solid'), `${what}: the card's border is the tool's own grey`);
          eq(m.ink, 'rgb(0, 0, 0) rgb(85, 85, 85)', `${what}: the name prints black and the small print in the tool's grey`);
          if (b.qr) {
            const side = Math.min(320, w - 28 - 2);   // the 1.5 px border is drawn as 1 px a side
            eq(m.canv.length, items.length, `${what}: a QR code on every card`);
            ok(m.canv.every(c => Math.abs(c[0] - side) <= 0.6 && Math.abs(c[1] - side) <= 0.6 && c[2] === 600 && c[3] === 600), `${what}: each ${side.toFixed(0)} px square on paper, as it was, drawn at 600 px`);
            const codes = await decodeAll(page, b.area);
            const unread = items.map((x, i) => codes[i] === x.value ? null : x.name).filter(Boolean);
            eq(unread.length, 0, `${what}: every QR code decodes to the entry's link or text${unread.length ? ' (not: ' + unread.slice(0, 3).join(', ') + ')' : ''}`);
          } else {
            eq(m.canv.length, 0, `${what}: no QR code on this sheet`);
          }
          // A slip's height is its text; the old page's, within what fonts move.
          if (b.dashed) ok(Math.abs(m.firstH - s.slipH) <= 12, `${what}: a slip is as tall as it was, about ${s.slipH} px (${m.firstH.toFixed(1)}): its write-in rules are one line each`);
          want = m.gridH.every(h => h <= PAGE_H - NEAR) ? [s.old[bi], s.old[bi]] : pagesFor(m.gridH);
          if (want[0] === want[1]) eq(pages, s.old[bi], `${what}: one page per grid is what the old page printed`);
        } else if (b.area === 'printRefArea') {
          eq(m.rowsN, s.entries.length, `${what}: a row for every entry`);
          ok(Math.abs(m.tableW - PAGE_W) <= 0.6, `${what}: the table is the width of the page`);
          eq(m.tableInk, 'rgb(0, 0, 0) rgb(238, 238, 238)', `${what}: black text under a light grey head`);
          eq(m.heads, '#|Name / title|Link or text' + (s.n === 5 ? '|Reactions' : ''), `${what}: the reactions column is there only when reactions are on`);
          want = pagesFor([m.areaH]);
        } else {
          const noted = s.entries.filter(e => e.feedbackNotes.trim());
          eq(m.packetNames, noted.map(e => e.name).join('|'), `${what}: a packet for every entry with notes, and no other`);
          eq(m.packetLines, noted.map(e => e.feedbackNotes.split('\n').length).join(','), `${what}: one line per comment`);
          eq(m.packetCls, 'packet-page pk-page', `${what}: each packet is a kit page`);
          eq(m.packetBreak, noted.map((_, i) => i < noted.length - 1 ? 'page' : 'auto').join(','), `${what}: the page breaks after every packet but the last`);
          want = pagesFor(m.packetH);
        }

        await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
        const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
        const got = pdfPageCount(buf);
        if (want[0] === want[1]) eq(got, want[0], `${what}: Chromium prints the pages the sheet needs${b.card ? ', the old page\'s ' + s.old[bi] : ''} (the old page: ${s.old[bi]})`);
        else ok(got >= want[0] && got <= want[1], `${what}: Chromium prints ${want[0]} to ${want[1]} pages for a sheet that ends near a page's end (got ${got}; the old page: ${s.old[bi]})`);
        ok(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(buf.toString('latin1')), `${what}: on US Letter, portrait`);
        if (b.qr) ok(pdfImageCount(buf) >= 1, `${what}: the QR codes are in the PDF as bitmaps (${pdfImageCount(buf)} image objects)`);
        // page.pdf() fired afterprint: Ctrl+P is the QR codes again.
        eq(await activeSheets(page), '', `${what}: once printed, no button's sheet is live`);
        await page.emulateMedia({ media: 'print' });
        eq(await page.evaluate(() => [...document.getElementById('printArea').children].filter(x => x.getClientRects().length).map(x => x.id).join(',')), 'printQrArea', `${what}: and the QR codes are the sheet again`);
        await page.emulateMedia({ media: null });
      }
      eq(page.__errs.length, 0, `${theme}, ${s.name}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${theme}, ${s.name}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${theme}, ${s.name}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- text, not markup -----------------------------------------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Poster</b> "one"';
  const evil2 = '</td><script>window.__pwned=1</script> & more';
  const set = setOf(STATES[4]);
  set.entries = entriesOf(2);
  Object.assign(set.entries[0], { name: evil, value: evil2, feedbackNotes: evil + '\n' + evil2 });
  set.feedbackPrompt = evil;
  set.walkGroups = [evil, 'Walker 2'];
  const page = await open(browser, set);
  try {
    for (const b of BUTTONS) await press(page, b);
    const r = await page.evaluate(() => {
      const q = sel => { const x = document.querySelector(sel); return x ? x.textContent : null; };
      return {
        name: q('#printQrGrid .p-name'), text: q('#printQrGrid .p-instructions'),
        ref: [...document.querySelector('#printRefBody tr').cells].map(c => c.textContent),
        slip: q('#printSlipGrid .slip-station strong'), prompt: q('#printSlipGrid .slip-prompt'),
        packet: q('#printPacketsBody h2'), lines: [...document.querySelectorAll('#printPacketsBody .packet-page:first-child li')].map(x => x.textContent),
        route: q('#printRouteCardsGrid .route-name'), steps: q('#printRouteCardsGrid .route-steps'),
        injected: document.getElementById('printArea').querySelectorAll('img, b, script').length, pwned: !!window.__pwned,
      };
    });
    eq(r.name, evil, 'an entry\'s name reaches its QR card character for character');
    eq(r.text, evil2, 'and so does its text');
    eq(r.ref.slice(1, 3).join('|'), [evil, evil2].join('|'), 'name and content reach the reference sheet as text');
    eq(r.slip, evil, 'the name reaches the feedback slip as text');
    eq(r.prompt, evil, 'and so does the prompt');
    eq(r.packet, evil, 'the name heads the packet as text');
    eq(r.lines.join('|'), [evil, evil2].join('|'), 'whose comments are text');
    eq(r.route, evil, 'a walker\'s name reaches the route card as text');
    eq(r.steps, 'Then: 2 → 1 → 2 → 1', 'whose steps are joined with an arrow, not an entity');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
    eq((await decodeAll(page, 'printQrArea'))[0], evil2, 'the QR code carries the content as typed');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- the three slip styles, as they were written ------------------------------------
for (const style of ['stars', 'rubric', 'sticky']) {
  const set = { ...setOf(STATES[4]), feedbackStyle: style, feedbackCopies: 1 };
  const page = await open(browser, set);
  try {
    await press(page, BUTTONS[2]);
    // The sheet is not on screen, so innerText has no line breaks to give: the text nodes, in order.
    const t = await page.evaluate(() => {
      const w = document.createTreeWalker(document.querySelector('#printSlipGrid .s-card'), NodeFilter.SHOW_TEXT);
      const out = [];
      while (w.nextNode()) if (w.currentNode.textContent.trim()) out.push(w.currentNode.textContent.trim());
      return out.join(' ');
    });
    const want = {
      stars: 'Feedback for Poster 1 What did you notice? What would make this even better? ★ _______________________________ ★ _______________________________ Wish: __________________________ _______________________________ From (optional): _____________________',
      rubric: 'Feedback for Poster 1 What did you notice? What would make this even better? 1 2 3 4 Followed the prompt ○ ○ ○ ○ Effort / craftsmanship ○ ○ ○ ○ Creativity ○ ○ ○ ○ Overall impression ○ ○ ○ ○ Comment: _______________________________ From (optional): _____________________',
      sticky: 'Feedback for Poster 1 What’s one thing you noticed? What’s one question you have? From (optional): _____________________',
    }[style];
    eq(t, want, `a ${style} slip reads as it did on the old page`);
  } catch (e) {
    ok(false, `${style} slip: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- the QR sheet follows the editor; printing twice ---------------------------
{
  const page = await open(browser, setOf(STATES[4]));
  try {
    await press(page, BUTTONS[0]);
    await press(page, BUTTONS[0]);
    eq(await page.locator('#printQrGrid > *').count(), 3, 'printing again replaces the sheet, it does not add to it');
    eq(await page.locator('#printQrGrid .p-card').count(), 5, 'with the five cards once each');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');

    await page.fill('#entriesBody tr[data-idx="0"] .f-name', 'Front hall mural');
    await page.fill('#entriesBody tr[data-idx="0"] .f-value', 'Find the red kite in the mural');
    await settle(page, 500);
    eq(await page.evaluate(() => document.querySelector('#printQrGrid .p-name').textContent), 'Front hall mural', 'typing a name rebuilds the hidden sheet, with no button pressed');
    eq(await page.evaluate(() => document.querySelector('#printQrGrid .p-instructions').textContent), 'Find the red kite in the mural', 'text that is not a link is printed above its code');
    eq((await decodeAll(page, 'printQrArea'))[0], 'Find the red kite in the mural', 'and typing its content redraws its QR code');

    await page.selectOption('#cardsPerPage', '8');
    await settle(page, 500);
    eq(await page.evaluate(() => document.querySelector('#printQrGrid > *').style.getPropertyValue('--pk-cols')), '4', 'choosing eight to a page puts the sheet four across');
    await page.uncheck('#showNumber');
    await settle(page, 500);
    eq(await page.locator('#printQrGrid .p-num').count(), 0, 'turning the entry numbers off takes them off the sheet');

    await press(page, BUTTONS[4]);
    eq(await activeSheets(page), 'printRouteCardsArea', 'a button shows its own sheet until it has printed');
    await page.emulateMedia({ media: 'print' });
    eq(await page.evaluate(() => getComputedStyle(document.getElementById('printQrArea')).display), 'none', 'and the QR codes are off the paper while it does');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `the sheet follows the editor: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- Ctrl+P: Chromium's own print path, with no button pressed --------------------
{
  const page = await open(browser, setOf(STATES[4]));
  try {
    const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(buf), 3, 'printing with no button pressed prints the QR codes, five on three pages at two to a page (it printed one empty page)');
    ok(pdfImageCount(buf) >= 1, `with the QR codes as bitmaps, as the button prints them (${pdfImageCount(buf)} image objects)`);
    eq(await page.evaluate(() => window.__printCalls), 0, 'and the page did not call print() itself');
  } catch (e) {
    ok(false, `Ctrl+P: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- nothing to print ------------------------------------------------------------
{
  const page = await open(browser, null);
  try {
    eq(await page.locator('#printQrGrid > *').count(), 0, 'with no entries there is no sheet');
    eq(await page.evaluate(() => ['printCodesBtn', 'printRefBtn', 'printSlipsBtn', 'printPacketsBtn', 'printRouteCardsBtn'].every(id => document.getElementById(id).disabled)), true, 'and all five print buttons are off');
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 1, 'Ctrl+P then is one page, as it was');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `nothing to print: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('FAILED:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`PASS — ${passed} green`);
