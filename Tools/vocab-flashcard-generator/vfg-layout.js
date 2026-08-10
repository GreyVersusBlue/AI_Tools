/* Vocabulary Flashcard & Word Wall Generator — layout math.
   Pure functions, no DOM, so pagination/mirroring can be unit-tested
   before any UI touches them. */
(function (global) {
  'use strict';

  /**
   * Minimal single-line CSV field split (handles double-quoted fields,
   * including an escaped "" for a literal quote). Good enough for a
   * pasted spreadsheet column — not a full multi-line RFC 4180 parser.
   */
  function splitCsvLine(line) {
    var fields = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  /**
   * Accepts the original "term: definition" per-line format, or a pasted
   * spreadsheet column: tab-separated (the clipboard format Google Sheets/
   * Excel use for a copied range) or comma-separated (a pasted .csv).
   * Up to three more optional fields — example sentence, pronunciation
   * guide, part of speech, in that order — come from extra tab/comma
   * columns, or from "| example | pronunciation | part of speech" tacked
   * onto the definition in the colon format (each segment optional; you
   * can supply just an example and stop, for instance). Extra columns
   * beyond the first five are dropped, matching the tolerant paste parsing
   * used elsewhere in this toolkit.
   */
  function parseWordList(text) {
    return String(text || '').replace(/\r\n/g, '\n').split('\n').map(function (line) {
      if (!line.trim()) return null;
      var term, definition, example = '', pronunciation = '', partOfSpeech = '';
      if (line.indexOf('\t') !== -1) {
        var tabParts = line.split('\t');
        term = (tabParts[0] || '').trim();
        definition = (tabParts[1] || '').trim();
        example = (tabParts[2] || '').trim();
        pronunciation = (tabParts[3] || '').trim();
        partOfSpeech = (tabParts[4] || '').trim();
      } else if (line.indexOf(':') !== -1) {
        var idx = line.indexOf(':');
        term = line.slice(0, idx).trim();
        definition = line.slice(idx + 1).trim();
        var pipeParts = definition.split('|');
        definition = (pipeParts[0] || '').trim();
        example = (pipeParts[1] || '').trim();
        pronunciation = (pipeParts[2] || '').trim();
        partOfSpeech = (pipeParts[3] || '').trim();
      } else if (line.indexOf(',') !== -1) {
        var csvFields = splitCsvLine(line);
        term = (csvFields[0] || '').trim();
        definition = (csvFields[1] || '').trim();
        example = (csvFields[2] || '').trim();
        pronunciation = (csvFields[3] || '').trim();
        partOfSpeech = (csvFields[4] || '').trim();
      } else {
        return null;
      }
      if (!term) return null;
      return { term: term, definition: definition, example: example, pronunciation: pronunciation, partOfSpeech: partOfSpeech };
    }).filter(Boolean);
  }

  /**
   * Sort a COPY of items by term. mode is 'az', 'za', or anything else
   * (including the default 'none') for "leave in the order given" — used
   * so "as entered" round-trips through this function too rather than
   * needing a separate branch at every call site.
   */
  function sortItems(items, mode) {
    if (mode !== 'az' && mode !== 'za') return items.slice();
    var copy = items.slice();
    copy.sort(function (a, b) {
      var cmp = String((a && a.term) || '').localeCompare(String((b && b.term) || ''), undefined, { sensitivity: 'base' });
      return mode === 'za' ? -cmp : cmp;
    });
    return copy;
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
    sortItems: sortItems,
    paginate: paginate,
    shuffleItems: shuffleItems,
    mirrorPageRows: mirrorPageRows,
    pageSize: pageSize,
    computeCardSizeIn: computeCardSizeIn
  };
})(typeof window !== 'undefined' ? window : global);
