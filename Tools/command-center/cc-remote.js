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

/** Draws `text` as a QR code onto `canvas`. Identical to ct-mirror.js's
    drawQR — see that file's comment for why the canvas is sized off the
    actual module count rather than a fixed pixel size. Kept as a second
    small copy rather than an import across tool folders: this repo's
    existing QR-drawing helpers are already one per tool (qr-code-generator,
    gallery-walk-qr, escape-room-builder, classroom-timer, ...), not a
    single shared one, so this follows that existing pattern rather than
    inventing a cross-tool dependency for a ~30-line function. */
export function drawQR(canvas, text) {
  var qr = window.qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  var count = qr.getModuleCount();
  var quiet = 4;
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
