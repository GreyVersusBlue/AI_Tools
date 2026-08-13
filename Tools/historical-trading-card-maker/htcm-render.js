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

  /** Front of a card: photo (if any), name, stat lines. null → an invisible
      spacer card, used to pad incomplete print rows. */
  function frontHtml(e) {
    if (!e) return '<div class="trading-card blank"></div>';
    var img = e.image ? '<img src="' + e.image.src + '" alt="">' : '';
    var stats = e.stats.map(function (s) { return '<div><b>' + escapeHtml(s.label) + ':</b> ' + escapeHtml(s.value) + '</div>'; }).join('');
    return '<div class="trading-card">' + img + '<div class="cname">' + escapeHtml(e.name) + '</div><div class="cstats">' + stats + '</div></div>';
  }

  /** Back of a card: name and the facts list. */
  function backHtml(e) {
    if (!e) return '<div class="trading-card back blank"></div>';
    var facts = e.facts.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') || '<li>&mdash;</li>';
    return '<div class="trading-card back"><div class="cname">' + escapeHtml(e.name) + '</div><ul class="cfacts">' + facts + '</ul></div>';
  }

  window.HtcmRender = {
    escapeHtml: escapeHtml,
    frontHtml: frontHtml,
    backHtml: backHtml
  };
})();
