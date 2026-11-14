/* sda-core.js — the rules behind 091 Student Data Anonymizer. Publishes
   window.SdaCore (or module.exports under Node). Pure: nothing here reads
   storage, the clock (callers pass `today`), the network or the DOM. The page
   reads files into the shape below, calls these, and writes files from what
   comes back.

   A DOCUMENT is one file read into sheets:
     { name, layout: { id, label }, sheets: [ SHEET ] }
     SHEET = { name, rows: [ [ CELL|null ] ], headerRow, cols: [ COL ] }
     CELL  = { t: 's'|'n'|'b'|'d', v, z? }   — SheetJS's own cell, minus any formula
     COL   = { index, header, role }
   headerRow is the 0-based row holding the column headings; rows above it
   (a report title, class averages) are kept as they are. Every row below it
   is a student row if it has anything in an identity column.

   ROLES. Each column has one:
     id       a student ID (the first is the key's ID; any others are "other IDs")
     name     the whole name, "Last, First Middle"
     last, first, middle, nick   the name in pieces
     attr     a detail about the student (grade level, birth date, a program
              flag, contact details). Dropped unless the teacher ticks it.
     data     what is being analyzed (scores, absences). Always kept.
     context  teacher, course, period, school. Always kept: the teacher's name
              is not student information (Devon, 2026-11-13).
   id/name/last/first/middle/nick are IDENTITY and are always replaced by one
   "Student Code" column, at the place of the first of them.

   CODES are XX-XX from 32 characters: A-Z and 2-9 without I, O, 0 and 1, the
   four a reader confuses (Devon, 2026-11-13). 32^4 = 1,048,576 codes. `rng`
   is a function returning [0, 1); the page passes one built on
   crypto.getRandomValues, a test passes a seeded one.

   THE KEY is a list of entries:
     { code, id, ids: [], last, first, written, spellings: [], source, added }
   Matching a student to it (match()):
     1. an ID the entry holds (id or ids)               -> that entry
     2. the same last name and first name (middle names, suffixes, accents,
        hyphens, punctuation and case ignored), when exactly one entry fits;
        among several, the one whose whole given name also matches
     3. a name that fits an entry holding a DIFFERENT ID, or several entries
        that cannot be told apart, is a CONFLICT: never guessed, the page asks.
   No spelling is "close enough": Brittany and Britney are two students.

   Nothing in this file keeps a student between calls. */
