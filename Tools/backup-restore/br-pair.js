/* br-pair.js — pairing wrapper around _shared/webrtc-pair.js for the Backup
   & Restore device-to-device transfer.

   Structured after Tools/classroom-timer/ct-mirror.js's host/join split (the
   same manual-QR-signaling handshake — see _shared/webrtc-pair.js for why
   there is no STUN/TURN and why it only works on a shared local network),
   but this feature moves a one-shot, file-sized payload once, rather than
   repeatedly mirroring a small live snapshot — so both sides here get
   symmetric send()/onMessage() access to the raw data channel, instead of
   ct-mirror's push-only host / JSON-only join shape. br-transfer.js is what
   actually frames that payload into wire-sized chunks; this file only gets
   the channel open and hands back a thin, role-agnostic handle to it.

   drawQR() below is the same implementation as ct-mirror.js's — copied, not
   imported, so this tool's transfer feature has no runtime dependency on
   another tool's subfolder (see CLAUDE.md: a tool-specific support file that
   is genuinely single-tool lives in that tool's own subfolder).

   Plain global script, matching this site's classic-script tools: the page
   that uses this, 009-backup-restore.html, is one big non-module IIFE, and
   an ES module here would need its own <script type="module"> island with
   no clean way back into that IIFE's closures (buildEnvelope, readEnvelope,
   the restore preview, …) that the transfer flow needs to call into. */
(function (global) {
  'use strict';

  /**
   * Draws `text` as a QR code onto `canvas`, sizing the canvas's backing
   * pixel buffer off the code's actual module count rather than a fixed
   * size — see Tools/classroom-timer/ct-mirror.js's drawQR for the full
   * reasoning (an SDP-sized payload needs 100+ modules, and that count
   * varies enough between offers/answers to cross a QR version boundary and
   * make a fixed pixel size unreadable on some of them).
   */
  function drawQR(canvas, text) {
    var qr = global.qrcode(0, 'L'); // typeNumber 0 = smallest version that fits; L = lowest EC, most capacity
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var quiet = 4; // standard QR quiet zone
    var total = count + quiet * 2;
    var MIN_PX_PER_MODULE = 8;
    var size = total * MIN_PX_PER_MODULE;
    canvas.width = size;
    canvas.height = size;
    var px = size / total;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#16222e';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          var x0 = Math.round((quiet + c) * px);
          var x1 = Math.round((quiet + c + 1) * px);
          var y0 = Math.round((quiet + r) * px);
          var y1 = Math.round((quiet + r + 1) * px);
          ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
    }
  }

  /** Wires a data channel's open/close/message events into an api's handler
      lists, and records the channel on the api so callers (br-transfer.js's
      sendPayload, mainly) can use it directly. */
  function wire(channel, api, handlers) {
    api.channel = channel;
    channel.addEventListener('open', function () { handlers.open.forEach(function (fn) { fn(); }); });
    channel.addEventListener('close', function () { handlers.close.forEach(function (fn) { fn(); }); });
    channel.addEventListener('message', function (e) { handlers.message.forEach(function (fn) { fn(e.data); }); });
  }

  /**
   * Host side ("send this backup to a device"): a peer connection plus one
   * data channel, an offer already set as the local description, and
   * `offerPayload` — the text to draw as a QR / show for copy-paste.
   * Resolves once the offer is ready.
   */
  function startHost(channelLabel) {
    var handlers = { open: [], close: [], message: [] };
    var api = {
      offerPayload: null, channel: null, pc: null,
      onOpen: function (fn) { handlers.open.push(fn); },
      onClose: function (fn) { handlers.close.push(fn); },
      onMessage: function (fn) { handlers.message.push(fn); },
      send: function (raw) { if (api.channel && api.channel.readyState === 'open') api.channel.send(raw); },
      applyAnswer: function (answerPayload) { return global.WebRTCPair.applyAnswer(api.pc, answerPayload); }
    };
    return global.WebRTCPair.createOffer(channelLabel || 'backup').then(function (result) {
      api.pc = result.pc;
      api.offerPayload = result.offerPayload;
      wire(result.channel, api, handlers);
      return api;
    });
  }

  /**
   * Join side ("receive from a device"): takes the offer text scanned from
   * the host's QR code, and resolves a peer connection plus `answerPayload`
   * — the text to show back. Resolves once the answer is ready; the data
   * channel itself arrives asynchronously afterward (wired the moment it
   * does), so `onOpen`/`onMessage` on the returned api are safe to attach
   * before the underlying channel actually exists yet.
   */
  function startJoin(offerPayload) {
    var handlers = { open: [], close: [], message: [] };
    var api = {
      answerPayload: null, channel: null, pc: null,
      onOpen: function (fn) { handlers.open.push(fn); },
      onClose: function (fn) { handlers.close.push(fn); },
      onMessage: function (fn) { handlers.message.push(fn); },
      send: function (raw) { if (api.channel && api.channel.readyState === 'open') api.channel.send(raw); }
    };
    return global.WebRTCPair.createAnswer(offerPayload, function (channel) {
      wire(channel, api, handlers);
    }).then(function (result) {
      api.pc = result.pc;
      api.answerPayload = result.answerPayload;
      return api;
    });
  }

  global.BRPair = { drawQR: drawQR, startHost: startHost, startJoin: startJoin };
})(window);
