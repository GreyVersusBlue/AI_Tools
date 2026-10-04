// smoke-print.mjs — 077 prints through the shared print kit (Path 7 P3).
//
//   node Tools/testing-accommodations-card-generator/test/smoke-print.mjs
//
// 077 is the kit's third adopter and the first to use its card grids. It
// already printed through _shared/print-area.css; what it had of its own was
// the grid (`.card-grid.cols-2/3/4`), a 2.6 in minimum card height and
// `break-inside: avoid`. Those are now _shared/print-kit.css's `.pk-cards`,
// `.pk-card` and `.pk-page`: one grid to a page, cut by `PrintKit.chunk()`,
// three rows of 2, 3 or 4 across (the kit's 2x3, 3x3 and 4x3 presets).
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - "Print cards" builds one grid per page of cards, in roster order, each
//     card with its student's ticked accommodations and note
//   - a card is a third of the printable page; a long note makes it taller and
//     nothing clips
//   - Chromium's PDF page count, per state, in light and in dark, is what the
//     old page printed on the same half-inch margins (measured on the old page
//     before it was replaced). The old page had no @page rule, and with no
//     margin at all page.pdf() fitted a fourth row on a page; `noMargin` is
//     that count where it differs, for the record
//   - what the teacher typed reaches the card as text, never as markup
//   - only the sheet has a box on paper, and the paper is black on white
//
// The Show filter and the print picker are smoke-filter.mjs's. print() is
// stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8469;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '077-testing-accommodations-card-generator.html';
const KEY = 'tacg_cards_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const names = n => Array.from({ length: n }, (_, i) => `Student Number${String(i + 1).padStart(2, '0')}`);
const TYPES = ['Extended time', 'Separate setting', 'Read-aloud', 'Breaks as needed', 'Use of calculator', 'Preferential seating']
  .map((name, i) => ({ id: 'x' + i, name }));
/** n students; student i has type k ticked when (i + k) is even, or every type with `all`. */
function cardSet(n, { notes = {}, all = false, none = false } = {}) {
  const roster = names(n), assignments = {};
  if (!none) roster.forEach((name, i) => TYPES.forEach((t, k) => { if (all || (i + k) % 2 === 0) assignments[name + '|' + t.id] = true; }));
  return { roster, types: TYPES, assignments, notes };
}
const LONG_NOTE = Array(40).fill('Seat near the door; reader for all directions.').join(' ');

// `pages` is what the old page printed for the same state in Chromium's PDF
// on half-inch margins (2026-10-04, before the adoption), and what this one
// prints. `noMargin` is the old page's count with no page margin at all.
const STATES = [
  { name: '3 students, 3 across', state: cardSet(3, { notes: { 'Student Number01': '1.5x on unit tests' } }), cols: '3', pages: 1 },
  { name: '9 students, 3 across', state: cardSet(9), cols: '3', pages: 1 },
  { name: '10 students, 3 across', state: cardSet(10), cols: '3', pages: 2, noMargin: 1 },
  { name: '28 students, 3 across', state: cardSet(28), cols: '3', pages: 4, noMargin: 3 },
  { name: '28 students, 2 across', state: cardSet(28), cols: '2', pages: 5, noMargin: 4 },
  { name: '28 students, 4 across, every box ticked', state: cardSet(28, { all: true }), cols: '4', pages: 3, noMargin: 2 },
  { name: '12 students, 4 across', state: cardSet(12), cols: '4', pages: 1 },
  { name: '13 students, 4 across', state: cardSet(13), cols: '4', pages: 2, noMargin: 1 },
  { name: '7 students, 2 across, nothing ticked', state: cardSet(7, { none: true }), cols: '2', pages: 2, noMargin: 1 },
  { name: 'one student picked from 28', state: cardSet(28), cols: '3', who: 'Student Number05', pages: 1 },
  { name: '9 students, a long note, 3 across', state: cardSet(9, { notes: { 'Student Number01': LONG_NOTE } }), cols: '3', pages: 2, grows: true },
  { name: '9 students, a long note, 4 across', state: cardSet(9, { notes: { 'Student Number01': LONG_NOTE } }), cols: '4', pages: 2, grows: true },
];
const PRESET = { 2: { cls: 'pk-cards-2x3', per: 6 }, 3: { cls: 'pk-cards-3x3', per: 9 }, 4: { cls: 'pk-cards-4x3', per: 12 } };

