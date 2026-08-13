/* Math Fact Drill Sheet Generator — self-checking OUTPUT FORMATS.
   Pure functions, no DOM: these take a problem set that mdg-generate.js
   already produced (whatever operation type it is — the four fact drills,
   integers, decimals, fractions, percent, order of operations, all of it,
   since every problem carries `answer`/`answerText`) and derive the extra
   data a riddle, a colour-by-answer grid, or a maze needs to render. The
   HTML file turns this data into markup; nothing here touches the page.

   Three formats, three different self-checking mechanics:

   - Riddle: a small built-in bank of short riddles. Each DISTINCT answer
     value in the set is assigned one letter of the punchline (in order of
     first appearance), so the decoder key (value -> letter) is always a
     clean function even when several problems share an answer — which is
     common and expected for basic fact drills (addition on 1-12 has only
     ~23 distinct sums). The riddle picked is the best fit for how many
     distinct answers are available; if nothing in the bank fits (a very
     small or very narrow-range problem set), the shortest riddle's
     punchline is truncated to the number of distinct letters that can be
     supported, which is documented here and in the improvement prompt as a
     deliberate degenerate-case tradeoff rather than a bug.

   - Colour-by-answer: a small bank of hand-authored pixel-grid pictures
     (heart, star, smiley, arrow, house). The picture with a filled-cell
     count closest to the problem count is picked; filled cells are numbered
     1..count and cycle through the problem list with `%` if there are more
     cells than problems (several cells sharing one problem number) or fewer
     cells than problems (the picture just doesn't use every problem — any
     problems that fall out are still on the plain worksheet, self-check
     grids only ever cover a subset by design). Colour is assigned per
     DISTINCT answer value, cycling an 8-colour named palette, so the same
     answer always colours the same everywhere on the sheet.

   - Maze: a real generated maze (recursive-backtracker / "perfect maze" —
     exactly one path between any two cells), not an illusion of branching.
     The unique solution path is walked; any path cell that still has an
     open side besides "the way in" and "the way forward" is a junction.
     Each used junction is assigned one problem from the set (in path
     order); its answer is the "continue" choice, and the junction's other
     open directions become decoy choices carrying other problems' answers
     (or a numeric perturbation of the correct answer if the set doesn't
     have enough distinct alternatives). This is a small, fixed-size maze,
     not a general maze generator with configurable topology — deliberately
     scoped down per the assignment ("a simple generated or template maze
     structure is fine, this doesn't need to be a sophisticated maze
     generator"). A student who traces which printed choice bubble connects
     to a "further along the path" cell instead of doing the arithmetic can
     shortcut it the same way a student can trace a printed maze's walls
     instead of solving it — that's an accepted limitation of the paper
     medium, not something this format tries to defeat cryptographically. */
