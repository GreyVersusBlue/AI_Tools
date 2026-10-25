// Path 11 P2: hold 035's BRIDGE to the parse-time rule, and its module graph
// to the precache. Pure Node, no browser.
//
// The page's classic script runs while the page is parsed; its module script
// (which puts each schedule-visualizer/sv-*.js module on window) runs after
// that, before DOMContentLoaded. So a bridge wrapper (a page function that
// reaches a module namespace) must never run at parse time. This reads every
// classic inline script with the parser check:publisher uses, takes each
// top-level statement that is not a declaration of a function, collects the
// calls it makes outside any nested function (a listener's body runs later),
// follows them through the page's own top-level functions, and fails on a
// path that reaches a wrapper, naming the path. On increment 2 it found one:
// a bare populateDeptDropdown() under its declaration, which init() repeats.
//
// Since increment 7 a module's exports may also be copied onto window
// (`Object.assign(window, SVBrowser)`: the old global surface of the browser
// script, which onclick handlers and the classic script call by bare name).
// Those names exist only after the module runs, so they count as wrappers.
//
// It also walks the import graph from the module script and fails on a
// module missing from sw.js's PRECACHE_URLS, or on a namespace a wrapper
// reads that the module script never sets. Since increment 8 (v323)
// check:precache follows module imports site-wide too; this stays as 035's own
// copy of that check, because it costs nothing and names the module script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, inlineScripts } from '../../board-check/check-publisher.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PAGE = 'Tools/035-schedule-visualizer.html';
/** A page function is a wrapper if it calls one of these namespace getters. */
export const GETTERS = { svModel: 'SVModel', svGraph: 'SVGraph', svRoutes: 'SVRoutes', svCongestion: 'SVCongestion', svPlayback: 'SVPlayback' };

let passed = 0, failed = 0;
function check(ok, label) {
  if (ok) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}

/** Array methods that run their callback before they return. */
const SYNC = new Set(['forEach', 'map', 'filter', 'some', 'every', 'find', 'findIndex', 'reduce', 'flatMap', 'sort']);
/** Calls (by bare name) that `node` makes before it returns: not inside a
 *  nested function, unless that function is handed to an array method that
 *  runs it at once. A listener, a timer or a promise callback runs later. */
function callsIn(node, out = new Set(), top = true) {
  if (!node || typeof node.type !== 'string') return out;
  if (!top && /Function/.test(node.type)) return out;
  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    if (node.callee.type === 'Identifier') out.add(node.callee.name);
    if (node.callee.type === 'MemberExpression' && SYNC.has(node.callee.property.name)) {
      for (const a of node.arguments) if (/Function/.test(a.type)) callsIn(a.body, out, true);
    }
  }
  for (const k of Object.keys(node)) {
    if (k === 'parent') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => callsIn(c, out, false));
    else if (v && typeof v.type === 'string') callsIn(v, out, false);
  }
  return out;
}

/** Names the module script copies onto window with Object.assign(window, NS),
 *  read off each such module's export list and exported declarations. */
export function windowExports(html) {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) return new Set();
  const pageDir = path.dirname(path.join(ROOT, PAGE));
  const names = new Set();
  for (const a of m[1].matchAll(/Object\.assign\(\s*window\s*,\s*(\w+)\s*\)/g)) {
    const im = new RegExp(`import\\s*\\*\\s*as\\s+${a[1]}\\s+from\\s*['"]([^'"]+)['"]`).exec(m[1]);
    if (!im) throw new Error(`Object.assign(window, ${a[1]}) with no import * as ${a[1]}`);
    const p = parse(fs.readFileSync(path.resolve(pageDir, im[1]), 'utf8'), 'module');
    if (p.error) throw new Error(`${im[1]} does not parse: ${p.error.message}`);
    for (const n of p.ast.body) {
      if (n.type !== 'ExportNamedDeclaration') continue;
      for (const s of n.specifiers) names.add(s.exported.name);
      const d = n.declaration;
      if (d && d.id) names.add(d.id.name);
      if (d && d.declarations) d.declarations.forEach(x => x.id.name && names.add(x.id.name));
    }
  }
  return names;
}

