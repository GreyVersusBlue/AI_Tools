// smoke-dark-theme.mjs — the Schedule Browser's native dark palette (Path 5 P4).
//
//   node Tools/schedule-browser/test/smoke-dark-theme.mjs
//
// 034 is a PUBLISHED SNAPSHOT of the browser embedded in 035, and its dark
// palette therefore has three homes rather than one, each with a different
// owner of `data-theme`:
//
//   034, the committed site copy   _shared/a11y.js owns the attribute, so the
//     page raises window.A11Y_NATIVE_THEME and keys its dark block on
//     [data-theme="dark"];
//   035, the visualizer            its own four-palette switcher owns it, and
//     two of the four are dark, so the embedded browser has to follow;
//   a file a teacher was emailed   has no theme owner beside it at all, so
//     prefers-color-scheme decides — and ONLY there, which is what the
//     body.br-published gate in BR_CSS is for.
//
// The publisher/published drift is the failure this tool has already had once
// (the R61-R63 rounds, and the tablist fix that had to land in three places),
// so the static half asserts that 034's theme CSS and 035's BR_CSS theme CSS
// are the same bytes, and that the three token lists inside it — dark by
// attribute, dark by OS preference, light again for print — name the same
// tokens. A palette that is right in one file and stale in the other is
// exactly what a session would ship without this.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle, a11yScan, SITE } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8433;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_BROWSER = BASE + '/Tools/034-schedule-browser.html';
const URL_VISUALIZER = BASE + '/Tools/035-schedule-visualizer.html';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// The palette's own values, as getComputedStyle reports them.
const DARK_PAGE = 'rgb(18, 23, 19)';    // --br-page-dark   #121713
const DARK_INK = 'rgb(231, 236, 231)';  // --br-ink-dark    #e7ece7
const LIGHT_INK = 'rgb(40, 56, 49)';    // --br-ink-light   #283831
const LIGHT_MUTED = 'rgb(98, 117, 106)';// --br-muted-light #62756a
const WHITE = 'rgb(255, 255, 255)';

console.log('Schedule Browser — native dark palette (Path 5 P4)');

/* ── 1. the two files carry the same theme, statically ─────────────────── */

const read = rel => fs.readFileSync(path.join(SITE, rel), 'utf8');
const PALETTE = '/* ── The palette, named twice (Path 5 P4) ─';
const DARK = '/* ── Dark ─';

// The two files have drifted by 87 lines of RULES that only 034 has (measured
// 2026-09-07) — the R61-R63 features: the PNG download, the copy button,
// personal notes, the comparison and substitute views, the door sign — so
// the whole stylesheet is not comparable and never will be. The two THEME
// regions are, and those are what this compares: the palette declaration and
// everything from the dark block to the end.
function themeChunksOf(css) {
  const at = css.indexOf(PALETTE);
  const dark = css.indexOf(DARK);
  if (at < 0 || dark < 0) return null;
  const close = css.indexOf('\n}', css.indexOf('--br-scsi:', at));
  if (close < 0) return null;
  return [css.slice(at, close + 2), css.slice(dark).replace(/\s+$/, '')];
}

/** 034's own <style>, minus the published-only overrides after it. */
function cssOf034() {
  const src = read('Tools/034-schedule-browser.html');
  const style = src.slice(src.indexOf('<style>\n') + 8, src.indexOf('\n</style>'));
  const end = style.indexOf('\n\n/* published overrides */');
  return end < 0 ? '' : style.slice(0, end);
}

/** 035's BR_CSS, the single source brPublish() copies verbatim. */
function cssOf035() {
  const src = read('Tools/035-schedule-visualizer.html');
  const a = src.indexOf('const BR_CSS = `') + 'const BR_CSS = `'.length;
  return src.slice(a, src.indexOf('\n`;\n', a));
}

const chunks034 = themeChunksOf(cssOf034());
const chunks035 = themeChunksOf(cssOf035());
const css035 = cssOf035();
ok(chunks034 && chunks034[0].length > 1500, 'the palette block is in 034');
ok(chunks035 && chunks035[0].length > 1500, 'the palette block is in BR_CSS');
eq(chunks034 && chunks034[0], chunks035 && chunks035[0],
   'the palette is the same bytes in both — it cannot be fixed in one and stale in the other');
eq(chunks034 && chunks034[1], chunks035 && chunks035[1],
   'and so is everything from the dark block to the end');

// A backtick anywhere in BR_CSS ends the template literal and the rest of the
// stylesheet becomes JavaScript. It cost this round one debugging pass; the
// symptom was a SyntaxError naming a CSS property.
ok(css035 && !css035.includes('`'), 'no backtick in the block — BR_CSS is a template literal');

