/* question-bank.js — the site's one question bank (Path 12 P1): a shared,
   versioned list of questions that any tool may read, with 030 Quiz / Review
   Game Board as the page a teacher edits it on. Publishes window.QuestionBank.
   Needs _shared/store.js loaded first for anything that touches storage; the
   pure half (normalize, validate, merge, the file formats) needs nothing.

   A QUESTION
     { id, prompt, answer, choices?, media?, unit, standard, difficulty, tags,
       points, createdAt, updatedAt? }
   `prompt` and `answer` are text, trimmed. `choices` is a list of texts and is
   left off when there are none. `media` is carried exactly as given; its one
   meaning is `media.image`, a picture (see PICTURES below). `unit` and `standard` are free
   text; `difficulty` is '', 'Easy', 'Medium' or 'Hard'; `tags` is a list of
   texts with no blanks and no repeats; `points` is a number (030's value of a
   clue; 0 when there is none). A field this file does not know is kept on the
   question through every read, write and JSON file, so a newer page's field
   survives an older page's save.

   WHAT IS STORED
     key 'gvb-question-bank', a Store envelope { v: 1, data: {
       schema: 1,                             // 2 while `sets` has one in it
       questions: [ question, ... ],          // the teacher's order
       legacy: { 'gvb-review-board-bank:entries': [ id, ... ] },
       sets: [ named set, ... ] } }           // only when there is one
   `legacy` lists every id this bank has ever taken from 030's old key.
   `sets` is the teacher's NAMED SETS (below).

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

   SEED SETS (Path 12 P2)
   A seed set is a tool's built-in questions in this file's shape, for any
   page to read: registerSet({ id, title, source, note, questions }), called
   by the tool's own data file (053's ctcg-bank.js, 062's gbq-bank.js) when it
   loads after this one. A set lives in memory only. NOTHING of it is stored,
   under any key, until a teacher copies a question out of it.
     - Its questions' ids are 'seed:<set id>:<the tool's own id>', which is as
       stable as the tool's id: reading the data again gives the same ids.
     - It is read-only. sets(), setQuestions() and findSeed() hand out copies,
       so nothing a caller does to one reaches the set; and nothing here
       stores a seed id: upsert() and merge() take a question that arrives
       with one as a NEW question of the teacher's (detach(): a fresh id,
       the seed's id kept in `copiedFrom`). So no save, import or bank file
       can write over a seed or pass for one.
     - copyFromSet(ids) is that copy, stored. The same question copied twice
       is skipped the second time (its prompt and answer are in the bank); a
       copy the teacher has since changed is theirs and is left alone, and
       copying again then adds the seed's wording beside it.
     - A stored bank made before sets existed needs no migration, and a page
       from before them reads `copiedFrom` as a field it does not know, and
       keeps it.

   LINKS (Path 6 P4, 053 to 030)
   A tool sends questions to the bank's page in a share link (_shared/
   handoffs.js builds it; 030 reads `?questions=`). What rides the link:
     { v: 1, from: '<the sender's slug>', name: '<a title>',
       questions: [ { prompt, answer, unit?, standard?, difficulty?, tags?,
                      choices?, points? }, ... ] }
   A link is the one input here that the person at the keyboard did not type,
   so fromLink() takes NOTHING from it but those eight fields, as text of a
   bounded length (LINK below), and at most LINK.questions questions:
     - an `id` is dropped. A link cannot name a question in the bank, so it
       cannot write over one; what arrives is new, or is skipped because its
       prompt and answer are already there (merge()'s rule for a question
       with no id). So the same link opened twice adds nothing the second
       time, and a question once added keeps the id the bank gave it;
     - `media`, dates, `copiedFrom` and any field this file does not know
       are dropped. The sender's slug is kept in `sharedFrom` when it is one
       (lower case, digits and dashes);
     - a question with no prompt or no answer is left out and counted.
   fromLink() stores nothing. The page shows what arrived and stores it, with
   importQuestions(), only when the teacher says so.

   A PAGE THAT ONLY READS (Path 12 P2, 040)
   load() writes once, when it takes 030's old entries. A page that is not
   the bank's own must not write anything a teacher did not ask for, so it
   reads with peek(): the same questions load() would give, with nothing
   written. Its first real write (importQuestions(), on a press) does the
   move. sources() is what a "Questions from" chooser lists, the teacher's
   bank first and then every seed set, and sourceLabel() is the one wording
   of an option in it, so 030's chooser and 040's cannot come to differ;
   questionsOf(source) is that source's questions. Each takes { peek: true }.

   PICTURES (Path 12 P4)
   A question may carry one picture, in `media.image`. The value is one of
   two strings, the two a clue on 030's board has always held:
     - 'idb:<id>': a Blob in the shared media store (_shared/media-db.js,
       database 'gvb-media') under the namespace MEDIA_NS, 'rgb'. That is
       030's namespace, on purpose: 030 is the page the bank is edited on,
       its ids are the picture's content hash, so the same map on a clue
       and on a bank question is ONE record, and its pass at load is the one
       that deletes pictures nothing points at, with the bank's references
       in what it keeps. A page that only reads the bank deletes nothing.
     - 'data:image/(png|jpeg|gif|webp);base64,…': the picture itself, in a
       browser with no IndexedDB, or in a FILE. A bank file never holds an
       'idb:' reference (it names a picture in the browser that wrote it):
       the page that saves the file puts each picture in as a data URL, and
       the page that reads one stores it and keeps the reference.
   imageOf(q) is the only reader: it gives one of those two, or ''. Anything
   else in `media` (an SVG, a 'data:text/html' URL, a web address, a `media`
   of another shape) is NOT a picture: it is carried as it was given and
   never shown. So a page that shows no pictures (040's cards, 020's
   matches, the printed sheets) needs no code to be safe: it never calls
   imageOf(). cleanMedia() is what a file's questions go through before they
   are shown or stored: a picture that is not one of the four types, is
   damaged, is over IMAGE_MAX characters or is another browser's reference
   is taken off that question (its words still import, and a question
   already in the bank keeps the picture it has) and named, by row. This
   file stores no picture and reads none: it has no MediaDB in it.

   NAMED SETS (Path 12 P2, v300; Devon, 2026-10-07: "B")
   A named set is the teacher's own ordered list of questions ("my Unit 3
   review"), saved with the bank, in `sets`:
     { id: 'set-<time, base 36>-<random>', name, items: [ question id, ... ],
       createdAt, updatedAt? }
   `items` are ids, in the teacher's order, and an id may be there more than
   once (a question asked twice in a review). An item is a question of the
   bank or a SEED question ('seed:…', which is as stable as the tool's own
   list), so a set can mix the teacher's questions with built-in ones and
   nothing is copied to make one. A set holds no words: editing a question
   changes it in every set it is in, and deleteQuestion() takes its id out of
   every set, every time it is there. An item whose question this page cannot
   find (a seed set not loaded here) is kept, and is counted as missing when
   the set is read; nothing else ever drops an item. A name is at most
   SET_LIMIT.name characters and a set at most SET_LIMIT.items items.
     - THE SCHEMA. A bank with no set is stored exactly as before (`schema: 1`,
       no `sets`), so nothing changes for anyone who never makes one. While a
       set exists `schema` is 2. A page from v265 to v299 reads a schema it
       does not know as a newer page's bank: it shows the questions and
       refuses every write, so it cannot save the bank without its sets and
       lose them. Deleting the last set puts the bank back to schema 1.
     - FILES. toJSON() writes `sets` beside `questions` when there is one;
       the file's `version` stays 1, so an older page still imports the
       questions of a new file (and leaves the sets, which it cannot read).
       parse() gives `sets` ([] for a file with none, which is every file made
       before v300). A spreadsheet or CSV has no sets.
     - IMPORT ADDS, NEVER OVERWRITES. importQuestions(questions, { sets })
       merges the questions first; merge() says, in `ids`, which stored id
       each file id became (the same id, a seed's copy, or the question with
       the same words that was already here), and mergeSets() puts each
       file set in through that map: one identical to a set here (same id, or
       same name and items) is `same`; any other is added as a NEW set (with
       the file's id when this bank has no set with it, and a new one when it
       has), its name given ' (2)', ' (3)' … when the name is taken.
       A set here is never changed or deleted by a file. An item that names
       no question here or in the file (a row left out as invalid) is dropped
       from the incoming set and counted.
     - 009's backup carries the key whole, sets in it, as it always has; a
       "replace" restore of an older backup takes the bank back to that
       backup, sets and all.
     - SEED SETS are not named sets and are untouched: registerSet() is
       memory only and a named set may only POINT at seed questions.
   sources({ named: true }) lists the named sets after the bank, as
   'named:<set id>', and questionsOf() reads one (repeats included, in
   order). Only 030 asks for them; 040's and 020's choosers are unchanged.

   Plain global script, not an ES module, for store.js's reason. */
