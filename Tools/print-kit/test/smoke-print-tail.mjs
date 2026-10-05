// smoke-print-tail.mjs — a print is the sheet and nothing after it (Path 7 P2).
//
//   node Tools/print-kit/test/smoke-print-tail.mjs
//
// Fifteen tools hide their editor in print with `body * { visibility: hidden }`
// and lay #printArea over it. What visibility hides still takes its height, so
// every print ran on for as many blank sheets as the editor was tall: 028's
// one-page worksheet came out of Chromium as seven pages, six of them empty.
// Since v228 each of those print blocks also takes everything but the sheet
// out of the flow with `display: none`, and since v229 so does
// _shared/print-area.css, for the twenty pages that print through it.
//
// For each page this opens it on the print audit's saved state
// (a11y-sweep/seeds.mjs, print-audit-prep.mjs), presses its print buttons and
// checks, per button:
//   - the button called print()
//   - in print media nothing outside the sheet has a box (the fix itself; this
//     is the assertion that fails on a page whose editor happens to be shorter
//     than its sheet, where the PDF alone would not show the bug)
//   - the sheet still shows something
//   - Chromium's own PDF has no page without a mark on it
//
// A blank page is one whose content stream paints nothing, with backgrounds
// off (a page's own background colour is painted on every sheet otherwise).
// print() is stubbed to throw, as the audit's is: several of these tools tidy
// up on the line after print(), and the real one would have blocked there.
//
// 042's certificate is a fixed-size sheet on purpose and is unchanged; only
// its tail went (it prints through print-area.css and the kit since v234). Every page that links _shared/print-area.css is in the table
// too: its rule needs #printArea to be a direct child of <body>, and "the
// sheet still shows" is what fails on a page that nests it.
//
// Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import zlib from 'node:zlib';
import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { ROSTERS, PAGE_SEEDS } from '../../a11y-sweep/seeds.mjs';
import { PRINT_PREP } from '../../board-check/print-audit-prep.mjs';