/** The declarations inside the rule whose selector list ends with `sel`. */
function declsAfter(css, sel) {
  const at = css.indexOf(sel);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('\n}', open) > -1 ? css.indexOf('}', open) : -1;
  if (open < 0 || close < 0) return null;
  const body = css.slice(open + 1, close);
  const out = new Map();
  for (const m of body.matchAll(/(--br-[a-z0-9-]+)\s*:\s*var\((--br-[a-z0-9-]+)\)/g)) out.set(m[1], m[2]);
  return out;
}

const byAttr = declsAfter(css035 || '', ':root[data-theme="dark"]:not(.a11y-filter-dark) {');
const byOs = declsAfter(css035 || '', 'html:not([data-theme]) body.br-published {');
const forPrint = declsAfter(css035 || '', 'html:not([data-theme]) body.br-published {\n    color-scheme:light;');

ok(byAttr && byAttr.size >= 20, `the attribute-driven dark block re-points the palette (${byAttr ? byAttr.size : 0} tokens)`);
eq(byOs && JSON.stringify([...byOs]), byAttr && JSON.stringify([...byAttr]),
   'the OS-preference block re-points exactly the same tokens to the same values');
eq(forPrint && [...forPrint.keys()].join(','), byAttr && [...byAttr.keys()].join(','),
   'and the print reset puts every one of them back');
ok(forPrint && [...forPrint.values()].every(v => v.endsWith('-light')),
   'print restores the light value of each, not some of them');
ok(byAttr && [...byAttr.values()].every(v => v.endsWith('-dark')),
   'dark takes the dark value of each');

// Every -dark name the blocks reach for has to be declared, or the token
// silently computes to nothing and the element inherits whatever is above it.
const declared = new Set([...(css035 || '').matchAll(/(--br-[a-z0-9-]+(?:-light|-dark))\s*:/g)].map(m => m[1]));
const missing = [...(byAttr || new Map()).values(), ...(forPrint || new Map()).values()].filter(v => !declared.has(v));
ok(missing.length === 0, 'every -light/-dark value the blocks name is declared: ' + JSON.stringify(missing));

/* ── 2. 034 in a browser ───────────────────────────────────────────────── */

const server = await serve(PORT);
const browser = await launch();

const rgb = s => (s.match(/\d+/g) || []).map(Number).slice(0, 3);
const lum = s => { const c = rgb(s).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

async function open(url, theme) {
  const page = await prepPage(browser, BASE, { width: 1400, height: 1100 });
  await page.addInitScript(t => {
    try { localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: t, textScale: 100, dyslexic: false })); } catch (e) {}
  }, theme);
  await page.goto(url, { waitUntil: 'networkidle' });
  await settle(page, 500);
  return page;
}

const paint = page => page.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  filter: document.documentElement.classList.contains('a11y-filter-dark'),
  published: document.body.classList.contains('br-published'),
  bg: getComputedStyle(document.body).backgroundColor,
  ink: getComputedStyle(document.body).color,
}));

// Chrome is what follows the theme. The floor plan and the mini-map cards are
// a light mat in both themes on purpose (the map is what gets printed), and
// the door sign is print-only, so both are excluded by name.
const CHROME = '#app-browser button, #app-browser input, #app-browser .panel, #app-browser .daycard, '
  + '#app-browser .tcard, #app-browser .gchip, #app-browser .mini-side, #app-browser .subcov-row, #app-browser .br-menu';
