/* Bracket / Tournament Generator (020): the academic-tournament mode (Path 12
   P2). A bracket whose matches are decided by questions from the site's
   question bank (_shared/question-bank.js). Publishes window.BtAcademic. The
   top half is pure (no DOM, no storage) and is tested in
   test/smoke-academic-core.mjs; mount() is the page's card, the match panel
   and the printed sheet, tested in test/smoke-academic.mjs.

   WHAT IS STORED, AND WHERE
   Nothing in the bank: 020 reads it with QuestionBank.peek(), which writes
   nothing (not even the move of 030's old bank). The mode lives on the
   bracket, in the one key the bracket already has, as one more field:
     academic: { on, seed, source, unit, per,
                 drawn: { '<match key>': [ question id, ... ] },
                 marks: { '<match key>': { '<question id>': 'a' | 'b' | 'n' } } }
   A bracket that never had the mode turned on has no such field, and is
   stored, shown, printed and shared as it always was. `source` is '' for the
   teacher's bank or a seed set's id; `unit` is '' for every unit; `per` is
   the questions a match is dealt. A match key is the page's own score key
   ('0_1', 'w1_0', 'l2_1', 'g0', 'rr3_2', 'pool1_rr0_2', 'br_0_1').
   Questions are kept by id, never as text: the words are read from the
   source each time, so an edit on 030 shows here, and a question that has
   gone from the source says so in its place.

   THE DEAL
   No Math.random after the seed is made. The source's questions are put in
   one order, by hash(seed, id) and then by id, so the order does not depend
   on the order the source lists them in and a question added later slots in
   without moving the rest. A match is dealt, the first time it is opened or
   printed, the first `per` questions of that order that no match of this
   bracket holds yet. So the same bracket shows the same questions every
   time it is opened; and which match gets which follows from the order the
   matches are opened in. When every question is held, the deal goes round
   again (never the same question twice in one match) and the page says so;
   a source with fewer than `per` questions gives what it has and says so.
   Changing the source, the unit or the number changes the matches dealt
   from then on; a match already dealt keeps its questions.

   THE RULE (said on the page in these words)
   Each question is one point to the side that got it; a question nobody got
   is no point. When every question of a match is marked, the two totals go
   into the match's score boxes, and the page decides the match as it has
   always decided one from two scores: the higher score wins, and a tie
   decides nothing. On a tie the teacher adds a tiebreak question or picks
   the winner by name. Picking by name is always there, before or instead of
   the questions; a recorded winner is undone with the page's Undo last
   pick, as any pick is. */
