/* Quiz / Review Game Board — the question-bank editor (Path 12 P2, v274).
   What the bank tab needs to show and edit EVERYTHING a question in the
   site's shared bank holds (_shared/question-bank.js): its choices and its
   tags beside the six fields the page always had; to edit a question where
   it stands in the list; and to show a file before it is imported.
   Publishes window.ReviewBankEditor. Stores nothing itself: the page saves
   with QuestionBank.saveQuestion() and QuestionBank.importQuestions().

   CHOICES AND THE RIGHT ONE
   A question's `choices` is a list of texts and its `answer` is a text; the
   bank has no third field saying which choice is right, and this file adds
   none. The right choice is the one whose text IS the answer (letter case
   and spacing aside). Marking a choice writes its text into the answer
   field; typing in the marked choice types into the answer too; typing an
   answer that matches no choice leaves none marked, and the form says so.
   A question with no choices is stored with no `choices` field, as before.

   TAGS
   Tokens. A tag is added by Enter, by a comma or semicolon, by leaving the
   field, or by picking one the bank already uses from the field's list.
   The bank's own rule cleans the list (no blanks, no repeats whatever the
   letter case), so the form cannot hold a tag the bank would not store.

   EVERY TEXT IS TEXT
   A question may have come from a file or a link, so nothing here builds
   markup from a string: every node is made with createElement and filled
   with textContent or a field's value.

   The first half is pure (no document) and is what
   Tools/review-game-board/test/smoke-bank-editor-core.mjs runs in Node.
   Plain global script, as rgb-bank-store.js is. */
