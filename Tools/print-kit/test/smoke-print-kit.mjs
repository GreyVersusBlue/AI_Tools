// smoke-print-kit.mjs — _shared/print-kit.css and print-kit.js in a real
// browser (Path 7 P1), driven on Tools/print-kit/test/fixture.html because no
// tool has adopted the kit yet.
//
//   node Tools/print-kit/test/smoke-print-kit.mjs      (or: npm run test:print-kit)
//
// print-kit.test.mjs proves the pure logic. This proves the claims that only a
// layout engine can: that a class set is one PDF page per student, that two
// half sheets and four quarter sheets share a page, that a half sheet with too
// much text GROWS instead of clipping (the bug class the kit exists to
// retire), that the label presets come out at their published sizes, that
// setPage() really changes the paper, and that the ink-safe set strips fills
// and keeps hatches under print.
//
// Pages are counted by printing to PDF and counting page objects, so a page
// break is measured where it happens rather than inferred from heights.
// Nothing here has been checked on a physical printer.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8462;
const BASE = `http://127.0.0.1:${PORT}`;
const IN = 96; // CSS px per inch

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
const near = (a, b, label, tol = 1.5) => ok(Math.abs(a - b) <= tol, `${label} (got ${a}, want ${b} ± ${tol})`);

const server = await serve(PORT);
const browser = await launch();

console.log('Print kit — sheets, sets, card grids and ink-safe output');

const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
await page.goto(`${BASE}/Tools/print-kit/test/fixture.html`);
await settle(page);

/** Page count and first page size (pt) of the page printed as it stands. */
async function printed() {
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  const pages = (pdf.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
  const box = pdf.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return { pages, w: box ? Math.round(+box[3]) : 0, h: box ? Math.round(+box[4]) : 0 };
}
const names = n => Array.from({ length: n }, (_, i) => 'Student ' + (i + 1));

eq(await page.evaluate(() => typeof PrintKit), 'object', 'the fixture loads PrintKit');

// ---- screen / print visibility ---------------------------------------------
const shown = () => page.evaluate(() => ['screenOnly', 'printOnly'].map(id => getComputedStyle(document.getElementById(id)).display));
eq(await shown(), ['block', 'none'], 'on screen: .pk-no-print shows, .pk-print-only does not');
await page.emulateMedia({ media: 'print' });
eq(await shown(), ['none', 'block'], 'in print: the two swap');
// Out of the way: everything below measures whole pages.
await page.evaluate(() => { document.getElementById('screenOnly').remove(); document.getElementById('printOnly').remove(); });

// ---- a class set, one page each ----------------------------------------------
await page.evaluate(() => { PrintKit.setPage({}); PrintKit.setHeader({ title: 'Exit ticket', class: 'Period 3', date: 'Oct 3' }); });
const hostile = '<img src=x onerror="window.__pwned=1">';
let plan = await page.evaluate(({ roster }) => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'set', roster }),
  { roster: ['Ada Lovelace', hostile, { name: 'Katherine Johnson', preferred: 'Kat' }, 'Grace', 'Alan'] });
eq(plan.length, 5, 'renderSet returns the plan');
let dom = await page.evaluate(() => [...document.querySelectorAll('#out > section')].map(s => ({
  cls: s.className,
  head: [...s.querySelector('.pk-header').children].map(c => c.textContent),
  name: s.querySelector('[data-pk="name"]').textContent,
  title: s.querySelector('h1').textContent,
  count: s.querySelector('.counter').textContent,
  foot: [...s.querySelector('.pk-footer').children].map(c => c.textContent),
})));
eq(dom.length, 5, 'a class set of five is five sheets');
eq(dom[0], { cls: 'pk-page pk-sheet', head: ['Exit ticket', 'Period 3', 'Oct 3'], name: 'Ada Lovelace', title: 'Exit ticket', count: '1 of 5', foot: ['Ada Lovelace', '1 of 5'] },
   'a sheet carries the header, the name, the template slots and an N of M footer');
eq(dom[2].name, 'Kat', 'a roster record prints its preferred name');
eq(dom[1].name, hostile, 'a name that looks like markup is printed as the text it is');
eq(await page.evaluate(() => [document.querySelectorAll('#out img').length, window.__pwned || 0]), [0, 0], 'and never becomes an element');
let pdf = await printed();
eq(pdf.pages, 5, 'five sheets print as five pages, with no blank page after the last');
eq([pdf.w, pdf.h], [612, 792], 'on Letter portrait');

