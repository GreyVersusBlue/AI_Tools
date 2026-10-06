/* question-bank.js — the site's one question bank (Path 12 P1): a shared,
   versioned list of questions that any tool may read, with 030 Quiz / Review
   Game Board as the page a teacher edits it on. Publishes window.QuestionBank.
   Needs _shared/store.js loaded first for anything that touches storage; the
   pure half (normalize, validate, merge, the file formats) needs nothing.

   A QUESTION
     { id, prompt, answer, choices?, media?, unit, standard, difficulty, tags,
       points, createdAt, updatedAt? }
   `prompt` and `answer` are text, trimmed. `choices` is a list of texts and is
   left off when there are none. `media` is carried exactly as given and never
   read here (Path 12 P4 gives it a meaning). `unit` and `standard` are free
   text; `difficulty` is '', 'Easy', 'Medium' or 'Hard'; `tags` is a list of
   texts with no blanks and no repeats; `points` is a number (030's value of a
   clue; 0 when there is none). A field this file does not know is kept on the
   question through every read, write and JSON file, so a newer page's field
   survives an older page's save.

   WHAT IS STORED
     key 'gvb-question-bank', a Store envelope { v: 1, data: {
       schema: 1,
       questions: [ question, ... ],          // the teacher's order
       legacy: { 'gvb-review-board-bank:entries': [ id, ... ] } } }
   `legacy` lists every id this bank has ever taken from 030's old key.

   THE MIGRATION, exactly
   Until v265 the bank was 030's own key, 'gvb-review-board-bank:entries': a
   bare array of { id, question, answer, points, unit, standard, difficulty,
   createdAt }, the only shape it ever had. That key is READ here and never
   written or removed. Every load() takes each old entry whose id is not in
   `legacy`, turns `question` into `prompt`, keeps its id and its place, adds it
   after what the bank holds and records the id. So:
     - the first load moves the whole old bank over, entry for entry, in order;
     - an older 030 page (a tab left open, a service worker not yet updated)
       still reads and writes the old key and is not broken by this one. What it
       adds there arrives here on the next load. What it deletes there stays
       here, and what is added or deleted here it does not see;
     - a 009 backup made before v265 holds only the old key. Restored with
       "replace", this key is gone and the next load migrates the backup whole.
       Restored with "merge", old entries not seen before are added; one that
       was deleted here since stays deleted, because its id is in `legacy`.
   A stored `schema` above this file's is a newer page's bank: it is read, and
   every write is refused ({ ok: false, newer: true }) so nothing is lost.

   IDS
   An id is made once, 'q-<time, base 36>-<random>', and never changes; an old
   entry keeps its 'bank-…' id. A file carries ids. Importing a question whose
   id the bank has replaces that question where it stands (fields the file's
   format cannot carry, `media` in a spreadsheet, are kept); one with no id, or
   an id the bank has not seen, is new, unless its prompt and answer already
   match a question in the bank (letter case and spacing aside), when it is
   skipped. So the same file imported twice changes nothing the second time.

   FILES
   toJSON()/parse() are the whole bank with nothing lost. toRows()/fromRows()
   are a header row and one row per question for ExportKit.toCsv/toXlsx, which
   write text as text and guard a formula; parseCsv() reads a CSV back and
   takes that guard's apostrophe off again. Every cell read is text: '007' and
   '1/2' are answers, not numbers.

   Plain global script, not an ES module, for store.js's reason. */
