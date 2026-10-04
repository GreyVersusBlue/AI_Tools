// smoke-print.mjs — 076 prints through the shared print kit (Path 7 P3).
//
//   node Tools/sub-note-feedback-slip-generator/test/smoke-print.mjs
//
// 076 is the kit's first adopter. It had its own `@media print` block: the
// editor hidden with `visibility`, slips at `min-height: 47vh`, a page break
// after every second one, and a `.one-up` switch for a long prompt list. All
// of that is now _shared/print-area.css (the sheet alone on the paper) and
// _shared/print-kit.css + print-kit.js (`PrintKit.renderSet`, mode 'blank',
// half sheets, or full pages past five prompts).
//
// What this pins:
//   - the page links the three shared files and has no print block of its own
//   - "Print slips" builds one kit sheet per copy, the count clamped to 1..20
//   - two slips to a page, the cut line under the upper one of each pair
//   - past five prompts every slip is a page of its own
//   - a half sheet that runs long grows and takes its own page; nothing clips
//   - Chromium's PDF page count, per state, is what the hand-written block
//     printed (measured on the old page before it was replaced), in light and
//     in dark
//   - what the teacher typed reaches the slip as text, never as markup
//   - only the sheet has a box on paper, and the paper is black on white
//
// print() is stubbed. Nothing here has been checked against a printer.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { SITE, serve, launch, prepPage, settle } from '../../board-check/harness.mjs';

const PORT = 8467;
const BASE = `http://127.0.0.1:${PORT}`;
const FILE = '076-sub-note-feedback-slip-generator.html';
const KEY = 'snfs_slip_v1';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const pdfPageCount = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const LONG = 'Describe in detail everything that happened during the class period including transitions, behaviour, ' +
  'questions students asked, and what you would change next time if you were to teach this lesson again tomorrow morning';
const prompts = (n, text) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, text: text || `Prompt number ${i + 1}?` }));

