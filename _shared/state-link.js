/* state-link.js — encode/decode a tool's state into a URL query-string
   parameter, so pasting a link reopens that exact state elsewhere. No
   server: the whole payload rides inside the URL itself.

   Encoding: base64(encodeURIComponent(JSON)), via btoa(unescape(...)) so
   unicode text survives btoa's Latin1-only limitation. This is the same
   trick Tools/escape-room-builder/lock.html and escape-room-builder.html
   already use for QR-coded puzzle state — this just gives it one shared,
   tested home instead of copy-pasting it into every tool that wants the
   same capability.

   Plain global script (like bt-store.js, ct-store.js, etc.), not an ES
   module: about half this site's tools use `<script type="module">` and
   half use classic scripts, and a single file can't use both `export` and
   plain-script syntax without a parse error under one of the two. Loading
   this as `window.StateLink` works unchanged from either kind of caller —
   a module script just reads the global instead of `import`-ing it. */
(function (global) {
  'use strict';

  function encodeState(value) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
  }

  /** The inverse of encodeState(). Never throws — returns null on anything unparsable. */
  function decodeState(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch (e) {
      return null;
    }
  }

  /** Reads one query-string param by name (URLSearchParams wrapper, null if absent). */
  function getParam(name, search) {
    var params = new URLSearchParams(search || global.location.search);
    return params.has(name) ? params.get(name) : null;
  }

  /** Builds a full shareable URL: the current page (or opts.base) plus one encoded param. */
  function buildShareUrl(paramName, value, opts) {
    opts = opts || {};
    var url = new URL(opts.base || global.location.href);
    url.hash = '';
    url.searchParams.set(paramName, encodeState(value));
    return url.toString();
  }

  /**
   * Strips `paramName` out of the current URL without a reload or a new
   * history entry — call this right after consuming a shared-link param so
   * refreshing the page doesn't re-import the same state a second time.
   */
  function clearParam(paramName) {
    var url = new URL(global.location.href);
    if (!url.searchParams.has(paramName)) return;
    url.searchParams.delete(paramName);
    global.history.replaceState(null, '', url.toString());
  }

  /**
   * A minimal "copy shareable link" control: one button, rendered into
   * `container`, that builds a link from `opts.getState()` and copies it to
   * the clipboard (falling back to handing the raw URL to `onMessage` if the
   * clipboard API is unavailable or denied — e.g. `file://`, or no HTTPS).
   * `opts.onMessage(text)` reports back so the page can show it however it
   * likes, same convention as gvb-save.js's mountSaveBar.
   */
  function mountShareControl(container, opts) {
    opts = opts || {};
    var paramName = opts.param || 'state';
    var getState = opts.getState || function () { return null; };
    var onMessage = opts.onMessage || function () {};
    var label = opts.label || 'Copy shareable link';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.addEventListener('click', function () {
      var state = getState();
      if (state === null || state === undefined) {
        onMessage("There's nothing to share yet.");
        return;
      }
      var url = buildShareUrl(paramName, state, { base: opts.base });
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        global.navigator.clipboard.writeText(url).then(function () {
          onMessage(opts.successMessage || 'Link copied — paste it anywhere to open this exact board.');
        }, function () {
          onMessage(url);
        });
      } else {
        onMessage(url);
      }
    });
    container.appendChild(btn);

    return { node: btn, destroy: function () { btn.remove(); } };
  }

  global.StateLink = {
    encodeState: encodeState,
    decodeState: decodeState,
    getParam: getParam,
    buildShareUrl: buildShareUrl,
    clearParam: clearParam,
    mountShareControl: mountShareControl
  };
})(window);
