/* Quiz / Review Game Board — play modes and printed sheets (Path 12 P3,
   increment 1, v281). Publishes window.ReviewBoardPlay. Stores nothing and
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
    sheetSentence: sheetSentence
  };
})(window);
