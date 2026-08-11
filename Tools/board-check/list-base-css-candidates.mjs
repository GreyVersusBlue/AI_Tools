// list-base-css-candidates.mjs — read-only picker for the next Phase 4 batch.
//
//   node Tools/board-check/list-base-css-candidates.mjs [N] [--all] [--json]
//
// Phase 4 of REFACTOR_PLAN.md moves layout rules that are duplicated
// byte-identically across tools into _shared/base.css. This script decides
// what is left to do, so a migration round doesn't have to re-derive it by
// hand (and can't quietly get it wrong). It has no write path at all.
//
// Definitions, both checked against the tree rather than against the plan's
// prose lists — so a round that forgets to update the plan still picks up
// correct work next time:
//
//   CANDIDATE  a tool whose inline <style> declares a top-level rule whose
//              selector exactly matches one in _shared/base.css AND whose
//              body is byte-identical to base.css's, ignoring leading
//              indentation. Rules that differ by even one value are NOT
//              candidates — they are per-tool variants and stay inline.
//   DONE       the tool already links _shared/base.css.
//
// Selectors and bodies are read out of _shared/base.css at runtime, so
// adding a rule there automatically widens the candidate set. Nothing is
// hardcoded except the file's location.
//
// The script also flags, per tool:
//   - `variants`  rules matching a base.css selector whose body differs.
//     Leave these inline; the round should record them in the plan.
//   - `print`     the tool has its own @media print block, or no #printArea
//     element. Either way it must NOT link _shared/print-area.css, which
//     blanks the page and restores only #printArea — see that file's header.
//
// Exit code is always 0; "nothing left" is a normal result, not a failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS = path.join(SITE, 'Tools');
const BASE_CSS = path.join(SITE, '_shared', 'base.css');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const showAll = args.includes('--all');
const batchSize = Number(args.find(a => /^\d+$/.test(a)) || 12);

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const normBody = body => body.split('\n').map(l => l.trim()).filter(Boolean).join('\n');

// Split CSS into top-level { selector, body } rules. At-rules are recursed
// into so nested rules are visible, but they keep their at-rule context and
// are never treated as top-level.
function rules(css, context = '', out = []) {
  let i = 0;
  while (i < css.length) {
    let start = i, j = i;
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

if (!fs.existsSync(BASE_CSS)) {
  console.error('missing ' + path.relative(SITE, BASE_CSS));
  process.exit(1);
}

// The shared rules, read straight out of base.css.
const shared = new Map();
for (const r of rules(stripComments(fs.readFileSync(BASE_CSS, 'utf8')))) {
  if (!r.context) shared.set(r.selector, normBody(r.body));
}

const files = fs.readdirSync(TOOLS).filter(f => f.endsWith('.html')).sort();
const done = [];
const candidates = [];
const linked = [];   // links base.css, whether or not any rule text remains

for (const file of files) {
  const html = fs.readFileSync(path.join(TOOLS, file), 'utf8');
  if (/_shared\/base\.css/.test(html)) linked.push(file);
  const style = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const css = stripComments(style);
  const parsed = rules(css);

  const matches = [];   // byte-identical -> safe to delete
  const variants = [];  // same selector, different body -> leave inline
  for (const r of parsed) {
    if (!shared.has(r.selector)) continue;
    if (r.context) { variants.push(r.selector + ' [' + r.context + ']'); continue; }
    if (normBody(r.body) === shared.get(r.selector)) matches.push(r.selector);
    else variants.push(r.selector);
  }
  if (!matches.length && !variants.length) continue;

  const entry = {
    file,
    matches: [...new Set(matches)].sort(),
    variants: [...new Set(variants)].sort(),
    hasPrintArea: /id="printArea"/.test(html),
    ownPrintBlock: /@media\s+print/.test(css),
  };

  if (/_shared\/base\.css/.test(html)) done.push(entry);
  else if (matches.length) candidates.push(entry);
  else done.push({ ...entry, variantsOnly: true });
}

const batch = showAll ? candidates : candidates.slice(0, batchSize);

if (asJson) {
  console.log(JSON.stringify({
    baseCssRules: [...shared.keys()],
    migrated: linked.length,
    remaining: candidates.length,
    batch,
  }, null, 2));
  process.exit(0);
}

console.log('base.css rules : ' + [...shared.keys()].join(', '));
console.log('already linked : ' + linked.length + ' tools');
console.log('remaining      : ' + candidates.length + ' tools');

const variantsOnly = done.filter(d => d.variantsOnly);
if (variantsOnly.length) {
  console.log('variants only  : ' + variantsOnly.length +
    ' tools have only per-tool variants of these selectors — nothing to migrate');
}

if (!candidates.length) {
  console.log('\nNothing left to migrate. Phase 4 is complete for the rules currently in base.css.');
  process.exit(0);
}

const rounds = Math.ceil(candidates.length / batchSize);
console.log('\nNext batch (' + batch.length + ' of ' + candidates.length +
  '; ' + rounds + ' round' + (rounds === 1 ? '' : 's') + ' left at ' + batchSize + ' per round):\n');

for (const c of batch) {
  const notes = [];
  if (c.variants.length) notes.push('LEAVE INLINE: ' + c.variants.join(', '));
  if (!c.hasPrintArea) notes.push('no #printArea');
  if (c.ownPrintBlock) notes.push('has own @media print');
  console.log('  ' + c.file);
  console.log('      delete: ' + c.matches.join(', '));
  if (notes.length) console.log('      ' + notes.join('  |  '));
}

const needsPrintCare = batch.filter(c => c.ownPrintBlock || !c.hasPrintArea);
if (needsPrintCare.length) {
  console.log('\nDo NOT link _shared/print-area.css to any of these ' + needsPrintCare.length +
    ' tools — they have their own print CSS or no #printArea element, and');
  console.log('print-area.css blanks the page and restores only #printArea. Leave their print CSS untouched.');
}

const withVariants = batch.filter(c => c.variants.length);
if (withVariants.length) {
  console.log('\n' + withVariants.length + ' tool(s) in this batch have a variant rule to leave inline —');
  console.log('record the file and the difference in REFACTOR_PLAN.md under Phase 4.');
}
