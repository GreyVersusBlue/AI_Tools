/* Quiz / Review Game Board — play modes and printed sheets (Path 12 P3,
   increments 1, 2 and 3, v281, v284 and v286). Publishes window.ReviewBoardPlay. Stores nothing and
   reads nothing: the page hands in a board or a list of questions and saves
   the board itself, as it always has.

   EVERY TEAM ANSWERS
   The board's own game gives a clue to ONE team: the answer is shown and the
   teacher presses that team's button. With `everyTeam: true` on a board,
   every team answers every clue instead. When the answer is shown the
   teacher marks each team right ('r'), wrong ('w') or no answer ('n'), and
   one press scores the clue. THE RULE, which the page states in words: a
   right answer scores the clue's points; a wrong answer and no answer score
   nothing. A wrong answer is told from no answer only in the count each team
   shows. A Daily Double is still one team's wager, as before.

   What a board gains, and only once the mode has been used on it:
     board.everyTeam   true while the mode is on (false after it is turned
                       off; absent on a board that never used it)
     clue.marks        ['r', 'w', 'n', ...], one a team in the scoreboard's
                       order, on a clue scored in the mode
   A board without either is the board it was, and nothing here adds them.

   THE PRINTED SHEETS
   A practice quiz (the questions with room to answer, then the answer key
   starting a new page) and a study guide (each question with its answer
   beside it), from a board's clues or from questions of the bank. Questions
   are grouped: a board's by category, the bank's by unit, each group in the
   order it first appears; the numbers run through the groups, so a key's
   number is the quiz's. sheetModel() is plain data, which the Node suite
   reads; buildSheet() turns it into elements. EVERY TEXT REACHES THE PAGE
   THROUGH textContent: a question, an answer, a choice, a category and a
   board's name are never parsed as markup.

   THE FINAL WAGER ROUND (increment 2, v284)
   One last question after the board. `board.final` appears once the tick box
   has been used: { on, question, answer } and, once the round is scored,
   { wagers, marks, deltas }, one a team in the scoreboard's order. THE RULE,
   which the page states: a team wagers a whole number from 0 up to its score;
   a team at 0 or below may wager up to FINAL_FLOOR (100). Right adds the
   wager, wrong takes it off. Wagers in progress are never stored.

   QUIZ-BOWL (increment 2, v284)
   Toss-up questions open to every team; the TEACHER records the buzz. A
   wrong answer locks that team out of the question and costs `penalty`
   (0 unless the teacher sets it); a right one scores `tossup` and earns that
   team alone a bonus question worth `bonus`. `board.quizBowl` appears once
   the tick box has been used: { on, source, tossup, bonus, penalty, log,
   over }, the log one entry a toss-up asked: { id, wrong: [team], right:
   team or null, bonusId, bonus: 'r', 'w' or null }. IDS are stored, never a
   question's words; what an entry scored is worked out from it (qbDeltas),
   which is why the page locks the three point values once a round has begun.

   SPIN THE WHEEL (increment 3, v286)
   Instead of a team choosing a clue, a spin chooses one. THE RULE, which the
   page states: the wheel has one wedge for every clue not yet played, and
   one more for each extra wedge the teacher has turned on (Lose a turn,
   Double points; both off to start); every wedge is as likely as any other.
   `board.wheel` appears once the tick box has been used: { on, seed, spins,
   lose, double, doubleNext, last }. THE DRAW IS NOT CHANCE AT PLAY TIME: spin
   number n of a game is worked out from the stored seed and n alone
   (wheelDraw), so the same board with the same seed gives the same sequence
   of spins, and a reload between spins changes nothing. `spins` is how many
   have been made; `last` is the last one ({ n, kind: 'clue' | 'lose' |
   'double', cat, clue }, the two indexes on a clue only); `doubleNext` is
   true from a Double points spin until the next clue is played, and that
   clue is worth twice its points (wheelWorth). The wheel on the page is only
   a picture of the draw.

   Plain global script, as the page's other modules are. */
