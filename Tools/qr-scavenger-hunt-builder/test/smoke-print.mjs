// smoke-print.mjs — 018 prints through the shared print kit (Path 7 P3).
//
//   node Tools/qr-scavenger-hunt-builder/test/smoke-print.mjs
//
// 018 is the kit's eleventh adopter and the first with six print buttons:
// station cards, the answer key, clue cards (Build tab), team cards, route
// cards and answer sheets (Live Run tab). All six moved. Its `@media print`
// blocks are gone; _shared/print-area.css hides the editor, and #printArea
// holds the six sheets and shows the one a button asked for.
//
// Every card on it is the second kind, a grid of the tool's own
// (`{ cols, perPage }`, `pk-cards-own`): a card is a share of the page's
// WIDTH (one, two or three across) and as tall as what is on it, cut into
// pages of 1, 2, 4, 6 or 9 by "codes per printed page". No kit preset is
// that: a preset card is a share of the page's height too.
//
// Two sheets carry a <canvas> (the station QR code, the team check-in code),
// so nothing is drawn on `beforeprint`: a canvas drawn inside that event
// reaches Chromium's PDF as replayed drawing commands, not as the bitmap. The
// station sheet, which is what Ctrl+P prints, is kept current by render().
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - each button shows its own sheet and only that one, built as kit grids
//     of the right columns and page size, every card built from text
//   - a printed card is the width it was on the old page (8 px between cards,
//     4 px at the sides) and a QR code the size it was
//   - every QR code decodes to what it did: the station's content, or
//     HUNT-TEAM:<code>
//   - Chromium's PDF page count per button, per state, light and dark. `old`
//     is what the old page printed on the same half-inch margins, measured
//     from `git show origin/main:` on 2026-10-04 before the adoption; the
//     counts are equal except for the answer sheets where a card is as tall
//     as the page or taller, which no longer print a blank page after every
//     page of sheets (`now`)
//   - what the teacher typed reaches every sheet as text
//   - Ctrl+P prints the station cards, with the QR codes as bitmaps, and does
//     so again after another sheet has printed
//
// print() is stubbed. Nothing here has been checked against a printer and no
// phone has scanned a printed code: the decode is jsQR reading the canvas.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8477;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '018-qr-scavenger-hunt-builder.html';
const PAGE_W = 720, PAGE_H = 960;   // Letter less half an inch all round, in px

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const pdfImageCount = buf => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

// Made-up stations, one of each answer type in turn, and made-up teams.
const TYPES = ['text', 'numeric', 'choice', 'photo'];
const LONG = {
  label: 'The long corridor behind the gymnasium storage room',
  content: 'Walk to the far end of the corridor, count every blue locker on the left side, then subtract the number of doors you passed on the way there and back again.',
  note: 'a long note for the key', qType: 'choice', choices: ['Fourteen lockers', 'Twenty-two lockers', 'Nine', 'None of these', 'Ask', 'Skip'],
  correctChoice: 2, numericAnswer: '', tolerance: '0', hint: 'count twice', hintPenalty: '1', codeWord: 'CORRIDOR',
};
function stationsOf(n, long) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const qType = TYPES[i % 4];
    out.push({
      label: 'Stop ' + (i + 1), content: 'Clue number ' + (i + 1) + ' for the hunt', note: i % 3 ? '' : 'note ' + (i + 1), qType,
      choices: qType === 'choice' ? ['Red', 'Green', 'Blue'] : [], correctChoice: 1, numericAnswer: qType === 'numeric' ? '12' : '', tolerance: '0',
      hint: i % 5 ? '' : 'look up', hintPenalty: '2', codeWord: 'WORD' + (i + 1),
    });
  }
  if (long) out.splice(1, 0, LONG);
  return out;
}
const teamsOf = n => Array.from({ length: n }, (_, i) => ({ name: 'Crew ' + (i + 1), code: 'T' + String(i + 1).padStart(3, 'X'), marks: {}, attempts: {}, hintsUsed: {}, penaltyMs: 0 }));

