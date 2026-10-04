// smoke-print.mjs — 070 prints through the shared print kit (Path 7 P3).
//
//   node Tools/peer-feedback-checklist-generator/test/smoke-print.mjs
//
// 070 is the kit's second adopter, after 076. It had its own `@media print`
// block: the editor hidden with `visibility`, checklists at `min-height: 47vh`,
// a page break after every second one, and two smaller type sizes for a long
// list. The first three are now _shared/print-area.css (the sheet alone on the
// paper) and _shared/print-kit.css + print-kit.js (`PrintKit.renderSet`, mode
// 'blank', half sheets, `cut: true`). The type sizes stay with the page, as
// plain rules: they are what a checklist looks like, not how a page is cut.
//
// What this pins:
//   - the page links the three shared files and has no print block of its own
//   - "Print checklists" builds one kit sheet per copy, the count clamped to 1..60
//   - two checklists to a page, the cut line under the upper one of each pair
//   - the type steps down at 12 and 18 lines, as it did
//   - a checklist that still runs long grows and takes its own page; nothing clips
//   - Chromium's PDF page count, per state, in light and in dark. Eight of the
//     ten are what the hand-written block printed (measured on the old page
//     before it was replaced); the two that differ say why, below
//   - what the teacher typed reaches the sheet as text, never as markup
//   - only the sheet has a box on paper, and the paper is black on white
//   - with no category left it says so and prints nothing
//
// print() is stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8468;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '070-peer-feedback-checklist-generator.html';
const KEY = 'pfc_checklist_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const LONG = 'Describe in detail everything that the writer does in this part of the draft including transitions, evidence, ' +
  'the questions a reader would ask, and what you would change next time if you were to write this piece again tomorrow';
const cats = (nc, ni, text) => Array.from({ length: nc }, (_, c) => ({
  id: 'c' + c, name: 'Category ' + (c + 1),
  items: Array.from({ length: ni }, (_, i) => ({ id: `i${c}_${i}`, text: text || `Checklist item ${i + 1} of category ${c + 1}` })),
}));
const checklist = (copyCount, ratingStyle, categories, assignmentName = 'Essay') => ({ assignmentName, copyCount, ratingStyle, categories });

// `pages` is Chromium's PDF page count now; `was` is what the old hand-written
// print block produced for the same state (2026-10-04, before the adoption),
// given only where the two differ. `size` is the type step: a checklist's
// weight is its categories plus its lines, '' up to 11, compact to 17, tight
// past that.
const STATES = [
  { name: 'a first visit', state: null, copies: 6, size: 'compact', three: false, cats: 3, items: 9, pages: 3 },
  { name: 'six copies, nine lines', state: checklist(6, 'check', cats(3, 3), 'Narrative Draft 1'), copies: 6, size: 'compact', pages: 3 },
  { name: 'five copies, six lines, no title', state: checklist(5, 'check', cats(3, 2), ''), copies: 5, size: '', pages: 3 },
  { name: 'four copies, yes / somewhat / no', state: checklist(4, 'three', cats(3, 3)), copies: 4, size: 'compact', pages: 2 },
  { name: 'four copies, sixteen lines', state: checklist(4, 'check', cats(4, 4)), copies: 4, size: 'tight', pages: 4, grows: true },
  { name: 'four copies, sixteen lines, three boxes', state: checklist(4, 'three', cats(4, 4)), copies: 4, size: 'tight', pages: 4, grows: true },
  // 36 lines and headings are 966 px of checklist. The old block had no @page
  // rule, so page.pdf() gave it the whole 11 in (1056 px) and it just fitted;
  // on the kit's half-inch margins the printable page is 960 px and the last
  // comment rule goes over. The margin is the whole difference: the old page
  // printed through page.pdf() with half-inch margins was 8 pages as well.
  { name: 'four copies, thirty lines', state: checklist(4, 'check', cats(6, 5)), copies: 4, size: 'tight', pages: 8, was: 4, grows: true },
  { name: 'four copies, nine wordy lines', state: checklist(4, 'check', cats(3, 3, LONG)), copies: 4, size: 'compact', pages: 4, grows: true },
  // The old block left the hidden editor's height in the flow, and one
  // checklist printed with a blank page after it. v228 fixed that on fifteen
  // pages; 070 was missed because six copies outrun the editor.
  { name: 'one copy', state: checklist(1, 'check', cats(3, 3)), copies: 1, size: 'compact', pages: 1, was: 2 },
  { name: 'a saved count past the limit', state: checklist(99, 'check', cats(3, 3)), copies: 60, size: 'compact', pages: 30 },
];

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

