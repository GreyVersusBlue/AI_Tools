/* webrtc-pair.js — a manual-signaling WebRTC data-channel pairing, with no
   signaling server: the offer/answer SDP travels as text (meant to be shown
   as a QR code and scanned on the other device), the same way this site
   already moves state around in Tools/escape-room-builder — though see
   encodeDescription()/decodeDescription() below for why this doesn't reuse
   _shared/state-link.js's base64(JSON) format for the actual bytes.

   Deliberately host-candidates-only (iceServers: []) — no STUN/TURN. Two
   consequences, both acceptable for this feature's scope: it only works
   between devices that can reach each other directly (the same classroom
   Wi-Fi/LAN, which is the actual use case), and the SDP stays as small as
   possible for a scannable QR code — pulling in STUN-gathered
   server-reflexive candidates roughly doubles it for no benefit on a local
   network.

   Plain global script, matching this site's classic-script tools generally. */
(function (global) {
  'use strict';

  var ICE_GATHER_TIMEOUT_MS = 1500;

  function waitForIceGathering(pc, timeoutMs) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
      function onChange() {
        if (pc.iceGatheringState === 'complete') finish();
      }
      pc.addEventListener('icegatheringstatechange', onChange);
      setTimeout(finish, timeoutMs || ICE_GATHER_TIMEOUT_MS);
    });
  }

  // A QR code's practical capacity depends heavily on module count: past
  // roughly 100x100 modules, the modules get too small to scan reliably at
  // any on-screen size a phone camera can comfortably read. So this uses a
  // deliberately compact wire format instead of state-link.js's generic
  // base64(JSON) — no base64 (which inflates size by a third) and no JSON
  // (SDP is already text; wrapping it in a quoted, escaped JSON string just
  // adds overhead for no benefit here). One type letter, then the SDP with
  // its line endings normalized to save a byte per line, restored on decode
  // since WebRTC expects CRLF in an SDP string.
  function encodeDescription(desc) {
    var typeChar = desc.type === 'offer' ? 'O' : 'A';
    return typeChar + desc.sdp.replace(/\r\n/g, '\n');
  }

  function decodeDescription(payload, expectedType) {
    if (typeof payload !== 'string' || payload.length < 2) return null;
    var typeChar = payload.charAt(0);
    var type = typeChar === 'O' ? 'offer' : (typeChar === 'A' ? 'answer' : null);
    if (type !== expectedType) return null;
    // Normalize to bare \n first, THEN expand to \r\n — idempotent no matter
    // what the payload's line endings look like by the time this runs. A
    // clipboard copy/paste round-trip (the manual-relay path this whole
    // feature depends on) isn't guaranteed to preserve a bare \n as-is; some
    // platforms reintroduce \r\n on the way through. Blindly expanding every
    // \n straight to \r\n without normalizing first would then double up
    // the \r on any line the clipboard already "fixed", corrupting the SDP.
    var sdp = payload.slice(1).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
    // The SDP's own trailing line terminator is meaningful content in this
    // compact encoding, not incidental whitespace — but a paste box's own
    // `.trim()` (reasonable there, to tolerate an accidental leading/
    // trailing space from whatever the code was copied out of) doesn't know
    // that, and strips it right along with everything else. Restore it if
    // it's missing rather than relying on every caller to trim just right.
    if (sdp.slice(-2) !== '\r\n') sdp += '\r\n';
    return { type: type, sdp: sdp };
  }

  /**
   * Host side ("teacher"): a peer connection plus one data channel, an offer
   * already set as the local description, and `offerPayload` — the text to
   * put in a QR code for the other device to scan.
   */
  function createOffer(channelLabel) {
    var pc = new RTCPeerConnection({ iceServers: [] });
    var channel = pc.createDataChannel(channelLabel || 'sync');
    return pc.createOffer()
      .then(function (offer) { return pc.setLocalDescription(offer); })
      .then(function () { return waitForIceGathering(pc); })
      .then(function () {
        return { pc: pc, channel: channel, offerPayload: encodeDescription(pc.localDescription) };
      });
  }

  /**
   * Joining side ("student"): takes the offer text scanned from the host's
   * QR code, and resolves a peer connection plus `answerPayload` — the text
   * to show back (as a QR code) for the host to scan. `onChannel(channel)`
   * fires once the host's data channel arrives.
   */
  function createAnswer(offerPayload, onChannel) {
    var decoded = decodeDescription(offerPayload, 'offer');
    if (!decoded) return Promise.reject(new Error('That code doesn’t look like a mirror-pairing code.'));
    var pc = new RTCPeerConnection({ iceServers: [] });
    if (typeof onChannel === 'function') {
      pc.ondatachannel = function (e) { onChannel(e.channel); };
    }
    return pc.setRemoteDescription(decoded)
      .then(function () { return pc.createAnswer(); })
      .then(function (answer) { return pc.setLocalDescription(answer); })
      .then(function () { return waitForIceGathering(pc); })
      .then(function () {
        return { pc: pc, answerPayload: encodeDescription(pc.localDescription) };
      });
  }

  /** Host side: applies the answer text scanned back from the joining device. */
  function applyAnswer(pc, answerPayload) {
    var decoded = decodeDescription(answerPayload, 'answer');
    if (!decoded) return Promise.reject(new Error('That code doesn’t look like a mirror-pairing reply.'));
    return pc.setRemoteDescription(decoded);
  }

  global.WebRTCPair = { createOffer: createOffer, createAnswer: createAnswer, applyAnswer: applyAnswer };
})(window);