(function (global) {
  'use strict';

  /* ---------- shared tiny helpers ---------- */

  /** Same mulberry32 as mdg-generate.js, kept as a local copy rather than a
      cross-module dependency so this file stays a standalone, independently
      testable unit — the same "pure, no DOM" contract as the other support
      modules, just without reaching into a sibling script for eight lines. */
  function makeRng(seed) {
    if (seed == null) return Math.random;
    var state = seed >>> 0;
    return function () {
      state |= 0; state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWithRng(arr, rng) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function valueOf(p) { return p.answerText != null ? p.answerText : p.answer; }

  /** Distinct answer values, in order of first appearance — the pool every
      self-check format assigns letters/colours/junction answers from. */
  function distinctValues(problems) {
    var seen = {}, out = [];
    for (var i = 0; i < problems.length; i++) {
      var v = String(valueOf(problems[i]));
      if (!seen[v]) { seen[v] = true; out.push(v); }
    }
    return out;
  }

  /* ================================================================
     RIDDLE
     ================================================================ */

  /* A small built-in bank, deliberately varied in length (10-30 letters) so
     the best-fit search below has real choices to pick from. Original,
     classroom-appropriate riddles — not sourced from any copyrighted
     worksheet bank. */
  var RIDDLES = [
    { setup: 'Why was the math book sad?', punchline: 'IT HAD TOO MANY PROBLEMS' },
    { setup: 'What did zero say to eight?', punchline: 'NICE BELT' },
    { setup: 'Why was six afraid of seven?', punchline: 'BECAUSE SEVEN EIGHT NINE' },
    { setup: 'Why did the student eat his homework?', punchline: 'THE TEACHER SAID IT WAS A PIECE OF CAKE' },
    { setup: 'Why did the computer go to the doctor?', punchline: 'IT HAD A VIRUS' },
    { setup: 'What kind of tree fits in your hand?', punchline: 'A PALM TREE' },
    { setup: 'Why did the picture go to jail?', punchline: 'IT WAS FRAMED' },
    { setup: 'What has hands but cannot clap?', punchline: 'A CLOCK' },
    { setup: 'Why did the teacher wear sunglasses?', punchline: 'HER STUDENTS WERE TOO BRIGHT' },
    { setup: 'What did one wall say to the other?', punchline: 'I WILL MEET YOU AT THE CORNER' },
    { setup: "Why don't scientists trust atoms?", punchline: 'BECAUSE THEY MAKE UP EVERYTHING' },
    { setup: "What is a snake's favorite subject?", punchline: 'HISSTORY' },
    { setup: 'Why did the bicycle fall over?', punchline: 'IT WAS TWO TIRED' },
    { setup: 'Why did the boy bring a ladder to school?', punchline: 'HE WANTED TO GO TO HIGH SCHOOL' },
    { setup: 'What do you call a number that cannot sit still?', punchline: 'A ROAMING NUMERAL' }
  ];

  function distinctLetters(str) {
    var seen = {}, out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (/[A-Z]/.test(c) && !seen[c]) { seen[c] = true; out.push(c); }
    }
    return out;
  }

  function letterPositionCount(str) { return (str.match(/[A-Z]/g) || []).length; }

  /** Picks the bank riddle whose distinct-letter count fits within how many
      distinct answers the problem set actually has, preferring the one
      whose total letter count is closest to the problem count. Falls back
      to truncating the bank's simplest (fewest distinct letters) riddle
      when even that one doesn't fit — a documented degenerate case for very
      small or very narrow-range problem sets. */
  function pickRiddle(vals, problemCount) {
    var best = null, bestScore = Infinity;
    RIDDLES.forEach(function (r) {
      if (distinctLetters(r.punchline).length > vals.length) return;
      var score = Math.abs(letterPositionCount(r.punchline) - problemCount);
      if (score < bestScore) { bestScore = score; best = r; }
    });
    if (best) return { setup: best.setup, punchline: best.punchline, truncated: false };

    var simplest = RIDDLES.slice().sort(function (a, b) {
      return distinctLetters(a.punchline).length - distinctLetters(b.punchline).length;
    })[0];
    var allowed = Math.max(1, vals.length);
    var seenL = {}, distinctSeen = 0, cut = simplest.punchline.length;
    for (var i = 0; i < simplest.punchline.length; i++) {
      var ch = simplest.punchline[i];
      if (/[A-Z]/.test(ch) && !seenL[ch]) {
        seenL[ch] = true; distinctSeen++;
        if (distinctSeen > allowed) { cut = i; break; }
      }
    }
    var truncated = simplest.punchline.slice(0, cut).replace(/[^A-Z]+$/, '');
    return { setup: simplest.setup, punchline: truncated || simplest.punchline.slice(0, 1), truncated: true };
  }

  /**
   * Builds the riddle for a problem set: which punchline, the per-character
   * layout (letter positions carry the decoder VALUE they need; spaces and
   * punctuation are decorative), and the decoder table (value -> letter)
   * itself. Returns null for an empty problem set.
   */
  function buildRiddle(problems) {
    if (!problems || !problems.length) return null;
    var vals = distinctValues(problems);
    var chosen = pickRiddle(vals, problems.length);

    var letterToValue = {};
    var decoder = [];
    var idx = 0;
    for (var i = 0; i < chosen.punchline.length; i++) {
      var ch = chosen.punchline[i];
      if (/[A-Z]/.test(ch) && letterToValue[ch] === undefined) {
        var v = vals[idx++];
        letterToValue[ch] = v;
        decoder.push({ value: v, letter: ch });
      }
    }
    decoder.sort(function (a, b) {
      var na = parseFloat(a.value), nb = parseFloat(b.value);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return String(a.value).localeCompare(String(b.value));
    });

    var positions = [];
    for (var j = 0; j < chosen.punchline.length; j++) {
      var c = chosen.punchline[j];
      if (/[A-Z]/.test(c)) positions.push({ ch: c, isLetter: true, value: letterToValue[c] });
      else positions.push({ ch: c, isLetter: false, value: null });
    }

    return {
      setup: chosen.setup, punchline: chosen.punchline, truncated: chosen.truncated,
      positions: positions, decoder: decoder
    };
  }

  /* ================================================================
     COLOUR-BY-ANSWER
     ================================================================ */

  /* Hand-authored so the revealed picture is actually recognisable — '#' is
     a filled (numbered, colourable) cell, '.' is background (left blank). */
  var COLOR_PATTERNS = [
    { name: 'Heart', rows: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] },
    { name: 'Star', rows: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
    { name: 'House', rows: ['...#...', '..###..', '.#####.', '#######', '#.#.#.#', '#.....#', '#######'] },
    { name: 'Arrow', rows: ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...', '...#...'] },
    { name: 'Smiley', rows: ['.#####.', '#.#.#.#', '#######', '#.....#', '#.###.#', '#..#..#', '.#####.'] }
  ];

  var PALETTE = [
    { name: 'Red', hex: '#c0392b' },
    { name: 'Orange', hex: '#d68a1f' },
    { name: 'Yellow', hex: '#c9a916' },
    { name: 'Green', hex: '#3f8c4c' },
    { name: 'Blue', hex: '#2f6fa8' },
    { name: 'Purple', hex: '#7d4f9c' },
    { name: 'Brown', hex: '#805a3a' },
    { name: 'Grey', hex: '#6c6f75' }
  ];

  function countFilled(rows) {
    var n = 0;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) if (rows[r][c] === '#') n++;
    return n;
  }

  /**
   * Builds the colour-by-answer grid for a problem set: which picture, the
   * numbered/coloured cell list (row-major, background cells marked
   * `filled: false`), and the value -> colour legend. Returns null for an
   * empty problem set.
   */
  function buildColorByAnswer(problems) {
    if (!problems || !problems.length) return null;
    var vals = distinctValues(problems);

    var best = COLOR_PATTERNS[0], bestScore = Infinity;
    COLOR_PATTERNS.forEach(function (p) {
      var score = Math.abs(countFilled(p.rows) - problems.length);
      if (score < bestScore) { bestScore = score; best = p; }
    });

    var valueColor = {};
    vals.forEach(function (v, i) { valueColor[v] = PALETTE[i % PALETTE.length]; });

    var rows = best.rows.length, cols = best.rows[0].length;
    var cells = [], filledIdx = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (best.rows[r][c] !== '#') { cells.push({ row: r, col: c, filled: false }); continue; }
        var problem = problems[filledIdx % problems.length];
        var value = String(valueOf(problem));
        cells.push({
          row: r, col: c, filled: true,
          problemNum: (filledIdx % problems.length) + 1,
          value: value, color: valueColor[value]
        });
        filledIdx++;
      }
    }

    var legend = vals.map(function (v, i) { return { value: v, color: PALETTE[i % PALETTE.length] }; });
    return { pattern: { name: best.name, rows: rows, cols: cols }, cells: cells, legend: legend };
  }

  /* ================================================================
     MAZE
     ================================================================ */

  var DIRS = [
    { name: 'N', dr: -1, dc: 0, opp: 'S' },
    { name: 'E', dr: 0, dc: 1, opp: 'W' },
    { name: 'S', dr: 1, dc: 0, opp: 'N' },
    { name: 'W', dr: 0, dc: -1, opp: 'E' }
  ];
  var OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
  var DIR_LABEL = { N: 'North (↑)', E: 'East (→)', S: 'South (↓)', W: 'West (←)' };

  /* Sized empirically (see the improvement prompt): a perfect maze's
     corner-to-corner path branches surprisingly rarely, so the grid needs
     to be considerably bigger than the problem count to gate a useful
     fraction of it. These tiers were measured to average roughly 5-8
     junctions — a real, gradeable maze, not the whole problem set, with
     the remainder printed as bonus problems on the same page. */
  function mazeSizeFor(n) {
    if (n <= 8) return { cols: 6, rows: 6 };
    if (n <= 16) return { cols: 8, rows: 7 };
    return { cols: 10, rows: 9 };
  }

  /** Recursive-backtracker maze generation: a perfect maze (spanning tree —
      exactly one path between any two cells, no loops). Each cell tracks
      which of its four sides are still walls. */
  function generateMazeGrid(cols, rows, rng) {
    var cells = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push({ N: true, E: true, S: true, W: true, visited: false });
      cells.push(row);
    }
    var stack = [[0, 0]];
    cells[0][0].visited = true;
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var r2 = cur[0], c2 = cur[1];
      var neighbors = [];
      DIRS.forEach(function (d) {
        var nr = r2 + d.dr, nc = c2 + d.dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !cells[nr][nc].visited) neighbors.push({ d: d, nr: nr, nc: nc });
      });
      if (!neighbors.length) { stack.pop(); continue; }
      var pick = shuffleWithRng(neighbors, rng)[0];
      cells[r2][c2][pick.d.name] = false;
      cells[pick.nr][pick.nc][pick.d.opp] = false;
      cells[pick.nr][pick.nc].visited = true;
      stack.push([pick.nr, pick.nc]);
    }
    return cells;
  }

  /** Plain BFS over the maze's open passages from one cell, every other
      cell's distance and how it was reached. A perfect maze is a spanning
      tree, so this always reaches every cell. */
  function bfsFrom(cells, rows, cols, startR, startC) {
    var key = function (r, c) { return r + ',' + c; };
    var dist = {}, prev = {};
    dist[key(startR, startC)] = 0;
    var queue = [[startR, startC]];
    var farthest = [startR, startC], farthestDist = 0;
    while (queue.length) {
      var cur = queue.shift();
      var r = cur[0], c = cur[1];
      var d = dist[key(r, c)];
      if (d > farthestDist) { farthestDist = d; farthest = [r, c]; }
      DIRS.forEach(function (dir) {
        if (cells[r][c][dir.name]) return;
        var nr = r + dir.dr, nc = c + dir.dc;
        var k = key(nr, nc);
        if (dist[k] !== undefined) return;
        dist[k] = d + 1;
        prev[k] = { from: [r, c], dir: dir.name };
        queue.push([nr, nc]);
      });
    }
    return { prev: prev, farthest: farthest, farthestDist: farthestDist };
  }

  /** The maze's solution path is the TREE'S DIAMETER (the two cells
      farthest apart, found by the standard double-BFS trick: BFS from any
      cell finds one end of the diameter, then BFS from there finds the
      other), not a fixed-corner shortest path. A perfect maze branches
      surprisingly rarely along any one path, and the diameter is reliably
      the longest path available in the tree — which is also the one most
      likely to pass by side branches worth gating with a problem. */
  function solvePath(cells, rows, cols) {
    var first = bfsFrom(cells, rows, cols, 0, 0);
    var second = bfsFrom(cells, rows, cols, first.farthest[0], first.farthest[1]);
    var start = first.farthest, exit = second.farthest;
    var key = function (r, c) { return r + ',' + c; };
    var path = [exit], dirs = [];
    var cur = exit;
    while (!(cur[0] === start[0] && cur[1] === start[1])) {
      var info = second.prev[key(cur[0], cur[1])];
      dirs.push(info.dir);
      cur = info.from;
      path.push(cur);
    }
    path.reverse(); dirs.reverse();
    return { start: start, exit: exit, path: path, dirs: dirs };
  }

  /** A path cell is a junction when it has an open side besides "the way
      the student came from" and "the way forward" — i.e. an actual branch
      into the rest of the maze, not just a corridor or a turn. */
  function findJunctions(cells, path, dirs) {
    var junctions = [];
    for (var i = 0; i < path.length - 1; i++) {
      var r = path[i][0], c = path[i][1];
      var cell = cells[r][c];
      var incoming = i > 0 ? OPPOSITE[dirs[i - 1]] : null;
      var forward = dirs[i];
      var branch = DIRS.filter(function (d) {
        return !cell[d.name] && d.name !== forward && d.name !== incoming;
      }).map(function (d) { return d.name; });
      if (branch.length > 0) junctions.push({ row: r, col: c, continueDir: forward, branchDirs: branch.slice(0, 2) });
    }
    return junctions;
  }

  /** `count` decoy answer values for the junction at `correctIdx`, distinct
      from the correct answer and from each other. Prefers other problems'
      real answers (so decoys still look like plausible drill answers);
      falls back to perturbing the correct value numerically if the set
      doesn't have enough distinct alternatives. */
  function pickDistractors(problems, correctIdx, count, rng) {
    var correctVal = String(valueOf(problems[correctIdx]));
    var seenVals = {}; seenVals[correctVal] = true;
    var pool = [];
    var order = shuffleWithRng(problems.map(function (_, i) { return i; }).filter(function (i) { return i !== correctIdx; }), rng);
    order.forEach(function (i) {
      var v = String(valueOf(problems[i]));
      if (!seenVals[v]) { seenVals[v] = true; pool.push(v); }
    });
    var guard = 0;
    while (pool.length < count && guard < 50) {
      guard++;
      var num = parseFloat(correctVal);
      if (!isNaN(num)) {
        var delta = Math.ceil(guard / 2) * (guard % 2 === 0 ? -1 : 1);
        var cand = String(Math.round((num + delta) * 100) / 100);
        if (!seenVals[cand]) { seenVals[cand] = true; pool.push(cand); }
      } else if (!seenVals[correctVal + ' (2)']) {
        seenVals[correctVal + ' (2)'] = true; pool.push(correctVal + ' (2)');
      }
    }
    return pool.slice(0, count);
  }

  /**
   * Builds a maze for a problem set: a small generated grid maze, its
   * unique solution path, and which problems gate which junctions along
   * that path. Problems beyond what the maze can use as junctions come
   * back as `bonus` (still real, still gradeable, just not part of the
   * maze itself). Returns null for an empty problem set.
   *
   * options.seed — reused from the sheet's own seed so "Lock seed" also
   *   reproduces the same maze.
   */
  function buildMaze(problems, options) {
    if (!problems || !problems.length) return null;
    options = options || {};
    var rng = makeRng(options.seed);
    var size = mazeSizeFor(problems.length);

    // Generate a handful of candidate mazes and keep the one whose solution
    // path passes the most junctions — a perfect maze's branching is
    // uneven, and a fixed grid size can land anywhere from 1 to a dozen
    // junctions depending on how the walls happen to fall.
    var bestCells = null, bestSolved = null, bestJunctions = [];
    for (var attempt = 0; attempt < 6; attempt++) {
      var cells = generateMazeGrid(size.cols, size.rows, rng);
      var solved = solvePath(cells, size.rows, size.cols);
      var junctions = findJunctions(cells, solved.path, solved.dirs);
      if (junctions.length > bestJunctions.length) {
        bestCells = cells; bestSolved = solved; bestJunctions = junctions;
      }
    }

    var used = bestJunctions.slice(0, problems.length);
    var junctionData = used.map(function (j, idx) {
      var problem = problems[idx];
      var correctVal = String(valueOf(problem));
      var decoys = pickDistractors(problems, idx, j.branchDirs.length, rng);
      var choices = [{ dir: j.continueDir, value: correctVal, correct: true }];
      j.branchDirs.forEach(function (d, k) { choices.push({ dir: d, value: decoys[k], correct: false }); });
      return { row: j.row, col: j.col, problem: problem, choices: shuffleWithRng(choices, rng) };
    });

    return {
      cols: size.cols, rows: size.rows, cells: bestCells,
      start: bestSolved.start, exit: bestSolved.exit, path: bestSolved.path,
      junctions: junctionData, bonus: problems.slice(used.length)
    };
  }

  global.MathDrillSelfCheck = {
    buildRiddle: buildRiddle, buildColorByAnswer: buildColorByAnswer, buildMaze: buildMaze,
    RIDDLES: RIDDLES, COLOR_PATTERNS: COLOR_PATTERNS, PALETTE: PALETTE, DIR_LABEL: DIR_LABEL,
    distinctValues: distinctValues, makeRng: makeRng, shuffleWithRng: shuffleWithRng,
    /* exported for direct unit-testing of the maze internals */
    mazeSizeFor: mazeSizeFor, generateMazeGrid: generateMazeGrid, solvePath: solvePath, findJunctions: findJunctions
  };
})(typeof window !== 'undefined' ? window : global);
