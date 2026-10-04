// audit-print.mjs — Path 7 P2: what each tool actually puts on paper, measured
// in a browser under `emulateMedia({ media: 'print' })`.
//
//   node Tools/board-check/audit-print.mjs              (or: npm run path7:next)
//   node Tools/board-check/audit-print.mjs --only 047   (one page, by number or name)
//   node Tools/board-check/audit-print.mjs --verbose    (every finding, not the first three per kind)
//   node Tools/board-check/audit-print.mjs --json       (the findings as JSON on stdout)
//   node Tools/board-check/audit-print.mjs --check      (exit 1 if a page has a finding that
//                                                        print-audit-baseline.json does not allow,
//                                                        or allows one that no longer fires)
//   node Tools/board-check/audit-print.mjs --baseline   (rewrite the baseline from this run)
//
// `check:print-clip` is the static half of this and stays the CI guard: it
// reads stylesheets and reports a fixed height paired with overflow:hidden
// inside `@media print`. It cannot see a height that comes from an inline
// style, a `vh` unit or another selector, a scroll box (`overflow: auto` with a
// `max-height`, which prints only the part that was on screen), or a button
// that no print rule ever hid. This opens the page and looks.
//
// Each page is loaded empty and, where Tools/a11y-sweep/seeds.mjs has saved
// state for it, loaded again seeded. Each load is then measured as it stands
// and once more after every visible button whose label says "print" has been
// clicked (with `window.print` stubbed), because most tools build the sheet in
// that click and an untouched page has nothing in #printArea to measure.
//
// Saved state does not reach every sheet. A print button that stays disabled
// until something is generated, a second tab, a student who has to be picked
// first: print-audit-prep.mjs lists, per page, the few clicks that get there,
// and each one is measured as a further state of the seeded load. A tab whose
// own label says "print" needs no entry: the audit opens it by itself and
// looks for print buttons again.
//
// Findings, by kind:
//   CLIP     an element that is visible in print, clips (`overflow` hidden or
//            clip on the block axis) and holds more than it shows. The paper
//            gets a clean edge and no error.
//   FIXED    the same box before it overflows: it clips, it holds text, and it
//            does not grow when 200px more is put in it. The seed's short
//            list fits; a real one may not. This is the fixed-height
//            half-sheet bug when the height sits in a screen rule, where
//            `check:print-clip` does not look.
//   SCROLL   the same as CLIP with `overflow: auto|scroll`: a scroll box prints only
//            what was scrolled into view. Also a <textarea> holding more lines
//            than its box, which prints the same way.
//   CHROME   a screen control that reaches the paper: a visible <button>,
//            <select>, range/file/colour input, or a `position: fixed|sticky`
//            box (Chromium repeats a fixed box on every printed page). A
//            select or button printed as bare text (`appearance: none`, no
//            border, no fill) is not one: 035 prints "A Day" and the chosen
//            group that way.
//   SPLIT    three or more same-class siblings, each a bordered or filled box
//            taller than two lines and shorter than a page, whose
//            `break-inside` is `auto` and that no ancestor keeps whole: a card
//            grid or a set of student blocks a page break may cut through.
//            Table cells and buttons are not counted.
//   TAIL     the document runs a sheet or more past the last thing visible in
//            print: blank pages follow the sheet. This is what `body * {
//            visibility: hidden }` does (print-area.css, and most hand-written
//            print blocks): the screen UI is invisible and still as tall as
//            it was. 015's one-page map printed as three until 2026-10-03.
//            Read off the layout at the sheet's width, not off a PDF, so the
//            count of pages is an estimate.
//   DARK     with the dark theme on, an element whose printed fill differs
//            from the light theme's (and is not white), or whose text is
//            paler and under 4.5:1 on white. Print is always on paper (`ink-paper.css`, `a11y.css`).
//
// Two lists follow the findings and are not findings. "Not measured" names the
// pages that have a print path and showed nothing at all in print in any state
// reached: the sheet is built from data no seed or prep supplies, so nothing
// was audited. "Blank sheets" names the print buttons that called print() and
// left the paper empty in every state they were clicked in, which is a bug in
// the page (061 printed a blank sheet until 2026-10-03). "Print buttons that
// never printed" names the ones that never called print() at all: a button
// that opens a dialog, or a sheet no seed reaches yet. "No print path" names the pages with no print() call and no print
// rule, where Ctrl+P prints the screen; only DARK is reported for those.
//
// It is a floor, like the static guard. It does not see a state behind a
// click that is not a print button, a class set longer than the seed's three
// or four names, anything drawn on <canvas>, or what a real printer does with
// margins. SPLIT is a property of the style, not an observed split: it says a
// break *may* land inside the block, and nothing here paginates. Nothing in
// this file has been checked against paper.
//
// It is not a suite and does not run in CI: the sweep is a few minutes of
// browser time and its findings are a work list, not a pass/fail. The baseline
// (`--check`) is there for a session that has fixed a page and wants to know
// it stayed fixed.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { serve, launch, prepPage, settle, SITE } from './harness.mjs';
import { ROSTERS, PAGE_SEEDS } from '../a11y-sweep/seeds.mjs';
import { PRINT_PREP } from './print-audit-prep.mjs';

