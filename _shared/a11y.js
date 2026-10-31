// Sitewide accessibility widget — text size, theme (dark/high-contrast),
// dyslexia-friendly font, and read-aloud (browser SpeechSynthesis, no
// server). One shared localStorage key across every tool that loads this.
//
// Supersedes the older _shared/theme-toggle.js + theme.css light/dark-only
// toggle (rather than shipping a second, parallel theme system): this file
// is now the single place that reads/writes theme state, and Path 5 P1 made
// that ownership the site's decision rather than an accident — theme-toggle.js
// was deleted, and the `gvb-tools-theme` key it wrote is migrated below.
// Pages that ship their own `[data-theme="dark"]` CSS should set
// `window.A11Y_NATIVE_THEME = true` in an inline <script> BEFORE loading
// this file, so dark mode uses that native styling instead of the generic
// CSS-filter fallback in a11y.css. _shared/ink-paper.css now supplies that
// native styling to the 74 tools on the ink/paper palette; its header carries
// the decision in full, including what a tool must fix before opting in.
//
// Theme has three stored states, not two. 'auto' — the default for anyone who
// has never touched the control — follows the operating system's
// prefers-color-scheme, live, so a teacher whose laptop is already dark gets a
// dark toolkit on first visit and nothing is written to storage. 'light' and
// 'dark' are explicit choices and stick. The widget stays a two-state switch:
// clicking it from 'auto' commits the opposite of whatever the OS is
// currently saying, and Reset puts it back to 'auto'.
//
// Optional: mark an element `data-a11y-read` to make it the read-aloud
// target instead of the whole page (useful for a big display prompt/word).
(function () {
  'use strict';

  var KEY = 'gvb-a11y-prefs';
  var OLD_THEME_KEY = 'gvb-tools-theme'; // old theme-toggle.js key, migrated once
  var SCALE_STEPS = [87.5, 100, 112.5, 125, 137.5, 150];
  var DEFAULTS = { theme: 'auto', textScale: 100, dyslexic: false };
  var DARK_QUERY = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /** The theme actually painted: 'auto' asks the OS, everything else is literal. */
  function resolvedTheme() {
    if (prefs.theme !== 'auto') return prefs.theme;
    return DARK_QUERY && DARK_QUERY.matches ? 'dark' : 'light';
  }

  function normalize(stored) {
    return {
      theme: stored.theme === 'dark' || stored.theme === 'light' ? stored.theme : 'auto',
      textScale: SCALE_STEPS.indexOf(stored.textScale) > -1 ? stored.textScale : 100,
      dyslexic: !!stored.dyslexic,
    };
  }

  function loadPrefs() {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    // An existing user's stored prefs always name a literal theme, because
    // the pre-Path-5 defaults wrote 'light' whenever anything else was saved.
    // Those stay literal on purpose: nobody's toolkit flips to dark because
    // this shipped. Only a browser with nothing stored starts on 'auto'.
    if (stored && typeof stored === 'object') return normalize(stored);
    // one-time migration from the old theme-only key
    var migrated = Object.assign({}, DEFAULTS);
    try {
      var oldTheme = localStorage.getItem(OLD_THEME_KEY);
      if (oldTheme === 'dark') migrated.theme = 'dark';
    } catch (e) {}
    return migrated;
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  var prefs = loadPrefs();

  function apply() {
    var root = document.documentElement;
    var theme = resolvedTheme();
    root.setAttribute('data-theme', theme);
    if (theme === 'dark' && !window.A11Y_NATIVE_THEME) {
      root.classList.add('a11y-filter-dark');
    } else {
      root.classList.remove('a11y-filter-dark');
    }
    root.style.fontSize = prefs.textScale + '%';
    root.classList.toggle('a11y-dyslexic', prefs.dyslexic);
  }

  apply(); // run immediately, before DOM/panel exist, to avoid a flash of unstyled content

  /* === brand === (Track B1, 2026-10-30; the widget half is further down)
     A school accent for the whole site, from one optional key. With no key
     there is no <style> element, nothing is written, and the page is exactly
     what it was. The colours go in a <style> and not on <html>'s inline style
     so that they apply to the screen only (a sheet is the same on paper with
     or without a brand) and so that removing the element is the whole reset.
     This runs before first paint and must never throw: a corrupt value, an
     old shape or a blocked localStorage all end in "no brand". No logo, by
     Devon's answer of 2026-10-21. Set window.BRAND_OPT_OUT = true before this
     file to keep a page's own palette (007 does). */
  var BRAND_KEY = 'gvb-brand:settings.v1';
  var BRAND_STOCK = '#1f3550';          // ink-paper.css's --accent-light
  var BRAND_PAPER = ['#fafaf8', '#ffffff']; // what an accent is read on, light theme
  var BRAND_DARK_PAPER = '#14171c';     // ink-paper.css's dark --paper
  var STEP_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  var STEP_RAMP = [0.96, 0.92, 0.85, 0.76, 0.66, 0.56, 0.49, 0.42, 0.34, 0.26];
  var brand = null;                     // { accent, accent2 } or null; accent2 '' = derive
  var brandListeners = [];
  var brandStyle = null;

  function hexToHsl(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255,
        b = parseInt(hex.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, s = 0, h = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, hp = (((h % 360) + 360) % 360) / 60;
    var x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c / 2, rgb = [0, 0, 0];
    if (hp < 1) rgb = [c, x, 0]; else if (hp < 2) rgb = [x, c, 0]; else if (hp < 3) rgb = [0, c, x];
    else if (hp < 4) rgb = [0, x, c]; else if (hp < 5) rgb = [x, 0, c]; else rgb = [c, 0, x];
    return '#' + rgb.map(function (v) {
      var n = Math.round((v + m) * 255);
      return (n < 16 ? '0' : '') + Math.max(0, Math.min(255, n)).toString(16);
    }).join('');
  }
  function luminance(hex) {
    return [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** The second colour when the teacher has not chosen one: a step lighter, or darker for a light accent. */
  function deriveAccent2(accent) {
    var c = hexToHsl(accent);
    return hslToHex(c[0], c[1] * 0.9, clamp(c[2] + (c[2] < 0.5 ? 0.14 : -0.14), 0.08, 0.92));
  }
  /** The accent made readable on the dark paper: lifted until it clears 4.5:1, never darkened. */
  function liftForDark(hex) {
    var c = hexToHsl(hex), l = c[2], out = hex;
    while (contrast(out, BRAND_DARK_PAPER) < 4.5 && l < 0.95) { l += 0.02; out = hslToHex(c[0], c[1], l); }
    return out;
  }
  function inkOn(hex) { return contrast(hex, '#ffffff') >= contrast(hex, '#101720') ? '#ffffff' : '#101720'; }

  /** The Industry tools' ten-step scale, approximated round the chosen colour (no second palette file). */
  function steps(prefix, hex) {
    var c = hexToHsl(hex), css = '';
    for (var i = 0; i < STEP_NAMES.length; i++) {
      var tint = i < 3 ? 0.6 : 1;
      var v = STEP_NAMES[i] === 600 ? hex : hslToHex(c[0], c[1] * tint, clamp(STEP_RAMP[i] + (c[2] - 0.49) * 0.5, 0.05, 0.97));
      css += '--color-' + prefix + '-' + STEP_NAMES[i] + ':' + v + ';';
    }
    return css;
  }

  /** A stored or incoming value, or null. Anything but a v1 record with a #rrggbb accent is ignored, not repaired. */
  function cleanBrand(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    var hex = /^#[0-9a-fA-F]{6}$/;
    if (typeof raw.accent !== 'string' || !hex.test(raw.accent)) return null;
    return {
      accent: raw.accent.toLowerCase(),
      accent2: typeof raw.accent2 === 'string' && hex.test(raw.accent2) ? raw.accent2.toLowerCase() : ''
    };
  }
  function loadBrand() {
    try { return cleanBrand(JSON.parse(localStorage.getItem(BRAND_KEY))); } catch (e) { return null; }
  }

  function brandCss(b) {
    var a2 = b.accent2 || deriveAccent2(b.accent);
    var da = liftForDark(b.accent), da2 = liftForDark(a2);
    return '@media screen{html:root:root{--accent:' + b.accent + ';--accent-2:' + a2 + ';--accent-ink:' + inkOn(b.accent) + ';' +
      steps('accent', b.accent) + steps('accent-2', a2) + '}' +
      'html:root[data-theme="dark"]:not(.a11y-filter-dark){--accent:' + da + ';--accent-2:' + da2 + ';--accent-ink:' + inkOn(da) + '}}';
  }

  function applyBrand() {
    try {
      var on = brand && !window.BRAND_OPT_OUT;
      if (!on) {
        if (brandStyle && brandStyle.parentNode) brandStyle.parentNode.removeChild(brandStyle);
        brandStyle = null;
        return;
      }
      if (!brandStyle) {
        brandStyle = document.createElement('style');
        brandStyle.id = 'gvb-brand-style';
        (document.head || document.documentElement).appendChild(brandStyle);
      }
      brandStyle.textContent = brandCss(brand);
    } catch (e) {}
  }
  function brandChanged() {
    applyBrand();
    for (var i = 0; i < brandListeners.length; i++) { try { brandListeners[i](window.Brand.get()); } catch (e) {} }
    if (typeof syncBrandControls === 'function') syncBrandControls();
  }

  brand = loadBrand();
  applyBrand(); // before first paint, with the saved theme

  window.Brand = {
    /** The saved brand as { accent, accent2 } (accent2 is the derived colour when none was chosen), or null. */
    get: function () {
      return brand ? { accent: brand.accent, accent2: brand.accent2 || deriveAccent2(brand.accent), custom2: !!brand.accent2 } : null;
    },
    /** Saves and applies { accent, accent2? }. false if the accent is not #rrggbb or the browser would not store it (it still shows until reload). */
    set: function (s) {
      var next = cleanBrand({ v: 1, accent: s && s.accent, accent2: s && s.accent2 });
      if (!next) return false;
      brand = next;
      var saved = true;
      try {
        var rec = { v: 1, accent: next.accent, updatedAt: new Date().toISOString() };
        if (next.accent2) rec.accent2 = next.accent2;
        localStorage.setItem(BRAND_KEY, JSON.stringify(rec));
      } catch (e) { saved = false; }
      brandChanged();
      return saved;
    },
    /** Removes the key and the colours live, no reload. */
    reset: function () {
      brand = null;
      try { localStorage.removeItem(BRAND_KEY); } catch (e) {}
      brandChanged();
    },
    onChange: function (fn) { if (typeof fn === 'function') brandListeners.push(fn); },
    derive: deriveAccent2,
    /** Contrast of an accent read as text on the light paper and white: the worse of the two. */
    contrast: function (hex) { return Math.min(contrast(hex, BRAND_PAPER[0]), contrast(hex, BRAND_PAPER[1])); },
    STOCK: BRAND_STOCK
  };
  /* === end brand === */

  function setTheme(theme) { prefs.theme = theme; savePrefs(prefs); apply(); syncControls(); }
  function setScale(scale) { prefs.textScale = scale; savePrefs(prefs); apply(); syncControls(); }
  function setDyslexic(on) { prefs.dyslexic = on; savePrefs(prefs); apply(); syncControls(); }

  /* ---------- read-aloud ---------- */
  var speechSupported = 'speechSynthesis' in window;
  var utterance = null;

  function getReadText() {
    var target = document.querySelector('[data-a11y-read]') || document.body;
    var text = target.innerText || target.textContent || '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 20000);
  }

  function readState() {
    if (!speechSupported) return 'unsupported';
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) return 'speaking';
    if (window.speechSynthesis.paused) return 'paused';
    return 'idle';
  }

  function readToggle() {
    if (!speechSupported) return;
    var state = readState();
    if (state === 'idle') {
      window.speechSynthesis.cancel();
      utterance = new SpeechSynthesisUtterance(getReadText());
      utterance.onend = syncControls;
      utterance.onerror = syncControls;
      window.speechSynthesis.speak(utterance);
    } else if (state === 'speaking') {
      window.speechSynthesis.pause();
    } else if (state === 'paused') {
      window.speechSynthesis.resume();
    }
    setTimeout(syncControls, 30);
  }

  function readStop() {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setTimeout(syncControls, 30);
  }

  /* ---------- widget markup ---------- */
  var wrap, panel, toggleBtn, playBtn, stopBtn, dyslexicBtn, themeBtn, scaleValueEl;
  var scaleDownBtn, scaleUpBtn;
  var brandAccentIn, brandAuto, brandAccent2In, brandResetBtn, brandWarnEl;

  function buildWidget() {
    wrap = document.createElement('div');
    wrap.className = 'a11y-widget';

    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'a11y-toggle';
    toggleBtn.setAttribute('aria-haspopup', 'dialog');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Accessibility settings');
    toggleBtn.textContent = 'Aa';

    panel = document.createElement('div');
    panel.className = 'a11y-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Accessibility settings');

    var heading = document.createElement('h2');
    heading.textContent = 'Accessibility';
    panel.appendChild(heading);

    // text size row
    var scaleRow = document.createElement('div');
    scaleRow.className = 'a11y-row';
    var scaleLabel = document.createElement('span');
    scaleLabel.className = 'a11y-label';
    scaleLabel.textContent = 'Text size';
    var scaleGroup = document.createElement('div');
    scaleGroup.className = 'a11y-btn-group';
    scaleDownBtn = document.createElement('button');
    scaleDownBtn.type = 'button'; scaleDownBtn.className = 'a11y-btn'; scaleDownBtn.textContent = 'A−';
    scaleDownBtn.setAttribute('aria-label', 'Decrease text size');
    scaleValueEl = document.createElement('span');
    scaleValueEl.className = 'a11y-scale-value';
    scaleUpBtn = document.createElement('button');
    scaleUpBtn.type = 'button'; scaleUpBtn.className = 'a11y-btn'; scaleUpBtn.textContent = 'A+';
    scaleUpBtn.setAttribute('aria-label', 'Increase text size');
    scaleGroup.appendChild(scaleDownBtn);
    scaleGroup.appendChild(scaleValueEl);
    scaleGroup.appendChild(scaleUpBtn);
    scaleRow.appendChild(scaleLabel);
    scaleRow.appendChild(scaleGroup);
    panel.appendChild(scaleRow);

    // theme row
    var themeRow = document.createElement('div');
    themeRow.className = 'a11y-row';
    var themeLabel = document.createElement('span');
    themeLabel.className = 'a11y-label';
    themeLabel.textContent = 'Dark theme';
    themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'a11y-btn';
    themeBtn.setAttribute('role', 'switch');
    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeBtn);
    panel.appendChild(themeRow);

    // dyslexia-friendly font row
    var dyslexicRow = document.createElement('div');
    dyslexicRow.className = 'a11y-row';
    var dyslexicLabel = document.createElement('span');
    dyslexicLabel.className = 'a11y-label';
    dyslexicLabel.textContent = 'Dyslexia-friendly font';
    dyslexicBtn = document.createElement('button');
    dyslexicBtn.type = 'button';
    dyslexicBtn.className = 'a11y-btn';
    dyslexicBtn.setAttribute('role', 'switch');
    dyslexicRow.appendChild(dyslexicLabel);
    dyslexicRow.appendChild(dyslexicBtn);
    panel.appendChild(dyslexicRow);

    // read-aloud row
    if (speechSupported) {
      var readRow = document.createElement('div');
      readRow.className = 'a11y-row';
      var readLabel = document.createElement('span');
      readLabel.className = 'a11y-label';
      readLabel.textContent = 'Read aloud';
      var readGroup = document.createElement('div');
      readGroup.className = 'a11y-btn-group';
      playBtn = document.createElement('button');
      playBtn.type = 'button'; playBtn.className = 'a11y-btn';
      stopBtn = document.createElement('button');
      stopBtn.type = 'button'; stopBtn.className = 'a11y-btn'; stopBtn.textContent = 'Stop';
      readGroup.appendChild(playBtn);
      readGroup.appendChild(stopBtn);
      readRow.appendChild(readLabel);
      readRow.appendChild(readGroup);
      panel.appendChild(readRow);

      playBtn.addEventListener('click', readToggle);
      stopBtn.addEventListener('click', readStop);
    }

    // school branding (Track B2): one accent, a second colour that follows it unless chosen
    var brandBox = document.createElement('div');
    brandBox.className = 'a11y-brand';
    brandBox.setAttribute('role', 'group');
    brandBox.setAttribute('aria-labelledby', 'a11y-brand-h');
    var brandHead = document.createElement('h3');
    brandHead.id = 'a11y-brand-h';
    brandHead.textContent = 'School branding';
    brandBox.appendChild(brandHead);
    function brandRow(id, text, input) {
      var row = document.createElement('div');
      row.className = 'a11y-row';
      var lab = document.createElement('label');
      lab.className = 'a11y-label';
      lab.htmlFor = id;
      lab.textContent = text;
      input.id = id;
      input.type = 'color';
      input.className = 'a11y-color';
      row.appendChild(lab);
      row.appendChild(input);
      brandBox.appendChild(row);
    }
    brandAccentIn = document.createElement('input');
    brandRow('a11y-brand-accent', 'School colour', brandAccentIn);
    brandAccent2In = document.createElement('input');
    brandRow('a11y-brand-accent2', 'Second colour', brandAccent2In);
    var autoRow = document.createElement('div');
    autoRow.className = 'a11y-row';
    var autoLab = document.createElement('label');
    autoLab.className = 'a11y-label';
    autoLab.htmlFor = 'a11y-brand-auto';
    autoLab.textContent = 'Pick the second colour for me';
    brandAuto = document.createElement('input');
    brandAuto.type = 'checkbox';
    brandAuto.id = 'a11y-brand-auto';
    autoRow.appendChild(autoLab);
    autoRow.appendChild(brandAuto);
    brandBox.appendChild(autoRow);
    brandWarnEl = document.createElement('p');
    brandWarnEl.className = 'a11y-brand-warn';
    brandWarnEl.setAttribute('role', 'status');
    brandBox.appendChild(brandWarnEl);
    brandResetBtn = document.createElement('button');
    brandResetBtn.type = 'button';
    brandResetBtn.className = 'a11y-btn a11y-brand-reset';
    brandResetBtn.textContent = 'Reset school colours';
    brandBox.appendChild(brandResetBtn);
    if (window.BRAND_OPT_OUT) {
      var optNote = document.createElement('p');
      optNote.className = 'a11y-brand-note';
      optNote.textContent = 'This tool keeps its own colours.';
      brandBox.appendChild(optNote);
    }
    panel.appendChild(brandBox);

    function brandFromControls() {
      return { accent: brandAccentIn.value, accent2: brandAuto.checked ? '' : brandAccent2In.value };
    }
    function brandSave() {
      var ok = window.Brand.set(brandFromControls());
      if (!ok && brandWarnEl) brandWarnEl.textContent = 'Your browser would not save this colour; it will show until you leave the page.';
    }
    brandAccentIn.addEventListener('input', brandSave);
    brandAccent2In.addEventListener('input', brandSave);
    brandAuto.addEventListener('change', function () {
      if (!brandAuto.checked) brandAccent2In.value = window.Brand.derive(brandAccentIn.value);
      brandSave();
    });
    brandResetBtn.addEventListener('click', function () { window.Brand.reset(); });

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'a11y-reset';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', function () {
      prefs = Object.assign({}, DEFAULTS);
      savePrefs(prefs);
      apply();
      syncControls();
    });
    panel.appendChild(resetBtn);

    scaleDownBtn.addEventListener('click', function () {
      var i = SCALE_STEPS.indexOf(prefs.textScale);
      if (i > 0) setScale(SCALE_STEPS[i - 1]);
    });
    scaleUpBtn.addEventListener('click', function () {
      var i = SCALE_STEPS.indexOf(prefs.textScale);
      if (i > -1 && i < SCALE_STEPS.length - 1) setScale(SCALE_STEPS[i + 1]);
    });
    themeBtn.addEventListener('click', function () {
      // From 'auto' this commits a literal opposite of what is on screen, so
      // one click always visibly flips the page.
      setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
    });
    dyslexicBtn.addEventListener('click', function () {
      setDyslexic(!prefs.dyslexic);
    });

    toggleBtn.addEventListener('click', function () {
      var open = !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var focusTarget = scaleDownBtn;
        focusTarget.focus();
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('click', onOutsideClick, true);
      }
    });

    function closePanel() {
      panel.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onOutsideClick, true);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') { closePanel(); toggleBtn.focus(); }
    }
    function onOutsideClick(e) {
      if (!wrap.contains(e.target)) closePanel();
    }

    wrap.appendChild(panel);
    wrap.appendChild(toggleBtn);
    document.body.appendChild(wrap);

    syncControls();
    syncBrandControls();

    // keep read-aloud buttons in sync even when speech ends on its own
    if (speechSupported) setInterval(syncControls, 400);
  }

  function syncControls() {
    if (!panel) return;
    scaleValueEl.textContent = prefs.textScale + '%';
    scaleDownBtn.disabled = prefs.textScale === SCALE_STEPS[0];
    scaleUpBtn.disabled = prefs.textScale === SCALE_STEPS[SCALE_STEPS.length - 1];

    var dark = resolvedTheme() === 'dark';
    themeBtn.textContent = dark ? 'On' : 'Off';
    themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    themeBtn.setAttribute('aria-checked', dark ? 'true' : 'false');

    dyslexicBtn.textContent = prefs.dyslexic ? 'On' : 'Off';
    dyslexicBtn.setAttribute('aria-pressed', prefs.dyslexic ? 'true' : 'false');
    dyslexicBtn.setAttribute('aria-checked', prefs.dyslexic ? 'true' : 'false');

    if (speechSupported && playBtn) {
      var state = readState();
      playBtn.textContent = state === 'speaking' ? 'Pause' : (state === 'paused' ? 'Resume' : 'Read');
      stopBtn.disabled = state === 'idle';
    }
  }

  function syncBrandControls() {
    if (!brandAccentIn) return;
    var b = window.Brand.get();
    var accent = b ? b.accent : BRAND_STOCK;
    brandAccentIn.value = accent;
    brandAuto.checked = !b || !b.custom2;
    brandAccent2In.value = b ? b.accent2 : window.Brand.derive(BRAND_STOCK);
    brandAccent2In.disabled = brandAuto.checked;
    brandResetBtn.disabled = !b;
    var ratio = window.Brand.contrast(accent);
    brandWarnEl.textContent = b && ratio < 4.5
      ? 'Heads up: ' + accent + ' is a pale choice on a white page (contrast ' + ratio.toFixed(1) +
        ' to 1; 4.5 to 1 is easy to read). Links and buttons in it may be hard to read. You can still keep it.'
      : '';
  }

  function init() {
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // follow the OS live, but only while the user has not made a choice
  if (DARK_QUERY) {
    var onSystemTheme = function () { if (prefs.theme === 'auto') { apply(); syncControls(); } };
    if (DARK_QUERY.addEventListener) DARK_QUERY.addEventListener('change', onSystemTheme);
    else if (DARK_QUERY.addListener) DARK_QUERY.addListener(onSystemTheme); // Safari < 14
  }

  // keep in sync across tabs/tools sharing the same key
  window.addEventListener('storage', function (e) {
    if (e.key === BRAND_KEY || e.key === null) { // another tab set, reset or (key null) cleared the brand
      var seen = loadBrand();
      if (JSON.stringify(seen) !== JSON.stringify(brand)) { brand = seen; brandChanged(); }
    }
    if (e.key === KEY && e.newValue) {
      var incoming;
      try { incoming = JSON.parse(e.newValue); } catch (err) { return; }
      if (!incoming || typeof incoming !== 'object') return;
      prefs = normalize(incoming);
      apply();
      syncControls();
    }
  });
})();