(function (global) {
  'use strict';

  var MARKS = ['r', 'w', 'n'];
  var WORDS = { r: 'right', w: 'wrong', n: 'no answer' };
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function text(v) { return v === null || v === undefined ? '' : String(v); }
  function same(a, b) {
    var norm = function (s) { return text(s).trim().replace(/\s+/g, ' ').toLowerCase(); };
    return norm(a) !== '' && norm(a) === norm(b);
  }

  /* ---------- every team answers ---------- */

  /** A list of marks for `teamCount` teams: anything that is not 'r' or 'w'
      is 'n', a short list is filled with 'n', a long one is cut. Null when
      `marks` is not a list at all (a clue never scored in the mode). */
  function cleanMarks(marks, teamCount) {
    if (!Array.isArray(marks)) return null;
    var n = Math.max(0, Math.floor(Number(teamCount)) || 0), out = [];
    for (var i = 0; i < n; i++) out.push(marks[i] === 'r' || marks[i] === 'w' ? marks[i] : 'n');
    return out;
  }

  /** What each team gains on a clue of `points`: the points for a right
      answer, nothing for a wrong one or none. */
  function score(points, marks) {
    var worth = Number(points) || 0;
    return (Array.isArray(marks) ? marks : []).map(function (m) { return m === 'r' ? worth : 0; });
  }

  /** The mark a number key moves a team to: no answer, right, wrong, round. */
  function nextMark(mark) {
    return mark === 'r' ? 'w' : mark === 'w' ? 'n' : 'r';
  }

  function markWord(mark) { return WORDS[mark] || WORDS.n; }

  function names(list) {
    if (list.length < 2) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  /** One sentence for the status line once a clue is scored:
      'Deltas 100. Right, +100: Otters and Herons. Wrong: Finches. No answer: Wrens.' */
  function summary(label, points, teamNames, marks) {
    var by = { r: [], w: [], n: [] };
    (teamNames || []).forEach(function (name, i) { by[marks[i] === 'r' || marks[i] === 'w' ? marks[i] : 'n'].push(text(name)); });
    var parts = [text(label) + '.'];
    parts.push(by.r.length ? 'Right, +' + (Number(points) || 0) + ': ' + names(by.r) + '.' : 'No team was right.');
    if (by.w.length) parts.push('Wrong: ' + names(by.w) + '.');
    if (by.n.length) parts.push('No answer: ' + names(by.n) + '.');
    return parts.join(' ');
  }

  /** How each team has answered so far: [{ right, wrong, none }], one a team. */
  function tally(categories, teamCount) {
    var out = [];
    for (var i = 0; i < teamCount; i++) out.push({ right: 0, wrong: 0, none: 0 });
    (categories || []).forEach(function (c) {
      ((c && c.clues) || []).forEach(function (cl) {
        var marks = cleanMarks(cl && cl.marks, teamCount);
        if (!marks) return;
        marks.forEach(function (m, t) { out[t][m === 'r' ? 'right' : m === 'w' ? 'wrong' : 'none']++; });
      });
    });
    return out;
  }

  function tallyLine(t) {
    return t.right + ' right · ' + t.wrong + ' wrong · ' + t.none + ' no answer';
  }

  function eachMarked(categories, fn) {
    (categories || []).forEach(function (c) {
      ((c && c.clues) || []).forEach(function (cl) { if (cl && Array.isArray(cl.marks)) fn(cl); });
    });
  }

  /** A team left the scoreboard: its mark leaves every scored clue, so the
      marks still line up with the teams. Changes `categories` in place. */
  function dropTeam(categories, index) {
    eachMarked(categories, function (cl) { if (index >= 0 && index < cl.marks.length) cl.marks.splice(index, 1); });
  }

  /** Reset game: no clue is scored any more. Changes `categories` in place. */
  function clearMarks(categories) {
    eachMarked(categories, function (cl) { delete cl.marks; });
  }

  /* ---------- the printed sheets ---------- */

  /** A board's clues as sheet items. `imageUrl(value)` gives a picture's
      address, or '' when it is not in this browser. */
  function itemsFromBoard(board, imageUrl) {
    var items = [];
    ((board && board.categories) || []).forEach(function (cat) {
      ((cat && cat.clues) || []).forEach(function (cl) {
        items.push({
          group: text(cat.name), prompt: text(cl.question), answer: text(cl.answer), choices: [],
          image: imageUrl ? text(imageUrl(cl.image)) : '', audio: !!cl.audioId
        });
      });
    });
    return items;
  }

  /** Questions of the bank (or of a built-in set) as sheet items. One with
      no question is left out: there is nothing to print. */
  function itemsFromQuestions(list) {
    return (list || []).filter(function (q) { return q && text(q.prompt).trim() !== ''; }).map(function (q) {
      return {
        group: text(q.unit).trim(), prompt: text(q.prompt), answer: text(q.answer),
        choices: (Array.isArray(q.choices) ? q.choices : []).map(text).filter(function (c) { return c.trim() !== ''; }),
        image: '', audio: false
      };
    });
  }

  /** 'B' when the answer is the second choice (letters and spacing aside),
      '' when it is none of them or there are more choices than letters. */
  function answerLetter(choices, answer) {
    for (var i = 0; i < (choices || []).length && i < LETTERS.length; i++) {
      if (same(choices[i], answer)) return LETTERS.charAt(i);
    }
    return '';
  }

  /** `kind` is 'quiz' or 'guide'. Returns plain data:
      { kind, title, heading, count, groups: [{ name, items: [{ n, prompt,
        answer, choices, letter, image, audio }] }] }
      Groups are in the order they first appear; `n` runs through them. */
  function sheetModel(kind, title, items) {
    var groups = [], byName = {};
    (items || []).forEach(function (item) {
      var key = 'g:' + text(item.group);
      if (!byName[key]) { byName[key] = { name: text(item.group), items: [] }; groups.push(byName[key]); }
      byName[key].items.push(item);
    });
    var n = 0;
    groups.forEach(function (g) {
      g.items = g.items.map(function (item) {
        n++;
        var choices = (item.choices || []).slice(0, LETTERS.length);
        return {
          n: n, prompt: text(item.prompt), answer: text(item.answer), choices: choices,
          letter: answerLetter(choices, item.answer), image: text(item.image), audio: !!item.audio
        };
      });
    });
    var guide = kind === 'guide', name = text(title).trim() || 'Questions';
    return {
      kind: guide ? 'guide' : 'quiz', title: name,
      heading: name + (guide ? ' — Study Guide' : ' — Practice Quiz'),
      keyHeading: name + ' — Answer Key',
      count: n, groups: groups
    };
  }

  /** What the key (and the guide's answer column) says for one item. */
  function answerText(item) {
    if (item.answer.trim() === '') return '';
    return (item.letter ? item.letter + '. ' : '') + item.answer;
  }

  function el(doc, tag, className, content) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = content;
    return node;
  }

  function promptLine(doc, item, tag) {
    var p = el(doc, tag, 'pq-q');
    p.appendChild(el(doc, 'b', '', item.n + '.'));
    p.appendChild(doc.createTextNode(' ' + item.prompt));
    if (item.audio) p.appendChild(el(doc, 'em', '', ' (audio clip: play it from the device)'));
    return p;
  }

  function choiceList(doc, item) {
    var list = el(doc, 'ol', 'pq-choices');
    list.setAttribute('type', 'A');
    item.choices.forEach(function (c) { list.appendChild(el(doc, 'li', '', c)); });
    return list;
  }

  function picture(doc, item, className) {
    var img = el(doc, 'img', className);
    img.setAttribute('alt', '');
    img.setAttribute('src', item.image);
    return img;
  }

  function answerNode(doc, item, tag, className) {
    var shown = answerText(item);
    var node = el(doc, tag, className, shown);
    if (!shown) node.appendChild(el(doc, 'em', '', '(no answer given)'));
    return node;
  }

  function groupHeading(doc, group) {
    return group.name ? el(doc, 'h3', 'pq-group', group.name) : null;
  }

  function quizSection(doc, model) {
    var sec = el(doc, 'section', 'pq-sheet pq-quiz');
    sec.appendChild(el(doc, 'h2', '', model.heading));
    sec.appendChild(el(doc, 'p', 'pq-sub', 'Name: _____________________________    Date: ______________'));
    model.groups.forEach(function (g) {
      var h = groupHeading(doc, g);
      if (h) sec.appendChild(h);
      g.items.forEach(function (item) {
        var box = el(doc, 'div', 'pq-item');
        box.appendChild(promptLine(doc, item, 'p'));
        if (item.image) box.appendChild(picture(doc, item, 'quiz-img'));
        if (item.choices.length) box.appendChild(choiceList(doc, item));
        var lines = el(doc, 'div', 'pq-lines');
        lines.appendChild(el(doc, 'div', 'pq-line'));
        if (!item.choices.length) lines.appendChild(el(doc, 'div', 'pq-line'));
        box.appendChild(lines);
        sec.appendChild(box);
      });
    });
    return sec;
  }

  function keySection(doc, model) {
    var sec = el(doc, 'section', 'pq-sheet pq-key');
    sec.appendChild(el(doc, 'h2', '', model.keyHeading));
    model.groups.forEach(function (g) {
      var h = groupHeading(doc, g);
      if (h) sec.appendChild(h);
      g.items.forEach(function (item) {
        var row = el(doc, 'p', 'pq-key-row');
        row.appendChild(el(doc, 'b', '', item.n + '.'));
        row.appendChild(doc.createTextNode(' '));
        row.appendChild(answerNode(doc, item, 'span', 'pq-key-answer'));
        sec.appendChild(row);
      });
    });
    return sec;
  }

  function guideSection(doc, model) {
    var sec = el(doc, 'section', 'pq-sheet pq-guide');
    sec.appendChild(el(doc, 'h2', '', model.heading));
    sec.appendChild(el(doc, 'p', 'pq-sub', model.count + (model.count === 1 ? ' question' : ' questions') + ', each with its answer beside it.'));
    model.groups.forEach(function (g) {
      var h = groupHeading(doc, g);
      if (h) sec.appendChild(h);
      var table = el(doc, 'table', 'pq-guide-table'), head = el(doc, 'thead'), hr = el(doc, 'tr');
      ['Question', 'Answer'].forEach(function (t) { var th = el(doc, 'th', '', t); th.setAttribute('scope', 'col'); hr.appendChild(th); });
      head.appendChild(hr);
      table.appendChild(head);
      var body = el(doc, 'tbody');
      g.items.forEach(function (item) {
        var tr = el(doc, 'tr'), q = el(doc, 'td', 'pq-guide-q');
        q.appendChild(promptLine(doc, item, 'div'));
        if (item.image) q.appendChild(picture(doc, item, 'key-img'));
        if (item.choices.length) q.appendChild(choiceList(doc, item));
        tr.appendChild(q);
        tr.appendChild(answerNode(doc, item, 'td', 'pq-guide-a'));
        body.appendChild(tr);
      });
      table.appendChild(body);
      sec.appendChild(table);
    });
    return sec;
  }

  /** The sheet as elements, in a fragment: a quiz and then its key (which
      the page's CSS starts on a new page), or a study guide. */
  function buildSheet(doc, model) {
    var frag = doc.createDocumentFragment();
    if (model.kind === 'guide') {
      frag.appendChild(guideSection(doc, model));
    } else {
      frag.appendChild(quizSection(doc, model));
      frag.appendChild(keySection(doc, model));
    }
    return frag;
  }

  /** What a status line says once a sheet is built. */
  function sheetSentence(model) {
    var n = model.count + (model.count === 1 ? ' question' : ' questions');
    return model.kind === 'guide'
      ? 'Built a study guide of ' + n + ', each with its answer beside it.'
      : 'Built a practice quiz of ' + n + ', with the answer key on a page of its own.';
  }

  /* ---------- who is ahead, in words ---------- */

  function pointsWord(n) { return n + (n === 1 || n === -1 ? ' point' : ' points'); }

  /** Teams from the highest score down, a tie sharing a place:
      [{ index, name, score, place }]. Equal scores keep the scoreboard's order. */
  function standings(teamNames, scores) {
    var rows = (teamNames || []).map(function (name, i) { return { index: i, name: text(name), score: Number(scores && scores[i]) || 0 }; });
    rows.sort(function (a, b) { return b.score - a.score || a.index - b.index; });
    rows.forEach(function (row, i) { row.place = i && rows[i - 1].score === row.score ? rows[i - 1].place : i + 1; });
    return rows;
  }

  /** The winner, or the tie, in words:
      'Otters win with 500 points.'
      'Otters and Herons tie for first place with 400 points each.' */
  function resultSentence(teamNames, scores) {
    var rows = standings(teamNames, scores);
    if (!rows.length) return '';
    var first = rows.filter(function (r) { return r.place === 1; });
    if (rows.length === 1) return first[0].name + ' finish with ' + pointsWord(first[0].score) + '.';
    if (first.length === 1) return first[0].name + ' win with ' + pointsWord(first[0].score) + '.';
    return names(first.map(function (r) { return r.name; })) + ' tie for first place with ' + pointsWord(first[0].score) + ' each.';
  }

  /* ---------- the final wager round ---------- */

  var FINAL_FLOOR = 100;
  var TEXT_MAX = 2000;

  /** The most a team at `score` may wager: its score, or FINAL_FLOOR when it
      has nothing to wager. */
  function wagerMax(score) {
    var s = Math.floor(Number(score) || 0);
    return s > 0 ? s : FINAL_FLOOR;
  }

  /** What a teacher typed as one team's wager: { ok, value, why }. */
  function readWager(typed, score) {
    var t = text(typed).trim(), max = wagerMax(score);
    if (t === '') return { ok: false, value: null, why: 'no wager yet' };
    if (!/^\d{1,9}$/.test(t)) return { ok: false, value: null, why: 'a wager is a whole number, 0 or more' };
    if (Number(t) > max) return { ok: false, value: null, why: 'the most this team may wager is ' + max };
    return { ok: true, value: Number(t), why: '' };
  }

  /** What the round does to each score: the wager on for right, off for
      wrong, nothing for a team that did not play ('n'). */
  function finalDeltas(wagers, marks) {
    return (wagers || []).map(function (w, i) {
      var n = Number(w) || 0, m = marks && marks[i];
      return m === 'r' ? n : m === 'w' ? -n : 0;
    });
  }

  /** The teams (by index) not yet marked right or wrong. */
  function finalUnmarked(marks, teamCount) {
    var out = [];
    for (var i = 0; i < teamCount; i++) if (!marks || (marks[i] !== 'r' && marks[i] !== 'w')) out.push(i);
    return out;
  }

  /** One line a team for the result screen:
      'Otters wagered 200 and were right: +200, now 500.' */
  function finalLines(teamNames, scoresAfter, wagers, marks) {
    var deltas = finalDeltas(wagers, marks);
    return (teamNames || []).map(function (name, i) {
      var m = marks && marks[i];
      if (m !== 'r' && m !== 'w') return text(name) + ' did not play the final round: ' + (Number(scoresAfter[i]) || 0) + '.';
      return text(name) + ' wagered ' + (Number(wagers[i]) || 0) + ' and were ' + (m === 'r' ? 'right' : 'wrong') + ': ' +
        (deltas[i] >= 0 ? '+' : '−') + Math.abs(deltas[i]) + ', now ' + (Number(scoresAfter[i]) || 0) + '.';
    });
  }

  function plainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function clip(v) { return typeof v === 'string' ? v.slice(0, TEXT_MAX) : ''; }

  /** `board.final` from anywhere (a file): null when it is not one. The
      played half is kept only whole, and what it scored is worked out again,
      never taken from the file. */
  function cleanFinal(raw, teamCount) {
    if (!plainObject(raw)) return null;
    var out = { on: raw.on === true, question: clip(raw.question), answer: clip(raw.answer) };
    var n = Math.max(0, Math.floor(Number(teamCount)) || 0);
    if (Array.isArray(raw.wagers) && Array.isArray(raw.marks) && Array.isArray(raw.deltas) && n) {
      var wagers = [], marks = cleanMarks(raw.marks, n);
      for (var i = 0; i < n; i++) {
        var w = Math.floor(Number(raw.wagers[i]));
        wagers.push(w >= 0 && w <= 999999999 ? w : 0);
      }
      out.wagers = wagers;
      out.marks = marks;
      out.deltas = finalDeltas(wagers, marks);
    }
    return out;
  }

  function finalPlayed(final) { return !!final && Array.isArray(final.deltas); }

  /** Reset game, or the round taken back: the question stays, the play goes. */
  function finalClear(final) {
    if (!final) return;
    delete final.wagers; delete final.marks; delete final.deltas;
  }

  /* ---------- quiz-bowl ---------- */

  var QB_DEFAULTS = { tossup: 10, bonus: 10, penalty: 0 };
  var QB_MAX = 1000;

  function qbPoints(v, fallback) {
    var n = Math.floor(Number(v));
    return text(v).trim() !== '' && n >= 0 && n <= QB_MAX ? n : fallback;
  }

  function teamIndex(v, teamCount) {
    return typeof v === 'number' && Math.floor(v) === v && v >= 0 && v < teamCount ? v : null;
  }

  function qbNew() {
    return { on: true, source: '', tossup: QB_DEFAULTS.tossup, bonus: QB_DEFAULTS.bonus, penalty: QB_DEFAULTS.penalty, log: [], over: false };
  }

  /** A toss-up just read: nobody has buzzed. */
  function qbStart(id) { return { id: text(id), wrong: [], right: null, bonusId: null, bonus: null }; }

  function qbCleanEntry(raw, teamCount) {
    if (!plainObject(raw) || typeof raw.id !== 'string' || raw.id === '' || raw.id.length > 200) return null;
    var out = qbStart(raw.id);
    (Array.isArray(raw.wrong) ? raw.wrong : []).forEach(function (t) {
      var i = teamIndex(t, teamCount);
      if (i !== null && out.wrong.indexOf(i) === -1) out.wrong.push(i);
    });
    var right = teamIndex(raw.right, teamCount);
    if (right !== null && out.wrong.indexOf(right) === -1) out.right = right;
    if (out.right !== null && typeof raw.bonusId === 'string' && raw.bonusId !== '' && raw.bonusId.length <= 200 && raw.bonusId !== out.id) {
      out.bonusId = raw.bonusId;
      if (raw.bonus === 'r' || raw.bonus === 'w') out.bonus = raw.bonus;
    }
    return out;
  }

  /** `board.quizBowl` from anywhere (a file): null when it is not one. No
      question is in the log twice. */
  function cleanQuizBowl(raw, teamCount) {
    if (!plainObject(raw)) return null;
    var n = Math.max(0, Math.floor(Number(teamCount)) || 0), seen = {}, out = qbNew();
    out.on = raw.on === true;
    out.source = typeof raw.source === 'string' ? raw.source.slice(0, 200) : '';
    out.tossup = qbPoints(raw.tossup, QB_DEFAULTS.tossup);
    out.bonus = qbPoints(raw.bonus, QB_DEFAULTS.bonus);
    out.penalty = qbPoints(raw.penalty, QB_DEFAULTS.penalty);
    out.over = raw.over === true;
    (Array.isArray(raw.log) ? raw.log : []).slice(0, 2000).forEach(function (e) {
      var entry = qbCleanEntry(e, n);
      if (!entry || seen['i:' + entry.id]) return;
      if (entry.bonusId && seen['i:' + entry.bonusId]) { entry.bonusId = null; entry.bonus = null; }
      seen['i:' + entry.id] = true;
      if (entry.bonusId) seen['i:' + entry.bonusId] = true;
      out.log.push(entry);
    });
    return out;
  }

  /** The teams (by index) that may still buzz on this toss-up. */
  function qbOpen(entry, teamCount) {
    var out = [];
    if (!entry || entry.right !== null) return out;
    for (var i = 0; i < teamCount; i++) if (entry.wrong.indexOf(i) === -1) out.push(i);
    return out;
  }

  /** `team` buzzed and was right or wrong. Returns a new entry; the same one
      when that team may not buzz (locked out, or the toss-up is won). */
  function qbBuzz(entry, team, right, teamCount) {
    if (qbOpen(entry, teamCount).indexOf(team) === -1) return entry;
    var out = { id: entry.id, wrong: entry.wrong.slice(), right: entry.right, bonusId: entry.bonusId, bonus: entry.bonus };
    if (right) out.right = team; else out.wrong.push(team);
    return out;
  }

  /** The bonus question shown to the team that won the toss-up, and then its
      mark. Returns a new entry; the same one when there is no winner. */
  function qbBonus(entry, bonusId, mark) {
    if (!entry || entry.right === null || !text(bonusId) || text(bonusId) === entry.id) return entry;
    return { id: entry.id, wrong: entry.wrong.slice(), right: entry.right, bonusId: text(bonusId), bonus: mark === 'r' || mark === 'w' ? mark : null };
  }

  /** What one toss-up (and its bonus) did to each team's score. */
  function qbDeltas(entry, round, teamCount) {
    var out = [];
    for (var i = 0; i < teamCount; i++) out.push(0);
    if (!entry || !round) return out;
    entry.wrong.forEach(function (t) { if (t < teamCount) out[t] -= round.penalty; });
    if (entry.right !== null && entry.right < teamCount) {
      out[entry.right] += round.tossup;
      if (entry.bonus === 'r') out[entry.right] += round.bonus;
    }
    return out;
  }

  /** Every id the round has used, as a toss-up or as a bonus. */
  function qbAsked(round) {
    var ids = [];
    ((round && round.log) || []).forEach(function (e) { ids.push(e.id); if (e.bonusId) ids.push(e.bonusId); });
    return ids;
  }

  /** The next question of `ids` (the source's order) not yet used, nor in
      `alsoUsed` (the toss-up on the screen). '' when the source has run out. */
  function qbNextId(ids, round, alsoUsed) {
    var used = {};
    qbAsked(round).concat(alsoUsed || []).forEach(function (id) { used['i:' + id] = true; });
    for (var i = 0; i < (ids || []).length; i++) if (!used['i:' + ids[i]]) return text(ids[i]);
    return '';
  }

  function qbLeft(ids, round, alsoUsed) {
    var used = {}, n = 0;
    qbAsked(round).concat(alsoUsed || []).forEach(function (id) { used['i:' + id] = true; });
    (ids || []).forEach(function (id) { if (!used['i:' + id]) n++; });
    return n;
  }

  /** The round so far, a team: [{ tossups, bonuses, wrong, points }]. */
  function qbTotals(round, teamCount) {
    var out = [];
    for (var i = 0; i < teamCount; i++) out.push({ tossups: 0, bonuses: 0, wrong: 0, points: 0 });
    ((round && round.log) || []).forEach(function (e) {
      e.wrong.forEach(function (t) { if (out[t]) out[t].wrong++; });
      if (e.right !== null && out[e.right]) { out[e.right].tossups++; if (e.bonus === 'r') out[e.right].bonuses++; }
      qbDeltas(e, round, teamCount).forEach(function (d, t) { out[t].points += d; });
    });
    return out;
  }

  function countWord(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /** The end-of-round summary: { asked, dead, lines: [a team], sentence }. */
  function qbSummary(round, teamNames) {
    var log = (round && round.log) || [], totals = qbTotals(round, (teamNames || []).length);
    var dead = log.filter(function (e) { return e.right === null; }).length;
    return {
      asked: log.length, dead: dead,
      lines: (teamNames || []).map(function (name, i) {
        var t = totals[i];
        return text(name) + ': ' + countWord(t.tossups, 'toss-up', 'toss-ups') + ', ' + countWord(t.bonuses, 'bonus', 'bonuses') + ', ' +
          countWord(t.wrong, 'wrong buzz', 'wrong buzzes') + ', ' + pointsWord(t.points) + ' this round.';
      }),
      sentence: countWord(log.length, 'toss-up', 'toss-ups') + ' asked; ' + (dead === 0 ? 'every one was answered.' : dead + ' went unanswered.'),
      roundResult: log.length ? 'This round: ' + resultSentence(teamNames, totals.map(function (t) { return t.points; })) : ''
    };
  }

  /** A team left the scoreboard: the rounds' lists still line up with the
      teams. Changes `board` in place. */
  function dropTeamFromRounds(board, index) {
    if (!board || index < 0) return;
    var f = board.final;
    if (finalPlayed(f)) ['wagers', 'marks', 'deltas'].forEach(function (k) { if (index < f[k].length) f[k].splice(index, 1); });
    var shift = function (t) { return t > index ? t - 1 : t; };
    ((board.quizBowl && board.quizBowl.log) || []).forEach(function (e) {
      e.wrong = e.wrong.filter(function (t) { return t !== index; }).map(shift);
      if (e.right === index) { e.right = null; e.bonusId = null; e.bonus = null; }
      else if (e.right !== null) e.right = shift(e.right);
    });
  }

  /* ---------- spin the wheel ---------- */

  var WHEEL_SEED_MAX = 64;
  var WHEEL_SPINS_MAX = 100000;

  function hash32(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /** Spin `n` (1, 2, 3...) of the game with this seed, over `count` wedges:
      a whole number from 0 to count - 1, each as likely as any other (a draw
      that would favour the low wedges is thrown away and drawn again). The
      same seed, n and count always give the same wedge. -1 when there is no
      wedge. */
  function wheelDraw(seed, n, count) {
    count = Math.floor(Number(count)) || 0;
    if (count < 1) return -1;
    var a = hash32(text(seed) + '\n' + (Math.floor(Number(n)) || 0)), limit = Math.floor(4294967296 / count) * count, v = 0;
    for (var i = 0; i < 64; i++) {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      v = (t ^ (t >>> 14)) >>> 0;
      if (v < limit) break;
    }
    return v % count;
  }

  function wheelNew(seed) {
    return { on: true, seed: text(seed).slice(0, WHEEL_SEED_MAX), spins: 0, lose: false, double: false, doubleNext: false, last: null };
  }

  /** The wedges, in the order they sit on the wheel: every clue not yet
      played, category by category, then Lose a turn and Double points when
      the teacher has turned them on. No unplayed clue, no wheel: []. */
  function wheelWedges(categories, wheel) {
    var out = [];
    (categories || []).forEach(function (c, ci) {
      ((c && c.clues) || []).forEach(function (cl, ki) {
        if (cl && !cl.used) out.push({ kind: 'clue', cat: ci, clue: ki, label: text(c.name) + ' for ' + (Number(cl.points) || 0) });
      });
    });
    if (!out.length) return out;
    if (wheel && wheel.lose) out.push({ kind: 'lose', label: 'Lose a turn' });
    if (wheel && wheel.double) out.push({ kind: 'double', label: 'Double points' });
    return out;
  }

  /** The next spin of this board, not yet recorded: { n, index, count,
      wedge }. Null when every clue has been played. */
  function wheelSpin(categories, wheel) {
    var wedges = wheelWedges(categories, wheel);
    if (!wheel || !wedges.length) return null;
    var n = (Math.floor(Number(wheel.spins)) || 0) + 1, index = wheelDraw(wheel.seed, n, wedges.length);
    return { n: n, index: index, count: wedges.length, wedge: wedges[index] };
  }

  /** Records a spin on the wheel. Changes `wheel` in place. */
  function wheelApply(wheel, spin) {
    if (!wheel || !spin) return;
    wheel.spins = spin.n;
    wheel.last = spin.wedge.kind === 'clue'
      ? { n: spin.n, kind: 'clue', cat: spin.wedge.cat, clue: spin.wedge.clue }
      : { n: spin.n, kind: spin.wedge.kind };
    if (spin.wedge.kind === 'double') wheel.doubleNext = true;
  }

  /** What a clue of `points` is worth now: twice as much while a Double
      points spin is waiting, and exactly `points` otherwise. */
  function wheelWorth(points, wheel) {
    return wheel && wheel.on && wheel.doubleNext === true ? (Number(points) || 0) * 2 : points;
  }

  /** The clue the last spin landed on, while it is still unplayed:
      { cat, clue }, or null. */
  function wheelLanded(categories, wheel) {
    var last = wheel && wheel.on && wheel.last;
    if (!last || last.kind !== 'clue') return null;
    var c = (categories || [])[last.cat], cl = c && c.clues && c.clues[last.clue];
    return cl && !cl.used ? { cat: last.cat, clue: last.clue } : null;
  }

  /** A spin, in words, for the status line and a screen reader:
      'Spin 3: Rivers for 200. Press Enter to open it.' */
  function wheelSentence(spin, wheel) {
    if (!spin) return 'Every clue has been played: there is nothing left to spin for.';
    var head = 'Spin ' + spin.n + ': ' + spin.wedge.label + '.';
    if (spin.wedge.kind === 'lose') return head + ' No clue this spin.';
    if (spin.wedge.kind === 'double') return head + ' The next clue played is worth double.';
    return head + (wheel && wheel.doubleNext ? ' Double points: it is worth twice that.' : '') + ' Press Enter to open it.';
  }

  /** The odds, in words, as the wheel now stands. */
  function wheelOdds(categories, wheel) {
    var wedges = wheelWedges(categories, wheel), n = wedges.length;
    if (!n) return 'Every clue has been played, so there is nothing to spin for.';
    var clues = wedges.filter(function (w) { return w.kind === 'clue'; }).length, extra = n - clues;
    return countWord(clues, 'clue', 'clues') + ' not yet played' + (extra ? ' and ' + countWord(extra, 'extra wedge', 'extra wedges') : '') + ': ' +
      (n === 1 ? 'the wheel has one wedge, so the spin lands on it.' : 'the wheel has ' + n + ' wedges, and a spin is as likely to land on one as on any other (1 in ' + n + ').');
  }

  /** `board.wheel` from anywhere (a file): null when it is not one. The last
      spin is kept only when it is the spin the count says and, for a clue,
      names a clue the board has. */
  function cleanWheel(raw, categories) {
    if (!plainObject(raw)) return null;
    var out = wheelNew(typeof raw.seed === 'string' ? raw.seed : '');
    var spins = Math.floor(Number(raw.spins));
    out.on = raw.on === true;
    out.spins = spins >= 0 && spins <= WHEEL_SPINS_MAX ? spins : 0;
    out.lose = raw.lose === true;
    out.double = raw.double === true;
    out.doubleNext = raw.doubleNext === true;
    var last = raw.last;
    if (plainObject(last) && last.n === out.spins && out.spins > 0) {
      if (last.kind === 'lose' || last.kind === 'double') out.last = { n: last.n, kind: last.kind };
      else if (last.kind === 'clue') {
        var c = (categories || [])[last.cat], cl = c && Array.isArray(c.clues) ? c.clues[last.clue] : null;
        if (cl && typeof last.cat === 'number' && typeof last.clue === 'number') out.last = { n: last.n, kind: 'clue', cat: last.cat, clue: last.clue };
      }
    }
    return out;
  }

  /** Reset game: a new game on the same settings, with the seed the page
      hands in. Changes `wheel` in place. */
  function wheelReset(wheel, seed) {
    if (!wheel) return;
    wheel.seed = text(seed).slice(0, WHEEL_SEED_MAX);
    wheel.spins = 0;
    wheel.doubleNext = false;
    wheel.last = null;
  }

  global.ReviewBoardPlay = {
    MARKS: MARKS,
    cleanMarks: cleanMarks,
    score: score,
    nextMark: nextMark,
    markWord: markWord,
    summary: summary,
    tally: tally,
    tallyLine: tallyLine,
    dropTeam: dropTeam,
    clearMarks: clearMarks,
    itemsFromBoard: itemsFromBoard,
    itemsFromQuestions: itemsFromQuestions,
    answerLetter: answerLetter,
    sheetModel: sheetModel,
    answerText: answerText,
    buildSheet: buildSheet,
    sheetSentence: sheetSentence,
    standings: standings,
    resultSentence: resultSentence,
    FINAL_FLOOR: FINAL_FLOOR,
    wagerMax: wagerMax,
    readWager: readWager,
    finalDeltas: finalDeltas,
    finalUnmarked: finalUnmarked,
    finalLines: finalLines,
    cleanFinal: cleanFinal,
    finalPlayed: finalPlayed,
    finalClear: finalClear,
    QB_DEFAULTS: QB_DEFAULTS,
    qbPoints: qbPoints,
    qbNew: qbNew,
    qbStart: qbStart,
    cleanQuizBowl: cleanQuizBowl,
    qbOpen: qbOpen,
    qbBuzz: qbBuzz,
    qbBonus: qbBonus,
    qbDeltas: qbDeltas,
    qbAsked: qbAsked,
    qbNextId: qbNextId,
    qbLeft: qbLeft,
    qbTotals: qbTotals,
    qbSummary: qbSummary,
    dropTeamFromRounds: dropTeamFromRounds,
    wheelDraw: wheelDraw,
    wheelNew: wheelNew,
    wheelWedges: wheelWedges,
    wheelSpin: wheelSpin,
    wheelApply: wheelApply,
    wheelWorth: wheelWorth,
    wheelLanded: wheelLanded,
    wheelSentence: wheelSentence,
    wheelOdds: wheelOdds,
    cleanWheel: cleanWheel,
    wheelReset: wheelReset
  };
})(window);