const PORT = 8464;
const BASE = `http://127.0.0.1:${PORT}`;
const BASELINE_PATH = path.join(SITE, 'Tools', 'board-check', 'print-audit-baseline.json');
const argv = process.argv.slice(2);
const flag = f => argv.includes(f);
const only = flag('--only') ? argv[argv.indexOf('--only') + 1] : null;
const KINDS = ['CLIP', 'FIXED', 'SCROLL', 'CHROME', 'SPLIT', 'TAIL', 'DARK'];

// Letter, portrait, at CSS px: the layout viewport print would give the page
// with half-inch margins. Height matters only for `vh` units.
const SHEET = { width: 720, height: 960 };
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3);
const isPaper = c => c[3] < 8 || (c[0] > 250 && c[1] > 250 && c[2] > 250);
const css = c => c[3] < 8 ? 'transparent' : `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const onWhite = c => {
  const a = c[3] / 255;
  const lin = v => { v = (v * a + 255 * (1 - a)) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 1.05 / (0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) + 0.05);
};

const pages = execSync('git ls-files "Tools/*.html"', { cwd: SITE }).toString().trim().split('\n')
  .filter(p => /^Tools\/\d{3}-[^/]+\.html$/.test(p)).sort();
const selected = only ? pages.filter(p => p.includes(only)) : pages;
if (!selected.length) { console.error(`audit-print: --only ${only} matched no page`); process.exit(1); }

const registryCtx = { window: {} };
vm.createContext(registryCtx);
vm.runInContext(fs.readFileSync(path.join(SITE, '_shared', 'tool-registry.js'), 'utf8'), registryCtx);
const usesRoster = k => k === 'np_rosters' || (k && k.k === 'np_rosters');
const rosterPages = new Set(registryCtx.window.ToolRegistry.tools
  .filter(t => (t.keys || []).some(usesRoster) || (t.reads || []).some(usesRoster))
  .map(t => decodeURIComponent(t.file)));
const seedFor = p => {
  const num = p.slice(6, 9);
  const own = PAGE_SEEDS[num] ? PAGE_SEEDS[num]() : null;
  if (!own && !rosterPages.has(p)) return null;
  return { ...ROSTERS, ...(own || {}) };
};

/** Runs in the page, under print media. Returns the findings for this state
 *  and, for DARK, the colours of every visible element keyed by a path. */
const measure = () => {
  const out = [];
  const vis = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const name = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    return s;
  };
  const where = el => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) parts.unshift(name(e));
    return parts.join(' > ');
  };
  const add = (kind, el, why) => out.push({ kind, at: where(el), why });
  const colours = {};
  const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgbaCache = new Map();
  const rgba = c => {
    if (!rgbaCache.has(c)) {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      rgbaCache.set(c, [...cx.getImageData(0, 0, 1, 1).data]);
    }
    return rgbaCache.get(c);
  };
  const pathOf = el => {
    const parts = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      parts.unshift(e.tagName + ':' + [...e.parentElement.children].indexOf(e));
    }
    return parts.join('/');
  };
  const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('.a11y-widget, script, style, template'));
  const shown = all.filter(vis);
  let ink = 0, lastBottom = 0;
  for (const el of shown) {
    const cs = getComputedStyle(el);
    const tag = el.tagName;
    lastBottom = Math.max(lastBottom, el.getBoundingClientRect().bottom + window.scrollY);
    if (tag === 'CANVAS' || tag === 'IMG' || tag === 'SVG' || tag === 'svg') ink++;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { ink++; break; }
    if (el.closest('svg') && tag !== 'svg') continue;

    // CLIP / SCROLL
    const oy = cs.overflowY;
    const over = el.scrollHeight - el.clientHeight;
    if (tag === 'TEXTAREA') {
      if (over > 2 && el.value.trim()) add('SCROLL', el, `a textarea holding ${el.scrollHeight}px of text in a ${el.clientHeight}px box`);
    } else if (tag !== 'INPUT' && tag !== 'SELECT' && el.clientHeight > 2 && over > 2) {  // 1px boxes are .sr-only
      if (oy === 'hidden' || oy === 'clip') add('CLIP', el, `overflow-y: ${oy}; ${el.scrollHeight}px of content in ${el.clientHeight}px`);
      else if (oy === 'auto' || oy === 'scroll') add('SCROLL', el, `overflow-y: ${oy}; ${el.scrollHeight}px of content in ${el.clientHeight}px`);
    }

    // FIXED: a clipping box that holds text and does not grow. Today's content
    // fits; a longer name list would not. Found by putting 200px more in it.
    if ((oy === 'hidden' || oy === 'clip') && over <= 2 && el.clientHeight > 40 && !/^(TEXTAREA|INPUT|SELECT|BUTTON|CANVAS|IMG|TABLE|TR|TBODY)$/.test(tag) && el.innerText && el.innerText.trim().length > 1) {
      const before = el.getBoundingClientRect().height;
      const probe = document.createElement('div');
      probe.style.cssText = 'height:200px;width:1px;flex:none;visibility:hidden';
      el.appendChild(probe);
      const grew = el.getBoundingClientRect().height - before;
      probe.remove();
      if (grew < 100) add('FIXED', el, `overflow-y: ${oy} on a ${Math.round(before)}px box that does not grow: more text than fits is cut off`);
    }

    // CHROME
    const type = (el.getAttribute('type') || '').toLowerCase();
    // A select or a pressed button that a print rule has stripped to its words
    // (no native look, no border, no fill) is the value it holds, not a control.
    const asText = (tag === 'BUTTON' || tag === 'SELECT') && cs.appearance === 'none' &&
      parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.borderBottomWidth) === 0 && rgba(cs.backgroundColor)[3] < 8;
    if (asText) {
      // counted as text below, nothing to report
    } else if (tag === 'BUTTON' || tag === 'SELECT' || (tag === 'INPUT' && /^(range|file|color|button|submit)$/.test(type))) {
      add('CHROME', el, `a ${tag.toLowerCase()}${type ? `[type=${type}]` : ''} is visible in print` + (el.textContent.trim() ? `: "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}"` : ''));
    } else if (cs.position === 'fixed' || cs.position === 'sticky') {
      add('CHROME', el, `position: ${cs.position} in print`);
    }

    colours[pathOf(el)] = [rgba(cs.color), rgba(cs.backgroundColor), where(el)];
  }

  // SPLIT: same-class sibling groups of boxes a break may cut through.
  const lineOf = el => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
  const seenParent = new Set();
  for (const el of shown) {
    const parent = el.parentElement;
    if (!parent || seenParent.has(parent)) continue;
    seenParent.add(parent);
    const groups = new Map();
    for (const kid of parent.children) {
      if (!vis(kid) || !kid.classList.length || kid.closest('svg') || /^(TD|TH|BUTTON)$/.test(kid.tagName)) continue;
      const k = kid.tagName + '.' + kid.classList[0];
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(kid);
    }
    for (const kids of groups.values()) {
      if (kids.length < 3) continue;
      // A block that is itself kept whole keeps its children whole.
      let kept = false;
      for (let a = parent; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).breakInside !== 'auto') { kept = true; break; }
      if (kept) continue;
      const boxy = kids.filter(k => {
        const cs = getComputedStyle(k);
        const h = k.getBoundingClientRect().height;
        const bordered = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 ||
          (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
        return bordered && h > lineOf(k) * 2.2 && h < 960 && cs.breakInside === 'auto';
      });
      if (boxy.length >= 3) add('SPLIT', boxy[0], `${boxy.length} sibling ${name(boxy[0])} boxes with break-inside: auto`);
    }
  }
  // TAIL: a sheet's height or more of nothing after the last visible box.
  const docH = document.documentElement.scrollHeight;
  if (ink && docH - lastBottom >= window.innerHeight) {
    out.push({ kind: 'TAIL', at: 'body', why: `${Math.round(docH - lastBottom)}px of blank paper follows the sheet: what print hides still takes its height` });
  }
  return { findings: out, ink, colours, printCalls: window.__printCalls || 0 };
};

const setTheme = (page, theme) => page.addInitScript(t => {
  try { localStorage.setItem('gvb-a11y-prefs', JSON.stringify({ theme: t, textScale: 100, dyslexic: false })); } catch (e) { /* storage off */ }
}, theme);

async function open(browser, p, seed, theme, prep) {
  const page = await prepPage(browser, BASE, SHEET);
  // The real print() blocks until the dialog closes, and several tools tidy
  // up on the next line (067 and 069 drop `.active` from the sheet, 038 drops
  // `body.printing`). A stub that returned would let that run, and the audit
  // would measure the page after the paper. Throwing stops the handler where
  // the dialog would have held it.
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; throw new Error('audit-print: print() stub'); }; });
  await setTheme(page, theme);
  if (seed) {
    await page.addInitScript(entries => {
      if (sessionStorage.getItem('__printSeeded')) return;
      for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
      sessionStorage.setItem('__printSeeded', '1');
    }, seed);
  }
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(`${BASE}/${encodeURI(p)}`, { waitUntil: 'load', timeout: 30000 });
  await settle(page, 400);
  if (prep) { await prep.run(page); await settle(page, 300); }
  return page;
}

const printButtons = page => page.evaluate(() => [...document.querySelectorAll('button, [role="button"], a.btn')]
  .map((b, i) => ({ i, text: (b.textContent || b.getAttribute('aria-label') || b.title || '').replace(/\s+/g, ' ').trim(), shown: !!b.getClientRects().length && !b.disabled, tab: b.matches('[role="tab"], .tab-btn') }))
  .filter(b => b.shown && /\bprint/i.test(b.text) && !b.text.toLowerCase().includes('blueprint')).slice(0, 10));

const clickNth = (page, i) => page.evaluate(n => {
  const b = [...document.querySelectorAll('button, [role="button"], a.btn')][n];
  if (b) b.click();
}, i);

/** One state of one page: the light measurement, plus the dark diff. */
async function auditState(browser, p, seed, prep, clickIndex) {
  const result = { findings: [], ink: 0 };
  const sides = {};
  await Promise.all(['light', 'dark'].map(async theme => {
    const page = await open(browser, p, seed, theme, prep);
    try {
      if (clickIndex !== null) { await clickNth(page, clickIndex); await settle(page, 300); }
      await page.emulateMedia({ media: 'print' });
      await settle(page, 150);
      sides[theme] = await page.evaluate(measure);
    } finally {
      await page.context().close();
    }
  }));
  result.findings = sides.light.findings;
  result.ink = sides.light.ink;
  result.printCalls = sides.light.printCalls;
  const seen = new Set();
  for (const [k, [color, bg, at]] of Object.entries(sides.light.colours)) {
    const d = sides.dark.colours[k];
    if (!d) continue;
    // White or nothing behind a box is paper either way (`.paper-sheet` paints
    // white in dark on purpose), and dark's sheet ink is a near-black of its
    // own. A finding is a fill that changed, or text that got paler.
    const bgBad = !near(d[1], bg) && !isPaper(d[1]);
    const inkBad = onWhite(d[0]) < onWhite(color) - 0.5 && onWhite(d[0]) < 4.5;
    if (!bgBad && !inkBad) continue;
    const why = bgBad ? `background ${css(bg)} in light, ${css(d[1])} in dark` : `text ${css(color)} in light, ${css(d[0])} in dark (${onWhite(d[0]).toFixed(1)}:1 on white)`;
    const key = at + '|' + why;
    if (seen.has(key)) continue;
    seen.add(key);
    result.findings.push({ kind: 'DARK', at, why });
  }
  return result;
}

const report = {};
const unseen = [], noPath = [], blank = [], idle = [];
const server = await serve(PORT);
let browser = await launch();
let relaunches = 0;
const started = Date.now();
let states = 0;
try {
  for (let n = 0; n < selected.length; n++) {
    const p = selected[n];
    const html = fs.readFileSync(path.join(SITE, p), 'latin1');
    // A page with no print() call and no print rule of its own has no print
    // path: Ctrl+P prints the screen, and its buttons are not a finding.
    // A print block that only puts a dark page's light tokens back (004, 009,
    // 010) gives the page no sheet, so it is taken out before the test.
    const tokenReset = /@media print\s*\{\s*(?:[^{}]*\[data-theme[^{}]*\{[^{}]*\}\s*)+\}/g;
    const printPath = /window\.print\(|[^.\w]print\(\)|@media[^{]*\bprint\b|print-area\.css|print-kit\.css/.test(html.replace(tokenReset, ''));
    const byKey = new Map();
    const inkByButton = new Map();
    let inkAny = 0;
    const passes = [{ seed: null, prep: null, label: 'empty' }];
    const seed = seedFor(p);
    if (seed) passes.push({ seed, prep: null, label: 'seeded' });
    for (const prep of PRINT_PREP[p.slice(6, 9)] || []) passes.push({ seed, prep, label: `${seed ? 'seeded' : 'empty'}, ${prep.name}` });
    for (const { seed: s, prep, label: passLabel } of passes) {
      let buttons = [];
      try {
        const probe = await open(browser, p, s, 'light', prep);
        const found = await printButtons(probe);
        await probe.context().close();
        // A tab whose label says "print" ("Printable sheet", "Print as table
        // tents") is not a print button: it is where the print button lives.
        // Each one becomes a further state of this load, opened first.
        buttons = found.filter(b => !b.tab);
        if (!prep) for (const t of found.filter(b => b.tab)) {
          passes.push({ seed: s, prep: { name: `"${t.text.slice(0, 24)}" tab`, run: page => clickNth(page, t.i) }, label: `${passLabel}, "${t.text.slice(0, 24)}" tab` });
        }
      } catch (e) {
        byKey.set('ERR', { kind: 'ERR', at: p, why: String(e.message || e).split('\n')[0], states: [] });
        continue;
      }
      for (const click of [null, ...buttons]) {
        const label = passLabel + (click ? `, after "${click.text.slice(0, 24)}"` : '');
        states++;
        try {
          const r = await auditState(browser, p, s, prep, click ? click.i : null);
          inkAny += r.ink;
          if (click) {
            const b = inkByButton.get(click.text) || { ink: 0, calls: 0 };
            inkByButton.set(click.text, { ink: Math.max(b.ink, r.ink), calls: b.calls + r.printCalls });
          }
          for (const f of r.findings) {
            if (!printPath && f.kind !== 'DARK') continue;
            const k = `${f.kind}|${f.at}|${f.why.replace(/\d+px/g, 'Npx')}`;
            if (!byKey.has(k)) byKey.set(k, { ...f, states: [] });
            byKey.get(k).states.push(label);
          }
        } catch (e) {
          byKey.set('ERR|' + label, { kind: 'ERR', at: label, why: String(e.message || e).split('\n')[0], states: [label] });
        }
      }
    }
    // A browser that went away mid-page (it has, on a shared machine where
    // another session tidies up `chrome` processes) measured nothing reliable:
    // start another and do the page again, a few times at most.
    if (!browser.isConnected()) {
      if (++relaunches > 5) throw new Error(`the browser went away ${relaunches} times, last at ${p}; giving up`);
      browser = await launch();
      n--;
      continue;
    }
    const list = [...byKey.values()];
    report[p] = list;
    if (printPath && !inkAny) unseen.push(p);
    for (const [text, b] of inkByButton) {
      if (b.ink) continue;
      (b.calls ? blank : idle).push(`${p.slice(6, 9)} "${text.slice(0, 32)}"`);
    }
    if (!printPath) noPath.push(p);
    if (!flag('--json')) process.stderr.write('.');
  }
} finally {
  await browser.close().catch(() => {});
  server.close();
}
if (!flag('--json')) process.stderr.write('\n');

const counts = p => Object.fromEntries(KINDS.concat('ERR').map(k => [k, report[p].filter(f => f.kind === k).length]).filter(([, n]) => n));

if (flag('--json')) {
  console.log(JSON.stringify({ report, unseen, blank, idle, noPath }, null, 2));
} else {
  const limit = flag('--verbose') ? Infinity : 3;
  for (const p of selected) {
    if (!report[p].length) continue;
    console.log(`\n${p.replace(/^Tools\//, '')}`);
    for (const kind of KINDS.concat('ERR')) {
      const fs_ = report[p].filter(f => f.kind === kind);
      for (const f of fs_.slice(0, limit)) console.log(`  ${kind.padEnd(6)} ${f.at}\n         ${f.why}${f.states.length ? `  [${f.states[0]}${f.states.length > 1 ? ` +${f.states.length - 1}` : ''}]` : ''}`);
      if (fs_.length > limit) console.log(`  ${kind.padEnd(6)} … and ${fs_.length - limit} more (--verbose)`);
    }
  }
  const totals = Object.fromEntries(KINDS.map(k => [k, [0, 0]]));
  for (const p of selected) for (const k of KINDS) {
    const n = report[p].filter(f => f.kind === k).length;
    if (n) { totals[k][0]++; totals[k][1] += n; }
  }
  const clean = selected.filter(p => !report[p].length).length;
  console.log(`\naudit-print: ${selected.length} page${selected.length === 1 ? '' : 's'}, ${states} states, ${Math.round((Date.now() - started) / 1000)}s. ${clean} with nothing to report.`);
  console.log(KINDS.map(k => `  ${k.padEnd(6)} ${String(totals[k][0]).padStart(2)} pages, ${totals[k][1]} findings`).join('\n'));
  const nums = l => l.map(p => p.slice(6, 9)).join(' ') || 'none';
  console.log(`\nNot measured: ${unseen.length} page${unseen.length === 1 ? '' : 's'} with a print path showed nothing in print in any state reached (${nums(unseen)}).`);
  console.log('Their sheet is built from data no seed or prep supplies (a11y-sweep/seeds.mjs, print-audit-prep.mjs).');
  const listed = l => `${l.length}${l.length ? ' (' + l.join('; ') + ')' : ''}`;
  console.log(`Blank sheets: ${listed(blank)}. These buttons called print() and left the paper empty in every state: a bug in the page.`);
  console.log(`Print buttons that never printed: ${listed(idle)}. No print() call in any state: a button that opens something, or a sheet no seed reaches.`);
  console.log(`No print path: ${noPath.length} (${nums(noPath)}). Only DARK is reported for these.`);
}

