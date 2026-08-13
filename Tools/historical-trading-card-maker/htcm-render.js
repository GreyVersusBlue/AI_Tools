/* htcm-render.js — the one card renderer for the Historical Trading Card
   Maker. The live preview, the print builder, and (in a later round) the
   PNG/PDF exporter all build cards through these two functions, so what the
   teacher sees on screen is byte-for-byte the markup that prints. Entries are
   schema-v2 card objects (see htcm-store.js). */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** The opening shell shared by front and back: theme + rarity classes, the
      frame overlay, and (fronts only) the rarity badge. opts.theme is the
      deck-level theme; a card's own e.theme overrides it. */
  function shellOpen(e, opts, isBack) {
    var themeKey = (e.theme && HtcmThemes.get(e.theme).key === e.theme) ? e.theme : ((opts && opts.theme) || 'classic');
    var theme = HtcmThemes.get(themeKey);
    var rarity = (e.meta && HtcmThemes.RARITIES[e.meta.rarity]) ? e.meta.rarity : 'common';
    var r = HtcmThemes.RARITIES[rarity];
    var cls = 'trading-card theme-' + theme.key + (isBack ? ' back' : '');
    if (rarity !== 'common') cls += ' rarity-' + rarity;
    var frame = HtcmFrames.frameSvg(theme.frame, r.gradient);
    var badge = (!isBack && r.badge) ?
      '<div class="rarity-badge r-' + rarity + '" aria-hidden="true">' + r.badge + '</div>' : '';
    return '<div class="' + cls + '">' + frame + badge;
  }

  var MEDALLION = { circle: 1, shield: 1, arch: 1 }; // centered boxes; the rest span the card

  /** The shaped photo window: clipped img with its parametric crop applied,
      plus a rim stroke in the theme accent tracing the same shape. */
  function photoWindowHtml(image) {
    var shape = HtcmFrames.SHAPES[image.shape] ? image.shape : 'rrect';
    var rim = '<svg class="pwin-rim" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + HtcmFrames.shapePath(shape, 100, 100) + '" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    return '<div class="pwin shape-' + shape + (MEDALLION[shape] ? ' medallion' : '') +
      '" style="clip-path:url(#htcm-clip-' + shape + ')">' +
      '<img src="' + image.src + '" alt="" style="' + HtcmPhoto.photoStyle(image) + '">' + rim + '</div>';
  }

  /** Front of a card: photo (if any), name, stat lines. null → an invisible
      spacer card, used to pad incomplete print rows. */
  function frontHtml(e, opts) {
    if (!e) return '<div class="trading-card blank"></div>';
    var img = e.image ? photoWindowHtml(e.image) : '';
    var stats = e.stats.map(function (s) { return '<div><b>' + escapeHtml(s.label) + ':</b> ' + escapeHtml(s.value) + '</div>'; }).join('');
    return shellOpen(e, opts, false) + img + '<div class="cname">' + escapeHtml(e.name) + '</div><div class="cstats">' + stats + '</div></div>';
  }

  /** Back of a card: name and the facts list. */
  function backHtml(e, opts) {
    if (!e) return '<div class="trading-card back blank"></div>';
    var facts = e.facts.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') || '<li>&mdash;</li>';
    return shellOpen(e, opts, true) + '<div class="cname">' + escapeHtml(e.name) + '</div><ul class="cfacts">' + facts + '</ul></div>';
  }

  window.HtcmRender = {
    escapeHtml: escapeHtml,
    frontHtml: frontHtml,
    backHtml: backHtml
  };
})();
