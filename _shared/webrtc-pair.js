/* webrtc-pair.js — a manual-signaling WebRTC data-channel pairing, with no
   signaling server: the offer/answer SDP travels as text (meant to be shown
   as a QR code and scanned on the other device), the same way this site
   already moves state around in Tools/escape-room-builder — though see
   encodeDescription()/decodeDescription() below for why this doesn't reuse
   _shared/state-link.js's base64(JSON) format for the actual bytes. The
   pages draw the text with QrDraw.fit() (_shared/qr-draw.js), which sizes
   the code to the room it has and refuses under 4 px per module.

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

  // A QR code's practical capacity depends heavily on module count: a code
  // has to be shown at 4 CSS px per module or more before a phone reads it
  // reliably (_shared/qr-draw.js measured that), so every byte here is
  // screen width on the phone that has to show the reply. Two wire formats:
  //
  // FULL ('O' / 'A', the only format until v223): one type letter, then the
  // SDP as-is with its line endings normalized to save a byte per line. No
  // base64 (which inflates size by a third) and no JSON. A Chrome data-channel
  // offer is ~570 bytes this way: QR version 16, 81 modules, 356 px at the
  // floor, which is wider than a 375 px phone can show.
  //
  // COMPACT ('o' / 'a'): the same SDP, line for line, through a dictionary.
  // An SDP for one data channel is mostly lines every browser writes
  // identically ("m=application 9 UDP/DTLS/SCTP webrtc-datachannel"), so each
  // of those becomes one character; the lines that carry something (the
  // candidate, ufrag, password, fingerprint, session id) become a character,
  // their values, and a newline; the fingerprint's 95 characters of colon-hex
  // become 43 of base64. A line no rule knows travels whole behind '~'. That
  // is about 200 bytes for the same offer: version 9, 53 modules, 244 px.
  //
  // It is LOSSLESS, and encodeDescription() checks that rather than trusts
  // it: it decodes its own compact text and falls back to FULL unless that
  // gives back the exact SDP the browser wrote. So the other device is handed
  // the same description it always was, from any browser, and a browser whose
  // SDP the dictionary has never seen only costs bytes. Nothing is rebuilt
  // from a template, which is the usual way this trick goes wrong.
  var CONST_LINES = {
    v: 'v=0',
    s: 's=-',
    t: 't=0 0',
    g: 'a=group:BUNDLE 0',
    x: 'a=extmap-allow-mixed',
    w: 'a=msid-semantic: WMS',
    W: 'a=msid-semantic:WMS *',
    m: 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    c: 'c=IN IP4 0.0.0.0',
    i: 'a=ice-options:trickle',
    q: 'a=setup:actpass',
    b: 'a=setup:active',
    d: 'a=setup:passive',
    M: 'a=mid:0',
    P: 'a=sctp-port:5000',
    z: 'a=max-message-size:262144',
    Z: 'a=max-message-size:1073741823',
    r: 'a=sendrecv',
    e: 'a=end-of-candidates'
  };
  var CONST_CODE = {};
  Object.keys(CONST_LINES).forEach(function (k) { CONST_CODE[CONST_LINES[k]] = k; });

  function hexToB64(hex) {
    var bin = '';
    hex.split(':').forEach(function (h) { bin += String.fromCharCode(parseInt(h, 16)); });
    return btoa(bin).replace(/=+$/, '');
  }
  function b64ToHex(b64) {
    var bin = atob(b64), out = [];
    for (var n = 0; n < bin.length; n++) {
      var h = bin.charCodeAt(n).toString(16).toUpperCase();
      out.push(h.length < 2 ? '0' + h : h);
    }
    return out.join(':');
  }

  // Lines with a value. `pack` returns the value text or null when the line
  // is not this rule's; `unpack` gives the line back. First match wins, so
  // the specific shapes sit above the bare prefixes that catch the rest.
  var VALUE_RULES = [
    { code: 'o',
      pack: function (l) { var m = /^o=- (\d+) (\d+) IN IP4 127\.0\.0\.1$/.exec(l); return m ? m[1] + ' ' + m[2] : null; },
      unpack: function (v) { var p = v.split(' '); return 'o=- ' + p[0] + ' ' + p[1] + ' IN IP4 127.0.0.1'; } },
    { code: 'k',
      pack: function (l) { var m = /^a=candidate:(\d+) 1 udp (\d+) (\S+) (\d+) typ host generation 0 network-cost (\d+)$/.exec(l); return m ? m.slice(1).join(' ') : null; },
      unpack: function (v) { var p = v.split(' '); return 'a=candidate:' + p[0] + ' 1 udp ' + p[1] + ' ' + p[2] + ' ' + p[3] + ' typ host generation 0 network-cost ' + p[4]; } },
    { code: 'K',
      pack: function (l) { var m = /^a=candidate:(\d+) 1 udp (\d+) (\S+) (\d+) typ host generation 0$/.exec(l); return m ? m.slice(1).join(' ') : null; },
      unpack: function (v) { var p = v.split(' '); return 'a=candidate:' + p[0] + ' 1 udp ' + p[1] + ' ' + p[2] + ' ' + p[3] + ' typ host generation 0'; } },
    { code: 'f',
      pack: function (l) { var m = /^a=fingerprint:sha-256 ((?:[0-9A-F]{2}:){31}[0-9A-F]{2})$/.exec(l); return m ? hexToB64(m[1]) : null; },
      unpack: function (v) { return 'a=fingerprint:sha-256 ' + b64ToHex(v); } },
    prefixRule('C', 'a=candidate:'),
    prefixRule('u', 'a=ice-ufrag:'),
    prefixRule('p', 'a=ice-pwd:'),
    prefixRule('F', 'a=fingerprint:'),
    prefixRule('O', 'o='),
    prefixRule('~', '')
  ];
  function prefixRule(code, prefix) {
    return { code: code,
      pack: function (l) { return l.indexOf(prefix) === 0 ? l.slice(prefix.length) : null; },
      unpack: function (v) { return prefix + v; } };
  }
  var VALUE_BY_CODE = {};
  VALUE_RULES.forEach(function (r) { VALUE_BY_CODE[r.code] = r; });

  /** SDP text (bare \n line endings, trailing \n) to the compact body. */
  function packSdp(sdp) {
    var lines = sdp.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    var out = '';
    for (var n = 0; n < lines.length; n++) {
      var line = lines[n];
      if (Object.prototype.hasOwnProperty.call(CONST_CODE, line)) { out += CONST_CODE[line]; continue; }
      for (var k = 0; k < VALUE_RULES.length; k++) {
        var v = VALUE_RULES[k].pack(line);
        if (v !== null) { out += VALUE_RULES[k].code + v + '\n'; break; }
      }
    }
    return out;
  }

  /** The compact body back to SDP lines; null if it is not one. */
  function unpackSdp(body) {
    var lines = [], at = 0;
    try {
      while (at < body.length) {
        var code = body.charAt(at++);
        if (code === '\n') continue; // a blank line a paste added
        if (Object.prototype.hasOwnProperty.call(CONST_LINES, code)) { lines.push(CONST_LINES[code]); continue; }
        var rule = VALUE_BY_CODE[code];
        if (!rule) return null;
        var end = body.indexOf('\n', at);
        if (end === -1) end = body.length; // the last newline is what a paste box trims
        lines.push(rule.unpack(body.slice(at, end)));
        at = end + 1;
      }
    } catch (e) {
      return null; // atob on a mangled fingerprint
    }
    return lines.length ? lines : null;
  }

  function encodeFull(desc) {
    var typeChar = desc.type === 'offer' ? 'O' : 'A';
    return typeChar + desc.sdp.replace(/\r\n/g, '\n');
  }

  function encodeDescription(desc) {
    var full = encodeFull(desc);
    try {
      var compact = (desc.type === 'offer' ? 'o' : 'a') + packSdp(full.slice(1));
      var back = decodeDescription(compact, desc.type);
      var same = decodeDescription(full, desc.type);
      if (back && same && back.sdp === same.sdp && compact.length < full.length) return compact;
    } catch (e) { /* fall through to the format that needs nothing */ }
    return full;
  }

  function decodeDescription(payload, expectedType) {
    if (typeof payload !== 'string' || payload.length < 2) return null;
    var typeChar = payload.charAt(0);
    var type = /[Oo]/.test(typeChar) ? 'offer' : (/[Aa]/.test(typeChar) ? 'answer' : null);
    if (type !== expectedType) return null;
    // Normalize to bare \n first, THEN expand to \r\n — idempotent no matter
    // what the payload's line endings look like by the time this runs. A
    // clipboard copy/paste round-trip (the manual-relay path this whole
    // feature depends on) isn't guaranteed to preserve a bare \n as-is; some
    // platforms reintroduce \r\n on the way through. Blindly expanding every
    // \n straight to \r\n without normalizing first would then double up
    // the \r on any line the clipboard already "fixed", corrupting the SDP.
    var body = payload.slice(1).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (typeChar === 'o' || typeChar === 'a') {
      var lines = unpackSdp(body);
      if (!lines) return null;
      return { type: type, sdp: lines.join('\r\n') + '\r\n' };
    }
    var sdp = body.replace(/\n/g, '\r\n');
    // The SDP's own trailing line terminator is meaningful content in this
    // encoding, not incidental whitespace — but a paste box's own
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

  global.WebRTCPair = { createOffer: createOffer, createAnswer: createAnswer, applyAnswer: applyAnswer,
    // The wire format, for the suite that pins it (Tools/share/test/pairing-code.test.mjs).
    encodeDescription: encodeDescription, decodeDescription: decodeDescription };
})(window);
