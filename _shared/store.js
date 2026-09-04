/* store.js — the site's one localStorage primitive: a versioned envelope, a
   migrate hook, an onChange that also fires in the tab that wrote, and a
   quota failure that is never silent.

   Why this exists. Before it, ~234 distinct localStorage key literals across
   86 tools each hand-rolled the same three guards, and got them subtly
   different. Three failures repeat across the site:

     1. A `{"v":1, ...}` convention that nothing dispatches on. 080's
        readBoards() parses the payload and never looks at `v`; 006 does look,
        and silently DISCARDS a blob whose version is not 1. Neither is a
        migration mechanism.
     2. Quota errors swallowed. 019, 071, 080 and 036 all catch the write and
        carry on with a comment. Only 035 detects the error at all, and it does
        so with two non-identical predicates (one checks NS_ERROR_DOM_QUOTA_
        REACHED, the other checks code 1014; neither checks both). A teacher
        whose storage is full loses work and is told nothing.
     3. Cross-tab `storage` listeners (six of them) that never fire for the tab
        that made the change, so a tool with two views of the same key updates
        one of them.

   The rule this file exists to enforce: a quota error may never be silent. It
   is visible, it names the tool, and it points at Backup & Restore. There is
   deliberately no option to turn that off — only `configure({onQuota})` to
   render it in a tool's own house style instead of the default banner.

   THE MIGRATION CONTRACT. "How do unversioned legacy payloads get read without
   a flag day" is the whole reason this module was worth writing, so the answer
   is stated here rather than left to be inferred from the code:

     1. A stored string that parses to an object with a numeric `v` AND an own
        `data` property is a Store envelope. Its version is that `v`.
     2. ANYTHING ELSE on disk is legacy at version 0 — a bare array, a bare
        string or number, a plain {...} blob. One exception: a payload carrying
        a numeric `__v` is an assets/js/gvb-save.js save (that module stamps its
        version INTO the state rather than around it) and is read at that
        version, so the two modules can share a key without a conversion pass.
     3. `migrate(fromV, data)` runs only when fromV < the caller's version. It
        returns the upgraded data, or null to refuse. A caller that passes no
        `migrate` at all is saying it can only read its own current version, so
        an older payload is refused rather than guessed at — which means every
        tool adopting this module for an existing key MUST pass one, even if it
        is the identity function, or it will not see the data already on disk.
     4. A refusal — null, or a throw — makes get() return the caller's default.
        The unreadable payload is LEFT ON DISK, not overwritten: a tool that
        cannot read a teacher's data should not be the reason it is destroyed.
        The next successful set() replaces it. (Contrast 006, which discards.)
     5. A key's name never carries the schema version; the envelope does. That
        is already scv-store.js's stated rule, and 010 reads scv_calendar_v1 raw
        on the strength of it. No key this module touches is ever renamed.
     6. Every write stamps the current version, defaulting to 1 — unless the
        caller passes `raw: true`, which writes the bare value with no envelope
        at all. That exists for keys whose on-disk shape is a contract with
        other tools (np_rosters, crh_students_v1); see set()'s own comment. By
        rule 2 such a payload reads back as version 0, so its owner passes an
        identity `migrate` and nothing else about the contract changes.

   Plain global script, not an ES module, for the same reason state-link.js is:
   about half this site's tools use `<script type="module">` and half use
   classic scripts, and a single file cannot use both `export` and plain-script
   syntax without a parse error under one of them. A module caller reads
   window.Store instead of importing it.

   Not in scope, on purpose: _shared/a11y.js keeps reading and writing
   `gvb-a11y-prefs` directly. It has to load before every other shared script
   (it owns data-theme), so making it depend on this file would invert the load
   order every tool page already has. */
