/* htcm-themes.js — the card design system for the Historical Trading Card
   Maker: era themes and rarity tiers, as data.

   One THEMES array feeds three consumers that must never disagree: the CSS
   this file generates into a <style> tag at load, the swatch picker the tool
   builds from the same array, and (in a later round) the canvas exporter,
   which needs the colors and fonts as JS values. That's why the styling is
   generated rather than hand-written per-theme classes.

   Print-first ground rules baked into the data:
   - every ink sits on its paper at >= 4.5:1 contrast, so B/W printing and
     photocopying keep cards legible;
   - textures are pure CSS gradients at <= ~6% alpha — faint tone on paper,
     never mud, and no binary assets to precache;
   - frames are stroke-based (see htcm-frames.js) so they print crisp;
   - rarity escalates frame *ornateness* along with foil, so the tier still
     reads on a grayscale printer.

   The last four rows are the subject packs — science, math, literature and a
   neutral vocabulary look — added so a card deck is usable in any classroom,
   not just a history one. They follow exactly the same shape as the seven era
   themes above; the only extra field is `hints`, which feeds the add-a-card
   form's placeholder text (never the card itself) so a science teacher's
   first look at the Stats box suggests atomic number rather than a birth
   year. The era themes deliberately keep no `hints` key: their placeholder is
   the tool's original one, and leaving the data alone is what guarantees
   their printed output is unchanged. */
