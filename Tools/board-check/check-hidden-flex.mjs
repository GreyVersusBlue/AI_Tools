// check-hidden-flex.mjs — read-only sweep: elements toggled with `hidden`
// whose own CSS sets `display`, on a page with no `[hidden]` rule to win.
//
//   node Tools/board-check/check-hidden-flex.mjs   (or: npm run check:hidden-flex)
//
// The bug class: the `hidden` attribute is only `display: none` in the
// browser's default stylesheet. Any author rule that sets `display` on the
// same element — `.toolbar { display: flex }`, `.grid { display: grid }`, even
// `display: block` — outranks it, so `el.hidden = true` does nothing visible
// and the element stays on screen. Found by eye in 046 (Blank Map Generator);
// the fix is one rule, `[hidden] { display: none !important }`, which the
// shared stylesheets do not carry and which 61 of 86 tool pages lack.
//
// For every live page this reads the inline <style> blocks and the site's own
// linked stylesheets (_shared/*.css, Tools/**.css), collects the class
// selectors whose declarations set `display` to anything but `none`, and
// then looks for elements that both carry one of those classes and are
// toggled with `hidden`:
//   - statically, a `hidden` attribute in the markup;
//   - from script, `X.hidden = …`, `X.toggleAttribute('hidden'…`,
//     `X.setAttribute('hidden'…`, `X.removeAttribute('hidden')`, where X is
//     resolved to an element id through the file's own lookups
//     (getElementById('id'), querySelector('#id'), els.id / $.id / ui.id,
//     `const x = byId('id')`), or by class through `querySelector('.cls')`.
// An element is reported when its page has no `[hidden]` rule that covers it:
// a bare `[hidden]` with !important, or a selector containing `[hidden]` that
// names the element's class or id. Exit 1 on any finding.
//
// Selectors are matched by class only (the common case: a display rule on
// `.row` or `.card.wide`); an element whose display comes from an id or a
// tag rule is out of scope, as is display set from JavaScript. The check is
// therefore a floor, not a ceiling — but everything it prints is a real
// element that a real `hidden` toggle does not hide. Set DEBUG_HIDDEN_FLEX=1
// to print every toggle it sees, per page, with the code it resolved it from.
//
// First run (2026-09-03): 8 elements on 6 pages, every one confirmed in a
// browser as displayed while carrying `hidden` — 004's "until" row, 015's
// story category, 024's two answer keys, 036's results box, 046's load-more
// row (plus two id-styled elements on 046 this check cannot see, #mapImg and
// #scaleBar, caught by the same browser pass). All fixed with the one rule.

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

/* ── CSS: rules as [selectorText, declarations], with @media unwrapped ─── */
function cssRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  const walk = (end) => {
    while (i < end) {
      const open = css.indexOf('{', i);
      if (open < 0 || open >= end) { i = end; return; }
      const selector = css.slice(i, open).trim();
      // find the matching close
      let depth = 1, j = open + 1;
      while (j < end && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      const body = css.slice(open + 1, j - 1);
      if (selector.startsWith('@')) {
        if (/^@(media|supports|layer|container)/.test(selector)) {
          const save = i; i = open + 1; walk(j - 1); i = j; void save;
        }
      } else if (selector) {
        rules.push([selector, body]);
      }
      i = j;
    }
  };
  walk(css.length);
  return rules;
}

const results = [];