const PORT = 8466;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/** Pages in a Chromium PDF, and how many of them paint nothing. */
function pdfPages(buf) {
  const s = buf.toString('latin1');
  const objs = new Map();
  const re = /(\d+) 0 obj\s*([\s\S]*?)endobj/g;
  let m;
  while ((m = re.exec(s))) objs.set(+m[1], m[2]);
  let pages = 0, blank = 0;
  for (const body of objs.values()) {
    if (!/\/Type\s*\/Page[^s]/.test(body)) continue;
    pages++;
    const c = /\/Contents\s+(\d+) 0 R/.exec(body);
    const ob = c && objs.get(+c[1]);
    if (!ob) { blank++; continue; }
    let st = ob.slice(ob.indexOf('stream') + 6).replace(/^\r?\n/, '');
    st = st.slice(0, st.lastIndexOf('endstream'));
    let text = '';
    try { text = zlib.inflateSync(Buffer.from(st, 'latin1'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1'); } catch (e) { text = st; }
    // Text shown, a path filled or stroked, an image or form drawn.
    if (!/(?:^|\s)(?:Tj|TJ|f\*?|S|B\*?|Do|sh)(?:\s|$)/.test(text)) blank++;
  }
  return { pages, blank };
}

const fill016 = async page => {
  await page.fill('#qr-text', 'https://example.com/station-1');
  await page.waitForFunction(() => !document.getElementById('btn-print').disabled);
};
const bulk016 = async page => {
  await page.click('label[for="mode-bulk"]');
  await page.fill('#bulk-text', 'Station 1, https://example.com/1\nStation 2, https://example.com/2\nStation 3, https://example.com/3');
  await page.click('#btn-bulk-generate');
  await page.waitForFunction(() => document.getElementById('print-area-bulk').children.length === 3);
};
// 085's batch button shows once batch mode is on, and prints once a saved roster is picked.
const batch085 = async page => {
  await page.check('#batchToggle');
  await page.evaluate(() => {
    const sel = document.getElementById('importSelect');
    const opt = [...sel.options].find(o => o.value);
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => /\d/.test(document.getElementById('batchStatus').textContent));
};
const prep040 = PRINT_PREP['040'][0].run;

// `click` is the button, by its label or its id; `before` gets the page to
// where that button works; `sheet` is the element that prints. Each page is
// named in full so `run-suites.mjs --changed` picks this suite for an edit to it.
const AREA = '#printArea';
const PAGES = [
  { file: '003-rubric-builder.html', prints: [{ click: 'Print' }] },
  { file: '016-qr-code-generator.html', prints: [
    { click: 'Print this code', before: fill016, sheet: '#print-area' },
    { click: '#btn-bulk-print', before: bulk016, sheet: '#print-area-bulk' },
  ] },
  { file: '017-gallery-walk-qr.html', prints: [   // since Path 7 P3: print-area.css + the print kit (it had no row)
    { click: '#printCodesBtn' }, { click: '#printRefBtn' }, { click: '#printSlipsBtn' }, { click: '#printPacketsBtn' }, { click: '#printRouteCardsBtn' },
  ] },
  { file: '018-qr-scavenger-hunt-builder.html', prints: [   // since Path 7 P3: print-area.css + the print kit (it had no row)
    { click: '#print-stations-btn' }, { click: '#print-answers-btn' }, { click: '#print-clues-btn' },
    { click: '#print-teams-btn', before: PRINT_PREP['018'][0].run }, { click: '#print-routes-btn', before: PRINT_PREP['018'][0].run },
    { click: '#print-answersheets-btn', before: PRINT_PREP['018'][0].run },
  ] },
  { file: '023-exit-ticket-generator.html', prints: [{ click: '#printBtn' }, { click: '#printTriageBtn', before: PRINT_PREP['023'][0].run }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '024-number-talks-board.html', prints: [{ click: 'Print session record' }] },
  { file: '028-primary-source-analysis-generator.html', prints: [{ click: 'Print student worksheet (blank)' }, { click: 'Print answer key (with notes)' }] },
  { file: '033-ssr-log-tracker.html', prints: [{ click: 'Print class summary' }] },
  { file: '037-grade-distribution-visualizer.html', prints: [{ click: 'Print' }] },
  { file: '039-vocab-conjugation-drill.html', prints: [{ click: 'Print' }] },
  { file: '040-vocab-flashcard-generator.html', prints: [{ click: 'Print alignment test page' }, { click: 'Print', before: prep040 }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '041-formula-sheet-builder.html', prints: [{ click: 'Print' }] },
  { file: '042-certificate-award-maker.html', prints: [{ click: 'Print / Save as PDF' }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '043-field-trip-permission-slip.html', prints: [{ click: 'Print' }, { click: 'Print missing list' }, { click: 'Print reminder slips' }, { click: 'Print chaperone groups' }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '061-fraction-decimal-percent-drill-generator.html', prints: [{ click: 'Print worksheet' }] },
  { file: '063-grammar-mad-libs-generator.html', prints: [{ click: 'Print worksheet' }] },
  { file: '064-historical-trading-card-maker.html', prints: [{ click: 'Print cards' }] },   // since Path 7 P3: print-area.css + the print kit (it had no row: a deck of one page ran on to a third sheet)
  { file: '068-parent-contact-log.html', prints: [{ click: 'Print this list' }] },
  { file: '078-unit-conversion-chart-builder.html', prints: [{ click: 'Print chart' }] },
  // The pages that take the rule from _shared/print-area.css (v229).
  { file: '049-book-tasting-menu-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '050-civics-role-card-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '051-classroom-label-maker.html', prints: [{ click: '#printBtn' }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '052-cognates-false-friends-builder.html', prints: [{ click: '#printBtn' }] },
  { file: '054-current-events-discussion-guide-generator.html', prints: [{ click: '#printBtn' }, { click: '#printAllLevelsBtn' }] },
  { file: '056-dbq-source-packet-builder.html', prints: [{ click: '#printBtn' }, { click: '#printAllLevelsBtn' }] },
  { file: '057-dichotomous-key-builder.html', prints: [{ click: '#printBtn' }] },
  { file: '058-duty-roster-builder.html', prints: [{ click: '#printBtn' }] },
  { file: '059-experiment-design-planner.html', prints: [{ click: '#printBtn' }] },
  { file: '060-fitness-skill-assessment-tracker.html', prints: [{ click: '#printBtn' }] },
  { file: '065-lab-report-template-builder.html', prints: [{ click: '#printBtn' }, { click: '#previewPrintBtn' }] },
  { file: '070-peer-feedback-checklist-generator.html', prints: [{ click: '#printBtn' }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '071-picture-prompt-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '072-plot-diagram-builder.html', prints: [{ click: '#printBtn' }] },
  { file: '073-science-fair-project-tracker.html', prints: [{ click: '#printBtn' }] },
  { file: '074-science-safety-label-maker.html', prints: [{ click: '#printBtn' }] },
  { file: '076-sub-note-feedback-slip-generator.html', prints: [{ click: '#printBtn' }] },   // since Path 7 P3: print-area.css + the print kit
  { file: '077-testing-accommodations-card-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '079-verb-conjugation-poster-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '082-citation-generator.html', prints: [{ click: '#printBtn' }] },
  { file: '083-propaganda-analysis-worksheet-generator.html', prints: [{ click: '#printWorksheetBtn' }, { click: '#printKeyBtn' }] },
  { file: '084-socratic-seminar-prep-organizer.html', prints: [{ click: '#printRosterBtn' }, { click: '#printBlankBtn' }] },
  { file: '085-parent-communication-templates.html', prints: [{ click: '#printOneBtn' }, { click: '#printBatchBtn', before: batch085 }] },
];

const server = await serve(PORT);
const browser = await launch();

console.log('Print tail — the sheet, and no blank pages after it');

for (const { file, prints } of PAGES) {
  const num = file.slice(0, 3);
  const seed = { ...ROSTERS, ...(PAGE_SEEDS[num] ? PAGE_SEEDS[num]() : {}) };
  for (const { click, before, sheet = AREA } of prints) {
    const what = `${num} "${click}"`;
    const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
    await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; throw new Error('smoke-print-tail: print() stub'); }; });
    await page.addInitScript(entries => {
      if (sessionStorage.getItem('__tailSeeded')) return;
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      sessionStorage.setItem('__tailSeeded', '1');
    }, seed);
    page.on('dialog', d => d.dismiss().catch(() => {}));
    try {
      await page.goto(`${BASE}/Tools/${encodeURI(file)}`, { waitUntil: 'load' });
      await settle(page, 400);
      if (before) { await before(page); await settle(page, 300); }
      const clicked = await page.evaluate(want => {
        // By id, or the shown button with exactly this label (an emoji before it aside).
        const label = x => (x.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w]+/, '');
        const b = want[0] === '#' ? document.querySelector(want)
          : [...document.querySelectorAll('button, [role="button"], a.btn')].find(x => !x.disabled && x.getClientRects().length && label(x) === want);
        if (!b) return false;
        b.click();
        return true;
      }, click);
      ok(clicked, `${what}: the button is there to press`);
      await settle(page, 300);
      eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);

      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      const m = await page.evaluate(sel => {
        const area = document.querySelector(sel);
        const boxed = [...document.body.querySelectorAll('*')].filter(el => !area.contains(el) && !el.contains(area) && el.getClientRects().length);
        const shown = [...area.querySelectorAll('*')].filter(el => getComputedStyle(el).visibility === 'visible' && el.getClientRects().length);
        return { boxed: boxed.length, first: boxed[0] ? boxed[0].tagName.toLowerCase() + (boxed[0].id ? '#' + boxed[0].id : '') : '', shown: shown.length };
      }, sheet);
      eq(m.boxed, 0, `${what}: nothing outside the sheet takes room on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      ok(m.shown > 0, `${what}: the sheet still shows`);
      // page.pdf() fires the page's own afterprint: everything above is measured first.
      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const pdf = pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      ok(pdf.pages >= 1, `${what}: Chromium prints at least one page (got ${pdf.pages})`);
      eq(pdf.blank, 0, `${what}: no blank page among Chromium's ${pdf.pages}`);
      const errs = page.__errs.filter(e => !/print\(\) stub/.test(JSON.stringify(e)));
      eq(errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(errs.slice(0, 3))}`);
      eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
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
