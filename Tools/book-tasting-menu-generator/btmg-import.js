/* Book Tasting Menu Generator — importing a book list and checking its genre balance (Path rank 83).
   Pure functions, no DOM, no storage. The page reads the file (SheetJS for .xlsx/.xls, the shared
   PasteTable for CSV, tab-separated or pasted text) and hands the rows here:

     mapRows(rows[, lineNos]) -> { header, columns, books, skipped }
         Finds the title/author/genre/blurb columns by their header names, or takes the first four columns
         in that order when the first row is not a header. A row with no title is skipped and named.
     merge(existing, books)   -> { add, duplicates, genreCase }
         Drops a book whose title and author are already in the list (or earlier in the import) and brings
         a genre written in another case ("mystery") to the spelling already in use ("Mystery").
     genreBalance(books)      -> { total, counts, unlabelled, warnings }
         Plain-language warnings when one genre dominates, only one genre is present, or many books have none. */
(function (global) {
  'use strict';

  var MAX_ROWS = 300;
  var LIMITS = { title: 200, author: 120, genre: 60, blurb: 600 };
  var HEADS = {
    title: ['title', 'book', 'book title', 'name', 'book name'],
    author: ['author', 'writer', 'by', 'authors', 'author name'],
    genre: ['genre', 'category', 'type', 'section', 'course', 'genres'],
    blurb: ['blurb', 'description', 'summary', 'teaser', 'synopsis', 'notes', 'about']
  };
  var FIELDS = ['title', 'author', 'genre', 'blurb'];

  function fold(s) {
    var t = String(s == null ? '' : s);
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function cell(row, i) { return i == null || i < 0 ? '' : String(row[i] == null ? '' : row[i]).replace(/\s+/g, ' ').trim(); }

  /* headerColumns(row): { title: 0, ... } when the row names at least two of the fields, else null. */
  function headerColumns(row) {
    var found = {}, n = 0;
    (row || []).forEach(function (c, i) {
      var f = fold(c);
      FIELDS.forEach(function (k) {
        if (found[k] === undefined && HEADS[k].indexOf(f) !== -1) { found[k] = i; n++; }
      });
    });
    return (n >= 2 && found.title !== undefined) || (n >= 2 && found.blurb !== undefined) ? found : null;
  }

  function mapRows(rows, lineNos) {
    rows = Array.isArray(rows) ? rows : [];
    var out = { header: false, columns: { title: 0, author: 1, genre: 2, blurb: 3 }, books: [], skipped: [], over: 0 };
    var start = 0;
    var head = rows.length ? headerColumns(rows[0]) : null;
    if (head) { out.header = true; out.columns = head; start = 1; }
    if (rows.length - start > MAX_ROWS) { out.over = rows.length - start - MAX_ROWS; rows = rows.slice(0, start + MAX_ROWS); }
    for (var i = start; i < rows.length; i++) {
      var r = rows[i] || [];
      var line = lineNos && lineNos[i] != null ? lineNos[i] : i + 1;
      var b = {};
      FIELDS.forEach(function (k) { b[k] = cell(r, out.columns[k]).slice(0, LIMITS[k]); });
      if (!b.title && !b.author && !b.genre && !b.blurb) continue;           // an empty row is not a problem
      if (!b.title) { out.skipped.push({ line: line, reason: 'no title' }); continue; }
      out.books.push({ title: b.title, author: b.author, genre: b.genre, blurb: b.blurb, line: line });
    }
    return out;
  }

  function key(b) { return fold(b.title) + '|' + fold(b.author); }

  function merge(existing, books) {
    existing = Array.isArray(existing) ? existing : [];
    var seen = {}, spell = {};
    existing.forEach(function (b) {
      seen[key(b)] = true;
      var g = String(b.genre || '').trim();
      if (g && !spell[fold(g)]) spell[fold(g)] = g;
    });
    var add = [], duplicates = [], recased = 0;
    (books || []).forEach(function (b) {
      var k = key(b);
      if (seen[k]) { duplicates.push(b); return; }
      seen[k] = true;
      var g = b.genre, f = fold(g);
      if (f) {
        if (spell[f]) { if (spell[f] !== g) recased++; g = spell[f]; } else spell[f] = g;
      }
      add.push({ title: b.title, author: b.author, genre: g, blurb: b.blurb, line: b.line });
    });
    return { add: add, duplicates: duplicates, genreCase: recased };
  }

  /* genreBalance(books): counts per genre (largest first) and warnings. Needs 6 books before it says anything about balance. */
  function genreBalance(books) {
    books = Array.isArray(books) ? books : [];
    var counts = {}, order = [], unlabelled = 0;
    books.forEach(function (b) {
      var g = String(b.genre || '').trim();
      if (!g) { unlabelled++; return; }
      var f = fold(g);
      if (!counts[f]) { counts[f] = { genre: g, n: 0 }; order.push(f); }
      counts[f].n++;
    });
    var list = order.map(function (f) { return counts[f]; }).sort(function (a, b) { return b.n - a.n; });
    var total = books.length, warnings = [];
    if (total >= 6) {
      var labelled = total - unlabelled;
      if (list.length === 1 && unlabelled === 0) {
        warnings.push('All ' + total + ' books are ' + list[0].genre + '. A tasting works best with a few kinds of book.');
      } else if (list.length && list[0].n / total > 0.5) {
        warnings.push(list[0].genre + ' is ' + list[0].n + ' of the ' + total + ' books (' + Math.round(100 * list[0].n / total) + '%). Add a few from other genres, or the menu will read as one long course.');
      }
      if (unlabelled / total > 0.25) {
        warnings.push(unlabelled + ' of the ' + total + ' books have no genre and will print together under “More Books”.');
      }
      if (labelled > 0 && list.length >= 2) {
        var singles = list.filter(function (g) { return g.n === 1; }).length;
        if (singles >= 4 && singles / list.length > 0.6) {
          warnings.push(singles + ' genres have just one book each, which makes a menu of one-book courses. Check the spellings (“Sci-Fi” and “Science Fiction” are two genres here).');
        }
      }
    }
    return { total: total, counts: list, unlabelled: unlabelled, warnings: warnings };
  }

  global.BookImport = { MAX_ROWS: MAX_ROWS, LIMITS: LIMITS, headerColumns: headerColumns, mapRows: mapRows, merge: merge, genreBalance: genreBalance };
})(typeof globalThis !== 'undefined' ? globalThis : this);
