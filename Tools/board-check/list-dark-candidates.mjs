// list-dark-candidates.mjs — read-only picker for the next Path 5 batch.
//
//   node Tools/board-check/list-dark-candidates.mjs [N] [--all] [--json]
//                                                  [--tool <nnn|substring>]
//   npm run path5:next
//
// Path 5 P3 moves the projector-facing tools onto a native dark palette (and
// onto _shared/stage.js). This script decides what is left and what each one
// costs, so a rollout round does not have to re-derive it by hand — which is
// the specific thing this file exists to stop. A Wave A1 handoff quoted the
// output of a script by this name that had never been committed, and a second
// number from the same era ("17–45 hardcoded literals per tool") was about 3×
// too high because it swept in `white-space`, `@media print` blocks and inline
// script. Both are recorded in HISTORY.md. There is no write path here.
//
// Definitions, all read off the tree rather than off any prose list:
//
//   THEMED     the page loads _shared/a11y.js — from a real <script src>, not
//              from a mention of the path in prose or in a comment; see
//              `loadedFiles` below for why that distinction cost six
//              increments. Only those pages get a theme at all, so only those
//              can be candidates. (035 runs its own four-palette system and is
//              reported separately, not ranked.)
//   NATIVE     the page sets `window.A11Y_NATIVE_THEME = true` — it has opted
//              out of a11y.css's invert filter and paints its own dark. Done.
//   CANDIDATE  a themed page that is not native yet. It is still getting the
//              CSS-filter invert, which rotates every hue and looks worst on
//              exactly the canvases and photos the projector tools show.
//
// The cost of a candidate is the colour literals its own <style> hardcodes,
// because each is an edit `var(--token)` has to replace. Counted honestly:
//
//   - only inside <style> — inline <script> is excluded outright;
//   - only in a colour-bearing property (`color`, `background*`, `border*`,
//     `outline*`, `box-shadow`, `text-shadow`, `fill`, `stroke`, `--custom`,
//     and the rest of COLOUR_PROPS below). `white-space: nowrap` is not a
//     colour and never counts;
//   - never inside `@media print` (print is ink on paper and stays light) or
//     inside a rule that is already dark work — a `[data-theme="dark"]`
//     selector or a `prefers-color-scheme: dark` block;
//   - `var(...)`, `currentColor`, `transparent` and the CSS-wide keywords are
//     not literals. Everything else that is a hex, an rgb()/hsl()/color()
//     function or a named colour is.
//
// and split in two, because the two cost wildly different amounts:
//
//   tokens     literals in a custom-property declaration (`--card: #fff`).
//              A page with its own :root palette converts in one dark block.
//   scattered  literals anywhere else. These are the real work: each one is a
//              separate decision about which token it meant.
//
// Ranking is projector evidence first (that is what P3 is about), then
// cheapest first inside each group. `stage` reports the other half of P3:
// whether the page links _shared/stage.js, still hand-rolls fullscreen, or
// neither.
//
// Exit code is always 0; "nothing left" is a normal result, not a failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const showAll = args.includes('--all');
const only = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : null;
const batchSize = Number(args.find(a => /^\d+$/.test(a)) || 6);

/* ── which files are live pages ────────────────────────────────────────── */
// smoke-theme.mjs's sweep plus two exclusions it does not make. Tool support
// pages (Tools/<tool>/*.html) are live — 001's hallway remote is one — but a
// fixture under a test/ folder is not a page a teacher opens, and
// `Other Landing Page ideas/` is a second, unlinked and unprecached copy of the
// four alternative landing pages (the ones at the repo root ARE linked from
// index.html and ARE in PRECACHE_URLS; these four differ from them and are
// reachable from nothing). Both would otherwise inflate the denominator.
const EXEMPT = [
  'Tools/New Designs/', 'Tools/Old Designs/', 'Other Landing Page ideas/',
  'index_backup.html', 'node_modules/',
];
const isFixture = rel => /(^|\/)test\//.test(rel);
function livePages(dir = SITE, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.relative(SITE, full).split(path.sep).join('/');
    if (name === '.git' || EXEMPT.some(e => rel.startsWith(e)) || isFixture(rel)) continue;
    if (fs.statSync(full).isDirectory()) livePages(full, out);
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}

/* ── CSS ──────────────────────────────────────────────────────────────── */

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Split CSS into { selector, body, context } rules, recursing into at-rules so
// a rule inside @media keeps the at-rule text in its context. Lifted from
// list-base-css-candidates.mjs, which needs exactly the same shape.
function rules(css, context = '', out = []) {
  let i = 0;
  while (i < css.length) {
    const start = i;
    let j = i;
    while (j < css.length && css[j] !== '{' && css[j] !== '}') j++;
    if (j >= css.length) break;
    if (css[j] === '}') { i = j + 1; continue; }
    const selector = css.slice(start, j).trim();
    let depth = 1, k = j + 1;
    while (k < css.length && depth > 0) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') depth--;
      k++;
    }
    const body = css.slice(j + 1, k - 1);
    if (selector.startsWith('@')) {
      rules(body, (context ? context + ' > ' : '') + selector.replace(/\s+/g, ' '), out);
    } else {
      out.push({ selector, body, context });
    }
    i = k;
  }
  return out;
}

