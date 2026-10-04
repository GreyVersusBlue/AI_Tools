// smoke-print.mjs — 043 prints through the shared print kit (Path 7 P3).
//
//   node Tools/field-trip-permission-slip/test/smoke-print.mjs
//
// 043 is the kit's fourth adopter and the first with a roster. It had its own
// `@media print` block and an `@page` at 0.4 in; both are gone. print-area.css
// puts #printArea alone on the paper, PrintKit.setPage() writes the page, and
// each of the four print buttons hands PrintKit.renderSet() one sheet's content:
//
//   Print                  one slip (mode 'one'), one per student (mode 'set',
//                          with the kit's "name / 3 of 28" footer), or blanks
//   Print missing list     one page (mode 'one'), no header or footer
//   Print reminder slips   one per missing student (mode 'set') on half sheets
//                          with the cut line: two to a page, where each took a
//                          whole page for its five lines
//   Print chaperone groups one page under the kit's header: destination,
//                          school / teacher line, trip date
//
// What this pins, for every button in every state, light and dark:
//   - the sheets the kit builds, their classes, their header and footer
//   - only the sheet has a box on paper, nothing on it is clipped, and the
//     kit's header and footer print black on white in the dark theme too
//   - Chromium's PDF page count. Every one is what the hand-written block
//     printed (measured on the old page, 2026-10-04, before the adoption)
//     except the reminder slips, which are half as many pages; `was` is the
//     old count where it differs
//   - a name or a destination reaches the header and footer as text
//
// print() is stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8470;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '043-field-trip-permission-slip.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

// Made-up names only: the roster is student-shaped data.
const LONG = ('Students will tour the local history wing, sketch two artifacts, interview a docent and complete the gallery ' +
  'worksheet for the unit on the river towns. ').repeat(14);
