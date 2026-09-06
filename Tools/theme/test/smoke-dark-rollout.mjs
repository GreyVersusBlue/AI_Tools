// smoke-dark-rollout.mjs — the Path 5 P3 rollout, one increment at a time.
//
//   node Tools/theme/test/smoke-dark-rollout.mjs      (or: npm run test:theme)
//
// smoke-theme.mjs proves the MECHANISM on two pages: 001 (native) and 003
// (still on the filter). This suite proves each ADOPTED page, which is a
// different claim with its own ways to go wrong — a page can carry the flag
// and still paint white chrome, because ink-paper.css only remaps the tokens
// and every one of these pages used to hardcode `#fff` on its inputs and
// buttons. So for every page in PAGES it drives the real browser in dark and
// checks:
//
//   - a11y.js set data-theme="dark" and did NOT add the invert filter;
//   - <body> is painted with ink-paper's dark paper and ink, not the light
//     values under a filter;
//   - no visible piece of chrome (a button, a form control, a card, a panel)
//     is still white — the literal the conversion exists to remove;
//   - a sheet of paper stays a sheet of paper: the on-screen preview that
//     will be printed (015's timeline, 023's handout) is white with dark ink
//     in dark mode too, via `paper-sheet`;
//   - axe finds nothing serious IN DARK. The site-wide sweep only runs in
//     light, so the dark palette's contrast is checked nowhere else;
//   - and in light, nothing changed: no filter, light paper, same ink.
//
// Then it drives the three stages that adopted _shared/stage.js in this
// increment (010's whole board, 015's story mode, 072's presentation overlay),
// the same way smoke-stage-rollout.mjs drives the P2 ones: real fullscreen by
// button, the exit path, F, and the refused-fullscreen fallback with Escape —
// none of the three had a fallback before.
//
// Headless Chromium grants requestFullscreen from a click; a Playwright
// Escape does not exit REAL fullscreen (that key is the browser's own), so
// real exits are driven by the page's own controls and only the fallback by
// Escape.
//
// DARK_SHOTS=<dir> also writes a light and a dark screenshot of every page
// there, for a human to look at; the suite does not read them.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8414;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.DARK_SHOTS || '';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// ink-paper.css's values, as getComputedStyle reports them.
const DARK_PAPER = 'rgb(20, 23, 28)';     // #14171c
const DARK_INK = 'rgb(233, 231, 224)';    // #e9e7e0
const LIGHT_PAPER = 'rgb(250, 250, 248)'; // #fafaf8
const LIGHT_INK = 'rgb(31, 36, 48)';      // #1f2430
const WHITE = 'rgb(255, 255, 255)';

