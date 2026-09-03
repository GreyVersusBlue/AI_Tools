// check-print-clip.mjs — read-only sweep: a fixed height plus overflow:hidden
// inside @media print.
//
//   node Tools/board-check/check-print-clip.mjs    (or: npm run check:print-clip)
//
// The bug class: a half-sheet or card is sized on screen with `height: 5.5in;
// overflow: hidden` so the layout is tidy, and the same rule inside the print
// block silently cuts off whatever the teacher typed past the box — the
// printer gets a clean edge and no error. It was fixed three separate ways in
// 047, 070 and 076 before anyone wrote it down. A print rule may size a box
// (min-height, page-break-inside) but must not clip it.
//
// For every live page this reads every `@media print` block — inline <style>
// blocks and the site's own linked stylesheets, print-area.css included — and
// reports any rule inside one whose declarations set BOTH `height`/`max-height`
// (not min-height, and not `auto`/`100%`/`0` values, which do not clip a
// content box) AND `overflow` / `overflow-y` of `hidden` or `clip`. A rule that
// sets only the height, or only the overflow, is not reported: the pair is
// what clips. Also reported: an `@media print` block that sets the clipping
// half inside it while the other half comes from the same selector's screen
// rule, because the effective print style is the union. Exit 1 on any finding.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE_EXEMPT = ['Tools/Old Designs/', 'Tools/New Designs/', 'index_backup.html'];

function livePages() {
  const out = ['index.html'];
  for (const f of fs.readdirSync(path.join(SITE, 'Tools'))) if (f.endsWith('.html')) out.push('Tools/' + f);
  for (const f of fs.readdirSync(SITE)) if (f.endsWith('.html') && f !== 'index.html') out.push(f);
  return out.filter(p => !PAGE_EXEMPT.some(x => p.startsWith(x) || p === x));
}

/** Rules as { selector, body, print, line } with @media blocks unwrapped and
 *  a flag for the ones inside @media print. */
function cssRules(css, baseLine = 1) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const rules = [];
  const lineAt = at => baseLine + stripped.slice(0, at).split('\n').length - 1;
  let i = 0;
  const walk = (end, inPrint) => {
    while (i < end) {
      const open = stripped.indexOf('{', i);
      if (open < 0 || open >= end) { i = end; return; }
      const selector = stripped.slice(i, open).trim().replace(/^[;}\s]+/, '');
      let depth = 1, j = open + 1;
      while (j < end && depth) { if (stripped[j] === '{') depth++; else if (stripped[j] === '}') depth--; j++; }
      if (selector.startsWith('@')) {
        if (/^@(media|supports|layer|container)/.test(selector)) {
          const print = inPrint || /^@media[^{]*\bprint\b/.test(selector);
          i = open + 1; walk(j - 1, print); i = j;
        } else { i = j; }
      } else {
        if (selector) rules.push({ selector, body: stripped.slice(open + 1, j - 1), print: inPrint, line: lineAt(open) });
        i = j;
      }
    }
  };
  walk(stripped.length, false);
  return rules;
}

const CLIP_HEIGHT = /(?:^|;|\s)(?:max-)?height\s*:\s*([^;!]+)/i;
const CLIP_OVERFLOW = /(?:^|;|\s)overflow(?:-y)?\s*:\s*(hidden|clip)\b/i;
const clipsHeight = body => {
  const m = CLIP_HEIGHT.exec(body);
  if (!m) return null;
  const v = m[1].trim();
  if (/^(auto|100%|0|0px|inherit|initial|unset|fit-content|max-content|min-content|none)$/i.test(v)) return null;
  return v;
};

const results = [];
for (const page of livePages()) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const sources = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    sources.push({ label: page, css: m[1], baseLine: html.slice(0, m.index + m[0].indexOf(m[1])).split('\n').length });
  }
  for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/gi)) {
    const href = (m[1] || m[2] || '').split('?')[0];
    if (!href || /^(https?:|data:)/.test(href)) continue;
    const relPath = path.posix.normalize(path.posix.join(path.posix.dirname(page), decodeURIComponent(href)));
    const file = path.join(SITE, relPath);
    if (fs.existsSync(file)) sources.push({ label: relPath, css: fs.readFileSync(file, 'utf8'), baseLine: 1, shared: true });
  }
  const all = sources.flatMap(s => cssRules(s.css, s.baseLine).map(r => ({ ...r, label: s.label, shared: !!s.shared })));
  const screenBySelector = new Map();
  for (const r of all) if (!r.print) {
    for (const sel of r.selector.split(',').map(s => s.trim())) {
      const prev = screenBySelector.get(sel) || '';
      screenBySelector.set(sel, prev + ';' + r.body);
    }
  }
  const seen = new Set();
  for (const r of all) {
    if (!r.print) continue;
    const h = clipsHeight(r.body);
    const o = CLIP_OVERFLOW.test(r.body);
    let why = null;
    if (h && o) why = `height: ${h} + overflow: hidden, both inside @media print`;
    else if (h || o) {
      // the other half from the same selector's screen rule
      for (const sel of r.selector.split(',').map(s => s.trim())) {
        const screen = screenBySelector.get(sel) || '';
        if (h && CLIP_OVERFLOW.test(screen)) { why = `height: ${h} inside @media print; overflow: hidden from ${sel}'s screen rule`; break; }
        const sh = clipsHeight(screen);
        if (o && sh) { why = `overflow: hidden inside @media print; height: ${sh} from ${sel}'s screen rule`; break; }
      }
    }
    if (!why) continue;
    const key = `${r.label}:${r.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A shared stylesheet is reported once, under its own name.
    results.push({ page: r.shared ? r.label : page, line: r.line, selector: r.selector.replace(/\s+/g, ' ').slice(0, 80), why, shared: r.shared });
  }
}

const dedup = [];
const seenShared = new Set();
for (const r of results) {
  if (r.shared) { const k = `${r.page}:${r.line}`; if (seenShared.has(k)) continue; seenShared.add(k); }
  dedup.push(r);
}

if (dedup.length) {
  console.error(`\ncheck-print-clip: ${dedup.length} print rule${dedup.length === 1 ? '' : 's'} that clip content:\n`);
  for (const r of dedup) console.error(`  ${r.page}:${r.line}  ${r.selector}\n            ${r.why}`);
  console.error('\nA fixed height with overflow:hidden inside @media print cuts off whatever the');
  console.error('teacher typed past the box, with no error and a clean edge. Size print boxes');
  console.error('with min-height (and page-break-inside: avoid), and let overflow be visible.');
  process.exit(1);
}
console.log('check-print-clip: OK — no @media print rule on a live page pairs a fixed height with overflow:hidden.');
