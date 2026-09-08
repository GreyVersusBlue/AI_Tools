/* state-link.js — encode/decode a tool's state into a URL query-string
   parameter, so pasting a link reopens that exact state elsewhere. No
   server: the whole payload rides inside the URL itself.

   Encoding: base64(encodeURIComponent(JSON)), via btoa(unescape(...)) so
   unicode text survives btoa's Latin1-only limitation. This is the same
   trick Tools/escape-room-builder/lock.html and 019-escape-room-builder.html
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

  /* mountShareControl() lived here and is gone (Path 6 P2's third increment).
     It was a "copy shareable link" button this module built itself, and 003,
     005, 006 and 020 were its four call sites; all four open the share sheet
     now — copy link, QR code with a measured payload budget, download .json,
     and the system share where there is one.

     It was retired rather than kept as a thin wrapper over Share.mount(),
     which was the other option on the table, for three reasons worth
     recording because the wrapper looks cheaper than it is:

     - A wrapper would give state-link.js a runtime dependency on share.js,
       qr-draw.js and the vendored encoder, none of which it can require. The
       dependency already runs the other way — share.js throws at mount when
       state-link.js is absent — and inverting it would mean the lower module
       degrading silently when the upper one is not on the page. There is no
       good behaviour for that case: falling back to copy-link means the same
       call quietly does two different things on two pages.
     - The sheet wants a button that is already in the page: with a label, a
       class, a title, a position in the toolbar and an id a suite can find.
       Every one of the fourteen adopters has one. A control that appends its
       own bare <button> to a container cannot express any of that.
     - `npm run check:adoption` counts a page's own src/href references, so a
       page reaching the sheet only through state-link.js would not count as
       a share.js adopter and the header's number would be wrong. */

  global.StateLink = {
    encodeState: encodeState,
    decodeState: decodeState,
    getParam: getParam,
    buildShareUrl: buildShareUrl,
    clearParam: clearParam
  };
})(window);
