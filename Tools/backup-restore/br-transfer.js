/* br-transfer.js — chunk a JSON string for an already-open RTCDataChannel,
   and reassemble it on the other end.

   Once _shared/webrtc-pair.js's manual QR/paste handshake has the data
   channel open, there is no reason to keep the QR-sized-message discipline
   that pairing needed — but a multi-hundred-KB backup handed to a single
   channel.send() call still risks two real problems: some browsers cap an
   individual data-channel message well under a megabyte (historically as
   low as 64KB on Safari), and even where the cap is generous, firing the
   whole string at once can overrun the channel's own send buffer before the
   network drains it. So this cuts the payload into fixed-size text chunks,
   sends a small header describing how many are coming, and backs off (via
   the standard 'bufferedamountlow' event) if the buffer gets ahead of the
   wire.

   No sequence numbers are needed on the wire: RTCDataChannel is ordered and
   reliable by default (this site never configures otherwise), so chunks
   arrive in the order they were sent and reassembling by concatenation is
   exact — slicing a JS string by index and rejoining the pieces always
   reconstructs the original exactly, even when a split lands in the middle
   of a UTF-16 surrogate pair (an emoji, some names), because no code units
   are dropped or reordered by doing that.

   Every message on the wire is plain text with a one-character prefix:
     'M' + JSON  — header: { size: <original string length>, chunks: <count> }
     'D' + text  — one chunk of the payload, verbatim
   Anything else is ignored rather than treated as fatal, so a stray message
   from some other protocol sharing the same channel can't crash a transfer
   that is otherwise fine.

   Plain global script, matching this site's classic-script tools
   (_shared/webrtc-pair.js, _shared/qr-scan.js) and this tool's own
   br-pair.js. */
(function (global) {
  'use strict';

  var CHUNK_CHARS = 16000;          // characters per chunk — comfortably under every browser's per-message ceiling even after UTF-8 expansion
  var BUFFER_HIGH_WATER = 262144;   // pause sending once this many bytes are queued but not yet on the wire
  var BUFFER_LOW_WATER = 65536;     // resume once the buffer drains back under this

  /** Splits `text` into chunks of `chunkChars` characters (default
      CHUNK_CHARS). Always returns at least one chunk — an empty string still
      chunks to `['']`, so a receiver's declared chunk count is never a lie. */
  function chunkPayload(text, chunkChars) {
    var size = chunkChars || CHUNK_CHARS;
    var out = [];
    for (var i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    if (!out.length) out.push('');
    return out;
  }

  /**
   * Sends `text` over `channel` (already open) as one header message
   * followed by its chunks, applying backpressure so a large backup can't
   * overrun the channel's send buffer. Resolves once every chunk has been
   * handed to the channel; rejects if the channel closes mid-transfer or a
   * send call throws. `opts.onProgress(sent, total)` fires after each chunk.
   */
  function sendPayload(channel, text, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function () {};
    var chunks = chunkPayload(text, opts.chunkChars);
    return new Promise(function (resolve, reject) {
      try {
        channel.send('M' + JSON.stringify({ size: text.length, chunks: chunks.length }));
      } catch (e) { reject(e); return; }

      var i = 0;
      function onLow() {
        channel.removeEventListener('bufferedamountlow', onLow);
        sendNext();
      }
      function sendNext() {
        if (channel.readyState !== 'open') { reject(new Error('Connection closed mid-transfer.')); return; }
        while (i < chunks.length) {
          if (channel.bufferedAmount > BUFFER_HIGH_WATER) {
            channel.bufferedAmountLowThreshold = BUFFER_LOW_WATER;
            channel.addEventListener('bufferedamountlow', onLow);
            return;
          }
          try { channel.send('D' + chunks[i]); }
          catch (e) { reject(e); return; }
          i++;
          onProgress(i, chunks.length);
        }
        resolve();
      }
      sendNext();
    });
  }

  /**
   * A small state machine for the receiving side. Feed it every message the
   * channel hands you, in arrival order, via `receiver.handleMessage(data)`
   * (a raw string — pass `event.data` straight through, no JSON.parse first).
   * `opts.onProgress(received, total)` fires per chunk; `opts.onComplete(text)`
   * fires once, with the exact original string, when the declared chunk
   * count has all arrived; `opts.onError(err)` fires on a malformed header, a
   * chunk arriving before any header, or a final length mismatch — none of
   * which should happen against this file's own sender, but a corrupted or
   * unrelated message on the same channel shouldn't produce silent data
   * loss. `receiver.reset()` starts a fresh transfer on the same instance.
   */
  function createReceiver(opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function () {};
    var onComplete = opts.onComplete || function () {};
    var onError = opts.onError || function () {};
    var expected = null; // { size, chunks }
    var got = [];
    var done = false;

    function reset() { expected = null; got = []; done = false; }

    function handleMessage(raw) {
      if (done || typeof raw !== 'string' || !raw.length) return;
      var kind = raw.charAt(0);
      var body = raw.slice(1);

      if (kind === 'M') {
        var meta;
        try { meta = JSON.parse(body); } catch (e) { onError(new Error('That transfer header could not be read.')); return; }
        if (!meta || typeof meta.chunks !== 'number' || meta.chunks < 1) {
          onError(new Error('That transfer header could not be read.'));
          return;
        }
        expected = meta;
        got = [];
        return;
      }

      if (kind === 'D') {
        if (!expected) { onError(new Error('Data arrived before the transfer header — try pairing again.')); return; }
        got.push(body);
        onProgress(got.length, expected.chunks);
        if (got.length >= expected.chunks) {
          done = true;
          var text = got.join('');
          if (typeof expected.size === 'number' && text.length !== expected.size) {
            onError(new Error('The transfer finished but did not match its declared size — try again.'));
            return;
          }
          onComplete(text);
        }
        return;
      }
      // Unrecognised message kind: ignore rather than fail a transfer that
      // is otherwise fine over one stray message.
    }

    return { handleMessage: handleMessage, reset: reset };
  }

  global.BRTransfer = {
    CHUNK_CHARS: CHUNK_CHARS,
    chunkPayload: chunkPayload,
    sendPayload: sendPayload,
    createReceiver: createReceiver
  };
})(window);
