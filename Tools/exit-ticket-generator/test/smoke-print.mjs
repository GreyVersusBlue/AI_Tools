// smoke-print.mjs — 023 prints through the shared print kit (Path 7 P3).
//
//   node Tools/exit-ticket-generator/test/smoke-print.mjs
//
// 023 is the kit's fifth adopter, the second with a roster and the first to
// print quarter sheets. It had its own `@media print` block and an `@page` at
// 0.4 in; both are gone. print-area.css puts #printArea alone on the paper,
// PrintKit.setPage() writes the page, and both print buttons hand
// PrintKit.renderSet() one sheet's content:
//
//   Print Handout       the slips of one page as blank copies (mode 'blank'):
//                       two half sheets, or four quarter sheets
//   Print Class Set     the same button with a roster: one slip per student
//                       (mode 'set'), each made out to its student
//   Print Reteach List  one page (mode 'one'), no kit header or footer
//
// What this pins, for every state, light and dark:
//   - the sheets the kit builds, their classes and who each is made out to
//   - only the sheet has a box on paper, nothing on it is clipped, the paper
//     is white and the text black in the dark theme too (.pk-paper)
//   - a slip fills its half or quarter sheet, quarters sit two across, and the
//     0.22 in between slips for the paper cutter is still there
//   - Chromium's PDF page count, which is what the hand-written block printed
//     in every state (measured on the old page, 2026-10-04, before the
//     adoption)
//   - a name reaches the slip as text, and Ctrl+P prints the handout
//
// print() is stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8471;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '023-exit-ticket-generator.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

// Made-up names only: the roster is student-shaped data.
const SHORT = 'Name one thing you learned today.';
const ESSAY = new Array(41).join('Explain how the river shaped the valley, with evidence from the lab. ');
const roster = n => Array.from({ length: n }, (_, i) => 'Student ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? '2' : '') + ' Sample');
const settings = over => Object.assign({
  category: 'mine', perPage: 2, showName: true, showDate: true, includeMine: true, thinkTime: 0, slipMode: 'same',
  qrEnabled: false, qrUrl: '', batchMode: false, answerStyle: 'lines', answerSpace: 'auto', mode: 'shuffle',
}, over);
const triage = n => ({ groupSize: 3, students: roster(n).map((name, i) => ({ id: 't' + i, name, status: ['reteach', 'almost', 'got', ''][i % 4] })) });

// `per` is slips to a page; `names` the class set's roster (null: the one-page
// handout); `pages` Chromium's PDF page count, the old block's too.
const STATES = [
  { name: 'a first visit', set: null, per: 2, names: null, pages: 1 },
  { name: 'two to a page', set: settings({}), per: 2, names: null, pages: 1 },
  { name: 'four to a page', set: settings({ perPage: 4 }), per: 4, names: null, pages: 1 },
  { name: 'four to a page, QR code and grid', set: settings({ perPage: 4, qrEnabled: true, qrUrl: 'https://example.org/exit-ticket/period-3', answerStyle: 'grid' }), per: 4, names: null, pages: 1, qr: true, grid: true },
  { name: 'four to a page, a different prompt on each', set: settings({ perPage: 4, slipMode: 'different', category: 'all' }), per: 4, names: null, pages: 1, different: true },
  { name: 'two to a page, a prompt too long for a half sheet', set: settings({}), prompt: ESSAY, per: 2, names: null, pages: 4, long: true },
  { name: 'four to a page, a prompt too long for a quarter sheet', set: settings({ perPage: 4 }), prompt: ESSAY, per: 4, names: null, pages: 4, long: true },
  { name: 'a class set with no names', set: settings({ batchMode: true }), per: 2, names: [], pages: 1 },
  { name: 'a class of three, two to a page', set: settings({ batchMode: true }), per: 2, names: roster(3), pages: 2 },
  { name: 'a class of five, four to a page', set: settings({ batchMode: true, perPage: 4 }), per: 4, names: roster(5), pages: 2 },
  { name: 'a class of twenty-eight, two to a page', set: settings({ batchMode: true }), per: 2, names: roster(28), pages: 14 },
  { name: 'a class of twenty-eight, four to a page', set: settings({ batchMode: true, perPage: 4 }), per: 4, names: roster(28), pages: 7 },
  { name: 'a class of twenty-eight, four to a page, a long prompt', set: settings({ batchMode: true, perPage: 4 }), prompt: ESSAY, per: 4, names: roster(28), pages: 28, long: true },
  { name: 'a class of twenty-eight, two to a page, a long prompt', set: settings({ batchMode: true }), prompt: ESSAY, per: 2, names: roster(28), pages: 56, long: true },
];
// The reteach list: students triaged, and the old block's page count.
const TRIAGE = [{ n: 8, pages: 1 }, { n: 28, pages: 1 }, { n: 60, pages: 2 }];

async function open(browser, { set = null, prompt = SHORT, tri = null, theme = 'light' } = {}) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([s, p, t, dark]) => {
    if (s) {
      localStorage.setItem('gvb-exit-ticket:settings', s);
      localStorage.setItem('gvb-exit-ticket:customPrompts', JSON.stringify([{ id: 'c1', text: p }]));
    }
    if (t) localStorage.setItem('gvb-exit-ticket:triage', t);
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [set ? JSON.stringify(set) : null, prompt, tri ? JSON.stringify(tri) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  if (set) { await page.fill('#customPrompt', prompt); await page.click('#useCustomBtn'); }
  return page;
}

/** What the kit built in #printArea. */
const built = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const sheets = [...area.children];
  const texts = sel => [...area.querySelectorAll(sel)].map(x => x.textContent);
  return {
    n: sheets.length,
    areaClass: area.className,
    classes: [...new Set(sheets.map(x => x.className))].join('|'),
    slipsPer: [...new Set(sheets.map(x => x.querySelectorAll(':scope > .slip').length))].join(','),
    chrome: area.querySelectorAll('.pk-header, .pk-footer, .slip-page, .slip-grid').length,
    prompts: texts('.slip-prompt'),
    names: texts('.slip-meta-line b'),
    meta: texts('.slip-meta-line'),
    qrs: area.querySelectorAll('img.slip-qr').length,
    grids: area.querySelectorAll('.slip-answer-box.grid').length,
    boxes: area.querySelectorAll('.slip-answer-box').length,
    previewBoxes: document.querySelectorAll('#handoutPreview .slip-answer-box').length,
    previewSlips: document.querySelectorAll('#handoutPreview .slip').length,
    hint: (area.querySelector('.pk-sheet > .batch-empty') || {}).textContent || '',
    triTitle: (area.querySelector('.pk-sheet > .triage-print-page h1') || {}).textContent || '',
    triSub: (area.querySelector('.triage-print-sub') || {}).textContent || '',
    triNames: area.querySelectorAll('.triage-name-list li').length,
  };
});

