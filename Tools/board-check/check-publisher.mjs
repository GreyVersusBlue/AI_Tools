#!/usr/bin/env node
// check-publisher.mjs — 035's publisher, held still before anyone moves it.
//
//   npm run check:publisher                 (or: node Tools/board-check/check-publisher.mjs)
//   npm run check:publisher -- --list       the published pieces and where each is declared
//   npm run check:publisher -- --json       the report as JSON
//   npm run check:publisher -- --explain <name>   where 034's copy of a piece parts from 035's
//   npm run check:publisher -- --ledger     rewrite the ledger's `same` list (read what moved first)
//
// Path 11 P1 (BACKLOG.md, "Path 11", the P1 bullet, which is this file's spec).
// 035's Publish builds a schedule browser by `.toString()`-ing live functions
// named in brPublishFnList() and a second list of constants inside
// brBuildPublishedHTML(), so a refactor of 035 silently changes what teachers
// are emailed. This guard reads the two pages as text, with ESLint's own
// parser and scope analysis (no browser), and fails on:
//
//   PARSE    035's classic inline scripts do not parse (a backtick in a BR_CSS
//            comment ends the template literal: the README's trap)
//   SHAPE    the publisher is not written in a form this guard understands.
//            Not knowing what is published has to fail, never pass.
//   LIST     a listed function with no top-level `function` declaration in a
//            classic script, or with two
//   CONST    'const X = ' + Y.toString() with X and Y different, or Y not a
//            top-level function or arrow constant
//   FREE     a name the assembled script reads and does not define, beyond
//            PUBLISHED_GLOBALS and the ES built-ins; or a KNOWN_FREE entry
//            that is no longer free (delete it)
//   STRICT   the assembled script does not parse as strict code, or assigns
//            to a name it never declared
//   LIVE     something only the live page has (AppState, storage, the network,
//            035's own helpers, any URL but the SVG namespace) in the script,
//            the markup or BR_CSS. A free LIVE name is reported here, not
//            under FREE, so one break gives one code.
//   HANDLER  an on…="name(" in the markup or a published piece that names
//            nothing published (window.print() is allowed)
//   ID       getElementById('x') in a published piece with no id="x" in the
//            markup or a published piece's own strings
//   STATE    a preamble `let` whose name or initial value is not the live
//            top-level declaration's
//   HEAD     the page template gains a <link>, a <script src>, a manifest or
//            a gvb:social marker
//   DATA     the publisher's data keys are not the contract's, or 034's
//            embedded data has a contract error at its own format
//   FORK     034's copy of a published piece against the ledger
//            (Tools/schedule/test/publisher-ledger.json): a `same` piece that
//            differs, a `forked` one that became the same, a name in no group
//
// A failure about 034's data prints shapes and positions only, never a value:
// 034 holds a real staff list and CI's log is public.
//
// What this does not check, on purpose: CSS classes a function emits against
// BR_CSS's selectors (a class with no rule is common and harmless, and a guard
// that guesses is worse than none); 035's 400-odd unpublished functions; ES
// modules (035's `<script type="module">` is skipped; its bindings are not page
// globals). P2 will move published functions into modules, and the first one it
// moves fails LIST: that is the prompt to teach readPublisher() a sources list.
// Its browser half, which holds assemble() to the real published bytes, is
// Tools/schedule/test/smoke-publish-baseline.mjs (npm run test:schedule-publish).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import globals from 'globals';
import { DATA_KEYS, readEmbedded, validate, shapeOf, formatOf } from '../schedule/test/published-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const PAGE_035 = 'Tools/035-schedule-visualizer.html';
export const PAGE_034 = 'Tools/034-schedule-browser.html';
export const LEDGER = 'Tools/schedule/test/publisher-ledger.json';

/** Outside names a published script may read. Seeded with what it reads
 *  today. ESLint's whole browser set would wave through a bare `name`,
 *  `status` or `event`, so this is a list, not `globals.browser`. */
