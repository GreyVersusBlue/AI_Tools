/* remote-channel.js — the data-channel plumbing three tools wrote the same way.
   Path 22 P14. `window.RemoteChannel`, a plain global script like
   webrtc-pair.js (which it sits on top of: load that file first).

   Three wrappers pair a board with a phone over a direct WebRTC data channel,
   with no server: 010 Command Center's cc-remote.js, 087 Class Screen's
   cs-remote.js and 004 Classroom Timer's ct-mirror.js. Each carried its own
   copy of the same forty lines: wire a channel's open / close / message events
   to lists of handlers, JSON-parse a message and drop one that is not JSON,
   JSON-stringify and send only while the channel is open. This is that copy,
   once.

   WHAT IS NOT HERE, ON PURPOSE. The pairing itself (offers, answers, the QR
   text) is _shared/webrtc-pair.js's. The message vocabulary is each tool's: this
   file never looks inside a message, so 010's five commands, 087's
   ClassScreenCore.readCommand and 004's start / pause / resume / next stay in
   their own files, as do their QR drawing and their pages' own handling. A
   message on the wire is the JSON text it always was, so a phone on an older
   cached build and a board on a newer one (or the other way round) still talk.

   THE API, the same for both sides:

       RemoteChannel.host(label, opts)       -> Promise<api>  (api.offerPayload)
       RemoteChannel.join(offerPayload, opts) -> Promise<api>  (api.answerPayload)

       api.onOpen(fn)  api.onClose(fn)  api.onMessage(fn)   fn gets the parsed
                                                            message; text that
                                                            is not JSON is dropped
       api.send(data)                 JSON text, only while the channel is open
       api.isOpen()  api.close()  api.channel  api.pc
       api.applyAnswer(answer, pc?)   host only; pc defaults to api.pc

   `label` names the data channel and is the host's to choose ('cc-remote',
   'class-screen', 'timer'); the joining side gets the channel the host made.

   opts.fireIfOpen (default false): the joining side's channel can arrive
   already open, and then no 'open' event ever fires for it. 087 asks for the
   handlers to be called once in that case, as its own wrapper always did; 010
   and 004 do not, and their wrappers' behaviour is kept. */
(function (global) {
  'use strict';

  function wire(channel, handlers) {
    channel.addEventListener('open', function () { handlers.open.forEach(function (fn) { fn(); }); });
    channel.addEventListener('close', function () { handlers.close.forEach(function (fn) { fn(); }); });
    channel.addEventListener('message', function (e) {
      var data;
      try { data = JSON.parse(e.data); } catch (err) { return; }
      handlers.message.forEach(function (fn) { fn(data); });
    });
  }

  function makeApi(opts) {
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
        try { if (api.channel) api.channel.close(); } catch (e) { /* already closed */ }
        try { if (api.pc) api.pc.close(); } catch (e) { /* already closed */ }
      },
      _attach: function (channel) {
        api.channel = channel;
        wire(channel, handlers);
        if (opts.fireIfOpen && channel.readyState === 'open') {
          setTimeout(function () { handlers.open.forEach(function (fn) { fn(); }); }, 0);
        }
      }
    };
    return api;
  }

  /** The board side (whoever draws the first QR). Resolves once `offerPayload` is ready. */
  function host(label, opts) {
    var api = makeApi(opts || {});
    return global.WebRTCPair.createOffer(label).then(function (r) {
      api.pc = r.pc;
      api.offerPayload = r.offerPayload;
      api._attach(r.channel);
      api.applyAnswer = function (answer, pc) { return global.WebRTCPair.applyAnswer(pc || api.pc, answer); };
      return api;
    });
  }

  /** The phone side. Resolves once `answerPayload` (the reply to show back) is ready. */
  function join(offerPayload, opts) {
    var api = makeApi(opts || {});
    return global.WebRTCPair.createAnswer(offerPayload, function (ch) { api._attach(ch); }).then(function (r) {
      api.pc = r.pc;
      api.answerPayload = r.answerPayload;
      return api;
    });
  }

  global.RemoteChannel = { host: host, join: join };
})(typeof window !== 'undefined' ? window : globalThis);
