/* student-flags.js — the flags on the shared student record (Path 3 P5): the
   two marks a teacher sets on a student in Class Roster Hub (006) and a tool
   may honour. Publishes window.StudentFlags. Pure: nothing here touches
   storage except read(), which takes a localStorage-shaped object, so the
   Node suite (Tools/roster/test/student-flags.test.mjs) drives all of it.

   THE FLAGS, a fixed set
     absent   "Absent today". Stored as the day it was set ('2026-10-21', the
              teacher's local date) and true only on that day, so it clears
              itself overnight and nobody has to remember to untick it.
     noCall   "Do not cold call". Stored as true; stays until it is cleared.
   A tool that honours them: 007 Name Picker leaves an absent student off the
   board and leaves a do-not-cold-call student on it, dimmed and labelled,
   where no pick can land. Both are a teacher's own marks on their own
   computer. There is no free-text note here on purpose: an accommodation
   note is the most sensitive thing this site could hold, and what it may say
   is a question for Devon (BACKLOG, Path 3 P5).

   WHAT IS STORED
     key 'crh_flags_v1', bare JSON (no Store envelope, like crh_students_v1):
       { version: 1, flags: { <student id>: { absent?: 'YYYY-MM-DD', noCall?: true } } }
   Keyed by the stable id Class Roster Hub mints in crh_students_v1, not by
   name, so a rename keeps the flags and so the record's own shape is not
   touched: crh_students_v1 is rebuilt as {id, name, preferred, say} in about
   ten places in 006 and in _shared/roster.js, and a flag kept there would be
   dropped by whichever one was missed. A student with no flag has no entry.
   A student on two rosters has an id on each, so a flag is per class.

   WHERE IT GOES AND DOES NOT
   - Never in a share link, a roster export (CSV, workbook, print) or 006's
     device-to-device handoff: none of them read this key.
   - In a 009 backup, as every registered key is, because the file is the
     teacher's own. Marked student data in _shared/tool-registry.js, so the
     year rollover deletes it whole (Tools/backup-restore/br-rollover.js).
   - 006 shows how many are set and has "Clear all flags", the wipe.

   Never throws on what it reads: a missing, truncated or hand-edited key is
   no flags. An entry it cannot read is dropped and the rest kept. */
