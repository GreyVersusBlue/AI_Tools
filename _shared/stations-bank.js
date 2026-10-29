/* stations-bank.js — station questions from the shared question bank, for
   019 (Escape Room Builder) and 018 (QR Scavenger Hunt Builder) (Path 12 P2,
   increment 6). The design is that bullet of BACKLOG.md; this header records
   what the build decided.

   Classic script publishing window.StationsBank. Two halves:

   PURE (no DOM, no storage): toStation(q, kind), addTo(set, questions, kind,
   opts), heldIds(set), isBlank(station, kind). A question becomes ONE station
   in the page's own saved shape, with `bankId` set to the question's id (the
   field Stations.read/write and the share state already carry). The words are
   copied; the bank is not read again, so the station works with the bank gone.
     room (019)  prompt -> clue, answer -> accepted answers of a text station.
                 A comma in an answer separates answers on 019, so it becomes
                 a space (a comma between two digits is dropped: "1,000"), and
                 Stations' text matcher reads the result as it read the
                 original. Choices and a picture are not copied.
     hunt (018)  prompt -> content. Two to six choices with an answer that is
                 one of them -> a choice station (correctChoice = its place).
                 Anything else -> a text station with the answer in `note`
                 ("for your eyes only", so it is on the answer key). No numeric
                 station is made from a number-looking answer.
   A question with no question or no answer is refused with a sentence. A
   question whose id is a `bankId` already in the set is "already a station".

   MOUNT: mount(host, { kind, getSet, onAdd }) builds the Question bank card
   into `host`: Questions from, Unit, a ticked list, Tick all shown, Add ticked
   as stations. It reads with QuestionBank.peek() and sources({ peek: true }),
   which write nothing, and stores nothing itself: onAdd(result) is the page's
   save-and-redraw. A page without question-bank.js gets no card.

   Nothing here changes what a student's phone, lock.html, the monitor, a QR
   payload or a printed card does: a bank station is a station typed by hand. */