// The header follows a later setHeader() without a re-render.
await page.evaluate(() => PrintKit.setHeader({ class: 'Period 5' }));
eq(await page.evaluate(() => [...document.querySelectorAll('#out .pk-h-class')].map(e => e.textContent)), Array(5).fill('Period 5'),
   'setHeader() refills every header already on the page');

// ---- one, and blanks -------------------------------------------------------------
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'one', name: 'Ada' }));
eq(await page.evaluate(() => [document.querySelectorAll('#out > section').length, document.querySelector('#out .pk-f-count').textContent]), [1, ''],
   'one sheet has no "1 of 1" footer');
eq((await printed()).pages, 1, 'and prints as one page');
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'blank', count: 3 }));
const blank = await page.evaluate(() => {
  const s = document.querySelector('#out > section'), n = s.querySelector('[data-pk="name"]');
  return { n: document.querySelectorAll('#out > section').length, cls: s.className, line: n.className, text: n.textContent,
           w: n.getBoundingClientRect().width, rule: getComputedStyle(n).borderBottomStyle };
});
eq([blank.n, blank.cls, blank.line, blank.text, blank.rule], [3, 'pk-page pk-sheet pk-sheet-blank', 'pk-blank-line', '', 'solid'],
   'three blanks, each with a write-in rule where the name goes');
ok(blank.w >= 2.5 * IN - 1, `the write-in rule is wide enough to write on (${blank.w}px)`);
eq((await printed()).pages, 3, 'three blanks print as three pages');
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'one', name: 'Ada' }));
eq(await page.evaluate(() => document.querySelector('#out [data-pk="name"]').className), '', 'a named sheet has no write-in rule');

// ---- half sheets -------------------------------------------------------------------
const HALF = (11 - 1 - 0.04) / 2 * IN;
await page.evaluate(({ roster }) => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'set', roster, sheet: 'half' }), { roster: names(4) });
let half = await page.evaluate(() => { const s = document.querySelector('#out > section'); return { cls: s.className, h: s.getBoundingClientRect().height, head: !!s.querySelector('.pk-header') }; });
eq([half.cls, half.head], ['pk-half pk-sheet', false], 'half sheets take .pk-half and no page header by default');
near(half.h, HALF, 'a half sheet is half the printable height');
eq((await printed()).pages, 2, 'four half sheets print as two pages');

// The bug class: more text than the box holds. It must grow, not clip.
await page.evaluate(() => { document.querySelector('#out > section .body').textContent = 'A long answer the teacher typed. '.repeat(400); });
const grown = await page.evaluate(() => { const s = document.querySelector('#out > section'), cs = getComputedStyle(s);
  return { h: s.getBoundingClientRect().height, scroll: s.scrollHeight, client: s.clientHeight, overflow: cs.overflowY }; });
ok(grown.h > HALF + 100, `an overfull half sheet grows past half a page (${Math.round(grown.h)}px)`);
ok(grown.scroll <= grown.client + 1 && grown.overflow === 'visible', 'and nothing in it is clipped');
ok((await printed()).pages >= 3, 'so the run gains a page instead of losing the text');

// The cut line (opts.cut): under the upper sheet of each pair, none along the foot of the page.
const cutAt = () => page.evaluate(() => [...document.querySelectorAll('#out > section')].map((s, i) => s.classList.contains('pk-cut') ? i : -1).filter(i => i >= 0));
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'blank', count: 5, sheet: 'half', cut: true }));
eq(await cutAt(), [0, 2, 4], 'cut: true marks the 1st, 3rd and 5th half sheet');
eq(await page.evaluate(() => document.querySelector('#out > section').className), 'pk-half pk-sheet pk-sheet-blank pk-cut', 'as a class beside the sheet classes');
eq((await printed()).pages, 3, 'and the line costs no page: five half sheets are still three pages');
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'blank', count: 4, sheet: 'half' }));
eq(await cutAt(), [], 'no cut line unless it is asked for');
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'blank', count: 3, sheet: 'page', cut: true }));
eq(await cutAt(), [], 'and none on full pages, which are not cut');

// ---- quarter sheets ------------------------------------------------------------------
await page.evaluate(({ roster }) => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'set', roster, sheet: 'quarter' }), { roster: names(8) });
const quarter = await page.evaluate(() => { const o = document.getElementById('out'), s = [...o.children].map(c => c.getBoundingClientRect());
  return { wrap: o.className, h: s[0].height, sameRow: s[0].top === s[1].top && s[1].left > s[0].left, nextRow: s[2].top > s[0].top }; });