const roster = n => Array.from({ length: n }, (_, i) => 'Student ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? '2' : '') + ' Sample');
const THREE = ['Aiden Smith', 'Bella Cruz', 'Carlos Diaz'];
const trip = over => Object.assign({
  name: 'Museum Trip', mode: 'batch', studentName: '', batchNames: THREE.join('\n'), blankCount: 5,
  collected: { 'Aiden Smith': { returned: true, payment: 'paid' } },
  chaperones: [{ name: 'Mr. Lee', phone: '555-0100' }], chaperoneAssignments: { 'Aiden Smith': 'Mr. Lee' },
  schoolTeacher: 'East Middle', destination: 'City Museum', tripStartDate: '2026-10-20', tripEndDate: '',
  departureTime: '08:30', returnTime: '14:15', purpose: 'Tour the local history wing.', cost: '$12', whatToBring: 'Lunch.',
  chaperoneName: '', chaperonePhone: '', emergencyInstructions: '', dueDate: '2026-10-15',
  secondLang: '', langLayout: 'facing', translations: { purpose: '', whatToBring: '', emergencyInstructions: '' },
}, over);
const HEAD = ['City Museum', 'East Middle', 'October 20, 2026'];

// `slips` is who gets a slip (null is a blank copy); `kit` the renderSet mode;
// `per` the slips on one kit sheet (2 with a second language); `missing` who
// still owes something; `pages` Chromium's PDF page count for the four buttons
// in order, and `was` the old block's count for the reminder slips.
const STATES = [
  { name: 'a first visit', state: null, slips: ['Student Name'], kit: 'one', missing: [], head: null, pages: [1, 1, 1, 1] },
  { name: 'a class of three', state: trip({}), slips: THREE, kit: 'set', missing: THREE.slice(1), pages: [3, 1, 1, 1], was: 2 },
  { name: 'a class of twenty-eight', state: trip({ batchNames: roster(28).join('\n'), collected: {}, chaperoneAssignments: {} }),
    slips: roster(28), kit: 'set', missing: roster(28), pages: [28, 1, 14, 1], was: 28 },
  { name: 'one named student', state: trip({ mode: 'single', studentName: 'Bella Cruz', batchNames: '' }), slips: ['Bella Cruz'], kit: 'one', missing: [], pages: [1, 1, 1, 1] },
  { name: 'one student, no name, no roster', state: trip({ mode: 'single', batchNames: '', collected: {}, chaperoneAssignments: {} }),
    slips: ['Student Name'], kit: 'one', missing: [], pages: [1, 1, 1, 1] },
  { name: 'five blank copies', state: trip({ mode: 'blank' }), slips: [null, null, null, null, null], kit: 'blank', missing: THREE.slice(1), pages: [5, 1, 1, 1], was: 2 },
  { name: 'batch mode with no names', state: trip({ batchNames: '', collected: {}, chaperoneAssignments: {} }), slips: ['Student Name'], kit: 'one', missing: [], pages: [1, 1, 1, 1] },
  { name: 'three, Spanish on a facing page', state: trip({ secondLang: 'es' }), slips: THREE, kit: 'set', per: 2, missing: THREE.slice(1), pages: [6, 1, 1, 1], was: 2 },
  // A side-by-side pair is 1010 px tall at this length and the printable page
  // is 979, so each pair runs on to a second sheet. It did before the adoption
  // too (6 pages); it is 043's own layout, not the kit's, and is not fixed here.
  { name: 'three, Spanish side by side', state: trip({ secondLang: 'es', langLayout: 'column' }), slips: THREE, kit: 'set', per: 2, pair: true, missing: THREE.slice(1), pages: [6, 1, 1, 1], was: 2 },
  { name: 'three, a long description', state: trip({ purpose: LONG, whatToBring: LONG }), slips: THREE, kit: 'set', missing: THREE.slice(1), pages: [6, 1, 1, 1], was: 2 },
  { name: 'everything returned', state: trip({ collected: { 'Aiden Smith': { returned: true, payment: 'paid' }, 'Bella Cruz': { returned: true, payment: 'paid' }, 'Carlos Diaz': { returned: true, payment: 'waived' } } }),
    slips: THREE, kit: 'set', missing: [], pages: [3, 1, 1, 1] },
];
const BUTTONS = ['printBtn', 'printMissingListBtn', 'printReminderSlipsBtn', 'printChaperoneBtn'];

async function open(browser, state, theme) {
  const page = await prepPage(browser, BASE, { width: 1100, height: 900 });
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  await page.addInitScript(([saved, dark]) => {
    if (saved) {
      localStorage.setItem('gvb-field-trip:list', JSON.stringify(['Museum Trip']));
      localStorage.setItem('gvb-field-trip:current', 'Museum Trip');
      localStorage.setItem('gvb-field-trip:data:Museum Trip', saved);
    }
    if (dark) localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: 'dark' }));
  }, [state ? JSON.stringify(state) : null, theme === 'dark']);
  await page.goto(`${BASE}/Tools/${FILE}`, { waitUntil: 'load' });
  await settle(page, 300);
  return page;
}

/** What the kit built in #printArea. */
const built = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const sheets = [...area.children];
  const texts = (root, sel) => [...root.querySelectorAll(sel)].map(x => x.textContent);
  return {
    n: sheets.length,
    classes: [...new Set(sheets.map(x => x.className.replace(/\s*pk-cut/, '')))].join('|'),
    cut: sheets.map((x, i) => x.classList.contains('pk-cut') ? i : -1).filter(i => i >= 0).join(','),
    headers: area.querySelectorAll('.pk-header').length,
    head: texts(area, '.pk-header > span'),
    footers: area.querySelectorAll('.pk-footer').length,
    footNames: texts(area, '.pk-f-name'),
    footCounts: texts(area, '.pk-f-count'),
    footLast: sheets.every(x => !x.querySelector('.pk-footer') || x.lastElementChild.classList.contains('pk-footer')),
    slipsPer: [...new Set(sheets.map(x => x.querySelectorAll('.slip').length))].join(','),
    pairs: area.querySelectorAll('.pk-sheet > .slip-pair').length,
    slipNames: texts(area, '.slip[data-slip-lang="en"] .slip-student-line'),
    blanks: area.querySelectorAll('.slip-student-line.blank').length,
    qrs: area.querySelectorAll('.slip-qr').length,
    reminders: texts(area, '.pk-sheet > .reminder-slip .rline:first-of-type'),
    nothing: (area.querySelector(':scope > p.nothing-missing') || {}).textContent || '',
    listRows: area.querySelectorAll('.pk-sheet > .missing-list-page tr').length,
    listTitle: (area.querySelector('.missing-list-page h2') || {}).textContent || '',
    chapTitle: (area.querySelector('.pk-sheet > .chaperone-print h2') || {}).textContent || '',
    groups: area.querySelectorAll('.chaperone-group').length,
  };
});

