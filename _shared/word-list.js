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
   A file is read into a plan (importPlan) before anything is stored.            */
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
    return out.term ? out : null;
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
  function reconcile(existing, parsed) {
    var used = {}, pool = (existing || []);
    var out = parsed.map(function (p) {
      var hit = -1;
      for (var i = 0; i < pool.length; i++) if (!used[i] && pool[i].term === p.term) { hit = i; break; }
      var base = {};
      if (hit >= 0) { used[hit] = 1; for (var k in pool[hit]) if (Object.prototype.hasOwnProperty.call(pool[hit], k)) base[k] = pool[hit][k]; }
      ['term', 'definition', 'example', 'pronunciation', 'partOfSpeech'].forEach(function (f) { base[f] = p[f]; });
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

  function toJSON(lists) {
    return JSON.stringify({
      app: 'word-lists', v: 1,
      lists: (lists || []).map(function (l) { return { name: str(l.name), words: cleanWords(l.words) }; })
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
      out.push({ name: name, words: cleanWords(l.words) });
    });
    return { lists: out, problems: problems };
  }

  /* ---- the state and storage ---------------------------------------------- */

  function emptyState() { return { schema: SCHEMA, lists: [], current: '', legacy: [] }; }

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
      copy.id = typeof l.id === 'string' && l.id ? l.id : '';
      copy.createdAt = typeof l.createdAt === 'number' ? l.createdAt : 0;
      copy.updatedAt = typeof l.updatedAt === 'number' ? l.updatedAt : copy.createdAt;
      s.lists.push(copy); listIds.push(copy);
    });
    var n = nextNumber(listIds, 'l'), seen = {};
    s.lists.forEach(function (l) { if (!l.id || seen[l.id]) l.id = 'l' + (n++); seen[l.id] = 1; });
    s.current = str(d.current);
    if (s.current && !seenName[s.current]) s.current = '';
    s.legacy = Array.isArray(d.legacy) ? d.legacy.filter(function (x) { return typeof x === 'string' && x; }) : [];
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
      if (have) { have.words = mergeWords(have.words, l.words).words; have.updatedAt = t; }
      else s.lists.push({ id: 'l' + nextNumber(s.lists, 'l'), name: l.name, words: cleanWords(l.words), createdAt: t, updatedAt: t });
    });
    save(s);
    return (incoming || []).length;
  }

  root.WordList = {
    KEY: KEY, SCHEMA: SCHEMA, COLUMNS: COLUMNS.slice(),
    normalizeWord: normalizeWord, cleanWords: cleanWords,
    fromText: fromText, toText: toText, reconcile: reconcile, mergeWords: mergeWords,
    parseTable: parseTable, toCsv: toCsv, templateCsv: templateCsv,
    toJSON: toJSON, fromJSON: fromJSON,
    load: load, save: save, names: names, get: get, put: put, putText: putText,
    remove: remove, rename: rename, setCurrent: setCurrent,
    importLegacy: importLegacy, importPlan: importPlan, applyImport: applyImport
  };
})(typeof window !== 'undefined' ? window : globalThis);