/** The pages this increment converted, and what each one's sheet of paper is. */
const PAGES = [
  { label: '010', url: '/Tools/010-command-center-dashboard.html' },
  { label: '015', url: '/Tools/015-timeline-builder.html', sheet: '#screenView .timeline-scroll' },
  { label: '021', url: '/Tools/021-pe-tournament-stations.html' },
  { label: '023', url: '/Tools/023-exit-ticket-generator.html', sheet: '.slip-page',
    prep: async page => { await page.click('.tab-btn[data-tab="handout"]'); await settle(page, 200); } },
  { label: '024', url: '/Tools/024-number-talks-board.html' },
  { label: '072', url: '/Tools/072-plot-diagram-builder.html' },
  // increment 2
  { label: '025', url: '/Tools/025-writing-prompt-generator.html' },
  { label: '048', url: '/Tools/048-art-portfolio-label-maker.html', sheet: '#previewGrid .label-preview',
    prep: async page => {
      await page.click('#addRowBtn');
      await settle(page, 200);
      await page.fill('#entriesList input[data-title]', 'Self-portrait');
      await settle(page, 600);
    } },
  { label: '051', url: '/Tools/051-classroom-label-maker.html' },
  { label: 'cc-remote', url: '/Tools/command-center/remote.html' },
  { label: 'er-lock', url: '/Tools/escape-room-builder/lock.html' },
  { label: 'er-monitor', url: '/Tools/escape-room-builder/monitor.html' },
  // increment 3
  { label: '006', url: '/Tools/006-class-roster-hub.html' },
  { label: '009', url: '/Tools/009-backup-restore.html' },
  { label: '019', url: '/Tools/019-escape-room-builder.html' },
  { label: '020', url: '/Tools/020-bracket-tournament-generator.html' },
  // 039's sheet is the worksheet itself, and it only renders once there is a
  // verb to conjugate — the conjugation tab starts empty.
  { label: '039', url: '/Tools/039-vocab-conjugation-drill.html', sheet: '#previewArea .page',
    prep: async page => {
      await page.click('.mode-tab[data-mode="conjugation"]');
      await settle(page, 200);
      await page.click('#addConjBtn');
      await settle(page, 400);
    } },
  { label: '056', url: '/Tools/056-dbq-source-packet-builder.html' },
  // increment 4
  { label: '017', url: '/Tools/017-gallery-walk-qr.html',
    // The card previews, the duplicate-name warning and the scan-verify tints
    // only exist once there is an entry, so add one before the axe scan.
    prep: async page => {
      await page.click('#addRowBtn');
      await settle(page, 200);
      await page.fill('#entriesBody input[type="text"]', 'Station 1');
      await settle(page, 600);
    } },
  { label: '028', url: '/Tools/028-primary-source-analysis-generator.html', sheet: '.sheet' },
  // 040's printable page is built by script and there is nothing to print
  // until the teacher has typed a word, so its sheet needs a prep.
  { label: '040', url: '/Tools/040-vocab-flashcard-generator.html', sheet: '#previewArea .page',
    prep: async page => {
      await page.fill('#wordInput', 'Photosynthesis: how plants make food');
      await page.dispatchEvent('#wordInput', 'input');
      await settle(page, 600);
    } },
  { label: '050', url: '/Tools/050-civics-role-card-generator.html' },
  { label: '054', url: '/Tools/054-current-events-discussion-guide-generator.html' },
  { label: '078', url: '/Tools/078-unit-conversion-chart-builder.html' },
  // increment 5
  { label: '047', url: '/Tools/047-art-critique-worksheet-generator.html' },
  // 061's and 063's worksheets live inside #printArea, which is display:none
  // on screen, so neither has a sheet to check here; the drill table and the
  // word bank on screen are chrome and are covered by the white-chrome sweep.
  { label: '061', url: '/Tools/061-fraction-decimal-percent-drill-generator.html' },
  { label: '063', url: '/Tools/063-grammar-mad-libs-generator.html' },
  // 067's staff is drawn as SVG in currentColor; the sight-reading tab has to
  // be opened before the axe scan or only the rhythm display exists.
  { label: '067', url: '/Tools/067-music-sightreading-generator.html',
    prep: async page => { await page.click('#pitchTabBtn'); await settle(page, 400); } },
  // 075's department sub-headers only render once someone is in the directory.
  { label: '075', url: '/Tools/075-staff-directory-builder.html',
    prep: async page => {
      await page.fill('#newName', 'A. Teacher');
      await page.fill('#newSubject', 'Math');
      await page.click('#addRowBtn');
      await page.check('#groupByDeptBox');
      await settle(page, 400);
    } },
  // 081's worksheet preview is on screen behind the second tab, and it is a
  // sheet of paper: white with dark ink in dark mode too.
  { label: '081', url: '/Tools/081-word-problem-warmup-generator.html', sheet: '.sheet-page',
    prep: async page => { await page.click('.tab-btn[data-stage="sheet"]'); await settle(page, 400); } },
  // increment 6. All six build their printable into #printArea, which
  // print-area.css (or the page's own copy of that rule) keeps display:none on
  // screen, so none of them has a sheet to check here — every literal these
  // conversions left alone is print-only. Each prep puts real content on the
  // page first: an empty tool renders no rows, and a row is where the tints
  // and the tokenised chrome actually are.
  { label: '055', url: '/Tools/055-daily-editing-warmup-generator.html',
    // The sentence bank is where --ok (the corrected sentence) and --err (the
    // broken one) are drawn on a card; the projector tab shows neither until
    // someone presses Reveal.
    prep: async page => { await page.click('.tab-btn[data-stage="bank"]'); await settle(page, 400); } },
  { label: '058', url: '/Tools/058-duty-roster-builder.html',
    // The weekly grid's header row is the only --card-2 surface on the page,
    // and there is no grid until there is a duty and someone on staff.
    prep: async page => {
      await page.fill('#staffInput', 'Alex Rivera\nBailey Chen\nCarter Diaz');
      await page.click('#saveStaffBtn');
      await settle(page, 200);
      await page.click('#addDutyBtn');
      await settle(page, 200);
      await page.click('#autoFillBtn');
      await settle(page, 400);
    } },
  { label: '059', url: '/Tools/059-experiment-design-planner.html',
    prep: async page => {
      await page.click('#addControlledBtn');
      await page.click('#addMaterialBtn');
      await page.click('#addStepBtn');
      await settle(page, 400);
    } },
  { label: '070', url: '/Tools/070-peer-feedback-checklist-generator.html',
    prep: async page => {
      await page.click('#addCategoryBtn');
      await settle(page, 400);
    } },
  // 074's ten safety symbols are SVG drawn in currentColor, coloured by a
  // token per symbol; the picker shows all ten and the queue shows the chosen
  // one, so add a label to get both on screen before the axe scan.
  { label: '074', url: '/Tools/074-science-safety-label-maker.html',
    prep: async page => {
      await page.click('.symbol-btn');
      await page.fill('#labelText', 'Ethanol — flammable');
      await page.click('#addLabelBtn');
      await settle(page, 400);
    } },
  { label: '076', url: '/Tools/076-sub-note-feedback-slip-generator.html',
    prep: async page => {
      await page.click('#addPromptBtn');
      await settle(page, 400);
    } },
];