/** The same sheets in print media. */
const onPaper = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const cs = x => getComputedStyle(x);
  const box = x => x.getBoundingClientRect();
  const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
  const clipped = [...area.querySelectorAll('*')].filter(x => cs(x).overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1);
  const sheets = [...area.children];
  const slips = [...area.querySelectorAll('.slip')];
  const spill = slips.filter(s => [...s.children].some(k => box(k).bottom > box(s).bottom + 1));
  const grid = area.querySelector('.slip-answer-box.grid');
  const first = slips[0];
  const firstBox = first && first.querySelector('.slip-answer-box');
  return {
    outside: outside.length,
    first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
    clipped: clipped.length,
    spill: spill.length,
    areaDisplay: cs(area).display,
    areaBg: cs(area).backgroundColor,
    ink: [...new Set([area, ...area.querySelectorAll('.slip, .slip-prompt, .triage-print-page, .triage-print-page h1, .triage-group')].map(x => cs(x).color))].join('|'),
    pageRule: (document.getElementById('pk-page-style') || {}).textContent || '',
    heights: sheets.map(x => box(x).height),
    slack: sheets.map(x => box(x).height - (x.firstElementChild ? box(x.firstElementChild).height : 0)),
    // slip 1 to slip 2, and (four to a page) slip 1 to slip 3
    across: slips[1] ? box(slips[1]).left - box(slips[0]).right : null,
    sameRow: slips[1] ? Math.abs(box(slips[1]).top - box(slips[0]).top) < 1 : null,
    widths: slips.slice(0, 4).map(x => box(x).width),
    down2: slips[1] ? box(slips[1]).top - box(slips[0]).bottom : null,
    down4: slips[2] ? box(slips[2]).top - box(slips[0]).bottom : null,
    border: first ? cs(first).borderTopStyle + ' ' + cs(first).borderTopColor : '',
    promptSize: first ? cs(first.querySelector('.slip-prompt')).fontSize : '',
    lineRule: first && first.querySelector('.slip-answer-line') ? cs(first.querySelector('.slip-answer-line')).borderBottomColor : '',
    boxBottom: firstBox ? box(first).bottom - box(firstBox).bottom : null,
    gridImage: grid ? cs(grid).backgroundImage : '',
    gridAdjust: grid ? cs(grid).printColorAdjust : '',
    qr: area.querySelector('img.slip-qr') ? box(area.querySelector('img.slip-qr')).width : 0,
  };
});