// `pages` is what the old hand-written print block produced for the same
// state in Chromium's PDF (2026-10-04, before the adoption).
const STATES = [
  { name: 'two copies, four prompts', state: { copyCount: 2, classPeriod: '', urgencyBox: true, prompts: prompts(4) }, slips: 2, sheet: 'pk-half', pages: 1 },
  { name: 'five copies, a class period', state: { copyCount: 5, classPeriod: '3rd Period', urgencyBox: true, prompts: prompts(4) }, slips: 5, sheet: 'pk-half', pages: 3 },
  { name: 'four copies, five prompts, no call-me box', state: { copyCount: 4, classPeriod: '', urgencyBox: false, prompts: prompts(5) }, slips: 4, sheet: 'pk-half', pages: 2 },
  { name: 'three copies, six prompts', state: { copyCount: 3, classPeriod: '3rd Period', urgencyBox: true, prompts: prompts(6) }, slips: 3, sheet: 'pk-page', pages: 3 },
  { name: 'four copies, five wordy prompts', state: { copyCount: 4, classPeriod: '', urgencyBox: true, prompts: prompts(5, LONG) }, slips: 4, sheet: 'pk-half', pages: 4, grows: true },
  { name: 'one copy', state: { copyCount: 1, classPeriod: '', urgencyBox: true, prompts: prompts(4) }, slips: 1, sheet: 'pk-half', pages: 1 },
  { name: 'a saved count past the limit', state: { copyCount: 99, classPeriod: '', urgencyBox: true, prompts: prompts(4) }, slips: 20, sheet: 'pk-half', pages: 10 },
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

console.log('076 — the sub note slips print through the shared kit');

// ---- the page itself -------------------------------------------------------
const src = fs.readFileSync(path.join(SITE, 'Tools', FILE), 'utf8');
ok(/href="\.\.\/_shared\/print-area\.css"/.test(src), 'links _shared/print-area.css');
ok(/href="\.\.\/_shared\/print-kit\.css"/.test(src), 'links _shared/print-kit.css');
ok(/src="\.\.\/_shared\/print-kit\.js"/.test(src), 'loads _shared/print-kit.js');
ok(!/@media\s+print/.test(src), 'has no @media print block of its own');
ok(!/@page/.test(src), 'writes no @page rule of its own (PrintKit.setPage does)');
ok(src.indexOf('print-area.css') < src.indexOf('<style>'), 'print-area.css is linked before the inline <style>');

const server = await serve(PORT);
const browser = await launch();

for (const theme of ['light', 'dark']) {
  for (const s of STATES) {
    const what = `${theme}, ${s.name}`;
    const page = await open(browser, s.state, theme);
    try {
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
          slips: area.querySelectorAll('.pk-sheet > .slip').length,
          chrome: area.querySelectorAll('.pk-header, .pk-footer').length,
          boxes: area.querySelectorAll('.slip-urgency').length,
          lines: area.querySelectorAll('.slip-line').length,
          meta: area.querySelector('.meta-line').textContent,
        };
      });
      eq(built.n, s.slips, `${what}: one sheet per copy`);
      eq(built.slips, s.slips, `${what}: each sheet holds one slip`);
      eq(built.classes.join('|'), `${s.sheet} pk-sheet pk-sheet-blank`, `${what}: the sheets are the kit's ${s.sheet}`);
      const wantCut = s.sheet === 'pk-half' ? Array.from({ length: Math.ceil(s.slips / 2) }, (_, i) => i * 2) : [];
      eq(built.cut.join(','), wantCut.join(','), `${what}: the cut line is under the upper slip of each pair`);
      eq(built.chrome, 0, `${what}: no kit header or footer (the slip has its own title line)`);
      eq(built.boxes, s.state.urgencyBox ? s.slips : 0, `${what}: the call-me box follows its switch`);
      eq(built.lines, s.slips * s.state.prompts.length * 2, `${what}: two write-in lines per prompt`);
      ok(built.meta.includes('Class/Period: ' + (s.state.classPeriod || '__________________')), `${what}: the class period is filled in, or a rule to write on`);

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
          slipHeights: sheets.map(x => x.firstElementChild.getBoundingClientRect().height),
          clipped: clipped.length,
          text: ink(area.querySelector('.meta-line')).color,
          rule: ink(area.querySelector('.slip-line')).borderBottomColor,
          cutStyle: sheets[0].classList.contains('pk-cut') ? ink(sheets[0]).borderBottomStyle : '',
          lastCut: px(ink(sheets[sheets.length - 1]).borderBottomWidth),
          areaBg: ink(area).backgroundColor,
        };
      });
      eq(m.outside, 0, `${what}: nothing but the sheet has a box on paper${m.first ? ' (first: ' + m.first + ')' : ''}`);
      eq(m.clipped, 0, `${what}: nothing on the sheet is clipped`);
      eq(m.text, 'rgb(0, 0, 0)', `${what}: the meta line prints black`);
      eq(m.rule, 'rgb(0, 0, 0)', `${what}: the write-in rules print black`);
      eq(m.areaBg, 'rgb(255, 255, 255)', `${what}: the paper is white`);
      if (s.sheet === 'pk-half') {
        // (11in - 2 x 0.5in - 0.04in) / 2 at 96 px to the inch.
        const half = (11 - 1 - 0.04) / 2 * 96;
        ok(m.heights.every(h => h >= half - 1), `${what}: every half sheet is at least half the printable page (${Math.round(Math.min(...m.heights))} px of ${Math.round(half)})`);
        if (s.grows) ok(m.heights.every(h => h > half + 20), `${what}: a slip too long for half a page grows instead of clipping`);
        else ok(m.heights.every(h => Math.abs(h - half) <= 1), `${what}: a slip that fits is exactly a half sheet`);
        eq(m.cutStyle, 'dashed', `${what}: the cut line is dashed`);
        if (s.slips % 2 === 0) eq(m.lastCut, 0, `${what}: no line along the foot of the page`);
      }
      ok(m.heights.every((h, i) => h >= m.slipHeights[i]), `${what}: every sheet is as tall as its slip`);

      await page.emulateMedia({ media: null }); // not 'screen': that would hold for page.pdf() too
      const pdf = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: false }));
      eq(pdf, s.pages, `${what}: Chromium prints the pages the old block did`);
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
  const page = await open(browser, { copyCount: 2, classPeriod: '<i>3rd</i> & "4th"', urgencyBox: true, prompts: [{ id: 'a', text: evil }, { id: 'b', text: '   ' }] });
  try {
    await page.click('#printBtn');
    await settle(page, 150);
    const r = await page.evaluate(() => {
      const area = document.getElementById('printArea');
      return {
        prompt: area.querySelector('.slip-prompt').textContent,
        prompts: area.querySelectorAll('.pk-sheet:first-child .slip-prompt').length,
        meta: area.querySelector('.meta-line').textContent,
        injected: area.querySelectorAll('img, i, .slip-prompt b').length,
        pwned: !!window.__pwned,
      };
    });
    eq(r.prompt, evil, 'a prompt reaches the slip character for character');
    eq(r.prompts, 1, 'a prompt left empty is not printed');
    ok(r.meta.includes('Class/Period: <i>3rd</i> & "4th"'), 'the class period reaches the slip character for character');
    eq(r.injected, 0, 'nothing typed became an element');
    eq(r.pwned, false, 'nothing typed ran');
  } catch (e) {
    ok(false, `text, not markup: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

// ---- an empty install, and printing twice --------------------------------------
{
  const page = await open(browser, null);
  try {
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > .pk-half').count(), 2, 'a first visit prints two half sheets');
    eq(await page.locator('#printArea .slip-prompt').count(), 8, 'with the four default prompts on each');
    await page.fill('#copyCount', '3');
    await page.click('#addPromptBtn');
    await page.click('#addPromptBtn');
    const inputs = page.locator('#promptsWrap input[type="text"]');
    await inputs.nth(4).fill('Fifth?');
    await inputs.nth(5).fill('Sixth?');
    await page.click('#printBtn');
    await settle(page, 100);
    eq(await page.locator('#printArea > *').count(), 3, 'printing again replaces the sheets, it does not add to them');
    eq(await page.locator('#printArea > .pk-page').count(), 3, 'and a sixth prompt moves every slip to a page of its own');
    eq(await page.locator('#printArea > .pk-cut').count(), 0, 'with no cut line');
    eq(await page.evaluate(() => window.__printCalls), 2, 'print() was called once per press');
    eq(page.__errs.length, 0, `no page/console errors: ${JSON.stringify(page.__errs.slice(0, 3))}`);
  } catch (e) {
    ok(false, `empty install: ${String(e.message || e).split('\n')[0]}`);
  } finally {
    await page.context().close();
  }
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