(function (global) {
  'use strict';

  var MARKS = { a: true, b: true, n: true };
  /* The score keys the page writes, and nothing else: so a key from a link
     can never be '__proto__' or any other name an object already has. */
  var KEY_RE = /^(?:g[01]|(?:pool\d{1,3}_rr|br_|rr|w|l)?\d{1,3}_\d{1,3})$/;
  var LIMIT = { per: 20, perMatch: 40, matches: 600, id: 200, source: 80, unit: 120 };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isRecord(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* FNV-1a, 32 bits, over the text's UTF-16 units. */
  function fnv(s, start) {
    var h = start >>> 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h ^= c & 0xff; h = Math.imul(h, 16777619) >>> 0;
      h ^= c >>> 8; h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /** A seed for a new bracket: a whole number from 1 to 2147483646. */
  function newSeed(random) {
    var r = typeof random === 'function' ? random() : Math.random();
    return 1 + Math.floor((r >= 0 && r < 1 ? r : 0) * 2147483646);
  }

  function clampPer(v) {
    var n = Math.floor(Number(v));
    return n >= 1 ? Math.min(n, LIMIT.per) : 3;
  }

  /** The mode as a bracket first holds it. */
  function fresh(random) {
    return { on: true, seed: newSeed(random), source: '', unit: '', per: 3, drawn: {}, marks: {} };
  }

  /** `raw` as a well-formed `academic` field, or null when it is not one.
      A stored bracket and a share link both pass through here, so nothing
      but these seven fields, of these types and within LIMIT, is kept. */
  function clean(raw) {
    if (!isRecord(raw)) return null;
    var seed = Math.floor(Number(raw.seed));
    if (!(seed >= 1 && seed <= 2147483646)) return null;
    var out = {
      on: raw.on === true, seed: seed,
      source: typeof raw.source === 'string' ? raw.source.slice(0, LIMIT.source) : '',
      unit: typeof raw.unit === 'string' ? raw.unit.slice(0, LIMIT.unit) : '',
      per: clampPer(raw.per), drawn: {}, marks: {}
    };
    var n = 0, k;
    if (isRecord(raw.drawn)) {
      for (k in raw.drawn) {
        if (!own(raw.drawn, k) || !KEY_RE.test(k) || !Array.isArray(raw.drawn[k]) || n >= LIMIT.matches) continue;
        var ids = [], seen = {};
        raw.drawn[k].forEach(function (id) {
          if (typeof id !== 'string' || !id || id.length > LIMIT.id || own(seen, '$' + id) || ids.length >= LIMIT.perMatch) return;
          seen['$' + id] = true;
          ids.push(id);
        });
        if (ids.length) { out.drawn[k] = ids; n++; }
      }
    }
    if (isRecord(raw.marks)) {
      for (k in raw.marks) {
        if (!own(raw.marks, k) || !own(out.drawn, k) || !isRecord(raw.marks[k])) continue;
        var kept = {}, any = false;
        out.drawn[k].forEach(function (id) {
          var v = own(raw.marks[k], id) ? raw.marks[k][id] : null;
          if (typeof v === 'string' && own(MARKS, v)) { kept[id] = v; any = true; }
        });
        if (any) out.marks[k] = kept;
      }
    }
    return out;
  }

  /** `ids` in the bracket's own order: by hash(seed, id), then by id. */
  function order(seed, ids) {
    var list = [], seen = {};
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      if (typeof id !== 'string' || !id || own(seen, '$' + id)) return;
      seen['$' + id] = true;
      list.push({ id: id, rank: fnv(seed + ':' + id, 2166136261) });
    });
    list.sort(function (x, y) { return x.rank - y.rank || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0); });
    return list.map(function (e) { return e.id; });
  }

  /** `n` more questions for match `key`, from `ordered` (order()'s list).
      First the ones no match holds; then, when those run out, the ones this
      match does not hold, in the same order. Returns { ids, added, repeats,
      short }: the match's whole list, how many were added, how many of those
      another match already holds, and how many could not be found at all.
      Pure: `ac` is not changed. */
  function deal(ac, key, ordered, n) {
    var mine = (ac.drawn && ac.drawn[key] ? ac.drawn[key] : []).slice();
    var held = {}, here = {}, k;
    for (k in ac.drawn) if (own(ac.drawn, k)) ac.drawn[k].forEach(function (id) { held['$' + id] = true; });
    mine.forEach(function (id) { here['$' + id] = true; });
    var want = Math.max(0, Math.floor(Number(n)) || 0), added = 0, repeats = 0;
    ordered.forEach(function (id) {
      if (added >= want || own(held, '$' + id)) return;
      mine.push(id); here['$' + id] = true; added++;
    });
    ordered.forEach(function (id) {
      if (added >= want || own(here, '$' + id)) return;
      mine.push(id); here['$' + id] = true; added++; repeats++;
    });
    return { ids: mine, added: added, repeats: repeats, short: want - added };
  }

  /** How many of match `key`'s questions another match of the bracket holds. */
  function repeatsIn(ac, key) {
    var others = {}, k, n = 0;
    for (k in ac.drawn) if (own(ac.drawn, k) && k !== key) ac.drawn[k].forEach(function (id) { others['$' + id] = true; });
    (ac.drawn[key] || []).forEach(function (id) { if (own(others, '$' + id)) n++; });
    return n;
  }

  /** The score of match `key`: { a, b, marked, total, done }. `done` is
      true when the match has questions and every one is marked. */
  function score(ac, key) {
    var ids = (ac.drawn && ac.drawn[key]) || [], marks = (ac.marks && ac.marks[key]) || {};
    var out = { a: 0, b: 0, marked: 0, total: ids.length, done: false };
    ids.forEach(function (id) {
      var v = own(marks, id) ? marks[id] : '';
      if (!own(MARKS, v)) return;
      out.marked++;
      if (v === 'a') out.a++;
      if (v === 'b') out.b++;
    });
    out.done = out.total > 0 && out.marked === out.total;
    return out;
  }

  /** What a score says: 'open' until every question is marked, then 'a',
      'b' or 'tie'. */
  function outcome(s) {
    if (!s || !s.done) return 'open';
    return s.a > s.b ? 'a' : s.b > s.a ? 'b' : 'tie';
  }

  /** How many matches `count` questions cover at `per` a match before one
      has to be asked again. */
  function supply(count, per) {
    return Math.floor(Math.max(0, count) / clampPer(per));
  }

  /** A match's name from the page's score key, for a heading. */
  function matchTitle(key) {
    var m;
    if (key === 'g0') return 'Grand final';
    if (key === 'g1') return 'Grand final, bracket reset';
    if ((m = /^pool(\d+)_rr(\d+)_(\d+)$/.exec(key))) return 'Pool ' + (+m[1] + 1) + ', round ' + (+m[2] + 1) + ', match ' + (+m[3] + 1);
    if ((m = /^br_(\d+)_(\d+)$/.exec(key))) return 'Bracket round ' + (+m[1] + 1) + ', match ' + (+m[2] + 1);
    if ((m = /^w(\d+)_(\d+)$/.exec(key))) return 'Winners bracket round ' + (+m[1] + 1) + ', match ' + (+m[2] + 1);
    if ((m = /^l(\d+)_(\d+)$/.exec(key))) return 'Losers bracket round ' + (+m[1] + 1) + ', match ' + (+m[2] + 1);
    if ((m = /^(?:rr)?(\d+)_(\d+)$/.exec(key))) return 'Round ' + (+m[1] + 1) + ', match ' + (+m[2] + 1);
    return 'Match';
  }

  var RULE = 'Each question is one point to the side that got it. When every question is marked, the side with more points wins the match. A tie decides nothing: add a tiebreak question, or pick the winner by name.';

  /* ---- the page ---------------------------------------------------------- */

  /** Wires the card, the match panel and the sheet. `api` is the page's:
      state() the open bracket or null, save(), render(), and matches(), the
      matches drawn by the last render, in page order: [{ key, a, b,
      playable, open, winner(), setScore(a, b), pick(side) }]. Returns
      { sync, button, isOn }. */
  function mount(api) {
    var doc = global.document, QB = global.QuestionBank;
    var $ = function (id) { return doc.getElementById(id); };
    var card = $('academicCard'), onBox = $('acOn'), settings = $('acSettings');
    var sourceSel = $('acSource'), unitSel = $('acUnit'), perInput = $('acPer');
    var supplyNote = $('acSupply'), printBtn = $('acPrintBtn'), printNote = $('acPrintNote');
    var panel = $('academicPanel'), sheet = $('matchSheet');
    $('acRule').textContent = 'How a match is decided. ' + RULE + ' A match is dealt its questions the first time you open it or print it, and keeps them.';
    var current = null;                                        // the key of the match the panel shows
    var currentOf = '';                                        // and the name of the bracket it is a match of
    var shownIds = '';                                         // what the panel's list was built from

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function ac() { var s = api.state(); return s && s.academic && s.academic.on ? s.academic : null; }
    function isOn() { return !!ac(); }
    function findMatch(key) {
      var list = api.matches();
      for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
      return null;
    }

    /* The questions a source can give a match: its questions that have both
       a question and an answer, of the chosen unit. Read with peek(). */
    function pool(a) {
      var all = QB.questionsOf(a.source, { peek: true }).filter(function (q) { return !QB.validate(q).length; });
      return a.unit ? QB.filter(all, { unit: a.unit }) : all;
    }
    function lookup(id) {
      if (QB.isSeedId(id)) return QB.findSeed(id);
      var list = QB.peek();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    }

    /* Deals `n` more questions to a match and stores them with the bracket.
       Returns deal()'s result. Stores nothing when nothing was added. */
    function dealTo(key, n) {
      var a = ac(), ids = pool(a).map(function (q) { return q.id; });
      var res = deal(a, key, order(a.seed, ids), n);
      if (res.added) { a.drawn[key] = res.ids; api.save(); }
      return res;
    }

    function fillChooser() {
      var a = ac(), list = QB.sources({ peek: true }), known = false;
      sourceSel.textContent = '';
      list.forEach(function (src) {
        var opt = el('option', '', QB.sourceLabel(src));
        opt.value = src.id;
        if (src.id === a.source) { opt.selected = true; known = true; }
        sourceSel.appendChild(opt);
      });
      if (!known) {                                            // a set this page does not have
        var gone = el('option', '', 'A source this device does not have (0 questions)');
        gone.value = a.source; gone.selected = true;
        sourceSel.appendChild(gone);
      }
      var units = QB.distinct(QB.questionsOf(a.source, { peek: true }), 'unit');
      unitSel.textContent = '';
      var every = el('option', '', 'Every unit'); every.value = '';
      unitSel.appendChild(every);
      units.forEach(function (u) {
        var opt = el('option', '', u); opt.value = u;
        if (u === a.unit) opt.selected = true;
        unitSel.appendChild(opt);
      });
      if (a.unit && units.indexOf(a.unit) === -1) {
        var lost = el('option', '', a.unit + ' (no questions now)'); lost.value = a.unit; lost.selected = true;
        unitSel.appendChild(lost);
      }
      perInput.value = a.per;
    }

    function saySupply() {
      var a = ac(), count = pool(a).length;
      var ready = api.matches().filter(function (m) { return m.playable; }).length;
      var text;
      if (!count) {
        text = 'This source has no questions' + (a.unit ? ' in this unit' : '') + ', so a match has none to show. Choose another source, or add questions on the Quiz / Review Game Board’s Question bank tab.';
      } else if (count < a.per) {
        text = 'This source has ' + count + ' question' + (count === 1 ? '' : 's') + (a.unit ? ' in this unit' : '') + ', fewer than the ' + a.per + ' a match asks for. Each match gets ' + (count === 1 ? 'that one' : 'those ' + count) + ', and every match gets the same.';
      } else {
        var covers = supply(count, a.per);
        text = count + ' question' + (count === 1 ? '' : 's') + (a.unit ? ' in this unit' : '') + ': enough for ' + covers + ' match' + (covers === 1 ? '' : 'es') + ' at ' + a.per + ' a match before a question is asked a second time.' +
          (ready > covers ? ' ' + ready + ' matches are ready to play now, so some questions will repeat.' : '');
      }
      supplyNote.textContent = text;
      supplyNote.classList.toggle('error', !count || count < a.per);
    }

    /* ---- the match panel ---- */

    function scoreWords(m, s) {
      return m.a + ' ' + s.a + ', ' + m.b + ' ' + s.b + ' (' + s.marked + ' of ' + s.total + ' marked).';
    }

    function sayScore() {
      var a = ac(), m = current && findMatch(current), line = $('acScore');
      if (!a || !m || !line) return;
      var s = score(a, current), what = outcome(s), win = m.winner(), text = scoreWords(m, s);
      var names = [m.a, m.b];
      if (win !== null) {
        text += ' Winner recorded: ' + names[win] + '.';
        if ((what === 'a' && win === 1) || (what === 'b' && win === 0) || what === 'tie') {
          text += ' The questions ' + (what === 'tie' ? 'came out a tie' : 'favour ' + names[1 - win]) + '; the winner was picked by name. To change it, use Undo last pick straight after the pick.';
        }
      } else if (what === 'tie') {
        text += ' A tie: add a tiebreak question, or pick the winner.';
      } else if (what === 'open' && s.total) {
        text += ' The winner is recorded when every question is marked.';
      } else if (what === 'a' || what === 'b') {               // a recorded winner was undone
        text += ' ' + names[what === 'a' ? 0 : 1] + ' is ahead on the questions and no winner is recorded: pick the winner by name.';
      }
      line.textContent = text;
      var undecided = win === null;
      $('acTieBtn').hidden = !(undecided && what === 'tie');
      $('acPickA').hidden = $('acPickB').hidden = !undecided;
    }

    function buildPanel(focus) {
      var a = ac(), m = current && findMatch(current);
      if (!a || !m || !m.playable) { closePanel(false); return; }
      if (!a.drawn[current]) dealTo(current, a.per);
      var ids = a.drawn[current] || [];
      shownIds = current + '|' + ids.join('|');
      panel.textContent = '';
      var title = el('h2', '', matchTitle(current) + ': ' + m.a + ' vs ' + m.b);
      title.id = 'acPanelTitle'; title.tabIndex = -1;
      panel.appendChild(title);

      var shared = repeatsIn(a, current), notes = [];
      if (!ids.length) notes.push('No questions: the source has none' + (a.unit ? ' in this unit' : '') + '. Choose another source in the Academic tournament card. The winner can still be picked by name.');
      else if (ids.length < a.per) notes.push('This match has ' + ids.length + ' question' + (ids.length === 1 ? '' : 's') + ', not ' + a.per + ': the source had no more when it was dealt.');
      if (shared) notes.push('The source ran out: ' + shared + ' of these questions ' + (shared === 1 ? 'is' : 'are') + ' also in another match of this bracket.');
      if (notes.length) { var note = el('p', 'share-note error', notes.join(' ')); note.id = 'acPanelNote'; panel.appendChild(note); }
      panel.appendChild(el('p', 'hint', RULE));

      var list = el('ol', 'ac-questions');
      ids.forEach(function (id, i) {
        var q = lookup(id), li = el('li', 'ac-q');
        li.appendChild(el('p', 'ac-prompt', q ? q.prompt : 'This question is no longer in its source (it was deleted, or this bracket came from another device). It can still be marked.'));
        if (q) {
          var reveal = el('button', 'secondary ac-reveal', 'Show answer');
          reveal.type = 'button';
          var ans = el('p', 'ac-answer', 'Answer: ' + q.answer);
          ans.id = 'acAns' + i; ans.hidden = true;
          reveal.setAttribute('aria-expanded', 'false');
          reveal.setAttribute('aria-controls', ans.id);
          reveal.addEventListener('click', function () {
            ans.hidden = !ans.hidden;
            reveal.setAttribute('aria-expanded', String(!ans.hidden));
            reveal.textContent = ans.hidden ? 'Show answer' : 'Hide answer';
          });
          li.appendChild(reveal);
          li.appendChild(ans);
        }
        var who = el('fieldset', 'ac-who');
        who.appendChild(el('legend', '', 'Who got question ' + (i + 1) + '?'));
        [['a', m.a], ['b', m.b], ['n', 'Neither']].forEach(function (pair) {
          var label = el('label'), radio = el('input');
          radio.type = 'radio'; radio.name = 'acq' + i; radio.value = pair[0];
          radio.checked = !!(a.marks[current] && a.marks[current][id] === pair[0]);
          radio.addEventListener('change', function () { mark(id, pair[0]); });
          label.appendChild(radio);
          label.appendChild(doc.createTextNode(' ' + pair[1]));
          who.appendChild(label);
        });
        li.appendChild(who);
        list.appendChild(li);
      });
      panel.appendChild(list);

      var line = el('p', 'ac-score'); line.id = 'acScore'; line.setAttribute('role', 'status');
      panel.appendChild(line);
      var actions = el('div', 'stage-action');
      function action(id, text, cls, fn) {
        var b = el('button', cls, text); b.type = 'button'; b.id = id;
        b.addEventListener('click', fn);
        actions.appendChild(b);
      }
      action('acTieBtn', 'Add a tiebreak question', '', function () {
        var res = dealTo(current, 1);
        if (!res.added) { $('acScore').textContent = 'There is no other question in the source to add. Pick the winner by name.'; return; }
        buildPanel(false);
        var rows = panel.querySelectorAll('.ac-q');
        var first = rows[rows.length - 1].querySelector('.ac-reveal, input');
        if (first) first.focus();
      });
      action('acPickA', 'Pick ' + m.a + ' as the winner', 'secondary', function () { pick(0); });
      action('acPickB', 'Pick ' + m.b + ' as the winner', 'secondary', function () { pick(1); });
      action('acCloseBtn', 'Close these questions', 'secondary', function () { closePanel(true); });
      panel.appendChild(actions);
      panel.hidden = false;
      sayScore();
      if (focus) title.focus();
    }

    function mark(id, v) {
      var a = ac(), m = current && findMatch(current);
      if (!a || !m) return;
      if (!a.marks[current]) a.marks[current] = {};
      a.marks[current][id] = v;
      api.save();
      var s = score(a, current);
      if (s.done) m.setScore(s.a, s.b);                        // the page decides from the two scores, and renders
      else { refreshButton(current); sayScore(); }
    }

    function pick(side) {
      var m = current && findMatch(current);
      if (m && m.open) m.pick(side);                           // the page's own click on a name
    }

    function openPanel(key) {
      current = key;
      currentOf = api.state().name;
      buildPanel(true);
      refreshButton(key);
    }

    function closePanel(focus) {
      var key = current;
      current = null; shownIds = '';
      panel.hidden = true;
      panel.textContent = '';
      if (focus && key) { var b = buttonFor(key); if (b) b.focus(); }
    }

    /* ---- the button a match gets ---- */

    function buttonFor(key) { return doc.querySelector('#bracketView [data-ac-key="' + key + '"]'); }
    function buttonText(key) {
      var a = ac(), s = a ? score(a, key) : null;
      return 'Questions' + (s && s.marked ? ': ' + s.a + '–' + s.b : '');
    }
    function refreshButton(key) {
      var b = buttonFor(key);
      if (!b) return;
      b.textContent = buttonText(key);
      b.setAttribute('aria-expanded', String(current === key));
    }
    /** The Questions button under a match's score boxes. */
    function button(key, aName, bName) {
      var b = el('button', 'secondary match-q-btn', buttonText(key));
      b.type = 'button';
      b.setAttribute('data-ac-key', key);
      b.setAttribute('aria-label', buttonText(key).replace('Questions', 'Questions for ' + aName + ' vs ' + bName));
      b.setAttribute('aria-expanded', String(current === key));
      b.setAttribute('aria-controls', 'academicPanel');
      b.addEventListener('click', function () {
        if (current === key) closePanel(true); else openPanel(key);
      });
      return b;
    }

    /* ---- the printed sheet ---- */

    function box() { return el('span', 'ms-box'); }
    function buildSheet() {
      var a = ac(), state = api.state();
      var ready = api.matches().filter(function (m) { return m.playable && m.open; });
      sheet.textContent = '';
      if (!ready.length) return { matches: 0, questions: 0 };
      ready.forEach(function (m) { if (!a.drawn[m.key]) dealTo(m.key, a.per); });
      var total = 0;
      ready.forEach(function (m) { total += (a.drawn[m.key] || []).length; });
      if (!total) return { matches: ready.length, questions: 0 };

      sheet.appendChild(el('h1', 'ms-title', state.name + ': match sheets'));
      sheet.appendChild(el('p', 'ms-rule', 'For the reader. ' + RULE + ' The answers are on the last page' + (ready.length > 3 ? 's' : '') + ', under Answer key.'));
      var key = el('section', 'ms-key');
      key.appendChild(el('h1', 'ms-title', state.name + ': answer key'));
      key.appendChild(el('p', 'ms-rule', 'Keep this page from the players.'));
      ready.forEach(function (m) {
        var ids = a.drawn[m.key] || [], heading = matchTitle(m.key) + ': ' + m.a + ' vs ' + m.b;
        var sec = el('section', 'ms-match');
        sec.appendChild(el('h2', '', heading));
        var keySec = el('section', 'ms-key-match');
        keySec.appendChild(el('h2', '', heading));
        if (!ids.length) {
          sec.appendChild(el('p', '', 'No questions: the source had none for this match.'));
        } else {
          var ol = el('ol'), keyOl = el('ol');
          ids.forEach(function (id) {
            var q = lookup(id), li = el('li');
            li.appendChild(el('p', 'ms-q', q ? q.prompt : '(This question is no longer in its source.)'));
            var who = el('p', 'ms-who', 'Who got it: ');
            [m.a, m.b, 'Neither'].forEach(function (name) {
              var opt = el('span', 'ms-opt');
              opt.appendChild(box());
              opt.appendChild(doc.createTextNode(' ' + name));
              who.appendChild(opt);
            });
            li.appendChild(who);
            ol.appendChild(li);
            keyOl.appendChild(el('li', 'ms-a', q ? q.answer : '(not in its source)'));
          });
          sec.appendChild(ol);
          sec.appendChild(el('p', 'ms-total', 'Points: ' + m.a + ' ______   ' + m.b + ' ______   Winner: ____________________'));
          keySec.appendChild(keyOl);
        }
        sheet.appendChild(sec);
        key.appendChild(keySec);
      });
      sheet.appendChild(key);
      return { matches: ready.length, questions: total };
    }

    function endSheet() { doc.body.classList.remove('printing-sheet'); }
    global.addEventListener('afterprint', endSheet);

    printBtn.addEventListener('click', function () {
      if (!ac()) return;
      var built = buildSheet();
      if (!built.matches) { printNote.textContent = 'No match is ready to play: a match is ready when both its sides are known and it has no winner yet.'; return; }
      if (!built.questions) { printNote.textContent = 'Nothing to print: the source has no questions' + (ac().unit ? ' in this unit' : '') + '.'; return; }
      printNote.textContent = 'Match sheets for ' + built.matches + ' match' + (built.matches === 1 ? '' : 'es') + ' ready to play, ' + built.questions + ' question' + (built.questions === 1 ? '' : 's') + ', with the answer key on a page of its own.';
      sync(true);                                              // a match dealt just now has questions to count
      doc.body.classList.add('printing-sheet');
      global.print();                                          // afterprint puts the bracket back for Ctrl+P
    });

    /* ---- the card ---- */

    onBox.addEventListener('change', function () {
      var state = api.state();
      if (!state) { onBox.checked = false; return; }
      if (onBox.checked) {
        if (state.academic) state.academic.on = true;
        else state.academic = fresh();
      } else if (state.academic) {
        state.academic.on = false;
      }
      api.save();
      api.render();
    });
    function setting(fn) {
      return function () { var a = ac(); if (!a) return; fn(a); api.save(); api.render(); };
    }
    sourceSel.addEventListener('change', setting(function (a) { a.source = sourceSel.value; a.unit = ''; }));
    unitSel.addEventListener('change', setting(function (a) { a.unit = unitSel.value; }));
    perInput.addEventListener('change', setting(function (a) { a.per = clampPer(perInput.value); }));

    /** Called at the end of every render of the page (and when no bracket
        is open): shows the card for the open bracket and keeps the panel
        true to it. `keepSheet` is the print button's own call. */
    function sync(keepSheet) {
      var state = api.state();
      if (!keepSheet) endSheet();
      card.style.display = state ? '' : 'none';
      var a = ac();
      onBox.checked = !!a;
      settings.hidden = !a;
      if (!a) { if (current) closePanel(false); printNote.textContent = ''; return; }
      fillChooser();
      saySupply();
      if (!current) return;
      var m = findMatch(current);
      // Another bracket, a match that is gone, or a deal that was taken back
      // (Reset picks, an undo): the panel closes; it never deals by itself.
      if (state.name !== currentOf || !m || !m.playable || (shownIds !== current + '|' && !a.drawn[current])) { closePanel(false); return; }
      if (shownIds !== current + '|' + (a.drawn[current] || []).join('|')) buildPanel(false);
      else {
        (a.drawn[current] || []).forEach(function (id, i) {     // an undo may have taken a mark back
          var v = (a.marks[current] && a.marks[current][id]) || '';
          panel.querySelectorAll('input[name="acq' + i + '"]').forEach(function (r) { r.checked = r.value === v; });
        });
        sayScore();
      }
    }

    return { sync: sync, button: button, isOn: isOn };
  }

  global.BtAcademic = {
    LIMIT: LIMIT,
    RULE: RULE,
    newSeed: newSeed,
    fresh: fresh,
    clean: clean,
    order: order,
    deal: deal,
    repeatsIn: repeatsIn,
    score: score,
    outcome: outcome,
    supply: supply,
    matchTitle: matchTitle,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : global);
