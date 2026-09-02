// sw-register.js — register the service worker, and ASK before a new version
// takes over the page.
//
// This file was five lines until now. It grew because of what sw.js used to do:
// skipWaiting() at install plus clients.claim() at activate meant a deploy took
// effect inside an already-open tab. A teacher three minutes into a timer, or
// mid-way through a projected activity, could have the page's assets replaced
// underneath them — no notice, no way back, and nothing visible until it went
// wrong. sw.js no longer calls skipWaiting(); this file offers the update
// instead, and posts SKIP_WAITING only when the teacher accepts.
//
// THE SUPPRESSION RULE. The bar is not shown while either is true:
//   - the page is fullscreen (document.fullscreenElement) — the projector case,
//     and it covers ten tools without one of them changing a line;
//   - the page has declared itself busy (window.TOOL_BUSY === true).
// Suppression is NOT a dismissal. The waiting worker stays waiting and the
// offer comes back on the next load. A tool that sets TOOL_BUSY should clear
// it, but forgetting to fails in the safe direction: the teacher keeps the
// version they already had.
//
// Everything here degrades to the old behaviour if anything is missing: no
// service worker support, a file:// page (the offline copy), blocked storage,
// or a browser that never fires the events. In each case the page simply does
// not offer an update, which is what it did before this file existed.

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  // Resolved from this script's own URL, so a tool page (one directory down)
  // and the landing page both find the worker at the site root. Unchanged.
  var swUrl;
  try {
    swUrl = new URL('../sw.js', document.currentScript.src).href;
  } catch (e) {
    return;
  }

  /* ── the reload guard ───────────────────────────────────────────────────
     controllerchange fires whenever the page's controller changes, and there
     are three quite different reasons it can:

       a) the very first worker on this origin claiming a page that had no
          controller. Nothing about the page is stale, so reloading here is a
          spurious flash on a teacher's first ever visit. Do not reload.
       b) the teacher accepted our offer. We asked for this, so reload —
          unconditionally, with no rate limit to get in the way.
       c) something else took over: another tab accepted, or a worker is
          churning. Reload, but not in a tight loop.

     Only (c) wants rate limiting, and conflating it with (b) is a real bug:
     the first version of this file rate-limited everything on a timestamp,
     which meant a teacher accepting two updates a few seconds apart got the
     second one applied to the worker but never to the page — left on old
     assets under a new controller. The suite's "two updates in one session"
     check exists for exactly that. */
  var RELOAD_KEY = 'gvb-sw-last-reload';
  var RELOAD_WINDOW_MS = 10000;
  var reloading = false;
  var accepted = false;                                   // (b)
  var hadController = !!navigator.serviceWorker.controller; // distinguishes (a)

  function reloadOnce() {
    if (reloading) return;

    // (a) first claim on a page that was never controlled — nothing is stale.
    if (!hadController && !accepted) {
      hadController = true;
      return;
    }

    // (c) unsolicited: rate-limit so a churning controller cannot spin the
    // page. A timestamp expires, unlike a flag, so a later genuine change
    // still gets through. (b) skips this entirely — we asked for it.
    if (!accepted) {
      var now = Date.now();
      try {
        var last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
        if (last && now - last < RELOAD_WINDOW_MS) return;
        sessionStorage.setItem(RELOAD_KEY, String(now));
      } catch (e) {
        // Storage blocked (private mode, a locked-down profile). The in-page
        // boolean still stops the common double, and reloading is better than
        // leaving the page on assets its controller is not serving.
      }
    }

    reloading = true;
    location.reload();
  }

  /* ── the bar ────────────────────────────────────────────────────────────
     Styles are injected rather than added to a11y.css because only 79 of the
     86 tools load that file, and this needs to look the same on all 85 that
     load this one. Colours match a11y.css's palette literally (#2A6DB0 accent,
     #16222E text), which is what that file uses too. */

  var barEl = null;
  var dismissed = false;

  function busy() {
    try {
      if (document.fullscreenElement) return true;
      if (window.TOOL_BUSY === true) return true;
    } catch (e) {}
    return false;
  }

  function injectStyle() {
    if (document.getElementById('gvb-sw-style')) return;
    var st = document.createElement('style');
    st.id = 'gvb-sw-style';
    st.textContent =
      '#gvb-sw-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;' +
      'z-index:2147483000;display:flex;align-items:center;gap:10px;' +
      'max-width:calc(100vw - 32px);padding:10px 12px 10px 16px;' +
      'border:1px solid #C9D2DA;border-radius:10px;background:#fff;color:#16222E;' +
      'box-shadow:0 6px 24px rgba(22,34,46,.18);' +
      'font:14px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '#gvb-sw-bar p{margin:0}' +
      '#gvb-sw-bar button{font:inherit;cursor:pointer;border-radius:6px;padding:6px 10px}' +
      '#gvb-sw-reload{background:#2A6DB0;border:1px solid #2A6DB0;color:#fff}' +
      '#gvb-sw-reload:hover{background:#215888}' +
      '#gvb-sw-reload[disabled]{opacity:.6;cursor:default}' +
      '#gvb-sw-dismiss{background:transparent;border:1px solid transparent;color:#4A5A68}' +
      '#gvb-sw-dismiss:hover{color:#16222E;border-color:#C9D2DA}' +
      '#gvb-sw-bar button:focus-visible{outline:2px solid #2A6DB0;outline-offset:2px}' +
      '@media print{#gvb-sw-bar{display:none!important}}';
    document.head.appendChild(st);
  }

  function hideBar() {
    if (barEl && barEl.parentNode) barEl.parentNode.removeChild(barEl);
    barEl = null;
  }

  function showBar(worker) {
    if (barEl || dismissed || busy() || !document.body) return;
    injectStyle();

    barEl = document.createElement('div');
    barEl.id = 'gvb-sw-bar';
    // role=status, not a dialog: this is an offer, not an interruption, and it
    // must never take focus from whatever the teacher is typing.
    barEl.setAttribute('role', 'status');
    barEl.setAttribute('aria-live', 'polite');

    var msg = document.createElement('p');
    msg.textContent = 'A new version is ready.';

    var reload = document.createElement('button');
    reload.id = 'gvb-sw-reload';
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.addEventListener('click', function () {
      reload.disabled = true;
      reload.textContent = 'Reloading…';
      accepted = true;   // this reload is wanted; the rate limit must not eat it
      try {
        worker.postMessage({ type: 'SKIP_WAITING' });
      } catch (e) {
        // Worker went away between showing the bar and clicking it. A plain
        // reload picks up whatever is current, which is what the teacher asked
        // for.
        reloadOnce();
      }
    });

    var dismiss = document.createElement('button');
    dismiss.id = 'gvb-sw-dismiss';
    dismiss.type = 'button';
    dismiss.textContent = 'Not now';
    dismiss.setAttribute('aria-label', 'Not now — keep this version until the next reload');
    dismiss.addEventListener('click', function () {
      // For this page load only. Nothing is persisted: a teacher who dismisses
      // once should not stop being offered updates. The worker stays waiting
      // and the offer returns on the next load.
      dismissed = true;
      hideBar();
    });

    barEl.appendChild(msg);
    barEl.appendChild(reload);
    barEl.appendChild(dismiss);
    document.body.appendChild(barEl);
  }

  /* ── watching for an update ─────────────────────────────────────────────
     A worker reaching "installed" while navigator.serviceWorker.controller
     exists is an update to a page already being served. With no controller it
     is the very first install on this origin — there is no older version to
     disrupt, so it takes over without asking. */

  function watch(reg) {
    if (!reg) return;

    if (reg.waiting && navigator.serviceWorker.controller) showBar(reg.waiting);

    reg.addEventListener('updatefound', function () {
      var installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showBar(installing);
        }
      });
    });
  }

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).then(watch).catch(function () {});
  });
}());
