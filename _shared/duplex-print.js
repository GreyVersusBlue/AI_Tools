/* duplex-print.js — shared pagination + row-mirroring for duplex card grids.

   Originally written for the Vocabulary Flashcard Generator
   (Tools/vocab-flashcard-generator/vfg-layout.js) and hand-copied into the
   Historical Trading Card Maker; the agreement recorded in that tool's
   improvement prompt was to extract it here the moment a third consumer
   appeared. That moment was the trading-card PDF exporter, which needs the
   same math as its print path. Current consumers: the trading-card print
   builder and PDF exporter (htcm-export.js). vfg-layout.js still carries its
   own copy — migrating it is a separate, test-covered change.

   The duplex contract: print/lay out the front pages, then the back pages
   with each row's items reversed, so that flipping the whole printed stack
   over along its long edge and running it back through the printer lines
   each back up under its matching front. */
(function (global) {
  'use strict';

  /** Splits items into pages of perPage. */
  function paginate(items, perPage) {
    var pages = [];
    for (var i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
  }

  /** Reverses item order within each row of a page so the backs line up
      under their fronts after the long-edge flip. Incomplete rows are padded
      with `null` (blank cards) before mirroring so the padding also lands on
      the correct side. */
  function mirrorPageRows(pageItems, cols) {
    var mirrored = [];
    for (var i = 0; i < pageItems.length; i += cols) {
      var row = pageItems.slice(i, i + cols);
      while (row.length < cols) row.push(null);
      mirrored = mirrored.concat(row.slice().reverse());
    }
    return mirrored;
  }

  global.DuplexPrint = { paginate: paginate, mirrorPageRows: mirrorPageRows };
})(window);