export const PUBLISHED_GLOBALS = ['document'];
/** Free names that are known holes, each with why. Fails if one stops being free. */
export const KNOWN_FREE = {
  brRenderMapLegacy: 'behind a dead door: brRenderMap() calls it only when typeof BR_WINGS !== "undefined", '
    + 'never true in a published file',
};
export const LIVE_NAMES = ['AppState', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest',
  'WebSocket', 'getSubjects', 'toggleApp', 'showToast', 'brLoadFromVisualizer'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const BUILTINS = new Set(Object.keys(globals.builtin));

/* ── parsing ─────────────────────────────────────────────────────────── */

const linter = new Linter({ configType: 'flat' });
const LANG = [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'script' } }];

/** { ast, scopeManager, text } or { error: { line, message } }. */
export function parse(code) {
  const msgs = linter.verify(code, LANG);
  const fatal = msgs.find(m => m.fatal);
  if (fatal) return { error: { line: fatal.line, message: fatal.message } };
  const sc = linter.getSourceCode();
  return { ast: sc.ast, scopeManager: sc.scopeManager, text: code };
}

/** The classic inline scripts of a page: no src, not a module. */
export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs) || /type\s*=\s*["']?module/i.test(attrs)) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({ code: m[2], line: html.slice(0, start).split('\n').length });
  }
  return out;
}

const src = (text, node) => text.slice(node.range[0], node.range[1]);

/** Every top-level declaration across a page's classic inline scripts. */
function topLevel(html, label) {
  const decls = new Map();
  const nested = new Set();
  for (const s of inlineScripts(html.replace(/\r/g, ''))) {
    const p = parse(s.code);
    if (p.error) return { error: { line: s.line + p.error.line - 1, message: `${label}'s script does not parse: ${p.error.message}` } };
    const add = (name, d) => { if (!decls.has(name)) decls.set(name, []); decls.get(name).push(d); };
    for (const node of p.ast.body) {
      const line = s.line + node.loc.start.line - 1;
      if (node.type === 'FunctionDeclaration' && node.id) {
        add(node.id.name, { kind: 'function', node, text: src(s.code, node), line, code: s.code });
      } else if (node.type === 'VariableDeclaration') {
        for (const d of node.declarations) {
          if (d.id.type !== 'Identifier') continue;
          add(d.id.name, { kind: node.kind, node: d, init: d.init, initText: d.init ? src(s.code, d.init) : null,
            text: src(s.code, d), line: s.code.slice(0, d.range[0]).split('\n').length + s.line - 1, code: s.code });
        }
      }
    }
    // Any function declaration below the top level, to say why LIST failed.
    (function walk(n, depth) {
      if (!n || typeof n.type !== 'string') return;
      if (depth > 0 && n.type === 'FunctionDeclaration' && n.id) nested.add(n.id.name);
      for (const k of Object.keys(n)) {
        if (k === 'parent') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(c => walk(c, depth + 1));
        else if (v && typeof v.type === 'string') walk(v, depth + 1);
      }
    })(p.ast, -1);
  }
  return { decls, nested };
}

/** The text `.toString()` gives for a top-level declaration: a function's
 *  source from `function` to its closing brace, an arrow constant's initializer. */