eq([quarter.wrap, quarter.sameRow, quarter.nextRow], ['pk-quarters', true, true], 'quarter sheets sit two across');
near(quarter.h, HALF, 'a quarter sheet is half the printable height');
eq((await printed()).pages, 2, 'eight quarter sheets print as two pages');
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'one', name: 'Ada' }));
eq(await page.evaluate(() => document.getElementById('out').className), '', 'the quarter wrapper class comes off on the next full-page render');

// ---- card grids ------------------------------------------------------------------------
/** PrintKit.renderCards() for n cards; reports the grids and the first card's box. */
const cards = (preset, n) => page.evaluate(({ preset, n }) => {
  const out = document.getElementById('out');
  const items = Array.from({ length: n }, (_, i) => 'Card ' + (i + 1));
  const seen = [];
  const pages = PrintKit.renderCards(out, items, preset, (label, i) => {
    seen.push(i);
    const c = document.createElement('div'); c.className = 'mine'; c.textContent = label; return c;
  });
  const all = [...out.querySelectorAll('.pk-card')];
  const r = all[0].getBoundingClientRect();
  return { grids: out.children.length, w: r.width, h: r.height, pages: pages.map(p => p.length),
           classes: [...new Set([...out.children].map(g => g.className))].join('|'),
           cols: out.firstElementChild.style.getPropertyValue('--pk-cols'),
           across: all.filter(x => Math.abs(x.getBoundingClientRect().top - r.top) < 1).length,
           text: all.map(x => x.textContent).join('|') === items.join('|'),
           kept: all.every(x => x.className === 'mine pk-card' && x.parentElement.parentElement === out),
           index: seen.join(',') === items.map((_, i) => i).join(',') };
}, { preset, n });

let c = await cards('2x5', 10);
near(c.w, 3.5 * IN, 'a 2x5 card is 3.5 in wide'); near(c.h, 2 * IN, 'and 2 in tall');
eq((await printed()).pages, 1, 'ten business cards fill exactly one page');
c = await cards('2x5', 11);
eq([c.grids, (await printed()).pages], [2, 2], 'the eleventh starts a second page');
c = await cards('3x10', 30);
near(c.w, 2.625 * IN, 'a 3x10 label is 2.625 in wide'); near(c.h, 1 * IN, 'and 1 in tall');
eq((await printed()).pages, 1, 'thirty address labels fill exactly one page');
for (const [preset, per] of [['2x2', 4], ['2x3', 6], ['3x3', 9], ['2x4', 8], ['4x3', 12]]) {
  c = await cards(preset, per);
  eq((await printed()).pages, 1, `${preset}: ${per} cards fit one page`);
  c = await cards(preset, per * 2 + 1);
  eq([c.grids, (await printed()).pages], [3, 3], `${preset}: ${per * 2 + 1} cards are three pages`);
}
// renderCards(): what it builds for a preset, and for a grid of the tool's own.
c = await cards('3x3', 20);
eq([c.grids, c.pages, c.classes, c.cols], [3, [9, 9, 2], 'pk-cards pk-page pk-cards-3x3', ''], 'renderCards: a preset is one .pk-cards.pk-page per page, with the preset class');
ok(c.text && c.kept && c.index, 'renderCards: every item is one card, in order, keeps its own class, gains .pk-card, and buildCard is handed its index');
eq(c.across, 3, 'renderCards: 3x3 is three across');
c = await cards('3x3', 9);
await page.evaluate(() => PrintKit.renderCards(document.getElementById('out'), ['a', 'b'], '2x2', t => { const d = document.createElement('div'); d.textContent = t; return d; }));
eq(await page.evaluate(() => [document.getElementById('out').children.length, document.querySelectorAll('#out .pk-card').length]), [1, 2], 'renderCards: a second call replaces what was there');
eq(await page.evaluate(() => PrintKit.renderCards(document.getElementById('out'), [], '2x2', () => null).length + document.getElementById('out').children.length), 0, 'renderCards: no items leaves the container empty');
eq(await page.evaluate(() => { PrintKit.renderCards(document.getElementById('out'), [1, 2, 3], '2x2', n => n === 2 ? null : document.createElement('div')); return document.querySelectorAll('#out .pk-card').length; }), 2, 'renderCards: a card buildCard declines is skipped');
// A grid of the tool's own: the kit gives the card no height, the tool's rule does.
await page.addStyleTag({ content: '.mine { min-height: 1.5in; }' });   // one class: loses to any kit rule that reaches it
c = await cards({ cols: 4 }, 30);
eq([c.grids, c.pages, c.classes, c.cols, c.across], [1, [30], 'pk-cards pk-page pk-cards-own', '4', 4], 'renderCards: { cols: 4 } is one grid, four across, marked pk-cards-own');
near(c.h, 1.5 * IN, 'an own grid\'s card has the height the tool gave it, from a rule of one class');
// 6 rows of 1.5 in and five 0.125 in gaps are 9.625 in: 24 to a 10 in page, so 8 rows are two pages.
eq((await printed()).pages, 2, 'an own grid runs on to a second page between rows, with no page of its own per group');
c = await cards({ cols: 4 }, 24);
eq((await printed()).pages, 1, 'and 24 such cards are one page, with no blank page after');
c = await cards({ cols: 2, perPage: 4 }, 9);
eq([c.grids, c.pages, c.across, (await printed()).pages], [3, [4, 4, 1], 2, 3], 'renderCards: { cols, perPage } cuts an own grid into pages');
c = await cards('3x3', 9);
near(c.h, (9.96 * IN - 2 * 0.125 * IN) / 3, 'a preset card is still a third of the printable page, whatever the tool\'s own min-height');
// A card with too much text grows its row; it is never cut off.
await cards('3x3', 9);
const tall = await page.evaluate(() => { const el = document.querySelector('.pk-card'); el.textContent = 'word '.repeat(600);
  return { scroll: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY }; });
