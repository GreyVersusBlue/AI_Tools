// cc-remote.js — pairs this Command Center dashboard (the laptop, always the
// HOST role) with a phone (the JOIN role, see remote.html) over a direct
// WebRTC data channel, no server involved. Signaling is manual, the same way
// Classroom Timer's Mirror feature does it — see _shared/webrtc-pair.js for
// why there's no STUN/TURN, and Tools/classroom-timer/ct-mirror.js for the
// pattern this file is deliberately modeled on.
//
// The one real difference from ct-mirror.js: Mirror is one-way (the host
// pushes a display snapshot; the phone only ever listens). Here the traffic
// runs the other way too — the phone is the one sending five named commands,
// and the dashboard is the one applying them — so both startHost() and
// startJoin() below expose both onMessage() and send(), instead of ct-mirror
// giving only one side a send(). Nothing about the pairing itself changes:
// still one data channel, still JSON messages, still whoever created the
// offer is "host" purely for who draws the first QR code.

/** Draws `text` as a QR code onto `canvas`, fitted to the room its parent has
    by _shared/qr-draw.js (whole px per module, never under 4 on screen). */
export function drawQR(canvas, text) {
  return window.QrDraw.fit(canvas, text);
}

function wireChannel(channel, handlers) {
  channel.addEventListener('open', function () { handlers.open.forEach(function (fn) { fn(); }); });
  channel.addEventListener('close', function () { handlers.close.forEach(function (fn) { fn(); }); });
  channel.addEventListener('message', function (e) {
    var data;
    try { data = JSON.parse(e.data); } catch (err) { return; }
    handlers.message.forEach(function (fn) { fn(data); });
  });
}

/** Dashboard side. Resolves once the offer is ready; `offerPayload` is what
    to draw as a QR for the phone to scan. `onMessage` receives commands the
    phone sends; `send` pushes a state snapshot back the other way, so the
    phone can show what's currently out / picked / running without polling. */
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
  return window.WebRTCPair.createOffer('cc-remote').then((result) => {
    channel = result.channel;
    api.pc = result.pc;
    api.offerPayload = result.offerPayload;
    wireChannel(channel, handlers);
    return api;
  });
}

/** Phone side. Resolves once the answer is ready; `answerPayload` is what to
    show back (as a QR) for the dashboard to scan. `send` is how the phone
    fires a command; `onMessage` is how it hears the dashboard's snapshot
    pushes back. */
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
    wireChannel(channel, handlers);
  }).then((result) => {
    api.pc = result.pc;
    api.answerPayload = result.answerPayload;
    return api;
  });
}
