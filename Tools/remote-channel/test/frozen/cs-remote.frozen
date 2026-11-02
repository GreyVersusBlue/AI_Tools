/* cs-remote.js — pairs 087 Class Screen (the board, always HOST) with a
   phone (JOIN, Tools/class-screen/remote.html) over a direct WebRTC data
   channel. No server: the offer and answer travel as QR codes or pasted text,
   through _shared/webrtc-pair.js, exactly as 010 Command Center's remote does
   (Tools/command-center/cc-remote.js, the pattern this file follows).

   Why a copy and not an import of cc-remote.js: that file is an ES module in
   another tool's folder, and this page is a classic script. The wrapper is
   thirty lines of event plumbing; if a third tool wants it, it belongs in
   _shared/ and both tools should move onto that one copy.

   Traffic runs both ways, as JSON: the phone sends commands (see
   ClassScreenCore.readCommand for the vocabulary), and the board sends back a
   snapshot of what the phone should show. Only the teacher's own phone is in
   scope — Path 8's standing decision is that nothing here runs on a student
   device.

   Classic script publishing window.ClassScreenRemote. */
(function (global) {
  'use strict';

  var LABEL = 'class-screen';

  function wire(channel, handlers) {
    channel.addEventListener('open', function () { handlers.open.forEach(function (fn) { fn(); }); });
    channel.addEventListener('close', function () { handlers.close.forEach(function (fn) { fn(); }); });
    channel.addEventListener('message', function (e) {
      var data;
      try { data = JSON.parse(e.data); } catch (err) { return; }
      handlers.message.forEach(function (fn) { fn(data); });
    });
  }

  function makeApi() {
    var handlers = { open: [], close: [], message: [] };
    var api = {
      channel: null,
      pc: null,
      onOpen: function (fn) { handlers.open.push(fn); },
      onClose: function (fn) { handlers.close.push(fn); },
      onMessage: function (fn) { handlers.message.push(fn); },
      send: function (data) {
        if (api.channel && api.channel.readyState === 'open') api.channel.send(JSON.stringify(data));
      },
      isOpen: function () { return !!(api.channel && api.channel.readyState === 'open'); },
      close: function () {
        try { if (api.channel) api.channel.close(); } catch (e) {}
        try { if (api.pc) api.pc.close(); } catch (e) {}
      },
      _attach: function (channel) {
        api.channel = channel;
        wire(channel, handlers);
        /* The joining side's channel can arrive already open, and then no
           'open' event ever fires for it. */
        if (channel.readyState === 'open') setTimeout(function () { handlers.open.forEach(function (fn) { fn(); }); }, 0);
      }
    };
    return api;
  }

  /** Board side. Resolves once `offerPayload` (the text to show as a QR) is ready. */
  function host() {
    var api = makeApi();
    return global.WebRTCPair.createOffer(LABEL).then(function (r) {
      api.pc = r.pc;
      api.offerPayload = r.offerPayload;
      api._attach(r.channel);
      api.applyAnswer = function (answer) { return global.WebRTCPair.applyAnswer(api.pc, answer); };
      return api;
    });
  }

  /** Phone side. Resolves once `answerPayload` (the reply to show) is ready. */
  function join(offerPayload) {
    var api = makeApi();
    return global.WebRTCPair.createAnswer(offerPayload, function (ch) { api._attach(ch); }).then(function (r) {
      api.pc = r.pc;
      api.answerPayload = r.answerPayload;
      return api;
    });
  }

  global.ClassScreenRemote = { host: host, join: join };
})(window);
