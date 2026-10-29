/* word-list.js — the site's one store of vocabulary word lists (Path 19 P1):
   named lists of words that 040 owns through its Word Lists card and that 039,
   014, 027, 051 and 052 adopt in P2. Publishes window.WordList. The pure half
   (normalize, the text and table readers, the file formats, merge) needs
   nothing; storage needs _shared/store.js; CSV output needs ExportKit; a pasted
   table needs PasteTable. BACKLOG.md's Path 19 P1 bullet has the design.

   A WORD
     { id, term, definition, partOfSpeech, example, pronunciation, gender, tags }
   Every text is trimmed; `tags` is a list of texts with no blanks and no repeats;
   `gender` is free text ('m', 'f', 'el', 'der' ...). A field this file does not
   know is kept through every read, write and file, so a later phase's field (the
   conjugation record, a recorded pronunciation) survives an older page's save.

   A VERB (Path 19 P3, step 2)
   A word may carry `verb`, the teacher's conjugation record for it in the shape
   _shared/conjugate.js takes (infinitive, class, stemChange, stems, forms, participle,
   gerund, auxiliary, reflexive, defective, gloss): only what the teacher added or
   corrected, merged over the pack's own record by Conjugate.merge(). It lives on the
   word, so it applies to ITS LIST ONLY (Devon, 2026-10-21), travels with the list's JSON
   file and is taken by a 040 save that keeps the word. A list may carry `lang` ('es',
   'fr': the pack the verbs are conjugated in). cleanVerb() checks the record's SHAPE
   (strings, six slots, a size cap); it does not know a language and never calls the
   engine. No CSV column carries it.

   WHAT IS STORED
     key 'gvb-word-lists', a Store envelope { v: 1, data: {
       schema: 1,
       lists:  [ { id, name, words: [word], createdAt, updatedAt } ],
       current: <a list name or ''>,
       legacy: [ <040 set names already taken over> ] } }

   THE MIGRATION, exactly
   Until the hub, 040 kept its lists in its own keys: 'gvb-vocab-flashcards:list'
   (an array of names) and 'gvb-vocab-flashcards:data:<name>' (a blob whose
   `words` is the textarea's text). Those keys are READ here and never written,
   removed or renamed: an older 040 tab and a 009 backup made before the hub
   still hold them. importLegacy() turns each set whose name is not in `legacy`
   into a list, reading its text by the rules 040 has always used (fromText is
   held to VocabLayout.parseWordList by its suite), and records the name, so a list
   the teacher deletes does not come back and a second call adds nothing. A set
   whose name a list already has is merged into it by term (never over it).

   THE FILES
     JSON  { app: 'word-lists', v: 1, lists: [ { name, words } ] }
     CSV   term, definition, example, pronunciation, partOfSpeech, gender, tags
           (040's own column order, then two new ones; tags joined with ';'); the
           header row is optional on the way in, and without one the columns are in
           that order, so a five-column paste made for 040 reads the same here.
   A file is read into a plan (importPlan) before anything is stored.

   039'S WORD PAIRS (Path 19 P2)
   039 Vocab & Conjugation Drill keeps a set's vocabulary as `vocabText`, lines of
   "word: translation" (a line with no colon is a word with no translation).
   fromPairs / toPairs are that format; putPairs(name, text) writes it through to the
   hub changing ONLY term and definition, so a list 040 gave an example, a gender or
   tags keeps them; importLegacyDrill() takes 039's own keys ('gvb-vocab-conj:list',
   'gvb-vocab-conj:data:<name>', read, never written) over once per set name, recorded
   in `legacyDrill`, and skips a set that has no vocabulary (a conjugation-only set).  */