ok(tall.scroll <= tall.client + 1 && tall.overflow === 'visible', 'an overfull card grows instead of clipping');

// ---- setPage ---------------------------------------------------------------------------------
await page.evaluate(() => PrintKit.renderSet(document.getElementById('out'), document.getElementById('sheetTpl'), { mode: 'set', roster: ['A', 'B', 'C', 'D'], sheet: 'half' }));
const a4 = await page.evaluate(() => { const p = PrintKit.setPage({ paper: 'a4', orientation: 'landscape', margin: '10mm' });
  const cs = getComputedStyle(document.documentElement);
  return { css: document.getElementById('pk-page-style').textContent, styles: document.querySelectorAll('#pk-page-style').length, p,
           vars: ['--pk-page-w', '--pk-page-h', '--pk-margin'].map(v => cs.getPropertyValue(v).trim()),
           h: document.querySelector('#out > section').getBoundingClientRect().height }; });
eq(a4.css, '@page { size: A4 landscape; margin: 10mm; }', 'setPage writes the @page rule');
eq(a4.vars, ['297mm', '210mm', '10mm'], 'and the matching custom properties');
near(a4.h, ((210 - 20) / 25.4 - 0.04) / 2 * IN, 'so a half sheet is half of the new printable height');
pdf = await printed();
eq([pdf.w, pdf.h, pdf.pages], [842, 595, 2], 'the PDF is A4 landscape, and four halves are still two pages');
await page.evaluate(() => PrintKit.setPage({}));
eq(await page.evaluate(() => document.querySelectorAll('#pk-page-style').length), 1, 'a second setPage reuses the one style element');
eq((await printed()).h, 792, 'and Letter is back');

// ---- ink-safe ------------------------------------------------------------------------------------
const inkState = () => page.evaluate(() => {
  const out = document.getElementById('out');
  if (!out.querySelector('.pk-ink-safe')) {
    out.replaceChildren();
    const wrap = document.createElement('div'); wrap.className = 'pk-ink-safe';
    const tint = document.createElement('div'); tint.className = 'tint pk-label'; tint.id = 'tint'; tint.dataset.pkLabel = 'Late'; tint.textContent = 'Row';
    const hatch = document.createElement('div'); hatch.id = 'hatch'; hatch.className = PrintKit.inkClass(0); hatch.textContent = 'Group A';
    wrap.append(tint, hatch); out.appendChild(wrap);
  }
  const cs = id => getComputedStyle(document.getElementById(id));
  return { tintBg: cs('tint').backgroundColor, tintColor: cs('tint').color,
           label: getComputedStyle(document.getElementById('tint'), '::after').display,
           labelText: getComputedStyle(document.getElementById('tint'), '::after').content,
           hatch: cs('hatch').backgroundImage.startsWith('repeating-linear-gradient'), adjust: cs('hatch').printColorAdjust,
           border: cs('hatch').borderTopStyle };
});
const inkPrint = await inkState();
eq([inkPrint.tintBg, inkPrint.tintColor], ['rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)'], 'in print, .pk-ink-safe drops a colour fill and forces black text');
eq(inkPrint.label, 'inline', 'and shows the written label');
ok(/Late/.test(inkPrint.labelText), `whose text comes from data-pk-label (${inkPrint.labelText})`);
eq([inkPrint.hatch, inkPrint.adjust, inkPrint.border], [true, 'exact', 'solid'], 'a hatch survives ink-safe, is printed exactly, and carries its border style');
await page.emulateMedia({ media: 'screen' });
const inkScreen = await inkState();
eq([inkScreen.tintBg, inkScreen.label, inkScreen.hatch], ['rgb(204, 51, 51)', 'none', true], 'on screen the fill stays, the label hides and the hatch still draws');