(function (global) {
  'use strict';

  var KEY = 'gvb-question-bank';
  var LEGACY_KEY = 'gvb-review-board-bank:entries';
  var VERSION = 1;
  var SCHEMA = 2;                                   // the highest stored `schema` this file writes
  var NAMED_PREFIX = 'named:';
  var SET_LIMIT = { name: 120, items: 1000 };
  var FORMAT = 'aplp-question-bank';
  var DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
  var SEED_PREFIX = 'seed:';
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
    if (isRecord(q) && isSeedId(q.id)) q = detach(q);
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
      Returns { questions, added, updated, same, skipped, invalid, ids }:
      counts, `invalid` as [{ row, errors }] with `row` counted from 1, and
      `ids`, each file id of a row that was taken mapped to the id it has in
      the result (see NAMED SETS). A question
      with no prompt or no answer is never stored. `list` is not changed. */
  function merge(list, incoming, opts) {
    var out = list.slice(), res = { questions: out, added: 0, updated: 0, same: 0, skipped: 0, invalid: [], ids: {} };
    var byContent = {};
    out.forEach(function (q) { if (!own(byContent, contentKey(q))) byContent[contentKey(q)] = q.id; });
    (Array.isArray(incoming) ? incoming : []).forEach(function (raw, i) {
      var errors = validate(raw);
      if (errors.length) { res.invalid.push({ row: i + 1, errors: errors }); return; }
      var fileId = isRecord(raw) ? text(raw.id) : '';
      function took(id) { if (fileId && !UNSAFE[fileId]) res.ids[fileId] = id; }
      if (isSeedId(raw.id)) raw = detach(raw);                 // a seed is never stored as itself
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
        took(q.id);
        if (JSON.stringify(after) === JSON.stringify(was)) { res.same++; return; }
        out[at] = done;
        if (!own(byContent, contentKey(done))) byContent[contentKey(done)] = done.id;
        res.updated++;
        return;
      }
      if (own(byContent, contentKey(q))) { took(byContent[contentKey(q)]); res.skipped++; return; }
      var added = upsert(out, q, opts);
      out.push(added.question);
      byContent[contentKey(q)] = added.question.id;
      took(added.question.id);
      res.added++;
    });
    return res;
  }

  /* ---- seed sets (read-only, in memory) -------------------------------- */

  var seedSets = [];                                           // registration order

  function isSeedId(id) { return typeof id === 'string' && id.trim().indexOf(SEED_PREFIX) === 0; }

  /** 'seed:<set>:<the tool's own id>'. Colons in the set id are made dashes,
      so the set can always be read back off the id. */
  function seedId(setId, localId) {
    return SEED_PREFIX + text(setId).replace(/:/g, '-') + ':' + text(localId);
  }

  /** The set id a seed id names, or ''. */
  function seedSetOf(id) {
    if (!isSeedId(id)) return '';
    var rest = id.trim().slice(SEED_PREFIX.length), at = rest.indexOf(':');
    return at === -1 ? '' : rest.slice(0, at);
  }

  /** `q` as a question of the teacher's own: no id (the bank gives it one),
      no dates, and the seed it came from in `copiedFrom`. A question that is
      not a seed comes back as a plain copy. */
  function detach(q) {
    var out = {}, k;
    for (k in q) if (own(q, k) && !UNSAFE[k]) out[k] = q[k];
    if (!isSeedId(out.id)) return out;
    out.copiedFrom = text(out.id);
    delete out.id;
    delete out.createdAt;
    delete out.updatedAt;
    return out;
  }

  /** Publishes a tool's built-in questions as a read-only set. `def` is
      { id, title, source, note, questions }: `source` is the tool's number
      and name for a page to show, and each question carries the tool's own
      id in `id` (it becomes seedId(set, id)). A question with no id, a
      repeated id, no prompt or no answer is left out and counted. Registering
      an id again replaces that set where it stands, so a data file loaded
      twice changes nothing. Returns { ok, id, count, dropped }. */
  function registerSet(def) {
    def = isRecord(def) ? def : {};
    var id = text(def.id).replace(/:/g, '-');
    if (!id) return { ok: false, id: '', count: 0, dropped: 0 };
    var questions = [], seen = {}, dropped = 0;
    (Array.isArray(def.questions) ? def.questions : []).forEach(function (raw) {
      var q = normalize(raw), mine = seedId(id, '');
      var local = q.id.indexOf(mine) === 0 ? q.id.slice(mine.length) : q.id;   // registered from its own output
      if (!local || own(seen, '$' + local) || !q.prompt || !q.answer) { dropped++; return; }
      seen['$' + local] = true;
      q.id = seedId(id, local);
      questions.push(JSON.stringify(q));                       // text, so nothing can reach in
    });
    var set = { id: id, title: text(def.title) || id, source: text(def.source), note: text(def.note), questions: questions };
    var at = -1;
    for (var i = 0; i < seedSets.length; i++) if (seedSets[i].id === id) at = i;
    if (at === -1) seedSets.push(set); else seedSets[at] = set;
    return { ok: true, id: id, count: questions.length, dropped: dropped };
  }

  /** Every registered set, in the order they were registered:
      [{ id, title, source, note, count }]. */
  function sets() {
    return seedSets.map(function (s) {
      return { id: s.id, title: s.title, source: s.source, note: s.note, count: s.questions.length };
    });
  }

  /** A set's questions, in the tool's order, as copies; [] for no such set. */
  function setQuestions(setId) {
    for (var i = 0; i < seedSets.length; i++) {
      if (seedSets[i].id === setId) return seedSets[i].questions.map(function (t) { return JSON.parse(t); });
    }
    return [];
  }

  /** The seed question with this id, as a copy, or null. */
  function findSeed(id) {
    var list = setQuestions(seedSetOf(id));
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---- named sets (see NAMED SETS above; pure) ------------------------- */

  /** 'set-' + the time in base 36 + '-' + seven random characters. */
  function makeSetId(now, random) {
    return 'set' + makeId(now, random).slice(1);
  }

  /** `s` as a named set, or null when it cannot be one (not a record, no
      name). Items are kept as texts, in order, repeats and all, to the
      limit; a blank or unsafe item is dropped. Never throws. */
  function normalizeSet(s) {
    if (!isRecord(s)) return null;
    var name = text(s.name).replace(/\s*[\r\n]+\s*/g, ' ').slice(0, SET_LIMIT.name).trim();
    if (!name) return null;
    var items = [];
    (Array.isArray(s.items) ? s.items : []).forEach(function (v) {
      var id = typeof v === 'string' ? v.trim() : '';
      if (id && !UNSAFE[id] && items.length < SET_LIMIT.items) items.push(id);
    });
    var out = { id: text(s.id), name: name, items: items, createdAt: text(s.createdAt) };
    if (text(s.updatedAt)) out.updatedAt = text(s.updatedAt);
    return out;
  }

  /** A list of named sets, each normalized, with no two sharing an id (a
      set with none, or a repeated one, is given a new id). */
  function normalizeSets(list, opts) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (raw) {
      var set = normalizeSet(raw);
      if (!set) return;
      if (!set.id || indexOfId(out, set.id) !== -1) set.id = freshSetId(out, opts);
      out.push(set);
    });
    return out;
  }

  function freshSetId(list, opts) {
    var id, tries = 0;
    do { id = makeSetId(opts && opts.nowMs, opts && opts.random); } while (indexOfId(list, id) !== -1 && ++tries < 50);
    while (indexOfId(list, id) !== -1) id += 'x';
    return id;
  }

  /** `sets` with `set` put in: over the set with its id (its first date
      kept), or at the end with a new id. Returns { sets, set }, or
      { sets, set: null } when `set` has no name. `sets` is not changed. */
  function upsertSet(sets, set, opts) {
    var out = sets.slice(), n = normalizeSet(set);
    if (!n) return { sets: out, set: null };
    var at = n.id ? indexOfId(out, n.id) : -1;
    if (at !== -1) {
      n.createdAt = out[at].createdAt || n.createdAt || stamp(opts);
      n.updatedAt = stamp(opts);
      out[at] = n;
    } else {
      n.id = n.id && n.id.indexOf(NAMED_PREFIX) !== 0 ? n.id : freshSetId(out, opts);
      if (!n.createdAt) n.createdAt = stamp(opts);
      delete n.updatedAt;
      out.push(n);
    }
    return { sets: out, set: n };
  }

  /** `sets` with question `id` taken out of every set, every time it is
      there. A set that changes is stamped; the rest are the same objects. */
  function removeFromSets(sets, id, opts) {
    return sets.map(function (set) {
      if (set.items.indexOf(id) === -1) return set;
      var copy = normalizeSet(set);
      copy.id = set.id;
      copy.items = set.items.filter(function (x) { return x !== id; });
      copy.updatedAt = stamp(opts);
      return copy;
    });
  }

  function sameItems(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /** A file's sets put into `sets` (see NAMED SETS: import adds, never
      overwrites). `ids` is merge()'s map from the file's ids to stored ones;
      `questions` is the bank after that merge. An item is taken through the
      map, kept when it is a seed id or a question `questions` has, and
      dropped otherwise. Returns { sets, added, same, dropped, names }: the
      counts, `dropped` the items left out, `names` the names the added
      sets were stored under. `sets` is not changed. */
  function mergeSets(sets, incoming, ids, questions, opts) {
    var out = (Array.isArray(sets) ? sets : []).slice(), res = { sets: out, added: 0, same: 0, dropped: 0, names: [] };
    ids = isRecord(ids) ? ids : {};
    var have = {};
    (Array.isArray(questions) ? questions : []).forEach(function (q) { if (q && q.id) have['$' + q.id] = true; });
    (Array.isArray(incoming) ? incoming : []).forEach(function (raw) {
      var set = normalizeSet(raw);
      if (!set) return;
      var items = [];
      set.items.forEach(function (id) {
        var to = own(ids, id) ? ids[id] : id;
        if (isSeedId(to) || own(have, '$' + to)) items.push(to); else res.dropped++;
      });
      var twin = out.filter(function (x) {
        return sameItems(x.items, items) && (x.id === set.id || fold(x.name) === fold(set.name));
      })[0];
      if (twin) { res.same++; return; }
      var name = set.name, n = 1;
      function taken(nm) { return out.some(function (x) { return fold(x.name) === fold(nm); }); }
      while (taken(name)) { n++; name = set.name.slice(0, SET_LIMIT.name - 5) + ' (' + n + ')'; }
      // The file's id when this bank has no set with it, so the same file
      // again finds this set by id, whatever name it was given here.
      var keepId = set.id && indexOfId(out, set.id) === -1 ? set.id : '';
      var added = upsertSet(out, { id: keepId, name: name, items: items, createdAt: set.createdAt }, opts).set;
      out.push(added);
      res.added++;
      res.names.push(name);
    });
    return res;
  }

  /** A set's questions from `bank` (the teacher's questions) and the seed
      sets: { questions, missing }, `questions` in the set's order with a
      repeat repeated, each a copy; `missing` counts items found nowhere. */
  function resolveSet(set, bank) {
    var byId = {}, res = { questions: [], missing: 0 };
    (Array.isArray(bank) ? bank : []).forEach(function (q) { byId['$' + q.id] = q; });
    (set && Array.isArray(set.items) ? set.items : []).forEach(function (id) {
      var q = own(byId, '$' + id) ? byId['$' + id] : (isSeedId(id) ? findSeed(id) : null);
      if (q) res.questions.push(JSON.parse(JSON.stringify(q))); else res.missing++;
    });
    return res;
  }

  /* ---- pictures (see PICTURES above) ----------------------------------- */

  var MEDIA_NS = 'rgb';
  var IMAGE_REF_RE = /^idb:[A-Za-z0-9_-]{1,40}$/;              // media-db.js's own test of a reference
  var IMAGE_TYPE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,/;
  var IMAGE_INLINE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/;   // rgb-image.js's own test
  /* The most characters a picture in a file may be: about 3 MB of image.
     030 stores a picture at 1000 px, JPEG at 0.72, which is a few hundred
     thousand; this only stops a file made by hand from filling storage. */
  var IMAGE_MAX = 4000000;

  function isImageRef(v) { return typeof v === 'string' && IMAGE_REF_RE.test(v); }
  function isInlineImage(v) { return typeof v === 'string' && IMAGE_INLINE_RE.test(v); }

  /** Why `v`, a picture value in a FILE, cannot be taken: a phrase that
      finishes "left out: …", or '' when it is a picture a file may carry. */
  function imageProblem(v) {
    if (typeof v !== 'string' || !v) return 'it is not a picture';
    if (isImageRef(v)) return 'it names a picture kept in another browser';
    if (!IMAGE_TYPE_RE.test(v.slice(0, 40))) return 'it is not a PNG, JPEG, GIF or WebP picture';
    if (v.length > IMAGE_MAX) return 'it is larger than ' + Math.round(IMAGE_MAX * 3 / 4 / 1000000) + ' MB';
    if (!IMAGE_INLINE_RE.test(v)) return 'its data is damaged';
    return '';
  }

  /** The question's picture: 'idb:<id>', a data URL of one of the four
      types, or '' for none and for anything else `media` holds. */
  function imageOf(q) {
    var m = isRecord(q) ? q.media : null;
    if (!isRecord(m) || !own(m, 'image')) return '';
    return isImageRef(m.image) || isInlineImage(m.image) ? m.image : '';
  }

  /** A copy of `q` with `value` as its picture, or with no picture when
      `value` is not one. Whatever else `media` holds is kept; a `media` left
      with nothing in it is taken off. */
  function withImage(q, value) {
    var out = {}, k, m = {};
    for (k in q) if (own(q, k) && !UNSAFE[k]) out[k] = q[k];
    var keep = isImageRef(value) || isInlineImage(value);
    if (!isRecord(out.media)) {
      if (keep) out.media = { image: value };
      return out;
    }
    for (k in out.media) if (own(out.media, k) && !UNSAFE[k] && k !== 'image') m[k] = out.media[k];
    if (keep) m.image = value;
    if (Object.keys(m).length) out.media = m; else delete out.media;
    return out;
  }

  /** A file's questions with every picture a file may not carry taken off
      (see PICTURES). `rows[i]` is the file's row for questions[i], as
      parse() gives it. Returns { questions, images, left }: the questions in
      the same order (a changed one is a copy, WITHOUT its `media`, so a
      question the bank already has keeps its own); `images`, each data URL
      that stays, once; `left`, [{ row, why }]. Pure. */
  function cleanMedia(questions, rows) {
    var res = { questions: [], images: [], left: [] }, seen = {};
    (Array.isArray(questions) ? questions : []).forEach(function (q, i) {
      if (!isRecord(q) || !isRecord(q.media) || !own(q.media, 'image')) { res.questions.push(q); return; }
      var why = imageProblem(q.media.image);
      if (!why) {
        if (!own(seen, q.media.image)) { seen[q.media.image] = true; res.images.push(q.media.image); }
        res.questions.push(q);
        return;
      }
      var copy = {}, k;
      for (k in q) if (own(q, k) && !UNSAFE[k] && k !== 'media') copy[k] = q[k];
      res.questions.push(copy);
      res.left.push({ row: (Array.isArray(rows) && rows[i]) || i + 1, why: why });
    });
    return res;
  }

  /** `questions` with each picture `map` names (data URL to reference)
      replaced; copies where one changed. */
  function applyImages(questions, map) {
    return questions.map(function (q) {
      var v = imageOf(q);
      return v && own(map, v) ? withImage(q, map[v]) : q;
    });
  }

  /** What cleanMedia() left out, as a sentence, or '' for nothing. */
  function leftSentence(left) {
    left = Array.isArray(left) ? left : [];
    if (!left.length) return '';
    var said = left.slice(0, 8).map(function (x) { return 'row ' + x.row + ' (' + x.why + ')'; });
    return (left.length === 1 ? 'A picture was' : left.length + ' pictures were') + ' left out, and the question' +
      (left.length === 1 ? ' is' : 's are') + ' here without ' + (left.length === 1 ? 'it' : 'them') + ': ' + said.join('; ') +
      (left.length > 8 ? '; and ' + (left.length - 8) + ' more' : '') + '.';
  }

  /* ---- links ----------------------------------------------------------- */

  var LINK_VERSION = 1;
  /* The most a link may bring: questions, and characters or items a field. */
  var LINK = { questions: 500, prompt: 2000, answer: 2000, unit: 120, standard: 120, tag: 60, tags: 12, choice: 500, choices: 12, name: 200 };

  function clipText(v, n) { return text(v).slice(0, n).trim(); }
  function clipList(list, each, most) {
    var out = [], seen = {};
    list.forEach(function (s) {
      s = s.slice(0, each).trim();
      var k = '$' + s.toLowerCase();
      if (!s || own(seen, k) || out.length >= most) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  /** True when `payload` is shaped like what a link carries (see LINKS). */
  function isLink(payload) {
    return isRecord(payload) && Array.isArray(payload.questions);
  }

  /** The questions a link carries, made safe to show and to store (see LINKS
      above). Returns { ok, name, from, questions, dropped, over }: `dropped`
      counts rows with no prompt or no answer, `over` the questions past
      LINK.questions, which are not read. Pure: nothing is stored. */
  function fromLink(payload) {
    var res = { ok: false, name: '', from: '', questions: [], dropped: 0, over: 0 };
    if (!isLink(payload)) return res;
    res.ok = true;
    res.name = clipText(payload.name, LINK.name);
    var from = typeof payload.from === 'string' ? payload.from.trim() : '';
    res.from = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(from) && from.length <= 80 ? from : '';
    var rows = payload.questions;
    res.over = Math.max(0, rows.length - LINK.questions);
    for (var i = 0; i < rows.length && i < LINK.questions; i++) {
      var raw = isRecord(rows[i]) ? rows[i] : {};
      var q = {
        prompt: clipText(own(raw, 'prompt') ? raw.prompt : raw.question, LINK.prompt),
        answer: clipText(raw.answer, LINK.answer)
      };
      if (!q.prompt || !q.answer) { res.dropped++; continue; }
      var choices = clipList(choiceList(raw.choices), LINK.choice, LINK.choices);
      if (choices.length) q.choices = choices;
      q.unit = clipText(raw.unit, LINK.unit);
      q.standard = clipText(raw.standard, LINK.standard);
      q.difficulty = difficulty(raw.difficulty);
      q.tags = clipList(textList(raw.tags, /[,;]/), LINK.tag, LINK.tags);
      q.points = Math.max(-1000000, Math.min(1000000, Math.round(points(raw.points))));
      if (res.from) q.sharedFrom = res.from;
      res.questions.push(q);
    }
    return res;
  }

  /* ---- files ----------------------------------------------------------- */

  /** The bank as one JSON file: every question, every field, and the named
      sets in `meta.sets` when there is one. */
  function toJSON(list, meta) {
    meta = meta || {};
    var file = {
      format: FORMAT, version: VERSION,
      title: text(meta.title), exported: meta.exported || new Date().toISOString(),
      questions: list.map(normalize)
    };
    var named = normalizeSets(meta.sets);
    if (named.length) file.sets = named;
    return JSON.stringify(file, null, 2);
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
      rows, error }, as fromRows() does, and `sets`, the file's named sets
      ([] for none, and for a CSV). */
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
      return { questions: list.filter(isRecord), rows: list.filter(isRecord).map(function (q, i) { return i + 1; }), error: '',
        sets: isRecord(data) ? normalizeSets(data.sets) : [] };
    }
    var rows = fromRows(parseCsv(s));
    rows.sets = [];
    return rows;
  }

  /* ---- storage --------------------------------------------------------- */

  /* The callers below spell the Store call out in full, with the key's
     constant, and not through a local: that is what check:registry's
     call-site scan reads to know which keys this file touches. */
  function needStore() {
    if (!global.Store) throw new Error('QuestionBank: _shared/store.js must be loaded first');
  }

  /** What is on disk, as { schema, questions, legacy, sets }, with nothing
      adopted and nothing written. `schema` is VERSION for any bank this file
      can write (1, or 2 with sets), and the stored number for a newer one. */
  function read() {
    needStore();
    var data = global.Store.get(KEY, { version: VERSION, default: null, migrate: function (v, d) { return d; } });
    var bank = { schema: VERSION, questions: [], legacy: {}, sets: [] };
    if (!isRecord(data)) return bank;
    if (typeof data.schema === 'number' && data.schema > SCHEMA) bank.schema = data.schema;
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
    bank.sets = normalizeSets(data.sets);
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

  /** Stores `bank`. With no named set it is the v265 shape exactly; with
      one, `sets` is added and `schema` is 2 (see NAMED SETS). */
  function write(bank) {
    if (bank.schema > VERSION) return { ok: false, newer: true, quota: false, blocked: false };
    needStore();
    var sets = Array.isArray(bank.sets) ? bank.sets : [];
    var data = { schema: sets.length ? SCHEMA : VERSION, questions: bank.questions, legacy: bank.legacy };
    if (sets.length) data.sets = sets;
    return global.Store.set(KEY, data, { version: VERSION });
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

  /** The questions load() would give, with NOTHING written: 030's old
      entries the bank has not taken yet are among them, in memory only. For
      a page that reads the bank and is not its editor. */
  function peek() {
    var bank = read();
    if (bank.schema === VERSION) adopt(bank, readLegacy());
    return bank.questions;
  }

  /** The questions of `source`: the teacher's bank for '' (or nothing), a
      seed set's for its id. `opts.peek` reads the bank without writing. */
  function questionsOf(source, opts) {
    if (isNamedSource(source)) return namedSetQuestions(source.slice(NAMED_PREFIX.length), opts).questions;
    if (source) return setQuestions(source);
    return opts && opts.peek ? peek() : list();
  }

  function isNamedSource(source) { return typeof source === 'string' && source.indexOf(NAMED_PREFIX) === 0; }

  /** What a page can list questions from: the teacher's bank first, then
      every seed set. [{ id, title, source, note, count, readOnly }], `id`
      being '' for the bank. `opts.peek` counts the bank without writing.
      `opts.named` puts the teacher's named sets after the bank, each with
      `named: true` and the id 'named:<set id>'. */
  function sources(opts) {
    var named = opts && opts.named ? namedSets(opts).map(function (s) {
      return { id: NAMED_PREFIX + s.id, title: s.name, source: '', note: '', count: s.items.length, readOnly: false, named: true };
    }) : [];
    return [{ id: '', title: 'My question bank', source: '', note: '', count: questionsOf('', opts).length, readOnly: false }]
      .concat(named)
      .concat(sets().map(function (s) {
        return { id: s.id, title: s.title, source: s.source, note: s.note, count: s.count, readOnly: true };
      }));
  }

  /** One of sources() as a chooser's option says it:
      'My question bank (3 questions)',
      'Cultural Trivia (built in, 30 questions, read-only)'. */
  function sourceLabel(src) {
    src = isRecord(src) ? src : {};
    var n = Number(src.count) || 0, count = n + ' question' + (n === 1 ? '' : 's');
    if (src.named) return text(src.title) + ' (named set, ' + count + ')';
    return text(src.title) + (src.readOnly ? ' (built in, ' + count + ', read-only)' : ' (' + count + ')');
  }

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

  /** Deletes a question, and takes its id out of every named set. */
  function deleteQuestion(id) {
    var bank = load();
    bank.questions = remove(bank.questions, id);
    bank.sets = removeFromSets(bank.sets, id);
    return write(bank);
  }

  /** Merges questions into the stored bank (see merge), and `opts.sets`, a
      file's named sets, after them (see mergeSets). Returns merge()'s counts,
      `sets` as { added, same, dropped, names }, and `ok` from the write;
      nothing is written when nothing changed. */
  function importQuestions(incoming, opts) {
    var bank = load(), res = merge(bank.questions, incoming, opts);
    res.ok = true;
    res.sets = { added: 0, same: 0, dropped: 0, names: [] };
    if (opts && Array.isArray(opts.sets) && opts.sets.length) {
      var s = mergeSets(bank.sets, opts.sets, res.ids, res.questions, opts);
      res.sets = { added: s.added, same: s.same, dropped: s.dropped, names: s.names };
      bank.sets = s.sets;
    }
    if (res.added || res.updated || res.sets.added) {
      bank.questions = res.questions;
      var w = write(bank);
      res.ok = w.ok; res.newer = !!w.newer; res.quota = !!w.quota; res.blocked = !!w.blocked;
    }
    return res;
  }

  /** Copies seed questions into the teacher's stored bank, by seed id.
      Returns importQuestions()'s counts and `missing`, the ids that name no
      seed. Each copy is a new question with an id of its own. */
  function copyFromSet(ids, opts) {
    var found = [], missing = [];
    (Array.isArray(ids) ? ids : [ids]).forEach(function (id) {
      var q = findSeed(id);
      if (q) found.push(q); else missing.push(id);
    });
    var res = importQuestions(found, opts);
    res.missing = missing;
    return res;
  }

  /** The teacher's named sets, in their order, as copies. `opts.peek`
      reads without writing. */
  function namedSets(opts) {
    var bank = opts && opts.peek ? read() : load();
    return JSON.parse(JSON.stringify(bank.sets));
  }

  /** One named set by id (a copy), or null. */
  function findNamedSet(id, opts) {
    var list = namedSets(opts);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** A named set's questions: { questions, missing } (see resolveSet), and
      { questions: [], missing: 0 } for no such set. */
  function namedSetQuestions(id, opts) {
    var bank = opts && opts.peek ? read() : load(), set = null;
    for (var i = 0; i < bank.sets.length; i++) if (bank.sets[i].id === id) set = bank.sets[i];
    if (!set) return { questions: [], missing: 0 };
    if (opts && opts.peek && bank.schema === VERSION) adopt(bank, readLegacy());
    return resolveSet(set, bank.questions);
  }

  /** Makes a named set ({ name, items }) or replaces one by id: renaming,
      reordering, adding and removing are all this. Returns { ok, set } and
      Store's own flags; a set with no name is refused ({ ok: false,
      noName: true }) and nothing is written. */
  function saveSet(set, opts) {
    var bank = load(), done = upsertSet(bank.sets, set, opts);
    if (!done.set) return { ok: false, noName: true, set: null };
    bank.sets = done.sets;
    var res = write(bank);
    res.set = done.set;
    return res;
  }

  /** Deletes a named set. Its questions stay in the bank. */
  function deleteSet(id) {
    var bank = load();
    bank.sets = bank.sets.filter(function (s) { return s.id !== id; });
    return write(bank);
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
    SEED_PREFIX: SEED_PREFIX,
    isSeedId: isSeedId,
    seedId: seedId,
    seedSetOf: seedSetOf,
    detach: detach,
    registerSet: registerSet,
    sets: sets,
    setQuestions: setQuestions,
    findSeed: findSeed,
    copyFromSet: copyFromSet,
    SCHEMA: SCHEMA,
    NAMED_PREFIX: NAMED_PREFIX,
    SET_LIMIT: SET_LIMIT,
    makeSetId: makeSetId,
    normalizeSet: normalizeSet,
    normalizeSets: normalizeSets,
    upsertSet: upsertSet,
    removeFromSets: removeFromSets,
    mergeSets: mergeSets,
    resolveSet: resolveSet,
    isNamedSource: isNamedSource,
    namedSets: namedSets,
    findNamedSet: findNamedSet,
    namedSetQuestions: namedSetQuestions,
    saveSet: saveSet,
    deleteSet: deleteSet,
    LINK_VERSION: LINK_VERSION,
    LINK: LINK,
    isLink: isLink,
    fromLink: fromLink,
    MEDIA_NS: MEDIA_NS,
    IMAGE_MAX: IMAGE_MAX,
    isImageRef: isImageRef,
    isInlineImage: isInlineImage,
    imageProblem: imageProblem,
    imageOf: imageOf,
    withImage: withImage,
    cleanMedia: cleanMedia,
    applyImages: applyImages,
    leftSentence: leftSentence,
    toJSON: toJSON,
    toRows: toRows,
    fromRows: fromRows,
    parseCsv: parseCsv,
    parse: parse,
    read: read,
    load: load,
    list: list,
    peek: peek,
    questionsOf: questionsOf,
    sources: sources,
    sourceLabel: sourceLabel,
    saveQuestion: saveQuestion,
    deleteQuestion: deleteQuestion,
    importQuestions: importQuestions,
    onChange: onChange
  };
})(window);