(function (root) {
  'use strict';

  var KEY = 'gvb-word-lists';
  var SCHEMA = 1;
  var LEGACY_LIST = 'gvb-vocab-flashcards:list';
  var LEGACY_DATA = 'gvb-vocab-flashcards:data:';
  var TEXT_FIELDS = ['term', 'definition', 'partOfSpeech', 'example', 'pronunciation', 'gender'];
  var COLUMNS = ['term', 'definition', 'example', 'pronunciation', 'partOfSpeech', 'gender', 'tags'];
  var ALIASES = {
    term: ['term', 'word', 'vocab', 'vocabulary'],
    definition: ['definition', 'meaning', 'translation', 'def'],
    partOfSpeech: ['partofspeech', 'pos', 'type'],
    example: ['example', 'sentence', 'examplesentence'],
    pronunciation: ['pronunciation', 'pron', 'ipa'],
    gender: ['gender', 'article'],
    tags: ['tags', 'tag', 'labels']
  };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function cleanTags(t) {
    var list = Array.isArray(t) ? t : (typeof t === 'string' ? t.split(/[;,]/) : []);
    var seen = {}, out = [];
    list.forEach(function (x) {
      var s = str(x);
      if (s && !seen[s.toLowerCase()]) { seen[s.toLowerCase()] = 1; out.push(s); }
    });
    return out;
  }

  /* One word, whatever came in. null when there is no term. Unknown fields stay. */
  function normalizeWord(w) {
    if (!w || typeof w !== 'object') return null;
    var out = {}, k;
    for (k in w) if (Object.prototype.hasOwnProperty.call(w, k)) out[k] = w[k];
    TEXT_FIELDS.forEach(function (f) { out[f] = str(w[f]); });
    out.tags = cleanTags(w.tags);
    out.id = typeof w.id === 'string' && w.id ? w.id : '';
    if (Object.prototype.hasOwnProperty.call(w, 'verb')) {
      var verb = cleanVerb(w.verb);
      if (verb) out.verb = verb; else delete out.verb;
    }
    return out.term ? out : null;
  }

  /* ---- a verb record: its shape only --------------------------------------- */

  var VERB_TEXT = ['infinitive', 'class', 'stemChange', 'participle', 'gerund', 'auxiliary', 'gloss'];
  var VERB_MAX = 4000;
  var KEY_OK = /^[a-z0-9][a-z0-9-]{0,29}$/;

  function cleanForm(v) { return typeof v === 'string' ? v.trim().slice(0, 80) : ''; }

  function cleanStem(v) {
    if (typeof v === 'string') return cleanForm(v) || null;
    if (Array.isArray(v)) { var a = [cleanForm(v[0]), cleanForm(v[1])]; return a[0] && a[1] ? a : null; }
    if (v && typeof v === 'object' && typeof v.cut === 'string') return { cut: cleanForm(v.cut), add: cleanForm(v.add) };
    return null;
  }

  /* A teacher's verb record, whatever came in: known keys checked, unknown keys kept if JSON can hold them.
     null when nothing is left, so an empty record is no record. */
  function cleanVerb(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    var out = {}, k;
    for (k in v) if (Object.prototype.hasOwnProperty.call(v, k) && k !== 'teacher') {
      if (VERB_TEXT.indexOf(k) >= 0 || k === 'forms' || k === 'stems' || k === 'defective' || k === 'prefixes' || k === 'reflexive' || k === 'spelling') continue;
      try { out[k] = JSON.parse(JSON.stringify(v[k])); } catch (e) { /* not JSON: dropped */ }
    }
    VERB_TEXT.forEach(function (f) { var t = cleanForm(v[f]); if (t) out[f] = t; });
    if (v.reflexive === true) out.reflexive = true;
    if (v.spelling === false) out.spelling = false;
    if (Array.isArray(v.prefixes)) { var pre = v.prefixes.map(cleanForm).filter(Boolean); if (pre.length) out.prefixes = pre; }
    if (v.forms && typeof v.forms === 'object' && !Array.isArray(v.forms)) {
      var forms = {};
      Object.keys(v.forms).forEach(function (t) {
        if (!KEY_OK.test(t) || !v.forms[t] || typeof v.forms[t] !== 'object' || Array.isArray(v.forms[t])) return;
        var cells = {};
        Object.keys(v.forms[t]).forEach(function (slot) { var f = cleanForm(v.forms[t][slot]); if (/^[0-5]$/.test(slot) && f) cells[slot] = f; });
        if (Object.keys(cells).length) forms[t] = cells;
      });
      if (Object.keys(forms).length) out.forms = forms;
    }
    if (v.stems && typeof v.stems === 'object' && !Array.isArray(v.stems)) {
      var stems = {};
      Object.keys(v.stems).forEach(function (t) { var st = KEY_OK.test(t) ? cleanStem(v.stems[t]) : null; if (st) stems[t] = st; });
      if (Object.keys(stems).length) out.stems = stems;
    }
    if (v.defective && typeof v.defective === 'object') {
      var d = {};
      if (Array.isArray(v.defective.slots)) d.slots = v.defective.slots.filter(function (n) { return typeof n === 'number' && n >= 0 && n <= 5 && n % 1 === 0; });
      if (Array.isArray(v.defective.tenses)) d.tenses = v.defective.tenses.filter(function (t) { return typeof t === 'string' && KEY_OK.test(t); });
      if ((d.slots && d.slots.length) || (d.tenses && d.tenses.length)) out.defective = d;
    }
    if (!Object.keys(out).length) return null;
    if (JSON.stringify(out).length > VERB_MAX) return null;
    return out;
  }

  function nextNumber(items, prefix) {
    var max = 0;
    items.forEach(function (x) {
      var m = typeof x.id === 'string' && x.id.indexOf(prefix) === 0 ? parseInt(x.id.slice(prefix.length), 10) : 0;
      if (m > max) max = m;
    });
    return max + 1;
  }

  /* Gives every word without an id the next free one in its list; ids are kept, never reused. */
  function assignIds(words) {
    var n = nextNumber(words, 'w');
    words.forEach(function (w) { if (!w.id) w.id = 'w' + (n++); });
    return words;
  }

  function cleanWords(words) {
    var out = [];
    (Array.isArray(words) ? words : []).forEach(function (w) { var n = normalizeWord(w); if (n) out.push(n); });
    var seen = {};
    out.forEach(function (w) { if (w.id) { if (seen[w.id]) w.id = ''; else seen[w.id] = 1; } });
    return assignIds(out);
  }

  /* ---- 040's text format -------------------------------------------------- */

  function splitCsvLine(line) {
    var fields = [], cur = '', inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else cur += ch;
    }
    fields.push(cur);
    return fields;
  }

  /* The textarea's lines -> words (no ids). The rules are VocabLayout.parseWordList's, kept
     word for word: a tab line, else "term: definition | example | pronunciation | part of
     speech", else a comma line; a line with none of the three, or no term, is dropped. */
  function fromText(text) {
    return String(text || '').replace(/\r\n/g, '\n').split('\n').map(function (line) {
      if (!line.trim()) return null;
      var term, definition, example = '', pronunciation = '', partOfSpeech = '', parts;
      if (line.indexOf('\t') !== -1) {
        parts = line.split('\t');
        term = (parts[0] || '').trim(); definition = (parts[1] || '').trim();
        example = (parts[2] || '').trim(); pronunciation = (parts[3] || '').trim(); partOfSpeech = (parts[4] || '').trim();
      } else if (line.indexOf(':') !== -1) {
        var idx = line.indexOf(':');
        term = line.slice(0, idx).trim();
        parts = line.slice(idx + 1).split('|');
        definition = (parts[0] || '').trim(); example = (parts[1] || '').trim();
        pronunciation = (parts[2] || '').trim(); partOfSpeech = (parts[3] || '').trim();
      } else if (line.indexOf(',') !== -1) {
        parts = splitCsvLine(line);
        term = (parts[0] || '').trim(); definition = (parts[1] || '').trim();
        example = (parts[2] || '').trim(); pronunciation = (parts[3] || '').trim(); partOfSpeech = (parts[4] || '').trim();
      } else return null;
      if (!term) return null;
      return { term: term, definition: definition, example: example, pronunciation: pronunciation, partOfSpeech: partOfSpeech };
    }).filter(Boolean);
  }

  /* 039's vocabText -> words (term, definition only). A line with no colon is a word alone. */
  function fromPairs(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var idx = trimmed.indexOf(':');
      if (idx === -1) { out.push({ term: trimmed, definition: '' }); return; }
      var term = trimmed.slice(0, idx).trim();
      if (term) out.push({ term: term, definition: trimmed.slice(idx + 1).trim() });
    });
    return out;
  }

  /* Words -> 039's vocabText: "term: definition", or the bare term when there is no definition.
     A term holding a colon cannot be written in that format (039 would read it as term and
     definition) and is left out. */
  function toPairs(words) {
    return (words || []).map(function (w) {
      var t = str(w.term).replace(/[\r\n]+/g, ' '), d = str(w.definition).replace(/[\r\n]+/g, ' ');
      if (!t) return null;
      return t.indexOf(':') !== -1 ? null : (d ? t + ': ' + d : t);
    }).filter(function (l) { return l !== null; }).join('\n');
  }

  /* Words -> the textarea's text, in the form fromText reads back to the same five fields. */
  function toText(words) {
    function flat(s) { return str(s).replace(/[\t\r\n]+/g, ' '); }
    return (words || []).map(function (w) {
      var t = flat(w.term), d = flat(w.definition), e = flat(w.example), p = flat(w.pronunciation), pos = flat(w.partOfSpeech);
      if (!t) return null;
      if (t.indexOf(':') !== -1 || d.indexOf('|') !== -1 || e.indexOf('|') !== -1 || p.indexOf('|') !== -1) {
        return [t, d, e, p, pos].join('\t').replace(/\t+$/, '');
      }
      var rest = [d, e, p, pos];
      while (rest.length > 1 && !rest[rest.length - 1]) rest.pop();
      return t + ': ' + rest.join(' | ');
    }).filter(function (l) { return l !== null; }).join('\n');
  }

  /* Edited text -> the list's words, keeping what the text cannot hold. Each parsed word takes
     the id and the extra fields (gender, tags, anything unknown) of the first unused word that
     has the same term; the five text fields are the text's. */
  function reconcile(existing, parsed, fields) {
    fields = fields || ['term', 'definition', 'example', 'pronunciation', 'partOfSpeech'];
    var used = {}, pool = (existing || []);
    var out = parsed.map(function (p) {
      var hit = -1;
      for (var i = 0; i < pool.length; i++) if (!used[i] && pool[i].term === p.term) { hit = i; break; }
      var base = {};
      if (hit >= 0) { used[hit] = 1; for (var k in pool[hit]) if (Object.prototype.hasOwnProperty.call(pool[hit], k)) base[k] = pool[hit][k]; }
      fields.forEach(function (f) { base[f] = p[f]; });
      return normalizeWord(base);
    });
    var n = nextNumber(out.concat(pool), 'w');
    out.forEach(function (w) { if (!w.id) w.id = 'w' + (n++); });
    return out;
  }

  /* Adds incoming words to a list by term: a term the list has keeps its record (an empty field
     is filled from the incoming word, a filled one is never changed), a new term is appended. */
  function mergeWords(existing, incoming) {
    var out = cleanWords(existing), added = 0, filled = 0;
    var byTerm = {};
    out.forEach(function (w) { byTerm[w.term.toLowerCase()] = w; });
    cleanWords(incoming).forEach(function (w) {
      var hit = byTerm[w.term.toLowerCase()];
      if (hit) {
        var changed = false;
        TEXT_FIELDS.forEach(function (f) { if (!hit[f] && w[f]) { hit[f] = w[f]; changed = true; } });
        if (!hit.tags.length && w.tags.length) { hit.tags = w.tags.slice(); changed = true; }
        if (!hit.verb && w.verb) { hit.verb = JSON.parse(JSON.stringify(w.verb)); changed = true; }
        if (changed) filled++;
      } else {
        var copy = {}; for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) copy[k] = w[k];
        copy.id = '';
        out.push(copy); byTerm[w.term.toLowerCase()] = copy; added++;
      }
    });
    assignIds(out);
    return { words: out, added: added, filled: filled };
  }

  /* ---- a pasted table, CSV ------------------------------------------------ */

  function unguard(s) { return /^'[=+\-@]/.test(s) ? s.slice(1) : s; }

  function headerMap(cells) {
    var map = {}, hits = 0;
    cells.forEach(function (c, i) {
      var key = String(c || '').toLowerCase().replace(/[^a-z]/g, '');
      for (var f in ALIASES) if (ALIASES[f].indexOf(key) !== -1 && map[f] === undefined) { map[f] = i; hits++; break; }
    });
    return map.term !== undefined && hits >= 2 ? map : null;
  }

  /* A pasted spreadsheet region or a CSV file -> { words, headerSkipped, unreadable, ragged }.
     With a header row (term plus at least one more known column name) the columns are named by
     it; without, they are the COLUMNS order (040's). The delimiter is picked from the first line. A line with other cells but no term is reported with
     its line number, not dropped. Needs PasteTable. */
  function parseTable(text) {
    var PT = root.PasteTable;
    if (!PT) throw new Error('WordList.parseTable needs _shared/paste-table.js');
    var t = PT.parse(text, { header: false, firstLine: true });
    var rows = t.rows, lineNos = t.lines.slice(), map = null, headerSkipped = false;
    if (rows.length) {
      map = headerMap(rows[0]);
      if (map) { rows = rows.slice(1); lineNos = lineNos.slice(1); headerSkipped = true; }
    }
    if (!map) { map = {}; COLUMNS.forEach(function (c, i) { map[c] = i; }); }
    var words = [], unreadable = [];
    rows.forEach(function (r, i) {
      var w = {};
      COLUMNS.forEach(function (c) { w[c] = map[c] === undefined ? '' : unguard(str(r[map[c]])); });
      if (!w.term) {
        if (r.some(function (c) { return str(c); })) unreadable.push({ line: lineNos[i], text: r.join(t.delimiter === '\t' ? '\t' : ',') });
        return;
      }
      w.tags = cleanTags(w.tags);
      words.push(w);
    });
    return { words: cleanWords(words), headerSkipped: headerSkipped, unreadable: unreadable, ragged: t.ragged };
  }

  function csvRows(words) {
    return (words || []).map(function (w) {
      return { term: w.term, definition: w.definition, partOfSpeech: w.partOfSpeech, example: w.example,
        pronunciation: w.pronunciation, gender: w.gender, tags: (w.tags || []).join(';') };
    });
  }

  function csvOptions() { return { columns: COLUMNS.map(function (c) { return { key: c, label: c }; }) }; }

  /* CSV text for a list's words (ExportKit.toCsv, so a typed cell a spreadsheet would run as a
     formula gets its apostrophe, which parseTable takes off again). */
  function toCsv(words) {
    if (!root.ExportKit) throw new Error('WordList.toCsv needs _shared/export.js');
    return root.ExportKit.toCsv(csvRows(words), csvOptions());
  }

  /* The template-download file: the header and two made-up example rows. */
  function templateCsv() {
    return toCsv([
      { term: 'la biblioteca', definition: 'the library', partOfSpeech: 'noun', example: 'Voy a la biblioteca.', pronunciation: 'bee-blee-oh-TEH-kah', gender: 'f', tags: ['unit 3'] },
      { term: 'estudiar', definition: 'to study', partOfSpeech: 'verb', example: 'Estudio por la noche.', pronunciation: 'es-too-DYAR', gender: '', tags: ['unit 3'] }
    ]);
  }

  /* ---- JSON file ---------------------------------------------------------- */

  /* A list's language: a pack id such as 'es' or 'fr', else ''. */
  function cleanLang(v) { return typeof v === 'string' && /^[a-z]{2,3}$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : ''; }

  function toJSON(lists) {
    return JSON.stringify({
      app: 'word-lists', v: 1,
      lists: (lists || []).map(function (l) {
        var o = { name: str(l.name), words: cleanWords(l.words) }, lang = cleanLang(l.lang);
        if (lang) o.lang = lang;
        return o;
      })
    }, null, 2);
  }

  /* A JSON file's text -> { lists: [{ name, words }], problems: [words] }; never throws. */
  function fromJSON(text) {
    var data, problems = [];
    try { data = JSON.parse(String(text)); } catch (e) { return { lists: [], problems: ['This is not a JSON file.'] }; }
    if (!data || data.app !== 'word-lists' || !Array.isArray(data.lists)) {
      return { lists: [], problems: ['This is not a word-lists file.'] };
    }
    if (typeof data.v === 'number' && data.v > 1) problems.push('This file is from a newer version of the site; what it holds that this page does not know is kept.');
    var out = [];
    data.lists.forEach(function (l, i) {
      var name = l && str(l.name);
      if (!name) { problems.push('List ' + (i + 1) + ' has no name and was skipped.'); return; }
      var item = { name: name, words: cleanWords(l.words) }, lang = cleanLang(l.lang);
      if (lang) item.lang = lang;
      out.push(item);
    });
    return { lists: out, problems: problems };
  }

  /* ---- the state and storage ---------------------------------------------- */

  function emptyState() { return { schema: SCHEMA, lists: [], current: '', legacy: [], legacyDrill: [] }; }

  function cleanState(d) {
    var s = emptyState();
    if (!d || typeof d !== 'object') return s;
    var seenName = {}, listIds = [];
    (Array.isArray(d.lists) ? d.lists : []).forEach(function (l) {
      var name = l && str(l.name);
      if (!name || seenName[name]) return;
      seenName[name] = 1;
      var copy = {}; for (var k in l) if (Object.prototype.hasOwnProperty.call(l, k)) copy[k] = l[k];
      copy.name = name; copy.words = cleanWords(l.words);
      if (cleanLang(l.lang)) copy.lang = cleanLang(l.lang); else delete copy.lang;
      copy.id = typeof l.id === 'string' && l.id ? l.id : '';
      copy.createdAt = typeof l.createdAt === 'number' ? l.createdAt : 0;
      copy.updatedAt = typeof l.updatedAt === 'number' ? l.updatedAt : copy.createdAt;
      s.lists.push(copy); listIds.push(copy);
    });
    var n = nextNumber(listIds, 'l'), seen = {};
    s.lists.forEach(function (l) { if (!l.id || seen[l.id]) l.id = 'l' + (n++); seen[l.id] = 1; });
    s.current = str(d.current);
    if (s.current && !seenName[s.current]) s.current = '';
    function names(x) { return Array.isArray(x) ? x.filter(function (n) { return typeof n === 'string' && n; }) : []; }
    s.legacy = names(d.legacy);
    s.legacyDrill = names(d.legacyDrill);
    return s;
  }

  function needStore() {
    if (!root.Store) throw new Error('WordList storage needs _shared/store.js');
  }

  function load() {
    needStore();
    return cleanState(root.Store.get(KEY, { default: null, version: 1, migrate: function (_v, d) { return d; } }));
  }

  function save(state) { needStore(); return root.Store.set(KEY, cleanState(state)); }

  function findList(state, name) {
    for (var i = 0; i < state.lists.length; i++) if (state.lists[i].name === name) return state.lists[i];
    return null;
  }

  function names() { return load().lists.map(function (l) { return l.name; }); }
  function get(name) { var l = findList(load(), name); return l ? JSON.parse(JSON.stringify(l)) : null; }

  function findWord(list, key) {
    if (!list) return null;
    var k = str(key), lower = k.toLowerCase();
    for (var i = 0; i < list.words.length; i++) if (list.words[i].id === k) return list.words[i];
    for (var j = 0; j < list.words.length; j++) if (list.words[j].term.toLowerCase() === lower) return list.words[j];
    return null;
  }

  /* The teacher's verb record on a word of the list (by id, else by term), or null. */
  function getVerb(listName, key) {
    var w = findWord(findList(load(), str(listName)), key);
    return w && w.verb ? JSON.parse(JSON.stringify(w.verb)) : null;
  }

  /* Stores (or, with null or an empty record, removes) the verb record on one word. Returns the stored
     record, null when it was removed, and undefined when there is no such list or word. */
  function setVerb(listName, key, verb, now) {
    var s = load(), l = findList(s, str(listName)), w = findWord(l, key);
    if (!w) return undefined;
    var clean = cleanVerb(verb);
    if (clean) w.verb = clean; else delete w.verb;
    l.updatedAt = typeof now === 'number' ? now : Date.now();
    save(s);
    return clean ? JSON.parse(JSON.stringify(clean)) : null;
  }

  function getLang(listName) { var l = findList(load(), str(listName)); return l && l.lang ? l.lang : ''; }

  /* Sets the list's language; '' clears it. false when there is no such list or the language is not a pack id. */
  function setLang(listName, lang, now) {
    var s = load(), l = findList(s, str(listName));
    if (!l) return false;
    var c = cleanLang(lang);
    if (str(lang) && !c) return false;
    if (c) l.lang = c; else delete l.lang;
    l.updatedAt = typeof now === 'number' ? now : Date.now();
    save(s);
    return true;
  }

  /* Replaces (or makes) the list `name`. words are normalized; `now` is a clock for tests. */
  function put(name, words, now) {
    name = str(name);
    if (!name) return null;
    var s = load(), l = findList(s, name), t = typeof now === 'number' ? now : Date.now();
    if (!l) {
      l = { id: 'l' + nextNumber(s.lists, 'l'), name: name, words: [], createdAt: t, updatedAt: t };
      s.lists.push(l);
    }
    l.words = cleanWords(words);
    l.updatedAt = t;
    save(s);
    return JSON.parse(JSON.stringify(l));
  }

  /* 040's write-through: the edited text becomes the list `name`, keeping each word's id, gender, tags. */
  function putText(name, text, now) {
    var l = get(name);
    return put(name, reconcile(l ? l.words : [], fromText(text)), now);
  }

  /* 039's write-through: the vocabulary text becomes the list `name`'s terms and definitions in
     order; a word's other fields, id and tags stay with its term. Writes nothing for a blank text
     when there is no such list yet. */
  function putPairs(name, text, now) {
    var l = get(name), pairs = fromPairs(text);
    if (!l && !pairs.length) return null;
    return put(name, reconcile(l ? l.words : [], pairs, ['term', 'definition']), now);
  }

  function remove(name) {
    var s = load(), n = s.lists.length;
    s.lists = s.lists.filter(function (l) { return l.name !== name; });
    if (s.current === name) s.current = '';
    if (s.lists.length !== n) save(s);
    return s.lists.length !== n;
  }

  function rename(oldName, newName) {
    newName = str(newName);
    var s = load(), l = findList(s, oldName);
    if (!l || !newName || (newName !== oldName && findList(s, newName))) return false;
    l.name = newName;
    if (s.current === oldName) s.current = newName;
    save(s);
    return true;
  }

  function setCurrent(name) { var s = load(); s.current = name && findList(s, name) ? name : ''; save(s); }

  /* 040's own keys -> lists, once per set name. `ls` is a storage object (window.localStorage). */
  function importLegacy(ls, now) {
    ls = ls || (root.localStorage);
    var list;
    try { list = JSON.parse(ls.getItem(LEGACY_LIST) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    var s = load(), moved = 0, merged = 0, t = typeof now === 'number' ? now : Date.now();
    list.forEach(function (name) {
      if (typeof name !== 'string' || !name || s.legacy.indexOf(name) !== -1) return;
      var blob = null;
      try { blob = JSON.parse(ls.getItem(LEGACY_DATA + name) || 'null'); } catch (e) { blob = null; }
      if (!blob || typeof blob !== 'object') return;
      var words = fromText(typeof blob.words === 'string' ? blob.words : '');
      var have = findList(s, name);
      if (have) { have.words = mergeWords(have.words, words).words; have.updatedAt = t; merged++; }
      else {
        s.lists.push({ id: 'l' + nextNumber(s.lists, 'l'), name: name, words: cleanWords(words), createdAt: t, updatedAt: t });
        moved++;
      }
      s.legacy.push(name);
    });
    if (moved || merged) save(s);
    else if (s.legacy.length !== load().legacy.length) save(s);
    return { moved: moved, merged: merged };
  }

  /* 039's own keys -> lists, once per set name; a set with no vocabulary is skipped. */
  function importLegacyDrill(ls, now) {
    ls = ls || root.localStorage;
    var list;
    try { list = JSON.parse(ls.getItem('gvb-vocab-conj:list') || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    var s = load(), moved = 0, merged = 0, t = typeof now === 'number' ? now : Date.now(), touched = false;
    list.forEach(function (name) {
      if (typeof name !== 'string' || !name || s.legacyDrill.indexOf(name) !== -1) return;
      var blob = null;
      try { blob = JSON.parse(ls.getItem('gvb-vocab-conj:data:' + name) || 'null'); } catch (e) { blob = null; }
      if (!blob || typeof blob !== 'object') return;
      s.legacyDrill.push(name); touched = true;
      var pairs = fromPairs(typeof blob.vocabText === 'string' ? blob.vocabText : '');
      if (!pairs.length) return;
      var have = findList(s, name);
      if (have) { have.words = mergeWords(have.words, pairs).words; have.updatedAt = t; merged++; }
      else { s.lists.push({ id: 'l' + nextNumber(s.lists, 'l'), name: name, words: cleanWords(pairs), createdAt: t, updatedAt: t }); moved++; }
    });
    if (touched) save(s);
    return { moved: moved, merged: merged };
  }

  /* What storing a file's lists would do, shown before anything is stored: per list, new or
     merged, and how many words each way. Writes nothing. */
  function importPlan(incoming) {
    var s = load();
    return (incoming || []).map(function (l) {
      var have = findList(s, l.name);
      if (!have) return { name: l.name, kind: 'new', add: cleanWords(l.words).length, fill: 0 };
      var m = mergeWords(have.words, l.words);
      return { name: l.name, kind: 'merge', add: m.added, fill: m.filled };
    });
  }

  /* Stores a file's lists as importPlan described them. */
  function applyImport(incoming, now) {
    var s = load(), t = typeof now === 'number' ? now : Date.now();
    (incoming || []).forEach(function (l) {
      var have = findList(s, l.name);
      if (have) {
        have.words = mergeWords(have.words, l.words).words; have.updatedAt = t;
        if (!have.lang && cleanLang(l.lang)) have.lang = cleanLang(l.lang);
      } else {
        var fresh = { id: 'l' + nextNumber(s.lists, 'l'), name: l.name, words: cleanWords(l.words), createdAt: t, updatedAt: t };
        if (cleanLang(l.lang)) fresh.lang = cleanLang(l.lang);
        s.lists.push(fresh);
      }
    });
    save(s);
    return (incoming || []).length;
  }

  root.WordList = {
    KEY: KEY, SCHEMA: SCHEMA, COLUMNS: COLUMNS.slice(),
    normalizeWord: normalizeWord, cleanWords: cleanWords,
    fromText: fromText, toText: toText, fromPairs: fromPairs, toPairs: toPairs, reconcile: reconcile, mergeWords: mergeWords,
    parseTable: parseTable, toCsv: toCsv, templateCsv: templateCsv,
    toJSON: toJSON, fromJSON: fromJSON,
    cleanVerb: cleanVerb, cleanLang: cleanLang, getVerb: getVerb, setVerb: setVerb, getLang: getLang, setLang: setLang,
    load: load, save: save, names: names, get: get, put: put, putText: putText,
    remove: remove, rename: rename, setCurrent: setCurrent,
    putPairs: putPairs, importLegacy: importLegacy, importLegacyDrill: importLegacyDrill, importPlan: importPlan, applyImport: applyImport
  };
})(typeof window !== 'undefined' ? window : globalThis);