/** The same sheets in print media. */
const onPaper = page => page.evaluate(() => {
  const area = document.getElementById('printArea');
  const outside = [...document.body.querySelectorAll('*')].filter(x => !area.contains(x) && !x.contains(area) && x.getClientRects().length);
  const clipped = [...area.querySelectorAll('*')].filter(x => {
    const cs = getComputedStyle(x);
    return cs.overflowY !== 'visible' && x.scrollHeight > x.clientHeight + 1;
  });
  const chrome = [...area.querySelectorAll('.pk-header, .pk-footer, .pk-header > span, .pk-footer > span')];
  const sheets = [...area.children];
  const cs = x => getComputedStyle(x);
  return {
    outside: outside.length,
    first: outside[0] ? outside[0].tagName.toLowerCase() + (outside[0].className ? '.' + outside[0].className : '') : '',
    clipped: clipped.length,
    chromeInk: [...new Set(chrome.map(x => cs(x).color))].join('|'),
    chromeRule: [...new Set([...area.querySelectorAll('.pk-header')].map(x => cs(x).borderBottomColor).concat([...area.querySelectorAll('.pk-footer')].map(x => cs(x).borderTopColor)))].join('|'),
    ink: [...new Set([...area.querySelectorAll('.slip, .reminder-slip, .missing-list-page, .chaperone-print')].map(x => cs(x).color))].join('|'),
    areaBg: cs(area).backgroundColor,
    display: cs(area).display,
    heights: sheets.map(x => x.getBoundingClientRect().height),
    inner: sheets.map(x => [...x.children].reduce((h, k) => h + k.getBoundingClientRect().height, 0)),
    cutStyle: sheets[0] ? cs(sheets[0]).borderBottomStyle : '',
    shadow: [...new Set([...area.querySelectorAll('.slip')].map(x => cs(x).boxShadow))].join('|'),
    reminderBorder: [...new Set([...area.querySelectorAll('.reminder-slip')].map(x => cs(x).borderTopStyle))].join('|'),
    pageRule: (document.getElementById('pk-page-style') || {}).textContent || '',
  };
});

