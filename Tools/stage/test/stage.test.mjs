// stage.test.mjs — _shared/stage.js: the key guard, the fallback, the HUD,
// and one-stage-at-a-time. Plain Node, no browser.
//
//   node Tools/stage/test/stage.test.mjs
//
// stage.js is a classic browser script, evaluated in a `vm` context over a
// small fake DOM (elements with classList, hidden, parent/child links, and
// a document whose requestFullscreen either grants, refuses, or is missing —
// the three cases the eight hand-rolled copies handled differently). Real
// fullscreen — the browser granting it, the subtree rendering, Escape as
// the browser's key — is driven in Tools/number-talks-board/test/
// smoke-stage.mjs against the adopter, 024.
//
// The assertions this file exists for: a hotkey never fires while the
// teacher is typing (section 1), and a control the tool put in `hud` is
// inside the stage while it is on and back where it was afterwards
// (section 4) — the wrinkle the platform notes record being rediscovered
// four times.
//
// Exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { SITE } from '../../board-check/harness.mjs';

let passed = 0, failed = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) { passed++; return true; }
  failed++; fails.push(label); console.log('  FAIL ' + label); return false;
};
const show = v => (v && typeof v === 'object' && 'tagName' in v) ? `<${v.tagName.toLowerCase()}#${v.id}>` : JSON.stringify(v);
const eq = (a, b, label) =>
  ok((a && typeof a === 'object' && 'tagName' in a) ? a === b : JSON.stringify(a) === JSON.stringify(b),
    `${label} (got ${show(a)}, want ${show(b)})`);

const STAGE_SRC = fs.readFileSync(path.join(SITE, '_shared', 'stage.js'), 'utf8');