// Chrome is what follows the theme. Anything that is a projector surface
// (dark in both themes on purpose), a sheet of paper, a print-only container
// or a user-coloured badge is excluded, and the exclusions are named so a
// future page cannot hide a white button by accident.
const CHROME = 'button, input, select, textarea, .card, .now-strip, .panel-config, .stage, .discussion-stage, .strategy-card, .station-tile, .slot, .triage-row, .tally-btn, .cat-tally-incr, .mode-tab, .pill';
const NOT_CHROME = '.paper-sheet, #printArea, .print-only, #presentStage, .story-overlay, #stageArea.is-fullscreen, .remote-view, .day-badge, .hicontrast';

const whiteChrome = page => page.evaluate(({ CHROME, NOT_CHROME }) => {
  const out = [];
  for (const el of document.querySelectorAll(CHROME)) {
    if (el.closest(NOT_CHROME)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (cs.backgroundColor === 'rgb(255, 255, 255)') {
      out.push((el.id ? '#' + el.id : el.tagName.toLowerCase()) + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
    }
  }
  return out.slice(0, 8);
}, { CHROME, NOT_CHROME });

const bodyPaint = page => page.evaluate(() => {
  const root = document.documentElement;
  const cs = getComputedStyle(document.body);
  return {
    theme: root.getAttribute('data-theme'),
    filter: root.classList.contains('a11y-filter-dark'),
    bg: cs.backgroundColor,
    ink: cs.color,
  };
});

async function open(browser, url, theme, prep) {
  const page = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await page.addInitScript(t => {
    try { localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: t, textScale: 100, dyslexic: false })); } catch (e) {}
  }, theme);
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await settle(page, 300);
  if (prep) await prep(page);
  return page;
}

const server = await serve(PORT);
const browser = await launch();

console.log('Dark rollout — Path 5 P3: increment 1 (010, 015, 021, 023, 024, 072) + increment 2 (025, 048, 051, command-center/remote, escape-room-builder/lock + monitor) + increment 3 (006, 009, 019, 020, 039, 056) + increment 4 (017, 028, 040, 050, 054, 078) + increment 5 (047, 061, 063, 067, 075, 081) + increment 6 (055, 058, 059, 070, 074, 076)');

for (const p of PAGES) {
  /* ── dark ── */
  {
    const page = await open(browser, p.url, 'dark', p.prep);
    const paint = await bodyPaint(page);
    eq(paint.theme, 'dark', `${p.label} dark: a11y.js set data-theme`);
    ok(!paint.filter, `${p.label} dark: no invert filter — the page opted into native dark`);
    eq(paint.bg, DARK_PAPER, `${p.label} dark: body is painted with ink-paper's dark paper`);
    eq(paint.ink, DARK_INK, `${p.label} dark: body ink is the dark theme's`);
    const white = await whiteChrome(page);
    ok(white.length === 0, `${p.label} dark: no visible chrome is still white: ${JSON.stringify(white)}`);
    if (p.sheet) {
      const sheet = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, ink: cs.color, marked: el.classList.contains('paper-sheet') };
      }, p.sheet);
      ok(sheet && sheet.marked, `${p.label} dark: the preview sheet carries paper-sheet`);
      eq(sheet && sheet.bg, WHITE, `${p.label} dark: the sheet is still white paper`);
      eq(sheet && sheet.ink, LIGHT_INK, `${p.label} dark: with dark ink on it`);
    }
    const violations = await a11yScan(page);
    ok(violations.length === 0,
       `${p.label} dark: axe finds nothing serious in dark: ` + JSON.stringify(violations.map(v => v.id + '×' + v.count)));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${p.label}-dark.png`), fullPage: true }); }
    await page.close();
  }
  /* ── light, unchanged ── */
  {
    const page = await open(browser, p.url, 'light', p.prep);
    const paint = await bodyPaint(page);
    eq(paint.theme, 'light', `${p.label} light: data-theme`);
    ok(!paint.filter, `${p.label} light: no filter in light either`);
    eq(paint.bg, LIGHT_PAPER, `${p.label} light: light paper`);
    eq(paint.ink, LIGHT_INK, `${p.label} light: light ink`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${p.label}-light.png`), fullPage: true });
    await page.close();
  }
}