console.log('023 — the exit-ticket slips and the reteach list print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print\s*\{/.test(src), 'has no @media print block of its own');
ok(!/@page\s*\{/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');
ok(/<\/div>\n\n<div id="printArea" class="pk-paper"><\/div>\n/.test(src), '#printArea is a direct child of <body>, a .pk-paper, with no inline display');
ok(!/id="triagePrintArea"/.test(src), 'the reteach list has no second print area: print-area.css shows #printArea only');
ok(/margin:\s*'0\.4in'/.test(src), 'hands its old 0.4 in page margin to PrintKit.setPage()');
ok(!/printArea\.innerHTML/.test(src), 'nothing writes #printArea.innerHTML itself');
eq((src.match(/PrintKit\.renderSet\(els\.printArea,/g) || []).length, 4, 'four renderSet() calls: the handout, the class set, the empty class set, the reteach list');

const server = await serve(PORT);
const browser = await launch();

// At 96 px to the inch: half of (11in - 2 x 0.4in - 0.04in), and the 0.22 in
// between two slips (0.11 in of padding on each side of the cut).
const HALF = (11 - 0.8 - 0.04) / 2 * 96;
const GAP = 0.22 * 96;
const PAD = 0.11 * 96;

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, { set: s.set, prompt: s.prompt || SHORT, theme });
    try {
      eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
      eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
      await page.click('.tab-btn[data-tab="handout"]');
      if (s.names) { await page.fill('#batchNamesInput', s.names.join('\n')); await settle(page, 100); }
      eq(await page.textContent('#printBtn'), s.names ? 'Print Class Set' : 'Print Handout', `${what}: the button says what it prints`);
      await page.click('#printBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);
      const r = await built(page);
      const kind = s.per === 4 ? 'quarter' : 'half';
      const empty = s.names && !s.names.length;
      const count = s.names ? s.names.length : s.per;

      eq(r.chrome, 0, `${what}: no kit header or footer, and none of the preview's page or grid wrappers`);
      if (empty) {
        eq(r.n, 1, `${what}: one kit sheet`);
        eq(r.classes, 'pk-page pk-sheet', `${what}: a kit page`);
        eq(r.areaClass, 'pk-paper', `${what}: with no slip layout on it`);
        ok(/^Load a saved roster or paste names above/.test(r.hint), `${what}: it says what a class set needs, as the old sheet did`);
      } else {
        eq(r.n, count, `${what}: one kit sheet per ${s.names ? 'student' : 'slip'}`);
        eq(r.classes, `pk-${kind} pk-sheet${s.names ? '' : ' pk-sheet-blank'}`, `${what}: each is a ${kind} sheet`);
        eq(r.areaClass, `pk-paper pp${s.per}${s.per === 4 ? ' pk-quarters' : ''}`, `${what}: #printArea carries the slip size${s.per === 4 ? ' and the kit\'s quarter grid' : ''}`);
        eq(r.slipsPer, '1', `${what}: one slip on each`);
        eq(r.boxes, r.previewBoxes, `${what}: the print copy matches the preview slip for slip`);
        eq(r.previewSlips, count, `${what}: and the preview shows them all`);
        if (s.names) {
          eq(r.names.join('|'), s.names.join('|'), `${what}: each slip is made out to its student, in roster order`);
          ok(r.meta.every(t => /Date: _+$/.test(t)), `${what}: with a date line to write on`);
        } else {
          eq(r.names.length, 0, `${what}: no slip carries a name`);
          if (s.set) ok(r.meta.length === count && r.meta.every(t => /^Name: _+/.test(t)), `${what}: each has a rule where the name goes`);
        }
        if (s.different) eq(new Set(r.prompts).size, count, `${what}: every slip has its own prompt`);
        else if (s.set) ok(r.prompts.every(t => t === (s.prompt || SHORT).trim()), `${what}: every slip carries the prompt`);
        eq(r.qrs, s.qr ? count : 0, `${what}: ${s.qr ? 'every slip carries the QR code' : 'no QR code'}`);
        eq(r.grids, s.grid ? count : 0, `${what}: ${s.grid ? 'every slip has the quarter-inch grid' : 'no grid'}`);
      }

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await onPaper(page);
      eq(m.areaDisplay, s.per === 4 && !empty ? 'grid' : 'block', `${what}: the sheet shows on paper${s.per === 4 && !empty ? ', as the kit\'s two-across grid' : ''}`);
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      eq(m.pageRule, '@page { size: letter portrait; margin: 0.4in; }', `${what}: the page is Letter with 0.4 in margins, as it was`);
      if (!empty) {
        eq(m.ink, 'rgb(0, 0, 0)', `${what}: the slips print black${theme === 'dark' ? ', not the dark theme\'s ink or the light one\'s' : ''}`);
        eq(m.spill, 0, `${what}: every line of a slip ends inside it`);
        eq(m.border, 'dashed rgb(136, 136, 136)', `${what}: a slip keeps its dashed edge to cut along`);
        eq(m.promptSize, s.per === 4 ? '16px' : '20.8px', `${what}: the prompt is at its paper size`);
        if (!s.grid) eq(m.lineRule, 'rgb(85, 85, 85)', `${what}: the writing rules are the darker paper grey`);
        ok(m.slack.every(d => Math.abs(d - PAD) <= 1), `${what}: a slip fills its sheet but for the cutter's 0.11 in (${m.slack[0].toFixed(1)} px)`);
        if (s.long) {
          ok(m.heights.every(h => h > HALF + 50), `${what}: a slip too long for its sheet makes the sheet taller (${Math.round(m.heights[0])} px), not shorter on text`);
        } else {
          ok(m.heights.every(h => Math.abs(h - HALF) <= 1), `${what}: every sheet is exactly half the printable page tall (${Math.round(m.heights[0])} px of ${Math.round(HALF)})`);
          ok(m.boxBottom !== null && m.boxBottom >= 0, `${what}: the response area ends inside the slip`);
        }
        if (s.per === 4 && count > 1) {
          ok(m.sameRow, `${what}: the first two slips sit side by side`);
          ok(Math.abs(m.across - GAP) <= 1, `${what}: 0.22 in apart (${m.across.toFixed(1)} px)`);
          ok(Math.max(...m.widths) - Math.min(...m.widths) < 1.5, `${what}: and the same width, for the paper cutter`);
          if (count > 2) ok(Math.abs(m.down4 - GAP) <= 1, `${what}: the rows are 0.22 in apart (${m.down4.toFixed(1)} px)`);
        } else if (count > 1) {
          ok(Math.abs(m.down2 - GAP) <= 1, `${what}: the two slips of a page are 0.22 in apart (${m.down2.toFixed(1)} px)`);
        }
        if (s.grid) {
          eq((m.gridImage.match(/repeating-linear-gradient/g) || []).length, 2, `${what}: the grid is still drawn on paper`);
          ok(/rgb\(128, 141, 152\)/.test(m.gridImage), `${what}: in the darker paper grey`);
          eq(m.gridAdjust, 'exact', `${what}: and printed exactly (.pk-paper does not flatten it)`);
        }
        if (s.qr) ok(Math.abs(m.qr - 0.55 * 96) < 1, `${what}: the QR code is 0.55 in on a quarter sheet`);
      }

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, s.pages, `${what}: Chromium prints ${s.pages} page${s.pages === 1 ? '' : 's'}, as the old block did`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }

  // ---- the reteach list -------------------------------------------------------
  for (const t of TRIAGE) {
    const what = `${theme}, reteach list for ${t.n}`;
    const page = await open(browser, { set: settings({ perPage: 4 }), tri: triage(t.n), theme });
    try {
      await page.click('.tab-btn[data-tab="triage"]');
      await page.click('#printTriageBtn');
      await settle(page, 150);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);
      const r = await built(page);
      eq(r.n, 1, `${what}: one kit sheet`);
      eq(r.classes, 'pk-page pk-sheet', `${what}: a kit page`);
      eq(r.areaClass, 'pk-paper', `${what}: the slips' quarter grid is off #printArea`);
      eq(r.chrome, 0, `${what}: no kit header or footer (the list has its own heading and date)`);
      eq(r.triTitle, 'Reteach List & Small Groups', `${what}: its own heading is unchanged`);
      const q = Math.ceil(t.n / 4), almost = Math.floor((t.n + 2) / 4), got = Math.floor((t.n + 1) / 4);
      ok(r.triSub.endsWith(`${got} got it · ${almost} almost · ${q} reteach (${t.n} total)`), `${what}: under the date and the counts (${r.triSub})`);
      eq(r.triNames, q + almost, `${what}: everyone to reteach or check in with is listed`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await onPaper(page);
      eq(m.areaDisplay, 'block', `${what}: the sheet shows on paper`);
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      eq(m.ink, 'rgb(0, 0, 0)', `${what}: the list prints black`);

      await page.emulateMedia({ media: null });
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, t.pages, `${what}: Chromium prints ${t.pages} page${t.pages === 1 ? '' : 's'}, as the old block did`);
      // page.pdf() fires the page's own afterprint, which puts the handout back.
      const after = await built(page);
      eq(after.classes, 'pk-quarter pk-sheet pk-sheet-blank', `${what}: after printing, #printArea holds the handout again`);
      eq(after.n, 4, `${what}: all four slips of it`);
      eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
    } catch (e) {
      ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
    } finally {
      await page.context().close();
    }
  }
}

// ---- Ctrl+P, with no button pressed, prints the handout ------------------------------
// The old block showed a print area only after its button was pressed, so
// Ctrl+P printed an empty page.
{
  const page = await open(browser, { set: settings({ perPage: 4 }) });
  try {
    const r = await built(page);
    eq(r.n, 4, 'before any button is pressed, #printArea already holds the four slips');
    eq(pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false })), 1, 'and Ctrl+P prints them on one page');
    await page.emulateMedia({ media: 'print' });
    eq((await onPaper(page)).outside, 0, 'with nothing else on the paper');
  } catch (e) {
    ok(false, `Ctrl+P: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- text, not markup ---------------------------------------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Bo</b>';
  const prompt = '<u>Why</u> & <script>window.__pwned=1</script>?';
  const page = await open(browser, { set: settings({ batchMode: true }), prompt });
  try {
    await page.click('.tab-btn[data-tab="handout"]');
    await page.fill('#batchNamesInput', evil + '\nBella Cruz\n,\nCarlos Diaz');
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await built(page);
    eq(r.names[0], evil, 'a name reaches the slip character for character');
    eq(r.prompts[0], prompt, 'and so does the prompt');
    eq(r.names.join('|'), [evil, 'Bella Cruz', 'Carlos Diaz'].join('|'), 'a line that is not a name gets no named slip, and the rest keep their order');
    const x = await page.evaluate(() => ({
      injected: document.querySelectorAll('#printArea img:not(.slip-qr), #printArea u, #printArea script, #printArea .slip-meta-line b b, #handoutPreview u, #handoutPreview script').length,
      pwned: !!window.__pwned,
    }));
    eq(x.injected, 0, 'nothing typed became an element');
    eq(x.pwned, false, 'nothing typed ran');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- one button after another: each replaces the last sheet ----------------------
{
  const page = await open(browser, { set: settings({}), tri: triage(8) });
  try {
    await page.click('.tab-btn[data-tab="handout"]');
    await page.click('#printBtn');
    eq(await page.locator('#printArea > .pk-half').count(), 2, 'Print Handout builds two half sheets');
    await page.click('.tab-btn[data-tab="triage"]');
    await page.click('#printTriageBtn');
    eq(await page.locator('#printArea > *').count(), 1, 'the reteach list replaces them, it does not add to them');
    eq(await page.locator('#printArea .slip').count(), 0, 'and no slip is left over');
    await page.click('.tab-btn[data-tab="handout"]');
    await page.selectOption('#perPageSelect', '4');
    eq(await page.locator('#printArea > .pk-quarter').count(), 4, 'changing the handout puts four quarter sheets back');
    await page.check('#batchModeCheck');
    await page.fill('#batchNamesInput', 'Aiden Smith\nBella Cruz\nCarlos Diaz');
    await page.click('#printBtn');
    eq(await page.locator('#printArea > .pk-quarter:not(.pk-sheet-blank)').count(), 3, 'a class of three is three named quarter sheets');
    await page.selectOption('#perPageSelect', '2');
    await page.click('#printBtn');
    eq(await page.locator('#printArea > .pk-half').count(), 3, 'and three half sheets at two to a page');
    eq(await page.evaluate(() => document.getElementById('printArea').classList.contains('pk-quarters')), false, 'with the quarter grid off');
    eq(await page.evaluate(() => window.__printCalls), 4, 'print() was called once per press');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `one after another: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