console.log('070 — the peer feedback checklists print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');
ok(/cut:\s*true/.test(src) && !/classList\.add\('pk-cut'\)/.test(src), 'asks renderSet() for the cut line and does not place it itself');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, s.state, theme);
    try {
      const three = s.state ? s.state.ratingStyle === 'three' : s.three;
      const nCats = s.state ? s.state.categories.length : s.cats;
      const nItems = s.state ? s.state.categories.reduce((n, c) => n + c.items.length, 0) : s.items;
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      const built = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const sheets = [...area.children];
        return {
          n: sheets.length,
          classes: [...new Set(sheets.map(x => x.className.replace(/\s*pk-cut/, '')))],
          cut: sheets.map((x, i) => x.classList.contains('pk-cut') ? i : -1).filter(i => i >= 0),
          lists: area.querySelectorAll('.pk-sheet > .half-sheet').length,
          sizes: [...new Set([...area.querySelectorAll('.half-sheet')].map(x => x.className))],
          chrome: area.querySelectorAll('.pk-header, .pk-footer').length,
          title: area.querySelector('h3').textContent,
          names: area.querySelector('.names').textContent,
          cats: area.querySelectorAll('.pk-sheet:first-child .pf-cat').length,
          items: area.querySelectorAll('.pk-sheet:first-child .pf-item').length,
          boxes: area.querySelectorAll('.pk-sheet:first-child .pf-item .box').length,
          tris: area.querySelectorAll('.pk-sheet:first-child .pf-item .tri').length,
          legends: area.querySelectorAll('.tri-legend').length,
          legend: (area.querySelector('.tri-legend') || {}).textContent || '',
          lines: area.querySelectorAll('.pk-sheet:first-child .comments-line').length,
        };
      });
      eq(built.n, s.copies, `${what}: one sheet per copy`);
      eq(built.lists, s.copies, `${what}: each sheet holds one checklist`);
      eq(built.classes.join('|'), 'pk-half pk-sheet pk-sheet-blank', `${what}: the sheets are the kit's half sheets`);
      eq(built.cut.join(','), Array.from({ length: Math.ceil(s.copies / 2) }, (_, i) => i * 2).join(','), `${what}: the cut line is under the upper checklist of each pair`);
      eq(built.sizes.join('|'), ('half-sheet ' + s.size).trim(), `${what}: the type size follows the length of the list`);
      eq(built.chrome, 0, `${what}: no kit header or footer (the checklist has its own title and names line)`);
      eq(built.title, s.state ? (s.state.assignmentName || 'Peer Feedback Checklist') : 'Peer Feedback Checklist', `${what}: the title is the assignment, or the default`);
      ok(/^Author: _+   Reviewer: _+$/.test(built.names), `${what}: an author and a reviewer rule to write on`);
      eq(built.cats, nCats + 1, `${what}: every category, and Comments after them`);
      eq(built.items, nItems, `${what}: every line`);
      eq(built.boxes, nItems * (three ? 3 : 1), `${what}: ${three ? 'three boxes' : 'one box'} per line`);
      eq(built.tris, three ? nItems : 0, `${what}: the Y / S / N group follows the rating style`);
      eq(built.legends, three ? s.copies : 0, `${what}: the legend is there only with three boxes`);
      if (three) eq(built.legend, 'Mark one box per line: Y = yes · S = somewhat · N = not yet', `${what}: the legend reads as it did`);
      eq(built.lines, 2, `${what}: two comment rules`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const px = v => parseFloat(v);
        const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
        const sheets = [...area.children];
        const clipped = [...area.querySelectorAll('*')].filter(x => {
          const cs = getComputedStyle(x);
          return cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1;
        });
        const ink = x => getComputedStyle(x);
        return {
          outside: outside.length,
          first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
          heights: sheets.map(x => x.getBoundingClientRect().height),
          listHeights: sheets.map(x => x.firstElementChild.getBoundingClientRect().height),
          clipped: clipped.length,
          font: px(ink(area.querySelector('.half-sheet')).fontSize),
          heading: ink(area.querySelector('.pf-cat h4')).color,
          names: ink(area.querySelector('.names')).color,
          rule: ink(area.querySelector('.comments-line')).borderBottomColor,
          box: ink(area.querySelector('.box')).borderTopColor,
          cutStyle: ink(sheets[0]).borderBottomStyle,
          lastCut: px(ink(sheets[sheets.length - 1]).borderBottomWidth),
          areaBg: ink(area).backgroundColor,
        };
      });
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.heading, 'rgb(0, 0, 0)', `${what}: the category headings print black`);
      eq(m.names, 'rgb(0, 0, 0)', `${what}: the names line prints black`);
      eq(m.rule, 'rgb(0, 0, 0)', `${what}: the comment rules print black`);
      eq(m.box, 'rgb(0, 0, 0)', `${what}: the boxes print black`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      const wantFont = { '': 16, compact: 14.08, tight: 12.16 }[s.size];
      ok(Math.abs(m.font - wantFont) < 0.01, `${what}: the type is ${wantFont} px on paper (got ${m.font})`);
      // (11in - 2 x 0.5in - 0.04in) / 2 at 96 px to the inch.
      const half = (11 - 1 - 0.04) / 2 * 96;
      ok(m.heights.every(h => h >= half - 1), `${what}: every half sheet is at least half the printable page (${Math.round(Math.min(...m.heights))} px of ${Math.round(half)})`);
      if (s.grows) ok(m.heights.every(h => h > half + 20), `${what}: a checklist too long for half a page grows instead of clipping`);
      else ok(m.heights.every(h => Math.abs(h - half) <= 1), `${what}: a checklist that fits is exactly a half sheet`);
      eq(m.cutStyle, 'dashed', `${what}: the cut line is dashed`);
      if (s.copies % 2 === 0) eq(m.lastCut, 0, `${what}: no line along the foot of the page`);
      ok(m.heights.every((h, i) => h >= m.listHeights[i]), `${what}: every sheet is as tall as its checklist`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, s.pages, `${what}: Chromium prints ${s.pages} page${s.pages === 1 ? '' : 's'}${s.was ? ` (the old block printed ${s.was})` : ', as the old block did'}`);
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
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>bold</b>';
  const page = await open(browser, checklist(2, 'three', [{ id: 'a', name: '<i>Data</i> & "units"', items: [{ id: 'b', text: evil }] }], '<u>Lab</u> & <script>window.__pwned=1</script>'));
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await page.evaluate(() => {
      const area = document.getElementById('printArea');
      const item = area.querySelector('.pf-item');
      return {
        title: area.querySelector('h3').textContent,
        cat: area.querySelector('.pf-cat h4').textContent,
        item: item.lastChild.nodeValue,
        injected: area.querySelectorAll('img, i, u, script, .pf-item b').length,
        pwned: !!window.__pwned,
      };
    });
    eq(r.title, '<u>Lab</u> & <script>window.__pwned=1</script>', 'the assignment title reaches the sheet character for character');
    eq(r.cat, '<i>Data</i> & "units"', 'a category name reaches the sheet character for character');
    eq(r.item, evil, 'a line reaches the sheet character for character');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- printing twice, then with nothing to print ---------------------------------
{
  const page = await open(browser, null);
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-half').count(), 6, 'a first visit prints six half sheets');
    await page.fill('#copyCount', '3');
    await page.selectOption('#ratingStyle', 'three');
    await page.fill('#assignmentName', 'Draft 2');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 3, 'printing again replaces the sheets, it does not add to them');
    eq(await page.locator('#printArea > .pk-cut').count(), 2, 'three sheets carry two cut lines, the first and the third');
    eq(await page.locator('#printArea .tri-legend').count(), 3, 'and the new rating style is on every one');
    eq(await page.locator('#printArea h3').first().textContent(), 'Draft 2', 'under the new title');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');

    for (let i = 0; i < 3; i++) await page.locator('[data-del-cat]').first().click();
    await settle(page, 100);
    eq(await page.locator('#categoriesWrap .category').count(), 0, 'with every category removed');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(dialogs.length, 1, 'Print says there is nothing to print');
    ok(/add a category/i.test(dialogs[0] || ''), 'and what to do about it');
    eq(await page.evaluate(() => window.__printCalls), 2, 'and print() is not called');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `printing twice: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
