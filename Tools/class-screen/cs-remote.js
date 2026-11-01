/* cs-remote.js — pairs 087 Class Screen (the board, always HOST) with a
   phone (JOIN, Tools/class-screen/remote.html) over a direct WebRTC data
   channel. No server: the offer and answer travel as QR codes or pasted text,
   through _shared/webrtc-pair.js, exactly as 010 Command Center's remote does
   (Tools/command-center/cc-remote.js, the pattern this file follows).

   The channel plumbing is _shared/remote-channel.js (Path 22 P14), the one copy
   cc-remote.js and 004's ct-mirror.js use too; this file is what is 087's own
   in it: the data-channel label, the export name, and asking for the joining
   side's already-open channel to call its open handlers once. Pages load
   remote-channel.js after webrtc-pair.js.

   Traffic runs both ways, as JSON: the phone sends commands (see
   ClassScreenCore.readCommand for the vocabulary), and the board sends back a
   snapshot of what the phone should show. Only the teacher's own phone is in
   scope — Path 8's standing decision is that nothing here runs on a student
   device.

   Classic script publishing window.ClassScreenRemote. */
(function (global) {
  'use strict';

  var LABEL = 'class-screen';
  var OPTS = { fireIfOpen: true };

  /** Board side. Resolves once `offerPayload` (the text to show as a QR) is ready. */
  function host() { return global.RemoteChannel.host(LABEL, OPTS); }

  /** Phone side. Resolves once `answerPayload` (the reply to show) is ready. */
  function join(offerPayload) { return global.RemoteChannel.join(offerPayload, OPTS); }

  global.ClassScreenRemote = { host: host, join: join };
})(window);