(function (root) {
  'use strict';

  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var CODE_RE = /^[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{2}$/;
  var IDENTITY = { id: 1, name: 1, last: 1, first: 1, middle: 1, nick: 1 };
  var ROLES = ['id', 'name', 'last', 'first', 'middle', 'nick', 'attr', 'data', 'context'];
  var ROLE_LABELS = {
    id: 'Student ID', name: 'Student name', last: 'Last name', first: 'First name',
    middle: 'Middle name', nick: 'Preferred name', attr: 'Student detail (removed unless kept)',
    data: 'Data (kept)', context: 'Teacher, course or school (kept)'
  };
  var CODE_HEADER = 'Student Code';
  var SUFFIXES = { jr: 1, sr: 1, ii: 1, iii: 1, iv: 1, v: 1 };

  // ---- codes ---------------------------------------------------------------

  function newCode(rng, taken) {
    for (var tries = 0; tries < 1000; tries++) {
      var s = '';
      for (var i = 0; i < 4; i++) {
        if (i === 2) s += '-';
        s += ALPHABET.charAt(Math.floor(rng() * ALPHABET.length) % ALPHABET.length);
      }
      if (!taken[s]) { taken[s] = true; return s; }
    }
    throw new Error('Could not find an unused code after 1000 tries.');
  }
  function isCode(s) { return CODE_RE.test(String(s == null ? '' : s).trim()); }

  // ---- names ---------------------------------------------------------------

  function fold(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[-‐-―]/g, ' ').replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function words(s) {
    return fold(s).split(' ').filter(function (w) { return w && !SUFFIXES[w]; });
  }
  /** "Last, First Middle" (or "First Last") into folded pieces. A suffix
      (Jr, III) anywhere is dropped, including "Brogden, Kevin Kareem, III". */
  function parseName(raw) {
    var s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    var last, given;
    if (s.indexOf(',') >= 0) {
      var parts = s.split(',');
      last = words(parts[0]);
      given = words(parts.slice(1).join(' '));
      if (!last.length && given.length) { last = [given.pop()]; }
    } else {
      var w = words(s);
      last = w.length > 1 ? [w.pop()] : w.splice(0);
      given = w;
    }
    return { last: last.join(' '), first: given[0] || '', given: given.join(' '), written: s };
  }
  function nameFromParts(last, first, middle) {
    var l = String(last == null ? '' : last).trim(), f = [first, middle].map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean).join(' ');
    if (!l && !f) return '';
    return l + (f ? ', ' + f : '');
  }
  function nameKey(p) { return p.last + '|' + p.first; }
  function cleanId(v) {
    var s = String(v == null ? '' : v).trim();
    return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, '') : s;
  }

  // ---- roles -----------------------------------------------------------------

  function norm(h) { return String(h == null ? '' : h).replace(/[_\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
  var ID_RES = [/^(student )?(id|number|no\.?|#|num)$/, /\bstudent ?(id|number|no\.?|#|num)\b/, /\bstu ?(id|no|num)\b/,
    /\b(local|state|district|perm(anent)?)( student)? (id|number|no)\b/, /^(lasid|sasid|ssid|stateid|localid|studentid)$/];
  var NAME_RES = [/\bstudent ?name\b/, /^name$/, /^full ?name$/, /^(student )?name \(?last, ?first\)?$/, /^last, ?first( name)?$/];
  var ATTR_RES = [/^(grade|gr|grd|grade level|grade lvl|gradelevel|grade lev)$/, /\b(dob|birth ?date|date of birth|birthday|age)\b/,
    /\b(gender|sex)\b/, /\b(race|ethnic|ethnicity|hispanic)\b/, /\b(ell|esol|lep|el status|english learner|ml status|multilingual)\b/,
    /\b(sped|iep|504|special ed(ucation)?|disabilit(y|ies)|gifted|gt status)\b/, /\b(frl|farms|frm|lunch|meals?|econ(omically)?)\b/,
    /\b(address|street|city|zip|postal)\b/, /\b(phone|e-?mail)\b/, /\b(parent|guardian|mother|father|emergency contact)\b/,
    /\b(homeroom|advisory|counselor|locker|bus)\b/];
  var CONTEXT_RES = [/\bteacher\b/, /\binstructor\b/, /^(course|course name|course title|class|section|period|subject|school|school name|building|sched building|marking period|term|semester|room)$/];

  function guessRole(header) {
    var h = norm(header);
    if (!h) return 'data';
    if (/^(last|surname|family)( name)?$|^(student )?last ?name$/.test(h)) return 'last';
    if (/^(student )?first ?name$|^(first|given)( name)?$/.test(h)) return 'first';
    if (/^(student )?middle( name| initial)?$|^mi$/.test(h)) return 'middle';
    if (/^(preferred|nick|nickname|preferred first)( name)?$/.test(h)) return 'nick';
    var i;
    for (i = 0; i < CONTEXT_RES.length; i++) if (CONTEXT_RES[i].test(h)) return 'context';
    for (i = 0; i < ID_RES.length; i++) if (ID_RES[i].test(h)) return 'id';
    for (i = 0; i < NAME_RES.length; i++) if (NAME_RES[i].test(h)) return 'name';
    for (i = 0; i < ATTR_RES.length; i++) if (ATTR_RES[i].test(h)) return 'attr';
    return 'data';
  }
  function text(cell) {
    if (cell == null) return '';
    if (typeof cell !== 'object') return String(cell);
    return cell.v == null ? '' : String(cell.v);
  }
  /** The heading row: the first of the first 25 rows with a cell that reads as
      a student ID or name heading. -1 when there is none. */
  function findHeaderRow(rows) {
    for (var r = 0; r < Math.min(rows.length, 25); r++) {
      var row = rows[r] || [];
      for (var c = 0; c < row.length; c++) {
        var g = guessRole(text(row[c]));
        if (g === 'id' || g === 'name' || g === 'last') return r;
      }
    }
    return -1;
  }
  /** Turns raw rows into a SHEET: finds the heading row and guesses a role for
      every column. A sheet with no heading row has headerRow -1 and no roles;
      it is passed through and the page says so. */
  function makeSheet(name, rows) {
    var hr = findHeaderRow(rows), width = 0;
    rows.forEach(function (r) { width = Math.max(width, (r || []).length); });
    var cols = [];
    for (var c = 0; c < width; c++) {
      var header = hr >= 0 ? text((rows[hr] || [])[c]) : '';
      cols.push({ index: c, header: header, role: hr >= 0 ? guessRole(header) : 'data' });
    }
    return { name: name, rows: rows, headerRow: hr, cols: cols };
  }
  /** Moves a sheet's heading row (0-based) and guesses the roles again. */
  function setHeaderRow(sheet, r) {
    var again = makeSheet(sheet.name, sheet.rows);
    if (r >= 0 && r < sheet.rows.length) {
      again.headerRow = r;
      again.cols.forEach(function (c) { c.header = text((sheet.rows[r] || [])[c.index]); c.role = guessRole(c.header); });
    }
    sheet.headerRow = again.headerRow;
    sheet.cols = again.cols;
    return sheet;
  }
  function identityCols(sheet) { return sheet.cols.filter(function (c) { return IDENTITY[c.role]; }); }

  // ---- reading students out of a document ----------------------------------

  /** One record per student row: { sheet, row, ids: [], name: parsed name }.
      A row with nothing in any identity column is not a student row. */
  function studentRows(doc) {
    var out = [];
    doc.sheets.forEach(function (sheet, si) {
      if (sheet.headerRow < 0) return;
      var idc = identityCols(sheet);
      if (!idc.length) return;
      for (var r = sheet.headerRow + 1; r < sheet.rows.length; r++) {
        var row = sheet.rows[r] || [], ids = [], whole = '', parts = {};
        idc.forEach(function (c) {
          var v = text(row[c.index]).trim();
          if (!v) return;
          if (c.role === 'id') ids.push(cleanId(v));
          else if (c.role === 'name') whole = whole || v;
          else parts[c.role] = parts[c.role] || v;
        });
        if (!ids.length && !whole && !parts.last && !parts.first) continue;
        var written = whole || nameFromParts(parts.last, parts.first, parts.middle);
        out.push({ sheet: si, row: r, ids: ids, name: parseName(written) });
      }
    });
    return out;
  }

  /** The students in one or more documents read together, one per person.
      Rows that share an ID are one person. A row with no ID joins:
        - the one person whose whole name (last and every given name) it
          shares, wherever that person was seen; or else
        - the one person with the same last and first name who was seen only
          on OTHER sheets: "Aguilar, Alison" on the BBCard is "Aguilar, Alison
          Sofia" from the attendance file. Two rows of one sheet never join on
          last and first name alone, since a sheet lists a student once (a
          PDF's rows share the whole name, and join by the rule above).
      An ID row is read before any name-only row, so a name has an ID to find. */
  function people(docs) {
    var list = [], byId = {}, byFull = {}, byShort = {};
    function fullKey(n) { return n.last + '|' + n.given; }
    function push(map, k, p) { (map[k] = map[k] || []); if (map[k].indexOf(p) < 0) map[k].push(p); }
    function add(rec, file) {
      var p = null, i;
      for (i = 0; i < rec.ids.length && !p; i++) p = byId[rec.ids[i]] || null;
      if (!p && !rec.ids.length && rec.name.last) {
        var full = byFull[fullKey(rec.name)] || [];
        if (full.length === 1) p = full[0];
        else if (!full.length) {
          var here = rec.doc + ':' + rec.sheet;
          var short = (byShort[nameKey(rec.name)] || []).filter(function (q) { return !q.sheets[here]; });
          if (short.length === 1) p = short[0];
        }
      }
      if (!p) {
        p = { ids: [], names: [], rows: [], files: {}, sheets: {} };
        list.push(p);
      }
      rec.ids.forEach(function (id) { if (p.ids.indexOf(id) < 0) { p.ids.push(id); byId[id] = p; } });
      if (rec.name.written && !p.names.some(function (n) { return n.written === rec.name.written; })) p.names.push(rec.name);
      if (rec.name.last) { push(byFull, fullKey(rec.name), p); push(byShort, nameKey(rec.name), p); }
      p.files[file] = true;
      p.sheets[rec.doc + ':' + rec.sheet] = true;
      p.rows.push(rec);
      rec.person = p;
    }
    var all = [];
    docs.forEach(function (doc, di) {
      studentRows(doc).forEach(function (r) { r.doc = di; r.file = doc.name; all.push(r); });
    });
    all.filter(function (r) { return r.ids.length; }).forEach(function (r) { add(r, r.file); });
    all.filter(function (r) { return !r.ids.length; }).forEach(function (r) { add(r, r.file); });
    return list;
  }

  // ---- the key ---------------------------------------------------------------

  var KEY_COLUMNS = ['Code', 'Student ID', 'Last name', 'First name', 'Name as written', 'Other spellings', 'Other IDs', 'First seen in', 'Added'];

  function entryNames(e) {
    var all = [e.written].concat(e.spellings || []).filter(Boolean);
    var parsed = all.map(parseName);
    if (e.last || e.first) parsed.push({ last: fold(e.last), first: words(e.first)[0] || '', given: words(e.first).join(' '), written: '' });
    return parsed;
  }
  function indexKey(entries) {
    var byId = {}, byName = {}, taken = {};
    entries.forEach(function (e) {
      taken[e.code] = true;
      [e.id].concat(e.ids || []).forEach(function (id) { if (id) byId[cleanId(id)] = e; });
      var seen = {};
      entryNames(e).forEach(function (n) {
        var k = nameKey(n);
        if (!n.last || seen[k]) return;
        seen[k] = true;
        (byName[k] = byName[k] || []).push(e);
      });
    });
    return { byId: byId, byName: byName, taken: taken };
  }
  /** Where a person stands against the key: { kind: 'id'|'name'|'new'|'conflict',
      entry?, candidates?, reason? }. */
  function match(person, idx) {
    var i;
    for (i = 0; i < person.ids.length; i++) if (idx.byId[person.ids[i]]) return { kind: 'id', entry: idx.byId[person.ids[i]] };
    var cands = [], seen = [];
    person.names.forEach(function (n) {
      (idx.byName[nameKey(n)] || []).forEach(function (e) { if (seen.indexOf(e) < 0) { seen.push(e); cands.push(e); } });
    });
    if (!cands.length) return { kind: 'new' };
    if (cands.length > 1) {
      var exact = cands.filter(function (e) {
        return entryNames(e).some(function (en) { return person.names.some(function (n) { return n.given && en.given === n.given && en.last === n.last; }); });
      });
      if (exact.length === 1) cands = exact;
    }
    if (cands.length > 1) return { kind: 'conflict', candidates: cands, reason: 'several' };
    var e = cands[0];
    var eIds = [e.id].concat(e.ids || []).filter(Boolean).map(cleanId);
    if (person.ids.length && eIds.length) return { kind: 'conflict', candidates: [e], reason: 'other-id' };
    return { kind: 'name', entry: e };
  }

  /** Gives every person a code. `key` is the entries of a key the teacher
      loaded ([] for none); `decisions` maps a person's index to the code the
      teacher chose for a conflict, or 'new'. Returns
        { assigned: [{ person, code, how }], entries, conflicts: [{ index, person, candidates, reason }] }
      `entries` is the key to save: every loaded entry, with spellings and IDs
      this file taught it, plus one entry per new student. opts.sessionCodes,
      an object the page keeps while it is open, gives a new student the same
      code each time this runs again (a ticked box re-runs everything); it is
      never stored. A conflict with no
      decision gets a new code (a split student is fixable from the key; a
      merged one is not). */
  function assign(list, key, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, decisions = opts.decisions || {};
    var entries = (key || []).map(function (e) {
      return { code: e.code, id: e.id || '', ids: (e.ids || []).slice(), last: e.last || '', first: e.first || '', written: e.written || '',
        spellings: (e.spellings || []).slice(), source: e.source || '', added: e.added || '' };
    });
    var byCode = {};
    entries.forEach(function (e) { byCode[e.code] = e; });
    var idx = indexKey(entries), assigned = [], conflicts = [], fresh = [];
    list.forEach(function (p, i) {
      var m = match(p, idx), e = null, how = m.kind;
      if (m.kind === 'id' || m.kind === 'name') e = byCode[m.entry.code];
      else if (m.kind === 'conflict') {
        conflicts.push({ index: i, person: p, candidates: m.candidates, reason: m.reason });
        var d = decisions[i];
        if (d && d !== 'new' && byCode[d]) { e = byCode[d]; how = 'chosen'; } else how = 'new';
      }
      if (!e) {
        var first = p.names[0] || { last: '', first: '', written: '' };
        var w = first.written, comma = w.indexOf(',');
        var fp = fingerprint(p), keepCode = opts.sessionCodes && opts.sessionCodes[fp];
        var code = keepCode && !idx.taken[keepCode] ? keepCode : newCode(rng, idx.taken);
        idx.taken[code] = true;
        if (opts.sessionCodes) opts.sessionCodes[fp] = code;
        e = { code: code, id: p.ids[0] || '', ids: [], last: comma >= 0 ? w.slice(0, comma).trim() : (first.last || ''),
          first: comma >= 0 ? w.slice(comma + 1).trim() : (first.given || ''), written: w, spellings: [], source: Object.keys(p.files).join('; '),
          added: opts.today || '' };
        entries.push(e);
        fresh.push(e);
        byCode[e.code] = e;
        if (how !== 'new') how = 'new';
      }
      learn(e, p);
      assigned.push({ person: p, code: e.code, how: how });
      p.code = e.code;
    });
    // A student new to the key is named by the fullest spelling seen
    // ("Brogden, Kevin Kareem III" over the BBCard's "Brogden, Kevin").
    fresh.forEach(function (e) {
      var all = [e.written].concat(e.spellings), best = e.written;
      all.forEach(function (w) { if (parseName(w).given.split(' ').length > parseName(best).given.split(' ').length) best = w; });
      if (best === e.written) return;
      e.spellings = all.filter(function (w) { return w !== best; });
      e.written = best;
      var comma = best.indexOf(',');
      if (comma >= 0) { e.last = best.slice(0, comma).trim(); e.first = best.slice(comma + 1).trim(); }
    });
    return { assigned: assigned, entries: entries, conflicts: conflicts };
  }
  /** Who a person is, for remembering their new code while the page is open:
      their IDs, or with none their whole folded name. */
  function fingerprint(p) {
    if (p.ids.length) return 'id:' + p.ids.slice().sort().join(',');
    var n = p.names[0] || { last: '', given: '' };
    return 'nm:' + n.last + '|' + n.given;
  }
  function learn(e, p) {
    p.ids.forEach(function (id) {
      if (!e.id) e.id = id;
      else if (cleanId(e.id) !== id && e.ids.indexOf(id) < 0) e.ids.push(id);
    });
    p.names.forEach(function (n) {
      if (!n.written) return;
      if (!e.written) { e.written = n.written; return; }
      if (n.written !== e.written && e.spellings.indexOf(n.written) < 0) e.spellings.push(n.written);
    });
  }

  function keyRows(entries) {
    var sorted = entries.slice().sort(function (a, b) {
      return fold(a.last).localeCompare(fold(b.last)) || fold(a.first).localeCompare(fold(b.first)) || a.code.localeCompare(b.code);
    });
    return [KEY_COLUMNS.slice()].concat(sorted.map(function (e) {
      return [e.code, e.id, e.last, e.first, e.written, e.spellings.join('; '), e.ids.join('; '), e.source, e.added];
    }));
  }
  /** Reads a key back from rows (the first sheet with a "Code" heading).
      Throws, in words a teacher can act on, when it is not a key. */
  function readKey(sheets) {
    for (var s = 0; s < sheets.length; s++) {
      var rows = sheets[s].rows || sheets[s];
      for (var r = 0; r < Math.min(rows.length, 10); r++) {
        var hdr = (rows[r] || []).map(function (c) { return norm(text(c)); });
        var ci = hdr.indexOf('code');
        if (ci < 0) continue;
        var col = function (name) { return hdr.indexOf(name); };
        var cId = col('student id'), cLast = col('last name'), cFirst = col('first name'), cW = col('name as written'),
          cSp = col('other spellings'), cOid = col('other ids'), cSrc = col('first seen in'), cAdd = col('added');
        var entries = [], seen = {}, bad = [];
        for (var i = r + 1; i < rows.length; i++) {
          var row = rows[i] || [];
          var get = function (c) { return c >= 0 ? text(row[c]).trim() : ''; };
          var code = get(ci).toUpperCase();
          if (!code && !get(cId) && !get(cW)) continue;
          if (!isCode(code)) { bad.push('row ' + (i + 1) + ' has "' + get(ci) + '", which is not a code'); continue; }
          if (seen[code]) { bad.push('the code ' + code + ' is in the key twice'); continue; }
          seen[code] = true;
          var split = function (v) { return v ? v.split(';').map(function (x) { return x.trim(); }).filter(Boolean) : []; };
          entries.push({ code: code, id: cleanId(get(cId)), ids: split(get(cOid)).map(cleanId), last: get(cLast), first: get(cFirst),
            written: get(cW) || nameFromParts(get(cLast), get(cFirst)), spellings: split(get(cSp)), source: get(cSrc), added: get(cAdd) });
        }
        if (bad.length) throw new Error('This key has problems: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' and ' + (bad.length - 5) + ' more' : '') + '.');
        if (!entries.length) throw new Error('This key has a Code column but no students in it.');
        return entries;
      }
    }
    throw new Error('This file is not a key: no sheet has a "Code" column. Choose the key file this page saved.');
  }

  // ---- anonymize -------------------------------------------------------------

  function codeCell(code) { return { t: 's', v: code }; }
  /** The anonymized copy of document number `docIndex` of the documents
      people() read into `list`. Every person must already have `code`
      (assign() sets it). `keep` maps "sheetIndex:colIndex" to
      true for each student-detail column the teacher ticked. Student rows are
      sorted by code; rows above the heading stay on top, and rows below it
      that are not student rows stay after the students in their own order. */
  function anonymize(doc, docIndex, list, keep) {
    keep = keep || {};
    var recByRow = {};
    list.forEach(function (p) {
      p.rows.forEach(function (r) { if (r.doc === docIndex) recByRow[r.sheet + ':' + r.row] = r; });
    });
    return {
      name: doc.name,
      layout: doc.layout,
      sheets: doc.sheets.map(function (sheet, si) {
        if (sheet.headerRow < 0 || !identityCols(sheet).length) return { name: sheet.name, rows: sheet.rows.map(function (r) { return (r || []).slice(); }), headerRow: sheet.headerRow, passed: true };
        var firstIdent = -1, plan = [];
        sheet.cols.forEach(function (c) {
          if (IDENTITY[c.role]) { if (firstIdent < 0) { firstIdent = c.index; plan.push({ code: true }); } return; }
          if (c.role === 'attr' && !keep[si + ':' + c.index]) return;
          plan.push({ from: c.index });
        });
        var head = [], students = [], tail = [];
        sheet.rows.forEach(function (row, r) {
          row = row || [];
          var rec = recByRow[si + ':' + r];
          var out = plan.map(function (p) {
            if (p.code) {
              if (r === sheet.headerRow) return { t: 's', v: CODE_HEADER };
              if (rec) return codeCell(rec.person.code);
              return null;
            }
            var c = row[p.from];
            return c == null ? null : c;
          });
          while (out.length && out[out.length - 1] == null) out.pop();
          if (r <= sheet.headerRow) head.push(out);
          else if (rec) students.push({ code: rec.person.code, order: r, row: out });
          else tail.push(out);
        });
        students.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : a.order - b.order; });
        return { name: sheet.name, rows: head.concat(students.map(function (s) { return s.row; }), tail), headerRow: sheet.headerRow };
      })
    };
  }

  /** Every cell, sheet name or the file name in an anonymized document that
      still holds a student's ID or name. A name counts as "Last, First",
      "First Last" or the name exactly as written; an ID counts when it is a
      whole cell or a run of 5+ digits inside one. Returns [{ where, what }]. */
  function leaks(out, list) {
    var found = [], ids = {}, names = [];
    list.forEach(function (p) {
      p.ids.forEach(function (id) { if (id) ids[id] = true; });
      p.names.forEach(function (n) {
        if (!n.last || !n.first) return;
        names.push(n.last + ' ' + n.first, n.first + ' ' + n.last);
        if (n.given !== n.first) names.push(n.last + ' ' + n.given, n.given + ' ' + n.last);
      });
    });
    function look(where, s) {
      if (!s) return;
      var str = String(s), f = ' ' + fold(str) + ' ';
      if (ids[str.trim()]) { found.push({ where: where, what: 'a student ID' }); return; }
      var m = str.match(/\d{5,}/g);
      if (m && m.some(function (d) { return ids[d]; })) { found.push({ where: where, what: 'a student ID' }); return; }
      for (var i = 0; i < names.length; i++) if (f.indexOf(' ' + names[i] + ' ') >= 0) { found.push({ where: where, what: 'a student name' }); return; }
    }
    look('the file name', out.name);
    out.sheets.forEach(function (sh) {
      look('the sheet name "' + sh.name + '"', sh.name);
      sh.rows.forEach(function (row, r) {
        (row || []).forEach(function (c, ci) { if (c && c.t === 's') look('sheet "' + sh.name + '", cell ' + colName(ci) + (r + 1), c.v); });
      });
    });
    return found;
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  // ---- reverse ---------------------------------------------------------------

  /** Finds the code column of a sheet: a "Student Code" (or "Code") heading,
      or else the column whose cells below the heading row are mostly codes.
      { headerRow, col } or null. */
  function findCodeColumn(rows) {
    for (var r = 0; r < Math.min(rows.length, 25); r++) {
      var row = rows[r] || [];
      for (var c = 0; c < row.length; c++) {
        var h = norm(text(row[c]));
        if (h === 'student code' || h === 'code') return { headerRow: r, col: c };
      }
    }
    var width = 0;
    rows.forEach(function (rw) { width = Math.max(width, (rw || []).length); });
    for (var col = 0; col < width; col++) {
      var n = 0, codes = 0, firstCode = -1;
      for (var i = 0; i < rows.length; i++) {
        var v = text((rows[i] || [])[col]).trim();
        if (!v) continue;
        n++;
        if (isCode(v)) { codes++; if (firstCode < 0) firstCode = i; }
      }
      if (codes >= 3 && codes / n >= 0.8) return { headerRow: firstCode - 1, col: col };
    }
    return null;
  }
  /** Puts names back. Each sheet with a code column gets "Student ID" and
      "Student Name" in front of it; the code stays. Returns
      { doc, restored, unknown: [codes], sheetsWithout: [names] }. */
  function reverse(doc, entries) {
    var byCode = {};
    entries.forEach(function (e) { byCode[e.code] = e; });
    var restored = 0, unknown = [], without = [];
    var sheets = doc.sheets.map(function (sheet) {
      var found = findCodeColumn(sheet.rows);
      if (!found) { without.push(sheet.name); return { name: sheet.name, rows: sheet.rows }; }
      var rows = sheet.rows.map(function (row, r) {
        row = (row || []).slice();
        while (row.length < found.col) row.push(null);
        var ins = [null, null];
        if (r === found.headerRow) ins = [{ t: 's', v: 'Student ID' }, { t: 's', v: 'Student Name' }];
        else if (r > found.headerRow) {
          var code = text(row[found.col]).trim().toUpperCase();
          if (code) {
            var e = byCode[code];
            if (e) { ins = [e.id ? { t: 's', v: e.id } : null, { t: 's', v: e.written || nameFromParts(e.last, e.first) }]; restored++; }
            else if (isCode(code) && unknown.indexOf(code) < 0) unknown.push(code);
          }
        }
        row.splice.apply(row, [found.col, 0].concat(ins));
        return row;
      });
      return { name: sheet.name, rows: rows, headerRow: found.headerRow };
    });
    return { doc: { name: doc.name, sheets: sheets }, restored: restored, unknown: unknown, sheetsWithout: without };
  }

  // ---- the student-detail toggles -------------------------------------------

  /** The columns the teacher can choose to keep: [{ key: "s:c", sheet, header }]. */
  function detailColumns(doc) {
    var out = [];
    doc.sheets.forEach(function (sh, si) {
      sh.cols.forEach(function (c) { if (c.role === 'attr') out.push({ key: si + ':' + c.index, sheet: sh.name, header: c.header || colName(c.index) }); });
    });
    return out;
  }

  var SdaCore = {
    ALPHABET: ALPHABET, CODE_RE: CODE_RE, ROLES: ROLES, ROLE_LABELS: ROLE_LABELS, IDENTITY: IDENTITY, CODE_HEADER: CODE_HEADER,
    KEY_COLUMNS: KEY_COLUMNS,
    newCode: newCode, isCode: isCode, fold: fold, parseName: parseName, nameFromParts: nameFromParts, cleanId: cleanId,
    guessRole: guessRole, findHeaderRow: findHeaderRow, makeSheet: makeSheet, setHeaderRow: setHeaderRow, text: text, colName: colName,
    studentRows: studentRows, people: people, fingerprint: fingerprint, indexKey: indexKey, match: match, assign: assign,
    keyRows: keyRows, readKey: readKey, anonymize: anonymize, leaks: leaks,
    findCodeColumn: findCodeColumn, reverse: reverse, detailColumns: detailColumns
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SdaCore; else root.SdaCore = SdaCore;
})(typeof window !== 'undefined' ? window : globalThis);
