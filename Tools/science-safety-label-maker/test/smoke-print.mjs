// smoke-print.mjs — 074 prints through the shared print kit (Path 7 P3).
//
//   node Tools/science-safety-label-maker/test/smoke-print.mjs
//
// 074 is the kit's seventh adopter, the second card grid, and the first
// caller of `PrintKit.renderCards()` with a grid of its own. It already
// printed through _shared/print-area.css; what it had of its own was the grid
// (`.label-grid.size-small/medium/large`, 4, 3 or 2 across) and
// `page-break-inside: avoid`. Those are now _shared/print-kit.css's
// `.pk-cards` and `.pk-card`. What it keeps is the label's size: a label is
// 1.5, 2 or 2.75 in tall at the least, whatever the paper, so the grid is
// `pk-cards-own` (the kit gives its cards no height) and runs on over the
// pages instead of being cut into one grid per page.
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - "Print labels" builds one grid of every queued label, `qty` times, in
//     queue order, each with its symbol and its text
//   - a printed label is the size it was: the old page's width and height on
//     the same paper; a long label makes its row taller and nothing clips
//   - Chromium's PDF page count, per state, in light and in dark, is what the
//     old page printed on the same half-inch margins (measured on the old page
//     from `git show origin/main:` before it was replaced). The old page had
//     no @page rule; `noMargin` is its count with no page margin at all, where
//     a fifth row of medium labels fitted, for the record
//   - what the teacher typed reaches the label as text, never as markup
//   - only the sheet has a box on paper, the paper is white, the text black,
//     and a symbol keeps its light-theme colour from the dark theme
//   - Ctrl+P (`beforeprint`) builds the sheet too
//
// print() is stubbed. Nothing here has been checked against a printer, and
// no label stock has been tried.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8473;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '074-science-safety-label-maker.html';
const KEY = 'sslm_queue_v1';
const IN = 96;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 0.6) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ± ${tol})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const SYMS = ['flammable', 'corrosive', 'toxic', 'biohazard', 'electrical', 'sharp', 'eyeprotect', 'hot', 'fragile', 'none'];
const LONG = 'Hydrochloric acid 1 M, teacher use only, return to locked cabinet B after every period and sign the log on the door';
/** n labels as queue rows of up to seven copies, a different symbol on each row. */
function queueOf(n, extra = []) {
  const items = [];
  for (let left = n, i = 0; left > 0; i++) {
    const qty = Math.min(left, 7);
    items.push({ id: 'l' + i, symbol: SYMS[i % SYMS.length], text: 'Shelf ' + (i + 1), qty });
    left -= qty;
  }
  return items.concat(extra);
}
const longRow = { id: 'x', symbol: 'corrosive', text: LONG, qty: 1 };
const expand = queue => queue.flatMap(item => Array(item.qty).fill(item));

// The size of a label on Letter with half-inch margins: the columns share the
// 7.5 in between the margins less the 0.2 in gaps; the height is the tool's.
const SIZE = {
  small: { cols: 4, h: 1.5 * IN, svg: 44 },
  medium: { cols: 3, h: 2 * IN, svg: 44 },
  large: { cols: 2, h: 2.75 * IN, svg: 60 },
};
const PAGE_W = 7.5 * IN, GAP = 0.2 * IN;
for (const s of Object.values(SIZE)) s.w = (PAGE_W - (s.cols - 1) * GAP) / s.cols;

// `pages` is what the old page printed for the same state in Chromium's PDF
// on half-inch margins (2026-10-04, before the adoption), and what this one
// prints. `noMargin` is the old page's count with no page margin at all.
const STATES = [
  { size: 'small', n: 1, pages: 1 },
  { size: 'small', n: 24, pages: 1 },
  { size: 'small', n: 25, pages: 2 },
  { size: 'small', n: 61, pages: 3 },
  { size: 'small', n: 8, long: true, pages: 1, grows: true },
  { size: 'medium', n: 3, pages: 1 },
  { size: 'medium', n: 12, pages: 1 },
  { size: 'medium', n: 13, pages: 2, noMargin: 1 },
  { size: 'medium', n: 30, pages: 3, noMargin: 2 },
  { size: 'medium', n: 61, pages: 6, noMargin: 5 },
  { size: 'medium', n: 8, long: true, pages: 1, grows: true },
  { size: 'large', n: 6, pages: 1 },
  { size: 'large', n: 7, pages: 2 },
  { size: 'large', n: 30, pages: 5 },
  { size: 'large', n: 8, long: true, pages: 2 },
].map(s => ({ ...s, queue: queueOf(s.n, s.long ? [longRow] : []), name: `${s.long ? s.n + 1 : s.n} ${s.size} label${s.n === 1 ? '' : 's'}${s.long ? ', one long' : ''}` }));

/** Opens 074 at the printable width of the page, so a label measured in print
    media is the size it is on paper. */
