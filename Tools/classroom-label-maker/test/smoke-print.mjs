// smoke-print.mjs — 051 prints through the shared print kit (Path 7 P3).
//
//   node Tools/classroom-label-maker/test/smoke-print.mjs
//
// 051 is the kit's eighth adopter and the third card grid. Its labels are
// three across and 1.4 in tall at the least, a size and not a share of the
// page, so like 074 it calls `PrintKit.renderCards()` with a grid of its own
// (`{ cols: 3 }`, `pk-cards-own`): the kit gives the grid, the columns and
// `break-inside`, the page keeps the label's `min-height` and its 0.2 in gap.
// Its `@media print` block is gone; _shared/print-area.css hides the editor.
// It is the first adopter with a second thing on the same sheet: the
// reference table, which follows the grid on a page of its own because the
// grid is a `.pk-page` that is not the last child.
//
// It is also the first adopter that prints a <canvas> (the QR code on each
// label), and that is why it does NOT build its sheet on `beforeprint` as 042
// and 074 do: a canvas drawn inside that event reaches Chromium's PDF as
// replayed drawing commands, not as the bitmap, and the code came out about
// 4% smaller than the one the button printed. The hidden sheet is kept
// current instead, rebuilt on every change to the words or the language.
//
// What this pins:
//   - the page links the three shared files and has no print rule of its own
//   - the sheet is one grid of every word in list order, each label a QR code
//     that decodes to that word's speak.html link, then the reference table
//   - a printed label is the size it was: the old page's width and height on
//     the same paper; a long word makes its row taller and nothing clips
//   - Chromium's PDF page count, per state, in light and in dark, is what the
//     old page printed on the same half-inch margins (measured on the old page
//     from `git show origin/main:` before it was replaced). The old page had
//     no @page rule; `noMargin` is its count with no page margin at all, where
//     a seventh row of labels fitted, for the record
//   - what the teacher typed reaches the label and the table as text
//   - only the sheet has a box on paper, the paper is white, the text black
//   - Ctrl+P prints the sheet, with the QR codes as bitmaps
//
// print() is stubbed. Nothing here has been checked against a printer, no
// label stock has been tried, and no phone has scanned a printed code: the
// decode below is jsQR reading the canvas, not a camera reading paper.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8474;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '051-classroom-label-maker.html';
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
const pdfImageCount = buf => (buf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length;

// Made-up vocabulary. One pair is long enough to wrap a label three times.
const LONG = { target: 'el sacapuntas eléctrico de la mesa del profesor', english: 'the electric pencil sharpener on the teacher’s desk (ask before using it)' };
function wordsOf(n, long) {
  const w = [];
  for (let i = 0; i < n; i++) w.push({ target: 'la palabra ' + (i + 1), english: 'word ' + (i + 1) });
  if (long) w.splice(1, 0, LONG);
  return w;
}
const speakUrl = (target, lang) => {
  const u = new URL(`${BASE}/Tools/classroom-label-maker/speak.html`);
  u.searchParams.set('text', target);
  u.searchParams.set('lang', lang);
  return u.href;
};

// The size of a label on Letter with half-inch margins: three share the
// 7.5 in between the margins less two 0.2 in gaps; the height is the tool's.
const PAGE_W = 7.5 * IN, GAP = 0.2 * IN, COLS = 3;
const LABEL_W = (PAGE_W - (COLS - 1) * GAP) / COLS, LABEL_H = 1.4 * IN, QR = 0.9 * IN;

// `pages` is what the old page printed for the same state in Chromium's PDF
// on half-inch margins (2026-10-04, before the adoption), and what this one
// prints: the labels at eighteen to a page, then the reference sheet.
// `noMargin` is the old page's count with no page margin at all.
const STATES = [
  { n: 1, pages: 2 },
  { n: 3, pages: 2 },
  { n: 4, pages: 2 },
  { n: 14, long: true, pages: 2, grows: true },
  { n: 18, pages: 2 },
  { n: 19, pages: 3, noMargin: 2 },
  { n: 21, pages: 3, noMargin: 2 },
  { n: 22, pages: 3 },
  { n: 39, pages: 5, noMargin: 4 },
  { n: 40, pages: 5, noMargin: 4 },
  { n: 61, pages: 7, noMargin: 6 },
  { n: 120, pages: 12, noMargin: 11 },
].map(s => ({ ...s, words: wordsOf(s.n, s.long), name: `${s.long ? s.n + 1 : s.n} label${s.n === 1 ? '' : 's'}${s.long ? ', one long' : ''}` }));

/** Opens 051 at the printable width of the page, so a label measured in print
    media is the size it is on paper. `lists` is { name: { words, lang } }. */
async function open(browser, lists, theme) {
  const page = await prepPage(browser, BASE, { width: PAGE_W, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([saved, dark]) => {
    if (saved && !localStorage.getItem('clm_lists_v1')) {
      const names = Object.keys(saved);
      localStorage.setItem('clm_lists_v1', JSON.stringify(names));
      names.forEach(n => localStorage.setItem('clm_list_v1:' + n, JSON.stringify({ name: n, words: saved[n].words, lang: saved[n].lang || 'es-ES' })));
      localStorage.setItem('clm_current_v1', names[0]);
    }
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [lists, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

/** What the sheet is made of, read off the DOM. */
const built = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const cards = [...area.querySelectorAll('.label-card')];
  const ref = area.querySelector('.ref-sheet');
  return {
    area: area.className,
    kids: [...area.children].map(c => c.className).join('|'),
    cols: area.firstElementChild ? area.firstElementChild.style.getPropertyValue('--pk-cols') : '',
    stray: cards.length - area.querySelectorAll('.pk-cards > .label-card.pk-card').length,
    targets: cards.map(c => c.querySelector('.ltext > .target').textContent),
    english: cards.map(c => c.querySelector('.ltext > .english').textContent),
    shape: cards.every(c => c.children.length === 2 && c.firstElementChild.localName === 'canvas' && c.firstElementChild.width >= 200 && c.firstElementChild.width === c.firstElementChild.height && c.lastElementChild.children.length === 2),
    refHead: ref ? [...ref.querySelectorAll('h2, thead th')].map(x => x.textContent).join('|') : '',
    refRows: ref ? [...ref.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent).join('=')) : [],
  };
});

/** Reads every label's QR code back with the site's own decoder. */
async function decodeAll(page) {
  if (!(await page.evaluate(() => typeof window.jsQR === 'function'))) await page.addScriptTag({ url: `${BASE}/_shared/vendor/jsqr/jsqr.js` });
  return page.evaluate(() => [...document.querySelectorAll('#printArea .label-card canvas')].map(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const r = window.jsQR(d.data, d.width, d.height);
    return r ? r.data : null;
  }));
}
const decode = async (page, i) => (await decodeAll(page))[i];

console.log('051 — the classroom labels print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(code), 'has no @media print block of its own');
ok(!/@page/.test(code), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-kit.css') < src.indexOf('<style>') && src.indexOf('print-area.css') < src.indexOf('print-kit.css'), 'print-area.css, then print-kit.css, are linked before the inline <style>');
ok(!/\.label-grid|break-inside|break-before|grid-template-columns/.test(code), 'the grid, the columns and the page breaks are the kit\'s, not the page\'s');
ok(!/#printArea\s*\{[^}]*display/.test(code), 'and it does not hide or show #printArea itself');
ok(!/printArea\.innerHTML/.test(code), 'the sheet is not built from a string');
ok(!/beforeprint/.test(code), 'nothing is drawn on beforeprint (a canvas drawn there prints as replayed commands)');
ok(/<div id="printArea" class="pk-paper"><\/div>\s*\n\s*<script>/.test(src) && /<\/div>\s*\n\s*<div id="printArea"/.test(src), '#printArea is a .pk-paper, written as a child of <body>');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, { 'Room set': { words: s.words } }, theme);
    try {
      const want = s.words;
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      eq(await page.locator('#printArea .label-card').count(), want.length, `${what}: and already built, so Ctrl+P has something to print`);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      const b = await built(page);
      eq(b.area, 'pk-paper', `${what}: #printArea is the kit's paper`);
      eq(b.kids, 'pk-cards pk-page pk-cards-own|ref-sheet pk-page', `${what}: one grid of the tool's own, then the reference sheet, each a kit page`);
      eq(b.cols, String(COLS), `${what}: three across`);
      eq(b.stray, 0, `${what}: every label is a kit card, directly in the grid`);
      eq(b.targets.join('|'), want.map(w => w.target).join('|'), `${what}: every word once, in list order`);
      eq(b.english.join('|'), want.map(w => w.english).join('|'), `${what}: each with its English`);
      ok(b.shape, `${what}: each label is a square QR canvas of 200 px or more and its two lines of text, nothing else`);
      eq(b.refHead, 'Reference Sheet|Target word|English', `${what}: the reference sheet has its heading and two columns`);
      eq(b.refRows.join('|'), want.map(w => w.target + '=' + w.english).join('|'), `${what}: and a row for every word`);
      // The old page drew each dark module up to two pixels too wide, and jsQR
      // could not read 4 of this suite's 120 short words' codes ("la palabra
      // 3" and "40" among them), nor the long word's. Every one has to read
      // back now.
      const codes = await decodeAll(page);
      const unread = codes.map((c, i) => c === speakUrl(want[i].target, 'es-ES') ? null : want[i].target).filter(Boolean);
      eq(unread.length, 0, `${what}: every label's QR code decodes to that word's pronunciation link${unread.length ? ' (not: ' + unread.slice(0, 4).join(', ') + ')' : ''}`);

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
        const r = x => x.getBoundingClientRect();
        const top = r(cards[0]).top;
        const firstRow = cards.filter(x => Math.abs(r(x).top - top) < 1);
        const ref = area.querySelector('.ref-sheet');
        return {
          outside: outside.length,
          first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
          widths: cards.map(x => r(x).width),
          heights: cards.map(x => r(x).height),
          across: firstRow.length,
          rowGap: cards.length > firstRow.length ? Math.min(...cards.map(x => r(x).top).filter(t => t > top + 1)) - Math.max(...firstRow.map(x => r(x).bottom)) : null,
          clipped: clipped.length,
          spill: cards.filter(c => r(c.lastElementChild).bottom > r(c).bottom + 0.5 || r(c.lastElementChild).right > r(c).right + 0.5).length,
          qr: cards.map(c => r(c.firstElementChild)).filter(q => Math.abs(q.width - 86.4) > 0.6 || Math.abs(q.height - 86.4) > 0.6).length,
          keep: cs(cards[0]).breakInside,
          gridBreak: cs(cards[0].parentElement).breakAfter,
          refBreak: cs(ref).breakAfter + '|' + cs(ref).breakBefore,
          refW: r(ref.querySelector('table')).width,
          border: cs(cards[0]).borderTopColor + ' ' + cs(cards[0]).borderTopStyle,
          target: cs(cards[0].querySelector('.target')).color,
          english: cs(cards[0].querySelector('.english')).color,
          h2: cs(ref.querySelector('h2')).color,
          th: cs(ref.querySelector('th')).backgroundColor,
          td: cs(ref.querySelector('td')).color + ' ' + cs(ref.querySelector('td')).borderTopColor,
          areaBg: cs(area).backgroundColor,
        };
      });
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.spill, 0, `${what}: every label's text ends inside its border`);
      eq(m.across, Math.min(COLS, want.length), `${what}: three labels across`);
      ok(m.widths.every(w => Math.abs(w - LABEL_W) <= 0.6), `${what}: a label is ${(LABEL_W / IN).toFixed(2)} in wide, as it was (${(Math.min(...m.widths) / IN).toFixed(2)} to ${(Math.max(...m.widths) / IN).toFixed(2)} in)`);
      ok(m.heights.every(h => h >= LABEL_H - 0.6), `${what}: no label is shorter than 1.4 in`);
      if (s.grows) ok(Math.max(...m.heights) > LABEL_H + 2, `${what}: the row with the long word grows instead of clipping (${Math.round(Math.max(...m.heights))} px)`);
      else ok(m.heights.every(h => Math.abs(h - LABEL_H) <= 0.6), `${what}: a label is exactly 1.4 in tall, as it was, and not a share of the page`);
      if (m.rowGap !== null) near(m.rowGap, GAP, `${what}: rows are 0.2 in apart, the tool's gap and not the kit's`);
      eq(m.qr, 0, `${what}: every QR code is ${QR / IN} in square, not squeezed by its text`);
      eq(m.keep, 'avoid', `${what}: a label is not split across two pages`);
      eq(m.gridBreak, 'page', `${what}: the page breaks after the labels`);
      eq(m.refBreak, 'auto|auto', `${what}: and the reference sheet, last on the sheet, asks for no page after it`);
      near(m.refW, PAGE_W, `${what}: the reference table is the width of the page`);
      eq(m.border, 'rgb(51, 51, 51) dashed', `${what}: the label's cut line is the tool's own dashed dark grey`);
      eq(m.target, 'rgb(0, 0, 0)', `${what}: the word prints black`);
      eq(m.english, 'rgb(85, 85, 85)', `${what}: its English in the tool's own grey`);
      eq(m.h2, 'rgb(0, 0, 0)', `${what}: the reference heading prints black`);
      eq(m.th, 'rgb(238, 238, 238)', `${what}: the table head keeps its light grey`);
      eq(m.td, 'rgb(0, 0, 0) rgb(153, 153, 153)', `${what}: table text black on the tool's grey rules`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
      eq(pdfPageCount(buf), s.pages, `${what}: Chromium prints the pages the old page did on half-inch margins${s.noMargin ? ` (${s.noMargin} with no margin, where another row fitted)` : ''}`);
      ok(/\/MediaBox\s*\[\s*0\s+0\s+612\s+792\s*\]/.test(buf.toString('latin1')), `${what}: on US Letter, portrait`);
      ok(pdfImageCount(buf) >= 1, `${what}: the QR codes are in the PDF as bitmaps (${pdfImageCount(buf)} image objects)`);
      eq(await page.locator('#printArea .label-card').count(), want.length, `${what}: printing leaves the sheet as it was`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- text, not markup -----------------------------------------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>la mesa</b> "sí"';
  const evil2 = '</td><script>window.__pwned=1</script>';
  const page = await open(browser, { 'Room set': { words: [{ target: evil, english: evil2 }, { target: 'la silla', english: 'chair' }] } });
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await page.evaluate(() => {
      const area = document.getElementById('printArea');
      return {
        target: area.querySelector('.label-card .target').textContent,
        english: area.querySelector('.label-card .english').textContent,
        row: [...area.querySelector('.ref-sheet tbody tr').cells].map(c => c.textContent).join('='),
        injected: area.querySelectorAll('img, b, script').length,
        pwned: !!window.__pwned,
      };
    });
    eq(r.target, evil, 'a word reaches the label character for character');
    eq(r.english, evil2, 'and so does its English');
    eq(r.row, evil + '=' + evil2, 'and both reach the reference table the same way');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
    eq(await decode(page, 0), speakUrl(evil, 'es-ES'), 'the QR code carries the word as typed, encoded in the link');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- the sheet follows the list: saving, the language, another list, printing twice ----
{
  const page = await open(browser, { 'Room set': { words: wordsOf(4) }, 'Kitchen set': { words: wordsOf(2), lang: 'fr-FR' } });
  try {
    eq(await page.locator('#printArea .label-card').count(), 4, 'four saved words are four labels on load');
    await page.click('#printBtn');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 2, 'printing again replaces the sheet, it does not add to it');
    eq(await page.locator('#printArea .label-card').count(), 4, 'with the four labels once each');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');

    await page.fill('#wordInput', 'el libro: book\nno colon on this line\nla tiza: chalk\n: nothing before the colon');
    await page.click('#saveWordsBtn');
    await settle(page, 100);
    let b = await built(page);
    eq(b.targets.join('|'), 'el libro|la tiza', 'saving a new list rebuilds the sheet with the lines that are a word');
    eq(b.refRows.join('|'), 'el libro=book|la tiza=chalk', 'and the reference table with it');

    await page.selectOption('#langSelect', 'de-DE');
    await settle(page, 100);
    eq(await decode(page, 0), speakUrl('el libro', 'de-DE'), 'changing the language redraws the QR codes for it');

    await page.selectOption('#listSwitch', 'Kitchen set');
    await settle(page, 100);
    b = await built(page);
    eq(b.targets.join('|'), 'la palabra 1|la palabra 2', 'switching to another saved list puts that list on the sheet');
    eq(await decode(page, 1), speakUrl('la palabra 2', 'fr-FR'), 'in that list\'s language');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `the sheet follows the list: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- Ctrl+P: Chromium's own print path, with no button pressed --------------------
{
  const page = await open(browser, { 'Room set': { words: wordsOf(19) } });
  try {
    const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    eq(pdfPageCount(buf), 3, 'printing with no button pressed prints the labels and the reference sheet (it printed one empty page)');
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
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  try {
    eq(await page.locator('#printArea > *').count(), 0, 'with no words there is no sheet, not an empty reference table');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(dialogs.length, 1, 'with no words, Print says so');
    ok(/word list/i.test(dialogs[0] || ''), 'and names what is missing');
    eq(await page.evaluate(() => window.__printCalls), 0, 'and print() is not called');
    eq(await page.locator('#printArea > *').count(), 0, 'and no sheet is built');
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 1, 'Ctrl+P then is one page, as it was');
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