// The six buttons: the area each shows, the tab it is on, what its cards are
// made from, and how its grid is cut ("pp" is the page's own setting).
const GRID = { 1: [1, 1], 2: [2, 2], 4: [2, 4], 6: [3, 6], 9: [3, 9] };
const BUTTONS = [
  { name: 'station cards', btn: '#print-stations-btn', tab: 'build', area: 'print-station-area', of: 'stations', grid: s => GRID[s.pp], qr: true },
  { name: 'answer key', btn: '#print-answers-btn', tab: 'build', area: 'print-answer-area', of: null },
  { name: 'clue cards', btn: '#print-clues-btn', tab: 'build', area: 'print-clues-area', of: 'stations', grid: s => GRID[s.pp] },
  { name: 'team cards', btn: '#print-teams-btn', tab: 'run', area: 'print-teams-area', of: 'teams', grid: () => GRID[4], qr: true },
  { name: 'route cards', btn: '#print-routes-btn', tab: 'run', area: 'print-routes-area', of: 'teams', grid: () => GRID[2] },
  { name: 'answer sheets', btn: '#print-answersheets-btn', tab: 'run', area: 'print-answersheets-area', of: 'teams', grid: () => GRID[2] },
];

// `old` is the old page's PDF page count for the six buttons, in the order
// above, on half-inch margins; `now` is given where this page's differs.
const STATES = [
  { pp: 1, n: 1, t: 1, old: [1, 1, 1, 1, 1, 1] },
  { pp: 1, n: 5, t: 3, old: [5, 1, 5, 1, 2, 2] },
  { pp: 1, n: 13, t: 9, long: true, old: [14, 2, 14, 3, 5, 11], now: [14, 2, 14, 3, 5, 5] },
  { pp: 2, n: 1, t: 1, old: [1, 1, 1, 1, 1, 1] },
  { pp: 2, n: 2, t: 2, old: [1, 1, 1, 1, 1, 1] },
  { pp: 2, n: 5, t: 3, old: [3, 1, 3, 1, 2, 2] },
  { pp: 2, n: 13, t: 9, long: true, old: [7, 2, 7, 3, 5, 11], now: [7, 2, 7, 3, 5, 5] },
  { pp: 4, n: 1, t: 1, old: [1, 1, 1, 1, 1, 1] },
  { pp: 4, n: 4, t: 4, old: [1, 1, 1, 1, 2, 2] },
  { pp: 4, n: 5, t: 3, old: [2, 1, 2, 1, 2, 2] },
  { pp: 4, n: 13, t: 9, long: true, old: [5, 2, 4, 3, 5, 11], now: [5, 2, 4, 3, 5, 5] },
  { pp: 4, n: 30, t: 12, old: [8, 2, 8, 3, 6, 18], now: [8, 2, 8, 3, 6, 12] },
  { pp: 6, n: 1, t: 1, old: [1, 1, 1, 1, 1, 1] },
  { pp: 6, n: 5, t: 3, old: [1, 1, 1, 1, 2, 2] },
  { pp: 6, n: 6, t: 2, old: [1, 1, 1, 1, 1, 1] },
  { pp: 6, n: 13, t: 9, long: true, old: [3, 2, 3, 3, 5, 11], now: [3, 2, 3, 3, 5, 5] },
  { pp: 9, n: 1, t: 1, old: [1, 1, 1, 1, 1, 1] },
  { pp: 9, n: 5, t: 3, old: [1, 1, 1, 1, 2, 2] },
  { pp: 9, n: 9, t: 5, old: [2, 1, 1, 2, 3, 3] },
  { pp: 9, n: 13, t: 9, long: true, old: [3, 2, 3, 3, 5, 11], now: [3, 2, 3, 3, 5, 5] },
].map(s => ({ ...s, stations: stationsOf(s.n, s.long), teams: teamsOf(s.t), name: `${s.pp} to a page, ${s.long ? s.n + 1 : s.n} station${s.n === 1 ? '' : 's'}${s.long ? ' (one long)' : ''}, ${s.t} team${s.t === 1 ? '' : 's'}` }));