if (flag('--baseline')) {
  const pagesOut = {};
  for (const p of selected) { const c = counts(p); if (Object.keys(c).length) pagesOut[p] = c; }
  const prior = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).pages : {};
  const merged = only ? { ...prior, ...pagesOut } : pagesOut;
  if (only) for (const p of selected) if (!pagesOut[p]) delete merged[p];
  fs.writeFileSync(BASELINE_PATH, JSON.stringify({
    note: 'Findings per page and kind from `node Tools/board-check/audit-print.mjs --baseline`. A work list for Path 7 P2, not a CI gate: lower a number in the commit that fixes the page.',
    pages: Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))),
  }, null, 2) + '\n');
  console.error(`audit-print: wrote ${Object.keys(merged).length} pages to ${path.relative(SITE, BASELINE_PATH)}`);
}

if (flag('--check')) {
  const allowed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).pages;
  const bad = [];
  for (const p of selected) {
    const now = counts(p), was = allowed[p] || {};
    for (const k of new Set([...Object.keys(now), ...Object.keys(was)])) {
      const a = now[k] || 0, b = was[k] || 0;
      if (a > b) bad.push(`${p}: ${k} ${b} → ${a}`);
      else if (a < b) bad.push(`${p}: ${k} ${b} → ${a}; lower the baseline`);
    }
  }
  if (bad.length) { console.error('\naudit-print --check:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.error('audit-print --check: OK — every page matches print-audit-baseline.json.');
}