console.log('043 — the permission slips, lists and reminders print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');
ok(/<div id="printArea"><\/div>/.test(src), '#printArea carries no inline display, which print-area.css could not undo');
ok(/margin:\s*'0\.4in'/.test(src), 'hands its old 0.4 in page margin to PrintKit.setPage()');
ok(!/getElementById\('printArea'\)\.innerHTML/.test(src), 'no print button writes #printArea.innerHTML itself');
eq((src.match(/PrintKit\.renderSet\(/g) || []).length, 6, 'six renderSet() calls: three slip modes, the list, the reminders, the chaperone sheet');

const server = await serve(PORT);
const browser = await launch();

// (11in - 2 x 0.4in - 0.04in) / 2 at 96 px to the inch.
const HALF = (11 - 0.8 - 0.04) / 2 * 96;

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    for (let b = 0; b < BUTTONS.length; b++) {
      const what = `${theme}, ${s.name}, ${BUTTONS[b]}`;
      const page = await open(browser, s.state, theme);
      try {
        eq(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme, `${what}: the page is in ${theme}`);
        eq(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display), 'none', `${what}: the sheet is hidden on screen`);
        await page.click('#' + BUTTONS[b]);
        await settle(page, 150);
        eq(await page.evaluate(() => window.__printCalls), 1, `${what}: it called print()`);
        const r = await built(page);
        const head = s.head === null ? [] : HEAD;

        if (b === 0) {
          const per = s.per || 1;
          eq(r.n, s.slips.length, `${what}: one kit sheet per student or copy`);
          eq(r.classes, 'pk-page pk-sheet' + (s.kit === 'blank' ? ' pk-sheet-blank' : ''), `${what}: each is a kit page`);
          eq(r.slipsPer, String(per), `${what}: ${per === 2 ? 'the English slip and its translation' : 'one slip'} on each`);
          eq(r.pairs, s.pair ? s.slips.length : 0, `${what}: side by side only when that layout is chosen`);
          eq(r.headers, 0, `${what}: no kit header (the slip has its own letterhead)`);
          if (s.kit === 'set') {
            eq(r.footers, s.slips.length, `${what}: a class set carries the kit footer on every sheet`);
            eq(r.footNames.join('|'), s.slips.join('|'), `${what}: the footer names the student`);
            eq(r.footCounts.join('|'), s.slips.map((_, i) => `${i + 1} of ${s.slips.length}`).join('|'), `${what}: and counts the stack, "N of M"`);
            ok(r.footLast, `${what}: the footer closes the sheet`);
            eq(r.slipNames.join('|'), s.slips.join('|'), `${what}: each slip is made out to its student, in roster order`);
          } else {
            eq(r.footers, 0, `${what}: no footer on ${s.kit === 'blank' ? 'blank copies' : 'a single slip'} (nothing to count)`);
            if (s.kit === 'blank') eq(r.blanks, s.slips.length * per, `${what}: every copy has a rule where the name goes`);
            else eq(r.slipNames.join('|'), s.slips[0], `${what}: the slip is made out to ${s.slips[0]}`);
          }
          eq(r.qrs, s.slips.length * per, `${what}: every slip carries its QR code`);
        } else if (b === 1) {
          eq(r.n, 1, `${what}: one kit sheet`);
          eq(r.classes, 'pk-page pk-sheet', `${what}: a kit page`);
          eq(r.headers + r.footers, 0, `${what}: no header or footer (a pocket list, 4.25 in wide)`);
          eq(r.listRows, 1 + Math.max(1, s.missing.length), `${what}: a row for everyone still missing`);
          eq(r.listTitle, (s.state ? 'Museum Trip' : 'New Field Trip') + ' — Still Missing', `${what}: under the trip's name`);
        } else if (b === 2) {
          if (!s.missing.length) {
            eq(r.n, 1, `${what}: one line and no sheets`);
            eq(r.nothing, 'Nobody is missing anything for this trip right now.', `${what}: it says nobody is missing anything`);
          } else {
            eq(r.n, s.missing.length, `${what}: one kit sheet per missing student`);
            eq(r.classes, 'pk-half pk-sheet', `${what}: each is a half sheet`);
            eq(r.cut, Array.from({ length: Math.ceil(s.missing.length / 2) }, (_, i) => i * 2).join(','), `${what}: the cut line is under the upper slip of each pair`);
            eq(r.reminders.join('|'), s.missing.map(n => 'Student: ' + n).join('|'), `${what}: each reminder names its student, in roster order`);
            eq(r.headers + r.footers, 0, `${what}: no header or footer on a half sheet`);
          }
        } else {
          eq(r.n, 1, `${what}: one kit sheet`);
          eq(r.classes, 'pk-page pk-sheet', `${what}: a kit page`);
          eq(r.headers, head.length ? 1 : 0, `${what}: ${head.length ? 'the kit header is on it' : 'no header when there is nothing to put in it'}`);
          eq(r.head.join('|'), head.join('|'), `${what}: the header is the destination, the school line and the trip date`);
          eq(r.footers, 0, `${what}: no footer on a one-page sheet`);
          eq(r.chapTitle, (s.state ? 'Museum Trip' : 'New Field Trip') + ' — Chaperone Groups', `${what}: its own title is unchanged`);
        }

        await page.emulateMedia({ media: 'print' });
        await settle(page, 150);
        const m = await onPaper(page);
        eq(m.display, 'block', `${what}: the sheet shows on paper`);
        eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
        eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
        // A .paper-sheet keeps the light theme's ink in the dark theme (ink-paper.css),
        // which is what these sheets printed in before the adoption too.
        if (b !== 2 || s.missing.length) eq(m.ink, theme === 'dark' ? 'rgb(31, 36, 48)' : 'rgb(0, 0, 0)', `${what}: the sheet's text is ${theme === 'dark' ? 'the light theme\'s ink' : 'black'}, not the dark theme's`);
        eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
        eq(m.pageRule, '@page { size: letter portrait; margin: 0.4in; }', `${what}: the page is Letter with 0.4 in margins, as it was`);
        ok(m.heights.every((h, i) => h >= m.inner[i] - 1), `${what}: every kit sheet is as tall as what is on it`);
        if (b === 0) {
          eq(m.shadow, 'none', `${what}: the slip's preview shadow is not printed`);
          if (s.kit === 'set') {
            eq(m.chromeInk, 'rgb(0, 0, 0)', `${what}: the footer prints black`);
            eq(m.chromeRule, 'rgb(0, 0, 0)', `${what}: and so does its rule`);
          }
        }
        if (b === 2 && s.missing.length) {
          ok(m.heights.every(h => Math.abs(h - HALF) <= 1), `${what}: every reminder is exactly a half sheet (${Math.round(m.heights[0])} px of ${Math.round(HALF)})`);
          eq(m.cutStyle, 'dashed', `${what}: the cut line is dashed`);
          eq(m.reminderBorder, 'none', `${what}: the reminder's own dashed box is not printed`);
        }
        if (b === 3 && head.length) {
          eq(m.chromeInk, 'rgb(0, 0, 0)', `${what}: the header prints black`);
          eq(m.chromeRule, 'rgb(0, 0, 0)', `${what}: and so does its rule`);
        }

        await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
        const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
        const was = b === 2 && s.was ? s.was : 0;
        eq(pdf, s.pages[b], `${what}: Chromium prints ${s.pages[b]} page${s.pages[b] === 1 ? '' : 's'}${was ? ` (the old block printed ${was})` : ', as the old block did'}`);
        eq(page.__errs.length, 0, `${what}: no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
        eq(page.__blocked.length, 0, `${what}: nothing tried to leave the site`);
      } catch (e) {
        ok(false, `${what}: ${String(e.message || e).split('\n')[0]}`);
      } finally {
        await page.context().close();
      }
    }
  }
}

// ---- text, not markup ---------------------------------------------------------
{
  const evil = '<img src=x onerror="window.__pwned=1"> & <b>Bo</b>';
  const place = '<u>Zoo</u> & <script>window.__pwned=1</script>';
  const page = await open(browser, trip({ batchNames: evil + '\nBella Cruz', destination: place, schoolTeacher: 'Room 12 & "Team A"', tripEndDate: '2026-10-22', collected: {}, chaperoneAssignments: {} }));
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    let r = await built(page);
    eq(r.footNames[0], evil, 'a name reaches the footer character for character');
    eq(r.slipNames[0], evil, 'and the slip');
    await page.click('#printReminderSlipsBtn');
    await settle(page, 150);
    r = await built(page);
    eq(r.reminders[0], 'Student: ' + evil, 'and the reminder slip');
    await page.click('#printChaperoneBtn');
    await settle(page, 150);
    r = await built(page);
    eq(r.head[0], place, 'the destination reaches the header character for character');
    eq(r.head[1], 'Room 12 & "Team A"', 'and the school line');
    eq(r.head[2], 'October 20, 2026 – October 22, 2026', 'a trip of several days is a date range with a real dash, not an entity');
    const x = await page.evaluate(() => ({
      injected: document.querySelectorAll('#printArea img:not(.slip-qr), #printArea u, #printArea script, #printArea li b, #previewArea u, #previewArea script').length,
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
  const page = await open(browser, trip({}));
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-page').count(), 3, 'Print builds three pages for a class of three');
    await page.click('#printChaperoneBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 1, 'the chaperone sheet replaces them, it does not add to them');
    eq(await page.locator('#printArea .pk-footer').count(), 0, 'and the slips\' footers are gone');
    await page.click('#printReminderSlipsBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-half').count(), 2, 'the reminders replace it with two half sheets');
    eq(await page.locator('#printArea .pk-header').count(), 0, 'and no header is left over');
    await page.click('#printMissingListBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 1, 'the missing list replaces those');
    await page.click('.mode-tab[data-mode="blank"]');
    await page.fill('#blankCount', '4');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-sheet-blank').count(), 4, 'four blank copies after switching mode');
    eq(await page.locator('#printArea .pk-footer').count(), 0, 'with no footer');
    eq(await page.evaluate(() => window.__printCalls), 5, 'print() was called once per press');
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