/* ── a fake DOM, just enough ─────────────────────────────────────────── */
function makeDom({ fullscreen = 'grant' } = {}) {
  // fullscreen: 'grant' | 'refuse' | 'missing'
  const listeners = {};
  const doc = {
    fullscreenElement: null,
    activeElement: null,
    body: null, head: null,
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener(t, fn) { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
    dispatch(t, e) { (listeners[t] || []).forEach(fn => fn(e)); },
    getElementById(id) { const find = n => n.id === id ? n : n.children.map(find).find(Boolean) || null; return find(doc.head) || find(doc.body); },
    createElement(tag) { return el(tag); },
  };
  if (fullscreen !== 'missing') {
    doc.exitFullscreen = () => { const was = doc.fullscreenElement; doc.fullscreenElement = null; if (was) doc.dispatch('fullscreenchange', {}); return Promise.resolve(); };
  }
  function el(tag, id) {
    const classes = new Set();
    const e = {
      tagName: tag.toUpperCase(), id: id || '', hidden: false, textContent: '', isContentEditable: false,
      parentNode: null, children: [],
      classList: {
        add(...c) { c.forEach(x => classes.add(x)); },
        remove(...c) { c.forEach(x => classes.delete(x)); },
        toggle(c, force) { if (force === undefined) force = !classes.has(c); force ? classes.add(c) : classes.delete(c); return force; },
        contains(c) { return classes.has(c); },
      },
      get className() { return [...classes].join(' '); },
      get nextSibling() { const p = e.parentNode; if (!p) return null; const i = p.children.indexOf(e); return p.children[i + 1] || null; },
      appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
      insertBefore(c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = ref ? e.children.indexOf(ref) : -1; if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
      removeChild(c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; },
      contains(x) { let n = x; while (n) { if (n === e) return true; n = n.parentNode; } return false; },
      handlers: {},
      addEventListener(t, fn) { (e.handlers[t] ||= []).push(fn); },
      removeEventListener(t, fn) { e.handlers[t] = (e.handlers[t] || []).filter(f => f !== fn); },
      click() { (e.handlers.click || []).forEach(fn => fn({ preventDefault() {} })); },
    };
    if (fullscreen === 'grant') {
      e.requestFullscreen = () => { doc.fullscreenElement = e; doc.dispatch('fullscreenchange', {}); return Promise.resolve(); };
    } else if (fullscreen === 'refuse') {
      e.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen request denied'));
    }
    return e;
  }
  doc.body = el('body'); doc.head = el('head');
  const win = { document: doc, Promise, Object, Array, String, Error, TypeError, JSON, Math, console };
  win.window = win;
  vm.runInContext(STAGE_SRC, vm.createContext(win), { filename: '_shared/stage.js' });
  return { Stage: win.Stage, doc, el, win };
}
const key = (k, extra = {}) => ({ key: k, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
const tick = () => new Promise(r => setTimeout(r, 0));

console.log('stage.js — the key guard, the fallback, the HUD, one stage at a time');

/* ── 1. the key guard: never while typing, never with a modifier ─────── */
{
  const { Stage, doc, el } = makeDom();
  eq(Stage.isTyping(null), false, '1: no active element is not typing');
  eq(Stage.isTyping(el('input')), true, '1: an input is typing');
  eq(Stage.isTyping(el('textarea')), true, '1: a textarea is');
  eq(Stage.isTyping(el('select')), true, '1: a select is (arrow keys change it)');
  eq(Stage.isTyping(el('button')), false, '1: a button is not');
  const ce = el('div'); ce.isContentEditable = true;
  eq(Stage.isTyping(ce), true, '1: contenteditable is');
  eq(Stage.shouldHandleKey(key('f'), el('button')), true, '1: a plain key on a button is handled');
  eq(Stage.shouldHandleKey(key('f', { ctrlKey: true }), null), false, '1: not with Ctrl (that is the browser\'s find)');
  eq(Stage.shouldHandleKey(key('f', { metaKey: true }), null), false, '1: not with Meta');
  eq(Stage.shouldHandleKey(key('f', { altKey: true }), null), false, '1: not with Alt');
  eq(Stage.shouldHandleKey(key('f'), el('input')), false, '1: not while typing');
  const pre = key('f'); pre.defaultPrevented = true;
  eq(Stage.shouldHandleKey(pre, null), false, '1: not when a page handler already claimed it');

  const stage = el('div', 'stage'); doc.body.appendChild(stage);
  let fired = 0;
  Stage.mount(stage, { hotkeys: { ' ': () => fired++, n: () => fired++ } });
  doc.dispatch('keydown', key(' '));
  eq(fired, 1, '1: Space fires the mapped hotkey');
  doc.dispatch('keydown', key('N'));
  eq(fired, 2, '1: a shifted letter matches its lower-case mapping');
  doc.activeElement = el('textarea');
  doc.dispatch('keydown', key(' '));
  doc.dispatch('keydown', key('f'));
  eq(fired, 2, '1: nothing fires while a textarea has focus');
  eq(stage.classList.contains('is-fullscreen'), false, '1: and F did not toggle the stage either');
  doc.activeElement = null;
  doc.dispatch('keydown', key('x'));
  eq(fired, 2, '1: an unmapped key does nothing');
}

/* ── 2. real fullscreen: enter, relabel, exit, the change event ──────── */
{
  const { Stage, doc, el } = makeDom();
  const stage = el('div', 'stage'); doc.body.appendChild(stage);
  const btn = el('button');
  const changes = [];
  const h = Stage.mount(stage, { button: btn, onChange: (on, info) => changes.push([on, info.fallback]) });
  eq(btn.textContent, 'Fullscreen', '2: the toggle button is labelled at mount');
  eq(h.isActive(), false, '2: not active yet');
  await h.enter();
  eq(doc.fullscreenElement, stage, '2: enter() asks the browser for fullscreen on the element');
  eq(h.isActive(), true, '2: and is active once granted');
  eq(h.isFallback(), false, '2: not a fallback');
  eq(stage.className, 'is-fullscreen', '2: the element carries is-fullscreen (and not stage-fallback)');
  eq(btn.textContent, 'Exit fullscreen', '2: the button relabels');
  eq(doc.body.classList.contains('stage-presenting'), true, '2: body carries the presentation class');
  eq(changes, [[true, false]], '2: onChange fired once, with fallback:false');
  await h.exit();
  eq(doc.fullscreenElement, null, '2: exit() leaves fullscreen');
  eq(stage.className, '', '2: the class is gone');
  eq(btn.textContent, 'Fullscreen', '2: the label is back');
  eq(doc.body.classList.contains('stage-presenting'), false, '2: so is the body class');
  eq(changes, [[true, false], [false, false]], '2: onChange fired for the exit');

  // the browser's own exit (Escape in real fullscreen) reaches us through the change event only
  await h.enter();
  doc.fullscreenElement = null; doc.dispatch('fullscreenchange', {});
  eq(h.isActive(), false, '2: the browser exiting on its own is noticed through fullscreenchange');
  eq(btn.textContent, 'Fullscreen', '2: and the button says so');

  // the button and the F key both toggle
  btn.click(); await tick();
  eq(h.isActive(), true, '2: the button enters');
  doc.dispatch('keydown', key('f')); await tick();
  eq(h.isActive(), false, '2: F exits');
  doc.dispatch('keydown', key('F')); await tick();
  eq(h.isActive(), true, '2: Shift+F enters again');
  await h.exit();

  const enterB = el('button'), exitB = el('button');
  const h2 = Stage.mount(el('div', 'two'), { enterButton: enterB, exitButton: exitB, fullscreenKey: false });
  eq([enterB.hidden, exitB.hidden], [false, true], '2: a button pair starts with Exit hidden');
  enterB.click(); await tick();
  eq([enterB.hidden, exitB.hidden], [true, false], '2: and swaps while on stage');
  exitB.click(); await tick();
  eq([enterB.hidden, exitB.hidden], [false, true], '2: and back');
  h2.destroy();
}

/* ── 3. the fallback: refused or missing, the stage still fills the screen ─ */
for (const mode of ['refuse', 'missing']) {
  const { Stage, doc, el } = makeDom({ fullscreen: mode });
  const stage = el('div', 'stage'); doc.body.appendChild(stage);
  const changes = [];
  const h = Stage.mount(stage, { onChange: (on, info) => changes.push([on, info.fallback]) });
  await h.enter();
  eq(h.isActive(), true, `3 (${mode}): the stage is active`);
  eq(h.isFallback(), true, `3 (${mode}): as a fallback`);
  ok(stage.classList.contains('is-fullscreen') && stage.classList.contains('stage-fallback'),
    `3 (${mode}): with both classes, so one tool selector styles both cases`);
  eq(changes, [[true, true]], `3 (${mode}): onChange says fallback:true`);
  doc.dispatch('keydown', key('Escape'));
  eq(h.isActive(), false, `3 (${mode}): Escape exits the fallback — nobody else will`);
  eq(stage.className, '', `3 (${mode}): classes cleared`);
  // Escape while typing still exits: it is not a hotkey, it is the way out
  await h.enter();
  doc.activeElement = el('input');
  doc.dispatch('keydown', key('Escape'));
  eq(h.isActive(), false, `3 (${mode}): Escape works even with an input focused`);
  doc.activeElement = null;
}
{
  const { Stage, doc, el, win } = makeDom({ fullscreen: 'refuse' });
  Stage.mount(el('div', 'x'), {}); Stage.mount(el('div', 'y'), {});
  const style = doc.head.children.find(c => c.tagName === 'STYLE');
  eq(doc.head.children.filter(c => c.tagName === 'STYLE').length, 1, '3: one style element for two mounts');
  ok(style && /\.stage-fallback\.is-fullscreen\{position:fixed;inset:0/.test(style.textContent),
    '3: a minimal fixed-inset rule for the fallback is injected once');
  ok(win.Stage, '3: (sanity) Stage is defined');
}

/* ── 4. the HUD: inside while on stage, back home afterwards ─────────── */
{
  const { Stage, doc, el } = makeDom();
  const wrap = el('div', 'wrap'); doc.body.appendChild(wrap);
  const before = el('p', 'before'), stage = el('div', 'stage'), hud = el('div', 'hud'), after = el('p', 'after');
  wrap.appendChild(before); wrap.appendChild(stage); wrap.appendChild(hud); wrap.appendChild(after);
  const inside = el('div', 'inside'); stage.appendChild(inside);
  const h = Stage.mount(stage, { hud: [hud, inside] });
  await h.enter();
  eq(hud.parentNode, stage, '4: a HUD element outside the stage is moved inside while on stage');
  eq(stage.children.map(c => c.id), ['inside', 'hud'], '4: appended after what was already there');
  eq(wrap.children.map(c => c.id), ['before', 'stage', 'after'], '4: and gone from its old place');
  await h.exit();
  eq(wrap.children.map(c => c.id), ['before', 'stage', 'hud', 'after'], '4: back in its exact old position afterwards');
  eq(inside.parentNode, stage, '4: a HUD element that was already inside is left alone');
  // a single element, not an array, also works
  const h2 = Stage.mount(el('div', 's2'), { hud: hud });
  await h2.enter();
  eq(hud.parentNode.id, 's2', '4: hud may be a single element');
  await h2.exit();
  eq(wrap.children.map(c => c.id), ['before', 'stage', 'hud', 'after'], '4: and still goes home');
}

/* ── 5. one stage at a time, enabled(), hotkeysWhenActive ────────────── */
{
  const { Stage, doc, el } = makeDom();
  const a = el('div', 'a'), b = el('div', 'b');
  doc.body.appendChild(a); doc.body.appendChild(b);
  let tab = 'bank';
  let aFired = 0, bFired = 0;
  const ha = Stage.mount(a, { enabled: () => tab === 'bank', hotkeys: { ' ': () => aFired++ } });
  const hb = Stage.mount(b, { enabled: () => tab === 'discussion', hotkeys: { ' ': () => bFired++ }, hotkeysWhenActive: true });
  doc.dispatch('keydown', key('f')); await tick();
  eq([ha.isActive(), hb.isActive()], [true, false], '5: F goes to the mount whose enabled() is true');
  ok(Stage.active() === ha, '5: Stage.active() is that one');
  tab = 'discussion';
  doc.dispatch('keydown', key('f')); await tick();
  eq([ha.isActive(), hb.isActive()], [false, true], '5: switching tabs, F enters the other — and the first is exited: one stage at a time');
  eq(doc.fullscreenElement, b, '5: the browser is on the second element');
  doc.dispatch('keydown', key(' '));
  eq([aFired, bFired], [0, 1], '5: Space reaches only the enabled mount');
  await hb.exit();
  doc.dispatch('keydown', key(' '));
  eq(bFired, 1, '5: hotkeysWhenActive: nothing off stage');
  tab = 'bank';
  doc.dispatch('keydown', key(' '));
  eq(aFired, 1, '5: the default (always) fires off stage');
  ok(Stage.active() === null, '5: nothing active');
  ha.destroy(); hb.destroy();
  doc.dispatch('keydown', key(' '));
  eq([aFired, bFired], [1, 1], '5: destroyed mounts hear nothing');
}

/* ── 6. a mount over an element already fullscreen picks that up ─────── */
{
  const { Stage, doc, el } = makeDom();
  const s = el('div', 's'); doc.fullscreenElement = s;
  const h = Stage.mount(s, {});
  eq(h.isActive(), true, '6: mounting over the current fullscreen element starts active');
  let msg = '';
  try { Stage.mount(null, {}); } catch (e) { msg = e.message; }
  ok(/needs an element/.test(msg), '6: a missing element is a loud mistake');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { console.log('Failures:\n  ' + fails.join('\n  ')); process.exit(1); }