(function (global) {
  'use strict';

  var KEY = 'gvb-question-bank';
  var LEGACY_KEY = 'gvb-review-board-bank:entries';
  var VERSION = 1;
  var FORMAT = 'aplp-question-bank';
  var DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
  var KNOWN = ['id', 'prompt', 'answer', 'choices', 'media', 'unit', 'standard', 'difficulty', 'tags', 'points', 'createdAt', 'updatedAt'];
  // A field name that would change an object's prototype if assigned.
  // (Made this way because '__proto__' in an object literal is not a key.)
  var UNSAFE = Object.create(null);
  UNSAFE['__proto__'] = UNSAFE.constructor = UNSAFE.prototype = true;

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isRecord(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function text(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return isFinite(v) ? String(v) : '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    return '';
  }
  function fold(s) { return text(s).toLowerCase().replace(/\s+/g, ' '); }

  function difficulty(v) {
    var s = fold(v);
    for (var i = 0; i < DIFFICULTIES.length; i++) if (DIFFICULTIES[i].toLowerCase() === s) return DIFFICULTIES[i];
    return '';
  }

  /** A list of texts from a list, or from one text split on `splitter`: no
      blanks, no repeats (the first spelling wins), line breaks made spaces. */
  function textList(v, splitter) {
    var parts = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(splitter) : []);
    var out = [], seen = {};
    for (var i = 0; i < parts.length; i++) {
      var s = text(parts[i]).replace(/\s*[\r\n]+\s*/g, ' ');
      var k = '$' + s.toLowerCase();
      if (!s || own(seen, k)) continue;
      seen[k] = true;
      out.push(s);
    }
    return out;
  }

  /** Choices from a list, or from one cell: a line each when the cell has a
      line break in it, and split on the bar when it has none. */
  function choiceList(v) {
    return textList(v, typeof v === 'string' && /[\r\n]/.test(v) ? /\r?\n|\r/ : /\|/);
  }

  function points(v) {
    var n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : Number(v);
    return isFinite(n) ? n || 0 : 0;
  }

  /** 'q-' + the time in base 36 + '-' + seven random characters. `now` and
      `random` are for a suite. */
  function makeId(now, random) {
    var t = (typeof now === 'number' ? now : Date.now()).toString(36);
    var r = (typeof random === 'function' ? random() : Math.random()).toString(36).slice(2, 9);
    return 'q-' + t + '-' + (r || '0');
  }

  /** `q` as a full question: every known field present and of its type, an
      unknown field kept as it is. Never throws; anything that is not a record
      is a blank question. The id is kept, or '' when there is none: the
      caller that stores the question gives it one. */
  function normalize(q) {
    q = isRecord(q) ? q : {};
    var out = {
      id: text(q.id),
      prompt: text(own(q, 'prompt') ? q.prompt : q.question),
      answer: text(q.answer)
    };
    var choices = choiceList(q.choices);
    if (choices.length) out.choices = choices;
    if (own(q, 'media') && q.media !== undefined && q.media !== null) out.media = q.media;
    out.unit = text(q.unit);
    out.standard = text(q.standard);
    out.difficulty = difficulty(q.difficulty);
    out.tags = textList(q.tags, /[,;]/);
    out.points = points(q.points);
    out.createdAt = text(q.createdAt);
    if (text(q.updatedAt)) out.updatedAt = text(q.updatedAt);
    for (var k in q) {
      if (!own(q, k) || UNSAFE[k] || KNOWN.indexOf(k) !== -1) continue;
      if (k === 'question') continue;                        // 030's old name for `prompt`
      if (q[k] !== undefined) out[k] = q[k];
    }
    return out;
  }

  /** What stops `q` being a question a tool can ask: a list of sentences,
      empty when there is nothing wrong. */
  function validate(q) {
    var n = normalize(q), errors = [];
    if (!n.prompt) errors.push('no question');
    if (!n.answer) errors.push('no answer');
    return errors;
  }

  /** One of 030's old entries as a question. An entry with no id (030 never
      wrote one) is 'bank-legacy'. */
  function fromLegacy(entry) {
    var q = normalize(entry);
    if (!q.id) q.id = 'bank-legacy';
    return q;
  }

  /** A question as 030's page has always read a bank entry: these eight
      fields, in this order. */
  function toLegacy(q) {
    return {
      id: q.id, question: q.prompt, answer: q.answer, points: q.points,
      unit: q.unit, standard: q.standard, difficulty: q.difficulty, createdAt: q.createdAt
    };
  }

  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }
  function contentKey(q) { return fold(q.prompt) + '\u0000' + fold(q.answer); }
  function stamp(opts) { return (opts && opts.now) || new Date().toISOString(); }
  function freshId(list, opts) {
    var id, tries = 0;
    do { id = makeId(opts && opts.nowMs, opts && opts.random); } while (indexOfId(list, id) !== -1 && ++tries < 50);
    while (indexOfId(list, id) !== -1) id += 'x';
    return id;
  }

  /** `list` with `q` put in: over the question that has its id, there, with
      the fields `q` does not name kept; or at the end, with a new id when it
      has none. Returns { questions, question }; `list` is not changed. */
  function upsert(list, q, opts) {
    var out = list.slice(), at = isRecord(q) && text(q.id) ? indexOfId(out, text(q.id)) : -1, next;
    if (at !== -1) {
      var merged = {}, k;
      for (k in out[at]) if (own(out[at], k)) merged[k] = out[at][k];
      for (k in q) if (own(q, k) && !UNSAFE[k] && q[k] !== undefined) merged[k] = q[k];
      if (own(q, 'question') && !own(q, 'prompt')) merged.prompt = q.question;
      delete merged.question;
      if (Array.isArray(merged.choices) && !merged.choices.length) delete merged.choices;
      merged.updatedAt = stamp(opts);
      next = normalize(merged);
      out[at] = next;
    } else {
      next = normalize(q);
      if (!next.id) next.id = freshId(out, opts);
      if (!next.createdAt) next.createdAt = stamp(opts);
      out.push(next);
    }
    return { questions: out, question: next };
  }

  function remove(list, id) {
    return list.filter(function (q) { return q.id !== id; });
  }

  /** The questions matching every filter that is set: unit, standard and
      difficulty exactly, `tag` as one of the question's tags, and `query`
      anywhere in the prompt or the answer, whatever the letter case. */
  function filter(list, filters) {
    filters = filters || {};
    var q = text(filters.query).toLowerCase();
    return list.filter(function (e) {
      if (filters.unit && e.unit !== filters.unit) return false;
      if (filters.standard && e.standard !== filters.standard) return false;
      if (filters.difficulty && e.difficulty !== filters.difficulty) return false;
      if (filters.tag && (e.tags || []).indexOf(filters.tag) === -1) return false;
      if (q && e.prompt.toLowerCase().indexOf(q) === -1 && e.answer.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  /** The values in use for `field` ('unit', 'standard', 'difficulty' or
      'tags'), each once, sorted. */
  function distinct(list, field) {
    var seen = {}, out = [];
    list.forEach(function (e) {
      (Array.isArray(e[field]) ? e[field] : [e[field]]).forEach(function (v) {
        if (v && typeof v === 'string' && !own(seen, '$' + v)) { seen['$' + v] = true; out.push(v); }
      });
    });
    out.sort(function (a, b) { return a.localeCompare(b); });
    return out;
  }

  /** `incoming` questions put into `list` by the rules under IDS above.
      Returns { questions, added, updated, same, skipped, invalid }: counts,
      and `invalid` as [{ row, errors }] with `row` counted from 1. A question
      with no prompt or no answer is never stored. `list` is not changed. */
  function merge(list, incoming, opts) {
    var out = list.slice(), res = { questions: out, added: 0, updated: 0, same: 0, skipped: 0, invalid: [] };
    var byContent = {};
    out.forEach(function (q) { byContent[contentKey(q)] = true; });
    (Array.isArray(incoming) ? incoming : []).forEach(function (raw, i) {
      var errors = validate(raw);
      if (errors.length) { res.invalid.push({ row: i + 1, errors: errors }); return; }
      var q = normalize(raw), at = q.id ? indexOfId(out, q.id) : -1;
      if (at !== -1) {
        // Only what the file names: a format that cannot carry a field, or a
        // sheet with a column taken out, leaves the stored one alone.
        var patch = { id: q.id }, k;
        for (k in q) if (own(q, k) && (own(raw, k) || (k === 'prompt' && own(raw, 'question')))) patch[k] = q[k];
        if (own(raw, 'choices') && !own(q, 'choices')) patch.choices = [];
        if (!q.createdAt) delete patch.createdAt;
        delete patch.updatedAt;
        var before = JSON.stringify(out[at]);
        var done = upsert(out, patch, opts).question;
        var after = {}; for (k in done) if (own(done, k) && k !== 'updatedAt') after[k] = done[k];
        var was = JSON.parse(before); delete was.updatedAt;
        if (JSON.stringify(after) === JSON.stringify(was)) { res.same++; return; }
        out[at] = done;
        byContent[contentKey(done)] = true;
        res.updated++;
        return;
      }
      if (own(byContent, contentKey(q))) { res.skipped++; return; }
      var added = upsert(out, q, opts);
      out.push(added.question);
      byContent[contentKey(q)] = true;
      res.added++;
    });
    return res;
  }

  /* ---- files ----------------------------------------------------------- */

  /** The bank as one JSON file: every question, every field. */
  function toJSON(list, meta) {
    meta = meta || {};
    return JSON.stringify({
      format: FORMAT, version: VERSION,
      title: text(meta.title), exported: meta.exported || new Date().toISOString(),
      questions: list.map(normalize)
    }, null, 2);
  }

  var COLUMNS = [
    { key: 'prompt', label: 'Question', names: ['question', 'prompt', 'clue', 'term'] },
    { key: 'answer', label: 'Answer', names: ['answer', 'response', 'definition'] },
    { key: 'points', label: 'Points', names: ['points', 'value', 'pts'] },
    { key: 'unit', label: 'Unit', names: ['unit'] },
    { key: 'standard', label: 'Standard', names: ['standard', 'standards'] },
    { key: 'difficulty', label: 'Difficulty', names: ['difficulty', 'level'] },
    { key: 'tags', label: 'Tags', names: ['tags', 'tag'] },
    { key: 'choices', label: 'Choices', names: ['choices', 'options'] },
    { key: 'id', label: 'ID (leave as it is)', names: ['id'] }
  ];

  /** A header row and one row per question, for ExportKit.toCsv/toXlsx.
      Points is a number; every other cell is text. Tags are joined with a
      comma, choices with ' | ' (a line each when one of them has a bar in
      it). `media` and unknown fields have no column: the JSON file has them. */
  function toRows(list) {
    var rows = [COLUMNS.map(function (c) { return c.label; })];
    list.forEach(function (raw) {
      var q = normalize(raw), choices = q.choices || [];
      var bar = choices.some(function (c) { return c.indexOf('|') !== -1; });
      rows.push([reguard(q.prompt), reguard(q.answer), q.points, reguard(q.unit), reguard(q.standard), q.difficulty,
        reguard(q.tags.join(', ')), reguard(choices.join(bar ? '\n' : ' | ')), reguard(q.id)]);
    });
    return rows;
  }

  /* ExportKit.toCsv puts an apostrophe before a cell that starts like a
     formula, and unguard() takes one off. So text that really begins with an
     apostrophe and then such a character is written with one more, and comes
     back as it was from a CSV and a workbook alike. */
  var GUARDED = /^'+[=+\-@\t\r]/;
  function reguard(s) { return GUARDED.test(s) ? "'" + s : s; }
  function unguard(s) { return GUARDED.test(s) ? s.slice(1) : s; }

  /** Rows (arrays of cells, a header row first) as questions. The header
      names the columns in any order and any letter case; a column it does not
      know is ignored, and a file with no "question" and "answer" header is
      refused. Every cell is read as text, with a formula guard's leading
      apostrophe taken off. A row with nothing in it is passed over. Returns
      { questions, rows, error }: `rows[i]` is the sheet row questions[i] came
      from, counted from 1. */
  function fromRows(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var head = -1, map = null, r, c;
    for (r = 0; r < rows.length && r < 10 && head === -1; r++) {
      if (!Array.isArray(rows[r])) continue;
      var found = {};
      for (c = 0; c < rows[r].length; c++) {
        var name = fold(rows[r][c]).replace(/\s*\(.*\)\s*$/, '');
        for (var k = 0; k < COLUMNS.length; k++) {
          if (COLUMNS[k].names.indexOf(name) !== -1 && !own(found, COLUMNS[k].key)) found[COLUMNS[k].key] = c;
        }
      }
      if (own(found, 'prompt') && own(found, 'answer')) { head = r; map = found; }
    }
    if (head === -1) return { questions: [], rows: [], error: 'No header row with a "Question" and an "Answer" column was found.' };
    var out = [], at = [];
    for (r = head + 1; r < rows.length; r++) {
      var line = rows[r];
      if (!Array.isArray(line)) continue;
      var q = {}, any = false;
      for (var key in map) {
        if (!own(map, key)) continue;
        var v = unguard(text(line[map[key]]));
        if (v) any = true;
        q[key] = v;
      }
      if (!any) continue;
      if (own(q, 'choices')) q.choices = choiceList(q.choices);
      out.push(q);
      at.push(r + 1);
    }
    return { questions: out, rows: at, error: '' };
  }

  /** CSV text as rows of cells (RFC 4180: quoted cells, doubled quotes, line
      breaks inside quotes), with a byte order mark dropped. The delimiter is
      the one of , ; and tab the first line has most of. */
  function parseCsv(csv) {
    var s = String(csv === null || csv === undefined ? '' : csv).replace(/^\uFEFF/, '');
    var first = s.split(/\r?\n/)[0] || '', delim = ',', best = 0;
    [',', ';', '\t'].forEach(function (d) {
      var n = first.split(d).length - 1;
      if (n > best) { best = n; delim = d; }
    });
    var rows = [], row = [], cell = '', quoted = false, i = 0, ch;
    while (i < s.length) {
      ch = s[i];
      if (quoted) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
          quoted = false;
        } else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push(row); row = [];
      } else cell += ch;
      i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /** A file's text as questions: this module's JSON, a bare JSON list of
      questions (030's old entries among them), or CSV. Returns { questions,
      rows, error }, as fromRows() does. */
  function parse(fileText) {
    var s = String(fileText === null || fileText === undefined ? '' : fileText).replace(/^\uFEFF/, '');
    if (/^\s*[\[{]/.test(s)) {
      var data;
      try { data = JSON.parse(s); } catch (e) { return { questions: [], rows: [], error: 'That file is not readable JSON.' }; }
      var list = Array.isArray(data) ? data : (isRecord(data) && Array.isArray(data.questions) ? data.questions : null);
      if (!list) return { questions: [], rows: [], error: 'That file has no list of questions in it.' };
      if (isRecord(data) && typeof data.version === 'number' && data.version > VERSION) {
        return { questions: [], rows: [], error: 'That bank was saved by a newer version of this site. Update this page, then import it again.' };
      }
      return { questions: list.filter(isRecord), rows: list.filter(isRecord).map(function (q, i) { return i + 1; }), error: '' };
    }
    return fromRows(parseCsv(s));
  }

  /* ---- storage --------------------------------------------------------- */

  /* The callers below spell the Store call out in full, with the key's
     constant, and not through a local: that is what check:registry's
     call-site scan reads to know which keys this file touches. */
  function needStore() {
    if (!global.Store) throw new Error('QuestionBank: _shared/store.js must be loaded first');
  }

  /** What is on disk, as { schema, questions, legacy }, with nothing
      adopted and nothing written. */
  function read() {
    needStore();
    var data = global.Store.get(KEY, { version: VERSION, default: null, migrate: function (v, d) { return d; } });
    var bank = { schema: VERSION, questions: [], legacy: {} };
    if (!isRecord(data)) return bank;
    if (typeof data.schema === 'number' && data.schema > VERSION) bank.schema = data.schema;
    if (Array.isArray(data.questions)) {
      var seen = {};
      data.questions.forEach(function (q, i) {
        if (!isRecord(q)) return;
        var n = normalize(q);
        if (!n.id) n.id = 'q-noid-' + i;
        if (own(seen, '$' + n.id)) return;
        seen['$' + n.id] = true;
        bank.questions.push(n);
      });
    }
    if (isRecord(data.legacy)) {
      for (var k in data.legacy) if (own(data.legacy, k) && !UNSAFE[k] && Array.isArray(data.legacy[k])) bank.legacy[k] = data.legacy[k].map(String);
    }
    return bank;
  }

  /** 030's old key, as it lies: a list, or [] for anything else. */
  function readLegacy() {
    needStore();
    var list = global.Store.get(LEGACY_KEY, { default: [], migrate: function (v, d) { return d; } });
    return Array.isArray(list) ? list : [];
  }

  /** `bank` with every old entry it has not seen added at the end, in the old
      order. Returns true when it took any. Pure: the old list is handed in.
      030 never wrote two entries with one id; if a list has them anyway, the
      second is kept as '<id>~2' and so on, not dropped. */
  function adopt(bank, legacyList) {
    var seenList = (bank.legacy[LEGACY_KEY] || []).slice(), seen = {}, times = {}, took = false;
    seenList.forEach(function (id) { seen['$' + id] = true; });
    (Array.isArray(legacyList) ? legacyList : []).forEach(function (entry) {
      if (!isRecord(entry)) return;
      var q = fromLegacy(entry), n = times['$' + q.id] = (times['$' + q.id] || 0) + 1;
      if (n > 1) q.id += '~' + n;
      if (own(seen, '$' + q.id)) return;
      seen['$' + q.id] = true;
      seenList.push(q.id);
      took = true;
      if (indexOfId(bank.questions, q.id) === -1) bank.questions.push(q);
    });
    bank.legacy[LEGACY_KEY] = seenList;
    return took;
  }

  function write(bank) {
    if (bank.schema > VERSION) return { ok: false, newer: true, quota: false, blocked: false };
    needStore();
    return global.Store.set(KEY, { schema: VERSION, questions: bank.questions, legacy: bank.legacy }, { version: VERSION });
  }

  /** The bank, after the migration above. Writes only when it took an old
      entry. */
  function load() {
    var bank = read();
    if (bank.schema === VERSION && adopt(bank, readLegacy())) write(bank);
    return bank;
  }

  /** Every question, in the teacher's order. */
  function list() { return load().questions; }

  /** Stores one question (see upsert). Returns { ok, question } and Store's
      own flags; a question with no prompt or answer is still the caller's to
      refuse. */
  function saveQuestion(q, opts) {
    var bank = load(), done = upsert(bank.questions, q, opts);
    bank.questions = done.questions;
    var res = write(bank);
    res.question = done.question;
    return res;
  }

  function deleteQuestion(id) {
    var bank = load();
    bank.questions = remove(bank.questions, id);
    return write(bank);
  }

  /** Merges questions into the stored bank (see merge). Returns merge()'s
      counts with `ok` from the write; nothing is written when nothing
      changed. */
  function importQuestions(incoming, opts) {
    var bank = load(), res = merge(bank.questions, incoming, opts);
    res.ok = true;
    if (res.added || res.updated) {
      bank.questions = res.questions;
      var w = write(bank);
      res.ok = w.ok; res.newer = !!w.newer; res.quota = !!w.quota; res.blocked = !!w.blocked;
    }
    return res;
  }

  /** Calls `fn(questions)` when the bank changes, in this tab or another.
      Returns the unsubscribe function. */
  function onChange(fn) {
    needStore();
    return global.Store.onChange(KEY, function () { fn(list()); });
  }

  global.QuestionBank = {
    KEY: KEY,
    LEGACY_KEY: LEGACY_KEY,
    VERSION: VERSION,
    FORMAT: FORMAT,
    DIFFICULTIES: DIFFICULTIES,
    COLUMNS: COLUMNS,
    makeId: makeId,
    normalize: normalize,
    validate: validate,
    fromLegacy: fromLegacy,
    toLegacy: toLegacy,
    upsert: upsert,
    remove: remove,
    filter: filter,
    distinct: distinct,
    merge: merge,
    adopt: adopt,
    toJSON: toJSON,
    toRows: toRows,
    fromRows: fromRows,
    parseCsv: parseCsv,
    parse: parse,
    read: read,
    load: load,
    list: list,
    saveQuestion: saveQuestion,
    deleteQuestion: deleteQuestion,
    importQuestions: importQuestions,
    onChange: onChange
  };
})(window);