(function (global) {
  'use strict';

  /* ink on paper >= 4.5:1 in every row — checked when a theme is added */
  var THEMES = [
    { key: 'classic', label: 'Classic', frame: 'plain', texture: null,
      font: '"Segoe UI", Georgia, "Times New Roman", serif', nameFont: null,
      ink: '#222222', paper: '#ffffff', accent: '#333333', accent2: '#666666' },
    { key: 'parchment', label: 'Antiquity', frame: 'greek-key', texture: 'parchment',
      font: 'Georgia, "Times New Roman", serif', nameFont: null,
      ink: '#3d2b1f', paper: '#f4e9d0', accent: '#8a6d1d', accent2: '#5b4636' },
    { key: 'medieval', label: 'Medieval', frame: 'filigree', texture: 'crosshatch',
      font: '"Palatino Linotype", Palatino, Georgia, serif', nameFont: null,
      ink: '#2a2118', paper: '#f5efe3', accent: '#8c2b2b', accent2: '#5a3e28' },
    { key: 'renaissance', label: 'Renaissance', frame: 'laurel', texture: 'linen',
      font: 'Garamond, "Times New Roman", Georgia, serif', nameFont: null,
      ink: '#33291a', paper: '#fdfaf3', accent: '#8a6d1d', accent2: '#7a5c2e' },
    { key: 'deco', label: 'Art Deco', frame: 'deco', texture: 'sunburst',
      font: '"Century Gothic", "Trebuchet MS", "Segoe UI", sans-serif', nameFont: null,
      ink: '#1c2733', paper: '#f2f1ea', accent: '#17656d', accent2: '#8a6d1d' },
    { key: 'sport', label: 'Sport', frame: 'banner', texture: 'diagonal',
      font: '"Segoe UI", Arial, sans-serif', nameFont: '"Arial Black", "Segoe UI", Arial, sans-serif',
      ink: '#14213d', paper: '#ffffff', accent: '#b3202c', accent2: '#1f3550' },
    { key: 'scifi', label: 'Sci-fi', frame: 'pixel', texture: 'grid',
      font: '"Trebuchet MS", "Segoe UI", sans-serif', nameFont: null,
      ink: '#16232a', paper: '#eef4f6', accent: '#0e5f76', accent2: '#40545e' },

    /* ---- subject packs ---- */
    { key: 'science', label: 'Science lab', frame: 'ticks', texture: 'ruled',
      font: '"Segoe UI", Calibri, Arial, sans-serif', nameFont: null,
      ink: '#16211f', paper: '#ffffff', accent: '#0f6b52', accent2: '#35505c',
      hints: { name: 'e.g. Oxygen',
        stats: 'Symbol: O\nAtomic number: 8\nMelting point: -218 °C\nAbundance on Earth: 10/10 ← becomes a stat bar' } },
    { key: 'blueprint', label: 'Blueprint', frame: 'double-line', texture: 'blueprint',
      font: '"Segoe UI", "Trebuchet MS", Arial, sans-serif',
      nameFont: 'Consolas, "Lucida Console", "Courier New", monospace',
      ink: '#12233d', paper: '#eef3fa', accent: '#1f4e8c', accent2: '#3c5a7a',
      hints: { name: 'e.g. Slope',
        stats: 'Symbol: m\nUsed in: Algebra\nShows up on tests: 8/10\nDifficulty: 5/10 ← becomes a stat bar' } },
    { key: 'literary', label: 'Literary', frame: 'rule', texture: 'foxing',
      font: '"Book Antiqua", Palatino, Georgia, serif', nameFont: null,
      ink: '#2b2622', paper: '#faf6ee', accent: '#6b3a2e', accent2: '#55483a',
      hints: { name: 'e.g. Elizabeth Bennet',
        stats: 'Book: Pride and Prejudice\nCleverness: 9/10\nCourage: 7/10\nGrowth: 10/10 ← becomes a stat bar' } },
    { key: 'vocab', label: 'Vocabulary', frame: 'plain', texture: null,
      font: '"Segoe UI", Arial, sans-serif', nameFont: null,
      ink: '#23262b', paper: '#ffffff', accent: '#4a4f8c', accent2: '#5a5f6b',
      hints: { name: 'e.g. Sovereignty',
        stats: 'Part of speech: noun\nUnit: Government\nHow often it shows up: 8/10\nWord difficulty: 8/10 ← becomes a stat bar' } }
  ];

  var RARITIES = {
    common: { label: 'Common', gradient: null, badge: null, edge: null },
    rare: { label: 'Rare', gradient: 'htcm-foil-silver', badge: '◆', edge: '#8f98a3' },
    epic: { label: 'Epic', gradient: 'htcm-foil-purple', badge: '✦✦', edge: '#6b3fa0' },
    legendary: { label: 'Legendary', gradient: 'htcm-foil-gold', badge: '♛', edge: '#b08d2f' }
  };

  var byKey = {};
  THEMES.forEach(function (t) { byKey[t.key] = t; });

  function get(key) { return byKey[key] || byKey.classic; }

  /* Background textures: multiple low-alpha gradient layers over the paper
     color. Kept faint on purpose — on a B/W printer they read as gentle
     tone, and text stays fully legible on top of them. */
  function textureImages(key, t) {
    switch (key) {
      case 'parchment':
        return 'radial-gradient(ellipse at 30% 18%, rgba(138,109,29,0.07), transparent 60%),' +
               'radial-gradient(ellipse at 72% 80%, rgba(91,70,54,0.06), transparent 55%),' +
               'radial-gradient(ellipse at 85% 25%, rgba(91,70,54,0.04), transparent 45%)';
      case 'crosshatch':
        return 'repeating-linear-gradient(45deg, rgba(42,33,24,0.045) 0 1px, transparent 1px 7px),' +
               'repeating-linear-gradient(-45deg, rgba(42,33,24,0.045) 0 1px, transparent 1px 7px)';
      case 'linen':
        return 'repeating-linear-gradient(0deg, rgba(51,41,26,0.04) 0 1px, transparent 1px 4px),' +
               'repeating-linear-gradient(90deg, rgba(51,41,26,0.04) 0 1px, transparent 1px 4px)';
      case 'sunburst':
        return 'repeating-conic-gradient(from 84deg at 50% 0%, rgba(23,101,109,0.05) 0 6deg, transparent 6deg 12deg)';
      case 'diagonal':
        return 'repeating-linear-gradient(135deg, rgba(31,53,80,0.05) 0 10px, transparent 10px 26px)';
      case 'grid':
        return 'repeating-linear-gradient(0deg, rgba(14,95,118,0.06) 0 1px, transparent 1px 13px),' +
               'repeating-linear-gradient(90deg, rgba(14,95,118,0.06) 0 1px, transparent 1px 13px)';
      /* ---- subject packs ---- */
      case 'ruled': // lab-notebook rules: horizontal only, so the card reads clean
        return 'repeating-linear-gradient(0deg, rgba(15,107,82,0.05) 0 1px, transparent 1px 12px)';
      case 'blueprint': // fine grid with every fifth line drawn heavier
        return 'repeating-linear-gradient(0deg, rgba(31,78,140,0.05) 0 1px, transparent 1px 10px),' +
               'repeating-linear-gradient(90deg, rgba(31,78,140,0.05) 0 1px, transparent 1px 10px),' +
               'repeating-linear-gradient(90deg, rgba(31,78,140,0.04) 0 1px, transparent 1px 50px)';
      case 'foxing': // old-paper blotching plus a faint laid-paper grain
        return 'radial-gradient(ellipse at 22% 78%, rgba(107,58,46,0.05), transparent 55%),' +
               'radial-gradient(ellipse at 78% 20%, rgba(85,72,58,0.04), transparent 50%),' +
               'repeating-linear-gradient(90deg, rgba(85,72,58,0.03) 0 1px, transparent 1px 4px)';
      default:
        return '';
    }
  }

  function themeCss(t) {
    var tex = t.texture ? textureImages(t.texture, t) : '';
    var css =
      '.trading-card.theme-' + t.key + ' {' +
      ' color: ' + t.ink + ';' +
      ' background-color: ' + t.paper + ';' +
      (tex ? ' background-image: ' + tex + ';' : '') +
      ' font-family: ' + t.font + ';' +
      ' border-color: ' + t.accent + ';' +
      ' }\n' +
      '.trading-card.theme-' + t.key + ' .cname { color: ' + t.accent + ';' +
      (t.nameFont ? ' font-family: ' + t.nameFont + ';' : '') + ' }\n' +
      '.trading-card.theme-' + t.key + ' .cstats b { color: ' + t.accent2 + '; }\n' +
      '.trading-card.theme-' + t.key + ' .card-frame, .trading-card.theme-' + t.key + ' .pwin-rim { color: ' + t.accent + '; }\n' +
      '.trading-card.theme-' + t.key + ' .meter-fill { background: ' + t.accent + '; }\n' +
      '.trading-card.theme-' + t.key + ' .cstars { color: ' + t.accent + '; }\n';
    return css;
  }

  function rarityCss() {
    var css = '';
    Object.keys(RARITIES).forEach(function (k) {
      var r = RARITIES[k];
      if (!r.edge) return;
      // the cut-line border echoes the foil so the tier reads even where the
      // frame overlay is cropped away by scissors
      css += '.trading-card.rarity-' + k + ' { border-color: ' + r.edge + '; }\n';
    });
    css += '.trading-card.rarity-legendary { border-width: 2px; }\n';
    css +=
      '.rarity-badge { position: absolute; top: .06in; right: .06in; width: .24in; height: .24in;' +
      ' border-radius: 50%; display: flex; align-items: center; justify-content: center;' +
      ' font-size: .12in; line-height: 1; color: #fff; box-shadow: 0 0 0 1.5px #fff; z-index: 2; }\n' +
      '.rarity-badge.r-rare { background: linear-gradient(135deg, #b7bfc7, #7e8792); }\n' +
      '.rarity-badge.r-epic { background: linear-gradient(135deg, #9a6fc4, #55307f); }\n' +
      '.rarity-badge.r-legendary { background: linear-gradient(135deg, #d4b354, #8a6d1d); font-size: .14in; }\n';
    return css;
  }

  /* Theme flourishes that are about type, not color. */
  function extraCss() {
    return (
      '.trading-card.theme-sport .cname { background: #b3202c; color: #fff; border-radius: 3px;' +
      ' padding: .015in .06in; transform: skewX(-6deg); }\n' +
      '.trading-card.theme-scifi .cname { letter-spacing: .08em; text-transform: uppercase; }\n' +
      '.trading-card.theme-deco .cname { letter-spacing: .05em; text-transform: uppercase; }\n'
    );
  }

  /** Builds the whole visual system into one <style id="htcm-theme-css"> tag.
      Called at load, below. */
  function injectCss() {
    var old = document.getElementById('htcm-theme-css');
    if (old) old.parentNode.removeChild(old);
    var style = document.createElement('style');
    style.id = 'htcm-theme-css';
    style.textContent = THEMES.map(themeCss).join('') + rarityCss() + extraCss();
    document.head.appendChild(style);
  }

  /** Placeholder copy for the add-a-card form under a given theme, or null
      when the theme doesn't carry its own (the era themes, which keep the
      tool's original history-flavored placeholders). Form text only — this
      never reaches a printed card. */
  function hints(key) {
    var t = byKey[key];
    return (t && t.hints) || null;
  }

  global.HtcmThemes = {
    THEMES: THEMES,
    RARITIES: RARITIES,
    get: get,
    hints: hints,
    injectCss: injectCss
  };

  injectCss();
})(window);
