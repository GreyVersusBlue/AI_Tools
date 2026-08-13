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
    // rare and up get a static diagonal foil glint — one soft light band that
    // reads as a sheen in color and a faint highlight (or nothing) in B/W;
    // deliberately no animation, this card's job is to come out of a printer
    var holo = (!isBack && rarity !== 'common') ? '<div class="holo" aria-hidden="true"></div>' : '';
    return '<div class="' + cls + '">' + frame + badge + holo;
  }

  var MEDALLION = { circle: 1, shield: 1, arch: 1 }; // centered boxes; the rest span the card

  /* Small stroke-drawn stat icons, matched against the stat label. Stroke
     SVGs print crisp on any printer; an unmatched label simply gets none. */
  var STAT_ICONS = [
    { re: /born|birth/i, svg: '<path d="M1.5 9.5h9M3.5 9.5a2.5 2.5 0 0 1 5 0M6 5V3.2M3.2 6.2l-1-1M8.8 6.2l1-1"/>' },
    { re: /died|death/i, svg: '<path d="M6 2.5v7M3.8 4.8h4.4"/>' },
    { re: /reign|king|queen|ruler|dynasty|empire/i, svg: '<path d="M2.2 9h7.6M2.2 9 1.6 4.4 4 6l2-3 2 3 2.4-1.6L9.8 9z"/>' },
    { re: /battle|war|military|army/i, svg: '<path d="M2.5 2.5l7 7M9.5 2.5l-7 7M2 8.6 3.4 10M10 8.6 8.6 10"/>' },
    { re: /known|famous|fame|legacy/i, svg: '<path d="M6 1.6l1.3 2.7 3 .4-2.2 2 .6 2.9L6 8.3 3.3 9.6l.6-2.9-2.2-2 3-.4z"/>' },
    { re: /capital|city/i, svg: '<path d="M2 10V4.5h3V10M7 10V2.5h3V10M1 10h10M3.5 6h.01M3.5 7.8h.01M8.5 4.5h.01M8.5 6.3h.01M8.5 8.1h.01"/>' },
    { re: /population|people/i, svg: '<circle cx="4" cy="4.2" r="1.6"/><circle cx="8.2" cy="4.8" r="1.3"/><path d="M1.5 10c0-1.8 1.1-2.9 2.5-2.9S6.5 8.2 6.5 10M7 10c.1-1.4 1-2.3 2.2-2.3.9 0 1.6.4 2 1.1"/>' },
    { re: /countr|region|location|territor|continent/i, svg: '<path d="M6 10.5S2.2 7.3 2.2 4.8a3.8 3.8 0 1 1 7.6 0C9.8 7.3 6 10.5 6 10.5z"/><circle cx="6" cy="4.8" r="1.3"/>' },
    { re: /year|date|era|period|century/i, svg: '<rect x="1.8" y="2.5" width="8.4" height="7.5" rx="1"/><path d="M1.8 4.8h8.4M4 1.5v2M8 1.5v2"/>' },
    { re: /achieve|award|won|victor|accomplish/i, svg: '<path d="M4 1.8h4v3a2 2 0 0 1-4 0zM4 2.5H2.3a1.8 1.8 0 0 0 1.8 2M8 2.5h1.7a1.8 1.8 0 0 1-1.8 2M6 6.8v1.7M4.4 10h3.2"/>' }
  ];

  function statIcon(label) {
    for (var i = 0; i < STAT_ICONS.length; i++) {
      if (STAT_ICONS[i].re.test(label)) {
        return '<svg class="stat-ico" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1"' +
          ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + STAT_ICONS[i].svg + '</svg>';
      }
    }
    return '';
  }

  /** One stat line. A value like "7/10" becomes a meter — with the number
      printed inside the bar, so it stays readable on a B/W printer where the
      fill is just gray tone. Anything else renders as label: value. */
  function statLineHtml(s) {
    var icon = statIcon(s.label);
    var m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s.value);
    if (m && parseFloat(m[2]) > 0) {
      var pct = Math.max(0, Math.min(100, parseFloat(m[1]) / parseFloat(m[2]) * 100));
      return '<div class="cstat-meter">' + icon + '<b>' + escapeHtml(s.label) + ':</b>' +
        '<span class="meter-track"><span class="meter-fill" style="width:' + pct.toFixed(1) + '%"></span>' +
        '<span class="meter-num">' + escapeHtml(s.value) + '</span></span></div>';
    }
    return '<div>' + icon + '<b>' + escapeHtml(s.label) + ':</b> ' + escapeHtml(s.value) + '</div>';
  }

  function starsHtml(meta) {
    var st = (meta && meta.stars) || 0;
    if (!st) return '';
    return '<div class="cstars" aria-hidden="true">' +
      new Array(st + 1).join('★') + new Array(5 - st + 1).join('☆') + '</div>';
  }

  /** The "3 / 24 · ANCIENT ROME" strip pinned to the card's bottom edge. */
  function setStripHtml(meta) {
    if (!meta || (!meta.setName && !meta.cardNo)) return '';
    var num = meta.cardNo ? (meta.cardNo + (meta.setSize ? ' / ' + meta.setSize : '')) : '';
    return '<div class="cset"><span>' + escapeHtml(num) + '</span><span>' + escapeHtml(meta.setName || '') + '</span></div>';
  }

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
    var stats = e.stats.map(statLineHtml).join('');
    return shellOpen(e, opts, false) + img +
      '<div class="cname">' + escapeHtml(e.name) + '</div>' + starsHtml(e.meta) +
      '<div class="cstats">' + stats + '</div>' + setStripHtml(e.meta) + '</div>';
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