/** Opens 018 at the printable width of the page, so a card measured in print
    media is the size it is on paper. `hunt` is the saved hunt, or null. */
async function open(browser, hunt, theme) {
  const page = await prepPage(browser, BASE, { width: PAGE_W, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([saved, dark]) => {
    if (saved && !localStorage.getItem('qr-scavenger-hunt-sets')) localStorage.setItem('qr-scavenger-hunt-sets', JSON.stringify({ current: saved.name, sets: { [saved.name]: saved } }));
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [hunt, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 400);
  return page;
}
const huntOf = (stations, teams, pp = 4) => ({ name: 'Test hunt', stations, cardsPerPage: String(pp), ecLevel: 'Q', showNumber: true, run: { teams, stagger: true } });

/** Presses a print button on its own tab. Clicked in the page: the Live Run
    tab's buttons are below the fold at this width. */
async function press(page, b) {
  await page.evaluate(([tab, btn]) => { document.getElementById('tab-' + tab).click(); document.querySelector(btn).click(); }, [b.tab, b.btn]);
  await settle(page, 150);
}

/** Reads every QR code in an area back with the site's own decoder. */
async function decodeAll(page, area) {
  if (!(await page.evaluate(() => typeof window.jsQR === 'function'))) await page.addScriptTag({ url: `${BASE}/_shared/vendor/jsqr/jsqr.js` });
  return page.evaluate(id => [...document.querySelectorAll('#' + id + ' canvas')].map(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const r = window.jsQR(d.data, d.width, d.height);
    return r ? r.data : null;
  }), area);
}

console.log('018 — the scavenger hunt\'s six sheets print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(code), 'has no @media print block of its own');
ok(!/@page/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/page-break|break-inside|break-after|flex-wrap:\s*wrap;\s*}\s*\.print-station-grid|\.pp-\d/.test(code), 'the columns, the cut into pages and the page breaks are the kit\'s, not the page\'s');
ok(!/#printArea\s*\{[^}]*display/.test(code), 'and it does not hide or show #printArea itself');
eq((code.match(/PrintKit\.renderCards\(/g) || []).length, 5, 'the five card sheets are each one PrintKit.renderCards() call');
ok(!/(Grid|answerKeyBody)\.innerHTML/.test(code), 'no sheet is built from a string');
ok(!/beforeprint/.test(code), 'nothing is drawn on beforeprint (a canvas drawn there prints as replayed commands)');
ok(/<\/div>\s*\n\s*<div id="printArea" class="pk-paper">\s*\n\s*<div class="print-only active" id="print-station-area">/.test(src), '#printArea is a .pk-paper, written as a child of <body>, showing the station cards until a button asks for another sheet');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const page = await open(browser, huntOf(s.stations, s.teams, s.pp), theme);
    try {
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${theme}, ${s.name}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${theme}, ${s.name}: the sheets are hidden on screen`);
      eq(await page.locator('#print-station-grid .p-card').count(), s.stations.length, `${theme}, ${s.name}: the station cards are already built, so Ctrl+P has something to print`);

      for (let bi = 0; bi < BUTTONS.length; bi++) {
        const b = BUTTONS[bi];
        const what = `${theme}, ${s.name}, ${b.name}`;
        const before = await page.evaluate(() => window.__printCalls);
        await press(page, b);
        eq(await page.evaluate(() => window.__printCalls) - before, 1, `${what}: it called print() once`);
        const items = b.of ? s[b.of] : [];
        const [cols, per] = b.grid ? b.grid(s) : [0, 0];

        await page.emulateMedia({ media: 'print' });
        await settle(page, 100);
        const m = await page.evaluate(id => {
          const sheet = document.getElementById('printArea');
          const area = document.getElementById(id);
          const r = x => x.getBoundingClientRect();
          const cs = x => getComputedStyle(x);
          const cards = [...area.querySelectorAll('.p-card')];
          const grids = [...area.querySelectorAll('.print-station-grid > *')];
          const outside = [...document.body.querySelectorAll('*')].filter(x => !sheet.contains(x) && !x.contains(sheet) && x.getClientRects().length);
          const clipped = [...area.querySelectorAll('*')].filter(x => cs(x).overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1);
          const rows = {};
          cards.forEach(c => { const k = c.parentElement.dataset.k || (c.parentElement.dataset.k = String(grids.indexOf(c.parentElement))); (rows[k + '/' + Math.round(r(c).top)] = rows[k + '/' + Math.round(r(c).top)] || []).push(r(c).height); });
          return {
            shown: [...sheet.children].filter(x => x.getClientRects().length).map(x => x.id).join(','),
            kids: [...new Set(grids.map(g => g.className))].join('|'),
            cols: [...new Set(grids.map(g => g.style.getPropertyValue('--pk-cols')))].join('|'),
            per: grids.map(g => g.children.length),
            stray: cards.length - area.querySelectorAll('.pk-cards > .p-card.pk-card').length,
            count: cards.length,
            widths: cards.map(c => r(c).width),
            lefts: [...new Set(cards.map(c => Math.round(r(c).left)))].sort((x, y) => x - y),
            maxH: Math.max(0, ...cards.map(c => r(c).height)),
            ragged: Object.values(rows).filter(h => Math.max(...h) - Math.min(...h) > 0.6).length,
            gap: grids[0] ? cs(grids[0]).rowGap + ' ' + cs(grids[0]).columnGap + ' / ' + cs(grids[0]).paddingTop + ' ' + cs(grids[0]).paddingLeft : '',
            canv: [...area.querySelectorAll('canvas')].map(c => [r(c).width, r(c).height, c.width, c.height]),
            spill: cards.filter(c => [...c.children].some(k => r(k).bottom > r(c).bottom + 0.5 || r(k).right > r(c).right + 0.5)).length,
            clipped: clipped.length,
            outside: outside.length,
            first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].id ? '#' + outside[0].id : '') : '',
            keep: cards[0] ? cs(cards[0]).breakInside : '',
            gridBreak: grids.map(g => cs(g).breakAfter).join(','),
            border: cards[0] ? cs(cards[0]).borderTopColor + ' ' + cs(cards[0]).borderTopStyle : '',
            ink: cards[0] ? cs(cards[0].querySelector('.p-label')).color + ' ' + cs(cards[0].querySelector('.p-num')).color : cs(area.querySelector('td')).color + ' ' + cs(area.querySelector('th')).backgroundColor,
            tableW: area.querySelector('table') ? r(area.querySelector('table')).width : 0,
            rowsN: area.querySelectorAll('#answer-key-body tr').length,
            paper: cs(sheet).backgroundColor,
          };
        }, b.area);

        eq(m.shown, b.area, `${what}: its sheet is on the paper, and only its sheet`);
        eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
        eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
        eq(m.paper, 'rgb(255, 255, 255)', `${what}: the paper is white`);
        if (b.of) {
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
          eq(m.spill, 0, `${what}: every card's content ends inside its border`);
          eq(m.keep, 'avoid', `${what}: a card is not split across two pages if it fits on one`);
          eq(m.gridBreak, Array.from({ length: pages }, (_, i) => i < pages - 1 ? 'page' : 'auto').join(','), `${what}: the page breaks after every grid but the last`);
          eq(m.border, 'rgb(153, 153, 153) solid', `${what}: the card's border is the tool's own grey`);
          eq(m.ink, 'rgb(0, 0, 0) rgb(85, 85, 85)', `${what}: the name prints black and the small heading in the tool's grey`);
          if (b.qr) {
            const side = Math.min(320, w - 28 - 2);   // the 1.5 px border is drawn as 1 px a side
            eq(m.canv.length, items.length, `${what}: a QR code on every card`);
            ok(m.canv.every(c => Math.abs(c[0] - side) <= 0.6 && Math.abs(c[1] - side) <= 0.6 && c[2] === 600 && c[3] === 600), `${what}: each ${side.toFixed(0)} px square on paper, as it was, drawn at 600 px`);
            const codes = await decodeAll(page, b.area);
            const want = items.map(x => b.of === 'teams' ? 'HUNT-TEAM:' + x.code : x.content);
            const unread = codes.map((c, i) => c === want[i] ? null : want[i]).filter(Boolean);
            eq(unread.length, 0, `${what}: every QR code decodes to what it carried${unread.length ? ' (not: ' + unread.slice(0, 3).join(', ') + ')' : ''}`);
          } else {
            eq(m.canv.length, 0, `${what}: no QR code on this sheet`);
          }
        } else {
          eq(m.rowsN, s.stations.length, `${what}: a row for every station`);
          ok(Math.abs(m.tableW - PAGE_W) <= 0.6, `${what}: the table is the width of the page`);
          eq(m.ink, 'rgb(0, 0, 0) rgb(238, 238, 238)', `${what}: black text under a light grey head`);
        }

        await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
        const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
        const want = (s.now || s.old)[bi];
        if (b.name === 'answer sheets' && m.maxH <= PAGE_H - 2 && m.maxH > PAGE_H - 24) {
          // A sheet within a few px of the page's height: which side of it a
          // machine's fonts put the card is not this suite's to hold. What is:
          // a card that fits prints on its page, with no blank page after it.
          eq(pdfPageCount(buf), Math.ceil(items.length / per), `${what}: a sheet that just fits the page is one page per pair (the old page: ${s.old[bi]})`);
        } else {
          eq(pdfPageCount(buf), want, `${what}: Chromium prints ${s.now && s.now[bi] !== s.old[bi] ? 'fewer pages than the old page\'s ' + s.old[bi] + ', none of them blank' : 'the pages the old page did on half-inch margins'}`);
        }
        ok(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(buf.toString('latin1')), `${what}: on US Letter, portrait`);
        if (b.qr) ok(pdfImageCount(buf) >= 1, `${what}: the QR codes are in the PDF as bitmaps (${pdfImageCount(buf)} image objects)`);
        // page.pdf() fired afterprint: Ctrl+P is the station cards again.
        eq(await page.evaluate(() => [...document.querySelectorAll('.print-only.active')].map(x => x.id).join(',')), 'print-station-area', `${what}: once printed, the station cards are the sheet again`);
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
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Stop</b> "one"';
  const evil2 = '</td><script>window.__pwned=1</script> & more';
  const st = stationsOf(2);
  Object.assign(st[0], { label: evil, content: evil2, note: evil, hint: evil2, qType: 'choice', choices: [evil, 'Plain'], codeWord: 'A<b>B' });
  const teams = teamsOf(2);
  teams[0].name = evil;
  const page = await open(browser, huntOf(st, teams));
  try {
    for (const b of BUTTONS) await press(page, b);
    const r = await page.evaluate(() => {
      const q = (sel, i = 0) => { const x = document.querySelectorAll(sel)[i]; return x ? x.textContent : null; };
      const sheet = document.getElementById('printArea');
      return {
        station: q('#print-station-grid .p-label'), choice: document.querySelector('#print-station-grid .p-choices').childNodes[0].textContent,
        clue: q('#print-clues-grid .p-clue-text'), word: q('#print-clues-grid .p-code-word span'),
        key: [...document.querySelector('#answer-key-body tr').cells].map(c => c.textContent),
        team: q('#print-teams-grid .p-label'), route: q('#print-routes-grid .p-label'), routeStop: [...document.querySelectorAll('#print-routes-grid .p-card:first-child .p-route li')].map(x => x.textContent),
        sheet: q('#print-answersheets-grid .p-label'), sheetStop: document.querySelector('#print-answersheets-grid tbody td:nth-child(2)').childNodes[0].textContent,
        injected: sheet.querySelectorAll('img, b, script').length, pwned: !!window.__pwned,
      };
    });
    eq(r.station, evil, 'a station name reaches its card character for character');
    eq(r.choice, 'A. ' + evil, 'and so does a choice');
    eq(r.clue, evil2, 'the clue reaches the clue card the same way');
    eq(r.word, 'A<b>B', 'and the code word');
    eq(r.key.slice(1, 4).join('|'), [evil, evil2, evil].join('|'), 'name, content and note reach the answer key as text');
    ok(r.key[4].endsWith('Hint (−1 min if used): ' + evil2) || r.key[4].includes(evil2), 'and the hint');
    eq(r.key[5], 'A<b>B', 'and the code word');
    eq(r.team, evil, 'a team name reaches its check-in card as text');
    eq(r.route, evil, 'and its route card');
    ok(r.routeStop.includes(evil), 'whose stops are station names as text');
    eq(r.sheet, evil, 'and its answer sheet');
    eq(r.sheetStop, evil, 'whose rows are station names as text');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
    eq((await decodeAll(page, 'print-station-area'))[0], evil2, 'the QR code carries the content as typed');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- the station sheet follows the editor; printing twice ---------------------------
{
  const page = await open(browser, huntOf(stationsOf(5), teamsOf(3)));
  try {
    await press(page, BUTTONS[0]);
    await press(page, BUTTONS[0]);
    eq(await page.locator('#print-station-grid > *').count(), 2, 'printing again replaces the sheet, it does not add to it');
    eq(await page.locator('#print-station-grid .p-card').count(), 5, 'with the five cards once each');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');

    await page.fill('#stations-body tr[data-idx="0"] .f-label', 'Front office');
    await page.fill('#stations-body tr[data-idx="0"] .f-content', 'Ask for the red folder');
    await settle(page, 400);
    eq(await page.evaluate(() => document.querySelector('#print-station-grid .p-label').textContent), 'Front office', 'typing a station name rebuilds the hidden sheet, with no button pressed');
    eq((await decodeAll(page, 'print-station-area'))[0], 'Ask for the red folder', 'and typing its content redraws its QR code');

    await page.selectOption('#cards-per-page', '9');
    await settle(page, 400);
    eq(await page.evaluate(() => document.querySelector('#print-station-grid > *').style.getPropertyValue('--pk-cols')), '3', 'choosing nine to a page puts the sheet three across');
    await page.uncheck('#show-number');
    await settle(page, 400);
    eq(await page.locator('#print-station-grid .p-num').count(), 0, 'turning the station numbers off takes them off the sheet');

    await press(page, BUTTONS[3]);
    eq(await page.evaluate(() => [...document.querySelectorAll('.print-only.active')].map(x => x.id).join(',')), 'print-teams-area', 'a button shows its own sheet until it has printed');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `the sheet follows the editor: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- Ctrl+P: Chromium's own print path, with no button pressed --------------------
{
  const page = await open(browser, huntOf(stationsOf(5), teamsOf(3)));
  try {
    const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(buf), 2, 'printing with no button pressed prints the station cards, five on two pages (it printed one empty page)');
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
    eq(await page.locator('#print-station-grid > *').count(), 0, 'with no stations there is no sheet');
    eq(await page.evaluate(() => ['print-stations-btn', 'print-answers-btn', 'print-clues-btn'].every(id => document.getElementById(id).disabled)), true, 'and the Build tab\'s three print buttons are off');
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
