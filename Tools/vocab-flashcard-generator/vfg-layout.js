/* Vocabulary Flashcard & Word Wall Generator — layout math.
   Pure functions, no DOM, so pagination/mirroring can be unit-tested
   before any UI touches them. */
(function (global) {
  'use strict';

  function parseWordList(text) {
    return String(text || '').split('\n').map(function (line) {
      var idx = line.indexOf(':');
      if (idx === -1) return null;
      var term = line.slice(0, idx).trim();
      var definition = line.slice(idx + 1).trim();
      if (!term) return null;
      return { term: term, definition: definition };
    }).filter(Boolean);
  }

  function paginate(items, perPage) {
    var pages = [];
    for (var i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    return pages;
  }

  /**
   * Reverse item order within each row of a page so that printing this
   * page on the back of `page` (flipping along the LONG edge of the
   * paper, the common duplex default) lines each back card up under its
   * matching front card. Incomplete final rows are padded with `null`
   * (blank cards) before mirroring so the padding also ends up on the
   * correct side.
   */
  function mirrorPageRows(pageItems, cols) {
    var mirrored = [];
    for (var i = 0; i < pageItems.length; i += cols) {
      var row = pageItems.slice(i, i + cols);
      while (row.length < cols) row.push(null);
      mirrored = mirrored.concat(row.slice().reverse());
    }
    return mirrored;
  }

  /**
   * Return a shuffled COPY of items (Fisher-Yates), leaving the input
   * array untouched so the caller's saved order is never mutated.
   */
  function shuffleItems(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function pageSize(orientation) {
    return orientation === 'landscape' ? { w: 11, h: 8.5 } : { w: 8.5, h: 11 };
  }

  function computeCardSizeIn(cols, rows, orientation, marginIn) {
    var margin = marginIn == null ? 0.3 : marginIn;
    var page = pageSize(orientation);
    var usableW = page.w - margin * 2;
    var usableH = page.h - margin * 2;
    return {
      cardW: usableW / cols, cardH: usableH / rows,
      pageW: page.w, pageH: page.h, margin: margin
    };
  }

  global.VocabLayout = {
    parseWordList: parseWordList,
    paginate: paginate,
    shuffleItems: shuffleItems,
    mirrorPageRows: mirrorPageRows,
    pageSize: pageSize,
    computeCardSizeIn: computeCardSizeIn
  };
})(typeof window !== 'undefined' ? window : global);
