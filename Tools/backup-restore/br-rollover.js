/* br-rollover.js — the year rollover: the archive, its check, the journal
   that makes an interrupted clear visible, the clear itself, and the check
   for other open tabs before either (Path 3 P6, increments 1 to 3).

   The design is BACKLOG.md, Path 3, the P6 bullet. The archive half:

     hash(text)                 hex SHA-256 of the UTF-8 text (crypto.subtle);
                                where there is none, a 53-bit string hash with
                                an `h53-` prefix, so the two can never match.
     manifest(envelope)         { local: { key: [length, hash] },
                                  databases: { name: { store: count } },
                                  blobs: { name: [count, bytes] } }, read off
                                the envelope that is about to be saved.
     compareLocal(a, b)         the keys whose [length, hash] differ, either way.
     stamp(o)                   the `rollover` object put on the envelope. The
                                envelope's formatVersion stays 2: an older
                                reader ignores the field.
     verify(text, expect, deps) { ok, reasons }: the bytes are the bytes that
                                were built, they parse, RestoreKit.read takes
                                them with no bad flag, they are not locked,
                                the stamp is this run's, every manifest key
                                is there with its length and hash, every
                                database with its record counts, every blob
                                with its decoded size.

   The clear half:

     RULES                      one rule per registry key or prefix the clear
                                changes (see "the rules" below): delete,
                                reduce (keep the setup, empty the student
                                fields), roster, ask (free text that names a
                                student), index, keep.
     rosterNames(local)         this year's students, full names, from
                                np_rosters and crh_students_v1.
     scanNames(text, names)     [{ name, count }], whole words, any case.
     plan(id, local, archive, opts)
                                every item the clear will change, planned
                                from the CHECKED archive's own values, with
                                the exact string each write puts back; the
                                review table and run() both read it. A key
                                that holds something the archive does not is
                                a problem, and a plan with problems does not
                                run.
     run(plan, io)              the steps in order (reductions, deletions,
                                the roster keys, the photos, the share slot,
                                the indexes), each read back and recorded in
                                the journal before the next, after checking
                                that nothing changed since the plan. A failure
                                leaves the journal at 'clearing'; planning
                                again from the archive finishes it, because a
                                key already reduced plans as 'done'.
     resume(storage)            the last run, when it was left at 'archived'
                                or 'clearing'; null otherwise.
     writtenBack(storage)       after a 'done' run, the changed keys that are
                                back with exactly last year's value (a tab
                                that stayed open saved it again).

   The other tabs (increment 3):

     otherTabs(container)       asks sw.js (the CLIENTS message) for every
                                other open window of the site: { seen, urls }.
     nameTabs(urls, root, tools)
                                those windows as [{ title, count }].

   Storage it owns: one key, `br_rollover_v1`, `{ v: 1, runs: [...] }`, the
   last three runs. It holds no name and no value: key names, counts, dates,
   and hashes of what was there before. 009 treats it as internal, like
   `br_last_backup_at`, so it is in no backup and never cleared. The keys a
   teacher chose to Keep are in it by name (`keptByChoice`), so a clear
   finished after an interruption makes the same choices.

   Pure apart from `run`, which writes only through the storage it is
   handed, so the Node suite drives all of it. */
