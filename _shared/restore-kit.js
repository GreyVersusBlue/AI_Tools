/* restore-kit.js — reading a Backup & Restore file and putting it back, for
   009 and for any tool that wants a "restore just this tool" card (Path 4 P5).

   Until v298 all of this lived in 009's inline script: the envelope reader,
   the record-by-record diff behind the preview ("2 replaced, 1 added, 1 here
   only, would be removed") and the three ways of applying a file. A teacher
   who broke one tool had to open 009, reason about every tool's rows and
   untick the rest. The logic moved here unchanged so a tool can host the same
   preview over its own keys; 009 calls the same functions, so there is one
   restore and not two that drift.

   WHAT A TOOL'S RESTORE TOUCHES. Only keys `ToolRegistry.lookupKey()` gives to
   that tool's slug (its `keys` and `prefixes`, legacy ones included, transient
   probes never). A key another tool owns is left alone even when this tool
   reads it: the Name Picker's np_rosters is not Hall Pass's to restore. Nothing
   is ever deleted: Replace writes the file's value over a key the file holds,
   and a key only on this computer stays (009 has always done the same). The
   preview says which named records inside a key Replace would drop. IndexedDB
   (pictures, recordings) is not restored here; the card says to use 009.

   A locked file (009's passphrase option) is opened with `BrCrypto` from
   _shared/backup-crypto.js. 009 loads it; a tool page does not need to, since
   the card fetches it from beside this file the first time a locked file is
   picked (it is precached, so that works offline).

   window.RestoreKit = {
     FORMAT_VERSION,
     read(parsed)                         → { envelope, flags } | { error }
     recordDiff(mode, key, oldRaw, newRaw, wholeName)
     combineValue(mode, oldRaw, newRaw)   → the string to write
     groups(env, mode, opts)              → { [id]: group }, 009's preview model
     apply(env, keys, mode, storage)      → { restored, merged, skipped, failed }
     ownedBy(slug)                        → key => bool, through ToolRegistry
     loadCrypto()                         → promise of BrCrypto
     mount(el, { tool, onRestored })      → the card; returns { el, load(text, size) }
   }
   `mode` is 'replace' | 'fill' | 'merge' everywhere.
*/
(function (global) {
  'use strict';

  var FORMAT_VERSION = 2;
  var KIND_LABEL = { student: 'Student data', settings: 'Settings & templates' };
  var script = document.currentScript;
  var BASE = script && script.src ? script.src.replace(/[^/]*$/, '') : '../_shared/';

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /**
   * Reads a backup file of any version 009 has ever written and hands back one
   * shape. Version 1 files — everything downloaded before 2026-08 — have no
   * `format` stamp and no `indexedDB` section; they are recognised by their
   * `source` string and their `data` object, and they restore unchanged.
   * Returns `{ envelope, flags }`, where flags are things worth telling the
   * teacher before they press a button.
   */
  function read(parsed) {
    var flags = [];
    if (!parsed || typeof parsed !== 'object') return { error: 'That file isn’t a backup — it doesn’t contain an object at all.' };
    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
      return { error: 'That doesn’t look like a backup from this page — no "data" section found.' };
    }
    var version = Number(parsed.formatVersion) || 0;
    if (!version) {
      if (typeof parsed.source === 'string' && parsed.source.indexOf('AsPerMyLessonPlan') !== -1) version = 1;
      else { version = 1; flags.push({ text: 'This file has no version stamp and does not name this site as its source. It may be from somewhere else — check the list below carefully before restoring.', bad: true }); }
    }
    if (version > FORMAT_VERSION) {
      flags.push({ text: 'This backup was written by a newer version of this page (format ' + version + ', this page reads ' + FORMAT_VERSION + '). Anything it contains that this page does not understand will be skipped.', bad: false });
    }
    var keys = Object.keys(parsed.data);
    if (!keys.length) return { error: 'That backup is empty — nothing to restore.' };

    var nonString = keys.filter(function (k) { return typeof parsed.data[k] !== 'string'; });
    if (nonString.length) {
      flags.push({ text: nonString.length + ' item' + (nonString.length === 1 ? '' : 's') + ' in this file are not stored as text and will be skipped: ' + nonString.slice(0, 5).join(', ') + '.', bad: true });
    }
    if (parsed.meta && typeof parsed.meta.itemCount === 'number' && parsed.meta.itemCount !== keys.length) {
      flags.push({ text: 'This file says it holds ' + parsed.meta.itemCount + ' items but contains ' + keys.length + '. It may have been truncated or edited.', bad: true });
    }
    return {
      envelope: {
        formatVersion: version,
        exportedAt: parsed.exportedAt || null,
        label: typeof parsed.label === 'string' ? parsed.label : '',
        data: parsed.data,
        indexedDB: (parsed.indexedDB && typeof parsed.indexedDB === 'object') ? parsed.indexedDB : null,
        meta: parsed.meta || null
      },
      flags: flags
    };
  }

  /** `{name: record}`, possibly wrapped one level deeper under `.sets`. Returns
      `{ container, records, wrapped }` so a merge can put the result back in
      the shape it came out of. */
  function parseNamedMap(raw) {
    var v;
    try { v = JSON.parse(raw); } catch (e) { return null; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    if (v.sets && typeof v.sets === 'object' && !Array.isArray(v.sets)) {
      return { container: v, records: v.sets, wrapped: true };
    }
    /* A flat object of primitives is a settings blob, not a set of named
       records — merging those name by name would produce nonsense. */
    var vals = Object.keys(v).map(function (k) { return v[k]; });
    if (!vals.length || !vals.every(function (x) { return x && typeof x === 'object'; })) return null;
    return { container: v, records: v, wrapped: false };
  }

  /**
   * How restoring one key under `mode` would land, per named record inside it.
   * Returns { replaced, added, untouched, lost, granular } where the first four
   * are arrays of record names (or `wholeName` alone when the key is not a set
   * of named records — a settings blob is all-or-nothing, and pretending
   * otherwise is how you corrupt one).
   */
  function recordDiff(mode, key, oldRaw, newRaw, wholeName) {
    var res = { replaced: [], added: [], untouched: [], lost: [], granular: true };

    // `<prefix>:data:<name>` — the whole key is exactly one named record.
    var prefixMatch = /^(.*?:data:)(.+)$/.exec(key);
    if (prefixMatch) {
      var pName = prefixMatch[2];
      if (oldRaw === null) res.added.push(pName);
      else if (oldRaw === newRaw || mode === 'fill') res.untouched.push(pName);
      else res.replaced.push(pName);
      return res;
    }

    var whole = wholeName || key;
    if (oldRaw === null) { res.added.push(whole); res.granular = false; return res; }

    var oldMap = parseNamedMap(oldRaw);
    var newMap = parseNamedMap(newRaw);
    if (!oldMap || !newMap) {
      res.granular = false;
      if (oldRaw === newRaw || mode === 'fill') res.untouched.push(whole);
      else res.replaced.push(whole);
      return res;
    }

    Object.keys(newMap.records).forEach(function (n) {
      if (!has(oldMap.records, n)) { res.added.push(n); return; }
      var same = JSON.stringify(oldMap.records[n]) === JSON.stringify(newMap.records[n]);
      if (same || mode === 'fill') res.untouched.push(n);
      else res.replaced.push(n);
    });
    Object.keys(oldMap.records).forEach(function (n) {
      if (has(newMap.records, n)) return;
      // Replace writes the file's value over the whole key, so anything only
      // on this computer goes with it. Fill and Combine both keep it.
      if (mode === 'replace') res.lost.push(n); else res.untouched.push(n);
    });
    return res;
  }

  /**
   * Combine one key's old and new value under the chosen mode.
   *
   * `fill` and `merge` differ only in who wins a name that exists on both
   * sides, and both fall back to a whole-key decision when the value is not a
   * set of named records — there is no meaningful way to half-merge a settings
   * blob, and pretending otherwise would quietly corrupt it.
   */
  function combineValue(mode, oldRaw, newRaw) {
    if (mode === 'replace' || oldRaw === null) return newRaw;
    var oldMap = parseNamedMap(oldRaw);
    var newMap = parseNamedMap(newRaw);
    if (!oldMap || !newMap) return mode === 'fill' ? oldRaw : newRaw;

    var merged = {};
    Object.keys(oldMap.records).forEach(function (n) { merged[n] = oldMap.records[n]; });
    Object.keys(newMap.records).forEach(function (n) {
      if (merged[n] === undefined || mode === 'merge') merged[n] = newMap.records[n];
    });
    if (newMap.wrapped) {
      var container = {};
      Object.keys(newMap.container).forEach(function (k) { if (k !== 'sets') container[k] = newMap.container[k]; });
      /* `current` names a record that may not exist on this machine; keep this
         computer's pointer unless it points at nothing. */
      if (oldMap.wrapped && oldMap.container.current && merged[oldMap.container.current]) {
        container.current = oldMap.container.current;
      }
      container.sets = merged;
      return JSON.stringify(container);
    }
    return JSON.stringify(merged);
  }

  function uniq(list) {
    return list.filter(function (n, i) { return list.indexOf(n) === i; });
  }

  function storageGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  /**
   * The preview model for a loaded backup under `mode`: one group per label and
   * kind, each with its keys and the record names it would replace, add, leave
   * and drop. `opts.filter(key)` narrows the keys (a tool's own), `opts.storage`
   * defaults to localStorage, and `opts.labelFor` / `opts.classifyKey` default
   * to the registry's.
   */
  function groups(env, mode, opts) {
    opts = opts || {};
    var storage = opts.storage || global.localStorage;
    var labelFor = opts.labelFor || function (k) { return global.ToolRegistry.labelFor(k); };
    var classify = opts.classifyKey || function (k) { return global.ToolRegistry.classifyKey(k); };
    var out = {};
    Object.keys(env.data).forEach(function (key) {
      if (typeof env.data[key] !== 'string') return;
      if (opts.filter && !opts.filter(key)) return;
      var label = labelFor(key) || 'Other saved data';
      var kind = classify(key);
      var id = label + ' ' + kind;
      var d = recordDiff(mode, key, storageGet(storage, key), env.data[key], labelFor(key) || key);
      if (!out[id]) out[id] = { id: id, label: label, kind: kind, count: 0, keys: [],
                                replaced: [], added: [], untouched: [], lost: [], granular: true };
      var g = out[id];
      g.count++;
      g.keys.push(key);
      g.replaced = g.replaced.concat(d.replaced);
      g.added = g.added.concat(d.added);
      g.untouched = g.untouched.concat(d.untouched);
      g.lost = g.lost.concat(d.lost);
      if (!d.granular) g.granular = false;
    });
    Object.keys(out).forEach(function (id) {
      var g = out[id];
      g.replaced = uniq(g.replaced); g.added = uniq(g.added);
      g.untouched = uniq(g.untouched); g.lost = uniq(g.lost);
    });
    return out;
  }

  /** Writes `keys` from the envelope under `mode`. Never deletes a key. */
  function apply(env, keys, mode, storage) {
    storage = storage || global.localStorage;
    var res = { restored: 0, merged: 0, skipped: 0, failed: [] };
    keys.forEach(function (key) {
      var incoming = env.data[key];
      if (typeof incoming !== 'string') { res.skipped++; return; }
      var existing = storageGet(storage, key);
      var value = combineValue(mode, existing, incoming);
      if (existing !== null && value === existing) { res.skipped++; return; }
      if (existing !== null && value !== incoming) res.merged++;
      try { storage.setItem(key, value); res.restored++; }
      catch (e) { res.failed.push(key); }
    });
    return res;
  }

  /** A test for "this key is `slug`'s to restore": owned through the registry,
      never a transient probe. */
  function ownedBy(slug) {
    return function (key) {
      var hit = global.ToolRegistry.lookupKey(key);
      return !!(hit && hit.tool.slug === slug && !hit.entry.transient);
    };
  }

  var cryptoPromise = null;
  function loadCrypto() {
    if (global.BrCrypto) return Promise.resolve(global.BrCrypto);
    if (cryptoPromise) return cryptoPromise;
    cryptoPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = BASE + 'backup-crypto.js';
      s.onload = function () { if (global.BrCrypto) resolve(global.BrCrypto); else reject(new Error('no BrCrypto')); };
      s.onerror = function () { cryptoPromise = null; reject(new Error('could not load backup-crypto.js')); };
      document.head.appendChild(s);
    });
    return cryptoPromise;
  }

  /* ══ The card ═══════════════════════════════════════════════════════════ */

  var CSS = '.rk [hidden]{display:none!important}' +
    '.rk .rk-hint{font-size:.85rem;color:var(--muted);margin:.2rem 0 .6rem}' +
    '.rk .rk-modes{border:0;margin:.6rem 0;padding:0}' +
    '.rk .rk-modes legend{font-weight:700;font-size:.9rem;margin-bottom:.3rem;padding:0}' +
    '.rk .rk-modes label{display:flex;gap:.4rem;align-items:flex-start;font-size:.85rem;margin:.25rem 0}' +
    '.rk ul{list-style:none;padding:0;margin:.4rem 0}' +
    '.rk li{font-size:.85rem;margin:.3rem 0}' +
    '.rk li label{display:flex;gap:.4rem;align-items:flex-start}' +
    '.rk .rk-warn{color:var(--err);font-weight:700}' +
    '.rk .rk-new{color:var(--good);font-weight:700}' +
    '.rk .rk-row{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}' +
    '.rk .rk-status{font-size:.85rem;margin-top:.5rem}' +
    '.rk .rk-status.error{color:var(--err)}' +
    '.rk .rk-status.good{color:var(--good)}';

  function injectCss() {
    if (document.getElementById('restore-kit-css')) return;
    var st = document.createElement('style');
    st.id = 'restore-kit-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'className') el.className = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function quoted(names, cap) {
    var shown = names.slice(0, cap || 6);
    var more = names.length - shown.length;
    return shown.map(function (n) { return '“' + n + '”'; }).join(', ') + (more > 0 ? ', +' + more + ' more' : '');
  }

  var MODES = [
    { v: 'replace', b: 'Replace', d: ' — the file wins. What is here now under the same name is overwritten.' },
    { v: 'fill', b: 'Add only what is missing', d: ' — keeps everything here as it is and brings in only what is not here yet.' },
    { v: 'merge', b: 'Combine, file wins on a clash', d: ' — keeps what is only here, adds what is only in the file, takes the file’s copy where both have the same name.' }
  ];

  var mounts = 0;

  /**
   * Puts a "Restore from a backup" card for one tool into `el`. The file is
   * read, unlocked if it is locked, cut down to `opts.tool`'s own keys and
   * shown as the same per-record preview 009 shows, with the same three modes.
   * Nothing is written before Restore is pressed. After a restore the page is
   * reloaded so the tool reads what was written, unless `opts.onRestored`
   * is given, which is then called with the result instead.
   */
  function mount(el, opts) {
    opts = opts || {};
    var tool = global.ToolRegistry.bySlug(opts.tool);
    if (!tool) throw new Error('RestoreKit: no tool with slug "' + opts.tool + '"');
    injectCss();
    var n = ++mounts;
    var owned = ownedBy(tool.slug);
    var name = tool.backupLabel || tool.title;

    var file = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Backup file to restore ' + name + ' from' });
    var pass = h('input', { type: 'password', id: 'rkPass' + n, autocomplete: 'current-password' });
    var unlockBtn = h('button', { type: 'submit', text: 'Open the file' });
    var unlock = h('form', { className: 'rk-unlock', hidden: '' }, [
      h('p', { className: 'rk-hint', text: 'This backup is protected with a passphrase. Type it to see what the file holds for this tool.' }),
      h('label', { for: 'rkPass' + n, text: 'Passphrase' }), pass,
      h('div', { className: 'rk-row' }, [unlockBtn])
    ]);
    var summary = h('p', { className: 'rk-summary' });
    var modes = h('fieldset', { className: 'rk-modes' }, [h('legend', { text: 'How should it be applied?' })]);
    MODES.forEach(function (m, i) {
      var radio = h('input', { type: 'radio', name: 'rkMode' + n, value: m.v });
      if (i === 0) radio.checked = true;
      modes.appendChild(h('label', {}, [radio, h('span', {}, [h('b', { text: m.b }), m.d])]));
    });
    var list = h('ul', { className: 'rk-list' });
    var restoreBtn = h('button', { type: 'button', className: 'rk-restore', text: 'Restore this tool' });
    var cancelBtn = h('button', { type: 'button', className: 'secondary rk-cancel', text: 'Cancel' });
    var preview = h('div', { className: 'rk-preview', hidden: '' }, [
      summary, modes, list, h('div', { className: 'rk-row' }, [restoreBtn, cancelBtn])
    ]);
    var status = h('div', { className: 'rk-status', role: 'status' });

    var root = h('div', { className: 'rk' }, [
      h('p', { className: 'rk-hint', text: 'Bring back only ' + name + '’s data from a file Backup & Restore downloaded. You will see what changes before anything is written; other tools’ data in the file is left alone.' }),
      file, unlock, preview, status
    ]);
    el.appendChild(root);

    var pending = null, locked = null, lastGroups = {};

    function say(kind, text) { status.className = 'rk-status' + (kind ? ' ' + kind : ''); status.textContent = text || ''; }
    function mode() { var c = modes.querySelector('input:checked'); return c ? c.value : 'replace'; }
    function reset() { pending = null; locked = null; lastGroups = {}; unlock.hidden = true; preview.hidden = true; }

    function render() {
      if (!pending) return;
      var wasUnchecked = {};
      list.querySelectorAll('input').forEach(function (cb) { if (!cb.checked) wasUnchecked[cb.dataset.id] = true; });
      lastGroups = groups(pending.env, mode(), { filter: owned });
      var tot = { replaced: 0, added: 0, untouched: 0, lost: 0 };
      Object.keys(lastGroups).forEach(function (id) {
        var g = lastGroups[id];
        tot.replaced += g.replaced.length; tot.added += g.added.length;
        tot.untouched += g.untouched.length; tot.lost += g.lost.length;
      });
      var when = pending.env.exportedAt ? ' from ' + new Date(pending.env.exportedAt).toLocaleString() : '';
      summary.textContent = '';
      summary.appendChild(document.createTextNode('This backup' + when + ' holds ' + pending.ownCount + ' saved item' +
        (pending.ownCount === 1 ? '' : 's') + ' for ' + name + '. Restoring it this way: '));
      summary.appendChild(h('span', { className: 'rk-warn', text: tot.replaced + ' replaced' }));
      summary.appendChild(document.createTextNode(', '));
      summary.appendChild(h('span', { className: 'rk-new', text: tot.added + ' added' }));
      summary.appendChild(document.createTextNode(', ' + tot.untouched + ' untouched.'));
      if (tot.lost) {
        summary.appendChild(document.createTextNode(' '));
        summary.appendChild(h('span', { className: 'rk-warn', text: tot.lost + ' record' + (tot.lost === 1 ? '' : 's') +
          ' that exist only on this computer would be removed' }));
        summary.appendChild(document.createTextNode(' — pick one of the other two options to keep them.'));
      }
      if (pending.otherCount) {
        summary.appendChild(document.createTextNode(' The file’s other ' + pending.otherCount + ' item' +
          (pending.otherCount === 1 ? '' : 's') + ' belong to other tools and are left alone.'));
      }
      if (pending.env.indexedDB && Object.keys(pending.env.indexedDB).length) {
        summary.appendChild(document.createTextNode(' Pictures and recordings in the file are restored from Backup & Restore, not here.'));
      }
      list.textContent = '';
      Object.keys(lastGroups).sort().forEach(function (id) {
        var g = lastGroups[id];
        var cb = h('input', { type: 'checkbox', 'data-id': id });
        cb.checked = !wasUnchecked[id];
        var span = h('span', {}, [KIND_LABEL[g.kind] + ' — ']);
        var bits = [];
        if (g.replaced.length) bits.push([h('span', { className: 'rk-warn', text: g.replaced.length + ' replaced' }), g.granular ? ': ' + quoted(g.replaced) : '']);
        if (g.added.length) bits.push([h('span', { className: 'rk-new', text: g.added.length + ' added' }), g.granular ? ': ' + quoted(g.added) : '']);
        if (g.untouched.length) bits.push([g.untouched.length + ' untouched']);
        if (g.lost.length) bits.push([h('span', { className: 'rk-warn', text: g.lost.length + ' here only, would be removed' }), g.granular ? ': ' + quoted(g.lost) : '']);
        if (!bits.length) bits.push(['nothing would change']);
        bits.forEach(function (b, i) {
          if (i) span.appendChild(document.createTextNode(' · '));
          b.forEach(function (x) { if (x) span.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
        });
        list.appendChild(h('li', {}, [h('label', {}, [cb, span])]));
      });
    }

    function load(text, byteSize) {
      reset();
      say('', '');
      var parsed;
      try { parsed = JSON.parse(text); }
      catch (e) { return { error: 'That file isn’t valid JSON — pick a backup downloaded from Backup & Restore.' }; }
      if (parsed && typeof parsed === 'object' && parsed.encrypted && typeof parsed.ciphertext === 'string') {
        locked = { parsed: parsed, byteSize: byteSize };
        unlock.hidden = false;
        pass.value = '';
        pass.focus();
        return { ok: true, locked: true };
      }
      var r = read(parsed);
      if (r.error) return { error: r.error };
      var keys = Object.keys(r.envelope.data).filter(function (k) { return typeof r.envelope.data[k] === 'string'; });
      var own = keys.filter(owned);
      if (!own.length) return { error: 'This backup holds nothing from ' + name + '. Nothing was changed.' };
      pending = { env: r.envelope, ownCount: own.length, otherCount: keys.length - own.length };
      render();
      preview.hidden = false;
      return { ok: true, envelope: r.envelope };
    }

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      reset(); say('', '');
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = load(reader.result, f.size);
        if (res.error) { say('error', res.error); file.value = ''; }
      };
      reader.onerror = function () { say('error', 'Couldn’t read that file. Try again.'); };
      reader.readAsText(f);
    });

    unlock.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!locked) return;
      var lf = locked;
      unlockBtn.disabled = true;
      say('', 'Unlocking…');
      loadCrypto().then(function (BrCrypto) {
        return BrCrypto.decrypt(lf.parsed, pass.value).then(function (text) {
          pass.value = '';
          var res = load(text, lf.byteSize);
          if (res.error) say('error', res.error);
          else say('good', 'Unlocked. Review what changes, then Restore.');
        }, function (err) {
          say('error', err && err.code === 'unsupported'
            ? 'This file is locked in a way this page does not understand. It may come from a newer version of the site.'
            : 'That passphrase does not open this file — or the file was damaged. Check the passphrase and try again.');
          pass.select();
        });
      }, function () {
        say('error', 'The unlocking code could not be loaded. Open Backup & Restore to restore a locked file.');
      }).then(function () { unlockBtn.disabled = false; });
    });

    modes.addEventListener('change', render);

    cancelBtn.addEventListener('click', function () { reset(); file.value = ''; say('', ''); });

    restoreBtn.addEventListener('click', function () {
      if (!pending) return;
      var keys = [];
      list.querySelectorAll('input:checked').forEach(function (cb) {
        if (lastGroups[cb.dataset.id]) keys = keys.concat(lastGroups[cb.dataset.id].keys);
      });
      if (!keys.length) { say('error', 'Check at least one row above before restoring.'); return; }
      var res = apply(pending.env, keys.filter(owned), mode());
      reset(); file.value = '';
      var text = 'Restored ' + res.restored + ' item' + (res.restored === 1 ? '' : 's') +
        (res.merged ? ', ' + res.merged + ' combined with what was already here' : '') +
        (res.skipped ? ', ' + res.skipped + ' left as they were' : '') + '.';
      if (res.failed.length) { say('error', text + ' ' + res.failed.length + ' could not be written — storage may be full.'); return; }
      say('good', text);
      if (opts.onRestored) opts.onRestored(res);
      else if (res.restored) setTimeout(function () { global.location.reload(); }, 600);
    });

    return { el: root, load: load };
  }

  global.RestoreKit = {
    FORMAT_VERSION: FORMAT_VERSION,
    KIND_LABEL: KIND_LABEL,
    read: read,
    parseNamedMap: parseNamedMap,
    recordDiff: recordDiff,
    combineValue: combineValue,
    groups: groups,
    apply: apply,
    ownedBy: ownedBy,
    loadCrypto: loadCrypto,
    mount: mount
  };
})(window);
