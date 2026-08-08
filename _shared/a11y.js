// Sitewide accessibility widget — text size, theme (dark/high-contrast),
// dyslexia-friendly font, and read-aloud (browser SpeechSynthesis, no
// server). One shared localStorage key across every tool that loads this.
//
// Supersedes the older _shared/theme-toggle.js + theme.css light/dark-only
// toggle (rather than shipping a second, parallel theme system): this file
// is now the single place that reads/writes theme state. Pages that already
// ship their own `[data-theme="dark"]` CSS should set
// `window.A11Y_NATIVE_THEME = true` in an inline <script> BEFORE loading
// this file, so dark mode uses that native styling instead of the generic
// CSS-filter fallback in a11y.css.
//
// Optional: mark an element `data-a11y-read` to make it the read-aloud
// target instead of the whole page (useful for a big display prompt/word).
(function () {
  'use strict';

  var KEY = 'gvb-a11y-prefs';
  var OLD_THEME_KEY = 'gvb-tools-theme'; // old theme-toggle.js key, migrated once
  var SCALE_STEPS = [87.5, 100, 112.5, 125, 137.5, 150];
  var DEFAULTS = { theme: 'light', textScale: 100, dyslexic: false };

  function loadPrefs() {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (stored && typeof stored === 'object') {
      return {
        theme: stored.theme === 'dark' ? 'dark' : 'light',
        textScale: SCALE_STEPS.indexOf(stored.textScale) > -1 ? stored.textScale : 100,
        dyslexic: !!stored.dyslexic,
      };
    }
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
    root.setAttribute('data-theme', prefs.theme);
    if (prefs.theme === 'dark' && !window.A11Y_NATIVE_THEME) {
      root.classList.add('a11y-filter-dark');
    } else {
      root.classList.remove('a11y-filter-dark');
    }
    root.style.fontSize = prefs.textScale + '%';
    root.classList.toggle('a11y-dyslexic', prefs.dyslexic);
  }

  apply(); // run immediately, before DOM/panel exist, to avoid a flash of unstyled content

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
      setTheme(prefs.theme === 'dark' ? 'light' : 'dark');
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

    // keep read-aloud buttons in sync even when speech ends on its own
    if (speechSupported) setInterval(syncControls, 400);
  }

  function syncControls() {
    if (!panel) return;
    scaleValueEl.textContent = prefs.textScale + '%';
    scaleDownBtn.disabled = prefs.textScale === SCALE_STEPS[0];
    scaleUpBtn.disabled = prefs.textScale === SCALE_STEPS[SCALE_STEPS.length - 1];

    var dark = prefs.theme === 'dark';
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

  function init() {
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // keep in sync across tabs/tools sharing the same key
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) {
      try { prefs = JSON.parse(e.newValue); } catch (err) { return; }
      apply();
      syncControls();
    }
  });
})();