async function open(browser, state, theme) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([key, saved, dark]) => {
    if (saved) localStorage.setItem(key, saved);
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [KEY, state ? JSON.stringify(state) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

console.log('077 — the accommodation cards print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');
ok(!/\.card-grid|break-inside|min-height:\s*2\.6in/.test(src), 'the grid, the card height and the page-break rule are the kit\'s, not the page\'s');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, s.state, theme);
    try {
      const want = s.who ? [s.who] : s.state.roster;
      const preset = PRESET[s.cols];
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      await page.selectOption('#printColsSelect', s.cols);
      if (s.who) await page.selectOption('#printWhoSelect', s.who);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      const built = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const grids = [...area.children];
        return {
          classes: [...new Set(grids.map(g => g.className))],
          sizes: grids.map(g => g.children.length),
          stray: area.querySelectorAll('.accom-card').length - area.querySelectorAll('.pk-cards > .accom-card.pk-card').length,
          cards: [...area.querySelectorAll('.accom-card')].map(c => ({
            name: c.querySelector('h3').textContent,
            items: [...c.querySelectorAll('li')].map(li => li.textContent),
            note: c.querySelector('.note') ? c.querySelector('.note').textContent : '',
          })),
        };
      });
      const wantSizes = [];
      for (let left = want.length; left > 0; left -= preset.per) wantSizes.push(Math.min(left, preset.per));
      eq(built.classes.join('|'), `pk-cards pk-page ${preset.cls}`, `${what}: every grid is the kit's ${preset.cls}, one to a page`);
      eq(built.sizes.join(','), wantSizes.join(','), `${what}: ${preset.per} cards to a grid, the rest on the last`);
      eq(built.stray, 0, `${what}: every card is a kit card, directly in a grid`);
      eq(built.cards.map(c => c.name).join('|'), want.join('|'), `${what}: one card per student, in roster order`);
      const wantItems = name => {
        const ticked = s.state.types.filter(t => s.state.assignments[name + '|' + t.id]).map(t => t.name);
        return ticked.length ? ticked : ['No accommodations selected'];
      };
      ok(built.cards.every(c => c.items.join('|') === wantItems(c.name).join('|')), `${what}: each card lists its student's ticked accommodations, or says there are none`);
      ok(built.cards.every(c => c.note === (s.state.notes[c.name] || '')), `${what}: a note is on its student's card and on no other`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
        const cards = [...area.querySelectorAll('.accom-card')];
        const clipped = [...area.querySelectorAll('*')].filter(x => {
          const cs = getComputedStyle(x);
          return cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1;
        });
        const ink = x => getComputedStyle(x);
        const first = area.firstElementChild;
        const top = first.firstElementChild.getBoundingClientRect().top;
        const note = area.querySelector('.note');
        return {
          outside: outside.length,
          first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
          heights: cards.map(x => x.getBoundingClientRect().height),
          across: [...first.children].filter(x => Math.abs(x.getBoundingClientRect().top - top) < 1).length,
          inFirst: first.children.length,
          clipped: clipped.length,
          spill: cards.filter(c => c.lastElementChild.getBoundingClientRect().bottom > c.getBoundingClientRect().bottom + 0.5).length,
          keep: ink(cards[0]).breakInside,
          border: ink(cards[0]).borderTopColor,
          rule: ink(cards[0].querySelector('h3')).borderBottomColor,
          text: ink(cards[0].querySelector('li')).color,
          note: note ? ink(note).color : '',
          areaBg: ink(area).backgroundColor,
        };
      });
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.spill, 0, `${what}: every card's last line ends inside the card`);
      eq(m.across, Math.min(+s.cols, m.inFirst), `${what}: ${s.cols} cards across`);
      eq(m.keep, 'avoid', `${what}: a card is not split across two pages`);
      eq(m.border, 'rgb(0, 0, 0)', `${what}: the card border prints black`);
      eq(m.rule, 'rgb(0, 0, 0)', `${what}: the rule under the name prints black`);
      eq(m.text, 'rgb(0, 0, 0)', `${what}: the list prints black`);
      if (m.note) eq(m.note, 'rgb(0, 0, 0)', `${what}: the note prints black`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      // Three rows in (11in - 2 x 0.5in - 0.04in), less two 0.125in gaps, at 96 px to the inch.
      const third = ((11 - 1 - 0.04) * 96 - 2 * 12) / 3;
      ok(m.heights.every(h => h >= third - 1), `${what}: every card is at least a third of the printable page (${Math.round(Math.min(...m.heights))} px of ${Math.round(third)})`);
      if (s.grows) ok(Math.max(...m.heights) > third + 100, `${what}: the card with the long note grows instead of clipping (${Math.round(Math.max(...m.heights))} px)`);
      else ok(m.heights.every(h => Math.abs(h - third) <= 1), `${what}: a card that fits is exactly a third`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, s.pages, `${what}: Chromium prints the pages the old page did on half-inch margins${s.noMargin ? ` (${s.noMargin} with no margin, where a fourth row fitted)` : ''}`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- text, not markup ---------------------------------------------------------
{
  const evilName = '<img src=x onerror="window.__pwned=1"> & Co';
  const evilType = '<b>Extended</b> time & "breaks"';
  const evilNote = '<script>window.__pwned=1</script> <i>see plan</i>';
  const page = await open(browser, {
    roster: [evilName, 'Ada Lovelace'], types: [{ id: 'x1', name: evilType }],
    assignments: { [evilName + '|x1']: true }, notes: { [evilName]: evilNote },
  });
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await page.evaluate(() => {
      const card = document.querySelector('#printArea .accom-card');
      return {
        name: card.querySelector('h3').textContent,
        item: card.querySelector('li').textContent,
        note: card.querySelector('.note').textContent,
        injected: document.querySelectorAll('#printArea img, #printArea b, #printArea i, #printArea script').length,
        pwned: !!window.__pwned,
      };
    });
    eq(r.name, evilName, 'a student name reaches the card character for character');
    eq(r.item, evilType, 'an accommodation reaches the card character for character');
    eq(r.note, evilNote, 'a note reaches the card character for character');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- printing twice, and with nothing to print ----------------------------------
{
  const page = await open(browser, cardSet(13));
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-cards-3x3').count(), 2, 'thirteen cards at the default three across are two grids');
    await page.selectOption('#printColsSelect', '4');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 2, 'printing again replaces the grids, it does not add to them');
    eq(await page.locator('#printArea > .pk-cards-4x3').count(), 2, 'and both are four across now');
    eq(await page.locator('#printArea .accom-card').count(), 13, 'with the thirteen cards once each');
    await page.selectOption('#printWhoSelect', 'Student Number02');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea .accom-card').count(), 1, 'one student picked is one card');
    eq(await page.evaluate(() => window.__printCalls), 3, 'print() was called once per press');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `printing twice: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}
{
  const page = await open(browser, null);
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(dialogs.length, 1, 'with no roster, Print says so');
    ok(/roster/i.test(dialogs[0] || ''), 'and names what is missing');
    eq(await page.evaluate(() => window.__printCalls), 0, 'and print() is not called');
    eq(await page.locator('#printArea > *').count(), 0, 'and no sheet is built');
  } catch (e) {
    ok(false, `nothing to print: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