(function (global) {
  'use strict';

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  // A 019 answer field is comma-separated: a comma in an answer would be read as two accepted answers.
  function commaFree(answer) {
    return str(answer).replace(/(\d),(\d)/g, '$1$2').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function why(q) {
    if (!str(q && q.prompt).trim()) return 'It has no question.';
    if (!str(q.answer).trim()) return 'It has no answer.';
    return '';
  }

  function roomStation(q) {
    var answer = str(q.answer).trim();
    var clean = commaFree(answer);
    return {
      station: { clue: str(q.prompt).trim(), answers: clean, hint: '', next: null, image: '', type: 'text', hintCost: 0,
        awardLetter: '', cipherPlain: '', cipherShift: 0, maxAttempts: 0, numericTolerance: null, bankId: q.id },
      commas: clean !== answer
    };
  }

  function huntStation(q) {
    var answer = str(q.answer).trim();
    var choices = Array.isArray(q.choices) ? q.choices.map(function (c) { return str(c).trim(); }).filter(Boolean) : [];
    var at = -1;
    if (choices.length >= 2 && choices.length <= 6) {
      choices.forEach(function (c, i) { if (at < 0 && norm(c) === norm(answer)) at = i; });
    }
    var st = { label: '', content: str(q.prompt).replace(/\s+/g, ' ').trim(), note: '', qType: 'text', choices: [], correctChoice: 0,
      numericAnswer: '', tolerance: '0', hint: '', hintPenalty: '0', codeWord: '', bankId: q.id };
    if (at >= 0) { st.qType = 'choice'; st.choices = choices; st.correctChoice = at; }
    else st.note = 'Answer: ' + answer;
    return { station: st, commas: false };
  }

  /* { ok, why, station, commas, choices }: `choices` is true when the question had a choice list this station does not carry. */
  function toStation(q, kind) {
    var reason = why(q);
    if (reason || !q || !q.id) return { ok: false, why: reason || 'It has no id.', station: null, commas: false, choices: false };
    var made = kind === 'hunt' ? huntStation(q) : roomStation(q);
    var had = Array.isArray(q.choices) && q.choices.length > 0;
    return { ok: true, why: '', station: made.station, commas: made.commas, choices: had && made.station.qType !== 'choice' };
  }

  function heldIds(set) {
    var out = {};
    ((set && set.stations) || []).forEach(function (s) { if (s && s.bankId) out[s.bankId] = true; });
    return out;
  }

  function isBlank(s, kind) {
    if (!s) return true;
    if (kind === 'hunt') {
      return !str(s.content).trim() && !str(s.label).trim() && !str(s.note).trim() && !str(s.hint).trim() && !s.image &&
        (s.qType || 'text') === 'text' && !s.bankId;
    }
    return !str(s.clue).trim() && !str(s.answers).trim() && !str(s.hint).trim() && !s.image && (s.type || 'text') === 'text' && !s.bankId;
  }

  /* Appends the stations for `questions` to set.stations (the page's own list, mutated) and says what happened.
     opts.imageOf(q) counts questions whose picture did not come along. A lone empty station is replaced. */
  function addTo(set, questions, kind, opts) {
    var held = heldIds(set);
    var res = { added: 0, already: 0, refused: 0, commas: 0, withChoices: 0, withPicture: 0, replacedBlank: false };
    var made = [];
    (questions || []).forEach(function (q) {
      if (q && held[q.id]) { res.already++; return; }
      var t = toStation(q, kind);
      if (!t.ok) { res.refused++; return; }
      held[q.id] = true;
      made.push(t.station);
      res.added++;
      if (t.commas) res.commas++;
      if (t.choices) res.withChoices++;
      if (opts && opts.imageOf && opts.imageOf(q)) res.withPicture++;
    });
    if (!made.length) return res;
    if (set.stations.length === 1 && isBlank(set.stations[0], kind)) { set.stations.length = 0; res.replacedBlank = true; }
    made.forEach(function (s) { set.stations.push(s); });
    return res;
  }

  function countOf(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function statusText(res, name) {
    var parts = [];
    if (!res.added) parts.push('Nothing added.');
    else parts.push('Added ' + countOf(res.added, 'station') + (name ? ' to “' + name + '”' : '') + ': the question as the clue, the answer as its answer.');
    if (res.already) parts.push(countOf(res.already, 'question') + ' already ' + (res.already === 1 ? 'is a station here' : 'are stations here') + ' and ' + (res.already === 1 ? 'was' : 'were') + ' skipped.');
    if (res.commas) parts.push(countOf(res.commas, 'answer') + ' had a comma, written as a space because a comma separates answers.');
    if (res.withChoices) parts.push(countOf(res.withChoices, 'question') + ' had answer choices in the bank, which this kind of station does not carry.');
    if (res.withPicture) parts.push(countOf(res.withPicture, 'question') + ' had a picture in the bank, which did not come along.');
    parts.push('The bank itself was not changed.');
    return parts.join(' ');
  }

  var CSS =
    '.sb-list{max-height:15rem;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:.3rem .5rem;margin-bottom:.6rem}' +
    '.sb-row{display:flex;align-items:flex-start;gap:.5rem;font-weight:400;font-size:.85rem;margin:0;padding:.25rem 0;cursor:pointer}' +
    '.sb-row input{width:auto;margin:.2rem 0 0;flex:none}' +
    '.sb-row span.sb-a,.sb-row span.sb-why{display:block;font-size:.8rem}' +
    '.sb-row span.sb-a{color:var(--muted)}' +
    '.sb-row span.sb-why{color:var(--err)}' +
    '.sb-row.sb-off{cursor:default}' +
    '.sb-empty{color:var(--muted);font-size:.85rem;margin:.4rem 0}' +
    '.sb-status{font-size:.82rem;margin:.2rem 0 .6rem}' +
    '.sb-status.error{color:var(--err)}' +
    '.sb-btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem}' +
    '.sb-card [hidden]{display:none!important}';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  function mount(host, opts) {
    var QB = global.QuestionBank;
    if (!host || !QB || !opts) { if (host) host.hidden = true; return null; }
    var kind = opts.kind === 'hunt' ? 'hunt' : 'room';
    var uid = 'sb' + kind;
    if (!document.getElementById('stationsBankCss')) {
      var st = document.createElement('style'); st.id = 'stationsBankCss'; st.textContent = CSS; document.head.appendChild(st);
    }
    host.classList.add('sb-card');
    host.textContent = '';
    var h = el('div', 'card-title'); h.appendChild(el('span', '', 'Question bank'));
    host.appendChild(h);
    host.appendChild(el('p', 'hint', 'The site’s shared question bank is kept on Quiz / Review Game Board. A ticked question becomes a station: the question as the clue and its answer as the answer. ' +
      'Nothing is added until you press the button, the station is yours to edit, and the bank is not changed.'));
    var lblSrc = el('label', '', 'Questions from'); lblSrc.htmlFor = uid + 'Source';
    var selSrc = el('select'); selSrc.id = uid + 'Source';
    var note = el('p', 'hint'); note.hidden = true;
    var lblUnit = el('label', '', 'Unit'); lblUnit.htmlFor = uid + 'Unit';
    var selUnit = el('select'); selUnit.id = uid + 'Unit';
    var list = el('div', 'sb-list'); list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Questions to add as stations');
    var refusedNote = el('p', 'hint'); refusedNote.hidden = true;
    var btns = el('div', 'sb-btns');
    var allBtn = el('button', 'secondary', 'Tick all shown'); allBtn.type = 'button';
    var addBtn = el('button', '', 'Add ticked as stations'); addBtn.type = 'button';
    btns.appendChild(allBtn); btns.appendChild(addBtn);
    var status = el('p', 'sb-status'); status.setAttribute('role', 'status');
    [lblSrc, selSrc, note, lblUnit, selUnit, list, refusedNote, btns, status].forEach(function (n) { host.appendChild(n); });

    var ticked = {};
    function say(text, isError) { status.textContent = text || ''; status.classList.toggle('error', !!isError); }
    function setOptions(select, options, keep) {
      select.textContent = '';
      options.forEach(function (o) { var opt = el('option', '', o.label); opt.value = o.value; select.appendChild(opt); });
      select.value = options.some(function (o) { return o.value === keep; }) ? keep : '';
    }
    function shown() { return QB.filter(QB.questionsOf(selSrc.value, { peek: true }), { unit: selUnit.value }); }
    function usable(q, held) { return toStation(q, kind).ok && !held[q.id]; }

    function render() {
      var sources = QB.sources({ peek: true });
      setOptions(selSrc, sources.map(function (s) { return { value: s.id, label: QB.sourceLabel(s) }; }), selSrc.value);
      var chosen = sources.filter(function (s) { return s.id === selSrc.value; })[0];
      var seed = !!chosen && chosen.readOnly;
      note.hidden = !seed;
      note.textContent = seed ? 'These come with ' + chosen.source + ' and are read-only. ' + chosen.note : '';
      var all = QB.questionsOf(selSrc.value, { peek: true });
      setOptions(selUnit, [{ value: '', label: 'All units' }].concat(QB.distinct(all, 'unit').map(function (u) { return { value: u, label: u }; })), selUnit.value);
      var held = heldIds(opts.getSet()), rows = shown(), off = 0;
      list.textContent = '';
      if (!rows.length) {
        list.appendChild(el('p', 'sb-empty', all.length ? 'No questions in this unit.'
          : (seed ? 'This set has no questions.' : 'Your question bank is empty. Add questions on Quiz / Review Game Board, or choose a built-in set above.')));
      }
      rows.forEach(function (q) {
        var t = toStation(q, kind), isHeld = !!held[q.id], ok = t.ok && !isHeld;
        var row = el('label', 'sb-row' + (ok ? '' : ' sb-off'));
        var box = el('input'); box.type = 'checkbox'; box.disabled = !ok; box.checked = ok && !!ticked[q.id];
        box.addEventListener('change', function () { if (box.checked) ticked[q.id] = true; else delete ticked[q.id]; });
        var words = el('span');
        words.appendChild(el('span', 'sb-q', q.prompt || '(no question)'));
        words.appendChild(el('span', 'sb-a', q.answer || '(no answer)'));
        if (isHeld) { off++; words.appendChild(el('span', 'sb-a', 'Already a station here.')); }
        else if (!t.ok) { off++; words.appendChild(el('span', 'sb-why', 'Cannot be a station. ' + t.why)); }
        row.appendChild(box); row.appendChild(words); list.appendChild(row);
      });
      refusedNote.hidden = !off;
      refusedNote.textContent = off ? countOf(off, 'question') + ' shown here cannot be added, and ' + (off === 1 ? 'it says' : 'each says') + ' why.' : '';
    }

    selSrc.addEventListener('change', function () { ticked = {}; selUnit.value = ''; say(''); render(); });
    selUnit.addEventListener('change', render);
    allBtn.addEventListener('click', function () {
      var held = heldIds(opts.getSet());
      shown().forEach(function (q) { if (usable(q, held)) ticked[q.id] = true; });
      render();
    });
    addBtn.addEventListener('click', function () {
      var set = opts.getSet();
      if (!set) return;
      var picked = shown().filter(function (q) { return ticked[q.id]; });
      if (!picked.length) { say('Tick the questions to add first.', true); return; }
      var res = addTo(set, picked, kind, { imageOf: QB.imageOf ? function (q) { return QB.imageOf(q); } : null });
      ticked = {};
      if (res.added && opts.onAdd) opts.onAdd(res);
      render();
      say(statusText(res, set.name));
    });
    render();
    return { render: render };
  }

  global.StationsBank = { toStation: toStation, addTo: addTo, heldIds: heldIds, isBlank: isBlank, commaFree: commaFree, statusText: statusText, mount: mount };
}(typeof window !== 'undefined' ? window : globalThis));
