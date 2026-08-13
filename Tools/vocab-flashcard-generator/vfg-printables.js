/* Vocabulary Flashcard & Word Wall Generator — the four "more printables"
   generators (word search, crossword, bingo, matching quiz).

   Pure functions, no DOM — same discipline as vfg-layout.js — so every
   generator can be unit-tested from Node before any UI touches it. Each
   generator takes the same `{term, definition, example, pronunciation,
   partOfSpeech}` items VocabLayout.parseWordList() already produces (see
   currentItems() in the tool) and returns either:

     { ok: true,  ...generator-specific fields... }
     { ok: false, reason: 'too-few'|'no-fit', ...counts for the UI message... }

   so a small list gets an honest message instead of a garbage puzzle — the
   caller (the tool's renderPreview/buildPrintArea) never has to guess.

   Randomness (word-search letter placement, which cells land on which
   bingo card, the matching-quiz shuffle) is seeded from the words
   themselves via hashString()+mulberry32(), not Math.random(). That means
   the *same* word list regenerates the *same* puzzle on every re-render —
   so toggling an unrelated option (cut lines, sort order) doesn't reshuffle
   a word search a teacher was just looking at — while still letting the
   caller pass an explicit seed (bingo cards use seed+cardIndex so the
   cards in one set differ from each other on purpose). */