(function (global) {
  'use strict';

  var KEY = 'crh_flags_v1';
  var VERSION = 1;
  var MAX_ID = 64;          // ids roster.js mints are ~16 characters
  var MAX_ENTRIES = 4000;   // 60 rosters of 400 is 24,000 students; few carry a flag
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  var KINDS = [
    { id: 'absent', label: 'Absent today', short: 'Absent',
      describe: 'marked absent for today only; it clears itself tomorrow' },
    { id: 'noCall', label: 'Do not cold call', short: 'No cold call',
      describe: 'never chosen by a random pick until the flag is cleared' }
  ];
  var KIND_IDS = KINDS.map(function (k) { return k.id; });

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function goodId(id) { return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID; }

  /** The teacher's local date as 'YYYY-MM-DD', the form `absent` is stored in. */
  function dayKey(date) {
    var d = date && typeof date.getFullYear === 'function' ? date : new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function empty() { return { version: VERSION, flags: {} }; }

  /** One entry, cleaned: only the two flags, each in its one stored form. */
  function cleanEntry(e) {
    if (!isObj(e)) return null;
    var out = {};
    if (typeof e.absent === 'string' && DAY_RE.test(e.absent)) out.absent = e.absent;
    if (e.noCall === true) out.noCall = true;
    return Object.keys(out).length ? out : null;
  }

  /** Stored text (or an already-parsed value) to a clean document. */
  function parse(raw) {
    var v = raw;
    if (typeof raw === 'string') {
      try { v = JSON.parse(raw); } catch (e) { return empty(); }
    }
    var doc = empty();
    if (!isObj(v) || !isObj(v.flags)) return doc;
    var n = 0;
    for (var id in v.flags) {
      if (!own(v.flags, id) || !goodId(id)) continue;
      var e = cleanEntry(v.flags[id]);
      if (!e) continue;
      doc.flags[id] = e;
      if (++n >= MAX_ENTRIES) break;
    }
    return doc;
  }

  /** `parse` of what `storage` holds under KEY; no flags if it cannot be read. */
  function read(storage) {
    var raw = null;
    try { raw = storage && storage.getItem ? storage.getItem(KEY) : null; }
    catch (e) { return empty(); }
    return parse(raw);
  }

  /** Which flags hold for `id` on `today`: { absent, noCall }, both booleans. */
  function get(doc, id, today) {
    var e = doc && isObj(doc.flags) && goodId(id) && own(doc.flags, id) ? doc.flags[id] : null;
    var t = today || dayKey();
    return { absent: !!(e && e.absent === t), noCall: !!(e && e.noCall === true) };
  }

  /** True when any flag holds for `id` on `today`. */
  function any(doc, id, today) {
    var f = get(doc, id, today);
    return f.absent || f.noCall;
  }

  /**
   * A new document with one flag turned on or off. Never changes `doc`.
   * An unknown kind or a bad id gives an unchanged copy. Turning `absent` on
   * stamps `today`; an entry left with no flag is removed.
   */
  function set(doc, id, kind, on, today) {
    var next = parse(doc);
    if (!goodId(id) || KIND_IDS.indexOf(kind) === -1) return next;
    var e = own(next.flags, id) ? next.flags[id] : {};
    if (kind === 'absent') {
      if (on) e.absent = today || dayKey(); else delete e.absent;
    } else {
      if (on) e.noCall = true; else delete e.noCall;
    }
    if (Object.keys(e).length) {
      if (!own(next.flags, id) && Object.keys(next.flags).length >= MAX_ENTRIES) return next;
      next.flags[id] = e;
    } else {
      delete next.flags[id];
    }
    return next;
  }

  /**
   * Drop what no longer means anything: an `absent` from an earlier day, and,
   * when `liveIds` is given (an array or object of every id still on a
   * roster), the entry of a student who is on none. Returns { doc, changed }.
   */
  function prune(doc, today, liveIds) {
    var src = parse(doc), next = empty(), changed = false;
    var t = today || dayKey();
    var live = null;
    if (Array.isArray(liveIds)) {
      live = {};
      liveIds.forEach(function (id) { if (goodId(id)) live[id] = true; });
    } else if (isObj(liveIds)) {
      live = liveIds;
    }
    Object.keys(src.flags).forEach(function (id) {
      if (live && !own(live, id)) { changed = true; return; }
      var e = src.flags[id], out = {};
      if (e.absent) { if (e.absent === t) out.absent = e.absent; else changed = true; }
      if (e.noCall) out.noCall = true;
      if (Object.keys(out).length) next.flags[id] = out; else changed = true;
    });
    if (doc && isObj(doc) && isObj(doc.flags)) {
      // An entry parse() dropped (unreadable) is a change too.
      if (Object.keys(doc.flags).length !== Object.keys(src.flags).length) changed = true;
    } else if (doc != null) {
      changed = true;
    }
    return { doc: next, changed: changed };
  }

  /** How many hold on `today`, among `ids` if given: { absent, noCall, students }. */
  function counts(doc, today, ids) {
    var d = parse(doc), t = today || dayKey(), out = { absent: 0, noCall: 0, students: 0 };
    var list = Array.isArray(ids) ? ids : Object.keys(d.flags);
    var seen = {};
    list.forEach(function (id) {
      if (!goodId(id) || seen[id]) return;
      seen[id] = true;
      var f = get(d, id, t);
      if (f.absent) out.absent++;
      if (f.noCall) out.noCall++;
      if (f.absent || f.noCall) out.students++;
    });
    return out;
  }

  /** The words a page shows for the flags that hold, in KINDS order. */
  function labels(flags, which) {
    var key = which === 'short' ? 'short' : 'label';
    return KINDS.filter(function (k) { return flags && flags[k.id]; }).map(function (k) { return k[key]; });
  }

  global.StudentFlags = {
    KEY: KEY,
    VERSION: VERSION,
    KINDS: KINDS,
    MAX_ENTRIES: MAX_ENTRIES,
    dayKey: dayKey,
    empty: empty,
    parse: parse,
    read: read,
    get: get,
    any: any,
    set: set,
    prune: prune,
    counts: counts,
    labels: labels
  };
})(typeof window !== 'undefined' ? window : globalThis);