function publishedText(d) {
  if (d.kind === 'function') return d.text;
  if (d.init && (d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression')) return d.initText;
  return null;
}

/** Evaluate a literal initializer (object, array, string, number, boolean, null). */
function literalValue(node, text) {
  const pure = n => {
    switch (n.type) {
      case 'Literal': return true;
      case 'UnaryExpression': return n.operator === '-' && pure(n.argument);
      case 'ArrayExpression': return n.elements.every(e => e && pure(e));
      case 'ObjectExpression': return n.properties.every(p => p.type === 'Property' && !p.computed && pure(p.value));
      case 'TemplateLiteral': return n.expressions.length === 0;
      default: return false;
    }
  };
  if (!node || !pure(node)) return { ok: false };
  return { ok: true, value: Function('"use strict"; return (' + src(text, node) + ');')() };
}

/* ── reading the publisher ──────────────────────────────────────────── */

const isStrLit = n => n && n.type === 'Literal' && typeof n.value === 'string';
function flattenPlus(n) {
  if (n.type === 'BinaryExpression' && n.operator === '+') return flattenPlus(n.left).concat(flattenPlus(n.right));
  return [n];
}
const memberName = n => n && n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier' ? n.property.name : null;

/** One element of the `consts` or `js` array: one of the five forms, or null. */
function classify(el) {
  if (isStrLit(el)) return { kind: 'str', value: el.value };
  if (el.type === 'Identifier' && el.name === 'consts') return { kind: 'consts' };
  if (el.type === 'CallExpression' && memberName(el.callee) === 'join' && el.arguments.length === 1 && isStrLit(el.arguments[0])) {
    const map = el.callee.object;
    if (map.type === 'CallExpression' && memberName(map.callee) === 'map') {
      const list = map.callee.object;
      const fn = map.arguments[0];
      if (list.type === 'CallExpression' && list.callee.type === 'Identifier' && list.callee.name === 'brPublishFnList'
          && fn && fn.type === 'ArrowFunctionExpression' && fn.params.length === 1
          && fn.body.type === 'CallExpression' && memberName(fn.body.callee) === 'toString') {
        return { kind: 'fns', sep: el.arguments[0].value };
      }
    }
    return null;
  }
  if (el.type === 'BinaryExpression' && el.operator === '+') {
    const parts = flattenPlus(el);
    if (parts.length !== 3 || !isStrLit(parts[0]) || !isStrLit(parts[2]) || parts[2].value !== ';') return null;
    const m = /^const ([A-Za-z_$][\w$]*) = $/.exec(parts[0].value);
    if (!m) return null;
    const mid = parts[1];
    if (mid.type === 'CallExpression' && mid.arguments.length === 0 && memberName(mid.callee) === 'toString'
        && mid.callee.object.type === 'Identifier') {
      return { kind: 'toString', name: m[1], from: mid.callee.object.name };
    }
    if (mid.type === 'CallExpression' && mid.arguments.length === 1 && mid.arguments[0].type === 'Identifier'
        && mid.callee.type === 'MemberExpression' && mid.callee.object.type === 'Identifier'
        && mid.callee.object.name === 'JSON' && memberName(mid.callee) === 'stringify') {
      return { kind: 'json', name: m[1], from: mid.arguments[0].name };
    }
    if (mid.type === 'Identifier') return { kind: 'value', name: m[1], from: mid.name };
  }
  return null;
}

function arrayOfJoin(decl) {
  const init = decl && decl.init;
  if (init && init.type === 'CallExpression' && memberName(init.callee) === 'join'
      && init.callee.object.type === 'ArrayExpression' && init.arguments.length === 1 && isStrLit(init.arguments[0])) {
    return { elements: init.callee.object.elements, sep: init.arguments[0].value };
  }
  return null;
}

/**
 * Read 035's publisher. Returns { fns, consts, json, preamble, boot, state,
 * markup, css, template, dataKeys, problems, plan } — `plan` is what
 * assemble() walks; `problems` are failures found while reading.
 */
export function readPublisher(html) {
  html = html.replace(/\r/g, '');
  const problems = [];
  const fail = (code, message) => problems.push({ code, message });
  // Names already failing LIST or CONST: not reported again under FREE or FORK.
  const broken = new Set();
  const top = topLevel(html, '035');
  const empty = { fns: [], consts: [], json: [], preamble: [], boot: [], state: [], markup: '', css: '', template: '',
    dataKeys: [], problems, broken, plan: null, decls: new Map() };
  if (top.error) { fail('PARSE', `line ${top.error.line}: ${top.error.message}`); return empty; }
  const { decls, nested } = top;
  const one = name => (decls.get(name) || []);

  const fnListDecl = one('brPublishFnList').find(d => d.kind === 'function');
  const buildDecl = one('brBuildPublishedHTML').find(d => d.kind === 'function');
  const markupDecl = one('brBuildPublishedMarkup').find(d => d.kind === 'function');
  if (!fnListDecl || !buildDecl || !markupDecl) {
    fail('SHAPE', 'publisher not understood: brPublishFnList, brBuildPublishedHTML and brBuildPublishedMarkup must be top-level functions');
    return { ...empty, decls };
  }
  const where = (d, n) => d.line + d.code.slice(d.node.range[0], n.range[0]).split('\n').length - 1;

  // The function list: `return [ a, b, … ]` of plain identifiers.
  const ret = fnListDecl.node.body.body.find(s => s.type === 'ReturnStatement');
  let fnNames = [];
  if (!ret || !ret.argument || ret.argument.type !== 'ArrayExpression'
      || !ret.argument.elements.every(e => e && e.type === 'Identifier')) {
    const bad = ret && ret.argument && ret.argument.type === 'ArrayExpression'
      ? ret.argument.elements.find(e => !e || e.type !== 'Identifier') : ret;
    fail('SHAPE', `publisher not understood: brPublishFnList() must return a plain list of names (line ${where(fnListDecl, bad || fnListDecl.node)})`);
  } else fnNames = ret.argument.elements.map(e => e.name);

  // brBuildPublishedHTML's own declarations.
  const local = {};
  for (const st of buildDecl.node.body.body) {
    if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.type === 'Identifier') local[d.id.name] = d;
  }
  const readArray = name => {
    const a = arrayOfJoin(local[name]);
    if (!a) { fail('SHAPE', `publisher not understood: \`${name}\` in brBuildPublishedHTML must be [ … ].join(…)`); return null; }
    const items = [];
    for (const el of a.elements) {
      const c = el && classify(el);
      if (!c) { fail('SHAPE', `publisher not understood: an element of \`${name}\` at line ${where(buildDecl, el || local[name])} is none of the five forms`); continue; }
      items.push(c);
    }
    return { items, sep: a.sep };
  };
  const constsArr = readArray('consts');
  const jsArr = readArray('js');

  // data's keys, in order.
  const dataKeys = [];
  if (local.data && local.data.init && local.data.init.type === 'ObjectExpression') {
    for (const p of local.data.init.properties) {
      if (p.type === 'Property' && !p.computed && p.key.type === 'Identifier') dataKeys.push(p.key.name);
      else fail('SHAPE', 'publisher not understood: `data` must be a plain object literal');
    }
  } else fail('SHAPE', 'publisher not understood: `data` in brBuildPublishedHTML must be an object literal');

  // The page template: the string literals of brBuildPublishedHTML's return.
  const bret = buildDecl.node.body.body.find(s => s.type === 'ReturnStatement');
  const template = bret && bret.argument ? flattenPlus(bret.argument).filter(isStrLit).map(n => n.value).join('') : '';
  const mret = markupDecl.node.body.body.find(s => s.type === 'ReturnStatement');
  const markup = mret && mret.argument && mret.argument.type === 'TemplateLiteral' ? src(markupDecl.code, mret.argument) : '';
  if (!markup) fail('SHAPE', 'publisher not understood: brBuildPublishedMarkup must return a template literal');
  const cssDecl = one('BR_CSS')[0];
  const css = cssDecl && cssDecl.init && cssDecl.init.type === 'TemplateLiteral'
    ? cssDecl.init.quasis.map(q => q.value.cooked).join('${…}') : '';
  if (!css) fail('SHAPE', 'publisher not understood: BR_CSS must be a top-level template literal');

  // Functions.
  const fns = [];
  for (const name of fnNames) {
    const ds = one(name);
    const fd = ds.filter(d => d.kind === 'function');
    if (ds.length !== 1 || !fd.length) broken.add(name);
    if (ds.length > 1) fail('LIST', `${name} is declared ${ds.length} times at the top level (lines ${ds.map(d => d.line).join(', ')})`);
    else if (!fd.length) {
      fail('LIST', ds.length ? `${name} is a top-level ${ds[0].kind}, not a function declaration (line ${ds[0].line}); .toString() of it would define nothing`
        : nested.has(name) ? `${name} is declared inside a block or function, so it is not a page global`
          : `${name} is listed but has no top-level function declaration in 035's classic scripts`);
    } else fns.push({ name, text: fd[0].text, line: fd[0].line });
  }

  // Constants.
  const consts = [], json = [];
  const constsPlan = [];
  for (const c of constsArr ? constsArr.items : []) {
    if (c.kind === 'str') { constsPlan.push(c); continue; }
    if (c.kind === 'toString') {
      if (c.name !== c.from) { broken.add(c.name); fail('CONST', `'const ${c.name} = ' + ${c.from}.toString(): the piece would publish ${c.from} under the name ${c.name}`); }
      const ds = one(c.from);
      const text = ds.length === 1 ? publishedText(ds[0]) : null;
      if (!text) { broken.add(c.name); fail('CONST', `${c.from} is not one top-level function or arrow constant`); continue; }
      consts.push({ name: c.name, from: c.from, kind: 'toString', text, line: ds[0].line });
      constsPlan.push({ ...c, text });
    } else if (c.kind === 'json' || c.kind === 'value') {
      const ds = one(c.from);
      const v = ds.length === 1 ? literalValue(ds[0].init, ds[0].code) : { ok: false };
      if (c.name !== c.from) fail('CONST', `'const ${c.name} = ' + … ${c.from}: the value would publish under another name`);
      if (!v.ok) { fail('SHAPE', `publisher not understood: ${c.from} is not one top-level literal`); continue; }
      json.push({ name: c.name, from: c.from });
      constsPlan.push({ ...c, value: v.value });
    } else fail('SHAPE', `publisher not understood: \`consts\` holds a ${c.kind}`);
  }

  // The js plan: strings before the functions are the preamble, after are boot.
  const plan = [];
  const preamble = [], boot = [];
  let seenFns = false, seenData = false;
  for (const c of jsArr ? jsArr.items : []) {
    if (c.kind === 'str') { (seenFns ? boot : preamble).push(c.value); plan.push(c); }
    else if (c.kind === 'consts') plan.push({ kind: 'consts', items: constsPlan, sep: constsArr ? constsArr.sep : '\n' });
    else if (c.kind === 'fns') { seenFns = true; plan.push(c); }
    else if (c.kind === 'json' && c.name === 'PUBLISHED_DATA' && c.from === 'data') { seenData = true; plan.push({ kind: 'data' }); }
    else fail('SHAPE', `publisher not understood: \`js\` holds a ${c.kind} (${c.name || ''})`);
  }
  if (jsArr && (!seenFns || !seenData)) fail('SHAPE', 'publisher not understood: `js` must hold the function list and PUBLISHED_DATA once each');

  // The preamble's state: every `let` not read off PUBLISHED_DATA.
  const state = [];
  const pre = parse(preamble.join('\n'));
  if (pre.error) fail('SHAPE', `publisher not understood: the preamble does not parse (${pre.error.message})`);
  else for (const st of pre.ast.body) {
    if (st.type !== 'VariableDeclaration') continue;
    for (const d of st.declarations) {
      const init = d.init ? src(pre.text, d.init) : 'undefined';
      if (/PUBLISHED_DATA/.test(init)) continue;
      state.push({ name: d.id.name, kind: st.kind, init });
    }
  }

  return { fns, consts, json, preamble, boot, state, markup, css, template, dataKeys, problems, broken, decls,
    plan: { items: plan, sep: jsArr ? jsArr.sep : '\n' } };
}

/* ── assembling ─────────────────────────────────────────────────────── */

/** The <script> text 035 would publish for `data`: brBuildPublishedHTML()'s
 *  `js` array, walked with the same separators. */
export function assemble(pub, data) {
  const constText = e => e.kind === 'str' ? e.value
    : e.kind === 'toString' ? `const ${e.name} = ${e.text};`
      : `const ${e.name} = ${e.kind === 'json' ? JSON.stringify(e.value) : String(e.value)};`;
  return pub.plan.items.map(e =>
    e.kind === 'str' ? e.value
      : e.kind === 'data' ? 'const PUBLISHED_DATA = ' + JSON.stringify(data) + ';'
        : e.kind === 'consts' ? e.items.map(constText).join(e.sep)
          : pub.fns.map(f => f.text).join(e.sep)).join(pub.plan.sep);
}

/** Which published piece a line of the assembled script is in. */
function pieceAt(script, line, pub) {
  const lines = script.split('\n');
  for (let i = line - 1; i >= 0; i--) {
    const m = /^(?:function\s+([\w$]+)|const\s+([\w$]+)\s*=)/.exec(lines[i]);
    if (m) return m[1] || m[2];
  }
  return pub ? 'the preamble' : '';
}

/** Names the script reads or writes and does not define (typeof X is not a use). */
export function freeNames(script) {
  const p = parse("'use strict';\n" + script);
  if (p.error) return { error: { line: p.error.line - 1, message: p.error.message } };
  return p.scopeManager.globalScope.through
    .filter(r => !BUILTINS.has(r.identifier.name))
    .filter(r => !(r.identifier.parent && r.identifier.parent.type === 'UnaryExpression' && r.identifier.parent.operator === 'typeof'))
    .map(r => ({ name: r.identifier.name, line: r.identifier.loc.start.line - 1, write: r.isWrite() }));
}

/* ── 034 ─────────────────────────────────────────────────────────────── */

/** Each published piece's state in 034: same text, forked, or absent. */
export function forkState(pub, html034) {
  const top = topLevel(html034.replace(/\r/g, ''), '034');
  if (top.error) return { error: top.error };
  const pieces = pub.fns.map(f => ({ name: f.name, text: f.text })).concat(pub.consts.map(c => ({ name: c.name, text: c.text })));
  return pieces.map(p => {
    const ds = top.decls.get(p.name) || [];
    const t = ds.length === 1 ? publishedText(ds[0]) : null;
    return { name: p.name, state: t === null ? 'absent' : t === p.text ? 'same' : 'forked', text034: t, text035: p.text };
  });
}

/* ── the check ───────────────────────────────────────────────────────── */

export function check({ root = ROOT, html035, html034, ledger } = {}) {
  html035 = (html035 ?? fs.readFileSync(path.join(root, PAGE_035), 'utf8')).replace(/\r/g, '');
  html034 = (html034 ?? fs.readFileSync(path.join(root, PAGE_034), 'utf8')).replace(/\r/g, '');
  ledger = ledger ?? JSON.parse(fs.readFileSync(path.join(root, LEDGER), 'utf8'));
  const failures = [];
  const notes = [];
  const fail = (code, message) => failures.push({ code, message });

  const pub = readPublisher(html035);
  failures.push(...pub.problems);
  // Not understood is the whole answer: nothing below can be judged on a
  // publisher this guard could not read.
  if (pub.problems.some(p => p.code === 'PARSE' || p.code === 'SHAPE')) {
    return { failures: failures.filter(f => f.code === 'PARSE' || f.code === 'SHAPE'), notes, pub };
  }

  const published = new Set(pub.fns.map(f => f.name).concat(pub.consts.map(c => c.name), pub.json.map(j => j.name)));
  const script = assemble(pub, {});

  // STRICT, FREE, LIVE (identifiers).
  const free = freeNames(script);
  if (free.error) {
    fail('STRICT', `the assembled script does not parse as strict code: ${free.error.message} (in ${pieceAt(script, free.error.line, pub)})`);
  } else {
    const seen = new Set();
    for (const f of free) {
      const key = f.name + (f.write ? '=' : '');
      if (seen.has(key) || pub.broken.has(f.name)) continue;
      seen.add(key);
      const inPiece = pieceAt(script, f.line, pub);
      if (f.write) fail('STRICT', `${f.name} is assigned and never declared (in ${inPiece}); strict code throws`);
      else if (LIVE_NAMES.includes(f.name)) fail('LIVE', `${f.name} is read by the published script (in ${inPiece}); only the live page has it`);
      else if (!PUBLISHED_GLOBALS.includes(f.name) && !KNOWN_FREE[f.name]) {
        fail('FREE', `${f.name} is read by the published script (in ${inPiece}) and defined nowhere in it`);
      }
    }
    for (const k of Object.keys(KNOWN_FREE)) {
      if (!free.some(f => f.name === k)) fail('FREE', `KNOWN_FREE's ${k} is no longer free: delete its entry`);
      else notes.push(`known free name: ${k} — ${KNOWN_FREE[k]}`);
    }
    // LIVE in the script's strings, and the dynamic import.
    const p = parse("'use strict';\n" + script);
    const strings = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'ImportExpression') fail('LIVE', `import() in the published script (in ${pieceAt(script, n.loc.start.line - 1, pub)})`);
      if (n.type === 'Literal' && typeof n.value === 'string') strings.push([n.value, n.loc.start.line - 1]);
      if (n.type === 'TemplateElement') strings.push([n.value.cooked || '', n.loc.start.line - 1]);
      for (const k of Object.keys(n)) {
        if (k === 'parent') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v.type === 'string') walk(v);
      }
    })(p.ast);
    for (const [s, line] of strings) liveInText(s, `a string in ${pieceAt(script, line, pub)}`, fail);
  }
  const stripCss = t => t.replace(/\/\*[\s\S]*?\*\//g, '');
  liveInText(stripCss(pub.css), 'BR_CSS', fail);
  liveInText(pub.markup.replace(/<!--[\s\S]*?-->/g, ''), 'the published markup', fail);

  // HANDLER
  const texts = [['the markup', pub.markup]].concat(pub.fns.map(f => [f.name, f.text]), pub.consts.map(c => [c.name, c.text]));
  for (const [where, t] of texts) {
    const re = /\bon[a-z]+\s*=\s*\\?["']\s*([A-Za-z_$][\w$.]*)\s*\(/g;
    let m;
    while ((m = re.exec(t))) {
      const n = m[1];
      if (n === 'window.print' || pub.broken.has(n)) continue;
      if (!published.has(n)) fail('HANDLER', `${where} has a handler calling ${n}(), which is not published`);
    }
  }

  // ID
  const allText = texts.map(t => t[1]).join('\n');
  for (const [where, t] of texts.slice(1)) {
    const re = /getElementById\(\s*(['"])([^'"]+)\1\s*\)/g;
    let m;
    while ((m = re.exec(t))) {
      const id = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`\\bid\\s*=\\s*\\\\?["']${id}\\\\?["']`).test(allText)) {
        fail('ID', `${where} looks up #${m[2]}, which no published markup or piece has`);
      }
    }
  }

  // STATE
  for (const s of pub.state) {
    const live = (pub.decls.get(s.name) || []).filter(d => d.kind !== 'function');
    if (live.length !== 1) fail('STATE', `the preamble's ${s.name} has no single live top-level declaration`);
    else if (live[0].kind !== s.kind || (live[0].initText ?? 'undefined') !== s.init) {
      fail('STATE', `the preamble has ${s.kind} ${s.name} = ${s.init}; the live page has ${live[0].kind} ${s.name} = ${live[0].initText}`);
    }
  }

  // HEAD
  const head = pub.template + '\n' + pub.markup;
  for (const [re, what] of [[/<link\b/i, 'a <link>'], [/<script\b[^>]*\bsrc\s*=/i, 'a <script src>'],
    [/manifest/i, 'a manifest'], [/gvb:social/i, 'a gvb:social marker']]) {
    if (re.test(head)) fail('HEAD', `the published page template has ${what}; a published file reaches for nothing`);
  }

  // DATA
  if (JSON.stringify(pub.dataKeys) !== JSON.stringify(DATA_KEYS)) {
    fail('DATA', `the publisher writes data keys ${JSON.stringify(pub.dataKeys)}; the contract's are ${JSON.stringify(DATA_KEYS)}`);
  }
  let d034 = null;
  try { d034 = readEmbedded(html034); } catch (e) { fail('DATA', `034's PUBLISHED_DATA: ${e.message}`); }
  if (d034) {
    const v = validate(d034);
    for (const e of v.errors) fail('DATA', `034's data, format ${v.format}: ${e.path}: ${e.message} (shape ${JSON.stringify(shapeOf(d034))})`);
    notes.push(`034's data is format ${formatOf(d034)}: ${v.errors.length} errors, ${v.warnings.length} warnings`);
  }

  // FORK
  const fork = forkState(pub, html034);
  if (fork.error) fail('FORK', `034: line ${fork.error.line}: ${fork.error.message}`);
  else {
    const group = {};
    for (const g of ['same', 'forked', 'absent']) {
      if (ledger[g] === undefined) continue;
      const list = Array.isArray(ledger[g]) ? ledger[g].map(x => typeof x === 'string' ? x : x.name) : Object.keys(ledger[g] || {});
      for (const n of list) group[n] = g;
    }
    for (const f of fork) {
      if (pub.broken.has(f.name)) continue;
      const g = group[f.name];
      if (!g) fail('FORK', `${f.name} is published and in none of the ledger's groups; put it in "${f.state}"${f.state === 'same' ? '' : ' with a sentence saying why'}`);
      else if (g === 'same' && f.state !== 'same') {
        fail('FORK', `${f.name} is "same" in the ledger but 034's copy is ${f.state} (--explain ${f.name}): port the fix to the other file, or move it to "forked" and say why`);
      } else if (g !== 'same' && f.state === 'same') {
        fail('FORK', `${f.name} is "${g}" in the ledger but 034's copy is now the same: lower the ledger (move it to "same") in this commit`);
      } else if (g !== f.state) fail('FORK', `${f.name} is "${g}" in the ledger but ${f.state} in 034`);
    }
    for (const n of Object.keys(group)) if (!fork.some(f => f.name === n) && !pub.broken.has(n)) fail('FORK', `the ledger names ${n}, which 035 does not publish`);
    const c = s => fork.filter(f => f.state === s).length;
    notes.push(`${fork.length} published pieces (${pub.fns.length} functions, ${pub.consts.length} .toString() constants) `
      + `+ ${pub.json.length} values; against 034: ${c('same')} same, ${c('forked')} forked, ${c('absent')} absent`);
  }
  return { failures, notes, pub, fork };
}

function liveInText(text, where, fail) {
  for (const n of LIVE_NAMES) if (new RegExp(`\\b${n}\\b`).test(text)) fail('LIVE', `${where} names ${n}`);
  for (const m of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`)<>]*/gi)) {
    if (!m[0].startsWith(SVG_NS)) fail('LIVE', `${where} holds a URL (${m[0]}); a published file reaches for nothing`);
  }
}

/* ── CLI ─────────────────────────────────────────────────────────────── */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const r = check();
  if (args.includes('--json')) {
    console.log(JSON.stringify({ failures: r.failures, notes: r.notes,
      fork: (r.fork || []).map(f => ({ name: f.name, state: f.state })) }, null, 2));
    process.exit(r.failures.length ? 1 : 0);
  }
  if (args.includes('--list')) {
    for (const f of r.pub.fns) console.log(`  function  ${f.name.padEnd(22)} line ${f.line}`);
    for (const c of r.pub.consts) console.log(`  const     ${c.name.padEnd(22)} line ${c.line} (.toString())`);
    for (const j of r.pub.json) console.log(`  value     ${j.name}`);
    console.log(`  state     ${r.pub.state.map(s => s.name).join(', ')}`);
    console.log(`  boot      ${r.pub.boot.filter(b => /^\w+\(\);$/.test(b)).join(' ')}`);
  }
  const ei = args.indexOf('--explain');
  if (ei >= 0) {
    const f = (r.fork || []).find(x => x.name === args[ei + 1]);
    if (!f) console.log(`  ${args[ei + 1]} is not a published piece`);
    else if (f.state !== 'forked') console.log(`  ${f.name} is ${f.state} in 034`);
    else {
      const a = f.text035.split('\n'), b = f.text034.split('\n');
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      console.log(`  ${f.name} parts at line ${i + 1} of the function:\n  035: ${a[i] ?? '(ends)'}\n  034: ${b[i] ?? '(ends)'}`);
    }
  }
  if (args.includes('--ledger') && r.fork && !r.fork.error) {
    const file = path.join(ROOT, LEDGER);
    const led = JSON.parse(fs.readFileSync(file, 'utf8'));
    led.same = r.fork.filter(f => f.state === 'same').map(f => f.name);
    fs.writeFileSync(file, JSON.stringify(led, null, 2) + '\n');
    console.log(`  rewrote ${LEDGER}'s "same" list (${led.same.length})`);
  }
  for (const n of r.notes) console.log('check-publisher: ' + n);
  if (r.failures.length) {
    for (const f of r.failures) console.log(`check-publisher: FAIL ${f.code}  ${f.message}`);
    console.log(`check-publisher: ${r.failures.length} failure(s). The spec is BACKLOG.md, Path 11, P1.`);
    process.exit(1);
  }
  console.log('check-publisher: OK — 035\'s publisher reads cleanly and 034 matches the ledger.');
}
