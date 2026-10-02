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
// Two rules reach past the statement (AI-09, closing the blind spot #208 found):
//   - an entity in the string argument of escapeHtml()/escapeAttr() is wrong
//     wherever the result goes — the & is escaped, so the entity can only show
//     as text. No dataflow needed;
//   - an entity in an array/object initialiser (`var ROWS = [ … ]`) is followed
//     by name, up to six hops, through variables assigned from it and functions
//     that return it (`all = filtered()`, `item = all[i]`), to a text sink that
//     reads `name.prop` / `name[i]` off one of them. Name-based and single-file,
//     so it over-approximates a little by design (a `.length` read does not count).
//     A hit that reaches innerHTML is not reported.
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


/** Code with every string literal blanked, same length, so bracket matching ignores their contents. */
function maskStrings(code, ranges) {
  const a = code.split('');
  for (const [s, e] of ranges) for (let i = s; i < e; i++) if (a[i] !== '\n') a[i] = 'x';
  return a.join('');
}

/** For a literal at `at`: the key it is the value of (`key: '…'`) and the variable
 *  whose array/object initialiser it sits in (`const V = [ … ]`), or nulls. */
function initialiserOf(code, masked, at) {
  const key = null;
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const c = masked[i];
    if (c === ']' || c === '}' || c === ')') depth++;
    else if (c === '[' || c === '{' || c === '(') {
      if (depth) { depth--; continue; }
      if (c === '(') return { key: key && key[1], name: null };
      const v = /([A-Za-z_$][\w$]*)\s*=\s*$/.exec(masked.slice(Math.max(0, i - 80), i));
      if (v) return { key: key && key[1], name: v[1] };
      // nested: keep walking outward (an array inside an object inside the const)
    }
  }
  return { key: key && key[1], name: null };
}

/** Names that carry data out of initialiser `name`, by up to six hops: a variable
 *  assigned from an expression that reads a tainted name (`pool = BUILTIN.concat(…)`),
 *  a function that returns one.
 *  Name-based and single file — an over-approximation, which is why a hit is then
 *  required to reach a text sink and not be shadowed by a markup sink. */
function carriers(code, masked, name) {
  const tainted = new Set([name]);
  // "starts with": the value is the data (or a slice/filter/call of it), not an expression that merely mentions it.
  const mentions = expr => [...tainted].some(t => new RegExp(`^\\s*\\(?\\s*${t}\\b`).test(expr));
  for (let hop = 0; hop < 6; hop++) {
    const before = tainted.size;
    for (const m of masked.matchAll(/(?:(?:var|let|const)\s+)?([A-Za-z_$][\w$]*)\s*=\s*([^;=][^;]*)/g)) {
      if (/^[=>]/.test(m[2])) continue;
      if (mentions(m[2])) tainted.add(m[1]);
    }
    for (const m of masked.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) {
      let depth = 0, i = m.index + m[0].length - 1;
      for (; i < masked.length; i++) { if (masked[i] === '{') depth++; else if (masked[i] === '}' && --depth === 0) break; }
      const body = masked.slice(m.index + m[0].length, i);
      for (const r of body.matchAll(/\breturn\s+([^;\n]*)/g)) if (mentions(r[1])) { tainted.add(m[1]); break; }
    }
    if (tainted.size === before) break;
  }
  return tainted;
}

/** Does a text sink write something read off a carrier of the initialiser's data? */
function dataReachesText(code, masked, init) {
  if (!init.name) return null;
  const tainted = carriers(code, masked, init.name);
  tainted.delete(init.name);
  const sinkRe = /\.(?:textContent|innerText|value|placeholder|title|alt|nodeValue)\s*[+]?=\s*([^;\n]*)|createTextNode\s*\(([^;\n]*)|\b(?:alert|confirm)\s*\(([^;\n]*)/g;
  for (const m of masked.matchAll(sinkRe)) {
    const rhs = (m[1] ?? m[2] ?? m[3] ?? '');
    for (const t of tainted) if (new RegExp(`(?:^|[^\\w$.])${t}\\s*(?:\\.(?!length\\b)|\\[)`).test(rhs)) return { via: t, rhs: rhs.trim().slice(0, 60) };
  }
  return null;
}

export function scan(code, label, baseLine = 1) {
  const findings = [];
  let unknown = 0;
  const kinds = helperKinds(code);
  const ranges = stringRanges(code);
  const masked = maskStrings(code, ranges);
  for (const [start, end] of ranges) {
    const lit = code.slice(start, end);
    const hits = [...lit.matchAll(ENTITY)];
    if (!hits.length) continue;
    // An entity in a string handed to an escaper is wrong wherever the result goes:
    // the escaper turns & into &amp;, so the entity can only ever render as text.
    if (/\b(?:escapeHtml|escapeAttr|escHtml|escAttr|esc|escape_html)\s*\(\s*$/.test(masked.slice(Math.max(0, start - 40), start)) && !/<\/?[a-zA-Z]/.test(lit)) {
      findings.push({
        where: `${label}:${baseLine + lineOf(code, start) - 1}`,
        entities: [...new Set(hits.map(h => h[0]))].join(' '),
        sink: 'an escaper: the & is escaped, so the entity shows literally',
        snippet: (statementBefore(code, start).trim().split('\n').pop() + lit).trim().slice(-110),
      });
      continue;
    }
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
    if (!sink) {
      // One hop through data: `{ broken: '…&rsquo;…' }` in an initialiser, read back as
      // `item.broken` and written to a text sink somewhere in the same file.
      const init = initialiserOf(code, masked, start);
      const r = dataReachesText(code, masked, init);
      if (r) sink = `data from ${init.name}, via ${r.via}, is written as text: ${r.rhs}`;
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

export function main() {
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
