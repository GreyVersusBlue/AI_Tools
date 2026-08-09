// sv-handoff.js — "Hand off an in-progress layout": pairs this School Layout
// Visualizer with one other device over a direct WebRTC data channel (no
// server), then streams the full project JSON across in one shot — instead
// of the manual export-a-file / re-import-it-elsewhere round trip. Mirrors
// Tools/classroom-timer/ct-mirror.js's QR-pairing pattern (see
// _shared/webrtc-pair.js for why there's no STUN/TURN server) but both
// sides here run the same editor, so either device can be the one sending
// or the one receiving.
//
// A full project payload (grid data + trace images + groups) can run well
// past a safe single WebRTC message size in some browsers, so the JSON
// string is split into fixed-size chunks and reassembled on the other end.

const CHUNK_SIZE = 12000; // chars per data-channel message — comfortably under every browser's limit

/** Draws `text` as a QR code onto `canvas`, sized off the actual module count. */
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

function sendChunked(channel, payload) {
  const json = JSON.stringify(payload);
  const total = Math.max(1, Math.ceil(json.length / CHUNK_SIZE));
  channel.send(JSON.stringify({ t: 'meta', total, length: json.length }));
  for (let i = 0; i < total; i++) {
    channel.send(JSON.stringify({ t: 'chunk', i, data: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) }));
  }
  channel.send(JSON.stringify({ t: 'end' }));
}

/** Reassembles chunked messages arriving on `channel`; calls onProgress(i, total) and onComplete(payload). */
function attachReceiver(channel, { onProgress, onComplete, onError }) {
  let total = 0;
  const parts = [];
  channel.addEventListener('message', (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (msg.t === 'meta') {
      total = msg.total;
      parts.length = 0;
    } else if (msg.t === 'chunk') {
      parts[msg.i] = msg.data;
      if (typeof onProgress === 'function') onProgress(parts.filter(Boolean).length, total);
    } else if (msg.t === 'end') {
      try {
        const json = parts.join('');
        const payload = JSON.parse(json);
        if (typeof onComplete === 'function') onComplete(payload);
      } catch (err) {
        if (typeof onError === 'function') onError(err);
      }
    }
  });
}

/** Host side ("sending device"): resolves once the offer is ready to show as a QR/code. */
export function startHost() {
  const handlers = { open: [], close: [] };
  let channel = null;
  const api = {
    offerPayload: null,
    onOpen(fn) { handlers.open.push(fn); },
    onClose(fn) { handlers.close.push(fn); },
    applyAnswer(answerPayload) { return window.WebRTCPair.applyAnswer(api.pc, answerPayload); },
    sendProject(payload) { sendChunked(channel, payload); },
  };
  return window.WebRTCPair.createOffer('sv-handoff').then((result) => {
    channel = result.channel;
    api.pc = result.pc;
    api.offerPayload = result.offerPayload;
    channel.addEventListener('open', () => handlers.open.forEach((fn) => fn()));
    channel.addEventListener('close', () => handlers.close.forEach((fn) => fn()));
    return api;
  });
}

/** Join side ("receiving device"): resolves once the answer is ready to show back. */
export function startJoin(offerPayload, { onProgress, onComplete, onError } = {}) {
  const handlers = { open: [], close: [] };
  const api = {
    answerPayload: null,
    onOpen(fn) { handlers.open.push(fn); },
    onClose(fn) { handlers.close.push(fn); },
  };
  return window.WebRTCPair.createAnswer(offerPayload, (channel) => {
    channel.addEventListener('open', () => handlers.open.forEach((fn) => fn()));
    channel.addEventListener('close', () => handlers.close.forEach((fn) => fn()));
    attachReceiver(channel, { onProgress, onComplete, onError });
  }).then((result) => {
    api.pc = result.pc;
    api.answerPayload = result.answerPayload;
    return api;
  });
}