/* ── the three stages that adopted stage.js in this increment ───────────── */

const fsId = page => page.evaluate(() => document.fullscreenElement ? (document.fullscreenElement.id || document.fullscreenElement.tagName.toLowerCase()) : null);
const refuse = page => page.addInitScript(() => {
  Element.prototype.requestFullscreen = function () { return Promise.reject(new TypeError('Fullscreen request denied')); };
});

/* 010 — the whole board is the stage, so <body> is what goes fullscreen. */
{
  const page = await open(browser, '/Tools/010-command-center-dashboard.html', 'light');
  ok(await page.evaluate(() => !!window.Stage), '010: _shared/stage.js is loaded');
  ok(await page.evaluate(() => [...document.querySelectorAll('script:not([src])')].every(s => !/requestFullscreen/.test(s.textContent))),
     '010: no inline requestFullscreen left — the page no longer hand-rolls it');
  await page.click('#fullscreenBtn');
  await settle(page, 400);
  eq(await fsId(page), 'body', '010: the button fullscreens the board');
  ok(await page.evaluate(() => document.body.classList.contains('is-fullscreen') && document.body.classList.contains('stage-presenting')),
     '010: body carries is-fullscreen and stage-presenting');
  eq(await page.evaluate(() => document.getElementById('fullscreenBtn').textContent), 'Exit fullscreen', '010: the button relabelled');
  await page.keyboard.press('f');
  await settle(page, 400);
  eq(await fsId(page), null, '010: F leaves fullscreen');
  eq(await page.evaluate(() => document.getElementById('fullscreenBtn').textContent), 'Fullscreen', '010: and the label came back');
  // the timer's own key still works alongside the helper's
  await page.keyboard.press('f');
  await settle(page, 400);
  eq(await fsId(page), 'body', '010: F enters fullscreen too');
  await page.click('#fullscreenBtn');
  await settle(page, 400);
  eq(await fsId(page), null, '010: the button exits');
  await page.close();

  const p2 = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await refuse(p2);
  await p2.goto(BASE + '/Tools/010-command-center-dashboard.html', { waitUntil: 'networkidle' });
  await settle(p2, 300);
  await p2.click('#fullscreenBtn');
  await settle(p2, 400);
  ok(await p2.evaluate(() => document.body.classList.contains('stage-fallback') && document.body.classList.contains('is-fullscreen')),
     '010: when the browser refuses, the board gets the fallback — it had none before');
  await p2.keyboard.press('Escape');
  await settle(p2, 250);
  ok(await p2.evaluate(() => !document.body.classList.contains('is-fullscreen')), '010: Escape leaves the fallback');
  await p2.close();
}

