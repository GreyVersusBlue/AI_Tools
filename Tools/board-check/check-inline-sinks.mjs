// check-inline-sinks.mjs — a ratchet on markup sinks in the inline scripts of
// pages that accept input from a link.
//
//   node Tools/board-check/check-inline-sinks.mjs              (or: npm run check:inline-sinks)
//   node Tools/board-check/check-inline-sinks.mjs --list 066   print one page's sinks, with lines
//   node Tools/board-check/check-inline-sinks.mjs --baseline   rewrite inline-sinks-baseline.json
//
// Why this exists. `npm run lint` covers _shared/, per-tool modules, sw.js and
// the tooling — not the inline <script> blocks in the tool pages, which is where
// most of the site's code lives. Until Path 6 that gap was a code-quality gap:
// every input on the site was typed by the person sitting at it. A share link
// (_shared/share.js, state-link.js, handoffs.js) is the first input that is not
// (#250), and a page that writes arriving state through innerHTML runs whatever
// markup the link carried. #250 found exactly that in 066 and fixed it with a
// sanitizer; the rule it left was "before wiring a tool, grep its own sinks" —
// a rule applied by hand, per tool, while the adopters grow by five a session.
//
// What it does. For every tool page (and index.html) that references one of
// those three files — directly, or through a per-tool module it loads — it
// counts the dynamic markup sinks in the page's inline scripts: an innerHTML /
// outerHTML / srcdoc assignment whose right-hand side is not a single plain
// string literal, and every insertAdjacentHTML / document.write /
// createContextualFragment call. Comments and string contents are skipped.
//
// It is a ratchet, the same shape as the a11y allowlist:
//   - a page whose count GROWS fails: a new sink on a page that takes link
//     input is exactly the change that deserves a look at what reaches it;
//   - a page that STARTS taking link input fails until it has a baseline line,
//     which is the prompt to do #250's sink review before writing one;
//   - a page whose count SHRINKS fails too, so the baseline only goes down —
//     lower the number in the same commit.
// A count is not a finding: most of these sinks render escaped text and are
// fine. What the ratchet guarantees is that no new one arrives unread.
// `--baseline` rewrites the file from the tree; run it only after reading the
// sinks it is about to bless. Exit 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE = path.join(SITE, 'Tools', 'board-check', 'inline-sinks-baseline.json');
const LINK_INPUTS = ['_shared/share.js', '_shared/state-link.js', '_shared/handoffs.js'];

const argv = process.argv.slice(2);
const WRITE = argv.includes('--baseline');
const LIST = (() => { const i = argv.indexOf('--list'); return i === -1 ? null : argv[i + 1]; })();

const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { cwd: SITE, encoding: 'utf8' }).split('\0').filter(Boolean),
);
const pages = [...tracked].filter(f => f === 'index.html' || /^Tools\/\d{3}-[^/]+\.html$/.test(f)).sort();

/* ── references: does this page take link input? ─────────────────────────── */