(function (global) {
  'use strict';

  var CHANGE_EVENT = 'gvb-store-change';
  var PROBE_KEY = '__gvb_store_probe__';

  var config = { toolName: '', onQuota: null };
  var memory = {};          // the fallback when storage is blocked outright
  var blocked = null;       // null = not probed yet
  var listeners = {};       // key -> [fn]
  var wired = false;
  var bannerEl = null;

  /* ---- storage access ------------------------------------------------- */

  /* Whether localStorage rejects writes outright — private mode, storage
     disabled, or a quota that is already full to the brim. Probed once: the
     answer does not change during a session, and the probe is a real write
     because merely reading `localStorage` succeeds in browsers that then throw
     on the first setItem. */
  function isBlocked() {
    if (blocked !== null) return blocked;
    try {
      global.localStorage.setItem(PROBE_KEY, '1');
      global.localStorage.removeItem(PROBE_KEY);
      blocked = false;
    } catch (e) {
      blocked = true;
    }
    return blocked;
  }

  function readRaw(key) {
    if (isBlocked()) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    try {
      return global.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /* The union of the two predicates 035 uses in its two different places, plus
     Firefox's name. Browsers disagree about which of these they set, and a
     check that misses one reports "some other error" for a full disk. */
  function isQuotaError(e) {
    if (!e) return false;
    return e.name === 'QuotaExceededError' ||
           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           e.code === 22 || e.code === 1014;
  }

  /* ---- the envelope --------------------------------------------------- */

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function isEnvelope(parsed) {
    return isPlainObject(parsed) &&
           typeof parsed.v === 'number' &&
           Object.prototype.hasOwnProperty.call(parsed, 'data');
  }

  /* Rules 1, 2 and the gvb-save exception, in one place. Returns
     {data, version} or null when there is nothing readable on disk. */
  function unwrap(raw) {
    if (raw === null || raw === undefined) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return null; }
    if (isEnvelope(parsed)) return { data: parsed.data, version: parsed.v };
    if (isPlainObject(parsed) && typeof parsed.__v === 'number') {
      return { data: parsed, version: parsed.__v };   // a gvb-save.js payload
    }
    return { data: parsed, version: 0 };              // legacy, by rule 2
  }

  /* ---- change notification -------------------------------------------- */

  function wire() {
    if (wired || !global.addEventListener) return;
    wired = true;
    global.addEventListener('storage', function (e) {
      if (!e || !e.key) return;                       // a cleared storage: no key
      fire(e.key, e.newValue);
    });
    global.addEventListener(CHANGE_EVENT, function (e) {
      var d = e && e.detail;
      if (d && d.key) fire(d.key, d.raw);
    });
  }

  function fire(key, raw) {
    var fns = listeners[key];
    if (!fns) return;
    var unwrapped = raw === null || raw === undefined ? null : unwrap(raw);
    for (var i = 0; i < fns.length; i++) {
      try {
        fns[i](unwrapped ? unwrapped.data : null, key);
      } catch (err) {
        /* one bad subscriber must not stop the others; the page's own error
           handler still sees it */
        if (global.console && global.console.error) global.console.error(err);
      }
    }
  }

  /* The same-tab half. The `storage` event deliberately does not fire in the
     tab that wrote, which is why all six hand-rolled listeners on this site
     miss their own writes. */
  function announce(key, raw) {
    if (!global.dispatchEvent || typeof global.CustomEvent !== 'function') {
      fire(key, raw);
      return;
    }
    global.dispatchEvent(new global.CustomEvent(CHANGE_EVENT, {
      detail: { key: key, raw: raw }
    }));
  }

  /* ---- the never-silent part ------------------------------------------ */

  function messageFor(kind) {
    var who = config.toolName ? config.toolName : 'This tool';
    if (kind === 'blocked') {
      return who + ' could not save: this browser is blocking storage for this ' +
        'site (often private browsing). Your work stays on screen but will be ' +
        'gone when you close the tab.';
    }
    return who + ' could not save: this browser’s storage for this site is ' +
      'full. Open Backup & Restore to export and clear what you no longer need, ' +
      'then try again — until you do, changes are not being kept.';
  }

  /* The default surface. Inline styles and its own element, so it cannot be
     caught by a page's `hidden`-loses-to-`display` rule or restyled by a
     tool's CSS, and needs nothing precached beyond this file. */
  function showBanner(text) {
    var doc = global.document;
    if (!doc || !doc.body) return;
    if (!bannerEl || !bannerEl.isConnected) {
      bannerEl = doc.createElement('div');
      bannerEl.setAttribute('role', 'alert');
      bannerEl.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
        'margin:0;padding:14px 18px;background:#7f1d1d;color:#fff;font:600 15px/1.45 ' +
        'system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:left;' +
        'box-shadow:0 -2px 12px rgba(0,0,0,.35)';
      doc.body.appendChild(bannerEl);
    }
    bannerEl.textContent = text;
  }

  function report(kind) {
    var text = messageFor(kind);
    if (typeof config.onQuota === 'function') {
      try {
        config.onQuota({ kind: kind, message: text, tool: config.toolName });
        return;
      } catch (e) {
        /* a tool whose own handler throws still gets the default banner --
           the one thing that must not happen here is silence */
      }
    }
    showBanner(text);
  }

  /* ---- public API ------------------------------------------------------ */

  /**
   * Reads `key`, applying the migration contract above. Never throws: anything
   * unreadable, unparsable or refused by `migrate` comes back as opts.default.
   */
  function get(key, opts) {
    opts = opts || {};
    var fallback = Object.prototype.hasOwnProperty.call(opts, 'default') ? opts.default : null;
    var unwrapped = unwrap(readRaw(key));
    if (!unwrapped) return fallback;

    var want = typeof opts.version === 'number' ? opts.version : 1;
    var data = unwrapped.data;
    if (unwrapped.version < want) {
      if (typeof opts.migrate !== 'function') return fallback;
      try {
        data = opts.migrate(unwrapped.version, data);
      } catch (e) {
        return fallback;                              // rule 4: leave it on disk
      }
      if (data === null || data === undefined) return fallback;
    }
    return data;
  }

  /**
   * Writes `{v, data}`. Returns {ok, quota, blocked, bytes, error} and, when
   * the write does not stick, says so on screen. There is no silent path.
   *
   * `opts.raw` writes the bare JSON of `value` with NO envelope, for the small
   * set of keys whose on-disk shape is a cross-tool contract other tools still
   * read with a plain JSON.parse — `np_rosters` (28 reader pages) and
   * `crh_students_v1` (read by _shared/student-details.js and 008). Enveloping
   * one of those would empty every reader's roster list at once, on a
   * teacher's machine, so it cannot happen before those readers move. Such a
   * payload is legacy version 0 by rule 2, so get() reads it back through an
   * identity `migrate` and the round trip is lossless. Everything else about
   * the write — the quota probe, the never-silent report, the same-tab
   * announce — is unchanged, which is the whole reason this is a flag here
   * rather than a hand-rolled setItem in the calling module.
   */
  function set(key, value, opts) {
    opts = opts || {};
    var version = typeof opts.version === 'number' ? opts.version : 1;
    var raw;
    try {
      raw = JSON.stringify(opts.raw ? value : { v: version, data: value });
    } catch (e) {
      return { ok: false, quota: false, blocked: false, bytes: 0, error: e };
    }
    var bytes = (raw.length + key.length) * 2;        // UTF-16, what browsers charge

    if (isBlocked()) {
      memory[key] = raw;
      report('blocked');
      announce(key, raw);
      return { ok: false, quota: false, blocked: true, bytes: bytes, error: null };
    }
    try {
      global.localStorage.setItem(key, raw);
    } catch (e) {
      memory[key] = raw;                              // keep the session usable
      report(isQuotaError(e) ? 'quota' : 'blocked');
      return { ok: false, quota: isQuotaError(e), blocked: false, bytes: bytes, error: e };
    }
    announce(key, raw);
    return { ok: true, quota: false, blocked: false, bytes: bytes, error: null };
  }

  /** Deletes `key` and notifies subscribers in this tab and the others. */
  function remove(key) {
    delete memory[key];
    if (!isBlocked()) {
      try { global.localStorage.removeItem(key); } catch (e) { /* nothing to undo */ }
    }
    announce(key, null);
  }

  /**
   * Calls `fn(value, key)` whenever `key` changes — in another tab (the
   * `storage` event) or in this one (a CustomEvent set/remove dispatch).
   * Returns the unsubscribe function.
   */
  function onChange(key, fn) {
    wire();
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return function () {
      var fns = listeners[key];
      if (!fns) return;
      var i = fns.indexOf(fn);
      if (i !== -1) fns.splice(i, 1);
    };
  }

  /**
   * {usage, quota, source} in bytes, or nulls when nothing can be measured.
   * Prefers navigator.storage.estimate(); falls back to walking localStorage,
   * which is the only number available in Safari and in older Firefox.
   */
  function estimate() {
    var nav = global.navigator;
    if (nav && nav.storage && typeof nav.storage.estimate === 'function') {
      return nav.storage.estimate().then(function (est) {
        return { usage: est.usage, quota: est.quota, source: 'navigator' };
      }, function () {
        return localEstimate();
      });
    }
    return Promise.resolve(localEstimate());
  }

  function localEstimate() {
    if (isBlocked()) return { usage: null, quota: null, source: 'blocked' };
    var total = 0;
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (k === null) continue;
        total += (k.length + (global.localStorage.getItem(k) || '').length) * 2;
      }
    } catch (e) {
      return { usage: null, quota: null, source: 'blocked' };
    }
    return { usage: total, quota: null, source: 'localStorage' };
  }

  /**
   * `toolName` is what the failure message names, so set it once per page.
   * `onQuota({kind, message, tool})` replaces the default banner with the
   * tool's own surface — it cannot suppress the message, only re-render it.
   */
  function configure(opts) {
    opts = opts || {};
    if (typeof opts.toolName === 'string') config.toolName = opts.toolName;
    if (typeof opts.onQuota === 'function' || opts.onQuota === null) config.onQuota = opts.onQuota;
  }

  global.Store = {
    get: get,
    set: set,
    remove: remove,
    onChange: onChange,
    estimate: estimate,
    configure: configure,
    isBlocked: isBlocked,
    CHANGE_EVENT: CHANGE_EVENT,
    /* exposed for the test suite and for a tool that needs to classify a
       payload it did not write */
    _unwrap: unwrap,
    _isQuotaError: isQuotaError
  };
})(window);