/* 072 — the presentation overlay: display:none until Present, then on stage. */
{
  const state = page => page.evaluate(() => ({
    fs: document.fullscreenElement ? document.fullscreenElement.id : null,
    active: document.getElementById('presentStage').classList.contains('active'),
    cls: document.getElementById('presentStage').className,
    hidden: document.getElementById('presentStage').getAttribute('aria-hidden'),
    title: (document.querySelector('#presentContent .present-title') || {}).textContent || '',
    exitVisible: !document.getElementById('presentExitBtn').hidden,
    body: document.body.classList.contains('stage-presenting'),
  }));
  const page = await open(browser, '/Tools/072-plot-diagram-builder.html', 'dark');
  await page.fill('#storyTitle', 'Holes');
  await page.click('#presentBtn');
  await settle(page, 400);
  let s = await state(page);
  eq(s.fs, 'presentStage', '072: Present fullscreens the overlay');
  ok(s.active && /is-fullscreen/.test(s.cls) && s.hidden === 'false', `072: the overlay is active, on stage and exposed (${s.cls})`);
  eq(s.title, 'Holes', '072: the overlay was rendered from the current diagram before going on stage');
  ok(s.exitVisible && s.body, '072: the exit button is shown and body carries stage-presenting');
  const violations = await a11yScan(page, { include: '#presentStage' });
  ok(violations.length === 0, '072: axe finds nothing serious on the presentation: ' + JSON.stringify(violations.map(v => v.id + '×' + v.count)));
  await page.click('#presentExitBtn');
  await settle(page, 400);
  s = await state(page);
  ok(s.fs === null && !s.active && s.hidden === 'true' && !s.body, `072: the exit button leaves fullscreen AND drops the overlay (${s.cls})`);
  await page.keyboard.press('f');
  await settle(page, 400);
  s = await state(page);
  ok(s.fs === 'presentStage' && s.active, '072: F presents — this tool never had the key');
  await page.keyboard.press('f');
  await settle(page, 400);
  s = await state(page);
  ok(s.fs === null && !s.active, '072: F again leaves');
  await page.focus('#storyAuthor');
  await page.keyboard.press('f');
  await settle(page, 300);
  ok(!(await state(page)).active, '072: F typed into a field is a letter');
  await page.close();

  const p2 = await prepPage(browser, BASE, { width: 1280, height: 900 });
  await refuse(p2);
  await p2.goto(BASE + '/Tools/072-plot-diagram-builder.html', { waitUntil: 'networkidle' });
  await settle(p2, 300);
  await p2.click('#presentBtn');
  await settle(p2, 400);
  s = await state(p2);
  ok(s.fs === null && s.active && /stage-fallback/.test(s.cls), `072: refused fullscreen still shows the overlay, as the fallback (${s.cls})`);
  const box = await p2.evaluate(() => { const r = document.getElementById('presentStage').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  ok(box[0] === 0 && box[1] === 0 && box[2] >= 1270 && box[3] >= 890, `072: and it fills the viewport (${box.join(',')})`);
  await p2.keyboard.press('Escape');
  await settle(p2, 250);
  s = await state(p2);
  ok(!s.active && s.hidden === 'true', '072: Escape leaves the fallback and drops the overlay');
  await p2.close();
}

/* 015 — story mode: the overlay is `hidden` until Present. */
{
  const state = page => page.evaluate(() => ({
    fs: document.fullscreenElement ? document.fullscreenElement.id : null,
    hidden: document.getElementById('storyOverlay').hidden,
    cls: document.getElementById('storyOverlay').className,
    body: document.body.classList.contains('stage-presenting'),
  }));
  const load = async page => {
    page.once('dialog', d => d.accept());
    await page.click('#loadExampleBtn');
    await settle(page, 500);
  };
  const page = await open(browser, '/Tools/015-timeline-builder.html', 'dark');
  await load(page);
  await page.click('#presentBtn');
  await settle(page, 600);
  let s = await state(page);
  eq(s.fs, 'storyOverlay', '015: Present fullscreens the story overlay');
  ok(!s.hidden && /is-fullscreen/.test(s.cls) && s.body, `015: the overlay is shown and on stage (${s.cls})`);
  await page.keyboard.press('ArrowRight');
  await settle(page, 200);
  eq(await page.evaluate(() => document.getElementById('storyCounter').textContent.trim().split(/\s+/)[0]), '2',
     '015: the story\'s own arrow keys still step (the helper only owns F and its fallback Escape)');
  await page.click('#storyExitBtn');
  await settle(page, 500);
  s = await state(page);
  ok(s.fs === null && s.hidden && !s.body, `015: the exit button leaves fullscreen and hides the overlay (${s.cls})`);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('f');
  await settle(page, 600);
  s = await state(page);
  ok(s.fs === 'storyOverlay' && !s.hidden, '015: F starts story mode — this tool never had the key');
  await page.keyboard.press('f');
  await settle(page, 500);
  s = await state(page);
  ok(s.fs === null && s.hidden, '015: F again leaves it');
  await page.close();

  const p2 = await prepPage(browser, BASE, { width: 1400, height: 900 });
  await refuse(p2);
  await p2.goto(BASE + '/Tools/015-timeline-builder.html', { waitUntil: 'networkidle' });
  await settle(p2, 300);
  await load(p2);
  await p2.click('#presentBtn');
  await settle(p2, 600);
  s = await state(p2);
  ok(s.fs === null && !s.hidden && /stage-fallback/.test(s.cls), `015: refused fullscreen still runs the story, as the fallback (${s.cls})`);
  await p2.keyboard.press('Escape');
  await settle(p2, 400);
  s = await state(p2);
  ok(s.hidden && !/is-fullscreen/.test(s.cls), `015: Escape ends the story and the fallback together (${s.cls})`);
  await p2.close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
