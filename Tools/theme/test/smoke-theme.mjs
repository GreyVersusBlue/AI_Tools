// smoke-theme.mjs — the site's one theme mechanism (Path 5 P1).
//
//   node Tools/theme/test/smoke-theme.mjs        (or: npm run test:theme)
//
// _shared/a11y.js owns theme. It sets `data-theme` on <html>, and it gives a
// page dark ONE of two ways: natively, when the page sets
// `window.A11Y_NATIVE_THEME = true` and ships real dark colours, or by adding
// `.a11y-filter-dark` and letting a11y.css invert the whole page. The two must
// never both happen — a page with a real dark palette AND the invert filter
// comes out light again, with every hue rotated. Path 5's verification note
// asks for exactly that check, so the first half of this suite is a static
// sweep of every live page looking for the combination, plus the gates in
// _shared/ink-paper.css and _shared/theme.css that make it impossible.
//
// The second half drives two real pages: 001, the reference ink-paper adopter,
// and 003, an ink-paper tool that has NOT adopted — which is the half that
// matters, because the gate's whole job is that shipping the dark block
// changed nothing for the 73 tools still on the filter.
//
// Exits 1 on any failure.

import { serve, launch, prepPage, settle } from '../../board-check/harness.mjs';
import { SITE } from '../../board-check/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8405;

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

console.log('Theme — one owner, one mechanism (Path 5 P1)');

/* ── 1. static sweep, plain Node ───────────────────────────────────────── */