(function (global) {
  'use strict';

  var QB = global.QuestionBank;

  /* The most rows a preview lists. A longer file is counted whole and the
     rest is said in a line under the list. */
  var MOST_SHOWN = 500;

  /* The fields the form shows, and what a preview calls each. */
  var FIELDS = [
    ['prompt', 'question'], ['answer', 'answer'], ['points', 'points'], ['unit', 'unit'],
    ['standard', 'standard'], ['difficulty', 'difficulty'], ['tags', 'tags'], ['choices', 'choices']
  ];

  function fold(s) { return String(s === null || s === undefined ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
  function countOf(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* ---- pure ------------------------------------------------------------ */

  /** `list` as the bank would store it as tags. */
  function cleanTags(list) { return QB.normalize({ tags: Array.isArray(list) ? list : [] }).tags; }

  /** `list` as the bank would store it as choices ([] for none). */
  function cleanChoices(list) { return QB.normalize({ choices: Array.isArray(list) ? list : [] }).choices || []; }

  /** `tags` with what was typed added: `typed` may hold several, split on a
      comma or a semicolon. */
  function addTags(tags, typed) {
    return cleanTags((tags || []).concat(String(typed === null || typed === undefined ? '' : typed).split(/[,;]/)));
  }

  /** `tags` without `tag` (letter case aside). */
  function removeTag(tags, tag) {
    return (tags || []).filter(function (t) { return fold(t) !== fold(tag); });
  }

  /** The place of the choice that is the answer, or -1. */
  function rightIndex(choices, answer) {
    var a = fold(answer);
    if (!a) return -1;
    for (var i = 0; i < (choices || []).length; i++) if (fold(choices[i]) === a) return i;
    return -1;
  }

  /** `list` with the item at `at` moved one place up (-1) or down (+1); a
      copy of `list` unchanged when it cannot move. */
  function move(list, at, by) {
    var out = list.slice(), to = at + by;
    if (at < 0 || at >= out.length || to < 0 || to >= out.length) return out;
    var item = out[at];
    out[at] = out[to];
    out[to] = item;
    return out;
  }

  /** What the form starts with for `q`: the eight fields it shows. */
  function draftOf(q) {
    var n = QB.normalize(q);
    return {
      prompt: n.prompt, answer: n.answer, points: n.points, unit: n.unit, standard: n.standard,
      difficulty: n.difficulty, tags: n.tags.slice(), choices: (n.choices || []).slice()
    };
  }

  /** A draft as the question to save: the eight fields and, when given, the
      id. Nothing else, so a save leaves every other field of a stored
      question (its picture, where it was copied from, a field this page
      does not know) as it is. `choices` is always a list: an empty one
      takes a stored question's choices away. */
  function questionOf(draft, id) {
    draft = draft || {};
    var points = parseInt(draft.points, 10);
    var q = {
      prompt: String(draft.prompt || '').trim(), answer: String(draft.answer || '').trim(),
      points: isFinite(points) ? points : 0,
      unit: String(draft.unit || '').trim(), standard: String(draft.standard || '').trim(),
      difficulty: QB.DIFFICULTIES.indexOf(draft.difficulty) !== -1 ? draft.difficulty : '',
      tags: cleanTags(draft.tags), choices: cleanChoices(draft.choices)
    };
    if (id) q.id = id;
    return q;
  }

  /** What stops a draft being saved: a list of sentences, empty for none. */
  function problems(draft) {
    var q = questionOf(draft);
    return q.prompt && q.answer ? [] : ['Add both a question and an answer.'];
  }

  /** What a teacher should know about a draft that can still be saved. */
  function notes(draft) {
    var q = questionOf(draft);
    if (q.choices.length && q.answer && rightIndex(q.choices, q.answer) === -1) {
      return ['None of the choices is the answer. Mark the right one, or add the answer as a choice.'];
    }
    return [];
  }

  function shown(q) {
    var n = QB.normalize(q), out = {};
    FIELDS.forEach(function (f) { out[f[0]] = f[0] === 'choices' ? (n.choices || []) : n[f[0]]; });
    return out;
  }

  /** The names of the shown fields in which `a` and `b` differ. */
  function differences(a, b) {
    var x = shown(a), y = shown(b);
    return FIELDS.filter(function (f) { return JSON.stringify(x[f[0]]) !== JSON.stringify(y[f[0]]); })
      .map(function (f) { return f[1]; });
  }

  /** True when saving `draft` over `original` would change it. */
  function changed(original, draft) {
    return differences(original, questionOf(draft)).length > 0;
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** What importing `parsed` ({ questions, rows }, as QuestionBank.parse()
      and fromRows() give) into `bankList` would do, by the bank's own
      merge(): nothing is stored and `bankList` is not changed. Returns
        { total, added, updated, there, refused, rows, more, signature }
      `rows` is one entry for each of the first `most` questions, in the
      file's order: { row, status, reasons, fields, question }, where `row`
      is the file's own row number, `status` is 'new', 'change', 'there' or
      'refused', `reasons` says why a refused one is refused, and `fields`
      names what a 'change' would change. `signature` is the same for two
      plans that would do the same thing. */
  function importPlan(bankList, parsed, most) {
    parsed = parsed || {};
    var incoming = Array.isArray(parsed.questions) ? parsed.questions : [];
    var sheet = Array.isArray(parsed.rows) ? parsed.rows : [];
    var whole = QB.merge(bankList, incoming);
    var plan = {
      total: incoming.length, added: whole.added, updated: whole.updated, there: whole.same + whole.skipped,
      refused: whole.invalid.length, rows: [], more: 0, signature: ''
    };
    var bank = bankList, limit = typeof most === 'number' ? most : MOST_SHOWN, marks = '';
    // One at a time, each over what the ones before it left, so a question
    // the file itself repeats is marked as the import would treat it.
    incoming.slice(0, limit).forEach(function (raw, i) {
      var step = QB.merge(bank, [raw]), q = QB.normalize(raw);
      var status = step.invalid.length ? 'refused' : step.added ? 'new' : step.updated ? 'change' : 'there';
      var fields = [];
      if (status === 'change') {
        var before = byId(bank, q.id), after = byId(step.questions, q.id);
        fields = before && after ? differences(before, after) : [];
        if (!fields.length) fields = ['other details'];
      }
      bank = step.questions;
      marks += status.charAt(0);
      plan.rows.push({
        row: sheet[i] || i + 1, status: status,
        reasons: step.invalid.length ? step.invalid[0].errors.slice() : [], fields: fields, question: q
      });
    });
    plan.more = incoming.length - plan.rows.length;
    plan.signature = [plan.total, plan.added, plan.updated, plan.there, plan.refused, marks].join('/');
    return plan;
  }

  /** A preview row's status, as its tag says it. */
  function statusLabel(row) {
    if (row.status === 'new') return 'new';
    if (row.status === 'change') return 'changes a question in your bank: ' + row.fields.join(', ');
    if (row.status === 'there') return 'already in your bank';
    return 'left out: ' + row.reasons.join(', ');
  }

  /** The sentences over a preview: what the file holds and what Add would
      do with it. */
  function planSentence(plan, fileName) {
    var parts = [(fileName || 'That file') + ' holds ' + countOf(plan.total, 'question') + '.'];
    var does = [];
    if (plan.added) does.push(plan.added + ' would be added');
    if (plan.updated) does.push(plan.updated + ' would change a question already in your bank');
    if (plan.there) does.push(plan.there + (plan.there === 1 ? ' is' : ' are') + ' already in your bank');
    if (plan.refused) does.push(plan.refused + ' would be left out (no question or no answer)');
    if (does.length) parts.push(does.join(', ') + '.');
    parts.push(plan.added || plan.updated
      ? 'Nothing is stored until you press the button, and an import never deletes.'
      : 'There is nothing to add, so nothing was stored.');
    return parts.join(' ');
  }

  /* ---- the form's parts (need a document) ------------------------------ */

  function el(tag, className, text) {
    var node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text !== null && text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, label) {
    var b = el('button', className, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }

  /** A question's choices as one line for the list and a preview, the right
      one marked; null for a question with none. */
  function choicesLine(q) {
    var choices = (q && q.choices) || [];
    if (!choices.length) return null;
    var line = el('p', 'bank-choices'), right = rightIndex(choices, q.answer);
    line.appendChild(el('span', 'bank-choices-label', 'Choices: '));
    choices.forEach(function (c, i) {
      if (i) line.appendChild(global.document.createTextNode(' · '));
      var item = el(i === right ? 'b' : 'span', 'bank-choice', c);
      line.appendChild(item);
      if (i === right) line.appendChild(el('span', 'bank-choice-right', ' (answer)'));
    });
    return line;
  }

  /** The choices editor: a row a choice (mark it right, type it, move it up
      or down, remove it) and an Add button. `opts.answer` is the form's
      answer field, which marking a choice writes to. Returns
      { node, get(), raw(), set(list) }. */
  function choicesField(opts) {
    var base = opts.idBase, answer = opts.answer;
    var choices = [];
    var node = el('fieldset', 'bank-choices-field');
    node.appendChild(el('legend', '', 'Choices (optional)'));
    var hint = el('p', 'hint', 'Leave this empty for a question with no choices. Mark the right choice and it becomes the answer.');
    hint.id = base + 'ChoicesHint';
    node.appendChild(hint);
    var list = el('ol', 'bank-choice-list');
    node.appendChild(list);
    var addBtn = button('secondary small bank-choice-add', '+ Add a choice');
    addBtn.id = base + 'ChoiceAdd';
    node.appendChild(addBtn);
    var status = el('p', 'import-status bank-choice-status');
    status.setAttribute('role', 'status');
    node.appendChild(status);

    function say() {
      var n = notes({ prompt: 'x', answer: answer.value, choices: choices });
      status.textContent = n.length ? n[0] : '';
    }
    function mark() {
      var right = rightIndex(choices, answer.value);
      Array.prototype.forEach.call(list.querySelectorAll('input[type="radio"]'), function (r, i) {
        r.checked = i === right;
        r.disabled = !String(choices[i]).trim();
      });
      say();
    }
    function focusIn(at, selector) {
      var row = list.children[at], target = row && row.querySelector(selector);
      if (target && target.disabled) target = row.querySelector('input[type="text"]');
      (target || addBtn).focus();
    }
    function render() {
      list.textContent = '';
      choices.forEach(function (text, i) {
        var n = i + 1, row = el('li', 'bank-choice-row');
        var radio = el('input');
        radio.type = 'radio';
        radio.name = base + 'Right';
        radio.setAttribute('aria-label', 'Choice ' + n + ' is the answer');
        radio.addEventListener('change', function () {
          if (radio.checked && String(choices[i]).trim()) answer.value = String(choices[i]).trim();
          mark();
        });
        var input = el('input', 'bank-choice-text');
        input.type = 'text';
        input.value = text;
        input.setAttribute('aria-label', 'Choice ' + n);
        input.addEventListener('input', function () {
          var wasRight = rightIndex(choices, answer.value) === i;
          choices[i] = input.value;
          if (wasRight) answer.value = input.value.trim();
          mark();
        });
        var up = button('secondary small bank-choice-up', '↑', 'Move choice ' + n + ' up');
        up.disabled = i === 0;
        up.addEventListener('click', function () {
          choices = move(choices, i, -1);
          render();
          focusIn(i - 1, '.bank-choice-up');
          status.textContent = 'Choice moved to place ' + i + ' of ' + choices.length + '.';
        });
        var down = button('secondary small bank-choice-down', '↓', 'Move choice ' + n + ' down');
        down.disabled = i === choices.length - 1;
        down.addEventListener('click', function () {
          choices = move(choices, i, 1);
          render();
          focusIn(i + 1, '.bank-choice-down');
          status.textContent = 'Choice moved to place ' + (i + 2) + ' of ' + choices.length + '.';
        });
        var remove = button('danger small bank-choice-remove', 'Remove', 'Remove choice ' + n);
        remove.addEventListener('click', function () {
          choices = choices.filter(function (c, at) { return at !== i; });
          render();
          focusIn(Math.min(i, choices.length - 1), 'input[type="text"]');
          status.textContent = 'Choice removed. ' + countOf(choices.length, 'choice') + ' left.';
        });
        [radio, input, up, down, remove].forEach(function (part) { row.appendChild(part); });
        list.appendChild(row);
      });
      list.hidden = !choices.length;
      mark();
    }
    addBtn.addEventListener('click', function () {
      choices = choices.concat(['']);
      render();
      focusIn(choices.length - 1, 'input[type="text"]');
    });
    answer.addEventListener('input', mark);
    render();
    return {
      node: node,
      get: function () { return cleanChoices(choices); },
      raw: function () { return choices.slice(); },
      set: function (next) { choices = (Array.isArray(next) ? next : []).map(String); render(); },
      mark: mark
    };
  }

  /** The tags editor: the tags as tokens with a Remove button each, and a
      field that adds one. `opts.suggestions()` is the tags the bank already
      uses. Returns { node, get(), set(list) }; get() takes what is still
      typed in the field as a tag too. */
  function tagsField(opts) {
    var base = opts.idBase, tags = [];
    var node = el('div', 'bank-tags-field');
    var label = el('label', '', 'Tags');
    label.htmlFor = base + 'TagInput';
    node.appendChild(label);
    var tokens = el('ul', 'bank-token-list');
    tokens.setAttribute('aria-label', 'Tags on this question');
    node.appendChild(tokens);
    var line = el('div', 'bank-tag-entry');
    var input = el('input');
    input.type = 'text';
    input.id = base + 'TagInput';
    input.setAttribute('list', base + 'TagOptions');
    input.setAttribute('aria-describedby', base + 'TagHint');
    input.placeholder = 'e.g. rivers';
    input.autocomplete = 'off';
    var options = el('datalist');
    options.id = base + 'TagOptions';
    var addBtn = button('secondary small bank-tag-add', 'Add tag');
    line.appendChild(input);
    line.appendChild(options);
    line.appendChild(addBtn);
    node.appendChild(line);
    var hint = el('p', 'hint', 'Press Enter or type a comma after each tag. The list offers the tags your bank already uses.');
    hint.id = base + 'TagHint';
    node.appendChild(hint);
    var status = el('p', 'import-status bank-tag-status');
    status.setAttribute('role', 'status');
    node.appendChild(status);

    function render() {
      tokens.textContent = '';
      tags.forEach(function (tag) {
        var item = el('li', 'bank-token');
        item.appendChild(el('span', 'bank-token-text', tag));
        var remove = button('bank-token-remove', '×', 'Remove tag: ' + tag);
        remove.addEventListener('click', function () {
          tags = removeTag(tags, tag);
          render();
          status.textContent = 'Removed the tag ' + tag + '.';
          input.focus();
        });
        item.appendChild(remove);
        tokens.appendChild(item);
      });
      tokens.hidden = !tags.length;
      offer();
    }
    /* The bank's tags, less the ones on this question. Drawn again each
       time the field is entered, since the bank may have gained one. */
    function offer() {
      options.textContent = '';
      (opts.suggestions ? opts.suggestions() : []).forEach(function (s) {
        if (rightIndex(tags, s) !== -1) return;
        var opt = el('option');
        opt.value = s;
        options.appendChild(opt);
      });
    }
    function commit() {
      if (!input.value.trim()) { input.value = ''; return; }
      var before = tags.length;
      tags = addTags(tags, input.value);
      input.value = '';
      render();
      status.textContent = tags.length > before ? countOf(tags.length, 'tag') + ' on this question.' : 'That tag is already on this question.';
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Backspace' && !input.value && tags.length) {
        var last = tags[tags.length - 1];
        tags = tags.slice(0, -1);
        render();
        status.textContent = 'Removed the tag ' + last + '.';
      }
    });
    input.addEventListener('input', function (e) {
      // A comma ends a tag; so does a pick from the list, which Chromium
      // reports as a replacement and not as typing.
      if (/[,;]/.test(input.value) || (e && e.inputType === 'insertReplacementText')) commit();
    });
    input.addEventListener('focus', offer);
    input.addEventListener('change', commit);              // a pick from the list, or leaving the field
    addBtn.addEventListener('click', function () { commit(); input.focus(); });
    render();
    return {
      node: node,
      get: function () { commit(); return tags.slice(); },
      set: function (next) { tags = cleanTags(next); input.value = ''; status.textContent = ''; render(); }
    };
  }

  function labelled(text, control, id) {
    var wrap = el('div', 'bank-edit-field'), label = el('label', '', text);
    control.id = id;
    label.htmlFor = id;
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
  }

  /** The form a question opens into where it stands in the list: every
      field the bank's shape holds that a teacher types. `opts` is
      { idBase, draft, title, suggestions(), onSave(draft), onCancel() }.
      Escape anywhere in it cancels. Returns { node, read(), focus(),
      say(kind, text) }. */
  function editForm(opts) {
    var base = opts.idBase, d = opts.draft;
    var node = el('div', 'bank-edit');
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', 'Edit question: ' + opts.title);
    var prompt = el('textarea'); prompt.rows = 2; prompt.value = d.prompt;
    var answer = el('textarea'); answer.rows = 2; answer.value = d.answer;
    var points = el('input'); points.type = 'number'; points.value = String(d.points);
    var unit = el('input'); unit.type = 'text'; unit.value = d.unit;
    var standard = el('input'); standard.type = 'text'; standard.value = d.standard;
    var difficulty = el('select');
    [''].concat(QB.DIFFICULTIES).forEach(function (v) {
      var opt = el('option', '', v || '—');
      opt.value = v;
      difficulty.appendChild(opt);
    });
    difficulty.value = d.difficulty;
    node.appendChild(labelled('Question', prompt, base + 'Question'));
    node.appendChild(labelled('Answer', answer, base + 'Answer'));
    var row = el('div', 'import-row');
    row.appendChild(labelled('Suggested points', points, base + 'Points'));
    row.appendChild(labelled('Unit', unit, base + 'Unit'));
    row.appendChild(labelled('Standard', standard, base + 'Standard'));
    row.appendChild(labelled('Difficulty', difficulty, base + 'Difficulty'));
    node.appendChild(row);
    var choices = choicesField({ idBase: base, answer: answer });
    choices.set(d.choices);
    node.appendChild(choices.node);
    var tags = tagsField({ idBase: base, suggestions: opts.suggestions });
    tags.set(d.tags);
    node.appendChild(tags.node);
    var actions = el('div', 'arrival-actions');
    var save = button('bank-edit-save', 'Save');
    var cancel = button('secondary bank-edit-cancel', 'Cancel');
    actions.appendChild(save);
    actions.appendChild(cancel);
    node.appendChild(actions);
    var status = el('p', 'import-status bank-edit-status');
    status.setAttribute('role', 'alert');
    node.appendChild(status);

    function read() {
      return {
        prompt: prompt.value, answer: answer.value, points: points.value, unit: unit.value,
        standard: standard.value, difficulty: difficulty.value,
        tags: tags.get(), choices: choices.raw()
      };
    }
    save.addEventListener('click', function () { opts.onSave(read()); });
    cancel.addEventListener('click', function () { opts.onCancel(); });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); opts.onCancel(); }
    });
    return {
      node: node,
      read: read,
      focus: function () { prompt.focus(); },
      say: function (kind, text) {
        status.className = 'import-status bank-edit-status' + (kind ? ' ' + kind : '');
        status.textContent = text;
      }
    };
  }

  global.ReviewBankEditor = {
    MOST_SHOWN: MOST_SHOWN,
    cleanTags: cleanTags,
    cleanChoices: cleanChoices,
    addTags: addTags,
    removeTag: removeTag,
    rightIndex: rightIndex,
    move: move,
    draftOf: draftOf,
    questionOf: questionOf,
    problems: problems,
    notes: notes,
    differences: differences,
    changed: changed,
    importPlan: importPlan,
    statusLabel: statusLabel,
    planSentence: planSentence,
    choicesLine: choicesLine,
    choicesField: choicesField,
    tagsField: tagsField,
    editForm: editForm
  };
})(window);