const NOT_CHROME = '.mapscroll, .mini-card, #br-door-sign';
const whiteChrome = page => page.evaluate(({ CHROME, NOT_CHROME }) => {
  const out = [];
  for (const el of document.querySelectorAll(CHROME)) {
    if (el.closest(NOT_CHROME)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (cs.backgroundColor === 'rgb(255, 255, 255)') {
      out.push((el.id ? '#' + el.id : el.tagName.toLowerCase()) + '.' + String(el.className || '').trim().split(/\s+/).join('.'));
    }
  }
  return out.slice(0, 8);
}, { CHROME, NOT_CHROME });

/** Every element inked with a department hue, with the colour it resolved to. */
const deptInks = page => page.evaluate(() => [...document.querySelectorAll('#app-browser .dcink')].map(el => ({
  cls: el.className,
  dc: (el.style.getPropertyValue('--dc') || '').trim(),
  dcInk: (el.style.getPropertyValue('--dc-ink') || '').trim(),
  color: getComputedStyle(el).color,
  bg: (function surface(n) {
    for (let e = n; e && e !== document.documentElement; e = e.parentElement) {
      const b = getComputedStyle(e).backgroundColor;
      if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b;
    }
    return 'rgb(255, 255, 255)';
  })(el),
})));

const hexToRgb = h => { const n = parseInt(h.replace('#', ''), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };

/* dark */
{
  const page = await open(URL_BROWSER, 'dark');
  const p = await paint(page);
  eq(p.theme, 'dark', '034 dark: a11y.js set data-theme');
  ok(!p.filter, '034 dark: no invert filter — the page opted into a native palette');
  ok(p.published, '034 dark: the body still carries br-published');
  eq(p.bg, DARK_PAGE, '034 dark: the page is painted with the dark page colour');
  eq(p.ink, DARK_INK, '034 dark: and the dark ink');

  await page.evaluate(() => window.brJumpTeacher('Moore'));
  await settle(page, 500);

  const white = await whiteChrome(page);
  ok(white.length === 0, '034 dark: no visible chrome is still white: ' + JSON.stringify(white));

  const inks = await deptInks(page);
  ok(inks.length > 0, `034 dark: the teacher view inks something with a department hue (${inks.length} elements)`);
  ok(inks.every(i => i.dc && i.dcInk), '034 dark: every one carries both --dc and --dc-ink');
  const wrong = inks.filter(i => i.color !== hexToRgb(i.dcInk));
  ok(wrong.length === 0, '034 dark: each takes its ink sibling, not the raw hue: ' + JSON.stringify(wrong.slice(0, 3)));
  const thin = inks.filter(i => contrast(i.color, i.bg) < 4.5);
  ok(thin.length === 0, '034 dark: and every one clears 4.5:1 on its own surface: '
     + JSON.stringify(thin.slice(0, 3).map(i => i.cls + ' ' + contrast(i.color, i.bg).toFixed(2))));
  // The measurement this row exists for: the raw hues do NOT clear it.
  const rawThin = inks.filter(i => contrast(hexToRgb(i.dc), i.bg) < 4.5);
  ok(rawThin.length > 0, '034 dark: the raw hues would have failed — which is why the sibling exists');

  // Two of the five inked things — the subject column of a group's table and
  // the department rows of the staffing overview — are in a state no page
  // load reaches, which is rank 14's blind spot. Scan the state, not the page.
  await page.evaluate(() => {
    window.brJumpGroup('7-10');
    document.querySelectorAll('#app-browser details.overview').forEach(d => { d.open = true; });
  });
  await settle(page, 600);
  const grouped = await deptInks(page);
  ok(grouped.some(i => /subj/.test(i.cls)) && grouped.some(i => /lbl/.test(i.cls)),
     '034 dark: the group table and the staffing overview ink themselves too');
  const groupThin = grouped.filter(i => contrast(i.color, i.bg) < 4.5);
  ok(groupThin.length === 0, '034 dark: and both clear 4.5:1 there as well: '
     + JSON.stringify(groupThin.slice(0, 3).map(i => i.cls + ' ' + contrast(i.color, i.bg).toFixed(2))));
  const groupViolations = await a11yScan(page);
  ok(groupViolations.length === 0, '034 dark: axe finds nothing serious on the group view either: '
     + JSON.stringify(groupViolations.map(v => v.id + '×' + v.count)));

  // The three modes 035 has never had — common planning, who's free now, and
  // the substitute plan — are 034's own, so nothing in the publisher exercises
  // them and only this suite can. Each carries its own tinted surfaces
  // (--br-common-bg, --br-plan-ink, --br-alert-ink) that appear nowhere else.
  for (const [mode, drive] of [
    ['compare', () => { window.brSetMode('compare'); window.brCompareAdd('Moore'); window.brCompareAdd('Love'); }],
    ['free', () => { window.brSetMode('free'); window.brSetFreePeriod(0); }],
    ['sub', () => { window.brSetMode('sub'); window.brChoose('Moore'); }],
  ]) {
    await page.evaluate(drive);
    await settle(page, 500);
    const rendered = await page.evaluate(() => document.getElementById('br-view').textContent.trim().length);
    ok(rendered > 40, `034 dark: the ${mode} view actually rendered (${rendered} chars) — a blank view scans clean`);
    const modeWhite = await whiteChrome(page);
    ok(modeWhite.length === 0, `034 dark: nothing white on the ${mode} view: ` + JSON.stringify(modeWhite));
    const modeThin = (await deptInks(page)).filter(i => contrast(i.color, i.bg) < 4.5);
    ok(modeThin.length === 0, `034 dark: every department ink on the ${mode} view clears 4.5:1: `
       + JSON.stringify(modeThin.slice(0, 3).map(i => i.cls + ' ' + contrast(i.color, i.bg).toFixed(2))));
    const modeViolations = await a11yScan(page);
    ok(modeViolations.length === 0, `034 dark: axe finds nothing serious on the ${mode} view: `
       + JSON.stringify(modeViolations.map(v => v.id + '×' + v.count)));
  }

  // The floor plan stays a light mat, header and all.
  await page.evaluate(() => window.brSetMode('map'));
  await settle(page, 600);
  const mat = await page.evaluate(() => {
    const el = document.querySelector('#app-browser .mapscroll');
    if (!el) return null;
    return { ink: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundImage.slice(0, 24) };
  });
  ok(mat, '034 dark: the building map renders');
  eq(mat && mat.ink, LIGHT_INK, '034 dark: the floor-plan mat keeps light ink on its light ground');

  const violations = await a11yScan(page);
  ok(violations.length === 0, '034 dark: axe finds nothing serious in dark: '
     + JSON.stringify(violations.map(v => v.id + '×' + v.count)));

  // Printing is on paper whatever the screen is doing.
  await page.emulateMedia({ media: 'print' });
  await settle(page, 200);
  const printed = await page.evaluate(() => getComputedStyle(document.body).color);
  eq(printed, LIGHT_INK, '034 dark: printing restores the light ink');
  await page.emulateMedia({ media: 'screen' });
  await page.close();
}

/* light, unchanged */
{
  const page = await open(URL_BROWSER, 'light');
  const p = await paint(page);
  eq(p.theme, 'light', '034 light: data-theme');
  ok(!p.filter, '034 light: no filter in light either');
  eq(p.ink, LIGHT_INK, '034 light: the light ink is untouched');
  await page.evaluate(() => window.brJumpTeacher('Moore'));
  await settle(page, 500);
  const inks = await deptInks(page);
  const wrong = inks.filter(i => i.color !== hexToRgb(i.dc));
  ok(inks.length > 0 && wrong.length === 0,
     '034 light: a department hue is still the published hue exactly: ' + JSON.stringify(wrong.slice(0, 3)));
  const mini = await page.evaluate(() => {
    const el = document.querySelector('#app-browser .mini-card .mhd');
    return el ? getComputedStyle(el).color : null;
  });
  ok(mini === null || mini === LIGHT_MUTED, '034 light: the mini-map header is the light muted');
  await page.close();
}

/* ── 3. the copy embedded in 035 follows the visualizer's own palette ───── */
{
  const page = await open(URL_VISUALIZER, 'light');
  const before = await page.evaluate(() => {
    window.toggleApp();
    return getComputedStyle(document.getElementById('app-browser')).backgroundColor;
  });
  await settle(page, 300);
  ok(before === WHITE || before === 'rgba(0, 0, 0, 0)' || before !== DARK_PAGE,
     '035: the embedded browser starts light with the default palette');
  const after = await page.evaluate(() => {
    window.applyTheme('dark');
    const cs = getComputedStyle(document.getElementById('app-browser'));
    return { bg: cs.backgroundColor, ink: cs.color, attr: document.documentElement.getAttribute('data-theme') };
  });
  eq(after.attr, 'dark', '035: the visualizer owns data-theme here, not a11y.js');
  eq(after.ink, DARK_INK, '035: and the embedded browser follows it into dark');
  const gg = await page.evaluate(() => {
    window.applyTheme('green-gold-dark');
    return getComputedStyle(document.getElementById('app-browser')).color;
  });
  eq(gg, DARK_INK, '035: the second dark palette takes it there too');
  const back = await page.evaluate(() => {
    window.applyTheme('default');
    return getComputedStyle(document.getElementById('app-browser')).color;
  });
  eq(back, LIGHT_INK, '035: and the light palette brings it back');
  await page.close();
}

/* ── 4. the file a teacher is emailed, which has no theme owner at all ──── */
{
  const src = await open(URL_VISUALIZER, 'light');
  const html = await src.evaluate(() => window.brBuildPublishedHTML());
  await src.close();

  ok(/<body class="br-published">/.test(html), 'the published file marks its body br-published');
  ok(html.includes('prefers-color-scheme'), 'and carries the OS-preference block');
  ok(/function brDeptInk/.test(html), 'and the brDeptInk helper every inked element needs');
  ok(!/html,body\{margin:0;padding:0;background:#f4f7f4\}/.test(html),
     'the old hardcoded page background is gone from the overrides');

  for (const [scheme, wantInk, label] of [['dark', DARK_INK, 'dark'], ['light', LIGHT_INK, 'light']]) {
    const page = await prepPage(browser, BASE, { width: 1200, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.setContent(html, { waitUntil: 'load' });
    await settle(page, 400);
    const p = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute('data-theme'),
      ink: getComputedStyle(document.body).color,
    }));
    eq(p.attr, null, `published, OS ${label}: nothing owns data-theme in this file`);
    eq(p.ink, wantInk, `published, OS ${label}: so the OS preference is what decides`);
    await page.close();
  }
}

await browser.close();
await server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