const REF = /(?:\bsrc|\bhref)\s*=\s*["']([^"']+)["']|\bimport\s*(?:[^'"]*?\bfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

function refsIn(file) {
  const text = fs.readFileSync(path.join(SITE, file), 'utf8');
  const out = [];
  for (const m of text.matchAll(REF)) {
    const spec = m[1] || m[2] || m[3];
    if (!spec || /^(?:[a-z]+:|\/\/|#)/i.test(spec)) continue;
    const clean = decodeURIComponent(spec.split(/[?#]/)[0]);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
    if (tracked.has(resolved)) out.push(resolved);
  }
  return out;
}

function takesLinkInput(page) {
  const seen = new Set();
  const stack = [page];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const r of refsIn(f)) {
      if (LINK_INPUTS.includes(r)) return true;
      // follow per-tool modules only; _shared/ files are not the page's code
      if (/\.(?:m?js)$/.test(r) && r.startsWith('Tools/')) stack.push(r);
    }
  }
  return false;
}

/* ── the scanner ─────────────────────────────────────────────────────────── */

/** Replace comments with spaces and string/template contents with a
 *  placeholder of the same length, keeping line numbers and the quotes. A
 *  template's ${…} is kept as code, since that is where dynamic markup comes
 *  from. */
function mask(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  const blank = s => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const ch = code[i], nx = code[i + 1];
    if (ch === '/' && nx === '/') { const e = code.indexOf('\n', i); const end = e < 0 ? n : e; out += blank(code.slice(i, end)); i = end; continue; }
    if (ch === '/' && nx === '*') { const e = code.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; out += blank(code.slice(i, end)); i = end; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      out += ch; i++;
      while (i < n) {
        const c = code[i];
        if (c === '\\') { out += 'xx'.slice(0, Math.min(2, n - i)); i += 2; continue; }
        if (c === ch) { out += ch; i++; break; }
        if (ch !== '`' && c === '\n') { break; }
        if (ch === '`' && c === '$' && code[i + 1] === '{') {
          let depth = 1; out += '${'; i += 2;
          const start = i;
          while (i < n && depth) { if (code[i] === '{') depth++; else if (code[i] === '}') depth--; i++; }
          out += mask(code.slice(start, i - 1)) + '}';
          continue;
        }
        out += c === '\n' ? '\n' : 'x'; i++;
      }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

const ASSIGN = /\.(?:innerHTML|outerHTML|srcdoc)\s*\+?=(?!=)\s*/g;
const CALL = /\b(?:insertAdjacentHTML|createContextualFragment|document\.write(?:ln)?)\s*\(/g;
// A right-hand side that is one plain literal and then the end of the statement.
const PLAIN_LITERAL = /^(?:'x*'|"x*"|`x*`)\s*(?:;|\n|\)|,|$)/;

function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/type\s*=\s*["'](?!module|text\/javascript|application\/javascript)[^"']*["']/i.test(m[1])) continue;
    const offset = m.index + m[0].indexOf('>') + 1;
    out.push({ code: m[2], line: html.slice(0, offset).split('\n').length });
  }
  return out;
}

function sinksIn(page) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const found = [];
  for (const { code, line } of inlineScripts(html)) {
    const masked = mask(code);
    const lineOf = idx => line + masked.slice(0, idx).split('\n').length - 1;
    for (const m of masked.matchAll(ASSIGN)) {
      const rest = masked.slice(m.index + m[0].length, m.index + m[0].length + 400);
      if (PLAIN_LITERAL.test(rest)) continue;
      found.push(lineOf(m.index));
    }
    for (const m of masked.matchAll(CALL)) found.push(lineOf(m.index));
  }
  return found.sort((a, b) => a - b);
}

/* ── run ─────────────────────────────────────────────────────────────────── */

const scope = pages.filter(takesLinkInput);
const counts = Object.fromEntries(scope.map(p => [p, sinksIn(p).length]));

if (LIST) {
  const page = pages.find(p => p.includes(LIST));
  if (!page) { console.error(`check-inline-sinks: no page matches "${LIST}"`); process.exit(1); }
  const html = fs.readFileSync(path.join(SITE, page), 'utf8').split('\n');
  const lines = sinksIn(page);
  console.log(`${page} — ${lines.length} dynamic markup sink(s) in inline script${scope.includes(page) ? '' : ' (not in scope: takes no link input)'}`);
  for (const l of lines) console.log(`  ${String(l).padStart(6)}  ${html[l - 1].trim().slice(0, 140)}`);
  process.exit(0);
}

if (WRITE) {
  const body = {
    '//': [
      'Written by check-inline-sinks.mjs --baseline. One number per page that takes link input:',
      'its dynamic markup sinks in inline script. The check fails if a number grows, shrinks',
      '(lower it in the same commit), or a page that takes link input has no line. Read the',
      'sinks (--list <page>) before blessing a new or higher number here.',
    ],
    pages: counts,
  };
  fs.writeFileSync(BASELINE, JSON.stringify(body, null, 2) + '\n');
  console.log(`check-inline-sinks: wrote ${Object.keys(counts).length} pages, ${Object.values(counts).reduce((a, b) => a + b, 0)} sinks.`);
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).pages;
const problems = [];
for (const [p, n] of Object.entries(counts)) {
  if (!(p in base)) problems.push(`${p}: takes link input and has no baseline line (${n} sinks). Review them (--list), then add the line.`);
  else if (n > base[p]) problems.push(`${p}: ${n} dynamic markup sinks, baseline ${base[p]} — a new sink on a page that takes link input. Read it (--list); escape or sanitize what reaches it.`);
  else if (n < base[p]) problems.push(`${p}: ${n} sinks, baseline ${base[p]} — lower the baseline to ${n} in this commit.`);
}
for (const p of Object.keys(base)) {
  if (!(p in counts)) problems.push(`${p}: in the baseline but no longer in scope (removed, renamed, or no longer takes link input) — delete its line.`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`check-inline-sinks: ${scope.length} pages take link input; ${total} dynamic markup sinks in their inline scripts.`);
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p);
  process.exit(1);
}
console.log('check-inline-sinks: OK — every count matches the baseline.');
