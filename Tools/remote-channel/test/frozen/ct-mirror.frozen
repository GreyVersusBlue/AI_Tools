// ct-mirror.js — "Mirror to a device": pairs this Classroom Timer with one
// other device (a student's phone) over a direct WebRTC data channel, no
// server involved. Signaling — the offer/answer SDP exchange a WebRTC
// connection needs before it can talk directly — happens by hand instead:
// this device shows a QR code, the other scans it and shows one back. See
// _shared/webrtc-pair.js for why there's no STUN/TURN server, and
// _shared/qr-scan.js for the camera-scanning half.
//
// The data channel itself is bidirectional (it's a plain RTCDataChannel),
// and both sides expose the same send()/onMessage() shape so either side can
// push to the other — HOST pushes getDisplaySnapshot() one-way to drive the
// mirrored display, and JOIN pushes `{type:'cmd', cmd:'start'|'pause'|
// 'resume'|'next'}` the other way so the phone can act as a remote. Neither
// side has to know in advance which messages the other will send; the
// message shape itself (a `type` field) is agreed by the callers in
// 004-Classroom Timer.html and mirror.html, not by this module.
//
// Covers both roles so the QR-drawing code and the small message shape the
// two sides agree on live in exactly one place:
//   - HOST, used by 004-Classroom Timer.html itself — creates the offer, scans
//     the reply, then pushes out whatever startHost().send() is given, and
//     hands incoming messages (the phone's remote-control commands) to
//     onMessage().
//   - JOIN, used by classroom-timer/mirror.html — scans the offer, shows the
//     reply, hands incoming messages (the mirrored display snapshot) to
//     onMessage(), and can send({...}) back (the remote-control commands).

/**
 * Draws `text` as a QR code onto `canvas`, through _shared/qr-draw.js's fit().
 *
 * This file used to carry its own renderer, sized at 8 px per module in the
 * canvas's pixel buffer because an SDP-sized payload's module count moves
 * from one offer to the next. That fixed the buffer and not what a camera
 * sees: the stylesheet then showed the canvas at 260 px, about 2.9 px per
 * module for the 81-module code. fit() sizes the canvas on screen instead,
 * from the room its parent has, in whole px per module and never under 4;
 * when there is not room it hides the canvas and says so beside it.
 */
export function drawQR(canvas, text) {
  return window.QrDraw.fit(canvas, text);
}

/** Host side. Resolves once the offer is ready; `offerPayload` is what to draw as a QR. */
export function startHost() {
  const handlers = { open: [], close: [], message: [] };
  let channel = null;
  const api = {
    offerPayload: null,
    onOpen(fn) { handlers.open.push(fn); },
    onClose(fn) { handlers.close.push(fn); },
    onMessage(fn) { handlers.message.push(fn); },
    applyAnswer(answerPayload, pc) { return window.WebRTCPair.applyAnswer(pc, answerPayload); },
    send(data) { if (channel && channel.readyState === 'open') channel.send(JSON.stringify(data)); },
  };
  return window.WebRTCPair.createOffer('timer').then((result) => {
    channel = result.channel;
    api.pc = result.pc;
    api.offerPayload = result.offerPayload;
    channel.addEventListener('open', () => handlers.open.forEach((fn) => fn()));
    channel.addEventListener('close', () => handlers.close.forEach((fn) => fn()));
    channel.addEventListener('message', (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch (err) { return; }
      handlers.message.forEach((fn) => fn(data));
    });
    return api;
  });
}

/** Join side. Resolves once the answer is ready; `answerPayload` is what to draw as a QR back. */
export function startJoin(offerPayload) {
  const handlers = { open: [], close: [], message: [] };
  let channel = null;
  const api = {
    answerPayload: null,
    onOpen(fn) { handlers.open.push(fn); },
    onClose(fn) { handlers.close.push(fn); },
    onMessage(fn) { handlers.message.push(fn); },
    send(data) { if (channel && channel.readyState === 'open') channel.send(JSON.stringify(data)); },
  };
  return window.WebRTCPair.createAnswer(offerPayload, (ch) => {
    channel = ch;
    channel.addEventListener('open', () => handlers.open.forEach((fn) => fn()));
    channel.addEventListener('close', () => handlers.close.forEach((fn) => fn()));
    channel.addEventListener('message', (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch (err) { return; }
      handlers.message.forEach((fn) => fn(data));
    });
  }).then((result) => {
    api.pc = result.pc;
    api.answerPayload = result.answerPayload;
    return api;
  });
}