// Properties whose value is (or can contain) a colour. A property not in here
// is never counted, which is what keeps `white-space` out of the figure.
const COLOUR_PROPS = new Set([
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color', 'border-top', 'border-right', 'border-bottom',
  'border-left', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'border-block', 'border-inline',
  'border-block-color', 'border-inline-color',
  'outline', 'outline-color', 'box-shadow', 'text-shadow', 'text-decoration',
  'text-decoration-color', 'text-emphasis-color', 'caret-color',
  'accent-color', 'column-rule', 'column-rule-color', 'fill', 'stroke',
  'scrollbar-color', 'stop-color', 'flood-color', 'lighting-color',
  'filter',   // drop-shadow() takes one
]);

// Named colours. Deliberately not the whole X11 list: this is the set that
// actually turns up in this site's CSS plus the obvious neighbours, so a
// keyword like `linen` in some future gradient cannot quietly become a count.
// Add to it if a real page uses one — do not widen it speculatively.
const NAMED = new Set([
  'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'gray', 'grey', 'silver', 'maroon', 'navy', 'teal', 'olive', 'lime',
  'aqua', 'cyan', 'magenta', 'fuchsia', 'pink', 'brown', 'gold', 'beige',
  'ivory', 'khaki', 'salmon', 'tan', 'violet', 'indigo', 'crimson',
  'whitesmoke', 'lightgray', 'lightgrey', 'darkgray', 'darkgrey',
  'dimgray', 'dimgrey', 'gainsboro', 'lavender', 'azure', 'coral',
]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/g;

// Count the colour literals in one declaration value. `var(--x, #fff)` still
// counts its fallback — it is a literal in the file either way — but a plain
// `var(--x)` does not, and neither do the keywords.
function literalsIn(value) {
  let n = 0;
  n += (value.match(HEX) || []).length;
  n += (value.match(FUNC) || []).length;
  for (const word of value.toLowerCase().match(/[a-z]+/g) || []) {
    if (NAMED.has(word)) n++;
  }
  return n;
}

const DARK_SELECTOR = /\[data-theme\s*=\s*["']dark["']\]/;
const DARK_CONTEXT = /prefers-color-scheme\s*:\s*dark/;
const PRINT_CONTEXT = /@media[^>]*\bprint\b/;

// Every colour literal a page's own <style> hardcodes, split into custom
// properties (one dark block converts them all) and everything else.
function measure(html) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const style = [...noScript.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => m[1]).join('\n');
  const out = { tokens: 0, scattered: 0, props: new Map(), styleBytes: style.length };
  for (const rule of rules(stripComments(style))) {
    if (PRINT_CONTEXT.test(rule.context)) continue;
    if (DARK_CONTEXT.test(rule.context)) continue;
    if (DARK_SELECTOR.test(rule.selector)) continue;
    for (const m of rule.body.matchAll(/([-a-zA-Z]+)\s*:\s*([^;{}]+)/g)) {
      const prop = m[1].toLowerCase();
      const custom = prop.startsWith('--');
      if (!custom && !COLOUR_PROPS.has(prop)) continue;
      const n = literalsIn(m[2]);
      if (!n) continue;
      if (custom) out.tokens += n;
      else {
        out.scattered += n;
        out.props.set(prop, (out.props.get(prop) || 0) + n);
      }
    }
  }
  return out;
}

/* ── what a page actually loads ───────────────────────────────────────── */
// A substring search of the whole file is not a reference. `ideas-backlog.html`
// is a page *about* this backlog: its prose says `<code>_shared/a11y.js</code>`
// and `<code>_shared/ink-paper.css</code>`, and a `/_shared\/a11y\.js/` test
// over the raw HTML counted that as loading them. It was therefore ranked as a
// themed candidate for six increments and reached the top of a batch — a page
// with no a11y.js, no shared palette and its own private :root, where a dark
// block would never be switched on. Adopted pages also carry a `<!-- Native
// dark comes from _shared/ink-paper.css ... -->` comment, so the same test
// would call a page ink-paper on the strength of its own explanation.
//
// So: strip comments, read the `src`/`href` of real <script> and <link> tags,
// and match on the resolved filename. Nothing else counts as loading a file.
const stripHtmlComments = html => html.replace(/<!--[\s\S]*?-->/g, '');
function loadedFiles(html) {
  const out = new Set();
  for (const tag of stripHtmlComments(html).match(/<(?:script|link)\b[^>]*>/gi) || []) {
    const m = /\b(?:src|href)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (m) out.add(m[1].split('?')[0].split('#')[0].replace(/\\/g, '/'));
  }
  return out;
}
const loads = (files, name) => [...files].some(u => u === name || u.endsWith('/' + name));

/* ── the survey ───────────────────────────────────────────────────────── */

const pages = livePages();
const native = [];
const candidates = [];
const unthemed = [];

for (const rel of pages) {
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  const files = loadedFiles(html);
  const themed = loads(files, 'a11y.js');
  const flag = /A11Y_NATIVE_THEME\s*=\s*true/.test(stripHtmlComments(html));
  const m = measure(html);
  const entry = {
    file: rel,
    inkPaper: loads(files, 'ink-paper.css'),
    themeCss: loads(files, 'theme.css'),
    stage: loads(files, 'stage.js') ? 'linked'
      : /requestFullscreen/.test(html) ? 'hand-rolled' : '',
    canvas: /<canvas\b/i.test(html),
    tokens: m.tokens,
    scattered: m.scattered,
    total: m.tokens + m.scattered,
    topProps: [...m.props.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([p, n]) => p + '×' + n),
  };
  if (!themed) unthemed.push(entry);
  else if (flag) native.push(entry);
  else candidates.push(entry);
}

// Projector evidence first — P3 is the projector rollout — then cheapest
// first inside each group, then by name so the order is stable.
const projector = c => (c.stage === 'linked' ? 2 : c.stage === 'hand-rolled' ? 2 : 0) + (c.canvas ? 1 : 0);
candidates.sort((a, b) =>
  projector(b) - projector(a) || a.total - b.total || a.file.localeCompare(b.file));

const selected = only
  ? candidates.filter(c => c.file.toLowerCase().includes(only.toLowerCase()))
  : candidates;
const batch = showAll || only ? selected : selected.slice(0, batchSize);

if (asJson) {
  console.log(JSON.stringify({
    pages: pages.length,
    native: native.map(n => n.file),
    remaining: candidates.length,
    unthemed: unthemed.map(u => u.file),
    batch,
  }, null, 2));
  process.exit(0);
}

const pct = n => Math.round((n / (native.length + candidates.length)) * 100);
console.log('live pages         : ' + pages.length +
  ' (' + (native.length + candidates.length) + ' themed by a11y.js, ' +
  unthemed.length + ' not)');
console.log('native dark        : ' + native.length + ' (' + pct(native.length) + '%)');
console.log('still on the filter: ' + candidates.length);
console.log('linking stage.js   : ' +
  (native.concat(candidates).filter(c => c.stage === 'linked').length) +
  '; still hand-rolling fullscreen: ' +
  (native.concat(candidates).filter(c => c.stage === 'hand-rolled').length));

// The honest version of the figure a #167-era handoff got about 3× too high.
if (candidates.length) {
  const totals = candidates.map(c => c.total).sort((a, b) => a - b);
  const sum = totals.reduce((a, b) => a + b, 0);
  const median = totals.length % 2
    ? totals[(totals.length - 1) / 2]
    : Math.round((totals[totals.length / 2 - 1] + totals[totals.length / 2]) / 2);
  console.log('literals to convert: ' + sum + ' across ' + candidates.length +
    ' pages — median ' + median + ', range ' + totals[0] + '–' + totals[totals.length - 1] +
    ' (' + candidates.filter(c => !c.total).length + ' with none at all)');
}

if (unthemed.length) {
  console.log('\nNeeds _shared/a11y.js first (' + unthemed.length + ') — these pages get no theme at all\n' +
    'today, native or filtered, so a dark palette on one would never be switched on:');
  for (const u of unthemed) {
    const why = u.file.includes('035') ? '  — runs its own four-palette data-theme system (see BACKLOG Standing decisions)'
      : u.inkPaper ? '  — links ink-paper.css already'
      : u.themeCss ? '  — links theme.css (Industry palette)'
      : '  — no shared palette either';
    console.log('  ' + u.file + why);
  }
}

if (!selected.length) {
  console.log('\nNothing left: every themed page paints its own dark palette.');
  process.exit(0);
}

const rounds = Math.ceil(candidates.length / batchSize);
console.log('\nNext batch (' + batch.length + ' of ' + selected.length +
  (only ? '' : '; ' + rounds + ' round' + (rounds === 1 ? '' : 's') +
    ' left at ' + batchSize + ' per round') + '):\n');
console.log('  literals = colour literals in the page\'s own <style>, outside @media print');
console.log('  tokens   = of those, ones in a custom property (one dark block converts them all)\n');

for (const c of batch) {
  const notes = [];
  if (c.stage) notes.push('stage: ' + c.stage);
  if (c.canvas) notes.push('<canvas>');
  if (!c.inkPaper) notes.push(c.themeCss ? 'theme.css (Industry palette)' : 'NO shared palette');
  console.log('  ' + c.file);
  console.log('      literals: ' + c.total + '  (' + c.tokens + ' in tokens, ' +
    c.scattered + ' scattered' + (c.topProps.length ? ': ' + c.topProps.join(', ') : '') + ')');
  if (notes.length) console.log('      ' + notes.join('  |  '));
}

const noPalette = batch.filter(c => !c.inkPaper && !c.themeCss);
if (noPalette.length) {
  console.log('\n' + noPalette.length + ' page(s) in this batch link neither ink-paper.css nor theme.css.');
  console.log('Those need the palette adopted before a dark block has tokens to redefine.');
}
console.log('\nAfter converting a page: set window.A11Y_NATIVE_THEME = true before the a11y.js');
console.log('tag, gate its dark rules with :not(.a11y-filter-dark), and run npm run test:theme.');