export function parseTimeReaches(html) {
  const fns = new Map();      // name → Set of names it calls (synchronously, approximately)
  const roots = [];           // { line, calls }
  for (const s of inlineScripts(html.replace(/\r/g, ''))) {
    const p = parse(s.code);
    if (p.error) throw new Error(`a classic script does not parse at line ${s.line + p.error.line - 1}: ${p.error.message}`);
    for (const node of p.ast.body) {
      if (node.type === 'FunctionDeclaration' && node.id) { fns.set(node.id.name, callsIn(node.body, new Set(), true)); continue; }
      const calls = callsIn(node, new Set(), true);
      if (calls.size) roots.push({ line: s.line + node.loc.start.line - 1, calls });
    }
  }
  const wrappers = new Set([...fns].filter(([, c]) => Object.keys(GETTERS).some(g => c.has(g))).map(([n]) => n));
  Object.keys(GETTERS).forEach(g => wrappers.add(g));
  const onWindow = windowExports(html);
  onWindow.forEach(n => wrappers.add(n));
  const bad = [];
  for (const r of roots) {
    for (const start of r.calls) {
      // breadth-first through page functions, remembering the path
      const seen = new Map([[start, [start]]]);
      const queue = [start];
      while (queue.length) {
        const n = queue.shift();
        if (wrappers.has(n)) { bad.push({ line: r.line, path: seen.get(n) }); break; }
        for (const m of fns.get(n) || []) if (!seen.has(m)) { seen.set(m, [...seen.get(n), m]); queue.push(m); }
      }
    }
  }
  return { bad, wrappers, onWindow, roots: roots.length, fns: fns.size };
}

export function moduleGraph(html) {
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) return { files: [], sets: [] };
  const pageDir = path.dirname(path.join(ROOT, PAGE));
  const files = [];
  const visit = (abs) => {
    if (files.includes(abs)) return;
    files.push(abs);
    const text = fs.readFileSync(abs, 'utf8');
    for (const im of text.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/gm)) visit(path.resolve(path.dirname(abs), im[1]));
  };
  for (const im of m[1].matchAll(/import\b[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) visit(path.resolve(pageDir, im[1]));
  const sets = [...m[1].matchAll(/window\.(\w+)\s*=/g)].map(x => x[1]);
  return { files: files.map(f => path.relative(ROOT, f).split(path.sep).join('/')), sets };
}

const html = fs.readFileSync(path.join(ROOT, PAGE), 'utf8');
const r = parseTimeReaches(html);
check(r.wrappers.size > Object.keys(GETTERS).length, `the page has bridge wrappers (${r.wrappers.size - Object.keys(GETTERS).length} found through ${Object.keys(GETTERS).join(', ')})`);
check(r.onWindow.has('brBuildPublishedHTML') && r.onWindow.has('toggleApp') && r.onWindow.has('renderVizCanvas') && r.onWindow.has('drawTile'),
  `the module script copies sv-browser.js's, sv-viz.js's and sv-editor.js's ${r.onWindow.size} exports onto window, and they count as wrappers`);
check(r.roots > 0 && r.fns > 100, `read ${r.fns} top-level functions and ${r.roots} top-level statements that call something`);
check(r.bad.length === 0, 'no top-level statement reaches a bridge wrapper at parse time'
  + r.bad.map(b => `\n         line ${b.line}: ${b.path.join(' → ')}`).join(''));

const g = moduleGraph(html);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
for (const f of g.files) {
  check(sw.includes(`"${f}"`), `${f} (imported by the page's module script) is in sw.js's PRECACHE_URLS`);
}
for (const ns of [...Object.values(GETTERS), 'SVBrowser', 'SVViz', 'SVEditor']) check(g.sets.includes(ns), `the module script sets window.${ns}`);

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