// Mirrors check-precache's idea of a live page: the tool pages and the root
// pages, minus the two archived design folders and the index backup. Tool
// support pages (Tools/<tool>/*.html) are live too — 001's hallway remote and
// the escape-room lock screen both link ink-paper.css.
const EXEMPT = ['Tools/New Designs/', 'Tools/Old Designs/', 'index_backup.html', 'node_modules/'];
function livePages(dir = SITE, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(SITE, full).split(path.sep).join('/');
    if (EXEMPT.some(e => rel.startsWith(e)) || name === '.git') continue;
    if (fs.statSync(full).isDirectory()) livePages(full, out);
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

const pages = livePages().sort();
ok(pages.length > 80, `the sweep sees the whole site (${pages.length} live pages)`);

// A CSS rule, not a mention in prose: `[data-theme="dark"]` followed by the
// rest of a selector and an opening brace on the same line. index.html's own
// header comment names the attribute without one, and must not count.
const DARK_RULE = /\[data-theme\s*=\s*["']dark["']\][^{}\n]*\{/g;
const GATED = /\[data-theme\s*=\s*["']dark["']\][^{}\n]*:not\(\.a11y-filter-dark\)/;

const report = [];
for (const rel of pages) {
  const src = fs.readFileSync(path.join(SITE, rel), 'utf8');
  const rules = src.match(DARK_RULE) || [];
  report.push({
    rel,
    flag: /A11Y_NATIVE_THEME\s*=\s*true/.test(src),
    ownRules: rules,
    ungated: rules.filter(r => !GATED.test(r)),
    inkPaper: /_shared\/ink-paper\.css/.test(src),
    themeCss: /_shared\/theme\.css/.test(src),
    a11y: /_shared\/a11y\.js/.test(src),
  });
}

// The combination Path 5 asks about: a page whose own CSS paints dark while
// a11y.js is also inverting it. Only a page that loads a11y.js can be in it —
// 035 has its own four-palette `data-theme` system and no a11y.js at all, so
// it is not double-darkened, it is simply a third theme owner (recorded under
// Path 5 in UPGRADE_PATHS.md, not fixed here).
const doubled = report.filter(p => p.a11y && p.ungated.length && !p.flag);
ok(doubled.length === 0,
   'no page ships an ungated dark palette without opting out of the invert filter: '
   + JSON.stringify(doubled.map(p => p.rel)));

// The other direction: opting out of the filter with nothing to replace it
// leaves the page stuck in light with a dead switch.
const empty = report.filter(p => p.flag && !p.ownRules.length && !p.inkPaper && !p.themeCss);
ok(empty.length === 0,
   'no page opts out of the filter without a native palette to fall back on: '
   + JSON.stringify(empty.map(p => p.rel)));

// A page that links a11y.js is the only kind that gets a theme at all; the
// flag on a page without it would do nothing.
const orphanFlag = report.filter(p => p.flag && !p.a11y);
ok(orphanFlag.length === 0,
   'nothing sets A11Y_NATIVE_THEME without loading a11y.js: '
   + JSON.stringify(orphanFlag.map(p => p.rel)));

const adopters = report.filter(p => p.flag);
ok(adopters.length >= 8, `pages on a native palette: ${adopters.length}`);

// Two writers of one attribute is the bug theme-toggle.js was deleted for.
// A page that both loads a11y.js and sets data-theme itself has re-created it.
const rival = report.filter(p => p.a11y &&
  /setAttribute\(\s*['"]data-theme['"]/.test(fs.readFileSync(path.join(SITE, p.rel), 'utf8')));
ok(rival.length === 0,
   'no page that loads a11y.js also writes data-theme itself: ' + JSON.stringify(rival.map(p => p.rel)));

// The retired second theme system stays retired. theme-toggle.js wrote its own
// `gvb-tools-theme` key and set data-theme itself; two writers of one attribute
// is the bug Path 5 P1 removed.
ok(!fs.existsSync(path.join(SITE, '_shared/theme-toggle.js')),
   '_shared/theme-toggle.js is gone');
const stillRefs = pages.filter(rel =>
  /<script[^>]+theme-toggle\.js/.test(fs.readFileSync(path.join(SITE, rel), 'utf8')));
ok(stillRefs.length === 0, 'no live page loads theme-toggle.js: ' + JSON.stringify(stillRefs));

// The gates themselves. Without these the shared files would paint dark under
// the filter on all 74 ink-paper tools at once.
for (const file of ['_shared/ink-paper.css', '_shared/theme.css']) {
  const src = fs.readFileSync(path.join(SITE, file), 'utf8');
  const rules = src.match(DARK_RULE) || [];
  ok(rules.length > 0, `${file} has a dark block`);
  const bare = rules.filter(r => !GATED.test(r) && !/@media/.test(r));
  // ink-paper.css's print reset is deliberately ungated: it applies to filter
  // pages too, where restoring already-light tokens is a no-op.
  const unexpected = bare.filter(r => !src.includes('@media print') || !isInPrintBlock(src, r));
  ok(unexpected.length === 0,
     `${file}'s screen dark rules are all gated on :not(.a11y-filter-dark): ${JSON.stringify(unexpected)}`);
}
function isInPrintBlock(src, rule) {
  const at = src.indexOf('@media print');
  return at > -1 && src.indexOf(rule) > at;
}

// The palette contract the tools consume. A rollout tool that reaches for
// var(--card-2) or var(--accent-ink) has to find them in both themes.
const inkPaper = fs.readFileSync(path.join(SITE, '_shared/ink-paper.css'), 'utf8');
for (const token of ['--ink', '--paper', '--card', '--card-2', '--line', '--line-strong',
                     '--accent', '--accent-2', '--accent-ink', '--muted', '--err']) {
  const light = new RegExp(`\\${token}-light\\s*:`).test(inkPaper) || new RegExp(`\\${token}\\s*:`).test(inkPaper);
  ok(light, `ink-paper.css defines ${token}`);
}

/* ── 2. the two pages, in a browser ────────────────────────────────────── */

const base = `http://127.0.0.1:${PORT}`;
const server = await serve(PORT);
const browser = await launch();

const rgb = s => (s.match(/\d+/g) || []).map(Number);
const luminance = s => { const [r, g, b] = rgb(s); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const themeState = page => page.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-theme'),
  filterClass: document.documentElement.classList.contains('a11y-filter-dark'),
  rootFilter: getComputedStyle(document.documentElement).filter,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  bodyFg: getComputedStyle(document.body).color,
  stored: localStorage.getItem('gvb-a11y-prefs'),
}));
const clickThemeSwitch = page => page.evaluate(() => {
  const row = [...document.querySelectorAll('.a11y-panel .a11y-row')]
    .find(r => (r.querySelector('.a11y-label') || {}).textContent === 'Dark theme');
  row.querySelector('button').click();
});

/* — 001, the adopter — */
{
  const page = await prepPage(browser, base, { width: 1280, height: 900 });

  // First visit, OS says dark, nothing stored: the toolkit comes up dark
  // without being asked, and without writing anything down.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${base}/Tools/001-hall-pass-log.html`, { waitUntil: 'networkidle' });
  await settle(page, 250);
  let s = await themeState(page);
  eq(s.attr, 'dark', '001: a first visit on a dark OS comes up dark');
  eq(s.filterClass, false, '001: natively, so no invert filter class');
  eq(s.rootFilter, 'none', '001: and no filter is actually computed');
  ok(luminance(s.bodyBg) < 0.2, `001: the page background is really dark (${s.bodyBg})`);
  ok(luminance(s.bodyFg) > 0.7, `001: on light ink (${s.bodyFg})`);
  eq(s.stored, null, '001: following the OS stores nothing, so it keeps following');

  // A sheet of paper is still a sheet of paper.
  const pass = await page.evaluate(() => {
    const el = document.querySelector('.pass-card');
    const cs = getComputedStyle(el);
    return { cls: el.className, bg: cs.backgroundColor, fg: cs.color };
  });
  ok(/paper-sheet/.test(pass.cls), '001: the hall pass is marked as a paper sheet');
  ok(luminance(pass.bg) > 0.9, `001: and stays white in dark mode (${pass.bg})`);
  ok(luminance(pass.fg) < 0.3, `001: with dark ink on it (${pass.fg})`);

  // Printing is on paper too, whatever the screen is doing.
  await page.emulateMedia({ media: 'print' });
  const printBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(luminance(printBg) > 0.9, `001: printing from dark mode prints on white (${printBg})`);
  await page.emulateMedia({ media: 'screen' });

  // Same page, light OS.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  s = await themeState(page);
  eq(s.attr, 'light', '001: a light OS gets light');
  ok(luminance(s.bodyBg) > 0.9, `001: on the unchanged paper background (${s.bodyBg})`);

  // An explicit choice is a choice: it persists and it beats the OS.
  await clickThemeSwitch(page);
  await settle(page, 120);
  s = await themeState(page);
  eq(s.attr, 'dark', '001: the widget switch turns dark on');
  ok(/"theme":"dark"/.test(s.stored || ''), '001: and writes the choice down');

  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  eq((await themeState(page)).attr, 'dark', '001: which survives a reload');

  await clickThemeSwitch(page);
  await settle(page, 120);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page, 250);
  s = await themeState(page);
  eq(s.attr, 'light', '001: an explicit light stays light on a dark OS');
  ok(/"theme":"light"/.test(s.stored || ''), '001: because the choice is stored, not inferred');

  eq(page.__errs.length, 0, '001: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  eq(page.__blocked.length, 0, '001: nothing left the site: ' + JSON.stringify(page.__blocked.slice(0, 3)));
  await page.context().close();
}

/* — 003, an ink-paper tool that has NOT adopted — */
{
  const page = await prepPage(browser, base, { width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${base}/Tools/003-rubric-builder.html`, { waitUntil: 'networkidle' });
  await settle(page, 250);
  const s = await themeState(page);
  eq(s.attr, 'dark', '003: still gets dark');
  eq(s.filterClass, true, '003: but through the invert filter, as before');
  ok(/invert/.test(s.rootFilter), `003: the filter is really applied (${s.rootFilter})`);
  // The point of the gate: shipping the dark block changed nothing here. The
  // declared background is still the light paper; the filter does the rest.
  ok(luminance(s.bodyBg) > 0.9,
     `003: its declared colours are untouched by ink-paper.css's dark block (${s.bodyBg})`);

  eq(page.__errs.length, 0, '003: no page/console errors: ' + JSON.stringify(page.__errs.slice(0, 3)));
  await page.context().close();
}

await browser.close();
server.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
