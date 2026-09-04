/* stage.js — one fullscreen / projector helper. Path 5 P2. `window.Stage`.

   Eight projector-first tools each hand-rolled the same thing: a button
   that calls requestFullscreen on a container, a fullscreenchange listener
   that relabels it, an F hotkey guarded by "is the teacher typing?", and —
   rediscovered four times in the platform notes — the wrinkle that the
   Fullscreen API renders ONLY the fullscreened subtree, so a control that
   lives outside it vanishes the moment the teacher goes fullscreen. They
   disagreed about the fallback (024 simulates fullscreen with a class when
   the API is missing or refuses; the others do nothing), about Escape
   (the browser handles it in real fullscreen, nobody handles it in the
   fallback), and about whether hotkeys work outside fullscreen.

       var stage = Stage.mount(el, {
         button:        one toggle button, relabelled as state changes
         enterButton,   …or a pair, shown/hidden with `hidden`
         exitButton,
         labels:        { enter: 'Fullscreen', exit: 'Exit fullscreen' }
         hotkeys:       { ' ': fn, n: fn, ArrowRight: fn } — fn(event), only
                        when the teacher is not typing and no modifier is down
         hotkeysWhenActive: true — the map applies only while on stage
                        (default false: always)
         fullscreenKey: 'f' (default) or false
         enabled:       () => bool — gates every key of this mount (a page
                        with two stages on two tabs passes the tab check)
         hud:           element or [elements] moved INSIDE el while on stage
                        and put back after — the answer key, the next/prev
                        row, a timer: whatever must stay visible
         presentation:  'stage-presenting' (default) — a class on <body>
                        while any stage is active, for chrome-hiding CSS;
                        false for none
         onChange:      fn(active, { fallback })
       });
       stage.enter(); stage.exit(); stage.toggle(); stage.isActive(); stage.destroy();

   While active, `el` carries class `is-fullscreen` whether the browser
   granted real fullscreen or the helper fell back to a fixed-position
   overlay (class `stage-fallback` too, in that case), so a tool styles ONE
   selector — `#stageArea.is-fullscreen` — instead of the three (`:fullscreen`,
   `:-webkit-full-screen`, `.is-fullscreen`) 024 carried. The fallback gets a
   minimal fixed-inset rule from here, at low specificity, so a tool's own
   `.is-fullscreen` rule wins.

   Hotkeys. The site-standard guard: nothing fires while focus is in an
   input, textarea, select or contenteditable, or with Ctrl/Meta/Alt down.
   `f` toggles the stage; Escape exits the fallback (real fullscreen's
   Escape is the browser's, and the change event tells us). Only one stage
   is active at a time: entering one exits another.

   Plain global script; see state-link.js for why not an ES module. */
