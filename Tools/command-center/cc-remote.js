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
//
// The channel plumbing (events to handler lists, JSON in and out, send only
// while open) is _shared/remote-channel.js since Path 22 P14, shared with
// 087's cs-remote.js and 004's ct-mirror.js; this file keeps this tool's own
// data-channel label and its export names, so remote.html and the dashboard
// are unchanged. Pages load remote-channel.js after webrtc-pair.js.

/** Draws `text` as a QR code onto `canvas`, fitted to the room its parent has
    by _shared/qr-draw.js (whole px per module, never under 4 on screen). */
export function drawQR(canvas, text) {
  return window.QrDraw.fit(canvas, text);
}

/** Dashboard side. Resolves once the offer is ready; `offerPayload` is what
    to draw as a QR for the phone to scan. `onMessage` receives commands the
    phone sends; `send` pushes a state snapshot back the other way, so the
    phone can show what's currently out / picked / running without polling. */
export function startHost() {
  return window.RemoteChannel.host('cc-remote');
}

/** Phone side. Resolves once the answer is ready; `answerPayload` is what to
    show back (as a QR) for the dashboard to scan. `send` is how the phone
    fires a command; `onMessage` is how it hears the dashboard's snapshot
    pushes back. */
export function startJoin(offerPayload) {
  return window.RemoteChannel.join(offerPayload);
}