(function (global) {
  'use strict';

  var JOURNAL_KEY = 'br_rollover_v1';
  var KEEP_RUNS = 3;

  function toUtf8(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(text));
    var s = unescape(encodeURIComponent(String(text)));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  /* cyrb53: a 53-bit string hash, for a browser with no crypto.subtle (an old
     one, or a page on plain http). Not a defence against tampering; it is
     there to notice a truncated or changed file, which is what it is used for. */
  function hash53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    var n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return 'h53-' + n.toString(16);
  }

  function subtle() {
    var c = global.crypto;
    return c && c.subtle && typeof c.subtle.digest === 'function' ? c.subtle : null;
  }

  function hash(text) {
    var s = subtle();
    if (!s) return Promise.resolve(hash53(String(text)));
    return s.digest('SHA-256', toUtf8(text)).then(function (buf) {
      var b = new Uint8Array(buf), out = '';
      for (var i = 0; i < b.length; i++) out += (b[i] < 16 ? '0' : '') + b[i].toString(16);
      return out;
    }, function () { return hash53(String(text)); });
  }

  function hashKind(h) { return /^h53-/.test(h) ? '53-bit string hash' : 'SHA-256'; }

  function newId() {
    var b = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') global.crypto.getRandomValues(b);
    else for (var i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    var out = 'ro-';
    for (var j = 0; j < b.length; j++) out += (b[j] < 16 ? '0' : '') + b[j].toString(16);
    return out;
  }

  /* The decoded size of a base64 string, or -1 when it is not base64 at all
     (a file cut short inside a blob ends that way). */
  function base64Bytes(b64) {
    if (typeof b64 !== 'string') return -1;
    if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return -1;
    var pad = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
    return b64.length / 4 * 3 - pad;
  }

  /* Every `{ __t: 'blob' }` 009's codec wrote, anywhere in a value. */
  function countBlobs(v, acc) {
    if (!v || typeof v !== 'object') return acc;
    if (Array.isArray(v)) { v.forEach(function (x) { countBlobs(x, acc); }); return acc; }
    if (v.__t === 'blob') {
      var n = base64Bytes(v.v);
      acc[0]++;
      acc[1] = n < 0 || acc[1] < 0 ? -1 : acc[1] + n;
      return acc;
    }
    Object.keys(v).forEach(function (k) { countBlobs(v[k], acc); });
    return acc;
  }

  function dbShape(spec) {
    var stores = {}, blobs = [0, 0];
    ((spec && spec.stores) || []).forEach(function (s) {
      stores[s.name] = (s.records || []).length;
      (s.records || []).forEach(function (r) { countBlobs(r, blobs); });
    });
    return { stores: stores, blobs: blobs };
  }

  function localManifest(data) {
    var keys = Object.keys(data || {}).sort();
    return Promise.all(keys.map(function (k) { return hash(String(data[k])); })).then(function (hs) {
      var out = {};
      keys.forEach(function (k, i) { out[k] = [String(data[k]).length, hs[i]]; });
      return out;
    });
  }

  function manifest(envelope) {
    return localManifest(envelope.data).then(function (local) {
      var databases = {}, blobs = {};
      Object.keys(envelope.indexedDB || {}).sort().forEach(function (name) {
        var s = dbShape(envelope.indexedDB[name]);
        databases[name] = s.stores;
        blobs[name] = s.blobs;
      });
      return { local: local, databases: databases, blobs: blobs };
    });
  }

  /* The keys whose entry differs between two `local` manifests: added,
     removed or changed. Sorted, so a message lists them the same way twice. */
  function compareLocal(a, b) {
    var out = [], seen = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) {
      if (seen[k]) return;
      seen[k] = 1;
      var x = a && a[k], y = b && b[k];
      if (!x || !y || x[0] !== y[0] || x[1] !== y[1]) out.push(k);
    });
    return out.sort();
  }

  function stamp(o) {
    return {
      id: o.id,
      label: String(o.label || ''),
      nextTerm: String(o.nextTerm || ''),
      plannedAt: o.plannedAt || new Date().toISOString(),
      manifest: o.manifest
    };
  }

  function reason(code, text) { return { code: code, text: text }; }

  /**
   * Is `text` the archive this run built? `expect` is { id, hash, manifest };
   * `deps` is { read, isEncrypted } (RestoreKit.read and BrCrypto.isEncrypted
   * in the page; the suite hands in the same functions). Resolves to
   * { ok, reasons: [{ code, text }] }. The first reason is the one to show.
   */
  function verify(text, expect, deps) {
    deps = deps || {};
    var reasons = [];
    text = typeof text === 'string' ? text : '';
    if (!text.length) return Promise.resolve({ ok: false, reasons: [reason('empty', 'The file is 0 bytes: nothing was saved in it.')] });
    return hash(text).then(function (h) {
      if (h !== expect.hash) reasons.push(reason('changed', 'This file is not byte for byte the one this page saved: it was changed, cut short, or it is a different file.'));
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) {
        reasons.push(reason('truncated', 'The file does not read as a whole backup. It may have been cut short while saving.'));
        return { ok: false, reasons: reasons };
      }
      if (deps.isEncrypted && deps.isEncrypted(parsed)) {
        reasons.push(reason('locked', 'This is a locked backup. A year archive is never locked, so it is not this one.'));
        return { ok: false, reasons: reasons };
      }
      var read = deps.read ? deps.read(parsed) : { envelope: parsed, flags: [] };
      if (read.error) { reasons.push(reason('not-backup', read.error)); return { ok: false, reasons: reasons }; }
      (read.flags || []).forEach(function (f) { if (f.bad) reasons.push(reason('flagged', f.text)); });
      var ro = parsed.rollover;
      if (!ro || typeof ro !== 'object') {
        reasons.push(reason('not-archive', 'This is an ordinary backup, not the year archive this page just saved.'));
        return { ok: false, reasons: reasons };
      }
      if (ro.id !== expect.id) {
        reasons.push(reason('other-run', 'This is another year archive' + (ro.plannedAt ? ', from ' + String(ro.plannedAt).slice(0, 10) : '') +
          ', not the one this page just saved.'));
      }
      var m = expect.manifest || { local: {}, databases: {}, blobs: {} };
      var data = parsed.data || {};
      return localManifest(data).then(function (got) {
        var missing = Object.keys(m.local).filter(function (k) { return !(k in got); });
        var changed = Object.keys(m.local).filter(function (k) {
          return (k in got) && (got[k][0] !== m.local[k][0] || got[k][1] !== m.local[k][1]);
        });
        if (missing.length) reasons.push(reason('missing-key', missing.length + ' saved item' + (missing.length === 1 ? ' is' : 's are') + ' missing from the file.'));
        if (changed.length) reasons.push(reason('changed-key', changed.length + ' saved item' + (changed.length === 1 ? '' : 's') + ' in the file differ from what was archived.'));
        var idb = parsed.indexedDB || {};
        Object.keys(m.databases || {}).forEach(function (name) {
          if (!idb[name]) { reasons.push(reason('missing-db', 'The images and other records in “' + name + '” are missing from the file.')); return; }
          var s = dbShape(idb[name]);
          var want = m.databases[name];
          var short = Object.keys(want).filter(function (st) { return s.stores[st] !== want[st]; });
          if (short.length) reasons.push(reason('db-count', '“' + name + '” holds a different number of records than was archived.'));
          var wb = (m.blobs || {})[name];
          if (wb && (s.blobs[0] !== wb[0] || s.blobs[1] !== wb[1])) {
            reasons.push(reason('blob-size', 'A picture or recording in “' + name + '” is not the size that was archived.'));
          }
        });
        return { ok: !reasons.length, reasons: reasons };
      });
    });
  }

  /* ---------- the journal ---------- */

  function readJournal(storage) {
    var raw = null;
    try { raw = storage.getItem(JOURNAL_KEY); } catch (e) { raw = null; }
    var j = null;
    try { j = raw ? JSON.parse(raw) : null; } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || !Array.isArray(j.runs)) j = { v: 1, runs: [] };
    j.runs = j.runs.filter(function (r) { return r && typeof r === 'object' && typeof r.id === 'string'; });
    return j;
  }

  /* Throws when storage refuses the write: a run that cannot record its
     progress must stop, not carry on unrecorded. */
  function writeJournal(storage, j) {
    j.runs = j.runs.slice(-KEEP_RUNS);
    storage.setItem(JOURNAL_KEY, JSON.stringify({ v: 1, runs: j.runs }));
  }

  function getRun(storage, id) {
    var runs = readJournal(storage).runs;
    for (var i = 0; i < runs.length; i++) if (runs[i].id === id) return runs[i];
    return null;
  }

  /** Adds or updates run `r` (matched by id); only the fields given change. */
  function recordRun(storage, r) {
    var j = readJournal(storage);
    var found = null;
    for (var i = 0; i < j.runs.length; i++) if (j.runs[i].id === r.id) found = j.runs[i];
    if (!found) {
      found = { id: r.id, label: '', nextTerm: '', state: 'archived', archiveName: '', archiveHash: '',
                startedAt: new Date().toISOString(), finishedAt: null, steps: 0, done: 0, cleared: {} };
      j.runs.push(found);
    }
    Object.keys(r).forEach(function (k) { found[k] = r[k]; });
    writeJournal(storage, j);
    return found;
  }

  function lastRun(storage) {
    var runs = readJournal(storage).runs;
    return runs.length ? runs[runs.length - 1] : null;
  }

  function resume(storage) {
    var r = lastRun(storage);
    if (!r || (r.state !== 'archived' && r.state !== 'clearing')) return null;
    return { id: r.id, label: r.label, state: r.state, archiveName: r.archiveName, archiveHash: r.archiveHash,
             checkedAt: r.checkedAt || null, doneSteps: r.done || 0, totalSteps: r.steps || 0, startedAt: r.startedAt,
             choices: (r.keptByChoice || []).reduce(function (o, k) { o[k] = 'keep'; return o; }, {}) };
  }

  /* ---------- names (for the free text, kind E) ---------- */

  function normKey(s) {
    if (global.Roster && typeof global.Roster.normKey === 'function') return global.Roster.normKey(s);
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function parseJson(text) {
    try { return { ok: true, v: JSON.parse(text) }; } catch (e) { return { ok: false }; }
  }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* A roster's student, whichever shape a tool stored it in. */
  function nameOf(s) {
    if (typeof s === 'string') return s;
    if (isObj(s)) return typeof s.name === 'string' ? s.name : typeof s.displayName === 'string' ? s.displayName : '';
    return '';
  }

  /**
   * This year's students, from the two roster keys, as full names: one entry
   * per normKey. A name of one word is left out on purpose — the scan is for
   * full names only, so "Will" or "May" in a lesson plan is never a hit.
   */
  function rosterNames(local) {
    var seen = {}, out = [];
    function add(n) {
      n = String(n || '').replace(/\s+/g, ' ').trim();
      if (n.split(' ').length < 2) return;
      var k = normKey(n);
      if (!seen[k]) { seen[k] = 1; out.push(n); }
    }
    var np = parseJson(local && local.np_rosters);
    if (np.ok && isObj(np.v)) {
      Object.keys(np.v).forEach(function (cls) {
        var list = np.v[cls];
        if (isObj(list) && Array.isArray(list.students)) list = list.students;
        if (Array.isArray(list)) list.forEach(function (s) { add(nameOf(s)); });
      });
    }
    var crh = parseJson(local && local.crh_students_v1);
    if (crh.ok && isObj(crh.v) && isObj(crh.v.rosters)) {
      Object.keys(crh.v.rosters).forEach(function (cls) {
        var r = crh.v.rosters[cls];
        if (!isObj(r)) return;
        (Array.isArray(r.students) ? r.students : []).forEach(function (s) {
          add(nameOf(s));
          if (isObj(s) && typeof s.preferred === 'string') add(s.preferred);
        });
      });
    }
    return out.sort();
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var BOUND = '[^0-9A-Za-z_\\u00C0-\\u024F]';
  function nameRe(name) {
    var toks = String(name).trim().split(/\s+/).map(escapeRe);
    /* Whole words, any case, any run of whitespace (a line break included)
       between the parts of the name. */
    return new RegExp('(^|' + BOUND + ')' + toks.join('\\s+') + '(?=' + BOUND + '|$)', 'gi');
  }

  /** [{ name, count }] for each of `names` found in `text`, whole words only. */
  function scanNames(text, names) {
    var hay = String(text || ''), out = [];
    (names || []).forEach(function (n) {
      if (String(n).trim().split(/\s+/).length < 2) return;
      var m = hay.match(nameRe(n));
      if (m && m.length) out.push({ name: n, count: m.length });
    });
    return out;
  }

  /* Every string in a value, object keys included (some tools key a map by
     the student's name), one per line, so a scan reads the text a teacher
     typed and not JSON's escapes of it. */
  function textOf(v) {
    var out = [];
    (function walk(x) {
      if (typeof x === 'string') { out.push(x); return; }
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (isObj(x)) Object.keys(x).forEach(function (k) { out.push(k); walk(x[k]); });
    })(v);
    return out.join('\n');
  }

  function scanValue(v, names) { return scanNames(textOf(v), names); }

  /* ---------- what a reducer returns ---------- */

  /* What a reducer returns: the new value, and what it took and kept, by
     kind. `sample` is for the review table only (it may hold names) and is
     never journalled or put on the receipt. */
  function result(value) { return { value: value, removed: [], kept: [] }; }
  function took(r, what, n, sample) {
    if (n > 0) r.removed.push({ what: what, count: n, sample: (sample || []).filter(Boolean).slice(0, 6).map(String) });
    return r;
  }
  function keeps(r, what, n) { if (n > 0) r.kept.push({ what: what, count: n }); return r; }
  var UNREADABLE = { unreadable: true };
  function arr(v) { return Array.isArray(v) ? v : []; }
  function size(v) { return Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0; }

  /* ---------- the rules ----------

     One rule per registry key or prefix that the rollover changes. `kind`:
       'delete'  student data and nothing else (the design's kind A)
       'reduce'  student data with setup inside (B), or a student field in
                 teacher content (D): reduce() returns the value with the
                 student fields at the tool's own empty values
       'roster'  the roster shells (C), reduced last among the keys
       'ask'     free text that may name a student (E): shown only when this
                 year's names are found in it, pre-set to Clear; Clear takes
                 out only the entries a name is in
       'index'   a document switcher's list (step 5f), planned against the
                 storage the steps before it leave
       'keep'    a student-marked key that holds no student data (a
                 switcher's current-document name)
     Every empty value is the one the tool's own new-document or clear code
     writes, read off that code (BACKLOG.md, Path 3 P6, has the table and
     the traps; each rule's comment names its own). A reducer never touches
     storage, never throws on a shape it does not know (UNREADABLE: the key
     is left as it is and the page says so), and is idempotent. */

  function shallow(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
  function lines(s) { return typeof s === 'string' ? s.split('\n').map(function (l) { return l.trim(); }).filter(Boolean) : []; }
  function hit(v, ctx) { return scanValue(v, ctx.names).length > 0; }
  function nameSet(ctx) { var o = {}; (ctx.names || []).forEach(function (n) { o[normKey(n)] = 1; }); return o; }
  function dropValues(map, on) {
    var o = {};
    Object.keys(map).forEach(function (k) { if (!(typeof map[k] === 'string' && on[normKey(map[k])])) o[k] = map[k]; });
    return o;
  }

  /* { current, sets: { name: set } } (001, 008): fn(set copy, r) per set. */
  function eachSet(v, field, fn, label) {
    if (!isObj(v) || !isObj(v[field])) return UNREADABLE;
    var r = result(shallow(v));
    r.value[field] = {};
    Object.keys(v[field]).forEach(function (k) {
      var s = v[field][k];
      if (!isObj(s)) { r.value[field][k] = s; return; }
      var q = shallow(s);
      fn(q, r);
      r.value[field][k] = q;
    });
    merge(r);
    return keeps(r, label, Object.keys(v[field]).length);
  }

  /* Several sets add to the same "what"; one line each in the table. */
  function merge(r) {
    ['removed', 'kept'].forEach(function (f) {
      var by = {}, out = [];
      r[f].forEach(function (x) {
        if (by[x.what]) { by[x.what].count += x.count; if (x.sample) by[x.what].sample = by[x.what].sample.concat(x.sample).slice(0, 6); }
        else { by[x.what] = x; out.push(x); }
      });
      r[f] = out;
    });
    return r;
  }

  /* A list of entries; Clear drops each one a name is found in. */
  function filterList(v, ctx, what, keptWhat, label) {
    if (!Array.isArray(v)) return UNREADABLE;
    var r = result([]), gone = [];
    v.forEach(function (e) { if (hit(e, ctx)) gone.push(label(e)); else r.value.push(e); });
    took(r, what, gone.length, gone);
    return keeps(r, keptWhat, r.value.length);
  }

  function certificate(v, ctx) {
    if (!isObj(v)) return UNREADABLE;
    var r = result(shallow(v));
    var batch = lines(v.batchNames);
    took(r, 'names', batch.length + (String(v.studentName || '').trim() ? 1 : 0), [v.studentName].concat(batch));
    r.value.studentName = ''; r.value.batchNames = '';
    if (hit(v.reason, ctx)) { took(r, 'a reason naming a student', 1, [v.reason]); r.value.reason = ''; }
    if (hit(v.qrUrl, ctx)) { took(r, 'a link naming a student', 1, [v.qrUrl]); r.value.qrUrl = ''; }
    return keeps(r, 'certificate designs', 1);
  }

  function roleCards(v) {
    if (!isObj(v) || !Array.isArray(v.roles)) return UNREADABLE;
    var r = result(shallow(v)), n = 0, sample = [];
    r.value.roles = v.roles.map(function (x) {
      if (!isObj(x)) return x;
      var q = shallow(x);
      n += size(x.students); sample = sample.concat(arr(x.students));
      q.students = [];
      return q;
    });
    took(r, 'students given roles', n, sample);
    return keeps(r, 'roles', v.roles.length);
  }

  function listIndex(prefix) {
    return function (v, ctx) {
      if (!Array.isArray(v)) return UNREADABLE;
      var r = result([]), gone = [];
      v.forEach(function (n) { if (typeof n === 'string' && !ctx.exists(prefix + n)) gone.push(n); else r.value.push(n); });
      return took(r, 'switcher entries for a document that is gone', gone.length, gone);
    };
  }
  function currentIndex(prefix) {
    return function (v, ctx) {
      return ctx.exists(prefix + v) ? result(v) : took(result(null), 'the open document, which is gone', 1);
    };
  }

  var RULE_LIST = [
    /* ── Kind B: student data with the teacher's setup inside. Each student
       field goes to the empty value the tool's own new-section code writes;
       a section's name, its rosterName and its setup stay. ── */

    /* 005 Seating Chart: the room (desks), saved layouts' desks, section
       names and ids (008 and 045 find a section by them) and the view
       settings stay. Never zero sections: validateState refuses that and
       the page writes its three sample classes over the key. The photos
       are cleared in their own step. */
    { key: 'seating-chart-v1', tool: '005', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !Array.isArray(v.sections) || !v.sections.length) return UNREADABLE;
      var r = result(shallow(v)), names = 0, sample = [], hist = 0, desks = 0, layouts = 0;
      r.value.sections = v.sections.map(function (s) {
        if (!isObj(s)) return s;
        var q = shallow(s);
        arr(s.students).forEach(function (st) { names++; sample.push(nameOf(st)); });
        hist += size(s.history); desks += size(s.desks); layouts += size(s.layouts);
        q.students = []; q.apart = []; q.together = []; q.assign = {}; q.history = [];
        // Path 14 P3: the rules name students and carry the teacher's reasons, so they go; the preferences
        // (`prefs`) and a desk left empty (`desk.empty`) are setup and stay.
        if ('rules' in s) q.rules = [];
        q.layouts = arr(s.layouts).map(function (l) { if (!isObj(l)) return l; var m = shallow(l); m.assign = {}; return m; });
        return q;
      });
      if ('currentQuarter' in v) r.value.currentQuarter = '';   // this year's; repair guesses it again from the date
      took(r, 'names', names, sample); took(r, 'seating history entries', hist);
      keeps(r, 'classes', v.sections.length); keeps(r, 'desks', desks);
      return keeps(r, 'saved layouts', layouts);
    } },

    /* 001 Hall Pass: destinations, limits, initials and sounds stay; the
       names, who is out, the log, the history, the approval list and the id
       map go (normalizeState's empties). */
    { key: 'hall-pass-log-sections', tool: '001', kind: 'reduce', reduce: function (v) {
      return eachSet(v, 'sets', function (s, r) {
        var list = lines(s.namesText);
        took(r, 'names', list.length, list);
        took(r, 'passes logged', size(s.log) + size(s.outNow));
        took(r, 'days of history', size(s.history));
        s.namesText = ''; s.outNow = []; s.log = []; s.history = []; s.approvalNames = []; s.idNames = {};
        keeps(r, 'destinations', size(s.destinations));
      }, 'classes');
    } },

    /* 008 Behavior Points: tags and point values, display settings, teams
       (names, colours) and the seating link stay; names, points, counts,
       the log, history, goals, team members and team scores go. */
    { key: 'behavior-points-tracker-sections', tool: '008', kind: 'reduce', reduce: function (v) {
      return eachSet(v, 'sets', function (s, r) {
        var list = lines(s.namesText);
        took(r, 'names', list.length, list);
        took(r, 'points given', size(s.log));
        took(r, 'days of history', size(s.history));
        took(r, 'goals', size(s.goals));
        s.namesText = ''; s.points = {}; s.posCount = {}; s.negCount = {}; s.log = []; s.history = []; s.goals = {}; s.idNames = {};
        if ('teamOf' in s) s.teamOf = {};
        ['teamBank', 'teamDay'].forEach(function (f) {
          if (isObj(s[f])) { var z = {}; Object.keys(s[f]).forEach(function (t) { z[t] = 0; }); s[f] = z; }
        });
        if ('teamLog' in s) s.teamLog = [];
        keeps(r, 'behaviours with their points', size(s.tags));
      }, 'classes');
    } },

    /* 002 Group Generator: the grouping settings, group labels and roles
       stay; names, absences, apart/together pairs, pairing and role history
       and the id map go (defaultConfig()). */
    { prefix: 'gtg:data:', tool: '002', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v));
      var list = lines(v.names).map(function (l) { return l.split('\t')[0]; });
      took(r, 'names', list.length, list);
      took(r, 'pairing history', size(v.pairHistory));
      r.value.names = ''; r.value.absentNames = []; r.value.keepApart = []; r.value.keepTogether = [];
      r.value.pairHistory = {}; r.value.pairGen = 0; r.value.idNames = {};
      delete r.value.roleHistory;
      return keeps(r, 'group settings', 1);
    } },
    { key: 'gtg:current', tool: '002', kind: 'keep' },

    /* 013 Lab Safety Contracts: the documents (labels, fees, the contract's
       wording) stay; the roster, who signed and paid, the due date and the
       id map go (newSection()). */
    { key: 'lsct_sections_v1', tool: '013', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), names = 0, sample = [], signed = 0, docs = 0;
      Object.keys(v).forEach(function (k) {
        var s = v[k];
        if (!isObj(s)) { r.value[k] = s; return; }
        var q = shallow(s);
        names += size(s.roster); sample = sample.concat(arr(s.roster)); signed += size(s.contracts); docs += size(s.documents);
        q.roster = []; q.contracts = {}; q.idNames = {};
        if ('dueDate' in s) q.dueDate = '';
        r.value[k] = q;
      });
      took(r, 'names', names, sample); took(r, 'signature records', signed);
      keeps(r, 'classes', Object.keys(v).length);
      return keeps(r, 'contract documents', docs);
    } },
    { key: 'lsct_current_v1', tool: '013', kind: 'keep' },

    /* 022 Lab Roles: roles, stations, equipment, the grouping mode and the
       safety gate stay; names, role history, last groups, the checkout log,
       pairs to keep apart, absences and the id map go (normalizeRosterData). */
    { key: 'lgrr_rosters', tool: '022', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), names = 0, sample = [], roles = 0;
      Object.keys(v).forEach(function (k) {
        var s = v[k];
        if (!isObj(s)) { r.value[k] = s; return; }
        var q = shallow(s);
        var list = lines(s.students);
        names += list.length; sample = sample.concat(list); roles += size(s.roles);
        q.students = ''; q.history = {}; q.lastGroups = null; q.checkoutLog = []; q.keepApart = []; q.absent = [];
        q.lastExcludedForSafety = []; q.idNames = {};
        r.value[k] = q;
      });
      took(r, 'names', names, sample);
      keeps(r, 'classes', Object.keys(v).length);
      return keeps(r, 'lab roles', roles);
    } },
    { key: 'lgrr_current', tool: '022', kind: 'keep' },

    /* ── Kind D: a student field inside teacher content. ── */

    /* 044 Sub Plan Builder: the standing details a sub needs stay; the
       medical alerts go (the most sensitive text on the site). Never delete
       the key: the page's hard-coded defaults would come back. The custom
       behaviour text goes only if this year's names are in it. */
    { key: 'subPlanBuilder.standingDetails.v1', tool: '044', kind: 'reduce', reduce: function (v, ctx) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v));
      if (String(v.medicalAlerts || '').trim()) { took(r, 'medical alerts', 1, [v.medicalAlerts]); }
      r.value.medicalAlerts = '';
      if (hit(v.behaviorCustom, ctx)) { took(r, 'behaviour notes naming a student', 1, [v.behaviorCustom]); r.value.behaviorCustom = ''; }
      return keeps(r, 'standing details for a sub', 1);
    } },

    /* 042 Certificates: the design stays; the student, the batch of names,
       and a reason or link naming a student go, to '' — never removed:
       batchNames.split throws on undefined. */
    { prefix: 'gvb-certificate-maker:data:', tool: '042', kind: 'reduce', reduce: certificate },
    { key: 'gvb-certificate-maker:last', tool: '042', kind: 'reduce', reduce: certificate },

    /* 050 Civics Role Cards: the simulation stays; who plays each role goes
       (the page's own "Clear names" writes students: []). The legacy key is
       migrated again when the list is empty, so it gets the same rule. */
    { prefix: 'crcg:data:', tool: '050', kind: 'reduce', reduce: roleCards },
    { key: 'crcg_roles_v1', tool: '050', kind: 'reduce', reduce: roleCards },

    /* 030 Review Board: the board stays; the game played on it goes, as the
       page's own Reset game does it — scores 0, clues unplayed, every mode's
       marks, wagers, log and spins cleared (a wheel's seed '' is re-minted
       on load). A team named by a roster split, "Team 2: <names>", goes back
       to "Team 2"; a typed team name that holds this year's names does too. */
    { prefix: 'gvb-review-board:data:', tool: '030', kind: 'reduce', reduce: function (v, ctx) {
      if (!isObj(v) || !Array.isArray(v.teams) || !Array.isArray(v.categories)) return UNREADABLE;
      var r = result(shallow(v)), renamed = [], played = 0, clues = 0;
      r.value.teams = v.teams.map(function (t, i) {
        if (!isObj(t)) return t;
        var q = shallow(t);
        var n = String(t.name || '');
        var m = /^Team (\d+): /.exec(n);
        if (m) { renamed.push(n); q.name = 'Team ' + m[1]; }
        else if (hit(n, ctx)) { renamed.push(n); q.name = 'Team ' + (i + 1); }
        q.score = 0;
        return q;
      });
      r.value.categories = v.categories.map(function (c) {
        if (!isObj(c)) return c;
        var q = shallow(c);
        q.clues = arr(c.clues).map(function (cl) {
          if (!isObj(cl)) return cl;
          clues++;
          var k = shallow(cl);
          if (cl.used) played++;
          k.used = false;
          delete k.marks;
          return k;
        });
        return q;
      });
      if (isObj(v.final)) { var f = shallow(v.final); delete f.wagers; delete f.marks; delete f.deltas; r.value.final = f; }
      if (isObj(v.quizBowl)) { var b = shallow(v.quizBowl); b.log = []; b.over = false; r.value.quizBowl = b; }
      if (isObj(v.wheel)) { var w = shallow(v.wheel); w.seed = ''; w.spins = 0; w.doubleNext = false; w.last = null; r.value.wheel = w; }
      took(r, 'team names holding students’ names', renamed.length, renamed);
      took(r, 'played clues and scores', played);
      return keeps(r, 'clues', clues);
    } },

    /* 016 QR equipment: each item and its label stay, checked in; who has
       it and who had it go. Devon, 2026-10-07: an item still out is cleared
       with the rest (status 'in': 'out' with no borrower shows as "Out to
       (unspecified)"). label stays: the list sort reads it unguarded. */
    { key: 'qr-code-generator-inventory', tool: '016', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), out = 0, hist = 0, sample = [];
      Object.keys(v).forEach(function (k) {
        var it = v[k];
        if (!isObj(it)) { r.value[k] = it; return; }
        var q = shallow(it);
        if (it.status === 'out' || String(it.assignedTo || '').trim()) { out++; sample.push(it.assignedTo); }
        hist += size(it.history);
        q.status = 'in'; q.assignedTo = ''; q.checkedOutAt = null; q.checkedInAt = null; q.history = [];
        r.value[k] = q;
      });
      took(r, 'borrowers of items still out', out, sample); took(r, 'check-out records', hist);
      return keeps(r, 'items', Object.keys(v).length);
    } },

    /* 018 Scavenger Hunt: the hunt (stations, code words) stays; the run
       (teams, check-ins, marks, hints, timer) goes, and ensureRun() builds
       an empty one on load. */
    { key: 'qr-scavenger-hunt-sets', tool: '018', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !isObj(v.sets)) return UNREADABLE;
      var r = result(shallow(v)), teams = 0, sample = [];
      r.value.sets = {};
      Object.keys(v.sets).forEach(function (k) {
        var s = v.sets[k];
        if (!isObj(s)) { r.value.sets[k] = s; return; }
        var q = shallow(s);
        if (isObj(s.run)) { teams += size(s.run.teams); sample = sample.concat(arr(s.run.teams).map(nameOf)); }
        delete q.run;
        r.value.sets[k] = q;
      });
      took(r, 'teams and their progress', teams, sample);
      return keeps(r, 'hunts', Object.keys(v.sets).length);
    } },

    /* 064 Trading Cards: Devon, 2026-10-07: a card made for a student is
       asked Keep or Clear. A card is "for a student" when its name is one
       of this year's; Clear takes the card out (a card with no name is
       dropped on load anyway). */
    { prefix: 'htcm:data:', tool: '064', kind: 'ask', reduce: function (v, ctx) {
      if (!isObj(v) || !Array.isArray(v.cards)) return UNREADABLE;
      var r = result(shallow(v)), gone = [];
      r.value.cards = v.cards.filter(function (c) {
        if (isObj(c) && hit(c.name, ctx)) { gone.push(c.name); return false; }
        return true;
      });
      took(r, 'cards made for a student', gone.length, gone);
      return keeps(r, 'other cards', r.value.cards.length);
    } },

    /* 058 Duty Roster and 075 Staff Directory are staff lists that can be
       filled from a class roster. Devon, 2026-10-07: when they were, they
       are student data. A name that is on this year's rosters goes; staff
       stay. */
    { key: 'drb_roster_v1', tool: '058', kind: 'reduce', reduce: function (v, ctx) {
      if (!isObj(v) || !Array.isArray(v.duties)) return UNREADABLE;
      var on = nameSet(ctx), r = result(shallow(v)), gone = [];
      r.value.staff = arr(v.staff).filter(function (n) { if (on[normKey(n)]) { gone.push(n); return false; } return true; });
      if (isObj(v.assignments)) r.value.assignments = dropValues(v.assignments, on);
      if (isObj(v.staffSkip)) { r.value.staffSkip = {}; Object.keys(v.staffSkip).forEach(function (n) { if (!on[normKey(n)]) r.value.staffSkip[n] = v.staffSkip[n]; }); }
      if (isObj(v.weekOverrides)) {
        r.value.weekOverrides = {};
        Object.keys(v.weekOverrides).forEach(function (w) { r.value.weekOverrides[w] = isObj(v.weekOverrides[w]) ? dropValues(v.weekOverrides[w], on) : v.weekOverrides[w]; });
      }
      took(r, 'students on the duty list', gone.length, gone);
      keeps(r, 'staff', r.value.staff.length);
      return keeps(r, 'duties', v.duties.length);
    } },
    { key: 'sdb_directory_v1', tool: '075', kind: 'reduce', reduce: function (v, ctx) {
      if (!Array.isArray(v)) return UNREADABLE;
      var on = nameSet(ctx), r = result([]), gone = [];
      v.forEach(function (p) { if (isObj(p) && on[normKey(p.name)]) gone.push(p.name); else r.value.push(p); });
      took(r, 'students in the directory', gone.length, gone);
      return keeps(r, 'staff', r.value.length);
    } },

    /* 023 Exit Tickets. Devon, 2026-10-07: "wipe them": what students
       wrote (discussion) goes whole; the category tally keeps its
       categories and loses its counts and history. */
    { key: 'gvb-exit-ticket:discussion', tool: '023', kind: 'delete', what: 'students’ written responses' },
    { key: 'gvb-exit-ticket:categoryTally', tool: '023', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !Array.isArray(v.categories)) return UNREADABLE;
      var r = result(shallow(v)), n = 0;
      r.value.categories = v.categories.map(function (c) { if (!isObj(c)) return c; var q = shallow(c); n += Number(c.count) || 0; q.count = 0; return q; });
      r.value.history = [];
      took(r, 'tallied responses', n); took(r, 'saved tallies', size(v.history));
      return keeps(r, 'categories', v.categories.length);
    } },

    /* ── Kind A: student data and nothing else, deleted. ── */
    { key: 'np_current', tool: '007', kind: 'delete' },
    { key: 'np_history', tool: '007', kind: 'delete' },
    { key: 'np_stats', tool: '007', kind: 'delete' },
    { key: 'np_hof', tool: '007', kind: 'delete' },
    { key: 'np_lucky', tool: '007', kind: 'delete' },
    { key: 'np_absent', tool: '007', kind: 'delete' },
    { key: 'crh_archived_students', tool: '006', kind: 'delete' },
    { key: 'crh_flags_v1', tool: '006', kind: 'delete' },
    { key: 'escape-room-builder:monitor-record', tool: '019', kind: 'delete', what: 'the teacher monitor’s record of each team’s play' },
    { key: 'subPlanBuilder.subSaid.v1', tool: '044', kind: 'delete', what: 'the notes about what each sub said' },
    { key: 'pcl_entries_v1', tool: '068', kind: 'delete' },
    { key: 'pcl_idnames_v1', tool: '068', kind: 'delete' },
    { key: 'pcl_roster_v1', tool: '068', kind: 'delete' },
    { prefix: 'gvb-rubric-builder:scores:', tool: '003', kind: 'delete' },
    { key: 'gvb-exit-ticket:tally', tool: '023', kind: 'delete' },
    { key: 'gvb-exit-ticket:triage', tool: '023', kind: 'delete' },
    { key: 'gvb-number-talks:strategyLibrary', tool: '024', kind: 'delete' },
    { key: 'gvb-writing-prompts:record', tool: '025', kind: 'delete' },
    { key: 'gtg-settings', tool: '002', kind: 'delete' },
    { key: 'apl_portfolio_v1', tool: '048', kind: 'delete' },
    { prefix: 'gtg:', tool: '002', kind: 'delete' },
    { prefix: 'gvb-grade-distribution:', tool: '037', kind: 'delete' },
    { prefix: 'gvb-bracket:', tool: '020', kind: 'delete' },
    { prefix: 'gvb-exit-ticket:tally', tool: '023', kind: 'delete' },
    { key: 'conf-who', tool: 'conference-signup', kind: 'delete' },
    { key: 'conf-receipts', tool: 'conference-signup', kind: 'delete' },
    { key: 'conf-demo-state', tool: 'conference-signup', kind: 'delete' },

    /* ── The indexes (step 5f): a document switcher's list keeps every
       document that is still there after the steps before it, and drops one
       that is gone, so no entry selects nothing. ── */
    { key: 'gtg:list', tool: '002', kind: 'index', reduce: listIndex('gtg:data:') },
    { key: 'gvb-field-trip:list', tool: '043', kind: 'index', reduce: listIndex('gvb-field-trip:data:') },
    { key: 'socsem:list', tool: '084', kind: 'index', reduce: listIndex('socsem:data:') },
    { key: 'gvb-certificate-maker:list', tool: '042', kind: 'index', reduce: listIndex('gvb-certificate-maker:data:') },
    { key: 'gvb-bracket:list', tool: '020', kind: 'index', reduce: listIndex('gvb-bracket:data:') },
    { key: 'gvb-grade-distribution:list', tool: '037', kind: 'index', reduce: listIndex('gvb-grade-distribution:data:') },
    { key: 'gvb-bracket:current', tool: '020', kind: 'index', raw: true, reduce: currentIndex('gvb-bracket:data:') },
    { key: 'gvb-grade-distribution:current', tool: '037', kind: 'keep' },
    { key: 'novel-study-units', tool: '027', kind: 'index', reduce: function (v, ctx) {
      if (!isObj(v)) return UNREADABLE;
      var books = parseJson(ctx.get('novel-study-circles'));
      var have = books.ok && isObj(books.v) ? books.v : {};
      var r = result({}), gone = 0;
      Object.keys(v).forEach(function (k) {
        var u = v[k];
        if (!isObj(u) || !Array.isArray(u.projectNames)) { r.value[k] = u; return; }
        var q = shallow(u);
        q.projectNames = u.projectNames.filter(function (n) { if (n in have) return true; gone++; return false; });
        r.value[k] = q;
      });
      return took(r, 'unit entries naming a book that is gone', gone);
    } },

    /* 027 Novel Study Circles: one project per book. The book, its roles,
       mode, group size and schedule stay; the names, groups, role history,
       meetings and the id map go, to newProject()'s own empty values.
       Meetings go whole: renderMeetingHistory maps m.groups unguarded, and
       a meeting is a record of who did what on a day. */
    { key: 'novel-study-circles', tool: '027', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), names = 0, groups = 0, meetings = 0, sample = [], books = 0;
      Object.keys(v).forEach(function (k) {
        var p = v[k];
        if (!isObj(p)) { r.value[k] = p; return; }
        var q = shallow(p);
        var list = typeof p.students === 'string' ? p.students.split('\n').filter(function (s) { return s.trim(); }) : [];
        names += list.length; sample = sample.concat(list);
        groups += size(p.groups); meetings += size(p.meetings);
        q.students = ''; q.groups = []; q.history = {}; q.meetings = []; q.idNames = {};
        r.value[k] = q;
        books++;
      });
      took(r, 'names', names, sample); took(r, 'groups', groups); took(r, 'meetings', meetings);
      return keeps(r, 'books with their roles and schedules', books);
    } },
    { key: 'novel-study-circles-current', tool: '027', kind: 'keep' },

    /* 033 SSR Log: the section (its name is the key), weekly goals and the
       book-to-genre tags stay; the roster, the logs, finished books and the
       id map go, to newSection()'s values. */
    { key: 'sslt_sections_v1', tool: '033', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), names = 0, logs = 0, sample = [], n = 0;
      Object.keys(v).forEach(function (k) {
        var s = v[k];
        if (!isObj(s)) { r.value[k] = s; return; }
        var q = shallow(s);
        names += size(s.roster); sample = sample.concat(arr(s.roster));
        Object.keys(isObj(s.logs) ? s.logs : {}).forEach(function (who) { logs += size(s.logs[who]); });
        q.roster = []; q.logs = {}; q.finished = {}; q.idNames = {};
        r.value[k] = q;
        n++;
      });
      took(r, 'names', names, sample); took(r, 'reading log entries', logs);
      return keeps(r, 'classes with their weekly goals', n);
    } },
    { key: 'sslt_current_v1', tool: '033', kind: 'keep' },

    /* 060 Fitness Tracker: the events stay; the roster and results go.
       roster must stay an array, or load() throws the whole save away. */
    { key: 'fsat_tracker_v1', tool: '060', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !Array.isArray(v.roster)) return UNREADABLE;
      var r = result(shallow(v));
      took(r, 'names', v.roster.length, v.roster); took(r, 'results', size(v.results));
      r.value.roster = []; r.value.results = {};
      return keeps(r, 'events', size(v.events));
    } },

    /* 073 Science Fair: a Store envelope ({ v: 2, data }), kept as one, or
       store.js reads it as legacy and every tracker is lost. Each tracker's
       name and milestones stay; roster, done and notes go. */
    { key: 'sfpt_tracker_v1', tool: '073', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || typeof v.v !== 'number' || !isObj(v.data) || !Array.isArray(v.data.list)) return UNREADABLE;
      var r = result(shallow(v)), names = 0, notes = 0, sample = [];
      r.value.data = shallow(v.data);
      r.value.data.list = v.data.list.map(function (t) {
        if (!isObj(t)) return t;
        var q = shallow(t);
        names += size(t.roster); sample = sample.concat(arr(t.roster)); notes += size(t.notes);
        q.roster = []; q.done = {}; q.notes = {};
        return q;
      });
      took(r, 'names', names, sample); took(r, 'notes', notes);
      return keeps(r, 'trackers with their milestones', v.data.list.length);
    } },

    /* 077 Testing Accommodations: the accommodation types and the rooms
       (proctors are staff) stay; the roster, who gets what, notes and room
       placements go. roster stays an array, as in 060. */
    { key: 'tacg_cards_v1', tool: '077', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !Array.isArray(v.roster)) return UNREADABLE;
      var r = result(shallow(v));
      took(r, 'names', v.roster.length, v.roster);
      took(r, 'accommodations given to students', Object.keys(isObj(v.assignments) ? v.assignments : {}).length);
      took(r, 'notes', size(v.notes));
      r.value.roster = []; r.value.assignments = {}; r.value.notes = {};
      if ('roomOf' in v) { took(r, 'room placements', size(v.roomOf)); r.value.roomOf = {}; }
      keeps(r, 'accommodation types', size(v.types));
      return keeps(r, 'rooms', size(v.rooms));
    } },

    /* 021 PE Stations: stations, the rotation's timing, the group names and
       the settings stay; the roster, members, scores, the bracket's entrants
       and the bracket go (bracket to null: an empty slots list throws). */
    { key: 'pe-tournament-stations', tool: '021', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !isObj(v.projects)) return UNREADABLE;
      var r = result(shallow(v)), names = 0, scores = 0, sample = [], n = 0, stations = 0;
      r.value.projects = {};
      Object.keys(v.projects).forEach(function (k) {
        var s = v.projects[k];
        if (!isObj(s)) { r.value.projects[k] = s; return; }
        var q = shallow(s);
        var list = typeof s.roster === 'string' ? s.roster.split(/[\n,]/).filter(function (x) { return x.trim(); }) : [];
        names += list.length; sample = sample.concat(list);
        Object.keys(isObj(s.scores) ? s.scores : {}).forEach(function (st) { scores += size(s.scores[st]); });
        stations += size(s.stations);
        q.roster = '';
        q.groups = arr(s.groups).map(function (g) { if (!isObj(g)) return g; var h = shallow(g); h.members = ''; return h; });
        q.scores = {}; q.bracketEntrants = ''; q.bracket = null;
        if (isObj(s.rotation)) { q.rotation = shallow(s.rotation); q.rotation.count = 0; q.rotation.running = false; q.rotation.paused = false; q.rotation.endAt = null; q.rotation.remainingMs = null; }
        r.value.projects[k] = q;
        n++;
      });
      took(r, 'names', names, sample); took(r, 'scores', scores);
      keeps(r, 'tournaments', n);
      return keeps(r, 'stations', stations);
    } },

    /* 017 Gallery Walk: a set's printing, feedback and timer settings stay;
       its entries (student or group work, reactions, classmates' notes) and
       walking groups go, to newSet()'s values. The code cannot tell a
       station prompt from a student's piece, so every entry goes. */
    { key: 'gallery-walk-qr-sets', tool: '017', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !isObj(v.sets)) return UNREADABLE;
      var r = result(shallow(v)), entries = 0, groups = 0, sample = [], n = 0;
      r.value.sets = {};
      Object.keys(v.sets).forEach(function (k) {
        var s = v.sets[k];
        if (!isObj(s)) { r.value.sets[k] = s; return; }
        var q = shallow(s);
        var real = arr(s.entries).filter(function (e) { return isObj(e) && (String(e.name || '').trim() || String(e.value || '').trim()); });
        entries += real.length; sample = sample.concat(real.map(function (e) { return e.name; }));
        groups += size(s.walkGroups);
        q.entries = [{ name: '', value: '' }]; q.walkGroups = [];
        if (isObj(s.timer)) { q.timer = shallow(s.timer); q.timer.count = 0; q.timer.running = false; q.timer.paused = false; q.timer.endAt = null; q.timer.remainingMs = null; }
        r.value.sets[k] = q;
        n++;
      });
      took(r, 'entries', entries, sample); took(r, 'walking groups', groups);
      return keeps(r, 'gallery walks with their settings', n);
    } },

    /* 043 Field Trip: the letter (destination, dates, cost, purpose, the
       translations) stays; the student, the batch of names, who returned
       what, the chaperones and who goes with whom go, to defaultState()'s
       values. The lead chaperone's name and phone are a parent's details
       for that trip, so they go too. */
    { prefix: 'gvb-field-trip:data:', tool: '043', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v));
      var batch = lines(v.batchNames);
      took(r, 'names', batch.length + (String(v.studentName || '').trim() ? 1 : 0), [v.studentName].concat(batch));
      took(r, 'returned slips and payments', size(v.collected));
      took(r, 'chaperones', size(v.chaperones) + (String(v.chaperoneName || '').trim() ? 1 : 0));
      r.value.studentName = ''; r.value.batchNames = ''; r.value.collected = {}; r.value.chaperones = []; r.value.chaperoneAssignments = {};
      if ('chaperoneName' in v) r.value.chaperoneName = '';
      if ('chaperonePhone' in v) r.value.chaperonePhone = '';
      return keeps(r, 'the letter', 1);
    } },

    /* 084 Socratic Seminar: the question, the text and the date stay; the
       roster, speaking order, fishbowl groups and tallies go (blankDoc()). */
    { prefix: 'socsem:data:', tool: '084', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v));
      var rs = arr(v.roster);
      took(r, 'names', rs.length, rs.map(function (x) { return x && x.name; }));
      took(r, 'tallies', size(v.tallies));
      r.value.roster = []; r.value.order = []; r.value.groups = {}; r.value.tallies = {};
      return keeps(r, 'the seminar question and text', 1);
    } },

    /* 020 Brackets: a bracket is its entrants. There is no empty bracket the
       page can draw (renderSingle reads slots[0]), so the document goes and
       the index drops it; the archive has it. */
    { prefix: 'gvb-bracket:data:', tool: '020', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      return took(result(null), 'brackets with their entrants and results', 1, [v.name]);
    } },

    /* 037 Grade Distribution: the cut-offs, bucket width and comparisons
       stay; the pasted names and scores go ('' — a missing text shows
       "undefined" in the box and is saved that way). */
    { prefix: 'gvb-grade-distribution:data:', tool: '037', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v));
      took(r, 'lines of names and scores', lines(v.text).length);
      r.value.text = '';
      return keeps(r, 'grade cut-offs', 1);
    } },

    /* 085 Parent Templates: the last values typed into the blanks. The
       teacher's name, the class, the date and the assignment stay; the
       student, the parent and the grade go. */
    { key: 'pct:lastValues', tool: '085', kind: 'reduce', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result(shallow(v)), n = 0, sample = [];
      ['Student', 'Parent/Guardian', 'Grade'].forEach(function (f) {
        if (f in v) { if (String(v[f] || '').trim()) { n++; sample.push(v[f]); } delete r.value[f]; }
      });
      took(r, 'a student’s and a parent’s name', n, sample);
      return keeps(r, 'your name and class', Object.keys(r.value).length);
    } },

    /* 048 Art Portfolio Labels: each portfolio's name, title and label
       settings stay; its entries (the artist, the work, its photo) go, to
       one blank row. Never an empty list: load() then migrates the legacy
       key back. */
    { key: 'apl_portfolios_v1', tool: '048', kind: 'reduce', reduce: function (v) {
      if (!isObj(v) || !Array.isArray(v.list) || !v.list.length) return UNREADABLE;
      var r = result(shallow(v)), n = 0, sample = [];
      r.value.list = v.list.map(function (p, i) {
        if (!isObj(p)) return p;
        var q = shallow(p);
        var real = arr(p.entries).filter(function (e) { return isObj(e) && (e.artist || e.title || e.description || e.image); });
        n += real.length; sample = sample.concat(real.map(function (e) { return e.artist; }));
        q.entries = [{ id: 'e-rollover-' + i, title: '', artist: '', description: '', image: '' }];
        return q;
      });
      took(r, 'labels for students’ work', n, sample);
      return keeps(r, 'portfolios with their settings', v.list.length);
    } },

    /* ── Kind C: the roster shells. Class names, periods and subjects stay;
       every list empties. Last among the keys, so no tool is looking at an
       empty class with last year's records still under it. ── */
    { key: 'np_rosters', tool: '006', kind: 'roster', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), n = 0, sample = [];
      Object.keys(v).forEach(function (k) {
        n += size(v[k]); sample = sample.concat(arr(v[k]).map(nameOf));
        r.value[k] = [];
      });
      took(r, 'students on class rosters', n, sample);
      return keeps(r, 'class names', Object.keys(v).length);
    } },
    /* The shape 006's own rollover wrote until v303, when its button came
       here: meta's period and subject kept, term the new year, students
       and orphans emptied. An orphan left behind would hand next year's
       student of the same name last year's id. */
    { key: 'crh_students_v1', tool: '006', kind: 'roster', reduce: function (v, ctx) {
      if (!isObj(v) || !isObj(v.rosters)) return UNREADABLE;
      var r = result(shallow(v)), n = 0, sample = [];
      r.value.rosters = {};
      Object.keys(v.rosters).forEach(function (k) {
        var x = v.rosters[k];
        if (!isObj(x)) { r.value.rosters[k] = x; return; }
        var m = isObj(x.meta) ? x.meta : {};
        n += size(x.students) + size(x.orphans);
        sample = sample.concat(arr(x.students).map(nameOf));
        var meta = { period: m.period || '', subject: m.subject || '', term: ctx.nextTerm ? ctx.nextTerm.slice(0, 20) : (m.term || '') };
        ['created', 'updated'].forEach(function (f) { if (f in m) meta[f] = m[f]; });
        r.value.rosters[k] = { meta: meta, students: [], orphans: [] };
      });
      took(r, 'student records (preferred names, pronunciations)', n, sample);
      return keeps(r, 'classes with their period and subject', Object.keys(v.rosters).length);
    } },
    /* 006's archive of past rosters. Devon, 2026-10-07: the year archive
       file is the only copy, so the years and the per-class snapshots go. */
    { key: 'crh_archive_v1', tool: '006', kind: 'roster', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({ version: 1, rosters: [], years: [] });
      took(r, 'archived years', size(v.years), arr(v.years).map(function (y) { return y && y.label; }));
      return took(r, 'archived class rosters', size(v.rosters));
    } },
    { key: 'gvb-roleplay:roster', tool: '014', kind: 'roster', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      var r = result({}), n = 0, sample = [];
      Object.keys(v).forEach(function (k) { n += size(v[k]); sample = sample.concat(arr(v[k])); r.value[k] = []; });
      took(r, 'students on class lists', n, sample);
      return keeps(r, 'class names', Object.keys(v).length);
    } },

    /* ── Kind E: free text that may name a student. Asked only when this
       year's names are found in it, and then pre-set to Clear (Devon,
       2026-10-07); Clear takes out only the entries a name is found in. ── */
    { key: 'data-chart-builder-datasets', tool: '038', kind: 'ask', reduce: function (v, ctx) {
      if (!isObj(v)) return UNREADABLE;   // a stored null crashes 038 at boot: never write one
      var r = result({}), gone = [];
      Object.keys(v).forEach(function (k) { if (hit([k, v[k]], ctx)) gone.push(k); else r.value[k] = v[k]; });
      took(r, 'datasets naming a student', gone.length, gone);
      return keeps(r, 'other datasets', size(r.value));
    } },
    { key: 'subPlanBuilder.history.v1', tool: '044', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'past plans naming a student', 'other past plans', function (e) { return e && e.date; });
    } },
    { key: 'promptBuilderDraft_v2', tool: '029', kind: 'ask', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      return took(result(null), 'the unsaved draft', 1);   // 029's own Clear All removes the key
    } },
    { key: 'promptBuilderCustomPresets_v1', tool: '029', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'presets naming a student', 'other presets', function (e) { return e && e.name; });
    } },
    { key: 'promptBuilderHistory_v1', tool: '029', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'saved prompts naming a student', 'other saved prompts', function (e) { return e && String(e.text || '').slice(0, 40); });
    } },
    { key: 'gvb-sub-binder:today-lesson', tool: '045', kind: 'ask', raw: true, reduce: function () {
      return took(result(null), 'today’s lesson note', 1);
    } },
    { key: 'qr-code-generator-recent', tool: '016', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'recent codes naming a student', 'other recent codes', function (e) { return e && e.label; });
    } },
    { key: 'htcm:game', tool: '064', kind: 'ask', reduce: function (v) {
      if (!isObj(v)) return UNREADABLE;
      return took(result(null), 'the saved game and its team names', 1);   // HtcmGame.clear() removes the key
    } },
    { key: 'pct:custom', tool: '085', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'your templates naming a student', 'other templates of yours', function (e) { return e && e.title; });
    } },
    { key: 'np_prompts', tool: '007', kind: 'ask', reduce: function (v, ctx) {
      return filterList(v, ctx, 'prompts naming a student', 'other prompts', function (e) { return e; });
    } },
    { key: 'gvb-number-talks:myBank', tool: '024', kind: 'ask', reduce: function (v, ctx) {
      if (!Array.isArray(v)) return UNREADABLE;
      var r = result([]), n = 0;
      v.forEach(function (e) {
        if (isObj(e) && hit(e.note, ctx)) { var q = shallow(e); q.note = ''; r.value.push(q); n++; }
        else r.value.push(e);
      });
      took(r, 'notes naming a student', n);
      return keeps(r, 'number talks', v.length);
    } }
  ];
  RULE_LIST.forEach(Object.freeze);
  Object.freeze(RULE_LIST);

  function ruleFor(key) {
    var best = null;
    RULE_LIST.forEach(function (r) {
      if (r.key === key) best = r;
    });
    if (best) return best;
    RULE_LIST.forEach(function (r) {
      if (r.prefix && key.indexOf(r.prefix) === 0 && key.length > r.prefix.length && (!best || r.prefix.length > best.prefix.length)) best = r;
    });
    return best;
  }

  /* The order step 5 runs in: reductions, deletions, the roster keys, the
     photos, the share slot, the indexes (which name documents and so go
     last, when every document that will exist does). */
  var PHASES = { reduce: 1, ask: 1, 'delete': 2, roster: 3, index: 6 };
  var ROSTER_ORDER = ['np_rosters', 'crh_students_v1'];

  /**
   * One key, one rule. `text` is the stored string, `ctx` is
   * { names, nextTerm, choices, exists }. Returns
   * { action: 'delete' | 'write' | 'keep' | 'choose', after, removed, kept,
   *   hits, unreadable, choice }.
   */
  function reduceKey(rule, key, text, ctx) {
    var out = { action: 'keep', after: null, removed: [], kept: [], hits: [], unreadable: false, choice: null };
    if (!rule || rule.kind === 'keep') return out;
    if (rule.kind === 'delete') { out.action = 'delete'; out.removed = [{ what: rule.what || 'saved records', count: 1, sample: [] }]; return out; }
    var p = rule.raw ? { ok: true, v: String(text) } : parseJson(text);
    if (!p.ok) { out.unreadable = true; return out; }
    if (rule.kind === 'ask') {
      out.hits = scanValue(p.v, ctx.names);
      if (!out.hits.length) return out;
      var choice = (ctx.choices && ctx.choices[key]) || 'clear';   // Devon, 2026-10-07: a name found is pre-selected Clear
      out.choice = choice;
      if (choice !== 'clear') { out.action = 'choose'; return out; }
    }
    var r;
    try { r = rule.reduce(p.v, ctx, key); } catch (e) { r = UNREADABLE; }
    if (!r || r.unreadable) { out.unreadable = true; out.action = rule.kind === 'ask' ? 'choose' : 'keep'; return out; }
    out.removed = r.removed;
    out.kept = r.kept;
    if (r.value === null) { out.action = 'delete'; return out; }
    var after = rule.raw ? String(r.value) : JSON.stringify(r.value);
    if (after === (rule.raw ? String(text) : JSON.stringify(p.v))) { out.removed = []; return out; }
    out.action = 'write';
    out.after = after;
    return out;
  }

  /**
   * The clear, as one value: what the review table shows is what run() does.
   *   id        the run's id
   *   local     { key: string } as storage holds it now
   *   archive   { key: string } as the CHECKED archive holds it (the file's
   *             `data`; for a re-clear of a key a tab wrote back, the value
   *             now, which is the archive's by hash)
   *   opts      { studentKeys, names, choices, nextTerm, only,
   *               media: { seating: { ids, bytes } }, archiveMedia: [ids],
   *               share: bool }
   * Resolves to { id, items, media, share, problems, notes, totals }.
   *
   * A key is planned from what the archive holds. When storage still holds
   * exactly that, the item is the rule's reduction of it. When storage holds
   * the reduction already (a run that stopped half way), the item is 'done'.
   * Anything else was saved since the archive and is a problem: a plan with
   * problems does not run, because what it would remove is not in the file.
   */
  function plan(id, local, archive, opts) {
    opts = opts || {};
    local = local || {};
    archive = archive || {};
    var names = opts.names || rosterNames(archive);
    var ctx = { names: names, nextTerm: String(opts.nextTerm || ''), choices: opts.choices || {} };
    var student = {};
    (opts.studentKeys || []).forEach(function (k) { student[k] = 1; });
    var only = opts.only ? {} : null;
    if (only) opts.only.forEach(function (k) { only[k] = 1; });
    var problems = [], notes = [], items = [];

    var keys = Object.keys(local).filter(function (k) {
      if (only && !only[k]) return false;
      return student[k] || !!ruleFor(k);
    }).sort();

    function planned(k, rule, text, c) {
      var r = reduceKey(rule, k, text, c);
      return r;
    }

    var first = [], indexes = [];
    keys.forEach(function (k) {
      var rule = ruleFor(k);
      if (!rule && student[k]) {
        notes.push({ key: k, code: 'no-rule' });
        rule = { kind: 'delete', tool: '', what: 'saved records' };
      }
      if (!rule || rule.kind === 'keep') return;
      if (rule.kind === 'index') indexes.push([k, rule]); else first.push([k, rule]);
    });

    function one(pair, c) {
      var k = pair[0], rule = pair[1];
      var cur = String(local[k]);
      var item = { key: k, tool: rule.tool || '', kind: rule.kind, phase: PHASES[rule.kind] || 1, action: 'keep',
                   before: cur, beforeHash: null, after: null, removed: [], kept: [], hits: [], unreadable: false, choice: null };
      if (!(k in archive)) { problems.push({ key: k, code: 'not-archived' }); return item; }
      var arch = String(archive[k]);
      var r = planned(k, rule, arch, c);
      item.removed = r.removed; item.kept = r.kept; item.hits = r.hits; item.unreadable = r.unreadable; item.choice = r.choice;
      if (cur === arch) {
        item.action = r.action;
        item.after = r.after;
      } else if (r.action === 'write' && cur === r.after) {
        item.action = 'done';
      } else {
        problems.push({ key: k, code: 'changed-since' });
      }
      if (item.unreadable) notes.push({ key: k, code: 'unreadable' });
      return item;
    }

    first.forEach(function (pair) { items.push(one(pair, ctx)); });

    /* The indexes are planned against the storage the steps before them
       leave, so an entry is dropped only for a document that will be gone. */
    var post = {};
    Object.keys(local).forEach(function (k) { post[k] = local[k]; });
    items.forEach(function (it) {
      if (it.action === 'delete') delete post[it.key];
      else if (it.action === 'write') post[it.key] = it.after;
    });
    var ictx = { names: names, nextTerm: ctx.nextTerm, choices: ctx.choices,
                 exists: function (k) { return k in post; }, get: function (k) { return k in post ? post[k] : null; } };
    indexes.forEach(function (pair) { items.push(one(pair, ictx)); });

    items.sort(function (a, b) {
      if (a.phase !== b.phase) return a.phase - b.phase;
      if (a.phase === 3) {
        var ia = ROSTER_ORDER.indexOf(a.key), ib = ROSTER_ORDER.indexOf(b.key);
        ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib;
        if (ia !== ib) return ia - ib;
      }
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

    var media = [];
    var nowMedia = (opts.media && opts.media.seating) || { ids: [], bytes: 0 };
    if (nowMedia.ids.length) {
      var inArchive = {};
      (opts.archiveMedia || []).forEach(function (i) { inArchive[i] = 1; });
      var missing = nowMedia.ids.filter(function (i) { return !inArchive[i]; });
      if (missing.length) problems.push({ key: 'gvb-media:seating', code: 'not-archived' });
      media.push({ ns: 'seating', action: 'clear', count: nowMedia.ids.length, bytes: nowMedia.bytes || 0 });
    }
    var share = opts.share ? { action: 'delete' } : null;

    var hashes = items.map(function (it) { return hash(it.before); });
    return Promise.all(hashes).then(function (hs) {
      items.forEach(function (it, i) { it.beforeHash = hs[i]; });
      var totals = { write: 0, 'delete': 0, keep: 0, choose: 0, done: 0 };
      items.forEach(function (it) { totals[it.action] = (totals[it.action] || 0) + 1; });
      totals.media = media.reduce(function (n, m) { return n + m.count; }, 0);
      totals.share = share ? 1 : 0;
      return { id: id, items: items, media: media, share: share, problems: problems, notes: notes, totals: totals };
    });
  }

  /* The items run() carries out, and the other steps, in order. */
  function stepsOf(p) {
    var steps = [];
    p.items.forEach(function (it) { if (it.phase < 6 && (it.action === 'write' || it.action === 'delete')) steps.push({ item: it }); });
    (p.media || []).forEach(function (m) { if (m.action === 'clear') steps.push({ media: m.ns }); });
    if (p.share) steps.push({ share: true });
    p.items.forEach(function (it) { if (it.phase >= 6 && (it.action === 'write' || it.action === 'delete')) steps.push({ item: it }); });
    return steps;
  }

  /**
   * Carries out a plan. `io` is { storage, media, share }: `media.clear(ns)`
   * and `share.remove()` return promises of true when the thing is gone
   * (read back by the caller). Resolves to
   * { done, stale, failed, removed, receipt }:
   *  - stale: keys whose value is no longer the planned one; nothing written.
   *  - failed: the step storage refused or did not keep; the journal stays
   *    'clearing' with `done` counting what was carried out.
   * Every write and removal is read back, and the journal is written after
   * each, so the journal never claims a step the storage does not show.
   */
  function run(p, io) {
    var storage = io.storage;
    if (p.problems && p.problems.length) {
      return Promise.resolve({ done: false, stale: p.problems.map(function (x) { return x.key; }), failed: null, removed: 0 });
    }
    var steps = stepsOf(p);
    var local = steps.filter(function (s) { return s.item; }).map(function (s) { return s.item; });
    return Promise.all(local.map(function (it) {
      var v = null;
      try { v = storage.getItem(it.key); } catch (e) { v = null; }
      return v === null ? Promise.resolve(null) : hash(v);
    })).then(function (now) {
      var stale = local.filter(function (it, i) { return now[i] !== it.beforeHash; }).map(function (it) { return it.key; });
      if (stale.length) return { done: false, stale: stale, failed: null, removed: 0 };
      var prior = getRun(storage, p.id) || {};
      var cleared = {}, other = {};
      Object.keys(prior.cleared || {}).forEach(function (k) { cleared[k] = prior.cleared[k]; });
      Object.keys(prior.other || {}).forEach(function (k) { other[k] = prior.other[k]; });
      function count() { return Object.keys(cleared).length + Object.keys(other).length; }
      var already = p.items.filter(function (it) { return it.action === 'done'; }).length;
      var base = count();
      try {
        /* The keys the teacher chose to Keep: key names only, so a clear
           finished after an interruption honours the same choices. */
        var kept = p.items.filter(function (it) { return it.action === 'choose'; }).map(function (it) { return it.key; });
        recordRun(storage, { id: p.id, state: 'clearing', steps: Math.max(base, already) + steps.length,
                             done: Math.max(base, already), clearingAt: new Date().toISOString(),
                             keptByChoice: (prior.keptByChoice || []).concat(kept).filter(function (k, i, a) { return a.indexOf(k) === i; }).sort() });
      } catch (e) { return { done: false, stale: [], failed: JOURNAL_KEY, removed: 0 }; }
      var doneN = 0;
      var i = 0;
      function fail(what) { return { done: false, stale: [], failed: what, removed: doneN }; }
      function next() {
        if (i >= steps.length) return finish();
        var s = steps[i++];
        if (s.item) {
          var it = s.item;
          try {
            if (it.action === 'delete') {
              storage.removeItem(it.key);
              if (storage.getItem(it.key) !== null) throw new Error('kept');
            } else {
              storage.setItem(it.key, it.after);
              if (storage.getItem(it.key) !== it.after) throw new Error('not kept');
            }
            cleared[it.key] = it.beforeHash;
            recordRun(storage, { id: p.id, done: Math.max(count(), already), cleared: cleared });
            doneN++;
          } catch (e) { return Promise.resolve(fail(it.key)); }
          return next();
        }
        var tag = s.media ? 'media:' + s.media : 'share';
        var job = s.media ? (io.media ? io.media.clear(s.media) : Promise.resolve(false))
                          : (io.share ? io.share.remove() : Promise.resolve(false));
        return Promise.resolve(job).then(function (gone) {
          if (gone !== true) return fail(tag);
          try {
            other[tag] = true;
            recordRun(storage, { id: p.id, done: Math.max(count(), already), other: other });
            doneN++;
          } catch (e) { return fail(JOURNAL_KEY); }
          return next();
        }, function () { return fail(tag); });
      }
      function finish() {
        try {
          recordRun(storage, { id: p.id, state: 'done', finishedAt: new Date().toISOString(), cleared: cleared, other: other,
                               done: Math.max(count(), already) });
        } catch (e) { return fail(JOURNAL_KEY); }
        return { done: true, stale: [], failed: null, removed: doneN, receipt: receipt(p) };
      }
      return next();
    });
  }

  /* What the receipt says, by tool, in counts. No sample, so no name. */
  function receipt(p) {
    var byTool = {};
    p.items.forEach(function (it) {
      if (it.action !== 'write' && it.action !== 'delete' && it.action !== 'done') return;
      var t = byTool[it.tool || it.key] || (byTool[it.tool || it.key] = { keys: [], removed: {}, kept: {} });
      t.keys.push(it.key);
      it.removed.forEach(function (x) { t.removed[x.what] = (t.removed[x.what] || 0) + x.count; });
      it.kept.forEach(function (x) { t.kept[x.what] = (t.kept[x.what] || 0) + x.count; });
    });
    return {
      keys: p.items.filter(function (it) { return it.action === 'write' || it.action === 'delete' || it.action === 'done'; })
                   .map(function (it) { return it.key; }).sort(),
      byTool: byTool,
      media: (p.media || []).map(function (m) { return { ns: m.ns, count: m.count, bytes: m.bytes }; }),
      share: !!p.share,
      kept: p.items.filter(function (it) { return it.action === 'choose' || it.unreadable; }).map(function (it) { return it.key; }).sort()
    };
  }

  /** After a 'done' run: the cleared keys that hold exactly the cleared value again. */
  function writtenBack(storage) {
    var r = lastRun(storage);
    if (!r || r.state !== 'done' || !r.cleared) return Promise.resolve([]);
    var keys = Object.keys(r.cleared).sort();
    return Promise.all(keys.map(function (k) {
      var v = null;
      try { v = storage.getItem(k); } catch (e) { v = null; }
      return v === null ? Promise.resolve(null) : hash(v);
    })).then(function (hs) {
      return keys.filter(function (k, i) { return hs[i] !== null && hs[i] === r.cleared[k]; });
    });
  }

  /* ── the other tabs (design step 1) ──────────────────────────────────
     An open tool holds last year in memory and saves it back, so the page
     asks the service worker (sw.js, the CLIENTS message) which other windows
     of the site are open. `container` is navigator.serviceWorker. Resolves
     { seen: true, urls } when a worker answered, { seen: false } when there
     is none to ask (file://, a worker blocked, one from before v302 that
     does not know the message): the page cannot tell, and says so. */
  function otherTabs(container, opts) {
    var wait = (opts && opts.timeoutMs) || 2000;
    var Channel = (opts && opts.MessageChannel) || global.MessageChannel;
    var no = { seen: false, urls: [] };
    if (!container || typeof Channel !== 'function') return Promise.resolve(no);
    return new Promise(function (resolve) {
      var done = false, ch = null;
      /* Every way out closes the port and the timer: an open port is a
         listener nobody will ever call. */
      function finish(v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ch && ch.port1.close) ch.port1.close();
        resolve(v);
      }
      var timer = setTimeout(function () { finish(no); }, wait);
      var workerP = container.controller ? Promise.resolve(container.controller)
        : Promise.resolve(container.ready).then(function (reg) { return reg && reg.active; });
      workerP.then(function (worker) {
        if (!worker || done) return finish(no);
        ch = new Channel();
        ch.port1.onmessage = function (e) {
          var d = e && e.data;
          if (!d || d.type !== 'CLIENTS' || !Array.isArray(d.clients)) return;
          finish({ seen: true, urls: d.clients.map(function (c) { return String(c && c.url || ''); }).filter(Boolean) });
        };
        worker.postMessage({ type: 'CLIENTS' }, [ch.port2]);
      }, function () { finish(no); });
    });
  }

  /* The open windows by name: [{ title, count }], one row per page, in the
     order a teacher reads them. `root` is the site's base URL; `tools` the
     registry's rows. A page the registry does not name is shown by its path,
     so nothing open is ever left off the list. Query and hash are ignored. */
  function nameTabs(urls, root, tools) {
    var byPath = {};
    (tools || []).forEach(function (t) { if (t && t.file) byPath[safeDecode(t.file)] = t.title; });
    var rows = {}, order = [];
    (urls || []).forEach(function (u) {
      var rel = String(u).split('#')[0].split('?')[0];
      if (root && rel.indexOf(root) === 0) rel = rel.slice(root.length);
      rel = safeDecode(rel.replace(/^\/+/, ''));
      var title = byPath[rel] || (rel === '' || rel === 'index.html' ? 'The landing page' : rel);
      if (!rows[title]) { rows[title] = { title: title, count: 0 }; order.push(title); }
      rows[title].count++;
    });
    return order.sort().map(function (t) { return rows[t]; });
  }

  function safeDecode(s) {
    try { return decodeURI(s); } catch (e) { return s; }
  }

  global.BrRollover = {
    JOURNAL_KEY: JOURNAL_KEY,
    otherTabs: otherTabs,
    nameTabs: nameTabs,
    hash: hash,
    hashKind: hashKind,
    newId: newId,
    base64Bytes: base64Bytes,
    manifest: manifest,
    localManifest: localManifest,
    compareLocal: compareLocal,
    stamp: stamp,
    verify: verify,
    readJournal: readJournal,
    recordRun: recordRun,
    getRun: getRun,
    lastRun: lastRun,
    resume: resume,
    RULES: RULE_LIST,
    ruleFor: ruleFor,
    reduceKey: reduceKey,
    rosterNames: rosterNames,
    scanNames: scanNames,
    scanValue: scanValue,
    plan: plan,
    run: run,
    writtenBack: writtenBack
  };
})(typeof window !== 'undefined' ? window : globalThis);
