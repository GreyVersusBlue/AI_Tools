/* binder-stale.js — has the printed emergency binder gone stale? (Path 10 P3).
   Publishes BinderStale. Pure: every function takes the storage object and the time as
   arguments; nothing here reads the clock or the page, and only record() writes.

   WHAT IS STORED. When 090 Packet Builder prints the Emergency binder it calls record():
     gvb-packet:evergreen.v1 = { v: 1, at: 'ISO time', sums: { <watched key>: <fingerprint> } }
   a fingerprint (FNV-1a over the key's raw text) of each source key at that moment, never the
   data itself. So the record holds no name and no standing detail, and the landing page and
   Command Center can show the reminder without reading anything about a student.

   HOW IT GOES STALE (check()). In this order:
     none      nothing is saved in any watched key and the binder was never printed: say nothing
     never     something is saved but the binder was never printed
     changed   a watched key's text is not what it was when the binder was printed (a September
               plan notices an October room change: 044 stamps its standing details, and any edit
               moves the fingerprint)
     old       printed MAX_DAYS or more days ago (a binder in a drawer for a whole term)
     fresh     none of those

   WATCHED are the keys of the Emergency binder's date-independent sections, except `crh_students_v1`
   (it only supplies preferred names and moves on every student note), and
   Tools/packet-builder/test/binder-stale.test.mjs holds the list to the providers' own keys. */
(function (root) {
  'use strict';

  var KEY = 'gvb-packet:evergreen.v1';
  var MAX_DAYS = 180;
  var WATCHED = ['subPlanBuilder.standingDetails.v1', 'hall-pass-log-sections', 'np_rosters'];
  var PAGE = 'Tools/090-packet-builder.html?preset=emergency';

  function fingerprint(text) {
    var h = 0x811c9dc5;
    var s = String(text);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function raw(storage, k) {
    try { var v = storage.getItem(k); return typeof v === 'string' ? v : ''; } catch (e) { return ''; }
  }

  function parse(text) {
    var r;
    try { r = JSON.parse(text); } catch (e) { return null; }
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.v !== 1) return null;
    if (typeof r.at !== 'string' || isNaN(new Date(r.at).getTime())) return null;
    var sums = {};
    if (r.sums && typeof r.sums === 'object' && !Array.isArray(r.sums)) {
      WATCHED.forEach(function (k) { if (typeof r.sums[k] === 'string') sums[k] = r.sums[k]; });
    }
    return { v: 1, at: r.at, sums: sums };
  }

  /* The record to store for a print made at nowISO. A page writes it itself (090 does, so the key
     has a literal write site for check:registry); record() is the same with the write. */
  function entry(storage, nowISO) {
    var sums = {};
    WATCHED.forEach(function (k) { sums[k] = fingerprint(raw(storage, k)); });
    return { v: 1, at: nowISO, sums: sums };
  }

  function record(storage, nowISO) {
    var rec = entry(storage, nowISO);
    try { storage.setItem('gvb-packet:evergreen.v1', JSON.stringify(rec)); return rec; } catch (e) { return null; }
  }

  function check(storage, nowISO) {
    var held = WATCHED.filter(function (k) { return raw(storage, k) !== ''; });
    var rec = parse(raw(storage, KEY));
    if (!rec) return { state: held.length ? 'never' : 'none', changed: [], days: null, at: null };
    var changed = WATCHED.filter(function (k) { return fingerprint(raw(storage, k)) !== (rec.sums[k] === undefined ? fingerprint('') : rec.sums[k]); });
    var days = Math.floor((new Date(nowISO).getTime() - new Date(rec.at).getTime()) / 86400000);
    if (isNaN(days) || days < 0) days = 0;
    var state = changed.length ? 'changed' : days >= MAX_DAYS ? 'old' : 'fresh';
    return { state: state, changed: changed, days: days, at: rec.at };
  }

  function message(res) {
    if (res.state === 'never') return 'Your emergency binder has never been printed. Print it.';
    if (res.state === 'changed') return 'Your emergency details changed after you printed the binder. Print it again.';
    if (res.state === 'old') return 'Your emergency binder was printed ' + res.days + ' days ago. Print it again.';
    return '';
  }

  /* Show or hide a link the page already has; the link's target is PAGE under `base`. */
  function mount(el, storage, nowISO, base) {
    if (!el) return null;
    var res = check(storage, nowISO);
    var text = message(res);
    if (!text) { el.hidden = true; return res; }
    el.textContent = text;
    el.href = (base || '') + PAGE;
    el.hidden = false;
    return res;
  }

  root.BinderStale = {
    KEY: KEY, MAX_DAYS: MAX_DAYS, WATCHED: WATCHED, PAGE: PAGE,
    fingerprint: fingerprint, parse: parse, entry: entry, record: record, check: check, message: message, mount: mount
  };
})(typeof window !== 'undefined' ? window : globalThis);