// ---- paper: a white sheet and black text, the fills inside left alone ---------------------------
// The page is put in the colours a dark theme would give it; .pk-paper has to
// beat a rule in the page, which is how ink-paper.css re-declares a sheet's ink.
const paperState = () => page.evaluate(() => {
  const out = document.getElementById('out');
  if (!document.getElementById('paper')) {
    out.replaceChildren();
    const st = document.createElement('style');
    st.textContent = 'body { background: rgb(20, 20, 30); } #out #paper { color: rgb(200, 210, 220); background: rgb(30, 30, 40); }';
    document.head.appendChild(st);
    const paper = document.createElement('div'); paper.id = 'paper'; paper.className = 'pk-paper';
    const plain = document.createElement('p'); plain.id = 'plain'; plain.textContent = 'A line of text';
    const tint = document.createElement('div'); tint.className = 'tint'; tint.id = 'ptint'; tint.textContent = 'Row';
    paper.append(plain, tint); out.appendChild(paper);
  }
  const cs = id => getComputedStyle(document.getElementById(id));
  return { bg: cs('paper').backgroundColor, ink: cs('paper').color, plain: cs('plain').color, tintBg: cs('ptint').backgroundColor, tintInk: cs('ptint').color };
});
const paperScreen = await paperState();
eq([paperScreen.bg, paperScreen.ink], ['rgb(30, 30, 40)', 'rgb(200, 210, 220)'], 'on screen .pk-paper changes nothing');
await page.emulateMedia({ media: 'print' });
const paperPrint = await paperState();
eq([paperPrint.bg, paperPrint.ink], ['rgb(255, 255, 255)', 'rgb(0, 0, 0)'], 'in print, .pk-paper is white with black text, over an id rule in the page');
eq(paperPrint.plain, 'rgb(0, 0, 0)', 'text inside inherits the black');
eq([paperPrint.tintBg, paperPrint.tintInk], ['rgb(204, 51, 51)', 'rgb(255, 255, 255)'], 'and a fill the tool set inside is left alone, unlike .pk-ink-safe');

// ---- quarters on a container an id rule makes a block ---------------------------------------------
// print-area.css says `#printArea { display: block }` in print, and an adopter's
// container is #printArea. 023's quarter sheets came out one to a row until
// .pk-quarters outranked that.
const quarterGrid = await page.evaluate(() => {
  const out = document.getElementById('out');
  out.replaceChildren();
  const st = document.createElement('style');
  st.textContent = '@media print { #byId { display: block; } }';
  document.head.appendChild(st);
  const wrap = document.createElement('div'); wrap.id = 'byId';
  out.appendChild(wrap);
  PrintKit.renderSet(wrap, () => document.createElement('p'), { mode: 'blank', count: 4, sheet: 'quarter' });
  const kids = [...wrap.children].map(x => x.getBoundingClientRect());
  return { display: getComputedStyle(wrap).display, sameRow: Math.abs(kids[0].top - kids[1].top) < 1, across: kids[1].left > kids[0].left, rows: kids[2].top > kids[0].top };
});
eq(quarterGrid, { display: 'grid', sameRow: true, across: true, rows: true }, 'quarter sheets are two across in a container that an id rule makes a block in print');
await page.emulateMedia({ media: 'screen' });

eq(page.__errs, [], 'no page errors, failed requests or console errors');
eq(page.__blocked, [], 'nothing left the site');

await page.close();
await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