(function (global) {
  'use strict';

  var doc = global.document;
  var STYLE_ID = 'stage-style';
  var PRESENT_CLASS = 'stage-presenting';
  var mounts = [];
  var active = null;
  var listening = false;

  /* ── pure guards, exported for the suite and for tools ───────────── */

  /** True when `el` (document.activeElement) would swallow a typed key. */
  function isTyping(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** True when a keydown should reach a stage hotkey at all. */
  function shouldHandleKey(e, activeEl) {
    if (!e || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.defaultPrevented) return false;
    return !isTyping(activeEl);
  }

  /* ── fullscreen plumbing ─────────────────────────────────────────── */

  function fsElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || null;
  }

  function requestFs(el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return Promise.reject(new Error('no Fullscreen API'));
    try {
      var r = fn.call(el);
      return r && typeof r.then === 'function' ? r : Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function exitFs() {
    var fn = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (!fn || !fsElement()) return Promise.resolve();
    try {
      var r = fn.call(doc);
      return r && typeof r.then === 'function' ? r.catch(function () {}) : Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  }

  function ensureStyle() {
    if (!doc.head || doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.stage-fallback.is-fullscreen{position:fixed;inset:0;z-index:2147482000;margin:0;overflow:auto;' +
      'background:var(--paper,#fff);color:var(--ink,#1f2430)}';
    doc.head.appendChild(st);
  }

  /* ── the mount ───────────────────────────────────────────────────── */

  function mount(el, opts) {
    if (!el) throw new Error('Stage.mount needs an element');
    opts = opts || {};
    ensureStyle();

    var labels = Object.assign({ enter: 'Fullscreen', exit: 'Exit fullscreen' }, opts.labels || {});
    var hotkeys = opts.hotkeys || {};
    var fsKey = opts.fullscreenKey === undefined ? 'f' : opts.fullscreenKey;
    var presentation = opts.presentation === undefined ? PRESENT_CLASS : opts.presentation;
    var hud = [].concat(opts.hud || []).filter(Boolean);
    var hudHomes = [];
    var m = {
      el: el,
      opts: opts,
      fallback: false,
      isOn: false,
      enabled: function () { return typeof opts.enabled === 'function' ? !!opts.enabled() : true; }
    };

    function render() {
      el.classList.toggle('is-fullscreen', m.isOn);
      el.classList.toggle('stage-fallback', m.isOn && m.fallback);
      if (opts.button) opts.button.textContent = m.isOn ? labels.exit : labels.enter;
      if (opts.enterButton) opts.enterButton.hidden = m.isOn;
      if (opts.exitButton) opts.exitButton.hidden = !m.isOn;
      if (presentation && doc.body) doc.body.classList.toggle(presentation, !!active);
    }

    function moveHudIn() {
      hudHomes = hud.map(function (h) {
        var home = { parent: h.parentNode, next: h.nextSibling };
        if (h.parentNode !== el && !el.contains(h)) el.appendChild(h);
        return home;
      });
    }
    function moveHudBack() {
      hud.forEach(function (h, i) {
        var home = hudHomes[i];
        if (!home || !home.parent || home.parent === el || el.contains(home.parent)) return;
        if (home.next && home.next.parentNode === home.parent) home.parent.insertBefore(h, home.next);
        else home.parent.appendChild(h);
      });
      hudHomes = [];
    }

    function setOn(on, fallback) {
      if (on === m.isOn && (!on || fallback === m.fallback)) return;
      if (on) {
        if (active && active !== m) active._setOn(false);
        active = m;
        m.fallback = !!fallback;
        m.isOn = true;
        moveHudIn();
      } else {
        m.isOn = false;
        m.fallback = false;
        if (active === m) active = null;
        moveHudBack();
      }
      render();
      if (opts.onChange) opts.onChange(m.isOn, { fallback: m.fallback });
    }
    m._setOn = setOn;

    function enter() {
      if (m.isOn) return Promise.resolve();
      var other = fsElement();
      var start = other ? exitFs() : Promise.resolve();
      return start.then(function () {
        return requestFs(el).then(function () {
          // fullscreenchange usually fires first; this covers a browser that resolves early
          if (fsElement() === el) setOn(true, false);
        }, function () {
          setOn(true, true);
        });
      });
    }
    function exit() {
      if (!m.isOn) return Promise.resolve();
      if (m.fallback) { setOn(false); return Promise.resolve(); }
      return exitFs().then(function () { if (fsElement() !== el) setOn(false); });
    }
    function toggle() { return m.isOn ? exit() : enter(); }

    m.onFsChange = function () {
      var cur = fsElement();
      if (cur === el) setOn(true, false);
      else if (m.isOn && !m.fallback) setOn(false);
    };

    m.onKey = function (e) {
      if (!m.enabled()) return false;
      if (e.key === 'Escape' && m.isOn && m.fallback) { e.preventDefault(); exit(); return true; }
      if (!shouldHandleKey(e, doc.activeElement)) return false;
      var key = e.key;
      if (fsKey && key.length === 1 && key.toLowerCase() === String(fsKey).toLowerCase()) {
        e.preventDefault();
        toggle();
        return true;
      }
      if (opts.hotkeysWhenActive && !m.isOn) return false;
      var fn = Object.prototype.hasOwnProperty.call(hotkeys, key) ? hotkeys[key]
        : (key.length === 1 && Object.prototype.hasOwnProperty.call(hotkeys, key.toLowerCase()) ? hotkeys[key.toLowerCase()] : null);
      if (typeof fn !== 'function') return false;
      e.preventDefault();
      fn(e);
      return true;
    };

    function onBtn(e) { e.preventDefault(); toggle(); }
    function onEnterBtn(e) { e.preventDefault(); enter(); }
    function onExitBtn(e) { e.preventDefault(); exit(); }
    if (opts.button) opts.button.addEventListener('click', onBtn);
    if (opts.enterButton) opts.enterButton.addEventListener('click', onEnterBtn);
    if (opts.exitButton) opts.exitButton.addEventListener('click', onExitBtn);

    mounts.push(m);
    listen();
    render();
    if (fsElement() === el) setOn(true, false);

    var handle = {
      el: el,
      enter: enter,
      exit: exit,
      toggle: toggle,
      isActive: function () { return m.isOn; },
      isFallback: function () { return m.isOn && m.fallback; },
      destroy: function () {
        if (m.isOn) setOn(false);
        if (opts.button) opts.button.removeEventListener('click', onBtn);
        if (opts.enterButton) opts.enterButton.removeEventListener('click', onEnterBtn);
        if (opts.exitButton) opts.exitButton.removeEventListener('click', onExitBtn);
        var i = mounts.indexOf(m);
        if (i !== -1) mounts.splice(i, 1);
        el.classList.remove('is-fullscreen', 'stage-fallback');
      }
    };
    m.handle = handle;
    return handle;
  }

  /* one document listener for every mount, in mount order */
  function onFsChange() { mounts.slice().forEach(function (m) { m.onFsChange(); }); }
  function onKeydown(e) {
    var ms = mounts.slice();
    for (var i = 0; i < ms.length; i++) if (ms[i].onKey(e)) return;
  }
  function listen() {
    if (listening) return;
    listening = true;
    doc.addEventListener('fullscreenchange', onFsChange);
    doc.addEventListener('webkitfullscreenchange', onFsChange);
    doc.addEventListener('keydown', onKeydown);
  }

  global.Stage = {
    mount: mount,
    active: function () { return active ? active.handle : null; },
    isTyping: isTyping,
    shouldHandleKey: shouldHandleKey,
    PRESENT_CLASS: PRESENT_CLASS
  };
})(window);