async function open(browser, saved, theme) {
  const page = await prepPage(browser, BASE, { width: PAGE_W, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([key, value, dark]) => {
    if (value) localStorage.setItem(key, value);
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [KEY, saved ? JSON.stringify(saved) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

console.log('074 — the safety labels print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/\.label-grid|break-inside|grid-template-columns:\s*repeat/.test(src.replace(/\.add-grid[^}]*\}/g, '')), 'the grid, the columns and the page-break rule are the kit\'s, not the page\'s');
ok(!/printArea\.innerHTML/.test(src), 'the sheet is not built from a string');
ok(/<div id="printArea" class="pk-paper"><\/div>\s*\n\s*<script>/.test(src) && /<\/div>\s*\n\s*<div id="printArea"/.test(src), '#printArea is a .pk-paper, written as a child of <body>');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const size = SIZE[s.size];
    const page = await open(browser, { queue: s.queue, labelSize: s.size }, theme);
    try {
      const want = expand(s.queue);
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      eq(await page.locator('#printArea > *').count(), 0, `${what}: and empty until something prints`);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      const built = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const grids = [...area.children];
        return {
          area: area.className,
          grids: grids.map(g => g.className).join('|'),
          cols: grids[0] ? grids[0].style.getPropertyValue('--pk-cols') : '',
          stray: area.querySelectorAll('.label-card').length - area.querySelectorAll('.pk-cards > .label-card.pk-card').length,
          cards: [...area.querySelectorAll('.label-card')].map(c => ({
            text: c.querySelector('.ltext').textContent,
            kids: c.children.length,
            svg: c.firstElementChild.namespaceURI === 'http://www.w3.org/2000/svg' && c.firstElementChild.localName === 'svg' && c.firstElementChild.childElementCount > 0,
            color: c.firstElementChild.getAttribute('style'),
          })),
        };
      });
      eq(built.area, `pk-paper size-${s.size}`, `${what}: #printArea is the kit's paper and carries the label size`);
      eq(built.grids, 'pk-cards pk-page pk-cards-own', `${what}: one grid of the tool's own, not one per page`);
      eq(built.cols, String(size.cols), `${what}: ${size.cols} across`);
      eq(built.stray, 0, `${what}: every label is a kit card, directly in the grid`);
      eq(built.cards.map(c => c.text).join('|'), want.map(i => i.text).join('|'), `${what}: every queued label, qty times, in queue order`);
      ok(built.cards.every(c => c.kids === 2 && c.svg), `${what}: each label is a drawn symbol and its text, nothing else`);
      ok(built.cards.every((c, i) => c.color === `color:var(--${{ flammable: 'err', corrosive: 'sym-corrosive', toxic: 'ink', biohazard: 'sym-biohazard', electrical: 'sym-electrical', sharp: 'muted', eyeprotect: 'accent-2', hot: 'err', fragile: 'accent-2', none: 'muted' }[want[i].symbol]})`), `${what}: each symbol is drawn in its own hazard colour`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await page.evaluate(() => {
        const area = document.getElementById('printArea');
        const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
        const cards = [...area.querySelectorAll('.label-card')];
        const clipped = [...area.querySelectorAll('*')].filter(x => {
          const cs = getComputedStyle(x);
          return cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1;
        });
        const cs = x => getComputedStyle(x);
        const top = cards[0].getBoundingClientRect().top;
        const corrosive = cards.find(c => /sym-corrosive/.test(c.firstElementChild.getAttribute('style')));
        const svg = cards[0].firstElementChild.getBoundingClientRect();
        return {
          outside: outside.length,
          first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
          widths: cards.map(x => x.getBoundingClientRect().width),
          heights: cards.map(x => x.getBoundingClientRect().height),
          across: cards.filter(x => Math.abs(x.getBoundingClientRect().top - top) < 1).length,
          rowGap: cards.length > cards.filter(x => Math.abs(x.getBoundingClientRect().top - top) < 1).length
            ? Math.min(...cards.map(x => x.getBoundingClientRect().top).filter(t => t > top + 1)) - Math.max(...cards.filter(x => Math.abs(x.getBoundingClientRect().top - top) < 1).map(x => x.getBoundingClientRect().bottom)) : null,
          clipped: clipped.length,
          spill: cards.filter(c => c.lastElementChild.getBoundingClientRect().bottom > c.getBoundingClientRect().bottom + 0.5 || c.lastElementChild.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5).length,
          squeezed: cards.filter(c => Math.abs(c.firstElementChild.getBoundingClientRect().height - svg.height) > 0.5).length,
          svg: [svg.width, svg.height].join('x'),
          keep: cs(cards[0]).breakInside,
          border: cs(cards[0]).borderTopColor,
          text: cs(cards[0].querySelector('.ltext')).color,
          sym: cs(cards[0].firstElementChild).color,
          corrosive: corrosive ? cs(corrosive.firstElementChild).color : '',
          areaBg: cs(area).backgroundColor,
        };
      });
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.spill, 0, `${what}: every label's text ends inside its border`);
      eq(m.across, Math.min(size.cols, want.length), `${what}: ${size.cols} labels across`);
      ok(m.widths.every(w => Math.abs(w - size.w) <= 0.6), `${what}: a label is ${(size.w / IN).toFixed(2)} in wide, as it was (${(Math.min(...m.widths) / IN).toFixed(2)} to ${(Math.max(...m.widths) / IN).toFixed(2)} in)`);
      ok(m.heights.every(h => h >= size.h - 0.6), `${what}: no label is shorter than ${size.h / IN} in`);
      if (s.grows) ok(Math.max(...m.heights) > size.h + 2, `${what}: the row with the long label grows instead of clipping (${Math.round(Math.max(...m.heights))} px)`);
      else ok(m.heights.every(h => Math.abs(h - size.h) <= 0.6), `${what}: a label is exactly ${size.h / IN} in tall, as it was, and not a share of the page`);
      if (m.rowGap !== null) near(m.rowGap, GAP, `${what}: rows are 0.2 in apart, the tool's gap and not the kit's`);
      eq(m.svg, `${size.svg}x${size.svg}`, `${what}: the symbol is ${size.svg} px`);
      eq(m.squeezed, 0, `${what}: no symbol is squeezed by its text`);
      eq(m.keep, 'avoid', `${what}: a label is not split across two pages`);
      eq(m.border, 'rgb(51, 51, 51)', `${what}: the label border is the tool's own dark grey`);
      eq(m.text, 'rgb(0, 0, 0)', `${what}: the text prints black`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      eq(m.sym, 'rgb(163, 55, 43)', `${what}: the flammable symbol prints in its light-theme red`);
      if (m.corrosive) eq(m.corrosive, 'rgb(192, 122, 26)', `${what}: the corrosive symbol prints in its light-theme amber, not the dark theme's`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
      eq(pdfPageCount(buf), s.pages, `${what}: Chromium prints the pages the old page did on half-inch margins${s.noMargin ? ` (${s.noMargin} with no margin, where another row fitted)` : ''}`);
      ok(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(buf.toString('latin1')), `${what}: on US Letter, portrait`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- text, not markup; a symbol this build does not have ------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Acids</b> "only"';
  const page = await open(browser, { labelSize: 'medium', queue: [
    { id: 'a', symbol: 'flammable', text: evil, qty: 2 },
    { id: 'b', symbol: 'no-such-symbol"><script>window.__pwned=1</script>', text: 'Bin 4', qty: 1 },
  ] });
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#printArea .label-card')];
      return {
        texts: cards.map(c => c.querySelector('.ltext').textContent),
        injected: document.querySelectorAll('#printArea img, #printArea b, #printArea script').length,
        fallback: cards[2].firstElementChild.getAttribute('style') + '|' + cards[2].firstElementChild.firstElementChild.localName,
        pwned: !!window.__pwned,
      };
    });
    eq(r.texts.join('|'), [evil, evil, 'Bin 4'].join('|'), 'label text reaches the label character for character');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.fallback, 'color:var(--muted)|rect', 'a symbol key this build does not know prints the plain equipment box');
    eq(r.pwned, false, 'nothing typed, and nothing in a symbol key, ran');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- printing twice, a change of size, Ctrl+P, a saved size nobody offers ---------
{
  const page = await open(browser, { queue: queueOf(13), labelSize: 'medium' });
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea .label-card').count(), 13, 'thirteen labels are thirteen cards');
    await page.selectOption('#sizeSelect', 'large');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 1, 'printing again replaces the grid, it does not add to it');
    eq(await page.locator('#printArea .label-card').count(), 13, 'with the thirteen labels once each');
    eq(await page.evaluate(() => document.getElementById('printArea').className + '|' + document.querySelector('#printArea > .pk-cards').style.getPropertyValue('--pk-cols')), 'pk-paper size-large|2', 'and at the size now chosen, two across');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');

    // Ctrl+P: the browser fires beforeprint and the page builds the sheet itself.
    await page.selectOption('#sizeSelect', 'small');
    await page.evaluate(() => { document.getElementById('printArea').replaceChildren(); window.dispatchEvent(new Event('beforeprint')); });
    eq(await page.evaluate(() => document.querySelectorAll('#printArea .label-card').length + '|' + document.getElementById('printArea').className), '13|pk-paper size-small', 'beforeprint builds the sheet, so Ctrl+P prints the labels');
    eq(await page.evaluate(() => window.__printCalls), 2, 'and does not call print() again');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `printing twice: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}
{
  // Chromium's own print path, with no button pressed: 25 small labels are two pages.
  const page = await open(browser, { queue: queueOf(25), labelSize: 'small' });
  try {
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 2, 'printing with no button pressed prints the sheet (it printed one empty page)');
  } catch (e) {
    ok(false, `Ctrl+P: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}
{
  const page = await open(browser, { queue: queueOf(3), labelSize: 'huge' });
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.evaluate(() => document.getElementById('printArea').className + '|' + document.querySelector('#printArea > .pk-cards').style.getPropertyValue('--pk-cols')), 'pk-paper size-medium|3', 'a saved size the tool does not offer prints medium, three across');
  } catch (e) {
    ok(false, `unknown size: ${String(e.message || e).split('\n')[0]}`);
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
    eq(dialogs.length, 1, 'with nothing queued, Print says so');
    ok(/label/i.test(dialogs[0] || ''), 'and names what is missing');
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