(function (global) {
  'use strict';

  /* ---------- shared: seeded RNG ----------
     FNV-1a to turn arbitrary text into a 32-bit seed, mulberry32 as the
     generator. Neither needs to be cryptographically anything — this is
     "different puzzle per word list, same puzzle if you don't change the
     list", not a security property. */
  function hashString(str) {
    str = String(str || '');
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWithRng(arr, rng) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function sampleN(arr, n, rng) {
    return shuffleWithRng(arr, rng).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  /** Letters only, uppercased — what a word-search/crossword grid can hold.
      A multi-word term like "Cell division" becomes "CELLDIVISION"; there's
      no good way to show a space in a letter grid, so this is the one
      lossy step in either generator (documented in the UI hint text). */
  function lettersOnly(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  /* =====================================================================
     WORD SEARCH
     A letter grid with every term hidden across, down, or on one of the
     two forward diagonals (no reversed/backwards words — cheap to add,
     not required, and reversed words are the #1 thing that makes a word
     search feel unfair to a middle-schooler). Placement is greedy: longest
     terms first (they're the hardest to fit, so they get first pick of
     the grid), each tried at up to 300 random position/direction combos;
     a term that never finds a free spot is dropped and reported, not
     silently missing from the word list.
     ===================================================================== */

  var MIN_WORD_SEARCH_TERMS = 3;

  var WORD_SEARCH_DIRECTIONS = [
    { dr: 0, dc: 1 },   // across, left to right
    { dr: 1, dc: 0 },   // down
    { dr: 1, dc: 1 },   // diagonal, down-right
    { dr: 1, dc: -1 }   // diagonal, down-left
  ];

  function wordSearchBounds(size, len, dr, dc) {
    var minRow = 0, maxRow = size - 1, minCol = 0, maxCol = size - 1;
    if (dr === 1) maxRow = size - len;
    if (dc === 1) maxCol = size - len;
    if (dc === -1) minCol = len - 1;
    return { minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol };
  }

  function tryPlaceWordSearchTerm(grid, size, letters, rng) {
    for (var attempt = 0; attempt < 300; attempt++) {
      var dir = WORD_SEARCH_DIRECTIONS[Math.floor(rng() * WORD_SEARCH_DIRECTIONS.length)];
      if (size - letters.length < 0) return null; // term longer than the grid; never fits
      var b = wordSearchBounds(size, letters.length, dir.dr, dir.dc);
      if (b.maxRow < b.minRow || b.maxCol < b.minCol) continue;
      var row = b.minRow + Math.floor(rng() * (b.maxRow - b.minRow + 1));
      var col = b.minCol + Math.floor(rng() * (b.maxCol - b.minCol + 1));
      var fits = true;
      for (var i = 0; i < letters.length; i++) {
        var r = row + dir.dr * i, c = col + dir.dc * i;
        var existing = grid[r][c];
        if (existing && existing !== letters[i]) { fits = false; break; }
      }
      if (!fits) continue;
      for (var j = 0; j < letters.length; j++) {
        grid[row + dir.dr * j][col + dir.dc * j] = letters[j];
      }
      return { row: row, col: col, dr: dir.dr, dc: dir.dc, length: letters.length };
    }
    return null;
  }

  /**
   * items: [{term, ...}]. opts: { maxSize, seed }.
   * Returns { ok:false, reason:'too-few', minTerms, have } for a list too
   * short to be worth generating, or:
   *   { ok:true, size, grid: string[size][size], placements: [{term, row,
   *     col, dr, dc, length}], skipped: [term, ...] }
   * `placements[i]` is enough on its own to prove the word is really in the
   * grid: read `length` cells starting at (row,col) stepping (dr,dc).
   */
  function generateWordSearch(items, opts) {
    opts = opts || {};
    var seenLetters = {};
    var candidates = [];
    (items || []).forEach(function (it) {
      var letters = lettersOnly(it && it.term);
      if (letters.length < 2 || seenLetters[letters]) return;
      seenLetters[letters] = true;
      candidates.push({ term: it.term, letters: letters });
    });
    if (candidates.length < MIN_WORD_SEARCH_TERMS) {
      return { ok: false, reason: 'too-few', minTerms: MIN_WORD_SEARCH_TERMS, have: candidates.length };
    }
    candidates.sort(function (a, b) { return b.letters.length - a.letters.length; });

    var longest = candidates[0].letters.length;
    var totalLetters = candidates.reduce(function (s, c) { return s + c.letters.length; }, 0);
    var size = Math.max(longest + 2, Math.ceil(Math.sqrt(totalLetters * 2.6)));
    size = Math.min(size, opts.maxSize || 22);

    var seed = opts.seed != null ? opts.seed
      : hashString(candidates.map(function (c) { return c.letters; }).join('|') + '|' + size);
    var rng = mulberry32(seed);

    var grid = [];
    for (var r = 0; r < size; r++) grid.push(new Array(size).fill(null));

    var placements = [], skipped = [];
    candidates.forEach(function (cand) {
      var placed = tryPlaceWordSearchTerm(grid, size, cand.letters, rng);
      if (placed) {
        placed.term = cand.term;
        placements.push(placed);
      } else {
        skipped.push(cand.term);
      }
    });

    var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (var rr = 0; rr < size; rr++) {
      for (var cc = 0; cc < size; cc++) {
        if (!grid[rr][cc]) grid[rr][cc] = ALPHA[Math.floor(rng() * ALPHA.length)];
      }
    }

    return {
      ok: true, size: size, grid: grid, placements: placements, skipped: skipped,
      words: candidates.map(function (c) { return c.term; })
    };
  }

  /* =====================================================================
     CROSSWORD
     Best-effort greedy placement, NOT a solver. This is a deliberate scope
     line (see the tool's improvement-prompt Status entry): a true optimal
     crossword generator that guarantees every term places is a real
     research problem (constraint satisfaction / simulated annealing).
     What's here instead: place the longest term first, then repeatedly
     scan the remaining pool for any term that shares a letter with
     something already on the grid, place it at the first/best-scoring
     valid intersection, and repeat until a full pass places nothing more.
     Terms that never intersect anything (no shared letters with any placed
     term, in either orientation) are dropped and reported — better than an
     infinite search or a silently wrong puzzle. Longer, more overlapping
     term lists place better than short lists of unrelated words; that's
     inherent to the greedy approach, not a bug to chase.
     ===================================================================== */

  var MIN_CROSSWORD_TERMS = 3;

  function canPlaceCrosswordWord(get, inBound, letters, row, col, dr, dc) {
    var beforeR = row - dr, beforeC = col - dc;
    if (inBound(beforeR, beforeC) && get(beforeR, beforeC)) return false;
    var afterR = row + dr * letters.length, afterC = col + dc * letters.length;
    if (inBound(afterR, afterC) && get(afterR, afterC)) return false;
    var intersections = 0;
    for (var i = 0; i < letters.length; i++) {
      var r = row + dr * i, c = col + dc * i;
      if (!inBound(r, c)) return false;
      var cell = get(r, c);
      if (cell) {
        if (cell !== letters[i]) return false;
        intersections++;
      } else if (dr === 0) { // across word: the cell above/below must be free, or this word would touch a neighbor
        if (inBound(r - 1, c) && get(r - 1, c)) return false;
        if (inBound(r + 1, c) && get(r + 1, c)) return false;
      } else { // down word: left/right must be free
        if (inBound(r, c - 1) && get(r, c - 1)) return false;
        if (inBound(r, c + 1) && get(r, c + 1)) return false;
      }
    }
    return intersections > 0 ? intersections : false;
  }

  function findBestCrosswordPlacement(get, inBound, placed, cand) {
    var letters = cand.letters, best = null, bestScore = -1;
    placed.forEach(function (pl) {
      var pDr = pl.dir === 'down' ? 1 : 0, pDc = pl.dir === 'across' ? 1 : 0;
      for (var pi = 0; pi < pl.letters.length; pi++) {
        var pr = pl.row + pDr * pi, pc = pl.col + pDc * pi, pLetter = pl.letters[pi];
        for (var ci = 0; ci < letters.length; ci++) {
          if (letters[ci] !== pLetter) continue;
          var dir = pl.dir === 'across' ? 'down' : 'across';
          var dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
          var row = pr - dr * ci, col = pc - dc * ci;
          var score = canPlaceCrosswordWord(get, inBound, letters, row, col, dr, dc);
          if (score !== false && score > bestScore) {
            bestScore = score;
            best = { row: row, col: col, dr: dr, dc: dc, dir: dir };
          }
        }
      }
    });
    return best;
  }

  /**
   * items: [{term, definition, ...}] — a definition is required (it's the
   * clue), so items without one are excluded from the candidate pool up
   * front. opts: { maxSize }.
   * Returns { ok:false, reason:'too-few'|'no-fit', ... } or:
   *   { ok:true, width, height, grid: (string|null)[height][width],
   *     placements: [{term, definition, number, row, col, dir, letters}],
   *     skipped: [term, ...] }
   * Every placement's `letters` is exactly what's in `grid` at its slot —
   * that's the invariant the test suite checks instead of re-solving the
   * puzzle.
   */
  function generateCrossword(items, opts) {
    opts = opts || {};
    var seen = {}, candidates = [];
    (items || []).forEach(function (it) {
      var letters = lettersOnly(it && it.term);
      var definition = String((it && it.definition) || '').trim();
      if (letters.length < 2 || !definition || seen[letters]) return;
      seen[letters] = true;
      candidates.push({ term: it.term, letters: letters, definition: definition });
    });
    if (candidates.length < MIN_CROSSWORD_TERMS) {
      return { ok: false, reason: 'too-few', minTerms: MIN_CROSSWORD_TERMS, have: candidates.length };
    }
    candidates.sort(function (a, b) { return b.letters.length - a.letters.length; });

    var BOUND = opts.maxSize || 26;
    var sparse = {};
    function key(r, c) { return r + ',' + c; }
    function get(r, c) { return sparse[key(r, c)] || null; }
    function inBound(r, c) { return r >= 0 && r < BOUND && c >= 0 && c < BOUND; }

    var pool = candidates.slice();
    var first = pool.shift();
    var startRow = Math.floor(BOUND / 2), startCol = Math.floor((BOUND - first.letters.length) / 2);
    for (var i = 0; i < first.letters.length; i++) sparse[key(startRow, startCol + i)] = first.letters[i];
    var placed = [{ term: first.term, definition: first.definition, letters: first.letters, row: startRow, col: startCol, dir: 'across' }];

    var progress = true;
    while (pool.length && progress) {
      progress = false;
      for (var p = pool.length - 1; p >= 0; p--) {
        var cand = pool[p];
        var best = findBestCrosswordPlacement(get, inBound, placed, cand);
        if (best) {
          for (var j = 0; j < cand.letters.length; j++) {
            sparse[key(best.row + best.dr * j, best.col + best.dc * j)] = cand.letters[j];
          }
          placed.push({ term: cand.term, definition: cand.definition, letters: cand.letters, row: best.row, col: best.col, dir: best.dir });
          pool.splice(p, 1);
          progress = true;
        }
      }
    }
    var skipped = pool.map(function (c) { return c.term; });

    if (placed.length < 2) {
      // Nothing shared a letter with anything else — a "crossword" of one
      // isolated word is just a word, and would be a worse experience than
      // saying so and pointing at the word search instead.
      return { ok: false, reason: 'no-fit', minTerms: MIN_CROSSWORD_TERMS, have: candidates.length };
    }

    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    placed.forEach(function (pl) {
      var dr = pl.dir === 'down' ? 1 : 0, dc = pl.dir === 'across' ? 1 : 0;
      for (var k = 0; k < pl.letters.length; k++) {
        var r = pl.row + dr * k, c = pl.col + dc * k;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
    });
    placed.forEach(function (pl) { pl.row -= minR; pl.col -= minC; });

    var width = maxC - minC + 1, height = maxR - minR + 1;
    var outGrid = [];
    for (var rr = 0; rr < height; rr++) outGrid.push(new Array(width).fill(null));
    placed.forEach(function (pl) {
      var dr = pl.dir === 'down' ? 1 : 0, dc = pl.dir === 'across' ? 1 : 0;
      for (var m = 0; m < pl.letters.length; m++) outGrid[pl.row + dr * m][pl.col + dc * m] = pl.letters[m];
    });

    var number = 1, numberAt = {};
    for (var r2 = 0; r2 < height; r2++) {
      for (var c2 = 0; c2 < width; c2++) {
        if (!outGrid[r2][c2]) continue;
        var startsAcross = (c2 === 0 || !outGrid[r2][c2 - 1]) && (c2 + 1 < width && outGrid[r2][c2 + 1]);
        var startsDown = (r2 === 0 || !outGrid[r2 - 1][c2]) && (r2 + 1 < height && outGrid[r2 + 1][c2]);
        if (startsAcross || startsDown) numberAt[r2 + ',' + c2] = number++;
      }
    }
    placed.forEach(function (pl) { pl.number = numberAt[pl.row + ',' + pl.col]; });
    placed.sort(function (a, b) {
      if (a.dir !== b.dir) return a.dir === 'across' ? -1 : 1;
      return a.number - b.number;
    });

    return { ok: true, width: width, height: height, grid: outGrid, placements: placed, skipped: skipped };
  }

  /* =====================================================================
     BINGO
     Card size scales with how many call-items are available (3x3/4x4/5x5;
     the 5x5 gets a classic FREE center square). Each card is an
     independently-seeded random subset+arrangement of the same call pool,
     so a room full of cards doesn't repeat — but every cell on every card
     still comes from the one master list the caller reads from.
     ===================================================================== */

  var BINGO_SIZES = [
    { size: 5, needed: 25, free: true },
    { size: 4, needed: 16, free: false },
    { size: 3, needed: 9, free: false }
  ];
  var MIN_BINGO_ITEMS = 9;

  /**
   * items: [{term, definition, ...}]. opts: { cellField: 'term'|'definition'
   * (default 'term' — cards show terms, the caller reads definitions aloud),
   * count (cards to print, default 4), seed }.
   * Returns { ok:false, reason:'too-few', minItems, have } or:
   *   { ok:true, size, free, cellField, cards: [{size, cells:[{free,text}]}],
   *     callList: [{term, definition, text}] }
   */
  function generateBingoCards(items, opts) {
    opts = opts || {};
    var field = opts.cellField === 'definition' ? 'definition' : 'term';
    var seen = {}, uniquePool = [];
    (items || []).forEach(function (it) {
      var text = it && String(it[field] || '').trim();
      if (!text || seen[text]) return;
      seen[text] = true;
      uniquePool.push({ text: text, term: it.term, definition: it.definition });
    });

    var sizeInfo = null;
    for (var i = 0; i < BINGO_SIZES.length; i++) {
      if (uniquePool.length >= BINGO_SIZES[i].needed) { sizeInfo = BINGO_SIZES[i]; break; }
    }
    if (!sizeInfo) {
      return { ok: false, reason: 'too-few', minItems: MIN_BINGO_ITEMS, have: uniquePool.length };
    }

    var count = Math.max(1, opts.count || 4);
    var seedBase = opts.seed != null ? opts.seed
      : hashString(uniquePool.map(function (u) { return u.text; }).join('|') + '|' + sizeInfo.size);
    var cellsNeeded = sizeInfo.size * sizeInfo.size - (sizeInfo.free ? 1 : 0);
    var freeIndex = sizeInfo.free ? Math.floor(sizeInfo.size * sizeInfo.size / 2) : -1;

    var cards = [];
    for (var cIdx = 0; cIdx < count; cIdx++) {
      // Distinct-but-deterministic per card: a fixed offset per index, not
      // Math.random(), so re-rendering the same list reproduces the same set.
      var rng = mulberry32((seedBase + cIdx * 2654435761) >>> 0);
      var picked = sampleN(uniquePool, cellsNeeded, rng);
      var cells = [], pIdx = 0;
      for (var pos = 0; pos < sizeInfo.size * sizeInfo.size; pos++) {
        if (pos === freeIndex) cells.push({ free: true, text: 'FREE' });
        else { cells.push({ free: false, text: picked[pIdx].text }); pIdx++; }
      }
      cards.push({ size: sizeInfo.size, cells: cells });
    }

    var callList = uniquePool.map(function (u) { return { term: u.term, definition: u.definition, text: u.text }; });
    return { ok: true, size: sizeInfo.size, free: sizeInfo.free, cellField: field, cards: cards, callList: callList };
  }

  /* =====================================================================
     MATCHING QUIZ
     Two columns: numbered terms on the left, lettered/scrambled
     definitions on the right, a blank next to each term for the student's
     letter — plus an answer key with the correct letter per term.
     ===================================================================== */

  var MIN_MATCHING_TERMS = 2;
  var MATCH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function matchingLetterFor(pos) {
    return pos < MATCH_LETTERS.length
      ? MATCH_LETTERS[pos]
      : MATCH_LETTERS[pos % MATCH_LETTERS.length] + (Math.floor(pos / MATCH_LETTERS.length) + 1);
  }

  /**
   * items: [{term, definition, ...}] — only items with a non-empty
   * definition are eligible (a term with nothing to match against can't be
   * a matching-quiz row). opts: { seed }.
   * Returns { ok:false, reason:'too-few', minTerms, have } or:
   *   { ok:true, left: [{index, term}], right: [{letter, definition,
   *     termIndex}], answerKey: [{term, letter}] }
   * `right[i].termIndex` points back at the `left` entry it's the correct
   * definition for — that's what the test suite (and the answer key
   * builder) both use, so they can't disagree.
   */
  function generateMatchingQuiz(items, opts) {
    opts = opts || {};
    var pool = (items || []).filter(function (it) {
      return it && it.term && String(it.definition || '').trim();
    });
    if (pool.length < MIN_MATCHING_TERMS) {
      return { ok: false, reason: 'too-few', minTerms: MIN_MATCHING_TERMS, have: pool.length };
    }
    var seed = opts.seed != null ? opts.seed
      : hashString(pool.map(function (p) { return p.term + '|' + p.definition; }).join('~'));
    var rng = mulberry32(seed);

    var left = pool.map(function (p, i) { return { index: i, term: p.term }; });
    var order = shuffleWithRng(pool.map(function (_, i) { return i; }), rng);
    var right = order.map(function (origIndex, pos) {
      return { letter: matchingLetterFor(pos), definition: pool[origIndex].definition, termIndex: origIndex };
    });
    var answerKey = left.map(function (l) {
      var match = right.filter(function (r) { return r.termIndex === l.index; })[0];
      return { term: l.term, letter: match ? match.letter : null };
    });

    return { ok: true, left: left, right: right, answerKey: answerKey };
  }

  global.VfgPrintables = {
    hashString: hashString,
    mulberry32: mulberry32,
    lettersOnly: lettersOnly,
    generateWordSearch: generateWordSearch,
    generateCrossword: generateCrossword,
    generateBingoCards: generateBingoCards,
    generateMatchingQuiz: generateMatchingQuiz,
    MIN_WORD_SEARCH_TERMS: MIN_WORD_SEARCH_TERMS,
    MIN_CROSSWORD_TERMS: MIN_CROSSWORD_TERMS,
    MIN_BINGO_ITEMS: MIN_BINGO_ITEMS,
    MIN_MATCHING_TERMS: MIN_MATCHING_TERMS
  };
})(typeof window !== 'undefined' ? window : global);
