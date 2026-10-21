/* br-rollover.js — the year rollover's archive, its check, and the journal
   that makes an interrupted clear visible (Path 3 P6, increment 1).

   The design is BACKLOG.md, Path 3, the P6 bullet. This file is the part of
   it that has to exist before anything is cleared:

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
     planClear(local, keys, manifest)
                                the items a clear will remove, each with the
                                hash the ARCHIVE holds for it. A key the
                                archive does not hold, or holds a different
                                value of, is a problem and the plan cannot run.
     run(plan, io)              removes the items one at a time, every removal
                                read back and recorded in the journal before
                                the next, after checking that nothing changed
                                since the plan. A failure leaves the journal
                                at 'clearing' with the count done.
     resume(storage)            the last run, when it was left at 'archived'
                                or 'clearing'; null otherwise.
     writtenBack(storage)       after a 'done' run, the cleared keys that are
                                back with exactly the value that was cleared
                                (a tab that stayed open saved last year again).

   Storage it owns: one key, `br_rollover_v1`, `{ v: 1, runs: [...] }`, the
   last three runs. It holds no name and no value: key names, counts, dates,
   and hashes of what was removed. 009 treats it as internal, like
   `br_last_backup_at`, so it is in no backup and never cleared.

   What this increment clears is still what 009 cleared before it — every key
   ToolRegistry.classifyKey() calls student, whole. The reducers that keep the
   setup inside those keys (the design's kinds B to F) are the next increment;
   `plan`'s items already carry an `action` so they can be added without
   changing `run`'s contract. Pure apart from `run`, which writes only through
   the storage it is handed, so the Node suite drives all of it. */
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
             checkedAt: r.checkedAt || null, doneSteps: r.done || 0, totalSteps: r.steps || 0, startedAt: r.startedAt };
  }

  /* ---------- the clear ---------- */

  /**
   * `local` is { key: value } as storage holds it now, `keys` the keys to
   * clear, `manifest` the checked archive's. Resolves to { id, items,
   * problems }. An item is { key, action: 'delete', beforeHash }, where
   * beforeHash is the ARCHIVE's hash: run() removes a key only while it still
   * holds exactly what the archive holds. A key the archive lacks, or holds a
   * different value of, is a problem, and a plan with problems does not run.
   */
  function planClear(id, local, keys, m) {
    var problems = [];
    var items = [];
    var uniq = {};
    (keys || []).forEach(function (k) { uniq[k] = 1; });
    var list = Object.keys(uniq).sort();
    return Promise.all(list.map(function (k) { return k in local ? hash(String(local[k])) : Promise.resolve(null); })).then(function (hs) {
      list.forEach(function (k, i) {
        if (hs[i] === null) return;
        var a = m && m.local && m.local[k];
        if (!a) { problems.push({ key: k, code: 'not-archived' }); return; }
        if (a[1] !== hs[i] || a[0] !== String(local[k]).length) { problems.push({ key: k, code: 'changed-since' }); return; }
        items.push({ key: k, action: 'delete', beforeHash: a[1] });
      });
      return { id: id, items: items, problems: problems };
    });
  }

  /**
   * Carries out a plan. `io` is { storage }. Resolves to
   * { done, stale, failed, removed, receipt }:
   *  - stale: keys whose value is no longer the planned one; nothing written.
   *  - failed: the key whose removal storage refused or did not keep; the
   *    journal stays 'clearing' with `done` counting what was removed.
   * Each removal is read back, and the journal is written after each one, so
   * the journal never claims a step the storage does not show.
   */
  function run(plan, io) {
    var storage = io.storage;
    if (plan.problems && plan.problems.length) {
      return Promise.resolve({ done: false, stale: plan.problems.map(function (p) { return p.key; }), failed: null, removed: 0 });
    }
    var items = plan.items.slice();
    return Promise.all(items.map(function (it) {
      var v = null;
      try { v = storage.getItem(it.key); } catch (e) { v = null; }
      return v === null ? Promise.resolve(null) : hash(v);
    })).then(function (now) {
      var stale = items.filter(function (it, i) { return now[i] !== null && now[i] !== it.beforeHash; }).map(function (it) { return it.key; });
      if (stale.length) return { done: false, stale: stale, failed: null, removed: 0 };
      var prior = getRun(storage, plan.id) || {};
      var cleared = {};
      Object.keys(prior.cleared || {}).forEach(function (k) { cleared[k] = prior.cleared[k]; });
      var done = 0;
      try {
        recordRun(storage, { id: plan.id, state: 'clearing', steps: Object.keys(cleared).length + items.length,
                             done: Object.keys(cleared).length, clearingAt: new Date().toISOString() });
      } catch (e) { return { done: false, stale: [], failed: JOURNAL_KEY, removed: 0 }; }
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        try {
          storage.removeItem(it.key);
          if (storage.getItem(it.key) !== null) throw new Error('kept');
          cleared[it.key] = it.beforeHash;
          recordRun(storage, { id: plan.id, done: Object.keys(cleared).length, cleared: cleared });
          done++;
        } catch (e) {
          return { done: false, stale: [], failed: it.key, removed: done };
        }
      }
      try {
        recordRun(storage, { id: plan.id, state: 'done', finishedAt: new Date().toISOString(), cleared: cleared,
                             done: Object.keys(cleared).length });
      } catch (e) { return { done: false, stale: [], failed: JOURNAL_KEY, removed: done }; }
      return { done: true, stale: [], failed: null, removed: done, receipt: { keys: Object.keys(cleared).sort() } };
    });
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

  global.BrRollover = {
    JOURNAL_KEY: JOURNAL_KEY,
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
    planClear: planClear,
    run: run,
    writtenBack: writtenBack
  };
})(typeof window !== 'undefined' ? window : globalThis);
