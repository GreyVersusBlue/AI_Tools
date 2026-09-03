// check-entities.mjs — read-only sweep: HTML entity names inside JavaScript
// string literals.
//
//   node Tools/board-check/check-entities.mjs      (or: npm run check:entities)
//
// The bug class: a string such as 'Period 3 &mdash; Earth Science' is right in
// HTML and wrong in JavaScript. Set on textContent, a placeholder, a title, an
// option label, an aria-label, or passed to alert(), it renders literally as
// "&mdash;" — the browser only decodes entities while parsing markup. It has
// been found by eye in several improvement rounds and never by a check, and
// the failure is silent: nothing errors, the teacher just sees "&rsquo;" in a
// button.
//
// What it scans: every inline <script> block in a live page, plus the
// site's own scripts (_shared/*.js, Tools/*/*.js, Tools/*/*.mjs). Inside each,
// a small scanner walks the code tracking string literals ('…', "…", `…`)
// and comments, and reports an entity (&name; or &#NNN;) that occurs INSIDE a
// string literal.
//
// What it reports: an entity inside a string literal whose statement has a
// TEXT sink — something the browser will never parse as markup:
//   - .textContent / .innerText / .value / .placeholder / .title / .alt /
//     document.title / createTextNode / new Option(...) / alert / confirm /
//     prompt / setAttribute('title'|'aria-label'|'placeholder'|'alt'|'data-…');
//   - a call to a helper defined in the same file whose body writes
//     textContent (and never innerHTML) — showMsg(), say(), setStatus() and
//     their cousins are resolved this way rather than guessed by name;
//   - a variable assigned from the literal that the same file later hands to
//     one of those sinks (status = '…&rsquo;…'; … el.textContent = status).
// What it does not report: a literal that contains a tag (markup by
// construction), one of the five escaping-table values (&amp; &lt; &gt; &quot;
// &#39; on their own), and any literal whose sink it cannot see. That last
// group is counted and printed as an advisory total so the coverage is
// honest; it is deliberately not a failure, because "an entity in a string
// somewhere" is not a bug — a data table that is later rendered through
// innerHTML is fine, and the site has hundreds of those. Exit 1 on any
// reported finding.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE_EXEMPT = ['Tools/Old Designs/', 'Tools/New Designs/', 'index_backup.html'];

const ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g;
const MARKUP_SINK = /innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|parseFromString|srcdoc|document\.write/;
const TEXT_SINK = /\.(?:textContent|innerText|value|placeholder|title|alt|label|nodeValue)\s*[+]?=|document\.title\s*=|createTextNode\s*\(|new Option\s*\(|\b(?:alert|confirm|prompt)\s*\(|setAttribute\s*\(\s*['"](?:title|aria-label|aria-description|placeholder|alt|data-[\w-]+|download|content)['"]/;

/** Pieces of code that are string literals: [start, end, quote] ranges. */
function stringRanges(code) {
  const out = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {                    // line comment
      const e = code.indexOf('\n', i); i = e < 0 ? n : e; continue;
    }
    if (ch === '/' && next === '*') {                    // block comment
      const e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const start = i; i++;
      while (i < n) {
        const c = code[i];
        if (c === '\\') { i += 2; continue; }
        if (c === ch) break;
        if (ch !== '`' && c === '\n') break;             // unterminated: bail at EOL
        if (ch === '`' && c === '$' && code[i + 1] === '{') {
          // skip the interpolation, tracking nested braces (and nested strings roughly)
          let depth = 1; i += 2;
          while (i < n && depth) { if (code[i] === '{') depth++; else if (code[i] === '}') depth--; i++; }
          continue;
        }
        i++;
      }
      out.push([start, Math.min(i + 1, n), ch]);
      i++;
      continue;
    }
    i++;
  }
  return out;
}

function statementBefore(code, at) {
  // Back to the previous ; or { or } that ends a line — the statement the
  // string sits in, near enough.
  let s = at;
  while (s > 0) {
    if ((code[s] === ';' || code[s] === '{' || code[s] === '}') && /[\n\r]/.test(code[s + 1] || '\n')) { s++; break; }
    s--;
  }
  return code.slice(s, at);
}

function lineOf(code, at) { return code.slice(0, at).split('\n').length; }

/** Helpers defined in this code, classified by what their body writes:
 *  'text' (textContent/innerText and never innerHTML), 'markup', or 'mixed'. */
function helperKinds(code) {
  const kinds = new Map();
  const DEF = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g;
  for (const m of code.matchAll(DEF)) {
    const name = m[1] || m[2];
    const open = code.indexOf('{', m.index + m[0].length - 1);
    if (open < 0) continue;
    let depth = 0, i = open;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}' && --depth === 0) break;
    }
    const body = code.slice(open, i + 1);
    const markup = MARKUP_SINK.test(body);
    const text = /\.(?:textContent|innerText)\s*=|createTextNode\s*\(/.test(body);
    if (text && !markup) kinds.set(name, 'text');
    else if (markup && !text) kinds.set(name, 'markup');
    else if (markup && text) kinds.set(name, 'mixed');
  }
  return kinds;
}

function scan(code, label, baseLine = 1) {
  const findings = [];
  let unknown = 0;
  const kinds = helperKinds(code);
  for (const [start, end] of stringRanges(code)) {
    const lit = code.slice(start, end);
    const hits = [...lit.matchAll(ENTITY)];
    if (!hits.length) continue;
    // A literal that carries a tag is markup by construction, and a literal
    // that is exactly one of the five escape targets is an escaping table's
    // value (the thing that PRODUCES entities for innerHTML), not a bug.
    if (/<\/?[a-zA-Z][^>]*>?/.test(lit)) continue;
    if (/^["'`]&(?:amp|lt|gt|quot|#39|#x27|apos);["'`]$/.test(lit)) continue;
    const before = statementBefore(code, start);
    const after = code.slice(end, Math.min(code.length, end + 120)).split('\n')[0];
    const stmt = before + lit + after;
    if (MARKUP_SINK.test(stmt)) continue;

    let sink = null;
    if (TEXT_SINK.test(stmt)) sink = 'a text sink in the same statement';
    if (!sink) {
      for (const m of stmt.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
        const k = kinds.get(m[1]);
        if (k === 'text') { sink = `${m[1]}() writes textContent`; break; }
        if (k === 'markup' || k === 'mixed') { sink = 'markup'; break; }
      }
    }
    if (sink === 'markup') continue;
    if (!sink) {
      // status = '…'; … el.textContent = status
      const assign = /(?:^|[\s;{(,])(?:(?:var|let|const)\s+)?([A-Za-z_$][\w$]*)\s*[+]?=\s*$/.exec(before);
      if (assign) {
        const v = assign[1];
        const flows = new RegExp(`\\.(?:textContent|innerText|value|placeholder|title)\\s*[+]?=\\s*[^;]*\\b${v}\\b|createTextNode\\(\\s*${v}\\b|\\b(?:alert|confirm)\\(\\s*${v}\\b`);
        const markupFlows = new RegExp(`(?:innerHTML|insertAdjacentHTML)[^;]*\\b${v}\\b`);
        if (flows.test(code) && !markupFlows.test(code)) sink = `${v} is later set as text`;
        else if (markupFlows.test(code)) continue;
      }
    }
    if (!sink) { unknown++; continue; }
    findings.push({
      where: `${label}:${baseLine + lineOf(code, start) - 1}`,
      entities: [...new Set(hits.map(h => h[0]))].join(' '),
      sink,
      snippet: (before.trim().split('\n').pop() + lit).trim().slice(-110),
    });
  }
  return { findings, unknown };
}

function livePages() {
  const out = ['index.html'];
  for (const f of fs.readdirSync(path.join(SITE, 'Tools'))) if (f.endsWith('.html')) out.push('Tools/' + f);
  for (const f of fs.readdirSync(SITE)) if (f.endsWith('.html') && f !== 'index.html') out.push(f);
  return out.filter(p => !PAGE_EXEMPT.some(x => p.startsWith(x) || p === x));
}

function siteScripts() {
  const out = [];
  for (const f of fs.readdirSync(path.join(SITE, '_shared'))) if (/\.m?js$/.test(f)) out.push('_shared/' + f);
  const toolsDir = path.join(SITE, 'Tools');
  for (const tool of fs.readdirSync(toolsDir)) {
    const dir = path.join(toolsDir, tool);
    if (!fs.statSync(dir).isDirectory() || tool === 'board-check' || /Designs$/.test(tool)) continue;
    for (const f of fs.readdirSync(dir)) if (/\.m?js$/.test(f) && !/\.test\./.test(f)) out.push(`Tools/${tool}/${f}`);
  }
  return out;
}

const findings = [];
let unknownTotal = 0;
const take = r => { findings.push(...r.findings); unknownTotal += r.unknown; };
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
for (const page of livePages()) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  for (const m of html.matchAll(SCRIPT)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    if (/type\s*=\s*["'](?!module|text\/javascript|application\/javascript)/i.test(m[1])) continue; // JSON, templates
    const baseLine = html.slice(0, m.index + m[0].indexOf(m[2])).split('\n').length;
    take(scan(m[2], page, baseLine));
  }
}
for (const file of siteScripts()) {
  take(scan(fs.readFileSync(path.join(SITE, file), 'utf8'), file));
}

if (findings.length) {
  console.error(`\ncheck-entities: ${findings.length} HTML entit${findings.length === 1 ? 'y' : 'ies'} inside JavaScript string literals:\n`);
  for (const f of findings) console.error(`  ${f.where}  ${f.entities}  (${f.sink})\n            ${f.snippet}`);
  console.error('\nAn entity in a JS string is only decoded if the string becomes markup (innerHTML).');
  console.error('On textContent, a placeholder, a title, an option or an alert it shows literally.');
  console.error('Use the character itself (— ’ “ ” … ×) or a \\u escape. If the string really is');
  console.error('markup, put the sink (innerHTML / a variable named …Html) in the same statement.');
  process.exit(1);
}
console.log(`check-entities: OK — no HTML entities in JavaScript strings that reach a text sink (${unknownTotal} in strings whose sink is not visible statically; not counted).`);