for (const page of livePages()) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  let css = '';
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css += m[1] + '\n';
  for (const m of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/gi)) {
    const href = (m[1] || m[2] || '').split('?')[0];
    if (!href || /^(https?:|data:)/.test(href)) continue;
    const file = path.join(SITE, path.posix.normalize(path.posix.join(path.posix.dirname(page), decodeURIComponent(href))));
    if (fs.existsSync(file)) css += fs.readFileSync(file, 'utf8') + '\n';
  }
  const rules = cssRules(css);

  // class -> the display value its rules set (last one wins, roughly)
  const displayByClass = new Map();
  const hiddenRules = [];   // selectors that mention [hidden] and set display:none
  for (const [selectorText, body] of rules) {
    const disp = /(?:^|;|\s)display\s*:\s*([^;!]+)(\s*!important)?/i.exec(body);
    for (const sel of selectorText.split(',').map(s => s.trim())) {
      if (/\[hidden\]/.test(sel) && disp && /^none\b/i.test(disp[1].trim())) hiddenRules.push({ sel, important: !!disp[2] });
      if (!disp || /^none\b/i.test(disp[1].trim())) continue;
      if (/\[hidden\]|:hover|:focus|:active|::|:not\(|:checked/.test(sel)) continue;
      // the subject of the selector is its last compound; take its classes
      const subject = sel.split(/[\s>+~]+/).filter(Boolean).pop() || '';
      const classes = [...subject.matchAll(/\.([A-Za-z_-][\w-]*)/g)].map(x => x[1]);
      if (!classes.length || /#/.test(subject)) continue;
      for (const c of classes) displayByClass.set(c, disp[1].trim());
    }
  }
  if (!displayByClass.size) continue;

  const bareHidden = hiddenRules.some(r => /^\[hidden\]$|^\*\[hidden\]$|^html \[hidden\]$|^body \[hidden\]$/.test(r.sel.trim()));
  const covered = (id, classes) => bareHidden || hiddenRules.some(r =>
    (id && r.sel.includes('#' + id)) || classes.some(c => r.sel.includes('.' + c)));

  // Elements: id/class/hidden per opening tag.
  const elements = [];
  const byId = new Map();
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/^(script|style)$/i.test(m[1]) || attrs.includes('${')) continue;
    const id = (/\sid\s*=\s*["']([^"']+)["']/.exec(attrs) || [])[1] || '';
    const cls = ((/\sclass\s*=\s*["']([^"']*)["']/.exec(attrs) || [])[1] || '').split(/\s+/).filter(Boolean);
    const staticHidden = /\shidden(?=[\s>/=]|$)/.test(attrs) && !/\shidden\s*=\s*["']?(?:until-found)/.test(attrs);
    const line = html.slice(0, m.index).split('\n').length;
    const el = { tag: m[1], id, cls, staticHidden, line };
    elements.push(el);
    if (id && !byId.has(id)) byId.set(id, el);
  }

  // Script: which ids/classes are toggled with hidden.
  let js = '';
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) {
      const src = (/\bsrc\s*=\s*["']([^"']+)["']/.exec(m[1]) || [])[1];
      if (src && !/^(https?:|data:)/.test(src) && !src.includes('_shared/vendor/')) {
        const file = path.join(SITE, path.posix.normalize(path.posix.join(path.posix.dirname(page), src.split('?')[0])));
        if (fs.existsSync(file)) js += fs.readFileSync(file, 'utf8') + '\n';
      }
    } else js += m[2] + '\n';
  }
  // `x = byId('id')` binds x to the element; `x = byId('id').querySelector(…)`
  // does not (that bound resetBtn to saveBar on 005 in the first draft), so a
  // lookup followed by a `.` is skipped. Bindings are kept with their
  // position and resolved to the NEAREST one before the toggle: `b` is bound
  // to bootWarn in one function and to moreBtn in another on the same page,
  // and a name-wide map picked the wrong one.
  const bindings = [];
  for (const m of js.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*(?:document\.)?(?:getElementById|querySelector|byId|\$id|el|\$|qs)\(\s*['"]#?([A-Za-z_][\w-]*)['"]\s*\)(?!\s*\.)/g)) bindings.push({ at: m.index, name: m[1], id: m[2] });
  const resolve = (name, before) => {
    let best = null;
    for (const b of bindings) { if (b.name === name && b.at < before) best = b; }
    return best ? best.id : null;
  };
  const toggledIds = new Set();
  const toggledClasses = new Set();
  const TOGGLE = /\.hidden\s*=[^=]|\.toggleAttribute\(\s*['"]hidden['"]|\.setAttribute\(\s*['"]hidden['"]|\.removeAttribute\(\s*['"]hidden['"]/g;
  const DEBUG = process.env.DEBUG_HIDDEN_FLEX ? (lhs, what) => console.log(`[${page}] ${what}  <=  ${lhs.split('\n').pop().trim().slice(-90)}`) : null;
  for (const m of js.matchAll(TOGGLE)) {
    const lhs = js.slice(Math.max(0, m.index - 160), m.index);
    if (DEBUG) DEBUG(lhs, m[0]);
    let mm;
    if ((mm = /(?:getElementById|byId|\$id|qs)\(\s*['"]([A-Za-z_][\w-]*)['"]\s*\)$/.exec(lhs))) toggledIds.add(mm[1]);
    else if ((mm = /querySelector\(\s*['"]#([A-Za-z_][\w-]*)['"]\s*\)$/.exec(lhs))) toggledIds.add(mm[1]);
    else if ((mm = /querySelector(?:All)?\(\s*['"]\.([A-Za-z_-][\w-]*)['"]\s*\)$/.exec(lhs))) toggledClasses.add(mm[1]);
    else if ((mm = /\b(?:els|el|ui|dom|refs|\$|E|D|nodes)\.([A-Za-z_$][\w$]*)$/.exec(lhs))) toggledIds.add(mm[1]);
    else if ((mm = /\b([A-Za-z_$][\w$]*)$/.exec(lhs))) {
      const v = mm[1];
      const bound = resolve(v, m.index);
      if (bound) toggledIds.add(bound);
      else if (byId.has(v) && !bindings.some(b => b.name === v)) toggledIds.add(v);
    }
  }

  for (const el of elements) {
    const displayed = el.cls.filter(c => displayByClass.has(c));
    if (!displayed.length) continue;
    const toggled = el.staticHidden || (el.id && toggledIds.has(el.id)) || el.cls.some(c => toggledClasses.has(c));
    if (!toggled) continue;
    if (covered(el.id, el.cls)) continue;
    results.push({
      page, line: el.line,
      what: `<${el.tag}${el.id ? ' id="' + el.id + '"' : ''} class="${el.cls.join(' ')}">`,
      rule: displayed.map(c => `.${c} { display: ${displayByClass.get(c)} }`).join(', '),
      how: el.staticHidden ? 'hidden attribute in the markup' : 'toggled with .hidden from script',
    });
  }
}

if (results.length) {
  const pages = new Set(results.map(r => r.page));
  console.error(`\ncheck-hidden-flex: ${results.length} element${results.length === 1 ? '' : 's'} on ${pages.size} page${pages.size === 1 ? '' : 's'} where \`hidden\` is overridden by the element's own display rule:\n`);
  for (const r of results) console.error(`  ${r.page}:${r.line}  ${r.what}\n            ${r.rule} — ${r.how}; no [hidden] rule on this page covers it`);
  console.error('\nThe hidden attribute is only display:none in the UA stylesheet; any author display');
  console.error('rule beats it. Add `[hidden] { display: none !important; }` to the page\'s <style>');
  console.error('(next to its reset), or toggle a class instead of the attribute.');
  process.exit(1);
}
console.log('check-hidden-flex: OK — every element toggled with `hidden` on a live page is either free of its own display rule or covered by a [hidden] rule.');
