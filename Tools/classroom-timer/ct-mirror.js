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
 * Draws `text` as a QR code onto `canvas`, sizing the canvas's actual pixel
 * buffer itself rather than trusting whatever width/height it already has.
 *
 * An SDP-sized payload needs ~100+ modules even at the lowest error
 * correction level, and that module count isn't fixed — it varies a little
 * from one offer/answer to the next (random session IDs, a slightly
 * different candidate count), sometimes enough to cross into the next QR
 * version and jump the module count by 4. At that density, a *fixed* pixel
 * size that happens to divide evenly for one module count can land on an
 * unlucky few-pixels-per-module ratio for another and become unreadable —
 * this was caught during testing (the very code this function draws failed
 * to scan back on a canvas sized for an earlier, smaller test payload).
 * Sizing off the actual module count instead keeps a fixed minimum
 * resolution *per module* no matter how the SDP happens to come out.
 *
 * The canvas's CSS size (set by the caller / stylesheet) controls how big
 * it looks on screen; this only controls the backing pixel buffer, which is
 * what both a real camera and this codebase's own getImageData-based tests
 * actually read.
 */
export function drawQR(canvas, text) {
  var qr = window.qrcode(0, 'L'); // typeNumber 0 = smallest version that fits; L = lowest EC, most capacity
  qr.addData(text);
  qr.make();
  var count = qr.getModuleCount();
  var quiet = 4; // standard QR quiet zone
  var total = count + quiet * 2;
  var MIN_PX_PER_MODULE = 8; // generous margin — a real camera sees more noise than a clean canvas render
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
        // Round each module's edges independently (not floor+fixed-width) so
        // adjacent modules tile exactly with no gap and no overlap. A fixed
        // "+1px overshoot" (fine for the handful of large modules a printed
        // QR needs) bleeds into neighboring modules once a payload this size
        // pushes the module count past ~100 and each one is only a few
        // pixels wide — enough to make jsQR unable to read the modules back
        // at all, which is exactly the size these pairing codes are.
        var x0 = Math.round((quiet + c) * px);
        var x1 = Math.round((quiet + c + 1) * px);
        var y0 = Math.round((quiet + r) * px);
        var y1 = Math.round((quiet + r + 1) * px);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
  }
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
